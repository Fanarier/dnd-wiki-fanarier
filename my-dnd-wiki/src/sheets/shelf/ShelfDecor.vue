<template>
  <!-- вещи на полках стеллажа: фонарь со свечой, стопки, глобус, склянки, картина и ряды старых томов без имени -->
  <svg class="sd" :class="kind" :width="size.w" :height="size.h" :viewBox="`0 0 ${size.w} ${size.h}`" aria-hidden="true">
    <!-- ряд безымянных томов -->
    <g v-if="kind === 'tomes'">
      <g v-for="(b, i) in tomes" :key="i" :transform="b.lean ? `rotate(${b.lean} ${b.x + b.w} ${size.h})` : null">
        <rect :x="b.x" :y="size.h - b.h" :width="b.w" :height="b.h" rx="2" :fill="b.c" />
        <rect :x="b.x" :y="size.h - b.h" :width="b.w" :height="b.h" rx="2" filter="url(#bk-grain)" opacity=".45" />
        <g v-for="y in b.bands" :key="y"><rect :x="b.x" :y="size.h - b.h + y" :width="b.w" height="4" fill="#0005" /><line :x1="b.x" :x2="b.x + b.w" :y1="size.h - b.h + y" :y2="size.h - b.h + y" stroke="#fff" stroke-opacity=".14" /></g>
        <rect v-if="b.plate" :x="b.x + 3" :y="size.h - b.h * 0.72" :width="b.w - 6" :height="b.h * 0.2" fill="#b8975033" stroke="#b8975066" stroke-width=".6" />
        <rect :x="b.x" :y="size.h - b.h" :width="b.w" :height="b.h" rx="2" fill="url(#bk-round)" />
      </g>
    </g>

    <!-- стопка лежащих книг -->
    <g v-else-if="kind === 'stack'">
      <g v-for="(b, i) in stack" :key="i">
        <rect :x="b.x" :y="b.y" :width="b.w" :height="b.h" rx="2" :fill="b.c" /><rect :x="b.x" :y="b.y" :width="b.w" :height="b.h" rx="2" filter="url(#bk-grain)" opacity=".4" />
        <rect :x="b.x + b.w - 7" :y="b.y + 2.5" width="7" :height="b.h - 5" fill="#d9cba2" /><path :d="`M${b.x + b.w - 7} ${b.y + b.h * 0.35} h7 M${b.x + b.w - 7} ${b.y + b.h * 0.65} h7`" stroke="#8a7a52" stroke-width=".5" />
        <line :x1="b.x" :x2="b.x + b.w" :y1="b.y + 0.6" :y2="b.y + 0.6" stroke="#fff" stroke-opacity=".2" /><rect :x="b.x + 12" :y="b.y" width="3" :height="b.h" fill="#0004" /><rect :x="b.x + b.w * 0.5" :y="b.y" width="3" :height="b.h" fill="#0004" />
      </g>
    </g>

    <!-- фонарь: свеча за стеклом -->
    <g v-else-if="kind === 'lantern'">
      <circle cx="42" cy="78" r="46" fill="url(#bk-candle)" class="sd-glow" />
      <circle cx="42" cy="11" r="8" fill="none" stroke="#3a3029" stroke-width="3" />
      <path d="M30 20 H54 L64 34 H20 Z" fill="#2c2520" /><path d="M30 20 H54 L56 23 H28 Z" fill="#fff" opacity=".12" />
      <rect x="18" y="34" width="48" height="90" fill="#ffb95a" opacity=".1" />
      <rect x="35.5" y="88" width="13" height="34" rx="1.5" fill="#efe3c2" /><path d="M35.5 92 q3 5 2 12 M46 90 q-2 6 0 9" stroke="#d9c9a0" stroke-width="1.4" fill="none" />
      <line x1="42" y1="88" x2="42" y2="82" stroke="#2a1d12" stroke-width="1.2" />
      <g class="sd-flame"><path d="M42 62 Q50 74 46.5 81 Q44 85 42 85 Q40 85 37.5 81 Q34 74 42 62 Z" fill="#ffb347" /><path d="M42 70 Q46 77 44.2 81 Q43 83.5 42 83.5 Q41 83.5 39.8 81 Q38 77 42 70 Z" fill="#fff3c4" /></g>
      <g fill="none" stroke="#2c2520" stroke-width="4"><rect x="18" y="34" width="48" height="90" /><line x1="42" y1="34" x2="42" y2="58" stroke-width="2.4" /><line x1="18" y1="58" x2="66" y2="58" stroke-width="2.4" /></g>
      <line x1="19.5" y1="36" x2="19.5" y2="122" stroke="#fff" stroke-opacity=".14" />
      <path d="M10 124 H74 V134 H10 Z" fill="#2c2520" /><path d="M10 124 H74 V126.4 H10 Z" fill="#fff" opacity=".13" /><rect x="14" y="134" width="8" height="6" fill="#211b17" /><rect x="62" y="134" width="8" height="6" fill="#211b17" />
    </g>

    <!-- огарок на блюдце -->
    <g v-else-if="kind === 'candle'">
      <circle cx="27" cy="34" r="30" fill="url(#bk-candle)" class="sd-glow" />
      <ellipse cx="27" cy="77" rx="24" ry="5" fill="#6b5a3c" /><ellipse cx="27" cy="75.5" rx="20" ry="3.4" fill="#8a7650" />
      <path d="M19 76 V48 Q19 45 22 45 H32 Q35 45 35 48 V76 Z" fill="#efe3c2" /><path d="M19 52 q-3 6 -1 12 q1 4 1 -2 Z M35 50 q3 8 1 16 q-1 2 -1 -4 Z" fill="#e2d4ae" />
      <line x1="27" y1="45" x2="27" y2="40" stroke="#2a1d12" stroke-width="1.2" />
      <g class="sd-flame"><path d="M27 22 Q34 33 31 39 Q29 42.5 27 42.5 Q25 42.5 23 39 Q20 33 27 22 Z" fill="#ffb347" /><path d="M27 29 Q30.5 35 29 38.6 Q28 40.6 27 40.6 Q26 40.6 25 38.6 Q23.5 35 27 29 Z" fill="#fff3c4" /></g>
    </g>

    <!-- глобус -->
    <g v-else-if="kind === 'globe'">
      <path d="M22 118 H62 L56 108 H28 Z" fill="#4a3320" /><rect x="39" y="92" width="6" height="18" fill="#6b4a2c" />
      <path d="M12 52 A30 30 0 0 0 72 52" fill="none" stroke="#b8893f" stroke-width="3" transform="rotate(18 42 52)" />
      <circle cx="42" cy="52" r="26" fill="#2f5560" /><circle cx="42" cy="52" r="26" filter="url(#bk-grain)" opacity=".35" />
      <path d="M26 40 q8 -8 16 -3 q4 4 -2 8 q-8 2 -10 8 q-6 -4 -4 -13 Z M46 56 q10 -4 14 4 q-2 10 -10 12 q-6 -6 -4 -16 Z M40 28 q8 -3 14 2 q-6 5 -14 -2 Z" fill="#b89a5e" opacity=".85" />
      <path d="M16 52 H68 M42 26 V78 M20 38 Q42 46 64 38 M20 66 Q42 58 64 66" stroke="#0004" stroke-width=".7" fill="none" />
      <circle cx="42" cy="52" r="26" fill="url(#bk-ball)" />
    </g>

    <!-- песочные часы -->
    <g v-else-if="kind === 'hourglass'">
      <rect x="6" y="4" width="38" height="6" rx="2" fill="#6b4a2c" /><rect x="6" y="80" width="38" height="6" rx="2" fill="#6b4a2c" />
      <rect x="9" y="10" width="3" height="70" fill="#4a3320" /><rect x="38" y="10" width="3" height="70" fill="#4a3320" />
      <path d="M14 10 H36 Q36 34 26.5 45 Q36 56 36 80 H14 Q14 56 23.5 45 Q14 34 14 10 Z" fill="#cfe3e6" opacity=".22" stroke="#cfe3e6" stroke-opacity=".5" />
      <path d="M17 24 H33 Q31 36 25 43.5 Q19 36 17 24 Z" fill="#d9b25c" /><path d="M16 80 Q17 66 25 62 Q33 66 34 80 Z" fill="#d9b25c" /><line x1="25" y1="44" x2="25" y2="62" stroke="#d9b25c" stroke-width="1" />
    </g>

    <!-- склянки -->
    <g v-else-if="kind === 'bottles'">
      <g><rect x="12" y="34" width="8" height="12" fill="#3c4a44" /><rect x="10.5" y="30" width="11" height="5" rx="1.5" fill="#8a6a3c" /><path d="M6 96 V58 Q6 48 12 46 H20 Q26 48 26 58 V96 Z" fill="#2c5a4a" opacity=".85" /><path d="M6 96 V70 H26 V96 Z" fill="#49d6a2" opacity=".5" /><path d="M9 56 V90" stroke="#fff" stroke-opacity=".3" stroke-width="1.6" /></g>
      <g><rect x="42" y="18" width="7" height="22" fill="#4a3a52" /><rect x="40.5" y="13" width="10" height="6" rx="1.5" fill="#8a6a3c" /><circle cx="45.5" cy="72" r="20" fill="#4a2a5c" opacity=".88" /><path d="M27 78 A20 20 0 0 0 64 78 Z" fill="#c05cff" opacity=".5" /><path d="M32 62 q3 -8 9 -9" stroke="#fff" stroke-opacity=".35" stroke-width="1.8" fill="none" /><rect x="34" y="92" width="23" height="4" fill="#0003" /></g>
      <g><rect x="74" y="46" width="6" height="10" fill="#5c3a2a" /><rect x="72.5" y="42" width="9" height="5" rx="1.5" fill="#8a6a3c" /><path d="M68 96 V64 L74 56 H80 L86 64 V96 Z" fill="#6a2a22" opacity=".9" /><path d="M68 96 V76 H86 V96 Z" fill="#ff7a4a" opacity=".5" /><rect x="70" y="70" width="14" height="10" fill="#e4d6b0" opacity=".85" /></g>
    </g>

    <!-- картина: парусник -->
    <g v-else-if="kind === 'frame'">
      <g transform="rotate(-3 55 126)">
        <rect x="4" y="16" width="102" height="110" fill="#5a3d22" /><rect x="4" y="16" width="102" height="110" filter="url(#bk-grain)" opacity=".4" />
        <rect x="8" y="20" width="94" height="102" fill="none" stroke="#b8893f" stroke-width="1.4" />
        <rect x="14" y="26" width="82" height="90" fill="#3d6470" /><path d="M14 80 Q34 74 55 80 T96 80 V116 H14 Z" fill="#1f4350" /><path d="M14 92 Q30 88 46 92 T78 92 T96 92" stroke="#7fb0b8" stroke-width="1" fill="none" opacity=".6" />
        <path d="M54 40 V80 M54 42 L76 76 H54 Z" fill="#e9e0c8" stroke="#3a2a1c" stroke-width="1" /><path d="M52 46 L34 76 H52 Z" fill="#d9cfb4" /><path d="M30 80 H80 L74 88 H36 Z" fill="#3a2a1c" />
        <circle cx="80" cy="40" r="6" fill="#f0e2b0" opacity=".7" /><rect x="14" y="26" width="82" height="90" fill="#000" opacity=".15" />
      </g>
    </g>

    <!-- шкатулка -->
    <g v-else-if="kind === 'chest'">
      <path d="M6 30 Q6 12 24 12 H76 Q94 12 94 30 V34 H6 Z" fill="#5a3d22" /><rect x="6" y="34" width="88" height="34" fill="#4a3220" /><rect x="6" y="12" width="88" height="56" rx="4" filter="url(#bk-grain)" opacity=".35" />
      <g fill="#b8893f"><rect x="20" y="12" width="6" height="56" /><rect x="74" y="12" width="6" height="56" /><rect x="6" y="32" width="88" height="3.4" /><rect x="43" y="28" width="14" height="16" rx="2" /></g>
      <circle cx="50" cy="36" r="2.2" fill="#3a2a12" /><rect x="6" y="64" width="88" height="4" fill="#0004" /><line x1="8" y1="14" x2="92" y2="14" stroke="#fff" stroke-opacity=".12" />
    </g>

    <!-- чернильница и перо -->
    <g v-else-if="kind === 'ink'">
      <path d="M40 92 Q30 50 54 8 Q60 30 50 60 Q46 78 43 92 Z" fill="#e9e0c8" /><path d="M41 92 Q44 50 54 8" stroke="#8a7a52" stroke-width="1" fill="none" /><path d="M46 40 l7 -4 M44 52 l8 -3 M43 64 l6 -2" stroke="#b8a878" stroke-width=".8" />
      <path d="M14 108 V90 Q14 82 22 80 V74 H46 V80 Q54 82 54 90 V108 Z" fill="#1c2733" /><rect x="20" y="70" width="28" height="6" rx="2" fill="#b8893f" /><path d="M18 88 V104" stroke="#fff" stroke-opacity=".25" stroke-width="2" /><rect x="14" y="104" width="40" height="4" fill="#0005" />
    </g>

    <!-- свитки в кувшине -->
    <g v-else-if="kind === 'scrolls'">
      <g fill="#e4d6b0" stroke="#8a7a52" stroke-width=".7"><rect x="14" y="8" width="11" height="66" rx="5" transform="rotate(-9 20 70)" /><rect x="26" y="2" width="11" height="70" rx="5" /><rect x="38" y="12" width="11" height="62" rx="5" transform="rotate(10 44 70)" /></g>
      <path d="M26 20 h11 M26 23 h11" stroke="#b3261e" stroke-width="1.4" />
      <path d="M10 108 Q4 84 14 62 H48 Q58 84 52 108 Z" fill="#6a4a30" /><path d="M10 108 Q4 84 14 62 H48 Q58 84 52 108 Z" filter="url(#bk-grain)" opacity=".4" /><ellipse cx="31" cy="62" rx="17" ry="4" fill="#2a1c12" /><path d="M9 80 Q31 88 53 80" stroke="#b8893f" stroke-width="2" fill="none" />
    </g>

    <!-- кристаллы -->
    <g v-else-if="kind === 'crystal'">
      <circle cx="36" cy="50" r="34" fill="url(#bk-cold)" class="sd-glow slow" />
      <path d="M20 78 L14 44 L24 30 L32 46 L30 78 Z" fill="#5fb8d9" /><path d="M24 30 L32 46 L30 78 L24 78 Z" fill="#2f7fa3" />
      <path d="M32 78 L30 28 L40 10 L50 30 L46 78 Z" fill="#8fe0f5" /><path d="M40 10 L50 30 L46 78 L40 78 Z" fill="#3f9cc2" />
      <path d="M46 78 L48 48 L56 38 L62 52 L58 78 Z" fill="#5fb8d9" /><path d="M56 38 L62 52 L58 78 L54 78 Z" fill="#2f7fa3" />
      <path d="M10 78 H64 L60 84 H14 Z" fill="#3a3029" />
    </g>

    <!-- резное блюдо -->
    <g v-else-if="kind === 'plate'">
      <circle cx="48" cy="50" r="46" fill="#6b4a2c" /><circle cx="48" cy="50" r="46" filter="url(#bk-grain)" opacity=".45" /><circle cx="48" cy="50" r="33" fill="#553820" /><circle cx="48" cy="50" r="33" fill="none" stroke="#0005" stroke-width="2" />
      <circle cx="48" cy="50" r="46" fill="url(#bk-ball)" opacity=".8" />
    </g>
  </svg>
</template>

<script setup>
import { computed } from 'vue'
import { DECOR } from './decor.js'

const props = defineProps({ kind: { type: String, required: true }, w: { type: Number, default: 0 }, seed: { type: Number, default: 1 } })
const size = computed(() => (props.kind === 'tomes' ? { w: props.w, h: 200 } : DECOR[props.kind]))
function rng(s) { return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9 | 0) >>> 0) / 4294967296 }
const DULL = ['#3b2a1c', '#4a2f1d', '#2f3327', '#3a2226', '#2a2c35', '#51402a', '#33261c', '#402c2c', '#28302c']
// ряд старых томов нужной ширины; последний иногда привалился к соседу
const tomes = computed(() => {
  const r = rng(props.seed * 7919 + 13), out = []
  let x = 0
  while (x < props.w - 16) {
    const w = Math.min(props.w - x, 15 + Math.round(r() * 22)), h = 118 + Math.round(r() * 72)
    const n = Math.floor(r() * 4)
    out.push({ x, w, h, c: DULL[Math.floor(r() * DULL.length)], bands: [0.1, 0.2, 0.82, 0.9].slice(0, n).map(k => Math.round(k * h)), plate: r() > 0.6 && w > 22 })
    x += w + (r() > 0.85 ? 1 : 0)
  }
  if (out.length > 3 && r() > 0.4) { const last = out[out.length - 1]; last.lean = -7 - r() * 5; last.x += 7 }
  return out
})
const stack = computed(() => {
  const r = rng(props.seed * 104729 + 7), out = []
  let y = DECOR.stack.h
  for (let i = 0; i < 3 + Math.floor(r() * 2); i++) {
    const h = 15 + Math.round(r() * 8), w = 84 + Math.round(r() * 30)
    y -= h
    out.push({ x: Math.round(r() * (DECOR.stack.w - w)), y, w, h, c: DULL[Math.floor(r() * DULL.length)] })
  }
  return out
})
</script>

<style scoped>
.sd { display: block; overflow: visible; }
.sd-glow { mix-blend-mode: screen; animation: sd-glow 3.2s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
.sd-glow.slow { animation-duration: 6s; }
.sd-flame { transform-box: fill-box; transform-origin: 50% 100%; animation: sd-flame 1.7s ease-in-out infinite; }
@keyframes sd-glow { 0%, 100% { opacity: .85; transform: scale(1); } 40% { opacity: 1; transform: scale(1.05); } 70% { opacity: .78; transform: scale(.97); } }
@keyframes sd-flame { 0%, 100% { transform: scale(1, 1) skewX(0); } 30% { transform: scale(.94, 1.07) skewX(-3deg); } 60% { transform: scale(1.05, .95) skewX(2.5deg); } 80% { transform: scale(.97, 1.04) skewX(-1deg); } }
@media (prefers-reduced-motion: reduce) { .sd-glow, .sd-flame { animation: none; } }
</style>
