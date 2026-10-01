// Простое хранилище: весь мир в одном JSON-файле, запись атомарная (tmp + rename).
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const DATA_DIR = path.resolve(import.meta.dirname, 'data')
const DB_FILE = path.join(DATA_DIR, 'db.json')
const SEED_FILE = path.resolve(import.meta.dirname, 'seed', 'anacaria.json')
const BACKUP_DIR = path.join(DATA_DIR, 'backups')

export const COLLECTIONS = ['states', 'cities', 'roads', 'anomalies', 'parties', 'fog']

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
  return db
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
