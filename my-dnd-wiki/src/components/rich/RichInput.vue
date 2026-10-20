<template>
  <!-- поле с оформлением для листов, журнала деятельностей и ячеек таблиц: выглядит как обычный текст,
       панель форматирования появляется, когда поле в работе. Без оформления сохраняется простым текстом
       (как было в приложении), с оформлением — HTML (сервер его очищает) -->
  <div ref="wrap" class="ri" :class="{ active, ro: readonly }" @focusin="active = true" @focusout="leave">
    <FormatBar v-if="(active || !compact) && !readonly" :editor="editor" :tables="tables" />
    <EditorContent :editor="editor" class="ri-body" :style="{ minHeight: minHeight + 'px' }" />
  </div>
</template>

<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import FormatBar from './FormatBar.vue'
import { formatExtensions, plainToHtml } from './formatKit.js'

const props = defineProps({
  modelValue: { type: String, default: '' }, placeholder: { type: String, default: '' }, minHeight: { type: Number, default: 34 },
  compact: { type: Boolean, default: true }, tables: Boolean, readonly: Boolean, autofocus: Boolean
})
const emit = defineEmits(['update:modelValue', 'blur'])
const wrap = ref(null)
const active = ref(false)

// только абзацы без оформления — обратно в простой текст с переносами
const unesc = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
function toValue(html) {
  if (/^(<p>([^<]|<br>)*<\/p>)+$/.test(html)) return unesc(html.replace(/<br>/g, '\n').replace(/<\/p><p>/g, '\n').replace(/^<p>|<\/p>$/g, ''))
  return html
}
const editor = useEditor({
  content: plainToHtml(props.modelValue),
  editable: !props.readonly,
  autofocus: props.autofocus ? 'end' : false,
  extensions: [
    StarterKit.configure({ heading: { levels: [3, 4] }, code: false, codeBlock: false, horizontalRule: false, link: { openOnClick: false } }),
    ...formatExtensions({ tables: props.tables })
  ],
  editorProps: { attributes: { 'data-placeholder': props.placeholder } },
  onUpdate: ({ editor: e }) => emit('update:modelValue', e.isEmpty ? '' : toValue(e.getHTML()))
})
watch(() => props.modelValue, v => {
  const e = editor.value
  if (!e || (e.isEmpty ? '' : toValue(e.getHTML())) === (v || '')) return
  e.commands.setContent(plainToHtml(v), { emitUpdate: false })
})
watch(() => props.readonly, r => editor.value?.setEditable(!r))
// ушли из поля совсем (не в панель, не в выбор цвета) — прячем панель
function leave(e) {
  if (wrap.value?.contains(e.relatedTarget)) return
  setTimeout(() => { if (!wrap.value?.contains(document.activeElement)) { active.value = false; emit('blur') } }, 120)
}
onBeforeUnmount(() => editor.value?.destroy())
</script>

<style scoped>
.ri { min-width: 0; border-radius: 8px; border: 1px dashed color-mix(in srgb, var(--acc, #e7c56f) 22%, transparent); background: transparent; color: var(--ink, #efe3c8); transition: border-color .2s, background .2s; }
.ri:hover:not(.ro) { background: color-mix(in srgb, var(--acc, #e7c56f) 5%, transparent); }
.ri.active { border-style: solid; border-color: var(--acc, #e7c56f); background: color-mix(in srgb, var(--acc, #e7c56f) 7%, #0f0c08); }
.ri.ro { border-color: transparent; }
.ri :deep(.fb) { background: #0f0c08; }
.ri-body { padding: 6px 9px; font: 500 14px/1.5 'Manrope', sans-serif; cursor: text; }
.ri.ro .ri-body { cursor: default; }
.ri-body :deep(.ProseMirror) { outline: none; min-height: inherit; white-space: pre-wrap; overflow-wrap: anywhere; }
.ri-body :deep(.ProseMirror p) { margin: 0 0 .35em; }
.ri-body :deep(.ProseMirror p:last-child) { margin-bottom: 0; }
.ri-body :deep(.ProseMirror h3), .ri-body :deep(.ProseMirror h4) { margin: .4em 0 .25em; font-family: 'Cormorant Garamond', serif; color: color-mix(in srgb, var(--acc, #e7c56f) 70%, #fff); }
.ri-body :deep(.ProseMirror ul), .ri-body :deep(.ProseMirror ol) { padding-left: 1.3em; margin: .2em 0 .4em; }
.ri-body :deep(.ProseMirror blockquote) { margin: .3em 0; padding: .1em .7em; border-left: 3px solid color-mix(in srgb, var(--acc, #e7c56f) 60%, transparent); font-style: italic; }
.ri-body :deep(.ProseMirror mark) { background: rgba(0, 220, 230, .18); color: #9ff3f7; }
.ri-body :deep(.ProseMirror table) { border-collapse: collapse; width: 100%; table-layout: fixed; }
.ri-body :deep(.ProseMirror td), .ri-body :deep(.ProseMirror th) { border: 1px solid color-mix(in srgb, var(--acc, #e7c56f) 30%, transparent); padding: 3px 6px; vertical-align: top; position: relative; }
.ri-body :deep(.ProseMirror p.is-editor-empty:first-child::before), .ri-body :deep(.ProseMirror:has(> p:only-child:empty)::before) { content: attr(data-placeholder); float: left; height: 0; color: color-mix(in srgb, var(--muted, #a8936c) 55%, transparent); pointer-events: none; }
</style>
