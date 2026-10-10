// Сервер карты Анкарии: REST API + WebSocket (живые обновления) + раздача собранного сайта.
//   npm run server            — только API (для разработки вместе с `npm run dev`)
//   npm start                 — собрать сайт и запустить всё на одном порту
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import express from 'express'
import { WebSocketServer } from 'ws'

import { loadDb, getDb, saveDb, flushDb, backupDb, newId, ICON_DIR, PORTRAIT_DIR } from './db.js'
import { arts as allArts, addArt, setThumb, removeArts, ARTS_DIR } from './arts.js'
import { checkCredentials, issueToken, verifyToken, readToken, signToken, hasMasters, loginAllowed, recordFailure, changeMasterPassword, isOwner, listMasters, setMasterPassword, removeMaster, isMasterLogin } from './auth.js'
import {
  getPlayer, players as allPlayers, publicPlayer, register, checkPlayer, updatePlayer, setPlayerPassword, removePlayer,
  masterProfile, updateMasterProfile, saveAvatar, AVATAR_DIR, issueTicket, ticketStatus, linkedCharacter, upsertLinkedCharacter,
  findByLogin, LOGIN_RE
} from './accounts.js'
import { WALL_TYPES, WALL_FEATURES, wallLength, wallDone, wallPrice, featurePrice } from '../src/shared/walls.js'
import { TRAIN_DAYS, LINES, splitFallen, cargoOf } from '../src/shared/army.js'
import { computeSettlement, placementProblems, clearingFor, shortFor, priceText, DAMAGE, worseDamage, repairPrice, repairWork, BUILDINGS, JOBS, RES, RACES, EVENT_TYPES, EVENT_DURATIONS, ROAD_TYPES as SETTLE_ROADS } from '../src/shared/settlement.js'
import { TERRAIN_PARAMS, WORLD as SETTLE_WORLD } from '../src/shared/terrainGen.js'
import { suggestEvent, applyText } from '../src/shared/settlementEvents.js'
import { URGENCY, QUEST_TAGS, EARLY_DEFAULT, earlyChance, nextRollAt } from '../src/shared/quests.js'
import { isFogged, anomalyState, partyPosition, journeyState, subPath, polyLength } from '../src/shared/geo.js'
import {
  CITY_TYPES, ROAD_TYPES, ZONE_EFFECTS, POINT_EFFECTS, PARTY_ICONS, HUD_LEVELS, GUILDS, RANKS, QUEST_STATUS, TASK_STATUS, QUEST_RESULT, MAX_GROUP,
  HERO_KINDS, RARITY, MAX_SIDEKICKS, ILLNESS_MAX, REL_LEVELS, REL_CELL
} from '../src/shared/catalog.js'

const PORT = Number(process.env.PORT) || 3001
// На сервере за туннелем ставим HOST=127.0.0.1, чтобы порт не был виден снаружи
const HOST = process.env.HOST || undefined
const DIST = path.resolve(import.meta.dirname, '..', 'dist')
// номер текущей сборки сайта: браузер со старой вкладкой увидит, что вышла новая версия
const BUILD_ID = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(DIST, 'build.json'), 'utf8')).build } catch { return null }
})()

loadDb()
backupDb()
if (!hasMasters()) {
  console.warn('\n⚠  Мастер ещё не создан. Выполни:  npm run set-password -- <логин> <пароль>\n')
}

/* ------------------------- Валидация входных данных ------------------------- */

const bad = msg => Object.assign(new Error(msg), { status: 400 })
const T = {
  str: (max = 200) => v => (v == null ? '' : String(v).slice(0, max)),
  num: (min = -1e9, max = 1e9) => v => {
    const n = Number(v)
    if (!Number.isFinite(n)) throw bad('Ожидалось число')
    return Math.max(min, Math.min(max, n))
  },
  numOrNull: (min, max) => v => (v === null || v === '' || v === undefined ? null : T.num(min, max)(v)),
  bool: () => v => !!v,
  oneOf: list => v => {
    if (!list.includes(v)) throw bad('Недопустимое значение: ' + v)
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

// Заказы гильдий
const int = (min, max) => v => Math.round(T.num(min, max)(v ?? 0))
T.reward = () => v => ({ exp: int(0, 1e9)(v?.exp), gold: int(0, 1e9)(v?.gold), rep: !!v?.rep, other: T.str(200)(v?.other) })
T.tasks = () => v => {
  if (!Array.isArray(v) || v.length > 20) throw new Error('некорректный список задач')
  return v.map(t => ({
    text: T.str(300)(t?.text), main: !!t?.main,
    status: Object.keys(TASK_STATUS).includes(t?.status) ? t.status : 'active'
  })).filter(t => t.text.trim())
}
T.group = () => v => {
  if (!Array.isArray(v) || v.length > MAX_GROUP) throw new Error(`в группе не больше ${MAX_GROUP} человек`)
  return v.map(m => ({
    name: T.str(40)(m?.name),
    // u:<иконка из библиотеки> или p:<игрок> — тогда берётся его аватарка
    icon: typeof m?.icon === 'string' && /^(u:[a-z0-9]{4,20}|p:u[a-f0-9]{6,20})$/.test(m.icon) ? m.icon : ''
  }))
}

T.early = () => v => ({
  enabled: !!v?.enabled, auto: !!v?.auto,
  start: T.num(0, 100)(v?.start ?? EARLY_DEFAULT.start), perDay: T.num(0, 100)(v?.perDay ?? EARLY_DEFAULT.perDay),
  max: T.num(0, 100)(v?.max ?? EARLY_DEFAULT.max),
  // история бросков ведёт сервер — из запроса берём только то, что уже было
  lastRoll: v?.lastRoll ?? null, history: Array.isArray(v?.history) ? v.history.slice(-30) : []
})
T.loc = () => v => (v ? { x: T.num(-500, 3000)(v.x), y: T.num(-500, 3000)(v.y) } : null)

// список id игроков (кому открыт скрытый объект, кто в отряде)
T.ids = () => v => (Array.isArray(v) ? [...new Set(v.filter(x => typeof x === 'string' && /^u[a-f0-9]{6,20}$/.test(x)))].slice(0, 50) : [])

// Карточки героев
T.expenses = () => v => ({ life: int(0, 10)(v?.life), housing: int(0, 10)(v?.housing), business: int(0, 10)(v?.business) })
T.relations = () => v => {
  if (!Array.isArray(v) || v.length > 30) throw new Error('некорректный список отношений')
  return v.map(r => ({
    heroId: r?.heroId ? T.str(24)(r.heroId) : null, name: T.str(60)(r?.name),
    level: int(0, REL_LEVELS)(r?.level), points: int(0, REL_CELL)(r?.points)
  })).filter(r => r.heroId || r.name.trim())
}
// какую часть портрета показывать на карточке: точка фокуса в % и приближение
T.focus = () => v => ({ x: T.num(0, 100)(v?.x ?? 50), y: T.num(0, 100)(v?.y ?? 20), zoom: T.num(1, 4)(v?.zoom ?? 1) })
const PLAYER_ID = v => (typeof v === 'string' && /^u[a-f0-9]{6,20}$/.test(v) ? v : null)

const COORD = T.num(-500, 3000)
const TEXT = T.str(20000)
const SCHEMAS = {
  states: {
    noCreate: true,
    fields: { name: T.str(80), color: T.color(), label: T.label(), description: TEXT, secret: TEXT, hidden: T.bool(), revealTo: T.ids() }
  },
  labels: {
    prefix: 'l',
    defaults: { angle: 0, size: 18, bend: 0, wrap: false, style: 'land', hidden: false },
    required: ['text', 'x', 'y'],
    fields: {
      text: T.str(120), x: COORD, y: COORD, angle: T.num(-360, 360), size: T.num(3, 200), bend: T.num(-0.05, 0.05),
      wrap: T.bool(), style: T.oneOf(['land', 'sea', 'region', 'danger']), hidden: T.bool(), revealTo: T.ids()
    }
  },
  cities: {
    prefix: 'c',
    defaults: { type: 'town', port: false, stateId: null, population: 0, description: '', secret: '', hidden: false },
    required: ['name', 'x', 'y'],
    fields: {
      name: T.str(80), x: COORD, y: COORD, type: T.oneOf(Object.keys(CITY_TYPES)), port: T.bool(),
      stateId: T.idOrNull(), population: T.num(0, 1e9), description: TEXT, secret: TEXT, hidden: T.bool(), revealTo: T.ids()
    }
  },
  roads: {
    prefix: 'r',
    defaults: { name: '', type: 'road', description: '', hidden: false },
    required: ['points'],
    fields: { name: T.str(80), type: T.oneOf(Object.keys(ROAD_TYPES)), points: T.points(), description: TEXT, hidden: T.bool(), revealTo: T.ids() }
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
      description: TEXT, secret: TEXT, hidden: T.bool(), revealTo: T.ids()
    }
  },
  parties: {
    prefix: 'p',
    defaults: { color: '#e8b04a', icon: 'sword', pace: null, route: null, description: '', secret: '', hidden: false, journey: null },
    required: ['name', 'x', 'y'],
    fields: {
      name: T.str(80), color: T.color(), icon: T.oneOf(PARTY_ICONS), x: COORD, y: COORD,
      pace: T.numOrNull(1, 5000), members: T.ids(), description: TEXT, secret: TEXT, hidden: T.bool(), revealTo: T.ids(),
      squad: v => (v?.settlementId && v?.squadId ? { settlementId: T.str(40)(v.settlementId), squadId: T.str(40)(v.squadId) } : null)
    }
  },
  routes: {
    prefix: 'w',
    defaults: { name: '', color: '#ff4a3d', kind: 'sea', stops: [], description: '', hidden: false },
    required: ['points'],
    fields: {
      name: T.str(80), color: T.color(), kind: T.oneOf(['sea', 'land']), points: T.points(), stops: T.stops(),
      description: TEXT, hidden: T.bool(), revealTo: T.ids()
    }
  },
  quests: {
    prefix: 'q',
    defaults: {
      guild: GUILDS[0].name, type: 'Охота', description: '', duration: 24,
      reward: { exp: 0, gold: 0, rep: true, other: '' }, bonus: { exp: 0, gold: 0, rep: false, other: '' },
      tasks: [], danger: 0, difficulty: 0, rank: 'bronze', group: [], status: 'available', result: null,
      report: '', tags: [], urgency: 'normal', expiresAt: null, early: EARLY_DEFAULT, loc: null, applicants: [],
      completedAt: null, closedReason: '', secret: '', hidden: false
    },
    required: ['type'],
    fields: {
      guild: T.oneOf(GUILDS.map(g => g.name)), type: T.str(40), description: TEXT, duration: T.num(0, 1e6),
      reward: T.reward(), bonus: T.reward(), tasks: T.tasks(), danger: int(0, 3), difficulty: int(0, 3),
      rank: T.oneOf(RANKS.map(r => r.key)), group: T.group(), status: T.oneOf(Object.keys(QUEST_STATUS)),
      result: v => (v === null || v === '' ? null : T.oneOf(Object.keys(QUEST_RESULT))(v)),
      report: TEXT, tags: v => (Array.isArray(v) ? v.filter(t => QUEST_TAGS[t]) : []),
      urgency: T.oneOf(Object.keys(URGENCY)), postedAt: T.num(0, 1e14), expiresAt: T.numOrNull(0, 1e14),
      early: T.early(), loc: T.loc(), closedReason: T.str(200),
      applicants: v => (Array.isArray(v) ? v.slice(0, 50).map(a => ({ id: T.str(20)(a?.id), userId: T.str(24)(a?.userId), name: T.str(40)(a?.name), note: T.str(300)(a?.note), at: Number(a?.at) || Date.now() })) : []),
      secret: TEXT, hidden: T.bool(), revealTo: T.ids()
    }
  },
  heroes: {
    prefix: 'h',
    defaults: {
      kind: 'character', gallery: [], level: 1, bm: '+2', staminaMax: 20, stamina: 20, location: '', housing: '', group: '',
      illness: 0, effectPlus: '', effectMinus: '', expenses: { life: 0, housing: 0, business: 0 }, expensesMax: 5, relations: [],
      ownerId: null, canEdit: false, status: '', rarity: 'common', masterId: null, hidden: false, order: 0
    },
    required: ['kind', 'name'],
    fields: {
      kind: T.oneOf(Object.keys(HERO_KINDS)), name: T.str(60), level: int(0, 99), bm: T.str(8),
      staminaMax: int(0, 999), stamina: int(0, 999), location: T.str(80), housing: T.str(80), group: T.str(40),
      illness: int(0, ILLNESS_MAX), effectPlus: T.str(300), effectMinus: T.str(300),
      expenses: T.expenses(), expensesMax: int(1, 10), relations: T.relations(),
      ownerId: PLAYER_ID, canEdit: T.bool(), status: T.str(60), rarity: T.oneOf(Object.keys(RARITY)),
      masterId: T.idOrNull(), hidden: T.bool(), holo: T.bool(), order: T.num(-1e6, 1e6)
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
  playerPings: T.bool(), playerCursors: T.bool(),
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

/* ------------------------- Кто зашёл ------------------------- */

// Токен → пользователь: мастер, игрок (только одобренный) или null (гость).
// viewAs = 'player' — мастер, у которого есть свой персонаж, сейчас играет им
function identify(token, viewAs) {
  const d = readToken(token)
  if (!d) return null
  if (!d.role || d.role === 'master') {
    if (!verifyToken(token)) return null
    const pr = masterProfile(d.sub)
    const ch = linkedCharacter(d.sub)
    if (viewAs === 'player' && ch) {
      return {
        role: 'player', id: ch.id, login: d.sub, name: ch.character, avatar: ch.avatar || pr.avatar,
        color: ch.color || pr.color, rank: ch.rank, asMaster: true, notifyArts: ch.notifyArts !== false
      }
    }
    return {
      role: 'master', id: 'm:' + d.sub, login: d.sub, name: pr.displayName || d.sub, avatar: pr.avatar, color: pr.color,
      playerId: ch?.id || null, character: ch?.character || null
    }
  }
  if (d.role === 'player') {
    const p = getPlayer(d.sub)
    if (!p || p.status !== 'active' || p.v !== d.v) return null
    return { role: 'player', id: p.id, login: p.login, name: p.character, avatar: p.avatar, color: p.color, rank: p.rank, notifyArts: p.notifyArts !== false }
  }
  return null
}

function userOf(req) {
  const h = req.headers.authorization || ''
  return h.startsWith('Bearer ') ? identify(h.slice(7), req.headers['x-view-as']) : null
}

/* ------------------------- Уведомления (колокольчик) ------------------------- */

// to: 'masters' — всем мастерам, или id игрока
function notify(to, kind, text, data = {}) {
  const db = getDb()
  db.notifications ||= []
  db.notifications.push({ id: newId('n'), to, kind, text, data, createdAt: Date.now(), readBy: [], resolved: false })
  // храним последние 400; нерешённые заявки не выкидываем
  if (db.notifications.length > 400) {
    const keep = db.notifications.filter(n => n.kind === 'register' && !n.resolved)
    db.notifications = [...keep, ...db.notifications.filter(n => !(n.kind === 'register' && !n.resolved)).slice(-(400 - keep.length))]
  }
}
function resolveNotifications(match) {
  for (const n of getDb().notifications || []) if (match(n)) n.resolved = true
}
function notificationsFor(user) {
  const list = (getDb().notifications || []).filter(n => (user.role === 'master' ? n.to === 'masters' : n.to === user.id))
  return list.slice(-80).map(n => ({ ...n, read: n.resolved || n.readBy.includes(user.id), readBy: undefined }))
}

const RANK_ORDER = RANKS.map(r => r.key)
function notifyNewQuest(q) {
  if (q.hidden || q.status !== 'available') return
  for (const p of allPlayers()) {
    if (p.status === 'active' && RANK_ORDER.indexOf(p.rank) >= RANK_ORDER.indexOf(q.rank)) {
      notify(p.id, 'newQuest', `Новый заказ на доске: «${q.type}» (${q.guild})`, { questId: q.id })
    }
  }
}

/* ------------------------- Что видит каждый ------------------------- */

const strip = ({ secret, revealTo, ...rest }) => rest

function roster() {
  return allPlayers().filter(p => p.status === 'active').map(p => {
    const pub = publicPlayer(p)
    if (p.linked && !pub.avatar) pub.avatar = masterProfile(p.login).avatar
    return { ...pub, linked: !!p.linked }
  })
}

function viewFor(user, now = Date.now()) {
  const db = getDb()
  const role = user?.role || 'guest'
  const uid = user?.id
  const me = user ? {
    role, id: uid, login: user.login, name: user.name, avatar: user.avatar, color: user.color, rank: user.rank,
    // мастер с персонажем может переключаться «мастер ⇄ персонаж»
    canPlay: !!(user.playerId || user.asMaster), asMaster: !!user.asMaster, character: user.character || null,
    notifyArts: user.notifyArts !== false, owner: role === 'master' && isOwner(user.login)
  } : null
  // заметки: свои + общие для отряда, в котором состоит игрок
  const mates = new Set(db.parties.filter(p => uid && p.members?.includes(uid)).flatMap(p => p.members))
  const notes = (db.notes || []).filter(n => n.ownerId === uid || (n.share === 'group' && mates.has(n.ownerId)))
  if (role === 'master') {
    const { notifications, notes: _n, questsSeeded, heroesSeeded, settlementsSeeded, ...rest } = db
    return {
      ...rest, role, me, serverTime: now, notes, roster: roster(), arts: allArts(),
      notifications: notificationsFor(user),
      players: allPlayers().map(p => ({ ...publicPlayer(p), login: p.login, status: p.status, createdAt: p.createdAt, linked: !!p.linked }))
    }
  }
  const fogOn = db.settings.fogEnabled
  const fog = fogOn ? db.fog : []
  // секрет, открытый лично этому игроку, виден даже скрытым и под туманом
  const mine = o => !!uid && o.revealTo?.includes(uid)
  const vis = o => !o.hidden || mine(o)
  const fogged = (o, x, y) => fogOn && !mine(o) && isFogged([x, y], fog)
  const pub = o => ({ ...strip(o), ...(o.hidden && mine(o) ? { onlyYou: true } : {}) })
  return {
    role, me, serverTime: now,
    settings: db.settings,
    states: db.states.filter(s => vis(s) && !(s.pole && fogged(s, s.pole[0], s.pole[1]))).map(pub),
    cities: db.cities.filter(c => vis(c) && !fogged(c, c.x, c.y)).map(pub),
    roads: db.roads.filter(vis).map(pub),
    anomalies: db.anomalies
      .filter(a => {
        if (!vis(a)) return false
        const st = anomalyState(a, now)
        return st.active && !fogged(a, st.x, st.y)
      })
      .map(pub),
    parties: db.parties.filter(vis).map(pub),
    labels: db.labels.filter(l => vis(l) && !fogged(l, l.x, l.y)).map(pub),
    routes: db.routes.filter(vis).map(r => ({ ...pub(r), stops: r.stops.filter(st => !st.hidden) })),
    icons: db.icons,
    quests: db.quests.filter(vis).map(({ secret, early, expiresAt, applicants, revealTo, ...q }) => ({
      ...q, applicantsCount: applicants?.length || 0, applied: !!uid && !!applicants?.some(a => a.userId === uid),
      ...(q.hidden ? { onlyYou: true } : {})
    })),
    guildRep: db.guildRep || {},
    // карточка «в тени» видна только мастеру и её владельцу
    heroes: db.heroes.filter(h => !h.hidden || (uid && h.ownerId === uid)).map(h => ({ ...h, ...(h.hidden ? { onlyYou: true } : {}) })),
    arts: allArts(),
    // поселения видят все; решать могут только выбранные мастером игроки (deciders); заготовки событий — только мастеру
    settlements: (db.settlements || []).map(({ suggestions, ...s }) => (s.army?.squads
      ? { ...s, army: { ...s.army, squads: s.army.squads.map(q => (q.taskSecret ? { ...q, task: '' } : q)) } }
      : s)),
    hud: db.hud?.visible ? db.hud : null,
    roster: roster(),
    notes,
    notifications: user ? notificationsFor(user) : [],
    fog
  }
}

/* ------------------------- WebSocket ------------------------- */

const clients = new Set() // { ws, user, role }
let lastGuestView = ''

const guestViewString = now => {
  const { serverTime, ...rest } = viewFor(null, now)
  return JSON.stringify(rest)
}

function send(client, view) {
  if (client.ws.readyState === 1) client.ws.send(JSON.stringify({ type: 'state', state: view }))
}

// Профиль мог измениться (аватарка, имя, цвет) или аккаунт удалён — перечитываем перед рассылкой,
// иначе подключение отдаёт копию, запомненную при входе
function refreshClient(c) {
  if (!c.token) return
  const user = identify(c.token, c.viewAs)
  if (!user) {
    if (c.user) {
      c.ws.readyState === 1 && c.ws.send(JSON.stringify({ type: 'authFailed' }))
      c.cursor = c.ruler = null
      relay(c, { type: 'gone' })
    }
    c.token = null
  }
  c.user = user
  c.role = user?.role || 'guest'
  c.name = user?.name || 'Гость'
  if (user?.color) c.color = user.color
}

// у каждого свой вид (секреты, заметки, колокольчик), гостям — один общий
function broadcast() {
  const now = Date.now()
  const guest = viewFor(null, now)
  lastGuestView = guestViewString(now)
  for (const c of clients) {
    refreshClient(c)
    send(c, c.user ? viewFor(c.user, now) : guest)
  }
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
      if (j.done && (p.journey.endAt - p.journey.startAt) > 60000) notify('masters', 'arrived', `Отряд «${p.name}» добрался до цели${p.journey.label ? ': ' + p.journey.label : ''}`, { partyId: p.id })
      p.journey = null
      changed = true
      if (p.squad && squadCameHome(p)) db.parties = db.parties.filter(x => x !== p)
    }
  }
  if (changed) {
    saveDb()
    broadcast()
    return
  }
  if (guestViewString(now) !== lastGuestView) broadcast()
}, 5000)

// отряд поселения дошёл до своего города — снова «дома», с карты мира уходит
function squadCameHome(p) {
  const db = getDb()
  const st = (db.settlements || []).find(x => x.id === p.squad.settlementId)
  const q = st?.army?.squads?.find(x => x.id === p.squad.squadId)
  const city = st && db.cities.find(c => c.id === st.cityId)
  if (!q || !city || Math.hypot(p.x - city.x, p.y - city.y) > 3) return false
  q.status = 'home'
  q.partyId = null
  notify('masters', 'arrived', `${st.name}: отряд «${q.name}» вернулся домой`, settleLink(st, 'squads'))
  logEntry(st, 'army', `Отряд «${q.name}» вернулся домой`)
  return true
}

setInterval(backupDb, 6 * 3600 * 1000)

/* ------------------------- HTTP API ------------------------- */

const app = express()
app.disable('x-powered-by')
app.set('trust proxy', 'loopback')
app.use(express.json({ limit: '5mb' }))

function requireMaster(req, res, next) {
  const u = userOf(req)
  if (u?.role !== 'master') return res.status(401).json({ error: 'Нужно войти как мастер' })
  req.user = u
  next()
}
function requireUser(req, res, next) {
  const u = userOf(req)
  if (!u) return res.status(401).json({ error: 'Нужно войти' })
  req.user = u
  next()
}

app.post('/api/login', (req, res) => {
  const ip = req.ip
  if (!hasMasters()) return res.status(503).json({ error: 'Мастер ещё не настроен на сервере (npm run set-password)' })
  if (!loginAllowed(ip)) return res.status(429).json({ error: 'Слишком много попыток. Подожди 10 минут.' })
  const { login, password } = req.body || {}
  if (checkCredentials(login, password)) return res.json({ token: issueToken(login), role: 'master' })
  const p = checkPlayer(login, password)
  if (!p) {
    recordFailure(ip)
    return res.status(401).json({ error: 'Неверный логин или пароль' })
  }
  if (p.status === 'pending') return res.status(403).json({ error: 'Твоя заявка ещё у мастера — подожди, пока её рассмотрят' })
  if (p.status !== 'active') return res.status(403).json({ error: 'Заявка отклонена мастером' })
  res.json({ token: signToken({ sub: p.id, role: 'player', v: p.v }), role: 'player' })
})

// Заявка на аккаунт игрока: ждёт одобрения мастера
const regHits = new Map()
app.post('/api/register', (req, res) => {
  const now = Date.now()
  const hits = (regHits.get(req.ip) || []).filter(t => now - t < 3600 * 1000)
  if (hits.length >= 5) return res.status(429).json({ error: 'Слишком много заявок с этого адреса. Попробуй через час.' })
  const b = req.body || {}
  if (b.password !== b.password2) return res.status(400).json({ error: 'Пароли не совпадают' })
  try {
    const p = register({ login: String(b.login || '').trim(), password: b.password, character: b.character, race: b.race })
    if (b.avatar) updatePlayer(p.id, { avatar: saveAvatar(b.avatar) })
    regHits.set(req.ip, [...hits, now])
    notify('masters', 'register', `Заявка игрока: ${p.character}${p.race ? ' (' + p.race + ')' : ''} — логин ${p.login}`, { playerId: p.id })
    saveDb()
    broadcast()
    // квитанция — по ней страница «ждите» узнает, что заявку одобрили
    res.json({ ok: true, ticket: issueTicket(p.id) })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

app.get('/api/register/status/:ticket', (req, res) => {
  const st = ticketStatus(req.params.ticket)
  if (!st) return res.status(404).json({ error: 'Заявка не найдена' })
  res.json(st)
})

// Персонаж мастера (только в режиме мастера)
app.post('/api/me/character', requireMaster, (req, res) => {
  try {
    const ch = upsertLinkedCharacter(req.user.login, { character: req.body?.character, race: req.body?.race })
    broadcast()
    res.json({ ok: true, id: ch.id })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

app.get('/api/state', (req, res) => res.json(viewFor(userOf(req))))
app.get('/api/me', requireUser, (req, res) => {
  const u = req.user
  if (u.role === 'master') return res.json({ role: 'master', login: u.login, owner: isOwner(u.login), ...masterProfile(u.login) })
  const p = getPlayer(u.id)
  res.json({ role: 'player', login: p.login, ...publicPlayer(p) })
})

/* ---------- Профиль ---------- */
app.patch('/api/me', requireUser, (req, res) => {
  const u = req.user, b = req.body || {}
  if (b.newPassword && u.asMaster) return res.status(400).json({ error: 'Пароль меняется в режиме мастера' })
  if (b.newPassword) {
    if (String(b.newPassword).length < 6) return res.status(400).json({ error: 'Новый пароль — минимум 6 символов' })
    const ok = u.role === 'master'
      ? changeMasterPassword(u.login, String(b.oldPassword || ''), String(b.newPassword))
      : (checkPlayer(u.login, b.oldPassword) && (setPlayerPassword(u.id, String(b.newPassword)), true))
    if (!ok) return res.status(400).json({ error: 'Старый пароль неверный' })
  }
  try {
    const color = b.color && /^#[0-9a-f]{6}$/i.test(b.color) ? b.color : undefined
    if (u.role === 'master') {
      const cur = masterProfile(u.login)
      const patch = {}
      if (b.name !== undefined) patch.displayName = T.str(40)(b.name).trim() || u.login
      if (color) patch.color = color
      if (b.avatar === null) patch.avatar = ''
      else if (b.avatar) patch.avatar = saveAvatar(b.avatar, cur.avatar)
      updateMasterProfile(u.login, patch)
    } else {
      const cur = getPlayer(u.id)
      const patch = {}
      if (b.name !== undefined) patch.character = T.str(40)(b.name).trim() || cur.character
      if (b.race !== undefined) patch.race = T.str(40)(b.race).trim()
      if (color) patch.color = color
      if (b.notifyArts !== undefined) patch.notifyArts = !!b.notifyArts
      if (b.avatar === null) patch.avatar = ''
      else if (b.avatar) patch.avatar = saveAvatar(b.avatar, cur.avatar)
      updatePlayer(u.id, patch)
    }
  } catch (e) {
    return res.status(400).json({ error: e.message })
  }
  broadcast()
  // после смены пароля старый токен недействителен — выдаём новый
  if (b.newPassword) {
    const token = u.role === 'master' ? issueToken(u.login) : signToken({ sub: u.id, role: 'player', v: getPlayer(u.id).v })
    return res.json({ ok: true, token })
  }
  res.json({ ok: true })
})

/* ---------- Мастера (заводит и убирает только владелец сайта) ---------- */
function requireOwner(req, res, next) {
  if (req.user?.role !== 'master' || !isOwner(req.user.login)) return res.status(403).json({ error: 'Мастерами управляет только владелец сайта' })
  next()
}
app.get('/api/masters', requireMaster, requireOwner, (req, res) => {
  res.json(listMasters().map(login => ({ login, owner: isOwner(login), name: masterProfile(login).displayName, avatar: masterProfile(login).avatar })))
})
app.post('/api/masters', requireMaster, requireOwner, (req, res) => {
  const login = String(req.body?.login || '').trim(), password = String(req.body?.password || '')
  if (!LOGIN_RE.test(login)) return res.status(400).json({ error: 'Логин: 3–32 символа — буквы, цифры, _ . -' })
  if (password.length < 6) return res.status(400).json({ error: 'Пароль — минимум 6 символов' })
  if (isMasterLogin(login)) return res.status(409).json({ error: 'Такой мастер уже есть — смени ему пароль' })
  if (findByLogin(login)) return res.status(409).json({ error: 'Этот логин уже занят игроком' })
  setMasterPassword(login, password)
  res.json({ ok: true })
})
app.post('/api/masters/:login/password', requireMaster, requireOwner, (req, res) => {
  const login = req.params.login, password = String(req.body?.password || '')
  if (!isMasterLogin(login)) return res.status(404).json({ error: 'Мастер не найден' })
  if (login === req.user.login) return res.status(400).json({ error: 'Свой пароль меняй в «Пароль и настройки»' })
  if (password.length < 6) return res.status(400).json({ error: 'Пароль — минимум 6 символов' })
  setMasterPassword(login, password)
  res.json({ ok: true })
})
app.delete('/api/masters/:login', requireMaster, requireOwner, (req, res) => {
  const login = req.params.login
  if (login === req.user.login || isOwner(login)) return res.status(400).json({ error: 'Себя удалить нельзя' })
  if (!removeMaster(login)) return res.status(404).json({ error: 'Мастер не найден' })
  res.json({ ok: true })
})

/* ---------- Игроки (мастер) ---------- */
app.post('/api/players/:id/:action(approve|reject)', requireMaster, (req, res) => {
  const p = getPlayer(req.params.id)
  if (!p) return res.status(404).json({ error: 'Игрок не найден' })
  const approve = req.params.action === 'approve'
  updatePlayer(p.id, { status: approve ? 'active' : 'rejected' })
  resolveNotifications(n => n.kind === 'register' && n.data.playerId === p.id)
  if (approve) notify(p.id, 'welcome', `Добро пожаловать в Анкарию, ${p.character}! Мастер одобрил твою заявку.`)
  saveDb()
  broadcast()
  res.json({ ok: true })
})
app.patch('/api/players/:id', requireMaster, (req, res) => {
  const p = getPlayer(req.params.id)
  if (!p) return res.status(404).json({ error: 'Игрок не найден' })
  const patch = {}
  if (req.body?.rank) patch.rank = T.oneOf(RANK_ORDER)(req.body.rank)
  if (req.body?.status) patch.status = T.oneOf(['active', 'rejected', 'pending'])(req.body.status)
  updatePlayer(p.id, patch)
  broadcast()
  res.json({ ok: true })
})
app.delete('/api/players/:id', requireMaster, (req, res) => {
  if (!removePlayer(req.params.id)) return res.status(404).json({ error: 'Игрок не найден' })
  resolveNotifications(n => n.kind === 'register' && n.data.playerId === req.params.id)
  saveDb()
  broadcast()
  res.json({ ok: true })
})

/* ---------- Колокольчик ---------- */
app.post('/api/notifications/read', requireUser, (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : null
  for (const n of notificationsForRaw(req.user)) if (!ids || ids.includes(n.id)) if (!n.readBy.includes(req.user.id)) n.readBy.push(req.user.id)
  saveDb()
  broadcast()
  res.json({ ok: true })
})
function notificationsForRaw(user) {
  return (getDb().notifications || []).filter(n => (user.role === 'master' ? n.to === 'masters' : n.to === user.id))
}

/* ---------- Личные заметки на карте ---------- */
const NOTE = { text: T.str(500), x: COORD, y: COORD, color: T.color(), share: T.oneOf(['self', 'group']) }
app.post('/api/notes', requireUser, (req, res) => {
  const db = getDb()
  db.notes ||= []
  if (db.notes.filter(n => n.ownerId === req.user.id).length >= 300) return res.status(400).json({ error: 'Слишком много заметок' })
  const data = sanitize(NOTE, req.body || {}, false)
  const note = { id: newId('n'), color: '#ffd166', share: 'self', text: '', ...data, ownerId: req.user.id, ownerName: req.user.name, createdAt: Date.now() }
  db.notes.push(note)
  saveDb()
  broadcast()
  res.json(note)
})
app.patch('/api/notes/:id', requireUser, (req, res) => {
  const note = (getDb().notes || []).find(n => n.id === req.params.id && n.ownerId === req.user.id)
  if (!note) return res.status(404).json({ error: 'Заметка не найдена' })
  Object.assign(note, sanitize(NOTE, req.body || {}, true))
  saveDb()
  broadcast()
  res.json(note)
})
app.delete('/api/notes/:id', requireUser, (req, res) => {
  const db = getDb()
  const i = (db.notes || []).findIndex(n => n.id === req.params.id && n.ownerId === req.user.id)
  if (i === -1) return res.status(404).json({ error: 'Заметка не найдена' })
  db.notes.splice(i, 1)
  saveDb()
  broadcast()
  res.json({ ok: true })
})

app.use('/avatars', express.static(AVATAR_DIR, {
  maxAge: '30d', immutable: true, index: false,
  setHeaders: r => r.setHeader('X-Content-Type-Options', 'nosniff')
}))

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
  const stops = (Array.isArray(body.stops) ? body.stops : []).slice(0, 30).map(st => ({ x: COORD(st?.x), y: COORD(st?.y), name: T.str(60)(st?.name), s: T.num(0, 1)(st?.s) }))
  p.journey = { path: pathPts, startAt, endAt, label: T.str(120)(body.label), stops, createdAt: Date.now() }
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

/* ---------- Герои Анкарии: карточки персонажей, сайд-киков, компаньонов ---------- */
// владелец с правом правки меняет всё, кроме служебного
const HERO_OWNER_LOCKED = ['kind', 'ownerId', 'canEdit', 'hidden', 'holo', 'order', 'masterId', 'rarity', 'status']
const findHero = id => getDb().heroes.find(h => h.id === id)
const canEditHero = (u, h) => u?.role === 'master' || (!!u && h.kind === 'character' && h.ownerId === u.id && h.canEdit)

function heroOwnerChanged(h, before) {
  if (h.ownerId && h.ownerId !== before) notify(h.ownerId, 'hero', `Мастер отметил карточку «${h.name}» как твоего персонажа`, { heroId: h.id })
}

app.post('/api/heroes', requireMaster, (req, res) => {
  const data = sanitize(SCHEMAS.heroes.fields, req.body || {}, false)
  if (!data.name?.trim()) return res.status(400).json({ error: 'Напиши имя' })
  const db = getDb()
  const kind = data.kind || 'character'
  if (kind === 'sidekick' && db.heroes.filter(h => h.kind === 'sidekick').length >= MAX_SIDEKICKS) return res.status(400).json({ error: `Сайд-киков не больше ${MAX_SIDEKICKS}` })
  if (kind !== 'character') Object.assign(data, { ownerId: null, canEdit: false })
  const order = Math.max(0, ...db.heroes.filter(h => h.kind === kind).map(h => h.order || 0)) + 1
  const h = { id: newId('h'), ...JSON.parse(JSON.stringify(SCHEMAS.heroes.defaults)), order, ...data, createdAt: Date.now() }
  db.heroes.push(h)
  heroOwnerChanged(h, null)
  saveDb()
  broadcast()
  res.json(h)
})

app.patch('/api/heroes/:id', requireUser, (req, res) => {
  const h = findHero(req.params.id)
  if (!h || (h.hidden && req.user.role !== 'master' && h.ownerId !== req.user.id)) return res.status(404).json({ error: 'Карточка не найдена' })
  if (!canEditHero(req.user, h)) return res.status(403).json({ error: 'Эту карточку меняет только мастер' })
  const master = req.user.role === 'master'
  const patch = sanitize(SCHEMAS.heroes.fields, req.body || {}, true)
  if (!master) for (const k of HERO_OWNER_LOCKED) delete patch[k]
  if (patch.name !== undefined && !patch.name.trim()) delete patch.name
  const kind = patch.kind || h.kind
  if (kind === 'sidekick' && h.kind !== 'sidekick' && getDb().heroes.filter(x => x.kind === 'sidekick').length >= MAX_SIDEKICKS) return res.status(400).json({ error: `Сайд-киков не больше ${MAX_SIDEKICKS}` })
  if (kind !== 'character') Object.assign(patch, { ownerId: null, canEdit: false })
  const before = h.ownerId
  Object.assign(h, patch)
  if (Array.isArray(req.body?.gallery)) arrangeGallery(h, req.body.gallery)
  if (master) heroOwnerChanged(h, before)
  else notify('masters', 'heroEdit', `${req.user.name} обновляет свою карточку «${h.name}»`, { heroId: h.id })
  saveDb()
  broadcast()
  res.json(h)
})

function dropPortrait(file) {
  if (file) try { fs.unlinkSync(path.join(PORTRAIT_DIR, path.basename(file))) } catch { /* нет файла */ }
}
const dropArt = g => { dropPortrait(g.file); dropPortrait(g.thumb) }

// [{ id, pos }] от клиента: новый порядок (первый — обложка) и область показа; чужие id игнорируем
function arrangeGallery(h, list) {
  const byId = new Map((h.gallery || []).map(g => [g.id, g]))
  const ordered = []
  for (const it of list.slice(0, 50)) {
    const g = byId.get(it?.id)
    if (!g) continue
    byId.delete(g.id)
    if (it.pos) g.pos = T.focus()(it.pos)
    ordered.push(g)
  }
  h.gallery = [...ordered, ...byId.values()]
}

app.delete('/api/heroes/:id', requireMaster, (req, res) => {
  const db = getDb()
  const h = findHero(req.params.id)
  if (!h) return res.status(404).json({ error: 'Карточка не найдена' })
  db.heroes = db.heroes.filter(x => x !== h)
  for (const g of h.gallery || []) dropArt(g)
  // ссылки на удалённую карточку: отношения остаются по имени, хозяин компаньона сбрасывается
  for (const x of db.heroes) {
    for (const r of x.relations || []) if (r.heroId === h.id) { r.heroId = null; r.name ||= h.name }
    if (x.masterId === h.id) x.masterId = null
  }
  saveDb()
  broadcast()
  res.json({ ok: true })
})

// Арты карточки: первый — обложка. У каждого два файла: целиком (смотреть на весь экран)
// и лёгкий для карточки (грузится вторым запросом). Картинку уже уменьшил браузер, тип проверяем по содержимому
const imageExt = buf => (Buffer.isBuffer(buf) && buf.length ? Object.keys(IMAGE_TYPES).find(k => IMAGE_TYPES[k](buf)) : null)
const HERO_ARTS_MAX = 24
function heroForArt(req, res) {
  const h = findHero(req.params.id)
  if (!h) return void res.status(404).json({ error: 'Карточка не найдена' })
  if (!canEditHero(req.user, h)) return void res.status(403).json({ error: 'Эту карточку меняет только мастер' })
  h.gallery ||= []
  return h
}
function saveHeroFile(h, buf, suffix) {
  const ext = imageExt(buf)
  if (!ext) return null
  fs.mkdirSync(PORTRAIT_DIR, { recursive: true })
  const file = `${h.id}-${newId('').slice(0, 8)}${suffix}.${ext}`
  fs.writeFileSync(path.join(PORTRAIT_DIR, file), buf)
  return file
}

app.post('/api/heroes/:id/gallery', requireUser, express.raw({ type: () => true, limit: '12mb' }), (req, res) => {
  const h = heroForArt(req, res)
  if (!h) return
  if (h.gallery.length >= HERO_ARTS_MAX) return res.status(400).json({ error: `У карточки уже ${HERO_ARTS_MAX} артов` })
  const file = saveHeroFile(h, req.body, '')
  if (!file) return res.status(400).json({ error: 'Нужна картинка PNG, JPG, GIF или WebP' })
  const g = { id: newId('g'), file, thumb: '', pos: { x: 50, y: 20, zoom: 1 } }
  h.gallery.push(g)
  saveDb()
  broadcast()
  res.json(g)
})
app.post('/api/heroes/:id/gallery/:gid/thumb', requireUser, express.raw({ type: () => true, limit: '3mb' }), (req, res) => {
  const h = heroForArt(req, res)
  if (!h) return
  const g = h.gallery.find(x => x.id === req.params.gid)
  if (!g) return res.status(404).json({ error: 'Арт не найден' })
  const file = saveHeroFile(h, req.body, '-t')
  if (!file) return res.status(400).json({ error: 'Нужна картинка' })
  dropPortrait(g.thumb)
  g.thumb = file
  saveDb()
  broadcast()
  res.json(g)
})
app.post('/api/heroes/:id/portrait', requireUser, express.raw({ type: () => true, limit: '12mb' }), (req, res) => {
  const h = heroForArt(req, res)
  if (!h) return
  const thumb = req.query.part === 'thumb'
  const file = saveHeroFile(h, req.body, thumb ? '-t' : '')
  if (!file) return res.status(400).json({ error: 'Нужна картинка PNG, JPG, GIF или WebP' })
  if (thumb && h.gallery[0]) {
    dropPortrait(h.gallery[0].thumb)
    h.gallery[0].thumb = file
  } else if (!thumb) h.gallery.unshift({ id: newId('g'), file, thumb: '', pos: { x: 50, y: 20, zoom: 1 } })
  saveDb()
  broadcast()
  res.json(h)
})

app.delete('/api/heroes/:id/gallery/:gid', requireUser, (req, res) => {
  const h = heroForArt(req, res)
  if (!h) return
  const g = h.gallery.find(x => x.id === req.params.gid)
  if (!g) return res.status(404).json({ error: 'Арт не найден' })
  h.gallery = h.gallery.filter(x => x !== g)
  dropArt(g)
  saveDb()
  broadcast()
  res.json({ ok: true })
})

const STATIC_IMG = { maxAge: '30d', immutable: true, index: false, setHeaders: r => r.setHeader('X-Content-Type-Options', 'nosniff') }
app.use('/portraits', express.static(PORTRAIT_DIR, STATIC_IMG))

/* ---------- Новые арты: не часть мира, мастер выкладывает и чистит ---------- */
app.post('/api/arts', requireMaster, express.raw({ type: () => true, limit: '40mb' }), (req, res) => {
  const ext = imageExt(req.body)
  if (!ext) return res.status(400).json({ error: 'Нужна картинка PNG, JPG, GIF или WebP' })
  const art = addArt(req.body, ext, {
    name: T.str(120)(req.query.name || ''),
    w: Math.round(T.num(1, 30000)(req.query.w || 1000)), h: Math.round(T.num(1, 30000)(req.query.h || 1000))
  })
  broadcast()
  res.json(art)
})
app.post('/api/arts/:id/thumb', requireMaster, express.raw({ type: () => true, limit: '3mb' }), (req, res) => {
  const ext = imageExt(req.body)
  if (!ext) return res.status(400).json({ error: 'Нужна картинка' })
  const art = setThumb(req.params.id, req.body, ext)
  if (!art) return res.status(404).json({ error: 'Арт не найден' })
  broadcast()
  res.json(art)
})
// после загрузки пачки — одно уведомление игрокам (кто не выключил это в профиле)
const plural = (n, one, few, many) => (n % 10 === 1 && n % 100 !== 11 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? few : many)
app.post('/api/arts/announce', requireMaster, (req, res) => {
  const n = Math.round(T.num(1, 10000)(req.body?.count || 1))
  for (const p of allPlayers()) {
    if (p.status === 'active' && p.notifyArts !== false) notify(p.id, 'arts', `Мастер выложил ${n} ${plural(n, 'новый арт', 'новых арта', 'новых артов')}`, { arts: true })
  }
  saveDb()
  broadcast()
  res.json({ ok: true })
})
app.delete('/api/arts/:id', requireMaster, (req, res) => {
  if (!removeArts([req.params.id])) return res.status(404).json({ error: 'Арт не найден' })
  broadcast()
  res.json({ ok: true })
})
app.delete('/api/arts', requireMaster, (req, res) => {
  const n = removeArts(null)
  broadcast()
  res.json({ ok: true, removed: n })
})
app.use('/arts', express.static(ARTS_DIR, STATIC_IMG))

/* ---------- Заказы гильдий ---------- */
function rollEarly(q, now = Date.now()) {
  const chance = earlyChance(q, now)
  const roll = Math.floor(Math.random() * 100) + 1
  const closed = roll <= chance
  q.early.lastRoll = now
  q.early.history = [...(q.early.history || []), { at: now, chance: Math.round(chance * 10) / 10, roll, closed }].slice(-30)
  if (closed) {
    q.status = 'closed'
    q.completedAt = now
    q.closedReason = 'Заказ выполнила другая группа'
    notify('masters', 'questClosed', `d100 = ${roll} против ${Math.round(chance)}%: заказ «${q.type}» (${q.guild}) забрала другая группа`, { questId: q.id })
  }
  return { chance, roll, closed }
}

// Отклик игрока своим персонажем; мастер принимает в группу или отклоняет
app.post('/api/quests/:id/apply', requireUser, (req, res) => {
  if (req.user.role !== 'player') return res.status(400).json({ error: 'Откликаться могут только игроки' })
  const q = getDb().quests.find(x => x.id === req.params.id && (!x.hidden || x.revealTo?.includes(req.user.id)))
  if (!q) return res.status(404).json({ error: 'Заказ не найден' })
  if (q.status !== 'available') return res.status(400).json({ error: 'На этот заказ уже не набирают' })
  q.applicants ||= []
  if (q.applicants.some(a => a.userId === req.user.id)) return res.status(400).json({ error: 'Ты уже откликнулся' })
  if (q.group.some(m => m.icon === 'p:' + req.user.id)) return res.status(400).json({ error: 'Ты уже в группе' })
  if (q.applicants.length >= 30) return res.status(400).json({ error: 'Заявок уже слишком много' })
  const a = { id: newId('a'), userId: req.user.id, name: req.user.name, note: T.str(300)(req.body?.note), at: Date.now() }
  q.applicants.push(a)
  notify('masters', 'apply', `${a.name} откликается на заказ «${q.type}» (${q.guild})${a.note ? ': ' + a.note : ''}`, { questId: q.id, applicantId: a.id })
  saveDb()
  broadcast()
  res.json({ ok: true })
})

app.post('/api/quests/:id/applicants/:aid/:action(accept|reject)', requireMaster, (req, res) => {
  const q = getDb().quests.find(x => x.id === req.params.id)
  const a = q?.applicants?.find(x => x.id === req.params.aid)
  if (!q || !a) return res.status(404).json({ error: 'Отклик не найден' })
  const accept = req.params.action === 'accept'
  if (accept && q.group.length >= MAX_GROUP) return res.status(400).json({ error: `В группе уже ${MAX_GROUP}` })
  q.applicants = q.applicants.filter(x => x.id !== a.id)
  if (accept) {
    q.group.push({ name: a.name, icon: a.userId ? 'p:' + a.userId : '' })
    if (q.status === 'available' && q.group.length >= MAX_GROUP) q.status = 'taken'
  }
  resolveNotifications(n => n.kind === 'apply' && n.data.applicantId === a.id)
  if (a.userId) notify(a.userId, accept ? 'accepted' : 'declined', accept ? `Тебя взяли в группу заказа «${q.type}» (${q.guild})!` : `Мастер отклонил твой отклик на «${q.type}»`, { questId: q.id })
  saveDb()
  broadcast()
  res.json({ ok: true })
})

app.post('/api/quests/:id/roll', requireMaster, (req, res) => {
  const q = getDb().quests.find(x => x.id === req.params.id)
  if (!q) return res.status(404).json({ error: 'Заказ не найден' })
  q.early = { ...EARLY_DEFAULT, ...q.early, enabled: true }
  const r = rollEarly(q)
  saveDb()
  broadcast()
  res.json({ ...r, quest: q })
})

// ручная поправка репутации отряда у гильдии
app.patch('/api/guild-rep', requireMaster, (req, res) => {
  const db = getDb()
  const name = T.oneOf(GUILDS.map(g => g.name))(req.body?.guild)
  db.guildRep ||= {}
  db.guildRep[name] = Math.round(T.num(-100000, 100000)(req.body?.value ?? 0))
  saveDb()
  broadcast()
  res.json(db.guildRep)
})

// раз в минуту: просроченные заказы закрываются, автоматические броски — раз в реальные сутки
setInterval(() => {
  const db = getDb()
  const now = Date.now()
  let changed = false
  for (const q of db.quests) {
    if (q.status !== 'available') continue
    if (q.expiresAt && now >= q.expiresAt) {
      Object.assign(q, { status: 'closed', completedAt: now, closedReason: 'Срок заказа истёк' })
      notify('masters', 'questClosed', `Срок заказа «${q.type}» (${q.guild}) истёк — снят с доски`, { questId: q.id })
      changed = true
    } else if (q.early?.enabled && q.early.auto && now >= nextRollAt(q)) {
      rollEarly(q, now)
      changed = true
    }
  }
  if (changed) {
    saveDb()
    broadcast()
  }
}, 60 * 1000)

/* ---------- Поселения ---------- */
// мастер правит разделы поселения целиком; ключи — только из списка, размеры — с запасом
const SETTLE_KEYS = {
  name: 'string', kind: 'string', status: 'string', cityId: 'string', headHeroId: 'string', managers: 'array', managerSlots: 'number',
  deciders: 'array', stats: 'object', stock: 'object', races: 'array', buildings: 'array', jobs: 'object', assets: 'array',
  outposts: 'array', adjust: 'array', events: 'array', terrain: 'object', explored: 'array', orders: 'array', day: 'number',
  roads: 'array', clearings: 'array', walls: 'array', army: 'object', hospital: 'array', raceIcons: 'object'
}
// дороги, вырубки, круги разведки и настройки местности — проверяем форму, лишнее отбрасываем
const coord = v => Math.round(T.num(-2000, SETTLE_WORLD + 2000)(v) * 10) / 10
const T_ROAD = r => {
  const pts = (Array.isArray(r?.points) ? r.points : []).slice(0, 600).map(p => [coord(p?.[0]), coord(p?.[1])])
  if (pts.length < 2) throw Object.assign(new Error('В дороге нужно хотя бы две точки'), { status: 400 })
  return { id: T.str(40)(r.id) || newId('r'), type: SETTLE_ROADS[r.type] ? r.type : 'dirt', points: pts, ...(r.name ? { name: T.str(80)(r.name) } : {}) }
}
// стена: ломаная, вид, сколько метров построено, фрагменты на ней
const T_WALL = w => {
  const pts = (Array.isArray(w?.points) ? w.points : []).slice(0, 400).map(p => [coord(p?.[0]), coord(p?.[1])])
  if (pts.length < 2) throw Object.assign(new Error('В стене нужно хотя бы две точки'), { status: 400 })
  const len = wallLength(pts)
  return {
    id: T.str(40)(w.id) || newId('w'), type: WALL_TYPES[w.type] ? w.type : 'palisade', points: pts,
    built: Math.round(Math.min(len, T.num(0, 1e6)(w.built ?? len)) * 10) / 10,
    ...(w.name ? { name: T.str(80)(w.name) } : {}),
    features: (Array.isArray(w.features) ? w.features : []).filter(f => WALL_FEATURES[f?.kind]).slice(0, 200).map(f => ({
      id: T.str(40)(f.id) || newId('f'), kind: f.kind, s: Math.round(Math.min(len, T.num(0, 1e6)(f.s)) * 10) / 10,
      state: f.state === 'construction' ? 'construction' : 'built', ...(f.state === 'construction' ? { progress: T.num(0, 1e6)(f.progress || 0) } : {})
    }))
  }
}
const T_CIRCLE = c => ({ x: coord(c?.x), y: coord(c?.y), r: Math.round(T.num(1, 5000)(c?.r)), ...(c?.name ? { name: T.str(60)(c.name) } : {}), ...(c?.tree ? { tree: true } : {}) })
const T_TERRAIN = v => ({
  v: 2, seed: Math.round(T.num(0, 2 ** 31 - 1)(v?.seed ?? 1917)),
  params: Object.fromEntries(Object.entries(TERRAIN_PARAMS).filter(([k]) => v?.params?.[k] != null).map(([k, d]) => [k, T.num(d.min, d.max)(v.params[k])]))
})
const findSettlement = id => (getDb().settlements || []).find(x => x.id === id)
// решать по событиям и отдавать приказы могут мастер и выбранные им игроки
const canDecide = (u, s) => u?.role === 'master' || (u?.role === 'player' && s.deciders?.includes(u.id))
const settleLink = (s, tab) => ({ settlementId: s.id, tab })
function notifyDeciders(s, text, tab = 'journal') {
  for (const id of s.deciders || []) notify(id, 'settlement', `${s.name}: ${text}`, settleLink(s, tab))
}
const T_EVENT = v => ({
  id: v.id || newId('e'), title: T.str(120)(v.title) || 'Событие', type: EVENT_TYPES[v.type] ? v.type : 'message',
  duration: (Array.isArray(v.duration) ? v.duration : []).filter(d => EVENT_DURATIONS[d]).slice(0, 3),
  deadline: v.deadline ? T.str(20)(v.deadline) : null, text: T.str(4000)(v.text), effect: T.str(300)(v.effect),
  decision: T.str(2000)(v.decision), decidedBy: v.decidedBy ? T.str(60)(v.decidedBy) : null, decidedAt: Number(v.decidedAt) || null,
  location: T.str(80)(v.location), createdAt: Number(v.createdAt) || Date.now()
})
function addEvent(s, ev, notifyThem = true) {
  const e = T_EVENT(ev)
  ;(s.events ||= []).push(e)
  if (s.events.length > 300) s.events = s.events.slice(-300)
  if (notifyThem) notifyDeciders(s, e.title)
  return e
}
// лента истории: что случилось и в какой день
function logEntry(s, kind, text) {
  ;(s.log ||= []).push({ id: newId('l'), day: s.day || 0, at: Date.now(), kind, text: String(text).slice(0, 400) })
  if (s.log.length > 600) s.log = s.log.slice(-600)
}
// снимок для графиков: запасы, население, мораль/стабильность/угрозы
function snapshot(s, delta) {
  const c = computeSettlement(s)
  const stock = Object.fromEntries(Object.entries(s.stock || {}).filter(([, v]) => v))
  ;(s.history ||= []).push({ day: s.day || 0, at: Date.now(), stock, pop: c.population, morale: c.morale, stability: c.stability, threat: c.threat, ...(delta ? { delta } : {}) })
  if (s.history.length > 400) s.history = s.history.slice(-400)
}
// списать цену постройки со склада; null — хватило, иначе текст, чего не хватает
const payFor = (s, type) => payPrice(s, BUILDINGS[type]?.price || {})
const STAT_RANGE = { morale: [0, 100], stability: [0, 100], threat: [0, 999] }
function applyEffects(s, apply) {
  s.stock ||= {}
  s.stats ||= {}
  for (const [k, v] of Object.entries(apply?.stock || {})) if (RES[k]) s.stock[k] = Math.max(0, Math.round(((s.stock[k] || 0) + T.num(-1e6, 1e6)(v)) * 10) / 10)
  for (const d of apply?.damage || []) {
    const b = (s.buildings || []).find(x => x.id === d.id)
    if (b && DAMAGE[d.level]) setDamage(s, b, worseDamage(b.damage, d.level), false)
  }
  for (const [k, v] of Object.entries(apply?.stats || {})) {
    if (!STAT_RANGE[k]) continue
    const [lo, hi] = STAT_RANGE[k]
    s.stats[k] = Math.max(lo, Math.min(hi, Math.round((s.stats[k] || 0) + T.num(-1000, 1000)(v))))
  }
}
// повреждение постройки: ремонт, если шёл, начинается заново (работы стало больше); event — написать в журнал
function setDamage(s, b, level, event = true) {
  const name = b.name || BUILDINGS[b.type]?.label || 'Постройка'
  const was = b.damage || null
  if (level && DAMAGE[level]) b.damage = level
  else delete b.damage
  if (b.damage !== was) delete b.repair
  if (b.damage && b.damage !== was) {
    logEntry(s, 'damage', `«${name}»: ${DAMAGE[b.damage].label.toLowerCase()}`)
    if (event && worseDamage(was, b.damage) === b.damage) {
      addEvent(s, { title: b.damage === 'ruined' ? 'Постройка разрушена' : 'Постройка повреждена', type: b.damage === 'ruined' || b.damage === 'major' ? 'alarm' : 'problem', duration: ['decide'],
        text: `«${name}»: ${DAMAGE[b.damage].label.toLowerCase()} — ${DAMAGE[b.damage].hint}. Чиним?`, effect: `«${name}» работает на ${Math.round(DAMAGE[b.damage].work * 100)}%`, location: s.name })
    }
  } else if (!b.damage && was) logEntry(s, 'damage', `«${name}» снова целая`)
}
// начать ремонт: цена — доля цены постройки по степени повреждения
function startRepair(s, b, pay) {
  if (!b.damage) return 'Постройка целая'
  if (b.repair) return 'Ремонт уже идёт'
  const price = repairPrice(b)
  if (pay) {
    const miss = payPrice(s, price)
    if (miss) return miss
  }
  b.repair = { progress: 0, ...(pay ? { paid: price } : {}) }
  logEntry(s, 'build', `${b.damage === 'ruined' ? 'Отстраивают' : 'Чинят'} «${b.name || BUILDINGS[b.type].label}»${pay ? ' — ' + priceText(price) : ''}`)
  return null
}
/* ---------- войско: обучение, бой, лечебница ---------- */
function startTraining(s, t) {
  s.army ||= {}
  ;(s.army.training ||= []).push({ id: newId('t'), race: t.race, count: t.count, days: TRAIN_DAYS, done: 0, ...(t.talent ? { talent: t.talent, sex: t.sex === 'female' ? 'female' : 'male' } : {}) })
}
const raceOf = (s, race) => (s.races || []).find(r => r.race === race)
// житель стал воином: «Боевые» +N; талантливый ребёнок вырос — дети −1, взрослые +1 и бонус в стек гарнизона
function finishTraining(s, t) {
  const r = raceOf(s, t.race)
  if (!r) return
  if (t.talent) {
    r.kids = Math.max(0, (r.kids || 0) - t.count)
    r[t.sex || 'male'] = (r[t.sex || 'male'] || 0) + t.count
  }
  r.combat = (r.combat || 0) + t.count
  const stack = (s.army?.garrison || []).find(sl => sl?.race === t.race)
  if (stack) {
    stack.count = (stack.count || 0) + t.count
    if (t.talent) (stack.talents ||= []).push({ id: newId('tl'), ...t.talent })
  } else if (t.talent) {
    // стека нет — талант запомним за расой, мастер поставит воина в гарнизон
    ;((s.army.pendingTalents ||= {})[t.race] ||= []).push({ id: newId('tl'), ...t.talent })
  }
}
// погибшие жители: население −N (сначала мужчины, потом женщины)
function bury(s, race, n) {
  const r = raceOf(s, race)
  if (!r) return
  for (let i = 0; i < n; i++) {
    const k = (r.male || 0) >= (r.female || 0) ? 'male' : 'female'
    if ((r[k] || 0) > 0) r[k]--
  }
}
const MAX_SUGGESTIONS = 8
function addSuggestion(s) {
  s.suggestions ||= []
  if (s.suggestions.length >= MAX_SUGGESTIONS) return null
  const ev = suggestEvent(s, Math.random, s.suggestions.map(x => x.idea))
  if (!ev) return null
  const sg = { id: newId('sg'), day: s.day || 0, createdAt: Date.now(), ...ev }
  s.suggestions.push(sg)
  return sg
}

app.patch('/api/settlements/:id', requireMaster, (req, res) => {
  const s = findSettlement(req.params.id)
  if (!s) return res.status(404).json({ error: 'Поселение не найдено' })
  const body = req.body || {}
  for (const [k, v] of Object.entries(body)) {
    const kind = SETTLE_KEYS[k]
    if (!kind) return res.status(400).json({ error: 'Неизвестное поле: ' + k })
    const ok = kind === 'array' ? Array.isArray(v) : kind === 'object' ? v && typeof v === 'object' && !Array.isArray(v) : typeof v === kind
    if (!ok && !(k === 'headHeroId' && v === null)) return res.status(400).json({ error: 'Неверный формат поля: ' + k })
  }
  if (Array.isArray(body.deciders)) body.deciders = body.deciders.filter(id => typeof id === 'string').slice(0, 20)
  if (Array.isArray(body.roads)) body.roads = body.roads.slice(0, 500).map(T_ROAD)
  if (Array.isArray(body.walls)) body.walls = body.walls.slice(0, 300).map(T_WALL)
  // повреждения: проверяем значение; стало хуже — событие в журнал главе
  const hurt = []
  if (Array.isArray(body.buildings)) {
    for (const nb of body.buildings) {
      if (nb.damage && !DAMAGE[nb.damage]) delete nb.damage
      const old = (s.buildings || []).find(x => x.id === nb.id)
      if ((old?.damage || null) !== (nb.damage || null)) { hurt.push({ nb, level: nb.damage || null, was: old?.damage }); if (old) nb.damage = old.damage; else delete nb.damage }
    }
  }
  if (Array.isArray(body.clearings)) body.clearings = body.clearings.slice(0, 8000).map(T_CIRCLE)
  if (Array.isArray(body.explored)) body.explored = body.explored.slice(0, 4000).map(e => (e?.points ? e : T_CIRCLE(e)))
  if (body.terrain) body.terrain = T_TERRAIN(body.terrain)
  // новые события из правки мастера — решающим в колокольчик
  const known = new Set((s.events || []).map(e => e.id))
  if (Array.isArray(body.events)) body.events = body.events.map(T_EVENT)
  Object.assign(s, body, { updatedAt: Date.now() })
  for (const h of hurt) setDamage(s, h.nb, h.level)
  for (const e of body.events || []) if (!known.has(e.id)) notifyDeciders(s, e.title)
  saveDb()
  broadcast()
  res.json(s)
})

// мастер пишет новое событие в журнал
app.post('/api/settlements/:id/events', requireMaster, (req, res) => {
  const s = findSettlement(req.params.id)
  if (!s) return res.status(404).json({ error: 'Поселение не найдено' })
  const e = addEvent(s, { ...(req.body || {}), id: undefined, createdAt: Date.now(), location: req.body?.location || s.name })
  logEntry(s, 'event', `Событие: «${e.title}»`)
  saveDb()
  broadcast()
  res.json(e)
})

// решение главы по событию
app.post('/api/settlements/:id/events/:eid/decision', requireUser, (req, res) => {
  const s = findSettlement(req.params.id)
  if (!s) return res.status(404).json({ error: 'Поселение не найдено' })
  if (!canDecide(req.user, s)) return res.status(403).json({ error: 'Решения здесь принимает глава поселения' })
  const e = (s.events || []).find(x => x.id === req.params.eid)
  if (!e) return res.status(404).json({ error: 'Событие не найдено' })
  e.decision = T.str(2000)(req.body?.text).trim()
  e.decidedBy = req.user.name
  e.decidedAt = Date.now()
  if (e.decision) logEntry(s, 'decision', `${req.user.name} решает «${e.title}»: ${e.decision}`)
  if (req.user.role !== 'master') notify('masters', 'settlement', `${s.name}: ${req.user.name} решает «${e.title}»`, settleLink(s, 'journal'))
  saveDb()
  broadcast()
  res.json(e)
})

// портрет актива поселения (картинку уже уменьшил браузер)
app.post('/api/settlements/:id/portrait', requireMaster, express.raw({ type: () => true, limit: '3mb' }), (req, res) => {
  if (!findSettlement(req.params.id)) return res.status(404).json({ error: 'Поселение не найдено' })
  const file = saveHeroFile({ id: 'settle-' + req.params.id }, req.body, '')
  if (!file) return res.status(400).json({ error: 'Нужна картинка PNG, JPG, GIF или WebP' })
  res.json({ url: '/portraits/' + file })
})

/* приказы главы: построить, назначить рабочих, разведать, свободный — мастер одобряет */
const ORDER_KINDS = ['build', 'workers', 'explore', 'repair', 'train', 'free']
app.post('/api/settlements/:id/orders', requireUser, (req, res) => {
  const s = findSettlement(req.params.id)
  if (!s) return res.status(404).json({ error: 'Поселение не найдено' })
  if (!canDecide(req.user, s)) return res.status(403).json({ error: 'Приказы отдаёт глава поселения' })
  const b = req.body || {}
  if (!ORDER_KINDS.includes(b.kind)) return res.status(400).json({ error: 'Неизвестный приказ' })
  const o = { id: newId('o'), kind: b.kind, text: T.str(1000)(b.text).trim(), by: req.user.id, byName: req.user.name, status: 'pending', createdAt: Date.now() }
  if (b.kind === 'build') {
    if (!BUILDINGS[b.type] || BUILDINGS[b.type].personal) return res.status(400).json({ error: 'Такую постройку не построить' })
    o.build = { type: b.type, x: Math.round(coord(b.x)), y: Math.round(coord(b.y)) }
    if (BUILDINGS[b.type].size !== 'settlement') {
      const p = placementProblems(s, { id: 'new', ...o.build })
      if (p.length) return res.status(400).json({ error: 'Сюда не поставить: ' + p.join(', ') })
    }
  } else if (b.kind === 'workers') {
    if (!JOBS[b.job]) return res.status(400).json({ error: 'Неизвестная работа' })
    o.workers = { job: b.job, count: Math.round(T.num(0, 999)(b.count)) }
  } else if (b.kind === 'explore') {
    o.explore = { x: Math.round(coord(b.x)), y: Math.round(coord(b.y)), r: 300 }
  } else if (b.kind === 'train') {
    if (!RACES[b.race] || !(s.races || []).some(r => r.race === b.race)) return res.status(400).json({ error: 'Такой расы в поселении нет' })
    o.train = { race: b.race, count: Math.max(1, Math.round(T.num(1, 100)(b.count))) }
  } else if (b.kind === 'repair') {
    const bd = (s.buildings || []).find(x => x.id === b.building)
    if (!bd?.damage) return res.status(400).json({ error: 'Эта постройка целая' })
    if (bd.repair) return res.status(400).json({ error: 'Её уже чинят' })
    if ((s.orders || []).some(x => x.status === 'pending' && x.repair?.id === bd.id)) return res.status(400).json({ error: 'Приказ на ремонт уже ждёт мастера' })
    o.repair = { id: bd.id, type: bd.type, damage: bd.damage }
  } else if (!o.text) return res.status(400).json({ error: 'Напиши, что нужно сделать' })
  ;(s.orders ||= []).push(o)
  if (s.orders.length > 200) s.orders = s.orders.slice(-200)
  if (req.user.role !== 'master') notify('masters', 'settlement', `${s.name}: новый приказ от ${req.user.name}`, settleLink(s, 'orders'))
  saveDb()
  broadcast()
  res.json(o)
})

app.delete('/api/settlements/:id/orders/:oid', requireUser, (req, res) => {
  const s = findSettlement(req.params.id)
  const o = s?.orders?.find(x => x.id === req.params.oid)
  if (!o) return res.status(404).json({ error: 'Приказ не найден' })
  if (req.user.role !== 'master' && (o.by !== req.user.id || o.status !== 'pending')) return res.status(403).json({ error: 'Отменить можно только свой приказ, пока его не рассмотрели' })
  s.orders = s.orders.filter(x => x !== o)
  saveDb()
  broadcast()
  res.json({ ok: true })
})

app.post('/api/settlements/:id/orders/:oid/:action(approve|reject)', requireMaster, (req, res) => {
  const s = findSettlement(req.params.id)
  const o = s?.orders?.find(x => x.id === req.params.oid)
  if (!o) return res.status(404).json({ error: 'Приказ не найден' })
  if (o.status !== 'pending') return res.status(400).json({ error: 'Приказ уже рассмотрен' })
  const ok = req.params.action === 'approve'
  if (ok) {
    if (o.kind === 'build') {
      const def = BUILDINGS[o.build.type]
      const b = { id: newId('b'), ...o.build, state: 'construction', progress: 0 }
      if (def.size !== 'settlement') {
        const p = placementProblems(s, b)
        if (p.length) return res.status(400).json({ error: 'Место уже занято: ' + p.join(', ') })
      }
      // оплата со склада; мастер может заложить бесплатно (free)
      const free = !!req.body?.free
      if (!free) {
        const miss = payFor(s, b.type)
        if (miss) return res.status(400).json({ error: miss })
      }
      o.paid = free ? null : def.price || {}
      ;(s.buildings ||= []).push(b)
      clearUnder(s, b)
      addEvent(s, { title: 'Стройка начата', type: 'done', duration: ['quick'], text: `По приказу главы заложили «${def.label}». Сложность ${def.cost}.${free ? '' : ` Со склада ушло: ${priceText(def.price)}.`}`, location: s.name }, false)
      logEntry(s, 'build', `Заложена «${def.label}» по приказу ${o.byName}${free ? ' (бесплатно)' : ` — ${priceText(def.price)}`}`)
    } else if (o.kind === 'train') {
      startTraining(s, { race: o.train.race, count: o.train.count })
      logEntry(s, 'army', `${RACES[o.train.race]?.label}: ${o.train.count} учатся воевать (приказ ${o.byName})`)
    } else if (o.kind === 'repair') {
      const bd = (s.buildings || []).find(x => x.id === o.repair.id)
      if (!bd) return res.status(400).json({ error: 'Постройки уже нет' })
      const free = !!req.body?.free
      const price = repairPrice(bd)
      const err = startRepair(s, bd, !free)
      if (err) return res.status(400).json({ error: err })
      o.paid = free ? null : price
    } else if (o.kind === 'workers') {
      s.jobs ||= {}
      s.jobs[o.workers.job] = { ...(s.jobs[o.workers.job] || {}), workers: o.workers.count }
      logEntry(s, 'workers', `${JOBS[o.workers.job].label}: теперь ${o.workers.count} рабочих (приказ ${o.byName})`)
    } else if (o.kind === 'explore') {
      ;(s.explored ||= []).push({ name: 'Разведка', ...o.explore })
      logEntry(s, 'explore', `Разведан новый участок по приказу ${o.byName}`)
      addEvent(s, { title: 'Земля разведана', type: 'done', duration: ['quick'], text: 'Разведчики изучили новый участок. Здесь можно строить.', location: s.name }, false)
    }
  }
  if (!ok) logEntry(s, 'order', `Отклонён приказ ${o.byName}${o.reply ? ': ' + o.reply : ''}`)
  o.status = ok ? 'approved' : 'rejected'
  o.reply = T.str(1000)(req.body?.reply).trim()
  o.decidedAt = Date.now()
  if (o.by && !String(o.by).startsWith('m:')) notify(o.by, 'settlement', `${s.name}: приказ ${ok ? 'одобрен' : 'отклонён'}${o.reply ? ' — ' + o.reply : ''}`, settleLink(s, 'orders'))
  saveDb()
  broadcast()
  res.json(o)
})

/* «Прошёл день»: запасы меняются на баланс, нехватки → события, стройка продвигается */
const BUILD_POINTS_PER_DAY = 25
app.post('/api/settlements/:id/advance', requireMaster, (req, res) => {
  const s = findSettlement(req.params.id)
  if (!s) return res.status(404).json({ error: 'Поселение не найдено' })
  const days = Math.round(T.num(1, 60)(req.body?.days ?? 1))
  if (!s.history?.length) snapshot(s) // точка отсчёта для графиков
  const c = computeSettlement(s)
  s.stock ||= {}
  const short = []
  const delta = {}
  for (const [k, bal] of Object.entries(c.balance)) {
    if (!bal && !(k in s.stock)) continue
    const was = s.stock[k] || 0
    const v = Math.round((was + bal * days) * 10) / 10
    if (v < 0) short.push(k)
    s.stock[k] = Math.max(0, v)
    const d = Math.round((s.stock[k] - was) * 10) / 10
    if (d) delta[k] = d
  }
  // стройка: слесари ускоряют, нехватка стройматериалов — −75%
  const speedUp = (c.jobs.locksmith?.workers || 0) * 8.75
  const slow = (s.stock.build || 0) <= 0 && c.balance.build < 0 ? 0.25 : 1
  const pts = BUILD_POINTS_PER_DAY * days * (1 + speedUp / 100) * slow
  const done = []
  for (const b of s.buildings || []) {
    if (b.state !== 'construction') continue
    b.progress = Math.round(((b.progress || 0) + pts) * 10) / 10
    const cost = BUILDINGS[b.type]?.cost || 100
    if (b.progress >= cost) {
      b.state = 'built'
      delete b.progress
      done.push(BUILDINGS[b.type].label)
      addEvent(s, { title: 'Строительство завершено', type: 'done', duration: ['quick'], text: `Мы закончили «${BUILDINGS[b.type].label}»!`, location: s.name })
    }
  }
  // обучение воинов: сезон (120 дней)
  for (const t of s.army?.training || []) {
    t.done = Math.min(t.days, (t.done || 0) + days)
    if (t.done >= t.days) {
      finishTraining(s, t)
      done.push(`воины: ${RACES[t.race]?.label} ×${t.count}`)
      addEvent(s, { title: 'Новые воины', type: 'done', duration: ['quick'], text: `${RACES[t.race]?.label}: ${t.count} закончили обучение${t.talent ? ' — талант: ' + (t.talent.note || 'особый дар') : ''}.`, location: s.name }, false)
    }
  }
  if (s.army?.training) s.army.training = s.army.training.filter(t => t.done < t.days)
  // ремонт: те же очки стройки; готово — постройка снова целая
  for (const b of s.buildings || []) {
    if (!b.repair || !b.damage) continue
    b.repair.progress = Math.round(((b.repair.progress || 0) + pts) * 10) / 10
    if (b.repair.progress >= repairWork(b)) {
      const name = b.name || BUILDINGS[b.type].label
      const ruined = b.damage === 'ruined'
      setDamage(s, b, null)
      done.push((ruined ? 'отстроена ' : 'починена ') + name)
      addEvent(s, { title: ruined ? 'Постройка отстроена' : 'Ремонт закончен', type: 'done', duration: ['quick'], text: `«${name}» ${ruined ? 'отстроили заново' : 'починили'} — снова работает в полную силу.`, location: s.name }, false)
    }
  }
  // стены строятся от начала к концу, фрагменты — когда стена дошла до их места
  for (const w of s.walls || []) {
    const len = wallLength(w.points)
    const t = WALL_TYPES[w.type] || WALL_TYPES.palisade
    if (!wallDone(w)) {
      w.built = Math.round(Math.min(len, (w.built || 0) + pts / t.work) * 10) / 10
      if (wallDone(w)) {
        done.push(t.label)
        addEvent(s, { title: 'Строительство завершено', type: 'done', duration: ['quick'], text: `${t.label}${w.name ? ' «' + w.name + '»' : ''} ${t.done} — ${Math.round(len)} м. Жителям спокойнее за стеной.`, location: s.name })
      }
    }
    for (const f of w.features || []) {
      if (f.state !== 'construction' || (w.built ?? len) < f.s) continue
      f.progress = Math.round(((f.progress || 0) + pts) * 10) / 10
      if (f.progress >= WALL_FEATURES[f.kind].work) {
        f.state = 'built'
        delete f.progress
        done.push(WALL_FEATURES[f.kind].label)
      }
    }
  }
  const open = new Set((s.events || []).filter(e => e.title === 'Нехватка ресурса' && !e.decision).map(e => e.effect))
  for (const k of short) {
    const effect = `Не хватает «${RES[k]?.label}»`
    if (open.has(effect)) continue
    addEvent(s, { title: 'Нехватка ресурса', type: 'problem', duration: ['decide'], text: `У нас закончились «${RES[k]?.label}». Как решим, господин глава?`, effect, location: s.name })
  }
  s.day = (s.day || 0) + days
  // лента и график
  const top = Object.entries(delta).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 6)
  logEntry(s, 'day', `Прошло ${days} дн.${top.length ? ': ' + top.map(([k, v]) => `${RES[k]?.label} ${v > 0 ? '+' : ''}${v}`).join(', ') : ''}`)
  for (const n of done) logEntry(s, 'built', `Достроена «${n}»`)
  if (short.length) logEntry(s, 'short', 'Кончились: ' + short.map(k => RES[k]?.label).join(', '))
  snapshot(s, delta)
  // заготовки событий для мастера: примерно одна на три дня, не больше восьми в очереди
  const fresh = []
  for (let i = 0; i < days; i++) if (Math.random() < 0.35) { const sg = addSuggestion(s); if (sg) fresh.push(sg) }
  s.updatedAt = Date.now()
  saveDb()
  broadcast()
  res.json({ ok: true, day: s.day, short, delta, done, suggestions: fresh.length })
})

// мастер ставит постройку на карту: сразу готовую или стройкой (стройку можно оплатить со склада)
// постройка в лесу — лес под ней вырубаем
function clearUnder(s, b) {
  const c = clearingFor(s, b)
  if (c) (s.clearings ||= []).push(c)
}
// мастер ставит постройку на карту: новую (сразу готовую или стройкой, стройку можно оплатить со склада),
// из списка «не расставлены» или передвигает уже стоящую (id)
app.post('/api/settlements/:id/buildings', requireMaster, (req, res) => {
  const s = findSettlement(req.params.id)
  if (!s) return res.status(404).json({ error: 'Поселение не найдено' })
  const b = req.body || {}
  const old = b.id ? (s.buildings || []).find(x => x.id === b.id) : null
  if (b.id && !old) return res.status(404).json({ error: 'Постройка не найдена' })
  const type = old ? old.type : b.type
  const def = BUILDINGS[type]
  if (!def) return res.status(400).json({ error: 'Нет такой постройки' })
  const whole = def.size === 'settlement'
  const x = whole ? null : Math.round(coord(b.x)), y = whole ? null : Math.round(coord(b.y))
  if (!whole) {
    const p = placementProblems(s, { id: old?.id || '_new', type, x, y })
    if (p.length) return res.status(400).json({ error: 'Сюда не поставить: ' + p.join(', ') })
  }
  if (old) {
    const first = old.x == null
    Object.assign(old, { x, y })
    if (!whole) clearUnder(s, old)
    logEntry(s, 'build', first ? `Поставлена на карту «${old.name || def.label}»` : `Передвинута «${old.name || def.label}»`)
    s.updatedAt = Date.now()
    saveDb()
    broadcast()
    return res.json(old)
  }
  const nb = { id: newId('b'), type, x, y, state: b.built ? 'built' : 'construction', ...(b.built ? {} : { progress: 0 }) }
  const pay = !b.built && !!b.pay && !def.personal
  if (pay) {
    const miss = payFor(s, type)
    if (miss) return res.status(400).json({ error: miss })
  }
  ;(s.buildings ||= []).push(nb)
  if (!whole) clearUnder(s, nb)
  logEntry(s, 'build', b.built ? `Поставлена «${def.label}»` : `Заложена «${def.label}»${pay ? ' — ' + priceText(def.price) : ''}`)
  s.updatedAt = Date.now()
  saveDb()
  broadcast()
  res.json(nb)
})

/* стены: мастер рисует линией; новая стена, начатая с конца такой же, продолжает её */
// списать цену со склада; null — хватило, иначе текст, чего не хватает
function payPrice(s, price) {
  const miss = shortFor(s.stock, price)
  if (miss.length) return 'Не хватает: ' + miss.map(m => `${RES[m.res]?.label} ${m.have} из ${m.need}`).join(', ')
  s.stock ||= {}
  for (const [k, v] of Object.entries(price)) s.stock[k] = Math.round(((s.stock[k] || 0) - v) * 10) / 10
  return null
}
app.post('/api/settlements/:id/walls', requireMaster, (req, res) => {
  const s = findSettlement(req.params.id)
  if (!s) return res.status(404).json({ error: 'Поселение не найдено' })
  const b = req.body || {}
  let w
  try { w = T_WALL({ type: b.type, points: b.points, built: b.built ? undefined : 0 }) } catch (e) { return res.status(e.status || 400).json({ error: e.message }) }
  const len = wallLength(w.points)
  if (len < 1) return res.status(400).json({ error: 'Стена слишком короткая' })
  const t = WALL_TYPES[w.type]
  const price = wallPrice(w.type, len)
  if (!b.built && b.pay) {
    const miss = payPrice(s, price)
    if (miss) return res.status(400).json({ error: miss })
  }
  s.walls ||= []
  // продолжение: новая стена начинается на конце такой же — дописываем к ней (стройка идёт от начала к концу)
  const same = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1
  const prev = s.walls.find(x => x.type === w.type && same(x.points[x.points.length - 1], w.points[0]))
  if (prev) {
    const prevLen = wallLength(prev.points)
    const wasBuilt = (prev.built ?? prevLen) >= prevLen - 0.1
    prev.points = [...prev.points, ...w.points.slice(1)]
    // стройка продолжается: если старая часть готова, новая — с её конца; готовую сразу — целиком
    prev.built = b.built && wasBuilt ? wallLength(prev.points) : Math.min(prev.built ?? prevLen, prevLen)
    w = prev
  } else s.walls.push(w)
  logEntry(s, 'build', `Стена (${t.short}): ${b.built ? 'поставлена' : 'заложена'} — ${Math.round(len)} м${!b.built && b.pay ? ' — ' + priceText(price) : ''}`)
  s.updatedAt = Date.now()
  saveDb()
  broadcast()
  res.json(w)
})
app.post('/api/settlements/:id/walls/:wid/features', requireMaster, (req, res) => {
  const s = findSettlement(req.params.id)
  const w = s?.walls?.find(x => x.id === req.params.wid)
  if (!w) return res.status(404).json({ error: 'Стена не найдена' })
  const b = req.body || {}
  const def = WALL_FEATURES[b.kind]
  if (!def) return res.status(400).json({ error: 'Нет такого фрагмента' })
  const len = wallLength(w.points)
  const at = Math.round(Math.max(def.len / 2, Math.min(len - def.len / 2, T.num(0, 1e6)(b.s))) * 10) / 10
  if (len < def.len) return res.status(400).json({ error: 'Стена короче проёма' })
  // проёмы и башни не наезжают друг на друга
  const clash = (w.features || []).find(f => Math.abs(f.s - at) < (WALL_FEATURES[f.kind].len + def.len) / 2 + 1)
  if (clash) return res.status(400).json({ error: `Слишком близко к «${WALL_FEATURES[clash.kind].label}»` })
  const price = featurePrice(b.kind, w.type)
  if (!b.built && b.pay) {
    const miss = payPrice(s, price)
    if (miss) return res.status(400).json({ error: miss })
  }
  const f = { id: newId('f'), kind: b.kind, s: at, state: b.built ? 'built' : 'construction', ...(b.built ? {} : { progress: 0 }) }
  ;(w.features ||= []).push(f)
  w.features.sort((x, y) => x.s - y.s)
  logEntry(s, 'build', `На стене: ${def.label.toLowerCase()} — ${b.built ? 'готово' : 'заложено'}${!b.built && b.pay ? ' — ' + priceText(price) : ''}`)
  s.updatedAt = Date.now()
  saveDb()
  broadcast()
  res.json(f)
})

app.post('/api/settlements/:id/buildings/:bid/repair', requireMaster, (req, res) => {
  const s = findSettlement(req.params.id)
  const b = s?.buildings?.find(x => x.id === req.params.bid)
  if (!b) return res.status(404).json({ error: 'Постройка не найдена' })
  if (req.body?.instant) setDamage(s, b, null)
  else {
    const err = startRepair(s, b, !!req.body?.pay)
    if (err) return res.status(400).json({ error: err })
  }
  s.updatedAt = Date.now()
  saveDb()
  broadcast()
  res.json(b)
})

app.post('/api/settlements/:id/squads/:qid/deploy', requireMaster, (req, res) => {
  const s = findSettlement(req.params.id)
  const q = s?.army?.squads?.find(x => x.id === req.params.qid)
  if (!q) return res.status(404).json({ error: 'Отряд не найден' })
  if (!q.commander) return res.status(400).json({ error: 'Без командира отряд не выйдет' })
  const db = getDb()
  let p = q.partyId && db.parties.find(x => x.id === q.partyId)
  if (!p) {
    const city = db.cities.find(c => c.id === s.cityId)
    if (!city) return res.status(400).json({ error: 'Поселение не привязано к городу на карте мира' })
    const cargo = cargoOf(q).some(c => c && c.kind !== 'other')
    p = {
      id: newId('p'), name: q.name || 'Отряд', color: q.color || '#e6c27a', icon: cargo ? 'horse' : 'flag', x: city.x, y: city.y,
      pace: null, members: [], description: `Отряд поселения «${s.name}»`, secret: '', hidden: false, journey: null, route: null,
      squad: { settlementId: s.id, squadId: q.id }, createdAt: Date.now()
    }
    db.parties.push(p)
    q.partyId = p.id
    logEntry(s, 'army', `Отряд «${q.name}» выходит из ${city.name}`)
  }
  q.status = 'out'
  saveDb()
  broadcast()
  res.json(p)
})

// итог боя: потери снимаются со стеков, половина павших — раненые в лечебницу, остальные погибли
app.post('/api/settlements/:id/battle', requireMaster, (req, res) => {
  const s = findSettlement(req.params.id)
  if (!s) return res.status(404).json({ error: 'Поселение не найдено' })
  const b = req.body || {}
  const army = s.army ||= {}
  const squad = b.side === 'garrison' ? null : (army.squads || []).find(q => q.id === b.side)
  if (b.side !== 'garrison' && !squad) return res.status(404).json({ error: 'Отряд не найден' })
  const foe = T.str(80)(b.foe) || 'враг'
  const slotAt = ref => (squad ? (ref.line === 'cmd' ? squad.commander : squad.lines?.[ref.line]?.[ref.i]) : army.garrison?.[ref.i])
  let dead = 0, wounded = 0
  const lines = []
  for (const u of Array.isArray(b.units) ? b.units.slice(0, 40) : []) {
    const fallen = Math.round(T.num(0, 10000)(u.fallen))
    const sl = slotAt(u.ref || {})
    if (!fallen || !sl) continue
    if (sl.race) {
      const f = Math.min(fallen, sl.count || 0)
      const sp = splitFallen({ kind: 'race', fallen: f })
      sl.count -= f
      if (sl.talents?.length > sl.count) sl.talents = sl.talents.slice(0, sl.count)
      const r = raceOf(s, sl.race)
      if (r) { r.combat = Math.max(0, (r.combat || 0) - f); r.wounded = (r.wounded || 0) + sp.wounded }
      bury(s, sl.race, sp.dead)
      if (sp.wounded) (s.hospital ||= []).push({ id: newId('p'), who: { race: sl.race }, count: sp.wounded, combat: true, disease: `Ранены в бою: ${foe}`, treatment: '', progress: 50, day: s.day || 0 })
      dead += sp.dead; wounded += sp.wounded
      lines.push(`${RACES[sl.race]?.label}: погибло ${sp.dead}, ранено ${sp.wounded}`)
    } else {
      const who = sl.asset ? { asset: sl.asset } : { hero: sl.hero }
      const name = sl.asset ? s.assets?.find(a => a.id === sl.asset)?.name : store_heroName(sl.hero)
      ;(s.hospital ||= []).push({ id: newId('p'), who, count: 1, disease: `Ранен в бою: ${foe}`, treatment: '', progress: 50, day: s.day || 0 })
      wounded++
      lines.push(`${name || 'Командир'}: ранен`)
    }
  }
  if (squad) for (const l of Object.keys(LINES)) squad.lines[l] = (squad.lines[l] || []).map(sl => (sl?.race && !sl.count ? null : sl))
  else army.garrison = (army.garrison || []).map(sl => (sl?.race && !sl.count ? null : sl))
  const win = b.result === 'win'
  addEvent(s, {
    title: `${win ? 'Победа' : b.result === 'loss' ? 'Поражение' : 'Бой'}: ${foe}`, type: win ? 'done' : 'alarm', duration: ['quick'],
    text: `${squad ? `Отряд «${squad.name || 'без имени'}»` : 'Гарнизон'} сражался с противником «${foe}»${b.rounds ? ` — ${b.rounds} раунд(ов)` : ''}. ${lines.join('; ') || 'Без потерь.'}`,
    effect: `Погибло ${dead}, ранено ${wounded} — раненые в лечебнице`, location: s.name
  })
  logEntry(s, 'army', `Бой с «${foe}»: ${win ? 'победа' : b.result === 'loss' ? 'поражение' : 'ничья'}, погибло ${dead}, ранено ${wounded}`)
  s.updatedAt = Date.now()
  saveDb()
  broadcast()
  res.json({ dead, wounded })
})
const store_heroName = id => getDb().heroes.find(h => h.id === id)?.name

// лечебница: положить (мастер), выбрать лечение (глава или мастер), выписать или «не вылечили» (мастер)
app.post('/api/settlements/:id/hospital', requireMaster, (req, res) => {
  const s = findSettlement(req.params.id)
  if (!s) return res.status(404).json({ error: 'Поселение не найдено' })
  const b = req.body || {}
  const who = b.who?.race && RACES[b.who.race] ? { race: b.who.race } : b.who?.asset ? { asset: T.str(40)(b.who.asset) } : b.who?.hero ? { hero: T.str(40)(b.who.hero) } : { name: T.str(80)(b.who?.name) || 'Житель' }
  const count = who.race ? Math.max(1, Math.round(T.num(1, 500)(b.count || 1))) : 1
  const p = { id: newId('p'), who, count, disease: T.str(300)(b.disease), treatment: '', progress: 50, day: s.day || 0 }
  ;(s.hospital ||= []).push(p)
  if (who.race) { const r = raceOf(s, who.race); if (r) r.wounded = (r.wounded || 0) + count }
  logEntry(s, 'heal', `В лечебницу: ${who.race ? RACES[who.race].label + ' ×' + count : who.name || 'пациент'} — ${p.disease || 'болезнь'}`)
  saveDb()
  broadcast()
  res.json(p)
})
app.post('/api/settlements/:id/hospital/:pid/treatment', requireUser, (req, res) => {
  const s = findSettlement(req.params.id)
  const p = s?.hospital?.find(x => x.id === req.params.pid)
  if (!p) return res.status(404).json({ error: 'Пациент не найден' })
  if (!canDecide(req.user, s)) return res.status(403).json({ error: 'Лечение выбирает глава поселения' })
  p.treatment = T.str(300)(req.body?.treatment).trim()
  p.treatmentBy = req.user.name
  if (req.user.role !== 'master') notify('masters', 'settlement', `${s.name}: ${req.user.name} выбрал лечение — ${p.treatment}`, settleLink(s, 'hospital'))
  saveDb()
  broadcast()
  res.json(p)
})
app.post('/api/settlements/:id/hospital/:pid/:outcome(healed|dead)', requireMaster, (req, res) => {
  const s = findSettlement(req.params.id)
  const p = s?.hospital?.find(x => x.id === req.params.pid)
  if (!p) return res.status(404).json({ error: 'Пациент не найден' })
  const healed = req.params.outcome === 'healed'
  const r = p.who.race ? raceOf(s, p.who.race) : null
  const name = p.who.race ? `${RACES[p.who.race]?.label} ×${p.count}` : p.who.asset ? s.assets?.find(a => a.id === p.who.asset)?.name : p.who.hero ? store_heroName(p.who.hero) : p.who.name
  if (r) {
    r.wounded = Math.max(0, (r.wounded || 0) - p.count)
    if (healed && p.combat) r.combat = (r.combat || 0) + p.count // раненые воины возвращаются в «Боевые»
    if (!healed) bury(s, p.who.race, p.count)
  }
  if (!healed && p.who.asset) { const a = s.assets?.find(x => x.id === p.who.asset); if (a) a.dead = true }
  s.hospital = s.hospital.filter(x => x !== p)
  addEvent(s, { title: healed ? 'Выздоровели' : 'Не спасли', type: healed ? 'done' : 'alarm', duration: ['quick'], text: healed ? `${name}: ${p.disease || 'болезнь'} позади — снова в строю.` : `${name}: ${p.disease || 'болезнь'}. Целители сделали всё, что могли…`, location: s.name }, false)
  logEntry(s, 'heal', `${name}: ${healed ? 'выписан(ы) здоровыми' : 'умер(ли)'}`)
  saveDb()
  broadcast()
  res.json({ ok: true })
})

/* заготовки событий: сайт предлагает, мастер выпускает в журнал или отбрасывает */
app.post('/api/settlements/:id/suggestions', requireMaster, (req, res) => {
  const s = findSettlement(req.params.id)
  if (!s) return res.status(404).json({ error: 'Поселение не найдено' })
  const sg = addSuggestion(s)
  if (!sg) return res.status(400).json({ error: (s.suggestions?.length || 0) >= MAX_SUGGESTIONS ? 'Очередь заготовок полна — разбери старые' : 'Сейчас придумать нечего' })
  saveDb()
  broadcast()
  res.json(sg)
})

app.post('/api/settlements/:id/suggestions/:sid/accept', requireMaster, (req, res) => {
  const s = findSettlement(req.params.id)
  const sg = s?.suggestions?.find(x => x.id === req.params.sid)
  if (!sg) return res.status(404).json({ error: 'Заготовка не найдена' })
  const b = req.body || {}
  const e = addEvent(s, { title: b.title ?? sg.title, type: b.type ?? sg.type, duration: b.duration ?? sg.duration, text: b.text ?? sg.text, effect: b.effect ?? sg.effect, location: s.name })
  const withEffects = b.apply !== undefined ? !!b.apply : sg.applyOn
  if (withEffects && sg.apply) applyEffects(s, sg.apply)
  logEntry(s, 'event', `Событие: «${e.title}»${withEffects && sg.apply ? ' — ' + applyText(sg.apply) : ''}`)
  s.suggestions = s.suggestions.filter(x => x !== sg)
  s.updatedAt = Date.now()
  saveDb()
  broadcast()
  res.json(e)
})

app.delete('/api/settlements/:id/suggestions/:sid', requireMaster, (req, res) => {
  const s = findSettlement(req.params.id)
  if (!s?.suggestions?.some(x => x.id === req.params.sid)) return res.status(404).json({ error: 'Заготовка не найдена' })
  s.suggestions = s.suggestions.filter(x => x.id !== req.params.sid)
  saveDb()
  broadcast()
  res.json({ ok: true })
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
  const item = { id: newId(schema.prefix), ...JSON.parse(JSON.stringify(schema.defaults || {})), ...data, createdAt: Date.now() }
  if (req.params.col === 'quests') item.postedAt ||= item.createdAt
  getDb()[req.params.col].push(item)
  if (req.params.col === 'quests') notifyNewQuest(item)
  saveDb()
  broadcast()
  res.json(item)
})

app.patch('/api/:col/:id', requireMaster, (req, res) => {
  const schema = SCHEMAS[req.params.col]
  if (!schema) return res.status(404).json({ error: 'Неизвестный тип объекта' })
  const item = getDb()[req.params.col].find(x => x.id === req.params.id)
  if (!item) return res.status(404).json({ error: 'Объект не найден' })
  const patch = sanitize(schema.fields, req.body || {}, true)
  const wasHidden = item.hidden
  if (req.params.col === 'quests' && patch.status && patch.status !== item.status) {
    patch.completedAt = ['done', 'failed', 'closed'].includes(patch.status) ? Date.now() : null
    if (['done', 'failed'].includes(patch.status)) {
      for (const m of item.group) if (m.icon?.startsWith('p:')) notify(m.icon.slice(2), 'questResult', `Заказ «${item.type}» ${patch.status === 'done' ? 'выполнен' : 'провален'}`, { questId: item.id })
    }
  }
  Object.assign(item, patch)
  if (req.params.col === 'quests' && wasHidden && !item.hidden) notifyNewQuest(item)
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

app.use('/api', (req, res) => {
  console.warn('[404]', req.method, req.originalUrl)
  res.status(404).json({ error: 'Нет такого метода' })
})

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
  const data = JSON.stringify({ ...msg, id: from.id, name: from.name, color: from.color, avatar: from.user?.avatar || '' })
  for (const c of clients) if (c !== from && c.ws.readyState === 1) c.ws.send(data)
}

const num = v => (Number.isFinite(Number(v)) ? Math.round(Number(v) * 10) / 10 : null)

wss.on('connection', ws => {
  const id = nextClientId++
  const client = { ws, role: 'guest', user: null, id, name: 'Гость', color: CURSOR_COLORS[id % CURSOR_COLORS.length], pings: [] }
  clients.add(client)
  send(client, viewFor(null))
  ws.send(JSON.stringify({ type: 'hello', id, color: client.color, build: BUILD_ID }))
  // новому клиенту — текущие курсоры и линейки мастеров
  for (const c of clients) {
    if (c === client || !c.user) continue
    if (c.cursor) ws.send(JSON.stringify({ type: 'cursor', id: c.id, name: c.name, color: c.color, ...c.cursor }))
    if (c.ruler) ws.send(JSON.stringify({ type: 'ruler', id: c.id, name: c.name, color: c.color, points: c.ruler }))
  }

  ws.on('message', raw => {
    let msg
    try { msg = JSON.parse(raw) } catch { return }
    switch (msg.type) {
      case 'auth': {
        client.viewAs = msg.viewAs === 'player' ? 'player' : null
        const user = identify(msg.token, client.viewAs)
        if (client.user && !user) {
          client.cursor = client.ruler = null
          relay(client, { type: 'gone' })
        }
        if (msg.token && !user) ws.send(JSON.stringify({ type: 'authFailed' }))
        client.token = user ? msg.token : null
        client.user = user
        client.role = user?.role || 'guest'
        client.name = user?.name || 'Гость'
        if (user?.color) client.color = user.color
        send(client, viewFor(user))
        break
      }
      case 'cursor': {
        // курсоры мастеров видны всегда, игроков — если мастер включил
        if (client.role !== 'master' && !(client.role === 'player' && getDb().settings.playerCursors)) return
        const x = num(msg.x), y = num(msg.y)
        if (x === null || y === null) return
        client.cursor = { x, y }
        relay(client, { type: 'cursor', x, y })
        break
      }
      case 'cursorLeave':
        if (!client.user) return
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
        if (!client.user) return // гости не пингуют
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
    if (client.user) relay(client, { type: 'gone' })
  })
})

server.listen(PORT, HOST, () => console.log(`Анкария: http://${HOST || 'localhost'}:${PORT}`))

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { flushDb(); process.exit(0) })
