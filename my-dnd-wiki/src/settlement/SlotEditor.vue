<template>
  <div class="sle-wrap" @mousedown.self="$emit('close')">
    <form class="sle" @submit.prevent="save">
      <header><b>{{ title }}</b><button type="button" class="x" @click="$emit('close')">×</button></header>
      <div class="kinds">
        <label v-if="mode !== 'commander'"><input v-model="kind" type="radio" value="race" /> Воины расы</label>
        <label><input v-model="kind" type="radio" value="asset" /> Актив</label>
        <label v-if="mode === 'commander'"><input v-model="kind" type="radio" value="hero" /> Карточка героя</label>
      </div>

      <template v-if="kind === 'race'">
        <label>Раса
          <select v-model="race">
            <option v-for="r in races" :key="r.race" :value="r.race">{{ RACES[r.race]?.label }} — свободно боевых {{ avail(r.race) }}</option>
          </select>
        </label>
        <p v-if="!races.length" class="warn">Нет боевых жителей — отметь «Боевых» во вкладке «Жители» или обучи воинов.</p>
        <label>Сколько воинов <input v-model.number="count" type="number" min="0" :max="avail(race)" /> <em>из {{ avail(race) }}</em></label>
        <p v-if="race && !raceStatsOk" class="warn">У расы «{{ RACES[race]?.label }}» не заполнены статы — в бою её не посчитать. <button type="button" class="link" @click="$emit('stats')">Заполнить статы рас →</button></p>
        <div class="tal">
          <small>Талантливые ★ — у каждого свой бонус (к статам стека прибавляется в среднем)</small>
          <div v-for="(t, i) in talents" :key="t.id" class="tal-row">
            <input v-model="t.note" placeholder="Дар: «Меткий глаз»" />
            <label v-for="(l, k) in STATS" :key="k" :title="l">{{ l.slice(0, 3).toLowerCase() }}<input v-model.number="t[k]" type="number" /></label>
            <button type="button" class="mini" @click="talents.splice(i, 1)">×</button>
          </div>
          <div class="tal-acts">
            <button type="button" class="mini" :disabled="talents.length >= count" @click="talents.push({ id: 't' + Date.now().toString(36) + talents.length, note: '', atk: 1, def: 0, hp: 0, ini: 0 })">+ талант</button>
            <button v-if="pending.length" type="button" class="mini" @click="takePending">забрать ждущие таланты ({{ pending.length }})</button>
          </div>
        </div>
      </template>

      <template v-else-if="kind === 'asset'">
        <label>Актив
          <select v-model="assetId"><option v-for="a in assets" :key="a.id" :value="a.id" :disabled="a.dead">{{ a.name }}{{ a.dead ? ' (погиб)' : '' }}</option></select>
        </label>
        <p class="muted">Актив занимает место один и бьётся своим стат-блоком — он хранится у актива.</p>
        <div class="stats"><label v-for="(l, k) in STATS" :key="k">{{ l }}<input v-model.number="stats[k]" type="number" min="0" /></label></div>
      </template>

      <template v-else>
        <label>Герой
          <select v-model="heroId"><option v-for="h in heroes" :key="h.id" :value="h.id">{{ h.name }}</option></select>
        </label>
        <div class="stats"><label v-for="(l, k) in STATS" :key="k">{{ l }}<input v-model.number="stats[k]" type="number" min="0" /></label></div>
      </template>

      <footer>
        <button v-if="slot" type="button" class="danger" @click="$emit('save', { slot: null })">{{ mode === 'commander' ? 'Снять командира' : 'Освободить слот' }}</button>
        <span class="grow" />
        <button type="button" @click="$emit('close')">Отмена</button>
        <button class="primary" :disabled="!valid">Сохранить</button>
      </footer>
    </form>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { store } from '../map/store.js'
import { RACES } from '../shared/settlement.js'
import { STATS, combatUse, hasStats } from '../shared/army.js'

const props = defineProps({
  settlement: { type: Object, required: true },
  slot: { type: Object, default: null },
  mode: { type: String, default: 'garrison' }, // garrison | line | commander
  title: { type: String, default: 'Слот' }
})
const emit = defineEmits(['close', 'save', 'stats'])
const s = computed(() => props.settlement)
const sl = props.slot || {}
const kind = ref(sl.asset ? 'asset' : sl.hero ? 'hero' : props.mode === 'commander' ? 'asset' : 'race')
const use = computed(() => combatUse(s.value))
const races = computed(() => (s.value.races || []).filter(r => (r.combat || 0) > 0))
// свободно: боевые расы минус уже стоящие везде, плюс те, что сейчас в этом слоте
const avail = r => (use.value[r]?.free || 0) + (sl.race === r ? sl.count || 0 : 0)
const race = ref(sl.race || races.value.find(r => avail(r.race) > 0)?.race || races.value[0]?.race || '')
const count = ref(sl.count ?? Math.min(5, avail(race.value)))
const talents = ref(JSON.parse(JSON.stringify(sl.talents || [])))
const raceStatsOk = computed(() => hasStats(s.value.army?.stats?.[race.value]))
const pending = computed(() => s.value.army?.pendingTalents?.[race.value] || [])
const takePending = () => { talents.value.push(...JSON.parse(JSON.stringify(pending.value))); takenPending.value = true }
const takenPending = ref(false)

const assets = computed(() => s.value.assets || [])
const assetId = ref(sl.asset || assets.value.find(a => !a.dead)?.id || '')
const heroes = computed(() => (store.data.heroes || []).filter(h => h.kind !== 'companion'))
const heroId = ref(sl.hero || heroes.value[0]?.id || '')
const stats = ref({ atk: 0, def: 0, hp: 0, ini: 0 })
watch([kind, assetId], () => {
  if (kind.value === 'asset') stats.value = { atk: 0, def: 0, hp: 0, ini: 0, ...(assets.value.find(a => a.id === assetId.value)?.stats || {}) }
  else if (kind.value === 'hero') stats.value = { atk: 0, def: 0, hp: 0, ini: 0, ...(sl.stats || {}) }
}, { immediate: true })

const valid = computed(() => (kind.value === 'race' ? race.value && count.value > 0 && count.value <= avail(race.value) : kind.value === 'asset' ? !!assetId.value : !!heroId.value))
function save() {
  if (kind.value === 'race') {
    emit('save', { slot: { race: race.value, count: count.value, talents: talents.value.slice(0, count.value) }, takenPending: takenPending.value ? race.value : null })
  } else if (kind.value === 'asset') {
    emit('save', { slot: { asset: assetId.value }, assetStats: { id: assetId.value, stats: { ...stats.value } } })
  } else emit('save', { slot: { hero: heroId.value, stats: { ...stats.value } } })
}
</script>

<style scoped>
.sle-wrap { position: fixed; inset: 0; z-index: 140; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(5, 4, 2, .6); }
.sle { width: min(480px, 100%); max-height: calc(100vh - 32px); overflow-y: auto; display: grid; gap: 10px; padding: 16px; border-radius: 16px; background: linear-gradient(170deg, #241c13, #16110c); border: 1px solid #6e4f22; box-shadow: 0 0 0 3px #1a140e, 0 24px 60px rgba(0, 0, 0, .7); color: var(--a-text); font: 500 13px var(--a-sans); }
header { display: flex; justify-content: space-between; align-items: center; }
header b { font: 700 22px var(--a-serif); color: var(--a-gold-2); }
.x { border: 0; background: none; color: var(--a-muted); font-size: 26px; cursor: pointer; }
.kinds { display: flex; gap: 14px; flex-wrap: wrap; }
.kinds label { display: flex; align-items: center; gap: 5px; font-weight: 700; }
label { display: grid; gap: 4px; color: var(--a-muted); font-size: 12px; font-weight: 700; }
input, select { min-height: 32px; padding: 4px 8px; border-radius: 8px; border: 1px solid #6e4f22; background: #120e09; color: var(--a-text); font: 600 13px var(--a-sans); }
label em { font-style: normal; color: var(--a-muted); }
.stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.tal { display: grid; gap: 6px; padding: 8px; border-radius: 10px; border: 1px dashed rgba(255, 224, 138, .35); }
.tal small { color: #ffe08a; font-weight: 700; }
.tal-row { display: flex; gap: 4px; align-items: end; flex-wrap: wrap; }
.tal-row > input { flex: 1; min-width: 120px; }
.tal-row label { width: 48px; font-size: 10px; }
.tal-row label input { padding: 3px 4px; min-height: 28px; }
.tal-acts { display: flex; gap: 6px; flex-wrap: wrap; }
.mini { padding: 4px 9px; border-radius: 8px; border: 1px solid var(--a-line); background: rgba(231, 197, 111, .08); color: var(--a-gold-2); font: 700 12px var(--a-sans); cursor: pointer; }
.mini:disabled { opacity: .4; }
.warn { margin: 0; color: #ffb36b; font-size: 12px; font-weight: 700; }
.muted { margin: 0; color: var(--a-muted); font-size: 12px; }
.link { border: 0; background: none; color: var(--a-gold-2); font: 800 12px var(--a-sans); text-decoration: underline; cursor: pointer; padding: 0; }
footer { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.grow { flex: 1; }
footer button { height: 34px; padding: 0 14px; border-radius: 9px; border: 1px solid var(--a-line); background: rgba(255, 255, 255, .05); color: var(--a-text); font: 700 12.5px var(--a-sans); cursor: pointer; }
footer .primary { background: linear-gradient(180deg, #f0d083, #c9a24f); color: #1b1408; border: 0; }
footer .primary:disabled { opacity: .5; }
footer .danger { color: #ff9b8f; border-color: rgba(255, 107, 94, .4); }
</style>
