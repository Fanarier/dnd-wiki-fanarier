<template>
  <!-- графики Chart.js: настроение по дням и прирост ресурсов за выбранный день -->
  <div class="sc">
    <div class="sc-box">
      <div class="sc-h"><b>Настроение по дням</b><small>мораль, стабильность, угрозы — шкала 0…100</small></div>
      <div class="sc-canvas"><canvas ref="moodEl" role="img" aria-label="Мораль, стабильность и угрозы по дням" /></div>
    </div>
    <div v-if="deltaDays.length" class="sc-box">
      <div class="sc-h">
        <b>Прирост за день</b>
        <select v-model.number="deltaDay" class="sc-sel" title="За какой день">
          <option v-for="d in deltaDays" :key="d" :value="d">день {{ d }}</option>
        </select>
      </div>
      <p class="sc-note">Сколько ресурса прибавилось (зелёным) или ушло (красным) за этот день — приход минус расход.</p>
      <div class="sc-canvas" :style="{ height: Math.max(140, deltaRows.length * 22 + 40) + 'px' }"><canvas ref="deltaEl" role="img" aria-label="Прирост ресурсов за день" /></div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RES } from '../shared/settlement.js'

const props = defineProps({ snaps: { type: Array, required: true } })
const moodEl = ref(null), deltaEl = ref(null)
let Chart = null, mood = null, delta = null

const MOOD = [
  { key: 'morale', label: 'Мораль', color: '#e9c46a' },
  { key: 'stability', label: 'Стабильность', color: '#4fc3d9' },
  { key: 'threat', label: 'Угрозы', color: '#ff6b5b' }
]
const deltaDays = computed(() => props.snaps.filter(p => p.delta).map(p => p.day).reverse())
const deltaDay = ref(null)
watch(deltaDays, d => { if (!d.includes(deltaDay.value)) deltaDay.value = d[0] ?? null }, { immediate: true })
const deltaRows = computed(() => {
  const p = props.snaps.find(x => x.day === deltaDay.value && x.delta)
  return Object.entries(p?.delta || {}).filter(([k, v]) => RES[k] && v).map(([k, v]) => ({ label: RES[k].label, v: Math.round(v * 10) / 10 })).sort((a, b) => b.v - a.v)
})

const TXT = '#cdbf9f', GRID = 'rgba(231, 197, 111, .1)'
const font = { family: 'Manrope, sans-serif', size: 11.5, weight: 600 }
const tooltip = { backgroundColor: '#1b1610', borderColor: 'rgba(231, 197, 111, .5)', borderWidth: 1, titleColor: '#f3dc9e', bodyColor: '#e9dfc8', titleFont: { ...font, weight: 800 }, bodyFont: font, padding: 10, cornerRadius: 10 }
const still = matchMedia('(prefers-reduced-motion: reduce)').matches

function drawMood() {
  if (!Chart || !moodEl.value) return
  mood?.destroy()
  mood = new Chart(moodEl.value, {
    type: 'line',
    data: {
      labels: props.snaps.map(p => p.day),
      datasets: MOOD.map(m => ({
        label: m.label, data: props.snaps.map(p => p[m.key] ?? null), borderColor: m.color, backgroundColor: m.color + '22',
        borderWidth: 2.5, tension: 0.3, pointRadius: props.snaps.length > 30 ? 0 : 3, pointHoverRadius: 5, fill: m.key === 'morale'
      }))
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: still ? false : { duration: 700 },
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { title: { display: true, text: 'день', color: TXT, font }, ticks: { color: TXT, font, maxTicksLimit: 10 }, grid: { color: GRID } },
        y: { min: 0, max: 100, ticks: { color: TXT, font, stepSize: 25 }, grid: { color: GRID } }
      },
      plugins: { legend: { labels: { color: TXT, font, usePointStyle: true, boxWidth: 8 } }, tooltip: { ...tooltip, callbacks: { title: i => `День ${i[0].label}` } } }
    }
  })
}
function drawDelta() {
  if (!Chart || !deltaEl.value) return
  delta?.destroy()
  const rows = deltaRows.value
  delta = new Chart(deltaEl.value, {
    type: 'bar',
    data: { labels: rows.map(r => r.label), datasets: [{ data: rows.map(r => r.v), backgroundColor: rows.map(r => (r.v >= 0 ? '#9be07acc' : '#ff6b5bcc')), borderRadius: 4, barThickness: 14 }] },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false, animation: still ? false : { duration: 600 },
      scales: { x: { ticks: { color: TXT, font }, grid: { color: GRID } }, y: { ticks: { color: TXT, font }, grid: { display: false } } },
      plugins: { legend: { display: false }, tooltip: { ...tooltip, callbacks: { label: c => ` ${c.raw > 0 ? '+' : ''}${c.raw.toLocaleString('ru-RU')} за день` } } }
    }
  })
}

onMounted(async () => {
  const m = await import('chart.js')
  m.Chart.register(m.LineController, m.LineElement, m.PointElement, m.BarController, m.BarElement, m.LinearScale, m.CategoryScale, m.Filler, m.Tooltip, m.Legend)
  Chart = m.Chart
  drawMood()
  drawDelta()
})
watch(() => props.snaps, () => { drawMood(); drawDelta() }, { deep: true })
watch(deltaDay, drawDelta)
onBeforeUnmount(() => { mood?.destroy(); delta?.destroy() })
</script>

<style scoped>
.sc { display: grid; gap: 14px; margin: 14px 0; }
.sc-box { min-width: 0; padding: 12px 14px; border-radius: 14px; background: rgba(255, 255, 255, .025); border: 1px solid rgba(231, 197, 111, .14); }
.sc-h { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 10px; margin-bottom: 8px; }
.sc-h b { font: 700 16px 'Cormorant Garamond', serif; color: #e6c27a; }
.sc-h small { color: #a8936c; font-size: 12px; }
.sc-sel { margin-left: auto; padding: 4px 8px; border-radius: 8px; border: 1px solid rgba(231, 197, 111, .3); background: #15110c; color: #efe3c8; font: 600 12.5px 'Manrope', sans-serif; }
.sc-note { margin: 0 0 8px; color: #a8936c; font-size: 12px; }
.sc-canvas { position: relative; height: 220px; }
</style>
