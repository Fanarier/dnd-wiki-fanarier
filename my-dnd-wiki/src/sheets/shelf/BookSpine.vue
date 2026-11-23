<template>
  <!-- корешок книги-листа в духе старинного переплёта: кожа с рельефом, рубцы с золотыми полосками,
       название тиснением на тёмной вставке, маленький тиснёный знак, номер тома (уровень) римскими цифрами -->
  <svg class="bs" :width="g.W" :height="g.H" :viewBox="`0 0 ${g.W} ${g.H}`" aria-hidden="true">
    <defs>
      <clipPath :id="id + 'c'"><rect :width="g.W" :height="g.H" rx="2.5" /></clipPath>
      <!-- золото (или серебро) тиснения: блик сверху, глубина снизу -->
      <linearGradient :id="id + 'f'" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" :stop-color="mix(foil, '#ffffff', 0.55)" /><stop offset=".42" :stop-color="foil" />
        <stop offset=".78" :stop-color="mix(foil, '#000000', 0.42)" /><stop offset="1" :stop-color="mix(foil, '#ffffff', 0.15)" />
      </linearGradient>
      <radialGradient :id="id + 'g'" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".95" /><stop offset=".28" :stop-color="gemColor" /><stop offset="1" :stop-color="mix(gemColor, '#000000', 0.7)" /></radialGradient>
      <!-- края: там кожа вытирается и туда ползёт иней -->
      <linearGradient :id="id + 'eh'" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stop-color="#fff" /><stop offset=".22" stop-color="#fff" stop-opacity="0" /><stop offset=".78" stop-color="#fff" stop-opacity="0" /><stop offset="1" stop-color="#fff" />
      </linearGradient>
      <linearGradient :id="id + 'ev'" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stop-color="#fff" /><stop offset=".12" stop-color="#fff" stop-opacity="0" /><stop offset=".88" stop-color="#fff" stop-opacity="0" /><stop offset="1" stop-color="#fff" />
      </linearGradient>
      <mask :id="id + 'm'" maskUnits="userSpaceOnUse" x="0" y="0" :width="g.W" :height="g.H">
        <rect :width="g.W" :height="g.H" fill="#000" />
        <rect :width="g.W" :height="g.H" :fill="`url(#${id}eh)`" /><rect :width="g.W" :height="g.H" :fill="`url(#${id}ev)`" />
      </mask>
      <pattern :id="id + 'hb'" width="2.4" height="3" patternUnits="userSpaceOnUse"><rect width="1.2" height="3" :fill="look.rib" /><rect x="1.2" width="1.2" height="3" fill="#e9dcb6" /></pattern>
    </defs>

    <!-- над обрезом: каптал, вшитые листы, ярлычки, ляссе -->
    <rect v-if="!isMetal" x="1.6" y="-2.2" :width="g.W - 3.2" height="3" rx="1.2" :fill="`url(#${id}hb)`" />
    <g v-if="has('loose')">
      <g v-for="(p, i) in g.loose" :key="'l' + i" :transform="`rotate(${p.r} ${p.x + p.w / 2} 4)`">
        <rect :x="p.x" :y="p.y" :width="p.w" height="12" :fill="p.c" /><rect :x="p.x" :y="p.y" :width="p.w" height="12" fill="url(#bk-paper)" />
        <line :x1="p.x" :x2="p.x + p.w" :y1="p.y + 0.4" :y2="p.y + 0.4" stroke="#fff" stroke-opacity=".5" stroke-width=".6" />
      </g>
    </g>
    <g v-if="has('tabs')">
      <g v-for="(p, i) in g.tabs" :key="'t' + i">
        <path :d="`M${p.x} 4 V${-5 - p.h} q0 -1.6 1.6 -1.6 h3.8 q1.6 0 1.6 1.6 V4 Z`" :fill="p.c" />
        <path :d="`M${p.x} 4 V${-5 - p.h} q0 -1.6 1.6 -1.6 h3.8 q1.6 0 1.6 1.6 V4 Z`" fill="url(#bk-paper)" opacity=".8" />
        <path :d="`M${p.x + 7} 4 V${-5 - p.h}`" stroke="#000" stroke-opacity=".3" stroke-width=".8" />
      </g>
    </g>
    <g v-if="has('ribbon')" :transform="`translate(${g.W * 0.66} 0)`">
      <path d="M0 2 C0 -3 -.6 -6 .4 -9.5 L2 -8 L3.6 -10 C3 -6 3.6 -3 3.6 2 Z" :fill="look.rib" />
      <path d="M0 2 C0 -3 -.6 -6 .4 -9.5 L2 -8 L3.6 -10 C3 -6 3.6 -3 3.6 2 Z" fill="#000" opacity=".25" transform="translate(2.2 0) scale(.4 1)" />
      <path d="M.6 1 C.6 -3 .2 -5.6 .9 -8.6" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width=".6" />
    </g>

    <g :clip-path="`url(#${id}c)`">
      <!-- переплёт -->
      <rect :width="g.W" :height="g.H" :fill="look.c" />
      <template v-if="look.m === 'leather'">
        <rect :width="g.W" :height="g.H" fill="url(#bk-leather)" class="bs-ov" :opacity="light ? 0.22 : 0.45" />
        <rect :width="g.W" :height="g.H" fill="url(#bk-mottle)" :opacity="light ? 0.3 : 0.55" />
      </template>
      <template v-else-if="look.m === 'cloth'">
        <rect :width="g.W" :height="g.H" fill="url(#bk-cloth)" class="bs-ov" opacity=".5" />
        <rect :width="g.W" :height="g.H" fill="url(#bk-weave)" />
        <rect :width="g.W" :height="g.H" fill="url(#bk-mottle)" opacity=".45" />
      </template>
      <template v-else-if="look.m === 'scales'">
        <rect :width="g.W" :height="g.H" fill="url(#bk-scales)" />
        <rect :width="g.W" :height="g.H" fill="url(#bk-leather)" class="bs-ov" opacity=".25" />
        <rect :width="g.W" :height="g.H" fill="url(#bk-mottle)" opacity=".4" />
      </template>
      <template v-else>
        <rect :width="g.W" :height="g.H" fill="url(#bk-brush)" />
        <rect :width="g.W" :height="g.H" fill="url(#bk-mottle)" opacity=".35" />
        <g v-for="y in g.seams" :key="'s' + y"><line x1="0" :x2="g.W" :y1="y" :y2="y" stroke="#000" stroke-opacity=".6" stroke-width="1.2" /><line x1="0" :x2="g.W" :y1="y + 1.3" :y2="y + 1.3" stroke="#fff" stroke-opacity=".22" stroke-width=".7" /></g>
      </template>

      <!-- потёртые края и уголки -->
      <g v-if="look.wear" :mask="`url(#${id}m)`">
        <rect :width="g.W" :height="g.H" fill="url(#bk-scuff)" :opacity="[0, 0.35, 0.6, 0.9][look.wear]" />
        <rect :width="g.W" :height="g.H" :fill="worn" :opacity="[0, 0.12, 0.22, 0.34][look.wear]" />
      </g>
      <g v-if="has('stain')" filter="url(#bk-soft)">
        <ellipse :cx="g.W * 0.68" :cy="g.H * 0.3" :rx="g.W * 0.34" :ry="g.H * 0.075" :fill="stainC" opacity=".2" :stroke="stainC" stroke-width="2.4" stroke-opacity=".35" />
        <ellipse :cx="g.W * 0.3" :cy="g.H * 0.74" :rx="g.W * 0.26" :ry="g.H * 0.05" :fill="stainC" opacity=".15" :stroke="stainC" stroke-width="2" stroke-opacity=".3" />
      </g>

      <!-- головка и хвостик корешка: кожа завёрнута на каптал -->
      <template v-if="!isMetal">
        <rect :width="g.W" height="6" fill="#000" opacity=".28" /><line x1="0" :x2="g.W" y1=".7" y2=".7" stroke="#fff" stroke-opacity=".3" stroke-width=".8" />
        <path :d="`M0 6 Q${g.W / 2} 8 ${g.W} 6`" fill="none" stroke="#000" stroke-opacity=".35" stroke-width=".9" />
        <rect :y="g.H - 5" :width="g.W" height="5" fill="#000" opacity=".3" />
        <path :d="`M0 ${g.H - 5} Q${g.W / 2} ${g.H - 7} ${g.W} ${g.H - 5}`" fill="none" stroke="#fff" stroke-opacity=".14" stroke-width=".8" />
      </template>

      <!-- узоры по переплёту (тиснением) -->
      <g v-if="has('stars')" :fill="`url(#${id}f)`" opacity=".85">
        <path :d="g.starLines" fill="none" :stroke="foil" stroke-width=".45" stroke-opacity=".45" />
        <circle v-for="(p, i) in g.stars" :key="'st' + i" :cx="p.x" :cy="p.y" :r="p.r" />
        <path v-for="(p, i) in g.sparks" :key="'sp' + i" :d="`M${p.x} ${p.y - 3.2} L${p.x + 0.8} ${p.y - 0.8} L${p.x + 3.2} ${p.y} L${p.x + 0.8} ${p.y + 0.8} L${p.x} ${p.y + 3.2} L${p.x - 0.8} ${p.y + 0.8} L${p.x - 3.2} ${p.y} L${p.x - 0.8} ${p.y - 0.8} Z`" />
      </g>
      <g v-if="has('waves')" fill="none" :stroke="`url(#${id}f)`" stroke-width=".9" stroke-linecap="round" filter="url(#bk-tool)">
        <path v-for="(d, i) in g.waves" :key="'w' + i" :d="d" />
      </g>
      <g v-if="has('rivets')">
        <g v-for="(p, i) in g.rivets" :key="'rv' + i"><circle :cx="p.x + 0.5" :cy="p.y + 0.7" r="2.4" fill="#000" opacity=".5" /><circle :cx="p.x" :cy="p.y" r="2.2" :fill="metalFill" /><circle :cx="p.x - 0.7" :cy="p.y - 0.8" r=".7" fill="#fff" opacity=".7" /></g>
      </g>
      <g v-if="has('claws')" stroke-linecap="round" fill="none">
        <g v-for="(d, i) in g.claws" :key="'cw' + i">
          <path :d="d" stroke="#000" stroke-opacity=".75" stroke-width="3.6" />
          <path :d="d" :stroke="suede" stroke-width="1.8" />
          <path :d="d" stroke="#fff" stroke-opacity=".25" stroke-width=".6" transform="translate(.9 .5)" />
        </g>
      </g>

      <!-- рубцы и золотые полоски вокруг них -->
      <g v-for="(y, i) in g.bands" :key="'b' + i">
        <rect x="0" :y="y + 3.5" :width="g.W" height="3" fill="#000" opacity=".22" />
        <rect x="0" :y="y - 3.5" :width="g.W" height="7" :fill="mix(look.c, '#000000', 0.12)" />
        <rect v-if="look.m === 'leather'" x="0" :y="y - 3.5" :width="g.W" height="7" fill="url(#bk-leather)" class="bs-ov" :opacity="light ? 0.2 : 0.4" />
        <rect x="0" :y="y - 3.5" :width="g.W" height="7" fill="url(#bk-band)" />
        <template v-if="tooled">
          <line x1="0" :x2="g.W" :y1="y - 6" :y2="y - 6" :stroke="`url(#${id}f)`" stroke-width=".9" filter="url(#bk-tool)" />
          <line x1="0" :x2="g.W" :y1="y + 6.4" :y2="y + 6.4" :stroke="`url(#${id}f)`" stroke-width=".9" filter="url(#bk-tool)" />
          <line x1="1" :x2="g.W" :y1="y - 8.4" :y2="y - 8.4" :stroke="foil" stroke-width="1.1" stroke-linecap="round" stroke-dasharray=".1 2.4" />
          <line x1="1" :x2="g.W" :y1="y + 8.8" :y2="y + 8.8" :stroke="foil" stroke-width="1.1" stroke-linecap="round" stroke-dasharray=".1 2.4" />
        </template>
      </g>
      <!-- рамки-клейма в отделениях между рубцами -->
      <g v-if="tooled && !isMetal" fill="none" :stroke="foil" stroke-width=".6" opacity=".55">
        <g v-for="(p, i) in g.panels" :key="'pn' + i">
          <rect :x="3.5" :y="p.y0 + 3.5" :width="g.W - 7" :height="p.y1 - p.y0 - 7" rx="1" />
          <path :d="`M3.5 ${p.y0 + 6.5} l3 -3 M${g.W - 3.5} ${p.y0 + 6.5} l-3 -3 M3.5 ${p.y1 - 6.5} l3 3 M${g.W - 3.5} ${p.y1 - 6.5} l-3 3`" />
        </g>
      </g>

      <!-- металлические колпачки на головке и хвостике -->
      <g v-if="has('corners')">
        <rect x="0" y="0" :width="g.W" height="10" :fill="metalFill" /><rect x="0" y="9.4" :width="g.W" height="1.6" fill="#000" opacity=".45" />
        <path :d="`M0 10 Q${g.W / 2} 14 ${g.W} 10`" :fill="metalFill" /><circle :cx="g.W / 2" cy="7" r="1.3" fill="#000" opacity=".45" /><circle :cx="g.W / 2 - 0.4" cy="6.6" r=".5" fill="#fff" opacity=".6" />
        <rect x="0" :y="g.H - 10" :width="g.W" height="10" :fill="metalFill" /><rect x="0" :y="g.H - 11" :width="g.W" height="1.2" fill="#000" opacity=".4" />
        <path :d="`M0 ${g.H - 10} Q${g.W / 2} ${g.H - 14} ${g.W} ${g.H - 10}`" :fill="metalFill" /><circle :cx="g.W / 2" :cy="g.H - 6" r="1.3" fill="#000" opacity=".45" />
      </g>

      <!-- знак -->
      <g v-if="look.em" :transform="`translate(${g.W / 2 - g.es / 2} ${g.emY - g.es / 2}) scale(${g.es / 24})`">
        <g :filter="emFilter" :style="glowing ? { color: look.glow } : null">
          <path :d="EMBLEM_PATHS[look.em]" :fill="EMBLEM_FILL[look.em] ? markPaint : 'none'" :stroke="markPaint" :stroke-width="EMBLEM_FILL[look.em] ? 0.6 : 1.8" stroke-linejoin="round" stroke-linecap="round" fill-rule="evenodd" />
        </g>
      </g>
      <g v-if="has('gem')" :transform="`translate(${g.W / 2} ${g.gemY})`">
        <circle r="7.4" :fill="metalFill" /><circle r="7.4" fill="none" stroke="#000" stroke-opacity=".45" stroke-width=".8" />
        <g :fill="metalFill"><circle cx="0" cy="-7" r="1.6" /><circle cx="6" cy="3.6" r="1.6" /><circle cx="-6" cy="3.6" r="1.6" /></g>
        <circle r="5.6" :fill="`url(#${id}g)`" /><ellipse cx="-1.8" cy="-2.2" rx="1.8" ry="1.1" fill="#fff" opacity=".85" transform="rotate(-30 -1.8 -2.2)" />
      </g>

      <!-- название -->
      <template v-if="look.title === 'foil' && !isMetal">
        <rect :x="g.px" :y="g.t0 - 4" :width="g.W - g.px * 2" :height="g.t1 - g.t0 + 8" rx="1" :fill="piece" />
        <rect :x="g.px" :y="g.t0 - 4" :width="g.W - g.px * 2" :height="g.t1 - g.t0 + 8" fill="url(#bk-leather)" class="bs-ov" opacity=".35" />
        <path :d="`M${g.px} ${g.t1 + 4} V${g.t0 - 4} H${g.W - g.px}`" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width=".8" />
        <path :d="`M${g.W - g.px} ${g.t0 - 4} V${g.t1 + 4} H${g.px}`" fill="none" stroke="#000" stroke-opacity=".5" stroke-width=".8" />
        <rect :x="g.px + 2" :y="g.t0 - 2" :width="g.W - g.px * 2 - 4" :height="g.t1 - g.t0 + 4" fill="none" :stroke="foil" stroke-width=".6" opacity=".75" />
      </template>
      <g v-else-if="look.title === 'label'" :transform="`rotate(${g.tilt} ${g.W / 2} ${g.tc})`">
        <rect :x="g.W / 2 - g.lw / 2 + 0.6" :y="g.t0 - 2.4" :width="g.lw" :height="g.t1 - g.t0 + 6" fill="#000" opacity=".35" />
        <rect :x="g.W / 2 - g.lw / 2" :y="g.t0 - 3" :width="g.lw" :height="g.t1 - g.t0 + 6" fill="#e2d3a8" />
        <rect :x="g.W / 2 - g.lw / 2" :y="g.t0 - 3" :width="g.lw" :height="g.t1 - g.t0 + 6" fill="url(#bk-paper)" />
        <rect :x="g.W / 2 - g.lw / 2" :y="g.t0 - 3" :width="g.lw" :height="g.t1 - g.t0 + 6" fill="none" stroke="#7a6238" stroke-opacity=".55" stroke-width="1.4" />
        <rect :x="g.W / 2 - g.lw / 2 + 2.2" :y="g.t0 - 0.8" :width="g.lw - 4.4" :height="g.t1 - g.t0 + 1.6" fill="none" stroke="#3a2a18" stroke-opacity=".55" stroke-width=".5" />
      </g>
      <g v-if="look.title !== 'blind'" :transform="`translate(${g.W / 2} ${g.tc}) rotate(${-90 + (look.title === 'ink' ? g.tilt : 0)})`" :filter="titleFilter">
        <text v-for="(ln, i) in g.lines" :key="'ln' + i" x="0" :y="ln.dy" text-anchor="middle" dominant-baseline="central" :font-size="g.fs" :textLength="ln.len || null" lengthAdjust="spacingAndGlyphs"
          :class="['bs-title', titleKind]" :fill="titlePaint">{{ ln.t }}</text>
      </g>
      <g v-if="has('runes')" fill="none" :stroke="look.glow || foil" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" :filter="look.glow ? 'url(#bk-glow)' : 'url(#bk-tool)'" :style="{ color: look.glow || foil }" opacity=".85">
        <path v-for="(rn, i) in g.runes" :key="'ru' + i" :d="rn.d" :transform="`translate(${rn.x} ${rn.y})`" />
      </g>

      <!-- номер тома — уровень -->
      <text v-if="level" :x="g.W / 2" :y="g.lvY" text-anchor="middle" dominant-baseline="central" :font-size="g.lvFs" class="bs-lv" :fill="markPaint" :filter="tooled ? 'url(#bk-tool)' : null">{{ g.roman }}</text>

      <!-- то, что сверху: ремень, цепь, застёжки, нитки -->
      <g v-if="has('clasp')">
        <g v-for="y in g.clasps" :key="'cl' + y">
          <rect x="0" :y="y - 4" :width="g.W" height="8" :fill="metalFill" /><rect x="0" :y="y + 3.4" :width="g.W" height="1.4" fill="#000" opacity=".5" />
          <line x1="0" :x2="g.W" :y1="y - 3.5" :y2="y - 3.5" stroke="#fff" stroke-opacity=".5" stroke-width=".6" />
          <circle cx="4.5" :cy="y" r="1.3" fill="#000" opacity=".5" /><circle :cx="g.W - 4.5" :cy="y" r="1.3" fill="#000" opacity=".5" />
        </g>
      </g>
      <g v-if="has('strap')">
        <rect x="0" :y="g.strapY + 6" :width="g.W" height="2.4" fill="#000" opacity=".35" />
        <rect x="0" :y="g.strapY - 6" :width="g.W" height="12" fill="#3b2a1b" /><rect x="0" :y="g.strapY - 6" :width="g.W" height="12" fill="url(#bk-leather)" class="bs-ov" opacity=".45" />
        <rect x="0" :y="g.strapY - 6" :width="g.W" height="12" fill="url(#bk-round-v)" />
        <line x1="0" :x2="g.W" :y1="g.strapY - 4" :y2="g.strapY - 4" stroke="#d9c79c" stroke-opacity=".55" stroke-dasharray="2.2 1.6" stroke-width=".6" />
        <line x1="0" :x2="g.W" :y1="g.strapY + 4" :y2="g.strapY + 4" stroke="#d9c79c" stroke-opacity=".55" stroke-dasharray="2.2 1.6" stroke-width=".6" />
        <g :transform="`translate(${g.W / 2} ${g.strapY})`">
          <rect x="-7.5" y="-8.5" width="15" height="17" rx="2.4" fill="none" stroke="#000" stroke-opacity=".5" stroke-width="3.4" transform="translate(.6 .8)" />
          <rect x="-7.5" y="-8.5" width="15" height="17" rx="2.4" fill="none" stroke="url(#bk-brass)" stroke-width="2.6" />
          <rect x="-1" y="-8.5" width="2" height="17" fill="url(#bk-brass-h)" />
          <path d="M-6 0 H5" stroke="url(#bk-brass-h)" stroke-width="1.6" stroke-linecap="round" />
        </g>
      </g>
      <g v-if="has('chain')">
        <g v-for="(y, ci) in g.chainY" :key="'ch' + ci">
          <rect x="0" :y="y + 2.6" :width="g.W" height="2.4" fill="#000" opacity=".35" />
          <template v-for="(lk, i) in g.links" :key="'lk' + i">
            <ellipse v-if="lk.o" :cx="lk.x" :cy="y" rx="3.5" ry="2.5" fill="none" stroke="#14110e" stroke-width="2.6" />
            <ellipse v-if="lk.o" :cx="lk.x" :cy="y" rx="3.5" ry="2.5" fill="none" stroke="url(#bk-iron)" stroke-width="1.5" />
            <rect v-else :x="lk.x - 3.6" :y="y - 1" width="7.2" height="2" rx="1" fill="url(#bk-iron)" stroke="#14110e" stroke-width=".6" />
          </template>
        </g>
      </g>
      <g v-if="has('stab')" stroke-linecap="round">
        <line x1="5" x2="5" y1="8" :y2="g.H - 8" stroke="#000" stroke-opacity=".35" stroke-width="1.6" />
        <line x1="5" x2="5" y1="8" :y2="g.H - 8" stroke="#efe6cf" stroke-width=".9" />
        <g v-for="y in g.stabs" :key="'sb' + y">
          <line x1="0" :x2="g.W" :y1="y + 0.8" :y2="y + 0.8" stroke="#000" stroke-opacity=".35" stroke-width="1.8" />
          <line x1="0" :x2="g.W" :y1="y" :y2="y" stroke="#efe6cf" stroke-width="1.2" />
          <circle cx="5" :cy="y" r="1.2" fill="#1a0a06" />
        </g>
      </g>
      <g v-if="has('stitch')" stroke-linecap="round">
        <path :d="g.crack" fill="none" :stroke="suede" stroke-width="3.2" stroke-opacity=".6" />
        <path :d="g.crack" fill="none" stroke="#0b0704" stroke-width="1.4" stroke-opacity=".9" />
        <g v-for="(s, i) in g.stitches" :key="'sx' + i">
          <line :x1="s.x1 + 0.5" :y1="s.y1 + 0.8" :x2="s.x2 + 0.5" :y2="s.y2 + 0.8" stroke="#000" stroke-opacity=".45" :stroke-width="s.old ? 1.2 : 1.7" />
          <line :x1="s.x1" :y1="s.y1" :x2="s.x2" :y2="s.y2" :stroke="s.old ? '#8f8266' : '#d8c89c'" :stroke-width="s.old ? 0.9 : 1.3" />
          <circle :cx="s.x1" :cy="s.y1" r=".8" fill="#0b0704" /><circle :cx="s.x2" :cy="s.y2" r=".8" fill="#0b0704" />
        </g>
      </g>

      <!-- иней: кристаллы ползут от краёв, с рубцов свисают сосульки -->
      <g v-if="has('frost')">
        <g :mask="`url(#${id}m)`"><rect :width="g.W" :height="g.H" fill="#e6f6ff" opacity=".42" /><rect :width="g.W" :height="g.H" fill="url(#bk-frost)" /></g>
        <path :d="g.ferns" fill="none" stroke="#eef9ff" stroke-width=".55" stroke-linecap="round" opacity=".75" />
        <g v-for="(ic, i) in g.icicles" :key="'ic' + i">
          <path :d="ic.d" fill="#bfe6fa" opacity=".55" /><path :d="ic.e" fill="none" stroke="#fff" stroke-width=".55" opacity=".85" stroke-linecap="round" />
        </g>
      </g>

      <!-- выпуклость корешка -->
      <rect :width="g.W" :height="g.H" fill="url(#bk-round)" />
    </g>

    <!-- чужая книга заперта -->
    <g v-if="locked" :transform="`translate(${g.W / 2 - 7} -7)`">
      <path d="M3.2 9 V5.4 a3.8 3.8 0 0 1 7.6 0 V9" fill="none" stroke="#7a6436" stroke-width="2.2" />
      <rect x="0" y="8" width="14" height="11" rx="2" fill="url(#bk-brass)" stroke="#4a3418" stroke-width=".9" />
      <circle cx="7" cy="12.4" r="1.6" fill="#2a1d0c" /><rect x="6.3" y="12.6" width="1.4" height="3.6" fill="#2a1d0c" />
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
const id = 'bs' + Math.random().toString(36).slice(2, 8)
const has = k => props.look.deco.includes(k)
const isMetal = computed(() => props.look.m === 'metal')
const light = computed(() => lum(props.look.c) > 0.6)
const glowing = computed(() => !!props.look.glow)
// тиснёные рамки и полоски — у переплётов с тиснением и со «слепым» тиснением
const tooled = computed(() => props.look.title === 'foil' || props.look.title === 'blind')
const worn = computed(() => mix(props.look.c, lum(props.look.c) > 0.6 ? '#6e624d' : '#d9cbb0', 0.7))
const suede = computed(() => mix(props.look.c, '#e8dcc0', 0.5))
const stainC = computed(() => (lum(props.look.c) > 0.5 ? '#4a3a22' : '#0d0a06'))
// серебро или латунь: по цвету тиснения
const silver = computed(() => { const p = parseInt(props.look.f.slice(1), 16), r = p >> 16 & 255, gg = p >> 8 & 255, b = p & 255; return Math.max(r, gg, b) - Math.min(r, gg, b) < 40 || b > r })
const metalFill = computed(() => (silver.value ? 'url(#bk-iron)' : 'url(#bk-brass)'))
const gemColor = computed(() => props.look.glow || props.look.rib)
// вставка под названием: темнее переплёта; на светлой коже — тёмно-коричневая
const piece = computed(() => (lum(props.look.c) > 0.55 ? '#3b2416' : mix(props.look.c, '#000000', 0.5)))
// тиснение почти в цвет фона не прочесть — сдвигаем тон
const foil = computed(() => {
  const L = props.look, bg = L.title === 'foil' && !isMetal.value ? piece.value : L.c
  if (Math.abs(lum(L.f) - lum(bg)) >= 0.3) return L.f
  return lum(bg) > 0.5 ? mix(L.f, '#2a1606', 0.62) : mix(L.f, '#ffffff', 0.55)
})
const inkOnCover = computed(() => (props.look.title === 'ink' ? props.look.f : (lum(props.look.c) > 0.5 ? '#2a1d12' : '#e4d6b0')))
const titleKind = computed(() => (isMetal.value && props.look.title === 'foil' ? 'engraved' : props.look.title))
const titlePaint = computed(() => {
  const t = titleKind.value
  if (t === 'label') return '#2a1d12'
  if (t === 'ink') return props.look.f
  if (t === 'engraved') return mix(props.look.c, '#000000', 0.5)
  return `url(#${id}f)`
})
const titleFilter = computed(() => {
  const t = titleKind.value
  if (t === 'engraved') return 'url(#bk-deboss)'
  if (t === 'foil') return glowing.value ? 'url(#bk-glow)' : 'url(#bk-tool)'
  return null
})
// знак и номер тома: тиснение — золотом, ярлык и надпись от руки — чернилами, без названия — вдавлены
const markPaint = computed(() => {
  const t = props.look.title
  if (t === 'blind') return mix(props.look.c, '#000000', 0.35)
  if (t === 'label' || t === 'ink') return inkOnCover.value
  if (isMetal.value) return mix(props.look.c, '#000000', 0.5)
  return `url(#${id}f)`
})
const emFilter = computed(() => {
  if (glowing.value) return 'url(#bk-glow)'
  if (props.look.title === 'blind' || isMetal.value) return 'url(#bk-deboss)'
  return props.look.title === 'foil' ? 'url(#bk-tool)' : null
})

// одна и та же книга всегда выглядит одинаково: случайность — от имени
function rng(seed) { let s = 0; for (const ch of String(seed)) s = (Math.imul(s, 31) + ch.codePointAt(0)) | 0; return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9 | 0) >>> 0) / 4294967296 }
const BANDS = [[], [0.87], [0.11, 0.89], [0.09, 0.16, 0.89], [0.09, 0.16, 0.84, 0.91], [0.07, 0.13, 0.19, 0.85, 0.92]]
function roman(n) {
  n = Math.floor(Number(n))
  if (!(n > 0 && n < 400)) return String(n || '')
  let out = ''
  for (const [v, s] of [[100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]) while (n >= v) { out += s; n -= v }
  return out
}

const g = computed(() => {
  const L = props.look, { w: W, h: H } = spineSize(L), r = rng(props.name + L.c)
  const bands = BANDS[L.bands].map(k => Math.round(k * H))
  const topBands = bands.filter(y => y < H / 2), botBands = bands.filter(y => y > H / 2)
  const cap = has('corners') ? 15 : 9
  let top = (topBands.length ? Math.max(...topBands) + 11 : cap) + (props.locked ? 6 : 0)
  const gemY = top + 8
  if (has('gem')) top += 19
  const blind = L.title === 'blind'
  const es = L.em ? Math.min(W - 14, blind ? 22 : 17) : 0
  const emY = top + es / 2 + 1
  const bottom = botBands.length ? Math.min(...botBands) - 11 : H - cap
  const roman_ = props.level ? roman(props.level) : ''
  const lvFs = Math.max(7.5, Math.min(10.5, (W - 8) / Math.max(1.6, roman_.length * 0.68)))
  const lvY = bottom - 6
  const strapY = Math.round((L.em ? emY + es / 2 : top) + 11)
  const t0 = has('strap') ? strapY + 13 : (L.em ? emY + es / 2 + 8 : top + 4)
  const t1 = props.level ? lvY - 12 : bottom - 3
  const tc = (t0 + t1) / 2, avail = Math.max(20, t1 - t0 - (L.title === 'label' ? 8 : 2))
  // название: одной строкой, а на толстом корешке — двумя; тиснение — прописными, они шире
  const caps = L.title === 'foil'
  const name = caps ? (props.name || '').toUpperCase() : (props.name || '')
  const K = caps ? 0.66 : 0.5
  const px = W > 46 ? 5 : 3.5
  const room = W - px * 2 - 6
  let fs = Math.max(11, Math.min(caps ? 15 : 19, room * 0.8)), lines
  const words = name.split(/\s+/).filter(Boolean)
  if (name.length * fs * K > avail && W >= 52 && words.length > 1) {
    let best = 1, diff = Infinity
    for (let i = 1; i < words.length; i++) { const d = Math.abs(words.slice(0, i).join(' ').length - words.slice(i).join(' ').length); if (d < diff) { diff = d; best = i } }
    const a = words.slice(0, best).join(' '), b = words.slice(best).join(' ')
    fs = Math.max(9.5, Math.min(fs, room / 2.3, avail / (Math.max(a.length, b.length) * K)))
    lines = [{ t: a, dy: -fs * 0.58 }, { t: b, dy: fs * 0.58 }]
  } else {
    fs = Math.max(9, Math.min(fs, avail / (Math.max(1, name.length) * K)))
    lines = [{ t: name, dy: 0 }]
  }
  for (const ln of lines) if (ln.t.length * fs * K > avail + 2) ln.len = avail
  const lw = Math.min(W - 8, lines.length * fs * 1.25 + 8)

  // отделения между рубцами, кроме того, где название
  const edges = [cap - 3, ...bands, H - cap + 3]
  const panels = []
  for (let i = 0; i < edges.length - 1; i++) {
    const y0 = edges[i] + (i ? 9 : 0), y1 = edges[i + 1] - (i + 1 < edges.length - 1 ? 9 : 0)
    if (y1 - y0 < 16) continue
    if (L.title === 'foil' && y0 < t1 + 6 && y1 > t0 - 6) continue
    panels.push({ y0, y1 })
  }

  const paper = ['#e9dcb6', '#d8c79a', '#f1ead6', '#c9b98f', '#e0d0a4']
  const loose = Array.from({ length: 4 }, (_, i) => ({ x: 3 + r() * (W - 24), y: -4 - r() * 4, w: 12 + r() * 12, r: (r() - 0.5) * 7, c: paper[i % paper.length] }))
  const tabN = Math.max(2, Math.round(W / 16))
  const TAB = ['#8e3a2a', '#c9b27a', '#4f6b52', '#d9cfb4', '#3e5470']
  const tabs = Array.from({ length: tabN }, (_, i) => ({ x: 4 + (i * (W - 15)) / (tabN - 1), h: Math.round(r() * 4), c: TAB[i % TAB.length] }))
  const seams = [Math.round(H * 0.34), Math.round(H * 0.68)]
  // звёзды — только вне вставки с названием
  const off = y => !(L.title === 'foil' && y > t0 - 6 && y < t1 + 6)
  const stars = [], sparks = []
  for (let i = 0; i < 40 && stars.length < 12; i++) { const p = { x: 5 + r() * (W - 10), y: 10 + r() * (H - 20), r: 0.5 + r() * 0.8 }; if (off(p.y)) stars.push(p) }
  for (let i = 0; i < 20 && sparks.length < 3; i++) { const p = { x: 7 + r() * (W - 14), y: 14 + r() * (H - 28) }; if (off(p.y) && off(p.y - 4) && off(p.y + 4)) sparks.push(p) }
  const starLines = stars.slice(0, 6).map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  const wave = y => { let d = `M-2 ${y}`; for (let x = 0; x < W + 8; x += 8) d += ' q2 -2.6 4 0 t4 0'; return d }
  const waves = [t0 - 12, t0 - 17, t1 + 12, t1 + 17].filter(y => y > 12 && y < H - 12).map(wave)
  const rivets = []
  for (let y = 10; y < H - 6; y += 22) rivets.push({ x: 5, y }, { x: W - 5, y })
  const claws = [0, 1, 2].map(i => `M${2 + i * (W / 3.4)} ${H * 0.6 + i * 3} C${W * 0.2 + i * (W / 3.4)} ${H * 0.7 + i * 3} ${W * 0.3 + i * (W / 3.4)} ${H * 0.76 + i * 3} ${W * 0.46 + i * (W / 3.4)} ${H * 0.84 + i * 3}`)
  const stabs = [0.06, 0.12, 0.88, 0.94].map(k => Math.round(H * k))
  // лопнувший корешок: ломаная трещина и стежки поперёк, местами шов поверх старого
  const cx = W * 0.3, cy0 = H * 0.16, cy1 = H * 0.8
  let crack = `M${cx} ${cy0}`
  const pts = []
  for (let y = cy0 + 9; y <= cy1; y += 9) { const x = cx + (r() - 0.5) * 5; pts.push({ x, y }); crack += ` L${x.toFixed(1)} ${y.toFixed(1)}` }
  const stitches = []
  pts.forEach((p, i) => {
    const len = 4 + r() * 3, a = (r() - 0.5) * 0.7
    stitches.push({ x1: p.x - len, y1: p.y - 4 + a * 4, x2: p.x + len, y2: p.y - 4 - a * 4 })
    if (i % 5 === 2 || i % 7 === 5) stitches.push({ x1: p.x - len + 1, y1: p.y - 1 - a * 4, x2: p.x + len - 1, y2: p.y - 6 + a * 4, old: true })
  })
  // цепь: два витка вокруг книги — над и под названием
  const below = props.level ? lvY + 12 : t1 + 8
  const chainY = [Math.max(14, t0 - 8), Math.min(H - 14, below)]
  const links = []
  for (let x = 0, i = 0; x < W + 6; x += 5.2, i++) links.push({ x, o: i % 2 === 0 })
  // застёжка рядом с рубцом ложится прямо на него — как окованный рубец
  const snap = y => bands.find(b => Math.abs(b - y) < 11) ?? y
  const clasps = [snap(Math.max(14, t0 - 9)), snap(Math.min(H - 14, below + 1))]
  const runeN = blind ? Math.max(3, Math.min(6, Math.floor((t1 - t0) / 20))) : 2
  const runes = Array.from({ length: runeN }, (_, i) => ({ d: RUNES[Math.floor(r() * RUNES.length)], x: W / 2 - 5, y: t0 + ((t1 - t0 - 14) * i) / Math.max(1, runeN - 1) }))
  // сосульки: под головкой и под каждым рубцом
  const icicles = []
  for (const y of [cap - 3, ...bands.map(b => b + 3.5)]) {
    for (let x = 3 + r() * 4; x < W - 3; x += 5 + r() * 7) {
      if (r() < 0.35) continue
      const len = 2.5 + r() * (y < H / 2 ? 7 : 4), w = 1 + r() * 1.2
      icicles.push({
        d: `M${(x - w).toFixed(1)} ${y} Q${(x - w * 0.3).toFixed(1)} ${(y + len * 0.5).toFixed(1)} ${x.toFixed(1)} ${(y + len).toFixed(1)} Q${(x + w * 0.3).toFixed(1)} ${(y + len * 0.4).toFixed(1)} ${(x + w).toFixed(1)} ${y} Z`,
        e: `M${(x - w * 0.5).toFixed(1)} ${y + 0.6} L${(x - 0.2).toFixed(1)} ${(y + len * 0.8).toFixed(1)}`
      })
    }
  }
  // морозные узоры: веточки растут от краёв внутрь
  let ferns = ''
  for (let i = 0; i < 9; i++) {
    const left = i % 2 === 0, y0 = 12 + r() * (H - 24)
    if (L.title === 'foil' && y0 > t0 - 2 && y0 < t1 + 2 && r() < 0.6) continue
    let x = left ? 0 : W, y = y0
    const dir = left ? 1 : -1, len = 6 + r() * W * 0.28, steps = 4
    ferns += `M${x.toFixed(1)} ${y.toFixed(1)}`
    for (let k = 1; k <= steps; k++) {
      const nx = x + dir * (len / steps), ny = y + (r() - 0.5) * 3
      ferns += ` L${nx.toFixed(1)} ${ny.toFixed(1)}`
      const b = 1.6 + r() * 2.4
      ferns += ` M${nx.toFixed(1)} ${ny.toFixed(1)} l${(-dir * b * 0.6).toFixed(1)} ${(-b).toFixed(1)} M${nx.toFixed(1)} ${ny.toFixed(1)} l${(-dir * b * 0.6).toFixed(1)} ${b.toFixed(1)} M${nx.toFixed(1)} ${ny.toFixed(1)}`
      x = nx; y = ny
    }
    ferns += ' '
  }
  return { ferns, W, H, bands, panels, es, emY, gemY, lvY, lvFs, roman: roman_, t0, t1, tc, fs, lines, lw, px, tilt: (r() - 0.5) * 3, loose, tabs, seams, stars, sparks, starLines, waves, rivets, claws, strapY, stabs, crack, stitches, chainY, links, clasps, runes: has('runes') && blind ? runes : [], icicles }
})
</script>

<style scoped>
.bs { display: block; overflow: visible; }
.bs-ov { mix-blend-mode: overlay; }
.bs-title { font-family: 'Cormorant Garamond', serif; font-weight: 700; }
.bs-title.foil { letter-spacing: .09em; font-weight: 700; }
.bs-title.label { font-weight: 700; letter-spacing: .01em; }
.bs-title.ink { font-style: italic; font-weight: 600; opacity: .9; }
.bs-title.engraved { letter-spacing: .1em; text-transform: uppercase; font-family: 'Manrope', sans-serif; font-weight: 800; }
.bs-lv { font-family: 'Cormorant Garamond', serif; font-weight: 700; letter-spacing: .06em; }
</style>
