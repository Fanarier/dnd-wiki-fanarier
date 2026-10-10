<template>
  <!-- живой фон школы магии за текстом: огонь, вода со льдом, гроза, деревья. Мышь не перехватывает -->
  <div ref="box" class="mb" :class="kind" aria-hidden="true">
    <canvas v-if="kind === 'fire' || kind === 'water'" ref="glc" class="mb-gl" />
    <canvas v-if="kind !== 'fire'" ref="c2" class="mb-2d" />
  </div>
</template>

<script setup>
// Огонь и вода — свой WebGL-шейдер (идея — «Elements» из ThreeUI, MIT), всё остальное — canvas 2D:
// ледяные кристаллы, гроза с молниями, растущие деревья. Не чаще 30 кадров/с, на скрытой вкладке — пауза,
// «меньше анимаций» в системе — один неподвижный кадр.
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { thunder } from '../sound/sound.js'

const props = defineProps({ kind: { type: String, required: true } }) // fire | water | air | earth
const box = ref(null), glc = ref(null), c2 = ref(null)
const still = matchMedia('(prefers-reduced-motion: reduce)').matches

/* ---------- шейдеры ---------- */
const COMMON = `
precision mediump float;
uniform vec2 uRes; uniform float uT;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y); }
float fbm(vec2 p){ float v = 0., a = .5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= .5; } return v; }
// цвет premultiplied: не ярче своей прозрачности, иначе при наложении выходит белая засветка
vec4 pm(vec3 c, float a){ a = clamp(a, 0., 1.); return vec4(min(c, vec3(a)), a); }
`
const SHADERS = {
  // пламя от нижнего края, языки разной высоты, летящие искры
  fire: `void main(){
    vec2 uv = gl_FragCoord.xy / uRes; float asp = uRes.x / uRes.y;
    vec2 p = vec2(uv.x * asp * 2.4, uv.y * 2.2);
    float n = fbm(p + vec2(0., -uT * 1.1)), n2 = fbm(p * 1.8 + vec2(uT * .2, -uT * 1.7));
    float h = .26 + .1 * sin(uv.x * 8. + uT * .6) + .06 * sin(uv.x * 23. - uT);
    float f = pow(clamp((h - uv.y) * 3.2 + n * .95 + n2 * .45 - .62, 0., 1.), 1.5);
    vec3 col = mix(vec3(.5, .04, .02), vec3(1., .42, .08), f);
    col = mix(col, vec3(1., .86, .45), smoothstep(.62, 1., f));
    vec2 g = vec2(uv.x * asp * 16., uv.y * 16. - uT * 2.2); vec2 id = floor(g), fr = fract(g) - .5; float r = hash(id);
    float em = r > .94 ? smoothstep(.14, 0., length(fr + vec2(sin(uT * 2. + r * 9.) * .25, 0.))) * (1. - uv.y) : 0.;
    gl_FragColor = pm(col * f * .8 + vec3(1., .6, .2) * em, f * .8 + em * .9);
  }`,
  // вода внизу с бликами-каустикой
  water: `void main(){
    vec2 uv = gl_FragCoord.xy / uRes; float asp = uRes.x / uRes.y;
    vec2 q = uv * vec2(asp, 1.) * 3.;
    float c = 0.;
    for (int i = 0; i < 4; i++) { q += vec2(sin(q.y * 1.7 + uT * .55), cos(q.x * 1.5 - uT * .45)) * .35; c += abs(sin(q.x + q.y)); }
    c = pow(1. - c / 4. * .92, 3.);
    float wave = .24 + .025 * sin(uv.x * 14. + uT * 1.3) + .02 * sin(uv.x * 31. - uT * 1.9);
    float band = smoothstep(wave + .02, wave - .14, uv.y);
    vec3 col = mix(vec3(.02, .14, .3), vec3(.35, .85, 1.), c);
    float a = band * (.3 + c * .5);
    gl_FragColor = pm(col * a, a);
  }`
}

let gl = null, prog = null, raf = 0, last = 0, t0 = 0, g2 = null
let W = 0, H = 0, K = 1 // размер 2D-холста в его пикселях и сколько их в CSS-пикселе

function initGL() {
  gl = glc.value.getContext('webgl', { premultipliedAlpha: true, antialias: false })
  if (!gl) return false
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s }
  prog = gl.createProgram()
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }'))
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, COMMON + SHADERS[props.kind]))
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { gl = null; return false }
  gl.useProgram(prog)
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
  const loc = gl.getAttribLocation(prog, 'p')
  gl.enableVertexAttribArray(loc)
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
  gl.enable(gl.BLEND)
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
  return true
}
function drawGL(t) {
  const c = glc.value
  gl.uniform2f(gl.getUniformLocation(prog, 'uRes'), c.width, c.height)
  gl.uniform1f(gl.getUniformLocation(prog, 'uT'), t)
  gl.clearColor(0, 0, 0, 0)
  gl.clear(gl.COLOR_BUFFER_BIT)
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
}

// случайности с зерном: картинка одна и та же при каждом открытии и пересчёте размеров
function seeded(seed) { return () => ((seed = (seed * 16807) % 2147483647) / 2147483647) }

// края, от которых растут деревья и иней: на широком экране — пустые поля по бокам вёрстки, иначе — края колонки статьи
function edges() {
  const lay = document.querySelector('.w-layout')?.getBoundingClientRect()
  const main = box.value.parentElement.getBoundingClientRect()
  const m = lay ? Math.max(0, lay.left) : 0
  const wide = m >= 120
  return {
    treeL: (wide ? m * 0.5 : main.left + 6) * K, treeR: (wide ? innerWidth - m * 0.5 : main.right - 6) * K,
    frostL: (wide ? 0 : main.left) * K, frostR: (wide ? innerWidth : main.right) * K
  }
}

/* ---------- деревья: растут из нижних углов, качаются, на концах — светящиеся листья ---------- */
// ветка начинает расти, только когда родитель дорос; качание передаётся по цепочке — стыки не рвутся
let trees = []
function buildTrees() {
  const rnd = seeded(7), e = edges()
  const len = Math.min(H * 0.15, 150 * K) * (W / K > 700 ? 1 : 0.75)
  trees = [[e.treeL, 0.16], [e.treeR, -0.16]].map(([x, lean]) => {
    const segs = []
    const grow = (parent, ang, l, depth, start) => {
      const dur = 0.22 + depth * 0.05
      const i = segs.push({ parent, ang, len: l, depth, start, dur, w: Math.max(1, depth * 1.8) * K, phase: rnd() * 6 }) - 1
      if (depth <= 0) return
      const n = depth > 6 ? 2 : 2 + (rnd() < 0.3 ? 1 : 0)
      for (let k = 0; k < n; k++) grow(i, (rnd() - 0.5) * 1.1, l * (0.68 + rnd() * 0.12), depth - 1, start + dur)
    }
    grow(-1, lean, len, 9, 0)
    return { x, segs, ends: new Float32Array(segs.length * 3) } // для каждой ветки: конец x, y и итоговый угол
  })
}
function drawTrees(t) {
  const g = g2
  g.clearRect(0, 0, W, H)
  g.lineCap = 'round'
  for (const tr of trees) {
    const glow = g.createRadialGradient(tr.x, H, 0, tr.x, H, 140 * K)
    glow.addColorStop(0, 'rgba(120, 200, 90, .22)')
    glow.addColorStop(1, 'rgba(120, 200, 90, 0)')
    g.fillStyle = glow
    g.fillRect(tr.x - 140 * K, H - 140 * K, 280 * K, 140 * K)
    const E = tr.ends
    tr.segs.forEach((s, i) => {
      const p = Math.max(0, Math.min(1, (t - s.start) / s.dur))
      const px = s.parent < 0 ? tr.x : E[s.parent * 3], py = s.parent < 0 ? H + 4 : E[s.parent * 3 + 1]
      const base = s.parent < 0 ? -Math.PI / 2 : E[s.parent * 3 + 2]
      const ang = base + s.ang + Math.sin(t * 0.8 + s.phase) * 0.012 * (10 - s.depth)
      const l = s.len * (1 - Math.pow(1 - p, 2)) // рост с замедлением к концу
      const x2 = px + Math.cos(ang) * l, y2 = py + Math.sin(ang) * l
      E[i * 3] = x2; E[i * 3 + 1] = y2; E[i * 3 + 2] = ang
      if (!p) return
      g.strokeStyle = s.depth > 5 ? 'rgba(96, 70, 44, .92)' : s.depth > 2 ? 'rgba(112, 120, 70, .85)' : 'rgba(130, 170, 90, .8)'
      g.lineWidth = s.w
      g.beginPath(); g.moveTo(px, py); g.lineTo(x2, y2); g.stroke()
      if (s.depth <= 1 && p >= 1) { // лист распускается, потом мерцает
        const open = Math.min(1, (t - s.start - s.dur) / 0.6)
        const pulse = 0.55 + 0.45 * Math.sin(t * 2 + s.phase)
        g.fillStyle = `rgba(155, 224, 122, ${0.35 * pulse * open})`
        g.beginPath(); g.arc(x2, y2, (5 + 3 * pulse) * K * open, 0, Math.PI * 2); g.fill()
        g.fillStyle = `rgba(230, 255, 190, ${0.6 * pulse * open})`
        g.beginPath(); g.arc(x2, y2, 1.6 * K, 0, Math.PI * 2); g.fill()
      }
    })
  }
}

/* ---------- лёд: друзы ледяных кристаллов в нижних углах, края экрана подёрнуты инеем, ледяная пыль ---------- */
let crystals = [], rime = null, dust = [], iceAnchors = []
function buildIce() {
  const rnd = seeded(11), e = edges()
  crystals = []
  iceAnchors = [e.treeL, e.treeR]
  const big = Math.min(H * 0.4, 330 * K) * (W / K > 700 ? 1 : 0.7)
  for (const ax of [e.treeL, e.treeR]) {
    // крупные кристаллы веером, у основания — мелкие осколки
    for (const [n, scale, spread] of [[9, 1, 1.5], [8, 0.38, 2.2]]) {
      for (let i = 0; i < n; i++) {
        const s = (i / (n - 1) - 0.5) * spread + (rnd() - 0.5) * 0.18
        const len = big * scale * (1 - Math.abs(s) * 0.4) * (0.6 + rnd() * 0.45)
        crystals.push({
          x: ax + s * 46 * K + (rnd() - 0.5) * 20 * K, ang: -Math.PI / 2 + s, len, w: len * (0.13 + rnd() * 0.06),
          at: rnd() * 1.1 + Math.abs(s) * 0.5 + (scale < 1 ? 0.6 : 0), ph: rnd()
        })
      }
    }
  }
  crystals.sort((a, b) => b.len - a.len) // крупные позади
  // иней по краям экрана: холодная дымка и мелкая «изморозь» — рисуем один раз
  rime = document.createElement('canvas')
  rime.width = W; rime.height = H
  const rg = rime.getContext('2d')
  for (const [x0, x1] of [[0, 150 * K], [W, W - 150 * K]]) {
    const gr = rg.createLinearGradient(x0, 0, x1, 0)
    gr.addColorStop(0, 'rgba(160, 210, 255, .13)')
    gr.addColorStop(1, 'rgba(160, 210, 255, 0)')
    rg.fillStyle = gr
    rg.fillRect(Math.min(x0, x1), 0, 150 * K, H)
  }
  rg.lineCap = 'round'
  for (let i = 0; i < 1400; i++) {
    const side = rnd() < 0.5, d = Math.pow(rnd(), 2.2) * 170 * K
    const x = side ? d : W - d, y = rnd() * H
    const a = rnd() * Math.PI, l = (2 + rnd() * 7) * K * (1 - d / (190 * K))
    rg.strokeStyle = `rgba(210, 236, 255, ${0.08 + 0.22 * (1 - d / (170 * K))})`
    rg.lineWidth = 0.7 * K
    rg.beginPath(); rg.moveTo(x - Math.cos(a) * l, y - Math.sin(a) * l); rg.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); rg.stroke()
  }
  dust = Array.from({ length: Math.round((W / K) / 22) }, () => ({ x: rnd() * W, y: rnd() * H, r: (0.4 + rnd() * 0.9) * K, v: (6 + rnd() * 10) * K, s: rnd() * 6 }))
}
function drawCrystal(g, c, t) {
  const p = Math.max(0, Math.min(1, (t - c.at) / 1.6))
  if (!p) return
  const L = c.len * (1 - Math.pow(1 - p, 3))
  const dx = Math.cos(c.ang), dy = Math.sin(c.ang), nx = -dy, ny = dx
  const hw = (c.w / 2) * Math.min(1, 0.4 + p), bx = c.x, by = H + 6
  const sh = Math.max(L * 0.45, L - c.w * 0.9) // где грани сходятся к острию
  const P = [[bx - nx * hw, by - ny * hw], [bx + dx * sh - nx * hw, by + dy * sh - ny * hw], [bx + dx * L, by + dy * L], [bx + dx * sh + nx * hw, by + dy * sh + ny * hw], [bx + nx * hw, by + ny * hw]]
  const poly = pts => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath() }
  const gr = g.createLinearGradient(bx, by, bx + dx * L, by + dy * L)
  gr.addColorStop(0, 'rgba(50, 110, 200, .14)')
  gr.addColorStop(0.65, 'rgba(140, 200, 255, .24)')
  gr.addColorStop(1, 'rgba(225, 245, 255, .5)')
  poly(P); g.fillStyle = gr; g.fill()
  // теневая грань — объём призмы
  poly([P[0], P[1], P[2], [bx, by]]); g.fillStyle = 'rgba(10, 40, 90, .22)'; g.fill()
  poly(P); g.strokeStyle = 'rgba(190, 228, 255, .55)'; g.lineWidth = 1 * K; g.stroke()
  g.strokeStyle = 'rgba(235, 250, 255, .35)'
  g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + dx * L, by + dy * L); g.stroke()
  if (p >= 1) { // свет медленно бежит вверх по ребру
    const u = (t * 0.12 + c.ph) % 1, gx = bx + dx * L * u, gy = by + dy * L * u
    const gl = g.createRadialGradient(gx, gy, 0, gx, gy, 14 * K)
    gl.addColorStop(0, `rgba(235, 248, 255, ${0.45 * Math.sin(u * Math.PI)})`)
    gl.addColorStop(1, 'rgba(235, 248, 255, 0)')
    g.fillStyle = gl
    g.fillRect(gx - 14 * K, gy - 14 * K, 28 * K, 28 * K)
  }
}
function drawIce(t, dt) {
  const g = g2
  g.clearRect(0, 0, W, H)
  g.globalAlpha = Math.min(1, t / 2)
  g.drawImage(rime, 0, 0)
  g.globalAlpha = 1
  for (const ax of iceAnchors) {
    const glow = g.createRadialGradient(ax, H, 0, ax, H, 180 * K)
    glow.addColorStop(0, 'rgba(120, 190, 255, .2)')
    glow.addColorStop(1, 'rgba(120, 190, 255, 0)')
    g.fillStyle = glow
    g.fillRect(ax - 180 * K, H - 180 * K, 360 * K, 180 * K)
  }
  g.lineJoin = 'round'
  for (const c of crystals) drawCrystal(g, c, t)
  g.fillStyle = 'rgba(225, 240, 255, .5)'
  g.beginPath()
  for (const f of dust) {
    f.y += f.v * dt
    if (f.y > H + 4) { f.y = -4; f.x = Math.random() * W }
    const x = f.x + Math.sin(t * 0.5 + f.s) * 14 * K
    g.moveTo(x + f.r, f.y); g.arc(x, f.y, f.r, 0, Math.PI * 2)
  }
  g.fill()
}

/* ---------- гроза: тучи плывут, косой дождь, ветвистые молнии ---------- */
let clouds = null, rain = [], bolts = [], flash = 0, nextBolt = 2
function buildStorm() {
  const rnd = seeded(5)
  clouds = document.createElement('canvas')
  clouds.width = W; clouds.height = Math.round(H * 0.42)
  const cg = clouds.getContext('2d')
  // тучу собираем из мягких пятен; каждое рисуем ещё и со сдвигом на ширину — слой зацикливается без шва
  for (let i = 0; i < 60; i++) {
    const x = rnd() * W, y = clouds.height * (0.05 + rnd() * 0.45), r = (90 + rnd() * 160) * K
    const dark = rnd() < 0.5
    for (const dx of [-W, 0, W]) {
      const gr = cg.createRadialGradient(x + dx, y, 0, x + dx, y, r)
      gr.addColorStop(0, dark ? 'rgba(18, 16, 34, .55)' : 'rgba(64, 58, 104, .32)')
      gr.addColorStop(1, 'rgba(20, 18, 40, 0)')
      cg.fillStyle = gr
      cg.fillRect(x + dx - r, y - r, r * 2, r * 2)
    }
  }
  rain = Array.from({ length: Math.round((W / K) / 9) }, () => ({ x: rnd() * W, y: rnd() * H, l: (10 + rnd() * 16) * K, v: (420 + rnd() * 260) * K }))
}
// ломаная молния: делим отрезок пополам и сдвигаем середину вбок, пока не станет мелко
function jag(ax, ay, bx, by, d, out) {
  const len = Math.hypot(bx - ax, by - ay)
  if (len < 10 * K) { out.push([bx, by]); return }
  const mx = (ax + bx) / 2 + (Math.random() - 0.5) * d, my = (ay + by) / 2 + (Math.random() - 0.5) * d * 0.3
  jag(ax, ay, mx, my, d / 2, out)
  jag(mx, my, bx, by, d / 2, out)
}
function strike(x, y) {
  thunder(0.7 + Math.random() * 0.5)
  const x0 = x + (Math.random() - 0.5) * W * 0.12, y0 = -12 * K // бьёт из-за верхнего края, из туч
  const main = [[x0, y0]]
  jag(x0, y0, x, y, Math.max(80 * K, (y - y0) * 0.35), main)
  const branches = []
  for (let i = 0; i < 3; i++) {
    const [sx, sy] = main[Math.floor(main.length * (0.2 + Math.random() * 0.5))]
    const dir = Math.random() < 0.5 ? -1 : 1, l = (60 + Math.random() * 120) * K
    const b = [[sx, sy]]
    jag(sx, sy, sx + dir * l, sy + l * (0.6 + Math.random() * 0.6), l * 0.5, b)
    branches.push(b)
  }
  bolts.push({ main, branches, life: 1 })
  flash = 1
}
function drawStorm(t, dt) {
  const g = g2
  g.clearRect(0, 0, W, H)
  if (!still) {
    if (t > nextBolt) { strike(W * (0.08 + Math.random() * 0.84), H * (0.55 + Math.random() * 0.4)); nextBolt = t + 4 + Math.random() * 6 }
    flash = Math.max(0, flash - dt * 3.2)
  }
  // тучи: два экземпляра слоя едут влево; во вспышке подсвечиваются изнутри
  const off = (t * 9 * K) % W
  g.drawImage(clouds, -off, 0); g.drawImage(clouds, W - off, 0)
  if (flash > 0) {
    g.globalCompositeOperation = 'lighter'
    g.globalAlpha = flash * 0.5
    g.drawImage(clouds, -off, 0); g.drawImage(clouds, W - off, 0)
    g.globalAlpha = 1
    g.globalCompositeOperation = 'source-over'
    g.fillStyle = `rgba(190, 200, 255, ${flash * 0.06})`
    g.fillRect(0, 0, W, H)
  }
  // косой дождь — одним путём, это дёшево
  g.strokeStyle = 'rgba(170, 190, 255, .22)'
  g.lineWidth = 1 * K
  g.beginPath()
  for (const d of rain) {
    if (!still) { d.y += d.v * dt; d.x -= d.v * dt * 0.18 }
    if (d.y > H) { d.y = -d.l; d.x = Math.random() * W * 1.1 }
    if (d.x < -20) d.x += W
    g.moveTo(d.x, d.y); g.lineTo(d.x + d.l * 0.18, d.y - d.l)
  }
  g.stroke()
  // молнии: широкое свечение, ореол и белая сердцевина; гаснут с двойным миганием
  g.lineCap = 'round'; g.lineJoin = 'round'
  for (const b of bolts) {
    b.life -= dt * 2.2
    const a = b.life > 0.75 ? 1 : b.life > 0.6 ? 0.25 : b.life > 0.45 ? 0.9 : Math.max(0, b.life * 1.6)
    if (a <= 0) continue
    for (const [w, col] of [[12, `rgba(140, 120, 255, ${0.12 * a})`], [5, `rgba(185, 195, 255, ${0.4 * a})`], [1.8, `rgba(255, 255, 255, ${a})`]]) {
      g.strokeStyle = col
      for (const [pts, scale] of [[b.main, 1], ...b.branches.map(p => [p, 0.55])]) {
        g.lineWidth = w * scale * K
        g.beginPath()
        pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)))
        g.stroke()
      }
    }
  }
  bolts = bolts.filter(b => b.life > 0)
}

/* ---------- размеры и кадр ---------- */
function size() {
  const el = box.value
  if (!el) return
  if (glc.value) {
    glc.value.width = Math.max(1, Math.round(el.clientWidth * 0.5))
    glc.value.height = Math.max(1, Math.round(el.clientHeight * 0.5))
    gl?.viewport(0, 0, glc.value.width, glc.value.height)
  }
  if (c2.value) {
    K = Math.min(devicePixelRatio || 1, 1.5)
    W = c2.value.width = Math.max(1, Math.round(el.clientWidth * K))
    H = c2.value.height = Math.max(1, Math.round(el.clientHeight * K))
    if (props.kind === 'earth') buildTrees()
    if (props.kind === 'water') buildIce()
    if (props.kind === 'air') buildStorm()
  }
}

function frame(now) {
  raf = still ? 0 : requestAnimationFrame(frame)
  if (now - last < 33) return // ~30 кадров/с
  const dt = last ? Math.min(0.1, (now - last) / 1000) : 0.033
  last = now
  const t = still ? 99 : (now - t0) / 1000
  if (gl) drawGL(still ? 4 : t)
  if (!g2) return
  if (props.kind === 'earth') drawTrees(t)
  else if (props.kind === 'water') drawIce(t, still ? 0 : dt)
  else if (props.kind === 'air') drawStorm(t, still ? 0 : dt)
}

// молния туда, где щёлкнули по странице (не по меню и не по шапке)
function onClick(e) {
  if (props.kind !== 'air' || !box.value || still) return
  const r = box.value.getBoundingClientRect(), m = box.value.parentElement.getBoundingClientRect()
  if (e.clientY < r.top || e.clientX < m.left) return
  strike((e.clientX - r.left) * K, (e.clientY - r.top) * K)
}
const onVis = () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0 } else if (!raf && !still) { last = 0; raf = requestAnimationFrame(frame) } }

onMounted(() => {
  t0 = performance.now()
  if (glc.value) initGL()
  if (c2.value) g2 = c2.value.getContext('2d')
  size()
  raf = requestAnimationFrame(frame)
  if (still) requestAnimationFrame(n => { last = 0; frame(n + 100) })
  window.addEventListener('resize', size)
  window.addEventListener('pointerdown', onClick)
  document.addEventListener('visibilitychange', onVis)
})
onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  window.removeEventListener('resize', size)
  window.removeEventListener('pointerdown', onClick)
  document.removeEventListener('visibilitychange', onVis)
  gl?.getExtension('WEBGL_lose_context')?.loseContext()
})
</script>

<style scoped>
.mb { position: fixed; top: 64px; left: 0; right: 0; bottom: 0; z-index: -1; pointer-events: none; animation: mb-in 1.2s ease both; }
.mb canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
@keyframes mb-in { from { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .mb { animation: none; } }
</style>
