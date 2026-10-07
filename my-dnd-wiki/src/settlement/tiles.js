// Плитки карты поселения: очередь, несколько фоновых потоков, кэш готовых картинок.
// Если фоновые потоки недоступны — рисуем на странице маленькими порциями.
import { renderTile, TILE } from './tileRender.js'
import { WORLD } from '../shared/terrainGen.js'

const MAX_CACHE = 220 // плиток в памяти (~256 КБ каждая)
const terrainKey = t => `${t?.seed ?? 1917}:${JSON.stringify(t?.params || {})}`
const clearKey = list => {
  let h = 2166136261
  for (const c of list) for (const v of [c.x, c.y, c.r]) h = Math.imul(h ^ Math.round(v * 10), 16777619)
  return (h >>> 0).toString(36) + '.' + list.length
}

export function createTileStore(onLoaded) {
  const cache = new Map() // key → { img, z, x, y, used }
  const inFlight = new Set() // плитки, которые сейчас рисуются
  let queue = []
  const workers = []
  let fallback = false
  try {
    if (typeof OffscreenCanvas === 'undefined' || !new OffscreenCanvas(1, 1).getContext('2d')) throw new Error()
    const n = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 1))
    for (let i = 0; i < n; i++) {
      const w = new Worker(new URL('./tileWorker.js', import.meta.url), { type: 'module' })
      w.busy = null
      w.onmessage = ({ data }) => done(w, data.id, data.bmp, data.error)
      w.onerror = () => { fallback = true; done(w, w.busy, null, 'поток упал') }
      workers.push(w)
    }
  } catch { fallback = true }

  function done(w, key, img, error) {
    w && (w.busy = null)
    inFlight.delete(key)
    if (img && !error) {
      const job = jobs.get(key)
      cache.set(key, { img, z: job?.z, x: job?.x, y: job?.y, used: performance.now() })
      trim()
      onLoaded?.()
    }
    jobs.delete(key)
    pump()
  }
  function trim() {
    if (cache.size <= MAX_CACHE) return
    const old = [...cache.entries()].sort((a, b) => a[1].used - b[1].used).slice(0, cache.size - MAX_CACHE)
    for (const [k, v] of old) { v.img.close?.(); cache.delete(k) }
  }
  const jobs = new Map()
  let pumping = false
  function pump() {
    if (fallback) {
      // на странице: по одной плитке за раз, чтобы не подвешивать интерфейс
      if (pumping || !queue.length) return
      pumping = true
      setTimeout(() => {
        pumping = false
        const job = queue.shift()
        if (!job) return
        const mk = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h })
        try { done(null, job.key, renderTile(job.terrain, job.z, job.x, job.y, job.clearings, mk(TILE, TILE), mk)) } catch (e) { done(null, job.key, null, e) }
        pump()
      }, 0)
      return
    }
    for (const w of workers) {
      if (w.busy || !queue.length) continue
      const job = queue.shift()
      w.busy = job.key
      inFlight.add(job.key)
      w.postMessage({ id: job.key, terrain: job.terrain, z: job.z, x: job.x, y: job.y, clearings: job.clearings })
    }
  }

  // ключ плитки: местность + вырубки, задевающие плитку
  function tileKey(terrain, clearings, z, x, y) {
    const T = WORLD / 2 ** z, x0 = x * T, y0 = y * T
    const near = (clearings || []).filter(c => c.x + c.r > x0 && c.x - c.r < x0 + T && c.y + c.r > y0 && c.y - c.r < y0 + T)
    return { key: `${terrainKey(terrain)}|${z}/${x}/${y}|${near.length ? clearKey(near) : '-'}`, near }
  }
  // нужные сейчас плитки (по порядку важности): недостающие встают в очередь, лишние задания выкидываются
  function want(terrain, clearings, list) {
    const plain = { seed: terrain?.seed ?? 1917, params: { ...(terrain?.params || {}) } }
    const out = []
    queue = []
    for (const t of list) {
      const { key, near } = tileKey(plain, clearings, t.z, t.x, t.y)
      const hit = cache.get(key)
      if (hit) hit.used = performance.now()
      out.push({ ...t, key, img: hit?.img || null })
      if (!hit && !inFlight.has(key)) {
        const job = { key, terrain: plain, clearings: near.map(c => ({ x: c.x, y: c.y, r: c.r })), z: t.z, x: t.x, y: t.y }
        queue.push(job)
        jobs.set(key, job)
      }
    }
    pump()
    return out
  }
  // что есть в кэше для этой плитки, если её саму ещё не нарисовали: ближайший предок
  function ancestor(terrain, clearings, z, x, y) {
    const plain = { seed: terrain?.seed ?? 1917, params: { ...(terrain?.params || {}) } }
    for (let az = z - 1, ax = x >> 1, ay = y >> 1; az >= 0; az--, ax >>= 1, ay >>= 1) {
      const hit = cache.get(tileKey(plain, clearings, az, ax, ay).key)
      if (hit) return { ...hit, z: az, x: ax, y: ay }
      // предок с другими вырубками тоже годится как временная подложка
      for (const [k, v] of cache) if (v.z === az && v.x === ax && v.y === ay && k.startsWith(terrainKey(plain) + '|')) return { ...v, z: az, x: ax, y: ay }
    }
    return null
  }
  const busy = () => queue.length + inFlight.size
  function destroy() {
    for (const w of workers) w.terminate()
    for (const v of cache.values()) v.img.close?.()
    cache.clear()
  }
  return { want, ancestor, busy, destroy }
}
