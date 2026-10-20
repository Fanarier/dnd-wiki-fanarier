<template>
  <!-- песочные часы сессии: время между сессиями, разложенное по видам дел (сон, тренировки, квесты…);
       не хватило часов — красный хвост и сыплющийся песок. Под полосой — сон по настройкам героя -->
  <div class="sb" :class="{ over }" :title="title">
    <div class="sb-track">
      <i v-for="s in segs" :key="s.cat" class="sb-seg" :style="{ width: s.w + '%', '--c': s.color }" :title="`${s.icon} ${s.name}: ${s.h} ч`" />
      <i v-if="over" class="sb-over" :style="{ width: overW + '%' }"><b v-for="k in 6" :key="k" :style="{ '--k': k }" /></i>
    </div>
    <div v-if="legend" class="sb-legend">
      <span v-for="s in segs" :key="s.cat" :style="{ '--c': s.color }"><i />{{ s.icon }} {{ s.name }} · {{ s.h }} ч</span>
      <span v-if="free > 0" class="free"><i />свободно {{ free }} ч</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { ACT_CATS, categoryOf, num, round } from '../../shared/activities.js'

const props = defineProps({ rows: { type: Array, default: () => [] }, limit: { type: Number, default: 336 }, legend: Boolean })
const total = computed(() => props.rows.reduce((n, r) => n + Math.max(0, num(r.hours)), 0))
const over = computed(() => total.value > props.limit)
const free = computed(() => round(Math.max(0, props.limit - total.value), 1))
// масштаб — лимит или больше, если переполнено (тогда хвост сверх лимита красный)
const scale = computed(() => Math.max(props.limit, total.value) || 1)
const segs = computed(() => {
  const by = new Map()
  for (const r of props.rows) {
    const h = Math.max(0, num(r.hours))
    if (!h) continue
    const c = categoryOf(r.name)
    by.set(c, (by.get(c) || 0) + h)
  }
  return [...by.entries()].sort((a, b) => b[1] - a[1]).map(([cat, h]) => ({ cat, h: round(h, 1), w: (h / scale.value) * 100, ...ACT_CATS[cat] }))
})
const overW = computed(() => (over.value ? ((total.value - props.limit) / scale.value) * 100 : 0))
const title = computed(() => `${round(total.value, 1)} из ${props.limit} ч${over.value ? ' — больше, чем есть между сессиями!' : ''}`)
</script>

<style scoped>
.sb { display: grid; gap: 5px; }
.sb-track { position: relative; display: flex; height: 10px; border-radius: 99px; overflow: hidden; background: repeating-linear-gradient(90deg, rgba(255, 255, 255, .04) 0 calc(100% / 14 - 1px), rgba(255, 255, 255, .09) calc(100% / 14 - 1px) calc(100% / 14)); box-shadow: inset 0 1px 3px rgba(0, 0, 0, .5); }
.sb-seg { height: 100%; background: linear-gradient(180deg, color-mix(in srgb, var(--c) 85%, #fff), var(--c)); transition: width .6s cubic-bezier(.2, .9, .3, 1); }
.sb-seg + .sb-seg { box-shadow: -1px 0 0 rgba(0, 0, 0, .35); }
.sb-over { position: absolute; right: 0; top: 0; bottom: 0; background: repeating-linear-gradient(135deg, #ff7a6b 0 6px, #b3261e 6px 12px); animation: sb-pulse 1.2s ease-in-out infinite; overflow: visible; }
.sb.over .sb-track { overflow: visible; }
.sb-over b { position: absolute; top: 8px; left: calc(var(--k) * 15%); width: 3px; height: 3px; border-radius: 50%; background: #f0b54f; animation: sb-sand 1.1s linear infinite; animation-delay: calc(var(--k) * -.19s); }
@keyframes sb-pulse { 50% { filter: brightness(1.35); } }
@keyframes sb-sand { from { transform: translateY(0); opacity: 1; } to { transform: translateY(16px); opacity: 0; } }
.sb-legend { display: flex; flex-wrap: wrap; gap: 3px 10px; color: #a8936c; font: 700 11px 'Manrope', sans-serif; }
.sb-legend span { display: flex; align-items: center; gap: 4px; }
.sb-legend i { width: 8px; height: 8px; border-radius: 2px; background: var(--c); }
.sb-legend .free i { background: rgba(255, 255, 255, .12); }
@media (prefers-reduced-motion: reduce) { .sb-over, .sb-over b { animation: none; } }
</style>
