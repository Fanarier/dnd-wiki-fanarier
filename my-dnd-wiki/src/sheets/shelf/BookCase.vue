<template>
  <!-- книжный стеллаж: книги-листы стоят плотно слева направо, перед книгами каждого игрока висит бирка, свободные места заняты вещами -->
  <div class="bc" :class="{ ready }">
    <ShelfDefs />
    <div class="bc-cornice"><span class="bc-plate">{{ title }}</span></div>
    <div class="bc-body">
      <div class="bc-post" />
      <div ref="rowsEl" class="bc-rows">
        <div v-for="(r, ri) in rows" :key="ri" class="bc-row">
          <div class="bc-items">
            <template v-for="(it, i) in r.items" :key="i">
              <span v-if="it.t === 'gap'" class="bc-gap" :style="{ width: it.w + 'px' }" />
              <!-- бирка игрока -->
              <span v-else-if="it.t === 'tag'" class="bc-tag" :class="{ own: it.group.own }" :style="{ width: it.w + 'px' }" :title="it.group.hint">
                <i class="bc-twine" /><b><span>{{ it.group.title }}</span></b>
              </span>
              <span v-else-if="it.t === 'decor'" class="bc-decor" :class="it.kind" :style="{ width: it.w + 'px' }"><ShelfDecor :kind="it.kind" :w="it.w" :seed="it.seed" /></span>
              <button v-else type="button" class="bc-book" :class="{ locked: it.book.s.locked, own: it.group.own, dim: it.book.dim, shake: shaking === it.book.id, on: card?.id === it.book.id }"
                :style="{ width: it.w + 'px', '--i': it.book.n }" :aria-label="bookLabel(it.book.s)"
                @click="onClick($event, it.book.s)" @pointerenter="onEnter($event, it.book.s)" @pointerleave="onLeave" @focus="show($event.currentTarget, it.book.s)" @blur="onLeave">
                <BookSpine :look="it.book.look" :name="it.book.s.name" :level="it.book.s.level" :locked="it.book.s.locked" />
              </button>
            </template>
          </div>
          <div class="bc-board" />
        </div>
      </div>
      <div class="bc-post" />
    </div>
    <div class="bc-plinth" />

    <!-- карточка книги: обложка, чья, описание и что с ней можно сделать -->
    <Teleport to="body">
      <div v-if="card" ref="cardEl" class="bc-card" :class="{ sheet: narrow }" :style="cardPos" role="dialog" :aria-label="`Книга: ${card.name}`" @pointerenter="keep" @pointerleave="onLeave">
        <div class="bc-cover" :class="[cardLook.m, { frost: cardLook.deco.includes('frost') }]" :style="{ '--c': cardLook.c, '--f': coverInk }">
          <span class="bc-medal"><img v-if="card.photo" :src="sheetImg(card.photo)" alt="" /><span v-else>{{ (card.name || '?')[0] }}</span></span>
          <b>{{ card.name }}</b>
          <svg v-if="cardLook.em" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path :d="EMBLEM_PATHS[cardLook.em]" fill-rule="evenodd" :fill="EMBLEM_FILL[cardLook.em] ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" /></svg>
        </div>
        <div class="bc-info">
          <h3>{{ card.name }}</h3>
          <p class="bc-cls">{{ [card.cls, card.level ? card.level + ' уровень' : ''].filter(Boolean).join(', ') || 'Класс не указан' }}</p>
          <p class="bc-whose">{{ whose(card) }}</p>
          <p v-if="cardLook.desc" class="bc-desc">{{ cardLook.desc }}</p>
          <p v-if="card.locked" class="bc-lock">Заперта. Открыть может владелец или тот, кому он разрешил.</p>
          <p v-else-if="card.canEdit === false" class="bc-lock open">Владелец разрешил тебе читать эту книгу.</p>
          <div v-if="!card.locked" class="bc-acts">
            <template v-if="mode === 'trash'">
              <button type="button" class="main" @click="act('restore')">Вернуть на полку</button>
              <button type="button" class="danger" @click="act('purge')">Удалить насовсем</button>
            </template>
            <template v-else>
              <button type="button" class="main" @click="act('open')">Открыть</button>
              <button type="button" @click="act('export')">Выгрузить .json</button>
              <button v-if="isMaster" type="button" @click="act('meta')">Владелец</button>
              <button v-if="card.canEdit !== false" type="button" class="danger" @click="act('trash')">В корзину</button>
            </template>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import ShelfDefs from './ShelfDefs.vue'
import BookSpine from './BookSpine.vue'
import ShelfDecor from './ShelfDecor.vue'
import { packShelves } from './decor.js'
import { EMBLEM_PATHS, EMBLEM_FILL } from './emblems.js'
import { lookOf, spineSize, mix, lum } from '../../shared/bookLook.js'
import { sheetImg } from '../sheetState.js'
import { toast } from '../../map/store.js'

// groups: [{ key, title, hint, own, items: [лист или запертая книга] }]; match(s) — подходит ли книга под поиск
const props = defineProps({
  groups: { type: Array, required: true },
  title: { type: String, default: '' },
  match: { type: Function, default: null },
  mode: { type: String, default: 'shelf' },
  isMaster: Boolean
})
const emit = defineEmits(['open', 'export', 'meta', 'trash', 'restore', 'purge'])

const rowsEl = ref(null), width = ref(0), ready = ref(false)
const rows = computed(() => {
  if (!width.value) return []
  let n = 0
  const gs = props.groups.map(g => ({
    ...g,
    books: g.items.map(s => { const look = lookOf(s); return { id: s.id, s, look, w: spineSize(look).w, n: n++, dim: props.match ? !props.match(s) : false } })
  }))
  return packShelves(gs, width.value, width.value < 520 ? 2 : 3)
})
let ro = null
const measure = () => { if (rowsEl.value) width.value = Math.floor(rowsEl.value.clientWidth) }
onMounted(() => {
  measure()
  // страница могла ещё не разложиться (или вкладка скрыта и наблюдатель молчит) — перемеряем чуть позже
  for (const ms of [0, 120, 600]) setTimeout(measure, ms)
  ro = new ResizeObserver(measure)
  ro.observe(rowsEl.value)
  addEventListener('resize', measure)
  addEventListener('scroll', onScroll, true)
  addEventListener('keydown', onKey)
  setTimeout(() => { ready.value = true }, 900)
})
onBeforeUnmount(() => { ro?.disconnect(); removeEventListener('resize', measure); removeEventListener('scroll', onScroll, true); removeEventListener('keydown', onKey); clearTimeout(timer) })

const bookLabel = s => `${s.name}${s.cls ? ', ' + s.cls : ''}${s.locked ? ' — книга заперта' : ''}`
const whose = s => (s.ownerShort ? (s.mine ? 'Твоя книга' : `Книга игрока ${s.ownerShort}`) : 'Книга мастера')

/* ---------- карточка ---------- */
const card = ref(null), cardEl = ref(null), cardPos = ref({}), shaking = ref(''), narrow = ref(false)
const cardLook = computed(() => (card.value ? lookOf(card.value) : null))
// тиснение в тон переплёта на обложке не прочесть — сдвигаем тон, как на корешке
const coverInk = computed(() => {
  const L = cardLook.value
  if (!L) return '#d9b25c'
  if (Math.abs(lum(L.f) - lum(L.c)) >= 0.3) return L.f
  return lum(L.c) > 0.5 ? mix(L.f, '#2a1606', 0.62) : mix(L.f, '#ffffff', 0.6)
})
let timer = 0, anchor = null
function place() {
  if (!anchor || !card.value) return
  narrow.value = innerWidth < 620
  if (narrow.value) { cardPos.value = {}; return }
  const r = anchor.getBoundingClientRect(), W = 430, H = cardEl.value?.offsetHeight || 300
  const left = r.right + 8 + W < innerWidth ? r.right + 8 : Math.max(8, r.left - W - 8)
  const top = Math.max(64, Math.min(innerHeight - H - 10, r.top + r.height / 2 - H / 2))
  cardPos.value = { left: left + 'px', top: top + 'px' }
}
function show(el, s) {
  clearTimeout(timer)
  anchor = el
  card.value = s
  place()
  nextTick(place)
}
const keep = () => clearTimeout(timer)
function hide() { clearTimeout(timer); card.value = null; anchor = null }
// страница прокрутилась — карточка оторвалась от книги; прокрутка внутри самой карточки её не прячет
const onScroll = e => { if (!(e.target instanceof Node && cardEl.value?.contains(e.target))) hide() }
function onEnter(e, s) { if (e.pointerType === 'mouse') show(e.currentTarget, s) }
function onLeave() { clearTimeout(timer); timer = setTimeout(hide, 220) }
function onKey(e) { if (e.key === 'Escape' && card.value) hide() }
// список обновился (кто-то поправил лист) — карточка показывает свежие данные
watch(() => props.groups, gs => {
  if (!card.value) return
  const fresh = gs.flatMap(g => g.items).find(s => s.id === card.value.id)
  if (fresh) card.value = fresh; else hide()
})

function onClick(e, s) {
  const el = e.currentTarget
  // пальцем: первое касание показывает карточку, открывает уже кнопка в ней
  const touch = e.pointerType === 'touch' || (e.detail === 0 ? false : matchMedia('(hover: none)').matches)
  if (touch && card.value?.id !== s.id) return show(el, s)
  if (s.locked) {
    shaking.value = s.id
    setTimeout(() => { if (shaking.value === s.id) shaking.value = '' }, 500)
    show(el, s)
    return toast(`Книга «${s.name}» заперта: её открывает владелец`, 'error')
  }
  if (touch) return
  if (props.mode === 'trash') return show(el, s)
  emit('open', s, el.getBoundingClientRect())
}
function act(kind) {
  const s = card.value, r = anchor?.getBoundingClientRect()
  hide()
  if (s) emit(kind, s, r)
}
</script>

<style scoped>
/* дерево стеллажа — орех; задник — тёмный сине-зелёный, чтобы тёплые корешки и свеча читались на холодном */
.bc { --wood: #3b2415; --wood-hi: #6b4526; --wood-lo: #1c110a; --back: #10191c; --gilt: #c9a24f; --row-h: 238px;
  position: relative; border-radius: 10px 10px 4px 4px; box-shadow: 0 30px 60px rgba(0, 0, 0, .65), 0 0 0 1px #0a0604; }
.bc-cornice { position: relative; display: grid; place-items: center; height: 58px; border-radius: 10px 10px 0 0;
  background: linear-gradient(180deg, #7a5230 0, #5a3a20 12%, var(--wood) 46%, #2a180d 47%, #4a2e19 58%, var(--wood) 100%);
  box-shadow: inset 0 -3px 0 #140b06, inset 0 1px 0 rgba(255, 220, 170, .28); }
.bc-cornice::before, .bc-cornice::after { content: ''; position: absolute; top: 14px; bottom: 12px; width: min(26%, 300px);
  background: repeating-linear-gradient(90deg, transparent 0 9px, rgba(0, 0, 0, .34) 9px 11px, rgba(255, 220, 170, .09) 11px 12px, transparent 12px 20px); border-radius: 3px; }
.bc-cornice::before { left: 22px; } .bc-cornice::after { right: 22px; }
.bc-plate { position: relative; padding: 5px 22px 6px; border-radius: 3px; font: 700 21px/1.1 'Cormorant Garamond', serif; letter-spacing: .04em; color: #2a1c08;
  background: linear-gradient(180deg, #e6c98a, #b48a3e 55%, #8e6a2c); box-shadow: 0 2px 5px rgba(0, 0, 0, .6), inset 0 1px 0 rgba(255, 255, 255, .5), inset 0 -1px 0 rgba(0, 0, 0, .35); text-shadow: 0 1px 0 rgba(255, 240, 200, .5); }
.bc-body { display: flex; }
.bc-post { flex: none; width: 30px; background:
  linear-gradient(90deg, rgba(0, 0, 0, .55), transparent 22%, rgba(255, 220, 170, .14) 46%, transparent 62%, rgba(0, 0, 0, .6)),
  repeating-linear-gradient(180deg, var(--wood) 0 90px, #33200f 90px 94px, #4a2e19 94px 98px, var(--wood) 98px 190px); }
.bc-rows { flex: 1; min-width: 0; background: var(--back); }
.bc-row { position: relative; }
.bc-items { position: relative; display: flex; align-items: flex-end; height: var(--row-h); padding-top: 14px; box-sizing: border-box; overflow: visible;
  background:
    linear-gradient(180deg, rgba(0, 0, 0, .78) 0, rgba(0, 0, 0, .25) 26%, transparent 60%),
    repeating-linear-gradient(90deg, transparent 0 138px, rgba(0, 0, 0, .4) 138px 140px, rgba(255, 255, 255, .025) 140px 141px),
    linear-gradient(180deg, #0c1417, #16242a); }
.bc-board { position: relative; z-index: 1; height: 18px;
  background: linear-gradient(180deg, #8a5f36 0, var(--wood-hi) 14%, var(--wood) 48%, #24150b 100%);
  box-shadow: 0 9px 14px rgba(0, 0, 0, .7), inset 0 1px 0 rgba(255, 225, 180, .35); }
.bc-plinth { height: 34px; border-radius: 0 0 4px 4px; background: linear-gradient(180deg, #24150b, var(--wood) 30%, #2a180d 62%, var(--wood-lo)); box-shadow: inset 0 2px 0 rgba(255, 220, 170, .12); }
.bc-gap { flex: none; }

/* вещи */
.bc-decor { position: relative; flex: none; display: flex; align-items: flex-end; justify-content: center; pointer-events: none; filter: drop-shadow(2px 3px 3px rgba(0, 0, 0, .45)); }
.bc-decor.tomes { filter: brightness(.8) saturate(.85) drop-shadow(2px 3px 3px rgba(0, 0, 0, .5)); }
/* свеча и фонарь светят на соседей — тень-фильтр обрезал бы свет по ширине вещи */
.bc-decor.candle, .bc-decor.lantern, .bc-decor.globe, .bc-decor.bottles { filter: none; }

/* бирка игрока висит на бечёвке перед его книгами */
.bc-tag { position: relative; flex: none; align-self: stretch; display: flex; justify-content: center; z-index: 2; }
.bc-twine { position: absolute; top: -14px; left: 50%; width: 1.5px; height: 40px; background: linear-gradient(180deg, #5a4526, #b39a66); transform-origin: top; }
.bc-twine::before { content: ''; position: absolute; top: 0; left: -3px; width: 7px; height: 7px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #f0d48a, #8e6a2c); box-shadow: 0 1px 2px #000; }
.bc-tag b { position: absolute; top: 22px; display: flex; align-items: center; justify-content: center; width: 26px; max-height: calc(100% - 34px); padding: 16px 0 9px; box-sizing: border-box;
  clip-path: polygon(50% 0, 100% 12px, 100% 100%, 0 100%, 0 12px); background: linear-gradient(90deg, #cdb98a, #eadbb0 45%, #c9b582); color: #33230f; box-shadow: inset 0 0 0 1px rgba(90, 69, 38, .5);
  transform-origin: 50% -22px; animation: bc-sway 5.5s ease-in-out infinite; }
.bc-tag b::before { content: ''; position: absolute; top: 9px; left: 50%; width: 5px; height: 5px; margin-left: -2.5px; border-radius: 50%; background: #10191c; box-shadow: 0 0 0 1.5px #8e6a2c; }
.bc-tag b span { writing-mode: vertical-rl; transform: rotate(180deg); font: 700 13.5px/1 'Cormorant Garamond', serif; letter-spacing: .04em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-height: 150px; }
.bc-tag.own b { background: linear-gradient(90deg, #d9b25c, #f3dc9e 45%, #c99a45); color: #2a1c08; }
@keyframes bc-sway { 0%, 100% { transform: rotate(-1.6deg); } 50% { transform: rotate(1.6deg); } }

/* книга */
.bc-book { position: relative; flex: none; display: flex; align-items: flex-end; margin: 0 1px 0 0; padding: 0; border: 0; background: none; cursor: pointer; z-index: 1;
  filter: drop-shadow(2px 3px 3px rgba(0, 0, 0, .55)); transition: transform .22s cubic-bezier(.2, .9, .3, 1.2), filter .22s; }
.bc:not(.ready) .bc-book { animation: bc-in .55s cubic-bezier(.2, .9, .3, 1.1) both; animation-delay: calc(var(--i) * 28ms); }
@keyframes bc-in { from { opacity: 0; transform: translateY(-34px); } }
.bc-book.own { filter: drop-shadow(0 0 7px rgba(255, 196, 110, .42)) drop-shadow(2px 3px 3px rgba(0, 0, 0, .55)); }
.bc-book:hover, .bc-book.on, .bc-book:focus-visible { transform: translateY(-12px); z-index: 3; filter: drop-shadow(0 0 10px rgba(255, 205, 130, .5)) drop-shadow(3px 12px 8px rgba(0, 0, 0, .6)); }
.bc-book:focus-visible { outline: 2px solid #f3dc9e; outline-offset: 3px; border-radius: 4px; }
.bc-book.locked { cursor: not-allowed; }
.bc-book.dim { filter: brightness(.3) saturate(.4); }
.bc-book.shake { animation: bc-shake .45s; }
@keyframes bc-shake { 20% { transform: translateY(-6px) rotate(-2.2deg); } 45% { transform: translateY(-6px) rotate(2deg); } 70% { transform: translateY(-4px) rotate(-1.2deg); } }

@media (max-width: 600px) { .bc-post { width: 12px; } .bc-cornice { height: 46px; } .bc-plate { font-size: 17px; padding: 4px 14px 5px; } .bc-cornice::before, .bc-cornice::after { display: none; } }
@media (prefers-reduced-motion: reduce) { .bc-book, .bc-tag b { animation: none !important; transition: none; } }
</style>

<style>
/* карточка книги живёт в body */
.bc-card { position: fixed; z-index: 60; display: grid; grid-template-columns: 132px minmax(0, 1fr); gap: 14px; width: 430px; max-width: calc(100vw - 16px); max-height: min(520px, calc(100vh - 80px)); padding: 14px; box-sizing: border-box; overflow: auto;
  border-radius: 12px; border: 1px solid #6e4f22; background: linear-gradient(165deg, #2a2016, #17110b); color: #efe3c8; box-shadow: 0 0 0 3px #120c07, 0 22px 50px rgba(0, 0, 0, .7); font-family: 'Manrope', sans-serif; animation: bc-card .16s ease-out; }
.bc-card.sheet { left: 8px; right: 8px; bottom: 8px; top: auto; width: auto; max-height: 70vh; }
@keyframes bc-card { from { opacity: 0; transform: translateY(6px); } }
.bc-cover { position: relative; align-self: start; display: grid; justify-items: center; align-content: start; gap: 8px; aspect-ratio: 3 / 4.2; padding: 14px 8px 8px 14px; box-sizing: border-box; overflow: hidden; border-radius: 3px 8px 8px 3px; color: var(--f); text-align: center;
  background: linear-gradient(90deg, rgba(0, 0, 0, .5), rgba(255, 255, 255, .08) 9%, transparent 14%), radial-gradient(ellipse at 45% 25%, color-mix(in srgb, var(--c) 82%, #fff), var(--c) 60%, color-mix(in srgb, var(--c) 60%, #000));
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, .5), inset 0 0 26px rgba(0, 0, 0, .45), 4px 6px 12px rgba(0, 0, 0, .5); }
.bc-cover::before { content: ''; position: absolute; inset: 0; pointer-events: none; mix-blend-mode: overlay; opacity: .55;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='f' x='0' y='0' width='100%25' height='100%25'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.62' numOctaves='3' seed='7' stitchTiles='stitch'/%3E%3CfeDiffuseLighting surfaceScale='1.6' lighting-color='%23fff'%3E%3CfeDistantLight azimuth='235' elevation='52'/%3E%3C/feDiffuseLighting%3E%3CfeComponentTransfer%3E%3CfeFuncR type='linear' slope='2.2' intercept='-1.25'/%3E%3CfeFuncG type='linear' slope='2.2' intercept='-1.25'/%3E%3CfeFuncB type='linear' slope='2.2' intercept='-1.25'/%3E%3C/feComponentTransfer%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23f)'/%3E%3C/svg%3E"); }
.bc-cover::after { content: ''; position: absolute; inset: 6px 6px 6px 13px; border: 3px double var(--f); border-radius: 2px; opacity: .6; pointer-events: none; }
.bc-cover.metal::before, .bc-cover.cloth::before { opacity: .35; }
.bc-cover.frost { box-shadow: inset 0 0 0 1px rgba(0, 0, 0, .5), inset 0 0 22px rgba(214, 242, 255, .55), inset 0 0 4px rgba(255, 255, 255, .8), 4px 6px 12px rgba(0, 0, 0, .5); }
.bc-cover.metal { background: linear-gradient(90deg, rgba(0, 0, 0, .5), rgba(255, 255, 255, .1) 9%, transparent 14%), repeating-linear-gradient(90deg, rgba(255, 255, 255, .05) 0 1px, transparent 1px 3px), var(--c); }
.bc-cover.cloth { background: linear-gradient(90deg, rgba(0, 0, 0, .5), rgba(255, 255, 255, .08) 9%, transparent 14%), repeating-linear-gradient(0deg, rgba(0, 0, 0, .12) 0 1px, transparent 1px 3px), repeating-linear-gradient(90deg, rgba(255, 255, 255, .05) 0 1px, transparent 1px 3px), var(--c); }
.bc-medal { position: relative; display: grid; place-items: center; width: 78%; aspect-ratio: 1; border-radius: 50%; overflow: hidden; border: 2px solid var(--f); background: #120d08; font: 700 34px 'Cormorant Garamond', serif; box-shadow: inset 0 0 10px rgba(0, 0, 0, .6); }
.bc-medal img { width: 100%; height: 100%; object-fit: cover; }
.bc-cover b { position: relative; font: 700 14px/1.1 'Cormorant Garamond', serif; overflow-wrap: anywhere; text-shadow: 0 1px 0 rgba(0, 0, 0, .5); }
.bc-info { display: grid; align-content: start; gap: 5px; min-width: 0; }
.bc-info h3 { margin: 0; font: 700 23px/1.1 'Cormorant Garamond', serif; color: #f3dc9e; overflow-wrap: anywhere; }
.bc-info p { margin: 0; }
.bc-cls { font: 700 13px/1.3 'Manrope', sans-serif; color: #d9c9a6; }
.bc-whose { font: 600 12px/1.3 'Manrope', sans-serif; color: #a8936c; }
.bc-desc { margin-top: 4px !important; font: 500 italic 14.5px/1.42 'Cormorant Garamond', serif; color: #d9c9a6; white-space: pre-line; }
.bc-lock { margin-top: 4px !important; padding: 6px 9px; border-radius: 8px; border: 1px solid rgba(255, 122, 107, .35); background: rgba(255, 122, 107, .08); color: #ffb3a8; font: 600 12px/1.35 'Manrope', sans-serif; }
.bc-lock.open { border-color: rgba(126, 224, 106, .35); background: rgba(126, 224, 106, .07); color: #b8e6ae; }
.bc-acts { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.bc-acts button { padding: 6px 11px; border-radius: 8px; border: 1px solid rgba(231, 197, 111, .35); background: rgba(231, 197, 111, .07); color: #f3d99a; font: 700 12.5px 'Manrope', sans-serif; cursor: pointer; }
.bc-acts button:hover { background: rgba(231, 197, 111, .16); }
.bc-acts .main { background: linear-gradient(180deg, #f0cf83, #c99a45); color: #1b140c; border-color: #e6c27a; }
.bc-acts .danger:hover { color: #ff9b8f; border-color: rgba(255, 122, 107, .5); }
@media (prefers-reduced-motion: reduce) { .bc-card { animation: none; } }
</style>
