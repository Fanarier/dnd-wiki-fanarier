<template>
  <!-- активные / пассивные навыки: название, категория (классовый / расовый), отметка ●, описание с кубами-кнопками -->
  <div class="pk">
    <h2 class="sb-h sb-anim"><SheetIcon :name="list === 'Skills' ? 'active' : 'passive'" class="ic" />{{ title }} <small class="pk-n">{{ items.length }}</small></h2>
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
      <article v-for="it in model" v-show="visible(it)" :key="keyOf(it)" class="pk-card sb-anim" :class="{ marked: it.IsActiveSymbol, open: editing.has(keyOf(it)) }" :data-find="`${list}-${model.indexOf(it)}`">
        <header>
          <span v-if="!filtered && !ro" class="sb-handle" title="Перетащить">⠿</span>
          <button type="button" class="sb-dot" :class="{ on: it.IsActiveSymbol }" title="Отметка ● (например, «готов к использованию»)" @click="set(it, 'IsActiveSymbol', !it.IsActiveSymbol)" />
          <Fld :path="`${list}.${model.indexOf(it)}.SkillName`" placeholder="Название навыка" class="pk-name" />
          <button type="button" class="pk-cat" :class="it.CategoryIndex ? 'r' : 'k'" :title="it.CategoryIndex ? 'Расовый — щёлкни, чтобы сделать классовым' : 'Классовый — щёлкни, чтобы сделать расовым'" @click="set(it, 'CategoryIndex', it.CategoryIndex ? 0 : 1)">{{ it.CategoryIndex ? 'Р' : 'К' }}</button>
          <button v-if="!ro" type="button" class="sb-x" :title="editing.has(keyOf(it)) ? 'Готово' : 'Править описание'" @click="toggle(it)">{{ editing.has(keyOf(it)) ? '✓' : '✎' }}</button>
          <button v-if="!ro" type="button" class="sb-x" title="Удалить навык" @click="del(it)">✕</button>
        </header>
        <Fld v-if="editing.has(keyOf(it))" :path="`${list}.${model.indexOf(it)}.Description`" type="area" :rows="4" placeholder="Описание: что делает, стоимость, перезарядка… Кубы вроде 2к6+3 станут кнопками броска" />
        <p v-else-if="it.Description" class="pk-desc" :class="{ clamp: !expanded.has(keyOf(it)) && it.Description.length > 320 }" @dblclick="!ro && toggle(it)">
          <DiceText :text="it.Description" :label="it.SkillName" />
        </p>
        <button v-if="!editing.has(keyOf(it)) && it.Description?.length > 320" type="button" class="pk-more" @click="flip(expanded, keyOf(it))">{{ expanded.has(keyOf(it)) ? 'свернуть' : 'читать полностью' }}</button>
      </article>
    </VueDraggable>
  </div>
</template>

<script setup>
import SheetIcon from '../ui/SheetIcon.vue'
import { computed, inject, reactive, ref } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import Fld from '../ui/Fld.vue'
import DiceText from '../ui/DiceText.vue'
import { sheet, edit, keyOf, listOps } from '../sheetState.js'

const props = defineProps({ list: { type: String, default: 'Skills' } })
const ro = inject('sheetReadOnly', ref(false))
const title = computed(() => (props.list === 'Skills' ? 'Активные навыки' : 'Пассивные навыки'))
const CATS = [{ v: -1, t: 'Все' }, { v: 0, t: 'Классовые (К)' }, { v: 1, t: 'Расовые (Р)' }]
const q = ref(''), cat = ref(-1), onlyMarked = ref(false)
const items = computed(() => sheet.data[props.list] || [])
const ops = computed(() => listOps(props.list))
const model = computed({ get: () => items.value, set: v => ops.value.set(v) })
const filtered = computed(() => !!q.value.trim() || cat.value !== -1 || onlyMarked.value)
const visible = it => {
  const s = q.value.trim().toLowerCase()
  return (!s || `${it.SkillName} ${it.Description}`.toLowerCase().includes(s)) && (cat.value === -1 || it.CategoryIndex === cat.value) && (!onlyMarked.value || it.IsActiveSymbol)
}
const shown = computed(() => items.value.filter(visible))
const editing = reactive(new Set()), expanded = reactive(new Set())
const flip = (set, k) => (set.has(k) ? set.delete(k) : set.add(k))
const toggle = it => flip(editing, keyOf(it))
const set = (it, k, v) => { if (!ro.value) edit(`${props.list}.${items.value.indexOf(it)}.${k}`, v, { now: true }) }
function addOne() {
  ops.value.add({ SkillName: 'Новый навык', CategoryIndex: 0, Description: '', IsActiveSymbol: false }, { first: true })
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
.pk-cat { flex: none; width: 26px; height: 26px; border-radius: 7px; border: 1px solid; background: none; font: 800 12px 'Manrope', sans-serif; cursor: pointer; }
.pk-cat.k { color: #7cc4ff; border-color: rgba(124, 196, 255, .45); }
.pk-cat.r { color: #ffb36b; border-color: rgba(255, 179, 107, .45); }
.pk-desc { margin: 6px 4px 2px 30px; color: color-mix(in srgb, var(--ink) 88%, transparent); font: 500 13.5px/1.55 'Manrope', sans-serif; }
.pk-desc.clamp { display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
.pk-more { margin-left: 30px; padding: 0; border: 0; background: none; color: var(--acc); font: 700 12px 'Manrope', sans-serif; cursor: pointer; }
.pk-card > .fld { margin: 6px 0 2px 30px; }
.pk-ghost { opacity: .4; }
</style>
