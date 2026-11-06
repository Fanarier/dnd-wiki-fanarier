// Походы отрядов по карте поселения (как в RimWorld): отряд ходит по округе, к краю карты — выходит на карту мира,
// с карты мира возвращается с того же края и идёт домой. Общее для сервера (время пути) и страницы (поиск пути, положение).
import { makeTerrain, B, WORLD, CENTER } from './terrainGen.js'
import { roadCurve, ROAD_TYPES } from './settlement.js'
import { segDist } from './geo.js'

export const HOME = [CENTER, CENTER]
export const HOME_R = 150 // м: ближе к дому главы — отряд дома
// дом отряда — дом главы: постройка, где владелец — герой-глава, иначе двор старейшины, иначе центр
export function homeOf(s) {
  const placed = (s?.buildings || []).filter(b => b.x != null)
  const b = (s?.headHeroId && placed.find(b => b.owner === s.headHeroId)) || placed.find(b => b.type === 'elder')
  return b ? [b.x, b.y] : HOME
}
export const isHome = (s, [x, y]) => { const h = homeOf(s); return Math.hypot(x - h[0], y - h[1]) <= HOME_R }
// темп похода: мастер может ускорить (×2 … «сразу»)
export const SPEEDS = [{ v: 1, label: '×1' }, { v: 2, label: '×2' }, { v: 5, label: '×5' }, { v: 20, label: '×20' }, { v: 1000, label: 'сразу' }]
export const EDGE = 60 // м от края карты — отсюда выходят на карту мира
// скорость по местности — доля от темпа на карте мира (по дороге — полный темп). Вода — вброд и вплавь, очень медленно;
// поиск пути её обходит
export const SPEED = {
  [B.WATER]: 0.08, [B.SHORE]: 0.85, [B.SWAMP]: 0.3, [B.RAVINE]: 0.3, [B.ROCK]: 0.4,
  [B.FOREST]: 0.6, [B.CONIFER]: 0.55, [B.SHRUB]: 0.7, [B.MEADOW]: 0.85, [B.CUT]: 0.8
}
export const ROAD_SPEED = 1
const SLOW = 0.1 // медленнее — поиск пути туда не идёт
const OFFROAD = 2.2 // поиск пути: вне дороги «дороже» — отряд держится дорог, как живые люди

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
  // ближайшая точка на оси дороги не дальше maxD (или null) — путь ложится прямо на дорогу
  const roadPoint = (x, y, maxD) => {
    let best = null, bd = maxD
    const gx = Math.floor(x / CELL), gy = Math.floor(y / CELL)
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      for (const { a, b } of buckets.get((gx + i) * 4096 + gy + j) || []) {
        const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy
        const t = L ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L)) : 0
        const px = a[0] + dx * t, py = a[1] + dy * t, d = Math.hypot(x - px, y - py)
        if (d < bd) { bd = d; best = [px, py] }
      }
    }
    return best
  }
  const segs = [...new Set([...buckets.values()].flat())]
  return { speed, onRoad, roadPoint, segs, graph: roadGraph(s.roads || []) }
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
  // клетки, через которые идёт дорога (хоть краем): по ним — полный темп и без «штрафа» за бездорожье
  const road = new Uint8Array(NN)
  for (const { a, b } of ctx.segs || []) {
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (cell / 4)))
    for (let k = 0; k <= n; k++) road[idx(a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n)] = 1
  }
  const sp = i => {
    if (cost[i] < 0) { const v = road[i] ? ROAD_SPEED : ctx.speed(((i % N) + 0.5) * cell, (Math.floor(i / N) + 0.5) * cell); cost[i] = v < SLOW ? 0 : v }
    return cost[i]
  }
  const pen = i => (road[i] ? 1 : OFFROAD)
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
      const d = (k >= 4 ? Math.SQRT2 : 1) * cell * (0.5 * pen(i) / vi + 0.5 * pen(j) / vj)
      const ng = g[i] + d
      if (ng < g[j]) { g[j] = ng; from[j] = i; push(j, ng + h(j)) }
    }
  }
  if (!found) return null
  const cells = []
  for (let i = g0; i >= 0; i = from[i]) { cells.push(i); if (i === s0) break }
  cells.reverse()
  // распрямляем бездорожье: прямой отрезок вместо ступенек, если по нему не дольше; по дороге — точки на её оси
  const lineCost = (i, j) => {
    const ax = ((cells[i] % N) + 0.5) * cell, ay = (Math.floor(cells[i] / N) + 0.5) * cell
    const bx = ((cells[j] % N) + 0.5) * cell, by = (Math.floor(cells[j] / N) + 0.5) * cell
    const d = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.ceil(d / (cell / 2)))
    let t = 0
    for (let k = 0; k < n; k++) {
      const c = idx(ax + ((bx - ax) * (k + 0.5)) / n, ay + ((by - ay) * (k + 0.5)) / n), v = sp(c)
      if (!v || road[c]) return Infinity // дорогу не срезаем
      t += (d / n / v) * OFFROAD
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
  const pts = keep.map(k => {
    const x = ((cells[k] % N) + 0.5) * cell, y = (Math.floor(cells[k] / N) + 0.5) * cell
    return (road[cells[k]] && ctx.roadPoint?.(x, y, cell)) || [x, y]
  })
  pts[0] = [a[0], a[1]]
  pts[pts.length - 1] = [b[0], b[1]]
  return pts.map(p => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10])
}

// путь по точкам: в обход (поиск пути между соседними точками) или напрямую
export function planPath(ctx, points, auto) {
  if (!auto) return points
  const out = [points[0]]
  for (let i = 1; i < points.length; i++) {
    const p = routePath(ctx, points[i - 1], points[i])
    if (!p) return null
    out.push(...p.slice(1))
  }
  return out
}

/* ---------- граф дорог: идти точно по оси дороги, через стыки и перекрёстки ----------
   узлы — точки осей дорог через ~15 м, рёбра — вдоль дорог; конец дороги на другой дороге и пересечения связаны.
   Один граф и для отрядов (routePath), и для жителей на карте */
const STEP = 15
const graphCache = new WeakMap()
export function roadGraph(roads = []) {
  if (graphCache.has(roads)) return graphCache.get(roads)
  const nodes = [], adj = []
  const node = p => { nodes.push([p[0], p[1]]); adj.push([]); return nodes.length - 1 }
  const link = (i, j) => {
    if (i === j) return
    const d = Math.hypot(nodes[i][0] - nodes[j][0], nodes[i][1] - nodes[j][1])
    adj[i].push([j, d]); adj[j].push([i, d])
  }
  const lines = [] // { road, ids, w }
  for (const r of roads) {
    const c = roadCurve(r)
    if (c.length < 2) continue
    const ids = [node(c[0])]
    let acc = 0
    for (let i = 1; i < c.length; i++) {
      acc += Math.hypot(c[i][0] - c[i - 1][0], c[i][1] - c[i - 1][1])
      if (acc >= STEP || i === c.length - 1) { const k = node(c[i]); link(ids[ids.length - 1], k); ids.push(k); acc = 0 }
    }
    lines.push({ road: r, ids, w: ROAD_TYPES[r.type]?.w || 4 })
  }
  // все рёбра по корзинам 100 м — для стыков, пересечений и поиска ближайшей дороги
  const CELL = 100, buckets = new Map(), edges = []
  for (const L of lines) {
    for (let i = 1; i < L.ids.length; i++) {
      const e = { a: L.ids[i - 1], b: L.ids[i], line: L }
      edges.push(e)
      const [ax, ay] = nodes[e.a], [bx, by] = nodes[e.b]
      for (let gx = Math.floor(Math.min(ax, bx) / CELL); gx <= Math.floor(Math.max(ax, bx) / CELL); gx++) {
        for (let gy = Math.floor(Math.min(ay, by) / CELL); gy <= Math.floor(Math.max(ay, by) / CELL); gy++) {
          const k = gx * 4096 + gy
          if (!buckets.has(k)) buckets.set(k, [])
          buckets.get(k).push(e)
        }
      }
    }
  }
  const near = (x, y, rad = 1) => {
    const out = new Set(), gx = Math.floor(x / CELL), gy = Math.floor(y / CELL)
    for (let i = -rad; i <= rad; i++) for (let j = -rad; j <= rad; j++) for (const e of buckets.get((gx + i) * 4096 + gy + j) || []) out.add(e)
    return out
  }
  const project = (e, x, y) => {
    const [ax, ay] = nodes[e.a], [bx, by] = nodes[e.b], dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy
    const t = L ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L)) : 0
    const px = ax + dx * t, py = ay + dy * t
    return { e, t, x: px, y: py, d: Math.hypot(x - px, y - py) }
  }
  // конец дороги на другой дороге — связываем с ближайшим ребром той дороги (или её концом)
  for (const L of lines) {
    for (const end of [L.ids[0], L.ids[L.ids.length - 1]]) {
      const [x, y] = nodes[end]
      let best = null
      for (const e of near(x, y)) {
        if (e.line === L) continue
        const p = project(e, x, y)
        if (p.d <= e.line.w / 2 + 2.5 && (!best || p.d < best.d)) best = p
      }
      if (!best) continue
      if (best.t < 0.02) link(end, best.e.a)
      else if (best.t > 0.98) link(end, best.e.b)
      else { const k = node([best.x, best.y]); link(end, k); link(k, best.e.a); link(k, best.e.b) }
    }
  }
  // пересечения посреди дорог (перекрёсток «крестом»)
  const seen = new Set()
  for (const list of buckets.values()) {
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const e = list[i], f = list[j]
      if (e.line === f.line) continue
      const key = e.a < f.a ? `${e.a}:${f.a}` : `${f.a}:${e.a}`
      if (seen.has(key)) continue
      seen.add(key)
      const [x1, y1] = nodes[e.a], [x2, y2] = nodes[e.b], [x3, y3] = nodes[f.a], [x4, y4] = nodes[f.b]
      const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
      if (Math.abs(den) < 1e-9) continue
      const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den, u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / den
      if (t <= 0 || t >= 1 || u <= 0 || u >= 1) continue
      const k = node([x1 + t * (x2 - x1), y1 + t * (y2 - y1)])
      link(k, e.a); link(k, e.b); link(k, f.a); link(k, f.b)
    }
  }
  // ближайшие точки на дорогах к (x, y): по одной на дорогу, сначала ближние
  const nearest = (x, y, n = 4, maxD = 1500) => {
    const best = new Map()
    for (let rad = 1; rad <= Math.ceil(maxD / CELL); rad = rad * 2 + 1) {
      for (const e of near(x, y, rad)) {
        const p = project(e, x, y)
        if (p.d > maxD) continue
        const q = best.get(e.line)
        if (!q || p.d < q.d) best.set(e.line, p)
      }
      if (best.size >= n) break
    }
    return [...best.values()].sort((a, b) => a.d - b.d).slice(0, n)
  }
  const g = { nodes, adj, nearest }
  graphCache.set(roads, g)
  return g
}

// Дейкстра по графу дорог от входов (точка на ребре + цена дороги до неё) до выходов; null — не связаны
function roadLeg(g, starts, goals) {
  const N = g.nodes.length, dist = new Float64Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), from0 = new Int32Array(N).fill(-1)
  const heap = []
  const push = (i, d) => { heap.push([d, i]); let n = heap.length - 1; while (n) { const p = (n - 1) >> 1; if (heap[p][0] <= d) break; [heap[p], heap[n]] = [heap[n], heap[p]]; n = p } }
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let n = 0; for (;;) { const l = n * 2 + 1, r = l + 1; let m = n; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === n) break; [heap[m], heap[n]] = [heap[n], heap[m]]; n = m } } return top }
  starts.forEach((s, si) => {
    for (const v of [s.e.a, s.e.b]) {
      const d = s.cost + Math.hypot(g.nodes[v][0] - s.x, g.nodes[v][1] - s.y) / ROAD_SPEED
      if (d < dist[v]) { dist[v] = d; from0[v] = si; from[v] = -1; push(v, d) }
    }
  })
  while (heap.length) {
    const [d, i] = pop()
    if (d > dist[i]) continue
    for (const [j, w] of g.adj[i]) {
      const nd = d + w / ROAD_SPEED
      if (nd < dist[j]) { dist[j] = nd; from[j] = i; from0[j] = from0[i]; push(j, nd) }
    }
  }
  let best = null
  for (const t of goals) {
    for (const v of [t.e.a, t.e.b]) {
      if (dist[v] === Infinity) continue
      const total = dist[v] + Math.hypot(g.nodes[v][0] - t.x, g.nodes[v][1] - t.y) / ROAD_SPEED + t.cost
      if (!best || total < best.total) best = { total, v, t }
    }
    // вход и выход на одном ребре — прямо по нему
    for (const s of starts) {
      if (s.e !== t.e) continue
      const total = s.cost + Math.hypot(s.x - t.x, s.y - t.y) / ROAD_SPEED + t.cost
      if (!best || total < best.total) best = { total, direct: s, t }
    }
  }
  if (!best) return null
  if (best.direct) return { total: best.total, start: best.direct, goal: best.t, pts: [[best.direct.x, best.direct.y], [best.t.x, best.t.y]] }
  const chain = []
  for (let i = best.v; i >= 0; i = from[i]) chain.push(g.nodes[i])
  chain.reverse()
  const s = starts[from0[best.v]]
  return { total: best.total, start: s, goal: best.t, pts: [[s.x, s.y], ...chain, [best.t.x, best.t.y]] }
}

// цена пути «по времени»: бездорожье дороже (как в поиске пути), дорога — по полной скорости
export function pathCost(ctx, path) {
  let t = 0
  for (let i = 1; i < path.length; i++) {
    const [ax, ay] = path[i - 1], [bx, by] = path[i], d = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.ceil(d / 25))
    for (let k = 0; k < n; k++) {
      const x = ax + (bx - ax) * (k + 0.5) / n, y = ay + (by - ay) * (k + 0.5) / n
      const on = ctx.onRoad(x, y)
      t += (d / n) / Math.max(0.08, ctx.speed(x, y)) * (on ? 1 : OFFROAD)
    }
  }
  return t
}

// путь с учётом дорог: выйти на ближнюю дорогу, пройти по оси через стыки, сойти у цели — если так не дольше,
// чем по бездорожью. Иначе — поиск пути по местности. null — не дойти
export function routePath(ctx, a, b) {
  const direct = findPath(ctx, a, b)
  const directCost = direct ? pathCost(ctx, direct) : Infinity
  const g = ctx.graph
  if (!g?.nodes.length) return direct
  // подход к дороге: близко — по прямой, дальше — поиском пути
  const legTo = (from, p) => {
    const path = Math.hypot(from[0] - p.x, from[1] - p.y) < 40 ? [from, [p.x, p.y]] : findPath(ctx, from, [p.x, p.y])
    return path ? { ...p, path, cost: pathCost(ctx, path) } : null
  }
  const starts = g.nearest(a[0], a[1]).map(p => legTo(a, p)).filter(Boolean)
  const goals = g.nearest(b[0], b[1]).map(p => { const l = legTo(b, p); return l && { ...l, path: [...l.path].reverse() } }).filter(Boolean)
  if (!starts.length || !goals.length) return direct
  const leg = roadLeg(g, starts, goals)
  if (!leg || leg.total >= directCost) return direct
  const out = [...leg.start.path.slice(0, -1), ...leg.pts, ...leg.goal.path.slice(1)]
  return out.filter((p, i) => !i || Math.hypot(p[0] - out[i - 1][0], p[1] - out[i - 1][1]) > 0.05).map(p => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10])
}
