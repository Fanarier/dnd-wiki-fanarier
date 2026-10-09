<template>
  <!-- мерцающие искры за текстом общих страниц магии; у мыши звёзды тянутся к ней линиями -->
  <div ref="box" class="msp" aria-hidden="true" />
</template>

<script>
// движок с плагинами настраиваем один раз на всю страницу: повторный loadSlim() после первого load() падает,
// и при втором заходе на страницу магии искр не было до F5
let engine = null
function getEngine() {
  engine ||= Promise.all([import('@tsparticles/engine'), import('@tsparticles/slim')])
    .then(async ([{ tsParticles }, { loadSlim }]) => { await loadSlim(tsParticles); return tsParticles })
    .catch(e => { engine = null; throw e })
  return engine
}
</script>

<script setup>
// tsParticles (MIT) — грузится только здесь, отдельным куском, когда открыли страницу магии
import { onBeforeUnmount, onMounted, ref } from 'vue'

const box = ref(null)
let container = null, dead = false
const still = matchMedia('(prefers-reduced-motion: reduce)').matches

onMounted(async () => {
  const tsParticles = await getEngine()
  if (dead) return
  container = await tsParticles.load({
    element: box.value,
    options: {
      fullScreen: { enable: false },
      background: { color: 'transparent' },
      fpsLimit: 40,
      detectRetina: true,
      pauseOnBlur: true,
      pauseOnOutsideViewport: true,
      particles: {
        number: { value: 70, density: { enable: true } },
        color: { value: ['#cfc2ff', '#9fd8ff', '#ffe9b0', '#ffffff'] },
        shape: { type: ['circle', 'star'] },
        opacity: { value: { min: 0.3, max: 1 }, animation: { enable: !still, speed: 0.6, sync: false } },
        size: { value: { min: 1, max: 3.2 } },
        move: { enable: !still, speed: 0.35, direction: 'top', random: true, straight: false, outModes: { default: 'out' } },
        links: { enable: false }
      },
      interactivity: {
        detectsOn: 'window',
        events: { onHover: { enable: !still, mode: 'grab' } },
        modes: { grab: { distance: 150, links: { opacity: 0.6, color: '#b9a6ff' } } }
      }
    }
  })
  if (dead) container?.destroy()
})

onBeforeUnmount(() => {
  dead = true
  container?.destroy()
})
</script>

<style scoped>
.msp { position: fixed; top: 64px; left: 0; right: 0; bottom: 0; z-index: -1; pointer-events: none; animation: msp-in 1.2s ease both; }
.msp :deep(canvas) { pointer-events: none !important; }
@keyframes msp-in { from { opacity: 0; } }
</style>
