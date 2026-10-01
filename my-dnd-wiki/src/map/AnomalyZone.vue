<template>
  <g :transform="`translate(${x},${y})`" :class="['zone', 'zone-' + a.effect, { faded, selected }]" :style="{ '--rise': -r * 0.5 + 'px', '--d': r * 0.08 + 'px' }">
    <!-- мягкое свечение -->
    <g class="breath">
      <path :d="blob" :fill="`url(#ag-${a.effect})`" />
    </g>

    <!-- контур -->
    <path :d="blob" fill="none" :stroke="fx.color" :stroke-width="r * 0.02" stroke-opacity="0.55" :stroke-dasharray="`${r * 0.12} ${r * 0.08}`" class="spin-slow" />

    <g v-if="a.effect === 'storm'" class="spin-fast">
      <path v-for="i in 3" :key="i" :d="spiral" :transform="`rotate(${i * 120})`" fill="none" :stroke="fx.color" :stroke-width="r * 0.04" stroke-linecap="round" opacity="0.7" />
    </g>
    <path v-if="a.effect === 'storm'" :d="bolt" fill="none" stroke="#fff" :stroke-width="r * 0.03" class="flash" />

    <g v-if="a.effect === 'rift'" class="flicker">
      <path :d="crack" fill="none" :stroke="fx.glow" :stroke-width="r * 0.16" stroke-linecap="round" stroke-linejoin="round" opacity="0.6" />
      <path :d="crack" fill="none" :stroke="fx.color" :stroke-width="r * 0.07" stroke-linecap="round" stroke-linejoin="round" />
      <path :d="crack" fill="none" stroke="#fff6d0" :stroke-width="r * 0.02" stroke-linecap="round" stroke-linejoin="round" />
    </g>

    <g v-if="a.effect === 'blight' || a.effect === 'fire'">
      <circle v-for="(b, i) in motes" :key="i" :cx="b[0]" :cy="b[1]" :r="b[2]" :fill="a.effect === 'fire' ? '#ffd27a' : fx.color"
              class="mote" :style="{ animationDelay: `${b[3]}s`, animationDuration: `${b[4]}s` }" />
    </g>

    <g v-if="a.effect === 'mist'">
      <path :d="blob" fill="#e8eef4" opacity="0.28" class="drift-a" />
      <path :d="blob" fill="#e8eef4" opacity="0.22" class="drift-b" transform="scale(0.7)" />
    </g>

    <g v-if="a.effect === 'arcane'">
      <g class="spin-mid">
        <circle :r="r * 0.72" fill="none" :stroke="fx.color" :stroke-width="r * 0.03" :stroke-dasharray="`${r * 0.05} ${r * 0.09} ${r * 0.2} ${r * 0.09}`" />
      </g>
      <g class="spin-rev">
        <circle :r="r * 0.5" fill="none" :stroke="fx.color" :stroke-width="r * 0.02" opacity="0.8" />
        <path :d="star" fill="none" :stroke="fx.color" :stroke-width="r * 0.025" opacity="0.85" />
      </g>
    </g>

    <g v-if="a.effect === 'frost'" class="spin-slow">
      <path v-for="i in 6" :key="i" :d="spoke" :transform="`rotate(${i * 60})`" fill="none" stroke="#f2fcff" :stroke-width="r * 0.03" stroke-linecap="round" opacity="0.85" />
    </g>

    <g v-if="a.effect === 'void'" class="implode">
      <circle :r="r * 0.42" fill="#07020f" :stroke="fx.color" :stroke-width="r * 0.04" />
      <circle :r="r * 0.6" fill="none" :stroke="fx.color" :stroke-width="r * 0.015" opacity="0.6" />
    </g>

    <path v-if="selected" :d="blob" fill="none" stroke="#ffe08a" :stroke-width="r * 0.035" />
  </g>
</template>

<script setup>
import { computed } from 'vue'
import { blobPath } from '../shared/geo.js'
import { ZONE_EFFECTS } from '../shared/catalog.js'

const props = defineProps({
  a: { type: Object, required: true },
  x: Number,
  y: Number,
  faded: Boolean,
  selected: Boolean
})

const r = computed(() => props.a.radius || 20)
const fx = computed(() => ZONE_EFFECTS[props.a.effect] || ZONE_EFFECTS.storm)
const blob = computed(() => blobPath(0, 0, r.value, props.a.id))

// детерминированный генератор по id — у каждой аномалии свой рисунок
function rng(seed) {
  let h = 2166136261
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296
}

const spiral = computed(() => {
  const R = r.value
  return `M${R * 0.12},0 Q${R * 0.5},${R * 0.1} ${R * 0.55},${R * 0.45} T${R * 0.2},${R * 0.85}`
})

const bolt = computed(() => {
  const R = r.value, rnd = rng(props.a.id + 'b')
  let x = -R * 0.2, y = -R * 0.55
  let d = `M${x},${y}`
  for (let i = 0; i < 5; i++) { x += (rnd() - 0.4) * R * 0.25; y += R * 0.2; d += `L${x.toFixed(1)},${y.toFixed(1)}` }
  return d
})

const crack = computed(() => {
  const R = r.value, rnd = rng(props.a.id + 'c')
  const ang = rnd() * Math.PI
  const pts = []
  for (let i = -5; i <= 5; i++) {
    const t = (i / 5) * R * 0.8
    const off = (rnd() - 0.5) * R * 0.22
    pts.push([Math.cos(ang) * t - Math.sin(ang) * off, Math.sin(ang) * t + Math.cos(ang) * off])
  }
  return 'M' + pts.map(p => p.map(v => v.toFixed(1)).join(',')).join('L')
})

const motes = computed(() => {
  const R = r.value, rnd = rng(props.a.id + 'm')
  return Array.from({ length: 9 }, () => {
    const ang = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * R * 0.7
    return [Math.cos(ang) * d, Math.sin(ang) * d, R * (0.03 + rnd() * 0.04), (rnd() * 4).toFixed(2), (2.5 + rnd() * 2.5).toFixed(2)]
  })
})

const star = computed(() => {
  const R = r.value * 0.5
  const pts = Array.from({ length: 5 }, (_, i) => {
    const ang = -Math.PI / 2 + (i * 4 * Math.PI) / 5
    return [Math.cos(ang) * R, Math.sin(ang) * R]
  })
  return 'M' + pts.map(p => p.map(v => v.toFixed(1)).join(',')).join('L') + 'Z'
})

const spoke = computed(() => {
  const R = r.value
  return `M0,${-R * 0.15} L0,${-R * 0.7} M0,${-R * 0.45} L${-R * 0.1},${-R * 0.56} M0,${-R * 0.45} L${R * 0.1},${-R * 0.56}`
})
</script>

<style scoped>
/* Вращение вокруг центра зоны: у SVG-элементов transform-origin по умолчанию — локальный (0,0) */
.zone { pointer-events: visiblePainted; cursor: pointer; }
.zone.faded { opacity: 0.35; }
.breath { animation: breath 6s ease-in-out infinite; }
.spin-slow { animation: spin 60s linear infinite; }
.spin-mid { animation: spin 24s linear infinite; }
.spin-fast { animation: spin 9s linear infinite; }
.spin-rev { animation: spin 32s linear infinite reverse; }
.flash { animation: flash 5s steps(1) infinite; opacity: 0; }
.flicker { animation: flicker 2.6s ease-in-out infinite; }
.mote { animation: rise 4s ease-in infinite; }
.drift-a { animation: drift 14s ease-in-out infinite alternate; }
.drift-b { animation: drift 10s ease-in-out infinite alternate-reverse; }
.implode { animation: implode 4s ease-in-out infinite; }

@keyframes breath { 50% { transform: scale(1.06); opacity: 0.85; } }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes flash { 0% { opacity: 0; } 82% { opacity: 0.95; } 84% { opacity: 0; } 87% { opacity: 0.7; } 89% { opacity: 0; } }
@keyframes flicker { 0%, 100% { opacity: 1; } 40% { opacity: 0.65; } 55% { opacity: 0.95; } 70% { opacity: 0.55; } }
@keyframes rise { 0% { transform: translateY(0); opacity: 0; } 20% { opacity: 1; } 100% { transform: translateY(var(--rise)); opacity: 0; } }
@keyframes drift { from { transform: translate(calc(var(--d) * -1), var(--d)) scale(0.95); } to { transform: translate(var(--d), calc(var(--d) * -1)) scale(1.05); } }
@keyframes implode { 50% { transform: scale(0.88); } }

@media (prefers-reduced-motion: reduce) {
  .zone * { animation: none !important; }
}
</style>
