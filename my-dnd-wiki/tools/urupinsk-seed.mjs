// Собирает стартовый Урюпинск (server/seed/urupinsk.json) из старой таблицы — см. docs/urupinsk/README.md.
//   node tools/urupinsk-seed.mjs        — пересобрать и проверить раскладку построек
// Мини-карта 1600×1300 единиц. Старые районы: Север (600–1000 × 40–440), Запад, Центр, Восток (по 400 в ряд, 440–840).
import fs from 'node:fs'
import path from 'node:path'
import { placementProblems, computeSettlement, BUILDINGS } from '../src/shared/settlement.js'

const W = 1600, H = 1300

/* ---------- местность ---------- */
const terrain = {
  w: W, h: H,
  // вода: море на юге (по старым районам — берег у Запада, залив у Востока), озеро на Севере
  water: [
    { kind: 'sea', points: [[-60, 742], [90, 752], [220, 768], [360, 778], [480, 790], [570, 818], [660, 858], [760, 880], [860, 874], [945, 846], [1000, 800], [1040, 758], [1090, 732], [1150, 728], [1205, 750], [1222, 800], [1236, 858], [1300, 892], [1480, 900], [1660, 914], [1660, 1360], [-60, 1360]] },
    { kind: 'lake', points: [[812, 92], [850, 66], [910, 58], [962, 72], [988, 104], [980, 142], [940, 164], [884, 168], [836, 152], [810, 124]] },
    { kind: 'river', points: [[1412,896], [1428,860], [1446,820], [1462,770], [1486,724], [1514,690], [1552,664], [1610,640], [1670,626], [1660,616], [1660,642], [1676,652], [1620,666], [1570,688], [1536,716], [1512,750], [1490,800], [1472,848], [1456,888]] }
  ],
  // лес — зоны, деревья внутри рисуются на клиенте
  forest: [
    { points: [[560, -40], [1060, -40], [1080, 60], [1000, 190], [1030, 300], [1000, 420], [820, 430], [810, 300], [760, 230], [690, 150], [600, 210], [560, 330], [560, 430], [400, 430], [380, 260], [430, 80]] },
    { points: [[-60, -60], [520, -60], [380, 120], [330, 300], [360, 430], [200, 450], [120, 560], [-60, 600]] },
    { points: [[1080, -60], [1660, -60], [1660, 560], [1500, 600], [1420, 560], [1300, 470], [1240, 440], [1190, 300], [1110, 210], [1120, 90]] },
    { points: [[1010, 440], [1110, 440], [1130, 500], [1090, 560], [1030, 570], [1010, 520]] },
    { points: [[210, 690], [560, 700], [600, 740], [560, 770], [470, 760], [360, 752], [230, 744]] },
    { points: [[-60, 640], [190, 660], [200, 740], [-60, 740]] }
  ],
  // скалы у каменоломни и шахты
  rocks: [{ x: 560, y: 160, r: 58 }, { x: 1040, y: 250, r: 50 }, { x: 610, y: 110, r: 30 }],
  // дороги: w — ширина
  roads: [
    { w: 22, points: [[150, 640], [600, 640], [738, 640]] }, // главная улица с запада к площади
    { w: 22, points: [[862, 640], [1060, 640], [1120, 600], [1150, 520], [1170, 430], [1190, 330]] }, // на восток и к вырубке
    { w: 22, points: [[800, 40], [800, 300], [800, 578]] }, // на север
    { w: 20, points: [[800, 702], [800, 868]] }, // к берегу
    { w: 16, points: [[620, 520], [980, 520]] }, // верхняя улица центра
    { w: 16, points: [[620, 765], [980, 765]] }, // нижняя улица центра
    { w: 16, points: [[630, 520], [630, 765]] },
    { w: 16, points: [[970, 520], [970, 765]] },
    { w: 16, points: [[260, 520], [600, 520], [620, 520]] }, // улица Запада
    { w: 14, points: [[400, 520], [400, 640]] },
    { w: 14, points: [[410, 640], [410, 712]] }, // к усадьбе Хироши
    { w: 16, points: [[1060, 640], [1080, 700], [1170, 704], [1222, 668]] }, // к полю и бочкам
    { w: 14, points: [[800, 300], [700, 250], [640, 190], [600, 150]] }, // к шахте
    { w: 14, points: [[800, 230], [870, 200], [900, 175]] }, // к озеру
    { w: 14, points: [[1000, 300], [1040, 290]] }, // к каменоломне
    { w: 14, points: [[800, 300], [1000, 300]] }
  ],
  plaza: { x: 800, y: 640, r: 62 },
  // граница территории — как точечное кольцо вокруг Урюпинска на большой карте
  territory: { x: 800, y: 500, r: 760 }
}

/* ---------- разведанная земля (вместо районов) ---------- */
const explored = [
  { name: 'Север', points: [[600, 40], [1000, 40], [1000, 440], [600, 440]] },
  { name: 'Запад', points: [[200, 440], [600, 440], [600, 860], [200, 860]] },
  { name: 'Центр', points: [[600, 440], [1000, 440], [1000, 900], [600, 900]] },
  { name: 'Восток', points: [[1000, 440], [1400, 440], [1400, 860], [1000, 860]] },
  { name: 'Шахта', x: 590, y: 150, r: 85 },
  { name: 'Каменоломня', x: 1040, y: 290, r: 75 },
  { name: 'Вырубка', x: 1210, y: 330, r: 80 }
]

/* ---------- постройки (примерно там же, где стояли в старых районах) ---------- */
let n = 0
const B = (type, x, y, extra = {}) => ({ id: 'b' + String(++n).padStart(3, '0'), type, x, y, state: 'built', ...extra })
const buildings = [
  // Центр
  B('elder', 702, 576), B('tavern', 898, 576), B('storehouse', 702, 706), B('healer', 896, 700), B('latrine', 852, 738),
  B('guardpost', 664, 476), B('guardpost', 726, 476), B('forge', 858, 476), B('hunter', 920, 476), B('hunter', 976, 476),
  B('workshop', 950, 700), B('coop', 664, 806), B('coop', 724, 806), B('gatherer', 868, 806), B('gatherer', 930, 806),
  B('house', 600, 580), B('house', 600, 700), B('house', 660, 860), B('dorm', 532, 702), B('dorm', 900, 380), B('well', 765, 470), B('well', 760, 814),
  // Запад
  B('house', 300, 480), B('house', 360, 480), B('house', 460, 480), B('house', 520, 480), B('house', 300, 580), B('house', 350, 580),
  B('market', 486, 580), B('dorm', 250, 580), B('manor', 300, 690, { name: 'Усадьба Хироши', owner: 'hs11' }), B('latrine', 446, 690), B('well', 540, 520 + 0)
]
// Восток
buildings.push(
  B('house', 1060, 490), B('house', 1060, 550), B('house', 1120, 560 + 30), B('dorm', 1340, 500), B('treehouse', 1180, 470, { name: 'Дом Цуруи', owner: 'hs07' }),
  B('field', 1310, 770), B('boiler', 1120, 690), B('barrels', 1180, 760), B('latrine', 1180, 650),
  B('steampump', 1100, 760), B('steampump', 1150, 770), B('steampump', 1210, 790),
  // стена — на всё поселение, на карте не стоит
  { id: 'b' + String(++n).padStart(3, '0'), type: 'wall', x: 0, y: 0, state: 'built' }
)

/* ---------- жители ---------- */
const races = [
  { race: 'hobgoblin', male: 10, female: 8, kids: 4, free: 0, workers: 18, combat: 2, important: 0, wounded: 0 },
  { race: 'fenris', male: 16, female: 10, kids: 7, free: 5, workers: 21, combat: 17, important: 1, wounded: 0 },
  { race: 'kitsune', male: 4, female: 6, kids: 2, free: 1, workers: 6, combat: 2, important: 0, wounded: 0 },
  { race: 'human', male: 12, female: 7, kids: 3, free: 1, workers: 18, combat: 6, important: 1, wounded: 0 },
  { race: 'highelf', male: 8, female: 10, kids: 2, free: 2, workers: 16, combat: 3, important: 0, wounded: 0 },
  { race: 'centaur', male: 6, female: 4, kids: 2, free: 2, workers: 8, combat: 8, important: 2, wounded: 0 },
  { race: 'neko', male: 4, female: 2, kids: 0, free: 0, workers: 6, combat: 3, important: 1, wounded: 0 }
]

/* ---------- активы (рамка — просто украшение, как в старой таблице) ---------- */
const assets = [
  { id: 'klaus', name: 'Клаус Ариста', frame: 'purple', portrait: '/settlement/portraits/klaus.png',
    passive: [{ text: 'Стабильность +10', stat: 'stability', value: 10 }, { text: 'Защита +10', stat: 'defense', value: 10 }, { text: 'Военный потенциал +20', stat: 'war', value: 20 }],
    role: { kind: 'manager', effects: [{ text: 'Конфликты −30%' }, { text: 'Разведка +10%' }] } },
  { id: 'turman', name: 'Турман Циг', frame: 'blue',
    passive: [{ text: 'Досуг +5', stat: 'leisure', value: 5 }, { text: 'Военный потенциал +10', stat: 'war', value: 10 }],
    role: { kind: 'specialist', effects: [{ text: 'Особые рецепты' }, { text: 'Стабильность +5', stat: 'stability', value: 5 }] } },
  { id: 'furman', name: 'Фурман Циг', frame: 'blue',
    passive: [{ text: 'Мораль +5', stat: 'morale', value: 5 }, { text: 'Военный потенциал +5', stat: 'war', value: 5 }],
    role: { kind: 'specialist', effects: [{ text: 'Особые рецепты' }, { text: 'Мораль +5', stat: 'morale', value: 5 }] } },
  { id: 'valia', name: 'Валия Карат', frame: 'green',
    passive: [{ text: 'Мораль +15', stat: 'morale', value: 15 }, { text: 'Военный потенциал +5', stat: 'war', value: 5 }] },
  { id: 'polosatik', name: 'Полосатик', frame: 'green', companion: true,
    passive: [{ text: 'Успех охоты +10%' }, { text: 'Военный потенциал +5', stat: 'war', value: 5 }],
    note: { text: 'Выпрашивает еду', color: '#ff9b4a' } },
  { id: 'solaris', name: 'Солярис', frame: 'purple',
    passive: [{ text: 'Стабильность +15', stat: 'stability', value: 15 }, { text: 'Мораль +30', stat: 'morale', value: 30 }],
    note: { text: 'Развивается', color: '#6fd6e8' } },
  { id: 'fayegen', name: 'Фэйген', frame: 'blue',
    passive: [{ text: 'Стабильность +5', stat: 'stability', value: 5 }, { text: 'Изучение территории +30%' }],
    role: { kind: 'specialist', effects: [{ text: 'Поиск +10%' }, { text: 'Военный потенциал +20', stat: 'war', value: 20 }] } }
]

/* ---------- работы: сколько занято и кто специалист ---------- */
const jobs = {
  smith: { workers: 3, specialists: [] },
  septic: { workers: 3 },
  hunter: { workers: 8, specialists: ['Лидер охотников', 'Ловчий'] },
  gatherer: { workers: 8, specialists: [null, 'Травница'] },
  guard: { workers: 5, specialists: [null, 'fayegen'] },
  locksmith: { workers: 4, supply: 50, specialists: ['Бригадир'] },
  farmer: { workers: 10, specialists: ['Агроном', 'Агроном'] },
  innkeeper: { workers: 4, specialists: ['turman', 'furman'] },
  trader: { workers: 3 },
  mechanic: { workers: 2 },
  poultry: { workers: 4 },
  storekeeper: { workers: 1 },
  healer: { workers: 2, specialists: [null, 'Знахарь'] }
}

/* ---------- аванпосты ---------- */
const outposts = [
  { id: 'o1', type: 'mine', x: 590, y: 150, places: 5, workers: 5, specialist: 'Шахтёр', yields: { iron: 25, coal: 45 }, state: 'active' },
  { id: 'o2', type: 'quarry', x: 1040, y: 290, places: 5, workers: 5, specialist: 'Каменщик', yields: { stone: 150, clay: 40 }, state: 'active' },
  { id: 'o3', type: 'logging', x: 1210, y: 330, places: 5, workers: 5, specialist: 'Лесоруб', yields: { wood: 125, fiber: 30 }, state: 'depleting' }
]

/* ---------- поправки: то, что старая таблица учитывала, а расчёт пока нет ---------- */
const adjust = [
  { res: 'wood', value: 50, label: 'Сбор хвороста жителями' },
  { res: 'wood', value: -74.1, label: 'Стройка (из старой таблицы)' },
  { res: 'stone', value: -28, label: 'Стройка (из старой таблицы)' },
  { res: 'build', value: -60, label: 'Стройка (из старой таблицы)' },
  { res: 'clay', value: -10, label: 'Стройка (из старой таблицы)' }
]

/* ---------- журнал: уведомления поселения + влияние из старого листа «Эффекты» ---------- */
let e = 0
const E = (title, type, duration, deadline, text, decision, effect = '') => ({ id: 'e' + String(++e).padStart(3, '0'), title, type, duration, deadline, text, decision, effect, location: 'Урюпинск', createdAt: Date.parse('2026-04-20') + e * 3600e3 })
const events = [
  E('Спокойствие', 'approve', ['permanent'], null, 'У нас достаточно еды! Поэтому никто не голодает. Мы довольны!', 'Заебись (лайк)', 'Еды достаточно. Мораль +0.2/житель'),
  E('Спокойствие', 'approve', ['permanent'], null, 'У нас достаточно воды! Поэтому никто не испытывает жажды. Мы довольны!', 'Заебись (лайк)', 'Воды достаточно. Мораль +0.2/житель'),
  E('Стабильность', 'message', ['permanent'], null, 'У нас всё спокойно и каждый житель на своём месте. Это умиротворяет.', 'Заебись (лайк)', 'В поселении всё спокойно. Стабильность +25'),
  E('Нехватка ресурса', 'problem', ['decide'], null, 'У нас маловато «Стройматериалы». Поэтому строительство сильно замедлилось. Как мы решим эту проблему, господин Белатор?', 'Наймём несколько мастеров из Ширатори, а также построим 2е новых мастерских.', 'Не хватает «Стройматериалы». Скорость строительства −75%'),
  E('Строительство завершено', 'done', ['quick'], '2026-04-30', 'Мы наконец завершили крупный проект! Мы построили «Деревянную стену». Теперь жители чувствуют себя в безопасности за стенами. А мы теперь можем выставлять патрули!', 'Лично Белатор займётся тренировкой новых солдат', 'Постройка «Деревянная стена» завершена'),
  E('Новый район', 'done', ['quick'], '2026-05-07', 'Мы полностью исследовали и разведали новую местность на Севере. Теперь там основан новый район. Можно строить, господин Белатор! Жители немного обрадовались этому событию', 'Будем расширяться (ставить новые дома для жизни граждан)', 'Разведана земля на Севере'),
  E('Ранчо', 'message', ['decide'], '2026-05-07', 'Господин Белатор, быть может нам стоит построить «Ранчо»? Это хороший источник (Мясной пищи), а главное мы сможем тратить излишки (Соломы).', 'Соглашаюсь на эту идею, но только когда мы построим мастерские и решим проблему с материалами', 'Жители предлагают построить «Ранчо»'),
  E('Аванпост выработан', 'important', ['decide'], '2026-05-07', 'Господин Белатор, (Аванпост) «Вырубка» сворачивает деятельность. Так как там осталось мало деревьев. Дальнейшая рубка уничтожит часть леса. Мы же не хотим этого? Впрочем мы можем вырубить эту часть леса полностью. Однако некоторые жители это не одобрят…', 'Займёмся вырубкой чуть дальше, в сторону шахты, а также начнём создание дороги для простого доступа к ресурсам земли', 'Аванпост «Вырубка» был выработан и закрыт'),
  E('Обрушение в шахте', 'alarm', ['decide'], '2026-05-14', 'Господин Белатор! При добыче (Угля) на (Аванпосте) «Шахта» обрушился один из тоннелей. К счастью никто из рабочих сильно не пострадал. Надо оперативно решить эту проблему. Пока кого нибудь не засыпало в этой шахте!', 'Выполню переобучение для шахтёров, так как защита и здоровье граждан это самое важное. Деятельность в шахтах приостановить но переобучения.', 'На аванпосте «Шахта» произошёл инцидент'),
  E('Новые товары!', 'message', ['routine'], '2026-05-14', 'В наше поселение прибыл (Караван) из 5 торговцев Кицунэ. Они привезли разные товары прямо из Ширатори. Наши поселенцы с радостью покупают товары! А поселение получает с этого дополнительный доход!', 'Заебись (лайк)', 'В поселение прибыл торговый караван «Кицунэ»'),
  E('Дикие Варги!', 'threat', ['decide', 'quick'], '2026-05-14', 'В окрестностях нашего поселения охотники обнаружили мигрирующие стаи «Варгов». Надо что-то предпринять господин Белатор. Варги в любой момент могут совершить набег на поселение. Кроме того они представляют опасность для наших охотников и собирателей!', 'Обсудить с охотниками и фермерами вариант с приручением диких собак, но не в коем случае не рисковать здоровьем граждан', 'В окрестных лесах появились опасные монстры! Угроза +45')
]

const settlement = {
  id: 'urupinsk', name: 'Урюпинск', cityId: 'c8', kind: 'Деревня', status: 'Спокойствие',
  headHeroId: 'hs02', managers: ['klaus'], managerSlots: 2, deciders: [],
  stats: { morale: 64, stability: 35, threat: 45, freeSettlers: 34, unavailable: 0, housingUsed: 79, housesUsed: 48, guestsUsed: 0, tradeUsed: 5, outpostSlots: 4 },
  stock: {}, races, buildings, jobs, assets, outposts, adjust, events, terrain, explored, createdAt: Date.now()
}

/* ---------- раскладка: постройка, которая мешает, ищет ближайшее свободное место по спирали ---------- */
const probe = { terrain, explored, buildings: [] }
for (const b of buildings) {
  if (BUILDINGS[b.type].size !== 'settlement' && placementProblems(probe, b).length) {
    const x0 = b.x, y0 = b.y
    search: for (let r = 6; r < 220; r += 6) {
      for (let a = 0; a < Math.PI * 2; a += 6 / r) {
        b.x = Math.round(x0 + Math.cos(a) * r); b.y = Math.round(y0 + Math.sin(a) * r)
        if (!placementProblems(probe, b).length) break search
      }
      b.x = x0; b.y = y0
    }
  }
  probe.buildings.push(b)
}

/* ---------- проверка ---------- */
let bad = 0
for (const b of buildings) {
  if (BUILDINGS[b.type].size === 'settlement') continue
  const p = placementProblems(settlement, b)
  if (p.length) { bad++; console.log(`✗ ${b.id} ${BUILDINGS[b.type].label} (${b.x},${b.y}): ${p.join(', ')}`) }
}
const c = computeSettlement(settlement)
console.log(`население ${c.population}, жильё ${c.housing.used}/${c.housing.cap}, дома ${c.houses.used}/${c.houses.cap}, ВП ${c.war.total}, защита ${c.defense.total}, досуг ${c.leisure.total}`)
for (const k of Object.keys(c.balance)) if (c.gain[k] || c.use[k]) console.log(`  ${k}: +${c.gain[k]?.total || 0} −${c.use[k]?.total || 0}`)
console.log('мест:', JSON.stringify(c.places))
fs.writeFileSync(path.resolve(import.meta.dirname, '..', 'server', 'seed', 'urupinsk.json'), JSON.stringify(settlement))
console.log(bad ? `\n${bad} построек мешают` : '\nраскладка чистая', '→ server/seed/urupinsk.json')
