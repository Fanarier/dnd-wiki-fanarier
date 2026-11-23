<template>
  <!-- живые детали книги героя: у каждого своя. layer="in" — на корешке (под обрезкой), "out" — то, что выходит за корешок -->
  <g v-if="layer === 'in'" class="fx">
    <!-- Энди: латунные шестерни крутятся, малая — навстречу большой -->
    <template v-if="fx === 'andy'">
      <g :transform="T(g.W / 2, g.emY)"><g class="fx-spin"><g :transform="S(g.es)"><path :d="P.gear" fill="url(#bk-brass)" fill-rule="evenodd" stroke="#3a2610" stroke-width=".5" /></g></g></g>
      <g :transform="T(g.W / 2 + g.es * 0.6, g.emY + g.es * 0.52)"><g class="fx-spin rev"><g :transform="S(g.es * 0.52)"><path :d="P.gear" fill="url(#bk-brass)" fill-rule="evenodd" stroke="#3a2610" stroke-width=".5" /></g></g></g>
    </template>

    <!-- Хироши: по клинку пробегает блик -->
    <template v-else-if="fx === 'hiroshi'">
      <clipPath :id="id + 'sw'"><path :d="P.sword" :transform="`${T(g.W / 2, g.emY)} ${S(g.es)}`" /></clipPath>
      <g :transform="T(g.W / 2, g.emY)"><g :transform="S(g.es)"><path :d="P.sword" :fill="paint" fill-rule="evenodd" /></g></g>
      <g :clip-path="`url(#${id}sw)`">
        <rect :x="-8" :y="g.emY - g.es" width="5" :height="g.es * 2" fill="#fff" opacity=".85" transform="skewX(-20)">
          <animate v-if="!reduce" attributeName="x" :values="`-8;${g.W + 8};${g.W + 8}`" keyTimes="0;.18;1" dur="5.5s" repeatCount="indefinite" />
        </rect>
      </g>
    </template>

    <!-- Касуми: звезда дышит, звёзды мерцают, иногда пролетает падающая -->
    <template v-else-if="fx === 'kasumi'">
      <g :transform="T(g.W / 2, g.emY)"><g class="fx-pulse"><g :transform="S(g.es)"><path :d="P.star" :fill="paint" filter="url(#bk-tool)" /></g></g></g>
      <g fill="#fff">
        <path v-for="(p, i) in g.stars.slice(0, 7)" :key="i" class="fx-twinkle" :style="{ animationDelay: (i * 0.73).toFixed(2) + 's' }" :d="spark(p.x, p.y, 2.6)" />
      </g>
      <g v-if="!reduce" opacity="0">
        <line x1="0" y1="0" x2="12" y2="-5" stroke="#fff" stroke-width="1" stroke-linecap="round" />
        <circle r="1.1" fill="#fff" />
        <animateTransform attributeName="transform" type="translate" :values="`${g.W + 6} ${g.H * 0.18};${-14} ${g.H * 0.36};${-14} ${g.H * 0.36}`" keyTimes="0;.07;1" dur="8s" begin="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0;1;0;0" keyTimes="0;.03;.07;1" dur="8s" begin="2s" repeatCount="indefinite" />
      </g>
    </template>

    <!-- Долор: в бороздах от когтей тлеет жар -->
    <template v-else-if="fx === 'dolor'">
      <g fill="none" stroke-linecap="round">
        <path v-for="(d, i) in g.claws" :key="i" :d="d" class="fx-ember" :style="{ animationDelay: (i * 0.6) + 's' }" stroke="#ff7a24" stroke-width="1.2" />
      </g>
      <g :transform="T(g.W / 2, g.emY)"><g :transform="S(g.es)"><path :d="P.claw" fill="none" :stroke="paint" stroke-width="1.8" stroke-linecap="round" /></g></g>
    </template>

    <!-- Цуруя: глаз на корешке смотрит по сторонам и моргает, по цепям бегут отблески -->
    <template v-else-if="fx === 'tsuruya'">
      <clipPath :id="id + 'ey'"><path :d="P.eyeShape" :transform="`${T(g.W / 2, g.emY)} ${S(g.es)}`" /></clipPath>
      <g :transform="T(g.W / 2, g.emY)"><g :transform="S(g.es)"><path :d="P.eyeShape" fill="#12060c" /></g></g>
      <g :clip-path="`url(#${id}ey)`">
        <g :transform="T(g.W / 2, g.emY)">
          <g class="fx-look">
            <circle :r="g.es * 0.19" :fill="look.glow || '#ff3df0'" filter="url(#bk-glow)" :style="{ color: look.glow || '#ff3df0' }" />
            <ellipse :rx="g.es * 0.045" :ry="g.es * 0.15" fill="#080306" />
            <circle :cx="-g.es * 0.06" :cy="-g.es * 0.07" :r="g.es * 0.035" fill="#fff" opacity=".9" />
          </g>
        </g>
        <rect class="fx-blink" :x="g.W / 2 - g.es / 2" :y="g.emY - g.es / 2" :width="g.es" :height="g.es" :fill="look.c" />
      </g>
      <g :transform="T(g.W / 2, g.emY)"><g :transform="S(g.es)"><path :d="P.eyeShape" fill="none" :stroke="paint" stroke-width="1.3" /></g></g>
      <g v-if="!reduce">
        <ellipse v-for="(y, i) in g.chainY" :key="i" :cy="y - 1" rx="2.4" ry="1" fill="#fff" opacity="0">
          <animate attributeName="cx" :values="`-4;${g.W + 4};${g.W + 4}`" keyTimes="0;.3;1" dur="4.6s" :begin="(i * 1.7) + 's'" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0;.9;0;0" keyTimes="0;.15;.3;1" dur="4.6s" :begin="(i * 1.7) + 's'" repeatCount="indefinite" />
        </ellipse>
      </g>
    </template>

    <!-- Элиас: камень пульсирует холодным светом, по корешку тянет ветер высоты -->
    <template v-else-if="fx === 'elias'">
      <g :transform="T(g.W / 2, g.emY)"><g :transform="S(g.es)"><path :d="P.wing" :fill="paint" filter="url(#bk-tool)" /></g></g>
      <circle :cx="g.W / 2" :cy="g.gemY" r="9" :fill="look.glow || '#4fd8ff'" class="fx-gem" filter="url(#bk-soft)" />
      <g v-if="!reduce" stroke="#e8f6ff" stroke-linecap="round" fill="none">
        <path v-for="(k, i) in [0.32, 0.58, 0.78]" :key="i" :d="`M0 ${g.H * k} q${g.W * 0.25} -3 ${g.W * 0.5} 0`" stroke-width=".7" opacity="0">
          <animateTransform attributeName="transform" type="translate" :values="`${-g.W} 0;${g.W} 0;${g.W} 0`" keyTimes="0;.35;1" dur="6s" :begin="(i * 1.9) + 's'" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0;.55;0;0" keyTimes="0;.15;.35;1" dur="6s" :begin="(i * 1.9) + 's'" repeatCount="indefinite" />
        </path>
      </g>
    </template>

    <!-- Лёва: прицел пристреливается, по корешку бродит красная точка и замирает в перекрестье -->
    <template v-else-if="fx === 'lowe'">
      <g :transform="T(g.W / 2, g.emY)"><g class="fx-zero"><g :transform="S(g.es)"><path :d="P.crosshair" fill="none" :stroke="paint" stroke-width="1.6" stroke-linecap="round" /></g></g></g>
      <g v-if="!reduce">
        <circle r="3.4" fill="#ff2a1a" opacity=".3" /><circle r="1.3" fill="#ff4a3a" />
        <animateMotion :path="laserPath" dur="10s" repeatCount="indefinite" keyPoints="0;.25;.5;.75;1;1" keyTimes="0;.18;.36;.54;.7;1" calcMode="spline" keySplines=".4 0 .2 1;.4 0 .2 1;.4 0 .2 1;.4 0 .2 1;0 0 1 1" />
        <animate attributeName="opacity" values="1;1;.2;1;.2;1" keyTimes="0;.74;.8;.86;.92;1" dur="10s" repeatCount="indefinite" />
      </g>
    </template>

    <!-- Белатор: по коже пробегает золотой отблеск, корона искрит -->
    <template v-else-if="fx === 'belator'">
      <g :transform="T(g.W / 2, g.emY)"><g :transform="S(g.es)"><path :d="P.crown" :fill="paint" filter="url(#bk-tool)" /></g></g>
      <path class="fx-twinkle" fill="#fff" :d="spark(g.W / 2, g.emY - g.es * 0.36, 4)" />
      <linearGradient :id="id + 'sh'" x1="0" x2="1"><stop offset="0" stop-color="#fff6d8" stop-opacity="0" /><stop offset=".5" stop-color="#fff6d8" stop-opacity=".45" /><stop offset="1" stop-color="#fff6d8" stop-opacity="0" /></linearGradient>
      <rect v-if="!reduce" :x="-g.W" y="-30" :width="g.W * 0.7" :height="g.H + 60" :fill="`url(#${id}sh)`" class="bs-ov" :transform="`skewY(-28)`">
        <animate attributeName="x" :values="`${-g.W};${g.W * 1.4};${g.W * 1.4}`" keyTimes="0;.3;1" dur="7s" repeatCount="indefinite" />
      </rect>
    </template>

    <!-- Джилл: снежинка медленно вращается, с сосульки срывается капля -->
    <template v-else-if="fx === 'jill'">
      <g :transform="T(g.W / 2, g.emY)"><g class="fx-spin slow"><g :transform="S(g.es)"><path :d="P.snow" fill="none" :stroke="paint" stroke-width="1.6" stroke-linecap="round" /></g></g></g>
      <g v-if="!reduce && drip">
        <ellipse :cx="drip.x" :cy="drip.y" rx="1" ry="1.3" fill="#e6f7ff" opacity="0">
          <animate attributeName="cy" :values="`${drip.y};${drip.y};${drip.y + 1.5};${g.H + 4}`" keyTimes="0;.55;.7;1" dur="4.4s" repeatCount="indefinite" calcMode="spline" keySplines="0 0 1 1;.4 0 .6 1;.5 0 1 1" />
          <animate attributeName="opacity" values="0;.95;.95;0" keyTimes="0;.3;.85;1" dur="4.4s" repeatCount="indefinite" />
        </ellipse>
      </g>
    </template>

    <!-- Орвилл: крест бьётся как сердце, через него бежит линия пульса -->
    <template v-else-if="fx === 'orvill'">
      <g :transform="T(g.W / 2, g.emY)"><g class="fx-beat"><g :transform="S(g.es)"><path :d="P.cross" :fill="paint" /></g></g></g>
      <path :d="ecg" fill="none" stroke="#ff6a5a" stroke-width="1" stroke-linejoin="round" stroke-linecap="round" class="fx-ecg" pathLength="100" />
    </template>

    <!-- Азиэль: руны разгораются по очереди и гаснут, когда на книгу смотрят -->
    <template v-else-if="fx === 'aziel'">
      <g :transform="T(g.W / 2, g.emY)"><g :transform="S(g.es)">
        <path :d="P.moon" :fill="paint" filter="url(#bk-deboss)" />
        <path :d="P.moon" :fill="look.glow || '#a48bff'" class="fx-halo" filter="url(#bk-glow)" :style="{ color: look.glow || '#a48bff' }" />
      </g></g>
      <g class="fx-runes" fill="none" :stroke="look.glow || '#a48bff'" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" filter="url(#bk-glow)" :style="{ color: look.glow || '#a48bff' }">
        <path v-for="(rn, i) in g.runes" :key="i" :d="rn.d" :transform="T(rn.x, rn.y)" class="fx-rune" :style="{ animationDelay: (i * 1.1) + 's' }" />
      </g>
    </template>

    <!-- Кристиан: щит, сигнальный огонёк и блик по стали -->
    <template v-else-if="fx === 'kristian'">
      <g :transform="T(g.W / 2, g.emY)"><g :transform="S(g.es)"><path :d="P.shield" :fill="paint" filter="url(#bk-deboss)" /></g></g>
      <circle :cx="g.W - 8" cy="16" r="4" fill="#ff3a2a" class="fx-led" filter="url(#bk-soft)" /><circle :cx="g.W - 8" cy="16" r="1.6" fill="#ff6a4a" class="fx-led" />
      <rect v-if="!reduce" :x="-12" y="0" width="7" :height="g.H" fill="#fff" opacity=".16" transform="skewX(-12)">
        <animate attributeName="x" :values="`-12;${g.W + 20};${g.W + 20}`" keyTimes="0;.22;1" dur="6.5s" repeatCount="indefinite" />
      </rect>
    </template>
  </g>

  <!-- то, что выходит за корешок -->
  <g v-else class="fx">
    <!-- Энди: пар из-под переплёта -->
    <g v-if="fx === 'andy'" filter="url(#bk-soft)">
      <circle v-for="i in 3" :key="i" :cx="g.W * 0.7" cy="-2" r="4.5" fill="#efe9dc" class="fx-steam" :style="{ animationDelay: (i - 1) * 1.25 + 's' }" />
    </g>
    <!-- Хироши: шёлковая кисть качается, иногда падает лепесток сакуры -->
    <g v-else-if="fx === 'hiroshi'">
      <g class="fx-sway" :style="{ transformOrigin: `${g.W * 0.8}px -1px` }">
        <path :d="`M${g.W * 0.8} -1 V18`" stroke="#d9b25c" stroke-width="1.2" />
        <circle :cx="g.W * 0.8" cy="18.5" r="2.2" fill="url(#bk-brass)" />
        <path :d="`M${g.W * 0.8 - 2.6} 20 h5.2 l1.4 14 h-8 Z`" fill="#efe6cf" /><path :d="`M${g.W * 0.8 - 2.4} 22 V34 M${g.W * 0.8} 22 V34.5 M${g.W * 0.8 + 2.2} 22 V34`" stroke="#b8ad90" stroke-width=".5" />
      </g>
      <path v-if="!reduce" d="M0 0 q3 -3 5 0 q-1 3 -2.5 3.6 q-1.5 -.6 -2.5 -3.6 Z" fill="#f4b6c6" opacity="0">
        <animateMotion :path="`M${g.W * 0.1} -14 C${g.W * 0.9} ${g.H * 0.2} ${-g.W * 0.2} ${g.H * 0.5} ${g.W * 0.7} ${g.H * 0.95}`" dur="12s" begin="3s" repeatCount="indefinite" keyPoints="0;1;1" keyTimes="0;.6;1" rotate="auto" />
        <animate attributeName="opacity" values="0;.95;.95;0;0" keyTimes="0;.06;.52;.6;1" dur="12s" begin="3s" repeatCount="indefinite" />
      </path>
    </g>
    <!-- Джилл: снег перед книгой -->
    <g v-else-if="fx === 'jill' && !reduce" fill="#f2fbff">
      <circle v-for="(f, i) in flakes" :key="i" :r="f.r" opacity=".9">
        <animateMotion :path="`M${f.x} -8 q4 ${g.H / 4} 0 ${g.H / 2} t0 ${g.H / 2 + 12}`" :dur="f.d + 's'" :begin="f.b + 's'" repeatCount="indefinite" />
      </circle>
    </g>
  </g>
</template>

<script setup>
import { computed } from 'vue'
import { EMBLEM_PATHS } from './emblems.js'

// g — разметка корешка из BookSpine, paint — краска тиснения, look — вид книги
const props = defineProps({ fx: { type: String, required: true }, layer: { type: String, default: 'in' }, g: { type: Object, required: true }, id: { type: String, required: true }, paint: { type: String, default: '#d9b25c' }, look: { type: Object, required: true } })
const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
const P = { ...EMBLEM_PATHS, eyeShape: 'M1.5 12 Q12 2.5 22.5 12 Q12 21.5 1.5 12 Z' }
const T = (x, y) => `translate(${x.toFixed ? x.toFixed(2) : x} ${y.toFixed ? y.toFixed(2) : y})`
const S = s => `scale(${(s / 24).toFixed(3)}) translate(-12 -12)`
const spark = (x, y, r) => `M${x} ${y - r} L${x + r * 0.22} ${y - r * 0.22} L${x + r} ${y} L${x + r * 0.22} ${y + r * 0.22} L${x} ${y + r} L${x - r * 0.22} ${y + r * 0.22} L${x - r} ${y} L${x - r * 0.22} ${y - r * 0.22} Z`

// красная точка: бродит по корешку и замирает в перекрестье
const laserPath = computed(() => {
  const { W, H, emY } = props.g
  return `M${W * 0.3} ${H * 0.7} L${W * 0.7} ${H * 0.45} L${W * 0.25} ${H * 0.3} L${W * 0.65} ${emY + 10} L${W / 2} ${emY}`
})
// линия пульса через крест
const ecg = computed(() => {
  const { W, emY } = props.g, m = W / 2
  return `M2 ${emY} H${m - 9} l2 -2 l2 2 h1.5 l2 6 l3 -16 l2.6 13 l1.6 -3 H${W - 2}`
})
// капля с самой длинной сосульки
const drip = computed(() => {
  const ic = props.g.icicles || []
  if (!ic.length) return null
  const best = ic.reduce((a, b) => (b.ty - b.y0 > a.ty - a.y0 ? b : a))
  return { x: best.tx, y: best.ty }
})
const flakes = computed(() => {
  const W = props.g.W
  return [0.15, 0.42, 0.68, 0.88, 0.3, 0.75].map((k, i) => ({ x: (W * k).toFixed(1), r: 0.8 + (i % 3) * 0.45, d: 6 + (i % 4) * 1.3, b: i * 1.4 }))
})
</script>

<style>
/* анимации книг героев — общие, по классам; под «меньше анимаций» всё стоит */
.fx-spin { transform-box: fill-box; transform-origin: center; animation: fx-spin 14s linear infinite; }
.fx-spin.rev { animation-duration: 7.3s; animation-direction: reverse; }
.fx-spin.slow { animation-duration: 28s; }
.fx-pulse { transform-box: fill-box; transform-origin: center; animation: fx-pulse 4.2s ease-in-out infinite; }
.fx-twinkle { opacity: 0; transform-box: fill-box; transform-origin: center; animation: fx-twinkle 5.1s ease-in-out infinite; }
.fx-ember { opacity: .15; animation: fx-ember 3.2s ease-in-out infinite; }
.fx-look { animation: fx-look 7s ease-in-out infinite; }
.fx-blink { transform-box: fill-box; transform-origin: 50% 0; transform: scaleY(0); animation: fx-blink 5.3s ease-in-out infinite; }
.fx-gem { opacity: .25; transform-box: fill-box; transform-origin: center; animation: fx-gem 3.6s ease-in-out infinite; }
.fx-zero { transform-box: fill-box; transform-origin: center; animation: fx-zero 10s ease-in-out infinite; }
.fx-beat { transform-box: fill-box; transform-origin: center; animation: fx-beat 1.6s ease-out infinite; }
.fx-ecg { stroke-dasharray: 30 70; stroke-dashoffset: 100; animation: fx-ecg 1.6s linear infinite; }
.fx-halo { opacity: 0; animation: fx-halo 6s ease-in-out infinite; }
.fx-rune { opacity: 0; animation: fx-rune 6.6s ease-in-out infinite; transition: opacity .6s; }
.bc-book:hover .fx-runes, .bc-book.on .fx-runes { opacity: 0; transition: opacity .8s; }
.fx-runes { transition: opacity 1.4s; }
.fx-led { animation: fx-led 2.4s steps(1) infinite; }
.fx-steam { opacity: 0; transform-box: fill-box; transform-origin: center; animation: fx-steam 3.75s ease-out infinite; }
.fx-sway { animation: fx-sway 4.4s ease-in-out infinite; }
@keyframes fx-spin { to { transform: rotate(360deg); } }
@keyframes fx-pulse { 0%, 100% { transform: scale(1); opacity: .92; } 50% { transform: scale(1.12); opacity: 1; } }
@keyframes fx-twinkle { 0%, 62%, 100% { opacity: 0; transform: scale(.3) rotate(0); } 74% { opacity: .95; transform: scale(1) rotate(25deg); } 86% { opacity: 0; transform: scale(.4) rotate(45deg); } }
@keyframes fx-ember { 0%, 100% { opacity: .12; } 50% { opacity: .85; } }
@keyframes fx-look { 0%, 12% { transform: translateX(0); } 22%, 38% { transform: translateX(-2.6px); } 48%, 62% { transform: translateX(2.6px); } 72%, 100% { transform: translateX(0); } }
@keyframes fx-blink { 0%, 86%, 100% { transform: scaleY(0); } 90%, 92% { transform: scaleY(1); } }
@keyframes fx-gem { 0%, 100% { opacity: .2; transform: scale(.85); } 50% { opacity: .75; transform: scale(1.1); } }
@keyframes fx-zero { 0%, 100% { transform: rotate(0); } 20% { transform: rotate(-8deg); } 45% { transform: rotate(6deg); } 70% { transform: rotate(0); } }
@keyframes fx-beat { 0% { transform: scale(1); } 10% { transform: scale(1.16); } 20% { transform: scale(1); } 32% { transform: scale(1.1); } 44%, 100% { transform: scale(1); } }
@keyframes fx-ecg { to { stroke-dashoffset: 0; } }
@keyframes fx-halo { 0%, 100% { opacity: 0; } 50% { opacity: .55; } }
@keyframes fx-rune { 0%, 100% { opacity: 0; } 30%, 50% { opacity: 1; } }
@keyframes fx-led { 0%, 70% { opacity: 1; } 71%, 100% { opacity: .15; } }
@keyframes fx-steam { 0% { opacity: 0; transform: translate(0, 0) scale(.4); } 18% { opacity: .55; } 100% { opacity: 0; transform: translate(5px, -30px) scale(1.9); } }
@keyframes fx-sway { 0%, 100% { transform: rotate(-5deg); } 50% { transform: rotate(5deg); } }
@media (prefers-reduced-motion: reduce) {
  .fx-spin, .fx-pulse, .fx-twinkle, .fx-ember, .fx-look, .fx-blink, .fx-gem, .fx-zero, .fx-beat, .fx-ecg, .fx-halo, .fx-rune, .fx-led, .fx-steam, .fx-sway { animation: none; }
  .fx-rune, .fx-halo { opacity: .7; }
}
</style>
