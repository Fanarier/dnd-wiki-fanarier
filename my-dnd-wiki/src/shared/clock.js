// Часы поселения: игровое время суток и дни. Ведёт мастер — пауза, скорости (как в RimWorld), перемотка.
// s.clock = { min, at, speed }: в настоящий момент at (мс) было min игровых минут от начала летописи,
// speed — игровых минут в настоящую секунду (0 — пауза). Новые игровые сутки = «Прошёл день» для хозяйства.

export const DAY_MIN = 1440
export const CLOCK_SPEEDS = [
  { v: 0, label: '⏸', title: 'Пауза' },
  { v: 1, label: '▶', title: 'Обычная скорость: сутки за 24 минуты' },
  { v: 3, label: '▶▶', title: 'Быстро: сутки за 8 минут' },
  { v: 8, label: '▶▶▶', title: 'Очень быстро: сутки за 3 минуты' },
  { v: 60, label: '⏩', title: 'Промотка: сутки за 24 секунды' }
]
// без часов — стоим на паузе в 9 утра текущего дня
export const clockOf = s => s?.clock || { min: (s?.day || 0) * DAY_MIN + 9 * 60, at: 0, speed: 0 }
export function clockMin(s, now) {
  const c = clockOf(s)
  return c.min + (c.speed > 0 ? Math.max(0, now - c.at) / 1000 * c.speed : 0)
}
// время суток: «14:05», и что за пора
export function dayTime(min) {
  const m = ((min % DAY_MIN) + DAY_MIN) % DAY_MIN
  return { day: Math.floor(min / DAY_MIN), hour: Math.floor(m / 60), minute: Math.floor(m % 60), of: m, text: `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.floor(m % 60)).padStart(2, '0')}` }
}
export function partOfDay(of) {
  if (of < 5 * 60) return { key: 'night', label: 'ночь', icon: '🌙' }
  if (of < 7 * 60) return { key: 'dawn', label: 'рассвет', icon: '🌅' }
  if (of < 12 * 60) return { key: 'morning', label: 'утро', icon: '☀' }
  if (of < 18 * 60) return { key: 'day', label: 'день', icon: '☀' }
  if (of < 21 * 60) return { key: 'evening', label: 'вечер', icon: '🌇' }
  return { key: 'night', label: 'ночь', icon: '🌙' }
}
// насколько темно (0 — день, 1 — глубокая ночь): плавно на рассвете и закате
export function darkness(of) {
  const h = of / 60
  if (h < 4.5) return 0.85
  if (h < 7) return 0.85 * (1 - (h - 4.5) / 2.5)
  if (h < 19) return 0
  if (h < 21.5) return 0.85 * ((h - 19) / 2.5)
  return 0.85
}
