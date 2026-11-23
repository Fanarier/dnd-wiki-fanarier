<template>
  <!-- вещи на полках стеллажа. Все стоят на полке (под каждой — тень касания), свет — сверху слева, как у книг -->
  <HourGlass v-if="kind === 'hourglass'" />
  <CandleDecor v-else-if="kind === 'candle' || kind === 'lantern'" :kind="kind" :seed="seed" />
  <GlobeDecor v-else-if="kind === 'globe'" />
  <BottlesDecor v-else-if="kind === 'bottles'" />
  <svg v-else class="sd" :class="kind" :width="size.w" :height="size.h" :viewBox="`0 0 ${size.w} ${size.h}`" :style="flick" aria-hidden="true">
    <ellipse v-if="kind !== 'tomes' && kind !== 'frame'" :cx="size.w / 2" :cy="size.h - 1.5" :rx="size.w * 0.48" ry="3.4" fill="url(#bk-shadow)" />

    <!-- ряд безымянных старых томов -->
    <g v-if="kind === 'tomes'">
      <g v-for="(b, i) in tomes" :key="i" :transform="b.lean ? `rotate(${-b.lean} ${b.x} ${size.h})` : null">
        <rect :x="b.x" :y="size.h - b.h" :width="b.w" :height="b.h" rx="1.6" :fill="b.c" />
        <rect :x="b.x" :y="size.h - b.h" :width="b.w" :height="b.h" fill="url(#bk-leather)" class="sd-ov" opacity=".28" />
        <rect :x="b.x" :y="size.h - b.h" :width="b.w" :height="b.h" fill="url(#bk-mottle)" opacity=".45" />
        <rect :x="b.x" :y="size.h - b.h" :width="b.w" height="5" fill="#000" opacity=".3" />
        <g v-for="y in b.bands" :key="y">
          <rect :x="b.x" :y="size.h - b.h + y - 2.5" :width="b.w" height="5" :fill="b.c" /><rect :x="b.x" :y="size.h - b.h + y - 2.5" :width="b.w" height="5" fill="url(#bk-band)" />
          <template v-if="b.gilt"><line :x1="b.x" :x2="b.x + b.w" :y1="size.h - b.h + y - 4.6" :y2="size.h - b.h + y - 4.6" stroke="#b8954f" stroke-opacity=".6" stroke-width=".7" /><line :x1="b.x" :x2="b.x + b.w" :y1="size.h - b.h + y + 4.8" :y2="size.h - b.h + y + 4.8" stroke="#b8954f" stroke-opacity=".6" stroke-width=".7" /></template>
        </g>
        <g v-if="b.label">
          <rect :x="b.x + 2.5" :y="size.h - b.h * 0.8" :width="b.w - 5" :height="b.h * 0.17" :fill="b.lc" />
          <rect :x="b.x + 3.6" :y="size.h - b.h * 0.8 + 1.2" :width="b.w - 7.2" :height="b.h * 0.17 - 2.4" fill="none" stroke="#c9a45a" stroke-opacity=".55" stroke-width=".5" />
          <line v-for="k in b.lines" :key="k" :x1="b.x + b.w / 2 - (b.w - 12) * (k === 1 ? 0.42 : 0.3)" :x2="b.x + b.w / 2 + (b.w - 12) * (k === 1 ? 0.42 : 0.3)" :y1="size.h - b.h * 0.8 + b.h * 0.17 * (k / (b.lines.length + 1))" :y2="size.h - b.h * 0.8 + b.h * 0.17 * (k / (b.lines.length + 1))" stroke="#d6b56a" stroke-opacity=".75" stroke-width="1.3" />
        </g>
        <rect :x="b.x" :y="size.h - b.h" :width="b.w" :height="b.h" rx="1.6" fill="url(#bk-round)" />
      </g>
    </g>

    <!-- стопка лежащих книг, корешками к нам -->
    <g v-else-if="kind === 'stack'">
      <g v-for="(b, i) in stack" :key="i">
        <rect :x="b.x" :y="b.y" :width="b.w" :height="b.h" rx="2" :fill="b.c" />
        <rect :x="b.x" :y="b.y" :width="b.w" :height="b.h" fill="url(#bk-leather)" class="sd-ov" opacity=".45" />
        <rect :x="b.x" :y="b.y" :width="b.w" :height="b.h" fill="url(#bk-mottle)" opacity=".5" />
        <g v-for="x in [b.x + 9, b.x + b.w - 9]" :key="x"><rect :x="x - 2.5" :y="b.y" width="5" :height="b.h" fill="#000" opacity=".25" /><line :x1="x - 2.5" :x2="x - 2.5" :y1="b.y" :y2="b.y + b.h" stroke="#fff" stroke-opacity=".15" stroke-width=".7" /><line :x1="x - 5" :x2="x - 5" :y1="b.y + 1" :y2="b.y + b.h - 1" stroke="#b8954f" stroke-opacity=".5" stroke-width=".6" /><line :x1="x + 5" :x2="x + 5" :y1="b.y + 1" :y2="b.y + b.h - 1" stroke="#b8954f" stroke-opacity=".5" stroke-width=".6" /></g>
        <rect :x="b.x + b.w / 2 - 16" :y="b.y + 2.5" width="32" :height="b.h - 5" :fill="b.lc" /><line :x1="b.x + b.w / 2 - 10" :x2="b.x + b.w / 2 + 10" :y1="b.y + b.h / 2" :y2="b.y + b.h / 2" stroke="#d6b56a" stroke-opacity=".75" stroke-width="1.3" />
        <rect :x="b.x" :y="b.y" :width="b.w" :height="b.h" rx="2" fill="url(#bk-round-v)" />
      </g>
    </g>

    <!-- картина: парусник -->
    <g v-else-if="kind === 'frame'">
      <g transform="rotate(-3 55 126)">
        <rect x="7" y="20" width="102" height="110" fill="#000" opacity=".35" filter="url(#bk-soft)" />
        <rect x="4" y="16" width="102" height="110" fill="url(#bk-wood)" /><rect x="4" y="16" width="102" height="110" fill="url(#bk-woodgrain)" opacity=".5" />
        <rect x="8" y="20" width="94" height="102" fill="none" stroke="url(#bk-brass)" stroke-width="1.6" />
        <rect x="14" y="26" width="82" height="90" fill="#3d6470" /><path d="M14 80 Q34 74 55 80 T96 80 V116 H14 Z" fill="#1f4350" /><path d="M14 92 Q30 88 46 92 T78 92 T96 92" stroke="#7fb0b8" stroke-width="1" fill="none" opacity=".6" />
        <path d="M54 40 V80 M54 42 L76 76 H54 Z" fill="#e9e0c8" stroke="#3a2a1c" stroke-width="1" /><path d="M52 46 L34 76 H52 Z" fill="#d9cfb4" /><path d="M30 80 H80 L74 88 H36 Z" fill="#3a2a1c" />
        <circle cx="80" cy="40" r="6" fill="#f0e2b0" opacity=".7" /><rect x="14" y="26" width="82" height="90" fill="url(#bk-mottle)" opacity=".5" />
        <rect x="14" y="26" width="82" height="90" fill="none" stroke="#000" stroke-opacity=".5" stroke-width="2" />
      </g>
    </g>

    <!-- сундучок: крышка-бочонок, железные полосы, замок -->
    <g v-else-if="kind === 'chest'">
      <rect x="8" y="36" width="88" height="34" fill="url(#bk-wood)" />
      <rect x="8" y="36" width="88" height="34" fill="url(#bk-woodgrain)" opacity=".55" />
      <path d="M8 47.5 H96 M8 59 H96" stroke="#1e1209" stroke-opacity=".7" stroke-width="1" /><path d="M8 48.4 H96 M8 59.9 H96" stroke="#fff" stroke-opacity=".08" stroke-width=".7" />
      <path d="M8 36 V26 A44 15 0 0 1 96 26 V36 Z" fill="url(#bk-wood)" />
      <path d="M8 36 V26 A44 15 0 0 1 96 26 V36 Z" fill="url(#bk-woodgrain)" opacity=".55" />
      <path d="M9 24 A43 14 0 0 1 95 24" fill="none" stroke="#fff" stroke-opacity=".22" stroke-width="1" />
      <path d="M8 29 Q52 25 96 29" fill="none" stroke="#1e1209" stroke-opacity=".5" stroke-width=".8" />
      <rect x="8" y="34.6" width="88" height="2.6" fill="#120a05" /><line x1="8" x2="96" y1="37.6" y2="37.6" stroke="#fff" stroke-opacity=".12" />
      <g v-for="x in [22, 82]" :key="x">
        <rect :x="x - 2" y="16.5" width="6.4" height="53.5" fill="#000" opacity=".3" />
        <path :d="x < 52 ? 'M19 70 V16.1 L25 14.2 V70 Z' : 'M79 70 V14.2 L85 16.1 V70 Z'" fill="url(#bk-iron-h)" />
        <circle v-for="y in [21, 31, 44, 57, 65]" :key="y" :cx="x" :cy="y" r="1.1" fill="#d5d9dc" />
      </g>
      <rect x="8" y="66" width="88" height="4" fill="url(#bk-iron)" />
      <rect x="44" y="30" width="16" height="18" rx="2" fill="url(#bk-brass)" /><rect x="44" y="30" width="16" height="18" rx="2" fill="none" stroke="#5a3e16" stroke-width=".8" />
      <circle cx="52" cy="38" r="2" fill="#1e1209" /><path d="M51.2 39 L50.6 43.4 H53.4 L52.8 39 Z" fill="#1e1209" />
      <rect x="10" y="70" width="8" height="4" rx="1" fill="#1c1d1f" /><rect x="86" y="70" width="8" height="4" rx="1" fill="#1c1d1f" />
    </g>

    <!-- чернильница и перо -->
    <g v-else-if="kind === 'ink'">
      <path d="M41 96 C34 64 40 32 56 6 C58 26 54 50 46 70 C44 80 43 88 42.5 96 Z" fill="#ece3cc" />
      <path d="M41 96 C34 64 40 32 56 6 C58 26 54 50 46 70 C44 80 43 88 42.5 96 Z" fill="url(#bk-paper)" />
      <path d="M42 96 C43 64 48 32 56 6" fill="none" stroke="#9a8a62" stroke-width=".9" />
      <path d="M44 40 l6 -5 M43 50 l7 -4 M42.6 60 l6 -3 M45 32 l5 -6" stroke="#b8a878" stroke-width=".6" />
      <ellipse cx="34" cy="107" rx="21" ry="3" fill="#000" opacity=".4" />
      <path d="M14 106 V92 Q14 84 22 82 V77 H46 V82 Q54 84 54 92 V106 Q34 109 14 106 Z" fill="#141c26" />
      <path d="M14 106 V92 Q14 84 22 82 V77 H46 V82 Q54 84 54 92 V106 Q34 109 14 106 Z" fill="url(#bk-glass)" />
      <ellipse cx="34" cy="77" rx="12" ry="2.6" fill="url(#bk-brass)" /><ellipse cx="34" cy="77" rx="8" ry="1.6" fill="#0b0d12" />
      <path d="M18 90 V102" stroke="#fff" stroke-opacity=".4" stroke-width="2" stroke-linecap="round" />
    </g>

    <!-- свитки, сложенные на полке -->
    <g v-else-if="kind === 'scrolls'">
      <g v-for="(sc, i) in scrolls" :key="i">
        <rect :x="sc.x - 3" :y="sc.y - 2" width="4" :height="sc.r * 2 + 4" rx="1.5" fill="url(#bk-wood)" />
        <rect :x="sc.x + sc.len - 1" :y="sc.y - 2" width="4" :height="sc.r * 2 + 4" rx="1.5" fill="url(#bk-wood)" />
        <rect :x="sc.x" :y="sc.y" :width="sc.len" :height="sc.r * 2" :fill="sc.c" />
        <rect :x="sc.x" :y="sc.y" :width="sc.len" :height="sc.r * 2" fill="url(#bk-paper)" />
        <rect :x="sc.x" :y="sc.y" :width="sc.len" :height="sc.r * 2" fill="url(#bk-round-v)" />
        <path :d="`M${sc.x + sc.len * 0.18} ${sc.y + 0.6} Q${sc.x + sc.len * 0.24} ${sc.y + sc.r} ${sc.x + sc.len * 0.18} ${sc.y + sc.r * 2 - 0.6}`" fill="none" stroke="#8a7448" stroke-opacity=".45" stroke-width=".6" />
        <rect :x="sc.x + sc.len * 0.56" :y="sc.y - 0.4" width="5" :height="sc.r * 2 + 0.8" :fill="sc.tie" /><rect :x="sc.x + sc.len * 0.56" :y="sc.y - 0.4" width="5" :height="sc.r * 2 + 0.8" fill="url(#bk-round-v)" />
        <circle :cx="sc.x - 1" :cy="sc.y + sc.r" r="2.6" fill="url(#bk-brass)" /><circle :cx="sc.x + sc.len + 1" :cy="sc.y + sc.r" r="2.6" fill="url(#bk-brass)" />
      </g>
    </g>

    <!-- друза кристаллов на камне -->
    <g v-else-if="kind === 'crystal'" class="sd-hit" :class="{ ring: ring }" role="button" tabindex="0" aria-label="Коснуться кристаллов" @click="chime" @keydown.enter.prevent="chime" @keydown.space.prevent="chime">
      <title>Коснуться кристаллов</title>
      <circle cx="40" cy="58" r="40" fill="url(#bk-cold)" class="sd-glow slow" />
      <circle v-if="ring" :key="'r' + ring" cx="40" cy="52" r="36" fill="url(#bk-cold)" class="sd-flare" />
      <path d="M6 90 Q4 78 14 74 Q22 68 34 71 Q46 66 58 70 Q72 70 75 80 Q78 88 74 90 Z" fill="#2f2b2a" />
      <path d="M6 90 Q4 78 14 74 Q22 68 34 71 Q46 66 58 70 Q72 70 75 80 Q78 88 74 90 Z" fill="url(#bk-leather)" class="sd-ov" opacity=".6" />
      <path d="M12 76 Q22 70 34 72.5 Q46 68 58 71.5" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width="1" />
      <g v-for="(cr, i) in crystals" :key="i" :transform="`translate(${cr.x} ${cr.y}) rotate(${cr.a})`">
        <path :d="cr.l" fill="#3d7fa8" fill-opacity=".9" />
        <path :d="cr.m" fill="#7ccbe8" fill-opacity=".78" />
        <path :d="cr.r" fill="#c8f0fb" fill-opacity=".82" />
        <path :d="cr.m" fill="#b08cff" fill-opacity=".18" />
        <path :d="cr.edge" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width=".55" stroke-linejoin="round" />
        <path :d="cr.glint" stroke="#fff" stroke-opacity=".7" stroke-width=".9" stroke-linecap="round" />
      </g>
      <path d="M3 90 Q5 81 15 80 Q29 77 41 81 Q57 78 69 81 Q78 84 77 90 Z" fill="#262221" />
      <path d="M3 90 Q5 81 15 80 Q29 77 41 81 Q57 78 69 81 Q78 84 77 90 Z" fill="url(#bk-leather)" class="sd-ov" opacity=".55" />
      <path d="M8 82 Q18 79.5 28 79.8 Q36 80 41 81.6" fill="none" stroke="#fff" stroke-opacity=".14" stroke-width=".9" />
      <g fill="#fff">
        <path v-for="(sp, i) in sparks" :key="'s' + i + '-' + ring" class="sd-twinkle" :class="{ burst: ring }" :style="{ animationDelay: ring ? (i * 0.08) + 's' : sp.d + 's' }" :d="`M${sp.x} ${sp.y - 4} L${sp.x + 0.7} ${sp.y - 0.7} L${sp.x + 4} ${sp.y} L${sp.x + 0.7} ${sp.y + 0.7} L${sp.x} ${sp.y + 4} L${sp.x - 0.7} ${sp.y + 0.7} L${sp.x - 4} ${sp.y} L${sp.x - 0.7} ${sp.y - 0.7} Z`" />
      </g>
    </g>

    <!-- расписная тарелка на подставке -->
    <g v-else-if="kind === 'plate'">
      <path d="M30 92 L48 60 L66 92" fill="none" stroke="url(#bk-wood-h)" stroke-width="3" />
      <circle cx="48" cy="48" r="40" fill="#000" opacity=".35" filter="url(#bk-soft)" transform="translate(2 3)" />
      <circle cx="48" cy="48" r="40" fill="#e8dfc8" /><circle cx="48" cy="48" r="40" fill="url(#bk-paper)" />
      <circle cx="48" cy="48" r="36.5" fill="none" stroke="#2f4f86" stroke-width="2.4" /><circle cx="48" cy="48" r="33" fill="none" stroke="#2f4f86" stroke-width=".8" stroke-dasharray="3 2.4" />
      <circle cx="48" cy="48" r="24" fill="#ded3b8" />
      <g fill="none" stroke="#2f4f86" stroke-width="1.6" stroke-linecap="round">
        <path d="M48 30 C42 38 42 44 48 48 C54 44 54 38 48 30 Z" /><path d="M30 48 C38 42 44 42 48 48 C44 54 38 54 30 48 Z" /><path d="M66 48 C58 42 52 42 48 48 C52 54 58 54 66 48 Z" /><path d="M48 66 C42 58 42 52 48 48 C54 52 54 58 48 66 Z" />
      </g>
      <circle cx="48" cy="48" r="40" fill="url(#bk-ball)" opacity=".7" />
    </g>
  </svg>
</template>

<script setup>
import { computed, ref } from 'vue'
import HourGlass from './HourGlass.vue'
import CandleDecor from './CandleDecor.vue'
import GlobeDecor from './GlobeDecor.vue'
import BottlesDecor from './BottlesDecor.vue'
import { DECOR, flicker } from './decor.js'

const props = defineProps({ kind: { type: String, required: true }, w: { type: Number, default: 0 }, seed: { type: Number, default: 1 } })
const uid = 'sd' + Math.random().toString(36).slice(2, 8)
const size = computed(() => (props.kind === 'tomes' ? { w: props.w, h: 200 } : DECOR[props.kind]))
// у каждой свечи свой ритм: длительность и сдвиг — от номера вещи
const flick = computed(() => (props.kind === 'crystal' ? flicker(props.seed) : null))
// кристаллы от щелчка вспыхивают и рассыпают искры
const ring = ref(0)
const chime = () => { ring.value++ }
function rng(s) { return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9 | 0) >>> 0) / 4294967296 }
const DULL = ['#3b2a1c', '#4a2f1d', '#2f3327', '#3a2226', '#2a2c35', '#51402a', '#33261c', '#402c2c', '#28302c', '#5a3a22']
const PIECE = ['#1c1410', '#4a1612', '#14201a', '#2a1418']

// ряд старых томов нужной ширины; последний иногда привалился к соседу — с зазором, чтобы не влезал в него
const tomes = computed(() => {
  const r = rng(props.seed * 7919 + 13), out = []
  let x = 0
  while (x < props.w - 16) {
    const w = Math.min(props.w - x, 15 + Math.round(r() * 22)), h = 118 + Math.round(r() * 72)
    const n = Math.floor(r() * 4)
    out.push({ x, w, h, c: DULL[Math.floor(r() * DULL.length)], bands: [0.08, 0.15, 0.86, 0.93].slice(0, n).map(k => Math.round(k * h)), gilt: r() > 0.45,
      label: r() > 0.45 && w > 18, lc: PIECE[Math.floor(r() * PIECE.length)], lines: r() > 0.5 ? [1, 2] : [1] })
    x += w + (r() > 0.85 ? 1 : 0)
  }
  if (out.length > 3 && r() > 0.4) {
    const last = out[out.length - 1], prev = out[out.length - 2]
    const a = 6 + r() * 5, rad = (a * Math.PI) / 180
    // где наклонённый том касается соседа: о его верхний угол или своим верхним углом
    const gap = prev.h < last.h * Math.cos(rad) ? prev.h * Math.tan(rad) : last.h * Math.sin(rad)
    const nx = prev.x + prev.w + gap
    if (nx + last.w <= props.w) { last.x = nx; last.lean = a }
  }
  return out
})
const stack = computed(() => {
  const r = rng(props.seed * 104729 + 7), out = []
  let y = DECOR.stack.h - 3
  for (let i = 0; i < 3 + Math.floor(r() * 2); i++) {
    const h = 14 + Math.round(r() * 8), w = 84 + Math.round(r() * 30)
    y -= h
    out.push({ x: Math.round(r() * (DECOR.stack.w - w)), y, w, h, c: DULL[Math.floor(r() * DULL.length)], lc: PIECE[Math.floor(r() * PIECE.length)] })
  }
  return out
})
const scrolls = computed(() => {
  const H = DECOR.scrolls.h
  return [
    { x: 6, y: H - 3 - 18, len: 50, r: 9, c: '#e6d8b0', tie: '#8e1a14' },
    { x: 44, y: H - 3 - 20, len: 46, r: 10, c: '#d9c79a', tie: '#2f4f86' },
    { x: 22, y: H - 3 - 18 - 17, len: 54, r: 8.5, c: '#efe4c4', tie: '#3f6b4a' }
  ]
})
// кристалл: шестигранная призма с острым концом, три видимые грани
function crystal(x, y, w, h, a) {
  const k = w / 6, p = -h * 0.72
  return {
    x, y, a,
    l: `M${-3 * k} 0 L${-3 * k} ${p} L0 ${-h} L${-k} ${p + 2} L${-k} 0 Z`,
    m: `M${-k} 0 L${-k} ${p + 2} L0 ${-h} L${k} ${p + 2} L${k} 0 Z`,
    r: `M${k} 0 L${k} ${p + 2} L0 ${-h} L${3 * k} ${p} L${3 * k} 0 Z`,
    edge: `M${-3 * k} 0 L${-3 * k} ${p} L0 ${-h} L${3 * k} ${p} L${3 * k} 0 M${-k} 0 L${-k} ${p + 2} L0 ${-h} M${k} 0 L${k} ${p + 2} L0 ${-h} M${-3 * k} ${p} L${-k} ${p + 2} L${k} ${p + 2} L${3 * k} ${p}`,
    glint: `M${1.6 * k} ${-h * 0.15} V${p + 6}`
  }
}
const crystals = [crystal(22, 80, 11, 34, -24), crystal(58, 79, 12, 36, 22), crystal(30, 78, 13, 50, -9), crystal(48, 78, 15, 64, 6), crystal(40, 80, 9, 26, 30)]
const sparks = [{ x: 46, y: 18, d: 0.2 }, { x: 26, y: 34, d: 1.7 }, { x: 64, y: 46, d: 3.1 }]
</script>

<style scoped>
.sd { display: block; overflow: visible; }
.sd-ov { mix-blend-mode: overlay; }
/* пламя: качание и мерцание с разными периодами — вместе не повторяются; у каждой свечи — свои */
.sd-fa { animation: sd-sway calc(var(--ft, 1.6s) * 1.9) ease-in-out infinite; animation-delay: var(--fd, 0s); transform-box: fill-box; transform-origin: 50% 100%; }
.sd-fb { animation: sd-flick var(--ft, 1.6s) ease-in-out infinite; animation-delay: calc(var(--fd, 0s) * 1.3); transform-box: fill-box; transform-origin: 50% 100%; }
.sd-glow { mix-blend-mode: screen; animation: sd-glow calc(var(--ft, 1.6s) * 1.4) ease-in-out infinite; animation-delay: var(--fd, 0s); transform-box: fill-box; transform-origin: center; }
.sd-glow.slow { animation-duration: 6s; }
.sd-hit { pointer-events: auto; cursor: pointer; outline: none; }
.sd-hit:focus-visible { filter: drop-shadow(0 0 4px rgba(243, 220, 158, .8)); }
.sd-flare { mix-blend-mode: screen; opacity: 0; transform-box: fill-box; transform-origin: center; animation: sd-flare 1.2s ease-out both; }
@keyframes sd-flare { 0% { opacity: 0; transform: scale(.6); } 15% { opacity: 1; transform: scale(1.15); } 100% { opacity: 0; transform: scale(1.5); } }
.sd-twinkle.burst { animation: sd-twinkle 1.4s ease-out 1 both; }
.sd-twinkle { opacity: 0; transform-box: fill-box; transform-origin: center; animation: sd-twinkle 4.6s ease-in-out infinite; }
@keyframes sd-sway { 0%, 100% { transform: rotate(0); } 22% { transform: rotate(-2.6deg); } 47% { transform: rotate(1.4deg); } 71% { transform: rotate(-1deg); } 88% { transform: rotate(2.2deg); } }
@keyframes sd-flick { 0%, 100% { transform: scale(1, 1); } 13% { transform: scale(.96, 1.05); } 29% { transform: scale(1.03, .94); } 41% { transform: scale(.98, 1.07); } 63% { transform: scale(1.02, .97); } 82% { transform: scale(.97, 1.03); } }
@keyframes sd-glow { 0%, 100% { opacity: .85; } 31% { opacity: 1; } 52% { opacity: .74; } 77% { opacity: .95; } }
@keyframes sd-twinkle { 0%, 70%, 100% { opacity: 0; transform: scale(.3) rotate(0); } 80% { opacity: .95; transform: scale(1) rotate(20deg); } 90% { opacity: 0; transform: scale(.5) rotate(40deg); } }
@media (prefers-reduced-motion: reduce) { .sd-fa, .sd-fb, .sd-glow, .sd-twinkle, .sd-flare { animation: none; } }
</style>
