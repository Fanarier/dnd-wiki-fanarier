<template>
  <!-- мерцающие искры за текстом общих страниц магии; у мыши звёзды тянутся к ней линиями -->
  <div ref="box" class="msp" aria-hidden="true" />
</template>

<script setup>
// tsParticles (MIT) — грузится только здесь, отдельным куском, когда открыли страницу магии
import { onBeforeUnmount, onMounted, ref } from 'vue'

const box = ref(null)
let container = null, ro = null, dead = false
const still = matchMedia('(prefers-reduced-motion: reduce)').matches

// как у MagicBackdrop: слой закреплён на экране, но только над колонкой статьи
function place() {
  const el = box.value
  if (!el?.parentElement) return
  const r = el.parentElement.getBoundingClientRect()
  el.style.left = r.left + 'px'
  el.style.width = r.width + 'px'
}

onMounted(async () => {
  place()
  ro = new ResizeObserver(place)
  ro.observe(box.value.parentElement)
  window.addEventListener('resize', place)
  const [{ tsParticles }, { loadSlim }] = await Promise.all([import('@tsparticles/engine'), import('@tsparticles/slim')])
  await loadSlim(tsParticles)
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
  ro?.disconnect()
  window.removeEventListener('resize', place)
  container?.destroy()
})
</script>

<style scoped>
.msp { position: fixed; top: 64px; left: 0; width: 100%; height: calc(100% - 64px); z-index: -1; pointer-events: none; animation: msp-in 1.2s ease both; }
.msp :deep(canvas) { pointer-events: none !important; }
@keyframes msp-in { from { opacity: 0; } }
</style>
