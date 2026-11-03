<template>
  <div class="mc">
    <template v-if="m?.move && st">
      <div class="mc-h"><span>{{ m.move.exit ? 'Идёт к краю округи' : 'Идёт по округе' }} · {{ m.move.label }}</span><b>{{ Math.round(st.progress * 100) }}%</b></div>
      <div class="mc-bar"><i :style="{ width: st.progress * 100 + '%' }" /></div>
      <div class="mc-n">прибудет {{ fmtDateTime(m.move.startAt + total) }} · ещё {{ fmtDuration(st.left) }}</div>
    </template>
    <div v-else-if="m && !m.away" class="mc-n">стоит в округе{{ where ? ' — ' + where : '' }}</div>
    <div v-if="can && !world" class="mc-btns">
      <button class="mini go" :disabled="!squad.commander" :title="squad.commander ? 'Щёлкай точки на карте поселения' : 'Сначала назначь командира'" @click="$emit('lead', squad.id)">🧭 Вести по округе</button>
      <button v-if="m && !m.away && !m.move?.home" class="mini" :disabled="busy" title="Сам найдёт путь к дому главы, по дорогам" @click="run(marchHome)">⌂ Домой</button>
      <button v-if="!m?.move?.exit" class="mini" :disabled="!squad.commander || busy" title="К ближайшему краю округи — дойдя, выйдет на карту мира (как в RimWorld)" @click="run(marchOut)">⇱ На карту мира</button>
      <button v-if="m?.move" class="mini danger" @click="haltMarch(settlement, squad.id)">⏹ Стой</button>
      <button v-if="m?.move && master" class="mini" title="Мастеру: отряд сразу оказывается у цели" @click="arriveNow(settlement, squad.id)">⏩ Прибыть сейчас</button>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { store, isMaster, fmtDateTime, fmtDuration } from '../map/store.js'
import { homeOf } from '../shared/march.js'
import { squadAt, spotLabel, onWorld, marchHome, marchOut, haltMarch, arriveNow } from './march.js'

const props = defineProps({ settlement: Object, squad: Object, can: Boolean })
const master = isMaster
defineEmits(['lead'])
const m = computed(() => props.settlement.marches?.[props.squad.id] || null)
const st = computed(() => (m.value?.move ? squadAt(props.settlement, props.squad.id, store.now) : null))
const total = computed(() => m.value?.move?.cum?.at(-1) || 0)
const world = computed(() => onWorld(props.settlement, props.squad))
const where = computed(() => {
  if (!m.value || m.value.move) return ''
  const p = [m.value.x, m.value.y]
  const h = homeOf(props.settlement), d = Math.hypot(p[0] - h[0], p[1] - h[1])
  return spotLabel(props.settlement, p).replace('Домой', 'у дома главы') || `${d >= 1000 ? (d / 1000).toFixed(1).replace('.', ',') + ' км' : Math.round(d) + ' м'} от дома главы`
})
// поиск пути — пара десятков мс; кнопку на это время гасим
const busy = ref(false)
async function run(fn) {
  busy.value = true
  await new Promise(r => setTimeout(r, 20))
  try { await fn(props.settlement, props.squad.id) } finally { busy.value = false }
}
</script>

<style scoped>
.mc { display: flex; flex-direction: column; gap: 5px; }
.mc-h { display: flex; justify-content: space-between; gap: 8px; font-size: 12.5px; font-weight: 700; color: #dcebb8; }
.mc-h b { color: #c7e07a; }
.mini { padding: 4px 9px; border-radius: 8px; border: 1px solid var(--a-line); background: rgba(231, 197, 111, .08); color: var(--a-gold-2); font: 700 12px var(--a-sans); cursor: pointer; }
.mini.danger { color: #ff9b8f; border-color: rgba(255, 107, 94, .4); }
.mini.go { background: linear-gradient(180deg, #f0d083, #c9a24f); color: #1b1408; border: 0; }
.mini:disabled { opacity: .45; cursor: not-allowed; }
.mc-bar { height: 6px; border-radius: 3px; background: rgba(255, 255, 255, .08); overflow: hidden; }
.mc-bar i { display: block; height: 100%; background: linear-gradient(90deg, #6a8f2f, #c7e07a); }
.mc-n { font-size: 12px; color: var(--a-muted); }
.mc-btns { display: flex; flex-wrap: wrap; gap: 6px; }
</style>
