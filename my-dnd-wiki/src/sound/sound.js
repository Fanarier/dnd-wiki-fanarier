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

/* ---------- фон стихий: огонь, вода, гроза (дождь + гром), ветер с листвой ---------- */
let amb = null // { kind, nodes, timers, gain }
function ctx() {
  Howler.volume(Howler.volume()) // будит AudioContext и общий регулятор Howler
  return Howler.ctx
}
function noiseBuffer(c, kind) {
  const len = c.sampleRate * 3, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0)
  let last = 0
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1
    if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5 } else d[i] = w
  }
  return buf
}
function loopNoise(c, kind, out) {
  const src = c.createBufferSource()
  src.buffer = noiseBuffer(c, kind)
  src.loop = true
  src.connect(out)
  src.start()
  return src
}
function filter(c, type, freq, q = 1) { const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; return f }
function gainNode(c, v) { const g = c.createGain(); g.gain.value = v; return g }

// треск костра / капли: короткие щелчки шума
function blip(c, out, { freq, q = 4, dur = 0.05, vol = 0.4 }) {
  const t = c.currentTime, src = c.createBufferSource()
  src.buffer = noiseBuffer(c, 'white')
  const f = filter(c, 'bandpass', freq, q), g = gainNode(c, 0)
  g.gain.setValueAtTime(vol, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(f).connect(g).connect(out)
  src.start(t, Math.random() * 2, dur + 0.05)
}

export function startAmbience(kind) {
  stopAmbience()
  if (!store.sound) return
  const c = ctx()
  if (!c) return
  const master = gainNode(c, 0)
  master.connect(Howler.masterGain)
  master.gain.linearRampToValueAtTime(1, c.currentTime + 2) // плавно входим
  const nodes = [master], timers = []
  const every = (fn, min, max) => { const tick = () => { fn(); timers.push(setTimeout(tick, min + Math.random() * (max - min))) }; timers.push(setTimeout(tick, min)) }
  if (kind === 'fire') {
    // гул пламени и треск поленьев
    const body = filter(c, 'lowpass', 420), g = gainNode(c, 0.35)
    body.connect(g).connect(master)
    nodes.push(loopNoise(c, 'brown', body), body, g)
    every(() => blip(c, master, { freq: 1800 + Math.random() * 2500, q: 3, dur: 0.03 + Math.random() * 0.05, vol: 0.12 + Math.random() * 0.2 }), 60, 420)
  } else if (kind === 'water') {
    // журчание: полосовой шум с медленно «плывущей» частотой и редкие капли
    const bp = filter(c, 'bandpass', 700, 0.7), g = gainNode(c, 0.22)
    const lfo = c.createOscillator(), lg = gainNode(c, 300)
    lfo.frequency.value = 0.12
    lfo.connect(lg).connect(bp.frequency)
    lfo.start()
    bp.connect(g).connect(master)
    nodes.push(loopNoise(c, 'white', bp), bp, g, lfo, lg)
    every(() => blip(c, master, { freq: 900 + Math.random() * 1600, q: 18, dur: 0.12, vol: 0.06 }), 300, 1400)
  } else if (kind === 'air') {
    // ровный дождь; гром — по молниям (thunder())
    const hp = filter(c, 'highpass', 900), lp = filter(c, 'lowpass', 7000), g = gainNode(c, 0.16)
    hp.connect(lp).connect(g).connect(master)
    nodes.push(loopNoise(c, 'white', hp), hp, lp, g)
  } else if (kind === 'earth') {
    // ветер в листве: шум с медленными порывами и изредка — птица
    const bp = filter(c, 'bandpass', 500, 0.5), g = gainNode(c, 0.18)
    const lfo = c.createOscillator(), lg = gainNode(c, 0.12)
    lfo.frequency.value = 0.08
    lfo.connect(lg).connect(g.gain)
    lfo.start()
    bp.connect(g).connect(master)
    nodes.push(loopNoise(c, 'brown', bp), bp, g, lfo, lg)
    every(() => {
      const t = c.currentTime, o = c.createOscillator(), og = gainNode(c, 0)
      const f0 = 2200 + Math.random() * 1500
      o.frequency.setValueAtTime(f0, t)
      o.frequency.exponentialRampToValueAtTime(f0 * 1.4, t + 0.08)
      o.frequency.exponentialRampToValueAtTime(f0 * 0.9, t + 0.16)
      og.gain.setValueAtTime(0.0001, t)
      og.gain.exponentialRampToValueAtTime(0.04, t + 0.02)
      og.gain.exponentialRampToValueAtTime(0.0001, t + 0.18)
      o.connect(og).connect(master)
      o.start(t); o.stop(t + 0.2)
    }, 4000, 11000)
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
    master.gain.setValueAtTime(master.gain.value, c.currentTime)
    master.gain.linearRampToValueAtTime(0, c.currentTime + 0.6)
    setTimeout(() => nodes.forEach(n => { try { n.stop?.(); n.disconnect() } catch { /* уже остановлен */ } }), 700)
  } catch { /* нет звука */ }
}
// раскат грома к молнии (громче и ближе, если сила побольше)
export function thunder(power = 1) {
  if (!amb || amb.kind !== 'air') return
  const c = Howler.ctx, t = c.currentTime + 0.15 + Math.random() * 0.5
  const src = c.createBufferSource()
  src.buffer = noiseBuffer(c, 'brown')
  const lp = filter(c, 'lowpass', 180 + power * 120), g = gainNode(c, 0)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.9 * power, t + 0.08)
  g.gain.exponentialRampToValueAtTime(0.25 * power, t + 0.6)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6)
  src.connect(lp).connect(g).connect(amb.master)
  src.start(t, Math.random(), 2.8)
}
export const ambienceKind = () => amb?.kind || null
// только в разработке: заглянуть в звук из консоли
if (import.meta.env.DEV) window.__sound = { Howler, ambienceKind }
