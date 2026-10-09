// Генератор событий поселения: сайт смотрит на положение дел и предлагает мастеру событие.
// Мастер правит текст и выпускает его в журнал (последствия применяются, если он оставил галочку) или отбрасывает.
// Общий для сервера и клиента.
import { RES, RACES, OUTPOSTS, BUILDINGS, DAMAGE, DAMAGE_ORDER, computeSettlement } from './settlement.js'
import { makeName } from './names.js'

const pick = (rnd, list) => list[Math.floor(rnd() * list.length)]
const between = (rnd, a, b) => Math.round(a + rnd() * (b - a))
const fmt = n => (n > 0 ? '+' : '−') + Math.abs(n)
const plural = (n, one, few, many) => (n % 10 === 1 && n % 100 !== 11 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? few : many)

// случайная постройка, которой можно навредить (готовая, не личная, ещё не в руинах); prefer — сначала эти виды
function victim(s, rnd, prefer = []) {
  const ok = (s.buildings || []).filter(b => (b.state || 'built') === 'built' && b.damage !== 'ruined' && BUILDINGS[b.type] && !BUILDINGS[b.type].personal)
  const best = ok.filter(b => prefer.includes(b.type))
  return (best.length ? best : ok).length ? pick(rnd, best.length ? best : ok) : null
}
// повреждение на ступень хуже нынешнего, но не меньше level
const hurt = (b, level) => DAMAGE_ORDER[Math.max(DAMAGE_ORDER.indexOf(level), Math.min(DAMAGE_ORDER.length - 1, DAMAGE_ORDER.indexOf(b.damage) + 1))]
const bName = b => b.name || BUILDINGS[b.type].label

// дней до нуля для ресурсов, которые уходят в минус
function runningOut(s, c) {
  return Object.entries(c.balance)
    .filter(([, b]) => b < 0)
    .map(([k, b]) => ({ res: k, days: Math.floor((s.stock?.[k] || 0) / -b) }))
    .sort((a, b) => a.days - b.days)
}

/* Каждый шаблон: weight(s, c) — насколько уместен сейчас (0 — не подходит), make(...) — текст и последствия.
   apply: { stock: { ресурс: ± }, stats: { morale|stability|threat: ± }, damage: [{ id, level }] } — что поменяется, если выпустить с последствиями. */
export const EVENT_IDEAS = [
  {
    id: 'raid', label: 'Набег',
    weight: (s, c) => (c.threat >= 25 ? 1 + c.threat / 30 : 0),
    make(s, c, rnd) {
      const [foe, beast] = pick(rnd, [['Варги', true], ['Мародёры', false], ['Гоблины с холмов', false], ['Дезертиры', false], ['Одичавшие волки', true]])
      const power = Math.round(c.threat * (2 + rnd() * 6))
      const def = c.defense.total
      if (def >= power) {
        return {
          title: `${foe} у стен`, type: 'threat', duration: ['quick'],
          text: `${foe} попытались прорваться к поселению, но стража встретила их у частокола и отбросила. Сила набега ${power} против защиты ${def}.`,
          effect: 'Отбились. Мораль +2, угрозы −5', apply: { stats: { morale: 2, threat: -5 } }
        }
      }
      const loss = Math.max(10, Math.round((power - def) / 2))
      const res = pick(rnd, beast ? ['meat', 'veg'] : ['veg', 'meat', 'wood', 'goods'])
      // чем сильнее перевес набега, тем хуже досталось постройке
      const gap = (power - def) / Math.max(1, power)
      const b = victim(s, rnd, beast ? ['coop', 'ranch', 'barn', 'storehouse'] : ['storehouse', 'barn', 'market', 'tavern', 'house'])
      const level = b ? hurt(b, gap > 0.6 ? 'major' : gap > 0.3 ? 'medium' : 'minor') : null
      return {
        title: `${foe} прорвались`, type: 'alarm', duration: ['decide'],
        text: `${foe} прорвались за ограду и ${beast ? 'разорили кладовые' : 'растащили часть запасов'}, пока стража стягивалась.${b ? ` Досталось и «${bName(b)}».` : ''} Сила набега ${power} против защиты ${def}. Как ответим?`,
        effect: `${RES[res].label} −${loss}, мораль −5, стабильность −3${b ? `, «${bName(b)}»: ${DAMAGE[level].short} повреждение` : ''}`,
        apply: { stock: { [res]: -loss }, stats: { morale: -5, stability: -3 }, ...(b ? { damage: [{ id: b.id, level, name: bName(b) }] } : {}) }
      }
    }
  },
  {
    id: 'caravan', label: 'Караван',
    weight: (s, c) => (c.trade.cap > c.trade.used ? 1.4 : 0.3),
    make(s, c, rnd) {
      const stock = s.stock || {}
      const rich = Object.entries(stock).filter(([, v]) => v >= 60).sort((a, b) => b[1] - a[1])
      const need = runningOut(s, c)[0]?.res || pick(rnd, ['build', 'iron', 'herbs', 'goods'])
      const give = rich.find(([k]) => k !== need)?.[0] || 'goods'
      const out = between(rnd, 30, 80), get = Math.round(out * (0.4 + rnd() * 0.5))
      const who = pick(rnd, ['гномы из Подгорья', 'торговцы с побережья', 'купец с двумя повозками', 'кочевники с юга'])
      return {
        title: 'Караван у ворот', type: 'important', duration: ['decide'],
        text: `К воротам подошёл караван — ${who}. Просят место на рынке и готовы отдать «${RES[need].label}» ${get} за «${RES[give].label}» ${out}. Пускаем и меняемся?`,
        effect: `Обмен: ${RES[give].label} −${out} → ${RES[need].label} +${get}`, apply: { stock: { [give]: -out, [need]: get } }, applyOff: true
      }
    }
  },
  {
    id: 'running-out', label: 'Запасы на исходе',
    weight: (s, c) => (runningOut(s, c).some(r => r.days <= 3) ? 2.5 : 0),
    make(s, c) {
      const r = runningOut(s, c).find(x => x.days <= 3)
      return {
        title: `На исходе: «${RES[r.res].label}»`, type: 'problem', duration: ['decide'],
        text: `Кладовщики бьют тревогу: запаса «${RES[r.res].label}» осталось ${r.days ? `на ${r.days} ${plural(r.days, 'день', 'дня', 'дней')}` : 'на донышке'}, а тратим больше, чем добываем (${c.balance[r.res]}/день). Что будем делать?`,
        effect: `${RES[r.res].label}: ${c.balance[r.res]}/день`
      }
    }
  },
  {
    id: 'sickness', label: 'Болезнь',
    weight: (s, c) => ((c.jobs.healer?.workers || 0) === 0 ? 1.5 : 0.4) + (c.balance.drink < 0 ? 1 : 0),
    make(s, c, rnd) {
      const what = pick(rnd, ['лихорадка', 'кашель с кровью', 'кишечная хворь', 'болотная трясуха'])
      const sick = between(rnd, 3, 9)
      const healers = c.jobs.healer?.workers || 0
      return {
        title: 'Хворь в поселении', type: 'problem', duration: ['decide'],
        text: `По домам пошла ${what}: ${plural(sick, 'слёг', 'слегли', 'слегли')} ${sick} ${plural(sick, 'житель', 'жителя', 'жителей')}.${healers ? ` Целители (${healers}) просят травы и время.` : ' Лечить некому — целителей нет.'} Как поступим?`,
        effect: `Больных ${sick}. Мораль −3${healers ? ', травы −' + sick * 2 : ''}`,
        apply: { stats: { morale: -3 }, ...(healers ? { stock: { herbs: -sick * 2 } } : {}) }
      }
    }
  },
  {
    id: 'forest-find', label: 'Находка в лесу',
    weight: (s, c) => ((c.jobs.lumberjack?.workers || 0) + (c.jobs.gatherer?.workers || 0) > 0 ? 1 : 0),
    make(s, c, rnd) {
      const [res, a, b, what] = pick(rnd, [['herbs', 8, 25, 'поляну редких трав'], ['wood', 40, 90, 'бурелом сухого дуба'], ['fruit', 20, 50, 'дикий сад'], ['fiber', 15, 40, 'заросли крапивы для волокна']])
      const n = between(rnd, a, b)
      return {
        title: 'Находка в лесу', type: 'approve', duration: ['quick'],
        text: `Наши люди наткнулись на ${what} и притащили добычу домой.`, effect: `${RES[res].label} +${n}`, apply: { stock: { [res]: n } }
      }
    }
  },
  {
    id: 'harvest', label: 'Урожай',
    weight: (s, c) => ((c.jobs.farmer?.workers || 0) > 0 ? 1 : 0),
    make(s, c, rnd) {
      const good = rnd() > 0.35
      const n = between(rnd, 40, 140)
      return good
        ? { title: 'Щедрый урожай', type: 'approve', duration: ['quick'], text: 'Погода была на нашей стороне — поля дали больше, чем ждали.', effect: `Еда (Овощи) +${n}, мораль +1`, apply: { stock: { veg: n }, stats: { morale: 1 } } }
        : { title: 'Тля на полях', type: 'problem', duration: ['quick'], text: 'Часть посевов поела тля, фермеры спасли что смогли.', effect: `Еда (Овощи) −${Math.round(n / 2)}`, apply: { stock: { veg: -Math.round(n / 2) } } }
    }
  },
  {
    id: 'fire', label: 'Пожар',
    weight: s => ((s.stock?.wood || 0) > 200 ? 0.6 : 0.15),
    make(s, c, rnd) {
      const n = Math.max(10, Math.round((s.stock?.wood || 0) * (0.08 + rnd() * 0.12)))
      // иногда огонь перекидывается на ближнее строение
      const b = rnd() < 0.4 ? victim(s, rnd, ['storehouse', 'barn', 'lumber', 'workshop', 'house']) : null
      const level = b ? hurt(b, rnd() < 0.7 ? 'minor' : 'medium') : null
      return {
        title: 'Пожар на дровяном дворе', type: 'alarm', duration: ['quick'],
        text: `Ночью занялась поленница. Потушили всем миром, но часть дерева сгорела.${b ? ` Огонь успел лизнуть «${bName(b)}».` : ''}`,
        effect: `Дерево −${n}, стабильность −1${b ? `, «${bName(b)}»: ${DAMAGE[level].short} повреждение` : ''}`,
        apply: { stock: { wood: -n }, stats: { stability: -1 }, ...(b ? { damage: [{ id: b.id, level, name: bName(b) }] } : {}) }
      }
    }
  },
  {
    id: 'storm', label: 'Буря',
    weight: s => ((s.buildings || []).filter(b => (b.state || 'built') === 'built').length >= 5 ? 0.35 : 0),
    make(s, c, rnd) {
      const what = pick(rnd, ['Налетела буря с градом', 'Ночью ударил ураганный ветер', 'Гроза с ливнем бушевала до утра'])
      const hit = []
      for (let i = 0; i < (rnd() < 0.4 ? 2 : 1); i++) {
        const b = victim({ buildings: (s.buildings || []).filter(x => !hit.some(h => h.id === x.id)) }, rnd)
        if (b) hit.push({ id: b.id, level: hurt(b, 'minor'), name: bName(b) })
      }
      if (!hit.length) return null
      return {
        title: 'Буря', type: 'problem', duration: ['quick'],
        text: `${what}. Сорвало крыши и повалило заборы: пострадали ${hit.map(h => `«${h.name}»`).join(' и ')}.`,
        effect: hit.map(h => `«${h.name}»: ${DAMAGE[h.level].short} повреждение`).join(', ') + ', мораль −1',
        apply: { stats: { morale: -1 }, damage: hit }
      }
    }
  },
  {
    id: 'refugees', label: 'Беженцы',
    weight: (s, c) => (c.housing.cap - c.housing.used >= 4 ? 1.1 : 0.3),
    make(s, c, rnd) {
      const race = pick(rnd, Object.keys(RACES))
      const n = between(rnd, 3, 9)
      const room = c.housing.cap - c.housing.used
      return {
        title: 'Беженцы просят приюта', type: 'important', duration: ['decide'],
        text: `К воротам пришли ${n} ${plural(n, 'беженец', 'беженца', 'беженцев')} (${RACES[race].label}) — их деревню сожгли. Говорит за всех ${makeName(race, null, rnd)}. Свободного жилья: ${room}. Примем?`,
        effect: `Если принять: +${n} ${plural(n, 'житель', 'жителя', 'жителей')} (${RACES[race].label}), больше ртов`
      }
    }
  },
  {
    id: 'festival', label: 'Праздник',
    weight: (s, c) => (c.morale >= 45 && c.leisure.total > 0 ? 0.9 : 0.2),
    make(s, c, rnd) {
      const what = pick(rnd, ['праздник урожая', 'ярмарку', 'свадьбу на всю деревню', 'ночь костров'])
      const n = between(rnd, 15, 40)
      return {
        title: 'Праздник', type: 'approve', duration: ['quick'],
        text: `Жители устроили ${what}. Таверна гудела до утра.`, effect: `Мораль +4, стабильность +1, Еда (Фрукты) −${n}`,
        apply: { stats: { morale: 4, stability: 1 }, stock: { fruit: -n } }
      }
    }
  },
  {
    id: 'theft', label: 'Кража со склада',
    weight: (s, c) => ((s.stock?.goods || 0) + (s.stock?.parts || 0) > 20 ? ((c.jobs.storekeeper?.workers || 0) ? 0.3 : 1) : 0),
    make(s, c, rnd) {
      const res = (s.stock?.goods || 0) >= (s.stock?.parts || 0) ? 'goods' : 'parts'
      const n = Math.max(3, Math.round((s.stock?.[res] || 0) * (0.1 + rnd() * 0.2)))
      return {
        title: 'Кража со склада', type: 'problem', duration: ['decide'],
        text: `Утром недосчитались «${RES[res].label}». Замок цел — кто-то свой. Будем искать вора?`,
        effect: `${RES[res].label} −${n}, стабильность −2`, apply: { stock: { [res]: -n }, stats: { stability: -2 } }
      }
    }
  },
  {
    id: 'crowded', label: 'Тесно',
    weight: (s, c) => (c.housing.cap && c.housing.used / c.housing.cap >= 0.95 ? 1.5 : 0),
    make(s, c) {
      return {
        title: 'Жилья не хватает', type: 'problem', duration: ['decide'],
        text: `Дома забиты: ${c.housing.used} из ${c.housing.cap}. Люди спят в сараях и ругаются из-за углов.`,
        effect: 'Стабильность −2', apply: { stats: { stability: -2 } }
      }
    }
  },
  {
    id: 'unrest', label: 'Недовольство',
    weight: (s, c) => (c.morale < 40 ? 2 : 0),
    make(s, c) {
      return {
        title: 'Ропот на площади', type: 'alarm', duration: ['decide'],
        text: `Мораль упала до ${c.morale}. На площади собираются недовольные и требуют главу.`,
        effect: 'Стабильность −4', apply: { stats: { stability: -4 } }
      }
    }
  },
  {
    id: 'quarrel', label: 'Ссора рас',
    weight: s => ((s.races || []).filter(r => (r.male || 0) + (r.female || 0) > 0).length >= 2 ? 0.7 : 0),
    make(s, c, rnd) {
      const live = (s.races || []).filter(r => (r.male || 0) + (r.female || 0) > 0)
      const a = pick(rnd, live), b = pick(rnd, live.filter(r => r !== a))
      const why = pick(rnd, ['из-за колодца', 'из-за охотничьих угодий', 'после драки в таверне', 'из-за места на рынке'])
      return {
        title: 'Ссора соседей', type: 'problem', duration: ['decide'],
        text: `${RACES[a.race]?.label || a.race} и ${RACES[b.race]?.label || b.race} повздорили ${why}. Ждут, кого поддержит глава.`,
        effect: 'Стабильность −2', apply: { stats: { stability: -2 } }
      }
    }
  },
  {
    id: 'outpost', label: 'Аванпост',
    weight: s => ((s.outposts || []).some(o => o.state === 'depleting') ? 1 : 0),
    make(s) {
      const o = s.outposts.find(x => x.state === 'depleting')
      return {
        title: 'Аванпост вырабатывается', type: 'depleted', duration: ['decide'],
        text: `${o.specialist || 'Старший'} с аванпоста «${OUTPOSTS[o.type]?.label || o.name}» докладывает: место почти выработано, скоро добывать будет нечего. Ищем новое?`,
        effect: 'Добыча скоро прекратится'
      }
    }
  },
  {
    id: 'wanderer', label: 'Путник',
    weight: (s, c) => (c.guests.cap > 0 ? 0.8 : 0.3),
    make(s, c, rnd) {
      // кто пришёл и как его зовут (имя — по расе)
      const [kind, race, g] = pick(rnd, [['бродячий бард', 'human', 'm'], ['усталый паломник', 'human', 'm'], ['наёмник без нанимателя', 'fenris', 'm'], ['кентавр-картограф', 'centaur', 'm'], ['молчаливая эльфийка в капюшоне', 'highelf', 'f'], ['кицунэ-гадалка', 'kitsune', 'f']])
      const who = `${kind} — ${makeName(race, g, rnd)},`
      const rumor = pick(rnd, ['в старой шахте на севере кто-то зажигает огни', 'на тракте видели королевских сборщиков податей', 'в горах проснулось что-то большое', 'соседняя деревня ищет союзников против разбойников'])
      return { title: 'Путник в таверне', type: 'message', duration: ['quick'], text: `В таверне ${g === 'f' ? 'остановилась' : 'остановился'} ${who} и за кружкой ${g === 'f' ? 'рассказала' : 'рассказал'}, что ${rumor}.`, effect: '' }
    }
  }
]

// выбрать одно событие по весам; exclude — шаблоны, которые уже ждут мастера
export function suggestEvent(s, rnd = Math.random, exclude = []) {
  const c = computeSettlement(s)
  const list = EVENT_IDEAS.map(t => ({ t, w: exclude.includes(t.id) ? 0 : Math.max(0, t.weight(s, c) || 0) })).filter(x => x.w > 0)
  const sum = list.reduce((n, x) => n + x.w, 0)
  if (!sum) return null
  let r = rnd() * sum
  const hit = list.find(x => (r -= x.w) <= 0) || list[list.length - 1]
  const ev = hit.t.make(s, c, rnd)
  if (!ev) return null
  return { idea: hit.t.id, ...ev, apply: ev.apply || null, applyOn: !!ev.apply && !ev.applyOff }
}

// подпись последствий: «Еда (Овощи) +40 · мораль −2»
const STAT_LABEL = { morale: 'мораль', stability: 'стабильность', threat: 'угрозы' }
export function applyText(apply) {
  if (!apply) return ''
  return [
    ...(apply.damage || []).map(d => `«${d.name || 'постройка'}»: ${DAMAGE[d.level]?.short || ''} повреждение`),
    ...Object.entries(apply.stock || {}).map(([k, v]) => `${RES[k]?.label || k} ${fmt(v)}`),
    ...Object.entries(apply.stats || {}).map(([k, v]) => `${STAT_LABEL[k] || k} ${fmt(v)}`)
  ].join(' · ')
}
