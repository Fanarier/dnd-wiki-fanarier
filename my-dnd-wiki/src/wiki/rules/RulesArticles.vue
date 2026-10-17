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
        <button v-if="canManage" type="button" class="ra-add" @click="add">＋ Статья</button>
      </nav>
      <article v-if="cur" :key="cur.id" class="ra-art">
        <div class="ra-art-h">
          <h2>{{ cur.title }}</h2>
          <button v-if="canEdit(cur) && edit?.id !== cur.id" type="button" class="ra-btn" @click="startEdit(cur)">✎ Править</button>
        </div>
        <ArticleEdit v-if="edit?.id === cur.id" v-model="edit" :busy="busy" :can-remove="canManage" @save="save" @cancel="edit = null" @remove="del" />
        <RulesHtml v-else :html="mark(cur.html)" />
      </article>
      <div v-else class="ra-load">В этом разделе пока пусто.</div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { store, rulesState, loadRules } from '../../map/store.js'
import RulesHtml from './RulesHtml.vue'
import ArticleEdit from './ArticleEdit.vue'
import { useArticleOps } from './articleOps.js'

const props = defineProps({ content: { type: Object, default: () => ({}) } })
const route = useRoute()
const router = useRouter()
// править могут мастер и редакторы этого раздела или статьи (src/shared/wikiPerms.js)
const { edit, busy, canEdit, canManage, list, startEdit, save, create, remove } = useArticleOps(() => props.content.group)
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

async function add() {
  const a = await create()
  if (a) router.replace({ query: { ...route.query, a: a.id } })
}
async function del() {
  if (await remove()) router.replace({ query: { ...route.query, a: undefined } })
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
.ra-btn { padding: 6px 12px; border-radius: 9px; border: 1px solid rgba(231, 197, 111, .35); background: rgba(231, 197, 111, .08); color: #f3d99a; font: 700 12.5px 'Manrope', sans-serif; cursor: pointer; }
@media (max-width: 760px) {
  .ra-body { grid-template-columns: 1fr; }
  .ra-toc { position: static; max-height: none; display: flex; flex-wrap: wrap; gap: 4px; }
  .ra-q { flex: 1 1 100%; }
  .ra-toc button { padding: 5px 9px; border: 1px solid rgba(231, 197, 111, .15); }
  .ra-art { padding: 14px; }
}
</style>
