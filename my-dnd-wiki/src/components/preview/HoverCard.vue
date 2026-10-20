<template>
  <!-- превью при наведении (одно на весь сайт): @-упоминания и названия из вики в тексте — карточка с картинкой,
       подписью и началом описания; «Открыть →» ведёт на страницу. На телефоне — по касанию -->
  <Teleport to="body">
    <transition name="hc">
      <div v-if="card" ref="box" class="hc" :style="pos" :class="{ up: flip }" @mouseenter="keep" @mouseleave="hideSoon">
        <span class="hc-glow" :style="{ '--hc': card.color || '#e7c56f' }" />
        <header>
          <span class="hc-pic" :style="{ '--hc': card.color || '#e7c56f' }"><img v-if="card.img" :src="card.img" alt="" /><template v-else>{{ card.icon || card.title[0] }}</template></span>
          <div>
            <small>{{ card.kind }}</small>
            <b>{{ card.title }}</b>
            <em v-if="card.sub">{{ card.sub }}</em>
          </div>
        </header>
        <p v-if="card.text">{{ card.text }}</p>
        <router-link v-if="card.to" :to="card.to" class="hc-go" @click="hide">Открыть →</router-link>
      </div>
    </transition>
  </Teleport>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { resolve, ensureData } from './previewData.js'

const card = ref(null)
const pos = ref({})
const flip = ref(false)
const box = ref(null)
let showT = 0, hideT = 0, cur = null
const refOf = el => el?.closest?.('[data-pv]')?.getAttribute('data-pv') || el?.closest?.('.mention[data-id], span[data-type="mention"][data-id]')?.getAttribute('data-id') || null
const anchorOf = el => el.closest('[data-pv]') || el.closest('[data-type="mention"], .mention')

function place(a) {
  const r = a.getBoundingClientRect()
  const w = Math.min(320, innerWidth - 16)
  flip.value = r.bottom + 230 > innerHeight && r.top > 230
  pos.value = { left: Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px', [flip.value ? 'bottom' : 'top']: (flip.value ? innerHeight - r.top + 8 : r.bottom + 8) + 'px', width: w + 'px' }
}
function show(a, ref, delay) {
  clearTimeout(hideT)
  clearTimeout(showT)
  ensureData()
  showT = setTimeout(() => {
    const c = resolve(ref)
    if (!c) return
    cur = a
    place(a)
    card.value = c
  }, delay)
}
const hide = () => { clearTimeout(showT); card.value = null; cur = null }
const hideSoon = () => { clearTimeout(showT); hideT = setTimeout(hide, 160) }
const keep = () => clearTimeout(hideT)

function over(e) {
  if (matchMedia('(hover: none)').matches) return
  const ref = refOf(e.target)
  if (!ref) return
  const a = anchorOf(e.target)
  if (a === cur && card.value) { keep(); return }
  show(a, ref, 260)
}
function out(e) {
  if (!refOf(e.target)) return
  if (box.value?.contains(e.relatedTarget) || anchorOf(e.target)?.contains(e.relatedTarget)) return
  hideSoon()
}
// касание: по названию из вики — карточка (упоминания и так ведут на страницу)
function tap(e) {
  if (box.value?.contains(e.target)) return
  const a = e.target.closest?.('.pv-term[data-pv]')
  if (a && matchMedia('(hover: none)').matches) { e.preventDefault(); show(a, a.getAttribute('data-pv'), 0); return }
  if (card.value) hide()
}
onMounted(() => { document.addEventListener('mouseover', over); document.addEventListener('mouseout', out); document.addEventListener('click', tap, true); addEventListener('scroll', hide, { passive: true, capture: true }) })
onBeforeUnmount(() => { document.removeEventListener('mouseover', over); document.removeEventListener('mouseout', out); document.removeEventListener('click', tap, true); removeEventListener('scroll', hide, { capture: true }) })
</script>

<style>
/* названия из вики в тексте — с пунктиром: на них есть превью */
.pv-term { border-bottom: 1px dotted currentColor; cursor: help; }
.pv-term:hover { color: #f3dc9e; }
</style>

<style scoped>
.hc { position: fixed; z-index: 800; display: grid; gap: 8px; padding: 12px; border-radius: 14px; background: linear-gradient(180deg, #1f1912, #14100b); border: 1px solid rgba(231, 197, 111, .4); box-shadow: 0 18px 44px rgba(0, 0, 0, .6); color: #efe3c8; overflow: hidden; }
.hc-glow { position: absolute; inset: -40% -20% auto; height: 120px; background: radial-gradient(closest-side, color-mix(in srgb, var(--hc) 30%, transparent), transparent); pointer-events: none; }
.hc header { position: relative; display: flex; gap: 10px; align-items: center; }
.hc header > div { display: grid; min-width: 0; }
.hc-pic { display: grid; place-items: center; flex: none; width: 48px; height: 48px; border-radius: 12px; overflow: hidden; border: 1.5px solid var(--hc); background: #0e0b07; color: #f3dc9e; font: 700 22px 'Cormorant Garamond', serif; box-shadow: 0 0 14px color-mix(in srgb, var(--hc) 35%, transparent); }
.hc-pic img { width: 100%; height: 100%; object-fit: cover; }
.hc small { color: #a8936c; font: 800 10px 'Manrope', sans-serif; letter-spacing: .1em; text-transform: uppercase; }
.hc b { font: 700 19px 'Cormorant Garamond', serif; color: #f3dc9e; line-height: 1.15; }
.hc em { color: #cdbf9f; font: 600 11.5px 'Manrope', sans-serif; font-style: normal; }
.hc p { position: relative; margin: 0; color: #ddd0b3; font: 500 12.5px/1.5 'Manrope', sans-serif; }
.hc-go { position: relative; justify-self: end; color: #e7c56f; font: 800 12px 'Manrope', sans-serif; text-decoration: none; }
.hc-go:hover { text-decoration: underline; }
.hc-enter-active, .hc-leave-active { transition: opacity .16s, transform .16s; }
.hc-enter-from, .hc-leave-to { opacity: 0; transform: translateY(4px) scale(.98); }
.hc.up.hc-enter-from { transform: translateY(-4px) scale(.98); }
</style>
