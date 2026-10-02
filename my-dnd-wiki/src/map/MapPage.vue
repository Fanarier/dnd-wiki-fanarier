<template>
  <div class="anacaria" :class="{ 'is-master': master }">
    <MapCanvas ref="canvas" />

    <!-- Верхняя панель -->
    <header class="topbar">
      <div class="brand ui-panel">
        <svg class="sigil" viewBox="0 0 32 32" aria-hidden="true">
          <circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" stroke-width="1.5" />
          <path d="M16 3 L19 16 L16 29 L13 16 Z" fill="currentColor" />
          <path d="M3 16 L16 13.5 L29 16 L16 18.5 Z" fill="currentColor" opacity=".55" />
        </svg>
        <div class="brand-text">
          <div class="ui-title brand-name">{{ s.worldName || 'Анкария' }}</div>
          <div class="brand-date">{{ s.worldDate }}</div>
        </div>
      </div>

      <div class="search ui-panel" :class="{ focused: searchOpen }">
        <Icon name="search" :size="18" class="ui-muted" />
        <input
          v-model="query"
          placeholder="Найти город, народ, место…"
          aria-label="Поиск по карте"
          @focus="searchOpen = true"
          @blur="closeSearchSoon"
          @keydown.down.prevent="hl = Math.min(hl + 1, results.length - 1)"
          @keydown.up.prevent="hl = Math.max(hl - 1, 0)"
          @keydown.enter.prevent="results[hl] && go(results[hl])"
          @keydown.esc="query = ''"
        />
        <ul v-if="searchOpen && results.length" class="results ui-panel">
          <li v-for="(r, i) in results" :key="r.type + r.id" :class="{ hl: i === hl }" @mousedown.prevent="go(r)" @mouseenter="hl = i">
            <Icon :name="r.icon" :size="16" :style="{ color: r.color }" />
            <span class="r-name">{{ r.name }}</span>
            <span class="ui-muted r-kind">{{ r.kind }}</span>
          </li>
        </ul>
      </div>

      <div class="right ui-panel">
        <div class="clock" :title="store.connected ? 'Связь с сервером есть — изменения приходят вживую' : 'Нет связи с сервером, переподключаюсь…'">
          <i class="live" :class="{ on: store.connected }" />
          <Icon name="clock" :size="16" class="ui-muted" />
          <span>{{ clock }}</span>
        </div>
        <router-link to="/wiki" class="ui-btn ghost small nav"><Icon name="wiki" :size="17" /><span class="hide-sm">Вики</span></router-link>
        <template v-if="master">
          <button class="ui-btn ghost icon" title="Настройки мира" @click="settingsOpen = true"><Icon name="settings" :size="18" /></button>
          <button class="ui-btn small master-chip" title="Выйти" @click="logout"><Icon name="crown" :size="15" /><span class="hide-sm">Мастер</span><Icon name="logout" :size="15" /></button>
        </template>
        <button v-else class="ui-btn primary small" @click="loginOpen = true"><Icon name="login" :size="16" /> Войти</button>
      </div>
    </header>

    <LegendPanel @focus="onFocus" />

    <transition name="slide">
      <JourneyPanel v-if="store.journeyPlan" />
      <InfoPanel v-else-if="store.selection" :key="store.selection.type + store.selection.id" />
    </transition>

    <transition name="fade">
      <button v-if="store.follow && !master" class="follow-chip ui-panel" @click="store.follow = null">
        <Icon name="eye" :size="16" /> {{ store.follow.by || 'Мастер' }} показывает карту · выйти
      </button>
    </transition>

    <MasterToolbar />
    <HudPanel />

    <!-- Зум и масштаб -->
    <div class="zoom ui-panel" :class="{ shifted: store.selection || store.journeyPlan }">
      <button class="ui-btn icon ghost" title="Приблизить (+)" @click="canvas.zoomBy(1.5)"><Icon name="plus" /></button>
      <button class="ui-btn icon ghost" title="Отдалить (−)" @click="canvas.zoomBy(1 / 1.5)"><Icon name="minus" /></button>
      <button class="ui-btn icon ghost" title="Вся карта" @click="canvas.fit()"><Icon name="fit" :size="18" /></button>
      <button v-if="master" class="ui-btn icon ghost show-view" title="Показать всем мой вид — камеры игроков прилетят сюда" @click="showMyView"><Icon name="eye" :size="18" /></button>
    </div>
    <div class="scale" :class="{ shifted: store.selection || store.journeyPlan }">
      <div class="scale-bar" :style="{ width: scale.px + 'px' }" />
      <span>{{ scale.label }}</span>
    </div>

    <!-- Загрузка -->
    <transition name="fade">
      <div v-if="!store.ready" class="loading">
        <div class="ui-title">Разворачиваем карту Анкарии…</div>
      </div>
    </transition>

    <!-- Вход -->
    <div v-if="loginOpen" class="modal" @mousedown.self="loginOpen = false">
      <form class="dialog ui-panel" @submit.prevent="doLogin">
        <div class="ui-kicker">Только для мастера</div>
        <h2 class="ui-title">Вход</h2>
        <label class="ui-field"><span>Логин</span><input ref="loginInput" v-model="loginForm.login" class="ui-input" autocomplete="username" /></label>
        <label class="ui-field"><span>Пароль</span><input v-model="loginForm.password" type="password" class="ui-input" autocomplete="current-password" /></label>
        <div v-if="loginError" class="err">{{ loginError }}</div>
        <div class="dialog-actions">
          <button type="button" class="ui-btn" @click="loginOpen = false">Отмена</button>
          <button type="submit" class="ui-btn primary" :disabled="loginBusy">Войти</button>
        </div>
      </form>
    </div>

    <!-- Настройки -->
    <div v-if="settingsOpen" class="modal" @mousedown.self="settingsOpen = false">
      <form class="dialog ui-panel wide" @submit.prevent="saveSettings">
        <div class="ui-kicker">Мастер</div>
        <h2 class="ui-title">Настройки мира</h2>
        <div class="ui-row">
          <label class="ui-field"><span>Название мира</span><input v-model="sf.worldName" class="ui-input" /></label>
          <label class="ui-field"><span>Дата в мире (видят все)</span><input v-model="sf.worldDate" class="ui-input" /></label>
        </div>
        <div class="ui-row">
          <label class="ui-field"><span>Км на пиксель карты</span><input v-model.number="sf.kmPerPx" type="number" step="0.01" min="0.001" class="ui-input" /></label>
          <label class="ui-field"><span>Темп отряда, км/игр. день</span><input v-model.number="sf.paceKmPerDay" type="number" min="1" class="ui-input" /></label>
        </div>
        <label class="ui-field"><span>1 игровой день = сколько реальных часов</span><input v-model.number="sf.realHoursPerGameDay" type="number" step="0.1" min="0.01" class="ui-input" /></label>
        <p class="ui-muted small">Например, 24 — время в мире идёт как в жизни; 1 — день похода длится реальный час.</p>
        <label class="ui-check"><input v-model="sf.fogEnabled" type="checkbox" /> Туман войны включён</label>
        <label class="ui-check"><input v-model="sf.playerPings" type="checkbox" /> Игроки могут ставить пинги</label>

        <div class="ui-kicker sec">Сетка мастера</div>
        <div class="ui-row">
          <label class="ui-field"><span>Клетка, км</span><input v-model.number="sf.grid.cellKm" type="number" step="0.5" min="0.1" class="ui-input" /></label>
          <label class="ui-field"><span>Форма</span>
            <select v-model="sf.grid.type" class="ui-input"><option value="square">Квадраты</option><option value="hex">Шестиугольники</option></select>
          </label>
        </div>

        <div class="ui-kicker sec">Калибровка масштаба</div>
        <p class="ui-muted small">Выбери два города и настоящее расстояние между ними — км на пиксель посчитаются сами.</p>
        <div class="ui-row">
          <select v-model="cal.a" class="ui-input"><option v-for="c in citiesSorted" :key="c.id" :value="c.id">{{ c.name }}</option></select>
          <select v-model="cal.b" class="ui-input"><option v-for="c in citiesSorted" :key="c.id" :value="c.id">{{ c.name }}</option></select>
        </div>
        <div class="ui-row cal-row">
          <label class="ui-field"><span>Расстояние, км</span><input v-model.number="cal.km" type="number" min="0.1" step="0.1" class="ui-input" /></label>
          <button type="button" class="ui-btn small" :disabled="!calResult" @click="sf.kmPerPx = calResult">Применить: {{ calResult ? calResult + ' км/px' : '—' }}</button>
        </div>
        <hr class="ui-divider" />
        <a class="ui-btn small" href="#" @click.prevent="exportDb"><Icon name="download" :size="16" /> Скачать резервную копию мира</a>
        <div class="dialog-actions">
          <button type="button" class="ui-btn" @click="settingsOpen = false">Закрыть</button>
          <button type="submit" class="ui-btn primary">Сохранить</button>
        </div>
      </form>
    </div>

    <!-- Уведомления -->
    <div class="toasts">
      <transition-group name="fade">
        <div v-for="t in store.toasts" :key="t.id" class="toast ui-panel" :class="t.kind">{{ t.text }}</div>
      </transition-group>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import './map-ui.css'
import Icon from './Icon.vue'
import MapCanvas from './MapCanvas.vue'
import LegendPanel from './LegendPanel.vue'
import InfoPanel from './InfoPanel.vue'
import JourneyPanel from './JourneyPanel.vue'
import MasterToolbar from './MasterToolbar.vue'
import HudPanel from './HudPanel.vue'
import { store, isMaster, init, login, logout, api, act, km, toast, sendFollow } from './store.js'
import { CITY_TYPES, ZONE_EFFECTS, POINT_EFFECTS } from '../shared/catalog.js'
import { partyPosition, anomalyState } from '../shared/geo.js'

const canvas = ref(null)
const master = isMaster
const s = computed(() => store.data.settings)

onMounted(init)

// ссылки из вики: ?focus=quests:ID — показать заказ, ?pick=quest:ID — выбрать место заказа
const route = useRoute()
const router = useRouter()
watch(() => [route.query.focus, route.query.pick, store.ready], () => {
  if (!store.ready) return
  const { focus, pick } = route.query
  if (focus) {
    const [type, id] = String(focus).split(':')
    const o = store.data[type]?.find(x => x.id === id)
    if (o) {
      store.selection = { type, id }
      if (o.loc) setTimeout(() => canvas.value?.flyTo(o.loc.x, o.loc.y, 4), 300)
    }
  }
  if (pick && String(pick).startsWith('quest:')) {
    store.pick = { purpose: 'questLoc', id: String(pick).slice(6) }
    toast('Кликни на карте место заказа')
  }
  if (focus || pick) router.replace({ query: {} })
}, { immediate: true })

/* ---------- Часы ---------- */
const clock = computed(() => new Date(store.now).toLocaleString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))

/* ---------- Масштабная линейка ---------- */
const scale = computed(() => {
  const k = canvas.value?.view.k || 1
  const kmPerScreenPx = km(1) / k
  const target = 110 * kmPerScreenPx
  const nice = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000].find(n => n >= target * 0.6) || 2000
  return { px: nice / kmPerScreenPx, label: `${nice} км` }
})

/* ---------- Поиск ---------- */
const query = ref('')
const searchOpen = ref(false)
const hl = ref(0)
const results = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return []
  const out = []
  const push = (type, o, kind, icon, color) => {
    if ((o.name || '').toLowerCase().includes(q)) out.push({ type, id: o.id, name: o.name, kind, icon, color, starts: o.name.toLowerCase().startsWith(q) })
  }
  for (const st of store.data.states) push('states', st, 'народ', 'states', st.color)
  for (const c of store.data.cities) push('cities', c, CITY_TYPES[c.type]?.label.toLowerCase(), CITY_TYPES[c.type]?.icon, 'var(--gold)')
  for (const a of store.data.anomalies) push('anomalies', a, 'аномалия', a.kind === 'zone' ? 'zone' : POINT_EFFECTS[a.effect]?.icon, (a.kind === 'zone' ? ZONE_EFFECTS : POINT_EFFECTS)[a.effect]?.color)
  for (const p of store.data.parties) push('parties', p, 'отряд', p.icon, p.color)
  for (const r of store.data.roads) if (r.name) push('roads', r, 'дорога', 'roadType', '#c8743a')
  for (const r of store.data.routes) push('routes', r, 'маршрут', 'ship', r.color)
  return out.sort((a, b) => b.starts - a.starts || a.name.localeCompare(b.name, 'ru')).slice(0, 9)
})
watch(query, () => { hl.value = 0 })
function closeSearchSoon() { setTimeout(() => { searchOpen.value = false }, 120) }

function locate(type, o) {
  if (type === 'cities') return [o.x, o.y, 4]
  if (type === 'parties') { const p = partyPosition(o, store.now); return [p.x, p.y, 3.5] }
  if (type === 'anomalies') { const a = anomalyState(o, store.now); return [a.x, a.y, 3] }
  if (type === 'roads' || type === 'routes') { const m = o.points[Math.floor(o.points.length / 2)]; return [m[0], m[1], 3] }
  if (type === 'states') {
    const cap = store.data.cities.find(c => c.id === o.capitalId)
    const p = o.pole || (cap && [cap.x, cap.y])
    return p ? [p[0], p[1], 2.2] : null
  }
}
function onFocus(type, o) {
  const t = locate(type, o)
  if (t) canvas.value.flyTo(t[0], t[1], Math.max(canvas.value.view.k, t[2]))
}
function go(r) {
  const o = store.data[r.type].find(x => x.id === r.id)
  store.selection = { type: r.type, id: r.id }
  onFocus(r.type, o)
  query.value = ''
  searchOpen.value = false
}

function showMyView() {
  sendFollow({ mode: 'view', ...canvas.value.currentView() })
  toast('Игроки смотрят туда же, куда и ты')
}

/* ---------- Вход ---------- */
const loginOpen = ref(false)
const loginBusy = ref(false)
const loginError = ref('')
const loginForm = reactive({ login: '', password: '' })
const loginInput = ref(null)
watch(loginOpen, open => { if (open) nextTick(() => loginInput.value?.focus()) })
async function doLogin() {
  loginBusy.value = true
  loginError.value = ''
  try {
    await login(loginForm.login.trim(), loginForm.password)
    loginOpen.value = false
    loginForm.password = ''
    toast('Добро пожаловать, мастер')
  } catch (e) {
    loginError.value = e.message
  } finally {
    loginBusy.value = false
  }
}

/* ---------- Настройки ---------- */
const settingsOpen = ref(false)
const sf = reactive({})
watch(settingsOpen, open => {
  if (open) Object.assign(sf, JSON.parse(JSON.stringify(store.data.settings)), { grid: { cellKm: 10, type: 'square', ...store.data.settings.grid } })
})

// калибровка: Марико — Сиратори по умолчанию (так её задал мастер)
const cal = reactive({ a: 'c9', b: 'c1', km: 30 })
const citiesSorted = computed(() => [...store.data.cities].sort((x, y) => x.name.localeCompare(y.name, 'ru')))
const calResult = computed(() => {
  const a = store.data.cities.find(c => c.id === cal.a), b = store.data.cities.find(c => c.id === cal.b)
  const d = a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0
  return d > 0 && cal.km > 0 ? Math.round((cal.km / d) * 1000) / 1000 : null
})
async function saveSettings() {
  const { worldName, worldDate, kmPerPx, paceKmPerDay, realHoursPerGameDay, fogEnabled, playerPings, grid } = sf
  try {
    await act('PATCH', '/api/settings', { worldName, worldDate, kmPerPx, paceKmPerDay, realHoursPerGameDay, fogEnabled, playerPings, grid }, 'Настройки сохранены')
    settingsOpen.value = false
  } catch { /* тост */ }
}
async function exportDb() {
  try {
    const data = await api('GET', '/api/export')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }))
    a.download = `anacaria-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
  } catch (e) {
    toast(e.message, 'error')
  }
}
</script>

<style scoped>
.topbar { position: absolute; top: 12px; left: 16px; right: 16px; display: flex; align-items: center; gap: 12px; z-index: 30; pointer-events: none; }
.topbar > * { pointer-events: auto; }
.brand { display: flex; align-items: center; gap: 10px; height: 52px; padding: 0 16px 0 12px; flex: none; }
.sigil { width: 30px; height: 30px; color: var(--gold); }
.brand-name { font-size: 24px; line-height: 1; }
.brand-date { font-size: 11px; color: var(--muted); font-weight: 600; margin-top: 2px; }
.search { position: relative; flex: 1; max-width: 460px; height: 44px; margin: 0 auto; display: flex; align-items: center; gap: 8px; padding: 0 14px; transition: border-color .15s; }
.search.focused { border-color: rgba(231, 197, 111, 0.5); }
.search input { flex: 1; min-width: 0; background: none; border: 0; outline: none; color: var(--text); font: 500 14px var(--sans); }
.search input::placeholder { color: var(--muted); }
.results { position: absolute; top: calc(100% + 6px); left: 0; right: 0; list-style: none; margin: 0; padding: 6px; }
.results li { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 8px; cursor: pointer; }
.results li.hl { background: rgba(231, 197, 111, 0.12); }
.r-name { font-weight: 700; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.r-kind { font-size: 12px; }
.right { display: flex; align-items: center; gap: 4px; height: 52px; padding: 0 8px; flex: none; }
.clock { display: flex; align-items: center; gap: 7px; padding: 0 10px; font-size: 13px; font-weight: 600; white-space: nowrap; }
.live { width: 8px; height: 8px; border-radius: 50%; background: var(--danger); }
.live.on { background: var(--ok); box-shadow: 0 0 0 0 rgba(126, 224, 163, .6); animation: live 2.4s infinite; }
.nav { text-decoration: none; }
.master-chip { color: var(--gold-2); border-color: rgba(231, 197, 111, 0.4); background: rgba(231, 197, 111, 0.1); }

.zoom { position: absolute; right: 16px; bottom: 16px; display: flex; flex-direction: column; padding: 4px; z-index: 16; transition: right .2s; }
.scale { position: absolute; right: 76px; bottom: 22px; display: flex; flex-direction: column; align-items: flex-end; gap: 3px; z-index: 16; font: 700 11px var(--sans); color: #fff; text-shadow: 0 1px 3px #000; pointer-events: none; transition: right .2s; }
.scale-bar { height: 6px; border: 2px solid #fff; border-top: 0; box-shadow: 0 1px 2px rgba(0, 0, 0, .6); }
.zoom.shifted { right: 392px; }
.scale.shifted { right: 452px; }

.loading { position: absolute; inset: 0; display: grid; place-items: center; background: radial-gradient(circle, #1a2130, #0d1017); z-index: 50; }
.loading .ui-title { font-size: 28px; animation: glow 1.6s ease-in-out infinite; }

.modal { position: absolute; inset: 0; background: rgba(5, 7, 11, 0.6); display: grid; place-items: center; z-index: 60; padding: 16px; backdrop-filter: blur(3px); }
.dialog { width: 100%; max-width: 360px; max-height: calc(100vh - 32px); overflow-y: auto; padding: 22px 22px 18px; }
.dialog.wide { max-width: 520px; }
.dialog h2 { margin: 2px 0 16px; font-size: 30px; }
.dialog-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; }
.err { color: var(--danger); font-size: 13px; font-weight: 600; margin-bottom: 6px; }
.small { font-size: 12.5px; margin-top: -6px; }
.sec { margin: 16px 0 8px; color: var(--gold); }
.cal-row { align-items: flex-end; }
.cal-row .ui-btn { margin-bottom: 12px; flex: none; }

.follow-chip { position: absolute; top: 76px; left: 50%; transform: translateX(-50%); z-index: 25; display: flex; align-items: center; gap: 8px; padding: 8px 14px; font: 700 13px var(--sans); color: var(--gold-2); cursor: pointer; }
.toasts { position: absolute; top: 76px; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; gap: 6px; z-index: 70; pointer-events: none; }
.toast { padding: 9px 16px; font-size: 13px; font-weight: 600; text-align: center; }
.toast.error { border-color: rgba(255, 107, 94, 0.5); color: #ffc2bb; }

@keyframes live { 70% { box-shadow: 0 0 0 7px rgba(126, 224, 163, 0); } 100% { box-shadow: 0 0 0 0 rgba(126, 224, 163, 0); } }
@keyframes glow { 50% { opacity: .5; } }

@media (max-width: 1100px) {
  .zoom.shifted, .scale.shifted { right: 16px; bottom: 80px; }
  .scale.shifted { right: 76px; }
}
@media (max-width: 760px) {
  .topbar { top: 8px; left: 8px; right: 8px; gap: 6px; flex-wrap: wrap; }
  .brand { height: 44px; padding: 0 10px; }
  .brand-name { font-size: 19px; }
  .brand-date { display: none; }
  .right { height: 44px; margin-left: auto; }
  .clock span, .hide-sm { display: none; }
  .search { order: 3; flex-basis: 100%; max-width: none; height: 40px; }
  .zoom { bottom: 90px; right: 8px; }
  .scale { right: 60px; bottom: 96px; }
  /* у мастера внизу панель инструментов — зум жестами */
  .is-master .zoom { display: none; }
  .is-master .scale { bottom: 96px; right: 12px; }
}
</style>
