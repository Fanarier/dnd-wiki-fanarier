<template>
  <!-- классы: сетка; класс — основы, навыки по уровням, архетипы со своими навыками -->
  <div class="kc">
    <div v-if="!rulesState.loaded" class="kc-load">Листаю свод правил…</div>

    <template v-else-if="cls">
      <button type="button" class="kc-back" @click="go(null)">← Все классы</button>
      <header class="kc-hero">
        <span class="kc-sig">{{ cls.name[0] }}</span>
        <div>
          <h1>{{ cls.name }}</h1>
          <p>{{ cls.skills.filter(s => s.html).length }} навыков класса · {{ cls.archetypes.length }} архетип{{ cls.archetypes.length === 1 ? '' : cls.archetypes.length < 5 ? 'а' : 'ов' }}</p>
        </div>
        <span class="grow" />
        <button v-if="canEdit && !edit" type="button" class="kc-btn" @click="startEdit">✎ Править</button>
      </header>

      <ClassEditor v-if="edit" v-model="edit" :busy="busy" :can-remove="canManage" @save="save" @cancel="edit = null" @remove="remove" />
      <template v-else>
        <div v-if="cls.empty && !cls.skills.length" class="kc-load">Класс ещё в разработке.</div>
        <nav class="kc-tabs">
          <button type="button" :class="{ on: tab === 'base' }" @click="tab = 'base'">Основы и навыки</button>
          <button v-for="(a, i) in cls.archetypes" :key="i" type="button" :class="{ on: tab === i }" @click="tab = i">{{ a.name }}</button>
        </nav>
        <template v-if="tab === 'base'">
          <RulesHtml v-if="cls.intro" class="kc-intro" :html="cls.intro" />
          <ClassSkills :skills="cls.skills" />
          <RulesHtml v-if="cls.outro" class="kc-intro" :html="cls.outro" />
        </template>
        <template v-else-if="arch">
          <RulesHtml v-if="arch.about" class="kc-intro" :html="arch.about" />
          <ClassSkills :skills="arch.skills" />
        </template>
      </template>
    </template>

    <template v-else>
      <header class="kc-head">
        <h1>Классы</h1>
        <p>Требования, навыки по уровням и архетипы — из вики Heroes &amp; Adventures. Выбора в классе нет: навыки открываются уровнем.</p>
      </header>
      <nav class="kc-tabs">
        <button type="button" :class="{ on: !info }" @click="info = null">Все классы <small>{{ classes.length }}</small></button>
        <button v-for="a in infos" :key="a.id" type="button" :class="{ on: info === a.id, hid: a.hidden }" @click="info = a.id; art.edit.value = null">{{ a.title }}</button>
        <button v-if="art.canManage.value" type="button" class="add" @click="addInfo">＋ Вкладка</button>
      </nav>
      <article v-if="infoArt" class="kc-art">
        <ArticleEdit v-if="art.edit.value?.id === infoArt.id" v-model="art.edit.value" :busy="art.busy.value" :can-remove="art.canManage.value" @save="art.save" @cancel="art.edit.value = null" @remove="delInfo" />
        <template v-else>
          <button v-if="art.canEdit(infoArt)" type="button" class="kc-btn kc-art-edit" @click="art.startEdit(infoArt)">✎ Править</button>
          <RulesHtml :html="infoArt.html" />
        </template>
      </article>
      <div v-else class="kc-cards">
        <button v-for="(k, i) in classes" :key="k.id" type="button" class="kc-cl" :class="{ empty: k.empty && !k.skills.length, hid: k.hidden }" :style="{ '--i': i }" @click="go(k.id)">
          <span class="kc-sig">{{ k.name[0] }}</span>
          <b>{{ k.name }}</b>
          <small v-if="k.empty && !k.skills.length">в разработке</small>
          <small v-else>{{ k.archetypes.map(a => a.name).join(' · ') }}</small>
          <em v-if="k.hidden">скрыт</em>
        </button>
        <button v-if="canManage" type="button" class="kc-cl add" @click="create">＋<b>Новый класс</b></button>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { store, rulesState, loadRules, api, toast, wikiUser } from '../../map/store.js'
import { canEditRule, canManageRule } from '../../shared/wikiPerms.js'
import RulesHtml from './RulesHtml.vue'
import ArticleEdit from './ArticleEdit.vue'
import { useArticleOps } from './articleOps.js'
import ClassSkills from './ClassSkills.vue'
import ClassEditor from './ClassEditor.vue'

const route = useRoute()
const router = useRouter()
const classes = computed(() => rulesState.classes.slice().sort((a, b) => a.order - b.order))
const cls = computed(() => rulesState.classes.find(k => k.id === route.query.cls) || null)
// править класс — мастер и редакторы раздела «Классы» или этого класса; новые и удаление — с правом на раздел
const canEdit = computed(() => canEditRule(wikiUser(), 'classes', cls.value))
const canManage = computed(() => canManageRule(wikiUser(), 'classes', {}))
// справка о классах (вкладки рядом со списком) — статьи группы «classes»
const art = useArticleOps('classes')
const infos = art.list
const infoArt = computed(() => infos.value.find(a => a.id === info.value) || null)
async function addInfo() { const a = await art.create('Новая вкладка'); if (a) info.value = a.id }
async function delInfo() { if (await art.remove()) info.value = null }
const tab = ref('base')
// ссылка на архетип: ?cls=…&arch=Путь меча
watch(cls, k => { const a = route.query.arch; const i = k ? k.archetypes.findIndex(x => x.name === a) : -1; tab.value = i >= 0 ? i : 'base' }, { immediate: true })
const arch = computed(() => (typeof tab.value === 'number' ? cls.value?.archetypes[tab.value] : null))
const info = ref(null)
const go = id => { edit.value = null; router.push({ query: { ...route.query, cls: id || undefined, arch: undefined } }); scrollTo({ top: 0 }) }
onMounted(() => loadRules())
watch(() => store.data.rulesRev, () => loadRules())

const edit = ref(null)
const busy = ref(false)
const startEdit = () => { edit.value = JSON.parse(JSON.stringify(cls.value)) }
async function save() {
  busy.value = true
  try {
    await api('PUT', `/api/rules/classes/${cls.value.id}`, edit.value)
    edit.value = null
    await loadRules(true)
    toast('Класс сохранён')
  } catch (e) { toast(e.message, 'error') } finally { busy.value = false }
}
async function create() {
  try {
    const k = await api('POST', '/api/rules/classes', { name: 'Новый класс', skills: [], archetypes: [] })
    await loadRules(true)
    go(k.id)
    startEdit()
  } catch (e) { toast(e.message, 'error') }
}
async function remove() {
  if (!confirm(`Удалить класс «${cls.value.name}»?`)) return
  try { await api('DELETE', `/api/rules/classes/${cls.value.id}`); edit.value = null; await loadRules(true); go(null) } catch (e) { toast(e.message, 'error') }
}
</script>

<style scoped>
.kc-load { padding: 30px; text-align: center; color: #a8936c; }
.kc-head h1, .kc-hero h1 { margin: 0; font: 700 34px 'Cormorant Garamond', serif; color: #f3dc9e; }
.kc-head p, .kc-hero p { margin: 4px 0 14px; color: #a8936c; font-weight: 600; }
.kc-tabs { display: flex; flex-wrap: wrap; gap: 4px; margin: 4px 0 14px; }
.kc-tabs button { padding: 6px 12px; border-radius: 9px; border: 1px solid rgba(231, 197, 111, .18); background: none; color: #cdbf9f; font: 700 13px 'Manrope', sans-serif; cursor: pointer; }
.kc-tabs button.on { background: rgba(231, 197, 111, .16); color: #f3dc9e; border-color: rgba(231, 197, 111, .45); }
.kc-tabs small { opacity: .7; }
.kc-tabs button.hid { border-style: dashed; opacity: .7; }
.kc-tabs button.add { border-style: dashed; color: #e7c56f; }
.kc-art-edit { float: right; margin: 0 0 8px 10px; }
.kc-art { padding: 18px 22px; border-radius: 16px; background: rgba(20, 16, 11, .7); border: 1px solid rgba(231, 197, 111, .18); }
.kc-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; }
.kc-cl { position: relative; display: grid; justify-items: center; gap: 4px; padding: 16px 10px 14px; border-radius: 16px; border: 1px solid rgba(231, 197, 111, .2); background: radial-gradient(circle at 50% 0%, rgba(194, 123, 255, .1), transparent 70%), linear-gradient(180deg, #221b13, #15110c); color: #efe3c8; cursor: pointer; transition: transform .2s, border-color .2s, box-shadow .2s; animation: kc-up .4s ease backwards; animation-delay: calc(var(--i, 0) * 25ms); }
.kc-cl:hover { transform: translateY(-3px); border-color: #e7c56f; box-shadow: 0 12px 30px rgba(0, 0, 0, .45), 0 0 20px rgba(231, 197, 111, .15); }
.kc-cl b { font: 700 20px 'Cormorant Garamond', serif; color: #f3dc9e; }
.kc-cl small { color: #a8936c; font: 700 11px 'Manrope', sans-serif; text-align: center; line-height: 1.4; }
.kc-cl em { position: absolute; top: 8px; right: 10px; color: #ff9b8f; font: 800 10px 'Manrope', sans-serif; font-style: normal; }
.kc-cl.empty { opacity: .55; }
.kc-cl.hid { border-style: dashed; }
.kc-cl.add { border-style: dashed; color: #e7c56f; font-size: 26px; }
@keyframes kc-up { from { opacity: 0; transform: translateY(8px); } }
.kc-sig { display: grid; place-items: center; width: 52px; height: 52px; border-radius: 14px; border: 2px solid #c9a24f; background: radial-gradient(circle at 35% 30%, #3a2c18, #120d08); font: 700 24px 'Cormorant Garamond', serif; color: #f3dc9e; box-shadow: 0 0 18px rgba(231, 197, 111, .2); flex: none; }
.kc-back { margin-bottom: 10px; padding: 5px 10px; border-radius: 9px; border: 1px solid rgba(231, 197, 111, .25); background: none; color: #f3d99a; font: 700 12.5px 'Manrope', sans-serif; cursor: pointer; }
.kc-hero { display: flex; align-items: center; gap: 14px; margin-bottom: 8px; }
.grow { flex: 1; }
.kc-btn { padding: 6px 12px; border-radius: 9px; border: 1px solid rgba(231, 197, 111, .35); background: rgba(231, 197, 111, .08); color: #f3d99a; font: 700 12.5px 'Manrope', sans-serif; cursor: pointer; }
.kc-intro { margin: 10px 0 16px; padding: 14px 18px; border-radius: 14px; background: rgba(255, 255, 255, .025); border: 1px solid rgba(231, 197, 111, .12); }
@media (max-width: 600px) { .kc-head h1, .kc-hero h1 { font-size: 28px; } }
</style>
