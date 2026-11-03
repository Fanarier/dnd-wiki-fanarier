// Фон школ магии, у которых нет записи: звук собирается в браузере (Web Audio) — гул, шум, колокольчики,
// шёпот, щелчки. У каждой школы свой рецепт, чтобы её было слышно с закрытыми глазами:
// магма — тёплый гул и мягкие бульки, лёд — звенит на ветру, земля — рокочет и осыпается, свет — хор, тьма — гул и шёпот,
// порядок — часы и колокол, хаос — сбивчивые всплески, призыв — пульс и восходящие волны, зачарование — переливы,
// разум — медленные отзвуки, аркана — звёздный звон, гримуар — свеча и шорох страниц.
// make(kind, ctx, out) → stop(): всё подключается к out (общая громкость фона), stop гасит таймеры и узлы.

const PENTA = [0, 2, 4, 7, 9]
const hz = (base, semi) => base * Math.pow(2, semi / 12)
const pick = a => a[Math.floor(Math.random() * a.length)]
const rand = (a, b) => a + Math.random() * (b - a)

// шум для петли: длинный и без шва — конец плавно перетекает в начало (иначе на стыке щелчок и слышно повтор)
function noiseBuf(ctx, kind = 'white', sec = 9) {
  const n = Math.round(ctx.sampleRate * sec), F = Math.round(ctx.sampleRate * 0.5)
  const x = new Float32Array(n + F)
  let last = 0, p0 = 0, p1 = 0, p2 = 0
  for (let i = 0; i < n + F; i++) {
    const w = Math.random() * 2 - 1
    if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; x[i] = last * 3.5 } else if (kind === 'pink') {
      p0 = 0.997 * p0 + w * 0.029591; p1 = 0.985 * p1 + w * 0.032534; p2 = 0.95 * p2 + w * 0.048056
      x[i] = (p0 + p1 + p2 + w * 0.05) * 0.9
    } else x[i] = w
  }
  const b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0)
  for (let i = 0; i < n; i++) {
    if (i >= F) { d[i] = x[i]; continue }
    // начало = смесь начала и «продолжения» конца: сыграв последний отсчёт, петля попадает ровно в его продолжение
    const k = i / F, a = Math.sin(k * Math.PI / 2), bb = Math.cos(k * Math.PI / 2)
    d[i] = x[i] * a + x[n + i] * bb
  }
  return b
}

function kit(ctx, out) {
  const nodes = [], timers = []
  const bufs = {}
  const buf = k => (bufs[k] ||= noiseBuf(ctx, k))
  const keep = n => { nodes.push(n); return n }
  const gain = (v, to = out) => { const g = keep(ctx.createGain()); g.gain.value = v; g.connect(to); return g }
  const filt = (type, f, q = 1, to) => { const x = keep(ctx.createBiquadFilter()); x.type = type; x.frequency.value = f; x.Q.value = q; if (to) x.connect(to); return x }
  // постоянный шум через фильтр
  const noise = (k, type, f, q, v, to = out) => {
    const s = keep(ctx.createBufferSource()); s.buffer = buf(k); s.loop = true
    const g = gain(v, to), fl = filt(type, f, q, g)
    s.connect(fl); s.start()
    return { src: s, f: fl, g }
  }
  const osc = (type, f, v, to = out) => { const o = keep(ctx.createOscillator()); o.type = type; o.frequency.value = f; const g = gain(v, to); o.connect(g); o.start(); return { o, g } }
  // медленное покачивание параметра
  const lfo = (param, rate, depth) => { const o = keep(ctx.createOscillator()); o.frequency.value = rate; const g = keep(ctx.createGain()); g.gain.value = depth; o.connect(g); g.connect(param); o.start() }
  // короткий звук: нота с затуханием
  const ping = (f, { type = 'sine', v = 0.2, a = 0.01, d = 1.5, to = out, glide = 0, when = 0 } = {}) => {
    const t = ctx.currentTime + when
    const o = ctx.createOscillator(), g = ctx.createGain()
    o.type = type; o.frequency.setValueAtTime(f, t)
    if (glide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * glide), t + d)
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d)
    o.connect(g); g.connect(to); o.start(t); o.stop(t + a + d + 0.05)
  }
  // колокол: частотная модуляция, неровные обертоны
  const bell = (f, v = 0.15, d = 3, to = out) => {
    const t = ctx.currentTime
    const c = ctx.createOscillator(), m = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain()
    c.frequency.value = f; m.frequency.value = f * 1.41; mg.gain.setValueAtTime(f * 2, t); mg.gain.exponentialRampToValueAtTime(1, t + d)
    m.connect(mg); mg.connect(c.frequency)
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + d)
    c.connect(g); g.connect(to); c.start(t); m.start(t); c.stop(t + d + 0.1); m.stop(t + d + 0.1)
  }
  // всплеск шума: щелчок, шорох, шёпот
  const burst = (k, type, f, q, v, a, d, to = out, fTo = 0) => {
    const t = ctx.currentTime
    const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain()
    s.buffer = buf(k); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q
    if (fTo) fl.frequency.exponentialRampToValueAtTime(fTo, t + a + d)
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d)
    s.connect(fl); fl.connect(g); g.connect(to); s.start(t, Math.random() * 3); s.stop(t + a + d + 0.05)
  }
  // эхо (для переливов и отзвуков)
  const echo = (time, fb, wet) => {
    const d = keep(ctx.createDelay(2)), f = keep(ctx.createGain()), w = keep(ctx.createGain()), lp = filt('lowpass', 3000)
    d.delayTime.value = time; f.gain.value = fb; w.gain.value = wet
    d.connect(lp); lp.connect(f); f.connect(d); lp.connect(w); w.connect(out)
    return d
  }
  // повторять через случайные промежутки
  const every = (min, max, fn) => {
    let id = 0
    const go = () => { try { fn() } catch { /* узел уже закрыт */ } id = setTimeout(go, rand(min, max) * 1000); timers[slot] = id }
    const slot = timers.push(0) - 1
    id = setTimeout(go, rand(min, max) * 500)
    timers[slot] = id
  }
  const stop = () => {
    for (const id of timers) clearTimeout(id)
    for (const n of nodes) { try { n.stop?.() } catch { /* не запущен */ } try { n.disconnect() } catch { /* уже */ } }
  }
  return { gain, filt, noise, osc, lfo, ping, bell, burst, echo, every, stop }
}

const RECIPES = {
  // лава: глубокий тёплый гул, спокойный низкий фон, редкие мягкие бульки и тихое потрескивание остывающей корки —
  // как у вулкана, но убаюкивает (без резкого шипения)
  magma(k) {
    const r = k.noise('brown', 'lowpass', 110, 0.6, 0.8)
    k.lfo(r.g.gain, 0.05, 0.2)
    const body = k.noise('pink', 'lowpass', 380, 0.5, 0.06)
    k.lfo(body.f.frequency, 0.03, 120)
    const pad = k.gain(0.05)
    k.osc('sine', 55, 0.5, pad); k.osc('sine', 82.4, 0.25, pad)
    k.lfo(pad.gain, 0.04, 0.02)
    const soft = k.filt('lowpass', 520, 0.7, k.gain(1))
    k.every(0.9, 2.8, () => { const n = Math.random() < 0.4 ? 2 : 1; for (let i = 0; i < n; i++) k.ping(rand(60, 120), { v: rand(0.06, 0.12), a: 0.02, d: rand(0.3, 0.55), glide: rand(1.4, 2), to: soft, when: i * rand(0.12, 0.25) }) })
    k.every(5, 11, () => k.burst('pink', 'bandpass', rand(900, 1600), 1.5, 0.025, 0.05, 0.6))
  },
  // лёд: холодный свистящий ветер, звон кристаллов, треск
  ice(k) {
    const w = k.noise('pink', 'bandpass', 1400, 4, 0.12)
    k.lfo(w.f.frequency, 0.07, 700)
    k.lfo(w.g.gain, 0.11, 0.06)
    const e = k.echo(0.42, 0.45, 0.5)
    k.every(0.6, 2.2, () => k.ping(hz(1568, pick(PENTA) + 12 * Math.floor(rand(0, 2))), { v: rand(0.03, 0.08), d: rand(2, 4), to: e }))
    k.every(6, 14, () => k.burst('white', 'highpass', 5000, 1, 0.12, 0.002, 0.08))
  },
  // земля: рокот из глубины, скрежет камня, осыпающиеся камешки
  earth(k) {
    const r = k.noise('brown', 'lowpass', 90, 0.8, 1.1)
    k.lfo(r.g.gain, 0.05, 0.35)
    k.osc('sine', 41, 0.12)
    k.every(4, 9, () => k.burst('brown', 'lowpass', 300, 1, 0.5, 0.6, 2.5, undefined, 120))
    k.every(0.8, 3, () => { const n = Math.floor(rand(2, 6)); for (let i = 0; i < n; i++) k.ping(rand(500, 1400), { type: 'triangle', v: rand(0.02, 0.06), a: 0.002, d: 0.06, when: i * rand(0.04, 0.12) }) })
  },
  // свет: тёплый хор (мажорный аккорд, медленно дышит) и редкие колокольчики сверху
  light(k) {
    const pad = k.gain(0.07)
    for (const s of [0, 4, 7, 11, 12, 16]) { const v = k.osc('sine', hz(220, s), 0.25, pad); k.lfo(v.o.frequency, rand(0.1, 0.3), 0.8) }
    k.lfo(pad.gain, 0.08, 0.025)
    k.noise('pink', 'highpass', 6000, 0.7, 0.012)
    k.every(4, 9, () => k.bell(hz(880, pick([0, 4, 7, 12])), 0.05, 4))
  },
  // тьма: низкий тревожный гул (малая секунда), шёпот, далёкое сердцебиение
  dark(k) {
    const d = k.gain(0.18)
    k.osc('sawtooth', 55, 0.25, k.filt('lowpass', 180, 1, d))
    k.osc('sawtooth', 58.3, 0.2, k.filt('lowpass', 160, 1, d))
    k.lfo(d.gain, 0.06, 0.06)
    k.every(2.5, 6, () => k.burst('white', 'bandpass', rand(900, 2600), 6, 0.05, rand(0.3, 0.8), rand(0.6, 1.4), undefined, rand(600, 3000)))
    k.every(6, 11, () => { k.ping(48, { v: 0.35, a: 0.01, d: 0.25, glide: 0.6 }); k.ping(46, { v: 0.25, a: 0.01, d: 0.25, glide: 0.6, when: 0.28 }) })
  },
  // порядок: ровный ход часов, чистая квинта, колокол каждые несколько тактов
  order(k) {
    const pad = k.gain(0.06)
    k.osc('sine', 196, 0.3, pad); k.osc('sine', 293.7, 0.22, pad); k.osc('sine', 392, 0.12, pad)
    let n = 0
    k.every(1, 1, () => {
      k.burst('white', 'bandpass', n % 2 ? 2600 : 2200, 8, 0.04, 0.004, 0.06)
      if (++n % 8 === 0) k.bell(392, 0.08, 3.5)
    })
  },
  // хаос: неровный гул с дрожью, сбивчивые всплески, обрывки нот
  chaos(k) {
    const d = k.gain(0.1)
    const a = k.osc('sawtooth', 73, 0.2, k.filt('lowpass', 400, 4, d))
    k.lfo(a.o.frequency, 3.3, 9)
    const b = k.osc('square', 109, 0.08, k.filt('bandpass', 600, 3, d))
    k.lfo(b.o.frequency, 0.37, 30)
    k.every(0.3, 1.6, () => k.ping(rand(150, 1600), { type: pick(['square', 'sawtooth', 'triangle']), v: rand(0.02, 0.06), a: 0.003, d: rand(0.04, 0.3), glide: rand(0.3, 3) }))
    k.every(3, 8, () => k.burst('white', pick(['bandpass', 'highpass', 'lowpass']), rand(300, 5000), rand(1, 12), 0.08, 0.01, rand(0.2, 0.9), undefined, rand(200, 6000)))
  },
  // призыв: пульсирующий низкий гул, восходящие волны, низкое пение
  summon(k) {
    const p = k.gain(0.2)
    k.osc('triangle', 65.4, 0.3, p)
    k.lfo(p.gain, 0.5, 0.14)
    const ch = k.osc('sawtooth', 98, 0.06, k.filt('bandpass', 520, 6))
    k.lfo(ch.g.gain, 0.09, 0.04)
    k.every(7, 12, () => k.burst('pink', 'bandpass', 200, 3, 0.12, 2.5, 1.5, undefined, 3200))
  },
  // зачарование: переливы колокольчиков с эхом поверх мягкого фона
  enchant(k) {
    const pad = k.gain(0.05)
    for (const s of [0, 7, 14]) k.osc('triangle', hz(261.6, s), 0.25, k.filt('lowpass', 1200, 0.7, pad))
    const e = k.echo(0.33, 0.5, 0.6)
    k.every(2.5, 5, () => {
      const base = hz(523.3, pick([0, 2, 5]))
      for (let i = 0; i < 5; i++) k.ping(hz(base, PENTA[i] + (i > 2 ? 0 : 12)), { type: 'triangle', v: 0.05, d: 1.2, to: e, when: i * 0.11 })
    })
  },
  // разум: медленные отзвуки нот, лёгкое биение двух близких тонов
  mind(k) {
    const b = k.gain(0.06)
    k.osc('sine', 200, 0.4, b); k.osc('sine', 204.5, 0.4, b)
    const e = k.echo(0.6, 0.55, 0.7)
    let i = 0
    k.every(1.6, 2.4, () => { k.ping(hz(392, [0, 3, 7, 10, 12, 10, 7, 3][i++ % 8]), { v: 0.06, a: 0.05, d: 2.2, to: e }) })
  },
  // аркана: небесный высокий фон, звёздный звон
  arcana(k) {
    const pad = k.gain(0.05)
    for (const s of [0, 7, 12, 19]) { const v = k.osc('sine', hz(440, s), 0.2, pad); k.lfo(v.o.frequency, rand(0.05, 0.2), 1.2) }
    k.lfo(pad.gain, 0.05, 0.02)
    const e = k.echo(0.5, 0.4, 0.5)
    k.every(0.4, 1.6, () => k.ping(rand(2500, 5000), { v: rand(0.015, 0.045), a: 0.002, d: rand(0.4, 1.2), to: e }))
  },
  // гримуар: потрескивание свечи, шорох страниц, низкий зловещий фон
  grimoire(k) {
    k.osc('sine', 61.7, 0.08)
    k.noise('pink', 'lowpass', 500, 0.7, 0.05)
    k.every(0.05, 0.6, () => k.burst('white', 'bandpass', rand(1500, 4000), 2, rand(0.02, 0.07), 0.001, 0.02))
    k.every(6, 13, () => k.burst('pink', 'bandpass', 3000, 0.8, 0.12, 0.08, 0.45, undefined, 1200))
  }
}
export const SYNTH_KINDS = Object.keys(RECIPES)

export function makeSynth(kind, ctx, out) {
  const k = kit(ctx, out)
  RECIPES[kind]?.(k)
  return k.stop
}
