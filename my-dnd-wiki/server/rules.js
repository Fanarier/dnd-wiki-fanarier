// Правила «Heroes & Adventures»: расы, классы, статьи (механики, рабочие места, деятельности, магия),
// школы магии с заклинаниями и эффекты. Перенесены из Google Docs (server/seed/rules.json, rules-part2.json),
// дальше их правят на сайте мастер и редакторы, которым он дал права (src/shared/wikiPerms.js).
// Каждая правка пишется в журнал (data/rules-history.json) — мастер может её откатить.
// Хранятся отдельно от мира — data/rules.json (полтора мегабайта не нужно рассылать с каждым обновлением карты);
// в общем состоянии только rulesRev, клиент перезапрашивает /api/rules, когда он меняется.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { cleanRules } from './richtext.js'
import { canEditRule, canManageRule, RULE_LISTS } from '../src/shared/wikiPerms.js'
import { cleanBy, CARD_SCHEMA } from '../src/shared/sheet.js'
import { DEFAULT_BASE_CELLS } from '../src/shared/items.js'

const DATA_DIR = path.resolve(import.meta.dirname, 'data')
const FILE = path.join(DATA_DIR, 'rules.json')
const SEED = path.resolve(import.meta.dirname, 'seed', 'rules.json')
const SEED2 = path.resolve(import.meta.dirname, 'seed', 'rules-part2.json')
const HISTORY = path.join(DATA_DIR, 'rules-history.json')
export const RULES_IMG_DIR = path.join(DATA_DIR, 'rules-img')
const BACKUP_DIR = path.join(DATA_DIR, 'backups')
export const RULE_GROUPS = ['mechanics', 'workplaces', 'activities', 'holdings', 'classes', 'races', 'magic']
// страницы вики со школами магии (у каждой школы — своя)
export const MAGIC_PAGES = ['utility', 'school-fire', 'school-water', 'school-air', 'school-earth']
const EFFECT_KINDS = ['buff', 'debuff', 'special']

let store = null
let timer = null
function load() {
  try { store = JSON.parse(fs.readFileSync(FILE, 'utf8')) } catch { store = null }
  if (!store) {
    try { store = JSON.parse(fs.readFileSync(SEED, 'utf8')) } catch { store = {} }
    store.rev = 1
    console.log('[rules] правила перенесены из Google Docs')
    writeNow()
  }
  store.articles ||= []
  store.races ||= []
  store.classes ||= []
  store.schools ||= []
  store.spells ||= []
  store.effects ||= []
  store.items ||= []
  store.settings ||= {}
  store.rev ||= 1
  applyFixes()
}

// исправления перенесённых данных — каждое применяется один раз (правки мастера после него не трогаются)
const esc = c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
// «<p><strong>Крепкое здоровье</strong>: Вы имеете…» → «<p>Вы имеете…»: название уже в заголовке навыка
// (между буквами названия в документе бывают пробелы и теги: «Обозреваемост ь:»)
function stripNamePrefix(s) {
  if (!s?.name || !s.html) return false
  const letters = [...s.name.replace(/\s+/g, '')].map(esc).join('(?:\\s|&nbsp;|<[^>]+>)*')
  const re = new RegExp('^(<p>)((?:\\s|&nbsp;|<[^>]+>)*)' + letters + '(?:\\s|&nbsp;|<[^>]+>)*[:.]\\s*', 'i')
  // текст названия убираем, а все теги из этого куска оставляем — разметка остаётся парной
  const out = s.html.replace(re, m => '<p>' + (m.slice(3).match(/<[^>]+>/g) || []).join(''))
  if (out === s.html) return false
  s.html = out
  return true
}
// разметка после переноса местами непарная («<p></em>…») — пропускаем через очистку, она её выравнивает
const tidy = it => { if (it?.html) it.html = cleanRules(it.html).replace(/<(strong|em|u)><\/\1>/g, '').replace(/<(strong|em|u)><\/\1>/g, '') }
const FIXES = {
  // повтор названия в начале описания расовых навыков
  'strip-name-prefix': () => {
    let n = 0
    for (const race of store.races) {
      for (const it of [...race.base, ...race.levels.flatMap(l => [l.auto, ...l.options])]) {
        if (stripNamePrefix(it)) n++
        tidy(it)
      }
    }
    return n
  },
  // опечатка в документе: вариант 12 уровня у Человека «Шипон» — это «Шпион»
  'typo-shpion': () => {
    let n = 0
    for (const race of store.races) for (const l of race.levels) for (const o of l.options) if (o.name === 'Шипон') { o.name = 'Шпион'; n++ }
    return n
  },
  // у людей на каждом уровне выбирают два варианта
  'human-pick-2': () => {
    const h = store.races.find(x => x.name === 'Человек')
    if (!h) return 0
    for (const l of h.levels) if (l.options.length > 2) l.pick = 2
    return h.levels.length
  },
  // «Разносторонний» (6) и «Разносторонний II» (10): один вариант, а вместо второго — владение навыком по выбору
  'human-versatile': () => {
    const h = store.races.find(x => x.name === 'Человек')
    if (!h) return 0
    let n = 0
    for (const l of h.levels) if (/^Разносторонний/.test(l.auto?.name || '')) { l.pick = 1; l.prof = 1; n++ }
    return n
  },
  // вторая часть вики: магия (была страницами сайта), статья «НПС», эффекты с иконками
  part2: () => {
    let seed = {}
    try { seed = JSON.parse(fs.readFileSync(SEED2, 'utf8')) } catch { return 0 }
    const next = list => Math.max(0, ...store[list].map(x => x.order || 0)) + 1
    for (const a of seed.articles || []) store.articles.push({ id: 'a-' + crypto.randomBytes(4).toString('hex'), order: next('articles'), ...cleanArticle(a) })
    for (const x of seed.schools || []) if (!store.schools.some(y => y.id === x.id)) store.schools.push({ id: x.id, order: next('schools'), ...cleanSchool(x) })
    for (const x of seed.spells || []) if (!store.spells.some(y => y.id === x.id)) store.spells.push({ id: x.id, order: next('spells'), ...cleanSpell(x) })
    for (const x of seed.effects || []) if (!store.effects.some(y => y.id === x.id)) store.effects.push({ id: x.id, order: next('effects'), ...cleanEffect(x) })
    return (seed.articles?.length || 0) + (seed.spells?.length || 0) + (seed.effects?.length || 0)
  }
}
function applyFixes() {
  const done = (store.fixes ||= [])
  let changed = false
  for (const [id, fn] of Object.entries(FIXES)) {
    if (done.includes(id)) continue
    const n = fn()
    done.push(id)
    changed = true
    console.log(`[rules] исправление «${id}»: ${n}`)
  }
  if (changed) { store.rev++; writeNow() }
}
function writeNow() {
  timer = null
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(FILE + '.tmp', JSON.stringify(store))
  fs.renameSync(FILE + '.tmp', FILE)
}
const save = () => { store.rev++; timer ||= setTimeout(writeNow, 400) }
export function flushRules() {
  if (timer) { clearTimeout(timer); writeNow() }
  if (historyTimer) { clearTimeout(historyTimer); writeHistory() }
}
function backup() {
  if (!fs.existsSync(FILE)) return
  fs.mkdirSync(BACKUP_DIR, { recursive: true })
  const target = path.join(BACKUP_DIR, 'rules-' + new Date().toISOString().slice(0, 10) + '.json')
  if (!fs.existsSync(target)) fs.copyFileSync(FILE, target)
  const files = fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith('rules-')).sort()
  for (const old of files.slice(0, -30)) fs.unlinkSync(path.join(BACKUP_DIR, old))
}

/* ---------- проверка присланного мастером ---------- */
const S = (v, n) => String(v ?? '').slice(0, n).trim()
const H = v => cleanRules(v)
const N = (v, min, max) => Math.max(min, Math.min(max, Math.round(Number(v)) || 0))
const arr = (v, max, fn) => (Array.isArray(v) ? v.slice(0, max).map(fn).filter(Boolean) : [])
const skillOf = s => ({ name: S(s?.name, 120), html: H(s?.html) })
const classSkill = s => (S(s?.name, 120) ? { lv: N(s.lv, 0, 40), name: S(s.name, 120), kind: S(s.kind, 60), tags: arr(s.tags, 12, t => S(t, 60) || null), html: H(s.html) } : null)
function cleanRace(b = {}, old = {}) {
  return {
    ...old,
    name: S(b.name ?? old.name, 80) || 'Раса',
    hidden: !!b.hidden,
    intro: H(b.intro ?? old.intro),
    outro: H(b.outro ?? old.outro),
    base: arr(b.base ?? old.base, 20, s => (S(s?.name, 120) ? skillOf(s) : null)),
    levels: arr(b.levels ?? old.levels, 30, l => ({
      lv: N(l?.lv, 1, 40),
      pick: N(l?.pick || 1, 1, 6), // сколько вариантов выбирают на этом уровне
      prof: N(l?.prof, 0, 6), // и сколько навыков (Атлетика, Внимание…) получают во владение по выбору
      auto: l?.auto && S(l.auto.name, 120) ? skillOf(l.auto) : null,
      options: arr(l?.options, 10, s => (S(s?.name, 120) ? skillOf(s) : null))
    })).sort((a, b) => a.lv - b.lv),
    empty: false
  }
}
function cleanClass(b = {}, old = {}) {
  return {
    ...old,
    name: S(b.name ?? old.name, 80) || 'Класс',
    hidden: !!b.hidden,
    intro: H(b.intro ?? old.intro),
    outro: H(b.outro ?? old.outro),
    skills: arr(b.skills ?? old.skills, 80, classSkill).sort((a, c) => a.lv - c.lv),
    archetypes: arr(b.archetypes ?? old.archetypes, 12, a => (S(a?.name, 80) ? { name: S(a.name, 80), about: H(a.about), skills: arr(a.skills, 40, classSkill).sort((x, y) => x.lv - y.lv) } : null)),
    empty: false
  }
}
const cleanArticle = (b = {}, old = {}) => ({
  ...old,
  title: S(b.title ?? old.title, 120) || 'Статья',
  group: RULE_GROUPS.includes(b.group) ? b.group : old.group || 'mechanics',
  hidden: !!b.hidden,
  html: H(b.html ?? old.html)
})

const cleanSchool = (b = {}, old = {}) => ({
  ...old,
  name: S(b.name ?? old.name, 80) || 'Школа',
  page: MAGIC_PAGES.includes(b.page) ? b.page : old.page || 'utility',
  hidden: !!b.hidden,
  about: H(b.about ?? old.about)
})
const cleanSpell = (b = {}, old = {}) => ({
  ...old,
  school: S(b.school ?? old.school, 40),
  circle: S(b.circle ?? old.circle, 12).toUpperCase(),
  name: S(b.name ?? old.name, 120) || 'Заклинание',
  hidden: !!b.hidden,
  html: H(b.html ?? old.html),
  cost: S(b.cost ?? old.cost, 160),
  cd: S(b.cd ?? old.cd, 160)
})
// иконка — из комплекта (assets/effects) или загруженная на сайт (rules-img)
const ICON_RE = /^\/(assets\/effects|rules-img)\/[\w.-]{1,80}$/
const cleanEffect = (b = {}, old = {}) => ({
  ...old,
  kind: EFFECT_KINDS.includes(b.kind) ? b.kind : old.kind || 'buff',
  name: S(b.name ?? old.name, 80) || 'Эффект',
  tag: S(b.tag ?? old.tag, 60),
  icon: ICON_RE.test(String(b.icon ?? old.icon ?? '')) ? String(b.icon ?? old.icon) : '',
  hidden: !!b.hidden,
  html: H(b.html ?? old.html)
})

// уникальный предмет без хозяина или общий для группы (shared): как в листе — название, редкость, картинка, описание, карточка
const cleanItem = (b = {}, old = {}) => ({
  ...old,
  name: S(b.name ?? old.name, 160) || 'Предмет',
  rarity: S(b.rarity ?? old.rarity, 40),
  img: ICON_RE.test(String(b.img ?? old.img ?? '')) ? String(b.img ?? old.img) : '',
  shared: !!(b.shared ?? old.shared),
  hidden: !!b.hidden,
  html: H(b.html ?? old.html),
  card: cleanBy(CARD_SCHEMA, b.card === undefined ? old.card : b.card)
})

/* ---------- журнал правок: кто, что, было → стало; мастер откатывает ---------- */
let history = null
let historyTimer = null
const HISTORY_MAX = 400
function loadHistory() {
  if (history) return history
  try { history = JSON.parse(fs.readFileSync(HISTORY, 'utf8')) } catch { history = [] }
  return history
}
function writeHistory() {
  historyTimer = null
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(HISTORY + '.tmp', JSON.stringify(history))
  fs.renameSync(HISTORY + '.tmp', HISTORY)
}
const titleOf = x => x?.title || x?.name || ''
function record(u, list, action, before, after, note = '') {
  const h = loadHistory()
  const last = h.at(-1)
  const itemId = (after || before)?.id
  // правки одной записи одним человеком подряд в течение 10 минут — одна строка журнала («было» — самое первое)
  if (action === 'update' && !note && last?.action === 'update' && !last.note && last.list === list && last.itemId === itemId &&
      last.byId === u.id && Date.now() - last.at < 600000 && !last.reverted) {
    Object.assign(last, { at: Date.now(), after, title: titleOf(after) })
  } else {
    h.push({ hid: 'h' + crypto.randomBytes(5).toString('hex'), at: Date.now(), byId: u.id, by: u.name || u.login || '', role: u.role, list, itemId, title: titleOf(after || before), action, before, after, note })
    if (h.length > HISTORY_MAX) h.splice(0, h.length - HISTORY_MAX)
  }
  historyTimer ||= setTimeout(writeHistory, 800)
}

export function registerRulesRoutes(app, { express, requireMaster, requireUser, userOf, broadcast, imageExt }) {
  load()
  backup()
  setInterval(backup, 6 * 3600 * 1000)
  const CLEAN = { articles: [cleanArticle, 'a-'], races: [cleanRace, 'r-'], classes: [cleanClass, 'k-'], schools: [cleanSchool, 'm-'], spells: [cleanSpell, 's-'], effects: [cleanEffect, 'fx-'], items: [cleanItem, 'it-'] }
  const changed = () => { save(); broadcast() }
  const deny = res => res.status(403).json({ error: 'Эту страницу вики тебе править нельзя — права даёт мастер' })
  const copy = x => (x ? JSON.parse(JSON.stringify(x)) : null)
  const noSchool = (list, x) => list === 'spells' && !store.schools.some(s => s.id === x.school)

  // всё сразу; скрытое видят мастер и редакторы этой страницы
  app.get('/api/rules', (req, res) => {
    const u = userOf(req)
    const out = { rev: store.rev }
    for (const list of RULE_LISTS) out[list] = store[list].filter(x => !x.hidden || canEditRule(u, list, x))
    out.settings = { baseCells: store.settings.baseCells ?? DEFAULT_BASE_CELLS }
    res.json(out)
  })

  for (const [list, [clean, prefix]] of Object.entries(CLEAN)) {
    app.post(`/api/rules/${list}`, requireUser, (req, res) => {
      const body = clean(req.body || {})
      if (noSchool(list, body)) return res.status(400).json({ error: 'Нет такой школы' })
      if (!canManageRule(req.user, list, body)) return deny(res)
      const items = store[list]
      const item = { id: prefix + crypto.randomBytes(4).toString('hex'), order: Math.max(0, ...items.map(x => x.order || 0)) + 1, ...body }
      items.push(item)
      record(req.user, list, 'create', null, copy(item))
      changed()
      res.json(item)
    })
    app.put(`/api/rules/${list}/:id`, requireUser, (req, res) => {
      const i = store[list].findIndex(x => x.id === req.params.id)
      if (i < 0) return res.status(404).json({ error: 'Не найдено' })
      const old = store[list][i]
      const next = clean(req.body || {}, old)
      // перенести запись в чужой раздел (статью в другую группу, заклинание в другую школу) — только с правом и там
      if (!canEditRule(req.user, list, old) || !canEditRule(req.user, list, next)) return deny(res)
      if (noSchool(list, next)) return res.status(400).json({ error: 'Нет такой школы' })
      if (JSON.stringify(next) === JSON.stringify(old)) return res.json(old)
      store[list][i] = next
      record(req.user, list, 'update', copy(old), copy(next))
      changed()
      res.json(next)
    })
    app.delete(`/api/rules/${list}/:id`, requireUser, (req, res) => {
      const old = store[list].find(x => x.id === req.params.id)
      if (!old) return res.status(404).json({ error: 'Не найдено' })
      if (!canManageRule(req.user, list, old)) return deny(res)
      if (list === 'schools' && store.spells.some(x => x.school === old.id)) return res.status(400).json({ error: 'В школе есть заклинания — сначала убери или перенеси их' })
      store[list] = store[list].filter(x => x.id !== old.id)
      record(req.user, list, 'delete', copy(old), null)
      changed()
      res.json({ ok: true })
    })
    // порядок: ids по порядку → order 1, 2, 3…
    app.post(`/api/rules/${list}-order`, requireUser, (req, res) => {
      const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : []
      const items = ids.map(id => store[list].find(y => y.id === id)).filter(Boolean)
      if (items.some(x => !canManageRule(req.user, list, x))) return deny(res)
      items.forEach((x, i) => { x.order = i + 1 })
      changed()
      res.json({ ok: true })
    })
  }

  // настройки вики для листов: сколько ячеек сумки без рюкзака (мастер)
  app.put('/api/rules/settings', requireMaster, (req, res) => {
    const n = Math.round(Number(req.body?.baseCells))
    if (!(n >= 0 && n <= 200)) return res.status(400).json({ error: 'Число ячеек — от 0 до 200' })
    store.settings.baseCells = n
    changed()
    res.json({ baseCells: n })
  })

  // своя иконка эффекта вместо иконки из комплекта; картинка предмета вики
  app.post('/api/rules/icon', requireUser, express.raw({ type: () => true, limit: '2mb' }), (req, res) => {
    const pages = req.user.wiki?.pages || []
    const may = list => canManageRule(req.user, list, {}) || pages.some(p => p.startsWith(list + ':'))
    if (!may('effects') && !may('items')) return deny(res)
    const ext = imageExt(req.body)
    if (!ext) return res.status(400).json({ error: 'Нужна картинка PNG, JPG, GIF или WebP' })
    const name = crypto.createHash('sha256').update(req.body).digest('hex').slice(0, 24) + '.' + ext
    fs.mkdirSync(RULES_IMG_DIR, { recursive: true })
    const f = path.join(RULES_IMG_DIR, name)
    if (!fs.existsSync(f)) fs.writeFileSync(f, req.body)
    res.json({ icon: '/rules-img/' + name })
  })

  /* ---------- журнал правок (мастер) ---------- */
  app.get('/api/rules/history', requireMaster, (req, res) => {
    const { list, id } = req.query
    const rows = loadHistory().filter(x => (!list || x.list === list) && (!id || x.itemId === id)).slice(-200).reverse()
    // без снимков «было/стало» — они большие; их отдаёт запрос одной строки
    res.json(rows.map(({ before, after, ...x }) => x))
  })
  app.get('/api/rules/history/:hid', requireMaster, (req, res) => {
    const row = loadHistory().find(x => x.hid === req.params.hid)
    if (!row) return res.status(404).json({ error: 'Нет такой правки' })
    res.json(row)
  })
  // откат: создание → убрать, удаление → вернуть, правка → вернуть как было
  app.post('/api/rules/history/:hid/revert', requireMaster, (req, res) => {
    const row = loadHistory().find(x => x.hid === req.params.hid)
    if (!row || !CLEAN[row.list]) return res.status(404).json({ error: 'Нет такой правки' })
    const items = store[row.list]
    const i = items.findIndex(x => x.id === row.itemId)
    const cur = i >= 0 ? copy(items[i]) : null
    let action
    if (row.action === 'create') {
      if (i < 0) return res.status(400).json({ error: 'Этого уже нет' })
      items.splice(i, 1)
      action = 'delete'
    } else if (row.before) {
      if (row.list === 'spells' && !store.schools.some(s => s.id === row.before.school)) return res.status(400).json({ error: 'Школы этого заклинания уже нет' })
      if (i >= 0) items[i] = copy(row.before)
      else items.push(copy(row.before))
      action = i >= 0 ? 'update' : 'create'
    } else return res.status(400).json({ error: 'Эту правку не откатить' })
    row.reverted = Date.now()
    record(req.user, row.list, action, cur, action === 'delete' ? null : copy(row.before), 'откат')
    changed()
    res.json({ ok: true })
  })
  // предмет из вики ушёл герою: убираем (в журнале — «выдан …»), отдаём копию
  function takeItem(id, u, note) {
    const i = store.items.findIndex(x => x.id === id)
    if (i < 0) return null
    const [it] = store.items.splice(i, 1)
    record(u, 'items', 'delete', copy(it), null, note)
    changed()
    return copy(it)
  }
  // предмет вернулся в вики (из листа): новая запись
  function putItem(body, u, note) {
    const item = { id: 'it-' + crypto.randomBytes(4).toString('hex'), order: Math.max(0, ...store.items.map(x => x.order || 0)) + 1, ...cleanItem(body) }
    store.items.push(item)
    record(u, 'items', 'create', null, copy(item), note)
    changed()
    return item
  }
  const getItem = id => store.items.find(x => x.id === id) || null
  return { rev: () => store.rev, takeItem, putItem, getItem, baseCells: () => store.settings.baseCells ?? DEFAULT_BASE_CELLS }
}
