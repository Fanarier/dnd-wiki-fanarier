<template>
  <!-- редактор текста правил: как обычный, плюс таблицы, цвет текста и выделение -->
  <div class="rle" :class="{ focus: focused }">
    <div v-if="editor" class="rle-bar" @mousedown.prevent>
      <button v-for="b in BUTTONS" :key="b.key" type="button" :class="[{ on: b.on?.() }, b.cls]" :title="b.title" @click="b.run()">{{ b.label }}</button>
      <span class="rle-sep" />
      <span class="rle-cols" title="Цвет текста">
        <button v-for="c in COLORS" :key="c.v" type="button" class="rle-col" :style="{ background: c.v || 'transparent' }" :title="c.t" @click="c.v ? x().setColor(c.v).run() : x().unsetColor().run()">{{ c.v ? '' : '⌀' }}</button>
      </span>
      <span class="rle-sep" />
      <template v-if="inTable">
        <button type="button" title="Строка ниже" @click="x().addRowAfter().run()">＋стр</button>
        <button type="button" title="Столбец правее" @click="x().addColumnAfter().run()">＋стб</button>
        <button type="button" title="Удалить строку" @click="x().deleteRow().run()">−стр</button>
        <button type="button" title="Удалить столбец" @click="x().deleteColumn().run()">−стб</button>
        <button type="button" title="Объединить ячейки" @click="x().mergeOrSplit().run()">⊞</button>
        <button type="button" class="danger" title="Удалить таблицу" @click="x().deleteTable().run()">✕табл</button>
      </template>
      <button v-else type="button" title="Вставить таблицу 3×3" @click="x().insertTable({ rows: 3, cols: 3, withHeaderRow: false }).run()">▦ таблица</button>
    </div>
    <EditorContent :editor="editor" class="rle-body" :style="{ minHeight: minHeight + 'px' }" />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table'
import { TextStyle, Color } from '@tiptap/extension-text-style'
import Highlight from '@tiptap/extension-highlight'

const props = defineProps({ modelValue: { type: String, default: '' }, minHeight: { type: Number, default: 120 } })
const emit = defineEmits(['update:modelValue'])
// цвета пометок документа (как в Google Docs, но читаемые на тёмном фоне)
const COLORS = [
  { v: '', t: 'Обычный цвет' }, { v: '#6fa8ff', t: 'Синий — усиление' }, { v: '#7ed07a', t: 'Зелёный — переработка, добавлено' },
  { v: '#f0a24f', t: 'Оранжевый — удалено' }, { v: '#ff6b5e', t: 'Красный — ослабление' }, { v: '#c27bff', t: 'Фиолетовый — тестовое' }, { v: '#f1c232', t: 'Жёлтый' }
]
const focused = ref(false)
const editor = useEditor({
  content: props.modelValue || '',
  extensions: [
    StarterKit.configure({ heading: { levels: [3, 4] }, code: false, codeBlock: false, link: { openOnClick: false } }),
    Table.configure({ resizable: false }), TableRow, TableCell, TableHeader,
    TextStyle, Color, Highlight
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
const x = () => editor.value.chain().focus()
const act = (n, a) => editor.value?.isActive(n, a)
const inTable = computed(() => !!editor.value && (editor.value.isActive('table') || editor.value.isActive('tableCell')))
const BUTTONS = [
  { key: 'b', label: 'Ж', cls: 'b', title: 'Жирный', run: () => x().toggleBold().run(), on: () => act('bold') },
  { key: 'i', label: 'К', cls: 'i', title: 'Курсив', run: () => x().toggleItalic().run(), on: () => act('italic') },
  { key: 'u', label: 'Ч', cls: 'u', title: 'Подчёркнутый', run: () => x().toggleUnderline().run(), on: () => act('underline') },
  { key: 'm', label: '▮', cls: 'm', title: 'Выделить фоном', run: () => x().toggleHighlight().run(), on: () => act('highlight') },
  { key: 'h3', label: 'H1', title: 'Заголовок', run: () => x().toggleHeading({ level: 3 }).run(), on: () => act('heading', { level: 3 }) },
  { key: 'h4', label: 'H2', title: 'Подзаголовок', run: () => x().toggleHeading({ level: 4 }).run(), on: () => act('heading', { level: 4 }) },
  { key: 'ul', label: '•', title: 'Список', run: () => x().toggleBulletList().run(), on: () => act('bulletList') },
  { key: 'ol', label: '1.', title: 'Нумерованный список', run: () => x().toggleOrderedList().run(), on: () => act('orderedList') },
  { key: 'undo', label: '↶', title: 'Отменить', run: () => x().undo().run() },
  { key: 'redo', label: '↷', title: 'Повторить', run: () => x().redo().run() }
]
</script>

<style scoped>
.rle { min-width: 0; border-radius: 10px; border: 1px solid rgba(231, 197, 111, .25); background: #0f0c08; color: #efe3c8; transition: border-color .15s; }
.rle.focus { border-color: rgba(231, 197, 111, .6); }
.rle-bar { position: sticky; top: 0; z-index: 2; display: flex; flex-wrap: wrap; align-items: center; gap: 2px; padding: 4px; border-bottom: 1px solid rgba(231, 197, 111, .15); background: #0f0c08; border-radius: 10px 10px 0 0; }
.rle-bar button { min-width: 28px; height: 26px; padding: 0 6px; border: 0; border-radius: 6px; background: none; color: #cdbf9f; font: 700 12px 'Manrope', sans-serif; cursor: pointer; }
.rle-bar button:hover { background: rgba(231, 197, 111, .1); color: #f3d99a; }
.rle-bar button.on { background: rgba(231, 197, 111, .22); color: #f3dc9e; }
.rle-bar .b { font-weight: 900; } .rle-bar .i { font-style: italic; } .rle-bar .u { text-decoration: underline; } .rle-bar .m { color: #9ff3f7; }
.rle-bar .danger { color: #ff9b8f; }
.rle-sep { width: 1px; height: 18px; margin: 0 3px; background: rgba(231, 197, 111, .2); }
.rle-cols { display: inline-flex; gap: 3px; }
.rle-bar .rle-col { min-width: 18px; width: 18px; height: 18px; padding: 0; border-radius: 50%; border: 1px solid rgba(255, 255, 255, .25); font-size: 10px; line-height: 1; }
.rle-body { padding: 8px 10px; font: 500 13.5px/1.55 'Manrope', sans-serif; cursor: text; }
.rle-body :deep(.ProseMirror) { outline: none; min-height: inherit; overflow-wrap: anywhere; }
.rle-body :deep(.ProseMirror p) { margin: 0 0 .5em; }
.rle-body :deep(.ProseMirror h3), .rle-body :deep(.ProseMirror h4) { margin: .5em 0 .3em; font-family: 'Cormorant Garamond', serif; color: #e6c27a; }
.rle-body :deep(.ProseMirror ul), .rle-body :deep(.ProseMirror ol) { padding-left: 1.3em; margin: .2em 0 .5em; }
.rle-body :deep(.ProseMirror mark) { background: rgba(0, 220, 230, .18); color: #9ff3f7; }
.rle-body :deep(.ProseMirror table) { border-collapse: collapse; margin: .5em 0; width: 100%; table-layout: fixed; }
.rle-body :deep(.ProseMirror td), .rle-body :deep(.ProseMirror th) { border: 1px solid rgba(231, 197, 111, .25); padding: 4px 6px; vertical-align: top; position: relative; }
.rle-body :deep(.ProseMirror .selectedCell::after) { content: ''; position: absolute; inset: 0; background: rgba(231, 197, 111, .15); pointer-events: none; }
</style>
