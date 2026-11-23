<template>
  <!-- общие фактуры и свет для корешков и вещей стеллажа (один раз на страницу).
       Фактуры — узоры (pattern): шум рисуется один раз на плитку, а не на каждую книгу -->
  <svg class="shelf-defs" width="0" height="0" aria-hidden="true" focusable="false">
    <defs>
      <!-- кожа: рельефная зернистость, освещённая сверху слева -->
      <filter id="bk-leather-f" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency=".62" numOctaves="3" seed="7" stitchTiles="stitch" result="n" />
        <feDiffuseLighting in="n" surfaceScale="1.6" lighting-color="#fff" diffuseConstant="1"><feDistantLight azimuth="235" elevation="52" /></feDiffuseLighting>
        <feComponentTransfer><feFuncR type="linear" slope="2.2" intercept="-1.25" /><feFuncG type="linear" slope="2.2" intercept="-1.25" /><feFuncB type="linear" slope="2.2" intercept="-1.25" /></feComponentTransfer>
      </filter>
      <pattern id="bk-leather" width="140" height="140" patternUnits="userSpaceOnUse"><rect width="140" height="140" filter="url(#bk-leather-f)" /></pattern>

      <!-- неровный тон: старая кожа и ткань темнеют пятнами -->
      <filter id="bk-mottle-f" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency=".018 .045" numOctaves="3" seed="3" stitchTiles="stitch" />
        <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 2.4 -1.05" />
      </filter>
      <pattern id="bk-mottle" width="260" height="260" patternUnits="userSpaceOnUse"><rect width="260" height="260" filter="url(#bk-mottle-f)" /></pattern>

      <!-- потёртости: светлые проплешины -->
      <filter id="bk-scuff-f" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency=".09 .03" numOctaves="2" seed="11" stitchTiles="stitch" />
        <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 .96  0 0 0 0 .88  0 0 0 -3.2 1.75" />
      </filter>
      <pattern id="bk-scuff" width="200" height="200" patternUnits="userSpaceOnUse"><rect width="200" height="200" filter="url(#bk-scuff-f)" /></pattern>

      <!-- ткань переплёта: мелкое плетение с рельефом -->
      <filter id="bk-cloth-f" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="1.4 .35" numOctaves="2" seed="5" stitchTiles="stitch" result="n" />
        <feDiffuseLighting in="n" surfaceScale="1.1" lighting-color="#fff"><feDistantLight azimuth="240" elevation="58" /></feDiffuseLighting>
        <feComponentTransfer><feFuncR type="linear" slope="2" intercept="-1.2" /><feFuncG type="linear" slope="2" intercept="-1.2" /><feFuncB type="linear" slope="2" intercept="-1.2" /></feComponentTransfer>
      </filter>
      <pattern id="bk-cloth" width="120" height="120" patternUnits="userSpaceOnUse">
        <rect width="120" height="120" filter="url(#bk-cloth-f)" />
      </pattern>
      <pattern id="bk-weave" width="3" height="3" patternUnits="userSpaceOnUse">
        <path d="M0 .5 H3" stroke="#000" stroke-opacity=".18" stroke-width=".7" /><path d="M1.5 0 V3" stroke="#fff" stroke-opacity=".06" stroke-width=".6" />
      </pattern>

      <!-- чешуя: каждая чешуйка светлее у основания и темнеет к краю, край ловит блик -->
      <linearGradient id="bk-scale-g" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stop-color="#000" stop-opacity=".42" /><stop offset=".45" stop-color="#fff" stop-opacity=".1" /><stop offset=".85" stop-color="#fff" stop-opacity=".04" /><stop offset="1" stop-color="#000" stop-opacity=".35" />
      </linearGradient>
      <pattern id="bk-scales" width="12" height="10" patternUnits="userSpaceOnUse">
        <path d="M0 -5 Q0 5 6 5 Q12 5 12 -5 Z M-6 0 Q-6 10 0 10 Q6 10 6 0 Z M6 0 Q6 10 12 10 Q18 10 18 0 Z" fill="url(#bk-scale-g)" />
        <path d="M0 5 Q6 5.6 12 5 M-6 10 Q0 10.6 6 10 M6 10 Q12 10.6 18 10" fill="none" stroke="#fff" stroke-opacity=".22" stroke-width=".6" />
      </pattern>

      <!-- дерево: вытянутые волокна -->
      <filter id="bk-grainw-f" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency=".008 .32" numOctaves="3" seed="2" stitchTiles="stitch" />
        <feColorMatrix type="matrix" values="0 0 0 0 .1  0 0 0 0 .05  0 0 0 0 .02  0 0 -3.4 0 2" />
      </filter>
      <pattern id="bk-woodgrain" width="240" height="60" patternUnits="userSpaceOnUse"><rect width="240" height="60" filter="url(#bk-grainw-f)" /></pattern>

      <!-- бумага: ярлыки и листы -->
      <filter id="bk-paper-f" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="21" stitchTiles="stitch" />
        <feColorMatrix type="matrix" values="0 0 0 0 .35  0 0 0 0 .25  0 0 0 0 .12  0 0 0 1.6 -.72" />
      </filter>
      <pattern id="bk-paper" width="90" height="90" patternUnits="userSpaceOnUse"><rect width="90" height="90" filter="url(#bk-paper-f)" /></pattern>

      <!-- металл: шлифовка -->
      <pattern id="bk-brush" width="3" height="40" patternUnits="userSpaceOnUse">
        <path d="M.5 0 V40" stroke="#fff" stroke-opacity=".07" stroke-width=".6" /><path d="M2 0 V40" stroke="#000" stroke-opacity=".12" stroke-width=".6" />
      </pattern>

      <!-- иней: кристаллы по краям -->
      <filter id="bk-frost-f" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
        <feTurbulence type="turbulence" baseFrequency=".16 .34" numOctaves="4" seed="9" stitchTiles="stitch" />
        <feColorMatrix type="matrix" values="0 0 0 0 .92  0 0 0 0 .98  0 0 0 0 1  12 0 0 0 -6.4" />
      </filter>
      <pattern id="bk-frost" width="120" height="120" patternUnits="userSpaceOnUse"><rect width="120" height="120" filter="url(#bk-frost-f)" /></pattern>

      <!-- тиснение: буквы и знаки чуть вдавлены в кожу -->
      <filter id="bk-tool" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx=".45" dy=".55" stdDeviation=".25" flood-color="#000" flood-opacity=".75" />
      </filter>
      <!-- слепое тиснение: вдавлено без золота -->
      <filter id="bk-deboss" x="-20%" y="-20%" width="140%" height="140%">
        <feOffset in="SourceAlpha" dx="-.6" dy="-.6" result="d" /><feFlood flood-color="#000" flood-opacity=".7" /><feComposite in2="d" operator="in" result="dk" />
        <feOffset in="SourceAlpha" dx=".6" dy=".7" result="l" /><feFlood flood-color="#fff" flood-opacity=".22" /><feComposite in2="l" operator="in" result="lt" />
        <feMerge><feMergeNode in="lt" /><feMergeNode in="dk" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>

      <filter id="bk-blur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3.2" /></filter>
      <filter id="bk-soft" x="-40%" y="-80%" width="180%" height="260%"><feGaussianBlur stdDeviation="2.4" /></filter>
      <filter id="bk-glow" x="-60%" y="-60%" width="220%" height="220%">
        <feDropShadow dx="0" dy="0" stdDeviation="2" flood-color="currentColor" flood-opacity=".9" />
      </filter>

      <!-- выпуклость корешка: тени по краям, блик чуть левее середины -->
      <linearGradient id="bk-round" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stop-color="#000" stop-opacity=".62" /><stop offset=".07" stop-color="#000" stop-opacity=".3" />
        <stop offset=".26" stop-color="#fff" stop-opacity=".05" /><stop offset=".38" stop-color="#fff" stop-opacity=".13" />
        <stop offset=".5" stop-color="#fff" stop-opacity=".03" /><stop offset=".78" stop-color="#000" stop-opacity=".18" />
        <stop offset=".94" stop-color="#000" stop-opacity=".45" /><stop offset="1" stop-color="#000" stop-opacity=".7" />
      </linearGradient>
      <!-- то же для лежащих книг -->
      <linearGradient id="bk-round-v" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stop-color="#fff" stop-opacity=".1" /><stop offset=".3" stop-color="#fff" stop-opacity=".12" />
        <stop offset=".55" stop-color="#000" stop-opacity="0" /><stop offset="1" stop-color="#000" stop-opacity=".6" />
      </linearGradient>
      <!-- рубец корешка -->
      <linearGradient id="bk-band" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stop-color="#fff" stop-opacity=".3" /><stop offset=".3" stop-color="#fff" stop-opacity=".06" />
        <stop offset=".6" stop-color="#000" stop-opacity=".12" /><stop offset="1" stop-color="#000" stop-opacity=".55" />
      </linearGradient>

      <!-- металлы -->
      <linearGradient id="bk-brass" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stop-color="#f3dc9a" /><stop offset=".35" stop-color="#c99a45" /><stop offset=".7" stop-color="#8a6326" /><stop offset="1" stop-color="#d1a855" />
      </linearGradient>
      <linearGradient id="bk-brass-h" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stop-color="#7a5420" /><stop offset=".3" stop-color="#e9c97c" /><stop offset=".55" stop-color="#b8893f" /><stop offset="1" stop-color="#5e4018" />
      </linearGradient>
      <linearGradient id="bk-iron" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stop-color="#9aa0a6" /><stop offset=".4" stop-color="#5b6066" /><stop offset=".8" stop-color="#2c3034" /><stop offset="1" stop-color="#6d7277" />
      </linearGradient>
      <linearGradient id="bk-iron-h" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0" stop-color="#c3c8cc" /><stop offset=".45" stop-color="#666b70" /><stop offset="1" stop-color="#25282b" />
      </linearGradient>
      <!-- воронёное железо: фонарь -->
      <linearGradient id="bk-blackiron" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stop-color="#6a6c6e" /><stop offset=".35" stop-color="#2e3032" /><stop offset=".8" stop-color="#151617" /><stop offset="1" stop-color="#3c3e40" />
      </linearGradient>
      <linearGradient id="bk-blackiron-h" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stop-color="#151617" /><stop offset=".3" stop-color="#5c5f62" /><stop offset=".55" stop-color="#2a2c2e" /><stop offset="1" stop-color="#0e0f10" />
      </linearGradient>
      <linearGradient id="bk-wood" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stop-color="#8a5c34" /><stop offset=".5" stop-color="#5e3b1f" /><stop offset="1" stop-color="#3a2312" />
      </linearGradient>
      <linearGradient id="bk-wood-h" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stop-color="#3a2312" /><stop offset=".3" stop-color="#8a5c34" /><stop offset=".55" stop-color="#6b4526" /><stop offset="1" stop-color="#2a180c" />
      </linearGradient>
      <linearGradient id="bk-wax" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stop-color="#c9b98f" /><stop offset=".3" stop-color="#f6eedb" /><stop offset=".55" stop-color="#efe3c4" /><stop offset="1" stop-color="#a8966c" />
      </linearGradient>
      <linearGradient id="bk-glass" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stop-color="#fff" stop-opacity=".05" /><stop offset=".14" stop-color="#fff" stop-opacity=".42" /><stop offset=".22" stop-color="#fff" stop-opacity=".06" />
        <stop offset=".8" stop-color="#fff" stop-opacity="0" /><stop offset=".9" stop-color="#fff" stop-opacity=".18" /><stop offset="1" stop-color="#fff" stop-opacity=".04" />
      </linearGradient>

      <!-- свет -->
      <radialGradient id="bk-candle"><stop offset="0" stop-color="#ffd08a" stop-opacity=".7" /><stop offset=".35" stop-color="#ff9a3c" stop-opacity=".26" /><stop offset="1" stop-color="#ff9a3c" stop-opacity="0" /></radialGradient>
      <radialGradient id="bk-flame" cx=".5" cy=".7" r=".6"><stop offset="0" stop-color="#fffbe8" /><stop offset=".35" stop-color="#ffe08a" /><stop offset=".75" stop-color="#ff9a2e" /><stop offset="1" stop-color="#e0561a" stop-opacity=".2" /></radialGradient>
      <radialGradient id="bk-cold"><stop offset="0" stop-color="#9fe8ff" stop-opacity=".38" /><stop offset="1" stop-color="#4fd8ff" stop-opacity="0" /></radialGradient>
      <radialGradient id="bk-ball" cx=".34" cy=".3" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".34" /><stop offset=".4" stop-color="#fff" stop-opacity="0" /><stop offset=".78" stop-color="#000" stop-opacity=".28" /><stop offset="1" stop-color="#000" stop-opacity=".7" /></radialGradient>
      <radialGradient id="bk-shadow"><stop offset="0" stop-color="#000" stop-opacity=".7" /><stop offset="1" stop-color="#000" stop-opacity="0" /></radialGradient>
    </defs>
  </svg>
</template>

<style scoped>
.shelf-defs { position: absolute; width: 0; height: 0; overflow: hidden; }
</style>
