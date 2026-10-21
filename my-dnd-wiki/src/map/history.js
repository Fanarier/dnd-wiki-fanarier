// Правки карты у мастера: отмена и возврат (Ctrl+Z, Ctrl+Y / Ctrl+Shift+Z), копирование, вырезание, вставка,
// дубликат и удаление выбранного (Ctrl+C, Ctrl+X, Ctrl+V, Ctrl+D, Delete), сдвиг стрелками.
// Журнал пишет всё, что мастер меняет на карте: метки, города, аномалии, подписи, дороги, маршруты, отряды,
// государства и туман. Добавил — отмена убирает; изменил — возвращает прежние поля; удалил — возвращает объект
// под тем же id (ссылки НПС и заказов на него не рвутся). «Прежнее» берём из последнего состояния от сервера:
// перетаскивание и ползунки меняют карту ещё до сохранения.
import { reactive, toRaw } from 'vue'
import { store, api, toast, setHistoryHooks } from './store.js'

const MAP_COLS = ['states', 'labels', 'cities', 'roads', 'anomalies', 'parties', 'routes', 'fog']
const SNAP_COLS = MAP_COLS.filter(c => c !== 'fog')
export const COPYABLE = ['anomalies', 'cities', 'labels', 'roads', 'routes', 'parties']
const NAMES = {
  states: 'государство', labels: 'подпись', cities: 'город', roads: 'дорога', anomalies: 'метка',
  parties: 'отряд', routes: 'маршрут', fog: 'туман'
}
const LIMIT = 150

export const history = reactive({ undo: [], redo: [], busy: false })
let server = {} // как объекты лежат на сервере: col → Map(id → копия)
let replaying = false

const clone = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)))
const strip = it => { const { id, createdAt, ...rest } = clone(it); return rest }
const kindOf = (col, data) => (col === 'anomalies' ? (data?.kind === 'zone' ? 'аномалия' : 'метка') : NAMES[col])

function onState(data) {
  if (store.role !== 'master') { server = {}; history.undo.length = history.redo.length = 0; return }
  server = Object.fromEntries(SNAP_COLS.map(c => [c, new Map(structuredClone(toRaw(data[c]) || []).map(x => [x.id, x]))]))
}

function recorder(method, url, body) {
  if (replaying || store.role !== 'master') return null
  const m = /^\/api\/([a-z]+)(?:\/([^/?]+))?$/.exec(url)
  if (!m || !MAP_COLS.includes(m[1])) return null
  const [, col, id] = m
  if (method === 'POST' && !id) return res => { if (res?.id) push({ t: 'add', col, id: res.id, data: strip(res) }) }
  const was = id && (server[col]?.get(id) || (col === 'fog' ? store.data.fog?.find(f => f.id === id) : null))
  if (!was) return null
  if (method === 'PATCH') {
    const keys = Object.keys(body || {}).filter(k => was[k] !== undefined)
    if (!keys.length) return null
    const before = Object.fromEntries(keys.map(k => [k, clone(was[k])]))
    const after = Object.fromEntries(keys.map(k => [k, clone(body[k])]))
    return () => { Object.assign(was, clone(after)); push({ t: 'edit', col, id, before, after, data: { name: was.name || was.text, kind: was.kind } }, true) }
  }
  if (method === 'DELETE') {
    const data = strip(was)
    return () => { server[col]?.delete(id); push({ t: 'del', col, id, data }) }
  }
  return null
}
setHistoryHooks(recorder, onState)
if (store.ready) onState(toRaw(store.data))

// подряд идущие правки одного и того же (стрелки, ползунки) — одним шагом
function push(e, merge) {
  const last = history.undo.at(-1)
  const same = last && merge && last.t === 'edit' && last.col === e.col && last.id === e.id && Date.now() - last.at < 2000 &&
    Object.keys(last.after).join() === Object.keys(e.after).join()
  if (same) { last.after = e.after; last.at = Date.now() } else {
    history.undo.push({ ...e, at: Date.now() })
    if (history.undo.length > LIMIT) history.undo.shift()
  }
  history.redo.length = 0
}

function describe(e) {
  const nm = e.data?.name || e.data?.text
  const what = kindOf(e.col, e.data) + (nm ? ` «${nm}»` : '')
  if (e.t === 'add') return `добавление: ${what}`
  if (e.t === 'del') return `удаление: ${what}`
  const keys = Object.keys(e.after)
  return (keys.every(k => ['x', 'y', 'label'].includes(k)) ? 'перенос: ' : keys.includes('points') ? 'форма: ' : 'правка: ') + what
}

async function run(e, back) {
  const url = `/api/${e.col}`
  if (e.t === 'edit') { await api('PATCH', `${url}/${e.id}`, back ? e.before : e.after); return e.id }
  if ((e.t === 'add') !== back) {
    const it = await api('POST', url, { ...e.data, restoreId: e.id })
    // сервер не дал прежний id (занят) — переписываем его во всём журнале
    if (it.id !== e.id) for (const x of [...history.undo, ...history.redo]) if (x.col === e.col && x.id === e.id) x.id = it.id
    return it.id
  }
  await api('DELETE', `${url}/${e.id}`)
  return null
}
async function step(back) {
  if (history.busy || store.role !== 'master') return
  const from = back ? history.undo : history.redo
  const e = from.pop()
  if (!e) return toast(back ? 'Отменять нечего' : 'Возвращать нечего')
  history.busy = true
  replaying = true
  try {
    const id = await run(e, back)
    ;(back ? history.redo : history.undo).push(e)
    if (e.col !== 'fog') store.selection = id ? { type: e.col, id } : store.selection?.id === e.id ? null : store.selection
    toast(`${back ? '↶ Отменено' : '↷ Возвращено'} — ${describe(e)}`)
  } catch (err) {
    toast(err.message, 'error')
  } finally {
    replaying = false
    history.busy = false
  }
}
export const undo = () => step(true)
export const redo = () => step(false)

/* ---------- буфер обмена: копия объекта (живёт и между вкладками) ---------- */
const CLIP_KEY = 'anacaria-map-clip'
function readClip() { try { return JSON.parse(localStorage.getItem(CLIP_KEY) || 'null') } catch { return null } }
function selected() {
  const s = store.selection
  if (!s || !COPYABLE.includes(s.type)) return null
  return store.data[s.type]?.find(x => x.id === s.id) || null
}
export function copySelected(cut = false) {
  const it = selected()
  if (!it) return false
  const data = strip(it)
  if (store.selection.type === 'parties') { data.members = []; delete data.squad; delete data.journey }
  try { localStorage.setItem(CLIP_KEY, JSON.stringify({ col: store.selection.type, data })) } catch { /* без памяти браузера — не страшно */ }
  memClip = { col: store.selection.type, data }
  if (cut) removeSelected(true)
  else toast(`Скопировано: ${kindOf(memClip.col, data)}${data.name || data.text ? ` «${data.name || data.text}»` : ''} — Ctrl+V вставит под курсор`)
  return true
}
let memClip = null

// центр объекта: у точки — она сама, у линии — середина охвата
function centerOf(d) {
  if (!d.points?.length) return [d.x, d.y]
  const xs = d.points.map(p => p[0]), ys = d.points.map(p => p[1])
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]
}
const r1 = v => Math.round(v * 10) / 10
function moved(d, dx, dy) {
  const out = clone(d)
  if (out.points) out.points = out.points.map(([x, y]) => [r1(x + dx), r1(y + dy)])
  if (out.x != null) { out.x = r1(out.x + dx); out.y = r1(out.y + dy) }
  if (out.toX != null) { out.toX = r1(out.toX + dx); out.toY = r1(out.toY + dy) }
  return out
}
async function place(col, data, at, text) {
  const c = centerOf(data)
  // курсор над шапкой или панелью — ставим на ближайший край карты
  const { width = 2048, height = 1024 } = store.data.settings || {}
  if (at) at = [Math.min(width - 10, Math.max(10, at[0])), Math.min(height - 10, Math.max(10, at[1]))]
  const [dx, dy] = at ? [at[0] - c[0], at[1] - c[1]] : [14, 14]
  try {
    const it = await api('POST', `/api/${col}`, moved(data, dx, dy))
    store.selection = { type: col, id: it.id }
    store.tool = 'select'
    toast(text)
  } catch (e) { toast(e.message, 'error') }
}
// at — точка карты под курсором; без неё — рядом с оригиналом
export function paste(at) {
  const c = readClip() || memClip
  if (!c?.col || !COPYABLE.includes(c.col)) return toast('Буфер пуст — выбери объект на карте и нажми Ctrl+C')
  return place(c.col, c.data, at, `Вставлено: ${kindOf(c.col, c.data)} — Ctrl+Z уберёт`)
}
export function duplicateSelected() {
  const it = selected()
  if (!it) return false
  const data = strip(it)
  if (store.selection.type === 'parties') { data.members = []; delete data.squad; delete data.journey }
  place(store.selection.type, data, null, 'Дубликат готов — Ctrl+Z уберёт')
  return true
}
export async function removeSelected(cut = false) {
  const s = store.selection
  const it = s && [...COPYABLE, 'fog'].includes(s.type) && store.data[s.type]?.find(x => x.id === s.id)
  if (!it) return false
  try {
    await api('DELETE', `/api/${s.type}/${s.id}`)
    store.selection = null
    toast(`${cut ? 'Вырезано' : 'Удалено'}: ${kindOf(s.type, it)}${it.name || it.text ? ` «${it.name || it.text}»` : ''} — Ctrl+Z вернёт`)
  } catch (e) { toast(e.message, 'error') }
  return true
}

// стрелки: сдвиг выбранного на 1 пиксель карты (с Shift — на 10); на сервер — когда отпустил
let nudgeTimer = 0
export function nudgeSelected(dx, dy) {
  const it = selected()
  if (!it) return false
  const s = store.selection
  if (it.points) it.points = it.points.map(([x, y]) => [r1(x + dx), r1(y + dy)])
  else { it.x = r1(it.x + dx); it.y = r1(it.y + dy) }
  clearTimeout(nudgeTimer)
  nudgeTimer = setTimeout(() => {
    const body = it.points ? { points: it.points } : { x: it.x, y: it.y }
    api('PATCH', `/api/${s.type}/${it.id}`, body).catch(e => toast(e.message, 'error'))
  }, 350)
  return true
}
