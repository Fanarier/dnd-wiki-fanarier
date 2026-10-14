<template>
  <!-- журнал сессий: записи с датой и тегами, текст с оформлением и @-упоминаниями -->
  <div class="pj">
    <h2 class="sb-h sb-anim"><SheetIcon name="journal" class="ic" />Журнал сессий</h2>
    <div class="sb-tools sb-anim">
      <input v-model="q" class="sb-input pj-q" placeholder="Поиск по записям и тегам…" />
      <span class="grow" />
      <button v-if="!ro" type="button" class="sb-btn primary" @click="add">＋ Новая запись</button>
    </div>

    <div class="pj-wrap sb-anim">
      <nav class="pj-list" aria-label="Записи журнала">
        <div v-if="!entries.length" class="sb-empty">Записей пока нет.</div>
        <button v-for="e in sorted" :key="e.Id || keyOf(e)" type="button" class="pj-item" :class="{ on: e === cur }" :data-find="`JournalEntries-${entries.indexOf(e)}`" @click="selId = e.Id || keyOf(e)">
          <b>{{ e.Title || 'Без названия' }}</b>
          <small>📅 {{ fmtDate(e.Date) }}<template v-if="e.Tags"> · 🏷 {{ e.Tags }}</template></small>
        </button>
      </nav>

      <section v-if="cur" class="pj-ed" :key="cur.Id || keyOf(cur)">
        <Fld :path="`JournalEntries.${ci}.Title`" placeholder="Заголовок" big />
        <div class="pj-meta">
          <label class="pj-date">📅 <input type="datetime-local" :value="localDate(cur.Date)" :readonly="ro" @change="setDate($event.target.value)" /></label>
          <Fld :path="`JournalEntries.${ci}.Tags`" placeholder="Теги через запятую" class="pj-tags" />
        </div>
        <RichEditor v-if="!ro" :model-value="cur.Content" :min-height="260" placeholder="Что было на сессии…" @update:model-value="v => edit(`JournalEntries.${ci}.Content`, v)" />
        <RichText v-else :text="cur.Content" />
        <footer>
          <small>{{ words }} {{ plural(words) }}</small>
          <span class="grow" />
          <button v-if="!ro" type="button" class="sb-btn danger" @click="del">🗑 Удалить запись</button>
        </footer>
      </section>
      <div v-else-if="entries.length" class="sb-empty">Выбери запись слева.</div>
    </div>
  </div>
</template>

<script setup>
import SheetIcon from '../ui/SheetIcon.vue'
import { computed, inject, ref } from 'vue'
import Fld from '../ui/Fld.vue'
import RichEditor from '../../components/RichEditor.vue'
import RichText from '../../components/RichText.vue'
import { sheet, edit, keyOf, listOps } from '../sheetState.js'

const ro = inject('sheetReadOnly', ref(false))
const entries = computed(() => sheet.data.JournalEntries)
const ops = listOps('JournalEntries')
const q = ref('')
const selId = ref(null)
const time = e => Date.parse(e.Date) || 0
const sorted = computed(() => {
  const s = q.value.trim().toLowerCase()
  return entries.value.filter(e => !s || `${e.Title} ${e.Tags} ${e.Content}`.toLowerCase().includes(s)).slice().sort((a, b) => time(b) - time(a))
})
const cur = computed(() => entries.value.find(e => (e.Id || keyOf(e)) === selId.value) || sorted.value[0] || null)
const ci = computed(() => entries.value.indexOf(cur.value))
const fmtDate = s => { const t = Date.parse(s); return t ? new Date(t).toLocaleString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—' }
const localDate = s => { const t = Date.parse(s); if (!t) return ''; const d = new Date(t - new Date(t).getTimezoneOffset() * 60000); return d.toISOString().slice(0, 16) }
const setDate = v => { const t = Date.parse(v); if (t) edit(`JournalEntries.${ci.value}.Date`, new Date(t).toISOString(), { now: true }) }
const words = computed(() => (cur.value?.Content || '').replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length)
const plural = n => (n % 10 === 1 && n % 100 !== 11 ? 'слово' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'слова' : 'слов')
function add() {
  const id = crypto.randomUUID?.() || String(Date.now())
  ops.add({ Id: id, Title: `Сессия ${entries.value.length + 1}`, Content: '', Tags: '', Date: new Date().toISOString() })
  q.value = ''
  selId.value = id
}
function del() {
  if (!confirm(`Удалить запись «${cur.value.Title}»?`)) return
  ops.remove(ci.value)
  selId.value = null
}
</script>

<style scoped>
.pj-q { flex: 1 1 180px; }
.pj-wrap { display: grid; grid-template-columns: 200px minmax(0, 1fr); gap: 12px; align-items: start; }
.pj-list { display: grid; gap: 5px; max-height: 70vh; overflow-y: auto; }
.pj-item { display: grid; gap: 2px; padding: 8px 10px; border-radius: 10px; border: 1px solid var(--line); background: rgba(0, 0, 0, .16); color: var(--ink); text-align: left; cursor: pointer; transition: background .15s, border-color .15s; }
.pj-item b { font: 700 14px 'Manrope', sans-serif; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pj-item small { color: var(--muted); font: 600 11px 'Manrope', sans-serif; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pj-item.on { border-color: var(--acc); background: color-mix(in srgb, var(--acc) 12%, rgba(0, 0, 0, .16)); }
.pj-ed { display: grid; gap: 8px; min-width: 0; animation: pj-in .25s ease-out; }
.pj-meta { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.pj-date { display: flex; align-items: center; gap: 4px; color: var(--muted); }
.pj-date input { padding: 4px 6px; border-radius: 8px; border: 1px solid var(--line); background: rgba(0, 0, 0, .25); color: var(--ink); font: 600 12.5px 'Manrope', sans-serif; color-scheme: dark; }
.pj-tags { flex: 1 1 160px; }
.pj-ed footer { display: flex; align-items: center; gap: 8px; color: var(--muted); }
.grow { flex: 1; }
@keyframes pj-in { from { opacity: 0; transform: translateY(6px); } }
@media (max-width: 700px) { .pj-wrap { grid-template-columns: minmax(0, 1fr); } .pj-list { max-height: 220px; } }
</style>
