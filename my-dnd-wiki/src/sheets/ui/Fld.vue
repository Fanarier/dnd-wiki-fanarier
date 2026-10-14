<template>
  <!-- поле листа: пишет прямо в лист по пути; правый щелчок — покрасить текст (как в приложении) -->
  <label class="fld" :class="[`t-${type}`, { big, center, hasLabel: !!label }]" @contextmenu.prevent="openColor">
    <span v-if="label" class="fld-l">{{ label }}</span>
    <textarea v-if="type === 'area'" ref="el" :value="shown" :placeholder="placeholder" :rows="rows" :style="colorStyle" :readonly="ro" spellcheck="true" @input="onInput" @blur="onBlur" />
    <input v-else ref="el" :value="shown" :placeholder="placeholder" :style="colorStyle" :readonly="ro" :inputmode="type === 'num' ? 'numeric' : 'text'" :maxlength="max" spellcheck="false" @input="onInput" @blur="onBlur" @keydown.enter="type !== 'area' && $event.target.blur()" />
    <span v-if="suffix" class="fld-s">{{ suffix }}</span>
  </label>
</template>

<script setup>
import { computed, inject, nextTick, ref, watch } from 'vue'
import { val, edit } from '../sheetState.js'
import { openColorMenu } from './colorMenu.js'

const props = defineProps({
  path: { type: String, required: true },
  type: { type: String, default: 'text' }, // text | num | area
  label: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  suffix: { type: String, default: '' },
  big: Boolean,
  center: Boolean,
  rows: { type: Number, default: 3 },
  max: { type: Number, default: 400 },
  autosize: { type: Boolean, default: true }
})
const ro = inject('sheetReadOnly', ref(false))
const el = ref(null)
const draft = ref(null) // число, пока его набирают («-», «+»)
const shown = computed(() => (draft.value !== null ? draft.value : val(props.path) ?? ''))
const colorKey = computed(() => props.path.replaceAll('.', '/'))
const color = computed(() => val('FieldColors')?.[colorKey.value] || '')
const colorStyle = computed(() => (color.value ? { color: color.value } : null))

function onInput(e) {
  if (ro.value) return
  const v = e.target.value
  if (props.type === 'num') {
    draft.value = v
    if (/^[+-]?\d+$/.test(v.trim())) edit(props.path, parseInt(v, 10))
    else if (v.trim() === '') edit(props.path, 0)
  } else edit(props.path, v)
  if (props.type === 'area') grow()
}
function onBlur() { draft.value = null }
function openColor(e) { if (!ro.value) openColorMenu(e, `FieldColors.${colorKey.value}`, color.value) }

// многострочное поле растёт по тексту
function grow() {
  const t = el.value
  if (!t || !props.autosize || props.type !== 'area') return
  t.style.height = 'auto'
  t.style.height = Math.min(t.scrollHeight + 2, 900) + 'px'
}
watch(shown, () => nextTick(grow), { immediate: true })
</script>

<style scoped>
.fld { display: grid; gap: 2px; min-width: 0; position: relative; }
.fld-l { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 700 10.5px 'Manrope', sans-serif; letter-spacing: .08em; text-transform: uppercase; color: var(--muted, #a8936c); }
input, textarea {
  width: 100%; min-width: 0; box-sizing: border-box; padding: 4px 6px; border: 0; border-bottom: 1px dashed color-mix(in srgb, var(--acc, #e7c56f) 30%, transparent);
  border-radius: 6px 6px 0 0; background: transparent; color: var(--ink, #efe3c8); font: 600 14px 'Manrope', sans-serif; outline: none;
  transition: background .2s, border-color .2s, box-shadow .2s;
}
textarea { resize: none; line-height: 1.5; font-weight: 500; border: 1px dashed color-mix(in srgb, var(--acc, #e7c56f) 22%, transparent); border-radius: 8px; padding: 7px 9px; overflow: hidden; }
input:hover, textarea:hover { background: color-mix(in srgb, var(--acc, #e7c56f) 5%, transparent); }
input:focus, textarea:focus { background: color-mix(in srgb, var(--acc, #e7c56f) 9%, transparent); border-color: var(--acc, #e7c56f); box-shadow: 0 1px 0 var(--acc, #e7c56f); }
input[readonly], textarea[readonly] { cursor: default; }
input::placeholder, textarea::placeholder { color: color-mix(in srgb, var(--muted, #a8936c) 55%, transparent); font-weight: 500; }
.big input { font: 700 26px 'Cormorant Garamond', serif; padding: 2px 4px; letter-spacing: .01em; }
.center input { text-align: center; }
.t-num input { font-variant-numeric: tabular-nums; }
@media (max-width: 560px) { .big input { font-size: 21px; } }
.fld-s { position: absolute; right: 6px; bottom: 6px; color: var(--muted, #a8936c); font: 700 11px 'Manrope', sans-serif; pointer-events: none; }
</style>
