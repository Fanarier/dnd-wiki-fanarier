<template>
  <!-- пример «несколько» (×N) и «моды к каждому кубику»: повторяемая ×3 (бонус растёт), неповторяемая ×3 (+0),
       тот же бросок 2к20 с модами один раз и к каждому кубику -->
  <InfoDemo v-slot="{ step, t }" :steps="STEPS" @step="sound">
    <div class="dz md">
      <!-- ×3: повторяемая и нет -->
      <template v-if="step <= 1">
        <div class="md-head dz-in" :key="'h' + step">
          <span class="dz-chip" :class="step === 0 ? 'green' : ''">{{ step === 0 ? '↻ Повторяемая' : '★ Уникальная' }}</span>
          <span class="dz-chip">Тренировка ×3</span>
          <span class="dz-chip">1к20 + 5</span>
        </div>
        <div v-for="(r, i) in ROWS" v-show="t >= i * 800" :key="step + '-' + i" class="md-line dz-in">
          <span class="md-n">{{ i + 1 }}/3</span>
          <span class="dz-die" :class="{ spin: t < i * 800 + 450 }">{{ t < i * 800 + 450 ? spinFace(t) : r }}</span>
          <template v-if="t >= i * 800 + 450">
            <span class="md-op">+5</span>
            <span class="md-op">+</span><span class="dz-chip" :class="step === 0 ? 'blue' : ''">повт. +{{ step === 0 ? i : 0 }}</span>
            <span class="md-op">=</span><b class="md-total dz-pop">{{ r + 5 + (step === 0 ? i : 0) }}</b>
          </template>
        </div>
        <div v-if="t >= 2600" class="md-sum dz-pop">Σ {{ ROWS.reduce((a, r, i) => a + r + 5 + (step === 0 ? i : 0), 0) }}<small v-if="step === 1"> — без бонуса повторения</small></div>
      </template>

      <!-- моды один раз / к каждому кубику -->
      <template v-else>
        <div class="md-head dz-in" :key="'m' + step">
          <span class="dz-chip violet">Длительная · 2к20 + 5</span>
          <span class="dz-chip" :class="step === 3 ? 'gold' : ''">➕ моды {{ step === 3 ? 'к каждому кубику ×2' : 'один раз' }}</span>
        </div>
        <div class="md-line dz-in" :key="'l' + step">
          <span class="dz-die" :class="{ spin: t < 600 }">{{ t < 600 ? spinFace(t) : 14 }}</span>
          <span v-if="step === 3 && t >= 600" class="md-op dz-pop">+5</span>
          <span class="md-op">+</span>
          <span class="dz-die" :class="{ spin: t < 600 }">{{ t < 600 ? spinFace(t + 77) : 9 }}</span>
          <template v-if="t >= 600">
            <span class="md-op dz-pop">+5</span>
            <span class="md-op">=</span><span class="dz-chip">{{ step === 3 ? 33 : 28 }}</span>
            <span class="md-op">× 1.8 =</span><b class="md-total dz-pop" :class="{ gold: step === 3 }">{{ Math.floor((step === 3 ? 33 : 28) * 1.8) }}</b>
          </template>
        </div>
        <div v-if="step === 3 && t >= 1600" class="md-sum dz-pop">+9 к итогу — по сравнению с «один раз»</div>
      </template>
    </div>
  </InfoDemo>
</template>

<script setup>
import InfoDemo from './InfoDemo.vue'
import { sfx } from '../../../sound/sound.js'
import './demo.css'

const STEPS = [
  { t: '↻ Повторяемая ×3: три броска подряд одной записью, бонус повторения растёт +0, +1, +2. Внизу — Σ.', ms: 3800 },
  { t: '★ Не повторяемая ×3: те же три броска, но бонуса повторения нет — у всех +0.', ms: 3800 },
  { t: 'В броске два кубика (2к20) — сайт спросит про модификаторы. «Один раз»: 14 + 9 + 5.', ms: 3000 },
  { t: '«К каждому кубику»: +5 к каждому из двух — (14 + 5) + (9 + 5). У записи будет метка «➕ моды к каждому кубику ×2».', ms: 3600 }
]
const ROWS = [12, 7, 16]
const spinFace = t => 1 + (Math.floor(t / 60) * 7) % 20
const sound = () => setTimeout(() => sfx('roll', 0.2), 300)
</script>

<style scoped>
.md { display: grid; gap: 7px; min-height: 150px; align-content: center; }
.md-head { display: flex; flex-wrap: wrap; gap: 5px; }
.md-line { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.md-op { color: #a8936c; font-weight: 800; }
.md-n { width: 26px; color: #a8936c; font: 800 11px 'Manrope', sans-serif; }
.md-total { min-width: 34px; padding: 2px 8px; border-radius: 8px; background: rgba(231, 197, 111, .14); color: #fff; font: 900 16px 'Manrope', sans-serif; text-align: center; }
.md-total.gold { background: rgba(243, 211, 107, .35); color: #fff3c4; box-shadow: 0 0 14px rgba(243, 211, 107, .5); }
.md-sum { justify-self: end; padding: 3px 12px; border-radius: 99px; background: rgba(126, 208, 122, .16); color: #b4ecb0; font: 900 15px 'Manrope', sans-serif; }
.md-sum small { color: #a8936c; font-weight: 700; font-size: 11px; }
</style>
