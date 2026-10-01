// Сервер карты Анакарии: REST API + WebSocket (живые обновления) + раздача собранного сайта.
//   npm run server            — только API (для разработки вместе с `npm run dev`)
//   npm start                 — собрать сайт и запустить всё на одном порту
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import express from 'express'
import { WebSocketServer } from 'ws'

import { loadDb, getDb, saveDb, flushDb, backupDb, newId } from './db.js'
import { checkCredentials, issueToken, verifyToken, readConfig, loginAllowed, recordFailure } from './auth.js'
import { isFogged, anomalyState, partyPosition, journeyState } from '../src/shared/geo.js'
import { CITY_TYPES, ROAD_TYPES, ZONE_EFFECTS, POINT_EFFECTS, PARTY_ICONS } from '../src/shared/catalog.js'

const PORT = Number(process.env.PORT) || 3001
// На сервере за туннелем ставим HOST=127.0.0.1, чтобы порт не был виден снаружи
const HOST = process.env.HOST || undefined
const DIST = path.resolve(import.meta.dirname, '..', 'dist')

loadDb()
backupDb()
if (!readConfig()) {
  console.warn('\n⚠  Мастер ещё не создан. Выполни:  npm run set-password -- <логин> <пароль>\n')
}

/* ------------------------- Валидация входных данных ------------------------- */

const T = {
  str: (max = 200) => v => (v == null ? '' : String(v).slice(0, max)),
  num: (min = -1e9, max = 1e9) => v => {
    const n = Number(v)
    if (!Number.isFinite(n)) throw new Error('ожидалось число')
    return Math.max(min, Math.min(max, n))
  },
  numOrNull: (min, max) => v => (v === null || v === '' || v === undefined ? null : T.num(min, max)(v)),
  bool: () => v => !!v,
  oneOf: list => v => {
    if (!list.includes(v)) throw new Error('недопустимое значение: ' + v)
    return v
  },
  color: () => v => {
    if (!/^#[0-9a-f]{3,8}$/i.test(v)) throw new Error('цвет должен быть в формате #rrggbb')
    return v
  },
  idOrNull: () => v => (v ? String(v).slice(0, 40) : null),
  points: (max = 5000) => v => {
    if (!Array.isArray(v) || v.length < 1 || v.length > max) throw new Error('некорректный список точек')
    return v.map(p => {
      const x = Number(p[0]), y = Number(p[1])
      if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('некорректная точка')
      return [Math.round(x * 10) / 10, Math.round(y * 10) / 10]
    })
  }
}

const COORD = T.num(-500, 3000)
const TEXT = T.str(20000)
const SCHEMAS = {
  states: {
    noCreate: true,
    fields: { name: T.str(80), color: T.color(), description: TEXT, secret: TEXT, hidden: T.bool() }
  },
  cities: {
    prefix: 'c',
    defaults: { type: 'town', port: false, stateId: null, population: 0, description: '', secret: '', hidden: false },
    required: ['name', 'x', 'y'],
    fields: {
      name: T.str(80), x: COORD, y: COORD, type: T.oneOf(Object.keys(CITY_TYPES)), port: T.bool(),
      stateId: T.idOrNull(), population: T.num(0, 1e9), description: TEXT, secret: TEXT, hidden: T.bool()
    }
  },
  roads: {
    prefix: 'r',
    defaults: { name: '', type: 'road', description: '', hidden: false },
    required: ['points'],
    fields: { name: T.str(80), type: T.oneOf(Object.keys(ROAD_TYPES)), points: T.points(), description: TEXT, hidden: T.bool() }
  },
  anomalies: {
    prefix: 'a',
    defaults: { kind: 'zone', effect: 'storm', radius: 25, toX: null, toY: null, activeFrom: null, activeTo: null, description: '', secret: '', hidden: false },
    required: ['name', 'x', 'y'],
    fields: {
      kind: T.oneOf(['zone', 'point']),
      effect: T.oneOf([...Object.keys(ZONE_EFFECTS), ...Object.keys(POINT_EFFECTS)]),
      name: T.str(80), x: COORD, y: COORD, radius: T.num(2, 600),
      toX: T.numOrNull(-500, 3000), toY: T.numOrNull(-500, 3000),
      activeFrom: T.numOrNull(0, 1e14), activeTo: T.numOrNull(0, 1e14),
      description: TEXT, secret: TEXT, hidden: T.bool()
    }
  },
  parties: {
    prefix: 'p',
    defaults: { color: '#e8b04a', icon: 'sword', description: '', secret: '', hidden: false, journey: null },
    required: ['name', 'x', 'y'],
    fields: {
      name: T.str(80), color: T.color(), icon: T.oneOf(PARTY_ICONS), x: COORD, y: COORD,
      description: TEXT, secret: TEXT, hidden: T.bool()
    }
  },
  fog: {
    prefix: 'f',
    defaults: { mode: 'add', shape: 'stroke', r: 20 },
    required: ['points'],
    fields: { mode: T.oneOf(['add', 'erase']), shape: T.oneOf(['stroke', 'poly']), r: T.num(0, 400), points: T.points(20000) }
  }
}

const SETTINGS = {
  worldName: T.str(60), worldDate: T.str(120), kmPerPx: T.num(0.001, 1000),
  paceKmPerDay: T.num(1, 2000), realHoursPerGameDay: T.num(0.01, 10000), fogEnabled: T.bool()
}

function sanitize(fields, body, partial) {
  const out = {}
  for (const [k, cast] of Object.entries(fields)) {
    if (!(k in body)) continue
    try {
      out[k] = cast(body[k])
    } catch (e) {
      const err = new Error(`Поле «${k}»: ${e.message}`)
      err.status = 400
      throw err
    }
  }
  if (!partial && !Object.keys(out).length) {
    const err = new Error('Пустой запрос')
    err.status = 400
    throw err
  }
  return out
}

/* ------------------------- Что видят игроки ------------------------- */

const strip = ({ secret, ...rest }) => rest

function viewFor(role, now = Date.now()) {
  const db = getDb()
  if (role === 'master') return { ...db, role, serverTime: now }
  const fogOn = db.settings.fogEnabled
  const fog = fogOn ? db.fog : []
  const fogged = (x, y) => fogOn && isFogged([x, y], fog)
  return {
    role: 'player',
    serverTime: now,
    settings: db.settings,
    states: db.states.filter(s => !s.hidden && !(s.pole && fogged(s.pole[0], s.pole[1]))).map(strip),
    cities: db.cities.filter(c => !c.hidden && !fogged(c.x, c.y)).map(strip),
    roads: db.roads.filter(r => !r.hidden).map(strip),
    anomalies: db.anomalies
      .filter(a => {
        if (a.hidden) return false
        const st = anomalyState(a, now)
        return st.active && !fogged(st.x, st.y)
      })
      .map(strip),
    parties: db.parties.filter(p => !p.hidden).map(strip),
    fog
  }
}

/* ------------------------- WebSocket ------------------------- */

const clients = new Set() // { ws, role }
let lastPlayerView = ''

function playerViewString(now) {
  const { serverTime, ...rest } = viewFor('player', now)
  return JSON.stringify(rest)
}

function send(client, view) {
  if (client.ws.readyState === 1) client.ws.send(JSON.stringify({ type: 'state', state: view }))
}

function broadcast() {
  const now = Date.now()
  const master = viewFor('master', now)
  const player = viewFor('player', now)
  lastPlayerView = playerViewString(now)
  for (const c of clients) send(c, c.role === 'master' ? master : player)
}

// Аномалии появляются/исчезают по времени, отряды доходят до цели — проверяем раз в 5 секунд
setInterval(() => {
  const db = getDb()
  const now = Date.now()
  let changed = false
  for (const p of db.parties) {
    const j = journeyState(p.journey, now)
    if (j && j.done) {
      const last = p.journey.path[p.journey.path.length - 1]
      p.x = last[0]
      p.y = last[1]
      p.journey = null
      changed = true
    }
  }
  if (changed) {
    saveDb()
    broadcast()
    return
  }
  const v = playerViewString(now)
  if (v !== lastPlayerView) {
    lastPlayerView = v
    const player = viewFor('player', now)
    for (const c of clients) if (c.role !== 'master') send(c, player)
  }
}, 5000)

setInterval(backupDb, 6 * 3600 * 1000)

/* ------------------------- HTTP API ------------------------- */

const app = express()
app.disable('x-powered-by')
app.set('trust proxy', 'loopback')
app.use(express.json({ limit: '5mb' }))

function roleOf(req) {
  const h = req.headers.authorization || ''
  const token = h.startsWith('Bearer ') ? h.slice(7) : null
  return token && verifyToken(token) ? 'master' : 'player'
}

function requireMaster(req, res, next) {
  if (roleOf(req) !== 'master') return res.status(401).json({ error: 'Нужно войти как мастер' })
  next()
}

app.post('/api/login', (req, res) => {
  const ip = req.ip
  if (!readConfig()) return res.status(503).json({ error: 'Мастер ещё не настроен на сервере (npm run set-password)' })
  if (!loginAllowed(ip)) return res.status(429).json({ error: 'Слишком много попыток. Подожди 10 минут.' })
  const { login, password } = req.body || {}
  if (!checkCredentials(login, password)) {
    recordFailure(ip)
    return res.status(401).json({ error: 'Неверный логин или пароль' })
  }
  res.json({ token: issueToken(login), login })
})

app.get('/api/state', (req, res) => res.json(viewFor(roleOf(req))))

app.patch('/api/settings', requireMaster, (req, res) => {
  const db = getDb()
  Object.assign(db.settings, sanitize(SETTINGS, req.body || {}, false))
  saveDb()
  broadcast()
  res.json(db.settings)
})

app.post('/api/fog/clear', requireMaster, (req, res) => {
  getDb().fog = []
  saveDb()
  broadcast()
  res.json({ ok: true })
})

app.post('/api/fog/fill', requireMaster, (req, res) => {
  const db = getDb()
  const { width: w, height: h } = db.settings
  db.fog = [{ id: newId('f'), mode: 'add', shape: 'poly', r: 0, points: [[-50, -50], [w + 50, -50], [w + 50, h + 50], [-50, h + 50]] }]
  saveDb()
  broadcast()
  res.json({ ok: true })
})

app.post('/api/parties/:id/journey', requireMaster, (req, res) => {
  const db = getDb()
  const p = db.parties.find(x => x.id === req.params.id)
  if (!p) return res.status(404).json({ error: 'Отряд не найден' })
  const body = req.body || {}
  const pathPts = T.points(20000)(body.path)
  const startAt = T.num(0, 1e14)(body.startAt ?? Date.now())
  const endAt = T.num(0, 1e14)(body.endAt)
  if (pathPts.length < 2 || endAt <= startAt) return res.status(400).json({ error: 'Маршрут или время заданы неверно' })
  // если отряд уже шёл — фиксируем его текущее положение как старт
  const cur = partyPosition(p, Date.now())
  p.x = cur.x
  p.y = cur.y
  p.journey = { path: pathPts, startAt, endAt, label: T.str(120)(body.label), createdAt: Date.now() }
  saveDb()
  broadcast()
  res.json(p)
})

app.post('/api/parties/:id/stop', requireMaster, (req, res) => {
  const db = getDb()
  const p = db.parties.find(x => x.id === req.params.id)
  if (!p) return res.status(404).json({ error: 'Отряд не найден' })
  const cur = partyPosition(p, Date.now())
  p.x = Math.round(cur.x * 10) / 10
  p.y = Math.round(cur.y * 10) / 10
  p.journey = null
  saveDb()
  broadcast()
  res.json(p)
})

app.get('/api/export', requireMaster, (req, res) => {
  flushDb()
  res.setHeader('Content-Disposition', `attachment; filename="anacaria-${new Date().toISOString().slice(0, 10)}.json"`)
  res.json(getDb())
})

app.post('/api/:col', requireMaster, (req, res) => {
  const schema = SCHEMAS[req.params.col]
  if (!schema || schema.noCreate) return res.status(404).json({ error: 'Неизвестный тип объекта' })
  const data = sanitize(schema.fields, req.body || {}, false)
  for (const r of schema.required || []) if (!(r in data)) return res.status(400).json({ error: `Не заполнено поле «${r}»` })
  const item = { id: newId(schema.prefix), ...schema.defaults, ...data }
  getDb()[req.params.col].push(item)
  saveDb()
  broadcast()
  res.json(item)
})

app.patch('/api/:col/:id', requireMaster, (req, res) => {
  const schema = SCHEMAS[req.params.col]
  if (!schema) return res.status(404).json({ error: 'Неизвестный тип объекта' })
  const item = getDb()[req.params.col].find(x => x.id === req.params.id)
  if (!item) return res.status(404).json({ error: 'Объект не найден' })
  Object.assign(item, sanitize(schema.fields, req.body || {}, true))
  saveDb()
  broadcast()
  res.json(item)
})

app.delete('/api/:col/:id', requireMaster, (req, res) => {
  const schema = SCHEMAS[req.params.col]
  if (!schema || schema.noCreate) return res.status(404).json({ error: 'Неизвестный тип объекта' })
  const list = getDb()[req.params.col]
  const idx = list.findIndex(x => x.id === req.params.id)
  if (idx === -1) return res.status(404).json({ error: 'Объект не найден' })
  list.splice(idx, 1)
  saveDb()
  broadcast()
  res.json({ ok: true })
})

app.use('/api', (req, res) => res.status(404).json({ error: 'Нет такого метода' }))

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.status !== 400) console.error(err)
  res.status(err.status || 500).json({ error: err.status === 400 ? err.message : 'Ошибка сервера' })
})

// Собранный сайт (npm run build)
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST, { index: false, maxAge: '1h' }))
  app.get('*', (req, res) => res.sendFile(path.join(DIST, 'index.html')))
}

const server = http.createServer(app)
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 64 * 1024 })

wss.on('connection', ws => {
  const client = { ws, role: 'player' }
  clients.add(client)
  send(client, viewFor('player'))
  ws.on('message', raw => {
    let msg
    try { msg = JSON.parse(raw) } catch { return }
    if (msg.type === 'auth') {
      client.role = verifyToken(msg.token) ? 'master' : 'player'
      send(client, viewFor(client.role))
    } else if (msg.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong', serverTime: Date.now() }))
    }
  })
  ws.on('close', () => clients.delete(client))
})

server.listen(PORT, HOST, () => console.log(`Анакария: http://${HOST || 'localhost'}:${PORT}`))

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { flushDb(); process.exit(0) })
