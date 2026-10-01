#!/usr/bin/env node
/*
  Импорт карты из Azgaar FMG → слои сайта + стартовая база.

    node tools/import-fmg.cjs <bundle.json | папка-с-экспортом> [--reset-db]

  Пишет:
    public/map/*.svg         — векторные слои (океан, рельеф, биомы, реки, государства, границы, подписи)
    public/map/states.json   — геометрия государств (для наведения/клика)
    server/seed/anacaria.json — стартовая база (города, дороги, государства, туман, примеры аномалий)
  С --reset-db также перезаписывает server/data/db.json (текущие правки мастера будут потеряны!).
*/
const fs = require('fs')
const path = require('path')
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom')

const ROOT = path.resolve(__dirname, '..')
const src = process.argv[2]
const resetDb = process.argv.includes('--reset-db')
if (!src) {
  console.error('Usage: node tools/import-fmg.cjs <bundle.json | export-dir> [--reset-db]')
  process.exit(1)
}

let files, data
if (fs.statSync(src).isDirectory()) {
  files = {}
  for (const f of fs.readdirSync(src)) if (f.endsWith('.svg') && f !== 'view.svg') files[f] = fs.readFileSync(path.join(src, f), 'utf8')
  data = JSON.parse(fs.readFileSync(path.join(src, 'data.json'), 'utf8'))
} else {
  ({ files, data } = JSON.parse(fs.readFileSync(src, 'utf8')))
}

/* ---------------- SVG layers: keep only defs that are actually referenced ---------------- */
const LABEL_FONT = "Georgia, 'Times New Roman', serif"

function refsOf(str) {
  const out = new Set()
  for (const m of str.matchAll(/url\(#([^)"']+)\)/g)) out.add(m[1])
  for (const m of str.matchAll(/href="#([^"]+)"/g)) out.add(m[1])
  return out
}

function trimSvg(svgText) {
  const doc = new DOMParser({ onError: () => {} }).parseFromString(svgText, 'image/svg+xml')
  const ser = new XMLSerializer()
  const root = doc.documentElement
  const defs = root.getElementsByTagName('defs')[0]
  const byId = new Map()
  const walk = el => {
    for (let c = el.firstChild; c; c = c.nextSibling) {
      if (c.nodeType !== 1) continue
      const id = c.getAttribute('id')
      if (id) byId.set(id, c)
      walk(c)
    }
  }
  walk(defs)
  const bodyParts = []
  for (let c = root.firstChild; c; c = c.nextSibling) if (c !== defs && c.nodeType === 1) bodyParts.push(ser.serializeToString(c))
  let body = bodyParts.join('')
  // в FMG маска суши навешивается снаружи группы — без неё суша закрашивает весь океан
  if (!/id="landmass"[^>]*mask=/.test(body)) body = body.replace('id="landmass"', 'id="landmass" mask="url(#land)"')

  const needed = new Set()
  const queue = [...refsOf(body)]
  while (queue.length) {
    const id = queue.pop()
    if (needed.has(id) || !byId.has(id)) continue
    needed.add(id)
    for (const r of refsOf(ser.serializeToString(byId.get(id)))) queue.push(r)
  }
  // skip elements whose ancestor is already included
  const isInsideNeeded = el => {
    for (let p = el.parentNode; p && p !== defs; p = p.parentNode) {
      if (p.getAttribute && needed.has(p.getAttribute('id'))) return true
    }
    return false
  }
  const defsOut = [...needed].map(id => byId.get(id)).filter(el => !isInsideNeeded(el)).map(el => ser.serializeToString(el)).join('')

  body = body.replace(/font-family="[^"]*"/g, `font-family="${LABEL_FONT}"`)
  // FMG keeps some sizes as % of the viewport — they break inside a standalone image
  body = body.replace(/style="text-shadow:[^"]*"/g, '')
  const W = root.getAttribute('width'), H = root.getAttribute('height')
  // координаты с 13 знаками после запятой не нужны — сильно экономит размер
  const short = s => s.replace(/(\d+\.\d)\d+/g, '$1').replace(/ xmlns="http:\/\/www\.w3\.org\/2000\/svg"/g, '')
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${short(defsOut)}</defs>${short(body)}</svg>`
}

const outMap = path.join(ROOT, 'public', 'map')
fs.mkdirSync(outMap, { recursive: true })
for (const [name, text] of Object.entries(files)) {
  const out = trimSvg(text)
  fs.writeFileSync(path.join(outMap, name), out)
  console.log(`  ${name.padEnd(12)} ${(text.length / 1024).toFixed(0).padStart(6)} KB → ${(out.length / 1024).toFixed(0).padStart(6)} KB`)
}

/* ---------------- Geometry helpers ---------------- */
const r2 = n => Math.round(n * 100) / 100

function parsePolys(d) {
  return d.split(/M/i).filter(s => s.trim()).map(part => {
    const nums = part.match(/-?\d+(\.\d+)?(e-?\d+)?/gi).map(Number)
    const pts = []
    for (let i = 0; i + 1 < nums.length; i += 2) pts.push([r2(nums[i]), r2(nums[i + 1])])
    return pts
  })
}

function simplify(pts, tol) {
  if (pts.length < 4) return pts
  const sq = tol * tol
  const segDist = (p, a, b) => {
    let x = a[0], y = a[1], dx = b[0] - x, dy = b[1] - y
    if (dx || dy) {
      const t = Math.max(0, Math.min(1, ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy)))
      x += dx * t; y += dy * t
    }
    return (p[0] - x) ** 2 + (p[1] - y) ** 2
  }
  const keep = new Uint8Array(pts.length)
  keep[0] = keep[pts.length - 1] = 1
  const stack = [[0, pts.length - 1]]
  while (stack.length) {
    const [a, b] = stack.pop()
    let max = 0, idx = -1
    for (let i = a + 1; i < b; i++) {
      const d = segDist(pts[i], pts[a], pts[b])
      if (d > max) { max = d; idx = i }
    }
    if (max > sq) { keep[idx] = 1; stack.push([a, idx], [idx, b]) }
  }
  return pts.filter((_, i) => keep[i])
}

/* ---------------- Names: transliteration (manual — reads better than automatic) ---------------- */
const CITY_RU = {
  Shiratori: 'Сиратори', Kanojo: 'Канодзё', Taseko: 'Тасэко', Mizui: 'Мидзуи', Uichi: 'Уити', Arisui: 'Арисуи',
  Hashi: 'Хаси', Urupinsk: 'Урюпинск', Mariko: 'Марико', Asahi: 'Асахи', Toyokawa: 'Тоёкава', Kiyomizu: 'Киёмидзу',
  Hino: 'Хино', Misono: 'Мисоно', Yugen: 'Югэн', Matsushita: 'Мацусита', Fujinoki: 'Фудзиноки',
  Belshoy: 'Бельшой', Niri: 'Нири', Grungroick: 'Грунгроик', Antinida: 'Антинида', Ciliren: 'Цилирен',
  Enmunet: 'Энмунет', Lagrasse: 'Лаграсс', 'Egru o Sate': 'Эгру-о-Сате', Faesset: 'Фэссет', Moonlicht: 'Мунлихт',
  Levitria: 'Левитрия', Jerry: 'Джерри', Momoto: 'Момото', Yadir: 'Ядир', Tarbent: 'Тарбент', Rachanta: 'Раханта',
  Irfalona: 'Ирфалона', 'Enel Alari': 'Энель-Алари', Galsethyr: 'Галсетир', Felidorei: 'Фелидорей',
  Tseshhaysth: 'Цешхайст', Zedgrul: 'Зедгрул', Danguan: 'Дангуан', Murdrar: 'Мурдрар', GATE: 'Гейт',
  RedCode0: 'Рэдкод-0', Sarag: 'Сараг', Revel: 'Ревел', Jorkar: 'Йоркар', Evsin: 'Эвсин', Nixied: 'Никсид',
  Feldon: 'Фелдон', Vezgaxur: 'Везгаксур', Krenevent: 'Креневент', Gildiar: 'Гилдиар', Logred: 'Логред',
  Fardor: 'Фардор', Erorog: 'Эророг', Orus: 'Орус', Artenar: 'Артенар', Elden: 'Элден', "Tor'gash": "Тор'гаш",
  Suvan: 'Суван', Hamram: 'Хамрам', Cuddi: 'Кудди', Favi: 'Фави', Hadjat: 'Хаджат', Lafeb: 'Лафеб', Surin: 'Сурин',
  Mubiir: 'Мубиир', Varhur: 'Вархур', Osmarn: 'Осмарн', Sholcen: 'Шолцен', Runn: 'Рунн', Eberbakh: 'Эбербах',
  Colbarn: 'Колбарн', Zeiclin: 'Цайклин', Arvencz: 'Арвенц', Stockmen: 'Штокмен', Boelly: 'Бёлли', Shebu: 'Шебу',
  Nekkha: 'Некха', Kutudet: 'Кутудет', Fanonis: 'Фанонис', Nemufu: 'Немуфу', Aksety: 'Аксети', Geso: 'Гесо',
  Cusfu: 'Кусфу', Farre: 'Фарре', Bessy: 'Бесси', Amarana: 'Амарана', Rocca: 'Рокка', Covires: 'Ковирес',
  Dalcis: 'Дальцис', Gersala: 'Герсала', Missolaos: 'Миссолаос', Casco: 'Каско', Albura: 'Альбура', Galero: 'Галеро',
  Peralora: 'Пералора', Namrye: 'Намрье', Cekesen: 'Чекесен', Kizad: 'Кизад', Busolick: 'Бусолик', Arrad: 'Аррад',
  Tsalag: 'Цалаг', Berbag: 'Бербаг', Caldon: 'Калдон', Tutford: 'Татфорд', Neequ: 'Нику', Malces: 'Малсес',
  Danyang: 'Даньян', Henton: 'Хентон', Schon: 'Шён', Soldalla: 'Солдалла', Vendret: 'Вендрет', Zahret: 'Захрет',
  Lerastao: 'Лерастао', Gnok: 'Гнок', Geth: 'Гет', Indandeir: 'Индандейр', Olucan: 'Олукан', Xarvil: 'Ксарвил',
  Uristhar: 'Уристар', Blus: 'Блус', Gauroth: 'Гаурот', Murdum: 'Мурдум', Vung: 'Вунг', Rovan: 'Рован',
  Sanguin: 'Сангвин', Achart: 'Ашарт', Anelea: 'Анелея', Lesia: 'Лезия', Magra: 'Магра', Omen: 'Омен', Kalgler: 'Калглер'
}

const ROUTE_RU = {
  'Uichian pass': 'Перевал Уити', 'Urupinsk pass': 'Урюпинский перевал', 'Mizuian pass': 'Перевал Мидзуи',
  'Arisuian pass': 'Перевал Арисуи', 'Arisuian trail': 'Тропа Арисуи', 'Antinidan track': 'Антинидский тракт',
  'Nirian path': 'Нирийский путь', 'Nirian trail': 'Нирийская тропа', 'Belshan track': 'Бельшойский тракт',
  'Ciliren trail': 'Цилиренская тропа', 'Lagrassean trail': 'Лаграсская тропа', 'Logred trail': 'Логредская тропа',
  'Hamrish path': 'Хамрамский путь', 'Berporpor trail': 'Тропа Берпорпор',
  'The Rustic Prescastbuan trail': 'Старая Прескастбуанская тропа', 'The Echoing Ciliren road': 'Эхо-дорога Цилирена',
  'Colbarnese track': 'Колбарнский тракт', 'Arvencz track': 'Арвенцкий тракт', 'Enmunet trail': 'Энмунетская тропа',
  'Enmunet pass': 'Энмунетский перевал', 'Ghranese road': 'Гранская дорога', 'Zatitahan trail': 'Затитаханская тропа',
  'Scandan trail': 'Скандская тропа', 'Flower highway': 'Цветочный большак', 'Covirian road': 'Ковиресская дорога',
  'Halcyon route': 'Безмятежный путь', 'Halcyon road': 'Безмятежная дорога', 'Molten way': 'Плавленый путь',
  'Galeran route': 'Галеровский путь', 'Gilded road': 'Золочёная дорога', 'The Sacred Frost road': 'Дорога Священного Инея',
  'The Misty Thorn road': 'Дорога Туманного Терна', 'Namryean road': 'Намрьенская дорога', 'Silvered route': 'Посеребрённый путь',
  'The Rustic Cursed road': 'Старая Проклятая дорога', 'Tsalagan highway': 'Цалагский большак',
  'The Breezy Moonlit way': 'Ветреный Лунный путь', 'Iron road': 'Железный тракт', 'Obsidian road': 'Обсидиановая дорога',
  'The Frosty Neequan road': 'Морозная Никуанская дорога', 'Danyang way': 'Даньянский путь', 'Neequan highway': 'Никуанский большак',
  'Wild highway': 'Дикий большак', 'Dawn route': 'Путь Рассвета', 'Dawn road': 'Дорога Рассвета', 'Vungan route': 'Вунгский путь',
  'Vendretan route': 'Вендретский путь', 'The Breezy Wild way': 'Ветреный Дикий путь', 'Grand road': 'Великая дорога',
  'Ebon route': 'Эбеновый путь', 'Shadowy route': 'Сумрачный путь', 'Shadowy road': 'Сумрачная дорога',
  'Lerastaan route': 'Лерастаоский путь', 'The Breezy Twilight route': 'Ветреный Сумеречный путь',
  'The Sacred Soldallan road': 'Священная Солдаллская дорога', 'Wild road': 'Дикая дорога', 'Echo road': 'Дорога Эха',
  'The Great Moon road': 'Дорога Великой Луны', 'Platinum road': 'Платиновая дорога', 'Magran route': 'Магрский путь',
  'Omenese road': 'Оменская дорога', 'Sanguinese road': 'Сангвинская дорога'
}

const missing = new Set()
function cityName(n) {
  const k = n.trim().replace(/\s+/g, ' ')
  if (k === '???' || /[а-яё]/i.test(k)) return k
  if (!CITY_RU[k]) missing.add(k)
  return CITY_RU[k] || k
}
function routeName(n) {
  const k = (n || '').trim().replace(/\s+/g, ' ')
  if (!k || /^Unnamed/i.test(k)) return ''
  if (!ROUTE_RU[k]) missing.add(k)
  return ROUTE_RU[k] || k
}
function routeType(n) {
  const k = (n || '').toLowerCase()
  if (/highway/.test(k)) return 'highway'
  if (/trail|path|pass/.test(k)) return 'trail'
  return 'road'
}

/* ---------------- Подписи территорий: вынимаем из labels.svg, чтобы их можно было править ---------------- */
// FMG: группа labels 100px × группа state 22% × textPath N% = размер шрифта в px
// Подпись храним как { x, y, angle, size, bend, wrap }: центр, наклон, размер, изгиб (кривизна дуги), две строки
function extractStateLabels(svg) {
  const out = {}
  if (!svg) return out
  const groupPct = Number((svg.match(/data-group="state"[^>]*font-size="([\d.]+)%"/) || [])[1] || 22)
  for (const m of svg.matchAll(/<path id="textPath_stateLabel(\d+)"[^>]*d="([^"]+)"/g)) {
    const id = m[1]
    const nums = m[2].match(/-?\d+(\.\d+)?/g).map(Number)
    const pts = []
    for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]])
    const textEl = (svg.match(new RegExp(`<text id="stateLabel${id}"[^>]*>[\\s\\S]*?</text>`)) || [''])[0]
    const tr = textEl.match(/translate\(([-\d.]+),\s*([-\d.]+)\)/)
    const [tx, ty] = tr ? [Number(tr[1]), Number(tr[2])] : [0, 0]
    const pct = Number((textEl.match(/font-size="([\d.]+)%"/) || [])[1] || 100)
    const p0 = pts[0], p1 = pts[pts.length - 1]
    const pm = pts.length >= 7 ? pts[3] : [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2]
    const dx = p1[0] - p0[0], dy = p1[1] - p0[1]
    const c = Math.hypot(dx, dy) || 1
    // смещение середины дуги от хорды (в локальной системе подписи, ось y вниз)
    const mid = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2]
    const localY = ((pm[0] - mid[0]) * -dy + (pm[1] - mid[1]) * dx) / c
    const bend = Math.abs(localY) < 0.5 ? 0 : (-8 * localY) / (c * c)
    out['s' + id] = {
      x: r2(pm[0] + tx), y: r2(pm[1] + ty),
      angle: r2((Math.atan2(dy, dx) * 180) / Math.PI),
      size: r2((100 * groupPct / 100) * pct / 100),
      bend: Math.round(bend * 1e5) / 1e5,
      wrap: /<tspan/.test(textEl)
    }
  }
  return out
}

/* ---------------- Seed DB ---------------- */
// Регионы, которые прячем под туман по умолчанию (сюжетные «???» на исходной карте)
const FOGGED_STATES = [36, 39, 40, 41]

const stateLabels = extractStateLabels(files['labels.svg'])
const states = data.states.filter(s => s.i > 0 && !s.removed && s.name).map(s => ({
  id: 's' + s.i,
  label: stateLabels['s' + s.i] || (s.pole ? { x: r2(s.pole[0]), y: r2(s.pole[1]), angle: 0, size: 18, bend: 0, wrap: false } : null),
  name: s.name,
  color: /^#/.test(s.color || '') ? s.color : '#8a8a8a',
  capitalId: s.capital ? 'c' + s.capital : null,
  pole: s.pole ? [r2(s.pole[0]), r2(s.pole[1])] : null,
  description: '',
  secret: '',
  hidden: false
}))

const statePaths = data.paths
  .filter(p => /^state\d+$/.test(p.id))
  .map(p => ({ stateId: 's' + p.id.slice(5), d: p.d.replace(/(\d+\.\d{2})\d+/g, '$1') }))
fs.writeFileSync(path.join(outMap, 'states.json'), JSON.stringify(statePaths))

const cities = data.burgs.map(b => {
  const p = b.population || 0
  const population = Math.round(Number.isInteger(p) ? p : p * 1000)
  return {
    id: 'c' + b.i,
    name: cityName(b.name),
    x: r2(b.x),
    y: r2(b.y),
    type: b.capital ? 'capital' : (b.group === 'cities' ? 'city' : 'town'),
    port: !!b.port,
    stateId: b.state ? 's' + b.state : null,
    population,
    description: '',
    secret: '',
    hidden: FOGGED_STATES.includes(b.state)
  }
})

const roads = data.routes.filter(r => r.points && r.points.length > 1).map(r => ({
  id: 'r' + r.i,
  name: routeName(r.name),
  type: r.group === 'searoutes' ? 'sea' : routeType(r.name),
  points: r.points.map(p => [r2(p[0]), r2(p[1])]),
  description: '',
  hidden: false
}))

const fog = []
for (const sid of FOGGED_STATES) {
  const p = data.paths.find(x => x.id === 'state' + sid)
  if (!p) continue
  for (const poly of parsePolys(p.d)) {
    if (poly.length < 3) continue
    // радиус «кисти» по краю — чтобы туман чуть заходил за границу региона
    fog.push({ id: 'f-s' + sid + '-' + fog.length, mode: 'add', shape: 'poly', r: 6, points: simplify(poly, 0.8) })
  }
}

const now = Date.now()
const DAY = 86400000
const EXAMPLE = 'Пример аномалии (видна только мастеру). Отредактируй, открой игрокам или удали.'
const anomalies = [
  { id: 'a1', kind: 'zone', effect: 'storm', name: 'Буря Безмолвия', x: 905, y: 640, radius: 42, description: EXAMPLE },
  { id: 'a2', kind: 'zone', effect: 'rift', name: 'Разлом Удалин', x: 640, y: 300, radius: 30, description: EXAMPLE },
  { id: 'a3', kind: 'zone', effect: 'mist', name: 'Серый туман', x: 1060, y: 880, radius: 48, description: EXAMPLE },
  { id: 'a4', kind: 'zone', effect: 'arcane', name: 'Блуждающий всплеск арканы', x: 820, y: 560, radius: 24, toX: 960, toY: 450, activeFrom: now, activeTo: now + 7 * DAY, description: EXAMPLE + ' Движется по карте неделю, потом исчезнет.' },
  { id: 'a5', kind: 'point', effect: 'portal', name: 'Древний портал', x: 560, y: 420, description: EXAMPLE },
  { id: 'a6', kind: 'point', effect: 'ruins', name: 'Руины забытой башни', x: 720, y: 250, description: EXAMPLE },
  { id: 'a7', kind: 'zone', effect: 'blight', name: 'Порча', x: 1330, y: 880, radius: 26, description: EXAMPLE }
].map(a => ({ radius: 0, toX: null, toY: null, activeFrom: null, activeTo: null, secret: '', hidden: true, ...a }))

const shiratori = cities.find(c => c.id === 'c1')
const parties = [{
  id: 'p1', name: 'Отряд героев', color: '#e8b04a', icon: 'sword', description: 'Пример отряда. Переименуй и открой игрокам.',
  x: shiratori.x, y: shiratori.y, journey: null, hidden: true
}]

// Калибровка масштаба по известному расстоянию между двумя городами (со слов мастера)
const CALIBRATION = { a: 'c9', b: 'c1', km: 30 } // Марико — Сиратори = 30 км
const ca = cities.find(c => c.id === CALIBRATION.a), cb = cities.find(c => c.id === CALIBRATION.b)
const kmPerPx = ca && cb ? Math.round((CALIBRATION.km / Math.hypot(ca.x - cb.x, ca.y - cb.y)) * 1000) / 1000 : 1

// Панели «Погода» и «Лунный виток» — заполняются мастером на сайте
const hud = {
  weather: { location: 'Море Солдалла', tempDay: '+18', tempNight: '+6', wind: 'Умеренный', clouds: 'Кучевые облака', precipitation: 'Нет' },
  moon: {
    cycle: 364, seasonDay: 16, seasonLength: 90, north: 'Весна', south: 'Осень',
    meters: [{ name: 'Угроза разлома бездны', level: 1 }, { name: 'Пиратство', level: 4 }]
  },
  visible: true
}

const seed = {
  version: 1,
  settings: {
    worldName: 'Анкария',
    worldDate: '214 г. Эры Удалин',
    width: data.meta.W || 2048,
    height: data.meta.H || 1024,
    kmPerPx,
    paceKmPerDay: 38,
    realHoursPerGameDay: 24,
    fogEnabled: true,
    playerPings: true,
    grid: { cellKm: 10, type: 'square' }
  },
  hud,
  states, cities, roads, anomalies, parties, fog,
  labels: []
}

const seedDir = path.join(ROOT, 'server', 'seed')
fs.mkdirSync(seedDir, { recursive: true })
fs.writeFileSync(path.join(seedDir, 'anacaria.json'), JSON.stringify(seed, null, 1))
console.log(`масштаб: ${kmPerPx} км/px (по ${CALIBRATION.km} км между ${ca?.name} и ${cb?.name})`)
console.log(`seed: ${states.length} государств, ${cities.length} городов, ${roads.length} дорог, ${fog.length} фигур тумана`)
if (missing.size) console.log('Без перевода (оставлены как есть):', [...missing].join(', '))

if (resetDb) {
  const dataDir = path.join(ROOT, 'server', 'data')
  fs.mkdirSync(dataDir, { recursive: true })
  fs.writeFileSync(path.join(dataDir, 'db.json'), JSON.stringify(seed, null, 1))
  console.log('server/data/db.json пересоздан')
}
