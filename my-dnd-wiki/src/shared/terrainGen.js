// Местность поселения: процедурный генератор по зерну. Общий для сервера (проверка места под постройку),
// фонового потока (рисование плиток карты) и страницы. Ничего не хранится — всё считается из зерна и настроек.
// Единицы — метры. Карта — квадрат WORLD × WORLD (~300 км²), поселение в центре.

export const WORLD = 17320
export const CENTER = WORLD / 2
// настройки генератора по умолчанию (мастер крутит их в «Местности»)
export const TERRAIN_DEFAULTS = { forest: 0.62, conifer: 0.06, hills: 0.5, ponds: 10, swamps: 0.25, lake: 1 }
export const TERRAIN_PARAMS = {
  forest: { label: 'Лесистость', min: 0.2, max: 0.9, step: 0.01 },
  conifer: { label: 'Хвойные', min: 0, max: 0.5, step: 0.01 },
  hills: { label: 'Холмы, скалы, овраги', min: 0, max: 1, step: 0.01 },
  ponds: { label: 'Пруды и малые озёра', min: 0, max: 30, step: 1 },
  swamps: { label: 'Болота', min: 0, max: 1, step: 0.01 },
  lake: { label: 'Размер большого озера', min: 0.5, max: 1.6, step: 0.01 }
}

// виды местности
export const B = { WATER: 1, SHORE: 2, SWAMP: 3, RAVINE: 4, ROCK: 5, FOREST: 6, CONIFER: 7, SHRUB: 8, MEADOW: 9, CUT: 10 }
export const BIOME_LABEL = {
  [B.WATER]: 'вода', [B.SHORE]: 'берег', [B.SWAMP]: 'болото', [B.RAVINE]: 'овраг', [B.ROCK]: 'скалы',
  [B.FOREST]: 'лиственный лес', [B.CONIFER]: 'хвойный лес', [B.SHRUB]: 'кустарник', [B.MEADOW]: 'луг', [B.CUT]: 'вырубка'
}

/* ---------------- шум ---------------- */
export function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
// целочисленный хэш клетки → [0, 1): деревья, камни и кусты на одних и тех же местах при любом масштабе
export function hash2(ix, iy, s) {
  let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(s, 2147483647)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6
const GX = [1, -1, 1, -1, 1, -1, 0, 0], GY = [1, 1, -1, -1, 0, 0, 1, -1]
// симплекс-шум 2D (Густавсон), значения примерно в [-1, 1]
function simplex(seed) {
  const r = mulberry32(seed)
  const p = new Uint8Array(256)
  for (let i = 0; i < 256; i++) p[i] = i
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t }
  const perm = new Uint8Array(512), g = new Uint8Array(512)
  for (let i = 0; i < 512; i++) { perm[i] = p[i & 255]; g[i] = perm[i] & 7 }
  return (xin, yin) => {
    const s = (xin + yin) * F2
    const i = Math.floor(xin + s), j = Math.floor(yin + s)
    const t = (i + j) * G2
    const x0 = xin - (i - t), y0 = yin - (j - t)
    const i1 = x0 > y0 ? 1 : 0, j1 = 1 - i1
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2
    const ii = i & 255, jj = j & 255
    let n = 0
    let t0 = 0.5 - x0 * x0 - y0 * y0
    if (t0 > 0) { const k = g[ii + perm[jj]]; t0 *= t0; n += t0 * t0 * (GX[k] * x0 + GY[k] * y0) }
    let t1 = 0.5 - x1 * x1 - y1 * y1
    if (t1 > 0) { const k = g[ii + i1 + perm[jj + j1]]; t1 *= t1; n += t1 * t1 * (GX[k] * x1 + GY[k] * y1) }
    let t2 = 0.5 - x2 * x2 - y2 * y2
    if (t2 > 0) { const k = g[ii + 1 + perm[jj + 1]]; t2 *= t2; n += t2 * t2 * (GX[k] * x2 + GY[k] * y2) }
    return 70 * n
  }
}
function fbm(n, x, y, oct) {
  let a = 1, f = 1, s = 0, norm = 0
  for (let i = 0; i < oct; i++) { s += a * n(x * f + i * 17.3, y * f - i * 9.1); norm += a; a *= 0.5; f *= 2.03 }
  return s / norm
}
const smooth = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t) }

/* ---------------- генератор ---------------- */
const SHORE = 5 // м песчаной кромки у воды
const cache = new Map()
// местность по зерну и настройкам; одинаковые запросы отдают один и тот же объект
export function makeTerrain(terrain = {}) {
  const seed = (terrain.seed ?? 1917) | 0
  const P = { ...TERRAIN_DEFAULTS, ...(terrain.params || {}) }
  const key = seed + ':' + JSON.stringify(P)
  if (cache.has(key)) return cache.get(key)
  const rnd = mulberry32(seed)
  const nH = simplex(seed * 11 + 1), nM = simplex(seed * 11 + 2), nF = simplex(seed * 11 + 3), nF2 = simplex(seed * 11 + 4)
  const nC = simplex(seed * 11 + 5), nR = simplex(seed * 11 + 6), nV = simplex(seed * 11 + 7), nS = simplex(seed * 11 + 8), nMV = simplex(seed * 11 + 9)
  const C = CENTER

  // пороги из настроек (подобраны по выборке, чтобы доля леса и т. п. примерно совпадала с ползунками)
  const forestThr = 0.27 - P.forest * 0.56
  const conThr = 0.36 - P.conifer * 0.7
  const rockThr = 0.56 - P.hills * 0.2
  const swampThr = 0.63 - P.swamps * 0.16
  const ravineW = 0.007 + P.hills * 0.016
  const hillAmp = 0.55 + P.hills * 0.9

  // большое озеро у поселения: берег с заливами и мысами (шум по плоскости), до центра ~350 м
  const lakeR = (1700 + rnd() * 700) * P.lake
  const dir = rnd() * Math.PI * 2
  const lake = { x: 0, y: 0, rMax: lakeR * 1.45 }
  function lakeSD(x, y) {
    const dx = x - lake.x, dy = y - lake.y
    const d = Math.hypot(dx, dy)
    if (d > lake.rMax) return lakeR - d // далеко — хватает приблизительного расстояния
    const amp = 0.34 * lakeR * smooth(0.25, 0.9, d / lakeR) // середина без островов, берега — изрезанные
    return lakeR - d + amp * fbm(nS, x / (lakeR * 0.9), y / (lakeR * 0.9), 4)
  }
  // ставим озеро так, чтобы берег был в 350 м от центра поселения
  let lo = lakeR * 0.4, hi = lakeR * 2.2
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2
    lake.x = C + Math.cos(dir) * mid; lake.y = C + Math.sin(dir) * mid
    if (lakeSD(C, C) > -350) lo = mid; else hi = mid
  }
  // малые озёра и пруды: в низинах, не у самого поселения
  const hRaw = (x, y) => fbm(nH, x / 5200, y / 5200, 5)
  const ponds = []
  for (let i = 0; i < Math.round(P.ponds); i++) {
    let best = null
    for (let tries = 0; tries < 40 && !best?.ok; tries++) {
      const x = 700 + rnd() * (WORLD - 1400), y = 700 + rnd() * (WORLD - 1400)
      const r = 35 * Math.pow(260 / 35, rnd() ** 1.6)
      if (Math.hypot(x - C, y - C) < 1200 || lakeSD(x, y) > -r * 2 - 200) continue
      if (ponds.some(p => Math.hypot(p.x - x, p.y - y) < p.r + r + 200)) continue
      const h = hRaw(x, y)
      if (!best || h < best.h) best = { x, y, r, h, o: i * 13.7 + 3, ok: tries > 4 }
    }
    if (best) ponds.push(best)
  }
  const pondSD = (p, x, y) => {
    const d = Math.hypot(x - p.x, y - p.y)
    if (d > p.r * 1.5) return p.r - d
    return p.r - d + p.r * 0.38 * smooth(0.2, 0.9, d / p.r) * fbm(nS, x / (p.r * 1.1) + p.o, y / (p.r * 1.1) + p.o, 2)
  }
  // вода: >0 — внутри (глубже — больше), <0 — расстояние до берега
  function waterSD(x, y) {
    let sd = lakeSD(x, y)
    for (const p of ponds) {
      if (Math.abs(x - p.x) > p.r * 1.5 + 900 || Math.abs(y - p.y) > p.r * 1.5 + 900) continue
      const v = pondSD(p, x, y)
      if (v > sd) sd = v
    }
    return sd
  }

  let clearings = []
  // вырубки мастера: круги { x, y, r }; для плитки передаются только задевающие её
  const setClearings = list => { clearings = list || [] }
  const inClearing = (x, y) => clearings.some(c => (x - c.x) ** 2 + (y - c.y) ** 2 < c.r * c.r)

  // всё о точке: код местности и подробности для раскраски
  function sample(x, y, o = {}) {
    const dC = Math.hypot(x - C, y - C)
    const sd = waterSD(x, y)
    o.sd = sd
    const wd = sd < 0 ? -sd : 0
    // крупный рельеф (для теней) и мелкие неровности (для скал и болот)
    const flat = (0.45 + 0.55 * smooth(300, 1600, dC))
    const relief = fbm(nH, x / 5200, y / 5200, 3) * hillAmp * flat
    const big = relief - Math.max(0, 1 - wd / 900) * 0.25 * flat
    const h = big + fbm(nH, x / 700 + 40, y / 700 - 40, 2) * 0.08 * hillAmp * flat
    o.h = h
    o.hs = relief // тени — только от холмов, без спуска к воде
    if (sd > 0) { o.code = B.WATER; o.depth = Math.min(1, sd / (sd > 400 ? lakeR * 0.45 : 60)); return o }
    const m = fbm(nM, x / 3000, y / 3000, 4)
    o.m = m
    // овраги: тонкие извилистые линии на возвышенностях
    if (dC > 900 && wd > 40 && h > 0.06) {
      const rv = Math.abs(fbm(nV, x / 3200, y / 3200, 3))
      if (rv < ravineW) { o.code = B.RAVINE; o.rv = 1 - rv / ravineW; return o }
    }
    const rk = h + 0.22 * fbm(nR, x / 800, y / 800, 3)
    o.rk = rk - rockThr
    if (o.rk > 0 && dC > 700 && wd > 20) { o.code = B.ROCK; return o }
    // болота: редко, в сырых низинах у воды
    const near = Math.max(0, 1 - wd / 450)
    const sw = m * 0.6 + near * 0.4 - h * 0.6
    o.sw = sw - swampThr
    if (o.sw > 0 && dC > 700) { o.code = B.SWAMP; return o }
    if (wd < SHORE) { o.code = B.SHORE; return o }
    // лес: широколиственный, хвойные — редкими пятнами и на каменистых возвышенностях
    let f = fbm(nF, x / 2600, y / 2600, 4) * 0.75 + fbm(nF2, x / 520, y / 520, 2) * 0.25
    f -= 0.7 * (1 - smooth(450, 1400, dC)) // поляна под поселение
    f -= Math.max(0, 1 - wd / 70) * 0.35 // открытый берег
    f += Math.max(0, o.rk + 0.12) * 0.6 // у скал лес гуще
    o.f = f - forestThr
    const cut = clearings.length && inClearing(x, y)
    if (o.f > 0) {
      if (cut) { o.code = B.CUT; return o }
      o.code = fbm(nC, x / 2000, y / 2000, 3) > conThr || o.rk > -0.03 ? B.CONIFER : B.FOREST
      return o
    }
    o.mv = fbm(nMV, x / 1500, y / 1500, 3)
    o.code = o.f > -0.05 && !cut ? B.SHRUB : B.MEADOW
    return o
  }

  // место для аванпоста нужного вида далеко от поселения
  function findSpot(want, minD = 3500, maxD = 7500, salt = 1) {
    const r = mulberry32(seed * 31 + salt)
    const o = {}
    for (let i = 0; i < 4000; i++) {
      const a = r() * Math.PI * 2, d = minD + r() * (maxD - minD)
      const x = C + Math.cos(a) * d, y = C + Math.sin(a) * d
      if (x < 300 || y < 300 || x > WORLD - 300 || y > WORLD - 300) continue
      if (want.includes(sample(x, y, o).code)) return { x: Math.round(x), y: Math.round(y) }
    }
    return { x: Math.round(C + Math.cos(salt) * minD), y: Math.round(C + Math.sin(salt) * minD) }
  }

  // мелкий шум для текстур (рябь, кроны, мох)
  const nD = simplex(seed * 11 + 10)
  const gen = { seed, P, lake, lakeR, ponds, sample, waterSD, setClearings, findSpot, noise: nD }
  cache.set(key, gen)
  if (cache.size > 6) cache.delete(cache.keys().next().value)
  return gen
}
