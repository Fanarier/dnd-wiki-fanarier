// Бестиарий: стихия существа (цвет, свечение, частицы), опасность, подписи блоков — общее для страницы, листа и редактора
export const ELEMENTS = {
  fire: { name: 'огонь', icon: '🔥', color: '#ff8a3d', glow: 'rgba(255, 120, 40, .55)' },
  ice: { name: 'лёд', icon: '❄', color: '#8fd8ff', glow: 'rgba(120, 200, 255, .5)' },
  storm: { name: 'молния', icon: '⚡', color: '#c9a6ff', glow: 'rgba(170, 130, 255, .55)' },
  earth: { name: 'камень', icon: '⛰', color: '#d2b48c', glow: 'rgba(210, 180, 140, .45)' },
  nature: { name: 'природа', icon: '🌿', color: '#8fdc7a', glow: 'rgba(120, 220, 110, .45)' },
  shadow: { name: 'тень', icon: '☾', color: '#b3a2c9', glow: 'rgba(160, 140, 200, .4)' }
}
// стихия существа: сначала по названию («Древесный голем» — природа, хоть у него и сопротивление шоку), потом по иммунитетам
export function elementOf(b) {
  return elementIn(String(b.name || '').toLowerCase()) || elementIn([...(b.immune || []), ...(b.resist || []), b.type, b.race].join(' ').toLowerCase()) || 'shadow'
}
function elementIn(t) {
  if (/магм|лав|огн|огон|пламен|жар|пепел/.test(t)) return 'fire'
  if (/лед|лёд|холод|мороз|снеж|ледян/.test(t)) return 'ice'
  if (/электр|молни|шок|гроз|разряд/.test(t)) return 'storm'
  if (/камен|скал|земл|валун|гор/.test(t)) return 'earth'
  if (/древес|дерев|лиан|лес|растен|корн|природ/.test(t)) return 'nature'
  return ''
}
export const DANGERS = [
  { v: 'Низкая', color: '#7ed07a' }, { v: 'Средняя', color: '#f0b54f' }, { v: 'Высокая', color: '#ff8a5b' },
  { v: 'Очень высокая', color: '#ff5b5b' }, { v: 'Смертельная', color: '#d0304a' }
]
export const dangerColor = d => DANGERS.find(x => x.v.toLowerCase() === String(d || '').toLowerCase())?.color || '#a8936c'
// блоки навыков: какой вид навыка в общем справочнике НПС
export const SKILL_BLOCKS = [
  { key: 'passive', title: 'Пассивные навыки', icon: '◈', kind: 'passive' },
  { key: 'attacks', title: 'Атаки', icon: '⚔', kind: 'active' },
  { key: 'active', title: 'Активные навыки', icon: '✦', kind: 'active' },
  { key: 'legendary', title: 'Легендарные навыки', icon: '👑', kind: 'active', cls: 'legend' },
  { key: 'mythic', title: 'Мифические навыки', icon: '✺', kind: 'active', cls: 'myth' }
]
export const DEF_BLOCKS = [
  { key: 'resist', title: 'Сопротивления', icon: '🛡', cls: 'res' }, { key: 'vuln', title: 'Уязвимости', icon: '💥', cls: 'vul' },
  { key: 'immune', title: 'Иммунитеты', icon: '✧', cls: 'imm' }, { key: 'prof', title: 'Владения', icon: '🎓', cls: 'pro' },
  { key: 'saves', title: 'Спасброски', icon: '🎲', cls: 'sav' }
]
