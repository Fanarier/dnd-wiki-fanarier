<template>
  <!-- журнал деятельностей: что герои делали между сессиями (бывшая Google Таблица). Видят все; пишет хозяин героя,
       новая запись «на проверке» — мастер ставит «учтено / провал / условие / отменено». Учтённая запись с тренировкой
       прибавляет очки к прогрессу в листе. Под каждой сессией — сумма часов и выносливости -->
  <div class="al">
    <div v-if="!store.me" class="al-empty">Журналы деятельностей видны после входа.</div>
    <div v-else-if="!actState.loaded" class="al-empty">Листаю журналы…</div>
    <template v-else>
      <!-- герои -->
      <nav class="al-heroes">
        <button v-if="master" type="button" class="al-hero queue" :class="{ on: queue }" @click="pickQueue">
          <span class="al-av">⏳</span><b>На проверке</b><em v-if="pendingAll">{{ pendingAll }}</em>
        </button>
        <button v-for="h in heroList" :key="h.heroId" type="button" class="al-hero" :class="{ on: !queue && h.heroId === heroId, mine: h.canWrite && !master }" @click="pick(h.heroId)">
          <span class="al-av"><img v-if="avatar(h.heroId)" :src="avatar(h.heroId)" alt="" /><template v-else>{{ h.name[0] }}</template></span>
          <b>{{ short(h.name) }}</b>
          <em v-if="pendingOf(h.heroId) && (master || h.canWrite)">{{ pendingOf(h.heroId) }}</em>
        </button>
      </nav>

      <!-- мастер: все записи на проверке разом -->
      <template v-if="queue">
        <div v-if="!pendingAll" class="al-empty">Всё проверено ✓</div>
        <section v-for="g in queueGroups" :key="g.hero.heroId" class="al-sess">
          <header class="al-sh"><b>{{ g.hero.name }}</b><span class="al-sum">{{ g.rows.length }} на проверке</span>
            <span class="grow" />
            <button type="button" class="al-btn ok" @click="setAll(g.hero.heroId, g.rows, 'done')">✓ Учесть все</button>
          </header>
          <ActivityRow v-for="r in g.rows" :key="r.id" :rec="r" :hero="g.hero" :master="master" :show-date="true"
                       @status="setStatus(g.hero.heroId, r, $event)" @edit="startEdit(g.hero.heroId, r)" @remove="remove(g.hero.heroId, r)" @repeat="repeat(g.hero.heroId, r)" />
        </section>
      </template>

      <template v-else-if="hero">
        <div class="al-tools">
          <h2>{{ hero.name }}</h2>
          <span v-if="hero.stamina != null" class="al-chip" title="Выносливость в листе">⚡ {{ hero.stamina }}</span>
          <span class="grow" />
          <input v-model="q" class="al-q" placeholder="Найти в журнале…" />
          <select v-model="stFilter" class="al-in">
            <option value="">Все статусы</option>
            <option v-for="(s, k) in ACT_STATUS" :key="k" :value="k">{{ s.name }}</option>
          </select>
          <button v-if="hero.canWrite" type="button" class="al-btn primary" @click="startNew">＋ Деятельность</button>
        </div>
        <p class="al-hint">
          Между сессиями — <b>{{ actState.limit }} ч</b>.
          <template v-if="master"><label class="al-lim">лимит <input type="number" min="1" :value="actState.limit" class="al-in tiny" @change="setLimit($event.target.value)" /></label></template>
          <template v-if="hero.canWrite && !master"> Новая запись уходит мастеру на проверку; пока он не проверил — её можно править.</template>
        </p>

        <!-- новая / правка -->
        <ActivityForm v-if="form && form.heroId === heroId" v-model="form.rec" :hero="hero" :master="master" :catalog="catalog" :busy="busy" :is-new="!form.id"
                      @save="save" @cancel="form = null" />

        <div v-if="!sessions.length" class="al-empty">{{ q || stFilter ? 'Ничего не нашлось.' : 'Журнал пуст.' }}</div>
        <section v-for="s in shownSessions" :key="s.date" class="al-sess">
          <header class="al-sh">
            <b>{{ fmtDate(s.date) }}</b>
            <span class="al-sum" :class="{ over: s.hours > actState.limit }" :title="s.hours > actState.limit ? `Больше ${actState.limit} ч между сессиями` : 'Часы за сессию'">⏱ {{ round(s.hours, 2) }}<small> / {{ actState.limit }} ч</small></span>
            <span class="al-sum" :class="{ over: hero.stamina != null && s.stamina > hero.stamina }" :title="hero.stamina != null && s.stamina > hero.stamina ? 'Потрачено больше выносливости, чем есть в листе' : 'Выносливость за сессию (отдых — со знаком минус)'">⚡ {{ round(s.stamina, 2) }}</span>
            <span class="al-sum">{{ s.rows.length }} {{ s.rows.length === 1 ? 'запись' : s.rows.length < 5 ? 'записи' : 'записей' }}</span>
            <span v-if="s.pending" class="al-sum pend">⏳ {{ s.pending }}</span>
            <span class="grow" />
            <button v-if="master && s.pending" type="button" class="al-btn ok" @click="setAll(heroId, s.rows.filter(r => r.status === 'pending'), 'done')">✓ Учесть все</button>
          </header>
          <ActivityRow v-for="r in s.rows" :key="r.id" :rec="r" :hero="hero" :master="master"
                       @status="setStatus(heroId, r, $event)" @edit="startEdit(heroId, r)" @remove="remove(heroId, r)" @repeat="repeat(heroId, r)" />
        </section>
        <button v-if="sessions.length > shownSessions.length" type="button" class="al-btn al-more" @click="more += 6">Ещё сессии: {{ sessions.length - shownSessions.length }}</button>
      </template>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { store, actState, loadActivities, rulesState, api, toast, heroPortraitUrl, heroCover } from '../../map/store.js'
import { ACT_STATUS, num, round, activityCatalog } from '../../shared/activities.js'
import ActivityRow from './ActivityRow.vue'
import ActivityForm from './ActivityForm.vue'

const route = useRoute()
const router = useRouter()
const master = computed(() => store.role === 'master')
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
const pick = id => { form.value = null; more.value = 4; router.replace({ query: { ...route.query, log: id } }) }
const pickQueue = () => { form.value = null; router.replace({ query: { ...route.query, log: 'queue' } }) }

/* ---------- сессии: записи по датам, новые сверху ---------- */
const q = ref('')
const stFilter = ref('')
const more = ref(4)
const norm = s => String(s || '').toLowerCase().replace(/ё/g, 'е')
const sessions = computed(() => {
  const t = norm(q.value.trim())
  const rows = logOf(heroId.value).filter(r => (!stFilter.value || r.status === stFilter.value) && (!t || norm(r.name + ' ' + r.result).includes(t)))
  const by = new Map()
  for (const r of rows) { if (!by.has(r.date)) by.set(r.date, []); by.get(r.date).push(r) }
  return [...by.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([date, rs]) => {
    const live = rs.filter(r => r.status !== 'cancel') // провал тоже тратит время, отменённое — нет
    return { date, rows: rs, hours: live.reduce((n, r) => n + num(r.hours), 0), stamina: live.reduce((n, r) => n + num(r.stamina), 0), pending: rs.filter(r => r.status === 'pending').length }
  })
})
const shownSessions = computed(() => (q.value || stFilter.value ? sessions.value : sessions.value.slice(0, more.value)))
const queueGroups = computed(() => actState.heroes.map(h => ({ hero: h, rows: logOf(h.heroId).filter(r => r.status === 'pending') })).filter(g => g.rows.length))
const fmtDate = d => {
  const t = new Date(d + 'T12:00').toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'short' })
  return t.charAt(0).toUpperCase() + t.slice(1)
}
const catalog = computed(() => activityCatalog(rulesState.articles))

/* ---------- запись ---------- */
const busy = ref(false)
const form = ref(null) // { heroId, id?, rec }
const today = () => new Date().toISOString().slice(0, 10)
// дата новой записи — последняя сессия героя, если она не старше недели, иначе сегодня
function defaultDate() {
  const last = sessions.value[0]?.date
  return last && Date.now() - new Date(last + 'T12:00') < 7 * 864e5 ? last : today()
}
const blank = () => ({ date: defaultDate(), name: '', hours: '', stamina: '', type: '', result: '', trainId: '', pts: 0, status: master.value ? 'done' : 'pending' })
const startNew = () => { form.value = { heroId: heroId.value, rec: blank() } }
function startEdit(hid, r) {
  if (hid !== heroId.value) router.replace({ query: { ...route.query, log: hid } })
  form.value = { heroId: hid, id: r.id, rec: { ...r } }
  scrollTo({ top: 0, behavior: 'smooth' })
}
async function call(fn, ok) {
  busy.value = true
  try { await fn(); await loadActivities(true); if (ok) toast(ok); return true } catch (e) { toast(e.message, 'error'); return false } finally { busy.value = false }
}
async function save() {
  const f = form.value
  const done = await call(() => (f.id ? api('PUT', `/api/activities/${f.heroId}/${f.id}`, f.rec) : api('POST', `/api/activities/${f.heroId}`, f.rec)),
    f.id ? 'Запись сохранена' : master.value ? 'Записано' : 'Записано — ждёт проверки мастера')
  if (done) form.value = f.id ? null : { heroId: f.heroId, rec: { ...blank(), date: f.rec.date } }
}
// «ещё раз»: та же деятельность новой записью (повторяемые пишут десятками)
const repeat = (hid, r) => call(() => api('POST', `/api/activities/${hid}`, { ...r, result: '', pts: 0, status: 'pending' }), 'Добавлена ещё одна')
const setStatus = (hid, r, status) => call(() => api('PUT', `/api/activities/${hid}/${r.id}`, { status }))
async function setAll(hid, rows, status) {
  busy.value = true
  try { for (const r of rows) await api('PUT', `/api/activities/${hid}/${r.id}`, { status }); toast(`Учтено: ${rows.length}`) } catch (e) { toast(e.message, 'error') } finally { busy.value = false; loadActivities(true) }
}
async function remove(hid, r) {
  if (!confirm(`Удалить «${r.name.slice(0, 60)}»?`)) return
  call(() => api('DELETE', `/api/activities/${hid}/${r.id}`), 'Запись удалена')
}
const setLimit = v => call(() => api('PUT', '/api/activities-settings', { limit: v }), 'Лимит часов сохранён')
</script>

<style scoped>
.al { display: grid; gap: 12px; min-width: 0; }
.al-empty { padding: 24px; text-align: center; color: #a8936c; }
.al-heroes { display: flex; gap: 6px; overflow-x: auto; padding: 2px 2px 8px; scrollbar-width: thin; }
.al-hero { position: relative; display: grid; justify-items: center; gap: 4px; flex: none; width: 76px; padding: 8px 4px 6px; border-radius: 14px; border: 1px solid rgba(231, 197, 111, .16); background: rgba(20, 16, 11, .6); color: #cdbf9f; cursor: pointer; transition: border-color .2s, transform .2s, background .2s; }
.al-hero:hover { transform: translateY(-2px); border-color: rgba(231, 197, 111, .45); }
.al-hero.on { border-color: #e7c56f; background: linear-gradient(180deg, rgba(231, 197, 111, .16), rgba(20, 16, 11, .7)); color: #f3dc9e; box-shadow: 0 0 18px rgba(231, 197, 111, .15); }
.al-hero.mine .al-av { border-color: #7ed07a; }
.al-av { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 50%; overflow: hidden; border: 2px solid rgba(231, 197, 111, .45); background: #120d08; color: #f3dc9e; font: 700 19px 'Cormorant Garamond', serif; }
.al-av img { width: 100%; height: 100%; object-fit: cover; }
.al-hero b { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 700 11.5px 'Manrope', sans-serif; }
.al-hero em { position: absolute; top: 4px; right: 6px; min-width: 18px; height: 18px; padding: 0 4px; border-radius: 99px; background: #f0b54f; color: #1b1408; font: 900 10.5px/18px 'Manrope', sans-serif; font-style: normal; }
.al-hero.queue .al-av { border-color: #f0b54f; font-size: 18px; }
.al-tools { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.al-tools h2 { margin: 0; font: 700 26px 'Cormorant Garamond', serif; color: #f3dc9e; }
.al-chip { padding: 2px 9px; border-radius: 99px; background: rgba(240, 181, 79, .14); color: #f6cf86; font: 800 12px 'Manrope', sans-serif; }
.al-q { flex: 1 1 160px; max-width: 260px; padding: 6px 10px; border-radius: 9px; border: 1px solid rgba(231, 197, 111, .22); background: rgba(0, 0, 0, .3); color: #efe3c8; font: 600 13px 'Manrope', sans-serif; }
.al-in { padding: 6px 8px; border-radius: 9px; border: 1px solid rgba(231, 197, 111, .22); background: rgba(0, 0, 0, .3); color: #efe3c8; font: 600 13px 'Manrope', sans-serif; color-scheme: dark; }
.al-in.tiny { width: 70px; padding: 2px 6px; }
.al-hint { margin: -4px 0 0; color: #a8936c; font: 600 12.5px 'Manrope', sans-serif; }
.al-hint b { color: #f3dc9e; }
.al-lim { margin-left: 6px; }
.grow { flex: 1; }
.al-btn { padding: 6px 12px; border-radius: 9px; border: 1px solid rgba(231, 197, 111, .35); background: rgba(231, 197, 111, .08); color: #f3d99a; font: 700 12.5px 'Manrope', sans-serif; cursor: pointer; white-space: nowrap; }
.al-btn.primary { background: linear-gradient(180deg, #f0d083, #c9a24f); color: #1b1408; border-color: #c9a24f; }
.al-btn.ok { border-color: rgba(126, 208, 122, .5); color: #b5ecb2; background: rgba(126, 208, 122, .08); }
.al-more { justify-self: center; }
.al-sess { display: grid; gap: 4px; padding: 10px; border-radius: 16px; background: rgba(20, 16, 11, .55); border: 1px solid rgba(231, 197, 111, .12); }
.al-sh { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 0 4px 6px; border-bottom: 1px solid rgba(231, 197, 111, .1); }
.al-sh > b { font: 700 18px 'Cormorant Garamond', serif; color: #f3dc9e; }
.al-sum { padding: 2px 8px; border-radius: 99px; background: rgba(255, 255, 255, .04); color: #cdbf9f; font: 800 12px 'Manrope', sans-serif; }
.al-sum small { color: #a8936c; }
.al-sum.over { background: rgba(255, 122, 107, .16); color: #ffb3aa; }
.al-sum.pend { background: rgba(240, 181, 79, .16); color: #f6cf86; }
@media (max-width: 600px) { .al-q { max-width: none; } .al-tools h2 { flex: 1 1 100%; } }
</style>
