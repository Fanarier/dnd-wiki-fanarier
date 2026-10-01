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

export function issueToken(login) {
  const cfg = readConfig()
  const payload = b64(JSON.stringify({ sub: login, role: 'master', exp: Date.now() + TOKEN_TTL, v: cfg.users[login].v }))
  const sig = crypto.createHmac('sha256', cfg.secret).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

export function verifyToken(token) {
  const cfg = readConfig()
  if (!cfg || typeof token !== 'string' || !token.includes('.')) return null
  const [payload, sig] = token.split('.')
  const expected = crypto.createHmac('sha256', cfg.secret).update(payload).digest('base64url')
  if (!safeEqual(sig, expected)) return null
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString())
    const user = Object.hasOwn(cfg.users, data.sub) ? cfg.users[data.sub] : null
    // старые токены (до перехода на нескольких мастеров) могли не содержать v
    if (!user || data.exp < Date.now() || (data.v ?? 1) !== user.v) return null
    return data
  } catch {
    return null
  }
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
