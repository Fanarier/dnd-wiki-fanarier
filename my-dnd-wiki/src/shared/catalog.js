// Справочники типов объектов карты (общие для сервера и клиента).
// icon — ключ из src/map/icons.js

export const CITY_TYPES = {
  capital: { label: 'Столица', icon: 'crown' },
  city: { label: 'Город', icon: 'castle' },
  town: { label: 'Поселение', icon: 'home' },
  village: { label: 'Деревня', icon: 'barn' },
  fort: { label: 'Крепость', icon: 'fort' },
  ruins: { label: 'Руины', icon: 'ruins' }
}

export const ROAD_TYPES = {
  highway: { label: 'Большак', color: '#c8743a', width: 3, dash: '' },
  road: { label: 'Дорога', color: '#b5652f', width: 2.2, dash: '' },
  trail: { label: 'Тропа', color: '#a0643a', width: 1.6, dash: '5 4' },
  sea: { label: 'Морской путь', color: '#e8f1ff', width: 1.6, dash: '2 5' }
}

// Зоны — анимированные области
export const ZONE_EFFECTS = {
  storm: { label: 'Магическая буря', color: '#9d7bff', glow: '#5b3fd6' },
  rift: { label: 'Разлом', color: '#ff4a3d', glow: '#8c0f0a' },
  blight: { label: 'Порча', color: '#8be04e', glow: '#2f6b12' },
  fire: { label: 'Пламя', color: '#ff9a2e', glow: '#b33a00' },
  mist: { label: 'Странный туман', color: '#c9d3dd', glow: '#5c6b7a' },
  arcane: { label: 'Всплеск арканы', color: '#4fd8ff', glow: '#0a6d9e' },
  frost: { label: 'Вечная стужа', color: '#bfefff', glow: '#3d8fb8' },
  void: { label: 'Пустота', color: '#b05cff', glow: '#1a0630' }
}

// Метки на карте — иконки из легенды кампании (public/icons, game-icons.net, CC BY 3.0).
// group — раздел в легенде. Ключи portal/ruins оставлены ради совместимости со старыми данными.
export const POINT_EFFECTS = {
  quest: { label: 'Сюжетное задание', img: 'split-cross', color: '#d0021b', group: 'Задания' },
  sidequest: { label: 'Побочное задание', img: 'virtual-marker', color: '#4a90e2', group: 'Задания' },
  rumor: { label: 'Слух / зацепка', img: 'thought-bubble', color: '#f8e71c', group: 'Задания' },
  investigation: { label: 'Расследование', img: 'magnifying-glass', color: '#f8e71c', group: 'Задания' },
  unknown: { label: 'Неизвестно', img: 'help', color: '#9b9b9b', group: 'Задания' },

  dungeon: { label: 'Подземелье', img: 'tumulus', color: '#fc88fc', group: 'Места' },
  globalDungeon: { label: 'Глобальное подземелье', img: 'dungeon-gate', color: '#fc88fc', group: 'Места' },
  lair: { label: 'Логово', img: 'dungeon-gate_1', color: '#f5a623', group: 'Места' },
  ruins: { label: 'Руины', img: 'ancient-ruins', color: '#f5a623', group: 'Места' },
  battle: { label: 'Место сражения', img: 'crossed-swords', color: '#f5a623', group: 'Места' },
  worldTree: { label: 'Мировое древо', img: 'oak', color: '#7ed321', group: 'Места' },
  island: { label: 'Остров', img: 'island', color: '#7ed321', group: 'Места' },
  farms: { label: 'Фермы', img: 'herbs-bundle', color: '#4a90e2', group: 'Места' },
  mines: { label: 'Шахты', img: 'mining', color: '#4a90e2', group: 'Места' },
  hunting: { label: 'Охотничьи угодья', img: 'hunting-horn', color: '#4a90e2', group: 'Места' },
  house: { label: 'Дом', img: 'house', color: '#7ed321', group: 'Места' },
  playerHome: { label: 'Жильё игрока', img: 'player-base', color: '#ffffff', group: 'Места' },

  tradeHouse: { label: 'Торговый дом', img: 'bank', color: '#48baff', group: 'Город и связь' },
  guildHq: { label: 'Штаб гильдии авантюристов', img: 'saloon', color: '#48baff', group: 'Город и связь' },
  seaport: { label: 'Крупный морской порт', img: 'anchor', color: '#f8e71c', group: 'Город и связь' },
  cityTeleport: { label: 'Городской телепорт', img: 'magic-portal', color: '#f8e71c', group: 'Город и связь' },
  mobileTeleport: { label: 'Мобильный телепорт', img: 'triforce', color: '#f8e71c', group: 'Город и связь' },
  portal: { label: 'Иномирные врата', img: 'magic-gate', color: '#f5a623', group: 'Город и связь' },
  ship: { label: 'Корабль', img: 'shooner-sailboat', color: '#7ed321', group: 'Город и связь' },
  person: { label: 'Персонаж', img: 'person', color: '#7ed321', group: 'Город и связь' },
  alliance: { label: 'Союз / фракция', img: 'all-for-one', color: '#fc88fc', group: 'Город и связь' },

  abyssRift: { label: 'Разлом бездны', img: 'spiky-explosion', color: '#d0021b', group: 'Угрозы' },
  leviathan: { label: 'Левиафан', img: 'croc-jaws', color: '#d0021b', group: 'Угрозы' },
  storm: { label: 'Непогода', img: 'twister', color: '#d0021b', group: 'Угрозы' },
  pirates: { label: 'Пираты', img: 'sinagot', color: '#d0021b', group: 'Угрозы' },
  fire: { label: 'Пожар', img: 'small-fire', color: '#d0021b', group: 'Угрозы' },
  catastrophe: { label: 'Катастрофа', img: 'gooey-impact', color: '#d0021b', group: 'Угрозы' },
  watcher: { label: 'Тайный враг', img: 'one-eyed', color: '#d0021b', group: 'Угрозы' },
  danger1: { label: 'Опасность: средняя', img: 'thunder-skull', color: '#f8e71c', group: 'Угрозы' },
  danger2: { label: 'Опасность: высокая', img: 'thunder-skull_1', color: '#f5a623', group: 'Угрозы' },
  danger3: { label: 'Опасность: смертельная', img: 'thunder-skull_2', color: '#d0021b', group: 'Угрозы' }
}

// Уровни для шкал на панели «Лунный виток» (угроза разлома, пиратство…)
export const HUD_LEVELS = [
  { label: 'Нет', color: '#7d8590', value: 4 },
  { label: 'Низкая', color: '#4ca30d', value: 25 },
  { label: 'Средняя', color: '#d6b11e', value: 50 },
  { label: 'Высокая', color: '#f0802e', value: 72 },
  { label: 'Обширное', color: '#ff6b2c', value: 86 },
  { label: 'Критическая', color: '#e0281e', value: 100 }
]

export const PARTY_ICONS = ['sword', 'shield', 'horse', 'ship', 'flag', 'paw', 'skull', 'wizard']

export const PARTY_COLORS = ['#e8b04a', '#e8604a', '#4ac0e8', '#7ee06a', '#c47aff', '#ff7ac0', '#f2f2f2', '#2fd6b4']

// Темп в км за игровой день (ориентир — D&D 5e: обычный 24 мили ≈ 38 км)
export const PACE_PRESETS = [
  { label: 'Скрытно', km: 29 },
  { label: 'Пешком', km: 38 },
  { label: 'Форсированный марш', km: 48 },
  { label: 'Повозка / караван', km: 30 },
  { label: 'Верхом', km: 60 },
  { label: 'Парусный корабль', km: 77 },
  { label: 'Галера', km: 154 },
  { label: 'Полёт', km: 130 }
]

export const ROUTE_COLORS = ['#ff4a3d', '#ffb02e', '#4fd8ff', '#7ee06a', '#c47aff', '#f2f2f2']
