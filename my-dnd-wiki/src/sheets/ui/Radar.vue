<template>
  <!-- паутина: N осей (6 атрибутов или треугольник Тело/Разум/Дух); при открытии — прорисовывается -->
  <svg class="radar" :viewBox="`0 0 ${W} ${W}`" role="img" :aria-label="aria">
    <g class="grid">
      <polygon v-for="k in rings" :key="k" :points="ring(k / rings)" />
      <line v-for="(a, i) in axes" :key="'l' + i" :x1="C" :y1="C" :x2="pt(i, 1)[0]" :y2="pt(i, 1)[1]" />
    </g>
    <polygon ref="shape" class="shape" :points="shapePts" />
    <circle v-for="(v, i) in shownVals" :key="'d' + i" class="dot" :cx="pt(i, v / max)[0]" :cy="pt(i, v / max)[1]" r="3.5" />
    <g class="lbl">
      <text v-for="(a, i) in axes" :key="'t' + i" :x="pt(i, 1.2)[0]" :y="pt(i, 1.2)[1] + 4" text-anchor="middle">
        <tspan>{{ a.label }}</tspan><tspan class="v" :x="pt(i, 1.2)[0]" dy="14">{{ Math.round(shownVals[i]) }}</tspan>
      </text>
    </g>
  </svg>
</template>

<script setup>
import { computed, inject, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import gsap from 'gsap'

const props = defineProps({ axes: { type: Array, required: true }, max: { type: Number, default: 30 }, size: { type: Number, default: 240 } })
const W = props.size, C = W / 2, R = W * 0.33
const rings = 4
const opening = inject('bookOpening', ref(false))
const vals = computed(() => props.axes.map(a => Math.max(0, Math.min(props.max, Number(a.value) || 0))))
const anim = reactive({ k: opening.value ? 0 : 1, vals: vals.value.slice() })
const shownVals = computed(() => anim.vals.map(v => v * anim.k))
const aria = computed(() => props.axes.map(a => `${a.label} ${a.value}`).join(', '))
const pt = (i, f) => {
  const ang = -Math.PI / 2 + (i * 2 * Math.PI) / props.axes.length
  return [C + Math.cos(ang) * R * f, C + Math.sin(ang) * R * f]
}
const ring = f => props.axes.map((_, i) => pt(i, f).join(',')).join(' ')
const shapePts = computed(() => shownVals.value.map((v, i) => pt(i, v / props.max).join(',')).join(' '))

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
let tw = []
onMounted(() => {
  if (opening.value && !reduce) tw.push(gsap.to(anim, { k: 1, duration: 1.3, delay: 0.35, ease: 'elastic.out(1, 0.6)' }))
  else anim.k = 1
})
watch(vals, v => {
  if (reduce) { anim.vals = v.slice(); return }
  const o = { t: 0 }, from = anim.vals.slice()
  tw.push(gsap.to(o, { t: 1, duration: 0.6, ease: 'back.out(1.6)', onUpdate: () => { anim.vals = from.map((f, i) => f + ((v[i] ?? 0) - f) * o.t) } }))
})
onBeforeUnmount(() => tw.forEach(t => t.kill()))
</script>

<style scoped>
.radar { width: 100%; max-width: var(--rs, 260px); height: auto; overflow: visible; }
.grid polygon { fill: none; stroke: color-mix(in srgb, var(--acc, #e7c56f) 18%, transparent); stroke-width: 1; }
.grid polygon:last-child { stroke: color-mix(in srgb, var(--acc, #e7c56f) 35%, transparent); }
.grid line { stroke: color-mix(in srgb, var(--acc, #e7c56f) 14%, transparent); }
.shape { fill: color-mix(in srgb, var(--acc, #e7c56f) 26%, transparent); stroke: var(--acc, #e7c56f); stroke-width: 2; stroke-linejoin: round; filter: drop-shadow(0 0 6px color-mix(in srgb, var(--acc, #e7c56f) 50%, transparent)); }
.dot { fill: var(--acc, #e7c56f); stroke: #120e09; stroke-width: 1.5; }
.lbl text { fill: var(--muted, #a8936c); font: 800 10.5px 'Manrope', sans-serif; letter-spacing: .06em; }
.lbl .v { fill: var(--ink, #efe3c8); font-size: 12.5px; }
</style>
