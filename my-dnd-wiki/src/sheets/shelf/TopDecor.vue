<template>
  <!-- вещи на верху шкафа, на карнизе: сова, плющ, телескоп, карты, канделябр. Сова, телескоп и канделябр отзываются на щелчок -->
  <div class="td" aria-hidden="false">
    <div class="td-side">
      <!-- сова на жёрдочке: моргает, от щелчка крутит головой -->
      <svg class="td-it owl" :class="{ turn: owlTurn }" width="70" height="100" viewBox="0 0 70 100" role="button" tabindex="0" aria-label="Сова" @mousedown.prevent @click="owl" @keydown.enter.prevent="owl" @keydown.space.prevent="owl" @animationend="e => e.animationName.includes('td-owlhead') && (owlTurn = false)">
        <title>Сова — щёлкни</title>
        <defs>
          <radialGradient :id="uid + 'ob'" cx=".45" cy=".35" r=".75"><stop offset="0" stop-color="#9a7148" /><stop offset=".6" stop-color="#6e4b2c" /><stop offset="1" stop-color="#3e2816" /></radialGradient>
          <radialGradient :id="uid + 'oe'" cx=".42" cy=".38" r=".7"><stop offset="0" stop-color="#ffe07a" /><stop offset=".55" stop-color="#f5a623" /><stop offset="1" stop-color="#b86a0a" /></radialGradient>
          <radialGradient :id="uid + 'of'" cx=".5" cy=".45" r=".6"><stop offset="0" stop-color="#ead8b2" /><stop offset="1" stop-color="#c9a878" /></radialGradient>
        </defs>
        <ellipse cx="35" cy="98" rx="24" ry="2.6" fill="url(#bk-shadow)" />
        <ellipse cx="35" cy="96.5" rx="17" ry="3" fill="url(#bk-wood)" /><rect x="32.5" y="85" width="5" height="11" fill="#5e3b1f" /><rect x="32.5" y="85" width="1.6" height="11" fill="#8a5c34" />
        <rect x="11" y="81" width="48" height="5.4" rx="2.7" fill="#6b4526" /><rect x="11" y="81" width="48" height="5.4" rx="2.7" fill="url(#bk-woodgrain)" opacity=".6" /><rect x="12" y="81.4" width="46" height="1.2" rx=".6" fill="#a8774a" opacity=".6" />
        <!-- тело -->
        <path d="M35 36 C51 36 55 55 53 69 C51.5 78 44.5 84 35 84 C25.5 84 18.5 78 17 69 C15 55 19 36 35 36 Z" :fill="`url(#${uid}ob)`" />
        <path d="M35 52 C43 52 45.5 62 44.5 70 C43.6 77 39.6 81 35 81 C30.4 81 26.4 77 25.5 70 C24.5 62 27 52 35 52 Z" fill="#e8d6ae" />
        <g fill="#6a4628"><path v-for="(sp, i) in BELLY" :key="i" :d="`M${sp[0]} ${sp[1]} q1.3 2.2 0 3.2 q-1.3 -1 0 -3.2 Z`" /></g>
        <!-- крылья: перья лесенкой -->
        <path d="M19 52 C14 62 15 75 24 83 C22 74 22 64 25 55 Z" fill="#4e3420" /><path d="M51 52 C56 62 55 75 46 83 C48 74 48 64 45 55 Z" fill="#4e3420" />
        <g fill="none" stroke="#c9a878" stroke-opacity=".55" stroke-width=".8" stroke-linecap="round">
          <path d="M19 60 q3 1.5 4.6 -.4 M18.4 66 q3 1.5 4.6 -.4 M19 72 q3 1.5 4.6 -.4 M20.6 78 q2.6 1.3 4 -.4" />
          <path d="M51 60 q-3 1.5 -4.6 -.4 M51.6 66 q-3 1.5 -4.6 -.4 M51 72 q-3 1.5 -4.6 -.4 M49.4 78 q-2.6 1.3 -4 -.4" />
        </g>
        <!-- лапы -->
        <g fill="#c7922e"><path d="M28 82 l-2.4 3.4 h1.6 l1.4 -1.6 l.6 2 h1.4 l.2 -2 l1.4 1.6 h1.4 L30 82 Z" /><path d="M38 82 l-2 3.4 h1.4 l1.4 -1.6 l.4 2 h1.4 l.4 -2 l1.4 1.6 h1.6 L41 82 Z" /></g>
        <!-- голова -->
        <g class="td-owlhead">
          <path d="M18 18 L19.5 5 L27 13 Z M52 18 L50.5 5 L43 13 Z" fill="#5a3c22" /><path d="M20 15 L20.6 8 L24.4 12.5 M50 15 L49.4 8 L45.6 12.5" fill="none" stroke="#9a7148" stroke-width=".8" />
          <ellipse cx="35" cy="28" rx="18.5" ry="15.5" :fill="`url(#${uid}ob)`" />
          <g class="td-face">
          <!-- лицевой диск -->
          <path d="M35 21 C31 16 18.5 16 18.5 28.5 C18.5 38 28 41 35 38 C42 41 51.5 38 51.5 28.5 C51.5 16 39 16 35 21 Z" :fill="`url(#${uid}of)`" stroke="#5a3c22" stroke-width="1" />
          <path d="M35 22 V33" stroke="#a8875a" stroke-width=".7" />
          <g class="td-eyes">
            <circle cx="27.5" cy="28.5" r="6.4" fill="#2a1a0c" /><circle cx="42.5" cy="28.5" r="6.4" fill="#2a1a0c" />
            <circle cx="27.5" cy="28.5" r="5.4" :fill="`url(#${uid}oe)`" /><circle cx="42.5" cy="28.5" r="5.4" :fill="`url(#${uid}oe)`" />
            <circle cx="27.5" cy="28.5" r="3" fill="#120a04" class="td-pupil" /><circle cx="42.5" cy="28.5" r="3" fill="#120a04" class="td-pupil" />
            <circle cx="26" cy="26.8" r="1.3" fill="#fff" /><circle cx="41" cy="26.8" r="1.3" fill="#fff" /><circle cx="29" cy="30.4" r=".6" fill="#fff" opacity=".7" /><circle cx="44" cy="30.4" r=".6" fill="#fff" opacity=".7" />
          </g>
          <g class="td-lids" fill="#7a5634"><circle cx="27.5" cy="28.5" r="6.5" /><circle cx="42.5" cy="28.5" r="6.5" /></g>
          <path d="M21 21.5 Q27 19 33 22.5 M49 21.5 Q43 19 37 22.5" fill="none" stroke="#3e2816" stroke-width="1.4" stroke-linecap="round" />
          <path d="M33.2 32 Q35 31 36.8 32 L35 37.4 Z" fill="#4a3a2a" /><path d="M35 33 V36.6" stroke="#8a7a62" stroke-width=".5" />
          </g>
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
      <!-- телескоп на треноге: от щелчка выдвигается и смотрит выше -->
      <svg class="td-it scope" :class="{ out: scopeOut }" width="100" height="100" viewBox="0 0 100 100" role="button" tabindex="0" :aria-label="scopeOut ? 'Сложить телескоп' : 'Раздвинуть телескоп'" @mousedown.prevent @click="scopeOut = !scopeOut" @keydown.enter.prevent="scopeOut = !scopeOut" @keydown.space.prevent="scopeOut = !scopeOut">
        <title>Телескоп — щёлкни</title>
        <ellipse cx="50" cy="98" rx="32" ry="2.6" fill="url(#bk-shadow)" />
        <!-- тренога -->
        <g stroke-linecap="round">
          <path d="M50 60 L52 96" stroke="#3a2312" stroke-width="3.4" /><path d="M50 60 L51.4 96" stroke="#7a5030" stroke-width="1.2" />
          <path d="M50 60 L26 96" stroke="#5e3b1f" stroke-width="3.6" /><path d="M50 60 L25.4 95" stroke="#9a6a3c" stroke-width="1.2" />
          <path d="M50 60 L74 96" stroke="#5e3b1f" stroke-width="3.6" /><path d="M50 60 L73.4 95.4" stroke="#9a6a3c" stroke-width="1.2" />
          <path d="M38 78 L62 78" stroke="#c99a45" stroke-width="1" opacity=".8" />
        </g>
        <circle cx="26" cy="96" r="1.8" fill="url(#bk-brass)" /><circle cx="74" cy="96" r="1.8" fill="url(#bk-brass)" /><circle cx="52" cy="96" r="1.8" fill="url(#bk-brass)" />
        <path d="M44 62 H56 L54 56 H46 Z" fill="url(#bk-brass)" />
        <!-- труба: поворачивается вокруг крепления -->
        <g class="td-tube">
          <g class="td-draw">
            <rect x="-46" y="-2.8" width="34" height="5.6" rx="1" fill="url(#bk-brass)" />
            <rect x="-50" y="-3.4" width="5" height="6.8" rx="1.2" fill="#2a1d12" /><rect x="-46" y="-2.8" width="2" height="5.6" fill="#8a6326" />
          </g>
          <rect x="-26" y="-4.4" width="48" height="8.8" rx="1.4" fill="url(#bk-brass)" />
          <rect x="-26" y="-4.4" width="48" height="8.8" rx="1.4" fill="#000" opacity=".08" />
          <rect x="-27" y="-5" width="3" height="10" rx=".8" fill="#8a6326" /><rect x="-4" y="-5" width="3" height="10" rx=".8" fill="#8a6326" />
          <rect x="-14" y="-9" width="14" height="3.4" rx="1.2" fill="url(#bk-brass)" /><rect x="-12" y="-6" width="2" height="2" fill="#8a6326" /><rect x="-4" y="-6" width="2" height="2" fill="#8a6326" />
          <path d="M20 -5.6 H38 L40 -6.6 V6.6 L38 5.6 H20 Z" fill="url(#bk-brass)" /><rect x="20" y="-5.8" width="2.4" height="11.6" fill="#8a6326" />
          <ellipse cx="40" cy="0" rx="1.4" ry="6.6" fill="#123038" /><ellipse class="td-glint" cx="40.2" cy="-2.2" rx=".7" ry="2" fill="#fff" opacity=".7" />
          <circle cx="0" cy="0" r="2.2" fill="#3a2610" />
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
        <svg class="td-it" width="72" height="108" viewBox="0 0 72 108" role="button" tabindex="0" :aria-label="candles ? 'Задуть свечи' : 'Зажечь свечи'" @mousedown.prevent @click="toggleCandles" @keydown.enter.prevent="toggleCandles" @keydown.space.prevent="toggleCandles">
          <title>{{ candles ? 'Задуть свечи' : 'Зажечь свечи' }}</title>
          <ellipse cx="36" cy="106" rx="22" ry="2.4" fill="url(#bk-shadow)" />
          <!-- основание: купол с ободком -->
          <ellipse cx="36" cy="104" rx="14" ry="2.6" fill="#6a4a18" /><path d="M22 104 Q22 96 30 94 H42 Q50 96 50 104 Z" fill="url(#bk-brass)" />
          <ellipse cx="36" cy="94" rx="6.4" ry="1.8" fill="url(#bk-brass)" />
          <!-- стебель с утолщениями -->
          <rect x="34.3" y="45" width="3.4" height="49" fill="url(#bk-brass-h)" />
          <ellipse cx="36" cy="88" rx="4" ry="2.6" fill="url(#bk-brass)" /><ellipse cx="36" cy="74" rx="3.4" ry="3.4" fill="url(#bk-brass)" /><ellipse cx="36" cy="61" rx="4.4" ry="2" fill="url(#bk-brass)" />
          <!-- рожки -->
          <path d="M36 62 C30 62 22 66 17 60 C14 57 15 53 15 52" fill="none" stroke="url(#bk-brass)" stroke-width="2.6" stroke-linecap="round" />
          <path d="M36 62 C42 62 50 66 55 60 C58 57 57 53 57 52" fill="none" stroke="url(#bk-brass)" stroke-width="2.6" stroke-linecap="round" />
          <g v-for="(c, i) in CANDLES" :key="i">
            <path :d="`M${c.x - 6} ${c.y + 1} Q${c.x} ${c.y + 4} ${c.x + 6} ${c.y + 1} Z`" fill="url(#bk-brass)" /><ellipse :cx="c.x" :cy="c.y + 1" rx="6" ry="1.4" fill="#d9b25c" />
            <rect :x="c.x - 3.4" :y="c.y - c.h" width="6.8" :height="c.h + 1" fill="url(#bk-wax)" /><ellipse :cx="c.x" :cy="c.y - c.h" rx="3.4" ry="1.1" fill="#efe3c4" />
            <path :d="`M${c.x - 3.4} ${c.y - c.h + 1} q-.6 4 .3 7 q.8 -3 .6 -7 Z`" fill="#f3ead3" />
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
const CANDLES = [{ x: 15, y: 51, h: 16, t: '1.4s', d: '-1.1s' }, { x: 36, y: 44, h: 20, t: '1.8s', d: '-2.6s' }, { x: 57, y: 51, h: 14, t: '1.55s', d: '-.4s' }]
// пятнышки на светлой груди совы
const BELLY = [[30, 57], [35, 56], [40, 57], [28, 63], [33, 62.5], [38, 62.5], [42, 63.5], [30, 69], [35, 68.5], [40, 69], [32, 75], [38, 75]]
const uid = 'td' + Math.random().toString(36).slice(2, 8)

const owlTurn = ref(false), scopeOut = ref(false), candles = ref(true), smoke = ref(0)
function owl() { owlTurn.value = false; setTimeout(() => { owlTurn.value = true }, 20) }
function toggleCandles() { candles.value = !candles.value; if (!candles.value) smoke.value++ }
</script>

<style scoped>
.td { position: absolute; left: 0; right: 0; bottom: 100%; display: flex; justify-content: space-between; align-items: flex-end; padding: 0 30px; pointer-events: none; z-index: 2; }
.td-side { display: flex; align-items: flex-end; gap: 10px; }
.td-it { display: block; overflow: visible; }
.td-it[role='button'] { pointer-events: auto; cursor: pointer; outline: none; }
.td-it[role='button']:focus-visible { outline: 1px dashed rgba(243, 220, 158, .7); outline-offset: 2px; }
.td-ov { mix-blend-mode: overlay; }
.ivy { margin-bottom: 0; }

/* сова */
.td-owlhead { transform-box: fill-box; transform-origin: 50% 90%; animation: td-tilt 9s ease-in-out infinite; }
.owl.turn .td-owlhead { animation: td-owlhead 1.8s ease-in-out; }
.td-face { transform-box: view-box; transform-origin: 35px 28px; }
.owl.turn .td-face { animation: td-face 1.8s ease-in-out; }
.td-lids circle { transform-box: fill-box; transform-origin: 50% 0; transform: scaleY(0); animation: td-blink 6.2s ease-in-out infinite; }
.owl.turn .td-pupil { transform-box: fill-box; transform-origin: center; animation: td-wide 1.6s ease-out; }
@keyframes td-tilt { 0%, 70%, 100% { transform: rotate(0); } 76%, 86% { transform: rotate(-14deg); } }
@keyframes td-owlhead { 0%, 100% { transform: rotate(0); } 25%, 40% { transform: rotate(-9deg); } 60%, 75% { transform: rotate(8deg); } }
@keyframes td-face { 0%, 100% { transform: translateX(0) scaleX(1); } 25%, 40% { transform: translateX(-5px) scaleX(.72); } 60%, 75% { transform: translateX(5px) scaleX(.72); } }
@keyframes td-blink { 0%, 94%, 100% { transform: scaleY(0); } 96%, 97% { transform: scaleY(1); } }
@keyframes td-wide { 0%, 100% { transform: scale(1); } 20%, 70% { transform: scale(1.5); } }

/* плющ: лозы чуть колышутся */
.td-vine { animation: td-vine 7s ease-in-out infinite; }
.td-leaf { transform-box: fill-box; transform-origin: 50% 100%; animation: td-leaf 5s ease-in-out infinite; }
@keyframes td-vine { 0%, 100% { transform: rotate(-1.4deg); } 50% { transform: rotate(1.4deg); } }
@keyframes td-leaf { 0%, 100% { transform: rotate(-4deg); } 50% { transform: rotate(4deg); } }

/* телескоп: наклонён в небо, выдвигается */
.td-tube { transform: translate(50px, 54px) rotate(-24deg); transition: transform .9s cubic-bezier(.65, 0, .35, 1); }
.scope.out .td-tube { transform: translate(50px, 54px) rotate(-36deg); }
.td-draw { transition: transform .9s cubic-bezier(.65, 0, .35, 1); }
.scope.out .td-draw { transform: translateX(-12px); }
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
  .td-owlhead, .td-face, .td-lids circle, .td-pupil, .td-vine, .td-leaf, .td-glint, .td-light, .sd-fa, .sd-fb, .td-smoke { animation: none !important; }
  .td-tube, .td-draw, .td-flame { transition: none; }
}
</style>
