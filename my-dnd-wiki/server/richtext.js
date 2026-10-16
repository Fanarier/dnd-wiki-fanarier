// Текст с оформлением (Tiptap на сайте): храним HTML, но пропускаем только безопасное —
// абзацы, жирный/курсив, заголовки, списки, цитаты и @-упоминания (span data-type="mention").
// Обычный текст без тегов остаётся как был — старые описания не ломаются.
import sanitizeHtml from 'sanitize-html'

const OPTS = {
  allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'h3', 'h4', 'ul', 'ol', 'li', 'blockquote', 'span', 'a'],
  allowedAttributes: {
    span: ['data-type', 'data-id', 'data-label', 'class'],
    a: ['href', 'target', 'rel']
  },
  allowedClasses: { span: ['mention'] },
  allowedSchemes: ['http', 'https'],
  allowProtocolRelative: false,
  transformTags: { a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer nofollow' }) }
}
const looksHtml = s => /<[a-z][^>]*>/i.test(s)

export function cleanRich(v, max = 20000) {
  const s = v == null ? '' : String(v).slice(0, max * 2)
  if (!looksHtml(s)) return s.slice(0, max)
  return sanitizeHtml(s, OPTS).slice(0, max)
}

// Правила (расы, классы, статьи вики): ещё таблицы, подчёркивание, выделение и цвет текста (только #rrggbb)
const RULES_OPTS = {
  allowedTags: [...OPTS.allowedTags, 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'mark', 'hr', 'h2', 'colgroup', 'col'],
  allowedAttributes: {
    ...OPTS.allowedAttributes,
    span: [...OPTS.allowedAttributes.span, 'style'],
    td: ['colspan', 'rowspan'], th: ['colspan', 'rowspan'], col: ['span'], mark: ['data-color']
  },
  allowedStyles: { span: { color: [/^#[0-9a-f]{6}$/i] } },
  allowedClasses: OPTS.allowedClasses,
  allowedSchemes: OPTS.allowedSchemes,
  allowProtocolRelative: false,
  transformTags: OPTS.transformTags
}
export function cleanRules(v, max = 400000) {
  const s = v == null ? '' : String(v).slice(0, max * 2)
  if (!looksHtml(s)) return s.slice(0, max)
  return sanitizeHtml(s, RULES_OPTS).slice(0, max)
}
