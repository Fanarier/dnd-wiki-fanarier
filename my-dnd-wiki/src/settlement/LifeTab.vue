<template>
  <div class="lt">
    <h3>Жизнь поселения <small>{{ clock.icon }} {{ clock.time }} · день {{ clock.day }} · {{ clock.part }}</small></h3>
    <div class="lt-clock">
      <template v-if="master">
        <button v-for="sp in CLOCK_SPEEDS" :key="sp.v" type="button" :class="{ on: clock.speed === sp.v }" :title="sp.title" @click="$emit('clock', sp.v)">{{ sp.label }} <span>{{ sp.title.split(':')[0] }}</span></button>
      </template>
      <span v-else class="muted">{{ clock.speed ? 'Время идёт' : 'Мастер поставил время на паузу' }}</span>
    </div>
    <p class="muted">Жители — по числам поселения: кто на какой работе, где живёт. Ходят по дорогам, работают, вечером — в таверну, ночью спят. С новыми сутками хозяйство проживает день, как по «Прошёл день». Приблизь карту, чтобы их увидеть; щёлкни по жителю — он появится здесь.</p>

    <!-- выбранный житель -->
    <section v-if="sel" class="pc">
      <div class="pc-top">
        <i class="dot" :style="{ background: RACE_COLORS[sel.p.race] }" />
        <div>
          <b>{{ sel.p.name }}</b>
          <small>{{ RACES[sel.p.race]?.label }}{{ sel.p.kid ? ', ребёнок' : '' }} · {{ sel.p.age }} {{ years(sel.p.age) }} · {{ jobLabel(sel.p) }}</small>
        </div>
        <button class="x" type="button" title="Закрыть" @click="$emit('person', null)">×</button>
      </div>
      <div class="pc-rows">
        <div><span>Сейчас</span><b>{{ sel.icon }} {{ sel.doing }}</b></div>
        <div><span>Живёт</span><b>{{ placeName(sel.p.home) || 'нет дома — ночует у двора старейшины' }}</b></div>
        <div v-if="sel.p.work"><span>Работает</span><b>{{ placeName(sel.p.work) }}</b></div>
        <div v-if="sel.p.outpost"><span>Работает</span><b>аванпост «{{ sel.p.outpost.name }}»</b></div>
      </div>
      <small class="pc-sub">Распорядок на сегодня</small>
      <ol class="pc-day">
        <li v-for="(x, i) in sel.day" :key="i" :class="{ now: x.now, past: x.past }"><time>{{ x.from }}</time>{{ x.icon }} {{ x.text }}</li>
      </ol>
      <button class="mini" type="button" @click="$emit('focus', sel.p.id)">📍 Показать на карте</button>
    </section>

    <!-- сводка: кто чем занят прямо сейчас -->
    <h4>Сейчас</h4>
    <div class="sum">
      <button v-for="g in summary" :key="g.group" type="button" class="sum-i" :disabled="!g.at" :title="g.at ? 'Показать на карте' : ''" @click="g.at && $emit('focus-at', g.at)">
        <span>{{ g.icon }}</span><em>{{ g.group }}</em><b>{{ g.n }}</b>
      </button>
    </div>

    <!-- лента моментов -->
    <h4>Лента <small>сегодня, новые сверху</small></h4>
    <div class="feed">
      <p v-if="!feed.length" class="muted">Пока тихо — утро только началось.</p>
      <button v-for="(m, i) in feed" :key="i" type="button" class="fd" @click="m.who && ($emit('person', m.who), $emit('focus', m.who))" :title="m.who ? 'Показать жителя' : ''"><time>{{ hhmm(m.t) }}</time><span>{{ m.icon }}</span><em>{{ m.text }}</em></button>
    </div>

    <!-- все жители -->
    <h4>Жители <small>{{ rows.length }} из {{ cast.people.length }}</small></h4>
    <div class="flt">
      <input v-model="q" placeholder="Имя…" />
      <select v-model="fJob"><option value="">все работы</option><option v-for="j in jobs" :key="j.key" :value="j.key">{{ j.label }} ({{ j.n }})</option></select>
      <select v-model="fRace"><option value="">все расы</option><option v-for="r in settlement.races" :key="r.race" :value="r.race">{{ RACES[r.race]?.label }}</option></select>
    </div>
    <div class="ppl">
      <button v-for="r in rows" :key="r.p.id" type="button" class="pp" :class="{ on: person === r.p.id, gone: r.p.away }" @click="$emit('person', r.p.id); $emit('focus', r.p.id)">
        <i class="dot" :style="{ background: RACE_COLORS[r.p.race] }" />
        <b>{{ r.p.name }}</b>
        <small>{{ jobLabel(r.p) }}</small>
        <em>{{ r.talk ? '💬' : ACTS[r.act]?.icon }} {{ r.doing }}</em>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { store } from '../map/store.js'
import { RACES, JOBS } from '../shared/settlement.js'
import { buildCast, dayPlans, snapshotAt, moments, personAt, ACTS, jobLabel, jobAct } from '../shared/life.js'
import { clockMin, clockOf, dayTime, partOfDay, CLOCK_SPEEDS, DAY_MIN } from '../shared/clock.js'
import { RACE_COLORS } from './armyFaces.js'

const props = defineProps({ settlement: Object, calc: Object, master: Boolean, person: String })
defineEmits(['clock', 'focus', 'focus-at', 'person'])
// время тикает раз в пару секунд — вкладке хватит
const now = ref(Date.now())
const timer = setInterval(() => { now.value = Date.now() }, 2000)
onBeforeUnmount(() => clearInterval(timer))
const t = computed(() => clockMin(props.settlement, now.value + (store.clockOffset || 0)))
const day = computed(() => Math.floor(t.value / DAY_MIN))
const tod = computed(() => t.value - day.value * DAY_MIN)
const clock = computed(() => { const dt = dayTime(t.value), pd = partOfDay(dt.of); return { time: dt.text, day: dt.day, icon: pd.icon, part: pd.label, speed: clockOf(props.settlement).speed || 0 } })
const cast = computed(() => buildCast(props.settlement))
const plans = computed(() => dayPlans(cast.value, day.value))
const snap = computed(() => snapshotAt(cast.value, plans.value, tod.value))
const hhmm = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.floor(m % 60)).padStart(2, '0')}`
const years = n => (n % 10 === 1 && n % 100 !== 11 ? 'год' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'года' : 'лет')
const placeName = id => cast.value.byId[id]?.name || ''
const doing = x => (x.act === 'away' ? `в отряде «${x.p.away}»` : x.talk ? 'болтает' : ACTS[x.act]?.label || 'дома')

// сводка: по группам дел; «показать» — к середине тех, кого видно
const summary = computed(() => {
  const g = new Map()
  for (const x of snap.value) {
    const key = x.act === 'away' ? 'В отрядах' : x.talk ? 'Болтают' : ACTS[x.act]?.group || 'Дома'
    const icon = x.act === 'away' ? '⚔' : x.talk ? '💬' : ACTS[x.act]?.icon || '🏠'
    if (!g.has(key)) g.set(key, { group: key, icon, n: 0, xs: [] })
    const e = g.get(key)
    e.n++
    if (!x.hidden && x.x != null) e.xs.push([x.x, x.y])
  }
  return [...g.values()].sort((a, b) => b.n - a.n).map(e => ({ ...e, at: e.xs.length ? { x: e.xs.reduce((n, p) => n + p[0], 0) / e.xs.length, y: e.xs.reduce((n, p) => n + p[1], 0) / e.xs.length } : null }))
})
const feed = computed(() => moments(cast.value, plans.value, tod.value, 50))

// выбранный житель и его день: работа (рубит, тащит, снова идёт к дереву) — одной строкой, короткие переходы не считаем
const WORK_ACTS = new Set(['chop', 'haul', 'work', 'hunt', 'gather', 'farm', 'water', 'patrol', 'build', 'mine', 'serve', 'trade', 'outpost'])
const sel = computed(() => {
  const p = cast.value.people.find(x => x.id === props.person)
  if (!p) return null
  const st = p.away ? null : personAt(plans.value[p.id], tod.value)
  const segs = plans.value[p.id] || []
  const main = jobAct(p)
  const day = []
  for (const sg of segs) {
    let act = WORK_ACTS.has(sg.act) ? main : sg.act
    const lastRow = day[day.length - 1]
    // переход между делами на работе — часть работы
    if (act === 'walk' && lastRow?.act === main && sg.t1 - sg.t0 < 20) act = main
    if (lastRow && lastRow.act === act) { lastRow.t1 = sg.t1; continue }
    day.push({ act, t0: sg.t0, t1: sg.t1 })
  }
  return {
    p, st, icon: st?.talk ? '💬' : ACTS[st?.act]?.icon || '', doing: p.away ? `ушёл с отрядом «${p.away}»` : st?.talk ? 'болтает' : ACTS[st?.act]?.label || 'дома',
    day: day.filter(x => x.t1 - x.t0 >= 3).map(x => ({ from: hhmm(x.t0), icon: ACTS[x.act]?.icon || '', text: ACTS[x.act]?.label || x.act, now: tod.value >= x.t0 && tod.value < x.t1, past: x.t1 <= tod.value }))
  }
})

// список и фильтры
const q = ref('')
const fJob = ref('')
const fRace = ref('')
const jobs = computed(() => {
  const m = new Map()
  for (const p of cast.value.people) m.set(p.job, (m.get(p.job) || 0) + 1)
  return [...m.entries()].map(([key, n]) => ({ key, n, label: key === 'free' ? 'без работы / дети' : key === 'builder' ? 'строители' : key === 'outpost' ? 'на аванпостах' : JOBS[key]?.label || key })).sort((a, b) => b.n - a.n)
})
const rows = computed(() => {
  const needle = q.value.trim().toLowerCase()
  return snap.value
    .filter(x => (!fJob.value || x.p.job === fJob.value) && (!fRace.value || x.p.race === fRace.value) && (!needle || x.p.name.toLowerCase().includes(needle)))
    .map(x => ({ ...x, doing: doing(x) }))
})
</script>

<style scoped>
.lt h3 { margin: 2px 0 8px; font: 700 22px var(--a-serif); color: var(--a-gold-2); }
.lt h3 small, .lt h4 small { font: 600 12px var(--a-sans); color: var(--a-muted); margin-left: 6px; }
.lt h4 { margin: 14px 0 6px; font: 700 17px var(--a-serif); color: var(--a-gold-2); }
.muted { color: var(--a-muted); font-size: 12px; }
.lt-clock { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 6px; }
.lt-clock button { padding: 4px 9px; border-radius: 8px; border: 1px solid var(--a-line); background: rgba(231, 197, 111, .06); color: var(--a-gold-2); font: 700 12px var(--a-sans); cursor: pointer; }
.lt-clock button span { color: var(--a-muted); font-weight: 600; }
.lt-clock button.on { background: linear-gradient(180deg, #f0d083, #c9a24f); color: #1b1408; border-color: transparent; }
.lt-clock button.on span { color: #3a2a10; }
.dot { width: 12px; height: 12px; border-radius: 50%; flex: none; box-shadow: 0 0 0 2px rgba(0, 0, 0, .35); }
.pc { margin: 8px 0; padding: 10px 12px; border-radius: 13px; background: rgba(231, 197, 111, .07); border: 1px solid rgba(231, 197, 111, .35); }
.pc-top { display: flex; gap: 10px; align-items: center; }
.pc-top b { display: block; font: 700 19px var(--a-serif); color: var(--a-gold-2); }
.pc-top small { color: #b9ab8a; font-size: 12px; font-weight: 600; }
.pc-top .x { margin-left: auto; border: 0; background: none; color: var(--a-muted); font-size: 22px; cursor: pointer; }
.pc-rows { display: grid; gap: 3px; margin: 8px 0; font-size: 12.5px; }
.pc-rows div { display: flex; justify-content: space-between; gap: 10px; }
.pc-rows span { color: var(--a-muted); }
.pc-sub { color: var(--a-muted); font-weight: 800; font-size: 11.5px; }
.pc-day { margin: 4px 0 8px; padding: 0; list-style: none; display: grid; gap: 1px; font-size: 12px; max-height: 200px; overflow-y: auto; }
.pc-day li { display: flex; gap: 8px; color: #d9cdb0; }
.pc-day li.past { color: #7d6c4e; }
.pc-day li.now { color: #f3d99a; font-weight: 800; }
.pc-day time { width: 38px; flex: none; font-variant-numeric: tabular-nums; color: #a8936c; }
.mini { padding: 4px 9px; border-radius: 8px; border: 1px solid var(--a-line); background: rgba(231, 197, 111, .08); color: var(--a-gold-2); font: 700 12px var(--a-sans); cursor: pointer; }
.sum { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(150px, 100%), 1fr)); gap: 5px; }
.sum-i { display: flex; align-items: center; gap: 7px; min-width: 0; padding: 6px 9px; border-radius: 10px; border: 1px solid rgba(231, 197, 111, .16); background: rgba(255, 255, 255, .03); color: var(--a-text); font: 600 12.5px var(--a-sans); cursor: pointer; text-align: left; }
.sum-i:disabled { cursor: default; opacity: .75; }
.sum-i:not(:disabled):hover { border-color: rgba(231, 197, 111, .45); }
.sum-i em { flex: 1; min-width: 0; font-style: normal; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sum-i b { color: var(--a-gold-2); }
.feed { display: grid; gap: 2px; max-height: 280px; overflow-y: auto; padding-right: 4px; }
.fd { display: flex; gap: 8px; align-items: baseline; padding: 4px 6px; border: 0; border-radius: 7px; background: none; color: #d9cdb0; font: 600 12.5px var(--a-sans); text-align: left; cursor: pointer; }
.fd:hover { background: rgba(231, 197, 111, .07); }
.fd time { width: 38px; flex: none; color: #a8936c; font-variant-numeric: tabular-nums; }
.fd em { font-style: normal; min-width: 0; }
.flt { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 6px; }
.flt input, .flt select { flex: 1 1 120px; min-width: 0; padding: 5px 8px; border-radius: 8px; border: 1px solid var(--a-line-2); background: rgba(0, 0, 0, .3); color: var(--a-text); font: 600 12.5px var(--a-sans); }
.ppl { display: grid; gap: 2px; max-height: 420px; overflow-y: auto; padding-right: 4px; }
.pp { display: grid; grid-template-columns: 12px minmax(0, 1.3fr) minmax(0, 1fr) minmax(0, 1.2fr); gap: 8px; align-items: center; padding: 5px 7px; border: 0; border-radius: 8px; background: none; color: var(--a-text); font: 600 12.5px var(--a-sans); text-align: left; cursor: pointer; }
.pp:hover { background: rgba(231, 197, 111, .07); }
.pp.on { background: rgba(231, 197, 111, .16); }
.pp.gone { opacity: .55; }
.pp b, .pp small, .pp em { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pp small { color: var(--a-muted); }
.pp em { font-style: normal; color: #c9b88f; }
@media (max-width: 520px) { .pp { grid-template-columns: 12px minmax(0, 1fr) minmax(0, 1fr); } .pp small { display: none; } }
</style>
