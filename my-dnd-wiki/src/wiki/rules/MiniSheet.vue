<template>
  <!-- мини-лист в журнале деятельностей: карточка героя в плавающем окне. Вылетает из-за случайного края экрана,
       по пути крутит пару случайных трюков, показывает, чья она (лицо — как карточка героя), и переворачивается:
       на обороте — настоящие страницы листа, правки сразу в лист. Другая вкладка — карточка крутится,
       чем дальше вкладка, тем больше оборотов и быстрее. Все анимации идут по очереди и не мешают друг другу -->
  <Teleport to="body">
    <div class="ms-layer" :style="{ '--acc': acc, '--gc': gc }">
      <div v-if="alive" ref="winRef" class="ms sb-root" :class="{ moving, veil }" :style="boxStyle">
        <div ref="cardRef" class="mc" :class="{ flat }">
          <!-- ===== лицо: чья карточка ===== -->
          <div class="face front" aria-hidden="true">
            <i class="rivet a" /><i class="rivet b" /><i class="rivet c" /><i class="rivet d" /><i class="stripe" />
            <div class="port">
              <img v-if="cover" class="pimg" :src="cover.src" :style="cover.style" alt="" />
              <div v-else class="ph">{{ initial }}</div>
              <div class="lvl"><div><small>УР.</small>{{ level || '—' }}</div></div>
              <div class="bm"><small>БМ</small>{{ hero?.bm || '—' }}</div>
              <div class="name">
                {{ title }}
                <span class="sub">{{ subtitle }}</span>
              </div>
            </div>
            <div v-if="hp" class="gline hp" :title="`Хиты ${hp.cur} из ${hp.max}`">
              <span class="k">Хиты</span><div class="gauge"><i :style="{ width: hp.pct + '%' }" /></div><b>{{ hp.cur }} / {{ hp.max }}</b>
            </div>
            <div v-if="hero?.staminaMax" class="gline st" :title="`Выносливость ${hero.stamina} из ${hero.staminaMax}`">
              <span class="k">Выносл.</span><div class="gauge"><i :style="{ width: staminaPct + '%' }" /></div><b>{{ hero.stamina }} / {{ hero.staminaMax }}</b>
            </div>
            <div class="rows">
              <div class="row"><span class="k">Игрок</span><span class="v"><img v-if="owner?.avatar" :src="avatarUrl(owner.avatar)" alt="" />{{ ownerName || '—' }}</span></div>
              <div class="row"><span class="k">Локация</span><span class="v">{{ hero?.location || '—' }}</span></div>
              <div class="row"><span class="k">Группа</span><span class="v">{{ hero?.group || '—' }}</span></div>
            </div>
            <div class="seal">✦ лист персонажа ✦</div>
            <i ref="shineRef" class="shine" />
          </div>

          <!-- ===== оборот: страницы листа ===== -->
          <div class="face back">
            <i class="rivet a" /><i class="rivet b" /><i class="rivet c" /><i class="rivet d" /><i class="stripe" />
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
            <section ref="pageRef" class="ms-page">
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
      <!-- искры: след летящей карточки и вспышки -->
      <div ref="sparkRef" class="ms-sparks" aria-hidden="true" />
    </div>
    <ColorMenu />
  </Teleport>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, provide, reactive, ref, watch } from 'vue'
import gsap from 'gsap'
import { store, dice, heroCover, heroPortraitUrl, avatarUrl } from '../../map/store.js'
import { sheet, openSheet, closeSheet, sheetGen, lastRoll } from '../../sheets/sheetState.js'
import { natural } from '../../shared/dice.js'
import { hpMax } from '../../shared/sheet.js'
import { groupColor } from '../../shared/catalog.js'
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

/* ---------- чья карточка: герой (карточка героя) и его лист ---------- */
// показываем того, кто сейчас на карточке: при смене героя старая улетает со своим лицом
const shownHero = ref(props.heroId)
const shownSheet = ref(props.sheetId)
const hero = computed(() => (store.data.heroes || []).find(h => h.id === shownHero.value) || null)
const ready = computed(() => sheet.id === shownSheet.value && !!sheet.data && !['loading', 'idle', 'error'].includes(sheet.status))
const readOnly = computed(() => !!sheet.meta?.deletedAt || sheet.meta?.canEdit === false)
const opening = ref(!reduce)
provide('sheetReadOnly', readOnly)
provide('bookOpening', opening)
provide('openDelay', 0.2)
const acc = computed(() => (ready.value && sheet.data.Accent) || '#C9A24F')
const gc = computed(() => groupColor(hero.value?.group || ''))
const title = computed(() => (ready.value && sheet.data.CharacterName) || hero.value?.name || 'Лист персонажа')
const initial = computed(() => (title.value.trim()[0] || '?').toUpperCase())
const level = computed(() => (ready.value && sheet.data.Level) || hero.value?.level || 0)
const subtitle = computed(() => {
  const d = ready.value ? sheet.data : {}
  return [d.Race, d.Class, `${level.value || '?'} ур.`].filter(Boolean).join(' · ')
})
const cover = computed(() => {
  const c = heroCover(hero.value)
  if (!c) return null
  const p = { x: 50, y: 20, ...c.pos }
  return { src: heroPortraitUrl(c.thumb || c.file), style: { objectPosition: `${p.x}% ${p.y}%` } }
})
const owner = computed(() => hero.value?.ownerId && store.data.roster?.find(p => p.id === hero.value.ownerId))
const ownerName = computed(() => (ready.value && sheet.meta?.ownerName) || owner.value?.character || '')
const hp = computed(() => {
  if (!ready.value) return null
  const max = hpMax(sheet.data), cur = sheet.data.HpData?.Current ?? 0
  return max > 0 ? { cur, max, pct: Math.max(0, Math.min(100, (cur / max) * 100)) } : null
})
const staminaPct = computed(() => (hero.value?.staminaMax ? Math.max(0, Math.min(100, (hero.value.stamina / hero.value.staminaMax) * 100)) : 0))

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
const winRef = ref(null), cardRef = ref(null), pageRef = ref(null), scrollRef = ref(null), shineRef = ref(null)
const sparkRef = ref(null), fxRef = ref(null)
// текст страницы проявляется чернилами
function inkIn(root, delay = 0) {
  const els = root?.querySelectorAll('.sb-anim') || []
  if (!els.length || reduce) return
  gsap.fromTo(els, { opacity: 0, filter: 'blur(4px)' }, { opacity: 1, filter: 'blur(0px)', delay, stagger: 0.02, duration: 0.38, ease: 'power1.out', clearProps: 'opacity,filter' })
}

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

/* ---------- 3D-положение карточки ---------- */
// flat — карточка лежит оборотом вверх без 3D (чётче текст, поля ввода и всплывающие окна ведут себя обычно).
// Перед любым вращением снимаем flat и ставим тот же вид через rotateY(180°)
const flat = ref(false)
function unflat() {
  flat.value = false
  gsap.set(cardRef.value, { rotateY: 180, rotateX: 0, rotation: 0, scale: 1 })
}
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
let trailOn = false
function trail() {
  if (!trailOn || !winRef.value) return
  const r = winRef.value.getBoundingClientRect()
  spark(r.left + r.width * (0.2 + Math.random() * 0.6), r.top + r.height * (0.2 + Math.random() * 0.6), { spread: 22, rise: -20, life: 0.6 + Math.random() * 0.5, big: Math.random() < 0.15 })
}
function burst(n = 36) {
  const r = winRef.value?.getBoundingClientRect()
  if (!r) return
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2
    spark(r.left + r.width / 2 + Math.cos(a) * r.width * (0.35 + Math.random() * 0.25), r.top + r.height / 2 + Math.sin(a) * r.height * (0.35 + Math.random() * 0.2), { spread: 40, rise: 80, life: 0.9 + Math.random() * 0.7, big: i % 5 === 0 })
  }
}

/* ---------- полёт: из-за случайного края экрана, с парой случайных трюков ---------- */
const rnd = (a, b) => a + Math.random() * (b - a)
const sign = () => (Math.random() < 0.5 ? -1 : 1)
// точка за краем экрана (смещение от места карточки)
function offscreen() {
  const edge = ['right', 'left', 'top', 'bottom'][Math.floor(Math.random() * 4)]
  const pad = 120
  if (edge === 'right') return { x: innerWidth - box.x + pad, y: rnd(-box.y, innerHeight - box.y - box.h) }
  if (edge === 'left') return { x: -(box.x + box.w + pad), y: rnd(-box.y, innerHeight - box.y - box.h) }
  if (edge === 'top') return { x: rnd(-box.x, innerWidth - box.x - box.w), y: -(box.y + box.h + pad) }
  return { x: rnd(-box.x, innerWidth - box.x - box.w), y: innerHeight - box.y + pad }
}
// трюки карточки в полёте; каждый кончается там же, где начался (кратно обороту)
const TRICKS = [
  s => ({ rotateY: `+=${360 * s}` }), // переворот через бок
  s => ({ rotateX: `+=${360 * s}` }), // сальто
  s => ({ rotation: `+=${360 * s}` }), // юла
  s => ({ rotateY: `+=${360 * s}`, rotation: `+=${360 * -s}` }), // штопор
  s => ({ rotateX: `+=${360 * s}`, rotateY: `+=${360 * s}` }), // кувырок наискосок
  s => ({ rotation: `+=${720 * s}` }) // двойная юла
]
function tricks(n = 2) {
  const pool = TRICKS.slice(), out = []
  while (out.length < n) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0](sign()))
  return out
}
// влёт по дуге к месту, трюки по дороге; приземляется лицом вверх
function flyInTl(from) {
  const win = winRef.value, card = cardRef.value
  const mid = { x: from.x * 0.45 + rnd(-140, 140), y: from.y * 0.45 + rnd(-140, 80) }
  const [t1, t2] = tricks(2)
  const tilt = rnd(-25, 25)
  gsap.set(win, { x: from.x, y: from.y, scale: 0.35, opacity: 1 })
  gsap.set(card, { rotateX: 0, rotateY: 0, rotation: tilt })
  return gsap.timeline({ onUpdate: trail })
    .to(win, { keyframes: [
      { x: mid.x, y: mid.y, scale: 0.68, duration: 0.55, ease: 'power1.out' },
      { x: 0, y: -14, scale: 1.04, duration: 0.55, ease: 'power2.inOut' },
      { y: 0, scale: 1, duration: 0.28, ease: 'back.out(3)' }
    ] }, 0)
    .to(card, { ...t1, duration: 0.52, ease: 'power1.inOut' }, 0.05)
    .to(card, { ...t2, duration: 0.52, ease: 'power1.inOut' }, 0.58)
    // выпрямляется: убираем наклон и лишние обороты (всё кратно 360°, так что вида это не меняет)
    .set(card, { rotateX: 0, rotateY: 0, rotation: tilt }, 1.1)
    .to(card, { rotation: 0, duration: 0.3, ease: 'power2.out' }, 1.1)
}
// вылет по дуге за край, с трюком, уменьшаясь
function flyOutTl(to) {
  const win = winRef.value, card = cardRef.value
  const mid = { x: to.x * 0.4 + rnd(-120, 120), y: to.y * 0.4 + rnd(-120, 60) }
  const [t1] = tricks(1)
  return gsap.timeline({ onUpdate: trail })
    .to(win, { y: -24, scale: 1.05, duration: 0.2, ease: 'power2.out' }, 0)
    .to(win, { keyframes: [
      { x: mid.x, y: mid.y, scale: 0.7, duration: 0.35, ease: 'power2.in' },
      { x: to.x, y: to.y, scale: 0.35, duration: 0.35, ease: 'power1.in' }
    ] }, 0.2)
    .to(card, { ...t1, duration: 0.6, ease: 'power1.in' }, 0.2)
}

/* ---------- шаги ---------- */
const alive = ref(false)
const veil = ref(true) // окно уже на месте, но карточка ещё не вылетела — не показываем
async function summonStep() {
  shownHero.value = props.heroId
  shownSheet.value = props.sheetId
  alive.value = true
  veil.value = true
  flat.value = false
  opening.value = !reduce
  const loading = load(props.sheetId)
  await nextTick()
  const win = winRef.value, card = cardRef.value
  if (reduce || !win || !card) { veil.value = false; await loading; if (cardRef.value) goFlat(); opening.value = false; return }
  const t = flyInTl(offscreen())
  veil.value = false
  trailOn = true
  sfx('cloudWhoosh', 0.16)
  await play(t, 3000)
  trailOn = false
  sfx('bookPlace', 0.6)
  burst(30)
  // показать, чья карточка: по лицу пробегает блик
  if (shineRef.value) gsap.fromTo(shineRef.value, { xPercent: -120 }, { xPercent: 120, duration: 0.8, ease: 'power2.inOut' })
  await wait(850)
  // лист ещё не пришёл — подождём (не дольше 4 с), чтобы перевернуться уже с данными
  await Promise.race([loading, wait(4000)])
  await nextTick()
  if (!cardRef.value || closing) return
  sfx('pageFlip', 0.4)
  await play(gsap.timeline()
    .to(cardRef.value, { rotateY: 180, duration: 0.75, ease: 'back.out(1.5)' }, 0)
    .to(winRef.value, { keyframes: { scale: [1, 1.06, 1] }, duration: 0.75, ease: 'sine.inOut' }, 0)
    .call(() => burst(20), null, 0.3), 2000)
  goFlat()
  inkIn(scrollRef.value)
  setTimeout(() => { opening.value = false }, 500)
}
async function leaveStep() {
  const win = winRef.value, card = cardRef.value
  if (reduce || !win || !card) { alive.value = false; await release(); return }
  // если карточка лежит лицом (закрыли, пока она ещё не перевернулась) — сразу улетает
  if (flat.value || Math.abs((gsap.getProperty(card, 'rotateY') || 0) % 360) > 90) {
    unflat()
    sfx('pageFlip', 0.35)
    // переворачивается лицом (видно, чья улетает) и уносится за край
    await play(gsap.timeline().to(card, { rotateY: 360, duration: 0.5, ease: 'power2.inOut' }), 1500)
  }
  gsap.set(card, { rotateX: 0, rotateY: 0, rotation: 0 })
  trailOn = true
  sfx('cloudWhoosh', 0.14)
  await play(flyOutTl(offscreen()), 2000)
  trailOn = false
  alive.value = false
  await release()
}
// другая вкладка: карточка крутится — чем дальше вкладка, тем больше оборотов и быстрее;
// страница меняется, пока к нам повёрнуто лицо
async function spinStep(key) {
  const from = idxOf(cur.value), to = idxOf(key)
  if (from === to || to < 0) return
  if (reduce || !cardRef.value || !ready.value || !flat.value) { cur.value = key; return }
  const d = Math.abs(to - from), turns = Math.min(1 + Math.floor(d / 2), 6), dir = to > from ? -1 : 1
  const dur = 0.42 + 0.13 * turns
  unflat()
  const card = cardRef.value
  const st = { a: 180 }
  let swapped = false
  for (let k = 0; k < Math.min(turns, 4); k++) setTimeout(() => sfx('pageFlip', 0.22), k * 140)
  await play(gsap.timeline()
    .to(st, { a: 180 + dir * 360 * turns, duration: dur, ease: 'power2.inOut', onUpdate: () => {
      gsap.set(card, { rotateY: st.a })
      if (!swapped && Math.abs(st.a - 180) >= 90) { swapped = true; cur.value = key }
    } }, 0)
    .to(card, { keyframes: { scale: [1, 1 + 0.015 * turns, 1] }, duration: dur, ease: 'sine.inOut' }, 0), 3000)
  if (!swapped) cur.value = key
  goFlat()
  await nextTick()
  inkIn(scrollRef.value)
}
function closeStep() {
  return leaveStep().then(() => emit('close'))
}

/* ---------- что можно попросить у карточки ---------- */
// вкладки: пока карточка крутится, копим последнюю выбранную и крутимся к ней
let wantTab = null, tabQueued = false
function turnTo(key) {
  if (closing || !SECTIONS.some(s => s.key === key)) return
  try { localStorage.setItem('mini-sheet-page', key) } catch { /* нет */ }
  wantTab = key
  if (tabQueued) return
  tabQueued = true
  enqueue(async () => { tabQueued = false; const k = wantTab; wantTab = null; if (k && k !== cur.value) await spinStep(k) })
}
// другой герой: старая карточка улетает, прилетает новая (несколько переключений подряд — только к последнему)
let swapQueued = false
watch(() => props.sheetId, () => {
  if (swapQueued || closing) return
  swapQueued = true
  enqueue(async () => {
    swapQueued = false
    if (props.sheetId === shownSheet.value) return
    await leaveStep()
    if (!closing) await summonStep()
  })
})
function dismiss() {
  if (closing) return
  closing = true
  // идущую анимацию доигрываем мгновенно — закрытие начинается сразу
  tl?.progress(1)
  enqueue(closeStep)
}
// без анимации (узкий экран, ушли со страницы)
async function closeNow() {
  if (closing) return
  closing = true
  tl?.progress(1)
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
  removeEventListener('resize', onResize)
  endDrag()
  tl?.kill()
  trailOn = false
  clearTimeout(fxTimer)
  release()
})
</script>

<style scoped>
.ms-layer { position: fixed; inset: 0; z-index: 300; pointer-events: none; }
.ms { position: fixed; pointer-events: auto; color: var(--ink); font-family: 'Manrope', sans-serif; perspective: 1700px; will-change: transform; }
.ms.moving { user-select: none; }
.ms.veil { visibility: hidden; }
.mc { position: absolute; inset: 0; transform-style: preserve-3d; }
.face { position: absolute; inset: 0; backface-visibility: hidden; -webkit-backface-visibility: hidden; border-radius: 18px; padding: 12px; box-sizing: border-box; overflow: hidden; display: flex; flex-direction: column;
  background: linear-gradient(180deg, #221b13, #15110c); border: 1px solid #5d4521;
  box-shadow: 0 0 0 3px #241c13, 0 0 0 4px color-mix(in srgb, var(--gc) 45%, rgba(201, 162, 79, .5)), 0 0 30px color-mix(in srgb, var(--gc) 22%, transparent), 0 24px 60px rgba(0, 0, 0, .7); }
.back { transform: rotateY(180deg); }
/* лежит оборотом вверх — без 3D */
.mc.flat .front { visibility: hidden; }
.mc.flat .back { transform: none; }
.ms.downed .face { filter: grayscale(.6) brightness(.8); box-shadow: 0 0 0 3px #241c13, 0 0 0 4px rgba(200, 50, 40, .7), 0 24px 60px rgba(0, 0, 0, .7); }
.rivet { position: absolute; z-index: 6; width: 8px; height: 8px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #ffe9b0, #8a6630 60%, #3b2a12); pointer-events: none; }
.rivet.a { top: 7px; left: 7px; } .rivet.b { top: 7px; right: 7px; } .rivet.c { bottom: 7px; left: 7px; } .rivet.d { bottom: 7px; right: 7px; }
.stripe { position: absolute; z-index: 6; top: 0; left: 20%; right: 20%; height: 3px; border-radius: 0 0 4px 4px; background: var(--gc); box-shadow: 0 0 12px var(--gc); pointer-events: none; }

/* лицо — как карточка героя */
.port { position: relative; flex: 1 1 auto; min-height: 180px; border-radius: 12px; overflow: hidden; border: 1px solid #6b5127; background: radial-gradient(circle at 50% 35%, color-mix(in srgb, var(--gc) 28%, #2a2015), #120e09 75%); }
.pimg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.ph { position: absolute; inset: 0; display: grid; place-items: center; font: 700 140px 'Cormorant Garamond', Georgia, serif; color: rgba(255, 240, 210, .16); }
.port::after { content: ''; position: absolute; z-index: 1; inset: 0; background: linear-gradient(180deg, transparent 50%, rgba(16, 12, 8, .94)); }
.lvl { position: absolute; z-index: 2; top: 8px; left: 8px; width: 46px; height: 52px; clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%); background: linear-gradient(180deg, #f2d58f, #a87a33); display: grid; place-items: center; text-align: center; color: #1e150a; font: 800 18px/1 'Manrope', sans-serif; }
.lvl small { display: block; font-size: 8px; letter-spacing: .5px; }
.bm { position: absolute; z-index: 2; top: 10px; right: 10px; background: rgba(16, 12, 8, .78); border: 1px solid #b8893f; border-radius: 99px; padding: 3px 10px; font: 800 13px 'Manrope', sans-serif; color: #f3d99a; }
.bm small { color: #a8936c; margin-right: 4px; }
.name { position: absolute; z-index: 2; left: 14px; right: 14px; bottom: 10px; font: 700 30px/1.05 'Cormorant Garamond', Georgia, serif; color: #fff3d6; text-shadow: 0 2px 8px #000; }
.sub { display: block; margin-top: 4px; font: 700 11.5px 'Manrope', sans-serif; letter-spacing: .3px; color: #e6c27a; }
.gline { display: flex; align-items: center; gap: 8px; margin: 10px 2px 0; flex: none; }
.gline .k, .row .k { color: #a8936c; font-size: 12px; width: 62px; flex: none; }
.gauge { flex: 1; height: 8px; border-radius: 99px; overflow: hidden; background: rgba(255, 255, 255, .07); border: 1px solid rgba(255, 255, 255, .06); }
.gauge i { display: block; height: 100%; transition: width .5s; }
.gline.hp .gauge i { background: linear-gradient(90deg, #3f9a4a, #8fe07a); }
.gline.st .gauge i { background: linear-gradient(90deg, #c0392b, #ff6b5b); }
.gline b { font-size: 12px; white-space: nowrap; }
.rows { display: grid; gap: 5px; margin: 10px 2px 0; font-size: 12.5px; flex: none; }
.row { display: flex; align-items: center; gap: 8px; min-width: 0; }
.row .v { display: flex; align-items: center; gap: 6px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.row .v img { width: 18px; height: 18px; border-radius: 50%; object-fit: cover; border: 1px solid #b8893f; }
.seal { flex: none; margin: 10px 0 2px; text-align: center; font: 800 10.5px 'Manrope', sans-serif; letter-spacing: .3em; text-transform: uppercase; color: color-mix(in srgb, var(--gc) 50%, #e2c278); opacity: .85; }
.shine { position: absolute; z-index: 5; inset: -10% -30%; pointer-events: none; background: linear-gradient(115deg, transparent 38%, rgba(255, 236, 190, .28) 50%, transparent 62%); transform: translateX(-120%); }

/* оборот — лист */
.ms-head { position: relative; z-index: 3; display: flex; align-items: center; gap: 9px; padding: 2px 4px 8px 4px; cursor: grab; touch-action: none; flex: none; }
.ms.moving .ms-head { cursor: grabbing; }
.ms-av { flex: none; width: 34px; height: 34px; border-radius: 50%; overflow: hidden; display: grid; place-items: center; border: 2px solid #e2c278; background: #120d08; color: var(--acc); font: 700 18px 'Cormorant Garamond', serif; box-shadow: 0 0 12px color-mix(in srgb, var(--gc) 45%, transparent); }
.ms-av img { width: 100%; height: 100%; object-fit: cover; }
.ms-title { flex: 1; display: grid; min-width: 0; }
.ms-title b { font: 700 19px 'Cormorant Garamond', serif; color: #f3dc9e; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.1; }
.ms-title small { color: #c9b48a; font: 700 11px 'Manrope', sans-serif; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ms-save { font: 700 11px 'Manrope', sans-serif; color: #c9b48a; white-space: nowrap; }
.ms-save.saved { color: #7ccf8b; }
.ms-save.offline { color: #ff9b8f; }
.ms-ro { font-size: 13px; opacity: .85; }
.ms-btn { flex: none; display: grid; place-items: center; width: 28px; height: 28px; border-radius: 8px; border: 1px solid #6b5127; background: rgba(0, 0, 0, .3); color: #f3dc9e; font: 700 14px 'Manrope', sans-serif; cursor: pointer; text-decoration: none; transition: background .15s, transform .15s; }
.ms-btn:hover { background: rgba(231, 197, 111, .15); }
.ms-btn:active { transform: scale(.92); }
.ms-btn.x:hover { border-color: rgba(255, 122, 107, .5); color: #ff9b8f; background: rgba(255, 122, 107, .1); }
.ms-marks { position: relative; z-index: 1; display: flex; gap: 3px; padding: 0 10px; margin-bottom: -6px; flex: none; }
.ms-mark { flex: 1 1 0; min-width: 0; max-width: 40px; height: 32px; display: grid; place-items: start center; padding-top: 6px; box-sizing: border-box; border: 0; border-radius: 6px 6px 0 0; cursor: pointer;
  background: linear-gradient(180deg, color-mix(in srgb, var(--silk) 80%, #fff 8%), var(--silk)); box-shadow: inset 0 0 0 1px rgba(0, 0, 0, .3); transform: translateY(6px); transition: transform .18s, filter .18s; filter: brightness(.8) saturate(.85); }
.ms-mark .ic { width: 15px; height: 15px; color: #fff4dc; }
.ms-mark:hover { transform: translateY(2px); filter: none; }
.ms-mark.on { transform: translateY(-2px); filter: none; box-shadow: inset 0 0 0 1px rgba(0, 0, 0, .35), 0 -3px 12px color-mix(in srgb, var(--silk) 70%, transparent), 0 0 0 1px #e2c278; }
.ms-page { position: relative; z-index: 2; flex: 1; min-height: 0; overflow: hidden; border-radius: 10px; border: 1px solid #6b5127;
  background: radial-gradient(ellipse at 50% 40%, color-mix(in srgb, var(--acc) 7%, transparent), transparent 70%), linear-gradient(180deg, var(--paper2), var(--paper)); box-shadow: inset 0 0 30px rgba(0, 0, 0, .45); }
.ms-run { position: absolute; top: 10px; left: 0; right: 0; z-index: 3; text-align: center; font: 700 9.5px 'Manrope', sans-serif; letter-spacing: .26em; text-transform: uppercase; color: color-mix(in srgb, var(--acc) 45%, var(--muted)); opacity: .75; pointer-events: none; }
.ms-run::before, .ms-run::after { content: '❦'; margin: 0 8px; letter-spacing: 0; opacity: .7; }
.ms-scroll { position: absolute; inset: 28px 0 4px; overflow-y: auto; overflow-x: hidden; padding: 8px 16px 22px 18px; }
.ms-scroll :deep(.sb-h) { font-size: 21px; }
.ms-wait { position: absolute; inset: 0; display: grid; place-content: center; justify-items: center; gap: 10px; color: var(--muted); font: 700 13px 'Manrope', sans-serif; }
.ms-wait.err { color: #ff9b8f; padding: 20px; text-align: center; }
.ms-spin { width: 22px; height: 22px; border-radius: 50%; border: 2px solid rgba(231, 197, 111, .3); border-top-color: #e2c278; animation: ms-spin .8s linear infinite; }
@keyframes ms-spin { to { transform: rotate(360deg); } }
.ms-grip { position: absolute; right: 3px; bottom: 3px; z-index: 7; width: 18px; height: 18px; cursor: nwse-resize; touch-action: none;
  background: linear-gradient(135deg, transparent 50%, #e2c278 50% 58%, transparent 58% 68%, #e2c278 68% 76%, transparent 76%); opacity: .6; }
.ms-grip:hover { opacity: 1; }

.ms-sparks { position: fixed; inset: 0; pointer-events: none; z-index: 1; }
.ms-sparks :deep(i) { position: absolute; left: 0; top: 0; width: 5px; height: 5px; margin: -2.5px; border-radius: 50%; background: radial-gradient(circle, #fffaf0, color-mix(in srgb, var(--gc) 50%, #ffd27a) 50%, transparent 72%); box-shadow: 0 0 7px 1px color-mix(in srgb, var(--gc) 60%, #ffcf6a); }
.ms-sparks :deep(i.big) { width: 8px; height: 8px; margin: -4px; box-shadow: 0 0 14px 3px color-mix(in srgb, var(--gc) 60%, #ffcf6a); }
</style>
