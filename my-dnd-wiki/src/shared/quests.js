// Логика заказов гильдий — общая для сервера и сайта.
import { GUILDS } from './catalog.js'

export const DAY = 86400000

// Срочность: её видят игроки; множитель ускоряет рост шанса досрочного закрытия
export const URGENCY = {
  low: { label: 'Не срочно', mult: 0.5, color: '#7d8590' },
  normal: { label: 'Обычный', mult: 1, color: '#c9a24f' },
  high: { label: 'Срочно', mult: 1.5, color: '#f0802e' },
  critical: { label: 'Очень срочно!', mult: 2.2, color: '#e0281e' }
}

// Метки на листке заказа (видят все)
export const QUEST_TAGS = {
  bonus: { label: 'Награда повышена', color: '#d6b11e' },
  secret: { label: 'Конфиденциально', color: '#7a5cff' },
  dangerous: { label: 'Смертельно опасно', color: '#c21d1d' },
  guildOnly: { label: 'Только для членов гильдии', color: '#2a72f0' },
  repeat: { label: 'Повторяемый', color: '#4c9a0c' }
}

export const EARLY_DEFAULT = { enabled: false, start: 5, perDay: 8, max: 60, auto: false, lastRoll: null, history: [] }

/*
  Шанс досрочного закрытия (заказ забирает другая группа) в момент now, в процентах:
    start + perDay × (реальных суток с публикации) × множитель срочности, но не больше max.
  Например: старт 5%, +8%/сутки, «Срочно» ×1.5 → через 1 день 17%, через 3 дня 41%, потолок 60%.
*/
export function earlyChance(q, now = Date.now()) {
  const e = q.early
  if (!e || !e.enabled) return 0
  const days = Math.max(0, (now - (q.postedAt || q.createdAt || now)) / DAY)
  const mult = URGENCY[q.urgency]?.mult ?? 1
  return Math.max(0, Math.min(e.max ?? 100, (e.start || 0) + (e.perDay || 0) * days * mult))
}

// Когда следующий автоматический бросок (раз в реальные сутки)
export function nextRollAt(q) {
  const base = q.early?.lastRoll || q.postedAt || q.createdAt || Date.now()
  return base + DAY
}

/*
  Репутация отряда у гильдии: + за выполненные заказы, − за проваленные, плюс ручная поправка мастера.
  За заказ: 10 (основная награда с репутацией) + 5 (доп. награда с репутацией) + опасность×2.
*/
export const REP_TIERS = [
  { min: -Infinity, label: 'Неприязнь', color: '#c21d1d' },
  { min: 0, label: 'Нейтралитет', color: '#7d8590' },
  { min: 20, label: 'Знакомые', color: '#4c9a0c' },
  { min: 50, label: 'Доверие', color: '#2a72f0' },
  { min: 100, label: 'Уважение', color: '#7a5cff' },
  { min: 200, label: 'Легенда гильдии', color: '#d6b11e' }
]

export function questRep(q) {
  const base = (q.reward?.rep ? 10 : 0) + (q.bonus?.rep ? 5 : 0) + (q.danger || 0) * 2
  if (q.status === 'done') return q.result === 'failure' ? -Math.ceil(base / 2) : base || 3
  if (q.status === 'failed') return -(base || 5)
  return 0
}

export function guildStats(quests, adjust = {}) {
  return GUILDS.map(g => {
    const list = quests.filter(q => q.guild === g.name)
    const rep = list.reduce((a, q) => a + questRep(q), 0) + (adjust[g.name] || 0)
    const tier = [...REP_TIERS].reverse().find(t => rep >= t.min)
    const next = REP_TIERS.find(t => t.min > rep)
    return {
      ...g,
      open: list.filter(q => q.status === 'available').length,
      done: list.filter(q => q.status === 'done').length,
      failed: list.filter(q => q.status === 'failed').length,
      rep, tier, next,
      progress: next ? Math.max(0, Math.min(1, (rep - Math.max(0, tier.min)) / (next.min - Math.max(0, tier.min)))) : 1
    }
  })
}

export function rewardText(r) {
  if (!r) return ''
  const parts = []
  if (r.exp) parts.push(`${r.exp} Опыт`)
  if (r.gold) parts.push(`${r.gold} ЗМ`)
  if (r.rep) parts.push('Репутация гильдии')
  if (r.other) parts.push(r.other)
  return parts.join('. ') + (parts.length ? '.' : '')
}
