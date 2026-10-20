// Журналы деятельностей героев (то, что раньше писали в Google Таблицу «Деятельности»): что герой делал
// между сессиями — часы, выносливость, тип, результат. Видят все вошедшие; пишет владелец героя (или его листа).
// Запись игрока — черновик плана («plan») или «на проверке»; статус ставит мастер. Учтённая запись меняет лист:
// очки тренировки, монеты, опыт, изнурение, вещи — снятый статус возвращает всё как было.
// У героя свои настройки (лимит часов, сон, заметки, избранное, запреты мастера); у мастера — закрытый период
// и блокировка следующего. Броски в запись принимаются, только если этот бросок прошёл через общие кубики сайта.
// Хранится отдельно: data/activities.json, в общем состоянии только activitiesRev.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const DATA_DIR = path.resolve(import.meta.dirname, 'data')
const FILE = path.join(DATA_DIR, 'activities.json')
const SEED = path.resolve(import.meta.dirname, 'seed', 'activities.json')
const BACKUP_DIR = path.join(DATA_DIR, 'backups')
export const ACT_STATUS = ['plan', 'pending', 'done', 'fail', 'cond', 'cancel']
const PLAYER_STATUS = ['plan', 'pending'] // игрок только переводит черновик на проверку и обратно
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
  store.cfg ||= {}
  store.lock ||= { until: '', blocked: false, reason: '' }
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
const I = (v, min, max) => Math.max(min, Math.min(max, Math.round(Number(v) || 0)))
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const norm = s => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/g, ' ').trim()
const cleanItems = v => (Array.isArray(v) ? v.slice(0, 20) : []).map(x => ({ name: S(x?.name, 160), qty: I(x?.qty, -1e6, 1e6), stored: !!x?.stored })).filter(x => x.name && x.qty)
// что можно прислать; статус — отдельно
function clean(b = {}, old = {}, heroIds = []) {
  const pick = k => (k in b ? b[k] : old[k])
  return {
    date: DATE_RE.test(pick('date')) ? pick('date') : new Date().toISOString().slice(0, 10),
    day: I(pick('day'), 0, 60), // день периода в планировщике (0 — без дня)
    name: S(pick('name'), 600) || 'Деятельность',
    hours: S(pick('hours'), 30),
    stamina: S(pick('stamina'), 30),
    type: TYPES.includes(pick('type')) ? pick('type') : '',
    result: S(pick('result'), 2000),
    trainId: S(pick('trainId'), 40),
    pts: I(pick('pts'), -1e6, 1e6),
    place: S(pick('place'), 40), // город на карте
    mod: S(pick('mod'), 80), // место-модификатор из вики («Библиотека»…)
    with: [...new Set((Array.isArray(pick('with')) ? pick('with') : []).map(String).filter(id => heroIds.includes(id)))].slice(0, 8),
    gold: I(pick('gold'), -1e7, 1e7), silver: I(pick('silver'), -1e7, 1e7), copper: I(pick('copper'), -1e7, 1e7),
    exp: I(pick('exp'), -1e7, 1e7), exh: I(pick('exh'), 0, 5),
    items: cleanItems(pick('items'))
  }
}
const cleanFav = f => ({ id: S(f?.id, 20) || crypto.randomBytes(4).toString('hex'), name: S(f?.name, 600), hours: S(f?.hours, 30), stamina: S(f?.stamina, 30), type: TYPES.includes(f?.type) ? f.type : '', trainId: S(f?.trainId, 40), mod: S(f?.mod, 80), place: S(f?.place, 40) })

export function registerActivityRoutes(app, { requireUser, requireMaster, getDb, broadcast, sheets, notify, findRoll }) {
  load()
  backup()
  setInterval(backup, 6 * 3600 * 1000)
  const heroes = () => (getDb().heroes || []).filter(h => h.kind === 'character')
  const heroOf = id => heroes().find(h => h.id === id)
  // писать в журнал: мастер, владелец карточки героя или владелец его листа
  const canWrite = (u, h) => !!u && !!h && (u.role === 'master' || h.ownerId === u.id || sheets.ownerOfHero(h.id) === u.id)
  const changed = () => { save(); broadcast() }
  const by = u => ({ id: u.id, name: u.name, role: u.role })
  const cfgOf = id => (store.cfg[id] ||= { limit: 0, sleep: 8, note: '', favs: [], banned: [] })
  const fail = (res, code, error) => res.status(code).json({ error })

  // что игроку сейчас нельзя: закрытый мастером период, блокировка, запрет деятельности этому герою
  function playerBlock(h, rec, { creating } = {}) {
    if (store.lock.until && rec.date <= store.lock.until) return `Период до ${store.lock.until.split('-').reverse().join('.')} закрыт мастером`
    if (store.lock.blocked && creating && rec.status !== 'plan') return `Мастер заблокировал деятельности${store.lock.reason ? ': ' + store.lock.reason : ''}. Можно составлять план-черновик`
    const n = norm(rec.name)
    const ban = cfgOf(h.id).banned.find(b => n.startsWith(norm(b.name)))
    if (ban) return `«${ban.name}» герою сейчас нельзя${ban.reason ? ': ' + ban.reason : ''}`
    return ''
  }

  // учтённая запись → лист (очки тренировки; монеты, опыт, изнурение, вещи). Изменилось — сначала откат старого
  function syncSheet(h, rec, u) {
    const done = rec.status === 'done'
    const wantT = done && rec.trainId && rec.pts ? { trainId: rec.trainId, pts: rec.pts } : null
    const hadT = rec.applied || null
    if (JSON.stringify(wantT) !== JSON.stringify(hadT && { trainId: hadT.trainId, pts: hadT.pts })) {
      if (hadT) sheets.addTraining(hadT.sheetId, hadT.trainId, -hadT.pts, by(u), `деятельность «${rec.name}» больше не учтена`)
      rec.applied = null
      if (wantT) {
        const sheetId = sheets.addTraining(sheets.sheetOfHero(h.id), wantT.trainId, wantT.pts, by(u), `деятельность «${rec.name}»`)
        if (sheetId) rec.applied = { ...wantT, sheetId }
      }
    }
    const d = {}
    for (const k of ['gold', 'silver', 'copper', 'exp', 'exh']) if (rec[k]) d[k] = rec[k]
    if (rec.items?.length) d.items = rec.items
    const want = done && Object.keys(d).length ? d : null
    const had = rec.appliedSheet || null
    if (JSON.stringify(want) === JSON.stringify(had?.want || null)) return
    if (had?.done) {
      const back = Object.fromEntries(Object.entries(had.done).map(([k, v]) => [k, k === 'items' ? v.map(x => ({ ...x, qty: -x.qty })) : -v]))
      sheets.applyDelta(had.sheetId, back, by(u), `деятельность «${rec.name}» больше не учтена`)
    }
    rec.appliedSheet = null
    if (want) {
      const sheetId = sheets.sheetOfHero(h.id)
      const got = sheetId && sheets.applyDelta(sheetId, want, by(u), `деятельность «${rec.name}»`)
      rec.appliedSheet = { want, done: got || null, sheetId }
    }
  }

  app.get('/api/activities', requireUser, (req, res) => {
    const u = req.user
    res.json({
      rev: store.rev, limit: store.limit, lock: store.lock, cfg: store.cfg,
      heroes: heroes().map(h => {
        const w = canWrite(u, h)
        const sh = sheets.trainingsOfHero(h.id)
        // тренировки листа — тем, кто пишет в журнал (выбрать, куда идут очки), и мастеру
        return { heroId: h.id, name: h.name, race: h.race || '', canWrite: w, hasSheet: !!sh, stamina: sh?.stamina ?? null, trainings: w ? sh?.trainings || [] : [] }
      }),
      logs: store.logs
    })
  })

  const findRec = (req, res) => {
    const h = heroOf(req.params.hero)
    const rec = store.logs[req.params.hero]?.find(x => x.id === req.params.id)
    if (!h || !rec) { fail(res, 404, 'Запись не найдена'); return [] }
    return [h, rec]
  }
  // игрок правит свою запись, пока она черновик или на проверке и период не закрыт
  const playerMay = (u, h, rec) => canWrite(u, h) && PLAYER_STATUS.includes(rec.status)

  app.post('/api/activities/:hero', requireUser, (req, res) => {
    const h = heroOf(req.params.hero)
    if (!h) return fail(res, 404, 'Нет такого героя')
    if (!canWrite(req.user, h)) return fail(res, 403, 'Это не твой герой')
    const list = (store.logs[h.id] ||= [])
    if (list.length >= PER_HERO) return fail(res, 400, 'Журнал переполнен')
    const master = req.user.role === 'master'
    const want = req.body?.status
    const status = master ? (ACT_STATUS.includes(want) ? want : 'done') : (want === 'plan' ? 'plan' : 'pending')
    const rec = { id: 'a' + crypto.randomBytes(5).toString('hex'), ...clean(req.body, {}, heroes().map(x => x.id)), status, by: req.user.name, at: Date.now() }
    if (!master) { const why = playerBlock(h, rec, { creating: true }); if (why) return fail(res, 403, why) }
    list.push(rec)
    if (master) syncSheet(h, rec, req.user)
    else if (status === 'pending' && list.filter(x => x.status === 'pending').length === 1) notify('masters', 'activity', `${h.name}: новые деятельности на проверку`, { logHero: h.id })
    changed()
    res.json(rec)
  })

  app.put('/api/activities/:hero/:id', requireUser, (req, res) => {
    const [h, rec] = findRec(req, res)
    if (!h) return
    const master = req.user.role === 'master'
    if (!master && !playerMay(req.user, h, rec)) return fail(res, 403, 'Проверенную запись меняет только мастер')
    const next = { ...rec, ...clean(req.body, rec, heroes().map(x => x.id)) }
    const want = req.body?.status
    if (master && ACT_STATUS.includes(want)) next.status = want
    else if (!master && PLAYER_STATUS.includes(want)) next.status = want
    if (!master) { const why = playerBlock(h, next, { creating: rec.status === 'plan' && next.status === 'pending' }); if (why) return fail(res, 403, why) }
    const wasPending = rec.status === 'pending'
    Object.assign(rec, next)
    if (master && want && want !== 'pending' && want !== 'plan') { rec.checkedBy = req.user.name; rec.checkedAt = Date.now() }
    syncSheet(h, rec, req.user)
    if (!master && !wasPending && rec.status === 'pending' && store.logs[h.id].filter(x => x.status === 'pending').length === 1) notify('masters', 'activity', `${h.name}: новые деятельности на проверку`, { logHero: h.id })
    changed()
    res.json(rec)
  })

  app.delete('/api/activities/:hero/:id', requireUser, (req, res) => {
    const [h, rec] = findRec(req, res)
    if (!h) return
    if (req.user.role !== 'master' && (!playerMay(req.user, h, rec) || playerBlock(h, rec))) return fail(res, 403, 'Проверенную запись удаляет только мастер')
    rec.status = 'cancel'
    syncSheet(h, rec, req.user) // всё, что ушло в лист, возвращается
    store.logs[h.id] = store.logs[h.id].filter(x => x !== rec)
    changed()
    res.json({ ok: true })
  })

  // бросок в запись: только тот, что этот человек только что бросил общими кубиками сайта (его видели все)
  app.post('/api/activities/:hero/:id/roll', requireUser, (req, res) => {
    const [h, rec] = findRec(req, res)
    if (!h) return
    if (req.user.role !== 'master' && !playerMay(req.user, h, rec)) return fail(res, 403, 'Бросать в проверенную запись нельзя')
    const r = findRoll(req.user, req.body || {})
    if (!r) return fail(res, 409, 'Этот бросок не прошёл через кубики сайта')
    rec.rolls = [...(rec.rolls || []), { label: S(req.body?.label, 60), notation: r.notation, total: r.total, groups: r.groups, mod: r.mod, adv: r.adv || '', at: r.at }].slice(-30)
    changed()
    res.json(rec)
  })
  // «первая уникальная деятельность периода — 50% не потратить выносливость»: монетку бросает сервер, один раз за сессию
  app.post('/api/activities/:hero/:id/coin', requireUser, (req, res) => {
    const [h, rec] = findRec(req, res)
    if (!h) return
    if (!canWrite(req.user, h)) return fail(res, 403, 'Это не твой герой')
    if (rec.type !== 'unique') return fail(res, 400, 'Монетка — только для уникальной деятельности')
    if (!PLAYER_STATUS.includes(rec.status)) return fail(res, 400, 'Монетку бросают до проверки мастером')
    if (store.logs[h.id].some(x => x.date === rec.date && x.coin)) return fail(res, 400, 'В этой сессии монетку уже бросали')
    rec.coin = { win: crypto.randomInt(2) === 1, at: Date.now() }
    changed()
    res.json(rec)
  })

  // настройки героя: сон, заметки и избранное — хозяин; лимит часов и запреты — мастер
  app.put('/api/activities-hero/:hero', requireUser, (req, res) => {
    const h = heroOf(req.params.hero)
    if (!h) return fail(res, 404, 'Нет такого героя')
    if (!canWrite(req.user, h)) return fail(res, 403, 'Это не твой герой')
    const c = cfgOf(h.id), b = req.body || {}
    if ('sleep' in b) c.sleep = I(b.sleep, 0, 24)
    if ('note' in b) c.note = S(b.note, 2000)
    if ('favs' in b) c.favs = (Array.isArray(b.favs) ? b.favs.slice(0, 40) : []).map(cleanFav).filter(f => f.name)
    if (req.user.role === 'master') {
      if ('limit' in b) c.limit = I(b.limit, 0, 10000)
      if ('banned' in b) c.banned = (Array.isArray(b.banned) ? b.banned.slice(0, 40) : []).map(x => ({ name: S(x?.name, 120), reason: S(x?.reason, 300) })).filter(x => x.name)
    }
    changed()
    res.json(c)
  })

  // мастер: часы между сессиями (для «Gate» — 336), закрытый период и блокировка следующего (таймскип)
  app.put('/api/activities-settings', requireMaster, (req, res) => {
    const b = req.body || {}
    if ('limit' in b) store.limit = I(b.limit, 1, 10000) || 336
    if ('until' in b) store.lock.until = DATE_RE.test(b.until) ? b.until : ''
    if ('blocked' in b) store.lock.blocked = !!b.blocked
    if ('reason' in b) store.lock.reason = S(b.reason, 300)
    changed()
    res.json({ limit: store.limit, lock: store.lock })
  })

  return { rev: () => store.rev, pending: () => Object.values(store.logs).reduce((n, l) => n + l.filter(x => x.status === 'pending').length, 0) }
}
