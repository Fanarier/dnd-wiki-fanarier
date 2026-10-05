<template>
  <div class="axe-loader" :class="{ out }" role="status" aria-live="polite">
    <svg class="scene" viewBox="0 0 260 190" aria-hidden="true">
      <defs>
        <radialGradient id="al-glow" cx="50%" cy="85%" r="60%"><stop offset="0" stop-color="#e7c56f" stop-opacity=".22" /><stop offset="1" stop-color="#e7c56f" stop-opacity="0" /></radialGradient>
        <linearGradient id="al-bark" x1="0" x2="1"><stop offset="0" stop-color="#5a3a1e" /><stop offset=".55" stop-color="#7a5230" /><stop offset="1" stop-color="#4a2f17" /></linearGradient>
        <linearGradient id="al-blade" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#f4f1ea" /><stop offset=".5" stop-color="#b9bfc6" /><stop offset="1" stop-color="#6d747c" /></linearGradient>
        <linearGradient id="al-crown" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6fae4f" /><stop offset="1" stop-color="#2f6a34" /></linearGradient>
      </defs>
      <ellipse cx="150" cy="168" rx="120" ry="40" fill="url(#al-glow)" />
      <!-- земля -->
      <path d="M10 166 Q70 158 130 164 T250 162 L250 190 L10 190 Z" fill="#2b3a22" />
      <path d="M10 166 Q70 158 130 164 T250 162" fill="none" stroke="#4d6b35" stroke-width="2" />
      <g class="grass" fill="#5d8a3e"><path d="M40 164l3-9 2 9zM58 162l2-7 3 7zM196 163l3-8 2 8zM222 162l2-7 3 7zM176 164l2-6 2 6z" /></g>
      <!-- поленница растёт с каждым ударом -->
      <g class="logs">
        <g v-for="i in logs" :key="i" :transform="`translate(${196 + ((i - 1) % 3) * 15 + (Math.floor((i - 1) / 3) % 2) * 7}, ${158 - Math.floor((i - 1) / 3) * 11})`">
          <g class="log"><rect x="-7" y="-5" width="14" height="10" rx="5" fill="#7a5230" /><circle cx="-7" cy="0" r="5" fill="#d9b07a" /><circle cx="-7" cy="0" r="2.2" fill="none" stroke="#a87a4a" stroke-width="1" /></g>
        </g>
      </g>
      <!-- дерево: качается от удара -->
      <g :transform="`rotate(${shake} 140 164)`">
        <path d="M128 164 L131 70 L149 70 L152 164 Z" fill="url(#al-bark)" />
        <path d="M135 150 q3 -20 0 -40 M144 140 q-3 -18 1 -36" stroke="#3e2712" stroke-width="1.4" fill="none" opacity=".6" />
        <!-- зарубка -->
        <path :d="`M128.5 ${notchY - notch} L${128.5 + notch * 1.1} ${notchY} L128.5 ${notchY + notch} Z`" fill="#e8c48e" />
        <g class="crown">
          <circle cx="140" cy="58" r="34" fill="url(#al-crown)" />
          <circle cx="114" cy="72" r="22" fill="#3f7f3c" />
          <circle cx="166" cy="70" r="24" fill="#3a7638" />
          <circle cx="140" cy="34" r="22" fill="#78b856" />
          <circle cx="128" cy="48" r="7" fill="#9ccf6e" opacity=".55" />
          <circle cx="158" cy="42" r="5" fill="#9ccf6e" opacity=".45" />
        </g>
      </g>
      <!-- щепки и листья -->
      <g>
        <rect v-for="c in chips" :key="c.id" :x="c.x - 2.5" :y="c.y - 1.2" width="5" height="2.4" rx="1" :fill="c.leaf ? '#7cbf55' : '#e8c48e'" :opacity="c.a"
              :transform="`rotate(${c.r} ${c.x} ${c.y})`" />
      </g>
      <!-- топор -->
      <g :transform="`translate(${axe.x} ${axe.y}) rotate(${axe.r})`">
        <rect x="-3" y="-4" width="6" height="52" rx="3" fill="#8a5a2b" />
        <rect x="-3" y="36" width="6" height="12" rx="3" fill="#5a3a1e" />
        <path d="M-3 -2 C -14 -6 -24 -14 -26 -22 C -18 -18 -10 -16 -3 -14 Z" fill="#6d747c" />
        <path d="M3 -16 C 14 -22 24 -20 30 -12 C 32 -2 30 8 24 14 C 18 6 10 0 3 0 Z" fill="url(#al-blade)" stroke="#565c63" stroke-width=".8" />
        <path d="M24 14 C 30 6 31 -4 29 -11" stroke="#fff" stroke-width="1.2" fill="none" opacity=".8" />
      </g>
    </svg>
    <div class="al-title">{{ title }}</div>
    <div class="al-phrase">{{ phrase }}</div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'

defineProps({ title: { type: String, default: 'Урюпинск' }, out: Boolean })

const PHRASES = ['Рубим лес под новые дома…', 'Пересчитываем запасы на складе…', 'Будим старосту…', 'Разгоняем туман над окрестностями…', 'Чиним частокол…', 'Сверяем, кто где живёт…']
const phrase = ref(PHRASES[0])

/* Один цикл — бросок топора: летит по дуге, вращаясь, вонзается в ствол, дрожит, вырывается и улетает обратно */
const CYCLE = 1700
const HIT = 0.42, STUCK = 0.66
// где держится топор, когда вонзился (лезвие заходит в ствол), и где на стволе зарубка
const AT = { x: 108, y: 130 }
const IMPACT = { x: 131, y: 140 }
const START = { x: -40, y: 40 }, CTRL = { x: 40, y: -30 }
const axe = reactive({ x: START.x, y: START.y, r: 0 })
const shake = ref(0)
const notch = ref(2)
const notchY = IMPACT.y
const logs = ref(0)
const chips = ref([])
let raf = 0, t0 = 0, idSeq = 0, last = 0, reduce = false, phraseTimer, burstDone = false

const bez = (a, b, c, t) => (1 - t) ** 2 * a + 2 * (1 - t) * t * b + t ** 2 * c
const ease = t => 1 - (1 - t) ** 3

function burst() {
  for (let i = 0; i < 14; i++) {
    const leaf = i >= 9
    chips.value.push(leaf
      ? { id: idSeq++, leaf, x: 110 + Math.random() * 60, y: 40 + Math.random() * 30, vx: (Math.random() - 0.5) * 30, vy: 10 + Math.random() * 20, r: Math.random() * 360, vr: (Math.random() - 0.5) * 300, a: 1, life: 1.6 }
      : { id: idSeq++, leaf, x: IMPACT.x - 2, y: IMPACT.y, vx: -40 - Math.random() * 90, vy: -60 - Math.random() * 80, r: Math.random() * 360, vr: (Math.random() - 0.5) * 900, a: 1, life: 1.1 })
  }
}

function frame(now) {
  raf = requestAnimationFrame(frame)
  if (!t0) t0 = last = now
  const dt = Math.min(0.05, (now - last) / 1000)
  last = now
  const p = ((now - t0) % CYCLE) / CYCLE
  if (p < HIT) {
    // полёт к стволу: дуга и два оборота, к удару лезвие смотрит в дерево
    const k = ease(p / HIT)
    axe.x = bez(START.x, CTRL.x, AT.x, k)
    axe.y = bez(START.y, CTRL.y, AT.y, k)
    axe.r = -720 + 720 * k + 20
  } else if (p < STUCK) {
    // застрял: дрожит, затухая
    const k = (p - HIT) / (STUCK - HIT)
    axe.x = AT.x
    axe.y = AT.y
    axe.r = 20 + Math.sin(k * 40) * 6 * (1 - k)
    if (!burstDone) { burstDone = true; burst(); notch.value = Math.min(9, notch.value + 1.4); logs.value = (logs.value % 9) + 1 }
  } else {
    // вырывается и улетает обратно по дуге
    const k = ease((p - STUCK) / (1 - STUCK))
    axe.x = bez(AT.x, CTRL.x + 20, START.x, k)
    axe.y = bez(AT.y, CTRL.y, START.y, k)
    axe.r = 20 - 540 * k
    burstDone = false
  }
  // дерево качается после удара
  const since = p >= HIT ? (p - HIT) * CYCLE / 1000 : 9
  shake.value = since < 1.2 ? Math.sin(since * 22) * 2.4 * Math.exp(-since * 3.2) : 0
  if (notch.value >= 9 && p < 0.05) notch.value = 2
  // щепки летят и падают, листья кружатся
  const g = 260
  chips.value = chips.value.filter(c => (c.life -= dt) > 0).map(c => {
    if (c.leaf) { c.vy = Math.min(c.vy + 20 * dt, 30); c.x += (c.vx + Math.sin(c.life * 6) * 18) * dt } else { c.vy += g * dt; c.x += c.vx * dt }
    c.y = Math.min(164, c.y + c.vy * dt)
    c.r += c.vr * dt
    c.a = Math.min(1, c.life * 2)
    return c
  })
}
onMounted(() => {
  reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduce) { Object.assign(axe, { x: AT.x, y: AT.y, r: 20 }); notch.value = 6; logs.value = 5 } else raf = requestAnimationFrame(frame)
  let i = 0
  phraseTimer = setInterval(() => { phrase.value = PHRASES[++i % PHRASES.length] }, 1800)
})
onBeforeUnmount(() => { cancelAnimationFrame(raf); clearInterval(phraseTimer) })
</script>

<style scoped>
.axe-loader { position: fixed; inset: 0; z-index: 50; display: grid; place-content: center; justify-items: center; gap: 6px; background: radial-gradient(900px 520px at 50% 40%, #1f2a1c 0%, #121611 55%, #0b0d0a 100%); transition: opacity .5s ease, visibility .5s; }
.axe-loader.out { opacity: 0; visibility: hidden; pointer-events: none; }
.scene { width: min(480px, 88vw); height: auto; overflow: visible; filter: drop-shadow(0 10px 24px rgba(0, 0, 0, .5)); }
.al-title { margin-top: 4px; font: 700 40px/1 var(--a-serif, Georgia, serif); color: #f3d99a; letter-spacing: .02em; text-shadow: 0 2px 12px rgba(0, 0, 0, .6); }
.al-phrase { min-height: 18px; color: #b9ab8a; font: 600 15px var(--a-sans, sans-serif); animation: phr 1.8s ease-in-out infinite; }
.log { animation: drop .35s cubic-bezier(.3, 1.4, .5, 1) both; }
@keyframes phr { 0%, 100% { opacity: .55; } 30%, 70% { opacity: 1; } }
@keyframes drop { from { transform: translateY(-14px); opacity: 0; } }
</style>
