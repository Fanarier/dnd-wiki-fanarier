<template>
  <div>
    <v-row v-if="results && results.length" class="mt-3" dense>
      <v-col cols="12" v-for="r in results" :key="r.id">
        <v-card class="pa-3" outlined>
          <v-row>
            <v-col cols="12" md="9">
              <h3 class="mb-1" v-html="highlight(r.title)"></h3>
              <div class="muted mb-2" v-html="highlight(r.description)"></div>
              <div v-if="r.snippet" v-html="r.snippet"></div>
            </v-col>

            <v-col cols="12" md="3" class="d-flex flex-column align-end justify-center">
              <div class="mb-2" style="min-width:120px">
                <div><strong>Категория:</strong> {{ r.category }}</div>
              </div>
              <v-btn small @click="$emit('open', r.id)" aria-label="Открыть статью">Открыть</v-btn>
            </v-col>
          </v-row>
        </v-card>
      </v-col>
    </v-row>

    <div v-else class="py-6">
      <v-card class="pa-4" outlined>
        <div class="subtitle-1">Результатов не найдено.</div>
        <div class="muted" style="margin-top:8px">Попробуйте изменить запрос или проверьте орфографию.</div>
      </v-card>
    </div>
  </div>
</template>

<script setup>
/*
  SearchResults.vue
  Props:
    - results: Array of search result objects { id, title, description, category, snippet }
    - query: current search query string (optional) — используется для подсветки в title/description

  Emits:
    - open (id) — родитель должен обработать открытие статьи/категории

  Примечание: данные считаются локальными и безопасными для v-html (в текущем проекте).
  Если будете позволять пользователям добавлять контент — обязательно санитизируйте HTML перед вставкой.
*/

import { computed } from 'vue'

const props = defineProps({
  results: { type: Array, required: true },
  query: { type: String, required: false, default: '' }
})

const emit = defineEmits(['open'])

/* Функция подсветки первых вхождений query в тексте (безопасно — данные локальные) */
function highlightText(text = '', q = '') {
  if (!q) return escapeHtml(text)
  const re = new RegExp(escapeRegExp(q), 'ig')
  // Заменяем совпадения на <mark>...</mark>
  return escapeHtml(text).replace(re, (m) => `<mark>${m}</mark>`)
}

/* Экранируем HTML (на всякий случай) */
function escapeHtml(str = '') {
  return str
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

/* Убираем спецсимволы для RegExp */
function escapeRegExp(string = '') {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/* Возвращает строку с подсветкой для вставки в v-html */
const highlight = (text) => highlightText(text ?? '', props.query ?? '')
</script>

<style scoped>
.muted { color: rgba(0,0,0,0.58) }
mark {
  background: rgba(144,202,249,0.45);
  padding: 0 2px;
  border-radius: 2px;
}
.v-card .v-btn { min-width: 88px; }
</style>
