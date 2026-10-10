<template>
  <!-- описание навыка: эффекты из справочника подсвечены, при наведении (или касании) — подсказка; прочие «(…)» — формулы -->
  <span class="fxt">
    <template v-for="(p, i) in parts" :key="i">
      <span v-if="p.fx" class="fxt-ef" tabindex="0" :style="{ '--fc': p.fx.color || '#c9a2ff' }">{{ p.s }}<span class="fxt-tip" role="tooltip"><b>{{ p.fx.name }}</b>{{ p.fx.desc || 'Описание эффекта пока не заполнено.' }}</span></span>
      <span v-else-if="p.inner" class="fxt-par">{{ p.s }}</span>
      <template v-else>{{ p.s }}</template>
    </template>
  </span>
</template>

<script setup>
import { computed } from 'vue'
import { splitFx } from '../../shared/npc.js'
const props = defineProps({ text: { type: String, default: '' }, effects: { type: Array, default: () => [] } })
const parts = computed(() => splitFx(props.text, props.effects))
</script>

<style scoped>
.fxt { white-space: pre-line; }
.fxt-ef { position: relative; color: var(--fc); font-weight: 800; border-bottom: 1px dotted var(--fc); cursor: help; outline: none; }
.fxt-tip { position: absolute; z-index: 30; left: 50%; bottom: calc(100% + 8px); width: max-content; max-width: min(280px, 80vw); transform: translateX(-50%) translateY(4px); padding: 9px 11px; border-radius: 10px;
  background: #1b1610; border: 1px solid color-mix(in srgb, var(--fc) 60%, #000); box-shadow: 0 12px 30px rgba(0, 0, 0, .55); color: #e9dfc8; font: 500 12.5px/1.45 'Manrope', sans-serif; white-space: normal; text-align: left;
  opacity: 0; visibility: hidden; transition: opacity .15s, transform .15s; pointer-events: none; }
.fxt-tip b { display: block; margin-bottom: 3px; color: var(--fc); font-weight: 800; }
.fxt-ef:hover .fxt-tip, .fxt-ef:focus .fxt-tip { opacity: 1; visibility: visible; transform: translateX(-50%); }
.fxt-par { padding: 0 3px; border-radius: 5px; background: rgba(231, 197, 111, .08); color: #e6cf98; font-weight: 700; }
</style>
