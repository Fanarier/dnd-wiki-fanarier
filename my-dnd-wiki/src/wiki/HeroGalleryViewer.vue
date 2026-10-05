<template>
  <teleport to="body">
    <div class="gv" @click.self="$emit('close')" @touchstart.passive="tStart" @touchend="tEnd">
      <!-- размытая подложка из текущего арта -->
      <transition name="gv-bg">
        <div :key="cur.id" class="gv-bg" :style="{ backgroundImage: `url(${heroPortraitUrl(cur.thumb || cur.file)})` }" />
      </transition>

      <div class="gv-stage" @click.self="$emit('close')">
        <transition :name="dir > 0 ? 'gv-next' : 'gv-prev'">
          <img :key="cur.id" :src="heroPortraitUrl(cur.file)" class="gv-img" alt="" @click.stop="step(1)" />
        </transition>
      </div>

      <div class="gv-top">
        <span class="gv-name">{{ name }}</span>
        <span v-if="arts.length > 1" class="gv-count">{{ i + 1 }} / {{ arts.length }}</span>
        <span class="grow" />
        <a :href="heroPortraitUrl(cur.file)" :download="`${name || 'art'}-${i + 1}${cur.file.slice(cur.file.lastIndexOf('.'))}`" class="gv-dl" @click.stop>Скачать</a>
        <button class="gv-x" aria-label="Закрыть" @click="$emit('close')">×</button>
      </div>

      <template v-if="arts.length > 1">
        <button class="gv-nav prev" aria-label="Предыдущий" @click.stop="step(-1)">‹</button>
        <button class="gv-nav next" aria-label="Следующий" @click.stop="step(1)">›</button>
        <div ref="strip" class="gv-strip" @click.stop>
          <button v-for="(a, n) in arts" :key="a.id" class="gv-th" :class="{ on: n === i }" @click="go(n)">
            <img :src="heroPortraitUrl(a.thumb || a.file)" alt="" />
          </button>
        </div>
      </template>
    </div>
  </teleport>
</template>

<script setup>
// Арты карточки на весь экран: листание стрелками, клавишами, свайпом и по ленте миниатюр
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { heroPortraitUrl } from '../map/store.js'

const props = defineProps({
  arts: { type: Array, required: true },
  start: { type: Number, default: 0 },
  name: { type: String, default: '' }
})
const emit = defineEmits(['close'])

const i = ref(Math.min(props.start, props.arts.length - 1))
const dir = ref(1)
const cur = computed(() => props.arts[i.value] || props.arts[0])
const strip = ref(null)
async function show(n) {
  i.value = (n + props.arts.length) % props.arts.length
  await nextTick()
  strip.value?.children[i.value]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
}
const go = n => { dir.value = n >= i.value ? 1 : -1; show(n) }
const step = d => { if (props.arts.length > 1) { dir.value = d; show(i.value + d) } }

function onKey(e) {
  if (e.key === 'Escape') emit('close')
  else if (e.key === 'ArrowRight') step(1)
  else if (e.key === 'ArrowLeft') step(-1)
}
let tx = null
const tStart = e => { tx = e.touches[0].clientX }
function tEnd(e) {
  if (tx === null) return
  const dx = e.changedTouches[0].clientX - tx
  tx = null
  if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1)
}
onMounted(() => {
  window.addEventListener('keydown', onKey)
  document.body.style.overflow = 'hidden'
  nextTick(() => strip.value?.children[i.value]?.scrollIntoView({ inline: 'center', block: 'nearest' }))
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  document.body.style.overflow = ''
})
</script>

<style scoped>
.gv { position: fixed; inset: 0; z-index: 210; overflow: hidden; background: #070504; animation: gv-in .25s; font-family: 'Manrope', sans-serif; }
.gv-bg { position: absolute; inset: -60px; background-size: cover; background-position: center; filter: blur(40px) brightness(.35) saturate(1.3); transform: scale(1.1); }
.gv-bg-enter-active, .gv-bg-leave-active { transition: opacity .6s; }
.gv-bg-enter-from, .gv-bg-leave-to { opacity: 0; }
.gv-stage { position: absolute; inset: 56px 70px 104px; display: grid; place-items: center; }
.gv-img { grid-area: 1 / 1; max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 8px; background: #120e09; box-shadow: 0 0 0 1px rgba(201, 162, 79, .4), 0 30px 80px rgba(0, 0, 0, .8); cursor: pointer; }
.gv-next-enter-active, .gv-next-leave-active, .gv-prev-enter-active, .gv-prev-leave-active { transition: transform .45s cubic-bezier(.2, .8, .2, 1), opacity .45s; }
.gv-next-enter-from { opacity: 0; transform: translateX(80px) rotate(2deg) scale(.96); }
.gv-next-leave-to { opacity: 0; transform: translateX(-80px) rotate(-2deg) scale(.96); }
.gv-prev-enter-from { opacity: 0; transform: translateX(-80px) rotate(-2deg) scale(.96); }
.gv-prev-leave-to { opacity: 0; transform: translateX(80px) rotate(2deg) scale(.96); }
.gv-top { position: absolute; top: 0; left: 0; right: 0; display: flex; align-items: center; gap: 12px; padding: 10px 16px; background: linear-gradient(180deg, rgba(0, 0, 0, .55), transparent); }
.gv-name { font: 700 24px 'Cormorant Garamond', Georgia, serif; color: #f3d99a; text-shadow: 0 2px 8px #000; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gv-count { color: #c9b88f; font-size: 13px; font-weight: 700; }
.grow { flex: 1; }
.gv-dl { color: #f3d99a; font-weight: 800; font-size: 13px; }
.gv-x { border: 0; background: none; color: #efe3c8; font-size: 38px; line-height: 1; cursor: pointer; }
.gv-nav { position: absolute; top: 50%; transform: translateY(-50%); width: 50px; height: 50px; border-radius: 50%; border: 1px solid rgba(201, 162, 79, .5); background: rgba(20, 15, 10, .7); color: #f3d99a; font-size: 32px; line-height: 1; cursor: pointer; transition: background .2s, transform .2s; }
.gv-nav:hover { background: rgba(201, 162, 79, .25); transform: translateY(-50%) scale(1.08); }
.prev { left: 12px; } .next { right: 12px; }
.gv-strip { position: absolute; left: 0; right: 0; bottom: 14px; display: flex; gap: 8px; padding: 6px 16px; overflow-x: auto; scrollbar-width: none; justify-content: safe center; }
.gv-strip::-webkit-scrollbar { display: none; }
.gv-th { flex: none; width: 64px; height: 76px; padding: 0; border-radius: 8px; overflow: hidden; border: 2px solid transparent; background: #120e09; cursor: pointer; opacity: .55; transition: opacity .2s, transform .2s, border-color .2s; }
.gv-th img { width: 100%; height: 100%; object-fit: cover; }
.gv-th:hover { opacity: .9; }
.gv-th.on { opacity: 1; border-color: #e6c27a; transform: translateY(-4px); box-shadow: 0 6px 16px rgba(0, 0, 0, .6); }
@keyframes gv-in { from { opacity: 0; } }
@media (max-width: 640px) {
  .gv-stage { inset: 52px 0 100px; }
  .gv-img { border-radius: 0; }
  .gv-nav { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .gv-next-enter-active, .gv-next-leave-active, .gv-prev-enter-active, .gv-prev-leave-active, .gv-bg-enter-active, .gv-bg-leave-active { transition: none; }
}
</style>
