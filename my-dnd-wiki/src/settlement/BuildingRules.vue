<template>
  <div class="br">
    <h3>Постройки и баланс
      <template v-if="master">
        <button v-if="!draft" class="ed" @click="startEdit">✎ Править</button>
        <template v-else>
          <button class="ed go" :disabled="saving" @click="save">{{ saving ? 'Сохраняю…' : 'Сохранить' }}</button>
          <button class="ed" @click="draft = null">Отмена</button>
        </template>
      </template>
    </h3>
    <p class="muted">Что даёт каждая постройка на каждом уровне, сколько мест и специалистов, постоянные баффы и шансы событий.
      Улучшать постройки можно до уровня, который позволяет управление: {{ calc.gov.label || 'Двор старейшины' }} — до {{ calc.gov.maxLevel }}.
      <template v-if="master && !draft"> Правки мастера действуют на все поселения.</template></p>

    <nav class="br-tabs">
      <button v-for="(l, k) in PARTS" :key="k" :class="{ on: part === k }" @click="part = k">{{ l }}</button>
    </nav>

    <!-- ===== постройки ===== -->
    <template v-if="part === 'buildings'">
      <input v-model="q" class="br-q" placeholder="Найти постройку…" />
      <div v-for="(list, cat) in groups" :key="cat" class="br-group">
        <small :style="{ color: CATEGORIES[cat]?.color }">{{ CATEGORIES[cat]?.label || cat }}</small>
        <div v-for="b in list" :key="b.key" class="bd" :class="{ open: openKey === b.key }">
          <button type="button" class="bd-top" @click="openKey = openKey === b.key ? null : b.key">
            <img :src="iconSrc(b.def.icon)" alt="" :style="{ borderColor: CATEGORIES[b.def.cat]?.color }" />
            <span class="bd-name">{{ b.def.label }}<em v-if="b.def.tiers?.length > 1">{{ b.def.tiers.map(t => t.label).join(' → ') }}</em></span>
            <span class="bd-n">{{ calc.count[b.key] ? '×' + calc.count[b.key] : '' }}</span>
            <i v-if="changed(b.key)" class="dot" title="Изменено мастером" />
          </button>

          <!-- просмотр -->
          <div v-if="openKey === b.key && !draft" class="bd-view">
            <div class="kv"><span>Размер</span><b>{{ SIZES[b.def.size]?.label }} {{ SIZES[b.def.size]?.area ? '· ' + SIZES[b.def.size].area : '' }}</b></div>
            <div class="kv"><span>Сложность стройки</span><b>{{ b.def.cost }}</b></div>
            <div v-if="b.def.price && Object.keys(b.def.price).length" class="kv"><span>Цена</span><b>{{ priceText(b.def.price) }}</b></div>
            <div v-for="(t, i) in tiersOf(b.def)" :key="i" class="tv">
              <b>{{ tiersOf(b.def).length > 1 ? `${i + 1}. ` : '' }}{{ t.label || b.def.label }}</b>
              <span v-for="line in summary(t, i)" :key="line">{{ line }}</span>
              <span v-if="t.note" class="note">{{ t.note }}</span>
            </div>
          </div>

          <!-- правка -->
          <div v-if="openKey === b.key && draft" class="bd-edit">
            <div class="g4">
              <label class="ico-l">Значок
                <span class="ico-w">
                  <button type="button" class="ico-b" @click="iconFor = iconFor === b.key ? null : b.key"><img :src="iconSrc(b.def.icon)" alt="" /></button>
                  <IconPick v-if="iconFor === b.key" :settlement-id="settlement.id" :current="iconSrc(b.def.icon)" title="Значок постройки" @pick="setIcon(b.def, $event)" @close="iconFor = null" />
                </span>
              </label>
              <label class="wide">Название<input v-model="b.def.label" /></label>
              <label>Вид<select v-model="b.def.cat"><option v-for="(c, k) in CATEGORIES" :key="k" :value="k">{{ c.label }}</option></select></label>
              <label>Размер<select v-model="b.def.size"><option v-for="(z, k) in SIZES_PICK" :key="k" :value="k">{{ z.label }}</option></select></label>
              <label>Сложность<input v-model.number="b.def.cost" type="number" min="0" /></label>
            </div>
            <div class="fld"><small>Цена стройки</small><MapEdit v-model="b.def.price" :keys="RES_KEYS" add-label="ресурс" /></div>
            <div v-for="(t, i) in b.def.tiers" :key="i" class="te">
              <div class="te-h"><b>Уровень {{ i + 1 }}</b><input v-model="t.label" :placeholder="b.def.label" />
                <button v-if="i && i === b.def.tiers.length - 1" type="button" class="mini" @click="b.def.tiers.pop()">убрать уровень</button></div>
              <div class="g4">
                <label>Жильё<input v-model.number="t.housing" type="number" min="0" /></label>
                <label>Гостей<input v-model.number="t.guests" type="number" min="0" /></label>
                <label>Торговых мест<input v-model.number="t.trade" type="number" min="0" /></label>
                <label>Защита<input v-model.number="t.defense" type="number" min="0" /></label>
              </div>
              <div class="g2">
                <div class="fld"><small>Рабочие места</small><MapEdit v-model="t.jobs" :keys="jobKeys" add-label="работа" /></div>
                <div class="fld"><small>Места специалистов</small><MapEdit v-model="t.spec" :keys="jobKeys" add-label="работа" /></div>
                <div class="fld"><small>Даёт в день</small><MapEdit v-model="t.gain" :keys="RES_KEYS" add-label="ресурс" /></div>
                <div class="fld"><small>Тратит в день</small><MapEdit v-model="t.use" :keys="RES_KEYS" add-label="ресурс" /></div>
                <div class="fld"><small>Даёт, если есть специалист</small><MapEdit v-model="t.specGain" :keys="RES_KEYS" add-label="ресурс" /></div>
                <div class="fld"><small>Шансы событий</small><MapEdit v-model="t.ev" :keys="EV_KEYS" add-label="событие" /></div>
                <div class="fld"><small>Постоянно</small><MapEdit v-model="t.perm" :keys="PERM_KEYS" add-label="бафф" /></div>
                <div class="fld"><small>Управление</small><MapEdit v-model="t.gov" :keys="GOV_KEYS" add-label="поле" /></div>
              </div>
              <div class="g4">
                <label>Лес зарастает, м/день<input v-model.number="t.regrow" type="number" min="0" step="0.1" /></label>
                <label v-if="i">Работа улучшения<input v-model.number="t.cost" type="number" min="0" :placeholder="String((b.def.cost || 100) * i)" /></label>
              </div>
              <div v-if="i" class="fld"><small>Цена улучшения до этого уровня <em>пусто — ¾ цены стройки за каждый уровень</em></small><MapEdit v-model="t.price" :keys="RES_KEYS" add-label="ресурс" /></div>
              <label class="full">Заметка<input v-model="t.note" placeholder="что ещё даёт — для игроков" /></label>
            </div>
            <div class="te-acts">
              <button v-if="b.def.tiers.length < 5" type="button" class="mini" @click="addTier(b.def)">＋ уровень</button>
              <button v-if="BASE.buildings[b.key]" type="button" class="mini" :disabled="!changed(b.key)" @click="resetB(b.key)">↺ как было</button>
              <button v-else type="button" class="mini danger" @click="removeB(b.key)">удалить постройку</button>
            </div>
          </div>
        </div>
      </div>
      <button v-if="draft" type="button" class="mini add-b" @click="addBuilding">＋ Новая постройка</button>
    </template>

    <!-- ===== расы на стройке ===== -->
    <template v-else-if="part === 'races'">
      <p class="muted">Сколько очков стройки в день даёт один строитель каждой расы. Стройка, ремонт и улучшение идут только руками назначенных жителей — чем больше народу, тем быстрее.</p>
      <div class="rc">
        <div class="rc-h"><span>Раса</span><span>очков/день</span><span>прибавка при морали</span><span>заметка</span></div>
        <div v-for="(r, k) in (draft ? draft.races : RACES)" :key="k" class="rc-r">
          <b>{{ RACES[k]?.label || k }}</b>
          <template v-if="draft">
            <input v-model.number="r.build" type="number" min="0" step="0.5" />
            <span class="bm">выше <input v-model.number="r.buildMorale.above" type="number" min="-100" max="100" /> → +<input v-model.number="r.buildMorale.pct" type="number" min="0" />%</span>
            <input v-model="r.buildNote" placeholder="—" />
          </template>
          <template v-else>
            <span>{{ r.build ?? 4 }}</span>
            <span>{{ r.buildMorale?.pct ? `выше ${r.buildMorale.above}: +${r.buildMorale.pct}%` : '—' }}</span>
            <span class="note">{{ r.buildNote || '' }}</span>
          </template>
        </div>
      </div>
    </template>

    <!-- ===== работы ===== -->
    <template v-else>
      <p class="muted">Что даёт и тратит один работник в день. Места на работах дают постройки. «Дети» — работу можно отдать детям (сначала берут их).</p>
      <div v-for="(j, k) in (draft ? draft.jobs : JOBS)" :key="k" class="jb">
        <template v-if="draft">
          <div class="g4">
            <label class="wide">Работа<input v-model="j.label" /></label>
            <label>В группе<input v-model.number="j.group" type="number" min="0" placeholder="—" /></label>
            <label>Мораль/день<input v-model.number="j.morale" type="number" step="0.1" placeholder="0" /></label>
            <label>Бонус специалиста<input v-model.number="j.specBonus" type="number" step="0.05" min="0" placeholder="0" /></label>
          </div>
          <div class="fld"><small>На работника в день (минус — тратит)</small><MapEdit v-model="j.per" :keys="RES_KEYS" add-label="ресурс" /></div>
          <label class="chk"><input v-model="j.kids" type="checkbox" /> могут работать дети</label>
        </template>
        <template v-else>
          <b>{{ j.label }}</b>
          <span>{{ perText(j.per) || 'ничего не добывает' }}{{ j.group ? ` · по ${j.group} в группе` : '' }}{{ j.morale ? ` · мораль ${j.morale > 0 ? '+' : ''}${j.morale}/день` : '' }}{{ j.kids ? ' · могут дети' : '' }}</span>
        </template>
      </div>
      <button v-if="draft" type="button" class="mini add-b" @click="addJob">＋ Новая работа</button>
    </template>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { act } from '../map/store.js'
import IconPick from './IconPick.vue'
import MapEdit from './MapEdit.vue'
import { BUILDINGS, RACES, JOBS, RESOURCES, RES, CATEGORIES, SIZES, iconSrc, priceText, baseRules } from '../shared/settlement.js'

const props = defineProps({ settlement: Object, calc: Object, master: Boolean })
const PARTS = { buildings: 'Постройки', races: 'Расы на стройке', jobs: 'Работы' }
const part = ref('buildings')
const q = ref('')
const openKey = ref(null)
const iconFor = ref(null)
const BASE = baseRules()
const SIZES_PICK = Object.fromEntries(Object.entries(SIZES).filter(([k]) => k !== 'settlement'))
const RES_KEYS = RESOURCES.map(r => ({ key: r.key, label: r.label }))
const EV = { family: 'Семьи и дома (добрые)', dorm: 'Общага (дурные)', breakdown: 'Поломки', mineral: 'Минеральная вода', soil: 'Чернозём', medicine: 'Лекарства' }
const PERM = { threat: 'Угроза', stability: 'Стабильность', morale: 'Мораль в день' }
const GOV = { head: 'Глава', managers: 'Управляющих', outposts: 'Аванпостов', maxLevel: 'Макс. уровень построек' }
const kv = o => Object.entries(o).map(([key, label]) => ({ key, label }))
const EV_KEYS = kv(EV), PERM_KEYS = kv(PERM), GOV_KEYS = kv(GOV)
const jobKeys = computed(() => Object.entries(draft.value?.jobs || JOBS).map(([key, j]) => ({ key, label: j.label })))

/* уровни: у постройки без уровней один — из её полей */
const LEVEL_FIELDS = ['label', 'icon', 'housing', 'guests', 'trade', 'defense', 'jobs', 'spec', 'gain', 'use', 'specGain', 'perm', 'gov', 'ev', 'regrow', 'note']
const tiersOf = d => (d.tiers?.length ? d.tiers : [Object.fromEntries(LEVEL_FIELDS.filter(k => d[k] != null).map(k => [k, d[k]]))])
// черновик реактивный — копируем через JSON (structuredClone не берёт прокси)
const copy = o => JSON.parse(JSON.stringify(o))
const norm = d => ({ ...copy(d), tiers: copy(tiersOf(d)) })
const fmt = v => String(Math.round(v * 100) / 100).replace('.', ',')
const perText = per => Object.entries(per || {}).map(([k, v]) => `${RES[k]?.label || k} ${v > 0 ? '+' : '−'}${fmt(Math.abs(v))}`).join(', ')
function summary(t, i) {
  const out = []
  const nums = [['housing', 'жильё'], ['guests', 'гостей'], ['trade', 'торговых мест'], ['defense', 'защита +']]
  const n = nums.filter(([k]) => t[k]).map(([k, l]) => (l.endsWith('+') ? l + t[k] : `${l} ${t[k]}`))
  if (n.length) out.push(n.join(' · '))
  if (t.jobs) out.push('Места: ' + Object.entries(t.jobs).map(([k, v]) => `${JOBS[k]?.label || k} ${v}`).join(', '))
  if (t.spec) out.push('Специалисты: ' + Object.entries(t.spec).map(([k, v]) => `${JOBS[k]?.label || k} +${v}`).join(', '))
  if (t.gain) out.push('Даёт в день: ' + perText(t.gain))
  if (t.use) out.push('Тратит в день: ' + Object.entries(t.use).map(([k, v]) => `${RES[k]?.label || k} −${fmt(v)}`).join(', '))
  if (t.specGain) out.push('Со специалистом: ' + perText(t.specGain))
  if (t.perm) out.push('Постоянно: ' + Object.entries(t.perm).map(([k, v]) => `${PERM[k]?.toLowerCase() || k} ${v > 0 ? '+' : '−'}${fmt(Math.abs(v))}`).join(', '))
  if (t.gov) out.push('Управление: ' + Object.entries(t.gov).map(([k, v]) => `${GOV[k]?.toLowerCase() || k} ${v}`).join(', '))
  if (t.ev) out.push('Шансы событий: ' + Object.entries(t.ev).map(([k, v]) => `${EV[k]?.toLowerCase() || k} ×${fmt(v)}`).join(', '))
  if (t.regrow) out.push(`Лес зарастает: ${fmt(t.regrow)} м/день вокруг`)
  if (i && t.price) out.push('Улучшение: ' + priceText(t.price) + (t.cost ? ` · работа ${t.cost}` : ''))
  return out
}

/* список: по видам, с поиском */
const source = computed(() => draft.value?.buildings || BUILDINGS)
const groups = computed(() => {
  const out = {}
  const needle = q.value.trim().toLowerCase()
  for (const [key, def] of Object.entries(source.value)) {
    if (def.personal && !draft.value) continue
    if (needle && !(def.label + ' ' + (def.tiers || []).map(t => t.label).join(' ')).toLowerCase().includes(needle)) continue
    ;(out[def.cat] ||= []).push({ key, def })
  }
  return Object.fromEntries(Object.keys(CATEGORIES).filter(c => out[c]).map(c => [c, out[c]]))
})

/* правка: черновик всех справочников; сохраняем только то, что отличается от исходного */
const draft = ref(null)
const saving = ref(false)
function startEdit() {
  draft.value = {
    buildings: Object.fromEntries(Object.entries(BUILDINGS).map(([k, d]) => [k, norm(d)])),
    races: Object.fromEntries(Object.entries(RACES).map(([k, r]) => [k, { build: r.build ?? 4, buildNote: r.buildNote || '', buildMorale: r.buildMorale ? { ...r.buildMorale } : { above: 50, pct: 0 } }])),
    jobs: structuredClone(JOBS)
  }
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const clean = o => JSON.parse(JSON.stringify(o, (k, v) => (v === '' || v === null || (typeof v === 'number' && !Number.isFinite(v)) ? undefined : v)))
const changed = key => {
  const cur = draft.value?.buildings[key] || BUILDINGS[key]
  return !BASE.buildings[key] || !same(clean(norm(cur)), clean(norm(BASE.buildings[key])))
}
function resetB(key) { draft.value.buildings[key] = norm(BASE.buildings[key]) }
function removeB(key) { if (confirm(`Удалить «${draft.value.buildings[key].label}» из справочника?`)) delete draft.value.buildings[key] }
function addTier(d) { const last = copy(d.tiers.at(-1) || {}); d.tiers.push({ ...last, label: '', price: null, cost: null }) }
function addBuilding() {
  const key = 'b' + Date.now().toString(36)
  draft.value.buildings[key] = { label: 'Новая постройка', cat: 'production', size: 'medium', cost: 100, icon: 'house', price: { wood: 50 }, tiers: [{ label: 'Новая постройка' }] }
  q.value = ''
  openKey.value = key
}
function addJob() {
  const key = 'j' + Date.now().toString(36)
  draft.value.jobs[key] = { label: 'Новая работа', icon: 'person', per: {}, kids: false }
}
const setIcon = (d, url) => { d.icon = url.startsWith('/settlement/') ? url.slice(12, -4) : url; iconFor.value = null }
async function save() {
  const d = draft.value
  const buildings = {}
  for (const [k, def] of Object.entries(d.buildings)) if (changed(k)) buildings[k] = clean(def)
  const races = {}
  for (const [k, r] of Object.entries(d.races)) {
    const b = BASE.races[k] || {}
    const want = clean({ build: r.build, buildNote: r.buildNote, ...(r.buildMorale?.pct ? { buildMorale: r.buildMorale } : {}) })
    const was = clean({ build: b.build, buildNote: b.buildNote, ...(b.buildMorale?.pct ? { buildMorale: b.buildMorale } : {}) })
    if (!same(want, was)) races[k] = want
  }
  const jobs = {}
  const jobPick = j => clean({ label: j.label, icon: j.icon, per: j.per || {}, group: j.group || undefined, spec: j.spec, specBonus: j.specBonus || undefined, morale: j.morale || undefined, kids: !!j.kids })
  for (const [k, j] of Object.entries(d.jobs)) if (!BASE.jobs[k] || !same(jobPick(j), jobPick(BASE.jobs[k]))) jobs[k] = jobPick(j)
  saving.value = true
  try {
    await act('PUT', '/api/settlement-rules', { buildings, races, jobs }, 'Справочник сохранён — действует во всех поселениях')
    draft.value = null
  } catch { /* ошибка уже показана */ } finally { saving.value = false }
}
</script>

<style scoped>
.br h3 { margin: 2px 0 8px; font: 700 22px var(--a-serif); color: var(--a-gold-2); }
.muted { color: var(--a-muted); font-size: 12px; }
.ed { float: right; margin: 4px 0 0 6px; padding: 4px 10px; border-radius: 8px; border: 1px solid var(--a-line); background: rgba(231, 197, 111, .08); color: var(--a-gold-2); font: 700 12px var(--a-sans); cursor: pointer; }
.ed.go { background: linear-gradient(180deg, #f0d083, #c9a24f); color: #1b1408; border: 0; }
.br-tabs { display: flex; gap: 4px; margin: 10px 0; }
.br-tabs button { padding: 5px 12px; border-radius: 8px; border: 1px solid var(--a-line); background: none; color: var(--a-muted); font: 700 12.5px var(--a-sans); cursor: pointer; }
.br-tabs button.on { background: rgba(231, 197, 111, .16); color: var(--a-gold-2); }
.br-q { width: 100%; margin-bottom: 8px; padding: 6px 10px; border-radius: 9px; border: 1px solid var(--a-line-2); background: rgba(0, 0, 0, .3); color: var(--a-text); font: 600 13px var(--a-sans); box-sizing: border-box; }
.br-group { display: grid; gap: 5px; margin-bottom: 10px; }
.br-group > small { font-weight: 800; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
.bd { border-radius: 11px; border: 1px solid rgba(231, 197, 111, .16); background: rgba(255, 255, 255, .025); }
.bd.open { border-color: rgba(231, 197, 111, .4); }
.bd-top { display: flex; align-items: center; gap: 10px; width: 100%; padding: 6px 10px; border: 0; background: none; color: var(--a-text); text-align: left; cursor: pointer; }
.bd-top img { width: 30px; height: 30px; padding: 3px; border-radius: 7px; background: #d6d2c8; border: 2px solid #8a6630; flex: none; }
.bd-name { flex: 1; min-width: 0; font-weight: 800; font-size: 13px; }
.bd-name em { display: block; font-style: normal; font-weight: 600; font-size: 11.5px; color: #b9ab8a; }
.bd-n { color: var(--a-muted); font-weight: 800; font-size: 12px; }
.dot { width: 7px; height: 7px; border-radius: 50%; background: #e8c33a; flex: none; }
.bd-view, .bd-edit { display: grid; gap: 6px; padding: 4px 12px 12px; font-size: 12.5px; }
.kv { display: flex; justify-content: space-between; gap: 10px; }
.kv span { color: var(--a-muted); }
.tv { display: grid; gap: 2px; padding: 7px 10px; border-radius: 9px; background: rgba(0, 0, 0, .2); }
.tv b { color: var(--a-gold-2); }
.note { color: #b9ab8a; font-style: italic; }
.g4 { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(120px, 100%), 1fr)); gap: 6px; }
.g2 { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(220px, 100%), 1fr)); gap: 8px; }
.g4 .wide { grid-column: span 2; }
label { display: grid; gap: 2px; min-width: 0; color: var(--a-muted); font-size: 11.5px; font-weight: 700; }
label.full { grid-column: 1 / -1; }
label.chk { display: flex; align-items: center; gap: 5px; }
input, select { min-width: 0; padding: 4px 7px; border-radius: 7px; border: 1px solid var(--a-line-2); background: rgba(0, 0, 0, .3); color: var(--a-text); font: 600 12.5px var(--a-sans); }
.fld { display: grid; gap: 3px; min-width: 0; }
.fld > small { color: var(--a-muted); font-weight: 800; font-size: 11.5px; }
.fld > small em { font-style: normal; font-weight: 600; color: #7d6c4e; }
.te { display: grid; gap: 7px; padding: 9px 10px; border-radius: 10px; border: 1px solid rgba(231, 197, 111, .2); background: rgba(0, 0, 0, .18); }
.te-h { display: flex; align-items: center; gap: 8px; }
.te-h b { color: var(--a-gold-2); white-space: nowrap; }
.te-h input { flex: 1; }
.te-acts { display: flex; flex-wrap: wrap; gap: 6px; }
.mini { padding: 3px 9px; border-radius: 7px; border: 1px solid var(--a-line); background: rgba(231, 197, 111, .08); color: var(--a-gold-2); font: 700 12px var(--a-sans); cursor: pointer; }
.mini:disabled { opacity: .4; cursor: default; }
.mini.danger { color: #ff9b8f; border-color: rgba(255, 107, 94, .4); }
.add-b { margin-top: 4px; }
.ico-w { position: relative; }
.ico-b { width: 34px; height: 34px; padding: 3px; border-radius: 8px; border: 2px solid #8a6630; background: #d6d2c8; cursor: pointer; }
.ico-b img { width: 100%; height: 100%; }
.rc { display: grid; gap: 4px; }
.rc-h, .rc-r { display: grid; grid-template-columns: minmax(0, 1.1fr) 70px minmax(0, 1.4fr) minmax(0, 1.5fr); gap: 6px; align-items: center; font-size: 12.5px; }
.rc-h { color: var(--a-muted); font-weight: 800; font-size: 11.5px; }
.rc-r b { color: var(--a-text); }
.bm { display: flex; align-items: center; gap: 3px; color: var(--a-muted); font-size: 11.5px; }
.bm input { width: 46px; }
.jb { display: grid; gap: 5px; padding: 7px 10px; margin-bottom: 5px; border-radius: 10px; border: 1px solid rgba(231, 197, 111, .14); font-size: 12.5px; }
.jb b { color: var(--a-gold-2); }
@media (max-width: 520px) { .rc-h { display: none; } .rc-r { grid-template-columns: 1fr 1fr; } }
</style>
