<template>
  <!-- поиск по всему сайту: статьи, НПС, навыки и эффекты, герои, заказы, поселения, города. Прощает опечатки -->
  <div class="ws">
    <div v-if="!groups.length" class="ws-none">
      <b>Ничего не нашлось.</b>
      <span>Попробуй короче или другим словом — опечатки поиск прощает, но не всё сразу.</span>
    </div>
    <section v-for="g in groups" :key="g.key" class="ws-group">
      <h3>{{ g.icon }} {{ g.label }} <small>{{ g.items.length }}</small></h3>
      <div class="ws-list">
        <component :is="it.to ? 'router-link' : 'button'" v-for="it in g.shown" :key="it.key" :to="it.to" type="button" class="ws-item" @click="pick(it)">
          <img v-if="it.img" :src="it.img" alt="" class="ws-pic" loading="lazy" />
          <span v-else class="ws-pic ph">{{ g.icon }}</span>
          <span class="ws-txt">
            <b v-html="mark(it.title)" />
            <small v-if="it.sub || it.extra" v-html="mark([it.sub, it.extra].filter(Boolean).join(' · '))" />
            <span v-if="it.snippet" class="ws-snip" v-html="it.snippet" />
          </span>
        </component>
      </div>
      <button v-if="g.items.length > g.shown.length" type="button" class="ws-more" @click="open[g.key] = true">ещё {{ g.items.length - g.shown.length }}</button>
    </section>
  </div>
</template>

<script setup>
import { computed, reactive, watch } from 'vue'
import Fuse from 'fuse.js'
import { store, npcState, loadNpcs, rulesState, loadRules, heroPortraitUrl, heroCover } from '../map/store.js'
import { groupOf, npcSubtitle, skillKey } from '../shared/npc.js'
import { EFFECT_KINDS } from '../shared/rules.js'

const props = defineProps({ query: { type: String, default: '' } })
const emit = defineEmits(['article', 'done'])

// ё = е, регистр не важен — и в тексте, и в запросе
const norm = s => String(s ?? '').toLowerCase().replace(/ё/g, 'е')
// описания теперь бывают с оформлением (HTML) — для поиска и отрывков оставляем только текст
const strip = s => String(s ?? '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const words = computed(() => norm(props.query).trim().split(/\s+/).filter(w => w.length > 1))
// подсветка точных совпадений слов (опечатку подсветить нельзя — просто без подсветки)
function mark(text) {
  let out = esc(text)
  for (const w of words.value) out = out.replace(new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/е/g, '[её]'), 'gi'), m => `<mark>${m}</mark>`)
  return out
}
function snippet(text, margin = 70) {
  const t = String(text || '').replace(/\s+/g, ' ')
  const i = words.value.map(w => norm(t).indexOf(w)).filter(i => i >= 0).sort((a, b) => a - b)[0]
  if (i == null) return ''
  const a = Math.max(0, i - margin), b = Math.min(t.length, i + margin * 2)
  return (a > 0 ? '…' : '') + mark(t.slice(a, b)) + (b < t.length ? '…' : '')
}

// листы НПС приходят отдельным запросом — подгружаем при первом поиске
watch(() => props.query, q => { if (q.trim()) { loadNpcs(); loadRules() } }, { immediate: true })

const npcUsers = computed(() => {
  const m = new Map()
  for (const n of npcState.npcs) for (const [kind, list] of [['passive', n.passives], ['active', n.actives]]) for (const s of list) {
    const k = skillKey(kind, s.name)
    if (!m.has(k)) m.set(k, [])
    m.get(k).push(n.name)
  }
  return m
})

// всё, что можно найти, — одним списком: группа, заголовок, подпись, текст для поиска и куда вести
const docs = computed(() => {
  const d = []
  for (const n of npcState.npcs) {
    const a = n.arts?.[0]
    d.push({ g: 'npcs', key: 'n' + n.id, title: n.name, sub: [groupOf(n.group).one, npcSubtitle(n), n.home].filter(Boolean).join(' · '),
      text: [n.status?.text, strip(n.desc), ...n.info.map(x => x.v), ...n.lists.flatMap(l => l.items)].join(' '), img: a ? heroPortraitUrl(a.thumb || a.file) : '', to: { path: '/wiki', query: { npc: n.id } } })
  }
  for (const s of npcState.skills) {
    const who = npcUsers.value.get(skillKey(s.kind, s.name)) || []
    // «есть у» только показываем, не ищем по нему — иначе имя НПС находит десятки его навыков
    d.push({ g: 'skills', key: 's' + s.id, title: s.name, sub: [s.kind === 'active' ? 'активный навык' : 'пассивный навык', s.type].filter(Boolean).join(' · '), extra: who.length ? 'есть у: ' + who.slice(0, 4).join(', ') + (who.length > 4 ? '…' : '') : '',
      text: s.desc, npc: npcState.npcs.find(n => n.name === who[0]) })
  }
  for (const e of npcState.effects) d.push({ g: 'effects', key: 'e' + e.id, title: e.name, sub: (e.aliases || []).join(', '), text: e.desc })
  for (const h of store.data.heroes || []) {
    const c = heroCover(h)
    d.push({ g: 'heroes', key: 'h' + h.id, title: h.name, sub: [h.location, h.group, h.status].filter(Boolean).join(' · '), text: [h.effectPlus, h.effectMinus, h.housing].join(' '),
      img: c ? heroPortraitUrl(c.thumb || c.file) : '', to: { path: '/wiki', query: { hero: h.id } } })
  }
  // квесты кампании и главы сюжета — на страницу «Квесты»
  for (const q of store.data.campaign?.quests || []) d.push({ g: 'campaign', key: 'cq' + q.id, title: q.name, sub: [q.status, q.difficulty, q.region, q.location].filter(Boolean).join(' · '), text: [q.desc, q.source, q.taker].join(' '), to: { path: '/wiki', query: { section: 'campaign' } } })
  for (const c of store.data.campaign?.chapters || []) d.push({ g: 'campaign', key: 'ch' + c.id, title: c.title, sub: ['сюжет', c.act, c.dateWorld].filter(Boolean).join(' · '), text: c.result, to: { path: '/wiki', query: { section: 'campaign' } } })
  for (const q of store.data.quests || []) d.push({ g: 'quests', key: 'q' + q.id, title: q.type, sub: [q.guild, q.rank, q.status === 'open' ? 'открыт' : ''].filter(Boolean).join(' · '), text: [strip(q.description), q.reward, ...(q.tasks || []).map(t => t.text || t)].join(' '), to: { path: '/wiki', query: { quest: q.id } } })
  // правила: расы, классы, их навыки и статьи (механики, рабочие места, деятельности)
  const GROUP_SEC = { mechanics: 'Механики', workplaces: 'Рабочие места', activities: 'Деятельности', races: 'Расы', classes: 'Классы', magic: 'Магия' }
  const SECTION_OF = { magic: 'general' } // статьи магии — в разделе «Общее»
  for (const r of rulesState.races) {
    d.push({ g: 'rules', key: 'rr' + r.id, title: r.name, sub: 'раса', text: strip(r.intro), to: { path: '/wiki', query: { race: r.id } } })
    const sk = (x, sub) => d.push({ g: 'rskills', key: 'rs' + r.id + x.name + sub, title: x.name, sub: `${r.name} · ${sub}`, text: strip(x.html), to: { path: '/wiki', query: { race: r.id } } })
    for (const x of r.base) sk(x, 'базовый навык')
    for (const l of r.levels) { if (l.auto) sk(l.auto, `${l.lv} ур.`); for (const o of l.options) sk(o, `${l.lv} ур., на выбор`) }
  }
  for (const k of rulesState.classes) {
    d.push({ g: 'rules', key: 'rk' + k.id, title: k.name, sub: 'класс · ' + k.archetypes.map(a => a.name).join(', '), text: strip(k.intro), to: { path: '/wiki', query: { cls: k.id } } })
    for (const x of k.skills) if (x.html) d.push({ g: 'rskills', key: 'ks' + k.id + x.name + x.lv, title: x.name, sub: `${k.name} · ${x.lv} ур. · ${x.kind}`, text: strip(x.html), to: { path: '/wiki', query: { cls: k.id } } })
    for (const a of k.archetypes) for (const x of a.skills) if (x.html) d.push({ g: 'rskills', key: 'ka' + k.id + a.name + x.name + x.lv, title: x.name, sub: `${k.name}: ${a.name} · ${x.lv} ур.`, text: strip(x.html), to: { path: '/wiki', query: { cls: k.id, arch: a.name } } })
  }
  for (const a of rulesState.articles) d.push({ g: 'rules', key: 'ra' + a.id, title: a.title, sub: GROUP_SEC[a.group] || 'правила', text: strip(a.html), to: { path: '/wiki', query: { section: SECTION_OF[a.group] || a.group, a: a.id } } })
  // заклинания школ магии и эффекты вики (с иконками)
  const schools = new Map(rulesState.schools.map(x => [x.id, x]))
  for (const x of rulesState.spells) {
    const sc = schools.get(x.school)
    d.push({ g: 'spells', key: 'sp' + x.id, title: x.name, sub: [sc?.name, x.circle === 'Б' ? 'базовое' : x.circle ? x.circle + ' круг' : '', x.cost, x.cd].filter(Boolean).join(' · '), text: strip(x.html), to: { path: '/wiki', query: { section: sc?.page || 'utility' } } })
  }
  for (const e of rulesState.effects) d.push({ g: 'effects', key: 'fx' + e.id, title: e.name, sub: [EFFECT_KINDS.find(k => k.id === e.kind)?.one + ' эффект', e.tag].filter(Boolean).join(' · '), text: strip(e.html), img: e.icon, to: { path: '/wiki', query: { section: 'effects' } } })
  for (const s of store.data.settlements || []) d.push({ g: 'places', key: 'st' + s.id, title: s.name, sub: 'поселение', text: '', to: { path: '/settlement/' + s.id } })
  for (const c of store.data.cities || []) d.push({ g: 'places', key: 'c' + c.id, title: c.name, sub: 'на карте мира', text: strip(c.description), to: { path: '/', query: { focus: 'cities:' + c.id } } })
  return d
})
const fuseOpts = threshold => ({
  keys: [{ name: 'title', weight: 3 }, { name: 'sub', weight: 1 }, { name: 'text', weight: 0.6 }],
  getFn: (obj, path) => norm(Fuse.config.getFn(obj, path)),
  // длинный текст листа не штрафуем: раса «Дракон» в нём должна находиться так же, как в заголовке
  threshold, ignoreLocation: true, ignoreFieldNorm: true, minMatchCharLength: 2, includeScore: true
})
// короткие слова ищем строже: «рана» не должна находить «Охрану» и «Амарану»
const fuse = computed(() => new Fuse(docs.value, fuseOpts(0.34)))
const fuseStrict = computed(() => new Fuse(docs.value, fuseOpts(0.12)))

const GROUPS = [
  { key: 'npcs', label: 'НПС', icon: '🜲' }, { key: 'heroes', label: 'Герои Анкарии', icon: '⚔' }, { key: 'places', label: 'Места', icon: '📍' },
  { key: 'quests', label: 'Заказы гильдий', icon: '📜' }, { key: 'campaign', label: 'Квесты и сюжет', icon: '🗺' }, { key: 'skills', label: 'Навыки', icon: '✦' }, { key: 'effects', label: 'Эффекты', icon: '◈' },
  { key: 'rules', label: 'Правила: расы, классы, механики', icon: '⚜' }, { key: 'rskills', label: 'Навыки рас и классов', icon: '✧' },
  { key: 'spells', label: 'Заклинания', icon: '✺' }
]
const open = reactive({})
watch(() => props.query, () => { for (const k in open) delete open[k] })
const groups = computed(() => {
  const q = norm(props.query).trim()
  if (q.length < 2) return []
  // каждое слово ищем отдельно и оставляем то, где нашлись все; выше — где совпало точнее
  const ws = q.split(/\s+/).filter(w => w.length > 1)
  if (!ws.length) return []
  let best = null
  for (const w of ws) {
    const m = new Map((w.length <= 4 ? fuseStrict : fuse).value.search(w).map(r => [r.item.key, { item: r.item, score: r.score }]))
    if (!best) best = m
    else for (const [k, v] of best) { const x = m.get(k); if (x) v.score += x.score; else best.delete(k) }
  }
  const hits = [...best.values()].sort((a, b) => a.score - b.score).map(v => v.item)
  return GROUPS.map(g => {
    const items = hits.filter(h => h.g === g.key).map(h => ({ ...h, snippet: h.text ? snippet(h.text) : '' }))
    return { ...g, items, shown: open[g.key] ? items : items.slice(0, 6) }
  }).filter(g => g.items.length)
})

// статья открывается разделом вики, навык — листом первого НПС, у кого он есть; остальное — ссылкой
function pick(it) {
  if (it.articleId) emit('article', it.articleId)
  else if (it.npc) emit('done', { path: '/wiki', query: { npc: it.npc.id } })
  else if (it.g === 'effects' && !it.to) emit('done', { path: '/wiki', query: { section: 'npcs' } })
  else emit('done', null)
}
</script>

<style scoped>
.ws { display: grid; gap: 18px; font-family: 'Manrope', sans-serif; color: #e9dfc8; }
.ws-none { display: grid; gap: 4px; padding: 18px; border-radius: 14px; border: 1px dashed rgba(231, 197, 111, .3); color: #a8936c; }
.ws-none b { color: #f3dc9e; }
.ws-group h3 { margin: 0 0 8px; font: 700 19px 'Cormorant Garamond', serif; color: #e6c27a; }
.ws-group h3 small { color: #a8936c; font: 800 12px 'Manrope', sans-serif; }
.ws-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(300px, 100%), 1fr)); gap: 8px; }
.ws-item { display: flex; gap: 10px; align-items: flex-start; min-width: 0; padding: 9px 11px; border-radius: 12px; border: 1px solid rgba(231, 197, 111, .16); background: rgba(255, 255, 255, .025); color: inherit; text-decoration: none; text-align: left; font: inherit; cursor: pointer; transition: border-color .15s, background .15s, transform .15s; }
.ws-item:hover { border-color: rgba(231, 197, 111, .5); background: rgba(231, 197, 111, .06); transform: translateY(-1px); }
.ws-pic { flex: none; width: 44px; height: 44px; border-radius: 10px; object-fit: cover; object-position: 50% 20%; background: #120e09; }
.ws-pic.ph { display: grid; place-items: center; color: #c9a24f; font-size: 18px; border: 1px solid rgba(231, 197, 111, .2); }
.ws-txt { display: grid; gap: 2px; min-width: 0; }
.ws-txt b { font-size: 14px; color: #f3dc9e; overflow-wrap: anywhere; }
.ws-txt small { color: #a8936c; font-size: 12px; overflow-wrap: anywhere; }
.ws-snip { color: #cdbf9f; font-size: 12.5px; line-height: 1.45; }
.ws :deep(mark) { background: rgba(231, 197, 111, .28); color: #fff3d6; border-radius: 3px; padding: 0 1px; }
.ws-more { margin-top: 6px; padding: 4px 12px; border-radius: 99px; border: 1px dashed rgba(231, 197, 111, .4); background: none; color: #e6c27a; font: 700 12px 'Manrope', sans-serif; cursor: pointer; }
</style>
