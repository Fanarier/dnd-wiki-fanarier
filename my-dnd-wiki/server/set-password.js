// Мастера сайта:
//   npm run set-password -- <логин> '<пароль>'   — добавить мастера или сменить ему пароль
//   npm run set-password -- --remove <логин>     — удалить мастера
//   npm run set-password -- --list               — список мастеров
// Пароль бери в одинарные кавычки, иначе bash испортит символы вроде $ и !.
// Смена пароля или удаление сразу выкидывает этого мастера со всех устройств.
import crypto from 'node:crypto'
import { hashPassword, readConfig, writeConfig } from './auth.js'

const args = process.argv.slice(2)
const cfg = readConfig() || { users: {}, secret: crypto.randomBytes(32).toString('hex') }
cfg.secret ||= crypto.randomBytes(32).toString('hex')

if (args[0] === '--list') {
  const names = Object.keys(cfg.users)
  console.log(names.length ? 'Мастера: ' + names.join(', ') : 'Мастеров пока нет')
  process.exit(0)
}

if (args[0] === '--remove') {
  const login = args[1]
  if (!login || !cfg.users[login]) {
    console.error(`Мастер «${login}» не найден`)
    process.exit(1)
  }
  delete cfg.users[login]
  writeConfig(cfg)
  console.log(`Мастер «${login}» удалён`)
  process.exit(0)
}

const [login, password] = args
if (!login || !password) {
  console.error("Использование: npm run set-password -- <логин> '<пароль>'")
  process.exit(1)
}
if (!/^[\p{L}\p{N}_.-]{2,32}$/u.test(login)) {
  console.error('Логин: 2–32 символа, буквы, цифры, _ . -')
  process.exit(1)
}
if (password.length < 6) {
  console.error('Пароль слишком короткий (минимум 6 символов)')
  process.exit(1)
}

const existed = !!cfg.users[login]
cfg.users[login] = { hash: hashPassword(password), v: (cfg.users[login]?.v || 0) + 1 }
writeConfig(cfg)
console.log(existed ? `Пароль мастера «${login}» обновлён` : `Мастер «${login}» добавлен`)
console.log(`Длина пароля: ${password.length} — сверь, что bash ничего не съел`)
