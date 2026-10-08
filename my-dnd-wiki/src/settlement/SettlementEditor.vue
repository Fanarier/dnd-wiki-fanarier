<template>
  <div class="se-wrap" @click.self="$emit('close')">
    <section class="se" :class="{ big }">
      <header>
        <div><small>Правка мастера</small><h3>{{ TITLES[section] }}</h3></div>
        <button class="grow-btn" :title="big ? 'Сделать уже' : 'Развернуть шире — удобнее править'" @click="big = !big">{{ big ? '⤡ уже' : '⤢ шире' }}</button>
        <button class="x" aria-label="Закрыть" @click="$emit('close')">×</button>
      </header>

      <div class="se-body">
        <!-- ===== ОБЗОР ===== -->
        <template v-if="section === 'overview'">
          <div class="grid2">
            <label>Название<input v-model="f.name" /></label>
            <label>Тип поселения<input v-model="f.kind" list="se-kinds" /></label>
            <label>Общий статус<input v-model="f.status" /></label>
            <label>Город на карте мира<select v-model="f.cityId"><option v-for="c in cities" :key="c.id" :value="c.id">{{ c.name }}</option></select></label>
          </div>
          <datalist id="se-kinds"><option>Лагерь</option><option>Деревня</option><option>Посёлок</option><option>Город</option></datalist>
          <h4>Показатели</h4>
          <div class="grid3">
            <label v-for="(l, k) in STATS" :key="k">{{ l }}<input v-model.number="f.stats[k]" type="number" /></label>
          </div>
          <h4>Управление</h4>
          <label>Глава поселения<select v-model="f.headHeroId"><option :value="null">—</option><option v-for="h in heroes" :key="h.id" :value="h.id">{{ h.name }}</option></select></label>
          <div class="grid2">
            <label>Слотов управляющих<input v-model.number="f.managerSlots" type="number" min="0" max="6" /></label>
            <span />
            <label v-for="i in f.managerSlots || 0" :key="i">Управляющий {{ i }}
              <select v-model="f.managers[i - 1]"><option :value="undefined">свободно</option><option v-for="a in f.assets" :key="a.id" :value="a.id">{{ a.name }}</option></select>
            </label>
          </div>
          <h4>Кто принимает решения и отдаёт приказы</h4>
          <div class="checks">
            <label v-for="p in players" :key="p.id" class="chk"><input v-model="f.deciders" type="checkbox" :value="p.id" /> {{ p.character }}</label>
            <p v-if="!players.length" class="muted">Пока нет одобренных игроков</p>
          </div>
        </template>

        <!-- ===== РЕСУРСЫ ===== -->
        <template v-else-if="section === 'resources'">
          <h4>Запасы на складах</h4>
          <div class="grid3">
            <label v-for="r in RESOURCES" :key="r.key">{{ r.label }}<input v-model.number="f.stock[r.key]" type="number" min="0" /></label>
          </div>
          <h4>Поправки <small>то, что сайт не считает сам (+ прирост, − расход)</small></h4>
          <div v-for="(a, i) in f.adjust" :key="i" class="row">
            <select v-model="a.res"><option v-for="r in RESOURCES" :key="r.key" :value="r.key">{{ r.label }}</option></select>
            <input v-model.number="a.value" type="number" class="num" />
            <input v-model="a.label" placeholder="откуда / куда" />
            <button class="mini" @click="f.adjust.splice(i, 1)">×</button>
          </div>
          <button class="mini" @click="f.adjust.push({ res: 'wood', value: 0, label: '' })">+ поправка</button>
        </template>

        <!-- ===== ЖИТЕЛИ ===== -->
        <template v-else-if="section === 'residents'">
          <div v-for="(r, i) in f.races" :key="r.race" class="race">
            <div class="race-h"><b>{{ RACES[r.race]?.label }}</b><button class="mini" @click="f.races.splice(i, 1)">убрать расу</button></div>
            <div class="grid3">
              <label>Мужчины<input v-model.number="r.male" type="number" min="0" /></label>
              <label>Женщины<input v-model.number="r.female" type="number" min="0" /></label>
              <label>Дети<input v-model.number="r.kids" type="number" min="0" /></label>
              <label v-for="(c, k) in CATS" :key="k" :style="{ color: c.color }">{{ c.label }}<input v-model.number="r[k]" type="number" min="0" /></label>
            </div>
          </div>
          <div v-if="freeRaces.length" class="row">
            <select v-model="newRace"><option v-for="k in freeRaces" :key="k" :value="k">{{ RACES[k].label }}</option></select>
            <button class="mini" @click="addRace">+ раса</button>
          </div>
        </template>

        <!-- ===== РАБОТЫ ===== -->
        <template v-else-if="section === 'jobs'">
          <p class="muted">Мест даёт число построек (вкладка «Обзор» → постройки). Здесь — сколько занято, обеспеченность ресурсами и специалисты.</p>
          <div v-for="(j, key) in JOBS" :key="key" class="job">
            <b>{{ j.label }}</b><span class="muted">мест: {{ places[key] || 0 }}</span>
            <div class="grid3">
              <label>Занято<input v-model.number="jobOf(key).workers" type="number" min="0" :max="places[key] || 0" /></label>
              <label v-if="j.per">Ресурсы для работы, %<input v-model.number="jobOf(key).supply" type="number" min="0" max="100" placeholder="100" /></label>
            </div>
            <div v-if="j.spec" class="grid2">
              <label v-for="i in j.spec" :key="i">Специалист {{ i }}
                <input v-model="jobOf(key).specialists[i - 1]" list="se-assets" placeholder="имя или актив" />
              </label>
            </div>
          </div>
          <datalist id="se-assets"><option v-for="a in f.assets" :key="a.id" :value="a.id">{{ a.name }}</option></datalist>
        </template>

        <!-- ===== АКТИВЫ ===== -->
        <template v-else-if="section === 'assets'">
          <div v-for="(a, i) in f.assets" :key="a.id" class="asset" :style="{ borderColor: ASSET_FRAMES[a.frame] }">
            <div class="asset-h">
              <label class="ph" :title="'Загрузить портрет'">
                <img v-if="a.portrait" :src="a.portrait" alt="" /><span v-else>＋</span>
                <input type="file" accept="image/*" hidden @change="portrait(a, $event)" />
              </label>
              <input v-model="a.name" class="name" placeholder="Имя" />
              <select v-model="a.frame"><option v-for="(c, k) in ASSET_FRAMES" :key="k" :value="k">{{ FRAME_LABELS[k] }}</option></select>
              <label class="chk"><input v-model="a.companion" type="checkbox" /> компаньон</label>
              <button class="mini" @click="f.assets.splice(i, 1)">×</button>
            </div>
            <div class="row">
              <label class="chk grow">Карточка героя
                <select v-model="a.heroId"><option :value="undefined">— не связан —</option><option v-for="h in heroes" :key="h.id" :value="h.id">{{ h.name }}{{ h.kind === 'sidekick' ? ' (сайд-кик)' : h.kind === 'companion' ? ' (компаньон)' : '' }}</option></select>
              </label>
            </div>
            <small>Пассивно</small>
            <div v-for="(p, k) in a.passive" :key="k" class="row">
              <input v-model="p.text" placeholder="Мораль +5" />
              <select v-model="p.stat"><option :value="undefined">не считать</option><option v-for="(l, s) in PASSIVE_STATS" :key="s" :value="s">{{ l }}</option></select>
              <input v-if="p.stat" v-model.number="p.value" type="number" class="num" />
              <button class="mini" @click="a.passive.splice(k, 1)">×</button>
            </div>
            <button class="mini" @click="(a.passive ||= []).push({ text: '' })">+ строка</button>
            <small>Роль</small>
            <div class="row">
              <select :value="a.role?.kind || ''" @change="setRole(a, $event.target.value)"><option value="">нет</option><option value="manager">управляющий</option><option value="specialist">специалист</option></select>
            </div>
            <template v-if="a.role">
              <div v-for="(p, k) in a.role.effects" :key="k" class="row">
                <input v-model="p.text" placeholder="Конфликты −30%" />
                <select v-model="p.stat"><option :value="undefined">не считать</option><option v-for="(l, s) in PASSIVE_STATS" :key="s" :value="s">{{ l }}</option></select>
                <input v-if="p.stat" v-model.number="p.value" type="number" class="num" />
                <button class="mini" @click="a.role.effects.splice(k, 1)">×</button>
              </div>
              <button class="mini" @click="a.role.effects.push({ text: '' })">+ эффект роли</button>
            </template>
            <div class="row"><input v-model="a.busy" placeholder="Чем занят, кроме работы: «Охраняет ворота»" /></div>
            <div class="row note"><input :value="a.note?.text || ''" placeholder="Заметка: «Выпрашивает еду»" @input="a.note = $event.target.value ? { text: $event.target.value, color: a.note?.color || '#ff9b4a' } : undefined" />
              <input v-if="a.note" v-model="a.note.color" type="color" /></div>
          </div>
          <button class="mini" @click="addAsset">+ актив</button>
        </template>

        <!-- ===== АВАНПОСТЫ ===== -->
        <template v-else-if="section === 'outposts'">
          <label>Слотов аванпостов<input v-model.number="f.stats.outpostSlots" type="number" min="0" /></label>
          <p class="muted">Аванпост появится в центре — перетащи его на место инструментом «Двигать» и открой разведанную землю кистью. Добычу и рабочих правь в карточке аванпоста (клик по нему на карте).</p>
          <div class="row">
            <select v-model="newOutpost"><option v-for="(o, k) in OUTPOSTS" :key="k" :value="k">{{ o.label }}</option></select>
            <button class="mini" @click="addOutpost">+ аванпост</button>
          </div>
        </template>
      </div>

      <footer>
        <span class="muted">{{ dirty ? 'Есть несохранённые правки' : '' }}</span>
        <button @click="$emit('close')">Отмена</button>
        <button class="primary" :disabled="busy" @click="save">Сохранить</button>
      </footer>
    </section>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { store, act, toast, uploadSettlementPortrait } from '../map/store.js'
import { RESOURCES, RACES, RESIDENT_CATS, JOBS, OUTPOSTS, ASSET_FRAMES, computeSettlement } from '../shared/settlement.js'

const props = defineProps({ section: String, settlement: Object, wide: Boolean })
const big = ref(props.wide)
const emit = defineEmits(['close'])
const TITLES = { overview: 'Обзор и управление', resources: 'Запасы и поправки', residents: 'Жители', jobs: 'Работы', assets: 'Активы', outposts: 'Аванпосты' }
const STATS = { morale: 'Мораль', stability: 'Стабильность', threat: 'Угрозы', freeSettlers: 'Свободные поселенцы', unavailable: 'Недоступные', housesUsed: 'Жильё (дома) занято', housingUsed: 'Общее жильё занято', guestsUsed: 'Гостей', tradeUsed: 'Торговых мест занято', outpostSlots: 'Слотов аванпостов' }
const PASSIVE_STATS = { war: 'Военный потенциал', defense: 'Защита', leisure: 'Досуг', morale: 'Мораль', stability: 'Стабильность' }
const FRAME_LABELS = { purple: 'фиолетовая', blue: 'синяя', green: 'зелёная', gold: 'золотая' }
const { free: _f, workers: _w, ...rest } = RESIDENT_CATS
const CATS = { free: RESIDENT_CATS.free, workers: RESIDENT_CATS.workers, ...Object.fromEntries(Object.entries(rest).filter(([k]) => k !== 'kids')) }

// правим копию, сохраняем разом
const src = JSON.parse(JSON.stringify(props.settlement))
const f = ref({ ...src, stats: src.stats || {}, stock: src.stock || {}, adjust: src.adjust || [], managers: src.managers || [], deciders: src.deciders || [], jobs: src.jobs || {}, assets: src.assets || [] })
const start = JSON.stringify(f.value)
const dirty = computed(() => JSON.stringify(f.value) !== start)
const busy = ref(false)

const heroes = computed(() => store.data.heroes || [])
const cities = computed(() => store.data.cities || [])
const players = computed(() => (store.data.roster || []).filter(p => p.character))
const places = computed(() => computeSettlement(f.value).places)

function jobOf(key) {
  f.value.jobs[key] ||= { workers: 0 }
  f.value.jobs[key].specialists ||= []
  return f.value.jobs[key]
}
const newRace = ref('')
const freeRaces = computed(() => Object.keys(RACES).filter(k => !f.value.races.some(r => r.race === k)))
function addRace() {
  const k = newRace.value || freeRaces.value[0]
  if (k) f.value.races.push({ race: k, male: 0, female: 0, kids: 0, free: 0, workers: 0, combat: 0, important: 0, wounded: 0 })
}
function setRole(a, kind) {
  if (!kind) delete a.role
  else a.role = { kind, effects: a.role?.effects || [] }
}
function addAsset() {
  f.value.assets.push({ id: 'a' + Date.now().toString(36), name: 'Новый актив', frame: 'green', passive: [] })
}
async function portrait(a, e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  try {
    a.portrait = (await uploadSettlementPortrait(props.settlement.id, file)).url
  } catch (err) { toast(err.message, 'error') }
}
const newOutpost = ref('mine')
function addOutpost() {
  const t = f.value.terrain?.territory || { x: 800, y: 500 }
  ;(f.value.outposts ||= []).push({ id: 'o' + Date.now().toString(36), type: newOutpost.value, x: t.x, y: t.y, places: 5, workers: 0, specialist: '', yields: {}, state: 'active' })
}

// отправляем только разделы этой вкладки
const KEYS = {
  overview: ['name', 'kind', 'status', 'cityId', 'stats', 'headHeroId', 'managerSlots', 'managers', 'deciders'],
  resources: ['stock', 'adjust'], residents: ['races'], jobs: ['jobs'], assets: ['assets'], outposts: ['stats', 'outposts']
}
async function save() {
  busy.value = true
  try {
    const v = f.value
    if (props.section === 'jobs') for (const j of Object.values(v.jobs)) j.specialists = (j.specialists || []).map(x => x || null)
    if (props.section === 'overview') v.managers = v.managers.slice(0, v.managerSlots || 0)
    const body = Object.fromEntries(KEYS[props.section].map(k => [k, v[k]]))
    await act('PATCH', `/api/settlements/${props.settlement.id}`, body, 'Сохранено')
    emit('close')
  } finally { busy.value = false }
}
</script>

<style scoped>
.se-wrap { position: fixed; inset: 0; z-index: 130; display: flex; justify-content: flex-end; background: rgba(5, 4, 2, .5); animation: fade .2s; }
.se { width: min(560px, 100%); height: 100%; display: flex; flex-direction: column; background: linear-gradient(170deg, #241c13, #16110c); border-left: 1px solid #6e4f22; color: var(--a-text); font-family: var(--a-sans); animation: slide .25s ease-out; }
header { display: flex; justify-content: space-between; align-items: flex-start; padding: 16px 20px 10px; border-bottom: 1px solid var(--a-line); }
header small { font-size: 11px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: var(--a-muted); }
header h3 { margin: 2px 0 0; font: 700 26px var(--a-serif); color: var(--a-gold-2); }
.x { border: 0; background: none; color: var(--a-muted); font-size: 28px; cursor: pointer; }
.grow-btn { margin: 6px 10px 0 auto; padding: 4px 10px; border-radius: 8px; border: 1px solid var(--a-line); background: rgba(231, 197, 111, .08); color: var(--a-gold-2); font: 700 12px var(--a-sans); cursor: pointer; }
/* шире: карточки рас, работ и активов — в несколько колонок */
.se.big { width: min(1180px, 100%); }
.se.big .se-body { grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 10px 14px; padding: 16px 28px 24px; }
.se.big .se-body > :not(.race):not(.job):not(.asset) { grid-column: 1 / -1; }
.se.big .se-body > .grid3 { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); }
.se.big .se-body > .grid2 { grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
@media (max-width: 700px) { .grow-btn { display: none; } }
.se-body { flex: 1; overflow-y: auto; padding: 12px 20px 20px; display: grid; gap: 8px; align-content: start; }
h4 { margin: 10px 0 2px; font: 700 18px var(--a-serif); color: var(--a-gold-2); }
h4 small { font: 600 11px var(--a-sans); color: var(--a-muted); }
label { display: grid; gap: 3px; font-size: 11.5px; font-weight: 700; color: var(--a-muted); }
input, select { min-width: 0; padding: 5px 8px; border-radius: 8px; border: 1px solid var(--a-line-2); background: rgba(0, 0, 0, .3); color: var(--a-text); font: 600 13px var(--a-sans); }
input[type=color] { padding: 0; width: 34px; height: 30px; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 10px; }
.grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px 10px; }
.row { display: flex; gap: 5px; align-items: center; margin: 2px 0; }
.row input:not(.num), .row select { flex: 1; }
.num { width: 76px; flex: none; }
.chk { display: flex; align-items: center; gap: 6px; color: var(--a-text); font-weight: 600; font-size: 13px; }
.chk.grow { flex: 1; color: var(--a-muted); font-size: 12px; }
.chk.grow select { flex: 1; min-width: 0; }
.checks { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
.mini { justify-self: start; padding: 4px 10px; border-radius: 8px; border: 1px solid var(--a-line); background: rgba(231, 197, 111, .08); color: var(--a-gold-2); font: 700 12px var(--a-sans); cursor: pointer; }
.muted { color: var(--a-muted); font-size: 12px; margin: 0; }
.race, .job, .asset { padding: 10px; border-radius: 12px; border: 1px solid var(--a-line-2); background: rgba(255, 255, 255, .02); display: grid; gap: 6px; }
.race-h { display: flex; justify-content: space-between; align-items: center; }
.race-h b, .job b { font: 700 17px var(--a-serif); color: var(--a-gold-2); }
.asset { border-width: 2px; }
.asset small { color: var(--a-muted); font-weight: 800; font-size: 11px; }
.asset-h { display: flex; gap: 6px; align-items: center; }
.asset-h .name { flex: 1; font: 700 15px var(--a-serif); }
.ph { width: 44px; height: 44px; flex: none; border-radius: 50%; overflow: hidden; display: grid; place-items: center; border: 2px dashed var(--a-line); cursor: pointer; color: var(--a-gold); font-size: 20px; }
.ph img { width: 100%; height: 100%; object-fit: cover; }
footer { display: flex; align-items: center; gap: 8px; padding: 12px 20px; border-top: 1px solid var(--a-line); }
footer .muted { margin-right: auto; color: #ffb36b; }
footer button { padding: 8px 14px; border-radius: 10px; border: 1px solid var(--a-line); background: rgba(255, 255, 255, .05); color: var(--a-text); font: 700 13px var(--a-sans); cursor: pointer; }
footer .primary { background: linear-gradient(180deg, #f0d083, #c9a24f); color: #1b1408; border: 0; }
@keyframes fade { from { opacity: 0; } }
@keyframes slide { from { transform: translateX(40px); opacity: 0; } }
@media (max-width: 600px) { .grid3 { grid-template-columns: 1fr 1fr; } }
</style>
