// «Новые арты»: картинки мастера для всех. В игровую базу не входят — свой список (data/arts.json)
// и своя папка; мастер чистит их, когда приходят новые работы.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const DATA_DIR = path.resolve(import.meta.dirname, 'data')
const FILE = path.join(DATA_DIR, 'arts.json')
export const ARTS_DIR = path.join(DATA_DIR, 'arts')

let list = null
function load() {
  if (!list) list = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : []
  return list
}
function save() {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  const tmp = FILE + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(list))
  fs.renameSync(tmp, FILE)
}

export const arts = () => load()

export function addArt(buf, ext, meta) {
  fs.mkdirSync(ARTS_DIR, { recursive: true })
  const id = crypto.randomBytes(6).toString('hex')
  const file = `${id}.${ext}`
  fs.writeFileSync(path.join(ARTS_DIR, file), buf)
  const art = { id, file, thumb: '', size: buf.length, ...meta, createdAt: Date.now() }
  load().push(art)
  save()
  return art
}

// превью для стены артов (оригинал может весить десятки мегабайт)
export function setThumb(id, buf, ext) {
  const art = load().find(a => a.id === id)
  if (!art) return null
  const file = `${id}-t.${ext}`
  fs.writeFileSync(path.join(ARTS_DIR, file), buf)
  if (art.thumb && art.thumb !== file) unlink(art.thumb)
  art.thumb = file
  save()
  return art
}

function unlink(file) {
  try { fs.unlinkSync(path.join(ARTS_DIR, file)) } catch { /* уже нет */ }
}

export function removeArts(ids) {
  const set = ids ? new Set(ids) : null
  const gone = load().filter(a => !set || set.has(a.id))
  for (const a of gone) {
    unlink(a.file)
    if (a.thumb) unlink(a.thumb)
  }
  list = load().filter(a => !gone.includes(a))
  save()
  return gone.length
}
