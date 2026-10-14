<template>
  <!-- лист персонажа — книга: обложка раскрывается, слева главная страница, справа раздел; закладки сбоку -->
  <div class="sb-root" :style="themeVars">
    <header class="sb-top">
      <router-link to="/sheets" class="sb-back" title="Ко всем листам">←<span class="hide-sm"> Листы</span></router-link>
      <div class="sb-title">
        <b>{{ sheet.data?.CharacterName || 'Лист персонажа' }}</b>
        <small v-if="sheet.meta">{{ subtitle }}</small>
      </div>
      <span class="sb-save" :class="sheet.status" :title="SAVE_HINT[sheet.status]">{{ SAVE_TEXT[sheet.status] || '' }}</span>
      <span class="grow" />
      <SheetSearch v-if="ready" ref="searchRef" :sections="SECTIONS" @go="goFound" />
      <div class="sb-mode" role="group" aria-label="Броски из листа" title="Броски из листа: обычный, с преимуществом или с помехой">
        <button v-for="m in MODES" :key="m.v" type="button" :class="[m.cls, { on: rollMode === m.v }]" @click="rollMode = m.v">{{ m.t }}</button>
      </div>
      <div class="sb-menu-wrap">
        <button type="button" class="sb-icon-btn" title="Меню листа" :disabled="!ready" @click="menuOpen = !menuOpen">⋯</button>
        <div v-if="menuOpen" class="sb-menu" @click="menuOpen = false">
          <button type="button" @click="openAccent">🎨 Цвет листа</button>
          <button type="button" @click="doExport">⇩ Выгрузить .json</button>
          <button type="button" @click="doReplace">⇪ Заменить из файла…</button>
          <template v-if="isMaster">
            <button type="button" @click="metaOpen = true">👤 Владелец и карточка героя</button>
            <button type="button" @click="historyOpen = true">🕓 История изменений</button>
          </template>
          <router-link v-if="sheet.meta?.heroId" :to="{ path: '/wiki', query: { hero: sheet.meta.heroId } }">⚑ Карточка героя</router-link>
          <button type="button" class="danger" @click="doDelete">🗑 Удалить лист</button>
        </div>
      </div>
      <UserMenu />
    </header>

    <div v-if="sheet.status === 'error'" class="sb-err">
      <b>{{ sheet.error }}</b>
      <router-link to="/sheets" class="sb-btn">К списку листов</router-link>
    </div>
    <div v-else-if="!ready" class="sb-loading"><span class="sb-spin" /> Открываю книгу…</div>

    <div v-else class="sb-stage" :class="{ single }">
      <!-- пылинки в свете свечи -->
      <i v-for="m in motes" :key="m.k" class="sb-mote" :style="m.style" aria-hidden="true" />
      <div ref="bookRef" class="sb-book" :class="{ opening }">
        <!-- кожаный переплёт с тиснёными уголками (под страницами) -->
        <div v-if="!single" ref="boardLRef" class="sb-boards l" aria-hidden="true"><i class="cn tl" /><i class="cn bl" /></div>
        <div class="sb-boards r" aria-hidden="true"><i class="cn tr" /><i class="cn br" /><template v-if="single"><i class="cn tl" /><i class="cn bl" /></template></div>
        <i v-if="!single" ref="stitchRef" class="sb-stitch" aria-hidden="true" />
        <!-- левая страница: главное о персонаже (на узком экране её нет — главная становится разделом) -->
        <section v-if="!single" ref="leftRef" class="sb-page left">
          <span class="sb-run" aria-hidden="true">{{ sheet.data.CharacterName }}</span>
          <div class="sb-scroll"><PMain /></div>
          <span class="sb-pno" aria-hidden="true">— 1 —</span>
          <i class="sb-spine" aria-hidden="true" />
        </section>
        <section ref="rightRef" class="sb-page right" @pointerdown="swipeStart" @pointerup="swipeEnd">
          <span class="sb-run" aria-hidden="true">{{ current.name }}</span>
          <div ref="scrollRef" class="sb-scroll" :key="cur">
            <component :is="current.comp" v-bind="current.props || {}" @go="goto" />
          </div>
          <span class="sb-pno" aria-hidden="true">— {{ pageNo }} —</span>
        </section>

        <!-- закладки: шёлковые ленты, торчат из-за верхнего края страниц -->
        <nav v-for="g in markGroups" :key="g.side" class="sb-marks" :class="g.side" aria-label="Разделы листа">
          <button v-for="s in g.items" :key="s.key" type="button" class="sb-mark" :class="{ on: s.key === cur }" :style="{ '--silk': SILK[s.n % SILK.length] }" :title="s.name" @click="goto(s.key)">
            <SheetIcon :name="s.key" class="ic" /><span class="nm">{{ s.tab || s.name }}</span>
          </button>
        </nav>
        <!-- ляссе — ленточка из корешка -->
        <i v-if="!single" class="sb-ribbon" aria-hidden="true" />

        <!-- обложка: видна только пока книга открывается -->
        <div v-if="coverShown" ref="coverRef" class="sb-cover" aria-hidden="true">
          <div class="face front">
            <i class="cn tl" /><i class="cn tr" /><i class="cn bl" /><i class="cn br" />
            <i class="cv-gem" />
            <div class="cv-frame">
              <div class="cv-medal"><img v-if="sheet.data.PhotoFile" :src="sheetImg(sheet.data.PhotoFile)" alt="" /><span v-else>{{ (sheet.data.CharacterName || '?')[0] }}</span></div>
              <b class="cv-name">{{ sheet.data.CharacterName }}</b>
              <small class="cv-sub">{{ [sheet.data.Class, sheet.data.Level ? sheet.data.Level + ' ур.' : ''].filter(Boolean).join(' · ') }}</small>
            </div>
          </div>
          <div class="face back"><i class="paper" /></div>
        </div>
        <div ref="burstRef" class="sb-burst" aria-hidden="true" />
      </div>
    </div>

    <ColorMenu />
    <SheetHistory v-if="historyOpen && ready" @close="historyOpen = false" />
    <SheetMeta v-if="metaOpen && ready" :sheet-id="sheet.id" @close="metaOpen = false" />
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import gsap from 'gsap'
import UserMenu from '../components/UserMenu.vue'
import { store, init, toast } from '../map/store.js'
import { sheet, openSheet, closeSheet, rollMode, sheetImg, exportSheet, replaceFromFile, deleteSheet, flush } from './sheetState.js'
import { openColorMenu } from './ui/colorMenu.js'
import ColorMenu from './ui/ColorMenu.vue'
import SheetIcon from './ui/SheetIcon.vue'
import SheetSearch from './SheetSearch.vue'
import SheetHistory from './SheetHistory.vue'
import SheetMeta from './SheetMeta.vue'
import PMain from './pages/PMain.vue'
import PDetails from './pages/PDetails.vue'
import PStats from './pages/PStats.vue'
import PSkills from './pages/PSkills.vue'
import PAttacks from './pages/PAttacks.vue'
import PTraits from './pages/PTraits.vue'
import PEquip from './pages/PEquip.vue'
import PInventory from './pages/PInventory.vue'
import PResources from './pages/PResources.vue'
import PJournal from './pages/PJournal.vue'
import PCustom from './pages/PCustom.vue'

const SECTIONS = [
  { key: 'main', name: 'Главная', icon: '👤', comp: PMain, onlySingle: true },
  { key: 'details', name: 'Предыстория', icon: '📜', comp: PDetails },
  { key: 'stats', name: 'Характеристики', icon: '📊', comp: PStats },
  { key: 'active', name: 'Активные навыки', tab: 'Активные', icon: '⚡', comp: PSkills, props: { list: 'Skills' } },
  { key: 'passive', name: 'Пассивные навыки', tab: 'Пассивные', icon: '🌀', comp: PSkills, props: { list: 'PassiveSkills' } },
  { key: 'attacks', name: 'Атаки', icon: '⚔', comp: PAttacks },
  { key: 'traits', name: 'Владения', icon: '🎓', comp: PTraits },
  { key: 'equip', name: 'Снаряжение', icon: '🛡', comp: PEquip },
  { key: 'inv', name: 'Инвентарь', icon: '🎒', comp: PInventory },
  { key: 'res', name: 'Ресурсы', icon: '❤', comp: PResources },
  { key: 'journal', name: 'Журнал', icon: '📝', comp: PJournal },
  { key: 'custom', name: 'Свои листы', icon: '📋', comp: PCustom }
]
// цвета шёлковых закладок
const SILK = ['#8e2f3a', '#2f5a8e', '#6d3f9a', '#2f7a64', '#a0662a', '#8a2f68', '#4f6e2a', '#a0822a', '#b2433a', '#3f528a', '#6a4632', '#2f6a7a']
// пылинки: место, размер, скорость — случайные, но постоянные
const motes = Array.from({ length: 16 }, (_, k) => ({ k, style: { left: `${5 + Math.random() * 90}%`, top: `${10 + Math.random() * 80}%`, '--d': `${9 + Math.random() * 10}s`, '--dl': `${-Math.random() * 12}s`, '--sz': `${1.5 + Math.random() * 2.5}px` } }))
const MODES = [{ v: '', t: 'd20', cls: '' }, { v: 'adv', t: '▲', cls: 'm-hi' }, { v: 'dis', t: '▼', cls: 'm-lo' }]
const SAVE_TEXT = { saving: 'сохраняю…', saved: '✓ сохранено', offline: '⚠ нет связи', loading: '' }
const SAVE_HINT = { saving: 'Изменения уходят на сервер', saved: 'Всё сохранено — видно мастеру и на других устройствах', offline: 'Сервер недоступен — правки не потеряются, отправлю, когда связь вернётся' }

const route = useRoute()
const router = useRouter()
const ready = computed(() => sheet.status !== 'loading' && sheet.status !== 'idle' && sheet.status !== 'error' && !!sheet.data && sheet.id === route.params.id)
const isMaster = computed(() => store.role === 'master')
const subtitle = computed(() => {
  const d = sheet.data, m = sheet.meta
  return [d.Race, d.Class && (d.Subclass ? `${d.Class} (${d.Subclass})` : d.Class), d.Level ? `${d.Level} уровень` : '', isMaster.value ? (m.ownerName || 'без игрока') : ''].filter(Boolean).join(' · ')
})
const themeVars = computed(() => {
  const acc = sheet.data?.Accent || '#C9A24F'
  return { '--acc': acc }
})
const readOnly = computed(() => !!sheet.meta?.deletedAt)
provide('sheetReadOnly', readOnly)
const opening = ref(false)
provide('bookOpening', opening)
provide('openDelay', 1.3) // числа и паутина ждут, пока обложка откроется

/* ---------- одна страница или разворот ---------- */
const single = ref(innerWidth < 980)
const onResize = () => { single.value = innerWidth < 980 }
const visibleSections = computed(() => SECTIONS.filter(s => !s.onlySingle || single.value))
// закладки: на развороте — половина над левой страницей, половина над правой (корешок свободен)
const markGroups = computed(() => {
  const list = visibleSections.value.map((s, n) => ({ ...s, n }))
  if (single.value) return [{ side: 'all', items: list }]
  const half = Math.ceil(list.length / 2)
  return [{ side: 'l', items: list.slice(0, half) }, { side: 'r', items: list.slice(half) }]
})
const cur = ref('stats')
const current = computed(() => SECTIONS.find(s => s.key === cur.value) || SECTIONS[2])
watch(single, s => { if (!s && cur.value === 'main') cur.value = 'stats' })
const pickStart = () => {
  const q = route.query.p
  cur.value = SECTIONS.some(s => s.key === q && (!s.onlySingle || single.value)) ? q : single.value ? 'main' : 'stats'
}

/* ---------- открытие книги ---------- */
const boardLRef = ref(null), stitchRef = ref(null), burstRef = ref(null)
const bookRef = ref(null), coverRef = ref(null), leftRef = ref(null), rightRef = ref(null), scrollRef = ref(null), searchRef = ref(null)
const coverShown = ref(true)
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
const pageNo = computed(() => visibleSections.value.findIndex(s => s.key === cur.value) + 2)
let tl = null, coverTimer = 0

// текст «проявляется чернилами»: из прозрачного и размытого, сверху вниз
const ink = (els, at, step = 0.035) => tl.fromTo(els, { opacity: 0, y: 8, filter: 'blur(5px)' },
  { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.55, stagger: step, ease: 'power2.out', clearProps: 'opacity,transform,filter' }, at)

async function playOpen() {
  await nextTick()
  const book = bookRef.value, cover = coverRef.value
  if (!book || !cover) return
  if (reduce) { coverShown.value = false; opening.value = false; return }
  const shift = single.value ? 0 : -book.offsetWidth / 4 // закрытая книга — по центру, открытая — разворот по центру
  // откуда прилетает обложка: карточка в списке листов
  let from = null
  try { from = JSON.parse(sessionStorage.getItem('sheet-fly') || 'null') } catch { /* нет */ }
  sessionStorage.removeItem('sheet-fly')
  // левая половина (переплёт, страница, корешок, ляссе) появляется, только когда на неё ляжет обложка
  const leftHalf = [boardLRef.value, leftRef.value, stitchRef.value, book.querySelector('.sb-ribbon')].filter(Boolean)
  const marks = book.querySelectorAll('.sb-mark')
  const front = cover.querySelector('.front'), back = cover.querySelector('.back')
  const rightInk = rightRef.value?.querySelectorAll('.sb-anim, .sb-run, .sb-pno') || []
  const leftInk = leftRef.value?.querySelectorAll('.sb-anim, .sb-run, .sb-pno') || []
  gsap.set(book, { x: shift })
  gsap.set(leftHalf, { opacity: 0 })
  // правая половина — пока обложка летит, её не видно; показываем, когда обложка встала на место
  const rightHalf = [book.querySelector('.sb-boards.r'), rightRef.value].filter(Boolean)
  gsap.set(rightHalf, { opacity: 0 })
  gsap.set([...rightInk, ...leftInk], { opacity: 0 })
  gsap.set(marks, { y: 46, opacity: 0 })
  gsap.set(back, { visibility: 'hidden' })
  gsap.set(cover, { transformPerspective: 2600, transformOrigin: '0% 50%' })
  const finish = () => { coverShown.value = false; setTimeout(() => { opening.value = false }, 400) }
  tl = gsap.timeline({ onComplete: finish })
  // запасной выход: что бы ни случилось с анимацией, обложка не останется висеть
  clearTimeout(coverTimer)
  coverTimer = setTimeout(finish, 6000)
  if (from?.id === sheet.id) {
    const r = cover.getBoundingClientRect()
    tl.from(cover, { x: from.x - r.left, y: from.y - r.top, scaleX: from.w / r.width, scaleY: from.h / r.height, transformOrigin: '0 0', duration: 0.65, ease: 'power3.inOut' })
  } else tl.from(cover, { y: 50, scale: 0.92, opacity: 0, duration: 0.55, ease: 'power3.out' })
  tl.addLabel('turn', '+=0.18')
    .set(rightHalf, { opacity: 1 }, 'turn')
    // обложку чуть приподнимает, потом она поворачивается вокруг корешка
    .to(cover, { rotateY: -12, duration: 0.25, ease: 'power1.out' }, 'turn')
    .to(cover, { rotateY: -90, duration: 0.45, ease: 'power2.in' }, 'turn+=0.25')
    .to(book, { x: 0, duration: 1.15, ease: 'power2.inOut' }, 'turn')
    .set(front, { visibility: 'hidden' }, 'turn+=0.7')
    .set(back, { visibility: 'visible' }, 'turn+=0.7')
    .to(cover, { rotateY: -180, duration: 0.5, ease: 'power2.out' }, 'turn+=0.7')
    .add(sparkle, 'turn+=0.55')
    // обложка легла: под ней левая половина книги
    .set(leftHalf, { opacity: 1 }, 'turn+=1.2')
    .to(cover, { opacity: 0, duration: 0.3 }, 'turn+=1.2')
  ink(rightInk, 'turn+=0.35', 0.03)
  ink(leftInk, 'turn+=1.25', 0.035)
  tl.to(marks, { y: 0, opacity: 1, duration: 0.5, stagger: 0.04, ease: 'back.out(1.8)', clearProps: 'transform,opacity' }, 'turn+=1.1')
}

// золотые искры из раскрытой книги
function sparkle() {
  const host = burstRef.value
  if (!host) return
  const W = bookRef.value.offsetWidth, H = bookRef.value.offsetHeight
  for (let i = 0; i < 34; i++) {
    const p = document.createElement('i')
    host.append(p)
    const a = Math.random() * Math.PI * 2, d = 120 + Math.random() * Math.min(W, H) * 0.55
    gsap.fromTo(p, { x: W / 2, y: H / 2, scale: 0.4 + Math.random(), opacity: 1 }, {
      x: W / 2 + Math.cos(a) * d * 1.4, y: H / 2 + Math.sin(a) * d - 60, opacity: 0, scale: 0, duration: 0.9 + Math.random() * 0.9, ease: 'power2.out', onComplete: () => p.remove()
    })
  }
  gsap.fromTo(host, { '--glow': 1 }, { '--glow': 0, duration: 1.2, ease: 'power2.out' })
}

/* ---------- перелистывание ---------- */
let turning = false
const idx = k => visibleSections.value.findIndex(s => s.key === k)
// копия страницы для анимации: поля ввода копируют и значения
function snapshot() {
  const src = scrollRef.value
  const c = src.cloneNode(true)
  const a = src.querySelectorAll('input, textarea, select'), b = c.querySelectorAll('input, textarea, select')
  a.forEach((el, i) => { if (b[i]) b[i].value = el.value })
  c.classList.add('sb-snap')
  c.style.overflow = 'hidden'
  return { node: c, top: src.scrollTop }
}
function leafAt(page, faceNode, top) {
  const leaf = document.createElement('div')
  leaf.className = 'sb-leaf'
  const r = page.getBoundingClientRect(), br = bookRef.value.getBoundingClientRect()
  Object.assign(leaf.style, { left: r.left - br.left + 'px', top: r.top - br.top + 'px', width: r.width + 'px', height: r.height + 'px' })
  const front = document.createElement('div'), back = document.createElement('div'), shade = document.createElement('i')
  front.className = 'sb-face sb-front'
  back.className = 'sb-face sb-backf'
  shade.className = 'sb-shade'
  if (faceNode) front.append(faceNode)
  front.append(shade)
  leaf.append(front, back)
  bookRef.value.append(leaf)
  gsap.set(leaf, { transformPerspective: 2600, transformOrigin: '0% 50%' })
  if (faceNode) faceNode.scrollTop = top
  return { leaf, shade, front, back }
}
// пустой лист «с текстом» — промежуточная страница при пролистывании веером
function paperLeaf(page, z) {
  const { leaf, shade } = leafAt(page, null, 0)
  leaf.classList.add('blank')
  leaf.style.zIndex = z
  return { leaf, shade }
}
async function goto(key, { instant = false } = {}) {
  if (!key || key === cur.value || turning) return
  router.replace({ query: { ...route.query, p: key } })
  if (instant || reduce || !scrollRef.value) { cur.value = key; return }
  turning = true
  const page = rightRef.value
  const from = idx(cur.value), to = idx(key), dir = to > from ? 1 : -1
  const mid = Math.min(Math.abs(to - from) - 1, 8) // сколько страниц пролистнуть между
  const D = mid ? 0.46 : 0.62, H = D / 2, STEP = 0.085
  // страховка: если анимацию прервут, листы не останутся висеть поверх страниц
  const extra = []
  const done = () => { clearTimeout(safety); extra.forEach(n => n.remove()); turning = false }
  const safety = setTimeout(done, 1800 + mid * 250)
  try {
    const tl2 = gsap.timeline({ onComplete: done })
    if (dir > 0) {
      // вперёд: старая страница уходит влево, за ней веером промежуточные, под ними уже новая
      const old = snapshot()
      cur.value = key
      await nextTick()
      for (let k = 0; k < mid; k++) {
        const { leaf, shade } = paperLeaf(page, 15 + mid - k)
        extra.push(leaf)
        const at = (k + 1) * STEP
        tl2.to(leaf, { rotateY: -180, duration: D, ease: 'power1.inOut' }, at)
          .fromTo(shade, { opacity: 0 }, { opacity: 0.5, duration: D / 2, ease: 'none' }, at)
      }
      const { leaf, shade, front, back } = leafAt(page, old.node, old.top)
      leaf.style.zIndex = 16 + mid
      extra.push(leaf)
      gsap.set(back, { visibility: 'hidden' })
      tl2.to(leaf, { rotateY: -90, duration: H, ease: 'power2.in' }, 0)
        .set(front, { visibility: 'hidden' }, H)
        .set(back, { visibility: 'visible' }, H)
        .to(leaf, { rotateY: -180, duration: H, ease: 'power2.out' }, H)
        .fromTo(shade, { opacity: 0 }, { opacity: 0.55, duration: H, ease: 'none' }, 0)
        .fromTo(scrollRef.value?.querySelectorAll('.sb-anim') || [], { opacity: 0, y: 6, filter: 'blur(4px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', stagger: 0.025, duration: 0.4, clearProps: 'opacity,transform,filter' }, mid * STEP + D * 0.35)
    } else {
      // назад: промежуточные страницы веером прилетают слева, последней ложится нужная
      const old = snapshot()
      const under = leafAt(page, old.node, old.top).leaf
      extra.push(under)
      under.classList.add('flat')
      under.style.zIndex = 14
      cur.value = key
      await nextTick()
      const fresh = snapshot()
      for (let k = 0; k < mid; k++) {
        const { leaf, shade } = paperLeaf(page, 15 + k)
        extra.push(leaf)
        const at = k * STEP
        gsap.set(leaf, { rotateY: -180, opacity: 0 })
        tl2.set(leaf, { opacity: 1 }, at)
          .to(leaf, { rotateY: 0, duration: D, ease: 'power1.inOut' }, at)
          .fromTo(shade, { opacity: 0.5 }, { opacity: 0, duration: D, ease: 'power1.in' }, at)
      }
      const { leaf, shade, front, back } = leafAt(page, fresh.node, fresh.top)
      leaf.style.zIndex = 16 + mid
      extra.push(leaf)
      const at = mid * STEP
      gsap.set(leaf, { rotateY: -180, opacity: mid ? 0 : 1 })
      gsap.set(front, { visibility: 'hidden' })
      tl2.set(leaf, { opacity: 1 }, at)
        .to(leaf, { rotateY: -90, duration: H, ease: 'power2.in' }, at)
        .set(back, { visibility: 'hidden' }, at + H)
        .set(front, { visibility: 'visible' }, at + H)
        .to(leaf, { rotateY: 0, duration: H, ease: 'power2.out' }, at + H)
        .fromTo(shade, { opacity: 0.55 }, { opacity: 0, duration: D, ease: 'power1.in' }, at)
    }
  } catch (e) { console.warn('[sheet] перелистывание', e); done() }
}
// свайп на телефоне: влево — следующий раздел, вправо — предыдущий
let sw = null
const swipeStart = e => { if (e.pointerType !== 'mouse') sw = { x: e.clientX, y: e.clientY, t: Date.now() } }
function swipeEnd(e) {
  if (!sw) return
  const dx = e.clientX - sw.x, dy = e.clientY - sw.y, fast = Date.now() - sw.t < 600
  sw = null
  if (!fast || Math.abs(dx) < 70 || Math.abs(dy) > Math.abs(dx) * 0.6 || e.target.closest('input, textarea, [contenteditable]')) return
  const list = visibleSections.value, i = idx(cur.value)
  goto(list[Math.max(0, Math.min(list.length - 1, i + (dx < 0 ? 1 : -1)))].key)
}
// найдено поиском: к разделу, прокрутить и подсветить
async function goFound(hit) {
  const target = single.value || hit.section !== 'main' ? hit.section : null
  if (target && target !== cur.value) { await goto(target); await new Promise(r => setTimeout(r, 650)) }
  await nextTick()
  const root = target ? scrollRef.value : leftRef.value
  const el = root?.querySelector(`[data-find="${CSS.escape(hit.anchor)}"]`)
  if (!el) return
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' })
  el.classList.remove('sb-flash')
  void el.offsetWidth
  el.classList.add('sb-flash')
}

/* ---------- меню ---------- */
const menuOpen = ref(false), historyOpen = ref(false), metaOpen = ref(false)
const openAccent = e => openColorMenu({ clientX: innerWidth - 260, clientY: 70 }, 'Accent', sheet.data.Accent, 'Цвет листа')
async function doExport() {
  try { await exportSheet(sheet.id, sheet.data.CharacterName) } catch (e) { toast(e.message, 'error') }
}
function doReplace() {
  const inp = Object.assign(document.createElement('input'), { type: 'file', accept: '.json,application/json' })
  inp.onchange = async () => {
    const f = inp.files?.[0]
    if (!f) return
    if (!confirm(`Заменить весь лист «${sheet.data.CharacterName}» содержимым файла «${f.name}»?${isMaster.value ? '' : ' Мастер сможет вернуть старый вариант.'}`)) return
    try { await replaceFromFile(f); toast('Лист заменён из файла') } catch (e) { toast(e.message, 'error') }
  }
  inp.click()
}
async function doDelete() {
  if (!confirm(`Удалить лист «${sheet.data.CharacterName}»? ${isMaster.value ? 'Он попадёт в корзину — его можно вернуть.' : 'Вернуть его сможет только мастер.'}`)) return
  try { await deleteSheet(sheet.id); toast('Лист удалён'); router.push('/sheets') } catch (e) { toast(e.message, 'error') }
}

// горячие клавиши: Ctrl+F — поиск по листу, PageUp / PageDown — листать
function onKey(e) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f' && ready.value) { e.preventDefault(); searchRef.value?.focus() }
  if (e.target.closest?.('input, textarea, select, [contenteditable="true"]')) return
  const list = visibleSections.value, i = idx(cur.value)
  if (e.key === 'PageDown') { e.preventDefault(); goto(list[Math.min(list.length - 1, i + 1)].key) }
  if (e.key === 'PageUp') { e.preventDefault(); goto(list[Math.max(0, i - 1)].key) }
  if (e.key === 'Escape') menuOpen.value = false
}

async function load(id) {
  coverShown.value = true
  opening.value = !reduce
  await openSheet(id)
  if (sheet.id !== id || !sheet.data) return
  pickStart()
  document.title = `${sheet.data.CharacterName} — лист персонажа`
  playOpen()
}
watch(() => route.params.id, id => { if (id) load(id) })
onMounted(() => {
  init()
  addEventListener('resize', onResize)
  addEventListener('keydown', onKey)
  load(route.params.id)
})
onBeforeUnmount(() => {
  tl?.kill()
  clearTimeout(coverTimer)
  removeEventListener('resize', onResize)
  removeEventListener('keydown', onKey)
  flush()
  closeSheet()
})
</script>

<style>
/* ---- общие классы страниц листа (префикс sb-, чтобы не пересечься с остальным сайтом) ---- */
.sb-root { --ink: #efe3c8; --muted: #a8936c; --paper: #1b1610; --paper2: #221b13; --line: color-mix(in srgb, var(--acc) 22%, transparent); }
.sb-h { display: flex; align-items: center; gap: 10px; margin: 0 0 12px; font: 700 24px 'Cormorant Garamond', serif; color: color-mix(in srgb, var(--acc) 70%, #fff3d6); letter-spacing: .01em; }
.sb-h::after { content: ''; flex: 1; height: 8px; background: radial-gradient(circle at 4px 4px, color-mix(in srgb, var(--acc) 60%, transparent) 2.5px, transparent 3px) no-repeat, linear-gradient(90deg, color-mix(in srgb, var(--acc) 40%, transparent), transparent) 10px 50% / 100% 1px no-repeat; }
.sb-h .ic { flex: none; width: 30px; height: 30px; padding: 6px; box-sizing: border-box; border-radius: 50%; color: color-mix(in srgb, var(--acc) 70%, #fff3d6); background: radial-gradient(circle at 35% 30%, color-mix(in srgb, var(--acc) 30%, #2a1d10), #120c07); box-shadow: 0 0 0 1.5px color-mix(in srgb, var(--acc) 60%, #e2c278), 0 0 12px color-mix(in srgb, var(--acc) 30%, transparent); }
.sb-h::before { content: none; }
.sb-h2 { margin: 18px 0 8px; font: 800 11px 'Manrope', sans-serif; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); }
.sb-card { padding: 12px; border-radius: 12px; background: color-mix(in srgb, var(--acc) 5%, rgba(0, 0, 0, .18)); border: 1px solid var(--line); }
.sb-btn { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 9px; border: 1px solid color-mix(in srgb, var(--acc) 40%, transparent); background: color-mix(in srgb, var(--acc) 8%, transparent); color: color-mix(in srgb, var(--acc) 60%, #fff3d6); font: 700 12.5px 'Manrope', sans-serif; cursor: pointer; text-decoration: none; transition: background .15s, transform .15s; }
.sb-btn:hover { background: color-mix(in srgb, var(--acc) 18%, transparent); }
.sb-btn:active { transform: scale(.96); }
.sb-btn.primary { background: linear-gradient(180deg, color-mix(in srgb, var(--acc) 85%, #fff), var(--acc)); color: #1b140c; border-color: var(--acc); }
.sb-btn.danger { border-color: rgba(255, 122, 107, .45); color: #ff9b8f; background: rgba(255, 122, 107, .06); }
.sb-btn:disabled { opacity: .45; cursor: default; }
.sb-x { width: 26px; height: 26px; flex: none; border-radius: 7px; border: 1px solid transparent; background: none; color: var(--muted); cursor: pointer; font-size: 14px; }
.sb-x:hover { border-color: rgba(255, 122, 107, .45); color: #ff9b8f; }
.sb-empty { padding: 22px; text-align: center; color: var(--muted); font: 600 13px 'Manrope', sans-serif; border: 1px dashed var(--line); border-radius: 12px; }
.sb-tools { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 12px; }
.sb-tools .grow { flex: 1; }
.sb-input { padding: 6px 10px; border-radius: 9px; border: 1px solid var(--line); background: rgba(0, 0, 0, .25); color: var(--ink); font: 600 13px 'Manrope', sans-serif; min-width: 0; }
.sb-input:focus { outline: none; border-color: var(--acc); }
.sb-chip { display: inline-flex; align-items: center; padding: 2px 9px; border-radius: 99px; border: 1px solid var(--line); color: var(--muted); font: 800 11px 'Manrope', sans-serif; letter-spacing: .03em; background: none; cursor: pointer; white-space: nowrap; }
.sb-chip.on { background: color-mix(in srgb, var(--acc) 20%, transparent); border-color: var(--acc); color: var(--ink); }
.sb-dot { width: 18px; height: 18px; flex: none; border-radius: 50%; border: 2px solid color-mix(in srgb, var(--acc) 50%, transparent); background: none; cursor: pointer; transition: background .2s, box-shadow .2s; }
.sb-dot.on { background: var(--acc); box-shadow: 0 0 10px color-mix(in srgb, var(--acc) 70%, transparent); }
.sb-handle { cursor: grab; color: var(--muted); padding: 0 4px; user-select: none; font-size: 14px; }
.sb-flash { animation: sb-flash 1.6s ease-out; border-radius: 10px; }
@keyframes sb-flash { 0%, 30% { box-shadow: 0 0 0 3px var(--acc), 0 0 26px color-mix(in srgb, var(--acc) 60%, transparent); } }
.sb-grid2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.sb-grid3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
@media (max-width: 560px) { .sb-grid3 { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>

<style scoped>
.sb-root { position: fixed; inset: 0; display: flex; flex-direction: column; background: radial-gradient(ellipse at 50% 0%, #1d1710 0%, #0d0b08 60%, #070605 100%); color: var(--ink); font-family: 'Manrope', sans-serif; overflow: hidden; }
.sb-top { display: flex; align-items: center; gap: 10px; padding: 10px 16px; min-height: 60px; box-sizing: border-box; border-bottom: 1px solid rgba(231, 197, 111, .14); background: rgba(13, 11, 8, .85); backdrop-filter: blur(6px); z-index: 30; }
.sb-back { padding: 6px 10px; border-radius: 9px; border: 1px solid rgba(231, 197, 111, .25); color: #f3d99a; text-decoration: none; font: 700 13px 'Manrope', sans-serif; white-space: nowrap; }
.sb-back:hover { background: rgba(231, 197, 111, .1); }
.sb-title { display: grid; min-width: 0; }
.sb-title b { font: 700 20px 'Cormorant Garamond', serif; color: #f3dc9e; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sb-title small { color: var(--muted); font-weight: 700; font-size: 11.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sb-save { font: 700 11.5px 'Manrope', sans-serif; color: var(--muted); white-space: nowrap; }
.sb-save.saved { color: #7ccf8b; }
.sb-save.offline { color: #ff9b8f; }
.grow { flex: 1; }
.sb-mode { display: flex; padding: 2px; border-radius: 9px; border: 1px solid rgba(231, 197, 111, .22); background: rgba(0, 0, 0, .3); }
.sb-mode button { min-width: 30px; padding: 4px 7px; border: 0; border-radius: 7px; background: none; color: var(--muted); font: 800 12px 'Manrope', sans-serif; cursor: pointer; }
.sb-mode button.on { background: rgba(231, 197, 111, .18); color: #f3d99a; }
.sb-mode button.m-hi.on { background: rgba(120, 200, 120, .2); color: #a8e6a1; }
.sb-mode button.m-lo.on { background: rgba(255, 122, 107, .18); color: #ff9b8f; }
.sb-icon-btn { width: 34px; height: 34px; border-radius: 9px; border: 1px solid rgba(231, 197, 111, .25); background: none; color: #f3d99a; font-size: 18px; cursor: pointer; }
.sb-menu-wrap { position: relative; }
.sb-menu { position: absolute; right: 0; top: 40px; z-index: 50; display: grid; min-width: 250px; padding: 6px; border-radius: 12px; background: #17130e; border: 1px solid #8a6630; box-shadow: 0 18px 40px rgba(0, 0, 0, .6); animation: sb-pop .14s ease-out; }
.sb-menu > * { padding: 8px 10px; border: 0; border-radius: 8px; background: none; color: #efe3c8; font: 600 13px 'Manrope', sans-serif; text-align: left; cursor: pointer; text-decoration: none; }
.sb-menu > *:hover { background: rgba(231, 197, 111, .1); }
.sb-menu .danger { color: #ff9b8f; }
@keyframes sb-pop { from { opacity: 0; transform: translateY(-6px); } }
.sb-err, .sb-loading { margin: auto; display: grid; gap: 14px; justify-items: center; color: var(--muted); font: 700 14px 'Manrope', sans-serif; }
.sb-err b { color: #ff9b8f; font-size: 16px; }
.sb-spin { width: 34px; height: 34px; border-radius: 50%; border: 3px solid rgba(231, 197, 111, .2); border-top-color: #e7c56f; animation: sb-spin .9s linear infinite; }
@keyframes sb-spin { to { transform: rotate(360deg); } }

/* ---- книга ---- */
.sb-stage { position: relative; flex: 1; min-height: 0; display: grid; place-items: center; padding: 50px 22px 34px; perspective: 2400px; }
/* тёплый свет свечи за книгой */
.sb-stage::before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse 55% 60% at 50% 55%, color-mix(in srgb, var(--acc) 22%, rgba(255, 170, 80, .16)), transparent 70%); animation: sb-candle 5s ease-in-out infinite; pointer-events: none; }
@keyframes sb-candle { 0%, 100% { opacity: .85; } 30% { opacity: 1; } 55% { opacity: .78; } 75% { opacity: .95; } }
.sb-mote { position: absolute; width: var(--sz); height: var(--sz); border-radius: 50%; background: #ffe2a8; box-shadow: 0 0 6px #ffcf7a; opacity: 0; animation: sb-mote var(--d) linear infinite; animation-delay: var(--dl); pointer-events: none; }
@keyframes sb-mote { 0% { transform: translate(0, 20px); opacity: 0; } 15% { opacity: .55; } 85% { opacity: .35; } 100% { transform: translate(30px, -120px); opacity: 0; } }

.sb-book { position: relative; display: grid; grid-template-columns: 1fr 1fr; width: min(1500px, 100%); height: 100%; max-height: 1000px; padding: 14px; box-sizing: border-box; }
/* переплёт: кожа в цвет листа, тиснёная рамка, золотые уголки, прошитый корешок */
.sb-boards { position: absolute; top: 0; bottom: 0; z-index: 0;
  background:
    radial-gradient(ellipse at 30% 20%, rgba(255, 255, 255, .06), transparent 50%),
    repeating-linear-gradient(45deg, rgba(255, 230, 170, .025) 0 1px, transparent 1px 22px),
    repeating-linear-gradient(-45deg, rgba(255, 230, 170, .025) 0 1px, transparent 1px 22px),
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='l'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.4' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .22 0'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23l)'/%3E%3C/svg%3E"),
    linear-gradient(160deg, color-mix(in srgb, var(--acc) 34%, #2c1b0e), color-mix(in srgb, var(--acc) 14%, #120a05));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--acc) 50%, #000), inset 0 0 0 5px rgba(0, 0, 0, .25), inset 0 0 0 6px color-mix(in srgb, var(--acc) 45%, #d9b66a), inset 0 0 40px rgba(0, 0, 0, .6), 0 40px 80px rgba(0, 0, 0, .75), 0 0 0 1px #000; }
.sb-boards.l { left: 0; right: 50%; border-radius: 20px 4px 4px 20px; }
.sb-boards.r { left: 50%; right: 0; border-radius: 4px 20px 20px 4px; }
.single .sb-boards.r { left: 0; border-radius: 20px; }
/* колонтитул и номер страницы — как в настоящей книге */
.sb-run { position: absolute; top: 7px; left: 0; right: 0; z-index: 3; text-align: center; font: 700 10px 'Manrope', sans-serif; letter-spacing: .28em; text-transform: uppercase; color: color-mix(in srgb, var(--acc) 45%, var(--muted)); opacity: .7; pointer-events: none; }
.sb-run::before, .sb-run::after { content: '❦'; margin: 0 10px; letter-spacing: 0; opacity: .7; }
.sb-pno { position: absolute; bottom: 8px; left: 0; right: 0; z-index: 3; text-align: center; font: italic 600 13px 'Cormorant Garamond', serif; color: color-mix(in srgb, var(--acc) 50%, var(--muted)); opacity: .75; pointer-events: none; }
.single .sb-run, .single .sb-pno { display: none; }
.cn { position: absolute; width: 58px; height: 58px; pointer-events: none; opacity: .9;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 60' fill='none' stroke='%23e2c278' stroke-width='1.6' stroke-linecap='round'%3E%3Cpath d='M3 57V15Q3 3 15 3h42'/%3E%3Cpath d='M8 50V18q0-10 10-10h32'/%3E%3Cpath d='M3 3c9 0 15 6 15 15 0-6 4-10 10-10-6 0-10-4-10-10 0 5-4 9-9 9'/%3E%3Ccircle cx='18' cy='18' r='2.6' fill='%23e2c278'/%3E%3Cpath d='M30 3c0 5 3 7 7 8M3 30c5 0 7 3 8 7'/%3E%3C/svg%3E") center / contain no-repeat;
  filter: drop-shadow(0 1px 0 rgba(0, 0, 0, .8)); }
.cn.tl { left: 6px; top: 6px; }
.cn.tr { right: 6px; top: 6px; transform: scaleX(-1); }
.cn.bl { left: 6px; bottom: 6px; transform: scaleY(-1); }
.cn.br { right: 6px; bottom: 6px; transform: scale(-1, -1); }
.sb-stitch { position: absolute; left: 50%; top: 14px; bottom: 14px; width: 12px; transform: translateX(-50%); z-index: 3; pointer-events: none;
  background: linear-gradient(90deg, rgba(0, 0, 0, .55), #0d0805 45%, #0d0805 55%, rgba(0, 0, 0, .55)); box-shadow: 0 0 14px 4px rgba(0, 0, 0, .45); }
/* стежки нитью: короткие золотые штрихи по центру складки */
.sb-stitch::after { content: ''; position: absolute; left: 50%; top: 18px; bottom: 18px; width: 2px; margin-left: -1px; background: repeating-linear-gradient(180deg, color-mix(in srgb, var(--acc) 40%, #c9a45a) 0 7px, transparent 7px 22px); opacity: .7; border-radius: 1px; }

.sb-page { position: relative; z-index: 2; min-width: 0; overflow: hidden; background:
    radial-gradient(ellipse at 50% 40%, color-mix(in srgb, var(--acc) 7%, transparent), transparent 70%),
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3'/%3E%3CfeColorMatrix values='0 0 0 0 .9 0 0 0 0 .8 0 0 0 0 .6 0 0 0 .06 0'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E"),
    linear-gradient(180deg, var(--paper2), var(--paper)); }
/* толщина стопки страниц по внешним краям и тень у корешка */
.sb-page.left { border-radius: 10px 2px 2px 10px; margin-right: 6px; box-shadow: -1px 1px 0 #3d3122, -2px 2px 0 #15100a, -3px 3px 0 #3a2e20, -4px 4px 0 #15100a, -5px 5px 0 #352a1d, -6px 6px 0 #0f0b07, inset -30px 0 40px -20px rgba(0, 0, 0, .55), 0 10px 30px rgba(0, 0, 0, .5); }
.sb-page.right { border-radius: 2px 10px 10px 2px; margin-left: 6px; box-shadow: 1px 1px 0 #3d3122, 2px 2px 0 #15100a, 3px 3px 0 #3a2e20, 4px 4px 0 #15100a, 5px 5px 0 #352a1d, 6px 6px 0 #0f0b07, inset 30px 0 40px -20px rgba(0, 0, 0, .55), 0 10px 30px rgba(0, 0, 0, .5); }
.single .sb-book { grid-template-columns: 1fr; padding: 10px; }
.single .sb-page.right { border-radius: 10px; margin-left: 0; }
.sb-spine { position: absolute; right: 0; top: 0; bottom: 0; width: 50px; background: linear-gradient(90deg, transparent, rgba(0, 0, 0, .3) 70%, rgba(0, 0, 0, .55)); pointer-events: none; z-index: 2; }
.sb-page.right::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 40px; background: linear-gradient(90deg, rgba(0, 0, 0, .55), rgba(255, 240, 210, .03) 60%, transparent); pointer-events: none; z-index: 2; }
/* загнутый уголок */
.single .sb-page.right::before { display: none; }
.sb-scroll { position: absolute; inset: 22px 0 26px; overflow-y: auto; overflow-x: hidden; padding: 12px 28px 26px; scrollbar-width: thin; scrollbar-color: color-mix(in srgb, var(--acc) 35%, transparent) transparent; }
.sb-page.right .sb-scroll { padding-left: 40px; }
.single .sb-scroll { inset: 0; padding: 16px 14px 50px; }

/* закладки: шёлковые ленты из-за верхнего края */
.sb-marks { position: absolute; bottom: calc(100% - 22px); display: flex; align-items: flex-end; gap: 4px; z-index: 1; pointer-events: none; }
.sb-marks.l { left: 3%; right: calc(50% + 26px); justify-content: flex-end; }
.sb-marks.r { left: calc(50% + 26px); right: 3%; justify-content: flex-start; }
.sb-mark { pointer-events: auto; position: relative; display: flex; align-items: center; gap: 6px; height: 54px; padding: 0 11px 18px; box-sizing: border-box; border: 0; border-radius: 8px 8px 0 0; cursor: pointer; color: #fff4dc; white-space: nowrap;
  background: linear-gradient(90deg, rgba(0, 0, 0, .28), rgba(255, 255, 255, .1) 35%, rgba(0, 0, 0, .05) 60%, rgba(0, 0, 0, .3)), var(--silk);
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, .35), 0 -2px 8px rgba(0, 0, 0, .35);
  transform: translateY(14px); transition: transform .28s cubic-bezier(.2, 1.4, .4, 1), filter .2s; filter: saturate(.75) brightness(.8); }
.sb-mark::before { content: ''; position: absolute; left: 4px; right: 4px; top: 4px; bottom: 0; border: 1px dashed rgba(255, 240, 210, .35); border-bottom: 0; border-radius: 6px 6px 0 0; pointer-events: none; }
.sb-mark .ic { width: 16px; height: 16px; flex: none; color: #fff4dc; }
.sb-mark .nm { font: 800 11.5px 'Manrope', sans-serif; letter-spacing: .03em; text-shadow: 0 1px 0 rgba(0, 0, 0, .5); }
.sb-mark:hover { transform: translateY(6px); filter: none; }
.sb-mark.on { transform: translateY(0); filter: none; box-shadow: inset 0 0 0 1px rgba(0, 0, 0, .35), 0 -4px 16px color-mix(in srgb, var(--silk) 70%, transparent), 0 0 0 1px color-mix(in srgb, var(--acc) 60%, #fff3d6); }
.sb-mark.on::after { content: ''; position: absolute; left: 50%; top: 6px; width: 5px; height: 5px; margin-left: -2.5px; border-radius: 50%; background: #ffe7a8; box-shadow: 0 0 8px #ffd27a; }
@media (max-width: 1360px) { .sb-mark:not(.on):not(:hover) .nm { display: none; } }

/* ляссе */
.sb-ribbon { position: absolute; left: calc(50% + 14px); top: calc(100% - 16px); width: 16px; height: 62px; z-index: 3; background: linear-gradient(90deg, rgba(0, 0, 0, .3), rgba(255, 255, 255, .15) 40%, rgba(0, 0, 0, .25)), var(--acc); clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 80%, 0 100%); transform-origin: 50% 0; animation: sb-sway 4.5s ease-in-out infinite; filter: drop-shadow(0 4px 4px rgba(0, 0, 0, .5)); }
@keyframes sb-sway { 0%, 100% { transform: rotate(-3deg); } 50% { transform: rotate(4deg); } }

/* искры при открытии */
.sb-burst { position: absolute; inset: 0; z-index: 30; pointer-events: none; --glow: 0; background: radial-gradient(ellipse 40% 50% at 50% 50%, rgba(255, 214, 140, calc(var(--glow) * .45)), transparent 70%); }
.sb-burst :deep(i) { position: absolute; left: 0; top: 0; width: 6px; height: 6px; margin: -3px; border-radius: 50%; background: radial-gradient(circle, #fff6d8, #ffc85a 45%, transparent 70%); box-shadow: 0 0 10px #ffcf6a; }

.single .sb-stage { padding: 52px 6px 8px; }
.single .sb-marks { left: 6px; right: 6px; gap: 4px; justify-content: flex-start; overflow-x: auto; overflow-y: hidden; scrollbar-width: none; padding-top: 10px; }
.single .sb-mark { padding: 0 9px 18px; height: 52px; }
.single .sb-mark:not(.on) .nm { display: none; }

/* обложка */
.sb-cover { position: absolute; top: 0; bottom: 0; left: 50%; width: 50%; transform-style: preserve-3d; z-index: 20; pointer-events: none; }
.single .sb-cover { left: 0; width: 100%; }
.sb-cover .face { position: absolute; inset: 0; backface-visibility: hidden; border-radius: 4px 20px 20px 4px; }
.sb-cover .front {
  display: grid; place-items: center;
  background:
    radial-gradient(ellipse at 40% 25%, rgba(255, 255, 255, .08), transparent 55%),
    repeating-linear-gradient(45deg, rgba(255, 230, 170, .035) 0 1px, transparent 1px 22px),
    repeating-linear-gradient(-45deg, rgba(255, 230, 170, .035) 0 1px, transparent 1px 22px),
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='l'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.4' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .25 0'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23l)'/%3E%3C/svg%3E"),
    linear-gradient(160deg, color-mix(in srgb, var(--acc) 40%, #3a2716), color-mix(in srgb, var(--acc) 15%, #140d07));
  border: 1px solid color-mix(in srgb, var(--acc) 50%, #000); box-shadow: inset 0 0 0 6px rgba(0, 0, 0, .2), inset 0 0 0 8px color-mix(in srgb, var(--acc) 45%, #d9b66a), inset 0 0 90px rgba(0, 0, 0, .6), 0 30px 70px rgba(0, 0, 0, .75);
}
.sb-cover .front::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 30px; border-radius: 4px 0 0 4px; background: linear-gradient(90deg, rgba(0, 0, 0, .55), rgba(255, 255, 255, .08), transparent); }
.sb-cover .back { transform: rotateY(180deg); border-radius: 20px 4px 4px 20px; background: radial-gradient(ellipse at 30% 20%, rgba(255, 255, 255, .06), transparent 50%),
    repeating-linear-gradient(45deg, rgba(255, 230, 170, .025) 0 1px, transparent 1px 22px),
    repeating-linear-gradient(-45deg, rgba(255, 230, 170, .025) 0 1px, transparent 1px 22px),
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='l'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.4' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .22 0'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23l)'/%3E%3C/svg%3E"),
    linear-gradient(160deg, color-mix(in srgb, var(--acc) 34%, #2c1b0e), color-mix(in srgb, var(--acc) 14%, #120a05)); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--acc) 50%, #000), inset 0 0 0 6px color-mix(in srgb, var(--acc) 45%, #d9b66a); }
.sb-cover .back .paper { position: absolute; top: 14px; bottom: 14px; left: 14px; right: 6px; border-radius: 10px 2px 2px 10px; background: linear-gradient(270deg, rgba(0, 0, 0, .45), transparent 40px), linear-gradient(180deg, var(--paper2), var(--paper)); }
.sb-cover .cn { width: 74px; height: 74px; }
.sb-cover .cn.tl { left: 18px; top: 14px; } .sb-cover .cn.tr { right: 14px; top: 14px; } .sb-cover .cn.bl { left: 18px; bottom: 14px; } .sb-cover .cn.br { right: 14px; bottom: 14px; }
.cv-gem { position: absolute; top: 9%; left: 50%; width: 22px; height: 22px; margin-left: -11px; transform: rotate(45deg); background: radial-gradient(circle at 35% 35%, #fff, var(--acc) 40%, color-mix(in srgb, var(--acc) 50%, #000)); border: 2px solid #e2c278; box-shadow: 0 0 16px var(--acc); }
.cv-frame { position: relative; display: grid; justify-items: center; gap: 14px; padding: 40px 30px; width: 66%; border: 2px solid color-mix(in srgb, var(--acc) 50%, #e2c278); border-radius: 14px; box-shadow: 0 0 0 6px rgba(0, 0, 0, .2), 0 0 0 8px color-mix(in srgb, var(--acc) 30%, #b8913f), inset 0 0 30px rgba(0, 0, 0, .4); text-align: center; }
.cv-medal { width: 160px; height: 160px; border-radius: 50%; overflow: hidden; display: grid; place-items: center; border: 4px solid #e2c278; box-shadow: 0 0 0 4px rgba(0, 0, 0, .35), 0 0 34px color-mix(in srgb, var(--acc) 55%, transparent), inset 0 0 20px rgba(0, 0, 0, .6); background: #120d08; font: 700 64px 'Cormorant Garamond', serif; color: var(--acc); }
.cv-medal img { width: 100%; height: 100%; object-fit: cover; }
.cv-name { font: 700 32px 'Cormorant Garamond', serif; background: linear-gradient(180deg, #fff3cf, #e2c278 55%, #9b7430); -webkit-background-clip: text; background-clip: text; color: transparent; filter: drop-shadow(0 2px 0 rgba(0, 0, 0, .7)); }
.cv-sub { color: #e2c278; font: 800 12px 'Manrope', sans-serif; letter-spacing: .2em; text-transform: uppercase; opacity: .8; }

@media (max-width: 760px) {
  .hide-sm, .sb-title small, .sb-save { display: none; }
  .sb-top { gap: 6px; padding: 8px 10px; }
  .sb-mode button { min-width: 24px; padding: 4px 5px; }
}
</style>

<style>
/* лист, который переворачивается (создаётся скриптом — без scoped) */
.sb-leaf { position: absolute; z-index: 15; transform-style: preserve-3d; transform-origin: 0% 50%; pointer-events: none; }
.sb-leaf .sb-face { position: absolute; inset: 0; overflow: hidden; backface-visibility: hidden; border-radius: 4px 14px 14px 4px; background: linear-gradient(180deg, var(--paper2), var(--paper)); border: 1px solid color-mix(in srgb, var(--acc) 30%, #3b2a1a); }
.sb-leaf .sb-backf { transform: rotateY(180deg); border-radius: 14px 4px 4px 14px; background: linear-gradient(270deg, rgba(0, 0, 0, .35), transparent 30%), linear-gradient(180deg, var(--paper2), var(--paper)); }
.sb-leaf .sb-shade { position: absolute; inset: 0; background: linear-gradient(90deg, rgba(0, 0, 0, .7), rgba(0, 0, 0, .15)); opacity: 0; pointer-events: none; }
.sb-leaf.flat { z-index: 14; }
.sb-leaf.blank .sb-face { background:
    linear-gradient(90deg, transparent 40px, transparent calc(100% - 40px)),
    repeating-linear-gradient(180deg, transparent 0 17px, color-mix(in srgb, var(--acc) 10%, rgba(255, 240, 210, .07)) 17px 19px) 48px 90px / calc(100% - 96px) calc(100% - 140px) no-repeat,
    linear-gradient(90deg, color-mix(in srgb, var(--acc) 30%, transparent), transparent) 48px 48px / 40% 14px no-repeat,
    linear-gradient(180deg, var(--paper2), var(--paper)); }
.sb-leaf .sb-snap { position: absolute; inset: 0; }
</style>
