<template>
  <!-- активные / пассивные навыки: название, категория (классовый / расовый / магия / уникальный), отметка ●, описание с кубами-кнопками.
       Навык из вики привязан к ней (src/shared/skillLink.js): текст обновляется сам, своё — в заметку; изменить сам навык — отвязать -->
  <div class="pk">
    <h2 class="sb-h sb-anim"><SheetIcon :name="list === 'Skills' ? 'active' : 'passive'" class="ic" />{{ title }} <small class="pk-n">{{ items.length }}</small></h2>
    <RulesBar class="sb-anim" />
    <div class="sb-tools sb-anim">
      <input v-model="q" class="sb-input pk-q" placeholder="Поиск по названию и описанию…" />
      <button v-for="c in CATS" :key="c.v" type="button" class="sb-chip" :class="{ on: cat === c.v }" @click="cat = c.v">{{ c.t }}</button>
      <button type="button" class="sb-chip" :class="{ on: onlyMarked }" title="Только отмеченные ●" @click="onlyMarked = !onlyMarked">●</button>
      <span class="grow" />
      <button v-if="!ro" type="button" class="sb-btn primary" @click="addOne">＋ Навык</button>
    </div>

    <div v-if="!items.length" class="sb-empty sb-anim">Навыков пока нет — добавь первый.</div>
    <div v-else-if="!shown.length" class="sb-empty">Ничего не нашлось.</div>
    <VueDraggable v-model="model" handle=".sb-handle" :animation="200" :disabled="filtered || ro" ghost-class="pk-ghost" class="pk-list">
      <article v-for="it in model" v-show="visible(it)" :key="keyOf(it)" class="pk-card sb-anim" :class="{ marked: it.IsActiveSymbol, open: editing.has(keyOf(it)), linked: !!wikiOf(it) }" :data-find="`${list}-${model.indexOf(it)}`">
        <header>
          <span v-if="!filtered && !ro" class="sb-handle" title="Перетащить">⠿</span>
          <button type="button" class="sb-dot" :class="{ on: it.IsActiveSymbol }" title="Отметка ● (например, «готов к использованию»)" @click="set(it, 'IsActiveSymbol', !it.IsActiveSymbol)" />
          <b v-if="wikiOf(it)" class="pk-nm">{{ it.SkillName }}</b>
          <Fld v-else :path="`${list}.${model.indexOf(it)}.SkillName`" placeholder="Название навыка" class="pk-name" />
          <span class="pk-cat" :class="catOf(it).cls" :title="wikiOf(it) ? `${catOf(it).name} — из вики` : catOf(it).name">{{ catOf(it).ch }}</span>
          <router-link v-if="wikiOf(it)" class="pk-wiki" :to="wikiOf(it).to" :title="`Привязан к вики: ${wikiOf(it).src}. Текст обновляется сам, своё — в заметку 📝`">📖 <span>{{ wikiOf(it).src }}</span></router-link>
          <span v-if="isFresh(it, now)" class="pk-fresh" :title="`Текст обновился из вики ${new Date(it.WikiAt).toLocaleString('ru')}`">↻ обновлено</span>
          <button v-if="!wikiOf(it)" type="button" class="pk-ask" :class="{ on: askAt === keyOf(it) }" :title="askTitle(it)" @click="openAsk(it)">❓</button>
          <button v-if="!ro" type="button" class="sb-x" :class="{ on: notes.has(keyOf(it)) }" title="Заметка — своё к навыку (вики её не трогает)" @click="flip(notes, keyOf(it))">📝</button>
          <button v-if="!ro" type="button" class="sb-x" :title="editing.has(keyOf(it)) ? 'Готово' : wikiOf(it) ? 'Править: оформление — можно, изменишь текст — навык отвяжется от вики' : 'Править описание'" @click="toggle(it)">{{ editing.has(keyOf(it)) ? '✓' : '✎' }}</button>
          <button v-if="!ro" type="button" class="sb-x" title="Удалить навык" @click="del(it)">✕</button>
        </header>

        <!-- уникальный: почему, и привязать к вики (по точному названию нашлось — сразу кнопка) -->
        <div v-if="askAt === keyOf(it)" class="pk-askbox">
          <p>{{ askText(it) }}</p>
          <div v-if="!ro" class="pk-bind">
            <input v-model="bq" class="sb-input" placeholder="Найти в вики: навык расы, класса или заклинание…" />
            <div class="pk-hits">
              <button v-for="e in hits" :key="e.ref" type="button" @click="bind(it, e)"><b>{{ e.name }}</b><small>{{ CAT_INFO[e.cat].name }} · {{ e.src }}</small></button>
              <span v-if="!hits.length" class="pk-none">Ничего — попробуй другое слово.</span>
            </div>
          </div>
        </div>
        <div v-else-if="!ro && !wikiOf(it) && !it.WikiOff && sameName(it)" class="pk-hint">
          В вики есть «{{ sameName(it).name }}» ({{ sameName(it).src }}) — <button type="button" @click="bind(it, sameName(it))">привязать</button>
        </div>

        <p v-if="editing.has(keyOf(it)) && wikiOf(it)" class="pk-hint">Цвет и выделение — можно, привязка к вики останется. Изменишь сам текст — по «✓» спрошу: отвязать навык или вернуть текст вики.</p>
        <Fld v-if="editing.has(keyOf(it))" :path="`${list}.${model.indexOf(it)}.Description`" type="rich" :rows="4" placeholder="Описание: что делает, стоимость, перезарядка… Кубы вроде 2к6+3 станут кнопками броска" />
        <p v-else-if="it.Description" class="pk-desc" :class="{ clamp: !expanded.has(keyOf(it)) && it.Description.length > 320 }" @dblclick="!ro && toggle(it)">
          <DiceText :text="it.Description" :label="it.SkillName" />
        </p>
        <button v-if="!editing.has(keyOf(it)) && it.Description?.length > 320" type="button" class="pk-more" @click="flip(expanded, keyOf(it))">{{ expanded.has(keyOf(it)) ? 'свернуть' : 'читать полностью' }}</button>
        <Fld v-if="notes.has(keyOf(it))" :path="`${list}.${model.indexOf(it)}.Note`" type="area" :rows="2" placeholder="Заметка: дальность, затраты, что выбрал… Вики её не трогает" class="pk-notefld" />
        <p v-else-if="it.Note" class="pk-note"><span>📝</span><DiceText :text="it.Note" :label="it.SkillName" /></p>
      </article>
    </VueDraggable>
  </div>
</template>

<script setup>
import SheetIcon from '../ui/SheetIcon.vue'
import RulesBar from '../ui/RulesBar.vue'
import { computed, inject, onBeforeUnmount, reactive, ref } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import Fld from '../ui/Fld.vue'
import DiceText from '../ui/DiceText.vue'
import { sheet, edit, keyOf, listOps } from '../sheetState.js'
import { rulesState } from '../../map/store.js'
import { normName } from '../../shared/rules.js'
import { wikiIndex, bindTo, unbind, searchWiki, isFresh, sameText, CAT_UNIQUE } from '../../shared/skillLink.js'

const props = defineProps({ list: { type: String, default: 'Skills' } })
const ro = inject('sheetReadOnly', ref(false))
const title = computed(() => (props.list === 'Skills' ? 'Активные навыки' : 'Пассивные навыки'))
const CATS = [{ v: -1, t: 'Все' }, { v: 0, t: 'Классовые (К)' }, { v: 1, t: 'Расовые (Р)' }, { v: 2, t: 'Магия (М)' }, { v: 3, t: 'Уникальные (У)' }]
// категория — из вики (привязанный) или «уникальный» (в вики нет)
const CAT_INFO = [{ v: 0, ch: 'К', cls: 'k', name: 'Классовый' }, { v: 1, ch: 'Р', cls: 'r', name: 'Расовый' }, { v: 2, ch: 'М', cls: 'm', name: 'Магия' }, { v: 3, ch: 'У', cls: 'u', name: 'Уникальный' }]
const catOf = it => CAT_INFO[it.CategoryIndex] || CAT_INFO[0]
const q = ref(''), cat = ref(-1), onlyMarked = ref(false)
const items = computed(() => sheet.data[props.list] || [])
const ops = computed(() => listOps(props.list))
const model = computed({ get: () => items.value, set: v => ops.value.set(v) })
const filtered = computed(() => !!q.value.trim() || cat.value !== -1 || onlyMarked.value)
const visible = it => {
  const s = q.value.trim().toLowerCase()
  return (!s || `${it.SkillName} ${it.Description} ${it.Note || ''}`.toLowerCase().includes(s)) && (cat.value === -1 || it.CategoryIndex === cat.value) && (!onlyMarked.value || it.IsActiveSymbol)
}
const shown = computed(() => items.value.filter(visible))
const editing = reactive(new Set()), expanded = reactive(new Set()), notes = reactive(new Set())
const flip = (set, k) => (set.has(k) ? set.delete(k) : set.add(k))
const set = (it, k, v) => { if (!ro.value) edit(`${props.list}.${items.value.indexOf(it)}.${k}`, v, { now: true }) }
const put = (it, v) => { if (!ro.value) edit(`${props.list}.${items.value.indexOf(it)}`, v, { now: true }) }

/* ---------- привязка к вики ---------- */
const ix = computed(() => (rulesState.loaded ? wikiIndex(rulesState) : null))
const wikiOf = it => (it.Wiki && ix.value?.byRef.get(it.Wiki)) || null
const sameName = it => ix.value?.byName.get(normName(it.SkillName))?.[0] || null
// «обновлено» — сутки после того, как текст поменялся из вики
const now = ref(Date.now())
const tick = setInterval(() => { now.value = Date.now() }, 60000)
onBeforeUnmount(() => clearInterval(tick))
// привязанный навык: оформление (цвет, выделение) — можно, привязка остаётся; изменил сам текст — по «Готово»
// спросим: отвязать (станет уникальным) или вернуть текст вики
function toggle(it) {
  const k = keyOf(it)
  const e = wikiOf(it)
  if (editing.has(k) && e && !sameText(it.Description, e.text)) {
    if (confirm(`Текст «${it.SkillName}» изменён — он больше не совпадает с вики (${e.src}).\n\nОК — отвязать от вики: навык станет уникальным и перестанет обновляться сам.\nОтмена — вернуть текст из вики (своё можно дописать в заметку 📝).`)) put(it, unbind(it))
    else set(it, 'Description', e.text)
  }
  flip(editing, k)
}
const askAt = ref(null)
const bq = ref('')
const hits = computed(() => (ix.value ? searchWiki(rulesState, bq.value, 24) : []))
function openAsk(it) {
  const k = keyOf(it)
  askAt.value = askAt.value === k ? null : k
  bq.value = it.SkillName === 'Новый навык' ? '' : it.SkillName
}
const askTitle = it => (it.WikiOff ? 'Изменён тобой — отвязан от вики' : 'Нет в вики — уникальный навык') + '. Щёлкни, чтобы привязать'
const askText = it => (it.WikiOff
  ? 'Навык изменён в листе — он отвязан от вики и стал уникальным, текст сам не обновляется. Привязать снова — найди его в вики ниже (текст заменится текстом вики, твой — уйдёт в заметку).'
  : 'Сайт не нашёл в вики навык с таким названием — поэтому он уникальный. Если он есть в вики под другим названием — найди и привяжи: название и текст станут как в вики, твой текст уйдёт в заметку.')
function bind(it, e) {
  const i = items.value.indexOf(it)
  put(it, bindTo(it, e))
  askAt.value = null
  editing.delete(keyOf(it))
  const nx = items.value[i]
  if (nx?.Note && nx.Note !== it.Note) notes.add(keyOf(nx))
}
function addOne() {
  ops.value.add({ SkillName: 'Новый навык', CategoryIndex: CAT_UNIQUE, Description: '', IsActiveSymbol: false }, { first: true })
  q.value = ''; cat.value = -1; onlyMarked.value = false
  setTimeout(() => editing.add(keyOf(items.value[0])), 0)
}
function del(it) {
  if (confirm(`Удалить навык «${it.SkillName || 'без названия'}»?`)) ops.value.remove(items.value.indexOf(it))
}
</script>

<style scoped>
.pk-n { margin-left: 4px; font: 800 12px 'Manrope', sans-serif; color: var(--muted); }
.pk-q { flex: 1 1 180px; }
.pk-list { display: grid; gap: 8px; }
.pk-card { padding: 8px 10px; border-radius: 12px; background: rgba(0, 0, 0, .18); border: 1px solid var(--line); transition: border-color .2s, background .2s, box-shadow .2s; }
.pk-card.marked { border-color: color-mix(in srgb, var(--acc) 55%, transparent); background: color-mix(in srgb, var(--acc) 7%, rgba(0, 0, 0, .18)); }
.pk-card header { display: flex; align-items: center; gap: 6px; }
.pk-name { flex: 1; }
.pk-name :deep(input) { font: 700 16px 'Cormorant Garamond', serif; font-size: 17px; }
.pk-nm { flex: 1; min-width: 0; padding: 2px 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 700 17px 'Cormorant Garamond', serif; }
.pk-cat { display: grid; place-items: center; flex: none; width: 26px; height: 26px; border-radius: 7px; border: 1px solid; font: 800 12px 'Manrope', sans-serif; cursor: default; }
.pk-cat.k { color: #7cc4ff; border-color: rgba(124, 196, 255, .45); }
.pk-cat.r { color: #ffb36b; border-color: rgba(255, 179, 107, .45); }
.pk-cat.m { color: #c9a6ff; border-color: rgba(201, 166, 255, .5); box-shadow: 0 0 8px rgba(170, 130, 255, .25); }
.pk-cat.u { color: #e8e0c8; border-color: rgba(232, 224, 200, .35); border-style: dashed; }
.pk-wiki { display: inline-flex; flex: 0 1 auto; min-width: 0; align-items: center; gap: 3px; max-width: 150px; padding: 2px 8px; border-radius: 99px; background: color-mix(in srgb, var(--acc) 12%, transparent); color: var(--acc); font: 700 11px 'Manrope', sans-serif; text-decoration: none; }
.pk-wiki span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pk-wiki:hover { background: color-mix(in srgb, var(--acc) 22%, transparent); }
.pk-fresh { flex: none; padding: 2px 8px; border-radius: 99px; background: rgba(126, 208, 122, .16); color: #a8e6a1; font: 800 11px 'Manrope', sans-serif; animation: pk-glow 2.4s ease-in-out infinite; }
@keyframes pk-glow { 50% { box-shadow: 0 0 10px rgba(126, 208, 122, .45); } }
.pk-ask { width: 26px; height: 26px; padding: 0; border-radius: 50%; border: 1px dashed rgba(232, 224, 200, .4); background: none; cursor: pointer; font-size: 12px; }
.pk-ask.on, .pk-ask:hover { border-color: var(--acc); background: color-mix(in srgb, var(--acc) 12%, transparent); }
.sb-x.on { border-color: var(--acc); }
.pk-askbox { display: grid; gap: 6px; margin: 6px 0 2px 30px; padding: 8px 10px; border-radius: 10px; background: rgba(0, 0, 0, .25); border: 1px dashed var(--line); }
.pk-askbox p { margin: 0; color: var(--muted); font: 600 12.5px/1.5 'Manrope', sans-serif; }
.pk-bind { display: grid; gap: 6px; }
.pk-hits { display: grid; gap: 3px; max-height: 220px; overflow-y: auto; }
.pk-hits button { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px; padding: 5px 8px; border-radius: 8px; border: 1px solid transparent; background: rgba(255, 255, 255, .03); color: var(--ink); text-align: left; cursor: pointer; }
.pk-hits button:hover { border-color: var(--acc); }
.pk-hits b { font: 700 14px 'Manrope', sans-serif; }
.pk-hits small { color: var(--muted); font: 600 11.5px 'Manrope', sans-serif; }
.pk-none { color: var(--muted); font: 600 12px 'Manrope', sans-serif; }
.pk-hint { margin: 4px 0 0 30px; color: var(--muted); font: 600 12px 'Manrope', sans-serif; }
.pk-hint button { padding: 0; border: 0; background: none; color: var(--acc); font: inherit; font-weight: 800; cursor: pointer; text-decoration: underline; }
.pk-desc { margin: 6px 4px 2px 30px; color: color-mix(in srgb, var(--ink) 88%, transparent); font: 500 13.5px/1.55 'Manrope', sans-serif; white-space: pre-line; }
.pk-desc.clamp { display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
.pk-more { margin-left: 30px; padding: 0; border: 0; background: none; color: var(--acc); font: 700 12px 'Manrope', sans-serif; cursor: pointer; }
.pk-note { display: flex; gap: 6px; margin: 6px 4px 2px 30px; padding: 5px 8px; border-radius: 8px; background: color-mix(in srgb, var(--acc) 6%, transparent); border-left: 2px solid color-mix(in srgb, var(--acc) 50%, transparent); color: var(--muted); font: 600 12.5px/1.5 'Manrope', sans-serif; white-space: pre-line; }
.pk-card > .fld { margin: 6px 0 2px 30px; }
.pk-ghost { opacity: .4; }
</style>
