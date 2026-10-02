<template>
  <div class="steam-loader" :class="kind">
    <svg class="gears" viewBox="0 0 120 80" aria-hidden="true">
      <g transform="translate(42 42)"><g class="g1"><path :d="gear(26, 12, 5)" /><circle r="7" class="hole" /></g></g>
      <g transform="translate(84 28)"><g class="g2"><path :d="gear(17, 9, 4)" /><circle r="5" class="hole" /></g></g>
      <g transform="translate(86 62)"><g class="g3"><path :d="gear(12, 8, 3)" /><circle r="3.5" class="hole" /></g></g>
    </svg>
    <div class="phrase">{{ text }}</div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { phrase } from '../shared/phrases.js'

const props = defineProps({ kind: { type: String, default: 'map' } })
const text = ref(phrase(props.kind))
let timer
onMounted(() => { timer = setInterval(() => { text.value = phrase(props.kind) }, 2600) })
onBeforeUnmount(() => clearInterval(timer))

// шестерёнка: радиус, число зубцов, высота зубца
function gear(r, teeth, h) {
  const pts = []
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2, w = Math.PI / teeth * 0.55
    for (const [ang, rad] of [[a - w, r], [a - w * 0.6, r + h], [a + w * 0.6, r + h], [a + w, r]]) {
      pts.push(`${(Math.cos(ang) * rad).toFixed(1)},${(Math.sin(ang) * rad).toFixed(1)}`)
    }
  }
  return 'M' + pts.join('L') + 'Z'
}
</script>

<style scoped>
.steam-loader { display: grid; justify-items: center; gap: 14px; color: #d8b26a; }
.gears { width: 120px; height: 80px; }
.gears path { fill: currentColor; stroke: #5a3e1a; stroke-width: 1.2; }
.gears .hole { fill: #1b1610; stroke: #5a3e1a; }
.g1 { animation: spin 3.6s linear infinite; }
.g2 { animation: spin-r 2.4s linear infinite; color: #b8893f; }
.g3 { animation: spin 1.8s linear infinite; color: #e6c27a; }
.g2 path, .g3 path { fill: currentColor; }
.phrase { font: 600 italic 20px 'Cormorant Garamond', Georgia, serif; letter-spacing: .02em; text-align: center; min-height: 1.4em; animation: fade 2.6s ease-in-out infinite; }
.steam-loader.magic { color: #b9a6ff; }
.steam-loader.magic .gears path { stroke: #3a2a6a; }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes spin-r { to { transform: rotate(-360deg); } }
@keyframes fade { 0%, 100% { opacity: .55; } 30%, 70% { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .g1, .g2, .g3, .phrase { animation: none; } }
</style>
