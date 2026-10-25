// Бестиарий: существа и монстры. Хранится в базе мира (db.bestiary), начальные — server/seed/bestiary.json
// (tools/bestiary-xlsx-to-json.py), берутся один раз. Правит только мастер.
// Видимость у каждого существа — два уровня, мастер отмечает игроков (или «всем»):
//   seen — «встретили»: арт, имя, тип, размер, опасность, описание;
//   studied — «изучили»: всё — характеристики, хиты, защиты, слабости, навыки.
// Кто не встретил — видит только силуэт «???» (сколько существ ещё не открыто). Скрытое (hidden) — только мастеру.
// Описания навыков — из общего справочника навыков НПС (server/npcs.js).
import fs from 'node:fs'
import path from 'node:path'
import { cleanRich } from './richtext.js'

const SEED = path.resolve(import.meta.dirname, 'seed', 'bestiary.json')
const S = (v, n) => String(v ?? '').slice(0, n).trim()
const N = v => (v === '' || v == null ? '' : Number.isFinite(Number(v)) ? Number(v) : S(v, 20))
const arr = (v, max, fn) => (Array.isArray(v) ? v.slice(0, max).map(fn) : [])
const names = v => arr(v, 40, x => S(x, 80)).filter(Boolean)
const pairs = v => arr(v, 12, x => ({ k: S(x?.k, 40), v: N(x?.v) })).filter(x => x.k)
const who = v => ({ all: !!v?.all, ids: arr(v?.ids, 60, x => S(x, 40)).filter(Boolean) })
export const LISTS = ['prof', 'saves', 'resist', 'vuln', 'immune', 'passive', 'attacks', 'active', 'legendary', 'mythic']
const ART_MAX = 8

// частичная правка: меняем только присланные поля
function clean(b = {}, old = {}) {
  const has = k => k in b
  const m = { ...old }
  for (const k of ['name', 'group', 'size', 'type', 'race', 'align', 'langs', 'danger']) if (has(k)) m[k] = S(b[k], k === 'name' ? 80 : 60)
  if (has('name') && !m.name) m.name = old.name || 'Существо'
  for (const k of ['hp', 'def', 'eva', 'bm', 'exp']) if (has(k)) m[k] = N(b[k])
  for (const k of ['stats', 'senses', 'speed']) if (has(k)) m[k] = pairs(b[k])
  for (const k of LISTS) if (has(k)) m[k] = names(b[k])
  if (has('desc')) m.desc = cleanRich(b.desc, 20000)
  if (has('secret')) m.secret = S(b.secret, 4000)
  if (has('hidden')) m.hidden = !!b.hidden
  if (has('seen')) m.seen = who(b.seen)
  if (has('studied')) m.studied = who(b.studied)
  if (has('order')) m.order = Number(b.order) || 0
  return m
}
const blank = () => ({
  name: 'Новое существо', group: '', size: '', type: '', race: '', align: '', langs: '', danger: '',
  stats: ['Сила', 'Телосложение', 'Интеллект', 'Харизма', 'Ловкость', 'Мудрость'].map(k => ({ k, v: 10 })),
  hp: '', def: '', eva: '', bm: '', exp: '',
  senses: ['Зрение', 'Слух', 'Аура'].map(k => ({ k, v: 0 })), speed: ['Базовая скорость', 'Полет', 'Плавание'].map(k => ({ k, v: 0 })),
  ...Object.fromEntries(LISTS.map(k => [k, []])),
  desc: '', secret: '', arts: [], hidden: false, seen: { all: false, ids: [] }, studied: { all: false, ids: [] }, order: 0
})

// что видит этот человек: мастер — всё; игрок — по отметкам; остальные — только то, что открыто всем
const knows = (w, u) => !!w && (w.all || (!!u?.id && w.ids.includes(u.id)))
export function beastFor(m, u) {
  if (u?.role === 'master') return m
  const studied = knows(m.studied, u)
  const seen = studied || knows(m.seen, u)
  if (!seen) return { id: m.id, group: m.group, order: m.order, unknown: true }
  const base = { id: m.id, group: m.group, order: m.order, name: m.name, size: m.size, type: m.type, race: m.race, danger: m.danger, desc: m.desc, arts: m.arts, seen: true, studied }
  if (!studied) return base
  const { secret, seen: _s, studied: _t, hidden, ...all } = m
  return { ...all, seen: true, studied: true }
}

export function registerBestiaryRoutes(app, { express, requireMaster, userOf, getDb, saveDb, broadcast, newId, PORTRAIT_DIR, imageExt }) {
  const db = () => getDb()
  // начальные существа из таблицы — один раз
  if (!db().bestiarySeeded) {
    try {
      const seed = JSON.parse(fs.readFileSync(SEED, 'utf8')).mobs || []
      db().bestiary = seed.map((x, i) => ({ id: newId('b'), ...blank(), ...clean(x, blank()), order: i + 1, createdAt: Date.now() }))
    } catch { db().bestiary = db().bestiary || [] }
    db().bestiarySeeded = true
    saveDb()
  }
  db().bestiary ||= []
  const changed = () => { db().bestiaryRev = (db().bestiaryRev || 0) + 1; saveDb(); broadcast() }
  const find = id => db().bestiary.find(m => m.id === id)
  const dropFile = f => { if (f) try { fs.unlinkSync(path.join(PORTRAIT_DIR, path.basename(f))) } catch { /* нет файла */ } }

  app.get('/api/bestiary', (req, res) => {
    const u = userOf(req)
    const list = db().bestiary.filter(m => u?.role === 'master' || !m.hidden).map(m => beastFor(m, u))
    res.json({ rev: db().bestiaryRev || 0, beasts: list })
  })
  app.post('/api/bestiary', requireMaster, (req, res) => {
    const m = { id: newId('b'), ...blank(), ...clean(req.body || {}, blank()), order: Math.max(0, ...db().bestiary.map(x => x.order || 0)) + 1, createdAt: Date.now() }
    db().bestiary.push(m)
    changed()
    res.json(m)
  })
  app.patch('/api/bestiary/:id', requireMaster, (req, res) => {
    const i = db().bestiary.findIndex(m => m.id === req.params.id)
    if (i < 0) return res.status(404).json({ error: 'Существо не найдено' })
    db().bestiary[i] = clean(req.body || {}, db().bestiary[i])
    changed()
    res.json(db().bestiary[i])
  })
  app.delete('/api/bestiary/:id', requireMaster, (req, res) => {
    const m = find(req.params.id)
    if (!m) return res.status(404).json({ error: 'Существо не найдено' })
    for (const a of m.arts || []) { dropFile(a.file); dropFile(a.thumb) }
    db().bestiary = db().bestiary.filter(x => x !== m)
    changed()
    res.json({ ok: true })
  })

  // арты: целиком + лёгкое превью (его делает браузер)
  const saveFile = (m, buf, suffix) => {
    const ext = imageExt(buf)
    if (!ext) return null
    fs.mkdirSync(PORTRAIT_DIR, { recursive: true })
    const file = `mob-${m.id}-${newId('').slice(0, 8)}${suffix}.${ext}`
    fs.writeFileSync(path.join(PORTRAIT_DIR, file), buf)
    return file
  }
  app.post('/api/bestiary/:id/arts', requireMaster, express.raw({ type: () => true, limit: '12mb' }), (req, res) => {
    const m = find(req.params.id)
    if (!m) return res.status(404).json({ error: 'Существо не найдено' })
    m.arts ||= []
    if (m.arts.length >= ART_MAX) return res.status(400).json({ error: `Уже ${ART_MAX} артов` })
    const file = saveFile(m, req.body, '')
    if (!file) return res.status(400).json({ error: 'Нужна картинка PNG, JPG, GIF или WebP' })
    const a = { id: newId('a'), file, thumb: '' }
    m.arts.push(a)
    changed()
    res.json(a)
  })
  app.post('/api/bestiary/:id/arts/:aid/thumb', requireMaster, express.raw({ type: () => true, limit: '3mb' }), (req, res) => {
    const m = find(req.params.id)
    const a = m?.arts?.find(x => x.id === req.params.aid)
    if (!a) return res.status(404).json({ error: 'Арт не найден' })
    const file = saveFile(m, req.body, '-t')
    if (!file) return res.status(400).json({ error: 'Нужна картинка' })
    dropFile(a.thumb)
    a.thumb = file
    changed()
    res.json(a)
  })
  // первый арт — обложка: «сделать главным» переставляет его в начало
  app.post('/api/bestiary/:id/arts/:aid/cover', requireMaster, (req, res) => {
    const m = find(req.params.id)
    const i = m?.arts?.findIndex(x => x.id === req.params.aid) ?? -1
    if (i < 0) return res.status(404).json({ error: 'Арт не найден' })
    m.arts.unshift(...m.arts.splice(i, 1))
    changed()
    res.json({ ok: true })
  })
  app.delete('/api/bestiary/:id/arts/:aid', requireMaster, (req, res) => {
    const m = find(req.params.id)
    const a = m?.arts?.find(x => x.id === req.params.aid)
    if (!a) return res.status(404).json({ error: 'Арт не найден' })
    dropFile(a.file)
    dropFile(a.thumb)
    m.arts = m.arts.filter(x => x !== a)
    changed()
    res.json({ ok: true })
  })
}
