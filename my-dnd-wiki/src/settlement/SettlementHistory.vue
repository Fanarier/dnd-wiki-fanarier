<template>
  <div class="hist">
    <h3>История <small v-if="s.day">день {{ s.day }}</small></h3>
    <p v-if="snaps.length < 2" class="muted">Графики появятся после первого «Прошёл день»: сайт запоминает запасы и настроение поселения на каждый день.</p>

    <template v-else>
      <!-- население, мораль, стабильность, угрозы: по маленькому графику на каждое -->
      <div class="tiles">
        <div v-for="m in METRICS" :key="m.key" class="tile">
          <small>{{ m.label }}</small>
          <div class="tv">
            <b>{{ last[m.key] }}</b>
            <em v-if="change(m.key)" :class="trend(m, change(m.key))">{{ change(m.key) > 0 ? '▲' : '▼' }} {{ Math.abs(change(m.key)) }}</em>
          </div>
          <svg class="spark" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true">
            <polyline :points="sparkPoints(m.key)" fill="none" stroke="var(--h-accent)" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round" />
          </svg>
        </div>
      </div>
      <p class="muted">Изменение — за всё время, с дня {{ snaps[0].day }}.</p>

      <!-- Chart.js: настроение по дням и прирост ресурсов за день -->
      <SettlementCharts :snaps="snaps" />

      <!-- запасы -->
      <div class="h-head">
        <b>Запасы на складе</b>
        <button class="lnk" @click="asTable = !asTable">{{ asTable ? 'график' : 'таблица' }}</button>
      </div>
      <div class="legend">
        <button v-for="r in resChoices" :key="r.key" class="lg" :class="{ on: colorOf[r.key] }" :disabled="!colorOf[r.key] && picked.length >= 4"
                :title="colorOf[r.key] ? 'Убрать с графика' : picked.length >= 4 ? 'Не больше четырёх сразу' : 'Показать на графике'" @click="toggle(r.key)">
          <i :style="colorOf[r.key] ? { background: colorOf[r.key] } : null" />{{ r.label }}
        </button>
      </div>

      <div v-if="!asTable" ref="box" class="chart" @pointerleave="hover = null">
        <svg :width="W" :height="H" role="img" :aria-label="'Запасы по дням: ' + picked.map(k => RES[k]?.label).join(', ')">
          <g class="grid">
            <template v-for="t in yTicks" :key="t">
              <line :x1="PL" :x2="W - PR" :y1="y(t)" :y2="y(t)" />
              <text :x="PL - 6" :y="y(t) + 4" text-anchor="end">{{ short(t) }}</text>
            </template>
            <text v-for="d in xTicks" :key="'x' + d" :x="x(d)" :y="H - 6" text-anchor="middle">{{ d }}</text>
          </g>
          <line v-if="hover" class="cross" :x1="x(hover.day)" :x2="x(hover.day)" :y1="PT" :y2="H - PB" />
          <g v-for="k in picked" :key="k">
            <polyline :points="linePoints(k)" fill="none" :stroke="colorOf[k]" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
            <template v-if="snaps.length <= 14">
              <circle v-for="(p, i) in snaps" :key="i" :cx="x(p.day)" :cy="y(val(p, k))" r="3.5" :fill="colorOf[k]" stroke="var(--h-surface)" stroke-width="2" />
            </template>
          </g>
          <g v-if="hover">
            <circle v-for="k in picked" :key="'h' + k" :cx="x(hover.day)" :cy="y(val(hover, k))" r="5" :fill="colorOf[k]" stroke="var(--h-surface)" stroke-width="2" />
          </g>
          <!-- подписи значений у концов линий -->
          <text v-for="l in endLabels" :key="'e' + l.k" class="endv" :x="W - PR + 6" :y="l.y + 4">{{ short(l.v) }}</text>
          <rect class="hit" :x="PL" :y="PT" :width="W - PL - PR" :height="H - PT - PB" @pointermove="onMove" @pointerdown="onMove" />
        </svg>
        <div v-if="hover" class="tip" :style="tipStyle">
          <b>День {{ hover.day }}</b>
          <div v-for="k in picked" :key="k" class="tr"><i :style="{ background: colorOf[k] }" /><span>{{ RES[k]?.label }}</span><em>{{ fmt(val(hover, k)) }}</em></div>
        </div>
      </div>
      <div v-else class="tbl">
        <table>
          <thead><tr><th>День</th><th v-for="k in picked" :key="k">{{ RES[k]?.label }}</th></tr></thead>
          <tbody><tr v-for="p in [...snaps].reverse()" :key="p.at"><td>{{ p.day }}</td><td v-for="k in picked" :key="k">{{ fmt(val(p, k)) }}</td></tr></tbody>
        </table>
      </div>
    </template>

    <!-- лента -->
    <h3>Что происходило</h3>
    <p v-if="!feed.length" class="muted">Пока ничего не происходило. Здесь появятся прошедшие дни, стройки, приказы и события.</p>
    <div v-for="g in feed" :key="g.day" class="day">
      <div class="day-h">День {{ g.day }}</div>
      <div v-for="e in g.items" :key="e.id" class="li" :class="e.kind">
        <span class="ic" aria-hidden="true">{{ KIND[e.kind] || '•' }}</span>
        <span>{{ e.text }}</span>
        <time>{{ time(e.at) }}</time>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch, nextTick } from 'vue'
import { RES, RESOURCES } from '../shared/settlement.js'
import SettlementCharts from './SettlementCharts.vue'

const props = defineProps({ settlement: Object, wide: Boolean })
const s = computed(() => props.settlement)
const snaps = computed(() => s.value.history || [])
const last = computed(() => snaps.value[snaps.value.length - 1] || {})
const fmt = v => (Math.round((v || 0) * 10) / 10).toLocaleString('ru-RU')
const short = v => (v >= 10000 ? Math.round(v / 1000) + 'к' : v >= 1000 ? (Math.round(v / 100) / 10).toLocaleString('ru-RU') + 'к' : String(Math.round(v)))
const time = t => new Date(t).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const val = (p, k) => p.stock?.[k] || 0

/* плитки: население и настроение */
const METRICS = [
  { key: 'pop', label: 'Жители', good: 1 },
  { key: 'morale', label: 'Мораль', good: 1 },
  { key: 'stability', label: 'Стабильность', good: 1 },
  { key: 'threat', label: 'Угрозы', good: -1 }
]
const change = k => Math.round(((last.value[k] || 0) - (snaps.value[0]?.[k] || 0)) * 10) / 10
const trend = (m, d) => (d * m.good > 0 ? 'up' : 'down')
function sparkPoints(k) {
  const vs = snaps.value.map(p => p[k] || 0)
  const lo = Math.min(...vs), hi = Math.max(...vs)
  return vs.map((v, i) => `${(i / Math.max(1, vs.length - 1)) * 100},${hi === lo ? 14 : 25 - ((v - lo) / (hi - lo)) * 22}`).join(' ')
}

/* запасы: до четырёх ресурсов; цвет закреплён за ресурсом, пока он на графике */
const SLOTS = ['#3987e5', '#d95926', '#199e70', '#c98500']
const resChoices = computed(() => RESOURCES.filter(r => snaps.value.some(p => p.stock?.[r.key])))
const picked = ref([])
const colorOf = ref({})
function toggle(k) {
  if (colorOf.value[k]) {
    picked.value = picked.value.filter(x => x !== k)
    const { [k]: _, ...rest } = colorOf.value
    colorOf.value = rest
  } else if (picked.value.length < 4) {
    const used = new Set(Object.values(colorOf.value))
    colorOf.value = { ...colorOf.value, [k]: SLOTS.find(c => !used.has(c)) }
    picked.value = [...picked.value, k]
  }
}
// по умолчанию — то, что сильнее всего менялось
watch(resChoices, list => {
  if (picked.value.length || !list.length) return
  const swing = k => { const vs = snaps.value.map(p => val(p, k)); return Math.max(...vs) - Math.min(...vs) }
  for (const r of [...list].sort((a, b) => swing(b.key) - swing(a.key)).slice(0, 3)) toggle(r.key)
}, { immediate: true })

/* геометрия графика */
const box = ref(null)
const W = ref(420)
const PL = 40, PR = 44, PT = 10, PB = 22
// в большом формате график выше, чтобы не был сплюснутым
const H = computed(() => (props.wide ? Math.round(Math.min(380, Math.max(210, W.value * 0.3))) : 210))
let ro
onMounted(() => {
  ro = new ResizeObserver(() => { if (box.value) W.value = Math.max(260, box.value.clientWidth) })
  watch(box, el => { if (el) { ro.observe(el); W.value = Math.max(260, el.clientWidth) } }, { immediate: true })
})
onBeforeUnmount(() => ro?.disconnect())
const d0 = computed(() => snaps.value[0]?.day || 0)
const d1 = computed(() => Math.max(d0.value + 1, last.value.day || 0))
const yMax = computed(() => {
  const m = Math.max(1, ...snaps.value.flatMap(p => picked.value.map(k => val(p, k))))
  const step = 10 ** Math.floor(Math.log10(m))
  return Math.ceil(m / step) * step
})
const x = d => PL + ((d - d0.value) / (d1.value - d0.value)) * (W.value - PL - PR)
const y = v => PT + (1 - v / yMax.value) * (H.value - PT - PB)
const yTicks = computed(() => [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(yMax.value * f)))
const xTicks = computed(() => {
  const n = Math.min(6, d1.value - d0.value)
  return [...new Set(Array.from({ length: n + 1 }, (_, i) => Math.round(d0.value + ((d1.value - d0.value) * i) / n)))]
})
const linePoints = k => snaps.value.map(p => `${x(p.day)},${y(val(p, k))}`).join(' ')
// значения у концов линий, раздвинутые, чтобы не налезали
const endLabels = computed(() => {
  const ls = picked.value.map(k => ({ k, v: val(last.value, k), y: y(val(last.value, k)) })).sort((a, b) => a.y - b.y)
  for (let i = 1; i < ls.length; i++) if (ls[i].y - ls[i - 1].y < 13) ls[i].y = ls[i - 1].y + 13
  return ls
})

/* наведение: перекрестие находит ближайший день */
const hover = ref(null)
const hoverX = ref(0)
function onMove(e) {
  const r = e.currentTarget.ownerSVGElement.getBoundingClientRect()
  const px = e.clientX - r.left
  let best = null
  for (const p of snaps.value) if (!best || Math.abs(x(p.day) - px) < Math.abs(x(best.day) - px)) best = p
  hover.value = best
  hoverX.value = x(best.day)
}
const tipStyle = computed(() => (hoverX.value > W.value / 2 ? { right: W.value - hoverX.value + 10 + 'px' } : { left: hoverX.value + 10 + 'px' }))
const asTable = ref(false)
watch(asTable, v => { if (!v) nextTick(() => { if (box.value) W.value = Math.max(260, box.value.clientWidth) }) })

/* лента по дням, новые сверху */
const KIND = { day: '⏳', build: '⚒', built: '🏁', short: '⚠', event: '📜', decision: '✍', order: '✖', explore: '🧭', workers: '👷' }
const feed = computed(() => {
  const out = []
  for (const e of [...(s.value.log || [])].reverse()) {
    let g = out[out.length - 1]
    if (!g || g.day !== e.day) out.push(g = { day: e.day, items: [] })
    g.items.push(e)
  }
  return out.slice(0, 40)
})
</script>

<style scoped>
.hist { min-width: 0; --h-surface: #11141b; --h-accent: #e6c27a; --h-grid: rgba(255, 255, 255, .08); }
.hist h3 { margin: 18px 0 8px; font: 700 22px var(--a-serif); color: var(--a-gold-2); }
.hist h3:first-child { margin-top: 2px; }
.hist h3 small { font: 600 12px var(--a-sans); color: var(--a-muted); margin-left: 6px; }
.muted { color: var(--a-muted); font-size: 12px; margin: 6px 0; }
.tiles { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.tile { display: grid; gap: 1px; padding: 7px 8px 4px; border-radius: 10px; background: var(--h-surface); border: 1px solid var(--a-line-2); min-width: 0; }
.tile small { color: var(--a-muted); font-size: 11px; font-weight: 700; }
.tv { display: flex; align-items: baseline; gap: 5px; flex-wrap: wrap; }
.tv b { font: 700 22px/1.1 var(--a-serif); color: var(--a-text); }
.tv em { font-style: normal; font-size: 11px; font-weight: 800; color: var(--a-muted); }
.tv em.up { color: #9be07a; } .tv em.down { color: #ff9b8f; }
.spark { width: 100%; height: 24px; }
.h-head { display: flex; justify-content: space-between; align-items: baseline; margin: 14px 0 6px; }
.h-head b { font: 700 17px var(--a-serif); color: var(--a-gold-2); }
.lnk { border: 0; background: none; color: var(--a-gold); font: 700 12px var(--a-sans); text-decoration: underline dotted; cursor: pointer; }
.legend { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 6px; }
.lg { display: inline-flex; align-items: center; gap: 5px; padding: 2px 8px; border-radius: 99px; border: 1px solid var(--a-line-2); background: none; color: var(--a-muted); font: 700 11.5px var(--a-sans); cursor: pointer; }
.lg i { width: 9px; height: 9px; border-radius: 50%; border: 1px solid rgba(255, 255, 255, .25); }
.lg.on { color: var(--a-text); border-color: var(--a-line); background: rgba(255, 255, 255, .04); }
.lg.on i { border-color: transparent; }
.lg:disabled { opacity: .45; cursor: default; }
.chart { position: relative; border-radius: 12px; background: var(--h-surface); border: 1px solid var(--a-line-2); overflow: hidden; touch-action: pan-y; }
.chart svg { display: block; max-width: 100%; }
.grid line { stroke: var(--h-grid); stroke-width: 1; }
.grid text, .endv { fill: var(--a-muted); font: 600 10.5px var(--a-sans); }
.endv { fill: var(--a-text); font-weight: 700; }
.cross { stroke: rgba(255, 255, 255, .35); stroke-width: 1; }
.hit { fill: transparent; cursor: crosshair; }
.tip { position: absolute; top: 8px; z-index: 2; min-width: 150px; padding: 7px 9px; border-radius: 9px; background: rgba(23, 19, 14, .96); border: 1px solid #8a6630; font-size: 12px; pointer-events: none; }
.tip b { display: block; margin-bottom: 3px; color: var(--a-gold-2); }
.tr { display: grid; grid-template-columns: 9px 1fr auto; align-items: center; gap: 6px; color: #d9cdb0; }
.tr i { width: 9px; height: 9px; border-radius: 50%; }
.tr em { font-style: normal; font-weight: 800; color: var(--a-text); }
.tbl { max-height: 260px; overflow: auto; border-radius: 12px; border: 1px solid var(--a-line-2); }
.tbl table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.tbl th { position: sticky; top: 0; background: #1a1712; color: var(--a-muted); font-size: 11px; text-align: right; padding: 5px 8px; }
.tbl td { text-align: right; padding: 4px 8px; border-top: 1px solid var(--a-line-2); color: #d9cdb0; }
.tbl th:first-child, .tbl td:first-child { text-align: left; }
.day { margin-bottom: 10px; }
.day-h { position: relative; margin-bottom: 4px; color: var(--a-gold); font: 800 11px var(--a-sans); letter-spacing: .06em; text-transform: uppercase; }
.li { display: grid; grid-template-columns: 20px 1fr auto; gap: 6px; align-items: baseline; padding: 4px 0 4px 2px; border-bottom: 1px solid var(--a-line-2); font-size: 12.5px; color: #d9cdb0; }
.li time { color: #6d675b; font-size: 11px; white-space: nowrap; }
.li.short { color: #ffb36b; }
.li.built { color: #9be07a; }
@media (max-width: 520px) {
  .tiles { grid-template-columns: repeat(2, 1fr); }
}
</style>
