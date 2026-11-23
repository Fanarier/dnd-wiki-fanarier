<template>
  <!-- песочные часы: щелчок переворачивает их, и песок минуту сыплется вниз -->
  <svg class="hg" :class="{ flip: flipping, instant }" width="60" height="112" viewBox="0 0 60 112" role="button" tabindex="0"
    :aria-label="running ? 'Песочные часы: песок сыплется. Перевернуть' : 'Песочные часы. Перевернуть'"
    @click="flip" @keydown.enter.prevent="flip" @keydown.space.prevent="flip">
    <title>{{ running ? 'Песок сыплется. Щёлкни, чтобы перевернуть' : 'Щёлкни, чтобы перевернуть' }}</title>
    <defs>
      <clipPath :id="id + 't'"><path d="M14.6 13 C14.6 30 26 44 28.7 56 H31.3 C34 44 45.4 30 45.4 13 Z" /></clipPath>
      <clipPath :id="id + 'b'"><path d="M28.7 56 C26 68 14.6 82 14.6 99 H45.4 C45.4 82 34 68 31.3 56 Z" /></clipPath>
      <linearGradient :id="id + 's'" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stop-color="#a87a3a" /><stop offset=".4" stop-color="#e8c47e" /><stop offset=".7" stop-color="#d6ac62" /><stop offset="1" stop-color="#9a6e32" />
      </linearGradient>
    </defs>
    <ellipse cx="30" cy="109" rx="27" ry="3.2" fill="url(#bk-shadow)" />
    <g class="hg-body" :style="{ transform: `rotate(${rot}deg)` }" @transitionend="landed">
      <!-- задняя стойка сквозь стекло -->
      <rect x="28.4" y="12" width="3.2" height="88" fill="#3a2312" opacity=".55" />
      <!-- песок -->
      <g :clip-path="`url(#${id}t)`">
        <path :d="topSand" :fill="`url(#${id}s)`" />
      </g>
      <g :clip-path="`url(#${id}b)`">
        <path :d="botSand" :fill="`url(#${id}s)`" />
      </g>
      <line v-if="running && !flipping" class="hg-stream" x1="30" y1="55" x2="30" :y2="streamEnd" stroke="#e2bd74" stroke-width="1" stroke-dasharray="1.6 1.2" />
      <!-- стекло -->
      <path d="M14.6 13 C14.6 30 26 44 28.7 56 C26 68 14.6 82 14.6 99 H45.4 C45.4 82 34 68 31.3 56 C34 44 45.4 30 45.4 13 Z" fill="#cfe6ee" fill-opacity=".1" stroke="#e4f2f6" stroke-opacity=".55" stroke-width=".9" />
      <path d="M17.5 16 C17.5 28 23 38 26.5 47 M17.5 96 C17.5 86 22 77 25.5 68" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="1.6" stroke-linecap="round" />
      <path d="M42.6 18 C42 28 39 35 35.8 42" fill="none" stroke="#fff" stroke-opacity=".2" stroke-width="1" stroke-linecap="round" />
      <!-- стойки -->
      <g v-for="x in [7, 49.5]" :key="x">
        <rect :x="x" y="12" width="3.5" height="88" fill="url(#bk-wood-h)" />
        <ellipse :cx="x + 1.75" cy="34" rx="2.6" ry="3.4" fill="url(#bk-wood-h)" /><ellipse :cx="x + 1.75" cy="56" rx="2.2" ry="2.2" fill="url(#bk-wood-h)" /><ellipse :cx="x + 1.75" cy="78" rx="2.6" ry="3.4" fill="url(#bk-wood-h)" />
      </g>
      <!-- торцы: точёное дерево -->
      <g v-for="y in [3, 99]" :key="y">
        <rect x="3" :y="y" width="54" height="10" rx="3" fill="url(#bk-wood)" />
        <rect x="3" :y="y" width="54" height="10" rx="3" fill="url(#bk-woodgrain)" opacity=".55" />
        <rect x="5" :y="y + (y < 50 ? 8 : 0)" width="50" height="2" fill="#000" opacity=".35" />
        <line x1="6" x2="54" :y1="y + 1.2" :y2="y + 1.2" stroke="#fff" stroke-opacity=".28" stroke-width=".8" />
        <circle v-for="cx in [8.75, 51.25]" :key="cx" :cx="cx" :cy="y + 5" r="1.1" fill="url(#bk-brass)" />
      </g>
    </g>
  </svg>
</template>

<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'

// сколько песка сверху: 1 — весь, 0 — весь внизу. Сначала — весь внизу, часы ждут, чтобы их перевернули
const DURATION = 60000
const id = 'hg' + Math.random().toString(36).slice(2, 8)
const top = ref(0), rot = ref(0), flipping = ref(false), instant = ref(false)
const running = computed(() => top.value > 0.001)
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches

// верхняя колба: песок ровной поверхностью с ямкой воронки посередине
const topSand = computed(() => {
  const f = top.value
  if (f <= 0.002) return ''
  const y = 56 - 41 * Math.pow(f, 0.62), dip = Math.min(3.5, 1 + f * 3)
  return `M10 ${y.toFixed(2)} L25 ${y.toFixed(2)} Q30 ${(y + dip * 2).toFixed(2)} 35 ${y.toFixed(2)} L50 ${y.toFixed(2)} V60 H10 Z`
})
// нижняя колба: горка растёт
const botSand = computed(() => {
  const f = 1 - top.value
  if (f <= 0.002) return ''
  const h = 34 * Math.pow(f, 0.72), side = 99 - h * 0.42
  return `M10 99 V${side.toFixed(2)} Q30 ${(99 - h * 1.18).toFixed(2)} 50 ${side.toFixed(2)} V99 Z`
})
const streamEnd = computed(() => (99 - 34 * Math.pow(1 - top.value, 0.72) * 0.98).toFixed(1))

// песок сыплется только пока часы стоят
let raf = 0, last = 0
function tick(t) {
  if (!last) last = t
  const dt = Math.min(200, t - last)
  last = t
  if (!flipping.value) top.value = Math.max(0, top.value - dt / DURATION)
  raf = top.value > 0 ? requestAnimationFrame(tick) : 0
  if (!raf) last = 0
}
function run() { if (!raf && top.value > 0) { last = 0; raf = requestAnimationFrame(tick) } }

function flip() {
  if (flipping.value) return
  if (reduce()) { top.value = 1 - top.value; run(); return }
  instant.value = false
  flipping.value = true
  rot.value = 180
}
// перевернулись: возвращаем «верх» на место без анимации и меняем колбы местами
function landed(e) {
  if (e.propertyName !== 'transform' || !flipping.value) return
  instant.value = true
  rot.value = 0
  top.value = 1 - top.value
  flipping.value = false
  run()
}
onBeforeUnmount(() => cancelAnimationFrame(raf))
</script>

<style scoped>
.hg { display: block; overflow: visible; pointer-events: auto; cursor: pointer; outline: none; }
.hg-body { transform-box: view-box; transform-origin: 30px 56px; transition: transform .72s cubic-bezier(.645, .045, .355, 1); }
.hg.instant .hg-body { transition: none; }
.hg:focus-visible .hg-body { filter: drop-shadow(0 0 4px rgba(243, 220, 158, .8)); }
.hg:hover .hg-body { filter: brightness(1.12); }
.hg-ov { mix-blend-mode: overlay; }
.hg-stream { animation: hg-fall .5s linear infinite; }
@keyframes hg-fall { to { stroke-dashoffset: -2.8; } }
@media (prefers-reduced-motion: reduce) { .hg-body { transition: none; } .hg-stream { animation: none; } }
</style>
