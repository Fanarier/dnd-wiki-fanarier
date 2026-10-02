// Аккаунты игроков и профили мастеров. Хранятся отдельно от мира (server/data/accounts.json)
// и целиком в браузер никогда не уходят — наружу только публичная часть (имя, раса, аватар, цвет).
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { hashPassword, isMasterLogin } from './auth.js'

const DATA_DIR = path.resolve(import.meta.dirname, 'data')
const FILE = path.join(DATA_DIR, 'accounts.json')
export const AVATAR_DIR = path.join(DATA_DIR, 'avatars')

let acc = null
function load() {
  if (acc) return acc
  acc = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : {}
  acc.players ||= {} // id → { id, login, hash, v, status, character, race, avatar, color, rank, createdAt }
  acc.profiles ||= {} // логин мастера → { displayName, avatar, color }
  return acc
}
function save() {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  const tmp = FILE + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(acc, null, 1))
  fs.renameSync(tmp, FILE)
}

const COLORS = ['#ffd166', '#ff7ac0', '#4fd8ff', '#7ee06a', '#c47aff', '#ff9a4e', '#2fd6b4', '#f2f2f2']
const safeEqual = (a, b) => {
  const A = Buffer.from(String(a)), B = Buffer.from(String(b))
  return A.length === B.length && crypto.timingSafeEqual(A, B)
}

export const LOGIN_RE = /^[\p{L}\p{N}_.-]{3,32}$/u

export function players() {
  return Object.values(load().players)
}
export function getPlayer(id) {
  return load().players[id] || null
}
// персонажи мастеров (linked) по логину не входят — у них нет своего пароля
export function findByLogin(login) {
  const l = String(login || '').toLowerCase()
  return players().find(p => !p.linked && p.login.toLowerCase() === l) || null
}

/* ---------- Квитанция заявки: чтобы страница «ждите» узнала, что заявку одобрили ---------- */
const sha = t => crypto.createHash('sha256').update(String(t)).digest('hex')
export function issueTicket(id) {
  const ticket = crypto.randomBytes(18).toString('base64url')
  updatePlayer(id, { ticketHash: sha(ticket) })
  return ticket
}
export function ticketStatus(ticket) {
  const h = sha(ticket)
  const p = players().find(x => x.ticketHash && x.ticketHash === h)
  return p ? { status: p.status, login: p.login, character: p.character } : null
}

/* ---------- Персонаж мастера: мастер может и играть ---------- */
export function linkedCharacter(masterLogin) {
  return players().find(p => p.linked && p.login === masterLogin) || null
}
export function upsertLinkedCharacter(masterLogin, { character, race }) {
  const name = String(character || '').trim().slice(0, 40)
  if (!name) throw new Error('Напиши имя персонажа')
  const cur = linkedCharacter(masterLogin)
  if (cur) return updatePlayer(cur.id, { character: name, race: String(race || '').trim().slice(0, 40) })
  const id = 'u' + crypto.randomBytes(5).toString('hex')
  load().players[id] = {
    id, login: masterLogin, linked: true, hash: null, v: 1, status: 'active',
    character: name, race: String(race || '').trim().slice(0, 40), avatar: '',
    color: masterProfile(masterLogin).color || COLORS[0], rank: 'bronze', createdAt: Date.now()
  }
  save()
  return load().players[id]
}

// Публичная часть — то, что видят другие (группа заказа, пинги, курсоры)
export function publicPlayer(p) {
  return p && { id: p.id, character: p.character, race: p.race, avatar: p.avatar, color: p.color, rank: p.rank }
}

export function register({ login, password, character, race }) {
  if (!LOGIN_RE.test(login || '')) throw new Error('Логин: 3–32 символа — буквы, цифры, _ . -')
  if (String(password || '').length < 6) throw new Error('Пароль — минимум 6 символов')
  if (isMasterLogin(login) || findByLogin(login)) throw new Error('Такой логин уже занят')
  const name = String(character || '').trim().slice(0, 40)
  if (!name) throw new Error('Напиши имя персонажа')
  const pendingCount = players().filter(p => p.status === 'pending').length
  if (pendingCount >= 50) throw new Error('Слишком много заявок ждут мастера — попробуй позже')
  const id = 'u' + crypto.randomBytes(5).toString('hex')
  const p = {
    id, login, hash: hashPassword(password), v: 1, status: 'pending',
    character: name, race: String(race || '').trim().slice(0, 40), avatar: '',
    color: COLORS[players().length % COLORS.length], rank: 'bronze', createdAt: Date.now()
  }
  load().players[id] = p
  save()
  return p
}

const DUMMY = hashPassword('dummy-password')
// Проверка пароля игрока; статус (ждёт / отклонён) решает вызывающий
export function checkPlayer(login, password) {
  const p = findByLogin(login)
  const [salt, hash] = (p?.hash ? p.hash : DUMMY).split(':')
  const ok = safeEqual(hashPassword(String(password || ''), salt).split(':')[1], hash)
  return ok && p?.hash ? p : null
}

export function updatePlayer(id, patch) {
  const p = getPlayer(id)
  if (!p) return null
  Object.assign(p, patch)
  save()
  return p
}

export function setPlayerPassword(id, password) {
  const p = getPlayer(id)
  p.hash = hashPassword(password)
  p.v = (p.v || 1) + 1 // выкидывает со всех устройств
  save()
}

export function removePlayer(id) {
  const p = getPlayer(id)
  if (!p) return false
  if (p.avatar) try { fs.unlinkSync(path.join(AVATAR_DIR, p.avatar)) } catch { /* нет файла */ }
  delete load().players[id]
  save()
  return true
}

export function masterProfile(login) {
  return { displayName: login, avatar: '', color: '#e7c56f', ...(load().profiles[login] || {}) }
}
export function updateMasterProfile(login, patch) {
  load().profiles[login] = { ...masterProfile(login), ...patch }
  save()
  return load().profiles[login]
}

/* ---------- аватарки: data URL → файл, тип проверяем по содержимому ---------- */
const MAGIC = {
  png: b => b.length > 8 && b.readUInt32BE(0) === 0x89504e47,
  jpg: b => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  webp: b => b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP',
  gif: b => b.length > 6 && b.toString('ascii', 0, 4) === 'GIF8'
}
export function saveAvatar(dataUrl, oldFile) {
  const m = /^data:image\/[a-z+]+;base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''))
  if (!m) throw new Error('Аватарка: нужна картинка')
  const buf = Buffer.from(m[1], 'base64')
  if (buf.length > 600 * 1024) throw new Error('Аватарка слишком большая')
  const ext = Object.keys(MAGIC).find(k => MAGIC[k](buf))
  if (!ext) throw new Error('Аватарка: PNG, JPG, WebP или GIF')
  fs.mkdirSync(AVATAR_DIR, { recursive: true })
  const file = crypto.randomBytes(8).toString('hex') + '.' + ext
  fs.writeFileSync(path.join(AVATAR_DIR, file), buf)
  if (oldFile) try { fs.unlinkSync(path.join(AVATAR_DIR, oldFile)) } catch { /* нет файла */ }
  return file
}
