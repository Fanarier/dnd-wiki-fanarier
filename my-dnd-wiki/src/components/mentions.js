// @-упоминания в тексте: кого можно упомянуть и куда ведёт ссылка. id упоминания — «вид:id» (npc:n123, hero:hs01…)
import { store, npcState } from '../map/store.js'

export function mentionLink(ref) {
  const [kind, id] = String(ref || '').split(':')
  if (!id) return null
  if (kind === 'npc') return { path: '/wiki', query: { npc: id } }
  if (kind === 'hero') return { path: '/wiki', query: { hero: id } }
  if (kind === 'city') return { path: '/', query: { focus: 'cities:' + id } }
  if (kind === 'settle') return { path: '/settlement/' + id }
  return null
}

// варианты для подсказки после «@»: НПС, герои, поселения, города
export function mentionItems(query) {
  const q = String(query || '').toLowerCase().replace(/ё/g, 'е')
  const all = [
    ...npcState.npcs.map(n => ({ id: 'npc:' + n.id, label: n.name, kind: 'НПС' })),
    ...(store.data.heroes || []).map(h => ({ id: 'hero:' + h.id, label: h.name, kind: 'герой' })),
    ...(store.data.settlements || []).map(s => ({ id: 'settle:' + s.id, label: s.name, kind: 'поселение' })),
    ...(store.data.cities || []).map(c => ({ id: 'city:' + c.id, label: c.name, kind: 'город' }))
  ]
  const hit = it => it.label.toLowerCase().replace(/ё/g, 'е')
  return all.filter(it => !q || hit(it).includes(q)).sort((a, b) => hit(a).indexOf(q) - hit(b).indexOf(q)).slice(0, 8)
}
