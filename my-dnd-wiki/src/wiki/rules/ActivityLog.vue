<template>
  <!-- журнал деятельностей: что герои делали между сессиями (бывшая Google Таблица). Видят все; пишет хозяин героя,
       запись — черновик или «на проверке», мастер ставит статус и запись уходит в лист. Вкладки: журнал, план по дням,
       статистика, настройки героя; ⓘ — как всё устроено, с живыми примерами -->
  <div class="al">
    <div v-if="!store.me" class="al-empty">Журналы деятельностей видны после входа.</div>
    <div v-else-if="!actState.loaded" class="al-empty"><LottieFx :data="glass" :size="70" loop /><br />Листаю журналы…</div>
    <template v-else>
      <!-- герои -->
      <div class="al-top">
        <nav v-auto-animate class="al-heroes">
          <button v-if="master" type="button" class="al-hero queue" :class="{ on: queue }" @click="pickQueue">
            <span class="al-av">⏳</span><b>На проверке</b><em v-if="pendingAll">{{ pendingAll }}</em>
          </button>
          <button v-for="h in heroList" :key="h.heroId" type="button" class="al-hero" :class="{ on: !queue && h.heroId === heroId, mine: h.canWrite && !master }" @click="pick(h.heroId)">
            <span class="al-av"><img v-if="avatar(h.heroId)" :src="avatar(h.heroId)" alt="" /><template v-else>{{ h.name[0] }}</template></span>
            <b>{{ short(h.name) }}</b>
            <em v-if="pendingOf(h.heroId) && (master || h.canWrite)">{{ pendingOf(h.heroId) }}</em>
          </button>
        </nav>
        <button type="button" class="al-info" title="Как работает журнал — с примерами" @click="info = true">i</button>
      </div>
      <p v-if="actState.lock.blocked || actState.lock.until" class="al-lock">
        <template v-if="actState.lock.blocked">🔒 Мастер заблокировал следующий период{{ actState.lock.reason ? ': ' + actState.lock.reason : '' }} — можно только планировать черновики. </template>
        <template v-if="actState.lock.until">⌛ Период до {{ fmtShort(actState.lock.until) }} закрыт.</template>
      </p>

      <!-- мастер: все записи на проверке разом -->
      <template v-if="queue">
        <div v-if="!pendingAll" class="al-empty">Всё проверено ✓</div>
        <section v-for="g in queueGroups" :key="g.hero.heroId" class="al-sess">
          <header class="al-sh"><b>{{ g.hero.name }}</b><span class="al-sum">{{ g.rows.length }} на проверке</span>
            <span class="grow" />
            <button type="button" class="al-btn ok" @click="setAll(g.hero, g.rows, 'done', $event)">✓ Учесть все</button>
          </header>
          <div v-auto-animate class="al-rows">
            <ActivityRow v-for="r in g.rows" :key="r.id" :rec="r" :hero="g.hero" :master="master" :show-date="true" :wiki="wikiOf(r)"
                         @status="setStatus(g.hero, r, $event)" @edit="startEdit(g.hero.heroId, r)" @remove="remove(g.hero.heroId, r)" @repeat="repeat(g.hero.heroId, r)" @roll="rollRec(g.hero, r)" />
          </div>
        </section>
      </template>

      <template v-else-if="hero">
        <div class="al-tools">
          <h2>{{ hero.name }}</h2>
          <span v-if="hero.stamina != null" class="al-chip" title="Выносливость в листе">⚡ {{ hero.stamina }}</span>
          <span v-if="hero.exh != null" class="al-chip" :class="{ exh: hero.exh, sleep: hero.exh >= 5 }" :title="hero.exh >= 5 ? 'Изнурение 5 из 5 — эффект «Сон»: только отдых, пока не снимут' : 'Изнурение в листе сейчас (до 5). Длительная тренировка: +4 и минус ночной сон; отдых снимает 1 за каждые 3 часа; изнурение удваивает затраты выносливости'">{{ hero.exh >= 5 ? '😴' : '😵' }} {{ hero.exh }}<small> / 5</small><template v-if="hero.exh >= 5"> · «Сон»</template></span>
          <span v-if="cfg.sleep != null && (cfg.sleep !== 8 || (cfg.rest && cfg.rest !== 'Сон'))" class="al-chip" title="Отдых в день по настройкам героя">🌙 {{ (cfg.rest || 'Сон').toLowerCase() }} {{ cfg.sleep }} ч</span>
          <span class="grow" />
          <nav class="al-views">
            <button v-for="v in views" :key="v.id" type="button" :class="{ on: view === v.id }" @click="view = v.id">{{ v.icon }} {{ v.name }}</button>
          </nav>
        </div>
        <p class="al-budget" title="В старых сессиях из таблицы, где писали и ежедневный сон, он сначала покрывает норму — если иначе часов больше свободных">
          ⏱ Свободно <b>{{ budget.free }} ч</b> = {{ budget.period }} ч между сессиями − {{ budget.rest.toLowerCase() }} {{ budget.days }} × {{ budget.perDay }} ч (уже вычтен).
          <span>Записанный отдых — дополнительный, идёт в счёт.</span>
        </p>
        <p v-if="cfg.note" class="al-note">🙋 {{ cfg.note }}</p>
        <p v-if="cfg.banned?.length" class="al-note ban">⛔ Нельзя: {{ cfg.banned.map(b => b.name + (b.reason ? ` (${b.reason})` : '')).join('; ') }}</p>

        <!-- новая / правка — над любым видом -->
        <ActivityForm v-if="form && form.heroId === heroId" :key="form.key" v-model="form.rec" :hero="hero" :master="master" :catalog="catalog" :mods="mods" :busy="busy" :is-new="!form.id"
                      :plan-days="planDays" @save="save" @cancel="form = null" @fav="addFav" />

        <!-- журнал -->
        <template v-if="view === 'log'">
          <div class="al-bar">
            <input v-model="q" class="al-q" placeholder="Найти в журнале…" />
            <select v-model="stFilter" class="al-in">
              <option value="">Все статусы</option>
              <option v-for="(s, k) in ACT_STATUS" :key="k" :value="k">{{ s.name }}</option>
            </select>
            <span class="grow" />
            <button v-if="hero.canWrite" type="button" class="al-btn primary" @click="startNew()">＋ Деятельность</button>
          </div>
          <div v-if="!sessions.length" class="al-empty">{{ q || stFilter ? 'Ничего не нашлось.' : emptyLine }}</div>
          <section v-for="s in shownSessions" :key="s.date" class="al-sess">
            <header class="al-sh">
              <b>{{ fmtDate(s.date) }}</b>
              <span class="al-sum" :class="{ over: s.hours > budget.free }" :title="leftText(s)">⏱ {{ round(s.hours, 2) }}<small> / {{ budget.free }} ч</small></span>
              <span class="al-sum" :class="{ over: hero.stamina != null && s.stamina > hero.stamina }" :title="hero.stamina != null && s.stamina > hero.stamina ? `Потрачено больше выносливости, чем есть в листе — по правилам 1 изнурение за каждые −2 (≈ ${Math.ceil((s.stamina - hero.stamina) / 2)})` : 'Выносливость за сессию (отдых — со знаком минус)'">⚡ {{ round(s.stamina, 2) }}</span>
              <span v-if="s.exhUp || s.exhDown" class="al-sum" title="Изнурение за сессию: получено / снято отдыхом">😵 <template v-if="s.exhUp">+{{ s.exhUp }}</template><template v-if="s.exhUp && s.exhDown"> / </template><template v-if="s.exhDown">−{{ s.exhDown }}</template></span>
              <span class="al-sum">{{ s.rows.length }} {{ plural(s.rows.length) }}</span>
              <span v-if="s.pending" class="al-sum pend">⏳ {{ s.pending }}</span>
              <span v-if="s.plans" class="al-sum plan">✎ {{ s.plans }} в черновике</span>
              <span class="grow" />
              <button v-if="hero.canWrite && s.plans" type="button" class="al-btn" @click="sendPlans(s.rows.filter(r => r.status === 'plan' && !r.mirror))">📨 Отправить черновики</button>
              <button v-if="master && s.pending" type="button" class="al-btn ok" @click="setAll(hero, s.rows.filter(r => r.status === 'pending' && !r.mirror), 'done', $event)">✓ Учесть все</button>
            </header>
            <SessionBar :rows="s.free" :limit="budget.free" />
            <div v-auto-animate class="al-rows">
              <ActivityRow v-for="r in s.rows" :key="r.id + (r.mirror || '')" :rec="r" :hero="hero" :master="master" :wiki="wikiOf(r)" :mirror="r.mirror || ''" :coinable="coinable(s, r)"
                           @status="setStatus(hero, r, $event)" @edit="startEdit(heroId, r)" @remove="remove(heroId, r)" @repeat="repeat(heroId, r)" @roll="rollRec(hero, r)" @coin="coin(heroId, r)" />
            </div>
          </section>
          <button v-if="sessions.length > shownSessions.length" type="button" class="al-btn al-more" @click="more += 6">Ещё сессии: {{ sessions.length - shownSessions.length }}</button>
        </template>

        <ActivityPlanner v-else-if="view === 'plan'" :rows="planRows" :dates="planDateList" :date="planDate" :limit="limit" :budget="budget" :sleep="cfg.sleep ?? 8" :rest="cfg.rest || 'Сон'" :can-write="hero.canWrite"
                         @date="pickPlanDate" @move="moveDay" @add="startNew({ day: $event, date: planDate })" @edit="editFromPlan" @send="sendPlans" />
        <ActivityStats v-else-if="view === 'stats'" :hero-id="heroId" :budget="budget" />
        <ActivitySettings v-else-if="view === 'cfg'" :hero="hero" :master="master" />
      </template>
    </template>
    <ActivityInfo v-if="info" :limit="actState.limit" @close="info = false" />
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { vAutoAnimate } from '@formkit/auto-animate/vue'
import { store, actState, loadActivities, rulesState, api, toast, heroPortraitUrl, heroCover, requestRoll } from '../../map/store.js'
import { ACT_STATUS, num, round, activityCatalog, activityMods, catalogMatch, normAct, rollPlan, restBudget, freeRows, exhOf, staminaDouble } from '../../shared/activities.js'
import ActivityRow from './ActivityRow.vue'
import ActivityForm from './ActivityForm.vue'
import ActivityPlanner from './ActivityPlanner.vue'
import ActivityStats from './ActivityStats.vue'
import ActivitySettings from './ActivitySettings.vue'
import ActivityInfo from './ActivityInfo.vue'
import SessionBar from './SessionBar.vue'
import LottieFx from './LottieFx.vue'
import { hourglass } from './lottie.js'
import { celebrate } from './actFx.js'
import { sfx } from '../../sound/sound.js'

const route = useRoute()
const router = useRouter()
const master = computed(() => store.role === 'master')
const glass = hourglass()
const info = ref(false)
onMounted(() => loadActivities())
watch(() => [store.data.activitiesRev, store.me?.id], () => loadActivities())

/* ---------- герои ---------- */
const logOf = id => actState.logs[id] || []
// свои — первыми, дальше те, у кого журнал длиннее
const heroList = computed(() => actState.heroes.slice().sort((a, b) => (b.canWrite && !master.value) - (a.canWrite && !master.value) || logOf(b.heroId).length - logOf(a.heroId).length))
const pendingOf = id => logOf(id).filter(r => r.status === 'pending').length
const pendingAll = computed(() => actState.heroes.reduce((n, h) => n + pendingOf(h.heroId), 0))
const avatar = id => {
  const h = (store.data.heroes || []).find(x => x.id === id)
  const c = h && heroCover(h)
  return c ? heroPortraitUrl(c.thumb || c.file) : ''
}
const short = n => String(n).replace(/\s*\?+$/, '').split(' ')[0]
const queue = computed(() => master.value && route.query.log === 'queue')
const heroId = computed(() => (route.query.log && route.query.log !== 'queue' ? String(route.query.log) : heroList.value[0]?.heroId) || '')
const hero = computed(() => actState.heroes.find(h => h.heroId === heroId.value) || null)
const cfg = computed(() => actState.cfg[heroId.value] || {})
const limit = computed(() => cfg.value.limit || actState.limit) // весь период между сессиями
// отдых вычитается сразу: свободно 336 − 14 × 8 = 224 ч (транс 4 ч — 280)
const budget = computed(() => restBudget(limit.value, cfg.value))
const pick = id => { form.value = null; more.value = 4; router.replace({ query: { ...route.query, log: id } }) }
const pickQueue = () => { form.value = null; router.replace({ query: { ...route.query, log: 'queue' } }) }
const view = ref('log')
const views = computed(() => [
  { id: 'log', icon: '📜', name: 'Журнал' }, { id: 'plan', icon: '🗓', name: 'План' }, { id: 'stats', icon: '📊', name: 'Статистика' },
  ...(hero.value?.canWrite || cfg.value.banned?.length ? [{ id: 'cfg', icon: '⚙', name: 'Настройки' }] : [])
])

/* ---------- справочники из вики ---------- */
const catalog = computed(() => activityCatalog(rulesState.articles))
const mods = computed(() => activityMods(rulesState.articles))
const wikiOf = r => catalogMatch(catalog.value, r.name)

/* ---------- сессии: записи по датам, новые сверху; совместные из чужих журналов — с пометкой, в суммы не входят ---------- */
const q = ref('')
const stFilter = ref('')
const more = ref(4)
const norm = s => String(s || '').toLowerCase().replace(/ё/g, 'е')
const mirrors = computed(() => actState.heroes.filter(h => h.heroId !== heroId.value)
  .flatMap(h => logOf(h.heroId).filter(r => r.with?.includes(heroId.value)).map(r => ({ ...r, mirror: short(h.name) }))))
const sessions = computed(() => {
  const t = norm(q.value.trim())
  const rows = [...logOf(heroId.value), ...mirrors.value].filter(r => (!stFilter.value || r.status === stFilter.value) && (!t || norm(r.name + ' ' + r.result).includes(t)))
  const by = new Map()
  for (const r of rows) { if (!by.has(r.date)) by.set(r.date, []); by.get(r.date).push(r) }
  return [...by.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([date, rs]) => {
    const own = rs.filter(r => !r.mirror && r.status !== 'cancel') // провал тоже тратит время, отменённое — нет
    const fr = freeRows(own, budget.value) // сон в пределах нормы уже вычтен из периода
    return {
      date, rows: rs, own, free: fr.rows, covered: fr.covered,
      hours: fr.rows.reduce((n, r) => n + num(r.hours), 0),
      stamina: own.reduce((n, r) => n + (r.coin?.win ? 0 : num(r.stamina)), 0),
      exhUp: own.reduce((n, r) => n + Math.max(0, exhRec(r)), 0), exhDown: own.reduce((n, r) => n - Math.min(0, exhRec(r)), 0),
      pending: rs.filter(r => r.status === 'pending' && !r.mirror).length, plans: rs.filter(r => r.status === 'plan' && !r.mirror).length
    }
  })
})
// изнурение записи: учтённая — что ушло в лист, остальные — что уйдёт по правилам
const exhRec = r => (r.status === 'done' ? r.appliedSheet?.want?.exh || 0 : exhOf(r, cfg.value.sleep))
const shownSessions = computed(() => (q.value || stFilter.value ? sessions.value : sessions.value.slice(0, more.value)))
const queueGroups = computed(() => actState.heroes.map(h => ({ hero: h, rows: logOf(h.heroId).filter(r => r.status === 'pending') })).filter(g => g.rows.length))
const fmtDate = d => { const t = new Date(d + 'T12:00').toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'short' }); return t.charAt(0).toUpperCase() + t.slice(1) }
const fmtShort = d => d.split('-').reverse().join('.')
// подсказка к часам сессии: сколько свободных часов осталось из скольких
function leftText(s) {
  const left = round(budget.value.free - s.hours, 1)
  const head = left >= 0 ? `Осталось ${left} из ${budget.value.free} свободных ч` : `Перебор: на ${-left} ч больше, чем ${budget.value.free} свободных`
  const why = `\n${budget.value.period} ч между сессиями − ${budget.value.norm} ч отдыха (${budget.value.rest.toLowerCase()} ${budget.value.days} × ${budget.value.perDay} ч)`
  return head + why + (s.covered ? `\nСтарый сон из таблицы покрыл норму на ${round(s.covered, 1)} ч` : '')
}
const plural = n => (n % 10 === 1 && n % 100 !== 11 ? 'запись' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'записи' : 'записей')
const EMPTY = ['Герой смотрел в стену. Стена смотрела в ответ.', 'Тишина. Даже сверчки отдыхают.', 'Пусто — то ли отпуск, то ли всё ещё впереди.', 'Свиток чист, перо ждёт.']
const emptyLine = EMPTY[Math.floor(Math.random() * EMPTY.length)]
// монетка — у первой уникальной деятельности сессии, если ещё не бросали
const coinable = (s, r) => !!hero.value?.canWrite && r.type === 'unique' && ['plan', 'pending'].includes(r.status) && !r.mirror && !s.rows.some(x => x.coin) && s.rows.filter(x => !x.mirror && x.type === 'unique')[0]?.id === r.id

/* ---------- план по дням ---------- */
const today = () => new Date().toISOString().slice(0, 10)
const planDates = computed(() => [...new Set(logOf(heroId.value).map(r => r.date))].sort().reverse())
const planDate = ref('')
const planPicked = ref(false) // сессию выбрали руками — не перескакиваем на последнюю
watch([heroId, planDates], ([h], [oldH]) => {
  if (h !== oldH) planPicked.value = false
  if (!planPicked.value || !planDate.value) planDate.value = planDates.value[0] || today()
}, { immediate: true })
const pickPlanDate = d => { planDate.value = d; planPicked.value = true }
// в выборе сессии — и новая дата, которой ещё нет в журнале
const planDateList = computed(() => [...new Set([planDate.value, ...planDates.value])].filter(Boolean).sort().reverse())
const planRows = computed(() => logOf(heroId.value).filter(r => r.date === planDate.value && r.status !== 'cancel'))
const planDays = computed(() => Math.ceil(limit.value / 24))
const moveDay = (r, day) => call(() => api('PUT', `/api/activities/${heroId.value}/${r.id}`, { day }))
const editFromPlan = r => { if (master.value || (hero.value?.canWrite && ['plan', 'pending'].includes(r.status))) startEdit(heroId.value, r) }
async function sendPlans(rows) {
  busy.value = true
  try { for (const r of rows) await api('PUT', `/api/activities/${heroId.value}/${r.id}`, { status: 'pending' }); toast(`Отправлено мастеру: ${rows.length}`); sfx('pageFlip', 0.5) } catch (e) { toast(e.message, 'error') } finally { busy.value = false; loadActivities(true) }
}

/* ---------- запись ---------- */
const busy = ref(false)
const form = ref(null) // { heroId, id?, rec, key }
// дата новой записи — последняя сессия героя, если она не старше недели, иначе сегодня
function defaultDate() {
  const last = sessions.value[0]?.date
  return last && Date.now() - new Date(last + 'T12:00') < 7 * 864e5 ? last : today()
}
const blank = () => ({ date: defaultDate(), day: 0, name: '', hours: '', stamina: '', type: '', result: '', trainId: '', pts: 0, with: [], place: '', mod: '', gold: 0, silver: 0, copper: 0, exp: 0, exh: 0, items: [], status: master.value ? 'done' : 'pending' })
const startNew = (o = {}) => { form.value = { heroId: heroId.value, key: Date.now(), rec: { ...blank(), ...o } } }
function startEdit(hid, r) {
  if (hid !== heroId.value) router.replace({ query: { ...route.query, log: hid } })
  form.value = { heroId: hid, id: r.id, key: r.id, rec: JSON.parse(JSON.stringify(r)) }
  scrollTo({ top: 0, behavior: 'smooth' })
}
async function call(fn, ok) {
  busy.value = true
  try { const r = await fn(); await loadActivities(true); if (ok) toast(ok); return r || true } catch (e) { toast(e.message, 'error'); return null } finally { busy.value = false }
}
async function save(status) {
  const f = form.value
  const body = { ...f.rec, ...(status ? { status } : {}) }
  const done = await call(() => (f.id ? api('PUT', `/api/activities/${f.heroId}/${f.id}`, body) : api('POST', `/api/activities/${f.heroId}`, body)),
    f.id ? 'Запись сохранена' : master.value ? 'Записано' : status === 'plan' ? 'В черновике' : 'Записано — ждёт проверки мастера')
  if (done) form.value = f.id ? null : { heroId: f.heroId, key: Date.now(), rec: { ...blank(), date: f.rec.date, day: f.rec.day } }
}
// «ещё раз»: та же деятельность новой записью (повторяемые пишут десятками)
// ещё одна такая же; у героя изнурение, а выносливость в записи не удвоена — спросить, пересчитать ли
function repeat(hid, r) {
  const h = actState.heroes.find(x => x.heroId === hid)
  const dbl = staminaDouble(r, h, catalogMatch(catalog.value, r.name))
  let stamina = r.stamina
  if (dbl && confirm(`У героя ${h.exh} изнур. — по правилам выносливость удваивается.\nПересчитать: ${dbl.from} → ${dbl.to}?\n\nОК — пересчитать, Отмена — оставить ${dbl.from}`)) stamina = dbl.to
  return call(() => api('POST', `/api/activities/${hid}`, { ...r, stamina, result: '', pts: 0, status: master.value ? 'pending' : r.status === 'plan' ? 'plan' : 'pending' }), 'Добавлена ещё одна')
}
// мастер ставит статус; закрылась тренировка — праздник
async function setStatus(h, r, status) {
  const t = h.trainings?.find(x => x.Id === r.trainId)
  const ok = await call(() => api('PUT', `/api/activities/${h.heroId}/${r.id}`, { status }))
  if (ok && status === 'done' && t && t.Max && t.Cur < t.Max && t.Cur + (r.pts || 0) >= t.Max) {
    setTimeout(() => { celebrate(null, true); sfx('crit', 0.5); toast(`🏆 ${h.name}: тренировка «${t.Name}» завершена!`) }, 600)
  }
}
async function setAll(h, rows, status, ev) {
  const el = ev?.currentTarget
  busy.value = true
  try { for (const r of rows) await api('PUT', `/api/activities/${h.heroId}/${r.id}`, { status }); toast(`Учтено: ${rows.length}`); celebrate(el); sfx('bookPlace', 0.5) } catch (e) { toast(e.message, 'error') } finally { busy.value = false; loadActivities(true) }
}
async function remove(hid, r) {
  if (!confirm(`Удалить «${r.name.slice(0, 60)}»?`)) return
  call(() => api('DELETE', `/api/activities/${hid}/${r.id}`), 'Запись удалена')
}
async function addFav(rec) {
  const favs = [...(cfg.value.favs || []), { name: rec.name, hours: rec.hours, stamina: rec.stamina, type: rec.type, trainId: rec.trainId, mod: rec.mod, place: rec.place }]
  await call(() => api('PUT', `/api/activities-hero/${heroId.value}`, { favs }), `★ «${rec.name.slice(0, 40)}» — в избранном`)
}

/* ---------- броски: общие кубики сайта → в запись (сервер сверяет с лентой бросков) ---------- */
function rollRec(h, r) {
  const n = normAct(r.name)
  const same = logOf(h.heroId).filter(x => x.date === r.date && normAct(x.name) === n && x.status !== 'cancel')
  const rep = r.type === 'repeat' ? Math.min(10, Math.max(0, same.findIndex(x => x.id === r.id))) : 0
  // модификаторы из строки «Модификаторы броска: …» складываются сами; длительная тренировка — 2к20 и × 1.35
  const plan = rollPlan(r, mods.value.find(x => x.name === r.mod), rep)
  const label = r.name.replace(/\s*\(.*$/, '').slice(0, 40)
  if (plan.long && !plan.items.length) toast('В описании нет строки «Модификаторы броска: …» с числами — кидается 2к20 без модов', 'error')
  else if (plan.unknown.length) toast(`Без числа, в бросок не вошли: ${plan.unknown.join(', ')}`)
  requestRoll({ formula: plan.formula, label, onDone: roll => send(h.heroId, r, { ...roll, label, long: plan.long, add: plan.add, miss: plan.unknown.join(', ') }) })
}
async function send(hid, r, roll, retry = true) {
  await new Promise(res => setTimeout(res, 400)) // бросок сначала проходит по сокету — запись принимается после
  try { await api('POST', `/api/activities/${hid}/${r.id}/roll`, roll); await loadActivities(true); toast('🎲 Бросок записан') } catch (e) {
    if (retry && /не прошёл/.test(e.message)) return send(hid, r, roll, false)
    toast(e.message, 'error')
  }
}
async function coin(hid, r) {
  const rec = await call(() => api('POST', `/api/activities/${hid}/${r.id}/coin`))
  if (rec?.coin) { toast(rec.coin.win ? '🍀 Повезло — выносливость на это не потрачена!' : '🍀 Не повезло — выносливость тратится'); if (rec.coin.win) { celebrate(null); sfx('coins', 0.5) } }
}
// «Записать деятельность» из быстрого перехода (?new=1) — сразу форма
watch(() => [route.query.new, hero.value?.canWrite], ([n, can]) => {
  if (n && can) { startNew(); router.replace({ query: { ...route.query, new: undefined } }) }
}, { immediate: true })
</script>

<style scoped>
.al { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; min-width: 0; }
.al-empty { padding: 24px; text-align: center; color: #a8936c; }
.al-empty :deep(.lfx) { display: inline-block; }
.al-top { display: flex; align-items: flex-start; gap: 8px; }
.al-heroes { flex: 1; min-width: 0; display: flex; gap: 6px; overflow-x: auto; padding: 2px 2px 8px; scrollbar-width: thin; }
.al-info { flex: none; width: 34px; height: 34px; margin-top: 4px; border-radius: 50%; border: 2px solid #e7c56f; background: radial-gradient(circle at 35% 30%, #3a2c18, #15110c); color: #f3dc9e; font: italic 900 17px Georgia, serif; cursor: pointer; box-shadow: 0 0 14px rgba(231, 197, 111, .25); transition: transform .2s, box-shadow .2s; }
.al-info:hover { transform: scale(1.1) rotate(-8deg); box-shadow: 0 0 22px rgba(231, 197, 111, .5); }
.al-hero { position: relative; display: grid; justify-items: center; gap: 4px; flex: none; width: 76px; padding: 8px 4px 6px; border-radius: 14px; border: 1px solid rgba(231, 197, 111, .16); background: rgba(20, 16, 11, .6); color: #cdbf9f; cursor: pointer; transition: border-color .2s, transform .2s, background .2s; }
.al-hero:hover { transform: translateY(-2px); border-color: rgba(231, 197, 111, .45); }
.al-hero.on { border-color: #e7c56f; background: linear-gradient(180deg, rgba(231, 197, 111, .16), rgba(20, 16, 11, .7)); color: #f3dc9e; box-shadow: 0 0 18px rgba(231, 197, 111, .15); }
.al-hero.mine .al-av { border-color: #7ed07a; }
.al-av { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 50%; overflow: hidden; border: 2px solid rgba(231, 197, 111, .45); background: #120d08; color: #f3dc9e; font: 700 19px 'Cormorant Garamond', serif; }
.al-av img { width: 100%; height: 100%; object-fit: cover; }
.al-hero b { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 700 11.5px 'Manrope', sans-serif; }
.al-hero em { position: absolute; top: 4px; right: 6px; min-width: 18px; height: 18px; padding: 0 4px; border-radius: 99px; background: #f0b54f; color: #1b1408; font: 900 10.5px/18px 'Manrope', sans-serif; font-style: normal; }
.al-hero.queue .al-av { border-color: #f0b54f; font-size: 18px; }
.al-lock { margin: 0; padding: 8px 12px; border-radius: 12px; background: rgba(240, 181, 79, .1); border: 1px solid rgba(240, 181, 79, .35); color: #f6cf86; font: 700 12.5px 'Manrope', sans-serif; }
.al-tools { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.al-tools h2 { margin: 0; font: 700 26px 'Cormorant Garamond', serif; color: #f3dc9e; }
.al-chip { padding: 2px 9px; border-radius: 99px; background: rgba(240, 181, 79, .14); color: #f6cf86; font: 800 12px 'Manrope', sans-serif; }
.al-chip.exh { background: rgba(255, 122, 107, .16); color: #ffb3aa; }
.al-chip.sleep { background: rgba(155, 125, 255, .2); color: #d2c4ff; box-shadow: 0 0 10px rgba(155, 125, 255, .35); }
.al-chip small { opacity: .6; }
.al-views { display: flex; flex-wrap: wrap; gap: 3px; padding: 3px; border-radius: 12px; background: rgba(0, 0, 0, .25); }
.al-views button { padding: 5px 11px; border-radius: 9px; border: 0; background: none; color: #cdbf9f; font: 700 12.5px 'Manrope', sans-serif; cursor: pointer; }
.al-views button.on { background: linear-gradient(180deg, rgba(240, 208, 131, .3), rgba(201, 162, 79, .2)); color: #f3dc9e; box-shadow: inset 0 0 0 1px rgba(231, 197, 111, .5); }
.al-budget { margin: -4px 0 0; color: #a8936c; font: 600 12.5px 'Manrope', sans-serif; }
.al-budget b { color: #f3dc9e; }
.al-budget span { opacity: .8; }
.al-note { margin: -4px 0 0; padding: 6px 10px; border-radius: 10px; background: rgba(255, 255, 255, .03); color: #cdbf9f; font: 600 12.5px 'Manrope', sans-serif; }
.al-note.ban { background: rgba(255, 122, 107, .08); color: #ffb3aa; }
.al-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.al-q { flex: 1 1 160px; max-width: 280px; padding: 6px 10px; border-radius: 9px; border: 1px solid rgba(231, 197, 111, .22); background: rgba(0, 0, 0, .3); color: #efe3c8; font: 600 13px 'Manrope', sans-serif; }
.al-in { padding: 6px 8px; border-radius: 9px; border: 1px solid rgba(231, 197, 111, .22); background: rgba(0, 0, 0, .3); color: #efe3c8; font: 600 13px 'Manrope', sans-serif; color-scheme: dark; }
.grow { flex: 1; }
.al-btn { padding: 6px 12px; border-radius: 9px; border: 1px solid rgba(231, 197, 111, .35); background: rgba(231, 197, 111, .08); color: #f3d99a; font: 700 12.5px 'Manrope', sans-serif; cursor: pointer; white-space: nowrap; }
.al-btn.primary { background: linear-gradient(180deg, #f0d083, #c9a24f); color: #1b1408; border-color: #c9a24f; }
.al-btn.ok { border-color: rgba(126, 208, 122, .5); color: #b5ecb2; background: rgba(126, 208, 122, .08); }
.al-more { justify-self: center; }
.al-sess { display: grid; grid-template-columns: minmax(0, 1fr); gap: 6px; padding: 10px; border-radius: 16px; background: rgba(20, 16, 11, .55); border: 1px solid rgba(231, 197, 111, .12); }
.al-rows { display: grid; grid-template-columns: minmax(0, 1fr); gap: 4px; }
.al-sh { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 0 4px; }
.al-sh > b { font: 700 18px 'Cormorant Garamond', serif; color: #f3dc9e; }
.al-sum { padding: 2px 8px; border-radius: 99px; background: rgba(255, 255, 255, .04); color: #cdbf9f; font: 800 12px 'Manrope', sans-serif; }
.al-sum small { color: #a8936c; }
.al-sum.over { background: rgba(255, 122, 107, .16); color: #ffb3aa; }
.al-sum.pend { background: rgba(240, 181, 79, .16); color: #f6cf86; }
.al-sum.plan { background: rgba(185, 166, 255, .14); color: #d2c8ff; }
@media (max-width: 600px) { .al-q { max-width: none; } .al-tools h2 { flex: 1 1 100%; } .al-views { width: 100%; } .al-views button { flex: 1; padding: 5px 4px; } }
</style>
