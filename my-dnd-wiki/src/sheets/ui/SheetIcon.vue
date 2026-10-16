<template>
  <!-- значки листа (свои, векторные): у рейтингов — «горит / не горит», у разделов — просто рисунок -->
  <svg class="si" :class="[name, { on }]" viewBox="0 0 24 24" aria-hidden="true" :style="tone ? { '--tone': tone } : null">
    <defs v-if="on">
      <radialGradient :id="gid" cx="40%" cy="35%" r="75%">
        <stop offset="0" stop-color="#fff" stop-opacity=".9" />
        <stop offset=".35" stop-color="var(--tone)" />
        <stop offset="1" stop-color="var(--tone)" stop-opacity=".65" />
      </radialGradient>
    </defs>
    <g :fill="on && filled ? `url(#${gid})` : 'none'" :stroke="on ? 'var(--tone)' : 'currentColor'" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <path v-for="(d, i) in shape.paths" :key="i" :d="d" />
    </g>
    <g v-if="shape.detail" :fill="on ? '#120d08' : 'none'" :stroke="on ? (shape.detailStroke || '#120d08') : 'currentColor'" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
      <path v-for="(d, i) in shape.detail" :key="i" :d="d" />
    </g>
  </svg>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({ name: { type: String, required: true }, on: { type: Boolean, default: false }, tone: { type: String, default: '' } })
let seq = 0
const gid = `si-g-${++seq}-${Math.random().toString(36).slice(2, 7)}`
const SHAPES = {
  // рейтинги
  eyes: { paths: ['M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z'], detail: ['M12 8.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8z', 'M12 11a1 1 0 1 0 0 2'] },
  ear: { paths: ['M7.5 9.5a5.2 5.2 0 0 1 10.4 0c0 3.2-2.6 4.1-3.3 6.1-.6 1.8-1.8 3.4-3.8 3.4-1.7 0-2.9-1.1-3.2-2.4'], detail: ['M10.6 10a2.2 2.2 0 0 1 4.3.4c0 1.5-1.7 2-1.7 3.3'], detailStroke: '#fff7e0' },
  aura: { paths: ['M12 2.5c.9 4 2.6 5.7 6.6 6.6-4 .9-5.7 2.6-6.6 6.6-.9-4-2.6-5.7-6.6-6.6 4-.9 5.7-2.6 6.6-6.6z', 'M18.5 14.5c.4 1.7 1.1 2.4 2.8 2.8-1.7.4-2.4 1.1-2.8 2.8-.4-1.7-1.1-2.4-2.8-2.8 1.7-.4 2.4-1.1 2.8-2.8z', 'M5.5 15.5c.3 1.2.8 1.7 2 2-1.2.3-1.7.8-2 2-.3-1.2-.8-1.7-2-2 1.2-.3 1.7-.8 2-2z'] },
  heart: { paths: ['M12 20.5s-7.5-4.6-9.3-9.2C1.4 7.9 3.6 4.5 7 4.5c2.1 0 3.6 1.2 5 3 1.4-1.8 2.9-3 5-3 3.4 0 5.6 3.4 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z'] },
  block: { paths: ['M12 2.8c3.2 4.6 6.4 7.8 6.4 11.4a6.4 6.4 0 0 1-12.8 0c0-3.6 3.2-6.8 6.4-11.4z'], detail: ['M9.3 14.6c.3 1.4 1.3 2.4 2.7 2.7'], detailStroke: '#fff7e0' },
  diamond: { paths: ['M12 2.5l7.2 9.5L12 21.5 4.8 12z'], detail: ['M4.8 12h14.4', 'M8.6 7l3.4 5 3.4-5'], detailStroke: 'rgba(255,255,255,.55)' },
  lock: { paths: ['M6 10.5h12a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 18 20.5H6A1.5 1.5 0 0 1 4.5 19v-7A1.5 1.5 0 0 1 6 10.5z', 'M8 10.5V7.8a4 4 0 0 1 8 0v2.7'], detail: ['M12 14.2v2.6'] },
  unlock: { paths: ['M6 10.5h12a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 18 20.5H6A1.5 1.5 0 0 1 4.5 19v-7A1.5 1.5 0 0 1 6 10.5z', 'M8 10.5V7.8a4 4 0 0 1 7.7-1.6'], detail: ['M12 14.2v2.6'] },
  // разделы книги
  main: { paths: ['M12 11.5a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M4.5 20.5c.6-4 3.6-6.3 7.5-6.3s6.9 2.3 7.5 6.3'] },
  details: { paths: ['M7 3.5h10.5a2 2 0 0 1 2 2v11', 'M7 3.5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h11', 'M18 20.5a2 2 0 0 0 1.5-2V16.5H8.5v2a2 2 0 0 1-2 2', 'M8.5 8h7M8.5 11.5h7'] },
  stats: { paths: ['M12 2.8l8 4.6v9.2l-8 4.6-8-4.6V7.4z', 'M12 7.5l4 2.3-1 5.2-3 1.5-3.5-2.8.5-4z'] },
  active: { paths: ['M13.5 2.5L5 13.5h6l-1.5 8 8.5-11h-6z'] },
  passive: { paths: ['M12 12a2 2 0 1 1 2-2', 'M14 10a4 4 0 1 1-4-4', 'M10 6a6 6 0 1 1-6 6', 'M4 12a8 8 0 0 1 8-8'] },
  attacks: { paths: ['M4 4l9.5 9.5', 'M4 4h3.5l8 8', 'M12 15.5l3.5-3.5 2 2-3.5 3.5z', 'M17 17l3 3', 'M20 4l-6.5 6.5', 'M20 4h-3.5l-3 3', 'M8.5 15.5L5 12l2-2'] },
  traits: { paths: ['M12 3l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 15.4l-4.8 2.5.9-5.4-3.9-3.8 5.4-.8z', 'M8 21h8'] },
  equip: { paths: ['M12 2.8l7.5 2.7v5.6c0 4.8-3.2 8.3-7.5 10.1-4.3-1.8-7.5-5.3-7.5-10.1V5.5z', 'M12 7v10M8.5 10.5h7'] },
  inv: { paths: ['M6.5 8.5h11a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z', 'M9 8.5V6a3 3 0 0 1 6 0v2.5', 'M4.5 13h15', 'M10.5 13v2h3v-2'] },
  res: { paths: ['M9.5 3.5h5', 'M10.5 3.5v4.2L5.8 16a3 3 0 0 0 2.6 4.5h7.2a3 3 0 0 0 2.6-4.5l-4.7-8.3V3.5', 'M7.5 14h9'] },
  journal: { paths: ['M20 3.5c-6.5 1-10.5 5-12.5 11.5l-1 5', 'M20 3.5c-.5 5-3 8.5-8.5 10.5', 'M7.5 15c2 .2 3.6-.2 5-1', 'M4 20.5h7'] },
  // тренировки: гантель и стрелка роста
  train: { paths: ['M6.5 8.5v7M17.5 8.5v7', 'M4 10.5v3M20 10.5v3', 'M6.5 12h11', 'M9.5 5.5L12 3l2.5 2.5', 'M12 3v5'] },
  custom: { paths: ['M4.5 5.5a1 1 0 0 1 1-1h13a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1z', 'M4.5 9.5h15M4.5 14.5h15M10 4.5v15'] }
}
const FILLED = new Set(['eyes', 'aura', 'heart', 'block', 'diamond', 'lock', 'unlock', 'active', 'traits', 'equip'])
const shape = computed(() => SHAPES[props.name] || SHAPES.diamond)
const filled = computed(() => FILLED.has(props.name))
</script>

<style scoped>
.si { width: 100%; height: 100%; overflow: visible; color: color-mix(in srgb, var(--muted, #a8936c) 70%, transparent); transition: filter .25s, transform .25s; }
.si.on { filter: drop-shadow(0 0 4px color-mix(in srgb, var(--tone) 70%, transparent)); }
</style>
