<template>
  <!-- пример изнурения: шкала 0–5, выносливость ×2 при изнурении, перерасход выносливости, «Сон» на 5, отдых снимает -->
  <InfoDemo v-slot="{ step }" :steps="STEPS" @step="sound">
    <div class="dz ed">
      <div class="ed-meter" :class="{ sleep: EXH[step] >= 5 }">
        <span class="dz-lbl">Изнурение героя</span>
        <div class="ed-pips"><i v-for="n in 5" :key="n" :class="{ on: n <= EXH[step] }" /></div>
        <b>{{ EXH[step] >= 5 ? '😴 5/5 · Сон' : `😵 ${EXH[step]}/5` }}</b>
        <small v-if="EXH[step] > 0 && EXH[step] < 5">⚡ затраты выносливости ×2</small>
      </div>
      <div :key="step" class="dz-card dz-in ed-card" :style="{ '--sc': R[step].c }">
        <div class="dz-row"><span>{{ R[step].i }}</span><b>{{ R[step].n }}</b></div>
        <div class="dz-row">
          <span v-for="(c, k) in R[step].chips" :key="k" class="dz-chip" :class="c.k">{{ c.t }}</span>
        </div>
      </div>
    </div>
  </InfoDemo>
</template>

<script setup>
import InfoDemo from './InfoDemo.vue'
import { sfx } from '../../../sound/sound.js'
import './demo.css'

const STEPS = [
  { t: 'У героя 1 изнурение: −2 к характеристикам и все затраты выносливости ×2.', ms: 2600 },
  { t: 'Обычная тренировка 8 ч: по вики 1,6 выносливости — сайт сам ставит ×2 = 3,2.', ms: 2800 },
  { t: 'Подземелье: выносливость ушла в минус (−4) — по 1 изнурению за каждые −2 → +2.', ms: 2800 },
  { t: 'Ещё одна вылазка — +2, стало 5: эффект «😴 Сон». Мастер на проверке увидит метку «до 5 — Сон».', ms: 3000 },
  { t: 'Сон 6 ч снимает 2 (1 за каждые 3 часа отдыха).', ms: 2400 },
  { t: 'Чтение 9 ч — тоже отдых: ещё −3, изнурение ушло.', ms: 2400 },
  { t: 'Длительная тренировка (сутки со сном) изнурения не даёт и не снимает.', ms: 2600 }
]
const EXH = [1, 1, 3, 5, 3, 0, 0]
const R = [
  { i: '🧍', n: 'Герой после прошлой сессии', c: '#ff7a6b', chips: [{ t: '😵 1 изнурение', k: 'red' }] },
  { i: '🏋', n: 'Обычная тренировка (Сила), 8 ч', c: '#f0b54f', chips: [{ t: '⚡ 1,6 × 2 = 3,2', k: 'gold' }, { t: '😵 0' }] },
  { i: '⚔', n: 'Подземелье «Старая шахта»', c: '#ff7a6b', chips: [{ t: '⚡ осталось −4', k: 'red' }, { t: '😵 +2', k: 'red' }] },
  { i: '⚔', n: 'Вылазка за травами', c: '#ff7a6b', chips: [{ t: '⚡ снова в минус', k: 'red' }, { t: '😵 +2 → 5', k: 'red' }, { t: '😴 до 5 — Сон', k: 'violet' }] },
  { i: '🌙', n: 'Отдых (Сон), 6 ч', c: '#7ed07a', chips: [{ t: '6 / 3', k: '' }, { t: '🌿 −2 изнур.', k: 'green' }] },
  { i: '📚', n: 'Отдых (Чтение), 9 ч', c: '#7ed07a', chips: [{ t: '9 / 3', k: '' }, { t: '🌿 −3 изнур.', k: 'green' }] },
  { i: '⏳', n: 'Длительная тренировка (Тело), 24 ч', c: '#f0b54f', chips: [{ t: '⚡ 3' }, { t: '😵 0 — не даёт и не снимает' }] }
]
function sound(s) {
  if (s === 3) sfx('fail', 0.2)
  else if (s === 4 || s === 5) sfx('bookPlace', 0.2)
}
</script>

<style scoped>
.ed { display: grid; grid-template-columns: minmax(0, .9fr) minmax(0, 1.1fr); gap: 12px; align-items: center; min-height: 120px; }
.ed-meter { display: grid; gap: 5px; justify-items: start; padding: 10px; border-radius: 12px; border: 1px solid rgba(255, 122, 107, .25); background: rgba(0, 0, 0, .25); transition: all .5s; }
.ed-meter.sleep { border-color: rgba(155, 125, 255, .6); box-shadow: 0 0 18px rgba(155, 125, 255, .35); }
.ed-pips { display: flex; gap: 5px; }
.ed-pips i { width: 18px; height: 18px; border-radius: 50%; background: rgba(255, 255, 255, .08); transition: all .45s cubic-bezier(.2, .9, .3, 1.4); }
.ed-pips i.on { background: #ff7a6b; box-shadow: 0 0 8px rgba(255, 122, 107, .7); transform: scale(1.08); }
.ed-meter.sleep .ed-pips i.on { background: #9b7dff; box-shadow: 0 0 10px rgba(155, 125, 255, .8); }
.ed-meter b { color: #ffb3aa; font: 900 14px 'Manrope', sans-serif; }
.ed-meter.sleep b { color: #d2c4ff; }
.ed-meter small { color: #f0c35a; font: 700 11px 'Manrope', sans-serif; }
@media (max-width: 640px) { .ed { grid-template-columns: minmax(0, 1fr); } }
</style>
