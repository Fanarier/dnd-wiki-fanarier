// Общее состояние карты: данные мира с сервера, роль, инструменты, выбор.
import { reactive, computed, watch } from 'vue'
import { buildRoadGraph, findRoute, partyPosition, polyLength } from '../shared/geo.js'
import { POINT_EFFECTS } from '../shared/catalog.js'

const TOKEN_KEY = 'anacaria-token'
const LAYERS_KEY = 'anacaria-layers'
const NICK_KEY = 'anacaria-nick'
const SOUND_KEY = 'anacaria-sound'

function lsGet(key) {
  try { return localStorage.getItem(key) } catch { return null }
}
function lsSet(key, val) {
  try { val == null ? localStorage.removeItem(key) : localStorage.setItem(key, val) } catch { /* приватный режим */ }
}

const DEFAULT_LAYERS = {
  states: true, borders: true, rivers: true, labels: true, relief: false, biomes: false, heights: false,
  roads: true, routes: true, cities: true, towns: true, anomalies: true, parties: true, fog: true, grid: false, cursors: true
}

let savedLayers = {}
try { savedLayers = JSON.parse(lsGet(LAYERS_KEY) || '{}') } catch { /* ignore */ }

export const store = reactive({
  ready: false,
  connected: false,
  role: 'player',
  token: lsGet(TOKEN_KEY),
  clockOffset: 0,
  now: Date.now(),
  data: { settings: { width: 2048, height: 1024, kmPerPx: 1, grid: { cellKm: 10, type: 'square' } }, hud: null, states: [], cities: [], roads: [], anomalies: [], parties: [], fog: [], labels: [], routes: [], icons: [] },
  statePaths: [],

  layers: { ...DEFAULT_LAYERS, ...savedLayers },
  tool: 'select', // select | ruler | ping | city | road | label | zone | point | party | fogBrush | fogErase | fogLasso | fogLassoErase
  brush: 30,
  selection: null, // { type, id }
  hover: null,
  draft: null, // рисуемая дорога / лассо
  journeyPlan: null, // { partyId, waypoints: [[x,y]], byRoad: true }
  pick: null, // { purpose, id } — ждём клик по карте
  replay: null, // { path, t0, duration, color }
  toasts: [],
  fogUndo: [],
  ruler: null, // { points: [[x,y]], done } — своя линейка
  nick: lsGet(NICK_KEY) || '',
  sound: lsGet(SOUND_KEY) !== 'off',
  presence: { id: null, color: '#ffd166', cursors: {}, rulers: {}, pings: [] },
  follow: null, // { mode: 'party', partyId, until, by } | { mode: 'view', x, y, span, by } — камера идёт за мастером
  lastMark: 'quest', // какой тип метки ставить следующим
  selectedStop: null // выбранная остановка маршрута
})

export const isMaster = computed(() => store.role === 'master')

watch(() => ({ ...store.layers }), v => lsSet(LAYERS_KEY, JSON.stringify(v)))

// маршруты (в том числе морские) тоже годятся для прокладки пути отряда
export const roadGraph = computed(() => buildRoadGraph([...store.data.roads, ...store.data.routes.map(r => ({ points: r.points, type: 'sea' }))]))

// Планируемый маршрут отряда: от текущей позиции через все точки, по дорогам или напрямик
export const planPath = computed(() => {
  const plan = store.journeyPlan
  if (!plan) return null
  const party = store.data.parties.find(p => p.id === plan.partyId)
  if (!party) return null
  const start = partyPosition(party, store.now)
  const stops = [[start.x, start.y], ...plan.waypoints]
  const points = [stops[0]]
  let allByRoad = plan.waypoints.length > 0
  for (let i = 1; i < stops.length; i++) {
    const leg = plan.byRoad ? findRoute(roadGraph.value, stops[i - 1], stops[i]) : { points: [stops[i - 1], stops[i]], byRoad: false }
    if (!leg.byRoad) allByRoad = false
    points.push(...leg.points.slice(1))
  }
  return { points, length: polyLength(points), byRoad: allByRoad }
})

export function toast(text, kind = 'info') {
  const id = Math.random()
  store.toasts.push({ id, text, kind })
  setTimeout(() => {
    const i = store.toasts.findIndex(t => t.id === id)
    if (i !== -1) store.toasts.splice(i, 1)
  }, kind === 'error' ? 6000 : 3000)
}

/* ---------------- Время ---------------- */
setInterval(() => { store.now = Date.now() + store.clockOffset }, 1000)

/* ---------------- HTTP ---------------- */
export async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: {
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(store.token ? { authorization: 'Bearer ' + store.token } : {})
    },
    body: body !== undefined ? JSON.stringify(body) : undefined
  })
  let json = null
  try { json = await res.json() } catch { /* пусто */ }
  if (!res.ok) {
    if (res.status === 401 && store.token && url !== '/api/login') {
      setToken(null)
      toast('Сессия мастера истекла — войди заново', 'error')
    }
    const err = new Error(json?.error || `Ошибка ${res.status}`)
    err.status = res.status
    throw err
  }
  return json
}

// Обёртка для действий мастера: показываем ошибку тостом
export async function act(method, url, body, okText) {
  try {
    const r = await api(method, url, body)
    if (okText) toast(okText)
    return r
  } catch (e) {
    toast(e.message, 'error')
    throw e
  }
}

function applyState(state) {
  store.clockOffset = state.serverTime - Date.now()
  store.now = Date.now() + store.clockOffset
  store.role = state.role
  const { role, serverTime, ...data } = state
  store.data = data
  store.ready = true
  if (store.selection && !findSelected()) store.selection = null
}

export function findSelected() {
  const s = store.selection
  if (!s) return null
  const list = store.data[s.type]
  return list ? list.find(x => x.id === s.id) : null
}

/* ---------------- WebSocket ---------------- */
let ws = null
let retry = 0

function connect() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  ws = new WebSocket(`${proto}://${location.host}/ws`)
  ws.onopen = () => {
    store.connected = true
    retry = 0
    if (store.token) ws.send(JSON.stringify({ type: 'auth', token: store.token }))
    if (store.nick) ws.send(JSON.stringify({ type: 'nick', name: store.nick }))
    store.presence.cursors = {}
    store.presence.rulers = {}
  }
  ws.onmessage = e => {
    const msg = JSON.parse(e.data)
    if (msg.type === 'state') applyState(msg.state)
    else onPresence(msg)
  }
  ws.onclose = () => {
    store.connected = false
    setTimeout(connect, Math.min(15000, 1000 * 2 ** retry++))
  }
}

export async function init() {
  try {
    const [state, paths] = await Promise.all([api('GET', '/api/state'), fetch('/map/states.json').then(r => r.json())])
    store.statePaths = paths
    applyState(state)
  } catch (e) {
    toast('Сервер карты недоступен: ' + e.message, 'error')
  }
  connect()
}

export function setToken(token) {
  store.token = token
  lsSet(TOKEN_KEY, token)
  if (!token) {
    store.role = 'player'
    store.tool = 'select'
    store.journeyPlan = null
    store.draft = null
    store.pick = null
  }
  if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'auth', token }))
}

export async function login(loginName, password) {
  const r = await api('POST', '/api/login', { login: loginName, password })
  setToken(r.token)
  // состояние мастера придёт по WebSocket; на всякий случай запрашиваем и напрямую
  applyState(await api('GET', '/api/state'))
}

export function logout() {
  setToken(null)
  api('GET', '/api/state').then(applyState).catch(() => {})
}

/* ---------------- Утилиты ---------------- */
export const km = px => px * (store.data.settings.kmPerPx || 1)

export function fmtKm(px) {
  const v = km(px)
  return v >= 100 ? `${Math.round(v)} км` : `${v.toFixed(1)} км`
}

export function fmtDuration(ms) {
  if (ms <= 0) return '0 мин'
  const m = Math.round(ms / 60000)
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60
  return [d && `${d} д`, h && `${h} ч`, (!d && mm) && `${mm} мин`].filter(Boolean).join(' ') || '< 1 мин'
}

export function fmtDateTime(ms) {
  if (ms == null) return '—'
  return new Date(ms).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

/* ---------------- Присутствие: курсоры, пинги, линейки ---------------- */
function wsSend(msg) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg))
}

function onPresence(msg) {
  const P = store.presence
  switch (msg.type) {
    case 'hello':
      P.id = msg.id
      P.color = msg.color
      break
    case 'cursor':
      P.cursors[msg.id] = { name: msg.name, color: msg.color, x: msg.x, y: msg.y, t: Date.now() }
      break
    case 'cursorLeave':
      delete P.cursors[msg.id]
      break
    case 'gone':
      delete P.cursors[msg.id]
      delete P.rulers[msg.id]
      break
    case 'ruler':
      if (msg.points) P.rulers[msg.id] = { name: msg.name, color: msg.color, points: msg.points }
      else delete P.rulers[msg.id]
      break
    case 'ping':
      addPing(msg)
      break
    case 'follow':
      // мастер показывает всем: свой вид или едущий отряд
      if (store.role === 'master') return
      store.follow = { ...msg }
      toast(`${msg.by || 'Мастер'} показывает карту — двиньте карту, чтобы выйти`)
      break
  }
}

export function sendFollow(msg) {
  if (store.role === 'master') wsSend({ type: 'follow', ...msg })
}

/* ---------------- Свои иконки ---------------- */
// Картинка метки: встроенная из легенды или своя «u:<id>» из библиотеки мастера
export function markIcon(effect) {
  if (typeof effect === 'string' && effect.startsWith('u:')) {
    const ic = store.data.icons.find(i => i.id === effect.slice(2))
    if (ic) return { src: `/usericons/${ic.file}`, w: ic.w, h: ic.h, label: ic.name, custom: true }
  }
  const e = POINT_EFFECTS[effect] || POINT_EFFECTS.unknown
  return { src: `/icons/${e.img}.png`, w: 1, h: 1, label: e.label, custom: false }
}

// Загрузка: уменьшаем на клиенте до 512px по большей стороне, прозрачность сохраняется
export async function uploadIcon(file) {
  if (!file.type.startsWith('image/') || file.type.includes('svg')) throw new Error('Нужна картинка PNG, JPG, GIF или WebP')
  const bmp = await createImageBitmap(file)
  const k = Math.min(1, 512 / Math.max(bmp.width, bmp.height))
  const w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k))
  let blob = file
  if (k < 1 || file.size > 1.5e6) {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    c.getContext('2d').drawImage(bmp, 0, 0, w, h)
    blob = await new Promise(r => c.toBlob(r, 'image/webp', 0.9))
  }
  const name = file.name.replace(/\.[^.]+$/, '').slice(0, 60)
  const res = await fetch(`/api/icons?name=${encodeURIComponent(name)}&w=${w}&h=${h}`, {
    method: 'POST',
    headers: { 'content-type': blob.type || 'application/octet-stream', authorization: 'Bearer ' + store.token },
    body: blob
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || 'Не удалось загрузить')
  return json
}

// старые курсоры (мастер ушёл со вкладки) гасим через 15 секунд
setInterval(() => {
  const now = Date.now()
  for (const [id, c] of Object.entries(store.presence.cursors)) if (now - c.t > 15000) delete store.presence.cursors[id]
}, 5000)

let cursorTimer = null
let pendingCursor = null
export function sendCursor(x, y) {
  if (store.role !== 'master') return
  pendingCursor = [x, y]
  if (cursorTimer) return
  cursorTimer = setTimeout(() => {
    cursorTimer = null
    if (pendingCursor) wsSend({ type: 'cursor', x: pendingCursor[0], y: pendingCursor[1] })
  }, 50)
}
export function sendCursorLeave() {
  pendingCursor = null
  if (store.role === 'master') wsSend({ type: 'cursorLeave' })
}

export function sendRuler(points) {
  if (store.role === 'master') wsSend({ type: 'ruler', points })
}

const PING_TTL = 4200
function addPing(p) {
  const ping = { key: Math.random(), x: p.x, y: p.y, name: p.name, color: p.color, kind: p.kind || 'look', t: Date.now() }
  store.presence.pings.push(ping)
  setTimeout(() => {
    const i = store.presence.pings.indexOf(ping)
    if (i !== -1) store.presence.pings.splice(i, 1)
  }, PING_TTL)
  playPing(ping.kind)
}

export function ping(x, y, kind = 'look') {
  if (store.role !== 'master' && !store.data.settings.playerPings) {
    toast('Мастер выключил пинги игроков', 'error')
    return
  }
  addPing({ x, y, kind, name: store.role === 'master' ? 'Вы' : (store.nick || 'Вы'), color: store.presence.color })
  wsSend({ type: 'ping', x, y, kind })
}

export function setNick(name) {
  store.nick = String(name || '').trim().slice(0, 24)
  lsSet(NICK_KEY, store.nick || null)
  wsSend({ type: 'nick', name: store.nick })
}

export function setSound(on) {
  store.sound = on
  lsSet(SOUND_KEY, on ? null : 'off')
}

// Короткий «дзынь» без файлов — WebAudio
let audio = null
function playPing(kind) {
  if (!store.sound) return
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)()
    const t = audio.currentTime
    const notes = kind === 'danger' ? [660, 440] : kind === 'go' ? [520, 780] : [880, 1320]
    notes.forEach((f, i) => {
      const o = audio.createOscillator(), g = audio.createGain()
      o.type = kind === 'danger' ? 'triangle' : 'sine'
      o.frequency.value = f
      g.gain.setValueAtTime(0.0001, t + i * 0.09)
      g.gain.exponentialRampToValueAtTime(0.12, t + i * 0.09 + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.09 + 0.25)
      o.connect(g).connect(audio.destination)
      o.start(t + i * 0.09)
      o.stop(t + i * 0.09 + 0.3)
    })
  } catch { /* браузер не дал звук — не страшно */ }
}
