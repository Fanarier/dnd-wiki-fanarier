<template>
  <!-- книга героя: у каждого свой предмет на корешке и своя жизнь. Наведи на книгу — она «просыпается».
       layer="in" — на корешке (под обрезкой), "out" — то, что выходит за корешок -->
  <g v-if="layer === 'in'" class="fx">
    <!-- ЭНДИ: латунные шестерни, манометр со стрелкой, паровая труба с вентилем -->
    <template v-if="fx === 'andy'">
      <g :transform="T(g.W - 7, 0)">
        <rect x="-3" y="46" width="6" :height="g.H - 72" fill="url(#bk-brass-h)" />
        <rect x="-3" y="46" width="6" :height="g.H - 72" fill="#000" opacity=".15" />
        <g v-for="y in [46, (g.H + 22) / 2, g.H - 28]" :key="y"><rect x="-5" :y="y - 2" width="10" height="4" rx="1" fill="url(#bk-brass)" /><circle cx="-3" :cy="y" r=".7" fill="#3a2610" /><circle cx="3" :cy="y" r=".7" fill="#3a2610" /></g>
        <g :transform="T(0, (g.H + 22) / 2 + 22)">
          <g class="fx-hspin"><circle r="5" fill="none" stroke="url(#bk-brass)" stroke-width="1.6" /><path d="M-4.5 0 H4.5 M0 -4.5 V4.5" stroke="url(#bk-brass)" stroke-width="1.1" /></g>
          <circle r="1.2" fill="#7a2a1e" />
        </g>
        <circle class="fx-hpuff" cx="0" cy="44" r="4" fill="#efe9dc" filter="url(#bk-soft)" />
      </g>
      <g :transform="T(g.W / 2 - 4, g.emY + 1)"><g class="fx-hspin"><g class="fx-spin"><g :transform="S(g.es)"><path :d="P.gear" fill="url(#bk-brass)" fill-rule="evenodd" stroke="#3a2610" stroke-width=".5" /></g></g></g></g>
      <g :transform="T(g.W / 2 + g.es * 0.38, g.emY + g.es * 0.62)"><g class="fx-hspin rev"><g class="fx-spin rev"><g :transform="S(g.es * 0.52)"><path :d="P.gear" fill="url(#bk-brass)" fill-rule="evenodd" stroke="#3a2610" stroke-width=".5" /></g></g></g></g>
      <g :transform="T(13.5, g.emY + 2)">
        <circle r="9.4" fill="url(#bk-brass)" /><circle r="9.4" fill="none" stroke="#3a2610" stroke-width=".6" />
        <circle r="7.4" fill="#efe6cf" /><circle r="7.4" fill="url(#bk-paper)" />
        <path d="M-5.2 3.4 A6.2 6.2 0 1 1 5.2 3.4" fill="none" stroke="#3a2a18" stroke-width="1.2" stroke-dasharray=".5 1.7" />
        <path d="M3 -5.4 A6.2 6.2 0 0 1 5.6 2.6" fill="none" stroke="#b3261e" stroke-width="1.5" />
        <g class="fx-needle"><path d="M-.5 0 L0 -6 L.5 0 Z" fill="#1a120c" /></g>
        <circle r="1.2" fill="url(#bk-brass)" />
        <ellipse cx="-2.4" cy="-3.2" rx="3.2" ry="1.5" fill="#fff" opacity=".4" transform="rotate(-30 -2.4 -3.2)" />
      </g>
    </template>

    <!-- ХИРОШИ: книга — как рукоять катаны: шёлковая обмотка, цуба, по «клинку» пробегает блик -->
    <template v-else-if="fx === 'hiroshi'">
      <rect x="0" y="5" :width="g.W" :height="wrapEnd - 5" fill="#efe6cf" />
      <rect x="0" y="5" :width="g.W" :height="wrapEnd - 5" fill="url(#bk-paper)" />
      <g stroke-linecap="butt">
        <path :d="ito" fill="none" stroke="#000" stroke-opacity=".45" stroke-width="4.4" transform="translate(.4 .8)" />
        <path :d="ito" fill="none" stroke="#1d1414" stroke-width="3.8" />
        <path :d="ito" fill="none" stroke="#fff" stroke-opacity=".14" stroke-width=".7" transform="translate(-.5 -.6)" />
      </g>
      <g :transform="T(g.W / 2, wrapEnd + 4)">
        <rect :x="-g.W / 2" y="-3.2" :width="g.W" height="6.4" fill="url(#bk-blackiron)" />
        <line :x1="-g.W / 2" :x2="g.W / 2" y1="-3.2" y2="-3.2" stroke="#d9b25c" stroke-width=".8" /><line :x1="-g.W / 2" :x2="g.W / 2" y1="3.2" y2="3.2" stroke="#d9b25c" stroke-width=".8" />
        <circle r="1.6" fill="#d9b25c" />
      </g>
      <rect class="fx-hblade" :x="g.W - 4.5" :y="wrapEnd + 10" width="2" height="26" fill="#fff" opacity="0" />
      <path class="fx-hshow" :d="`M${g.W - 3.5} ${wrapEnd + 10} V${g.H - 10}`" stroke="#fff" stroke-opacity=".5" stroke-width=".6" />
    </template>

    <!-- КАСУМИ: латунная астролябия, мерцают звёзды; при наведении проступают созвездия -->
    <template v-else-if="fx === 'kasumi'">
      <path class="fx-hdraw" :d="g.starLines" fill="none" stroke="#e6f0ff" stroke-width=".7" pathLength="100" />
      <g fill="#fff">
        <path v-for="(p, i) in g.stars.slice(0, 7)" :key="i" class="fx-twinkle" :style="{ animationDelay: (i * 0.73).toFixed(2) + 's' }" :d="spark(p.x, p.y, 2.6)" />
      </g>
      <g :transform="T(g.W / 2, g.emY)">
        <circle r="11.4" fill="#000" opacity=".4" transform="translate(.6 .9)" />
        <circle r="11.4" fill="url(#bk-brass)" />
        <circle r="9.4" fill="#141a2b" />
        <circle r="8.3" fill="none" stroke="#d9b25c" stroke-width="1.3" stroke-dasharray=".5 1.5" />
        <g class="fx-spin slow"><g class="fx-hspin">
          <circle r="4.6" fill="none" stroke="#d6dbe4" stroke-width=".8" />
          <path d="M0 -8 L1.1 -2.4 L6.6 2.8 L1 1.2 L0 7.6 L-1 1.2 L-6.6 2.8 L-1.1 -2.4 Z" fill="none" stroke="#d6dbe4" stroke-width=".7" stroke-linejoin="round" />
          <circle cx="0" cy="-8" r="1" fill="#fff" />
        </g></g>
        <circle r="1.3" fill="url(#bk-brass)" />
      </g>
      <g v-if="!reduce" opacity="0">
        <line x1="0" y1="0" x2="12" y2="-5" stroke="#fff" stroke-width="1" stroke-linecap="round" />
        <circle r="1.1" fill="#fff" />
        <animateTransform attributeName="transform" type="translate" :values="`${g.W + 6} ${g.H * 0.18};${-14} ${g.H * 0.36};${-14} ${g.H * 0.36}`" keyTimes="0;.07;1" dur="8s" begin="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0;1;0;0" keyTimes="0;.03;.07;1" dur="8s" begin="2s" repeatCount="indefinite" />
      </g>
    </template>

    <!-- ДОЛОР: в бороздах тлеет жар, на ремне — клык зверя; при наведении жар вспыхивает -->
    <template v-else-if="fx === 'dolor'">
      <rect class="fx-hshow" :width="g.W" :height="g.H" fill="#ff4a10" style="mix-blend-mode: overlay; --o: .2" />
      <g fill="none" stroke-linecap="round">
        <path v-for="(d, i) in g.claws" :key="i" :d="d" class="fx-ember" :style="{ animationDelay: (i * 0.6) + 's' }" stroke="#ff7a24" stroke-width="1.2" />
        <path v-for="(d, i) in g.claws" :key="'h' + i" :d="d" class="fx-hshow" stroke="#ffd27a" stroke-width="1.6" filter="url(#bk-soft)" />
      </g>
      <g :transform="T(g.W / 2, g.emY)"><g :transform="S(g.es)"><path :d="P.claw" fill="none" :stroke="paint" stroke-width="1.8" stroke-linecap="round" /></g></g>
      <g :transform="T(9, g.strapY + 4)">
        <path d="M-3.4 0 C-4.4 12 -1 24 6 32 C2.6 22 2.4 11 3.4 0 Z" fill="#000" opacity=".4" transform="translate(.8 1)" />
        <path d="M-3.4 0 C-4.4 12 -1 24 6 32 C2.6 22 2.4 11 3.4 0 Z" fill="#efe3c4" />
        <path d="M-1.6 2 C-2 12 0 22 5 30" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width=".7" />
        <path d="M-3.4 0 C-4.4 12 -1 24 6 32" fill="none" stroke="#8a7650" stroke-width=".5" />
        <rect x="-4.4" y="-3" width="9" height="5" rx="1.2" fill="#3b2a1b" /><path d="M-4.4 -1 H4.6 M-4.4 1 H4.6" stroke="#d9c79c" stroke-opacity=".5" stroke-width=".5" stroke-dasharray="1.2 1" />
      </g>
    </template>

    <!-- ЦУРУЯ: живой глаз (при наведении распахивается), по цепям бегут отблески -->
    <template v-else-if="fx === 'tsuruya'">
      <clipPath :id="id + 'ey'"><path :d="P.eyeShape" :transform="`${T(g.W / 2, g.emY)} ${S(g.es)}`" /></clipPath>
      <g :transform="T(g.W / 2, g.emY)"><g :transform="S(g.es)"><path :d="P.eyeShape" fill="#12060c" /></g></g>
      <g :clip-path="`url(#${id}ey)`">
        <g :transform="T(g.W / 2, g.emY)">
          <g class="fx-look"><g class="fx-heye">
            <circle :r="g.es * 0.19" :fill="glow" filter="url(#bk-glow)" :style="{ color: glow }" />
            <ellipse class="fx-pupil" :rx="g.es * 0.045" :ry="g.es * 0.15" fill="#080306" />
            <circle :cx="-g.es * 0.06" :cy="-g.es * 0.07" :r="g.es * 0.035" fill="#fff" opacity=".9" />
          </g></g>
        </g>
        <rect class="fx-blink" :x="g.W / 2 - g.es / 2" :y="g.emY - g.es / 2" :width="g.es" :height="g.es" :fill="look.c" />
      </g>
      <g :transform="T(g.W / 2, g.emY)"><g :transform="S(g.es)"><path :d="P.eyeShape" fill="none" :stroke="paint" stroke-width="1.3" /></g></g>
      <circle class="fx-hshow" :cx="g.W / 2" :cy="g.emY" :r="g.es * 0.62" :fill="glow" style="--o: .28" filter="url(#bk-soft)" />
      <g v-if="!reduce">
        <ellipse v-for="(y, i) in g.chainY" :key="i" :cy="y - 1" rx="2.4" ry="1" fill="#fff" opacity="0">
          <animate attributeName="cx" :values="`-4;${g.W + 4};${g.W + 4}`" keyTimes="0;.3;1" dur="4.6s" :begin="(i * 1.7) + 's'" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0;.9;0;0" keyTimes="0;.15;.3;1" dur="4.6s" :begin="(i * 1.7) + 's'" repeatCount="indefinite" />
        </ellipse>
      </g>
    </template>

    <!-- ЭЛИАС: камень пульсирует холодным светом, по корешку тянет ветер высоты -->
    <template v-else-if="fx === 'elias'">
      <g :transform="T(g.W / 2, g.emY)"><g :transform="S(g.es)"><path :d="P.wing" :fill="paint" filter="url(#bk-tool)" /></g></g>
      <circle :cx="g.W / 2" :cy="g.gemY" r="9" :fill="glow" class="fx-gem" filter="url(#bk-soft)" />
      <circle class="fx-hshow" :cx="g.W / 2" :cy="g.gemY" r="14" :fill="glow" style="--o: .45" filter="url(#bk-soft)" />
      <g v-if="!reduce" stroke="#e8f6ff" stroke-linecap="round" fill="none">
        <path v-for="(k, i) in [0.32, 0.58, 0.78]" :key="i" :d="`M0 ${g.H * k} q${g.W * 0.25} -3 ${g.W * 0.5} 0`" stroke-width=".7" opacity="0">
          <animateTransform attributeName="transform" type="translate" :values="`${-g.W} 0;${g.W} 0;${g.W} 0`" keyTimes="0;.35;1" dur="6s" :begin="(i * 1.9) + 's'" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0;.55;0;0" keyTimes="0;.15;.35;1" dur="6s" :begin="(i * 1.9) + 's'" repeatCount="indefinite" />
        </path>
      </g>
    </template>

    <!-- ЛЁВА: оптический прицел, патроны в петлях ремня, красная точка бродит и замирает в перекрестье -->
    <template v-else-if="fx === 'lowe'">
      <g :transform="T(g.W / 2, g.emY)">
        <circle r="11" fill="#000" opacity=".45" transform="translate(.7 1)" />
        <circle r="11" fill="url(#bk-blackiron)" /><circle r="11" fill="none" stroke="#000" stroke-width=".6" />
        <circle r="8.4" fill="#0e2a2c" /><circle r="8.4" :fill="`url(#${id}lens)`" />
        <radialGradient :id="id + 'lens'" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#7fd0c8" stop-opacity=".55" /><stop offset=".5" stop-color="#1e4a50" stop-opacity=".2" /><stop offset="1" stop-color="#000" stop-opacity=".6" /></radialGradient>
        <g class="fx-zero"><g class="fx-hzoom">
          <circle r="5.2" fill="none" stroke="#111" stroke-width=".5" opacity=".8" />
          <path d="M0 -8 V-1.6 M0 1.6 V8 M-8 0 H-1.6 M1.6 0 H8" stroke="#111" stroke-width=".55" />
          <circle r=".7" fill="#e0302a" />
        </g></g>
        <path d="M-6 -5 A8 8 0 0 1 2 -8" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="1.1" stroke-linecap="round" />
        <path class="fx-hshow" d="M-6 -6 L6 6" stroke="#fff" stroke-opacity=".5" stroke-width="2" stroke-linecap="round" />
      </g>
      <g v-for="(x, i) in rounds" :key="'rd' + i" :transform="T(x, g.strapY)">
        <rect x="-1.6" y="-9" width="3.2" height="11" rx=".6" fill="url(#bk-brass-h)" />
        <path d="M-1.6 -9 Q-1.6 -13.4 0 -14 Q1.6 -13.4 1.6 -9 Z" fill="#b8693a" />
        <path d="M-1 -13 Q-1 -10 -1 -9" stroke="#fff" stroke-opacity=".5" stroke-width=".5" />
      </g>
      <rect v-for="(x, i) in rounds" :key="'lp' + i" :x="x - 2.6" :y="g.strapY - 2" width="5.2" height="5.2" fill="#3b2a1b" stroke="#000" stroke-opacity=".3" stroke-width=".4" />
      <g v-if="!reduce">
        <circle r="3.4" fill="#ff2a1a" opacity=".3" /><circle r="1.3" fill="#ff4a3a" />
        <animateMotion :path="laserPath" dur="10s" repeatCount="indefinite" keyPoints="0;.25;.5;.75;1;1" keyTimes="0;.18;.36;.54;.7;1" calcMode="spline" keySplines=".4 0 .2 1;.4 0 .2 1;.4 0 .2 1;.4 0 .2 1;0 0 1 1" />
        <animate attributeName="opacity" values="1;1;.2;1;.2;1" keyTimes="0;.74;.8;.86;.92;1" dur="10s" repeatCount="indefinite" />
      </g>
    </template>

    <!-- БЕЛАТОР: по коже пробегает золотой отблеск -->
    <template v-else-if="fx === 'belator'">
      <g :transform="T(g.W / 2, g.emY)"><g :transform="S(g.es)"><path :d="P.sun" fill="none" :stroke="paint" stroke-width="1.4" stroke-linecap="round" filter="url(#bk-tool)" /></g></g>
      <linearGradient :id="id + 'sh'" x1="0" x2="1"><stop offset="0" stop-color="#fff6d8" stop-opacity="0" /><stop offset=".5" stop-color="#fff6d8" stop-opacity=".45" /><stop offset="1" stop-color="#fff6d8" stop-opacity="0" /></linearGradient>
      <rect v-if="!reduce" :x="-g.W" y="-30" :width="g.W * 0.7" :height="g.H + 60" :fill="`url(#${id}sh)`" class="bs-ov" transform="skewY(-28)">
        <animate attributeName="x" :values="`${-g.W};${g.W * 1.4};${g.W * 1.4}`" keyTimes="0;.3;1" dur="7s" repeatCount="indefinite" />
      </rect>
      <rect class="fx-hshow" :width="g.W" :height="g.H" fill="#ffe7a0" style="mix-blend-mode: overlay; --o: .16" />
    </template>

    <!-- ДЖИЛЛ: снежинка медленно вращается, с сосульки срывается капля; при наведении иней трещит -->
    <template v-else-if="fx === 'jill'">
      <g :transform="T(g.W / 2, g.emY)"><g class="fx-spin slow"><g :transform="S(g.es)"><path :d="P.snow" fill="none" :stroke="paint" stroke-width="1.6" stroke-linecap="round" /></g></g></g>
      <path class="fx-hshow" :d="cracks" fill="none" stroke="#f4fbff" stroke-width=".6" stroke-linecap="round" />
      <g v-if="!reduce && drip">
        <ellipse :cx="drip.x" :cy="drip.y" rx="1" ry="1.3" fill="#e6f7ff" opacity="0">
          <animate attributeName="cy" :values="`${drip.y};${drip.y};${drip.y + 1.5};${g.H + 4}`" keyTimes="0;.55;.7;1" dur="4.4s" repeatCount="indefinite" calcMode="spline" keySplines="0 0 1 1;.4 0 .6 1;.5 0 1 1" />
          <animate attributeName="opacity" values="0;.95;.95;0" keyTimes="0;.3;.85;1" dur="4.4s" repeatCount="indefinite" />
        </ellipse>
      </g>
    </template>

    <!-- ОРВИЛЛ: крест бьётся как сердце, через него бежит линия пульса; при наведении сердце частит -->
    <template v-else-if="fx === 'orvill'">
      <g :transform="T(g.W / 2, g.emY)"><g class="fx-beat"><g :transform="S(g.es)"><path :d="P.cross" :fill="paint" /></g></g></g>
      <path :d="ecg" fill="none" stroke="#ff6a5a" stroke-width="1" stroke-linejoin="round" stroke-linecap="round" class="fx-ecg" pathLength="100" />
    </template>

    <!-- АЗИЭЛЬ: полумесяц — окно в звёздную пустоту; руны разгораются и гаснут, когда на книгу смотрят -->
    <template v-else-if="fx === 'aziel'">
      <clipPath :id="id + 'mn'"><path :d="P.moon" :transform="`${T(g.W / 2, g.emY)} ${S(g.es + 6)}`" /></clipPath>
      <radialGradient :id="id + 'vd'" cx=".6" cy=".4" r=".8"><stop offset="0" stop-color="#3a2466" /><stop offset=".6" stop-color="#140a26" /><stop offset="1" stop-color="#05020c" /></radialGradient>
      <g :clip-path="`url(#${id}mn)`">
        <rect :x="g.W / 2 - 20" :y="g.emY - 20" width="40" height="40" :fill="`url(#${id}vd)`" />
        <g class="fx-drift" fill="#fff">
          <circle v-for="(p, i) in voidStars" :key="i" :cx="g.W / 2 + p.x" :cy="g.emY + p.y" :r="p.r" :opacity="p.o" />
        </g>
        <circle class="fx-hshow" :cx="g.W / 2 + 3" :cy="g.emY - 2" r="8" fill="#a48bff" style="--o: .5" filter="url(#bk-soft)" />
      </g>
      <g :transform="`${T(g.W / 2, g.emY)} ${S(g.es + 6)}`"><path :d="P.moon" fill="none" stroke="#c8ccd4" stroke-width=".9" filter="url(#bk-deboss)" /></g>
      <g class="fx-runes" fill="none" :stroke="glow" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" filter="url(#bk-glow)" :style="{ color: glow }">
        <path v-for="(rn, i) in g.runes" :key="i" :d="rn.d" :transform="T(rn.x, rn.y)" class="fx-rune" :style="{ animationDelay: (i * 1.1) + 's' }" />
      </g>
    </template>

    <!-- КРИСТИАН: смотровая щель шлема светится, мигает огонёк, по стали — блик; при наведении — луч сканирует -->
    <template v-else-if="fx === 'kristian'">
      <g :transform="T(g.W / 2, g.emY)">
        <rect :x="-g.W / 2 + 7" y="-4.6" :width="g.W - 14" height="9.2" rx="2" fill="url(#bk-iron)" />
        <rect :x="-g.W / 2 + 9" y="-2" :width="g.W - 18" height="4" rx="1.6" fill="#05080a" />
        <rect :x="-g.W / 2 + 10" y="-.7" :width="g.W - 20" height="1.4" rx=".7" fill="#5fe1ff" class="fx-visor" filter="url(#bk-glow)" style="color: #5fe1ff" />
        <circle :cx="-g.W / 2 + 10" r="1" fill="#c8ccd4" /><circle :cx="g.W / 2 - 10" r="1" fill="#c8ccd4" />
      </g>
      <rect class="fx-hshow fx-scan" x="0" y="0" :width="g.W" height="3" fill="#5fe1ff" style="--o: .4" filter="url(#bk-soft)" />
      <circle :cx="g.W - 8" :cy="g.H - 16" r="4" fill="#ff3a2a" class="fx-led" filter="url(#bk-soft)" /><circle :cx="g.W - 8" :cy="g.H - 16" r="1.6" fill="#ff6a4a" class="fx-led" />
      <rect v-if="!reduce" x="-12" y="0" width="7" :height="g.H" fill="#fff" opacity=".16" transform="skewX(-12)">
        <animate attributeName="x" :values="`-12;${g.W + 20};${g.W + 20}`" keyTimes="0;.22;1" dur="6.5s" repeatCount="indefinite" />
      </rect>
    </template>
  </g>

  <!-- то, что выходит за корешок -->
  <g v-else class="fx">
    <!-- Энди: пар из-под переплёта -->
    <g v-if="fx === 'andy'" filter="url(#bk-soft)">
      <circle v-for="i in 3" :key="i" :cx="g.W * 0.36" cy="-2" r="4.5" fill="#efe9dc" class="fx-steam" :style="{ animationDelay: (i - 1) * 1.25 + 's' }" />
      <circle v-for="i in 3" :key="'h' + i" :cx="g.W * 0.36 + (i - 2) * 6" cy="-2" r="5.5" fill="#efe9dc" class="fx-steam fast fx-hshow" :style="{ animationDelay: (i - 1) * 0.3 + 's' }" />
    </g>
    <!-- Хироши: шёлковая кисть на цубе, иногда падает лепесток сакуры -->
    <g v-else-if="fx === 'hiroshi'">
      <g class="fx-sway" :style="{ transformOrigin: `${g.W * 0.78}px ${wrapEnd + 6}px` }"><g class="fx-hsway" :style="{ transformOrigin: `${g.W * 0.78}px ${wrapEnd + 6}px` }">
        <path :d="`M${g.W * 0.78} ${wrapEnd + 6} V${wrapEnd + 22}`" stroke="#d9b25c" stroke-width="1.2" />
        <circle :cx="g.W * 0.78" :cy="wrapEnd + 22.5" r="2.2" fill="url(#bk-brass)" />
        <path :d="`M${g.W * 0.78 - 2.6} ${wrapEnd + 24} h5.2 l1.4 14 h-8 Z`" fill="#efe6cf" /><path :d="`M${g.W * 0.78 - 2.4} ${wrapEnd + 26} V${wrapEnd + 38} M${g.W * 0.78} ${wrapEnd + 26} V${wrapEnd + 38.5} M${g.W * 0.78 + 2.2} ${wrapEnd + 26} V${wrapEnd + 38}`" stroke="#b8ad90" stroke-width=".5" />
      </g></g>
      <path v-if="!reduce" d="M0 0 q3 -3 5 0 q-1 3 -2.5 3.6 q-1.5 -.6 -2.5 -3.6 Z" fill="#f4b6c6" opacity="0">
        <animateMotion :path="`M${g.W * 0.1} -14 C${g.W * 0.9} ${g.H * 0.2} ${-g.W * 0.2} ${g.H * 0.5} ${g.W * 0.7} ${g.H * 0.95}`" dur="12s" begin="3s" repeatCount="indefinite" keyPoints="0;1;1" keyTimes="0;.6;1" rotate="auto" />
        <animate attributeName="opacity" values="0;.95;.95;0;0" keyTimes="0;.06;.52;.6;1" dur="12s" begin="3s" repeatCount="indefinite" />
      </path>
    </g>
    <!-- Цуруя: рожки над книгой; при наведении на кончиках разгорается свет -->
    <g v-else-if="fx === 'tsuruya'">
      <linearGradient :id="id + 'hn'" x1="0" x2="0" y1="1" y2="0"><stop offset="0" stop-color="#1b1118" /><stop offset=".6" stop-color="#4a2436" /><stop offset="1" stop-color="#c06a8e" /></linearGradient>
      <g v-for="side in [-1, 1]" :key="side" :transform="`translate(${g.W / 2 + side * g.W * 0.27} 2) scale(${side} 1)`">
        <path d="M-4.4 1 C-5 -6 -3 -11 3.6 -15.5 C0.6 -10.4 0 -6 4.2 1 Z" :fill="`url(#${id}hn)`" stroke="#000" stroke-opacity=".5" stroke-width=".5" />
        <path d="M-3.2 -2.4 Q-.6 -2.8 1.8 -2 M-2.8 -6 Q-.8 -6.6 1.4 -6 M-1.6 -9.6 Q0 -10 1.8 -9.6" fill="none" stroke="#000" stroke-opacity=".35" stroke-width=".5" />
        <circle class="fx-hshow" cx="3.4" cy="-15" r="3.2" :fill="glow" style="--o: .8" filter="url(#bk-soft)" />
      </g>
    </g>
    <!-- Элиас: крыло дракона накрыло угол книги; при наведении машет -->
    <g v-else-if="fx === 'elias'" :transform="T(g.W * 0.2, 9)">
      <g class="fx-hflap">
        <path d="M0 0 L-3 -19 Q2 -14 6 -15 L9 -23 Q12 -15 17 -16 L23 -19 Q22 -10 27 -8 L31 -9 Q24 -3 22 5 Q12 1 0 0 Z" fill="#17304a" />
        <path d="M0 0 L-3 -19 Q2 -14 6 -15 L9 -23 Q12 -15 17 -16 L23 -19 Q22 -10 27 -8 L31 -9 Q24 -3 22 5 Q12 1 0 0 Z" fill="url(#bk-leather)" class="bs-ov" opacity=".4" />
        <path d="M0 0 L-3 -19 M0 0 L9 -23 M0 0 L23 -19 M0 0 L31 -9" stroke="#c8d4e0" stroke-width="1" stroke-linecap="round" opacity=".85" />
        <circle r="2.2" fill="#c8d4e0" />
      </g>
    </g>
    <!-- Белатор: золотая корона на книге; при наведении — сияние -->
    <g v-else-if="fx === 'belator'" :transform="T(g.W / 2, 0)">
      <g class="fx-hshow">
        <g class="fx-spin slow" style="transform-origin: 0 -9px; transform-box: view-box">
          <path v-for="a in 12" :key="a" :d="`M0 -9 L${(Math.cos(a * Math.PI / 6) * 26).toFixed(1)} ${(-9 + Math.sin(a * Math.PI / 6) * 26).toFixed(1)}`" stroke="#fff1b8" stroke-width="2.4" stroke-opacity=".35" stroke-linecap="round" filter="url(#bk-soft)" />
        </g>
      </g>
      <path :d="crown" fill="#000" opacity=".4" transform="translate(.8 1)" />
      <path :d="crown" fill="url(#bk-brass)" stroke="#6a4a18" stroke-width=".6" />
      <rect :x="-crownW / 2" y="-4.5" :width="crownW" height="4.5" fill="url(#bk-brass-h)" stroke="#6a4a18" stroke-width=".5" />
      <circle cx="0" cy="-2.3" r="1.7" fill="#b3261e" /><circle :cx="-crownW * 0.3" cy="-2.3" r="1.3" fill="#2f5fb0" /><circle :cx="crownW * 0.3" cy="-2.3" r="1.3" fill="#2f5fb0" />
      <circle v-for="(x, i) in crownTips" :key="i" :cx="x" :cy="i % 2 ? -12 : -16" r="1.4" fill="#f6e3a1" />
      <path class="fx-twinkle" fill="#fff" :d="spark(0, -17, 4)" />
    </g>
    <!-- Джилл: книга вмёрзла в лёд, перед ней идёт снег -->
    <g v-else-if="fx === 'jill'">
      <path :d="ice" fill="#cfefff" opacity=".13" />
      <path :d="ice" fill="none" stroke="#eaf8ff" stroke-opacity=".55" stroke-width=".8" />
      <path :d="`M2 ${g.H * 0.2} L${g.W * 0.4} -4 M-1 ${g.H * 0.55} L${g.W * 0.7} ${g.H * 0.2} M${g.W * 0.3} ${g.H} L${g.W + 1} ${g.H * 0.6}`" stroke="#fff" stroke-opacity=".18" stroke-width="1.2" />
      <g v-if="!reduce" fill="#f2fbff">
        <circle v-for="(f, i) in flakes" :key="i" :r="f.r" opacity=".9">
          <animateMotion :path="`M${f.x} -8 q4 ${g.H / 4} 0 ${g.H / 2} t0 ${g.H / 2 + 12}`" :dur="f.d + 's'" :begin="f.b + 's'" repeatCount="indefinite" />
        </circle>
      </g>
      <g class="fx-hshow" filter="url(#bk-soft)">
        <ellipse v-for="i in 3" :key="i" :cx="g.W / 2 + (i - 2) * 9" cy="-4" rx="7" ry="4" fill="#e8f7ff" class="fx-steam slow" :style="{ animationDelay: (i - 1) * 0.6 + 's' }" />
      </g>
    </g>
    <!-- Орвилл: стетоскоп на книге; при наведении головка стучит в такт сердцу -->
    <g v-else-if="fx === 'orvill'">
      <path :d="`M${g.W * 0.32} -12 Q${g.W * 0.3} -2 ${g.W / 2} 3 M${g.W * 0.68} -12 Q${g.W * 0.7} -2 ${g.W / 2} 3`" fill="none" stroke="#9aa0a8" stroke-width="1.4" />
      <circle :cx="g.W * 0.32" cy="-12.5" r="1.6" fill="#2a2a2a" /><circle :cx="g.W * 0.68" cy="-12.5" r="1.6" fill="#2a2a2a" />
      <path :d="tube" fill="none" stroke="#000" stroke-opacity=".4" stroke-width="3.2" transform="translate(.6 .9)" />
      <path :d="tube" fill="none" stroke="#2a2a2c" stroke-width="2.6" stroke-linecap="round" />
      <path :d="tube" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width=".6" transform="translate(-.6 -.4)" />
      <g :transform="T(g.W - 11, g.H - 15)"><g class="fx-hbeat">
        <circle r="6.4" fill="url(#bk-iron)" /><circle r="4.4" fill="#d8dde2" /><circle r="4.4" fill="url(#bk-ball)" />
      </g></g>
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
const T = (x, y) => `translate(${Number(x).toFixed(2)} ${Number(y).toFixed(2)})`
const S = s => `scale(${(s / 24).toFixed(3)}) translate(-12 -12)`
const spark = (x, y, r) => `M${x} ${y - r} L${x + r * 0.22} ${y - r * 0.22} L${x + r} ${y} L${x + r * 0.22} ${y + r * 0.22} L${x} ${y + r} L${x - r * 0.22} ${y + r * 0.22} L${x - r} ${y} L${x - r * 0.22} ${y - r * 0.22} Z`
const glow = computed(() => props.look.glow || '#ff3df0')

// Хироши: обмотка рукояти до вставки с названием
const wrapEnd = computed(() => Math.max(20, props.g.t0 - 14))
const ito = computed(() => {
  const W = props.g.W, e = wrapEnd.value
  let d = ''
  for (let y = 5; y < e - 1; y += 8) d += `M0 ${y} L${W} ${Math.min(e, y + 8)} M${W} ${y} L0 ${Math.min(e, y + 8)} `
  return d
})
// Лёва: патроны по краям ремня, пряжка посередине
const rounds = computed(() => { const W = props.g.W; return [5.5, 11, W - 11, W - 5.5] })
// красная точка: бродит по корешку и замирает в перекрестье
const laserPath = computed(() => {
  const { W, H, emY } = props.g
  return `M${W * 0.3} ${H * 0.7} L${W * 0.7} ${H * 0.45} L${W * 0.25} ${H * 0.3} L${W * 0.65} ${emY + 10} L${W / 2} ${emY}`
})
// Орвилл: линия пульса через крест; трубка стетоскопа — через верх и по правому краю
const ecg = computed(() => {
  const { W, emY } = props.g, m = W / 2
  return `M2 ${emY} H${m - 9} l2 -2 l2 2 h1.5 l2 6 l3 -16 l2.6 13 l1.6 -3 H${W - 2}`
})
const tube = computed(() => { const { W, H } = props.g; return `M${W / 2} 3 C${W - 2} 4 ${W - 1} 30 ${W - 3} ${H * 0.45} S${W - 6} ${H - 34} ${W - 11} ${H - 21}` })
// Джилл: капля с самой длинной сосульки, трещины во льду, ледяная глыба вокруг книги
const drip = computed(() => {
  const ic = props.g.icicles || []
  if (!ic.length) return null
  const best = ic.reduce((a, b) => (b.ty - b.y0 > a.ty - a.y0 ? b : a))
  return { x: best.tx, y: best.ty }
})
const cracks = computed(() => { const { W, H } = props.g; return `M0 ${H * 0.3} L${W * 0.25} ${H * 0.34} L${W * 0.3} ${H * 0.42} M${W * 0.25} ${H * 0.34} L${W * 0.42} ${H * 0.3} M${W} ${H * 0.62} L${W * 0.7} ${H * 0.66} L${W * 0.64} ${H * 0.75} M${W * 0.7} ${H * 0.66} L${W * 0.56} ${H * 0.62} M${W * 0.1} ${H * 0.86} L${W * 0.3} ${H * 0.9}` })
const ice = computed(() => { const { W, H } = props.g; return `M-1.5 ${H} V3 L${W * 0.18} -5 L${W * 0.44} -2.5 L${W * 0.62} -7 L${W * 0.86} -3.5 L${W + 1.5} -6 V${H} Z` })
const flakes = computed(() => {
  const W = props.g.W
  return [0.15, 0.42, 0.68, 0.88, 0.3, 0.75].map((k, i) => ({ x: (W * k).toFixed(1), r: 0.8 + (i % 3) * 0.45, d: 6 + (i % 4) * 1.3, b: i * 1.4 }))
})
// Белатор: корона по ширине книги
const crownW = computed(() => Math.min(46, props.g.W * 0.66))
const crownTips = computed(() => { const w = crownW.value; return [-w / 2, -w / 4, 0, w / 4, w / 2] })
const crown = computed(() => {
  const w = crownW.value, h = w / 2
  return `M${-h} -4 L${-h} -16 L${-w / 4} -9 L${-w / 8} -12 L0 -16 L${w / 8} -12 L${w / 4} -9 L${h} -16 L${h} -4 Z`
})
// Азиэль: звёзды в пустоте
const voidStars = Array.from({ length: 14 }, (_, i) => ({ x: ((i * 37) % 30) - 15, y: ((i * 53) % 30) - 15, r: 0.35 + (i % 3) * 0.3, o: 0.5 + (i % 4) * 0.15 }))
</script>

<style>
/* анимации книг героев. Обычные идут всегда; «fx-h…» — только пока на книгу навели (или выбрали её) —
   они стоят на паузе, поэтому при наведении ничего не прыгает. Под «меньше анимаций» всё стоит */
.fx-spin { transform-box: fill-box; transform-origin: center; animation: fx-spin 14s linear infinite; }
.fx-spin.rev { animation-duration: 7.3s; animation-direction: reverse; }
.fx-spin.slow { animation-duration: 28s; }
.fx-hspin { transform-box: fill-box; transform-origin: center; animation: fx-spin 1.6s linear infinite paused; }
.fx-hspin.rev { animation-direction: reverse; animation-duration: .85s; }
.fx-twinkle { opacity: 0; transform-box: fill-box; transform-origin: center; animation: fx-twinkle 5.1s ease-in-out infinite; }
.fx-ember { opacity: .15; animation: fx-ember 3.2s ease-in-out infinite; }
.fx-look { animation: fx-look 7s ease-in-out infinite; }
.fx-heye { transform-box: fill-box; transform-origin: center; transition: transform .35s cubic-bezier(.2, .9, .3, 1.3); }
.fx-pupil { transform-box: fill-box; transform-origin: center; transition: transform .35s ease-out; }
.fx-blink { transform-box: fill-box; transform-origin: 50% 0; transform: scaleY(0); animation: fx-blink 5.3s ease-in-out infinite; }
.fx-gem { opacity: .25; transform-box: fill-box; transform-origin: center; animation: fx-gem 3.6s ease-in-out infinite; }
.fx-zero { transform-box: fill-box; transform-origin: center; animation: fx-zero 10s ease-in-out infinite; }
.fx-hzoom { transform-box: fill-box; transform-origin: center; transition: transform .5s cubic-bezier(.2, .9, .3, 1); }
.fx-beat { transform-box: fill-box; transform-origin: center; animation: fx-beat 1.6s ease-out infinite; }
.fx-hbeat { transform-box: fill-box; transform-origin: center; animation: fx-beat .8s ease-out infinite paused; }
.fx-ecg { stroke-dasharray: 30 70; stroke-dashoffset: 100; animation: fx-ecg 1.6s linear infinite; }
.fx-rune { opacity: 0; animation: fx-rune 6.6s ease-in-out infinite; }
.fx-runes { transition: opacity 1.4s; }
.fx-drift { animation: fx-drift 16s ease-in-out infinite alternate; }
.fx-led { animation: fx-led 2.4s steps(1) infinite; }
.fx-visor { animation: fx-visor 3s ease-in-out infinite; }
.fx-scan { animation: fx-scan 1.8s ease-in-out infinite paused; }
.fx-steam { opacity: 0; transform-box: fill-box; transform-origin: center; animation: fx-steam 3.75s ease-out infinite; }
.fx-steam.fast { animation-duration: 1.1s; }
.fx-steam.slow { animation-duration: 2.6s; }
.fx-sway { animation: fx-sway 4.4s ease-in-out infinite; }
.fx-hsway { animation: fx-sway .9s ease-in-out infinite paused; }
.fx-hflap { transform-box: view-box; transform-origin: 0 0; animation: fx-flap .55s ease-in-out infinite paused; }
.fx-needle { animation: fx-needle 3.4s ease-in-out infinite; }
.fx-hblade { animation: fx-blade 1.4s ease-in-out infinite paused; }
.fx-hpuff { opacity: 0; }
.fx-hshow { opacity: 0; transition: opacity .45s ease-out; }
.fx-hdraw { stroke-dasharray: 100; stroke-dashoffset: 100; opacity: 0; transition: stroke-dashoffset 1.6s ease-out, opacity .4s; }

/* книга «просыпается»: на неё навели мышь, выбрали с клавиатуры или открыта её карточка */
:is(.bc-book:hover, .bc-book.on, .bc-book:focus-visible) :is(.fx-hspin, .fx-hbeat, .fx-hsway, .fx-hflap, .fx-hblade, .fx-scan) { animation-play-state: running; }
:is(.bc-book:hover, .bc-book.on, .bc-book:focus-visible) .fx-hshow { opacity: var(--o, 1); }
:is(.bc-book:hover, .bc-book.on, .bc-book:focus-visible) .fx-hdraw { stroke-dashoffset: 0; opacity: .45; }
:is(.bc-book:hover, .bc-book.on, .bc-book:focus-visible) .fx-hpuff { animation: fx-steam 1s ease-out infinite; }
:is(.bc-book:hover, .bc-book.on, .bc-book:focus-visible) .fx-needle { animation: fx-needle-hot .5s ease-in-out infinite; }
:is(.bc-book:hover, .bc-book.on, .bc-book:focus-visible) .fx-heye { transform: scale(1.3); }
:is(.bc-book:hover, .bc-book.on, .bc-book:focus-visible) .fx-pupil { transform: scaleX(2.6) scaleY(.85); }
:is(.bc-book:hover, .bc-book.on, .bc-book:focus-visible) .fx-hzoom { transform: scale(1.4); }
:is(.bc-book:hover, .bc-book.on, .bc-book:focus-visible) .fx-ember { animation-duration: .9s; }
:is(.bc-book:hover, .bc-book.on, .bc-book:focus-visible) .fx-runes { opacity: 0; transition: opacity .8s; }
:is(.bc-book:hover, .bc-book.on, .bc-book:focus-visible) .fx-visor { animation-duration: .6s; }
:is(.bc-book:hover, .bc-book.on, .bc-book:focus-visible) .bs.fx-tsuruya .bs-chain { animation: fx-rattle .28s linear infinite; }
:is(.bc-book:hover, .bc-book.on, .bc-book:focus-visible) .bs.fx-jill .bs-ferns { opacity: 1; stroke-width: .8; }
.bs.fx-jill .bs-ferns { transition: opacity .6s, stroke-width .6s; }

@keyframes fx-spin { to { transform: rotate(360deg); } }
@keyframes fx-twinkle { 0%, 62%, 100% { opacity: 0; transform: scale(.3) rotate(0); } 74% { opacity: .95; transform: scale(1) rotate(25deg); } 86% { opacity: 0; transform: scale(.4) rotate(45deg); } }
@keyframes fx-ember { 0%, 100% { opacity: .12; } 50% { opacity: .85; } }
@keyframes fx-look { 0%, 12% { transform: translateX(0); } 22%, 38% { transform: translateX(-2.6px); } 48%, 62% { transform: translateX(2.6px); } 72%, 100% { transform: translateX(0); } }
@keyframes fx-blink { 0%, 86%, 100% { transform: scaleY(0); } 90%, 92% { transform: scaleY(1); } }
@keyframes fx-gem { 0%, 100% { opacity: .2; transform: scale(.85); } 50% { opacity: .75; transform: scale(1.1); } }
@keyframes fx-zero { 0%, 100% { transform: rotate(0); } 20% { transform: rotate(-8deg); } 45% { transform: rotate(6deg); } 70% { transform: rotate(0); } }
@keyframes fx-beat { 0% { transform: scale(1); } 10% { transform: scale(1.16); } 20% { transform: scale(1); } 32% { transform: scale(1.1); } 44%, 100% { transform: scale(1); } }
@keyframes fx-ecg { to { stroke-dashoffset: 0; } }
@keyframes fx-rune { 0%, 100% { opacity: 0; } 30%, 50% { opacity: 1; } }
@keyframes fx-drift { from { transform: translate(-3px, 2px); } to { transform: translate(3px, -2px); } }
@keyframes fx-led { 0%, 70% { opacity: 1; } 71%, 100% { opacity: .15; } }
@keyframes fx-visor { 0%, 100% { opacity: .55; } 50% { opacity: 1; } }
@keyframes fx-scan { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(190px); } }
@keyframes fx-steam { 0% { opacity: 0; transform: translate(0, 0) scale(.4); } 18% { opacity: .55; } 100% { opacity: 0; transform: translate(5px, -30px) scale(1.9); } }
@keyframes fx-sway { 0%, 100% { transform: rotate(-5deg); } 50% { transform: rotate(5deg); } }
@keyframes fx-flap { 0%, 100% { transform: rotate(0); } 50% { transform: rotate(-16deg) scale(1, .86); } }
@keyframes fx-needle { 0%, 100% { transform: rotate(-55deg); } 35% { transform: rotate(-20deg); } 55% { transform: rotate(-34deg); } 80% { transform: rotate(-12deg); } }
@keyframes fx-needle-hot { 0%, 100% { transform: rotate(48deg); } 50% { transform: rotate(62deg); } }
@keyframes fx-blade { 0% { transform: translateY(0); opacity: 0; } 15% { opacity: .9; } 85% { opacity: .9; } 100% { transform: translateY(140px); opacity: 0; } }
@keyframes fx-rattle { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-.8px); } 75% { transform: translateX(.8px); } }
@media (prefers-reduced-motion: reduce) {
  .fx-spin, .fx-hspin, .fx-twinkle, .fx-ember, .fx-look, .fx-blink, .fx-gem, .fx-zero, .fx-beat, .fx-hbeat, .fx-ecg, .fx-rune, .fx-drift, .fx-led, .fx-visor, .fx-scan,
  .fx-steam, .fx-sway, .fx-hsway, .fx-hflap, .fx-needle, .fx-hblade { animation: none !important; }
  .fx-rune { opacity: .7; }
  .fx-heye, .fx-pupil, .fx-hzoom, .fx-hdraw, .fx-hshow { transition: none; }
}
</style>
