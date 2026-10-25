<template>
  <!-- арт существа в ореоле его стихии: свечение вращается, частицы (искры, снежинки, разряды, пыль, листья) летят по-своему.
       Нет арта — силуэт-знак стихии. Неизвестное — туман и «?» -->
  <div class="ba" :class="[el, { unknown, big }]" :style="{ '--ec': E.color, '--eg': E.glow }">
    <i class="ba-aura" />
    <img v-if="src && !unknown" :src="src" alt="" class="ba-img" draggable="false" />
    <span v-else class="ba-sign">{{ unknown ? '?' : E.icon }}</span>
    <i v-for="k in (big ? 14 : 7)" :key="k" class="ba-p" :style="pStyle(k)" />
    <i v-if="unknown" class="ba-fog" />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { heroPortraitUrl } from '../../map/store.js'
import { ELEMENTS } from './beasts.js'

const props = defineProps({ beast: { type: Object, required: true }, el: { type: String, default: 'shadow' }, big: Boolean, unknown: Boolean })
const E = computed(() => ELEMENTS[props.el] || ELEMENTS.shadow)
const src = computed(() => { const a = props.beast.arts?.[0]; return a ? heroPortraitUrl(props.big ? a.file : a.thumb || a.file) : '' })
// частицы: место и задержка — от номера, чтобы не прыгали при перерисовке
const pStyle = k => ({ left: ((k * 37) % 92) + 4 + '%', animationDelay: -((k * 0.71) % 4).toFixed(2) + 's', animationDuration: (3 + (k % 4) * 0.7).toFixed(1) + 's', '--s': (0.6 + (k % 3) * 0.3).toFixed(1) })
</script>

<style scoped>
.ba { position: relative; overflow: hidden; display: grid; place-items: center; aspect-ratio: 4 / 5; border-radius: 14px; isolation: isolate;
  background: radial-gradient(ellipse at 50% 70%, color-mix(in srgb, var(--ec) 22%, #120d08), #0b0806 75%); }
.ba-aura { position: absolute; inset: -30%; z-index: -1; background: conic-gradient(from 0deg, transparent, var(--eg), transparent 30%, transparent 50%, var(--eg), transparent 80%); filter: blur(24px); opacity: .55; animation: ba-spin 12s linear infinite; }
.ba-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transition: transform .5s ease; }
.ba-sign { font-size: 64px; color: var(--ec); filter: drop-shadow(0 0 16px var(--eg)); animation: ba-breathe 3.4s ease-in-out infinite; }
.ba.big .ba-sign { font-size: 110px; }
.ba-p { position: absolute; bottom: -8px; width: calc(5px * var(--s)); height: calc(5px * var(--s)); border-radius: 50%; background: var(--ec); box-shadow: 0 0 8px var(--eg); opacity: 0; pointer-events: none; animation: ba-rise linear infinite; }
/* стихии: огонь — искры вверх, лёд — снег вниз, молния — вспышки, камень — пыль, природа — листья вьются */
.ba.ice .ba-p { top: -8px; bottom: auto; border-radius: 2px; transform: rotate(45deg); animation-name: ba-fall; }
.ba.storm .ba-p { width: 2px; height: calc(14px * var(--s)); border-radius: 1px; animation-name: ba-zap; }
.ba.earth .ba-p { border-radius: 2px; animation-name: ba-dust; }
.ba.nature .ba-p { border-radius: 60% 0; animation-name: ba-leaf; }
.ba.shadow .ba-p { filter: blur(1px); animation-name: ba-drift; }
.ba.unknown { background: radial-gradient(ellipse at 50% 60%, #1c1720, #08070a 75%); }
.ba.unknown .ba-sign { color: #4a4252; font: 900 72px 'Cormorant Garamond', serif; filter: none; text-shadow: 0 0 22px rgba(120, 100, 160, .35); }
.ba.unknown .ba-aura, .ba.unknown .ba-p { display: none; }
.ba-fog { position: absolute; inset: 0; background: radial-gradient(ellipse at 30% 40%, rgba(150, 140, 170, .16), transparent 55%), radial-gradient(ellipse at 70% 70%, rgba(150, 140, 170, .12), transparent 50%); animation: ba-fog 9s ease-in-out infinite alternate; }
@keyframes ba-spin { to { transform: rotate(360deg); } }
@keyframes ba-breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.07); } }
@keyframes ba-rise { 0% { transform: translateY(0) scale(1); opacity: 0; } 15% { opacity: .9; } 100% { transform: translate(10px, -260px) scale(.3); opacity: 0; } }
@keyframes ba-fall { 0% { transform: translateY(0) rotate(0); opacity: 0; } 15% { opacity: .9; } 100% { transform: translate(-14px, 280px) rotate(220deg); opacity: 0; } }
@keyframes ba-zap { 0%, 70%, 100% { opacity: 0; transform: translateY(-120px) scaleY(1); } 72% { opacity: 1; } 76% { opacity: .2; transform: translateY(-160px) scaleY(1.6); } 80% { opacity: .9; } }
@keyframes ba-dust { 0% { transform: translate(0, 0); opacity: 0; } 20% { opacity: .7; } 100% { transform: translate(30px, -90px); opacity: 0; } }
@keyframes ba-leaf { 0% { transform: translate(0, 0) rotate(0); opacity: 0; } 20% { opacity: .9; } 50% { transform: translate(18px, -120px) rotate(160deg); } 100% { transform: translate(-10px, -240px) rotate(360deg); opacity: 0; } }
@keyframes ba-drift { 0% { transform: translate(0, 0); opacity: 0; } 30% { opacity: .5; } 100% { transform: translate(-20px, -200px); opacity: 0; } }
@keyframes ba-fog { from { transform: translateX(-6%); } to { transform: translateX(6%); } }
@media (prefers-reduced-motion: reduce) { .ba-aura, .ba-sign, .ba-p, .ba-fog { animation: none; } .ba-p { display: none; } }
</style>
