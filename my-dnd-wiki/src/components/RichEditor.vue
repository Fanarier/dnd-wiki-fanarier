<template>
  <!-- текст с оформлением (Tiptap): кнопки сверху, «@» — упомянуть НПС, героя, поселение или город -->
  <div class="re" :class="{ focus: focused }">
    <FormatBar :editor="editor" :tables="tables" :headings="[3, 4]">
      <button type="button" title="Упомянуть: НПС, героя, поселение, город" @click="editor.chain().focus().insertContent('@').run()">@</button>
    </FormatBar>
    <EditorContent :editor="editor" class="re-body" :style="{ minHeight: minHeight + 'px' }" />

    <!-- подсказка после «@» -->
    <div v-if="sug.open && sug.items.length" class="re-sug" :style="sugStyle">
      <button v-for="(it, i) in sug.items" :key="it.id" type="button" :class="{ on: i === sug.index }" @mousedown.prevent="pick(i)">
        <b>{{ it.label }}</b><small>{{ it.kind }}</small>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Mention from '@tiptap/extension-mention'
import { loadNpcs } from '../map/store.js'
import { mentionItems } from './mentions.js'
import FormatBar from './rich/FormatBar.vue'
import { formatExtensions } from './rich/formatKit.js'

const props = defineProps({ modelValue: { type: String, default: '' }, placeholder: { type: String, default: '' }, minHeight: { type: Number, default: 110 }, tables: Boolean })
const emit = defineEmits(['update:modelValue'])

// старый простой текст → абзацы
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const toHtml = v => (/<[a-z][^>]*>/i.test(v || '') ? v : (v || '').split(/\n{2,}/).map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join(''))

// подсказка упоминаний — своё маленькое меню
const sug = reactive({ open: false, items: [], index: 0, rect: null, command: null })
const sugStyle = computed(() => (sug.rect ? { left: Math.min(sug.rect.left, innerWidth - 250) + 'px', top: sug.rect.bottom + 6 + 'px' } : { display: 'none' }))
function pick(i) {
  const it = sug.items[i]
  if (it && sug.command) sug.command({ id: it.id, label: it.label })
}
const suggestion = {
  char: '@',
  items: ({ query }) => mentionItems(query),
  render: () => ({
    onStart: p => Object.assign(sug, { open: true, items: p.items, index: 0, rect: p.clientRect?.() || null, command: p.command }),
    onUpdate: p => Object.assign(sug, { items: p.items, index: 0, rect: p.clientRect?.() || null, command: p.command }),
    onKeyDown: ({ event }) => {
      if (!sug.open || !sug.items.length) return false
      if (event.key === 'ArrowDown') { sug.index = (sug.index + 1) % sug.items.length; return true }
      if (event.key === 'ArrowUp') { sug.index = (sug.index - 1 + sug.items.length) % sug.items.length; return true }
      if (event.key === 'Enter' || event.key === 'Tab') { pick(sug.index); return true }
      if (event.key === 'Escape') { sug.open = false; return true }
      return false
    },
    onExit: () => { sug.open = false }
  })
}

const focused = ref(false)
const editor = useEditor({
  content: toHtml(props.modelValue),
  extensions: [
    StarterKit.configure({ heading: { levels: [3, 4] }, code: false, codeBlock: false, horizontalRule: false, link: { openOnClick: false } }),
    Mention.configure({ HTMLAttributes: { class: 'mention' }, renderText: ({ node }) => '@' + (node.attrs.label ?? node.attrs.id), suggestion }),
    ...formatExtensions({ tables: props.tables })
  ],
  editorProps: { attributes: { 'data-placeholder': props.placeholder } },
  onUpdate: ({ editor: e }) => emit('update:modelValue', e.isEmpty ? '' : e.getHTML()),
  onFocus: () => { focused.value = true },
  onBlur: () => { focused.value = false }
})
// снаружи поменяли значение (другая карточка, сброс) — подменяем содержимое
watch(() => props.modelValue, v => {
  const e = editor.value
  if (!e || (e.isEmpty ? '' : e.getHTML()) === v) return
  e.commands.setContent(toHtml(v), { emitUpdate: false })
})
onMounted(() => loadNpcs()) // НПС нужны для подсказки «@»
onBeforeUnmount(() => editor.value?.destroy())

</script>

<style scoped>
.re { min-width: 0; border-radius: 10px; border: 1px solid rgba(231, 197, 111, .25); background: #0f0c08; color: #efe3c8; transition: border-color .15s; }
.re.focus { border-color: rgba(231, 197, 111, .6); }
.re-body { padding: 8px 10px; font: 500 13.5px/1.55 'Manrope', sans-serif; cursor: text; }
.re-body :deep(.ProseMirror) { outline: none; min-height: inherit; white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word; }
.re-body :deep(.ProseMirror p) { margin: 0 0 .5em; }
.re-body :deep(.ProseMirror h3), .re-body :deep(.ProseMirror h4) { margin: .5em 0 .3em; font-family: 'Cormorant Garamond', serif; color: #e6c27a; }
.re-body :deep(.ProseMirror ul), .re-body :deep(.ProseMirror ol) { padding-left: 1.3em; margin: .2em 0 .5em; }
.re-body :deep(.ProseMirror blockquote) { margin: .4em 0; padding: .2em .8em; border-left: 3px solid rgba(231, 197, 111, .5); color: #cdbf9f; font-style: italic; }
.re-body :deep(.ProseMirror table) { border-collapse: collapse; margin: .5em 0; width: 100%; table-layout: fixed; }
.re-body :deep(.ProseMirror td), .re-body :deep(.ProseMirror th) { border: 1px solid rgba(231, 197, 111, .25); padding: 4px 6px; vertical-align: top; position: relative; }
.re-body :deep(.ProseMirror mark) { background: rgba(0, 220, 230, .18); color: #9ff3f7; }
.re-body :deep(.mention) { padding: 0 4px; border-radius: 6px; background: rgba(231, 197, 111, .16); color: #f3d99a; font-weight: 700; }
.re-body :deep(.ProseMirror p.is-editor-empty:first-child::before), .re-body :deep(.ProseMirror:has(> p:only-child:empty)::before) { content: attr(data-placeholder); float: left; height: 0; color: #6f6656; pointer-events: none; }
.re-sug { position: fixed; z-index: 600; display: grid; width: 240px; padding: 4px; border-radius: 10px; background: #1b1610; border: 1px solid #8a6630; box-shadow: 0 12px 30px rgba(0, 0, 0, .55); }
.re-sug button { display: flex; justify-content: space-between; gap: 8px; padding: 6px 8px; border: 0; border-radius: 7px; background: none; color: #efe3c8; font: 600 13px 'Manrope', sans-serif; text-align: left; cursor: pointer; }
.re-sug button.on, .re-sug button:hover { background: rgba(231, 197, 111, .16); }
.re-sug small { color: #a8936c; font-size: 11.5px; }
</style>
