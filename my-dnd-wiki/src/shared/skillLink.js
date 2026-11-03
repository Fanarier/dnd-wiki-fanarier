// Навыки листа ↔ вики. Навык привязан (Wiki — ссылка на навык расы, класса/архетипа или заклинание) — его название,
// категория и текст берутся из вики и обновляются сами (WikiAt — когда текст поменялся: сутки лист пишет «обновлено»).
// Своё игрок пишет в «Заметку» (Note) — её вики не трогает. Изменил сам навык — он отвязывается (WikiOff) и становится
// уникальным. Не нашёлся в вики по точному названию — тоже уникальный (категория 3), привязать можно вручную.
// Общее для сервера (обновление всех листов, когда меняется вики) и листа в браузере.
import { normName, htmlToText, findRace, findClass, findArch } from './rules.js'

export const CAT_UNIQUE = 3
export const FRESH_MS = 24 * 3600 * 1000 // сколько висит «обновлено из вики»

// заклинание: строка «школа · круг · расход · перезарядка» и текст
function spellText(s, school) {
  const head = [school?.name, s.circle === 'Б' ? 'базовое' : s.circle ? s.circle + ' круг' : '', s.cost && 'Расход: ' + s.cost, s.cd && 'Перезарядка: ' + s.cd].filter(Boolean).join(' · ')
  const body = htmlToText(s.html)
  return head ? head + (body ? '\n' + body : '') : body
}

// все навыки вики: по ссылке и по названию. Скрытое мастером не берём — его текст не должен попасть игрокам
let cache = null, cacheKey = null
export function wikiIndex(rules) {
  if (cache && cacheKey === rules && cache.rev === rules.rev) return cache
  const byRef = new Map(), byName = new Map()
  const put = e => {
    if (byRef.has(e.ref)) return // тот же навык на двух уровнях расы — берём первый
    byRef.set(e.ref, e)
    const n = normName(e.name)
    if (!byName.has(n)) byName.set(n, [])
    byName.get(n).push(e)
  }
  for (const r of rules.races || []) {
    if (r.hidden) continue
    const one = (x, lv) => x?.name && put({ ref: `r:${r.id}:${normName(x.name)}`, name: x.name, text: htmlToText(x.html), cat: 1, race: r.id, src: lv ? `${r.name}, ${lv} ур.` : `${r.name}, базовый`, to: { path: '/wiki', query: { race: r.id } } })
    for (const b of r.base || []) one(b, 0)
    for (const l of r.levels || []) { one(l.auto, l.lv); for (const o of l.options || []) one(o, l.lv) }
  }
  for (const k of rules.classes || []) {
    if (k.hidden) continue
    const one = (x, a) => x?.name && x.html && !/^выбор /i.test(x.name) && put({ ref: `k:${k.id}:${normName(a?.name || '')}:${normName(x.name)}`, name: x.name, text: htmlToText(x.html), cat: 0, cls: k.id, arch: a?.name || '',
      src: a ? `${k.name}: ${a.name}` : k.name, to: { path: '/wiki', query: a ? { cls: k.id, arch: a.name } : { cls: k.id } } })
    for (const s of k.skills || []) one(s, null)
    for (const a of k.archetypes || []) for (const s of a.skills || []) one(s, a)
  }
  const schools = new Map((rules.schools || []).map(s => [s.id, s]))
  for (const s of rules.spells || []) {
    const sc = schools.get(s.school)
    if (s.hidden || sc?.hidden) continue
    put({ ref: `s:${s.id}`, name: s.name, text: spellText(s, sc), cat: 2, spell: s.id, src: sc?.name || 'Магия', to: { path: '/wiki', query: { section: sc?.page || 'utility' } } })
  }
  cache = { rev: rules.rev, byRef, byName, all: [...byRef.values()] }
  cacheKey = rules
  return cache
}

// из нескольких навыков с одним названием — свой: магия к заклинанию, раса героя, его класс и архетип
function pick(list, d, rules, s) {
  if (!list?.length) return null
  if (list.length === 1) return list[0]
  const race = findRace(rules.races || [], d), k = findClass(rules.classes || [], d), a = k && findArch(k, d)
  const score = e => (s.CategoryIndex === e.cat ? 1 : 0) + (race && e.race === race.id ? 4 : 0) + (k && e.cls === k.id ? 3 : 0) + (a && e.arch === a.name ? 2 : 0)
  return list.slice().sort((x, y) => score(y) - score(x))[0]
}

const flat = t => String(t || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/g, '')
const plain = t => htmlToText(String(t || '')).trim()
// что из старого текста листа сохранить в заметку при привязке: дописанное игроком после текста вики, или весь
// старый текст, если он совсем другой (почти тот же или короче вики — не нужен, он есть в истории листа)
const words = t => new Set(String(t || '').replace(/<[^>]+>/g, ' ').toLowerCase().replace(/ё/g, 'е').split(/[^a-zа-я0-9]+/).filter(w => w.length > 2))
function keepOf(old, wiki) {
  const a = flat(old), b = flat(wiki)
  if (!a || a === b || b.includes(a) || Math.abs(a.length - b.length) < 12) return ''
  // почти всё старое есть в вики (поправили опечатки, числа, дописали) — старое не нужно, оно в истории листа
  const wa = words(old), wb = words(wiki)
  const same = [...wa].filter(w => wb.has(w)).length
  if (!a.includes(b) && wa.size && same / wa.size >= 0.85) return ''
  const t = plain(old)
  if (a.includes(b)) {
    // дописка: отрезаем по последнему слову текста вики
    const words = plain(wiki).split(/\s+/)
    const tail = words.slice(-3).join(' ')
    const at = t.lastIndexOf(tail)
    const rest = at >= 0 ? t.slice(at + tail.length).replace(/^[\s.,;:!?)»]+/, '').trim() : ''
    return rest
  }
  return 'Было в листе до привязки к вики: ' + t
}

// тот же текст, что в вики, — без оформления: игроки красят текст, выделяют — это не правка, привязка остаётся
// (знаки и числа сравниваются, «+3» и «−3» — разное)
const bare = t => htmlToText(String(t || '')).replace(/\s+/g, ' ').trim()
export const sameText = (a, b) => bare(a) === bare(b)

// оформление всего текста (весь навык цветом, жирным — <span class="tx-ice"><strong>…) переносится на новый текст
// из вики: общее оформление абзацев (≥ 70% текста), если оно есть; выделенные отдельные слова — нет
const esc = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
function styleOf(html) {
  const ps = String(html || '').match(/<p[^>]*>[\s\S]*?<\/p>/g)
  if (!ps) return null
  const w = new Map()
  let total = 0
  for (const p of ps) {
    const inner = p.replace(/^<p[^>]*>/, '').replace(/<\/p>$/, '')
    const len = htmlToText(inner).length
    total += len
    const m = inner.match(/^((?:<(?:span|strong|b|em|i|u|mark|s)\b[^>]*>)+)/)
    if (m) w.set(m[1], (w.get(m[1]) || 0) + len)
  }
  const best = [...w].sort((a, b) => b[1] - a[1])[0]
  return best && total && best[1] / total >= 0.7 ? best[0] : null
}
export function restyle(oldHtml, text) {
  const open = styleOf(oldHtml)
  if (!open) return text
  const close = [...open.matchAll(/<(\w+)/g)].map(m => `</${m[1]}>`).reverse().join('')
  return String(text).split('\n').map(l => (l.trim() ? `<p>${open}${esc(l)}${close}</p>` : '<p></p>')).join('')
}

// привязать навык к навыку вики: название, категория и текст — из вики (тот же текст с оформлением — остаётся как
// есть, другой — с тем же общим оформлением), старое (если ценное) — в заметку
export function bindTo(s, e, { now = Date.now(), keep = true } = {}) {
  const same = sameText(s.Description, e.text)
  const extra = keep && !same ? keepOf(s.Description, e.text) : ''
  const out = { ...s, SkillName: e.name, CategoryIndex: e.cat, Description: same ? s.Description : restyle(s.Description, e.text), Wiki: e.ref, WikiOff: false }
  if (extra && !String(s.Note || '').includes(extra)) out.Note = [s.Note, extra].filter(Boolean).join('\n\n').slice(0, 4000)
  if (!same) out.WikiAt = now
  return out
}
// отвязать (игрок меняет навык сам): дальше он уникальный и сам не привяжется
export const unbind = s => ({ ...s, Wiki: '', WikiOff: true, CategoryIndex: CAT_UNIQUE })

// пройтись по навыкам листа: привязанные — обновить из вики; непривязанные — привязать по точному названию (auto);
// не нашлись — уникальные. Вернёт новые списки, если что-то поменялось, и что именно
export function linkSkills(d, rules, { now = Date.now(), auto = true } = {}) {
  const ix = wikiIndex(rules)
  const stat = { bound: 0, updated: 0, unique: 0, lost: 0 }
  const out = {}
  for (const list of ['Skills', 'PassiveSkills']) {
    let changed = false
    const next = (d[list] || []).map(s => {
      let x = s
      if (s.Wiki) {
        const e = ix.byRef.get(s.Wiki)
        if (e) {
          // текст в вики поменялся — заменить (общее оформление игрока переносится, выделенные слова — нет; старое — в истории)
          const fresh = !sameText(s.Description, e.text)
          if (fresh || s.SkillName !== e.name || s.CategoryIndex !== e.cat) {
            x = { ...s, SkillName: e.name, CategoryIndex: e.cat, Description: fresh ? restyle(s.Description, e.text) : s.Description, ...(fresh ? { WikiAt: now } : {}) }
            if (fresh) stat.updated++
          }
        } else {
          // навык пропал из вики (удалён, переименован) — ищем по названию, иначе уникальный (текст остаётся)
          const alt = pick(ix.byName.get(normName(s.SkillName)), d, rules, s)
          x = alt ? bindTo(s, alt, { now, keep: false }) : { ...s, Wiki: '', CategoryIndex: CAT_UNIQUE }
          alt ? stat.bound++ : stat.lost++
        }
      } else if (!s.WikiOff && auto) {
        const e = pick(ix.byName.get(normName(s.SkillName)), d, rules, s)
        if (e) { x = bindTo(s, e, { now }); stat.bound++ } else if (s.CategoryIndex !== CAT_UNIQUE) { x = { ...s, CategoryIndex: CAT_UNIQUE }; stat.unique++ }
      } else if (s.CategoryIndex !== CAT_UNIQUE) x = { ...s, CategoryIndex: CAT_UNIQUE }
      if (x !== s) changed = true
      return x
    })
    if (changed) out[list] = next
  }
  return { lists: Object.keys(out).length ? out : null, stat }
}

// поиск по навыкам вики для ручной привязки: название, потом откуда
export function searchWiki(rules, q, n = 30) {
  const t = normName(q)
  const all = wikiIndex(rules).all
  if (!t) return all.slice(0, n)
  // точное → с начала → внутри → все слова есть → откуда (раса, класс) → хоть одно слово от 4 букв (по основе)
  const ws = t.split(' ').filter(Boolean)
  const stem = w => (w.length > 5 ? w.slice(0, -2) : w)
  const sc = e => {
    const x = normName(e.name)
    if (x === t) return 0
    if (x.startsWith(t)) return 1
    if (x.includes(t)) return 2
    if (ws.every(w => x.includes(stem(w)))) return 3
    if (normName(e.src).includes(t)) return 4
    const n = ws.filter(w => w.length >= 4 && x.includes(stem(w))).length
    return n ? 8 - Math.min(n, 3) : 9
  }
  return all.map(e => [sc(e), e]).filter(([v]) => v < 9).sort((a, b) => a[0] - b[0]).slice(0, n).map(([, e]) => e)
}
export const isFresh = (s, now = Date.now()) => !!s?.Wiki && s.WikiAt > 0 && now - s.WikiAt < FRESH_MS
