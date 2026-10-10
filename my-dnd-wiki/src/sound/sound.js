// Звуки сайта: короткие эффекты (CC0, Kenney — public/sounds) через Howler.js и фон стихий на страницах школ магии,
// синтезированный прямо в браузере (шум с фильтрами). Всё слушается общего выключателя store.sound.
import { Howl, Howler } from 'howler'
import { store } from '../map/store.js'

const FILES = {
  diceShake: 'dice-shake-1', diceThrow: ['dice-throw-1', 'dice-throw-2', 'dice-throw-3'],
  notify: 'bong_001', roll: 'pluck_001', crit: 'confirmation_002', fail: 'error_004', open: 'open_002', close: 'close_002'
}
const cache = {}
const howl = name => (cache[name] ||= new Howl({ src: [`/sounds/${name}.ogg`], volume: 0.55, preload: true }))

// короткий звук; из списка — случайный вариант
export function sfx(key, volume) {
  if (!store.sound) return
  const f = FILES[key]
  if (!f) return
  const name = Array.isArray(f) ? f[Math.floor(Math.random() * f.length)] : f
  try {
    const h = howl(name)
    const id = h.play()
    if (volume != null) h.volume(volume, id)
  } catch { /* браузер не дал звук — не страшно */ }
}


/* ---------- фон стихий (синтез в браузере), у каждой школы свой узнаваемый звук ----------
   огонь — треск поленьев и хлопки; вода и лёд — бульканье ручья, звон и треск льда;
   воздух и молнии — завывание ветра, электрический треск, гром на каждую молнию;
   земля и природа — птицы, шорох листвы, редкий глубокий гул земли */
let amb = null // { kind, nodes, timers, master }
const VOL_KEY = 'anacaria-amb-vol'
let ambVolume = (() => { try { const v = parseFloat(localStorage.getItem(VOL_KEY)); return Number.isFinite(v) ? v : 0.5 } catch { return 0.5 } })()
export const getAmbienceVolume = () => ambVolume
export function setAmbienceVolume(v) {
  ambVolume = Math.max(0, Math.min(1, v))
  try { localStorage.setItem(VOL_KEY, String(ambVolume)) } catch { /* приватный режим */ }
  if (amb) amb.master.gain.setTargetAtTime(ambVolume, Howler.ctx.currentTime, 0.1)
}

function ctx() {
  Howler.volume(Howler.volume()) // будит AudioContext и общий регулятор Howler
  return Howler.ctx
}
// браузер не даёт звук, пока на странице не нажали: будим по первому щелчку или клавише
let unlockArmed = false
export function unlockAudio() {
  const c = ctx()
  if (!c || c.state === 'running') return
  c.resume?.().catch(() => {})
  if (unlockArmed) return
  unlockArmed = true
  const go = () => { c.resume?.().catch(() => {}); if (c.state === 'running') off() }
  const off = () => { for (const ev of ['pointerdown', 'keydown', 'touchstart']) removeEventListener(ev, go, true); unlockArmed = false }
  for (const ev of ['pointerdown', 'keydown', 'touchstart']) addEventListener(ev, go, true)
}

const bufs = {}
function noise(c, kind) {
  if (bufs[kind]) return bufs[kind]
  const len = c.sampleRate * 3, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0)
  let last = 0
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1
    if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5 } else d[i] = w
  }
  return (bufs[kind] = buf)
}
const filt = (c, type, freq, q = 1) => { const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; return f }
const gain = (c, v) => { const g = c.createGain(); g.gain.value = v; return g }
function loop(c, kind, out) { const s = c.createBufferSource(); s.buffer = noise(c, kind); s.loop = true; s.connect(out); s.start(); return s }
// короткий всплеск шума через фильтр (щелчок, хлопок, шорох)
function burst(c, out, { at = 0, freq, q = 3, type = 'bandpass', dur = 0.03, vol = 0.3, attack = 0.002 }) {
  const t = c.currentTime + at, s = c.createBufferSource()
  s.buffer = noise(c, 'white')
  const f = filt(c, type, freq, q), g = gain(c, 0)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  s.connect(f).connect(g).connect(out)
  s.start(t, Math.random() * 2, dur + 0.05)
}
// тон с огибающей и скольжением частоты (пузырь, звон, птица)
function tone(c, out, { at = 0, f0, f1 = f0, f2, dur = 0.1, vol = 0.1, type = 'sine', attack = 0.005 }) {
  const t = c.currentTime + at, o = c.createOscillator(), g = gain(c, 0)
  o.type = type
  o.frequency.setValueAtTime(f0, t)
  if (f2) { o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.5); o.frequency.exponentialRampToValueAtTime(f2, t + dur) } else o.frequency.exponentialRampToValueAtTime(f1, t + dur)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(out)
  o.start(t)
  o.stop(t + dur + 0.05)
}
const rnd = (a, b) => a + Math.random() * (b - a)

export function startAmbience(kind) {
  stopAmbience()
  if (!store.sound) return
  const c = ctx()
  if (!c) return
  unlockAudio()
  const master = gain(c, 0)
  master.connect(Howler.masterGain)
  master.gain.setTargetAtTime(ambVolume, c.currentTime, 0.6) // плавно входим
  const nodes = [master], timers = []
  const every = (fn, min, max) => { const tick = () => { fn(); timers.push(setTimeout(tick, rnd(min, max))) }; timers.push(setTimeout(tick, rnd(min, max))) }

  if (kind === 'fire') {
    // еле слышный низкий гул пламени — основа; главное — треск
    const lp = filt(c, 'lowpass', 160), g = gain(c, 0.08)
    lp.connect(g).connect(master)
    nodes.push(loop(c, 'brown', lp), lp, g)
    // сухой треск: очереди коротких щелчков
    every(() => {
      const n = 1 + Math.floor(Math.random() * 5)
      for (let i = 0; i < n; i++) burst(c, master, { at: i * rnd(0.008, 0.03), freq: rnd(2500, 7000), q: rnd(1.5, 4), dur: rnd(0.004, 0.018), vol: rnd(0.15, 0.45) })
    }, 40, 260)
    // хлопок полена — ниже и громче
    every(() => burst(c, master, { freq: rnd(500, 1300), q: 1.2, dur: rnd(0.04, 0.09), vol: rnd(0.35, 0.6), attack: 0.001 }), 900, 3200)
  } else if (kind === 'water') {
    // тихий ручей и пузыри: тон, быстро скользящий вверх
    const bp = filt(c, 'bandpass', 1300, 0.8), g = gain(c, 0.035)
    bp.connect(g).connect(master)
    nodes.push(loop(c, 'white', bp), bp, g)
    every(() => { const f = rnd(350, 900); tone(c, master, { f0: f, f1: f * rnd(1.8, 2.6), dur: rnd(0.03, 0.07), vol: rnd(0.04, 0.12) }) }, 45, 220)
    // лёд: хрустальный звон и треск
    every(() => { const f = rnd(2400, 4600); tone(c, master, { f0: f, f1: f * 0.995, dur: rnd(1.2, 2.2), vol: rnd(0.02, 0.05), type: 'sine', attack: 0.002 }); tone(c, master, { f0: f * 2.76, f1: f * 2.75, dur: 0.9, vol: 0.012 }) }, 2500, 7000)
    every(() => { for (let i = 0; i < 6; i++) burst(c, master, { at: i * rnd(0.01, 0.04), freq: rnd(3000, 8000), q: 6, dur: 0.012, vol: rnd(0.04, 0.12) }) }, 6000, 15000)
  } else if (kind === 'air') {
    // ветер воет: резонансный полосовой шум, частота «плывёт», порывы
    const bp = filt(c, 'bandpass', 480, 7), g = gain(c, 0.0)
    const lfo = c.createOscillator(), lg = gain(c, 220)
    lfo.frequency.value = 0.07
    lfo.connect(lg).connect(bp.frequency)
    lfo.start()
    const gust = c.createOscillator(), gg = gain(c, 0.14)
    gust.frequency.value = 0.11
    gust.connect(gg).connect(g.gain)
    gust.start()
    g.gain.value = 0.22
    bp.connect(g).connect(master)
    nodes.push(loop(c, 'white', bp), bp, g, lfo, lg, gust, gg)
    // электрический треск в воздухе
    every(() => { const n = 6 + Math.floor(Math.random() * 10); for (let i = 0; i < n; i++) burst(c, master, { at: i * rnd(0.004, 0.012), freq: rnd(4000, 9000), q: 8, dur: 0.006, vol: rnd(0.05, 0.14) }) }, 3500, 9000)
  } else if (kind === 'earth') {
    // птицы: короткие трели из нескольких нот
    every(() => {
      const base = rnd(2200, 3800), notes = 2 + Math.floor(Math.random() * 5)
      for (let i = 0; i < notes; i++) tone(c, master, { at: i * rnd(0.07, 0.13), f0: base * rnd(0.9, 1.1), f1: base * rnd(1.2, 1.5), f2: base * rnd(0.8, 1), dur: rnd(0.06, 0.12), vol: rnd(0.03, 0.06), type: 'sine' })
    }, 1500, 5000)
    // шорох листвы
    every(() => burst(c, master, { freq: rnd(3000, 5500), q: 0.8, type: 'bandpass', dur: rnd(0.25, 0.6), vol: rnd(0.03, 0.07), attack: rnd(0.08, 0.2) }), 2500, 7000)
    // глубокий гул земли — изредка
    every(() => {
      const t = c.currentTime, s = c.createBufferSource(), lp = filt(c, 'lowpass', 90), g = gain(c, 0)
      s.buffer = noise(c, 'brown')
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.5, t + 1.2)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 3.5)
      s.connect(lp).connect(g).connect(master)
      s.start(t, Math.random(), 3.6)
    }, 14000, 30000)
  } else return
  amb = { kind, nodes, timers, master }
}
export function stopAmbience() {
  if (!amb) return
  const { nodes, timers, master } = amb
  amb = null
  timers.forEach(clearTimeout)
  try {
    const c = Howler.ctx
    master.gain.cancelScheduledValues(c.currentTime)
    master.gain.setTargetAtTime(0, c.currentTime, 0.15)
    setTimeout(() => nodes.forEach(n => { try { n.stop?.(); n.disconnect() } catch { /* уже остановлен */ } }), 800)
  } catch { /* нет звука */ }
}
// раскат грома к молнии
export function thunder(power = 1) {
  if (!amb || amb.kind !== 'air') return
  const c = Howler.ctx, t = c.currentTime + rnd(0.15, 0.6)
  const s = c.createBufferSource()
  s.buffer = noise(c, 'brown')
  const lp = filt(c, 'lowpass', 180 + power * 120), g = gain(c, 0)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.9 * power, t + 0.08)
  g.gain.exponentialRampToValueAtTime(0.25 * power, t + 0.6)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6)
  s.connect(lp).connect(g).connect(amb.master)
  s.start(t, Math.random(), 2.8)
  // треск самого разряда — до раската
  for (let i = 0; i < 14; i++) burst(c, amb.master, { at: i * 0.01, freq: rnd(3000, 8000), q: 4, dur: 0.01, vol: 0.18 * power })
}
export const ambienceKind = () => amb?.kind || null

// только в разработке: заглянуть в звук из консоли
if (import.meta.env.DEV) window.__sound = { Howler, ambienceKind }
