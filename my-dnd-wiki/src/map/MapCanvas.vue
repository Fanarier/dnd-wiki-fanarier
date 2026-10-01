<template>
  <div ref="wrap" class="canvas-wrap" :class="['tool-' + activeTool, { panning: gesture?.mode === 'pan' }]">
    <svg
      ref="svg"
      class="map-svg"
      :width="size.w"
      :height="size.h"
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointercancel="onCancel"
      @pointerleave="onLeave"
      @wheel.prevent="onWheel"
      @dblclick.prevent="onDblClick"
      @contextmenu.prevent
    >
      <defs>
        <radialGradient v-for="(fx, key) in ZONE_EFFECTS" :id="'ag-' + key" :key="key">
          <stop offset="0" :stop-color="fx.color" stop-opacity="0.75" />
          <stop offset="0.55" :stop-color="fx.glow" stop-opacity="0.45" />
          <stop offset="1" :stop-color="fx.glow" stop-opacity="0" />
        </radialGradient>
        <radialGradient id="pt-glow">
          <stop offset="0" stop-color="currentColor" stop-opacity="0.7" />
          <stop offset="1" stop-color="currentColor" stop-opacity="0" />
        </radialGradient>
        <pattern id="fog-tex" patternUnits="userSpaceOnUse" width="384" height="384">
          <image :href="fogTex" width="384" height="384" />
        </pattern>
        <pattern id="fog-hatch" patternUnits="userSpaceOnUse" width="10" height="10" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="10" stroke="#9fb4ff" stroke-width="2" stroke-opacity="0.5" />
        </pattern>
        <mask id="fog-mask" maskUnits="userSpaceOnUse" :x="-200" :y="-200" :width="W + 400" :height="H + 400">
          <rect :x="-200" :y="-200" :width="W + 400" :height="H + 400" fill="#000" />
          <g v-for="f in fogShapes" :key="f.id">
            <template v-if="f.shape === 'poly'">
              <path v-for="(p, i) in SOFT" :key="i" :d="f.d" :fill="f.color" :fill-opacity="p.o" :stroke="f.color" :stroke-opacity="p.o"
                    :stroke-width="Math.max(2, f.r * 2) * p.w" stroke-linejoin="round" />
            </template>
            <template v-else>
              <path v-for="(p, i) in SOFT" :key="i" :d="f.d" fill="none" :stroke="f.color" :stroke-opacity="p.o"
                    :stroke-width="f.r * 2 * p.w" stroke-linecap="round" stroke-linejoin="round" />
            </template>
          </g>
        </mask>
        <pattern v-if="gridOn && grid.type !== 'hex'" id="grid-pat" patternUnits="userSpaceOnUse" :width="gridPx" :height="gridPx">
          <path :d="`M${gridPx},0 L0,0 0,${gridPx}`" fill="none" class="grid-line" :stroke-width="1.2 / view.k" />
        </pattern>
        <pattern v-if="gridOn && grid.type === 'hex'" id="grid-pat" patternUnits="userSpaceOnUse" :width="hex.w" :height="hex.h">
          <path :d="hex.d" fill="none" class="grid-line" :stroke-width="1.2 / view.k" />
        </pattern>
      </defs>

      <g :transform="`translate(${view.x},${view.y}) scale(${view.k})`">
        <!-- Базовые слои из FMG -->
        <image href="/map/base.svg" :width="W" :height="H" />
        <image v-if="L.heights" href="/map/heights.svg" :width="W" :height="H" opacity="0.85" />
        <image v-if="L.biomes" href="/map/biomes.svg" :width="W" :height="H" opacity="0.8" />
        <image v-if="L.rivers" href="/map/rivers.svg" :width="W" :height="H" />
        <image v-if="L.relief" href="/map/relief.svg" :width="W" :height="H" />
        <image v-if="L.states" href="/map/states.svg" :width="W" :height="H" />
        <image v-if="L.borders" href="/map/borders.svg" :width="W" :height="H" />

        <!-- Государства: невидимые области для наведения и клика -->
        <g class="state-hits">
          <path v-for="sp in statePaths" :key="sp.stateId" :d="sp.d" :data-obj="'states:' + sp.stateId"
                :class="{ hovered: hoverState === sp.stateId, selected: isSel('states', sp.stateId) }"
                :style="{ '--sc': sp.color }"
                @pointerenter="hoverState = sp.stateId" @pointerleave="hoverState = null" />
        </g>

        <!-- Дороги -->
        <g v-if="L.roads" class="roads">
          <g v-for="r in roads" :key="r.id" :class="{ 'is-hidden': r.hidden }">
            <path :d="r.d" class="road-hit" :data-obj="'roads:' + r.id" />
            <path :d="r.d" class="road" :stroke="r.style.color" :stroke-width="r.style.width" :stroke-dasharray="r.style.dash"
                  vector-effect="non-scaling-stroke" />
            <path v-if="isSel('roads', r.id)" :d="r.d" class="road-sel" vector-effect="non-scaling-stroke" />
          </g>
        </g>

        <!-- Аномалии-зоны -->
        <g v-if="L.anomalies">
          <AnomalyZone v-for="z in zones" :key="z.id" :a="z" :x="z.st.x" :y="z.st.y"
                       :faded="!z.st.active || z.hidden" :selected="isSel('anomalies', z.id)"
                       :data-obj="'anomalies:' + z.id" />
          <!-- траектория движущихся аномалий (мастер) -->
          <template v-if="master">
            <line v-for="z in movingZones" :key="'mv' + z.id" :x1="z.x" :y1="z.y" :x2="z.toX" :y2="z.toY" class="anomaly-track" vector-effect="non-scaling-stroke" />
          </template>
        </g>

        <!-- Подписи: народы (из FMG) и свои подписи мастера — всё редактируется -->
        <g v-if="L.labels" class="labels">
          <MapLabel v-for="st in stateLabels" :key="'sl' + st.id" :id="'s-' + st.id" :l="st.label" :text="st.name" kind="state"
                    :selected="isSel('states', st.id)" :faded="st.hidden" :data-obj="'statelabel:' + st.id" />
          <MapLabel v-for="lb in store.data.labels" :key="lb.id" :id="lb.id" :l="lb" :text="lb.text" :kind="lb.style"
                    :selected="isSel('labels', lb.id)" :faded="lb.hidden" :data-obj="'labels:' + lb.id" />
        </g>

        <!-- Сетка для расчёта расстояний (видит только мастер) -->
        <rect v-if="gridOn" :x="0" :y="0" :width="W" :height="H" fill="url(#grid-pat)" class="grid" />

        <!-- Туман войны -->
        <g v-if="fogVisible" mask="url(#fog-mask)" :class="['fog', master ? 'fog-master' : 'fog-player']">
          <rect :x="-200" :y="-200" :width="W + 400" :height="H + 400" fill="url(#fog-tex)" />
          <rect v-if="master" :x="-200" :y="-200" :width="W + 400" :height="H + 400" fill="url(#fog-hatch)" />
        </g>

        <!-- Города -->
        <g v-if="L.cities" class="cities">
          <g v-for="c in visibleCities" :key="c.id" :transform="`translate(${c.x},${c.y}) scale(${iconScale / view.k})`"
             :class="['city', 'city-' + c.type, { 'is-hidden': c.hidden, selected: isSel('cities', c.id) }]" :data-obj="'cities:' + c.id">
            <template v-if="c.type === 'capital'">
              <image href="/icons/elven-castle.png" x="-12" y="-12" width="24" height="24" />
            </template>
            <template v-else-if="c.type === 'city' || c.type === 'fort'">
              <rect x="-5" y="-5" width="10" height="10" rx="2" class="city-ring" :transform="c.type === 'fort' ? 'rotate(45)' : ''" />
            </template>
            <template v-else-if="c.type === 'ruins'">
              <path :d="ICONS.ruins" transform="translate(-7,-7) scale(0.58)" class="city-ruins" />
            </template>
            <circle v-else r="3.6" class="city-dot" />
            <circle v-if="isSel('cities', c.id)" r="14" class="sel-ring" />
            <text v-if="c.showLabel" :y="c.type === 'capital' ? -14 : -9" :class="['lbl', 'lbl-' + c.type]">{{ c.name }}</text>
          </g>
        </g>

        <!-- Точечные аномалии -->
        <g v-if="L.anomalies">
          <g v-for="p in points" :key="p.id" :transform="`translate(${p.st.x},${p.st.y}) scale(${iconScale / view.k})`"
             :class="['poi', { faded: !p.st.active || p.hidden, selected: isSel('anomalies', p.id) }]"
             :style="{ color: p.fx.color }" :data-obj="'anomalies:' + p.id">
            <circle r="20" fill="url(#pt-glow)" class="poi-glow" />
            <image :href="`/icons/${p.fx.img}.png`" x="-13" y="-13" width="26" height="26" />
            <circle v-if="isSel('anomalies', p.id)" r="19" class="sel-ring" />
            <text v-if="view.k > 1.3 || isSel('anomalies', p.id)" y="28" class="lbl lbl-poi">{{ p.name }}</text>
          </g>
        </g>

        <!-- Маршруты отрядов -->
        <g v-if="L.parties">
          <g v-for="p in parties" :key="'j' + p.id">
            <template v-if="p.journey">
              <path :d="p.done" class="journey-done" :stroke="p.color" vector-effect="non-scaling-stroke" />
              <path :d="p.todo" class="journey-todo" :stroke="p.color" vector-effect="non-scaling-stroke" />
              <g :transform="`translate(${p.dest[0]},${p.dest[1]}) scale(${1 / view.k})`">
                <path :d="ICONS.flag" transform="translate(-3,-20) scale(0.8)" :fill="p.color" class="dest-flag" />
              </g>
            </template>
          </g>
          <g v-for="p in parties" :key="p.id" :transform="`translate(${p.pos.x},${p.pos.y}) scale(${Math.max(0.75, iconScale) / view.k})`"
             :class="['party', { moving: p.moving, 'is-hidden': p.hidden, selected: isSel('parties', p.id) }]"
             :style="{ color: p.color }" :data-obj="'parties:' + p.id">
            <circle v-if="p.moving" r="16" class="party-pulse" />
            <circle r="13" class="party-bg" />
            <path :d="ICONS[p.icon] || ICONS.sword" transform="translate(-9,-9) scale(0.75)" class="party-glyph" />
            <circle v-if="isSel('parties', p.id)" r="18" class="sel-ring" />
            <text y="28" class="lbl lbl-party">{{ p.name }}</text>
          </g>
        </g>

        <!-- Повтор маршрута (анимация для показа на сессии) -->
        <g v-if="replayPos" :transform="`translate(${replayPos.x},${replayPos.y}) scale(${1 / view.k})`" :style="{ color: store.replay.color }">
          <circle r="16" class="party-pulse" />
          <circle r="11" class="party-bg" />
        </g>

        <!-- Редактор: черновики -->
        <g class="editor" pointer-events="none">
          <path v-if="plan" :d="toPath(plan.points)" class="plan-path" vector-effect="non-scaling-stroke" />
          <g v-for="(w, i) in store.journeyPlan?.waypoints || []" :key="'wp' + i" :transform="`translate(${w[0]},${w[1]}) scale(${1 / view.k})`">
            <circle r="6" class="wp" />
            <text y="4" class="wp-n">{{ i + 1 }}</text>
          </g>

          <template v-if="store.draft?.kind === 'road'">
            <path :d="toPath(cursor ? [...store.draft.points, cursor] : store.draft.points)" class="draft-road" vector-effect="non-scaling-stroke" />
            <circle v-for="(pt, i) in store.draft.points" :key="'d' + i" :cx="pt[0]" :cy="pt[1]" :r="3 / view.k" class="draft-pt" />
          </template>
          <path v-if="store.draft?.kind === 'lasso'" :d="toPath(store.draft.points) + 'Z'" class="draft-lasso" vector-effect="non-scaling-stroke" />
          <path v-if="store.draft?.kind === 'brush'" :d="toPath(store.draft.points)" class="draft-brush"
                :stroke-width="store.brush * 2" :class="store.draft.mode" />

          <circle v-if="cursor && isBrush" :cx="cursor[0]" :cy="cursor[1]" :r="store.brush" class="brush-cursor" vector-effect="non-scaling-stroke" />
          <line v-if="cursor && store.pick" :x1="pickFrom[0]" :y1="pickFrom[1]" :x2="cursor[0]" :y2="cursor[1]" class="pick-line" vector-effect="non-scaling-stroke" />
        </g>

        <!-- Линейки: своя и линейки мастеров -->
        <g v-for="r in rulers" :key="r.key" class="ruler" :style="{ color: r.color }" pointer-events="none">
          <path :d="toPath(r.points)" class="ruler-casing" vector-effect="non-scaling-stroke" />
          <path :d="toPath(r.points)" class="ruler-line" vector-effect="non-scaling-stroke" />
          <circle v-for="(pt, i) in r.points" :key="i" :cx="pt[0]" :cy="pt[1]" :r="3.5 / view.k" class="ruler-pt" />
          <g :transform="`translate(${r.end[0]},${r.end[1]}) scale(${1 / view.k})`">
            <rect x="10" y="-30" :width="r.labelW" height="38" rx="8" class="ruler-tag" />
            <text x="20" y="-14" class="ruler-km">{{ r.km }}</text>
            <text x="20" y="1" class="ruler-sub">{{ r.sub }}</text>
          </g>
        </g>

        <!-- Пинги -->
        <g v-for="p in store.presence.pings" :key="p.key" :transform="`translate(${p.x},${p.y}) scale(${1 / view.k})`"
           :class="['ping', 'ping-' + p.kind]" :style="{ color: p.kind === 'danger' ? '#ff4a3d' : p.color }" pointer-events="none">
          <circle r="12" class="ping-ring" />
          <circle r="12" class="ping-ring d2" />
          <circle r="12" class="ping-ring d3" />
          <g class="ping-drop">
            <path :d="p.kind === 'danger' ? ICONS.danger : ICONS.ping" transform="translate(-11,-36) scale(0.92)" class="ping-icon" />
          </g>
          <circle r="4.5" class="ping-dot" />
          <text y="24" class="ping-name">{{ p.name }}</text>
        </g>

        <!-- Курсоры мастеров -->
        <template v-if="L.cursors">
          <g v-for="c in cursors" :key="c.id" :transform="`translate(${c.x},${c.y}) scale(${1 / view.k})`" class="rcursor" :style="{ color: c.color }" pointer-events="none">
            <path d="M0,0 L0,18 L4.8,13.6 L8,21 L11,19.7 L7.8,12.6 L14,12.6 Z" class="rcursor-arrow" />
            <rect x="13" y="15" :width="c.name.length * 7.2 + 14" height="19" rx="6" class="rcursor-tag" />
            <text x="20" y="28.5" class="rcursor-name">{{ c.name }}</text>
          </g>
        </template>

        <!-- Ручки редактирования выбранного объекта -->
        <g v-if="master && store.tool === 'select'" class="handles">
          <template v-if="selRoad">
            <circle v-for="(pt, i) in selRoad.points" :key="'h' + i" :cx="pt[0]" :cy="pt[1]" :r="5 / view.k" :data-handle="'vertex:' + i" class="handle" />
          </template>
          <circle v-if="selZone" :cx="selZoneState.x + selZone.radius" :cy="selZoneState.y" :r="6 / view.k" data-handle="radius" class="handle handle-radius" />
        </g>
      </g>
    </svg>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import AnomalyZone from './AnomalyZone.vue'
import MapLabel from './MapLabel.vue'
import { ICONS } from './icons.js'
import { fogTexture } from './fogTexture.js'
import { store, isMaster, act, toast, planPath, sendCursor, sendCursorLeave, sendRuler, ping, km, fmtKm } from './store.js'
import { ROAD_TYPES, ZONE_EFFECTS, POINT_EFFECTS, PARTY_COLORS } from '../shared/catalog.js'
import { toPath, partyPosition, anomalyState, slicePath, remainingPath, pointAt, dist, polyLength } from '../shared/geo.js'

const wrap = ref(null)
const svg = ref(null)
const size = reactive({ w: 800, h: 600 })
const view = reactive({ x: 0, y: 0, k: 1 })
const cursor = ref(null)
const hoverState = ref(null)
const gesture = ref(null)
const frameNow = ref(Date.now())
const fogTex = fogTexture()

const W = computed(() => store.data.settings.width || 2048)
const H = computed(() => store.data.settings.height || 1024)
const L = computed(() => store.layers)
const master = computed(() => isMaster.value)
const plan = planPath
const activeTool = computed(() => (store.journeyPlan ? 'journey' : store.pick ? 'pick' : store.tool))
const isBrush = computed(() => master.value && ['fogBrush', 'fogErase'].includes(store.tool))
const now = computed(() => Math.max(store.now, frameNow.value + store.clockOffset))

// Мягкий край тумана: несколько проходов с убывающей непрозрачностью
const SOFT = [{ w: 1.5, o: 0.25 }, { w: 1.25, o: 0.45 }, { w: 1, o: 1 }]

const isSel = (type, id) => store.selection?.type === type && store.selection?.id === id

/* ---------------- Подготовка данных для отрисовки ---------------- */

const statesById = computed(() => Object.fromEntries(store.data.states.map(s => [s.id, s])))
const statePaths = computed(() => store.statePaths.filter(p => statesById.value[p.stateId]).map(p => ({ ...p, color: statesById.value[p.stateId].color })))

const roads = computed(() => store.data.roads.map(r => ({ ...r, d: toPath(r.points), style: ROAD_TYPES[r.type] || ROAD_TYPES.road })))

// На общем плане — только столицы и города, мелочь появляется при приближении
const MAJOR = ['capital', 'city', 'fort']
const iconScale = computed(() => Math.max(0.55, Math.min(1, view.k / 1.1)))
const visibleCities = computed(() => {
  const k = view.k
  return store.data.cities
    .filter(c => MAJOR.includes(c.type) || (L.value.towns && k > 0.95) || isSel('cities', c.id))
    .map(c => ({
      ...c,
      showLabel: isSel('cities', c.id) || (c.type === 'capital' && k > 0.7) || (MAJOR.includes(c.type) && k > 1.3) || k > 2.4
    }))
})

const anomalies = computed(() => store.data.anomalies.map(a => ({ ...a, st: anomalyState(a, now.value) })))
const zones = computed(() => anomalies.value.filter(a => a.kind === 'zone'))
const movingZones = computed(() => zones.value.filter(z => z.toX != null && z.toY != null))
const points = computed(() => anomalies.value.filter(a => a.kind === 'point').map(a => ({ ...a, fx: POINT_EFFECTS[a.effect] || POINT_EFFECTS.unknown })))

const parties = computed(() => store.data.parties.map(p => {
  const pos = partyPosition(p, now.value)
  const j = pos.journey
  const out = { ...p, pos, moving: !!(j && !j.waiting && !j.done) }
  if (p.journey && j) {
    out.done = toPath(slicePath(p.journey.path, j.progress))
    out.todo = toPath(remainingPath(p.journey.path, j.progress))
    out.dest = p.journey.path[p.journey.path.length - 1]
  }
  return out
}))

/* ---------------- Подписи, сетка, линейки, курсоры ---------------- */
const stateLabels = computed(() => store.data.states.filter(s => s.label && s.name))

const grid = computed(() => store.data.settings.grid || { cellKm: 10, type: 'square' })
const gridPx = computed(() => Math.max(1, grid.value.cellKm / (store.data.settings.kmPerPx || 1)))
const gridOn = computed(() => master.value && L.value.grid)
// шестиугольники «острым углом вверх»: ширина клетки (между гранями) = размер клетки
const hex = computed(() => {
  const w = gridPx.value, r = w / Math.sqrt(3)
  return {
    w, h: 3 * r,
    d: `M${w / 2},0 L${w},${r / 2} L${w},${1.5 * r} L${w / 2},${2 * r} L0,${1.5 * r} L0,${r / 2} Z M${w / 2},${2 * r} L${w / 2},${3 * r}`
  }
})

const travelText = px => {
  const days = km(px) / (store.data.settings.paceKmPerDay || 38)
  return days < 1 ? `${Math.max(1, Math.round(days * 24))} ч` : `${days.toFixed(1)} дн.`
}

function rulerInfo(points, color, key) {
  const len = polyLength(points)
  const kmText = fmtKm(len)
  const sub = (points.length > 2 ? `${points.length - 1} отр. · ` : '') + `≈ ${travelText(len)} пути`
  return { key, color, points, end: points[points.length - 1], km: kmText, sub, labelW: Math.max(kmText.length * 9, sub.length * 6.4) + 22 }
}

// своя линейка: зафиксированные точки + текущая позиция курсора
const ownRulerPoints = computed(() => {
  const r = store.ruler
  if (!r) return null
  const pts = !r.done && !r.drag && cursor.value && store.tool === 'ruler' ? [...r.points, cursor.value] : r.points
  return pts.length > 1 ? pts : null
})
const rulers = computed(() => {
  const out = []
  if (ownRulerPoints.value) out.push(rulerInfo(ownRulerPoints.value, '#ffe08a', 'own'))
  for (const [id, r] of Object.entries(store.presence.rulers)) if (r.points?.length > 1) out.push(rulerInfo(r.points, r.color, id))
  return out
})

// линейку мастера видят все — отправляем не чаще ~12 раз в секунду
let rulerTimer = null
watch(ownRulerPoints, () => {
  if (rulerTimer) return
  rulerTimer = setTimeout(() => {
    rulerTimer = null
    sendRuler(ownRulerPoints.value)
  }, 80)
})

const cursors = computed(() => Object.entries(store.presence.cursors).map(([id, c]) => ({ id, ...c })))

const fogShapes = computed(() => store.data.fog.map(f => ({
  ...f,
  d: toPath(f.points) + (f.shape === 'poly' ? 'Z' : ''),
  color: f.mode === 'add' ? '#fff' : '#000'
})))
const fogVisible = computed(() => store.data.settings.fogEnabled && L.value.fog && store.data.fog.length)

const selRoad = computed(() => (store.selection?.type === 'roads' ? store.data.roads.find(r => r.id === store.selection.id) : null))
const selZone = computed(() => {
  if (store.selection?.type !== 'anomalies') return null
  const a = store.data.anomalies.find(x => x.id === store.selection.id)
  return a && a.kind === 'zone' ? a : null
})
const selZoneState = computed(() => (selZone.value ? anomalyState(selZone.value, now.value) : null))

const pickFrom = computed(() => {
  const a = store.pick && store.data.anomalies.find(x => x.id === store.pick.id)
  return a ? [a.x, a.y] : [0, 0]
})

const replayPos = computed(() => {
  const r = store.replay
  if (!r) return null
  const t = (frameNow.value - r.t0) / r.duration
  return t >= 1 ? null : pointAt(r.path, t)
})

/* ---------------- Анимация: обновляем время чаще, когда что-то движется ---------------- */
let raf = 0
let lastFrame = 0
function loop(ts) {
  raf = requestAnimationFrame(loop)
  const moving = store.replay || parties.value.some(p => p.moving)
  if (!moving) return
  const interval = store.replay ? 16 : 200
  if (ts - lastFrame < interval) return
  lastFrame = ts
  frameNow.value = Date.now()
  if (store.replay && frameNow.value - store.replay.t0 > store.replay.duration) store.replay = null
}

/* ---------------- Вид: зум, панорама ---------------- */
const fitScale = () => Math.min(size.w / W.value, size.h / H.value)

function clampView() {
  const k = view.k
  const mw = W.value * k, mh = H.value * k
  const padX = size.w * 0.6, padY = size.h * 0.6
  view.x = Math.min(padX, Math.max(size.w - mw - padX, view.x))
  view.y = Math.min(padY, Math.max(size.h - mh - padY, view.y))
}

function zoomAt(sx, sy, factor) {
  const k = Math.max(fitScale() * 0.7, Math.min(24, view.k * factor))
  const f = k / view.k
  view.x = sx - (sx - view.x) * f
  view.y = sy - (sy - view.y) * f
  view.k = k
  clampView()
}

let anim = 0
function animateTo(target, ms = 600) {
  cancelAnimationFrame(anim)
  const from = { ...view }
  const t0 = performance.now()
  const step = t => {
    const p = Math.min(1, (t - t0) / ms)
    const e = 1 - Math.pow(1 - p, 3)
    view.x = from.x + (target.x - from.x) * e
    view.y = from.y + (target.y - from.y) * e
    view.k = from.k + (target.k - from.k) * e
    if (p < 1) anim = requestAnimationFrame(step)
  }
  anim = requestAnimationFrame(step)
}

function fit(animated = true) {
  const k = fitScale() * 0.96
  const target = { k, x: (size.w - W.value * k) / 2, y: (size.h - H.value * k) / 2 }
  animated ? animateTo(target) : Object.assign(view, target)
}

function flyTo(x, y, k = Math.max(view.k, 3)) {
  animateTo({ k, x: size.w / 2 - x * k, y: size.h / 2 - y * k })
}

function zoomBy(f) {
  zoomAt(size.w / 2, size.h / 2, f)
}

defineExpose({ fit, flyTo, zoomBy, view })

function toWorld(e) {
  const rect = svg.value.getBoundingClientRect()
  return [(e.clientX - rect.left - view.x) / view.k, (e.clientY - rect.top - view.y) / view.k]
}

/* ---------------- Ввод ---------------- */
const pointers = new Map()

function hitInfo(target) {
  const handle = target.closest?.('[data-handle]')
  if (handle) return { handle: handle.getAttribute('data-handle') }
  const obj = target.closest?.('[data-obj]')
  if (obj) {
    const [type, id] = obj.getAttribute('data-obj').split(':')
    return { type, id }
  }
  return {}
}

const DRAGGABLE = ['cities', 'anomalies', 'parties', 'labels', 'statelabel']
const LONG_PRESS = 550
let pressTimer = null
const clearPress = () => { clearTimeout(pressTimer); pressTimer = null }

function itemFor(hit) {
  if (hit.type === 'statelabel') return store.data.states.find(s => s.id === hit.id)
  return store.data[hit.type]?.find(x => x.id === hit.id)
}

function onDown(e) {
  svg.value.setPointerCapture(e.pointerId)
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()]
    gesture.value = { mode: 'pinch', d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 }
    store.draft = store.draft?.kind === 'road' ? store.draft : null
    return
  }
  const w = toWorld(e)
  const hit = hitInfo(e.target)
  const base = { sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY, w, hit, moved: false }

  // Alt+клик — пинг (Alt+Shift — «опасность»)
  if (e.button === 0 && e.altKey) {
    ping(w[0], w[1], e.shiftKey ? 'danger' : 'look')
    return
  }
  if (e.button === 0 && store.tool === 'ruler' && !store.journeyPlan && !store.pick) {
    gesture.value = { ...base, mode: 'ruler' }
    return
  }
  // долгое нажатие — пинг (удобно с телефона)
  clearPress()
  if (e.button === 0) {
    pressTimer = setTimeout(() => {
      const g = gesture.value
      if (g && !g.moved && ['pan', 'maybeDrag'].includes(g.mode)) {
        ping(g.w[0], g.w[1])
        g.mode = 'pinged'
      }
    }, LONG_PRESS)
  }

  if (e.button === 1 || e.button === 2) {
    gesture.value = { ...base, mode: 'pan' }
    return
  }
  if (master.value && !store.journeyPlan && !store.pick) {
    if (['fogBrush', 'fogErase'].includes(store.tool)) {
      store.draft = { kind: 'brush', mode: store.tool === 'fogBrush' ? 'add' : 'erase', points: [w] }
      gesture.value = { ...base, mode: 'brush' }
      return
    }
    if (['fogLasso', 'fogLassoErase'].includes(store.tool)) {
      store.draft = { kind: 'lasso', mode: store.tool === 'fogLasso' ? 'add' : 'erase', points: [w] }
      gesture.value = { ...base, mode: 'lasso' }
      return
    }
    if (store.tool === 'select' && hit.handle) {
      gesture.value = { ...base, mode: 'handle' }
      return
    }
    if (store.tool === 'select' && DRAGGABLE.includes(hit.type)) {
      const item = itemFor(hit)
      const canDrag = item && !(hit.type === 'parties' && item.journey)
      gesture.value = { ...base, mode: canDrag ? 'maybeDrag' : 'pan', item }
      return
    }
  }
  gesture.value = { ...base, mode: 'pan' }
}

function onLeave() {
  cursor.value = null
  sendCursorLeave()
}

function onMove(e) {
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
  const w = toWorld(e)
  cursor.value = w
  if (master.value && e.pointerType !== 'touch') sendCursor(w[0], w[1])
  const g = gesture.value
  if (!g) return

  if (g.mode === 'pinch') {
    if (pointers.size < 2) return
    const [a, b] = [...pointers.values()]
    const d = Math.hypot(a.x - b.x, a.y - b.y)
    const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2
    const rect = svg.value.getBoundingClientRect()
    view.x += cx - g.cx
    view.y += cy - g.cy
    zoomAt(cx - rect.left, cy - rect.top, d / g.d)
    Object.assign(g, { d, cx, cy })
    return
  }

  const dx = e.clientX - g.lx, dy = e.clientY - g.ly
  g.lx = e.clientX
  g.ly = e.clientY
  if (!g.moved && Math.hypot(e.clientX - g.sx, e.clientY - g.sy) > 4) {
    g.moved = true
    clearPress()
  }

  if (g.mode === 'pan' && g.moved) {
    view.x += dx
    view.y += dy
    clampView()
  } else if (g.mode === 'brush') {
    const pts = store.draft.points
    if (dist(pts[pts.length - 1], w) > store.brush / 4) pts.push(w)
  } else if (g.mode === 'lasso') {
    const pts = store.draft.points
    if (dist(pts[pts.length - 1], w) > 3 / view.k) pts.push(w)
  } else if (g.mode === 'ruler' && g.moved) {
    // протяжка — быстрый замер по прямой
    if (!g.dragRuler) {
      g.dragRuler = true
      store.ruler = { points: [g.w, w], done: false, drag: true }
    } else store.ruler.points[1] = w
  } else if (g.mode === 'maybeDrag' && g.moved) {
    g.mode = 'drag'
    // тянем за то место, где схватили, а не за центр
    const target = g.hit.type === 'statelabel' ? g.item.label : g.item
    g.off = [target.x - g.w[0], target.y - g.w[1]]
  }
  if (g.mode === 'drag') {
    const target = g.hit.type === 'statelabel' ? g.item.label : g.item
    target.x = Math.round((w[0] + g.off[0]) * 10) / 10
    target.y = Math.round((w[1] + g.off[1]) * 10) / 10
  } else if (g.mode === 'handle' && g.moved) {
    if (g.hit.handle.startsWith('vertex:') && selRoad.value) {
      selRoad.value.points[Number(g.hit.handle.slice(7))] = [Math.round(w[0] * 10) / 10, Math.round(w[1] * 10) / 10]
    } else if (g.hit.handle === 'radius' && selZone.value) {
      selZone.value.radius = Math.max(4, Math.round(dist([selZoneState.value.x, selZoneState.value.y], w)))
    }
  }
}

function onUp(e) {
  pointers.delete(e.pointerId)
  clearPress()
  const g = gesture.value
  if (!g) return
  if (g.mode === 'pinch') {
    if (pointers.size < 2) gesture.value = null
    return
  }
  gesture.value = null

  if (g.mode === 'brush' || g.mode === 'lasso') return finishFog(g.mode)
  if (g.mode === 'pinged') return
  if (g.mode === 'ruler') {
    if (g.dragRuler) store.ruler.done = true
    else onRulerClick(toWorld(e))
    return
  }
  if (g.mode === 'drag') {
    const { item, hit } = g
    if (hit.type === 'statelabel') act('PATCH', `/api/states/${item.id}`, { label: item.label }).catch(() => {})
    else act('PATCH', `/api/${hit.type}/${item.id}`, { x: item.x, y: item.y }).catch(() => {})
    return
  }
  if (g.mode === 'handle') {
    if (!g.moved) return
    if (selRoad.value && g.hit.handle.startsWith('vertex:')) act('PATCH', `/api/roads/${selRoad.value.id}`, { points: selRoad.value.points }).catch(() => {})
    if (selZone.value && g.hit.handle === 'radius') act('PATCH', `/api/anomalies/${selZone.value.id}`, { radius: selZone.value.radius }).catch(() => {})
    return
  }
  if (!g.moved && (g.mode === 'pan' || g.mode === 'maybeDrag')) onClick(toWorld(e), g.hit)
}

function onCancel(e) {
  pointers.delete(e.pointerId)
  gesture.value = null
  if (store.draft && store.draft.kind !== 'road') store.draft = null
}

function onWheel(e) {
  const rect = svg.value.getBoundingClientRect()
  zoomAt(e.clientX - rect.left, e.clientY - rect.top, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)))
}

function onDblClick() {
  if (store.draft?.kind === 'road') finishRoad()
  if (store.tool === 'ruler' && store.ruler && !store.ruler.done) {
    // второй клик двойного клика добавил лишнюю точку — убираем её
    if (store.ruler.points.length > 2) store.ruler.points.pop()
    store.ruler.done = true
  }
}

function onRulerClick(w) {
  if (!store.ruler || store.ruler.done) store.ruler = { points: [w], done: false }
  else store.ruler.points.push(w)
}

/* ---------------- Действия ---------------- */

async function onClick(w, hit) {
  const r1 = p => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]
  // Планирование пути отряда
  if (store.journeyPlan) {
    store.journeyPlan.waypoints.push(r1(w))
    return
  }
  // Выбор точки для аномалии (куда движется)
  if (store.pick) {
    const { id } = store.pick
    store.pick = null
    await act('PATCH', `/api/anomalies/${id}`, { toX: r1(w)[0], toY: r1(w)[1] }, 'Направление движения задано').catch(() => {})
    return
  }
  if (store.tool === 'ping') {
    ping(w[0], w[1])
    return
  }
  if (master.value) {
    const [x, y] = r1(w)
    const create = async (col, body, text) => {
      try {
        const item = await act('POST', `/api/${col}`, body, text)
        store.selection = { type: col, id: item.id }
        store.tool = 'select'
      } catch { /* показано тостом */ }
    }
    switch (store.tool) {
      case 'city': return create('cities', { name: 'Новый город', x, y, type: 'town', stateId: hit.type === 'states' ? hit.id : null }, 'Город добавлен')
      case 'zone': return create('anomalies', { kind: 'zone', effect: 'storm', name: 'Новая аномалия', x, y, radius: 25 }, 'Аномалия добавлена')
      case 'point': return create('anomalies', { kind: 'point', effect: 'portal', name: 'Новое место', x, y }, 'Место добавлено')
      case 'label': return create('labels', { text: 'Новая подпись', x, y, size: 18, style: 'land' }, 'Подпись добавлена')
      case 'party': return create('parties', { name: 'Новый отряд', x, y, color: PARTY_COLORS[store.data.parties.length % PARTY_COLORS.length] }, 'Отряд добавлен')
      case 'road':
        if (!store.draft || store.draft.kind !== 'road') store.draft = { kind: 'road', points: [] }
        store.draft.points.push([x, y])
        return
    }
  }
  if (hit.type === 'statelabel') store.selection = { type: 'states', id: hit.id }
  else store.selection = hit.type ? { type: hit.type, id: hit.id } : null
}

async function finishRoad() {
  const pts = store.draft.points.filter((p, i, arr) => i === 0 || dist(p, arr[i - 1]) > 0.5)
  store.draft = null
  if (pts.length < 2) return toast('Дорога — минимум две точки', 'error')
  try {
    const road = await act('POST', '/api/roads', { points: pts, type: 'road', name: '' }, 'Дорога проложена')
    store.selection = { type: 'roads', id: road.id }
    store.tool = 'select'
  } catch { /* тост */ }
}

async function finishFog(mode) {
  const d = store.draft
  store.draft = null
  if (!d) return
  const shape = mode === 'lasso' ? 'poly' : 'stroke'
  if (shape === 'poly' && d.points.length < 3) return
  const body = { mode: d.mode, shape, r: shape === 'poly' ? 0 : store.brush, points: d.points }
  const temp = { id: 'tmp' + Math.random(), ...body }
  store.data.fog.push(temp) // сразу показываем, сервер пришлёт итог
  try {
    const f = await act('POST', '/api/fog', body)
    store.fogUndo.push(f.id)
  } catch {
    store.data.fog = store.data.fog.filter(x => x !== temp)
  }
}

function onKey(e) {
  if (e.target.closest?.('input, textarea, select, [contenteditable]')) return
  if (e.key === 'Escape') {
    if (store.ruler) { store.ruler = null; return }
    if (store.draft) store.draft = null
    else if (store.pick) store.pick = null
    else if (store.journeyPlan) store.journeyPlan = null
    else if (store.tool !== 'select') store.tool = 'select'
    else store.selection = null
  } else if (e.key === 'Enter' && store.ruler && !store.ruler.done) {
    store.ruler.done = true
  } else if (e.key === 'Enter' && store.draft?.kind === 'road') {
    finishRoad()
  } else if (e.key === 'Backspace' && store.draft?.kind === 'road') {
    store.draft.points.pop()
  } else if (e.key === 'Backspace' && store.journeyPlan) {
    store.journeyPlan.waypoints.pop()
  } else if (e.key === '+' || e.key === '=') zoomBy(1.4)
  else if (e.key === '-') zoomBy(1 / 1.4)
}

/* ---------------- Жизненный цикл ---------------- */
let ro
let fitted = false
onMounted(() => {
  ro = new ResizeObserver(([entry]) => {
    size.w = entry.contentRect.width
    size.h = entry.contentRect.height
    if (!fitted && size.w > 0) {
      fit(false)
      fitted = true
    } else clampView()
  })
  ro.observe(wrap.value)
  window.addEventListener('keydown', onKey)
  raf = requestAnimationFrame(loop)
})
onBeforeUnmount(() => {
  ro?.disconnect()
  window.removeEventListener('keydown', onKey)
  cancelAnimationFrame(raf)
  cancelAnimationFrame(anim)
})

// при смене инструмента сбрасываем незавершённый черновик
watch(() => store.tool, t => {
  store.draft = null
  if (t !== 'ruler' && store.ruler && !store.ruler.done) store.ruler = null
})
</script>

<style scoped>
.canvas-wrap { position: absolute; inset: 0; overflow: hidden; background: #466eab radial-gradient(ellipse at center, transparent 55%, rgba(8, 14, 30, .45)); touch-action: none; user-select: none; cursor: grab; }
.canvas-wrap.panning { cursor: grabbing; }
.tool-city, .tool-zone, .tool-point, .tool-party, .tool-road, .tool-journey, .tool-pick, .tool-fogLasso, .tool-fogLassoErase { cursor: crosshair; }
.tool-fogBrush, .tool-fogErase { cursor: none; }
.map-svg { display: block; }

.state-hits path { fill: var(--sc); fill-opacity: 0; stroke: none; cursor: pointer; transition: fill-opacity .15s; }
.state-hits path.hovered { fill-opacity: 0.12; }
.state-hits path.selected { fill-opacity: 0.2; stroke: #ffe08a; stroke-width: 1.2; stroke-dasharray: 4 3; }

.road { fill: none; stroke-linecap: round; stroke-linejoin: round; pointer-events: none; }
.road-hit { fill: none; stroke: transparent; stroke-width: 6; cursor: pointer; pointer-events: stroke; }
.road-sel { fill: none; stroke: #ffe08a; stroke-width: 5; stroke-opacity: 0.55; pointer-events: none; }
.is-hidden { opacity: 0.45; }
.anomaly-track { stroke: #fff; stroke-opacity: 0.6; stroke-width: 1.2; stroke-dasharray: 2 4; }

.labels-img { pointer-events: none; }

.fog { pointer-events: none; }
.fog-master { opacity: 0.5; }

.city { cursor: pointer; }
.city-ring { fill: #f6ecd6; stroke: #3b2a1a; stroke-width: 1.6; }
.city-capital .city-ring { fill: #2a1d12; stroke: #e7c56f; stroke-width: 2; }
.city-glyph { fill: #e7c56f; }
.city-ruins { fill: #6b5a48; stroke: #f6ecd6; stroke-width: 1.2; paint-order: stroke; }
.city-dot { fill: #2a1d12; stroke: #f6ecd6; stroke-width: 1.4; }
.sel-ring { fill: none; stroke: #ffe08a; stroke-width: 2; stroke-dasharray: 4 3; animation: spin 8s linear infinite; }

.lbl { font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 700; text-anchor: middle; fill: #23180e; stroke: #f8f0de; stroke-width: 3.5px; paint-order: stroke; stroke-linejoin: round; pointer-events: none; }
.lbl-capital { font-size: 16px; letter-spacing: .02em; }
.lbl-city, .lbl-fort { font-size: 14px; }
.lbl-town, .lbl-village, .lbl-ruins { font-size: 12.5px; font-weight: 600; }
.lbl-poi { font-size: 13px; fill: #fff; stroke: #120d1f; }
.lbl-party { font-family: 'Manrope', sans-serif; font-size: 12px; font-weight: 800; fill: #fff; stroke: #0b0f17; stroke-width: 3.5px; }

.poi { cursor: pointer; }
.poi.faded { opacity: 0.4; }
.poi-bg { fill: #120d1f; stroke: currentColor; stroke-width: 2; }
.poi-glow { animation: glow 3s ease-in-out infinite; }

.party { cursor: pointer; }
.party-bg { fill: currentColor; stroke: #0b0f17; stroke-width: 2.5; }
.party-glyph { fill: #0b0f17; }
.party-pulse { fill: none; stroke: currentColor; stroke-width: 2; animation: pulse 1.8s ease-out infinite; }
.journey-done { fill: none; stroke-width: 3; stroke-opacity: 0.45; stroke-linecap: round; stroke-linejoin: round; }
.journey-todo { fill: none; stroke-width: 2.5; stroke-dasharray: 6 5; stroke-linecap: round; stroke-linejoin: round; animation: march 1s linear infinite; }
.dest-flag { stroke: #0b0f17; stroke-width: 1.5; paint-order: stroke; }

.plan-path { fill: none; stroke: #ffe08a; stroke-width: 3; stroke-dasharray: 7 5; animation: march 1s linear infinite; }
.wp { fill: #ffe08a; stroke: #2a1d12; stroke-width: 1.5; }
.wp-n { font: 800 9px Manrope, sans-serif; text-anchor: middle; fill: #2a1d12; }
.draft-road { fill: none; stroke: #ffb35a; stroke-width: 2.5; stroke-dasharray: 5 4; }
.draft-pt { fill: #ffb35a; stroke: #2a1d12; }
.draft-lasso { fill: rgba(159, 180, 255, .18); stroke: #c3d0ff; stroke-width: 1.5; stroke-dasharray: 4 3; }
.draft-brush { fill: none; stroke-linecap: round; stroke-linejoin: round; opacity: .45; }
.draft-brush.add { stroke: #c3d0ff; }
.draft-brush.erase { stroke: #ff9b9b; }
.brush-cursor { fill: rgba(255, 255, 255, .08); stroke: #fff; stroke-width: 1.5; stroke-dasharray: 3 3; }
.pick-line { stroke: #ffe08a; stroke-width: 1.5; stroke-dasharray: 4 4; }

.handle { fill: #ffe08a; stroke: #2a1d12; stroke-width: 0.6; cursor: move; }
.handle-radius { fill: #fff; cursor: ew-resize; }

.grid { pointer-events: none; }
.grid-line { stroke: rgba(255, 255, 255, 0.55); }

.ruler-casing { fill: none; stroke: rgba(11, 15, 23, 0.7); stroke-width: 5; stroke-linecap: round; stroke-linejoin: round; }
.ruler-line { fill: none; stroke: currentColor; stroke-width: 2.5; stroke-dasharray: 8 5; stroke-linecap: round; stroke-linejoin: round; }
.ruler-pt { fill: currentColor; stroke: #0b0f17; stroke-width: 0.6; }
.ruler-tag { fill: rgba(13, 16, 23, 0.9); stroke: currentColor; stroke-width: 1.2; }
.ruler-km { font: 800 15px Manrope, sans-serif; fill: currentColor; }
.ruler-sub { font: 600 11px Manrope, sans-serif; fill: #c9c2b4; }

.ping-ring { fill: none; stroke: currentColor; stroke-width: 3; animation: ping-ring 1.4s ease-out 3; }
.ping-ring.d2 { animation-delay: .35s; opacity: 0; }
.ping-ring.d3 { animation-delay: .7s; opacity: 0; }
.ping-dot { fill: currentColor; stroke: #0b0f17; stroke-width: 2; }
.ping-icon { fill: currentColor; stroke: #0b0f17; stroke-width: 1.4; paint-order: stroke; }
.ping-drop { animation: ping-drop .45s cubic-bezier(.3, 1.6, .5, 1); }
.ping-name { font: 800 12px Manrope, sans-serif; text-anchor: middle; fill: #fff; stroke: #0b0f17; stroke-width: 3.5px; paint-order: stroke; }
.ping { animation: ping-fade 4.2s ease-in forwards; }

.rcursor-arrow { fill: currentColor; stroke: #0b0f17; stroke-width: 1.4; stroke-linejoin: round; }
.rcursor-tag { fill: currentColor; }
.rcursor-name { font: 800 11.5px Manrope, sans-serif; fill: #0b0f17; }

@keyframes ping-ring { from { transform: scale(0.4); opacity: 1; } to { transform: scale(4); opacity: 0; } }
@keyframes ping-drop { from { transform: translateY(-14px) scale(1.3); opacity: 0; } }
@keyframes ping-fade { 0%, 80% { opacity: 1; } 100% { opacity: 0; } }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes pulse { from { transform: scale(0.8); opacity: 1; } to { transform: scale(1.9); opacity: 0; } }
@keyframes glow { 50% { opacity: 0.45; } }
@keyframes march { to { stroke-dashoffset: -11; } }
</style>
