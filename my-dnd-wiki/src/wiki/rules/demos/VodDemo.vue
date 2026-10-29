<template>
  <!-- пример ВОД (взаимной общей деятельности): приглашение → «⋯ Подтвердить» → общие часы → свои броски → удаление -->
  <InfoDemo v-slot="{ step }" :steps="STEPS" @step="sound">
    <div class="dz vd">
      <div class="vd-col">
        <span class="dz-lbl">Журнал Белатора</span>
        <div class="dz-card dz-in" :class="{ 'dz-gone': step >= 5 }" style="--sc: #f0b54f">
          <div class="dz-row"><span>💞</span><b>Свидание (Таверна)</b></div>
          <div class="dz-row">
            <span class="dz-chip" :class="{ hot: step === 3 }">⏱ {{ step >= 3 ? 9 : 6 }} ч</span>
            <span class="dz-chip">с Джилл</span>
            <span v-if="step >= 2" class="dz-chip pink dz-pop">🤝 ВОД · Джилл</span>
            <span v-if="step >= 4" class="dz-chip blue dz-pop">🎲 17</span>
          </div>
        </div>
      </div>
      <div class="vd-arrow" :class="{ on: step >= 1 }">→</div>
      <div class="vd-col">
        <span class="dz-lbl">Журнал Джилл <i v-if="step === 1" class="vd-bell dz-pop">🔔 1</i></span>
        <div v-if="step >= 1" class="dz-card dz-in vd-mine" :class="{ ghost: step === 1 }" style="--sc: #f0b54f">
          <div class="dz-row"><span>💞</span><b>Свидание (Таверна)</b><span v-if="step === 1" class="vd-dots">⋯</span></div>
          <div class="dz-row">
            <span class="dz-chip" :class="{ hot: step === 3 }">⏱ {{ step >= 3 ? 9 : 6 }} ч</span>
            <span v-if="step === 1" class="dz-chip">↔ из журнала Белатора</span>
            <span v-if="step >= 2 && step < 5" class="dz-chip pink dz-pop">🤝 ВОД · Белатор</span>
          </div>
          <div v-if="step === 1" class="vd-menu dz-in">🤝 Подтвердить — добавить в свой журнал</div>
          <div v-if="step === 4" class="vd-rolls dz-in"><i>Броски Белатора:</i> <span class="dz-chip blue">🎲 17</span></div>
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
  { t: 'Белатор пишет «Свидание (Таверна)», 6 ч, и в «Подробнее → С кем» отмечает Джилл.', ms: 2600 },
  { t: 'Запись приходит в журнал Джилл (и уведомление). Внизу у неё «⋯ → Подтвердить».', ms: 2800 },
  { t: 'Подтвердила — у Джилл своя запись, связанная с записью Белатора: у обеих тег «🤝 ВОД».', ms: 2600 },
  { t: 'Белатор поменял часы 6 → 9 — у Джилл тоже поменялось (пока её запись не проверена мастером).', ms: 2800 },
  { t: 'Броски у каждого свои; броски партнёра видны у записи отдельно.', ms: 2600 },
  { t: 'Белатор удалил свою — у Джилл запись осталась, но уже без тега ВОД.', ms: 2600 }
]
function sound(s) {
  if (s === 1) sfx('notify', 0.2)
  else if (s === 2) sfx('bookPlace', 0.25)
  else if (s === 4) sfx('roll', 0.2)
}
</script>

<style scoped>
.vd { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); gap: 10px; align-items: start; min-height: 120px; }
.vd-col { display: grid; gap: 6px; }
.vd-arrow { align-self: center; color: rgba(255, 140, 190, .25); font: 900 22px 'Manrope', sans-serif; transition: color .5s, transform .5s; }
.vd-arrow.on { color: #ffc3dc; transform: translateX(2px); }
.vd-mine.ghost { opacity: .72; border-style: dashed; }
.vd-dots { margin-left: auto; padding: 0 8px; border-radius: 8px; border: 1px solid rgba(255, 140, 190, .4); color: #ffc3dc; font-weight: 900; }
.vd-menu { padding: 5px 9px; border-radius: 8px; border: 1px solid rgba(255, 140, 190, .4); background: #1b1410; color: #efe3c8; font-weight: 700; }
.vd-rolls { display: flex; align-items: center; gap: 6px; padding: 2px 6px; border-radius: 9px; border: 1px dashed rgba(255, 140, 190, .35); }
.vd-rolls i { color: #e6a9c4; font-style: normal; font-size: 11px; }
.vd-bell { margin-left: 6px; padding: 0 6px; border-radius: 99px; background: #d8433a; color: #fff; font-style: normal; letter-spacing: 0; }
.dz-chip.hot { animation: dz-flash 1.2s ease-out; box-shadow: 0 0 0 1px #7ee06a; }
@media (max-width: 640px) { .vd { grid-template-columns: minmax(0, 1fr); } .vd-arrow { display: none; } }
</style>
