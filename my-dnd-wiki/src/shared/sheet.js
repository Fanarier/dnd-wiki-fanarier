// Листы персонажей (перенос CharacterApp): схема данных, проверка, формулы — общие для сервера и браузера.
// Данные хранятся в формате файлов приложения (те же имена полей), чтобы старые .json импортировались как есть.
// Отличия от приложения: картинки лежат файлами на сервере (PhotoFile / ImageFile вместо base64),
// плюс поля сайта — Accent (цвет листа) и SlotLocks (замки слотов экипировки).

/* ---------- схема: из чего состоит лист ---------- */
const S = n => ({ t: 's', n }) // строка до n символов
const I = (min = -1e9, max = 1e9) => ({ t: 'i', min, max }) // целое
const B = { t: 'b' }
const IMG = { t: 'img' } // имя файла картинки на сервере
const COLOR = { t: 'color' }
const E = (...vals) => ({ t: 'e', vals }) // одно из значений
const O = f => ({ t: 'o', f })
const A = (item, max) => ({ t: 'a', item, max })
const M = (val, max) => ({ t: 'm', val, max }) // словарь ключ → значение
const N = s => ({ ...s, nullable: true })

export const ATTRS = [
  { key: 'Str', name: 'Сила', short: 'СИЛ' },
  { key: 'Dex', name: 'Ловкость', short: 'ЛОВ' },
  { key: 'Con', name: 'Телосложение', short: 'ТЕЛ' },
  { key: 'Int', name: 'Интеллект', short: 'ИНТ' },
  { key: 'Wis', name: 'Мудрость', short: 'МДР' },
  { key: 'Cha', name: 'Харизма', short: 'ХАР' }
]
export const SKILLS = [
  { key: 'Ath', name: 'Атлетика', attr: 'Str' },
  { key: 'Acr', name: 'Акробатика', attr: 'Dex' },
  { key: 'Slh', name: 'Ловкость рук', attr: 'Dex' },
  { key: 'Stl', name: 'Скрытность', attr: 'Dex' },
  { key: 'End', name: 'Выдержка/Здоровье', attr: 'Con' },
  { key: 'Ana', name: 'Анализ/Исследование', attr: 'Int' },
  { key: 'His', name: 'История/Память', attr: 'Int' },
  { key: 'Mag', name: 'Магия/Мистика', attr: 'Int' },
  { key: 'Nat', name: 'Природа/Фауна', attr: 'Int' },
  { key: 'Rel', name: 'Религия/Оккультизм', attr: 'Int' },
  { key: 'Tec', name: 'Технология/Наука', attr: 'Int' },
  { key: 'Att', name: 'Внимание', attr: 'Wis' },
  { key: 'Sur', name: 'Выживание', attr: 'Wis' },
  { key: 'Med', name: 'Медицина', attr: 'Wis' },
  { key: 'Ins', name: 'Проницательность', attr: 'Wis' },
  { key: 'Ani', name: 'Уход за животным', attr: 'Wis' },
  { key: 'Men', name: 'Наставничество', attr: 'Wis' },
  { key: 'Prf', name: 'Выступление/Лидер', attr: 'Cha' },
  { key: 'Itm', name: 'Устрашение', attr: 'Cha' },
  { key: 'Dec', name: 'Обман', attr: 'Cha' },
  { key: 'Chr', name: 'Очарование', attr: 'Cha' },
  { key: 'Prs', name: 'Убеждение', attr: 'Cha' }
]
// слоты экипировки: поле в файле → подпись (в приложении 12 на экране, в файле — 15)
export const EQUIP_SLOTS = [
  { key: 'HeadItem', name: 'Голова', icon: '⛑' },
  { key: 'AmuletItem', name: 'Амулет', icon: '📿' },
  { key: 'BodyItem', name: 'Тело', icon: '🥋' },
  { key: 'HandsItem', name: 'Руки', icon: '🧤' },
  { key: 'BeltItem', name: 'Пояс', icon: '🎗' },
  { key: 'LegsItem', name: 'Ноги', icon: '🥾' },
  { key: 'Ring1Item', name: 'Кольцо 1', icon: '💍' },
  { key: 'Ring2Item', name: 'Кольцо 2', icon: '💍' },
  { key: 'Ornament1Item', name: 'Украшение 1', icon: '✦' },
  { key: 'Ornament2Item', name: 'Украшение 2', icon: '✦' },
  { key: 'Artifact1Item', name: 'Артефакт 1', icon: '🔮' },
  { key: 'Artifact2Item', name: 'Артефакт 2', icon: '🔮' },
  { key: 'Weapon1Item', name: 'Оружие 1', icon: '⚔' },
  { key: 'Weapon2Item', name: 'Оружие 2', icon: '🗡' },
  { key: 'ShieldItem', name: 'Щит', icon: '🛡' }
]
// редкость: цвет текста и плашки (как в приложении, тёмная тема); в файлах встречается и «Эпическое/Эпические»
export const RARITIES = [
  { name: 'Обычный', color: '#C8C8D0', bg: '#555560' },
  { name: 'Необычный', color: '#4CAF72', bg: '#1E5C30' },
  { name: 'Редкий', color: '#4A90D9', bg: '#1A3D7A' },
  { name: 'Эпический', color: '#A060E0', bg: '#4A1A80' },
  { name: 'Легендарный', color: '#E08020', bg: '#703010', note: 'Не продаётся' },
  { name: 'Артефакт', color: '#E04060', bg: '#6E1020', note: 'Копий не существует' }
]
export function rarityOf(name) {
  const s = String(name || '').trim().toLowerCase()
  if (!s) return null
  return RARITIES.find(r => s.startsWith(r.name.toLowerCase().slice(0, 5))) || null
}
export const RES_STYLES = [
  { key: 'pips', name: '⭕ Кружки', hint: 'Заполненные / пустые кружки' },
  { key: 'ammo', name: '🟫 Ячейки', hint: 'Патроны, слоты заклинаний' },
  { key: 'boxes', name: '☑ Флажки', hint: 'Чекбоксы' },
  { key: 'number', name: '🔢 Числа', hint: 'Числовой счётчик' }
]

const TRAIT = O({ Name: S(120), Description: S(4000), IsAcquired: B })
const SKILL = O({ SkillName: S(160), CategoryIndex: I(0, 1), Description: S(20000), IsActiveSymbol: B })
const ITEM = N(O({ Name: S(160), ImageFile: IMG, Rarity: S(40), Stats: S(4000), Effects: S(8000) }))

const statsFields = {}
for (const a of ATTRS) { statsFields[a.key + 'Base'] = I(-99, 999); statsFields[a.key + 'SaveProf'] = B }
for (const s of SKILLS) { statsFields[s.key + 'T'] = I(-99, 999); statsFields[s.key + 'P'] = I(0, 3) }

const main = {
  CharacterName: S(120), Hits: S(30), Defense: I(), Evasion: I(), SuperHits: S(30), Speed: I(), CarryCapacity: I(), Initiative: I(),
  Mastery: S(20), Class: S(80), Subclass: S(80), Exhaustion: I(0, 5), DeathSaves: I(0, 3), Vision: I(0, 10), Hearing: I(0, 10), Aura: I(0, 10),
  Mana: S(30), Stamina: S(30), PhotoFile: IMG,
  Race: S(80), Backstory: S(30000), Worldview: S(120), HeightWeight: S(80), BodySize: S(60), Age: I(0, 1e7), Appearance: S(8000),
  StartBonus1: S(400), StartBonus2: S(400), StartBonus3: S(400), Level: I(0, 1000), Experience: I(0, 2e9),
  BodyDev: I(0, 8), MindDev: I(0, 8), SpiritDev: I(0, 8), Awakening: S(120), Buff: S(2000), Debuff: S(2000),
  Stats: O(statsFields),
  Skills: A(SKILL, 150), PassiveSkills: A(SKILL, 150),
  Attacks: A(O({ AttackType: S(160), Description: S(8000), IsActive: B }), 80),
  CustomSheets: A(O({
    Name: S(80),
    Columns: A(O({ Header: S(60), ColumnType: E('text', 'toggle', 'number') }), 12),
    Rows: A(O({ Cells: A(S(2000), 12) }), 300)
  }), 20),
  JournalEntries: A(O({ Id: S(60), Title: S(200), Content: S(60000), Tags: S(300), Date: S(40) }), 500),
  // тренировки и обучение (поле сайта, в приложении его не было): прогресс Cur из Max, этап («2», «Освоение»…),
  // статус — пустой = сам (дошёл до максимума — завершено, иначе в процессе), или задан вручную
  Trainings: A(O({ Id: S(40), Name: S(160), Note: S(4000), Cur: I(0, 1e7), Max: I(0, 1e7), Stage: S(40), ProgNote: S(8000), Status: E('', 'planned', 'active', 'done') }), 300),
  HpData: O({ Current: I(), Max: I(), Temp: I(0, 1e9), DS_S1: B, DS_S2: B, DS_S3: B, DS_F1: B, DS_F2: B, DS_F3: B }),
  Resources: A(O({ Id: S(60), Name: S(80), Current: I(), Max: I(0, 1e7), Color: COLOR, ResetOn: E('long', 'short', 'never'), Style: E('pips', 'ammo', 'boxes', 'number'), Notes: S(1000), Icon: S(16) }), 40),
  Trait4: TRAIT, Trait9: TRAIT, Trait18: TRAIT,
  HumanoidTraits: A(TRAIT, 5),
  Proficiencies: A(O({ TypeIndex: I(0, 1), Description: S(400), Rating: I(0, 3) }), 120),
  // Stored — лежит на личном складе (поле сайта), а не при себе
  Inventory: A(O({ ImageFile: IMG, Name: S(160), Description: S(8000), Rarity: S(40), Quantity: I(0, 1e6), Notes: S(4000), Equipped: B, Stored: B }), 600),
  GoldCoins: I(0, 2e9), SilverCoins: I(0, 2e9), CopperCoins: I(0, 2e9),
  FieldColors: M(COLOR, 400),
  Accent: COLOR,
  SlotLocks: M(B, 20)
}
for (let i = 1; i <= 4; i++) { main[`CustomField${i}Label`] = S(60); main[`CustomField${i}Value`] = S(200) }
for (const s of EQUIP_SLOTS) main[s.key] = ITEM
export const SCHEMA = O(main)

/* ---------- очистка значения по схеме ---------- */
const blankOf = s => {
  if (s.nullable) return null
  switch (s.t) {
    case 's': case 'img': case 'color': return ''
    case 'i': return Math.max(s.min, Math.min(s.max, 0))
    case 'b': return false
    case 'e': return s.vals[0]
    case 'a': return []
    case 'm': return {}
    case 'o': return Object.fromEntries(Object.entries(s.f).map(([k, v]) => [k, blankOf(v)]))
  }
  return null
}
export function cleanBy(s, v) {
  if (v == null) return blankOf(s)
  switch (s.t) {
    case 's': return String(v).replace(/\r\n/g, '\n').slice(0, s.n)
    case 'img': { const f = String(v); return /^[a-f0-9]{16,64}\.(png|jpe?g|gif|webp)$/i.test(f) ? f : '' }
    case 'color': return /^#[0-9a-f]{6}$/i.test(String(v)) ? String(v).toUpperCase() : ''
    case 'i': {
      const n = typeof v === 'string' ? parseInt(v.replace(/^\+/, ''), 10) : Math.round(Number(v))
      return Number.isFinite(n) ? Math.max(s.min, Math.min(s.max, n)) : blankOf(s)
    }
    case 'b': return v === true || v === 'true' || v === 1
    case 'e': return s.vals.includes(v) ? v : s.vals[0]
    case 'a': return Array.isArray(v) ? v.slice(0, s.max).map(x => cleanBy(s.item, x)) : []
    case 'm': {
      if (typeof v !== 'object' || Array.isArray(v)) return {}
      const out = {}
      for (const [k, x] of Object.entries(v).slice(0, s.max)) {
        const c = cleanBy(s.val, x)
        if (c !== '' && c !== false) out[String(k).slice(0, 80)] = c
      }
      return out
    }
    case 'o': {
      if (typeof v !== 'object' || Array.isArray(v)) return blankOf(s)
      const out = {}
      for (const [k, sub] of Object.entries(s.f)) out[k] = cleanBy(sub, v[k])
      return out
    }
  }
  return null
}
export const blankSheet = () => cleanBy(SCHEMA, {
  CharacterName: 'Новый персонаж', Stats: Object.fromEntries(ATTRS.map(a => [a.key + 'Base', 10])),
  HpData: {}, Trait4: {}, Trait9: {}, Trait18: {}
})

/* ---------- тренировки ---------- */
export const TRAIN_STATUS = {
  active: { name: 'В процессе', color: '#e6c25a' },
  planned: { name: 'Запланировано', color: '#6fa8dc' },
  done: { name: 'Завершено', color: '#7ccf8b' }
}
export const trainStatus = t => t?.Status || (t?.Max > 0 && t.Cur >= t.Max ? 'done' : 'active')
// этапы владений и освоения — подсказки для поля «№»
export const TRAIN_STAGES = ['Нет', 'Обычный', 'Базовое', 'Эксперт', 'Легенда', 'Освоение']
// шаблоны: название и сколько очков обычно нужно (этап числом подставляется сам — следующий по счёту)
export const TRAIN_TEMPLATES = [
  { k: 'attr', name: 'Характеристика', items: [...ATTRS.map(a => a.name), 'Магия'], num: true, max: [50, 150, 250, 500, 500] },
  { k: 'skill', name: 'Навык', items: SKILLS.map(s => s.name), num: true, max: [50, 150, 250, 500, 500] },
  { k: 'tri', name: 'Треугольник', prefix: 'Треугольник: ', items: ['Тело', 'Разум', 'Дух', 'Сила', 'Ловкость', 'Интеллект'], num: true, max: [100, 100, 100] },
  { k: 'prof', name: 'Владение', prefix: 'Владение: ', stage: 'Базовое', max: [1000] },
  { k: 'trait', name: 'Черта', prefix: 'Черта: ', stage: 'Освоение', max: [100] },
  { k: 'spell', name: 'Заклинание', prefix: 'Заклинание: ', stage: 'Освоение', max: [50] },
  { k: 'magic', name: 'Магия школы', items: ['Магия Огня', 'Магия Воды', 'Магия Воздуха', 'Магия Земли', 'Магия Льда', 'Магия Тьмы', 'Магия Света', 'Магия призыва'], suffix: [' Базовая', ' Экспертная', ' Легендарная'], stage: ['Нет', 'Базовое', 'Эксперт'], max: [100, 500, 2000] },
  { k: 'lang', name: 'Язык', prefix: 'Язык: ', stage: 'Освоение', max: [1000] },
  { k: 'craft', name: 'Ремесло', prefix: 'Ремесло: ', stage: 'Базовое', max: [1000] }
]

// путь «Stats.StrBase» / «Skills.3.Description» → схема этого места (или null, если такого нет)
export function schemaAt(path) {
  let s = SCHEMA
  for (const part of String(path).split('.')) {
    if (!s) return null
    if (s.t === 'o') s = s.f[part]
    else if (s.t === 'a') s = /^\d+$/.test(part) && Number(part) < s.max ? s.item : null
    else if (s.t === 'm') s = part ? s.val : null
    else return null
  }
  return s || null
}
export function getAt(obj, path) {
  let o = obj
  for (const part of String(path).split('.')) { if (o == null) return undefined; o = o[part] }
  return o
}
// записать значение по пути; недостающие объекты по дороге создаются (пустой слот экипировки → предмет)
export function setAt(obj, path, value) {
  const parts = String(path).split('.')
  let o = obj, s = SCHEMA
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i]
    s = s.t === 'o' ? s.f[p] : s.t === 'a' ? s.item : s.val
    if (o[p] == null) {
      if (s.t === 'a' && Number(p) >= 0) return false
      o[p] = s.t === 'o' ? cleanBy({ ...s, nullable: false }, {}) : s.t === 'a' ? [] : {}
    }
    o = o[p]
  }
  const last = parts[parts.length - 1]
  if (Array.isArray(o) && Number(last) > o.length) return false
  if (s.t === 'm' && (value === '' || value === false || value == null)) delete o[last]
  else o[last] = value
  return true
}

/* ---------- формулы (как в приложении) ---------- */
const int = v => { const n = parseInt(String(v ?? '').trim().replace(/^\+/, ''), 10); return Number.isFinite(n) ? n : 0 }
export const mastery = d => int(d.Mastery) // бонус мастерства
export const attrMod = base => Math.floor((int(base) - 10) / 2)
export const saveBonus = (d, a) => attrMod(d.Stats?.[a + 'Base']) + (d.Stats?.[a + 'SaveProf'] ? mastery(d) : 0)
export function skillBonus(d, skill) {
  const st = d.Stats || {}, t = int(st[skill.key + 'T']), m = attrMod(st[skill.attr + 'Base']), bm = mastery(d)
  switch (int(st[skill.key + 'P'])) {
    case 1: return t + m + bm
    case 2: return t + m + bm * 2
    case 3: return Math.floor(t + m + bm * 2 + int(d.Level) / 4)
    default: return t + m
  }
}
// максимум хитов: число из поля «Хиты» на главной; если там пусто — максимум из трекера
export const hpMax = d => { const n = int(d?.Hits); return n > 0 ? n : Number(d?.HpData?.Max) || 0 }
export const fmtBonus = v => (v >= 0 ? `+${v}` : `${v}`)

// кубы в тексте: «1к8 + 11», «3d12», «2к6+1к4−2» — для кнопок броска в атаках и предметах
export const DICE_RE = /(\d{0,2})\s*[кКdDдД]\s*(4|6|8|10|12|20|100)(?![0-9])((?:\s*[+\-−]\s*(?:\d{0,2}\s*[кКdDдД]\s*(?:4|6|8|10|12|20|100)(?![0-9])|\d{1,3}))*)/g
export const diceToFormula = s => String(s).replace(/[кКдДD]/g, 'd').replace(/−/g, '-').replace(/\s+/g, '').replace(/(^|[+-])d/g, '$11d')

/* ---------- подписи для истории изменений ---------- */
const LABELS = {
  CharacterName: 'Имя', Hits: 'Хиты', Defense: 'Броня', Evasion: 'Уклонение', SuperHits: 'Сверх-хиты', Speed: 'Скорость',
  CarryCapacity: 'Грузоподъёмность', Initiative: 'Инициатива', Mastery: 'Мастерство', Class: 'Класс', Subclass: 'Подкласс',
  Exhaustion: 'Изнурение', DeathSaves: 'Спасброски от смерти', Vision: 'Зрение', Hearing: 'Слух', Aura: 'Аура', Mana: 'Мана',
  Stamina: 'Выносливость', PhotoFile: 'Портрет', Race: 'Раса', Backstory: 'Предыстория', Worldview: 'Мировоззрение',
  HeightWeight: 'Рост / вес', BodySize: 'Размер тела', Age: 'Возраст', Appearance: 'Внешность', StartBonus1: 'Старт-бонус 1',
  StartBonus2: 'Старт-бонус 2', StartBonus3: 'Старт-бонус 3', Level: 'Уровень', Experience: 'Опыт', BodyDev: 'Тело',
  MindDev: 'Разум', SpiritDev: 'Дух', Awakening: 'Пробуждение', Buff: 'Бафф', Debuff: 'Дебафф', Stats: 'Характеристики',
  Skills: 'Активные навыки', PassiveSkills: 'Пассивные навыки', Attacks: 'Атаки', CustomSheets: 'Свои листы',
  JournalEntries: 'Журнал', Trainings: 'Тренировки', HpData: 'Хиты (трекер)', Resources: 'Ресурсы', Trait4: 'Черта 4 ур.', Trait9: 'Черта 9 ур.',
  Trait18: 'Черта 18 ур.', HumanoidTraits: 'Черты гуманоидов', Proficiencies: 'Владения', Inventory: 'Инвентарь',
  GoldCoins: 'Золото', SilverCoins: 'Серебро', CopperCoins: 'Медь', FieldColors: 'Цвет поля', Accent: 'Цвет листа', SlotLocks: 'Замок слота',
  Current: 'текущие', Max: 'максимум', Temp: 'временные', Name: 'название', Description: 'описание', SkillName: 'название',
  IsAcquired: 'получена', Stored: 'на складе', Rating: 'уровень', Quantity: 'количество', Rarity: 'редкость', Notes: 'заметки', Equipped: 'надет',
  Stats_: 'статы', Effects: 'эффекты', AttackType: 'тип', Title: 'заголовок', Content: 'текст', Tags: 'теги', ImageFile: 'картинка',
  Style: 'вид', Color: 'цвет', Icon: 'значок', ResetOn: 'восстановление', CategoryIndex: 'категория', IsActiveSymbol: 'отметка ●',
  IsActive: 'отметка ●', TypeIndex: 'тип', Cells: 'ячейки', Columns: 'колонки', Rows: 'строки', Header: 'название колонки',
  ColumnType: 'тип колонки', Date: 'дата', Cur: 'прогресс', Stage: 'этап', ProgNote: 'примечание к прогрессу', Note: 'примечание', Status: 'статус', Rarity_: 'редкость', DS_S1: 'спасбросок: успех 1', DS_S2: 'спасбросок: успех 2', DS_S3: 'спасбросок: успех 3',
  DS_F1: 'спасбросок: провал 1', DS_F2: 'спасбросок: провал 2', DS_F3: 'спасбросок: провал 3'
}
// понятные значения служебных полей
const VALUE_WORDS = { planned: 'запланировано', active: 'в процессе', done: 'завершено', pips: 'кружки', ammo: 'ячейки', boxes: 'флажки', number: 'числа', text: 'текст', toggle: 'флажок', long: 'долгий отдых', short: 'короткий отдых', never: 'не восстанавливается' }
for (const a of ATTRS) { LABELS[a.key + 'Base'] = a.name; LABELS[a.key + 'SaveProf'] = `Спасбросок: ${a.name}` }
for (const s of SKILLS) { LABELS[s.key + 'T'] = `${s.name}: тренировка`; LABELS[s.key + 'P'] = `${s.name}: владение` }
for (let i = 1; i <= 4; i++) { LABELS[`CustomField${i}Label`] = `Своё поле ${i}: название`; LABELS[`CustomField${i}Value`] = `Своё поле ${i}` }
for (const s of EQUIP_SLOTS) LABELS[s.key] = `Слот «${s.name}»`
export function pathLabel(path, data) {
  const parts = String(path).split('.')
  const out = []
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]
    if (/^\d+$/.test(p)) {
      const item = getAt(data, parts.slice(0, i + 1).join('.'))
      const nm = item && (item.SkillName || item.Name || item.AttackType || item.Title || item.Description)
      out.push(nm ? `«${String(nm).slice(0, 40)}»` : `№${Number(p) + 1}`)
    } else if (parts[i - 1] === 'Stats' || i === 0 || LABELS[p]) out.push(p === 'Stats' && i === parts.length - 2 ? '' : LABELS[p] || p)
    else out.push(p)
  }
  return out.filter(Boolean).join(' → ')
}
// короткий текст значения для истории
export const isImageFile = v => typeof v === 'string' && /^[a-f0-9]{16,64}\.(png|jpe?g|gif|webp)$/i.test(v)
export function shortValue(v) {
  if (v == null || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'да' : 'нет'
  if (Array.isArray(v)) return `${v.length} шт.`
  if (typeof v === 'object') return v.Name || v.SkillName || v.AttackType || v.Title || '…'
  if (VALUE_WORDS[v]) return VALUE_WORDS[v]
  if (isImageFile(v)) return '🖼 картинка'
  const s = String(v).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  return s.length > 60 ? s.slice(0, 57) + '…' : s
}
