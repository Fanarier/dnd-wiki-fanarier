// Кто может править вики правил. Мастер — всё. Редактор — игрок, которому мастер дал права:
// разделы целиком (sections) и/или отдельные страницы (pages: «races:r-1a2b», «articles:a-…», «schools:fire»).
// Права школы магии дают править и её заклинания. Скрытое редактор видит только там, где может править.
export const WIKI_SECTIONS = [
  { id: 'races', name: 'Расы' },
  { id: 'classes', name: 'Классы' },
  { id: 'mechanics', name: 'Механики' },
  { id: 'workplaces', name: 'Рабочие места' },
  { id: 'activities', name: 'Деятельности' },
  { id: 'holdings', name: 'Владения и поселения' },
  { id: 'magic', name: 'Магия' },
  { id: 'effects', name: 'Эффекты' }
]
export const RULE_LISTS = ['articles', 'races', 'classes', 'schools', 'spells', 'effects']
const SECTION_IDS = new Set(WIKI_SECTIONS.map(s => s.id))

export function sectionOf(list, item) {
  if (list === 'articles') return item?.group || ''
  if (list === 'spells' || list === 'schools') return 'magic'
  return list // races, classes, effects
}
// страница, право на которую даёт править запись (заклинание — по своей школе)
export function pageOf(list, item) {
  if (list === 'spells') return item?.school ? 'schools:' + item.school : ''
  return item?.id ? list + ':' + item.id : ''
}

export function cleanWikiPerms(w) {
  const sections = [...new Set((Array.isArray(w?.sections) ? w.sections : []).map(String).filter(s => SECTION_IDS.has(s)))]
  const pages = [...new Set((Array.isArray(w?.pages) ? w.pages : []).map(String)
    .filter(p => /^(articles|races|classes|schools|effects):[\w-]{1,40}$/.test(p)))].slice(0, 300)
  return sections.length || pages.length ? { sections, pages } : null
}

// user: { role, wiki } — на сервере из входа, на сайте { role: store.role, wiki: store.me?.wiki }
export function canEditRule(user, list, item) {
  if (user?.role === 'master') return true
  const w = user?.wiki
  if (!w) return false
  if (w.sections?.includes(sectionOf(list, item))) return true
  const page = pageOf(list, item)
  return !!page && !!w.pages?.includes(page)
}
// создавать, удалять и менять порядок — только с правом на весь раздел (заклинания — и с правом на школу)
export function canManageRule(user, list, item) {
  if (user?.role === 'master') return true
  if (user?.wiki?.sections?.includes(sectionOf(list, item))) return true
  return list === 'spells' && canEditRule(user, list, item)
}
export const isWikiEditor = user => user?.role === 'master' || !!(user?.wiki?.sections?.length || user?.wiki?.pages?.length)
