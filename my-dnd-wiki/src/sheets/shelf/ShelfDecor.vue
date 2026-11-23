<template>
  <!-- вещи на полках стеллажа. Все стоят на полке (под каждой — тень касания), свет — сверху слева, как у книг -->
  <HourGlass v-if="kind === 'hourglass'" />
  <CandleDecor v-else-if="kind === 'candle' || kind === 'lantern'" :kind="kind" :seed="seed" />
  <GlobeDecor v-else-if="kind === 'globe'" />
  <BottlesDecor v-else-if="kind === 'bottles'" />
  <svg v-else class="sd" :class="kind" :width="size.w" :height="size.h" :viewBox="`0 0 ${size.w} ${size.h}`" :style="flick" aria-hidden="true">
    <ellipse v-if="kind !== 'tomes' && kind !== 'frame'" :cx="size.w / 2" :cy="size.h - (FLOOR[kind] || 0) - 0.4" :rx="size.w * 0.48" ry="3.4" fill="url(#bk-shadow)" />

    <!-- ряд безымянных старых томов -->
    <g v-if="kind === 'tomes'">
      <g v-for="(b, i) in tomes" :key="i" :transform="b.lean ? `rotate(${-b.lean} ${b.x} ${size.h})` : null">
        <rect :x="b.x" :y="size.h - b.h" :width="b.w" :height="b.h" rx="1.6" :fill="b.c" />
        <rect :x="b.x" :y="size.h - b.h" :width="b.w" :height="b.h" fill="url(#bk-leather)" class="sd-ov" opacity=".28" />
        <rect :x="b.x" :y="size.h - b.h" :width="b.w" :height="b.h" fill="url(#bk-mottle)" opacity=".45" />
        <rect :x="b.x" :y="size.h - b.h" :width="b.w" height="5" fill="#000" opacity=".3" />
        <g v-for="y in b.bands" :key="y">
          <rect :x="b.x" :y="size.h - b.h + y - 2.5" :width="b.w" height="5" :fill="b.c" /><rect :x="b.x" :y="size.h - b.h + y - 2.5" :width="b.w" height="5" fill="url(#bk-band)" />
          <template v-if="b.gilt"><line :x1="b.x" :x2="b.x + b.w" :y1="size.h - b.h + y - 4.6" :y2="size.h - b.h + y - 4.6" stroke="#b8954f" stroke-opacity=".6" stroke-width=".7" /><line :x1="b.x" :x2="b.x + b.w" :y1="size.h - b.h + y + 4.8" :y2="size.h - b.h + y + 4.8" stroke="#b8954f" stroke-opacity=".6" stroke-width=".7" /></template>
        </g>
        <g v-if="b.label">
          <rect :x="b.x + 2.5" :y="size.h - b.h * 0.8" :width="b.w - 5" :height="b.h * 0.17" :fill="b.lc" />
          <rect :x="b.x + 3.6" :y="size.h - b.h * 0.8 + 1.2" :width="b.w - 7.2" :height="b.h * 0.17 - 2.4" fill="none" stroke="#c9a45a" stroke-opacity=".55" stroke-width=".5" />
          <line v-for="k in b.lines" :key="k" :x1="b.x + b.w / 2 - (b.w - 12) * (k === 1 ? 0.42 : 0.3)" :x2="b.x + b.w / 2 + (b.w - 12) * (k === 1 ? 0.42 : 0.3)" :y1="size.h - b.h * 0.8 + b.h * 0.17 * (k / (b.lines.length + 1))" :y2="size.h - b.h * 0.8 + b.h * 0.17 * (k / (b.lines.length + 1))" stroke="#d6b56a" stroke-opacity=".75" stroke-width="1.3" />
        </g>
        <rect :x="b.x" :y="size.h - b.h" :width="b.w" :height="b.h" rx="1.6" fill="url(#bk-round)" />
      </g>
    </g>

    <!-- стопка лежащих книг, корешками к нам -->
    <g v-else-if="kind === 'stack'">
      <g v-for="(b, i) in stack" :key="i">
        <rect :x="b.x" :y="b.y" :width="b.w" :height="b.h" rx="2" :fill="b.c" />
        <rect :x="b.x" :y="b.y" :width="b.w" :height="b.h" fill="url(#bk-leather)" class="sd-ov" opacity=".45" />
        <rect :x="b.x" :y="b.y" :width="b.w" :height="b.h" fill="url(#bk-mottle)" opacity=".5" />
        <g v-for="x in [b.x + 9, b.x + b.w - 9]" :key="x"><rect :x="x - 2.5" :y="b.y" width="5" :height="b.h" fill="#000" opacity=".25" /><line :x1="x - 2.5" :x2="x - 2.5" :y1="b.y" :y2="b.y + b.h" stroke="#fff" stroke-opacity=".15" stroke-width=".7" /><line :x1="x - 5" :x2="x - 5" :y1="b.y + 1" :y2="b.y + b.h - 1" stroke="#b8954f" stroke-opacity=".5" stroke-width=".6" /><line :x1="x + 5" :x2="x + 5" :y1="b.y + 1" :y2="b.y + b.h - 1" stroke="#b8954f" stroke-opacity=".5" stroke-width=".6" /></g>
        <rect :x="b.x + b.w / 2 - 16" :y="b.y + 2.5" width="32" :height="b.h - 5" :fill="b.lc" /><line :x1="b.x + b.w / 2 - 10" :x2="b.x + b.w / 2 + 10" :y1="b.y + b.h / 2" :y2="b.y + b.h / 2" stroke="#d6b56a" stroke-opacity=".75" stroke-width="1.3" />
        <rect :x="b.x" :y="b.y" :width="b.w" :height="b.h" rx="2" fill="url(#bk-round-v)" />
      </g>
    </g>

    <!-- картина: парусник -->
    <g v-else-if="kind === 'frame'">
      <g transform="rotate(-3 55 126)">
        <rect x="7" y="20" width="102" height="110" fill="#000" opacity=".35" filter="url(#bk-soft)" />
        <rect x="4" y="16" width="102" height="110" fill="url(#bk-wood)" /><rect x="4" y="16" width="102" height="110" fill="url(#bk-woodgrain)" opacity=".5" />
        <rect x="8" y="20" width="94" height="102" fill="none" stroke="url(#bk-brass)" stroke-width="1.6" />
        <rect x="14" y="26" width="82" height="90" fill="#3d6470" /><path d="M14 80 Q34 74 55 80 T96 80 V116 H14 Z" fill="#1f4350" /><path d="M14 92 Q30 88 46 92 T78 92 T96 92" stroke="#7fb0b8" stroke-width="1" fill="none" opacity=".6" />
        <path d="M54 40 V80 M54 42 L76 76 H54 Z" fill="#e9e0c8" stroke="#3a2a1c" stroke-width="1" /><path d="M52 46 L34 76 H52 Z" fill="#d9cfb4" /><path d="M30 80 H80 L74 88 H36 Z" fill="#3a2a1c" />
        <circle cx="80" cy="40" r="6" fill="#f0e2b0" opacity=".7" /><rect x="14" y="26" width="82" height="90" fill="url(#bk-mottle)" opacity=".5" />
        <rect x="14" y="26" width="82" height="90" fill="none" stroke="#000" stroke-opacity=".5" stroke-width="2" />
      </g>
    </g>

    <!-- сундучок: крышка-бочонок, железные полосы, замок -->
    <g v-else-if="kind === 'chest'">
      <rect x="8" y="36" width="88" height="34" fill="url(#bk-wood)" />
      <rect x="8" y="36" width="88" height="34" fill="url(#bk-woodgrain)" opacity=".55" />
      <path d="M8 47.5 H96 M8 59 H96" stroke="#1e1209" stroke-opacity=".7" stroke-width="1" /><path d="M8 48.4 H96 M8 59.9 H96" stroke="#fff" stroke-opacity=".08" stroke-width=".7" />
      <path d="M8 36 V26 A44 15 0 0 1 96 26 V36 Z" fill="url(#bk-wood)" />
      <path d="M8 36 V26 A44 15 0 0 1 96 26 V36 Z" fill="url(#bk-woodgrain)" opacity=".55" />
      <path d="M9 24 A43 14 0 0 1 95 24" fill="none" stroke="#fff" stroke-opacity=".22" stroke-width="1" />
      <path d="M8 29 Q52 25 96 29" fill="none" stroke="#1e1209" stroke-opacity=".5" stroke-width=".8" />
      <rect x="8" y="34.6" width="88" height="2.6" fill="#120a05" /><line x1="8" x2="96" y1="37.6" y2="37.6" stroke="#fff" stroke-opacity=".12" />
      <g v-for="x in [22, 82]" :key="x">
        <rect :x="x - 2" y="16.5" width="6.4" height="53.5" fill="#000" opacity=".3" />
        <path :d="x < 52 ? 'M19 70 V16.1 L25 14.2 V70 Z' : 'M79 70 V14.2 L85 16.1 V70 Z'" fill="url(#bk-iron-h)" />
        <circle v-for="y in [21, 31, 44, 57, 65]" :key="y" :cx="x" :cy="y" r="1.1" fill="#d5d9dc" />
      </g>
      <rect x="8" y="66" width="88" height="4" fill="url(#bk-iron)" />
      <rect x="44" y="30" width="16" height="18" rx="2" fill="url(#bk-brass)" /><rect x="44" y="30" width="16" height="18" rx="2" fill="none" stroke="#5a3e16" stroke-width=".8" />
      <circle cx="52" cy="38" r="2" fill="#1e1209" /><path d="M51.2 39 L50.6 43.4 H53.4 L52.8 39 Z" fill="#1e1209" />
      <rect x="10" y="70" width="8" height="4" rx="1" fill="#1c1d1f" /><rect x="86" y="70" width="8" height="4" rx="1" fill="#1c1d1f" />
    </g>

    <!-- чернильница и перо -->
    <g v-else-if="kind === 'ink'">
      <linearGradient :id="uid + 'qv'" x1="0" x2="0" y1="1" y2="0"><stop offset="0" stop-color="#d8cfbc" /><stop offset=".5" stop-color="#f1ead9" /><stop offset=".85" stop-color="#e2d6bb" /><stop offset="1" stop-color="#8c7a5e" /></linearGradient>
      <path :d="QUILL.left" :fill="`url(#${uid}qv)`" />
      <path :d="QUILL.right" :fill="`url(#${uid}qv)`" opacity=".9" />
      <path :d="QUILL.barbs" fill="none" stroke="#9a8a6a" stroke-width=".45" stroke-opacity=".7" />
      <path :d="QUILL.notches" fill="none" stroke="#1c2733" stroke-width="1.1" stroke-linecap="round" />
      <path :d="QUILL.fluff" fill="none" stroke="#efe7d4" stroke-width=".6" stroke-linecap="round" opacity=".85" />
      <path :d="QUILL.rachis" fill="none" stroke="#f8f2e2" stroke-width="1.3" stroke-linecap="round" />
      <path :d="QUILL.rachis" fill="none" stroke="#8a7a5a" stroke-width=".5" stroke-linecap="round" transform="translate(.5 .2)" />
      <ellipse cx="34" cy="107" rx="21" ry="3" fill="#000" opacity=".4" />
      <path d="M14 106 V92 Q14 84 22 82 V77 H46 V82 Q54 84 54 92 V106 Q34 109 14 106 Z" fill="#141c26" />
      <path d="M14 106 V92 Q14 84 22 82 V77 H46 V82 Q54 84 54 92 V106 Q34 109 14 106 Z" fill="url(#bk-glass)" />
      <ellipse cx="34" cy="77" rx="12" ry="2.6" fill="url(#bk-brass)" /><ellipse cx="34" cy="77" rx="8" ry="1.6" fill="#0b0d12" />
      <path d="M18 90 V102" stroke="#fff" stroke-opacity=".4" stroke-width="2" stroke-linecap="round" />
    </g>

    <!-- свитки, сложенные на полке -->
    <g v-else-if="kind === 'scrolls'">
      <g v-for="(sc, i) in scrolls" :key="i">
        <rect :x="sc.x - 3" :y="sc.y - 2" width="4" :height="sc.r * 2 + 4" rx="1.5" fill="url(#bk-wood)" />
        <rect :x="sc.x + sc.len - 1" :y="sc.y - 2" width="4" :height="sc.r * 2 + 4" rx="1.5" fill="url(#bk-wood)" />
        <rect :x="sc.x" :y="sc.y" :width="sc.len" :height="sc.r * 2" :fill="sc.c" />
        <rect :x="sc.x" :y="sc.y" :width="sc.len" :height="sc.r * 2" fill="url(#bk-paper)" />
        <rect :x="sc.x" :y="sc.y" :width="sc.len" :height="sc.r * 2" fill="url(#bk-round-v)" />
        <path :d="`M${sc.x + sc.len * 0.18} ${sc.y + 0.6} Q${sc.x + sc.len * 0.24} ${sc.y + sc.r} ${sc.x + sc.len * 0.18} ${sc.y + sc.r * 2 - 0.6}`" fill="none" stroke="#8a7448" stroke-opacity=".45" stroke-width=".6" />
        <rect :x="sc.x + sc.len * 0.56" :y="sc.y - 0.4" width="5" :height="sc.r * 2 + 0.8" :fill="sc.tie" /><rect :x="sc.x + sc.len * 0.56" :y="sc.y - 0.4" width="5" :height="sc.r * 2 + 0.8" fill="url(#bk-round-v)" />
        <circle :cx="sc.x - 1" :cy="sc.y + sc.r" r="2.6" fill="url(#bk-brass)" /><circle :cx="sc.x + sc.len + 1" :cy="sc.y + sc.r" r="2.6" fill="url(#bk-brass)" />
      </g>
    </g>

    <!-- друза кристаллов на камне -->
    <g v-else-if="kind === 'crystal'" class="sd-hit" :class="{ ring: ring }" role="button" tabindex="0" @mousedown.prevent aria-label="Коснуться кристаллов" @click="chime" @keydown.enter.prevent="chime" @keydown.space.prevent="chime">
      <title>Коснуться кристаллов</title>
      <circle cx="40" cy="58" r="40" fill="url(#bk-cold)" class="sd-glow slow" />
      <circle v-if="ring" :key="'r' + ring" cx="40" cy="52" r="36" fill="url(#bk-cold)" class="sd-flare" />
      <path d="M6 90 Q4 78 14 74 Q22 68 34 71 Q46 66 58 70 Q72 70 75 80 Q78 88 74 90 Z" fill="#2f2b2a" />
      <path d="M6 90 Q4 78 14 74 Q22 68 34 71 Q46 66 58 70 Q72 70 75 80 Q78 88 74 90 Z" fill="url(#bk-leather)" class="sd-ov" opacity=".6" />
      <path d="M12 76 Q22 70 34 72.5 Q46 68 58 71.5" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width="1" />
      <g v-for="(cr, i) in crystals" :key="i" :transform="`translate(${cr.x} ${cr.y}) rotate(${cr.a})`">
        <path :d="cr.l" fill="#3d7fa8" fill-opacity=".9" />
        <path :d="cr.m" fill="#7ccbe8" fill-opacity=".78" />
        <path :d="cr.r" fill="#c8f0fb" fill-opacity=".82" />
        <path :d="cr.m" fill="#b08cff" fill-opacity=".18" />
        <path :d="cr.edge" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width=".55" stroke-linejoin="round" />
        <path :d="cr.glint" stroke="#fff" stroke-opacity=".7" stroke-width=".9" stroke-linecap="round" />
      </g>
      <path d="M3 90 Q5 81 15 80 Q29 77 41 81 Q57 78 69 81 Q78 84 77 90 Z" fill="#262221" />
      <path d="M3 90 Q5 81 15 80 Q29 77 41 81 Q57 78 69 81 Q78 84 77 90 Z" fill="url(#bk-leather)" class="sd-ov" opacity=".55" />
      <path d="M8 82 Q18 79.5 28 79.8 Q36 80 41 81.6" fill="none" stroke="#fff" stroke-opacity=".14" stroke-width=".9" />
      <g fill="#fff">
        <path v-for="(sp, i) in sparks" :key="'s' + i + '-' + ring" class="sd-twinkle" :class="{ burst: ring }" :style="{ animationDelay: ring ? (i * 0.08) + 's' : sp.d + 's' }" :d="`M${sp.x} ${sp.y - 4} L${sp.x + 0.7} ${sp.y - 0.7} L${sp.x + 4} ${sp.y} L${sp.x + 0.7} ${sp.y + 0.7} L${sp.x} ${sp.y + 4} L${sp.x - 0.7} ${sp.y + 0.7} L${sp.x - 4} ${sp.y} L${sp.x - 0.7} ${sp.y - 0.7} Z`" />
      </g>
    </g>

    <!-- драконье яйцо в гнезде: светятся прожилки; от щелчка качается, по трещинам пробегает свет -->
    <g v-else-if="kind === 'egg'" class="sd-hit" :class="{ wob: wob }" role="button" tabindex="0" @mousedown.prevent aria-label="Драконье яйцо" @click="nudge" @keydown.enter.prevent="nudge" @keydown.space.prevent="nudge" @animationend="e => e.animationName.includes('sd-wob') && (wob = 0)">
      <title>Драконье яйцо — щёлкни</title>
      <circle cx="30" cy="46" r="30" fill="url(#bk-candle)" class="sd-eggglow" />
      <g class="sd-egg">
        <ellipse cx="30" cy="46" rx="16" ry="22" fill="#2a4a46" />
        <ellipse cx="30" cy="46" rx="16" ry="22" fill="url(#bk-scales)" />
        <ellipse cx="30" cy="46" rx="16" ry="22" fill="url(#bk-mottle)" opacity=".6" />
        <path d="M22 30 Q26 40 23 48 Q27 54 25 62 M36 28 Q33 38 37 46 Q34 54 38 63" fill="none" stroke="#ffb347" stroke-width=".9" class="sd-veins" />
        <path :key="'k' + wob" d="M24 40 L28 44 L26 48 L31 51 L29 55" fill="none" stroke="#ffe08a" stroke-width="1.1" class="sd-crack" :class="{ on: wob }" />
        <ellipse cx="30" cy="46" rx="16" ry="22" fill="url(#bk-ball)" />
        <ellipse cx="24" cy="35" rx="4" ry="6" fill="#fff" opacity=".18" transform="rotate(-20 24 35)" />
      </g>
      <g stroke="#6b4a2c" stroke-width="2" stroke-linecap="round"><path d="M6 70 Q30 80 54 70 M8 74 Q30 66 52 75 M10 72 L48 78 M12 78 L50 70" /></g>
      <g stroke="#9a7246" stroke-width="1.2" stroke-linecap="round"><path d="M4 72 Q30 82 56 72 M14 76 L44 68 M18 69 L52 77" /></g>
    </g>

    <!-- череп со свечой: от щелчка щёлкает челюстью, в глазницах вспыхивает зелёный огонь -->
    <g v-else-if="kind === 'skull'" class="sd-hit" :class="{ chat: chat }" role="button" tabindex="0" @mousedown.prevent aria-label="Череп" @click="chatter" @keydown.enter.prevent="chatter" @keydown.space.prevent="chatter">
      <title>Череп — щёлкни</title>
      <circle cx="30" cy="4" r="14" fill="url(#bk-candle)" class="sd-glow" />
      <rect x="26" y="8" width="8" height="22" fill="url(#bk-wax)" /><ellipse cx="30" cy="8" rx="4" ry="1.2" fill="#efe3c4" />
      <path d="M26 26 q-1 6 1 9 q1 -4 1 -9 Z M33 22 q2 8 0 12 q-1 -5 -1 -12 Z" fill="#f3ead3" />
      <line x1="30" y1="8" x2="30" y2="4.6" stroke="#2a1d12" stroke-width=".9" />
      <g transform="translate(30 4.6)"><g class="sd-fa"><g class="sd-fb">
        <path d="M0 -12 C3 -7 3.8 -3 2.6 -.6 C1.7 1 -1.7 1 -2.6 -.6 C-3.8 -3 -3 -7 0 -12 Z" fill="url(#bk-flame)" />
        <path d="M0 -6 C1.2 -3.4 1.4 -1.7 .9 -.6 C.5 .2 -.5 .2 -.9 -.6 C-1.4 -1.7 -1.2 -3.4 0 -6 Z" fill="#fffbe8" />
      </g></g></g>
      <path d="M12 46 C10 30 20 28 30 28 C40 28 50 30 48 46 C48 52 44 54 42 56 H18 C16 54 12 52 12 46 Z" fill="#e6dcc2" />
      <path d="M12 46 C10 30 20 28 30 28 C40 28 50 30 48 46 C48 52 44 54 42 56 H18 C16 54 12 52 12 46 Z" fill="url(#bk-paper)" />
      <path d="M12 46 C10 30 20 28 30 28 C40 28 50 30 48 46 C48 52 44 54 42 56 H18 C16 54 12 52 12 46 Z" fill="url(#bk-round)" />
      <ellipse cx="22.5" cy="44" rx="5" ry="5.4" fill="#1a1410" /><ellipse cx="37.5" cy="44" rx="5" ry="5.4" fill="#1a1410" />
      <g class="sd-eyes"><circle cx="22.5" cy="44.5" r="2.2" fill="#7dffb0" filter="url(#bk-soft)" /><circle cx="37.5" cy="44.5" r="2.2" fill="#7dffb0" filter="url(#bk-soft)" /></g>
      <path d="M30 48 L27.6 52.4 H32.4 Z" fill="#1a1410" />
      <path d="M22 34 q3 2 2 5 M41 33 l-2 3" fill="none" stroke="#8a7a5a" stroke-width=".6" />
      <g class="sd-jaw">
        <path d="M18 56 H42 C42 60 38 63 30 63 C22 63 18 60 18 56 Z" fill="#ddd2b6" /><path d="M18 56 H42 C42 60 38 63 30 63 C22 63 18 60 18 56 Z" fill="url(#bk-paper)" />
        <path d="M21 56 V59 M24 56 V60 M27 56 V60.4 M30 56 V60.6 M33 56 V60.4 M36 56 V60 M39 56 V59" stroke="#6a5a40" stroke-width=".6" />
      </g>
      <path d="M21 56 V53.6 M24 56 V53 M27 56 V52.8 M30 56 V52.8 M33 56 V52.8 M36 56 V53 M39 56 V53.6" stroke="#6a5a40" stroke-width=".6" />
    </g>

    <!-- расписная тарелка на подставке -->
    <g v-else-if="kind === 'plate'">
      <path d="M30 92 L48 60 L66 92" fill="none" stroke="url(#bk-wood-h)" stroke-width="3" />
      <circle cx="48" cy="48" r="40" fill="#000" opacity=".35" filter="url(#bk-soft)" transform="translate(2 3)" />
      <circle cx="48" cy="48" r="40" fill="#e8dfc8" /><circle cx="48" cy="48" r="40" fill="url(#bk-paper)" />
      <circle cx="48" cy="48" r="36.5" fill="none" stroke="#2f4f86" stroke-width="2.4" /><circle cx="48" cy="48" r="33" fill="none" stroke="#2f4f86" stroke-width=".8" stroke-dasharray="3 2.4" />
      <circle cx="48" cy="48" r="24" fill="#ded3b8" />
      <g fill="none" stroke="#2f4f86" stroke-width="1.6" stroke-linecap="round">
        <path d="M48 30 C42 38 42 44 48 48 C54 44 54 38 48 30 Z" /><path d="M30 48 C38 42 44 42 48 48 C44 54 38 54 30 48 Z" /><path d="M66 48 C58 42 52 42 48 48 C52 54 58 54 66 48 Z" /><path d="M48 66 C42 58 42 52 48 48 C54 52 54 58 48 66 Z" />
      </g>
      <circle cx="48" cy="48" r="40" fill="url(#bk-ball)" opacity=".7" />
    </g>
  </svg>
</template>

<script setup>
import { computed, ref } from 'vue'
import HourGlass from './HourGlass.vue'
import CandleDecor from './CandleDecor.vue'
import GlobeDecor from './GlobeDecor.vue'
import BottlesDecor from './BottlesDecor.vue'
import { DECOR, FLOOR, flicker } from './decor.js'

const props = defineProps({ kind: { type: String, required: true }, w: { type: Number, default: 0 }, seed: { type: Number, default: 1 } })
const uid = 'sd' + Math.random().toString(36).slice(2, 8)
const size = computed(() => (props.kind === 'tomes' ? { w: props.w, h: 200 } : DECOR[props.kind]))
// у каждой свечи свой ритм: длительность и сдвиг — от номера вещи
const flick = computed(() => (props.kind === 'crystal' || props.kind === 'skull' ? flicker(props.seed) : null))
// перо: стержень по кривой Безье, опахала разной ширины, бородки под углом к кончику
const QUILL = (() => {
  const P0 = [37, 84], P1 = [43, 44], P2 = [58, 5]
  const at = t => [(1 - t) ** 2 * P0[0] + 2 * (1 - t) * t * P1[0] + t * t * P2[0], (1 - t) ** 2 * P0[1] + 2 * (1 - t) * t * P1[1] + t * t * P2[1]]
  const tan = t => { const x = 2 * (1 - t) * (P1[0] - P0[0]) + 2 * t * (P2[0] - P1[0]), y = 2 * (1 - t) * (P1[1] - P0[1]) + 2 * t * (P2[1] - P1[1]), l = Math.hypot(x, y); return [x / l, y / l] }
  const wl = t => 8.5 * Math.pow(Math.sin(Math.PI * Math.min(1, (t - 0.2) / 0.82)), 0.7)
  const wr = t => 4.2 * Math.pow(Math.sin(Math.PI * Math.min(1, (t - 0.2) / 0.82)), 0.8)
  const f = n => n.toFixed(1)
  const L = [], R = [], barbs = []
  for (let t = 0.2; t <= 1.0001; t += 0.04) {
    const [x, y] = at(t), [tx, ty] = tan(t), nx = ty, ny = -tx
    L.push([x - nx * wl(t) + tx * 1.5, y - ny * wl(t) + ty * 1.5]); R.push([x + nx * wr(t) + tx * 1, y + ny * wr(t) + ty * 1])
  }
  for (let t = 0.24; t < 0.97; t += 0.035) {
    const [x, y] = at(t), [tx, ty] = tan(t), nx = ty, ny = -tx
    barbs.push(`M${f(x)} ${f(y)} l${f(-nx * wl(t) * 0.95 + tx * 2.2)} ${f(-ny * wl(t) * 0.95 + ty * 2.2)}`, `M${f(x)} ${f(y)} l${f(nx * wr(t) * 0.9 + tx * 1.6)} ${f(ny * wr(t) * 0.9 + ty * 1.6)}`)
  }
  const [bx, by] = at(0.2)
  const poly = pts => `M${f(bx)} ${f(by)} ` + pts.map(p => `L${f(p[0])} ${f(p[1])}`).join(' ') + ` L${f(P2[0])} ${f(P2[1])} Z`
  // зазубрины на опахале — перо старое
  const [n1x, n1y] = at(0.55), [n2x, n2y] = at(0.72)
  const fluff = [0.14, 0.17, 0.2, 0.23].map((t, i) => { const [x, y] = at(t); return `M${f(x)} ${f(y)} q${i % 2 ? 4 : -4} -2 ${i % 2 ? 6 : -6} -1` }).join(' ')
  return {
    left: poly(L), right: poly(R), barbs: barbs.join(' '), fluff,
    rachis: `M${P0[0]} ${P0[1]} Q${P1[0]} ${P1[1]} ${P2[0]} ${P2[1]}`,
    notches: `M${f(n1x - 7)} ${f(n1y - 1)} l3 1.4 M${f(n2x - 5.6)} ${f(n2y - 1)} l2.4 1.2`
  }
})()
// яйцо качается, череп щёлкает челюстью
const wob = ref(0), chat = ref(false)
const nudge = () => { wob.value = 0; setTimeout(() => { wob.value = Date.now() }, 20) }
const chatter = () => { chat.value = false; setTimeout(() => { chat.value = true; setTimeout(() => { chat.value = false }, 1300) }, 20) }
// кристаллы от щелчка вспыхивают и рассыпают искры
const ring = ref(0)
const chime = () => { ring.value++ }
function rng(s) { return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9 | 0) >>> 0) / 4294967296 }
const DULL = ['#3b2a1c', '#4a2f1d', '#2f3327', '#3a2226', '#2a2c35', '#51402a', '#33261c', '#402c2c', '#28302c', '#5a3a22']
const PIECE = ['#1c1410', '#4a1612', '#14201a', '#2a1418']

// ряд старых томов нужной ширины; последний иногда привалился к соседу — с зазором, чтобы не влезал в него
const tomes = computed(() => {
  const r = rng(props.seed * 7919 + 13), out = []
  let x = 0
  while (x < props.w - 16) {
    const w = Math.min(props.w - x, 15 + Math.round(r() * 22)), h = 118 + Math.round(r() * 72)
    const n = Math.floor(r() * 4)
    out.push({ x, w, h, c: DULL[Math.floor(r() * DULL.length)], bands: [0.08, 0.15, 0.86, 0.93].slice(0, n).map(k => Math.round(k * h)), gilt: r() > 0.45,
      label: r() > 0.45 && w > 18, lc: PIECE[Math.floor(r() * PIECE.length)], lines: r() > 0.5 ? [1, 2] : [1] })
    x += w + (r() > 0.85 ? 1 : 0)
  }
  if (out.length > 3 && r() > 0.4) {
    const last = out[out.length - 1], prev = out[out.length - 2]
    const a = 6 + r() * 5, rad = (a * Math.PI) / 180
    // где наклонённый том касается соседа: о его верхний угол или своим верхним углом
    const gap = prev.h < last.h * Math.cos(rad) ? prev.h * Math.tan(rad) : last.h * Math.sin(rad)
    const nx = prev.x + prev.w + gap
    if (nx + last.w <= props.w) { last.x = nx; last.lean = a }
  }
  return out
})
const stack = computed(() => {
  const r = rng(props.seed * 104729 + 7), out = []
  let y = DECOR.stack.h - 3
  for (let i = 0; i < 3 + Math.floor(r() * 2); i++) {
    const h = 14 + Math.round(r() * 8), w = 84 + Math.round(r() * 30)
    y -= h
    out.push({ x: Math.round(r() * (DECOR.stack.w - w)), y, w, h, c: DULL[Math.floor(r() * DULL.length)], lc: PIECE[Math.floor(r() * PIECE.length)] })
  }
  return out
})
const scrolls = computed(() => {
  const H = DECOR.scrolls.h
  return [
    { x: 6, y: H - 3 - 18, len: 50, r: 9, c: '#e6d8b0', tie: '#8e1a14' },
    { x: 44, y: H - 3 - 20, len: 46, r: 10, c: '#d9c79a', tie: '#2f4f86' },
    { x: 22, y: H - 3 - 18 - 17, len: 54, r: 8.5, c: '#efe4c4', tie: '#3f6b4a' }
  ]
})
// кристалл: шестигранная призма с острым концом, три видимые грани
function crystal(x, y, w, h, a) {
  const k = w / 6, p = -h * 0.72
  return {
    x, y, a,
    l: `M${-3 * k} 0 L${-3 * k} ${p} L0 ${-h} L${-k} ${p + 2} L${-k} 0 Z`,
    m: `M${-k} 0 L${-k} ${p + 2} L0 ${-h} L${k} ${p + 2} L${k} 0 Z`,
    r: `M${k} 0 L${k} ${p + 2} L0 ${-h} L${3 * k} ${p} L${3 * k} 0 Z`,
    edge: `M${-3 * k} 0 L${-3 * k} ${p} L0 ${-h} L${3 * k} ${p} L${3 * k} 0 M${-k} 0 L${-k} ${p + 2} L0 ${-h} M${k} 0 L${k} ${p + 2} L0 ${-h} M${-3 * k} ${p} L${-k} ${p + 2} L${k} ${p + 2} L${3 * k} ${p}`,
    glint: `M${1.6 * k} ${-h * 0.15} V${p + 6}`
  }
}
const crystals = [crystal(22, 80, 11, 34, -24), crystal(58, 79, 12, 36, 22), crystal(30, 78, 13, 50, -9), crystal(48, 78, 15, 64, 6), crystal(40, 80, 9, 26, 30)]
const sparks = [{ x: 46, y: 18, d: 0.2 }, { x: 26, y: 34, d: 1.7 }, { x: 64, y: 46, d: 3.1 }]
</script>

<style scoped>
.sd { display: block; overflow: visible; }
.sd-ov { mix-blend-mode: overlay; }
/* пламя: качание и мерцание с разными периодами — вместе не повторяются; у каждой свечи — свои */
.sd-fa { animation: sd-sway calc(var(--ft, 1.6s) * 1.9) ease-in-out infinite; animation-delay: var(--fd, 0s); transform-box: fill-box; transform-origin: 50% 100%; }
.sd-fb { animation: sd-flick var(--ft, 1.6s) ease-in-out infinite; animation-delay: calc(var(--fd, 0s) * 1.3); transform-box: fill-box; transform-origin: 50% 100%; }
.sd-glow { mix-blend-mode: screen; animation: sd-glow calc(var(--ft, 1.6s) * 1.4) ease-in-out infinite; animation-delay: var(--fd, 0s); transform-box: fill-box; transform-origin: center; }
.sd-glow.slow { animation-duration: 6s; }
.sd-hit { pointer-events: auto; cursor: pointer; outline: none; }
.sd-hit:focus-visible { outline: 1px dashed rgba(243, 220, 158, .7); outline-offset: 2px; }
.sd-flare { mix-blend-mode: screen; opacity: 0; transform-box: fill-box; transform-origin: center; animation: sd-flare 1.2s ease-out both; }
@keyframes sd-flare { 0% { opacity: 0; transform: scale(.6); } 15% { opacity: 1; transform: scale(1.15); } 100% { opacity: 0; transform: scale(1.5); } }
.sd-egg { transform-box: fill-box; transform-origin: 50% 100%; }
.wob .sd-egg { animation: sd-wob 1.1s cubic-bezier(.3, .6, .4, 1); }
@keyframes sd-wob { 0% { transform: rotate(0); } 15% { transform: rotate(-9deg); } 35% { transform: rotate(7deg); } 55% { transform: rotate(-4deg); } 75% { transform: rotate(2deg); } 100% { transform: rotate(0); } }
.sd-veins { animation: sd-veins 4.5s ease-in-out infinite; }
@keyframes sd-veins { 0%, 100% { opacity: .15; } 50% { opacity: .7; } }
.sd-eggglow { mix-blend-mode: screen; opacity: .35; animation: sd-veins 4.5s ease-in-out infinite; }
.sd-crack { opacity: 0; stroke-dasharray: 30; stroke-dashoffset: 30; }
.sd-crack.on { animation: sd-crack 2.6s ease-out forwards; }
@keyframes sd-crack { 0% { opacity: 1; stroke-dashoffset: 30; } 30% { opacity: 1; stroke-dashoffset: 0; } 100% { opacity: 0; stroke-dashoffset: 0; } }
.sd-jaw { transform-box: fill-box; transform-origin: 50% 0; }
.chat .sd-jaw { animation: sd-chat .2s ease-in-out 6; }
@keyframes sd-chat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(3.4px) rotate(2deg); } }
.sd-eyes { opacity: 0; transition: opacity .3s; }
.chat .sd-eyes { opacity: 1; }
.sd-twinkle.burst { animation: sd-twinkle 1.4s ease-out 1 both; }
.sd-twinkle { opacity: 0; transform-box: fill-box; transform-origin: center; animation: sd-twinkle 4.6s ease-in-out infinite; }
@keyframes sd-sway { 0%, 100% { transform: rotate(0); } 22% { transform: rotate(-2.6deg); } 47% { transform: rotate(1.4deg); } 71% { transform: rotate(-1deg); } 88% { transform: rotate(2.2deg); } }
@keyframes sd-flick { 0%, 100% { transform: scale(1, 1); } 13% { transform: scale(.96, 1.05); } 29% { transform: scale(1.03, .94); } 41% { transform: scale(.98, 1.07); } 63% { transform: scale(1.02, .97); } 82% { transform: scale(.97, 1.03); } }
@keyframes sd-glow { 0%, 100% { opacity: .85; } 31% { opacity: 1; } 52% { opacity: .74; } 77% { opacity: .95; } }
@keyframes sd-twinkle { 0%, 70%, 100% { opacity: 0; transform: scale(.3) rotate(0); } 80% { opacity: .95; transform: scale(1) rotate(20deg); } 90% { opacity: 0; transform: scale(.5) rotate(40deg); } }
@media (prefers-reduced-motion: reduce) { .sd-fa, .sd-fb, .sd-glow, .sd-twinkle, .sd-flare, .sd-veins, .sd-eggglow, .wob .sd-egg, .chat .sd-jaw, .sd-crack.on { animation: none; } }
</style>
