// Листы персонажей (перенос CharacterApp). Хранятся отдельно от мира — в data/sheets.json,
// картинки (портреты, предметы) — файлами в data/sheet-img, имя файла = хэш содержимого.
// Видимость: мастер — все листы, игрок — только свои. Правит владелец и мастер; каждое изменение пишется
// в историю (кто, что, было → стало), мастер может откатить. Открытый лист обновляется у всех вживую.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { SCHEMA, cleanBy, blankSheet, schemaAt, getAt, setAt, EQUIP_SLOTS, hpMax, trainStatus } from '../src/shared/sheet.js'
import { cleanRich } from './richtext.js'
import { isOwner } from './auth.js'

const DATA_DIR = path.resolve(import.meta.dirname, 'data')
const FILE = path.join(DATA_DIR, 'sheets.json')
const BACKUP_DIR = path.join(DATA_DIR, 'backups')
export const SHEET_IMG_DIR = path.join(DATA_DIR, 'sheet-img')
const HISTORY_MAX = 400
const MERGE_MS = 2 * 60 * 1000 // правки одного человека в одно поле подряд склеиваются в одну запись
const PER_PLAYER = 30

let store = { sheets: [] }
let timer = null
function load() {
  try { store = JSON.parse(fs.readFileSync(FILE, 'utf8')) } catch { store = { sheets: [] } }
  store.sheets ||= []
  // трекером здоровья в приложении не пользовались (текущие и максимум — 0), а «Хиты» указаны:
  // считаем персонажа здоровым, иначе лист выглядит как «без сознания»
  let fixed = 0
  for (const sh of store.sheets) if (fillHp(sh.data)) fixed++
  if (fixed) { console.log(`[sheets] хиты заполнены из поля «Хиты»: ${fixed}`); save() }
  for (const sh of store.sheets) seedTrainings(sh)
  // максимум ресурса раньше упирался в 999 — мана 1110 сохранялась как «1110 / 999»; возвращаем настоящий максимум
  let capped = 0
  for (const sh of store.sheets) for (const r of sh.data?.Resources || []) if (r.Max === 999 && r.Current > 999) { r.Max = r.Current; capped++ }
  if (capped) { console.log(`[sheets] максимум ресурсов больше 999 восстановлен: ${capped}`); save() }
}
// тренировки из таблицы Excel (server/seed/trainings.json): каждая запись вписывается один раз —
// в лист с этим id, а у кого листа ещё нет — в первый лист с таким именем, когда он появится
let trainSeed = null
function seedTrainings(sh) {
  if (!trainSeed) {
    try { trainSeed = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, 'seed', 'trainings.json'), 'utf8')) } catch { trainSeed = { byId: {}, byName: {} } }
  }
  const applied = (store.trainingsApplied ||= [])
  const name = String(sh.data?.CharacterName || '').trim()
  const key = trainSeed.byId?.[sh.id] ? 'id:' + sh.id : trainSeed.byName?.[name] ? 'name:' + name : null
  if (!key || applied.includes(key) || sh.deletedAt) return false
  applied.push(key)
  if (!sh.data.Trainings?.length) {
    sh.data.Trainings = cleanBy(schemaAt('Trainings'), trainSeed.byId?.[sh.id] || trainSeed.byName[name])
    record(sh, { id: 'system', name: 'Перенос из Excel', role: 'master' }, 'Trainings', [], sh.data.Trainings, 'тренировки из таблицы')
    console.log(`[sheets] тренировки из Excel → ${name}: ${sh.data.Trainings.length}`)
  }
  save()
  return true
}
function fillHp(d) {
  const hits = parseInt(String(d?.Hits || '').replace(/^\+/, ''), 10)
  if (!(hits > 0) || !d.HpData || d.HpData.Current || d.HpData.Max) return false
  d.HpData.Current = hits
  d.HpData.Max = hits
  return true
}
function writeNow() {
  timer = null
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(FILE + '.tmp', JSON.stringify(store))
  fs.renameSync(FILE + '.tmp', FILE)
}
const save = () => { timer ||= setTimeout(writeNow, 400) }
export function flushSheets() { if (timer) { clearTimeout(timer); writeNow() } }
// копия раз в сутки, 30 последних — как у базы мира
export function backupSheets() {
  if (!fs.existsSync(FILE)) return
  fs.mkdirSync(BACKUP_DIR, { recursive: true })
  const target = path.join(BACKUP_DIR, 'sheets-' + new Date().toISOString().slice(0, 10) + '.json')
  if (!fs.existsSync(target)) fs.copyFileSync(FILE, target)
  const files = fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith('sheets-')).sort()
  for (const old of files.slice(0, -30)) fs.unlinkSync(path.join(BACKUP_DIR, old))
}

const find = id => store.sheets.find(s => s.id === id)
// журнал — текст с оформлением (показывается как HTML): пропускаем только безопасные теги
const cleanJournal = d => { for (const e of d.JournalEntries || []) e.Content = cleanRich(e.Content, 60000) }
// править: мастер и владелец; смотреть — ещё и те, кому владелец (или мастер) открыл лист: всем игрокам или выбранным
const canSee = (u, sh) => !!u && !!sh && (u.role === 'master' || (!sh.deletedAt && !!sh.ownerId && sh.ownerId === u.id))
const canView = (u, sh) => canSee(u, sh) || (!!u && !!sh && !sh.deletedAt && (!!sh.share?.all || !!sh.share?.ids?.includes(u.id)))

/* ---------- картинки ---------- */
function saveImage(buf, imageExt) {
  const ext = imageExt(buf)
  if (!ext) return ''
  const name = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 32) + '.' + ext
  fs.mkdirSync(SHEET_IMG_DIR, { recursive: true })
  const f = path.join(SHEET_IMG_DIR, name)
  if (!fs.existsSync(f)) fs.writeFileSync(f, buf)
  return name
}
const b64img = (s, imageExt) => {
  if (!s || typeof s !== 'string') return ''
  try { return saveImage(Buffer.from(s.replace(/^data:[^,]*,/, ''), 'base64'), imageExt) } catch { return '' }
}
const fileB64 = f => { try { return f ? fs.readFileSync(path.join(SHEET_IMG_DIR, path.basename(f))).toString('base64') : '' } catch { return '' } }

// файл приложения → данные листа: картинки из base64 в файлы, остальное — по схеме
function fromAppFile(raw, imageExt) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Это не лист персонажа')
  const src = { ...raw }
  if (!src.PhotoFile) src.PhotoFile = b64img(src.PhotoBase64, imageExt)
  for (const s of EQUIP_SLOTS) if (src[s.key] && !src[s.key].ImageFile) src[s.key] = { ...src[s.key], ImageFile: b64img(src[s.key].ImageBase64, imageExt) }
  if (Array.isArray(src.Inventory)) src.Inventory = src.Inventory.map(it => (it && !it.ImageFile ? { ...it, ImageFile: b64img(it.ImageBase64, imageExt) } : it))
  const looksLike = ['CharacterName', 'Stats', 'HpData', 'Skills', 'Inventory'].some(k => k in src)
  if (!looksLike) throw new Error('В файле нет листа персонажа (нет имени, характеристик, навыков…)')
  const d = cleanBy(SCHEMA, src)
  d.CharacterName ||= 'Без имени'
  fillHp(d)
  cleanJournal(d)
  return d
}
// данные листа → файл как у приложения (картинки внутри) — его можно открыть и в CharacterApp
function toAppFile(d) {
  const out = structuredClone(d)
  out.PhotoBase64 = fileB64(d.PhotoFile)
  out.PhotoPath = ''
  for (const s of EQUIP_SLOTS) if (out[s.key]) { out[s.key].ImageBase64 = fileB64(out[s.key].ImageFile); out[s.key].ImagePath = '' }
  out.Inventory = (out.Inventory || []).map(it => ({ ...it, ImageBase64: fileB64(it.ImageFile) }))
  return out
}

// картинки, на которые больше никто не ссылается (ни лист, ни история) — убираем при запуске
function sweepImages() {
  let files
  try { files = fs.readdirSync(SHEET_IMG_DIR) } catch { return }
  const used = new Set(JSON.stringify(store).match(/[a-f0-9]{32}\.(?:png|jpe?g|gif|webp)/g) || [])
  const dayAgo = Date.now() - 24 * 3600 * 1000
  for (const f of files) {
    if (used.has(f)) continue
    try { if (fs.statSync(path.join(SHEET_IMG_DIR, f)).mtimeMs < dayAgo) fs.unlinkSync(path.join(SHEET_IMG_DIR, f)) } catch { /* занято */ }
  }
}

/* ---------- история ---------- */
function record(sh, by, p, from, to, note) {
  const h = (sh.history ||= [])
  const now = Date.now()
  // ищем недавнюю запись этого же поля — если её оставил этот же человек, дописываем в неё
  for (let i = h.length - 1; !note && i >= 0 && now - h[i].at < MERGE_MS; i--) {
    const e = h[i]
    if (e.p !== p) continue
    if (e.note || e.by.id !== by.id) break
    h.splice(i, 1)
    if (JSON.stringify(e.from) === JSON.stringify(to)) return // вернули как было — записи не нужно
    h.push({ ...e, to, at: now })
    return
  }
  h.push({ id: crypto.randomBytes(5).toString('hex'), at: now, by: { id: by.id, name: by.name, role: by.role }, p, from, to, ...(note ? { note } : {}) })
  if (h.length > HISTORY_MAX) h.splice(0, h.length - HISTORY_MAX)
}

// одна правка: путь + значение. p = '' — лист целиком (замена из файла, откат замены)
function applyOp(sh, op, by, note) {
  const p = String(op?.p ?? '')
  if (p === '') {
    const from = sh.data
    sh.data = cleanBy(SCHEMA, op.v)
    cleanJournal(sh.data)
    record(sh, by, '', from, null, note || 'весь лист')
    return { p: '', v: sh.data }
  }
  if (p.length > 120 || p.startsWith('.') || p.endsWith('.')) return null
  const s = schemaAt(p)
  if (!s) return null
  const v = cleanBy(s, op.v)
  const from = getAt(sh.data, p)
  if (JSON.stringify(from ?? null) === JSON.stringify(v ?? null)) return null
  if (!setAt(sh.data, p, v)) return null
  if (p.startsWith('JournalEntries')) cleanJournal(sh.data)
  const now = getAt(sh.data, p)
  record(sh, by, p, from === undefined ? null : from, now ?? null, note)
  return { p, v: now ?? null }
}

/* ---------- маршруты ---------- */
export function registerSheetRoutes(app, { express, requireUser, requireMaster, imageExt, clients, getPlayer, players, getDb, broadcast }) {
  load()
  seedCharacters()
  sweepImages()
  setInterval(backupSheets, 6 * 3600 * 1000)
  backupSheets()

  // персонажи из таблицы Excel, у которых ещё нет листа (server/seed/characters.json): заводим один раз —
  // без игрока, с привязкой к карточке героя с тем же именем и её портретом; тренировки подтянутся сами
  function seedCharacters() {
    let seed
    try { seed = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, 'seed', 'characters.json'), 'utf8')) } catch { return }
    const applied = (store.charactersApplied ||= [])
    let made = 0
    for (const [name, raw] of Object.entries(seed)) {
      if (applied.includes(name)) continue
      applied.push(name)
      if (store.sheets.some(sh => !sh.deletedAt && String(sh.data?.CharacterName || '').trim() === name)) continue
      const blank = blankSheet()
      const data = cleanBy(SCHEMA, { ...blank, ...raw, Stats: { ...blank.Stats, ...(raw.Stats || {}) } })
      fillHp(data)
      cleanJournal(data)
      const hero = (getDb().heroes || []).find(h => h.kind === 'character' && String(h.name).trim() === name)
      if (hero?.gallery?.[0]?.file && !data.PhotoFile) {
        try { data.PhotoFile = saveImage(fs.readFileSync(path.join(DATA_DIR, 'portraits', path.basename(hero.gallery[0].file))), imageExt) } catch { /* файла нет */ }
      }
      const sh = { id: 'sh' + crypto.randomBytes(5).toString('hex'), ownerId: null, heroId: hero?.id || null, createdAt: Date.now(), updatedAt: Date.now(), rev: 1, data, history: [] }
      record(sh, { id: 'system', name: 'Перенос из Excel', role: 'master' }, '', null, null, 'лист перенесён из таблицы персонажей')
      store.sheets.push(sh)
      seedTrainings(sh)
      made++
      console.log(`[sheets] лист из Excel: ${name}${hero ? ' (карточка героя привязана)' : ''}`)
    }
    if (made || applied.length) save()
  }

  const ownerName = id => {
    if (!id) return ''
    const p = getPlayer(id)
    return p ? (p.linked ? `${p.character} — персонаж ${isOwner(p.login) ? 'техспециалиста' : 'мастера'} ${p.login}` : `${p.character} · ${p.login}`) : ''
  }
  const heroName = id => (id ? getDb().heroes?.find(h => h.id === id)?.name || '' : '')
  const summary = (sh, u) => {
    const d = sh.data
    return {
      canEdit: u ? canSee(u, sh) : true, share: { all: !!sh.share?.all, ids: sh.share?.ids || [] },
      id: sh.id, ownerId: sh.ownerId, ownerName: ownerName(sh.ownerId), heroId: sh.heroId, heroName: heroName(sh.heroId),
      name: d.CharacterName, cls: d.Class, sub: d.Subclass, race: d.Race, level: d.Level, photo: d.PhotoFile, accent: d.Accent,
      hp: { cur: d.HpData.Current, max: hpMax(d), temp: d.HpData.Temp, hits: d.Hits },
      ds: ['S1', 'S2', 'S3', 'F1', 'F2', 'F3'].map(k => d.HpData['DS_' + k]),
      mana: d.Mana, stamina: d.Stamina, defense: d.Defense, evasion: d.Evasion, superHits: d.SuperHits, exhaustion: d.Exhaustion,
      res: d.Resources.map(r => ({ id: r.Id, name: r.Name, icon: r.Icon, cur: r.Current, max: r.Max, color: r.Color, style: r.Style })),
      fx: d.ActiveEffects || [], // эффекты на персонаже — значки в сводке отряда
      // для сводки отряда: что сейчас тренирует (ближе всего к завершению — первым)
      train: (d.Trainings || []).filter(t => trainStatus(t) === 'active')
        .map(t => ({ name: t.Name, note: t.Note, cur: t.Cur, max: t.Max, stage: t.Stage }))
        .sort((a, b) => (b.max ? b.cur / b.max : 0) - (a.max ? a.cur / a.max : 0)),
      createdAt: sh.createdAt, updatedAt: sh.updatedAt, deletedAt: sh.deletedAt || null, rev: sh.rev
    }
  }

  // живые обновления: открытый лист — правки; список и сводка — «что-то поменялось»
  function notify(sh, ops, byClient) {
    const opsMsg = ops?.length ? JSON.stringify({ type: 'sheetOps', id: sh.id, rev: sh.rev, ops, by: byClient || null }) : null
    const listMsg = JSON.stringify({ type: 'sheetsChanged', id: sh.id })
    for (const c of clients) {
      if (c.ws.readyState !== 1 || !c.user) continue
      const sees = canView(c.user, sh)
      // владелец узнаёт и о том, что лист ушёл в корзину, — чтобы убрать его из списка
      if (!sees && sh.ownerId !== c.user.id) continue
      if (sees && opsMsg && c.sheetSub === sh.id && String(c.id) !== String(byClient)) c.ws.send(opsMsg)
      c.ws.send(listMsg)
    }
  }
  const touch = sh => { sh.rev = (sh.rev || 0) + 1; sh.updatedAt = Date.now(); save() }

  function get(req, res) {
    const sh = find(req.params.id)
    if (!sh || !canSee(req.user, sh)) { res.status(404).json({ error: 'Лист не найден' }); return null }
    return sh
  }
  // только посмотреть (открытый для игрока лист): читать и выгружать можно, править — нет
  function getView(req, res) {
    const sh = find(req.params.id)
    if (!sh || !canView(req.user, sh)) { res.status(404).json({ error: 'Лист не найден' }); return null }
    return sh
  }
  const by = req => ({ id: req.user.id, name: req.user.name, role: req.user.role })
  function create(req, data, ownerId) {
    if (req.user.role !== 'master' && store.sheets.filter(s => s.ownerId === req.user.id && !s.deletedAt).length >= PER_PLAYER) {
      const e = new Error(`Не больше ${PER_PLAYER} листов на игрока`)
      e.status = 400
      throw e
    }
    const sh = { id: 'sh' + crypto.randomBytes(5).toString('hex'), ownerId, heroId: null, createdAt: Date.now(), updatedAt: Date.now(), rev: 1, data, history: [] }
    record(sh, by(req), '', null, null, 'лист создан')
    store.sheets.push(sh)
    seedTrainings(sh)
    save()
    return sh
  }
  // чей будет новый лист: игрок — себе; мастер — кому скажет или «без игрока»
  const ownerFor = (req, want) => {
    if (req.user.role !== 'master') return req.user.id
    return want && getPlayer(String(want)) ? String(want) : null
  }

  app.get('/api/sheets', requireUser, (req, res) => {
    const list = store.sheets.filter(sh => canView(req.user, sh)).map(sh => summary(sh, req.user))
    const owners = req.user.role === 'master' ? players().filter(p => p.status === 'active').map(p => ({ id: p.id, name: p.character, login: p.login, linked: !!p.linked, tech: !!p.linked && isOwner(p.login) })) : []
    res.json({ sheets: list, owners })
  })

  app.post('/api/sheets', requireUser, (req, res) => {
    const d = blankSheet()
    if (req.body?.name) d.CharacterName = String(req.body.name).slice(0, 120)
    try {
      const sh = create(req, d, ownerFor(req, req.body?.ownerId))
      notify(sh)
      broadcast()
      res.json(summary(sh))
    } catch (e) { res.status(e.status || 400).json({ error: e.message }) }
  })

  // импорт .json приложения (тело — сам файл как текст: большие картинки внутри, поэтому не обычный JSON-запрос)
  app.post('/api/sheets/import', requireUser, express.raw({ type: () => true, limit: '60mb' }), (req, res) => {
    try {
      const raw = JSON.parse(req.body.toString('utf8').replace(/^﻿/, ''))
      const sh = create(req, fromAppFile(raw, imageExt), ownerFor(req, req.query.owner))
      sh.history[sh.history.length - 1].note = 'загружен из файла'
      notify(sh)
      broadcast()
      res.json(summary(sh))
    } catch (e) { res.status(e.status || 400).json({ error: e instanceof SyntaxError ? 'Файл повреждён — это не JSON' : e.message }) }
  })

  app.get('/api/sheets/:id', requireUser, (req, res) => {
    const sh = getView(req, res)
    if (sh) res.json({ ...summary(sh, req.user), data: sh.data })
  })

  // кто ещё видит лист: всем игрокам, выбранным или никому (кроме владельца и мастера). Решают владелец и мастер
  app.patch('/api/sheets/:id/share', requireUser, (req, res) => {
    const sh = get(req, res)
    if (!sh) return
    const b = req.body || {}
    const ids = [...new Set((Array.isArray(b.ids) ? b.ids : []).map(String))].filter(id => getPlayer(id)?.status === 'active' && id !== sh.ownerId).slice(0, 100)
    const next = { all: !!b.all, ids: b.all ? [] : ids }
    const word = s => (s?.all ? 'всем игрокам' : s?.ids?.length ? s.ids.map(id => getPlayer(id)?.character || '?').join(', ') : 'никому')
    if (word(next) !== word(sh.share)) record(sh, by(req), '#share', word(sh.share), word(next), 'кто видит лист')
    sh.share = next
    touch(sh)
    notify(sh)
    broadcast() // кнопка «Лист персонажа» на карточке героя появляется у тех, кому открыли
    res.json(summary(sh, req.user))
  })

  app.patch('/api/sheets/:id', requireUser, (req, res) => {
    const sh = get(req, res)
    if (!sh) return
    if (sh.deletedAt) return res.status(400).json({ error: 'Лист в корзине — сначала восстанови' })
    const ops = Array.isArray(req.body?.ops) ? req.body.ops.slice(0, 200) : []
    const done = ops.filter(o => o?.p !== '').map(o => applyOp(sh, o, by(req))).filter(Boolean)
    if (done.length) {
      touch(sh)
      notify(sh, done, req.headers['x-client-id'])
      if (done.some(o => o.p === 'CharacterName' || o.p === 'PhotoFile')) broadcast() // имя и портрет видны на карточках героев
    }
    res.json({ rev: sh.rev, applied: done.length })
  })

  // заменить лист целиком из файла (старый остаётся в истории — можно откатить)
  app.post('/api/sheets/:id/replace', requireUser, express.raw({ type: () => true, limit: '60mb' }), (req, res) => {
    const sh = get(req, res)
    if (!sh) return
    try {
      const data = fromAppFile(JSON.parse(req.body.toString('utf8').replace(/^﻿/, '')), imageExt)
      const op = applyOp(sh, { p: '', v: data }, by(req), 'заменён из файла')
      touch(sh)
      notify(sh, [op], req.headers['x-client-id'])
      res.json({ ...summary(sh), data: sh.data })
    } catch (e) { res.status(400).json({ error: e instanceof SyntaxError ? 'Файл повреждён — это не JSON' : e.message }) }
  })

  app.get('/api/sheets/:id/export', requireUser, (req, res) => {
    const sh = getView(req, res)
    if (!sh) return
    const name = (sh.data.CharacterName || 'Персонаж').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80)
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="sheet.json"; filename*=UTF-8''${encodeURIComponent(name)}.json`)
    res.send(JSON.stringify(toAppFile(sh.data), null, 2))
  })

  // картинка для листа: отдаём имя файла, лист сам запишет его в нужное поле
  app.post('/api/sheets/:id/image', requireUser, express.raw({ type: () => true, limit: '12mb' }), (req, res) => {
    const sh = get(req, res)
    if (!sh) return
    const file = saveImage(req.body, imageExt)
    if (!file) return res.status(400).json({ error: 'Нужна картинка PNG, JPG, GIF или WebP' })
    res.json({ file })
  })

  // кому принадлежит лист и к какой карточке героя привязан — решает мастер
  app.patch('/api/sheets/:id/meta', requireMaster, (req, res) => {
    const sh = get(req, res)
    if (!sh) return
    const b = req.body || {}
    if ('ownerId' in b) {
      const o = b.ownerId ? String(b.ownerId) : null
      if (o && !getPlayer(o)) return res.status(400).json({ error: 'Игрок не найден' })
      if (o !== sh.ownerId) record(sh, by(req), '#owner', ownerName(sh.ownerId) || 'без игрока', ownerName(o) || 'без игрока', 'владелец')
      sh.ownerId = o
    }
    if ('heroId' in b) {
      const hero = b.heroId ? getDb().heroes?.find(h => h.id === b.heroId) : null
      if (b.heroId && !hero) return res.status(400).json({ error: 'Карточка героя не найдена' })
      sh.heroId = hero?.id || null
      // портрет с карточки, если у листа своего нет
      if (hero && b.copyPortrait && !sh.data.PhotoFile && hero.gallery?.[0]?.file) {
        try {
          const buf = fs.readFileSync(path.join(path.resolve(DATA_DIR, 'portraits'), path.basename(hero.gallery[0].file)))
          applyOp(sh, { p: 'PhotoFile', v: saveImage(buf, imageExt) }, by(req), 'портрет с карточки героя')
        } catch { /* файла нет */ }
      }
    }
    touch(sh)
    notify(sh, [{ p: 'PhotoFile', v: sh.data.PhotoFile }])
    broadcast()
    res.json(summary(sh))
  })

  // удаление — в корзину (мастер может вернуть); из корзины мастер удаляет насовсем
  app.delete('/api/sheets/:id', requireUser, (req, res) => {
    const sh = get(req, res)
    if (!sh) return
    if (sh.deletedAt) {
      if (req.user.role !== 'master') return res.status(404).json({ error: 'Лист не найден' })
      store.sheets = store.sheets.filter(x => x !== sh)
    } else {
      sh.deletedAt = Date.now()
      record(sh, by(req), '#deleted', null, null, 'в корзину')
    }
    save()
    notify(sh)
    broadcast()
    res.json({ ok: true })
  })
  app.post('/api/sheets/:id/restore', requireMaster, (req, res) => {
    const sh = get(req, res)
    if (!sh) return
    sh.deletedAt = null
    record(sh, by(req), '#deleted', null, null, 'восстановлен из корзины')
    touch(sh)
    notify(sh)
    broadcast()
    res.json(summary(sh))
  })

  app.get('/api/sheets/:id/history', requireMaster, (req, res) => {
    const sh = get(req, res)
    if (!sh) return
    res.json((sh.history || []).slice().reverse())
  })
  // откат одной записи: поле снова получает прежнее значение (сам откат тоже попадает в историю)
  app.post('/api/sheets/:id/revert', requireMaster, (req, res) => {
    const sh = get(req, res)
    if (!sh) return
    const e = (sh.history || []).find(x => x.id === req.body?.entryId)
    if (!e) return res.status(404).json({ error: 'Запись не найдена' })
    if (e.p.startsWith('#') || (e.p === '' && !e.from)) return res.status(400).json({ error: 'Эту запись откатить нельзя' })
    const op = applyOp(sh, { p: e.p, v: e.from }, by(req), 'откат')
    if (!op) return res.json({ ok: true, same: true })
    touch(sh)
    notify(sh, [op])
    res.json({ ok: true })
  })

  // видимые пользователю связи «карточка героя → лист» (кнопка «Лист персонажа» на карточке)
  // журнал деятельностей (server/activities.js): лист героя, его тренировки и очки за учтённую деятельность
  const heroSheet = heroId => store.sheets.find(sh => sh.heroId === heroId && !sh.deletedAt) || null
  function addTraining(sheetId, trainId, delta, who, note) {
    const sh = find(sheetId)
    const i = sh && !sh.deletedAt ? (sh.data.Trainings || []).findIndex(t => t.Id === trainId) : -1
    if (i < 0 || !delta) return null
    const t = sh.data.Trainings[i]
    const done = applyOp(sh, { p: `Trainings.${i}.Cur`, v: Math.max(0, (Number(t.Cur) || 0) + delta) }, who, note)
    if (done) { touch(sh); notify(sh, [done], null) }
    return sh.id
  }
  // учтённая деятельность меняет лист: монеты, опыт, изнурение, вещи (с минусом — обратно). Возвращает то,
  // что изменилось на самом деле (монеты не уходят в минус, изнурение — от 0 до 5), — ровно это потом и откатывается
  function applyDelta(sheetId, d, who, note) {
    const sh = find(sheetId)
    if (!sh || sh.deletedAt || !d) return null
    const done = {}, ops = []
    const NUM = { gold: ['GoldCoins', 0, 2e9], silver: ['SilverCoins', 0, 2e9], copper: ['CopperCoins', 0, 2e9], exp: ['Experience', 0, 2e9], exh: ['Exhaustion', 0, 5] }
    for (const [k, [p, min, max]] of Object.entries(NUM)) {
      if (!d[k]) continue
      const cur = Number(sh.data[p]) || 0
      const next = Math.max(min, Math.min(max, cur + d[k]))
      if (next === cur) continue
      ops.push({ p, v: next })
      done[k] = next - cur
    }
    if (d.items?.length) {
      const inv = (sh.data.Inventory || []).map(x => ({ ...x }))
      const moved = []
      for (const it of d.items) {
        const same = x => x.Name.trim().toLowerCase() === it.name.trim().toLowerCase()
        if (it.qty > 0) {
          const ex = inv.find(x => same(x) && !!x.Stored === !!it.stored)
          if (ex) ex.Quantity = (Number(ex.Quantity) || 0) + it.qty
          else if (inv.length < 600) inv.push({ Name: it.name, Quantity: it.qty, Stored: !!it.stored, Description: note ? `Из журнала: ${note}` : '' })
          else continue
          moved.push(it)
        } else if (it.qty < 0) {
          const ex = inv.find(x => same(x) && !!x.Stored === !!it.stored) || inv.find(same)
          if (!ex) continue
          const take = Math.min(-it.qty, Number(ex.Quantity) || 0)
          ex.Quantity = (Number(ex.Quantity) || 0) - take
          if (ex.Quantity <= 0) inv.splice(inv.indexOf(ex), 1)
          if (take) moved.push({ ...it, qty: -take, stored: !!ex.Stored })
        }
      }
      if (moved.length) { ops.push({ p: 'Inventory', v: inv }); done.items = moved }
    }
    const applied = ops.map(o => applyOp(sh, o, who, note)).filter(Boolean)
    if (applied.length) { touch(sh); notify(sh, applied, null) }
    return Object.keys(done).length ? done : null
  }
  return {
    applyDelta,
    ownerOfHero: heroId => heroSheet(heroId)?.ownerId || null,
    sheetOfHero: heroId => heroSheet(heroId)?.id || null,
    trainingsOfHero(heroId) {
      const sh = heroSheet(heroId)
      if (!sh) return null
      const st = parseFloat(String(sh.data.Stamina || '').replace(',', '.'))
      return { race: sh.data.Race || '', stamina: Number.isFinite(st) ? st : null, trainings: (sh.data.Trainings || []).map(t => ({ Id: t.Id, Name: t.Name, Cur: t.Cur, Max: t.Max, Stage: t.Stage, Status: t.Status })) }
    },
    addTraining,
    linksFor: u => (u ? store.sheets.filter(sh => sh.heroId && canView(u, sh) && !sh.deletedAt).map(sh => ({ heroId: sh.heroId, sheetId: sh.id })) : []),
    // подписка подключения на открытый лист — только если его можно видеть
    subscribe(client, id) { client.sheetSub = id && canView(client.user, find(id)) ? id : null }
  }
}
