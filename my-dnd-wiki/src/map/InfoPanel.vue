<template>
  <aside class="info ui-panel" v-if="item">
    <header class="info-head">
      <div class="info-badge" :style="{ color: accent }"><Icon :name="headIcon" :size="22" /></div>
      <div class="info-titles">
        <div class="ui-kicker">{{ kindLabel }}</div>
        <h2 class="ui-title">{{ item.name || 'Без названия' }}</h2>
      </div>
      <button class="ui-btn icon ghost" title="Закрыть (Esc)" @click="store.selection = null"><Icon name="close" /></button>
    </header>

    <div class="info-body ui-scroll">
      <!-- ======= Просмотр (видят все) ======= -->
      <div class="chips">
        <span v-if="item.hidden" class="ui-chip warn"><Icon name="eyeOff" :size="13" /> Скрыто от игроков</span>
        <template v-if="type === 'cities'">
          <span v-if="item.port" class="ui-chip"><Icon name="anchor" :size="13" /> Порт</span>
          <span v-if="item.population" class="ui-chip">≈ {{ item.population.toLocaleString('ru-RU') }} жителей</span>
        </template>
        <template v-if="type === 'roads'">
          <span class="ui-chip">{{ fmtKm(roadLen) }}</span>
          <span class="ui-chip">≈ {{ gameDays(roadLen) }} пути</span>
        </template>
        <template v-if="type === 'anomalies'">
          <span class="ui-chip" :class="{ gold: anomaly.active }">{{ anomalyStatus }}</span>
          <span v-if="item.kind === 'zone'" class="ui-chip">радиус ≈ {{ fmtKm(item.radius) }}</span>
        </template>
      </div>

      <button v-if="type === 'cities' && state" class="link-row" @click="select('states', state.id)">
        <i class="swatch" :style="{ background: state.color }" /> {{ state.name }}
      </button>

      <!-- отряд: в пути -->
      <div v-if="type === 'parties'" class="journey-box">
        <template v-if="journey">
          <div class="j-line">
            <span>{{ journey.waiting ? 'Выступит' : 'В пути' }}</span>
            <b>{{ journey.waiting ? fmtDateTime(item.journey.startAt) : Math.round(journey.progress * 100) + '%' }}</b>
          </div>
          <div class="ui-progress"><i :style="{ width: journey.progress * 100 + '%' }" /></div>
          <div class="j-line ui-muted">
            <span>Прибытие: {{ fmtDateTime(item.journey.endAt) }}</span>
            <span v-if="!journey.waiting">ещё {{ fmtDuration(item.journey.endAt - store.now) }}</span>
          </div>
          <div v-if="item.journey.label" class="ui-muted">{{ item.journey.label }}</div>
          <button class="ui-btn small" @click="replay"><Icon name="play" :size="16" /> Показать маршрут</button>
        </template>
        <div v-else class="ui-muted">Отряд стоит на месте.</div>
      </div>

      <!-- государство: города -->
      <div v-if="type === 'states'" class="state-cities">
        <div v-if="capital" class="link-row" @click="select('cities', capital.id)"><Icon name="crown" :size="16" /> Столица: {{ capital.name }}</div>
        <div class="ui-muted small">Известных поселений: {{ stateCities.length }}</div>
        <div class="city-list">
          <button v-for="c in stateCities.slice(0, 14)" :key="c.id" class="ui-chip city-chip" @click="select('cities', c.id)">{{ c.name }}</button>
        </div>
      </div>

      <div v-if="type === 'anomalies' && (item.activeFrom || item.activeTo)" class="ui-muted small times">
        <div v-if="item.activeFrom">Появляется: {{ fmtDateTime(item.activeFrom) }}</div>
        <div v-if="item.activeTo">Исчезает: {{ fmtDateTime(item.activeTo) }}</div>
        <div v-if="item.toX != null">Движется по карте</div>
      </div>

      <p v-if="item.description && !master" class="ui-desc">{{ item.description }}</p>
      <p v-else-if="!master" class="ui-muted">Описания пока нет.</p>

      <!-- ======= Редактор мастера ======= -->
      <form v-if="master && form" class="editor" @submit.prevent="save">
        <hr class="ui-divider" />
        <div class="ui-kicker editor-title"><Icon name="edit" :size="14" /> Редактирование</div>

        <label class="ui-field"><span>Название</span><input v-model="form.name" class="ui-input" maxlength="80" /></label>

        <template v-if="type === 'cities'">
          <div class="ui-row">
            <label class="ui-field"><span>Тип</span>
              <select v-model="form.type" class="ui-input"><option v-for="(t, k) in CITY_TYPES" :key="k" :value="k">{{ t.label }}</option></select>
            </label>
            <label class="ui-field"><span>Население</span><input v-model.number="form.population" type="number" min="0" class="ui-input" /></label>
          </div>
          <label class="ui-field"><span>Государство</span>
            <select v-model="form.stateId" class="ui-input">
              <option :value="null">— нейтральные земли —</option>
              <option v-for="s in store.data.states" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
          </label>
          <label class="ui-check"><input v-model="form.port" type="checkbox" /> Порт</label>
        </template>

        <template v-if="type === 'states'">
          <label class="ui-field"><span>Цвет</span><input v-model="form.color" type="color" class="ui-input" /></label>
          <div class="ui-muted small">Цвет здесь — для подсветки и легенды; раскраска самой карты берётся из FMG.</div>
        </template>

        <template v-if="type === 'roads'">
          <label class="ui-field"><span>Тип</span>
            <select v-model="form.type" class="ui-input"><option v-for="(t, k) in ROAD_TYPES" :key="k" :value="k">{{ t.label }}</option></select>
          </label>
          <div class="hint"><Icon name="help" :size="14" /> Тяни жёлтые точки на карте, чтобы изменить трассу.</div>
        </template>

        <template v-if="type === 'anomalies'">
          <div class="ui-row">
            <label class="ui-field"><span>Вид</span>
              <select v-model="form.kind" class="ui-input" @change="form.effect = form.kind === 'zone' ? 'storm' : 'portal'">
                <option value="zone">Зона</option><option value="point">Точка</option>
              </select>
            </label>
            <label class="ui-field"><span>Эффект</span>
              <select v-model="form.effect" class="ui-input">
                <option v-for="(e, k) in (form.kind === 'zone' ? ZONE_EFFECTS : POINT_EFFECTS)" :key="k" :value="k">{{ e.label }}</option>
              </select>
            </label>
          </div>
          <label v-if="form.kind === 'zone'" class="ui-field"><span>Радиус: {{ fmtKm(form.radius) }}</span>
            <input v-model.number="form.radius" type="range" min="4" max="250" />
          </label>
          <div class="ui-row">
            <label class="ui-field"><span>Появится</span><input v-model="form.activeFromStr" type="datetime-local" class="ui-input" /></label>
            <label class="ui-field"><span>Исчезнет</span><input v-model="form.activeToStr" type="datetime-local" class="ui-input" /></label>
          </div>
          <div class="ui-row move-row">
            <button type="button" class="ui-btn small" @click="pickTarget"><Icon name="arrow" :size="15" /> {{ item.toX != null ? 'Изменить' : 'Задать' }} движение</button>
            <button v-if="item.toX != null" type="button" class="ui-btn small" @click="clearMove">Убрать движение</button>
          </div>
          <div class="hint"><Icon name="help" :size="14" /> Движение идёт от точки «появится» к «исчезнет» — укажи обе даты.</div>
        </template>

        <template v-if="type === 'parties'">
          <div class="ui-field"><span>Цвет</span>
            <div class="swatches">
              <button v-for="c in PARTY_COLORS" :key="c" type="button" class="sw" :class="{ on: form.color === c }" :style="{ background: c }" @click="form.color = c" />
            </div>
          </div>
          <div class="ui-field"><span>Значок</span>
            <div class="swatches">
              <button v-for="ic in PARTY_ICONS" :key="ic" type="button" class="sw icon" :class="{ on: form.icon === ic }" @click="form.icon = ic"><Icon :name="ic" :size="18" /></button>
            </div>
          </div>
          <div class="ui-row move-row">
            <button v-if="!item.journey" type="button" class="ui-btn primary small" @click="planJourney"><Icon name="journey" :size="16" /> Отправить в путь</button>
            <template v-else>
              <button type="button" class="ui-btn small" @click="planJourney"><Icon name="journey" :size="16" /> Новый маршрут</button>
              <button type="button" class="ui-btn danger small" @click="stopJourney"><Icon name="stop" :size="16" /> Остановить</button>
            </template>
          </div>
        </template>

        <label class="ui-field"><span>Описание (видят все)</span><textarea v-model="form.description" class="ui-input" rows="4" /></label>
        <label class="ui-field"><span><Icon name="lock" :size="12" /> Заметки мастера (игроки не видят)</span><textarea v-model="form.secret" class="ui-input" rows="3" /></label>
        <label class="ui-check"><input v-model="form.hidden" type="checkbox" /> Скрыть от игроков</label>

        <div class="editor-actions">
          <button type="submit" class="ui-btn primary" :disabled="saving"><Icon name="check" :size="16" /> Сохранить</button>
          <button v-if="type !== 'states'" type="button" class="ui-btn danger" @click="remove"><Icon name="delete" :size="16" /> Удалить</button>
        </div>
        <div v-if="['cities', 'anomalies', 'parties'].includes(type)" class="hint"><Icon name="help" :size="14" /> Объект можно перетащить мышью прямо на карте.</div>
      </form>
    </div>
  </aside>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import Icon from './Icon.vue'
import { store, isMaster, act, findSelected, fmtKm, fmtDuration, fmtDateTime, km, toast } from './store.js'
import { CITY_TYPES, ROAD_TYPES, ZONE_EFFECTS, POINT_EFFECTS, PARTY_ICONS, PARTY_COLORS } from '../shared/catalog.js'
import { polyLength, journeyState, anomalyState } from '../shared/geo.js'

const master = isMaster
const item = computed(() => findSelected())
const type = computed(() => store.selection?.type)
const select = (t, id) => { store.selection = { type: t, id } }

const KIND = { cities: 'Поселение', states: 'Народ / государство', roads: 'Дорога', anomalies: 'Аномалия', parties: 'Отряд' }
const kindLabel = computed(() => {
  const it = item.value
  if (type.value === 'cities') return CITY_TYPES[it.type]?.label || 'Поселение'
  if (type.value === 'roads') return ROAD_TYPES[it.type]?.label || 'Дорога'
  if (type.value === 'anomalies') return (it.kind === 'zone' ? ZONE_EFFECTS : POINT_EFFECTS)[it.effect]?.label || 'Аномалия'
  return KIND[type.value]
})
const headIcon = computed(() => {
  const it = item.value
  if (type.value === 'cities') return CITY_TYPES[it.type]?.icon || 'home'
  if (type.value === 'states') return 'states'
  if (type.value === 'roads') return 'roadType'
  if (type.value === 'anomalies') return it.kind === 'zone' ? 'zone' : POINT_EFFECTS[it.effect]?.icon || 'anomaly'
  if (type.value === 'parties') return it.icon || 'sword'
  return 'map'
})
const accent = computed(() => {
  const it = item.value
  if (type.value === 'states' || type.value === 'parties') return it.color
  if (type.value === 'anomalies') return ((it.kind === 'zone' ? ZONE_EFFECTS : POINT_EFFECTS)[it.effect] || {}).color
  return 'var(--gold)'
})

const state = computed(() => (type.value === 'cities' && item.value.stateId ? store.data.states.find(s => s.id === item.value.stateId) : null))
const stateCities = computed(() => (type.value === 'states' ? store.data.cities.filter(c => c.stateId === item.value.id) : []))
const capital = computed(() => (type.value === 'states' ? store.data.cities.find(c => c.id === item.value.capitalId) : null))
const roadLen = computed(() => (type.value === 'roads' ? polyLength(item.value.points) : 0))
const journey = computed(() => (type.value === 'parties' ? journeyState(item.value.journey, store.now) : null))
const anomaly = computed(() => (type.value === 'anomalies' ? anomalyState(item.value, store.now) : {}))
const anomalyStatus = computed(() => (anomaly.value.upcoming ? 'Ещё не проявилась' : anomaly.value.expired ? 'Угасла' : 'Активна'))

function gameDays(px) {
  const d = km(px) / (store.data.settings.paceKmPerDay || 38)
  return d < 1 ? `${Math.max(1, Math.round(d * 24))} ч` : `${d.toFixed(1)} дн.`
}

/* ---------------- Форма ---------------- */
const form = ref(null)
const saving = ref(false)
const toLocal = ms => {
  if (ms == null) return ''
  const d = new Date(ms)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
const fromLocal = s => (s ? new Date(s).getTime() : null)

const FIELDS = {
  cities: ['name', 'type', 'population', 'stateId', 'port', 'description', 'secret', 'hidden'],
  states: ['name', 'color', 'description', 'secret', 'hidden'],
  roads: ['name', 'type', 'description', 'hidden'],
  anomalies: ['name', 'kind', 'effect', 'radius', 'description', 'secret', 'hidden'],
  parties: ['name', 'color', 'icon', 'description', 'secret', 'hidden']
}

function resetForm() {
  const it = item.value
  if (!it || !master.value) { form.value = null; return }
  const f = {}
  for (const k of FIELDS[type.value]) f[k] = it[k] ?? (k === 'secret' || k === 'description' ? '' : it[k])
  if (type.value === 'anomalies') {
    f.activeFromStr = toLocal(it.activeFrom)
    f.activeToStr = toLocal(it.activeTo)
  }
  form.value = f
}
watch(() => [store.selection?.type, store.selection?.id, master.value], resetForm, { immediate: true })

async function save() {
  const body = {}
  for (const k of FIELDS[type.value]) body[k] = form.value[k]
  if (type.value === 'anomalies') {
    body.activeFrom = fromLocal(form.value.activeFromStr)
    body.activeTo = fromLocal(form.value.activeToStr)
    if (body.activeFrom && body.activeTo && body.activeTo <= body.activeFrom) return toast('«Исчезнет» должно быть позже «появится»', 'error')
  }
  saving.value = true
  try {
    await act('PATCH', `/api/${type.value}/${item.value.id}`, body, 'Сохранено')
  } catch { /* тост */ } finally {
    saving.value = false
  }
}

async function remove() {
  if (!confirm(`Удалить «${item.value.name || 'объект'}»? Это нельзя отменить.`)) return
  const { type: t, id } = store.selection
  await act('DELETE', `/api/${t}/${id}`, undefined, 'Удалено').catch(() => {})
  store.selection = null
}

function pickTarget() {
  store.pick = { purpose: 'anomalyTarget', id: item.value.id }
  toast('Кликни на карте, куда движется аномалия')
}
const clearMove = () => act('PATCH', `/api/anomalies/${item.value.id}`, { toX: null, toY: null }, 'Движение убрано').catch(() => {})

function planJourney() {
  store.tool = 'select'
  store.journeyPlan = { partyId: item.value.id, waypoints: [], byRoad: true }
}
const stopJourney = () => act('POST', `/api/parties/${item.value.id}/stop`, {}, 'Отряд остановлен').catch(() => {})

function replay() {
  const j = item.value.journey
  store.replay = { path: j.path, t0: Date.now(), duration: Math.min(9000, 2500 + j.path.length * 120), color: item.value.color }
}
</script>

<style scoped>
.info { position: absolute; top: 76px; right: 16px; bottom: 16px; width: 360px; display: flex; flex-direction: column; overflow: hidden; z-index: 20; }
.info-head { display: flex; align-items: center; gap: 12px; padding: 16px 14px 12px 16px; border-bottom: 1px solid var(--line-2); }
.info-badge { width: 42px; height: 42px; flex: none; border-radius: 12px; display: grid; place-items: center; background: rgba(255, 255, 255, 0.06); border: 1px solid currentColor; }
.info-titles { flex: 1; min-width: 0; }
.info-titles h2 { margin: 0; font-size: 25px; line-height: 1.1; overflow-wrap: anywhere; }
.info-body { padding: 14px 16px 18px; flex: 1; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
.chips:empty { display: none; }
.link-row { display: flex; align-items: center; gap: 8px; background: none; border: 0; color: var(--gold-2); font: 700 13.5px var(--sans); padding: 4px 0; cursor: pointer; margin-bottom: 6px; }
.link-row:hover { text-decoration: underline; }
.swatch { width: 12px; height: 12px; border-radius: 3px; display: inline-block; }
.small { font-size: 12.5px; }
.times { margin-bottom: 10px; display: grid; gap: 2px; }
.journey-box { display: grid; gap: 8px; padding: 12px; border-radius: 12px; background: rgba(255, 255, 255, 0.04); border: 1px solid var(--line-2); margin-bottom: 12px; }
.j-line { display: flex; justify-content: space-between; gap: 10px; font-size: 13px; }
.state-cities { margin-bottom: 12px; }
.city-list { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 8px; }
.city-chip { border: 0; cursor: pointer; }
.city-chip:hover { background: rgba(231, 197, 111, 0.2); }
.editor-title { display: flex; align-items: center; gap: 6px; margin-bottom: 12px; color: var(--gold); }
.editor-actions { display: flex; gap: 8px; margin-top: 4px; }
.editor-actions .primary { flex: 1; }
.hint { display: flex; gap: 6px; align-items: flex-start; font-size: 12px; color: var(--muted); margin: 6px 0 10px; }
.move-row { margin-bottom: 8px; flex-wrap: wrap; }
.move-row > * { flex: 0 1 auto; }
.swatches { display: flex; flex-wrap: wrap; gap: 6px; }
.sw { width: 28px; height: 28px; border-radius: 8px; border: 2px solid transparent; cursor: pointer; display: grid; place-items: center; background: rgba(255, 255, 255, 0.06); color: var(--text); }
.sw.on { border-color: #fff; box-shadow: 0 0 0 2px rgba(231, 197, 111, 0.5); }

@media (max-width: 760px) {
  .info { top: auto; left: 8px; right: 8px; bottom: 8px; width: auto; max-height: 58vh; }
}
</style>
