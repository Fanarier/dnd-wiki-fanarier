// Местность мини-карты поселения рисуется один раз в картинку (трава, лес, вода, берег, дороги, площадь, скалы) —
// так тысячи деревьев не тормозят при перетаскивании. Поверх неё SVG: постройки, туман, подписи.
import { pointInPoly, footprint, BUILDINGS } from '../shared/settlement.js'

function rng(seed) {
  return () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
}
function segDist(px, py, [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay
  const t = dx || dy ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))) : 0
  return Math.hypot(px - ax - t * dx, py - ay - t * dy)
}
function poly(g, pts) {
  g.beginPath()
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)))
  g.closePath()
}
// сглаженная линия через точки (Catmull-Rom) — дороги без острых углов
function smooth(pts, step = 6) {
  if (pts.length < 3) return pts
  const out = []
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2
    const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step))
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t
      out.push([0, 1].map(d => 0.5 * (2 * p1[d] + (-p0[d] + p2[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3)))
    }
  }
  out.push(pts[pts.length - 1])
  return out
}
function line(g, pts) {
  g.beginPath()
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)))
}
// линия, сдвинутая вбок на off (колеи)
function offsetLine(pts, off) {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1
    return [p[0] - (dy / l) * off, p[1] + (dx / l) * off]
  })
}
// мягкие пятна: маленький холст со случайными цветами, растянутый со сглаживанием
function blotches(g, W, H, cells, colors, alpha, r) {
  const c = document.createElement('canvas')
  c.width = cells
  c.height = Math.ceil((cells * H) / W)
  const x = c.getContext('2d')
  for (let i = 0; i < c.width; i++) for (let j = 0; j < c.height; j++) {
    x.fillStyle = colors[Math.floor(r() * colors.length)]
    x.fillRect(i, j, 1, 1)
  }
  g.save()
  g.globalAlpha = alpha
  g.imageSmoothingEnabled = true
  g.imageSmoothingQuality = 'high'
  g.drawImage(c, 0, 0, W, H)
  g.restore()
}

// scale — во сколько раз картинка крупнее карты (2 — чётко при приближении)
export function paintTerrain(s, scale = 2) {
  const t = s.terrain
  const W = t.w, H = t.h
  const c = document.createElement('canvas')
  c.width = Math.round(W * scale)
  c.height = Math.round(H * scale)
  const g = c.getContext('2d')
  g.scale(scale, scale)
  const r = rng(20261005)
  g.lineJoin = 'round'
  g.lineCap = 'round'

  /* ---------- трава: пятнистая, с цветами ---------- */
  g.fillStyle = '#8bb066'
  g.fillRect(0, 0, W, H)
  blotches(g, W, H, 22, ['#7ea85c', '#93b96b', '#a3c174', '#86ad60', '#9ab86a'], 0.9, r)
  blotches(g, W, H, 90, ['#7aa158', '#98bd6f', '#8fb366', '#a9c77c', '#82a95e'], 0.35, r)
  for (let i = 0; i < W * H / 40; i++) {
    const x = r() * W, y = r() * H, k = r()
    g.fillStyle = k < 0.55 ? 'rgba(66, 104, 48, .35)' : k < 0.9 ? 'rgba(196, 220, 146, .35)' : 'rgba(120, 150, 70, .5)'
    g.fillRect(x, y, 1 + r() * 1.6, 2 + r() * 2.5) // травинки
  }
  const FLOWERS = ['#fff7e6', '#f6e27a', '#f2a8c4', '#c9b8ff']
  for (let i = 0; i < W * H / 900; i++) {
    const x = r() * W, y = r() * H
    g.fillStyle = FLOWERS[Math.floor(r() * FLOWERS.length)]
    g.globalAlpha = 0.75
    g.beginPath(); g.arc(x, y, 0.9 + r() * 0.9, 0, 7); g.fill()
  }
  g.globalAlpha = 1

  /* ---------- лесная подстилка: под деревьями тень, чтобы лес был сплошным ---------- */
  const forest = t.forest || []
  g.save()
  g.filter = 'blur(14px)'
  g.fillStyle = 'rgba(58, 92, 46, .55)'
  for (const f of forest) { poly(g, f.points); g.fill() }
  g.restore()

  /* ---------- скалы ---------- */
  for (const k of t.rocks || []) {
    for (let i = 0; i < 11; i++) {
      const a = r() * Math.PI * 2, d = r() * k.r * 0.75
      const x = k.x + Math.cos(a) * d, y = k.y + Math.sin(a) * d, rad = 7 + r() * (k.r * 0.34)
      g.fillStyle = 'rgba(30, 28, 24, .3)'
      g.beginPath(); g.ellipse(x + 3, y + 4, rad, rad * 0.78, 0, 0, 7); g.fill()
      const gr = g.createRadialGradient(x - rad * 0.35, y - rad * 0.4, 1, x, y, rad)
      gr.addColorStop(0, '#c9c6bc'); gr.addColorStop(0.6, '#9a978d'); gr.addColorStop(1, '#6f6c64')
      g.fillStyle = gr
      g.beginPath(); g.ellipse(x, y, rad, rad * 0.78, r(), 0, 7); g.fill()
    }
  }

  /* ---------- вода: сухой и мокрый песок, глубина от берега к середине, пена, рябь ---------- */
  const water = t.water || []
  for (const [w, col] of [[34, '#dcc893'], [20, '#c9b07a'], [12, '#b39a66']]) {
    for (const wt of water) { poly(g, wt.points); g.strokeStyle = col; g.lineWidth = wt.kind === 'river' ? w * 0.55 : w; g.stroke() }
  }
  for (const wt of water) {
    const deep = wt.kind === 'lake' ? '#2f7f99' : '#245f97'
    poly(g, wt.points)
    g.fillStyle = deep
    g.fill()
    g.save()
    g.clip()
    // мелководье: чем ближе к берегу, тем светлее
    const steps = wt.kind === 'river' ? [[20, '#4c9fd0'], [10, '#6bb7de']] : [[140, '#2c6ea6'], [100, '#3580b6'], [66, '#4092c4'], [40, '#4fa3d0'], [22, '#62b4da'], [10, '#7fc6e2']]
    g.filter = 'blur(6px)'
    for (const [lw, col] of steps) { poly(g, wt.points); g.strokeStyle = col; g.lineWidth = lw; g.stroke() }
    g.filter = 'none'
    // пена у кромки
    g.strokeStyle = 'rgba(240, 250, 255, .55)'
    g.lineWidth = 2.4
    g.setLineDash([9, 5, 3, 6])
    poly(g, wt.points); g.stroke()
    g.setLineDash([])
    // блики и рябь
    const xs = wt.points.map(p => p[0]), ys = wt.points.map(p => p[1])
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
    for (let i = 0; i < ((x1 - x0) * (y1 - y0)) / 1800; i++) {
      const x = x0 + r() * (x1 - x0), y = y0 + r() * (y1 - y0), l = 5 + r() * 12
      g.strokeStyle = `rgba(255, 255, 255, ${0.08 + r() * 0.16})`
      g.lineWidth = 1.2
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l / 2, y - 2.5, x + l, y); g.stroke()
    }
    g.restore()
  }

  /* ---------- дороги: мягкая тень, кромка, грунт, светлая середина, колеи, травинки по краям ---------- */
  const roads = (t.roads || []).map(rd => ({ w: rd.w || 20, pts: smooth(rd.points) }))
  g.save()
  g.filter = 'blur(3px)'
  for (const rd of roads) { line(g, rd.pts); g.strokeStyle = 'rgba(40, 30, 18, .4)'; g.lineWidth = rd.w + 8; g.stroke() }
  g.restore()
  for (const rd of roads) { line(g, rd.pts); g.strokeStyle = '#6b5235'; g.lineWidth = rd.w + 2; g.stroke() }
  for (const rd of roads) { line(g, rd.pts); g.strokeStyle = '#9a7a52'; g.lineWidth = rd.w - 2; g.stroke() }
  g.save()
  g.filter = 'blur(2px)'
  for (const rd of roads) { line(g, rd.pts); g.strokeStyle = 'rgba(190, 160, 115, .55)'; g.lineWidth = rd.w * 0.42; g.stroke() }
  g.restore()
  for (const rd of roads) {
    for (const side of [-1, 1]) {
      line(g, offsetLine(rd.pts, side * rd.w * 0.22))
      g.strokeStyle = 'rgba(92, 68, 42, .45)'; g.lineWidth = 1.6; g.stroke()
    }
    // крапинки грунта и травинки, наползающие на край
    for (let i = 0; i < rd.pts.length; i += 1) {
      const [x, y] = rd.pts[i]
      for (let k = 0; k < 2; k++) {
        const a = r() * Math.PI * 2, d = r() * rd.w * 0.45
        g.fillStyle = r() < 0.5 ? 'rgba(80, 58, 34, .4)' : 'rgba(205, 178, 130, .4)'
        g.fillRect(x + Math.cos(a) * d, y + Math.sin(a) * d, 1.4, 1.4)
      }
      if (r() < 0.55) {
        const a = r() * Math.PI * 2, d = rd.w / 2 + (r() - 0.6) * 3
        g.fillStyle = r() < 0.5 ? 'rgba(96, 140, 70, .8)' : 'rgba(126, 168, 92, .8)'
        g.fillRect(x + Math.cos(a) * d, y + Math.sin(a) * d, 1.6, 2.6)
      }
    }
  }

  /* ---------- площадь: брусчатка кругами ---------- */
  if (t.plaza) {
    const { x, y, r: pr } = t.plaza
    g.fillStyle = 'rgba(40, 30, 18, .35)'
    g.beginPath(); g.arc(x + 2, y + 3, pr + 6, 0, 7); g.fill()
    g.fillStyle = '#7d766a'
    g.beginPath(); g.arc(x, y, pr + 5, 0, 7); g.fill()
    g.fillStyle = '#a49c8d'
    g.beginPath(); g.arc(x, y, pr, 0, 7); g.fill()
    for (let rr = 8; rr < pr - 2; rr += 7) {
      const n = Math.round((2 * Math.PI * rr) / 7)
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rr
        g.fillStyle = ['#b3ab9b', '#988f80', '#aaa292', '#8f877a'][Math.floor(r() * 4)]
        g.save(); g.translate(x + Math.cos(a) * rr, y + Math.sin(a) * rr); g.rotate(a)
        g.fillRect(-2.6, -3.2, 5.2, 6.4)
        g.restore()
      }
    }
    g.fillStyle = '#8c8475'
    g.beginPath(); g.arc(x, y, 7, 0, 7); g.fill()
  }

  /* ---------- деревья ---------- */
  const rawRoads = t.roads || []
  const blocked = (x, y, pad) => {
    if (water.some(w => pointInPoly([x, y], w.points))) return true
    if (rawRoads.some(rd => rd.points.some((p, i) => i && segDist(x, y, rd.points[i - 1], p) < (rd.w || 20) / 2 + pad))) return true
    if (t.plaza && Math.hypot(x - t.plaza.x, y - t.plaza.y) < t.plaza.r + pad + 6) return true
    if ((t.rocks || []).some(k => Math.hypot(x - k.x, y - k.y) < k.r * 0.8)) return true
    return (s.buildings || []).some(b => {
      if (BUILDINGS[b.type]?.size === 'settlement') return false
      const f = footprint(b)
      return x > f.x - pad && x < f.x + f.w + pad && y > f.y - pad && y < f.y + f.h + pad
    })
  }
  const trees = []
  const step = 17
  for (let y = -10; y < H + 10; y += step) {
    for (let x = -10; x < W + 10; x += step) {
      const px = x + (r() - 0.5) * step, py = y + (r() - 0.5) * step
      const inForest = forest.some(f => pointInPoly([px, py], f.points))
      if (!inForest && r() > 0.012) continue
      const rad = inForest ? 8 + r() * 6 : 6.5 + r() * 4
      if (blocked(px, py, rad * 0.55)) continue
      trees.push([px, py, rad, r() < (py < 450 ? 0.35 : 0.12)])
      // одинокое дерево на поляне обрастает соседями — получается рощица
      if (!inForest) for (let k = 0; k < 3; k++) {
        const qx = px + (r() - 0.5) * 38, qy = py + (r() - 0.5) * 38, qr = 5.5 + r() * 4
        if (!blocked(qx, qy, qr)) trees.push([qx, qy, qr, false])
      }
      // кустики на опушке
      if (inForest && r() < 0.08) {
        const bx = px + (r() - 0.5) * 30, by = py + (r() - 0.5) * 30
        if (!blocked(bx, by, 3)) trees.push([bx, by, 3.5 + r() * 2, 'bush'])
      }
    }
  }
  trees.sort((a, b) => a[1] - b[1])
  const LEAF = ['#3f6b35', '#47773a', '#38622f', '#4f823f', '#5a8a45']
  for (const [x, y, rad, kind] of trees) {
    g.fillStyle = 'rgba(28, 44, 24, .42)'
    g.beginPath(); g.ellipse(x + rad * 0.45, y + rad * 0.55, rad * 1.05, rad * 0.85, 0, 0, 7); g.fill()
    if (kind === true) {
      // хвойное — звёздочка из иголок
      const n = 9
      g.fillStyle = ['#2f5a36', '#365f3a', '#2a5232'][Math.floor(r() * 3)]
      g.beginPath()
      for (let i = 0; i < n * 2; i++) {
        const a = (i / (n * 2)) * Math.PI * 2, rr = i % 2 ? rad * 0.55 : rad * 1.05
        i ? g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
      }
      g.closePath(); g.fill()
      g.fillStyle = 'rgba(110, 160, 110, .35)'
      g.beginPath(); g.arc(x - rad * 0.2, y - rad * 0.2, rad * 0.35, 0, 7); g.fill()
    } else {
      // лиственное — пышная крона из нескольких кругов
      const base = LEAF[Math.floor(r() * LEAF.length)]
      g.fillStyle = base
      for (let i = 0; i < 4; i++) {
        const a = r() * Math.PI * 2, d = rad * 0.28
        g.beginPath(); g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, rad * (0.7 + r() * 0.25), 0, 7); g.fill()
      }
      const hi = g.createRadialGradient(x - rad * 0.35, y - rad * 0.4, 0, x - rad * 0.3, y - rad * 0.3, rad * 0.8)
      hi.addColorStop(0, 'rgba(170, 210, 120, .55)')
      hi.addColorStop(1, 'rgba(170, 210, 120, 0)')
      g.fillStyle = hi
      g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill()
    }
  }

  // лёгкое общее затемнение к краям карты
  const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75)
  vg.addColorStop(0, 'rgba(0, 0, 0, 0)')
  vg.addColorStop(1, 'rgba(20, 24, 16, .25)')
  g.fillStyle = vg
  g.fillRect(0, 0, W, H)

  return new Promise(res => c.toBlob(b => res(URL.createObjectURL(b)), 'image/png'))
}
