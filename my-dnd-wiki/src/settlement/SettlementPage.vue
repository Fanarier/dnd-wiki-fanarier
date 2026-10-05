<template>
  <div class="sp">
    <header class="sp-top">
      <router-link to="/" class="sp-brand">
        <svg class="sigil" viewBox="0 0 32 32" aria-hidden="true">
          <circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" stroke-width="1.5" />
          <path d="M16 3 L19 16 L16 29 L13 16 Z" fill="currentColor" />
          <path d="M3 16 L16 13.5 L29 16 L16 18.5 Z" fill="currentColor" opacity=".55" />
        </svg>
        <span>Анкария</span>
      </router-link>
      <nav class="sp-tabs">
        <router-link to="/" class="sp-tab">Карта</router-link>
        <router-link to="/wiki" class="sp-tab">Вики</router-link>
        <router-link :to="`/settlement/${s?.id || ''}`" class="sp-tab active">Поселение</router-link>
      </nav>
      <span class="grow" />
      <UserMenu />
    </header>

    <div v-if="!store.ready" class="sp-load"><SteamLoader kind="map" /></div>
    <div v-else-if="!s" class="sp-load">Поселение не найдено</div>
    <div v-else class="sp-body">
      <div class="sp-mapwrap">
        <SettlementMap class="sp-map" :settlement="s" :calc="calc" :selected="sel" :tool="tool" :ghosts="ghosts"
                       @select="sel = $event" @moved="onMoved" @placed="onPlaced" @explore="onExplore" @fog="onFog" />
        <!-- инструменты: мастеру — правка карты, главе — приказы -->
        <div v-if="master || decider" class="sp-tools">
          <button :class="{ on: !tool }" title="Смотреть и выбирать" @click="tool = null">👁 Смотреть</button>
          <template v-if="master">
            <button :class="{ on: tool === 'move' }" title="Перетаскивай постройки и аванпосты" @click="tool = 'move'">✥ Двигать</button>
            <button :class="{ on: tool?.place }" @click="palette = !palette">＋ Поставить</button>
            <button :class="{ on: tool === 'fog-add' }" title="Кистью открыть землю" @click="tool = 'fog-add'">☀ Разведать</button>
            <button :class="{ on: tool === 'fog-erase' }" title="Кистью вернуть туман" @click="tool = 'fog-erase'">☁ Скрыть</button>
            <button class="day" @click="dayOpen = !dayOpen">⏳ Прошёл день</button>
          </template>
          <template v-else>
            <button :class="{ on: tool?.place }" @click="palette = !palette">⚒ Приказ: построить</button>
            <button :class="{ on: tool?.explore }" @click="tool = { explore: true }">🧭 Приказ: разведать</button>
          </template>
        </div>
        <div v-if="tool && hint" class="sp-hint">{{ hint }}</div>
        <!-- палитра построек -->
        <div v-if="palette" class="sp-pop palette">
          <div class="pop-head"><b>{{ master ? 'Поставить постройку' : 'Что построить?' }}</b><button @click="palette = false">×</button></div>
          <label v-if="master" class="chk"><input v-model="placeBuilt" type="checkbox" /> сразу построена (иначе — стройка)</label>
          <div v-for="(list, cat) in paletteGroups" :key="cat" class="pal-group">
            <small>{{ CATEGORIES[cat]?.label }}</small>
            <button v-for="b in list" :key="b.type" class="pal-item" :class="{ on: tool?.place === b.type }" @click="startPlace(b.type)">
              <img :src="`/settlement/${b.icon}.png`" alt="" /><span>{{ b.label }}</span><em>{{ SIZES[b.size]?.label }} · {{ b.cost }}</em>
            </button>
          </div>
        </div>
        <!-- «прошёл день» -->
        <div v-if="dayOpen" class="sp-pop day">
          <div class="pop-head"><b>Сколько прошло?</b><button @click="dayOpen = false">×</button></div>
          <p>Запасы изменятся на итог за эти дни, нехватки попадут в журнал, стройка продвинется.<template v-if="s.day"> Сейчас день {{ s.day }}.</template></p>
          <div class="day-row">
            <button @click="advance(1)">1 день</button><button @click="advance(7)">Неделя</button>
            <input v-model.number="customDays" type="number" min="1" max="60" /><button @click="advance(customDays)">дней</button>
          </div>
        </div>
      </div>

      <aside class="sp-panel">
        <!-- шапка поселения -->
        <section class="sp-head">
          <div class="sp-title">
            <img class="sp-crest" src="/settlement/medieval-village-01.png" alt="" />
            <div>
              <h1>{{ s.name }}</h1>
              <div class="sp-sub">{{ s.kind }} · <span class="sp-status">{{ s.status }}</span>
                <router-link v-if="city" class="sp-onmap" :to="{ path: '/', query: { focus: 'cities:' + city.id } }">на карте мира</router-link>
              </div>
            </div>
          </div>
          <div class="sp-quick">
            <div><b>{{ calc.population }}</b><small>жителей</small></div>
            <div><b>{{ calc.morale }}</b><small>мораль</small></div>
            <div><b>{{ calc.stability }}</b><small>стабильность</small></div>
            <div :class="{ warn: calc.threat > 0 }"><b>{{ calc.threat }}</b><small>угрозы</small></div>
          </div>
        </section>

        <!-- выбранная на карте постройка или аванпост -->
        <BuildingCard v-if="selItem" :settlement="s" :calc="calc" :sel="sel" :item="selItem" :master="master" @close="sel = null" @save="saveItem" @remove="removeItem" />

        <nav class="sp-tabbar">
          <button v-for="tb in TABS" :key="tb.id" :class="{ on: tab === tb.id }" @click="setTab(tb.id)">
            {{ tb.label }}<i v-if="tb.dot" class="dot" />
          </button>
        </nav>
        <SettlementTabs :tab="tab" :settlement="s" :calc="calc" :master="master" :decider="decider" @pick="sel = $event" @edit="editing = $event" />
        <p class="sp-credit">Значки: game-icons.net (CC BY 3.0)</p>
      </aside>
    </div>
    <SettlementEditor v-if="editing && s" :section="editing" :settlement="s" @close="editing = null" />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import UserMenu from '../components/UserMenu.vue'
import SteamLoader from '../components/SteamLoader.vue'
import SettlementMap from './SettlementMap.vue'
import SettlementTabs from './SettlementTabs.vue'
import BuildingCard from './BuildingCard.vue'
import SettlementEditor from './SettlementEditor.vue'
import { store, isMaster, act } from '../map/store.js'
import { computeSettlement, BUILDINGS, CATEGORIES, SIZES } from '../shared/settlement.js'

const route = useRoute()
const router = useRouter()
const s = computed(() => {
  const list = store.data.settlements || []
  return list.find(x => x.id === route.params.id) || (!route.params.id ? list[0] : null)
})
const calc = computed(() => computeSettlement(s.value || {}))
const city = computed(() => s.value?.cityId && store.data.cities?.find(c => c.id === s.value.cityId))
watch(s, v => { if (v) document.title = `${v.name} — Анкария` }, { immediate: true })

const master = isMaster
// решать могут выбранные мастером игроки
const decider = computed(() => !!store.me && store.me.role === 'player' && !!s.value?.deciders?.includes(store.me.id))
const editing = ref(null)

/* ---------- инструменты карты ---------- */
const tool = ref(null)
const palette = ref(false)
const placeBuilt = ref(true)
const dayOpen = ref(false)
const customDays = ref(3)
const paletteGroups = computed(() => {
  const out = {}
  for (const [type, b] of Object.entries(BUILDINGS)) {
    if (b.personal && !master.value) continue
    ;(out[b.cat] ||= []).push({ type, ...b })
  }
  return out
})
function startPlace(type) {
  tool.value = { place: type }
  palette.value = false
}
const hint = computed(() => {
  const t = tool.value
  if (t === 'move') return 'Тяни постройку или аванпост. Красным — сюда нельзя.'
  if (t?.place) return `Кликни по разведанной земле, куда поставить «${BUILDINGS[t.place]?.label}». Esc — отмена.`
  if (t?.explore) return 'Кликни, какой участок разведать — мастер получит приказ.'
  if (t === 'fog-add') return 'Води кистью — земля станет разведанной.'
  if (t === 'fog-erase') return 'Води кистью — вернёт туман на кружки разведки.'
  return ''
})
// приказы на рассмотрении — призраки на карте
const ghosts = computed(() => (s.value?.orders || []).filter(o => o.status === 'pending' && (o.build || o.explore)).map(o => (o.build
  ? { id: o.id, type: o.build.type, x: o.build.x, y: o.build.y, side: SIZES[BUILDINGS[o.build.type]?.size]?.side || 56 }
  : { id: o.id, explore: true, x: o.explore.x, y: o.explore.y, r: o.explore.r })))

const patch = (body, ok) => act('PATCH', `/api/settlements/${s.value.id}`, body, ok)
function onMoved({ id, x, y }) {
  if (s.value.buildings.some(b => b.id === id)) patch({ buildings: s.value.buildings.map(b => (b.id === id ? { ...b, x, y } : b)) })
  else if (s.value.outposts.some(o => o.id === id)) patch({ outposts: s.value.outposts.map(o => (o.id === id ? { ...o, x, y } : o)) })
}
async function onPlaced({ type, x, y }) {
  if (master.value) {
    const settle = BUILDINGS[type].size === 'settlement'
    const b = { id: 'b' + Date.now().toString(36), type, x: settle ? 0 : x, y: settle ? 0 : y, state: placeBuilt.value ? 'built' : 'construction', ...(placeBuilt.value ? {} : { progress: 0 }) }
    await patch({ buildings: [...s.value.buildings, b] }, `«${BUILDINGS[type].label}» ${placeBuilt.value ? 'поставлена' : 'заложена'}`)
    sel.value = { kind: 'building', id: b.id }
  } else {
    const text = prompt(`Приказ: построить «${BUILDINGS[type].label}». Комментарий для мастера (необязательно):`, '')
    if (text === null) return
    await act('POST', `/api/settlements/${s.value.id}/orders`, { kind: 'build', type, x, y, text }, 'Приказ отправлен мастеру')
    tool.value = null
  }
}
async function onExplore({ x, y }) {
  const text = prompt('Приказ: разведать этот участок. Комментарий для мастера (необязательно):', '')
  if (text === null) return
  await act('POST', `/api/settlements/${s.value.id}/orders`, { kind: 'explore', x, y, text }, 'Приказ отправлен мастеру')
  tool.value = null
}
function onFog({ erase, points, r }) {
  const ex = s.value.explored || []
  const next = erase
    ? ex.filter(e => !e.r || !points.some(p => Math.hypot(p.x - e.x, p.y - e.y) < r + e.r * 0.5))
    : [...ex, ...points.map(p => ({ x: p.x, y: p.y, r }))]
  patch({ explored: next })
}
async function advance(days) {
  const r = await act('POST', `/api/settlements/${s.value.id}/advance`, { days }, `Прошло дней: ${days}`)
  dayOpen.value = false
  if (r?.short?.length) setTab('journal')
}
function saveItem(kind, item) {
  if (kind === 'building') patch({ buildings: s.value.buildings.map(b => (b.id === item.id ? item : b)) }, 'Сохранено')
  else patch({ outposts: s.value.outposts.map(o => (o.id === item.id ? item : o)) }, 'Сохранено')
}
function removeItem(kind, id) {
  if (!confirm('Убрать с карты?')) return
  if (kind === 'building') patch({ buildings: s.value.buildings.filter(b => b.id !== id) }, 'Убрано')
  else patch({ outposts: s.value.outposts.filter(o => o.id !== id) }, 'Убрано')
  sel.value = null
}
onKey()
function onKey() {
  const h = e => { if (e.key === 'Escape') { tool.value = null; palette.value = false; dayOpen.value = false } }
  window.addEventListener('keydown', h)
  onBeforeUnmount(() => window.removeEventListener('keydown', h))
}

const sel = ref(null)
const selItem = computed(() => {
  if (!sel.value || !s.value) return null
  const list = sel.value.kind === 'outpost' ? s.value.outposts : s.value.buildings
  return list?.find(x => x.id === sel.value.id) || null
})

const tab = ref(route.query.tab || 'overview')
const TABS = computed(() => [
  { id: 'overview', label: 'Обзор' },
  { id: 'resources', label: 'Ресурсы', dot: Object.values(calc.value.balance).some(v => v < 0) },
  { id: 'residents', label: 'Жители' },
  { id: 'jobs', label: 'Работы' },
  { id: 'assets', label: 'Активы' },
  { id: 'outposts', label: 'Аванпосты' },
  { id: 'orders', label: 'Приказы', dot: master.value && (s.value?.orders || []).some(o => o.status === 'pending') },
  { id: 'journal', label: 'Журнал', dot: (s.value?.events || []).some(e => e.duration?.includes('decide') && !e.decision) }
])
function setTab(id) {
  tab.value = id
  router.replace({ query: { ...route.query, tab: id === 'overview' ? undefined : id } })
}
</script>

<style scoped>
.sp { min-height: 100vh; background: radial-gradient(1200px 600px at 20% -10%, #1b2333 0%, var(--a-bg) 60%) fixed; color: var(--a-text); font-family: var(--a-sans); }
.sp-top { position: sticky; top: 0; z-index: 20; display: flex; align-items: center; gap: 18px; height: 64px; padding: 0 22px; background: rgba(13, 16, 23, .9); backdrop-filter: blur(12px); border-bottom: 1px solid var(--a-line); }
.sp-brand { display: flex; align-items: center; gap: 10px; color: var(--a-gold-2); text-decoration: none; font: 700 24px var(--a-serif); }
.sigil { width: 28px; height: 28px; color: var(--a-gold); }
.sp-tabs { display: flex; gap: 4px; padding: 3px; border-radius: 11px; background: rgba(255, 255, 255, .04); border: 1px solid rgba(255, 255, 255, .06); }
.sp-tab { padding: 6px 14px; border-radius: 8px; color: var(--a-muted); text-decoration: none; font-weight: 700; font-size: 13px; }
.sp-tab:hover { color: var(--a-text); }
.sp-tab.active { background: rgba(231, 197, 111, .16); color: var(--a-gold-2); }
.grow { flex: 1; }
.sp-load { display: grid; place-items: center; min-height: 70vh; color: var(--a-muted); }

.sp-body { display: grid; grid-template-columns: minmax(0, 1fr) 460px; height: calc(100vh - 64px); }
.sp-mapwrap { position: relative; min-height: 0; }
.sp-map { height: 100%; border-right: 1px solid var(--a-line); }
.sp-tools { position: absolute; top: 12px; left: 12px; display: flex; flex-wrap: wrap; gap: 4px; max-width: calc(100% - 24px); padding: 4px; border-radius: 12px; background: rgba(13, 16, 23, .88); border: 1px solid var(--a-line); backdrop-filter: blur(6px); }
.sp-tools button { padding: 6px 10px; border-radius: 9px; border: 1px solid transparent; background: none; color: var(--a-muted); font: 700 12.5px var(--a-sans); cursor: pointer; white-space: nowrap; }
.sp-tools button:hover { color: var(--a-text); background: rgba(255, 255, 255, .05); }
.sp-tools button.on { background: rgba(231, 197, 111, .16); border-color: rgba(231, 197, 111, .4); color: var(--a-gold-2); }
.sp-tools .day { color: #9fd0ff; }
.sp-hint { position: absolute; top: 62px; left: 12px; padding: 6px 10px; border-radius: 9px; background: rgba(23, 19, 14, .9); border: 1px solid #8a6630; color: #e6d6b0; font: 600 12px var(--a-sans); pointer-events: none; }
.sp-pop { position: absolute; z-index: 6; top: 62px; left: 12px; width: 330px; max-height: calc(100% - 80px); overflow-y: auto; padding: 10px 12px; border-radius: 14px; background: rgba(20, 17, 12, .97); border: 1px solid #8a6630; box-shadow: 0 16px 40px rgba(0, 0, 0, .6); color: var(--a-text); font-size: 12.5px; }
.sp-pop.day { width: 300px; }
.pop-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.pop-head b { font: 700 18px var(--a-serif); color: var(--a-gold-2); }
.pop-head button { border: 0; background: none; color: var(--a-muted); font-size: 22px; cursor: pointer; }
.chk { display: flex; gap: 6px; align-items: center; margin-bottom: 6px; color: #d9cdb0; }
.pal-group small { display: block; margin: 8px 0 3px; color: var(--a-muted); font-weight: 800; font-size: 10.5px; letter-spacing: .06em; text-transform: uppercase; }
.pal-item { display: grid; grid-template-columns: 24px 1fr auto; align-items: center; gap: 8px; width: 100%; padding: 4px 6px; border-radius: 8px; border: 1px solid transparent; background: none; color: var(--a-text); font: 600 12.5px var(--a-sans); text-align: left; cursor: pointer; }
.pal-item:hover, .pal-item.on { background: rgba(231, 197, 111, .1); border-color: var(--a-line); }
.pal-item img { width: 24px; height: 24px; padding: 2px; border-radius: 5px; background: #d6d2c8; }
.pal-item em { font-style: normal; color: var(--a-muted); font-size: 11px; }
.sp-pop p { color: #b9ab8a; line-height: 1.45; margin: 0 0 8px; }
.day-row { display: flex; gap: 5px; }
.day-row button { padding: 6px 9px; border-radius: 8px; border: 1px solid var(--a-line); background: rgba(231, 197, 111, .1); color: var(--a-gold-2); font: 700 12px var(--a-sans); cursor: pointer; }
.day-row input { width: 52px; padding: 4px 6px; border-radius: 8px; border: 1px solid var(--a-line-2); background: rgba(0, 0, 0, .3); color: var(--a-text); }
.sp-panel { overflow-y: auto; padding: 18px 18px 30px; scrollbar-width: thin; }

.sp-head { padding: 14px 16px; border-radius: 16px; background: linear-gradient(170deg, #241c13, #16110c); border: 1px solid #6e4f22; box-shadow: 0 0 0 3px #1a140e, 0 0 0 4px rgba(201, 162, 79, .3); }
.sp-title { display: flex; align-items: center; gap: 12px; }
.sp-crest { width: 52px; height: 52px; padding: 6px; border-radius: 14px; background: #d6d2c8; border: 2px solid #b06cff; }
.sp-title h1 { margin: 0; font: 700 32px/1 var(--a-serif); color: var(--a-gold-2); }
.sp-sub { margin-top: 4px; color: #b9ab8a; font-size: 13px; font-weight: 600; }
.sp-status { color: #9be07a; }
.sp-onmap { margin-left: 8px; color: var(--a-gold); font-size: 12px; }
.sp-quick { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-top: 12px; }
.sp-quick div { display: grid; justify-items: center; padding: 7px 4px; border-radius: 10px; background: rgba(0, 0, 0, .25); border: 1px solid rgba(201, 162, 79, .18); }
.sp-quick b { font: 700 22px/1.1 var(--a-serif); color: #f3d99a; }
.sp-quick small { font-size: 11px; color: #a8936c; font-weight: 700; }
.sp-quick .warn b { color: #ffb36b; }

.sp-tabbar { position: sticky; top: -18px; z-index: 5; display: flex; flex-wrap: wrap; gap: 4px; margin: 14px -18px 12px; padding: 10px 18px 8px; background: rgba(13, 16, 23, .94); backdrop-filter: blur(8px); border-bottom: 1px solid var(--a-line); }
.sp-tabbar button { position: relative; padding: 6px 11px; border-radius: 9px; border: 1px solid transparent; background: none; color: var(--a-muted); font: 700 13px var(--a-sans); cursor: pointer; }
.sp-tabbar button:hover { color: var(--a-text); }
.sp-tabbar button.on { background: rgba(231, 197, 111, .14); border-color: rgba(231, 197, 111, .35); color: var(--a-gold-2); }
.dot { position: absolute; top: 3px; right: 3px; width: 7px; height: 7px; border-radius: 50%; background: #ff6b5b; }
.sp-credit { margin-top: 24px; color: #6d675b; font-size: 11px; text-align: center; }

@media (max-width: 900px) {
  .sp-top { gap: 10px; padding: 0 12px; }
  .sp-brand span { display: none; }
  .sp-body { grid-template-columns: 1fr; height: auto; }
  .sp-map { height: 58vh; border-right: 0; border-bottom: 1px solid var(--a-line); }
  .sp-pop { width: calc(100% - 24px); top: 98px; max-height: calc(100% - 110px); }
  .sp-hint { top: 98px; right: 12px; }
  .sp-panel { overflow: visible; padding: 14px 12px 30px; }
  .sp-tabbar { top: 64px; margin: 14px -12px 12px; padding: 10px 12px 8px; }
}
</style>
