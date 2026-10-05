<template>
  <section class="bcard">
    <button class="x" aria-label="Закрыть" @click="$emit('close')">×</button>
    <template v-if="sel.kind === 'building'">
      <div class="bc-top">
        <img :src="`/settlement/${def.icon}.png`" alt="" :style="{ borderColor: cat?.color }" />
        <div>
          <b>{{ item.name || def.label }}</b>
          <small>{{ item.name ? def.label + ' · ' : '' }}{{ cat?.label }} · {{ SIZES[def.size]?.label }}<template v-if="def.cost"> · сложность {{ def.cost }}</template></small>
        </div>
      </div>
      <div class="rows">
        <div v-if="owner"><span>Владелец</span><b>{{ owner.name }}</b></div>
        <div v-for="(n, j) in def.jobs || {}" :key="j"><span>{{ JOBS[j].label }}</span><b>{{ n }} мест · всего занято {{ calc.jobs[j]?.workers || 0 }} из {{ calc.jobs[j]?.places || 0 }}</b></div>
        <div v-if="def.housing"><span>Жильё</span><b>{{ def.housing }} жильцов</b></div>
        <div v-if="def.guests"><span>Гостевые места</span><b>{{ def.guests }}</b></div>
        <div v-if="def.trade"><span>Торговые места</span><b>{{ def.trade }}</b></div>
        <div v-if="def.defense"><span>Защита</span><b>+{{ def.defense }}</b></div>
        <div v-for="(v, k) in def.gain || {}" :key="'g' + k"><span>Даёт</span><b class="plus">{{ RES[k]?.label }} +{{ v }}/день</b></div>
        <div v-for="(v, k) in def.use || {}" :key="'u' + k"><span>Тратит</span><b class="minus">{{ RES[k]?.label }} −{{ v }}/день</b></div>
      </div>
    </template>
    <template v-else>
      <div class="bc-top">
        <img :src="`/settlement/${OUTPOSTS[item.type]?.icon}.png`" alt="" class="op" />
        <div>
          <b>Аванпост «{{ OUTPOSTS[item.type]?.label }}»</b>
          <small v-if="item.state === 'depleting'" class="dep">вырабатывается — скоро закроется</small>
          <small v-else>работает</small>
        </div>
      </div>
      <div class="rows">
        <div><span>Рабочие</span><b>{{ item.workers }} из {{ item.places }}</b></div>
        <div><span>Специалист</span><b>{{ item.specialist || '—' }}</b></div>
        <div v-for="(v, k) in item.yields || {}" :key="k"><span>Добыча</span><b class="plus">{{ RES[k]?.label }} +{{ v }}/день</b></div>
      </div>
    </template>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { store } from '../map/store.js'
import { BUILDINGS, CATEGORIES, SIZES, JOBS, OUTPOSTS, RES } from '../shared/settlement.js'

const props = defineProps({ settlement: Object, calc: Object, sel: Object, item: Object })
defineEmits(['close'])
const def = computed(() => BUILDINGS[props.item.type] || {})
const cat = computed(() => CATEGORIES[def.value.cat])
const owner = computed(() => props.item.owner && store.data.heroes?.find(h => h.id === props.item.owner))
</script>

<style scoped>
.bcard { position: relative; margin-top: 12px; padding: 12px 14px; border-radius: 14px; background: rgba(231, 197, 111, .07); border: 1px solid rgba(231, 197, 111, .35); animation: pop .2s ease-out; }
.x { position: absolute; top: 6px; right: 8px; border: 0; background: none; color: var(--a-muted); font-size: 24px; line-height: 1; cursor: pointer; }
.bc-top { display: flex; gap: 12px; align-items: center; padding-right: 20px; }
.bc-top img { width: 48px; height: 48px; padding: 5px; border-radius: 10px; background: #d6d2c8; border: 2px solid #8a6630; }
.bc-top img.op { background: #cfc6b2; }
.bc-top b { display: block; font: 700 21px var(--a-serif); color: var(--a-gold-2); }
.bc-top small { color: #b9ab8a; font-size: 12px; font-weight: 600; }
.bc-top small.dep { color: #ff9b4a; }
.rows { display: grid; gap: 3px; margin-top: 10px; font-size: 12.5px; }
.rows div { display: flex; justify-content: space-between; gap: 10px; }
.rows span { color: var(--a-muted); }
.rows b { color: var(--a-text); text-align: right; }
.plus { color: #9be07a !important; } .minus { color: #ff9b8f !important; }
@keyframes pop { from { opacity: 0; transform: translateY(-4px); } }
</style>
