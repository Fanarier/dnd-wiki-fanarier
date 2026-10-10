// Звуки сайта через Howler.js: короткие эффекты (CC0, Kenney — public/sounds) и фон стихий на страницах
// школ магии — живые записи из public/sounds/amb (зацикливаются). Всё слушается общего выключателя store.sound.
import { Howl, Howler } from 'howler'
import { store } from '../map/store.js'

const FILES = {
  diceGrab: ['dice-grab-1', 'dice-grab-2'], diceShake: 'dice-shake-1', diceThrow: ['dice-throw-1', 'dice-throw-2', 'dice-throw-3'],
  notify: 'bong_001', roll: 'pluck_001', crit: 'confirmation_002', fail: 'error_004'
}
const cache = {}
const howl = (src, opts = {}) => (cache[src] ||= new Howl({ src: [src], volume: 0.55, preload: true, ...opts }))
const pickOne = f => (Array.isArray(f) ? f[Math.floor(Math.random() * f.length)] : f)

// короткий звук; из списка — случайный вариант
export function sfx(key, volume) {
  if (!store.sound) return
  const f = FILES[key]
  if (!f) return
  try {
    const h = howl(`/sounds/${pickOne(f)}.ogg`)
    const id = h.play()
    if (volume != null) h.volume(volume, id)
  } catch { /* браузер не дал звук — не страшно */ }
}

/* ---------- фон стихий: записи по кругу; гром — отдельные записи на каждую молнию ----------
   Файлы лежат в public/sounds/amb. Чтобы добавить или заменить звук — положить файл и вписать имя сюда.
   Пока у стихии нет файла, кнопка звука на её странице не показывается. */
const AMB_FILES = {
  // fire: 'fire.mp3', water: 'water.mp3', air: 'wind.mp3', earth: 'forest.mp3'
}
const THUNDER_FILES = [] // например: ['thunder-1.mp3', 'thunder-2.mp3']
export const hasAmbience = kind => !!AMB_FILES[kind]

const VOL_KEY = 'anacaria-amb-vol'
let ambVolume = (() => { try { const v = parseFloat(localStorage.getItem(VOL_KEY)); return Number.isFinite(v) ? v : 0.5 } catch { return 0.5 } })()
export const getAmbienceVolume = () => ambVolume
let amb = null // { kind, h, id }
export function setAmbienceVolume(v) {
  ambVolume = Math.max(0, Math.min(1, v))
  try { localStorage.setItem(VOL_KEY, String(ambVolume)) } catch { /* приватный режим */ }
  if (amb) amb.h.volume(ambVolume, amb.id)
}

// браузер не даёт звук, пока на странице не нажали: Howler сам ждёт нажатия, а мы ещё и будим контекст
export function unlockAudio() {
  try { if (Howler.ctx?.state === 'suspended') Howler.ctx.resume() } catch { /* нет звука */ }
}

export function startAmbience(kind) {
  if (amb?.kind === kind) return
  stopAmbience()
  if (!store.sound || !AMB_FILES[kind]) return
  try {
    const h = howl(`/sounds/amb/${AMB_FILES[kind]}`, { loop: true, volume: 0 })
    const id = h.play()
    h.fade(0, ambVolume, 1500, id) // плавно входим
    amb = { kind, h, id }
  } catch { amb = null }
}
export function stopAmbience() {
  if (!amb) return
  const { h, id } = amb
  amb = null
  try {
    h.fade(h.volume(id), 0, 700, id)
    setTimeout(() => h.stop(id), 750)
  } catch { /* уже остановлен */ }
}
// раскат грома к молнии — пока на странице Школы Воздуха играет фон
export function thunder(power = 1) {
  if (!amb || amb.kind !== 'air' || !THUNDER_FILES.length) return
  try {
    const h = howl(`/sounds/amb/${pickOne(THUNDER_FILES)}`)
    const id = h.play()
    h.volume(Math.min(1, ambVolume * (0.7 + 0.5 * power)), id)
  } catch { /* нет звука */ }
}
export const ambienceKind = () => amb?.kind || null

// только в разработке: заглянуть в звук из консоли
if (import.meta.env.DEV) window.__sound = { Howler, ambienceKind }
