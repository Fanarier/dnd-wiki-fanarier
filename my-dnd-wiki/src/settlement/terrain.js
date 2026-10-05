// Местность поселения: рисуем в фоновом потоке (страница не подвисает), если браузер не умеет — по-старому
import { paintTerrainBlob } from './terrainPainter.js'

let worker = null
let seq = 0
const waiting = new Map()

function getWorker() {
  if (worker !== null) return worker
  try {
    if (typeof OffscreenCanvas === 'undefined' || !new OffscreenCanvas(1, 1).getContext('2d')) throw new Error('нет OffscreenCanvas')
    worker = new Worker(new URL('./terrainWorker.js', import.meta.url), { type: 'module' })
    worker.onmessage = ({ data }) => {
      const w = waiting.get(data.id)
      if (!w) return
      waiting.delete(data.id)
      data.blob ? w.res(data.blob) : w.rej(new Error(data.error))
    }
    worker.onerror = () => { for (const w of waiting.values()) w.rej(new Error('фоновый поток упал')); waiting.clear(); worker = false }
  } catch {
    worker = false
  }
  return worker
}

/* готовые картинки храним в кэше браузера: повторный заход — мгновенно; перерисовка, только если поменялась местность или постройки */
const CACHE = 'anacaria-terrain-v1'
function hash(str) {
  let a = 0x811c9dc5, b = 0x9e3779b9
  for (let i = 0; i < str.length; i++) { const ch = str.charCodeAt(i); a = Math.imul(a ^ ch, 16777619); b = Math.imul(b ^ ch, 2246822507) }
  return (a >>> 0).toString(36) + (b >>> 0).toString(36)
}
async function fromCache(key) {
  try { return await (await (await caches.open(CACHE)).match(key))?.blob() || null } catch { return null }
}
async function toCache(key, blob) {
  try {
    const c = await caches.open(CACHE)
    // держим последние несколько вариантов, остальное выбрасываем
    const old = await c.keys()
    for (const r of old.slice(0, Math.max(0, old.length - 3))) await c.delete(r)
    await c.put(key, new Response(blob, { headers: { 'content-type': 'image/png' } }))
  } catch { /* нет Cache API (http, приватный режим) — просто без кэша */ }
}

// вернёт blob-ссылку на картинку местности
export async function paintTerrain(s, scale = 2) {
  const plain = JSON.parse(JSON.stringify({ terrain: s.terrain, buildings: (s.buildings || []).map(({ id, type, x, y }) => ({ id, type, x, y })) }))
  const key = `/terrain-cache/${hash(JSON.stringify(plain))}-${scale}.png`
  const cached = await fromCache(key)
  if (cached) return URL.createObjectURL(cached)
  const w = getWorker()
  let blob
  if (w) {
    try {
      blob = await new Promise((res, rej) => { const id = ++seq; waiting.set(id, { res, rej }); w.postMessage({ id, s: plain, scale }) })
    } catch { blob = null }
  }
  if (!blob) blob = await paintTerrainBlob(plain, scale)
  toCache(key, blob)
  return URL.createObjectURL(blob)
}
