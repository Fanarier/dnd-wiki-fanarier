<template>
  <!-- живой фон вики (кроме страниц магии — у них свой): косые лучи света из окна, пылинки в них, тёплое мерцание свечей по краям -->
  <div class="wa" aria-hidden="true">
    <i v-for="r in 3" :key="'r' + r" class="wa-ray" :style="{ '--r': r }" />
    <i v-for="(m, k) in motes" :key="'m' + k" class="wa-mote" :style="m" />
    <i class="wa-candle l" />
    <i class="wa-candle r" />
  </div>
</template>

<script setup>
// пылинки: место, размер, скорость — случайные, но один раз на показ
const rnd = (a, b) => a + Math.random() * (b - a)
const motes = Array.from({ length: 26 }, () => {
  const size = rnd(1.5, 3.5) + 'px'
  return { left: rnd(8, 70) + '%', top: rnd(5, 95) + '%', width: size, height: size, animationDuration: rnd(14, 30) + 's', animationDelay: -rnd(0, 30) + 's', opacity: rnd(0.25, 0.7) }
})
</script>

<style scoped>
.wa { position: fixed; inset: 64px 0 0; z-index: -1; pointer-events: none; overflow: hidden; }
.wa-ray { position: absolute; top: -20%; left: calc(8% + var(--r) * 13%); width: 9%; height: 140%; transform: rotate(24deg); transform-origin: top; background: linear-gradient(180deg, rgba(255, 228, 160, .07), rgba(255, 228, 160, .02) 60%, transparent); filter: blur(6px); animation: wa-ray 11s ease-in-out infinite alternate; animation-delay: calc(var(--r) * -3.7s); }
.wa-mote { position: absolute; border-radius: 50%; background: #ffe9b8; box-shadow: 0 0 6px rgba(255, 220, 150, .8); animation: wa-drift linear infinite; }
.wa-candle { position: absolute; bottom: -120px; width: 420px; height: 420px; border-radius: 50%; background: radial-gradient(closest-side, rgba(255, 170, 70, .13), transparent); animation: wa-flicker 2.8s ease-in-out infinite; }
.wa-candle.l { left: -140px; }
.wa-candle.r { right: -140px; animation-delay: -1.3s; animation-duration: 3.4s; }
@keyframes wa-ray { from { opacity: .55; transform: rotate(22deg) translateX(-10px); } to { opacity: 1; transform: rotate(26deg) translateX(14px); } }
@keyframes wa-drift { 0% { transform: translate(0, 0); } 25% { transform: translate(14px, -22px); } 50% { transform: translate(-6px, -48px); } 75% { transform: translate(10px, -30px); } 100% { transform: translate(0, 0); } }
@keyframes wa-flicker { 0%, 100% { opacity: .8; transform: scale(1); } 20% { opacity: 1; transform: scale(1.04); } 45% { opacity: .65; } 70% { opacity: .95; transform: scale(.97); } }
@media (prefers-reduced-motion: reduce) { .wa-ray, .wa-mote, .wa-candle { animation: none; } }
@media (max-width: 700px) { .wa-mote:nth-child(n+16) { display: none; } }
</style>
