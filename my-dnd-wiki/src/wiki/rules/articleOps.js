// Правка статей правил одной группы (механики, справка рас и классов, магия): права, сохранение, создание, удаление
import { computed, ref } from 'vue'
import { rulesState, loadRules, api, toast, wikiUser } from '../../map/store.js'
import { canEditRule, canManageRule } from '../../shared/wikiPerms.js'

export function useArticleOps(group) {
  const g = () => (typeof group === 'function' ? group() : group)
  const edit = ref(null) // { id, title, html, hidden }
  const busy = ref(false)
  const canEdit = a => !!a && canEditRule(wikiUser(), 'articles', a)
  const canManage = computed(() => canManageRule(wikiUser(), 'articles', { group: g() }))
  const list = computed(() => rulesState.articles.filter(a => a.group === g()).sort((a, b) => a.order - b.order))

  const startEdit = a => { edit.value = { id: a.id, title: a.title, html: a.html, hidden: !!a.hidden } }
  async function save() {
    busy.value = true
    try {
      const { id, ...body } = edit.value
      await api('PUT', `/api/rules/articles/${id}`, { ...body, group: g() })
      edit.value = null
      await loadRules(true)
      toast('Статья сохранена')
    } catch (e) { toast(e.message, 'error') } finally { busy.value = false }
  }
  async function create(title = 'Новая статья') {
    try {
      const a = await api('POST', '/api/rules/articles', { group: g(), title, html: '<p></p>' })
      await loadRules(true)
      startEdit(a)
      return a
    } catch (e) { toast(e.message, 'error'); return null }
  }
  async function remove() {
    const a = edit.value
    if (!a || !confirm(`Удалить «${a.title}»? Мастер сможет вернуть её из журнала правок.`)) return false
    try {
      await api('DELETE', `/api/rules/articles/${a.id}`)
      edit.value = null
      await loadRules(true)
      return true
    } catch (e) { toast(e.message, 'error'); return false }
  }
  return { edit, busy, canEdit, canManage, list, startEdit, save, create, remove }
}
