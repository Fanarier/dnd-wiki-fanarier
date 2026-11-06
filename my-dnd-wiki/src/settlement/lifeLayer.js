// Слой жизни на карте поселения: жители ходят, работают, болтают; сумерки, ночь и огни в окнах.
// Рисуем на отдельном холсте поверх карты; положение жителей — из life.js по часам поселения.
import { buildCast, dayPlans, personAt, lineNow } from '../shared/life.js'
import { clockMin, darkness, DAY_MIN } from '../shared/clock.js'
import { RACE_COLORS } from './armyFaces.js'

// одежда по работе — чтобы издалека было видно, кто чем занят
const CLOTH = {
  lumberjack: '#a8432f', hunter: '#4f6b35', gatherer: '#7e8f3a', farmer: '#c9a24f', guard: '#8995a3', builder: '#d9893a', miner: '#7d7466',
  watercarrier: '#5fa8e0', innkeeper: '#8e5a8a', trader: '#c99248', smith: '#55504a', locksmith: '#6a6f78', healer: '#e8e4da', outpost: '#6b5a3a',
  mechanic: '#4d5560', poultry: '#b8a06a', storekeeper: '#7a6a8f', septic: '#6b6450', free: '#9b8c74'
}
const CARRY = { log: '#7a4f2a', bucket: '#5f8fbf', basket: '#b08150', meat: '#c0392b' }
const TOOLS = { chop: 1, build: 1, mine: 1, farm: 1, patrol: 0, gather: 0 }
const EARS = { fenris: 'wolf', neko: 'cat', kitsune: 'fox' }

export function createLifeLayer(canvas, get) {
  const ctx = canvas.getContext('2d')
  let raf = 0, last = [], running = false, lastDraw = 0
  const byIdCache = { cast: null, map: null }
  const peopleById = cast => {
    if (byIdCache.cast !== cast) { byIdCache.cast = cast; byIdCache.map = Object.fromEntries(cast.people.map(p => [p.id, p])) }
    return byIdCache.map
  }

  function frame() {
    raf = 0
    if (!running) return
    const st = get()
    const now = performance.now()
    // жителей не видно — достаточно редко перерисовывать сумерки
    const slow = !st || st.view.k < 0.55
    if (!slow || now - lastDraw > 400) { draw(st, now); lastDraw = now }
    raf = requestAnimationFrame(frame)
  }
  function draw(st, rt) {
    const dpr = window.devicePixelRatio || 1
    const W = st?.size.w || 0, H = st?.size.h || 0
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr) }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, W, H)
    last = []
    if (!st?.s || !W) return
    const { s, view } = st
    const t = clockMin(s, Date.now() + (st.offset || 0))
    const day = Math.floor(t / DAY_MIN), tod = t - day * DAY_MIN
    const cast = buildCast(s)
    const plans = dayPlans(cast, day)
    const k = view.k
    const sx = x => view.x + x * k, sy = y => view.y + y * k
    // сумерки и ночь
    const dk = darkness(tod)
    if (dk > 0.01) {
      ctx.fillStyle = `rgba(12, 16, 44, ${dk * 0.62})`
      ctx.fillRect(0, 0, W, H)
      // огни в окнах жилья и таверны
      if (dk > 0.15) {
        for (const pl of cast.places) {
          const lit = pl.type === 'tavern' ? 1 : (pl.t.housing || pl.type === 'elder') ? 0.7 : 0
          if (!lit || !pl.built) continue
          const x = sx(pl.x), y = sy(pl.y), rad = Math.max(pl.h * k * 1.1, 7)
          if (x < -rad || y < -rad || x > W + rad || y > H + rad) continue
          // ближе к полуночи окна гаснут, таверна — последней
          const late = tod > 23 * 60 || tod < 5 * 60 ? (pl.type === 'tavern' ? 0.7 : 0.45) : 1
          const g = ctx.createRadialGradient(x, y, 0, x, y, rad)
          g.addColorStop(0, `rgba(255, 196, 110, ${0.8 * dk * lit * late})`)
          g.addColorStop(1, 'rgba(255, 170, 80, 0)')
          ctx.fillStyle = g
          ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2)
        }
      }
    }
    if (k < 0.55) return
    const ppl = peopleById(cast)
    // радиус «плеч» в пикселях: мультяшно крупнее настоящего, иначе издалека — пылинки
    const r0 = Math.min(16, Math.max(4, 0.8 * k))
    const bubbles = []
    for (const p of cast.people) {
      if (p.away) continue
      const pos = personAt(plans[p.id], tod)
      if (!pos || pos.hidden) continue
      let x = sx(pos.x), y = sy(pos.y)
      if (x < -40 || y < -40 || x > W + 40 || y > H + 40) continue
      const r = p.kid ? r0 * 0.72 : r0
      const ph = (p.id.charCodeAt(p.id.length - 1) * 37) % 100
      if (pos.moving) y += Math.sin(rt / 90 + ph) * r * 0.12
      // стоя тоже живые: переминаются, поворачиваются
      else if (!pos.talk) { x += Math.sin(rt / 1300 + ph) * r * 0.3; y += Math.cos(rt / 1700 + ph * 1.7) * r * 0.22; pos.dir = (pos.dir ?? 0) + Math.sin(rt / 2100 + ph) * 0.8 }
      // дозор ночью — с факелом
      if (pos.act === 'patrol' && dk > 0.3) {
        const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(8 * k, 14))
        g.addColorStop(0, `rgba(255, 180, 90, ${0.5 * dk})`)
        g.addColorStop(1, 'rgba(255, 150, 60, 0)')
        ctx.fillStyle = g
        ctx.fillRect(x - 60, y - 60, 120, 120)
      }
      drawPerson(ctx, p, pos, x, y, r, rt, ph, st.selected === p.id)
      last.push({ id: p.id, x, y, r })
      if (pos.talk && k >= 2.2) {
        const line = lineNow(cast, pos.talk, tod, ppl)
        if (line?.who?.id === p.id) bubbles.push({ x, y: y - r * 2.2, text: line.text })
      }
      if (k >= 9) label(ctx, p.name.split(' ')[0], x, y + r * 2.4)
    }
    for (const b of bubbles.slice(0, 16)) bubble(ctx, b.x, b.y, b.text)
  }

  return {
    start() { if (!running) { running = true; raf = requestAnimationFrame(frame) } },
    stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0 },
    redraw() { lastDraw = 0 },
    // кто под курсором (экранные координаты холста)
    hit(x, y) {
      let best = null, bd = Infinity
      for (const q of last) {
        const d = Math.hypot(q.x - x, q.y - y)
        if (d < Math.max(q.r + 4, 9) && d < bd) { bd = d; best = q.id }
      }
      return best
    }
  }
}

function drawPerson(ctx, p, pos, x, y, r, rt, ph, sel) {
  const dir = pos.dir ?? (ph / 100) * Math.PI * 2
  const skin = RACE_COLORS[p.race] || '#e8b98f'
  const cloth = CLOTH[p.job] || CLOTH.free
  // тень
  ctx.fillStyle = 'rgba(0, 0, 0, .28)'
  ctx.beginPath(); ctx.ellipse(x + r * 0.35, y + r * 0.45, r * 1.1, r * 0.8, 0, 0, Math.PI * 2); ctx.fill()
  if (sel) { ctx.strokeStyle = '#f3d99a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r * 2, 0, Math.PI * 2); ctx.stroke() }
  ctx.lineWidth = Math.max(0.8, r * 0.18)
  ctx.strokeStyle = 'rgba(25, 18, 10, .65)'
  // кентавр: конский корпус вдоль хода
  if (p.race === 'centaur' && !p.kid) {
    ctx.fillStyle = '#8a5a2c'
    ctx.beginPath(); ctx.ellipse(x - Math.cos(dir) * r * 0.9, y - Math.sin(dir) * r * 0.9, r * 1.5, r * 0.75, dir, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
  }
  // в руках: бревно, ведро, корзина, добыча
  if (pos.carry) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(dir + Math.PI / 2)
    ctx.fillStyle = CARRY[pos.carry] || '#888'
    if (pos.carry === 'log') { ctx.fillRect(-r * 1.6, -r * 1.25, r * 3.2, r * 0.6); ctx.strokeRect(-r * 1.6, -r * 1.25, r * 3.2, r * 0.6) } else { ctx.beginPath(); ctx.arc(r * 1.05, 0, r * 0.45, 0, Math.PI * 2); ctx.fill(); ctx.stroke() }
    ctx.restore()
  }
  // инструмент в работе: топор, молот, мотыга, кирка — машет
  if (TOOLS[pos.act] && r >= 3) {
    const sw = Math.sin(rt / 160 + ph) * 0.9
    const a = dir + 0.6 + sw
    ctx.strokeStyle = '#3a2a18'; ctx.lineWidth = Math.max(1, r * 0.22)
    ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8); ctx.lineTo(x + Math.cos(a) * r * 2.1, y + Math.sin(a) * r * 2.1); ctx.stroke()
    ctx.fillStyle = '#9aa0a8'
    ctx.beginPath(); ctx.arc(x + Math.cos(a) * r * 2.1, y + Math.sin(a) * r * 2.1, r * 0.35, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = 'rgba(25, 18, 10, .65)'; ctx.lineWidth = Math.max(0.8, r * 0.18)
  }
  // плечи (одежда) и голова (цвет расы)
  ctx.fillStyle = cloth
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
  ctx.fillStyle = skin
  ctx.beginPath(); ctx.arc(x + Math.cos(dir) * r * 0.15, y + Math.sin(dir) * r * 0.15, r * 0.58, 0, Math.PI * 2); ctx.fill()
  // уши у зверолюдей
  const ear = EARS[p.race]
  if (ear && r >= 3) {
    ctx.fillStyle = ear === 'fox' ? '#e8833a' : ear === 'cat' ? '#f6b3cf' : '#a9865f'
    for (const sd of [-1, 1]) {
      const a = dir + sd * 0.9
      const bx = x + Math.cos(a) * r * 0.55, by = y + Math.sin(a) * r * 0.55
      ctx.beginPath(); ctx.moveTo(bx + Math.cos(a) * r * 0.55, by + Math.sin(a) * r * 0.55)
      ctx.lineTo(bx + Math.cos(a + 1.3) * r * 0.25, by + Math.sin(a + 1.3) * r * 0.25); ctx.lineTo(bx + Math.cos(a - 1.3) * r * 0.25, by + Math.sin(a - 1.3) * r * 0.25); ctx.fill()
    }
  }
}
function bubble(ctx, x, y, text) {
  const t = text.length > 46 ? text.slice(0, 44) + '…' : text
  ctx.font = '600 11px Manrope, sans-serif'
  const w = ctx.measureText(t).width + 12, h = 20
  const bx = x - w / 2, by = y - h
  ctx.fillStyle = 'rgba(253, 248, 236, .95)'
  ctx.strokeStyle = 'rgba(60, 44, 20, .7)'; ctx.lineWidth = 1
  ctx.beginPath()
  ctx.roundRect ? ctx.roundRect(bx, by, w, h, 8) : ctx.rect(bx, by, w, h)
  ctx.moveTo(x - 4, by + h); ctx.lineTo(x, by + h + 5); ctx.lineTo(x + 4, by + h)
  ctx.fill(); ctx.stroke()
  ctx.fillStyle = '#2a1f10'
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(t, x, by + h / 2 + 0.5)
}
function label(ctx, text, x, y) {
  ctx.font = '700 10px Manrope, sans-serif'
  ctx.textAlign = 'center'; ctx.textBaseline = 'top'
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(20, 14, 6, .75)'; ctx.strokeText(text, x, y)
  ctx.fillStyle = '#f3e7c8'; ctx.fillText(text, x, y)
}
