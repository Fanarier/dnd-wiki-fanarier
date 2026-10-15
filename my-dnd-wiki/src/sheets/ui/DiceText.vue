<template>
  <!-- текст, где «1к8 + 11», «3к12» — кнопки броска -->
  <span class="dt-txt"><template v-for="(part, i) in parts" :key="i"><button v-if="part.f" type="button" class="dt-roll" :title="`Бросить ${part.f}`" @click.stop="roll(part.f, label, $event.currentTarget)">🎲 {{ part.t }}</button><template v-else>{{ part.t }}</template></template></span>
</template>

<script setup>
import { computed } from 'vue'
import { DICE_RE, diceToFormula } from '../../shared/sheet.js'
import { roll } from '../sheetState.js'

const props = defineProps({ text: { type: String, default: '' }, label: { type: String, default: '' } })
const parts = computed(() => {
  const s = props.text || ''
  const out = []
  let last = 0
  for (const m of s.matchAll(DICE_RE)) {
    const lead = m[0].length - m[0].trimStart().length
    const start = m.index + lead
    const t = m[0].trim()
    if (!/\d/.test(t.split(/[кКdDдД]/)[1] || '')) continue
    if (start > last) out.push({ t: s.slice(last, start) })
    out.push({ t, f: diceToFormula(t) })
    last = start + t.length
  }
  if (last < s.length) out.push({ t: s.slice(last) })
  return out
})
</script>

<style scoped>
.dt-txt { white-space: pre-wrap; overflow-wrap: anywhere; }
.dt-roll { display: inline; padding: 0 5px; margin: 0 1px; border-radius: 6px; border: 1px solid color-mix(in srgb, var(--acc, #e7c56f) 45%, transparent); background: color-mix(in srgb, var(--acc, #e7c56f) 12%, transparent); color: var(--ink, #efe3c8); font: inherit; font-weight: 800; cursor: pointer; white-space: nowrap; transition: background .15s, transform .15s; }
.dt-roll:hover { background: color-mix(in srgb, var(--acc, #e7c56f) 26%, transparent); }
.dt-roll:active { transform: scale(.95); }
</style>
