// src/main.js
// Точка входа приложения: инициализация Vue + Vuetify.
// Обновлено: тёмная тема использует мягкие фиолетовые оттенки.

import { createApp } from 'vue'
import App from './App.vue'

// Vuetify
import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import '@mdi/font/css/materialdesignicons.css'

// Глобальные стили
import './styles.css'

// Восстановление сохранённой темы (если есть) -> иначе system preference
let savedTheme = null
try {
  savedTheme = localStorage.getItem('dd-wiki-theme') // 'light' | 'dark'
} catch (e) { /* ignore */ }

const systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
const defaultTheme = savedTheme ? savedTheme : (systemPrefersDark ? 'dark' : 'light')

// Vuetify palette: light (нежно-голубая) и dark (нежно-фиолетовая)
const vuetify = createVuetify({
  components,
  directives,
  icons: { defaultSet: 'mdi' },
  theme: {
    defaultTheme,
    themes: {
      light: {
        colors: {
          background: '#f2fbff',   // very light blue page background
          surface: '#ffffff',
          primary: '#90caf9',
          secondary: '#63a4ff',
          'on-surface': '#0b2b40',
          'on-background': '#0b2b40'
        }
      },
      dark: {
        // Нежно-фиолетовая палитра для тёмной темы
        colors: {
          background: '#0b0714',   // глубокий, почти чёрный с фиолетовым оттенком
          surface: '#1a1226',      // поверхность карточек — темно-фиолетовая
          primary: '#b39ddb',      // лаванда (акцент)
          secondary: '#9575cd',    // мягкий фиолетовый
          info: '#b39ddb',
          'on-surface': '#efe9fb', // светлый текст на surface
          'on-background': '#efe9fb'
        }
      }
    }
  }
})

createApp(App).use(vuetify).mount('#app')
