<template>
  <!-- пример «запись → лист героя»: мастер ставит «учтено» — кинжал уходит из инвентаря, мелочь разменивается, золото
       приходит, очки летят в тренировку; сняли «учтено» — всё вернулось -->
  <InfoDemo v-slot="{ step }" :steps="STEPS" @step="sound">
    <div class="dz sd">
      <div class="dz-card sd-rec" :style="{ '--sc': ST[st(step)].c }">
        <div class="dz-row"><span>⚖</span><b>Торговля на рынке</b><span class="dz-st" :style="{ color: ST[st(step)].c }">{{ ST[st(step)].n }}</span></div>
        <div class="dz-row">
          <span class="dz-chip" :class="{ green: applied(step) }">🎒 −1 Кинжал</span>
          <span class="dz-chip" :class="{ green: applied(step) }">💰 +5 зм −30 см</span>
          <span class="dz-chip" :class="{ green: applied(step) }">🏋 Телосложение +43</span>
        </div>
        <span v-if="step === 1" class="dz-stamp" style="color: #7ed07a">учтено</span>
      </div>

      <div class="sd-sheet">
        <span class="dz-lbl">📜 Лист героя</span>
        <div class="sd-box">
          <span class="dz-lbl">Инвентарь</span>
          <div class="sd-item" :class="{ 'dz-gone': step >= 2 && step < 6 }">🗡 Кинжал</div>
          <div class="sd-item">🧭 Компас</div>
        </div>
        <div class="sd-box">
          <span class="dz-lbl">Кошелёк</span>
          <div class="sd-coins">
            <span class="coin g" :class="{ hit: step === 3 || step === 4 }">{{ C[coinsAt(step)].g }} зм</span>
            <span class="coin s" :class="{ hit: step === 3 }">{{ C[coinsAt(step)].s }} см</span>
            <span class="coin c">0 мм</span>
          </div>
          <small v-if="step === 3" class="sd-note dz-in">💱 мелочи не хватило: 1 зм → 100 см, ушло 30 см</small>
        </div>
        <div class="sd-box">
          <span class="dz-lbl">Тренировка «Телосложение»</span>
          <div class="sd-bar" :class="{ full: step === 5 }"><i :style="{ width: (step >= 5 && step < 6 ? 100 : 85) + '%' }" /></div>
          <small>{{ step >= 5 && step < 6 ? '200/200 · ✨ завершена!' : '170/200' }}</small>
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
  { t: 'Запись «на проверке»: в «Подробнее» указано, что уйдёт в лист — вещь, монеты, очки тренировки.', ms: 2600 },
  { t: 'Мастер ставит «учтено» — на запись падает печать.', ms: 1800 },
  { t: '🎒 Кинжал уходит из инвентаря (неважно, в сумке он или на складе).', ms: 2200 },
  { t: '💱 Курс 1 к 100: серебра не было — 1 зм разменялась на 100 см, ушло 30 см.', ms: 2800 },
  { t: '💰 Пришло +5 зм.', ms: 1800 },
  { t: '🏋 +43 очка улетели в тренировку — она завершена.', ms: 2400 },
  { t: 'Мастер снял «учтено» (или поставил «провал») — всё вернулось обратно, как было.', ms: 2800 }
]
const ST = { pending: { n: 'на проверке', c: '#f0b54f' }, done: { n: 'учтено', c: '#7ed07a' }, back: { n: 'на проверке', c: '#f0b54f' } }
const st = s => (s >= 1 && s < 6 ? 'done' : 'pending')
const applied = s => s >= 1 && s < 6
// кошелёк по шагам: было 1 зм 0 см → размен → 0 зм 70 см → +5 зм → вернулось
const C = [{ g: 1, s: 0 }, { g: 0, s: 70 }, { g: 5, s: 70 }]
const coinsAt = s => (s < 3 || s >= 6 ? 0 : s === 3 ? 1 : 2)
function sound(s) {
  if (s === 1) sfx('bookPlace', 0.3)
  else if (s === 3 || s === 4) sfx('coins', 0.25)
  else if (s === 5) setTimeout(() => sfx('crit', 0.25), 300)
}
</script>

<style scoped>
.sd { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; align-items: start; }
.sd-rec { align-self: center; padding-right: 90px; }
.sd-sheet { display: grid; gap: 6px; padding: 8px 10px; border-radius: 12px; border: 1px solid rgba(231, 197, 111, .25); background: rgba(0, 0, 0, .25); }
.sd-box { display: grid; gap: 3px; }
.sd-item { padding: 2px 8px; border-radius: 7px; background: rgba(255, 255, 255, .04); transition: all .6s; }
.sd-item.dz-gone { max-height: 0; padding-top: 0; padding-bottom: 0; transform: translateX(30px); }
.sd-item { max-height: 30px; overflow: hidden; }
.sd-coins { display: flex; gap: 6px; }
.coin { padding: 1px 8px; border-radius: 99px; font: 800 12px 'Manrope', sans-serif; transition: all .4s; }
.coin.g { background: rgba(255, 209, 102, .15); color: #ffd166; }
.coin.s { background: rgba(214, 221, 230, .12); color: #d6dde6; }
.coin.c { background: rgba(224, 138, 82, .12); color: #e08a52; }
.coin.hit { animation: dz-pop .5s cubic-bezier(.2, .9, .3, 1.4); box-shadow: 0 0 12px currentColor; }
.sd-note { color: #f0c35a; }
.sd-bar { height: 9px; border-radius: 99px; background: rgba(255, 255, 255, .07); overflow: hidden; }
.sd-bar i { display: block; height: 100%; background: linear-gradient(90deg, #3fae5a, #7ee06a); transition: width .9s cubic-bezier(.2, .8, .3, 1); }
.sd-bar.full { box-shadow: 0 0 14px rgba(126, 224, 106, .6); }
.sd-box small { color: #a8936c; font: 700 11px 'Manrope', sans-serif; }
@media (max-width: 640px) { .sd { grid-template-columns: minmax(0, 1fr); } }
</style>
