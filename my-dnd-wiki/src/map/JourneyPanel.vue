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

      <div class="stats">
        <div><span class="ui-kicker">Точек</span><b>{{ plan.waypoints.length }}</b></div>
        <div><span class="ui-kicker">Расстояние</span><b>{{ path ? fmtKm(path.length) : '—' }}</b></div>
        <div><span class="ui-kicker">В игре</span><b>{{ gameDaysText }}</b></div>
      </div>

      <hr class="ui-divider" />

      <div class="ui-field"><span>Длительность в реальном времени</span>
        <div class="seg">
          <button :class="{ on: mode === 'auto' }" @click="mode = 'auto'">По темпу</button>
          <button :class="{ on: mode === 'manual' }" @click="mode = 'manual'">Вручную</button>
        </div>
      </div>
      <div v-if="mode === 'auto'" class="ui-muted small">
        Темп {{ s.paceKmPerDay }} км/игровой день, 1 игровой день = {{ s.realHoursPerGameDay }} ч реального времени
        (меняется в настройках) → <b class="gold">{{ fmtDuration(autoMs) }}</b>
      </div>
      <div v-else class="ui-row">
        <label class="ui-field"><span>Дни</span><input v-model.number="manual.d" type="number" min="0" class="ui-input" /></label>
        <label class="ui-field"><span>Часы</span><input v-model.number="manual.h" type="number" min="0" class="ui-input" /></label>
        <label class="ui-field"><span>Минуты</span><input v-model.number="manual.m" type="number" min="0" class="ui-input" /></label>
      </div>

      <div class="ui-field"><span>Старт</span>
        <div class="seg">
          <button :class="{ on: !delayed }" @click="delayed = false">Сейчас</button>
          <button :class="{ on: delayed }" @click="delayed = true">По времени</button>
        </div>
      </div>
      <input v-if="delayed" v-model="startStr" type="datetime-local" class="ui-input" />

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
import { computed, reactive, ref } from 'vue'
import Icon from './Icon.vue'
import { store, act, planPath, fmtKm, fmtDuration, fmtDateTime, km } from './store.js'

const plan = computed(() => store.journeyPlan)
const party = computed(() => plan.value && store.data.parties.find(p => p.id === plan.value.partyId))
const path = planPath
const s = computed(() => store.data.settings)

const mode = ref('auto')
const manual = reactive({ d: 0, h: 2, m: 0 })
const delayed = ref(false)
const startStr = ref('')
const label = ref('')

const gameDays = computed(() => (path.value ? km(path.value.length) / (s.value.paceKmPerDay || 38) : 0))
const gameDaysText = computed(() => {
  const d = gameDays.value
  if (!d) return '—'
  return d < 1 ? `${Math.max(1, Math.round(d * 24))} ч` : `${d.toFixed(1)} дн.`
})
const autoMs = computed(() => gameDays.value * (s.value.realHoursPerGameDay || 24) * 3600000)
const durationMs = computed(() => (mode.value === 'auto' ? autoMs.value : ((manual.d || 0) * 1440 + (manual.h || 0) * 60 + (manual.m || 0)) * 60000))
const startAt = computed(() => (delayed.value && startStr.value ? new Date(startStr.value).getTime() : store.now))
const canSend = computed(() => plan.value?.waypoints.length && durationMs.value >= 1000)

function cancel() {
  store.journeyPlan = null
}

async function send() {
  const body = {
    path: path.value.points,
    startAt: Math.round(startAt.value),
    endAt: Math.round(startAt.value + durationMs.value),
    label: label.value
  }
  try {
    await act('POST', `/api/parties/${party.value.id}/journey`, body, 'Отряд выступил!')
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
.steps { margin: 0 0 12px; padding-left: 18px; font-size: 13px; display: grid; gap: 4px; }
.steps li.done { color: var(--muted); }
.warn { font-size: 12px; color: #ffcf8a; margin: -4px 0 10px; }
.stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.stats > div { display: grid; gap: 2px; padding: 8px 10px; border-radius: 10px; background: rgba(255, 255, 255, 0.04); }
.stats b { font-size: 16px; color: var(--gold-2); }
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
