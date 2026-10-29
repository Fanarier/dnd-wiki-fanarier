<template>
  <!-- мини-лист в журнале деятельностей: карточка героя с его листом в плавающем окне.
       Призыв: веером раскладываются карточки всех героев (те же, что на странице героев, со своими темами),
       подсветка бежит по ним, как рулетка, и останавливается на выбранном; остальные падают, выбранная летит
       на место окна и один раз переворачивается — на обороте лист (правки сразу в лист).
       Вкладки — мультяшный «шлёп»-переворот: чем дальше вкладка, тем больше шлепков и быстрее.
       Все анимации идут по очереди и не мешают друг другу -->
  <Teleport to="body">
    <div class="ms-layer" :style="layerVars">
      <!-- колода героев (только пока идёт выбор) -->
      <div v-if="deck.length" ref="deckRef" class="md-deck" :class="{ rolling }">
        <div v-for="h in deck" :key="h.id" class="md-card hc" :data-id="h.id" :class="{ hl: hl === h.id }"><HeroCard :hero="h" /></div>
      </div>

      <div v-if="alive" ref="winRef" class="ms sb-root" :class="{ moving, veil }" :style="boxStyle">
        <div ref="cardRef" class="mc" :class="{ flat }">
          <!-- ===== лицо: настоящая карточка героя (видна только при призыве) ===== -->
          <div class="face front" aria-hidden="true">
            <div ref="heroWrapRef" class="hc" :style="{ '--k': hcScale }"><HeroCard v-if="hero && showFront" :hero="hero" /></div>
          </div>

          <!-- ===== оборот: страницы листа, в теме героя ===== -->
          <div class="face back" :class="{ themed: !!theme }">
            <svg v-if="theme" class="mark" viewBox="0 0 24 24" aria-hidden="true"><path :d="HERO_THEMES[theme].icon" fill="currentColor" /></svg>
            <i class="rivet a" /><i class="rivet b" /><i class="rivet c" /><i class="stripe" />
            <header class="ms-head" title="Потянуть — переложить карточку" @pointerdown="dragStart">
              <span class="ms-av"><img v-if="cover" :src="cover.src" :style="cover.style" alt="" /><template v-else>{{ initial }}</template></span>
              <div class="ms-title">
                <b>{{ title }}</b>
                <small>{{ subtitle }}</small>
              </div>
              <span v-if="ready && readOnly" class="ms-ro" title="Этот лист тебе можно только смотреть">👁</span>
              <span v-else-if="ready" class="ms-save" :class="sheet.status" :title="SAVE_HINT[sheet.status]">{{ SAVE_TEXT[sheet.status] || '' }}</span>
              <router-link class="ms-btn" :to="{ path: `/sheets/${shownSheet}`, query: { p: cur } }" title="Открыть большую книгу листа на этой странице">⤢</router-link>
              <button type="button" class="ms-btn x" title="Убрать карточку" @click="dismiss()">✕</button>
            </header>
            <nav class="ms-marks" aria-label="Разделы листа">
              <button v-for="(s, n) in SECTIONS" :key="s.key" type="button" class="ms-mark" :class="{ on: cur === s.key }" :style="{ '--silk': SILK[n % SILK.length] }" :title="s.name" :aria-label="s.name" @click="turnTo(s.key)">
                <SheetIcon :name="s.key" class="ic" />
              </button>
            </nav>
            <section class="ms-page">
              <span class="ms-run" aria-hidden="true">{{ page.name }}</span>
              <div v-if="ready" ref="scrollRef" :key="cur" class="ms-scroll">
                <component :is="page.comp" v-bind="page.props || {}" @go="turnTo" />
              </div>
              <div v-else-if="sheet.status === 'error' && sheet.id === shownSheet" class="ms-wait err">{{ sheet.error }}</div>
              <div v-else class="ms-wait"><span class="ms-spin" />Лист загружается…</div>
            </section>
            <i class="ms-grip" title="Потянуть — размер карточки" @pointerdown="resizeStart" />
            <BookFx ref="fxRef" :book="cardRef" />
          </div>
        </div>
      </div>
      <!-- искры -->
      <div ref="sparkRef" class="ms-sparks" aria-hidden="true" />
    </div>
    <ColorMenu />
  </Teleport>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, provide, reactive, ref, watch } from 'vue'
import gsap from 'gsap'
import { store, dice, heroCover, heroPortraitUrl } from '../../map/store.js'
import { sheet, openSheet, closeSheet, sheetGen, lastRoll } from '../../sheets/sheetState.js'
import { natural } from '../../shared/dice.js'
import { hpMax } from '../../shared/sheet.js'
import { groupColor } from '../../shared/catalog.js'
import { HERO_THEMES, heroThemeKey, themeVars } from '../heroThemes.js'
import { sfx } from '../../sound/sound.js'
import HeroCard from '../HeroCard.vue'
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
  heroId: { type: String, required: true }
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
const SAVE_TEXT = { saving: 'сохраняю…', saved: '✓', offline: '⚠ нет связи' }
const SAVE_HINT = { saving: 'Изменения уходят в лист', saved: 'Всё сохранено в листе', offline: 'Сервер недоступен — правки не потеряются, отправлю, когда связь вернётся' }
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
const HC_W = 310, HC_H = 548 // карточка героя в натуральную величину

/* ---------- чья карточка ---------- */
// показываем того, кто сейчас на карточке: при смене героя старая уходит со своим видом
const shownHero = ref(props.heroId)
const shownSheet = ref(props.sheetId)
const hero = computed(() => (store.data.heroes || []).find(h => h.id === shownHero.value) || null)
const theme = computed(() => heroThemeKey(hero.value))
const ready = computed(() => sheet.id === shownSheet.value && !!sheet.data && !['loading', 'idle', 'error'].includes(sheet.status))
const readOnly = computed(() => !!sheet.meta?.deletedAt || sheet.meta?.canEdit === false)
const opening = ref(!reduce)
provide('sheetReadOnly', readOnly)
provide('bookOpening', opening)
provide('openDelay', 0.2)
const layerVars = computed(() => ({ '--acc': (ready.value && sheet.data.Accent) || '#C9A24F', '--gc': groupColor(hero.value?.group || ''), ...themeVars(theme.value) }))
const title = computed(() => (ready.value && sheet.data.CharacterName) || hero.value?.name || 'Лист персонажа')
const initial = computed(() => (title.value.trim()[0] || '?').toUpperCase())
const subtitle = computed(() => {
  const d = ready.value ? sheet.data : {}
  const lv = (ready.value && sheet.data.Level) || hero.value?.level
  return [d.Race, d.Class, lv ? `${lv} ур.` : ''].filter(Boolean).join(' · ')
})
const cover = computed(() => {
  const c = heroCover(hero.value)
  if (!c) return null
  const p = { x: 50, y: 20, ...c.pos }
  return { src: heroPortraitUrl(c.thumb || c.file), style: { objectPosition: `${p.x}% ${p.y}%` } }
})

let myGen = -1
function load(id) {
  const p = openSheet(id)
  myGen = sheetGen()
  return p
}
async function release() {
  if (myGen >= 0) await closeSheet(myGen)
  myGen = -1
}

/* ---------- окно: где лежит и какого размера (запоминается) ---------- */
const BOX_KEY = 'mini-sheet-box'
const box = reactive(defaultBox())
function defaultBox() {
  const w = Math.min(460, innerWidth - 40), h = Math.min(740, innerHeight - 110)
  let saved = null
  try { saved = JSON.parse(localStorage.getItem(BOX_KEY) || 'null') } catch { /* нет хранилища */ }
  return clampBox(saved && saved.w ? saved : { x: innerWidth - w - 28, y: 84, w, h })
}
function clampBox(b) {
  const w = Math.max(340, Math.min(b.w, innerWidth - 16)), h = Math.max(420, Math.min(b.h, innerHeight - 16))
  return { w, h, x: Math.max(8, Math.min(b.x, innerWidth - w - 8)), y: Math.max(8, Math.min(b.y, innerHeight - h - 8)) }
}
const saveBox = () => { try { localStorage.setItem(BOX_KEY, JSON.stringify(box)) } catch { /* не страшно */ } }
const boxStyle = computed(() => ({ left: box.x + 'px', top: box.y + 'px', width: box.w + 'px', height: box.h + 'px' }))
// карточка героя на лице вписана в окно
const hcScale = computed(() => Math.min(box.w / HC_W, box.h / HC_H) * 0.96)
const moving = ref(false)
let drag = null
function dragStart(e) {
  if (e.button !== 0 || !flat.value || e.target.closest('button, a, input, textarea, select')) return
  e.preventDefault()
  drag = { kind: 'move', px: e.clientX, py: e.clientY, x: box.x, y: box.y }
  begin(e)
}
function resizeStart(e) {
  if (e.button !== 0 || !flat.value) return
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
  if (drag) saveBox()
  drag = null
  moving.value = false
  removeEventListener('pointermove', onDrag)
  removeEventListener('pointerup', endDrag)
  removeEventListener('pointercancel', endDrag)
}
const onResize = () => {
  if (innerWidth < 640) { closeNow(); return } // на телефоне мини-листа нет
  Object.assign(box, clampBox(box))
}

/* ---------- страницы ---------- */
const cur = ref('main')
try { const k = localStorage.getItem('mini-sheet-page'); if (SECTIONS.some(s => s.key === k)) cur.value = k } catch { /* нет */ }
const page = computed(() => SECTIONS.find(s => s.key === cur.value) || SECTIONS[0])
const idxOf = k => SECTIONS.findIndex(s => s.key === k)
const winRef = ref(null), cardRef = ref(null), scrollRef = ref(null), heroWrapRef = ref(null), deckRef = ref(null)
const sparkRef = ref(null), fxRef = ref(null)
// текст страницы проявляется (только прозрачность, без размытия — размытие многих элементов тормозит;
// и только первые блоки — остальные всё равно ниже края)
function inkIn(root, delay = 0) {
  const els = [...(root?.querySelectorAll('.sb-anim') || [])].slice(0, 24)
  if (!els.length || reduce) return
  gsap.fromTo(els, { opacity: 0 }, { opacity: 1, delay, stagger: 0.025, duration: 0.3, ease: 'power1.out', clearProps: 'opacity' })
}
// следующий кадр отрисован
const frame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))

/* ---------- очередь анимаций: следующая начинается, только когда кончилась предыдущая ---------- */
let chain = Promise.resolve()
let closing = false
const enqueue = fn => (chain = chain.then(() => (closing && fn !== closeStep ? null : fn())).catch(e => console.warn('[мини-лист]', e)))
// таймлайн как обещание; что бы ни случилось, через maxMs оно выполнится (анимация доигрывается мгновенно)
let tl = null
function play(t, maxMs) {
  tl = t
  return new Promise(res => {
    let done = false
    const end = () => { if (!done) { done = true; clearTimeout(timer); res() } }
    const timer = setTimeout(() => { t.progress(1); end() }, maxMs)
    t.eventCallback('onComplete', end)
  })
}
const wait = ms => new Promise(r => setTimeout(r, ms))
let hurry = false // попросили закрыть посреди призыва — дальше без пауз

/* ---------- положение карточки ---------- */
// flat — лежит оборотом вверх без 3D (чёткий текст, поля и всплывающие окна ведут себя обычно)
const flat = ref(false)
const showFront = ref(false) // лицо (карточка героя) нужно только при призыве — потом его нет совсем, окно легче
function goFlat() {
  gsap.set(cardRef.value, { clearProps: 'transform' })
  flat.value = true
}

/* ---------- искры ---------- */
function spark(x, y, { spread = 30, rise = 60, life = 0.9, big = false } = {}) {
  const host = sparkRef.value
  if (!host || host.childElementCount > 160) return
  const p = document.createElement('i')
  if (big) p.className = 'big'
  host.append(p)
  gsap.timeline({ onComplete: () => p.remove() })
    .fromTo(p, { x, y, scale: 0.3, opacity: 0 }, { scale: 0.5 + Math.random() * 0.9, opacity: 1, duration: 0.15, ease: 'power1.out' })
    .to(p, { x: x + (Math.random() - 0.5) * spread * 2, y: y - Math.random() * rise + rise * 0.2, duration: life, ease: 'sine.out' }, 0)
    .to(p, { opacity: 0, scale: 0.1, duration: life * 0.6, ease: 'power1.in' }, life * 0.4)
}
function burstAt(r, n = 30) {
  if (!r) return
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2
    spark(r.left + r.width / 2 + Math.cos(a) * r.width * (0.3 + Math.random() * 0.3), r.top + r.height / 2 + Math.sin(a) * r.height * (0.3 + Math.random() * 0.25), { spread: 40, rise: 80, life: 0.9 + Math.random() * 0.7, big: i % 5 === 0 })
  }
}
const burst = n => burstAt(winRef.value?.getBoundingClientRect(), n)

/* ---------- колода: веер героев, рулетка, выбор ---------- */
const deck = ref([])
const hl = ref('')
const rolling = ref(false)
const DS = 0.4 // карточка в колоде — 40 % натуральной величины
// живые эффекты темы карточки (те же, что при наведении на странице героев)
const liven = (el, on) => el?.querySelector('.slot')?.dispatchEvent(new MouseEvent(on ? 'mouseenter' : 'mouseleave'))
function deckHeroes() {
  const all = (store.data.heroes || []).filter(h => h.kind === 'character' && h.id !== props.heroId)
  const me = hero.value ? [hero.value] : []
  // выбранный — где-то в середине колоды, чтобы рулетке было куда бежать
  const others = all.sort(() => Math.random() - 0.5).slice(0, 11)
  others.splice(Math.floor(others.length / 2 + (Math.random() - 0.5) * 3), 0, ...me)
  return others
}
async function deckStep() {
  deck.value = deckHeroes()
  await nextTick()
  const host = deckRef.value
  const els = host ? [...host.querySelectorAll('.md-card')] : []
  const n = els.length, mine = deck.value.findIndex(h => h.id === shownHero.value)
  if (!n || mine < 0) return null
  // веер: дуга вокруг точки снизу; центр — у окна, но так, чтобы весь веер влез в экран
  const step = Math.max(4.5, Math.min(10, 70 / n)), R = 640, cw = HC_W * DS, ch = HC_H * DS
  const maxA = ((n - 1) / 2) * step * Math.PI / 180
  const half = R * Math.sin(maxA) + cw * 0.6
  const cx = Math.max(half + 10, Math.min(innerWidth - half - 10, box.x + box.w / 2))
  const cy = Math.max(ch / 2 + 30, Math.min(innerHeight - ch / 2 - 60, box.y + box.h / 2 - 20))
  const spot = els.map((_, i) => {
    const a = (i - (n - 1) / 2) * step
    const r = a * Math.PI / 180
    return { x: cx + Math.sin(r) * R - HC_W / 2, y: cy + (1 - Math.cos(r)) * R - HC_H / 2, rotation: a }
  })
  gsap.set(els, { x: cx - HC_W / 2, y: cy - HC_H / 2 + 60, scale: DS * 0.9, rotation: () => rnd(-6, 6), opacity: 0, transformOrigin: '50% 50%' })
  sfx('bookPlace', 0.5)
  // колода появляется стопкой, тасуется (половинки разлетаются и сходятся) и раскрывается веером
  await play(gsap.timeline()
    .to(els, { y: cy - HC_H / 2, scale: DS, opacity: 1, duration: 0.35, stagger: 0.02, ease: 'back.out(2)' })
    .call(() => sfx('pageFlip', 0.3))
    .to(els, { x: (i) => cx - HC_W / 2 + (i % 2 ? 1 : -1) * cw * 0.55, rotation: (i) => (i % 2 ? 8 : -8), duration: 0.18, ease: 'power2.out' })
    .to(els, { x: cx - HC_W / 2, rotation: () => rnd(-3, 3), duration: 0.18, ease: 'power2.in', stagger: 0.01 })
    .call(() => { sfx('pageFlip', 0.35); setTimeout(() => sfx('pageFlip', 0.25), 120) })
    .to(els, { x: i => spot[i].x, y: i => spot[i].y, rotation: i => spot[i].rotation, duration: 0.6, ease: 'back.out(1.3)', stagger: 0.025 }), 3000)
  // рулетка: подсветка бежит по вееру и замедляется на выбранном
  rolling.value = true
  const steps = n + mine + (mine < 3 ? n : 0)
  let i = 0
  const lift = (k, up) => gsap.to(els[k], { y: spot[k].y - (up ? 26 : 0), scale: up ? DS * 1.1 : DS, duration: 0.14, ease: 'power2.out', overwrite: 'auto' })
  for (let s = 0; s <= steps && !hurry; s++) {
    const k = s % n
    if (s) lift(i, false)
    i = k
    hl.value = deck.value[k].id
    lift(k, true)
    sfx('pageFlip', 0.1)
    const t = s / steps
    await wait(40 + 230 * t * t * t)
  }
  rolling.value = false
  hl.value = shownHero.value
  const pick = els[mine]
  // выбранная оживает (эффекты темы) и поднимается; остальные падают вниз
  liven(pick, true)
  sfx('bookPlace', 0.7)
  burstAt(pick.getBoundingClientRect(), 24)
  await play(gsap.timeline()
    .to(pick, { y: spot[mine].y - 60, scale: DS * 1.2, rotation: 0, duration: 0.45, ease: 'back.out(2)', overwrite: 'auto' }, 0)
    .to(els.filter((_, k) => k !== mine), { y: `+=${innerHeight * 0.6}`, rotation: () => rnd(-35, 35), opacity: 0, duration: 0.55, ease: 'power2.in', stagger: { each: 0.03, from: mine } }, 0.1)
    .call(() => sfx('cloudWhoosh', 0.12), null, 0.1), 2000)
  if (!hurry) await wait(250)
  return { el: pick, x: spot[mine].x + HC_W / 2, y: spot[mine].y - 60 + HC_H / 2, scale: DS * 1.2 }
}

/* ---------- шаги ---------- */
const alive = ref(false)
const veil = ref(true) // окно уже на месте, но карточка ещё не прилетела — не показываем
const rnd = (a, b) => a + Math.random() * (b - a)
async function summonStep() {
  shownHero.value = props.heroId
  shownSheet.value = props.sheetId
  hurry = false
  alive.value = true
  veil.value = true
  flat.value = false
  showFront.value = true
  opening.value = !reduce
  const loading = load(props.sheetId)
  await nextTick()
  if (reduce || !winRef.value || !cardRef.value) { veil.value = false; await loading; if (cardRef.value) goFlat(); showFront.value = false; opening.value = false; return }
  const picked = await deckStep()
  const win = winRef.value, card = cardRef.value
  if (!win || !card) { deck.value = []; return }
  // выбранная из веера становится окном: окно ставим туда же и того же размера, что карточка в веере, и ведём на место
  gsap.set(card, { rotateY: 0 })
  const wcx = box.x + box.w / 2, wcy = box.y + box.h / 2
  if (picked) gsap.set(win, { x: picked.x - wcx, y: picked.y - wcy, scale: picked.scale / hcScale.value, rotation: 0, transformOrigin: '50% 50%' })
  else gsap.set(win, { y: 60, scale: 0.6, opacity: 0 })
  veil.value = false
  await nextTick()
  if (picked) picked.el.style.visibility = 'hidden'
  deck.value = []
  liven(heroWrapRef.value, true)
  sfx('cloudWhoosh', 0.14)
  await play(gsap.timeline()
    .to(win, { x: 0, y: -16, scale: 1.03, opacity: 1, duration: 0.7, ease: 'power3.inOut' })
    .to(win, { y: 0, scale: 1, duration: 0.3, ease: 'back.out(3)' }), 2000)
  sfx('bookPlace', 0.6)
  burst(30)
  if (!hurry) await wait(450)
  // лист ещё не пришёл — подождём (не дольше 4 с), чтобы перевернуться уже с данными
  await Promise.race([loading, wait(hurry ? 0 : 4000)])
  await nextTick()
  if (!cardRef.value || closing) return
  sfx('pageFlip', 0.4)
  await play(gsap.timeline()
    .to(cardRef.value, { rotateY: 180, duration: 0.7, ease: 'back.out(1.3)' }, 0)
    .call(() => burst(18), null, 0.3), 2000)
  goFlat()
  showFront.value = false
  inkIn(scrollRef.value)
  setTimeout(() => { opening.value = false }, 500)
}
// уйти: мультяшно — присесть, подпрыгнуть и исчезнуть с хлопком искр
async function leaveStep() {
  const win = winRef.value, card = cardRef.value
  deck.value = []
  if (reduce || !win || !card) { alive.value = false; await release(); return }
  const r = win.getBoundingClientRect()
  sfx('cloudWhoosh', 0.12)
  await play(gsap.timeline()
    .to(card, { scaleX: 1.06, scaleY: 0.9, transformOrigin: '50% 100%', duration: 0.12, ease: 'power2.out' })
    .to(card, { scaleX: 0.92, scaleY: 1.08, duration: 0.12, ease: 'power2.in' })
    .to(win, { y: -50, scale: 0, rotation: sign() * 12, opacity: 0, duration: 0.38, ease: 'back.in(1.8)' }, '>-0.05')
    .call(() => burstAt({ left: r.left, top: r.top - 50, width: r.width, height: r.height }, 26), null, '>-0.12'), 1500)
  alive.value = false
  await release()
}
const sign = () => (Math.random() < 0.5 ? -1 : 1)
// другая вкладка: мультяшный «шлёп»-переворот плашмя (без 3D, лица не видно): карточка подпрыгивает,
// сплющивается и разворачивается обратно; чем дальше вкладка, тем больше шлепков и быстрее
async function spinStep(key) {
  const from = idxOf(cur.value), to = idxOf(key)
  if (from === to || to < 0) return
  if (reduce || !cardRef.value || !ready.value || !flat.value) { cur.value = key; return }
  const card = cardRef.value
  const d = Math.abs(to - from), flips = Math.min(1 + Math.floor(d / 3), 4)
  const per = Math.max(0.13, 0.26 - 0.04 * (flips - 1)), half = per / 2, tilt = (to > from ? -1 : 1) * 3
  card.classList.add('anim')
  // 1) подпрыгнула и сплющилась в полоску
  sfx('pageFlip', 0.18)
  await play(gsap.timeline()
    .set(card, { transformOrigin: '50% 50%' })
    .to(card, { y: -10, rotation: tilt, duration: half, ease: 'power2.out' }, 0)
    .to(card, { scaleX: 0.04, scaleY: 1.03, duration: half, ease: 'power2.in' }, 0), 1500)
  // 2) пока она ребром, меняем страницу: тяжёлая отрисовка новой страницы не видна и не дёргает анимацию
  cur.value = key
  await nextTick()
  await frame()
  // 3) разворачивается, докручивает остальные шлепки и приземляется
  const t = gsap.timeline().to(card, { scaleX: 1, scaleY: 1, duration: half, ease: 'power2.out' }, 0)
  for (let k = 1; k < flips; k++) {
    const at = half + (k - 1) * per
    t.to(card, { scaleX: 0.04, scaleY: 1.03, duration: half, ease: 'power2.in' }, at)
      .call(() => sfx('pageFlip', 0.18), null, at + half)
      .to(card, { scaleX: 1, scaleY: 1, duration: half, ease: 'power2.out' }, at + half)
  }
  // приземление: чуть сплющилась и отпружинила
  const land = half + (flips - 1) * per
  t.to(card, { y: 0, rotation: 0, scaleY: 0.96, scaleX: 1.03, duration: 0.12, ease: 'power2.in' }, land)
    .to(card, { scaleY: 1, scaleX: 1, duration: 0.45, ease: 'elastic.out(1.1, 0.45)' })
  inkIn(scrollRef.value, half * 0.5)
  await play(t, 3000)
  card.classList.remove('anim')
  goFlat()
}
function closeStep() {
  return leaveStep().then(() => emit('close'))
}

/* ---------- что можно попросить у карточки ---------- */
// вкладки: пока карточка шлёпается, копим последнюю выбранную
let wantTab = null, tabQueued = false
function turnTo(key) {
  if (closing || !SECTIONS.some(s => s.key === key)) return
  try { localStorage.setItem('mini-sheet-page', key) } catch { /* нет */ }
  wantTab = key
  if (tabQueued) return
  tabQueued = true
  enqueue(async () => { tabQueued = false; const k = wantTab; wantTab = null; if (k && k !== cur.value) await spinStep(k) })
}
// другой герой: старая карточка исчезает, новая выбирается из колоды (несколько переключений — только последний)
let swapQueued = false
watch(() => props.sheetId, () => {
  if (swapQueued || closing) return
  swapQueued = true
  hurry = true // текущий призыв доигрываем без пауз
  enqueue(async () => {
    swapQueued = false
    if (props.sheetId === shownSheet.value) { hurry = false; return }
    await leaveStep()
    if (!closing) await summonStep()
  })
})
function dismiss() {
  if (closing) return
  closing = true
  hurry = true
  tl?.progress(1)
  enqueue(closeStep)
}
// без анимации (узкий экран)
async function closeNow() {
  if (closing) return
  closing = true
  hurry = true
  tl?.progress(1)
  deck.value = []
  alive.value = false
  await release()
  emit('close')
}

// сменили вход (мастер ↔ игра персонажем) — права на лист другие, перечитываем
watch(() => `${store.me?.id}|${store.role}`, (n, o) => { if (o && n !== o && alive.value && !closing) load(shownSheet.value) })

/* ---------- живые эффекты, как в большой книге: урон, лечение, уровень, бросок ---------- */
const hpEl = () => cardRef.value?.querySelector('.back .pr-hp, .back .pm-hp')
let fxBase = null, fxTimer = 0
watch(() => [sheet.id, sheet.data?.HpData?.Current, sheet.data?.Level], (n, o) => {
  if (!o || n[0] !== o[0] || !ready.value || opening.value || !flat.value) { fxBase = null; clearTimeout(fxTimer); return }
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
  if (!p?.mine || !lastRoll.el || !cardRef.value?.contains(lastRoll.el) || p.label !== lastRoll.label || Date.now() - lastRoll.at > 20000) return
  const nat = natural(p)
  fxRef.value?.roll(p.total, nat === 20 ? 'crit' : nat === 1 ? 'fail' : '', lastRoll.el)
  lastRoll.el = null
})
// хиты на нуле — карточка тускнеет
watch(() => ready.value && hpMax(sheet.data) > 0 && sheet.data.HpData.Current <= 0, down => winRef.value?.classList.toggle('downed', !!down))

defineExpose({ dismiss })
onMounted(() => {
  addEventListener('resize', onResize)
  enqueue(summonStep)
})
onBeforeUnmount(() => {
  closing = true
  hurry = true
  removeEventListener('resize', onResize)
  endDrag()
  tl?.kill()
  clearTimeout(fxTimer)
  release()
})
</script>

<style scoped>
.ms-layer { position: fixed; inset: 0; z-index: 300; pointer-events: none; }
/* карточки героев — натуральной величины, масштаб задаётся снаружи */
.hc { width: 310px; pointer-events: none; }
.hc :deep(.slot) { animation: none; }

/* колода */
.md-deck { position: fixed; inset: 0; }
.md-card { position: absolute; left: 0; top: 0; will-change: transform; transition: filter .15s; }
.md-deck.rolling .md-card:not(.hl) { filter: brightness(.6) saturate(.8); }
.md-card.hl { filter: brightness(1.15) drop-shadow(0 0 22px color-mix(in srgb, var(--ta, #e2c278) 80%, transparent)); z-index: 2; }

.ms { position: fixed; pointer-events: auto; color: var(--ink); font-family: 'Manrope', sans-serif; perspective: 1700px; will-change: transform; }
.ms.moving { user-select: none; }
.ms.veil { visibility: hidden; }
.mc { position: absolute; inset: 0; transform-style: preserve-3d; }
.face { position: absolute; inset: 0; backface-visibility: hidden; -webkit-backface-visibility: hidden; }
.front .hc { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%) scale(var(--k)); }
.back { transform: rotateY(180deg); border-radius: 18px; padding: 12px; box-sizing: border-box; overflow: hidden; display: flex; flex-direction: column;
  background: linear-gradient(180deg, #221b13, #15110c); border: 1px solid #5d4521;
  box-shadow: 0 0 0 3px #241c13, 0 0 0 4px color-mix(in srgb, var(--gc) 45%, rgba(201, 162, 79, .5)), 0 24px 60px rgba(0, 0, 0, .7); }
/* в теме героя — как его карточка на странице героев */
.back.themed { background: var(--tpat), linear-gradient(180deg, var(--tbg1), var(--tbg2)); border-color: var(--tf);
  box-shadow: 0 0 0 3px var(--tbg2), 0 0 0 4px color-mix(in srgb, var(--ta) 45%, transparent), 0 0 22px color-mix(in srgb, var(--ta) 16%, transparent), 0 24px 60px rgba(0, 0, 0, .7); }
.mark { position: absolute; right: -28px; bottom: -30px; width: 170px; height: 170px; color: var(--ta); opacity: .07; pointer-events: none; }
/* лежит оборотом вверх — без 3D */
.mc.flat { transform-style: flat; }
.mc.flat .front { visibility: hidden; }
.mc.flat .back { transform: none; backface-visibility: visible; }
.mc.anim { will-change: transform; }
.ms.downed .back { filter: grayscale(.6) brightness(.8); }
.rivet { position: absolute; z-index: 6; width: 8px; height: 8px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #ffe9b0, #8a6630 60%, #3b2a12); pointer-events: none; }
.themed .rivet { background: radial-gradient(circle at 35% 35%, var(--tl), var(--ta) 60%, var(--tbg2)); box-shadow: 0 0 6px color-mix(in srgb, var(--ta) 55%, transparent); }
.rivet.a { top: 7px; left: 7px; } .rivet.b { top: 7px; right: 7px; } .rivet.c { bottom: 7px; left: 7px; }
.stripe { position: absolute; z-index: 6; top: 0; left: 20%; right: 20%; height: 3px; border-radius: 0 0 4px 4px; background: var(--gc); box-shadow: 0 0 12px var(--gc); pointer-events: none; }

.ms-head { position: relative; z-index: 3; display: flex; align-items: center; gap: 9px; padding: 2px 4px 8px 4px; cursor: grab; touch-action: none; flex: none; }
.ms.moving .ms-head { cursor: grabbing; }
.ms-av { flex: none; width: 34px; height: 34px; border-radius: 50%; overflow: hidden; display: grid; place-items: center; border: 2px solid #e2c278; background: #120d08; color: #e2c278; font: 700 18px 'Cormorant Garamond', serif; }
.themed .ms-av { border-color: var(--ta); color: var(--ta); box-shadow: 0 0 12px color-mix(in srgb, var(--ta) 40%, transparent); }
.ms-av img { width: 100%; height: 100%; object-fit: cover; }
.ms-title { flex: 1; display: grid; min-width: 0; }
.ms-title b { font: 700 19px 'Cormorant Garamond', serif; color: #f3dc9e; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.1; }
.themed .ms-title b { color: var(--tl); }
.ms-title small { color: #c9b48a; font: 700 11px 'Manrope', sans-serif; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.themed .ms-title small { color: color-mix(in srgb, var(--tl) 60%, #8a8172); }
.ms-save { font: 700 11px 'Manrope', sans-serif; color: #c9b48a; white-space: nowrap; }
.ms-save.saved { color: #7ccf8b; }
.ms-save.offline { color: #ff9b8f; }
.ms-ro { font-size: 13px; opacity: .85; }
.ms-btn { flex: none; display: grid; place-items: center; width: 28px; height: 28px; border-radius: 8px; border: 1px solid #6b5127; background: rgba(0, 0, 0, .3); color: #f3dc9e; font: 700 14px 'Manrope', sans-serif; cursor: pointer; text-decoration: none; transition: background .15s, transform .15s; }
.themed .ms-btn { border-color: color-mix(in srgb, var(--ta) 55%, transparent); color: var(--tl); }
.ms-btn:hover { background: rgba(231, 197, 111, .15); }
.ms-btn:active { transform: scale(.92); }
.ms-btn.x:hover { border-color: rgba(255, 122, 107, .5); color: #ff9b8f; background: rgba(255, 122, 107, .1); }
.ms-marks { position: relative; z-index: 1; display: flex; gap: 3px; padding: 0 10px; margin-bottom: -6px; flex: none; }
.ms-mark { flex: 1 1 0; min-width: 0; max-width: 40px; height: 32px; display: grid; place-items: start center; padding-top: 6px; box-sizing: border-box; border: 0; border-radius: 6px 6px 0 0; cursor: pointer;
  background: linear-gradient(180deg, color-mix(in srgb, var(--silk) 80%, #fff 8%), var(--silk)); box-shadow: inset 0 0 0 1px rgba(0, 0, 0, .3); transform: translateY(6px); transition: transform .18s, filter .18s; filter: brightness(.8) saturate(.85); }
.ms-mark .ic { width: 15px; height: 15px; color: #fff4dc; }
.ms-mark:hover { transform: translateY(2px); filter: none; }
.ms-mark.on { transform: translateY(-2px); filter: none; box-shadow: inset 0 0 0 1px rgba(0, 0, 0, .35), 0 -3px 12px color-mix(in srgb, var(--silk) 70%, transparent), 0 0 0 1px var(--ta, #e2c278); }
.ms-page { position: relative; z-index: 2; flex: 1; min-height: 0; overflow: hidden; border-radius: 10px; border: 1px solid #6b5127;
  background: radial-gradient(ellipse at 50% 40%, color-mix(in srgb, var(--acc) 7%, transparent), transparent 70%), linear-gradient(180deg, var(--paper2), var(--paper)); box-shadow: inset 0 0 30px rgba(0, 0, 0, .45); }
.themed .ms-page { border-color: color-mix(in srgb, var(--ta) 40%, #000); }
.ms-run { position: absolute; top: 10px; left: 0; right: 0; z-index: 3; text-align: center; font: 700 9.5px 'Manrope', sans-serif; letter-spacing: .26em; text-transform: uppercase; color: color-mix(in srgb, var(--acc) 45%, var(--muted)); opacity: .75; pointer-events: none; }
.ms-run::before, .ms-run::after { content: '❦'; margin: 0 8px; letter-spacing: 0; opacity: .7; }
.ms-scroll { position: absolute; inset: 28px 0 4px; overflow-y: auto; overflow-x: hidden; padding: 8px 16px 22px 18px; }
.ms-scroll :deep(.sb-h) { font-size: 21px; }
.ms-wait { position: absolute; inset: 0; display: grid; place-content: center; justify-items: center; gap: 10px; color: var(--muted); font: 700 13px 'Manrope', sans-serif; }
.ms-wait.err { color: #ff9b8f; padding: 20px; text-align: center; }
.ms-spin { width: 22px; height: 22px; border-radius: 50%; border: 2px solid rgba(231, 197, 111, .3); border-top-color: #e2c278; animation: ms-spin .8s linear infinite; }
@keyframes ms-spin { to { transform: rotate(360deg); } }
/* уголок для размера — на месте четвёртой заклёпки */
.ms-grip { position: absolute; right: 4px; bottom: 4px; z-index: 7; width: 16px; height: 16px; cursor: nwse-resize; touch-action: none;
  background: linear-gradient(135deg, transparent 50%, var(--ta, #e2c278) 50% 58%, transparent 58% 68%, var(--ta, #e2c278) 68% 76%, transparent 76%); opacity: .6; }
.ms-grip:hover { opacity: 1; }

.ms-sparks { position: fixed; inset: 0; pointer-events: none; z-index: 3; }
.ms-sparks :deep(i) { position: absolute; left: 0; top: 0; width: 5px; height: 5px; margin: -2.5px; border-radius: 50%; background: radial-gradient(circle, #fffaf0, color-mix(in srgb, var(--ta, #ffd27a) 60%, #ffd27a) 50%, transparent 72%); box-shadow: 0 0 7px 1px color-mix(in srgb, var(--ta, #ffcf6a) 70%, #ffcf6a); }
.ms-sparks :deep(i.big) { width: 8px; height: 8px; margin: -4px; box-shadow: 0 0 14px 3px color-mix(in srgb, var(--ta, #ffcf6a) 70%, #ffcf6a); }
</style>
