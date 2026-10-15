<template>
  <!-- итоговый бонус: зелёный / красный, щелчок — бросок d20 с этим бонусом -->
  <button type="button" class="bn" :class="{ pos: value > 0, neg: value < 0, sm: small }" :title="`Бросить: ${label} (1d20${fmt})`" @click="rollBonus(value, label, $event.currentTarget)">
    <Num :value="value" :sign="true" />
    <i class="bn-die" aria-hidden="true">🎲</i>
  </button>
</template>

<script setup>
import { computed } from 'vue'
import Num from './Num.vue'
import { rollBonus } from '../sheetState.js'
import { fmtBonus } from '../../shared/sheet.js'

const props = defineProps({ value: { type: Number, default: 0 }, label: { type: String, default: '' }, small: Boolean })
const fmt = computed(() => (props.value ? fmtBonus(props.value) : ''))
</script>

<style scoped>
.bn { position: relative; display: inline-grid; place-items: center; min-width: 46px; padding: 3px 8px; border-radius: 9px; border: 1px solid color-mix(in srgb, var(--acc, #e7c56f) 28%, transparent); background: color-mix(in srgb, var(--acc, #e7c56f) 7%, transparent); color: var(--ink, #efe3c8); font: 800 17px 'Manrope', sans-serif; font-variant-numeric: tabular-nums; cursor: pointer; transition: transform .15s, background .2s, border-color .2s; }
.bn.sm { min-width: 40px; font-size: 14.5px; padding: 2px 6px; }
.bn.pos { color: #6fdc8c; }
.bn.neg { color: #ff7a6b; }
.bn:hover { transform: translateY(-1px); background: color-mix(in srgb, var(--acc, #e7c56f) 16%, transparent); border-color: var(--acc, #e7c56f); }
.bn:active { transform: scale(.94); }
.bn-die { position: absolute; right: -7px; top: -8px; font-size: 11px; font-style: normal; opacity: 0; transform: scale(.5) rotate(-30deg); transition: opacity .15s, transform .2s; }
.bn:hover .bn-die { opacity: 1; transform: none; }
</style>
