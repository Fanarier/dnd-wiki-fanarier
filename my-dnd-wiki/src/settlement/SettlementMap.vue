<template>
  <div ref="box" class="sm" :class="{ grabbing: drag }" @wheel.prevent="onWheel" @pointerdown="onDown" @pointermove="onMove" @pointerup="onUp" @pointercancel="onUp" @pointerleave="hover = null">
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
        <g v-for="o in settlement.outposts" :key="o.id" class="sm-item" :class="{ sel: isSel('outpost', o.id) }" :transform="`translate(${o.x} ${o.y})`"
           @pointerenter="hover = { kind: 'outpost', item: o }" @pointerleave="hover = null" @click.stop="pick('outpost', o)">
          <circle r="34" class="sm-outpost-ring" :class="o.state" />
          <rect x="-24" y="-24" width="48" height="48" rx="7" class="sm-plate outpost" filter="url(#sm-shadow)" />
          <image :href="iconUrl(OUTPOSTS[o.type]?.icon)" x="-19" y="-19" width="38" height="38" />
          <text y="48" class="sm-label">{{ OUTPOSTS[o.type]?.label }}</text>
        </g>

        <!-- постройки -->
        <g v-for="b in placed" :key="b.id" class="sm-item" :class="{ sel: isSel('building', b.id), field: b.type === 'field' }" :transform="`translate(${b.x} ${b.y})`"
           @pointerenter="hover = { kind: 'building', item: b }" @pointerleave="hover = null" @click.stop="pick('building', b)">
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
        </g>

        <!-- туман неразведанного -->
        <rect :x="-W" :y="-H" :width="W * 3" :height="H * 3" fill="url(#sm-fog)" mask="url(#sm-fog-mask)" class="sm-fog" />
        <!-- граница территории (как точечное кольцо на большой карте) — видна и сквозь туман -->
        <circle v-if="t.territory" :cx="t.territory.x" :cy="t.territory.y" :r="t.territory.r" class="sm-border" :stroke-width="5 / Math.sqrt(view.k)" />
      </g>
    </svg>

    <!-- подсказка при наведении -->
    <div v-if="hover && tip" class="sm-tip" :style="tipPos">
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
import { BUILDINGS, CATEGORIES, OUTPOSTS, SIZES, JOBS, RES } from '../shared/settlement.js'
import { paintTerrain } from './terrainPainter.js'
import { fogTexture } from '../map/fogTexture.js'

const props = defineProps({
  settlement: { type: Object, required: true },
  calc: { type: Object, required: true },
  selected: { type: Object, default: null } // { kind, id }
})
const emit = defineEmits(['select'])

const t = computed(() => props.settlement.terrain || { w: 1600, h: 1300 })
const W = computed(() => t.value.w).value
const H = computed(() => t.value.h).value
const fogUrl = fogTexture()
const iconUrl = name => `/settlement/${name || 'help'}.png`
const side = b => SIZES[BUILDINGS[b.type]?.size]?.side || 56
// стена и прочее «на всё поселение» на карте не стоят
const placed = computed(() => (props.settlement.buildings || []).filter(b => side(b) > 0 && BUILDINGS[b.type]?.size !== 'settlement'))
const isSel = (kind, id) => props.selected?.kind === kind && props.selected?.id === id
function pick(kind, item) {
  if (moved) return
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
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()]
    pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) }
  }
}
function onMove(e) {
  const rc = box.value?.getBoundingClientRect()
  if (rc) mouse.value = { x: e.clientX - rc.left, y: e.clientY - rc.top }
  const p = pointers.get(e.pointerId)
  if (!p) return
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
  pointers.delete(e.pointerId)
  if (pointers.size < 2) pinch = null
  if (!pointers.size) drag.value = false
  // клик по пустому месту снимает выбор
  if (!moved && e.type === 'pointerup' && e.target.closest && !e.target.closest('.sm-item') && !e.target.closest('.sm-ctrl')) emit('select', null)
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
.sm-loading { position: absolute; inset: 0; display: grid; place-items: center; color: #c9b88f; font: 600 14px 'Manrope', sans-serif; pointer-events: none; }
</style>
