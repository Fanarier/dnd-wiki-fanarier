<template>
  <!-- живые эффекты темы: на карточке — пока на неё наведены, в просмотрщике — фоном -->
  <div class="hfx" :class="[theme, 'm-' + mode]" aria-hidden="true">
    <!-- ПАР: клубы из нижних углов и струйка из клапана у портрета -->
    <template v-if="theme === 'steam'">
      <i v-for="(p, n) in parts" :key="n" class="puff" :style="p" />
      <i v-if="card" class="jet" />
    </template>

    <!-- ТЁМНАЯ МАГИЯ: печать над портретом, дым снизу, искры -->
    <template v-else-if="theme === 'demon'">
      <svg class="sigil" viewBox="-50 -50 100 100">
        <circle r="46" /><circle r="40" class="dash" /><path d="M0-40 23.5 32.4-38-12.4h76L-23.5 32.4Z" />
        <g class="runes"><text v-for="(r, n) in RUNES" :key="n" :transform="`rotate(${n * 45}) translate(0 -43)`">{{ r }}</text></g>
      </svg>
      <i v-for="(p, n) in parts" :key="n" :class="p.k" :style="p" />
    </template>

    <!-- ЛЁД: снег, иней ползёт из углов, блик по льду -->
    <template v-else-if="theme === 'frost'">
      <svg v-for="(m, c) in (card ? RIME : {})" :key="c" class="rime" :class="c" viewBox="0 0 60 60">
        <path :transform="m" d="M0 0 52 52M0 0 58 22M0 0 22 58M14 14l10-2M14 14l-2 10M30 30l12-3M30 30l-3 12M10 4l8 4M4 10l4 8M40 15l8-1M15 40l-1 8" />
      </svg>
      <i v-for="(p, n) in parts" :key="n" class="flake" :style="p" />
      <i class="sheen" />
    </template>

    <!-- СОЛНЦЕ: вращающиеся лучи, пылинки света, блики -->
    <template v-else-if="theme === 'sun'">
      <i class="rays" />
      <i v-for="(p, n) in parts" :key="n" class="mote" :style="p" />
      <template v-if="card"><i class="flare f1" /><i class="flare f2" /><i class="flare f3" /></template>
    </template>

    <!-- БАГРЯНАЯ ЦИ: аура вокруг портрета, языки пламени, энсо, искры -->
    <template v-else-if="theme === 'chi'">
      <i v-if="card" class="aura" />
      <svg class="enso" viewBox="0 0 100 100"><path d="M71 16C55 6 30 9 18 28 5 48 13 76 36 86c21 9 46 0 56-21 7-15 4-32-6-43" /></svg>
      <i v-for="(p, n) in parts" :key="n" :class="p.k" :style="p" />
    </template>

    <!-- МАГИЧЕСКИЕ КАРТЫ: светящиеся горизонтали и порхающие листы -->
    <template v-else-if="theme === 'maps'">
      <svg class="contours" viewBox="0 0 300 200" preserveAspectRatio="none">
        <path d="M-10 150c50-40 90 10 140-20s80-50 180-10" /><path d="M-10 175c60-30 100 15 150-10s90-40 170-5" />
        <path d="M40 120c30-30 70-20 80 5s-40 45-70 25-20-20-10-30z" /><path d="M200 70c25-15 60 0 55 25s-45 30-60 10 0-30 5-35z" />
      </svg>
      <i v-for="(p, n) in parts" :key="n" class="sheet" :style="p"><b /><b /><b /></i>
    </template>

    <!-- ФИОЛЕТОВЫЙ ДРАКОН: драконий огонь снизу, угли, блеск по чешуе -->
    <template v-else-if="theme === 'dragon'">
      <i class="sweep" />
      <i v-for="(p, n) in parts" :key="n" :class="p.k" :style="p" />
    </template>

    <!-- СТРЕЛОК: прицел за мышкой, трассеры, дальномер -->
    <template v-else-if="theme === 'marksman'">
      <i class="scan" />
      <i v-for="(p, n) in parts" :key="n" class="tracer" :style="p" />
      <svg v-if="card" class="reticle" viewBox="-30 -30 60 60">
        <circle r="22" /><circle r="12" stroke-dasharray="3 3" /><path d="M0-29v12M0 17v12M-29 0h12M17 0h12" /><circle r="1.6" class="dot" />
      </svg>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  theme: { type: String, required: true },
  mode: { type: String, default: 'card' } // card | ambient
})
const card = computed(() => props.mode === 'card')
const RUNES = ['ᚦ', 'ᛉ', 'ᛟ', 'ᚱ', 'ᛞ', 'ᚹ', 'ᛇ', 'ᛝ']
// иней в каждом углу — один и тот же узор, отражённый
const RIME = { tl: '', tr: 'matrix(-1 0 0 1 60 0)', bl: 'matrix(1 0 0 -1 0 60)', br: 'matrix(-1 0 0 -1 60 60)' }

// одинаковый «случайный» узор при каждом наведении
function rng(seed) {
  return () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
}
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
  const many = (n, f) => Array.from({ length: Math.round(n * k) }, (_, i) => f(i))
  switch (props.theme) {
    case 'steam':
      return many(14, i => {
        const left = (i >> 1) % 2 === 0
        return { left: pct(left ? -0.06 + r() * 0.2 : 0.86 + r() * 0.2), '--dx': `${(left ? 1 : -1) * (20 + r() * 60)}px`, '--sz': `${60 + r() * 60}px`, ...timing(r, 2.6, 1.6, i) }
      })
    case 'demon':
      return [
        ...many(8, i => ({ k: 'smoke', left: pct(r() * 0.9 - 0.05), '--sz': `${80 + r() * 70}px`, '--dx': `${(r() - 0.5) * 60}px`, ...timing(r, 3.5, 2, i) })),
        ...many(12, i => ({ k: 'ember', left: pct(0.05 + r() * 0.9), '--dx': `${(r() - 0.5) * 50}px`, background: r() < 0.5 ? 'var(--ta)' : 'var(--tb)', ...timing(r, 2.2, 1.8, i) }))
      ]
    case 'frost':
      return many(16, () => ({ left: pct(r()), '--sz': `${2 + r() * 4}px`, '--dx': `${(r() - 0.5) * 70}px`, animationDelay: s(-r() * 5), animationDuration: s(4 + r() * 3) }))
    case 'sun':
      return many(16, i => ({ left: pct(0.04 + r() * 0.92), top: pct(0.3 + r() * 0.7), '--sz': `${2 + r() * 4}px`, '--dx': `${(r() - 0.5) * 40}px`, ...timing(r, 3, 2.5, i) }))
    case 'chi':
      return [
        ...many(10, i => ({ k: 'flame', left: pct(-0.04 + (i / 10) * 1.08 + r() * 0.04), '--sz': `${26 + r() * 20}px`, animationDelay: s(-r() * 1.2), animationDuration: s(0.9 + r() * 0.6) })),
        ...many(14, i => ({ k: 'spark', left: pct(0.03 + r() * 0.94), ...timing(r, 1.1, 1.1, i) }))
      ]
    case 'maps':
      return many(7, i => ({ left: pct(i % 2 ? 0.8 + r() * 0.14 : 0.02 + r() * 0.14), '--dx': `${(i % 2 ? -1 : 1) * (10 + r() * 30)}px`, '--rot': `${(r() - 0.5) * 60}deg`, '--rot2': `${(r() - 0.5) * 300}deg`, ...timing(r, 4.5, 2.5, i) }))
    case 'dragon':
      return [
        ...many(8, i => ({ k: 'dflame', left: pct(-0.05 + (i / 8) * 1.05 + r() * 0.05), '--sz': `${60 + r() * 50}px`, animationDelay: s(r() * 1.6), animationDuration: s(1.6 + r() * 1) })),
        ...many(14, i => ({ k: 'ember', left: pct(0.04 + r() * 0.92), '--dx': `${(r() - 0.5) * 60}px`, background: r() < 0.6 ? 'var(--ta)' : 'var(--tb)', ...timing(r, 2.4, 2, i) }))
      ]
    case 'marksman':
      return many(3, () => ({ top: pct(0.12 + r() * 0.76), animationDelay: s(0.3 + r() * 2.4), animationDuration: s(2.2 + r() * 1.6) }))
  }
  return []
})
</script>

<style scoped>
.hfx { position: absolute; inset: 0; z-index: 4; overflow: hidden; pointer-events: none; border-radius: inherit; --rise: 330px; --fall: 560px; --w: 330px; --port-top: 12px; --port-h: 250px; }
.hfx.m-ambient { z-index: 0; --rise: 75vh; --fall: 110vh; --w: 100vw; }
.hfx > * { position: absolute; display: block; }
.hfx svg { overflow: visible; fill: none; }

/* ---------- пар ---------- */
.puff { bottom: -40px; width: var(--sz); height: var(--sz); margin-left: calc(var(--sz) / -2); border-radius: 50%; background: radial-gradient(circle, rgba(240, 244, 247, .85), rgba(205, 218, 228, .35) 45%, transparent 70%); filter: blur(3px); opacity: 0; animation: puff linear infinite both; }
.m-ambient .puff { --sz: 170px !important; filter: blur(10px); }
@keyframes puff {
  0% { opacity: 0; transform: translate(0, 0) scale(.3); }
  15% { opacity: .8; }
  100% { opacity: 0; transform: translate(var(--dx), calc(var(--rise) * -1)) scale(2.4); }
}
.jet { top: 150px; right: 4px; width: 90px; height: 20px; border-radius: 50%; transform-origin: right center; background: radial-gradient(ellipse at right, rgba(240, 244, 247, .8), rgba(220, 230, 236, .3) 40%, transparent 70%); filter: blur(2px); animation: jet 2.4s ease-out infinite; }
@keyframes jet {
  0%, 55% { opacity: 0; transform: scaleX(.1); }
  62% { opacity: .9; }
  100% { opacity: 0; transform: scaleX(1.4) translateY(-14px); }
}

/* ---------- тёмная магия ---------- */
.sigil { top: calc(var(--port-top) + var(--port-h) / 2 - 115px); left: calc(50% - 115px); width: 230px; height: 230px; stroke: var(--ta); stroke-width: .9; opacity: .45; mix-blend-mode: screen; filter: drop-shadow(0 0 4px var(--ta)); animation: sigil-in .9s ease-out both, spin 16s linear infinite; }
.sigil circle, .sigil path { stroke-dasharray: 400; animation: draw 1.2s ease-out both; }
.sigil .dash { stroke-dasharray: 2 4; animation: none; }
.sigil text { fill: var(--tb); stroke: none; font-size: 6px; text-anchor: middle; dominant-baseline: middle; }
.m-ambient .sigil { top: calc(50% - 40vmin); left: calc(50% - 40vmin); width: 80vmin; height: 80vmin; opacity: .22; }
@keyframes sigil-in { from { opacity: 0; transform: scale(.7) rotate(-40deg); } }
@keyframes draw { from { stroke-dashoffset: 400; } to { stroke-dashoffset: 0; } }
.smoke { bottom: calc(var(--sz) / -2); width: var(--sz); height: var(--sz); margin-left: calc(var(--sz) / -2); border-radius: 50%; background: radial-gradient(circle, rgba(18, 2, 12, .95), rgba(120, 16, 56, .35) 50%, transparent 70%); filter: blur(8px); opacity: 0; animation: smoke ease-in-out infinite both; }
.m-ambient .smoke { --sz: 260px !important; filter: blur(20px); }
@keyframes smoke {
  0% { opacity: 0; transform: translate(0, 0) scale(.5); }
  25% { opacity: .9; }
  100% { opacity: 0; transform: translate(var(--dx), calc(var(--rise) * -.65)) scale(1.6); }
}
.ember { bottom: 0; width: 3px; height: 3px; border-radius: 50%; box-shadow: 0 0 6px 1px currentColor; color: var(--ta); opacity: 0; animation: ember ease-out infinite both; }
@keyframes ember {
  0% { opacity: 0; transform: translate(0, 0); }
  15% { opacity: 1; }
  50% { opacity: .5; }
  65% { opacity: 1; }
  100% { opacity: 0; transform: translate(var(--dx), calc(var(--rise) * -1)); }
}

/* ---------- лёд ---------- */
.rime { width: 84px; height: 84px; stroke: #e9f8ff; stroke-width: 1; stroke-linecap: round; opacity: .65; filter: drop-shadow(0 0 3px #7fd6ff); animation: rime .9s cubic-bezier(.2, .8, .2, 1) both; }
.rime.tl { top: 0; left: 0; transform-origin: 0 0; }
.rime.tr { top: 0; right: 0; transform-origin: 100% 0; }
.rime.bl { bottom: 0; left: 0; transform-origin: 0 100%; }
.rime.br { bottom: 0; right: 0; transform-origin: 100% 100%; }
@keyframes rime { from { transform: scale(0); opacity: 0; } }
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
.rays { top: calc(var(--port-top) - 230px); left: calc(50% - 260px); width: 520px; height: 520px; border-radius: 50%; background: repeating-conic-gradient(from 0deg, rgba(255, 214, 110, .3) 0 5deg, transparent 5deg 15deg); -webkit-mask: radial-gradient(circle, #000 8%, transparent 68%); mask: radial-gradient(circle, #000 8%, transparent 68%); mix-blend-mode: screen; opacity: 0; animation: fade-in .8s ease-out forwards, spin 24s linear infinite; }
.m-ambient .rays { top: -60vmax; left: calc(50% - 80vmax); width: 160vmax; height: 160vmax; opacity: .5; animation: spin 60s linear infinite; }
.mote { width: var(--sz); height: var(--sz); border-radius: 50%; background: #fff3c4; box-shadow: 0 0 8px 2px rgba(255, 201, 74, .8); opacity: 0; animation: mote ease-in-out infinite both; }
@keyframes mote {
  0% { opacity: 0; transform: translate(0, 0); }
  30% { opacity: 1; }
  100% { opacity: 0; transform: translate(var(--dx), -110px); }
}
.flare { border-radius: 50%; mix-blend-mode: screen; animation: flare 2.6s ease-in-out infinite alternate; }
.f1 { top: 24px; left: 62%; width: 70px; height: 70px; background: radial-gradient(circle, rgba(255, 246, 210, .9), rgba(255, 201, 74, .25) 40%, transparent 70%); }
.f2 { top: 120px; left: 40%; width: 26px; height: 26px; background: radial-gradient(circle, transparent 40%, rgba(255, 170, 70, .5) 55%, transparent 70%); animation-delay: .4s; }
.f3 { top: 170px; left: 28%; width: 14px; height: 14px; background: rgba(255, 220, 140, .45); animation-delay: .8s; }
@keyframes flare { from { opacity: .3; transform: scale(.85); } to { opacity: 1; transform: scale(1.15); } }

/* ---------- багряная ци ---------- */
.aura { top: var(--port-top); left: 12px; right: 12px; height: var(--port-h); border-radius: 12px; animation: aura .5s ease-in-out infinite alternate; }
@keyframes aura {
  from { box-shadow: inset 0 0 18px 2px rgba(236, 47, 66, .55), 0 0 14px rgba(236, 47, 66, .45); }
  to { box-shadow: inset 0 0 30px 6px rgba(255, 110, 70, .6), 0 0 26px rgba(236, 47, 66, .6); }
}
.flame { bottom: calc(var(--sz) * -.5); width: var(--sz); height: calc(var(--sz) * 1.7); margin-left: calc(var(--sz) / -2); border-radius: 50% 50% 45% 45% / 65% 65% 35% 35%; background: radial-gradient(ellipse at 50% 75%, rgba(255, 190, 120, .8), rgba(236, 47, 66, .6) 40%, transparent 70%); filter: blur(4px); mix-blend-mode: screen; transform-origin: 50% 100%; animation: flame ease-in-out infinite alternate both; }
@keyframes flame { from { opacity: .4; transform: scaleY(.6) translateY(10px); } to { opacity: .95; transform: scaleY(1.2) skewX(6deg); } }
.spark { bottom: 0; width: 2px; height: 16px; border-radius: 2px; background: linear-gradient(transparent, #ffb38a, #ec2f42); box-shadow: 0 0 6px #ec2f42; opacity: 0; animation: spark ease-out infinite both; }
.m-ambient .spark { height: 30px; }
.m-ambient .flame { --sz: 90px !important; filter: blur(10px); }
@keyframes spark {
  0% { opacity: 0; transform: translateY(0); }
  20% { opacity: 1; }
  100% { opacity: 0; transform: translateY(calc(var(--rise) * -1.1)); }
}
.enso { top: calc(var(--port-top) + 18px); left: calc(50% - 107px); width: 214px; height: 214px; stroke: var(--ta); stroke-width: 5; stroke-linecap: round; opacity: .55; mix-blend-mode: screen; filter: drop-shadow(0 0 6px var(--ta)); stroke-dasharray: 300; animation: enso 1.3s cubic-bezier(.5, 0, .2, 1) both, breathe 2.4s ease-in-out 1.3s infinite alternate; }
.m-ambient .enso { top: calc(50% - 38vmin); left: calc(50% - 38vmin); width: 76vmin; height: 76vmin; opacity: .18; }
@keyframes enso { from { stroke-dashoffset: 300; } to { stroke-dashoffset: 0; } }
@keyframes breathe { to { opacity: .25; } }

/* ---------- магические карты ---------- */
.contours { left: 0; right: 0; bottom: 0; width: 100%; height: 42%; stroke: var(--ta); stroke-width: 1.2; opacity: .38; filter: drop-shadow(0 0 3px var(--ta)); }
.contours path { stroke-dasharray: 14 10; animation: march 3s linear infinite; }
.contours path:nth-child(even) { animation-direction: reverse; }
@keyframes march { to { stroke-dashoffset: -96; } }
.sheet { bottom: -50px; width: 30px; height: 40px; padding: 7px 5px; display: grid; align-content: start; gap: 5px; border-radius: 3px; background: linear-gradient(160deg, #f1dfae, #c9ad6c); box-shadow: 0 0 0 1px rgba(79, 216, 198, .7), 0 0 12px rgba(79, 216, 198, .55), 0 6px 10px rgba(0, 0, 0, .5); opacity: 0; animation: flutter ease-in-out infinite both; }
.m-ambient .sheet { width: 60px; height: 80px; padding: 14px 10px; gap: 10px; }
.sheet b { display: block; height: 2px; border-radius: 2px; background: #1f8f81; }
.sheet b:nth-child(2) { width: 70%; } .sheet b:nth-child(3) { width: 85%; }
@keyframes flutter {
  0% { opacity: 0; transform: translate(0, 0) rotate(var(--rot)) rotateY(0); }
  15% { opacity: 1; }
  50% { transform: translate(var(--dx), calc(var(--rise) * -.55)) rotate(calc(var(--rot) + 20deg)) rotateY(180deg); }
  85% { opacity: .9; }
  100% { opacity: 0; transform: translate(0, calc(var(--rise) * -1.1)) rotate(var(--rot2)) rotateY(360deg); }
}

/* ---------- фиолетовый дракон ---------- */
.sweep { inset: -20% -60%; background: linear-gradient(110deg, transparent 40%, rgba(169, 112, 255, .22) 48%, rgba(227, 184, 255, .35) 50%, transparent 58%); mix-blend-mode: screen; animation: sweep 2.8s ease-in-out infinite; }
@keyframes sweep { from { transform: translateX(-40%); } to { transform: translateX(40%); } }
.dflame { bottom: calc(var(--sz) * -.6); width: var(--sz); height: calc(var(--sz) * 1.4); margin-left: calc(var(--sz) / -2); border-radius: 50% 50% 40% 40% / 60% 60% 40% 40%; background: radial-gradient(ellipse at 50% 80%, rgba(240, 210, 255, .85), rgba(169, 112, 255, .6) 35%, rgba(90, 40, 170, .25) 55%, transparent 70%); filter: blur(5px); mix-blend-mode: screen; transform-origin: 50% 100%; animation: dflame ease-in-out infinite alternate both; }
.m-ambient .dflame { --sz: 220px !important; filter: blur(14px); }
@keyframes dflame { from { opacity: .35; transform: scale(.7, .5); } to { opacity: .9; transform: scale(1, 1.15) skewX(-5deg); } }

/* ---------- стрелок ---------- */
.reticle { left: 0; top: 0; width: 64px; height: 64px; margin: -32px 0 0 -32px; stroke: var(--ta); stroke-width: 1.3; filter: drop-shadow(0 0 3px rgba(255, 75, 58, .8)); transform: translate(var(--mx, 140px), var(--my, 130px)); transition: transform .12s ease-out; animation: fade-in .3s both; }
.reticle > circle:first-child { animation: lock 1.6s ease-in-out infinite; transform-origin: center; }
.reticle .dot { fill: var(--ta); stroke: none; }
@keyframes lock { 0%, 100% { transform: scale(1); } 50% { transform: scale(.85); } }
.tracer { left: 0; width: 70px; height: 2px; border-radius: 2px; background: linear-gradient(90deg, transparent, #ffd28a, #fff); box-shadow: 0 0 6px #ffb347; opacity: 0; animation: tracer ease-in infinite both; }
.m-ambient .tracer { width: 160px; }
@keyframes tracer {
  0% { opacity: 0; transform: translateX(-80px); }
  4% { opacity: 1; }
  18% { opacity: 1; transform: translateX(var(--w)); }
  19%, 100% { opacity: 0; transform: translateX(var(--w)); }
}
.scan { left: 0; right: 0; top: 0; height: 2px; background: linear-gradient(90deg, transparent, rgba(255, 75, 58, .7), transparent); box-shadow: 0 0 8px rgba(255, 75, 58, .6); animation: scan 2.6s ease-in-out infinite alternate; }
.m-card .scan { left: 12px; right: 12px; top: var(--port-top); }
@keyframes scan { from { transform: translateY(0); } to { transform: translateY(var(--port-h)); } }
.m-ambient .scan { animation-name: scan-amb; animation-duration: 6s; }
@keyframes scan-amb { to { transform: translateY(100vh); } }

@keyframes spin { to { rotate: 360deg; } }
@keyframes fade-in { to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .hfx { display: none; } }
</style>
