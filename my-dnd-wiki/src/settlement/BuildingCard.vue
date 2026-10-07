<template>
  <section class="bcard">
    <button class="x" aria-label="Закрыть" @click="$emit('close')">×</button>
    <template v-if="sel.kind === 'building'">
      <div class="bc-top">
        <img :src="`/settlement/${def.icon}.png`" alt="" :style="{ borderColor: cat?.color }" />
        <div>
          <b>{{ item.name || def.label }}</b>
          <small>{{ item.name ? def.label + ' · ' : '' }}{{ cat?.label }} · {{ SIZES[def.size]?.label }}{{ SIZES[def.size]?.area ? ' (' + SIZES[def.size].area + ')' : '' }}<template v-if="def.cost"> · сложность {{ def.cost }}</template></small>
        </div>
      </div>
      <div class="rows">
        <div v-if="item.x == null && def.size !== 'settlement'" class="unplaced"><span>На карте</span><b>не расставлена</b></div>
        <div v-if="owner"><span>Владелец</span><router-link class="hero" :to="{ path: '/wiki', query: { hero: owner.id } }" title="Карточка героя">{{ owner.name }}</router-link></div>
        <div v-if="item.state === 'construction'"><span>Стройка</span><b>{{ Math.floor(item.progress || 0) }} из {{ def.cost }}</b></div>
        <div v-if="def.price && !def.personal" class="price-row"><span>Цена</span><PriceChips :price="def.price" /></div>
        <div v-for="(n, j) in def.jobs || {}" :key="j"><span>{{ JOBS[j].label }}</span><b>{{ n }} мест · всего занято {{ calc.jobs[j]?.workers || 0 }} из {{ calc.jobs[j]?.places || 0 }}</b></div>
        <div v-if="def.housing"><span>Жильё</span><b>{{ def.housing }} жильцов</b></div>
        <div v-if="def.guests"><span>Гостевые места</span><b>{{ def.guests }}</b></div>
        <div v-if="def.trade"><span>Торговые места</span><b>{{ def.trade }}</b></div>
        <div v-if="def.defense"><span>Защита</span><b>+{{ def.defense }}</b></div>
        <div v-for="(v, k) in def.gain || {}" :key="'g' + k"><span>Даёт</span><b class="plus">{{ RES[k]?.label }} +{{ v }}/день</b></div>
        <div v-for="(v, k) in def.use || {}" :key="'u' + k"><span>Тратит</span><b class="minus">{{ RES[k]?.label }} −{{ v }}/день</b></div>
      </div>
    </template>
    <template v-else-if="sel.kind === 'road'">
      <div class="bc-top">
        <i class="road-ico" :class="item.type" />
        <div>
          <b>{{ item.name || ROAD_TYPES[item.type]?.label }}</b>
          <small>{{ item.name ? ROAD_TYPES[item.type]?.label + ' · ' : '' }}ширина {{ String(ROAD_TYPES[item.type]?.w).replace('.', ',') }} м</small>
        </div>
      </div>
      <div class="rows">
        <div><span>Длина</span><b>{{ roadLength }}</b></div>
        <div><span>Точек</span><b>{{ item.points.length }}</b></div>
      </div>
    </template>
    <template v-else>
      <div class="bc-top">
        <img :src="`/settlement/${OUTPOSTS[item.type]?.icon}.png`" alt="" class="op" />
        <div>
          <b>Аванпост «{{ OUTPOSTS[item.type]?.label }}»</b>
          <small v-if="item.state === 'depleting'" class="dep">вырабатывается — скоро закроется</small>
          <small v-else>работает · {{ fmtLen(Math.hypot(item.x - CENTER, item.y - CENTER)) }} от поселения</small>
        </div>
      </div>
      <div class="rows">
        <div><span>Рабочие</span><b>{{ item.workers }} из {{ item.places }}</b></div>
        <div><span>Специалист</span><b>{{ item.specialist || '—' }}</b></div>
        <div v-for="(v, k) in item.yields || {}" :key="k"><span>Добыча</span><b class="plus">{{ RES[k]?.label }} +{{ v }}/день</b></div>
      </div>
    </template>

    <!-- правка мастером -->
    <div v-if="master" class="edit">
      <template v-if="sel.kind === 'building'">
        <label>Название <input v-model="form.name" :placeholder="def.label" /></label>
        <label>Владелец <select v-model="form.owner"><option :value="undefined">—</option><option v-for="h in heroes" :key="h.id" :value="h.id">{{ h.name }}</option></select></label>
        <label>Состояние
          <select v-model="form.state"><option value="built">построено</option><option value="construction">стройка</option></select>
        </label>
        <label v-if="form.state === 'construction'">Готовность <input v-model.number="form.progress" type="number" min="0" :max="def.cost" /> / {{ def.cost }}</label>
      </template>
      <template v-else-if="sel.kind === 'road'">
        <label>Название <input v-model="form.name" placeholder="например, Старый тракт" /></label>
        <label>Вид <select v-model="form.type"><option v-for="(r, k) in ROAD_TYPES" :key="k" :value="k">{{ r.label }}</option></select></label>
        <p class="tip">Тяни точки на карте; за середину отрезка — новая точка; двойной щелчок по точке — убрать.</p>
      </template>
      <template v-else>
        <label>Тип <select v-model="form.type"><option v-for="(o, k) in OUTPOSTS" :key="k" :value="k">{{ o.label }}</option></select></label>
        <label>Рабочие <input v-model.number="form.workers" type="number" min="0" /> из <input v-model.number="form.places" type="number" min="0" /></label>
        <label>Специалист <input v-model="form.specialist" /></label>
        <label>Состояние <select v-model="form.state"><option value="active">работает</option><option value="depleting">вырабатывается</option><option value="closed">закрыт</option></select></label>
        <div class="yields">
          <small>Добыча в день</small>
          <div v-for="(y, i) in yieldRows" :key="i" class="yrow">
            <select v-model="y.res"><option v-for="r in RESOURCES" :key="r.key" :value="r.key">{{ r.label }}</option></select>
            <input v-model.number="y.value" type="number" />
            <button class="mini" @click="yieldRows.splice(i, 1)">×</button>
          </div>
          <button class="mini" @click="yieldRows.push({ res: 'wood', value: 10 })">+ ресурс</button>
        </div>
      </template>
      <div class="btns">
        <button class="primary" @click="save">Сохранить</button>
        <template v-if="sel.kind === 'building'">
          <button v-if="item.x == null && def.size !== 'settlement'" @click="$emit('place', item)">Поставить на карту</button>
          <button v-else-if="def.size !== 'settlement'" title="Постройка останется в списке «не расставлены» и продолжит считаться" @click="$emit('remove', 'building', item.id, 'unplace')">Убрать с карты</button>
          <button class="danger" @click="$emit('remove', 'building', item.id)">Снести</button>
        </template>
        <button v-else class="danger" @click="$emit('remove', sel.kind, item.id)">{{ sel.kind === 'road' ? 'Удалить' : 'Убрать' }}</button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { store } from '../map/store.js'
import PriceChips from './PriceChips.vue'
import { BUILDINGS, CATEGORIES, SIZES, JOBS, OUTPOSTS, RES, RESOURCES, ROAD_TYPES } from '../shared/settlement.js'
import { CENTER } from '../shared/terrainGen.js'

const props = defineProps({ settlement: Object, calc: Object, sel: Object, item: Object, master: Boolean })
const emit = defineEmits(['close', 'save', 'remove', 'place'])
const heroes = computed(() => store.data.heroes || [])
const form = ref({})
const yieldRows = ref([])
watch(() => props.item, it => {
  form.value = JSON.parse(JSON.stringify(it))
  yieldRows.value = Object.entries(it.yields || {}).map(([res, value]) => ({ res, value }))
}, { immediate: true })
function save() {
  const f = { ...form.value }
  if (props.sel.kind === 'road') {
    if (!f.name) delete f.name
  } else if (props.sel.kind === 'building') {
    if (!f.name) delete f.name
    if (!f.owner) delete f.owner
    if (f.state === 'built') delete f.progress
  } else f.yields = Object.fromEntries(yieldRows.value.filter(y => y.value).map(y => [y.res, y.value]))
  emit('save', props.sel.kind, f)
}
const def = computed(() => BUILDINGS[props.item.type] || {})
const fmtLen = m => (m >= 1000 ? `${(m / 1000).toFixed(1).replace('.', ',')} км` : `${Math.round(m)} м`)
const roadLength = computed(() => fmtLen((props.item.points || []).reduce((n, p, i, a) => (i ? n + Math.hypot(p[0] - a[i - 1][0], p[1] - a[i - 1][1]) : 0), 0)))
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
.rows .hero { color: var(--a-gold-2); font-weight: 800; text-decoration: underline dotted; text-underline-offset: 3px; }
.rows .price-row { align-items: flex-start; }
.rows .price-row .price { justify-content: flex-end; }
.plus { color: #9be07a !important; } .minus { color: #ff9b8f !important; }
.edit { display: grid; gap: 6px; margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--a-line); font-size: 12.5px; }
.edit label { display: flex; align-items: center; gap: 6px; color: var(--a-muted); font-weight: 700; }
.edit input, .edit select { flex: 1; min-width: 0; padding: 4px 7px; border-radius: 7px; border: 1px solid var(--a-line-2); background: rgba(0, 0, 0, .3); color: var(--a-text); font: 600 12.5px var(--a-sans); }
.edit input[type=number] { flex: 0 0 64px; }
.yields small { color: var(--a-muted); font-weight: 800; }
.yrow { display: flex; gap: 5px; margin: 3px 0; }
.mini { padding: 3px 8px; border-radius: 7px; border: 1px solid var(--a-line); background: rgba(231, 197, 111, .08); color: var(--a-gold-2); font: 700 12px var(--a-sans); cursor: pointer; }
.btns { display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end; }
.rows .unplaced b { color: #ffb36b; }
.tip { margin: 0; color: var(--a-muted); font-size: 11.5px; }
.road-ico { width: 48px; height: 14px; border-radius: 4px; background: #a3835a; box-shadow: 0 0 0 2px #6b5235; flex: none; }
.road-ico.trail { height: 3px; background: repeating-linear-gradient(90deg, #cdb17c 0 7px, transparent 7px 11px); box-shadow: none; }
.road-ico.tract { height: 18px; background: linear-gradient(#977652 30%, #7b5d3c 30% 42%, #977652 42% 58%, #7b5d3c 58% 70%, #977652 70%); box-shadow: 0 0 0 2px #5e472c; }
.road-ico.paved { background: repeating-linear-gradient(90deg, #9a958a 0 4px, #b6b1a5 4px 5px); box-shadow: 0 0 0 2px #4c4a45; }
.road-ico.bridge { background: repeating-linear-gradient(90deg, #a77d4c 0 4px, #7a5a34 4px 5px); box-shadow: 0 0 0 3px #3b2a18; }
.btns button { padding: 6px 12px; border-radius: 9px; border: 1px solid var(--a-line); background: rgba(255, 255, 255, .05); color: var(--a-text); font: 700 12.5px var(--a-sans); cursor: pointer; }
.btns .primary { background: linear-gradient(180deg, #f0d083, #c9a24f); color: #1b1408; border: 0; }
.btns .danger { color: #ff9b8f; border-color: rgba(255, 107, 94, .4); }
@keyframes pop { from { opacity: 0; transform: translateY(-4px); } }
</style>
