<template>
  <!-- пример «порядок записей»: перетащили запись за значок — бонус повторения для новых бросков считается по новому порядку,
       уже брошенное не меняется -->
  <InfoDemo v-slot="{ step }" :steps="STEPS" @step="sound">
    <div class="dz od">
      <div v-for="r in ROWS" :key="r.id" class="dz-card od-row" :class="{ drag: step === 1 && r.id === 'c' }" :style="{ top: pos(step, r.id) * 46 + 'px', '--sc': '#b9a6ff' }">
        <div class="dz-row">
          <span class="od-grip" :class="{ hot: step === 1 && r.id === 'c' }">📚</span><b>{{ r.n }}</b>
          <span class="dz-chip blue">↻ повт. +{{ pos(step, r.id) }}</span>
          <span v-if="r.roll" class="dz-chip gold" :title="'Брошено раньше — не меняется'">🎲 {{ r.roll }} (было +0)</span>
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
  { t: 'Три одинаковые записи за сессию: бонус повторения по порядку — +0, +1, +2. Первая уже брошена.', ms: 2800 },
  { t: 'Берёшь третью запись за значок слева и перетаскиваешь наверх.', ms: 2200 },
  { t: 'Бонус для новых бросков пересчитался по новому порядку. Уже брошенное (🎲 15) не меняется.', ms: 3200 }
]
const ROWS = [{ id: 'a', n: 'Чтение (Свиток огня)', roll: 15 }, { id: 'b', n: 'Чтение (Свиток льда)' }, { id: 'c', n: 'Чтение (Свиток молний)' }]
const ORDER = [['a', 'b', 'c'], ['c', 'a', 'b'], ['c', 'a', 'b']]
const pos = (step, id) => ORDER[step].indexOf(id)
const sound = s => { if (s === 1) sfx('pageFlip', 0.15) }
</script>

<style scoped>
.od { position: relative; height: 140px; }
.od-row { position: absolute; left: 0; right: 0; transition: top .8s cubic-bezier(.4, 0, .2, 1), transform .3s, box-shadow .3s; }
.od-row.drag { z-index: 2; transform: scale(1.03) rotate(-.6deg); box-shadow: 0 12px 24px rgba(0, 0, 0, .65); }
.od-grip { display: grid; place-items: center; width: 22px; height: 22px; border-radius: 6px; background: rgba(185, 166, 255, .18); transition: box-shadow .3s; }
.od-grip.hot { box-shadow: 0 0 0 1.5px #b9a6ff, 0 0 12px rgba(185, 166, 255, .6); cursor: grabbing; }
</style>
