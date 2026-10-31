<template>
  <!-- правка карточки уникального предмета (лист и вики): типы и вид — строки; характеристики и списки — по пункту в строке.
       У пункта — отметка цветом (как заливка в таблице; «зачёркнуто» — утрачено) и примечание (раскрывается в карточке).
       Нет карточки — кнопка «сделать уникальным» -->
  <div ref="root" class="ce">
    <button v-if="!card" type="button" class="ce-make" :disabled="readonly" @click="emit('update:modelValue', blankCard())">
      ✦ Карточка уникального предмета <small>типы, характеристики, требования, эффекты</small>
    </button>
    <template v-else>
      <div class="ce-head">
        <span>✦ Карточка предмета</span>
        <button v-if="!readonly" type="button" class="ce-drop" title="Убрать карточку (останутся название, редкость и описание)" @click="drop">убрать</button>
      </div>
      <div class="ce-grid">
        <label v-for="f in CARD_TEXT" :key="f.k" class="ce-f">
          <span>{{ f.name }}</span>
          <input :value="card[f.k]" :placeholder="f.hint || ''" :readonly="readonly" maxlength="80" @input="set(f.k, $event.target.value)" />
        </label>
        <label class="ce-f wide">
          <span>Примечание <i>история, имя, что угодно — показывается под названием</i></span>
          <textarea :value="card.Note || ''" :readonly="readonly" maxlength="3000" rows="2" @input="set('Note', $event.target.value)" />
        </label>
      </div>

      <section class="ce-sec" data-k="Chars">
        <h5>Характеристики <i>значение пустое — свойство («Одноручное»). «Карманы: 4», «Ячейки: 10» — для пояса, рюкзака, вьюка</i></h5>
        <div v-for="(c, i) in card.Chars || []" :key="i" class="ce-row-wrap">
          <div class="ce-row chars">
            <input :value="c.K" placeholder="Название" maxlength="80" :readonly="readonly" @input="setRow('Chars', i, 'K', $event.target.value)" @keydown.enter.prevent="addRow('Chars', i + 1)" />
            <input :value="c.V" placeholder="Значение" maxlength="200" :readonly="readonly" @input="setRow('Chars', i, 'V', $event.target.value)" @keydown.enter.prevent="addRow('Chars', i + 1)" />
            <RowTools v-if="!readonly" :mark="c.M" :has-note="!!c.N" :note-open="!!noteOpen['Chars' + i]" :picking="pick === 'Chars' + i"
                      @pick="pick = pick === 'Chars' + i ? '' : 'Chars' + i" @mark="m => { setRow('Chars', i, 'M', m); pick = '' }"
                      @note="noteOpen['Chars' + i] = !noteOpen['Chars' + i]" @del="delRow('Chars', i)" />
          </div>
          <textarea v-if="c.N || noteOpen['Chars' + i]" class="ce-note" :value="c.N" placeholder="Примечание: раскрывается щелчком по характеристике" maxlength="3000" rows="2" :readonly="readonly"
                    @input="setRow('Chars', i, 'N', $event.target.value)" />
        </div>
        <button v-if="!readonly" type="button" class="ce-add" @click="addRow('Chars')">＋ характеристика</button>
      </section>

      <div class="ce-lists">
        <section v-for="l in CARD_LISTS" :key="l.k" class="ce-sec" :data-k="l.k">
          <h5>{{ l.icon }} {{ l.name }}</h5>
          <div v-for="(e, i) in rows(l.k)" :key="i" class="ce-row-wrap">
            <div class="ce-row" :class="e.M && 'm-' + e.M">
              <textarea :value="e.T" rows="1" :maxlength="l.k === 'Passive' || l.k === 'Active' ? 300 : 120" :readonly="readonly"
                        @input="setRow(l.k, i, 'T', $event.target.value)" @keydown.enter.exact.prevent="addRow(l.k, i + 1)" />
              <RowTools v-if="!readonly" :mark="e.M" :has-note="!!e.N" :note-open="!!noteOpen[l.k + i]" :picking="pick === l.k + i"
                        @pick="pick = pick === l.k + i ? '' : l.k + i" @mark="m => { setRow(l.k, i, 'M', m); pick = '' }"
                        @note="noteOpen[l.k + i] = !noteOpen[l.k + i]" @del="delRow(l.k, i)" />
            </div>
            <textarea v-if="e.N || noteOpen[l.k + i]" class="ce-note" :value="e.N" placeholder="Примечание: подробности эффекта, откуда, сколько зарядов…" maxlength="3000" rows="2" :readonly="readonly"
                      @input="setRow(l.k, i, 'N', $event.target.value)" />
          </div>
          <button v-if="!readonly" type="button" class="ce-add" @click="addRow(l.k)">＋ пункт</button>
        </section>
      </div>
    </template>
  </div>
</template>

<script setup>
import { reactive, ref, computed, nextTick } from 'vue'
import { CARD_TEXT, CARD_LISTS, blankCard, liOf } from '../../shared/items.js'
import RowTools from './CardRowTools.vue'

const props = defineProps({ modelValue: { type: Object, default: null }, readonly: Boolean })
const emit = defineEmits(['update:modelValue'])
const card = computed(() => props.modelValue)
const noteOpen = reactive({})
const pick = ref('')
const root = ref(null)

const set = (k, v) => emit('update:modelValue', { ...blankCard(), ...card.value, [k]: v })
const rows = k => (card.value?.[k] || []).map(liOf)
const blankRow = k => (k === 'Chars' ? { K: '', V: '', N: '', M: '' } : { T: '', N: '', M: '' })
const listOf = k => (k === 'Chars' ? (card.value?.Chars || []).map(c => ({ N: '', M: '', ...c })) : rows(k))
function setRow(k, i, f, v) {
  const list = listOf(k)
  list[i] = { ...list[i], [f]: v }
  set(k, list)
}
async function addRow(k, at) {
  const list = listOf(k)
  const n = at ?? list.length
  list.splice(n, 0, blankRow(k))
  set(k, list)
  // курсор — в новую строку
  await nextTick()
  root.value?.querySelector(`[data-k="${k}"]`)?.querySelectorAll('.ce-row-wrap')[n]?.querySelector('input, textarea')?.focus()
}
function delRow(k, i) {
  const list = listOf(k)
  const r = list[i]
  if ((r.N || (r.T || r.K || '').length > 30) && !confirm('Удалить пункт вместе с примечанием?')) return
  list.splice(i, 1)
  set(k, list)
  // раскрытые примечания ниже съезжают на строку вверх
  for (let j = i; j <= list.length; j++) noteOpen[k + j] = noteOpen[k + (j + 1)]
}
function drop() {
  if (confirm('Убрать карточку предмета? Типы, характеристики и эффекты пропадут (из истории можно вернуть).')) emit('update:modelValue', null)
}
</script>

<style scoped>
.ce { display: grid; gap: 10px; min-width: 0; }
.ce-make { display: grid; gap: 2px; justify-items: start; padding: 10px 12px; border-radius: 12px; border: 1px dashed color-mix(in srgb, var(--acc, #c9a24f) 55%, transparent); background: color-mix(in srgb, var(--acc, #c9a24f) 8%, transparent); color: color-mix(in srgb, var(--acc, #c9a24f) 70%, #fff3d6); font: 800 13px 'Manrope', sans-serif; cursor: pointer; text-align: left; }
.ce-make small { font: 600 11.5px 'Manrope', sans-serif; color: #a8936c; }
.ce-make:hover:not(:disabled) { background: color-mix(in srgb, var(--acc, #c9a24f) 16%, transparent); }
.ce-head { display: flex; align-items: center; gap: 8px; font: 800 12px 'Manrope', sans-serif; letter-spacing: .06em; text-transform: uppercase; color: color-mix(in srgb, var(--acc, #c9a24f) 70%, #fff3d6); }
.ce-drop { margin-left: auto; padding: 2px 8px; border-radius: 8px; border: 1px solid rgba(224, 96, 80, .4); background: none; color: #e9907e; font: 700 11px 'Manrope', sans-serif; cursor: pointer; }
.ce-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.ce-f { display: grid; gap: 3px; min-width: 0; }
.ce-f.wide { grid-column: 1 / -1; }
.ce-f > span, .ce-sec h5 { margin: 0; font: 700 10.5px 'Manrope', sans-serif; letter-spacing: .06em; text-transform: uppercase; color: #a8936c; }
.ce-f i, .ce-sec h5 i { font-style: normal; text-transform: none; letter-spacing: 0; font-weight: 600; opacity: .75; }
.ce input, .ce textarea { width: 100%; box-sizing: border-box; padding: 7px 10px; border-radius: 9px; border: 1px solid rgba(201, 162, 79, .25); background: rgba(0, 0, 0, .3); color: #efe3c8; font: 600 13.5px/1.45 'Manrope', sans-serif; resize: vertical; min-width: 0; }
.ce textarea { field-sizing: content; min-height: 36px; max-height: 320px; }
.ce input:focus, .ce textarea:focus { outline: none; border-color: color-mix(in srgb, var(--acc, #c9a24f) 70%, transparent); }
.ce-sec { display: grid; gap: 5px; align-content: start; padding: 9px 10px; border-radius: 12px; background: rgba(0, 0, 0, .18); border: 1px solid rgba(201, 162, 79, .12); min-width: 0; }
.ce-lists { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.ce-row-wrap { display: grid; gap: 4px; min-width: 0; }
.ce-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 5px; align-items: start; min-width: 0; border-radius: 10px; }
.ce-row.chars { grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr) auto; }
.ce-row[class*='m-'] textarea { box-shadow: inset 3px 0 0 var(--mc); background: color-mix(in srgb, var(--mc) 14%, rgba(0, 0, 0, .3)); }
.ce-row.m-gone textarea { text-decoration: line-through; text-decoration-color: var(--mc); }
.m-green { --mc: #5cc77a; } .m-yellow { --mc: #f0c040; } .m-red { --mc: #e8574a; } .m-blue { --mc: #5b9cf0; } .m-gone { --mc: #cc3a2e; }
.ce .ce-note { margin-left: 14px; width: calc(100% - 14px); font: 500 12.5px/1.45 'Manrope', sans-serif; border-style: dashed; background: rgba(0, 0, 0, .22); }
.ce-add { justify-self: start; padding: 4px 10px; border-radius: 8px; border: 1px dashed rgba(201, 162, 79, .35); background: none; color: #c8b48c; font: 700 12px 'Manrope', sans-serif; cursor: pointer; }
.ce-add:hover { background: rgba(201, 162, 79, .1); color: #f3e6c8; }
@media (max-width: 640px) { .ce-grid, .ce-lists { grid-template-columns: minmax(0, 1fr); } }
</style>
