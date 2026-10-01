// src/main.js — точка входа: карта мира (/) и вики (/wiki).
import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'

// Vuetify используется страницами вики
import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import '@mdi/font/css/materialdesignicons.css'

import './styles.css'

const vuetify = createVuetify({
  components,
  directives,
  icons: { defaultSet: 'mdi' },
  theme: {
    defaultTheme: 'anacaria',
    themes: {
      anacaria: {
        dark: true,
        colors: {
          background: '#0d1017',
          surface: '#141a24',
          primary: '#e7c56f',
          secondary: '#b9a6ff',
          info: '#7cc4ff',
          'on-surface': '#ece6da',
          'on-background': '#ece6da'
        }
      }
    }
  }
})

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'map', component: () => import('./map/MapPage.vue'), meta: { title: 'Анкария — карта мира' } },
    { path: '/wiki', name: 'wiki', component: () => import('./wiki/WikiApp.vue'), meta: { title: 'Анкария — вики' } },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ]
})
router.afterEach(to => { document.title = to.meta.title || 'Анкария' })

createApp(App).use(vuetify).use(router).mount('#app')
