<template>
  <div class="hp">
    <header class="hp-head">
      <h2>
        <span class="gears" aria-hidden="true"><svg class="g1" viewBox="0 0 24 24"><path :d="COG" fill="currentColor" /></svg><svg class="g2" viewBox="0 0 24 24"><path :d="COG" fill="currentColor" /></svg></span>
        Герои Анкарии
      </h2>
      <div class="subtitle-1">Досье на всех, кто идёт по дорогам Анкарии. Карточку персонажа можно перевернуть — там расходы и отношения.</div>
    </header>

    <nav class="hp-tabs">
      <button v-for="t in TABS" :key="t.id" :class="{ on: tab === t.id }" @click="setTab(t.id)">
        {{ t.label }}<span v-if="t.count !== undefined" class="n">{{ t.count }}</span><i v-if="t.dot" class="dot" />
      </button>
    </nav>

    <ArtsGallery v-if="tab === 'arts'" />

    <template v-else>
      <div class="hp-bar">
        <template v-if="tab === 'character'">
          <button class="chip" :class="{ on: !fGroup }" @click="fGroup = ''">Все</button>
          <button v-for="g in groups" :key="g" class="chip" :class="{ on: fGroup === g }" @click="fGroup = g">
            <i class="cdot" :style="{ background: groupColor(g === NO_GROUP ? '' : g) }" />{{ g }}
          </button>
        </template>
        <span class="grow" />
        <button v-if="hasMine && tab === 'character'" class="chip" :class="{ on: onlyMine }" @click="onlyMine = !onlyMine">✦ Только мои</button>
        <button v-if="master && canAdd" class="hp-btn primary" @click="create(tab)">+ {{ HERO_KINDS[tab].label }}</button>
      </div>

      <div v-if="!store.ready" class="hp-load"><SteamLoader kind="board" /></div>
      <div v-else class="hp-grid">
        <HeroCard v-for="(h, i) in list" :key="h.id" :hero="h" :delay="i * 70" :can-edit="canEdit(h)" :pulse="pulseId === h.id"
                  @edit="edit" @focus="focusHero" />
        <!-- пустые слоты сайд-киков (их всего четыре) -->
        <div v-for="n in emptySlots" :key="'slot' + n" class="empty-slot" :class="{ short: tab !== 'character' }" :style="{ animationDelay: (list.length + n) * 70 + 'ms' }">
          <svg class="eg" viewBox="0 0 24 24"><path :d="COG" fill="currentColor" /></svg>
          <b>{{ tab === 'sidekick' ? 'Слот сайд-кика' : tab === 'companion' ? 'Слот компаньона' : 'Новый персонаж' }}</b>
          <p v-if="tab === 'sidekick'">свободен</p>
          <button v-if="master" class="hp-btn" @click="create(tab)">+ Заполнить</button>
        </div>
        <div v-if="!list.length && !emptySlots" class="hp-empty">{{ onlyMine ? 'Твоих карточек тут нет.' : 'Пока никого.' }}</div>
      </div>
    </template>

    <HeroEditor v-if="editing" :hero="editing" :master="master" :busy="saving" @close="editing = null" @save="save" @delete="remove" />
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { mdiCog } from '@mdi/js'
import HeroCard from './HeroCard.vue'
import HeroEditor from './HeroEditor.vue'
import ArtsGallery from './ArtsGallery.vue'
import SteamLoader from '../components/SteamLoader.vue'
import { store, isMaster, init, api, act, toast, uploadHeroArt, unseenArts } from '../map/store.js'
import { HERO_KINDS, MAX_SIDEKICKS, groupColor, isNoGroup } from '../shared/catalog.js'

const COG = mdiCog
const NO_GROUP = 'Без группы'
const route = useRoute()
const router = useRouter()
const master = isMaster
onMounted(init)

const TAB_KEY = 'anacaria-heroes-tab'
let saved = null
try { saved = localStorage.getItem(TAB_KEY) } catch { /* приватный режим */ }
const tab = ref(['character', 'sidekick', 'companion', 'arts'].includes(saved) ? saved : 'character')
function setTab(t) {
  tab.value = t
  try { localStorage.setItem(TAB_KEY, t) } catch { /* приватный режим */ }
}

const heroes = computed(() => store.data.heroes || [])
const byKind = k => heroes.value.filter(h => h.kind === k).sort((a, b) => (a.order || 0) - (b.order || 0) || a.createdAt - b.createdAt)
const TABS = computed(() => [
  { id: 'character', label: 'Персонажи', count: byKind('character').length },
  { id: 'sidekick', label: 'Сайд-кики', count: `${byKind('sidekick').length} / ${MAX_SIDEKICKS}` },
  { id: 'companion', label: 'Компаньоны', count: byKind('companion').length },
  { id: 'arts', label: 'Новые арты', count: (store.data.arts || []).length || undefined, dot: unseenArts.value > 0 }
])

const fGroup = ref('')
const onlyMine = ref(false)
const groupOf = h => (isNoGroup(h.group) ? NO_GROUP : h.group.trim())
const groups = computed(() => {
  const set = [...new Set(byKind('character').map(groupOf))]
  return set.sort((a, b) => (a === NO_GROUP) - (b === NO_GROUP) || a.localeCompare(b, 'ru'))
})
const isMine = h => !!store.me && h.ownerId === store.me.id
const hasMine = computed(() => heroes.value.some(isMine))
const list = computed(() => {
  let l = byKind(tab.value)
  if (tab.value === 'character') {
    if (fGroup.value) l = l.filter(h => groupOf(h) === fGroup.value)
    if (onlyMine.value) l = l.filter(isMine)
  }
  return l
})
const canAdd = computed(() => tab.value !== 'sidekick' || byKind('sidekick').length < MAX_SIDEKICKS)
const emptySlots = computed(() => {
  if (tab.value === 'sidekick') return Math.max(0, MAX_SIDEKICKS - byKind('sidekick').length)
  return master.value && !fGroup.value && !onlyMine.value ? 1 : 0
})
const canEdit = h => master.value || (isMine(h) && h.kind === 'character' && h.canEdit)

/* ---------- правка ---------- */
const editing = ref(null)
const saving = ref(false)
const edit = h => { editing.value = h }
const create = kind => { editing.value = { kind, group: kind === 'character' ? '' : 'Нет' } }

// сначала карточка, потом арты (новые грузим по одному), в конце — порядок и видимая область каждого
async function save({ id, body, gallery, removed }) {
  saving.value = true
  let heroId = id
  try {
    if (!heroId) heroId = (await api('POST', '/api/heroes', body)).id
    for (const gid of removed) await api('DELETE', `/api/heroes/${heroId}/gallery/${gid}`).catch(() => {})
    const fresh = gallery.filter(g => !g.id)
    for (const [n, g] of fresh.entries()) {
      if (fresh.length > 1) toast(`Загружаю арты: ${n + 1} из ${fresh.length}…`)
      g.id = (await uploadHeroArt(heroId, g.fileObj)).id
    }
    const order = gallery.map(g => ({ id: g.id, pos: g.pos }))
    const h = await api('PATCH', `/api/heroes/${heroId}`, id ? { ...body, gallery: order } : { gallery: order })
    toast(id ? 'Карточка обновлена' : 'Карточка создана')
    editing.value = null
    if (!id && h.kind !== tab.value) setTab(h.kind)
  } catch (e) {
    toast(e.message, 'error')
    // карточка уже создана, не загрузился арт — закрываем, чтобы повторное «Сохранить» не создало дубль
    if (!id && heroId) { editing.value = null; toast('Карточка создана, но не все арты загрузились — открой её и добавь снова', 'error') }
  } finally {
    saving.value = false
  }
}
async function remove(h) {
  if (!confirm(`Удалить карточку «${h.name}»? Это нельзя отменить.`)) return
  await act('DELETE', `/api/heroes/${h.id}`, undefined, 'Карточка удалена').catch(() => {})
  editing.value = null
}

/* ---------- переход к карточке (отношения, хозяин компаньона, ссылки из уведомлений) ---------- */
const pulseId = ref(null)
async function focusHero(id) {
  const h = heroes.value.find(x => x.id === id)
  if (!h) return toast('Эта карточка скрыта или удалена')
  fGroup.value = ''
  onlyMine.value = false
  setTab(h.kind)
  await nextTick()
  document.getElementById('hero-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  pulseId.value = null
  await nextTick()
  pulseId.value = id
  setTimeout(() => { if (pulseId.value === id) pulseId.value = null }, 3000)
}

// /wiki?hero=ID и /wiki?heroes=arts
watch(() => [route.query.hero, route.query.heroes, store.ready], () => {
  const { hero, heroes: t } = route.query
  if ((!hero && !t) || !store.ready) return
  if (t && ['character', 'sidekick', 'companion', 'arts'].includes(t)) setTab(t)
  if (hero) setTimeout(() => focusHero(String(hero)), 300)
  router.replace({ query: {} })
}, { immediate: true })
</script>

<style scoped>
.hp { font-family: 'Manrope', sans-serif; }
.hp-head { margin-bottom: 14px; }
.hp-head h2 { display: flex; align-items: center; gap: 10px; }
.gears { position: relative; width: 44px; height: 36px; flex: none; color: #b8893f; }
.gears svg { position: absolute; }
.g1 { width: 30px; height: 30px; left: 0; top: 0; animation: spin 14s linear infinite; }
.g2 { width: 20px; height: 20px; left: 24px; top: 16px; animation: spin 9s linear infinite reverse; color: #e6c27a; }
.hp-tabs { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 16px; border-bottom: 1px solid rgba(231, 197, 111, .2); }
.hp-tabs button { position: relative; display: flex; align-items: center; gap: 6px; padding: 8px 14px; border: 0; border-bottom: 2px solid transparent; background: none; color: #9d978b; font: 700 14px 'Manrope', sans-serif; cursor: pointer; }
.hp-tabs button.on { color: #f3dc9e; border-color: #e7c56f; }
.hp-tabs .n { background: rgba(231, 197, 111, .18); color: #f3dc9e; border-radius: 99px; padding: 0 7px; font-size: 11px; }
.hp-tabs .dot { width: 8px; height: 8px; border-radius: 50%; background: #e0281e; box-shadow: 0 0 8px #e0281e; animation: blink 1.6s ease-in-out infinite; }
.hp-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 22px; }
.grow { flex: 1; }
.chip { display: inline-flex; align-items: center; gap: 6px; border: 1px solid rgba(231, 197, 111, .3); background: rgba(231, 197, 111, .06); color: #efe3c8; border-radius: 99px; padding: 5px 12px; font: 700 12px 'Manrope', sans-serif; cursor: pointer; }
.chip.on { background: #e6c27a; color: #1e150a; }
.cdot { width: 8px; height: 8px; border-radius: 50%; }
.hp-btn { border: 1px solid rgba(255, 255, 255, .12); background: rgba(255, 255, 255, .05); color: #ece6da; border-radius: 10px; padding: 8px 14px; font: 700 13px 'Manrope', sans-serif; cursor: pointer; }
.hp-btn.primary { background: linear-gradient(180deg, #f0d083, #c9a24f); color: #1b1408; border: 0; }
.hp-load { display: grid; place-items: center; min-height: 40vh; }
.hp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(268px, 1fr)); gap: 26px; }
.empty-slot { height: 548px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; text-align: center; border-radius: 18px; border: 2px dashed rgba(201, 162, 79, .35); background: repeating-linear-gradient(45deg, rgba(201, 162, 79, .04) 0 10px, transparent 10px 20px), #14110c; color: #a8936c; animation: deal .7s cubic-bezier(.2, .9, .3, 1.2) both; }
.empty-slot.short { height: 468px; }
.empty-slot b { font: 700 22px 'Cormorant Garamond', Georgia, serif; }
.empty-slot p { margin: 0; font-size: 12px; color: #7d6c4e; }
.eg { width: 64px; height: 64px; color: rgba(201, 162, 79, .35); animation: spin 18s linear infinite; }
.hp-empty { grid-column: 1 / -1; padding: 40px; text-align: center; color: #9d978b; border: 1px dashed rgba(255, 255, 255, .12); border-radius: 14px; }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes blink { 50% { opacity: .35; } }
@keyframes deal { from { opacity: 0; transform: translateY(60px) rotate(-6deg) scale(.9); } }
@media (max-width: 600px) { .hp-grid { grid-template-columns: 1fr; } }
@media (prefers-reduced-motion: reduce) { .g1, .g2, .eg, .empty-slot { animation: none; } }
</style>
