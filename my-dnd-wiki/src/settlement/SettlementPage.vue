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

    <!-- загрузка: топор рубит дерево, пока не готовы данные и местность -->
    <AxeLoader v-if="loaderShown" :ready="!loading" :title="s?.name || 'Поселение'" @gone="loaderShown = false" />
    <div v-if="!store.ready" class="sp-load" />
    <div v-else-if="!s" class="sp-load">Поселение не найдено</div>
    <div v-else class="sp-body" :class="{ wide }">
      <div class="sp-mapwrap">
        <SettlementMap ref="mapRef" class="sp-map" :settlement="s" :calc="calc" :selected="sel" :tool="tool" :ghosts="ghosts" :brush="brush" :master="master"
                       @ready="mapReady = true" @select="sel = $event" @moved="onMoved" @placed="onPlaced" @explore="onExplore" @fog="onFog"
                       @cut="onCut" @fell="onFell" @road="onRoad" @road-edit="onRoadEdit" @wall="onWall" @wall-feature="onWallFeature" @need-gate="onNeedGate" />
        <!-- инструменты: мастеру — правка карты, главе — приказы -->
        <div v-if="master || decider" class="sp-tools">
          <button :class="{ on: !tool }" title="Смотреть и выбирать" @click="setTool(null)">👁 Смотреть</button>
          <template v-if="master">
            <button :class="{ on: tool === 'move' }" title="Перетаскивай постройки и аванпосты" @click="setTool('move')">✥ Двигать</button>
            <button :class="{ on: tool?.place || tool?.placeExisting }" @click="openPop('palette')">＋ Поставить<em v-if="unplaced.length" class="cnt">{{ unplaced.length }}</em></button>
            <button :class="{ on: tool?.road }" @click="openPop('roads')">🛣 Дорога</button>
            <button :class="{ on: tool?.wall || tool?.wallFeature }" @click="openPop('walls')">🧱 Стены</button>
            <button :class="{ on: tool === 'cut' || tool === 'grow' }" @click="openPop('forest')">🪓 Лес</button>
            <button :class="{ on: tool === 'fog-add' || tool === 'fog-erase' }" @click="openPop('fog')">☀ Туман</button>
            <button :class="{ on: pop === 'terrain' }" title="Генератор местности" @click="openPop('terrain')">🗺 Местность</button>
            <button class="day" @click="openPop('day')">⏳ Прошёл день</button>
          </template>
          <template v-else>
            <button :class="{ on: tool?.place }" @click="openPop('palette')">⚒ Приказ: построить</button>
            <button :class="{ on: tool?.explore }" @click="setTool({ explore: true })">🧭 Приказ: разведать</button>
          </template>
        </div>
        <div v-if="tool && hint" class="sp-hint">
          <span>{{ hint }}</span>
          <label v-if="brushTool" class="brush">кисть {{ brushLabel }}<input v-model.number="brush" type="range" :min="brushRange[0]" :max="brushRange[1]" :step="brushRange[2]" /></label>
          <button v-if="tool?.road || tool?.wall" class="mini" @click="mapRef?.finishRoad()">Готово</button>
        </div>
        <!-- палитра построек: сначала «не расставлены» -->
        <div v-if="pop === 'palette'" class="sp-pop palette">
          <div class="pop-head"><b>{{ master ? 'Поставить постройку' : 'Что построить?' }}</b><button @click="pop = null">×</button></div>
          <template v-if="master && unplaced.length">
            <small class="pal-sub">Не расставлены — {{ unplaced.length }} <span>считаются, но на карте их нет</span></small>
            <button v-for="b in unplaced" :key="b.id" class="pal-item" :class="{ on: tool?.placeExisting === b.id }" @click="startPlaceExisting(b)">
              <img :src="`/settlement/${BUILDINGS[b.type].icon}.png`" alt="" />
              <span>{{ b.name || BUILDINGS[b.type].label }}</span>
              <em>{{ SIZES[BUILDINGS[b.type].size]?.area }}{{ b.state === 'construction' ? ' · стройка' : '' }}</em>
            </button>
            <small class="pal-sub">Новая постройка</small>
          </template>
          <label v-if="master" class="chk"><input v-model="placeBuilt" type="checkbox" /> сразу построена (иначе — стройка)</label>
          <label v-if="master && !placeBuilt" class="chk"><input v-model="payBuild" type="checkbox" /> оплатить стройку со склада</label>
          <p v-else-if="!master" class="pal-note">Цена уйдёт со склада, когда мастер одобрит приказ. Красным — чего сейчас не хватает.</p>
          <div v-for="(list, cat) in paletteGroups" :key="cat" class="pal-group">
            <small>{{ CATEGORIES[cat]?.label }}</small>
            <button v-for="b in list" :key="b.type" class="pal-item" :class="{ on: tool?.place === b.type }" @click="startPlace(b.type)">
              <img :src="`/settlement/${b.icon}.png`" alt="" />
              <span>{{ b.label }}</span>
              <em>{{ SIZES[b.size]?.label }}{{ SIZES[b.size]?.area ? ' · ' + SIZES[b.size].area : '' }}</em>
              <PriceChips v-if="!b.personal && (!master || !placeBuilt)" class="pal-price" :price="b.price" :stock="s.stock || {}" short />
            </button>
          </div>
        </div>
        <!-- дороги -->
        <div v-if="pop === 'roads'" class="sp-pop small">
          <div class="pop-head"><b>Какую дорогу?</b><button @click="pop = null">×</button></div>
          <button v-for="(r, k) in ROAD_TYPES" :key="k" class="pal-item road" :class="{ on: tool?.road === k }" @click="setTool({ road: k })">
            <i class="rd" :class="k" /><span>{{ r.label }}</span><em>{{ String(r.w).replace('.', ',') }} м</em>
          </button>
          <p class="pal-note">Готовую дорогу можно выбрать на карте: тянуть точки, добавлять (за середину отрезка), убирать (двойной щелчок), сменить вид или удалить.</p>
        </div>
        <!-- стены: рисовать линией, на линию — ворота, калитка, башня -->
        <div v-if="pop === 'walls'" class="sp-pop small walls">
          <div class="pop-head"><b>Стены</b><button @click="pop = null">×</button></div>
          <small class="pal-sub">Нарисовать стену <span>цена за 10 м</span></small>
          <button v-for="(t, k) in WALL_TYPES" :key="k" class="pal-item" :class="{ on: tool?.wall === k }" @click="setTool({ wall: k })">
            <i class="wl" :class="k" /><span>{{ t.label }}</span><em>защита +{{ fmtNum(t.defense * 10) }}</em>
            <PriceChips class="pal-price" :price="wallPrice(k, 10)" :stock="s.stock || {}" short />
          </button>
          <small class="pal-sub">Поставить на стену <span>щелчком по линии стены</span></small>
          <button v-for="(f, k) in WALL_FEATURES" :key="k" class="pal-item" :class="{ on: tool?.wallFeature === k }" @click="setTool({ wallFeature: k })">
            <i class="wf" :class="k" /><span>{{ f.label }}</span><em>{{ f.len ? `проём ${fmtNum(f.len)} м` : 'на углы и стыки' }}{{ f.defense ? ` · защита +${f.defense}` : '' }}</em>
            <PriceChips class="pal-price" :price="f.price" :stock="s.stock || {}" short />
          </button>
          <label class="chk"><input v-model="placeBuilt" type="checkbox" /> сразу построено (иначе — стройка)</label>
          <label v-if="!placeBuilt" class="chk"><input v-model="payBuild" type="checkbox" /> оплатить со склада</label>
          <p class="pal-note">Материалы считаются по длине: {{ wallRule }}. Стройка идёт от первой точки к последней, вместе с другими стройками. Замкнутое кольцо целиком готовых стен — защита +25%. Красный «!» на карте — дорога упирается в стену без ворот.</p>
        </div>
        <!-- лес -->
        <div v-if="pop === 'forest'" class="sp-pop small">
          <div class="pop-head"><b>Лес</b><button @click="pop = null">×</button></div>
          <button class="pal-item plain" :class="{ on: tool === 'cut' }" @click="setTool('cut')"><span>🪓 Вырубить</span><em>кистью</em></button>
          <button class="pal-item plain" :class="{ on: tool === 'fell' }" @click="setTool('fell')"><span>🌲 Срубить дерево</span><em>щелчком, останется пень</em></button>
          <button class="pal-item plain" :class="{ on: tool === 'grow' }" @click="setTool('grow')"><span>🌳 Вернуть лес</span><em>стирает вырубку и пни</em></button>
          <p class="pal-note">Дороги и постройки сами убирают деревья, которые на них стоят; под постройкой в лесу ещё и вырубка. Вырубок сейчас: {{ s.clearings?.length || 0 }}.</p>
        </div>
        <!-- туман -->
        <div v-if="pop === 'fog'" class="sp-pop small">
          <div class="pop-head"><b>Туман войны</b><button @click="pop = null">×</button></div>
          <button class="pal-item plain" :class="{ on: tool === 'fog-add' }" @click="setTool('fog-add')"><span>☀ Разведать</span><em>открыть землю</em></button>
          <button class="pal-item plain" :class="{ on: tool === 'fog-erase' }" @click="setTool('fog-erase')"><span>☁ Скрыть</span><em>вернуть туман</em></button>
        </div>
        <!-- генератор местности -->
        <div v-if="pop === 'terrain'" class="sp-pop terrain">
          <div class="pop-head"><b>Местность</b><button @click="pop = null">×</button></div>
          <p class="pal-note">Округа ≈17×17 км (300 км²) рисуется сама по «зерну» и ползункам. Дороги, вырубки, туман и постройки остаются на своих местах.</p>
          <label class="tr-row">Зерно <input v-model.number="gen.seed" type="number" min="0" /><button class="mini" title="Случайное зерно" @click="gen.seed = Math.floor(Math.random() * 1e6)">🎲</button></label>
          <label v-for="(d, k) in TERRAIN_PARAMS" :key="k" class="tr-row">
            <span>{{ d.label }}</span>
            <input v-model.number="gen.params[k]" type="range" :min="d.min" :max="d.max" :step="d.step" />
            <em>{{ k === 'ponds' ? gen.params[k] : Math.round(gen.params[k] * 100) + '%' }}</em>
          </label>
          <div class="day-row">
            <button @click="resetGen">Как было</button>
            <button @click="gen.params = { ...TERRAIN_DEFAULTS }">По умолчанию</button>
            <button class="primary" @click="applyGen">Применить</button>
          </div>
        </div>
        <!-- «прошёл день» -->
        <div v-if="pop === 'day'" class="sp-pop day">
          <div class="pop-head"><b>Сколько прошло?</b><button @click="pop = null">×</button></div>
          <p>За каждый день на склад придёт прирост и уйдёт расход; чего не хватает — возьмём из запаса, кончится запас — нехватка в журнал. Стройка продвинется, а сайт подкинет заготовки событий.<template v-if="s.day"> Сейчас день {{ s.day }}.</template></p>
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
              <div class="sp-sub">{{ s.kind }}
                <router-link v-if="city" class="sp-onmap" :to="{ path: '/', query: { focus: 'cities:' + city.id } }">на карте мира</router-link>
              </div>
            </div>
            <button class="sp-wide" :title="wide ? 'Вернуть карту' : 'Открыть панель на весь экран — удобнее читать и править'" @click="toggleWide">
              {{ wide ? '🗺 Карта' : '⤢ Во весь экран' }}
            </button>
          </div>
          <div class="sp-state">
            <!-- плашка: сколько жителей и общий статус -->
            <div class="sp-plaque">
              <i class="sp-rv a" /><i class="sp-rv b" /><i class="sp-rv c" /><i class="sp-rv d" />
              <div class="sp-people"><b>{{ calc.population }}</b><small>жителей</small></div>
              <div class="sp-mood"><small>общий статус</small><span>{{ s.status || '—' }}</span></div>
            </div>
            <!-- мораль, стабильность, угроза — полоски 0…100 -->
            <div class="sp-meters">
              <div v-for="m in meters" :key="m.key" class="sp-meter" :class="[m.key, { hot: m.hot }]" :title="`${m.label}: ${m.value} из 100`">
                <span class="sp-ml">{{ m.label }}</span>
                <div class="sp-trk"><i :style="{ width: Math.max(0, Math.min(100, m.value)) + '%' }" /></div>
                <b>{{ m.value }}</b>
              </div>
            </div>
          </div>
        </section>

        <!-- выбранная на карте постройка или аванпост -->
        <BuildingCard v-if="selItem" :settlement="s" :calc="calc" :sel="sel" :item="selItem" :master="master" :decider="decider" @close="sel = null" @save="saveItem" @remove="removeItem" @place="startPlaceExisting"
                      @repair="onRepair" @order-repair="onOrderRepair" />

        <nav class="sp-tabbar">
          <button v-for="tb in TABS" :key="tb.id" :class="{ on: tab === tb.id }" @click="setTab(tb.id)">
            {{ tb.label }}<i v-if="tb.dot" class="dot" />
          </button>
        </nav>
        <SettlementTabs :tab="tab" :settlement="s" :calc="calc" :master="master" :decider="decider" :wide="wide" @pick="sel = $event" @edit="editing = $event" @tab="setTab" @battle="battleSide = $event" />
        <p class="sp-credit">Значки: game-icons.net (CC BY 3.0)</p>
      </aside>
    </div>
    <SettlementEditor v-if="editing && s" :section="editing" :settlement="s" :wide="wide" @close="editing = null" />
    <BattlePanel v-if="battleSide && s" :settlement="s" :side="battleSide" @close="battleSide = null" @stats="battleSide = null; editing = 'army'" />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import UserMenu from '../components/UserMenu.vue'
import AxeLoader from './AxeLoader.vue'
import SettlementMap from './SettlementMap.vue'
import SettlementTabs from './SettlementTabs.vue'
import BuildingCard from './BuildingCard.vue'
import SettlementEditor from './SettlementEditor.vue'
import BattlePanel from './BattlePanel.vue'
import { missingRaceStats } from '../shared/army.js'
import PriceChips from './PriceChips.vue'
import { store, isMaster, act, toast } from '../map/store.js'
import { computeSettlement, shortFor, priceText, placementProblems, repairPrice, BUILDINGS, CATEGORIES, SIZES, RES, ROAD_TYPES } from '../shared/settlement.js'
import { WALL_TYPES, WALL_FEATURES, wallPrice, featurePrice } from '../shared/walls.js'
import { TERRAIN_DEFAULTS, TERRAIN_PARAMS } from '../shared/terrainGen.js'

const route = useRoute()
const router = useRouter()
const s = computed(() => {
  const list = store.data.settlements || []
  return list.find(x => x.id === route.params.id) || (!route.params.id ? list[0] : null)
})
const calc = computed(() => computeSettlement(s.value || {}))
const meters = computed(() => [
  { key: 'morale', label: 'Мораль', value: calc.value.morale },
  { key: 'stability', label: 'Стабильность', value: calc.value.stability },
  { key: 'threat', label: 'Угроза', value: calc.value.threat, hot: calc.value.threat >= 50 }
])

/* загрузочный экран: держим, пока не пришли данные и не нарисована местность;
   сам экран уходит в конце броска топора и не раньше, чем через два броска (2 секунды) */
const mapReady = ref(false)
const loaderShown = ref(true)
const loading = computed(() => !store.ready || (!!s.value && !mapReady.value))
setTimeout(() => { mapReady.value = true }, 9000) // страховка, если что-то пошло не так
const city = computed(() => s.value?.cityId && store.data.cities?.find(c => c.id === s.value.cityId))
watch(s, v => { if (v) document.title = `${v.name} — Анкария` }, { immediate: true })

const master = isMaster

/* большой формат: панель на весь экран (выбор запоминаем в этом браузере) */
const WIDE_KEY = 'anacaria-settle-wide'
const wide = ref((() => { try { return localStorage.getItem(WIDE_KEY) === '1' } catch { return false } })())
function toggleWide() {
  wide.value = !wide.value
  try { localStorage.setItem(WIDE_KEY, wide.value ? '1' : '0') } catch { /* приватный режим */ }
}
// решать могут выбранные мастером игроки
const decider = computed(() => !!store.me && store.me.role === 'player' && !!s.value?.deciders?.includes(store.me.id))
const editing = ref(null)
const battleSide = ref(null) // 'garrison' или id отряда — открыт помощник боя

/* ---------- инструменты карты ---------- */
const mapRef = ref(null)
const tool = ref(null)
const pop = ref(null) // открытое окошко: palette | roads | walls | forest | fog | terrain | day
const placeBuilt = ref(true)
const payBuild = ref(true)
const customDays = ref(3)
const brush = ref(60)
function openPop(name) { pop.value = pop.value === name ? null : name; if (name === 'terrain') resetGen() }
function setTool(t) {
  tool.value = t
  if (t === 'cut' || t === 'grow') brush.value = Math.min(Math.max(brush.value, 10), 300)
  if (t === 'fog-add' || t === 'fog-erase') brush.value = Math.max(brush.value, 150)
  pop.value = null
}
const brushTool = computed(() => ['cut', 'grow', 'fog-add', 'fog-erase'].includes(tool.value))
const brushRange = computed(() => (tool.value === 'cut' || tool.value === 'grow' ? [5, 300, 5] : [50, 2000, 50]))
const brushLabel = computed(() => (brush.value >= 1000 ? `${(brush.value / 1000).toFixed(1).replace('.', ',')} км` : `${brush.value} м`))
const paletteGroups = computed(() => {
  const out = {}
  for (const [type, b] of Object.entries(BUILDINGS)) {
    if (b.personal && !master.value) continue
    ;(out[b.cat] ||= []).push({ type, ...b })
  }
  return out
})
// постройки без места на карте (стена «на всё поселение» на карте не стоит вовсе)
const unplaced = computed(() => (s.value?.buildings || []).filter(b => b.x == null && BUILDINGS[b.type]?.size !== 'settlement'))
function startPlace(type) { setTool({ place: type }) }
function startPlaceExisting(b) { setTool({ placeExisting: b.id, type: b.type }) }
const hint = computed(() => {
  const t = tool.value
  if (t === 'move') return 'Тяни постройку или аванпост. Красным — сюда нельзя.'
  if (t?.placeExisting) { const b = s.value.buildings.find(x => x.id === t.placeExisting); return `Кликни, куда поставить «${b?.name || BUILDINGS[t.type]?.label}». Esc — отмена.` }
  if (t?.place) return `Кликни по разведанной земле, куда поставить «${BUILDINGS[t.place]?.label}». Esc — отмена.`
  if (t?.explore) return 'Кликни, какой участок разведать — мастер получит приказ.'
  if (t?.road) return `${ROAD_TYPES[t.road].label}: щёлкай точки, двойной щелчок или Enter — готово, Backspace — убрать точку, Esc — отмена. Точка прилипает к другим дорогам (кольцо); начни с конца такой же дороги — продолжишь её.`
  if (t?.wall) return `${WALL_TYPES[t.wall].label}: щёлкай точки, двойной щелчок или Enter — готово, Backspace — убрать точку, Esc — отмена. Начни с конца такой же стены — продолжишь её; последнюю точку поставь на первую — кольцо.`
  if (t?.wallFeature) return `${WALL_FEATURES[t.wallFeature].label}: наведи на стену и щёлкни. Esc — отмена.`
  if (t === 'cut') return 'Води кистью по лесу — вырубка.'
  if (t === 'fell') return 'Наведи на дерево или куст и щёлкни — останется пень. Esc — отмена.'
  if (t === 'grow') return 'Води кистью по вырубке — лес вернётся.'
  if (t === 'fog-add') return 'Води кистью — земля станет разведанной.'
  if (t === 'fog-erase') return 'Води кистью — вернёт туман на кружки разведки.'
  return ''
})
// приказы на рассмотрении — призраки на карте
const ghosts = computed(() => (s.value?.orders || []).filter(o => o.status === 'pending' && (o.build || o.explore)).map(o => (o.build
  ? { id: o.id, type: o.build.type, x: o.build.x, y: o.build.y }
  : { id: o.id, explore: true, x: o.explore.x, y: o.explore.y, r: o.explore.r })))

const base = () => `/api/settlements/${s.value.id}`
const patch = (body, ok) => act('PATCH', base(), body, ok).catch(() => null)
function onMoved({ id, kind, x, y }) {
  if (kind === 'outpost') patch({ outposts: s.value.outposts.map(o => (o.id === id ? { ...o, x: Math.round(x), y: Math.round(y) } : o)) })
  else act('POST', `${base()}/buildings`, { id, x, y }).catch(() => null)
}
async function onPlaced({ type, id, x, y }) {
  const def = BUILDINGS[type]
  if (master.value && id) {
    // из списка «не расставлены»; дальше — следующая такая же, чтобы быстро расставить все дома
    const b = await act('POST', `${base()}/buildings`, { id, x, y }, `«${def.label}» на месте`).catch(() => null)
    if (!b) return
    const next = unplaced.value.find(u => u.type === type && u.id !== id)
    tool.value = next ? { placeExisting: next.id, type } : null
    if (!next) sel.value = { kind: 'building', id }
  } else if (master.value) {
    const b = await act('POST', `${base()}/buildings`, { type, x, y, built: placeBuilt.value, pay: payBuild.value },
      `«${def.label}» ${placeBuilt.value ? 'поставлена' : 'заложена'}`).catch(() => null)
    if (b?.id) sel.value = { kind: 'building', id: b.id }
  } else {
    const miss = shortFor(s.value.stock, def.price)
    const cost = def.price ? `\nЦена: ${priceText(def.price)}.` : ''
    const warn = miss.length ? `\nСейчас не хватает: ${miss.map(m => `${RES[m.res]?.label} ${m.have} из ${m.need}`).join(', ')} — мастер может отложить.` : ''
    const text = prompt(`Приказ: построить «${def.label}».${cost}${warn}\nКомментарий для мастера (необязательно):`, '')
    if (text === null) return
    await act('POST', `${base()}/orders`, { kind: 'build', type, x, y, text }, 'Приказ отправлен мастеру').catch(() => null)
    tool.value = null
  }
}
async function onExplore({ x, y }) {
  const text = prompt('Приказ: разведать этот участок. Комментарий для мастера (необязательно):', '')
  if (text === null) return
  await act('POST', `${base()}/orders`, { kind: 'explore', x, y, text }, 'Приказ отправлен мастеру').catch(() => null)
  tool.value = null
}
// кисть: добавить круги или стереть те, что под ней
const brushApply = (list, { erase, points, r }) => (erase
  ? list.filter(e => !e.r || !points.some(p => Math.hypot(p.x - e.x, p.y - e.y) < r + e.r * 0.5))
  : [...list, ...points.map(p => ({ x: Math.round(p.x), y: Math.round(p.y), r: Math.round(r) }))])
const onFog = ev => patch({ explored: brushApply(s.value.explored || [], ev) })
const onCut = ev => patch({ clearings: brushApply(s.value.clearings || [], ev) })
const onFell = tr => patch({ clearings: [...(s.value.clearings || []), { x: Math.round(tr.x * 10) / 10, y: Math.round(tr.y * 10) / 10, r: Math.max(1, Math.round(tr.r + 0.4)), tree: true }] })
// новая дорога, начатая или законченная на конце такой же дороги, продолжает её — одна плавная линия без стыка
function mergeRoad(roads, type, points) {
  const same = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.6
  let pts = points, keep = null
  const rest = [...roads]
  for (let pass = 0; pass < 2; pass++) {
    const i = rest.findIndex(r => r.type === type && r !== keep && [r.points[0], r.points[r.points.length - 1]].some(e => same(e, pts[0]) || same(e, pts[pts.length - 1])))
    if (i < 0) break
    const r = rest[i]
    const a = r.points[0], b = r.points[r.points.length - 1]
    if (same(pts[0], b)) pts = [...r.points, ...pts.slice(1)]
    else if (same(pts[0], a)) pts = [...[...r.points].reverse(), ...pts.slice(1)]
    else if (same(pts[pts.length - 1], a)) pts = [...pts, ...r.points.slice(1)]
    else pts = [...pts, ...[...r.points].reverse().slice(1)]
    keep = keep ? { ...keep, points: pts } : { ...r, points: pts }
    rest.splice(i, 1)
  }
  return keep ? { roads: [...rest, { ...keep, points: pts }], id: keep.id, merged: true } : null
}
async function onRoad({ type, points }) {
  const m = mergeRoad(s.value.roads || [], type, points)
  const id = m?.id || 'r' + Date.now().toString(36)
  const r = await patch({ roads: m ? m.roads : [...(s.value.roads || []), { id, type, points }] }, m ? `${ROAD_TYPES[type].label} продолжена` : `${ROAD_TYPES[type].label} проложена`)
  if (r) sel.value = { kind: 'road', id }
}
const onRoadEdit = ({ kind, id, points }) => (kind === 'wall'
  ? patch({ walls: s.value.walls.map(w => (w.id === id ? { ...w, points } : w)) })
  : patch({ roads: s.value.roads.map(r => (r.id === id ? { ...r, points } : r)) }))

/* ---------- ремонт построек ---------- */
const onRepair = (id, opt) => act('POST', `${base()}/buildings/${id}/repair`, opt, opt.instant ? 'Постройка снова целая' : 'Ремонт начат — пойдёт с «Прошёл день»').catch(() => null)
async function onOrderRepair(b) {
  const name = b.name || BUILDINGS[b.type]?.label
  const price = priceText(repairPrice(b))
  const text = prompt(`Приказ: ${b.damage === 'ruined' ? 'отстроить' : 'починить'} «${name}».${price ? `\nЦена: ${price}.` : ''}\nКомментарий для мастера (необязательно):`, '')
  if (text === null) return
  await act('POST', `${base()}/orders`, { kind: 'repair', building: b.id, text }, 'Приказ отправлен мастеру').catch(() => null)
}

/* ---------- стены ---------- */
const fmtNum = v => String(Math.round(v * 10) / 10).replace('.', ',')
const wallRule = computed(() => Object.values(WALL_TYPES).map(t => `${t.short} — ${Object.entries(t.perM).map(([k, v]) => `${RES[k]?.label.toLowerCase()} ${fmtNum(v)}`).join(', ')} на метр`).join('; '))
const howText = () => (placeBuilt.value ? 'сразу готово' : payBuild.value ? 'стройка, оплата со склада' : 'стройка без оплаты')
async function onWall({ type, points }) {
  const w = await act('POST', `${base()}/walls`, { type, points, built: placeBuilt.value, pay: payBuild.value },
    `${WALL_TYPES[type].label}: ${placeBuilt.value ? 'поставлена' : 'заложена'}`).catch(() => null)
  if (w?.id) sel.value = { kind: 'wall', id: w.id }
}
function onWallFeature({ wallId, s: at, kind }) {
  return act('POST', `${base()}/walls/${wallId}/features`, { kind, s: at, built: placeBuilt.value, pay: payBuild.value },
    `${WALL_FEATURES[kind].label}: ${placeBuilt.value ? 'готово' : 'заложено'}`).catch(() => null)
}
function onNeedGate({ wallId, s: at }) {
  const w = s.value.walls.find(x => x.id === wallId)
  const price = placeBuilt.value || !payBuild.value ? '' : `\nЦена: ${priceText(featurePrice('gate', w?.type))}.`
  if (confirm(`Поставить ворота там, где дорога упирается в стену? (${howText()})${price}`)) onWallFeature({ wallId, s: at, kind: 'gate' })
}

/* ---------- генератор местности ---------- */
const gen = ref({ seed: 1917, params: { ...TERRAIN_DEFAULTS } })
function resetGen() { gen.value = { seed: s.value?.terrain?.seed ?? 1917, params: { ...TERRAIN_DEFAULTS, ...(s.value?.terrain?.params || {}) } } }
async function applyGen() {
  const next = { v: 2, seed: Math.round(gen.value.seed) || 0, params: gen.value.params }
  const r = await patch({ terrain: next }, 'Местность перерисована')
  if (!r) return
  // какие постройки оказались в воде или болоте на новой местности
  const bad = r.buildings.filter(b => b.x != null && placementProblems(r, b).some(p => p.startsWith('в ')))
  if (bad.length) toast(`На новой местности не на месте: ${bad.map(b => b.name || BUILDINGS[b.type].label).join(', ')} — передвинь их`, 'error')
}

async function advance(days) {
  const r = await act('POST', `${base()}/advance`, { days }).catch(() => null)
  pop.value = null
  if (!r) return
  toast(`Прошло дней: ${days}${r.done?.length ? ' · достроено: ' + r.done.join(', ') : ''}${r.suggestions ? ' · заготовок событий: ' + r.suggestions : ''}`)
  if (r.short?.length || r.suggestions) setTab('journal')
}
function saveItem(kind, item) {
  if (kind === 'building') patch({ buildings: s.value.buildings.map(b => (b.id === item.id ? item : b)) }, 'Сохранено')
  else if (kind === 'road') patch({ roads: s.value.roads.map(r => (r.id === item.id ? item : r)) }, 'Сохранено')
  else if (kind === 'wall') patch({ walls: s.value.walls.map(w => (w.id === item.id ? item : w)) }, 'Сохранено')
  else patch({ outposts: s.value.outposts.map(o => (o.id === item.id ? item : o)) }, 'Сохранено')
}
// убрать с карты: постройка уходит в «не расставлены»; снести — совсем
function removeItem(kind, id, how) {
  if (kind === 'building' && how === 'unplace') {
    patch({ buildings: s.value.buildings.map(b => (b.id === id ? { ...b, x: null, y: null } : b)) }, 'Убрано в «не расставлены»')
  } else {
    if (!confirm(kind === 'road' ? 'Удалить дорогу?' : kind === 'wall' ? 'Снести стену вместе с воротами и башнями? Потраченное не вернётся.' : kind === 'building' ? 'Снести постройку совсем?' : 'Убрать аванпост?')) return
    if (kind === 'building') patch({ buildings: s.value.buildings.filter(b => b.id !== id) }, 'Снесено')
    else if (kind === 'road') patch({ roads: s.value.roads.filter(r => r.id !== id) }, 'Дорога удалена')
    else if (kind === 'wall') patch({ walls: s.value.walls.filter(w => w.id !== id) }, 'Стена снесена')
    else patch({ outposts: s.value.outposts.filter(o => o.id !== id) }, 'Убрано')
  }
  sel.value = null
}
onKey()
function onKey() {
  const h = e => {
    if (e.key !== 'Escape' || ['INPUT', 'TEXTAREA'].includes(e.target?.tagName)) return
    // дорогу, которую рисуют, Esc сбрасывает сам; второй Esc — снять инструмент
    if ((tool.value?.road || tool.value?.wall) && mapRef.value?.draft?.length) return
    tool.value = null
    pop.value = null
  }
  window.addEventListener('keydown', h)
  onBeforeUnmount(() => window.removeEventListener('keydown', h))
}

const sel = ref(route.query.b ? { kind: 'building', id: String(route.query.b) } : null)
const selItem = computed(() => {
  if (!sel.value || !s.value) return null
  const list = { outpost: s.value.outposts, road: s.value.roads, wall: s.value.walls }[sel.value.kind] || s.value.buildings
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
  { id: 'garrison', label: 'Гарнизон', dot: master.value && !!s.value && missingRaceStats(s.value).length > 0 },
  { id: 'squads', label: 'Отряды' },
  { id: 'hospital', label: 'Лечение', dot: (master.value || decider.value) && (s.value?.hospital || []).some(p => !p.treatment) },
  { id: 'orders', label: 'Приказы', dot: master.value && (s.value?.orders || []).some(o => o.status === 'pending') },
  { id: 'journal', label: 'Журнал', dot: (s.value?.events || []).some(e => e.duration?.includes('decide') && !e.decision) || (master.value && !!s.value?.suggestions?.length) },
  { id: 'history', label: 'История' }
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
.sp-hint { position: absolute; z-index: 5; top: 62px; left: 12px; right: 60px; width: max-content; max-width: calc(100% - 72px); display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; padding: 6px 10px; border-radius: 9px; background: rgba(23, 19, 14, .92); border: 1px solid #8a6630; color: #e6d6b0; font: 600 12px var(--a-sans); }
.sp-hint .brush { display: inline-flex; align-items: center; gap: 6px; color: #f3d99a; white-space: nowrap; }
.sp-hint .brush input { width: 120px; accent-color: #e6c27a; }
.mini { padding: 3px 9px; border-radius: 7px; border: 1px solid var(--a-line); background: rgba(231, 197, 111, .1); color: var(--a-gold-2); font: 700 12px var(--a-sans); cursor: pointer; }
.sp-tools .cnt { margin-left: 5px; padding: 0 6px; border-radius: 99px; background: #e0281e; color: #fff; font: 800 10.5px/16px var(--a-sans); font-style: normal; }
.sp-pop.small { width: 290px; }
.sp-pop.walls { width: min(340px, calc(100% - 24px)); }
.wl { width: 34px; height: 8px; flex: none; border-radius: 1px; }
.wl.palisade { background: repeating-linear-gradient(90deg, #b0844f 0 3px, #5a3c1e 3px 4px); box-shadow: 0 0 0 1.5px #2c1f12; }
.wl.stone { height: 10px; background: repeating-linear-gradient(90deg, #c2bdb1 0 6px, #8f8b82 6px 10px); box-shadow: 0 0 0 1.5px #34322e; }
.wf { width: 34px; height: 12px; flex: none; position: relative; }
.wf.gate, .wf.wicket { background: linear-gradient(90deg, #2c1f12 0 5px, transparent 5px calc(100% - 5px), #2c1f12 calc(100% - 5px)); }
.wf.gate::after, .wf.wicket::after { content: ''; position: absolute; left: 6px; right: 6px; top: 4px; height: 4px; background: repeating-linear-gradient(90deg, #c49a5a 0 3px, #8a6236 3px 4px); }
.wf.wicket { width: 22px; }
.wf.tower { width: 14px; height: 14px; margin: 0 10px; background: #7a5530; box-shadow: 0 0 0 1.5px #2c1f12, inset 0 0 0 4px #7a5530, inset 0 0 0 7px #b0844f; }
.sp-pop.terrain { width: 360px; }
.pal-sub { display: block; margin: 6px 0 3px; color: var(--a-gold); font-weight: 800; font-size: 10.5px; letter-spacing: .06em; text-transform: uppercase; }
.pal-sub span { color: var(--a-muted); font-weight: 600; text-transform: none; letter-spacing: 0; }
.pal-item.plain { grid-template-columns: 1fr auto; padding: 7px 8px; }
.rd { display: block; width: 24px; height: 6px; border-radius: 3px; background: #a3835a; box-shadow: 0 0 0 1.5px #6b5235; }
.rd.trail { height: 2px; background: repeating-linear-gradient(90deg, #cdb17c 0 5px, transparent 5px 8px); box-shadow: none; }
.rd.tract { height: 9px; background: linear-gradient(#977652 30%, #7b5d3c 30% 42%, #977652 42% 58%, #7b5d3c 58% 70%, #977652 70%); box-shadow: 0 0 0 1.5px #5e472c; }
.rd.paved { height: 8px; background: repeating-linear-gradient(90deg, #9a958a 0 3px, #b6b1a5 3px 4px); box-shadow: 0 0 0 1.5px #4c4a45; }
.rd.bridge { height: 8px; background: repeating-linear-gradient(90deg, #a77d4c 0 3px, #7a5a34 3px 4px); box-shadow: 0 0 0 2px #3b2a18; }
.tr-row { display: grid; grid-template-columns: 1fr 120px 40px; align-items: center; gap: 6px; margin: 5px 0; color: #d9cdb0; font-weight: 600; }
.tr-row:first-of-type { grid-template-columns: 50px 1fr auto; }
.tr-row input[type=range] { accent-color: #e6c27a; }
.tr-row input[type=number] { min-width: 0; padding: 4px 7px; border-radius: 8px; border: 1px solid var(--a-line-2); background: rgba(0, 0, 0, .3); color: var(--a-text); }
.tr-row em { font-style: normal; color: var(--a-gold-2); text-align: right; font-weight: 800; }
.day-row .primary { background: linear-gradient(180deg, #f0d083, #c9a24f); color: #1b1408; border: 0; }
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
.pal-price { grid-column: 2 / 4; margin: -3px 0 1px; }
.pal-note { margin: 0 0 4px !important; font-size: 11.5px; }
.sp-pop p { color: #b9ab8a; line-height: 1.45; margin: 0 0 8px; }
.day-row { display: flex; gap: 5px; }
.day-row button { padding: 6px 9px; border-radius: 8px; border: 1px solid var(--a-line); background: rgba(231, 197, 111, .1); color: var(--a-gold-2); font: 700 12px var(--a-sans); cursor: pointer; }
.day-row input { width: 52px; padding: 4px 6px; border-radius: 8px; border: 1px solid var(--a-line-2); background: rgba(0, 0, 0, .3); color: var(--a-text); }
.sp-panel { min-width: 0; overflow-y: auto; padding: 18px 18px 30px; scrollbar-width: thin; }

.sp-head { padding: 14px 16px; border-radius: 16px; background: linear-gradient(170deg, #241c13, #16110c); border: 1px solid #6e4f22; box-shadow: 0 0 0 3px #1a140e, 0 0 0 4px rgba(201, 162, 79, .3); }
.sp-title { display: flex; align-items: center; gap: 12px; }
.sp-crest { width: 52px; height: 52px; padding: 6px; border-radius: 14px; background: #d6d2c8; border: 2px solid #b06cff; }
.sp-title h1 { margin: 0; font: 700 32px/1 var(--a-serif); color: var(--a-gold-2); }
.sp-sub { margin-top: 4px; color: #b9ab8a; font-size: 13px; font-weight: 600; }
.sp-onmap { margin-left: 8px; color: var(--a-gold); font-size: 12px; }
.sp-state { display: grid; gap: 10px; margin-top: 12px; }
.sp-plaque { position: relative; display: flex; align-items: center; gap: 14px; padding: 10px 16px; border-radius: 12px; background: linear-gradient(180deg, #2c2217, #1a140e); border: 1px solid #8a6630; box-shadow: inset 0 1px 0 rgba(255, 230, 170, .12), 0 3px 10px rgba(0, 0, 0, .35); }
.sp-rv { position: absolute; width: 6px; height: 6px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #ffe9b0, #8a6630 60%, #3b2a12); }
.sp-rv.a { top: 5px; left: 5px; } .sp-rv.b { top: 5px; right: 5px; } .sp-rv.c { bottom: 5px; left: 5px; } .sp-rv.d { bottom: 5px; right: 5px; }
.sp-people { display: grid; justify-items: center; padding-right: 14px; border-right: 1px dashed rgba(201, 162, 79, .35); }
.sp-people b { font: 700 40px/1 var(--a-serif); color: #f3d99a; text-shadow: 0 2px 10px rgba(243, 217, 154, .25); }
.sp-people small, .sp-mood small { font-size: 10.5px; color: #a8936c; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
.sp-mood { display: grid; gap: 2px; min-width: 0; }
.sp-mood span { font: 700 clamp(16px, 5.6vw, 24px)/1.1 var(--a-serif); color: #9be07a; overflow-wrap: break-word; }
@media (max-width: 380px) { .sp-people b { font-size: 34px; } .sp-meter { grid-template-columns: 84px 1fr 28px; gap: 8px; } }
.sp-meters { display: grid; gap: 7px; }
.sp-meter { display: grid; grid-template-columns: 96px 1fr 34px; align-items: center; gap: 10px; }
.sp-ml { font-size: 12px; font-weight: 800; color: #c9b88f; }
.sp-meter b { font: 700 17px/1 var(--a-serif); color: #f3d99a; text-align: right; }
.sp-trk { position: relative; height: 12px; border-radius: 7px; overflow: hidden; background: rgba(0, 0, 0, .35); box-shadow: inset 0 0 0 1px rgba(201, 162, 79, .2);
  background-image: repeating-linear-gradient(90deg, transparent 0 calc(25% - 1px), rgba(201, 162, 79, .22) calc(25% - 1px) 25%); }
.sp-trk i { position: relative; display: block; height: 100%; border-radius: 7px; transform-origin: left; animation: sp-grow 1s cubic-bezier(.3, 1.2, .5, 1) both; transition: width .8s cubic-bezier(.3, 1.3, .5, 1); }
/* бегущий блик по полоске */
.sp-trk i::after { content: ''; position: absolute; inset: 0; background: linear-gradient(100deg, transparent 30%, rgba(255, 255, 255, .35) 50%, transparent 70%); background-size: 200% 100%; animation: sp-shine 3.5s ease-in-out infinite; }
.sp-meter.morale .sp-trk i { background: linear-gradient(90deg, #c99a48, #f2d58f); }
.sp-meter.stability .sp-trk i { background: linear-gradient(90deg, #2f8f9e, #6fd6e8); }
.sp-meter.threat .sp-trk i { background: linear-gradient(90deg, #a81f30, #ff6b5b); }
.sp-meter.threat b { color: #ff9b8f; }
.sp-meter.hot .sp-trk { animation: sp-alarm 1.6s ease-in-out infinite; }
@keyframes sp-grow { from { transform: scaleX(0); } }
@keyframes sp-shine { 0% { background-position: 150% 0; } 60%, 100% { background-position: -50% 0; } }
@keyframes sp-alarm { 50% { box-shadow: inset 0 0 0 1px rgba(255, 107, 91, .7), 0 0 10px rgba(255, 107, 91, .45); } }
@media (prefers-reduced-motion: reduce) { .sp-trk i, .sp-trk i::after, .sp-meter.hot .sp-trk { animation: none; } }

.sp-tabbar { position: sticky; top: -18px; z-index: 5; display: flex; flex-wrap: wrap; gap: 4px; margin: 14px -18px 12px; padding: 10px 18px 8px; background: rgba(13, 16, 23, .94); backdrop-filter: blur(8px); border-bottom: 1px solid var(--a-line); }
.sp-tabbar button { position: relative; padding: 6px 11px; border-radius: 9px; border: 1px solid transparent; background: none; color: var(--a-muted); font: 700 13px var(--a-sans); cursor: pointer; }
.sp-tabbar button:hover { color: var(--a-text); }
.sp-tabbar button.on { background: rgba(231, 197, 111, .14); border-color: rgba(231, 197, 111, .35); color: var(--a-gold-2); }
.dot { position: absolute; top: 3px; right: 3px; width: 7px; height: 7px; border-radius: 50%; background: #ff6b5b; }
.sp-credit { margin-top: 24px; color: #6d675b; font-size: 11px; text-align: center; }
.sp-wide { margin-left: auto; align-self: flex-start; padding: 5px 10px; border-radius: 9px; border: 1px solid rgba(231, 197, 111, .4); background: rgba(231, 197, 111, .08); color: var(--a-gold-2); font: 700 12px var(--a-sans); white-space: nowrap; cursor: pointer; }
.sp-wide:hover { background: rgba(231, 197, 111, .18); }

/* большой формат: карта прячется, панель — на весь экран, содержимое по центру */
.sp-body.wide { grid-template-columns: 1fr; }
.sp-body.wide .sp-mapwrap { display: none; }
.sp-body.wide .sp-panel { padding: 22px 28px 40px; }
.sp-body.wide .sp-panel > * { max-width: 1240px; margin-left: auto; margin-right: auto; }
.sp-body.wide .sp-head { display: flex; align-items: center; gap: 24px; }
.sp-body.wide .sp-title { flex: 1; }
.sp-body.wide .sp-state { margin-top: 0; flex: 0 1 640px; grid-template-columns: auto 1fr; align-items: center; gap: 18px; }
.sp-body.wide .sp-tabbar { top: -22px; margin-top: 14px; margin-bottom: 14px; padding: 10px 0 8px; }
.sp-body.wide .sp-tabbar button { padding: 7px 14px; font-size: 14px; }

@media (max-width: 900px) {
  .sp-top { gap: 10px; padding: 0 12px; }
  .sp-brand span { display: none; }
  .sp-body { grid-template-columns: 1fr; height: auto; }
  .sp-map { height: 58vh; border-right: 0; border-bottom: 1px solid var(--a-line); }
  .sp-pop { width: calc(100% - 24px); top: 98px; max-height: calc(100% - 110px); }
  .sp-hint { top: 98px; max-width: calc(100% - 24px); }
  .sp-panel { overflow: visible; padding: 14px 12px 30px; }
  .sp-tabbar { top: 64px; margin: 14px -12px 12px; padding: 10px 12px 8px; }
  /* на телефоне панель и так во всю ширину */
  .sp-wide { display: none; }
  .sp-body.wide .sp-mapwrap { display: block; }
  .sp-body.wide .sp-head { display: block; }
  .sp-body.wide .sp-panel { padding: 14px 12px 30px; }
  .sp-body.wide .sp-tabbar { top: 64px; margin: 14px -12px 12px; padding: 10px 12px 8px; }
}
</style>
