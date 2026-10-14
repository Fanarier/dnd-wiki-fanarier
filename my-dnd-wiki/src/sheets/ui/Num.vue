<template>
  <!-- число, которое «набегает»: при открытии книги — от нуля, потом — от старого значения к новому -->
  <span class="num">{{ text }}</span>
</template>

<script setup>
import { computed, inject, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import gsap from 'gsap'

const props = defineProps({ value: { type: Number, default: 0 }, sign: Boolean })
const opening = inject('bookOpening', ref(false)) // книга только что открылась — считаем от нуля
const openDelay = inject('openDelay', 0)
const shown = ref(props.value)
const text = computed(() => {
  const v = Math.round(shown.value)
  return props.sign && v >= 0 ? `+${v}` : String(v)
})
const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
let tw = null
const run = (from, to, dur, delay = 0) => {
  tw?.kill()
  if (reduce || from === to) { shown.value = to; return }
  const o = { v: from }
  if (delay) shown.value = from
  tw = gsap.to(o, { v: to, duration: dur, delay, ease: 'power2.out', onUpdate: () => { shown.value = o.v } })
}
onMounted(() => { if (opening.value) run(0, props.value, 1.1 + Math.random() * 0.4, openDelay + Math.random() * 0.3) })
watch(() => props.value, (v, o) => run(o, v, Math.min(0.8, 0.25 + Math.abs(v - o) / 80)))
onBeforeUnmount(() => tw?.kill())
</script>

<style scoped>
.num { font-variant-numeric: tabular-nums; }
</style>
