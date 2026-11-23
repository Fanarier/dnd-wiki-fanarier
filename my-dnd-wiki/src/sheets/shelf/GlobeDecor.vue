<template>
  <!-- глобус: медленно вращается сам, щелчок — раскрутить, можно крутить мышью или пальцем -->
  <svg class="gl" width="86" height="124" viewBox="0 0 86 124" aria-hidden="true">
    <defs>
      <clipPath :id="id + 'c'"><circle cx="43" cy="52" r="28" /></clipPath>
      <!-- края шара темнее и материки там сжаты: так плоская карта читается как шар -->
      <radialGradient :id="id + 'r'" cx=".5" cy=".5" r=".5"><stop offset=".55" stop-color="#000" stop-opacity="0" /><stop offset="1" stop-color="#000" stop-opacity=".55" /></radialGradient>
    </defs>
    <ellipse cx="43" cy="121.6" rx="34" ry="3.2" fill="url(#bk-shadow)" />
    <path d="M24 122 H62 Q62 116 56 113 H30 Q24 116 24 122 Z" fill="url(#bk-wood-h)" /><path d="M24 122 H62 Q62 116 56 113 H30 Q24 116 24 122 Z" fill="url(#bk-woodgrain)" opacity=".5" />
    <ellipse cx="43" cy="113" rx="13" ry="2.4" fill="#8a5c34" />
    <path d="M40 113 V100 Q37 96 40 92 H46 Q49 96 46 100 V113 Z" fill="url(#bk-wood-h)" />
    <g transform="rotate(-23 43 52)">
      <path d="M43 18 A34 34 0 0 1 43 86" fill="none" stroke="#000" stroke-opacity=".4" stroke-width="5" transform="translate(1.5 1)" />
      <line x1="43" y1="16" x2="43" y2="88" stroke="url(#bk-brass-h)" stroke-width="2" />
    </g>
    <g class="gl-hit" role="button" tabindex="0" @mousedown.prevent aria-label="Раскрутить глобус" @pointerdown="down" @keydown.enter.prevent="kick(1)" @keydown.space.prevent="kick(1)">
      <title>Щёлкни или потяни, чтобы раскрутить</title>
      <circle cx="43" cy="52" r="28" fill="#2c5866" />
      <circle cx="43" cy="52" r="28" fill="url(#bk-mottle)" opacity=".6" />
      <g :clip-path="`url(#${id}c)`">
        <g transform="rotate(-23 43 52)">
          <g :transform="`translate(${shift.toFixed(2)} 0)`">
            <g v-for="k in [-1, 0, 1]" :key="k" :transform="`translate(${k * BAND} 0)`" fill="#c2a46c" opacity=".88" stroke="#7a5a2e" stroke-width=".6" stroke-opacity=".7">
              <path d="M22 36 q7 -9 17 -5 q6 3 2 9 q-6 2 -8 9 q-1 7 -6 6 q-6 -6 -5 -19 Z" />
              <path d="M47 30 q9 -4 15 1 q3 5 -3 6 q-6 0 -8 5 q-4 -2 -4 -12 Z" />
              <path d="M48 52 q9 -3 13 4 q1 9 -6 14 q-6 2 -6 -6 q-4 -4 -1 -12 Z" />
              <path d="M28 66 q6 -1 8 4 q-1 5 -6 6 q-4 -4 -2 -10 Z" />
              <path d="M66 70 q5 -2 7 2 q-2 4 -6 3 Z" />
            </g>
          </g>
          <g fill="none" stroke="#1a2c30" stroke-opacity=".45" stroke-width=".6">
            <ellipse cx="43" cy="52" rx="28" ry="7" /><ellipse cx="43" cy="52" rx="28" ry="17" /><line x1="15" y1="52" x2="71" y2="52" />
          </g>
        </g>
      </g>
      <circle cx="43" cy="52" r="28" :fill="`url(#${id}r)`" />
      <circle cx="43" cy="52" r="28" fill="url(#bk-ball)" />
      <ellipse cx="34" cy="40" rx="7" ry="4" fill="#fff" opacity=".16" transform="rotate(-30 34 40)" />
    </g>
    <g transform="rotate(-23 43 52)" pointer-events="none">
      <path d="M43 17 A35 35 0 0 1 43 87" fill="none" stroke="url(#bk-brass-h)" stroke-width="3.2" />
      <circle cx="43" cy="16.4" r="2" fill="url(#bk-brass)" /><circle cx="43" cy="87.6" r="2" fill="url(#bk-brass)" />
    </g>
    <path d="M43 93 Q52.5 93 56.6 86.2" fill="none" stroke="#000" stroke-opacity=".4" stroke-width="4.2" />
    <path d="M43 93 Q52.5 93 56.6 86.2" fill="none" stroke="url(#bk-brass-h)" stroke-width="2.8" stroke-linecap="round" />
    <ellipse cx="43" cy="93" rx="4" ry="1.8" fill="url(#bk-brass)" />
  </svg>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'

// карта — полоса шириной BAND, повторённая трижды: сдвигаем её и заворачиваем по кругу
const BAND = 58
const id = 'gl' + Math.random().toString(36).slice(2, 8)
const shift = ref(0)
const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
const IDLE = reduce ? 0 : 2.2 // сам по себе — едва заметно, px в секунду
let v = IDLE, raf = 0, last = 0, drag = null

function frame(t) {
  const dt = last ? Math.min(0.05, (t - last) / 1000) : 0
  last = t
  if (!drag) {
    // трение: раскрученный глобус плавно возвращается к ленивому вращению
    v = IDLE + (v - IDLE) * Math.pow(0.35, dt)
    shift.value = ((shift.value + v * dt) % BAND + BAND) % BAND
  }
  raf = requestAnimationFrame(frame)
}
function kick(dir) { v += dir * 140 }
function down(e) {
  try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* указатель уже отпущен */ }
  drag = { x: e.clientX, t: performance.now(), moved: 0, vx: 0 }
  const el = e.currentTarget
  const move = ev => {
    const dx = ev.clientX - drag.x, now = performance.now()
    drag.moved += Math.abs(dx)
    drag.vx = dx / Math.max(1, now - drag.t) * 1000
    drag.x = ev.clientX; drag.t = now
    shift.value = ((shift.value + dx * 0.6) % BAND + BAND) % BAND
  }
  const up = () => {
    el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up)
    // просто щелчок — толчок; потянули — глобус крутится с той скоростью, с какой отпустили
    v = drag.moved < 4 ? v + 140 : Math.max(-400, Math.min(400, drag.vx * 0.6))
    drag = null
  }
  el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up)
}
onMounted(() => { raf = requestAnimationFrame(frame) })
onBeforeUnmount(() => cancelAnimationFrame(raf))
</script>

<style scoped>
.gl { display: block; overflow: visible; }
.gl-hit { pointer-events: auto; cursor: grab; outline: none; touch-action: pan-y; }
.gl-hit:active { cursor: grabbing; }
.gl-hit:focus-visible { outline: 1px dashed rgba(243, 220, 158, .7); outline-offset: 2px; }
</style>
