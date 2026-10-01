<template>
  <g :transform="`translate(${l.x},${l.y}) rotate(${l.angle || 0})`" :class="['map-label', 'ml-' + kind, { selected, faded }]">
    <defs><path :id="pathId" :d="arc" /></defs>
    <text v-for="(line, i) in lines" :key="i" :font-size="l.size" :transform="`translate(0,${(i - (lines.length - 1) / 2) * l.size * 1.05})`">
      <textPath :href="'#' + pathId" startOffset="50%" text-anchor="middle">{{ line }}</textPath>
    </text>
    <!-- невидимая область для клика и перетаскивания -->
    <rect :x="-hitW / 2" :y="-l.size * (lines.length * 0.6 + 0.35)" :width="hitW" :height="l.size * (lines.length * 1.05 + 0.3)" class="ml-hit" />
    <rect v-if="selected" :x="-hitW / 2" :y="-l.size * (lines.length * 0.6 + 0.35)" :width="hitW" :height="l.size * (lines.length * 1.05 + 0.3)" class="ml-sel" vector-effect="non-scaling-stroke" />
  </g>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  l: { type: Object, required: true }, // { x, y, angle, size, bend, wrap }
  text: { type: String, default: '' },
  id: { type: String, required: true },
  kind: { type: String, default: 'state' }, // state | land | sea | region | danger
  selected: Boolean,
  faded: Boolean
})

const pathId = computed(() => 'mlp-' + props.id)

const lines = computed(() => {
  const t = (props.text || '').trim()
  if (!props.l.wrap) return [t]
  const i = t.indexOf(' ')
  return i === -1 ? [t] : [t.slice(0, i), t.slice(i + 1)]
})

// Ширина «рамки» под подпись — оценка по числу символов
const hitW = computed(() => Math.max(...lines.value.map(s => s.length), 2) * props.l.size * 0.62)

// Дуга постоянной кривизны через (0,0), касательная горизонтальна; bend > 0 — края загибаются вниз
const arc = computed(() => {
  const b = props.l.bend || 0
  const L = Math.max(hitW.value * 0.75, 300)
  if (Math.abs(b) < 1e-5) return `M${-L},0 L${L},0`
  const R = 1 / Math.abs(b)
  const lim = Math.min(L, R * 0.98)
  const pts = []
  for (let i = 0; i <= 40; i++) {
    const x = -lim + (2 * lim * i) / 40
    const y = Math.sign(b) * (R - Math.sqrt(R * R - x * x))
    pts.push(`${x.toFixed(1)},${y.toFixed(2)}`)
  }
  return 'M' + pts.join('L')
})
</script>

<style scoped>
.map-label text { font-family: Georgia, 'Times New Roman', serif; paint-order: stroke; stroke-linejoin: round; pointer-events: none; }
.ml-state text { fill: #3e3e4b; stroke: rgba(255, 255, 255, 0.3); stroke-width: 0.05em; }
.ml-land text { fill: #3a2f22; stroke: rgba(255, 248, 230, 0.75); stroke-width: 0.14em; font-weight: 700; }
.ml-sea text { fill: #e8f1ff; stroke: rgba(20, 40, 80, 0.45); stroke-width: 0.1em; font-style: italic; letter-spacing: 0.12em; }
.ml-region text { fill: #6b4b16; stroke: rgba(255, 240, 200, 0.7); stroke-width: 0.12em; letter-spacing: 0.2em; text-transform: uppercase; }
.ml-danger text { fill: #8c0f0a; stroke: rgba(255, 220, 200, 0.8); stroke-width: 0.12em; font-weight: 700; }
.map-label.faded { opacity: 0.45; }
.ml-hit { fill: transparent; cursor: pointer; }
.ml-sel { fill: rgba(255, 224, 138, 0.08); stroke: #ffe08a; stroke-width: 1.5; stroke-dasharray: 5 4; pointer-events: none; }
</style>
