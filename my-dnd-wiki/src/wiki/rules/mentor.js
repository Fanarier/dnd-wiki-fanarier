// наставник в записи журнала: подсказки (НПС и герои) и ссылка, если имя совпало
import { store, npcState } from '../../map/store.js'

const low = s => String(s || '').toLowerCase().replace(/ё/g, 'е').trim()
export const mentorHints = () => [
  ...npcState.npcs.filter(n => n.name).map(n => ({ name: n.name, sub: 'НПС' })),
  ...(store.data.heroes || []).filter(h => h.name).map(h => ({ name: h.name, sub: 'герой' }))
]
// полное имя или первое слово имени («Ирвин» → «Ирвин Тёмный»)
export function mentorLink(name) {
  const q = low(name)
  if (!q) return null
  const hit = x => low(x.name) === q || low(x.name).split(/\s+/)[0] === q
  const npc = npcState.npcs.find(hit)
  if (npc) return { to: { path: '/wiki', query: { npc: npc.id } }, kind: 'НПС', name: npc.name }
  const h = (store.data.heroes || []).find(hit)
  if (h) return { to: { path: '/wiki', query: { hero: h.id } }, kind: 'герой', name: h.name }
  return null
}
