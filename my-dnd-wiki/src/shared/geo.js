// Геометрия карты. Используется и в браузере, и на сервере (без зависимостей).

export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1])

export function polyLength(pts) {
  let len = 0
  for (let i = 1; i < pts.length; i++) len += dist(pts[i - 1], pts[i])
  return len
}

// Точка на ломаной по доле пути 0..1 (+ направление движения в радианах)
export function pointAt(pts, frac) {
  if (!pts || !pts.length) return null
  if (pts.length === 1 || frac <= 0) return { x: pts[0][0], y: pts[0][1], angle: 0 }
  const total = polyLength(pts)
  let target = Math.min(1, frac) * total
  for (let i = 1; i < pts.length; i++) {
    const seg = dist(pts[i - 1], pts[i])
    if (target <= seg || i === pts.length - 1) {
      const t = seg ? Math.min(1, target / seg) : 1
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]
      return { x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t, angle: Math.atan2(y1 - y0, x1 - x0) }
    }
    target -= seg
  }
  const last = pts[pts.length - 1]
  return { x: last[0], y: last[1], angle: 0 }
}

// Обрезка ломаной до доли пути (для отрисовки пройденной части)
export function slicePath(pts, frac) {
  if (frac >= 1) return pts
  const total = polyLength(pts)
  let target = Math.max(0, frac) * total
  const out = [pts[0]]
  for (let i = 1; i < pts.length; i++) {
    const seg = dist(pts[i - 1], pts[i])
    if (target <= seg) {
      const t = seg ? target / seg : 0
      out.push([pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t])
      return out
    }
    out.push(pts[i])
    target -= seg
  }
  return out
}

// Оставшаяся часть ломаной после доли пути frac
export function remainingPath(pts, frac) {
  if (frac <= 0) return pts
  const done = slicePath(pts, frac)
  const cut = done[done.length - 1]
  return [cut, ...pts.slice(done.length - 1)].filter((p, i, arr) => i === 0 || p !== arr[i - 1])
}

export function segDist(p, a, b) {
  let x = a[0], y = a[1]
  const dx = b[0] - x, dy = b[1] - y
  if (dx || dy) {
    const t = Math.max(0, Math.min(1, ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy)))
    x += dx * t
    y += dy * t
  }
  return Math.hypot(p[0] - x, p[1] - y)
}

export function distToPolyline(p, pts, closed = false) {
  if (pts.length === 1) return dist(p, pts[0])
  let min = Infinity
  for (let i = 1; i < pts.length; i++) min = Math.min(min, segDist(p, pts[i - 1], pts[i]))
  if (closed && pts.length > 2) min = Math.min(min, segDist(p, pts[pts.length - 1], pts[0]))
  return min
}

export function pointInPolygon(p, poly) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j]
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

function bboxOf(shape) {
  if (!shape._bbox) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    for (const [x, y] of shape.points) {
      if (x < x0) x0 = x
      if (y < y0) y0 = y
      if (x > x1) x1 = x
      if (y > y1) y1 = y
    }
    const r = shape.r || 0
    Object.defineProperty(shape, '_bbox', { value: [x0 - r, y0 - r, x1 + r, y1 + r], enumerable: false })
  }
  return shape._bbox
}

export function shapeCovers(shape, p) {
  const [x0, y0, x1, y1] = bboxOf(shape)
  if (p[0] < x0 || p[0] > x1 || p[1] < y0 || p[1] > y1) return false
  if (shape.shape === 'poly') {
    return pointInPolygon(p, shape.points) || distToPolyline(p, shape.points, true) <= (shape.r || 0)
  }
  return distToPolyline(p, shape.points) <= shape.r
}

// Под туманом ли точка: решает последняя фигура (залить/стереть), которая её накрывает
export function isFogged(p, fog) {
  for (let i = fog.length - 1; i >= 0; i--) {
    if (shapeCovers(fog[i], p)) return fog[i].mode === 'add'
  }
  return false
}

// Положение отряда в момент now
export function journeyState(journey, now) {
  if (!journey || !journey.path || journey.path.length < 2) return null
  const { startAt, endAt } = journey
  const progress = now <= startAt ? 0 : now >= endAt ? 1 : (now - startAt) / (endAt - startAt)
  const pos = pointAt(journey.path, progress)
  return { ...pos, progress, waiting: now < startAt, done: now >= endAt }
}

export function partyPosition(party, now) {
  const j = journeyState(party.journey, now)
  return j ? { x: j.x, y: j.y, journey: j } : { x: party.x, y: party.y, journey: null }
}

// Активность и положение аномалии (может появляться/исчезать по времени и двигаться)
export function anomalyState(a, now) {
  const upcoming = a.activeFrom != null && now < a.activeFrom
  const expired = a.activeTo != null && now > a.activeTo
  let x = a.x, y = a.y
  if (a.toX != null && a.toY != null && a.activeFrom != null && a.activeTo != null && a.activeTo > a.activeFrom) {
    const t = Math.max(0, Math.min(1, (now - a.activeFrom) / (a.activeTo - a.activeFrom)))
    x = a.x + (a.toX - a.x) * t
    y = a.y + (a.toY - a.y) * t
  }
  return { active: !upcoming && !expired, upcoming, expired, x, y }
}

/* ---------- Дороги как граф: поиск маршрута по дорогам ---------- */

export function buildRoadGraph(roads) {
  const nodes = [] // [x, y]
  const adj = [] // [[to, w]]
  const MERGE = 1.5
  const grid = new Map()
  const key = (x, y) => `${Math.floor(x / 4)},${Math.floor(y / 4)}`
  function nodeFor(p) {
    const gx = Math.floor(p[0] / 4), gy = Math.floor(p[1] / 4)
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      for (const id of grid.get(`${gx + dx},${gy + dy}`) || []) if (dist(nodes[id], p) <= MERGE) return id
    }
    const id = nodes.length
    nodes.push([p[0], p[1]])
    adj.push([])
    const k = key(p[0], p[1])
    grid.set(k, [...(grid.get(k) || []), id])
    return id
  }
  for (const road of roads) {
    if (!road.points || road.points.length < 2) continue
    let prev = nodeFor(road.points[0])
    for (let i = 1; i < road.points.length; i++) {
      const cur = nodeFor(road.points[i])
      if (cur !== prev) {
        const w = dist(nodes[prev], nodes[cur]) * (road.type === 'trail' ? 1.15 : road.type === 'sea' ? 1.3 : 1)
        adj[prev].push([cur, w])
        adj[cur].push([prev, w])
      }
      prev = cur
    }
  }
  return { nodes, adj }
}

function nearestNode(graph, p) {
  let best = -1, bd = Infinity
  graph.nodes.forEach((n, i) => {
    const d = dist(n, p)
    if (d < bd) { bd = d; best = i }
  })
  return { id: best, d: bd }
}

// Маршрут из A в B: по дорогам, если обе точки рядом с дорогами; иначе по прямой
export function findRoute(graph, a, b, maxSnap = 40) {
  if (!graph.nodes.length) return { points: [a, b], byRoad: false }
  const s = nearestNode(graph, a), t = nearestNode(graph, b)
  if (s.d > maxSnap || t.d > maxSnap) return { points: [a, b], byRoad: false }
  const n = graph.nodes.length
  const D = new Float64Array(n).fill(Infinity)
  const prev = new Int32Array(n).fill(-1)
  const done = new Uint8Array(n)
  D[s.id] = 0
  // n небольшое (сотни узлов) — хватает простого O(n²)
  for (;;) {
    let u = -1, best = Infinity
    for (let i = 0; i < n; i++) if (!done[i] && D[i] < best) { best = D[i]; u = i }
    if (u === -1 || u === t.id) break
    done[u] = 1
    for (const [v, w] of graph.adj[u]) if (D[u] + w < D[v]) { D[v] = D[u] + w; prev[v] = u }
  }
  if (!isFinite(D[t.id])) return { points: [a, b], byRoad: false }
  const chain = []
  for (let v = t.id; v !== -1; v = prev[v]) chain.unshift(graph.nodes[v])
  const pts = []
  if (s.d > 0.5) pts.push(a)
  pts.push(...chain)
  if (t.d > 0.5) pts.push(b)
  return { points: pts.length > 1 ? pts : [a, b], byRoad: true }
}

/* ---------- Внешний вид ---------- */

// Детерминированный «рваный» контур аномалии
export function blobPath(cx, cy, r, seedStr = '', n = 22) {
  let h = 2166136261
  for (const ch of seedStr) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  const rnd = () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296
  const pts = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const rr = r * (0.78 + rnd() * 0.36)
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr])
  }
  // сглаживание: квадратичные кривые через середины рёбер
  const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]
  let d = `M${mid(pts[n - 1], pts[0]).map(v => v.toFixed(1)).join(',')}`
  for (let i = 0; i < n; i++) {
    const p = pts[i], m = mid(p, pts[(i + 1) % n])
    d += `Q${p[0].toFixed(1)},${p[1].toFixed(1)} ${m[0].toFixed(1)},${m[1].toFixed(1)}`
  }
  return d + 'Z'
}

export const toPath = pts => (pts && pts.length ? 'M' + pts.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L') : '')
