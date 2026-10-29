<template>
  <!-- пример бросков: обычный, натуральные 20 и 1, длительная ×3 с растущим повторением и суммой, переброс -->
  <InfoDemo v-slot="{ step, t }" :steps="STEPS" @step="sound">
    <div class="dz dd">
      <!-- один бросок: кубик, моды, повторение, итог -->
      <div v-if="step <= 2" :key="'one' + step" class="dd-line dz-in">
        <span class="dz-die" :class="{ spin: t < 900, crit: t >= 900 && step === 1, fumble: t >= 900 && step === 2 }">{{ t < 900 ? spinFace(t) : ONE[step].die }}</span>
        <template v-if="t >= 900">
          <span v-if="step === 1" class="dz-chip gold dz-pop">✨ 20 × 2 = 40</span>
          <span v-if="step === 2" class="dz-chip red dz-pop">💀 1 → 0</span>
          <span class="dd-op">+</span><span class="dz-chip">моды 13</span>
          <span class="dd-op">+</span><span class="dz-chip" :class="{ red: step === 2 }">{{ step === 2 ? 'повт. +2 → +0' : 'повт. +2' }}</span>
          <span class="dd-op">=</span><b class="dd-total dz-pop" :class="{ gold: step === 1, red: step === 2 }">{{ ONE[step].total }}</b>
        </template>
        <span v-if="step === 2 && t > 1600" class="dd-next dz-in">следующий бросок этой деятельности: <b>+1</b>, потом +2…</span>
      </div>

      <!-- длительная ×3 и переброс -->
      <template v-else>
        <div v-if="step === 4" class="dd-old">
          <span class="dz-chip">↺ перебросы: 3</span>
          <span v-for="(r, i) in SERIES[0]" :key="'o' + i" class="dd-oldr">🎲 {{ r.final }}</span>
        </div>
        <div v-for="(r, i) in SERIES[step - 3]" v-show="t >= i * 900" :key="step + '-' + i" class="dd-line dz-in">
          <span class="dd-n">{{ i + 1 }}/3</span>
          <span class="dz-die" :class="{ spin: t < i * 900 + 500 }">{{ t < i * 900 + 500 ? spinFace(t) : r.a }}</span>
          <span class="dz-die" :class="{ spin: t < i * 900 + 500 }">{{ t < i * 900 + 500 ? spinFace(t + 77) : r.b }}</span>
          <template v-if="t >= i * 900 + 500">
            <span class="dd-op">+5 =</span><span class="dz-chip">{{ r.total }}</span>
            <span class="dd-op">× 1.8 =</span><span class="dz-chip">{{ Math.floor(r.total * 1.8) }}</span>
            <span class="dd-op">+</span><span class="dz-chip blue">повт. +{{ i }}</span>
            <span class="dd-op">=</span><b class="dd-total dz-pop">{{ r.final }}</b>
          </template>
        </div>
        <div v-if="t >= 2700" class="dd-sum dz-pop">Σ {{ SERIES[step - 3].reduce((a, r) => a + r.final, 0) }}<small v-if="step === 4"> — считается только новая серия</small></div>
      </template>
    </div>
  </InfoDemo>
</template>

<script setup>
import InfoDemo from './InfoDemo.vue'
import { sfx } from '../../../sound/sound.js'
import './demo.css'

const STEPS = [
  { t: 'Обычный бросок: 1к20 + модификаторы (13) + бонус повторения (+2) — третий раз за сессию.', ms: 2600 },
  { t: '✨ Натуральная 20 на базовом к20 — этот кубик ×2: 20 → 40.', ms: 2600 },
  { t: '💀 Натуральная 1 — кубик не в счёт (0), а бонус повторения начинается заново.', ms: 3200 },
  { t: 'Длительная ×3: три броска подряд, (2к20 + моды) × 1.8 вниз, повторение растёт +0, +1, +2. Внизу — Σ.', ms: 3800 },
  { t: '↺ Переброс: нажал 🎲 ещё раз — старая серия уходит под «перебросы», считается только новая.', ms: 3800 }
]
const ONE = [{ die: 14, total: 29 }, { die: 20, total: 55 }, { die: 1, total: 13 }]
const mk = (a, b, i) => ({ a, b, total: a + b + 5, final: Math.floor((a + b + 5) * 1.8) + i })
const SERIES = [[mk(14, 9, 0), mk(11, 17, 1), mk(6, 12, 2)], [mk(18, 15, 0), mk(9, 10, 1), mk(13, 16, 2)]]
const spinFace = t => 1 + (Math.floor(t / 60) * 7) % 20
function sound(s) {
  if (s === 1) setTimeout(() => sfx('crit', 0.3), 900)
  else if (s === 2) setTimeout(() => sfx('fail', 0.3), 900)
  else setTimeout(() => sfx('roll', 0.2), 400)
}
</script>

<style scoped>
.dd { display: grid; gap: 7px; min-height: 130px; align-content: center; }
.dd-line { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.dd-op { color: #a8936c; font-weight: 800; }
.dd-n { width: 26px; color: #a8936c; font: 800 11px 'Manrope', sans-serif; }
.dd-total { min-width: 34px; padding: 2px 8px; border-radius: 8px; background: rgba(231, 197, 111, .14); color: #fff; font: 900 16px 'Manrope', sans-serif; text-align: center; }
.dd-total.gold { background: rgba(243, 211, 107, .35); color: #fff3c4; box-shadow: 0 0 14px rgba(243, 211, 107, .5); }
.dd-total.red { background: rgba(255, 107, 94, .2); color: #ffb3aa; }
.dd-next { flex-basis: 100%; color: #cdbf9f; }
.dd-sum { justify-self: end; padding: 3px 12px; border-radius: 99px; background: rgba(126, 208, 122, .16); color: #b4ecb0; font: 900 15px 'Manrope', sans-serif; }
.dd-sum small { color: #a8936c; font-weight: 700; font-size: 11px; }
.dd-old { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; opacity: .55; }
.dd-oldr { color: #a8936c; text-decoration: line-through; font-weight: 700; }
</style>
