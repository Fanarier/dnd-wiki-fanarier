<template>
  <!-- правка карточки уникального предмета (лист и вики): типы и вид — строки; характеристики и списки — по строке на пункт.
       Нет карточки — кнопка «сделать уникальным» -->
  <div class="ce">
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
      </div>
      <label class="ce-f">
        <span>Характеристики <i>по строке: «Физический урон: 3к12», без двоеточия — свойство («Одноручное»). «Карманы: 4», «Ячейки: 10» — для пояса, рюкзака, вьюка</i></span>
        <textarea v-model="draft.Chars" :readonly="readonly" rows="4" @focus="focus = 'Chars'" @blur="focus = ''" @input="emitList('Chars')" />
      </label>
      <div class="ce-lists">
        <label v-for="l in CARD_LISTS" :key="l.k" class="ce-f">
          <span>{{ l.icon }} {{ l.name }} <i>по строке</i></span>
          <textarea v-model="draft[l.k]" :readonly="readonly" rows="3" @focus="focus = l.k" @blur="focus = ''" @input="emitList(l.k)" />
        </label>
      </div>
    </template>
  </div>
</template>

<script setup>
import { reactive, ref, watch, computed } from 'vue'
import { CARD_TEXT, CARD_LISTS, blankCard, charsToText, textToChars, listToText, textToList } from '../../shared/items.js'

const props = defineProps({ modelValue: { type: Object, default: null }, readonly: Boolean })
const emit = defineEmits(['update:modelValue'])
const card = computed(() => props.modelValue)
// черновики текстов: пока поле в фокусе, не перерисовываем его из данных (иначе курсор прыгает при пустых строках)
const draft = reactive({ Chars: '', Comps: '', Reqs: '', Passive: '', Active: '' })
const focus = ref('')
watch(card, c => {
  if (!c) return
  if (focus.value !== 'Chars') draft.Chars = charsToText(c.Chars)
  for (const l of CARD_LISTS) if (focus.value !== l.k) draft[l.k] = listToText(c[l.k])
}, { immediate: true, deep: true })
const set = (k, v) => emit('update:modelValue', { ...blankCard(), ...card.value, [k]: v })
const emitList = k => set(k, k === 'Chars' ? textToChars(draft.Chars) : textToList(draft[k]))
function drop() {
  if (confirm('Убрать карточку предмета? Типы, характеристики и эффекты пропадут (из истории можно вернуть).')) emit('update:modelValue', null)
}
</script>

<style scoped>
.ce { display: grid; gap: 8px; min-width: 0; }
.ce-make { display: grid; gap: 2px; justify-items: start; padding: 10px 12px; border-radius: 12px; border: 1px dashed color-mix(in srgb, var(--acc, #c9a24f) 55%, transparent); background: color-mix(in srgb, var(--acc, #c9a24f) 8%, transparent); color: color-mix(in srgb, var(--acc, #c9a24f) 70%, #fff3d6); font: 800 13px 'Manrope', sans-serif; cursor: pointer; text-align: left; }
.ce-make small { font: 600 11.5px 'Manrope', sans-serif; color: #a8936c; }
.ce-make:hover:not(:disabled) { background: color-mix(in srgb, var(--acc, #c9a24f) 16%, transparent); }
.ce-head { display: flex; align-items: center; gap: 8px; font: 800 12px 'Manrope', sans-serif; letter-spacing: .06em; text-transform: uppercase; color: color-mix(in srgb, var(--acc, #c9a24f) 70%, #fff3d6); }
.ce-drop { margin-left: auto; padding: 2px 8px; border-radius: 8px; border: 1px solid rgba(224, 96, 80, .4); background: none; color: #e9907e; font: 700 11px 'Manrope', sans-serif; cursor: pointer; }
.ce-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.ce-lists { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.ce-f { display: grid; gap: 3px; min-width: 0; }
.ce-f > span { font: 700 10.5px 'Manrope', sans-serif; letter-spacing: .06em; text-transform: uppercase; color: #a8936c; }
.ce-f i { font-style: normal; text-transform: none; letter-spacing: 0; font-weight: 600; opacity: .75; }
.ce-f input, .ce-f textarea { width: 100%; box-sizing: border-box; padding: 6px 9px; border-radius: 9px; border: 1px solid rgba(201, 162, 79, .25); background: rgba(0, 0, 0, .3); color: #efe3c8; font: 600 13px/1.45 'Manrope', sans-serif; resize: vertical; }
.ce-f input:focus, .ce-f textarea:focus { outline: none; border-color: color-mix(in srgb, var(--acc, #c9a24f) 70%, transparent); }
@media (max-width: 560px) { .ce-grid, .ce-lists { grid-template-columns: minmax(0, 1fr); } }
</style>
