<template>
  <!-- заставка события героя у всех на сайте: новый уровень, закрытая тренировка, расовый навык, смерть, стабилизация.
       Портрет, вспышка (Lottie), крупная надпись и звук; по щелчку или через несколько секунд исчезает -->
  <Teleport to="body">
    <transition name="hev">
      <div v-if="cur" :key="cur.key" class="hev" :class="cur.kind" :style="{ '--hc': color }" role="status" @click="next">
        <LottieFx class="hev-burst" :data="burstData" :size="220" />
        <div class="hev-card">
          <span class="hev-pic"><img v-if="cur.photo" :src="sheetImg(cur.photo)" alt="" /><template v-else>{{ (cur.name || '?')[0] }}</template></span>
          <div class="hev-txt">
            <small>{{ KIND[cur.kind]?.icon }} {{ cur.text }}</small>
            <b>{{ cur.name }}</b>
            <span class="hev-title">{{ cur.title }}</span>
          </div>
        </div>
        <router-link v-if="cur.sheetId" :to="`/sheets/${cur.sheetId}`" class="hev-go" @click.stop="next">к листу →</router-link>
      </div>
    </transition>
  </Teleport>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { wsListen } from '../../map/store.js'
import { sheetImg } from '../../sheets/sheetState.js'
import { sfx } from '../../sound/sound.js'
import LottieFx from '../../wiki/rules/LottieFx.vue'
import { burst } from '../../wiki/rules/lottie.js'
import { celebrate } from '../../wiki/rules/actFx.js'

const KIND = {
  level: { icon: '⬆', color: '#ffd166', sound: 'crit', party: true },
  train: { icon: '🏋', color: '#7ed07a', sound: 'crit', party: true },
  race: { icon: '🧬', color: '#7fb4ff', sound: 'notify' },
  stable: { icon: '✚', color: '#cfe8ff', sound: 'notify' },
  death: { icon: '☠', color: '#c0182b', sound: 'fail' }
}
const queue = []
const cur = ref(null)
let timer = 0
const color = computed(() => cur.value?.accent || KIND[cur.value?.kind]?.color || '#e7c56f')
const burstData = computed(() => burst(KIND[cur.value?.kind]?.color || '#ffd36b', 14))
function show(ev) {
  cur.value = { ...ev, key: ev.at + ev.kind }
  const k = KIND[ev.kind] || {}
  sfx(k.sound || 'notify', 0.55)
  if (k.party) setTimeout(() => celebrate(null, true), 250)
  clearTimeout(timer)
  timer = setTimeout(next, ev.kind === 'death' ? 6500 : 5200)
}
function next() {
  clearTimeout(timer)
  cur.value = null
  const ev = queue.shift()
  if (ev) setTimeout(() => show(ev), 350)
}
let off = null
onMounted(() => {
  off = wsListen(msg => {
    if (msg.type !== 'heroEvent' || document.hidden) return
    if (cur.value) queue.push(msg)
    else show(msg)
  })
})
onBeforeUnmount(() => { off?.(); clearTimeout(timer) })
</script>

<style scoped>
.hev { position: fixed; z-index: 850; top: 84px; left: 50%; transform: translateX(-50%); display: grid; justify-items: center; gap: 6px; cursor: pointer; }
.hev-burst { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -58%); pointer-events: none; }
.hev-card { position: relative; display: flex; align-items: center; gap: 14px; padding: 14px 22px 14px 14px; border-radius: 20px; background: linear-gradient(135deg, color-mix(in srgb, var(--hc) 22%, #1d1710), #120e09); border: 1.5px solid var(--hc); box-shadow: 0 0 0 4px rgba(0, 0, 0, .35), 0 0 40px color-mix(in srgb, var(--hc) 45%, transparent), 0 20px 50px rgba(0, 0, 0, .6); }
.hev-pic { display: grid; place-items: center; width: 64px; height: 64px; flex: none; border-radius: 50%; overflow: hidden; border: 2px solid var(--hc); background: #0e0b07; color: #f3dc9e; font: 700 28px 'Cormorant Garamond', serif; box-shadow: 0 0 18px color-mix(in srgb, var(--hc) 55%, transparent); }
.hev-pic img { width: 100%; height: 100%; object-fit: cover; }
.hev-txt { display: grid; }
.hev-txt small { color: color-mix(in srgb, var(--hc) 70%, #fff); font: 800 11px 'Manrope', sans-serif; letter-spacing: .12em; text-transform: uppercase; }
.hev-txt b { color: #f3dc9e; font: 700 24px 'Cormorant Garamond', serif; line-height: 1.1; }
.hev-title { color: #fff; font: 800 18px 'Manrope', sans-serif; text-shadow: 0 0 12px var(--hc); }
.hev-go { padding: 3px 10px; border-radius: 99px; background: rgba(0, 0, 0, .55); color: color-mix(in srgb, var(--hc) 70%, #fff); font: 800 12px 'Manrope', sans-serif; text-decoration: none; }
.hev.death .hev-card { background: linear-gradient(135deg, #3a0a10, #0c0606); animation: hev-shake .5s ease 2; }
.hev.death .hev-title { color: #ff8f8f; }
.hev-enter-active { animation: hev-in .6s cubic-bezier(.2, .9, .3, 1.35); }
.hev-leave-active { animation: hev-in .3s ease-in reverse; }
@keyframes hev-in { from { opacity: 0; transform: translate(-50%, -30px) scale(.7); } }
@keyframes hev-shake { 20% { transform: translateX(-6px); } 40% { transform: translateX(6px); } 60% { transform: translateX(-4px); } 80% { transform: translateX(3px); } }
@media (max-width: 520px) { .hev { top: 70px; width: calc(100vw - 24px); } .hev-card { width: 100%; box-sizing: border-box; } .hev-txt b { font-size: 20px; } }
@media (prefers-reduced-motion: reduce) { .hev-enter-active, .hev-leave-active, .hev.death .hev-card { animation: none; } }
</style>
