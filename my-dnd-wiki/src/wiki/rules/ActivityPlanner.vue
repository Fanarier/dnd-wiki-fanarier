<template>
  <!-- планировщик сессии: время между сессиями по дням (336 ч = 14 дней). Деятельности — карточки, их можно
       перетаскивать между днями; сон по настройке героя отложен в каждом дне. Черновики отправляются мастеру разом -->
  <div class="pl">
    <div class="pl-tools">
      <label class="pl-f">Сессия
        <select class="pl-in" :value="date" @change="$emit('date', $event.target.value)">
          <option v-for="d in dates" :key="d" :value="d">{{ d.split('-').reverse().join('.') }}</option>
        </select>
      </label>
      <label class="pl-f">или новая<input type="date" class="pl-in" @change="$event.target.value && $emit('date', $event.target.value)" /></label>
      <span class="pl-sum" :class="{ over: total > free }" :title="`${limit} ч между сессиями − отдых ${budget.norm} ч`">⏱ {{ round(total, 1) }} / {{ free }} ч свободно</span>
      <span v-if="sleep" class="pl-sum">🌙 {{ rest.toLowerCase() }} {{ sleep }} ч в день</span>
      <span class="grow" />
      <button v-if="canWrite && plans.length" type="button" class="pl-btn primary" @click="$emit('send', plans)">📨 Отправить мастеру ({{ plans.length }})</button>
    </div>
    <SessionBar :rows="freeList" :limit="free" legend />
    <div class="pl-days">
      <section v-for="d in days" :key="d" class="pl-day" :class="{ nod: d === 0, over: d && dayTotal(d) > 24 }">
        <header>
          <b>{{ d ? `День ${d}` : 'Без дня' }}</b>
          <small v-if="d">{{ round(dayTotal(d), 1) }}/24 ч</small>
          <button v-if="canWrite" type="button" class="pl-add" :title="d ? `Добавить в день ${d}` : 'Добавить без дня'" @click="$emit('add', d)">＋</button>
        </header>
        <div v-if="d && sleep" class="pl-sleep" :style="{ height: px(sleep) }">🌙 {{ rest.toLowerCase() }} {{ sleep }} ч</div>
        <VueDraggable :model-value="cols[d]" group="plan" :animation="180" :disabled="!canWrite" class="pl-list" ghost-class="pl-ghost" @update:model-value="moved(d, $event)">
          <article v-for="r in cols[d]" :key="r.id" class="pl-card" :class="'st-' + r.status" :style="{ '--cc': ACT_CATS[categoryOf(r.name)].color, '--sc': ACT_STATUS[r.status]?.color, minHeight: px(num(r.hours)) }"
                   :title="`${r.name}\n${r.hours || '?'} ч · ${ACT_STATUS[r.status]?.name}`" @click="$emit('edit', r)">
            <span class="pl-ic">{{ ACT_CATS[categoryOf(r.name)].icon }}</span>
            <span class="pl-nm">{{ r.name }}</span>
            <small>{{ r.hours || '—' }} ч<template v-if="num(r.hours) > 24"> · на {{ Math.ceil(num(r.hours) / 24) }} дн.</template></small>
          </article>
        </VueDraggable>
      </section>
    </div>
    <p class="pl-hint">{{ rest }} {{ sleep }} ч в день отложен в каждом дне (меняется в «⚙ Настройки»). Перетаскивай карточки между днями. Черновики (пунктир) мастер не видит в очереди, пока не нажмёшь «Отправить мастеру».</p>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { ACT_CATS, ACT_STATUS, categoryOf, num, round, freeRows, isSleepRec } from '../../shared/activities.js'
import SessionBar from './SessionBar.vue'

const props = defineProps({ rows: { type: Array, default: () => [] }, dates: { type: Array, default: () => [] }, date: { type: String, default: '' }, limit: { type: Number, default: 336 }, budget: { type: Object, default: () => ({ norm: 0, free: 336, rest: 'Сон' }) }, sleep: { type: Number, default: 0 }, rest: { type: String, default: 'Сон' }, canWrite: Boolean })
const emit = defineEmits(['move', 'add', 'edit', 'send', 'date'])
const nDays = computed(() => Math.max(1, Math.ceil(props.limit / 24)))
const days = computed(() => [0, ...Array.from({ length: Math.max(nDays.value, ...props.rows.map(r => r.day || 0)) }, (_, i) => i + 1)])
const cols = computed(() => Object.fromEntries(days.value.map(d => [d, props.rows.filter(r => (r.day || 0) === d)])))
// день: отложенный отдых + дела (записанный отдых — дополнительный); старый сон из таблицы занимает место отложенного
function dayTotal(d) {
  let old = 0, other = 0
  for (const r of cols.value[d]) {
    if (!r.at && isSleepRec(r.name, props.rest)) old += num(r.hours)
    else other += Math.min(24, num(r.hours))
  }
  return Math.max(props.sleep, old) + other
}
// свободные часы: период минус отдых; записанный сон в пределах нормы не считается
const free = computed(() => props.budget.free)
const freeList = computed(() => freeRows(props.rows.filter(r => r.status !== 'cancel'), props.budget).rows)
const total = computed(() => freeList.value.reduce((n, r) => n + num(r.hours), 0))
const plans = computed(() => props.rows.filter(r => r.status === 'plan'))
// карточка выше, чем дольше дело (час — 5 px, но не меньше строки и не больше суток)
const px = h => Math.max(30, Math.min(24, h) * 5) + 'px'
function moved(d, list) {
  for (const r of list) if ((r.day || 0) !== d) emit('move', r, d)
}
</script>

<style scoped>
.pl { display: grid; gap: 10px; }
.pl-tools { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 8px; }
.pl-f { display: grid; gap: 3px; color: #a8936c; font: 800 10.5px 'Manrope', sans-serif; letter-spacing: .06em; text-transform: uppercase; }
.pl-in { padding: 6px 9px; border-radius: 9px; border: 1px solid rgba(231, 197, 111, .25); background: rgba(0, 0, 0, .35); color: #efe3c8; font: 600 13px 'Manrope', sans-serif; color-scheme: dark; }
.pl-sum { padding: 4px 10px; border-radius: 99px; background: rgba(255, 255, 255, .05); color: #cdbf9f; font: 800 12px 'Manrope', sans-serif; }
.pl-sum.over { background: rgba(255, 122, 107, .16); color: #ffb3aa; }
.grow { flex: 1; }
.pl-btn { padding: 7px 14px; border-radius: 9px; border: 1px solid rgba(231, 197, 111, .35); background: rgba(231, 197, 111, .08); color: #f3d99a; font: 700 12.5px 'Manrope', sans-serif; cursor: pointer; }
.pl-btn.primary { background: linear-gradient(180deg, #f0d083, #c9a24f); color: #1b1408; border-color: #c9a24f; }
.pl-days { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(150px, 1fr); gap: 6px; overflow-x: auto; padding-bottom: 8px; scroll-snap-type: x proximity; }
.pl-day { display: flex; flex-direction: column; gap: 4px; min-height: 240px; padding: 6px; border-radius: 12px; background: rgba(20, 16, 11, .6); border: 1px solid rgba(231, 197, 111, .12); scroll-snap-align: start; }
.pl-day.nod { background: rgba(255, 255, 255, .02); border-style: dashed; }
.pl-day.over { border-color: rgba(255, 122, 107, .55); box-shadow: inset 0 0 18px rgba(255, 122, 107, .12); }
.pl-day header { display: flex; align-items: center; gap: 6px; }
.pl-day header b { font: 700 15px 'Cormorant Garamond', serif; color: #f3dc9e; }
.pl-day header small { color: #a8936c; font: 700 11px 'Manrope', sans-serif; }
.pl-day.over header small { color: #ffb3aa; }
.pl-add { margin-left: auto; width: 22px; height: 22px; padding: 0; border-radius: 7px; border: 1px dashed rgba(231, 197, 111, .4); background: none; color: #e7c56f; cursor: pointer; }
.pl-sleep { display: grid; place-items: center; border-radius: 8px; background: repeating-linear-gradient(135deg, rgba(111, 143, 216, .14) 0 6px, rgba(111, 143, 216, .06) 6px 12px); color: #9fb6ec; font: 700 11px 'Manrope', sans-serif; }
.pl-list { display: flex; flex-direction: column; gap: 4px; flex: 1; min-height: 40px; }
.pl-card { display: grid; grid-template-columns: auto 1fr; align-content: start; gap: 2px 5px; padding: 5px 7px; border-radius: 8px; border-left: 3px solid var(--cc); background: color-mix(in srgb, var(--cc) 12%, rgba(0, 0, 0, .35)); cursor: grab; box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--sc) 35%, transparent); }
.pl-card.st-plan { border-left-style: dashed; }
.pl-card:hover { background: color-mix(in srgb, var(--cc) 22%, rgba(0, 0, 0, .35)); }
.pl-ic { font-size: 12px; }
.pl-nm { color: #efe3c8; font: 700 12px/1.3 'Manrope', sans-serif; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.pl-card small { grid-column: 2; color: #a8936c; font: 700 10.5px 'Manrope', sans-serif; }
.pl-ghost { opacity: .4; }
.pl-hint { margin: 0; color: #a8936c; font: 600 12px 'Manrope', sans-serif; }
</style>
