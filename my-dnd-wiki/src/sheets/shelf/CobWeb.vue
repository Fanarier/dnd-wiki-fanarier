<template>
  <!-- паутина в верхнем углу шкафа; в правой живёт паучок: висит на нитке, от щелчка убегает наверх -->
  <svg class="cw" :class="[side, { flee }]" width="86" height="150" viewBox="0 0 86 150" aria-hidden="true">
    <g :transform="side === 'right' ? 'translate(86 0) scale(-1 1)' : null" fill="none" stroke="#e8e2d4" stroke-linecap="round">
      <path v-for="(d, i) in spokes" :key="'s' + i" :d="d" stroke-width=".55" stroke-opacity=".32" />
      <path v-for="(d, i) in rings" :key="'r' + i" :d="d" stroke-width=".45" stroke-opacity=".26" />
      <path d="M30 0 Q34 20 26 34" stroke-width=".4" stroke-opacity=".18" />
    </g>
    <clipPath :id="cid"><rect x="0" y="0" width="86" height="160" /></clipPath>
    <g v-if="side === 'right'" :clip-path="`url(#${cid})`" class="cw-spider" role="button" tabindex="0" @mousedown.prevent aria-label="Паучок" @click="scare" @keydown.enter.prevent="scare" @keydown.space.prevent="scare">
      <title>Паучок</title>
      <g class="cw-drop">
        <line x1="62" y1="-200" x2="62" y2="70" stroke="#e8e2d4" stroke-opacity=".45" stroke-width=".6" />
        <rect x="52" y="62" width="20" height="22" fill="transparent" />
        <g :transform="'translate(62 74)'">
          <g class="cw-legs" stroke="#141010" stroke-width="1" fill="none" stroke-linecap="round">
            <path d="M-2 -1 Q-7 -6 -10 -2 M-2 0 Q-8 -2 -11 2 M-2 1 Q-8 2 -10 6 M-2 2 Q-6 5 -8 9" />
            <path d="M2 -1 Q7 -6 10 -2 M2 0 Q8 -2 11 2 M2 1 Q8 2 10 6 M2 2 Q6 5 8 9" />
          </g>
          <ellipse cx="0" cy="3" rx="3.6" ry="4.2" fill="#1c1614" /><circle cx="0" cy="-2" r="2.4" fill="#241c18" />
          <circle cx="-.9" cy="-2.6" r=".5" fill="#ff5a3a" /><circle cx=".9" cy="-2.6" r=".5" fill="#ff5a3a" />
          <path d="M-1.6 1.5 Q0 3 1.6 1.5" stroke="#5a3a2a" stroke-width=".6" fill="none" />
        </g>
      </g>
    </g>
  </svg>
</template>

<script setup>
import { ref } from 'vue'

defineProps({ side: { type: String, default: 'left' } })
// паутина из угла: лучи веером и провисающие нити между ними
const ang = [2, 16, 31, 46, 61, 76, 88].map(a => (a * Math.PI) / 180)
const R = 78
const spokes = ang.map(a => `M0 0 L${(Math.cos(a) * R).toFixed(1)} ${(Math.sin(a) * R).toFixed(1)}`)
const rings = [14, 26, 39, 52, 66].map(rr => {
  let d = ''
  ang.forEach((a, i) => {
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr
    if (!i) { d += `M${x.toFixed(1)} ${y.toFixed(1)}`; return }
    const pa = ang[i - 1], mid = (a + pa) / 2, sag = rr * 0.86
    d += ` Q${(Math.cos(mid) * sag).toFixed(1)} ${(Math.sin(mid) * sag).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`
  })
  return d
})
const cid = 'cw' + Math.random().toString(36).slice(2, 8)
const flee = ref(false)
function scare() {
  if (flee.value) return
  flee.value = true
  setTimeout(() => { flee.value = false }, 4200)
}
</script>

<style scoped>
.cw { position: absolute; top: 0; display: block; overflow: visible; pointer-events: none; z-index: 2; }
.cw.left { left: 0; }
.cw.right { right: 0; }
.cw-spider { pointer-events: auto; cursor: pointer; outline: none; }
.cw-drop { animation: cw-bob 7s ease-in-out infinite; }
.cw.flee .cw-drop { animation: cw-flee 4.2s cubic-bezier(.3, 0, .2, 1); }
.cw-legs { transform-box: fill-box; transform-origin: center; animation: cw-legs 3.4s ease-in-out infinite; }
.cw.flee .cw-legs { animation-duration: .18s; }
@keyframes cw-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(16px); } }
@keyframes cw-flee { 0% { transform: translateY(0); } 18%, 60% { transform: translateY(-66px); } 100% { transform: translateY(0); } }
@keyframes cw-legs { 0%, 100% { transform: scaleX(1); } 50% { transform: scaleX(.88); } }
@media (prefers-reduced-motion: reduce) { .cw-drop, .cw-legs, .cw.flee .cw-drop { animation: none; } }
</style>
