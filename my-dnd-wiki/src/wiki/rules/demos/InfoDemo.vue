<template>
  <!-- проигрыватель примера в «ⓘ»: шаги сменяются сами по кругу, под сценой — подпись шага; можно поставить на паузу,
       листать шаги и начать заново. В сцену отдаётся номер шага и сколько мс он уже идёт (t) — для печати текста и т. п. -->
  <div class="dm">
    <div class="dm-stage"><slot :step="step" :t="t" /></div>
    <div class="dm-bar">
      <button type="button" :title="playing ? 'Пауза' : 'Играть'" @click="toggle">{{ playing ? '⏸' : '▶' }}</button>
      <button type="button" title="Шаг назад" :disabled="step === 0" @click="go(step - 1)">‹</button>
      <span class="dm-dots"><i v-for="(s, i) in steps" :key="i" :class="{ on: i === step, past: i < step }" :title="s.t" @click="go(i)" /></span>
      <button type="button" title="Шаг вперёд" @click="go(step + 1)">›</button>
      <button type="button" title="Сначала" @click="go(0, true)">↻</button>
    </div>
    <transition name="dm-cap" mode="out-in">
      <p :key="step" class="dm-cap"><b>{{ step + 1 }}/{{ steps.length }}</b> {{ steps[step].t }}</p>
    </transition>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({ steps: { type: Array, required: true } }) // [{ t: 'подпись', ms: 2400 }]
const emit = defineEmits(['step'])
const step = ref(0), t = ref(0), playing = ref(true)
// сцене — новый шаг (звук на ключевых моментах); при паузе звук не нужен
watch(step, v => { if (playing.value) emit('step', v) })
let raf = 0, last = 0
function frame(now) {
  raf = requestAnimationFrame(frame)
  const dt = last ? Math.min(100, now - last) : 0
  last = now
  if (!playing.value || document.hidden) return
  t.value += dt
  // последний шаг держится чуть дольше — потом пример начинается заново
  const ms = (props.steps[step.value].ms || 2400) + (step.value === props.steps.length - 1 ? 1200 : 0)
  if (t.value >= ms) { step.value = (step.value + 1) % props.steps.length; t.value = 0 }
}
function go(i, play = false) {
  step.value = (i + props.steps.length) % props.steps.length
  t.value = 0
  if (play) playing.value = true
}
const toggle = () => { playing.value = !playing.value }
onMounted(() => { raf = requestAnimationFrame(frame) })
onBeforeUnmount(() => cancelAnimationFrame(raf))
</script>

<style scoped>
.dm { display: grid; gap: 8px; margin: 10px 0; padding: 12px; border-radius: 14px; border: 1px dashed rgba(231, 197, 111, .3); background: rgba(0, 0, 0, .22); }
.dm-stage { position: relative; min-height: 120px; overflow: hidden; }
.dm-bar { display: flex; align-items: center; gap: 6px; }
.dm-bar button { width: 28px; height: 26px; padding: 0; border-radius: 8px; border: 1px solid rgba(231, 197, 111, .3); background: rgba(0, 0, 0, .3); color: #f3dc9e; font: 800 13px 'Manrope', sans-serif; cursor: pointer; }
.dm-bar button:disabled { opacity: .35; cursor: default; }
.dm-dots { flex: 1; display: flex; gap: 4px; align-items: center; }
.dm-dots i { flex: 1; max-width: 46px; height: 5px; border-radius: 99px; background: rgba(255, 255, 255, .1); cursor: pointer; transition: background .3s; }
.dm-dots i.past { background: rgba(231, 197, 111, .45); }
.dm-dots i.on { background: #e7c56f; box-shadow: 0 0 8px rgba(231, 197, 111, .6); }
.dm-cap { margin: 0 !important; min-height: 22px; color: #efe3c8; font: 600 13px/1.45 'Manrope', sans-serif; }
.dm-cap b { margin-right: 6px; color: #a8936c; font-size: 11px; }
.dm-cap-enter-active, .dm-cap-leave-active { transition: opacity .2s, transform .2s; }
.dm-cap-enter-from { opacity: 0; transform: translateY(4px); }
.dm-cap-leave-to { opacity: 0; }
</style>
