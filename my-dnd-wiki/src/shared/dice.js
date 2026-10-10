// Кубики: общий подсчёт для сервера и браузера.
// Преимущество / помеха (adv / dis): d20 бросается дважды, в сумму идёт больший / меньший.
export const DIE_SIDES = [4, 6, 8, 10, 12, 20, 100]
export const ADV_MODES = ['adv', 'dis']
export const ADV_LABEL = { adv: 'преимущество', dis: 'помеха' }

// какое из двух значений d20 засчитано (индекс); -1 — бросок обычный
export function keptIndex(g, adv) {
  if (!adv || g.sides !== 20 || g.values.length !== 2) return -1
  const [a, b] = g.values
  return adv === 'adv' ? (a >= b ? 0 : 1) : (a <= b ? 0 : 1)
}
const groupSum = (g, adv) => {
  const k = keptIndex(g, adv)
  return k === -1 ? g.values.reduce((a, b) => a + b, 0) : g.values[k]
}
// сколько кубиков «по формуле»: при преимуществе 2d20 — это всё ещё 1d20
const groupCount = (g, adv) => (keptIndex(g, adv) === -1 ? g.values.length : 1)

export function rollSummary({ groups, mod = 0, adv = '' }) {
  const total = groups.reduce((s, g) => s + groupSum(g, adv), 0) + mod
  const notation = groups.map(g => `${groupCount(g, adv)}d${g.sides}`).join('+') + (mod ? (mod > 0 ? `+${mod}` : `${mod}`) : '')
  return { total, notation }
}

// натуральные 20 / 1 — только когда в формуле ровно один d20 (с преимуществом — по засчитанному)
export function natural(r) {
  if (r.groups?.length !== 1 || r.groups[0].sides !== 20) return 0
  const g = r.groups[0], k = keptIndex(g, r.adv)
  if (k !== -1) return g.values[k]
  return g.values.length === 1 ? g.values[0] : 0
}
