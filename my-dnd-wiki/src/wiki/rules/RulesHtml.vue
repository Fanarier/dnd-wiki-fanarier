<template>
  <!-- текст правил (HTML очищен сервером): абзацы, таблицы, цвета пометок из документа -->
  <div class="rh" v-html="marked" />
</template>

<script setup>
import { computed } from 'vue'
import { markTerms } from '../../components/preview/previewData.js'
const props = defineProps({ html: { type: String, default: '' } })
// названия эффектов, заклинаний, рас и классов в скобках — с превью при наведении
const marked = computed(() => markTerms(props.html))
</script>

<style scoped>
.rh { line-height: 1.6; font-size: 14.5px; color: #e6dcc6; overflow-wrap: anywhere; }
.rh :deep(p) { margin: 0 0 .5em; }
.rh :deep(p:last-child) { margin-bottom: 0; }
.rh :deep(h2), .rh :deep(h3) { margin: 1em 0 .4em; font: 700 22px 'Cormorant Garamond', serif; color: #f3dc9e; }
.rh :deep(h4) { margin: .9em 0 .35em; font: 700 18px 'Cormorant Garamond', serif; color: #e6c27a; }
.rh :deep(strong) { color: #fff1d0; }
.rh :deep(ul), .rh :deep(ol) { margin: 0 0 .6em; padding-left: 1.3em; }
.rh :deep(li) { margin: .15em 0; }
.rh :deep(mark) { background: rgba(0, 220, 230, .18); color: #9ff3f7; border-radius: 3px; padding: 0 2px; }
.rh :deep(a) { color: #8fc3ff; }
.rh :deep(hr) { border: 0; border-top: 1px solid rgba(231, 197, 111, .2); margin: 1em 0; }
/* таблицы документа: тёмные, с золотой сеткой, прокручиваются вбок на узком экране */
.rh :deep(table) { display: block; max-width: 100%; overflow-x: auto; border-collapse: collapse; margin: .6em 0 1em; font-size: 13.5px; }
.rh :deep(td), .rh :deep(th) { padding: 7px 10px; border: 1px solid rgba(231, 197, 111, .18); vertical-align: top; min-width: 60px; }
.rh :deep(tr:first-child td) { background: rgba(231, 197, 111, .08); font-weight: 700; color: #f3dc9e; }
.rh :deep(tr:nth-child(even) td) { background: rgba(255, 255, 255, .02); }
.rh :deep(td p) { margin: 0 0 .3em; }
</style>
