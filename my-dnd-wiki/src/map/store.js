// Общее состояние карты: данные мира с сервера, роль, инструменты, выбор.
import { reactive, computed, watch } from 'vue'
import { buildRoadGraph, findRoute, partyPosition, polyLength } from '../shared/geo.js'

const TOKEN_KEY = 'anacaria-token'
const LAYERS_KEY = 'anacaria-layers'

function lsGet(key) {
  try { return localStorage.getItem(key) } catch { return null }
}
function lsSet(key, val) {
  try { val == null ? localStorage.removeItem(key) : localStorage.setItem(key, val) } catch { /* приватный режим */ }
}

const DEFAULT_LAYERS = {
  states: true, borders: true, rivers: true, labels: true, relief: false, biomes: false, heights: false,
  roads: true, cities: true, towns: true, anomalies: true, parties: true, fog: true
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
  data: { settings: { width: 2048, height: 1024, kmPerPx: 1 }, states: [], cities: [], roads: [], anomalies: [], parties: [], fog: [] },
  statePaths: [],

  layers: { ...DEFAULT_LAYERS, ...savedLayers },
  tool: 'select', // select | city | road | zone | point | party | fogBrush | fogErase | fogLasso | fogLassoErase
  brush: 30,
  selection: null, // { type, id }
  hover: null,
  draft: null, // рисуемая дорога / лассо
  journeyPlan: null, // { partyId, waypoints: [[x,y]], byRoad: true }
  pick: null, // { purpose, id } — ждём клик по карте
  replay: null, // { path, t0, duration, color }
  toasts: [],
  fogUndo: []
})

export const isMaster = computed(() => store.role === 'master')

watch(() => ({ ...store.layers }), v => lsSet(LAYERS_KEY, JSON.stringify(v)))

export const roadGraph = computed(() => buildRoadGraph(store.data.roads))

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
  }
  ws.onmessage = e => {
    const msg = JSON.parse(e.data)
    if (msg.type === 'state') applyState(msg.state)
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
