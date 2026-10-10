// Разовый перенос НПС из пакета (tools/npc-xlsx-to-json.py) в базу. Запускать при ОСТАНОВЛЕННОМ сервере:
//   node server/import-npcs.js <папка-пакета>            — добавить тех, кого ещё нет (по имени)
//   node server/import-npcs.js <папка-пакета> --replace  — заменить всех НПС (арты старых удаляются)
// Заодно собирает справочники: навыки (описание одно на всех, у кого навык) и эффекты из «… эффект (РАНА)».
import fs from 'node:fs'
import path from 'node:path'
import { loadDb, getDb, newId, PORTRAIT_DIR } from './db.js'
import { blankNpc, cleanNpc } from './npcs.js'

const [dir, flag] = process.argv.slice(2)
if (!dir || !fs.existsSync(path.join(dir, 'npcs.json'))) {
  console.error('Использование: node server/import-npcs.js <папка-пакета> [--replace]')
  process.exit(1)
}
loadDb()
const db = getDb()
const src = JSON.parse(fs.readFileSync(path.join(dir, 'npcs.json'), 'utf8'))
const dropFile = f => { if (f) try { fs.unlinkSync(path.join(PORTRAIT_DIR, path.basename(f))) } catch { /* нет */ } }

if (flag === '--replace') {
  for (const n of db.npcs) for (const a of n.arts || []) { dropFile(a.file); dropFile(a.thumb) }
  db.npcs = []
}
const known = new Set(db.npcs.map(n => n.name.toLowerCase()))

// цвет статуса по первому слову; мастер потом поменяет как хочет
const STATUS_COLORS = [[/свобод/i, '#9be07a'], [/групп/i, '#8fc7ff'], [/бою/i, '#ff7a6b'], [/обучен/i, '#c9a2ff'], [/отдых/i, '#6fd6c8'], [/недоступ/i, '#9a948a'], [/занят/i, '#ffb36b']]
const statusColor = t => STATUS_COLORS.find(([re]) => re.test(t))?.[1] || '#e6c27a'

// справочник навыков: ключ — вид + название
const lib = new Map(db.npcSkills.map(s => [`${s.kind}:${s.name.toLowerCase()}`, s]))
const skill = (kind, x) => {
  const key = `${kind}:${x.name.toLowerCase()}`
  if (!lib.has(key)) {
    const s = { id: newId('k'), kind, name: x.name, type: x.type || '', desc: x.desc || '', cooldown: x.cooldown || '', cost: x.cost || '' }
    lib.set(key, s)
    db.npcSkills.push(s)
  }
  return lib.get(key)
}
const unknown = v => !v || v === '???'

let added = 0, arts = 0
const byGroupOrder = {}
for (const raw of src) {
  if (known.has(raw.name.toLowerCase())) continue
  const id = newId('n')
  const n = blankNpc(id, raw.group, raw.name)
  const actives = raw.actives.map(a => {
    if (unknown(a.name)) return { name: '???', type: '', cooldown: '', cost: '' }
    const s = skill('active', a)
    const o = { name: a.name, type: a.type, cooldown: a.cooldown, cost: a.cost }
    if (a.desc && a.desc !== s.desc) o.desc = a.desc // своё описание, если не совпало со справочником
    return o
  })
  for (const p of raw.passives) if (!unknown(p.name)) skill('passive', p)
  Object.assign(n, cleanNpc({
    status: { text: raw.status || '', color: statusColor(raw.status || '') }, home: raw.home || '',
    info: raw.info, lists: raw.lists, specs: raw.specs, weak: raw.weak, prof: raw.prof, profSlots: raw.profSlots,
    passives: raw.passives, actives, combat: raw.combat, stats: raw.stats, saves: raw.saves, resist: raw.resist,
    attacks: raw.attacks, spells: raw.spells, spellSlots: raw.spellSlots, spellsTitle: raw.spellsTitle
  }, n))
  n.order = byGroupOrder[raw.group] = (byGroupOrder[raw.group] || 0) + 1
  fs.mkdirSync(PORTRAIT_DIR, { recursive: true })
  for (const a of raw.arts) {
    const tag = newId('').slice(0, 8)
    const file = `npc-${id}-${tag}.webp`, thumb = `npc-${id}-${tag}-t.webp`
    fs.copyFileSync(path.join(dir, 'art', a.file), path.join(PORTRAIT_DIR, file))
    fs.copyFileSync(path.join(dir, 'art', a.thumb), path.join(PORTRAIT_DIR, thumb))
    n.arts.push({ id: newId('a'), file, thumb, label: '', group: '', pos: { x: 50, y: 20, zoom: 1 } })
    arts++
  }
  db.npcs.push(n)
  added++
}

// эффекты из описаний: «получает 2 эффекта (КРОВОТЕЧЕНИЕ)» → «Кровотечение»
// падежные формы («Замедления», «Провокацию») склеиваем с основной — они становятся синонимами для подсказки
const effects = new Map(db.npcEffects.flatMap(e => [e.name, ...(e.aliases || [])].map(a => [a.toLowerCase(), e])))
const stem = s => { const w = s.toLowerCase(); return w.includes(' ') ? w : w.slice(0, Math.max(4, w.length - 2)) }
const texts = [...db.npcSkills.map(s => s.desc), ...db.npcs.flatMap(n => n.actives.map(a => a.desc || ''))]
for (const t of texts) {
  for (const m of t.matchAll(/эффект[а-яё]*\s*\(([^()]{2,40})\)/gi)) {
    const raw = m[1].trim(), key = raw.toLowerCase()
    if (effects.has(key)) continue
    const name = raw === raw.toUpperCase() ? raw[0] + raw.slice(1).toLowerCase() : raw
    const same = db.npcEffects.find(e => stem(e.name) === stem(name))
    if (same) { same.aliases.push(name); effects.set(key, same); continue }
    const e = { id: newId('e'), name, aliases: [], color: '#c9a2ff', desc: '' }
    effects.set(key, e)
    db.npcEffects.push(e)
  }
}

// связь с карточками «Героев Анкарии»: сайд-кики и компаньоны по имени (полному или первому слову)
const first = s => s.trim().split(/\s+/)[0].toLowerCase()
let links = 0
for (const n of db.npcs) {
  if (n.heroId) continue
  const kinds = n.group === 'companion' ? ['companion'] : ['sidekick']
  const h = (db.heroes || []).find(h => kinds.includes(h.kind) && (h.name.toLowerCase() === n.name.toLowerCase() || first(h.name) === first(n.name)))
  if (h) { n.heroId = h.id; links++ }
}

db.npcsRev = (db.npcsRev || 0) + 1
const tmp = path.resolve(import.meta.dirname, 'data', 'db.json.tmp')
fs.writeFileSync(tmp, JSON.stringify(db))
fs.renameSync(tmp, path.resolve(import.meta.dirname, 'data', 'db.json'))
console.log(`НПС добавлено: ${added} (всего ${db.npcs.length}), артов: ${arts}, навыков в справочнике: ${db.npcSkills.length}, эффектов: ${db.npcEffects.length}, связей с карточками героев: ${links}`)
