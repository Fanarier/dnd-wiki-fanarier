<template>
  <div class="sq">
    <h3>Отряды <small>{{ squads.length }} из {{ limit }} · {{ s.kind || 'поселение' }}</small>
      <button v-if="master && squads.length < limit" class="ed" @click="addSquad">＋ Отряд</button>
      <button v-if="master" class="ed ghost" title="Сколько отрядов у деревни, села, города" @click="$emit('edit', 'army')">⚙ Лимиты и статы</button>
    </h3>
    <p class="muted">Отряд — и боевой, и караван. Командир обязателен (актив или герой). Авангард даёт +{{ LINES.van.bonus }} инициативы, центр — +{{ LINES.mid.bonus }} защиты, арьергард — +{{ LINES.rear.bonus }} атаки. Актив занимает место один, со своим стат-блоком.</p>
    <div v-if="!squads.length" class="empty">Отрядов пока нет{{ master ? ' — собери первый' : '' }}.</div>

    <div class="list">
      <div v-for="q in squads" :key="q.id" class="squad">
        <div class="sqh">
          <input v-if="master" :value="q.name" class="name-in" @change="save(q, { name: $event.target.value })" />
          <b v-else>{{ q.name }}</b>
          <span class="pill" :class="party(q) ? 'out' : 'home'">{{ party(q) ? (trip(q) ? 'в походе' : 'на карте мира') : 'дома' }}</span>
          <router-link v-if="party(q)" class="maplink" :to="{ path: '/', query: { focus: 'parties:' + q.partyId } }">«{{ party(q).name }}» на карте →</router-link>
        </div>
        <!-- поход по карте мира: отряд появляется в родном городе и идёт по точкам мастера -->
        <div v-if="party(q)" class="trip">
          <template v-if="trip(q)">
            <div class="trip-h"><span>{{ trip(q).waiting ? 'Выступит' : 'В пути' }}{{ party(q).journey.label ? ' · ' + party(q).journey.label : '' }}</span><b>{{ Math.round(trip(q).progress * 100) }}%</b></div>
            <div class="bar"><i :style="{ width: trip(q).progress * 100 + '%', background: 'linear-gradient(90deg, #2f8f9e, #6fd6e8)' }" /></div>
            <div class="trip-n">прибудет {{ fmtDateTime(party(q).journey.endAt) }}{{ !trip(q).waiting ? ' · ещё ' + fmtDuration(party(q).journey.endAt - store.now) : '' }}</div>
            <div v-if="nextStop(q)" class="trip-n">следующая точка: <b>{{ nextStop(q).name || 'без названия' }}</b> — {{ fmtDateTime(nextStop(q).at) }}</div>
          </template>
          <div v-else class="trip-n">стоит на карте мира — ждёт маршрута</div>
        </div>
        <div v-if="master" class="sq-ctl">
          <button v-if="!party(q)" class="mini go" :disabled="!q.commander" :title="q.commander ? 'Отряд появится в родном городе на карте мира, дальше — точки маршрута' : 'Сначала назначь командира'" @click="deploy(q)">🗺 Выйти в поход</button>
          <template v-else>
            <button class="mini go" @click="deploy(q)">🗺 Новый маршрут</button>
            <button class="mini" title="Проложить путь обратно — дома отряд сам уйдёт с карты" @click="deploy(q, true)">⌂ Домой</button>
          </template>
          <button class="mini" @click="$emit('battle', q.id)">⚔ Бой</button>
          <button class="mini danger" @click="removeSquad(q)">Распустить</button>
        </div>
        <div v-if="!q.commander" class="alert">Без командира отряд не выйдет.</div>

        <div class="cmd">
          <UnitSlot :unit="unit(q.commander)" :face="faceOf(s, q.commander)" :label="faceOf(s, q.commander)?.label" empty-text="назначить командира" :clickable="master" @pick="edit(q, 'cmd')" />
        </div>
        <div v-for="(def, l) in LINES" :key="l" class="line">
          <div class="lineh">{{ def.label }} <em>+{{ def.bonus }} {{ STATS[def.stat].toLowerCase() }}</em></div>
          <div class="row3">
            <UnitSlot v-for="i in LINE_SLOTS" :key="i" size="sm" :unit="lineUnit(q, l, i - 1)" :face="faceOf(s, q.lines?.[l]?.[i - 1])" :buff="def.stat" :clickable="master" @pick="edit(q, l, i - 1)" />
          </div>
        </div>

        <div class="line">
          <div class="lineh">Обоз <em>переносимость {{ cargoTotal(q) }}</em></div>
          <div class="cargo">
            <button v-for="(c, n) in cargoCells(q)" :key="n" type="button" class="cg" :class="{ full: c.item }" :disabled="!master" @click="openCargo(q, c)">
              {{ c.kind === 'wagons' ? '🛒' : '🐴' }}<b>{{ c.item?.count || '—' }}</b>{{ c.item?.label || (c.kind === 'wagons' ? 'повозки' : 'вьючные') }}<small v-if="c.item">по {{ c.item.capacity || 0 }}</small>
            </button>
          </div>
          <div v-if="cargo && cargo.q === q.id" class="cg-edit">
            <input v-model="cargo.label" :placeholder="cargo.kind === 'wagons' ? 'Телега' : 'Мул'" />
            <label>штук<input v-model.number="cargo.count" type="number" min="0" /></label>
            <label>везёт одна<input v-model.number="cargo.capacity" type="number" min="0" /></label>
            <button class="mini" @click="saveCargo(q)">ОК</button>
            <button class="mini" @click="saveCargo(q, true)">убрать</button>
          </div>
        </div>

        <div class="meters">
          <div class="task">
            <input v-if="master" :value="q.task || ''" placeholder="Задание: «Сопроводить караван в Ширатори»" @change="save(q, { task: $event.target.value })" />
            <span v-else>{{ q.task || 'Задание не сообщается' }}</span>
            <label v-if="master" class="secret"><input type="checkbox" :checked="q.taskSecret" @change="save(q, { taskSecret: $event.target.checked })" /> 🔒 секретное — игроки не видят</label>
          </div>
          <div v-for="m in METERS" :key="m.key" class="meter">
            <span>{{ m.label }}</span>
            <div class="bar"><i :style="{ width: (q[m.key] ?? m.def) + '%', background: m.color }" /></div>
            <input v-if="master" type="range" min="0" max="100" step="5" :value="q[m.key] ?? m.def" @change="save(q, { [m.key]: +$event.target.value })" />
            <b>{{ q[m.key] ?? m.def }}%</b>
          </div>
        </div>
        <div class="sum">Воинов <b>{{ squadUnits(s, q, heroes).reduce((n, u) => n + u.count, 0) }}</b> · сила <b>{{ squadUnits(s, q, heroes).reduce((n, u) => n + power(u), 0) }}</b></div>
        <button v-if="decider" class="mini" @click="order(q)">Приказ отряду</button>
      </div>
    </div>

    <SlotEditor v-if="editing" :settlement="s" :slot="editing.slot" :mode="editing.line === 'cmd' ? 'commander' : 'line'" :subtitle="editing.sub" :title="editing.title"
                @close="editing = null" @save="saveSlot" />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { store, act, fmtDateTime, fmtDuration } from '../map/store.js'
import { journeyState } from '../shared/geo.js'
import { STATS, LINES, LINE_SLOTS, CARGO_SLOTS, unitOf, squadUnits, power, cargoTotal, squadLimit } from '../shared/army.js'
import { faceOf } from './armyFaces.js'
import UnitSlot from './UnitSlot.vue'
import SlotEditor from './SlotEditor.vue'

const props = defineProps({ settlement: Object, master: Boolean, decider: Boolean })
defineEmits(['edit', 'battle'])
const s = computed(() => props.settlement)
const base = () => `/api/settlements/${s.value.id}`
const heroes = computed(() => store.data.heroes || [])
const parties = computed(() => store.data.parties || [])
const squads = computed(() => s.value.army?.squads || [])
const limit = computed(() => squadLimit(s.value))
const party = q => q.partyId && parties.value.find(p => p.id === q.partyId)
const trip = q => { const p = party(q); return p?.journey ? journeyState(p.journey, store.now) : null }
// ближайшая непройденная точка интереса и когда отряд там будет
function nextStop(q) {
  const j = party(q)?.journey, t = trip(q)
  const st = j?.stops?.find(x => x.s > t.progress)
  return st ? { ...st, at: j.startAt + (j.endAt - j.startAt) * st.s } : null
}
const router = useRouter()
// выйти в поход: отряд появляется в родном городе, на карте сразу открывается прокладка маршрута
async function deploy(q, home = false) {
  const p = await act('POST', `${base()}/squads/${q.id}/deploy`, {}).catch(() => null)
  if (!p) return
  router.push({ path: '/', query: { plan: p.id, ...(home ? { home: s.value.cityId, label: 'Домой' } : q.task && !q.taskSecret ? { label: q.task } : {}) } })
}
const unit = sl => unitOf(s.value, sl, s.value.assets, heroes.value)
const lineUnit = (q, l, i) => {
  const u = unit(q.lines?.[l]?.[i])
  return u ? { ...u, [LINES[l].stat]: u[LINES[l].stat] + LINES[l].bonus } : null
}
const METERS = [
  { key: 'taskProgress', label: 'Задание', def: 0, color: 'linear-gradient(90deg, #2f8f9e, #6fd6e8)' },
  { key: 'ready', label: 'Готовность', def: 100, color: 'linear-gradient(90deg, #46b23a, #9be07a)' },
  { key: 'fatigue', label: 'Усталость', def: 0, color: 'linear-gradient(90deg, #c99a48, #ff9a3c)' }
]

const saveArmy = (patch, ok, extra = {}) => act('PATCH', base(), { army: { ...(s.value.army || {}), ...patch }, ...extra }, ok).catch(() => null)
const save = (q, patch, ok) => saveArmy({ squads: squads.value.map(x => (x.id === q.id ? { ...x, ...patch } : x)) }, ok)
function addSquad() {
  const q = { id: 'q' + Date.now().toString(36), name: `Отряд ${squads.value.length + 1}`, commander: null, lines: { van: [null, null, null], mid: [null, null, null], rear: [null, null, null] }, wagons: [null, null, null], packs: [null, null, null], status: 'home', partyId: null, task: '', taskProgress: 0, ready: 100, fatigue: 0 }
  saveArmy({ squads: [...squads.value, q] }, 'Отряд создан — назначь командира')
}
async function removeSquad(q) {
  if (!confirm(`Распустить «${q.name}»? Воины вернутся в число свободных боевых${party(q) ? ', отряд уйдёт с карты мира' : ''}.`)) return
  if (party(q)) await act('DELETE', `/api/parties/${q.partyId}`).catch(() => null)
  saveArmy({ squads: squads.value.filter(x => x.id !== q.id) }, 'Отряд распущен')
}

/* слоты */
const editing = ref(null)
function edit(q, line, i) {
  const slot = line === 'cmd' ? q.commander : q.lines?.[line]?.[i]
  editing.value = { q: q.id, line, i, slot, sub: `Отряд «${q.name}»`, title: line === 'cmd' ? 'Командир' : `${LINES[line].label}, место ${i + 1}` }
}
function saveSlot({ slot, assetStats, takenPending, raceStats }) {
  const e = editing.value
  const q = squads.value.find(x => x.id === e.q)
  const patch = e.line === 'cmd' ? { commander: slot } : { lines: { ...q.lines, [e.line]: Array.from({ length: LINE_SLOTS }, (_, n) => (n === e.i ? slot : q.lines?.[e.line]?.[n] || null)) } }
  const armyPatch = { squads: squads.value.map(x => (x.id === q.id ? { ...x, ...patch } : x)) }
  if (raceStats) armyPatch.stats = { ...(s.value.army?.stats || {}), [raceStats.race]: raceStats.stats }
  if (takenPending) armyPatch.pendingTalents = { ...(s.value.army?.pendingTalents || {}), [takenPending]: [] }
  const extra = assetStats ? { assets: (s.value.assets || []).map(a => (a.id === assetStats.id ? { ...a, stats: assetStats.stats } : a)) } : {}
  saveArmy(armyPatch, 'Отряд обновлён', extra)
  editing.value = null
}

/* обоз: 3 ячейки повозок и 3 — вьючных животных; одинаковые — стопкой в одной ячейке */
const cargoCells = q => ['wagons', 'packs'].flatMap(kind => Array.from({ length: CARGO_SLOTS }, (_, i) => ({ kind, i, item: q[kind]?.[i] || null })))
const cargo = ref(null)
const openCargo = (q, c) => { cargo.value = { q: q.id, kind: c.kind, i: c.i, label: c.item?.label || '', count: c.item?.count || 1, capacity: c.item?.capacity || 0 } }
function saveCargo(q, clear = false) {
  const c = cargo.value
  const list = Array.from({ length: CARGO_SLOTS }, (_, i) => q[c.kind]?.[i] || null)
  list[c.i] = clear ? null : { label: c.label || (c.kind === 'wagons' ? 'Повозка' : 'Вьючное'), count: Math.max(0, c.count || 0), capacity: Math.max(0, c.capacity || 0) }
  save(q, { [c.kind]: list }, 'Обоз обновлён')
  cargo.value = null
}
function order(q) {
  const text = prompt(`Приказ отряду «${q.name}» (собрать, отправить, вернуть…):`, '')
  if (text) act('POST', `${base()}/orders`, { kind: 'free', text: `Отряд «${q.name}»: ${text}` }, 'Приказ отправлен мастеру').catch(() => null)
}
</script>

<style scoped>
.sq { display: grid; gap: 8px; }
h3 { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin: 0; font: 700 21px var(--a-serif); color: var(--a-gold-2); }
h3 small { font: 600 12px var(--a-sans); color: var(--a-muted); }
.ed { padding: 4px 10px; border-radius: 8px; border: 1px solid var(--a-line); background: rgba(231, 197, 111, .1); color: var(--a-gold-2); font: 700 12px var(--a-sans); cursor: pointer; }
.ed:first-of-type { margin-left: auto; }
.ed.ghost { background: none; }
.muted { margin: 0; color: var(--a-muted); font-size: 12.5px; }
.empty { padding: 24px; text-align: center; color: var(--a-muted); border: 1px dashed rgba(255, 255, 255, .12); border-radius: 12px; }
.list { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 12px; }
.squad { display: grid; gap: 6px; align-content: start; padding: 12px; border-radius: 14px; border: 1px solid #8a6630; background: rgba(0, 0, 0, .18); }
.sqh { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.sqh b, .name-in { font: 700 19px var(--a-serif); color: var(--a-gold-2); }
.name-in { flex: 1; min-width: 120px; padding: 2px 6px; border-radius: 7px; border: 1px solid transparent; background: none; }
.name-in:hover, .name-in:focus { border-color: var(--a-line); outline: none; }
.pill { padding: 2px 9px; border-radius: 99px; font: 800 11px var(--a-sans); }
.pill.home { background: rgba(155, 224, 122, .15); color: #9be07a; }
.pill.out { background: rgba(111, 214, 232, .15); color: #6fd6e8; }
.maplink { font-size: 12px; font-weight: 700; color: var(--a-gold-2); }
.sq-ctl { display: flex; gap: 6px; flex-wrap: wrap; }
.sq-ctl select, .task input, .cg-edit input { min-height: 28px; padding: 2px 7px; border-radius: 7px; border: 1px solid var(--a-line-2); background: rgba(0, 0, 0, .3); color: var(--a-text); font: 600 12px var(--a-sans); }
.mini { padding: 4px 9px; border-radius: 8px; border: 1px solid var(--a-line); background: rgba(231, 197, 111, .08); color: var(--a-gold-2); font: 700 12px var(--a-sans); cursor: pointer; justify-self: start; }
.mini.danger { color: #ff9b8f; border-color: rgba(255, 107, 94, .4); }
.mini.go { background: linear-gradient(180deg, #f0d083, #c9a24f); color: #1b1408; border: 0; }
.mini:disabled { opacity: .45; cursor: not-allowed; }
.trip { display: grid; gap: 4px; padding: 8px 10px; border-radius: 10px; background: rgba(111, 214, 232, .07); border: 1px solid rgba(111, 214, 232, .25); }
.trip-h { display: flex; justify-content: space-between; gap: 8px; font-size: 12.5px; font-weight: 700; color: #bfe9f1; }
.trip-h b { color: #6fd6e8; }
.trip-n { font-size: 11.5px; color: var(--a-muted); }
.trip-n b { color: #d9cdb0; }
.secret { display: flex; align-items: center; gap: 5px; margin-top: 4px; font-size: 11.5px; font-weight: 700; color: var(--a-muted); }
.alert { padding: 5px 10px; border-radius: 8px; background: rgba(255, 179, 107, .1); color: #ffcf9b; font-size: 12px; font-weight: 700; }
.cmd { display: flex; justify-content: center; }
.cmd > * { max-width: 300px; }
.line { display: grid; gap: 4px; }
.lineh { display: flex; justify-content: space-between; font: 800 10.5px var(--a-sans); color: var(--a-muted); text-transform: uppercase; letter-spacing: .05em; }
.lineh em { font-style: normal; text-transform: none; letter-spacing: 0; color: #9be07a; }
.row3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 5px; }
.cargo { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; }
.cg { display: grid; justify-items: center; padding: 5px; border-radius: 10px; border: 1px dashed rgba(201, 162, 79, .35); background: none; color: var(--a-muted); font: 600 11px var(--a-sans); cursor: pointer; }
.cg:disabled { cursor: default; }
.cg b { font-size: 18px; color: var(--a-text); }
.cg small { font-size: 10px; }
.cg.full { border-style: solid; background: rgba(231, 197, 111, .06); }
.cg-edit { display: flex; flex-wrap: wrap; gap: 5px; align-items: end; }
.cg-edit label { display: grid; font-size: 10px; color: var(--a-muted); }
.cg-edit label input { width: 70px; }
.meters { display: grid; gap: 5px; margin-top: 4px; }
.task input { width: 100%; box-sizing: border-box; }
.task span { font-size: 12.5px; color: #d9cdb0; font-style: italic; }
.meter { display: grid; grid-template-columns: 78px 1fr auto 38px; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; color: #c9b88f; }
.meter input { width: 70px; accent-color: #e6c27a; }
.meter b { text-align: right; color: var(--a-gold-2); }
.bar { height: 8px; border-radius: 99px; overflow: hidden; background: rgba(0, 0, 0, .4); box-shadow: inset 0 0 0 1px rgba(201, 162, 79, .2); }
.bar i { display: block; height: 100%; border-radius: 99px; transition: width .6s; }
.sum { font-size: 12px; color: #d9cdb0; }
.sum b { color: var(--a-gold-2); }
@media (max-width: 420px) { .list { grid-template-columns: 1fr; } .meter { grid-template-columns: 70px 1fr 34px; } .meter input { display: none; } }
</style>
