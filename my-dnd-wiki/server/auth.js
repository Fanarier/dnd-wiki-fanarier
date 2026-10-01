// Вход мастера: логин + пароль (scrypt-хэш) из server/data/config.json, токен — HMAC-подпись.
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
  return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))
}

export function writeConfig(cfg) {
  fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true })
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2))
}

function safeEqual(a, b) {
  const A = Buffer.from(a), B = Buffer.from(b)
  return A.length === B.length && crypto.timingSafeEqual(A, B)
}

export function checkCredentials(login, password) {
  const cfg = readConfig()
  if (!cfg || typeof login !== 'string' || typeof password !== 'string') return false
  const [salt, hash] = cfg.passwordHash.split(':')
  const candidate = hashPassword(password, salt).split(':')[1]
  // обе проверки выполняются всегда — чтобы по времени ответа нельзя было угадать логин
  const loginOk = safeEqual(login, cfg.login)
  const passwordOk = safeEqual(candidate, hash)
  return loginOk && passwordOk
}

const b64 = s => Buffer.from(s).toString('base64url')

export function issueToken(login) {
  const cfg = readConfig()
  const payload = b64(JSON.stringify({ sub: login, role: 'master', exp: Date.now() + TOKEN_TTL, v: cfg.tokenVersion || 1 }))
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
    if (data.exp < Date.now() || data.v !== (cfg.tokenVersion || 1)) return null
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
