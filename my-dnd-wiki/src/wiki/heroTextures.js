// Текстуры эффектов героев: рисуются на canvas один раз на страницу.
// Это заметная работа, поэтому HeroCard просит нарисовать их заранее, пока браузер свободен (warmHeroTextures)

// одинаковый «случайный» узор при каждом запуске
export function rng(seed) {
  return () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
}

// иней: перистые ледяные узоры, как мороз на стекле, растут от нижнего края и боков портрета.
// Ствол идёт короткими шагами и чуть изгибается, на каждом шаге — веточки под 60°, к кончику короче.
// Рисуется один раз на страницу, тремя слоями толщины (каждый — одним штрихом, это быстро)
let frost = null
export function frostImage() {
  if (frost) return frost
  const W = 330, H = 548, S = 2
  const r = rng(7331)
  const c = document.createElement('canvas')
  c.width = W * S
  c.height = H * S
  const g = c.getContext('2d')
  g.scale(S, S)
  const paths = [new Path2D(), new Path2D(), new Path2D()] // стволы, ветки, иголки
  function stem(x, y, a, L, d, curve) {
    const path = paths[2 - d]
    const step = 3
    path.moveTo(x, y)
    for (let len = 0; len < L; len += step) {
      a += curve + (r() - 0.5) * 0.14
      x += Math.cos(a) * step
      y += Math.sin(a) * step
      path.lineTo(x, y)
      if (d > 0 && y < H && r() < (d === 2 ? 0.7 : 0.55)) {
        const rest = (L - len) * (0.42 + r() * 0.18) + 2
        for (const side of r() < 0.6 ? [-1, 1] : [r() < 0.5 ? -1 : 1]) stem(x, y, a + side * (Math.PI / 3 + (r() - 0.5) * 0.15), rest, d - 1, -side * 0.012)
        path.moveTo(x, y)
      }
    }
  }
  const PB = 262, PL = 12, PR = W - 12 // низ и бока портрета
  for (let x = PL + 8; x < PR; x += 18 + r() * 14) stem(x, PB, Math.PI / 2 + (r() - 0.5) * 1, 50 + r() * 45, 2, (r() - 0.5) * 0.02)
  for (let y = 36; y < PB; y += 24 + r() * 18) {
    stem(PL, y, Math.PI * (0.62 + r() * 0.2), 20 + r() * 16, 2, 0.01)
    stem(PR, y, Math.PI * (0.38 - r() * 0.2), 20 + r() * 16, 2, -0.01)
  }
  g.lineCap = g.lineJoin = 'round'
  g.shadowColor = 'rgba(127, 214, 255, .95)'
  const STYLE = [[1.3, 0.6, 4], [0.8, 0.42, 2], [0.5, 0.3, 0]] // толщина, яркость, свечение
  STYLE.forEach(([w, al, blur], i) => {
    g.lineWidth = w
    g.strokeStyle = `rgba(238, 250, 255, ${al})`
    g.shadowBlur = blur
    g.stroke(paths[i])
  })
  // изморозь: мелкие крупинки гуще у портрета
  g.shadowBlur = 0
  for (let i = 0; i < 900; i++) {
    const y = PB + -Math.log(1 - r() * 0.999) * 90
    if (y > H) continue
    const x = PL + r() * (PR - PL)
    g.fillStyle = `rgba(236, 249, 255, ${(0.4 * Math.max(0, 1 - (y - PB) / 300)).toFixed(3)})`
    g.fillRect(x, y, 0.6 + r() * 1.1, 0.6 + r() * 1.1)
  }
  return (frost = toUrl(c))
}

// текстура тумана: бесшовный фрактальный шум; у каждого слоя своя, рисуется один раз на страницу
const fogs = {}
export function fogTile(seed, N) {
  if (fogs[seed]) return fogs[seed]
  const r = rng(seed)
  const oct = [[4, 0.48], [8, 0.26], [16, 0.14], [32, 0.08], [64, 0.04]].map(([p, w]) => ({ p, w, ox: r() * p, oy: r() * p, g: Float32Array.from({ length: p * p }, r) }))
  const sm = t => t * t * (3 - 2 * t)
  const c = document.createElement('canvas')
  c.width = c.height = N
  const ctx = c.getContext('2d')
  const img = ctx.createImageData(N, N)
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      let v = 0
      for (const { p, w, ox, oy, g } of oct) {
        const fx = (x / N) * p + ox, fy = (y / N) * p + oy
        const ix = Math.floor(fx) % p, iy = Math.floor(fy) % p
        const tx = sm(fx - Math.floor(fx)), ty = sm(fy - Math.floor(fy))
        const x1 = (ix + 1) % p, y1 = (iy + 1) % p
        const a = g[iy * p + ix] + (g[iy * p + x1] - g[iy * p + ix]) * tx
        const b = g[y1 * p + ix] + (g[y1 * p + x1] - g[y1 * p + ix]) * tx
        v += (a + (b - a) * ty) * w
      }
      const o = (y * N + x) * 4
      img.data[o] = 242; img.data[o + 1] = 245; img.data[o + 2] = 248
      img.data[o + 3] = Math.max(0, Math.min(255, (v - 0.47) * 2.6 * 255))
    }
  }
  ctx.putImageData(img, 0, 0)
  return (fogs[seed] = toUrl(c))
}

// пар Энди — два слоя тумана, иней Джилл
export const FOG_LAYERS = [[4242, 512], [9137, 384]]
// холст → короткая blob-ссылка (длинная data:-строка в стиле каждый раз разбирается заново)
function toUrl(c) {
  const d = c.toDataURL()
  const bin = atob(d.slice(d.indexOf(',') + 1))
  const buf = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i)
  return URL.createObjectURL(new Blob([buf], { type: 'image/png' }))
}

// невидимый крошечный элемент с этими фонами: браузер заранее распаковывает картинки и держит их в памяти
let shelf = null
export function warmHeroTextures(theme) {
  const job = { steam: () => FOG_LAYERS.map(([seed, n]) => [fogTile(seed, n), n]), frost: () => [[frostImage(), 330]] }[theme]
  if (!job) return
  const idle = window.requestIdleCallback || (f => setTimeout(f, 300))
  idle(() => {
    shelf ||= document.body.appendChild(Object.assign(document.createElement('div'), { ariaHidden: 'true' }))
    shelf.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:.01;pointer-events:none;z-index:-1'
    for (const [url, n] of job()) {
      const i = shelf.appendChild(document.createElement('i'))
      i.style.cssText = `position:absolute;inset:0;background:url(${url}) 0 0/${n}px ${n}px`
    }
  }, { timeout: 3000 })
}
