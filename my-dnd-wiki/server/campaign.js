// Квесты и хроника сюжета кампании (страница вики «Квесты»). Игроки читают, правит мастер.
// Хранится в базе мира: db.campaign = { volumes: [...], quests: [...], chapters: [...] }.
// Начальные данные — server/seed/campaign.json (tools/campaign-xlsx-to-json.py), берутся один раз.
const S = (v, n) => String(v ?? '').replace(/\r\n/g, '\n').slice(0, n).trim()

export const CQ_DIFFICULTY = ['Легкий', 'Обычный', 'Сложный', 'Опасный', 'Смертельный']
export const CQ_TYPES = ['Деятельность', 'Побочный', 'Сюжетный', 'Гибридный']
export const CQ_STATUS = ['Новое', 'Взят', 'Приостановлено', 'Завершен', 'Провален', 'Не актуален']
export const CH_STATUS = ['Завершено', 'В процессе', 'Запланировано', 'В разработке']

const cleanQuest = (b = {}, old = {}) => ({
  ...old,
  name: S(b.name ?? old.name, 160) || 'Новый квест',
  difficulty: S(b.difficulty ?? old.difficulty, 40),
  type: S(b.type ?? old.type, 40),
  region: S(b.region ?? old.region, 80),
  status: S(b.status ?? old.status, 40) || 'Новое',
  taker: S(b.taker ?? old.taker, 120),
  location: S(b.location ?? old.location, 120),
  desc: S(b.desc ?? old.desc, 4000),
  source: S(b.source ?? old.source, 120),
  hidden: b.hidden !== undefined ? !!b.hidden : !!old.hidden
})
const cleanChapter = (b = {}, old = {}) => ({
  ...old,
  volume: S(b.volume ?? old.volume, 120),
  act: S(b.act ?? old.act, 60),
  title: S(b.title ?? old.title, 200) || 'Новая глава',
  status: S(b.status ?? old.status, 40) || 'Запланировано',
  result: S(b.result ?? old.result, 4000),
  dateWorld: S(b.dateWorld ?? old.dateWorld, 80),
  dateReal: S(b.dateReal ?? old.dateReal, 80),
  hidden: b.hidden !== undefined ? !!b.hidden : !!old.hidden
})

// что видно в состоянии: мастеру — всё, остальным — без скрытых
export function campaignFor(db, master) {
  const c = db.campaign || { volumes: [], quests: [], chapters: [] }
  if (master) return c
  return { volumes: c.volumes, quests: c.quests.filter(q => !q.hidden), chapters: c.chapters.filter(x => !x.hidden) }
}

export function registerCampaignRoutes(app, { requireMaster, getDb, saveDb, broadcast, newId }) {
  const camp = () => (getDb().campaign ||= { volumes: [], quests: [], chapters: [] })
  const changed = () => { saveDb(); broadcast() }
  const LISTS = { quests: [cleanQuest, 'cq'], chapters: [cleanChapter, 'ch'] }

  for (const [list, [clean, prefix]] of Object.entries(LISTS)) {
    // новый — в конец списка или после указанного (after: id)
    app.post(`/api/campaign/${list}`, requireMaster, (req, res) => {
      const arr = camp()[list]
      const item = { id: newId(prefix), ...clean(req.body || {}) }
      const i = arr.findIndex(x => x.id === req.body?.after)
      if (i === -1) arr.push(item)
      else arr.splice(i + 1, 0, item)
      changed()
      res.json(item)
    })
    app.patch(`/api/campaign/${list}/:id`, requireMaster, (req, res) => {
      const arr = camp()[list]
      const i = arr.findIndex(x => x.id === req.params.id)
      if (i === -1) return res.status(404).json({ error: 'Не найдено' })
      arr[i] = clean(req.body || {}, arr[i])
      changed()
      res.json(arr[i])
    })
    app.delete(`/api/campaign/${list}/:id`, requireMaster, (req, res) => {
      const c = camp()
      const before = c[list].length
      c[list] = c[list].filter(x => x.id !== req.params.id)
      if (c[list].length === before) return res.status(404).json({ error: 'Не найдено' })
      changed()
      res.json({ ok: true })
    })
    // порядок (перетаскивание)
    app.post(`/api/campaign/${list}-order`, requireMaster, (req, res) => {
      const ids = Array.isArray(req.body?.ids) ? req.body.ids : []
      const arr = camp()[list], pos = new Map(ids.map((id, i) => [id, i]))
      arr.sort((a, b) => (pos.get(a.id) ?? 1e9) - (pos.get(b.id) ?? 1e9))
      changed()
      res.json({ ok: true })
    })
  }
  app.patch('/api/campaign/volumes', requireMaster, (req, res) => {
    const v = Array.isArray(req.body?.volumes) ? req.body.volumes.slice(0, 20).map(x => S(x, 120)).filter(Boolean) : null
    if (!v) return res.status(400).json({ error: 'Нужен список томов' })
    camp().volumes = v
    changed()
    res.json({ ok: true })
  })
}
