<template>
  <!-- корешок книги-листа: переплёт, потёртости, рубцы, название, знак и украшения — всё из «вида книги» -->
  <svg class="bs" :width="g.W" :height="g.H" :viewBox="`0 0 ${g.W} ${g.H}`" aria-hidden="true">
    <defs>
      <linearGradient :id="id + 'r'" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stop-color="#000" stop-opacity=".5" /><stop offset=".16" stop-color="#000" stop-opacity=".08" />
        <stop offset=".36" stop-color="#fff" stop-opacity=".13" /><stop offset=".58" stop-color="#000" stop-opacity="0" />
        <stop offset="1" stop-color="#000" stop-opacity=".55" />
      </linearGradient>
      <clipPath :id="id + 'c'"><rect :width="g.W" :height="g.H" rx="3.5" /></clipPath>
      <radialGradient :id="id + 'g'" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".9" /><stop offset=".3" :stop-color="gemColor" /><stop offset="1" :stop-color="mix(gemColor, '#000000', 0.65)" /></radialGradient>
    </defs>

    <!-- то, что торчит над обрезом: вшитые листы и ярлычки -->
    <g v-if="has('loose')">
      <rect v-for="(p, i) in g.loose" :key="'l' + i" :x="p.x" :y="p.y" :width="p.w" height="12" :fill="p.c" :transform="`rotate(${p.r} ${p.x + p.w / 2} 2)`" stroke="#00000033" stroke-width=".5" />
    </g>
    <g v-if="has('tabs')">
      <rect v-for="(p, i) in g.tabs" :key="'t' + i" :x="p.x" y="-6" width="7" height="12" rx="1.5" :fill="p.c" stroke="#00000044" stroke-width=".5" />
    </g>

    <g :clip-path="`url(#${id}c)`">
      <rect :width="g.W" :height="g.H" :fill="look.c" />
      <!-- фактура переплёта -->
      <rect v-if="look.m === 'leather'" :width="g.W" :height="g.H" filter="url(#bk-grain)" opacity=".5" />
      <rect v-else-if="look.m === 'cloth'" :width="g.W" :height="g.H" fill="url(#bk-weave)" />
      <rect v-else-if="look.m === 'scales'" :width="g.W" :height="g.H" fill="url(#bk-scales)" />
      <g v-else>
        <rect :width="g.W" :height="g.H" fill="url(#bk-brush)" />
        <g v-for="y in g.seams" :key="'s' + y"><line x1="0" :x2="g.W" :y1="y" :y2="y" stroke="#000" stroke-opacity=".55" stroke-width="1.4" /><line x1="0" :x2="g.W" :y1="y + 1.4" :y2="y + 1.4" stroke="#fff" stroke-opacity=".16" /></g>
      </g>

      <!-- потёртости по краям и уголкам -->
      <g v-if="look.wear" filter="url(#bk-blur)" :opacity="[0, 0.3, 0.52, 0.78][look.wear]" :fill="worn">
        <ellipse :cx="g.W / 2" cy="0" :rx="g.W * 0.7" :ry="7 + look.wear * 3" />
        <ellipse :cx="g.W / 2" :cy="g.H" :rx="g.W * 0.7" :ry="6 + look.wear * 3" />
        <ellipse cx="0" :cy="g.H * 0.5" :rx="2 + look.wear * 1.6" :ry="g.H * 0.46" />
        <ellipse :cx="g.W" :cy="g.H * 0.5" :rx="2 + look.wear * 1.6" :ry="g.H * 0.46" />
        <ellipse v-if="look.wear > 1" :cx="g.W * 0.62" :cy="g.H * 0.44" :rx="g.W * 0.2" :ry="g.H * 0.16" opacity=".5" />
      </g>
      <g v-if="has('stain')" filter="url(#bk-blur)">
        <ellipse :cx="g.W * 0.7" :cy="g.H * 0.3" :rx="g.W * 0.36" :ry="g.H * 0.09" :fill="lum(look.c) > 0.5 ? '#5a4a30' : '#d8d2c0'" opacity=".22" />
        <ellipse :cx="g.W * 0.3" :cy="g.H * 0.72" :rx="g.W * 0.3" :ry="g.H * 0.06" :fill="lum(look.c) > 0.5 ? '#3a2c1c' : '#e6e0d0'" opacity=".18" />
      </g>

      <!-- узоры по переплёту -->
      <g v-if="has('stars')" :stroke="look.f" :fill="look.f" opacity=".75">
        <path :d="g.starLines" fill="none" stroke-width=".5" stroke-opacity=".7" />
        <circle v-for="(p, i) in g.stars" :key="'st' + i" :cx="p.x" :cy="p.y" :r="p.r" stroke="none" />
      </g>
      <g v-if="has('waves')" fill="none" :stroke="look.f" stroke-width="1.1" stroke-linecap="round" opacity=".6">
        <path v-for="(d, i) in g.waves" :key="'w' + i" :d="d" />
      </g>
      <g v-if="has('rivets')">
        <g v-for="(p, i) in g.rivets" :key="'rv' + i"><circle :cx="p.x" :cy="p.y" r="2.4" fill="#0006" /><circle :cx="p.x - 0.4" :cy="p.y - 0.5" r="1.9" :fill="mix(look.c, '#ffffff', 0.45)" /></g>
      </g>

      <!-- рубцы корешка -->
      <g v-for="(y, i) in g.bands" :key="'b' + i">
        <rect x="0" :y="y - 3" :width="g.W" height="6" :fill="mix(look.c, '#000000', 0.3)" />
        <line x1="0" :x2="g.W" :y1="y - 3" :y2="y - 3" stroke="#fff" stroke-opacity=".22" />
        <line x1="0" :x2="g.W" :y1="y + 3.4" :y2="y + 3.4" stroke="#000" stroke-opacity=".5" />
        <template v-if="look.title === 'foil'">
          <line x1="0" :x2="g.W" :y1="y - 6" :y2="y - 6" :stroke="look.f" stroke-opacity=".8" stroke-width=".8" />
          <line x1="0" :x2="g.W" :y1="y + 6.4" :y2="y + 6.4" :stroke="look.f" stroke-opacity=".8" stroke-width=".8" />
        </template>
      </g>

      <!-- металлические уголки и застёжки -->
      <g v-if="has('corners')">
        <rect x="0" y="0" :width="g.W" height="9" :fill="metal" /><line x1="0" :x2="g.W" y1="9" y2="9" stroke="#000" stroke-opacity=".5" />
        <rect x="0" :y="g.H - 9" :width="g.W" height="9" :fill="metal" /><line x1="0" :x2="g.W" :y1="g.H - 9" :y2="g.H - 9" stroke="#fff" stroke-opacity=".35" />
      </g>
      <g v-if="has('clasp')">
        <g v-for="y in [g.H * 0.3, g.H * 0.7]" :key="'cl' + y">
          <rect x="0" :y="y - 3.5" :width="g.W" height="7" :fill="brass" /><line x1="0" :x2="g.W" :y1="y - 3.5" :y2="y - 3.5" stroke="#fff" stroke-opacity=".4" /><line x1="0" :x2="g.W" :y1="y + 3.5" :y2="y + 3.5" stroke="#000" stroke-opacity=".5" />
          <circle cx="5" :cy="y" r="1.5" fill="#0007" /><circle :cx="g.W - 5" :cy="y" r="1.5" fill="#0007" />
        </g>
      </g>

      <!-- борозды и цепь — под названием, чтобы имя читалось -->
      <g v-if="has('claws')" stroke-linecap="round" fill="none">
        <g v-for="(d, i) in g.claws" :key="'cw' + i"><path :d="d" stroke="#000" stroke-opacity=".7" stroke-width="3" /><path :d="d" :stroke="mix(look.c, '#ffffff', 0.5)" stroke-opacity=".5" stroke-width=".7" transform="translate(1.6 0.6)" /></g>
      </g>
      <g v-if="has('chain')" fill="none" stroke-linecap="round">
        <g v-for="(d, i) in g.chains" :key="'ch' + i"><path :d="d" stroke="#14110e" stroke-width="5" /><path :d="d" stroke="#9aa0a8" stroke-width="3.4" stroke-dasharray="5.5 3" /><path :d="d" stroke="#fff" stroke-opacity=".5" stroke-width=".8" stroke-dasharray="5.5 3" transform="translate(-.6 -.8)" /></g>
      </g>

      <!-- знак -->
      <g v-if="look.em" :transform="`translate(${g.W / 2 - g.es / 2} ${g.emY - g.es / 2}) scale(${g.es / 24})`" :fill="markFill" :stroke="markFill" :filter="glowing ? `url(#bk-glow)` : null" :style="glowing ? { color: look.glow } : null">
        <path :d="EMBLEM_PATHS[look.em]" :stroke-width="EMBLEM_FILL[look.em] ? 1.1 : 1.7" stroke-linejoin="round" stroke-linecap="round" fill-rule="evenodd" :fill-opacity="EMBLEM_FILL[look.em] ? 1 : 0" />
      </g>
      <circle v-if="has('gem')" :cx="g.W / 2" :cy="g.gemY" r="6.5" :fill="`url(#${id}g)`" :stroke="look.f" stroke-width="1.3" />

      <!-- название -->
      <g v-if="look.title === 'label'" :transform="`rotate(${g.tilt} ${g.W / 2} ${g.tc})`">
        <rect :x="g.W / 2 - g.lw / 2" :y="g.t0 - 3" :width="g.lw" :height="g.t1 - g.t0 + 6" rx="1.5" fill="#e4d6b0" stroke="#5a4526" stroke-width=".7" />
        <rect :x="g.W / 2 - g.lw / 2" :y="g.t0 - 3" :width="g.lw" :height="g.t1 - g.t0 + 6" rx="1.5" filter="url(#bk-grain)" opacity=".25" />
      </g>
      <g v-if="look.title !== 'blind'" :transform="`translate(${g.W / 2} ${g.tc}) rotate(${-90 + (look.title === 'ink' ? g.tilt : 0)})`" :filter="glowing && look.title === 'foil' ? 'url(#bk-glow)' : null" :style="glowing ? { color: look.glow } : null">
        <text v-for="(ln, i) in g.lines" :key="'ln' + i" x="0" :y="ln.dy" text-anchor="middle" dominant-baseline="central" :font-size="g.fs" :textLength="ln.len || null" lengthAdjust="spacingAndGlyphs"
          :class="['bs-title', look.title, { light: lum(look.c) > 0.5 }]" :fill="titleFill">{{ ln.t }}</text>
      </g>
      <g v-if="has('runes')" fill="none" :stroke="look.glow || look.f" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" filter="url(#bk-glow)" :style="{ color: look.glow || look.f }">
        <path v-for="(r, i) in g.runes" :key="'ru' + i" :d="r.d" :transform="`translate(${r.x} ${r.y})`" />
      </g>

      <!-- уровень -->
      <g v-if="level" :transform="`translate(${g.W / 2} ${g.lvY})`">
        <ellipse v-if="look.title === 'foil' || look.title === 'blind'" rx="10" ry="8" fill="#0003" :stroke="markFill" stroke-width="1" />
        <text y=".5" text-anchor="middle" dominant-baseline="central" font-size="10.5" class="bs-lv" :fill="markFill">{{ level }}</text>
      </g>

      <!-- украшения поверх -->
      <g v-if="has('strap')">
        <rect x="0" :y="g.strapY - 6.5" :width="g.W" height="13" fill="#3a2819" /><rect x="0" :y="g.strapY - 6.5" :width="g.W" height="13" filter="url(#bk-grain)" opacity=".4" />
        <line x1="0" :x2="g.W" :y1="g.strapY - 4.4" :y2="g.strapY - 4.4" stroke="#c9b48a" stroke-opacity=".6" stroke-dasharray="2.5 2" stroke-width=".7" />
        <line x1="0" :x2="g.W" :y1="g.strapY + 4.4" :y2="g.strapY + 4.4" stroke="#c9b48a" stroke-opacity=".6" stroke-dasharray="2.5 2" stroke-width=".7" />
        <rect :x="g.W / 2 - 7" :y="g.strapY - 8.5" width="14" height="17" rx="2" fill="none" :stroke="brass" stroke-width="2.4" /><line :x1="g.W / 2 - 6" :x2="g.W / 2 + 4" :y1="g.strapY" :y2="g.strapY" :stroke="mix(brass, '#ffffff', 0.4)" stroke-width="1.6" stroke-linecap="round" />
      </g>
      <g v-if="has('stab')" stroke="#f1e9d2" stroke-linecap="round">
        <line x1="5" x2="5" y1="6" :y2="g.H - 6" stroke-width="1.1" stroke-opacity=".85" />
        <g v-for="y in g.stabs" :key="'sb' + y"><line x1="0" :x2="g.W" :y1="y" :y2="y" stroke-width="1.3" /><line x1="0" :x2="g.W" :y1="y + 2.2" :y2="y + 2.2" stroke-width=".6" stroke-opacity=".6" /></g>
      </g>
      <g v-if="has('stitch')" stroke-linecap="round">
        <path :d="g.crack" fill="none" stroke="#0b0704" stroke-width="2.2" stroke-opacity=".85" />
        <path :d="g.crack" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width=".6" transform="translate(1.6 0)" />
        <line v-for="(s, i) in g.stitches" :key="'sx' + i" :x1="s.x1" :y1="s.y1" :x2="s.x2" :y2="s.y2" :stroke="s.old ? '#8f8266' : '#e0d2a8'" :stroke-width="s.old ? 1 : 1.5" />
      </g>

      <!-- выпуклость корешка -->
      <rect :width="g.W" :height="g.H" :fill="`url(#${id}r)`" />
      <line x1="0" :x2="g.W" y1=".6" y2=".6" stroke="#fff" stroke-opacity=".28" />
    </g>

    <!-- ляссе свисает с полки -->
    <path v-if="has('ribbon')" :d="g.ribbon" :fill="look.rib" stroke="#0005" stroke-width=".5" />
    <!-- чужая книга заперта -->
    <g v-if="locked" :transform="`translate(${g.W / 2 - 7} -7)`">
      <path d="M3.2 9 V5.4 a3.8 3.8 0 0 1 7.6 0 V9" fill="none" stroke="#8f7a4a" stroke-width="2.2" />
      <rect x="0" y="8" width="14" height="11" rx="2" fill="#c9a24f" stroke="#5c4420" stroke-width="1" />
      <circle cx="7" cy="12.4" r="1.6" fill="#3a2a12" /><rect x="6.3" y="12.6" width="1.4" height="3.6" fill="#3a2a12" />
    </g>
  </svg>
</template>

<script setup>
import { computed } from 'vue'
import { spineSize, mix, lum } from '../../shared/bookLook.js'
import { EMBLEM_PATHS, EMBLEM_FILL, RUNES } from './emblems.js'

const props = defineProps({
  look: { type: Object, required: true },
  name: { type: String, default: '' },
  level: { type: [Number, String], default: '' },
  locked: Boolean
})
let n = 0
const id = 'bs' + (++n) + Math.random().toString(36).slice(2, 6)
const has = k => props.look.deco.includes(k)
const glowing = computed(() => !!props.look.glow)
const worn = computed(() => mix(props.look.c, lum(props.look.c) > 0.6 ? '#7d7059' : '#b3a58c', 0.75))
const brass = '#b8893f'
const metal = computed(() => mix(props.look.f, '#6a6a6a', 0.35))
const gemColor = computed(() => props.look.glow || props.look.rib)
// тиснение почти в цвет переплёта (золото по слоновой кости) — название не прочесть: сдвигаем тон
const markFill = computed(() => (props.look.title === 'label' || props.look.title === 'ink' ? inkOnCover.value : titleFill.value))
const titleFill = computed(() => {
  const L = props.look
  if (L.title === 'label') return '#2a1d12'
  if (Math.abs(lum(L.f) - lum(L.c)) >= 0.3) return L.f
  return lum(L.c) > 0.5 ? mix(L.f, '#2a1606', 0.62) : mix(L.f, '#ffffff', 0.55)
})
const inkOnCover = computed(() => (props.look.title === 'ink' ? props.look.f : (lum(props.look.c) > 0.5 ? '#2a1d12' : '#e4d6b0')))

// одна и та же книга всегда выглядит одинаково: случайность — от имени
function rng(seed) { let s = 0; for (const ch of String(seed)) s = (Math.imul(s, 31) + ch.codePointAt(0)) | 0; return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9 | 0) >>> 0) / 4294967296 }
const BANDS = [[], [0.87], [0.11, 0.89], [0.09, 0.16, 0.89], [0.09, 0.16, 0.84, 0.91], [0.07, 0.13, 0.19, 0.85, 0.92]]

const g = computed(() => {
  const L = props.look, { w: W, h: H } = spineSize(L), r = rng(props.name + L.c)
  const bands = BANDS[L.bands].map(k => Math.round(k * H))
  const topBands = bands.filter(y => y < H / 2), botBands = bands.filter(y => y > H / 2)
  let top = (topBands.length ? Math.max(...topBands) + 9 : has('corners') ? 14 : 9) + (props.locked ? 8 : 0)
  const gemY = top + 8
  if (has('gem')) top += 18
  const es = L.em ? Math.min(W - 12, 26) : 0
  const emY = top + es / 2 + 1
  const bottom = (botBands.length ? Math.min(...botBands) - 9 : has('corners') ? H - 14 : H - 8)
  const lvY = bottom - 9
  const strapY = Math.round((L.em ? emY + es / 2 : top) + 11)
  const t0 = has('strap') ? strapY + 13 : (L.em ? emY + es / 2 + 6 : top + 3), t1 = (props.level ? lvY - 13 : bottom - 2)
  const tc = (t0 + t1) / 2, avail = Math.max(20, t1 - t0 - (L.title === 'label' ? 8 : 0))
  // название: одной строкой, а на толстом корешке — двумя
  const name = props.name || '', K = 0.5
  let fs = Math.max(13, Math.min(20, W * 0.42)), lines
  const words = name.split(/\s+/).filter(Boolean)
  if (name.length * fs * K > avail && W >= 52 && words.length > 1) {
    let best = 1, diff = Infinity
    for (let i = 1; i < words.length; i++) { const d = Math.abs(words.slice(0, i).join(' ').length - words.slice(i).join(' ').length); if (d < diff) { diff = d; best = i } }
    const a = words.slice(0, best).join(' '), b = words.slice(best).join(' ')
    fs = Math.max(11, Math.min(fs, (W - 12) / 2.25, avail / (Math.max(a.length, b.length) * K)))
    lines = [{ t: a, dy: -fs * 0.56 }, { t: b, dy: fs * 0.56 }]
  } else {
    fs = Math.max(10.5, Math.min(fs, avail / (Math.max(1, name.length) * K)))
    lines = [{ t: name, dy: 0 }]
  }
  for (const ln of lines) if (ln.t.length * fs * K > avail + 2) ln.len = avail
  const lw = Math.min(W - 8, lines.length * fs * 1.25 + 8)

  const paper = ['#e9dcb6', '#d8c79a', '#f1ead6', '#c9b98f', '#e0d0a4']
  const loose = Array.from({ length: 4 }, (_, i) => ({ x: 4 + r() * (W - 26), y: -3 - r() * 4, w: 12 + r() * 12, r: (r() - 0.5) * 9, c: paper[i % paper.length] }))
  const tabN = Math.max(2, Math.round(W / 16))
  const tabs = Array.from({ length: tabN }, (_, i) => ({ x: 5 + (i * (W - 16)) / (tabN - 1), c: ['#b3261e', '#d9b25c', '#3f7f6a', '#e9dcb6', '#34558b'][i % 5] }))
  const seams = [Math.round(H * 0.34), Math.round(H * 0.68)]
  const stars = Array.from({ length: 11 }, () => ({ x: 4 + r() * (W - 8), y: 8 + r() * (H - 16), r: 0.6 + r() * 1.1 }))
  const starLines = stars.slice(0, 7).map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  const wave = y => { let d = `M-2 ${y}`; for (let x = 0; x < W + 8; x += 8) d += ` q2 -3.4 4 0 t4 0`; return d }
  const waves = [0.2, 0.235, 0.27, 0.74, 0.775, 0.81].map(k => wave(Math.round(H * k)))
  const rivets = []
  for (let y = 9; y < H - 5; y += 21) rivets.push({ x: 5, y }, { x: W - 5, y })
  const claws = [0, 1, 2].map(i => `M${-3 + i * (W / 3.2)} ${H * 0.58 + i * 2} L${W * 0.42 + i * (W / 3.2)} ${H * 0.82 + i * 2}`)
  const stabs = [0.14, 0.38, 0.62, 0.86].map(k => Math.round(H * k))
  // лопнувший корешок: ломаная трещина и стежки поперёк, местами шов поверх старого
  const cx = W * 0.3, cy0 = H * 0.16, cy1 = H * 0.8
  let crack = `M${cx} ${cy0}`
  const pts = []
  for (let y = cy0 + 9; y <= cy1; y += 9) { const x = cx + (r() - 0.5) * 6; pts.push({ x, y }); crack += ` L${x.toFixed(1)} ${y.toFixed(1)}` }
  const stitches = []
  pts.forEach((p, i) => {
    const len = 5 + r() * 4, a = (r() - 0.5) * 0.9
    stitches.push({ x1: p.x - len, y1: p.y - 4 + a * 4, x2: p.x + len, y2: p.y - 4 - a * 4 })
    if (i % 5 === 2 || i % 7 === 5) stitches.push({ x1: p.x - len + 1, y1: p.y - 1 - a * 5, x2: p.x + len - 1, y2: p.y - 7 + a * 5, old: true })
  })
  const chains = [`M-2 ${H * 0.3} L${W + 2} ${H * 0.72}`, `M-2 ${H * 0.72} L${W + 2} ${H * 0.3}`]
  const blind = L.title === 'blind'
  const runeN = blind ? Math.max(3, Math.min(6, Math.floor((t1 - t0) / 20))) : 2
  const runes = Array.from({ length: runeN }, (_, i) => ({
    d: RUNES[Math.floor(r() * RUNES.length)],
    x: W / 2 - 5, y: t0 + ((t1 - t0 - 14) * i) / Math.max(1, runeN - 1)
  }))
  const rx = W * 0.62
  const ribbon = `M${rx} ${H - 1} h7 v${16 + (W % 5)} l-3.5 -4 l-3.5 4 z`
  return { W, H, bands, es, emY, gemY, lvY, t0, t1, tc, fs, lines, lw, tilt: (r() - 0.5) * 3, loose, tabs, seams, stars, starLines, waves, rivets, claws, strapY, stabs, crack, stitches, chains, runes: has('runes') && blind ? runes : [], ribbon }
})
</script>

<style scoped>
.bs { display: block; overflow: visible; }
.bs-title { font-family: 'Cormorant Garamond', serif; font-weight: 700; letter-spacing: .03em; paint-order: stroke; stroke: rgba(0, 0, 0, .45); stroke-width: .8px; }
.bs-title.light { stroke: rgba(255, 250, 235, .35); }
.bs-title.label { stroke: none; font-weight: 700; letter-spacing: .01em; }
.bs-title.ink { font-style: italic; stroke: rgba(0, 0, 0, .3); }
.bs-lv { font-family: 'Manrope', sans-serif; font-weight: 800; }
</style>
