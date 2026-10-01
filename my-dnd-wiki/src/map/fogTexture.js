// Бесшовная «облачная» текстура для тумана войны (fBm value noise), генерируется один раз.
let cached = null

export function fogTexture(size = 384) {
  if (cached) return cached
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')
  const img = ctx.createImageData(size, size)

  let seed = 1337
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
  const octaves = [4, 8, 16, 32].map(n => ({ n, g: Array.from({ length: n * n }, rand) }))
  const smooth = t => t * t * (3 - 2 * t)
  const sample = (o, x, y) => {
    const fx = (x / size) * o.n, fy = (y / size) * o.n
    const x0 = Math.floor(fx), y0 = Math.floor(fy)
    const tx = smooth(fx - x0), ty = smooth(fy - y0)
    const g = (i, j) => o.g[((j + o.n) % o.n) * o.n + ((i + o.n) % o.n)]
    const a = g(x0, y0) + (g(x0 + 1, y0) - g(x0, y0)) * tx
    const b = g(x0, y0 + 1) + (g(x0 + 1, y0 + 1) - g(x0, y0 + 1)) * tx
    return a + (b - a) * ty
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = 0, amp = 0.55, norm = 0
      for (const o of octaves) { v += sample(o, x, y) * amp; norm += amp; amp *= 0.5 }
      v /= norm
      const i = (y * size + x) * 4
      // светлые клубы на тёмном фоне
      const l = 40 + v * 120
      img.data[i] = l * 0.86
      img.data[i + 1] = l * 0.9
      img.data[i + 2] = l * 1.05
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  cached = c.toDataURL('image/png')
  return cached
}
