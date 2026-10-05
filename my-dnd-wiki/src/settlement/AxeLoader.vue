<template>
  <div class="axe-loader" :class="{ out: leaving }" role="status" aria-live="polite">
    <svg class="scene" viewBox="0 0 400 260" aria-hidden="true">
      <defs>
        <radialGradient id="al-moon" cx="50%" cy="50%" r="50%"><stop offset=".55" stop-color="#fff3cf" /><stop offset=".62" stop-color="#ffe6a3" stop-opacity=".35" /><stop offset="1" stop-color="#ffe6a3" stop-opacity="0" /></radialGradient>
        <radialGradient id="al-glow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffcf6b" stop-opacity=".28" /><stop offset="1" stop-color="#ffcf6b" stop-opacity="0" /></radialGradient>
        <radialGradient id="al-mist" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#cfd8e6" stop-opacity=".16" /><stop offset="1" stop-color="#cfd8e6" stop-opacity="0" /></radialGradient>
        <radialGradient id="al-fly" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff6b0" /><stop offset=".35" stop-color="#ffd84a" stop-opacity=".8" /><stop offset="1" stop-color="#ffd84a" stop-opacity="0" /></radialGradient>
        <linearGradient id="al-hill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3d5a2c" /><stop offset="1" stop-color="#1c2a16" /></linearGradient>
        <linearGradient id="al-bark" x1="0" x2="1"><stop offset="0" stop-color="#3f2814" /><stop offset=".35" stop-color="#7a5230" /><stop offset=".6" stop-color="#8d6239" /><stop offset="1" stop-color="#3a2410" /></linearGradient>
        <radialGradient id="al-leaf" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#8fd062" /><stop offset=".55" stop-color="#4f8f3a" /><stop offset="1" stop-color="#25502a" /></radialGradient>
        <radialGradient id="al-leaf2" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#7cc457" /><stop offset=".6" stop-color="#3f7c34" /><stop offset="1" stop-color="#1f4524" /></radialGradient>
        <linearGradient id="al-steel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff" /><stop offset=".35" stop-color="#d4d9df" /><stop offset=".7" stop-color="#8e969f" /><stop offset="1" stop-color="#5b626b" /></linearGradient>
        <linearGradient id="al-haft" x1="0" x2="1"><stop offset="0" stop-color="#5e3a1a" /><stop offset=".5" stop-color="#a06a35" /><stop offset="1" stop-color="#5e3a1a" /></linearGradient>
        <!-- топор целиком: рукоять вниз по оси Y, лезвие справа -->
        <g id="al-axe">
          <rect x="-3.4" y="-8" width="6.8" height="70" rx="3.4" fill="url(#al-haft)" />
          <path d="M-3.4 44h6.8M-3.4 49h6.8M-3.4 54h6.8M-3.4 59h6.8" stroke="#3a220c" stroke-width="1.6" />
          <path d="M-4 -18 C -12 -20 -18 -16 -20 -9 C -15 -11 -9 -10 -4 -6 Z" fill="#5b626b" />
          <path d="M4 -22 C 18 -30 34 -32 41 -24 C 46 -12 46 4 38 20 C 30 10 18 4 4 4 Z" fill="url(#al-steel)" stroke="#4b5158" stroke-width=".9" />
          <path d="M41 -24 C 46 -12 46 4 38 20" fill="none" stroke="#fff" stroke-width="1.6" opacity=".85" />
          <path d="M8 -14 C 18 -18 28 -18 34 -12" fill="none" stroke="#fff" stroke-width="1" opacity=".35" />
          <rect x="-5.5" y="-24" width="11" height="30" rx="3" fill="#6d747c" stroke="#4b5158" stroke-width=".8" />
        </g>
        <path id="al-blade" d="M4 -22 C 18 -30 34 -32 41 -24 C 46 -12 46 4 38 20 C 30 10 18 4 4 4 Z" />
      </defs>

      <g :transform="`translate(${shakeX} ${shakeY})`">
        <!-- небо: луна, звёзды -->
        <circle cx="330" cy="46" r="34" fill="url(#al-moon)" />
        <circle v-for="(st, i) in STARS" :key="'s' + i" :cx="st[0]" :cy="st[1]" :r="st[2]" fill="#fff6dc" class="star" :style="{ animationDelay: st[3] + 's' }" />
        <!-- горы и два ряда ельника -->
        <path d="M0 150 L48 104 L82 128 L128 82 L170 120 L214 92 L262 132 L304 98 L352 126 L400 102 L400 190 L0 190 Z" fill="#1a2130" />
        <path :d="PINES_FAR" fill="#16211f" />
        <ellipse class="mist m1" cx="120" cy="176" rx="150" ry="18" fill="url(#al-mist)" />
        <path :d="PINES_NEAR" fill="#111a15" />
        <ellipse class="mist m2" cx="300" cy="196" rx="140" ry="16" fill="url(#al-mist)" />
        <!-- холм -->
        <ellipse cx="240" cy="226" rx="170" ry="40" fill="url(#al-glow)" />
        <path d="M0 230 C 80 214 160 218 240 222 C 300 225 350 216 400 220 L400 260 L0 260 Z" fill="url(#al-hill)" />
        <path d="M0 230 C 80 214 160 218 240 222 C 300 225 350 216 400 220" fill="none" stroke="#6b9446" stroke-width="2" />
        <path d="M30 226l3-10 3 10zM60 221l2-8 3 8zM118 219l3-9 2 9zM150 220l2-7 3 7zM300 223l3-9 3 9zM360 219l2-8 3 8zM380 220l3-10 2 10z" fill="#77a64f" />

        <!-- поленница -->
        <g v-for="(lg, i) in pile" :key="'p' + i" :transform="`translate(${lg[0]} ${lg[1]})`">
          <g :class="{ bump: i === pile.length - 1 && bump }">
            <rect x="-9" y="-6" width="18" height="12" rx="6" fill="#6e4726" /><circle cx="-9" cy="0" r="6" fill="#e0b47c" /><circle cx="-9" cy="0" r="3" fill="none" stroke="#a87a4a" stroke-width="1" />
          </g>
        </g>

        <!-- дерево: чуть покачивается, от удара вздрагивает -->
        <g :transform="`rotate(${sway} 250 222)`">
          <path d="M226 224 C 232 218 236 214 237 206 L 242 110 L 258 110 L 263 206 C 264 214 268 218 276 224 Z" fill="url(#al-bark)" />
          <path d="M244 210 q4 -30 0 -60 q-3 -18 2 -34 M255 200 q-4 -24 1 -50 M248 140 q6 -10 4 -22" stroke="#2e1c0b" stroke-width="1.5" fill="none" opacity=".55" />
          <!-- зарубка -->
          <path :d="`M238.6 ${NOTCH_Y - notch} L${238.6 + notch * 1.2} ${NOTCH_Y} L238.6 ${NOTCH_Y + notch} Z`" fill="#f0cf96" stroke="#b08550" stroke-width=".6" />
          <g>
            <circle cx="214" cy="104" r="30" fill="url(#al-leaf2)" />
            <circle cx="288" cy="102" r="32" fill="url(#al-leaf2)" />
            <circle cx="250" cy="82" r="44" fill="url(#al-leaf)" />
            <circle cx="226" cy="62" r="26" fill="url(#al-leaf)" />
            <circle cx="276" cy="60" r="28" fill="url(#al-leaf)" />
            <circle cx="252" cy="40" r="26" fill="url(#al-leaf)" />
            <circle cx="238" cy="50" r="8" fill="#b6e58a" opacity=".35" />
            <circle cx="266" cy="70" r="6" fill="#b6e58a" opacity=".3" />
            <circle cx="222" cy="96" r="5" fill="#b6e58a" opacity=".25" />
          </g>
        </g>

        <!-- светлячки -->
        <circle v-for="(f, i) in flies" :key="'f' + i" :cx="f.x" :cy="f.y" r="5" fill="url(#al-fly)" :opacity="f.a" />

        <!-- шлейф топора в полёте -->
        <use v-for="(g, i) in trail" :key="'t' + i" href="#al-blade" :transform="`translate(${g.x} ${g.y}) rotate(${g.r})`" fill="#f4f8ff" :opacity="(i + 1) * 0.035" />
        <!-- топор -->
        <use href="#al-axe" :transform="`translate(${axe.x} ${axe.y}) rotate(${axe.r})`" />
        <!-- блик на лезвии -->
        <g v-if="glint.a > 0" :transform="`translate(${glint.x} ${glint.y}) rotate(${glint.r}) scale(${glint.s})`" :opacity="glint.a">
          <path d="M0 -9 L1.6 -1.6 L9 0 L1.6 1.6 L0 9 L-1.6 1.6 L-9 0 L-1.6 -1.6 Z" fill="#fff" />
        </g>

        <!-- удар: кольцо, искры, щепки, листья, пыль, летящее полено -->
        <circle v-if="ring.a > 0" :cx="IMPACT.x" :cy="IMPACT.y" :r="ring.r" fill="none" stroke="#fff3cf" :stroke-width="ring.w" :opacity="ring.a" />
        <circle v-for="d in dust" :key="d.id" :cx="d.x" :cy="d.y" :r="d.r" fill="#c9b48a" :opacity="d.a" />
        <line v-for="sp in sparks" :key="sp.id" :x1="sp.x" :y1="sp.y" :x2="sp.x - sp.vx * 0.03" :y2="sp.y - sp.vy * 0.03" stroke="#ffe08a" stroke-width="1.6" stroke-linecap="round" :opacity="sp.a" />
        <rect v-for="c in chips" :key="c.id" :x="c.x - c.w / 2" :y="c.y - 1.4" :width="c.w" height="2.8" rx="1.2" :fill="c.col" :opacity="c.a" :transform="`rotate(${c.r} ${c.x} ${c.y})`" />
        <path v-for="lf in leaves" :key="lf.id" d="M0 -4 C 3 -3 4 1 0 4 C -4 1 -3 -3 0 -4 Z" :fill="lf.col" :opacity="lf.a" :transform="`translate(${lf.x} ${lf.y}) rotate(${lf.r})`" />
        <g v-if="flyLog" :transform="`translate(${flyLog.x} ${flyLog.y}) rotate(${flyLog.r})`">
          <rect x="-9" y="-6" width="18" height="12" rx="6" fill="#6e4726" /><circle cx="-9" cy="0" r="6" fill="#e0b47c" />
        </g>
      </g>
    </svg>
    <div class="al-title">{{ title }}</div>
    <transition name="phr" mode="out-in"><div :key="phrase" class="al-phrase">{{ phrase }}</div></transition>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'

// ready — данные и местность готовы; уходим в конце броска и не раньше, чем через MIN_CYCLES бросков
const props = defineProps({ title: { type: String, default: 'Урюпинск' }, ready: Boolean })
const emit = defineEmits(['gone'])

const PHRASES = ['Рубим лес под новые дома…', 'Пересчитываем запасы на складе…', 'Будим старосту…', 'Разгоняем туман над окрестностями…', 'Чиним частокол…', 'Сверяем, кто где живёт…']
const phrase = ref(PHRASES[Math.floor(Math.random() * PHRASES.length)])

/* ---------- декорации, считаются один раз ---------- */
const STARS = Array.from({ length: 22 }, (_, i) => [((i * 97) % 380) + 10, ((i * 53) % 90) + 6, i % 3 ? 0.7 : 1.2, (i % 7) * 0.4])
function pines(y0, h, step, seed) {
  let d = `M0 ${y0}`
  let s = seed
  for (let x = 0; x <= 400; x += step) {
    s = (s * 9301 + 49297) % 233280
    const hh = h * (0.6 + (s / 233280) * 0.6)
    d += ` L${x} ${y0} L${x + step / 2} ${y0 - hh} L${x + step} ${y0}`
  }
  return d + ` L400 ${y0 + 60} L0 ${y0 + 60} Z`
}
const PINES_FAR = pines(176, 34, 16, 7)
const PINES_NEAR = pines(198, 46, 22, 3)

/* ---------- бросок: летит по дуге, вращаясь; вонзается; дрожит; вырывается и улетает ---------- */
const CYCLE = 1000, MIN_CYCLES = 2
const HIT = 0.38, STUCK = 0.62
const R = 25 // наклон топора в стволе
const AT = { x: 202, y: 166 } // где держится топор, когда лезвие в стволе
const IMPACT = { x: 240, y: 180 }
const NOTCH_Y = IMPACT.y
const START = { x: -70, y: 40 }, CTRL = { x: 90, y: -50 }, BACK = { x: -70, y: 90 }

const axe = reactive({ x: START.x, y: START.y, r: 0 })
const trail = ref([])
const glint = reactive({ x: 0, y: 0, r: 0, s: 1, a: 0 })
const ring = reactive({ r: 0, w: 0, a: 0 })
const shakeX = ref(0), shakeY = ref(0)
const sway = ref(0)
const notch = ref(2)
const pile = ref([])
const bump = ref(false)
const flyLog = ref(null)
const chips = ref([]), sparks = ref([]), leaves = ref([]), dust = ref([])
const flies = ref([])
const leaving = ref(false)

const PILE_SLOTS = [[316, 218], [334, 218], [352, 218], [325, 207], [343, 207], [361, 216], [334, 196], [352, 197], [370, 209]]
const bez = (a, b, c, t) => (1 - t) ** 2 * a + 2 * (1 - t) * t * b + t ** 2 * c
const easeIn = t => t * t
const easeOut = t => 1 - (1 - t) ** 3
// точка лезвия в мировых координатах (для блика)
const local = (px, py, x, y, r) => { const a = (r * Math.PI) / 180; return { x: x + px * Math.cos(a) - py * Math.sin(a), y: y + px * Math.sin(a) + py * Math.cos(a) } }
let id = 0
const rnd = (a, b) => a + Math.random() * (b - a)

function hit() {
  ring.r = 4; ring.w = 3; ring.a = 0.9
  for (let i = 0; i < 10; i++) { const a = rnd(-2.6, -0.6); const v = rnd(160, 320); sparks.value.push({ id: id++, x: IMPACT.x, y: IMPACT.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, a: 1, life: rnd(0.15, 0.3) }) }
  for (let i = 0; i < 12; i++) chips.value.push({ id: id++, x: IMPACT.x - 2, y: IMPACT.y + rnd(-4, 4), vx: rnd(-160, -40), vy: rnd(-200, -60), r: rnd(0, 360), vr: rnd(-900, 900), w: rnd(3, 6), col: Math.random() < 0.7 ? '#f0cf96' : '#8d6239', a: 1, life: rnd(1, 1.6) })
  for (let i = 0; i < 6; i++) leaves.value.push({ id: id++, x: rnd(200, 300), y: rnd(40, 110), vx: rnd(-20, 20), vy: rnd(8, 22), r: rnd(0, 360), vr: rnd(-200, 200), col: ['#7cc457', '#9ad86a', '#5d9a3f', '#c9d36a'][i % 4], a: 1, life: rnd(1.6, 2.4), ph: rnd(0, 6) })
  for (let i = 0; i < 5; i++) dust.value.push({ id: id++, x: 250 + rnd(-24, 24), y: 222, r: rnd(3, 6), vr: rnd(14, 24), vy: rnd(-14, -6), a: 0.35, life: 0.7 })
  shakeT = 0
  notch.value = Math.min(11, notch.value + 1.5)
  // полено летит в поленницу
  if (pile.value.length < PILE_SLOTS.length) flyLog.value = { x: 262, y: 214, r: 0, t: 0, from: { x: 262, y: 214 }, to: PILE_SLOTS[pile.value.length] }
}

let raf = 0, t0 = 0, last = 0, lastCycle = 0, struck = false, shakeT = 9, phraseTimer, goneTimer, bumpTimer
function leave() {
  if (leaving.value) return
  leaving.value = true
  goneTimer = setTimeout(() => emit('gone'), 650)
}
function frame(now) {
  raf = requestAnimationFrame(frame)
  if (!t0) t0 = last = now
  const dt = Math.min(0.05, (now - last) / 1000)
  last = now
  const el = now - t0
  const cyc = Math.floor(el / CYCLE)
  const p = (el % CYCLE) / CYCLE
  // конец броска: если всё загрузилось и бросков хватило — уходим
  if (cyc !== lastCycle) {
    lastCycle = cyc
    struck = false
    if (props.ready && cyc >= MIN_CYCLES) leave()
  }
  const prev = { x: axe.x, y: axe.y, r: axe.r }
  if (p < HIT) {
    const k = easeIn(p / HIT) * 0.55 + (p / HIT) * 0.45
    axe.x = bez(START.x, CTRL.x, AT.x, k)
    axe.y = bez(START.y, CTRL.y, AT.y, k)
    axe.r = R - 720 * (1 - k)
  } else if (p < STUCK) {
    const k = (p - HIT) / (STUCK - HIT)
    if (!struck) { struck = true; hit() }
    axe.x = AT.x - Math.sin(k * 30) * 1.2 * (1 - k)
    axe.y = AT.y
    axe.r = R + Math.sin(k * 34) * 7 * (1 - k)
  } else {
    const k = easeOut((p - STUCK) / (1 - STUCK))
    axe.x = bez(AT.x, CTRL.x - 20, BACK.x, k)
    axe.y = bez(AT.y, CTRL.y + 40, BACK.y, k)
    axe.r = R - 540 * k
  }
  // шлейф — только в полёте
  const flying = p < HIT || p > STUCK + 0.03
  trail.value = flying ? [...trail.value, prev].slice(-5) : []
  // блик скользит по кромке в середине полёта
  if (p > 0.12 && p < 0.3) {
    const k = (p - 0.12) / 0.18
    const pt = local(42, -24 + k * 40, axe.x, axe.y, axe.r)
    Object.assign(glint, { x: pt.x, y: pt.y, r: k * 90, s: 0.6 + Math.sin(k * Math.PI) * 0.8, a: Math.sin(k * Math.PI) })
  } else glint.a = 0
  // тряска сцены и дерева после удара
  shakeT += dt
  const amp = shakeT < 0.4 ? 3.2 * Math.exp(-shakeT * 10) : 0
  shakeX.value = amp ? rnd(-amp, amp) : 0
  shakeY.value = amp ? rnd(-amp, amp) * 0.6 : 0
  const since = p >= HIT ? ((p - HIT) * CYCLE) / 1000 : 9
  sway.value = Math.sin(el / 900) * 0.6 + (since < 1 ? Math.sin(since * 26) * 2.6 * Math.exp(-since * 4) : 0)
  if (notch.value >= 11 && p < 0.05) notch.value = 2
  // кольцо удара
  if (ring.a > 0) { ring.r += 90 * dt; ring.w = Math.max(0.4, ring.w - 9 * dt); ring.a = Math.max(0, ring.a - 3.6 * dt) }
  // частицы
  const G = 520, GROUND = 224
  sparks.value = sparks.value.filter(s => (s.life -= dt) > 0).map(s => ({ ...s, x: s.x + s.vx * dt, y: s.y + s.vy * dt, vy: s.vy + G * 0.4 * dt, a: Math.min(1, s.life * 5) }))
  chips.value = chips.value.filter(c => (c.life -= dt) > 0).map(c => {
    c.vy += G * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.r += c.vr * dt
    if (c.y > GROUND && c.vy > 0) { c.y = GROUND; c.vy *= -0.35; c.vx *= 0.55; c.vr *= 0.4 }
    c.a = Math.min(1, c.life * 2.5)
    return c
  })
  leaves.value = leaves.value.filter(l => (l.life -= dt) > 0).map(l => {
    l.ph += dt * 4
    l.x += (l.vx + Math.sin(l.ph) * 26) * dt; l.y = Math.min(GROUND, l.y + l.vy * dt); l.r += l.vr * dt
    l.a = Math.min(1, l.life * 1.5)
    return l
  })
  dust.value = dust.value.filter(d => (d.life -= dt) > 0).map(d => ({ ...d, r: d.r + d.vr * dt, y: d.y + d.vy * dt, a: Math.max(0, d.life * 0.5) }))
  // полено по дуге в поленницу
  if (flyLog.value) {
    const f = flyLog.value
    f.t += dt / 0.45
    const k = Math.min(1, f.t)
    f.x = f.from.x + (f.to[0] - f.from.x) * k
    f.y = f.from.y + (f.to[1] - f.from.y) * k - Math.sin(k * Math.PI) * 46
    f.r = k * 540
    if (k >= 1) {
      pile.value = [...pile.value, f.to]
      flyLog.value = null
      bump.value = true
      clearTimeout(bumpTimer)
      bumpTimer = setTimeout(() => { bump.value = false }, 250)
    }
  }
  // светлячки
  flies.value = [0, 1, 2, 3, 4, 5].map(i => ({ x: 60 + i * 58 + Math.sin(el / (900 + i * 130) + i) * 18, y: 150 + (i % 3) * 18 + Math.cos(el / (700 + i * 90) + i * 2) * 10, a: 0.35 + 0.65 * Math.abs(Math.sin(el / (400 + i * 70) + i)) }))
}

let reduce = false
// без анимации (системная настройка «меньше движения») уходим сразу, как всё готово
watch(() => props.ready, v => { if (v && reduce) leave() })
onMounted(() => {
  reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduce) {
    Object.assign(axe, { x: AT.x, y: AT.y, r: R })
    notch.value = 7
    pile.value = PILE_SLOTS.slice(0, 5)
    if (props.ready) leave()
  } else raf = requestAnimationFrame(frame)
  let i = PHRASES.indexOf(phrase.value)
  phraseTimer = setInterval(() => { phrase.value = PHRASES[++i % PHRASES.length] }, 1600)
})
onBeforeUnmount(() => { cancelAnimationFrame(raf); clearInterval(phraseTimer); clearTimeout(goneTimer); clearTimeout(bumpTimer) })
</script>

<style scoped>
.axe-loader { position: fixed; inset: 0; z-index: 50; display: grid; place-content: center; justify-items: center; gap: 4px; background: radial-gradient(1000px 560px at 50% 38%, #26324a 0%, #151b28 45%, #0b0e14 100%); transition: opacity .6s ease, visibility .6s, transform .6s ease; }
.axe-loader.out { opacity: 0; visibility: hidden; pointer-events: none; transform: scale(1.04); }
.scene { width: min(620px, 92vw); height: auto; overflow: visible; -webkit-mask-image: radial-gradient(50% 58% at 50% 48%, #000 62%, transparent 100%); mask-image: radial-gradient(50% 58% at 50% 48%, #000 62%, transparent 100%); }
.al-title { margin-top: 6px; font: 700 46px/1 var(--a-serif, Georgia, serif); letter-spacing: .02em; background: linear-gradient(100deg, #b8893f 0%, #f3d99a 30%, #fff6dc 45%, #f3d99a 60%, #b8893f 100%); background-size: 220% 100%; -webkit-background-clip: text; background-clip: text; color: transparent; animation: shimmer 2.4s linear infinite; filter: drop-shadow(0 2px 10px rgba(0, 0, 0, .6)); }
.al-phrase { min-height: 20px; color: #c4b591; font: 600 15px var(--a-sans, sans-serif); }
.phr-enter-active, .phr-leave-active { transition: opacity .3s, transform .3s; }
.phr-enter-from { opacity: 0; transform: translateY(6px); }
.phr-leave-to { opacity: 0; transform: translateY(-6px); }
.star { animation: twinkle 2.2s ease-in-out infinite; }
.mist { animation: drift 9s ease-in-out infinite alternate; }
.mist.m2 { animation-duration: 12s; animation-direction: alternate-reverse; }
.bump { animation: bump .25s ease-out; transform-box: fill-box; transform-origin: center bottom; }
@keyframes shimmer { from { background-position: 120% 0; } to { background-position: -120% 0; } }
@keyframes twinkle { 0%, 100% { opacity: .25; } 50% { opacity: 1; } }
@keyframes drift { from { transform: translateX(-24px); } to { transform: translateX(24px); } }
@keyframes bump { 0% { transform: scale(1.25, .7); } 60% { transform: scale(.92, 1.12); } 100% { transform: scale(1); } }
@media (max-width: 520px) { .al-title { font-size: 36px; } }
</style>
