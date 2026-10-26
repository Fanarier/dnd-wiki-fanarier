<template>
  <!-- поле с оформлением для листов, журнала деятельностей и ячеек таблиц: выглядит как обычный текст,
       панель форматирования появляется, когда поле в работе. Без оформления сохраняется простым текстом
       (как было в приложении), с оформлением — HTML (сервер его очищает) -->
  <div ref="wrap" class="ri" :class="{ active, ro: readonly }" @focusin="active = true" @focusout="leave">
    <FormatBar v-if="(active || !compact) && !readonly" :editor="editor" :tables="tables" />
    <EditorContent :editor="editor" class="ri-body" :style="{ minHeight: minHeight + 'px' }" />
    <!-- фото (журнал деятельностей): сжимается в браузере и грузится на сайт; можно и вставить из буфера или перетащить -->
    <div v-if="images && !readonly" class="ri-img">
      <label class="ri-imgbtn" :class="{ busy: uploading }">📷 {{ uploading ? 'Загружаю…' : 'Фото' }}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden multiple :disabled="uploading" @change="pickImg" /></label>
      <!-- выбрано фото (щёлкни по нему): двигать кнопками — в длинном тексте тащить мышью неудобно -->
      <span v-if="imgSel" class="ri-imgmove">Фото:
        <button type="button" title="Выше на абзац (Alt+↑)" @mousedown.prevent="moveImg(-1)">↑ выше</button>
        <button type="button" title="Ниже на абзац (Alt+↓)" @mousedown.prevent="moveImg(1)">↓ ниже</button>
        <button type="button" class="del" title="Убрать фото" @mousedown.prevent="dropImg">✕</button>
      </span>
      <small v-else>или вставь из буфера / перетащи · щёлкни по фото — появятся «выше / ниже»</small>
    </div>
    <!-- «!» + начало заготовки → подсказка, Tab (или Enter) вставляет -->
    <div v-if="sug" class="ri-sug" :style="{ left: sug.x + 'px', top: sug.y + 'px' }">
      <button v-for="(s, i) in sug.items" :key="s" type="button" :class="{ on: i === sug.i }" @mousedown.prevent="pickSug(i)">{{ s.trim() }}<kbd v-if="i === sug.i">Tab</kbd></button>
    </div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import FormatBar from './FormatBar.vue'
import { Node, mergeAttributes } from '@tiptap/core'
import { NodeSelection } from '@tiptap/pm/state'
import { formatExtensions, plainToHtml } from './formatKit.js'
import { shrink, postBlob, toast } from '../../map/store.js'

// картинка в тексте — отдельным блоком (только загруженные на сайт, сервер чужие ссылки вырежет)
const Img = Node.create({
  name: 'image', group: 'block', atom: true, draggable: true,
  addAttributes: () => ({ src: { default: null }, alt: { default: '' } }),
  parseHTML: () => [{ tag: 'img[src]' }],
  renderHTML: ({ HTMLAttributes }) => ['img', mergeAttributes(HTMLAttributes)]
})

const props = defineProps({
  modelValue: { type: String, default: '' }, placeholder: { type: String, default: '' }, minHeight: { type: Number, default: 34 },
  compact: { type: Boolean, default: true }, tables: Boolean, readonly: Boolean, autofocus: Boolean,
  snippets: { type: Array, default: () => [] }, // заготовки: пишешь «!Мод» — предлагает «Модификаторы броска: »
  images: Boolean // можно приложить фото
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
    ...formatExtensions({ tables: props.tables }),
    ...(props.images ? [Img] : [])
  ],
  editorProps: {
    attributes: { 'data-placeholder': props.placeholder },
    handleKeyDown: (view, ev) => sugKey(ev) || imgKey(ev),
    // фото из буфера и перетаскиванием файла снаружи — туда, куда отпустили. Перетаскивание фото внутри текста
    // (moved / view.dragging) — это перенос, не новая картинка: его делает сам редактор
    handlePaste: (view, ev) => takeFiles(ev.clipboardData?.files),
    handleDrop: (view, ev, slice, moved) => {
      if (moved || view.dragging) return false
      return takeFiles(ev.dataTransfer?.files, view.posAtCoords({ left: ev.clientX, top: ev.clientY })?.pos)
    }
  },
  onUpdate: ({ editor: e }) => { emit('update:modelValue', e.isEmpty ? '' : toValue(e.getHTML())); scanSug(e) },
  onSelectionUpdate: ({ editor: e }) => { scanSug(e); imgSel.value = isImgSel(e) },
  onBlur: () => { sug.value = null }
})
// фото: до 1600 px по большей стороне, webp ~80% — обычно 100–300 КБ
const uploading = ref(false)
function takeFiles(list, at) {
  const files = [...(list || [])].filter(f => f.type.startsWith('image/'))
  if (!props.images || !files.length) return false
  if (at != null) editor.value?.commands.setTextSelection(at)
  upload(files)
  return true
}
// выбранное фото — на абзац выше / ниже (меняется местами с соседним блоком)
const imgSel = ref(false)
const isImgSel = e => e.state.selection instanceof NodeSelection && e.state.selection.node.type.name === 'image'
function moveImg(dir) {
  const e = editor.value
  if (!e || !isImgSel(e)) return
  const { state } = e, sel = state.selection, node = sel.node, $p = state.doc.resolve(sel.from)
  const idx = $p.index(), parent = $p.parent
  if (idx + dir < 0 || idx + dir >= parent.childCount) return
  const other = parent.child(idx + dir)
  const at = dir < 0 ? sel.from - other.nodeSize : sel.from + other.nodeSize
  const tr = state.tr.delete(sel.from, sel.from + node.nodeSize).insert(at, node)
  tr.setSelection(NodeSelection.create(tr.doc, at)).scrollIntoView()
  e.view.dispatch(tr)
  e.view.focus()
}
function dropImg() { const e = editor.value; if (e && isImgSel(e)) e.chain().focus().deleteSelection().run() }
function imgKey(ev) {
  if (!ev.altKey || !['ArrowUp', 'ArrowDown'].includes(ev.key) || !editor.value || !isImgSel(editor.value)) return false
  moveImg(ev.key === 'ArrowUp' ? -1 : 1)
  return true
}
const pickImg = e => { upload([...e.target.files]); e.target.value = '' }
async function upload(files) {
  uploading.value = true
  try {
    for (const f of files.slice(0, 6)) {
      const { blob } = await shrink(f, 1600, 0.8)
      const { src } = await postBlob('/api/activities-img', blob)
      editor.value?.chain().focus().insertContent({ type: 'image', attrs: { src, alt: '' } }).run()
    }
  } catch (e) { toast(e.message, 'error') } finally { uploading.value = false }
}
// заготовки по «!»: «!» в начале строки или после пробела, дальше — начало заготовки («Ура!» не трогаем)
const sug = ref(null)
const low = s => s.toLowerCase().replace(/ё/g, 'е')
function scanSug(e) {
  sug.value = null
  if (!props.snippets.length) return
  const { $from, empty } = e.state.selection
  if (!empty) return
  const mt = $from.parent.textBetween(0, $from.parentOffset, ' ', ' ').match(/(?:^|\s)!([\p{L}][\p{L} ]{0,24})?$/u)
  if (!mt) return
  const q = low(mt[1] || '')
  const items = props.snippets.filter(s => low(s).startsWith(q) || (q.length > 1 && low(s).includes(q)))
  if (!items.length || items.some(s => low(s).trim() === q.trim() && q)) return
  const c = e.view.coordsAtPos($from.pos), w = wrap.value.getBoundingClientRect()
  sug.value = { from: $from.pos - q.length - 1, to: $from.pos, q, items, i: 0, x: Math.max(0, Math.min(c.left - w.left, w.width - 220)), y: c.bottom - w.top + 4 }
}
function pickSug(i) {
  const e = editor.value, s = sug.value
  if (!e || !s) return
  e.view.dispatch(e.state.tr.insertText(s.items[i], s.from, s.to))
  sug.value = null
  e.commands.focus()
}
function sugKey(ev) {
  const s = sug.value
  if (!s) return false
  if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') { s.i = (s.i + (ev.key === 'ArrowDown' ? 1 : s.items.length - 1)) % s.items.length; return true }
  if (ev.key === 'Tab' || (ev.key === 'Enter' && s.q)) { ev.preventDefault(); pickSug(s.i); return true }
  if (ev.key === 'Escape') { sug.value = null; return true }
  return false
}
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
.ri { position: relative; min-width: 0; border-radius: 8px; border: 1px dashed color-mix(in srgb, var(--acc, #e7c56f) 22%, transparent); background: transparent; color: var(--ink, #efe3c8); transition: border-color .2s, background .2s; }
.ri-sug { position: absolute; z-index: 30; display: grid; min-width: 200px; padding: 4px; border-radius: 10px; border: 1px solid rgba(231, 197, 111, .45); background: #17120c; box-shadow: 0 12px 28px rgba(0, 0, 0, .6); }
.ri-sug button { display: flex; align-items: center; gap: 8px; justify-content: space-between; padding: 5px 9px; border: 0; border-radius: 7px; background: none; color: #efe3c8; font: 700 13px 'Manrope', sans-serif; text-align: left; cursor: pointer; }
.ri-sug button.on { background: rgba(231, 197, 111, .16); color: #f3dc9e; }
.ri-sug kbd { padding: 0 5px; border-radius: 4px; border: 1px solid rgba(231, 197, 111, .4); color: #a8936c; font: 800 10px 'Manrope', sans-serif; }
.ri-img { display: flex; align-items: center; gap: 8px; padding: 0 9px 6px; }
.ri-img small { color: #a8936c; font: 600 11px 'Manrope', sans-serif; }
.ri-imgbtn { padding: 3px 10px; border-radius: 8px; border: 1px dashed color-mix(in srgb, var(--acc, #e7c56f) 45%, transparent); color: var(--acc, #e7c56f); font: 700 12px 'Manrope', sans-serif; cursor: pointer; }
.ri-imgbtn.busy { opacity: .6; cursor: wait; }
.ri-imgmove { display: flex; align-items: center; gap: 4px; color: #a8936c; font: 700 11.5px 'Manrope', sans-serif; }
.ri-imgmove button { padding: 2px 8px; border-radius: 7px; border: 1px solid color-mix(in srgb, var(--acc, #e7c56f) 40%, transparent); background: color-mix(in srgb, var(--acc, #e7c56f) 10%, transparent); color: var(--acc, #e7c56f); font: 700 11.5px 'Manrope', sans-serif; cursor: pointer; }
.ri-imgmove button.del { color: #ff8f7f; border-color: rgba(255, 107, 94, .4); background: none; }
.ri-body :deep(.ProseMirror img) { display: block; max-width: min(100%, 360px); max-height: 240px; margin: 4px 0; border-radius: 8px; object-fit: contain; }
.ri-body :deep(.ProseMirror img.ProseMirror-selectednode) { outline: 2px solid var(--acc, #e7c56f); }
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
