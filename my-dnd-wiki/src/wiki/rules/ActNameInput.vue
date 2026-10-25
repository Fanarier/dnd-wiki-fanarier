<template>
  <!-- название деятельности с подсказками: твои прошлые записи и справочник из вики (по разделам). Ищет по любой части
       и по началу слов, без учёта регистра и «ё»; совпадение подсвечено. ↑↓ — выбрать, Enter — взять, Esc — закрыть -->
  <div ref="root" class="ani" @focusout="onBlur">
    <input :value="modelValue" class="af-in" :required="required" :maxlength="maxlength" :placeholder="placeholder" autocomplete="off"
           role="combobox" :aria-expanded="open" @input="onInput" @focus="open = true" @keydown="onKey" />
    <div v-if="open && groups.length" class="ani-pop" role="listbox">
      <template v-for="g in groups" :key="g.title">
        <div class="ani-g">{{ g.title }}</div>
        <button v-for="it in g.items" :key="g.title + it.name" type="button" class="ani-it" :class="{ on: it.i === hl }" role="option"
                @mousedown.prevent="pick(it)" @mouseenter="hl = it.i">
          <span class="ani-n"><template v-for="(p, k) in it.parts" :key="k"><mark v-if="p.hit">{{ p.s }}</mark><template v-else>{{ p.s }}</template></template></span>
          <small v-if="it.sub">{{ it.sub }}</small>
        </button>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' }, recent: { type: Array, default: () => [] }, catalog: { type: Array, default: () => [] },
  placeholder: { type: String, default: '' }, required: { type: Boolean, default: true }, maxlength: { type: Number, default: 600 },
  mineTitle: { type: String, default: 'Твои записи' }
})
const emit = defineEmits(['update:modelValue'])
const root = ref(null)
const open = ref(false)
const hl = ref(0)
const norm = s => String(s || '').toLowerCase().replace(/ё/g, 'е')

// насколько подходит: 0 — название начинается с запроса, 1 — все слова запроса находятся с начала слов, 2 — где угодно,
// 3 — нашлась часть слов
function score(name, q) {
  const n = norm(name)
  if (!q) return 4
  if (n.startsWith(q)) return 0
  const words = q.split(/\s+/).filter(Boolean)
  if (words.every(w => new RegExp('(^|[\\s(/:«"-])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(n))) return 1
  if (words.every(w => n.includes(w))) return 2
  // хоть одно слово (от 3 букв) нашлось — тоже предложим, но ниже
  if (words.some(w => w.length >= 3 && n.includes(w))) return 3
  return -1
}
// куски названия с подсветкой найденных слов
function partsOf(name, q) {
  const words = q.split(/\s+/).filter(Boolean)
  if (!words.length) return [{ s: name }]
  const n = norm(name), hit = new Array(name.length).fill(false)
  for (const w of words) { let i = n.indexOf(w); while (i >= 0) { for (let k = i; k < i + w.length; k++) hit[k] = true; i = n.indexOf(w, i + w.length) } }
  const out = []
  for (let i = 0; i < name.length; i++) {
    const last = out[out.length - 1]
    if (last && last.hit === hit[i]) last.s += name[i]
    else out.push({ s: name[i], hit: hit[i] })
  }
  return out
}

const groups = computed(() => {
  const q = norm(props.modelValue).trim()
  const take = (list, n) => list.map(x => ({ ...x, sc: score(x.name, q) })).filter(x => x.sc >= 0 && norm(x.name) !== q).sort((a, b) => a.sc - b.sc).slice(0, n)
  const mine = take(props.recent.map(x => (typeof x === 'string' ? { name: x, sub: '' } : x)), q ? 8 : 12)
  const known = new Set(mine.map(x => norm(x.name)))
  const wiki = take(props.catalog.filter(c => !known.has(norm(c.name))).map(c => ({ name: c.name, sub: `${c.dur} · ${c.rate} / ч`, section: c.section || 'Из вики' })), q ? 14 : 60)
  const out = []
  if (mine.length) out.push({ title: props.mineTitle, items: mine })
  // справочник — по разделам вики (без запроса — в порядке вики, с запросом — лучшие сверху одним списком)
  if (q && wiki.length) out.push({ title: 'Из вики', items: wiki.map(x => ({ ...x, sub: `${x.section} · ${x.sub}` })) })
  else for (const x of wiki) { const g = out.find(g => g.title === x.section) || (out.push({ title: x.section, items: [] }), out[out.length - 1]); g.items.push(x) }
  let i = 0
  for (const g of out) g.items = g.items.map(x => ({ ...x, i: i++, parts: partsOf(x.name, q) }))
  return out
})
const flat = computed(() => groups.value.flatMap(g => g.items))
watch(() => props.modelValue, () => { hl.value = 0 })

function onInput(e) { emit('update:modelValue', e.target.value); open.value = true }
function pick(it) { emit('update:modelValue', it.name); open.value = false }
function onKey(e) {
  if (!open.value && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { open.value = true; return }
  if (!open.value || !flat.value.length) return
  if (e.key === 'ArrowDown') { e.preventDefault(); hl.value = (hl.value + 1) % flat.value.length; scrollTo() }
  else if (e.key === 'ArrowUp') { e.preventDefault(); hl.value = (hl.value - 1 + flat.value.length) % flat.value.length; scrollTo() }
  else if (e.key === 'Enter' && flat.value[hl.value] && norm(props.modelValue).trim()) { e.preventDefault(); pick(flat.value[hl.value]) }
  else if (e.key === 'Escape') { e.stopPropagation(); open.value = false }
}
function scrollTo() { requestAnimationFrame(() => root.value?.querySelector('.ani-it.on')?.scrollIntoView({ block: 'nearest' })) }
function onBlur(e) { if (!root.value?.contains(e.relatedTarget)) open.value = false }
</script>

<style scoped>
.ani { position: relative; min-width: 0; }
.ani input { width: 100%; box-sizing: border-box; padding: 7px 9px; border-radius: 9px; border: 1px solid rgba(231, 197, 111, .25); background: rgba(0, 0, 0, .35); color: #efe3c8; font: 600 13px 'Manrope', sans-serif; letter-spacing: 0; text-transform: none; color-scheme: dark; }
.ani input:focus { outline: none; border-color: #e7c56f; }
.ani-pop { position: absolute; z-index: 60; left: 0; right: 0; top: calc(100% + 4px); max-height: min(380px, 55vh); overflow-y: auto; padding: 4px; border-radius: 12px; background: #17120c; border: 1px solid rgba(231, 197, 111, .4); box-shadow: 0 18px 40px rgba(0, 0, 0, .6); scrollbar-width: thin; }
.ani-g { position: sticky; top: -4px; z-index: 1; margin: 4px 0 2px; padding: 5px 8px 3px; background: #17120c; color: #a8936c; font: 800 10.5px 'Manrope', sans-serif; letter-spacing: .1em; text-transform: uppercase; }
.ani-it { display: flex; align-items: baseline; gap: 10px; width: 100%; padding: 6px 9px; border: 0; border-radius: 8px; background: none; color: #efe3c8; text-align: left; cursor: pointer; font: 600 13.5px 'Manrope', sans-serif; }
.ani-it.on { background: rgba(231, 197, 111, .14); }
.ani-n { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.ani-n mark { background: none; color: #ffcf7a; font-weight: 800; }
.ani-it small { flex: none; color: #a8936c; font-size: 11px; white-space: nowrap; }
@media (max-width: 600px) { .ani-it { flex-wrap: wrap; } .ani-it small { white-space: normal; } }
</style>
