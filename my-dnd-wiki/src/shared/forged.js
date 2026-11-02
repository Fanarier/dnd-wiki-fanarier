// Кованые (раса из вики): нет класса — вместо него платформа; нет снаряжения — вместо него слоты модулей платформы
// (вооружение, защита, общие) и мини-модули; рюкзак и поклажа — на странице инвентаря, вместо пояса — отсеки;
// вместо черт 4/9/18 ур. — загадочный модуль; вместо маны — энергия; черт гуманоидов нет; вместо тренировок — модернизация.
// Всё включается само, когда в листе раса «Кованый».

// платформы из вики (раса «Кованый» → «Высокотехнологичный Механоид»): мини-модулей за уровень, слоты модулей, отсеки.
// Слоты и отсеки в вики расписаны только у Сентинела — у остальных пока так же (guess)
const SENTINEL_SLOTS = { weap: 1, def: 4, gen: 4 }
export const PLATFORMS = [
  { name: 'Визор', mini: 3, slots: SENTINEL_SLOTS, bays: 3, guess: true },
  { name: 'Дестроер', mini: 1, slots: SENTINEL_SLOTS, bays: 3, guess: true },
  { name: 'Сентинел', mini: 2, slots: SENTINEL_SLOTS, bays: 3 },
  { name: 'Техно', mini: 2, slots: SENTINEL_SLOTS, bays: 3, guess: true },
  { name: 'Обсервер (Хаб)', mini: 0, slots: SENTINEL_SLOTS, bays: 3, guess: true }
]
export const MAX_MINI = 120 // если сложить все бонусы — больше не бывает
export const MAX_BAYS = 16

// слоты модулей: ключи в листе, сколько каких показывать — по платформе
export const MODULE_KINDS = [
  { k: 'weap', key: 'ModWeap', name: 'Вооружение', icon: '⚔', max: 6 },
  { k: 'def', key: 'ModDef', name: 'Защита', icon: '🛡', max: 8 },
  { k: 'gen', key: 'ModGen', name: 'Общий', icon: '⚙', max: 8 }
]
export const MODULE_SLOTS = MODULE_KINDS.flatMap(t => Array.from({ length: t.max }, (_, i) => ({ key: `${t.key}${i + 1}`, name: `${t.name} ${i + 1}`, icon: t.icon, kind: t.k })))
// у кованого остаются только рюкзак и поклажа (на странице инвентаря)
export const FORGED_KEEP = ['BackpackItem', 'PackItem']

const norm = s => String(s || '').toLowerCase().replace(/ё/g, 'е').trim()
export const isForged = d => /^кован/.test(norm(d?.RulesRace)) || /^кован/.test(norm(d?.Race))
// платформа — из поля «Класс» (у кованых оно «Платформа»): «Сентинел», «Обсервер» — по началу слова
export const platformOf = d => {
  const c = norm(d?.Class)
  return c ? PLATFORMS.find(p => c.startsWith(norm(p.name).split(' ')[0])) || null : null
}
// слоты модулей этого листа: по платформе (без платформы — как у Сентинела)
export function moduleSlotsOf(d) {
  const n = (platformOf(d) || PLATFORMS[2]).slots
  return MODULE_KINDS.map(t => ({ ...t, slots: MODULE_SLOTS.filter(s => s.kind === t.k).slice(0, n[t.k]) }))
}
// сколько мини-модулей даёт платформа к этому уровню (без особых бонусов)
export const miniLimitOf = d => {
  const p = platformOf(d)
  return p ? Math.min(MAX_MINI, p.mini * Math.max(1, Number(d?.Level) || 1)) : 0
}
// отсеки (быстрые слоты, как карманы пояса): базовые платформы + дополнительные (мини-модули, модуль «Отсеки»)
export const baysOf = d => Math.min(MAX_BAYS, (platformOf(d) || PLATFORMS[2]).bays + Math.max(0, Number(d?.ExtraBays) || 0))
export const ENERGY_COLOR = '#2fd6c3'
