// что даёт вещь в слоте: пояс — карманы, рюкзак и поклажа — ячейки (число пишется у самой вещи)
import { sheet } from '../sheetState.js'
import { capOf, MAX_POCKETS } from '../../shared/items.js'

export function capLabel(k) {
  const it = sheet.data?.[k]
  if (!it) return null
  if (k === 'BeltItem') { const n = Math.min(MAX_POCKETS, capOf(it, 'pockets')); return { short: `👝 ${n}`, title: n ? `Карманов: ${n}` : 'Карманов нет — напиши у пояса «Карманы: N»' } }
  if (k === 'BackpackItem' || k === 'PackItem') { const n = capOf(it, 'cells'); return { short: `▦ ${n}`, title: n ? `Ячеек: ${n}` : 'Ячеек не указано — напиши «Ячейки: N»' } }
  return null
}
