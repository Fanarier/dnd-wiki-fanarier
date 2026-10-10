// НПС: группы, шкалы уровней, поля по умолчанию для каждой группы и разбор описаний на эффекты.

export const NPC_GROUPS = [
  { key: 'sidekick', label: 'Сайд-кики', one: 'Сайд-кик', icon: '⚔' },
  { key: 'personal', label: 'Личные сайд-кики', one: 'Личный сайд-кик', icon: '✦' },
  { key: 'companion', label: 'Компаньоны', one: 'Компаньон', icon: '🐾' },
  { key: 'important', label: 'Важные НПС', one: 'Важный НПС', icon: '♛' },
  { key: 'aspect', label: 'Аспекты', one: 'Аспект', icon: '🐉' }
]
export const groupOf = key => NPC_GROUPS.find(g => g.key === key) || NPC_GROUPS[0]

// специализации и слабости — только словами; число нужно лишь для цвета
export const SPEC_LEVELS = [
  { name: 'Новичок', v: 1, color: '#b9d8a8' },
  { name: 'Умелец', v: 2, color: '#9be07a' },
  { name: 'Эксперт', v: 3, color: '#6fd6c8' },
  { name: 'Мастер', v: 4, color: '#8fc7ff' },
  { name: 'Легенда', v: 5, color: '#ffd166' }
]
export const WEAK_LEVELS = [
  { name: 'Плохо', v: -1, color: '#ffb36b' },
  { name: 'Некомпетентный', v: -2, color: '#ff8a6b' },
  { name: 'Ужасно', v: -4, color: '#ff5a5a' }
]
export const levelColor = (list, name) => list.find(l => l.name === name)?.color || '#a8936c'

export const STATS = ['Сила', 'Ловкость', 'Телосложение', 'Интеллект', 'Мудрость', 'Харизма']
export const COMBAT = [
  { k: 'Хиты', icon: '❤' }, { k: 'Броня', icon: '🛡' }, { k: 'Уклонение', icon: '💨' },
  { k: 'БМ', icon: '✚' }, { k: 'Скорость', icon: '➶' }, { k: 'Инициатива', icon: '⚡' }
]
// модификатор как в листе: (значение − 10) / 2 вниз
export const mod = v => (v === '' || v == null || Number.isNaN(+v) ? null : Math.floor((+v - 10) / 2))
export const signed = n => (n == null ? '' : n > 0 ? '+' + n : String(n))

// поля «Основной информации» и списки по умолчанию — для нового НПС и подсказок в редакторе
export const INFO_KEYS = {
  sidekick: ['Раса', 'Пол', 'Возраст', 'Принадлежность', 'Профессия', 'Класс', 'Уровень', 'Мировоззрение', 'Условия найма', 'Потенциал'],
  personal: ['Раса', 'Пол', 'Возраст', 'Принадлежность', 'Профессия', 'Класс', 'Уровень', 'Мировоззрение', 'Условия найма', 'Потенциал'],
  companion: ['Раса', 'Вид', 'Пол', 'Возраст', 'Размер', 'Редкость', 'Мировоззрение', 'Хозяин', 'Привязанность'],
  important: ['Раса', 'Пол', 'Возраст', 'Принадлежность', 'ПО', 'Класс', 'Уровень', 'Мировоззрение', 'Размер'],
  aspect: ['Драконье имя', 'Стихия', 'Возраст', 'Размер', 'Гуманоидный размер', 'Специализация формы гуманоида', 'Мировоззрение', 'Уровень']
}
export const LIST_TITLES = {
  sidekick: ['Занятия и хобби'], personal: ['Занятия и хобби'],
  companion: ['Снаряжение', 'Инвентарь', 'Любимые вещи'],
  important: ['Профессии', 'Квесты', 'Занятия и хобби'], aspect: []
}
export const SPELLS_TITLE = { companion: 'Дрессировки' }
export const hasSpecs = g => g === 'sidekick' || g === 'personal'

export const infoOf = (n, k) => n?.info?.find(x => x.k === k)?.v || ''
export const unknown = v => !v || String(v).trim() === '???'
// короткая подпись под именем на карточке
export function npcSubtitle(n) {
  if (n.group === 'companion') return [infoOf(n, 'Вид') || infoOf(n, 'Раса'), infoOf(n, 'Редкость')].filter(Boolean).join(' · ')
  if (n.group === 'aspect') return [infoOf(n, 'Драконье имя'), infoOf(n, 'Стихия')].filter(Boolean).join(' · ')
  return [infoOf(n, 'Раса'), infoOf(n, 'Класс')].filter(Boolean).join(' · ')
}
export const npcLevel = n => infoOf(n, 'Уровень')

// навык из справочника по виду и названию
export const skillKey = (kind, name) => `${kind}:${String(name || '').trim().toLowerCase()}`
export const skillIndex = skills => new Map((skills || []).map(s => [skillKey(s.kind, s.name), s]))

// описание → кусочки: обычный текст и «(…)»; если в скобках эффект из справочника — он подсвечивается и даёт подсказку
export function splitFx(text, effects) {
  const byName = new Map()
  for (const e of effects || []) for (const n of [e.name, ...(e.aliases || [])]) byName.set(n.trim().toLowerCase(), e)
  const out = []
  let last = 0
  for (const m of String(text || '').matchAll(/\(([^()]{1,60})\)/g)) {
    if (m.index > last) out.push({ s: text.slice(last, m.index) })
    out.push({ s: m[0], inner: m[1], fx: byName.get(m[1].trim().toLowerCase()) || null })
    last = m.index + m[0].length
  }
  if (last < String(text || '').length) out.push({ s: text.slice(last) })
  return out
}
