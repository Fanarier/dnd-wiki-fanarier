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
