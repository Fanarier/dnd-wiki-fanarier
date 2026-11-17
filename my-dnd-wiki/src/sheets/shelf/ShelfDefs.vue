<template>
  <!-- общие фактуры и свет для корешков и вещей стеллажа (один раз на страницу) -->
  <svg class="shelf-defs" width="0" height="0" aria-hidden="true" focusable="false">
    <defs>
      <filter id="bk-grain" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="4" />
        <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1.7 0 0 0 -.62" />
        <feComposite in2="SourceGraphic" operator="in" />
      </filter>
      <filter id="bk-blur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3.2" /></filter>
      <filter id="bk-glow" x="-60%" y="-60%" width="220%" height="220%">
        <feDropShadow dx="0" dy="0" stdDeviation="2.2" flood-color="currentColor" flood-opacity=".95" />
      </filter>
      <pattern id="bk-weave" width="4" height="4" patternUnits="userSpaceOnUse">
        <path d="M0 0 H4 M0 2 H4" stroke="#000" stroke-opacity=".22" stroke-width=".8" /><path d="M1 0 V4 M3 0 V4" stroke="#fff" stroke-opacity=".07" stroke-width=".7" />
      </pattern>
      <pattern id="bk-scales" width="12" height="9" patternUnits="userSpaceOnUse">
        <path d="M0 0 Q6 9 12 0 M-6 4.5 Q0 13.5 6 4.5 M6 4.5 Q12 13.5 18 4.5" fill="none" stroke="#000" stroke-opacity=".38" stroke-width="1" />
        <path d="M0 1.2 Q6 10.2 12 1.2" fill="none" stroke="#fff" stroke-opacity=".16" stroke-width=".7" />
      </pattern>
      <pattern id="bk-brush" width="3" height="40" patternUnits="userSpaceOnUse">
        <path d="M.5 0 V40" stroke="#fff" stroke-opacity=".07" stroke-width=".6" /><path d="M2 0 V40" stroke="#000" stroke-opacity=".12" stroke-width=".6" />
      </pattern>
      <linearGradient id="bk-round" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stop-color="#000" stop-opacity=".5" /><stop offset=".2" stop-color="#000" stop-opacity=".05" />
        <stop offset=".4" stop-color="#fff" stop-opacity=".1" /><stop offset=".6" stop-color="#000" stop-opacity="0" /><stop offset="1" stop-color="#000" stop-opacity=".55" />
      </linearGradient>
      <radialGradient id="bk-candle"><stop offset="0" stop-color="#ffd08a" stop-opacity=".75" /><stop offset=".35" stop-color="#ff9a3c" stop-opacity=".3" /><stop offset="1" stop-color="#ff9a3c" stop-opacity="0" /></radialGradient>
      <radialGradient id="bk-cold"><stop offset="0" stop-color="#9fe8ff" stop-opacity=".4" /><stop offset="1" stop-color="#4fd8ff" stop-opacity="0" /></radialGradient>
      <radialGradient id="bk-ball" cx=".32" cy=".28" r=".85"><stop offset="0" stop-color="#fff" stop-opacity=".3" /><stop offset=".45" stop-color="#000" stop-opacity="0" /><stop offset="1" stop-color="#000" stop-opacity=".6" /></radialGradient>
    </defs>
  </svg>
</template>

<style scoped>
.shelf-defs { position: absolute; width: 0; height: 0; overflow: hidden; }
</style>
