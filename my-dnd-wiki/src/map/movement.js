// Движение меток мастером: проложить путь, задать время или скорость, стоянки, что в конце, пауза.
// Расчёт положения — src/shared/geo.js (moveState); здесь — как правки превращаются в move и уходят на сервер.
import { store, act, km } from './store.js'
import { anomalyState, movePass, moveState, projectOnPath, segDist, dist } from '../shared/geo.js'

const HOUR = 3600000
export const MOVE_DEFAULTS = { smooth: true, face: 'none', end: 'stop', show: 'none', timing: 'time', total: 2 * HOUR, speed: 80, stops: [] }
export const END_MODES = [
  { v: 'stop', t: 'Остановиться в конце' }, { v: 'vanish', t: 'Исчезнуть в конце' },
  { v: 'pingpong', t: 'Туда и обратно (патруль)' }, { v: 'loop', t: 'По кругу' }
]
export const SHOW_MODES = [
  { v: 'none', t: 'Только саму метку' }, { v: 'trail', t: 'Метку и след за ней' },
  { v: 'path', t: 'Весь путь пунктиром' }, { v: 'eta', t: 'Весь путь и «прибудет через…»' }
]
export const FACE_MODES = [
  { v: 'none', t: 'Не поворачивать' }, { v: 'right', t: 'Поворачивать (иконка смотрит вправо)' }, { v: 'left', t: 'Поворачивать (иконка смотрит влево)' }
]

const waitsSum = m => movePass({ ...m, moveMs: 1000 }).waits.reduce((s, w) => s + w, 0)
// длина пути в км (как её видит мастер)
export const moveKm = m => km(movePass({ ...m, moveMs: 1000 }).g.total)
// сколько идёт сам ход (без стоянок): по времени — «дойдёт за» минус стоянки; по скорости — из км и темпа мира
export function moveMsFor(m) {
  if (m.timing === 'speed' && m.speed > 0) return Math.max(60000, (moveKm(m) / m.speed) * (store.data.settings.realHoursPerGameDay || 24) * HOUR)
  return Math.max(60000, (m.total || HOUR) - waitsSum(m))
}
// весь проход вместе со стоянками
export const passMsOf = m => movePass({ ...m, moveMs: moveMsFor(m) }).passMs

// правка уже идущего движения: метка остаётся на той же доле пути, дальше идёт по-новому
function rebase(old, next, now) {
  if (old?.startAt == null) return next
  const oldPass = movePass(old).passMs, newPass = movePass(next).passMs
  const t = (old.pausedAt ?? now) - old.startAt
  if (t <= 0) return next
  return { ...next, startAt: Math.round((old.pausedAt ?? now) - (t / oldPass) * newPass) }
}

export async function saveMove(a, patch, text) {
  const old = a.move || null
  let m = { ...MOVE_DEFAULTS, ...(old || {}), ...patch }
  m.stops = (m.stops || []).slice(0, m.path.length)
  m.moveMs = moveMsFor(m)
  if (!('startAt' in patch)) m = rebase(old, m, store.now)
  if ('startAt' in patch || 'path' in patch) m.arrived = false
  const body = { move: m }
  if (patch.path) Object.assign(body, { x: m.path[0][0], y: m.path[0][1], toX: null, toY: null })
  await act('PATCH', `/api/anomalies/${a.id}`, body, text).catch(() => {})
}

// новый путь от того места, где метка сейчас (настройки прошлого движения сохраняются)
export const here = a => { const s = anomalyState(a, store.now); return [Math.round(s.x * 10) / 10, Math.round(s.y * 10) / 10] }
export function setPath(a, pts, extra = {}) {
  if (pts.length < 2) return
  return saveMove(a, { path: pts, startAt: null, pausedAt: null, stops: [], ...extra }, 'Путь проложен — задай время и нажми «Отправить»')
}

// упростить ломаную (Дуглас — Пекер): путь по дороге — без сотен лишних точек
export function simplify(pts, eps = 1.2) {
  if (pts.length < 3) return pts
  let best = 0, at = 0
  for (let i = 1; i < pts.length - 1; i++) {
    const d = segDist(pts[i], pts[0], pts[pts.length - 1])
    if (d > best) { best = d; at = i }
  }
  if (best <= eps) return [pts[0], pts[pts.length - 1]]
  return [...simplify(pts.slice(0, at + 1), eps).slice(0, -1), ...simplify(pts.slice(at), eps)]
}

// стоянка там, куда кликнули на путь: в ближайшей точке пути или в новой точке на линии
export function addStopAt(a, w, tolerance) {
  const m = a.move
  const path = m.path.map(p => [...p]), stops = Array.from({ length: path.length }, (_, i) => m.stops?.[i] || 0)
  const ring = m.end === 'loop' ? [...path, path[0]] : path
  const near = path.findIndex(p => dist(p, w) <= tolerance)
  let k = near
  if (k < 0) {
    const pr = projectOnPath(ring, w)
    if (pr.d > tolerance * 2) return false
    // в каком отрезке точка проекции — туда и вставляем
    let seg = 1, best = Infinity
    for (let i = 1; i < ring.length; i++) { const d = segDist([pr.x, pr.y], ring[i - 1], ring[i]); if (d < best) { best = d; seg = i } }
    k = seg
    path.splice(k, 0, [Math.round(pr.x * 10) / 10, Math.round(pr.y * 10) / 10])
    stops.splice(k, 0, 0)
  }
  stops[k] = stops[k] || 3600000
  saveMove(a, { path, stops }, 'Стоянка добавлена — задай, сколько часов')
  return true
}

export const startMove = (a, at) => saveMove(a, { startAt: at ?? store.now, pausedAt: null }, at && at > store.now ? 'Отправка назначена' : 'Метка отправлена в путь')
export const restartMove = a => saveMove(a, { startAt: store.now, pausedAt: null }, 'Путь начат заново')
export const pauseMove = a => saveMove(a, { pausedAt: store.now }, 'Пауза')
export function resumeMove(a) {
  const m = a.move
  return saveMove(a, { startAt: m.startAt + (store.now - m.pausedAt), pausedAt: null }, 'Метка продолжила путь')
}
export function clearMove(a) {
  const [x, y] = here(a)
  return act('PATCH', `/api/anomalies/${a.id}`, { move: null, toX: null, toY: null, x, y }, 'Движение убрано — метка осталась, где была').catch(() => {})
}

// что показать про ход: «в пути, прибудет через…», «стоянка ещё…», «дошла»
export function moveStatus(a, now, fmtDuration) {
  const m = a.move
  if (!m) return ''
  const s = moveState(m, now)
  const loops = m.end === 'loop' || m.end === 'pingpong'
  switch (s.state) {
    case 'ready': return s.startsIn ? `выйдет через ${fmtDuration(s.startsIn)}` : 'ещё не отправлена'
    case 'paused': return 'на паузе'
    case 'waiting': return `стоянка ещё ${fmtDuration(s.waitLeft)}`
    case 'arrived': return 'на месте'
    case 'gone': return 'ушла'
    default: return loops ? (s.nextIn != null ? `до следующей точки ${fmtDuration(s.nextIn)}` : 'в пути') : `прибудет через ${fmtDuration(s.left)}`
  }
}
