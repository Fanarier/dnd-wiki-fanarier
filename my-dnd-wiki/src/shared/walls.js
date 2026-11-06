// Стены поселения. Стена — ломаная из точек (метры) с видом (частокол / камень); строится от первой точки
// к последней (built — сколько метров уже стоит). На линии сидят фрагменты: ворота, калитка, башня
// (s — расстояние вдоль стены от её начала). Общий модуль: им считают и страница, и сервер.

export const SPAN = 5 // пролёт, м — так стена рисуется и так удобно считать цену

// perM — материалы на метр, work — очков стройки на метр, defense — защиты на метр, w — толщина, м
export const WALL_TYPES = {
  palisade: { label: 'Частокол', short: 'частокол', done: 'достроен', w: 1.2, perM: { wood: 0.6, build: 0.1 }, work: 0.5, defense: 0.12 },
  stone: { label: 'Каменная стена', short: 'камень', done: 'достроена', w: 2.4, perM: { stone: 2, build: 0.3, wood: 0.1 }, work: 2, defense: 0.35 }
}

// фрагменты на стене: len — ширина проёма (ворота и калитка вырезают кусок стены), work — очков стройки
export const WALL_FEATURES = {
  gate: { label: 'Ворота', len: 5, work: 40, defense: 1, price: { wood: 40, iron: 5, build: 10 } },
  wicket: { label: 'Калитка', len: 1.5, work: 10, defense: 0, price: { wood: 10, iron: 1 } },
  tower: { label: 'Башня', len: 0, side: 5, work: 60, defense: 6, price: { wood: 60, build: 15 }, stonePrice: { stone: 80, wood: 20, build: 20 } }
}
// замкнутое кольцо целиком построенных стен защищает лучше
export const CLOSED_BONUS = 0.25

export const featurePrice = (kind, wallType) => (kind === 'tower' && wallType === 'stone' ? WALL_FEATURES.tower.stonePrice : WALL_FEATURES[kind]?.price) || {}

// стена достроена (построенное хранится с точностью 0,1 м)
export const wallDone = w => (w.built ?? Infinity) >= wallLength(w.points) - 0.1

export function wallLength(points = []) {
  let n = 0
  for (let i = 1; i < points.length; i++) n += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1])
  return n
}

// цена участка стены длиной len: округляем вверх до целых
export function wallPrice(type, len) {
  const t = WALL_TYPES[type] || WALL_TYPES.palisade
  return Object.fromEntries(Object.entries(t.perM).map(([k, v]) => [k, Math.ceil(v * len)]))
}
export const wallWork = (type, len) => (WALL_TYPES[type] || WALL_TYPES.palisade).work * len

// точка на расстоянии s от начала и направление стены там (радианы)
export function pointAt(points, s) {
  let left = Math.max(0, s)
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1], [bx, by] = points[i]
    const d = Math.hypot(bx - ax, by - ay)
    if (left <= d || i === points.length - 1) {
      const t = d ? Math.min(1, left / d) : 0
      return { x: ax + (bx - ax) * t, y: ay + (by - ay) * t, angle: Math.atan2(by - ay, bx - ax) }
    }
    left -= d
  }
  const p = points[0] || [0, 0]
  return { x: p[0], y: p[1], angle: 0 }
}

// кусок ломаной между расстояниями a и b (для рисования построенной части и проёмов)
export function slice(points, a, b) {
  if (b <= a || points.length < 2) return []
  const out = []
  let run = 0
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1], [bx, by] = points[i]
    const d = Math.hypot(bx - ax, by - ay)
    const s0 = run, s1 = run + d
    run = s1
    if (s1 < a || s0 > b || !d) continue
    const at = s => [ax + (bx - ax) * ((s - s0) / d), ay + (by - ay) * ((s - s0) / d)]
    if (!out.length) out.push(at(Math.max(a, s0)))
    out.push(at(Math.min(b, s1)))
  }
  return out
}

// ближайшая точка стены к (x, y): { wall, s, x, y, dist }
export function nearestWall(walls, x, y) {
  let best = null
  for (const w of walls || []) {
    let run = 0
    const pts = w.points || []
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i]
      const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy)
      const t = len ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (len * len))) : 0
      const px = ax + dx * t, py = ay + dy * t, d = Math.hypot(x - px, y - py)
      if (!best || d < best.dist) best = { wall: w, s: run + len * t, x: px, y: py, dist: d }
      run += len
    }
  }
  return best
}

// проёмы стены (ворота и калитки): [[от, до]] по длине
export const openings = w => (w.features || []).filter(f => WALL_FEATURES[f.kind]?.len).map(f => {
  const h = WALL_FEATURES[f.kind].len / 2
  return [f.s - h, f.s + h]
})
const featureBuilt = (w, f) => (f.state || 'built') === 'built' && (w.built ?? Infinity) >= f.s

// стены, которые вместе образуют кольцо: концы стен — узлы, стены — рёбра; цикл есть, если рёбер не меньше узлов
export function closedWalls(walls) {
  const nodes = []
  const nodeOf = p => {
    let i = nodes.findIndex(q => Math.hypot(q[0] - p[0], q[1] - p[1]) < 1.5)
    if (i < 0) { nodes.push(p); i = nodes.length - 1 }
    return i
  }
  const edges = (walls || []).filter(w => (w.points || []).length > 1).map(w => ({ w, a: nodeOf(w.points[0]), b: nodeOf(w.points[w.points.length - 1]) }))
  const parent = nodes.map((_, i) => i)
  const find = i => (parent[i] === i ? i : (parent[i] = find(parent[i])))
  for (const e of edges) parent[find(e.a)] = find(e.b)
  const comp = {}
  nodes.forEach((_, i) => { const r = find(i); (comp[r] ||= { n: 0, e: 0 }).n++ })
  for (const e of edges) comp[find(e.a)].e++
  return new Set(edges.filter(e => comp[find(e.a)].e >= comp[find(e.a)].n).map(e => e.w.id))
}

// защита от стен: построенные метры (без проёмов) × защита вида, башни и ворота; кольцо целиком готово — бонус
export function wallDefense(walls) {
  const ring = closedWalls(walls)
  const ringReady = [...ring].every(id => {
    const w = walls.find(x => x.id === id)
    return w && wallDone(w)
  })
  let total = 0
  for (const w of walls || []) {
    const t = WALL_TYPES[w.type] || WALL_TYPES.palisade
    const len = wallLength(w.points)
    const built = Math.min(len, w.built ?? len)
    const gaps = openings(w).reduce((n, [a, b]) => n + Math.max(0, Math.min(b, built) - Math.max(a, 0)), 0)
    let d = Math.max(0, built - gaps) * t.defense
    for (const f of w.features || []) if (featureBuilt(w, f)) d += WALL_FEATURES[f.kind]?.defense || 0
    if (ring.has(w.id) && ringReady) d *= 1 + CLOSED_BONUS
    total += d
  }
  return Math.round(total)
}

// где дороги пересекают стены: { wall, s, x, y, gate } — gate: есть ли там ворота или калитка
export function roadCrossings(walls, roads, curveOf) {
  const out = []
  for (const w of walls || []) {
    const wp = w.points || []
    for (const r of roads || []) {
      const rp = curveOf(r)
      for (let i = 1; i < wp.length; i++) {
        const [ax, ay] = wp[i - 1], [bx, by] = wp[i]
        const base = wallLength(wp.slice(0, i))
        for (let j = 1; j < rp.length; j++) {
          const [cx, cy] = rp[j - 1], [dx, dy] = rp[j]
          const den = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx)
          if (!den) continue
          const t = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / den
          const u = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / den
          if (t < 0 || t > 1 || u < 0 || u > 1) continue
          const s = base + t * Math.hypot(bx - ax, by - ay)
          if (out.some(o => o.wall === w && Math.abs(o.s - s) < 3)) continue
          const gate = openings(w).some(([a, b]) => s >= a - 1.5 && s <= b + 1.5)
          out.push({ wall: w, s, x: ax + (bx - ax) * t, y: ay + (by - ay) * t, gate })
        }
      }
    }
  }
  return out
}

// плавная линия стены (как у дорог — сплайн через точки, отрезки ~2 м), но острый угол (поворот круче 45°)
// остаётся углом: угловую башню или прямоугольный острог не скругляем
const curveCache = new WeakMap()
export function wallCurve(points) {
  if (!points || points.length < 3) return points || []
  if (curveCache.has(points)) return curveCache.get(points)
  const pieces = []
  let cur = [points[0]]
  for (let i = 1; i < points.length; i++) {
    cur.push(points[i])
    if (i < points.length - 1) {
      const a = points[i - 1], b = points[i], c = points[i + 1]
      let d = Math.abs(Math.atan2(c[1] - b[1], c[0] - b[0]) - Math.atan2(b[1] - a[1], b[0] - a[0]))
      if (d > Math.PI) d = 2 * Math.PI - d
      if (d > (45 * Math.PI) / 180) { pieces.push(cur); cur = [points[i]] }
    }
  }
  pieces.push(cur)
  const out = []
  for (const p of pieces) {
    const c = catmull(p)
    out.push(...(out.length ? c.slice(1) : c))
  }
  curveCache.set(points, out)
  return out
}
const catmull = smoothLine
// плавная линия через точки — центростремительный Катмулл — Ром: не даёт петель и «перелётов» на поворотах,
// даже когда соседние отрезки сильно разной длины. Отрезки ~2 м
export function smoothLine(pts) {
  if (!pts || pts.length < 3) return pts || []
  const P = i => {
    // за концами — отражение соседней точки
    if (i < 0) return [2 * pts[0][0] - pts[1][0], 2 * pts[0][1] - pts[1][1]]
    if (i >= pts.length) { const a = pts[pts.length - 1], b = pts[pts.length - 2]; return [2 * a[0] - b[0], 2 * a[1] - b[1]] }
    return pts[i]
  }
  const knot = (a, b) => Math.max(1e-4, Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1])))
  const lerp = (a, b, ta, tb, t) => { const k = (t - ta) / (tb - ta); return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k] }
  const out = [pts[0]]
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2)
    const t0 = 0, t1 = t0 + knot(p0, p1), t2 = t1 + knot(p1, p2), t3 = t2 + knot(p2, p3)
    const n = Math.max(2, Math.min(60, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 2)))
    for (let k = 1; k <= n; k++) {
      const t = t1 + ((t2 - t1) * k) / n
      const A1 = lerp(p0, p1, t0, t1, t), A2 = lerp(p1, p2, t1, t2, t), A3 = lerp(p2, p3, t2, t3, t)
      const B1 = lerp(A1, A2, t0, t2, t), B2 = lerp(A2, A3, t1, t3, t)
      out.push(lerp(B1, B2, t1, t2, t))
    }
  }
  return out
}

// стены как препятствие для пеших: построенные куски без проёмов (ворота и калитки — проходы).
// crosses(a, b) — пересекает ли отрезок стену; gates — проходы с точками по обе стороны (in / out)
export function wallBarrier(walls = []) {
  const segs = []
  const gates = []
  for (const w of walls) {
    const len = wallLength(w.points), built = Math.min(len, w.built ?? len)
    const gaps = openings(w).sort((a, b) => a[0] - b[0])
    let a = 0
    const pieces = []
    for (const [g0, g1] of gaps) { if (g0 > a) pieces.push([a, g0]); a = Math.max(a, g1) }
    if (a < len) pieces.push([a, len])
    for (const [p0, p1] of pieces) {
      if (built <= p0) continue
      const pts = slice(w.points, p0, Math.min(p1, built))
      for (let i = 1; i < pts.length; i++) segs.push([pts[i - 1], pts[i]])
    }
    for (const f of w.features || []) {
      if (!WALL_FEATURES[f.kind]?.len) continue
      const p = pointAt(w.points, f.s), nx = -Math.sin(p.angle), ny = Math.cos(p.angle)
      gates.push({ x: p.x, y: p.y, in: [p.x + nx * 5, p.y + ny * 5], out: [p.x - nx * 5, p.y - ny * 5] })
    }
  }
  // отрезки стен по клеткам 50 м — проверка быстрая
  const CELL = 50, cells = new Map()
  segs.forEach(([a, b], i) => {
    for (let gx = Math.floor(Math.min(a[0], b[0]) / CELL); gx <= Math.floor(Math.max(a[0], b[0]) / CELL); gx++) {
      for (let gy = Math.floor(Math.min(a[1], b[1]) / CELL); gy <= Math.floor(Math.max(a[1], b[1]) / CELL); gy++) {
        const k = gx * 8192 + gy
        if (!cells.has(k)) cells.set(k, [])
        cells.get(k).push(i)
      }
    }
  })
  const hit = (a, b, c, d) => {
    const den = (a[0] - b[0]) * (c[1] - d[1]) - (a[1] - b[1]) * (c[0] - d[0])
    if (Math.abs(den) < 1e-9) return false
    const t = ((a[0] - c[0]) * (c[1] - d[1]) - (a[1] - c[1]) * (c[0] - d[0])) / den, u = -((a[0] - b[0]) * (a[1] - c[1]) - (a[1] - b[1]) * (a[0] - c[0])) / den
    return t > 0.001 && t < 0.999 && u >= 0 && u <= 1
  }
  const crosses = (a, b) => {
    if (!segs.length) return false
    const x0 = Math.floor(Math.min(a[0], b[0]) / CELL), x1 = Math.floor(Math.max(a[0], b[0]) / CELL)
    const y0 = Math.floor(Math.min(a[1], b[1]) / CELL), y1 = Math.floor(Math.max(a[1], b[1]) / CELL)
    if ((x1 - x0 + 1) * (y1 - y0 + 1) > 600) return segs.some(([c, d]) => hit(a, b, c, d))
    const seen = new Set()
    for (let gx = x0; gx <= x1; gx++) for (let gy = y0; gy <= y1; gy++) {
      for (const i of cells.get(gx * 8192 + gy) || []) {
        if (seen.has(i)) continue
        seen.add(i)
        if (hit(a, b, segs[i][0], segs[i][1])) return true
      }
    }
    return false
  }
  return { crosses, gates, empty: !segs.length }
}
