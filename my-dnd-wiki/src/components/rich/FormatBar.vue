<template>
  <!-- панель форматирования (одна на все редакторы): начертание, цвет и фон, свечение и тени, живой текст,
       размер и шрифт, выравнивание, списки и заголовки, таблицы с заливкой ячеек -->
  <div v-if="editor" class="fb" @mousedown.prevent>
    <div class="fb-row">
      <button type="button" :class="{ on: is('bold') }" class="b" title="Жирный (Ctrl+B)" @click="x().toggleBold().run()">Ж</button>
      <button type="button" :class="{ on: is('italic') }" class="i" title="Курсив (Ctrl+I)" @click="x().toggleItalic().run()">К</button>
      <button type="button" :class="{ on: is('underline') }" class="u" title="Подчёркнутый (Ctrl+U)" @click="x().toggleUnderline().run()">Ч</button>
      <button type="button" :class="{ on: is('strike') }" class="s" title="Зачёркнутый" @click="x().toggleStrike().run()">З</button>
      <button type="button" :class="{ on: is('superscript') }" title="Надстрочный" @click="x().toggleSuperscript().run()">x²</button>
      <button type="button" :class="{ on: is('subscript') }" title="Подстрочный" @click="x().toggleSubscript().run()">x₂</button>
      <i class="fb-sep" />
      <button type="button" class="fb-pick" :class="{ on: menu === 'color' }" title="Цвет текста" @click="toggle('color')"><b class="fb-a" :style="{ color: style.color || '#efe3c8' }">А</b><i class="fb-bar" :style="{ background: style.color || 'transparent' }" />▾</button>
      <button type="button" class="fb-pick" :class="{ on: menu === 'bg' }" title="Фон текста (маркер)" @click="toggle('bg')"><b class="fb-a" :style="{ background: mark || 'rgba(0,220,230,.25)' }">ab</b>▾</button>
      <button type="button" class="fb-pick" :class="{ on: menu === 'glow' || style.glow }" title="Свечение, тень, обводка" @click="toggle('glow')"><b class="fb-a glow">✦</b>▾</button>
      <button type="button" class="fb-pick" :class="{ on: menu === 'fx' || style.fx }" title="Живой текст: золото, магия, огонь, лёд, спойлер…" @click="toggle('fx')"><b class="fb-a tx-gold">Зл</b>▾</button>
      <i class="fb-sep" />
      <button type="button" class="fb-pick" :class="{ on: menu === 'size' || style.fontSize }" title="Размер" @click="toggle('size')">Aa▾</button>
      <button type="button" class="fb-pick" :class="{ on: menu === 'font' || style.fontFamily }" title="Шрифт" @click="toggle('font')">𝔉▾</button>
      <i class="fb-sep" />
      <button v-for="a in ALIGN" :key="a.v" type="button" :class="{ on: editor.isActive({ textAlign: a.v }) }" :title="a.t" @click="x().setTextAlign(a.v).run()">{{ a.i }}</button>
      <i class="fb-sep" />
      <template v-if="headings">
        <button type="button" :class="{ on: is('heading', { level: headings[0] }) }" title="Заголовок" @click="x().toggleHeading({ level: headings[0] }).run()">H1</button>
        <button type="button" :class="{ on: is('heading', { level: headings[1] }) }" title="Подзаголовок" @click="x().toggleHeading({ level: headings[1] }).run()">H2</button>
      </template>
      <button type="button" :class="{ on: is('bulletList') }" title="Список" @click="x().toggleBulletList().run()">•</button>
      <button type="button" :class="{ on: is('orderedList') }" title="Нумерованный список" @click="x().toggleOrderedList().run()">1.</button>
      <button type="button" :class="{ on: is('blockquote') }" title="Цитата" @click="x().toggleBlockquote().run()">❝</button>
      <template v-if="tables">
        <i class="fb-sep" />
        <template v-if="inTable">
          <button type="button" title="Строка ниже" @click="x().addRowAfter().run()">＋стр</button>
          <button type="button" title="Столбец правее" @click="x().addColumnAfter().run()">＋стб</button>
          <button type="button" title="Удалить строку" @click="x().deleteRow().run()">−стр</button>
          <button type="button" title="Удалить столбец" @click="x().deleteColumn().run()">−стб</button>
          <button type="button" title="Объединить / разделить ячейки" @click="x().mergeOrSplit().run()">⊞</button>
          <button type="button" class="fb-pick" :class="{ on: menu === 'cell' }" title="Заливка ячейки" @click="toggle('cell')">▣▾</button>
          <button type="button" class="danger" title="Удалить таблицу" @click="x().deleteTable().run()">✕табл</button>
        </template>
        <button v-else type="button" title="Вставить таблицу 3×3" @click="x().insertTable({ rows: 3, cols: 3, withHeaderRow: false }).run()">▦</button>
      </template>
      <slot />
      <span class="grow" />
      <button type="button" title="Убрать оформление выделенного" @click="x().unsetAllMarks().run()">⌫</button>
      <button type="button" title="Отменить (Ctrl+Z)" @click="x().undo().run()">↶</button>
      <button type="button" title="Повторить" @click="x().redo().run()">↷</button>
    </div>

    <!-- выпадающие панели -->
    <div v-if="menu" class="fb-menu">
      <template v-if="menu === 'color' || menu === 'bg' || menu === 'cell'">
        <span class="fb-h">{{ menu === 'color' ? 'Цвет текста' : menu === 'bg' ? 'Фон текста' : 'Заливка ячейки' }}</span>
        <div class="fb-sw">
          <button v-for="c in PALETTE" :key="c" type="button" :style="{ background: c }" :title="c" @click="applyColor(c)" />
          <label class="fb-own" title="Свой цвет"><input type="color" :value="ownColor" @input="ownColor = $event.target.value" @change="applyColor($event.target.value)" />🎨</label>
          <button type="button" class="fb-none" title="Убрать" @click="applyColor('')">⌀</button>
        </div>
        <small v-if="menu === 'bg'" class="fb-tip">Для заливки всей ячейки таблицы — «▣» в инструментах таблицы.</small>
      </template>
      <template v-else-if="menu === 'glow'">
        <span class="fb-h">Свечение, тень, обводка — цвет:</span>
        <div class="fb-sw small">
          <button v-for="c in PALETTE" :key="c" type="button" :style="{ background: c }" :class="{ on: glowColor === c }" @click="glowColor = c" />
          <label class="fb-own"><input type="color" :value="glowColor" @input="glowColor = $event.target.value" />🎨</label>
        </div>
        <div class="fb-list">
          <button v-for="g in GLOWS" :key="g.v" type="button" :style="{ textShadow: g.make(glowColor) }" @click="setStyle({ glow: g.make(glowColor) })">{{ g.t }}</button>
          <button type="button" class="fb-none" @click="setStyle({ glow: null })">Убрать</button>
        </div>
      </template>
      <template v-else-if="menu === 'fx'">
        <span class="fb-h">Живой текст</span>
        <div class="fb-list">
          <button v-for="f in FX" :key="f.v" type="button" :title="f.hint" @click="setStyle({ fx: f.v })"><span :class="'tx-' + f.v">{{ f.t }}</span></button>
          <button type="button" class="fb-none" @click="setStyle({ fx: null })">Убрать</button>
        </div>
      </template>
      <template v-else-if="menu === 'size'">
        <div class="fb-list">
          <button v-for="z in SIZES" :key="z.v" type="button" :class="{ on: (style.fontSize || '') === z.v }" :style="{ fontSize: z.v || '13px' }" @click="z.v ? x().setFontSize(z.v).run() : x().unsetFontSize().run(); menu = ''">{{ z.t }}</button>
        </div>
      </template>
      <template v-else-if="menu === 'font'">
        <div class="fb-list">
          <button v-for="f in FONTS" :key="f.v" type="button" :class="{ on: (style.fontFamily || '').includes(f.v || '§') || (!f.v && !style.fontFamily) }" :style="{ fontFamily: f.css, fontSize: '15px' }" @click="f.v ? x().setFontFamily(f.v).run() : x().unsetFontFamily().run(); menu = ''">{{ f.t }}</button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { FONTS, SIZES, PALETTE, FX, GLOWS } from './formatKit.js'

const props = defineProps({ editor: { type: Object, default: null }, tables: Boolean, headings: { type: Array, default: null } })
const ALIGN = [{ v: 'left', i: '⇤', t: 'По левому краю' }, { v: 'center', i: '≡', t: 'По центру' }, { v: 'right', i: '⇥', t: 'По правому краю' }, { v: 'justify', i: '☰', t: 'По ширине' }]
const x = () => props.editor.chain().focus()
const is = (n, a) => props.editor?.isActive(n, a)
const inTable = computed(() => !!props.editor && (props.editor.isActive('table') || props.editor.isActive('tableCell') || props.editor.isActive('tableHeader')))
// текущее оформление под курсором — чтобы кнопки показывали, что включено
const style = computed(() => (props.editor ? props.editor.getAttributes('textStyle') : {}))
const mark = computed(() => (props.editor ? props.editor.getAttributes('highlight').color : ''))
const menu = ref('')
const toggle = m => { menu.value = menu.value === m ? '' : m }
const ownColor = ref('#e7c56f')
const glowColor = ref('#e7c56f')

function applyColor(c) {
  if (menu.value === 'color') c ? x().setColor(c).run() : x().unsetColor().run()
  else if (menu.value === 'bg') c ? x().setHighlight({ color: c }).run() : x().unsetHighlight().run()
  else if (menu.value === 'cell') x().setCellAttribute('background', c || null).run()
  menu.value = ''
}
// свечение и живой текст — свойства textStyle; убрали всё — пустой span не остаётся
function setStyle(attrs) {
  x().setMark('textStyle', attrs).removeEmptyTextStyle().run()
  menu.value = ''
}
</script>

<style scoped>
.fb { position: sticky; top: 0; z-index: 3; background: #0f0c08; border-bottom: 1px solid rgba(231, 197, 111, .15); border-radius: 10px 10px 0 0; }
.fb-row { display: flex; flex-wrap: wrap; align-items: center; gap: 2px; padding: 4px; }
.fb-row button { min-width: 26px; height: 26px; padding: 0 6px; border: 0; border-radius: 6px; background: none; color: #cdbf9f; font: 700 12px 'Manrope', sans-serif; cursor: pointer; white-space: nowrap; }
.fb-row button:hover { background: rgba(231, 197, 111, .1); color: #f3d99a; }
.fb-row button.on { background: rgba(231, 197, 111, .22); color: #f3dc9e; }
.fb-row .b { font-weight: 900; } .fb-row .i { font-style: italic; } .fb-row .u { text-decoration: underline; } .fb-row .s { text-decoration: line-through; }
.fb-row .danger { color: #ff9b8f; }
.fb-sep { width: 1px; height: 18px; margin: 0 3px; background: rgba(231, 197, 111, .2); }
.grow { flex: 1; }
.fb-pick { display: inline-flex; align-items: center; gap: 2px; position: relative; }
.fb-a { display: inline-block; min-width: 16px; padding: 0 2px; border-radius: 3px; font: 900 13px 'Manrope', sans-serif; line-height: 18px; text-align: center; }
.fb-a.glow { color: #fff4c8; text-shadow: 0 0 6px #e7c56f; }
.fb-bar { position: absolute; left: 6px; right: 14px; bottom: 2px; height: 3px; border-radius: 2px; }
.fb-menu { display: grid; gap: 6px; padding: 8px; border-top: 1px solid rgba(231, 197, 111, .12); background: #15110b; animation: fb-in .15s ease; }
@keyframes fb-in { from { opacity: 0; transform: translateY(-3px); } }
.fb-h { color: #a8936c; font: 800 10.5px 'Manrope', sans-serif; letter-spacing: .08em; text-transform: uppercase; }
.fb-sw { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
.fb-sw > button { width: 22px; height: 22px; padding: 0; border-radius: 6px; border: 1px solid rgba(255, 255, 255, .2); cursor: pointer; }
.fb-sw.small > button { width: 18px; height: 18px; }
.fb-sw > button.on { outline: 2px solid #f3dc9e; outline-offset: 1px; }
.fb-own { position: relative; display: grid; place-items: center; width: 26px; height: 22px; border-radius: 6px; border: 1px dashed rgba(231, 197, 111, .5); cursor: pointer; font-size: 12px; }
.fb-own input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.fb-none { color: #ff9b8f !important; }
.fb-sw .fb-none { background: none; border: 1px dashed rgba(255, 122, 107, .5); font-size: 12px; }
.fb-list { display: flex; flex-wrap: wrap; gap: 4px; }
.fb-list button { padding: 4px 10px; border-radius: 8px; border: 1px solid rgba(231, 197, 111, .2); background: rgba(0, 0, 0, .25); color: #efe3c8; font: 700 13px 'Manrope', sans-serif; cursor: pointer; }
.fb-list button:hover, .fb-list button.on { border-color: #e7c56f; background: rgba(231, 197, 111, .12); }
.fb-tip { color: #7d7160; font: 600 11px 'Manrope', sans-serif; }
</style>
