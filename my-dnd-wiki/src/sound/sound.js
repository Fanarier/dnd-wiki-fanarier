// Звуки сайта через Howler.js: короткие эффекты (CC0, Kenney — public/sounds) и фон стихий на страницах
// школ магии — живые записи из public/sounds/amb (зацикливаются). Всё слушается общего выключателя store.sound.
import { Howl, Howler } from 'howler'
import { store } from '../map/store.js'

const FILES = {
  diceGrab: ['dice-grab-1', 'dice-grab-2'], diceShake: 'dice-shake-1', diceThrow: ['dice-throw-1', 'dice-throw-2', 'dice-throw-3'],
  notify: 'bong_001', roll: 'pluck_001', crit: 'confirmation_002', fail: 'error_004',
  // книга листа персонажа (Kenney RPG Audio, CC0)
  bookOpen: 'book-open', bookClose: 'book-close', pageFlip: ['book-flip-1', 'book-flip-2', 'book-flip-3'], bookPlace: 'book-place',
  coins: ['coins-1', 'coins-2'],
  // карточка героя (мини-лист в деятельностях) — Kenney Casino Audio, CC0
  cardTakeOut: 'card-take-out', cardShuffleSplit: 'card-shuffle-1', cardShuffleJoin: 'card-shuffle-2', cardFan: 'card-fan-1',
  cardSlide: ['card-slide-1', 'card-slide-2', 'card-slide-3', 'card-slide-4'], cardPlace: ['card-place-1', 'card-place-2', 'card-place-3', 'card-place-4'],
  cardShove: ['card-shove-1', 'card-shove-2', 'card-shove-3', 'card-shove-4'],
  // порыв ветра (из записи amb/wind) — переход на Карту, облака расходятся
  cloudWhoosh: 'cloud-whoosh',
  // треск разгорающегося костра (из записи amb/fire) — вход во вкладку «Активность»
  campfire: 'campfire'
}
const cache = {}
const howl = (src, opts = {}) => { const key = [].concat(src).join('|'); return (cache[key] ||= new Howl({ src: [].concat(src), volume: 0.55, preload: true, ...opts })) }
const pickOne = f => (Array.isArray(f) ? f[Math.floor(Math.random() * f.length)] : f)

// чтобы повторяющиеся звуки не надоедали: высота и громкость чуть плавают,
// а один и тот же файл два раза подряд не играет (как шаги и страницы в играх)
const VARY = {
  pageFlip: { rate: [0.84, 1.14], vol: 0.3 }, bookPlace: { rate: [0.92, 1.08], vol: 0.15 }, bookOpen: { rate: [0.94, 1.04], vol: 0.1 },
  bookClose: { rate: [0.92, 1.06], vol: 0.12 }, coins: { rate: [0.9, 1.12], vol: 0.2 },
  cardSlide: { rate: [0.9, 1.15], vol: 0.25 }, cardPlace: { rate: [0.9, 1.12], vol: 0.2 }, cardShove: { rate: [0.92, 1.1], vol: 0.2 }, cardFan: { rate: [0.95, 1.05], vol: 0.1 },
  diceGrab: { rate: [0.9, 1.12], vol: 0.25 }, diceShake: { rate: [0.92, 1.1], vol: 0.2 }, diceThrow: { rate: [0.88, 1.12], vol: 0.25 }, roll: { rate: [0.94, 1.06], vol: 0.1 }
}
const lastPick = {}
function pickFor(key, f) {
  if (!Array.isArray(f)) return f
  let i
  do i = Math.floor(Math.random() * f.length)
  while (f.length > 1 && i === lastPick[key])
  lastPick[key] = i
  return f[i]
}

// подгрузить звуки заранее: иначе файл начинает качаться только при первом проигрыше и звук опаздывает
export function preloadSfx(keys) {
  if (!store.sound) return
  try { for (const k of keys) for (const f of [].concat(FILES[k] || [])) howl(`/sounds/${f}.ogg`) } catch { /* нет звука */ }
}

// короткий звук; из списка — случайный вариант (не тот же, что в прошлый раз)
export function sfx(key, volume) {
  if (!store.sound) return
  const f = FILES[key]
  if (!f) return
  try {
    const h = howl(`/sounds/${pickFor(key, f)}.ogg`)
    const id = h.play()
    const v = VARY[key], base = volume ?? 0.55
    h.volume(v ? Math.min(1, base * (1 - v.vol / 2 + Math.random() * v.vol)) : base, id)
    if (v?.rate) h.rate(v.rate[0] + Math.random() * (v.rate[1] - v.rate[0]), id)
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
