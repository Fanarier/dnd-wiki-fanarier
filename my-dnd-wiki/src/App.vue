<template>
  <v-app :class="isDark ? 'theme--dark' : 'theme--light'">
    <!-- App Bar -->
    <v-app-bar elevated>
      <v-app-bar-nav-icon @click="drawer = !drawer" aria-label="Открыть меню" />
      <v-toolbar-title class="ml-2">DD Wiki — Магия</v-toolbar-title>

      <v-spacer />

      <!-- Поиск по всем статьям (title / description / content) -->
      <v-text-field
        v-model="search"
        placeholder="Поиск по статьям (заголовок / описание / текст)..."
        hide-details
        dense
        rounded
        append-inner-icon="mdi-magnify"
        style="max-width: 640px"
        aria-label="Поиск по вики"
        clearable
      />

      <!-- Переключатель темы -->
      <v-btn icon @click="toggleTheme" :title="themeTitle" :aria-pressed="isDark.toString()">
        <v-icon>{{ isDark ? 'mdi-weather-night' : 'mdi-weather-sunny' }}</v-icon>
      </v-btn>
    </v-app-bar>

    <!-- Drawer / Sidebar -->
    <v-navigation-drawer v-model="drawer" app temporary>
      <Sidebar :categories="categories" @select="onCategorySelect" :initial-active="currentCategory" />
      <v-divider class="my-2" />
      <v-list-item class="touch-target" role="status" aria-live="polite">
        <v-list-item-content>
          <v-list-item-title>Категорий: {{ categories.length }}</v-list-item-title>
        </v-list-item-content>
      </v-list-item>
    </v-navigation-drawer>

    <!-- Main content -->
    <v-main>
      <v-container class="pa-4">
        <transition name="fade" mode="out-in">
          <!-- Показываем результаты поиска при наличии запроса -->
          <div v-if="hasQuery" key="search-results">
            <h2>Результаты поиска: «{{ search }}»</h2>
            <SearchResults :results="searchResults" :query="search" @open="openArticle" />
          </div>

          <!-- Иначе — обычная страница -->
          <component v-else :is="currentPage" :content="currentContent" :key="currentCategory" />
        </transition>
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup>
/*
  Обновлённый App.vue:
  - Подключает SearchResults.vue (переиспользуемый компонент),
  - Поиск основан на src/data/articles.js (искать по title/description/content),
  - Кнопка "Открыть" в результатах переключает текущую категорию.
*/

import { ref, computed, watch, onMounted } from 'vue'
import { useTheme } from 'vuetify'

import Sidebar from './components/Sidebar.vue'
import SearchResults from './components/SearchResults.vue'
import WikiGeneral from './pages/WikiGeneral.vue'
import UtilityMagic from './pages/UtilityMagic.vue'

import articles from './data/articles.js' // единый источник текстов для поиска

/* -------------------- Тема (Vuetify sync) -------------------- */
const vuetifyTheme = useTheme()
const isDark = ref(false)

onMounted(() => {
  try {
    const saved = localStorage.getItem('dd-wiki-theme')
    if (saved === 'dark' || saved === 'light') {
      isDark.value = (saved === 'dark')
      vuetifyTheme.global.name.value = saved
      return
    }
  } catch (e) {}
  try {
    const current = vuetifyTheme.global.name.value
    isDark.value = (current === 'dark')
    return
  } catch (e) {}
  try {
    isDark.value = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    vuetifyTheme.global.name.value = isDark.value ? 'dark' : 'light'
  } catch (e) {}
})

watch(() => vuetifyTheme.global.name.value, (val) => { isDark.value = (val === 'dark') })

function toggleTheme() {
  isDark.value = !isDark.value
  const name = isDark.value ? 'dark' : 'light'
  try { vuetifyTheme.global.name.value = name } catch (e) {}
  try { localStorage.setItem('dd-wiki-theme', name) } catch (e) {}
}
const themeTitle = computed(() => isDark.value ? 'Включена тёмная тема — переключиться на светлую' : 'Включена светлая тема — переключиться на тёмную')

/* -------------------- Categories / Navigation -------------------- */
/*
  Категории: id должен соответствовать id статьи в src/data/articles.js
  Чтобы добавлять новые страницы — добавьте запись в articles.js и сюда в categories.
*/
const categories = ref([
  { id: 'general', title: 'Общее', description: 'Тренировка, ритуалы, школы магии', component: WikiGeneral },
  { id: 'utility', title: 'Утилитарная магия', description: 'Бытовые и вспомогательные заклинания', component: UtilityMagic }
])

const drawer = ref(false)
const currentCategory = ref('general')
const currentPage = computed(() => {
  const c = categories.value.find(x => x.id === currentCategory.value)
  return c ? c.component : WikiGeneral
})
const currentContent = computed(() => {
  const c = categories.value.find(x => x.id === currentCategory.value)
  return c ?? {}
})
function onCategorySelect(id) {
  currentCategory.value = id
  drawer.value = false
}

/* -------------------- Search (client-side fulltext) -------------------- */
const search = ref('')
const hasQuery = computed(() => (search.value || '').toString().trim().length > 0)

/* Вспомогательные утилиты для поиска и сниппетов */
function normalize(s = '') { return (s || '').toString().toLowerCase() }

function makeSnippet(text = '', q = '', margin = 80) {
  const ltext = text.toLowerCase()
  const idx = ltext.indexOf(q)
  if (idx === -1) return ''
  const start = Math.max(0, idx - margin)
  const end = Math.min(text.length, idx + q.length + margin)
  let snippet = text.substring(start, end).trim()
  if (start > 0) snippet = '…' + snippet
  if (end < text.length) snippet = snippet + '…'
  // подсветка: безопасно — данные исходно из src/data/articles.js
  const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig')
  snippet = snippet.replace(re, (m) => `<mark>${m}</mark>`)
  return `<div class="muted" style="line-height:1.35">${snippet}</div>`
}

const searchResults = computed(() => {
  const qRaw = (search.value || '').toString().trim()
  if (!qRaw) return []
  const q = qRaw.toLowerCase()
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
        category: (a.category || '—'),
        snippet: inContent ? makeSnippet(a.content, q) : (inDesc ? makeSnippet(a.description, q) : '')
      })
    }
  }

  // простая ранжировка: заголовки > описание > содержание
  results.sort((A, B) => {
    const score = (r) =>
      (normalize(r.title).includes(q) ? 100 : 0) +
      (normalize(r.description).includes(q) ? 10 : 0) +
      (r.snippet ? 1 : 0)
    return score(B) - score(A)
  })

  return results
})

/* Открыть результат: переключиться на соответствующую категорию/страницу */
function openArticle(id) {
  const cat = categories.value.find(c => c.id === id)
  if (cat) {
    currentCategory.value = cat.id
    search.value = ''
    drawer.value = false
    return
  }
  // fallback: если статья есть, но категория не найдена — можно добавить логику маппинга
}

/* Очистка поиска при ручном переключении категории */
watch(currentCategory, () => { search.value = '' })
</script>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity .25s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

h2 { margin-bottom: 8px }
.muted { color: rgba(0,0,0,0.6) }

mark {
  background: rgba(144,202,249,0.45);
  padding: 0 2px;
  border-radius: 2px;
}
</style>
