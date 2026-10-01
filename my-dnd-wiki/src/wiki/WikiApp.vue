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
      </nav>
      <label class="w-search">
        <v-icon size="18">mdi-magnify</v-icon>
        <input v-model="search" placeholder="Поиск по статьям…" aria-label="Поиск по вики" />
        <button v-if="search" class="w-clear" aria-label="Очистить" @click="search = ''">×</button>
      </label>
    </header>

    <div class="w-layout">
      <aside class="w-side" :class="{ open: drawer }">
        <Sidebar :categories="categories" :initial-active="currentCategory" @select="onCategorySelect" />
      </aside>
      <div v-if="drawer" class="w-scrim" @click="drawer = false" />

      <main class="w-main">
        <transition name="fade" mode="out-in">
          <div v-if="hasQuery" key="search-results">
            <h2 class="w-h">Результаты поиска: «{{ search }}»</h2>
            <SearchResults :results="searchResults" :query="search" @open="openArticle" />
          </div>
          <component v-else :is="currentPage" :content="currentContent" :key="currentCategory" />
        </transition>
      </main>
    </div>
  </v-app>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

import Sidebar from '../components/Sidebar.vue'
import SearchResults from '../components/SearchResults.vue'
import WikiGeneral from '../pages/WikiGeneral.vue'
import UtilityMagic from '../pages/UtilityMagic.vue'
import SchoolFire from '../pages/SchoolFire.vue'
import SchoolWater from '../pages/SchoolWater.vue'
import SchoolAir from '../pages/SchoolAir.vue'
import SchoolEarth from '../pages/SchoolEarth.vue'

import articles from '../data/articles.js' // единый источник текстов для поиска

/*
  Категории: id должен соответствовать id статьи в src/data/articles.js
  Чтобы добавить страницу — добавь запись в articles.js и сюда в categories.
*/
const categories = ref([
  { id: 'general', title: 'Общее', description: 'Тренировка, ритуалы, школы магии', component: WikiGeneral },
  { id: 'utility', title: 'Утилитарная магия', description: 'Бытовые и вспомогательные заклинания', component: UtilityMagic },
  { id: 'school-fire', title: 'Школа Огня (Магмы)', description: 'Заклинания школ Огня и Магмы', component: SchoolFire },
  { id: 'school-water', title: 'Школа Воды (Льда)', description: 'Заклинания школ Воды и Льда', component: SchoolWater },
  { id: 'school-air', title: 'Школа Воздуха (Молний)', description: 'Заклинания школ Воздуха и Молний', component: SchoolAir },
  { id: 'school-earth', title: 'Школа Земли (Природы)', description: 'Заклинания школ Земли и Природы', component: SchoolEarth }
])

const drawer = ref(false)
const currentCategory = ref('general')
const currentPage = computed(() => categories.value.find(x => x.id === currentCategory.value)?.component ?? WikiGeneral)
const currentContent = computed(() => categories.value.find(x => x.id === currentCategory.value) ?? {})
function onCategorySelect(id) {
  currentCategory.value = id
  drawer.value = false
}

/* -------------------- Поиск по статьям -------------------- */
const search = ref('')
const hasQuery = computed(() => (search.value || '').toString().trim().length > 0)

const normalize = (s = '') => (s || '').toString().toLowerCase()

function makeSnippet(text = '', q = '', margin = 80) {
  const idx = text.toLowerCase().indexOf(q)
  if (idx === -1) return ''
  const start = Math.max(0, idx - margin)
  const end = Math.min(text.length, idx + q.length + margin)
  let snippet = text.substring(start, end).trim()
  if (start > 0) snippet = '…' + snippet
  if (end < text.length) snippet = snippet + '…'
  // подсветка: безопасно — данные исходно из src/data/articles.js
  const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig')
  snippet = snippet.replace(re, m => `<mark>${m}</mark>`)
  return `<div class="muted" style="line-height:1.35">${snippet}</div>`
}

const searchResults = computed(() => {
  const q = (search.value || '').toString().trim().toLowerCase()
  if (!q) return []
  const results = []
  for (const a of articles) {
    const inTitle = normalize(a.title).includes(q)
    const inDesc = normalize(a.description).includes(q)
    const inContent = normalize(a.content).includes(q)
    if (inTitle || inDesc || inContent) {
      results.push({
        id: a.id,
        title: a.title,
        description: a.description,
        category: a.category || '—',
        snippet: inContent ? makeSnippet(a.content, q) : inDesc ? makeSnippet(a.description, q) : ''
      })
    }
  }
  // заголовки > описание > содержание
  const score = r => (normalize(r.title).includes(q) ? 100 : 0) + (normalize(r.description).includes(q) ? 10 : 0) + (r.snippet ? 1 : 0)
  return results.sort((A, B) => score(B) - score(A))
})

function openArticle(id) {
  const cat = categories.value.find(c => c.id === id)
  if (cat) {
    currentCategory.value = cat.id
    search.value = ''
    drawer.value = false
  }
}

watch(currentCategory, () => { search.value = '' })
</script>

<style scoped>
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
.w-burger { display: none; flex-direction: column; gap: 4px; background: none; border: 0; padding: 6px; cursor: pointer; }
.w-burger span { width: 20px; height: 2px; background: var(--a-text); border-radius: 2px; }

.w-layout { display: flex; max-width: 1360px; margin: 0 auto; width: 100%; }
.w-side { position: sticky; top: 64px; width: 280px; flex: none; height: calc(100vh - 64px); overflow-y: auto; padding: 22px 12px 22px 22px; }
.w-main { flex: 1; min-width: 0; padding: 26px 26px 60px; }
.w-h { font-family: var(--a-serif); font-size: 30px; color: var(--a-gold-2); margin-bottom: 14px; }
.w-scrim { display: none; }

@media (max-width: 900px) {
  .w-top { gap: 10px; padding: 0 12px; }
  .w-burger { display: flex; }
  .w-brand span { display: none; }
  .w-search { width: auto; flex: 1; min-width: 0; }
  .w-side { position: fixed; z-index: 40; top: 0; left: 0; height: 100vh; background: #0f131b; border-right: 1px solid var(--a-line); transform: translateX(-100%); transition: transform .25s; padding-top: 22px; }
  .w-side.open { transform: none; }
  .w-scrim { display: block; position: fixed; inset: 0; z-index: 35; background: rgba(0, 0, 0, 0.5); }
  .w-main { padding: 18px 14px 50px; }
}
</style>
