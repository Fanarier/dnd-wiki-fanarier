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
  const s = String(result ?? '').trim()
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
