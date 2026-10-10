<template>
  <!-- текст с оформлением (HTML уже очищен сервером) или обычный текст с переносами; @-упоминания — ссылки -->
  <div v-if="isHtml" class="rt" @click="onClick" v-html="text" />
  <div v-else class="rt plain">{{ text }}</div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { mentionLink } from './mentions.js'

const props = defineProps({ text: { type: String, default: '' } })
const router = useRouter()
const isHtml = computed(() => /<[a-z][^>]*>/i.test(props.text || ''))
// щелчок по @Луна — к её листу (или к герою, городу, поселению)
function onClick(e) {
  const m = e.target.closest?.('span[data-type="mention"]')
  if (!m) return
  const to = mentionLink(m.getAttribute('data-id'))
  if (to) { e.preventDefault(); router.push(to) }
}
</script>

<style scoped>
.rt { line-height: 1.55; overflow-wrap: anywhere; }
.rt.plain { white-space: pre-line; }
.rt :deep(p) { margin: 0 0 .55em; }
.rt :deep(p:last-child) { margin-bottom: 0; }
.rt :deep(h3), .rt :deep(h4) { margin: .7em 0 .35em; font-family: 'Cormorant Garamond', serif; color: #e6c27a; }
.rt :deep(h3) { font-size: 1.25em; }
.rt :deep(h4) { font-size: 1.1em; }
.rt :deep(ul), .rt :deep(ol) { margin: .3em 0 .55em; padding-left: 1.3em; }
.rt :deep(blockquote) { margin: .5em 0; padding: .3em .8em; border-left: 3px solid rgba(231, 197, 111, .5); color: #cdbf9f; font-style: italic; }
.rt :deep(a) { color: #8fc7ff; }
.rt :deep(.mention) { padding: 0 4px; border-radius: 6px; background: rgba(231, 197, 111, .14); color: #f3d99a; font-weight: 700; cursor: pointer; white-space: nowrap; }
.rt :deep(.mention:hover) { background: rgba(231, 197, 111, .28); }
</style>
