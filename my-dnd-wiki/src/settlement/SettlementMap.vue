<template>
  <div ref="box" class="sm" :class="[{ grabbing: drag && !toolActive }, toolClass]" @wheel.prevent="onWheel" @pointerdown="onDown" @pointermove="onMove" @pointerup="onUp" @pointercancel="onUp" @pointerleave="hover = null; cursor = null">
    <svg v-if="size.w" :width="size.w" :height="size.h" class="sm-svg">
      <defs>
        <!-- туман: облачная текстура, неразведанное закрыто; края разведанного размыты -->
        <pattern id="sm-fog" patternUnits="userSpaceOnUse" width="384" height="384">
          <rect width="384" height="384" fill="#4a4f52" />
          <image :href="fogUrl" width="384" height="384" opacity=".32" />
        </pattern>
        <filter id="sm-soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="38" /></filter>
        <mask id="sm-fog-mask" maskUnits="userSpaceOnUse" :x="-W" :y="-H" :width="W * 3" :height="H * 3">
          <rect :x="-W" :y="-H" :width="W * 3" :height="H * 3" fill="#fff" />
          <g filter="url(#sm-soft)" fill="#000">
            <template v-for="(e, i) in settlement.explored" :key="i">
              <circle v-if="e.r" :cx="e.x" :cy="e.y" :r="e.r" />
              <polygon v-else :points="e.points.map(p => p.join(',')).join(' ')" />
            </template>
          </g>
        </mask>
        <pattern id="sm-furrows" patternUnits="userSpaceOnUse" width="14" height="14" patternTransform="rotate(-8)">
          <rect width="14" height="14" fill="#c9b85a" />
          <rect width="14" height="5" fill="#a6963e" />
        </pattern>
        <filter id="sm-shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="2" dy="3" stdDeviation="2.5" flood-color="#000" flood-opacity=".45" /></filter>
        <filter id="sm-glow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="0" stdDeviation="5" flood-color="#ffe9a8" flood-opacity="1" /></filter>
      </defs>

      <g :transform="`translate(${view.x} ${view.y}) scale(${view.k})`">
        <rect :x="-W" :y="-H" :width="W * 3" :height="H * 3" fill="#20262c" />
        <image v-if="terrainUrl" :href="terrainUrl" :width="W" :height="H" preserveAspectRatio="none" />

        <!-- аванпосты -->
        <g v-for="o in outpostsView" :key="o.id" class="sm-item" :class="{ sel: isSel('outpost', o.id) }" :transform="`translate(${o.x} ${o.y})`"
           @pointerenter="hover = { kind: 'outpost', item: o }" :data-id="o.id" @pointerleave="hover = null" @click.stop="pick('outpost', o)">
          <circle r="34" class="sm-outpost-ring" :class="o.state" />
          <rect x="-24" y="-24" width="48" height="48" rx="7" class="sm-plate outpost" filter="url(#sm-shadow)" />
          <image :href="iconUrl(OUTPOSTS[o.type]?.icon)" x="-19" y="-19" width="38" height="38" />
          <text y="48" class="sm-label">{{ OUTPOSTS[o.type]?.label }}</text>
        </g>

        <!-- постройки (перетаскиваемая — на новом месте; стройка — пунктиром) -->
        <g v-for="b in placedView" :key="b.id" class="sm-item" :class="{ sel: isSel('building', b.id), field: b.type === 'field', dragging: b.id === dragId, bad: b.id === dragId && dragBad.length, building: b.state === 'construction' }" :transform="`translate(${b.x} ${b.y})`"
           @pointerenter="hover = { kind: 'building', item: b }" :data-id="b.id" @pointerleave="hover = null" @click.stop="pick('building', b)">
          <template v-if="b.type === 'field'">
            <rect :x="-side(b) / 2" :y="-side(b) / 2" :width="side(b)" :height="side(b)" rx="10" fill="url(#sm-furrows)" class="sm-field" />
            <rect x="-26" y="-26" width="52" height="52" rx="8" class="sm-plate" filter="url(#sm-shadow)" />
            <image :href="iconUrl('wheat')" x="-21" y="-21" width="42" height="42" />
          </template>
          <template v-else>
            <rect :x="-side(b) / 2" :y="-side(b) / 2" :width="side(b)" :height="side(b)" :rx="side(b) / 8" class="sm-plate" :class="{ personal: BUILDINGS[b.type]?.personal }"
                  :style="{ '--cat': CATEGORIES[BUILDINGS[b.type]?.cat]?.color }" filter="url(#sm-shadow)" />
            <image :href="iconUrl(BUILDINGS[b.type]?.icon)" :x="-side(b) * 0.39" :y="-side(b) * 0.39" :width="side(b) * 0.78" :height="side(b) * 0.78" />
          </template>
          <text v-if="b.name" :y="side(b) / 2 + 14" class="sm-label name">{{ b.name }}</text>
          <!-- стройка: полоска готовности -->
          <g v-if="b.state === 'construction'" :transform="`translate(0 ${side(b) / 2 + 8})`">
            <rect :x="-side(b) / 2" y="-3" :width="side(b)" height="6" rx="3" class="sm-prog-bg" />
            <rect :x="-side(b) / 2" y="-3" :width="side(b) * Math.min(1, (b.progress || 0) / (BUILDINGS[b.type]?.cost || 100))" height="6" rx="3" class="sm-prog" />
          </g>
        </g>

        <!-- приказы на рассмотрении: будущие постройки и разведка -->
        <g v-for="g in ghosts" :key="g.id" class="sm-ghost" :transform="`translate(${g.x} ${g.y})`">
          <circle v-if="g.explore" :r="g.r" class="sm-ghost-explore" />
          <template v-else>
            <rect :x="-g.side / 2" :y="-g.side / 2" :width="g.side" :height="g.side" :rx="g.side / 8" class="sm-ghost-plate" />
            <image :href="iconUrl(BUILDINGS[g.type]?.icon)" :x="-g.side * 0.39" :y="-g.side * 0.39" :width="g.side * 0.78" :height="g.side * 0.78" opacity=".55" />
          </template>
          <text :y="(g.side || g.r * 2) / 2 + 14" class="sm-label ghost">приказ</text>
        </g>

        <!-- курсор инструмента: новая постройка, кисть тумана, точка разведки -->
        <g v-if="cursor && toolActive" :transform="`translate(${cursor.x} ${cursor.y})`" class="sm-cursor" :class="{ bad: cursorBad.length }">
          <template v-if="tool?.place">
            <rect :x="-placeSide / 2" :y="-placeSide / 2" :width="placeSide" :height="placeSide" :rx="placeSide / 8" class="sm-ghost-plate" />
            <image :href="iconUrl(BUILDINGS[tool.place]?.icon)" :x="-placeSide * 0.39" :y="-placeSide * 0.39" :width="placeSide * 0.78" :height="placeSide * 0.78" opacity=".8" />
          </template>
          <circle v-else :r="brushR" class="sm-brush" :class="{ erase: tool === 'fog-erase' }" />
        </g>

        <!-- туман неразведанного -->
        <rect :x="-W" :y="-H" :width="W * 3" :height="H * 3" fill="url(#sm-fog)" mask="url(#sm-fog-mask)" class="sm-fog" />
        <!-- граница территории (как точечное кольцо на большой карте) — видна и сквозь туман -->
        <circle v-if="t.territory" :cx="t.territory.x" :cy="t.territory.y" :r="t.territory.r" class="sm-border" :stroke-width="5 / Math.sqrt(view.k)" />
      </g>
    </svg>

    <!-- подсказка при наведении -->
    <div v-if="cursor && toolActive && cursorBad.length" class="sm-tip bad" :style="tipPos">Сюда нельзя: {{ cursorBad.join(', ') }}</div>
    <div v-else-if="dragId && dragBad.length" class="sm-tip bad" :style="tipPos">Сюда нельзя: {{ dragBad.join(', ') }}</div>
    <div v-else-if="hover && tip && !toolActive" class="sm-tip" :style="tipPos">
      <b>{{ tip.title }}</b>
      <span v-for="(l, i) in tip.lines" :key="i">{{ l }}</span>
    </div>

    <div class="sm-ctrl">
      <button title="Приблизить" @click="zoomBy(1.3)">+</button>
      <button title="Отдалить" @click="zoomBy(1 / 1.3)">−</button>
      <button title="Показать всё поселение" @click="fit">⤢</button>
    </div>
    <div v-if="!terrainUrl" class="sm-loading">Энди рисует карту поселения…</div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { BUILDINGS, CATEGORIES, OUTPOSTS, SIZES, JOBS, RES, placementProblems } from '../shared/settlement.js'
import { paintTerrain } from './terrainPainter.js'
import { fogTexture } from '../map/fogTexture.js'

const props = defineProps({
  settlement: { type: Object, required: true },
  calc: { type: Object, required: true },
  selected: { type: Object, default: null }, // { kind, id }
  // инструмент: 'move' — двигать постройки, { place: тип } — поставить, { explore: true } — точка разведки,
  // 'fog-add' / 'fog-erase' — кисть тумана
  tool: { type: [String, Object], default: null },
  ghosts: { type: Array, default: () => [] } // приказы на рассмотрении
})
const emit = defineEmits(['select', 'moved', 'placed', 'explore', 'fog'])

const t = computed(() => props.settlement.terrain || { w: 1600, h: 1300 })
const W = computed(() => t.value.w).value
const H = computed(() => t.value.h).value
const fogUrl = fogTexture()
const iconUrl = name => `/settlement/${name || 'help'}.png`
const side = b => SIZES[BUILDINGS[b.type]?.size]?.side || 56
// стена и прочее «на всё поселение» на карте не стоят
const placed = computed(() => (props.settlement.buildings || []).filter(b => side(b) > 0 && BUILDINGS[b.type]?.size !== 'settlement'))
const toolActive = computed(() => !!props.tool && props.tool !== 'move')
const toolClass = computed(() => (props.tool === 'move' ? 'tool-move' : toolActive.value ? 'tool-paint' : ''))
const placeSide = computed(() => SIZES[BUILDINGS[props.tool?.place]?.size]?.side || 56)
const brushR = computed(() => (props.tool?.explore ? 90 : 70))
const cursor = ref(null) // в координатах карты
const cursorBad = computed(() => {
  if (!cursor.value || !props.tool?.place || BUILDINGS[props.tool.place]?.size === 'settlement') return []
  return placementProblems(props.settlement, { id: '_new', type: props.tool.place, x: cursor.value.x, y: cursor.value.y })
})
// перетаскивание постройки мастером
const dragId = ref(null)
const dragPos = ref(null)
const dragBad = computed(() => {
  if (!dragId.value || !dragPos.value) return []
  const b = props.settlement.buildings.find(x => x.id === dragId.value)
  return b ? placementProblems(props.settlement, { ...b, ...dragPos.value }) : []
})
const outpostsView = computed(() => (props.settlement.outposts || []).map(o => (o.id === dragId.value && dragPos.value ? { ...o, ...dragPos.value } : o)))
const placedView = computed(() => placed.value.map(b => (b.id === dragId.value && dragPos.value ? { ...b, ...dragPos.value } : b)))
const toWorld = (cx, cy) => {
  const rc = box.value.getBoundingClientRect()
  return { x: Math.round((cx - rc.left - view.x) / view.k), y: Math.round((cy - rc.top - view.y) / view.k) }
}
let painted = []
const isSel = (kind, id) => props.selected?.kind === kind && props.selected?.id === id
function pick(kind, item) {
  if (moved || toolActive.value) return
  emit('select', isSel(kind, item.id) ? null : { kind, id: item.id })
}

// местность перерисовываем, только когда меняется она сама или постройки (деревья обходят дома)
const terrainUrl = ref('')
let lastKey = ''
async function repaint() {
  const key = JSON.stringify([props.settlement.terrain, placed.value.map(b => [b.type, b.x, b.y])])
  if (key === lastKey) return
  lastKey = key
  const old = terrainUrl.value
  terrainUrl.value = await paintTerrain(props.settlement, matchMedia('(max-width: 700px)').matches ? 1.25 : 2)
  if (old) URL.revokeObjectURL(old)
}
watch(() => [props.settlement.terrain, placed.value], repaint, { deep: true })

/* ---------- масштаб и перетаскивание ---------- */
const box = ref(null)
const size = reactive({ w: 0, h: 0 })
const view = reactive({ x: 0, y: 0, k: 0.5 })
const K_MIN = 0.25, K_MAX = 3.5
// показываем разведанную землю целиком, с небольшим запасом
function fit() {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const e of props.settlement.explored || []) {
    const pts = e.r ? [[e.x - e.r, e.y - e.r], [e.x + e.r, e.y + e.r]] : e.points
    for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y) }
  }
  if (!Number.isFinite(x0)) [x0, y0, x1, y1] = [0, 0, W, H]
  const pad = 40
  const k = Math.min(size.w / (x1 - x0 + pad * 2), size.h / (y1 - y0 + pad * 2))
  Object.assign(view, { k, x: size.w / 2 - ((x0 + x1) / 2) * k, y: size.h / 2 - ((y0 + y1) / 2) * k })
}
function zoomAt(px, py, f) {
  const k = Math.max(K_MIN, Math.min(K_MAX, view.k * f))
  view.x = px - ((px - view.x) / view.k) * k
  view.y = py - ((py - view.y) / view.k) * k
  view.k = k
}
const zoomBy = f => zoomAt(size.w / 2, size.h / 2, f)
function onWheel(e) {
  const rc = box.value.getBoundingClientRect()
  zoomAt(e.clientX - rc.left, e.clientY - rc.top, Math.exp(-e.deltaY * 0.0015))
}
const pointers = new Map()
const drag = ref(false)
let moved = false, pinch = null
function onDown(e) {
  if (e.button > 0) return
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
  moved = false
  drag.value = true
  // мастер тянет постройку
  if (props.tool === 'move' && pointers.size === 1) {
    const g = e.target.closest?.('.sm-item[data-id]')
    if (g) {
      dragId.value = g.dataset.id
      dragPos.value = null
      e.currentTarget.setPointerCapture?.(e.pointerId)
      return
    }
  }
  // кисть тумана рисует сразу
  if ((props.tool === 'fog-add' || props.tool === 'fog-erase') && pointers.size === 1) {
    painted = [toWorld(e.clientX, e.clientY)]
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()]
    pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) }
  }
}
function onMove(e) {
  const rc = box.value?.getBoundingClientRect()
  if (rc) mouse.value = { x: e.clientX - rc.left, y: e.clientY - rc.top }
  if (box.value) cursor.value = toWorld(e.clientX, e.clientY)
  const p = pointers.get(e.pointerId)
  if (!p) return
  if (dragId.value) {
    const w = toWorld(e.clientX, e.clientY)
    dragPos.value = { x: w.x, y: w.y }
    moved = true
    return
  }
  if (painted.length && pointers.size === 1) {
    const w = toWorld(e.clientX, e.clientY), last = painted[painted.length - 1]
    if (Math.hypot(w.x - last.x, w.y - last.y) > brushR.value * 0.5) painted.push(w)
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
    if (!drag.value) return
    view.x += dx
    view.y += dy
    if (moved) e.currentTarget.setPointerCapture?.(e.pointerId)
  }
}
function onUp(e) {
  if (dragId.value && e.type === 'pointerup') {
    if (dragPos.value && !dragBad.value.length) emit('moved', { id: dragId.value, ...dragPos.value })
    dragId.value = null
    dragPos.value = null
    pointers.delete(e.pointerId)
    drag.value = false
    return
  }
  if (painted.length && e.type === 'pointerup') {
    emit('fog', { erase: props.tool === 'fog-erase', points: painted, r: brushR.value })
    painted = []
    pointers.delete(e.pointerId)
    drag.value = false
    return
  }
  // поставить постройку / выбрать точку разведки
  if (!moved && e.type === 'pointerup' && toolActive.value && pointers.size === 1) {
    const w = toWorld(e.clientX, e.clientY)
    if (props.tool.place && !cursorBad.value.length) emit('placed', { type: props.tool.place, ...w })
    if (props.tool.explore) emit('explore', w)
  }
  pointers.delete(e.pointerId)
  if (pointers.size < 2) pinch = null
  if (!pointers.size) drag.value = false
  // клик по пустому месту снимает выбор
  if (!moved && !toolActive.value && e.type === 'pointerup' && e.target.closest && !e.target.closest('.sm-item') && !e.target.closest('.sm-ctrl')) emit('select', null)
  setTimeout(() => { moved = false })
}

/* ---------- подсказка ---------- */
const mouse = ref({ x: 0, y: 0 })
const tipPos = computed(() => ({ left: Math.min(mouse.value.x + 16, size.w - 230) + 'px', top: Math.min(mouse.value.y + 16, size.h - 120) + 'px' }))
const tip = computed(() => {
  const h = hover.value
  if (!h) return null
  if (h.kind === 'outpost') {
    const o = h.item
    return { title: `Аванпост «${OUTPOSTS[o.type]?.label}»`, lines: [`Рабочие: ${o.workers} из ${o.places}`, Object.entries(o.yields || {}).map(([k, v]) => `${RES[k]?.label} +${v}`).join(', ')] }
  }
  const b = h.item, d = BUILDINGS[b.type]
  const lines = [`${CATEGORIES[d.cat]?.label} · ${SIZES[d.size]?.label}`]
  for (const [j, n] of Object.entries(d.jobs || {})) lines.push(`${JOBS[j].label}: ${n} мест`)
  if (d.housing) lines.push(`Жильё: ${d.housing}`)
  return { title: b.name || d.label, lines }
})
const hover = ref(null)

let ro = null
onMounted(() => {
  ro = new ResizeObserver(([e]) => {
    const first = !size.w
    size.w = e.contentRect.width
    size.h = e.contentRect.height
    if (first) fit()
  })
  ro.observe(box.value)
  repaint()
})
onBeforeUnmount(() => {
  ro?.disconnect()
  if (terrainUrl.value) URL.revokeObjectURL(terrainUrl.value)
})
defineExpose({ fit })
</script>

<style scoped>
.sm { position: relative; overflow: hidden; background: #171b20; touch-action: none; cursor: grab; user-select: none; }
.sm.grabbing { cursor: grabbing; }
.sm-svg { display: block; }
.sm-border { fill: none; stroke: rgba(231, 197, 111, .55); stroke-dasharray: 1 18; stroke-linecap: round; pointer-events: none; }
.sm-fog { pointer-events: none; opacity: .86; }
.sm-item { cursor: pointer; }
.sm-plate { fill: #d6d2c8; stroke: var(--cat, #8a7a5a); stroke-width: 2.5; transition: filter .2s; }
.sm-plate.outpost { fill: #cfc6b2; stroke: #6b5127; }
.sm-plate.personal { fill: #e9e2cf; stroke: #e6c27a; stroke-width: 3; }
.sm-field { stroke: #7d6c2c; stroke-width: 3; }
.sm-item:hover .sm-plate { filter: brightness(1.08) drop-shadow(0 0 6px rgba(255, 240, 200, .7)); }
.sm-item.sel .sm-plate, .sm-item.sel .sm-field { filter: url(#sm-glow); stroke: #fff3c4; }
.sm-outpost-ring { fill: rgba(255, 240, 200, .12); stroke: rgba(70, 52, 30, .7); stroke-width: 2; stroke-dasharray: 5 5; }
.sm-outpost-ring.depleting { stroke: #ff8a3d; }
.sm-label { font: 800 13px 'Manrope', sans-serif; text-anchor: middle; fill: #fff6e0; paint-order: stroke; stroke: rgba(30, 22, 12, .85); stroke-width: 4px; pointer-events: none; }
.sm-label.name { font-size: 12px; }
.sm-tip { position: absolute; z-index: 3; width: max-content; max-width: 220px; display: grid; gap: 2px; padding: 8px 11px; border-radius: 10px; background: rgba(23, 19, 14, .95); border: 1px solid #8a6630; color: #d9cdb0; font: 600 12px 'Manrope', sans-serif; pointer-events: none; box-shadow: 0 8px 22px rgba(0, 0, 0, .5); }
.sm-tip b { color: #f3d99a; font: 700 15px 'Cormorant Garamond', Georgia, serif; }
.sm-ctrl { position: absolute; right: 12px; bottom: 12px; display: grid; gap: 6px; }
.sm-ctrl button { width: 34px; height: 34px; border-radius: 10px; border: 1px solid #8a6630; background: rgba(23, 19, 14, .9); color: #f3d99a; font: 700 18px 'Manrope', sans-serif; cursor: pointer; }
.sm-ctrl button:hover { background: rgba(60, 46, 28, .95); }
.sm.tool-move .sm-item { cursor: move; }
.sm.tool-paint { cursor: crosshair; }
.sm-item.dragging { opacity: .9; }
.sm-item.bad .sm-plate { stroke: #ff4a3d; fill: #f3c6c0; }
.sm-item.building .sm-plate { stroke-dasharray: 6 4; fill: #c9c2b2; opacity: .85; }
.sm-prog-bg { fill: rgba(20, 16, 10, .75); }
.sm-prog { fill: #e6c27a; }
.sm-ghost { pointer-events: none; }
.sm-ghost-plate { fill: rgba(243, 217, 154, .25); stroke: #f3d99a; stroke-width: 2.5; stroke-dasharray: 7 5; }
.sm-ghost-explore { fill: rgba(243, 217, 154, .12); stroke: #f3d99a; stroke-width: 2.5; stroke-dasharray: 8 6; }
.sm-label.ghost { fill: #f3d99a; font-size: 11px; }
.sm-cursor { pointer-events: none; }
.sm-cursor.bad .sm-ghost-plate { stroke: #ff4a3d; fill: rgba(255, 74, 61, .2); }
.sm-brush { fill: rgba(243, 217, 154, .14); stroke: #f3d99a; stroke-width: 2; stroke-dasharray: 6 5; }
.sm-brush.erase { fill: rgba(40, 44, 50, .35); stroke: #9aa3ad; }
.sm-tip.bad { border-color: rgba(255, 107, 94, .7); color: #ffc2bb; }
.sm-loading { position: absolute; inset: 0; display: grid; place-items: center; color: #c9b88f; font: 600 14px 'Manrope', sans-serif; pointer-events: none; }
</style>
