<template>
  <!-- текст, где «1к8 + 11», «3к12» — кнопки броска. Текст с оформлением (HTML, очищен сервером) — тоже:
       кнопки вставляются в текстовые куски между тегами -->
  <span v-if="isHtml" class="dt-txt dt-html" @click="onClick" v-html="decorated" />
  <span v-else class="dt-txt"><template v-for="(part, i) in parts" :key="i"><button v-if="part.f" type="button" class="dt-roll" :title="`Бросить ${part.f}`" @click.stop="roll(part.f, label, $event.currentTarget)">🎲 {{ part.t }}</button><template v-else>{{ part.t }}</template></template></span>
</template>

<script setup>
import { computed } from 'vue'
import { DICE_RE, diceToFormula } from '../../shared/sheet.js'
import { roll } from '../sheetState.js'

const props = defineProps({ text: { type: String, default: '' }, label: { type: String, default: '' } })
const isHtml = computed(() => /<[a-z][^>]*>/i.test(props.text || ''))
// куски текста: обычные и формулы кубов
function split(s) {
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
}
const parts = computed(() => split(props.text || ''))
const escAttr = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
// HTML: формулы ищем только в тексте между тегами
const decorated = computed(() => String(props.text || '').split(/(<[^>]+>)/).map(seg => (seg.startsWith('<') ? seg
  : split(seg).map(p => (p.f ? `<button type="button" class="dt-roll" data-f="${escAttr(p.f)}" title="Бросить ${escAttr(p.f)}">🎲 ${p.t}</button>` : p.t)).join(''))).join(''))
function onClick(e) {
  const b = e.target.closest?.('.dt-roll')
  if (!b) return
  e.stopPropagation()
  roll(b.dataset.f, props.label, b)
}
</script>

<style scoped>
.dt-txt { white-space: pre-wrap; overflow-wrap: anywhere; }
.dt-html { display: block; white-space: normal; }
.dt-html :deep(p) { margin: 0 0 .35em; }
.dt-html :deep(p:last-child) { margin-bottom: 0; }
.dt-html :deep(h3), .dt-html :deep(h4) { margin: .4em 0 .25em; font-family: 'Cormorant Garamond', serif; color: color-mix(in srgb, var(--acc, #e7c56f) 70%, #fff); }
.dt-html :deep(ul), .dt-html :deep(ol) { margin: .2em 0 .4em; padding-left: 1.3em; }
.dt-html :deep(blockquote) { margin: .3em 0; padding: .1em .7em; border-left: 3px solid color-mix(in srgb, var(--acc, #e7c56f) 60%, transparent); font-style: italic; }
.dt-html :deep(mark) { background: rgba(0, 220, 230, .18); color: #9ff3f7; border-radius: 3px; padding: 0 2px; }
.dt-html :deep(table) { display: block; max-width: 100%; overflow-x: auto; border-collapse: collapse; margin: .3em 0; }
.dt-html :deep(td), .dt-html :deep(th) { padding: 3px 7px; border: 1px solid color-mix(in srgb, var(--acc, #e7c56f) 25%, transparent); vertical-align: top; }
.dt-roll, .dt-html :deep(.dt-roll) { display: inline; padding: 0 5px; margin: 0 1px; border-radius: 6px; border: 1px solid color-mix(in srgb, var(--acc, #e7c56f) 45%, transparent); background: color-mix(in srgb, var(--acc, #e7c56f) 12%, transparent); color: var(--ink, #efe3c8); font: inherit; font-weight: 800; cursor: pointer; white-space: nowrap; transition: background .15s, transform .15s; }
.dt-roll:hover, .dt-html :deep(.dt-roll:hover) { background: color-mix(in srgb, var(--acc, #e7c56f) 26%, transparent); }
.dt-roll:active, .dt-html :deep(.dt-roll:active) { transform: scale(.95); }
</style>
