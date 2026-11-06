// Жизнь поселения — имитация, не симуляция: жители «по ролям» из чисел сайта (сколько каких рас, кто на какой работе),
// у каждого дом, работа и распорядок дня. Где житель и что делает — чистая функция игрового времени (часы поселения),
// поэтому у всех, кто смотрит, на карте одно и то же, а сервер ничего не считает. Данные поселения не меняются.
import { RACES, JOBS, BUILDINGS, computeSettlement, tierOf, SIZES } from './settlement.js'
import { makeTerrain, B, CENTER } from './terrainGen.js'
import { roadGraph, walkRoute } from './march.js'
import { makeName } from './names.js'
import { DAY_MIN } from './clock.js'

/* ---------- случайность от зерна: у всех одинаковая ---------- */
export function hash(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}
export function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const pick = (r, list) => list[Math.floor(r() * list.length)]
const between = (r, a, b) => a + r() * (b - a)
const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1])

export const WALK = 45 // м за игровую минуту — неспешный шаг (чтобы дорога на работу не съедала полдня)

/* ---------- что делают: подписи и значки ---------- */
export const ACTS = {
  home: { label: 'дома', group: 'Дома', icon: '🏠' },
  sleep: { label: 'спит', group: 'Спят', icon: '💤' },
  sick: { label: 'болеет дома', group: 'Болеют', icon: '🤒' },
  walk: { label: 'идёт', group: 'В пути', icon: '🚶' },
  chop: { label: 'рубит лес', group: 'Рубят лес', icon: '🪓' },
  haul: { label: 'тащит бревно', group: 'Рубят лес', icon: '🪵' },
  hunt: { label: 'охотится', group: 'На охоте', icon: '🏹' },
  gather: { label: 'собирает ягоды и травы', group: 'Собирают', icon: '🧺' },
  farm: { label: 'работает в поле', group: 'В поле', icon: '🌾' },
  water: { label: 'носит воду', group: 'Носят воду', icon: '🪣' },
  patrol: { label: 'в дозоре', group: 'Стража', icon: '🛡' },
  build: { label: 'строит', group: 'На стройке', icon: '🔨' },
  mine: { label: 'ломает камень', group: 'В карьере', icon: '⛏' },
  serve: { label: 'обслуживает гостей', group: 'В таверне', icon: '🍺' },
  trade: { label: 'торгует', group: 'На рынке', icon: '💰' },
  work: { label: 'работает', group: 'Работают', icon: '⚒' },
  outpost: { label: 'на аванпосте', group: 'На аванпостах', icon: '⛺' },
  tavern: { label: 'отдыхает в таверне', group: 'В таверне', icon: '🍺' },
  chat: { label: 'болтает', group: 'Болтают', icon: '💬' },
  stroll: { label: 'гуляет', group: 'Гуляют', icon: '🌿' },
  errand: { label: 'по делам', group: 'По делам', icon: '📦' },
  play: { label: 'играет', group: 'Дети играют', icon: '🪁' },
  eat: { label: 'обедает', group: 'Обедают', icon: '🍲' },
  riot: { label: 'бунтует на площади', group: 'Бунтуют', icon: '✊' }
}
// работа → что делает на месте
const JOB_ACT = { lumberjack: 'chop', hunter: 'hunt', gatherer: 'gather', farmer: 'farm', watercarrier: 'water', guard: 'patrol', miner: 'mine', innkeeper: 'serve', trader: 'trade' }
// главное дело на работе (для подписей)
export const jobAct = p => (p.job === 'builder' ? 'build' : p.job === 'outpost' ? 'outpost' : JOB_ACT[p.job] || 'work')
export const jobLabel = p => (p.job === 'builder' ? 'строитель' : p.job === 'outpost' ? 'на аванпосте' : p.job === 'free' ? (p.kid ? 'ребёнок' : 'без работы') : JOBS[p.job]?.label?.toLowerCase() || p.job)

/* ---------- места: постройки с «дверью» к дороге ---------- */
function placesOf(s, g) {
  const out = []
  for (const b of s.buildings || []) {
    if (b.x == null) continue
    const t = tierOf(b)
    const side = SIZES[BUILDINGS[b.type]?.size]?.side || 0
    if (!t || !side) continue
    const h = side / 2
    // дверь — на краю плашки со стороны ближней дороги
    const q = g.nearest(b.x, b.y, 1, h + 120)[0]
    let door = [b.x, b.y + h + 1]
    if (q) {
      const dx = q.x - b.x, dy = q.y - b.y, m = Math.max(Math.abs(dx), Math.abs(dy)) || 1
      door = [b.x + (dx / m) * (h + 1), b.y + (dy / m) * (h + 1)]
    }
    out.push({ id: b.id, b, t, type: b.type, x: b.x, y: b.y, h, door, built: (b.state || 'built') === 'built' && b.damage !== 'ruined', name: b.name || t.label })
  }
  return out
}

/* ---------- жители «по ролям» ---------- */
// по поселению: состояние приходит заново при каждой правке, поэтому храним по id и сверяем ключ
const castCache = new Map()
// ключ: от чего зависит раздача ролей (меняется — раздаём заново)
const castKey = s => JSON.stringify([s.races, s.jobs, (s.buildings || []).map(b => [b.id, b.type, b.x, b.y, b.level, b.state, b.builders, b.damage]), s.outposts?.map(o => [o.id, o.workers, o.state]),
  (s.hospital || []).map(p => [p.who, p.count]), (s.army?.squads || []).map(q => [q.id, q.status]), s.roads?.length])
export function buildCast(s) {
  const key = castKey(s)
  const old = castCache.get(s.id)
  if (old?.key === key) { old.cast.s = s; return old.cast }
  const cast = makeCast(s)
  castCache.set(s.id, { key, cast })
  return cast
}
function makeCast(s) {
  const g = roadGraph(s.roads || [])
  const c = computeSettlement(s)
  const places = placesOf(s, g)
  const byId = Object.fromEntries(places.map(p => [p.id, p]))
  const r0 = rng(hash(s.id || 'settlement'))
  // все жители
  const people = []
  for (const race of s.races || []) {
    for (const [sex, n] of [['m', race.male || 0], ['f', race.female || 0]]) {
      for (let i = 0; i < n; i++) {
        const r = rng(hash(`${s.id}:${race.race}:${sex}:${i}`))
        people.push({ id: `${race.race}-${sex}${i}`, race: race.race, sex, kid: false, name: makeName(race.race, sex, r), age: Math.round(between(r, 17, 64)), job: 'free' })
      }
    }
    for (let i = 0; i < (race.kids || 0); i++) {
      const r = rng(hash(`${s.id}:${race.race}:k:${i}`))
      const sex = r() < 0.5 ? 'm' : 'f'
      people.push({ id: `${race.race}-k${i}`, race: race.race, sex, kid: true, name: makeName(race.race, sex, r).split(' ')[0], age: Math.round(between(r, 4, 15)), job: 'free' })
    }
  }
  const adults = people.filter(p => !p.kid), kids = people.filter(p => p.kid)
  const ofRace = (list, race) => list.filter(p => p.race === race)
  // ушли с отрядами — их нет в поселении; больные лежат дома
  for (const q of s.army?.squads || []) {
    if (q.status !== 'out' && q.status !== 'local') continue
    for (const u of Object.values(q.lines || {}).flat()) {
      if (!u?.race) continue
      for (const p of ofRace(adults, u.race).filter(p => !p.away && !p.sick).slice(-(u.count || 0))) p.away = q.name || 'отряд'
    }
  }
  for (const h of s.hospital || []) {
    if (!h.who?.race) continue
    for (const p of ofRace(adults, h.who.race).filter(p => !p.away && !p.sick).slice(0, h.count || 1)) p.sick = h.disease || 'болеет'
  }
  // дома: заселяем по расам (семьи — рядом), лишние ночуют у двора старейшины
  const homes = places.filter(p => (p.t.housing || 0) > 0 && p.built)
  const elder = places.find(p => p.type === 'elder')
  const plaza = elder ? elder.door : [CENTER, CENTER]
  let hi = 0, left = homes[0]?.t.housing || 0
  for (const p of [...people].sort((a, b) => a.race.localeCompare(b.race))) {
    while (homes[hi] && left <= 0) { hi++; left = homes[hi]?.t.housing || 0 }
    if (homes[hi]) { p.home = homes[hi].id; left-- } else p.home = null
  }
  // работы: сперва дети, где можно; потом взрослые (порядок жителей — от зерна поселения, чтобы не прыгал)
  const pool = adults.filter(p => !p.away && !p.sick).sort((a, b) => hash(s.id + a.id) - hash(s.id + b.id))
  const kidPool = kids.slice().sort((a, b) => hash(s.id + a.id) - hash(s.id + b.id))
  const take = (list, n, race) => {
    const out = []
    for (let i = 0; i < list.length && out.length < n; i++) if (list[i].job === 'free' && (!race || list[i].race === race)) out.push(list[i])
    return out
  }
  for (const [key, j] of Object.entries(c.jobs)) {
    if (!j.workers) continue
    const spots = places.filter(p => p.built && (p.t.jobs?.[key] || 0) > 0)
    const crew = [...(j.kids ? take(kidPool, j.kids) : []), ...take(pool, j.workers - (j.kids || 0))]
    // по постройкам этой работы — по их местам
    let si = 0, room = spots[0]?.t.jobs[key] || 0
    for (const p of crew) {
      while (spots[si] && room <= 0) { si++; room = spots[si]?.t.jobs[key] || 0 }
      p.job = key
      p.work = (spots[si] || spots[spots.length - 1])?.id || null
      room--
    }
  }
  // аванпосты: рабочие живут там же
  for (const o of s.outposts || []) {
    if (o.state === 'closed' || !o.workers || o.x == null) continue
    for (const p of take(pool, o.workers)) { p.job = 'outpost'; p.outpost = { id: o.id, x: o.x, y: o.y, name: o.name || o.type } }
  }
  // строители: по расам, как назначил глава
  for (const b of places) {
    if (!(b.b.state === 'construction' || b.b.repair || b.b.upgrade)) continue
    for (const [race, n] of Object.entries(b.b.builders || {})) {
      const crew = take(pool, n, race)
      if (crew.length < n) crew.push(...take(pool, n - crew.length))
      for (const p of crew) { p.job = 'builder'; p.work = b.id }
    }
  }
  // группы охотников по трое
  let hunters = 0
  for (const p of people) if (p.job === 'hunter') p.group = Math.floor(hunters++ / (JOBS.hunter?.group || 3))
  // места для работы под открытым небом: лес у баз лесорубов и охотников, луг у собирателей
  const gen = makeTerrain(s.terrain)
  gen.setClearings(s.clearings || [])
  const o = {}
  const spotsNear = (x, y, want, rMin, rMax, n, seed) => {
    const r = rng(seed), out = []
    for (let i = 0; i < 400 && out.length < n; i++) {
      const a = r() * Math.PI * 2, d = between(r, rMin, rMax), px = x + Math.cos(a) * d, py = y + Math.sin(a) * d
      if (want.includes(gen.sample(px, py, o).code)) out.push([Math.round(px * 10) / 10, Math.round(py * 10) / 10])
    }
    // рядом ничего — ищем дальше
    return out.length || rMax > 3000 ? out : spotsNear(x, y, want, rMax, rMax * 2.5, n, seed + 1)
  }
  const FOREST = [B.FOREST, B.CONIFER], OPEN = [B.MEADOW, B.SHRUB, B.FOREST, B.CUT]
  const sites = {}
  for (const p of places) {
    if (p.type === 'lumber') sites[p.id] = spotsNear(p.x, p.y, FOREST, 25, 260, 10, hash(p.id + 'trees'))
    if (p.type === 'hunter') sites[p.id] = spotsNear(p.x, p.y, FOREST, 250, 800, 6, hash(p.id + 'hunt'))
    if (p.type === 'gatherer') sites[p.id] = spotsNear(p.x, p.y, OPEN, 60, 320, 8, hash(p.id + 'gather'))
  }
  // дозор вдоль стен: куски стены по 120 м, смещённые внутрь на 4 м
  const patrols = []
  for (const w of s.walls || []) {
    for (let i = 1; i < w.points.length; i++) {
      const a = w.points[i - 1], b = w.points[i]
      if (dist(a, b) > 20) patrols.push([a, b])
    }
  }
  const tavern = places.find(p => p.type === 'tavern' && p.built)
  const market = places.find(p => p.type === 'market' && p.built)
  const wells = places.filter(p => p.type === 'well' && p.built)
  const store = places.find(p => (p.type === 'storehouse' || p.type === 'barn') && p.built)
  // недовольство: мораль или стабильность сильно ниже нуля — вечером на площадь выходят бунтовать
  const unrest = c.morale < -20 || c.stability < -30
  return { s, people, places, byId, g, sites, patrols, tavern, market, wells, store, plaza, elder, morale: c.morale, unrest, r0: r0() }
}

/* ---------- распорядок дня ---------- */
const planCache = new Map()
// планы всех на игровые сутки day: { [id]: [{ t0, t1, act, path?, cum?, at?, carry?, talk? }] }
export function dayPlans(cast, day) {
  const key = day
  const c = planCache.get(cast)
  if (c?.day === key) return c.plans
  const plans = makePlans(cast, day)
  planCache.set(cast, { day: key, plans })
  return plans
}
const pathCache = new Map()
// путь между точками; концы округляем до 25 м, чтобы похожие пути считать один раз
function route(cast, a, b) {
  const q = v => Math.round(v / 25)
  const k = `${q(a[0])},${q(a[1])}>${q(b[0])},${q(b[1])}`
  let p = pathCache.get(k)
  if (!p) {
    p = walkRoute(cast.g, a, b)
    if (pathCache.size > 6000) pathCache.clear()
    pathCache.set(k, p)
  }
  return [a, ...p.slice(1, -1), b]
}
function makePlans(cast, day) {
  const plans = {}
  const { people, byId, sites } = cast
  const homeDoor = p => byId[p.home]?.door || cast.plaza
  // помощник: собирает план одного жителя по времени
  const builder = (p, start) => {
    const segs = []
    let t = start, at = homeDoor(p)
    return {
      get t() { return t }, get at() { return at },
      stay(act, until, extra = {}) { if (until > t) segs.push({ t0: t, t1: until, act, at: extra.at || at, ...extra }); t = Math.max(t, until) },
      walk(to, extra = {}) {
        const path = extra.direct ? [at, to] : route(cast, at, to)
        const cum = [0]
        for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + dist(path[i - 1], path[i]))
        const dur = Math.max(1, cum[cum.length - 1] / WALK)
        if (cum[cum.length - 1] > 0.5) segs.push({ t0: t, t1: t + dur, act: extra.act || 'walk', path, cum, carry: extra.carry, to: extra.to })
        t += dur
        at = to
      },
      segs
    }
  }
  const jitter = (p, salt, a, b) => between(rng(hash(`${p.id}:${day}:${salt}`)), a, b)
  // охотники: группа идёт вместе — план на группу
  const huntPlan = {}
  for (const p of people) {
    plans[p.id] = []
    if (p.away) continue
    const r = rng(hash(`${p.id}:${day}`))
    const B = builder(p, 0)
    const wake = 6 * 60 + jitter(p, 'wake', 0, 50)
    if (p.sick) { B.stay('sick', DAY_MIN, { at: homeDoor(p), hidden: true }); plans[p.id] = B.segs; continue }
    const nightGuard = p.job === 'guard' && hash(p.id) % 3 === 0
    B.stay('sleep', nightGuard ? 9 * 60 : wake, { hidden: true })
    const place = byId[p.work]
    const workEnd = 17 * 60 + 30 + jitter(p, 'end', 0, 40)
    // ---- работа ----
    if (p.job === 'outpost') {
      // живут на аванпосте: весь день там, ночью «у костра»
      const o = p.outpost, rr = rng(hash(p.id + 'op'))
      const spot = () => [o.x + between(rr, -25, 25), o.y + between(rr, -25, 25)]
      B.segs.length = 0
      let t = 0
      while (t < DAY_MIN) { const until = Math.min(DAY_MIN, t + between(rr, 40, 90)); B.segs.push({ t0: t, t1: until, act: t > 6 * 60 && t < 20 * 60 ? 'outpost' : 'sleep', at: spot(), hidden: !(t > 6 * 60 && t < 20 * 60) }); t = until }
      plans[p.id] = B.segs
      continue
    }
    if (p.kid) kidDay(cast, p, B, r, day, workEnd)
    else if (nightGuard && place) {
      B.stay('home', 18 * 60, { hidden: true })
      patrol(cast, p, B, r, DAY_MIN - 30)
      B.walk(homeDoor(p))
      B.stay('home', DAY_MIN, { hidden: true })
      plans[p.id] = B.segs
      continue
    } else if (p.job === 'hunter' && place) {
      // группа: общий выход, место охоты и возвращение
      const gk = `${place.id}:${p.group}`
      const gr = rng(hash(gk + day))
      huntPlan[gk] ||= { out: 6 * 60 + 20 + between(gr, 0, 30), site: pick(gr, sites[place.id]?.length ? sites[place.id] : [place.door]), back: 16 * 60 + between(gr, 0, 60) }
      const hp = huntPlan[gk]
      B.walk(place.door)
      B.stay('work', hp.out, { at: place.door })
      const off = [between(r, -6, 6), between(r, -6, 6)]
      B.walk([hp.site[0] + off[0], hp.site[1] + off[1]], { direct: true })
      B.stay('hunt', hp.back)
      B.walk(place.door, { direct: true, carry: r() < 0.6 ? 'meat' : null })
      B.stay('work', Math.max(B.t + 15, workEnd - 30), { at: place.door })
    } else if (place) {
      B.walk(place.door)
      workDay(cast, p, place, B, r, workEnd)
    } else {
      idleDay(cast, p, B, r, workEnd)
    }
    // ---- вечер ----
    if (!p.kid) evening(cast, p, B, r, day)
    B.walk(homeDoor(p))
    B.stay('sleep', DAY_MIN, { hidden: true })
    plans[p.id] = B.segs
  }
  pairChats(cast, plans, day)
  return plans
}
// работы под открытым небом — их видно; остальные работают внутри постройки и на карте пропадают
const OUTDOOR = new Set(['lumberjack', 'hunter', 'gatherer', 'farmer', 'watercarrier', 'guard', 'builder', 'miner', 'outpost'])
// дневная работа на месте
function workDay(cast, p, place, B, r, end) {
  const act = p.job === 'builder' ? 'build' : JOB_ACT[p.job] || 'work'
  if (!OUTDOOR.has(p.job)) {
    // внутри: зашёл — и до вечера (обед — тоже внутри)
    B.stay(act, end, { at: place.door, hidden: true, place: place.id })
    return
  }
  const lunch = 12 * 60 + between(r, 0, 40)
  const around = (rad, inside) => {
    const a = r() * Math.PI * 2
    if (inside) return [place.x + between(r, -place.h * 0.8, place.h * 0.8), place.y + between(r, -place.h * 0.8, place.h * 0.8)]
    // по краю плашки
    const h = place.h + 1.2
    return Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) ? [place.x + Math.sign(Math.cos(a)) * h, place.y + Math.sin(a) * h] : [place.x + Math.cos(a) * h, place.y + Math.sign(Math.sin(a)) * h]
  }
  let ate = false
  while (B.t < end - 10) {
    if (!ate && B.t >= lunch) { B.stay('eat', B.t + 30); ate = true; continue }
    if (p.job === 'lumberjack' && cast.sites[place.id]?.length) {
      // к дереву, рубим, тащим бревно на базу
      const tree = pick(r, cast.sites[place.id])
      B.walk(tree, { direct: true })
      B.stay('chop', B.t + between(r, 20, 35))
      B.walk(place.door, { direct: true, act: 'haul', carry: 'log' })
      B.stay('work', B.t + 6, { at: place.door, note: 'drop' })
    } else if (p.job === 'gatherer' && cast.sites[place.id]?.length) {
      const spot = pick(r, cast.sites[place.id])
      B.walk(spot, { direct: true })
      B.stay('gather', B.t + between(r, 30, 60))
      if (r() < 0.35) { B.walk(place.door, { direct: true, carry: 'basket' }); B.stay('work', B.t + 8, { at: place.door }) }
    } else if (p.job === 'guard') {
      patrol(cast, p, B, r, Math.min(end, B.t + 120))
    } else if (p.job === 'watercarrier') {
      waterRun(cast, p, B, r, place)
    } else if (p.job === 'farmer' || p.job === 'builder' || p.job === 'miner') {
      // в поле — внутри участка, на стройке и в карьере — по краю
      const spot = around(0, p.job === 'farmer')
      B.walk(spot, { direct: true })
      B.stay(p.job === 'builder' ? 'build' : JOB_ACT[p.job] || 'work', B.t + between(r, 8, 18))
    } else {
      // в мастерской, таверне, на рынке: вдоль стороны с дверью
      const spot = byPlace(place, r, 0.7)
      B.walk(spot, { direct: true })
      B.stay(act, B.t + between(r, 8, 20))
    }
  }
  B.stay(act === 'chop' ? 'work' : act, end, { at: B.at })
}
function patrol(cast, p, B, r, until) {
  const seg = cast.patrols.length ? cast.patrols[hash(p.id) % cast.patrols.length] : null
  const base = cast.byId[p.work]?.door || cast.plaza
  while (B.t < until - 5) {
    if (seg) {
      const u = r()
      B.walk([seg[0][0] + (seg[1][0] - seg[0][0]) * u, seg[0][1] + (seg[1][1] - seg[0][1]) * u], { direct: B.t > 0 && dist(B.at, seg[0]) < 200, act: 'patrol' })
      B.stay('patrol', B.t + between(r, 5, 15))
    } else {
      B.walk([base[0] + between(r, -30, 30), base[1] + between(r, -30, 30)], { direct: true, act: 'patrol' })
      B.stay('patrol', B.t + between(r, 10, 25))
    }
  }
}
function waterRun(cast, p, B, r, well) {
  const homes = cast.places.filter(x => (x.t.housing || 0) > 0)
  const to = homes.length ? pick(r, homes).door : cast.plaza
  B.stay('water', B.t + 5, { at: well.door })
  B.walk(to, { carry: 'bucket', act: 'water' })
  B.stay('water', B.t + 3)
  B.walk(well.door)
}
// место у постройки: вдоль её стороны с дверью, не на самой плашке и не кучей в одной точке
function byPlace(place, r, spread = 1) {
  if (!place) return null
  const dx = place.door[0] - place.x, dy = place.door[1] - place.y, l = Math.hypot(dx, dy) || 1
  const nx = dx / l, ny = dy / l, along = between(r, -place.h * 0.85, place.h * 0.85) * spread, out = place.h + between(r, 2, 7)
  return [place.x + nx * out - ny * along, place.y + ny * out + nx * along]
}
// без работы: дела, прогулки, рынок
function idleDay(cast, p, B, r, end) {
  while (B.t < end - 20) {
    const k = r()
    const pl = k < 0.3 ? cast.market : k < 0.5 ? cast.store : k < 0.65 && cast.wells.length ? pick(r, cast.wells) : null
    const dest = pl ? byPlace(pl, r) : k < 0.8 ? [cast.plaza[0] + between(r, -16, 16), cast.plaza[1] + between(r, -16, 16)] : (cast.byId[p.home]?.door || cast.plaza)
    B.walk(dest, { act: 'walk' })
    // на складе — внутри; рынок, колодец, площадь — на виду
    const inStore = k >= 0.3 && k < 0.5 && pl === cast.store
    B.stay(k < 0.65 ? 'errand' : k < 0.8 ? 'stroll' : 'home', B.t + (k >= 0.8 ? between(r, 30, 70) : between(r, 8, 25)), { hidden: k >= 0.8 || inStore, ...(inStore ? { place: pl.id } : {}) })
  }
}
// дети: днём играют у дома и на площади, водоносы бегают с вёдрами
function kidDay(cast, p, B, r, day, end) {
  const home = cast.byId[p.home]?.door || cast.plaza
  const well = p.job === 'watercarrier' ? cast.byId[p.work] : null
  const stop = Math.min(end, 19 * 60 + between(r, 0, 60))
  while (B.t < stop - 10) {
    if (well) { waterRun(cast, p, B, r, well); continue }
    const near = r() < 0.6 ? home : cast.plaza
    B.walk([near[0] + between(r, -18, 18), near[1] + between(r, -18, 18)], { direct: dist(B.at, near) < 120 })
    B.stay('play', B.t + between(r, 4, 12))
  }
}
// вечер: таверна, болтовня у дома, прогулка
function evening(cast, p, B, r, day) {
  const bed = 21 * 60 + between(r, 0, 90)
  const k = r()
  if (cast.unrest && k < 0.4) {
    while (B.t < bed - 5) { B.walk([cast.plaza[0] + between(r, -20, 20), cast.plaza[1] + between(r, -20, 20)]); B.stay('riot', Math.min(bed, B.t + between(r, 6, 14)), { social: 'plaza' }) }
    return
  }
  // вечер кусками: постояли, перешли к другой компании — не стоят столбом весь вечер
  if (k < 0.45 && cast.tavern) {
    while (B.t < bed - 5) {
      // большинство сидит внутри; немногие выходят на крыльцо — их видно, они болтают
      const out = r() < 0.3
      B.walk(out ? byPlace(cast.tavern, r, 1.1) : cast.tavern.door)
      B.stay('tavern', Math.min(bed, B.t + between(r, 20, 40)), { social: out ? 'tavern' : 'tavern-in', hidden: !out, place: cast.tavern.id })
    }
  } else if (k < 0.8) {
    const home = cast.byId[p.home]?.door || cast.plaza
    const inside = r() < 0.5
    while (B.t < bed - 5) {
      B.walk([home[0] + between(r, -8, 8), home[1] + between(r, -8, 8)])
      B.stay('home', Math.min(bed, B.t + between(r, inside ? 60 : 15, inside ? 120 : 35)), { social: 'home', hidden: inside })
    }
  } else {
    while (B.t < bed - 5) { B.walk([cast.plaza[0] + between(r, -25, 25), cast.plaza[1] + between(r, -25, 25)]); B.stay('stroll', Math.min(bed, B.t + between(r, 8, 20)), { social: 'plaza' }) }
  }
}
// разговоры: кто вечером в одном месте — болтают парами; днём на площади — тоже
function pairChats(cast, plans, day) {
  const groups = new Map()
  for (const [id, segs] of Object.entries(plans)) {
    for (const sg of segs) {
      if (!sg.social || sg.hidden) continue
      const k = sg.social + ':' + (sg.social === 'home' ? Math.round(sg.at[0] / 40) + ',' + Math.round(sg.at[1] / 40) : '')
      if (!groups.has(k)) groups.set(k, [])
      groups.get(k).push({ id, sg })
    }
  }
  let n = 0
  for (const list of groups.values()) {
    list.sort((a, b) => hash(a.id + day + a.sg.t0) - hash(b.id + day + b.sg.t0))
    const used = new Set()
    for (let i = 0; i + 1 < list.length; i++) {
      const A = list[i], Bq = list[i + 1]
      // сам с собой не болтает; кусок вечера — только в одной беседе
      if (A.id === Bq.id || used.has(A.sg) || used.has(Bq.sg)) continue
      used.add(A.sg); used.add(Bq.sg)
      const t0 = Math.max(A.sg.t0, Bq.sg.t0), t1 = Math.min(A.sg.t1, Bq.sg.t1)
      if (t1 - t0 < 15) continue
      const talk = { id: `c${day}-${n++}`, a: A.id, b: Bq.id, t0, t1: Math.min(t1, t0 + 45) }
      A.sg.talk = talk
      Bq.sg.talk = talk
      // стоят лицом друг к другу
      const mid = [(A.sg.at[0] + Bq.sg.at[0]) / 2, (A.sg.at[1] + Bq.sg.at[1]) / 2]
      A.sg.at = [mid[0] - 1.1, mid[1]]
      Bq.sg.at = [mid[0] + 1.1, mid[1]]
    }
  }
}

/* ---------- где житель сейчас ---------- */
export function personAt(segs, t) {
  if (!segs?.length) return null
  let lo = 0, hi = segs.length - 1
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (segs[mid].t0 <= t) lo = mid; else hi = mid - 1 }
  const sg = segs[lo]
  if (t < sg.t0 || t > sg.t1 + 0.001) return null
  if (sg.path) {
    const L = sg.cum[sg.cum.length - 1], d = ((t - sg.t0) / Math.max(0.001, sg.t1 - sg.t0)) * L
    let i = 1
    while (i < sg.cum.length - 1 && sg.cum[i] < d) i++
    const a = sg.path[i - 1], b = sg.path[i], u = (d - sg.cum[i - 1]) / Math.max(0.001, sg.cum[i] - sg.cum[i - 1])
    return { x: a[0] + (b[0] - a[0]) * u, y: a[1] + (b[1] - a[1]) * u, act: sg.act, moving: true, dir: Math.atan2(b[1] - a[1], b[0] - a[0]), carry: sg.carry, sg }
  }
  return { x: sg.at[0], y: sg.at[1], act: sg.act, hidden: !!sg.hidden, talk: sg.talk && t >= sg.talk.t0 && t <= sg.talk.t1 ? sg.talk : null, sg }
}

/* ---------- о чём болтают ---------- */
const SMALL = {
  hobgoblin: ['Работа не волк — но и я не заяц.', 'Кто доел мою похлёбку?', 'Завтра опять копать. Люблю копать.', 'Главное — чтоб крыша не текла.'],
  fenris: ['Мяса бы. Много мяса.', 'Ночью опять кто-то выл. Не я.', 'Сил полно — подраться бы с кем.', 'Ветер с севера. К снегу.'],
  kitsune: ['Луна сегодня как фонарик.', 'Духи у колодца нынче весёлые.', 'Хвост ноет — к перемене погоды.', 'Вы чай с жасмином пробовали?'],
  human: ['Цены на рынке кусаются.', 'Дома-то лучше, чем в старом мире.', 'Жена ругается, что поздно прихожу.', 'Ну и денёк выдался.'],
  highelf: ['Эти грубияны опять шумели всю ночь.', 'Здесь катастрофически не хватает книг.', 'Звёзды тут ярче, чем в столице.', 'Я, между прочим, не для полевых работ.'],
  centaur: ['Тесно тут у вас, копыта не развернуть.', 'Вчера до реки и обратно — разминка!', 'Сена бы свежего.', 'Дорога зовёт, а я тут стою.'],
  neko: ['Мрр… на солнышке бы полежать.', 'Мыши в амбаре опять наглеют.', 'Не люблю дождь. Совсем.', 'Рыбки бы…']
}
const JOB_TALK = {
  lumberjack: ['Сосна нынче смолистая, топор вязнет.', 'Ещё десяток брёвен — и на пилораму.'], hunter: ['Кабан ушёл, хитрая скотина.', 'Следы видел — что-то большое бродит.'],
  gatherer: ['Малина пошла!', 'Травы набрала — знахарь будет доволен.'], farmer: ['Дождика бы на поля.', 'Тля опять лезет.'],
  guard: ['На стене тихо. Пока.', 'Ворота скрипят — смазать бы.'], builder: ['Стропила подняли!', 'Гвоздей не хватает, хоть зубами держи.'],
  innkeeper: ['Пиво сварили — пальчики оближешь.', 'Вчера опять драка была, лавку сломали.'], trader: ['Купцы с юга обещали шёлк.', 'Соль подорожала.'],
  smith: ['Горн гудит, как дракон.', 'Подкову бы кто заказал, а то всё гвозди да гвозди.'], miner: ['Камень нынче крепкий.', 'Нашли жилу — может, чернозём?']
}
const MOOD = {
  good: ['Хорошо живём!', 'Спокойно стало, глядишь — и детей заводить можно.', 'Глава у нас толковый.'],
  bad: ['Надоело всё…', 'Кормят плохо, а работы — гора.', 'Ещё немного — и уйду отсюда.'],
  evening: ['Пойдём в таверну?', 'Устал как собака.', 'Завтра опять рано вставать.']
}
// реплики разговора: пара жителей, их расы и работы, свежие новости журнала, настроение
const linesCache = new Map()
export function chatLines(cast, talk, A, B) {
  const ck = talk.id + ':' + (cast.s.events?.length || 0)
  if (linesCache.has(ck)) return linesCache.get(ck)
  const r = rng(hash(talk.id))
  // слухи — о свежих событиях журнала (постоянные вроде «Спокойствие» — не новость)
  const ev = (cast.s.events || []).filter(e => !e.duration?.includes('permanent')).slice(-6).map(e => e.title).filter(Boolean)
  const morale = cast.morale
  const say = p => {
    const k = r()
    if (k < 0.3 && ev.length) return pick(r, [`Слыхал? «${pick(r, ev)}».`, `Говорят, «${pick(r, ev).toLowerCase()}».`, `Что думаешь про «${pick(r, ev).toLowerCase()}»?`])
    if (k < 0.5 && JOB_TALK[p.job]) return pick(r, JOB_TALK[p.job])
    if (k < 0.65) return pick(r, morale < 0 ? MOOD.bad : morale > 50 ? MOOD.good : MOOD.evening)
    return pick(r, SMALL[p.race] || SMALL.human)
  }
  const lines = []
  for (let i = 0; i < 6; i++) lines.push({ who: i % 2 ? B : A, text: say(i % 2 ? B : A) })
  if (linesCache.size > 3000) linesCache.clear()
  linesCache.set(ck, lines)
  return lines
}
// какая реплика звучит сейчас (по 4 игровые минуты на реплику, между ними — пауза)
export function lineNow(cast, talk, t, byId) {
  const lines = chatLines(cast, talk, byId[talk.a], byId[talk.b])
  const k = Math.floor((t - talk.t0) / 4)
  if (k < 0 || k >= lines.length || (t - talk.t0) % 4 > 3.2) return null
  return lines[k]
}

const day0 = sg => Math.floor(sg.t0 / 60)

/* ---------- сборища: куда сошлось много народу (для подсказки на карте) ---------- */
// snap — snapshotAt; вернёт [{ icon, text, at: { x, y }, n }] — самые заметные сверху
export function gatherings(cast, snap, tod) {
  const out = []
  const by = (f) => snap.filter(x => x.act !== 'away' && f(x))
  const at = pl => (pl ? { x: pl.x, y: pl.y } : { x: cast.plaza[0], y: cast.plaza[1] })
  const tav = by(x => x.act === 'tavern')
  if (cast.tavern && tav.length >= 5) out.push({ icon: '🍺', n: tav.length, text: `${tav.length} ${plural(tav.length, 'житель гуляет', 'жителя гуляют', 'жителей гуляют')} в таверне${tod > 22 * 60 ? ' — до ночи' : ''}`, at: at(cast.tavern) })
  const riot = by(x => x.act === 'riot')
  if (riot.length >= 3) out.push({ icon: '✊', n: riot.length + 100, text: `Бунт на площади: ${riot.length} недовольных`, at: at(null) })
  const plaza = by(x => x.act === 'stroll')
  if (plaza.length >= 6) out.push({ icon: '🎶', n: plaza.length, text: `Гуляния на площади: ${plaza.length}`, at: at(null) })
  // стройки с народом
  const sites = new Map()
  for (const x of by(x => x.act === 'build')) sites.set(x.p.work, (sites.get(x.p.work) || 0) + 1)
  for (const [id, n] of sites) if (n >= 3) out.push({ icon: '🔨', n, text: `Стройка «${cast.byId[id]?.name || 'постройка'}»: ${n} ${plural(n, 'строитель', 'строителя', 'строителей')}`, at: at(cast.byId[id]) })
  const walk = by(x => x.moving)
  if (walk.length >= 12 && tod > 5 * 60 && tod < 9 * 60) out.push({ icon: '🚶', n: walk.length, text: `Утро: ${walk.length} идут на работу`, at: at(null) })
  const sleep = by(x => x.act === 'sleep').length
  if (sleep > snap.length * 0.7) out.push({ icon: '💤', n: 0, text: 'Деревня спит', at: null })
  return out.sort((a, b) => b.n - a.n).slice(0, 4)
}
// сколько народу внутри каждой постройки сейчас: { [id]: { n, act } }
export function insideCounts(snap) {
  const m = {}
  for (const x of snap) {
    const pl = x.sg?.place
    if (!x.hidden || !pl) continue
    const e = (m[pl] ||= { n: 0, act: x.act })
    e.n++
  }
  return m
}
const plural = (n, one, few, many) => (n % 10 === 1 && n % 100 !== 11 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? few : many)

/* ---------- сводка и лента ---------- */
export function snapshotAt(cast, plans, t) {
  const out = []
  for (const p of cast.people) {
    if (p.away) { out.push({ p, act: 'away' }); continue }
    const st = personAt(plans[p.id], t)
    out.push({ p, ...(st || { act: 'home', hidden: true }) })
  }
  return out
}
// заметные моменты дня до времени t (новые сверху)
export function moments(cast, plans, t, limit = 60) {
  const byId = Object.fromEntries(cast.people.map(p => [p.id, p]))
  const out = []
  const name = p => `${p.name}${p.kid ? '' : ` (${jobLabel(p)})`}`
  const seenTalk = new Set()
  for (const p of cast.people) {
    let prev = null
    for (const sg of plans[p.id] || []) {
      if (sg.t0 > t) break
      const was = prev
      prev = sg.act === 'walk' ? prev : sg.act
      const n0 = out.length
      if (sg.act === 'chop' && sg.t1 <= t && hash(p.id + sg.t0) % 3 === 0) out.push({ t: sg.t1, icon: '🪓', text: `${name(p)} свалил${p.sex === 'f' ? 'а' : ''} дерево` })
      if (sg.act === 'hunt' && sg.t1 <= t && p.group != null && hash(p.id) % 3 === 0) out.push({ t: sg.t1, icon: '🏹', text: `Охотники возвращаются${sg.carry !== null ? ' с добычей' : ''}` })
      if (sg.act === 'tavern' && was !== 'tavern' && hash(p.id + day0(sg)) % 3 === 0) out.push({ t: sg.t0, icon: '🍺', text: `${name(p)} зашёл${p.sex === 'f' ? 'а' : ''} в таверну` })
      if (sg.act === 'riot' && was !== 'riot' && hash(p.id) % 2 === 0) out.push({ t: sg.t0, icon: '✊', text: `${name(p)} вышел${p.sex === 'f' ? 'а' : ''} на площадь — недоволен${p.sex === 'f' ? 'а' : ''}` })
      if (sg.act === 'build' && hash(p.id + sg.t0) % 5 === 0) out.push({ t: sg.t0, icon: '🔨', text: `${name(p)} стучит на стройке «${cast.byId[p.work]?.name || 'постройка'}»` })
      if (sg.act === 'gather' && hash(p.id + sg.t0) % 4 === 0) out.push({ t: sg.t1 <= t ? sg.t1 : sg.t0, icon: '🧺', text: `${name(p)} ${sg.t1 <= t ? 'набрал' + (p.sex === 'f' ? 'а' : '') + ' полную корзину' : 'ушёл' + (p.sex === 'f' ? 'а' : '') + ' за травами'}` })
      if (sg.talk && !seenTalk.has(sg.talk.id) && sg.talk.t0 <= t) {
        seenTalk.add(sg.talk.id)
        const A = byId[sg.talk.a], B = byId[sg.talk.b]
        const line = chatLines(cast, sg.talk, A, B)[0]
        out.push({ t: sg.talk.t0, icon: '💬', text: `${A.name} и ${B.name}: «${line.text}»`, talk: sg.talk.id, who: A.id })
      }
      for (let i = n0; i < out.length; i++) out[i].who ||= p.id
    }
  }
  return out.sort((a, b) => b.t - a.t).slice(0, limit)
}
export { DAY_MIN }
