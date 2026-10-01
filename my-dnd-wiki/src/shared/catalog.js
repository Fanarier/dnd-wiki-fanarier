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

// Точечные аномалии и места
export const POINT_EFFECTS = {
  portal: { label: 'Портал', color: '#9d7bff', icon: 'portal' },
  artifact: { label: 'Артефакт', color: '#ffd166', icon: 'artifact' },
  ruins: { label: 'Руины', color: '#c2a27a', icon: 'ruins' },
  lair: { label: 'Логово', color: '#ff5a4e', icon: 'lair' },
  shrine: { label: 'Святилище', color: '#7ee0c3', icon: 'shrine' },
  crystal: { label: 'Кристалл', color: '#4fd8ff', icon: 'crystal' },
  danger: { label: 'Опасность', color: '#ff3b3b', icon: 'danger' },
  quest: { label: 'Зацепка / квест', color: '#ffcf4a', icon: 'quest' },
  treasure: { label: 'Сокровище', color: '#ffb02e', icon: 'treasure' },
  tower: { label: 'Башня', color: '#b9a6ff', icon: 'tower' }
}

export const PARTY_ICONS = ['sword', 'shield', 'horse', 'ship', 'flag', 'paw', 'skull', 'wizard']

export const PARTY_COLORS = ['#e8b04a', '#e8604a', '#4ac0e8', '#7ee06a', '#c47aff', '#ff7ac0', '#f2f2f2', '#2fd6b4']
