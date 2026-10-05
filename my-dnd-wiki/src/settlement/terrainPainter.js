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
function path(g, pts, close = true) {
  g.beginPath()
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)))
  if (close) g.closePath()
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

  // трава: ровный тон, крупные пятна и мелкая крапинка — как в старых районах
  g.fillStyle = '#8fb46c'
  g.fillRect(0, 0, W, H)
  for (let i = 0; i < 90; i++) {
    const x = r() * W, y = r() * H, rad = 60 + r() * 160
    const gr = g.createRadialGradient(x, y, 0, x, y, rad)
    const light = r() < 0.5
    gr.addColorStop(0, light ? 'rgba(178, 204, 120, .28)' : 'rgba(96, 138, 74, .28)')
    gr.addColorStop(1, 'rgba(0, 0, 0, 0)')
    g.fillStyle = gr
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2)
  }
  for (let i = 0; i < W * H / 55; i++) {
    const x = r() * W, y = r() * H
    g.fillStyle = r() < 0.6 ? 'rgba(70, 108, 52, .55)' : 'rgba(190, 214, 140, .5)'
    g.fillRect(x, y, 1.4 + r() * 1.4, 1.4 + r() * 1.4)
  }

  // скалы
  for (const k of t.rocks || []) {
    for (let i = 0; i < 9; i++) {
      const a = r() * Math.PI * 2, d = r() * k.r * 0.75
      const x = k.x + Math.cos(a) * d, y = k.y + Math.sin(a) * d, rad = 8 + r() * (k.r * 0.35)
      g.fillStyle = 'rgba(40, 36, 30, .35)'
      g.beginPath(); g.ellipse(x + 3, y + 4, rad, rad * 0.8, 0, 0, 7); g.fill()
      g.fillStyle = ['#9a9890', '#8a877e', '#b0ada3'][i % 3]
      g.beginPath(); g.ellipse(x, y, rad, rad * 0.8, r(), 0, 7); g.fill()
      g.strokeStyle = 'rgba(50, 46, 40, .6)'; g.lineWidth = 1.2; g.stroke()
    }
  }

  // вода: песчаный берег (широкая обводка), вода, светлая кромка, рябь
  const water = t.water || []
  g.lineJoin = 'round'
  for (const w of water) {
    path(g, w.points)
    g.strokeStyle = '#d8c38e'; g.lineWidth = w.kind === 'river' ? 16 : 30; g.stroke()
    g.strokeStyle = 'rgba(160, 140, 90, .5)'; g.lineWidth = w.kind === 'river' ? 20 : 34
  }
  for (const w of water) {
    path(g, w.points)
    const ys = w.points.map(p => p[1])
    const gr = g.createLinearGradient(0, Math.min(...ys), 0, Math.max(...ys))
    gr.addColorStop(0, w.kind === 'lake' ? '#56b4c9' : '#4f9fd3')
    gr.addColorStop(1, w.kind === 'lake' ? '#3a8ea8' : '#2f6ea6')
    g.fillStyle = gr
    g.fill()
    g.save(); g.clip()
    g.strokeStyle = 'rgba(160, 220, 245, .55)'; g.lineWidth = 12; path(g, w.points); g.stroke()
    // рябь
    g.strokeStyle = 'rgba(255, 255, 255, .22)'; g.lineWidth = 1.4
    const xs = w.points.map(p => p[0])
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
    for (let i = 0; i < (x1 - x0) * (y1 - y0) / 2600; i++) {
      const x = x0 + r() * (x1 - x0), y = y0 + r() * (y1 - y0), l = 6 + r() * 10
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l / 2, y - 3, x + l, y); g.stroke()
    }
    g.restore()
  }

  // площадь
  if (t.plaza) {
    const { x, y, r: pr } = t.plaza
    g.fillStyle = '#8b8577'
    g.beginPath(); g.arc(x, y, pr + 6, 0, 7); g.fill()
    g.fillStyle = '#a9a294'
    g.beginPath(); g.arc(x, y, pr, 0, 7); g.fill()
    g.strokeStyle = 'rgba(90, 84, 72, .45)'; g.lineWidth = 1.2
    for (let k = 14; k < pr; k += 12) { g.beginPath(); g.arc(x, y, k, 0, 7); g.stroke() }
  }

  // дороги: тёмная кромка, грунт, светлая середина и колеи
  const roads = t.roads || []
  g.lineCap = 'round'
  for (const pass of [0, 1, 2]) {
    for (const rd of roads) {
      path(g, rd.points, false)
      const w = rd.w || 20
      g.strokeStyle = ['#4a3826', '#7a5b3c', 'rgba(150, 118, 82, .45)'][pass]
      g.lineWidth = [w + 5, w, w * 0.45][pass]
      g.stroke()
    }
  }
  for (const rd of roads) {
    for (let i = 1; i < rd.points.length; i++) {
      const [ax, ay] = rd.points[i - 1], [bx, by] = rd.points[i]
      const len = Math.hypot(bx - ax, by - ay)
      for (let d = 0; d < len; d += 3) {
        if (r() < 0.5) continue
        const k = d / len, off = (r() - 0.5) * (rd.w || 20) * 0.8
        g.fillStyle = r() < 0.5 ? 'rgba(60, 44, 28, .35)' : 'rgba(170, 140, 100, .35)'
        g.fillRect(ax + (bx - ax) * k - ((by - ay) / len) * off, ay + (by - ay) * k + ((bx - ax) / len) * off, 1.6, 1.6)
      }
    }
  }

  // деревья: в зонах леса плотно, по траве — редкие рощицы; не на дорогах, воде, площади и постройках
  const blocked = (x, y, pad) => {
    if (water.some(w => pointInPoly([x, y], w.points))) return true
    if (roads.some(rd => rd.points.some((p, i) => i && segDist(x, y, rd.points[i - 1], p) < (rd.w || 20) / 2 + pad))) return true
    if (t.plaza && Math.hypot(x - t.plaza.x, y - t.plaza.y) < t.plaza.r + pad + 6) return true
    if ((t.rocks || []).some(k => Math.hypot(x - k.x, y - k.y) < k.r)) return true
    return (s.buildings || []).some(b => {
      if (BUILDINGS[b.type]?.size === 'settlement') return false
      const f = footprint(b)
      return x > f.x - pad && x < f.x + f.w + pad && y > f.y - pad && y < f.y + f.h + pad
    })
  }
  const trees = []
  const forest = t.forest || []
  const step = 19
  for (let y = -10; y < H + 10; y += step) {
    for (let x = -10; x < W + 10; x += step) {
      const px = x + (r() - 0.5) * step, py = y + (r() - 0.5) * step
      const inForest = forest.some(f => pointInPoly([px, py], f.points))
      if (!inForest && r() > 0.012) continue
      const rad = inForest ? 8 + r() * 6 : 7 + r() * 4
      if (blocked(px, py, rad * 0.6)) continue
      trees.push([px, py, rad])
      // у одиночного дерева на поляне — пара соседей, получается рощица
      if (!inForest) for (let k = 0; k < 3; k++) {
        const qx = px + (r() - 0.5) * 40, qy = py + (r() - 0.5) * 40, qr = 6 + r() * 4
        if (!blocked(qx, qy, qr)) trees.push([qx, qy, qr])
      }
    }
  }
  trees.sort((a, b) => a[1] - b[1])
  for (const [x, y, rad] of trees) {
    g.fillStyle = 'rgba(30, 48, 26, .45)'
    g.beginPath(); g.arc(x + rad * 0.35, y + rad * 0.45, rad, 0, 7); g.fill()
    g.fillStyle = ['#3d6a34', '#457539', '#36602f', '#4c7d3c'][Math.floor(r() * 4)]
    g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill()
    g.fillStyle = 'rgba(120, 170, 90, .45)'
    g.beginPath(); g.arc(x - rad * 0.3, y - rad * 0.32, rad * 0.45, 0, 7); g.fill()
  }

  return new Promise(res => c.toBlob(b => res(URL.createObjectURL(b)), 'image/png'))
}
