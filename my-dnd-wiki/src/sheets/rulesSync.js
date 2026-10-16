// Навыки из вики в листе: по расе, классу, архетипу и уровню положенные навыки добавляются сами,
// пустые описания уже вписанных навыков дописываются текстом вики. Что добавлялось — помним (WikiAdded),
// поэтому удалённый вручную навык не вернётся. Выбор расового навыка — карточкой в разделах навыков.
import { sheet, edit } from './sheetState.js'
import { rulesState } from '../map/store.js'
import { expectedSkills, findRace, normName } from '../shared/rules.js'

// заготовка описания из переноса Excel или пустое — можно дописать
const thin = s => { const t = String(s || '').trim(); return t.length < 60 || /^(Расовый навык \d+ уровня|Досягаемость:|Заклинание\.)/.test(t) }

export function syncWikiSkills() {
  const d = sheet.data
  if (!d || !rulesState.loaded) return { added: 0, filled: 0 }
  const skills = d.Skills.map(x => ({ ...x }))
  const passive = d.PassiveSkills.map(x => ({ ...x }))
  const have = new Map([...skills, ...passive].map(s => [normName(s.SkillName), s]))

  // выбор расового навыка, который уже вписан в лист (из приложения, из Excel), — засчитываем
  const race = findRace(rulesState.races, d)
  const choices = { ...(d.RaceChoices || {}) }
  let chosenNow = false
  if (race) {
    for (const l of race.levels) {
      if (!l.options.length || choices[l.lv]) continue
      const o = l.options.find(x => have.has(normName(x.name)))
      if (o) { choices[l.lv] = o.name; chosenNow = true }
    }
  }
  if (chosenNow) edit('RaceChoices', choices, { now: true })

  const added = { ...(d.WikiAdded || {}) }
  let n = 0, filled = 0
  for (const e of expectedSkills(rulesState, { ...d, RaceChoices: choices })) {
    const cur = have.get(normName(e.name))
    if (cur) {
      if (!added[e.key] && e.text && thin(cur.Description)) {
        // голая заготовка «Расовый навык 4 уровня (основной).» — заменяем, остальное (дальность, затраты) оставляем ниже
        const old = String(cur.Description || '').trim().replace(/^Расовый навык \d+ уровня \([^)]*\)\.?$/, '')
        cur.Description = e.text + (old ? '\n\n' + old : '')
        filled++
      }
      added[e.key] = true
      continue
    }
    if (added[e.key]) continue // удалили руками — не возвращаем
    const list = e.active ? skills : passive
    if (list.length >= 150) continue
    const item = { SkillName: e.name, CategoryIndex: e.cat, Description: e.text, IsActiveSymbol: false }
    list.push(item)
    have.set(normName(e.name), item)
    added[e.key] = true
    n++
  }
  if (n || filled) {
    edit('Skills', skills, { now: true })
    edit('PassiveSkills', passive, { now: true })
  }
  if (JSON.stringify(added) !== JSON.stringify(d.WikiAdded || {})) edit('WikiAdded', added, { now: true })
  return { added: n, filled }
}
