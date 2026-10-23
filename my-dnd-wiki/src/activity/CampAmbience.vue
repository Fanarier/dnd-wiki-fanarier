<template>
  <!-- живой фон «Активности»: снизу дышит тёплый отсвет костра, вверх летят и гаснут искры, сверху — ночное небо со звёздами -->
  <div class="ca" aria-hidden="true">
    <i class="ca-sky" />
    <i class="ca-glow" />
    <i v-for="(e, k) in embers" :key="k" class="ca-ember" :style="e" />
  </div>
</template>

<script setup>
// искры: откуда взлетают, куда сносит, скорость — случайные, но один раз на показ
const rnd = (a, b) => a + Math.random() * (b - a)
const embers = Array.from({ length: 22 }, () => {
  const size = rnd(2, 4.5) + 'px'
  return {
    left: rnd(20, 80) + '%', width: size, height: size, '--dx': rnd(-120, 120) + 'px', '--h': rnd(45, 85) + 'vh',
    animationDuration: rnd(6, 13) + 's', animationDelay: -rnd(0, 13) + 's'
  }
})
</script>

<style scoped>
.ca { position: fixed; inset: 64px 0 0; z-index: -1; pointer-events: none; overflow: hidden; }
.ca-sky { position: absolute; inset: 0; opacity: .7;
  background:
    radial-gradient(1px 1px at 14% 12%, #fff9, transparent), radial-gradient(1px 1px at 68% 8%, #fff8, transparent),
    radial-gradient(1.5px 1.5px at 42% 22%, #ffe9c499, transparent), radial-gradient(1px 1px at 88% 30%, #fff7, transparent),
    radial-gradient(1px 1px at 26% 40%, #fff5, transparent), radial-gradient(1.5px 1.5px at 78% 18%, #fff6, transparent);
  animation: ca-twinkle 5s ease-in-out infinite alternate; }
.ca-glow { position: absolute; left: 50%; bottom: -320px; width: 1100px; height: 620px; margin-left: -550px; border-radius: 50%;
  background: radial-gradient(closest-side, rgba(255, 140, 50, .2), rgba(255, 90, 30, .08) 55%, transparent); animation: ca-breathe 2.6s ease-in-out infinite; }
.ca-ember { position: absolute; bottom: -10px; border-radius: 50%; background: #ffcf7a; box-shadow: 0 0 8px 2px rgba(255, 140, 40, .75); opacity: 0; animation: ca-rise linear infinite; }
@keyframes ca-rise {
  0% { transform: translate(0, 0) scale(1); opacity: 0; }
  10% { opacity: .95; }
  60% { opacity: .7; }
  100% { transform: translate(var(--dx), calc(-1 * var(--h))) scale(.3); opacity: 0; }
}
@keyframes ca-breathe { 0%, 100% { opacity: .85; transform: scale(1); } 30% { opacity: 1; transform: scale(1.04); } 60% { opacity: .7; transform: scale(.97); } }
@keyframes ca-twinkle { from { opacity: .45; } to { opacity: .8; } }
@media (prefers-reduced-motion: reduce) { .ca-glow, .ca-ember, .ca-sky { animation: none; } .ca-ember { display: none; } }
@media (max-width: 700px) { .ca-ember:nth-child(n+14) { display: none; } }
</style>
