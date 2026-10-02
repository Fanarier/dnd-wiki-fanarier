// Простое хранилище: весь мир в одном JSON-файле, запись атомарная (tmp + rename).
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const DATA_DIR = path.resolve(import.meta.dirname, 'data')
const DB_FILE = path.join(DATA_DIR, 'db.json')
const SEED_FILE = path.resolve(import.meta.dirname, 'seed', 'anacaria.json')
const BACKUP_DIR = path.join(DATA_DIR, 'backups')

export const COLLECTIONS = ['states', 'cities', 'roads', 'anomalies', 'parties', 'fog', 'labels', 'routes', 'icons', 'quests']
// Свои иконки мастера лежат рядом с базой (служба может писать только в data)
export const ICON_DIR = path.join(DATA_DIR, 'icons')

let db = null
let saveTimer = null

export function loadDb() {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(DB_FILE)) {
    fs.copyFileSync(SEED_FILE, DB_FILE)
    console.log('[db] создан из seed/anacaria.json')
  }
  db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'))
  for (const c of COLLECTIONS) db[c] ||= []
  if (migrate(db)) writeNow()
  return db
}

// Новые поля из seed дописываем в живой мир, ничего из правок мастера не перезаписывая
function migrate(d) {
  const seed = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'))
  let changed = false
  for (const [k, v] of Object.entries(seed.settings)) {
    if (!(k in d.settings)) { d.settings[k] = v; changed = true }
  }
  if (!d.hud && seed.hud) { d.hud = seed.hud; changed = true }
  // разовые поправки: мир переименован в «Анкарию»; масштаб 1 км/px был заглушкой до калибровки (Марико — Сиратори = 30 км)
  if (d.settings.worldName === 'Анакария') { d.settings.worldName = seed.settings.worldName; changed = true }
  if (d.settings.kmPerPx === 1 && seed.settings.kmPerPx !== 1) { d.settings.kmPerPx = seed.settings.kmPerPx; changed = true }
  const seedStates = new Map(seed.states.map(s => [s.id, s]))
  // новые территории из seed (например, выделенная резервация) — дописываем
  const have = new Set(d.states.map(s => s.id))
  for (const st of seed.states) if (!have.has(st.id)) { d.states.push(st); changed = true }
  for (const s of d.states) {
    if (s.label === undefined && seedStates.get(s.id)?.label) { s.label = seedStates.get(s.id).label; changed = true }
  }
  // стартовые заказы гильдий — один раз, пока доска пустая
  const QUESTS_SEED = path.resolve(import.meta.dirname, 'seed', 'quests.json')
  if (!d.questsSeeded && fs.existsSync(QUESTS_SEED)) {
    if (!d.quests?.length) d.quests = JSON.parse(fs.readFileSync(QUESTS_SEED, 'utf8'))
    d.questsSeeded = true
    changed = true
  }
  if (changed) console.log('[db] мир дополнен новыми полями из seed')
  return changed
}

export function getDb() {
  return db
}

export function newId(prefix) {
  return prefix + crypto.randomBytes(5).toString('hex')
}

function writeNow() {
  saveTimer = null
  const tmp = DB_FILE + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(db))
  fs.renameSync(tmp, DB_FILE)
}

export function saveDb() {
  if (!saveTimer) saveTimer = setTimeout(writeNow, 300)
}

export function flushDb() {
  if (saveTimer) { clearTimeout(saveTimer); writeNow() }
}

// Ежедневная копия — на случай, если мастер что-то сломает
export function backupDb() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true })
  const name = 'db-' + new Date().toISOString().slice(0, 10) + '.json'
  const target = path.join(BACKUP_DIR, name)
  if (!fs.existsSync(target)) fs.writeFileSync(target, JSON.stringify(db))
  const files = fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith('db-')).sort()
  for (const old of files.slice(0, -30)) fs.unlinkSync(path.join(BACKUP_DIR, old))
}
