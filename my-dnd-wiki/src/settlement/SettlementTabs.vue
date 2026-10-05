<template>
  <div class="st">
    <!-- ================= ОБЗОР ================= -->
    <template v-if="tab === 'overview'">
      <h3>Основная информация<button v-if="master" class="ed" @click="emit('edit', 'overview')">✎ Править</button></h3>
      <div class="tiles">
        <div v-for="x in overview" :key="x.label" class="tile" :class="x.cls" :title="x.hint">
          <img :src="icon(x.icon)" alt="" /><span>{{ x.label }}</span><b>{{ x.value }}</b>
        </div>
      </div>

      <h3>Управление</h3>
      <div class="gov">
        <div class="gov-col">
          <small>Глава поселения</small>
          <div class="person big">
            <img v-if="headCover" :src="headCover" alt="" /><span v-else>{{ initial(head?.name) }}</span>
          </div>
          <b>{{ head?.name || '—' }}</b>
        </div>
        <div class="gov-col wide">
          <small>Управляющие</small>
          <div class="gov-row">
            <div v-for="(m, i) in managerSlots" :key="i" class="gov-m">
              <div class="person" :class="{ empty: !m }" :style="m ? { '--fr': ASSET_FRAMES[m.frame] } : null">
                <img v-if="m?.portrait" :src="m.portrait" alt="" /><span v-else-if="m">{{ initial(m.name) }}</span>
              </div>
              <small>{{ m?.name || 'свободно' }}</small>
            </div>
          </div>
        </div>
      </div>
      <p v-if="deciders.length" class="muted">Решения принимают: {{ deciders.join(', ') }}</p>

      <h3>Постройки <small>{{ builtCount }}</small></h3>
      <div class="bcount">
        <button v-for="b in buildingList" :key="b.type" class="bc" :title="b.label" @click="pickFirst(b.type)">
          <img :src="icon(b.icon)" alt="" /><span>{{ b.label }}</span><b>×{{ b.n }}</b>
        </button>
      </div>
    </template>

    <!-- ================= РЕСУРСЫ ================= -->
    <template v-else-if="tab === 'resources'">
      <h3>Ресурсы <small>в день · нажми на строку — откуда и куда</small><button v-if="master" class="ed" @click="emit('edit', 'resources')">✎ Править</button></h3>
      <p v-if="s.day" class="muted">Прошло дней: {{ s.day }}</p>
      <table class="res">
        <thead><tr><th>Вид</th><th v-if="hasStock">Запас</th><th>Прирост</th><th>Расход</th><th>Итог</th></tr></thead>
        <tbody>
          <template v-for="r in resRows" :key="r.key">
            <tr :class="{ bad: r.bal < 0, idle: !r.gain && !r.use, open: openRes === r.key }" @click="openRes = openRes === r.key ? null : r.key">
              <td><i class="rdot" :style="{ background: r.color }" />{{ r.label }}</td>
              <td v-if="hasStock" class="stock">{{ s.stock?.[r.key] != null ? fmt(s.stock[r.key]) : '—' }}<small v-if="r.bal < 0 && s.stock?.[r.key]">{{ Math.floor(s.stock[r.key] / -r.bal) }} дн.</small></td>
              <td>{{ fmt(r.gain) }}</td><td>{{ fmt(r.use) }}</td>
              <td class="bal">{{ r.bal > 0 ? '+' : '' }}{{ fmt(r.bal) }}</td>
            </tr>
            <tr v-if="openRes === r.key" class="parts">
              <td :colspan="hasStock ? 5 : 4">
                <div v-for="p in calc.gain[r.key]?.parts || []" :key="'g' + p.label" class="pl plus"><span>{{ p.label }}</span><b>+{{ fmt(p.value) }}</b></div>
                <div v-for="p in calc.use[r.key]?.parts || []" :key="'u' + p.label" class="pl minus"><span>{{ p.label }}</span><b>−{{ fmt(p.value) }}</b></div>
                <div v-if="!calc.gain[r.key] && !calc.use[r.key]" class="muted">Пока не добывается и не тратится</div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
      <p class="muted note">«Быт» — дрова, посуда, одежда и починка: каждый житель тратит его в день по норме своей расы (вкладка «Жители»), он берётся из Дерева. Строки «Поправка» и «Стройка» — то, что старая таблица учитывала вручную; мастер может их менять.</p>
    </template>

    <!-- ================= ЖИТЕЛИ ================= -->
    <template v-else-if="tab === 'residents'">
      <h3>Жители <small>{{ calc.population }} · взрослых {{ calc.adults }}, детей {{ calc.kids }}</small><button v-if="master" class="ed" @click="emit('edit', 'residents')">✎ Править</button></h3>
      <div v-for="r in s.races" :key="r.race" class="race">
        <div class="race-top" @click="openRace = openRace === r.race ? null : r.race">
          <div class="race-name">{{ RACES[r.race]?.label }}<small>{{ (r.male || 0) + (r.female || 0) + (r.kids || 0) }}</small></div>
          <div class="mfk"><span title="Мужчины">♂ {{ r.male }}</span><span title="Женщины">♀ {{ r.female }}</span><span title="Дети">◦ {{ r.kids }}</span></div>
        </div>
        <div class="cats">
          <span v-for="(c, k) in RESIDENT_CATS" :key="k" :style="{ color: c.color }">{{ c.label }}: <b>{{ r[k] || 0 }}</b></span>
        </div>
        <div v-if="openRace === r.race" class="race-more">
          <div class="chips"><span v-for="tr in RACES[r.race].traits" :key="tr" class="chip">{{ tr }}</span></div>
          <ul class="pm"><li v-for="p in RACES[r.race].plus" :key="p" class="p">{{ p }}</li><li v-for="m in RACES[r.race].minus" :key="m" class="m">{{ m }}</li></ul>
          <div class="norms">
            На жителя в день: овощи {{ RACES[r.race].veg }}, мясо {{ RACES[r.race].meat }}, питьевая вода {{ RACES[r.race].drink }}, быт {{ RACES[r.race].life }} ·
            боевой: военный {{ RACES[r.race].war }}, оборона {{ RACES[r.race].def }}
          </div>
        </div>
      </div>
      <p class="muted note">Нажми на расу — свойства, качества и нормы. «Боевые» и «Важные» — отметки поверх работы, а не отдельные люди.</p>
    </template>

    <!-- ================= РАБОТЫ ================= -->
    <template v-else-if="tab === 'jobs'">
      <h3>Рабочие места<button v-if="master" class="ed" @click="emit('edit', 'jobs')">✎ Править</button></h3>
      <div v-for="j in jobList" :key="j.key" class="job">
        <div class="job-top">
          <img :src="icon(JOBS[j.key].icon)" alt="" />
          <b>{{ JOBS[j.key].label }}</b>
          <span class="job-n">{{ j.workers }} / {{ j.places }}</span>
        </div>
        <div class="bar"><i :style="{ width: (j.places ? (j.workers / j.places) * 100 : 0) + '%' }" /></div>
        <div class="job-eff">
          <span v-if="j.supply !== null && j.supply !== undefined" :class="{ warn: j.supply < 100 }">Ресурсы для работы: {{ j.supply }}%</span>
          <span v-for="(o, k) in j.out" :key="k" :class="{ minus: o.base < 0 }">{{ o.base < 0 ? 'Тратит' : 'Даёт' }} {{ RES[k]?.label }}: {{ fmt(Math.abs(o.base)) }}<template v-if="o.bonus"> +{{ fmt(o.bonus) }}</template></span>
          <span v-for="e in j.effects" :key="e.label">{{ e.label }}: {{ e.value }}</span>
        </div>
        <div v-if="j.specialists.length" class="specs">
          <small>Специалисты</small>
          <div v-for="(sp, i) in j.specialists" :key="i" class="person sm" :class="{ empty: !sp }" :title="sp?.name || 'свободно'" :style="sp?.frame ? { '--fr': ASSET_FRAMES[sp.frame] } : null">
            <img v-if="sp?.portrait" :src="sp.portrait" alt="" /><span v-else-if="sp">{{ initial(sp.name) }}</span>
          </div>
          <span class="spec-names">{{ j.specialists.filter(Boolean).map(x => x.name).join(', ') }}</span>
        </div>
      </div>
    </template>

    <!-- ================= АКТИВЫ ================= -->
    <template v-else-if="tab === 'assets'">
      <h3>Активы в работе<button v-if="master" class="ed" @click="emit('edit', 'assets')">✎ Править</button></h3>
      <div v-for="a in s.assets" :key="a.id" class="asset" :style="{ '--fr': ASSET_FRAMES[a.frame] || '#8a6630' }">
        <div class="person" :class="{ hex: a.companion }"><img v-if="a.portrait" :src="a.portrait" alt="" /><span v-else>{{ initial(a.name) }}</span></div>
        <div class="asset-body">
          <b>{{ a.name }}<small v-if="roleOf(a)">{{ roleOf(a) }}</small></b>
          <div class="asset-cols">
            <div><small>Пассивно</small><span v-for="p in a.passive" :key="p.text">{{ p.text }}</span></div>
            <div v-if="a.role?.effects?.length"><small>{{ a.role.kind === 'manager' ? 'Управляющий' : 'Специалист' }}</small><span v-for="p in a.role.effects" :key="p.text">{{ p.text }}</span></div>
          </div>
          <div v-if="a.note" class="asset-note" :style="{ color: a.note.color }">{{ a.note.text }}</div>
        </div>
      </div>
    </template>

    <!-- ================= АВАНПОСТЫ ================= -->
    <template v-else-if="tab === 'outposts'">
      <h3>Аванпосты <small>{{ s.outposts.length }} из {{ s.stats?.outpostSlots || s.outposts.length }}</small><button v-if="master" class="ed" @click="emit('edit', 'outposts')">✎ Править</button></h3>
      <div v-for="o in s.outposts" :key="o.id" class="outpost" :class="o.state" @click="emit('pick', { kind: 'outpost', id: o.id })">
        <img :src="icon(OUTPOSTS[o.type]?.icon)" alt="" />
        <div>
          <b>{{ OUTPOSTS[o.type]?.label }}<small v-if="o.state === 'depleting'" class="dep">вырабатывается</small></b>
          <span>Рабочие: {{ o.workers }} из {{ o.places }} · специалист: {{ o.specialist || '—' }}</span>
          <span>{{ Object.entries(o.yields || {}).map(([k, v]) => `${RES[k]?.label} +${v}`).join(' · ') }}</span>
        </div>
      </div>
      <div v-for="n in Math.max(0, (s.stats?.outpostSlots || 0) - s.outposts.length)" :key="'e' + n" class="outpost empty">Свободный слот аванпоста</div>
    </template>

    <!-- ================= ЖУРНАЛ ================= -->
    <template v-else-if="tab === 'journal'">
      <h3>Журнал поселения<button v-if="master" class="ed" @click="newEv = newEv ? null : blankEvent()">＋ Событие</button></h3>
      <div v-if="newEv" class="evform">
        <input v-model="newEv.title" placeholder="Заголовок: «Дикие Варги!»" />
        <div class="evrow">
          <select v-model="newEv.type"><option v-for="(t, k) in EVENT_TYPES" :key="k" :value="k">{{ t.label }}</option></select>
          <label v-for="(d, k) in EVENT_DURATIONS" :key="k" class="chk"><input v-model="newEv.duration" type="checkbox" :value="k" /> {{ d.label }}</label>
        </div>
        <div class="evrow"><label class="chk">Срок <input v-model="newEv.deadline" type="date" /></label></div>
        <textarea v-model="newEv.text" rows="3" placeholder="Что случилось — от лица жителей" />
        <input v-model="newEv.effect" placeholder="Влияние: «Угроза +45» (необязательно)" />
        <div class="evrow end"><button class="btn" @click="newEv = null">Отмена</button><button class="btn primary" :disabled="!newEv.title" @click="addEvent">Добавить и оповестить главу</button></div>
      </div>
      <div v-for="e in events" :key="e.id" class="ev" :style="{ '--ec': EVENT_TYPES[e.type]?.color }">
        <div class="ev-top">
          <img :src="icon(EVENT_TYPES[e.type]?.icon)" alt="" />
          <b>{{ e.title }}</b>
          <span class="ev-type">{{ EVENT_TYPES[e.type]?.label }}</span>
          <span v-for="d in e.duration || []" :key="d" class="ev-dur" :style="{ background: EVENT_DURATIONS[d]?.color }">{{ EVENT_DURATIONS[d]?.label }}</span>
          <span v-if="e.deadline" class="ev-date">до {{ date(e.deadline) }}</span>
        </div>
        <p>{{ e.text }}</p>
        <div v-if="e.effect" class="ev-eff">{{ e.effect }}</div>
        <div v-if="decEdit === e.id" class="ev-dec edit">
          <small>Решение</small>
          <textarea v-model="decText" rows="3" placeholder="Что прикажет глава?" />
          <div class="evrow end"><button class="btn" @click="decEdit = null">Отмена</button><button class="btn primary" @click="decide(e)">Сохранить решение</button></div>
        </div>
        <div v-else class="ev-dec" :class="{ none: !e.decision }">
          <small>Решение<template v-if="e.decidedBy"> · {{ e.decidedBy }}</template></small>{{ e.decision || (e.duration?.includes('decide') ? 'ждёт решения главы' : '—') }}
          <button v-if="master || (decider && (e.decision || e.duration?.includes('decide')))" class="ev-act" @click="decEdit = e.id; decText = e.decision || ''">{{ e.decision ? 'изменить' : 'решить' }}</button>
          <button v-if="master" class="ev-act del" @click="removeEvent(e)">удалить событие</button>
        </div>
      </div>
    </template>
    <!-- ================= ПРИКАЗЫ ================= -->
    <template v-else-if="tab === 'orders'">
      <h3>Приказы главы</h3>
      <div v-if="decider" class="evform">
        <p class="muted">Построить и разведать — кнопками на карте. Здесь — назначить рабочих или свободный приказ. Мастер одобрит или отклонит.</p>
        <div class="evrow">
          <select v-model="ord.job"><option v-for="(j, k) in c.jobs" :key="k" :value="k">{{ JOBS[k].label }} ({{ j.workers }}/{{ j.places }})</option></select>
          <input v-model.number="ord.count" type="number" min="0" class="num" />
          <button class="btn primary" :disabled="!ord.job" @click="sendOrder('workers')">Назначить</button>
        </div>
        <textarea v-model="ord.text" rows="2" placeholder="Свободный приказ: «Наймите мастеров в Ширатори»" />
        <div class="evrow end"><button class="btn primary" :disabled="!ord.text" @click="sendOrder('free')">Отдать приказ</button></div>
      </div>
      <p v-else-if="!master" class="muted">Приказы отдают игроки, которых выбрал мастер.</p>
      <div v-if="!orders.length" class="muted">Приказов пока нет</div>
      <div v-for="o in orders" :key="o.id" class="ord" :class="o.status">
        <div class="ord-top">
          <b>{{ orderTitle(o) }}</b>
          <span class="ord-st">{{ { pending: 'ждёт мастера', approved: 'одобрен', rejected: 'отклонён' }[o.status] }}</span>
        </div>
        <span class="muted">{{ o.byName }} · {{ date(o.createdAt) }}</span>
        <p v-if="o.text">{{ o.text }}</p>
        <p v-if="o.reply" class="reply">Мастер: {{ o.reply }}</p>
        <div v-if="o.status === 'pending' && master" class="evrow">
          <input v-model="replies[o.id]" placeholder="Ответ (необязательно)" />
          <button class="btn primary" @click="judge(o, 'approve')">Одобрить</button>
          <button class="btn danger" @click="judge(o, 'reject')">Отклонить</button>
        </div>
        <button v-else-if="o.status === 'pending' && o.by === store.me?.id" class="ev-act" @click="cancelOrder(o)">отменить приказ</button>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { store, heroCover, heroPortraitUrl, act } from '../map/store.js'
import { RESOURCES, RES, RACES, RESIDENT_CATS, BUILDINGS, JOBS, OUTPOSTS, EVENT_TYPES, EVENT_DURATIONS, ASSET_FRAMES } from '../shared/settlement.js'

const props = defineProps({ tab: String, settlement: Object, calc: Object, master: Boolean, decider: Boolean })
const emit = defineEmits(['pick', 'edit'])
const base = () => `/api/settlements/${props.settlement.id}`
const s = computed(() => props.settlement)
const c = computed(() => props.calc)
const icon = n => `/settlement/${n || 'help'}.png`
const initial = n => (n || '?').trim()[0]?.toUpperCase() || '?'
const fmt = v => (Math.round(v * 10) / 10).toLocaleString('ru-RU')
const date = d => new Date(d).toLocaleDateString('ru-RU')

/* обзор */
const overview = computed(() => {
  const x = c.value, st = s.value.stats || {}
  return [
    { label: 'Население', value: x.population, icon: 'person' },
    { label: 'Тип поселения', value: s.value.kind, icon: 'medieval-village-01' },
    { label: 'Свободные поселенцы', value: x.free, icon: 'person-free' },
    { label: 'Занятые поселенцы', value: x.busy, icon: 'person' },
    { label: 'Недоступные поселенцы', value: x.unavailable, icon: 'person-unavailable' },
    { label: 'Общий статус', value: s.value.status, icon: 'thumb-up', cls: 'ok' },
    { label: 'Разведано земель', value: (s.value.explored || []).filter(e => !e.r).length, icon: 'annexation' },
    { label: 'Аванпосты', value: `${s.value.outposts?.length || 0}/${st.outpostSlots || 0}`, icon: 'gold-mine' },
    { label: 'Жильё (дома)', value: `${x.houses.used}/${x.houses.cap}`, icon: 'house', cls: x.houses.used >= x.houses.cap ? 'warn' : '' },
    { label: 'Общее жильё', value: `${x.housing.used}/${x.housing.cap}`, icon: 'block-house' },
    { label: 'Гостевые места', value: `${x.guests.used}/${x.guests.cap}`, icon: 'tavern-sign' },
    { label: 'Торговые места', value: `${x.trade.used}/${x.trade.cap}`, icon: 'cash' },
    { label: 'Военный потенциал', value: x.war.total, icon: 'target-arrows', hint: `Боевые жители: ${x.war.races}, активы: ${x.war.assets}` },
    { label: 'Досуг', value: x.leisure.total, icon: 'tavern-sign' },
    { label: 'Стабильность', value: x.stability, icon: 'check-mark' },
    { label: 'Мораль', value: x.morale, icon: 'thumb-up' },
    { label: 'Защита', value: x.defense.total, icon: 'palisade', hint: `Боевые жители: ${x.defense.races}, стража: ${x.defense.guards}, постройки: ${x.defense.buildings}, активы: ${x.defense.assets}` },
    { label: 'Угрозы', value: x.threat, icon: 'hazard-sign', cls: x.threat > 0 ? 'warn' : '' }
  ]
})
const head = computed(() => store.data.heroes?.find(h => h.id === s.value.headHeroId) || null)
const headCover = computed(() => { const g = heroCover(head.value); return g ? heroPortraitUrl(g.thumb || g.file) : '' })
const managerSlots = computed(() => Array.from({ length: s.value.managerSlots || 2 }, (_, i) => s.value.assets?.find(a => a.id === s.value.managers?.[i]) || null))
const deciders = computed(() => (s.value.deciders || []).map(id => store.data.roster?.find(p => p.id === id)?.character).filter(Boolean))
const builtCount = computed(() => (s.value.buildings || []).filter(b => b.state === 'built').length)
const buildingList = computed(() => Object.entries(c.value.count).map(([type, n]) => ({ type, n, ...BUILDINGS[type] })).sort((a, b) => b.n - a.n || a.label.localeCompare(b.label)))
function pickFirst(type) {
  const b = s.value.buildings.find(x => x.type === type && BUILDINGS[type].size !== 'settlement')
  if (b) emit('pick', { kind: 'building', id: b.id })
}

/* ресурсы */
const openRes = ref(null)
const hasStock = computed(() => Object.keys(s.value.stock || {}).length > 0)
const resRows = computed(() => RESOURCES.map(r => ({ ...r, gain: c.value.gain[r.key]?.total || 0, use: c.value.use[r.key]?.total || 0, bal: c.value.balance[r.key] })))

/* жители */
const openRace = ref(null)

/* работы */
const jobList = computed(() => Object.entries(c.value.jobs).map(([key, j]) => ({ key, ...j })))

/* активы */
const roleOf = a => (s.value.managers?.includes(a.id) ? 'управляющий' : Object.entries(s.value.jobs || {}).find(([, j]) => j.specialists?.includes(a.id)) ? 'специалист: ' + JOBS[Object.entries(s.value.jobs).find(([, j]) => j.specialists?.includes(a.id))[0]].label.toLowerCase() : a.companion ? 'компаньон' : '')

/* журнал: новое событие, решения */
const newEv = ref(null)
const blankEvent = () => ({ title: '', type: 'message', duration: ['decide'], deadline: '', text: '', effect: '' })
async function addEvent() {
  await act('POST', `${base()}/events`, newEv.value, 'Событие в журнале, глава оповещён')
  newEv.value = null
}
const decEdit = ref(null)
const decText = ref('')
async function decide(e) {
  await act('POST', `${base()}/events/${e.id}/decision`, { text: decText.value }, 'Решение записано')
  decEdit.value = null
}
function removeEvent(e) {
  if (!confirm(`Удалить событие «${e.title}»?`)) return
  act('PATCH', base(), { events: s.value.events.filter(x => x.id !== e.id) }, 'Удалено')
}

/* приказы */
const ord = ref({ job: 'farmer', count: 0, text: '' })
const replies = ref({})
const orders = computed(() => [...(s.value.orders || [])].sort((a, b) => (a.status === 'pending' ? -1 : 0) - (b.status === 'pending' ? -1 : 0) || b.createdAt - a.createdAt))
function orderTitle(o) {
  if (o.kind === 'build') return `Построить «${BUILDINGS[o.build.type]?.label}»`
  if (o.kind === 'workers') return `${JOBS[o.workers.job]?.label}: назначить ${o.workers.count} рабочих`
  if (o.kind === 'explore') return 'Разведать участок'
  return 'Приказ'
}
async function sendOrder(kind) {
  const body = kind === 'workers' ? { kind, job: ord.value.job, count: ord.value.count, text: ord.value.text } : { kind, text: ord.value.text }
  await act('POST', `${base()}/orders`, body, 'Приказ отправлен мастеру')
  ord.value.text = ''
}
const judge = (o, action) => act('POST', `${base()}/orders/${o.id}/${action}`, { reply: replies.value[o.id] || '' }, action === 'approve' ? 'Приказ одобрен' : 'Приказ отклонён')
const cancelOrder = o => act('DELETE', `${base()}/orders/${o.id}`, undefined, 'Приказ отменён')

/* журнал: новые сверху, нерешённые — выше */
const events = computed(() => [...(s.value.events || [])].sort((a, b) => (!a.decision && a.duration?.includes('decide') ? -1 : 0) - (!b.decision && b.duration?.includes('decide') ? -1 : 0) || b.createdAt - a.createdAt))
</script>

<style scoped>
.st h3 { margin: 18px 0 8px; font: 700 22px var(--a-serif); color: var(--a-gold-2); }
.st h3:first-child { margin-top: 2px; }
.st h3 small { font: 600 12px var(--a-sans); color: var(--a-muted); margin-left: 6px; }
.muted { color: var(--a-muted); font-size: 12px; }
.ed { float: right; margin-top: 4px; padding: 4px 10px; border-radius: 8px; border: 1px solid var(--a-line); background: rgba(231, 197, 111, .08); color: var(--a-gold-2); font: 700 12px var(--a-sans); cursor: pointer; }
.ed:hover { background: rgba(231, 197, 111, .18); }
.res td.stock { color: var(--a-gold-2); font-weight: 700; }
.res td.stock small { display: block; color: #ff9b8f; font-size: 10.5px; }
.evform { display: grid; gap: 6px; padding: 10px 12px; margin-bottom: 10px; border-radius: 12px; border: 1px solid rgba(231, 197, 111, .35); background: rgba(231, 197, 111, .05); }
.evform input, .evform select, .evform textarea, .ev-dec textarea, .ord input { min-width: 0; padding: 6px 8px; border-radius: 8px; border: 1px solid var(--a-line-2); background: rgba(0, 0, 0, .3); color: var(--a-text); font: 500 13px var(--a-sans); resize: vertical; }
.evrow { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.evrow.end { justify-content: flex-end; }
.evrow input:not(.num) { flex: 1; }
.num { width: 70px; }
.chk { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #d9cdb0; font-weight: 600; }
.btn { padding: 6px 12px; border-radius: 9px; border: 1px solid var(--a-line); background: rgba(255, 255, 255, .05); color: var(--a-text); font: 700 12.5px var(--a-sans); cursor: pointer; }
.btn.primary { background: linear-gradient(180deg, #f0d083, #c9a24f); color: #1b1408; border: 0; }
.btn.danger { color: #ff9b8f; border-color: rgba(255, 107, 94, .4); }
.btn:disabled { opacity: .5; cursor: default; }
.ev-act { margin-left: 8px; padding: 0; border: 0; background: none; color: var(--a-gold); font: 700 11.5px var(--a-sans); text-decoration: underline dotted; cursor: pointer; }
.ev-act.del { color: #ff9b8f; }
.ev-dec.edit { display: grid; gap: 6px; }
.ord { display: grid; gap: 3px; padding: 10px 12px; margin-bottom: 8px; border-radius: 12px; border: 1px solid var(--a-line-2); background: rgba(255, 255, 255, .02); }
.ord.pending { border-color: rgba(231, 197, 111, .45); }
.ord.rejected { opacity: .65; }
.ord-top { display: flex; justify-content: space-between; gap: 8px; align-items: center; }
.ord-top b { font: 700 17px var(--a-serif); color: var(--a-gold-2); }
.ord-st { font-size: 11.5px; font-weight: 800; color: var(--a-muted); }
.ord.pending .ord-st { color: #ffb36b; } .ord.approved .ord-st { color: #9be07a; } .ord.rejected .ord-st { color: #ff9b8f; }
.ord p { margin: 2px 0; font-size: 13px; color: #d9cdb0; }
.ord .reply { color: var(--a-gold-2); }
.note { margin-top: 10px; line-height: 1.5; }

.tiles { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.tile { display: grid; grid-template-columns: 22px 1fr auto; align-items: center; gap: 8px; padding: 6px 9px; border-radius: 9px; background: rgba(255, 255, 255, .03); border: 1px solid var(--a-line-2); font-size: 12.5px; }
.tile img { width: 22px; height: 22px; }
.tile span { color: #b9ab8a; }
.tile b { color: var(--a-text); }
.tile.ok b { color: #9be07a; }
.tile.warn b { color: #ffb36b; }

.gov { display: flex; gap: 10px; }
.gov-col { display: grid; justify-items: center; gap: 4px; padding: 10px; border-radius: 12px; border: 1px solid var(--a-line); background: rgba(255, 255, 255, .02); text-align: center; }
.gov-col.wide { flex: 1; }
.gov-col small { color: var(--a-muted); font-weight: 700; font-size: 11px; }
.gov-row { display: flex; gap: 14px; justify-content: center; }
.gov-m { display: grid; justify-items: center; gap: 3px; }
.person { --fr: #8a6630; width: 52px; height: 52px; border-radius: 50%; overflow: hidden; display: grid; place-items: center; border: 2px solid var(--fr); background: #2a2218; color: #f3d99a; font: 700 22px var(--a-serif); flex: none; }
.person img { width: 100%; height: 100%; object-fit: cover; }
.person.big { width: 64px; height: 64px; --fr: #e6c27a; }
.person.sm { width: 34px; height: 34px; font-size: 15px; }
.person.empty { border: 2px dashed rgba(255, 255, 255, .25); background: none; }
.person.hex { border-radius: 0; clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%); }

.bcount { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 5px; }
.bc { display: grid; grid-template-columns: 22px 1fr auto; align-items: center; gap: 6px; padding: 5px 8px; border-radius: 9px; border: 1px solid var(--a-line-2); background: rgba(255, 255, 255, .03); color: var(--a-text); font: 600 12px var(--a-sans); text-align: left; cursor: pointer; }
.bc:hover { border-color: var(--a-line); background: rgba(231, 197, 111, .06); }
.bc img { width: 22px; height: 22px; padding: 2px; border-radius: 5px; background: #d6d2c8; }
.bc span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bc b { color: var(--a-gold-2); }

.res { width: 100%; border-collapse: collapse; font-size: 13px; }
.res th { text-align: right; color: var(--a-muted); font-size: 11px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; padding: 4px 8px; border-bottom: 1px solid var(--a-line); }
.res th:first-child, .res td:first-child { text-align: left; }
.res td { text-align: right; padding: 6px 8px; border-bottom: 1px solid var(--a-line-2); }
.res tbody tr:not(.parts) { cursor: pointer; }
.res tbody tr:not(.parts):hover { background: rgba(231, 197, 111, .05); }
.res tr.idle td { color: #6d675b; }
.res tr.bad td { color: #ff8a7a; }
.res td.bal { font-weight: 800; }
.res tr:not(.bad):not(.idle) td.bal { color: #9be07a; }
.rdot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 8px; }
.res tr.parts td { background: rgba(0, 0, 0, .2); padding: 6px 12px 8px 26px; }
.pl { display: flex; justify-content: space-between; font-size: 12px; padding: 1px 0; }
.pl.plus b { color: #9be07a; } .pl.minus b { color: #ff9b8f; }
.pl span { color: #b9ab8a; }

.race { padding: 10px 12px; border-radius: 12px; border: 1px solid var(--a-line-2); background: rgba(255, 255, 255, .02); margin-bottom: 8px; }
.race-top { display: flex; justify-content: space-between; align-items: center; cursor: pointer; }
.race-name { font: 700 19px var(--a-serif); color: var(--a-gold-2); }
.race-name small { margin-left: 8px; font: 700 12px var(--a-sans); color: var(--a-muted); }
.mfk { display: flex; gap: 10px; font-weight: 800; font-size: 13px; color: #d9cdb0; }
.cats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px 10px; margin-top: 6px; font-size: 12px; font-weight: 600; }
.cats b { color: inherit; }
.race-more { margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--a-line); font-size: 12.5px; }
.chips { display: flex; flex-wrap: wrap; gap: 4px; }
.chip { padding: 2px 8px; border-radius: 99px; background: rgba(231, 197, 111, .1); border: 1px solid var(--a-line); color: var(--a-gold-2); font-size: 11px; font-weight: 700; }
.pm { margin: 6px 0; padding-left: 16px; }
.pm .p { color: #9be07a; } .pm .m { color: #ff9b8f; }
.norms { color: #b9ab8a; }

.job { padding: 10px 12px; border-radius: 12px; border: 1px solid var(--a-line-2); background: rgba(255, 255, 255, .02); margin-bottom: 8px; }
.job-top { display: flex; align-items: center; gap: 8px; }
.job-top img { width: 26px; height: 26px; padding: 2px; border-radius: 6px; background: #d6d2c8; }
.job-top b { font: 700 18px var(--a-serif); color: var(--a-gold-2); }
.job-n { margin-left: auto; font-weight: 800; color: #d9cdb0; }
.bar { height: 5px; margin: 6px 0; border-radius: 99px; background: rgba(255, 255, 255, .07); overflow: hidden; }
.bar i { display: block; height: 100%; background: linear-gradient(90deg, #a87a33, #f2d58f); }
.job-eff { display: grid; gap: 1px; font-size: 12.5px; color: #d9cdb0; }
.job-eff .warn { color: #ffb36b; }
.job-eff .minus { color: #ff9b8f; }
.specs { display: flex; align-items: center; gap: 6px; margin-top: 7px; }
.specs small { color: var(--a-muted); font-weight: 700; font-size: 11px; }
.spec-names { font-size: 12px; color: #b9ab8a; }

.asset { display: flex; gap: 12px; padding: 10px 12px; margin-bottom: 8px; border-radius: 12px; border: 2px solid var(--fr); background: rgba(255, 255, 255, .02); }
.asset .person { --fr: inherit; width: 58px; height: 58px; border-color: var(--fr); }
.asset-body { flex: 1; min-width: 0; }
.asset-body > b { display: block; font: 700 19px var(--a-serif); color: var(--a-gold-2); }
.asset-body > b small { margin-left: 8px; font: 700 11px var(--a-sans); color: var(--a-muted); }
.asset-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 4px; }
.asset-cols div { display: grid; gap: 1px; font-size: 12.5px; color: #d9cdb0; align-content: start; }
.asset-cols small { color: var(--a-muted); font-weight: 800; font-size: 11px; }
.asset-note { margin-top: 4px; font-size: 12.5px; font-weight: 700; }

.outpost { display: flex; gap: 12px; align-items: center; padding: 10px 12px; margin-bottom: 8px; border-radius: 12px; border: 1px solid var(--a-line-2); background: rgba(255, 255, 255, .02); cursor: pointer; }
.outpost:hover { border-color: var(--a-line); }
.outpost img { width: 42px; height: 42px; padding: 4px; border-radius: 9px; background: #cfc6b2; }
.outpost div { display: grid; gap: 1px; font-size: 12.5px; color: #d9cdb0; }
.outpost b { font: 700 18px var(--a-serif); color: var(--a-gold-2); }
.outpost .dep { margin-left: 8px; color: #ff9b4a; font: 700 11px var(--a-sans); }
.outpost.empty { justify-content: center; border-style: dashed; color: var(--a-muted); font-size: 12.5px; cursor: default; min-height: 60px; }

.ev { padding: 10px 12px; margin-bottom: 8px; border-radius: 12px; border: 1px solid var(--a-line-2); border-left: 4px solid var(--ec); background: rgba(255, 255, 255, .02); }
.ev-top { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.ev-top img { width: 22px; height: 22px; }
.ev-top b { font: 700 18px var(--a-serif); color: var(--a-gold-2); margin-right: 4px; }
.ev-type { color: var(--ec); font-size: 12px; font-weight: 800; }
.ev-dur { padding: 1px 7px; border-radius: 6px; color: #fff; font-size: 11px; font-weight: 700; }
.ev-date { margin-left: auto; color: var(--a-muted); font-size: 12px; font-weight: 700; }
.ev p { margin: 6px 0; font-size: 13px; line-height: 1.5; color: #d9cdb0; font-style: italic; }
.ev-eff { font-size: 12px; color: var(--ec); font-weight: 700; }
.ev-dec { margin-top: 6px; padding: 6px 9px; border-radius: 8px; background: rgba(231, 197, 111, .07); border: 1px solid var(--a-line); font-size: 12.5px; color: var(--a-text); }
.ev-dec small { display: block; color: var(--a-muted); font-weight: 800; font-size: 10.5px; letter-spacing: .06em; text-transform: uppercase; }
.ev-dec.none { color: #ffb36b; }
</style>
