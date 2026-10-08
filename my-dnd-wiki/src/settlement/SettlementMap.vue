<template>
  <div ref="box" class="sm" :class="[{ grabbing: panning }, toolClass]" @wheel.prevent="onWheel" @mousedown="e => e.button === 1 && e.preventDefault()" @contextmenu.prevent
       @pointerdown="onDown" @pointermove="onMove" @pointerup="onUp" @pointercancel="onUp" @pointerleave="onLeave" @dblclick="onDbl">
    <!-- местность: плитки на холсте под всем остальным -->
    <canvas ref="cv" class="sm-tiles" />
    <svg v-if="size.w" :width="size.w" :height="size.h" class="sm-svg">
      <defs>
        <!-- туман: облачная текстура постоянного экранного размера, края разведанного размыты -->
        <pattern id="sm-fog" patternUnits="userSpaceOnUse" width="384" height="384" :patternTransform="`scale(${px})`">
          <rect width="384" height="384" fill="#4a4f52" />
          <image :href="fogUrl" width="384" height="384" opacity=".32" />
        </pattern>
        <filter id="sm-soft" filterUnits="userSpaceOnUse" :x="vb.x" :y="vb.y" :width="vb.w" :height="vb.h"><feGaussianBlur :stdDeviation="fogBlur" /></filter>
        <mask id="sm-fog-mask" maskUnits="userSpaceOnUse" :x="vb.x" :y="vb.y" :width="vb.w" :height="vb.h">
          <rect :x="vb.x" :y="vb.y" :width="vb.w" :height="vb.h" fill="#fff" />
          <g filter="url(#sm-soft)" fill="#000">
            <template v-for="(e, i) in settlement.explored" :key="i">
              <circle v-if="e.r" :cx="e.x" :cy="e.y" :r="e.r" />
              <polygon v-else-if="e.points" :points="e.points.map(p => p.join(',')).join(' ')" />
            </template>
          </g>
        </mask>
        <pattern id="sm-furrows" patternUnits="userSpaceOnUse" width="3" height="3" patternTransform="rotate(-8)">
          <rect width="3" height="3" fill="#c9b85a" />
          <rect width="3" height="1.1" fill="#a6963e" />
        </pattern>
        <filter id="sm-glow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="0" :stdDeviation="5 * px" flood-color="#ffe9a8" flood-opacity="1" /></filter>
      </defs>

      <g :transform="`translate(${view.x} ${view.y}) scale(${view.k})`">
        <!-- край карты -->
        <rect x="0" y="0" :width="WORLD" :height="WORLD" class="sm-world" vector-effect="non-scaling-stroke" />

        <!-- дороги: слоями по всем сразу (тени → кромки → покрытие с разметкой), главная ложится поверх второстепенной,
             поэтому перекрёстки сливаются; там, где дорога упирается в другую, — плавный раструб -->
        <g class="sm-roads">
          <path v-for="r in roadsDraw.filter(x => isSel('road', x.id))" :key="'g' + r.id" :d="r.d" class="rd" stroke="rgba(255, 236, 170, .55)" :stroke-width="r.st.edge.w + 8 * px" />
          <path v-for="r in roadsDraw" :key="'s' + r.id" :d="r.d" class="rd" :stroke="r.st.shadow.c" :stroke-width="r.st.shadow.w" />
          <template v-for="r in roadsDraw" :key="'e' + r.id">
            <path v-for="(f, i) in r.flares" :key="i" :d="f" :fill="r.st.edge.c" :stroke="r.st.edge.c" :stroke-width="r.st.edge.w - r.st.fill.w" stroke-linejoin="round" />
            <path :d="r.d" class="rd" :stroke="r.st.edge.c" :stroke-width="r.st.edge.w" />
          </template>
          <template v-for="r in roadsDraw" :key="'f' + r.id">
            <path v-for="(f, i) in r.flares" :key="i" :d="f" :fill="r.st.fill.c" />
            <path :d="r.d" class="rd" :stroke="r.st.fill.c" :stroke-width="r.st.fill.w" />
            <path v-for="(l, i) in r.st.extra" :key="'x' + i" :d="r.dInner" class="rd" :stroke="l.c" :stroke-width="l.w" :stroke-dasharray="l.dash" stroke-linecap="butt" />
          </template>
          <path v-for="r in roadsDraw" :key="'h' + r.id" :d="r.d" class="sm-road-hit" :stroke-width="Math.max(ROAD_TYPES[r.type]?.w || 4, 14 * px)"
                @pointerenter="hover = { kind: 'road', item: r }" @pointerleave="hover = null" @click.stop="pick('road', r)" />
        </g>
        <!-- стены: построенное — частокол или камень, ещё не построенное — пунктиром; проёмы ворот и калиток вырезаны -->
        <g class="sm-walls">
          <template v-for="w in wallsDraw" :key="w.id">
            <path v-if="isSel('wall', w.id)" :d="w.dAll" class="rd" stroke="rgba(255, 236, 170, .55)" :stroke-width="w.w + 8 * px" />
            <path v-for="(d, i) in w.plan" :key="'p' + i" :d="d" class="rd sm-wall-plan" :stroke-width="w.w" :stroke-dasharray="`${3 * px} ${2.5 * px}`" />
            <path v-for="(d, i) in w.done" :key="'e' + i" :d="d" class="rd" :stroke="w.st.edge" :stroke-width="w.w + w.st.edgeW" />
            <path v-for="(d, i) in w.done" :key="'b' + i" :d="d" class="rd" :stroke="w.st.body" :stroke-width="w.w" />
            <path v-for="(d, i) in w.done" :key="'t' + i" :d="d" class="rd" :stroke="w.st.top" :stroke-width="w.w * 0.55" :stroke-dasharray="w.st.dash" stroke-linecap="butt" />
            <g v-for="f in w.feats" :key="f.id" class="sm-wfeat" :class="[f.kind, { plan: !f.built }]" :transform="`translate(${f.x} ${f.y}) rotate(${f.deg})`"
               @pointerenter="hover = { kind: 'wallFeature', item: f, wall: w }" @pointerleave="hover = null" @click.stop="pick('wall', w)">
              <template v-if="f.kind === 'tower'">
                <rect :x="-f.side / 2" :y="-f.side / 2" :width="f.side" :height="f.side" :rx="f.side / 10" :fill="w.st.body" :stroke="w.st.edge" :stroke-width="Math.max(0.4, 1.5 * px)" />
                <rect :x="-f.side / 4" :y="-f.side / 4" :width="f.side / 2" :height="f.side / 2" :fill="w.st.top" />
              </template>
              <template v-else>
                <rect v-for="sx in [-1, 1]" :key="sx" :x="sx * f.len / 2 - f.post / 2" :y="-f.post / 2" :width="f.post" :height="f.post" :fill="w.st.edge" />
                <line :x1="-f.len / 2 + f.post / 2" :x2="f.len / 2 - f.post / 2" y1="0" y2="0" class="sm-door" :stroke-width="Math.max(0.35, w.w * 0.45)" :stroke-dasharray="`${Math.max(0.2, px)} ${Math.max(0.08, px * 0.4)}`" />
              </template>
            </g>
          </template>
          <path v-for="w in wallsDraw" :key="'h' + w.id" :d="w.dAll" class="sm-road-hit" :stroke-width="Math.max(w.w, 14 * px)"
                @pointerenter="hover = { kind: 'wall', item: w }" @pointerleave="hover = null" @click.stop="pick('wall', w)" />
        </g>
        <!-- дорога упирается в стену, а проёма нет — мастеру подсказка; щелчок ставит ворота -->
        <g v-if="master && !lineTool">
          <g v-for="(c, i) in needGates" :key="'ng' + i" class="sm-needgate" :transform="`translate(${c.x} ${c.y})`" @click.stop="emit('needGate', { wallId: c.wall.id, s: c.s })"
             @pointerenter="hover = { kind: 'needGate' }" @pointerleave="hover = null">
            <circle :r="9 * px" vector-effect="non-scaling-stroke" />
            <text :y="4 * px" :style="{ fontSize: 12 * px + 'px' }">!</text>
          </g>
        </g>
        <!-- куда встанут ворота, калитка или башня -->
        <g v-if="featureAim" class="sm-wfeat aim" :transform="`translate(${featureAim.x} ${featureAim.y}) rotate(${featureAim.deg})`">
          <rect v-if="tool.wallFeature === 'tower'" :x="-featureAim.side / 2" :y="-featureAim.side / 2" :width="featureAim.side" :height="featureAim.side" vector-effect="non-scaling-stroke" />
          <line v-else :x1="-featureAim.len / 2" :x2="featureAim.len / 2" y1="0" y2="0" :stroke-width="Math.max(1, 6 * px)" />
        </g>

        <!-- новая дорога или стена, пока её рисуют; кольцо — куда прилипнет точка -->
        <template v-if="lineTool">
          <path v-if="draft.length" :d="draftD" fill="none" class="sm-draft" :class="{ wall: tool.wall }" :stroke-width="draftW" />
          <circle v-for="(p, i) in draft" :key="i" :cx="p[0]" :cy="p[1]" :r="4 * px" class="sm-draft-pt" vector-effect="non-scaling-stroke" />
          <circle v-if="snapHint" :cx="snapHint[0]" :cy="snapHint[1]" :r="8 * px" class="sm-snap" vector-effect="non-scaling-stroke" />
        </template>
        <!-- какое дерево срубим -->
        <circle v-if="tool === 'fell' && fellTarget" :cx="fellTarget.x" :cy="fellTarget.y" :r="Math.max(fellTarget.r + 0.6, 6 * px)" class="sm-fell" vector-effect="non-scaling-stroke" />

        <!-- постройки в настоящем размере (издалека — не меньше значка) -->
        <g v-for="b in placedView" :key="b.id" class="sm-item" :class="{ sel: isSel('building', b.id), dragging: b.id === dragId, bad: b.id === dragId && dragBad.length, building: b.state === 'construction' }"
           :transform="`translate(${b.x} ${b.y})`" :data-id="b.id" data-kind="building"
           @pointerenter="hover = { kind: 'building', item: b }" @pointerleave="hover = null" @click.stop="pick('building', b)">
          <template v-if="b.type === 'field'">
            <rect :x="-shown(b) / 2" :y="-shown(b) / 2" :width="shown(b)" :height="shown(b)" :rx="shown(b) / 14" fill="url(#sm-furrows)" class="sm-field" vector-effect="non-scaling-stroke" />
            <image :href="iconUrl('wheat')" :x="-icon(b) / 2" :y="-icon(b) / 2" :width="icon(b)" :height="icon(b)" />
          </template>
          <template v-else>
            <rect :x="-shown(b) / 2" :y="-shown(b) / 2" :width="shown(b)" :height="shown(b)" :rx="shown(b) / 8" class="sm-plate" :class="{ personal: BUILDINGS[b.type]?.personal }"
                  :style="{ '--cat': CATEGORIES[BUILDINGS[b.type]?.cat]?.color }" vector-effect="non-scaling-stroke" />
            <image :href="iconUrl(BUILDINGS[b.type]?.icon)" :x="-icon(b) / 2" :y="-icon(b) / 2" :width="icon(b)" :height="icon(b)" />
          </template>
          <text v-if="b.name && shown(b) * view.k > 34" :y="shown(b) / 2 + 13 * px" class="sm-label name" :style="labelStyle">{{ b.name }}</text>
          <g v-if="b.state === 'construction'" :transform="`translate(0 ${shown(b) / 2 + 5 * px})`">
            <rect :x="-shown(b) / 2" :y="-2.5 * px" :width="shown(b)" :height="5 * px" :rx="2.5 * px" class="sm-prog-bg" />
            <rect :x="-shown(b) / 2" :y="-2.5 * px" :width="shown(b) * Math.min(1, (b.progress || 0) / (BUILDINGS[b.type]?.cost || 100))" :height="5 * px" :rx="2.5 * px" class="sm-prog" />
          </g>
        </g>

        <!-- приказы на рассмотрении: будущие постройки и разведка -->
        <g v-for="g in ghosts" :key="g.id" class="sm-ghost" :transform="`translate(${g.x} ${g.y})`">
          <circle v-if="g.explore" :r="g.r" class="sm-ghost-explore" vector-effect="non-scaling-stroke" />
          <template v-else>
            <rect :x="-ghostSide(g) / 2" :y="-ghostSide(g) / 2" :width="ghostSide(g)" :height="ghostSide(g)" :rx="ghostSide(g) / 8" class="sm-ghost-plate" vector-effect="non-scaling-stroke" />
            <image :href="iconUrl(BUILDINGS[g.type]?.icon)" :x="-ghostSide(g) * 0.39" :y="-ghostSide(g) * 0.39" :width="ghostSide(g) * 0.78" :height="ghostSide(g) * 0.78" opacity=".55" />
          </template>
          <text :y="(g.explore ? g.r : ghostSide(g) / 2) + 13 * px" class="sm-label ghost" :style="labelStyle">приказ</text>
        </g>

        <!-- ручки выбранной дороги: точки тянуть, середины — добавить точку, двойной щелчок по точке — убрать -->
        <g v-if="editRoad" class="sm-handles">
          <circle v-for="(p, i) in editRoad.points" :key="'v' + i" :cx="p[0]" :cy="p[1]" :r="6 * px" class="sm-handle" :data-h="i" vector-effect="non-scaling-stroke" />
          <circle v-for="(p, i) in editMids" :key="'m' + i" :cx="p[0]" :cy="p[1]" :r="4 * px" class="sm-handle mid" :data-m="i" vector-effect="non-scaling-stroke" />
        </g>

        <!-- курсор инструмента -->
        <g v-if="cursor && toolActive && !lineTool && !tool?.wallFeature" :transform="`translate(${cursor.x} ${cursor.y})`" class="sm-cursor" :class="{ bad: cursorBad.length }">
          <template v-if="placeType">
            <rect :x="-placeShown / 2" :y="-placeShown / 2" :width="placeShown" :height="placeShown" :rx="placeShown / 8" class="sm-ghost-plate" vector-effect="non-scaling-stroke" />
            <image :href="iconUrl(BUILDINGS[placeType]?.icon)" :x="-placeShown * 0.39" :y="-placeShown * 0.39" :width="placeShown * 0.78" :height="placeShown * 0.78" opacity=".8" />
          </template>
          <circle v-else-if="tool !== 'fell'" :r="brushR" class="sm-brush" :class="brushClass" vector-effect="non-scaling-stroke" />
        </g>

        <!-- туман неразведанного -->
        <rect :x="vb.x" :y="vb.y" :width="vb.w" :height="vb.h" fill="url(#sm-fog)" mask="url(#sm-fog-mask)" class="sm-fog" />
        <!-- аванпосты — поверх тумана: свои, их видно всегда; кругом — рабочая округа -->
        <g v-for="o in outpostsView" :key="o.id" class="sm-item" :class="{ sel: isSel('outpost', o.id) }" :transform="`translate(${o.x} ${o.y})`"
           :data-id="o.id" data-kind="outpost" @pointerenter="hover = { kind: 'outpost', item: o }" @pointerleave="hover = null" @click.stop="pick('outpost', o)">
          <circle r="150" class="sm-outpost-ring" :class="o.state" vector-effect="non-scaling-stroke" />
          <rect :x="-22 * px" :y="-22 * px" :width="44 * px" :height="44 * px" :rx="7 * px" class="sm-plate outpost" vector-effect="non-scaling-stroke" />
          <image :href="iconUrl(OUTPOSTS[o.type]?.icon)" :x="-17 * px" :y="-17 * px" :width="34 * px" :height="34 * px" />
          <text :y="40 * px" class="sm-label" :style="labelStyle">{{ OUTPOSTS[o.type]?.label }}</text>
        </g>

        <!-- издалека — подпись поселения -->
        <g v-if="view.k < 0.09" class="sm-town" :transform="`translate(${CENTER} ${CENTER})`">
          <circle :r="5 * px" class="sm-town-dot" vector-effect="non-scaling-stroke" />
          <text :y="-11 * px" class="sm-label town" :style="{ fontSize: 17 * px + 'px', strokeWidth: 5 * px + 'px' }">{{ settlement.name }}</text>
        </g>
      </g>
    </svg>

    <!-- подсказки -->
    <div v-if="wallDraftInfo" class="sm-tip" :style="tipPos">
      <b>{{ wallDraftInfo.title }}</b>
      <span v-for="(l, i) in wallDraftInfo.lines" :key="i">{{ l }}</span>
    </div>
    <div v-else-if="cursor && toolActive && cursorBad.length" class="sm-tip bad" :style="tipPos">Сюда нельзя: {{ cursorBad.join(', ') }}</div>
    <div v-else-if="dragId && dragBad.length" class="sm-tip bad" :style="tipPos">Сюда нельзя: {{ dragBad.join(', ') }}</div>
    <div v-else-if="hover && tip && !toolActive" class="sm-tip" :style="tipPos">
      <b>{{ tip.title }}</b>
      <span v-for="(l, i) in tip.lines" :key="i">{{ l }}</span>
    </div>

    <!-- что под курсором и масштаб -->
    <div class="sm-status">
      <span v-if="place">{{ place }}</span>
      <span class="sm-scale"><i :style="{ width: scaleBar.px + 'px' }" />{{ scaleBar.label }}</span>
    </div>
    <div class="sm-ctrl">
      <button title="Приблизить" @click="zoomBy(1.5)">+</button>
      <button title="Отдалить" @click="zoomBy(1 / 1.5)">−</button>
      <button title="К поселению" @click="fit">⌂</button>
      <button title="Вся округа (≈17×17 км)" @click="fitAll">⤢</button>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { BUILDINGS, CATEGORIES, OUTPOSTS, SIZES, JOBS, RES, ROAD_TYPES, placementProblems, footprint, roadCurve, nearestRoad, roadJunctions, priceText } from '../shared/settlement.js'
import { WALL_TYPES, WALL_FEATURES, wallLength, wallPrice, wallWork, pointAt, slice, nearestWall, openings, roadCrossings, wallDefense } from '../shared/walls.js'
import { WORLD, CENTER, makeTerrain, BIOME_LABEL } from '../shared/terrainGen.js'
import { createTileStore } from './tiles.js'
import { TILE, MAX_Z, treeAt } from './tileRender.js'
import { fogTexture } from '../map/fogTexture.js'

const props = defineProps({
  settlement: { type: Object, required: true },
  calc: { type: Object, required: true },
  selected: { type: Object, default: null }, // { kind: building | outpost | road, id }
  // инструмент: 'move' — двигать; { place: тип } — новая постройка; { placeExisting: id, type } — из списка «не расставлены»;
  // { explore: true } — точка разведки; 'fog-add' / 'fog-erase' — туман; 'cut' / 'grow' — вырубить / вернуть лес; { road: тип } — дорога;
  // { wall: вид } — стена; { wallFeature: gate | wicket | tower } — фрагмент на стене
  tool: { type: [String, Object], default: null },
  ghosts: { type: Array, default: () => [] },
  brush: { type: Number, default: 60 }, // радиус кисти, м
  master: Boolean
})
const emit = defineEmits(['select', 'moved', 'placed', 'explore', 'fog', 'cut', 'fell', 'road', 'roadEdit', 'wall', 'wallFeature', 'needGate', 'ready'])

const fogUrl = fogTexture()
const iconUrl = name => `/settlement/${name || 'help'}.png`
const sideOf = type => SIZES[BUILDINGS[type]?.size]?.side || 0
// на экране постройка не меньше 14 px, иначе её не видно издалека
const shown = b => Math.max(sideOf(b.type), 14 * px.value)
const icon = b => Math.min(shown(b) * 0.78, Math.max(shown(b) * 0.6, 34 * px.value))
const ghostSide = g => Math.max(sideOf(g.type), 14 * px.value)
const placed = computed(() => (props.settlement.buildings || []).filter(b => b.x != null && sideOf(b.type) > 0))
const toolActive = computed(() => !!props.tool && props.tool !== 'move')
const toolClass = computed(() => (props.tool === 'move' ? 'tool-move' : toolActive.value ? 'tool-paint' : ''))
const placeType = computed(() => props.tool?.place || props.tool?.type || null)
const placeShown = computed(() => Math.max(sideOf(placeType.value), 14 * px.value))
const brushR = computed(() => (props.tool?.explore ? 300 : props.brush))
const brushClass = computed(() => ({ erase: props.tool === 'fog-erase', cut: props.tool === 'cut', grow: props.tool === 'grow' }))
const cursor = ref(null)
const cursorBad = computed(() => {
  if (!cursor.value || !placeType.value || BUILDINGS[placeType.value]?.size === 'settlement') return []
  return placementProblems(props.settlement, { id: props.tool?.placeExisting || '_new', type: placeType.value, x: cursor.value.x, y: cursor.value.y })
})

/* ---------- вид: k — пикселей на метр ---------- */
const box = ref(null)
const cv = ref(null)
const size = reactive({ w: 0, h: 0 })
const view = reactive({ x: 0, y: 0, k: 0.3 })
const px = computed(() => 1 / view.k) // метров в экранном пикселе
const K_MAX = 4
const kMin = () => Math.min(size.w, size.h) / WORLD * 0.9
const labelStyle = computed(() => ({ fontSize: 12 * px.value + 'px', strokeWidth: 4 * px.value + 'px' }))
// видимая часть мира с запасом — для тумана и его размытия
const vb = computed(() => {
  const x0 = -view.x / view.k, y0 = -view.y / view.k, w = size.w / view.k, h = size.h / view.k
  return { x: x0 - w * 0.25, y: y0 - h * 0.25, w: w * 1.5, h: h * 1.5 }
})
const fogBlur = computed(() => Math.min(60, 26 * px.value))
function fitBox(x0, y0, x1, y1) {
  const pad = 40
  const k = Math.max(kMin(), Math.min(K_MAX, Math.min((size.w - pad * 2) / (x1 - x0), (size.h - pad * 2) / (y1 - y0))))
  Object.assign(view, { k, x: size.w / 2 - ((x0 + x1) / 2) * k, y: size.h / 2 - ((y0 + y1) / 2) * k })
}
// к поселению: разведанное ядро и постройки
function fit() {
  const core = (props.settlement.explored || []).filter(e => e.r && Math.hypot(e.x - CENTER, e.y - CENTER) < 2500)
  let x0 = CENTER - 1200, y0 = CENTER - 1200, x1 = CENTER + 1200, y1 = CENTER + 1200
  for (const e of core) { x0 = Math.min(x0, e.x - e.r); y0 = Math.min(y0, e.y - e.r); x1 = Math.max(x1, e.x + e.r); y1 = Math.max(y1, e.y + e.r) }
  fitBox(x0, y0, x1, y1)
}
const fitAll = () => fitBox(0, 0, WORLD, WORLD)
function zoomAt(sx, sy, f) {
  const k = Math.max(kMin(), Math.min(K_MAX, view.k * f))
  view.x = sx - ((sx - view.x) / view.k) * k
  view.y = sy - ((sy - view.y) / view.k) * k
  view.k = k
}
const zoomBy = f => zoomAt(size.w / 2, size.h / 2, f)
function onWheel(e) {
  const rc = box.value.getBoundingClientRect()
  zoomAt(e.clientX - rc.left, e.clientY - rc.top, Math.exp(-e.deltaY * 0.0015))
}
const toWorld = (cx, cy) => {
  const rc = box.value.getBoundingClientRect()
  return { x: Math.round(((cx - rc.left - view.x) / view.k) * 10) / 10, y: Math.round(((cy - rc.top - view.y) / view.k) * 10) / 10 }
}
const scaleBar = computed(() => {
  const raw = 110 * px.value
  const p = 10 ** Math.floor(Math.log10(raw))
  const nice = [5, 2, 1].map(m => m * p).find(v => v <= raw) || p
  return { px: Math.round(nice * view.k), label: nice >= 1000 ? `${nice / 1000} км` : `${nice} м` }
})

/* ---------- плитки местности ---------- */
const tiles = createTileStore(() => scheduleDraw())
let drawPending = false, readySent = false
function scheduleDraw() {
  if (drawPending) return
  drawPending = true
  requestAnimationFrame(() => { drawPending = false; drawTiles() })
}
function drawTiles() {
  const c = cv.value
  if (!c || !size.w) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const W = Math.round(size.w * dpr), H = Math.round(size.h * dpr)
  if (c.width !== W || c.height !== H) { c.width = W; c.height = H }
  const g = c.getContext('2d')
  g.setTransform(1, 0, 0, 1, 0, 0)
  g.fillStyle = '#161a1f'
  g.fillRect(0, 0, W, H)
  const k = view.k
  const z = Math.max(0, Math.min(MAX_Z, Math.ceil(Math.log2((WORLD * k * dpr) / TILE) - 0.3)))
  const x0 = -view.x / k, y0 = -view.y / k, x1 = (size.w - view.x) / k, y1 = (size.h - view.y) / k
  const range = zz => {
    const T = WORLD / 2 ** zz, n = 2 ** zz
    return [Math.max(0, Math.floor(x0 / T)), Math.min(n - 1, Math.floor(x1 / T)), Math.max(0, Math.floor(y0 / T)), Math.min(n - 1, Math.floor(y1 / T))]
  }
  // сначала дешёвые крупные плитки (подложка, пока грузятся мелкие), потом нужные — от центра экрана к краям
  const list = []
  for (let zz = 0; zz <= Math.min(2, z - 1); zz++) { const [a, b, c2, d] = range(zz); for (let y = c2; y <= d; y++) for (let x = a; x <= b; x++) list.push({ z: zz, x, y }) }
  const [a, b, c2, d] = range(z)
  const T = WORLD / 2 ** z
  const cx = (x0 + x1) / 2 / T, cy = (y0 + y1) / 2 / T
  const main = []
  for (let y = c2; y <= d; y++) for (let x = a; x <= b; x++) main.push({ z, x, y })
  main.sort((p, q) => Math.hypot(p.x + 0.5 - cx, p.y + 0.5 - cy) - Math.hypot(q.x + 0.5 - cx, q.y + 0.5 - cy))
  const world = tileWorld.value
  const got = tiles.want(world, [...list, ...main])
  g.setTransform(dpr * k, 0, 0, dpr * k, dpr * view.x, dpr * view.y)
  g.imageSmoothingEnabled = true
  const ov = 0.6 / (k * dpr) // плитки чуть внахлёст — без швов
  let missing = 0
  for (const t of got) {
    if (t.z !== z) continue
    if (t.img) { g.drawImage(t.img, t.x * T - ov, t.y * T - ov, T + ov * 2, T + ov * 2); continue }
    missing++
    const an = tiles.ancestor(world, t.z, t.x, t.y)
    if (!an) continue
    const TA = WORLD / 2 ** an.z, s = TILE / TA
    g.drawImage(an.img, (t.x * T - an.x * TA) * s, (t.y * T - an.y * TA) * s, T * s, T * s, t.x * T - ov, t.y * T - ov, T + ov * 2, T + ov * 2)
  }
  if (!missing && !readySent) { readySent = true; emit('ready') }
}
watch(() => [view.x, view.y, view.k, size.w, size.h], scheduleDraw)
// что плитки должны знать, кроме местности: вырубки, дороги и постройки (под ними деревьев нет)
const tileWorld = computed(() => ({
  terrain: props.settlement.terrain,
  clearings: props.settlement.clearings || [],
  roads: [
    ...(props.settlement.roads || []).map(r => ({ w: ROAD_TYPES[r.type]?.w || 4, pts: roadCurve(r) })),
    ...(props.settlement.walls || []).map(w => ({ w: (WALL_TYPES[w.type]?.w || 1.2) + 1, pts: w.points }))
  ].map(r => {
    const xs = r.pts.map(p => p[0]), ys = r.pts.map(p => p[1])
    return { ...r, box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] }
  }),
  boxes: placed.value.map(b => footprint(b))
}))
watch(tileWorld, scheduleDraw)

/* ---------- дороги ---------- */
const pathOf = pts => (pts.length < 2 ? '' : 'M' + pts.map(p => `${Math.round(p[0] * 100) / 100} ${Math.round(p[1] * 100) / 100}`).join(' L'))
const roadEdit = ref(null) // { kind: road | wall, id, points } — пока тянут ручку
const roadsView = computed(() => (props.settlement.roads || []).map(r => (roadEdit.value?.kind === 'road' && roadEdit.value.id === r.id ? { ...r, points: roadEdit.value.points } : r)))
const wallsView = computed(() => (props.settlement.walls || []).map(w => (roadEdit.value?.kind === 'wall' && roadEdit.value.id === w.id ? { ...w, points: roadEdit.value.points } : w)))

/* ---------- стены ---------- */
const WALL_STYLE = {
  palisade: { edge: '#2c1f12', body: '#7a5530', top: '#b0844f', edgeW: 0.5, dash: '0.3 0.14' },
  stone: { edge: '#34322e', body: '#8f8b82', top: '#c2bdb1', edgeW: 0.7, dash: '1.1 0.8' }
}
const wallsDraw = computed(() => wallsView.value.map(w => {
  const t = WALL_TYPES[w.type] || WALL_TYPES.palisade
  const len = wallLength(w.points), built = Math.min(len, w.built ?? len)
  // режем стену проёмами, каждую часть — на построенное и нет
  const pieces = []
  let a = 0
  for (const [g0, g1] of openings(w).sort((x, y) => x[0] - y[0])) { if (g0 > a) pieces.push([a, g0]); a = Math.max(a, g1) }
  if (a < len) pieces.push([a, len])
  const done = [], plan = []
  for (const [p0, p1] of pieces) {
    if (built > p0) done.push(pathOf(slice(w.points, p0, Math.min(p1, built))))
    if (built < p1) plan.push(pathOf(slice(w.points, Math.max(p0, built), p1)))
  }
  const wpx = Math.max(t.w, 3 * px.value)
  const feats = (w.features || []).map(f => {
    const p = pointAt(w.points, f.s), d = WALL_FEATURES[f.kind]
    const side = Math.max((d.side || 5) * (w.type === 'stone' ? 1.2 : 1), 10 * px.value)
    return { ...f, x: p.x, y: p.y, deg: (p.angle * 180) / Math.PI, len: d.len, side, post: Math.max(wpx * 1.5, 0.6), built: (f.state || 'built') === 'built' && built >= f.s }
  })
  return { ...w, len, built, w: wpx, dAll: pathOf(w.points), done: done.filter(Boolean), plan: plan.filter(Boolean), feats, st: WALL_STYLE[w.type] || WALL_STYLE.palisade }
}))
// дорога пересекает стену без ворот
const needGates = computed(() => roadCrossings(wallsView.value, roadsView.value, roadCurve).filter(c => !c.gate))
// куда встанет фрагмент: ближайшая точка стены под курсором
const featureAim = computed(() => {
  const k = props.tool?.wallFeature
  if (!k || !cursor.value) return null
  const q = nearestWall(wallsView.value, cursor.value.x, cursor.value.y)
  if (!q || q.dist > Math.max(14 * px.value, 6)) return null
  const p = pointAt(q.wall.points, q.s), d = WALL_FEATURES[k]
  return { wallId: q.wall.id, s: q.s, x: p.x, y: p.y, deg: (p.angle * 180) / Math.PI, len: d.len, side: Math.max(d.side || 5, 10 * px.value) }
})
// что будет стоить стена, которую рисуют
const fmtPrice = pr => priceText(pr) || 'бесплатно'
const wallDraftInfo = computed(() => {
  const type = props.tool?.wall
  if (!type || !draft.value.length || !cursor.value) return null
  const pts = [...draft.value, snapHint.value || [cursor.value.x, cursor.value.y]]
  const len = wallLength(pts)
  const days = Math.ceil(wallWork(type, len) / 25)
  return {
    title: `${WALL_TYPES[type].label}: ${fmtLen(len)}`,
    lines: [`Цена: ${fmtPrice(wallPrice(type, len))}`, `Стройка ≈ ${days} дн. (без слесарей)`, `Защита +${Math.round(len * WALL_TYPES[type].defense)}`]
  }
})
// оформление вида дороги: ширины в метрах, но не тоньше нескольких пикселей издалека
function roadStyle(type) {
  const w = ROAD_TYPES[type]?.w || 4, p = px.value
  const m = (meters, pixels) => Math.max(meters, pixels * p)
  switch (type) {
    case 'trail': return { shadow: { c: 'rgba(40, 30, 18, .22)', w: m(w + 1.4, 3) }, edge: { c: '#9a7d55', w: m(w + 0.5, 2.2) }, fill: { c: '#c4a676', w: m(w, 1.4) }, extra: [] }
    case 'tract': return { shadow: { c: 'rgba(30, 22, 12, .35)', w: m(w + 4, 4.6) }, edge: { c: '#5e472c', w: m(w + 1.6, 3.4) }, fill: { c: '#977652', w: m(w, 2.6) }, extra: [{ c: '#83653f', w: m(w * 0.62, 1.4) }, { c: '#977652', w: m(w * 0.36, 0.8) }] }
    case 'paved': return { shadow: { c: 'rgba(20, 20, 18, .35)', w: m(w + 3.5, 4.2) }, edge: { c: '#4c4a45', w: m(w + 1.4, 3.2) }, fill: { c: '#9a958a', w: m(w, 2.4) }, extra: view.k > 1.2 ? [{ c: '#b6b1a5', w: w * 0.9, dash: '0.45 0.8' }] : [] }
    case 'bridge': return { shadow: { c: 'rgba(10, 8, 4, .45)', w: m(w + 3, 4.4) }, edge: { c: '#3b2a18', w: m(w + 1.6, 3.4) }, fill: { c: '#a77d4c', w: m(w, 2.6) }, extra: view.k > 0.8 ? [{ c: '#7a5a34', w: w * 0.94, dash: '0.28 0.5' }] : [] }
    default: return { shadow: { c: 'rgba(40, 30, 18, .32)', w: m(w + 3, 3.6) }, edge: { c: '#6b5235', w: m(w + 1.2, 2.8) }, fill: { c: '#a3835a', w: m(w, 2) }, extra: [{ c: 'rgba(196, 166, 120, .5)', w: m(w * 0.38, 0.7) }] }
  }
}
// точка на ломаной на расстоянии dist от начала
function pointAlong(pts, dist) {
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
    if (dist <= seg) { const u = seg ? dist / seg : 0; return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * u, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * u] }
    dist -= seg
  }
  return pts[pts.length - 1]
}
// отрезать от начала ломаной кусок длиной cut
function trimStart(pts, cut) {
  let i = 1
  while (i < pts.length) {
    const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
    if (cut < seg) { const u = cut / seg; return [[pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * u, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * u], ...pts.slice(i)] }
    cut -= seg
    i++
  }
  return pts.slice(-1)
}
const f2 = p => `${Math.round(p[0] * 100) / 100} ${Math.round(p[1] * 100) / 100}`
// раструб примыкания: оба угла между кромкой главной дороги и второстепенной скругляются (как на картах).
// J — точка примыкания на оси главной, tI — направление главной там, wN / wI — ширина второстепенной и главной
function flarePath(curve, end, J, tI, wN, wI) {
  const pts = end ? [...curve].reverse() : curve
  const P = pointAlong(pts, wI / 2 + Math.max(wN * 2, 4))
  let dx = P[0] - J[0], dy = P[1] - J[1]
  const len = Math.hypot(dx, dy)
  if (len < 0.05) return null
  dx /= len; dy /= len
  const nx = -dy, ny = dx, h = wN / 2
  const tl = Math.hypot(tI[0], tI[1]) || 1
  const ix = tI[0] / tl, iy = tI[1] / tl
  // кромка главной со стороны, откуда пришла второстепенная
  const sg = Math.sign(dx * -iy + dy * ix) || 1
  const ex = J[0] - iy * sg * (wI / 2), ey = J[1] + ix * sg * (wI / 2)
  const r = Math.min(Math.max(wN * 0.9, 1.4), 4.5) // радиус скругления
  const side = k => {
    // пересечение кромки второстепенной (смещение k·h) с кромкой главной: E + tI·u = J + n·k·h + d·v
    const bx = J[0] + nx * k * h - ex, by = J[1] + ny * k * h - ey
    const det = ix * -dy - iy * -dx
    if (Math.abs(det) < 0.15) return null // почти параллельно — раструб не нужен
    const u = (bx * -dy - by * -dx) / det
    const Cx = ex + ix * u, Cy = ey + iy * u
    const away = Math.sign((nx * k) * ix + (ny * k) * iy) || k
    return { S: [Cx + ix * away * r, Cy + iy * away * r], C: [Cx, Cy], Q: [Cx + dx * r, Cy + dy * r] }
  }
  const a = side(1), b = side(-1)
  if (!a || !b) return null
  return `M${f2(J)} L${f2(a.S)} Q${f2(a.C)} ${f2(a.Q)} L${f2(b.Q)} Q${f2(b.C)} ${f2(b.S)} Z`
}
const roadsDraw = computed(() => {
  const roads = roadsView.value
  const juncs = roadJunctions(roads)
  return roads.map(r => {
    const st = roadStyle(r.type)
    const full = roadCurve(r)
    let curve = full
    const flares = []
    let inner = full
    for (const j of juncs.filter(x => x.road === r)) {
      const sti = roadStyle(j.into.type)
      const ci = roadCurve(j.into)
      // упёрлись в конец другой дороги — это угол или продолжение, раструб не нужен
      const atEnd = [ci[0], ci[ci.length - 1]].some(p => Math.hypot(p[0] - j.x, p[1] - j.y) < sti.fill.w / 2 + 0.5)
      if (!atEnd && (ROAD_TYPES[j.into.type]?.rank || 0) >= (ROAD_TYPES[r.type]?.rank || 0)) {
        // направление главной дороги в точке примыкания
        const q = nearestRoad([j.into], j.x, j.y)
        const tI = q ? [ci[q.seg][0] - ci[q.seg - 1][0], ci[q.seg][1] - ci[q.seg - 1][1]] : [1, 0]
        const fp = flarePath(full, j.end, [j.x, j.y], tI, st.fill.w, sti.fill.w)
        if (fp) {
          flares.push(fp)
          // сама дорога кончается у оси главной, не доходя до неё: круглый конец не вылезает за дальнюю кромку
          const cut = sti.fill.w / 2 * 0.9
          curve = j.end ? trimStart([...curve].reverse(), cut).reverse() : trimStart(curve, cut)
        }
      }
      // разметка не заходит на покрытие главной дороги
      inner = j.end ? trimStart([...inner].reverse(), sti.fill.w / 2 + 0.3).reverse() : trimStart(inner, sti.fill.w / 2 + 0.3)
    }
    return { ...r, st, flares, d: pathOf(curve), dInner: pathOf(inner), rank: ROAD_TYPES[r.type]?.rank || 0 }
  }).sort((a, b) => a.rank - b.rank)
})
const roadLen = pts => pts.reduce((n, p, i) => (i ? n + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0)
const fmtLen = m => (m >= 1000 ? `${(m / 1000).toFixed(m >= 10000 ? 0 : 1).replace('.', ',')} км` : `${Math.round(m)} м`)
// рисование новой дороги: щелчки ставят точки, двойной щелчок или Enter — готово, Backspace — убрать точку, Esc — отмена
const draft = ref([])
const lineTool = computed(() => !!(props.tool?.road || props.tool?.wall))
const draftPts = computed(() => (snapHint.value || cursor.value ? [...draft.value, snapHint.value || [cursor.value.x, cursor.value.y]] : draft.value))
const draftD = computed(() => pathOf(props.tool?.wall ? draftPts.value : roadCurve({ type: props.tool?.road, points: draftPts.value })))
const draftW = computed(() => Math.max(props.tool?.wall ? WALL_TYPES[props.tool.wall]?.w || 1.2 : ROAD_TYPES[props.tool?.road]?.w || 4, 3 * px.value))
watch(() => props.tool, () => { draft.value = [] })
// прилипание: к концам дорог (продолжить), иначе — к любой точке дороги (примыкание); null — не прилипло
function snapTo(w) {
  const tol = 12 * px.value
  let best = null, bd = tol
  // стену цепляем к концам и линиям других стен (продолжить, примкнуть, замкнуть кольцо)
  if (props.tool?.wall) {
    for (const x of wallsView.value) for (const p of [x.points[0], x.points[x.points.length - 1]]) {
      const d = Math.hypot(p[0] - w.x, p[1] - w.y)
      if (d < bd) { bd = d; best = [p[0], p[1]] }
    }
    // замкнуть свою же стену на первую точку
    if (draft.value.length > 2) { const p = draft.value[0]; if (Math.hypot(p[0] - w.x, p[1] - w.y) < bd) best = [p[0], p[1]] }
    if (best) return best
    const q = nearestWall(wallsView.value, w.x, w.y)
    return q && q.dist < tol ? [Math.round(q.x * 10) / 10, Math.round(q.y * 10) / 10] : null
  }
  for (const r of roadsView.value) for (const p of [r.points[0], r.points[r.points.length - 1]]) {
    const d = Math.hypot(p[0] - w.x, p[1] - w.y)
    if (d < bd) { bd = d; best = [p[0], p[1]] }
  }
  if (best) return best
  const q = nearestRoad(roadsView.value, w.x, w.y)
  if (q && q.dist < Math.max(tol, (ROAD_TYPES[q.road.type]?.w || 4) / 2)) return [Math.round(q.x * 10) / 10, Math.round(q.y * 10) / 10]
  return null
}
const snap = w => snapTo(w) || [w.x, w.y]
const snapHint = computed(() => (lineTool.value && cursor.value ? snapTo(cursor.value) : null))
// инструмент «срубить дерево»: ближайшее к курсору дерево или куст
const fellTarget = computed(() => (props.tool === 'fell' && cursor.value ? treeAt(props.settlement.terrain, props.settlement.clearings, cursor.value.x, cursor.value.y, 6 * px.value) : null))
function finishRoad() {
  const pts = draft.value.filter((p, i, a) => !i || Math.hypot(p[0] - a[i - 1][0], p[1] - a[i - 1][1]) > 2 * px.value)
  if (pts.length >= 2) emit(props.tool.wall ? 'wall' : 'road', { type: props.tool.wall || props.tool.road, points: pts })
  draft.value = []
}
// правка выбранной дороги
const editRoad = computed(() => {
  const kind = props.selected?.kind
  if (!props.master || (kind !== 'road' && kind !== 'wall') || toolActive.value) return null
  return (kind === 'wall' ? wallsView.value : roadsView.value).find(r => r.id === props.selected.id) || null
})
const editMids = computed(() => (editRoad.value ? editRoad.value.points.slice(1).map((p, i) => [(p[0] + editRoad.value.points[i][0]) / 2, (p[1] + editRoad.value.points[i][1]) / 2]) : []))
let handle = null

/* ---------- выбор, перетаскивание ---------- */
const isSel = (kind, id) => props.selected?.kind === kind && props.selected?.id === id
function pick(kind, item) {
  if (moved || toolActive.value) return
  emit('select', isSel(kind, item.id) ? null : { kind, id: item.id })
}
const dragId = ref(null)
const dragKind = ref(null)
const dragPos = ref(null)
const dragBad = computed(() => {
  if (!dragId.value || !dragPos.value || dragKind.value !== 'building') return []
  const b = props.settlement.buildings.find(x => x.id === dragId.value)
  return b ? placementProblems(props.settlement, { ...b, ...dragPos.value }) : []
})
const outpostsView = computed(() => (props.settlement.outposts || []).map(o => (o.id === dragId.value && dragPos.value ? { ...o, ...dragPos.value } : o)))
const placedView = computed(() => placed.value.map(b => (b.id === dragId.value && dragPos.value ? { ...b, ...dragPos.value } : b)))

const pointers = new Map()
const drag = ref(false)
const panning = ref(false)
let moved = false, pinch = null, painted = []
function onDown(e) {
  const mouse = e.pointerType === 'mouse'
  if (mouse && e.button > 2) return
  // мышью карту двигают зажатым колёсиком (или правой кнопкой), левая — выбирать и ставить; пальцем — как обычно
  const panBtn = mouse && e.button !== 0
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, pan: !mouse || panBtn })
  moved = false
  drag.value = true
  if (panBtn) {
    e.preventDefault()
    panning.value = true
    e.currentTarget.setPointerCapture?.(e.pointerId)
    return
  }
  if (pointers.size !== 1) {
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) } }
    return
  }
  // ручки дороги
  const h = e.target.closest?.('[data-h], [data-m]')
  if (h && editRoad.value) {
    const pts = editRoad.value.points.map(p => [...p])
    if (h.dataset.m != null) { const i = +h.dataset.m + 1; pts.splice(i, 0, [...editMids.value[+h.dataset.m]]); handle = { i } } else handle = { i: +h.dataset.h }
    roadEdit.value = { kind: props.selected.kind, id: editRoad.value.id, points: pts }
    pointers.get(e.pointerId).pan = false
    e.currentTarget.setPointerCapture?.(e.pointerId)
    return
  }
  // мастер тянет постройку или аванпост
  if (props.tool === 'move') {
    const g = e.target.closest?.('.sm-item[data-id]')
    if (g) {
      dragId.value = g.dataset.id
      dragKind.value = g.dataset.kind
      dragPos.value = null
      e.currentTarget.setPointerCapture?.(e.pointerId)
      return
    }
  }
  // кисти рисуют сразу
  if (['fog-add', 'fog-erase', 'cut', 'grow'].includes(props.tool)) {
    painted = [toWorld(e.clientX, e.clientY)]
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
}
function onMove(e) {
  const rc = box.value?.getBoundingClientRect()
  if (rc) mouse.value = { x: e.clientX - rc.left, y: e.clientY - rc.top }
  if (box.value) { cursor.value = toWorld(e.clientX, e.clientY); describe() }
  const p = pointers.get(e.pointerId)
  if (!p) return
  if (handle && roadEdit.value) {
    const w = toWorld(e.clientX, e.clientY)
    roadEdit.value.points[handle.i] = [w.x, w.y]
    moved = true
    return
  }
  if (dragId.value) {
    const w = toWorld(e.clientX, e.clientY)
    dragPos.value = { x: w.x, y: w.y }
    moved = true
    return
  }
  if (painted.length && pointers.size === 1) {
    const w = toWorld(e.clientX, e.clientY), last = painted[painted.length - 1]
    if (Math.hypot(w.x - last.x, w.y - last.y) > props.brush * 0.5) painted.push(w)
    moved = true
    return
  }
  const dx = e.clientX - p.x, dy = e.clientY - p.y
  p.x = e.clientX
  p.y = e.clientY
  if (Math.abs(dx) + Math.abs(dy) > 1) moved = true
  if (pointers.size === 2 && pinch) {
    const [a, b] = [...pointers.values()]
    const d = Math.hypot(a.x - b.x, a.y - b.y)
    zoomAt((a.x + b.x) / 2 - rc.left, (a.y + b.y) / 2 - rc.top, d / pinch.d)
    pinch.d = d
  } else if (pointers.size === 1) {
    if (!drag.value || !p.pan) return
    if (moved) panning.value = true
    view.x += dx
    view.y += dy
    if (moved) e.currentTarget.setPointerCapture?.(e.pointerId)
  }
}
function onUp(e) {
  const up = e.type === 'pointerup'
  if (handle && roadEdit.value) {
    if (up && moved) emit('roadEdit', { kind: roadEdit.value.kind, id: roadEdit.value.id, points: roadEdit.value.points })
    handle = null
    roadEdit.value = null
    return release(e)
  }
  if (dragId.value) {
    if (up && dragPos.value && !dragBad.value.length) emit('moved', { id: dragId.value, kind: dragKind.value, ...dragPos.value })
    dragId.value = null
    dragPos.value = null
    return release(e)
  }
  if (painted.length) {
    if (up) emit(props.tool === 'cut' || props.tool === 'grow' ? 'cut' : 'fog', { erase: props.tool === 'fog-erase' || props.tool === 'grow', points: painted, r: props.brush })
    painted = []
    return release(e)
  }
  const primary = (e.button === 0 && !pointers.get(e.pointerId)?.pan) || e.pointerType !== 'mouse'
  if (!moved && up && primary && toolActive.value && pointers.size === 1) {
    const w = toWorld(e.clientX, e.clientY)
    if (props.tool === 'fell') { const tr = treeAt(props.settlement.terrain, props.settlement.clearings, w.x, w.y, 6 * px.value); if (tr) emit('fell', tr) }
    else if (props.tool.road || props.tool.wall) draft.value = [...draft.value, snap(w)]
    else if (props.tool.wallFeature) { if (featureAim.value) emit('wallFeature', { wallId: featureAim.value.wallId, s: featureAim.value.s, kind: props.tool.wallFeature }) }
    else if (placeType.value && !cursorBad.value.length) emit('placed', { type: placeType.value, id: props.tool.placeExisting, ...w })
    else if (props.tool.explore) emit('explore', w)
  }
  // клик по пустому месту снимает выбор
  if (!moved && primary && !toolActive.value && up && e.target.closest && !e.target.closest('.sm-item, .sm-road-hit, .sm-handle, .sm-ctrl')) emit('select', null)
  release(e)
}
function release(e) {
  pointers.delete(e.pointerId)
  if (pointers.size < 2) pinch = null
  if (!pointers.size) { drag.value = false; panning.value = false }
  setTimeout(() => { moved = false })
}
function onDbl(e) {
  if (lineTool.value) { finishRoad(); return }
  // двойной щелчок по точке выбранной дороги — убрать точку
  const h = e.target.closest?.('[data-h]')
  if (h && editRoad.value && editRoad.value.points.length > 2) {
    emit('roadEdit', { kind: props.selected.kind, id: editRoad.value.id, points: editRoad.value.points.filter((_, i) => i !== +h.dataset.h) })
  }
}
function onLeave() { hover.value = null; cursor.value = null; place.value = '' }
function onKey(e) {
  if (!lineTool.value || ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName)) return
  if (e.key === 'Enter') finishRoad()
  else if (e.key === 'Backspace') { draft.value = draft.value.slice(0, -1); e.preventDefault() }
  else if (e.key === 'Escape') draft.value = []
}

/* ---------- подсказки ---------- */
const mouse = ref({ x: 0, y: 0 })
const hover = ref(null)
const tipPos = computed(() => ({ left: Math.min(mouse.value.x + 16, size.w - 230) + 'px', top: Math.min(mouse.value.y + 16, size.h - 120) + 'px' }))
const tip = computed(() => {
  const h = hover.value
  if (!h) return null
  if (h.kind === 'outpost') {
    const o = h.item
    return { title: `Аванпост «${OUTPOSTS[o.type]?.label}»`, lines: [`Рабочие: ${o.workers} из ${o.places}`, Object.entries(o.yields || {}).map(([k, v]) => `${RES[k]?.label} +${v}`).join(', '), `${fmtLen(Math.hypot(o.x - CENTER, o.y - CENTER))} от поселения`] }
  }
  if (h.kind === 'road') return { title: h.item.name || ROAD_TYPES[h.item.type]?.label, lines: [`Длина: ${fmtLen(roadLen(h.item.points))}`] }
  if (h.kind === 'needGate') return { title: 'Дорога упирается в стену', lines: ['Щёлкни — поставить ворота'] }
  if (h.kind === 'wall' || h.kind === 'wallFeature') {
    const w = h.kind === 'wall' ? h.item : h.wall, t = WALL_TYPES[w.type] || WALL_TYPES.palisade
    const lines = [`Длина: ${fmtLen(w.len)}`, w.built < w.len - 0.01 ? `Стройка: ${fmtLen(w.built)} из ${fmtLen(w.len)}` : 'Построена', `Защита +${wallDefense([{ ...w, id: '_' }])}`]
    if (h.kind === 'wallFeature') return { title: WALL_FEATURES[h.item.kind].label + (h.item.built ? '' : ' (строится)'), lines: [`На стене: ${w.name || t.label.toLowerCase()}`] }
    return { title: w.name || t.label, lines }
  }
  const b = h.item, d = BUILDINGS[b.type]
  const lines = [`${CATEGORIES[d.cat]?.label} · ${SIZES[d.size]?.label}${SIZES[d.size]?.area ? ' (' + SIZES[d.size].area + ')' : ''}`]
  for (const [j, n] of Object.entries(d.jobs || {})) lines.push(`${JOBS[j].label}: ${n} мест`)
  if (d.housing) lines.push(`Жильё: ${d.housing}`)
  return { title: b.name || d.label, lines }
})
// строка состояния: местность под курсором и расстояние до поселения
const place = ref('')
let describeTimer = 0
function describe() {
  if (describeTimer) return
  describeTimer = setTimeout(() => {
    describeTimer = 0
    const c = cursor.value
    if (!c) return
    if (c.x < 0 || c.y < 0 || c.x > WORLD || c.y > WORLD) { place.value = 'за краем округи'; return }
    const gen = makeTerrain(props.settlement.terrain)
    gen.setClearings(props.settlement.clearings || [])
    const code = gen.sample(c.x, c.y, {}).code
    place.value = `${BIOME_LABEL[code]} · ${fmtLen(Math.hypot(c.x - CENTER, c.y - CENTER))} от центра`
  }, 60)
}

let ro = null
onMounted(() => {
  ro = new ResizeObserver(([e]) => {
    const first = !size.w
    size.w = e.contentRect.width
    size.h = e.contentRect.height
    if (first) fit()
    scheduleDraw()
  })
  ro.observe(box.value)
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  ro?.disconnect()
  tiles.destroy()
  window.removeEventListener('keydown', onKey)
})
defineExpose({ fit, fitAll, finishRoad, draft })
</script>

<style scoped>
.sm { position: relative; overflow: hidden; background: #161a1f; touch-action: none; cursor: default; user-select: none; }
.sm.grabbing { cursor: grabbing; }
.sm-tiles { position: absolute; inset: 0; width: 100%; height: 100%; }
.sm-svg { position: relative; display: block; }
.sm-world { fill: none; stroke: rgba(231, 197, 111, .55); stroke-width: 2; stroke-dasharray: 2 10; stroke-linecap: round; pointer-events: none; }
.sm-fog { pointer-events: none; opacity: .86; }
.rd { fill: none; stroke-linecap: round; stroke-linejoin: round; pointer-events: none; }
.sm-roads path:not(.sm-road-hit) { pointer-events: none; }
.sm-road-hit { fill: none; stroke: transparent; stroke-linecap: round; stroke-linejoin: round; cursor: pointer; pointer-events: stroke; }
.sm-snap { fill: rgba(255, 243, 196, .2); stroke: #fff3c4; stroke-width: 2; pointer-events: none; }
.sm-fell { fill: rgba(224, 180, 124, .18); stroke: #e0b47c; stroke-width: 2; stroke-dasharray: 4 3; pointer-events: none; }
.sm-draft { stroke: rgba(243, 217, 154, .75); stroke-dasharray: 6 4; stroke-linecap: round; stroke-linejoin: round; }
.sm-draft.wall { stroke: rgba(176, 132, 79, .85); stroke-dasharray: none; stroke-linecap: butt; }
.sm-walls .rd { stroke-linecap: butt; stroke-linejoin: miter; }
.sm-wall-plan { stroke: rgba(243, 217, 154, .55); }
.sm-wfeat { cursor: pointer; }
.sm-wfeat.plan { opacity: .55; }
.sm-door { stroke: #c49a5a; }
.sm-wfeat.aim { pointer-events: none; }
.sm-wfeat.aim rect { fill: rgba(155, 224, 122, .35); stroke: #9be07a; stroke-width: 2; }
.sm-wfeat.aim line { stroke: rgba(155, 224, 122, .85); }
.sm-needgate { cursor: pointer; }
.sm-needgate circle { fill: rgba(224, 40, 30, .85); stroke: #fff; stroke-width: 2; animation: sm-ng 1.4s ease-in-out infinite; }
.sm-needgate text { fill: #fff; font-weight: 900; text-anchor: middle; pointer-events: none; }
@keyframes sm-ng { 50% { opacity: .55; } }
.sm-draft-pt { fill: #f3d99a; stroke: #3a2a14; stroke-width: 1.5; }
.sm-item { cursor: pointer; }
.sm-plate { fill: #d6d2c8; stroke: var(--cat, #8a7a5a); stroke-width: 2.5; }
.sm-plate.outpost { fill: #cfc6b2; stroke: #6b5127; }
.sm-plate.personal { fill: #e9e2cf; stroke: #e6c27a; stroke-width: 3; }
.sm-field { stroke: #7d6c2c; stroke-width: 2; }
.sm-item:hover .sm-plate { filter: brightness(1.08); }
.sm-item.sel .sm-plate, .sm-item.sel .sm-field { filter: url(#sm-glow); stroke: #fff3c4; stroke-width: 3; }
.sm-outpost-ring { fill: rgba(255, 240, 200, .08); stroke: rgba(255, 236, 190, .7); stroke-width: 1.5; stroke-dasharray: 5 5; }
.sm-outpost-ring.depleting { stroke: #ff8a3d; }
.sm-label { font-family: 'Manrope', sans-serif; font-weight: 800; text-anchor: middle; fill: #fff6e0; paint-order: stroke; stroke: rgba(30, 22, 12, .85); pointer-events: none; }
.sm-label.town { fill: #f3d99a; font-family: 'Cormorant Garamond', Georgia, serif; }
.sm-town-dot { fill: #f3d99a; stroke: #3a2a14; stroke-width: 2; }
.sm-town { pointer-events: none; }
.sm-tip { position: absolute; z-index: 3; width: max-content; max-width: 230px; display: grid; gap: 2px; padding: 8px 11px; border-radius: 10px; background: rgba(23, 19, 14, .95); border: 1px solid #8a6630; color: #d9cdb0; font: 600 12px 'Manrope', sans-serif; pointer-events: none; box-shadow: 0 8px 22px rgba(0, 0, 0, .5); }
.sm-tip b { color: #f3d99a; font: 700 15px 'Cormorant Garamond', Georgia, serif; }
.sm-ctrl { position: absolute; right: 12px; bottom: 12px; display: grid; gap: 6px; }
.sm-ctrl button { width: 34px; height: 34px; border-radius: 10px; border: 1px solid #8a6630; background: rgba(23, 19, 14, .9); color: #f3d99a; font: 700 18px 'Manrope', sans-serif; cursor: pointer; }
.sm-ctrl button:hover { background: rgba(60, 46, 28, .95); }
.sm-status { position: absolute; left: 12px; bottom: 12px; display: flex; flex-wrap: wrap; align-items: center; gap: 10px; max-width: calc(100% - 70px); padding: 5px 10px; border-radius: 9px; background: rgba(13, 16, 23, .78); color: #d9cdb0; font: 600 11.5px 'Manrope', sans-serif; pointer-events: none; }
.sm-scale { display: inline-flex; align-items: center; gap: 6px; }
.sm-scale i { display: inline-block; height: 6px; border: 2px solid #f3d99a; border-top: 0; }
.sm.tool-move .sm-item { cursor: move; }
.sm.tool-paint { cursor: crosshair; }
.sm-item.dragging { opacity: .9; }
.sm-item.bad .sm-plate { stroke: #ff4a3d; fill: #f3c6c0; }
.sm-item.building .sm-plate { stroke-dasharray: 6 4; fill: #c9c2b2; opacity: .88; }
.sm-prog-bg { fill: rgba(20, 16, 10, .75); }
.sm-prog { fill: #e6c27a; }
.sm-ghost { pointer-events: none; }
.sm-ghost-plate { fill: rgba(243, 217, 154, .25); stroke: #f3d99a; stroke-width: 2; stroke-dasharray: 7 5; }
.sm-ghost-explore { fill: rgba(243, 217, 154, .12); stroke: #f3d99a; stroke-width: 2; stroke-dasharray: 8 6; }
.sm-label.ghost { fill: #f3d99a; }
.sm-handle { fill: #fff3c4; stroke: #3a2a14; stroke-width: 1.5; cursor: grab; }
.sm-handle.mid { fill: rgba(255, 243, 196, .55); }
.sm-cursor { pointer-events: none; }
.sm-cursor.bad .sm-ghost-plate { stroke: #ff4a3d; fill: rgba(255, 74, 61, .2); }
.sm-brush { fill: rgba(243, 217, 154, .14); stroke: #f3d99a; stroke-width: 2; stroke-dasharray: 6 5; }
.sm-brush.erase { fill: rgba(40, 44, 50, .35); stroke: #9aa3ad; }
.sm-brush.cut { fill: rgba(196, 150, 90, .2); stroke: #e0b47c; }
.sm-brush.grow { fill: rgba(90, 160, 80, .22); stroke: #8fd062; }
.sm-tip.bad { border-color: rgba(255, 107, 94, .7); color: #ffc2bb; }
@media (max-width: 700px) { .sm-status { font-size: 10.5px; } }
</style>
