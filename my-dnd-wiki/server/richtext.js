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
