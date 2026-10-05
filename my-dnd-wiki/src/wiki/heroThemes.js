// Свои темы карточек героев: цвета, узор фона, знак и эффекты при наведении (см. HeroFx.vue).
// Тема привязана к герою: по id стартовой карточки, а если карточку пересоздали — по имени.
import { mdiCog, mdiPentagram, mdiSnowflake, mdiWhiteBalanceSunny, mdiYinYang, mdiCompassRose, mdiMoonWaningCrescent, mdiCrosshairsGps } from '@mdi/js'

const svg = s => `url("data:image/svg+xml,${encodeURIComponent(s)}")`

export const HERO_THEMES = {
  steam: {
    label: 'Пар', icon: mdiCog,
    c: { a: '#d9a25a', b: '#a9bfcc', l: '#f6e3bf', bg1: '#2a2016', bg2: '#120e0a', f: '#8a6233' },
    // шестерёнки и труба
    pattern: svg(`<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' fill='none' stroke='#d9a25a' stroke-opacity='.09'>
      <circle cx='30' cy='34' r='15' stroke-width='6' stroke-dasharray='4 3.85'/><circle cx='30' cy='34' r='8' stroke-width='2'/>
      <circle cx='88' cy='86' r='10' stroke-width='5' stroke-dasharray='3 2.24'/><circle cx='88' cy='86' r='4' stroke-width='2'/>
      <path d='M0 70h44v50M120 18H80v-18' stroke-width='3'/><circle cx='44' cy='70' r='2.5' fill='#d9a25a' fill-opacity='.12'/></svg>`)
  },
  demon: {
    label: 'Тёмная магия', icon: mdiPentagram,
    c: { a: '#e0335a', b: '#9b4dff', l: '#f7c9d8', bg1: '#1e0d17', bg2: '#0a0508', f: '#6a1f3c' },
    // трещины и печати
    pattern: svg(`<svg xmlns='http://www.w3.org/2000/svg' width='150' height='150' fill='none' stroke='#e0335a' stroke-opacity='.1'>
      <circle cx='38' cy='40' r='18'/><path d='M38 22l10.6 32.6-27.7-20.2h34.2L27.4 54.6z'/>
      <path d='M90 0l-6 22 10 14-8 26M150 96l-26 6-10 18-22 8M0 118l18-4 12 10' stroke-width='1.4'/>
      <circle cx='118' cy='54' r='2' fill='#9b4dff' fill-opacity='.25'/></svg>`)
  },
  frost: {
    label: 'Вода и лёд', icon: mdiSnowflake,
    c: { a: '#7fd6ff', b: '#d6f3ff', l: '#e6f8ff', bg1: '#0f1e2b', bg2: '#060d15', f: '#3d7396' },
    // кристаллы инея
    pattern: svg(`<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96' fill='none' stroke='#bfeaff' stroke-opacity='.1' stroke-linecap='round'>
      <g transform='translate(28 30)'><path d='M0-14V14M-12-7 12 7M-12 7 12-7M0-9l-3-3m3 3 3-3M0 9l-3 3m3-3 3 3'/></g>
      <g transform='translate(74 72) scale(.6)'><path d='M0-14V14M-12-7 12 7M-12 7 12-7M0-9l-3-3m3 3 3-3M0 9l-3 3m3-3 3 3'/></g>
      <path d='M60 10l6 6M10 76l5-3' /></svg>`)
  },
  sun: {
    label: 'Солнце', icon: mdiWhiteBalanceSunny,
    c: { a: '#ffc94a', b: '#ff8a2a', l: '#fff1c7', bg1: '#2c1e0b', bg2: '#140d05', f: '#b07b28' },
    // лучи из-за верхнего края
    pattern: 'repeating-conic-gradient(from 0deg at 50% -6%, rgba(255, 201, 74, .075) 0 3.5deg, transparent 3.5deg 11deg)'
  },
  chi: {
    label: 'Багряная ци', icon: mdiYinYang,
    c: { a: '#ec2f42', b: '#ff8a4c', l: '#ffd7cf', bg1: '#25100f', bg2: '#100606', f: '#7d2024' },
    // сэйгайха — волны
    pattern: svg(`<svg xmlns='http://www.w3.org/2000/svg' width='48' height='24' fill='none' stroke='#ec2f42' stroke-opacity='.11'>
      <g id='w'><circle cx='24' cy='24' r='22'/><circle cx='24' cy='24' r='16'/><circle cx='24' cy='24' r='10'/></g>
      <use href='#w' x='-24' y='-12'/><use href='#w' x='24' y='-12'/></svg>`)
  },
  maps: {
    label: 'Магические карты', icon: mdiCompassRose,
    c: { a: '#4fd8c6', b: '#e8d29a', l: '#dcf8f2', bg1: '#11211f', bg2: '#070f0e', f: '#2e6c64' },
    // горизонтали, как на топографической карте
    pattern: svg(`<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220' fill='none' stroke='#4fd8c6' stroke-opacity='.09'>
      <path d='M60 40c40-10 70 20 60 50s-60 40-80 10S30 46 60 40z'/><path d='M64 56c24-6 40 12 34 30s-36 22-48 6-4-32 14-36z'/>
      <path d='M70 70c10-2 16 6 13 12s-14 8-18 2 0-12 5-14z'/>
      <path d='M150 130c34 4 56 30 44 58s-58 30-78 6-4-68 34-64z'/><path d='M152 150c20 2 32 18 25 34s-34 16-45 3-2-39 20-37z'/>
      <path d='M0 200c30-20 50 10 80-6M140 0c-6 24 18 36 10 60M220 96c-30 0-40 20-70 14'/></svg>`)
  },
  dragon: {
    label: 'Фиолетовый дракон', icon: mdiMoonWaningCrescent,
    c: { a: '#a970ff', b: '#e3b8ff', l: '#efe2ff', bg1: '#1b1229', bg2: '#0a0712', f: '#5d3f92' },
    // чешуя
    pattern: svg(`<svg xmlns='http://www.w3.org/2000/svg' width='28' height='22' fill='none' stroke='#a970ff' stroke-opacity='.13'>
      <path d='M0 11a14 11 0 0 0 28 0M-14 0a14 11 0 0 0 28 0M14 0a14 11 0 0 0 28 0M-14 22a14 11 0 0 0 28 0M14 22a14 11 0 0 0 28 0'/></svg>`)
  },
  marksman: {
    label: 'Стрелок', icon: mdiCrosshairsGps,
    c: { a: '#ff4b3a', b: '#c9ced6', l: '#f3f4f6', bg1: '#1d1d20', bg2: '#0b0b0d', f: '#5b6068' },
    // мишень в углу и деления прицела
    pattern: 'repeating-radial-gradient(circle at 88% 92%, transparent 0 22px, rgba(255, 75, 58, .1) 22px 23.5px), repeating-linear-gradient(90deg, rgba(201, 206, 214, .05) 0 1px, transparent 1px 18px)'
  }
}

const BY_ID = { hs01: 'steam', hs02: 'sun', hs03: 'frost', hs06: 'marksman', hs07: 'demon', hs10: 'dragon', hs11: 'chi', hs12: 'maps' }
const BY_NAME = { энди: 'steam', белатор: 'sun', джилл: 'frost', лева: 'marksman', цуруя: 'demon', элиас: 'dragon', хироши: 'chi', касуми: 'maps' }

export function heroThemeKey(h) {
  if (!h || h.kind !== 'character') return null
  if (BY_ID[h.id]) return BY_ID[h.id]
  const first = (h.name || '').trim().split(/\s+/)[0].toLowerCase().replace(/ё/g, 'е')
  return BY_NAME[first] || null
}

// CSS-переменные темы для корня карточки или просмотрщика
export function themeVars(key) {
  const t = HERO_THEMES[key]
  if (!t) return {}
  const { a, b, l, bg1, bg2, f } = t.c
  return { '--ta': a, '--tb': b, '--tl': l, '--tbg1': bg1, '--tbg2': bg2, '--tf': f, '--tpat': t.pattern }
}
