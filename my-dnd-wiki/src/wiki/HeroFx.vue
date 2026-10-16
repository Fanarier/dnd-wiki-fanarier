<template>
  <!-- живые эффекты темы. На карточке два слоя: back — под текстом и портретом (печати, лучи, туман),
       front — поверх, только мелкие частицы по краям, чтобы не закрывать арт. В просмотрщике — всё фоном -->
  <div class="hfx" :class="[theme, 'm-' + mode, 'l-' + layer, { out }]" aria-hidden="true">
    <!-- ПАР: клубящийся туман снизу (патрубки и манометр — в узоре карточки, HeroCard) -->
    <template v-if="theme === 'steam'">
      <div v-if="on('back')" class="steambank" :style="{ '--fog1': `url(${fogTile(...FOG_LAYERS[0])})`, '--fog2': `url(${fogTile(...FOG_LAYERS[1])})` }"><i class="fog f1" /><i class="fog f2" /></div>
    </template>

    <!-- ТЁМНАЯ МАГИЯ: печать под характеристиками, тёмный дым, искры -->
    <template v-else-if="theme === 'demon'">
      <svg v-if="on('back')" class="sigil" viewBox="-50 -50 100 100">
        <circle r="46" /><circle r="40" class="dash" /><path d="M0-40 23.5 32.4-38-12.4h76L-23.5 32.4Z" />
        <g><text v-for="(r, n) in RUNES" :key="n" :transform="`rotate(${n * 45}) translate(0 -43)`">{{ r }}</text></g>
      </svg>
    </template>

    <!-- ЛЁД: ледяные папоротники растут из-под арта по карточке, снег, блик -->
    <template v-else-if="theme === 'frost'">
      <i v-if="on('back') && card" class="rime" :style="{ '--frost': `url(${frostImage()})` }" />
      <i v-if="on('front')" class="sheen" />
    </template>

    <!-- СОЛНЦЕ: лучи из-за портрета, пылинки света -->
    <template v-else-if="theme === 'sun'">
      <i v-if="on('back')" class="rays" />
    </template>

    <!-- БАГРЯНАЯ ЦИ: энсо под характеристиками, языки пламени снизу, искры -->
    <template v-else-if="theme === 'chi'">
      <svg v-if="on('back')" class="enso" viewBox="0 0 100 100"><path d="M71 16C55 6 30 9 18 28 5 48 13 76 36 86c21 9 46 0 56-21 7-15 4-32-6-43" /></svg>
    </template>

    <!-- КАРТЫ ТАРО: красное круглое окно с решёткой (как на арте Касуми), чёрные карты, лисьи огоньки -->
    <template v-else-if="theme === 'tarot'">
      <i v-if="on('back')" class="moon"><b class="lattice" /></i>
    </template>

    <!-- ФИОЛЕТОВЫЙ ДРАКОН: блеск по чешуе, драконий огонь снизу, угли -->
    <template v-else-if="theme === 'dragon'">
      <i v-if="on('back')" class="sweep" />
    </template>

    <!-- СТРЕЛОК: прицел за мышкой, трассеры -->
    <template v-else-if="theme === 'marksman'">
      <svg v-if="on('front') && card" class="reticle" viewBox="-32 -32 64 64">
        <g class="ring"><circle r="23" stroke-dasharray="30.1 6" />
          <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="9s" repeatCount="indefinite" /></g>
        <path class="cross" d="M0-20v13M0 7v13M-20 0h13M7 0h13M-3-14h6M-2-11h4M-3 14h6M-2 11h4M-14-3v6M-11-2v4M14-3v6M11-2v4" />
        <g class="br"><path class="b1" d="M-30-22v-8h8" /><path class="b2" d="M30-22v-8h-8" /><path class="b3" d="M-30 22v8h8" /><path class="b4" d="M30 22v8h-8" /></g>
        <circle r="1.7" class="dot" />
      </svg>
    </template>

    <!-- ЯРОСТЬ ДРАКОНА: рык расходится волнами из-за портрета, раз в несколько секунд — удар об землю:
         трещины вспыхивают, по земле бежит ударная волна, летит пыль; рамка бьётся сердцем и ускоряется -->
    <template v-else-if="theme === 'rage'">
      <template v-if="on('back')">
        <i v-for="n in 3" :key="'roar' + n" class="roar" :style="{ animationDelay: s((n - 1) * 0.9) }" />
        <svg class="cracks" viewBox="-100 -100 200 100">
          <path d="M0 0l-8-14 4-12-14-18 2-14-10-16M0 0l10-12-2-16 16-14-4-18 12-12M0 0l-22-6-14-14-22-2-16-14M0 0l24-4 12-14 24 2 14-16M0 0l-4-20 6-10-6-16" />
        </svg>
        <i class="shock" />
      </template>
      <i v-if="on('front')" class="heart" />
    </template>

    <!-- КОВАНЫЙ: золотые дорожки платы, по ним бегут импульсы; чипы мигают; скан и помехи -->
    <template v-else-if="theme === 'circuit'">
      <svg v-if="on('back')" class="pcb" viewBox="0 0 330 560" preserveAspectRatio="xMidYMid slice">
        <g class="trace">
          <path v-for="(d, n) in TRACES" :key="'t' + n" :d="d" pathLength="100" />
        </g>
        <g class="pulse">
          <path v-for="(d, n) in TRACES" :key="'p' + n" :d="d" pathLength="100" :style="{ animationDelay: s(-((n * 0.73) % 2.6)), animationDuration: s(2.2 + (n % 3) * 0.6) }" />
        </g>
        <g class="via"><circle v-for="(v, n) in VIAS" :key="'v' + n" :cx="v[0]" :cy="v[1]" r="3.2" /></g>
        <g v-for="(c, n) in CHIPS" :key="'c' + n" class="chip" :transform="`translate(${c[0]} ${c[1]})`">
          <path :d="`M-4 6h-6M-4 14h-6M-4 22h-6M${c[2] + 4} 6h6M${c[2] + 4} 14h6M${c[2] + 4} 22h6`" />
          <rect :width="c[2]" height="28" rx="3" />
          <circle class="led" :cx="c[2] / 2" cy="14" r="2.6" :style="{ animationDelay: s(n * 0.7) }" />
        </g>
      </svg>
      <template v-if="on('front')">
        <i class="scan" />
        <i class="glitch g1" /><i class="glitch g2" />
      </template>
    </template>

    <!-- частицы (у каждой свой слой) -->
    <i v-for="(p, n) in shown" :key="n" :class="p.k" :style="p.st">
      <template v-if="p.k === 'tcard'"><b class="seal" /></template>
      <template v-else-if="p.k === 'bit'">{{ p.t }}</template>
    </i>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { rng, fogTile, frostImage, FOG_LAYERS } from './heroTextures.js'

const props = defineProps({
  theme: { type: String, required: true },
  mode: { type: String, default: 'card' }, // card | ambient
  layer: { type: String, default: 'all' }, // back | front | all
  out: { type: Boolean, default: false } // гаснет
})
const card = computed(() => props.mode === 'card')
const on = l => props.layer === 'all' || props.layer === l
const RUNES = ['ᚦ', 'ᛉ', 'ᛟ', 'ᚱ', 'ᛞ', 'ᚹ', 'ᛇ', 'ᛝ']
// плата Кованого: дорожки идут по краям и снизу, мимо портрета и текста
const TRACES = [
  'M0 40H22V120H8V232', 'M330 60H308V122H321V206', 'M0 296H9V404H4', 'M330 286H321V372L326 378V468',
  'M70 560V550H150', 'M262 560V550H190', 'M0 476H8V536H40V560', 'M330 514H322V550H296', 'M0 20H60V0', 'M330 18H270V0'
]
const VIAS = [[8, 232], [321, 206], [4, 404], [326, 468], [150, 550], [190, 550], [40, 560], [296, 550], [60, 0], [270, 0]]
// чипы — у краёв, чтобы не закрывать подписи
const CHIPS = [[-2, 248, 12], [320, 408, 12]]

const pct = v => `${(v * 100).toFixed(1)}%`
const s = v => `${v.toFixed(2)}s`
// длительность и задержка; у половины частиц задержка отрицательная — при наведении они уже в полёте
function timing(r, min, spread, i) {
  const d = min + r() * spread
  return { animationDuration: s(d), animationDelay: s(i % 2 ? -r() * d : r() * d * 0.6) }
}

const parts = computed(() => {
  const r = rng(props.theme.length * 977 + (card.value ? 1 : 7))
  const k = card.value ? 1 : 2.2 // в просмотрщике частиц больше
  const many = (n, l, kind, f) => Array.from({ length: Math.round(n * k) }, (_, i) => ({ l, k: kind, ...f(i) }))
  const ember = (n, colors) => many(n, 'front', 'ember', i => ({ st: { left: pct(0.04 + r() * 0.92), '--dx': `${(r() - 0.5) * 50}px`, color: colors[i % colors.length], ...timing(r, 2.4, 2, i) } }))
  switch (props.theme) {
    case 'demon':
      return [
        ...many(7, 'back', 'smoke', i => ({ st: { left: pct(r() * 0.9 - 0.05), '--sz': `${90 + r() * 70}px`, '--dx': `${(r() - 0.5) * 60}px`, ...timing(r, 3.8, 2, i) } })),
        ...ember(12, ['var(--ta)', 'var(--tb)'])
      ]
    case 'frost':
      return many(16, 'front', 'flake', () => ({ st: { left: pct(r()), '--sz': `${2 + r() * 4}px`, '--dx': `${(r() - 0.5) * 70}px`, animationDelay: s(-r() * 5), animationDuration: s(4 + r() * 3) } }))
    case 'sun':
      return many(14, 'front', 'mote', i => ({ st: { left: pct(0.04 + r() * 0.92), top: pct(0.5 + r() * 0.5), '--sz': `${2 + r() * 4}px`, '--dx': `${(r() - 0.5) * 40}px`, ...timing(r, 3.2, 2.5, i) } }))
    case 'chi':
      return [
        ...many(10, 'back', 'flame', i => ({ st: { left: pct(-0.04 + (i / 10) * 1.08 + r() * 0.04), '--sz': `${30 + r() * 22}px`, animationDelay: s(-r() * 2.4), animationDuration: s(1.8 + r() * 1.2) } })),
        ...many(10, 'front', 'spark', i => ({ st: { left: pct(0.03 + r() * 0.94), ...timing(r, 1.6, 1.4, i) } }))
      ]
    case 'tarot':
      return [
        ...many(5, 'front', 'tcard', i => ({ st: { left: pct(i % 2 ? 0.8 + r() * 0.12 : 0.02 + r() * 0.12), '--dx': `${(i % 2 ? -1 : 1) * (10 + r() * 30)}px`, '--rot': `${(r() - 0.5) * 50}deg`, '--rot2': `${(r() - 0.5) * 260}deg`, ...timing(r, 5.5, 2.5, i) } })),
        ...many(8, 'front', 'foxfire', i => ({ st: { left: pct(i % 2 ? 0.7 + r() * 0.28 : 0.02 + r() * 0.28), '--dx': `${(r() - 0.5) * 40}px`, '--sz': `${8 + r() * 7}px`, ...timing(r, 3.2, 2, i) } }))
      ]
    case 'dragon':
      return [
        ...many(8, 'back', 'dflame', i => ({ st: { left: pct(-0.05 + (i / 8) * 1.05 + r() * 0.05), '--sz': `${70 + r() * 50}px`, animationDelay: s(-r() * 2), animationDuration: s(2 + r() * 1.2) } })),
        ...ember(14, ['var(--ta)', 'var(--ta)', 'var(--tb)'])
      ]
    case 'rage':
      return [
        ...many(6, 'back', 'rsmoke', i => ({ st: { left: pct(r() * 0.9 - 0.05), '--sz': `${90 + r() * 70}px`, '--dx': `${(r() - 0.5) * 60}px`, ...timing(r, 3.4, 2, i) } })),
        ...ember(14, ['#ff3b2f', '#ff9a3c', '#ffd06a']),
        // пыль от удара — вылетает разом, в такт с трещинами и толчком карточки
        ...many(12, 'front', 'dust', () => ({ st: { left: pct(0.3 + r() * 0.4), '--dx': `${(r() - 0.5) * 240}px`, '--dy': `${-(20 + r() * 70)}px`, '--sz': `${6 + r() * 12}px` } }))
      ]
    case 'circuit':
      return many(12, 'front', 'bit', i => ({ t: r() < 0.5 ? '0' : '1', st: { left: pct(0.04 + r() * 0.92), '--dx': `${(r() - 0.5) * 30}px`, fontSize: `${9 + r() * 6}px`, ...timing(r, 3.2, 2.5, i) } }))
    case 'marksman':
      return many(3, 'front', 'tracer', () => ({ st: { top: pct(0.12 + r() * 0.76), animationDelay: s(0.3 + r() * 2.4), animationDuration: s(2.2 + r() * 1.6) } }))
  }
  return []
})
const shown = computed(() => parts.value.filter(p => on(p.l)))


</script>

<style scoped>
.hfx { position: absolute; inset: 0; z-index: 4; overflow: hidden; pointer-events: none; border-radius: inherit; --rise: 330px; --fall: 560px; --w: 330px; --port-top: 12px; --port-h: 250px; }
/* нижний слой — над узором фона, но под текстом и портретом */
.hfx.l-back { z-index: 0; }
/* мышь ушла — эффекты гаснут, а не пропадают разом */
.hfx.out { opacity: 0; transition: opacity 1.2s ease; }
.hfx.m-ambient { z-index: 0; --rise: 75vh; --fall: 110vh; --w: 100vw; --port-top: 30vh; --port-h: 40vh; }
.hfx > * { position: absolute; display: block; }
.hfx svg { overflow: visible; fill: none; }

/* ---------- пар ---------- */
/* туман — бесшовный шум, который плывёт вверх; маска гасит его к середине карточки */
.steambank { left: 0; right: 0; bottom: 0; top: 40%; -webkit-mask: linear-gradient(to top, #000 0, rgba(0, 0, 0, .75) 30%, transparent 100%); mask: linear-gradient(to top, #000 0, rgba(0, 0, 0, .75) 30%, transparent 100%); animation: fade-in 4.5s cubic-bezier(.2, .6, .35, 1) both; }
.m-ambient .steambank { top: 0; -webkit-mask: linear-gradient(to top, #000 0, rgba(0, 0, 0, .7) 30%, transparent 85%); mask: linear-gradient(to top, #000 0, rgba(0, 0, 0, .7) 30%, transparent 85%); }
.fog { position: absolute; display: block; left: -25%; right: -25%; top: calc(-15% - 120px); height: calc(130% + var(--t) + 160px); background: var(--img) 0 0 / var(--t) var(--t) repeat; will-change: transform; animation: fog-rise linear infinite; }
/* цикл бесшовный: за один оборот слой сдвигается ровно на плитку — по вертикали, а второй ещё и вбок */
/* слои разного размера и с некратными периодами (и сдвига, и «дыхания» плотности) — общий рисунок не повторяется на глазах */
.f1 { --t: 512px; --img: var(--fog1); animation: fog-rise 13s linear infinite, breathe-a 5.3s ease-in-out infinite alternate, rise-in 4.5s cubic-bezier(.2, .6, .35, 1) both; }
/* в просмотрщике экран большой: плитки крупнее и разного размера, чтобы узор не повторялся на глазах */
/* в просмотрщике слои ещё и повёрнуты — запас по краям больше */
.m-ambient .fog { left: -45%; right: -45%; top: -45%; height: calc(190% + var(--t)); }
.m-ambient .f1 { --t: 1024px; animation-name: fog-rise-r, breathe-amb-a, rise-in; }
@keyframes breathe-amb-a { from { opacity: .22; } to { opacity: .34; } }
.m-ambient .f2 { --t: 768px; right: calc(-45% - var(--t)); animation-name: fog-drift-r, breathe-amb-b, rise-in; }
@keyframes breathe-amb-b { from { opacity: .2; } to { opacity: .1; } }
.f2 { --t: 384px; --img: var(--fog2); animation: fog-drift 9.7s linear infinite, breathe-b 7.9s ease-in-out infinite alternate, rise-in 4.5s cubic-bezier(.2, .6, .35, 1) both; right: calc(-25% - var(--t) - 20px); }
@keyframes breathe-a { from { opacity: .38; } to { opacity: .6; } }
@keyframes breathe-b { from { opacity: .36; } to { opacity: .2; } }
/* пар нагнетается: слои поднимаются снизу отдельным свойством translate (не трогая контейнер с маской — так дёшево) */
@keyframes rise-in { from { translate: 0 120px; } to { translate: 0 0; } }
@keyframes fog-rise { from { transform: translate3d(0, 0, 0); } to { transform: translate3d(0, calc(var(--t) * -1), 0); } }
@keyframes fog-drift { from { transform: translate3d(0, 0, 0); } to { transform: translate3d(calc(var(--t) * -1), calc(var(--t) * -1), 0); } }
@keyframes fog-rise-r { from { transform: rotate(-9deg) translate3d(0, 0, 0); } to { transform: rotate(-9deg) translate3d(0, calc(var(--t) * -1), 0); } }
@keyframes fog-drift-r { from { transform: rotate(7deg) translate3d(0, 0, 0); } to { transform: rotate(7deg) translate3d(calc(var(--t) * -1), calc(var(--t) * -1), 0); } }

/* ---------- тёмная магия ---------- */
.sigil { top: 300px; left: calc(50% - 130px); width: 260px; height: 260px; stroke: var(--ta); stroke-width: .8; opacity: .5; filter: drop-shadow(0 0 4px var(--ta)); animation: sigil-in 1s ease-out both, spin 18s linear infinite; }
.sigil circle, .sigil path { stroke-dasharray: 400; animation: draw 1.4s ease-out both; }
.sigil .dash { stroke-dasharray: 2 4; animation: none; }
.sigil text { fill: var(--tb); stroke: none; font-size: 6px; text-anchor: middle; dominant-baseline: middle; }
.m-ambient .sigil { top: calc(50% - 45vmin); left: calc(50% - 45vmin); width: 90vmin; height: 90vmin; opacity: .2; }
@keyframes sigil-in { from { opacity: 0; transform: scale(.7) rotate(-40deg); } }
@keyframes draw { from { stroke-dashoffset: 400; } to { stroke-dashoffset: 0; } }
.smoke { bottom: calc(var(--sz) / -2); width: var(--sz); height: var(--sz); margin-left: calc(var(--sz) / -2); border-radius: 50%; background: radial-gradient(circle, rgba(18, 2, 12, .95), rgba(120, 16, 56, .4) 50%, transparent 70%); filter: blur(8px); opacity: 0; animation: smoke ease-in-out infinite both; }
.m-ambient .smoke { --sz: 260px !important; filter: blur(20px); }
@keyframes smoke {
  0% { opacity: 0; transform: translate(0, 0) scale(.5); }
  25% { opacity: .9; }
  100% { opacity: 0; transform: translate(var(--dx), calc(var(--rise) * -.6)) scale(1.6); }
}
.ember { bottom: 0; width: 3px; height: 3px; border-radius: 50%; background: currentColor; box-shadow: 0 0 6px 1px currentColor; opacity: 0; animation: ember ease-out infinite both; }
@keyframes ember {
  0% { opacity: 0; transform: translate(0, 0); }
  15% { opacity: 1; }
  50% { opacity: .5; }
  65% { opacity: 1; }
  100% { opacity: 0; transform: translate(var(--dx), calc(var(--rise) * -1)); }
}

/* ---------- лёд ---------- */
/* иней растёт из-под портрета: маска-эллипс раскрывается от центра арта */
.rime { inset: 0; opacity: .68; background: var(--frost) 0 0 / 100% 100% no-repeat; -webkit-mask: radial-gradient(ellipse calc(var(--fr) * 1.15) var(--fr) at 50% 24%, #000 72%, transparent 100%); mask: radial-gradient(ellipse calc(var(--fr) * 1.15) var(--fr) at 50% 24%, #000 72%, transparent 100%); animation: rime 6s cubic-bezier(.35, .15, .4, 1) both; }
@property --fr { syntax: '<percentage>'; inherits: false; initial-value: 0%; }
@keyframes rime { from { --fr: 22%; } to { --fr: 62%; } }
.flake { top: -10px; width: var(--sz); height: var(--sz); border-radius: 50%; background: #f2fbff; box-shadow: 0 0 6px #bfeaff; opacity: 0; animation: fall linear infinite both; }
.m-ambient .flake { width: calc(var(--sz) * 1.6); height: calc(var(--sz) * 1.6); }
@keyframes fall {
  0% { opacity: 0; transform: translate(0, 0); }
  10% { opacity: .9; }
  50% { transform: translate(var(--dx), calc(var(--fall) * .5)); }
  90% { opacity: .8; }
  100% { opacity: 0; transform: translate(0, var(--fall)); }
}
.sheen { inset: 0; background: linear-gradient(115deg, transparent 30%, rgba(190, 236, 255, .18) 45%, rgba(255, 255, 255, .28) 50%, transparent 62%); transform: translateX(-100%); animation: sheen 3.2s ease-in-out .3s infinite; }
@keyframes sheen { 0% { transform: translateX(-100%); } 45%, 100% { transform: translateX(100%); } }

/* ---------- солнце ---------- */
/* солнце будто встаёт из-за портрета: лучи видны вокруг него и под ним */
.rays { top: calc(var(--port-top) + var(--port-h) / 2 - 330px); left: calc(50% - 330px); width: 660px; height: 660px; border-radius: 50%; background: repeating-conic-gradient(from 0deg, rgba(255, 214, 110, .4) 0 5deg, transparent 5deg 15deg); -webkit-mask: radial-gradient(circle, #000 15%, transparent 70%); mask: radial-gradient(circle, #000 15%, transparent 70%); opacity: 0; animation: fade-in 1s ease-out forwards, spin 30s linear infinite; }
.m-ambient .rays { top: -60vmax; left: calc(50% - 80vmax); width: 160vmax; height: 160vmax; animation: fade-in 1s ease-out forwards, spin 60s linear infinite; }
.mote { width: var(--sz); height: var(--sz); border-radius: 50%; background: #fff3c4; box-shadow: 0 0 8px 2px rgba(255, 201, 74, .8); opacity: 0; animation: mote ease-in-out infinite both; }
@keyframes mote {
  0% { opacity: 0; transform: translate(0, 0); }
  30% { opacity: 1; }
  100% { opacity: 0; transform: translate(var(--dx), -110px); }
}

/* ---------- багряная ци ---------- */
.flame { bottom: calc(var(--sz) * -.5); width: var(--sz); height: calc(var(--sz) * 1.7); margin-left: calc(var(--sz) / -2); border-radius: 50% 50% 45% 45% / 65% 65% 35% 35%; background: radial-gradient(ellipse at 50% 75%, rgba(255, 170, 110, .7), rgba(236, 47, 66, .5) 40%, transparent 70%); filter: blur(5px); transform-origin: 50% 100%; animation: flame ease-in-out infinite alternate both; }
.m-ambient .flame { --sz: 90px !important; filter: blur(10px); }
@keyframes flame { from { opacity: .35; transform: scaleY(.7) translateY(8px); } to { opacity: .7; transform: scaleY(1.1) skewX(4deg); } }
.spark { bottom: 0; width: 2px; height: 14px; border-radius: 2px; background: linear-gradient(transparent, #ffb38a, #ec2f42); box-shadow: 0 0 5px #ec2f42; opacity: 0; animation: spark ease-out infinite both; }
.m-ambient .spark { height: 30px; }
@keyframes spark {
  0% { opacity: 0; transform: translateY(0); }
  20% { opacity: .85; }
  100% { opacity: 0; transform: translateY(calc(var(--rise) * -1.1)); }
}
.enso { top: 290px; left: calc(50% - 115px); width: 230px; height: 230px; stroke: var(--ta); stroke-width: 5; stroke-linecap: round; opacity: .45; filter: drop-shadow(0 0 6px var(--ta)); stroke-dasharray: 300; animation: enso 1.6s cubic-bezier(.5, 0, .2, 1) both; }
.m-ambient .enso { top: calc(50% - 38vmin); left: calc(50% - 38vmin); width: 76vmin; height: 76vmin; opacity: .16; }
@keyframes enso { from { stroke-dashoffset: 300; } to { stroke-dashoffset: 0; } }

/* ---------- карты таро ---------- */
/* красное круглое окно с чёрной решёткой — под характеристиками */
.moon { top: 300px; left: calc(50% - 120px); width: 240px; height: 240px; border-radius: 50%; overflow: hidden; background: radial-gradient(circle at 50% 60%, #ffcf6a, #ff7a2a 30%, #d4202f 62%, #5a0b14 100%); box-shadow: 0 0 40px rgba(232, 52, 74, .45); opacity: 0; animation: moon-in 1.2s ease-out forwards; }
.lattice { position: absolute; inset: 0; background: linear-gradient(#0d0708, #0d0708) 50% 0 / 7px 100% no-repeat, linear-gradient(#0d0708, #0d0708) 0 50% / 100% 7px no-repeat, repeating-linear-gradient(90deg, transparent 0 34px, rgba(13, 7, 8, .92) 34px 38px), repeating-linear-gradient(0deg, transparent 0 34px, rgba(13, 7, 8, .92) 34px 38px); box-shadow: inset 0 0 0 6px #0d0708, inset 0 0 30px rgba(0, 0, 0, .7); border-radius: 50%; }
.m-ambient .moon { top: calc(50% - 42vmin); left: calc(50% - 42vmin); width: 84vmin; height: 84vmin; }
.m-ambient .lattice { background-size: 14px 100%, 100% 14px, auto, auto; }
@keyframes moon-in { from { opacity: 0; transform: scale(.85); } to { opacity: .42; transform: none; } }
.m-ambient .moon { animation-name: moon-in-amb; }
@keyframes moon-in-amb { from { opacity: 0; } to { opacity: .3; } }
/* чёрная карта таро: золотая рамка и красная печать, как в руке у Касуми */
.tcard { bottom: -60px; width: 30px; height: 46px; border-radius: 3px; background: linear-gradient(160deg, #1d1416, #070505); border: 1px solid #d9b45a; box-shadow: inset 0 0 0 2px #070505, inset 0 0 0 3px rgba(217, 180, 90, .6), 0 0 10px rgba(232, 52, 74, .45), 0 6px 10px rgba(0, 0, 0, .6); opacity: 0; animation: flutter ease-in-out infinite both; }
.m-ambient .tcard { width: 66px; height: 100px; border-radius: 6px; }
.seal { position: absolute; left: 50%; top: 50%; width: 16px; height: 16px; margin: -8px; border-radius: 50%; border: 1.5px solid #e8344a; box-shadow: 0 0 6px #e8344a, inset 0 0 4px #e8344a; background: radial-gradient(circle, #e8344a 0 2px, transparent 2.5px), conic-gradient(from 0deg, transparent 0 40deg, rgba(232, 52, 74, .8) 40deg 50deg, transparent 50deg 130deg, rgba(232, 52, 74, .8) 130deg 140deg, transparent 140deg 220deg, rgba(232, 52, 74, .8) 220deg 230deg, transparent 230deg 310deg, rgba(232, 52, 74, .8) 310deg 320deg, transparent 320deg); }
.m-ambient .seal { width: 36px; height: 36px; margin: -18px; border-width: 2.5px; }
@keyframes flutter {
  0% { opacity: 0; transform: translate(0, 0) rotate(var(--rot)) rotateY(0); }
  15% { opacity: 1; }
  50% { transform: translate(var(--dx), calc(var(--rise) * -.55)) rotate(calc(var(--rot) + 20deg)) rotateY(180deg); }
  85% { opacity: .9; }
  100% { opacity: 0; transform: translate(0, calc(var(--rise) * -1.1)) rotate(var(--rot2)) rotateY(360deg); }
}
/* лисий огонь (кицунэ-би): огонёк с белым сердцем, покачивается и мерцает */
.foxfire { bottom: -20px; width: var(--sz); height: calc(var(--sz) * 1.5); border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%; background: radial-gradient(ellipse at 50% 65%, #fff4d6 0 15%, #ffb347 30%, #ff4a2a 55%, transparent 72%); filter: blur(.6px) drop-shadow(0 0 6px #ff4a2a); opacity: 0; animation: foxfire ease-in-out infinite both; }
.m-ambient .foxfire { --sz: 26px !important; }
@keyframes foxfire {
  0% { opacity: 0; transform: translate(0, 0) scale(.6); }
  15% { opacity: 1; }
  35% { transform: translate(calc(var(--dx) * -.6), calc(var(--rise) * -.3)) scale(1); }
  60% { opacity: .85; transform: translate(var(--dx), calc(var(--rise) * -.55)) scale(.9, 1.1); }
  100% { opacity: 0; transform: translate(calc(var(--dx) * .3), calc(var(--rise) * -.9)) scale(.4); }
}

/* ---------- фиолетовый дракон ---------- */
.sweep { inset: -20% -60%; background: linear-gradient(110deg, transparent 40%, rgba(169, 112, 255, .2) 48%, rgba(227, 184, 255, .32) 50%, transparent 58%); animation: sweep 3.2s ease-in-out infinite; }
@keyframes sweep { from { transform: translateX(-40%); } to { transform: translateX(40%); } }
.dflame { bottom: calc(var(--sz) * -.6); width: var(--sz); height: calc(var(--sz) * 1.4); margin-left: calc(var(--sz) / -2); border-radius: 50% 50% 40% 40% / 60% 60% 40% 40%; background: radial-gradient(ellipse at 50% 80%, rgba(240, 210, 255, .8), rgba(169, 112, 255, .55) 35%, rgba(90, 40, 170, .25) 55%, transparent 70%); filter: blur(6px); transform-origin: 50% 100%; animation: dflame ease-in-out infinite alternate both; }
.m-ambient .dflame { --sz: 220px !important; filter: blur(14px); }
@keyframes dflame { from { opacity: .35; transform: scale(.75, .55); } to { opacity: .8; transform: scale(1, 1.1) skewX(-4deg); } }

/* ---------- стрелок ---------- */
/* прицел: кольцо медленно вращается, уголки «захватывают» цель; ничего не сжимается */
.reticle { left: 0; top: 0; width: 64px; height: 64px; margin: -32px 0 0 -32px; stroke: var(--ta); stroke-width: 1.2; filter: drop-shadow(0 0 2px rgba(255, 75, 58, .9)); transform: translate(var(--mx, 140px), var(--my, 130px)); transition: transform .08s linear; }
.reticle .ring { opacity: .75; }
.reticle .cross { stroke-width: 1; }
.reticle .dot { fill: var(--ta); stroke: none; }
.reticle .br path { stroke-width: 1.6; animation: lock .5s cubic-bezier(.2, .9, .3, 1.3) both, hold 1.8s ease-in-out .5s infinite alternate; }
.reticle .b1 { --o: -7px, -7px; --h: -1.5px, -1.5px; } .reticle .b2 { --o: 7px, -7px; --h: 1.5px, -1.5px; }
.reticle .b3 { --o: -7px, 7px; --h: -1.5px, 1.5px; } .reticle .b4 { --o: 7px, 7px; --h: 1.5px, 1.5px; }
@keyframes lock { from { opacity: 0; transform: translate(var(--o)); } to { opacity: 1; transform: translate(0, 0); } }
@keyframes hold { from { transform: translate(0, 0); } to { transform: translate(var(--h)); opacity: .6; } }
.tracer { left: 0; width: 70px; height: 2px; border-radius: 2px; background: linear-gradient(90deg, transparent, #ffd28a, #fff); box-shadow: 0 0 6px #ffb347; opacity: 0; animation: tracer ease-in infinite both; }
.m-ambient .tracer { width: 160px; }
@keyframes tracer {
  0% { opacity: 0; transform: translateX(-80px); }
  4% { opacity: 1; }
  18% { opacity: 1; transform: translateX(var(--w)); }
  19%, 100% { opacity: 0; transform: translateX(var(--w)); }
}

/* ---------- ярость дракона ---------- */
/* рык: алые волны расходятся из-за портрета */
.roar { top: calc(var(--port-top) + var(--port-h) / 2 - 70px); left: calc(50% - 70px); width: 140px; height: 140px; border-radius: 50%; border: 3px solid rgba(255, 59, 47, .7); box-shadow: 0 0 18px rgba(255, 59, 47, .6), inset 0 0 18px rgba(255, 120, 60, .4); filter: blur(1px); opacity: 0; animation: roar 2.7s ease-out infinite both; }
.m-ambient .roar { top: calc(50% - 20vmin); left: calc(50% - 20vmin); width: 40vmin; height: 40vmin; }
@keyframes roar { 0% { opacity: 0; transform: scale(.45); } 12% { opacity: .9; } 100% { opacity: 0; transform: scale(3.3); } }
.rsmoke { bottom: calc(var(--sz) / -2); width: var(--sz); height: var(--sz); margin-left: calc(var(--sz) / -2); border-radius: 50%; background: radial-gradient(circle, rgba(40, 4, 2, .95), rgba(150, 24, 12, .45) 50%, transparent 70%); filter: blur(8px); opacity: 0; animation: smoke ease-in-out infinite both; }
.m-ambient .rsmoke { --sz: 260px !important; filter: blur(20px); }
/* трещины в земле под ногами: тлеют и вспыхивают при ударе (цикл 4.6 с — тот же, что у толчка карточки) */
.cracks { left: calc(50% - 170px); bottom: -2px; width: 340px; height: 170px; stroke: #ff7a2a; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; filter: drop-shadow(0 0 4px #ff3b2f) drop-shadow(0 0 10px rgba(255, 59, 47, .7)); stroke-dasharray: 400; animation: draw 1.6s ease-out both, crack-flash 4.6s ease-out infinite; }
.m-ambient .cracks { left: calc(50% - 50vw); width: 100vw; height: 50vw; }
@keyframes crack-flash { 0%, 84% { opacity: .35; } 87% { opacity: 1; stroke: #ffe0a0; } 100% { opacity: .35; } }
/* ударная волна по земле */
.shock { left: calc(50% - 40px); bottom: -20px; width: 80px; height: 40px; border-radius: 50%; border: 3px solid rgba(255, 200, 140, .9); box-shadow: 0 0 20px rgba(255, 90, 40, .8); opacity: 0; animation: shock 4.6s ease-out infinite; }
.m-ambient .shock { width: 160px; height: 80px; left: calc(50% - 80px); }
@keyframes shock { 0%, 85% { opacity: 0; transform: scale(.3); } 87% { opacity: 1; } 100% { opacity: 0; transform: scale(6, 4); } }
.dust { bottom: 0; width: var(--sz); height: var(--sz); border-radius: 50%; background: radial-gradient(circle, rgba(170, 120, 90, .7), transparent 70%); opacity: 0; animation: dust 4.6s ease-out infinite; }
@keyframes dust { 0%, 85% { opacity: 0; transform: translate(0, 0) scale(.4); } 87% { opacity: .9; } 100% { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(2.2); } }
/* сердцебиение: двойной удар «тук-тук» алым по краям; через несколько ударов пульс учащается */
.heart { inset: 0; border-radius: inherit; box-shadow: inset 0 0 0 2px rgba(255, 59, 47, 0), inset 0 0 50px rgba(200, 20, 10, 0); animation: beat 1.15s ease-out 4, beat .72s ease-out 4.6s infinite; }
@keyframes beat {
  0% { box-shadow: inset 0 0 0 2px rgba(255, 59, 47, 0), inset 0 0 50px rgba(200, 20, 10, 0); }
  10% { box-shadow: inset 0 0 0 2px rgba(255, 59, 47, .9), inset 0 0 60px rgba(220, 30, 15, .55); }
  24% { box-shadow: inset 0 0 0 2px rgba(255, 59, 47, .2), inset 0 0 40px rgba(200, 20, 10, .15); }
  34% { box-shadow: inset 0 0 0 2px rgba(255, 59, 47, .65), inset 0 0 50px rgba(220, 30, 15, .4); }
  60%, 100% { box-shadow: inset 0 0 0 2px rgba(255, 59, 47, 0), inset 0 0 50px rgba(200, 20, 10, 0); }
}

/* ---------- кованый ---------- */
.pcb { inset: 0; width: 100%; height: 100%; }
.pcb .trace path { stroke: rgba(242, 238, 228, .22); stroke-width: 2.2; stroke-linejoin: round; stroke-dasharray: 100; animation: draw-pcb 1.4s ease-out both; }
@keyframes draw-pcb { from { stroke-dashoffset: 100; } to { stroke-dashoffset: 0; } }
/* импульс бежит по дорожке */
.pcb .pulse path { stroke: #ffd77a; stroke-width: 2.6; stroke-linecap: round; stroke-dasharray: 9 130; filter: drop-shadow(0 0 4px #e2b64a) drop-shadow(0 0 8px rgba(226, 182, 74, .8)); animation: pulse-run linear infinite; }
@keyframes pulse-run { from { stroke-dashoffset: 109; } to { stroke-dashoffset: -30; } }
.pcb .via circle { fill: #e2b64a; stroke: #f2eee4; stroke-width: 1; filter: drop-shadow(0 0 3px #e2b64a); }
.pcb .chip rect { fill: #24221d; stroke: #e2b64a; stroke-width: 1.4; }
.pcb .chip path { stroke: #e2b64a; stroke-width: 1.6; }
.pcb .chip .led { fill: #ffd77a; animation: led 1.4s steps(2, jump-none) infinite; filter: drop-shadow(0 0 4px #ffd77a); }
@keyframes led { 0% { opacity: .15; } 100% { opacity: 1; } }
/* скан-линия сверху вниз */
.scan { left: 0; right: 0; top: 0; height: 2px; background: linear-gradient(90deg, transparent, rgba(255, 215, 122, .9), transparent); box-shadow: 0 0 10px rgba(226, 182, 74, .9); opacity: .8; animation: scan 3.6s linear infinite; }
@keyframes scan { from { transform: translateY(-10px); } to { transform: translateY(var(--fall)); } }
/* помехи: полоски на миг смещаются */
.glitch { left: 0; right: 0; height: 6px; background: linear-gradient(90deg, rgba(226, 182, 74, .0), rgba(242, 238, 228, .35) 30%, rgba(226, 182, 74, .45) 70%, transparent); mix-blend-mode: screen; opacity: 0; }
.g1 { top: 38%; animation: glitch 5.3s steps(1) infinite; }
.g2 { top: 71%; height: 3px; animation: glitch 4.1s steps(1) 1.2s infinite; }
@keyframes glitch { 0%, 90%, 94%, 100% { opacity: 0; transform: translateX(0); } 91% { opacity: 1; transform: translateX(-14px); } 92% { opacity: .6; transform: translateX(10px); } 93% { opacity: 1; transform: translateX(-4px); } }
/* двоичные частицы поднимаются от нижней платы */
.bit { bottom: -12px; color: #ffd77a; font: 700 12px 'Consolas', 'Courier New', monospace; text-shadow: 0 0 6px #e2b64a; opacity: 0; animation: mote ease-in-out infinite both; }
.m-ambient .bit { font-size: 22px !important; }

@keyframes spin { to { rotate: 360deg; } }
@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .hfx { display: none; } }
</style>
