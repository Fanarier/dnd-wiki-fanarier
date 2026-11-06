<template>
  <section class="bcard">
    <button class="x" aria-label="Закрыть" @click="$emit('close')">×</button>
    <template v-if="sel.kind === 'building'">
      <div class="bc-top">
        <img :src="iconSrc(def.icon)" alt="" :style="{ borderColor: cat?.color }" />
        <div>
          <b>{{ item.name || def.label }}</b>
          <small>{{ item.name ? def.label + ' · ' : '' }}<template v-if="def.maxLevel > 1">уровень {{ def.level }} из {{ def.maxLevel }} · </template>{{ cat?.label }} · {{ SIZES[def.size]?.label }}{{ SIZES[def.size]?.area ? ' (' + SIZES[def.size].area + ')' : '' }}<template v-if="def.cost"> · сложность {{ def.cost }}</template></small>
        </div>
      </div>
      <div class="rows">
        <div v-if="item.x == null && def.size !== 'settlement'" class="unplaced"><span>На карте</span><b>не расставлена</b></div>
        <div v-if="owner"><span>Владелец</span><router-link class="hero" :to="{ path: '/wiki', query: { hero: owner.id } }" title="Карточка героя">{{ owner.name }}</router-link></div>
        <div v-if="item.state === 'construction'"><span>Стройка</span><b>{{ Math.floor(item.progress || 0) }} из {{ BUILDINGS[item.type]?.cost }}{{ etaText }}</b></div>
        <!-- состояние: целое или повреждено; ремонт -->
        <template v-else>
          <div><span>Состояние</span><b v-if="!dmg" class="plus">целое</b><b v-else class="dmg-badge" :style="{ '--dc': dmg.color }">{{ dmg.label }}</b></div>
          <div v-if="dmg" class="dmg-note">{{ dmg.hint }}{{ dmg.work ? ` · работает на ${Math.round(dmg.work * 100)}%: места, жильё, выработка, защита` : '' }}</div>
          <div v-if="item.repair && dmg"><span>{{ ruined ? 'Отстраивают' : 'Ремонт' }}</span><b>{{ Math.floor(item.repair.progress || 0) }} из {{ repairWork(item) }}{{ etaText }}</b></div>
          <template v-else-if="dmg">
            <div class="price-row"><span>{{ ruined ? 'Отстроить' : 'Ремонт' }}</span><PriceChips :price="repairPrice(item)" :stock="settlement.stock || {}" /></div>
            <div><span>Работы</span><b>{{ repairWork(item) }} очков стройки — назначь строителей, когда начнут</b></div>
            <div v-if="master || decider" class="repair-btns">
              <template v-if="master">
                <label class="chk"><input v-model="repairPay" type="checkbox" /> со склада</label>
                <button class="go" @click="$emit('repair', item.id, { pay: repairPay })">{{ ruined ? 'Отстроить' : 'Начать ремонт' }}</button>
                <button @click="$emit('repair', item.id, { instant: true })">Починить сразу</button>
              </template>
              <span v-else-if="repairOrdered" class="muted">приказ на ремонт ждёт мастера</span>
              <button v-else class="go" @click="$emit('order-repair', item)">Приказ: {{ ruined ? 'отстроить' : 'починить' }}</button>
            </div>
          </template>
        </template>
        <!-- улучшение до следующего уровня -->
        <template v-if="item.upgrade">
          <div><span>Улучшают до</span><b>{{ nextTier?.label || 'уровня ' + item.upgrade.to }} · {{ Math.floor(item.upgrade.progress || 0) }} из {{ upgradeWork(item.type, item.upgrade.to) }}{{ etaText }}</b></div>
          <div v-if="master" class="repair-btns">
            <button @click="upgrade({ cancel: true })">Отменить{{ item.upgrade.paid ? ' (вернуть на склад)' : '' }}</button>
            <button class="go" @click="upgrade({ instant: true })">Улучшить сразу</button>
          </div>
        </template>
        <template v-else-if="nextTier && item.state !== 'construction'">
          <div class="up-next"><span>Следующий уровень</span><b>{{ nextTier.label }}</b></div>
          <div v-if="nextTier.note" class="dmg-note">{{ nextTier.note }}</div>
          <div class="price-row"><span>Цена улучшения</span><PriceChips :price="upgradePrice(item.type, def.level + 1)" :stock="settlement.stock || {}" /></div>
          <div><span>Работы</span><b>{{ upgradeWork(item.type, def.level + 1) }} очков стройки</b></div>
          <div v-if="upBlock" class="dmg-note">{{ upBlock }}</div>
          <div v-else-if="master || decider" class="repair-btns">
            <template v-if="master">
              <label class="chk"><input v-model="upgradePay" type="checkbox" /> со склада</label>
              <button class="go" @click="upgrade({ pay: upgradePay })">Улучшить</button>
              <button @click="upgrade({ instant: true })">Сразу</button>
            </template>
            <span v-else-if="upgradeOrdered" class="muted">приказ на улучшение ждёт мастера</span>
            <button v-else class="go" @click="orderUpgrade">Приказ: улучшить</button>
          </div>
        </template>
        <!-- строители на площадке -->
        <div v-if="worksite" class="crew">
          <div class="crew-h"><span>Строители</span><b>{{ rate.pts ? `${fmt(rate.pts)} очков в день` : 'никого — стройка стоит' }}</b></div>
          <template v-if="master || decider">
            <div v-for="r in crewRaces" :key="r.race" class="crew-r" :title="RACES[r.race]?.buildNote || ''">
              <span>{{ RACES[r.race]?.label }} <em>×{{ fmt(RACES[r.race]?.build ?? 4) }}{{ RACES[r.race]?.buildMorale && calc.morale > RACES[r.race].buildMorale.above ? ` +${RACES[r.race].buildMorale.pct}%` : '' }}</em></span>
              <span class="step">
                <button type="button" :disabled="!crew[r.race]" @click="bump(r.race, -1)">−</button>
                <input v-model.number="crew[r.race]" type="number" min="0" :max="r.adults" />
                <button type="button" :disabled="crewLeft <= 0" @click="bump(r.race, 1)">+</button>
              </span>
            </div>
            <div class="crew-f">
              <small :class="{ bad: crewLeft < 0 }">свободных жителей: {{ crewLeft }}</small>
              <button class="go" :disabled="!crewChanged || crewLeft < 0" @click="saveCrew">Назначить</button>
            </div>
          </template>
          <div v-else-if="rate.parts.length" class="crew-list">{{ rate.parts.map(p => `${RACES[p.race]?.label} ${p.n}`).join(', ') }}</div>
          <small class="tip">Каждая раса строит по-своему (вкладка «Постройки»); слесари ускоряют{{ rate.speedUp ? ` (+${Math.round(rate.speedUp)}%)` : '' }}{{ rate.slow < 1 ? ', без стройматериалов — вчетверо медленнее' : '' }}.</small>
        </div>
        <div v-if="def.price && !def.personal && item.state === 'construction'" class="price-row"><span>Цена</span><PriceChips :price="def.price" /></div>
        <div v-if="def.gov"><span>Управление</span><b>управляющих {{ def.gov.managers }} · аванпостов {{ def.gov.outposts }} · постройки до {{ def.gov.maxLevel }} ур.</b></div>
        <div v-for="(v, k) in def.perm || {}" :key="'p' + k"><span>Постоянно</span><b :class="(k === 'threat' ? -v : v) > 0 ? 'plus' : 'minus'">{{ PERM[k] }} {{ v > 0 ? '+' : '−' }}{{ Math.abs(v) }}</b></div>
        <div v-for="(n, j) in def.jobs || {}" :key="j"><span>{{ JOBS[j]?.label || j }}</span><b>{{ cut(n) }} мест · всего занято {{ calc.jobs[j]?.workers || 0 }} из {{ calc.jobs[j]?.places || 0 }}</b></div>
        <div v-for="(n, j) in def.spec || {}" :key="'s' + j"><span>Специалисты</span><b>{{ JOBS[j]?.label || j }}: +{{ n }}</b></div>
        <div v-if="def.housing"><span>Жильё</span><b>{{ cut(def.housing) }} жильцов</b></div>
        <div v-if="def.guests"><span>Гостевые места</span><b>{{ cut(def.guests) }}</b></div>
        <div v-if="def.trade"><span>Торговые места</span><b>{{ cut(def.trade) }}</b></div>
        <div v-if="def.defense"><span>Защита</span><b>+{{ cut(def.defense) }}</b></div>
        <div v-for="(v, k) in def.gain || {}" :key="'g' + k"><span>Даёт</span><b class="plus">{{ RES[k]?.label }} +{{ cut(v, true) }}/день</b></div>
        <div v-for="(v, k) in def.use || {}" :key="'u' + k"><span>Тратит</span><b class="minus">{{ RES[k]?.label }} −{{ cut(v, true) }}/день</b></div>
        <div v-if="def.note && !nextTier" class="dmg-note">{{ def.note }}</div>
        <div v-else-if="def.note" class="dmg-note">Сейчас: {{ def.note }}</div>
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
    <template v-else-if="sel.kind === 'wall'">
      <div class="bc-top">
        <i class="wall-ico" :class="item.type" />
        <div>
          <b>{{ item.name || WALL_TYPES[item.type]?.label }}</b>
          <small>{{ item.name ? WALL_TYPES[item.type]?.label + ' · ' : '' }}{{ fmtLen(wlen) }} · толщина {{ String(WALL_TYPES[item.type]?.w).replace('.', ',') }} м</small>
        </div>
      </div>
      <div class="rows">
        <div><span>Готовность</span><b :class="{ minus: wbuilt < wlen - 0.1 }">{{ wbuilt >= wlen - 0.1 ? 'построена' : `${fmtLen(wbuilt)} из ${fmtLen(wlen)}` }}</b></div>
        <div><span>Защита</span><b>+{{ wdef }}</b></div>
        <div class="price-row"><span>Цена всей стены</span><PriceChips :price="wallPrice(item.type, wlen)" /></div>
        <div v-if="!item.features?.length" class="muted-row"><span>Ворота, калитки, башни</span><b>нет</b></div>
        <div v-for="f in item.features || []" :key="f.id" class="feat-row">
          <span>{{ WALL_FEATURES[f.kind]?.label }} <em>· {{ fmtLen(f.s) }} от начала</em></span>
          <b>{{ f.state === 'construction' ? `строится ${Math.floor(f.progress || 0)}/${WALL_FEATURES[f.kind]?.work}` : 'готово' }}
            <button v-if="master" class="mini" :title="`Убрать: ${WALL_FEATURES[f.kind]?.label.toLowerCase()}`" @click="removeFeature(f)">×</button></b>
        </div>
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
        <label v-if="def.maxLevel > 1">Уровень
          <select v-model.number="form.level"><option v-for="(t, i) in BUILDINGS[item.type].tiers" :key="i" :value="i + 1">{{ i + 1 }} — {{ t.label }}</option></select>
        </label>
        <div v-if="item.state !== 'construction'" class="dmg-pick">
          <small>Повреждение — сразу, без «Сохранить»</small>
          <div>
            <button :class="{ on: !item.damage }" title="Целое" @click="setDamage(null)">целое</button>
            <button v-for="(d, k) in DAMAGE" :key="k" :class="{ on: item.damage === k }" :style="{ '--dc': d.color }" :title="d.label + ' — ' + d.hint" @click="setDamage(k)">{{ d.short }}</button>
          </div>
        </div>
        <label v-if="form.state === 'construction'">Готовность <input v-model.number="form.progress" type="number" min="0" :max="BUILDINGS[item.type]?.cost" /> / {{ BUILDINGS[item.type]?.cost }}</label>
      </template>
      <template v-else-if="sel.kind === 'road'">
        <label>Название <input v-model="form.name" placeholder="например, Старый тракт" /></label>
        <label>Вид <select v-model="form.type"><option v-for="(r, k) in ROAD_TYPES" :key="k" :value="k">{{ r.label }}</option></select></label>
        <p class="tip">Тяни саму дорогу — двигается целиком, примыкающие тянутся следом. Тяни точки (концы прилипают к другим дорогам). <b>Убрать точку</b> — правой кнопкой по ней, двойным щелчком или щёлкни и нажми Delete. Новая точка — потяни кружок между точками (появляется у курсора). Ctrl+Z — отменить.</p>
        <button type="button" class="mini" :disabled="item.points.length <= 2" @click="thin">✂ Убрать лишние точки ({{ item.points.length }})</button>
      </template>
      <template v-else-if="sel.kind === 'wall'">
        <label>Название <input v-model="form.name" placeholder="например, Северный частокол" /></label>
        <label>Вид <select v-model="form.type"><option v-for="(t, k) in WALL_TYPES" :key="k" :value="k">{{ t.label }}</option></select></label>
        <label>Построено <input v-model.number="form.built" type="number" min="0" :max="Math.ceil(wlen)" /> м из {{ Math.round(wlen) }}</label>
        <p class="tip">Тяни стену целиком или её точки. Убрать точку — правой кнопкой по ней, двойным щелчком или щёлкни и нажми Delete; новая точка — потяни кружок между точками. Стройка идёт от первой точки.</p>
        <button type="button" class="mini" :disabled="item.points.length <= 2" @click="thin">✂ Убрать лишние точки ({{ item.points.length }})</button>
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
          <button class="danger" @click="$emit('remove', 'building', item.id)">{{ ruined ? 'Расчистить руины' : 'Снести' }}</button>
        </template>
        <button v-else class="danger" @click="$emit('remove', sel.kind, item.id)">{{ sel.kind === 'road' ? 'Удалить' : sel.kind === 'wall' ? 'Снести' : 'Убрать' }}</button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { store, act, toast } from '../map/store.js'
import { simplifyLine } from '../shared/geo.js'
import PriceChips from './PriceChips.vue'
import { BUILDINGS, CATEGORIES, SIZES, JOBS, OUTPOSTS, RES, RACES, RESOURCES, ROAD_TYPES, DAMAGE, repairPrice, repairWork,
  tierOf, iconSrc, upgradePrice, upgradeWork, upgradeBlock, isWorksite, buildRate, worksiteLeft, priceText } from '../shared/settlement.js'
import { CENTER } from '../shared/terrainGen.js'
import { WALL_TYPES, WALL_FEATURES, wallLength, wallPrice, wallDefense } from '../shared/walls.js'

const props = defineProps({ settlement: Object, calc: Object, sel: Object, item: Object, master: Boolean, decider: Boolean })
const emit = defineEmits(['close', 'save', 'remove', 'place', 'repair', 'order-repair'])
const heroes = computed(() => store.data.heroes || [])
const form = ref({})
const yieldRows = ref([])
watch(() => props.item, it => {
  form.value = JSON.parse(JSON.stringify(it))
  yieldRows.value = Object.entries(it.yields || {}).map(([res, value]) => ({ res, value }))
}, { immediate: true })
function save() {
  const f = { ...form.value }
  if (props.sel.kind === 'road' || props.sel.kind === 'wall') {
    if (!f.name) delete f.name
  } else if (props.sel.kind === 'building') {
    if (!f.name) delete f.name
    if (!f.owner) delete f.owner
    if (f.state === 'built') delete f.progress
  } else f.yields = Object.fromEntries(yieldRows.value.filter(y => y.value).map(y => [y.res, y.value]))
  emit('save', props.sel.kind, f)
}
// постройка с её уровнем (поля уровня поверх постройки)
const def = computed(() => (props.sel.kind === 'building' ? tierOf(props.item) || {} : BUILDINGS[props.item.type] || {}))
const PERM = { threat: 'угроза', stability: 'стабильность', morale: 'мораль в день' }
const fmt = v => String(Math.round(v * 10) / 10).replace('.', ',')
const base = () => `/api/settlements/${props.settlement.id}`

/* улучшение */
const nextTier = computed(() => (props.sel.kind !== 'building' ? null : BUILDINGS[props.item.type]?.tiers?.[props.item.upgrade ? props.item.upgrade.to - 1 : def.value.level] || null))
const upBlock = computed(() => (props.sel.kind === 'building' && nextTier.value && !props.item.upgrade ? upgradeBlock(props.settlement, props.item, props.calc) : null))
const upgradePay = ref(true)
const upgrade = opt => act('POST', `${base()}/buildings/${props.item.id}/upgrade`, opt, opt.instant ? 'Улучшено' : opt.cancel ? 'Улучшение отменено' : 'Улучшение начато — назначь строителей').catch(() => null)
const upgradeOrdered = computed(() => (props.settlement.orders || []).some(o => o.status === 'pending' && o.upgrade?.id === props.item.id))
async function orderUpgrade() {
  const price = priceText(upgradePrice(props.item.type, def.value.level + 1))
  const text = prompt(`Приказ: улучшить «${props.item.name || def.value.label}» → ${nextTier.value.label}.${price ? `\nЦена: ${price}.` : ''}\nКомментарий для мастера (необязательно):`, '')
  if (text === null) return
  await act('POST', `${base()}/orders`, { kind: 'upgrade', building: props.item.id, text }, 'Приказ отправлен мастеру').catch(() => null)
}

/* строители: стройка, ремонт, улучшение */
const worksite = computed(() => props.sel.kind === 'building' && isWorksite(props.item))
const rate = computed(() => buildRate(props.settlement, props.item, props.calc))
const etaText = computed(() => {
  const left = worksiteLeft(props.item)
  return rate.value.pts ? ` · ещё ≈ ${Math.max(1, Math.ceil(left / rate.value.pts))} дн.` : ' · стоит без строителей'
})
const crewRaces = computed(() => (props.settlement.races || []).map(r => ({ race: r.race, adults: (r.male || 0) + (r.female || 0) })).filter(r => r.adults > 0))
const crew = ref({})
watch(() => props.item.builders, v => { crew.value = { ...(v || {}) } }, { immediate: true })
const crewSum = o => Object.values(o || {}).reduce((n, v) => n + (Number(v) || 0), 0)
const crewLeft = computed(() => props.calc.free + crewSum(props.item.builders) - crewSum(crew.value))
const crewChanged = computed(() => JSON.stringify(Object.fromEntries(Object.entries(crew.value).filter(([, v]) => v))) !== JSON.stringify(props.item.builders || {}))
function bump(race, d) { crew.value = { ...crew.value, [race]: Math.max(0, (crew.value[race] || 0) + d) } }
const saveCrew = () => act('POST', `${base()}/buildings/${props.item.id}/builders`, { builders: crew.value }, 'Строители назначены').catch(() => null)
const fmtLen = m => (m >= 1000 ? `${(m / 1000).toFixed(1).replace('.', ',')} км` : `${Math.round(m)} м`)
const roadLength = computed(() => fmtLen((props.item.points || []).reduce((n, p, i, a) => (i ? n + Math.hypot(p[0] - a[i - 1][0], p[1] - a[i - 1][1]) : 0), 0)))
const cat = computed(() => CATEGORIES[def.value.cat])
// повреждение и ремонт
const dmg = computed(() => (props.sel.kind === 'building' && props.item.damage ? DAMAGE[props.item.damage] : null))
const ruined = computed(() => props.item.damage === 'ruined')
const repairPay = ref(true)
// сколько даёт постройка сейчас: у повреждённой — меньше («6 из 10»)
function cut(n, frac = false) {
  const e = props.item.state === 'construction' ? 1 : dmg.value ? dmg.value.work : 1
  const v = frac ? Math.round(n * e * 10) / 10 : Math.round(n * e)
  return e < 1 ? `${String(v).replace('.', ',')} из ${n}` : n
}
const repairOrdered = computed(() => (props.settlement.orders || []).some(o => o.status === 'pending' && o.repair?.id === props.item.id))
function setDamage(level) {
  const b = { ...props.item }
  if (level) b.damage = level
  else delete b.damage
  emit('save', 'building', b)
}
// стена
const wlen = computed(() => (props.sel.kind === 'wall' ? wallLength(props.item.points || []) : 0))
const wbuilt = computed(() => Math.min(wlen.value, props.item.built ?? wlen.value))
const wdef = computed(() => (props.sel.kind === 'wall' ? wallDefense([props.item]) : 0))
function removeFeature(f) {
  if (!confirm(`Убрать «${WALL_FEATURES[f.kind]?.label}» со стены? Потраченное не вернётся.`)) return
  emit('save', 'wall', { ...props.item, features: props.item.features.filter(x => x.id !== f.id) })
}
const owner = computed(() => props.item.owner && store.data.heroes?.find(h => h.id === props.item.owner))
// убрать точки, которые почти не меняют форму (ближе 1,5 м к прямой между соседями)
function thin() {
  const pts = simplifyLine(props.item.points, props.sel.kind === 'wall' ? 0.6 : 1.5)
  if (pts.length === props.item.points.length) return toast('Лишних точек нет')
  emit('save', props.sel.kind, { ...props.item, points: pts })
  toast(`Точек было ${props.item.points.length}, стало ${pts.length} — Ctrl+Z вернёт`)
}
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
.wall-ico { width: 48px; height: 10px; flex: none; border-radius: 1px; background: repeating-linear-gradient(90deg, #b0844f 0 3px, #5a3c1e 3px 4px); box-shadow: 0 0 0 2px #2c1f12; }
.wall-ico.stone { height: 14px; background: repeating-linear-gradient(90deg, #c2bdb1 0 7px, #8f8b82 7px 11px); box-shadow: 0 0 0 2px #34322e; }
.rows .feat-row span em { font-style: normal; color: #7d6c4e; }
.rows .feat-row b { display: flex; align-items: center; gap: 6px; }
.rows .muted-row b { color: var(--a-muted); }
.dmg-badge { padding: 1px 8px; border-radius: 99px; background: color-mix(in srgb, var(--dc) 22%, transparent); border: 1px solid var(--dc); color: var(--dc) !important; }
.rows .dmg-note { display: block; color: #b9ab8a; font-size: 11.5px; font-style: italic; }
.repair-btns { display: flex !important; flex-wrap: wrap; align-items: center; justify-content: flex-end !important; gap: 6px !important; margin-top: 4px; }
.repair-btns button { padding: 5px 11px; border-radius: 9px; border: 1px solid var(--a-line); background: rgba(255, 255, 255, .05); color: var(--a-text); font: 700 12px var(--a-sans); cursor: pointer; }
.repair-btns .go { background: linear-gradient(180deg, #f0d083, #c9a24f); color: #1b1408; border: 0; }
.repair-btns .chk { display: flex; align-items: center; gap: 4px; color: var(--a-muted); font-weight: 700; font-size: 12px; }
.repair-btns .muted { color: var(--a-muted); font-style: italic; }
.crew { display: grid !important; gap: 4px !important; margin: 6px 0 2px; padding: 8px 10px; border-radius: 10px; background: rgba(0, 0, 0, .22); border: 1px solid rgba(231, 197, 111, .22); }
.crew-h, .crew-r, .crew-f { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.crew-h span { color: var(--a-gold-2) !important; font-weight: 800; }
.crew-r em { font-style: normal; color: #7d6c4e; font-size: 11.5px; }
.crew .step { display: flex; align-items: center; gap: 3px; }
.crew .step button { width: 24px; height: 24px; border-radius: 7px; border: 1px solid var(--a-line); background: rgba(255, 255, 255, .05); color: var(--a-text); font: 800 14px var(--a-sans); cursor: pointer; }
.crew .step button:disabled { opacity: .35; cursor: default; }
.crew .step input { width: 46px; padding: 3px 4px; border-radius: 7px; border: 1px solid var(--a-line-2); background: rgba(0, 0, 0, .3); color: var(--a-text); font: 700 12.5px var(--a-sans); text-align: center; }
.crew-f small { color: var(--a-muted); }
.crew-f small.bad { color: #ff9b8f; }
.crew-f .go, .crew .go { padding: 5px 11px; border-radius: 9px; border: 0; background: linear-gradient(180deg, #f0d083, #c9a24f); color: #1b1408; font: 700 12px var(--a-sans); cursor: pointer; }
.crew-f .go:disabled { opacity: .45; cursor: default; }
.crew-list { color: var(--a-text); }
.up-next b { color: var(--a-gold-2) !important; }
.dmg-pick { display: grid; gap: 4px; }
.dmg-pick small { color: var(--a-muted); font-weight: 800; }
.dmg-pick div { display: flex; flex-wrap: wrap; gap: 4px; }
.dmg-pick button { padding: 3px 9px; border-radius: 99px; border: 1px solid var(--dc, #7ee06a); background: transparent; color: var(--dc, #9be07a); font: 700 11.5px var(--a-sans); cursor: pointer; }
.dmg-pick button.on { background: var(--dc, #7ee06a); color: #1b140c; }
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
