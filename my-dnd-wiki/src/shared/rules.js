// Правила из вики ↔ лист персонажа: какая это раса, класс и архетип, и какие навыки персонажу положены на его уровне.
// Раса: базовые навыки (уровень 0) и навык «сразу» каждого уровня — сами, вариант на выбор — когда игрок выберет.
// Класс и архетип: выбора нет, навыки открываются уровнем.

export const normName = s => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[«»"“”'!?.,:;()\-–—/\\]+/g, ' ').replace(/\s+/g, ' ').trim()

// как называют в листах → как в вики
const RACE_ALIAS = { 'анкариец': 'человек', 'землянин': 'человек', 'людина': 'человек', 'кицунэ': 'кицунэ кумихо', 'они': 'они ж', 'гарпия': 'аурэн гарпия', 'аурэн': 'аурэн гарпия', 'эльф': 'лунный эльф' }
const CLASS_ALIAS = { 'ведьма': 'колдун ведьма', 'колдун': 'колдун ведьма', 'инженер': 'изобретатель', 'палладин': 'паладин' }

function byName(list, name, alias = {}) {
  const n = normName(name)
  if (!n) return null
  const want = alias[n] || n
  return list.find(x => normName(x.name) === want) ||
    list.find(x => normName(x.name).split(' ').includes(want)) ||
    list.find(x => want.startsWith(normName(x.name)) || normName(x.name).startsWith(want)) || null
}
export const findRace = (races, d) => (d.RulesRace ? races.find(r => r.name === d.RulesRace) : null) || byName(races, d.Race, RACE_ALIAS)
// класс: по названию, а если не нашёлся — по архетипу («Протезист» → Изобретатель)
export function findClass(classes, d) {
  if (d.RulesClass) return classes.find(k => k.name === d.RulesClass) || null
  return byName(classes, d.Class, CLASS_ALIAS) || (d.Subclass ? classes.find(k => k.archetypes.some(a => sameArch(a.name, d.Subclass))) : null) || null
}
// «Снайптрон» ≈ «Снайпер», «ГИГАЧАД(Клятва короны)» ≈ «Клятва короны»: вхождение или общее начало от 5 букв
const strictArch = (a, sub) => { const x = normName(a), y = normName(sub); return !!x && !!y && (x === y || y.includes(x) || x.includes(y)) }
// общее начало одного слова («снайп»), а не «путь » у «Путь меча» и «Путь стального кулака»
const prefixArch = (a, sub) => {
  const x = normName(a), y = normName(sub)
  let i = 0
  while (i < x.length && x[i] === y[i] && x[i] !== ' ') i++
  return i >= 5
}
const sameArch = (a, sub) => strictArch(a, sub) || prefixArch(a, sub)
export function findArch(k, d) {
  if (!k) return null
  if (d.RulesArch) return k.archetypes.find(a => a.name === d.RulesArch) || null
  return k.archetypes.find(a => strictArch(a.name, d.Subclass)) || k.archetypes.find(a => prefixArch(a.name, d.Subclass)) || null
}

// описание из вики (HTML) → обычный текст листа (абзацы, списки, таблицы строками)
export function htmlToText(html) {
  return String(html || '')
    .replace(/<\/(p|h\d|li|tr)>/gi, '\n').replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ').replace(/<\/t[dh]>/gi, ' | ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/ \| \n/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}
// расовый навык — активный, если его применяют действием, реакцией или у него есть перезарядка
const ACTIVE_RE = /(действием|бонусным действием|реакци|перезарядк|активир|использует \()/i

// выбранные на уровне варианты (в листе — через « | »)
export const choicesAt = (d, lv) => String(d?.RaceChoices?.[lv] || '').split('|').map(x => x.trim()).filter(Boolean)
export const joinChoices = list => list.join(' | ')
export const pickOf = l => Math.max(1, Number(l?.pick) || 1)
// владение навыками по выбору за уровень расы («Разносторонний» у людей): сколько положено и что уже взято
export const profOf = l => Math.max(0, Number(l?.prof) || 0)
export const profsAt = (d, lv) => String(d?.RaceProf?.[lv] || '').split(',').map(s => s.trim()).filter(Boolean)
export function profLevels(rules, d) {
  const race = findRace(rules.races, d)
  const lv = Number(d.Level) || 0
  return race ? race.levels.filter(l => l.lv <= lv && profOf(l)) : []
}

// что положено персонажу: [{ key, name, text, active, cat: 0 класс | 1 раса, src }]
export function expectedSkills(rules, d) {
  const lv = Number(d.Level) || 0
  const out = []
  const race = findRace(rules.races, d)
  if (race) {
    for (const s of race.base) out.push({ key: 'r:' + normName(s.name), name: s.name, text: htmlToText(s.html), active: ACTIVE_RE.test(s.html), cat: 1, src: `${race.name}, базовый навык` })
    for (const l of race.levels) {
      if (l.lv > lv) continue
      if (l.auto) out.push({ key: 'r:' + normName(l.auto.name), name: l.auto.name, text: htmlToText(l.auto.html), active: ACTIVE_RE.test(l.auto.html), cat: 1, src: `${race.name}, ${l.lv} уровень` })
      for (const pick of choicesAt(d, l.lv)) {
        const o = l.options.find(x => normName(x.name) === normName(pick))
        if (o) out.push({ key: 'r:' + normName(o.name), name: o.name, text: htmlToText(o.html), active: ACTIVE_RE.test(o.html), cat: 1, src: `${race.name}, ${l.lv} уровень (выбор)` })
      }
    }
  }
  const k = findClass(rules.classes, d)
  const add = (list, src) => {
    for (const s of list) {
      // вехи («Выбор архетипа», «Выбор черты», «Выбор расового навыка») — не навыки
      if (s.lv > lv || (!s.html && !s.kind) || /^выбор /i.test(s.name) || /^\d/.test(s.name)) continue
      out.push({ key: 'k:' + normName(s.name), name: s.name, text: htmlToText(s.html), active: !/пассив/i.test(s.kind), cat: 0, src })
    }
  }
  if (k) {
    add(k.skills, `${k.name}, навык класса`)
    const a = findArch(k, d)
    if (a) add(a.skills, `${k.name}: ${a.name}`)
  }
  return out
}

// уровни расы, на которых пора выбрать вариант, а выбора ещё нет
export function pendingChoices(rules, d) {
  const race = findRace(rules.races, d)
  const lv = Number(d.Level) || 0
  if (!race) return []
  const valid = l => choicesAt(d, l.lv).filter(c => l.options.some(o => normName(o.name) === normName(c))).length
  return race.levels.filter(l => l.lv <= lv && l.options.length && valid(l) < Math.min(pickOf(l), l.options.length))
}

// эффекты вики: виды и поиск эффекта, висящего на персонаже (по id из вики, иначе по названию)
export const EFFECT_KINDS = [
  { id: 'buff', name: 'Положительные', one: 'положительный', icon: '▲' },
  { id: 'debuff', name: 'Отрицательные', one: 'отрицательный', icon: '▼' },
  { id: 'special', name: 'Особые', one: 'особый', icon: '✦' }
]
export function findEffect(effects, fx) {
  if (!fx) return null
  return (fx.Id && effects.find(e => e.id === fx.Id)) || effects.find(e => normName(e.name) === normName(fx.Name)) || null
}
