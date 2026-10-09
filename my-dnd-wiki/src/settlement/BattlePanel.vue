<template>
  <div class="bp-wrap" @mousedown.self="$emit('close')">
    <section class="bp">
      <header>
        <div><small>Помощник боя · решает мастер</small><h3>{{ sideName }} против «{{ foeName || 'врага' }}»</h3></div>
        <button class="x" @click="$emit('close')">×</button>
      </header>
      <p class="rule">Урон стека = количество × атака × (1 + 5% за каждую единицу атаки выше защиты цели). Урон снимает хиты: погибшие и раненые = сколько воинов «ушло». Ходят по инициативе, бьют сначала авангард, потом центр, арьергард, командира. Половина наших павших — раненые, они уйдут в лечебницу.</p>
      <div v-if="ours.some(u => !u.ok)" class="alert">У части наших не заполнены статы: {{ ours.filter(u => !u.ok).map(u => u.name).join(', ') }} — они бьются нулями.
        <button class="link" @click="$emit('stats')">Заполнить статы →</button></div>

      <div class="sides">
        <div class="side">
          <b>Наши</b>
          <div v-if="!ours.length" class="muted">Никого нет — поставь воинов в {{ side === 'garrison' ? 'гарнизон' : 'отряд' }}.</div>
          <div v-for="(u, i) in shownOurs" :key="i" class="hpl">
            <span>{{ u.name }} <em>{{ lineName(u.line) }}</em><br /><small>×{{ u.now ?? u.count }}{{ u.fallen ? ` (−${u.fallen})` : '' }} · {{ u.atk }}/{{ u.def }}/{{ u.hp }}/{{ u.ini }}</small></span>
            <div class="bar"><i :style="{ width: pct(u) + '%' }" /></div>
            <small>{{ u.hpNow ?? u.count * u.hp }}/{{ u.hpMax ?? u.count * u.hp }}</small>
          </div>
        </div>
        <div class="side foe">
          <b>Враг <input v-model="foeName" placeholder="Стая варгов" class="foe-name" /></b>
          <div class="frow head"><span>кто</span><span>атк</span><span>защ</span><span>кол</span><span>хп</span><span>иниц</span><span /></div>
          <div v-for="(f, i) in foes" :key="i" class="frow">
            <input v-model="f.name" placeholder="Варги" />
            <input v-for="k in ['atk', 'def', 'count', 'hp', 'ini']" :key="k" v-model.number="f[k]" type="number" min="0" />
            <button class="mini" @click="foes.splice(i, 1)">×</button>
          </div>
          <button class="mini" @click="foes.push({ name: '', atk: 5, def: 3, count: 5, hp: 15, ini: 6 })">+ стек врага</button>
          <div v-if="res" class="after">
            <div v-for="(u, i) in res.foes" :key="i" class="hpl">
              <span>{{ u.name || 'враг' }}<br /><small>×{{ u.now }} (−{{ u.fallen }})</small></span>
              <div class="bar foe"><i :style="{ width: pct(u) + '%' }" /></div>
              <small>{{ u.hpNow }}/{{ u.hpMax }}</small>
            </div>
          </div>
        </div>
      </div>

      <div class="ctl">
        <label>Бегут, когда осталось меньше <input v-model.number="flee" type="number" min="0" max="90" class="num" /> %</label>
        <button class="btn" :disabled="!ours.length || !foes.length" @click="run">Рассчитать бой</button>
      </div>

      <template v-if="res">
        <div class="result" :class="res.result">
          {{ res.result === 'win' ? 'Победа' : res.result === 'loss' ? 'Поражение' : 'Ничья' }} за {{ res.rounds }} раунд(ов) ·
          погибнет <b>{{ totals.dead }}</b>, раненых в лечебницу <b>{{ totals.wounded }}</b>
        </div>
        <details class="log" open>
          <summary>Ход боя</summary>
          <div v-for="(l, i) in res.log" :key="i" :class="l.side">
            <template v-if="l.note">Раунд {{ l.round }} · <b>{{ l.note }}</b></template>
            <template v-else>Раунд {{ l.round }} · {{ l.by }} ×{{ l.byN }} → {{ l.target }}: {{ l.dmg }} урона{{ l.fell ? `, выбыло ${l.fell}` : '' }}</template>
          </div>
        </details>
        <div class="ctl end">
          <button class="btn" @click="apply">Применить: потери, раненые в лечебницу, событие в журнал</button>
        </div>
      </template>
    </section>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { store, act } from '../map/store.js'
import { LINES, unitOf, squadUnits, simulateBattle, splitFallen } from '../shared/army.js'

const props = defineProps({ settlement: Object, side: String })
const emit = defineEmits(['close', 'stats'])
const s = computed(() => props.settlement)
const heroes = computed(() => store.data.heroes || [])
const squad = computed(() => (props.side === 'garrison' ? null : (s.value.army?.squads || []).find(q => q.id === props.side)))
const sideName = computed(() => (squad.value ? `Отряд «${squad.value.name}»` : 'Гарнизон'))
const ours = computed(() => (squad.value
  ? squadUnits(s.value, squad.value, heroes.value)
  : (s.value.army?.garrison || []).map((sl, i) => { const u = unitOf(s.value, sl); return u && u.count ? { ...u, line: 'van', ref: { i } } : null }).filter(Boolean)))
const lineName = l => (l === 'cmd' ? 'командир' : squad.value ? LINES[l]?.label.toLowerCase() : '')

const foeName = ref('')
const foes = ref([{ name: '', atk: 5, def: 3, count: 8, hp: 15, ini: 6 }])
const flee = ref(30)
const res = ref(null)
const shownOurs = computed(() => res.value?.ours || ours.value)
const pct = u => (u.hpMax ? (u.hpNow / u.hpMax) * 100 : 100)
function run() {
  res.value = simulateBattle(ours.value, foes.value.map(f => ({ ...f, name: f.name || foeName.value || 'Враг' })), { flee: (flee.value || 0) / 100 })
}
const totals = computed(() => (res.value?.ours || []).reduce((t, u) => { const p = splitFallen(u); t.dead += p.dead; t.wounded += p.wounded; return t }, { dead: 0, wounded: 0 }))
async function apply() {
  const r = res.value
  const body = { side: props.side, foe: foeName.value || foes.value[0]?.name || 'враг', result: r.result, rounds: r.rounds, units: r.ours.filter(u => u.fallen).map(u => ({ ref: u.ref, fallen: u.fallen })) }
  const ok = await act('POST', `/api/settlements/${s.value.id}/battle`, body, 'Итог боя записан').catch(() => null)
  if (ok) emit('close')
}
</script>

<style scoped>
.bp-wrap { position: fixed; inset: 0; z-index: 140; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(5, 4, 2, .65); }
.bp { width: min(980px, 100%); max-height: calc(100vh - 32px); overflow-y: auto; display: grid; gap: 10px; padding: 16px 18px; border-radius: 16px; background: linear-gradient(170deg, #241c13, #16110c); border: 1px solid #6e4f22; box-shadow: 0 0 0 3px #1a140e, 0 24px 60px rgba(0, 0, 0, .7); color: var(--a-text); font: 500 13px var(--a-sans); }
header { display: flex; justify-content: space-between; align-items: flex-start; }
header small { font: 800 11px var(--a-sans); letter-spacing: .1em; text-transform: uppercase; color: var(--a-muted); }
header h3 { margin: 2px 0 0; font: 700 24px var(--a-serif); color: var(--a-gold-2); }
.x { border: 0; background: none; color: var(--a-muted); font-size: 28px; cursor: pointer; }
.rule { margin: 0; padding: 8px 12px; border-left: 3px solid var(--a-gold); background: rgba(231, 197, 111, .06); color: #d9cdb0; font-size: 12px; }
.alert { padding: 7px 12px; border-radius: 10px; border: 1px solid rgba(255, 179, 107, .5); background: rgba(255, 179, 107, .08); color: #ffcf9b; font-size: 12.5px; }
.link { border: 0; background: none; color: var(--a-gold-2); font: 800 12.5px var(--a-sans); text-decoration: underline; cursor: pointer; }
.sides { display: grid; grid-template-columns: 1fr 1.25fr; gap: 12px; }
.side { display: grid; gap: 6px; align-content: start; padding: 10px; border-radius: 12px; border: 1px solid rgba(255, 255, 255, .1); }
.side.foe { border-color: rgba(255, 107, 91, .4); }
.side > b { display: flex; align-items: center; gap: 8px; font: 700 17px var(--a-serif); color: var(--a-gold-2); }
.foe-name { flex: 1; min-width: 0; }
.hpl { display: grid; grid-template-columns: 1fr 1fr 70px; gap: 8px; align-items: center; font-size: 12px; }
.hpl em { font-style: normal; color: var(--a-muted); font-size: 11px; }
.hpl small { color: var(--a-muted); }
.bar { height: 9px; border-radius: 99px; overflow: hidden; background: rgba(0, 0, 0, .45); box-shadow: inset 0 0 0 1px rgba(201, 162, 79, .2); }
.bar i { display: block; height: 100%; border-radius: 99px; background: linear-gradient(90deg, #46b23a, #9be07a); transition: width .8s; }
.bar.foe i { background: linear-gradient(90deg, #a81f30, #ff6b5b); }
.frow { display: grid; grid-template-columns: 1.6fr repeat(5, 52px) 26px; gap: 4px; align-items: center; }
.frow.head { font: 800 10px var(--a-sans); color: var(--a-muted); text-transform: uppercase; }
input { min-height: 28px; padding: 2px 6px; border-radius: 7px; border: 1px solid var(--a-line-2); background: rgba(0, 0, 0, .3); color: var(--a-text); font: 600 12.5px var(--a-sans); min-width: 0; }
.num { width: 56px; }
.mini { justify-self: start; padding: 3px 8px; border-radius: 7px; border: 1px solid var(--a-line); background: rgba(231, 197, 111, .08); color: var(--a-gold-2); font: 700 12px var(--a-sans); cursor: pointer; }
.after { display: grid; gap: 4px; margin-top: 6px; padding-top: 6px; border-top: 1px dashed var(--a-line); }
.ctl { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.ctl.end { justify-content: flex-end; }
.ctl label { display: flex; align-items: center; gap: 6px; color: var(--a-muted); font-weight: 700; font-size: 12px; }
.btn { height: 34px; padding: 0 14px; border-radius: 9px; border: 0; background: linear-gradient(180deg, #f0d083, #c9a24f); color: #1b1408; font: 800 12.5px var(--a-sans); cursor: pointer; }
.btn:disabled { opacity: .5; }
.result { padding: 8px 12px; border-radius: 10px; font: 700 14px var(--a-sans); }
.result.win { background: rgba(155, 224, 122, .12); color: #9be07a; }
.result.loss { background: rgba(255, 107, 91, .12); color: #ff9b8f; }
.result.draw { background: rgba(255, 255, 255, .06); }
.result b { color: var(--a-gold-2); }
.log { max-height: 200px; overflow-y: auto; padding: 8px 10px; border-radius: 10px; background: rgba(0, 0, 0, .25); font-size: 12px; color: #d9cdb0; }
.log summary { cursor: pointer; font-weight: 800; color: var(--a-gold-2); }
.log div { padding: 2px 0; border-bottom: 1px dashed rgba(255, 255, 255, .05); }
.log .foe { color: #ffb0a6; }
.muted { color: var(--a-muted); font-size: 12px; }
@media (max-width: 760px) { .sides { grid-template-columns: 1fr; } .frow { grid-template-columns: 1fr repeat(5, 40px) 24px; } }
@media (max-width: 480px) { .bp { padding: 12px; } .frow { grid-template-columns: minmax(0, 1fr) repeat(5, 32px) 22px; gap: 2px; } .frow input { padding: 2px 3px; } .hpl { grid-template-columns: 1fr 70px 56px; } }
.bp, .side { min-width: 0; }
</style>
