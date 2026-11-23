<template>
  <!-- вещи на верху шкафа, на карнизе: сова, плющ, телескоп, карты, канделябр. Сова, телескоп и канделябр отзываются на щелчок -->
  <div class="td" aria-hidden="false">
    <div class="td-side">
      <!-- сова на жёрдочке: моргает, от щелчка крутит головой -->
      <svg class="td-it owl" :class="{ turn: owlTurn }" width="64" height="92" viewBox="0 0 64 92" role="button" tabindex="0" aria-label="Сова" @click="owl" @keydown.enter.prevent="owl" @keydown.space.prevent="owl" @animationend="e => e.animationName.includes('td-owlhead') && (owlTurn = false)">
        <title>Сова — щёлкни</title>
        <ellipse cx="32" cy="90" rx="22" ry="2.6" fill="url(#bk-shadow)" />
        <ellipse cx="32" cy="88.5" rx="16" ry="3" fill="url(#bk-wood)" /><rect x="29.5" y="77" width="5" height="11" fill="url(#bk-wood-h)" />
        <rect x="10" y="73" width="44" height="5" rx="2.4" fill="url(#bk-wood)" /><rect x="10" y="73" width="44" height="5" rx="2.4" fill="url(#bk-woodgrain)" opacity=".6" />
        <!-- тело -->
        <path d="M32 31 C46 31 50 48 48.5 61 C47 71 41 76 32 76 C23 76 17 71 15.5 61 C14 48 18 31 32 31 Z" fill="#6b4a30" />
        <path d="M32 31 C46 31 50 48 48.5 61 C47 71 41 76 32 76 C23 76 17 71 15.5 61 C14 48 18 31 32 31 Z" fill="url(#bk-leather)" class="td-ov" opacity=".5" />
        <ellipse cx="32" cy="58" rx="10.5" ry="15" fill="#d9c49a" /><ellipse cx="32" cy="58" rx="10.5" ry="15" fill="url(#bk-paper)" />
        <path d="M27 50 l2 2 l2 -2 M33 50 l2 2 l2 -2 M25 56 l2 2 l2 -2 M31 56 l2 2 l2 -2 M37 56 l1.6 1.6 M28 62 l2 2 l2 -2 M34 62 l2 2 l2 -2 M30 68 l2 2 l2 -2" fill="none" stroke="#5a3e24" stroke-width=".9" stroke-linecap="round" />
        <path d="M16 50 C14 60 17 70 24 75 C21 66 20 57 22 47 Z" fill="#4e3420" /><path d="M48 50 C50 60 47 70 40 75 C43 66 44 57 42 47 Z" fill="#4e3420" />
        <path d="M18 56 q3 3 3 8 M19 63 q2 2 2 6 M46 56 q-3 3 -3 8 M45 63 q-2 2 -2 6" fill="none" stroke="#2e1e12" stroke-width=".7" />
        <path d="M24 76 q1 -3 2 0 q1 -3 2 0 M36 76 q1 -3 2 0 q1 -3 2 0" fill="none" stroke="#3a2a18" stroke-width="1.2" stroke-linecap="round" />
        <!-- голова -->
        <g class="td-owlhead">
          <path d="M18 16 L21 6 L26 13 Z M46 16 L43 6 L38 13 Z" fill="#5a3e26" />
          <ellipse cx="32" cy="25" rx="16.5" ry="14" fill="#6b4a30" /><ellipse cx="32" cy="25" rx="16.5" ry="14" fill="url(#bk-leather)" class="td-ov" opacity=".5" />
          <circle cx="25.5" cy="26" r="8" fill="#c9ae7e" /><circle cx="38.5" cy="26" r="8" fill="#c9ae7e" />
          <g class="td-eyes">
            <circle cx="25.5" cy="26" r="5.2" fill="#f0a020" /><circle cx="38.5" cy="26" r="5.2" fill="#f0a020" />
            <circle cx="25.5" cy="26" r="2.8" fill="#120a04" class="td-pupil" /><circle cx="38.5" cy="26" r="2.8" fill="#120a04" class="td-pupil" />
            <circle cx="24.4" cy="24.6" r="1" fill="#fff" /><circle cx="37.4" cy="24.6" r="1" fill="#fff" />
          </g>
          <g class="td-lids" fill="#5e4129"><rect x="19.8" y="20.6" width="11.4" height="11" rx="5.5" /><rect x="32.8" y="20.6" width="11.4" height="11" rx="5.5" /></g>
          <path d="M30.2 30 L32 35 L33.8 30 Z" fill="#3a2a18" />
        </g>
      </svg>

      <!-- плющ в глиняном горшке, лозы свисают по карнизу -->
      <svg class="td-it ivy" width="74" height="70" viewBox="0 0 74 70" aria-hidden="true">
        <g class="td-vines">
          <g v-for="(v, i) in vines" :key="i" class="td-vine" :style="{ animationDelay: (i * -1.3) + 's', transformOrigin: v.o }">
            <path :d="v.d" fill="none" stroke="#3e5a2a" stroke-width="1.1" />
            <path v-for="(l, k) in v.leaves" :key="k" :d="LEAF" :transform="`translate(${l.x} ${l.y}) rotate(${l.r}) scale(${l.s})`" :fill="l.c" />
          </g>
        </g>
        <path d="M22 44 H52 L48 69 H26 Z" fill="#a4552e" /><path d="M22 44 H52 L48 69 H26 Z" fill="url(#bk-mottle)" opacity=".5" />
        <rect x="19" y="40" width="36" height="6" rx="1.5" fill="#b8643a" /><rect x="19" y="40" width="36" height="6" rx="1.5" fill="url(#bk-round-v)" />
        <path d="M22 44 H52 L48 69 H26 Z" fill="url(#bk-round)" />
        <g v-for="(l, k) in crown" :key="'c' + k" :transform="`translate(${l.x} ${l.y}) rotate(${l.r}) scale(${l.s})`"><path :d="LEAF" :fill="l.c" class="td-leaf" :style="{ animationDelay: (k * -0.7) + 's' }" /></g>
      </svg>
    </div>

    <div class="td-side right">
      <!-- телескоп на треноге: от щелчка выдвигается и ищет звёзды -->
      <svg class="td-it scope" :class="{ out: scopeOut }" width="96" height="96" viewBox="0 0 96 96" role="button" tabindex="0" :aria-label="scopeOut ? 'Сложить телескоп' : 'Раздвинуть телескоп'" @click="scopeOut = !scopeOut" @keydown.enter.prevent="scopeOut = !scopeOut" @keydown.space.prevent="scopeOut = !scopeOut">
        <title>Телескоп — щёлкни</title>
        <ellipse cx="48" cy="94" rx="30" ry="2.6" fill="url(#bk-shadow)" />
        <path d="M48 60 L28 94 M48 60 L68 94 M48 60 L49 93" stroke="url(#bk-wood-h)" stroke-width="3" stroke-linecap="round" />
        <circle cx="48" cy="60" r="3.4" fill="url(#bk-brass)" />
        <g class="td-tube">
          <g class="td-draw"><rect x="2" y="-3" width="24" height="6" rx="1" fill="url(#bk-brass)" /><rect x="-2" y="-2.4" width="5" height="4.8" rx="1" fill="#2a1d12" /></g>
          <rect x="20" y="-4.4" width="40" height="8.8" rx="1.4" fill="url(#bk-brass)" />
          <rect x="20" y="-4.4" width="40" height="8.8" rx="1.4" fill="url(#bk-leather)" class="td-ov" opacity=".25" />
          <rect x="34" y="-4.4" width="4" height="8.8" fill="#8a6326" />
          <path d="M58 -5.6 H78 L80 -6.4 V6.4 L78 5.6 H58 Z" fill="url(#bk-brass)" />
          <ellipse cx="80" cy="0" rx="1.4" ry="6.4" fill="#123038" /><ellipse class="td-glint" cx="80.2" cy="-2" rx=".7" ry="2" fill="#fff" opacity=".7" />
        </g>
      </svg>

      <!-- свёрнутые карты в ведёрке -->
      <svg class="td-it maps" width="58" height="76" viewBox="0 0 58 76" aria-hidden="true">
        <ellipse cx="29" cy="74" rx="22" ry="2.4" fill="url(#bk-shadow)" />
        <g v-for="(m, i) in MAPS" :key="i" :transform="`rotate(${m.r} ${m.x} 60)`">
          <rect :x="m.x - 4" :y="m.y" width="8" :height="62 - m.y" :fill="m.c" /><rect :x="m.x - 4" :y="m.y" width="8" :height="62 - m.y" fill="url(#bk-paper)" />
          <rect :x="m.x - 4" :y="m.y" width="8" :height="62 - m.y" fill="url(#bk-round)" />
          <ellipse :cx="m.x" :cy="m.y" rx="4" ry="1.6" :fill="m.c" /><path :d="`M${m.x - 2.4} ${m.y} a2.4 1 0 1 0 4.8 0 a1.4 .6 0 1 0 -2.8 0`" fill="none" stroke="#8a7448" stroke-width=".5" />
          <rect :x="m.x - 4" :y="m.y + 10" width="8" height="2" fill="#8e1a14" opacity=".8" />
        </g>
        <path d="M12 46 H46 L43 73 H15 Z" fill="url(#bk-wood)" /><path d="M12 46 H46 L43 73 H15 Z" fill="url(#bk-woodgrain)" opacity=".6" />
        <path d="M12.6 51 H45.4 M14 66 H44" stroke="url(#bk-iron)" stroke-width="2.4" />
        <path d="M12 46 H46 L43 73 H15 Z" fill="url(#bk-round)" />
      </svg>

      <!-- канделябр на три свечи: щелчок — задуть или зажечь -->
      <span class="td-cand" :class="{ off: !candles }">
        <span class="td-light" />
        <svg class="td-it" width="62" height="96" viewBox="0 0 62 96" role="button" tabindex="0" :aria-label="candles ? 'Задуть свечи' : 'Зажечь свечи'" @click="toggleCandles" @keydown.enter.prevent="toggleCandles" @keydown.space.prevent="toggleCandles">
          <title>{{ candles ? 'Задуть свечи' : 'Зажечь свечи' }}</title>
          <ellipse cx="31" cy="94" rx="20" ry="2.4" fill="url(#bk-shadow)" />
          <path d="M20 93 Q31 84 42 93 Z" fill="url(#bk-brass)" /><rect x="29.4" y="50" width="3.2" height="36" fill="url(#bk-brass-h)" /><circle cx="31" cy="70" r="3" fill="url(#bk-brass)" />
          <path d="M12 52 Q12 62 31 62 Q50 62 50 52" fill="none" stroke="url(#bk-brass)" stroke-width="2.6" />
          <g v-for="(c, i) in CANDLES" :key="i">
            <ellipse :cx="c.x" :cy="c.y + 2" rx="5.4" ry="1.6" fill="url(#bk-brass)" />
            <rect :x="c.x - 3.2" :y="c.y - c.h" width="6.4" :height="c.h" fill="url(#bk-wax)" /><ellipse :cx="c.x" :cy="c.y - c.h" rx="3.2" ry="1" fill="#efe3c4" />
            <line :x1="c.x" :y1="c.y - c.h" :x2="c.x" :y2="c.y - c.h - 3" stroke="#2a1d12" stroke-width=".9" />
            <g :transform="`translate(${c.x} ${c.y - c.h - 3})`"><g class="td-flame"><g class="sd-fa" :style="{ '--ft': c.t, '--fd': c.d }"><g class="sd-fb" :style="{ '--ft': c.t, '--fd': c.d }">
              <path d="M0 -12 C3 -7 3.8 -3 2.6 -.6 C1.7 1 -1.7 1 -2.6 -.6 C-3.8 -3 -3 -7 0 -12 Z" fill="url(#bk-flame)" />
              <path d="M0 -6 C1.2 -3.4 1.4 -1.7 .9 -.6 C.5 .2 -.5 .2 -.9 -.6 C-1.4 -1.7 -1.2 -3.4 0 -6 Z" fill="#fffbe8" />
            </g></g></g></g>
            <path v-if="smoke" :key="'s' + smoke + i" class="td-smoke" :d="`M${c.x} ${c.y - c.h - 3} c-3 -5 3 -9 0 -14 c-2 -4 2 -7 0 -11`" fill="none" stroke="#cfc8bc" stroke-width="1.4" filter="url(#bk-soft)" />
          </g>
        </svg>
      </span>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

// лист плюща: пять лопастей
const LEAF = 'M0 0 C-3 -1 -5 -4 -3 -6 C-2 -5 -1 -5 0 -7 C1 -5 2 -5 3 -6 C5 -4 3 -1 0 0 Z'
const GREENS = ['#3f6b35', '#4f7d3c', '#35592c', '#5a8a44']
function rng(s) { return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9 | 0) >>> 0) / 4294967296 }
const r = rng(77)
// лозы: от горшка через край карниза вниз
const vines = [
  { x0: 22, bend: -8, len: 34 }, { x0: 30, bend: 4, len: 46 }, { x0: 46, bend: -3, len: 26 }, { x0: 52, bend: 9, len: 40 }
].map(v => {
  const d = `M${v.x0} 46 C${v.x0 + v.bend} 58 ${v.x0 - v.bend} ${70 + v.len * 0.4} ${v.x0 + v.bend * 0.5} ${70 + v.len}`
  const leaves = Array.from({ length: Math.round(v.len / 9) }, (_, k) => {
    const t = (k + 1) / (v.len / 9 + 1)
    return { x: v.x0 + v.bend * Math.sin(t * 3) * 0.6 + (k % 2 ? 2.5 : -2.5), y: 50 + (20 + v.len) * t, r: (k % 2 ? 40 : -40) + (r() - 0.5) * 30 + 180, s: 0.9 + r() * 0.5, c: GREENS[Math.floor(r() * 4)] }
  })
  return { d, leaves, o: `${v.x0}px 46px` }
})
const crown = Array.from({ length: 16 }, (_, i) => ({ x: 20 + r() * 34, y: 22 + r() * 20, r: (r() - 0.5) * 120, s: 1 + r() * 0.7, c: GREENS[i % 4] }))
const MAPS = [{ x: 20, y: 18, r: -12, c: '#e6d8b0' }, { x: 30, y: 10, r: 3, c: '#d9c79a' }, { x: 38, y: 22, r: 14, c: '#efe4c4' }]
const CANDLES = [{ x: 12, y: 50, h: 15, t: '1.4s', d: '-1.1s' }, { x: 31, y: 44, h: 19, t: '1.8s', d: '-2.6s' }, { x: 50, y: 50, h: 13, t: '1.55s', d: '-.4s' }]

const owlTurn = ref(false), scopeOut = ref(false), candles = ref(true), smoke = ref(0)
function owl() { owlTurn.value = false; setTimeout(() => { owlTurn.value = true }, 20) }
function toggleCandles() { candles.value = !candles.value; if (!candles.value) smoke.value++ }
</script>

<style scoped>
.td { position: absolute; left: 0; right: 0; bottom: 100%; display: flex; justify-content: space-between; align-items: flex-end; padding: 0 30px; pointer-events: none; z-index: 2; }
.td-side { display: flex; align-items: flex-end; gap: 10px; }
.td-it { display: block; overflow: visible; }
.td-it[role='button'] { pointer-events: auto; cursor: pointer; outline: none; }
.td-it[role='button']:focus-visible { filter: drop-shadow(0 0 4px rgba(243, 220, 158, .8)); }
.td-ov { mix-blend-mode: overlay; }
.ivy { margin-bottom: 0; }

/* сова */
.td-owlhead { transform-box: fill-box; transform-origin: 50% 85%; animation: td-tilt 9s ease-in-out infinite; }
.owl.turn .td-owlhead { animation: td-owlhead 1.6s cubic-bezier(.4, 0, .2, 1); }
.td-lids rect { transform-box: fill-box; transform-origin: 50% 0; transform: scaleY(0); animation: td-blink 6.2s ease-in-out infinite; }
.owl.turn .td-pupil { transform-box: fill-box; transform-origin: center; animation: td-wide 1.6s ease-out; }
@keyframes td-tilt { 0%, 70%, 100% { transform: rotate(0); } 76%, 86% { transform: rotate(-14deg); } }
@keyframes td-owlhead { 0% { transform: rotate(0) scaleX(1); } 30% { transform: rotate(18deg) scaleX(.2); } 50% { transform: rotate(0) scaleX(-1); } 70% { transform: rotate(-12deg) scaleX(-.2); } 100% { transform: rotate(0) scaleX(1); } }
@keyframes td-blink { 0%, 90%, 100% { transform: scaleY(0); } 93%, 95% { transform: scaleY(1); } }
@keyframes td-wide { 0%, 100% { transform: scale(1); } 20%, 70% { transform: scale(1.5); } }

/* плющ: лозы чуть колышутся */
.td-vine { animation: td-vine 7s ease-in-out infinite; }
.td-leaf { transform-box: fill-box; transform-origin: 50% 100%; animation: td-leaf 5s ease-in-out infinite; }
@keyframes td-vine { 0%, 100% { transform: rotate(-1.4deg); } 50% { transform: rotate(1.4deg); } }
@keyframes td-leaf { 0%, 100% { transform: rotate(-4deg); } 50% { transform: rotate(4deg); } }

/* телескоп: наклонён в небо, выдвигается */
.td-tube { transform: translate(48px, 60px) rotate(-26deg) translate(-40px, 0); transition: transform .9s cubic-bezier(.65, 0, .35, 1); }
.scope.out .td-tube { transform: translate(48px, 60px) rotate(-40deg) translate(-40px, 0); }
.td-draw { transition: transform .9s cubic-bezier(.65, 0, .35, 1); }
.scope.out .td-draw { transform: translateX(-14px); }
.td-glint { animation: td-glint 4s ease-in-out infinite; }
@keyframes td-glint { 0%, 80%, 100% { opacity: .2; } 88% { opacity: .9; } }

/* канделябр */
.td-cand { position: relative; display: block; }
.td-light { position: absolute; left: 50%; bottom: 60%; width: 260px; height: 200px; transform: translate(-50%, 50%); pointer-events: none; mix-blend-mode: screen; border-radius: 50%;
  background: radial-gradient(closest-side, rgba(255, 176, 84, .26), rgba(255, 150, 60, .08) 55%, transparent); transition: opacity .45s; animation: td-light 2.4s ease-in-out infinite; }
.td-cand.off .td-light { opacity: 0; }
@keyframes td-light { 0%, 100% { opacity: .85; } 40% { opacity: 1; } 70% { opacity: .75; } }
.td-flame { transform-box: fill-box; transform-origin: 50% 100%; transition: transform .26s ease-out, opacity .2s; }
.td-cand.off .td-flame { transform: scale(.25, 0); opacity: 0; }
.td-smoke { stroke-dasharray: 40; stroke-dashoffset: 40; animation: td-smoke 2.4s ease-out forwards; }
@keyframes td-smoke { 0% { stroke-dashoffset: 40; opacity: .7; } 100% { stroke-dashoffset: 0; opacity: 0; transform: translateY(-10px); } }
.sd-fa { animation: td-sway calc(var(--ft, 1.6s) * 1.9) ease-in-out infinite; animation-delay: var(--fd, 0s); transform-box: fill-box; transform-origin: 50% 100%; }
.sd-fb { animation: td-flick var(--ft, 1.6s) ease-in-out infinite; animation-delay: calc(var(--fd, 0s) * 1.3); transform-box: fill-box; transform-origin: 50% 100%; }
@keyframes td-sway { 0%, 100% { transform: rotate(0); } 22% { transform: rotate(-3deg); } 47% { transform: rotate(1.6deg); } 71% { transform: rotate(-1.2deg); } 88% { transform: rotate(2.4deg); } }
@keyframes td-flick { 0%, 100% { transform: scale(1, 1); } 13% { transform: scale(.95, 1.06); } 29% { transform: scale(1.04, .93); } 41% { transform: scale(.97, 1.08); } 63% { transform: scale(1.02, .96); } }

@media (max-width: 760px) { .scope, .maps, .ivy { display: none; } .td { padding: 0 14px; } }
@media (prefers-reduced-motion: reduce) {
  .td-owlhead, .td-lids rect, .td-pupil, .td-vine, .td-leaf, .td-glint, .td-light, .sd-fa, .sd-fb, .td-smoke { animation: none !important; }
  .td-tube, .td-draw, .td-flame { transition: none; }
}
</style>
