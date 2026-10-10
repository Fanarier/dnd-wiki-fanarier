// НПС: полные листы персонажей (сайд-кики, личные сайд-кики, компаньоны, важные НПС, аспекты)
// и два общих справочника — навыки (описание пишется один раз и подтягивается всем, у кого этот навык)
// и эффекты (подсказка при наведении на «(РАНА)» в описаниях). Правит только мастер.
// Данные отдаются отдельным запросом: в общем состоянии только npcsRev — клиент перезапрашивает, когда он меняется.
import fs from 'node:fs'
import path from 'node:path'
import { findPlace } from '../src/shared/npc.js'

export const NPC_GROUPS = ['sidekick', 'personal', 'companion', 'important', 'aspect']
const S = (v, n) => String(v ?? '').slice(0, n).trim()
const arr = (v, max, fn) => (Array.isArray(v) ? v.slice(0, max).map(fn) : [])
const COLOR = v => (/^#[0-9a-f]{6}$/i.test(String(v || '')) ? String(v) : '')
const ART_MAX = 24

// частичная правка: меняем только присланные поля
export function cleanNpc(b = {}, old = {}) {
  const has = k => b[k] !== undefined
  const n = { ...old }
  if (has('group')) n.group = NPC_GROUPS.includes(b.group) ? b.group : old.group || 'sidekick'
  if (has('name')) n.name = S(b.name, 80) || old.name || 'Без имени'
  if (has('hidden')) n.hidden = !!b.hidden
  if (has('heroId')) n.heroId = b.heroId ? S(b.heroId, 24) : null
  if (has('order')) n.order = Number(b.order) || 0
  if (has('status')) n.status = { text: S(b.status?.text, 80), color: COLOR(b.status?.color) || '#9be07a' }
  if (has('home')) n.home = S(b.home, 120)
  if (has('info')) n.info = arr(b.info, 40, x => ({ k: S(x?.k, 60), v: S(x?.v, 300) })).filter(x => x.k)
  if (has('lists')) n.lists = arr(b.lists, 12, x => ({ title: S(x?.title, 60), items: arr(x?.items, 80, i => S(i, 300)).filter(Boolean) })).filter(x => x.title)
  const lv = x => ({ name: S(x?.name, 80), level: S(x?.level, 40) })
  for (const k of ['specs', 'weak', 'prof']) if (has(k)) n[k] = arr(b[k], 40, lv).filter(x => x.name)
  if (has('passives')) n.passives = arr(b.passives, 80, x => ({ name: S(x?.name, 80), type: S(x?.type, 40) })).filter(x => x.name)
  if (has('actives')) {
    n.actives = arr(b.actives, 60, x => {
      const o = { name: S(x?.name, 80), type: S(x?.type, 40), cooldown: S(x?.cooldown, 80), cost: S(x?.cost, 80) }
      const d = S(x?.desc, 4000)
      if (d) o.desc = d // своё описание только если отличается от справочника
      return o
    }).filter(x => x.name)
  }
  for (const k of ['combat', 'stats']) {
    if (has(k)) n[k] = Object.fromEntries(Object.entries(b[k] || {}).slice(0, 20).map(([a, v]) => [S(a, 40), S(v, 40)]).filter(([a]) => a))
  }
  if (has('saves')) n.saves = arr(b.saves, 12, x => ({ stat: S(x?.stat, 40), value: S(x?.value, 20) })).filter(x => x.stat)
  if (has('resist')) n.resist = arr(b.resist, 20, x => ({ kind: S(x?.kind, 60), value: S(x?.value, 60) })).filter(x => x.kind)
  if (has('attacks')) n.attacks = arr(b.attacks, 30, x => ({ name: S(x?.name, 60), dtype: S(x?.dtype, 40), kind: S(x?.kind, 40), dmg: S(x?.dmg, 20), note: S(x?.note, 160) })).filter(x => x.name)
  if (has('spells')) n.spells = arr(b.spells, 40, x => S(x, 200)).filter(Boolean)
  for (const k of ['profSlots', 'spellSlots']) if (has(k)) n[k] = Math.max(0, Math.min(30, Math.round(Number(b[k]) || 0)))
  if (has('spellsTitle')) n.spellsTitle = S(b.spellsTitle, 60)
  n.updatedAt = Date.now()
  return n
}
export const blankNpc = (id, group, name) => cleanNpc({
  group, name, hidden: false, heroId: null, status: { text: '', color: '#9be07a' }, home: '', info: [], lists: [], specs: [], weak: [], prof: [],
  passives: [], actives: [], combat: {}, stats: {}, saves: [], resist: [], attacks: [], spells: [], profSlots: 0, spellSlots: 0, spellsTitle: ''
}, { id, arts: [], createdAt: Date.now() })

const cleanSkill = (b = {}, old = {}) => ({
  ...old,
  kind: b.kind === 'active' || b.kind === 'passive' ? b.kind : old.kind || 'passive',
  name: S(b.name ?? old.name, 80),
  type: S(b.type ?? old.type, 40),
  desc: S(b.desc ?? old.desc, 4000),
  cooldown: S(b.cooldown ?? old.cooldown, 80),
  cost: S(b.cost ?? old.cost, 80)
})
const cleanEffect = (b = {}, old = {}) => ({
  ...old,
  name: S(b.name ?? old.name, 60),
  aliases: b.aliases !== undefined ? arr(b.aliases, 12, a => S(a, 60)).filter(Boolean) : old.aliases || [],
  color: COLOR(b.color) || old.color || '#c9a2ff',
  desc: S(b.desc ?? old.desc, 2000)
})

export function registerNpcRoutes(app, { express, requireMaster, userOf, getDb, saveDb, broadcast, newId, PORTRAIT_DIR, imageExt }) {
  const db = () => getDb()
  const changed = () => { db().npcsRev = (db().npcsRev || 0) + 1; saveDb(); broadcast() }
  const find = id => db().npcs.find(n => n.id === id)
  const dropFile = f => { if (f) try { fs.unlinkSync(path.join(PORTRAIT_DIR, path.basename(f))) } catch { /* нет файла */ } }

  // всё сразу: листы (скрытые — только мастеру) и оба справочника
  app.get('/api/npcs', (req, res) => {
    const master = userOf(req)?.role === 'master'
    res.json({ rev: db().npcsRev || 0, npcs: db().npcs.filter(n => master || !n.hidden), skills: db().npcSkills, effects: db().npcEffects })
  })

  app.post('/api/npcs', requireMaster, (req, res) => {
    const group = NPC_GROUPS.includes(req.body?.group) ? req.body.group : 'sidekick'
    const n = blankNpc(newId('n'), group, req.body?.name)
    n.order = Math.max(0, ...db().npcs.filter(x => x.group === group).map(x => x.order || 0)) + 1
    db().npcs.push(n)
    changed()
    res.json(n)
  })
  // порядок НПС в группе (мастер перетаскивает карточки): ids по порядку → order 1, 2, 3…
  app.post('/api/npcs-order', requireMaster, (req, res) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : []
    ids.forEach((id, i) => { const n = find(id); if (n) n.order = i + 1 })
    changed()
    res.json({ ok: true })
  })
  app.patch('/api/npcs/:id', requireMaster, (req, res) => {
    const old = find(req.params.id)
    if (!old) return res.status(404).json({ error: 'НПС не найден' })
    const { id, arts, createdAt, ...body } = req.body || {}
    Object.assign(old, cleanNpc(body, old))
    changed()
    res.json(old)
  })
  app.delete('/api/npcs/:id', requireMaster, (req, res) => {
    const n = find(req.params.id)
    if (!n) return res.status(404).json({ error: 'НПС не найден' })
    for (const a of n.arts || []) { dropFile(a.file); dropFile(a.thumb) }
    dropFile(n.avatar)
    db().npcs = db().npcs.filter(x => x !== n)
    changed()
    res.json({ ok: true })
  })

  // арты: целиком + лёгкое превью; подпись и «форма» (у Луны — две формы и разные наряды)
  const saveFile = (n, buf, suffix) => {
    const ext = imageExt(buf)
    if (!ext) return null
    fs.mkdirSync(PORTRAIT_DIR, { recursive: true })
    const file = `npc-${n.id}-${newId('').slice(0, 8)}${suffix}.${ext}`
    fs.writeFileSync(path.join(PORTRAIT_DIR, file), buf)
    return file
  }
  app.post('/api/npcs/:id/arts', requireMaster, express.raw({ type: () => true, limit: '12mb' }), (req, res) => {
    const n = find(req.params.id)
    if (!n) return res.status(404).json({ error: 'НПС не найден' })
    n.arts ||= []
    if (n.arts.length >= ART_MAX) return res.status(400).json({ error: `Уже ${ART_MAX} артов` })
    const file = saveFile(n, req.body, '')
    if (!file) return res.status(400).json({ error: 'Нужна картинка PNG, JPG, GIF или WebP' })
    const a = { id: newId('a'), file, thumb: '', label: '', group: '', pos: { x: 50, y: 20, zoom: 1 } }
    n.arts.push(a)
    changed()
    res.json(a)
  })
  app.post('/api/npcs/:id/arts/:aid/thumb', requireMaster, express.raw({ type: () => true, limit: '3mb' }), (req, res) => {
    const a = find(req.params.id)?.arts?.find(x => x.id === req.params.aid)
    if (!a) return res.status(404).json({ error: 'Арт не найден' })
    const file = saveFile(find(req.params.id), req.body, '-t')
    if (!file) return res.status(400).json({ error: 'Нужна картинка' })
    dropFile(a.thumb)
    a.thumb = file
    changed()
    res.json(a)
  })
  app.patch('/api/npcs/:id/arts/:aid', requireMaster, (req, res) => {
    const a = find(req.params.id)?.arts?.find(x => x.id === req.params.aid)
    if (!a) return res.status(404).json({ error: 'Арт не найден' })
    const b = req.body || {}
    if (b.label !== undefined) a.label = S(b.label, 60)
    if (b.group !== undefined) a.group = S(b.group, 40)
    if (b.pos) a.pos = { x: Math.max(0, Math.min(100, +b.pos.x || 0)), y: Math.max(0, Math.min(100, +b.pos.y || 0)), zoom: Math.max(1, Math.min(4, +b.pos.zoom || 1)) }
    changed()
    res.json(a)
  })
  // миниатюра для карты: квадрат, вырезанный из арта (или своя картинка); без неё берётся первый арт
  app.post('/api/npcs/:id/avatar', requireMaster, express.raw({ type: () => true, limit: '3mb' }), (req, res) => {
    const n = find(req.params.id)
    if (!n) return res.status(404).json({ error: 'НПС не найден' })
    const file = saveFile(n, req.body, '-av')
    if (!file) return res.status(400).json({ error: 'Нужна картинка PNG, JPG, GIF или WebP' })
    dropFile(n.avatar)
    n.avatar = file
    changed()
    res.json({ avatar: file })
  })
  app.delete('/api/npcs/:id/avatar', requireMaster, (req, res) => {
    const n = find(req.params.id)
    if (!n) return res.status(404).json({ error: 'НПС не найден' })
    dropFile(n.avatar)
    n.avatar = ''
    changed()
    res.json({ ok: true })
  })
  app.post('/api/npcs/:id/arts-order', requireMaster, (req, res) => {
    const n = find(req.params.id)
    if (!n) return res.status(404).json({ error: 'НПС не найден' })
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : []
    n.arts = [...ids.map(id => n.arts.find(a => a.id === id)).filter(Boolean), ...n.arts.filter(a => !ids.includes(a.id))]
    changed()
    res.json({ ok: true })
  })
  app.delete('/api/npcs/:id/arts/:aid', requireMaster, (req, res) => {
    const n = find(req.params.id), a = n?.arts?.find(x => x.id === req.params.aid)
    if (!a) return res.status(404).json({ error: 'Арт не найден' })
    dropFile(a.file); dropFile(a.thumb)
    n.arts = n.arts.filter(x => x !== a)
    changed()
    res.json({ ok: true })
  })

  // справочники: навыки и эффекты
  for (const [url, coll, clean, prefix, what] of [
    ['/api/npc-skills', 'npcSkills', cleanSkill, 'k', 'Навык'],
    ['/api/npc-effects', 'npcEffects', cleanEffect, 'e', 'Эффект']
  ]) {
    app.post(url, requireMaster, (req, res) => {
      const x = { id: newId(prefix), ...clean(req.body || {}) }
      if (!x.name) return res.status(400).json({ error: 'Нужно название' })
      const dup = db()[coll].find(o => o.name.toLowerCase() === x.name.toLowerCase() && (coll !== 'npcSkills' || o.kind === x.kind))
      if (dup) return res.status(409).json({ error: `${what} «${dup.name}» уже есть в справочнике` })
      db()[coll].push(x)
      changed()
      res.json(x)
    })
    app.patch(url + '/:id', requireMaster, (req, res) => {
      const i = db()[coll].findIndex(o => o.id === req.params.id)
      if (i < 0) return res.status(404).json({ error: `${what} не найден` })
      const x = clean(req.body || {}, db()[coll][i])
      if (!x.name) return res.status(400).json({ error: 'Нужно название' })
      db()[coll][i] = x
      changed()
      res.json(x)
    })
    app.delete(url + '/:id', requireMaster, (req, res) => {
      const before = db()[coll].length
      db()[coll] = db()[coll].filter(o => o.id !== req.params.id)
      if (db()[coll].length === before) return res.status(404).json({ error: `${what} не найден` })
      changed()
      res.json({ ok: true })
    })
  }
}

// ссылки «карточка героя → лист НПС» для состояния (скрытые НПС — только мастеру)
export const npcLinks = (db, master) => Object.fromEntries((db.npcs || []).filter(n => n.heroId && (master || !n.hidden)).map(n => [n.heroId, n.id]))

// миниатюры НПС над городами на карте мира: город — по месту жительства (или город поселения).
// Скрытые НПС — только мастеру; скрытый город игрок и так не получает, значит и миниатюры у него не будет
export function npcPins(db, master) {
  const out = []
  for (const n of db.npcs || []) {
    if (n.hidden && !master) continue
    const cityId = findPlace(n.home, db.cities, db.settlements)?.city?.id
    if (!cityId) continue
    const a = n.arts?.[0]
    out.push({ id: n.id, name: n.name, cityId, img: n.avatar || a?.thumb || a?.file || '', square: !!n.avatar, y: a?.pos?.y ?? 20 })
  }
  return out
}
