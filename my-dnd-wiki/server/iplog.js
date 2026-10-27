// Журнал входов: с каких IP заходит каждый аккаунт (для проверки мастером). Отдельный файл, в общую рассылку не попадает.
// На человека — до 50 адресов: первый и последний раз, сколько раз, браузер. Записи старше 180 дней убираются
import fs from 'node:fs'
import path from 'node:path'

const FILE = path.resolve(import.meta.dirname, 'data', 'iplog.json')
const MAX_PER_USER = 50
const KEEP_MS = 180 * 864e5
let log = {}
try { log = JSON.parse(fs.readFileSync(FILE, 'utf8')) } catch { log = {} }
let timer = null
const save = () => { clearTimeout(timer); timer = setTimeout(() => fs.writeFile(FILE, JSON.stringify(log), () => {}), 2000) }

// настоящий адрес: сервер стоит за своим прокси (Caddy / туннель) — тогда первый из X-Forwarded-For
export function clientIp(req) {
  const raw = req.socket?.remoteAddress || ''
  const local = /^(::1|127\.|::ffff:127\.)/.test(raw)
  const fwd = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim()
  return (local && fwd ? fwd : raw).replace(/^::ffff:/, '')
}

export function noteIp(user, ip, ua = '') {
  if (!user?.id || !ip) return
  const now = Date.now()
  const list = (log[user.id] ||= []).filter(x => now - x.last < KEEP_MS)
  const e = list.find(x => x.ip === ip)
  if (e) { if (now - e.last > 60000) e.n++; e.last = now; e.ua = String(ua).slice(0, 160) }
  else list.push({ ip, first: now, last: now, n: 1, ua: String(ua).slice(0, 160) })
  log[user.id] = list.sort((a, b) => b.last - a.last).slice(0, MAX_PER_USER)
  save()
}

export const ipsOf = id => log[id] || []
export function flushIpLog() { clearTimeout(timer); try { fs.writeFileSync(FILE, JSON.stringify(log)) } catch { /* нет места */ } }
