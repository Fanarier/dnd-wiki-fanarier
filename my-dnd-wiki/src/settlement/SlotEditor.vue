<template>
  <div class="sle-wrap" @mousedown.self="$emit('close')">
    <form class="sle" @submit.prevent="save">
      <header>
        <div><small>{{ subtitle }}</small><b>{{ title }}</b></div>
        <button type="button" class="x" aria-label="Закрыть" @click="$emit('close')">×</button>
      </header>

      <div class="body">
        <!-- как будет выглядеть -->
        <div class="preview">
          <UnitSlot :unit="preview" :face="previewFace" :label="previewFace?.label" />
        </div>

        <div class="seg">
          <button v-if="mode !== 'commander'" type="button" :class="{ on: kind === 'race' }" @click="kind = 'race'">⚔ Воины расы</button>
          <button type="button" :class="{ on: kind === 'asset' }" @click="kind = 'asset'">✦ Актив</button>
          <button v-if="mode === 'commander'" type="button" :class="{ on: kind === 'hero' }" @click="kind = 'hero'">♛ Герой</button>
        </div>

        <!-- ===== воины расы ===== -->
        <template v-if="kind === 'race'">
          <div v-if="!races.length" class="warn">Нет боевых жителей — отметь «Боевых» во вкладке «Жители» или обучи воинов.</div>
          <div class="chips">
            <button v-for="r in races" :key="r.race" type="button" class="chip" :class="{ on: race === r.race, none: !avail(r.race) }" :style="{ '--fc': RACE_COLORS[r.race] }" @click="pickRace(r.race)">
              <i>{{ RACES[r.race]?.label[0] }}</i>{{ RACES[r.race]?.label }}<em>{{ avail(r.race) }} своб.</em>
            </button>
          </div>
          <div v-if="race" class="count">
            <span>Воинов</span>
            <input v-model.number="count" type="range" min="1" :max="Math.max(1, avail(race))" />
            <input v-model.number="count" type="number" min="1" :max="avail(race)" class="num" />
            <button type="button" class="mini" @click="count = avail(race)">все {{ avail(race) }}</button>
          </div>
          <fieldset v-if="race" :class="{ miss: !raceStatsOk }">
            <legend>Статы одного воина — {{ RACES[race]?.label }} <small>{{ raceStatsOk ? 'общие для всех воинов расы' : 'не заполнены — впиши' }}</small></legend>
            <div class="stats">
              <label v-for="(l, k) in STATS" :key="k" :class="k">{{ l }}<input v-model.number="raceStats[k]" type="number" min="0" /></label>
            </div>
          </fieldset>
          <details class="tal" :open="talents.length > 0">
            <summary>★ Талантливые <small>{{ talents.length }} — у каждого свой бонус</small></summary>
            <div v-for="(t, i) in talents" :key="t.id" class="tal-row">
              <input v-model="t.note" placeholder="Дар: «Меткий глаз»" class="note" />
              <label v-for="(l, k) in STATS" :key="k" :class="k">+{{ l.slice(0, 3).toLowerCase() }}<input v-model.number="t[k]" type="number" /></label>
              <button type="button" class="mini" title="Убрать" @click="talents.splice(i, 1)">×</button>
            </div>
            <div class="row">
              <button type="button" class="mini" :disabled="talents.length >= count" @click="talents.push({ id: 't' + Date.now().toString(36) + talents.length, note: '', atk: 1, def: 0, hp: 0, ini: 0 })">+ талант</button>
              <button v-if="pending.length" type="button" class="mini" @click="takePending">забрать выросших ({{ pending.length }})</button>
            </div>
          </details>
        </template>

        <!-- ===== актив ===== -->
        <template v-else-if="kind === 'asset'">
          <div class="cards">
            <button v-for="a in assets" :key="a.id" type="button" class="card" :class="{ on: assetId === a.id, dead: a.dead }" :disabled="a.dead" @click="assetId = a.id">
              <span class="cface"><img v-if="faceOf(s, { asset: a.id })?.img" :src="faceOf(s, { asset: a.id }).img" alt="" /><span v-else>{{ a.name[0] }}</span></span>
              <b>{{ a.name }}</b>
              <small>{{ a.dead ? 'погиб' : hasStats(a.stats) ? `${a.stats.atk}/${a.stats.def}/${a.stats.hp}/${a.stats.ini}` : 'нет статов' }}</small>
            </button>
          </div>
          <fieldset :class="{ miss: !hasStats(stats) }">
            <legend>Стат-блок актива <small>хранится у самого актива</small></legend>
            <div class="stats"><label v-for="(l, k) in STATS" :key="k" :class="k">{{ l }}<input v-model.number="stats[k]" type="number" min="0" /></label></div>
          </fieldset>
        </template>

        <!-- ===== герой ===== -->
        <template v-else>
          <label class="full">Карточка героя
            <select v-model="heroId"><option v-for="h in heroes" :key="h.id" :value="h.id">{{ h.name }}</option></select>
          </label>
          <fieldset :class="{ miss: !hasStats(stats) }">
            <legend>Стат-блок командира</legend>
            <div class="stats"><label v-for="(l, k) in STATS" :key="k" :class="k">{{ l }}<input v-model.number="stats[k]" type="number" min="0" /></label></div>
          </fieldset>
        </template>
      </div>

      <footer>
        <button v-if="slot" type="button" class="danger" @click="$emit('save', { slot: null })">{{ mode === 'commander' ? 'Снять командира' : 'Освободить' }}</button>
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
import { STATS, combatUse, hasStats, unitOf } from '../shared/army.js'
import { faceOf, RACE_COLORS } from './armyFaces.js'
import UnitSlot from './UnitSlot.vue'

const props = defineProps({
  settlement: { type: Object, required: true },
  slot: { type: Object, default: null },
  mode: { type: String, default: 'garrison' }, // garrison | line | commander
  title: { type: String, default: 'Слот' },
  subtitle: { type: String, default: 'Гарнизон' }
})
const emit = defineEmits(['close', 'save'])
const s = computed(() => props.settlement)
const sl = props.slot || {}
const kind = ref(sl.asset ? 'asset' : sl.hero ? 'hero' : props.mode === 'commander' ? 'asset' : 'race')

/* воины расы: свободно = боевые расы минус уже стоящие везде, плюс те, что сейчас в этом слоте */
const use = computed(() => combatUse(s.value))
const races = computed(() => (s.value.races || []).filter(r => (r.combat || 0) > 0))
const avail = r => (use.value[r]?.free || 0) + (sl.race === r ? sl.count || 0 : 0)
const race = ref(sl.race || races.value.find(r => avail(r.race) > 0)?.race || '')
const count = ref(sl.count || Math.max(1, avail(race.value)))
const talents = ref(JSON.parse(JSON.stringify(sl.talents || [])))
const raceStats = ref({})
watch(race, r => { raceStats.value = { atk: 0, def: 0, hp: 0, ini: 0, ...(s.value.army?.stats?.[r] || {}) } }, { immediate: true })
const raceStatsOk = computed(() => hasStats(raceStats.value))
function pickRace(r) {
  if (!avail(r)) return
  if (race.value !== r) talents.value = []
  race.value = r
  count.value = Math.min(Math.max(1, count.value), avail(r)) || avail(r)
}
const pending = computed(() => s.value.army?.pendingTalents?.[race.value] || [])
const takenPending = ref(false)
const takePending = () => { talents.value.push(...JSON.parse(JSON.stringify(pending.value))); takenPending.value = true }

/* актив и герой */
const assets = computed(() => s.value.assets || [])
const assetId = ref(sl.asset || assets.value.find(a => !a.dead)?.id || '')
const heroes = computed(() => (store.data.heroes || []).filter(h => h.kind !== 'companion'))
const heroId = ref(sl.hero || heroes.value[0]?.id || '')
const stats = ref({ atk: 0, def: 0, hp: 0, ini: 0 })
watch([kind, assetId], () => {
  if (kind.value === 'asset') stats.value = { atk: 0, def: 0, hp: 0, ini: 0, ...(assets.value.find(a => a.id === assetId.value)?.stats || {}) }
  else if (kind.value === 'hero') stats.value = { atk: 0, def: 0, hp: 0, ini: 0, ...(sl.stats || {}) }
}, { immediate: true })

/* предпросмотр — как слот будет выглядеть с тем, что сейчас выбрано */
const draft = computed(() => (kind.value === 'race' ? (race.value ? { race: race.value, count: count.value, talents: talents.value } : null) : kind.value === 'asset' ? (assetId.value ? { asset: assetId.value } : null) : heroId.value ? { hero: heroId.value, stats: stats.value } : null))
const preview = computed(() => {
  if (!draft.value) return null
  const army = { ...(s.value.army || {}), stats: { ...(s.value.army?.stats || {}), ...(race.value ? { [race.value]: raceStats.value } : {}) } }
  const assetsNow = assets.value.map(a => (a.id === assetId.value ? { ...a, stats: stats.value } : a))
  return unitOf({ ...s.value, army, assets: assetsNow }, draft.value, assetsNow, store.data.heroes || [])
})
const previewFace = computed(() => faceOf(s.value, draft.value))

const valid = computed(() => (kind.value === 'race' ? !!race.value && count.value > 0 && count.value <= avail(race.value) : kind.value === 'asset' ? !!assetId.value : !!heroId.value))
function save() {
  if (kind.value === 'race') {
    emit('save', {
      slot: { race: race.value, count: count.value, talents: talents.value.slice(0, count.value) },
      takenPending: takenPending.value ? race.value : null,
      raceStats: { race: race.value, stats: { ...raceStats.value } }
    })
  } else if (kind.value === 'asset') {
    emit('save', { slot: { asset: assetId.value }, assetStats: { id: assetId.value, stats: { ...stats.value } } })
  } else emit('save', { slot: { hero: heroId.value, stats: { ...stats.value } } })
}
</script>

<style scoped>
.sle-wrap { position: fixed; inset: 0; z-index: 140; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(5, 4, 2, .65); backdrop-filter: blur(2px); }
.sle { width: min(560px, 100%); max-height: calc(100vh - 32px); display: flex; flex-direction: column; border-radius: 16px; background: linear-gradient(170deg, #241c13, #16110c); border: 1px solid #6e4f22; box-shadow: 0 0 0 3px #1a140e, 0 24px 60px rgba(0, 0, 0, .7); color: var(--a-text); font: 500 13px var(--a-sans); animation: rise .2s ease-out; }
header { display: flex; justify-content: space-between; align-items: flex-start; padding: 14px 18px 8px; border-bottom: 1px solid var(--a-line); }
header small { display: block; font: 800 10.5px var(--a-sans); letter-spacing: .1em; text-transform: uppercase; color: var(--a-muted); }
header b { font: 700 22px var(--a-serif); color: var(--a-gold-2); }
.x { border: 0; background: none; color: var(--a-muted); font-size: 26px; line-height: 1; cursor: pointer; }
.body { flex: 1; overflow-y: auto; overflow-x: hidden; padding: 12px 18px; display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; align-content: start; }
.preview { display: flex; justify-content: center; padding: 6px; border-radius: 12px; background: rgba(0, 0, 0, .2); }
.preview > * { max-width: 300px; }
.seg { display: flex; gap: 4px; padding: 3px; border-radius: 11px; background: rgba(0, 0, 0, .3); }
.seg button { flex: 1; height: 32px; border: 0; border-radius: 8px; background: none; color: var(--a-muted); font: 700 12.5px var(--a-sans); cursor: pointer; }
.seg button.on { background: rgba(231, 197, 111, .18); color: var(--a-gold-2); }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { --fc: #c9b88f; display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px 4px 4px; border-radius: 99px; border: 1px solid rgba(255, 255, 255, .12); background: rgba(255, 255, 255, .04); color: var(--a-text); font: 700 12.5px var(--a-sans); cursor: pointer; }
.chip i { width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; background: var(--fc); color: #1b140c; font: 700 12px var(--a-serif); font-style: normal; }
.chip em { font-style: normal; color: var(--a-muted); font-weight: 600; font-size: 11px; }
.chip.on { border-color: #e6c27a; background: rgba(231, 197, 111, .15); }
.chip.none { opacity: .4; cursor: not-allowed; }
.count { display: flex; align-items: center; gap: 8px; }
.count span { font-weight: 700; color: var(--a-muted); font-size: 12px; }
.count input[type=range] { flex: 1; min-width: 60px; accent-color: #e6c27a; }
input, select { box-sizing: border-box; width: 100%; min-width: 0; min-height: 32px; padding: 4px 8px; border-radius: 8px; border: 1px solid #6e4f22; background: #120e09; color: var(--a-text); font: 600 13px var(--a-sans); }
input:focus, select:focus { outline: none; border-color: #e6c27a; }
.num { width: 64px; flex: none; }
fieldset { margin: 0; padding: 8px 12px 12px; border: 1px solid var(--a-line); border-radius: 12px; }
fieldset.miss { border-color: rgba(255, 179, 107, .6); background: rgba(255, 179, 107, .05); }
legend { padding: 0 6px; font: 700 15px var(--a-serif); color: var(--a-gold-2); }
legend small { font: 600 11px var(--a-sans); color: var(--a-muted); margin-left: 4px; }
.miss legend small { color: #ffb36b; }
.stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.stats label, .tal-row label, .full { display: grid; gap: 3px; font-size: 11px; font-weight: 800; color: var(--a-muted); }
label.atk { color: #ff9b8f; } label.def { color: #8fc7ff; } label.hp { color: #9be07a; } label.ini { color: #ffe08a; }
.tal { padding: 8px 12px; border-radius: 12px; border: 1px dashed rgba(255, 224, 138, .35); }
.tal summary { cursor: pointer; font-weight: 800; color: #ffe08a; }
.tal summary small { color: var(--a-muted); font-weight: 600; }
.tal-row { display: grid; grid-template-columns: 1fr repeat(4, 50px) 26px; gap: 4px; align-items: end; margin-top: 6px; }
.tal-row input { padding: 3px 5px; min-height: 28px; }
.row { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 6px; }
.card { display: grid; justify-items: center; gap: 3px; padding: 8px 4px; border-radius: 12px; border: 1px solid rgba(255, 255, 255, .1); background: rgba(255, 255, 255, .03); color: var(--a-text); font: 600 12px var(--a-sans); cursor: pointer; text-align: center; }
.card.on { border-color: #b77aff; background: rgba(183, 122, 255, .12); }
.card.dead { opacity: .4; }
.card b { font-size: 12.5px; }
.card small { color: var(--a-muted); font-size: 10.5px; }
.cface { width: 44px; height: 44px; border-radius: 50%; overflow: hidden; display: grid; place-items: center; background: #b77aff; color: #1b140c; font: 700 18px var(--a-serif); border: 2px solid #fff3d6; }
.cface img { width: 100%; height: 100%; object-fit: cover; }
.mini { flex: none; padding: 4px 10px; border-radius: 8px; border: 1px solid var(--a-line); background: rgba(231, 197, 111, .08); color: var(--a-gold-2); font: 700 12px var(--a-sans); cursor: pointer; }
.mini:disabled { opacity: .4; }
.warn { padding: 8px 10px; border-radius: 10px; background: rgba(255, 179, 107, .08); color: #ffcf9b; font-size: 12.5px; font-weight: 700; }
footer { display: flex; gap: 8px; align-items: center; padding: 10px 18px 14px; border-top: 1px solid var(--a-line); }
.grow { flex: 1; }
footer button { height: 34px; padding: 0 14px; border-radius: 9px; border: 1px solid var(--a-line); background: rgba(255, 255, 255, .05); color: var(--a-text); font: 700 12.5px var(--a-sans); cursor: pointer; }
footer .primary { background: linear-gradient(180deg, #f0d083, #c9a24f); color: #1b1408; border: 0; }
footer .primary:disabled { opacity: .5; }
footer .danger { color: #ff9b8f; border-color: rgba(255, 107, 94, .4); }
@keyframes rise { from { opacity: 0; transform: translateY(12px); } }
@media (max-width: 480px) { .body { padding: 10px 12px; } .count span { display: none; } .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); } .tal-row { grid-template-columns: 1fr 1fr; } .tal-row .note { grid-column: 1 / -1; } }
</style>
