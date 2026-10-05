// Поселения: справочники (ресурсы, расы, постройки, работы, события) и расчёт показателей.
// Общий для сервера и клиента. Числа подобраны так, что перенесённый Урюпинск даёт те же цифры,
// что старая таблица (см. docs/urupinsk/README.md). Значки — public/settlement/*.png (game-icons.net, CC BY 3.0).

/* ---------------- Ресурсы ---------------- */
export const RESOURCES = [
  { key: 'water', label: 'Вода', group: 'Вода', color: '#5fa8e0' },
  { key: 'drink', label: 'Питьевая вода', group: 'Вода', color: '#8fd0ff' },
  { key: 'veg', label: 'Еда (Овощи)', group: 'Еда', color: '#9be07a' },
  { key: 'fruit', label: 'Еда (Фрукты)', group: 'Еда', color: '#f2c14e' },
  { key: 'meat', label: 'Еда (Мясо)', group: 'Еда', color: '#e07a5f' },
  { key: 'wood', label: 'Дерево', group: 'Сырьё', color: '#b08150' },
  { key: 'stone', label: 'Булыжник', group: 'Сырьё', color: '#a8a8a8' },
  { key: 'build', label: 'Стройматериалы', group: 'Сырьё', color: '#d9a25a' },
  { key: 'clay', label: 'Глина', group: 'Сырьё', color: '#c27c55' },
  { key: 'straw', label: 'Солома', group: 'Сырьё', color: '#e8d27a' },
  { key: 'fiber', label: 'Волокно', group: 'Сырьё', color: '#cfc29a' },
  { key: 'herbs', label: 'Травы', group: 'Сырьё', color: '#7ccf8a' },
  { key: 'parts', label: 'Простые детали', group: 'Изделия', color: '#c9b88f' },
  { key: 'goods', label: 'Товары', group: 'Изделия', color: '#e6c27a' },
  { key: 'iron', label: 'Чёрные металлы', group: 'Металлы и камни', color: '#8f9aa6' },
  { key: 'nonferrous', label: 'Цветные металлы', group: 'Металлы и камни', color: '#d39b62' },
  { key: 'minerals', label: 'Минералы', group: 'Металлы и камни', color: '#9fb8c9' },
  { key: 'rare', label: 'Редкие минералы', group: 'Металлы и камни', color: '#b49cff' },
  { key: 'gold', label: 'Золото', group: 'Металлы и камни', color: '#ffd35a' },
  { key: 'mana', label: 'Мана-камни', group: 'Металлы и камни', color: '#6fe0ff' },
  { key: 'coal', label: 'Уголь', group: 'Топливо', color: '#7fd6e8' },
  { key: 'steam', label: 'Пар', group: 'Топливо', color: '#e8eef2' }
]
export const RES = Object.fromEntries(RESOURCES.map(r => [r.key, r]))

/* ---------------- Расы ----------------
   eat: растительная / мясная еда, drink: питьевая вода, life: «Быт» — дрова, посуда, одежда, починка (берётся из Дерева).
   Дети большинства рас тратят на 50% меньше. war / def — военный и оборонительный потенциал одного боевого жителя. */
export const RACES = {
  hobgoblin: {
    label: 'Хобгоблины', traits: ['Всеядные', 'Рабочий запал', 'Общинники', 'Слабая аура'],
    plus: ['Могут есть любую пищу', '+25% к скорости любой работы, если мораль выше 50', 'Чаще образуют семьи, легко уживаются с другими расами'],
    minus: ['Крайне слабый магический потенциал или его отсутствие'],
    veg: 0.75, meat: 0.75, drink: 1, life: 0.5, war: 1, def: 2
  },
  fenris: {
    label: 'Фенрисы', traits: ['Мясоедные', 'Воинственные', 'Агрессивные', 'Атлетичные', 'Неуклюжие'],
    plus: ['Значительно чаще получают категорию «Боевой»', '+2 к Бою и Охоте', 'Бонусы к Силе и Телосложению'],
    minus: ['Едят на 100% больше мясной пищи', 'Чаще создают конфликты', 'Штрафы к Ловкости и Работе'],
    veg: 1, meat: 2, drink: 2, life: 1, war: 3, def: 5
  },
  kitsune: {
    label: 'Кицунэ', traits: ['Всеядные', 'Сильная аура', 'Неуспевающие', 'Ловкие', 'Чтущие традиции'],
    plus: ['Могут есть любую пищу', 'Большой магический потенциал', 'Бонусы к Ловкости', 'Бонусы к Мудрости'],
    minus: ['Штрафы к Интеллекту', 'Не могут заниматься исследованиями'],
    veg: 1, meat: 1, drink: 1.5, life: 0.5, war: 1, def: 3
  },
  human: {
    label: 'Люди', traits: ['Всеядные', 'Всесторонние', 'Иномирные'],
    plus: ['Могут есть любую пищу', 'Небольшие бонусы ко всем характеристикам', 'Могут выполнять любую работу'],
    minus: ['Дают штраф к Морали представителям других рас'],
    veg: 1, meat: 1, drink: 1.5, life: 0.75, war: 2, def: 1
  },
  highelf: {
    label: 'Высшие эльфы', traits: ['Всеядные', 'Сильная аура', 'Эгоистичные', 'Слабые', 'Интеллектуалы'],
    plus: ['Могут есть любую пищу', 'Большой магический потенциал', 'Бонусы к Интеллекту'],
    minus: ['Чаще создают конфликты', 'Не могут заниматься тяжёлой работой', 'Штрафы к Силе и Телосложению'],
    veg: 1, meat: 0.5, drink: 1, life: 1, war: 2, def: 1
  },
  centaur: {
    label: 'Кентавры', traits: ['Травоядные', 'Слабая аура', 'Воинственные', 'Кочующие', 'Неуклюжие'],
    plus: ['Значительно чаще получают категорию «Боевой»', 'Эффективны в разведке и походах'],
    minus: ['Едят на 100% больше растительной пищи', 'Крайне слабый магический потенциал', 'Не могут заниматься тонкой работой'],
    veg: 2, meat: 0, drink: 2, life: 1, war: 4, def: 1
  },
  neko: {
    label: 'Нэко', traits: ['Мясоедные', 'Одиночки', 'Внимательные', 'Оседлые'],
    plus: ['Крайне эффективны в разведке', 'Бонусы в обороне'],
    minus: ['Едят на 100% больше мясной пищи', 'Реже создают семьи', 'Штрафы в походах'],
    veg: 0.5, meat: 1, drink: 1.5, life: 0.75, war: 2, def: 2
  }
}
// категории жителей (как в старой таблице)
export const RESIDENT_CATS = {
  free: { label: 'Свободные', color: '#9be07a' },
  workers: { label: 'Рабочие', color: '#f2c14e' },
  kids: { label: 'Дети', color: '#6fd6e8' },
  combat: { label: 'Боевые', color: '#c2783a' },
  important: { label: 'Важные', color: '#a07cff' },
  wounded: { label: 'Раненые', color: '#ff6b5b' }
}

/* ---------------- Размеры построек ----------------
   side — сторона квадрата на мини-карте (в единицах карты), area — «площадь» для счёта занятой земли */
export const SIZES = {
  small: { label: 'Малый', side: 34, area: 1 },
  medium: { label: 'Средний', side: 56, area: 2 },
  large: { label: 'Большой', side: 82, area: 4 },
  huge: { label: 'Огромный', side: 150, area: 8 },
  settlement: { label: 'Поселение', side: 0, area: 0 } // на всё поселение (стена)
}
export const CATEGORIES = {
  structure: { label: 'Структура', color: '#b06cff' },
  housing: { label: 'Жилые', color: '#d9893a' },
  resources: { label: 'Ресурсы', color: '#5fa8e0' },
  military: { label: 'Военное', color: '#6fae4a' },
  production: { label: 'Производство', color: '#e8c33a' },
  health: { label: 'Здравоохранение', color: '#e0503a' },
  storage: { label: 'Хранение', color: '#8f6cff' },
  industry: { label: 'Индустриальное', color: '#4fd8c6' },
  social: { label: 'Социальное', color: '#f0b56a' },
  economy: { label: 'Экономика', color: '#7ccf4a' },
  personal: { label: 'Личное', color: '#ececec' }
}

/* ---------------- Постройки ----------------
   jobs — рабочие места {работа: мест}; gain/use — что даёт и тратит сама постройка в день;
   housing — жильё, guests — гостевые места, trade — торговые места, defense — защита, leisure — досуг */
export const BUILDINGS = {
  elder: { label: 'Двор старейшины', cat: 'structure', size: 'large', cost: 250, icon: 'medieval-village-01' },
  house: { label: 'Жилой дом', cat: 'housing', size: 'medium', cost: 125, icon: 'house', housing: 4 },
  dorm: { label: 'Общежитие', cat: 'housing', size: 'large', cost: 200, icon: 'block-house', housing: 13 },
  lumber: { label: 'База лесоруба', cat: 'resources', size: 'medium', cost: 100, icon: 'axe-in-stump', jobs: { lumberjack: 4 } },
  hunter: { label: 'Дом охотника', cat: 'resources', size: 'medium', cost: 150, icon: 'target-arrows', jobs: { hunter: 4 } },
  gatherer: { label: 'Дом собирателя', cat: 'resources', size: 'medium', cost: 150, icon: 'gift-trap', jobs: { gatherer: 4 } },
  guardpost: { label: 'Застава стражи', cat: 'military', size: 'medium', cost: 150, icon: 'barracks-tent', jobs: { guard: 5 } },
  workshop: { label: 'Мастерская', cat: 'production', size: 'medium', cost: 250, icon: 'tinker', jobs: { locksmith: 4 } },
  field: { label: 'Поле для посадок', cat: 'production', size: 'huge', cost: 50, icon: 'wheat', jobs: { farmer: 10 }, use: { water: 50 } },
  latrine: { label: 'Общ. уборная', cat: 'health', size: 'small', cost: 100, icon: 'tap', jobs: { septic: 1 } },
  steampump: { label: 'Паровой насос', cat: 'resources', size: 'small', cost: 175, icon: 'valve', gain: { water: 45 } },
  storehouse: { label: 'Склад', cat: 'storage', size: 'large', cost: 125, icon: 'locked-box', jobs: { storekeeper: 1 } },
  coop: { label: 'Курятник', cat: 'production', size: 'medium', cost: 150, icon: 'rooster', jobs: { poultry: 2 }, use: { water: 10 } },
  machinehall: { label: 'Машинный зал', cat: 'industry', size: 'medium', cost: 400, icon: 'furnace' },
  mill: { label: 'Мельница', cat: 'production', size: 'medium', cost: 250, icon: 'windmill' },
  barn: { label: 'Амбар', cat: 'storage', size: 'large', cost: 125, icon: 'barn' },
  tavern: { label: 'Таверна', cat: 'social', size: 'large', cost: 300, icon: 'tavern-sign', jobs: { innkeeper: 4 }, guests: 10, use: { water: 10 } },
  market: { label: 'Рынок', cat: 'economy', size: 'large', cost: 300, icon: 'cash', jobs: { trader: 3 }, trade: 15 },
  ranch: { label: 'Ранчо', cat: 'production', size: 'large', cost: 300, icon: 'ranch-gate' },
  barrels: { label: 'Бочки с водой', cat: 'storage', size: 'medium', cost: 50, icon: 'cellar-barrels' },
  well: { label: 'Скважина', cat: 'resources', size: 'small', cost: 100, icon: 'manual-water-pump', gain: { drink: 80 } },
  quarry: { label: 'Карьер', cat: 'resources', size: 'medium', cost: 100, icon: 'stone-pile' },
  garden: { label: 'Огород', cat: 'production', size: 'large', cost: 30, icon: 'greenhouse' },
  forge: { label: 'Кузница', cat: 'production', size: 'medium', cost: 275, icon: 'anvil-impact', jobs: { smith: 3 } },
  tower: { label: 'Башня', cat: 'military', size: 'small', cost: 100, icon: 'watchtower', defense: 0 },
  wall: { label: 'Деревянная стена', cat: 'military', size: 'settlement', cost: 400, icon: 'palisade', defense: 100 },
  bath: { label: 'Баня', cat: 'health', size: 'medium', cost: 300, icon: 'shower' },
  healer: { label: 'Дом целителя', cat: 'health', size: 'medium', cost: 250, icon: 'health-normal', jobs: { healer: 2 }, use: { water: 10 } },
  boiler: { label: 'Бойлерная', cat: 'industry', size: 'medium', cost: 600, icon: 'water-mill', jobs: { mechanic: 2 }, use: { water: 40 } },
  // личные дома героев — ставятся мастером, в каталог стройки не входят
  manor: { label: 'Усадьба', cat: 'personal', size: 'large', cost: 0, icon: 'player-base', personal: true },
  treehouse: { label: 'Дом на дереве', cat: 'personal', size: 'medium', cost: 0, icon: 'treehouse', personal: true }
}

/* ---------------- Работы ----------------
   per — выработка и траты одного рабочего в день; spec — слоты специалистов и бонус каждого к выработке (доля);
   effects — подписи эффектов: {label, per} (на рабочего) или {label, text} */
export const JOBS = {
  smith: { label: 'Кузнец', icon: 'anvil-impact', per: { parts: 2, iron: -5 / 3 }, spec: 2, effects: [{ label: 'Обработка (Металл)', per: 2 }] },
  septic: { label: 'Септик', icon: 'tap', effects: [{ label: 'Уборка нечистот', pct: true }] },
  hunter: { label: 'Охотник', icon: 'target-arrows', per: { meat: 8 }, spec: 2, specBonus: 0.25, group: 4, effects: [{ label: 'Группы охотников', group: true }] },
  gatherer: { label: 'Собиратель', icon: 'gift-trap', per: { fruit: 8, herbs: 1 }, spec: 2, group: 4, effects: [{ label: 'Группы собирателей', group: true }] },
  guard: { label: 'Страж', icon: 'barracks-tent', spec: 2, group: 3, defense: 10, effects: [{ label: 'Группы воинов', group: true }, { label: 'Защита поселения', per: 10, sign: true }, { label: 'Снижение опасности', per: 4, unit: '%' }] },
  locksmith: { label: 'Слесарь', icon: 'tinker', per: { build: 5, parts: -0.5, stone: -15 }, spec: 1, specBonus: 0.5, effects: [{ label: 'Ускорение стройки', per: 8.75, unit: '%' }, { label: 'Изготовление', text: 'Инструменты' }] },
  farmer: { label: 'Фермер', icon: 'wheat', per: { veg: 15, straw: 5 }, spec: 2, specBonus: 0.15, specOnly: ['veg'] },
  innkeeper: { label: 'Трактирщик', icon: 'tavern-sign', per: { fruit: -8 }, spec: 2, leisure: 17.5, morale: 12.5, effects: [{ label: 'Досуг', per: 17.5 }, { label: 'Мораль', per: 12.5 }] },
  trader: { label: 'Торговец', icon: 'cash', effects: [{ label: 'Торговля', text: 'идёт' }] },
  mechanic: { label: 'Механик', icon: 'water-mill', per: { steam: 25, coal: -22.5 }, effects: [{ label: 'Паровые станки', text: 'работают' }] },
  poultry: { label: 'Птицевод', icon: 'rooster', per: { meat: 25, goods: 2, straw: -5 } },
  storekeeper: { label: 'Кладовщик', icon: 'locked-box', effects: [{ label: 'Замедление порчи', text: '−25%' }, { label: 'Размер склада', text: '+25%' }] },
  healer: { label: 'Целитель', icon: 'health-normal', per: { herbs: -2 }, spec: 2, effects: [{ label: 'Места пациентов', per: 2 }, { label: 'Болезни', per: -7.5, unit: '%' }, { label: 'Скорость лечения', text: '+30%' }] },
  lumberjack: { label: 'Лесоруб', icon: 'axe-in-stump', per: { wood: 12 } }
}

/* ---------------- Аванпосты ---------------- */
export const OUTPOSTS = {
  mine: { label: 'Шахта', icon: 'gold-mine' },
  quarry: { label: 'Каменоломня', icon: 'stone-pile' },
  logging: { label: 'Вырубка', icon: 'axe-in-log' }
}

/* ---------------- События ---------------- */
export const EVENT_TYPES = {
  approve: { label: 'Одобрение', color: '#9be07a', icon: 'thumb-up' },
  message: { label: 'Сообщение', color: '#d8d2c4', icon: 'thought-bubble' },
  problem: { label: 'Проблема', color: '#f2c14e', icon: 'hazard-sign' },
  done: { label: 'Выполнено', color: '#7cc4ff', icon: 'check-mark' },
  important: { label: 'Важное', color: '#c99248', icon: 'info' },
  alarm: { label: 'Тревога', color: '#ff8a3d', icon: 'hazard-sign' },
  threat: { label: 'Угроза', color: '#ff4a3d', icon: 'hazard-sign-red' },
  depleted: { label: 'Выработка', color: '#ff8a3d', icon: 'cancel' }
}
export const EVENT_DURATIONS = {
  permanent: { label: 'Постоянно', color: '#3a3a3a' },
  quick: { label: 'Быстро', color: '#2c6fd6' },
  decide: { label: 'Требует решения', color: '#1f7a3a' },
  routine: { label: 'Рутинно', color: '#b4532a' }
}
export const ASSET_FRAMES = { purple: '#a07cff', blue: '#4f8cff', green: '#7ccf4a', gold: '#e6c27a' }

/* ---------------- Расчёт ---------------- */
const round = v => Math.round(v * 10) / 10
const add = (m, k, v, label) => {
  if (!v) return
  m[k] ||= { total: 0, parts: [] }
  m[k].total = round(m[k].total + v)
  const p = m[k].parts.find(x => x.label === label)
  if (p) p.value = round(p.value + v)
  else m[k].parts.push({ label, value: round(v) })
}

// Всё, что считается из данных поселения: население, жильё, работы, прирост и расход ресурсов, военные показатели
export function computeSettlement(s) {
  const races = s.races || []
  const adults = races.reduce((n, r) => n + (r.male || 0) + (r.female || 0), 0)
  const kids = races.reduce((n, r) => n + (r.kids || 0), 0)
  const population = adults + kids
  const sum = k => races.reduce((n, r) => n + (r[k] || 0), 0)

  // постройки: сколько каких, жильё, места
  const built = (s.buildings || []).filter(b => (b.state || 'built') === 'built')
  const count = {}
  for (const b of built) count[b.type] = (count[b.type] || 0) + 1
  let housing = 0, guests = 0, trade = 0, defenseB = 0
  const places = {}
  const gain = {}, use = {}
  for (const b of built) {
    const t = BUILDINGS[b.type]
    if (!t) continue
    housing += t.housing || 0
    guests += t.guests || 0
    trade += t.trade || 0
    defenseB += t.defense || 0
    for (const [j, n] of Object.entries(t.jobs || {})) places[j] = (places[j] || 0) + n
    for (const [k, v] of Object.entries(t.gain || {})) add(gain, k, v, t.label)
    for (const [k, v] of Object.entries(t.use || {})) add(use, k, v, t.label)
  }

  // работы: выработка, траты, специалисты, эффекты
  const assets = Object.fromEntries((s.assets || []).map(a => [a.id, a]))
  const jobs = {}
  let leisure = 0, morale = 0, defenseJ = 0
  for (const [key, def] of Object.entries(JOBS)) {
    const st = s.jobs?.[key] || {}
    const workers = Math.min(st.workers || 0, places[key] || 0)
    if (!places[key] && !st.workers) continue
    const specs = (st.specialists || []).slice(0, def.spec || 0)
    const specBonus = specs.filter(Boolean).length * (def.specBonus || 0)
    const out = {}
    for (const [k, v] of Object.entries(def.per || {})) {
      const base = v * workers
      const bonus = v > 0 && (!def.specOnly || def.specOnly.includes(k)) ? base * specBonus : 0
      out[k] = { base: round(base), bonus: round(bonus) }
      if (v > 0) { add(gain, k, base, def.label); add(gain, k, bonus, def.label + ' (специалисты)') } else add(use, k, -base, def.label)
    }
    leisure += (def.leisure || 0) * workers
    morale += (def.morale || 0) * workers
    defenseJ += (def.defense || 0) * workers
    jobs[key] = {
      places: places[key] || 0, workers, supply: st.supply ?? (def.per ? 100 : null), out,
      groups: def.group ? Math.floor(workers / def.group) : null,
      specialists: Array.from({ length: def.spec || 0 }, (_, i) => specs[i] ? (assets[specs[i]] || { name: specs[i] }) : null),
      effects: (def.effects || []).map(e => ({
        label: e.label,
        value: e.text ?? (e.group ? String(Math.floor(workers / def.group)) : e.pct ? `${Math.round((workers / (places[key] || 1)) * 100)}%`
          : `${e.sign && e.per > 0 ? '+' : ''}${round(e.per * workers)}${e.unit || ''}`)
      }))
    }
  }

  // аванпосты
  for (const o of s.outposts || []) {
    if (o.state === 'closed') continue
    for (const [k, v] of Object.entries(o.yields || {})) add(gain, k, v, `Аванпост «${OUTPOSTS[o.type]?.label || o.name}»`)
  }

  // потребление жителями: еда, питьевая вода, «быт» (дрова — из Дерева). Дети — вдвое меньше
  for (const r of races) {
    const rc = RACES[r.race]
    if (!rc) continue
    const eaters = (r.male || 0) + (r.female || 0) + (r.kids || 0) * 0.5
    add(use, 'veg', rc.veg * eaters, 'Жители')
    add(use, 'meat', rc.meat * eaters, 'Жители')
    add(use, 'drink', rc.drink * eaters, 'Жители')
    add(use, 'wood', rc.life * eaters, 'Быт жителей')
  }

  // поправки мастера (то, что сайт не считает сам)
  for (const a of s.adjust || []) (a.value > 0 ? add(gain, a.res, a.value, a.label || 'Поправка') : add(use, a.res, -a.value, a.label || 'Поправка'))

  // военные показатели: боевые жители × потенциал расы + стража, постройки и активы
  const passive = {}
  for (const a of s.assets || []) for (const p of [...(a.passive || []), ...(a.role?.effects || [])]) if (p.stat) passive[p.stat] = (passive[p.stat] || 0) + (p.value || 0)
  const warRaces = races.reduce((n, r) => n + (r.combat || 0) * (RACES[r.race]?.war || 0), 0)
  const defRaces = races.reduce((n, r) => n + (r.combat || 0) * (RACES[r.race]?.def || 0), 0)
  const st = s.stats || {}

  return {
    population, adults, kids,
    free: st.freeSettlers ?? sum('free'), busy: population - (st.freeSettlers ?? sum('free')) - (st.unavailable || 0), unavailable: st.unavailable || 0,
    combat: sum('combat'), important: sum('important'), wounded: sum('wounded'),
    count, places, jobs,
    housing: { cap: housing, used: st.housingUsed ?? Math.min(population, housing) },
    houses: { cap: (count.house || 0) * BUILDINGS.house.housing, used: st.housesUsed ?? (count.house || 0) * BUILDINGS.house.housing },
    guests: { cap: guests, used: st.guestsUsed || 0 },
    trade: { cap: trade, used: st.tradeUsed || 0 },
    war: { total: warRaces + (passive.war || 0), races: warRaces, assets: passive.war || 0 },
    defense: { total: defRaces + defenseJ + defenseB + (passive.defense || 0), races: defRaces, guards: defenseJ, buildings: defenseB, assets: passive.defense || 0 },
    leisure: { total: leisure + (passive.leisure || 0), jobs: leisure, assets: passive.leisure || 0 },
    jobMorale: morale,
    morale: st.morale ?? 0, stability: st.stability ?? 0, threat: st.threat ?? 0,
    gain, use,
    balance: Object.fromEntries(RESOURCES.map(r => [r.key, round((gain[r.key]?.total || 0) - (use[r.key]?.total || 0))]))
  }
}

/* ---------------- Геометрия мини-карты ---------------- */
export function pointInPoly([x, y], pts) {
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}
function segDist([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay
  const t = dx || dy ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))) : 0
  return Math.hypot(px - ax - t * dx, py - ay - t * dy)
}
// квадрат постройки на карте
export function footprint(b) {
  const side = SIZES[BUILDINGS[b.type]?.size || 'medium']?.side || 56
  return { x: b.x - side / 2, y: b.y - side / 2, w: side, h: side, side }
}
// точки по контуру и внутри квадрата — для проверок «в воде», «на дороге», «в тумане»
function samples(f, step = 8) {
  const out = []
  for (let x = f.x; x <= f.x + f.w + 0.01; x += Math.max(4, f.w / Math.ceil(f.w / step))) {
    for (let y = f.y; y <= f.y + f.h + 0.01; y += Math.max(4, f.h / Math.ceil(f.h / step))) out.push([x, y])
  }
  return out
}
export function explored(s, p) {
  return (s.explored || []).some(e => (e.r ? Math.hypot(p[0] - e.x, p[1] - e.y) <= e.r : pointInPoly(p, e.points)))
}
// почему постройку нельзя поставить сюда (пустой список — можно)
export function placementProblems(s, b, ignoreId = b.id) {
  const t = s.terrain || {}
  const f = footprint(b)
  if (!f.side) return []
  const pts = samples(f)
  const out = []
  if (pts.some(p => (t.water || []).some(w => pointInPoly(p, w.points)))) out.push('в воде')
  if (pts.some(p => (t.roads || []).some(r => r.points.some((a, i) => i && segDist(p, r.points[i - 1], a) < (r.w || 20) / 2)))) out.push('на дороге')
  if (t.plaza && pts.some(p => Math.hypot(p[0] - t.plaza.x, p[1] - t.plaza.y) < t.plaza.r)) out.push('на площади')
  if (pts.some(p => !explored(s, p))) out.push('за пределами разведанной земли')
  for (const o of s.buildings || []) {
    if (o.id === ignoreId) continue
    const g = footprint(o)
    if (g.side && f.x < g.x + g.w + 4 && g.x < f.x + f.w + 4 && f.y < g.y + g.h + 4 && g.y < f.y + f.h + 4) { out.push(`впритык к «${o.name || BUILDINGS[o.type]?.label}»`); break }
  }
  return out
}
