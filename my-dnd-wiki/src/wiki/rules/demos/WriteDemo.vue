<template>
  <!-- пример «как записать деятельность»: печать названия, подсказка из вики, часы и выносливость сами, «!Мод» + Tab,
       «= ?» до броска, «На проверку» — запись в журнале и песочные часы сессии -->
  <InfoDemo v-slot="{ step, t }" :steps="STEPS">
    <div class="dz wd">
      <div class="wd-form" :class="{ sent: step >= 7 }">
        <div class="wd-f">
          <span class="dz-lbl">Деятельность</span>
          <div class="dz-inp" :class="{ focus: step === 1 || step === 2 }">{{ step < 1 ? '' : step === 1 ? typed(NAME_TYPED, t) : step === 2 ? NAME_TYPED : NAME }}<i v-if="step === 1 || step === 2" class="dz-caret" /></div>
          <div v-if="step === 2" class="wd-sugg dz-in">
            <div class="on">📖 Долгие тренировка/обучение <small>вики · 24 ч · 3 выносл.</small></div>
            <div>★ Долгая тренировка (Тело) <small>прошлая запись</small></div>
          </div>
        </div>
        <div class="wd-grid">
          <div class="wd-f"><span class="dz-lbl">Часы</span><div class="dz-inp" :class="{ flash: step === 3 }">{{ step >= 3 ? '24' : '' }}</div></div>
          <div class="wd-f"><span class="dz-lbl">Выносливость</span><div class="dz-inp" :class="{ flash: step === 3 }">{{ step >= 3 ? '3' : '' }}</div></div>
          <div class="wd-f"><span class="dz-lbl">Тип</span><div class="dz-inp" :class="{ flash: step === 3 }">{{ step >= 3 ? '↻ Повторяемая' : '—' }}</div></div>
        </div>
        <div class="wd-f">
          <span class="dz-lbl">Описание</span>
          <div class="dz-inp wd-area" :class="{ focus: step === 4 }">
            <template v-if="step === 4">
              <template v-if="t < 1400">{{ typed('!Мод', t, 180) }}<i class="dz-caret" /></template>
              <template v-else>Модификаторы броска: {{ typed('Сила +5', t - 1600, 120) }}<i class="dz-caret" /></template>
              <div v-if="t > 750 && t < 1400" class="wd-pop dz-in">Модификаторы броска: <kbd>Tab</kbd></div>
            </template>
            <template v-else-if="step > 4">Модификаторы броска: Сила +5</template>
          </div>
        </div>
        <div v-if="step >= 5" class="wd-plan dz-in"><span class="dz-chip blue">🎲 (2d20+5) × 1.8 = <b>?</b></span><small>— так видно, что модификаторы подхватились</small></div>
        <div class="wd-btns"><span class="dz-btn">В черновик</span><span class="dz-btn primary" :class="{ press: step === 6 }">На проверку</span></div>
      </div>

      <div class="wd-log">
        <span class="dz-lbl">Сессия · ⏱ {{ step >= 7 ? 136 : 112 }} / 224 ч занято</span>
        <div class="wd-glass">
          <i v-for="s in SEGS" :key="s.n" :style="{ width: s.h / 224 * 100 + '%', background: s.c }" :title="s.n" />
          <i v-if="step >= 7" class="dz-pop" :style="{ width: 24 / 224 * 100 + '%', background: '#7ed07a' }" />
        </div>
        <div v-if="step >= 7" class="dz-card dz-in" style="--sc: #f0b54f">
          <div class="dz-row"><span>📚</span><b>{{ NAME }}</b><span class="dz-st" style="color: #f0b54f">на проверке</span></div>
          <div class="dz-row"><span class="dz-chip">⏱ 24 ч</span><span class="dz-chip">⚡ 3</span><span class="dz-chip blue">🎲 (2d20+5) × 1.8 = ?</span></div>
        </div>
      </div>
    </div>
  </InfoDemo>
</template>

<script setup>
import InfoDemo from './InfoDemo.vue'
import './demo.css'

const NAME = 'Долгая тренировка (Тело)'
const NAME_TYPED = 'Долгая трен'
const typed = (s, t, speed = 130) => s.slice(0, Math.max(0, Math.floor(t / speed)))
const STEPS = [
  { t: 'Нажал «＋ Деятельность» — открылась форма записи.', ms: 1800 },
  { t: 'Начинаешь писать название…', ms: 1900 },
  { t: 'Сайт подсказывает деятельности из вики и твои прошлые записи — выбираешь.', ms: 2200 },
  { t: 'Нашлась в вики — часы, выносливость и тип встали сами (у длительной: 24 ч, 3 выносливости).', ms: 2800 },
  { t: 'В описании пишешь «!Мод» и жмёшь Tab — вставилась строка «Модификаторы броска:», дописываешь «Сила +5».', ms: 3200 },
  { t: 'Пока не брошено — видно, что кинется: «(2d20+5) × 1.8 = ?». Значит, модификаторы подхватились.', ms: 2600 },
  { t: '«На проверку» — мастеру. «В черновик» — если пока только планируешь.', ms: 1800 },
  { t: 'Запись в журнале «на проверке», песочные часы сессии пополнились (сон 8 ч в день уже вычтен).', ms: 3000 }
]
// песочные часы сессии: уже записанное
const SEGS = [{ n: 'Заказ гильдии', h: 48, c: '#ff8a5b' }, { n: 'Свидание', h: 6, c: '#ff8cbe' }, { n: 'Изучение магии', h: 32, c: '#b9a6ff' }, { n: 'Покупки', h: 26, c: '#f0c35a' }]
</script>

<style scoped>
.wd { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: 12px; align-items: start; }
.wd-form { display: grid; gap: 7px; padding: 10px; border-radius: 12px; border: 1px solid rgba(231, 197, 111, .3); background: linear-gradient(180deg, rgba(231, 197, 111, .07), rgba(20, 16, 11, .9)); transition: all .6s cubic-bezier(.4, 0, .2, 1); }
.wd-form.sent { opacity: .35; transform: scale(.97); filter: saturate(.5); }
.wd-f { position: relative; display: grid; gap: 3px; }
.wd-grid { display: grid; grid-template-columns: 1fr 1fr 1.3fr; gap: 6px; }
.wd-area { min-height: 40px; }
.wd-sugg { position: absolute; z-index: 2; top: 100%; left: 0; right: 0; margin-top: 3px; display: grid; padding: 4px; border-radius: 9px; border: 1px solid rgba(231, 197, 111, .4); background: #17120c; box-shadow: 0 10px 22px rgba(0, 0, 0, .6); }
.wd-sugg div { padding: 4px 7px; border-radius: 6px; }
.wd-sugg div.on { background: rgba(231, 197, 111, .16); color: #f3dc9e; }
.wd-sugg small { color: #a8936c; margin-left: 4px; }
.wd-pop { position: absolute; z-index: 2; left: 34px; top: 26px; padding: 4px 9px; border-radius: 8px; border: 1px solid rgba(231, 197, 111, .45); background: #17120c; color: #f3dc9e; font-weight: 800; box-shadow: 0 8px 18px rgba(0, 0, 0, .6); }
.wd-pop kbd { margin-left: 6px; padding: 0 5px; border-radius: 4px; border: 1px solid rgba(231, 197, 111, .4); color: #a8936c; font-size: 10px; }
.wd-plan { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.wd-plan small { color: #a8936c; }
.wd-btns { display: flex; justify-content: flex-end; gap: 6px; }
.wd-log { display: grid; gap: 8px; }
.wd-glass { display: flex; height: 14px; border-radius: 99px; overflow: hidden; background: rgba(255, 255, 255, .06); border: 1px solid rgba(231, 197, 111, .15); }
.wd-glass i { height: 100%; }
@media (max-width: 640px) { .wd { grid-template-columns: minmax(0, 1fr); } }
</style>
