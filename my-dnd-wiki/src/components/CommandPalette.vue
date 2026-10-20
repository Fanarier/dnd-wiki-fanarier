<template>
  <!-- быстрый переход (Ctrl+K или «/»): страницы и разделы, всё из вики, НПС, герои, места, заказы, свои листы
       и действия («записать деятельность», «бросить к20»). Стрелки — выбор, Enter — перейти, Esc — закрыть -->
  <Teleport to="body">
    <transition name="cp">
      <div v-if="open" class="cp-back" @mousedown.self="close">
        <div class="cp" role="dialog" aria-label="Быстрый переход">
          <label class="cp-in">
            <span>⌕</span>
            <input ref="inp" v-model="q" placeholder="Куда идём? Раса, заклинание, НПС, лист, «записать деятельность»…" @keydown.down.prevent="move(1)" @keydown.up.prevent="move(-1)" @keydown.enter.prevent="go(list[sel])" @keydown.esc="close" />
            <kbd>Esc</kbd>
          </label>
          <div ref="listEl" class="cp-list">
            <template v-for="(it, i) in list" :key="it.key">
              <div v-if="i === 0 || list[i - 1].group !== it.group" class="cp-g">{{ it.group }}</div>
              <button type="button" class="cp-it" :class="{ on: i === sel }" :data-i="i" @mousemove="sel = i" @click="go(it)">
                <span class="cp-ic" :style="it.color ? { '--c': it.color } : null"><img v-if="it.img" :src="it.img" alt="" /><template v-else>{{ it.icon }}</template></span>
                <span class="cp-t"><b>{{ it.title }}</b><small v-if="it.sub">{{ it.sub }}</small></span>
                <kbd v-if="i === sel">↵</kbd>
              </button>
            </template>
            <p v-if="!list.length" class="cp-none">Ничего не нашлось — попробуй короче.</p>
          </div>
          <footer><span>↑↓ выбрать</span><span>↵ перейти</span><span>Ctrl+K — открыть отовсюду</span></footer>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import Fuse from 'fuse.js'
import { store, npcState, rulesState, actState, loadNpcs, loadRules, loadActivities, requestRoll, heroPortraitUrl, heroCover, api } from '../map/store.js'
import { EFFECT_KINDS } from '../shared/rules.js'
import { sfx } from '../sound/sound.js'

const router = useRouter()
const open = ref(false)
const q = ref('')
const sel = ref(0)
const inp = ref(null)
const listEl = ref(null)
const mySheets = ref([])

// разделы вики — как в меню
const SECTIONS = [
  ['quests', 'Заказы гильдий', '📜'], ['campaign', 'Квесты', '🗺'], ['heroes', 'Герои Анкарии', '⚔'], ['npcs', 'НПС', '🜲'], ['settlements', 'Поселения', '🏘'],
  ['races', 'Расы', '🧬'], ['classes', 'Классы', '🛡'], ['mechanics', 'Механики', '⚙'], ['workplaces', 'Рабочие места', '⚒'], ['activities', 'Деятельности', '📒'],
  ['effects', 'Эффекты', '✦'], ['general', 'Магия: общее', '✺'], ['utility', 'Утилитарная магия', '✧'], ['school-fire', 'Школа Огня (Магмы)', '🔥'],
  ['school-water', 'Школа Воды (Льда)', '💧'], ['school-air', 'Школа Воздуха (Молний)', '🌪'], ['school-earth', 'Школа Земли (Природы)', '🌿']
]
const KIND = Object.fromEntries(EFFECT_KINDS.map(k => [k.id, k]))
const myHero = computed(() => actState.heroes.find(h => h.canWrite && store.role !== 'master') || null)

const items = computed(() => {
  const d = []
  const add = (group, o) => d.push({ group, key: group + (o.key || o.title), ...o })
  // действия
  if (store.me) {
    if (myHero.value) add('Действия', { title: 'Записать деятельность', sub: myHero.value.name, icon: '✍', to: { path: '/wiki', query: { section: 'activities', log: myHero.value.heroId, new: '1' } } })
    add('Действия', { title: 'Бросить к20', sub: 'общие кубики', icon: '🎲', run: () => requestRoll({ formula: '1d20', label: '' }) })
    for (const s of mySheets.value) add('Мои листы', { key: s.id, title: s.name || 'Без имени', sub: [s.cls, s.level ? s.level + ' ур.' : ''].filter(Boolean).join(' · '), icon: '📖', to: '/sheets/' + s.id })
  }
  add('Страницы', { title: 'Карта мира', icon: '🗺', to: '/' })
  if (store.me) add('Страницы', { title: 'Листы персонажей', icon: '📚', to: '/sheets' })
  if (store.me) add('Страницы', { title: 'Профиль', icon: '👤', to: '/profile' })
  for (const [id, t, ic] of SECTIONS) add('Разделы вики', { key: id, title: t, icon: ic, to: { path: '/wiki', query: { section: id } } })
  for (const r of rulesState.races) add('Расы', { key: r.id, title: r.name, icon: '🧬', to: { path: '/wiki', query: { race: r.id } } })
  for (const k of rulesState.classes) add('Классы', { key: k.id, title: k.name, sub: k.archetypes.map(a => a.name).join(', '), icon: '🛡', to: { path: '/wiki', query: { cls: k.id } } })
  const schools = new Map(rulesState.schools.map(s => [s.id, s]))
  for (const x of rulesState.spells) { const sc = schools.get(x.school); add('Заклинания', { key: x.id, title: x.name, sub: [sc?.name, x.circle ? (x.circle === 'Б' ? 'базовое' : x.circle + ' круг') : ''].filter(Boolean).join(' · '), icon: '✺', color: '#b9a6ff', to: { path: '/wiki', query: { section: sc?.page || 'utility' } } }) }
  for (const e of rulesState.effects) add('Эффекты', { key: e.id, title: e.name, sub: KIND[e.kind]?.one + ' эффект', img: e.icon, to: { path: '/wiki', query: { section: 'effects' } } })
  for (const a of rulesState.articles) add('Статьи правил', { key: a.id, title: a.title, icon: '📜', to: { path: '/wiki', query: { section: a.group === 'magic' ? 'general' : a.group, a: a.id } } })
  for (const n of npcState.npcs) { const a = n.arts?.[0]; add('НПС', { key: n.id, title: n.name, sub: n.home, img: a ? heroPortraitUrl(a.thumb || a.file) : '', icon: '🜲', to: { path: '/wiki', query: { npc: n.id } } }) }
  for (const h of store.data.heroes || []) { const c = heroCover(h); add('Герои', { key: h.id, title: h.name, sub: h.location, img: c ? heroPortraitUrl(c.thumb || c.file) : '', icon: '⚔', to: { path: '/wiki', query: { hero: h.id } } }) }
  for (const c of store.data.cities || []) add('Места', { key: c.id, title: c.name, sub: 'город на карте', icon: '🏰', to: { path: '/', query: { focus: 'cities:' + c.id } } })
  for (const s of store.data.settlements || []) add('Места', { key: s.id, title: s.name, sub: 'поселение', icon: '🏘', to: '/settlement/' + s.id })
  for (const x of store.data.quests || []) add('Заказы гильдий', { key: x.id, title: x.type, sub: x.guild, icon: '📜', to: { path: '/wiki', query: { quest: x.id } } })
  return d
})
const norm = s => String(s || '').toLowerCase().replace(/ё/g, 'е')
const fuse = computed(() => new Fuse(items.value, { keys: [{ name: 'title', weight: 3 }, { name: 'sub', weight: 1 }, { name: 'group', weight: 0.5 }], threshold: 0.32, ignoreLocation: true, getFn: (o, p) => norm(Fuse.config.getFn(o, p)) }))
// пусто — действия, листы и разделы; иначе — лучшие совпадения, сгруппированные по видам
const list = computed(() => {
  const s = norm(q.value.trim())
  if (!s) return items.value.filter(it => ['Действия', 'Мои листы', 'Страницы', 'Разделы вики'].includes(it.group)).slice(0, 40)
  const hits = fuse.value.search(s, { limit: 60 }).map(r => r.item)
  const order = [...new Set(hits.map(h => h.group))]
  return order.flatMap(g => hits.filter(h => h.group === g).slice(0, 8))
})
watch(list, () => { sel.value = 0 })
function move(d) {
  if (!list.value.length) return
  sel.value = (sel.value + d + list.value.length) % list.value.length
  nextTick(() => listEl.value?.querySelector(`[data-i="${sel.value}"]`)?.scrollIntoView({ block: 'nearest' }))
}
function go(it) {
  if (!it) return
  close()
  if (it.run) it.run()
  else router.push(it.to)
}

async function show() {
  open.value = true
  q.value = ''
  sfx('pageFlip', 0.25)
  loadRules(); loadNpcs()
  if (store.me) {
    loadActivities()
    api('GET', '/api/sheets').then(j => { mySheets.value = (j.sheets || []).filter(s => s.canEdit && !s.deletedAt && (store.role !== 'master' || s.ownerId === store.me?.id)) }).catch(() => {})
  }
  await nextTick()
  inp.value?.focus()
}
const close = () => { open.value = false }
function key(e) {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable
  if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K' || e.code === 'KeyK')) { e.preventDefault(); open.value ? close() : show() }
  else if (e.key === '/' && !typing && !open.value) { e.preventDefault(); show() }
}
// открыть можно и кнопкой: window.dispatchEvent(new Event('anacaria:palette'))
onMounted(() => { addEventListener('keydown', key); addEventListener('anacaria:palette', show) })
onBeforeUnmount(() => { removeEventListener('keydown', key); removeEventListener('anacaria:palette', show) })
</script>

<style scoped>
.cp-back { position: fixed; inset: 0; z-index: 900; display: grid; justify-items: center; align-items: start; padding: 10vh 16px 16px; background: rgba(5, 7, 11, .6); backdrop-filter: blur(3px); }
.cp { display: grid; grid-template-rows: auto minmax(0, 1fr) auto; width: min(640px, 100%); max-height: 72vh; border-radius: 18px; background: linear-gradient(180deg, #1f1912, #14100b); border: 1px solid rgba(231, 197, 111, .45); box-shadow: 0 30px 80px rgba(0, 0, 0, .7), 0 0 40px rgba(231, 197, 111, .08); overflow: hidden; }
.cp-in { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-bottom: 1px solid rgba(231, 197, 111, .15); }
.cp-in span { color: #e7c56f; font-size: 22px; }
.cp-in input { flex: 1; min-width: 0; border: 0; background: none; color: #f3dc9e; font: 600 16px 'Manrope', sans-serif; outline: none; }
.cp-in input::placeholder { color: #7d7160; }
kbd { padding: 1px 6px; border-radius: 6px; border: 1px solid rgba(231, 197, 111, .3); color: #a8936c; font: 700 11px 'Manrope', sans-serif; }
.cp-list { overflow-y: auto; padding: 6px; }
.cp-g { padding: 8px 8px 4px; color: #a8936c; font: 800 10.5px 'Manrope', sans-serif; letter-spacing: .1em; text-transform: uppercase; }
.cp-it { display: flex; align-items: center; gap: 10px; width: 100%; padding: 7px 8px; border: 0; border-radius: 10px; background: none; color: #efe3c8; text-align: left; cursor: pointer; }
.cp-it.on { background: linear-gradient(90deg, rgba(231, 197, 111, .18), rgba(231, 197, 111, .04)); box-shadow: inset 3px 0 0 #e7c56f; }
.cp-ic { --c: #e7c56f; display: grid; place-items: center; flex: none; width: 30px; height: 30px; border-radius: 9px; overflow: hidden; background: color-mix(in srgb, var(--c) 14%, #0e0b07); border: 1px solid color-mix(in srgb, var(--c) 35%, transparent); font-size: 15px; }
.cp-ic img { width: 100%; height: 100%; object-fit: cover; }
.cp-t { flex: 1; display: grid; min-width: 0; }
.cp-t b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 700 14px 'Manrope', sans-serif; }
.cp-t small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #a8936c; font: 600 11.5px 'Manrope', sans-serif; }
.cp-none { padding: 20px; text-align: center; color: #a8936c; }
footer { display: flex; gap: 14px; padding: 8px 14px; border-top: 1px solid rgba(231, 197, 111, .12); color: #7d7160; font: 700 11px 'Manrope', sans-serif; }
.cp-enter-active, .cp-leave-active { transition: opacity .18s; }
.cp-enter-active .cp, .cp-leave-active .cp { transition: transform .22s cubic-bezier(.2, .9, .3, 1.2); }
.cp-enter-from, .cp-leave-to { opacity: 0; }
.cp-enter-from .cp, .cp-leave-to .cp { transform: translateY(-14px) scale(.97); }
@media (max-width: 600px) { footer { display: none; } .cp-back { padding-top: 70px; } }
</style>
