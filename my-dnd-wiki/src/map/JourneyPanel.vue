<template>
  <aside v-if="plan && party" class="journey ui-panel">
    <header class="j-head">
      <div class="dot" :style="{ background: party.color }"><Icon :name="party.icon" :size="18" /></div>
      <div class="j-titles">
        <div class="ui-kicker">Маршрут отряда</div>
        <h2 class="ui-title">{{ party.name }}</h2>
      </div>
      <button class="ui-btn icon ghost" title="Отмена (Esc)" @click="cancel"><Icon name="close" /></button>
    </header>

    <div class="j-body ui-scroll">
      <ol class="steps">
        <li :class="{ done: plan.waypoints.length }">Кликай по карте — добавляй точки пути. <span class="ui-muted">Backspace — убрать последнюю.</span></li>
        <li :class="{ done: plan.waypoints.length }">Проверь длину и время.</li>
        <li>Нажми «Отправить» — отряд пойдёт в реальном времени.</li>
      </ol>

      <label class="ui-check"><input v-model="plan.byRoad" type="checkbox" /> Прокладывать по дорогам</label>
      <div v-if="plan.byRoad && path && plan.waypoints.length && !path.byRoad" class="warn">Часть пути идёт напрямик — рядом с точкой нет дороги.</div>

      <!-- точки интереса: у каждой можно подписать название, видно время прибытия -->
      <ol v-if="plan.waypoints.length" class="pois">
        <li v-for="(w, i) in plan.waypoints" :key="i">
          <span class="n">{{ i + 1 }}</span>
          <input v-model="names[i]" class="ui-input" :placeholder="i === plan.waypoints.length - 1 ? 'Цель' : 'Точка интереса'" maxlength="60" />
          <small v-if="durationMs > 0 && path?.marks?.[i] != null">{{ etaText(i) }}</small>
        </li>
      </ol>

      <div class="stats">
        <div><span class="ui-kicker">Точек</span><b>{{ plan.waypoints.length }}</b></div>
        <div><span class="ui-kicker">Расстояние</span><b>{{ path ? fmtKm(path.length) : '—' }}</b></div>
        <div><span class="ui-kicker">В игре</span><b>{{ gameDaysText }}</b></div>
      </div>

      <hr class="ui-divider" />

      <div class="ui-field"><span>Как задать время пути</span>
        <select v-model="mode" class="ui-input">
          <option value="pace">По темпу (скорость отряда)</option>
          <option value="gameDays">За N игровых дней</option>
          <option value="arriveBy">Прибыть к дате и времени</option>
          <option value="manual">За N реальных дней / часов</option>
          <option value="session">Показ на сессии (секунды)</option>
        </select>
      </div>

      <template v-if="mode === 'pace'">
        <div class="ui-row">
          <select v-model.number="paceKm" class="ui-input">
            <option :value="basePace">{{ party.pace ? 'Темп отряда' : 'По умолчанию' }} — {{ basePace }} км</option>
            <option v-for="p in PACE_PRESETS" :key="p.km" :value="p.km">{{ p.label }} — {{ p.km }} км</option>
          </select>
          <input v-model.number="paceKm" type="number" min="1" class="ui-input pace-in" title="км за игровой день" />
        </div>
        <div class="ui-muted small">км за игровой день · 1 игровой день = {{ s.realHoursPerGameDay }} ч реального времени</div>
      </template>

      <label v-else-if="mode === 'gameDays'" class="ui-field"><span>Игровых дней в пути</span>
        <input v-model.number="gameDaysInput" type="number" min="0.05" step="0.5" class="ui-input" />
      </label>

      <template v-else-if="mode === 'arriveBy'">
        <input v-model="arriveStr" type="datetime-local" class="ui-input" />
        <div class="chips">
          <button v-for="q in QUICK" :key="q.label" type="button" class="ui-chip quick" @click="arriveStr = toLocal(q.at())">{{ q.label }}</button>
        </div>
        <div v-if="arriveBad" class="warn">Время прибытия должно быть позже старта.</div>
      </template>

      <div v-else-if="mode === 'manual'" class="ui-row">
        <label class="ui-field"><span>Дни</span><input v-model.number="manual.d" type="number" min="0" class="ui-input" /></label>
        <label class="ui-field"><span>Часы</span><input v-model.number="manual.h" type="number" min="0" class="ui-input" /></label>
        <label class="ui-field"><span>Минуты</span><input v-model.number="manual.m" type="number" min="0" class="ui-input" /></label>
      </div>

      <label v-else class="ui-field"><span>Секунд анимации</span>
        <input v-model.number="sessionSec" type="number" min="1" max="300" class="ui-input" />
      </label>

      <div v-if="durationMs > 0 && path && plan.waypoints.length" class="calc">
        <span>В пути: <b>{{ fmtDuration(durationMs) }}</b></span>
        <span v-if="mode !== 'session'">≈ <b>{{ effPace }}</b> км/игр. день</span>
      </div>

      <template v-if="mode !== 'arriveBy'">
        <div class="ui-field"><span>Старт</span>
          <div class="seg">
            <button :class="{ on: !delayed }" @click="delayed = false">Сейчас</button>
            <button :class="{ on: delayed }" @click="delayed = true">По времени</button>
          </div>
        </div>
        <input v-if="delayed" v-model="startStr" type="datetime-local" class="ui-input" />
      </template>

      <label class="ui-check follow"><input v-model="follow" type="checkbox" /> Камера всех игроков следит за отрядом</label>

      <label class="ui-field label-field"><span>Подпись (видят игроки)</span><input v-model="label" class="ui-input" maxlength="120" placeholder="напр. «Караван в Мунлихт»" /></label>

      <div class="eta" v-if="durationMs > 0 && plan.waypoints.length">
        Прибытие: <b>{{ fmtDateTime(startAt + durationMs) }}</b>
      </div>
    </div>

    <footer class="j-foot">
      <button class="ui-btn" :disabled="!plan.waypoints.length" @click="plan.waypoints.pop()"><Icon name="undo" :size="16" /></button>
      <button class="ui-btn primary" :disabled="!canSend" @click="send"><Icon name="play" :size="16" /> Отправить</button>
    </footer>
  </aside>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import Icon from './Icon.vue'
import { store, act, planPath, fmtKm, fmtDuration, fmtDateTime, km, sendFollow } from './store.js'
import { PACE_PRESETS } from '../shared/catalog.js'

const plan = computed(() => store.journeyPlan)
const party = computed(() => plan.value && store.data.parties.find(p => p.id === plan.value.partyId))
const path = planPath
const s = computed(() => store.data.settings)

const mode = ref('pace')
const manual = reactive({ d: 0, h: 2, m: 0 })
const delayed = ref(false)
const startStr = ref('')
const label = ref('')
// названия точек (видны всем на карте) — параллельно точкам маршрута
const names = ref([])
watch(() => plan.value?.waypoints.length, n => { if (n != null) names.value = names.value.slice(0, n) })
watch(() => plan.value?.names, v => { if (v) names.value = [...v] }, { immediate: true })
watch(() => plan.value?.label, v => { if (v) label.value = v }, { immediate: true })
const share = i => (path.value?.length ? Math.min(1, path.value.marks[i] / path.value.length) : 0)
function etaText(i) {
  const t = startAt.value + durationMs.value * share(i)
  return `${fmtDateTime(t)} · через ${fmtDuration(t - store.now)}`
}
const gameDaysInput = ref(3)
const sessionSec = ref(8)
const arriveStr = ref('')
const follow = ref(false)
watch(mode, m => { if (m === 'session') follow.value = true })

const basePace = computed(() => party.value?.pace || s.value.paceKmPerDay || 38)
const paceKm = ref(38)
watch(() => plan.value?.partyId, () => { paceKm.value = basePace.value }, { immediate: true })

const HOUR = 3600000
const realPerGameDay = computed(() => (s.value.realHoursPerGameDay || 24) * HOUR)
const distKm = computed(() => (path.value ? km(path.value.length) : 0))
const gameDays = computed(() => distKm.value / (basePace.value || 38))
const gameDaysText = computed(() => {
  const d = gameDays.value
  if (!d) return '—'
  return d < 1 ? `${Math.max(1, Math.round(d * 24))} ч` : `${d.toFixed(1)} дн.`
})

const toLocal = ms => {
  const d = new Date(ms)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
// быстрые варианты «к какому сроку»
const at = (days, hour) => {
  const d = new Date(store.now)
  d.setDate(d.getDate() + days)
  d.setHours(hour, 0, 0, 0)
  return d.getTime()
}
const nextWeekday = (wd, hour) => {
  const d = new Date(store.now)
  let add = (wd - d.getDay() + 7) % 7
  if (add === 0 && d.getHours() >= hour) add = 7
  return at(add, hour)
}
const QUICK = [
  { label: 'К воскресенью 18:00', at: () => nextWeekday(0, 18) },
  { label: 'К субботе 18:00', at: () => nextWeekday(6, 18) },
  { label: 'Завтра 12:00', at: () => at(1, 12) },
  { label: 'Через неделю', at: () => store.now + 7 * 24 * HOUR }
]

const startAt = computed(() => (mode.value !== 'arriveBy' && delayed.value && startStr.value ? new Date(startStr.value).getTime() : store.now))
const arriveAt = computed(() => (arriveStr.value ? new Date(arriveStr.value).getTime() : 0))
const arriveBad = computed(() => mode.value === 'arriveBy' && arriveAt.value && arriveAt.value <= startAt.value)

const durationMs = computed(() => {
  switch (mode.value) {
    case 'pace': return (distKm.value / Math.max(1, paceKm.value || 1)) * realPerGameDay.value
    case 'gameDays': return Math.max(0, gameDaysInput.value || 0) * realPerGameDay.value
    case 'arriveBy': return arriveAt.value ? arriveAt.value - startAt.value : 0
    case 'manual': return ((manual.d || 0) * 1440 + (manual.h || 0) * 60 + (manual.m || 0)) * 60000
    default: return Math.max(1, sessionSec.value || 1) * 1000
  }
})
// какая скорость при этом получается — чтобы мастер видел, правдоподобно ли
const effPace = computed(() => {
  const days = durationMs.value / realPerGameDay.value
  return days > 0 ? Math.round(distKm.value / days) : '—'
})
const canSend = computed(() => plan.value?.waypoints.length && durationMs.value >= 1000)

function cancel() {
  store.journeyPlan = null
}

async function send() {
  const body = {
    path: path.value.points,
    startAt: Math.round(startAt.value),
    endAt: Math.round(startAt.value + durationMs.value),
    label: label.value,
    stops: plan.value.waypoints.map((w, i) => ({ x: w[0], y: w[1], name: names.value[i] || '', s: share(i) }))
  }
  try {
    await act('POST', `/api/parties/${party.value.id}/journey`, body, 'Отряд выступил!')
    if (follow.value) {
      const f = { mode: 'party', partyId: party.value.id, until: body.endAt + 1500 }
      sendFollow(f)
      store.follow = f
    }
    store.selection = { type: 'parties', id: party.value.id }
    store.journeyPlan = null
  } catch { /* тост */ }
}
</script>

<style scoped>
.journey { position: absolute; top: 76px; right: 16px; width: 340px; max-height: calc(100% - 92px); display: flex; flex-direction: column; z-index: 21; }
.j-head { display: flex; align-items: center; gap: 12px; padding: 14px 14px 10px 16px; border-bottom: 1px solid var(--line-2); }
.dot { width: 38px; height: 38px; border-radius: 50%; display: grid; place-items: center; color: #0b0f17; flex: none; }
.j-titles { flex: 1; min-width: 0; }
.j-titles h2 { margin: 0; font-size: 22px; }
.j-body { padding: 12px 16px; flex: 1; }
.pois { list-style: none; margin: 0 0 10px; padding: 0; display: grid; gap: 6px; }
.pois li { display: grid; grid-template-columns: 22px 1fr; gap: 2px 8px; align-items: center; }
.pois .n { width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; background: var(--gold, #e7c56f); color: #1b1408; font-weight: 800; font-size: 12px; }
.pois small { grid-column: 2; color: var(--muted, #9d978b); font-size: 11.5px; }
.steps { margin: 0 0 12px; padding-left: 18px; font-size: 13px; display: grid; gap: 4px; }
.steps li.done { color: var(--muted); }
.warn { font-size: 12px; color: #ffcf8a; margin: -4px 0 10px; }
.stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.stats > div { display: grid; gap: 2px; padding: 8px 10px; border-radius: 10px; background: rgba(255, 255, 255, 0.04); }
.stats b { font-size: 16px; color: var(--gold-2); }
.calc { display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; font-size: 12.5px; padding: 8px 10px; border-radius: 10px; background: rgba(255, 255, 255, 0.04); margin: 4px 0 12px; }
.calc b { color: var(--gold-2); }
.chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0 10px; }
.quick { border: 0; cursor: pointer; }
.quick:hover { background: rgba(231, 197, 111, 0.2); }
.pace-in { max-width: 80px; }
.follow { margin-top: 12px; }
.seg { display: flex; padding: 3px; border-radius: 10px; background: rgba(0, 0, 0, 0.3); border: 1px solid var(--line-2); }
.seg button { flex: 1; height: 30px; border: 0; border-radius: 8px; background: none; color: var(--muted); font: 700 12.5px var(--sans); cursor: pointer; }
.seg button.on { background: rgba(231, 197, 111, 0.18); color: var(--gold-2); }
.small { font-size: 12.5px; margin-bottom: 12px; }
.gold { color: var(--gold-2); }
.label-field { margin-top: 12px; }
.eta { font-size: 13px; padding: 10px 12px; border-radius: 10px; background: rgba(231, 197, 111, 0.1); border: 1px solid rgba(231, 197, 111, 0.25); }
.j-foot { display: flex; gap: 8px; padding: 12px 16px; border-top: 1px solid var(--line-2); }
.j-foot .primary { flex: 1; }

@media (max-width: 760px) {
  .journey { top: auto; left: 8px; right: 8px; bottom: 8px; width: auto; max-height: 46vh; }
  .steps { display: none; }
  .j-head { padding: 10px 12px 8px; }
}
</style>
