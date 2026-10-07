// Рисует одну плитку карты поселения (256×256 px). Работает и в фоновом потоке (OffscreenCanvas), и на странице.
// Плитка z/x/y: на уровне z карта делится на 2^z × 2^z плиток; z = 0 — вся карта, MAX_Z — ~0,26 м на пиксель.
import { makeTerrain, WORLD, B, hash2 } from '../shared/terrainGen.js'

export const TILE = 256
export const MAX_Z = 8
const N = 128 // сетка расчёта местности; на плитку растягивается вдвое с мягким сглаживанием
const TREES_FROM = 1.6 // м на пиксель: мельче — рисуем отдельные деревья, крупнее — текстура крон

const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v)
const C = {
  shallow: [92, 154, 172], deep: [26, 68, 104], sand: [206, 188, 138],
  swamp: [80, 94, 58], swampPool: [58, 82, 72], reed: [120, 128, 70],
  earth: [92, 108, 68], earthDeep: [50, 60, 42],
  rock: [140, 138, 128], rockDark: [104, 104, 98], moss: [96, 114, 74],
  canopyA: [50, 92, 44], canopyB: [88, 130, 64], floor: [46, 68, 40],
  pineA: [32, 70, 46], pineB: [54, 94, 62], pineFloor: [38, 56, 38],
  lush: [112, 150, 78], dry: [158, 154, 96], shrub: [70, 104, 52], cut: [142, 150, 98], cutEarth: [128, 108, 76]
}

// clearings — вырубки, задевающие плитку; canvas — холст 256×256; makeCanvas(w, h) — как создать временный холст
export function renderTile(terrain, z, tx, ty, clearings, canvas, makeCanvas) {
  const gen = makeTerrain(terrain)
  gen.setClearings(clearings)
  const T = WORLD / 2 ** z, x0 = tx * T, y0 = ty * T, mpp = T / TILE
  const step = T / N
  const trees = mpp < TREES_FROM

  /* ---------- проход 1: местность по сетке (с полями по краю для теней рельефа) ---------- */
  const M = N + 2
  const hs = new Float32Array(M * M)
  const codes = new Uint8Array(N * N)
  const f1 = new Float32Array(N * N), f2 = new Float32Array(N * N)
  const o = {}
  for (let j = -1; j <= N; j++) {
    for (let i = -1; i <= N; i++) {
      const wx = x0 + (i + 0.5) * step, wy = y0 + (j + 0.5) * step
      gen.sample(wx, wy, o)
      hs[(j + 1) * M + (i + 1)] = o.hs ?? o.h
      if (i < 0 || j < 0 || i >= N || j >= N) continue
      const k = j * N + i
      codes[k] = o.code
      // что нужно для раскраски каждого вида
      switch (o.code) {
        case B.WATER: f1[k] = o.depth; break
        case B.RAVINE: f1[k] = o.rv; break
        case B.ROCK: f1[k] = o.rk; break
        case B.SWAMP: f1[k] = o.sw; break
        case B.MEADOW: case B.SHRUB: f1[k] = o.mv; f2[k] = o.f; break
        default: f1[k] = o.f
      }
    }
  }

  /* ---------- проход 2: цвет, мелкая текстура, тени рельефа ---------- */
  const base = makeCanvas(N, N)
  const bg = base.getContext('2d')
  const img = bg.createImageData(N, N)
  const px = img.data
  const tex = Math.max(1.5, step * 1.4) // масштаб мелкой текстуры не мельче пикселя
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const k = j * N + i
      const wx = x0 + (i + 0.5) * step, wy = y0 + (j + 0.5) * step
      const n1 = gen.noise(wx / tex, wy / tex) * 0.6 + gen.noise(wx / (tex * 5), wy / (tex * 5)) * 0.4
      let c
      switch (codes[k]) {
        case B.WATER: {
          const d = f1[k]
          c = mix(C.shallow, C.deep, Math.sqrt(d))
          const rip = gen.noise(wx / 9, wy / 4) * 0.05
          c = [c[0] * (1 + rip), c[1] * (1 + rip), c[2] * (1 + rip)]
          if (d < 0.04) c = mix([190, 214, 214], c, d / 0.04) // светлая кромка у берега
          break
        }
        case B.SHORE: c = mix(C.sand, [176, 160, 112], clamp01(n1 * 0.5 + 0.4)); break
        case B.SWAMP: {
          const pool = gen.noise(wx / 11, wy / 11)
          c = pool > 0.3 ? mix(C.swampPool, [72, 96, 84], clamp01(n1 + 0.5)) : mix(C.swamp, C.reed, clamp01(n1 * 0.6 + 0.4))
          break
        }
        case B.RAVINE: c = mix(C.earth, C.earthDeep, f1[k]); break
        case B.ROCK: {
          c = mix(C.rockDark, C.rock, clamp01(n1 * 0.6 + 0.5))
          if (gen.noise(wx / 40, wy / 40) > 0.25 && f1[k] < 0.08) c = mix(c, C.moss, 0.55)
          break
        }
        case B.FOREST: c = trees ? mix(C.floor, [56, 80, 46], clamp01(n1 + 0.5)) : mix(C.canopyA, C.canopyB, clamp01(n1 * 0.7 + 0.45)); break
        case B.CONIFER: c = trees ? mix(C.pineFloor, [50, 66, 44], clamp01(n1 + 0.5)) : mix(C.pineA, C.pineB, clamp01(n1 * 0.7 + 0.45)); break
        case B.CUT: c = mix(C.cut, C.cutEarth, clamp01(gen.noise(wx / 7, wy / 7) * 0.6 + 0.25)); break
        default: {
          // луг: сочный или выгоревший; кустарник — тёмные пятна (на мелком масштабе — отдельные кусты)
          c = mix(C.lush, C.dry, clamp01(f1[k] * 1.6 + 0.45))
          c = mix(c, [c[0] * 0.92, c[1] * 1.02, c[2] * 0.9], clamp01(n1 + 0.5))
          if (codes[k] === B.SHRUB && !trees && n1 > -0.1) c = mix(c, C.shrub, 0.7)
          // издалека у кромки леса луг чуть темнеет — переход мягче
          if (!trees && f2[k] > -0.02) c = mix(c, C.canopyA, (f2[k] + 0.02) / 0.02 * 0.2)
        }
      }
      // тени рельефа: свет с северо-запада
      if (codes[k] !== B.WATER) {
        const r = (j + 1) * M + (i + 1)
        const gx = (hs[r + 1] - hs[r - 1]) / (2 * step), gy = (hs[r + M] - hs[r - M]) / (2 * step)
        let s = 1 + (gx + gy) * 5200 * 0.32
        if (codes[k] === B.RAVINE) s *= 0.88
        s = s < 0.72 ? 0.72 : s > 1.25 ? 1.25 : s
        c = [c[0] * s, c[1] * s, c[2] * s]
      }
      const q = k * 4
      px[q] = c[0]; px[q + 1] = c[1]; px[q + 2] = c[2]; px[q + 3] = 255
    }
  }
  bg.putImageData(img, 0, 0)
  const g = canvas.getContext('2d')
  g.imageSmoothingEnabled = true
  g.imageSmoothingQuality = 'high'
  g.drawImage(base, 0, 0, TILE, TILE)

  /* ---------- проход 3: отдельные деревья, кусты, пни, камни, камыш, цветы ---------- */
  if (trees) drawDetails(g, gen, x0, y0, T, mpp)
  return canvas
}

const LEAF = [[60, 104, 50], [70, 116, 56], [52, 94, 46], [82, 128, 62], [64, 110, 46]]
const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`
function drawDetails(g, gen, x0, y0, T, mpp) {
  const s = gen.seed
  const cell = 7
  const pad = 8
  const items = []
  const o = {}
  const i0 = Math.floor((x0 - pad) / cell), i1 = Math.ceil((x0 + T + pad) / cell)
  const j0 = Math.floor((y0 - pad) / cell), j1 = Math.ceil((y0 + T + pad) / cell)
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const h1 = hash2(i, j, s), h2 = hash2(i, j, s + 1), h3 = hash2(i, j, s + 2)
      const wx = (i + 0.12 + h1 * 0.76) * cell, wy = (j + 0.12 + h2 * 0.76) * cell
      const code = gen.sample(wx, wy, o).code
      if (code === B.FOREST && h3 < 0.93) items.push([wy, 1, wx, 2.6 + h3 * 2.4, h1])
      else if (code === B.CONIFER && h3 < 0.88) items.push([wy, 2, wx, 1.8 + h3 * 1.3, h1])
      else if (code === B.SHRUB && h3 < 0.5) items.push([wy, 3, wx, 1.5 + h3 * 2.4, h1])
      else if (code === B.MEADOW && h3 < 0.004) items.push([wy, 1, wx, 3 + h1 * 1.5, h2])
      else if (code === B.MEADOW && h3 < 0.016) items.push([wy, 3, wx, 0.9 + h1, h2])
      else if (code === B.CUT && h3 < 0.4) items.push([wy, 4, wx, 0.32 + h1 * 0.16, h2])
      else if (code === B.ROCK && h3 < 0.2) items.push([wy, 5, wx, 0.6 + h1 * 1.9, h2])
      else if (code === B.SWAMP && h3 < 0.36) items.push([wy, 6, wx, 0.7 + h1 * 0.6, h2])
      else if (code === B.SWAMP && h3 < 0.38) items.push([wy, 7, wx, 1.6, h2])
      else if ((code === B.MEADOW || code === B.SHRUB) && h3 > 0.9985) items.push([wy, 5, wx, 0.5 + h1 * 1.2, h2]) // одинокий валун
    }
  }
  items.sort((a, b) => a[0] - b[0])
  const X = x => (x - x0) / mpp, Y = y => (y - y0) / mpp
  // тени отдельно и раньше, чтобы кроны соседей их перекрывали
  g.fillStyle = 'rgba(16, 28, 14, .42)'
  for (const [wy, kind, wx, r] of items) {
    if (kind > 3 && kind !== 5) continue
    const rr = r / mpp
    g.beginPath(); g.ellipse(X(wx) + rr * 0.42, Y(wy) + rr * 0.5, rr * 1.02, rr * 0.82, 0, 0, 7); g.fill()
  }
  for (const [wy, kind, wx, r, h] of items) {
    const x = X(wx), y = Y(wy), rr = r / mpp
    if (kind === 1) {
      // лиственное: пышная крона из нескольких кругов и блик
      const c = LEAF[Math.floor(h * LEAF.length)]
      g.fillStyle = rgb(c)
      for (let q = 0; q < 4; q++) {
        const a = h * 40 + q * 1.7, d = rr * 0.3
        g.beginPath(); g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, rr * (0.66 + ((h * 7 + q) % 1) * 0.22), 0, 7); g.fill()
      }
      g.fillStyle = 'rgba(176, 214, 120, .32)'
      g.beginPath(); g.arc(x - rr * 0.3, y - rr * 0.32, rr * 0.42, 0, 7); g.fill()
    } else if (kind === 2) {
      // хвойное: звёздочка из лап
      g.fillStyle = rgb([[30, 66, 42], [38, 74, 46], [28, 60, 40]][Math.floor(h * 3)])
      g.beginPath()
      for (let q = 0; q < 18; q++) {
        const a = (q / 18) * Math.PI * 2 + h, rq = q % 2 ? rr * 0.55 : rr * 1.05
        q ? g.lineTo(x + Math.cos(a) * rq, y + Math.sin(a) * rq) : g.moveTo(x + Math.cos(a) * rq, y + Math.sin(a) * rq)
      }
      g.closePath(); g.fill()
      g.fillStyle = 'rgba(110, 160, 110, .3)'
      g.beginPath(); g.arc(x - rr * 0.2, y - rr * 0.2, rr * 0.32, 0, 7); g.fill()
    } else if (kind === 3) {
      g.fillStyle = rgb([[74, 108, 52], [86, 118, 56], [66, 98, 48]][Math.floor(h * 3)])
      g.beginPath(); g.arc(x, y, rr, 0, 7); g.fill()
      g.fillStyle = 'rgba(150, 190, 100, .3)'
      g.beginPath(); g.arc(x - rr * 0.3, y - rr * 0.3, rr * 0.45, 0, 7); g.fill()
    } else if (kind === 4) {
      // пень: срез и тень
      if (rr < 0.6) continue
      g.fillStyle = '#5e4326'; g.beginPath(); g.arc(x + rr * 0.25, y + rr * 0.3, rr, 0, 7); g.fill()
      g.fillStyle = '#d6b27a'; g.beginPath(); g.arc(x, y, rr, 0, 7); g.fill()
      g.strokeStyle = 'rgba(120, 84, 44, .7)'; g.lineWidth = Math.max(0.5, rr * 0.18)
      g.beginPath(); g.arc(x, y, rr * 0.55, 0, 7); g.stroke()
    } else if (kind === 5) {
      // валун
      g.fillStyle = rgb([[124, 122, 114], [140, 138, 128], [112, 112, 106]][Math.floor(h * 3)])
      g.beginPath(); g.ellipse(x, y, rr, rr * 0.78, h * 3, 0, 7); g.fill()
      g.fillStyle = 'rgba(230, 226, 214, .35)'
      g.beginPath(); g.ellipse(x - rr * 0.25, y - rr * 0.22, rr * 0.45, rr * 0.3, h * 3, 0, 7); g.fill()
    } else if (kind === 6) {
      // камыш: пучок черточек
      if (rr < 1) continue
      g.strokeStyle = 'rgba(150, 156, 82, .85)'; g.lineWidth = Math.max(0.6, 0.12 / mpp)
      g.beginPath()
      for (let q = 0; q < 5; q++) { const a = -Math.PI / 2 + (q - 2) * 0.32; g.moveTo(x, y); g.lineTo(x + Math.cos(a) * rr * 1.4, y + Math.sin(a) * rr * 1.4) }
      g.stroke()
    } else if (kind === 7) {
      // сухое дерево в болоте
      g.strokeStyle = 'rgba(70, 56, 40, .9)'; g.lineWidth = Math.max(0.7, 0.25 / mpp)
      g.beginPath(); g.moveTo(x - rr, y - rr * 0.4); g.lineTo(x + rr, y + rr * 0.4); g.moveTo(x - rr * 0.2, y - rr * 0.1); g.lineTo(x + rr * 0.1, y - rr * 0.8); g.stroke()
    }
  }
  // цветы и пучки травы на лугах — только вблизи
  if (mpp < 0.7) {
    const fc = 2.5
    const F = ['#fff7e6', '#f6e27a', '#f2a8c4', '#c9b8ff', '#ffffff']
    const k0 = Math.floor(x0 / fc), k1 = Math.ceil((x0 + T) / fc), l0 = Math.floor(y0 / fc), l1 = Math.ceil((y0 + T) / fc)
    for (let j = l0; j <= l1; j++) {
      for (let i = k0; i <= k1; i++) {
        const h = hash2(i, j, s + 7)
        if (h > 0.5) continue
        const wx = (i + hash2(i, j, s + 8)) * fc, wy = (j + hash2(i, j, s + 9)) * fc
        if (gen.sample(wx, wy, o).code !== B.MEADOW) continue
        if (h > 0.16) {
          // пучок травы
          g.strokeStyle = h > 0.33 ? 'rgba(62, 96, 40, .7)' : 'rgba(176, 194, 112, .65)'
          g.lineWidth = Math.max(0.8, 0.1 / mpp)
          const x = X(wx), y = Y(wy), l = 0.5 / mpp
          g.beginPath(); g.moveTo(x - l * 0.4, y); g.lineTo(x - l * 0.6, y - l); g.moveTo(x, y); g.lineTo(x, y - l * 1.2); g.moveTo(x + l * 0.4, y); g.lineTo(x + l * 0.6, y - l); g.stroke()
          continue
        }
        g.fillStyle = F[Math.floor(h * 31) % F.length]
        g.beginPath(); g.arc(X(wx), Y(wy), Math.max(0.6, 0.22 / mpp), 0, 7); g.fill()
      }
    }
  }
}
