<template>
  <!-- рейтинг значками приложения: щелчок — поставить до этого значка (по текущему — на один меньше), правый — минус один -->
  <div class="ir" :class="{ ro }" role="slider" :aria-valuemin="0" :aria-valuemax="max" :aria-valuenow="value" :aria-label="title" :title="`${title}: ${value} из ${max}`"
       @contextmenu.prevent="set(value - 1)" @keydown.right.prevent="set(value + 1)" @keydown.left.prevent="set(value - 1)" tabindex="0">
    <button v-for="i in max" :key="i" type="button" tabindex="-1" :class="{ on: i <= value, pop: popped === i }" @click="set(i === value ? i - 1 : i)">
      <SheetIcon :name="icon" :on="i <= value" :tone="tone" />
    </button>
  </div>
</template>

<script setup>
import { computed, inject, ref } from 'vue'
import { val, edit } from '../sheetState.js'
import SheetIcon from './SheetIcon.vue'

const props = defineProps({ path: { type: String, required: true }, max: { type: Number, default: 10 }, icon: { type: String, default: 'diamond' }, title: { type: String, default: '' } })
const ro = inject('sheetReadOnly', ref(false))
// свой цвет у каждого рейтинга; владение — в цвет листа
const TONES = { eyes: '#5fd3ff', ear: '#ffc15e', aura: '#c48bff', heart: '#ff5d5d', block: '#ff9a4e' }
const tone = computed(() => TONES[props.icon] || 'var(--acc, #e7c56f)')
const raw = computed(() => val(props.path))
const value = computed(() => (typeof raw.value === 'boolean' ? (raw.value ? 1 : 0) : Number(raw.value) || 0))
const popped = ref(0)
function set(v) {
  if (ro.value) return
  v = Math.max(0, Math.min(props.max, v))
  if (v === value.value) return
  if (v > value.value) { popped.value = v; setTimeout(() => { popped.value = 0 }, 350) }
  edit(props.path, typeof raw.value === 'boolean' ? v > 0 : v)
}
</script>

<style scoped>
.ir { display: inline-flex; flex-wrap: wrap; gap: 2px; align-items: center; outline: none; border-radius: 6px; }
.ir:focus-visible { box-shadow: 0 0 0 2px var(--acc, #e7c56f); }
.ir button { display: grid; place-items: center; width: var(--ir, 24px); height: var(--ir, 24px); padding: 0; border: 0; background: none; cursor: pointer; transition: transform .15s; }
.ir.ro button { cursor: default; }
.ir button:hover { transform: translateY(-2px) scale(1.1); }
.ir button :deep(.si) { opacity: .55; transition: opacity .2s; }
.ir button.on :deep(.si) { opacity: 1; }
.ir button.pop { animation: ir-pop .35s cubic-bezier(.2, 1.6, .4, 1); }
@keyframes ir-pop { 40% { transform: scale(1.45) rotate(-8deg); } }
@media (prefers-reduced-motion: reduce) { .ir button.pop { animation: none; } }
</style>
