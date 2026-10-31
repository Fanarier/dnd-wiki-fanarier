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
import { cleanRich } from './richtext.js'
import { isLongTraining, longFinal, rollOutcome, ACT_DICE, LONG_MULT, LONG_EXH, exhOf, longExhNet } from '../src/shared/activities.js'

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
// вещи записи: плюс — получено, минус — отдано/продано. info — описание новой вещи (ляжет в инвентарь при «учтено»);
// created — вещи не было в листе, игрок сам создал её в инвентаре из журнала (мастер видит метку)
const cleanInfo = i => (i && typeof i === 'object' ? { desc: cleanRich(S(i.desc, 8000), 8000), rarity: S(i.rarity, 40), notes: S(i.notes, 4000) } : null)
const cleanItems = v => (Array.isArray(v) ? v.slice(0, 20) : []).map(x => {
  const it = { name: S(x?.name, 160), qty: I(x?.qty, -1e6, 1e6), stored: !!x?.stored }
  const info = cleanInfo(x?.info)
  if (info && (info.desc || info.rarity || info.notes)) it.info = info
  if (x?.created) it.created = true
  return it
}).filter(x => x.name && x.qty)
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
    result: cleanRich(S(pick('result'), 6000), 6000, { images: true }), // с оформлением (и фото) — через очистку
    die: ACT_DICE.includes(Number(pick('die'))) ? Number(pick('die')) : 20, // базовый кубик броска
    adv: ['adv', 'dis', ''].includes(pick('adv')) ? pick('adv') : undefined, // преимущество / помеха (нет поля — по тексту записи)
    trainId: S(pick('trainId'), 40),
    pts: I(pick('pts'), -1e6, 1e6),
    place: S(pick('place'), 40), // город на карте
    mod: S(pick('mod'), 80), // место-модификатор из вики («Библиотека»…)
    mentor: S(pick('mentor'), 80), mentorBonus: I(pick('mentorBonus'), -100, 100), // наставник и его фиксированный бонус к броску
    times: I(pick('times'), 0, 10), // «несколько»: сколько раз подряд в одной записи (у длительной — суток)
    with: [...new Set((Array.isArray(pick('with')) ? pick('with') : []).map(String).filter(id => heroIds.includes(id)))].slice(0, 8),
    gold: I(pick('gold'), -1e7, 1e7), silver: I(pick('silver'), -1e7, 1e7), copper: I(pick('copper'), -1e7, 1e7),
    exp: I(pick('exp'), -1e7, 1e7), exh: I(pick('exh'), -5, 5), // минус — отдых снимает изнурение
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
  // в листе героя поменялось изнурение / выносливость / тренировки — журнал у всех перечитает героев (без записи файла)
  let bumpTimer = null
  sheets.watchHeroSheets?.(() => { clearTimeout(bumpTimer); bumpTimer = setTimeout(() => { store.rev++; broadcast() }, 300) })
  const by = u => ({ id: u.id, name: u.name, role: u.role })
  // отдых героя по умолчанию: эльфы и дроу не спят, а уходят в транс на 4 часа; остальные — сон 8 часов
  const TRANCE = /эльф|дроу|drow|elf/i
  const raceOf = h => sheets.trainingsOfHero(h.id)?.race || h.race || ''
  const defaultCfg = h => ({ limit: 0, ...(h && TRANCE.test(raceOf(h)) ? { sleep: 4, rest: 'Транс', elf: true } : { sleep: 8, rest: 'Сон', elf: false }), note: '', favs: [], banned: [] })
  const cfgOf = id => (store.cfg[id] ||= defaultCfg(heroOf(id)))
  // один раз: уже сохранённые настройки без вида отдыха — по расе (Джилл — дроу: транс 4 ч)
  if (!store.restFix) {
    for (const h of heroes()) {
      const c = store.cfg[h.id]
      if (!c || c.rest) continue
      if (TRANCE.test(raceOf(h)) && c.sleep === 8) Object.assign(c, { sleep: 4, rest: 'Транс' })
      else c.rest = 'Сон'
    }
    store.restFix = true
    save()
  }
  // один раз: длительные тренировки теперь дают 4 изнурения — непроверенные записи, где стояло старое авто-значение 2, поправить
  if (!store.longExhFix) {
    for (const log of Object.values(store.logs)) {
      for (const r of log) if (isLongTraining(r.name) && r.exh === 2 && ['plan', 'pending'].includes(r.status)) r.exh = LONG_EXH
    }
    store.longExhFix = true
    save()
  }
  // один раз: длительная тренировка теперь — сутки со сном (24 ч, эльф 20), 3 выносливости, без изнурения; эльфы — отметкой.
  // Непроверенные записи со старыми значениями (16 ч, 3,2, авто-изнурение) приводим к новым
  if (!store.longFix3) {
    for (const [hid, c] of Object.entries(store.cfg)) if (c.elf === undefined) c.elf = c.rest === 'Транс' || (TRANCE.test(raceOf(heroOf(hid) || {})) && c.sleep === 4)
    for (const [hid, log] of Object.entries(store.logs)) {
      for (const r of log) {
        if (!isLongTraining(r.name) || !['plan', 'pending'].includes(r.status)) continue
        if ([1, 2, 3, 4].includes(r.exh)) r.exh = 0
        if (String(r.hours).trim() === '16') r.hours = String(cfgOf(hid).elf ? 20 : 24)
        if (/^3[,.]2$/.test(String(r.stamina).trim())) r.stamina = '3'
      }
    }
    store.longFix3 = true
    save()
  }
  // один раз: ночной сон сразу снимает 2 (транс 1) — непроверенные длительные с авто-значением 4 → 4 − сон героя
  if (!store.longExhFix2) {
    for (const [hid, log] of Object.entries(store.logs)) {
      for (const r of log) if (isLongTraining(r.name) && r.exh === LONG_EXH && ['plan', 'pending'].includes(r.status)) r.exh = longExhNet(cfgOf(hid).sleep)
    }
    store.longExhFix2 = true
    save()
  }
  const fail = (res, code, error) => res.status(code).json({ error })
  // что мастер может поправить в записи игрока — и как это назвать игроку
  const EDIT_FIELDS = [['name', 'название'], ['hours', 'часы'], ['stamina', 'выносливость'], ['result', 'результат'], ['pts', 'очки тренировки'], ['trainId', 'тренировка'],
    ['gold', 'золото'], ['silver', 'серебро'], ['copper', 'бронза'], ['exp', 'опыт'], ['exh', 'изнурение'], ['items', 'вещи'], ['type', 'тип'], ['date', 'дата'], ['mod', 'место']]
  // уведомление хозяину героя (игроку), со ссылкой на его журнал
  // история записи: кто, когда и что сделал (последние 40 событий) — у записи кнопка 🕑
  const STATUS_NAME = { plan: 'черновик', pending: 'на проверке', done: 'учтено', fail: 'провал', cond: 'условие', cancel: 'отменено' }
  const hist = (rec, by, t) => { rec.hist = [...(rec.hist || []), { at: Date.now(), by: by || '', t: String(t).slice(0, 300) }].slice(-40) }
  const tellOwner = (h, text) => { const pid = sheets.ownerOfHero(h.id) || h.ownerId; if (pid) notify(pid, 'activity', text, { logHero: h.id }) }
  // ВОД — взаимная общая деятельность: записи разных героев с одним vod. Часы и выносливость общие (пока запись
  // не проверена), название, описание, броски и награды — у каждого свои
  const vodRecs = (vod, except) => Object.entries(store.logs).flatMap(([hid, log]) => log.filter(r => r.vod === vod && r !== except).map(r => [hid, r]))
  // позвали в общую деятельность — игроку героя-партнёра (если ещё не подтвердил)
  const invite = (h, rec, ids) => {
    for (const id of ids || []) {
      const p = heroOf(id)
      if (p && !(rec.vod && (store.logs[id] || []).some(x => x.vod === rec.vod))) tellOwner(p, `${h.name} зовёт в общую деятельность «${rec.name.slice(0, 60)}» — подтверди в журнале (⋯ у записи)`)
    }
  }

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
    for (const k of ['gold', 'silver', 'copper', 'exp']) if (rec[k]) d[k] = rec[k]
    // изнурение: вписанное, а если пусто — по правилам (длительная тренировка +4, любой отдых −1 за каждые 3 часа).
    // По правилам — только если запись стала «учтено» уже при новых правилах (exhAuto): старые учтённые не трогаем
    const exh = Number(rec.exh) || (rec.exhAuto ? exhOf(rec, cfgOf(h.id).sleep) : 0)
    if (exh) d.exh = exh
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
      rev: store.rev, limit: store.limit, lock: store.lock,
      cfg: Object.fromEntries(heroes().map(h => [h.id, store.cfg[h.id] || defaultCfg(h)])),
      heroes: heroes().map(h => {
        const w = canWrite(u, h)
        const sh = sheets.trainingsOfHero(h.id)
        // тренировки листа — тем, кто пишет в журнал (выбрать, куда идут очки), и мастеру
        // инвентарь и монеты — тем же, кому тренировки: проверить, есть ли отдаваемая вещь и хватит ли денег
        return { heroId: h.id, name: h.name, race: h.race || '', canWrite: w, hasSheet: !!sh, stamina: sh?.stamina ?? null, exh: sh?.exh ?? null,
          trainings: w ? sh?.trainings || [] : [], inv: w ? sh?.items || [] : [], coins: w ? sh?.coins || null : null }
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
    if (rec.status === 'done') rec.exhAuto = true
    hist(rec, req.user.name, `создана · ${STATUS_NAME[rec.status]}${rec.hours ? ` · ${rec.hours} ч` : ''}${rec.stamina ? `, выносливость ${rec.stamina}` : ''}`)
    list.push(rec)
    if (master) syncSheet(h, rec, req.user)
    else if (status === 'pending' && list.filter(x => x.status === 'pending').length === 1) notify('masters', 'activity', `${h.name}: новые деятельности на проверку`, { logHero: h.id })
    invite(h, rec, rec.with)
    changed()
    res.json(rec)
  })

  // подтвердить общую деятельность: у героя появляется своя запись, связанная с исходной (ВОД). Статус — как у исходной
  // (игроку — черновик или «на проверке»), название и описание сначала те же, дальше у каждого свои
  app.post('/api/activities-vod/:hero', requireUser, (req, res) => {
    const h = heroOf(req.params.hero)
    if (!h) return fail(res, 404, 'Нет такого героя')
    if (!canWrite(req.user, h)) return fail(res, 403, 'Это не твой герой')
    const src = heroOf(String(req.body?.from || ''))
    const a = src && (store.logs[src.id] || []).find(r => r.id === req.body?.id)
    if (!a || !(a.with || []).includes(h.id)) return fail(res, 404, 'Нет такой общей деятельности')
    if (a.vod && (store.logs[h.id] || []).some(x => x.vod === a.vod)) return fail(res, 400, 'Уже подтверждено')
    const list = (store.logs[h.id] ||= [])
    if (list.length >= PER_HERO) return fail(res, 400, 'Журнал переполнен')
    const master = req.user.role === 'master'
    const status = master ? a.status : a.status === 'plan' ? 'plan' : 'pending'
    const pick = ['date', 'day', 'name', 'hours', 'stamina', 'type', 'result', 'die', 'mod', 'place', 'times']
    const b = { id: 'a' + crypto.randomBytes(5).toString('hex'), ...clean({ ...Object.fromEntries(pick.map(k => [k, a[k]])), with: [src.id] }, {}, heroes().map(x => x.id)), status, by: req.user.name, at: Date.now() }
    if (!master) { const why = playerBlock(h, b, { creating: true }); if (why) return fail(res, 403, why) }
    a.vod ||= 'v' + crypto.randomBytes(5).toString('hex')
    b.vod = a.vod
    if (b.status === 'done') b.exhAuto = true
    hist(b, req.user.name, `создана подтверждением общей деятельности от ${src.name} · ${STATUS_NAME[b.status]}`)
    hist(a, req.user.name, `${h.name} подтвердил(а) — теперь взаимная (ВОД)`)
    list.push(b)
    if (master) syncSheet(h, b, req.user)
    else if (status === 'pending' && list.filter(x => x.status === 'pending').length === 1) notify('masters', 'activity', `${h.name}: новые деятельности на проверку`, { logHero: h.id })
    tellOwner(src, `${h.name}: общая деятельность «${a.name.slice(0, 60)}» подтверждена — теперь она взаимная (ВОД)`)
    changed()
    res.json(b)
  })

  // порядок записей в сессии (перетаскиванием): записи этой даты встают в присланном порядке на те же места журнала.
  // От порядка зависит цепочка бонуса повторения — уже брошенное не меняется, новые броски считаются по новому порядку
  app.post('/api/activities-order/:hero', requireUser, (req, res) => {
    const h = heroOf(req.params.hero)
    if (!h) return fail(res, 404, 'Нет такого героя')
    if (!canWrite(req.user, h)) return fail(res, 403, 'Это не твой герой')
    const list = store.logs[h.id] || []
    const date = String(req.body?.date || '')
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : []
    const slots = list.map((r, i) => (r.date === date ? i : -1)).filter(i => i >= 0)
    const recs = ids.map(id => list.find(r => r.id === id && r.date === date)).filter(Boolean)
    if (!slots.length || recs.length !== slots.length || new Set(recs).size !== recs.length) return fail(res, 400, 'Список записей устарел — обнови страницу')
    slots.forEach((slot, i) => { list[slot] = recs[i] })
    changed()
    res.json({ ok: true })
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
    const added = (next.with || []).filter(id => !(rec.with || []).includes(id))
    const synced = rec.vod && (next.hours !== rec.hours || next.stamina !== rec.stamina)
    if (next.status === 'done' && rec.status !== 'done') next.exhAuto = true // изнурение по правилам — с этого «учтено»
    // мастер поправил запись игрока (результат, очки, монеты…) — запись помнит что именно, игроку уведомление
    const edited = master && rec.by !== req.user.name ? EDIT_FIELDS.filter(([k]) => JSON.stringify(next[k] ?? null) !== JSON.stringify(rec[k] ?? null)).map(([, t]) => t) : []
    if (edited.length) next.masterEdit = { at: Date.now(), by: req.user.name, fields: [...new Set([...(rec.masterEdit?.fields || []), ...edited])] }
    // ответ мастера под записью
    const reply = master && 'reply' in (req.body || {}) ? S(req.body.reply, 2000) : null
    if (reply !== null && reply !== (rec.reply || '')) Object.assign(next, { reply, replyAt: Date.now(), replyBy: req.user.name })
    // история: статус, часы и выносливость — со значениями, остальное — названиями полей
    const diff = []
    if (next.status !== rec.status) diff.push(`статус: ${STATUS_NAME[rec.status]} → ${STATUS_NAME[next.status]}`)
    for (const [k, t] of [['hours', 'часы'], ['stamina', 'выносливость']]) if ((next[k] ?? '') !== (rec[k] ?? '')) diff.push(`${t}: ${rec[k] || '—'} → ${next[k] || '—'}`)
    const other = EDIT_FIELDS.filter(([k]) => !['status', 'hours', 'stamina'].includes(k) && JSON.stringify(next[k] ?? null) !== JSON.stringify(rec[k] ?? null)).map(([, t]) => t)
    if (other.length) diff.push('изменено: ' + other.join(', '))
    if (reply !== null && reply !== (rec.reply || '')) diff.push('ответ мастера')
    Object.assign(rec, next)
    if (diff.length) hist(rec, req.user.name, diff.join('; '))
    if (edited.length) tellOwner(h, `Мастер поправил деятельность «${rec.name.slice(0, 60)}»: ${edited.join(', ')}`)
    if (reply) tellOwner(h, `Мастер ответил на деятельность «${rec.name.slice(0, 60)}»: ${reply.slice(0, 120)}`)
    invite(h, rec, added)
    // ВОД: часы и выносливость — у всех связанных записей (кроме уже проверенных мастером)
    if (synced) {
      const what = `${rec.hours || '—'} ч, выносливость ${rec.stamina || '—'}`
      for (const [hid, r] of vodRecs(rec.vod, rec)) {
        if (!PLAYER_STATUS.includes(r.status) || (r.hours === rec.hours && r.stamina === rec.stamina)) continue
        Object.assign(r, { hours: rec.hours, stamina: rec.stamina })
        hist(r, req.user.name, `из общей деятельности (${h.name}): ${what}`)
        const p = heroOf(hid)
        if (p) tellOwner(p, `${h.name} изменил(а) общую деятельность: ${what} — у «${r.name.slice(0, 50)}» так же`)
      }
      if (master) tellOwner(h, `Мастер изменил общую деятельность «${rec.name.slice(0, 50)}»: ${what} — у партнёров так же`)
    }
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
    // ВОД: у партнёров запись остаётся, но без этого героя; остался один — уже не взаимная
    if (rec.vod) {
      const rest = vodRecs(rec.vod, rec)
      for (const [, r] of rest) { r.with = (r.with || []).filter(id => id !== h.id); hist(r, req.user.name, `${h.name}: своя запись удалена — связь снята`) }
      if (rest.length === 1) delete rest[0][1].vod
    }
    changed()
    res.json({ ok: true })
  })

  // вещи нет в листе, а игрок уверен, что она у героя есть: создать её в инвентаре (видно в истории листа и метке у записи)
  app.post('/api/activities-item/:hero', requireUser, (req, res) => {
    const h = heroOf(req.params.hero)
    if (!h) return fail(res, 404, 'Нет такого героя')
    if (!canWrite(req.user, h)) return fail(res, 403, 'Это не твой герой')
    const [it] = cleanItems([{ ...req.body, qty: Math.abs(Number(req.body?.qty) || 1) }])
    if (!it) return fail(res, 400, 'Нужно название вещи')
    const sheetId = sheets.sheetOfHero(h.id)
    if (!sheetId) return fail(res, 400, 'У героя нет листа')
    const got = sheets.applyDelta(sheetId, { items: [it] }, by(req.user), 'вещи не было в листе — создана из журнала деятельностей')
    if (!got) return fail(res, 400, 'Не получилось положить вещь в инвентарь')
    store.rev++
    broadcast()
    res.json({ ok: true, item: it })
  })

  // бросок в запись: только тот, что этот человек только что бросил общими кубиками сайта (его видели все)
  app.post('/api/activities/:hero/:id/roll', requireUser, (req, res) => {
    const [h, rec] = findRec(req, res)
    if (!h) return
    if (req.user.role !== 'master' && !playerMay(req.user, h, rec)) return fail(res, 403, 'Бросать в проверенную запись нельзя')
    const r = findRoll(req.user, req.body || {})
    if (!r) return fail(res, 409, 'Этот бросок не прошёл через кубики сайта')
    // длительная тренировка: (2к20 + модификаторы) × LONG_MULT вниз + бонус повторения — итог считает сервер по проверенному броску
    const long = !!req.body?.long && isLongTraining(rec.name)
    const add = I(req.body?.add, 0, 10) // бонус повторения (у «несколько» — свой у каждого броска)
    const b = req.body?.base
    // базовые кубики (2кX у длительной, 1кX у остальных): натуральная 1 на к20 — не в счёт и сброс повторения, 20 — ×2
    const base = b && ACT_DICE.includes(Number(b.sides)) && [1, 2].includes(Number(b.n)) ? { n: Number(b.n), sides: Number(b.sides) } : null
    const out = base ? rollOutcome(r, base, add, long ? LONG_MULT : 0) : null
    rec.rolls = [...(rec.rolls || []), {
      label: S(req.body?.label, 60), notation: r.notation, total: r.total, groups: r.groups, mod: r.mod, adv: r.adv || '', at: r.at,
      series: I(req.body?.series, 0, 1000),
      ...(out ? { base, add: out.add, ones: out.ones, twenties: out.twenties, sum: out.sum, reset: out.reset, final: out.final, ...(long ? { long: true, mult: LONG_MULT } : {}) }
        : long ? { long: true, add, mult: LONG_MULT, final: longFinal(r.total, add) } : {}),
      miss: S(req.body?.miss, 200)
    }].slice(-40)
    const lr = rec.rolls[rec.rolls.length - 1]
    hist(rec, req.user.name, `🎲 ${lr.label ? lr.label + ': ' : ''}${lr.notation} = ${lr.total}${lr.final != null && lr.final !== lr.total ? ` → итог ${lr.final}` : ''}${lr.twenties ? ' · натуральная 20' : ''}${lr.ones ? ' · натуральная 1' : ''}`)
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
    hist(rec, req.user.name, `🍀 монетка: ${rec.coin.win ? 'повезло — выносливость не тратится' : 'не повезло'}`)
    changed()
    res.json(rec)
  })

  // настройки героя: сон, заметки и избранное — хозяин; лимит часов и запреты — мастер
  app.put('/api/activities-hero/:hero', requireUser, (req, res) => {
    const h = heroOf(req.params.hero)
    if (!h) return fail(res, 404, 'Нет такого героя')
    if (!canWrite(req.user, h)) return fail(res, 403, 'Это не твой герой')
    const c = cfgOf(h.id), b = req.body || {}
    // эльф: транс 4 ч вместо сна, длительная тренировка — 20 ч (мастер видит отметку). Сон и отдых, если пришли, — поверх
    if ('elf' in b && !!b.elf !== !!c.elf) Object.assign(c, b.elf ? { elf: true, sleep: 4, rest: 'Транс' } : { elf: false, sleep: 8, rest: 'Сон' })
    if ('sleep' in b) c.sleep = I(b.sleep, 0, 24)
    if ('rest' in b) c.rest = S(b.rest, 30) || 'Сон' // сон, транс, медитация, подзарядка…
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
