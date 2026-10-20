<template>
  <!-- анимация Lottie (собранная кодом в lottie.js) через dotLottie; движок и wasm грузятся при первом показе -->
  <canvas ref="cv" class="lfx" :width="size * 2" :height="size * 2" :style="{ width: size + 'px', height: size + 'px' }" aria-hidden="true" />
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({ data: { type: Object, required: true }, size: { type: Number, default: 80 }, loop: Boolean, play: { type: Number, default: 0 } })
const emit = defineEmits(['done'])
const cv = ref(null)
let player = null

// один раз: движок и его wasm — со своего сайта (с CDN не даст политика безопасности)
let engine = null
function loadEngine() {
  engine ||= Promise.all([import('@lottiefiles/dotlottie-web'), import('@lottiefiles/dotlottie-web/dotlottie-player.wasm?url')])
    .then(([m, w]) => { m.DotLottie.setWasmUrl(w.default); return m.DotLottie })
  return engine
}
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches
onMounted(async () => {
  try {
    const DotLottie = await loadEngine()
    if (!cv.value) return
    player = new DotLottie({ canvas: cv.value, data: props.data, loop: props.loop && !reduced(), autoplay: !reduced() })
    player.addEventListener('complete', () => emit('done'))
    if (reduced()) player.addEventListener('load', () => player.setFrame?.(player.totalFrames - 1))
  } catch (e) { console.warn('[lottie]', e); emit('done') }
})
// play — счётчик: увеличили — проиграть ещё раз
watch(() => props.play, () => { if (player) { player.stop(); player.play() } })
onBeforeUnmount(() => { player?.destroy(); player = null })
</script>

<style scoped>
.lfx { display: block; pointer-events: none; }
</style>
