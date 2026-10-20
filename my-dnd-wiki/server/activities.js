// Журналы деятельностей героев (то, что раньше писали в Google Таблицу «Деятельности»): что герой делал
// между сессиями — часы, выносливость, тип, результат. Видят все вошедшие; пишет владелец героя (или его листа),
// новая запись — «на проверке», статус ставит мастер. Учтённая запись с привязкой к тренировке листа
// сама прибавляет очки к прогрессу (снятый статус — убавляет). Хранится отдельно: data/activities.json,
// в общем состоянии только activitiesRev.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const DATA_DIR = path.resolve(import.meta.dirname, 'data')
const FILE = path.join(DATA_DIR, 'activities.json')
const SEED = path.resolve(import.meta.dirname, 'seed', 'activities.json')
const BACKUP_DIR = path.join(DATA_DIR, 'backups')
export const ACT_STATUS = ['pending', 'done', 'fail', 'cond', 'cancel']
const TYPES = ['', 'repeat', 'unique']
const PER_HERO = 3000

let store = null
let timer = null
function load() {
  try { store = JSON.parse(fs.readFileSync(FILE, 'utf8')) } catch { store = null }
  if (!store) {
    store = { rev: 1, limit: 336, logs: {} }
    try { store.logs = JSON.parse(fs.readFileSync(SEED, 'utf8')).logs || {} } catch { /* нет переноса — пустые журналы */ }
    console.log('[activities] журналы перенесены из таблицы:', Object.values(store.logs).reduce((n, l) => n + l.length, 0))
    writeNow()
  }
  store.logs ||= {}
  store.limit ||= 336
}
function writeNow() {
  timer = null
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(FILE + '.tmp', JSON.stringify(store))
  fs.renameSync(FILE + '.tmp', FILE)
}
const save = () => { store.rev++; timer ||= setTimeout(writeNow, 400) }
export function flushActivities() { if (timer) { clearTimeout(timer); writeNow() } }
function backup() {
  if (!fs.existsSync(FILE)) return
  fs.mkdirSync(BACKUP_DIR, { recursive: true })
  const target = path.join(BACKUP_DIR, 'activities-' + new Date().toISOString().slice(0, 10) + '.json')
  if (!fs.existsSync(target)) fs.copyFileSync(FILE, target)
  const files = fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith('activities-')).sort()
  for (const old of files.slice(0, -30)) fs.unlinkSync(path.join(BACKUP_DIR, old))
}

const S = (v, n) => String(v ?? '').slice(0, n).trim()
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
// что можно прислать; статус и очки к тренировке — отдельно (их решает мастер)
function clean(b = {}, old = {}) {
  return {
    date: DATE_RE.test(b.date ?? old.date) ? (b.date ?? old.date) : new Date().toISOString().slice(0, 10),
    name: S(b.name ?? old.name, 600) || 'Деятельность',
    hours: S(b.hours ?? old.hours, 30),
    stamina: S(b.stamina ?? old.stamina, 30),
    type: TYPES.includes(b.type ?? old.type) ? (b.type ?? old.type) : '',
    result: S(b.result ?? old.result, 2000),
    trainId: S(b.trainId ?? old.trainId, 40),
    pts: Math.max(-1e6, Math.min(1e6, Math.round(Number(b.pts ?? old.pts) || 0)))
  }
}

export function registerActivityRoutes(app, { requireUser, requireMaster, getDb, broadcast, sheets, notify }) {
  load()
  backup()
  setInterval(backup, 6 * 3600 * 1000)
  const heroes = () => (getDb().heroes || []).filter(h => h.kind === 'character')
  const heroOf = id => heroes().find(h => h.id === id)
  // писать в журнал: мастер, владелец карточки героя или владелец его листа
  const canWrite = (u, h) => !!u && !!h && (u.role === 'master' || h.ownerId === u.id || sheets.ownerOfHero(h.id) === u.id)
  const changed = () => { save(); broadcast() }
  const by = u => ({ id: u.id, name: u.name, role: u.role })

  // учтённая запись с тренировкой → очки в листе; поменялось (статус, очки, тренировка) — разницу туда же
  function syncTraining(h, rec, u) {
    const want = rec.status === 'done' && rec.trainId && rec.pts ? { trainId: rec.trainId, pts: rec.pts } : null
    const had = rec.applied || null
    if (JSON.stringify(want) === JSON.stringify(had && { trainId: had.trainId, pts: had.pts })) return
    if (had) sheets.addTraining(had.sheetId, had.trainId, -had.pts, by(u), `деятельность «${rec.name}» больше не учтена`)
    rec.applied = null
    if (want) {
      const sheetId = sheets.addTraining(sheets.sheetOfHero(h.id), want.trainId, want.pts, by(u), `деятельность «${rec.name}»`)
      if (sheetId) rec.applied = { ...want, sheetId }
    }
  }

  app.get('/api/activities', requireUser, (req, res) => {
    const u = req.user
    res.json({
      rev: store.rev, limit: store.limit,
      heroes: heroes().map(h => {
        const w = canWrite(u, h)
        const sh = sheets.trainingsOfHero(h.id)
        // тренировки листа — тем, кто пишет в журнал (выбрать, куда идут очки), и мастеру
        return { heroId: h.id, name: h.name, canWrite: w, stamina: sh?.stamina ?? null, trainings: w ? sh?.trainings || [] : [] }
      }),
      logs: store.logs
    })
  })

  app.post('/api/activities/:hero', requireUser, (req, res) => {
    const h = heroOf(req.params.hero)
    if (!h) return res.status(404).json({ error: 'Нет такого героя' })
    if (!canWrite(req.user, h)) return res.status(403).json({ error: 'Это не твой герой' })
    const list = (store.logs[h.id] ||= [])
    if (list.length >= PER_HERO) return res.status(400).json({ error: 'Журнал переполнен' })
    const master = req.user.role === 'master'
    const rec = { id: 'a' + crypto.randomBytes(5).toString('hex'), ...clean(req.body), status: master && ACT_STATUS.includes(req.body?.status) ? req.body.status : 'pending', by: req.user.name, at: Date.now() }
    list.push(rec)
    if (master) syncTraining(h, rec, req.user)
    else if (list.filter(x => x.status === 'pending').length === 1) notify('masters', 'activity', `${h.name}: новые деятельности на проверку`, { logHero: h.id })
    changed()
    res.json(rec)
  })

  app.put('/api/activities/:hero/:id', requireUser, (req, res) => {
    const h = heroOf(req.params.hero)
    const rec = store.logs[req.params.hero]?.find(x => x.id === req.params.id)
    if (!h || !rec) return res.status(404).json({ error: 'Запись не найдена' })
    const master = req.user.role === 'master'
    // игрок правит свою запись, пока мастер её не проверил
    if (!master && (!canWrite(req.user, h) || rec.status !== 'pending')) return res.status(403).json({ error: 'Проверенную запись меняет только мастер' })
    Object.assign(rec, clean(req.body, rec))
    if (master && ACT_STATUS.includes(req.body?.status)) rec.status = req.body.status
    if (master) { rec.checkedBy = req.user.name; rec.checkedAt = Date.now() }
    syncTraining(h, rec, req.user)
    changed()
    res.json(rec)
  })

  app.delete('/api/activities/:hero/:id', requireUser, (req, res) => {
    const h = heroOf(req.params.hero)
    const list = store.logs[req.params.hero] || []
    const rec = list.find(x => x.id === req.params.id)
    if (!h || !rec) return res.status(404).json({ error: 'Запись не найдена' })
    if (req.user.role !== 'master' && (!canWrite(req.user, h) || rec.status !== 'pending')) return res.status(403).json({ error: 'Проверенную запись удаляет только мастер' })
    rec.status = 'cancel'
    syncTraining(h, rec, req.user) // очки, если были, снимаются
    store.logs[h.id] = list.filter(x => x !== rec)
    changed()
    res.json({ ok: true })
  })

  // мастер: сколько часов между сессиями (для «Gate» — 336)
  app.put('/api/activities-settings', requireMaster, (req, res) => {
    store.limit = Math.max(1, Math.min(10000, Math.round(Number(req.body?.limit) || 336)))
    changed()
    res.json({ limit: store.limit })
  })

  return { rev: () => store.rev, pending: () => Object.values(store.logs).reduce((n, l) => n + l.filter(x => x.status === 'pending').length, 0) }
}
