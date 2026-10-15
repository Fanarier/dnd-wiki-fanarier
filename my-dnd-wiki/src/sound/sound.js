// Звуки сайта через Howler.js: короткие эффекты (CC0, Kenney — public/sounds) и фон стихий на страницах
// школ магии — живые записи из public/sounds/amb (зацикливаются). Всё слушается общего выключателя store.sound.
import { Howl, Howler } from 'howler'
import { store } from '../map/store.js'

const FILES = {
  diceGrab: ['dice-grab-1', 'dice-grab-2'], diceShake: 'dice-shake-1', diceThrow: ['dice-throw-1', 'dice-throw-2', 'dice-throw-3'],
  notify: 'bong_001', roll: 'pluck_001', crit: 'confirmation_002', fail: 'error_004',
  // книга листа персонажа (Kenney RPG Audio, CC0)
  bookOpen: 'book-open', bookClose: 'book-close', pageFlip: ['book-flip-1', 'book-flip-2', 'book-flip-3'], bookPlace: 'book-place',
  coins: ['coins-1', 'coins-2']
}
const cache = {}
const howl = (src, opts = {}) => { const key = [].concat(src).join('|'); return (cache[key] ||= new Howl({ src: [].concat(src), volume: 0.55, preload: true, ...opts })) }
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
   Файлы лежат в public/sounds/amb, каждый в двух видах: .ogg (бесшовная петля) и .mp3 (для Safari).
   Петли нарезаны так, что конец плавно перетекает в начало. Пока у стихии нет файла, кнопки звука на её странице нет.
   Для воздуха есть и просто ветер без дождя — 'wind'. */
const AMB_FILES = { fire: 'fire', water: 'water', air: 'wind-rain', earth: 'forest' }
const THUNDER_FAR = ['thunder-1', 'thunder-2'] // молнии сами по себе — гром вдалеке, с задержкой
const THUNDER_NEAR = ['thunder-near'] // молния по щелчку — близкий резкий удар
const srcs = name => [`/sounds/amb/${name}.ogg`, `/sounds/amb/${name}.mp3`]
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
    const h = howl(srcs(AMB_FILES[kind]), { loop: true, volume: 0 })
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
// раскат грома к молнии — пока на странице Школы Воздуха играет фон.
// near — молния по щелчку: сразу и громче; иначе далёкая: звук догоняет вспышку, тише.
// Далёких раскатов одновременно не больше двух — иначе каша; счётчик сбрасывается по таймеру,
// чтобы гром не «застрял», если браузер какой-то звук не сыграл.
let rolling = 0
export function thunder(power = 1, near = false) {
  if (!amb || amb.kind !== 'air') return
  if (!near) {
    if (rolling >= 2) return
    rolling++
    setTimeout(() => { rolling-- }, 7000)
  }
  const play = () => {
    try {
      const h = howl(srcs(pickOne(near ? THUNDER_NEAR : THUNDER_FAR)))
      const id = h.play()
      h.volume(Math.min(1, ambVolume * (near ? 1.3 : 0.55 + 0.35 * power)), id)
    } catch { /* нет звука */ }
  }
  if (near) play()
  else setTimeout(play, 300 + Math.random() * 1200)
}
export const ambienceKind = () => amb?.kind || null

// только в разработке: заглянуть в звук из консоли
if (import.meta.env.DEV) window.__sound = { Howler, ambienceKind }
