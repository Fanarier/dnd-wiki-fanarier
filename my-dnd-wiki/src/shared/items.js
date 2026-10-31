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
export const blankCard = () => ({ Type1: '', Type2: '', Attune: '', Kind: '', Origin: '', Note: '', Chars: [], Comps: [], Reqs: [], Passive: [], Active: [] })
// пункт списка: T — текст, N — примечание (в таблице — комментарий к ячейке), M — отметка. Старые пункты — строки
export const liOf = x => (typeof x === 'string' ? { T: x, N: '', M: '' } : { T: '', N: '', M: '', ...x })
// отметки пунктов (в таблице — заливка ячейки): что значат, решает мастер — сайт только показывает цвет
export const MARKS = [
  { k: '', name: 'Без отметки', color: '' },
  { k: 'green', name: 'Зелёная', color: '#5cc77a' },
  { k: 'yellow', name: 'Жёлтая', color: '#f0c040' },
  { k: 'red', name: 'Красная', color: '#e8574a' },
  { k: 'blue', name: 'Синяя', color: '#5b9cf0' },
  { k: 'gone', name: 'Зачёркнуто (утрачено)', color: '#cc3a2e' }
]
export const markOf = k => MARKS.find(m => m.k === k) || MARKS[0]
// сложность настройки — цветом, как в таблице: нет — серая, низкая — синяя, средняя — жёлтая, высокая — оранжевая, очень высокая — красная
export function attuneColor(v) {
  const t = String(v || '').toLowerCase()
  if (!t || /^нет/.test(t)) return '#9a9a9a'
  if (/очень\s*выс|максим|запред/.test(t)) return '#e8574a'
  if (/выс/.test(t)) return '#f08a3c'
  if (/сред/.test(t)) return '#f0c040'
  if (/низ|лёг|лег/.test(t)) return '#5b9cf0'
  return '#c9a24f'
}

// карточка как строка для поиска
export const cardText = c => (c ? [c.Type1, c.Type2, c.Kind, c.Origin, c.Note, ...(c.Chars || []).map(x => `${x.K} ${x.V} ${x.N || ''}`),
  ...CARD_LISTS.flatMap(l => (c[l.k] || []).map(x => { const e = liOf(x); return `${e.T} ${e.N}` }))].join(' ') : '')
// у карточки есть что показать (пустую не рисуем)
export const cardFilled = c => !!c && !!(c.Type1 || c.Type2 || c.Kind || c.Attune || c.Origin || c.Note || c.Chars?.length || c.Comps?.length || c.Reqs?.length || c.Passive?.length || c.Active?.length)

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

// какие вещи подходят слоту — по названию и типам карточки (подсказка при выборе, не запрет)
const SLOT_RE = {
  HeadItem: /шлем|шляп|капюш|корон|маск|тиар|обруч|монокл|очки|венец|диадем|голов/,
  AmuletItem: /амулет|кулон|ожерел|колье|подвес|медальон|ладанк/,
  BodyItem: /брон|доспех|нагрудн|кирас|роба|мант|плащ|хаори|кимоно|рубах|куртк|одежд|комплект|кольчуг|камзол|жилет/,
  HandsItem: /перчат|рукавиц|наруч|когт/,
  BeltItem: /пояс|ремень|кушак|разгрузк/,
  LegsItem: /сапог|ботин|понож|штан|брюк|обув|сандал|гэта|таби|вараджи|бабуш|туфл/,
  Ring1Item: /кольц|перстен/, Ring2Item: /кольц|перстен/,
  Ornament1Item: /серьг|брош|браслет|украш|заколк|подвеск|для волос/, Ornament2Item: /серьг|брош|браслет|украш|заколк|подвеск|для волос/,
  Artifact1Item: /артефакт|сфера|том\b|книг|кристалл|око\b|реликв|талисман|тотем|орб|гримуар/, Artifact2Item: /артефакт|сфера|том\b|книг|кристалл|око\b|реликв|талисман|тотем|орб|гримуар/,
  Weapon1Item: /оруж|меч|клин|кинжал|нож|топор|секир|лук\b|арбалет|пистол|ружь|винтов|копь|посох|жезл|палочк|молот|булав|катан|тачи|вакидзаси|кастет|коса\b|глеф|алебард|древков|паров|шпаг|рапир|сабл|цеп|трезуб|сюрикен|кунай/,
  ShieldItem: /щит/,
  BackpackItem: /рюкзак|сумк|мешок|котомк|ранец/,
  PackItem: /вьюк|поклаж|седельн|повозк|телег/
}
SLOT_RE.Weapon2Item = SLOT_RE.Weapon1Item
export const fitsSlot = (it, slot) => !!it && !!SLOT_RE[slot]?.test([it.Name, it.Card?.Type1, it.Card?.Type2, it.Card?.Kind].filter(Boolean).join(' ').toLowerCase())

// вещь из инвентаря → в слот снаряжения: обратное slotToInv — «Статы:» и «Эффекты:» из описания снова в свои поля,
// остальное описание и заметки — в эффекты
const isHtml = s => /<[a-z][^>]*>/i.test(s)
const asHtml = s => (isHtml(s) ? s : `<p>${s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>')}</p>`)
export function invToSlot(it) {
  let desc = String(it.Description || '')
  let stats = '', eff = ''
  desc = desc.replace(/<p><b>Статы:<\/b>\s*([\s\S]*?)<\/p>/, (_, s) => { stats = s.trim(); return '' })
  desc = desc.replace(/<p><b>Эффекты:<\/b>\s*([\s\S]*?)<\/p>/, (_, s) => { eff = s.trim(); return '' })
  const parts = [eff, desc.trim(), String(it.Notes || '').trim()].filter(s => s && s.replace(/<[^>]+>/g, '').trim())
  return { Name: it.Name || '', ImageFile: it.ImageFile || '', Rarity: it.Rarity || '', Stats: stats, Effects: parts.length > 1 ? parts.map(asHtml).join('') : parts[0] || '', Card: it.Card || null }
}

// вещь из слота экипировки → строка инвентаря (передача, снятие): статы и эффекты уходят в описание
export function slotToInv(s) {
  const desc = [s.Stats && `<p><b>Статы:</b> ${s.Stats}</p>`, s.Effects && `<p><b>Эффекты:</b> ${s.Effects}</p>`].filter(Boolean).join('')
  return { ImageFile: s.ImageFile || '', Name: s.Name || '', Description: desc, Rarity: s.Rarity || '', Quantity: 1, Notes: '', Equipped: false, Stored: false, Pack: false, Pocket: 0, Card: s.Card || null }
}
