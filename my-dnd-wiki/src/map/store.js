// Общее состояние карты: данные мира с сервера, роль, инструменты, выбор.
import { reactive, computed, watch, ref } from 'vue'
import { buildRoadGraph, findRoute, partyPosition, polyLength } from '../shared/geo.js'
import { POINT_EFFECTS } from '../shared/catalog.js'
import { cropImage } from '../components/cropState.js'

const TOKEN_KEY = 'anacaria-token'
const LAYERS_KEY = 'anacaria-layers'
const GUEST_KEY = 'anacaria-guest'
const VIEW_KEY = 'anacaria-view'
export const TICKET_KEY = 'anacaria-ticket'
const SOUND_KEY = 'anacaria-sound'

function lsGet(key) {
  try { return localStorage.getItem(key) } catch { return null }
}
function lsSet(key, val) {
  try { val == null ? localStorage.removeItem(key) : localStorage.setItem(key, val) } catch { /* приватный режим */ }
}

const DEFAULT_LAYERS = {
  states: true, borders: true, rivers: true, labels: true, relief: false, biomes: false, heights: false,
  roads: true, routes: true, quests: true, notes: true, cities: true, towns: true, anomalies: true, parties: true, fog: true, grid: false, cursors: true
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
  data: { settings: { width: 2048, height: 1024, kmPerPx: 1, grid: { cellKm: 10, type: 'square' } }, hud: null, states: [], cities: [], roads: [], anomalies: [], parties: [], fog: [], labels: [], routes: [], icons: [], quests: [], guildRep: {}, roster: [], notes: [], notifications: [], players: [] },
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
  me: null, // { role, id, name, avatar, color } — кто вошёл
  viewAs: lsGet(VIEW_KEY) === 'player' ? 'player' : null, // мастер играет своим персонажем
  // экран входа: показываем, пока не вошёл и не выбрал «смотреть как гость»
  gate: lsGet(TOKEN_KEY) || lsGet(GUEST_KEY) ? null : 'choose',
  sound: lsGet(SOUND_KEY) !== 'off',
  presence: { id: null, color: '#ffd166', cursors: {}, rulers: {}, pings: [] },
  follow: null, // { mode: 'party', partyId, until, by } | { mode: 'view', x, y, span, by } — камера идёт за мастером
  lastMark: 'quest', // какой тип метки ставить следующим
  selectedStop: null, // выбранная остановка маршрута
  offline: false, // связи с сервером нет дольше нескольких секунд
  newVersion: false, // на сервере уже другая сборка сайта — эта вкладка устарела
  reconnectTries: 0
})

export const isMaster = computed(() => store.role === 'master')
export const isPlayer = computed(() => store.role === 'player')
export const isUser = computed(() => store.role === 'master' || store.role === 'player')
export const unread = computed(() => (store.data.notifications || []).filter(n => !n.read).length)

// аватарка: файл аватара игрока/мастера
export const avatarUrl = file => (file ? `/avatars/${file}` : '')
// портрет участника группы: своя иконка (u:) или аватар игрока (p:)
export function portraitUrl(icon) {
  if (!icon) return ''
  if (icon.startsWith('u:')) {
    const ic = store.data.icons.find(i => i.id === icon.slice(2))
    return ic ? `/usericons/${ic.file}` : ''
  }
  if (icon.startsWith('p:')) return avatarUrl(store.data.roster?.find(p => p.id === icon.slice(2))?.avatar)
  return ''
}

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
  const marks = [] // длина пути до каждой точки
  let allByRoad = plan.waypoints.length > 0, run = 0
  for (let i = 1; i < stops.length; i++) {
    const leg = plan.byRoad ? findRoute(roadGraph.value, stops[i - 1], stops[i]) : { points: [stops[i - 1], stops[i]], byRoad: false }
    if (!leg.byRoad) allByRoad = false
    points.push(...leg.points.slice(1))
    run += polyLength(leg.points)
    marks.push(run)
  }
  return { points, length: polyLength(points), byRoad: allByRoad, marks }
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
      ...(store.token ? { authorization: 'Bearer ' + store.token } : {}),
      ...(store.token && store.viewAs ? { 'x-view-as': store.viewAs } : {})
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

// токен больше не действует (сменили пароль, удалили аккаунт) — выходим и показываем вход
function tokenRevoked() {
  setToken(null)
  if (!lsGet(GUEST_KEY)) store.gate = 'choose'
}

function applyState(state) {
  store.clockOffset = state.serverTime - Date.now()
  store.now = Date.now() + store.clockOffset
  store.role = state.role
  store.me = state.me || null
  const { role, serverTime, me, ...data } = state
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

// экран «Энди спит» — только если связи нет дольше 5 секунд (короткий перезапуск сервера не мигает)
let offlineTimer = null
let reconnectTimer = null

function connect() {
  clearTimeout(reconnectTimer)
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  ws = new WebSocket(`${proto}://${location.host}/ws`)
  ws.onopen = () => {
    store.connected = true
    clearTimeout(offlineTimer)
    offlineTimer = null
    store.offline = false
    store.reconnectTries = 0
    retry = 0
    if (store.token) ws.send(JSON.stringify({ type: 'auth', token: store.token, viewAs: store.viewAs }))
    store.presence.cursors = {}
    store.presence.rulers = {}
  }
  ws.onmessage = e => {
    const msg = JSON.parse(e.data)
    if (msg.type === 'state') {
      // первый вид при подключении — гостевой, пока сервер не проверил токен; его пропускаем
      if (store.token && msg.state.role === 'guest') return
      applyState(msg.state)
    } else if (msg.type === 'authFailed') tokenRevoked()
    else onPresence(msg)
  }
  ws.onclose = () => {
    store.connected = false
    store.reconnectTries++
    offlineTimer ||= setTimeout(() => { store.offline = true }, 5000)
    reconnectTimer = setTimeout(connect, Math.min(15000, 1000 * 2 ** retry++))
  }
}

// Арт «Энди спит» качаем заранее и держим в памяти: когда сервер лежит, взять его будет неоткуда
export const offlineArt = ref('')
function preloadOfflineArt() {
  fetch('/img/andy-sleep.webp').then(r => (r.ok ? r.blob() : null)).then(b => { if (b) offlineArt.value = URL.createObjectURL(b) }).catch(() => {})
}

let started = false
export async function init() {
  // карта и вики пользуются одним хранилищем — подключаемся один раз
  if (started) return
  started = true
  preloadOfflineArt()
  try {
    const [state, paths] = await Promise.all([api('GET', '/api/state'), fetch(`/map/states.json?v=${__BUILD__}`).then(r => r.json())])
    store.statePaths = paths
    applyState(state)
    if (store.token && state.role === 'guest') tokenRevoked()
    if (!store.token) checkTicket()
  } catch (e) {
    toast('Сервер карты недоступен: ' + e.message, 'error')
  }
  connect()
}

// «Разбудить» — попробовать переподключиться прямо сейчас
export function reconnectNow() {
  if (store.connected) return
  retry = 0
  if (ws) {
    ws.onclose = null // иначе закрытие запустит второе переподключение
    try { ws.close() } catch { /* уже закрыт */ }
  }
  connect()
}

export function setToken(token) {
  store.token = token
  lsSet(TOKEN_KEY, token)
  if (!token) {
    store.role = 'guest'
    store.me = null
    store.viewAs = null
    lsSet(VIEW_KEY, null)
    store.tool = 'select'
    store.journeyPlan = null
    store.draft = null
    store.pick = null
  }
  if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'auth', token, viewAs: store.viewAs }))
}

// Мастер с персонажем: «♛ мастер ⇄ ⚔ персонаж»
export async function setViewAs(mode) {
  store.viewAs = mode === 'player' ? 'player' : null
  lsSet(VIEW_KEY, store.viewAs)
  Object.assign(store, { tool: 'select', selection: null, journeyPlan: null, draft: null, pick: null })
  if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'auth', token: store.token, viewAs: store.viewAs }))
  applyState(await api('GET', '/api/state'))
}

export async function login(loginName, password) {
  const r = await api('POST', '/api/login', { login: loginName, password })
  setToken(r.token)
  store.gate = null
  lsSet(TICKET_KEY, null)
  // состояние придёт по WebSocket; на всякий случай запрашиваем и напрямую
  applyState(await api('GET', '/api/state'))
  return r.role
}

export function logout() {
  setToken(null)
  store.gate = 'choose'
  lsSet(GUEST_KEY, null)
  api('GET', '/api/state').then(applyState).catch(() => {})
}

export function enterAsGuest() {
  lsSet(GUEST_KEY, '1')
  store.gate = null
}

export async function registerPlayer(form) {
  const r = await api('POST', '/api/register', form)
  if (r.ticket) lsSet(TICKET_KEY, r.ticket)
  return r
}

// Заявка, отправленная с этого устройства: одобрили — открываем вход с логином
export async function ticketStatus() {
  const t = lsGet(TICKET_KEY)
  if (!t) return null
  try {
    return await api('GET', `/api/register/status/${encodeURIComponent(t)}`)
  } catch (e) {
    if (e.status === 404) lsSet(TICKET_KEY, null)
    return null
  }
}
export const forgetTicket = () => lsSet(TICKET_KEY, null)
async function checkTicket() {
  const st = await ticketStatus()
  if (st?.status === 'active') store.gate = 'approved'
}

export async function updateProfile(patch) {
  const r = await api('PATCH', '/api/me', patch)
  if (r.token) setToken(r.token)
  applyState(await api('GET', '/api/state'))
  return r
}

export function markRead(ids) {
  return api('POST', '/api/notifications/read', ids ? { ids } : {}).catch(() => {})
}

// Картинку уменьшаем на клиенте и отдаём data URL (аватарки — квадрат до 256px)
export async function imageToDataUrl(file, max = 256) {
  if (!file.type.startsWith('image/') || file.type.includes('svg')) throw new Error('Нужна картинка PNG, JPG, WebP или GIF')
  const bmp = await createImageBitmap(file)
  const side = Math.min(bmp.width, bmp.height)
  const c = document.createElement('canvas')
  c.width = c.height = Math.min(max, side)
  // обрезаем по центру в квадрат — для круглой аватарки
  c.getContext('2d').drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, c.width, c.height)
  return c.toDataURL('image/webp', 0.88)
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
      if (msg.build && msg.build !== __BUILD__ && !import.meta.env.DEV) store.newVersion = true
      P.id = msg.id
      P.color = msg.color
      break
    case 'cursor':
      P.cursors[msg.id] = { name: msg.name, color: msg.color, avatar: msg.avatar, x: msg.x, y: msg.y, t: Date.now() }
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
  if (store.role !== 'master' && !(store.role === 'player' && store.data.settings.playerCursors)) return
  pendingCursor = [x, y]
  if (cursorTimer) return
  cursorTimer = setTimeout(() => {
    cursorTimer = null
    if (pendingCursor) wsSend({ type: 'cursor', x: pendingCursor[0], y: pendingCursor[1] })
  }, 50)
}
export function sendCursorLeave() {
  pendingCursor = null
  if (store.role !== 'guest') wsSend({ type: 'cursorLeave' })
}

export function sendRuler(points) {
  if (store.role === 'master') wsSend({ type: 'ruler', points })
}

const PING_TTL = 4200
function addPing(p) {
  const ping = { key: Math.random(), x: p.x, y: p.y, name: p.name, avatar: p.avatar, color: p.color, kind: p.kind || 'look', t: Date.now() }
  store.presence.pings.push(ping)
  setTimeout(() => {
    const i = store.presence.pings.indexOf(ping)
    if (i !== -1) store.presence.pings.splice(i, 1)
  }, PING_TTL)
  playPing(ping.kind)
}

export function ping(x, y, kind = 'look') {
  if (store.role === 'guest') {
    toast('Пинги — для вошедших игроков', 'error')
    return
  }
  if (store.role !== 'master' && !store.data.settings.playerPings) {
    toast('Мастер выключил пинги игроков', 'error')
    return
  }
  addPing({ x, y, kind, name: store.me?.name || 'Вы', avatar: store.me?.avatar, color: store.me?.color || store.presence.color })
  wsSend({ type: 'ping', x, y, kind })
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

/* ---------------- Герои и арты ---------------- */
export const heroPortraitUrl = file => (file ? `/portraits/${file}` : '')
export const artUrl = file => (file ? `/arts/${file}` : '')

// картинка → blob не больше max по длинной стороне (webp); возвращает и размеры оригинала
async function shrink(file, max, quality = 0.9) {
  if (!file.type.startsWith('image/') || file.type.includes('svg')) throw new Error('Нужна картинка PNG, JPG, GIF или WebP')
  const bmp = await createImageBitmap(file)
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(bmp.width * k))
  c.height = Math.max(1, Math.round(bmp.height * k))
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height)
  const blob = await new Promise(r => c.toBlob(r, 'image/webp', quality))
  return { blob, w: bmp.width, h: bmp.height }
}

async function postBlob(url, blob) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': blob.type || 'application/octet-stream',
      ...(store.token ? { authorization: 'Bearer ' + store.token } : {}),
      ...(store.token && store.viewAs ? { 'x-view-as': store.viewAs } : {})
    },
    body: blob
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || 'Не удалось загрузить')
  return json
}

// значки и портреты поселения: сначала окно обрезки (квадрат 512px); null — если нажали «Отмена»
export async function uploadSettlementPortrait(sid, file, title = 'Обрезка картинки') {
  const blob = await cropImage(file, { title })
  if (!blob) return null
  return postBlob(`/api/settlements/${sid}/portrait`, blob)
}

// арт карточки: целиком до 2400px (смотреть на весь экран) + лёгкий 720px для самой карточки
export async function uploadHeroArt(heroId, file) {
  const big = file.size < 4e6 && /png|jpeg|webp/.test(file.type) ? { blob: file } : await shrink(file, 2400, 0.92)
  const g = await postBlob(`/api/heroes/${heroId}/gallery`, big.blob)
  const { blob } = await shrink(file, 720, 0.88)
  try { return await postBlob(`/api/heroes/${heroId}/gallery/${g.id}/thumb`, blob) } catch { return g }
}
// обложка карточки — первый арт
export const heroCover = h => h?.gallery?.[0] || null

// арт: оригинал как есть (до 40 МБ) + лёгкое превью для стены
export async function uploadArt(file) {
  if (file.size > 40 * 1024 * 1024) throw new Error(`«${file.name}» больше 40 МБ`)
  const { blob: thumb, w, h } = await shrink(file, 720, 0.85)
  const name = file.name.replace(/\.[^.]+$/, '').slice(0, 120)
  const art = await postBlob(`/api/arts?name=${encodeURIComponent(name)}&w=${w}&h=${h}`, file)
  try { await postBlob(`/api/arts/${art.id}/thumb`, thumb) } catch { /* без превью покажем оригинал */ }
  return art
}

// какие арты этот браузер уже видел — для ленточки «НОВОЕ»
const ARTS_SEEN_KEY = 'anacaria-arts-seen'
export const artsSeen = ref(Number(lsGet(ARTS_SEEN_KEY)) || 0)
export function markArtsSeen() {
  const last = Math.max(0, ...(store.data.arts || []).map(a => a.createdAt))
  if (last > artsSeen.value) {
    artsSeen.value = last
    lsSet(ARTS_SEEN_KEY, String(last))
  }
}
export const unseenArts = computed(() => (store.data.arts || []).filter(a => a.createdAt > artsSeen.value).length)
