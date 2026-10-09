// Лица для слотов войска: раса — её общая иконка (или цветной круг с буквой), актив — его портрет (или карточки героя), герой — обложка карточки
import { store, heroCover, heroPortraitUrl } from '../map/store.js'
import { RACES } from '../shared/settlement.js'
import { isGlyph } from './specIcons.js'

export const RACE_COLORS = { hobgoblin: '#8fbf6a', fenris: '#c9a27a', kitsune: '#f2efe6', human: '#e8b98f', highelf: '#b9d8ff', centaur: '#d9893a', neko: '#ff9ec7' }
const heroFace = id => {
  const g = heroCover(store.data.heroes?.find(h => h.id === id))
  return g ? heroPortraitUrl(g.thumb || g.file) : ''
}
// { img, letter, color, label }
export function faceOf(s, slot) {
  if (!slot) return null
  if (slot.asset) {
    const a = (s.assets || []).find(x => x.id === slot.asset)
    return { img: a?.portrait || (a?.heroId ? heroFace(a.heroId) : ''), letter: (a?.name || '?')[0], color: '#b77aff', label: a?.name || 'Актив', asset: true, dead: !!a?.dead }
  }
  if (slot.hero) {
    const h = store.data.heroes?.find(x => x.id === slot.hero)
    return { img: heroFace(slot.hero), letter: (h?.name || '?')[0], color: '#e6c27a', label: h?.name || 'Герой', asset: true }
  }
  // у расы — общая иконка, которую выбрал мастер (значок из набора рисуем на светлом фоне)
  const icon = s.raceIcons?.[slot.race] || ''
  return { img: icon, glyph: isGlyph(icon), letter: (RACES[slot.race]?.label || '?')[0], color: RACE_COLORS[slot.race] || '#c9b88f', label: RACES[slot.race]?.label || slot.race }
}
