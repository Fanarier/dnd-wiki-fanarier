// Плитки карты поселения: очередь, несколько фоновых потоков, кэш готовых картинок.
// Если фоновые потоки недоступны — рисуем на странице маленькими порциями.
import { renderTile, TILE, TREES_FROM } from './tileRender.js'
import { WORLD } from '../shared/terrainGen.js'

const MAX_CACHE = 220 // плиток в памяти (~256 КБ каждая)
const terrainKey = t => `${t?.seed ?? 1917}:${JSON.stringify(t?.params || {})}`
const hashNums = (h, nums) => { for (const v of nums) h = Math.imul(h ^ Math.round(v * 10), 16777619); return h }
const nearKey = (clear, roads, boxes) => {
  let h = 2166136261
  for (const c of clear) h = hashNums(h, [c.x, c.y, c.r, c.tree ? 1 : 0])
  for (const r of roads) { h = hashNums(h, [r.w, r.pts.length]); for (const p of r.pts) h = hashNums(h, p) }
  for (const b of boxes) h = hashNums(h, [b.x, b.y, b.w])
  return (h >>> 0).toString(36) + '.' + clear.length + '.' + roads.length + '.' + boxes.length
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
        try { done(null, job.key, renderTile(job.terrain, job.z, job.x, job.y, job.clearings, mk(TILE, TILE), mk, job.near)) } catch (e) { done(null, job.key, null, e) }
        pump()
      }, 0)
      return
    }
    for (const w of workers) {
      if (w.busy || !queue.length) continue
      const job = queue.shift()
      w.busy = job.key
      inFlight.add(job.key)
      w.postMessage({ id: job.key, terrain: job.terrain, z: job.z, x: job.x, y: job.y, clearings: job.clearings, near: job.near })
    }
  }

  // ключ плитки: местность + вырубки, задевающие плитку; вблизи (отдельные деревья) — ещё дороги и постройки рядом
  // world = { terrain, clearings, roads: [{ w, pts, box }], boxes: [{ x, y, w, h }] }
  function tileKey(world, z, x, y) {
    const T = WORLD / 2 ** z, pad = 10, x0 = x * T - pad, y0 = y * T - pad, x1 = x0 + T + pad * 2, y1 = y0 + T + pad * 2
    const clear = (world.clearings || []).filter(c => c.x + c.r > x0 && c.x - c.r < x1 && c.y + c.r > y0 && c.y - c.r < y1)
    const detail = T / TILE < TREES_FROM
    const roads = detail ? (world.roads || []).filter(r => r.box[0] < x1 && r.box[2] > x0 && r.box[1] < y1 && r.box[3] > y0) : []
    const boxes = detail ? (world.boxes || []).filter(b => b.x < x1 && b.x + b.w > x0 && b.y < y1 && b.y + b.h > y0) : []
    const any = clear.length || roads.length || boxes.length
    return { key: `${terrainKey(world.terrain)}|${z}/${x}/${y}|${any ? nearKey(clear, roads, boxes) : '-'}`, clear, roads, boxes }
  }
  const plainTerrain = t => ({ seed: t?.seed ?? 1917, params: { ...(t?.params || {}) } })
  // нужные сейчас плитки (по порядку важности): недостающие встают в очередь, лишние задания выкидываются
  function want(world, list) {
    const w = { ...world, terrain: plainTerrain(world.terrain) }
    const out = []
    queue = []
    for (const t of list) {
      const { key, clear, roads, boxes } = tileKey(w, t.z, t.x, t.y)
      const hit = cache.get(key)
      if (hit) hit.used = performance.now()
      out.push({ ...t, key, img: hit?.img || null })
      if (!hit && !inFlight.has(key)) {
        const job = {
          key, terrain: w.terrain, z: t.z, x: t.x, y: t.y,
          clearings: clear.map(c => ({ x: c.x, y: c.y, r: c.r, ...(c.tree ? { tree: 1 } : {}) })),
          near: { roads: roads.map(r => ({ w: r.w, pts: r.pts.map(q => [+q[0], +q[1]]) })), boxes: boxes.map(b => ({ x: b.x, y: b.y, w: b.w, h: b.h })) }
        }
        queue.push(job)
        jobs.set(key, job)
      }
    }
    pump()
    return out
  }
  // что есть в кэше для этой плитки, если её саму ещё не нарисовали: ближайший предок
  function ancestor(world, z, x, y) {
    const w = { ...world, terrain: plainTerrain(world.terrain) }
    for (let az = z - 1, ax = x >> 1, ay = y >> 1; az >= 0; az--, ax >>= 1, ay >>= 1) {
      const hit = cache.get(tileKey(w, az, ax, ay).key)
      if (hit) return { ...hit, z: az, x: ax, y: ay }
      // предок с другими вырубками и дорогами тоже годится как временная подложка
      for (const [k, v] of cache) if (v.z === az && v.x === ax && v.y === ay && k.startsWith(terrainKey(w.terrain) + '|')) return { ...v, z: az, x: ax, y: ay }
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
