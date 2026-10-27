// Кто может стоять в слотах статуса группы: герои (карточки вики, id «h…») и НПС — сайд-кики, личные сайд-кики,
// компаньоны (листы НПС, id «n…»). Всё приводится к одному виду: имя, портрет, уровень, подпись, вкладка, ссылка.
import { store, npcState, heroCover, heroPortraitUrl } from '../map/store.js'
import { HERO_KINDS } from '../shared/catalog.js'
import { groupOf } from '../shared/npc.js'

const infoOf = (n, k) => n.info?.find(x => x.k === k)?.v || ''

export function memberOf(id) {
  const h = (store.data.heroes || []).find(x => x.id === id)
  if (h) {
    const c = heroCover(h)
    return {
      id, name: h.name, level: h.level, tab: h.kind, label: HERO_KINDS[h.kind]?.label || '', sub: '',
      pic: c ? heroPortraitUrl(c.thumb || c.file) : '', stamina: h.stamina, staminaMax: h.staminaMax, to: { path: '/wiki', query: { hero: id } },
      hp: h.hp, hpMax: h.hpMax, exh: h.exh || 0 // из листа персонажа
    }
  }
  const n = npcState.npcs.find(x => x.id === id)
  if (n) {
    const a = n.arts?.[0]
    return {
      id, name: n.name, level: infoOf(n, 'Уровень'), tab: n.group, label: groupOf(n.group).one, sub: infoOf(n, 'Принадлежность') || infoOf(n, 'Профессия'),
      pic: a ? heroPortraitUrl(a.thumb || a.file) : '', to: { path: '/wiki', query: { npc: id } }
    }
  }
  // ещё не загрузились листы НПС или скрыт от игроков
  return { id, name: npcState.loaded || !id.startsWith('n') ? '???' : '…', unknown: true, tab: '' }
}
