<template>
  <v-app class="wiki">
    <header class="w-top">
      <button class="w-burger" aria-label="Открыть разделы" @click="drawer = !drawer"><span /><span /><span /></button>
      <router-link to="/" class="w-brand">
        <svg class="sigil" viewBox="0 0 32 32" aria-hidden="true">
          <circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" stroke-width="1.5" />
          <path d="M16 3 L19 16 L16 29 L13 16 Z" fill="currentColor" />
          <path d="M3 16 L16 13.5 L29 16 L16 18.5 Z" fill="currentColor" opacity=".55" />
        </svg>
        <span>Анкария</span>
      </router-link>
      <nav class="w-tabs">
        <router-link to="/" class="w-tab">Карта</router-link>
        <router-link to="/wiki" class="w-tab active">Вики</router-link>
        <router-link v-if="store.me" to="/sheets" class="w-tab">Листы</router-link>
      </nav>
      <label class="w-search" :class="{ filled: search }" title="Поиск по всему сайту">
        <v-icon size="18">mdi-magnify</v-icon>
        <input v-model="search" placeholder="Поиск: НПС, навыки, города, заказы…" aria-label="Поиск по всему сайту" />
        <button type="button" class="w-cmd" title="Быстрый переход — Ctrl+K" @click.prevent="openPalette">⌘K</button>
        <button v-if="search" class="w-clear" aria-label="Очистить" @click="search = ''">×</button>
      </label>
      <UserMenu />
    </header>

    <div class="w-layout">
      <aside class="w-side" :class="{ open: drawer, 'magic-side': isMagic }">
        <Sidebar :categories="categories" :initial-active="currentCategory" @select="onCategorySelect" />
      </aside>
      <div v-if="drawer" class="w-scrim" @click="drawer = false" />

      <main class="w-main" :class="{ 'theme-magic': isMagic }">
        <!-- живая стихия школы магии за текстом -->
        <MagicBackdrop v-if="isMagic && !magicLoading && element" :key="element" :kind="element" />
        <!-- звук стихии: по умолчанию выключен, включается кнопкой (браузеры не дают играть звук без нажатия) -->
        <div v-if="isMagic && element && store.sound && hasAmbience(element)" class="w-amb" :class="{ on: ambOn }">
          <button type="button" :title="ambOn ? 'Выключить звук стихии' : 'Включить звук стихии'" @click="unlockAudio(); ambOn = !ambOn">{{ ambOn ? '🔊' : '🔈' }} {{ AMB_LABEL[element] }}</button>
          <input v-if="ambOn" type="range" min="0" max="1" step="0.05" :value="ambVol" title="Громкость стихии" aria-label="Громкость стихии" @input="ambVol = +$event.target.value; setAmbienceVolume(ambVol)" />
        </div>
        <MagicSparkles v-else-if="isMagic && !magicLoading" :key="currentCategory" />
        <div v-if="magicLoading" class="w-loader"><SteamLoader kind="magic" /></div>
        <transition v-else name="fade" mode="out-in">
          <div v-if="hasQuery" key="search-results">
            <h2 class="w-h">Результаты поиска: «{{ search }}»</h2>
            <WikiSearch :query="search" @article="openArticle" @done="searchDone" />
          </div>
          <component v-else :is="currentPage" :content="currentContent" :key="currentCategory" />
        </transition>
      </main>
    </div>

  </v-app>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, defineAsyncComponent } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import QuestBoard from './QuestBoard.vue'
import CampaignPage from './CampaignPage.vue'
import HeroesPage from './HeroesPage.vue'
import SettlementsPage from './SettlementsPage.vue'
import NpcsPage from './npc/NpcsPage.vue'
import RacesPage from './rules/RacesPage.vue'
import ClassesPage from './rules/ClassesPage.vue'
import RulesArticles from './rules/RulesArticles.vue'
import { init, store, rulesState, loadRules } from '../map/store.js'
import UserMenu from '../components/UserMenu.vue'
import SteamLoader from '../components/SteamLoader.vue'
import MagicBackdrop from './MagicBackdrop.vue'
import { startAmbience, stopAmbience, unlockAudio, getAmbienceVolume, setAmbienceVolume, hasAmbience } from '../sound/sound.js'
// искры на общих страницах магии — библиотека грузится только там
const MagicSparkles = defineAsyncComponent(() => import('./MagicSparkles.vue'))

import Sidebar from '../components/Sidebar.vue'
import WikiSearch from './WikiSearch.vue'
import SpellsPage from './rules/SpellsPage.vue'
import EffectsPage from './rules/EffectsPage.vue'
import RulesHistory from './rules/RulesHistory.vue'

/*
  Разделы вики. Правила (расы, классы, статьи, магия, эффекты) лежат на сервере и правятся на сайте —
  мастером и редакторами, которым он дал права (src/shared/wikiPerms.js). master: true — раздел только для мастера.
*/
const ALL_CATEGORIES = [
  { id: 'quests', title: 'Заказы гильдий', description: 'Доска объявлений, хроника, репутация', component: QuestBoard },
  { id: 'campaign', title: 'Квесты', description: 'Квесты героев и хроника сюжета', component: CampaignPage },
  { id: 'heroes', title: 'Герои Анкарии', description: 'Персонажи, сайд-кики, компаньоны и новые арты', component: HeroesPage },
  { id: 'npcs', title: 'НПС', description: 'Полные листы: сайд-кики, компаньоны, важные НПС', component: NpcsPage },
  { id: 'settlements', title: 'Поселения', description: 'Урюпинск: карта, жители, стройка, журнал', component: SettlementsPage },
  // правила Heroes & Adventures (перенесены из Google Docs, правит мастер)
  { id: 'races', title: 'Расы', description: 'Базовые навыки и навыки по уровням', component: RacesPage },
  { id: 'classes', title: 'Классы', description: 'Навыки по уровням и архетипы', component: ClassesPage },
  { id: 'mechanics', title: 'Механики', description: 'Формулы, характеристики, бой, черты', component: RulesArticles, group: 'mechanics' },
  { id: 'workplaces', title: 'Рабочие места', description: 'Столы и мастерские для крафта', component: RulesArticles, group: 'workplaces' },
  { id: 'activities', title: 'Деятельности', description: 'Чем заняться между приключениями', component: RulesArticles, group: 'activities' },
  { id: 'effects', title: 'Эффекты', description: 'Положительные, отрицательные и особые — с иконками', component: EffectsPage },
  { id: 'general', title: 'Общее', description: 'Тренировка, ритуалы, школы магии', component: RulesArticles, group: 'magic' },
  { id: 'utility', title: 'Утилитарная магия', description: 'Бытовые и вспомогательные заклинания', component: SpellsPage },
  { id: 'school-fire', title: 'Школа Огня (Магмы)', description: 'Заклинания школ Огня и Магмы', component: SpellsPage },
  { id: 'school-water', title: 'Школа Воды (Льда)', description: 'Заклинания школ Воды и Льда', component: SpellsPage },
  { id: 'school-air', title: 'Школа Воздуха (Молний)', description: 'Заклинания школ Воздуха и Молний', component: SpellsPage },
  { id: 'school-earth', title: 'Школа Земли (Природы)', description: 'Заклинания школ Земли и Природы', component: SpellsPage },
  { id: 'wiki-log', title: 'Журнал правок вики', description: 'Кто что менял в правилах; любую правку можно откатить', component: RulesHistory, master: true }
]
const categories = computed(() => ALL_CATEGORIES.filter(c => !c.master || store.role === 'master').map(c =>
  // мастеру — сколько деятельностей ждут проверки
  c.id === 'activities' && store.role === 'master' && store.data.activitiesPending ? { ...c, badge: store.data.activitiesPending, badgeTitle: 'Деятельности ждут проверки' } : c))
// права редактора поменялись — перезапросить правила (скрытое видно только тем, кто может править)
watch(() => [store.data.rulesRev, JSON.stringify(store.me?.wiki || null)], () => { if (rulesState.loaded) loadRules() })

const drawer = ref(false)
const currentCategory = ref('quests')
const currentPage = computed(() => categories.value.find(x => x.id === currentCategory.value)?.component ?? QuestBoard)
const currentContent = computed(() => categories.value.find(x => x.id === currentCategory.value) ?? {})
function onCategorySelect(id) {
  // тот же раздел ещё раз — к его началу (список рас, первая статья…); другой — адрес поправит watch ниже
  if (id === currentCategory.value) router.replace({ query: { section: id } })
  currentCategory.value = id
  drawer.value = false
}

/* -------------------- Поиск по статьям -------------------- */
const search = ref('')
const hasQuery = computed(() => (search.value || '').toString().trim().length > 0)

// выбрали результат поиска: закрываем поиск и, если нужно, переходим
const openPalette = () => dispatchEvent(new Event('anacaria:palette'))
function searchDone(to) {
  search.value = ''
  drawer.value = false
  if (to) router.push(to)
}
function openArticle(id) {
  const cat = categories.value.find(c => c.id === id)
  if (cat) {
    currentCategory.value = cat.id
    search.value = ''
    drawer.value = false
  }
}

// раздел — в адресе: обновил страницу или поделился ссылкой — открылось то же место.
// Подробности чужих разделов (открытая раса, НПС, заказ, статья, журнал) при переходе убираем
const DETAILS = { quests: ['quest'], heroes: ['hero', 'heroes'], npcs: ['npc', 'g'], races: ['race'], classes: ['cls', 'arch'], activities: ['a', 'log'], mechanics: ['a'], workplaces: ['a'], general: ['a'] }
const DETAIL_KEYS = [...new Set(Object.values(DETAILS).flat())]
watch(currentCategory, c => {
  search.value = ''
  if (route.query.section === c) return // пришли по ссылке — адрес уже верный
  const q = { ...route.query, section: c }
  for (const k of DETAIL_KEYS) if (!(DETAILS[c] || []).includes(k) || route.query.section) delete q[k]
  router.replace({ query: q })
})

/* -------------------- Общий вход и ссылки с карты -------------------- */
const route = useRoute()
const router = useRouter()
onMounted(init)
// таблицы статей: каждой ячейке — подпись её колонки (на телефоне строки показываются карточками «Круг: 1»).
// Колонку с описанием не подписываем — и так понятно
let tableObs = null
function labelTables() {
  for (const t of document.querySelectorAll('.w-main table:not([data-labeled])')) {
    t.dataset.labeled = '1'
    const heads = [...t.querySelectorAll('thead th')].map(th => th.textContent.trim())
    for (const tr of t.querySelectorAll('tbody tr')) {
      [...tr.children].forEach((td, i) => { if (heads[i] && !/описание/i.test(heads[i])) td.dataset.label = heads[i] })
    }
  }
}
onMounted(() => {
  labelTables()
  const main = document.querySelector('.w-main')
  if (main) { tableObs = new MutationObserver(labelTables); tableObs.observe(main, { childList: true, subtree: true }) }
})
onBeforeUnmount(() => tableObs?.disconnect())
// ссылка с карты на заказ открывает доску заказов
watch(() => route.query.quest, q => { if (q) currentCategory.value = 'quests' }, { immediate: true })
// ссылки на карточку героя и на новые арты (из колокольчика, профиля)
watch(() => [route.query.hero, route.query.heroes], ([h, t]) => { if (h || t) currentCategory.value = 'heroes' }, { immediate: true })
// /wiki?section=settlements — открыть раздел сразу
watch(() => route.query.npc, v => { if (v) currentCategory.value = 'npcs' }, { immediate: true })
watch(() => route.query.section, v => { if (v && categories.value.some(c => c.id === v)) currentCategory.value = String(v) }, { immediate: true })
// ссылка на расу или класс (из листа персонажа) — сразу в нужный раздел
watch(() => [route.query.race, route.query.cls], ([r, k]) => { if (r) currentCategory.value = 'races'; else if (k) currentCategory.value = 'classes' }, { immediate: true })

/* -------------------- Магические страницы: свой стиль и загрузка -------------------- */
const MAGIC = ['general', 'utility', 'school-fire', 'school-water', 'school-air', 'school-earth']
const isMagic = computed(() => MAGIC.includes(currentCategory.value) && !hasQuery.value)
const magicLoading = ref(false)
const ELEMENTS = { 'school-fire': 'fire', 'school-water': 'water', 'school-air': 'air', 'school-earth': 'earth' }
const element = computed(() => ELEMENTS[currentCategory.value] || null)
// фон стихии: включается кнопкой, выбор помним; уходим со страницы школы — стихает
const AMB_LABEL = { fire: 'огонь', water: 'вода и лёд', air: 'ветер и гром', earth: 'лес' }
const ambVol = ref(getAmbienceVolume())
const ambOn = ref((() => { try { return localStorage.getItem('anacaria-ambience') === 'on' } catch { return false } })())
watch([ambOn, element, () => store.sound], ([on, el, snd]) => {
  try { localStorage.setItem('anacaria-ambience', on ? 'on' : 'off') } catch { /* приватный режим */ }
  if (on && el && snd) startAmbience(el)
  else stopAmbience()
}, { immediate: true })
onBeforeUnmount(stopAmbience)
watch(currentCategory, (c, old) => {
  if (MAGIC.includes(c) && !MAGIC.includes(old)) {
    magicLoading.value = true
    setTimeout(() => { magicLoading.value = false }, 900)
  }
})
</script>
<style scoped>
.w-cmd { flex: none; padding: 2px 7px; border-radius: 7px; border: 1px solid rgba(231, 197, 111, .35); background: rgba(231, 197, 111, .08); color: #e7c56f; font: 800 11px 'Manrope', sans-serif; cursor: pointer; }
.w-cmd:hover { background: rgba(231, 197, 111, .2); }
.w-top { position: sticky; top: 0; z-index: 20; display: flex; align-items: center; gap: 18px; height: 64px; padding: 0 22px; background: rgba(13, 16, 23, 0.9); backdrop-filter: blur(12px); border-bottom: 1px solid var(--a-line); }
.w-brand { display: flex; align-items: center; gap: 10px; color: var(--a-gold-2); text-decoration: none; font: 700 24px var(--a-serif); }
.sigil { width: 28px; height: 28px; color: var(--a-gold); }
.w-tabs { display: flex; gap: 4px; padding: 3px; border-radius: 11px; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.06); }
.w-tab { padding: 6px 14px; border-radius: 8px; color: var(--a-muted); text-decoration: none; font-weight: 700; font-size: 13px; }
.w-tab:hover { color: var(--a-text); }
.w-tab.active { background: rgba(231, 197, 111, 0.16); color: var(--a-gold-2); }
.w-search { margin-left: auto; display: flex; align-items: center; gap: 8px; width: min(420px, 40vw); height: 40px; padding: 0 12px; border-radius: 11px; background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 255, 255, 0.08); color: var(--a-muted); }
.w-search:focus-within { border-color: rgba(231, 197, 111, 0.5); }
.w-search input { flex: 1; min-width: 0; background: none; border: 0; outline: none; color: var(--a-text); font: 500 14px var(--a-sans); }
.w-clear { background: none; border: 0; color: var(--a-muted); font-size: 20px; cursor: pointer; }
.w-loader { display: grid; place-items: center; min-height: 60vh; }
/* кнопка звука стихии на страницах школ магии — правый нижний угол (слева кубики) */
.w-amb { position: fixed; right: 16px; bottom: 16px; z-index: 250; display: flex; align-items: center; gap: 8px; padding: 6px 12px; border-radius: 99px; border: 1px solid rgba(185, 166, 255, .45); background: rgba(16, 14, 30, .85); backdrop-filter: blur(6px); color: #d9ceff; font: 700 13px "Manrope", sans-serif; cursor: pointer; box-shadow: 0 8px 22px rgba(0, 0, 0, .45); }
.w-amb button { border: 0; background: none; color: inherit; font: inherit; cursor: pointer; padding: 2px 0; }
.w-amb input[type=range] { width: 96px; accent-color: #b9a6ff; }
.w-amb.on { border-color: #b9a6ff; box-shadow: 0 8px 22px rgba(0, 0, 0, .45), 0 0 18px rgba(155, 125, 255, .45); }
/* магия: звёздное небо, светящиеся заголовки, мистические рамки */
.theme-magic { position: relative; isolation: isolate; } /* свой слой: фон и стихия за текстом, но над фоном приложения */
.theme-magic::before { content: ''; position: fixed; inset: 64px 0 0; z-index: -1; pointer-events: none;
  background:
    radial-gradient(1px 1px at 12% 18%, #fff8, transparent), radial-gradient(1px 1px at 72% 12%, #fff7, transparent),
    radial-gradient(1.5px 1.5px at 38% 62%, #cfc2ff99, transparent), radial-gradient(1px 1px at 86% 48%, #fff6, transparent),
    radial-gradient(1px 1px at 22% 84%, #fff5, transparent), radial-gradient(1.5px 1.5px at 58% 30%, #9fd8ff88, transparent),
    radial-gradient(900px 500px at 70% 10%, rgba(122, 92, 255, .16), transparent 70%),
    radial-gradient(700px 500px at 10% 90%, rgba(79, 216, 255, .08), transparent 70%);
  animation: twinkle 6s ease-in-out infinite alternate; }
.theme-magic :deep(.v-card) { background: rgba(16, 14, 30, .58) !important; backdrop-filter: blur(2px); border-color: rgba(185, 166, 255, .35) !important; box-shadow: 0 0 0 1px rgba(122, 92, 255, .15), 0 0 40px rgba(122, 92, 255, .12), 0 18px 50px rgba(0, 0, 0, .35) !important; }
.theme-magic :deep(h2) { color: #d9ceff !important; text-shadow: 0 0 18px rgba(155, 125, 255, .55); }
.theme-magic :deep(h3) { color: #b9a6ff !important; }
.theme-magic :deep(strong) { color: #cfc2ff !important; }
.theme-magic :deep(p.lead) { color: #cfc6e8 !important; }
.theme-magic :deep(.magic-table caption.table-caption) { color: #d9ceff; background: rgba(122, 92, 255, .1); border-color: rgba(185, 166, 255, .3); }
.theme-magic :deep(.magic-table tbody td:first-child) { color: #cfc2ff; }
@keyframes twinkle { from { opacity: .7; } to { opacity: 1; } }
.w-auth { flex: none; height: 38px; padding: 0 14px; border-radius: 10px; border: 0; background: linear-gradient(180deg, #f0d083, #c9a24f); color: #1b1408; font: 700 13px var(--a-sans); cursor: pointer; }
.w-auth.master { background: rgba(231, 197, 111, .12); color: var(--a-gold-2); border: 1px solid rgba(231, 197, 111, .4); }
.w-modal { position: fixed; inset: 0; z-index: 120; background: rgba(5, 7, 11, .65); display: grid; place-items: center; padding: 16px; }
.w-login { width: min(360px, 100%); background: #141a24; border: 1px solid rgba(231, 197, 111, .25); border-radius: 16px; padding: 22px; display: grid; gap: 10px; color: var(--a-text); }
.w-login h3 { margin: 0; font: 700 28px var(--a-serif); color: var(--a-gold-2); }
.w-kicker { font-size: 11px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: var(--a-muted); }
.w-login label { display: grid; gap: 4px; font-size: 12px; font-weight: 700; color: var(--a-muted); }
.w-login input { min-height: 36px; padding: 6px 10px; border-radius: 9px; border: 1px solid rgba(255, 255, 255, .1); background: rgba(0, 0, 0, .3); color: var(--a-text); font: 500 14px var(--a-sans); }
.w-err { color: #ff6b5e; font-size: 13px; font-weight: 600; }
.w-actions { display: flex; justify-content: flex-end; gap: 8px; }
.w-actions button { height: 36px; padding: 0 14px; border-radius: 10px; border: 1px solid rgba(255, 255, 255, .12); background: rgba(255, 255, 255, .05); color: var(--a-text); font: 700 13px var(--a-sans); cursor: pointer; }
.w-actions .primary { background: linear-gradient(180deg, #f0d083, #c9a24f); color: #1b1408; border: 0; }
.w-burger { display: none; flex-direction: column; gap: 4px; background: none; border: 0; padding: 6px; cursor: pointer; }
.w-burger span { width: 20px; height: 2px; background: var(--a-text); border-radius: 2px; }

.w-layout { display: flex; max-width: 1360px; margin: 0 auto; width: 100%; }
.w-side { position: sticky; top: 64px; width: 280px; flex: none; height: calc(100vh - 64px); overflow-y: auto; padding: 22px 12px 22px 22px; }
/* на страницах магии фон-стихия идёт на весь экран — меню разделов поверх него на полупрозрачной подложке */
@media (min-width: 901px) { .w-side.magic-side { z-index: 2; background: rgba(13, 16, 23, .8); backdrop-filter: blur(6px); border-right: 1px solid rgba(185, 166, 255, .14); } }
.w-main { flex: 1; min-width: 0; padding: 26px 26px 60px; }
.w-h { font-family: var(--a-serif); font-size: 30px; color: var(--a-gold-2); margin-bottom: 14px; }
.w-scrim { display: none; }

@media (max-width: 900px) {
  .w-top { gap: 10px; padding: 0 12px; }
  .w-burger { display: flex; }
  .w-brand span { display: none; }
  .w-search { width: auto; flex: 1; min-width: 0; }
  .w-hide { display: none; }
  .w-side { position: fixed; z-index: 40; top: 0; left: 0; height: 100vh; background: #0f131b; border-right: 1px solid var(--a-line); transform: translateX(-100%); transition: transform .25s; padding-top: 22px; }
  .w-side.open { transform: none; }
  .w-scrim { display: block; position: fixed; inset: 0; z-index: 35; background: rgba(0, 0, 0, 0.5); }
  .w-main { padding: 18px 14px 50px; }
}
/* телефон: шапка в одну строку — вкладки прокручиваются, поиск свёрнут в значок и раскрывается под шапкой */
@media (max-width: 600px) {
  .w-top { gap: 6px; padding: 0 8px; }
  .w-brand { display: none; }
  .w-tabs { flex: 0 1 auto; min-width: 0; margin-right: auto; overflow-x: auto; scrollbar-width: none; }
  .w-tabs::-webkit-scrollbar { display: none; }
  .w-tab { padding: 6px 10px; white-space: nowrap; }
  .w-search { flex: none; width: 38px; height: 38px; margin-left: 0; padding: 0; justify-content: center; cursor: pointer; }
  .w-search input, .w-search .w-clear { position: absolute; width: 1px; opacity: 0; pointer-events: none; }
  .w-search:focus-within, .w-search.filled { position: absolute; left: 8px; right: 8px; top: calc(100% + 6px); width: auto; height: 44px; padding: 0 12px; justify-content: flex-start; background: #10141c; border-color: rgba(231, 197, 111, .5); box-shadow: 0 12px 30px rgba(0, 0, 0, .55); cursor: text; }
  .w-search:focus-within input, .w-search.filled input, .w-search.filled .w-clear { position: static; width: auto; opacity: 1; pointer-events: auto; }
  .w-side { top: 0; }
}
</style>
