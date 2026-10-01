// Установить логин и пароль мастера:
//   npm run set-password -- <логин> <пароль>
// Все ранее выданные токены (входы на других устройствах) становятся недействительными.
import crypto from 'node:crypto'
import { hashPassword, readConfig, writeConfig } from './auth.js'

const [login, password] = process.argv.slice(2)
if (!login || !password) {
  console.error('Использование: npm run set-password -- <логин> <пароль>')
  process.exit(1)
}
if (password.length < 6) {
  console.error('Пароль слишком короткий (минимум 6 символов)')
  process.exit(1)
}

const old = readConfig()
writeConfig({
  login,
  passwordHash: hashPassword(password),
  secret: old?.secret || crypto.randomBytes(32).toString('hex'),
  tokenVersion: (old?.tokenVersion || 0) + 1
})
console.log(`Готово: мастер «${login}» сохранён в server/data/config.json`)
