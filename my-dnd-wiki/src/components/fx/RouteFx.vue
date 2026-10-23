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
    <!-- активность: ночь, искра падает на поленья, костёр вспыхивает, искры летят вверх, тёплый свет заливает экран -->
    <template v-else-if="routeFx.kind === 'activity'">
      <i class="rf-night" />
      <i class="rf-light" />
      <div class="rf-camp">
        <i class="rf-log a" /><i class="rf-log b" />
        <!-- пламя: языки с острыми верхушками, каждый разгорается и дрожит по-своему -->
        <svg class="rf-fire" viewBox="-60 -150 120 160" aria-hidden="true">
          <defs>
            <radialGradient id="rf-fl-o" cx="50%" cy="85%" r="75%"><stop offset="0" stop-color="#ffd25a" /><stop offset=".45" stop-color="#ff8a1e" /><stop offset="1" stop-color="#d8380c" stop-opacity=".9" /></radialGradient>
            <radialGradient id="rf-fl-m" cx="50%" cy="85%" r="70%"><stop offset="0" stop-color="#fff3b0" /><stop offset=".5" stop-color="#ffc23a" /><stop offset="1" stop-color="#ff7a1a" /></radialGradient>
            <radialGradient id="rf-fl-c" cx="50%" cy="80%" r="65%"><stop offset="0" stop-color="#ffffff" /><stop offset=".6" stop-color="#fff2b8" /><stop offset="1" stop-color="#ffd36b" stop-opacity="0" /></radialGradient>
          </defs>
          <path class="fl f1" fill="url(#rf-fl-o)" d="M0 0 C-34 0 -50 -26 -42 -56 C-36 -78 -20 -86 -24 -112 C-10 -98 -6 -88 -6 -76 C2 -96 0 -122 10 -146 C20 -116 32 -100 34 -78 C40 -86 42 -96 40 -106 C56 -80 54 -40 42 -20 C34 -6 18 0 0 0 Z" />
          <path class="fl f2" fill="url(#rf-fl-m)" d="M0 -2 C-24 -2 -34 -20 -28 -42 C-24 -58 -12 -64 -14 -84 C-4 -74 0 -64 0 -56 C6 -72 8 -92 16 -106 C22 -84 30 -68 28 -48 C34 -54 36 -62 34 -70 C44 -48 40 -24 30 -12 C22 -4 12 -2 0 -2 Z" />
          <path class="fl f3" fill="url(#rf-fl-c)" d="M0 -4 C-14 -4 -20 -16 -16 -30 C-12 -42 -4 -48 -2 -62 C6 -50 10 -40 12 -30 C16 -18 12 -4 0 -4 Z" />
        </svg>
        <i class="rf-spark" />
        <i v-for="e in EMBERS" :key="e.k" class="rf-ember" :style="e.style" />
      </div>
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
const COVER = { map: 420, wiki: 460, sheets: 440, activity: 520 }
const REVEAL = { map: 900, wiki: 950, sheets: 900, activity: 1350 }
// костёр: искры разлетаются вверх веером, каждая со своей скоростью
const EMBERS = Array.from({ length: 22 }, (_, k) => {
  const a = -Math.PI / 2 + ((k % 11) - 5) * 0.16 + (k > 10 ? 0.08 : 0)
  const v = 26 + (k * 37) % 30
  return { k, style: { '--ex': (Math.cos(a) * v).toFixed(1) + 'vh', '--ey': (Math.sin(a) * v).toFixed(1) + 'vh', '--d': (0.18 + (k % 6) * 0.05).toFixed(2) + 's', '--s': (0.6 + (k % 4) * 0.25).toFixed(2) } }
})
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
const SOUND = { map: null, wiki: ['bookOpen', 0.45], sheets: ['pageFlip', 0.45], activity: ['campfire', 0.7] }
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

/* ---------- активность: костёр ---------- */
.rf-night { inset: 0;
  background:
    radial-gradient(1px 1px at 18% 16%, #fffc, transparent), radial-gradient(1px 1px at 72% 10%, #fffb, transparent),
    radial-gradient(1.5px 1.5px at 44% 24%, #ffe9c4, transparent), radial-gradient(1px 1px at 86% 34%, #fff9, transparent),
    radial-gradient(1px 1px at 30% 38%, #fff8, transparent), radial-gradient(1.5px 1.5px at 60% 14%, #fffa, transparent),
    radial-gradient(ellipse 80% 45% at 50% 100%, #2a1608, transparent 70%),
    linear-gradient(180deg, #05060d, #0b0810 60%, #140b06); }
.rf.activity.cover .rf-night { animation: rf-fade-in .45s ease-out both; }
.rf.activity.reveal .rf-night { animation: rf-fade-out .6s ease-in .62s both; }
.rf-camp { left: 50%; top: 62%; width: 0; height: 0; }
.rf.activity.cover .rf-camp { animation: rf-fade-in .4s ease-out .1s both; }
.rf.activity.reveal .rf-camp { animation: rf-camp-out .55s ease-in .75s both; }
.rf-log { border-radius: 14px; background: linear-gradient(180deg, #6b4223, #3d2412 70%, #24150a); box-shadow: inset 0 -4px 6px rgba(0, 0, 0, .5), 0 6px 14px rgba(0, 0, 0, .6); }
.rf-log::after { content: ''; position: absolute; right: 4px; top: 3px; width: 18px; height: 18px; border-radius: 50%; background: radial-gradient(circle, #c48a52 25%, #7a4c26 30%, #a06a3a 45%, #5a3518 70%); }
.rf-log.a { transform: rotate(16deg); }
.rf-log.b { transform: rotate(-16deg) scaleX(-1); }
/* пламя (svg): языки растут от поленьев и дрожат — у каждого своя частота */
.rf-fire { position: absolute; left: -105px; top: -262px; width: 210px; height: 280px; overflow: visible; filter: drop-shadow(0 0 18px rgba(255, 140, 40, .75)); }
.rf-fire .fl { transform-box: fill-box; transform-origin: 50% 100%; transform: scale(0); opacity: 0; mix-blend-mode: screen; }
.rf.activity.reveal .rf-fire .f1 { animation: rf-ignite .5s cubic-bezier(.2, 1.4, .4, 1) .02s both, rf-flicker .26s ease-in-out .52s infinite alternate; }
.rf.activity.reveal .rf-fire .f2 { animation: rf-ignite .45s cubic-bezier(.2, 1.5, .4, 1) .08s both, rf-flicker2 .19s ease-in-out .53s infinite alternate; }
.rf.activity.reveal .rf-fire .f3 { animation: rf-ignite .4s cubic-bezier(.2, 1.6, .4, 1) .12s both, rf-flicker .15s ease-in-out .52s infinite alternate; }
.rf-log { left: -110px; width: 220px; height: 28px; top: -10px; }
/* искра: падает с неба на поленья (пока закрывается экран) */
.rf-spark { left: -4px; top: -4px; width: 8px; height: 8px; border-radius: 50%; background: #fff3b0; box-shadow: 0 0 12px 4px rgba(255, 170, 60, .9); opacity: 0; }
.rf.activity.cover .rf-spark { animation: rf-spark-fall .5s cubic-bezier(.5, 0, .9, .6) .05s both; }
/* свет костра: вспыхивает и заливает экран — под ним открывается страница */
.rf-light { left: 50%; top: 62%; width: 60vmax; height: 60vmax; margin: -30vmax 0 0 -30vmax; border-radius: 50%; opacity: 0;
  background: radial-gradient(closest-side, rgba(255, 214, 140, .95), rgba(255, 150, 60, .55) 45%, rgba(255, 110, 40, .15) 75%, transparent); }
.rf.activity.reveal .rf-light { animation: rf-flood 1.25s cubic-bezier(.3, .1, .3, 1) .12s both; }
.rf-ember { left: -3px; top: -110px; width: calc(5px * var(--s)); height: calc(5px * var(--s)); border-radius: 50%; background: #ffd27a; box-shadow: 0 0 8px 2px rgba(255, 140, 40, .85); opacity: 0; }
.rf.activity.reveal .rf-ember { animation: rf-ember 1s cubic-bezier(.2, .7, .4, 1) var(--d) both; }
@keyframes rf-spark-fall { 0% { transform: translate(-6vw, -48vh) scale(.6); opacity: 0; } 15% { opacity: 1; } 90% { opacity: 1; } 100% { transform: translate(0, -10px) scale(1.4); opacity: 1; } }
@keyframes rf-ignite { 0% { transform: scale(0, 0); opacity: 0; } 60% { opacity: 1; } 100% { transform: scale(1, 1); opacity: 1; } }
@keyframes rf-flicker { from { transform: scale(1, 1) skewX(-4deg); } to { transform: scale(1.05, .93) skewX(4deg); } }
@keyframes rf-flicker2 { from { transform: scale(.96, 1.06) skewX(3deg); } to { transform: scale(1.04, .95) skewX(-5deg); } }
@keyframes rf-flood { 0% { transform: scale(.05); opacity: 0; } 25% { transform: scale(.45); opacity: 1; } 70% { transform: scale(2.4); opacity: .85; } 100% { transform: scale(4); opacity: 0; } }
@keyframes rf-ember { 0% { transform: translate(0, 0) scale(1); opacity: 0; } 15% { opacity: 1; } 100% { transform: translate(var(--ex), var(--ey)) scale(.2); opacity: 0; } }
@keyframes rf-camp-out { to { transform: scale(1.5) translateY(-20px); opacity: 0; } }

@keyframes rf-fade-in { from { opacity: 0; } }
@keyframes rf-fade-out { to { opacity: 0; } }
</style>
