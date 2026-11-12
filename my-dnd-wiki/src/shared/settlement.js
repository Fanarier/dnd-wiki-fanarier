// Поселения: справочники (ресурсы, расы, постройки, работы, события) и расчёт показателей.
// Общий для сервера и клиента. Числа подобраны так, что перенесённый Урюпинск даёт те же цифры,
// что старая таблица (см. docs/urupinsk/README.md). Значки — public/settlement/*.png (game-icons.net, CC BY 3.0).

import { wallDefense, smoothLine } from './walls.js'
import { makeTerrain, B as TB, WORLD, CENTER } from './terrainGen.js'

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
  { key: 'soil', label: 'Чернозём', group: 'Сырьё', color: '#7a5a3c' },
  { key: 'fertilizer', label: 'Удобрение', group: 'Сырьё', color: '#8a7a3a' },
  { key: 'parts', label: 'Простые детали', group: 'Изделия', color: '#c9b88f' },
  { key: 'complex', label: 'Сложные детали', group: 'Изделия', color: '#b7a0e0' },
  // ТМС — товары массового спроса
  { key: 'goods', label: 'ТМС', group: 'Изделия', color: '#e6c27a' },
  { key: 'medicine', label: 'Лекарства', group: 'Изделия', color: '#e58fb4' },
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
   Дети большинства рас тратят на 50% меньше. war / def — военный и оборонительный потенциал одного боевого жителя.
   build — очков стройки в день от одного строителя; buildMorale — прибавка (pct, %) при морали выше above; buildNote — подпись */
export const RACES = {
  hobgoblin: {
    label: 'Хобгоблины', traits: ['Всеядные', 'Рабочий запал', 'Общинники', 'Слабая аура'],
    plus: ['Могут есть любую пищу', '+25% к скорости любой работы, если мораль выше 50', 'Чаще образуют семьи, легко уживаются с другими расами'],
    minus: ['Крайне слабый магический потенциал или его отсутствие'],
    veg: 0.75, meat: 0.75, drink: 1, life: 0.5, war: 1, def: 2,
    build: 5, buildMorale: { above: 50, pct: 25 }, buildNote: 'Рабочий запал: +25% при морали выше 50'
  },
  fenris: {
    label: 'Фенрисы', traits: ['Мясоедные', 'Воинственные', 'Агрессивные', 'Атлетичные', 'Неуклюжие'],
    plus: ['Значительно чаще получают категорию «Боевой»', '+2 к Бою и Охоте', 'Бонусы к Силе и Телосложению'],
    minus: ['Едят на 100% больше мясной пищи', 'Чаще создают конфликты', 'Штрафы к Ловкости и Работе'],
    veg: 1, meat: 2, drink: 2, life: 1, war: 3, def: 5,
    build: 4, buildNote: 'Сильные, но неуклюжие — штраф к работе'
  },
  kitsune: {
    label: 'Кицунэ', traits: ['Всеядные', 'Сильная аура', 'Неуспевающие', 'Ловкие', 'Чтущие традиции'],
    plus: ['Могут есть любую пищу', 'Большой магический потенциал', 'Бонусы к Ловкости', 'Бонусы к Мудрости'],
    minus: ['Штрафы к Интеллекту', 'Не могут заниматься исследованиями'],
    veg: 1, meat: 1, drink: 1.5, life: 0.5, war: 1, def: 3,
    build: 4, buildNote: 'Ловкие, тонкую работу делают хорошо'
  },
  human: {
    label: 'Люди', traits: ['Всеядные', 'Всесторонние', 'Иномирные'],
    plus: ['Могут есть любую пищу', 'Небольшие бонусы ко всем характеристикам', 'Могут выполнять любую работу'],
    minus: ['Дают штраф к Морали представителям других рас'],
    veg: 1, meat: 1, drink: 1.5, life: 0.75, war: 2, def: 1,
    build: 5, buildNote: 'Могут любую работу'
  },
  highelf: {
    label: 'Высшие эльфы', traits: ['Всеядные', 'Сильная аура', 'Эгоистичные', 'Слабые', 'Интеллектуалы'],
    plus: ['Могут есть любую пищу', 'Большой магический потенциал', 'Бонусы к Интеллекту'],
    minus: ['Чаще создают конфликты', 'Не могут заниматься тяжёлой работой', 'Штрафы к Силе и Телосложению'],
    veg: 1, meat: 0.5, drink: 1, life: 1, war: 2, def: 1,
    build: 2, buildNote: 'Не годятся для тяжёлой работы'
  },
  centaur: {
    label: 'Кентавры', traits: ['Травоядные', 'Слабая аура', 'Воинственные', 'Кочующие', 'Неуклюжие'],
    plus: ['Значительно чаще получают категорию «Боевой»', 'Эффективны в разведке и походах'],
    minus: ['Едят на 100% больше растительной пищи', 'Крайне слабый магический потенциал', 'Не могут заниматься тонкой работой'],
    veg: 2, meat: 0, drink: 2, life: 1, war: 4, def: 1,
    build: 6, buildNote: 'Таскают брёвна и камень, но не тонкую работу'
  },
  neko: {
    label: 'Нэко', traits: ['Мясоедные', 'Одиночки', 'Внимательные', 'Оседлые'],
    plus: ['Крайне эффективны в разведке', 'Бонусы в обороне'],
    minus: ['Едят на 100% больше мясной пищи', 'Реже создают семьи', 'Штрафы в походах'],
    veg: 0.5, meat: 1, drink: 1.5, life: 0.75, war: 2, def: 2,
    build: 4, buildNote: ''
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
// размеры в метрах: сторона квадрата по площади (сотка = 100 м²)
export const SIZES = {
  small: { label: 'Малый', side: 10, area: '1 сотка' },
  medium: { label: 'Средний', side: Math.sqrt(1500), area: '15 соток' },
  large: { label: 'Большой', side: Math.sqrt(3000), area: '30 соток' },
  huge: { label: 'Огромный', side: 100, area: '1 га' },
  settlement: { label: 'Поселение', side: 0, area: '' } // на всё поселение (стена)
}

/* ---------------- Дороги ---------------- */
// w — ширина в метрах
// rank — кто кого перекрывает на перекрёстке (покрытие главной дороги ложится поверх второстепенной)
export const ROAD_TYPES = {
  trail: { label: 'Тропа', w: 1.5, rank: 1 },
  dirt: { label: 'Грунтовая дорога', w: 4, rank: 2 },
  tract: { label: 'Тракт', w: 7, rank: 3 },
  paved: { label: 'Мощёная дорога', w: 6, rank: 4 },
  bridge: { label: 'Мост', w: 5, rank: 5 }
}
const roadW = r => ROAD_TYPES[r.type]?.w || 4

// дорога плавной кривой (Катмулл–Ром через её точки), разбитая на отрезки ~2 м; мост — прямыми
const curveCache = new WeakMap()
export function roadCurve(r) {
  if (curveCache.has(r)) return curveCache.get(r)
  const pts = r.points || []
  // плавно, без петель на резких поворотах (центростремительный сплайн); мост — прямыми
  const out = pts.length > 2 && r.type !== 'bridge' ? smoothLine(pts) : pts
  curveCache.set(r, out)
  return out
}
// рамка дороги [x0, y0, x1, y1] — для быстрых проверок
const boxCache = new WeakMap()
export function roadBox(r) {
  if (boxCache.has(r)) return boxCache.get(r)
  const c = roadCurve(r)
  const bb = [Infinity, Infinity, -Infinity, -Infinity]
  for (const [x, y] of c) { if (x < bb[0]) bb[0] = x; if (y < bb[1]) bb[1] = y; if (x > bb[2]) bb[2] = x; if (y > bb[3]) bb[3] = y }
  boxCache.set(r, bb)
  return bb
}
// ближайшая к точке дорога: { road, x, y, dist, seg }
export function nearestRoad(roads, x, y, skipId) {
  let best = null
  for (const r of roads || []) {
    if (r.id === skipId) continue
    const c = roadCurve(r)
    for (let i = 1; i < c.length; i++) {
      const [ax, ay] = c[i - 1], [bx, by] = c[i]
      const dx = bx - ax, dy = by - ay
      const t = dx || dy ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy))) : 0
      const px = ax + t * dx, py = ay + t * dy, d = Math.hypot(x - px, y - py)
      if (!best || d < best.dist) best = { road: r, x: px, y: py, dist: d, seg: i }
    }
  }
  return best
}
// примыкания: конец дороги лежит на другой дороге — там нужен плавный «раструб».
// { road, end: 0 | 1, x, y, into: дорога, в которую упирается }
export function roadJunctions(roads) {
  const out = []
  for (const r of roads || []) {
    const c = roadCurve(r)
    if (c.length < 2) continue
    for (const end of [0, 1]) {
      const p = end ? c[c.length - 1] : c[0]
      const q = nearestRoad(roads, p[0], p[1], r.id)
      if (q && q.dist <= roadW(q.road) / 2 + 0.6) out.push({ road: r, end, x: p[0], y: p[1], into: q.road })
    }
  }
  return out
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
   jobs — рабочие места {работа: мест}; spec — места специалистов {работа: мест}; gain/use — что даёт и тратит сама постройка в день;
   housing — жильё, guests — гостевые места, trade — торговые места, defense — защита.
   tiers — уровни постройки (1, 2, 3): поля уровня заменяют поля постройки. Кроме тех же полей у уровня бывают:
   perm — постоянный бафф {threat, stability, morale (в день)}; gov — управление {head, managers, outposts, maxLevel};
   ev — шансы событий {family, dorm, breakdown, mineral, soil, medicine}; regrow — сколько метров вырубки в день зарастает вокруг;
   specGain — что даёт, если у работы есть хоть один специалист; price / cost — цена и работа улучшения до этого уровня; note — подпись */
export const BUILDINGS = {
  elder: {
    label: 'Двор старейшины', cat: 'structure', size: 'large', cost: 250, icon: 'medieval-village-01',
    tiers: [
      { label: 'Двор старейшины', gov: { head: 1, managers: 2, outposts: 4, maxLevel: 1 }, perm: { threat: -2 }, note: 'Все постройки — 1 уровня' },
      { label: 'Ратуша', gov: { head: 1, managers: 3, outposts: 6, maxLevel: 2 }, perm: { threat: -4, stability: 1 }, price: { wood: 150, stone: 150, build: 100, goods: 20 }, cost: 400, note: 'Постройки можно улучшать до 2 уровня' },
      { label: 'Магистрат', gov: { head: 1, managers: 4, outposts: 8, maxLevel: 3 }, perm: { threat: -6, stability: 3 }, price: { stone: 300, build: 200, iron: 60, goods: 60 }, cost: 700, note: 'Постройки можно улучшать до 3 уровня' }
    ]
  },
  house: {
    label: 'Жилой дом', cat: 'housing', size: 'medium', cost: 125, icon: 'house', housing: 4,
    tiers: [
      { label: 'Жилой дом', housing: 4, ev: { family: 1 }, note: 'Шанс добрых событий о домах и семьях — чем больше домов, тем чаще' },
      { label: 'Большой дом', housing: 6, ev: { family: 1.5 }, gain: { veg: 1 }, note: 'Чаще добрые события о семьях, свой огородик' },
      { label: 'Коттедж', housing: 8, ev: { family: 2 }, gain: { veg: 2, goods: 0.3 }, note: 'Ещё чаще добрые события, огород и немного товаров' }
    ]
  },
  dorm: {
    label: 'Общежитие', cat: 'housing', size: 'large', cost: 200, icon: 'block-house', housing: 13,
    tiers: [
      { label: 'Барак', housing: 13, ev: { dorm: 1 }, note: 'Шанс дурных событий: ссоры семей и рас — чем больше общаг, тем чаще' },
      { label: 'Ночлежка', housing: 18, ev: { dorm: 0.6 }, note: 'Дурные события реже' },
      { label: 'Коммуналка', housing: 25, ev: { dorm: 0.3 }, note: 'Дурные события ещё реже' }
    ]
  },
  lumber: {
    label: 'База лесоруба', cat: 'resources', size: 'medium', cost: 100, icon: 'axe-in-stump', jobs: { lumberjack: 3 }, spec: { lumberjack: 1 },
    tiers: [
      { label: 'Домик лесоруба', jobs: { lumberjack: 3 }, spec: { lumberjack: 1 }, regrow: 0.3, note: 'Очень медленно сажают лес обратно; попутно — волокно' },
      { label: 'Лесоповал', jobs: { lumberjack: 5 }, spec: { lumberjack: 2 }, regrow: 0.6, note: 'Медленно сажают лес обратно; попутно — волокно' },
      { label: 'Пилорама', jobs: { lumberjack: 7 }, spec: { lumberjack: 3 }, regrow: 1.2, specGain: { build: 8 }, note: 'Умеренно сажают лес; есть специалист-плотник — возят доски (стройматериалы)' }
    ]
  },
  hunter: {
    label: 'Дом охотника', cat: 'resources', size: 'medium', cost: 150, icon: 'target-arrows', jobs: { hunter: 6 }, spec: { hunter: 1 },
    tiers: [
      { label: 'Дом охотника', jobs: { hunter: 6 }, spec: { hunter: 1 }, note: 'Две группы охотников' },
      { label: 'Дом лесничего', jobs: { hunter: 9 }, spec: { hunter: 2 }, note: 'Три группы охотников' },
      { label: 'Застава егеря', jobs: { hunter: 12 }, spec: { hunter: 3 }, perm: { threat: -1 }, note: 'Четыре группы, егеря держат округу' }
    ]
  },
  gatherer: {
    label: 'Дом собирателя', cat: 'resources', size: 'medium', cost: 150, icon: 'gift-trap', jobs: { gatherer: 6 }, spec: { gatherer: 1 },
    tiers: [
      { label: 'Хижина собирателя', jobs: { gatherer: 6 }, spec: { gatherer: 1 }, note: 'Две группы собирателей' },
      { label: 'Застава искателей', jobs: { gatherer: 9 }, spec: { gatherer: 2 }, note: 'Три группы собирателей' },
      { label: 'Обитель знахаря', jobs: { gatherer: 12 }, spec: { gatherer: 3 }, ev: { medicine: 1 }, note: 'Четыре группы; знахарь иногда варит лекарства' }
    ]
  },
  guardpost: {
    label: 'Застава стражи', cat: 'military', size: 'medium', cost: 150, icon: 'barracks-tent', jobs: { guard: 5 },
    tiers: [
      { label: 'Застава стражи', jobs: { guard: 5 }, note: 'Каждый страж даёт защиту — больше у рас с высокой обороной' },
      { label: 'Казармы', jobs: { guard: 10 }, spec: { guard: 2 }, note: 'Каждый страж даёт защиту по обороне своей расы' },
      { label: 'Военный лагерь', jobs: { guard: 15 }, spec: { guard: 3 }, fortified: true, note: 'Укреплён: повреждения этой постройке — на ступень слабее' }
    ]
  },
  workshop: {
    label: 'Мастерская', cat: 'production', size: 'medium', cost: 250, icon: 'tinker', jobs: { locksmith: 3 }, spec: { locksmith: 1 },
    tiers: [
      { label: 'Мастерская', jobs: { locksmith: 3 }, spec: { locksmith: 1 }, note: 'Слесарь: 1 простая деталь и 3 стройматериала в день' },
      { label: 'Цех', jobs: { locksmith: 5 }, spec: { locksmith: 2 }, boost: { locksmith: 50 }, perWorker: { locksmith: { steam: -2 } }, note: 'Станки: слесари +50%, по 2 пара на каждого' },
      { label: 'Мануфактура', jobs: { locksmith: 7 }, spec: { locksmith: 3 }, boost: { locksmith: 100 }, perWorker: { locksmith: { steam: -5 } }, full: { complex: 2 }, note: 'Высокоточные станки: слесари +100%, по 5 пара; все места заняты — ещё 2 сложные детали в день' }
    ]
  },
  field: {
    label: 'Поле для посадок', cat: 'production', size: 'huge', cost: 50, icon: 'wheat', jobs: { farmer: 10 }, use: { water: 50 }, seasonal: true, rain: true, crewUse: true,
    tiers: [
      { label: 'Поле для посадок', jobs: { farmer: 10 }, spec: { farmer: 1 }, use: { water: 50 }, ev: { harvest: 1 }, note: 'Фермер — 10 еды в день; вода −50, если работают (в дождь не тратится); зимой стоит' },
      { label: 'Поле парников', jobs: { farmer: 10 }, spec: { farmer: 2 }, use: { water: 50 }, perWorker: { farmer: { veg: 5 } }, winter: true, ev: { harvest: 1 }, note: 'Фермер — 15 еды; работает и зимой' },
      { label: 'Теплицы', jobs: { farmer: 10 }, spec: { farmer: 3 }, use: { water: 50 }, perWorker: { farmer: { veg: 10 } }, winter: true, fert: 50, ev: { harvest: 1 }, note: 'Фермер — 20 еды; зимой работает; есть удобрение — +50% (1 удобрение в день)' }
    ]
  },
  latrine: { label: 'Общ. уборная', cat: 'health', size: 'small', cost: 100, icon: 'tap', jobs: { septic: 1 }, ev: { clean: 1 }, note: 'Не улучшается. Септик даёт 2 удобрения в день; меньше болезней и грязи' },
  steampump: {
    label: 'Паровой насос', cat: 'resources', size: 'small', cost: 175, icon: 'valve', gain: { water: 45 }, use: { steam: 15 },
    tiers: [
      { label: 'Малый паровой насос', gain: { water: 45 }, use: { steam: 15 }, ev: { breakdown: 1 }, note: 'Иногда ломается — чинить деталями' },
      { label: 'Средний паровой насос', gain: { water: 90 }, use: { steam: 30 }, ev: { breakdown: 1 }, note: 'Размер тот же. Иногда ломается' },
      { label: 'Большой паровой насос', gain: { water: 180 }, use: { steam: 60 }, ev: { breakdown: 1 }, note: 'Размер тот же. Иногда ломается' }
    ]
  },
  storehouse: {
    label: 'Склад', cat: 'storage', size: 'large', cost: 125, icon: 'locked-box', jobs: { storekeeper: 1 }, storage: { general: 1000 },
    tiers: [
      { label: 'Склад', jobs: { storekeeper: 1 }, storage: { general: 1000 }, note: 'До 1000 каждого ресурса (кроме еды и воды); в пределах лимита ничего не ветшает' },
      { label: 'Крытый склад', jobs: { storekeeper: 2 }, storage: { general: 2000 }, ev: { guard: 1 }, note: 'До 2000; реже кражи' },
      { label: 'Складской павильон', jobs: { storekeeper: 3 }, spec: { storekeeper: 1 }, storage: { general: 4000 }, ev: { guard: 2 }, note: 'До 4000; ещё реже кражи' }
    ]
  },
  coop: {
    label: 'Курятник', cat: 'production', size: 'medium', cost: 150, icon: 'rooster', jobs: { poultry: 2 }, use: { water: 10 },
    tiers: [
      { label: 'Курятник', jobs: { poultry: 2 }, use: { water: 10 }, note: 'Птицевод — 10 мяса и 5 ТМС в день' },
      { label: 'Большой курятник', jobs: { poultry: 4 }, spec: { poultry: 1 }, use: { water: 20 } },
      { label: 'Птицезавод', jobs: { poultry: 6 }, spec: { poultry: 2 }, use: { water: 30 }, fed: 25, note: 'Обильно накормлены: еды хватает — +25%' }
    ]
  },
  machinehall: {
    label: 'Машинный зал', cat: 'industry', size: 'medium', cost: 400, icon: 'furnace', jobs: { engineer: 2 }, spec: { engineer: 1 },
    tiers: [
      { label: 'Малый машинный зал', jobs: { engineer: 2 }, spec: { engineer: 1 }, blueprints: 'зелёные', note: 'Инженер: −25 пара, +25 ТМС. Можно делать вещи по малым зелёным чертежам Энди и других' },
      { label: 'Средний машинный зал', jobs: { engineer: 4 }, spec: { engineer: 2 }, blueprints: 'синие', note: 'Чертежи до синих' },
      { label: 'Большой машинный зал', jobs: { engineer: 6 }, spec: { engineer: 3 }, blueprints: 'фиолетовые', ev: { masterwork: 1 }, note: 'Чертежи до фиолетовых; изредка сам создаёт предмет фиолетового качества' }
    ]
  },
  mill: {
    label: 'Мельница', cat: 'production', size: 'medium', cost: 250, icon: 'windmill', jobs: { miller: 2 },
    tiers: [
      { label: 'Жернова', jobs: { miller: 2 }, note: 'Мельник: 10 овощей → 10 ТМС. При улучшении у воды станет водяной' },
      { label: 'Мельница', jobs: { miller: 4 }, spec: { miller: 1 }, mill: 'wind', variants: {
        wind: { label: 'Мельница', mill: 'wind', note: 'Ветряная: в сильный ветер +100%, в штиль стоит' },
        water: { label: 'Водяная мельница', mill: 'water', note: 'Водяная: работает всегда' } } },
      { label: 'Большая мельница', jobs: { miller: 6 }, spec: { miller: 2 }, mill: 'wind', power: 15, variants: {
        wind: { label: 'Большая мельница', mill: 'wind', note: 'В сильный ветер +100%, в штиль стоит; генератор +15% пара бойлерным (в штиль — нет)' },
        water: { label: 'Большая водяная мельница', mill: 'water', note: 'Работает всегда; генератор +15% пара бойлерным' } } }
    ]
  },
  barn: {
    label: 'Амбар', cat: 'storage', size: 'large', cost: 125, icon: 'barn', jobs: { storekeeper: 1 }, storage: { food: 1000 },
    tiers: [
      { label: 'Амбар', jobs: { storekeeper: 1 }, storage: { food: 1000 }, note: 'До 1000 каждой еды; кроме еды здесь ничего не хранят' },
      { label: 'Элеватор', jobs: { storekeeper: 2 }, storage: { food: 2000 }, ev: { guard: 1 }, note: 'До 2000; реже кражи' },
      { label: 'Продовольственное хранилище', jobs: { storekeeper: 3 }, spec: { storekeeper: 1 }, storage: { food: 4000 }, ev: { guard: 2 }, note: 'До 4000; ещё реже кражи' }
    ]
  },
  tavern: {
    label: 'Таверна', cat: 'social', size: 'large', cost: 300, icon: 'tavern-sign', jobs: { innkeeper: 4 }, guests: 10, use: { water: 10 },
    tiers: [
      { label: 'Таверна', jobs: { innkeeper: 4 }, spec: { innkeeper: 1 }, guests: 10, use: { water: 10 }, ev: { social: 1 }, note: 'Гости приезжают и уезжают сами; каждый гость — 1 ТМС в день; добрые события о веселье' },
      { label: 'Постоялый двор', jobs: { innkeeper: 8 }, spec: { innkeeper: 2 }, guests: 20, use: { water: 20 }, ev: { social: 1.6 } },
      { label: 'Гостиница', jobs: { innkeeper: 12 }, spec: { innkeeper: 3 }, guests: 30, use: { water: 30 }, ev: { social: 2.2 } }
    ]
  },
  market: {
    label: 'Рынок', cat: 'economy', size: 'large', cost: 300, icon: 'cash', jobs: { trader: 4 }, trade: 10,
    tiers: [
      { label: 'Базар', jobs: { trader: 4 }, trade: 10, note: 'Торговых мест: 10 для приезжих, 4 для местных' },
      { label: 'Рынок', jobs: { trader: 6 }, spec: { trader: 1 }, trade: 20 },
      { label: 'Ярмарка', jobs: { trader: 12 }, spec: { trader: 2 }, trade: 30, perm: { morale: 0.5 }, ev: { fair: 1 }, note: 'События ярмарки, мораль' }
    ]
  },
  // круглая мощёная площадь с фонтаном: тут гуляют, собираются и бунтуют
  plaza: { label: 'Площадь', cat: 'social', size: 'large', cost: 120, icon: '/settlement/plaza.svg', perm: { morale: 0.5 }, ev: { plaza: 1 }, note: 'Не улучшается. Место гуляний и сборов, много разных событий; мораль +0,5 в день' },
  ranch: {
    label: 'Ранчо', cat: 'production', size: 'large', cost: 300, icon: 'ranch-gate', jobs: { rancher: 3 }, spec: { rancher: 1 }, use: { water: 20 },
    tiers: [
      { label: 'Скотный двор', jobs: { rancher: 3 }, spec: { rancher: 1 }, use: { water: 20 }, note: 'Животновод — 15 мяса и 5 ТМС в день' },
      { label: 'Ранчо', jobs: { rancher: 6 }, spec: { rancher: 2 }, use: { water: 40 } },
      { label: 'Скотобойня', jobs: { rancher: 9 }, spec: { rancher: 3 }, use: { water: 40 }, fed: 25, note: 'Обильно накормлены: еды хватает — +25%' }
    ]
  },
  barrels: {
    label: 'Бочки с водой', cat: 'storage', size: 'medium', cost: 50, icon: 'cellar-barrels', storage: { water: 1500, drink: 1500 },
    tiers: [
      { label: 'Бочки с водой', storage: { water: 1500, drink: 1500 }, note: 'Питьевой и простой воды — по 1500' },
      { label: 'Баки с водой', storage: { water: 3000, drink: 3000 } },
      { label: 'Цистерны с водой', storage: { water: 4500, drink: 4500 } }
    ]
  },
  well: {
    label: 'Скважина', cat: 'resources', size: 'small', cost: 100, icon: 'manual-water-pump', jobs: { watercarrier: 1 },
    tiers: [
      { label: 'Колодец', jobs: { watercarrier: 1 }, note: 'Водонос — могут работать дети' },
      { label: 'Скважина', jobs: { watercarrier: 2 }, note: 'Водоносы — могут работать дети' },
      { label: 'Артезианская скважина', jobs: { watercarrier: 3 }, ev: { mineral: 1 }, note: 'Может пробиться минеральная вода — товар' }
    ]
  },
  quarry: {
    label: 'Карьер', cat: 'resources', size: 'medium', cost: 100, icon: 'stone-pile', jobs: { miner: 3 }, spec: { miner: 1 },
    tiers: [
      { label: 'Каменоломня', jobs: { miner: 3 }, spec: { miner: 1 }, ev: { soil: 0.3 }, note: 'Очень маленький шанс найти чернозём' },
      { label: 'Карьер', jobs: { miner: 5 }, spec: { miner: 2 }, ev: { soil: 0.6 }, note: 'Маленький шанс найти чернозём' },
      { label: 'Котлован', jobs: { miner: 7 }, spec: { miner: 3 }, ev: { soil: 1 }, note: 'Умеренный шанс найти чернозём' }
    ]
  },
  garden: {
    label: 'Огород', cat: 'production', size: 'large', cost: 30, icon: 'greenhouse', jobs: { gardener: 2 }, use: { water: 15 }, seasonal: true, rain: true, crewUse: true, crops: true,
    tiers: [
      { label: 'Огород', jobs: { gardener: 2 }, use: { water: 15 }, note: 'Каждое место — на выбор 10 фруктов, овощей или трав; в дождь вода не нужна; зимой стоит' },
      { label: 'Сад', jobs: { gardener: 4 }, spec: { gardener: 1 }, use: { water: 30 } },
      { label: 'Ботанический сад', jobs: { gardener: 6 }, spec: { gardener: 2 }, use: { water: 45 }, winter: true, note: 'Работает и зимой' }
    ]
  },
  forge: {
    label: 'Кузница', cat: 'production', size: 'medium', cost: 275, icon: 'anvil-impact', jobs: { smith: 3 }, spec: { smith: 1 },
    tiers: [
      { label: 'Кузница', jobs: { smith: 3 }, spec: { smith: 1 }, note: 'Кузнец: −10 чёрных металлов, −20 угля; +15 стройматериалов, +15 ТМС' },
      { label: 'Литейная', jobs: { smith: 5 }, spec: { smith: 2 }, use: { clay: 25 }, perWorker: { smith: { steam: -10, parts: 10 } }, note: 'Ещё −10 пара и +10 простых деталей на кузнеца; глина −25 в день' },
      { label: 'Металлопрокат', jobs: { smith: 7 }, spec: { smith: 3 }, use: { clay: 25 }, perWorker: { smith: { steam: -20, parts: 10, complex: 10 } }, fullEv: { masterwork: 1 }, note: 'Ещё −20 пара, +10 простых и +10 сложных деталей; все места заняты — изредка снаряжение фиолетового качества' }
    ]
  },
  tower: {
    label: 'Башня', cat: 'military', size: 'small', cost: 100, icon: 'watchtower', jobs: { sentry: 1 }, crewDefense: true,
    tiers: [
      { label: 'Башня', jobs: { sentry: 1 }, defense: 15, ev: { watch: 1 }, note: 'Часовой: +15 к защите, может заранее заметить угрозу извне' },
      { label: 'Башня с баллистой', jobs: { sentry: 1 }, defense: 15, ev: { watch: 1, ballista: 1 }, variants: {
        ballista: { label: 'Башня с баллистой', jobs: { sentry: 1 }, defense: 15, ev: { watch: 1, ballista: 1 }, note: '+15 к защите; при угрозе снижает её опасность. Не ставится рядом с призмой' },
        prism: { label: 'Башня с призмой', jobs: { sentry: 2 }, defense: 45, ev: {}, note: '+45 к защите. Не ставится рядом с баллистой' } } },
      { label: 'Башня с орудием', jobs: { sentry: 1 }, defense: 15, ev: { watch: 1, ballista: 1, cannon: 1 }, variants: {
        ballista: { label: 'Башня с орудием', jobs: { sentry: 1 }, defense: 15, ev: { watch: 1, ballista: 1, cannon: 1 }, note: '+15; заранее замечает угрозу, одиночную может уничтожить; снижает опасность' },
        prism: { label: 'Башня-шпиль', jobs: { sentry: 2 }, defense: 90, ev: { spire: 1 }, note: '+90 к защите; во время угрозы — магический барьер, +35% к защите построек в радиусе 70 м' } } }
    ]
  },
  bath: {
    label: 'Баня', cat: 'health', size: 'medium', cost: 300, icon: 'shower', jobs: { bather: 1 }, use: { water: 15 },
    tiers: [
      { label: 'Помывочная', jobs: { bather: 1 }, use: { water: 15 }, ev: { clean: 1 }, note: 'Меньше болезней и грязи' },
      { label: 'Баня', jobs: { bather: 2 }, use: { water: 15 }, ev: { clean: 1.5 }, perm: { morale: 0.3 }, note: 'Немного морали' },
      { label: 'Спа', jobs: { bather: 3 }, spec: { bather: 1 }, use: { water: 15 }, ev: { clean: 2 }, perm: { morale: 0.6, stability: 2 }, note: 'Ещё больше морали, стабильность +2' }
    ]
  },
  healer: {
    label: 'Дом целителя', cat: 'health', size: 'medium', cost: 250, icon: 'health-normal', jobs: { healer: 3 }, spec: { healer: 1 },
    tiers: [
      { label: 'Дом целителя', jobs: { healer: 3 }, spec: { healer: 1 }, note: 'Целитель — 2 койки в «Лечении»; −5 воды за каждого больного' },
      { label: 'Больница', jobs: { healer: 6 }, spec: { healer: 2 }, recovery: 25, note: 'Каждый целитель +25% к выздоровлению' },
      { label: 'Госпиталь', jobs: { healer: 9 }, spec: { healer: 3 }, recovery: 50, ev: { health: 1 }, note: 'Каждый целитель +50% к выздоровлению; добрые события о здоровье' }
    ]
  },
  boiler: {
    label: 'Бойлерная', cat: 'industry', size: 'medium', cost: 600, icon: 'water-mill', jobs: { mechanic: 2 },
    tiers: [
      { label: 'Малая бойлерная', jobs: { mechanic: 2 }, note: 'Кочегар: −25 угля, −50 воды → +50 пара в день' },
      { label: 'Средняя бойлерная', jobs: { mechanic: 4 } },
      { label: 'Большая бойлерная', jobs: { mechanic: 6 }, spec: { mechanic: 1 }, fullBoost: 50, note: 'Вся смена на месте — выработка +50%' }
    ]
  },
  // личные дома героев — ставятся мастером, в каталог стройки не входят
  manor: { label: 'Усадьба', cat: 'personal', size: 'large', cost: 0, icon: 'player-base', personal: true },
  treehouse: { label: 'Дом на дереве', cat: 'personal', size: 'medium', cost: 0, icon: 'treehouse', personal: true }
}

/* ---------------- Цена построек ----------------
   Сколько ресурсов уходит со склада, когда стройку закладывают. Примерно по сложности: деревянное — дерево,
   каменное и печное — булыжник и глина, машины — металл и детали. Личные дома героев ставит мастер, бесплатно. */
const PRICES = {
  elder: { wood: 100, stone: 60, build: 60 },
  house: { wood: 60, build: 25, stone: 15, straw: 10 },
  dorm: { wood: 100, build: 40, stone: 20, straw: 20 },
  lumber: { wood: 50, build: 10, iron: 5 },
  hunter: { wood: 70, build: 15, straw: 10 },
  gatherer: { wood: 70, build: 15, straw: 10 },
  guardpost: { wood: 70, stone: 30, build: 20 },
  workshop: { wood: 80, stone: 60, build: 40, parts: 10 },
  field: { wood: 20, straw: 10 },
  latrine: { wood: 30, stone: 30, clay: 20 },
  steampump: { iron: 40, parts: 20, stone: 30, build: 20 },
  storehouse: { wood: 70, build: 30 },
  coop: { wood: 60, straw: 30, build: 10 },
  machinehall: { stone: 120, iron: 80, parts: 40, build: 60 },
  mill: { wood: 120, stone: 60, build: 30 },
  barn: { wood: 70, straw: 20, build: 15 },
  tavern: { wood: 140, stone: 40, build: 50, clay: 20 },
  market: { wood: 120, stone: 60, build: 40, goods: 10 },
  plaza: { stone: 120, build: 40, wood: 20 },
  ranch: { wood: 150, build: 30, straw: 40 },
  barrels: { wood: 30, iron: 5 },
  well: { stone: 50, wood: 20, iron: 10 },
  quarry: { wood: 30, iron: 10, parts: 5 },
  garden: { wood: 15 },
  forge: { stone: 100, clay: 40, iron: 30, build: 30 },
  tower: { wood: 60, stone: 20 },
  bath: { wood: 100, stone: 80, clay: 30, build: 30 },
  healer: { wood: 100, stone: 30, build: 30, herbs: 10 },
  boiler: { stone: 150, iron: 120, parts: 50, build: 80, clay: 40 }
}
for (const [k, p] of Object.entries(PRICES)) BUILDINGS[k].price = p

/* ---------------- Повреждения построек ----------------
   work — на сколько постройка ещё работает (места, жильё, выработка, траты, защита);
   repair — доля цены и сложности постройки, которую стоит ремонт (разрушенную — отстроить целиком) */
export const DAMAGE = {
  minor: { label: 'Малое повреждение', short: 'малое', color: '#e8c33a', work: 0.9, repair: 0.15, hint: 'трещины и сорванная кровля — почти всё работает' },
  medium: { label: 'Среднее повреждение', short: 'среднее', color: '#ff9a3c', work: 0.6, repair: 0.35, hint: 'часть помещений не годится' },
  major: { label: 'Обширное повреждение', short: 'обширное', color: '#e0503a', work: 0.3, repair: 0.65, hint: 'держится на честном слове' },
  ruined: { label: 'Разрушено', short: 'разрушено', color: '#7a736b', work: 0, repair: 1, hint: 'одни руины — не работает совсем' }
}
export const DAMAGE_ORDER = ['minor', 'medium', 'major', 'ruined']
export const worseDamage = (a, b) => (DAMAGE_ORDER.indexOf(b) > DAMAGE_ORDER.indexOf(a) ? b : a || b)
export const damageEff = b => (b?.damage && DAMAGE[b.damage] ? DAMAGE[b.damage].work : 1)
export function repairPrice(b) {
  const d = DAMAGE[b?.damage]
  if (!d) return {}
  return Object.fromEntries(Object.entries(BUILDINGS[b.type]?.price || {}).map(([k, v]) => [k, Math.ceil(v * d.repair)]))
}
export const repairWork = b => Math.max(5, Math.round((BUILDINGS[b?.type]?.cost || 100) * (DAMAGE[b?.damage]?.repair || 0)))
// чего не хватает на складе: [{ res, need, have }]
export function shortFor(stock = {}, price = {}) {
  return Object.entries(price).filter(([k, v]) => (stock[k] || 0) < v).map(([k, v]) => ({ res: k, need: v, have: Math.floor(stock[k] || 0) }))
}
export const priceText = price => Object.entries(price || {}).map(([k, v]) => `${RES[k]?.label || k} ${v}`).join(', ')

/* ---------------- Работы ----------------
   per — выработка и траты одного рабочего в день; spec — слоты специалистов и бонус каждого к выработке (доля);
   effects — подписи эффектов: {label, per} (на рабочего) или {label, text} */
export const JOBS = {
  smith: { label: 'Кузнец', icon: 'anvil-impact', per: { build: 15, goods: 15, iron: -10, coal: -20 }, spec: 1, specBonus: 0.15 },
  septic: { label: 'Септик', icon: 'tap', per: { fertilizer: 2 }, effects: [{ label: 'Уборка нечистот', pct: true }] },
  hunter: { label: 'Охотник', icon: 'target-arrows', per: { meat: 8 }, spec: 2, specBonus: 0.25, group: 3, effects: [{ label: 'Группы охотников', group: true }] },
  gatherer: { label: 'Собиратель', icon: 'gift-trap', per: { fruit: 8, herbs: 1 }, spec: 2, specBonus: 0.15, group: 3, effects: [{ label: 'Группы собирателей', group: true }] },
  // защита стража — по обороне его расы (среднее по поселению): defense × оборона / 2
  guard: { label: 'Страж', icon: 'barracks-tent', spec: 2, group: 3, defense: 10, raceDef: true, effects: [{ label: 'Группы воинов', group: true }, { label: 'Снижение опасности', per: 4, unit: '%' }] },
  sentry: { label: 'Часовой', icon: 'watchtower', effects: [{ label: 'Башни под присмотром', pct: true }] },
  locksmith: { label: 'Слесарь', icon: 'tinker', per: { parts: 1, build: 3 }, spec: 1, specBonus: 0.5, effects: [{ label: 'Ускорение стройки', per: 8.75, unit: '%' }, { label: 'Изготовление', text: 'Инструменты' }] },
  farmer: { label: 'Фермер', icon: 'wheat', per: { veg: 10, straw: 5 }, spec: 2, specBonus: 0.15, specOnly: ['veg'] },
  innkeeper: { label: 'Трактирщик', icon: 'tavern-sign', per: { fruit: -8 }, spec: 2, leisure: 17.5, morale: 0.5, effects: [{ label: 'Досуг', per: 17.5 }, { label: 'Мораль в день', per: 0.5, sign: true }] },
  trader: { label: 'Торговец', icon: 'cash', effects: [{ label: 'Торговля', text: 'идёт' }] },
  mechanic: { label: 'Кочегар', icon: 'water-mill', per: { steam: 50, coal: -25, water: -50 }, spec: 1, specBonus: 0.15, specOnly: ['steam'] },
  poultry: { label: 'Птицевод', icon: 'rooster', per: { meat: 10, goods: 5 }, spec: 1, specBonus: 0.15 },
  engineer: { label: 'Инженер', icon: 'furnace', per: { goods: 25, steam: -25 }, spec: 1, specBonus: 0.15 },
  miller: { label: 'Мельник', icon: 'windmill', per: { goods: 10, veg: -10 }, spec: 1, specBonus: 0.15 },
  rancher: { label: 'Животновод', icon: 'ranch-gate', per: { meat: 15, goods: 5 }, spec: 1, specBonus: 0.15 },
  // садовод: что растит каждое место — выбирают в карточке огорода (фрукты, овощи или травы)
  gardener: { label: 'Садовод', icon: 'greenhouse', per: {}, crop: 10, spec: 1, specBonus: 0.15 },
  bather: { label: 'Банщик', icon: 'shower', effects: [{ label: 'Чистота', pct: true }] },
  storekeeper: { label: 'Кладовщик', icon: 'locked-box', effects: [{ label: 'Замедление порчи', text: '−25%' }, { label: 'Размер склада', text: '+25%' }] },
  healer: { label: 'Целитель', icon: 'health-normal', per: { herbs: -2 }, spec: 2, beds: 2, effects: [{ label: 'Койки в «Лечении»', per: 2 }, { label: 'Болезни', per: -7.5, unit: '%' }] },
  lumberjack: { label: 'Лесоруб', icon: 'axe-in-stump', per: { wood: 12, fiber: 1 }, spec: 3, specBonus: 0.15, specOnly: ['wood'] },
  miner: { label: 'Шахтёр', icon: 'stone-pile', per: { stone: 10 }, spec: 3, specBonus: 0.2, specOnly: ['stone'] },
  // kids — работу могут делать дети (сначала берём их)
  watercarrier: { label: 'Водонос', icon: 'manual-water-pump', per: { drink: 80 }, kids: true, effects: [{ label: 'Могут работать дети', text: 'да' }] }
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
  quick: { label: 'Временно', color: '#2c6fd6' },
  decide: { label: 'Требует решения', color: '#1f7a3a' },
  urgent: { label: 'Срочно', color: '#c2361f' }
}
// «Срочно»: столько дней на решение по умолчанию, потом событие становится хуже
export const URGENT_DAYS = 2
export const ASSET_FRAMES = { purple: '#a07cff', blue: '#4f8cff', green: '#7ccf4a', gold: '#e6c27a' }

/* ---------------- Уровни построек ---------------- */
// постройка со своим уровнем: поля уровня поверх полей постройки
export function tierOf(b) {
  const d = BUILDINGS[b?.type]
  if (!d) return null
  const max = d.tiers?.length || 1
  const level = Math.max(1, Math.min(max, Math.round(b.level || 1)))
  const t = d.tiers?.[level - 1] || {}
  // у уровня бывают варианты (башня с баллистой или призмой, ветряная или водяная мельница) — b.variant
  const v = t.variants ? t.variants[b.variant] || t.variants[Object.keys(t.variants)[0]] : null
  return { ...d, ...t, ...(v || {}), variants: t.variants, level, maxLevel: max, variant: v ? b.variant || Object.keys(t.variants)[0] : null }
}
export const tierLabel = b => tierOf(b)?.label || BUILDINGS[b?.type]?.label || 'Постройка'
// значок: имя из набора game-icons или своя картинка (путь)
export const iconSrc = n => (n && n.startsWith('/') ? n : `/settlement/${n || 'help'}.png`)
// цена и работа улучшения до уровня to: из уровня, иначе — от цены постройки
export function upgradePrice(type, to) {
  const d = BUILDINGS[type]
  const t = d?.tiers?.[to - 1]
  if (t?.price) return t.price
  return Object.fromEntries(Object.entries(d?.price || {}).map(([k, v]) => [k, Math.ceil(v * 0.75 * (to - 1))]))
}
export const upgradeWork = (type, to) => BUILDINGS[type]?.tiers?.[to - 1]?.cost || Math.round((BUILDINGS[type]?.cost || 100) * (to - 1))
// почему постройку сейчас не улучшить (null — можно)
export function upgradeBlock(s, b, c = computeSettlement(s)) {
  const t = tierOf(b)
  if (!t) return 'Нет такой постройки'
  if (t.level >= t.maxLevel) return 'Уже высший уровень'
  if ((b.state || 'built') !== 'built') return 'Сначала достройте'
  if (b.damage) return 'Сначала почините'
  if (b.upgrade) return 'Уже улучшают'
  if (!t.gov && t.level + 1 > c.gov.maxLevel) return `Нужно управление выше: сейчас постройки до ${c.gov.maxLevel} уровня`
  return null
}

/* ---------------- Показатели: мораль, стабильность, угрозы ----------------
   все три — от −100 до 100. Ниже нуля — чаще дурные события, угроза у −100 — набегов почти нет */
export const STAT_RANGE = { morale: [-100, 100], stability: [-100, 100], threat: [-100, 100] }
export const clampStat = (k, v) => {
  const [lo, hi] = STAT_RANGE[k] || [-1e9, 1e9]
  return Math.max(lo, Math.min(hi, Math.round((Number(v) || 0) * 10) / 10))
}
// не больше стольких морали за раз (день или событие)
export const MORALE_TICK = 15
// рост морали тяжелеет к верху: при 0 и ниже — в полную силу, при 100 — 15%; падение — как есть
export function moraleGain(cur, d) {
  if (d > 0) d *= Math.max(0.15, 1 - (Math.max(0, cur) / 100) * 0.85)
  return Math.round(Math.max(-MORALE_TICK, Math.min(MORALE_TICK, d)) * 10) / 10
}
// откуда мораль за день: [{ label, value }] и итог с учётом «чем выше, тем труднее»
export function moraleDay(s, c = computeSettlement(s)) {
  const parts = []
  const push = (label, value) => { if (value) parts.push({ label, value: Math.round(value * 10) / 10 }) }
  push('Трактирщики', c.jobMorale)
  push('Постройки', c.perm.morale)
  const stock = s.stock || {}
  const hungry = ['veg', 'meat'].some(k => c.balance[k] < 0 && (stock[k] || 0) < -c.balance[k])
  push(hungry ? 'Голод' : 'Еды хватает', hungry ? -4 : 1)
  const thirsty = c.balance.drink < 0 && (stock.drink || 0) < -c.balance.drink
  push(thirsty ? 'Жажда' : 'Воды хватает', thirsty ? -4 : 1)
  if (c.housing.cap && c.housing.used > c.housing.cap) push('Теснота', -2)
  if (c.unavailableParts.sick) push('Больные', -Math.min(3, c.unavailableParts.sick * 0.2))
  // настроение само тянется к нулю: к хорошему привыкают, плохое забывается
  push(c.morale > 0 ? 'Привыкание' : 'Отходят', -c.morale * 0.02)
  const plus = parts.filter(p => p.value > 0).reduce((n, p) => n + p.value, 0)
  const minus = parts.filter(p => p.value < 0).reduce((n, p) => n + p.value, 0)
  const total = Math.max(-MORALE_TICK, Math.min(MORALE_TICK, moraleGain(c.morale, plus) + minus))
  return { parts, total: Math.round(total * 10) / 10 }
}

/* ---------------- Стройка ----------------
   на стройке, ремонте и улучшении работают назначенные жители (b.builders = { раса: сколько });
   каждый даёт очки по своей расе, слесари ускоряют, без стройматериалов — вчетверо медленнее */
export const isWorksite = b => (b.state || 'built') === 'construction' || !!b.repair || !!b.upgrade
export function buildRate(s, b, c = computeSettlement(s)) {
  const speedUp = (c.jobs.locksmith?.workers || 0) * 8.75
  const slow = (s.stock?.build || 0) <= 0 && c.balance.build < 0 ? 0.25 : 1
  let pts = 0
  const parts = []
  for (const [race, n] of Object.entries(b.builders || {})) {
    const r = RACES[race]
    if (!r || !n) continue
    const bonus = r.buildMorale && c.morale > r.buildMorale.above ? 1 + r.buildMorale.pct / 100 : 1
    const v = n * (r.build ?? 4) * bonus
    pts += v
    parts.push({ race, n, value: Math.round(v * 10) / 10 })
  }
  return { pts: Math.round(pts * (1 + speedUp / 100) * slow * 10) / 10, parts, speedUp, slow }
}
// сколько очков работы осталось на площадке
export function worksiteLeft(b) {
  if ((b.state || 'built') === 'construction') return Math.max(0, (BUILDINGS[b.type]?.cost || 100) - (b.progress || 0))
  if (b.upgrade) return Math.max(0, upgradeWork(b.type, b.upgrade.to) - (b.upgrade.progress || 0))
  if (b.repair) return Math.max(0, repairWork(b) - (b.repair.progress || 0))
  return 0
}

/* ---------------- Свои правила мастера ----------------
   мастер правит постройки, расы и работы на вкладке «Постройки»; правки ложатся поверх исходных справочников */
const BASE = { buildings: structuredClone(BUILDINGS), races: structuredClone(RACES), jobs: structuredClone(JOBS) }
export const baseRules = () => structuredClone(BASE)
export function applySettlementRules(r) {
  for (const [target, base, key] of [[BUILDINGS, BASE.buildings, 'buildings'], [RACES, BASE.races, 'races'], [JOBS, BASE.jobs, 'jobs']]) {
    for (const k of Object.keys(target)) if (!base[k]) delete target[k]
    for (const [k, v] of Object.entries(base)) target[k] = structuredClone(v)
    for (const [k, v] of Object.entries(r?.[key] || {})) {
      if (!v || typeof v !== 'object') continue
      target[k] = { ...(target[k] || {}), ...structuredClone(v) }
    }
  }
  for (const d of Object.values(BUILDINGS)) {
    d.label ||= 'Постройка'
    if (!CATEGORIES[d.cat]) d.cat = 'production'
    if (!SIZES[d.size]) d.size = 'medium'
  }
}

/* ---------------- Сезоны и погода ----------------
   год — 4 сезона по 30 игровых дней; погода на каждый день своя (от зерна поселения и дня — у всех одна),
   с поправкой на сезон; мастер может поставить погоду на сегодня сам (s.weather = { day, kind }) */
export const SEASON_DAYS = 30
export const SEASONS = [
  { key: 'spring', label: 'Весна', icon: '🌱' },
  { key: 'summer', label: 'Лето', icon: '☀' },
  { key: 'autumn', label: 'Осень', icon: '🍂' },
  { key: 'winter', label: 'Зима', icon: '❄' }
]
export const seasonOf = day => SEASONS[Math.floor(((((day || 0) % (SEASON_DAYS * 4)) + SEASON_DAYS * 4) % (SEASON_DAYS * 4)) / SEASON_DAYS)]
export const WEATHER = {
  clear: { label: 'Ясно', icon: '☀', hint: 'обычный день' },
  rain: { label: 'Дождь', icon: '🌧', hint: 'поля и огороды не тратят воду' },
  wind: { label: 'Сильный ветер', icon: '🌬', hint: 'ветряные мельницы работают вдвое' },
  calm: { label: 'Штиль', icon: '〰', hint: 'ветряные мельницы стоят' },
  snow: { label: 'Снег', icon: '🌨', hint: 'зима' }
}
const WEATHER_ODDS = {
  spring: [['rain', 0.3], ['wind', 0.15], ['calm', 0.1], ['clear', 0.45]],
  summer: [['rain', 0.15], ['wind', 0.1], ['calm', 0.2], ['clear', 0.55]],
  autumn: [['rain', 0.3], ['wind', 0.25], ['calm', 0.1], ['clear', 0.35]],
  winter: [['snow', 0.35], ['wind', 0.2], ['calm', 0.15], ['clear', 0.3]]
}
function hash32(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) }
  // перемешать биты — соседние дни не должны быть похожи
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16
  return (h >>> 0) / 4294967296
}
export function weatherOf(s, day = s?.day || 0) {
  if (s?.weather?.day === day && WEATHER[s.weather.kind]) return s.weather.kind
  let r = hash32(`${s?.id || 'settlement'}:weather:${day}`)
  for (const [k, p] of WEATHER_ODDS[seasonOf(day).key]) { if ((r -= p) <= 0) return k }
  return 'clear'
}
/* склады: лимит каждого ресурса. Еда — в амбарах, вода — в бочках, остальное — на складах; без них — по 300 */
export const STORE_BASE = 300
export const storeKind = k => (['veg', 'fruit', 'meat'].includes(k) ? 'food' : k === 'water' ? 'water' : k === 'drink' ? 'drink' : k === 'steam' ? null : 'general')
export const STORE_LABEL = { general: 'Склады', food: 'Амбары', water: 'Бочки (вода)', drink: 'Бочки (питьевая)' }

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
// сколько жителей в отряде (активы и герои — не жители)
const squadPeople = q => Object.values(q?.lines || {}).flat().reduce((n, u) => n + (u?.race ? u.count || 0 : 0), 0)

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
  let housing = 0, guests = 0, trade = 0, defenseB = 0, houseCap = 0, power = 0
  const places = {}, specSlots = {}
  const storage = { general: STORE_BASE, food: STORE_BASE, water: STORE_BASE, drink: STORE_BASE }
  const day = s.day || 0, season = seasonOf(day), weather = weatherOf(s, day)
  // рабочие места по постройкам — по ним раскладываем работников (у каждой постройки свои бонусы)
  const slots = {}
  const gain = {}, use = {}
  const perm = { threat: 0, stability: 0, morale: 0 }
  const gov = { head: 0, managers: 0, outposts: 0, maxLevel: 0, label: '' }
  const ev = {}
  const specGains = []
  // повреждённая постройка работает не в полную силу, разрушенная — никак
  for (const b of built) {
    const t = tierOf(b)
    if (!t) continue
    const e = damageEff(b)
    if (!e) continue
    const tag = b.damage ? `${t.label} (${DAMAGE[b.damage].short})` : t.label
    housing += Math.round((t.housing || 0) * e)
    if (b.type === 'house') houseCap += Math.round((t.housing || 0) * e)
    guests += Math.round((t.guests || 0) * e)
    trade += Math.round((t.trade || 0) * e)
    // защита башни — только когда на ней часовой (считаем ниже, по местам)
    if (!t.crewDefense) defenseB += Math.round((t.defense || 0) * e)
    for (const [k, v] of Object.entries(t.storage || {})) storage[k] = (storage[k] || 0) + Math.round(v * e)
    for (const [j, n] of Object.entries(t.jobs || {})) {
      places[j] = (places[j] || 0) + Math.round(n * e)
      ;(slots[j] ||= []).push({ b, t, n: Math.round(n * e), e, tag })
    }
    for (const [j, n] of Object.entries(t.spec || {})) specSlots[j] = (specSlots[j] || 0) + n
    for (const [k, v] of Object.entries(t.gain || {})) add(gain, k, v * e, tag)
    // траты, что идут только когда в постройке работают (поле, огород), — считаем ниже, по занятым местам
    if (!t.crewUse) for (const [k, v] of Object.entries(t.use || {})) add(use, k, v * e, tag)
    for (const k of Object.keys(perm)) perm[k] += t.perm?.[k] || 0
    for (const [k, v] of Object.entries(t.ev || {})) ev[k] = round((ev[k] || 0) + v * e)
    if (t.gov && (t.gov.maxLevel || 0) >= gov.maxLevel) Object.assign(gov, t.gov, { label: t.label })
    for (const j of Object.keys(t.jobs || {})) if (t.specGain) specGains.push({ job: j, gain: t.specGain, e, tag })
  }
  gov.maxLevel ||= 1
  // слоты управляющих и аванпостов: от управления (Двор старейшины → Ратуша → Магистрат), мастер может дать больше
  const managerSlots = Math.max(gov.managers || 0, s.managerSlots || 0) || 2
  const outpostSlots = Math.max(gov.outposts || 0, s.stats?.outpostSlots || 0)

  // работы: выработка, траты, специалисты, эффекты; дети — только там, где можно (kids)
  const assets = Object.fromEntries((s.assets || []).map(a => [a.id, a]))
  const jobs = {}
  let leisure = 0, morale = 0, defenseJ = 0, adultWork = 0, kidsLeft = kids, kidWork = 0, beds = 0, recovery = 0
  // средняя оборона взрослых жителей (для стражи)
  const raceDef = adults ? races.reduce((n, r) => n + ((r.male || 0) + (r.female || 0)) * (RACES[r.race]?.def || 2), 0) / adults : 2
  for (const [key, def] of Object.entries(JOBS)) {
    const st = s.jobs?.[key] || {}
    const workers = Math.min(st.workers || 0, places[key] || 0)
    if (!places[key] && !st.workers) continue
    const kidsHere = def.kids ? Math.min(workers, kidsLeft) : 0
    kidsLeft -= kidsHere
    kidWork += kidsHere
    adultWork += workers - kidsHere
    const nSpec = specSlots[key] ?? def.spec ?? 0
    const specs = (st.specialists || []).slice(0, nSpec)
    const specBonus = specs.filter(Boolean).length * (def.specBonus || 0)
    const out = {}
    const put = (k, v, label) => {
      if (!v) return
      out[k] ||= { base: 0, bonus: 0 }
      if (label === 'bonus') out[k].bonus = round(out[k].bonus + v)
      else out[k].base = round(out[k].base + v)
    }
    // раскладываем работников по постройкам по порядку; у каждой — сезон, погода, станки, «вся смена», корм, удобрение
    let left = workers, active = 0
    for (const sl of slots[key] || [{ b: null, t: {}, n: workers, e: 1, tag: def.label }]) {
      const w = Math.min(left, sl.n)
      left -= w
      if (!w) continue
      const t = sl.t
      // зима: поля и огороды без «работает зимой» стоят; мельница: ветряная — от погоды, водяная — всегда
      let k = 1
      if (t.seasonal && season.key === 'winter' && !t.winter) k = 0
      if (t.mill === 'wind') k *= weather === 'wind' ? 2 : weather === 'calm' ? 0 : 1
      if (!k) continue
      active += w
      const full = w >= sl.n
      const fed = t.fed && (s.stock?.veg || 0) > 0 && (s.stock?.meat || 0) > 0 ? t.fed : 0
      const fert = t.fert && (s.stock?.fertilizer || 0) >= 1 ? t.fert : 0
      if (fert) add(use, 'fertilizer', 1, sl.tag)
      const boost = ((t.boost?.[key] || 0) + (full ? t.fullBoost || 0 : 0) + fed + fert) / 100
      const per = { ...(def.per || {}) }
      for (const [r, v] of Object.entries(t.perWorker?.[key] || {})) per[r] = (per[r] || 0) + v
      // огород: каждое место растит своё (b.crops), по умолчанию — овощи
      if (def.crop) for (let i = 0; i < w; i++) { const c = sl.b?.crops?.[i] || 'veg'; per['__' + c] = (per['__' + c] || 0) + def.crop / w }
      for (const [r0, v] of Object.entries(per)) {
        const r = r0.startsWith('__') ? r0.slice(2) : r0
        const amount = v * w * k
        if (amount > 0) {
          const extra = amount * boost + ((!def.specOnly || def.specOnly.includes(r)) ? amount * specBonus : 0)
          add(gain, r, amount, sl.tag); put(r, amount)
          if (extra) { add(gain, r, extra, sl.tag + ' (бонусы)'); put(r, extra, 'bonus') }
        } else if (amount < 0) { add(use, r, -amount, sl.tag); put(r, amount) }
      }
      // траты постройки, пока в ней работают (вода поля — кроме дождя)
      if (t.crewUse) for (const [r, v] of Object.entries(t.use || {})) if (!(t.rain && r === 'water' && (weather === 'rain' || weather === 'snow'))) add(use, r, v * sl.e, sl.tag)
      // вся смена на месте — особая выработка
      if (full) for (const [r, v] of Object.entries(t.full || {})) add(gain, r, v * sl.e, sl.tag + ' (вся смена)')
      if (full) for (const [r, v] of Object.entries(t.fullEv || {})) ev[r] = round((ev[r] || 0) + v)
      // башня с часовым — защита; мельница-генератор — пар бойлерных
      if (t.crewDefense) defenseB += Math.round((t.defense || 0) * sl.e)
      if (t.power && (t.mill !== 'wind' || weather !== 'calm')) power += t.power
      if (def.beds) beds += def.beds * w
      if (t.recovery) recovery += t.recovery * w
    }
    // «есть специалист — возят доски» и подобное
    if (specs.some(Boolean)) for (const g of specGains.filter(x => x.job === key)) for (const [k, v] of Object.entries(g.gain)) add(gain, k, v * g.e, g.tag + ' (специалист)')
    leisure += (def.leisure || 0) * workers
    morale += (def.morale || 0) * workers
    // страж защищает по обороне своей расы (средней в поселении): 10 × оборона / 2
    defenseJ += (def.defense || 0) * workers * (def.raceDef ? raceDef / 2 : 1)
    jobs[key] = {
      places: places[key] || 0, workers, idle: workers - active, kids: kidsHere, supply: st.supply ?? (def.per ? 100 : null), out,
      groups: def.group ? Math.floor(workers / def.group) : null,
      // специалист — актив (по id) или просто имя; у имени может быть свой значок (specIcons)
      specialists: Array.from({ length: nSpec }, (_, i) => specs[i] ? (assets[specs[i]] || { name: specs[i], icon: st.specIcons?.[i] || '' }) : null),
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
    adultWork += o.workers || 0
    for (const [k, v] of Object.entries(o.yields || {})) add(gain, k, v, `Аванпост «${OUTPOSTS[o.type]?.label || o.name}»`)
  }
  // строители на площадках
  let builders = 0
  for (const b of s.buildings || []) if (isWorksite(b)) builders += Object.values(b.builders || {}).reduce((n, v) => n + (v || 0), 0)
  adultWork += builders

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

  // генератор больших мельниц: +N% пара бойлерных
  if (power && gain.steam) {
    const boiler = (gain.steam.parts || []).filter(p => !p.label.includes('Генератор')).reduce((n, p) => n + p.value, 0)
    add(gain, 'steam', boiler * power / 100, 'Генератор мельниц')
  }
  // гости таверн: каждый — 1 ТМС в день
  const guestsNow = Math.min(guests, s.stats?.guestsUsed || 0)
  if (guestsNow) add(gain, 'goods', guestsNow, 'Гости таверны')

  // поправки мастера (то, что сайт не считает сам)
  for (const a of s.adjust || []) (a.value > 0 ? add(gain, a.res, a.value, a.label || 'Поправка') : add(use, a.res, -a.value, a.label || 'Поправка'))

  // военные показатели: боевые жители × потенциал расы + стража, постройки и активы
  const passive = {}
  for (const a of s.assets || []) for (const p of [...(a.passive || []), ...(a.role?.effects || [])]) if (p.stat) passive[p.stat] = (passive[p.stat] || 0) + (p.value || 0)
  const warRaces = races.reduce((n, r) => n + (r.combat || 0) * (RACES[r.race]?.war || 0), 0)
  const defRaces = races.reduce((n, r) => n + (r.combat || 0) * (RACES[r.race]?.def || 0), 0)
  const st = s.stats || {}
  const defenseW = wallDefense(s.walls || [])

  // недоступные: больные в лечебнице, ушедшие с отрядами (по округе или на карте мира), и кого мастер отметил сам
  const sick = (s.hospital || []).reduce((n, p) => n + (p.who?.race ? p.count || 1 : p.who?.name ? 1 : 0), 0)
  const away = (s.army?.squads || []).filter(q => q.status === 'out' || q.status === 'local').reduce((n, q) => n + squadPeople(q), 0)
  const manual = st.unavailable || 0
  const unavailable = sick + away + manual
  // занятые: на работах, аванпостах, стройках и «прочее» (мастер); свободные — остальные взрослые
  const busy = adultWork + (st.otherBusy || 0)
  const free = Math.max(0, adults - busy - unavailable)

  return {
    population, adults, kids,
    free, busy, unavailable, unavailableParts: { sick, away, manual }, builders, kidWork, overbooked: Math.max(0, busy + unavailable - adults),
    combat: sum('combat'), important: sum('important'), wounded: sum('wounded'),
    count, places, specSlots, jobs,
    housing: { cap: housing, used: st.housingUsed ?? Math.min(population, housing) },
    houses: { cap: houseCap, used: st.housesUsed ?? houseCap },
    damaged: built.filter(b => b.damage && DAMAGE[b.damage]),
    guests: { cap: guests, used: guestsNow },
    season, weather, storage, beds, recovery, raceDef: round(raceDef),
    caps: Object.fromEntries(RESOURCES.map(r => [r.key, storeKind(r.key) ? storage[storeKind(r.key)] : null])),
    trade: { cap: trade, used: st.tradeUsed || 0 },
    war: { total: warRaces + (passive.war || 0), races: warRaces, assets: passive.war || 0 },
    defense: { total: defRaces + defenseJ + defenseB + defenseW + (passive.defense || 0), races: defRaces, guards: defenseJ, buildings: defenseB, walls: defenseW, assets: passive.defense || 0 },
    leisure: { total: leisure + (passive.leisure || 0), jobs: leisure, assets: passive.leisure || 0 },
    jobMorale: round(morale),
    // постоянные баффы построек ложатся поверх: угроза −2 от Двора старейшины и т. п.
    perm, gov, managerSlots, outpostSlots, ev,
    morale: clampStat('morale', st.morale ?? 0),
    stability: clampStat('stability', (st.stability ?? 0) + perm.stability), stabilityBase: st.stability ?? 0,
    threat: clampStat('threat', (st.threat ?? 0) + perm.threat), threatBase: st.threat ?? 0,
    gain, use,
    balance: Object.fromEntries(RESOURCES.map(r => [r.key, round((gain[r.key]?.total || 0) - (use[r.key]?.total || 0))]))
  }
}

/* ---------------- Геометрия мини-карты (метры) ---------------- */
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
function samples(f, step = Math.max(3, f.side / 6)) {
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
  const f = footprint(b)
  if (!f.side || b.x == null || b.y == null) return []
  const out = []
  if (f.x < 0 || f.y < 0 || f.x + f.w > WORLD || f.y + f.h > WORLD) return ['за краем карты']
  const pts = samples(f)
  const gen = makeTerrain(s.terrain)
  const o = {}
  const codes = new Set(pts.map(p => gen.sample(p[0], p[1], o).code))
  if (codes.has(TB.WATER)) out.push('в воде')
  if (codes.has(TB.SWAMP)) out.push('в болоте')
  if (codes.has(TB.RAVINE)) out.push('в овраге')
  // дороги: сперва отбираем отрезки рядом с квадратом (по рамкам), потом проверяем точки — иначе на каждое движение мыши тысячи отрезков
  const near = []
  for (const r of s.roads || []) {
    const pad = roadW(r) / 2 + 1, bb = roadBox(r)
    if (bb[0] - pad > f.x + f.w || bb[2] + pad < f.x || bb[1] - pad > f.y + f.h || bb[3] + pad < f.y) continue
    const c = roadCurve(r)
    for (let i = 1; i < c.length; i++) {
      const a = c[i - 1], q = c[i]
      if (Math.min(a[0], q[0]) - pad > f.x + f.w || Math.max(a[0], q[0]) + pad < f.x || Math.min(a[1], q[1]) - pad > f.y + f.h || Math.max(a[1], q[1]) + pad < f.y) continue
      near.push([a, q, pad])
    }
  }
  if (near.length && pts.some(p => near.some(([a, q, pad]) => segDist(p, a, q) < pad))) out.push('на дороге')
  const ex = (s.explored || []).filter(e => !e.r || (Math.abs(e.x - b.x) < e.r + f.side && Math.abs(e.y - b.y) < e.r + f.side))
  if (pts.some(p => !explored({ explored: ex }, p))) out.push('за пределами разведанной земли')
  for (const q of s.buildings || []) {
    if (q.id === ignoreId || q.x == null) continue
    const g = footprint(q)
    if (g.side && f.x < g.x + g.w + 2 && g.x < f.x + f.w + 2 && f.y < g.y + g.h + 2 && g.y < f.y + f.h + 2) { out.push(`впритык к «${q.name || BUILDINGS[q.type]?.label}»`); break }
  }
  return out
}
// постройка в лесу — под ней вырубка (круг чуть больше квадрата), иначе null
export function clearingFor(s, b) {
  const f = footprint(b)
  if (!f.side || b.x == null) return null
  const gen = makeTerrain(s.terrain)
  const o = {}
  const wooded = samples(f).some(p => [TB.FOREST, TB.CONIFER, TB.SHRUB].includes(gen.sample(p[0], p[1], o).code))
  return wooded ? { x: Math.round(b.x), y: Math.round(b.y), r: Math.round(f.side * 0.75 + 4) } : null
}

/* ---------------- Перевод на большую карту (17×17 км) ---------------- */
export const MAP_VERSION = 2
// старое поселение (маленькая нарисованная карта) → большая карта из генератора:
// постройки уходят в список «не расставлены» (продолжают считаться), аванпосты — далеко, туман заново
export function upgradeSettlementMap(s, seed = 1917) {
  if (s.terrain?.v === MAP_VERSION) return false
  s.terrain = { v: MAP_VERSION, seed, params: {} }
  const gen = makeTerrain(s.terrain)
  for (const b of s.buildings || []) { b.x = null; b.y = null }
  const want = { mine: [TB.ROCK], quarry: [TB.ROCK], logging: [TB.FOREST, TB.CONIFER] }
  ;(s.outposts || []).forEach((o, i) => Object.assign(o, gen.findSpot(want[o.type] || [TB.MEADOW], 3500, 7500, i + 1)))
  s.explored = [
    { name: s.name || 'Поселение', x: CENTER, y: CENTER, r: 1300 },
    ...(s.outposts || []).map(o => ({ name: OUTPOSTS[o.type]?.label || 'Аванпост', x: o.x, y: o.y, r: 350 }))
  ]
  s.roads = []
  s.clearings = []
  for (const o of s.orders || []) {
    if (o.status === 'pending' && (o.build || o.explore)) Object.assign(o, { status: 'rejected', reply: 'Карта поселения переделана — отдай приказ заново', decidedAt: Date.now() })
  }
  return true
}
