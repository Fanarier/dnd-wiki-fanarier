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
import './components/rich/richfx.css'
import './components/fx/fx.css' // переходы, наклон карточек, блик кнопок, руна-загрузчик
import { vTilt } from './components/fx/tilt.js'
import { vTabslide, ACTIVITY_SECTIONS } from './components/fx/routeFx.js' // «живой» текст из редакторов — нужен везде, где показывается оформленный текст
import './map/history.js' // журнал правок карты (Ctrl+Z / Ctrl+Y) — с первой загрузки, даже если зашли не с карты

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
    // «Активность» — то, что часто меняется: статус группы, заказы, квесты, деятельности, поселение (та же раскладка, что у вики)
    { path: '/activity', name: 'activity', component: () => import('./wiki/WikiApp.vue'), props: { mode: 'activity' }, meta: { title: 'Анкария — активность' } },
    { path: '/settlement/:id?', name: 'settlement', component: () => import('./settlement/SettlementPage.vue'), meta: { title: 'Анкария — поселение' } },
    { path: '/sheets', name: 'sheets', component: () => import('./sheets/SheetsPage.vue'), meta: { title: 'Анкария — листы персонажей' } },
    { path: '/sheets/:id', name: 'sheet', component: () => import('./sheets/SheetBook.vue'), meta: { title: 'Анкария — лист персонажа' } },
    { path: '/profile', name: 'profile', component: () => import('./components/ProfilePage.vue'), meta: { title: 'Анкария — профиль' } },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ]
})
router.afterEach(to => { document.title = to.meta.title || 'Анкария' })
// старые ссылки (/wiki?quest=…, ?section=settlements, журнал деятельностей) ведут в «Активность», а ссылки на героев,
// НПС, расы из «Активности» — в вики
router.beforeEach(to => {
  const q = to.query
  if (to.path === '/wiki' && (ACTIVITY_SECTIONS.includes(q.section) || q.quest || q.log || q.cq)) return { path: '/activity', query: q, hash: to.hash }
  if (to.path === '/activity' && ((q.section && !ACTIVITY_SECTIONS.includes(q.section)) || q.hero || q.heroes || q.npc || q.race || q.cls)) return { path: '/wiki', query: q, hash: to.hash }
})

// v-tilt: наклон карточек за курсором с рунным кругом (src/components/fx)
createApp(App).use(vuetify).use(router).directive('tilt', vTilt).directive('tabslide', vTabslide).mount('#app')
