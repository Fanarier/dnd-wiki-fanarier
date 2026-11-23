<template>
  <!-- склянки: щелчок — разбить. Осколки разлетаются, жидкость растекается лужицей; через несколько секунд склянка снова цела -->
  <svg class="bt" width="96" height="104" viewBox="0 0 96 104" aria-hidden="true">
    <ellipse cx="48" cy="102.5" rx="46" ry="3.4" fill="url(#bk-shadow)" />
    <g v-for="(b, i) in BOTTLES" :key="i">
      <!-- лужица и брызги -->
      <g v-if="state[i].broken" :key="'p' + state[i].n" class="bt-spill" :class="{ fade: state[i].mending }">
        <ellipse :cx="b.cx" cy="101" :rx="b.puddle" ry="2.6" :fill="b.liquid" opacity=".75" class="bt-puddle" />
        <ellipse :cx="b.cx - 2" cy="100.6" :rx="b.puddle * 0.5" ry="1" fill="#fff" opacity=".25" class="bt-puddle" />
        <circle v-for="(d, k) in b.drops" :key="k" :cx="b.cx" cy="96" :r="d.r" :fill="b.liquid" class="bt-drop" :style="{ '--dx': d.dx + 'px', '--dy': d.dy + 'px', animationDelay: d.t + 's' }" />
        <path v-for="(s, k) in b.shards" :key="'s' + k" :d="s.d" :fill="b.glass" fill-opacity=".55" stroke="#fff" stroke-opacity=".6" stroke-width=".5" class="bt-shard" :style="{ '--dx': s.dx + 'px', '--dy': s.dy + 'px', '--r': s.r + 'deg', transformOrigin: `${s.ox}px ${s.oy}px` }" />
      </g>
      <!-- сама склянка -->
      <g class="bt-hit" :class="{ gone: state[i].broken && !state[i].mending, back: state[i].mending }" role="button" tabindex="0" :aria-label="'Разбить: ' + b.name" @click="smash(i)" @keydown.enter.prevent="smash(i)" @keydown.space.prevent="smash(i)">
        <title>{{ b.name }} — щёлкни, чтобы разбить</title>
        <ellipse :cx="b.cx" cy="101" :rx="b.puddle * 0.7" ry="3" :fill="b.liquid" opacity=".22" filter="url(#bk-soft)" />
        <template v-if="i === 0">
          <path d="M6 100 V54 Q6 46 13 44 V30 H21 V44 Q28 46 28 54 V100 Z" fill="#163a2e" fill-opacity=".45" />
          <path d="M6 100 V68 Q17 70.5 28 68 V100 Z" fill="#2fb383" fill-opacity=".72" class="bt-liq" />
          <ellipse cx="17" cy="68.4" rx="11" ry="1.6" fill="#8ff0c8" opacity=".55" class="bt-liq" />
          <path d="M6 100 V54 Q6 46 13 44 V30 H21 V44 Q28 46 28 54 V100 Z" fill="url(#bk-glass)" />
          <path d="M6 100 V54 Q6 46 13 44 V30 H21 V44 Q28 46 28 54 V100 Z" fill="none" stroke="#d8fff0" stroke-opacity=".45" stroke-width=".9" />
          <path d="M9 56 V95" stroke="#fff" stroke-opacity=".55" stroke-width="1.8" stroke-linecap="round" />
          <rect x="11.8" y="22" width="10.4" height="9" rx="1.6" fill="#a47a48" /><rect x="11.8" y="22" width="10.4" height="9" rx="1.6" fill="url(#bk-leather)" class="bt-ov" opacity=".6" />
          <rect x="10.5" y="29.5" width="13" height="2.4" rx="1" fill="#7a2a1e" />
        </template>
        <template v-else-if="i === 1">
          <path d="M37 100 L40.5 86 H61.5 L65 100 Z" fill="#8a6a3c" /><path d="M37 100 L40.5 86 H61.5 L65 100 Z" fill="url(#bk-weave)" />
          <path d="M38.6 94 H63.4 M39.8 89.5 H62.2" stroke="#5a4020" stroke-width=".8" /><path d="M37 100 L40.5 86 H61.5 L65 100 Z" fill="url(#bk-round)" />
          <path d="M47 24 H55 V50 A21 21 0 1 1 47 50 Z" fill="#2a1638" fill-opacity=".45" />
          <path d="M31.4 78 Q51 81 70.6 78 A21 21 0 0 1 31.4 78 Z" fill="#9b4fe0" fill-opacity=".72" class="bt-liq" />
          <ellipse cx="51" cy="78.6" rx="19.6" ry="2" fill="#e0b8ff" opacity=".5" class="bt-liq" />
          <path d="M47 24 H55 V50 A21 21 0 1 1 47 50 Z" fill="url(#bk-glass)" />
          <path d="M47 24 H55 V50 A21 21 0 1 1 47 50 Z" fill="none" stroke="#f1e6ff" stroke-opacity=".45" stroke-width=".9" />
          <path d="M36 64 Q38 56 44 53" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="2" stroke-linecap="round" />
          <path d="M65 88 Q67 82 66.5 76" fill="none" stroke="#fff" stroke-opacity=".22" stroke-width="1.2" stroke-linecap="round" />
          <rect x="46" y="16" width="10" height="9" rx="1.6" fill="#a47a48" /><rect x="46" y="16" width="10" height="9" rx="1.6" fill="url(#bk-leather)" class="bt-ov" opacity=".6" />
          <path d="M45 24.5 H57" stroke="#d9c79c" stroke-width="1.4" /><path d="M56 25 q4 3 2 8" fill="none" stroke="#d9c79c" stroke-width="1" />
        </template>
        <template v-else>
          <path d="M76 100 V70 Q76 64 81 63 V57 H87 V63 Q92 64 92 70 V100 Z" fill="#3a1c10" fill-opacity=".5" />
          <path d="M76 100 V80 Q84 81.5 92 80 V100 Z" fill="#d0602a" fill-opacity=".75" class="bt-liq" />
          <rect x="77.5" y="84" width="13" height="11" fill="#e4d6b0" /><rect x="77.5" y="84" width="13" height="11" fill="url(#bk-paper)" />
          <path d="M80 88 h8 M80 91 h6" stroke="#3a2a18" stroke-opacity=".6" stroke-width=".6" />
          <path d="M76 100 V70 Q76 64 81 63 V57 H87 V63 Q92 64 92 70 V100 Z" fill="url(#bk-glass)" />
          <path d="M76 100 V70 Q76 64 81 63 V57 H87 V63 Q92 64 92 70 V100 Z" fill="none" stroke="#ffe8d8" stroke-opacity=".4" stroke-width=".8" />
          <path d="M78.4 71 V81" stroke="#fff" stroke-opacity=".5" stroke-width="1.4" stroke-linecap="round" />
          <rect x="80" y="51" width="8" height="7" rx="1.4" fill="#5a2a1e" /><ellipse cx="84" cy="51.5" rx="4" ry="1.4" fill="#8a3a2a" />
        </template>
      </g>
    </g>
  </svg>
</template>

<script setup>
import { onBeforeUnmount, reactive } from 'vue'

function rng(s) { return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9 | 0) >>> 0) / 4294967296 }
// осколки: треугольники вокруг тела склянки; летят в стороны и ложатся на полку
function shards(cx, top, bottom, w, seed) {
  const r = rng(seed), out = []
  for (let i = 0; i < 9; i++) {
    const x = cx + (r() - 0.5) * w, y = top + r() * (bottom - top), s = 2 + r() * 3.5
    const d = `M${x.toFixed(1)} ${(y - s).toFixed(1)} L${(x + s * (0.6 + r() * 0.6)).toFixed(1)} ${(y + s * 0.5).toFixed(1)} L${(x - s * (0.4 + r() * 0.6)).toFixed(1)} ${(y + s * 0.7).toFixed(1)} Z`
    out.push({ d, ox: x, oy: y, dx: ((r() - 0.5) * 46).toFixed(1), dy: (99 - y - r() * 2).toFixed(1), r: ((r() - 0.5) * 540).toFixed(0) })
  }
  return out
}
const drops = (seed) => { const r = rng(seed); return Array.from({ length: 6 }, () => ({ r: 0.7 + r() * 1.1, dx: ((r() - 0.5) * 34).toFixed(1), dy: (-8 - r() * 14).toFixed(1), t: (r() * 0.08).toFixed(2) })) }
const BOTTLES = [
  { name: 'Склянка с зельем', cx: 17, puddle: 15, liquid: '#2fb383', glass: '#bff5dd', shards: shards(17, 44, 98, 20, 3), drops: drops(5) },
  { name: 'Колба с фиолетовым эликсиром', cx: 51, puddle: 22, liquid: '#9b4fe0', glass: '#ead6ff', shards: shards(51, 48, 88, 34, 7), drops: drops(9) },
  { name: 'Пузырёк', cx: 84, puddle: 11, liquid: '#d0602a', glass: '#ffd9c2', shards: shards(84, 62, 98, 14, 11), drops: drops(13) }
]
const state = reactive(BOTTLES.map(() => ({ broken: false, mending: false, n: 0 })))
const timers = []
function smash(i) {
  const st = state[i]
  if (st.broken) return
  st.broken = true; st.mending = false; st.n++
  // склянка «сама собирается» через 9 секунд: лужица и осколки тают, стекло проявляется
  timers.push(setTimeout(() => { st.mending = true }, 9000))
  timers.push(setTimeout(() => { st.broken = false; st.mending = false }, 9900))
}
onBeforeUnmount(() => timers.forEach(clearTimeout))
</script>

<style scoped>
.bt { display: block; overflow: visible; }
.bt-ov { mix-blend-mode: overlay; }
.bt-hit { pointer-events: auto; cursor: pointer; outline: none; transition: opacity .9s ease-out; }
.bt-hit:focus-visible { filter: drop-shadow(0 0 4px rgba(243, 220, 158, .8)); }
.bt-hit.gone { opacity: 0; transition: opacity .05s; pointer-events: none; }
.bt-hit.back { opacity: 1; }
.bt-spill { transition: opacity .8s ease-out; }
.bt-spill.fade { opacity: 0; }
.bt-shard { animation: bt-fly .7s cubic-bezier(.2, .7, .4, 1) both; }
@keyframes bt-fly { 0% { transform: none; } 35% { transform: translate(calc(var(--dx) * .55), -12px) rotate(calc(var(--r) * .5)); } 100% { transform: translate(var(--dx), var(--dy)) rotate(var(--r)); } }
.bt-puddle { transform-box: fill-box; transform-origin: center; animation: bt-spread .9s cubic-bezier(.2, .8, .3, 1) both; animation-delay: .12s; }
@keyframes bt-spread { from { transform: scaleX(0); } }
.bt-drop { opacity: 0; animation: bt-splash .6s ease-out both; }
@keyframes bt-splash { 0% { opacity: 1; transform: none; } 45% { opacity: 1; transform: translate(calc(var(--dx) * .6), var(--dy)); } 100% { opacity: 0; transform: translate(var(--dx), 5px); } }
@media (prefers-reduced-motion: reduce) { .bt-shard, .bt-puddle, .bt-drop { animation-duration: .01s; } }
</style>
