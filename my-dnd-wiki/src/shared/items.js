// Предметы: карточка уникального предмета (общая для листа и вики «Предметы»), карманы пояса, ячейки рюкзака и вьюка.
// Сколько карманов и ячеек — пишется у самой вещи: строка характеристики «Карманы: 4» / «Ячейки: 12»
// или просто в тексте статов («Карманы - 4 шт», «Слоты 0/4» — берётся число после косой черты).

// поля карточки: строки и списки (в редакторе список — «по строке на пункт»)
export const CARD_TEXT = [
  { k: 'Type1', name: 'Тип основной' },
  { k: 'Type2', name: 'Тип дополнительный' },
  { k: 'Kind', name: 'Вид' },
  { k: 'Attune', name: 'Сложность настройки' },
  { k: 'Origin', name: 'Происхождение', hint: 'Чья работа: Драконы, Дворфы, Кицунэ…' }
]
export const CARD_LISTS = [
  { k: 'Comps', name: 'Компоненты', icon: '🧩' },
  { k: 'Reqs', name: 'Требования', icon: '📏' },
  { k: 'Passive', name: 'Пассивные эффекты', icon: '✧' },
  { k: 'Active', name: 'Активные эффекты', icon: '⚡' }
]
export const blankCard = () => ({ Type1: '', Type2: '', Attune: '', Kind: '', Origin: '', Chars: [], Comps: [], Reqs: [], Passive: [], Active: [] })

// характеристики ↔ строки текста: «Физический урон: 3к12», без двоеточия — свойство («Одноручное»)
export const charsToText = list => (list || []).map(c => (c.V ? `${c.K}: ${c.V}` : c.K)).join('\n')
export function textToChars(t) {
  return String(t || '').split('\n').map(s => s.trim()).filter(Boolean).slice(0, 40).map(s => {
    const i = s.indexOf(':')
    return i > 0 ? { K: s.slice(0, i).trim().slice(0, 80), V: s.slice(i + 1).trim().slice(0, 200) } : { K: s.slice(0, 80), V: '' }
  })
}
export const listToText = list => (list || []).join('\n')
export const textToList = (t, max = 40, n = 300) => String(t || '').split('\n').map(s => s.trim()).filter(Boolean).slice(0, max).map(s => s.slice(0, n))

// карточка как строка для поиска
export const cardText = c => (c ? [c.Type1, c.Type2, c.Kind, c.Origin, charsToText(c.Chars), ...(c.Comps || []), ...(c.Reqs || []), ...(c.Passive || []), ...(c.Active || [])].join(' ') : '')
// у карточки есть что показать (пустую не рисуем)
export const cardFilled = c => !!c && !!(c.Type1 || c.Type2 || c.Kind || c.Attune || c.Origin || c.Chars?.length || c.Comps?.length || c.Reqs?.length || c.Passive?.length || c.Active?.length)

/* ---------- карманы и ячейки ---------- */
const plain = s => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')
const WORDS = { pockets: 'карман|слот', cells: 'ячей' }
// число из вещи: сначала строка характеристики карточки, потом текст статов и эффектов
export function capOf(item, kind) {
  if (!item) return 0
  const re = new RegExp(`^(?:${WORDS[kind]})`, 'i')
  const ch = (item.Card?.Chars || []).find(c => re.test(String(c.K).trim()))
  if (ch) {
    const m = String(ch.V).match(/(\d+)\s*$/) || String(ch.V).match(/\d+/)
    if (m) return parseInt(m[1] ?? m[0], 10)
  }
  const txt = plain([item.Stats, item.Effects, item.Description].filter(Boolean).join(' '))
  const m = txt.match(new RegExp(`(?:${WORDS[kind]})[а-яё]*\\s*[-—–:=]?\\s*(?:\\d+\\s*\\/\\s*)?(\\d+)`, 'i'))
  return m ? parseInt(m[1], 10) : 0
}
export const MAX_POCKETS = 8
export const DEFAULT_BASE_CELLS = 5

// где лежит вещь из инвентаря
export function placeOf(it) {
  if (it.Stored) return 'store'
  if (it.Pack) return 'pack'
  if (it.Pocket > 0) return 'pocket'
  if (it.Equipped) return 'worn'
  return 'bag'
}
// раскладка: сколько ячеек сумки и вьюка, сколько карманов, что где лежит. Стопка одинаковых — одна ячейка
export function carryState(d, baseCells = DEFAULT_BASE_CELLS) {
  const inv = d?.Inventory || []
  const pockets = Math.min(MAX_POCKETS, capOf(d?.BeltItem, 'pockets'))
  const backCells = capOf(d?.BackpackItem, 'cells')
  const packCells = capOf(d?.PackItem, 'cells')
  const by = { bag: [], pack: [], pocket: [], store: [], worn: [] }
  // вещь из кармана, которого больше нет (пояс сменили), лежит в сумке и занимает ячейку
  inv.forEach((it, i) => { const p = placeOf(it); (p === 'pocket' && it.Pocket > pockets ? by.bag : by[p]).push(i) })
  const cells = Math.max(0, baseCells) + backCells
  return {
    pockets, cells, baseCells: Math.max(0, baseCells), backCells, packCells,
    bag: by.bag, pack: by.pack, pocket: by.pocket, store: by.store, worn: by.worn,
    bagOver: Math.max(0, by.bag.length - cells),
    packOver: Math.max(0, by.pack.length - packCells),
    // карман по номеру → индекс вещи
    pocketAt: Object.fromEntries(by.pocket.map(i => [inv[i].Pocket, i])),
    hasPack: !!d?.PackItem || by.pack.length > 0
  }
}

// вещь из слота экипировки → строка инвентаря (передача, снятие): статы и эффекты уходят в описание
export function slotToInv(s) {
  const desc = [s.Stats && `<p><b>Статы:</b> ${s.Stats}</p>`, s.Effects && `<p><b>Эффекты:</b> ${s.Effects}</p>`].filter(Boolean).join('')
  return { ImageFile: s.ImageFile || '', Name: s.Name || '', Description: desc, Rarity: s.Rarity || '', Quantity: 1, Notes: '', Equipped: false, Stored: false, Pack: false, Pocket: 0, Card: s.Card || null }
}
