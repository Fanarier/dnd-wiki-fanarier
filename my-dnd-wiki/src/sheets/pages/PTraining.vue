<template>
  <!-- тренировки и обучение: в процессе (с полосками и «+ очки»), запланированные, свёрнутый архив завершённых -->
  <div class="ptr">
    <h2 class="sb-h sb-anim"><SheetIcon name="train" class="ic" />Тренировки и обучение</h2>
    <div class="sb-tools sb-anim">
      <span class="ptr-sum">
        <b :style="{ color: TRAIN_STATUS.active.color }">{{ groups.active.length }}</b> в процессе ·
        <b :style="{ color: TRAIN_STATUS.planned.color }">{{ groups.planned.length }}</b> в планах ·
        <b :style="{ color: TRAIN_STATUS.done.color }">{{ groups.done.length }}</b> завершено
      </span>
      <span class="grow" />
      <button v-if="!ro" type="button" class="sb-btn primary" @click="picker = !picker">＋ Тренировка</button>
    </div>

    <!-- шаблоны: тип → что именно; этап и нужные очки подставляются сами -->
    <div v-if="picker && !ro" class="ptr-pick sb-anim">
      <div class="ptr-kinds">
        <button v-for="t in TRAIN_TEMPLATES" :key="t.k" type="button" class="sb-chip" :class="{ on: tpl?.k === t.k }" @click="pickKind(t)">{{ t.name }}</button>
        <button type="button" class="sb-chip" @click="addBlank">Своя</button>
      </div>
      <div v-if="tpl?.items" class="ptr-items">
        <button v-for="it in tpl.items" :key="it" type="button" class="ptr-item" @click="addFrom(tpl, it)">{{ it }}<small>{{ hintFor(tpl, it) }}</small></button>
      </div>
      <p class="ptr-hint">Этап и сколько очков нужно — подставятся по прошлым тренировкам, их всегда можно поправить.</p>
    </div>

    <div v-if="!list.length" class="sb-empty sb-anim">Тренировок пока нет. Добавь первую — шаблоны помогут.</div>

    <template v-for="g in SHOWN" :key="g">
      <h3 v-if="groups[g].length" class="sb-h2 sb-anim ptr-gh" :style="{ '--st': TRAIN_STATUS[g].color }"><i />{{ TRAIN_STATUS[g].name }} <small>{{ groups[g].length }}</small></h3>
      <VueDraggable :model-value="groups[g]" handle=".sb-handle" :animation="200" :disabled="ro" class="ptr-list" @update:model-value="reorder(g, $event)">
        <article v-for="t in groups[g]" :key="t.Id || keyOf(t)" class="ptr-card sb-anim" :class="[g, { flash: flashed === t.Id }]" :data-train="t.Id" :data-find="`Trainings-${idx(t)}`" :style="{ '--st': TRAIN_STATUS[g].color }">
          <header>
            <span v-if="!ro" class="sb-handle">⠿</span>
            <Fld :path="`Trainings.${idx(t)}.Name`" placeholder="Что тренируем" class="ptr-name" />
            <label class="ptr-stage" title="Этап или уровень владения (№ в таблице)">
              <input :value="t.Stage" :readonly="ro" list="ptr-stages" placeholder="№" maxlength="40" @change="set(t, 'Stage', $event.target.value.trim())" />
            </label>
            <select class="ptr-st" :value="t.Status" :disabled="ro" :title="t.Status ? 'Статус задан вручную' : 'Статус сам: дошёл до конца — завершено'" @change="set(t, 'Status', $event.target.value)">
              <option value="">◐ сам</option>
              <option value="active">● в процессе</option>
              <option value="planned">◇ в планах</option>
              <option value="done">✓ завершено</option>
            </select>
            <button v-if="!ro" type="button" class="sb-x" title="Удалить" @click="del(t)">✕</button>
          </header>
          <div class="ptr-prog">
            <span class="ptr-nums">
              <Fld :path="`Trainings.${idx(t)}.Cur`" type="num" center class="ptr-n" />
              <i>/</i>
              <Fld :path="`Trainings.${idx(t)}.Max`" type="num" center class="ptr-n" />
            </span>
            <div class="ptr-bar" :title="t.Max ? `${Math.round(pct(t))}% · осталось ${Math.max(0, t.Max - t.Cur)}` : 'Сколько нужно — не указано'">
              <i :style="{ width: pct(t) + '%' }" />
              <b v-if="t.Max && t.Cur < t.Max">ещё {{ t.Max - t.Cur }}</b>
            </div>
            <form v-if="!ro && g !== 'done'" class="ptr-add" @submit.prevent="addPts(t, $event)">
              <input name="pts" type="number" inputmode="numeric" placeholder="+" min="-99999" max="99999" title="Сколько очков добавить (Enter)" />
              <button type="submit" class="sb-btn" title="Добавить очки">+</button>
            </form>
          </div>
          <!-- примечания (из комментариев таблицы): какая черта, какое оружие, до какого уровня -->
          <div v-if="open.has(t.Id)" class="ptr-notes">
            <Fld :path="`Trainings.${idx(t)}.Note`" type="area" :rows="1" :max="4000" placeholder="Примечание: какая черта, оружие, школа…" />
            <Fld :path="`Trainings.${idx(t)}.ProgNote`" type="area" :rows="1" :max="8000" placeholder="К прогрессу: «до экспертного владения», журнал бросков…" />
            <button type="button" class="ptr-note" @click="toggleOpen(t)">свернуть</button>
          </div>
          <button v-else-if="t.Note || t.ProgNote || !ro" type="button" class="ptr-note" :class="{ clamp: t.Note || t.ProgNote }" :title="[t.Note, t.ProgNote].filter(Boolean).join(' · ')" @click="toggleOpen(t)">
            <template v-if="t.Note || t.ProgNote">{{ [t.Note, t.ProgNote].filter(Boolean).join(' · ') }}</template>
            <template v-else>＋ примечание</template>
          </button>
        </article>
      </VueDraggable>
    </template>

    <!-- завершённые: архив, свёрнут -->
    <details v-if="groups.done.length" class="ptr-done sb-anim" :open="doneOpen" @toggle="doneOpen = $event.target.open">
      <summary :style="{ '--st': TRAIN_STATUS.done.color }"><i />{{ TRAIN_STATUS.done.name }} <small>{{ groups.done.length }}</small></summary>
      <div class="ptr-rows">
        <div v-for="t in groups.done" :key="t.Id || keyOf(t)" class="ptr-row" :data-find="`Trainings-${idx(t)}`" :title="[t.Note, t.ProgNote].filter(Boolean).join(' · ')">
          <span class="ptr-rn">{{ t.Name }}<small v-if="t.Note"> · {{ t.Note }}</small></span>
          <span class="ptr-rs">{{ t.Stage }}</span>
          <span class="ptr-rp">{{ t.Cur }}/{{ t.Max }}</span>
          <select v-if="!ro" class="ptr-st sm" :value="t.Status" title="Статус" @change="set(t, 'Status', $event.target.value)">
            <option value="">◐ сам</option>
            <option value="active">● в процессе</option>
            <option value="planned">◇ в планах</option>
            <option value="done">✓ завершено</option>
          </select>
          <button v-if="!ro" type="button" class="sb-x" title="Удалить" @click="del(t)">✕</button>
        </div>
      </div>
    </details>

    <datalist id="ptr-stages"><option v-for="s in STAGE_LIST" :key="s" :value="s" /></datalist>
  </div>
</template>

<script setup>
import { computed, inject, nextTick, reactive, ref } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import SheetIcon from '../ui/SheetIcon.vue'
import Fld from '../ui/Fld.vue'
import { sheet, edit, keyOf, listOps } from '../sheetState.js'
import { TRAIN_STATUS, TRAIN_STAGES, TRAIN_TEMPLATES, trainStatus } from '../../shared/sheet.js'
import { sfx } from '../../sound/sound.js'

const ro = inject('sheetReadOnly', ref(false))
const list = computed(() => sheet.data.Trainings || [])
const ops = listOps('Trainings')
const SHOWN = ['active', 'planned']
const STAGE_LIST = [...TRAIN_STAGES, '1', '2', '3', '4', '5']
// только что завершённая ещё пару секунд остаётся среди текущих — чтобы была видна вспышка
const holding = reactive(new Set())
const groups = computed(() => {
  const g = { active: [], planned: [], done: [] }
  for (const t of list.value) g[holding.has(t.Id) ? 'active' : trainStatus(t)].push(t)
  return g
})
const idx = t => list.value.indexOf(t)
const pct = t => (t.Max > 0 ? Math.min(100, (t.Cur / t.Max) * 100) : 0)
const set = (t, k, v) => { const i = idx(t); if (i >= 0 && !ro.value) edit(`Trainings.${i}.${k}`, v, { now: true }) }
const open = reactive(new Set())
const toggleOpen = t => { if (!ro.value) open.has(t.Id) ? open.delete(t.Id) : open.add(t.Id) }
const doneOpen = ref(false)

// перетащили внутри группы: остальные остаются на своих местах, эта группа занимает свои же места в новом порядке
function reorder(g, items) {
  const slots = list.value.map((t, i) => (trainStatus(t) === g ? i : -1)).filter(i => i >= 0)
  const next = list.value.slice()
  slots.forEach((slot, k) => { next[slot] = items[k] })
  ops.set(next)
}

// очки за тренировку: полоска растёт, на последнем очке — вспышка и звук
const flashed = ref('')
function addPts(t, e) {
  const inp = e.target.elements.pts
  const n = Math.round(Number(inp.value))
  inp.value = ''
  if (!n) return
  const cur = Math.max(0, t.Cur + n)
  const wasDone = trainStatus(t) === 'done'
  set(t, 'Cur', cur)
  // «в планах», а очки пошли — значит уже в процессе
  if (t.Status === 'planned') set(t, 'Status', '')
  if (!wasDone && t.Max > 0 && cur >= t.Max) {
    const id = t.Id
    flashed.value = id
    holding.add(id)
    sfx('crit', 0.45)
    setTimeout(() => { if (flashed.value === id) flashed.value = ''; holding.delete(id) }, 1800)
  } else sfx('coins', 0.12)
}
function del(t) {
  const i = idx(t)
  if (i >= 0 && confirm(`Удалить тренировку «${t.Name}»?`)) ops.remove(i)
}

/* ---------- новые: шаблоны ---------- */
const picker = ref(false)
const tpl = ref(null)
const newId = () => 't' + Math.random().toString(36).slice(2, 12)
const base = n => String(n || '').replace(/\s*\(?\d+\)?\s*$/, '').trim().toLowerCase()
// сколько раз уже тренировали это (Сила, Сила 2, «Сила (3)» — одно и то же)
const timesDone = name => list.value.filter(t => base(t.Name) === base(name)).length
function plan(tp, item) {
  if (tp.num) {
    const n = timesDone(item) + 1
    return { Name: item, Stage: String(n), Max: tp.max[Math.min(n, tp.max.length) - 1] }
  }
  if (tp.suffix) {
    const lv = Math.min(list.value.filter(t => t.Name.startsWith(item)).length, tp.suffix.length - 1)
    return { Name: item + tp.suffix[lv], Stage: tp.stage[lv], Max: tp.max[lv] }
  }
  return { Name: (tp.prefix || '') + item, Stage: tp.stage || '', Max: tp.max[0] }
}
const hintFor = (tp, it) => { const p = plan(tp, it); return [p.Stage && (tp.num ? `этап ${p.Stage}` : p.Stage), p.Max].filter(Boolean).join(' · ') }
function pickKind(t) {
  if (t.items) { tpl.value = tpl.value?.k === t.k ? null : t; return }
  add({ Name: t.prefix || t.name, Stage: t.stage || '', Max: t.max[0] }, true)
}
const addFrom = (tp, item) => add(plan(tp, item), false)
const addBlank = () => add({ Name: '', Stage: '', Max: 0 }, true)
function add(p, focus) {
  const t = { Id: newId(), Name: p.Name, Note: '', Cur: 0, Max: p.Max || 0, Stage: p.Stage || '', ProgNote: '', Status: '' }
  ops.add(t)
  picker.value = false
  tpl.value = null
  sfx('pageFlip', 0.2)
  if (focus) nextTick(() => {
    const inp = document.querySelector(`[data-train="${t.Id}"] .ptr-name input`)
    if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length) }
  })
}
</script>

<style scoped>
.ptr { display: grid; gap: 4px; }
.ptr-sum { color: var(--muted); font: 700 12.5px 'Manrope', sans-serif; }
.ptr-sum b { font-weight: 900; }
.ptr-pick { display: grid; gap: 8px; padding: 10px; margin-bottom: 8px; border-radius: 12px; background: rgba(0, 0, 0, .22); border: 1px dashed color-mix(in srgb, var(--acc) 40%, transparent); }
.ptr-kinds, .ptr-items { display: flex; flex-wrap: wrap; gap: 5px; }
.ptr-item { display: grid; padding: 5px 10px; border-radius: 9px; border: 1px solid var(--line); background: color-mix(in srgb, var(--acc) 6%, transparent); color: var(--ink); font: 700 12.5px 'Manrope', sans-serif; text-align: left; cursor: pointer; }
.ptr-item:hover { border-color: var(--acc); }
.ptr-item small { color: var(--muted); font-size: 10.5px; font-weight: 700; }
.ptr-hint { margin: 0; color: var(--muted); font: 600 11.5px 'Manrope', sans-serif; }

.ptr-gh { display: flex; align-items: center; gap: 7px; }
.ptr-gh i, .ptr-done summary i { width: 8px; height: 8px; border-radius: 50%; background: var(--st); box-shadow: 0 0 8px var(--st); }
.ptr-gh small, .ptr-done summary small { color: var(--ink); opacity: .7; }
.ptr-list { display: grid; gap: 8px; }
.ptr-card { position: relative; display: grid; gap: 6px; padding: 8px 10px 8px 12px; border-radius: 12px; background: rgba(0, 0, 0, .18); border: 1px solid var(--line); overflow: hidden; }
/* полоска статуса слева */
.ptr-card::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--st); opacity: .8; }
.ptr-card.planned { opacity: .82; border-style: dashed; }
.ptr-card header { display: flex; align-items: center; gap: 6px; min-width: 0; }
.ptr-name { flex: 1; min-width: 0; }
.ptr-name :deep(input) { font: 700 16px 'Cormorant Garamond', serif; }
.ptr-stage input { width: 82px; box-sizing: border-box; padding: 3px 8px; border-radius: 99px; border: 1px solid color-mix(in srgb, var(--st) 50%, transparent); background: color-mix(in srgb, var(--st) 12%, transparent); color: var(--ink); font: 800 11.5px 'Manrope', sans-serif; text-align: center; }
.ptr-stage input:focus { outline: none; border-color: var(--acc); }
.ptr-st { max-width: 108px; padding: 3px 4px; border-radius: 8px; border: 1px solid var(--line); background: rgba(0, 0, 0, .25); color: var(--muted); font: 700 11.5px 'Manrope', sans-serif; cursor: pointer; }
.ptr-st.sm { max-width: 96px; }
.ptr-prog { display: flex; align-items: center; gap: 8px; min-width: 0; }
.ptr-nums { display: flex; align-items: center; gap: 2px; flex: none; }
.ptr-nums i { color: var(--muted); font-style: normal; }
.ptr-n { width: 54px; }
.ptr-n :deep(input) { font: 800 14px 'Manrope', sans-serif; padding: 2px 0; }
.ptr-bar { position: relative; flex: 1; min-width: 50px; height: 12px; border-radius: 99px; background: rgba(0, 0, 0, .4); box-shadow: inset 0 1px 3px rgba(0, 0, 0, .6); overflow: hidden; }
.ptr-bar i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: inherit; background: linear-gradient(180deg, color-mix(in srgb, var(--st) 70%, #fff), var(--st) 60%, color-mix(in srgb, var(--st) 70%, #000)); box-shadow: 0 0 10px color-mix(in srgb, var(--st) 60%, transparent); transition: width .7s cubic-bezier(.2, 1, .3, 1); }
/* блик бежит по полоске */
.ptr-bar i::after { content: ''; position: absolute; inset: 0; background: linear-gradient(100deg, transparent 30%, rgba(255, 255, 255, .45) 50%, transparent 70%) -100% 0 / 200% 100% no-repeat; animation: ptr-sheen 3.2s ease-in-out infinite; }
@keyframes ptr-sheen { 60%, 100% { background-position: 200% 0; } }
.ptr-bar b { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); font: 800 9.5px 'Manrope', sans-serif; color: rgba(255, 245, 220, .8); text-shadow: 0 1px 2px #000; pointer-events: none; }
.ptr-add { display: flex; gap: 3px; flex: none; }
.ptr-add input { width: 52px; box-sizing: border-box; padding: 4px 6px; border-radius: 8px; border: 1px solid var(--line); background: rgba(0, 0, 0, .3); color: var(--ink); font: 800 13px 'Manrope', sans-serif; text-align: center; -moz-appearance: textfield; }
.ptr-add input::-webkit-inner-spin-button { display: none; }
.ptr-add input:focus { outline: none; border-color: var(--acc); }
.ptr-add .sb-btn { padding: 4px 10px; }
.ptr-note { justify-self: start; max-width: 100%; padding: 0 2px; border: 0; background: none; color: var(--muted); font: italic 600 12px 'Manrope', sans-serif; text-align: left; cursor: pointer; overflow-wrap: anywhere; }
.ptr-note:hover { color: var(--ink); }
/* длинный журнал бросков из таблицы — две строки, целиком при наведении или в правке */
.ptr-note.clamp { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.ptr-notes { display: grid; gap: 4px; }
.ptr-notes :deep(input) { font-size: 12.5px; }
/* дошли до конца: вспышка и золотые искры */
.ptr-card.flash { animation: ptr-flash 1.4s ease-out; }
.ptr-card.flash::after { content: ''; position: absolute; inset: 0; pointer-events: none; background: radial-gradient(circle at 70% 70%, rgba(255, 236, 170, .55), transparent 60%); animation: ptr-glow 1.4s ease-out forwards; }
@keyframes ptr-flash { 15% { box-shadow: 0 0 0 2px #ffd166, 0 0 30px rgba(255, 209, 102, .7); transform: scale(1.015); } }
@keyframes ptr-glow { from { opacity: 1; } to { opacity: 0; } }

.ptr-done { margin-top: 10px; border-radius: 12px; border: 1px solid var(--line); background: rgba(0, 0, 0, .12); }
.ptr-done summary { display: flex; align-items: center; gap: 7px; padding: 8px 12px; cursor: pointer; font: 800 11px 'Manrope', sans-serif; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); list-style: none; }
.ptr-done summary::-webkit-details-marker { display: none; }
.ptr-done summary::after { content: '▸'; margin-left: auto; transition: transform .2s; }
.ptr-done[open] summary::after { transform: rotate(90deg); }
.ptr-rows { display: grid; padding: 0 8px 8px; }
.ptr-row { display: flex; align-items: center; gap: 8px; padding: 5px 4px; border-top: 1px solid color-mix(in srgb, var(--acc) 10%, transparent); font: 600 13px 'Manrope', sans-serif; }
.ptr-rn { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ptr-rn small { color: var(--muted); }
.ptr-rs { color: #7ccf8b; font-weight: 800; font-size: 11.5px; }
.ptr-rp { color: var(--muted); font-variant-numeric: tabular-nums; font-size: 12px; }
/* телефон: название — во всю строку, под ним этап и статус; полоска — отдельной строкой во всю ширину */
@media (max-width: 640px) {
  .ptr-card header { flex-wrap: wrap; row-gap: 4px; }
  .ptr-name { flex: 1 1 calc(100% - 60px); }
  .ptr-card header .sb-x { order: 1; }
  .ptr-stage { order: 2; }
  .ptr-st { order: 3; }
  .ptr-stage input { width: 96px; }
  .ptr-prog { flex-wrap: wrap; row-gap: 6px; }
  .ptr-add { order: 1; margin-left: auto; }
  .ptr-bar { order: 2; flex-basis: 100%; }
  .ptr-n { width: 50px; }
  .ptr-row .ptr-st { display: none; }
}
@media (prefers-reduced-motion: reduce) { .ptr-bar i::after, .ptr-card.flash, .ptr-card.flash::after { animation: none; } }
</style>
