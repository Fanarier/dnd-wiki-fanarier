// Походы отрядов по карте поселения (как в RimWorld): отряд ходит по округе, к краю карты — выходит на карту мира,
// с карты мира возвращается с того же края и идёт домой. Общее для сервера (время пути) и страницы (поиск пути, положение).
import { makeTerrain, B, WORLD, CENTER } from './terrainGen.js'
import { roadCurve, ROAD_TYPES } from './settlement.js'
import { segDist } from './geo.js'

export const HOME = [CENTER, CENTER]
export const HOME_R = 150 // м: ближе к центру — отряд дома
export const EDGE = 60 // м от края карты — отсюда выходят на карту мира
// скорость по местности — доля от темпа на карте мира (по дороге — полный темп). Вода — вброд и вплавь, очень медленно;
// поиск пути её обходит
export const SPEED = {
  [B.WATER]: 0.08, [B.SHORE]: 0.85, [B.SWAMP]: 0.3, [B.RAVINE]: 0.3, [B.ROCK]: 0.4,
  [B.FOREST]: 0.6, [B.CONIFER]: 0.55, [B.SHRUB]: 0.7, [B.MEADOW]: 0.85, [B.CUT]: 0.8
}
export const ROAD_SPEED = 1
const SLOW = 0.1 // медленнее — поиск пути туда не идёт

// всё, что нужно для скорости в точке: местность с вырубками и дороги (раскиданы по клеткам 100 м, чтобы искать быстро)
export function marchCtx(s) {
  const gen = makeTerrain(s.terrain)
  gen.setClearings(s.clearings || [])
  const CELL = 100, buckets = new Map()
  for (const r of s.roads || []) {
    const c = roadCurve(r), w = (ROAD_TYPES[r.type]?.w || 4) / 2 + 4
    for (let i = 1; i < c.length; i++) {
      const a = c[i - 1], b = c[i], seg = { a, b, w }
      for (let gx = Math.floor((Math.min(a[0], b[0]) - w) / CELL); gx <= Math.floor((Math.max(a[0], b[0]) + w) / CELL); gx++) {
        for (let gy = Math.floor((Math.min(a[1], b[1]) - w) / CELL); gy <= Math.floor((Math.max(a[1], b[1]) + w) / CELL); gy++) {
          const k = gx * 4096 + gy
          if (!buckets.has(k)) buckets.set(k, [])
          buckets.get(k).push(seg)
        }
      }
    }
  }
  const o = {}
  const onRoad = (x, y) => (buckets.get(Math.floor(x / CELL) * 4096 + Math.floor(y / CELL)) || []).some(g => segDist([x, y], g.a, g.b) < g.w)
  const speed = (x, y) => {
    if (x < 0 || y < 0 || x > WORLD || y > WORLD) return 0
    if (onRoad(x, y)) return ROAD_SPEED
    return SPEED[gen.sample(x, y, o).code] ?? 0.7
  }
  return { speed, onRoad }
}

// мс на метр при полном темпе: темп карты мира (км за игровой день) и длина игрового дня в настоящих часах
export const msPerMeter = st => ((st?.realHoursPerGameDay || 24) * 3600000) / ((st?.paceKmPerDay || 30) * 1000)

// длинные отрезки режем, чтобы время по местности считалось подробно и отряд на карте шёл ровно
export function densify(path, step = 80) {
  const out = [path[0]]
  for (let i = 1; i < path.length; i++) {
    const [ax, ay] = path[i - 1], [bx, by] = path[i], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step))
    for (let k = 1; k <= n; k++) out.push([Math.round((ax + ((bx - ax) * k) / n) * 10) / 10, Math.round((ay + ((by - ay) * k) / n) * 10) / 10])
  }
  return out
}

// время пути: местность берём через каждые ≤25 м; cum[i] — мс от начала до точки i
export function marchTiming(ctx, path, mpm) {
  const cum = [0]
  let t = 0
  for (let i = 1; i < path.length; i++) {
    const [ax, ay] = path[i - 1], [bx, by] = path[i], d = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.ceil(d / 25))
    for (let k = 0; k < n; k++) {
      const u = (k + 0.5) / n
      t += (d / n / Math.max(0.08, ctx.speed(ax + (bx - ax) * u, ay + (by - ay) * u))) * mpm
    }
    cum.push(Math.round(t))
  }
  return cum
}

// где отряд в момент now; i — с какой точки пути начинается непройденное
export function marchState(m, now) {
  if (!m?.path?.length || !m.cum?.length) return null
  const total = m.cum[m.cum.length - 1], el = now - m.startAt
  if (el >= total) { const p = m.path[m.path.length - 1]; return { x: p[0], y: p[1], progress: 1, done: true, i: m.path.length - 1, left: 0 } }
  if (el <= 0) return { x: m.path[0][0], y: m.path[0][1], progress: 0, done: false, i: 0, left: total }
  let lo = 0, hi = m.cum.length - 1
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (m.cum[mid] <= el) lo = mid; else hi = mid }
  const u = (el - m.cum[lo]) / Math.max(1, m.cum[hi] - m.cum[lo]), a = m.path[lo], b = m.path[hi]
  return { x: a[0] + (b[0] - a[0]) * u, y: a[1] + (b[1] - a[1]) * u, progress: el / total, done: false, i: hi, left: total - el }
}

// ближайшая к точке точка у края карты
export function edgePoint(x, y) {
  const c = v => Math.max(EDGE / 2, Math.min(WORLD - EDGE / 2, v))
  const d = [x, WORLD - x, y, WORLD - y], m = Math.min(...d)
  const e = EDGE / 3
  if (m === d[0]) return [e, c(y)]
  if (m === d[1]) return [WORLD - e, c(y)]
  if (m === d[2]) return [c(x), e]
  return [c(x), WORLD - e]
}
export const atEdge = (x, y) => x <= EDGE || y <= EDGE || x >= WORLD - EDGE || y >= WORLD - EDGE

// поиск пути по клеткам 50 м (A*): обходит воду и болота, тянется к дорогам. Клетки местности считаются по мере надобности.
// Вернёт точки пути или null, если не дойти
export function findPath(ctx, a, b, { cell = 50, maxIter = 250000 } = {}) {
  const N = Math.ceil(WORLD / cell), NN = N * N
  const idx = (x, y) => Math.min(N - 1, Math.max(0, Math.floor(y / cell))) * N + Math.min(N - 1, Math.max(0, Math.floor(x / cell)))
  const cost = new Float32Array(NN).fill(-1)
  const sp = i => {
    if (cost[i] < 0) { const v = ctx.speed(((i % N) + 0.5) * cell, (Math.floor(i / N) + 0.5) * cell); cost[i] = v < SLOW ? 0 : v }
    return cost[i]
  }
  const s0 = idx(a[0], a[1]), g0 = idx(b[0], b[1])
  cost[s0] = Math.max(sp(s0), 0.3) // из воды и болота выбраться можно
  cost[g0] = Math.max(sp(g0), 0.3)
  const gx = g0 % N, gy = Math.floor(g0 / N)
  const h = i => Math.hypot((i % N) - gx, Math.floor(i / N) - gy) * cell * 1.1 // чуть смелее эвристика — быстрее, путь почти тот же
  const g = new Float32Array(NN).fill(Infinity), from = new Int32Array(NN).fill(-1), shut = new Uint8Array(NN)
  // куча по f
  const hi = [], hf = []
  const push = (i, f) => {
    let n = hi.length
    hi.push(i); hf.push(f)
    while (n) { const p = (n - 1) >> 1; if (hf[p] <= f) break; hi[n] = hi[p]; hf[n] = hf[p]; n = p }
    hi[n] = i; hf[n] = f
  }
  const pop = () => {
    const top = hi[0], li = hi.pop(), lf = hf.pop()
    if (hi.length) {
      let n = 0
      for (;;) {
        const l = n * 2 + 1, r = l + 1
        let m = n, mf = lf
        if (l < hi.length && hf[l] < mf) { m = l; mf = hf[l] }
        if (r < hi.length && hf[r] < mf) m = r
        if (m === n) break
        hi[n] = hi[m]; hf[n] = hf[m]; n = m
      }
      hi[n] = li; hf[n] = lf
    }
    return top
  }
  g[s0] = 0
  push(s0, h(s0))
  const DX = [1, -1, 0, 0, 1, 1, -1, -1], DY = [0, 0, 1, -1, 1, -1, 1, -1]
  let it = 0, found = false
  while (hi.length && it++ < maxIter) {
    const i = pop()
    if (shut[i]) continue
    if (i === g0) { found = true; break }
    shut[i] = 1
    const x = i % N, y = Math.floor(i / N), vi = sp(i)
    for (let k = 0; k < 8; k++) {
      const nx = x + DX[k], ny = y + DY[k]
      if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue
      const j = ny * N + nx
      if (shut[j]) continue
      const vj = sp(j)
      if (!vj) continue
      if (k >= 4 && (!sp(y * N + nx) || !sp(ny * N + x))) continue // по диагонали мимо воды не срезаем
      const d = (k >= 4 ? Math.SQRT2 : 1) * cell * (0.5 / vi + 0.5 / vj)
      const ng = g[i] + d
      if (ng < g[j]) { g[j] = ng; from[j] = i; push(j, ng + h(j)) }
    }
  }
  if (!found) return null
  const cells = []
  for (let i = g0; i >= 0; i = from[i]) { cells.push(i); if (i === s0) break }
  cells.reverse()
  // распрямляем: прямой отрезок вместо ступенек, если по нему не дольше
  const lineCost = (i, j) => {
    const ax = ((cells[i] % N) + 0.5) * cell, ay = (Math.floor(cells[i] / N) + 0.5) * cell
    const bx = ((cells[j] % N) + 0.5) * cell, by = (Math.floor(cells[j] / N) + 0.5) * cell
    const d = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.ceil(d / (cell / 2)))
    let t = 0
    for (let k = 0; k < n; k++) {
      const v = sp(idx(ax + ((bx - ax) * (k + 0.5)) / n, ay + ((by - ay) * (k + 0.5)) / n))
      if (!v) return Infinity
      t += d / n / v
    }
    return t
  }
  const keep = [0]
  for (let i = 0; i < cells.length - 1;) {
    let j = Math.min(cells.length - 1, i + 24)
    while (j > i + 1 && lineCost(i, j) > (g[cells[j]] - g[cells[i]]) * 1.02) j--
    keep.push(j)
    i = j
  }
  const pts = keep.map(k => [((cells[k] % N) + 0.5) * cell, (Math.floor(cells[k] / N) + 0.5) * cell])
  pts[0] = [a[0], a[1]]
  pts[pts.length - 1] = [b[0], b[1]]
  return pts.map(p => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10])
}

// путь по точкам: в обход (поиск пути между соседними точками) или напрямую
export function planPath(ctx, points, auto) {
  if (!auto) return points
  const out = [points[0]]
  for (let i = 1; i < points.length; i++) {
    const p = findPath(ctx, points[i - 1], points[i])
    if (!p) return null
    out.push(...p.slice(1))
  }
  return out
}
