// Листы персонажей в браузере: список, открытый лист, сохранение правок и живые обновления.
// Правка → сразу в лист на экране, на сервер — пачкой через полсекунды (поле, которое печатают, не дёргаем
// чужими правками, пока своя не ушла). Другие видят изменения вживую через сокет.
import { reactive, ref } from 'vue'
import { store, api, toast, wsListen, wsSend, postBlob, shrink, requestRoll } from '../map/store.js'
import { cropImage } from '../components/cropState.js'
import { getAt, setAt, cleanBy, schemaAt } from '../shared/sheet.js'

export const sheets = reactive({ list: [], owners: [], loading: false, loaded: false })
export const sheet = reactive({ id: null, meta: null, data: null, rev: 0, status: 'idle', error: '' })
export const rollMode = ref('') // преимущество / помеха для бросков из листа

const authHeaders = (json = true) => ({
  ...(json ? { 'content-type': 'application/json' } : {}),
  ...(store.token ? { authorization: 'Bearer ' + store.token } : {}),
  ...(store.token && store.viewAs ? { 'x-view-as': store.viewAs } : {}),
  'x-client-id': String(store.presence.id ?? '')
})

/* ---------- список ---------- */
let listAgain = false
export async function loadSheets() {
  if (sheets.loading) { listAgain = true; return }
  sheets.loading = true
  try {
    const j = await api('GET', '/api/sheets')
    sheets.list = j.sheets
    sheets.owners = j.owners
    sheets.loaded = true
  } catch (e) { toast(e.message, 'error') } finally {
    sheets.loading = false
    if (listAgain) { listAgain = false; loadSheets() }
  }
}

/* ---------- открытый лист ---------- */
const pending = new Map() // путь → значение, ещё не ушло на сервер
let flushTimer = 0
let inflight = null

// кто открыл лист последним: книга листа и мини-лист в журнале деятельностей делят один открытый лист,
// и тот, кто закрывается позже, не должен закрыть лист, который уже открыл другой
let gen = 0
export const sheetGen = () => gen
export async function openSheet(id) {
  gen++
  if (sheet.id && sheet.id !== id) await flush()
  sheet.id = id
  sheet.status = 'loading'
  sheet.error = ''
  try {
    const j = await api('GET', `/api/sheets/${id}`)
    if (sheet.id !== id) return
    const { data, ...meta } = j
    sheet.meta = meta
    sheet.data = data
    sheet.rev = meta.rev
    sheet.status = 'ready'
    wsSend({ type: 'sheetSub', id })
  } catch (e) {
    if (sheet.id !== id) return
    sheet.status = 'error'
    sheet.error = e.message
  }
}
export async function closeSheet(onlyGen) {
  await flush()
  if (onlyGen != null && onlyGen !== gen) return
  wsSend({ type: 'sheetSub', id: null })
  Object.assign(sheet, { id: null, meta: null, data: null, rev: 0, status: 'idle', error: '' })
}

// правка поля: сразу на экране, на сервер — пачкой
export function edit(path, value, { now = false } = {}) {
  if (!sheet.data) return
  const s = schemaAt(path)
  if (!s) return console.warn('[sheet] нет такого поля', path)
  const v = cleanBy(s, value)
  setAt(sheet.data, path, v)
  if (path === 'Hits') { const n = parseInt(String(v).replace(/^\+/, ''), 10); if (n > 0 && sheet.data.HpData.Max !== n) { setAt(sheet.data, 'HpData.Max', n); pending.set('HpData.Max', n) } }
  // правка целого списка перекрывает недосланные правки его элементов
  for (const k of pending.keys()) if (k.startsWith(path + '.')) pending.delete(k)
  pending.set(path, v)
  sheet.status = 'saving'
  clearTimeout(flushTimer)
  flushTimer = setTimeout(flush, now ? 0 : 500)
}
export const val = path => (sheet.data ? getAt(sheet.data, path) : undefined)

export async function flush() {
  clearTimeout(flushTimer)
  if (inflight) await inflight
  if (!pending.size || !sheet.id) return
  const id = sheet.id
  const ops = [...pending].map(([p, v]) => ({ p, v }))
  pending.clear()
  inflight = (async () => {
    try {
      const res = await fetch(`/api/sheets/${id}`, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ ops }), keepalive: JSON.stringify(ops).length < 60000 })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || `Ошибка ${res.status}`)
      if (sheet.id === id) { sheet.rev = j.rev; sheet.status = pending.size ? 'saving' : 'saved' }
    } catch (e) {
      // не дошло — вернём правки в очередь (если их не перебили новые) и попробуем ещё раз
      for (const o of ops) if (!pending.has(o.p)) pending.set(o.p, o.v)
      if (sheet.id === id) sheet.status = 'offline'
      clearTimeout(flushTimer)
      flushTimer = setTimeout(flush, 4000)
      if (!/Failed to fetch|NetworkError/.test(e.message)) toast(e.message, 'error')
    } finally { inflight = null }
  })()
  return inflight
}
addEventListener('beforeunload', () => { if (pending.size) flush() })

// сообщения сокета: правки открытого листа от других, «список поменялся», переподключение
wsListen(msg => {
  if (msg.type === 'sheetOps' && msg.id === sheet.id && sheet.data) {
    for (const o of msg.ops) {
      if (o.p === '') { sheet.data = o.v; continue }
      if (pending.has(o.p)) continue // своё ещё не ушло — оно и победит
      setAt(sheet.data, o.p, o.v)
    }
    sheet.rev = msg.rev
    remoteTick.value++
  } else if (msg.type === 'sheetsChanged') {
    if (sheets.loaded) loadSheets()
    if (msg.id === sheet.id && sheet.meta) refreshMeta()
  } else if (msg.type === 'hello' && sheet.id) {
    // новое подключение: подписка пропала, пока не было связи — могли пропустить правки
    setTimeout(() => { if (sheet.id) { wsSend({ type: 'sheetSub', id: sheet.id }); resync() } }, 300)
  }
})
export const remoteTick = ref(0)
async function refreshMeta() {
  try {
    const j = await api('GET', `/api/sheets/${sheet.id}`)
    const { data, ...meta } = j
    sheet.meta = meta
    if (j.rev > sheet.rev && !pending.size) { sheet.data = data; sheet.rev = j.rev }
  } catch (e) { if (e.status === 404) { sheet.status = 'error'; sheet.error = 'Лист больше недоступен' } }
}
async function resync() {
  await flush()
  await refreshMeta()
}

/* ---------- действия со списком ---------- */
export async function createSheet(name, ownerId) {
  const sh = await api('POST', '/api/sheets', { name, ownerId })
  await loadSheets()
  return sh
}
// .json приложения: шлём как есть (внутри картинки — большой)
export async function importSheet(file, ownerId) {
  if (file.size > 60 * 1024 * 1024) throw new Error(`«${file.name}» больше 60 МБ`)
  const q = ownerId ? `?owner=${encodeURIComponent(ownerId)}` : ''
  const res = await fetch(`/api/sheets/import${q}`, { method: 'POST', headers: { ...authHeaders(false), 'content-type': 'application/octet-stream' }, body: file })
  const j = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`${file.name}: ${j.error || 'ошибка ' + res.status}`)
  return j
}
export async function replaceFromFile(file) {
  await flush()
  const res = await fetch(`/api/sheets/${sheet.id}/replace`, { method: 'POST', headers: { ...authHeaders(false), 'content-type': 'application/octet-stream' }, body: file })
  const j = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(j.error || `Ошибка ${res.status}`)
  const { data, ...meta } = j
  sheet.meta = meta
  sheet.data = data
  sheet.rev = meta.rev
}
export async function exportSheet(id, name) {
  await flush()
  const res = await fetch(`/api/sheets/${id}/export`, { headers: authHeaders(false) })
  if (!res.ok) throw new Error('Не получилось выгрузить лист')
  const url = URL.createObjectURL(await res.blob())
  const a = Object.assign(document.createElement('a'), { href: url, download: `${(name || 'Персонаж').replace(/[\\/:*?"<>|]+/g, '_')}.json` })
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
export const setMeta = (id, patch) => api('PATCH', `/api/sheets/${id}/meta`, patch)
export const deleteSheet = id => api('DELETE', `/api/sheets/${id}`)
export const restoreSheet = id => api('POST', `/api/sheets/${id}/restore`)
export const loadHistory = id => api('GET', `/api/sheets/${id}/history`)
export const revertEntry = (id, entryId) => api('POST', `/api/sheets/${id}/revert`, { entryId })

/* ---------- картинки ---------- */
export const sheetImg = f => (f ? `/sheet-img/${f}` : '')
// выбрать картинку → (обрезать) → на сервер → имя файла в поле листа
export async function pickImage(path, { crop = true, title = 'Картинка', size = 512 } = {}) {
  const file = await new Promise(res => {
    const inp = Object.assign(document.createElement('input'), { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif' })
    inp.onchange = () => res(inp.files?.[0] || null)
    inp.click()
  })
  if (!file) return
  let blob = file
  if (crop) {
    blob = await cropImage(file, { title, size })
    if (!blob) return
  } else if (file.size > 3e6) blob = (await shrink(file, 1600, 0.9)).blob
  const { file: name } = await postBlob(`/api/sheets/${sheet.id}/image`, blob)
  edit(path, name, { now: true })
}

/* ---------- броски ---------- */
// последний бросок из листа: подпись и элемент, по которому щёлкнули (итог всплывёт рядом с ним)
export const lastRoll = { label: '', el: null, at: 0 }
export function roll(formula, label, el = null) {
  const who = sheet.data?.CharacterName ? `${sheet.data.CharacterName}: ` : ''
  const full = (who + (label || '')).slice(0, 60)
  Object.assign(lastRoll, { label: full, el, at: Date.now() })
  requestRoll({ formula, label: full, adv: rollMode.value })
}
export const rollBonus = (bonus, label, el) => roll(`1d20${bonus ? (bonus > 0 ? '+' + bonus : bonus) : ''}`, label, el)

/* ---------- списки (навыки, предметы, атаки…): добавить, убрать, переставить ---------- */
// ключ для v-for: у элементов файла нет своих id — запоминаем объект
const keys = new WeakMap()
let keySeq = 0
export const keyOf = o => (o && typeof o === 'object' ? keys.get(o) || (keys.set(o, ++keySeq), keySeq) : String(o))
export function listOps(path) {
  const arr = () => (val(path) || []).slice()
  return {
    add(item, { first = false } = {}) { const a = arr(); first ? a.unshift(item) : a.push(item); edit(path, a, { now: true }) },
    remove(i) { const a = arr(); a.splice(i, 1); edit(path, a, { now: true }) },
    set(a) { edit(path, a, { now: true }) }
  }
}
