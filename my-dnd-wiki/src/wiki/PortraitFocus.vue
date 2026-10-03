<template>
  <div class="pfw">
    <div ref="frame" class="pf" :class="{ grabbing }" @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="up" @wheel.prevent="wheel">
      <img :src="src" :style="style" alt="" draggable="false" @load="onLoad" />
      <span class="hint">тяни, чтобы выбрать область</span>
    </div>
    <div class="ctl">
      <span>−</span>
      <input type="range" min="1" max="4" step="0.01" :value="pos.zoom" aria-label="Приближение" @input="set({ zoom: +$event.target.value })" />
      <span>+</span>
      <button type="button" class="reset" title="Как было" @click="set({ x: 50, y: 20, zoom: 1 })">⟲</button>
    </div>
  </div>
</template>

<script setup>
// Выбор, какая часть портрета видна на карточке: тянешь картинку в рамке, ползунком/колёсиком — приближение.
// Рамка тех же пропорций, что и портрет на карточке.
import { computed, ref } from 'vue'

const props = defineProps({
  src: { type: String, required: true },
  modelValue: { type: Object, default: () => ({ x: 50, y: 20, zoom: 1 }) }
})
const emit = defineEmits(['update:modelValue'])
const pos = computed(() => ({ x: 50, y: 20, zoom: 1, ...props.modelValue }))
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const set = patch => emit('update:modelValue', {
  ...pos.value, ...patch,
  x: clamp(patch.x ?? pos.value.x, 0, 100), y: clamp(patch.y ?? pos.value.y, 0, 100), zoom: clamp(patch.zoom ?? pos.value.zoom, 1, 4)
})
const style = computed(() => ({
  objectPosition: `${pos.value.x}% ${pos.value.y}%`,
  transformOrigin: `${pos.value.x}% ${pos.value.y}%`,
  transform: `scale(${pos.value.zoom})`
}))

const frame = ref(null)
const natural = ref({ w: 1, h: 1 })
const onLoad = e => { natural.value = { w: e.target.naturalWidth || 1, h: e.target.naturalHeight || 1 } }

// сдвиг мыши → сдвиг точки фокуса: картинка (cover × zoom) едет вслед за курсором
let start = null
const grabbing = ref(false)
function down(e) {
  if (e.button !== 0) return
  frame.value.setPointerCapture(e.pointerId)
  start = { x: e.clientX, y: e.clientY, pos: { ...pos.value } }
  grabbing.value = true
}
function move(e) {
  if (!start) return
  const r = frame.value.getBoundingClientRect()
  const k = Math.max(r.width / natural.value.w, r.height / natural.value.h) * start.pos.zoom
  const overX = natural.value.w * k - r.width, overY = natural.value.h * k - r.height
  set({
    x: overX > 1 ? start.pos.x - ((e.clientX - start.x) / overX) * 100 : start.pos.x,
    y: overY > 1 ? start.pos.y - ((e.clientY - start.y) / overY) * 100 : start.pos.y
  })
}
function up() { start = null; grabbing.value = false }
const wheel = e => set({ zoom: pos.value.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08) })
</script>

<style scoped>
.pfw { display: grid; gap: 6px; }
.pf { position: relative; width: 100%; height: 250px; border-radius: 12px; overflow: hidden; border: 1px solid #b8893f; background: #120e09; cursor: grab; touch-action: none; user-select: none; }
.pf.grabbing { cursor: grabbing; }
.pf img { width: 100%; height: 100%; object-fit: cover; display: block; pointer-events: none; }
.hint { position: absolute; left: 50%; bottom: 8px; transform: translateX(-50%); padding: 2px 10px; border-radius: 99px; background: rgba(16, 12, 8, .8); color: #e6c27a; font: 700 11px 'Manrope', sans-serif; white-space: nowrap; opacity: .9; transition: opacity .2s; pointer-events: none; }
.pf:hover .hint, .pf.grabbing .hint { opacity: 0; }
.ctl { display: flex; align-items: center; gap: 8px; color: #a8936c; font-weight: 800; }
.ctl input { flex: 1; min-height: 0; padding: 0; border: 0; background: none; accent-color: #e6c27a; }
.reset { width: 28px; height: 28px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, .15); background: rgba(255, 255, 255, .06); color: #efe3c8; cursor: pointer; }
</style>
