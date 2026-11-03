// Генератор событий поселения: сайт смотрит на положение дел и предлагает мастеру событие.
// Мастер правит текст и выпускает его в журнал (последствия применяются, если он оставил галочку) или отбрасывает.
// Общий для сервера и клиента.
import { RES, RACES, OUTPOSTS, BUILDINGS, DAMAGE, DAMAGE_ORDER, URGENT_DAYS, computeSettlement, tierLabel } from './settlement.js'
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
const bName = b => b.name || tierLabel(b)
const living = s => (s.races || []).filter(r => (r.male || 0) + (r.female || 0) > 0)
// у кого из построек этого вида есть шанс (поле ev уровня)
const withEv = (s, key) => (s.buildings || []).filter(b => (b.state || 'built') === 'built' && b.damage !== 'ruined' && BUILDINGS[b.type]?.tiers?.[(b.level || 1) - 1]?.ev?.[key])

// дней до нуля для ресурсов, которые уходят в минус
function runningOut(s, c) {
  return Object.entries(c.balance)
    .filter(([, b]) => b < 0)
    .map(([k, b]) => ({ res: k, days: Math.floor((s.stock?.[k] || 0) / -b) }))
    .sort((a, b) => a.days - b.days)
}

/* Каждый шаблон: weight(s, c) — насколько уместен сейчас (0 — не подходит), make(...) — текст и последствия.
   mood — good / bad / neutral; origin — inside (в поселении), outside (извне), random (случай, ни от чего не зависит);
   threat — угроза (извне: чем ближе угроза к −100, тем реже; изнутри — только при угрозе выше нуля).
   apply: { stock: { ресурс: ± }, stats: { morale|stability|threat: ± }, damage: [{ id, level }], people: { раса: { kids|male|female: ± } } } —
   что поменяется, если выпустить с последствиями. Срочное (duration urgent): days — сколько дней на решение,
   worse: { title, text, apply } — что будет, если не решить вовремя. */
export const EVENT_IDEAS = [
  {
    id: 'raid', label: 'Набег', mood: 'bad', origin: 'outside', threat: true,
    weight: (s, c) => (c.threat >= 25 ? 1 + c.threat / 30 : 0.15),
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
        title: `${foe} прорвались`, type: 'alarm', duration: ['urgent'], days: 2,
        text: `${foe} прорвались за ограду и ${beast ? 'разорили кладовые' : 'растащили часть запасов'}, пока стража стягивалась.${b ? ` Досталось и «${bName(b)}».` : ''} Сила набега ${power} против защиты ${def}. Как ответим? Медлить нельзя — вернутся.`,
        effect: `${RES[res].label} −${loss}, мораль −5, стабильность −3${b ? `, «${bName(b)}»: ${DAMAGE[level].short} повреждение` : ''}`,
        apply: { stock: { [res]: -loss }, stats: { morale: -5, stability: -3 }, ...(b ? { damage: [{ id: b.id, level, name: bName(b) }] } : {}) },
        worse: { title: `${foe} вернулись`, text: `Ответа так и не было — ${foe.toLowerCase()} вернулись за остальным и унесли ещё.`, apply: { stock: { [res]: -loss }, stats: { morale: -4, threat: 8 } } }
      }
    }
  },
  {
    id: 'caravan', label: 'Караван', mood: 'good', origin: 'outside',
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
    id: 'running-out', label: 'Запасы на исходе', mood: 'bad', origin: 'inside',
    weight: (s, c) => (runningOut(s, c).some(r => r.days <= 3) ? 2.5 : 0),
    make(s, c) {
      const r = runningOut(s, c).find(x => x.days <= 3)
      return {
        title: `На исходе: «${RES[r.res].label}»`, type: 'problem', duration: ['urgent'], days: Math.max(1, r.days),
        text: `Кладовщики бьют тревогу: запаса «${RES[r.res].label}» осталось ${r.days ? `на ${r.days} ${plural(r.days, 'день', 'дня', 'дней')}` : 'на донышке'}, а тратим больше, чем добываем (${c.balance[r.res]}/день). Что будем делать?`,
        effect: `${RES[r.res].label}: ${c.balance[r.res]}/день`,
        worse: { title: `Кончилось: «${RES[r.res].label}»`, text: 'Запас кончился, а решения так и не было. Люди злятся.', apply: { stats: { morale: -5, stability: -3 } } }
      }
    }
  },
  {
    id: 'sickness', label: 'Болезнь', mood: 'bad', origin: 'inside',
    weight: (s, c) => ((c.jobs.healer?.workers || 0) === 0 ? 1.5 : 0.4) + (c.balance.drink < 0 ? 1 : 0),
    make(s, c, rnd) {
      const what = pick(rnd, ['лихорадка', 'кашель с кровью', 'кишечная хворь', 'болотная трясуха'])
      const sick = between(rnd, 3, 9)
      const healers = c.jobs.healer?.workers || 0
      return {
        title: 'Хворь в поселении', type: 'problem', duration: ['urgent'], days: 3,
        text: `По домам пошла ${what}: ${plural(sick, 'слёг', 'слегли', 'слегли')} ${sick} ${plural(sick, 'житель', 'жителя', 'жителей')}.${healers ? ` Целители (${healers}) просят травы и время.` : ' Лечить некому — целителей нет.'} Как поступим?`,
        effect: `Больных ${sick}. Мораль −3${healers ? ', травы −' + sick * 2 : ''}`,
        apply: { stats: { morale: -3 }, ...(healers ? { stock: { herbs: -sick * 2 } } : {}) },
        worse: { title: 'Хворь расходится', text: `${what[0].toUpperCase() + what.slice(1)} пошла дальше по домам — слегли новые.`, apply: { stats: { morale: -4, stability: -2 } } }
      }
    }
  },
  {
    id: 'forest-find', label: 'Находка в лесу', mood: 'good', origin: 'random',
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
    id: 'harvest', label: 'Урожай', mood: 'neutral', origin: 'random',
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
    id: 'fire', label: 'Пожар', mood: 'bad', origin: 'random',
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
    id: 'storm', label: 'Буря', mood: 'bad', origin: 'random',
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
    id: 'refugees', label: 'Беженцы', mood: 'neutral', origin: 'outside',
    weight: (s, c) => (c.housing.cap - c.housing.used >= 4 ? 1.1 : 0.3),
    make(s, c, rnd) {
      const race = pick(rnd, Object.keys(RACES))
      const n = between(rnd, 3, 9)
      const room = c.housing.cap - c.housing.used
      return {
        title: 'Беженцы просят приюта', type: 'important', duration: ['decide'],
        text: `К воротам пришли ${n} ${plural(n, 'беженец', 'беженца', 'беженцев')} (${RACES[race].label}) — их деревню сожгли. Говорит за всех ${makeName(race, null, rnd)}. Свободного жилья: ${room}. Примем?`,
        effect: `Если принять: +${n} ${plural(n, 'житель', 'жителя', 'жителей')} (${RACES[race].label}), больше ртов`,
        apply: { people: { [race]: { male: Math.ceil(n / 2), female: Math.floor(n / 2) } } }, applyOff: true
      }
    }
  },
  {
    id: 'festival', label: 'Праздник', mood: 'good', origin: 'inside',
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
    id: 'theft', label: 'Кража со склада', mood: 'bad', origin: 'inside',
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
    id: 'crowded', label: 'Тесно', mood: 'bad', origin: 'inside',
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
    id: 'unrest', label: 'Недовольство', mood: 'bad', origin: 'inside',
    weight: (s, c) => (c.morale < 20 ? 2 : 0),
    make(s, c) {
      return {
        title: 'Ропот на площади', type: 'alarm', duration: ['urgent'], days: 2,
        text: `Мораль упала до ${c.morale}. На площади собираются недовольные и требуют главу.`,
        effect: 'Стабильность −4', apply: { stats: { stability: -4 } },
        worse: { title: 'Бунт на площади', text: 'Глава не вышел к людям — толпа разбила лавки и подожгла сарай.', apply: { stats: { stability: -8, morale: -3 } } }
      }
    }
  },
  {
    id: 'quarrel', label: 'Ссора рас', mood: 'bad', origin: 'inside',
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
    id: 'outpost', label: 'Аванпост', mood: 'neutral', origin: 'inside',
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
    id: 'wanderer', label: 'Путник', mood: 'neutral', origin: 'random',
    weight: (s, c) => (c.guests.cap > 0 ? 0.8 : 0.3),
    make(s, c, rnd) {
      // кто пришёл и как его зовут (имя — по расе)
      const [kind, race, g] = pick(rnd, [['бродячий бард', 'human', 'm'], ['усталый паломник', 'human', 'm'], ['наёмник без нанимателя', 'fenris', 'm'], ['кентавр-картограф', 'centaur', 'm'], ['молчаливая эльфийка в капюшоне', 'highelf', 'f'], ['кицунэ-гадалка', 'kitsune', 'f']])
      const who = `${kind} — ${makeName(race, g, rnd)},`
      const rumor = pick(rnd, ['в старой шахте на севере кто-то зажигает огни', 'на тракте видели королевских сборщиков податей', 'в горах проснулось что-то большое', 'соседняя деревня ищет союзников против разбойников'])
      return { title: 'Путник в таверне', type: 'message', duration: ['quick'], text: `В таверне ${g === 'f' ? 'остановилась' : 'остановился'} ${who} и за кружкой ${g === 'f' ? 'рассказала' : 'рассказал'}, что ${rumor}.`, effect: '' }
    }
  },

  /* ---------- угрозы извне ---------- */
  {
    id: 'beasts-outpost', label: 'Звери у аванпоста', mood: 'bad', origin: 'outside', threat: true,
    weight: s => ((s.outposts || []).some(o => o.state !== 'closed' && o.workers) ? 0.6 : 0),
    make(s, c, rnd) {
      const o = pick(rnd, s.outposts.filter(x => x.state !== 'closed' && x.workers))
      const beast = pick(rnd, ['стая варгов', 'пещерный медведь', 'выводок ядовитых пауков', 'одичавшие кабаны'])
      return {
        title: 'Звери у аванпоста', type: 'threat', duration: ['urgent'], days: 2,
        text: `На аванпосте «${OUTPOSTS[o.type]?.label || 'аванпост'}» объявилась ${beast}. Рабочие заперлись и шлют гонцов: нужна помощь, иначе работа встанет.`,
        effect: 'Мораль −2, угрозы +3', apply: { stats: { morale: -2, threat: 3 } },
        worse: { title: 'Аванпост в осаде', text: `Помощь не пришла — ${beast} загнала рабочих в шахту, двое ранены.`, apply: { stats: { morale: -4, threat: 6, stability: -2 } } }
      }
    }
  },
  {
    id: 'bandit-toll', label: 'Разбойничья застава', mood: 'bad', origin: 'outside', threat: true,
    weight: (s, c) => (c.trade.cap ? 0.5 : 0.25),
    make(s, c, rnd) {
      const n = between(rnd, 15, 45)
      return {
        title: 'Разбойники на тракте', type: 'threat', duration: ['urgent'], days: 3,
        text: `На тракте выросла разбойничья застава — берут «пошлину» с каждой повозки. Купцы ворчат и обходят нас стороной. Платим, гоним или договариваемся?`,
        effect: `Товары −${n}, торговля встала`, apply: { stock: { goods: -n } },
        worse: { title: 'Разбойники обнаглели', text: 'Застава стоит, а разбойники уже грабят наших собирателей у самой опушки.', apply: { stock: { goods: -n }, stats: { threat: 6, morale: -2 } } }
      }
    }
  },
  {
    id: 'monster', label: 'Чудище в округе', mood: 'bad', origin: 'outside', threat: true,
    weight: (s, c) => 0.25 + Math.max(0, c.threat) / 80,
    make(s, c, rnd) {
      const [what, where] = pick(rnd, [['огромный тролль', 'у старого моста'], ['мантикора', 'над каменоломней'], ['болотная тварь', 'в низине у реки'], ['стая гарпий', 'на скалах за полями']])
      return {
        title: 'Чудище в округе', type: 'threat', duration: ['urgent'], days: 3,
        text: `Охотники видели: ${what} ${where}. Пока не нападало, но люди боятся выходить за частокол.`,
        effect: 'Угрозы +5, мораль −2', apply: { stats: { threat: 5, morale: -2 } },
        worse: { title: 'Чудище напало', text: `${what[0].toUpperCase() + what.slice(1)} вышло к домам ночью и разнесло изгородь.`, apply: { stats: { threat: 5, morale: -4, stability: -2 } } }
      }
    }
  },
  {
    id: 'tax', label: 'Сборщики податей', mood: 'neutral', origin: 'outside',
    weight: (s, c) => ((s.stock?.goods || 0) + (s.stock?.gold || 0) > 30 ? 0.4 : 0),
    make(s, c, rnd) {
      const res = (s.stock?.gold || 0) >= 20 ? 'gold' : 'goods'
      const n = Math.max(5, Math.round((s.stock?.[res] || 0) * (0.1 + rnd() * 0.15)))
      return {
        title: 'Сборщики податей', type: 'important', duration: ['decide'],
        text: `К воротам подъехали королевские сборщики с грамотой. Требуют подать: «${RES[res].label}» ${n}. Заплатим, поторгуемся или укажем на дверь?`,
        effect: `Если заплатить: ${RES[res].label} −${n}`, apply: { stock: { [res]: -n } }, applyOff: true
      }
    }
  },
  {
    id: 'deserters', label: 'Беглые солдаты', mood: 'neutral', origin: 'outside',
    weight: (s, c) => (c.housing.cap - c.housing.used >= 2 ? 0.35 : 0),
    make(s, c, rnd) {
      const race = pick(rnd, ['human', 'fenris', 'centaur'])
      const n = between(rnd, 2, 4)
      return {
        title: 'Беглые солдаты', type: 'important', duration: ['decide'],
        text: `${n} беглых солдат (${RACES[race].label}) просятся в поселение — готовы служить в страже за кров и еду. За ними может прийти погоня.`,
        effect: `Если принять: +${n} жителей (${RACES[race].label}), угрозы +3`,
        apply: { people: { [race]: { male: n } }, stats: { threat: 3 } }, applyOff: true
      }
    }
  },

  /* ---------- угрозы изнутри — только когда угроза выше нуля ---------- */
  {
    id: 'cult', label: 'Тайный культ', mood: 'bad', origin: 'inside', threat: true,
    weight: (s, c) => (c.threat > 0 ? 0.3 + c.threat / 100 : 0),
    make(s, c, rnd) {
      const god = pick(rnd, ['Безликому', 'Пожирателю Луны', 'Чёрной Матери', 'Спящему под холмом'])
      return {
        title: 'Тайный культ', type: 'threat', duration: ['urgent'], days: 3,
        text: `Ночами в старом амбаре кто-то молится ${god}. Нашли знаки на дверях и мёртвую курицу. Соседи шепчутся.`,
        effect: 'Стабильность −3', apply: { stats: { stability: -3 } },
        worse: { title: 'Культ набирает силу', text: 'Знаков стало больше, а пропала уже не курица, а ребёнок пастуха — его ищут всем поселением.', apply: { stats: { stability: -6, morale: -4, threat: 4 } } }
      }
    }
  },
  {
    id: 'sabotage', label: 'Вредительство', mood: 'bad', origin: 'inside', threat: true,
    weight: (s, c) => (c.threat > 10 ? 0.3 : 0),
    make(s, c, rnd) {
      const b = victim(s, rnd, ['steampump', 'boiler', 'mill', 'forge', 'well'])
      if (!b) return null
      return {
        title: 'Вредительство', type: 'alarm', duration: ['decide'],
        text: `Утром «${bName(b)}» нашли сломанной — кто-то ночью поработал ломом. Чужак или свой?`,
        effect: `«${bName(b)}»: малое повреждение, стабильность −2`,
        apply: { stats: { stability: -2 }, damage: [{ id: b.id, level: hurt(b, 'minor'), name: bName(b) }] }
      }
    }
  },

  /* ---------- дома и семьи: чем больше домов, тем чаще (без домов — никогда) ---------- */
  {
    id: 'birth', label: 'Прибавление в семье', mood: 'good', origin: 'inside',
    weight: (s, c) => (c.ev.family || 0) * 0.06,
    make(s, c, rnd) {
      const live = living(s)
      if (!live.length) return null
      const r = pick(rnd, live)
      const twins = rnd() < 0.15
      return {
        title: twins ? 'Двойня!' : 'Прибавление в семье', type: 'approve', duration: ['quick'],
        text: `В семье ${RACES[r.race]?.label.toLowerCase() || ''} ${twins ? 'родилась двойня' : 'родился малыш'}. Соседи несут пелёнки и пироги.`,
        effect: `${RACES[r.race]?.label}: дети +${twins ? 2 : 1}, мораль +1`,
        apply: { people: { [r.race]: { kids: twins ? 2 : 1 } }, stats: { morale: 1 } }
      }
    }
  },
  {
    id: 'wedding', label: 'Свадьба', mood: 'good', origin: 'inside',
    weight: (s, c) => (c.ev.family || 0) * 0.04,
    make(s, c, rnd) {
      const live = living(s)
      if (!live.length) return null
      const a = pick(rnd, live), b = pick(rnd, live)
      const n = between(rnd, 10, 25)
      return {
        title: 'Свадьба', type: 'approve', duration: ['quick'],
        text: a === b ? `Сыграли свадьбу — ${RACES[a.race]?.label.toLowerCase()} гуляли три дня.` : `Сыграли свадьбу: ${RACES[a.race]?.label.toLowerCase()} и ${RACES[b.race]?.label.toLowerCase()} теперь одна семья. Всё поселение гуляло.`,
        effect: `Мораль +3, стабильность +1, Еда (Фрукты) −${n}`, apply: { stats: { morale: 3, stability: 1 }, stock: { fruit: -n } }
      }
    }
  },
  {
    id: 'neighbors', label: 'Соседская помощь', mood: 'good', origin: 'inside',
    weight: (s, c) => (c.ev.family || 0) * 0.03,
    make(s, c, rnd) {
      const what = pick(rnd, ['всей улицей перекрыли крышу вдове', 'соседи вместе вырыли новый погреб', 'дома сложились и купили общую корову'])
      return { title: 'Соседская помощь', type: 'approve', duration: ['quick'], text: `Жители ${what}. Говорят, в Урюпинске своих не бросают.`, effect: 'Стабильность +2', apply: { stats: { stability: 2 } } }
    }
  },

  /* ---------- общаги: чем больше общаг (и чем они проще), тем чаще ---------- */
  {
    id: 'dorm-brawl', label: 'Драка в общаге', mood: 'bad', origin: 'inside',
    weight: (s, c) => (c.ev.dorm || 0) * 0.18,
    make(s, c, rnd) {
      const live = living(s)
      const a = pick(rnd, live), b = pick(rnd, live.length > 1 ? live.filter(r => r !== a) : live)
      const where = bName(pick(rnd, withEv(s, 'dorm')) || { type: 'dorm' })
      return {
        title: 'Драка в общаге', type: 'problem', duration: ['decide'],
        text: `В «${where}» ${a === b ? 'две семьи' : `${RACES[a.race]?.label.toLowerCase()} и ${RACES[b.race]?.label.toLowerCase()}`} не поделили угол и устроили драку. Пострадавшие есть, обиды — тоже.`,
        effect: 'Стабильность −2, мораль −1', apply: { stats: { stability: -2, morale: -1 } }
      }
    }
  },
  {
    id: 'dorm-theft', label: 'Воровство в общаге', mood: 'bad', origin: 'inside',
    weight: (s, c) => (c.ev.dorm || 0) * 0.1,
    make(s, c, rnd) {
      const n = between(rnd, 3, 12)
      return { title: 'Воровство по койкам', type: 'problem', duration: ['decide'], text: 'В общаге пропадают вещи из-под подушек. Подозревают новеньких.', effect: `Товары −${n}, стабильность −1`, apply: { stock: { goods: -n }, stats: { stability: -1 } } }
    }
  },
  {
    id: 'dorm-sick', label: 'Зараза в общаге', mood: 'bad', origin: 'inside',
    weight: (s, c) => (c.ev.dorm || 0) * 0.08,
    make(s, c, rnd) {
      const n = between(rnd, 2, 6)
      return {
        title: 'Зараза в общаге', type: 'problem', duration: ['urgent'], days: 2,
        text: `В тесноте общаги пошла простуда: кашляют ${n} ${plural(n, 'жилец', 'жильца', 'жильцов')}. Если не развести по домам и не лечить — свалит всех.`,
        effect: `Мораль −2, травы −${n}`, apply: { stats: { morale: -2 }, stock: { herbs: -n } },
        worse: { title: 'Общага слегла', text: 'Простуда прошлась по всем койкам — работать некому.', apply: { stats: { morale: -4, stability: -2 } } }
      }
    }
  },

  /* ---------- постройки: поломки и находки ---------- */
  {
    id: 'pump-break', label: 'Поломка насоса', mood: 'bad', origin: 'random',
    weight: (s, c) => (c.ev.breakdown || 0) * 0.12,
    make(s, c, rnd) {
      const b = pick(rnd, withEv(s, 'breakdown'))
      if (!b) return null
      const n = between(rnd, 3, 10)
      return {
        title: 'Насос встал', type: 'problem', duration: ['urgent'], days: 2,
        text: `«${bName(b)}» закашлял паром и встал — лопнула прокладка. Механики просят детали на починку.`,
        effect: `Простые детали −${n}, «${bName(b)}»: малое повреждение`,
        apply: { stock: { parts: -n }, damage: [{ id: b.id, level: hurt(b, 'minor'), name: bName(b) }] },
        worse: { title: 'Насос разорвало', text: `Починки не дождались — «${bName(b)}» разорвало давлением.`, apply: { damage: [{ id: b.id, level: hurt(b, 'medium'), name: bName(b) }], stats: { morale: -1 } } }
      }
    }
  },
  {
    id: 'mineral', label: 'Минеральная вода', mood: 'good', origin: 'random',
    weight: (s, c) => (c.ev.mineral || 0) * 0.15,
    make(s, c, rnd) {
      const n = between(rnd, 10, 30)
      return { title: 'Минеральная вода', type: 'approve', duration: ['quick'], text: 'Из артезианской скважины пошла вода с кислинкой и пузырьками — купцы готовы брать бочками.', effect: `Товары +${n}`, apply: { stock: { goods: n } } }
    }
  },
  {
    id: 'soil', label: 'Чернозём', mood: 'good', origin: 'random',
    weight: (s, c) => (c.ev.soil || 0) * 0.2,
    make(s, c, rnd) {
      const n = between(rnd, 10, 40)
      return { title: 'Пласт чернозёма', type: 'approve', duration: ['quick'], text: 'Шахтёры вскрыли жирный пласт чернозёма — фермеры уже выстроились с тачками.', effect: `Чернозём +${n}`, apply: { stock: { soil: n } } }
    }
  },
  {
    id: 'medicine', label: 'Лекарства знахаря', mood: 'good', origin: 'random',
    weight: (s, c) => (c.ev.medicine || 0) * 0.25,
    make(s, c, rnd) {
      const n = between(rnd, 3, 10)
      return { title: 'Знахарь сварил лекарства', type: 'approve', duration: ['quick'], text: 'В обители знахаря наварили целебных настоек из лесных трав.', effect: `Лекарства +${n}`, apply: { stock: { medicine: n } } }
    }
  },

  /* ---------- случай: ни от чего не зависит, держит в тонусе ---------- */
  {
    id: 'rats', label: 'Крысы', mood: 'bad', origin: 'random',
    weight: (s, c) => ((s.stock?.veg || 0) > 100 ? 0.35 : 0),
    make(s, c, rnd) {
      const n = Math.max(10, Math.round((s.stock?.veg || 0) * (0.05 + rnd() * 0.08)))
      return {
        title: 'Крысы в амбаре', type: 'problem', duration: ['urgent'], days: 2,
        text: 'В амбаре завелись крысы — мешки прогрызены, зерно по полу. Нужны кошки, ловушки или отрава.',
        effect: `Еда (Овощи) −${n}`, apply: { stock: { veg: -n } },
        worse: { title: 'Крысы расплодились', text: 'Крыс стало вдвое больше, а кто-то уже слёг с крысиной лихорадкой.', apply: { stock: { veg: -n }, stats: { morale: -2 } } }
      }
    }
  },
  {
    id: 'drought', label: 'Засуха', mood: 'bad', origin: 'random',
    weight: () => 0.2,
    make(s, c, rnd) {
      const n = between(rnd, 30, 90)
      return { title: 'Засуха', type: 'problem', duration: ['quick'], text: 'Неделю ни капли дождя — поля поливают из колодцев, вода уходит.', effect: `Питьевая вода −${n}, вода −${n}`, apply: { stock: { drink: -n, water: -n } } }
    }
  },
  {
    id: 'good-weather', label: 'Ясные дни', mood: 'good', origin: 'random',
    weight: () => 0.25,
    make(s, c, rnd) {
      const [res, a, b] = pick(rnd, [['veg', 20, 60], ['fruit', 15, 40], ['wood', 20, 50]])
      const n = between(rnd, a, b)
      return { title: 'Ясные дни', type: 'approve', duration: ['quick'], text: 'Стоят тёплые ясные дни — работа спорится, на лицах улыбки.', effect: `${RES[res].label} +${n}, мораль +1`, apply: { stock: { [res]: n }, stats: { morale: 1 } } }
    }
  },
  {
    id: 'craftsman', label: 'Мастер просится', mood: 'good', origin: 'random',
    weight: (s, c) => (c.housing.cap > c.housing.used ? 0.2 : 0),
    make(s, c, rnd) {
      const [race, g, craft] = pick(rnd, [['human', 'm', 'кузнец'], ['highelf', 'f', 'травница'], ['kitsune', 'f', 'ткачиха'], ['hobgoblin', 'm', 'плотник']])
      return {
        title: 'Мастер просится в поселение', type: 'important', duration: ['decide'],
        text: `${craft[0].toUpperCase() + craft.slice(1)} ${makeName(race, g, rnd)} (${RACES[race].label}) услышал${g === 'f' ? 'а' : ''} о нас и просит места. Руки золотые, характер — посмотрим.`,
        effect: `Если принять: +1 житель (${RACES[race].label})`, apply: { people: { [race]: { [g === 'f' ? 'female' : 'male']: 1 } } }, applyOff: true
      }
    }
  }
]

/* как настроение поселения меняет шансы (видит только мастер):
   мораль и стабильность ниже нуля — дурных событий больше, добрых меньше; выше — наоборот, но слабее;
   угрозы извне — от угрозы: у −100 их почти нет, у 100 — вдвое чаще; изнутри — только при угрозе выше нуля */
export function eventOdds(c) {
  const low = Math.max(0, -c.morale) + Math.max(0, -c.stability)
  const high = Math.max(0, c.morale) + Math.max(0, c.stability)
  return {
    bad: Math.round((1 + low / 60) * 100) / 100,
    good: Math.round(Math.max(0.25, 1 - low / 150) * (1 + high / 400) * 100) / 100,
    outside: Math.round(Math.max(0, (c.threat + 100) / 100) * 100) / 100,
    inside: c.threat > 0 ? Math.round((c.threat / 50) * 100) / 100 : 0
  }
}
function oddsFor(t, o) {
  let k = t.mood === 'bad' ? o.bad : t.mood === 'good' ? o.good : 1
  if (t.threat) k *= t.origin === 'outside' ? o.outside : o.inside
  return k
}
// выбрать одно событие по весам; exclude — шаблоны, которые уже ждут мастера
export function suggestEvent(s, rnd = Math.random, exclude = []) {
  const c = computeSettlement(s)
  const o = eventOdds(c)
  const list = EVENT_IDEAS.map(t => ({ t, w: exclude.includes(t.id) ? 0 : Math.max(0, (t.weight(s, c) || 0) * oddsFor(t, o)) })).filter(x => x.w > 0)
  const sum = list.reduce((n, x) => n + x.w, 0)
  if (!sum) return null
  let r = rnd() * sum
  const hit = list.find(x => (r -= x.w) <= 0) || list[list.length - 1]
  const ev = hit.t.make(s, c, rnd)
  if (!ev) return null
  const urgent = ev.duration?.includes('urgent')
  return { idea: hit.t.id, mood: hit.t.mood, origin: hit.t.origin, ...ev, apply: ev.apply || null, applyOn: !!ev.apply && !ev.applyOff, ...(urgent ? { days: ev.days || URGENT_DAYS } : {}) }
}

// подпись последствий: «Еда (Овощи) +40 · мораль −2»
const STAT_LABEL = { morale: 'мораль', stability: 'стабильность', threat: 'угрозы' }
const PEOPLE_LABEL = { male: 'мужчины', female: 'женщины', kids: 'дети' }
export function applyText(apply) {
  if (!apply) return ''
  return [
    ...(apply.damage || []).map(d => `«${d.name || 'постройка'}»: ${DAMAGE[d.level]?.short || ''} повреждение`),
    ...Object.entries(apply.people || {}).flatMap(([r, p]) => Object.entries(p || {}).filter(([, v]) => v).map(([k, v]) => `${RACES[r]?.label || r}: ${PEOPLE_LABEL[k] || k} ${fmt(v)}`)),
    ...Object.entries(apply.stock || {}).map(([k, v]) => `${RES[k]?.label || k} ${fmt(v)}`),
    ...Object.entries(apply.stats || {}).map(([k, v]) => `${STAT_LABEL[k] || k} ${fmt(v)}`)
  ].join(' · ')
}
