<template>
  <!-- живой фон школы магии: огонь, вода с инеем, молнии, растущие деревья. Под текстом, мышь не перехватывает -->
  <canvas ref="cv" class="mb" :class="kind" aria-hidden="true" />
</template>

<script setup>
// Своя WebGL-шейдерная стихия без Three.js (идея — «Elements» из ThreeUI, MIT); деревья — на canvas 2D.
// Рисуем в половинном разрешении, не чаще 30 кадров/с, на скрытой вкладке — пауза,
// «меньше анимаций» в системе — один неподвижный кадр.
import { onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps({ kind: { type: String, required: true } }) // fire | water | air | earth
const cv = ref(null)

const COMMON = `
precision mediump float;
uniform vec2 uRes; uniform float uT; uniform float uFlash; uniform vec2 uBolt;
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
    float a = f * .8 + em * .9;
    gl_FragColor = pm(col * f * .8 + vec3(1., .6, .2) * em, a);
  }`,
  // вода внизу с бликами-каустикой, по краям нарастает иней
  water: `void main(){
    vec2 uv = gl_FragCoord.xy / uRes; float asp = uRes.x / uRes.y;
    vec2 q = uv * vec2(asp, 1.) * 3.;
    float c = 0.;
    for (int i = 0; i < 4; i++) { q += vec2(sin(q.y * 1.7 + uT * .55), cos(q.x * 1.5 - uT * .45)) * .35; c += abs(sin(q.x + q.y)); }
    c = pow(1. - c / 4. * .92, 3.);
    float wave = .3 + .025 * sin(uv.x * 14. + uT * 1.3) + .02 * sin(uv.x * 31. - uT * 1.9);
    float band = smoothstep(wave + .02, wave - .12, uv.y);
    vec3 col = mix(vec3(.02, .14, .3), vec3(.35, .85, 1.), c);
    float a = band * (.32 + c * .5);
    vec3 outc = col * a;
    float e = min(min(uv.x * asp, (1. - uv.x) * asp), 1. - uv.y);
    float fr = fbm(uv * vec2(asp, 1.) * 16. + 3.);
    float grow = .07 + .03 * sin(uT * .25);
    float frost = smoothstep(grow, 0., e - fr * .1) * (.6 + .4 * noise(uv * 90.));
    outc += frost * vec3(.82, .93, 1.) * .55; a = max(a, frost * .55);
    gl_FragColor = pm(outc, a);
  }`,
  // грозовые тучи сверху; молния от тучи к uBolt, uFlash — яркость вспышки
  air: `void main(){
    vec2 uv = gl_FragCoord.xy / uRes; float asp = uRes.x / uRes.y;
    float cl = fbm(vec2(uv.x * asp * 2.5 + uT * .05, uv.y * 3. - uT * .02)) * smoothstep(.45, 1., uv.y);
    vec3 col = vec3(.22, .2, .42) * cl * (1. + uFlash * 1.5); float a = cl * .65;
    if (uFlash > .01) {
      float y = uv.y;
      float x = uBolt.x + (fbm(vec2(y * 5., uBolt.x * 13.)) - .5) * .22 * (1. - y) + (noise(vec2(y * 46., uBolt.x * 7.)) - .5) * .025;
      float d = abs(uv.x - x) * asp, above = step(uBolt.y, y);
      float bx = x + (fbm(vec2(y * 7., uBolt.x * 3.1)) - .3) * .3 * smoothstep(.85, .45, y);
      float db = abs(uv.x - bx) * asp * step(.45, y) * step(y, .85);
      float core = (exp(-d * 700.) + exp(-db * 900.) * .6) * above, glow = exp(-d * 35.) * above;
      col += vec3(.85, .88, 1.) * (core + glow * .35) * uFlash; a += (core + glow * .35) * uFlash;
      col += vec3(.3, .3, .6) * uFlash * .08 * y; a += uFlash * .08 * y;
    }
    gl_FragColor = pm(col, a);
  }`
}

let gl = null, prog = null, raf = 0, last = 0, t0 = 0, ctx2d = null
let flash = 0, bolt = [0.5, 0.2], nextBolt = 0
const still = matchMedia('(prefers-reduced-motion: reduce)').matches

// холст закреплён на экране, но только над колонкой статьи — меню разделов слева не накрываем
function size() {
  const c = cv.value
  if (!c?.parentElement) return
  const r = c.parentElement.getBoundingClientRect()
  c.style.left = r.left + 'px'
  c.style.width = r.width + 'px'
  const k = props.kind === 'earth' ? Math.min(devicePixelRatio || 1, 1.5) : 0.5
  const w = Math.max(1, Math.round(c.clientWidth * k)), h = Math.max(1, Math.round(c.clientHeight * k))
  if (w === c.width && h === c.height) return
  c.width = w
  c.height = h
  gl?.viewport(0, 0, w, h)
  if (props.kind === 'earth') buildTrees()
}
let ro = null

function initGL() {
  gl = cv.value.getContext('webgl', { premultipliedAlpha: true, antialias: false })
  if (!gl) return false
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s }
  prog = gl.createProgram()
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }'))
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, COMMON + SHADERS[props.kind]))
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false
  gl.useProgram(prog)
  const buf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
  const loc = gl.getAttribLocation(prog, 'p')
  gl.enableVertexAttribArray(loc)
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
  gl.enable(gl.BLEND)
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
  return true
}

/* ---------- деревья: растут от краёв, качаются, на концах — светящиеся листья ---------- */
let trees = []
function buildTrees() {
  const c = cv.value, W = c.width, H = c.height
  let seed = 7
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const grow = (x, y, ang, len, depth, out, delay) => {
    const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len
    out.push({ x, y, x2, y2, w: Math.max(1, depth * 1.6), depth, delay, leaf: depth <= 1 })
    if (depth <= 0) return
    const n = depth > 6 ? 2 : 2 + (rnd() < 0.3 ? 1 : 0)
    for (let i = 0; i < n; i++) grow(x2, y2, ang + (rnd() - 0.5) * 1.1, len * (0.68 + rnd() * 0.12), depth - 1, out, delay + 0.18)
  }
  const s = Math.min(W, H) / 900
  trees = [[W * 0.06, -Math.PI / 2 + 0.25], [W * 0.94, -Math.PI / 2 - 0.25]].map(([x, a]) => {
    const segs = []
    grow(x, H + 4, a, 150 * s * (W > 900 ? 1 : 0.8), 9, segs, 0)
    return segs
  })
}
function drawTrees(t) {
  const c = cv.value, g = ctx2d
  g.clearRect(0, 0, c.width, c.height)
  for (const segs of trees) {
    for (const sg of segs) {
      const p = Math.max(0, Math.min(1, (t - sg.delay) / 0.45))
      if (!p) continue
      const sway = Math.sin(t * 0.9 + sg.x * 0.01) * (10 - sg.depth) * 0.6
      const x2 = sg.x + (sg.x2 - sg.x) * p + sway * p, y2 = sg.y + (sg.y2 - sg.y) * p
      g.strokeStyle = sg.depth > 5 ? 'rgba(92, 66, 40, .85)' : 'rgba(120, 150, 80, .75)'
      g.lineWidth = sg.w
      g.lineCap = 'round'
      g.beginPath(); g.moveTo(sg.x + sway * 0.3, sg.y); g.lineTo(x2, y2); g.stroke()
      if (sg.leaf && p >= 1) {
        const pulse = 0.55 + 0.45 * Math.sin(t * 2 + sg.x2 * 0.05)
        g.fillStyle = `rgba(155, 224, 122, ${0.35 * pulse})`
        g.beginPath(); g.arc(x2, y2, 5 + 3 * pulse, 0, Math.PI * 2); g.fill()
        g.fillStyle = `rgba(230, 255, 190, ${0.6 * pulse})`
        g.beginPath(); g.arc(x2, y2, 1.6, 0, Math.PI * 2); g.fill()
      }
    }
  }
}

/* ---------- кадр ---------- */
function frame(now) {
  raf = still ? 0 : requestAnimationFrame(frame)
  if (now - last < 33) return // ~30 кадров/с
  last = now
  const t = (now - t0) / 1000
  if (props.kind === 'earth') return drawTrees(still ? 99 : t)
  if (props.kind === 'air') {
    if (t > nextBolt) { strike(Math.random() * 0.8 + 0.1); nextBolt = t + 3 + Math.random() * 5 }
    flash *= 0.86
  }
  const c = cv.value
  gl.uniform2f(gl.getUniformLocation(prog, 'uRes'), c.width, c.height)
  gl.uniform1f(gl.getUniformLocation(prog, 'uT'), still ? 4 : t)
  gl.uniform1f(gl.getUniformLocation(prog, 'uFlash'), flash)
  gl.uniform2f(gl.getUniformLocation(prog, 'uBolt'), bolt[0], bolt[1])
  gl.clearColor(0, 0, 0, 0)
  gl.clear(gl.COLOR_BUFFER_BIT)
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
}
// молния: случайная или туда, где щёлкнули
function strike(x, y = Math.random() * 0.25) { bolt = [x, y]; flash = 1 }
function onClick(e) {
  if (props.kind !== 'air' || !cv.value) return
  const r = cv.value.getBoundingClientRect()
  if (e.clientY < r.top || e.clientX < r.left || e.clientX > r.right) return
  strike((e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height)
}
const onVis = () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0 } else if (!raf && !still) raf = requestAnimationFrame(frame) }

function start() {
  stop()
  t0 = performance.now()
  if (props.kind === 'earth') ctx2d = cv.value.getContext('2d')
  else if (!initGL()) return
  size()
  raf = requestAnimationFrame(frame)
  if (still) requestAnimationFrame(n => { last = 0; frame(n + 100) })
}
function stop() { cancelAnimationFrame(raf); raf = 0 }

onMounted(() => {
  start()
  window.addEventListener('resize', size)
  ro = new ResizeObserver(() => size())
  ro.observe(cv.value.parentElement)
  window.addEventListener('pointerdown', onClick)
  document.addEventListener('visibilitychange', onVis)
})
onBeforeUnmount(() => {
  stop()
  window.removeEventListener('resize', size)
  ro?.disconnect()
  window.removeEventListener('pointerdown', onClick)
  document.removeEventListener('visibilitychange', onVis)
  gl?.getExtension('WEBGL_lose_context')?.loseContext()
})
</script>

<style scoped>
.mb { position: fixed; top: 64px; left: 0; width: 100%; height: calc(100% - 64px); z-index: -1; pointer-events: none; animation: mb-in 1.2s ease both; }
.mb.fire, .mb.water { opacity: 1; }
.mb.air { opacity: 1; }
@keyframes mb-in { from { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .mb { animation: none; } }
</style>
