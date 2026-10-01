// Сервер карты Анкарии: REST API + WebSocket (живые обновления) + раздача собранного сайта.
//   npm run server            — только API (для разработки вместе с `npm run dev`)
//   npm start                 — собрать сайт и запустить всё на одном порту
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import express from 'express'
import { WebSocketServer } from 'ws'

import { loadDb, getDb, saveDb, flushDb, backupDb, newId, ICON_DIR } from './db.js'
import { checkCredentials, issueToken, verifyToken, hasMasters, loginAllowed, recordFailure } from './auth.js'
import { isFogged, anomalyState, partyPosition, journeyState, subPath, polyLength } from '../src/shared/geo.js'
import { CITY_TYPES, ROAD_TYPES, ZONE_EFFECTS, POINT_EFFECTS, PARTY_ICONS, HUD_LEVELS } from '../src/shared/catalog.js'

const PORT = Number(process.env.PORT) || 3001
// На сервере за туннелем ставим HOST=127.0.0.1, чтобы порт не был виден снаружи
const HOST = process.env.HOST || undefined
const DIST = path.resolve(import.meta.dirname, '..', 'dist')

loadDb()
backupDb()
if (!hasMasters()) {
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

// Подпись на карте: центр, наклон, размер шрифта, изгиб дуги, перенос на две строки
T.label = () => v => {
  if (v === null) return null
  if (typeof v !== 'object') throw new Error('некорректная подпись')
  return {
    x: T.num(-500, 3000)(v.x), y: T.num(-500, 3000)(v.y),
    angle: T.num(-360, 360)(v.angle ?? 0), size: T.num(3, 200)(v.size ?? 18),
    bend: T.num(-0.05, 0.05)(v.bend ?? 0), wrap: !!v.wrap
  }
}

// Тип метки: встроенный ключ или своя иконка из библиотеки «u:<id>»
const MARK_KEYS = [...Object.keys(ZONE_EFFECTS), ...Object.keys(POINT_EFFECTS)]
T.mark = () => v => {
  if (MARK_KEYS.includes(v)) return v
  if (typeof v === 'string' && /^u:[a-z0-9]{4,20}$/.test(v)) return v
  throw new Error('недопустимый тип метки: ' + v)
}
T.stops = () => v => {
  if (!Array.isArray(v) || v.length > 200) throw new Error('некорректный список остановок')
  return v.map(st => ({
    id: String(st?.id || newId('st')).slice(0, 24),
    name: T.str(80)(st?.name),
    s: T.num(0, 1)(st?.s),
    icon: st?.icon ? T.mark()(st.icon) : 'unknown',
    description: T.str(4000)(st?.description),
    hidden: !!st?.hidden
  })).sort((a, b) => a.s - b.s)
}

const COORD = T.num(-500, 3000)
const TEXT = T.str(20000)
const SCHEMAS = {
  states: {
    noCreate: true,
    fields: { name: T.str(80), color: T.color(), label: T.label(), description: TEXT, secret: TEXT, hidden: T.bool() }
  },
  labels: {
    prefix: 'l',
    defaults: { angle: 0, size: 18, bend: 0, wrap: false, style: 'land', hidden: false },
    required: ['text', 'x', 'y'],
    fields: {
      text: T.str(120), x: COORD, y: COORD, angle: T.num(-360, 360), size: T.num(3, 200), bend: T.num(-0.05, 0.05),
      wrap: T.bool(), style: T.oneOf(['land', 'sea', 'region', 'danger']), hidden: T.bool()
    }
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
    defaults: { kind: 'zone', effect: 'storm', size: 1, radius: 25, toX: null, toY: null, activeFrom: null, activeTo: null, description: '', secret: '', hidden: false },
    required: ['name', 'x', 'y'],
    fields: {
      kind: T.oneOf(['zone', 'point']),
      effect: T.mark(), size: T.num(0.3, 8),
      name: T.str(80), x: COORD, y: COORD, radius: T.num(2, 600),
      toX: T.numOrNull(-500, 3000), toY: T.numOrNull(-500, 3000),
      activeFrom: T.numOrNull(0, 1e14), activeTo: T.numOrNull(0, 1e14),
      description: TEXT, secret: TEXT, hidden: T.bool()
    }
  },
  parties: {
    prefix: 'p',
    defaults: { color: '#e8b04a', icon: 'sword', pace: null, route: null, description: '', secret: '', hidden: false, journey: null },
    required: ['name', 'x', 'y'],
    fields: {
      name: T.str(80), color: T.color(), icon: T.oneOf(PARTY_ICONS), x: COORD, y: COORD,
      pace: T.numOrNull(1, 5000), description: TEXT, secret: TEXT, hidden: T.bool()
    }
  },
  routes: {
    prefix: 'w',
    defaults: { name: '', color: '#ff4a3d', kind: 'sea', stops: [], description: '', hidden: false },
    required: ['points'],
    fields: {
      name: T.str(80), color: T.color(), kind: T.oneOf(['sea', 'land']), points: T.points(), stops: T.stops(),
      description: TEXT, hidden: T.bool()
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
  paceKmPerDay: T.num(1, 2000), realHoursPerGameDay: T.num(0.01, 10000), fogEnabled: T.bool(),
  playerPings: T.bool(),
  grid: v => ({ cellKm: T.num(0.1, 5000)(v?.cellKm), type: T.oneOf(['square', 'hex'])(v?.type) })
}

const S = T.str(80)
const HUD = {
  weather: v => ({
    location: S(v?.location), tempDay: T.str(20)(v?.tempDay), tempNight: T.str(20)(v?.tempNight),
    wind: S(v?.wind), clouds: S(v?.clouds), precipitation: S(v?.precipitation)
  }),
  moon: v => ({
    cycle: T.num(0, 1e6)(v?.cycle ?? 0), seasonDay: T.num(0, 1000)(v?.seasonDay ?? 0),
    seasonLength: T.num(1, 1000)(v?.seasonLength ?? 90), north: S(v?.north), south: S(v?.south),
    meters: (Array.isArray(v?.meters) ? v.meters : []).slice(0, 8).map(m => ({
      name: S(m?.name), level: Math.round(T.num(0, HUD_LEVELS.length - 1)(m?.level ?? 0))
    }))
  }),
  visible: T.bool()
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
    labels: db.labels.filter(l => !l.hidden && !fogged(l.x, l.y)),
    routes: db.routes.filter(r => !r.hidden).map(r => ({ ...r, stops: r.stops.filter(st => !st.hidden) })),
    icons: db.icons,
    hud: db.hud?.visible ? db.hud : null,
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
  if (!hasMasters()) return res.status(503).json({ error: 'Мастер ещё не настроен на сервере (npm run set-password)' })
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

app.patch('/api/hud', requireMaster, (req, res) => {
  const db = getDb()
  db.hud = { ...(db.hud || {}), ...sanitize(HUD, req.body || {}, false) }
  saveDb()
  broadcast()
  res.json(db.hud)
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

// Шаг отряда по маршруту: от текущей остановки к другой; follow — камера всех игроков следит
app.post('/api/parties/:id/route-step', requireMaster, (req, res) => {
  const db = getDb()
  const p = db.parties.find(x => x.id === req.params.id)
  const body = req.body || {}
  const route = db.routes.find(r => r.id === body.routeId)
  if (!p || !route) return res.status(404).json({ error: 'Отряд или маршрут не найден' })
  const to = route.stops.find(st => st.id === body.toStop)
  if (!to) return res.status(400).json({ error: 'Нет такой остановки' })
  const from = p.route?.routeId === route.id ? route.stops.find(st => st.id === p.route.stop) : null
  const durationMs = T.num(500, 1e11)(body.durationMs ?? 5000)
  const now = Date.now()
  if (from) {
    const path = subPath(route.points, from.s, to.s)
    if (polyLength(path) > 0.5) p.journey = { path, startAt: now, endAt: now + durationMs, label: `${from.name || 'Остановка'} → ${to.name || 'остановка'}`, createdAt: now }
  }
  if (!p.journey || !from) {
    // отряд ещё не на маршруте — просто ставим на остановку
    const path = subPath(route.points, to.s, to.s)
    p.x = path[0][0]
    p.y = path[0][1]
    p.journey = null
  }
  p.route = { routeId: route.id, stop: to.id }
  saveDb()
  broadcast()
  if (body.follow) {
    const by = verifyToken((req.headers.authorization || '').slice(7))?.sub || 'Мастер'
    const msg = JSON.stringify({ type: 'follow', mode: 'party', partyId: p.id, until: p.journey ? p.journey.endAt + 1500 : now + 3000, by })
    for (const c of clients) if (c.ws.readyState === 1) c.ws.send(msg)
  }
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

/* ---------- Свои иконки мастера: картинка как есть, без обрезки ---------- */
const IMAGE_TYPES = {
  png: b => b.length > 8 && b.readUInt32BE(0) === 0x89504e47,
  jpg: b => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  gif: b => b.length > 6 && b.toString('ascii', 0, 4) === 'GIF8',
  webp: b => b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP'
}

app.post('/api/icons', requireMaster, express.raw({ type: () => true, limit: '3mb' }), (req, res) => {
  const buf = req.body
  if (!Buffer.isBuffer(buf) || !buf.length) return res.status(400).json({ error: 'Пустой файл' })
  // тип определяем по содержимому, а не по имени файла (SVG и прочее не пускаем)
  const ext = Object.keys(IMAGE_TYPES).find(k => IMAGE_TYPES[k](buf))
  if (!ext) return res.status(400).json({ error: 'Нужна картинка PNG, JPG, GIF или WebP' })
  const db = getDb()
  if (db.icons.length >= 500) return res.status(400).json({ error: 'Библиотека переполнена (500 иконок)' })
  const id = newId('i').slice(1)
  const file = `${id}.${ext}`
  fs.mkdirSync(ICON_DIR, { recursive: true })
  fs.writeFileSync(path.join(ICON_DIR, file), buf)
  const icon = {
    id, file,
    name: T.str(60)(req.query.name || 'Иконка'),
    w: Math.round(T.num(1, 4096)(req.query.w || 128)),
    h: Math.round(T.num(1, 4096)(req.query.h || 128)),
    createdAt: Date.now()
  }
  db.icons.push(icon)
  saveDb()
  broadcast()
  res.json(icon)
})

app.patch('/api/icons/:id', requireMaster, (req, res) => {
  const icon = getDb().icons.find(i => i.id === req.params.id)
  if (!icon) return res.status(404).json({ error: 'Иконка не найдена' })
  icon.name = T.str(60)(req.body?.name || icon.name)
  saveDb()
  broadcast()
  res.json(icon)
})

app.delete('/api/icons/:id', requireMaster, (req, res) => {
  const db = getDb()
  const i = db.icons.findIndex(x => x.id === req.params.id)
  if (i === -1) return res.status(404).json({ error: 'Иконка не найдена' })
  const [icon] = db.icons.splice(i, 1)
  try { fs.unlinkSync(path.join(ICON_DIR, icon.file)) } catch { /* уже нет */ }
  saveDb()
  broadcast()
  res.json({ ok: true })
})

app.use('/usericons', express.static(ICON_DIR, {
  maxAge: '30d', immutable: true, index: false,
  setHeaders: r => r.setHeader('X-Content-Type-Options', 'nosniff')
}))

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

/* ---------- Присутствие: курсоры мастеров, пинги, линейки (ничего не сохраняется) ---------- */
const CURSOR_COLORS = ['#ffd166', '#ff7ac0', '#4fd8ff', '#7ee06a', '#c47aff', '#ff9a4e', '#f2f2f2', '#2fd6b4']
let nextClientId = 1

function relay(from, msg) {
  const data = JSON.stringify({ ...msg, id: from.id, name: from.name, color: from.color })
  for (const c of clients) if (c !== from && c.ws.readyState === 1) c.ws.send(data)
}

const num = v => (Number.isFinite(Number(v)) ? Math.round(Number(v) * 10) / 10 : null)

wss.on('connection', ws => {
  const id = nextClientId++
  const client = { ws, role: 'player', id, name: 'Игрок', color: CURSOR_COLORS[id % CURSOR_COLORS.length], pings: [] }
  clients.add(client)
  send(client, viewFor('player'))
  ws.send(JSON.stringify({ type: 'hello', id, color: client.color }))
  // новому клиенту — текущие курсоры и линейки мастеров
  for (const c of clients) {
    if (c === client || c.role !== 'master') continue
    if (c.cursor) ws.send(JSON.stringify({ type: 'cursor', id: c.id, name: c.name, color: c.color, ...c.cursor }))
    if (c.ruler) ws.send(JSON.stringify({ type: 'ruler', id: c.id, name: c.name, color: c.color, points: c.ruler }))
  }

  ws.on('message', raw => {
    let msg
    try { msg = JSON.parse(raw) } catch { return }
    switch (msg.type) {
      case 'auth': {
        const tok = verifyToken(msg.token)
        const wasMaster = client.role === 'master'
        client.role = tok ? 'master' : 'player'
        if (tok) client.name = tok.sub
        else if (wasMaster) {
          client.name = 'Игрок'
          client.cursor = client.ruler = null
          relay(client, { type: 'gone' })
        }
        send(client, viewFor(client.role))
        break
      }
      case 'nick':
        if (client.role !== 'master') client.name = String(msg.name || '').trim().slice(0, 24) || 'Игрок'
        break
      case 'cursor': {
        if (client.role !== 'master') return
        const x = num(msg.x), y = num(msg.y)
        if (x === null || y === null) return
        client.cursor = { x, y }
        relay(client, { type: 'cursor', x, y })
        break
      }
      case 'cursorLeave':
        if (client.role !== 'master') return
        client.cursor = null
        relay(client, { type: 'cursorLeave' })
        break
      case 'ruler': {
        if (client.role !== 'master') return
        const pts = Array.isArray(msg.points) ? msg.points.slice(0, 50).map(p => [num(p?.[0]), num(p?.[1])]).filter(p => p[0] !== null && p[1] !== null) : null
        client.ruler = pts && pts.length > 1 ? pts : null
        relay(client, { type: 'ruler', points: client.ruler })
        break
      }
      case 'follow': {
        if (client.role !== 'master') return
        if (msg.mode === 'view') {
          const x = num(msg.x), y = num(msg.y), span = num(msg.span)
          if (x === null || y === null || !span) return
          relay(client, { type: 'follow', mode: 'view', x, y, span, by: client.name })
        } else if (msg.mode === 'party' && typeof msg.partyId === 'string') {
          relay(client, { type: 'follow', mode: 'party', partyId: msg.partyId.slice(0, 40), until: num(msg.until), by: client.name })
        }
        break
      }
      case 'ping': {
        const x = num(msg.x), y = num(msg.y)
        if (x === null || y === null) return
        if (client.role !== 'master' && !getDb().settings.playerPings) return
        // не чаще раза в 0.7 с и не больше 20 в минуту
        const now = Date.now()
        client.pings = client.pings.filter(t => now - t < 60000)
        if (client.pings.length >= 20 || now - (client.pings[client.pings.length - 1] || 0) < 700) return
        client.pings.push(now)
        relay(client, { type: 'ping', x, y, kind: ['look', 'danger', 'go'].includes(msg.kind) ? msg.kind : 'look' })
        break
      }
    }
  })
  ws.on('close', () => {
    clients.delete(client)
    if (client.role === 'master') relay(client, { type: 'gone' })
  })
})

server.listen(PORT, HOST, () => console.log(`Анкария: http://${HOST || 'localhost'}:${PORT}`))

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { flushDb(); process.exit(0) })
