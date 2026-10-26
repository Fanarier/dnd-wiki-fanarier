// Журнал деятельностей: статусы, типы, категории, разбор чисел из того, как их пишут в таблице («20 часов», «42+1», «Н/Д»),
// справочник деятельностей и модификаторов из статей вики, награда заказа гильдии
export const ACT_STATUS = {
  plan: { name: 'черновик', color: '#b9a6ff' },
  pending: { name: 'на проверке', color: '#f0b54f' },
  done: { name: 'учтено', color: '#7ed07a' },
  fail: { name: 'провал', color: '#ff7a6b' },
  cond: { name: 'условие', color: '#7fb4ff' },
  cancel: { name: 'отменено', color: '#8f8574' }
}
export const ACT_TYPES = { repeat: { name: 'Повторяемая', icon: '↻' }, unique: { name: 'Уникальная', icon: '★' } }

// категории — цвет блока в песочных часах сессии, иконка и подпись в статистике
export const ACT_CATS = {
  sleep: { name: 'Сон и отдых', icon: '🌙', color: '#6f8fd8' },
  train: { name: 'Тренировки', icon: '🏋', color: '#e0705a' },
  study: { name: 'Обучение и магия', icon: '📚', color: '#a77bf0' },
  craft: { name: 'Крафт и работа', icon: '⚒', color: '#d9a441' },
  research: { name: 'Исследования', icon: '🔍', color: '#4fc1c1' },
  quest: { name: 'Квесты и заказы', icon: '⚔', color: '#f3d36b' },
  travel: { name: 'Путешествия', icon: '🧭', color: '#7ed07a' },
  social: { name: 'Встречи и свидания', icon: '💞', color: '#ef7fb0' },
  errand: { name: 'Дела и покупки', icon: '🛍', color: '#c9b48a' },
  other: { name: 'Прочее', icon: '✦', color: '#8f8574' }
}
const CAT_WORDS = [
  ['quest', /заказ|квест|зачистк|сопровожд|ликвидац|подземел|руин/],
  ['sleep', /сон|спал|отдых|медитац|транс|день отдыха/],
  ['social', /свидан|встреч|таверн|гуля|знакомств|забот/],
  ['study', /обучени|изуч|освоени|магии|заклинан|ритуал|чтени|читает|учебник|книг|библиотек/],
  ['train', /тренир|треугольник|преодолен|дрессир/],
  ['research', /исследов|технолог|анализ|осмотр/],
  ['craft', /крафт|создан|изготав|ремонт|стройк|работа|починк|кузн|зелье|статуэтк|добыч|охот|рыбал|обслужив/],
  ['travel', /телепорт|поездк|путешеств|дорог|между город|провинци|едет|плыв/],
  ['errand', /покупк|рынок|рынке|банк|склад|заказ у|чистк|уход за|настройк/]
]
export function categoryOf(name) {
  const n = String(name || '').toLowerCase().replace(/ё/g, 'е')
  for (const [k, re] of CAT_WORDS) if (re.test(n)) return k
  return 'other'
}

// первое число в тексте («20 часов» → 20, «1,6» → 1.6); нет числа — 0
export function num(v) {
  const m = String(v ?? '').replace(/(\d),(\d)/g, '$1.$2').match(/-?\d+(?:\.\d+)?/)
  return m ? Number(m[0]) : 0
}
// очки тренировки из результата: «42» или «42+1» → 43; словами — не угадываем
export function ptsOf(result) {
  const s = String(result ?? '').replace(/<[^>]+>/g, '').trim()
  return /^\d+(\s*\+\s*\d+)*$/.test(s) ? s.split('+').reduce((n, x) => n + Number(x), 0) : 0
}
export const round = (n, d = 3) => Math.round(n * 10 ** d) / 10 ** d
export const normAct = s => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/g, ' ').trim()

// таблицы статей вики → строки { cells, section } (section — жирный заголовок над таблицей: «Путешествия», «Тренировки»…)
function tablesOf(article) {
  if (typeof DOMParser === 'undefined') return []
  const doc = new DOMParser().parseFromString(article.html, 'text/html')
  const rows = []
  let section = ''
  for (const el of doc.body.children) {
    if (el.tagName === 'P' && el.textContent.trim()) section = el.textContent.trim()
    if (el.tagName !== 'TABLE') continue
    for (const tr of el.querySelectorAll('tr')) rows.push({ section, cells: [...tr.children].map(td => (td.querySelector('p') || td).textContent.replace(/\s+/g, ' ').trim()) })
  }
  return rows
}
// справочник деятельностей («Повторяемые деятельности», «Уникальные деятельности»): название, длительность,
// выносливость в час, раздел и статья — для подсказок, ссылок и расчёта выносливости
export function activityCatalog(articles) {
  const out = []
  for (const a of articles.filter(x => x.group === 'activities')) {
    const type = /повторя/i.test(a.title) ? 'repeat' : /уникал/i.test(a.title) ? 'unique' : ''
    if (!type) continue
    for (const { section, cells } of tablesOf(a)) {
      if (cells.length < 3 || /^деятельност/i.test(cells[0]) || !/^-?\d/.test(cells[2])) continue
      out.push({ name: cells[0], dur: cells[1], rate: num(cells[2]), cost: cells[3] || '', type, section, articleId: a.id })
    }
  }
  return out
}
// основа слова: «Долгая / Длительная / Долгие» — одно и то же, остальное — по первым пяти буквам
const stem = w => (/^(долг|длительн)/.test(w) ? 'долг' : w.slice(0, 5))
const stems = s => normAct(String(s).replace(/\([^)]*\)/g, ' ')).split(' ').filter(Boolean).map(stem)
// варианты названия из справочника: «Долгие тренировка/обучение (Попытка)» → «долг трени», «долг обуче»;
// «Обычные тренировка/обучение» — ещё и просто «трени», «обуче»
function variants(name) {
  const words = String(name).replace(/\([^)]*\)/g, ' ').trim().split(/\s+/).filter(Boolean)
  let out = [[]]
  for (const w of words) out = out.flatMap(v => w.split('/').filter(Boolean).map(x => [...v, x]))
  out = out.map(v => stems(v.join(' ')))
  return [...out, ...out.filter(v => v[0] === 'обычн' && v.length > 1).map(v => v.slice(1))]
}
// какая деятельность из справочника это: сначала по началу названия целиком (с уточнением в скобках),
// потом по основам слов («Долгая тренировка (Владение: …)» → «Долгие тренировка/обучение»)
export function catalogMatch(catalog, name) {
  const n = normAct(name)
  if (n.length < 3) return null
  const exact = catalog.filter(c => { const k = normAct(c.name); return n.startsWith(k) || k.startsWith(n) }).sort((a, b) => b.name.length - a.name.length)[0]
  if (exact) return exact
  const st = stems(name)
  let best = null, bestLen = 0
  for (const c of catalog) {
    for (const v of variants(c.name)) {
      if (v.length > bestLen && v.length <= st.length && v.every((x, i) => st[i] === x)) { best = c; bestLen = v.length }
    }
  }
  return best
}
// модификаторы мест из статьи «Модификаторы»: «Библиотека — Обучение/Исследование — 1к10»
export function activityMods(articles) {
  const a = articles.find(x => x.group === 'activities' && /модификатор/i.test(x.title))
  if (!a) return []
  return tablesOf(a).filter(r => r.cells.length >= 3 && /\d+к\d+/i.test(r.cells[2]) && !/наставник|учитель/i.test(r.cells[0])).map(r => ({
    name: r.cells[0], what: r.cells[1], die: r.cells[2], formula: r.cells[2].replace(/к/gi, 'd').replace(/\s*\+\s*Наставничество/i, ''), articleId: a.id
  }))
}

// награда заказа («Получено 14 ЗМ 450 Опыт», «40 ЗМ и 750 опыта + 20 СМ») → монеты и опыт
export function rewardOf(text) {
  const t = String(text || '')
  const sum = re => [...t.matchAll(re)].reduce((n, m) => n + Number(m[1]), 0)
  return { gold: sum(/(\d+)\s*зм/gi), silver: sum(/(\d+)\s*см/gi), copper: sum(/(\d+)\s*мм/gi), exp: sum(/(\d+)\s*(?:ед\.?\s*)?опыт/gi) }
}
// формула броска из записи: «1d20» + модификатор места + бонус повторения
export function rollFormula(base, mod, rep) {
  return [base || '1d20', mod?.formula, rep ? String(rep) : ''].filter(Boolean).join('+').replace(/\+-/g, '-')
}

// длительная тренировка/обучение: сутки вместе со сном — 24 ч (эльф в трансе — 20 ч), 3 выносливости, изнурения не даёт;
// бросок (2к20 + все модификаторы один раз) × 1.8 вниз (было × 1.35 — длительная проигрывала обычным), потом бонус повторения. «Несколько» (×N) — N таких суток подряд
export const isLongTraining = name => /^(долг|длительн)\S*\s+(тренир|обуч)/i.test(String(name || '').trim())
export const LONG_EXH = 0
export const LONG_MULT = 1.8
export const LONG_STAMINA = 3
export const longHours = cfg => (cfg?.elf ? 20 : 24)
// отдых снимает изнурение: каждые 3 часа — одно (6 часов — два)
export const restExh = hours => -Math.min(5, Math.floor(Math.max(0, num(hours)) / 3)) || 0
// деньги: курс 1 к 100 (100 бронзовых = 1 серебряный, 100 серебряных = 1 золотой). Хватит ли героя и надо ли разменять
export const coinsCopper = c => (Number(c?.gold) || 0) * 10000 + (Number(c?.silver) || 0) * 100 + (Number(c?.copper) || 0)
export function moneyCheck(coins, rec) {
  if (!coins) return null
  const d = { gold: Number(rec?.gold) || 0, silver: Number(rec?.silver) || 0, copper: Number(rec?.copper) || 0 }
  if (d.gold >= 0 && d.silver >= 0 && d.copper >= 0) return null
  const have = coinsCopper(coins), after = have + coinsCopper(d)
  if (after < 0) return { short: true, have, need: -coinsCopper(d) }
  const exchange = (coins.copper || 0) + d.copper < 0 || (coins.silver || 0) + d.silver < 0
  return exchange ? { exchange: true } : null
}
export const fmtCoins = cp => {
  const g = Math.floor(cp / 10000), s = Math.floor((cp % 10000) / 100), c = cp % 100
  return [g && `${g} зм`, s && `${s} см`, c && `${c} мм`].filter(Boolean).join(' ') || '0'
}
// вещь в инвентаре героя (склад или нет — всё равно): сколько всего штук
export const invCount = (inv, name) => {
  const n = String(name || '').trim().toLowerCase()
  return n ? (inv || []).filter(x => String(x.name || '').trim().toLowerCase() === n).reduce((s, x) => s + (Number(x.qty) || 0), 0) : 0
}
export const invHas = (inv, name) => (inv || []).some(x => String(x.name || '').trim().toLowerCase() === String(name || '').trim().toLowerCase())

// любой отдых из вики (раздел «Отдых»: отдых, сон, транс, медитация, свидания) или запись, что возвращает выносливость
const REST_RE = /^(отдых|свидани|сон\b|транс\b|медитац|день отдыха)|восстановительный сон/i
export const isRestRec = rec => REST_RE.test(String(rec?.name || '').trim()) || num(rec?.stamina) < 0
// ночной сон (не пишется деятельностью) снимает по тому же правилу: сон 8 ч — 2, транс 4 ч — 1
export const nightExh = sleepH => restExh(sleepH ?? 8)
// длительная тренировка — сутки вместе со сном: изнурения не даёт и не снимает
export const longExhNet = () => LONG_EXH
// сколько изнурения даёт запись: что вписано, а если пусто — по правилам (отдых −1 за 3 ч)
export const exhOf = (rec, sleepH = 8) => Number(rec?.exh) || (isLongTraining(rec?.name) ? longExhNet(sleepH) : isRestRec(rec) ? restExh(rec?.hours) : 0)
// 5 изнурений — эффект «Сон»; изнурение удваивает затраты выносливости
export const EXH_MAX = 5
export const exhStaminaK = exh => (Number(exh) > 0 ? 2 : 1)
// у героя изнурение, а выносливость в записи не удвоена — что предложить: { from, to } (строки как в записи) или null.
// Удвоена ли — по справочнику вики (часы × выносливость в час); без справочника — предлагаем ×2 к тому, что есть
export function staminaDouble(rec, hero, hint) {
  const st = num(rec?.stamina)
  if (!(Number(hero?.exh) > 0) || st <= 0 || isRestRec(rec)) return null
  const fmt = v => String(Math.round(v * 1000) / 1000).replace('.', ',')
  if (hint?.rate > 0 && num(rec?.hours)) {
    const base = num(rec.hours) * hint.rate
    if (Math.abs(st - base * 2) < 0.001) return null // уже удвоена
    return Math.abs(st - base) < 0.001 ? { from: fmt(st), to: fmt(base * 2) } : null // своё число — не трогаем
  }
  return { from: fmt(st), to: fmt(st * 2) }
}

// запятые верхнего уровня: «Ловкость рук(+10, взята с БМ), ОиГ(+3)» → два пункта
function splitTop(s) {
  const out = []
  let depth = 0, cur = ''
  for (const ch of s) {
    if (ch === '(') depth++
    if (ch === ')') depth = Math.max(0, depth - 1)
    if ((ch === ',' || ch === ';') && !depth) { out.push(cur); cur = '' } else cur += ch
  }
  return [...out, cur]
}
// модификаторы броска из описания записи: строка «Модификаторы броска: Красивая речь(+4), Анализ(+6), ОиГ(+3)»
// (или «бросков», «тренировки»…). Число — первое в скобках или после двоеточия. «Бонус повторения(+2)» / «: +3» —
// отдельно (rep). Пункты без числа («Наставничество(+???)», «Комплект(без травм)») — в unknown. «с преимуществом» — adv
export function rollMods(text) {
  const plain = String(text || '').replace(/<\/(p|div|li)>|<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ')
  const adv = /преимуществ/i.test(plain) && !/без\s+преимуществ/i.test(plain) ? 'adv' : /помех/i.test(plain) && !/без\s+помех/i.test(plain) ? 'dis' : ''
  const out = { sum: 0, items: [], dice: [], unknown: [], rep: null, adv }
  // строка модификаторов кончается там, где начинается другая заготовка («… +13. Бонус повторения: +2. Преимущество»);
  // точка с пробелом — тоже разделитель пунктов
  const END = /(?:[.;,]\s*|\s+)(?=бонус\s+повтор|(?:с\s+)?преимуществ|(?:с\s+)?помех|результат\s*:|совместно\s+с)/i
  for (const line of plain.matchAll(/модификатор[^:\n]*:\s*([^\n]+)/gi)) {
    const body = line[1].split(END)[0].replace(/\.\s+(?=\S)/g, ', ')
    for (const raw of splitTop(body)) {
      const item = raw.trim().replace(/[.,;]$/, '').trim()
      if (!item) continue
      // где число: в скобках «Сила(+5)», после двоеточия «Бонус повторения: +3» или просто в конце «Ловкость рук +13», «Инструменты +1к10»
      let name, tail
      const cut = item.search(/[(:]/)
      if (cut >= 0) { name = item.slice(0, cut).trim(); tail = item.slice(cut) } else {
        const t = item.match(/\s([+\-−]\s*\d+(?:[.,]\d+)?(?:\s*[кkdд]\s*\d+)?)\s*$/i)
        name = t ? item.slice(0, t.index).trim() : item
        tail = t ? t[1] : ''
      }
      if (/\?\?/.test(tail.split(/\d/)[0])) { out.unknown.push(name); continue }
      // кубик-модификатор («+1к10», «(+2d6)») — докидывается к броску
      const die = tail.match(/([+\-−])?\s*(\d*)\s*[кkdд]\s*(\d+)/i)
      if (die && !/повтор/i.test(name)) {
        if (die[1] && die[1] !== '+') { out.unknown.push(name); continue } // вычитать кубик кубики сайта не умеют
        const n = Math.min(10, Number(die[2]) || 1), sides = Number(die[3])
        out.dice.push({ name, n, sides })
        out.items.push({ name, v: `${n}к${sides}` })
        continue
      }
      const m = tail.match(/([+\-−])?\s*(\d+(?:[.,]\d+)?)/)
      const v = m ? Number(m[2].replace(',', '.')) * (m[1] && m[1] !== '+' ? -1 : 1) : null
      if (/повтор/i.test(name)) { if (v != null) out.rep = Math.min(10, Math.max(0, Math.round(v))); continue }
      if (v == null) { out.unknown.push(name); continue }
      out.sum += v
      out.items.push({ name, v })
    }
  }
  // «Бонус повторения: +2» / «(+2)» — где угодно в описании
  if (out.rep == null) {
    const r = plain.match(/бонус\s+повтор\S*\s*[:(]?\s*\+?\s*(\d+)/i)
    if (r) out.rep = Math.min(10, Number(r[1]))
  }
  out.sum = Math.round(out.sum * 100) / 100
  return out
}
// базовый кубик записи: по умолчанию к20, можно выбрать другой (к12, к10…)
export const ACT_DICE = [4, 6, 8, 10, 12, 20, 100]
export const dieOf = rec => (ACT_DICE.includes(Number(rec?.die)) ? Number(rec.die) : 20)
// сколько попыток в записи: у длительной «несколько» — N бросков, у остальных — один
export const attemptsOf = rec => (isLongTraining(rec?.name) ? Math.max(1, Math.min(10, Number(rec?.times) || 1)) : 1)
// броски последней серии: «перебросил» — новая серия, старые остаются в записи, но не считаются.
// У короткой каждый бросок — своя серия (считается последний); броски без номера серии (старые) — серия 0
export function seriesInfo(rec) {
  const rolls = (rec?.rolls || []).map((r, i) => ({ ...r, i, series: r.series ?? 0 }))
  const cur = rolls.reduce((m, r) => Math.max(m, r.series), 0)
  let last = rolls.filter(r => r.series === cur)
  if (!isLongTraining(rec?.name)) last = last.slice(-1)
  const need = attemptsOf(rec)
  return { cur, last, done: last.length, need, full: last.length >= need, old: rolls.filter(r => !last.includes(r)) }
}
// бонус повторения по цепочке попыток сессии (те же деятельности в той же сессии, по порядку журнала):
// каждая попытка (у длительной ×N — каждый бросок) +1, до +10. Натуральная 1 на базовом к20 сбрасывает: эта попытка +0,
// следующая снова +1. «Бонус повторения: +N» в тексте записи ставит счёт с неё. Вернёт бонусы попыток записи target
export function repChain(recs, target) {
  let c = 0
  const i = recs.findIndex(r => r.id === target.id)
  for (const x of i >= 0 ? [...recs.slice(0, i), target] : [...recs, target]) {
    const text = rollMods(x.result).rep
    if (text != null) c = text
    else if (x === target && target.type !== 'repeat') c = 0
    const { last } = seriesInfo(x)
    const out = []
    for (let j = 0; j < attemptsOf(x); j++) {
      out.push(Math.min(10, c))
      c = last[j]?.reset ? 1 : c + 1
    }
    if (x === target) return out
  }
  return [0]
}
// что бросать за запись. Модификаторы — из строки «Модификаторы броска: …», место из вики (кубик), наставник (фикс) — все один раз.
// Короткая: 1кX + модификаторы, потом + повторение. Длительная: (2кX + модификаторы) × LONG_MULT вниз, потом + повторение.
// Итог считает сервер (rollOutcome): 1 на базовом к20 — кубик не в счёт и повторение сброшено, 20 — кубик ×2.
// adds — бонусы повторения попыток (repChain); «несколько» (times) — столько бросков
export function rollPlan(rec, placeMod, adds = [0]) {
  const m = rollMods(rec.result)
  const mentor = Number(rec.mentorBonus) || 0
  if (mentor) m.items.push({ name: 'Наставник' + (rec.mentor ? ' ' + rec.mentor : ''), v: mentor })
  const sum = Math.round((m.sum + mentor) * 100) / 100
  const repSet = m.rep != null // бонус повторения написан в тексте
  const sign = v => (v ? (v > 0 ? '+' : '') + v : '')
  const place = placeMod?.formula ? `+${placeMod.formula}` : ''
  const dice = m.dice.map(d => `+${d.n}d${d.sides}`).join('')
  const die = dieOf(rec)
  const long = isLongTraining(rec.name)
  const times = attemptsOf(rec)
  const all = Array.from({ length: times }, (_, i) => adds[i] ?? Math.min(10, (adds[adds.length - 1] ?? 0) + i - adds.length + 1))
  const base = { n: long ? 2 : 1, sides: die }
  const adv = !long && m.adv === 'adv' ? ' преимущество' : !long && m.adv === 'dis' ? ' помеха' : ''
  return { ...m, sum, rep: all[0], repSet, long, times, adds: all, add: all[0], die, base, formula: `${base.n}d${die}${place}${dice}${sign(sum)}${adv}` }
}
// итог броска: натуральные на базовых кубиках (только к20) — 1 не в счёт (и сброс повторения), 20 — ×2;
// у длительной сумма × mult вниз; потом бонус повторения. roll — проверенный бросок сайта (groups, total, adv)
export function rollOutcome(roll, base, add = 0, mult = 0) {
  const g = (roll.groups || []).find(x => x.sides === base.sides)
  let vals = g ? g.values.slice(0, roll.adv ? g.values.length : base.n) : []
  if (roll.adv && vals.length === 2) vals = [roll.adv === 'adv' ? Math.max(...vals) : Math.min(...vals)]
  const crit = base.sides === 20
  const ones = crit ? vals.filter(v => v === 1).length : 0
  const twenties = crit ? vals.filter(v => v === 20).length : 0
  const sum = roll.total - ones + 20 * twenties
  const reset = ones > 0
  const a = reset ? 0 : add || 0
  return { vals, ones, twenties, sum, reset, add: a, final: (mult ? Math.floor(sum * mult) : sum) + a }
}
// чего ждать в среднем (кубики — по среднему; к20 — с учётом 1 и 20): у длительной — каждый бросок и сумма всех
export function planAvg(p) {
  let dice = 0
  for (const [, n, s] of p.formula.matchAll(/(\d+)d(\d+)/g)) dice += (Number(n) * (Number(s) + 1)) / 2
  if (p.base?.sides === 20) dice += p.base.n * 0.95 // 1 → 0 (−1/20), 20 → 40 (+20/20)
  const each = p.adds.map(a => (p.long ? longFinal(dice + p.sum, a) : Math.floor(dice + p.sum + a)))
  return { each, total: each.reduce((a, b) => a + b, 0) }
}
// заготовки для описания: «!Мод» + Tab → «Модификаторы броска: »
export const ACT_SNIPPETS = ['Модификаторы броска: ', 'Преимущество', 'Помеха', 'Бонус повторения: +', 'Результат: ', 'Совместно с: ']
// как показать план броска: «(2d20+1d20+27) × 1.8 + 2», у нескольких — «×4»
export function planText(p) {
  const add = p.add || p.adds[p.adds.length - 1] ? ' + ' + (p.times > 1 ? `${p.adds[0]}…${p.adds[p.adds.length - 1]}` : p.add) + ' повт.' : ''
  return p.long ? `(${p.formula}) × ${LONG_MULT}${add}${p.times > 1 ? ` · ×${p.times}` : ''}` : `${p.formula}${add}`
}
export const longFinal = (total, add, mult = LONG_MULT) => Math.floor(total * mult) + (add || 0)

// Обязательный отдых вычитается из периода сразу: 336 ч − 14 дней × 8 ч сна = 224 ч свободно (дроу в трансе 4 ч — 280).
// Поэтому записанный на сайте сон (транс, подзарядка…) — дополнительный отдых и идёт в счёт целиком. Исключение — сессии,
// перенесённые из таблицы, где писали и ежедневный сон: если иначе часов больше свободных, их сон сначала покрывает норму.
const SLEEP_WORDS = /(^|[^а-яё])(сон|сна|спал|спит|транс|подзарядк)/i
export function isSleepRec(name, rest = '') {
  const n = String(name || '').toLowerCase().replace(/ё/g, 'е')
  const kind = String(rest || '').toLowerCase().replace(/ё/g, 'е').slice(0, 5)
  return SLEEP_WORDS.test(n) || (kind.length >= 4 && n.includes(kind))
}
export function restBudget(period, cfg = {}) {
  const days = Math.max(1, Math.ceil(period / 24))
  const perDay = cfg.sleep ?? 8
  const norm = days * perDay
  return { period, days, perDay, rest: cfg.rest || 'Сон', norm, free: Math.max(0, period - norm) }
}
// записи сессии с поправкой: часы сна, покрытые нормой, обнулены (в копиях) — их и складывают в «свободные».
// Норму покрывает только сон из таблицы (у записей оттуда нет отметки времени at) и только при переполнении
export function freeRows(rows, budget) {
  const raw = rows.reduce((n, r) => n + Math.max(0, num(r.hours)), 0)
  if (raw <= budget.free) return { rows, covered: 0 }
  let left = budget.norm
  let covered = 0
  const out = rows.map(r => {
    if (!left || r.at || !isSleepRec(r.name, budget.rest)) return r
    const h = Math.max(0, num(r.hours))
    const take = Math.min(left, h)
    left -= take
    covered += take
    return take ? { ...r, hours: String(round(h - take, 2)), inNorm: take } : r
  })
  return { rows: out, covered }
}
