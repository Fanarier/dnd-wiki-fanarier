<template>
  <!-- редактор текста правил: полное форматирование (src/components/rich/FormatBar.vue) и таблицы с заливкой ячеек -->
  <div class="rle" :class="{ focus: focused }">
    <FormatBar :editor="editor" tables :headings="[3, 4]" />
    <EditorContent :editor="editor" class="rle-body" :style="{ minHeight: minHeight + 'px' }" />
  </div>
</template>

<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import FormatBar from '../../components/rich/FormatBar.vue'
import { formatExtensions } from '../../components/rich/formatKit.js'

const props = defineProps({ modelValue: { type: String, default: '' }, minHeight: { type: Number, default: 120 } })
const emit = defineEmits(['update:modelValue'])
const focused = ref(false)
const editor = useEditor({
  content: props.modelValue || '',
  extensions: [
    StarterKit.configure({ heading: { levels: [3, 4] }, code: false, codeBlock: false, link: { openOnClick: false } }),
    ...formatExtensions({ tables: true })
  ],
  onUpdate: ({ editor: e }) => emit('update:modelValue', e.isEmpty ? '' : e.getHTML()),
  onFocus: () => { focused.value = true },
  onBlur: () => { focused.value = false }
})
watch(() => props.modelValue, v => {
  const e = editor.value
  if (!e || (e.isEmpty ? '' : e.getHTML()) === v) return
  e.commands.setContent(v || '', { emitUpdate: false })
})
onBeforeUnmount(() => editor.value?.destroy())
</script>

<style scoped>
.rle { min-width: 0; border-radius: 10px; border: 1px solid rgba(231, 197, 111, .25); background: #0f0c08; color: #efe3c8; transition: border-color .15s; }
.rle.focus { border-color: rgba(231, 197, 111, .6); }
.rle-body { padding: 8px 10px; font: 500 13.5px/1.55 'Manrope', sans-serif; cursor: text; }
.rle-body :deep(.ProseMirror) { outline: none; min-height: inherit; overflow-wrap: anywhere; }
.rle-body :deep(.ProseMirror p) { margin: 0 0 .5em; }
.rle-body :deep(.ProseMirror h3), .rle-body :deep(.ProseMirror h4) { margin: .5em 0 .3em; font-family: 'Cormorant Garamond', serif; color: #e6c27a; }
.rle-body :deep(.ProseMirror ul), .rle-body :deep(.ProseMirror ol) { padding-left: 1.3em; margin: .2em 0 .5em; }
.rle-body :deep(.ProseMirror blockquote) { margin: .4em 0; padding: .2em .8em; border-left: 3px solid rgba(231, 197, 111, .5); color: #cdbf9f; font-style: italic; }
.rle-body :deep(.ProseMirror mark) { background: rgba(0, 220, 230, .18); color: #9ff3f7; }
.rle-body :deep(.ProseMirror table) { border-collapse: collapse; margin: .5em 0; width: 100%; table-layout: fixed; }
.rle-body :deep(.ProseMirror td), .rle-body :deep(.ProseMirror th) { border: 1px solid rgba(231, 197, 111, .25); padding: 4px 6px; vertical-align: top; position: relative; }
.rle-body :deep(.ProseMirror .selectedCell::after) { content: ''; position: absolute; inset: 0; background: rgba(231, 197, 111, .15); pointer-events: none; }
</style>
