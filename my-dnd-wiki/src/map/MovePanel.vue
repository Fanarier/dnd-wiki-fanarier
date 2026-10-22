<template>
  <!-- движение метки (мастер): путь кликами или по дороге, время или скорость, стоянки, конец пути, пауза,
       что видят игроки. Правки сохраняются сразу; если метка уже в пути — остаётся на месте и идёт дальше по-новому -->
  <div class="mv" @keydown.enter.prevent>
    <div class="mv-h"><Icon name="arrow" :size="15" /> Движение</div>

    <template v-if="!m">
      <p class="hint">Метка стоит на месте. Проложи путь кликами по карте или выбери дорогу / морской маршрут — потом задай, за сколько она его пройдёт.</p>
      <div class="ui-row mv-btns">
        <button type="button" class="ui-btn small primary" @click="draw"><Icon name="road" :size="15" /> Проложить путь</button>
        <button type="button" class="ui-btn small" @click="byRoad"><Icon name="ship" :size="15" /> По дороге / маршруту</button>
      </div>
      <div v-if="a.toX != null" class="hint">Есть старое движение по прямой (между «появится» и «исчезнет»).
        <button type="button" class="ui-btn small" @click="clearMove(a)">Убрать его</button>
      </div>
    </template>

    <template v-else>
      <div class="mv-st" :class="st.state">
        <b>{{ STATE[st.state] }}</b>
        <span>{{ statusLine }}</span>
        <i class="mv-bar"><i :style="{ width: (progress * 100).toFixed(1) + '%' }" /></i>
      </div>
      <div class="ui-muted small">Путь: {{ fmtKm(len) }} · точек: {{ m.path.length }}{{ m.end === 'loop' ? ' · по кругу' : m.end === 'pingpong' ? ' · туда и обратно' : '' }}</div>

      <div class="mv-seg">
        <button type="button" :class="{ on: m.timing !== 'speed' }" @click="set({ timing: 'time' })">За время</button>
        <button type="button" :class="{ on: m.timing === 'speed' }" @click="set({ timing: 'speed', speed: m.speed || 80 })">По скорости</button>
      </div>
      <div v-if="m.timing !== 'speed'" class="ui-field">
        <span>{{ loops ? 'Один проход (со стоянками) займёт' : 'Дойдёт до конца за (реальное время, со стоянками)' }}</span>
        <div class="mv-dur">
          <label><input v-model.number="dur.d" type="number" min="0" class="ui-input" @change="setDur" /> д</label>
          <label><input v-model.number="dur.h" type="number" min="0" max="23" class="ui-input" @change="setDur" /> ч</label>
          <label><input v-model.number="dur.m" type="number" min="0" max="59" step="5" class="ui-input" @change="setDur" /> мин</label>
        </div>
      </div>
      <label v-else class="ui-field"><span>Скорость, км за игровой день · ход займёт {{ fmtDuration(m.moveMs) }}</span>
        <input :value="m.speed" type="number" min="1" class="ui-input" @change="set({ speed: Math.max(1, Number($event.target.value) || 1) })" />
      </label>
      <div v-if="waitsTooLong" class="mv-warn">Стоянки дольше всего времени — на сам ход остаётся минута. Увеличь время.</div>

      <label class="ui-field"><span>В конце пути</span>
        <select :value="m.end" class="ui-input" @change="set({ end: $event.target.value })"><option v-for="e in END_MODES" :key="e.v" :value="e.v">{{ e.t }}</option></select>
      </label>

      <div class="ui-field"><span>Стоянки (часов в точке пути)</span>
        <div v-for="s in stopList" :key="s.k" class="mv-stop">
          <b>⏸ {{ s.name }}</b>
          <input :value="hours(s.ms)" type="number" min="0" step="0.5" class="ui-input" @change="setStop(s.k, $event)" /> ч
          <button type="button" class="ui-btn icon ghost small" title="Убрать стоянку" @click="setStop(s.k, { target: { value: 0 } })">✕</button>
        </div>
        <button type="button" class="ui-btn small mv-add" @click="pickStop">＋ Стоянка — кликнуть на путь</button>
      </div>

      <label class="ui-check"><input :checked="m.smooth" type="checkbox" @change="set({ smooth: $event.target.checked })" /> Плавная кривая (а не ломаная)</label>
      <label v-if="a.kind === 'point'" class="ui-field"><span>Поворот по ходу</span>
        <select :value="m.face || 'none'" class="ui-input" @change="set({ face: $event.target.value })"><option v-for="f in FACE_MODES" :key="f.v" :value="f.v">{{ f.t }}</option></select>
      </label>
      <label class="ui-field"><span>Игроки видят</span>
        <select :value="m.show" class="ui-input" @change="set({ show: $event.target.value })"><option v-for="s in SHOW_MODES" :key="s.v" :value="s.v">{{ s.t }}</option></select>
      </label>

      <template v-if="m.startAt == null">
        <label class="ui-field"><span>Отправить позже (пусто — сразу)</span><input v-model="later" type="datetime-local" class="ui-input" /></label>
        <div class="ui-row mv-btns">
          <button type="button" class="ui-btn small primary" @click="startMove(a, later ? new Date(later).getTime() : null)">▶ Отправить</button>
        </div>
      </template>
      <div class="ui-row mv-btns">
        <template v-if="m.startAt != null">
          <button v-if="m.pausedAt == null && st.state !== 'arrived' && st.state !== 'gone'" type="button" class="ui-btn small" @click="pauseMove(a)">⏸ Пауза</button>
          <button v-if="m.pausedAt != null" type="button" class="ui-btn small primary" @click="resumeMove(a)">▶ Продолжить</button>
          <button type="button" class="ui-btn small" title="Вернуть в начало пути и отправить снова" @click="restartMove(a)">⟲ Заново</button>
        </template>
        <button type="button" class="ui-btn small" title="Новый путь от того места, где метка сейчас" @click="draw">✎ Новый путь</button>
        <button type="button" class="ui-btn small" @click="byRoad">По дороге</button>
        <button type="button" class="ui-btn small danger" @click="clearMove(a)">✕ Убрать движение</button>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import Icon from './Icon.vue'
import { store, toast, fmtKm, fmtDuration, fmtDateTime } from './store.js'
import { moveState, movePass } from '../shared/geo.js'
import { END_MODES, SHOW_MODES, FACE_MODES, saveMove, startMove, restartMove, pauseMove, resumeMove, clearMove, here, moveStatus, passMsOf } from './movement.js'

const props = defineProps({ a: { type: Object, required: true } })
const m = computed(() => props.a.move || null)
const st = computed(() => (m.value ? moveState(m.value, store.now) : {}))
const loops = computed(() => ['loop', 'pingpong'].includes(m.value?.end))
const len = computed(() => (m.value ? movePass(m.value).g.total : 0))
const later = ref('')
const STATE = { ready: 'Ждёт отправки', moving: 'В пути', waiting: 'Стоянка', paused: 'На паузе', arrived: 'Дошла', gone: 'Дошла и исчезла' }

const progress = computed(() => {
  const s = st.value
  if (!s.passMs) return 0
  if (s.state === 'arrived' || s.state === 'gone') return 1
  return Math.max(0, Math.min(1, 1 - (s.left ?? s.passMs) / s.passMs))
})
const statusLine = computed(() => {
  const s = st.value, mv = m.value
  if (s.state === 'ready' && mv.startAt == null) return `путь займёт ${fmtDuration(passMsOf(mv))}`
  if (s.state === 'arrived' || s.state === 'gone') return fmtDateTime(s.arrivedAt)
  if (s.state === 'paused') return `осталось ${fmtDuration(s.left)}`
  const end = loops.value ? '' : ` · ${fmtDateTime(store.now + s.left)}`
  return moveStatus(props.a, store.now, fmtDuration) + end + (s.back ? ' · обратно' : '') + (mv.end === 'loop' && s.lap ? ` · круг ${s.lap + 1}` : '')
})

const set = patch => saveMove(props.a, patch)

// «дойдёт за»: дни, часы, минуты — набираются в поля, уходят на сервер, когда набрано хотя бы минута
const dur = reactive({ d: 0, h: 0, m: 0 })
watch(() => m.value?.total, t => {
  const mm = Math.round((t || 0) / 60000)
  Object.assign(dur, { d: Math.floor(mm / 1440), h: Math.floor((mm % 1440) / 60), m: mm % 60 })
}, { immediate: true })
function setDur() {
  const total = (((Number(dur.d) || 0) * 24 + (Number(dur.h) || 0)) * 60 + (Number(dur.m) || 0)) * 60000
  if (total >= 60000 && total !== m.value?.total) set({ total })
}
const waitsTooLong = computed(() => m.value?.timing !== 'speed' && movePass({ ...m.value, moveMs: 1000 }).waits.reduce((s, w) => s + w, 0) >= (m.value?.total || 0))

// стоянки: какие точки пути, и как их назвать (старт, конец, по порядку)
const stopList = computed(() => {
  const n = m.value.path.length
  const list = []
  ;(m.value.stops || []).forEach((ms, k) => { if (ms > 0 && k < n) list.push({ k, ms }) })
  return list.map((s, i) => ({ ...s, name: s.k === 0 ? 'старт' : s.k === n - 1 && m.value.end !== 'loop' ? 'конец пути' : `стоянка ${i + 1}` }))
})
function pickStop() {
  store.draft = null
  store.pick = { purpose: 'moveStop', id: props.a.id }
  toast('Кликни на путь метки — там будет стоянка')
}
const hours = ms => (ms ? Math.round((ms / 3600000) * 100) / 100 : '')
function setStop(k, e) {
  const stops = Array.from({ length: m.value.path.length }, (_, i) => m.value.stops?.[i] || 0)
  stops[k] = Math.max(0, Number(e.target.value) || 0) * 3600000
  set({ stops })
}

// путь кликами: первая точка — где метка сейчас
function draw() {
  store.pick = null
  store.tool = 'select'
  store.draft = { kind: 'move', id: props.a.id, points: [here(props.a)] }
  toast('Кликай точки пути. Двойной клик или Enter — готово, Backspace — шаг назад, Esc — отмена')
}
function byRoad() {
  store.draft = null
  store.pick = { purpose: 'moveRoad', id: props.a.id }
  toast('Кликни по дороге или морскому маршруту')
}
</script>

<style scoped>
.mv { margin: 6px 0 10px; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--line-2); background: rgba(255, 255, 255, .03); display: grid; gap: 6px; }
.mv-h { display: flex; align-items: center; gap: 6px; color: var(--gold-2); font: 800 12px var(--sans); letter-spacing: .08em; text-transform: uppercase; }
.hint { font-size: 12px; color: var(--muted); margin: 0; }
.mv-btns { flex-wrap: wrap; gap: 6px; }
.mv-btns > * { flex: 0 1 auto; }
.mv-st { display: grid; gap: 3px; padding: 8px 10px; border-radius: 10px; background: rgba(0, 0, 0, .25); border-left: 3px solid var(--gold-2); font-size: 12.5px; }
.mv-st b { font-size: 13px; }
.mv-st.waiting { border-color: #6fa8ff; }
.mv-st.paused { border-color: #a8936c; }
.mv-st.arrived, .mv-st.gone { border-color: #7ed07a; }
.mv-st.ready { border-color: #8f8574; }
.mv-bar { display: block; height: 4px; border-radius: 4px; background: rgba(255, 255, 255, .1); overflow: hidden; }
.mv-bar i { display: block; height: 100%; background: linear-gradient(90deg, var(--gold), var(--gold-2)); transition: width 1s linear; }
.mv-seg { display: inline-flex; border: 1px solid var(--line-2); border-radius: 9px; overflow: hidden; justify-self: start; }
.mv-seg button { padding: 5px 12px; border: 0; background: none; color: var(--muted); font: 700 12px var(--sans); cursor: pointer; }
.mv-seg button.on { background: rgba(231, 197, 111, .18); color: var(--gold-2); }
.mv-dur { display: flex; gap: 6px; }
.mv-dur label { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--muted); }
.mv-dur input { width: 62px; }
.mv-stop { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); margin-bottom: 4px; }
.mv-stop b { flex: 1; color: #9fc6ff; font-weight: 700; }
.mv-stop input { width: 70px; padding: 4px 6px; }
.mv-add { justify-self: start; }
.mv-warn { font-size: 12px; color: #ff8f7f; }
</style>
