// Войско поселения: гарнизон (15 слотов), отряды-караваны, обучение, лечебница и помощник боя.
// Общий модуль для сервера и страницы.
//
// s.army = {
//   stats: { [раса]: { atk, def, hp, ini } } — статы одного воина расы (мастер заполняет один раз)
//   garrison: [слот × 15] — слот: { race, count, talents: [{ id, note, atk, def, hp, ini }] } или null
//   squads: [{ id, name, commander: слот, lines: { van: [3], mid: [3], rear: [3] }, wagons: [3], packs: [3],
//              partyId, status: home | out, task, taskProgress, ready, fatigue }]
//     слот отряда: { race, count } | { asset: id } (актив — один и со своим стат-блоком) | { hero: id, stats } (только командир)
//     обоз: { label, count, capacity } — повозки и вьючные животные стопками, переносимость одной вписывает мастер
//   squadLimits: { [тип поселения]: число } — сколько отрядов можно; training: [{ id, race, count, days, done, talent?, sex? }]
// }
// s.hospital = [{ id, who: { race } | { asset } | { hero } | { name }, count, disease, treatment, treatmentBy, progress }]
import { RACES, computeSettlement } from './settlement.js'
import { WALL_TYPES, closedWalls, wallDone } from './walls.js'

export const STATS = { atk: 'Атака', def: 'Защита', hp: 'Хиты', ini: 'Инициатива' }
export const GARRISON_SLOTS = 15
export const SLOT_GROUPS = [
  { from: 0, to: 5, need: null, label: 'Слоты 1–5' },
  { from: 5, to: 10, need: 'palisade', label: 'Слоты 6–10', lock: 'Обнеси поселение кольцом частокола — замкнутым и целиком построенным' },
  { from: 10, to: 15, need: 'stone', label: 'Слоты 11–15', lock: 'Нужно кольцо каменной стены — замкнутое и целиком построенное' }
]
// линии отряда: какой стат усиливают
export const LINES = {
  van: { label: 'Авангард', stat: 'ini', bonus: 2 },
  mid: { label: 'Центр', stat: 'def', bonus: 2 },
  rear: { label: 'Арьергард', stat: 'atk', bonus: 2 }
}
export const LINE_SLOTS = 3
export const CARGO_SLOTS = 3
export const TRAIN_DAYS = 120 // сезон
export const DEFAULT_SQUAD_LIMITS = { 'Лагерь': 1, 'Деревня': 2, 'Посёлок': 3, 'Город': 4 }
export const HEAL_STEP = 10 // полоска выздоровления — 10 сегментов
export const BEDS_PER_HEALER = 2

// есть ли кольцо стен этого вида (или лучше), целиком построенное
function ring(s, types) {
  const ws = (s.walls || []).filter(w => types.includes(w.type) && wallDone(w))
  return closedWalls(ws).size > 0
}
export function openSlots(s) {
  if (ring(s, ['stone'])) return 15
  if (ring(s, ['palisade', 'stone'])) return 10
  return 5
}
export const wallName = t => WALL_TYPES[t]?.label || t

/* ---------- статы ---------- */
const NUM = v => Math.max(0, Math.round(Number(v) || 0))
export const hasStats = st => !!st && Object.keys(STATS).every(k => Number(st[k]) > 0)
// расы, у которых есть боевые, но не заполнены статы
export const missingRaceStats = s => (s.races || []).filter(r => (r.combat || 0) > 0 && !hasStats(s.army?.stats?.[r.race])).map(r => r.race)

// боевые воины расы: сколько всего, сколько уже стоит в гарнизоне и отрядах
export function combatUse(s) {
  const out = {}
  for (const r of s.races || []) out[r.race] = { total: r.combat || 0, used: 0 }
  const take = sl => { if (sl?.race && out[sl.race]) out[sl.race].used += NUM(sl.count) }
  for (const sl of s.army?.garrison || []) take(sl)
  for (const q of s.army?.squads || []) for (const l of Object.keys(LINES)) for (const sl of q.lines?.[l] || []) take(sl)
  for (const r of Object.values(out)) r.free = Math.max(0, r.total - r.used)
  return out
}

// воин в слоте → { name, count, atk, def, hp, ini, kind, ok } (ok — статы заполнены)
export function unitOf(s, slot, assets = s.assets || [], heroes = []) {
  if (!slot) return null
  if (slot.asset) {
    const a = assets.find(x => x.id === slot.asset)
    const st = a?.stats || {}
    return { kind: 'asset', id: slot.asset, name: a?.name || 'Актив', count: 1, atk: NUM(st.atk), def: NUM(st.def), hp: NUM(st.hp), ini: NUM(st.ini), ok: hasStats(st), dead: !!a?.dead }
  }
  if (slot.hero) {
    const h = heroes.find(x => x.id === slot.hero)
    const st = slot.stats || {}
    return { kind: 'hero', id: slot.hero, name: h?.name || 'Герой', count: 1, atk: NUM(st.atk), def: NUM(st.def), hp: NUM(st.hp), ini: NUM(st.ini), ok: hasStats(st) }
  }
  const base = s.army?.stats?.[slot.race] || {}
  const count = NUM(slot.count)
  // таланты: у каждого свой бонус; в бою стек считается со средним бонусом
  const tal = (slot.talents || []).slice(0, count)
  const avg = k => (count ? tal.reduce((n, t) => n + (Number(t[k]) || 0), 0) / count : 0)
  const st = k => Math.round((NUM(base[k]) + avg(k)) * 10) / 10
  return { kind: 'race', race: slot.race, name: RACES[slot.race]?.label || slot.race, count, atk: st('atk'), def: st('def'), hp: st('hp'), ini: st('ini'), ok: hasStats(base), talents: tal.length }
}
// сила стека — для подписи: количество × (атака + защита) × хиты / 10
export const power = u => (u ? Math.round((u.count * (u.atk + u.def) * Math.max(1, u.hp)) / 10) : 0)

// все воины отряда с бонусом линии
export function squadUnits(s, q, heroes = []) {
  const out = []
  const cmd = unitOf(s, q.commander, s.assets, heroes)
  if (cmd) out.push({ ...cmd, line: 'cmd', ref: { line: 'cmd' } })
  for (const [l, def] of Object.entries(LINES)) {
    ;(q.lines?.[l] || []).forEach((sl, i) => {
      const u = unitOf(s, sl, s.assets, heroes)
      if (u && u.count) out.push({ ...u, line: l, ref: { line: l, i }, [def.stat]: u[def.stat] + def.bonus })
    })
  }
  return out
}
export const cargoTotal = q => [...(q.wagons || []), ...(q.packs || [])].reduce((n, c) => n + NUM(c?.count) * NUM(c?.capacity), 0)
export const squadLimit = s => {
  const t = { ...DEFAULT_SQUAD_LIMITS, ...(s.army?.squadLimits || {}) }
  return t[s.kind] ?? 2
}

/* ---------- лечебница ---------- */
export function beds(s, c = computeSettlement(s)) {
  return (c.jobs.healer?.workers || 0) * BEDS_PER_HEALER
}
// кто лежит на койках, а кто ждёт: по очереди, группа целиком
export function hospitalSplit(s, c) {
  let left = beds(s, c)
  const inBed = [], queue = []
  for (const p of s.hospital || []) {
    const n = Math.max(1, NUM(p.count) || 1)
    if (n <= left) { inBed.push(p); left -= n } else queue.push(p)
  }
  return { inBed, queue, free: left, beds: beds(s, c) }
}

/* ---------- помощник боя ----------
   урон стека = количество × атака × (1 + 5% за каждую единицу атаки выше защиты цели)
   урон снимает хиты стека; погибшие/раненые = сколько воинов «ушло» из стека; ходят по инициативе;
   сторона бежит, когда у неё осталось меньше flee (доля от начала). Бьём сначала авангард, потом центр, арьергард, командира. */
const ORDER = { van: 0, mid: 1, rear: 2, cmd: 3, foe: 0 }
export function simulateBattle(ours, foes, { flee = 0.3, maxRounds = 30 } = {}) {
  const mk = (u, side, i) => ({ ...u, side, key: side + i, start: u.count, pool: u.count * Math.max(1, u.hp), hp: Math.max(1, u.hp) })
  const A = ours.filter(u => u.count > 0).map((u, i) => mk(u, 'ours', i))
  const B = foes.filter(u => u.count > 0).map((u, i) => mk({ ...u, line: 'foe' }, 'foe', i))
  const alive = x => x.pool > 0
  const left = list => list.reduce((n, x) => n + (alive(x) ? Math.ceil(x.pool / x.hp) : 0), 0)
  const startA = left(A), startB = left(B)
  const log = []
  let result = null, round = 0
  while (!result && round < maxRounds) {
    round++
    const order = [...A, ...B].filter(alive).sort((x, y) => y.ini - x.ini || (x.side === 'ours' ? -1 : 1))
    for (const u of order) {
      if (!alive(u)) continue
      const enemies = (u.side === 'ours' ? B : A).filter(alive)
      if (!enemies.length) break
      const t = enemies.sort((x, y) => ORDER[x.line] - ORDER[y.line])[0]
      const n = Math.ceil(u.pool / u.hp)
      const dmg = Math.round(n * u.atk * (1 + 0.05 * Math.max(0, u.atk - t.def)))
      const before = Math.ceil(t.pool / t.hp)
      t.pool = Math.max(0, t.pool - dmg)
      const after = Math.ceil(t.pool / t.hp)
      log.push({ round, by: u.name, byN: n, side: u.side, target: t.name, dmg, fell: before - after })
    }
    const la = left(A), lb = left(B)
    if (!lb) result = 'win'
    else if (!la) result = 'loss'
    else if (lb < startB * flee) { result = 'win'; log.push({ round, note: 'Враг бежит' }) }
    else if (la < startA * flee) { result = 'loss'; log.push({ round, note: 'Наши отступают' }) }
  }
  const sum = list => list.map(x => ({ ...x, now: Math.ceil(x.pool / x.hp), fallen: x.start - Math.ceil(x.pool / x.hp), hpNow: x.pool, hpMax: x.start * x.hp }))
  return { result: result || 'draw', rounds: round, log, ours: sum(A), foes: sum(B) }
}
// павшие нашей стороны: половина — раненые (в лечебницу), остальные погибли; одиночка (актив, герой) — всегда ранен
export function splitFallen(u) {
  if (!u.fallen) return { wounded: 0, dead: 0 }
  if (u.kind !== 'race') return { wounded: 1, dead: 0 }
  const wounded = Math.ceil(u.fallen / 2)
  return { wounded, dead: u.fallen - wounded }
}
