<template>
  <!-- вещи на полках стеллажа. Все стоят на полке (под каждой — тень касания), свет — сверху слева, как у книг -->
  <HourGlass v-if="kind === 'hourglass'" />
  <svg v-else class="sd" :class="kind" :width="size.w" :height="size.h" :viewBox="`0 0 ${size.w} ${size.h}`" :style="flick" aria-hidden="true">
    <ellipse v-if="kind !== 'tomes' && kind !== 'frame'" :cx="size.w / 2" :cy="size.h - 1.5" :rx="size.w * 0.48" ry="3.4" fill="url(#bk-shadow)" />

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

    <!-- фонарь: кованая рамка, свеча за стеклом -->
    <g v-else-if="kind === 'lantern'">
      <circle cx="42" cy="84" r="50" fill="url(#bk-candle)" class="sd-glow" />
      <path d="M33 14 a9 9 0 0 1 18 0" fill="none" stroke="url(#bk-blackiron-h)" stroke-width="3" />
      <path d="M28 22 H56 L66 36 H18 Z" fill="url(#bk-blackiron)" /><circle cx="42" cy="19" r="4" fill="url(#bk-blackiron)" />
      <rect x="20" y="36" width="44" height="86" fill="#ffcf8a" opacity=".08" />
      <rect x="35" y="90" width="14" height="32" fill="url(#bk-wax)" /><ellipse cx="42" cy="90" rx="7" ry="2" fill="#f6eedb" /><path d="M36.5 90 q-1 6 .6 10 q1.2 2 1.2 -3 Z" fill="#efe3c4" />
      <line x1="42" y1="90" x2="42" y2="85" stroke="#2a1d12" stroke-width="1.1" />
      <g transform="translate(42 85)"><g class="sd-fa"><g class="sd-fb">
        <path d="M0 -21 C5 -12 6.5 -5 4.5 -1 C3 1.6 -3 1.6 -4.5 -1 C-6.5 -5 -5 -12 0 -21 Z" fill="url(#bk-flame)" />
        <path d="M0 -11 C2.2 -6 2.6 -3 1.6 -1 C.9 .3 -.9 .3 -1.6 -1 C-2.6 -3 -2.2 -6 0 -11 Z" fill="#fffbe8" />
        <ellipse cx="0" cy="-.6" rx="1.8" ry="1.2" fill="#6aa8ff" opacity=".6" />
      </g></g></g>
      <rect x="20" y="36" width="44" height="86" fill="url(#bk-glass)" />
      <g fill="none" stroke="url(#bk-blackiron-h)" stroke-width="3.4"><rect x="20" y="36" width="44" height="86" rx="1" /></g>
      <g fill="none" stroke="#1c1d1f" stroke-width="1.6"><line x1="42" y1="36" x2="42" y2="62" /><line x1="20" y1="62" x2="64" y2="62" /></g>
      <path d="M12 122 H72 L68 132 H16 Z" fill="url(#bk-blackiron)" /><line x1="13" y1="122.8" x2="71" y2="122.8" stroke="#fff" stroke-opacity=".3" stroke-width=".8" />
      <rect x="18" y="132" width="9" height="6" rx="1" fill="#1c1d1f" /><rect x="57" y="132" width="9" height="6" rx="1" fill="#1c1d1f" />
    </g>

    <!-- свеча в латунном подсвечнике -->
    <g v-else-if="kind === 'candle'">
      <circle cx="28" cy="30" r="32" fill="url(#bk-candle)" class="sd-glow" />
      <path d="M46 84 a7 7 0 1 1 6 -9" fill="none" stroke="url(#bk-brass-h)" stroke-width="2.6" stroke-linecap="round" />
      <ellipse cx="28" cy="88" rx="25" ry="5.5" fill="url(#bk-brass)" /><ellipse cx="28" cy="86.4" rx="20" ry="3.6" fill="#8a6326" /><ellipse cx="28" cy="86" rx="18" ry="3" fill="url(#bk-brass)" opacity=".7" />
      <rect x="22" y="80" width="12" height="6" fill="url(#bk-brass-h)" /><ellipse cx="28" cy="80" rx="8.5" ry="2.4" fill="url(#bk-brass)" />
      <rect x="21" y="44" width="14" height="36" fill="url(#bk-wax)" />
      <ellipse cx="28" cy="44" rx="7" ry="2.2" fill="#e9dcbc" /><ellipse cx="28" cy="44.4" rx="5" ry="1.4" fill="#cdbd96" />
      <path d="M21 45 q-.8 7 .4 12 q.9 3 1.6 -1 q.4 -6 .6 -11 Z M34.8 45 q.9 4 .2 8 q-.6 2.4 -1.3 -1 Z" fill="#f3ead3" />
      <line x1="28" y1="44" x2="28.4" y2="39" stroke="#2a1d12" stroke-width="1.1" stroke-linecap="round" />
      <g transform="translate(28.4 39)"><g class="sd-fa"><g class="sd-fb">
        <path d="M0 -20 C5 -11 6.2 -5 4.3 -1 C2.8 1.6 -2.8 1.6 -4.3 -1 C-6.2 -5 -5 -11 0 -20 Z" fill="url(#bk-flame)" />
        <path d="M0 -10 C2 -5.6 2.4 -2.8 1.5 -1 C.8 .3 -.8 .3 -1.5 -1 C-2.4 -2.8 -2 -5.6 0 -10 Z" fill="#fffbe8" />
        <ellipse cx="0" cy="-.6" rx="1.7" ry="1.1" fill="#6aa8ff" opacity=".6" />
      </g></g></g>
    </g>

    <!-- глобус на точёной ножке -->
    <g v-else-if="kind === 'globe'">
      <path d="M24 122 H62 Q62 116 56 113 H30 Q24 116 24 122 Z" fill="url(#bk-wood-h)" /><ellipse cx="43" cy="113" rx="13" ry="2.4" fill="#8a5c34" />
      <path d="M40 113 V100 Q37 96 40 92 H46 Q49 96 46 100 V113 Z" fill="url(#bk-wood-h)" />
      <g transform="rotate(-23 43 52)">
        <path d="M43 18 A34 34 0 0 1 43 86" fill="none" stroke="#000" stroke-opacity=".4" stroke-width="5" transform="translate(1.5 1)" />
        <line x1="43" y1="16" x2="43" y2="88" stroke="url(#bk-brass-h)" stroke-width="2" />
      </g>
      <circle cx="43" cy="52" r="28" fill="#2c5866" />
      <circle cx="43" cy="52" r="28" fill="url(#bk-mottle)" opacity=".6" />
      <clipPath :id="uid + 'gc'"><circle cx="43" cy="52" r="28" /></clipPath>
      <g :clip-path="`url(#${uid}gc)`">
        <g transform="rotate(-23 43 52)" fill="#c2a46c" opacity=".88" stroke="#7a5a2e" stroke-width=".6" stroke-opacity=".7">
          <path d="M22 36 q7 -9 17 -5 q6 3 2 9 q-6 2 -8 9 q-1 7 -6 6 q-6 -6 -5 -19 Z" />
          <path d="M47 30 q9 -4 15 1 q3 5 -3 6 q-6 0 -8 5 q-4 -2 -4 -12 Z" />
          <path d="M48 52 q9 -3 13 4 q1 9 -6 14 q-6 2 -6 -6 q-4 -4 -1 -12 Z" />
          <path d="M28 66 q6 -1 8 4 q-1 5 -6 6 q-4 -4 -2 -10 Z" />
        </g>
        <g fill="none" stroke="#1a2c30" stroke-opacity=".45" stroke-width=".6" transform="rotate(-23 43 52)">
          <ellipse cx="43" cy="52" rx="28" ry="7" /><ellipse cx="43" cy="52" rx="28" ry="17" /><ellipse cx="43" cy="52" rx="10" ry="28" /><ellipse cx="43" cy="52" rx="21" ry="28" /><line x1="15" y1="52" x2="71" y2="52" />
        </g>
      </g>
      <circle cx="43" cy="52" r="28" fill="url(#bk-ball)" />
      <ellipse cx="34" cy="40" rx="7" ry="4" fill="#fff" opacity=".16" transform="rotate(-30 34 40)" />
      <g transform="rotate(-23 43 52)">
        <path d="M43 17 A35 35 0 0 1 43 87" fill="none" stroke="url(#bk-brass-h)" stroke-width="3.2" />
        <circle cx="43" cy="16.4" r="2" fill="url(#bk-brass)" /><circle cx="43" cy="87.6" r="2" fill="url(#bk-brass)" />
      </g>
      <path d="M43 93 Q52.5 93 56.6 86.2" fill="none" stroke="#000" stroke-opacity=".4" stroke-width="4.2" />
      <path d="M43 93 Q52.5 93 56.6 86.2" fill="none" stroke="url(#bk-brass-h)" stroke-width="2.8" stroke-linecap="round" />
      <ellipse cx="43" cy="93" rx="4" ry="1.8" fill="url(#bk-brass)" />
    </g>

    <!-- склянки: стекло с бликами, жидкость с мениском, пробки -->
    <g v-else-if="kind === 'bottles'">
      <!-- высокая аптечная -->
      <g>
        <ellipse cx="17" cy="101" rx="13" ry="3" fill="#3fd29a" opacity=".22" filter="url(#bk-soft)" />
        <path d="M6 100 V54 Q6 46 13 44 V30 H21 V44 Q28 46 28 54 V100 Z" fill="#163a2e" fill-opacity=".45" />
        <path d="M6 100 V68 Q17 70.5 28 68 V100 Z" fill="#2fb383" fill-opacity=".72" />
        <ellipse cx="17" cy="68.4" rx="11" ry="1.6" fill="#8ff0c8" opacity=".55" />
        <path d="M6 100 V54 Q6 46 13 44 V30 H21 V44 Q28 46 28 54 V100 Z" fill="url(#bk-glass)" />
        <path d="M6 100 V54 Q6 46 13 44 V30 H21 V44 Q28 46 28 54 V100 Z" fill="none" stroke="#d8fff0" stroke-opacity=".45" stroke-width=".9" />
        <path d="M9 56 V95" stroke="#fff" stroke-opacity=".55" stroke-width="1.8" stroke-linecap="round" />
        <rect x="11.8" y="22" width="10.4" height="9" rx="1.6" fill="#a47a48" /><rect x="11.8" y="22" width="10.4" height="9" rx="1.6" fill="url(#bk-leather)" class="sd-ov" opacity=".6" />
        <rect x="10.5" y="29.5" width="13" height="2.4" rx="1" fill="#7a2a1e" />
      </g>
      <!-- круглая колба -->
      <g>
        <ellipse cx="51" cy="101" rx="18" ry="3.2" fill="#b56cff" opacity=".22" filter="url(#bk-soft)" />
        <path d="M37 100 L40.5 86 H61.5 L65 100 Z" fill="#8a6a3c" /><path d="M37 100 L40.5 86 H61.5 L65 100 Z" fill="url(#bk-weave)" />
        <path d="M38.6 94 H63.4 M39.8 89.5 H62.2" stroke="#5a4020" stroke-width=".8" /><path d="M37 100 L40.5 86 H61.5 L65 100 Z" fill="url(#bk-round)" />
        <path d="M47 24 H55 V50 A21 21 0 1 1 47 50 Z" fill="#2a1638" fill-opacity=".45" />
        <path d="M31.4 78 Q51 81 70.6 78 A21 21 0 0 1 31.4 78 Z" fill="#9b4fe0" fill-opacity=".72" />
        <ellipse cx="51" cy="78.6" rx="19.6" ry="2" fill="#e0b8ff" opacity=".5" />
        <path d="M47 24 H55 V50 A21 21 0 1 1 47 50 Z" fill="url(#bk-glass)" />
        <path d="M47 24 H55 V50 A21 21 0 1 1 47 50 Z" fill="none" stroke="#f1e6ff" stroke-opacity=".45" stroke-width=".9" />
        <path d="M36 64 Q38 56 44 53" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="2" stroke-linecap="round" />
        <path d="M65 88 Q67 82 66.5 76" fill="none" stroke="#fff" stroke-opacity=".22" stroke-width="1.2" stroke-linecap="round" />
        <rect x="46" y="16" width="10" height="9" rx="1.6" fill="#a47a48" /><rect x="46" y="16" width="10" height="9" rx="1.6" fill="url(#bk-leather)" class="sd-ov" opacity=".6" />
        <path d="M45 24.5 H57" stroke="#d9c79c" stroke-width="1.4" /><path d="M56 25 q4 3 2 8" fill="none" stroke="#d9c79c" stroke-width="1" />
      </g>
      <!-- пузырёк с ярлыком -->
      <g>
        <ellipse cx="84" cy="101" rx="10" ry="2.6" fill="#ff8a4a" opacity=".22" filter="url(#bk-soft)" />
        <path d="M76 100 V70 Q76 64 81 63 V57 H87 V63 Q92 64 92 70 V100 Z" fill="#3a1c10" fill-opacity=".5" />
        <path d="M76 100 V80 Q84 81.5 92 80 V100 Z" fill="#d0602a" fill-opacity=".75" />
        <rect x="77.5" y="84" width="13" height="11" fill="#e4d6b0" /><rect x="77.5" y="84" width="13" height="11" fill="url(#bk-paper)" />
        <path d="M80 88 h8 M80 91 h6" stroke="#3a2a18" stroke-opacity=".6" stroke-width=".6" />
        <path d="M76 100 V70 Q76 64 81 63 V57 H87 V63 Q92 64 92 70 V100 Z" fill="url(#bk-glass)" />
        <path d="M76 100 V70 Q76 64 81 63 V57 H87 V63 Q92 64 92 70 V100 Z" fill="none" stroke="#ffe8d8" stroke-opacity=".4" stroke-width=".8" />
        <path d="M78.4 71 V81" stroke="#fff" stroke-opacity=".5" stroke-width="1.4" stroke-linecap="round" />
        <rect x="80" y="51" width="8" height="7" rx="1.4" fill="#5a2a1e" /><ellipse cx="84" cy="51.5" rx="4" ry="1.4" fill="#8a3a2a" />
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
      <path d="M41 96 C34 64 40 32 56 6 C58 26 54 50 46 70 C44 80 43 88 42.5 96 Z" fill="#ece3cc" />
      <path d="M41 96 C34 64 40 32 56 6 C58 26 54 50 46 70 C44 80 43 88 42.5 96 Z" fill="url(#bk-paper)" />
      <path d="M42 96 C43 64 48 32 56 6" fill="none" stroke="#9a8a62" stroke-width=".9" />
      <path d="M44 40 l6 -5 M43 50 l7 -4 M42.6 60 l6 -3 M45 32 l5 -6" stroke="#b8a878" stroke-width=".6" />
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
    <g v-else-if="kind === 'crystal'">
      <circle cx="40" cy="58" r="40" fill="url(#bk-cold)" class="sd-glow slow" />
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
        <path v-for="(sp, i) in sparks" :key="'s' + i" class="sd-twinkle" :style="{ animationDelay: sp.d + 's' }" :d="`M${sp.x} ${sp.y - 4} L${sp.x + 0.7} ${sp.y - 0.7} L${sp.x + 4} ${sp.y} L${sp.x + 0.7} ${sp.y + 0.7} L${sp.x} ${sp.y + 4} L${sp.x - 0.7} ${sp.y + 0.7} L${sp.x - 4} ${sp.y} L${sp.x - 0.7} ${sp.y - 0.7} Z`" />
      </g>
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
import { computed } from 'vue'
import HourGlass from './HourGlass.vue'
import { DECOR, flicker } from './decor.js'

const props = defineProps({ kind: { type: String, required: true }, w: { type: Number, default: 0 }, seed: { type: Number, default: 1 } })
const uid = 'sd' + Math.random().toString(36).slice(2, 8)
const size = computed(() => (props.kind === 'tomes' ? { w: props.w, h: 200 } : DECOR[props.kind]))
// у каждой свечи свой ритм: длительность и сдвиг — от номера вещи
const flick = computed(() => (props.kind === 'candle' || props.kind === 'lantern' || props.kind === 'crystal' ? flicker(props.seed) : null))
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
.sd-twinkle { opacity: 0; transform-box: fill-box; transform-origin: center; animation: sd-twinkle 4.6s ease-in-out infinite; }
@keyframes sd-sway { 0%, 100% { transform: rotate(0); } 22% { transform: rotate(-2.6deg); } 47% { transform: rotate(1.4deg); } 71% { transform: rotate(-1deg); } 88% { transform: rotate(2.2deg); } }
@keyframes sd-flick { 0%, 100% { transform: scale(1, 1); } 13% { transform: scale(.96, 1.05); } 29% { transform: scale(1.03, .94); } 41% { transform: scale(.98, 1.07); } 63% { transform: scale(1.02, .97); } 82% { transform: scale(.97, 1.03); } }
@keyframes sd-glow { 0%, 100% { opacity: .85; } 31% { opacity: 1; } 52% { opacity: .74; } 77% { opacity: .95; } }
@keyframes sd-twinkle { 0%, 70%, 100% { opacity: 0; transform: scale(.3) rotate(0); } 80% { opacity: .95; transform: scale(1) rotate(20deg); } 90% { opacity: 0; transform: scale(.5) rotate(40deg); } }
@media (prefers-reduced-motion: reduce) { .sd-fa, .sd-fb, .sd-glow, .sd-twinkle { animation: none; } }
</style>
