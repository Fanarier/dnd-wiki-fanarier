<template>
  <!-- статистика журнала: на что уходит время героя, успех попыток, очки в тренировки, монеты и опыт,
       часы по сессиям; внизу — весь отряд рядом -->
  <div class="as">
    <div class="as-cards">
      <div class="as-card"><b>{{ fmt(s.hours) }}</b><small>часов в журнале</small></div>
      <div class="as-card"><b>{{ s.sessions }}</b><small>сессий · {{ s.count }} записей</small></div>
      <div class="as-card" :title="`Учтено ${s.done}, провалов ${s.fail}`"><b>{{ s.done + s.fail ? Math.round(s.done / (s.done + s.fail) * 100) : 0 }}%</b><small>попыток удачны</small></div>
      <div class="as-card"><b>{{ fmt(s.pts) }}</b><small>очков ушло в тренировки</small></div>
      <div class="as-card"><b>{{ s.streak }}</b><small>сессий подряд с тренировками</small></div>
      <div v-if="s.gold || s.exp" class="as-card"><b>{{ s.gold > 0 ? '+' : '' }}{{ fmt(s.gold) }} ЗМ</b><small>{{ s.exp ? `и ${fmt(s.exp)} опыта` : 'монет по журналу' }}</small></div>
    </div>
    <div v-if="!s.count" class="as-empty">Пока нечего считать.</div>
    <div v-else class="as-grid">
      <section class="as-box">
        <h3>На что уходит время</h3>
        <div class="as-ch round"><canvas ref="pieEl" /></div>
      </section>
      <section class="as-box">
        <h3>Чем занимается чаще всего</h3>
        <ol class="as-top">
          <li v-for="t in s.top" :key="t.name" :style="{ '--cc': t.color }">
            <span class="as-tn" :title="t.name">{{ t.icon }} {{ t.name }}</span>
            <span class="as-tb"><i :style="{ width: (t.hours / s.top[0].hours * 100) + '%' }" /></span>
            <small>{{ fmt(t.hours) }} ч · {{ t.n }}×</small>
          </li>
        </ol>
      </section>
      <section class="as-box wide">
        <h3>Часы по сессиям <small>линия — свободно {{ limit }} ч (обязательный отдых уже вычтен)</small></h3>
        <div class="as-ch"><canvas ref="barEl" /></div>
      </section>
      <section class="as-box wide">
        <h3>Отряд: часы по видам дел</h3>
        <div class="as-ch tall"><canvas ref="partyEl" /></div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { actState } from '../../map/store.js'
import { ACT_CATS, categoryOf, num, round, freeRows } from '../../shared/activities.js'

const props = defineProps({ heroId: { type: String, required: true }, budget: { type: Object, required: true } })
const limit = computed(() => props.budget.free)
const fmt = n => round(n, 1).toLocaleString('ru-RU')
const live = r => r.status !== 'cancel' && r.status !== 'plan'

function statsOf(rows) {
  rows = rows.filter(live)
  const byCat = new Map(), byName = new Map(), bySess = new Map()
  let hours = 0, pts = 0, gold = 0, exp = 0
  for (const r of rows) {
    const h = Math.max(0, num(r.hours))
    hours += h
    const c = categoryOf(r.name)
    byCat.set(c, (byCat.get(c) || 0) + h)
    const key = r.name.replace(/\s*[хx×]\s*\d+\s*$/i, '').trim()
    const t = byName.get(key) || { name: key, hours: 0, n: 0, cat: c }
    t.hours += h; t.n++
    byName.set(key, t)
    if (r.status === 'done') { pts += r.applied ? r.pts : 0; gold += r.gold || 0; exp += r.exp || 0 }
  }
  // часы по сессиям — свободные: сон в пределах нормы уже вычтен из периода
  const byDate = new Map()
  for (const r of rows) { if (!byDate.has(r.date)) byDate.set(r.date, []); byDate.get(r.date).push(r) }
  for (const [d, rs] of byDate) {
    const m = new Map()
    for (const r of freeRows(rs, props.budget).rows) { const c = categoryOf(r.name); m.set(c, (m.get(c) || 0) + Math.max(0, num(r.hours))) }
    bySess.set(d, m)
  }
  const dates = [...bySess.keys()].sort()
  let streak = 0
  for (const d of dates.slice().reverse()) { if (bySess.get(d).has('train') || bySess.get(d).has('study')) streak++; else break }
  return {
    count: rows.length, hours, pts, gold, exp, streak, sessions: dates.length,
    done: rows.filter(r => r.status === 'done' && r.type === 'repeat').length, fail: rows.filter(r => r.status === 'fail').length,
    byCat, dates, bySess,
    top: [...byName.values()].sort((a, b) => b.hours - a.hours).slice(0, 8).map(t => ({ ...t, icon: ACT_CATS[t.cat].icon, color: ACT_CATS[t.cat].color }))
  }
}
const s = computed(() => statsOf(actState.logs[props.heroId] || []))

/* ---------- графики (Chart.js грузится здесь же, по требованию) ---------- */
const pieEl = ref(null), barEl = ref(null), partyEl = ref(null)
let Chart = null
const charts = []
const css = { color: '#cdbf9f', font: { family: 'Manrope', weight: 700, size: 11 } }
const grid = { color: 'rgba(231, 197, 111, .08)' }
const tooltip = { backgroundColor: '#1b1610', borderColor: 'rgba(231, 197, 111, .4)', borderWidth: 1, titleColor: '#f3dc9e', bodyColor: '#efe3c8', padding: 10 }
function draw() {
  charts.splice(0).forEach(c => c.destroy())
  if (!Chart || !s.value.count) return
  const cats = Object.keys(ACT_CATS)
  if (pieEl.value) {
    const used = cats.filter(c => s.value.byCat.get(c))
    charts.push(new Chart(pieEl.value, {
      type: 'doughnut',
      data: { labels: used.map(c => `${ACT_CATS[c].icon} ${ACT_CATS[c].name}`), datasets: [{ data: used.map(c => round(s.value.byCat.get(c), 1)), backgroundColor: used.map(c => ACT_CATS[c].color), borderColor: '#14100b', borderWidth: 2 }] },
      options: { maintainAspectRatio: false, cutout: '58%', plugins: { legend: { position: 'right', labels: { ...css, boxWidth: 10 } }, tooltip: { ...tooltip, callbacks: { label: c => ` ${c.raw} ч` } } } }
    }))
  }
  if (barEl.value) {
    const dates = s.value.dates.slice(-16)
    charts.push(new Chart(barEl.value, {
      type: 'bar',
      data: {
        labels: dates.map(d => d.slice(5).split('-').reverse().join('.')),
        datasets: [
          ...cats.filter(c => dates.some(d => s.value.bySess.get(d).get(c))).map(c => ({ label: ACT_CATS[c].name, data: dates.map(d => round(s.value.bySess.get(d).get(c) || 0, 1)), backgroundColor: ACT_CATS[c].color, stack: 'h', borderRadius: 3 })),
          { type: 'line', label: 'Свободно', data: dates.map(() => limit.value), borderColor: '#ff7a6b', borderDash: [5, 4], pointRadius: 0, borderWidth: 1.5 }
        ]
      },
      options: { maintainAspectRatio: false, scales: { x: { stacked: true, ticks: css, grid }, y: { stacked: true, ticks: css, grid } }, plugins: { legend: { display: false }, tooltip: { ...tooltip, mode: 'index', filter: i => i.raw > 0 } } }
    }))
  }
  if (partyEl.value) {
    const heroes = actState.heroes.map(h => ({ h, st: statsOf(actState.logs[h.heroId] || []) })).filter(x => x.st.count).sort((a, b) => b.st.hours - a.st.hours)
    charts.push(new Chart(partyEl.value, {
      type: 'bar',
      data: {
        labels: heroes.map(x => x.h.name.split(' ')[0]),
        datasets: cats.map(c => ({ label: `${ACT_CATS[c].icon} ${ACT_CATS[c].name}`, data: heroes.map(x => round(x.st.byCat.get(c) || 0, 1)), backgroundColor: heroes.map(x => (x.h.heroId === props.heroId ? ACT_CATS[c].color : ACT_CATS[c].color + 'aa')), stack: 'p', borderRadius: 3 }))
      },
      options: { indexAxis: 'y', maintainAspectRatio: false, scales: { x: { stacked: true, ticks: css, grid }, y: { stacked: true, ticks: css, grid: { display: false } } }, plugins: { legend: { labels: { ...css, boxWidth: 10 } }, tooltip: { ...tooltip, filter: i => i.raw > 0 } } }
    }))
  }
}
onMounted(async () => {
  const m = await import('chart.js')
  m.Chart.register(m.DoughnutController, m.ArcElement, m.BarController, m.BarElement, m.LineController, m.LineElement, m.PointElement, m.LinearScale, m.CategoryScale, m.Tooltip, m.Legend)
  Chart = m.Chart
  await nextTick()
  draw()
})
watch([s, limit], () => nextTick(draw))
onBeforeUnmount(() => charts.splice(0).forEach(c => c.destroy()))
</script>

<style scoped>
.as { display: grid; gap: 12px; }
.as-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
.as-card { display: grid; gap: 2px; padding: 10px 12px; border-radius: 12px; background: linear-gradient(180deg, rgba(231, 197, 111, .1), rgba(20, 16, 11, .6)); border: 1px solid rgba(231, 197, 111, .18); }
.as-card b { color: #f3dc9e; font: 800 22px 'Manrope', sans-serif; }
.as-card small { color: #a8936c; font: 700 11.5px 'Manrope', sans-serif; }
.as-empty { padding: 20px; text-align: center; color: #a8936c; }
.as-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.as-box { min-width: 0; padding: 10px 12px; border-radius: 14px; background: rgba(20, 16, 11, .6); border: 1px solid rgba(231, 197, 111, .12); }
.as-box.wide { grid-column: 1 / -1; }
.as-box h3 { margin: 0 0 8px; font: 700 18px 'Cormorant Garamond', serif; color: #f3dc9e; }
.as-box h3 small { color: #a8936c; font: 600 11.5px 'Manrope', sans-serif; }
.as-ch { position: relative; height: 230px; }
.as-ch.round { height: 220px; }
.as-ch.tall { height: 300px; }
.as-top { display: grid; gap: 6px; margin: 0; padding: 0; list-style: none; }
.as-top li { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) auto; align-items: center; gap: 8px; }
.as-tn { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #efe3c8; font: 700 12.5px 'Manrope', sans-serif; }
.as-tb { height: 8px; border-radius: 99px; background: rgba(255, 255, 255, .05); overflow: hidden; }
.as-tb i { display: block; height: 100%; border-radius: 99px; background: var(--cc); }
.as-top small { color: #a8936c; font: 700 11px 'Manrope', sans-serif; white-space: nowrap; }
@media (max-width: 760px) { .as-grid { grid-template-columns: 1fr; } }
</style>
