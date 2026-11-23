<template>
  <!-- свеча и фонарь. Свечу щелчком задувают (дымок) и зажигают снова; по фонарю можно щёлкнуть пальцем — он качается, огонёк вздрагивает -->
  <span class="cd" :class="[kind, { off: !lit, jolt }]" :style="flick">
    <span class="cd-light" :style="{ bottom: kind === 'lantern' ? '50%' : '62%' }" />
    <!-- пылинки в свете -->
    <span class="cd-dust" :style="{ bottom: kind === 'lantern' ? '50%' : '62%' }" aria-hidden="true">
      <i v-for="(m, i) in motes" :key="i" :style="m" />
    </span>
    <svg :width="size.w" :height="size.h" :viewBox="`0 0 ${size.w} ${size.h}`" aria-hidden="true">
      <ellipse :cx="size.w / 2" :cy="size.h - 1.5" :rx="size.w * 0.48" ry="3.4" fill="url(#bk-shadow)" />

      <!-- свеча в латунном подсвечнике -->
      <g v-if="kind === 'candle'" class="cd-hit" role="button" tabindex="0" :aria-label="lit ? 'Задуть свечу' : 'Зажечь свечу'" @click="toggle" @keydown.enter.prevent="toggle" @keydown.space.prevent="toggle">
        <title>{{ lit ? 'Задуть свечу' : 'Зажечь свечу' }}</title>
        <rect x="0" y="0" :width="size.w" :height="size.h" fill="transparent" />
        <circle cx="28.4" cy="30" r="16" fill="url(#bk-candle)" class="cd-halo" />
        <path d="M46 84 a7 7 0 1 1 6 -9" fill="none" stroke="url(#bk-brass-h)" stroke-width="2.6" stroke-linecap="round" />
        <ellipse cx="28" cy="88" rx="25" ry="5.5" fill="url(#bk-brass)" /><ellipse cx="28" cy="86.4" rx="20" ry="3.6" fill="#8a6326" /><ellipse cx="28" cy="86" rx="18" ry="3" fill="url(#bk-brass)" opacity=".7" />
        <rect x="22" y="80" width="12" height="6" fill="url(#bk-brass-h)" /><ellipse cx="28" cy="80" rx="8.5" ry="2.4" fill="url(#bk-brass)" />
        <rect x="21" y="44" width="14" height="36" fill="url(#bk-wax)" />
        <ellipse cx="28" cy="44" rx="7" ry="2.2" fill="#e9dcbc" /><ellipse cx="28" cy="44.4" rx="5" ry="1.4" fill="#cdbd96" />
        <path d="M21 45 q-.8 7 .4 12 q.9 3 1.6 -1 q.4 -6 .6 -11 Z M34.8 45 q.9 4 .2 8 q-.6 2.4 -1.3 -1 Z" fill="#f3ead3" />
        <line x1="28" y1="44" x2="28.4" y2="39" :stroke="lit ? '#2a1d12' : '#1a120c'" stroke-width="1.1" stroke-linecap="round" />
        <circle v-if="!lit" cx="28.4" cy="39" r=".9" fill="#ff7a2a" class="cd-ember" />
        <g transform="translate(28.4 39)"><g class="cd-flame"><g class="sd-fa"><g class="sd-fb">
          <path d="M0 -20 C5 -11 6.2 -5 4.3 -1 C2.8 1.6 -2.8 1.6 -4.3 -1 C-6.2 -5 -5 -11 0 -20 Z" fill="url(#bk-flame)" />
          <path d="M0 -10 C2 -5.6 2.4 -2.8 1.5 -1 C.8 .3 -.8 .3 -1.5 -1 C-2.4 -2.8 -2 -5.6 0 -10 Z" fill="#fffbe8" />
          <ellipse cx="0" cy="-.6" rx="1.7" ry="1.1" fill="#6aa8ff" opacity=".6" />
        </g></g></g></g>
        <!-- дымок после того, как задули -->
        <g v-if="smoke" :key="smoke" fill="none" stroke="#cfc8bc" stroke-linecap="round" filter="url(#bk-soft)">
          <path class="cd-smoke" d="M28.4 38 C25 32 32 27 28 20 C25 15 30 10 28 4" stroke-width="2.4" />
          <path class="cd-smoke two" d="M28.4 38 C31 33 25 28 29 22 C32 17 27 12 29.5 6" stroke-width="1.6" />
        </g>
      </g>

      <!-- фонарь: кованая рамка, свеча за стеклом -->
      <g v-else class="cd-hit cd-swing" :class="{ go: swing }" role="button" tabindex="0" aria-label="Щёлкнуть по фонарю" @click="tap" @keydown.enter.prevent="tap" @keydown.space.prevent="tap" @animationend="onSwingEnd">
        <title>Щёлкнуть по фонарю</title>
        <rect x="10" y="0" width="64" height="140" fill="transparent" />
        <circle cx="42" cy="66" r="20" fill="url(#bk-candle)" class="cd-halo" />
        <path d="M33 14 a9 9 0 0 1 18 0" fill="none" stroke="url(#bk-blackiron-h)" stroke-width="3" />
        <path d="M28 22 H56 L66 36 H18 Z" fill="url(#bk-blackiron)" /><circle cx="42" cy="19" r="4" fill="url(#bk-blackiron)" />
        <rect x="20" y="36" width="44" height="86" fill="#ffcf8a" opacity=".08" class="cd-glass" />
        <rect x="35" y="90" width="14" height="32" fill="url(#bk-wax)" /><ellipse cx="42" cy="90" rx="7" ry="2" fill="#f6eedb" /><path d="M36.5 90 q-1 6 .6 10 q1.2 2 1.2 -3 Z" fill="#efe3c4" />
        <line x1="42" y1="90" x2="42" y2="85" stroke="#2a1d12" stroke-width="1.1" />
        <g transform="translate(42 85)"><g class="cd-flame"><g class="sd-fa"><g class="sd-fb">
          <path d="M0 -21 C5 -12 6.5 -5 4.5 -1 C3 1.6 -3 1.6 -4.5 -1 C-6.5 -5 -5 -12 0 -21 Z" fill="url(#bk-flame)" />
          <path d="M0 -11 C2.2 -6 2.6 -3 1.6 -1 C.9 .3 -.9 .3 -1.6 -1 C-2.6 -3 -2.2 -6 0 -11 Z" fill="#fffbe8" />
          <ellipse cx="0" cy="-.6" rx="1.8" ry="1.2" fill="#6aa8ff" opacity=".6" />
        </g></g></g></g>
        <rect x="20" y="36" width="44" height="86" fill="url(#bk-glass)" />
        <rect x="20" y="36" width="44" height="86" rx="1" fill="none" stroke="url(#bk-blackiron-h)" stroke-width="3.4" />
        <g fill="none" stroke="#1c1d1f" stroke-width="1.6"><line x1="42" y1="36" x2="42" y2="62" /><line x1="20" y1="62" x2="64" y2="62" /></g>
        <path d="M12 122 H72 L68 132 H16 Z" fill="url(#bk-blackiron)" /><line x1="13" y1="122.8" x2="71" y2="122.8" stroke="#fff" stroke-opacity=".3" stroke-width=".8" />
        <rect x="18" y="132" width="9" height="6" rx="1" fill="#1c1d1f" /><rect x="57" y="132" width="9" height="6" rx="1" fill="#1c1d1f" />
      </g>
    </svg>
  </span>
</template>

<script setup>
import { computed, ref } from 'vue'
import { DECOR, flicker } from './decor.js'

const props = defineProps({ kind: { type: String, required: true }, seed: { type: Number, default: 1 } })
const size = computed(() => DECOR[props.kind])
const flick = computed(() => flicker(props.seed))
const lit = ref(true), smoke = ref(0), swing = ref(false), jolt = ref(false)
// пылинки: у каждой своё место, путь и ритм
const motes = computed(() => {
  let s = props.seed * 7349 + 11
  const r = () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9 | 0) >>> 0) / 4294967296
  return Array.from({ length: 9 }, () => ({
    left: (r() * 160 - 80).toFixed(0) + 'px', top: (r() * 120 - 70).toFixed(0) + 'px',
    width: (1 + r() * 1.6).toFixed(1) + 'px', '--mx': (r() * 30 - 15).toFixed(0) + 'px', '--my': (-14 - r() * 26).toFixed(0) + 'px',
    animationDuration: (7 + r() * 8).toFixed(1) + 's', animationDelay: (-r() * 12).toFixed(1) + 's'
  }))
})
function toggle() {
  lit.value = !lit.value
  if (!lit.value) smoke.value++
}
function tap() {
  // щелчок во время качания — качнуть заново
  swing.value = false
  jolt.value = false
  setTimeout(() => { swing.value = true; jolt.value = true; setTimeout(() => { jolt.value = false }, 700) }, 30)
}
const onSwingEnd = e => { if (e.animationName.includes('cd-swing')) swing.value = false }
</script>

<style scoped>
.cd { position: relative; display: block; }
.cd svg { display: block; overflow: visible; }
.cd-hit { pointer-events: auto; cursor: pointer; outline: none; }
.cd-hit:focus-visible { filter: drop-shadow(0 0 4px rgba(243, 220, 158, .8)); }
/* свет свечи на задник и соседние книги */
.cd-light { position: absolute; left: 50%; width: 300px; height: 230px; transform: translate(-50%, 50%); pointer-events: none; mix-blend-mode: screen; border-radius: 50%;
  background: radial-gradient(closest-side, rgba(255, 176, 84, .3), rgba(255, 150, 60, .1) 55%, transparent);
  animation: cd-light calc(var(--ft, 1.6s) * 1.4) ease-in-out infinite; animation-delay: var(--fd, 0s); transition: opacity .45s ease-out; }
.cd.lantern .cd-light { width: 440px; height: 320px; }
.cd-dust { position: absolute; left: 50%; width: 0; height: 0; pointer-events: none; transition: opacity .6s; }
.cd-dust i { position: absolute; aspect-ratio: 1; border-radius: 50%; background: #ffe2a8; box-shadow: 0 0 3px rgba(255, 210, 140, .8); opacity: 0; animation: cd-mote ease-in-out infinite; }
.cd.off .cd-dust { opacity: 0; }
@keyframes cd-mote { 0% { opacity: 0; transform: translate(0, 0); } 25% { opacity: .75; } 70% { opacity: .5; } 100% { opacity: 0; transform: translate(var(--mx), var(--my)); } }
.cd.off .cd-light, .cd.off .cd-halo { opacity: 0; animation: none; }
.cd.jolt .cd-light { animation: cd-jolt-light .7s ease-out; }
.cd-halo { mix-blend-mode: screen; transition: opacity .3s; }
@keyframes cd-light { 0%, 100% { opacity: .85; } 31% { opacity: 1; } 52% { opacity: .72; } 77% { opacity: .93; } }
@keyframes cd-jolt-light { 0% { opacity: 1; } 20% { opacity: .35; } 45% { opacity: .9; } 60% { opacity: .5; } 100% { opacity: .9; } }

/* пламя гаснет и разгорается */
.cd-flame { transform-box: fill-box; transform-origin: 50% 100%; transition: transform .28s ease-out, opacity .22s ease-out; }
.cd.off .cd-flame { transform: scale(.25, 0); opacity: 0; transition: transform .2s ease-in, opacity .18s ease-in; }
.cd.jolt .cd-flame { animation: cd-jolt .7s ease-out; }
@keyframes cd-jolt { 0% { transform: scale(1); } 15% { transform: scale(.6, .45) skewX(14deg); } 35% { transform: scale(1.15, 1.2) skewX(-10deg); } 55% { transform: scale(.85, .8) skewX(6deg); } 100% { transform: scale(1); } }
.cd-ember { animation: cd-ember 1.6s ease-out forwards; }
@keyframes cd-ember { 0% { opacity: 1; } 100% { opacity: 0; } }
.cd-smoke { stroke-dasharray: 60; stroke-dashoffset: 60; opacity: .7; animation: cd-smoke 2.6s ease-out forwards; }
.cd-smoke.two { animation-delay: .25s; animation-duration: 2.2s; }
@keyframes cd-smoke { 0% { stroke-dashoffset: 60; opacity: .75; transform: translateY(0); } 60% { opacity: .45; } 100% { stroke-dashoffset: 0; opacity: 0; transform: translateY(-14px); } }

/* фонарь качается на кольце */
.cd-swing { transform-box: view-box; transform-origin: 42px 8px; }
.cd-swing.go { animation: cd-swing 1.9s cubic-bezier(.3, .6, .4, 1); }
@keyframes cd-swing { 0% { transform: rotate(0); } 12% { transform: rotate(-9deg); } 30% { transform: rotate(6.5deg); } 48% { transform: rotate(-4deg); } 66% { transform: rotate(2.2deg); } 82% { transform: rotate(-1deg); } 100% { transform: rotate(0); } }

/* пламя: качание и мерцание с разными периодами — у каждой свечи свои */
.sd-fa { animation: sd-sway calc(var(--ft, 1.6s) * 1.9) ease-in-out infinite; animation-delay: var(--fd, 0s); transform-box: fill-box; transform-origin: 50% 100%; }
.sd-fb { animation: sd-flick var(--ft, 1.6s) ease-in-out infinite; animation-delay: calc(var(--fd, 0s) * 1.3); transform-box: fill-box; transform-origin: 50% 100%; }
@keyframes sd-sway { 0%, 100% { transform: rotate(0); } 22% { transform: rotate(-2.6deg); } 47% { transform: rotate(1.4deg); } 71% { transform: rotate(-1deg); } 88% { transform: rotate(2.2deg); } }
@keyframes sd-flick { 0%, 100% { transform: scale(1, 1); } 13% { transform: scale(.96, 1.05); } 29% { transform: scale(1.03, .94); } 41% { transform: scale(.98, 1.07); } 63% { transform: scale(1.02, .97); } 82% { transform: scale(.97, 1.03); } }
@media (prefers-reduced-motion: reduce) {
  .cd-dust { display: none; }
  .cd-light, .sd-fa, .sd-fb, .cd-swing.go, .cd.jolt .cd-flame, .cd.jolt .cd-light, .cd-smoke { animation: none; }
  .cd-flame, .cd-light { transition: none; }
  .cd-smoke { opacity: 0; }
}
</style>
