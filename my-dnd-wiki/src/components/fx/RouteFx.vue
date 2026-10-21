<template>
  <!-- переход между Картой, Вики и Листами — у каждого свой: на Карту туман накатывает и расходится, открывая мир;
       в Вики кожаная книга захлопывается и раскрывается на весь экран; в Листы листы персонажей слетаются в стопку
       и разлетаются веером. Пока экран закрыт — грузится новая страница -->
  <div v-if="routeFx.phase" class="rf" :class="[routeFx.kind, routeFx.phase]" aria-hidden="true">
    <!-- карта: облака -->
    <template v-if="routeFx.kind === 'map'">
      <i class="rf-veil" />
      <i v-for="c in CLOUDS" :key="c.k" class="rf-cloud" :style="c.style" />
      <i class="rf-sun" />
    </template>
    <!-- вики: книга -->
    <template v-else-if="routeFx.kind === 'wiki'">
      <i class="rf-spine" />
      <div class="rf-cover l"><div class="rf-tool"><span class="rf-corner tl" /><span class="rf-corner bl" /></div><svg class="rf-sigil" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" stroke-width="1.2" /><path d="M16 3 L19 16 L16 29 L13 16 Z" fill="currentColor" /><path d="M3 16 L16 13.5 L29 16 L16 18.5 Z" fill="currentColor" opacity=".55" /></svg></div>
      <div class="rf-cover r"><div class="rf-tool"><span class="rf-corner tr" /><span class="rf-corner br" /></div><svg class="rf-sigil" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" stroke-width="1.2" /><path d="M16 3 L19 16 L16 29 L13 16 Z" fill="currentColor" /><path d="M3 16 L16 13.5 L29 16 L16 18.5 Z" fill="currentColor" opacity=".55" /></svg></div>
    </template>
    <!-- листы: веер -->
    <template v-else>
      <i class="rf-veil" />
      <div v-for="c in CARDS" :key="c.k" class="rf-card" :style="c.style"><b /><i /><i /><i /><i /></div>
    </template>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { routeFx, sectionOf, reducedMotion } from './routeFx.js'
import { sfx } from '../../sound/sound.js'

const router = useRouter()
const COVER = { map: 420, wiki: 460, sheets: 440 }
const REVEAL = { map: 900, wiki: 950, sheets: 900 }
// облака: откуда приплывают и куда расходятся (направление от центра)
// облака: гряда из клубов разного размера, каждый со своей стороны и своим местом в гряде
const CLOUDS = Array.from({ length: 14 }, (_, k) => {
  const a = (k / 14) * Math.PI * 2 + 0.3
  const r = k % 2 ? 0.55 : 0.25 // ближе к центру и дальше
  return { k, style: { '--dx': Math.cos(a).toFixed(2), '--dy': Math.sin(a).toFixed(2), '--r': r, '--s': (0.55 + (k % 4) * 0.18).toFixed(2), '--d': (k * 0.022).toFixed(3) + 's' } }
})
// листы: где ложатся в веер и куда улетают
const CARDS = Array.from({ length: 7 }, (_, k) => {
  const t = k - 3
  return { k, style: { '--t': t, '--d': (Math.abs(t) * 0.035).toFixed(3) + 's', '--rot': (t * 11) + 'deg', '--in': (k % 2 ? -1 : 1) * (40 + k * 6) + 'vw' } }
})
// карта: один порыв ветра на весь переход (звучит с начала, пока облака накатывают и расходятся)
const SOUND = { map: null, wiki: ['bookOpen', 0.45], sheets: ['pageFlip', 0.45] }
// номер текущего перехода: таймеры прошлого перехода (если успели переключиться дальше) ничего не трогают
let seq = 0

onMounted(() => {
  router.beforeEach((to, from) => {
    const a = sectionOf(from.path), b = sectionOf(to.path)
    // пока прошлая заставка раскрывается — новая всё равно играет; во время закрытия экрана ждём её конца
    if (!from.matched.length || !a || !b || a === b || reducedMotion() || routeFx.phase === 'cover') { routeFx.from = a || ''; return true }
    const my = ++seq
    routeFx.from = a
    routeFx.kind = b
    routeFx.phase = ''
    // кадр без заставки, чтобы анимации новой начались с начала
    requestAnimationFrame(() => { if (my === seq) routeFx.phase = 'cover' })
    setTimeout(() => { if (my === seq && !routeFx.phase) routeFx.phase = 'cover' }, 30)
    if (b === 'wiki') sfx('bookClose', 0.3)
    if (b === 'map') sfx('cloudWhoosh', 0.5)
    return new Promise(res => setTimeout(() => res(true), COVER[b]))
  })
  router.afterEach((to, from, failure) => {
    if (failure || routeFx.phase !== 'cover') return
    const kind = routeFx.kind, my = seq
    // карте нужно чуть больше времени, чтобы нарисоваться под облаками
    setTimeout(() => {
      if (my !== seq) return
      routeFx.phase = 'reveal'
      if (SOUND[kind]) sfx(...SOUND[kind])
      setTimeout(() => { if (my === seq && routeFx.phase === 'reveal') routeFx.phase = '' }, REVEAL[kind])
    }, kind === 'map' ? 320 : 90)
  })
  router.onError(() => { routeFx.phase = '' })
})
</script>

<style scoped>
.rf { position: fixed; inset: 0; z-index: 2000; pointer-events: all; overflow: hidden; }
.rf.reveal { pointer-events: none; }
.rf i, .rf div { position: absolute; }

/* ---------- карта: туман ---------- */
.rf-veil { inset: 0; background: radial-gradient(ellipse at 50% 45%, #2a3550, #0c1018 75%); }
.rf.map.cover .rf-veil { animation: rf-fade-in .42s ease-out both; }
.rf.map.reveal .rf-veil { animation: rf-fade-out .7s ease-in .15s both; }
.rf-cloud { left: 50%; top: 50%; width: calc(70vmax * var(--s)); height: calc(46vmax * var(--s)); margin: calc(-23vmax * var(--s)) 0 0 calc(-35vmax * var(--s)); border-radius: 50%;
  background:
    radial-gradient(closest-side at 40% 38%, rgba(255, 255, 255, .95), transparent 70%),
    radial-gradient(closest-side at 62% 55%, rgba(225, 233, 246, .9), transparent 75%),
    radial-gradient(closest-side, rgba(200, 212, 232, .85), rgba(120, 140, 175, .55) 70%, rgba(80, 100, 140, 0) 100%);
  filter: blur(10px); }
.rf.map.cover .rf-cloud { animation: rf-cloud-in .42s cubic-bezier(.2, .7, .3, 1) var(--d) both; }
.rf.map.reveal .rf-cloud { animation: rf-cloud-out .9s cubic-bezier(.5, 0, .3, 1) var(--d) both; }
.rf-sun { left: 50%; top: 50%; width: 30vmax; height: 30vmax; margin: -15vmax 0 0 -15vmax; border-radius: 50%; background: radial-gradient(closest-side, rgba(255, 236, 180, .55), transparent); opacity: 0; }
.rf.map.reveal .rf-sun { animation: rf-sun .9s ease-out both; }
@keyframes rf-cloud-in { from { transform: translate(calc(var(--dx) * 95vw), calc(var(--dy) * 85vh)) scale(.6); opacity: 0; } to { transform: translate(calc(var(--dx) * var(--r) * 60vw), calc(var(--dy) * var(--r) * 55vh)) scale(1); opacity: 1; } }
@keyframes rf-cloud-out { from { transform: translate(calc(var(--dx) * var(--r) * 60vw), calc(var(--dy) * var(--r) * 55vh)) scale(1); opacity: 1; } to { transform: translate(calc(var(--dx) * 115vw), calc(var(--dy) * 100vh)) scale(1.6); opacity: 0; } }
@keyframes rf-sun { 0% { opacity: 0; transform: scale(.4); } 30% { opacity: 1; } 100% { opacity: 0; transform: scale(3); } }

/* ---------- вики: книга ---------- */
.rf.wiki { perspective: 1800px; }
.rf-cover { top: 0; bottom: 0; width: 50%; display: grid; place-items: center; color: #e7c56f; overflow: hidden;
  background:
    radial-gradient(ellipse at 30% 25%, rgba(255, 220, 170, .08), transparent 55%),
    repeating-linear-gradient(37deg, rgba(0, 0, 0, .05) 0 2px, transparent 2px 5px),
    linear-gradient(135deg, #5a2f1c, #3a1d10 55%, #2a140a);
  box-shadow: inset 0 0 120px rgba(0, 0, 0, .65); backface-visibility: hidden; }
.rf-cover.l { left: 0; transform-origin: left center; border-right: 2px solid #1b0d06; }
.rf-cover.r { right: 0; transform-origin: right center; border-left: 2px solid #1b0d06; }
.rf-tool { inset: 26px; border: 2px solid rgba(231, 197, 111, .55); border-radius: 6px; box-shadow: inset 0 0 0 6px rgba(0, 0, 0, .18), inset 0 0 0 8px rgba(231, 197, 111, .3); }
.rf-corner { position: absolute; width: 46px; height: 46px; border: 2px solid rgba(231, 197, 111, .7); }
.rf-corner.tl { left: 10px; top: 10px; border-right: 0; border-bottom: 0; } .rf-corner.bl { left: 10px; bottom: 10px; border-right: 0; border-top: 0; }
.rf-corner.tr { right: 10px; top: 10px; border-left: 0; border-bottom: 0; } .rf-corner.br { right: 10px; bottom: 10px; border-left: 0; border-top: 0; }
/* половинки знака на стыке обложек — вместе один знак */
.rf-sigil { position: absolute; top: 50%; width: 22vmin; height: 22vmin; margin-top: -11vmin; filter: drop-shadow(0 0 12px rgba(231, 197, 111, .55)); }
.rf-cover.l .rf-sigil { right: -11vmin; }
.rf-cover.r .rf-sigil { left: -11vmin; }
.rf-spine { left: 50%; top: 0; bottom: 0; width: 6px; margin-left: -3px; z-index: 2; background: linear-gradient(90deg, transparent, rgba(255, 210, 120, .9), transparent); opacity: 0; filter: blur(1px); }
.rf.wiki.cover .rf-cover.l { animation: rf-shut-l .46s cubic-bezier(.4, 0, .6, 1) both; }
.rf.wiki.cover .rf-cover.r { animation: rf-shut-r .46s cubic-bezier(.4, 0, .6, 1) both; }
.rf.wiki.reveal .rf-cover.l { animation: rf-open-l .95s cubic-bezier(.6, 0, .2, 1) .08s both; }
.rf.wiki.reveal .rf-cover.r { animation: rf-open-r .95s cubic-bezier(.6, 0, .2, 1) .08s both; }
.rf.wiki.reveal .rf-spine { animation: rf-spine .5s ease-out both; }
@keyframes rf-shut-l { from { transform: rotateY(-100deg); filter: brightness(.4); } to { transform: none; } }
@keyframes rf-shut-r { from { transform: rotateY(100deg); filter: brightness(.4); } to { transform: none; } }
@keyframes rf-open-l { to { transform: rotateY(-105deg); filter: brightness(.35); } }
@keyframes rf-open-r { to { transform: rotateY(105deg); filter: brightness(.35); } }
@keyframes rf-spine { 0% { opacity: 0; } 30% { opacity: 1; width: 30px; margin-left: -15px; } 100% { opacity: 0; width: 120px; margin-left: -60px; } }

/* ---------- листы: веер ---------- */
.rf.sheets .rf-veil { background: radial-gradient(ellipse at 50% 55%, #2a2016, #0d0a07 75%); }
.rf.sheets.cover .rf-veil { animation: rf-fade-in .44s ease-out both; }
.rf.sheets.reveal .rf-veil { animation: rf-fade-out .6s ease-in .25s both; }
.rf-card { left: 50%; top: 50%; width: 190px; height: 260px; margin: -130px 0 0 -95px; border-radius: 10px; padding: 18px 16px; box-sizing: border-box;
  background: linear-gradient(170deg, #f1e3c2, #d8c39a); border: 2px solid #b8893f; box-shadow: 0 0 0 3px #3a2a16, 0 18px 40px rgba(0, 0, 0, .6); display: grid; align-content: start; gap: 10px; }
.rf-card b { display: block; width: 58px; height: 58px; border-radius: 50%; border: 2px solid #8a6630; background: radial-gradient(circle at 40% 35%, #c9a46a, #7a5528); }
.rf-card i { position: static; display: block; height: 5px; border-radius: 3px; background: rgba(90, 60, 25, .35); }
.rf-card i:nth-of-type(2) { width: 70%; } .rf-card i:nth-of-type(4) { width: 55%; }
.rf.sheets.cover .rf-card { animation: rf-card-in .44s cubic-bezier(.2, .8, .3, 1.15) var(--d) both; }
.rf.sheets.reveal .rf-card { animation: rf-card-out .9s cubic-bezier(.4, 0, .2, 1) var(--d) both; }
@keyframes rf-card-in { from { transform: translate(var(--in), 70vh) rotate(calc(var(--rot) * 3)); opacity: 0; } to { transform: rotate(calc(var(--t) * 2deg)); opacity: 1; } }
@keyframes rf-card-out {
  0% { transform: rotate(calc(var(--t) * 2deg)); }
  40% { transform: translate(calc(var(--t) * 120px), -30px) rotate(var(--rot)); opacity: 1; }
  100% { transform: translate(calc(var(--t) * 34vw), -70vh) rotate(calc(var(--rot) * 2.5)); opacity: 0; }
}

@keyframes rf-fade-in { from { opacity: 0; } }
@keyframes rf-fade-out { to { opacity: 0; } }
</style>
