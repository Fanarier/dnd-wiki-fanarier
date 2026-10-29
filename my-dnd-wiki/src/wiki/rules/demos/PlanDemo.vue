<template>
  <!-- пример «План»: сессия по дням, сон отложен в каждом дне; карточку перетаскивают на другой день; переполненный
       день краснеет; «📨 Отправить мастеру» — черновики уходят на проверку разом -->
  <InfoDemo v-slot="{ step }" :steps="STEPS" @step="sound">
    <div class="dz pd">
      <div class="pd-days">
        <div v-for="d in 5" :key="d" class="pd-day" :class="{ over: load(step, d - 1) > 24 }">
          <i class="pd-sleep" :style="{ height: 8 * H + 'px' }">сон 8 ч</i>
          <small>день {{ d }} · {{ load(step, d - 1) }} ч</small>
        </div>
        <div v-for="c in cardsAt(step)" :key="c.id" class="pd-card" :class="{ drag: c.drag, pend: step >= 4 }"
             :style="{ left: `calc(${c.day * 20}% + 4px)`, bottom: 18 + (8 + c.below) * H + 'px', height: c.h * H - 2 + 'px' }">
          {{ c.n }} <b>{{ c.h }} ч</b>
        </div>
      </div>
      <div class="pd-foot"><span class="dz-btn primary" :class="{ press: step === 4 }">📨 Отправить мастеру</span><small v-if="step >= 4" class="dz-in">5 черновиков → «на проверке»</small></div>
    </div>
  </InfoDemo>
</template>

<script setup>
import InfoDemo from './InfoDemo.vue'
import { sfx } from '../../../sound/sound.js'
import './demo.css'

const H = 4.4 // пикселей на час: сутки — 106 px
const STEPS = [
  { t: 'Вкладка «🗓 План»: сессия по дням, сон из настроек героя уже отложен в каждом дне.', ms: 2600 },
  { t: 'Карточку перетаскиваешь на другой день — «Свидание» переехало на 5-й день.', ms: 2600 },
  { t: 'Добавил «Подземелье» в 4-й день — там больше 24 ч, день краснеет.', ms: 2600 },
  { t: 'Перетащил его на 5-й день — всё влезает.', ms: 2400 },
  { t: '«📨 Отправить мастеру» — все черновики уходят на проверку разом.', ms: 2800 }
]
// карточки: день (0–4) и часы; по шагам меняется день
const BASE = [
  { id: 'a', n: '🏋 Тренировка', h: 8, day: [0, 0, 0, 0, 0] },
  { id: 'b', n: '⚔ Заказ', h: 12, day: [1, 1, 1, 1, 1] },
  { id: 'c', n: '📚 Чтение', h: 6, day: [2, 2, 2, 2, 2] },
  { id: 'd', n: '💞 Свидание', h: 4, day: [2, 4, 4, 4, 4] },
  { id: 'e', n: '🔨 Крафт', h: 10, day: [3, 3, 3, 3, 3] },
  { id: 'f', n: '⚔ Подземелье', h: 10, day: [null, null, 3, 4, 4] }
]
function cardsAt(step) {
  const below = [0, 0, 0, 0, 0]
  return BASE.filter(c => c.day[step] != null).map(c => {
    const day = c.day[step]
    const out = { ...c, day, below: below[day], drag: (step === 1 && c.id === 'd') || (step === 3 && c.id === 'f') }
    below[day] += c.h
    return out
  })
}
const load = (step, d) => 8 + cardsAt(step).filter(c => c.day === d).reduce((a, c) => a + c.h, 0)
function sound(s) {
  if (s === 1 || s === 3) sfx('pageFlip', 0.15)
  else if (s === 4) sfx('bookPlace', 0.25)
}
</script>

<style scoped>
.pd { display: grid; gap: 8px; }
.pd-days { position: relative; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); height: 140px; }
.pd-day { position: relative; margin: 0 2px; border-radius: 9px; border: 1px solid rgba(231, 197, 111, .18); background: rgba(0, 0, 0, .25); transition: all .4s; }
.pd-day.over { border-color: rgba(255, 107, 94, .7); background: rgba(255, 70, 60, .12); box-shadow: 0 0 12px rgba(255, 70, 60, .3); }
.pd-day small { position: absolute; left: 0; right: 0; bottom: 2px; text-align: center; color: #a8936c; font: 700 10px 'Manrope', sans-serif; }
.pd-day.over small { color: #ffb3aa; }
.pd-sleep { position: absolute; left: 3px; right: 3px; bottom: 18px; display: grid; place-items: center; border-radius: 6px; background: repeating-linear-gradient(45deg, rgba(120, 130, 170, .18) 0 6px, rgba(120, 130, 170, .08) 6px 12px); color: #9aa4c4; font: 700 9.5px 'Manrope', sans-serif; font-style: normal; }
.pd-card { position: absolute; width: calc(20% - 8px); display: flex; align-items: center; justify-content: space-between; gap: 3px; overflow: hidden; padding: 0 5px; border-radius: 6px; background: rgba(185, 166, 255, .25); border-left: 3px solid #b9a6ff; color: #efe3c8; font: 700 10px 'Manrope', sans-serif; white-space: nowrap; transition: left .8s cubic-bezier(.4, 0, .2, 1), bottom .8s cubic-bezier(.4, 0, .2, 1), background .5s, border-color .5s, box-shadow .3s, transform .3s; }
.pd-card b { color: #fff; font-size: 9.5px; }
.pd-card.drag { z-index: 2; transform: scale(1.06); box-shadow: 0 8px 18px rgba(0, 0, 0, .6); }
.pd-card.pend { background: rgba(240, 181, 79, .22); border-color: #f0b54f; }
.pd-foot { display: flex; align-items: center; gap: 8px; }
.pd-foot small { color: #f0b54f; font-weight: 800; }
</style>
