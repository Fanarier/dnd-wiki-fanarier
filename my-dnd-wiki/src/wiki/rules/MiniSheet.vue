<template>
  <!-- мини-лист в журнале деятельностей: та же книга листа, только маленькая и в плавающем окне.
       Призывается магией: под окном вспыхивает круг рун, книга влетает из-за края экрана и раскрывается.
       Страницы — настоящие страницы листа, правки уходят в тот же лист (и видны вживую всем) -->
  <Teleport to="body">
    <div class="ms-layer" :style="{ '--acc': acc }">
      <!-- круг призыва — под окном, на месте, куда прилетит книга -->
      <svg ref="circleRef" class="ms-circle" :style="circleStyle" viewBox="-100 -100 200 200" aria-hidden="true">
        <defs>
          <path id="ms-rune-path" d="M0,-80 A80,80 0 1,1 -0.01,-80" />
          <radialGradient id="ms-circle-glow"><stop offset=".55" stop-color="var(--acc)" stop-opacity="0" /><stop offset=".8" stop-color="var(--acc)" stop-opacity=".22" /><stop offset="1" stop-color="var(--acc)" stop-opacity="0" /></radialGradient>
        </defs>
        <circle r="98" fill="url(#ms-circle-glow)" />
        <g class="ms-ring outer">
          <circle r="92" /><circle r="88" class="thin" />
          <text><textPath href="#ms-rune-path">{{ RUNES }}</textPath></text>
        </g>
        <g class="ms-ring inner">
          <circle r="66" class="thin" />
          <polygon points="0,-66 57,33 -57,33" /><polygon points="0,66 57,-33 -57,-33" />
          <circle r="34" />
          <circle v-for="k in 6" :key="k" r="4" :cx="66 * Math.sin(k * Math.PI / 3)" :cy="-66 * Math.cos(k * Math.PI / 3)" class="dot" />
        </g>
      </svg>

      <div v-if="alive" ref="winRef" class="ms sb-root" :class="{ moving, veil }" :style="boxStyle">
        <div ref="bookRef" class="ms-book">
          <div class="ms-boards" aria-hidden="true"><i class="cn tl" /><i class="cn tr" /><i class="cn bl" /><i class="cn br" /></div>
          <header class="ms-head" title="Потянуть — переложить книгу" @pointerdown="dragStart">
            <span class="ms-av"><img v-if="photo" :src="photo" alt="" /><template v-else>{{ initial }}</template></span>
            <div class="ms-title">
              <b>{{ title }}</b>
              <small v-if="ready">{{ subtitle }}</small>
            </div>
            <span v-if="ready && readOnly" class="ms-ro" title="Этот лист тебе можно только смотреть">👁</span>
            <span v-else-if="ready" class="ms-save" :class="sheet.status" :title="SAVE_HINT[sheet.status]">{{ SAVE_TEXT[sheet.status] || '' }}</span>
            <router-link class="ms-btn" :to="{ path: `/sheets/${sheetId}`, query: { p: cur } }" title="Открыть большую книгу листа на этой странице">⤢</router-link>
            <button type="button" class="ms-btn x" title="Отпустить книгу" @click="dismiss()">✕</button>
          </header>
          <nav ref="marksRef" class="ms-marks" aria-label="Разделы листа">
            <button v-for="(s, n) in SECTIONS" :key="s.key" type="button" class="ms-mark" :class="{ on: cur === s.key }" :style="{ '--silk': SILK[n % SILK.length] }" :title="s.name" :aria-label="s.name" @click="turnTo(s.key)">
              <SheetIcon :name="s.key" class="ic" />
            </button>
          </nav>
          <section ref="pageRef" class="ms-page">
            <span class="ms-run" aria-hidden="true">{{ page.name }}</span>
            <div v-if="ready" ref="scrollRef" :key="cur" class="ms-scroll">
              <component :is="page.comp" v-bind="page.props || {}" @go="turnTo" />
            </div>
            <div v-else-if="sheet.status === 'error' && sheet.id === sheetId" class="ms-wait err">{{ sheet.error }}</div>
            <div v-else class="ms-wait"><span class="ms-spin" />Книга проявляется…</div>
          </section>
          <i class="ms-grip" title="Потянуть — размер книги" @pointerdown="resizeStart" />
          <BookFx ref="fxRef" :book="bookRef" />
        </div>
        <!-- обложка: видна, пока книга летит и раскрывается -->
        <div v-if="coverShown" ref="coverRef" class="ms-cover" aria-hidden="true">
          <div class="face front">
            <i class="cn tl" /><i class="cn tr" /><i class="cn bl" /><i class="cn br" />
            <i class="cv-gem" />
            <div class="cv-medal"><img v-if="photo" :src="photo" alt="" /><span v-else>{{ initial }}</span></div>
            <b class="cv-name">{{ title }}</b>
          </div>
          <div class="face back" />
        </div>
      </div>
      <!-- искры: след летящей книги и вспышка при раскрытии -->
      <div ref="sparkRef" class="ms-sparks" aria-hidden="true" />
    </div>
    <ColorMenu />
  </Teleport>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, provide, reactive, ref, watch } from 'vue'
import gsap from 'gsap'
import { store, dice } from '../../map/store.js'
import { sheet, openSheet, closeSheet, sheetGen, sheetImg, lastRoll } from '../../sheets/sheetState.js'
import { natural } from '../../shared/dice.js'
import { hpMax } from '../../shared/sheet.js'
import { sfx } from '../../sound/sound.js'
import SheetIcon from '../../sheets/ui/SheetIcon.vue'
import BookFx from '../../sheets/ui/BookFx.vue'
import ColorMenu from '../../sheets/ui/ColorMenu.vue'
import PMain from '../../sheets/pages/PMain.vue'
import PDetails from '../../sheets/pages/PDetails.vue'
import PStats from '../../sheets/pages/PStats.vue'
import PSkills from '../../sheets/pages/PSkills.vue'
import PAttacks from '../../sheets/pages/PAttacks.vue'
import PTraits from '../../sheets/pages/PTraits.vue'
import PTraining from '../../sheets/pages/PTraining.vue'
import PEquip from '../../sheets/pages/PEquip.vue'
import PInventory from '../../sheets/pages/PInventory.vue'
import PResources from '../../sheets/pages/PResources.vue'
import PJournal from '../../sheets/pages/PJournal.vue'
import PCustom from '../../sheets/pages/PCustom.vue'
import '../../sheets/sheetCommon.css' // последними — поверх стилей страниц, как в большой книге

const props = defineProps({
  sheetId: { type: String, required: true },
  name: { type: String, default: '' }, // имя и портрет героя — для обложки, пока лист ещё грузится
  avatar: { type: String, default: '' }
})
const emit = defineEmits(['close'])

// разделы — те же, что в большой книге
const SECTIONS = [
  { key: 'main', name: 'Главная', comp: PMain },
  { key: 'stats', name: 'Характеристики', comp: PStats },
  { key: 'details', name: 'Предыстория', comp: PDetails },
  { key: 'active', name: 'Активные навыки', comp: PSkills, props: { list: 'Skills' } },
  { key: 'passive', name: 'Пассивные навыки', comp: PSkills, props: { list: 'PassiveSkills' } },
  { key: 'attacks', name: 'Атаки', comp: PAttacks },
  { key: 'traits', name: 'Владения', comp: PTraits },
  { key: 'train', name: 'Тренировки и обучение', comp: PTraining },
  { key: 'equip', name: 'Снаряжение', comp: PEquip },
  { key: 'inv', name: 'Инвентарь', comp: PInventory },
  { key: 'res', name: 'Ресурсы', comp: PResources },
  { key: 'journal', name: 'Журнал', comp: PJournal },
  { key: 'custom', name: 'Свои листы', comp: PCustom }
]
const SILK = ['#8e2f3a', '#2f5a8e', '#6d3f9a', '#2f7a64', '#a0662a', '#8a2f68', '#4f6e2a', '#7a5a9e', '#a0822a', '#b2433a', '#3f528a', '#6a4632', '#2f6a7a']
const RUNES = 'ᚠᚢᚦᚨᚱᚲᚷᚹ ᚺᚾᛁᛃᛇᛈᛉᛊ ᛏᛒᛖᛗᛚᛜᛞᛟ ᚠᚢᚦᚨᚱᚲᚷᚹ ᚺᚾᛁᛃᛇᛈᛉᛊ ᛏᛒᛖᛗᛚᛜᛞᛟ'
const SAVE_TEXT = { saving: 'сохраняю…', saved: '✓', offline: '⚠ нет связи' }
const SAVE_HINT = { saving: 'Изменения уходят в лист', saved: 'Всё сохранено в листе', offline: 'Сервер недоступен — правки не потеряются, отправлю, когда связь вернётся' }
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches

/* ---------- лист ---------- */
const ready = computed(() => sheet.id === props.sheetId && !!sheet.data && !['loading', 'idle', 'error'].includes(sheet.status))
const readOnly = computed(() => !!sheet.meta?.deletedAt || sheet.meta?.canEdit === false)
const opening = ref(!reduce)
provide('sheetReadOnly', readOnly)
provide('bookOpening', opening)
provide('openDelay', 0.9)
const acc = computed(() => (ready.value && sheet.data.Accent) || '#C9A24F')
const title = computed(() => (ready.value && sheet.data.CharacterName) || props.name || 'Лист персонажа')
const photo = computed(() => (ready.value && sheet.data.PhotoFile ? sheetImg(sheet.data.PhotoFile) : props.avatar))
const initial = computed(() => (title.value.trim()[0] || '?').toUpperCase())
const subtitle = computed(() => {
  const d = sheet.data
  return [d.Race, d.Class, d.Level ? `${d.Level} ур.` : ''].filter(Boolean).join(' · ')
})
let myGen = -1
function load(id) {
  const p = openSheet(id)
  myGen = sheetGen()
  return p
}
async function release() {
  if (myGen >= 0) await closeSheet(myGen)
}

/* ---------- окно: где лежит и какого размера (запоминается) ---------- */
const BOX_KEY = 'mini-sheet-box'
const box = reactive(defaultBox())
function defaultBox() {
  const w = Math.min(500, innerWidth - 40), h = Math.min(760, innerHeight - 110)
  let saved = null
  try { saved = JSON.parse(localStorage.getItem(BOX_KEY) || 'null') } catch { /* нет хранилища */ }
  return clampBox(saved && saved.w ? saved : { x: innerWidth - w - 28, y: 84, w, h })
}
function clampBox(b) {
  const w = Math.max(340, Math.min(b.w, innerWidth - 16)), h = Math.max(380, Math.min(b.h, innerHeight - 16))
  return { w, h, x: Math.max(8, Math.min(b.x, innerWidth - w - 8)), y: Math.max(8, Math.min(b.y, innerHeight - h - 8)) }
}
const saveBox = () => { try { localStorage.setItem(BOX_KEY, JSON.stringify(box)) } catch { /* не страшно */ } }
const boxStyle = computed(() => ({ left: box.x + 'px', top: box.y + 'px', width: box.w + 'px', height: box.h + 'px' }))
const circleStyle = computed(() => {
  const d = Math.min(box.w, box.h) * 1.3
  return { left: box.x + box.w / 2 - d / 2 + 'px', top: box.y + box.h / 2 - d / 2 + 'px', width: d + 'px', height: d + 'px' }
})
const moving = ref(false)
let drag = null
function dragStart(e) {
  if (e.button !== 0 || e.target.closest('button, a, input, textarea, select')) return
  e.preventDefault()
  drag = { kind: 'move', px: e.clientX, py: e.clientY, x: box.x, y: box.y }
  begin(e)
}
function resizeStart(e) {
  if (e.button !== 0) return
  e.preventDefault()
  drag = { kind: 'size', px: e.clientX, py: e.clientY, w: box.w, h: box.h }
  begin(e)
}
function begin(e) {
  moving.value = true
  e.target.setPointerCapture?.(e.pointerId)
  addEventListener('pointermove', onDrag)
  addEventListener('pointerup', endDrag, { once: true })
  addEventListener('pointercancel', endDrag, { once: true })
}
function onDrag(e) {
  if (!drag) return
  const dx = e.clientX - drag.px, dy = e.clientY - drag.py
  if (drag.kind === 'move') Object.assign(box, clampBox({ ...box, x: drag.x + dx, y: drag.y + dy }))
  else Object.assign(box, clampBox({ ...box, w: drag.w + dx, h: drag.h + dy }))
}
function endDrag() {
  drag = null
  moving.value = false
  removeEventListener('pointermove', onDrag)
  removeEventListener('pointerup', endDrag)
  removeEventListener('pointercancel', endDrag)
  saveBox()
}
const onResize = () => {
  if (innerWidth < 640) return dismiss(true) // на телефоне мини-листа нет
  Object.assign(box, clampBox(box))
}

/* ---------- страницы ---------- */
const cur = ref('main')
try { const k = localStorage.getItem('mini-sheet-page'); if (SECTIONS.some(s => s.key === k)) cur.value = k } catch { /* нет */ }
const page = computed(() => SECTIONS.find(s => s.key === cur.value) || SECTIONS[0])
const winRef = ref(null), bookRef = ref(null), coverRef = ref(null), pageRef = ref(null), scrollRef = ref(null), marksRef = ref(null)
const circleRef = ref(null), sparkRef = ref(null), fxRef = ref(null)
// текст страницы проявляется чернилами
function inkIn(root, delay = 0) {
  const els = root?.querySelectorAll('.sb-anim') || []
  if (!els.length || reduce) return
  gsap.fromTo(els, { opacity: 0, filter: 'blur(4px)' }, { opacity: 1, filter: 'blur(0px)', delay, stagger: 0.02, duration: 0.38, ease: 'power1.out', clearProps: 'opacity,filter' })
}
// другой раздел: старая страница (копия) переворачивается, под ней уже новая
let turning = false
async function turnTo(key) {
  if (key === cur.value || !SECTIONS.some(s => s.key === key)) return
  try { localStorage.setItem('mini-sheet-page', key) } catch { /* нет */ }
  const from = SECTIONS.findIndex(s => s.key === cur.value), to = SECTIONS.findIndex(s => s.key === key)
  const old = scrollRef.value, host = pageRef.value
  if (reduce || turning || !old || !host || !ready.value) { cur.value = key; return }
  turning = true
  const fwd = to > from
  const leaf = document.createElement('div')
  leaf.className = 'ms-leaf'
  const copy = old.cloneNode(true)
  old.querySelectorAll('input, textarea, select').forEach((el, i) => { const c = copy.querySelectorAll('input, textarea, select')[i]; if (c) c.value = el.value })
  const shade = document.createElement('i')
  shade.className = 'ms-leaf-shade'
  leaf.append(copy, shade)
  host.append(leaf)
  copy.scrollTop = old.scrollTop
  cur.value = key
  await nextTick()
  sfx('pageFlip', 0.35)
  inkIn(scrollRef.value, 0.15)
  const done = () => { leaf.remove(); turning = false }
  gsap.set(leaf, { transformPerspective: 1600, transformOrigin: fwd ? '0% 50%' : '100% 50%' })
  gsap.timeline({ onComplete: done })
    .to(leaf, { rotateY: fwd ? -100 : 100, duration: 0.55, ease: 'power2.in' }, 0)
    .to(shade, { opacity: 0.6, duration: 0.55, ease: 'none' }, 0)
    .to(leaf, { opacity: 0, duration: 0.18 }, 0.4)
  setTimeout(() => { if (turning) done() }, 1500)
}

/* ---------- призыв: круг рун, книга влетает из-за края экрана, раскрывается ---------- */
const alive = ref(false)
const veil = ref(true) // окно уже на месте, но книга ещё не вылетела — не показываем
const coverShown = ref(true)
let tl = null, circleSpin = null, safety = 0, trailOn = false
// искра в слое искр (координаты экрана)
function spark(x, y, { spread = 30, rise = 60, life = 0.9, big = false } = {}) {
  const host = sparkRef.value
  if (!host) return
  const p = document.createElement('i')
  if (big) p.className = 'big'
  host.append(p)
  gsap.timeline({ onComplete: () => p.remove() })
    .fromTo(p, { x, y, scale: 0.3, opacity: 0 }, { scale: 0.5 + Math.random() * 0.9, opacity: 1, duration: 0.15, ease: 'power1.out' })
    .to(p, { x: x + (Math.random() - 0.5) * spread * 2, y: y - Math.random() * rise + rise * 0.2, duration: life, ease: 'sine.out' }, 0)
    .to(p, { opacity: 0, scale: 0.1, duration: life * 0.6, ease: 'power1.in' }, life * 0.4)
}
// след: искры сыплются с корешка летящей книги
function trail() {
  if (!trailOn || !winRef.value) return
  const r = winRef.value.getBoundingClientRect()
  for (let i = 0; i < 2; i++) spark(r.left + Math.random() * r.width * 0.3, r.top + r.height * (0.15 + Math.random() * 0.7), { spread: 18, rise: -30, life: 0.7 + Math.random() * 0.5, big: i === 0 && Math.random() < 0.3 })
}
function burstAround(n = 40) {
  const r = winRef.value?.getBoundingClientRect()
  if (!r) return
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, rx = r.width * 0.55, ry = r.height * 0.52
    spark(r.left + r.width / 2 + Math.cos(a) * rx * (0.6 + Math.random() * 0.4), r.top + r.height / 2 + Math.sin(a) * ry * (0.6 + Math.random() * 0.4), { spread: 40, rise: 90, life: 1 + Math.random() * 0.8, big: i % 5 === 0 })
  }
}
function circleIn() {
  const c = circleRef.value
  if (!c) return
  circleSpin?.kill()
  gsap.killTweensOf(c)
  gsap.set(c, { display: 'block' })
  gsap.fromTo(c, { scale: 0.2, opacity: 0, rotation: -90 }, { scale: 1, opacity: 1, rotation: 0, duration: 0.6, ease: 'back.out(1.6)' })
  circleSpin = gsap.to(c.querySelectorAll('.ms-ring.outer'), { rotation: 360, svgOrigin: '0 0', duration: 14, ease: 'none', repeat: -1 })
  gsap.to(c.querySelectorAll('.ms-ring.inner'), { rotation: -360, svgOrigin: '0 0', duration: 20, ease: 'none', repeat: -1 })
}
function circleOut(delay = 0) {
  const c = circleRef.value
  if (!c) return
  gsap.to(c, { scale: 1.25, opacity: 0, duration: 0.6, delay, ease: 'power2.in', onComplete: () => { circleSpin?.kill(); gsap.killTweensOf(c.querySelectorAll('.ms-ring')); gsap.set(c, { display: 'none' }) } })
}
// книга улетает/прилетает из-за правого края экрана по дуге
const offEdge = () => ({ x: innerWidth - box.x + 60, y: -Math.min(220, box.y + 120) })

async function summon() {
  alive.value = true
  veil.value = true
  coverShown.value = true
  opening.value = !reduce
  const loading = load(props.sheetId)
  await nextTick()
  if (reduce) { coverShown.value = false; opening.value = false; veil.value = false; await loading; return }
  circleIn()
  sfx('cloudWhoosh', 0.18)
  // книге надо знать цвет и портрет — ждём лист немного, но не дольше 0.7 с (обложка возьмёт карточку героя)
  await Promise.race([loading, new Promise(r => setTimeout(r, 700))])
  await nextTick()
  const win = winRef.value, book = bookRef.value, cover = coverRef.value
  if (!win || !book || !cover) { veil.value = false; return }
  const front = cover.querySelector('.front'), back = cover.querySelector('.back')
  const o = offEdge()
  gsap.set(book, { opacity: 0 })
  gsap.set(back, { visibility: 'hidden' })
  gsap.set(cover, { transformPerspective: 1800, transformOrigin: '0% 50%', rotateY: 0, opacity: 1 })
  gsap.set(win, { transformPerspective: 1400, x: o.x, y: o.y, rotation: 28, rotateY: -40, scale: 0.42, opacity: 1 })
  veil.value = false
  const finish = () => {
    clearTimeout(safety)
    trailOn = false
    coverShown.value = false
    gsap.set([win, book], { clearProps: 'transform,opacity' })
    setTimeout(() => { opening.value = false }, 500)
  }
  clearTimeout(safety)
  safety = setTimeout(finish, 4500)
  trailOn = true
  tl?.kill()
  tl = gsap.timeline({ onComplete: finish, onUpdate: trail })
    // полёт по дуге: сначала вверх-влево, потом вниз к кругу, по пути выпрямляется
    .to(win, { keyframes: [
      { x: o.x * 0.45, y: o.y * 1.1 - 40, rotation: 12, rotateY: -20, scale: 0.7, duration: 0.45, ease: 'power1.out' },
      { x: 0, y: -18, rotation: -3, rotateY: 0, scale: 1.03, duration: 0.45, ease: 'power2.inOut' },
      { y: 0, rotation: 0, scale: 1, duration: 0.3, ease: 'back.out(3)' }
    ] })
    .call(() => { trailOn = false; sfx('bookPlace', 0.6); burstAround(26) }, null, 0.92)
    // круг вспыхивает, книга вздрагивает — и раскрывается
    .to(circleRef.value, { scale: 1.08, duration: 0.18, yoyo: true, repeat: 1, ease: 'power1.inOut' }, 0.92)
    .addLabel('open', 1.3)
    .call(() => { sfx('bookOpen', 1); setTimeout(() => sfx('pageFlip', 0.3), 240) }, null, 'open')
    .set(book, { opacity: 1 }, 'open')
    .to(cover, { rotateY: -14, duration: 0.2, ease: 'power1.out' }, 'open')
    .to(cover, { rotateY: -90, duration: 0.38, ease: 'power2.in' }, 'open+=0.2')
    .set(front, { visibility: 'hidden' }, 'open+=0.58')
    .set(back, { visibility: 'visible' }, 'open+=0.58')
    .to(cover, { rotateY: -165, opacity: 0, duration: 0.42, ease: 'power2.out' }, 'open+=0.58')
    .call(() => burstAround(40), null, 'open+=0.45')
    .fromTo(marksRef.value?.children || [], { y: -26, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, stagger: 0.03, ease: 'back.out(2)', clearProps: 'transform,opacity' }, 'open+=0.55')
    .call(() => inkIn(scrollRef.value), null, 'open+=0.4')
  circleOut(2.1)
}

// отпустить книгу: обложка захлопывается, книга улетает за край, круг гаснет
let leaving = false
async function dismiss(instant = false, then = () => emit('close')) {
  if (leaving) return
  leaving = true
  tl?.progress(1)
  const win = winRef.value
  if (instant || reduce || !win) { await release(); leaving = false; alive.value = false; return then() }
  coverShown.value = true
  await nextTick()
  const cover = coverRef.value, book = bookRef.value
  if (!cover) { await release(); leaving = false; alive.value = false; return then() }
  const front = cover.querySelector('.front'), back = cover.querySelector('.back')
  gsap.set(cover, { transformPerspective: 1800, transformOrigin: '0% 50%', rotateY: -165, opacity: 0 })
  gsap.set(front, { visibility: 'hidden' })
  gsap.set(back, { visibility: 'visible' })
  gsap.set(win, { transformPerspective: 1400 })
  circleIn()
  const o = offEdge()
  sfx('pageFlip', 0.3)
  tl = gsap.timeline({ onUpdate: trail, onComplete: async () => { trailOn = false; alive.value = false; circleOut(0); await release(); leaving = false; then() } })
    .to(marksRef.value?.children || [], { y: -26, opacity: 0, duration: 0.25, stagger: 0.012, ease: 'power2.in' }, 0)
    .to(cover, { rotateY: -90, opacity: 1, duration: 0.3, ease: 'power2.in' }, 0.05)
    .set(back, { visibility: 'hidden' }, 0.35)
    .set(front, { visibility: 'visible' }, 0.35)
    .set(book, { opacity: 0 }, 0.35)
    .to(cover, { rotateY: 0, duration: 0.28, ease: 'power3.in' }, 0.35)
    .call(() => { sfx('bookClose', 0.6); burstAround(18) }, null, 0.63)
    .to(win, { keyframes: { y: [0, 5, 0] }, duration: 0.16 }, 0.63)
    .call(() => { trailOn = true; sfx('cloudWhoosh', 0.15) }, null, 0.85)
    .to(win, { keyframes: [
      { y: -30, rotation: -4, scale: 1.04, duration: 0.25, ease: 'power2.out' },
      { x: o.x * 0.5, y: o.y - 40, rotation: 14, rotateY: -25, scale: 0.7, duration: 0.35, ease: 'power2.in' },
      { x: o.x, y: o.y, rotation: 28, rotateY: -40, scale: 0.42, duration: 0.3, ease: 'power1.in' }
    ] }, 0.85)
}

// выбрали в журнале другого героя — книга улетает, прилетает его книга
watch(() => props.sheetId, async (id, old) => {
  if (!id || id === old) return
  await dismiss(false, () => {})
  summon()
})
// сменили вход (мастер ↔ игра персонажем) — права на лист другие, перечитываем
watch(() => `${store.me?.id}|${store.role}`, (n, o) => { if (o && n !== o && alive.value && !leaving) load(props.sheetId) })

/* ---------- живые эффекты, как в большой книге: урон, лечение, уровень, бросок ---------- */
const hpEl = () => bookRef.value?.querySelector('.pr-hp, .pm-hp')
let fxBase = null, fxTimer = 0
watch(() => [sheet.id, sheet.data?.HpData?.Current, sheet.data?.Level], (n, o) => {
  if (!o || n[0] !== o[0] || !ready.value || opening.value) { fxBase = null; clearTimeout(fxTimer); return }
  fxBase ||= { hp: o[1] ?? 0, lv: o[2] ?? 0 }
  clearTimeout(fxTimer)
  fxTimer = setTimeout(() => {
    const base = fxBase
    fxBase = null
    if (!base || !sheet.data || !fxRef.value) return
    const d = (sheet.data.HpData.Current ?? 0) - base.hp
    if (d < 0) fxRef.value.hit(-d, hpEl())
    else if (d > 0) fxRef.value.heal(d, hpEl())
    if ((sheet.data.Level ?? 0) > base.lv) { fxRef.value.levelUp(sheet.data.Level); sfx('crit', 0.5) }
  }, 380)
})
watch(() => dice.pops.length, (len, old) => {
  if (len <= old || !ready.value) return
  const p = dice.pops[len - 1]
  if (!p?.mine || !lastRoll.el || !bookRef.value?.contains(lastRoll.el) || p.label !== lastRoll.label || Date.now() - lastRoll.at > 20000) return
  const nat = natural(p)
  fxRef.value?.roll(p.total, nat === 20 ? 'crit' : nat === 1 ? 'fail' : '', lastRoll.el)
  lastRoll.el = null
})
// хиты на нуле — книга тускнеет, как большая
watch(() => ready.value && hpMax(sheet.data) > 0 && sheet.data.HpData.Current <= 0, down => winRef.value?.classList.toggle('downed', !!down))

defineExpose({ dismiss })
onMounted(() => {
  addEventListener('resize', onResize)
  summon()
})
onBeforeUnmount(() => {
  removeEventListener('resize', onResize)
  endDrag()
  tl?.kill()
  circleSpin?.kill()
  clearTimeout(safety)
  clearTimeout(fxTimer)
  release()
})
</script>

<style scoped>
.ms-layer { position: fixed; inset: 0; z-index: 300; pointer-events: none; }
.ms-circle { position: fixed; display: none; pointer-events: none; overflow: visible; filter: drop-shadow(0 0 6px var(--acc)) drop-shadow(0 0 18px color-mix(in srgb, var(--acc) 60%, transparent)); }
.ms-circle circle, .ms-circle polygon { fill: none; stroke: color-mix(in srgb, var(--acc) 70%, #fff3d6); stroke-width: 1.4; }
.ms-circle circle:first-child { stroke: none; }
.ms-circle .thin { stroke-width: .7; opacity: .7; }
.ms-circle .dot { fill: color-mix(in srgb, var(--acc) 60%, #fff3d6); stroke: none; }
.ms-circle polygon { stroke-width: 1; opacity: .8; }
.ms-circle text { fill: color-mix(in srgb, var(--acc) 75%, #fff3d6); font: 600 9.5px serif; letter-spacing: 3px; }

.ms { position: fixed; pointer-events: auto; color: var(--ink); font-family: 'Manrope', sans-serif; will-change: transform; }
.ms.moving { user-select: none; }
.ms.veil { visibility: hidden; }
.ms-book { position: absolute; inset: 0; display: flex; flex-direction: column; padding: 10px 10px 12px; box-sizing: border-box; }
.ms-boards { position: absolute; inset: 0; z-index: 0; border-radius: 16px; pointer-events: none;
  background:
    radial-gradient(ellipse at 30% 20%, rgba(255, 255, 255, .06), transparent 50%),
    repeating-linear-gradient(45deg, rgba(255, 230, 170, .025) 0 1px, transparent 1px 22px),
    repeating-linear-gradient(-45deg, rgba(255, 230, 170, .025) 0 1px, transparent 1px 22px),
    linear-gradient(160deg, color-mix(in srgb, var(--acc) 34%, #2c1b0e), color-mix(in srgb, var(--acc) 14%, #120a05));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--acc) 50%, #000), inset 0 0 0 4px rgba(0, 0, 0, .25), inset 0 0 0 5px color-mix(in srgb, var(--acc) 45%, #d9b66a), inset 0 0 30px rgba(0, 0, 0, .6), 0 30px 70px rgba(0, 0, 0, .7), 0 0 30px color-mix(in srgb, var(--acc) 18%, transparent), 0 0 0 1px #000; }
.ms.downed .ms-boards { filter: grayscale(.7) brightness(.75); box-shadow: inset 0 0 0 5px rgba(160, 40, 30, .6), 0 30px 70px rgba(0, 0, 0, .7); }
.cn { position: absolute; width: 40px; height: 40px; pointer-events: none; opacity: .85;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 60' fill='none' stroke='%23e2c278' stroke-width='1.6' stroke-linecap='round'%3E%3Cpath d='M3 57V15Q3 3 15 3h42'/%3E%3Cpath d='M8 50V18q0-10 10-10h32'/%3E%3Cpath d='M3 3c9 0 15 6 15 15 0-6 4-10 10-10-6 0-10-4-10-10 0 5-4 9-9 9'/%3E%3Ccircle cx='18' cy='18' r='2.6' fill='%23e2c278'/%3E%3Cpath d='M30 3c0 5 3 7 7 8M3 30c5 0 7 3 8 7'/%3E%3C/svg%3E") center / contain no-repeat;
  filter: drop-shadow(0 1px 0 rgba(0, 0, 0, .8)); }
.cn.tl { left: 5px; top: 5px; } .cn.tr { right: 5px; top: 5px; transform: scaleX(-1); }
.cn.bl { left: 5px; bottom: 5px; transform: scaleY(-1); } .cn.br { right: 5px; bottom: 5px; transform: scale(-1, -1); }

.ms-head { position: relative; z-index: 3; display: flex; align-items: center; gap: 9px; padding: 2px 6px 8px 8px; cursor: grab; touch-action: none; }
.ms.moving .ms-head { cursor: grabbing; }
.ms-av { flex: none; width: 34px; height: 34px; border-radius: 50%; overflow: hidden; display: grid; place-items: center; border: 2px solid #e2c278; background: #120d08; color: var(--acc); font: 700 18px 'Cormorant Garamond', serif; box-shadow: 0 0 12px color-mix(in srgb, var(--acc) 45%, transparent); }
.ms-av img { width: 100%; height: 100%; object-fit: cover; }
.ms-title { flex: 1; display: grid; min-width: 0; }
.ms-title b { font: 700 19px 'Cormorant Garamond', serif; color: #f3dc9e; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.1; }
.ms-title small { color: color-mix(in srgb, var(--acc) 40%, #c9b48a); font: 700 11px 'Manrope', sans-serif; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ms-save { font: 700 11px 'Manrope', sans-serif; color: #c9b48a; white-space: nowrap; }
.ms-save.saved { color: #7ccf8b; }
.ms-save.offline { color: #ff9b8f; }
.ms-ro { font-size: 13px; opacity: .85; }
.ms-btn { flex: none; display: grid; place-items: center; width: 28px; height: 28px; border-radius: 8px; border: 1px solid color-mix(in srgb, var(--acc) 40%, transparent); background: rgba(0, 0, 0, .25); color: #f3dc9e; font: 700 14px 'Manrope', sans-serif; cursor: pointer; text-decoration: none; transition: background .15s, transform .15s; }
.ms-btn:hover { background: color-mix(in srgb, var(--acc) 20%, transparent); }
.ms-btn:active { transform: scale(.92); }
.ms-btn.x:hover { border-color: rgba(255, 122, 107, .5); color: #ff9b8f; background: rgba(255, 122, 107, .1); }

/* закладки — шёлковые ленточки над страницей */
.ms-marks { position: relative; z-index: 1; display: flex; gap: 3px; padding: 0 12px; margin-bottom: -6px; }
.ms-mark { flex: 1 1 0; min-width: 0; max-width: 40px; height: 34px; display: grid; place-items: start center; padding-top: 6px; box-sizing: border-box; border: 0; border-radius: 6px 6px 0 0; cursor: pointer;
  background: linear-gradient(180deg, color-mix(in srgb, var(--silk) 80%, #fff 8%), var(--silk)); box-shadow: inset 0 0 0 1px rgba(0, 0, 0, .3); transform: translateY(6px); transition: transform .18s, filter .18s; filter: brightness(.8) saturate(.85); }
.ms-mark .ic { width: 15px; height: 15px; color: #fff4dc; }
.ms-mark:hover { transform: translateY(2px); filter: none; }
.ms-mark.on { transform: translateY(-2px); filter: none; box-shadow: inset 0 0 0 1px rgba(0, 0, 0, .35), 0 -3px 12px color-mix(in srgb, var(--silk) 70%, transparent), 0 0 0 1px color-mix(in srgb, var(--acc) 60%, #fff3d6); }

.ms-page { position: relative; z-index: 2; flex: 1; min-height: 0; overflow: hidden; border-radius: 6px 10px 10px 6px;
  background: radial-gradient(ellipse at 50% 40%, color-mix(in srgb, var(--acc) 7%, transparent), transparent 70%), linear-gradient(180deg, var(--paper2), var(--paper));
  box-shadow: 1px 1px 0 #3d3122, 2px 2px 0 #15100a, 3px 3px 0 #3a2e20, 4px 4px 0 #0f0b07, inset 22px 0 30px -18px rgba(0, 0, 0, .55), 0 8px 24px rgba(0, 0, 0, .5); }
.ms-run { position: absolute; top: 10px; left: 0; right: 0; z-index: 3; text-align: center; font: 700 9.5px 'Manrope', sans-serif; letter-spacing: .26em; text-transform: uppercase; color: color-mix(in srgb, var(--acc) 45%, var(--muted)); opacity: .75; pointer-events: none; }
.ms-run::before, .ms-run::after { content: '❦'; margin: 0 8px; letter-spacing: 0; opacity: .7; }
.ms-scroll { position: absolute; inset: 28px 0 6px; overflow-y: auto; overflow-x: hidden; padding: 8px 18px 22px 24px; }
/* страницы листа рассчитаны на большую книгу — в маленькой чуть плотнее */
.ms-scroll :deep(.sb-h) { font-size: 21px; }
.ms-wait { position: absolute; inset: 0; display: grid; place-content: center; justify-items: center; gap: 10px; color: var(--muted); font: 700 13px 'Manrope', sans-serif; }
.ms-wait.err { color: #ff9b8f; padding: 20px; text-align: center; }
.ms-spin { width: 22px; height: 22px; border-radius: 50%; border: 2px solid color-mix(in srgb, var(--acc) 30%, transparent); border-top-color: var(--acc); animation: ms-spin .8s linear infinite; }
@keyframes ms-spin { to { transform: rotate(360deg); } }
.ms-grip { position: absolute; right: 2px; bottom: 2px; z-index: 5; width: 18px; height: 18px; cursor: nwse-resize; touch-action: none;
  background: linear-gradient(135deg, transparent 50%, color-mix(in srgb, var(--acc) 70%, #e2c278) 50% 58%, transparent 58% 68%, color-mix(in srgb, var(--acc) 70%, #e2c278) 68% 76%, transparent 76%); opacity: .7; }
.ms-grip:hover { opacity: 1; }

/* обложка */
.ms-cover { position: absolute; inset: 0; z-index: 20; transform-style: preserve-3d; pointer-events: none; }
.ms-cover .face { position: absolute; inset: 0; backface-visibility: hidden; border-radius: 4px 16px 16px 4px; }
.ms-cover .front { display: grid; place-content: center; justify-items: center; gap: 16px;
  background:
    radial-gradient(ellipse at 40% 25%, rgba(255, 255, 255, .08), transparent 55%),
    repeating-linear-gradient(45deg, rgba(255, 230, 170, .035) 0 1px, transparent 1px 22px),
    repeating-linear-gradient(-45deg, rgba(255, 230, 170, .035) 0 1px, transparent 1px 22px),
    linear-gradient(160deg, color-mix(in srgb, var(--acc) 40%, #3a2716), color-mix(in srgb, var(--acc) 15%, #140d07));
  border: 1px solid color-mix(in srgb, var(--acc) 50%, #000);
  box-shadow: inset 0 0 0 5px rgba(0, 0, 0, .2), inset 0 0 0 7px color-mix(in srgb, var(--acc) 45%, #d9b66a), inset 0 0 70px rgba(0, 0, 0, .6), 0 30px 70px rgba(0, 0, 0, .75), 0 0 40px color-mix(in srgb, var(--acc) 35%, transparent); }
.ms-cover .front::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 24px; border-radius: 4px 0 0 4px; background: linear-gradient(90deg, rgba(0, 0, 0, .55), rgba(255, 255, 255, .08), transparent); }
.ms-cover .back { transform: rotateY(180deg); border-radius: 16px 4px 4px 16px; background: linear-gradient(160deg, color-mix(in srgb, var(--acc) 34%, #2c1b0e), color-mix(in srgb, var(--acc) 14%, #120a05)); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--acc) 50%, #000), inset 0 0 0 5px color-mix(in srgb, var(--acc) 45%, #d9b66a); }
.cv-gem { position: absolute; top: 8%; left: 50%; width: 18px; height: 18px; margin-left: -9px; transform: rotate(45deg); background: radial-gradient(circle at 35% 35%, #fff, var(--acc) 40%, color-mix(in srgb, var(--acc) 50%, #000)); border: 2px solid #e2c278; box-shadow: 0 0 16px var(--acc); }
.cv-medal { width: 130px; height: 130px; border-radius: 50%; overflow: hidden; display: grid; place-items: center; border: 4px solid #e2c278; box-shadow: 0 0 0 4px rgba(0, 0, 0, .35), 0 0 34px color-mix(in srgb, var(--acc) 55%, transparent), inset 0 0 20px rgba(0, 0, 0, .6); background: #120d08; font: 700 54px 'Cormorant Garamond', serif; color: var(--acc); }
.cv-medal img { width: 100%; height: 100%; object-fit: cover; }
.cv-name { max-width: 80%; text-align: center; font: 700 28px 'Cormorant Garamond', serif; background: linear-gradient(180deg, #fff3cf, #e2c278 55%, #9b7430); -webkit-background-clip: text; background-clip: text; color: transparent; filter: drop-shadow(0 2px 0 rgba(0, 0, 0, .7)); }

.ms-sparks { position: fixed; inset: 0; pointer-events: none; z-index: 1; }
.ms-sparks :deep(i) { position: absolute; left: 0; top: 0; width: 5px; height: 5px; margin: -2.5px; border-radius: 50%; background: radial-gradient(circle, #fffaf0, color-mix(in srgb, var(--acc) 60%, #ffd27a) 50%, transparent 72%); box-shadow: 0 0 7px 1px color-mix(in srgb, var(--acc) 70%, #ffcf6a); }
.ms-sparks :deep(i.big) { width: 8px; height: 8px; margin: -4px; box-shadow: 0 0 14px 3px color-mix(in srgb, var(--acc) 70%, #ffcf6a); }
</style>

<style>
/* перевёрнутая страница мини-листа (создаётся скриптом — без scoped) */
.ms-leaf { position: absolute; inset: 0; z-index: 4; overflow: hidden; pointer-events: none; border-radius: 6px 10px 10px 6px; backface-visibility: hidden;
  background: radial-gradient(ellipse at 50% 40%, color-mix(in srgb, var(--acc) 7%, transparent), transparent 70%), linear-gradient(180deg, var(--paper2), var(--paper)); }
.ms-leaf > .ms-scroll { position: absolute; inset: 28px 0 6px; overflow: hidden; padding: 8px 18px 22px 24px; }
.ms-leaf-shade { position: absolute; inset: 0; background: linear-gradient(90deg, rgba(0, 0, 0, .7), rgba(0, 0, 0, .15)); opacity: 0; }
</style>
