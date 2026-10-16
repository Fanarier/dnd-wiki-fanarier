<template>
  <!-- статьи правил одной группы (механики / рабочие места / деятельности): оглавление слева, статья справа -->
  <div class="ra">
    <header class="ra-head">
      <h1>{{ content.title }}</h1>
      <p>{{ content.description }}</p>
    </header>
    <div v-if="!rulesState.loaded" class="ra-load">Листаю свод правил…</div>
    <div v-else class="ra-body">
      <nav class="ra-toc">
        <input v-model="q" class="ra-q" placeholder="Найти в разделе…" />
        <button v-for="a in shown" :key="a.id" type="button" :class="{ on: cur?.id === a.id, hid: a.hidden }" @click="open(a)">
          <span>{{ a.title }}</span><small v-if="a.hidden">скрыто</small>
        </button>
        <button v-if="master" type="button" class="ra-add" @click="create">＋ Статья</button>
      </nav>
      <article v-if="cur" :key="cur.id" class="ra-art">
        <div class="ra-art-h">
          <h2>{{ cur.title }}</h2>
          <template v-if="master && !edit">
            <button type="button" class="ra-btn" @click="startEdit">✎ Править</button>
          </template>
        </div>
        <template v-if="edit">
          <input v-model="edit.title" class="ra-title" placeholder="Название" />
          <RulesEditor v-model="edit.html" :min-height="320" />
          <div class="ra-acts">
            <label class="ra-chk"><input v-model="edit.hidden" type="checkbox" /> Скрыть от игроков</label>
            <span class="grow" />
            <button type="button" class="ra-btn danger" @click="remove">Удалить</button>
            <button type="button" class="ra-btn" @click="edit = null">Отмена</button>
            <button type="button" class="ra-btn primary" :disabled="busy" @click="save">Сохранить</button>
          </div>
        </template>
        <RulesHtml v-else :html="mark(cur.html)" />
      </article>
      <div v-else class="ra-load">В этом разделе пока пусто.</div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { store, rulesState, loadRules, api, toast } from '../../map/store.js'
import RulesHtml from './RulesHtml.vue'
import RulesEditor from './RulesEditor.vue'

const props = defineProps({ content: { type: Object, default: () => ({}) } })
const route = useRoute()
const router = useRouter()
const master = computed(() => store.role === 'master')
const list = computed(() => rulesState.articles.filter(a => a.group === props.content.group).sort((a, b) => a.order - b.order))
const q = ref('')
const norm = s => String(s || '').toLowerCase().replace(/ё/g, 'е')
const shown = computed(() => {
  const s = norm(q.value.trim())
  return s ? list.value.filter(a => norm(a.title).includes(s) || norm(a.html.replace(/<[^>]+>/g, ' ')).includes(s)) : list.value
})
const cur = computed(() => list.value.find(a => a.id === route.query.a) || list.value[0] || null)
const open = a => { edit.value = null; router.replace({ query: { ...route.query, a: a.id } }) }
// найденное в разделе слово — подсвечено в статье
const mark = html => {
  const s = q.value.trim()
  if (s.length < 2) return html
  const re = new RegExp(`(>[^<]*?)(${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  return html.replace(re, '$1<mark>$2</mark>')
}

onMounted(() => loadRules())
watch(() => store.data.rulesRev, () => loadRules())

/* ---------- правка мастером ---------- */
const edit = ref(null)
const busy = ref(false)
const startEdit = () => { edit.value = { title: cur.value.title, html: cur.value.html, hidden: !!cur.value.hidden } }
async function save() {
  busy.value = true
  try {
    await api('PUT', `/api/rules/articles/${cur.value.id}`, { ...edit.value, group: props.content.group })
    edit.value = null
    await loadRules(true)
    toast('Статья сохранена')
  } catch (e) { toast(e.message, 'error') } finally { busy.value = false }
}
async function create() {
  try {
    const a = await api('POST', '/api/rules/articles', { group: props.content.group, title: 'Новая статья', html: '<p></p>' })
    await loadRules(true)
    open(a)
    startEdit()
  } catch (e) { toast(e.message, 'error') }
}
async function remove() {
  if (!confirm(`Удалить статью «${cur.value.title}»? Вернуть можно будет только из бэкапа.`)) return
  try {
    await api('DELETE', `/api/rules/articles/${cur.value.id}`)
    edit.value = null
    await loadRules(true)
    router.replace({ query: { ...route.query, a: undefined } })
  } catch (e) { toast(e.message, 'error') }
}
</script>

<style scoped>
.ra-head h1 { margin: 0; font: 700 34px 'Cormorant Garamond', serif; color: #f3dc9e; }
.ra-head p { margin: 4px 0 16px; color: #a8936c; font-weight: 600; }
.ra-load { padding: 30px; text-align: center; color: #a8936c; }
.ra-body { display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: 18px; align-items: start; }
.ra-toc { position: sticky; top: 80px; display: grid; gap: 2px; max-height: calc(100vh - 100px); overflow-y: auto; padding: 8px; border-radius: 14px; background: rgba(255, 255, 255, .025); border: 1px solid rgba(231, 197, 111, .14); }
.ra-q { margin-bottom: 6px; padding: 7px 10px; border-radius: 9px; border: 1px solid rgba(231, 197, 111, .2); background: rgba(0, 0, 0, .3); color: #efe3c8; font: 600 13px 'Manrope', sans-serif; }
.ra-q:focus { outline: none; border-color: #e7c56f; }
.ra-toc button { display: flex; justify-content: space-between; gap: 6px; padding: 7px 10px; border: 0; border-radius: 9px; background: none; color: #cdbf9f; font: 600 13.5px 'Manrope', sans-serif; text-align: left; cursor: pointer; }
.ra-toc button:hover { background: rgba(231, 197, 111, .08); color: #f3dc9e; }
.ra-toc button.on { background: rgba(231, 197, 111, .16); color: #f3dc9e; box-shadow: inset 3px 0 0 #e7c56f; }
.ra-toc button.hid { opacity: .6; }
.ra-toc small { color: #a8936c; font-size: 10.5px; }
.ra-toc .ra-add { margin-top: 6px; color: #e7c56f; border: 1px dashed rgba(231, 197, 111, .35); justify-content: center; }
.ra-art { min-width: 0; padding: 18px 22px; border-radius: 16px; background: linear-gradient(180deg, rgba(34, 27, 19, .7), rgba(20, 16, 11, .7)); border: 1px solid rgba(231, 197, 111, .18); animation: ra-in .3s ease; }
@keyframes ra-in { from { opacity: 0; transform: translateY(6px); } }
.ra-art-h { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.ra-art-h h2 { flex: 1; margin: 0; font: 700 28px 'Cormorant Garamond', serif; color: #f3dc9e; }
.ra-title { width: 100%; box-sizing: border-box; margin-bottom: 8px; padding: 8px 10px; border-radius: 9px; border: 1px solid rgba(231, 197, 111, .25); background: rgba(0, 0, 0, .3); color: #f3dc9e; font: 700 20px 'Cormorant Garamond', serif; }
.ra-acts { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 10px; }
.ra-chk { display: flex; align-items: center; gap: 6px; color: #cdbf9f; font: 600 13px 'Manrope', sans-serif; }
.grow { flex: 1; }
.ra-btn { padding: 6px 12px; border-radius: 9px; border: 1px solid rgba(231, 197, 111, .35); background: rgba(231, 197, 111, .08); color: #f3d99a; font: 700 12.5px 'Manrope', sans-serif; cursor: pointer; }
.ra-btn.primary { background: linear-gradient(180deg, #f0d083, #c9a24f); color: #1b1408; border-color: #c9a24f; }
.ra-btn.danger { border-color: rgba(255, 122, 107, .45); color: #ff9b8f; background: none; }
@media (max-width: 760px) {
  .ra-body { grid-template-columns: 1fr; }
  .ra-toc { position: static; max-height: none; display: flex; flex-wrap: wrap; gap: 4px; }
  .ra-q { flex: 1 1 100%; }
  .ra-toc button { padding: 5px 9px; border: 1px solid rgba(231, 197, 111, .15); }
  .ra-art { padding: 14px; }
}
</style>
