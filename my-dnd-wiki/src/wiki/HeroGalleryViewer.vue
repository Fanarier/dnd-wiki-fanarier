<template>
  <teleport to="body">
    <div class="gv" :class="theme && 'themed'" :style="themeVars(theme)" @click.self="$emit('close')" @touchstart.passive="tStart" @touchend="tEnd">
      <!-- размытая подложка из текущего арта -->
      <transition name="gv-bg">
        <div :key="cur.id" class="gv-bg" :style="{ backgroundImage: `url(${heroPortraitUrl(cur.thumb || cur.file)})` }" />
      </transition>
      <!-- эффекты темы героя фоном: пар, снег, лучи… -->
      <HeroFx v-if="theme" :theme="theme" mode="ambient" />

      <div class="gv-stage" @click.self="$emit('close')">
        <transition :name="dir > 0 ? 'gv-next' : 'gv-prev'">
          <div :key="cur.id" class="gv-slide" @click.self="$emit('close')">
            <!-- пока большой файл грузится, показываем лёгкую копию с карточки -->
            <img v-if="!loaded[cur.id]" :src="heroPortraitUrl(cur.thumb || cur.file)" class="gv-ph" alt="" />
            <img :data-aid="cur.id" :src="failed[cur.id] ? heroPortraitUrl(cur.thumb) : heroPortraitUrl(cur.file)" class="gv-img" :class="{ ready: loaded[cur.id], zoomed }" alt=""
                 @load="loaded[cur.id] = true" @error="onFail(cur)" @click.stop="imgClick" @dblclick.stop="toggleZoom" />
            <div v-if="!loaded[cur.id]" class="gv-spin" />
          </div>
        </transition>
      </div>

      <div class="gv-top">
        <span class="gv-name">{{ name }}</span>
        <span v-if="arts.length > 1" class="gv-count">{{ i + 1 }} / {{ arts.length }}</span>
        <span class="grow" />
        <!-- зум: колесо, два пальца, двойной щелчок; приближенный арт таскается -->
        <span class="gv-zoom" @click.stop>
          <button type="button" title="Отдалить" @click="pz?.zoomOut()">−</button>
          <button type="button" class="lvl" title="Сбросить масштаб" @click="pz?.reset()">{{ zoomed ? Math.round(scale * 100) + '%' : '1:1' }}</button>
          <button type="button" title="Приблизить" @click="pz?.zoomIn()">＋</button>
        </span>
        <a :href="heroPortraitUrl(cur.file)" :download="`${name || 'art'}-${i + 1}${cur.file.slice(cur.file.lastIndexOf('.'))}`" class="gv-dl" @click.stop>Скачать</a>
        <button class="gv-x" aria-label="Закрыть" @click="$emit('close')">×</button>
      </div>

      <template v-if="arts.length > 1">
        <button class="gv-nav prev" aria-label="Предыдущий" @click.stop="step(-1)">‹</button>
        <button class="gv-nav next" aria-label="Следующий" @click.stop="step(1)">›</button>
        <div ref="strip" class="gv-strip" @click.stop>
          <button v-for="(a, n) in arts" :key="a.id" class="gv-th" :class="{ on: n === i }" @click="go(n)">
            <img :src="heroPortraitUrl(a.thumb || a.file)" alt="" />
          </button>
        </div>
      </template>
    </div>
  </teleport>
</template>

<script setup>
// Арты карточки на весь экран: листание стрелками, клавишами, свайпом и по ленте миниатюр
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import Panzoom from '@panzoom/panzoom'
import { heroPortraitUrl } from '../map/store.js'
import HeroFx from './HeroFx.vue'
import { themeVars } from './heroThemes.js'

const props = defineProps({
  arts: { type: Array, required: true },
  start: { type: Number, default: 0 },
  name: { type: String, default: '' },
  theme: { type: String, default: null }
})
const emit = defineEmits(['close', 'index'])

const i = ref(Math.min(props.start, props.arts.length - 1))
const dir = ref(1)
const cur = computed(() => props.arts[i.value] || props.arts[0])
const strip = ref(null)
// миниатюру центрируем прокруткой самой полоски: scrollIntoView двигал ещё и весь просмотр — он уезжал влево
function centerThumb(smooth) {
  const s = strip.value, el = s?.children[i.value]
  if (el) s.scrollTo({ left: el.offsetLeft - (s.clientWidth - el.offsetWidth) / 2, behavior: smooth ? 'smooth' : 'auto' })
}
async function show(n) {
  i.value = (n + props.arts.length) % props.arts.length
  await nextTick()
  centerThumb(true)
}
// большой файл не открылся — показываем лёгкую копию, лишь бы не пустой экран
const loaded = reactive({})
const failed = reactive({})
function onFail(a) {
  if (!failed[a.id] && a.thumb) failed[a.id] = true
  else loaded[a.id] = true
}
// соседние арты подгружаем заранее — листание без ожидания
watch(i, n => {
  emit('index', n)
  for (const d of [1, -1]) {
    const a = props.arts[(n + d + props.arts.length) % props.arts.length]
    if (a) new Image().src = heroPortraitUrl(a.file)
  }
}, { immediate: true })
const go = n => { dir.value = n >= i.value ? 1 : -1; show(n) }
const step = d => { if (props.arts.length > 1) { dir.value = d; show(i.value + d) } }

function onKey(e) {
  if (e.key === 'Escape') emit('close')
  else if (e.key === 'ArrowRight') step(1)
  else if (e.key === 'ArrowLeft') step(-1)
}
// зум артов (@panzoom/panzoom): на каждом новом арте — свой, с масштаба 1
let pz = null, moved = false, panStart = null
const zoomed = ref(false), scale = ref(1)
function onWheel(e) { if (pz) { e.preventDefault(); pz.zoomWithWheel(e) } }
function setImg(el) {
  if (pz && pz.el === el) return
  pz?.wheelHost?.removeEventListener('wheel', onWheel)
  pz?.destroy()
  pz = null
  zoomed.value = false
  scale.value = 1
  if (!el) return
  pz = Panzoom(el, { maxScale: 6, minScale: 1, step: 0.35, panOnlyWhenZoomed: true, cursor: '' })
  pz.el = el
  pz.wheelHost = el.parentElement
  pz.wheelHost.addEventListener('wheel', onWheel, { passive: false })
  el.addEventListener('panzoomchange', e => { scale.value = e.detail.scale; zoomed.value = e.detail.scale > 1.02; if (!zoomed.value && e.detail.scale !== 1) pz.reset({ animate: false }) })
  el.addEventListener('panzoomstart', e => { panStart = { x: e.detail.x, y: e.detail.y }; moved = false })
  el.addEventListener('panzoompan', e => { if (panStart && Math.hypot(e.detail.x - panStart.x, e.detail.y - panStart.y) > 4) moved = true })
}
// щелчок по арту листает дальше, только если он не приближен и его не тащили
function imgClick() { if (!zoomed.value && !moved) step(1); moved = false }
function toggleZoom(e) { if (!pz) return; if (zoomed.value) pz.reset(); else pz.zoomToPoint(2.5, e) }
// при смене арта старая и новая картинки какое-то время живут вместе (анимация) — зум вешаем на новую по её id
watch(() => cur.value?.id, id => nextTick(() => setImg(document.querySelector(`.gv-img[data-aid="${id}"]`))), { immediate: true })
onBeforeUnmount(() => setImg(null))

let tx = null
const tStart = e => { tx = e.touches.length === 1 && !zoomed.value ? e.touches[0].clientX : null }
function tEnd(e) {
  if (tx === null || zoomed.value) return
  const dx = e.changedTouches[0].clientX - tx
  tx = null
  if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1)
}
onMounted(() => {
  window.addEventListener('keydown', onKey)
  document.documentElement.style.overflow = document.body.style.overflow = 'hidden'
  nextTick(() => centerThumb(false))
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  document.documentElement.style.overflow = document.body.style.overflow = ''
})
</script>

<style scoped>
.gv { --gv-acc: #e6c27a; --gv-txt: #f3d99a; --gv-line: rgba(201, 162, 79, .4); position: fixed; inset: 0; z-index: 210; overflow: hidden; overflow: clip; background: #070504; animation: gv-in .25s; font-family: 'Manrope', sans-serif; }
.gv.themed { --gv-acc: var(--ta); --gv-txt: var(--tl); --gv-line: color-mix(in srgb, var(--ta) 45%, transparent); background: var(--tbg2); }
.gv.themed .gv-bg { filter: blur(40px) brightness(.3) saturate(1.2); }
.gv.themed::after { content: ''; position: absolute; inset: 0; pointer-events: none; background: radial-gradient(ellipse at 50% 50%, transparent 40%, color-mix(in srgb, var(--ta) 14%, transparent) 100%); }
.gv-bg { position: absolute; inset: -60px; background-size: cover; background-position: center; filter: blur(40px) brightness(.35) saturate(1.3); transform: scale(1.1); }
.gv-bg-enter-active, .gv-bg-leave-active { transition: opacity .6s; }
.gv-bg-enter-from, .gv-bg-leave-to { opacity: 0; }
/* арт вписан в сцену целиком: ни обрезки, ни прокрутки */
.gv-stage { position: absolute; z-index: 1; inset: 56px 70px 104px; }
.gv-slide { position: absolute; inset: 0; }
.gv-img, .gv-ph { position: absolute; inset: 0; margin: auto; max-width: 100%; max-height: 100%; }
.gv-img { border-radius: 8px; box-shadow: 0 0 0 1px var(--gv-line), 0 30px 80px rgba(0, 0, 0, .8); cursor: pointer; opacity: 0; transition: opacity .35s; }
.gv-img.ready { opacity: 1; }
.gv-img.zoomed { cursor: grab; box-shadow: none; border-radius: 0; }
.gv-img.zoomed:active { cursor: grabbing; }
.gv-zoom { display: flex; align-items: center; gap: 2px; margin-right: 10px; padding: 2px; border-radius: 99px; background: rgba(0, 0, 0, .45); border: 1px solid var(--gv-line); }
.gv-zoom button { min-width: 30px; height: 28px; padding: 0 8px; border: 0; border-radius: 99px; background: none; color: var(--gv-txt); font: 800 14px 'Manrope', sans-serif; cursor: pointer; }
.gv-zoom button:hover { background: rgba(255, 255, 255, .08); }
.gv-zoom .lvl { font-size: 11.5px; min-width: 46px; }
.gv-ph { width: 100%; height: 100%; object-fit: contain; filter: blur(6px); opacity: .85; pointer-events: none; }
.gv-spin { position: absolute; left: 50%; top: 50%; width: 42px; height: 42px; margin: -21px; border-radius: 50%; border: 3px solid rgba(255, 255, 255, .15); border-top-color: var(--gv-acc); animation: gv-spin .9s linear infinite; pointer-events: none; }
@keyframes gv-spin { to { transform: rotate(360deg); } }
.gv-next-enter-active, .gv-next-leave-active, .gv-prev-enter-active, .gv-prev-leave-active { transition: transform .45s cubic-bezier(.2, .8, .2, 1), opacity .45s; }
.gv-next-enter-from { opacity: 0; transform: translateX(80px) rotate(2deg) scale(.96); }
.gv-next-leave-to { opacity: 0; transform: translateX(-80px) rotate(-2deg) scale(.96); }
.gv-prev-enter-from { opacity: 0; transform: translateX(-80px) rotate(-2deg) scale(.96); }
.gv-prev-leave-to { opacity: 0; transform: translateX(80px) rotate(2deg) scale(.96); }
.gv-top { position: absolute; z-index: 2; top: 0; left: 0; right: 0; display: flex; align-items: center; gap: 12px; padding: 10px 16px; background: linear-gradient(180deg, rgba(0, 0, 0, .55), transparent); }
.gv-name { font: 700 24px 'Cormorant Garamond', Georgia, serif; color: var(--gv-txt); text-shadow: 0 2px 8px #000; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gv-count { color: #c9b88f; font-size: 13px; font-weight: 700; }
.grow { flex: 1; }
.gv-dl { color: var(--gv-txt); font-weight: 800; font-size: 13px; }
.gv-x { border: 0; background: none; color: #efe3c8; font-size: 38px; line-height: 1; cursor: pointer; }
.gv-nav { position: absolute; z-index: 2; top: 50%; transform: translateY(-50%); width: 50px; height: 50px; border-radius: 50%; border: 1px solid var(--gv-line); background: rgba(20, 15, 10, .7); color: var(--gv-txt); font-size: 32px; line-height: 1; cursor: pointer; transition: background .2s, transform .2s; }
.gv-nav:hover { background: color-mix(in srgb, var(--gv-acc) 25%, transparent); transform: translateY(-50%) scale(1.08); }
.prev { left: 12px; } .next { right: 12px; }
.gv-strip { position: absolute; z-index: 2; left: 0; right: 0; bottom: 14px; display: flex; gap: 8px; padding: 6px 16px; overflow-x: auto; scrollbar-width: none; justify-content: safe center; }
.gv-strip::-webkit-scrollbar { display: none; }
.gv-th { flex: none; width: 64px; height: 76px; padding: 0; border-radius: 8px; overflow: hidden; border: 2px solid transparent; background: #120e09; cursor: pointer; opacity: .55; transition: opacity .2s, transform .2s, border-color .2s; }
.gv-th img { width: 100%; height: 100%; object-fit: cover; }
.gv-th:hover { opacity: .9; }
.gv-th.on { opacity: 1; border-color: var(--gv-acc); transform: translateY(-4px); box-shadow: 0 6px 16px rgba(0, 0, 0, .6); }
@keyframes gv-in { from { opacity: 0; } }
@media (max-width: 640px) {
  .gv-stage { inset: 52px 0 100px; }
  .gv-img { border-radius: 0; }
  .gv-strip { bottom: 8px; }
  .gv-nav { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .gv-next-enter-active, .gv-next-leave-active, .gv-prev-enter-active, .gv-prev-leave-active, .gv-bg-enter-active, .gv-bg-leave-active { transition: none; }
}
</style>
