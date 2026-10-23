<template>
  <!-- описание навыка: эффекты из справочника НПС или из эффектов вики подсвечены, при наведении (или касании) — подсказка;
       прочие «(…)» — формулы -->
  <span class="fxt">
    <template v-for="(p, i) in parts" :key="i">
      <span v-if="p.fx" class="fxt-ef" tabindex="0" :style="{ '--fc': p.fx.color || '#c9a2ff' }">{{ p.s }}<span class="fxt-tip" role="tooltip"><b><img v-if="wiki(p.fx)?.icon" :src="wiki(p.fx).icon" alt="" />{{ p.fx.name }}</b>{{ p.fx.desc || wikiText(p.fx) || 'Описание эффекта пока не заполнено.' }}</span></span>
      <span v-else-if="p.inner" class="fxt-par">{{ p.s }}</span>
      <template v-else>{{ p.s }}</template>
    </template>
  </span>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { splitFx } from '../../shared/npc.js'
import { rulesState, loadRules } from '../../map/store.js'
import { findEffect, htmlToText } from '../../shared/rules.js'
const props = defineProps({ text: { type: String, default: '' }, effects: { type: Array, default: () => [] } })
// чего нет в справочнике НПС, ищем среди эффектов вики (там их больше: «Очарование» и т.д.)
const parts = computed(() => splitFx(props.text, props.effects).map(p => {
  if (!p.inner || p.fx) return p
  const w = findEffect(rulesState.effects, { Name: p.inner })
  return w ? { ...p, fx: { name: w.name, color: KIND_COLOR[w.kind] || '#c9a2ff', desc: '' } } : p
}))
const KIND_COLOR = { buff: '#8fd68a', debuff: '#c9a2ff', special: '#f3c86b' }
onMounted(() => loadRules())
// тот же эффект в вики правил — оттуда иконка, и описание, если в справочнике НПС его нет
const wiki = fx => findEffect(rulesState.effects, { Name: fx.name })
const wikiText = fx => htmlToText(wiki(fx)?.html || '').replace(/\s+/g, ' ')
</script>

<style scoped>
.fxt { white-space: pre-line; }
.fxt-ef { position: relative; color: var(--fc); font-weight: 800; border-bottom: 1px dotted var(--fc); cursor: help; outline: none; }
.fxt-tip { position: absolute; z-index: 30; left: 50%; bottom: calc(100% + 8px); width: max-content; max-width: min(280px, 80vw); transform: translateX(-50%) translateY(4px); padding: 9px 11px; border-radius: 10px;
  background: #1b1610; border: 1px solid color-mix(in srgb, var(--fc) 60%, #000); box-shadow: 0 12px 30px rgba(0, 0, 0, .55); color: #e9dfc8; font: 500 12.5px/1.45 'Manrope', sans-serif; white-space: normal; text-align: left;
  opacity: 0; visibility: hidden; transition: opacity .15s, transform .15s; pointer-events: none; }
.fxt-tip b { display: flex; align-items: center; gap: 6px; margin-bottom: 3px; color: var(--fc); font-weight: 800; }
.fxt-tip img { width: 22px; height: 22px; border-radius: 5px; }
.fxt-ef:hover .fxt-tip, .fxt-ef:focus .fxt-tip { opacity: 1; visibility: visible; transform: translateX(-50%); }
.fxt-par { padding: 0 3px; border-radius: 5px; background: rgba(231, 197, 111, .08); color: #e6cf98; font-weight: 700; }
</style>
