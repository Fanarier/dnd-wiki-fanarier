// Превью при наведении: по ссылке «вид:id» — карточка (название, подпись, кусок текста, картинка, куда вести).
// Ссылки берутся из @-упоминаний (span.mention data-id) и из названий в скобках, которые сайт сам узнаёт в тексте:
// «(Горение)», «(Огненный шар)», «(Паладин)» → эффект, заклинание, класс из вики.
import { store, npcState, rulesState, loadNpcs, loadRules, heroPortraitUrl, heroCover } from '../../map/store.js'
import { htmlToText } from '../../shared/rules.js'
import { groupOf, npcSubtitle } from '../../shared/npc.js'
import { EFFECT_KINDS } from '../../shared/rules.js'

const short = (s, n = 260) => { const t = htmlToText(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t }
const KIND = Object.fromEntries(EFFECT_KINDS.map(k => [k.id, k]))
let loading = false
export function ensureData() {
  if (loading) return
  loading = true
  loadNpcs()
  loadRules()
}

export function resolve(ref) {
  const [kind, id] = String(ref || '').split(/:(.+)/)
  if (!id) return null
  if (kind === 'npc') {
    const n = npcState.npcs.find(x => x.id === id)
    const a = n?.arts?.[0]
    return n && { kind: 'НПС', title: n.name, sub: [groupOf(n.group).one, npcSubtitle(n), n.home].filter(Boolean).join(' · '), text: short(n.desc), img: a ? heroPortraitUrl(a.thumb || a.file) : '', to: { path: '/wiki', query: { npc: n.id } } }
  }
  if (kind === 'hero') {
    const h = (store.data.heroes || []).find(x => x.id === id)
    const c = h && heroCover(h)
    return h && { kind: 'Герой', title: h.name, sub: [h.location, h.group, h.status].filter(Boolean).join(' · '), text: short(h.effectPlus || h.housing || ''), img: c ? heroPortraitUrl(c.thumb || c.file) : '', to: { path: '/wiki', query: { hero: h.id } } }
  }
  if (kind === 'city') {
    const c = (store.data.cities || []).find(x => x.id === id)
    return c && { kind: 'Город', title: c.name, sub: 'на карте мира', text: short(c.description), icon: '🏰', to: { path: '/', query: { focus: 'cities:' + c.id } } }
  }
  if (kind === 'settle') {
    const s = (store.data.settlements || []).find(x => x.id === id)
    return s && { kind: 'Поселение', title: s.name, sub: 'поселение', text: '', icon: '🏘', to: { path: '/settlement/' + s.id } }
  }
  if (kind === 'fx') {
    const e = rulesState.effects.find(x => x.id === id)
    return e && { kind: (KIND[e.kind]?.one || '') + ' эффект', title: e.name, sub: e.tag, text: short(e.html), img: e.icon, color: e.kind === 'debuff' ? '#ff6b5e' : e.kind === 'special' ? '#b9a6ff' : '#7ed07a', to: { path: '/wiki', query: { section: 'effects' } } }
  }
  if (kind === 'spell') {
    const x = rulesState.spells.find(s => s.id === id)
    const sc = x && rulesState.schools.find(s => s.id === x.school)
    return x && { kind: 'Заклинание', title: x.name, sub: [sc?.name, x.circle === 'Б' ? 'базовое' : x.circle ? x.circle + ' круг' : '', x.cost, x.cd].filter(Boolean).join(' · '), text: short(x.html), icon: '✺', color: '#b9a6ff', to: { path: '/wiki', query: { section: sc?.page || 'utility' } } }
  }
  if (kind === 'race') {
    const r = rulesState.races.find(x => x.id === id)
    return r && { kind: 'Раса', title: r.name, sub: `${r.base.length} базовых навыка · ${r.levels.length} уровней`, text: short(r.intro || r.base.map(b => b.name).join(', ')), icon: '🧬', to: { path: '/wiki', query: { race: r.id } } }
  }
  if (kind === 'cls') {
    const k = rulesState.classes.find(x => x.id === id)
    return k && { kind: 'Класс', title: k.name, sub: k.archetypes.map(a => a.name).join(' · '), text: short(k.intro), icon: '⚔', to: { path: '/wiki', query: { cls: k.id } } }
  }
  if (kind === 'art') {
    const a = rulesState.articles.find(x => x.id === id)
    return a && { kind: 'Статья', title: a.title, sub: '', text: short(a.html), icon: '📜', to: { path: '/wiki', query: { section: a.group === 'magic' ? 'general' : a.group, a: a.id } } }
  }
  return null
}

// названия из вики, которые узнаются в тексте в скобках (длинные — раньше коротких)
let index = null, indexRev = -1
const norm = s => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim()
function termIndex() {
  if (index && indexRev === rulesState.rev) return index
  index = new Map()
  for (const k of rulesState.classes) index.set(norm(k.name), 'cls:' + k.id)
  for (const r of rulesState.races) index.set(norm(r.name), 'race:' + r.id)
  for (const x of rulesState.spells) if (x.name.length > 3) index.set(norm(x.name), 'spell:' + x.id)
  for (const e of rulesState.effects) index.set(norm(e.name), 'fx:' + e.id) // эффекты важнее — перекрывают
  indexRev = rulesState.rev
  return index
}
const escAttr = s => String(s).replace(/"/g, '&quot;')
// HTML: «(Горение)» или «Горение» в кавычках-ёлочках → «(<span class="pv-term" data-pv="fx:…">Горение</span>)» — только в тексте между тегами
export function markTerms(html) {
  const s = String(html || '')
  if (!rulesState.loaded || !s.includes('(')) return s
  const idx = termIndex()
  return s.split(/(<[^>]+>)/).map(seg => (seg.startsWith('<') ? seg
    : seg.replace(/([(«])([^()«»<>]{3,40})([)»])/g, (m, l, name, r) => {
      const ref = (l === '(') === (r === ')') && idx.get(norm(name))
      return ref ? `${l}<span class="pv-term" data-pv="${escAttr(ref)}">${name}</span>${r}` : m
    }))).join('')
}
