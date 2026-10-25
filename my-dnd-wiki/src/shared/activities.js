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
  return tablesOf(a).filter(r => r.cells.length >= 3 && /\d+к\d+/i.test(r.cells[2])).map(r => ({
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

// длительная тренировка/обучение: по правилам 4 изнурения и бросок (2к20 + 2×моды) × 1.35
export const isLongTraining = name => /^(долг|длительн)\S*\s+(тренир|обуч)/i.test(String(name || '').trim())
export const LONG_EXH = 4
export const LONG_MULT = 1.35
// отдых снимает изнурение: каждые 3 часа — одно (6 часов — два)
export const restExh = hours => -Math.min(5, Math.floor(Math.max(0, num(hours)) / 3)) || 0

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
  const out = { sum: 0, items: [], unknown: [], rep: null, adv: /с\s+преимуществ/i.test(plain) ? 'adv' : /с\s+помех/i.test(plain) ? 'dis' : '' }
  for (const line of plain.matchAll(/модификатор[^:\n]*:\s*([^\n]+)/gi)) {
    for (const raw of splitTop(line[1])) {
      const item = raw.trim().replace(/\.$/, '')
      if (!item) continue
      const cut = item.search(/[(:]/)
      const name = (cut > 0 ? item.slice(0, cut) : item).trim()
      const tail = cut >= 0 ? item.slice(cut) : ''
      const m = tail.match(/([+\-−])?\s*(\d+(?:[.,]\d+)?)/)
      const v = m && !/\?\?/.test(tail.slice(0, (m.index || 0) + 1)) ? Number(m[2].replace(',', '.')) * (m[1] && m[1] !== '+' ? -1 : 1) : null
      if (/повтор/i.test(name)) { if (v != null) out.rep = Math.min(10, Math.max(0, Math.round(v))); continue }
      if (v == null) { out.unknown.push(name); continue }
      out.sum += v
      out.items.push({ name, v })
    }
  }
  out.sum = Math.round(out.sum * 100) / 100
  return out
}
// что бросать за запись: короткая — 1к20 + все моды + место + повторение; длительная тренировка — два к20, к каждому моды
// и место, итог × 1.35 вниз, потом + повторение (его прибавляет сервер: add). autoRep — сколько насчитал сайт, если в тексте не написано
export function rollPlan(rec, placeMod, autoRep = 0) {
  const m = rollMods(rec.result)
  const rep = m.rep ?? autoRep ?? 0
  const sign = v => (v ? (v > 0 ? '+' : '') + v : '')
  if (isLongTraining(rec.name)) {
    const place = placeMod?.formula ? `+${placeMod.formula}+${placeMod.formula}` : ''
    return { ...m, rep, long: true, add: rep, formula: `2d20${place}${sign(2 * m.sum)}` }
  }
  const place = placeMod?.formula ? `+${placeMod.formula}` : ''
  return { ...m, rep, long: false, add: 0, formula: `1d20${place}${sign(m.sum + rep)}${m.adv === 'adv' ? ' преимущество' : m.adv === 'dis' ? ' помеха' : ''}` }
}
export const longFinal = (total, add) => Math.floor(total * LONG_MULT) + (add || 0)

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
