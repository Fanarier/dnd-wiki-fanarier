<template>
  <!-- журнал правок вики (мастер): кто что поменял; любую правку можно открыть («было → стало») и откатить -->
  <div class="rh-log">
    <header class="rl-head">
      <h1>{{ content.title || 'Журнал правок вики' }}</h1>
      <p>Правки мастера и редакторов в расах, классах, статьях, магии и эффектах — последние 400. Откат возвращает запись как было.</p>
    </header>
    <div class="rl-tools">
      <select v-model="list" class="rl-in">
        <option value="">Все разделы</option>
        <option v-for="(n, k) in LIST_NAMES" :key="k" :value="k">{{ n }}</option>
      </select>
      <select v-model="who" class="rl-in">
        <option value="">Все</option>
        <option v-for="p in people" :key="p.id" :value="p.id">{{ p.name }}</option>
      </select>
      <span class="grow" />
      <button type="button" class="rl-btn" :disabled="loading" @click="load">↻ Обновить</button>
    </div>
    <div v-if="loading && !rows.length" class="rl-empty">Листаю журнал…</div>
    <div v-else-if="!shown.length" class="rl-empty">Правок пока нет.</div>
    <div class="rl-list">
      <article v-for="r in shown" :key="r.hid" class="rl-row" :class="[r.action, { rev: r.reverted, open: openId === r.hid }]">
        <button type="button" class="rl-main" @click="toggle(r)">
          <span class="rl-act">{{ ACTIONS[r.action] }}</span>
          <span class="rl-what"><b>{{ r.title || '—' }}</b><small>{{ LIST_NAMES[r.list] }}<template v-if="r.note"> · {{ r.note }}</template></small></span>
          <span class="rl-who">{{ r.by }}<small v-if="r.role === 'master'"> · мастер</small></span>
          <time :title="new Date(r.at).toLocaleString('ru')">{{ ago(r.at) }}</time>
        </button>
        <div v-if="openId === r.hid" class="rl-detail">
          <div v-if="!detail" class="rl-empty">Загружаю…</div>
          <template v-else>
            <div class="rl-diff">
              <div v-for="f in diff" :key="f.k" class="rl-f">
                <b>{{ f.label }}</b>
                <div class="rl-cols">
                  <div class="was"><small>было</small><p>{{ f.was || '—' }}</p></div>
                  <div class="now"><small>стало</small><p>{{ f.now || '—' }}</p></div>
                </div>
              </div>
              <p v-if="!diff.length" class="rl-empty">Видимых отличий нет (порядок, служебные поля).</p>
            </div>
            <div class="rl-acts">
              <span v-if="r.reverted" class="rl-done">откачено {{ ago(r.reverted) }}</span>
              <span class="grow" />
              <button v-if="!r.reverted" type="button" class="rl-btn danger" :disabled="busy" @click="revert(r)">↶ Откатить</button>
            </div>
          </template>
        </div>
      </article>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { store, api, toast, loadRules } from '../../map/store.js'
import { htmlToText } from '../../shared/rules.js'

defineProps({ content: { type: Object, default: () => ({}) } })
const LIST_NAMES = { articles: 'Статьи', races: 'Расы', classes: 'Классы', schools: 'Школы магии', spells: 'Заклинания', effects: 'Эффекты', items: 'Предметы' }
const ACTIONS = { create: 'создано', update: 'изменено', delete: 'удалено' }
const rows = ref([])
const loading = ref(false)
const busy = ref(false)
const list = ref('')
const who = ref('')
async function load() {
  loading.value = true
  try { rows.value = await api('GET', '/api/rules/history') } catch (e) { toast(e.message, 'error') } finally { loading.value = false }
}
onMounted(load)
watch(() => store.data.rulesRev, load)
const people = computed(() => [...new Map(rows.value.map(r => [r.byId, { id: r.byId, name: r.by }])).values()])
const shown = computed(() => rows.value.filter(r => (!list.value || r.list === list.value) && (!who.value || r.byId === who.value)))

const openId = ref(null)
const detail = ref(null)
async function toggle(r) {
  if (openId.value === r.hid) { openId.value = null; return }
  openId.value = r.hid
  detail.value = null
  try { detail.value = await api('GET', `/api/rules/history/${r.hid}`) } catch (e) { toast(e.message, 'error') }
}

// «было → стало» по полям, понятным человеку: текст без разметки; навыки и уровни — списком названий
const LABELS = { title: 'Название', name: 'Название', html: 'Текст', intro: 'Вступление', outro: 'Текст после', about: 'Описание', hidden: 'Скрыто',
  circle: 'Круг', cost: 'Расход', cd: 'Перезарядка', school: 'Школа', kind: 'Вид', tag: 'Чей', icon: 'Иконка', group: 'Раздел', page: 'Страница',
  base: 'Базовые навыки', levels: 'Уровни', skills: 'Навыки', archetypes: 'Архетипы' }
const show = v => {
  if (v == null) return ''
  if (typeof v === 'boolean') return v ? 'да' : 'нет'
  if (typeof v === 'string') return /<[a-z]/i.test(v) ? htmlToText(v) : v
  if (Array.isArray(v)) return v.map(x => (x && typeof x === 'object' ? [x.lv != null ? x.lv + ' ур.' : '', x.name || x.auto?.name || '', ...(x.options || []).map(o => o.name)].filter(Boolean).join(' ') : String(x))).join('\n')
  return JSON.stringify(v)
}
const diff = computed(() => {
  const b = detail.value?.before || {}, a = detail.value?.after || {}
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])].filter(k => LABELS[k])
  return keys.map(k => ({ k, label: LABELS[k], was: show(b[k]), now: show(a[k]), same: JSON.stringify(b[k]) === JSON.stringify(a[k]) }))
    .filter(f => !f.same)
})

async function revert(r) {
  if (!confirm(`Откатить «${r.title}» (${ACTIONS[r.action]})?`)) return
  busy.value = true
  try {
    await api('POST', `/api/rules/history/${r.hid}/revert`)
    toast('Откачено')
    await Promise.all([load(), loadRules(true)])
    openId.value = null
  } catch (e) { toast(e.message, 'error') } finally { busy.value = false }
}
const ago = t => {
  const m = Math.round((Date.now() - t) / 60000)
  if (m < 1) return 'только что'
  if (m < 60) return m + ' мин назад'
  if (m < 1440) return Math.round(m / 60) + ' ч назад'
  return new Date(t).toLocaleDateString('ru', { day: 'numeric', month: 'short' })
}
</script>

<style scoped>
.rl-head h1 { margin: 0; font: 700 34px 'Cormorant Garamond', serif; color: #f3dc9e; }
.rl-head p { margin: 4px 0 14px; color: #a8936c; font-weight: 600; }
.rl-tools { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.rl-in { padding: 6px 9px; border-radius: 9px; border: 1px solid rgba(231, 197, 111, .25); background: rgba(0, 0, 0, .3); color: #efe3c8; font: 600 13px 'Manrope', sans-serif; color-scheme: dark; }
.grow { flex: 1; }
.rl-btn { padding: 6px 12px; border-radius: 9px; border: 1px solid rgba(231, 197, 111, .35); background: rgba(231, 197, 111, .08); color: #f3d99a; font: 700 12.5px 'Manrope', sans-serif; cursor: pointer; }
.rl-btn.danger { border-color: rgba(255, 122, 107, .45); color: #ff9b8f; background: none; }
.rl-empty { padding: 20px; text-align: center; color: #a8936c; }
.rl-list { display: grid; gap: 6px; }
.rl-row { border-radius: 12px; border: 1px solid rgba(231, 197, 111, .14); background: rgba(20, 16, 11, .7); overflow: hidden; }
.rl-row.open { border-color: rgba(231, 197, 111, .4); }
.rl-row.rev { opacity: .6; }
.rl-main { display: grid; grid-template-columns: 90px minmax(0, 1fr) auto auto; align-items: center; gap: 12px; width: 100%; padding: 9px 12px; border: 0; background: none; color: #efe3c8; text-align: left; cursor: pointer; }
.rl-main:hover { background: rgba(231, 197, 111, .05); }
.rl-act { justify-self: start; padding: 2px 8px; border-radius: 99px; background: rgba(231, 197, 111, .14); color: #f3dc9e; font: 800 10.5px 'Manrope', sans-serif; text-transform: uppercase; letter-spacing: .05em; }
.rl-row.create .rl-act { background: rgba(126, 208, 122, .16); color: #b5ecb2; }
.rl-row.delete .rl-act { background: rgba(255, 107, 94, .16); color: #ffb3aa; }
.rl-what { display: grid; min-width: 0; }
.rl-what b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 700 16px 'Cormorant Garamond', serif; color: #f3dc9e; }
.rl-what small, .rl-who small { color: #a8936c; font: 600 11.5px 'Manrope', sans-serif; }
.rl-who { font: 700 12.5px 'Manrope', sans-serif; color: #cdbf9f; }
.rl-main time { color: #a8936c; font: 600 12px 'Manrope', sans-serif; white-space: nowrap; }
.rl-detail { padding: 4px 12px 12px; border-top: 1px solid rgba(231, 197, 111, .12); }
.rl-diff { display: grid; gap: 10px; max-height: 60vh; overflow-y: auto; padding-top: 8px; }
.rl-f > b { color: #cdbf9f; font: 800 11px 'Manrope', sans-serif; letter-spacing: .06em; text-transform: uppercase; }
.rl-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 4px; }
.rl-cols > div { min-width: 0; padding: 8px 10px; border-radius: 10px; }
.rl-cols small { color: #a8936c; font: 800 10px 'Manrope', sans-serif; text-transform: uppercase; }
.rl-cols p { margin: 2px 0 0; max-height: 220px; overflow-y: auto; white-space: pre-wrap; overflow-wrap: anywhere; font: 500 12.5px/1.5 'Manrope', sans-serif; color: #e6dcc4; }
.was { background: rgba(255, 107, 94, .07); border: 1px solid rgba(255, 107, 94, .2); }
.now { background: rgba(126, 208, 122, .07); border: 1px solid rgba(126, 208, 122, .2); }
.rl-acts { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
.rl-done { color: #a8936c; font: 700 12px 'Manrope', sans-serif; }
@media (max-width: 640px) {
  .rl-main { grid-template-columns: minmax(0, 1fr) auto; }
  .rl-act { grid-column: 1 / -1; }
  .rl-cols { grid-template-columns: 1fr; }
}
</style>
