// Текст с оформлением (Tiptap на сайте): храним HTML, но пропускаем только безопасное —
// абзацы, начертание, заголовки, списки, цитаты, @-упоминания (span data-type="mention") и оформление из
// src/components/rich/formatKit.js: цвет и фон (#hex или rgb — так их отдаёт браузер), размер, шрифт из списка,
// свечение/тень (text-shadow из теней), выравнивание, «живой» текст (классы tx-*), заливка ячеек таблиц.
// Обычный текст без тегов остаётся как был — старые описания не ломаются.
import sanitizeHtml from 'sanitize-html'

const COLOR = '(?:#[0-9a-f]{3,8}|rgba?\\(\\s*\\d{1,3}\\s*,\\s*\\d{1,3}\\s*,\\s*\\d{1,3}\\s*(?:,\\s*(?:0|1|0?\\.\\d+)\\s*)?\\))'
const LEN = '-?\\d{1,3}(?:\\.\\d+)?(?:px)?'
const SHADOW = `(?:${COLOR}\\s+${LEN}\\s+${LEN}(?:\\s+${LEN})?|${LEN}\\s+${LEN}(?:\\s+${LEN})?\\s+${COLOR})`
const COLOR_RE = new RegExp(`^${COLOR}$`, 'i')
const SHADOW_RE = new RegExp(`^${SHADOW}(?:\\s*,\\s*${SHADOW}){0,4}$`, 'i')
const SIZE_RE = /^\d{1,2}(?:\.\d+)?(?:px|em|rem)$/
const FONT_RE = /^["']?(Manrope|Cormorant Garamond|Marck Script|Old Standard TT|Ruslan Display)["']?$/i
const ALIGN = [/^(left|center|right|justify)$/]
const textStyles = { color: [COLOR_RE], 'background-color': [COLOR_RE], 'font-size': [SIZE_RE], 'font-family': [FONT_RE], 'text-shadow': [SHADOW_RE] }

const OPTS = {
  allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup', 'h3', 'h4', 'ul', 'ol', 'li', 'blockquote', 'span', 'a', 'mark',
    'table', 'thead', 'tbody', 'tr', 'td', 'th'],
  allowedAttributes: {
    span: ['data-type', 'data-id', 'data-label', 'class', 'style'],
    a: ['href', 'target', 'rel'],
    mark: ['data-color', 'style'],
    p: ['style'], h2: ['style'], h3: ['style'], h4: ['style'],
    td: ['colspan', 'rowspan', 'style'], th: ['colspan', 'rowspan', 'style']
  },
  allowedStyles: {
    span: textStyles,
    mark: { 'background-color': [COLOR_RE], color: [COLOR_RE, /^inherit$/] },
    p: { 'text-align': ALIGN }, h2: { 'text-align': ALIGN }, h3: { 'text-align': ALIGN }, h4: { 'text-align': ALIGN },
    td: { 'background-color': [COLOR_RE] }, th: { 'background-color': [COLOR_RE] }
  },
  allowedClasses: { span: ['mention', 'tx-*'] },
  allowedSchemes: ['http', 'https'],
  allowProtocolRelative: false,
  transformTags: { a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer nofollow' }) }
}
export const looksHtml = s => /<[a-z][^>]*>/i.test(s)

// фото в тексте (журнал деятельностей): только свои, загруженные на сайт (/act-img/…)
const ACT_IMG_RE = /^\/act-img\/[a-f0-9]{24}\.(webp|jpg|png|gif)$/
const IMG_OPTS = {
  ...OPTS,
  allowedTags: [...OPTS.allowedTags, 'img'],
  allowedAttributes: { ...OPTS.allowedAttributes, img: ['src', 'alt'] },
  exclusiveFilter: f => f.tag === 'img' && !ACT_IMG_RE.test(f.attribs.src || '')
}
export function cleanRich(v, max = 20000, { images = false } = {}) {
  const s = v == null ? '' : String(v).slice(0, max * 2)
  if (!looksHtml(s)) return s.slice(0, max)
  return sanitizeHtml(s, images ? IMG_OPTS : OPTS).slice(0, max)
}

// Правила (расы, классы, статьи вики): то же и ещё линия, h2, ширины колонок
const RULES_OPTS = {
  ...OPTS,
  allowedTags: [...OPTS.allowedTags, 'hr', 'h2', 'colgroup', 'col'],
  allowedAttributes: { ...OPTS.allowedAttributes, col: ['span'] }
}
export function cleanRules(v, max = 400000) {
  const s = v == null ? '' : String(v).slice(0, max * 2)
  if (!looksHtml(s)) return s.slice(0, max)
  return sanitizeHtml(s, RULES_OPTS).slice(0, max)
}
