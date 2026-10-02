// Вход мастеров: логины + пароли (scrypt-хэши) в server/data/config.json, токен — HMAC-подпись.
// Мастеров может быть несколько: { users: { login: { hash, v } }, secret }.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const CONFIG_FILE = path.resolve(import.meta.dirname, 'data', 'config.json')
const TOKEN_TTL = 30 * 24 * 3600 * 1000

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function readConfig() {
  if (!fs.existsSync(CONFIG_FILE)) return null
  const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))
  // старый формат: один мастер { login, passwordHash, tokenVersion }
  if (!cfg.users && cfg.login) {
    cfg.users = { [cfg.login]: { hash: cfg.passwordHash, v: cfg.tokenVersion || 1 } }
    delete cfg.login
    delete cfg.passwordHash
    delete cfg.tokenVersion
  }
  cfg.users ||= {}
  return cfg
}

export function writeConfig(cfg) {
  fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true })
  // доступ ограничивает сама папка data (750, владелец — пользователь службы)
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2))
}

export function hasMasters() {
  const cfg = readConfig()
  return !!cfg && Object.keys(cfg.users).length > 0
}

function safeEqual(a, b) {
  const A = Buffer.from(String(a)), B = Buffer.from(String(b))
  return A.length === B.length && crypto.timingSafeEqual(A, B)
}

// Пустышка, чтобы проверка несуществующего логина шла столько же времени
const DUMMY = hashPassword('dummy-password')

export function checkCredentials(login, password) {
  const cfg = readConfig()
  if (!cfg || typeof login !== 'string' || typeof password !== 'string') return false
  const user = Object.hasOwn(cfg.users, login) ? cfg.users[login] : null
  const [salt, hash] = (user ? user.hash : DUMMY).split(':')
  const candidate = hashPassword(password, salt).split(':')[1]
  return safeEqual(candidate, hash) && !!user
}

const b64 = s => Buffer.from(s).toString('base64url')

// Подпись токена общая для мастеров и игроков: { sub, role, v, exp }
export function signToken(payloadObj) {
  const cfg = readConfig()
  const payload = b64(JSON.stringify({ ...payloadObj, exp: Date.now() + TOKEN_TTL }))
  const sig = crypto.createHmac('sha256', cfg.secret).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

// Только подпись и срок — кто это и действителен ли аккаунт, решает вызывающий
export function readToken(token) {
  const cfg = readConfig()
  if (!cfg?.secret || typeof token !== 'string' || !token.includes('.')) return null
  const [payload, sig] = token.split('.')
  const expected = crypto.createHmac('sha256', cfg.secret).update(payload).digest('base64url')
  if (!safeEqual(sig, expected)) return null
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString())
    return data.exp < Date.now() ? null : data
  } catch {
    return null
  }
}

export function issueToken(login) {
  return signToken({ sub: login, role: 'master', v: readConfig().users[login].v })
}

// Токен мастера (старые токены без v считаются версией 1)
export function verifyToken(token) {
  const data = readToken(token)
  if (!data || (data.role && data.role !== 'master')) return null
  const users = readConfig().users
  const user = Object.hasOwn(users, data.sub) ? users[data.sub] : null
  return user && (data.v ?? 1) === user.v ? data : null
}

// Смена пароля мастера из профиля: старые входы мастера сбрасываются
export function changeMasterPassword(login, oldPassword, newPassword) {
  if (!checkCredentials(login, oldPassword)) return false
  const cfg = readConfig()
  cfg.users[login] = { hash: hashPassword(newPassword), v: (cfg.users[login].v || 1) + 1 }
  writeConfig(cfg)
  return true
}

export function isMasterLogin(login) {
  const cfg = readConfig()
  return !!cfg && Object.hasOwn(cfg.users, login)
}

// Примитивная защита от перебора: 8 попыток за 10 минут с одного IP
const attempts = new Map()
export function loginAllowed(ip) {
  const now = Date.now()
  const list = (attempts.get(ip) || []).filter(t => now - t < 10 * 60 * 1000)
  attempts.set(ip, list)
  return list.length < 8
}
export function recordFailure(ip) {
  attempts.set(ip, [...(attempts.get(ip) || []), Date.now()])
}
