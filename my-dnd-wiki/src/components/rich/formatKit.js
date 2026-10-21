// Полное форматирование текста для всех редакторов сайта (вики, листы, НПС, заказы, журнал деятельностей):
// любой цвет и фон, размер, шрифт, выравнивание, над/подстрочный, свечение, тень, обводка и «живой» текст
// (золото, магия, огонь, лёд, переливы, пульс, дрожь, спойлер), заливка ячеек таблиц.
// Что можно сохранить — решает сервер (server/richtext.js): те же списки шрифтов, размеров и эффектов.
import { Extension } from '@tiptap/core'
import { TextStyle, Color, BackgroundColor, FontSize, FontFamily } from '@tiptap/extension-text-style'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table'

export const FONTS = [
  { v: '', t: 'Обычный', css: "'Manrope', sans-serif" },
  { v: 'Cormorant Garamond', t: 'Книжный', css: "'Cormorant Garamond', serif" },
  { v: 'Marck Script', t: 'Рукописный', css: "'Marck Script', cursive" },
  { v: 'Old Standard TT', t: 'Старинный', css: "'Old Standard TT', serif" },
  { v: 'Ruslan Display', t: 'Декоративный', css: "'Ruslan Display', serif" }
]
export const SIZES = [
  { v: '', t: 'Обычный' }, { v: '11px', t: 'Мелкий' }, { v: '13px', t: 'Небольшой' }, { v: '17px', t: 'Крупный' },
  { v: '21px', t: 'Большой' }, { v: '26px', t: 'Огромный' }, { v: '34px', t: 'Гигантский' }
]
// палитра: читается на тёмном фоне, плюс «свой цвет» пипеткой
export const PALETTE = ['#ffffff', '#efe3c8', '#f3dc9e', '#e7c56f', '#f1c232', '#f0a24f', '#ff6b5e', '#e0446a', '#ef7fb0',
  '#c27bff', '#8d6cff', '#6fa8ff', '#4fc1c1', '#7ed07a', '#3fae5a', '#a8936c', '#8f8574', '#000000']
// живой текст — классы tx-* (src/components/rich/richfx.css)
export const FX = [
  { v: 'gold', t: 'Золото', hint: 'переливается золотом' }, { v: 'magic', t: 'Магия', hint: 'фиолетово-голубой перелив' },
  { v: 'rainbow', t: 'Радуга', hint: 'все цвета по кругу' }, { v: 'fire', t: 'Огонь', hint: 'пляшущее пламя' },
  { v: 'ice', t: 'Лёд', hint: 'холодное мерцание' }, { v: 'blood', t: 'Кровь', hint: 'тёмно-красный, медленно пульсирует' },
  { v: 'shimmer', t: 'Блик', hint: 'по тексту пробегает блик' }, { v: 'pulse', t: 'Пульс', hint: 'светится и гаснет' },
  { v: 'shake', t: 'Дрожь', hint: 'буквы дрожат' }, { v: 'spoiler', t: 'Спойлер', hint: 'скрыто, видно при наведении' }
]
export const FX_NAMES = FX.map(f => f.v)
// свечение и тени: цвет подставляется
export const GLOWS = [
  { v: 'soft', t: 'Мягкое свечение', make: c => `0 0 6px ${c}` },
  { v: 'strong', t: 'Сильное свечение', make: c => `0 0 4px ${c}, 0 0 12px ${c}` },
  { v: 'neon', t: 'Неон', make: c => `0 0 2px #ffffff, 0 0 8px ${c}, 0 0 18px ${c}` },
  { v: 'shadow', t: 'Тень', make: () => '2px 2px 3px #000000' },
  { v: 'outline', t: 'Обводка', make: c => `1px 0 0 ${c}, -1px 0 0 ${c}, 0 1px 0 ${c}, 0 -1px 0 ${c}` }
]

// свечение и «живой» текст — ещё два свойства у textStyle (как цвет и размер)
const TextFx = Extension.create({
  name: 'textFx',
  addGlobalAttributes() {
    return [{
      types: ['textStyle'],
      attributes: {
        glow: {
          default: null,
          parseHTML: el => el.style.textShadow || null,
          renderHTML: a => (a.glow ? { style: `text-shadow: ${a.glow}` } : {})
        },
        fx: {
          default: null,
          parseHTML: el => [...el.classList].find(c => c.startsWith('tx-'))?.slice(3) || null,
          renderHTML: a => (a.fx ? { class: 'tx-' + a.fx } : {})
        }
      }
    }]
  }
})
// заливка ячейки таблицы
const cellBg = {
  background: {
    default: null,
    parseHTML: el => el.style.backgroundColor || null,
    renderHTML: a => (a.background ? { style: `background-color: ${a.background}` } : {})
  }
}
const Cell = TableCell.extend({ addAttributes() { return { ...this.parent?.(), ...cellBg } } })
const Header = TableHeader.extend({ addAttributes() { return { ...this.parent?.(), ...cellBg } } })

// обычный textStyle узнаёт только <span style>, а у «живого» текста бывает один класс tx-* —
// без этого при повторном открытии эффект терялся и не сохранялся
const Styled = TextStyle.extend({
  parseHTML() {
    return [{ tag: 'span', consuming: false, getAttrs: el => (el.hasAttribute('style') || [...el.classList].some(c => c.startsWith('tx-')) ? {} : false) }]
  }
})

// набор расширений редактора; tables — ещё и таблицы
export function formatExtensions({ tables = false } = {}) {
  return [
    Styled, Color, BackgroundColor, FontSize, FontFamily, TextFx,
    Highlight.configure({ multicolor: true }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Subscript, Superscript,
    ...(tables ? [Table.configure({ resizable: false }), TableRow, Cell, Header] : [])
  ]
}

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
export const looksHtml = s => /<[a-z][^>]*>/i.test(String(s || ''))
// старый простой текст → абзацы (переносы строк сохраняются)
export const plainToHtml = s => (looksHtml(s) ? s : String(s || '').split('\n').map(l => `<p>${esc(l)}</p>`).join(''))
