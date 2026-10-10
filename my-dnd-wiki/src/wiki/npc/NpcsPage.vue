<template>
  <!-- раздел «НПС»: сетка карточек с фильтрами; ?npc=<id> — полный лист с переходом к соседям -->
  <div class="np">
    <div v-if="!npcState.loaded" class="np-load"><SteamLoader kind="board" /></div>

    <!-- ===== лист одного НПС ===== -->
    <template v-else-if="open">
      <nav class="np-nav">
        <button type="button" class="np-back" @click="close">← Все НПС</button>
        <span class="np-crumb">{{ groupOf(open.group).label }}<template v-if="pos >= 0"> · {{ pos + 1 }} / {{ list.length }}</template></span>
        <span class="grow" />
        <button type="button" class="np-step" :disabled="!prev" :title="prev ? `← ${prev.name}` : ''" @click="go(prev)">‹ <span>{{ prev?.name || '' }}</span></button>
        <button type="button" class="np-step" :disabled="!next" :title="next ? `${next.name} →` : ''" @click="go(next)"><span>{{ next?.name || '' }}</span> ›</button>
      </nav>
      <!-- переход между листами: ← → уезжает в свою сторону, открытие из списка — всплывает -->
      <Transition :name="sheetAnim" mode="out-in">
        <NpcSheet :key="open.id" :npc="open" :skills="skillMap" :effects="npcState.effects" :master="master" @edit="editing = open" @skill="(kind, s) => (skillEdit = { kind, entry: s })" />
      </Transition>
    </template>

    <!-- ===== все НПС ===== -->
    <template v-else>
      <header class="np-head">
        <div>
          <h2>НПС Анкарии</h2>
          <p>Сайд-кики, компаньоны и важные персонажи мира — полные листы, навыки и бой.</p>
        </div>
        <div class="np-tools">
          <button type="button" class="np-btn" @click="glossary = true">📖 Справочник</button>
          <button v-if="master && group !== 'all'" type="button" class="np-btn" :class="{ on: arranging }" :title="arranging ? 'Закончить' : 'Перетаскивай карточки, чтобы задать порядок в группе'" @click="toggleArrange">⇅ {{ arranging ? 'Готово' : 'Расставить' }}</button>
          <button v-if="master" type="button" class="np-btn primary" @click="create">+ НПС</button>
        </div>
      </header>

      <nav class="np-tabs">
        <button type="button" :class="{ on: group === 'all' }" @click="setGroup('all')">Все<small>{{ visible.length }}</small></button>
        <button v-for="g in NPC_GROUPS" :key="g.key" type="button" :class="{ on: group === g.key }" @click="setGroup(g.key)">
          {{ g.icon }} {{ g.label }}<small>{{ count(g.key) }}</small>
        </button>
      </nav>

      <div class="np-bar">
        <input v-model="q" class="np-search" type="search" placeholder="Поиск: имя, раса, класс, навык…" />
        <select v-model="home" class="np-sel" title="Где живёт">
          <option value="">Все места</option>
          <option v-for="h in homes" :key="h" :value="h">{{ h }}</option>
        </select>
        <select v-model="sort" class="np-sel" title="Порядок">
          <option value="order">По порядку</option>
          <option value="name">По имени</option>
          <option value="level">По уровню</option>
        </select>
      </div>
      <div v-if="statuses.length" class="np-status">
        <button v-for="s in statuses" :key="s.text" type="button" :class="{ on: status.includes(s.text) }" :style="{ '--sc': s.color }" @click="toggleStatus(s.text)">{{ s.text }}<small>{{ s.n }}</small></button>
        <button v-if="status.length" type="button" class="clear" @click="status = []">сбросить</button>
      </div>

      <!-- мастер расставляет порядок в группе: перетаскивание, сохраняется сразу -->
      <template v-if="arranging">
        <p class="np-hint">Перетаскивай карточки — порядок «{{ groupOf(group).label }}» сохраняется сразу. Фильтры на это время не действуют.</p>
        <VueDraggable v-model="arrangeList" :animation="220" ghost-class="np-ghost" class="np-grid arr" @end="saveOrder">
          <div v-for="(n, idx) in arrangeList" :key="n.id" class="np-card arr">
            <div class="np-pic">
              <img v-if="n.arts?.[0]" :src="heroPortraitUrl(n.arts[0].thumb || n.arts[0].file)" :style="{ objectPosition: `${n.arts[0].pos?.x ?? 50}% ${n.arts[0].pos?.y ?? 20}%` }" alt="" draggable="false" />
              <span v-else class="np-ph">{{ (n.name || '?')[0] }}</span>
              <span class="np-lvl">{{ idx + 1 }}</span>
            </div>
            <div class="np-txt"><b>{{ n.name }}</b></div>
          </div>
        </VueDraggable>
      </template>
      <!-- карточки «раздаются» при открытии и смене фильтров; при наведении наклоняются за мышью -->
      <TransitionGroup v-else :key="dealKey" name="np-deal" tag="div" class="np-grid" appear>
        <button v-for="(n, idx) in list" :key="n.id" type="button" class="np-card" :class="{ shade: n.hidden }" :style="{ '--d': Math.min(idx, 24) }" @click="go(n)" @mousemove="tilt" @mouseleave="untilt">
          <div class="np-pic">
            <img v-if="n.arts?.[0]" :src="heroPortraitUrl(n.arts[0].thumb || n.arts[0].file)" :style="{ objectPosition: `${n.arts[0].pos?.x ?? 50}% ${n.arts[0].pos?.y ?? 20}%` }" alt="" loading="lazy" />
            <span v-else class="np-ph">{{ (n.name || '?')[0] }}</span>
            <span v-if="npcLevel(n)" class="np-lvl">{{ npcLevel(n) }}</span>
            <span v-if="n.hidden" class="np-hid" title="Скрыт от игроков">☾</span>
          </div>
          <div class="np-txt">
            <small>{{ groupOf(n.group).icon }} {{ groupOf(n.group).one }}</small>
            <b>{{ n.name }}</b>
            <span class="np-sub">{{ npcSubtitle(n) || '—' }}</span>
            <span v-if="n.status?.text" class="np-st" :style="{ '--sc': n.status.color }">{{ n.status.text }}</span>
            <span v-if="n.home && placeOf(n)" class="np-home link" role="link" :title="placeOf(n).kind === 'settlement' ? 'Открыть поселение' : 'Показать на карте мира'" @click.stop="router.push(placeLink(placeOf(n)))">📍 {{ n.home }}</span>
            <span v-else-if="n.home" class="np-home">📍 {{ n.home }}</span>
          </div>
        </button>
      </TransitionGroup>
      <p v-if="!list.length && !arranging" class="np-empty">{{ visible.length ? 'Никто не подходит под фильтры.' : 'НПС пока нет.' }}</p>
    </template>

    <NpcEditor v-if="editing" :npc="editing" @close="editing = null" />
    <NpcSkillDialog v-if="skillEdit" :kind="skillEdit.kind" :entry="skillEdit.entry" @close="skillEdit = null" />
    <NpcGlossary v-if="glossary" @close="glossary = false" />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SteamLoader from '../../components/SteamLoader.vue'
import { VueDraggable } from 'vue-draggable-plus'
import NpcSheet from './NpcSheet.vue'
import NpcEditor from './NpcEditor.vue'
import NpcSkillDialog from './NpcSkillDialog.vue'
import NpcGlossary from './NpcGlossary.vue'
import { store, npcState, loadNpcs, heroPortraitUrl, act, api, toast } from '../../map/store.js'
import { NPC_GROUPS, groupOf, npcSubtitle, npcLevel, infoOf, skillIndex, findPlace, placeLink } from '../../shared/npc.js'

const route = useRoute(), router = useRouter()
const master = computed(() => store.role === 'master')

// подгружаем при открытии и каждый раз, когда на сервере поменялись НПС (npcsRev) или роль
onMounted(() => loadNpcs())
watch(() => [store.data.npcsRev, store.role], () => loadNpcs())
// место жительства → город на карте или поселение (если совпало по названию)
const placeOf = n => findPlace(n.home, store.data.cities, store.data.settlements)
const skillMap = computed(() => skillIndex(npcState.skills))

// фильтры живут в адресе — «назад» в браузере и ссылки работают как ожидаешь
const group = computed(() => route.query.g || 'all')
const setGroup = g => router.replace({ query: { ...route.query, g: g === 'all' ? undefined : g } })
const q = ref('')
const home = ref('')
const sort = ref('order')
const status = ref([])
const toggleStatus = t => { status.value = status.value.includes(t) ? status.value.filter(x => x !== t) : [...status.value, t] }

const visible = computed(() => npcState.npcs)
const count = g => visible.value.filter(n => n.group === g).length
const inGroup = computed(() => (group.value === 'all' ? visible.value : visible.value.filter(n => n.group === group.value)))
const homes = computed(() => [...new Set(inGroup.value.map(n => n.home).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru')))
const statuses = computed(() => {
  const m = new Map()
  for (const n of inGroup.value) if (n.status?.text) { const s = m.get(n.status.text) || { text: n.status.text, color: n.status.color, n: 0 }; s.n++; m.set(s.text, s) }
  return [...m.values()]
})
const hay = n => [n.name, n.home, n.status?.text, ...n.info.map(x => x.v), ...n.passives.map(x => x.name), ...n.actives.map(x => x.name)].join(' ').toLowerCase()
const gIndex = g => NPC_GROUPS.findIndex(x => x.key === g)
const list = computed(() => {
  const words = q.value.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const out = inGroup.value.filter(n => (!home.value || n.home === home.value) && (!status.value.length || status.value.includes(n.status?.text)) && words.every(w => hay(n).includes(w)))
  const lvl = n => parseFloat(infoOf(n, 'Уровень')) || 0
  const by = { order: (a, b) => gIndex(a.group) - gIndex(b.group) || (a.order || 0) - (b.order || 0), name: (a, b) => a.name.localeCompare(b.name, 'ru'), level: (a, b) => lvl(b) - lvl(a) || a.name.localeCompare(b.name, 'ru') }
  return out.sort(by[sort.value])
})

// открытый лист и соседи по текущему списку (с учётом фильтров)
const open = computed(() => (route.query.npc ? npcState.npcs.find(n => n.id === route.query.npc) || null : null))
const pos = computed(() => (open.value ? list.value.findIndex(n => n.id === open.value.id) : -1))
const nav = computed(() => (pos.value >= 0 ? list.value : [open.value].filter(Boolean)))
const prev = computed(() => (pos.value > 0 ? nav.value[pos.value - 1] : null))
const next = computed(() => (pos.value >= 0 && pos.value < nav.value.length - 1 ? nav.value[pos.value + 1] : null))
// куда уехать листу: вперёд по списку — влево, назад — вправо, из списка — всплыть
const sheetAnim = ref('np-open')
const dealKey = computed(() => [group.value, sort.value, home.value, status.value.join()].join('|'))
function go(n) {
  if (!n) return
  const from = list.value.findIndex(x => x.id === open.value?.id), to = list.value.findIndex(x => x.id === n.id)
  sheetAnim.value = from < 0 || to < 0 ? 'np-open' : to > from ? 'np-next' : 'np-prev'
  router.push({ query: { ...route.query, npc: n.id } })
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
// наклон карточки за мышью (CSS-переменные), без мыши — на место
const still = matchMedia('(prefers-reduced-motion: reduce)').matches
function tilt(e) {
  if (still) return
  const el = e.currentTarget, r = el.getBoundingClientRect()
  const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height
  el.style.setProperty('--rx', ((0.5 - y) * 10).toFixed(2) + 'deg')
  el.style.setProperty('--ry', ((x - 0.5) * 12).toFixed(2) + 'deg')
  el.style.setProperty('--mx', (x * 100).toFixed(1) + '%')
  el.style.setProperty('--my', (y * 100).toFixed(1) + '%')
}
function untilt(e) { for (const k of ['--rx', '--ry']) e.currentTarget.style.setProperty(k, '0deg') }
// режим «Расставить»: своя копия группы по текущему порядку, после броска — на сервер
const arranging = ref(false)
const arrangeList = ref([])
function toggleArrange() {
  arranging.value = !arranging.value
  if (arranging.value) arrangeList.value = npcState.npcs.filter(n => n.group === group.value).sort((a, b) => (a.order || 0) - (b.order || 0))
}
watch(group, () => { arranging.value = false })
async function saveOrder() {
  try { await api('POST', '/api/npcs-order', { ids: arrangeList.value.map(n => n.id) }) } catch (e) { toast(e.message, 'error') }
}
const close = () => router.push({ query: { ...route.query, npc: undefined } })
// стрелки ← → листают НПС, Esc — к списку (если не печатаешь и не открыт редактор)
function onKey(e) {
  if (!open.value || editing.value || skillEdit.value || glossary.value || /input|textarea|select/i.test(e.target?.tagName)) return
  if (e.key === 'ArrowLeft') go(prev.value)
  else if (e.key === 'ArrowRight') go(next.value)
  else if (e.key === 'Escape') close()
}
onMounted(() => addEventListener('keydown', onKey))
onBeforeUnmount(() => removeEventListener('keydown', onKey))

const editing = ref(null)
const skillEdit = ref(null)
const glossary = ref(false)
async function create() {
  const g = group.value === 'all' ? 'sidekick' : group.value
  try {
    const n = await act('POST', '/api/npcs', { group: g, name: 'Новый НПС' }, 'НПС создан — заполни лист')
    await loadNpcs(true)
    go(npcState.npcs.find(x => x.id === n.id))
    editing.value = npcState.npcs.find(x => x.id === n.id) || null
  } catch { /* тост */ }
}
</script>

<style scoped>
.np { font-family: 'Manrope', sans-serif; color: #e9dfc8; }
.np-load { display: grid; place-items: center; min-height: 300px; }
.np-head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-end; gap: 12px; margin-bottom: 14px; }
.np-head h2 { margin: 0; font: 700 30px 'Cormorant Garamond', serif; color: #f3dc9e; }
.np-head p { margin: 4px 0 0; color: #a8936c; font-size: 13.5px; }
.np-tools { display: flex; flex-wrap: wrap; gap: 8px; }
.np-btn.on { background: rgba(231, 197, 111, .2); border-color: #e7c56f; color: #f3dc9e; }
.np-hint { margin: 0 0 10px; color: #a8936c; font-size: 13px; }
.np-card.arr { cursor: grab; transform: none; }
.np-card.arr:active { cursor: grabbing; }
.np-card.arr .np-txt { padding: 8px 10px; }
.np-ghost { opacity: .35; outline: 2px dashed #e7c56f; outline-offset: 2px; }
.np-btn { border: 1px solid rgba(255, 255, 255, .12); background: rgba(255, 255, 255, .05); color: #ece6da; border-radius: 10px; padding: 8px 14px; font: 700 13px 'Manrope', sans-serif; cursor: pointer; }
.np-btn.primary { background: linear-gradient(180deg, #f0cf83, #c99a45); color: #1b140c; border-color: #e6c27a; }
.np-tabs { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 12px; border-bottom: 1px solid rgba(231, 197, 111, .2); }
.np-tabs button { display: flex; align-items: center; gap: 6px; padding: 8px 12px; border: 0; border-bottom: 2px solid transparent; background: none; color: #9d978b; font: 700 13.5px 'Manrope', sans-serif; cursor: pointer; }
.np-tabs button.on { color: #f3dc9e; border-color: #e7c56f; }
.np-tabs small { background: rgba(231, 197, 111, .18); color: #f3dc9e; border-radius: 99px; padding: 0 7px; font-size: 11px; }
.np-bar { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; }
.np-search { flex: 1 1 240px; min-width: 0; padding: 8px 12px; border-radius: 10px; border: 1px solid rgba(231, 197, 111, .25); background: rgba(0, 0, 0, .25); color: #efe3c8; font: 500 13.5px 'Manrope', sans-serif; }
.np-sel { padding: 8px 10px; border-radius: 10px; border: 1px solid rgba(231, 197, 111, .25); background: #15110c; color: #efe3c8; font: 600 13px 'Manrope', sans-serif; }
.np-status { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 16px; }
.np-status button { display: inline-flex; gap: 6px; align-items: center; padding: 4px 11px; border-radius: 99px; border: 1px solid color-mix(in srgb, var(--sc) 50%, transparent); background: none; color: var(--sc); font: 700 12px 'Manrope', sans-serif; cursor: pointer; }
.np-status button.on { background: color-mix(in srgb, var(--sc) 20%, transparent); border-color: var(--sc); }
.np-status small { opacity: .7; }
.np-status .clear { --sc: #a8936c; border-style: dashed; }

.np-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(210px, 100%), 1fr)); gap: 12px; }
/* наклон за мышью (--rx/--ry из скрипта) + блик там, где курсор */
.np-card { --rx: 0deg; --ry: 0deg; --lift: 0px; position: relative; display: flex; flex-direction: column; padding: 0; overflow: hidden; border-radius: 14px; border: 1px solid rgba(231, 197, 111, .2); background: linear-gradient(180deg, #221b13, #15110c); color: inherit; text-align: left; cursor: pointer;
  transform: perspective(900px) rotateX(var(--rx)) rotateY(var(--ry)) translateY(var(--lift)); transition: transform .25s ease-out, border-color .2s, box-shadow .25s; will-change: transform; }
.np-card:hover { --lift: -5px; border-color: rgba(231, 197, 111, .6); box-shadow: 0 18px 36px rgba(0, 0, 0, .5), 0 0 24px rgba(231, 197, 111, .12); }
.np-card::after { content: ""; position: absolute; inset: 0; z-index: 2; pointer-events: none; border-radius: inherit; opacity: 0; transition: opacity .3s;
  background: radial-gradient(circle at var(--mx, 50%) var(--my, 30%), rgba(255, 236, 190, .22), transparent 45%), linear-gradient(115deg, transparent 40%, rgba(255, 236, 190, .1) 50%, transparent 60%); }
.np-card:hover::after { opacity: 1; }
.np-card:hover .np-lvl { box-shadow: 0 0 14px rgba(240, 207, 131, .7); }
.np-card.shade { opacity: .6; border-style: dashed; }
.np-pic { position: relative; aspect-ratio: 3 / 4; background: radial-gradient(circle at 50% 35%, #2a2015, #120e09 75%); }
.np-pic { overflow: hidden; }
.np-pic img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .6s cubic-bezier(.2, .8, .2, 1), filter .4s; }
.np-card:hover .np-pic img { transform: scale(1.07); filter: saturate(1.12) brightness(1.05); }

/* раздача карточек: прилетают снизу с поворотом, по очереди */
.np-deal-enter-active { transition: opacity .45s ease, transform .6s cubic-bezier(.2, .9, .3, 1.15); transition-delay: calc(var(--d, 0) * 35ms); }
.np-deal-enter-from { opacity: 0; transform: translateY(28px) rotate(-4deg) scale(.92); }
.np-deal-leave-active { display: none; }
.np-deal-move { transition: transform .35s ease; }

/* листы: открытие всплывает, соседние уезжают в свою сторону */
.np-open-enter-active { transition: opacity .35s, transform .45s cubic-bezier(.2, .8, .2, 1); }
.np-open-enter-from { opacity: 0; transform: translateY(20px) scale(.985); }
.np-open-leave-active, .np-next-leave-active, .np-prev-leave-active { transition: opacity .16s, transform .2s ease-in; }
.np-open-leave-to { opacity: 0; }
.np-next-enter-active, .np-prev-enter-active { transition: opacity .3s, transform .4s cubic-bezier(.2, .8, .2, 1); }
.np-next-enter-from { opacity: 0; transform: translateX(48px); }
.np-next-leave-to { opacity: 0; transform: translateX(-48px); }
.np-prev-enter-from { opacity: 0; transform: translateX(-48px); }
.np-prev-leave-to { opacity: 0; transform: translateX(48px); }
@media (prefers-reduced-motion: reduce) {
  .np-card, .np-pic img, .np-deal-enter-active, .np-open-enter-active, .np-next-enter-active, .np-prev-enter-active { transition: none !important; }
  .np-card:hover { transform: none; }
}
.np-ph { position: absolute; inset: 0; display: grid; place-items: center; font: 700 48px 'Cormorant Garamond', serif; color: #8a6630; }
.np-lvl { position: absolute; left: 8px; bottom: 8px; min-width: 26px; padding: 2px 7px; border-radius: 99px; background: linear-gradient(180deg, #f0cf83, #c99a45); color: #1b140c; font: 800 12px 'Manrope', sans-serif; text-align: center; box-shadow: 0 2px 8px rgba(0, 0, 0, .5); }
.np-hid { position: absolute; right: 8px; top: 8px; padding: 1px 7px; border-radius: 99px; background: rgba(20, 16, 30, .8); color: #b9a6ff; font-size: 13px; }
.np-txt { display: grid; gap: 3px; padding: 10px 12px 12px; min-width: 0; }
.np-txt small { color: #c9a24f; font-weight: 800; font-size: 10.5px; text-transform: uppercase; letter-spacing: .07em; }
.np-txt b { font: 700 19px/1.15 'Cormorant Garamond', serif; color: #f3dc9e; overflow-wrap: anywhere; }
.np-sub { color: #cdbf9f; font-size: 12.5px; font-weight: 600; }
.np-st { justify-self: start; margin-top: 2px; padding: 1px 9px; border-radius: 99px; border: 1px solid var(--sc); color: var(--sc); background: color-mix(in srgb, var(--sc) 12%, transparent); font-size: 11.5px; font-weight: 800; }
.np-home { color: #a8936c; font-size: 12px; }
.np-home.link { justify-self: start; color: #e6c27a; text-decoration: underline dotted rgba(230, 194, 122, .5); text-underline-offset: 3px; cursor: pointer; }
.np-home.link:hover { color: #fff3d6; }
.np-empty { color: #a8936c; font-style: italic; }

.np-nav { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 16px; }
.np-back { border: 1px solid rgba(231, 197, 111, .35); background: rgba(231, 197, 111, .08); color: #f3dc9e; border-radius: 10px; padding: 7px 12px; font: 700 13px 'Manrope', sans-serif; cursor: pointer; }
.np-crumb { color: #a8936c; font-size: 12.5px; font-weight: 700; }
.np-step { display: flex; align-items: center; gap: 6px; max-width: 200px; border: 1px solid rgba(255, 255, 255, .12); background: rgba(255, 255, 255, .05); color: #ece6da; border-radius: 10px; padding: 7px 12px; font: 700 13px 'Manrope', sans-serif; cursor: pointer; }
.np-step span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; color: #cdbf9f; }
.np-step:disabled { opacity: .35; cursor: default; }
.grow { flex: 1; }
@media (max-width: 600px) {
  .np-step span { display: none; }
  .np-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .np-txt b { font-size: 16px; }
}
</style>
