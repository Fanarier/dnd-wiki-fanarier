// Походы по карте поселения на странице: где отряд, куда он идёт, отправить в путь
import { ref, watch } from 'vue'
import { store, act, isMaster } from '../map/store.js'
import { homeOf, isHome, marchCtx, marchState, findPath, edgePoint } from '../shared/march.js'
import { OUTPOSTS, BUILDINGS } from '../shared/settlement.js'

// где отряд сейчас: { x, y, home } — дома (у дома главы); null — на карте мира
export function squadAt(s, qid, now = store.now) {
  const m = s.marches?.[qid]
  if (!m) { const h = homeOf(s); return { x: h[0], y: h[1], home: true } }
  if (m.away) return null
  return m.move ? marchState(m.move, now) : { x: m.x, y: m.y }
}
export const onWorld = (s, q) => !!q.partyId && (store.data.parties || []).some(p => p.id === q.partyId)

// подпись места: аванпост, постройка рядом или «дома»
export function spotLabel(s, [x, y]) {
  if (isHome(s, [x, y])) return 'Домой'
  const o = (s.outposts || []).find(o => Math.hypot(o.x - x, o.y - y) < 350)
  if (o) return OUTPOSTS[o.type]?.label || 'Аванпост'
  const b = (s.buildings || []).find(b => b.x != null && Math.hypot(b.x - x, b.y - y) < 80)
  if (b) return b.name || BUILDINGS[b.type]?.label
  return ''
}

// темп, который мастер выбрал последним (помним в этом браузере); кнопки «Домой» и «На карту мира» идут с ним же
export const marchSpeed = ref((() => { try { return Number(localStorage.getItem('anacaria-march-speed')) || 1 } catch { return 1 } })())
watch(marchSpeed, v => { try { localStorage.setItem('anacaria-march-speed', String(v)) } catch { /* приватный режим */ } })
export const sendMarch = (s, qid, path, { exit = false, label = '', speed = isMaster.value ? marchSpeed.value : 1 } = {}) =>
  act('POST', `/api/settlements/${s.id}/squads/${qid}/march`, { path, exit, label, speed }, exit ? 'Отряд идёт к краю округи — оттуда на карту мира' : 'Отряд выступил').catch(() => null)

// сразу в обход к точке (домой, к краю карты)
export function marchTo(s, qid, to, opt) {
  const from = squadAt(s, qid)
  if (!from) return null
  const path = findPath(marchCtx(s), [from.x, from.y], to) || [[from.x, from.y], to]
  return sendMarch(s, qid, path, opt)
}
export const marchHome = (s, qid) => marchTo(s, qid, homeOf(s), { label: 'Домой' })
export function marchOut(s, qid) {
  const from = squadAt(s, qid)
  return from && marchTo(s, qid, edgePoint(from.x, from.y), { exit: true })
}
// мастер: «прибыть сейчас» — отряд оказывается у цели
export const arriveNow = (s, qid) => act('POST', `/api/settlements/${s.id}/squads/${qid}/arrive`, {}, 'Отряд на месте').catch(() => null)
export const haltMarch = (s, qid) => act('POST', `/api/settlements/${s.id}/squads/${qid}/halt`, {}, 'Отряд остановился').catch(() => null)
