// Переходы между Картой, Вики и Листами: какой раздел, с какого ушли, и «перетекание» подсветки вкладки.
// Заставку рисует RouteFx.vue, подсветку — директива v-tabslide на <nav> с вкладками-ссылками.
import { reactive } from 'vue'

export const SECTIONS = ['map', 'activity', 'wiki', 'sheets']
// разделы вкладки «Активность» (остальное — вики); поселение тоже часть «Активности»
export const ACTIVITY_SECTIONS = ['party', 'quests', 'campaign', 'activities', 'settlements']
export const sectionOf = path => (path === '/' ? 'map' : path.startsWith('/wiki') ? 'wiki' : path.startsWith('/sheets') ? 'sheets'
  : path.startsWith('/activity') || path.startsWith('/settlement') ? 'activity' : null)
export const routeFx = reactive({ phase: '', kind: '', from: '' })
export const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

// v-tabslide: при открытии страницы золотая подсветка выезжает от прошлой вкладки к нынешней
const HREF = { map: '/', activity: '/activity', wiki: '/wiki', sheets: '/sheets' }
export const vTabslide = {
  mounted(nav) {
    const from = routeFx.from
    const tabs = [...nav.querySelectorAll('a')]
    nav.dataset.tabslide = '1'
    const active = tabs.find(a => a.classList.contains('active')) || tabs.find(a => a.classList.contains('router-link-exact-active'))
    const old = from && tabs.find(a => a.getAttribute('href') === HREF[from])
    if (!active || !old || old === active || reducedMotion()) return
    if (getComputedStyle(nav).position === 'static') nav.style.position = 'relative'
    active.classList.add('fx-tab-wait')
    // пока заставка перехода закрывает экран — ждём, подсветка поедет, когда она раскроется
    const start = () => (routeFx.phase === 'cover' ? setTimeout(start, 40) : slide(nav, active, old))
    start()
  }
}
function slide(nav, active, old) {
    const n = nav.getBoundingClientRect(), a = active.getBoundingClientRect(), o = old.getBoundingClientRect()
    const pill = document.createElement('i')
    pill.className = 'fx-tabpill'
    pill.style.cssText = `left:${o.left - n.left}px;top:${o.top - n.top}px;width:${o.width}px;height:${o.height}px`
    nav.appendChild(pill)
    requestAnimationFrame(() => requestAnimationFrame(() => {
      pill.style.left = a.left - n.left + 'px'
      pill.style.width = a.width + 'px'
    }))
    setTimeout(() => { active.classList.remove('fx-tab-wait'); pill.classList.add('done'); setTimeout(() => pill.remove(), 300) }, 650)
}
