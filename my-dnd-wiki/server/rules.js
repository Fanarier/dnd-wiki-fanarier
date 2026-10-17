// Правила «Heroes & Adventures»: расы, классы и статьи (механики, рабочие места, деятельности).
// Перенесены из Google Docs (server/seed/rules.json), дальше их правит мастер на сайте.
// Хранятся отдельно от мира — data/rules.json (полтора мегабайта не нужно рассылать с каждым обновлением карты);
// в общем состоянии только rulesRev, клиент перезапрашивает /api/rules, когда он меняется.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { cleanRules } from './richtext.js'

const DATA_DIR = path.resolve(import.meta.dirname, 'data')
const FILE = path.join(DATA_DIR, 'rules.json')
const SEED = path.resolve(import.meta.dirname, 'seed', 'rules.json')
const BACKUP_DIR = path.join(DATA_DIR, 'backups')
export const RULE_GROUPS = ['mechanics', 'workplaces', 'activities', 'classes', 'races']

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
export function flushRules() { if (timer) { clearTimeout(timer); writeNow() } }
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

export function registerRulesRoutes(app, { requireMaster, userOf, broadcast }) {
  load()
  backup()
  setInterval(backup, 6 * 3600 * 1000)
  const LISTS = { articles: [cleanArticle, 'a-'], races: [cleanRace, 'r-'], classes: [cleanClass, 'k-'] }
  const changed = () => { save(); broadcast() }

  // всё сразу (скрытое — только мастеру)
  app.get('/api/rules', (req, res) => {
    const master = userOf(req)?.role === 'master'
    const vis = x => master || !x.hidden
    res.json({ rev: store.rev, articles: store.articles.filter(vis), races: store.races.filter(vis), classes: store.classes.filter(vis) })
  })

  for (const [list, [clean, prefix]] of Object.entries(LISTS)) {
    app.post(`/api/rules/${list}`, requireMaster, (req, res) => {
      const items = store[list]
      const item = { id: prefix + crypto.randomBytes(4).toString('hex'), order: Math.max(0, ...items.map(x => x.order || 0)) + 1, ...clean(req.body || {}) }
      items.push(item)
      changed()
      res.json(item)
    })
    app.put(`/api/rules/${list}/:id`, requireMaster, (req, res) => {
      const i = store[list].findIndex(x => x.id === req.params.id)
      if (i < 0) return res.status(404).json({ error: 'Не найдено' })
      store[list][i] = clean(req.body || {}, store[list][i])
      changed()
      res.json(store[list][i])
    })
    app.delete(`/api/rules/${list}/:id`, requireMaster, (req, res) => {
      const before = store[list].length
      store[list] = store[list].filter(x => x.id !== req.params.id)
      if (store[list].length === before) return res.status(404).json({ error: 'Не найдено' })
      changed()
      res.json({ ok: true })
    })
    // порядок: ids по порядку → order 1, 2, 3…
    app.post(`/api/rules/${list}-order`, requireMaster, (req, res) => {
      const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : []
      ids.forEach((id, i) => { const x = store[list].find(y => y.id === id); if (x) x.order = i + 1 })
      changed()
      res.json({ ok: true })
    })
  }
  return { rev: () => store.rev }
}
