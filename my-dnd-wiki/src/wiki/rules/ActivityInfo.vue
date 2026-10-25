<template>
  <!-- «ⓘ Как это работает»: правила журнала деятельностей с живыми примерами (печать мастера, песочные часы,
       бросок, искры в тренировку) — всё на выдуманных записях, в настоящий журнал ничего не пишется -->
  <div class="ai-back" @click.self="$emit('close')">
    <div class="ai" role="dialog" aria-label="Как работает журнал деятельностей">
      <header class="ai-head">
        <LottieFx :data="glass" :size="54" loop />
        <div>
          <span class="ai-kick">Журнал деятельностей</span>
          <h2>Как это работает</h2>
        </div>
        <button type="button" class="ai-x" aria-label="Закрыть" @click="$emit('close')">✕</button>
      </header>
      <nav class="ai-tabs">
        <button v-for="t in TABS" :key="t.id" type="button" :class="{ on: tab === t.id }" @click="tab = t.id">{{ t.icon }} {{ t.name }}</button>
      </nav>

      <div class="ai-body">
        <!-- записать -->
        <section v-if="tab === 'write'">
          <p>Между сессиями герой чем-то занят: тренируется, спит, ходит в подземелье, на свидания. Всё это — <b>деятельности</b>.
            Между сессиями в «Gate» проходит <b>{{ limit }} ч</b> (14 дней), но <b>отдых вычитается сразу</b>: сон 8 ч в день оставляет
            <b>{{ limit - 14 * 8 }} ч</b> свободных, транс 4 ч (эльфы, дроу) — <b>{{ limit - 14 * 4 }} ч</b>. Их и раскладываешь.
            Обычный сон писать не нужно. Записанный отдых (восстановительный сон, транс от изнурения, день отдыха) — дополнительный и идёт в счёт.</p>
          <ol>
            <li>Выбери героя сверху и нажми <b>«＋ Деятельность»</b>.</li>
            <li>Начни писать название — сайт подскажет деятельности из вики и твои прошлые записи. Нашлась в вики — <b>тип и выносливость посчитаются сами</b> (часы × выносливость в час; отдых — с минусом).</li>
            <li>«В черновик» — для себя (планируешь), «На проверку» — мастеру.</li>
          </ol>
          <div class="ai-demo">
            <small>Пример: так заполняются песочные часы сессии — цвет показывает вид дела</small>
            <SessionBar :rows="demoRows.slice(0, grow)" :limit="limit" legend />
          </div>
          <p class="ai-tip">💡 Под каждой датой — свободные часы и выносливость («⏱ 180 / 224 ч»). Красный хвост с песком — часов больше, чем свободно.</p>
        </section>

        <!-- проверка -->
        <section v-else-if="tab === 'check'">
          <p>Запись игрока приходит мастеру <b>«на проверке»</b> (ему — уведомление и счётчик в меню). Мастер ставит
            <b style="color: #7ed07a">учтено</b>, <b style="color: #ff7a6b">провал</b>, <b style="color: #7fb4ff">условие</b> или <b style="color: #8f8574">отменено</b> — на запись падает печать.
            Пока запись не проверена — её можно править и удалить; проверенную правит только мастер.</p>
          <div class="ai-demo">
            <small>Пример: мастер проверяет запись (сама меняется каждые 3 секунды)</small>
            <ActivityRow :rec="demoRec" :hero="{ canWrite: false, trainings: [{ Id: 't', Name: 'Телосложение' }] }" />
          </div>
          <p class="ai-tip">💡 У мастера есть вкладка «⏳ На проверке» — все записи всех героев сразу и кнопка «✓ Учесть все».</p>
        </section>

        <!-- лист -->
        <section v-else-if="tab === 'sheet'">
          <p>Записи связаны с листом героя. В «Подробнее» можно указать:</p>
          <ul>
            <li><b>🏋 Тренировку</b> из листа — очки берутся из результата сами («42+1» → 43).</li>
            <li><b>💰 Монеты и ✦ опыт</b> — плюс получено, минус потрачено. «📜 Из заказа гильдии» подставит часы и награду заказа.
              Курс <b>1 к 100</b>: 100 бронзовых = 1 серебряный, 100 серебряных = 1 золотой. Не хватает мелких монет — при «учтено» крупная <b>разменяется сама</b>
              (было 1 зм 0 см, потратил 30 см → 0 зм 70 см). Не хватает совсем — в форме и у записи будет «⚠ не хватает денег», мастер это увидит.</li>
            <li><b>🎒 Вещи</b>: плюс — получено, минус — отдано или продано. Берутся из инвентаря героя — <b>склад или сумка, неважно</b>. Название подсказывается из инвентаря, а под вещью видно:
              <ul>
                <li><b>✓ в инвентаре: 3 шт.</b> — всё хорошо, при «учтено» уйдёт или прибавится.</li>
                <li><b>⚠ Не нашёл в инвентаре</b> — сайт спросит, точно ли вещь есть. Да — откроется окно: название, сколько есть, редкость, описание; вещь <b>сразу ляжет в инвентарь</b>, а при «учтено» уйдёт. У записи будет метка <b>«✨ не было в листе»</b> — мастер увидит.</li>
                <li><b>✦ новая вещь</b> (получил то, чего ещё нет) — кнопка «Описать»: редкость, описание, заметки. При «учтено» она ляжет в инвентарь уже с ними.</li>
              </ul>
              Пример продажи: <i>«Торговля»: 🎒 −1 Кинжал, 💰 +5 зм</i> — при «учтено» кинжал уйдёт, золото придёт; мастер снимет «учтено» — всё вернётся.</li>
            <li><b>😵 Изнурение</b> — сайт считает сам: отдых снимает, длительная тренировка не даёт. Подробно и с примерами — во вкладке <a href="#" @click.prevent="tab = 'exh'">😵 Изнурение</a>.</li>
          </ul>
          <p>Всё это уходит в лист, <b>когда мастер ставит «учтено»</b>. Поставил «провал» или удалил — возвращается обратно. Видно в истории листа.</p>
          <div class="ai-demo center">
            <div ref="trainDemo" class="ai-train"><span>🏋 Телосложение</span><i><b :style="{ width: trainPct + '%' }" /></i><small>{{ trainCur }}/200</small></div>
            <button ref="sparkBtn" type="button" class="ai-btn" @click="demoTrain">Учесть «+43» к тренировке</button>
          </div>
        </section>

        <!-- броски -->
        <section v-else-if="tab === 'dice'">
          <p>Кнопка <b>🎲</b> у записи бросает общие кубики сайта (их видит весь отряд) и записывает результат с пометкой <b>«брошено на сайте»</b> — его уже не переписать. Можно и вписать свои броски руками, как раньше.</p>
          <ul>
            <li><b>↻ Повторяемая</b> деятельность: каждое повторение в сессии даёт +1 к броску (до +10) — сайт считает сам.</li>
            <li><b>🏛 Место</b> из «Модификаторов» (библиотека 1к10, спорткомплекс 1к20…) — кость добавится в формулу один раз.</li>
            <li><b>🎓 Наставник</b> («Подробнее» в форме): имя и сколько он даёт — фиксированное число, прибавится к броску один раз. Совпало имя с НПС или героем — у записи будет ссылка.</li>
            <li><b>🍀 Монетка</b>: первая уникальная деятельность сессии — 50% не потратить выносливость. Бросает сервер, один раз за сессию.</li>
            <li><b>➕ Модификаторы из описания</b> складываются сами. Напиши в описании отдельной строкой:
              <code class="ai-code">Модификаторы броска: Красивая речь(+4), Анализ(+6), ОиГ(+3)</code>
              — кинется <b>1к20+13</b>. Слово может быть «броска», «бросков», «тренировки»; число — в скобках, комментарий после числа не мешает: <i>Ловкость рук(+10, взята с БМ)</i>.
              <i>Бонус повторения(+3)</i> или <i>Бонус повторения: +3</i> — берётся из текста (хоть отдельной строкой), не написан — сайт посчитает сам. Без числа (<i>Наставничество(+???)</i>, <i>Комплект(без травм)</i>) в бросок не войдёт — сайт подсветит «⚠ без числа».
              Слова <i>Преимущество</i> / <i>Помеха</i> в описании — бросок с преимуществом / помехой.</li>
            <li><b>❗ Заготовки</b>: в описании напиши <b>!</b> и начало — <i>!Мод</i>, <i>!Преи</i>, <i>!Пом</i>, <i>!Бон</i>, <i>!Рез</i>, <i>!Совм</i> — и нажми <b>Tab</b>: вставится «Модификаторы броска: », «Преимущество», «Помеха», «Бонус повторения: +», «Результат: », «Совместно с: ». Писать руками тоже можно.</li>
            <li><b>🎲 … = ?</b> — пока не брошено, у записи видно, что кинется: так сразу понятно, подхватились ли модификаторы. Наведи — увидишь средний итог.</li>
            <li><b>⏳ Длительная тренировка</b> («Длительная / Долгая тренировка…») — сутки вместе со сном: <b>24 ч</b> (эльф, отметка «🧝 Я эльф» в настройках, — <b>20 ч</b> с трансом), все часы идут в счёт свободных,
              <b>3 выносливости</b> у всех, <b>изнурения не даёт</b>. Бросок: <b>2к20 + все модификаторы один раз</b> (место, строка «Модификаторы броска», наставник), всё <b>× 1.35</b> (вниз), потом бонус повторения.
              Пример: 2к20 + 1к20 (библиотека) + 13 (интеллект) + 14 (наставник): выпало 14, 12 и 9 → <b>14+12+9+27 = 62 → × 1.35 = 83 → +2 повт. = 85</b>.</li>
            <li><b>×N — несколько длительных</b> одной записью: галочка «несколько» и число. Всё умножается (×4 — 96 ч, 12 выносливости), кубики кидаются 4 раза подряд, бонус повторения растёт: +0, +1, +2, +3 (до +10).
              У записи — каждый бросок и <b>Σ сумма</b>, до броска — средний итог.</li>
          </ul>
          <div class="ai-demo center">
            <div class="ai-die" :class="{ spin: rolling }">{{ die }}</div>
            <button type="button" class="ai-btn" :disabled="rolling" @click="demoRoll">Пример: 1d20 + 1к10 (библиотека) + 4 (5-й повтор)</button>
            <small v-if="dieNote">{{ dieNote }}</small>
          </div>
        </section>

        <!-- изнурение -->
        <section v-else-if="tab === 'exh'">
          <p><b>Изнурение</b> — эффект до <b>5</b>. Каждое снижает характеристики на 2 и <b>удваивает затраты выносливости</b>; на 5 накладывается эффект <b>«Сон»</b>.
            Сайт считает его сам и, когда мастер ставит <b>«учтено»</b>, записывает в лист героя (снимут «учтено» — вернётся как было).</p>
          <ul>
            <li><b>⏳ Длительная тренировка</b> изнурения <b>не даёт</b> и не снимает: сон уже внутри её суток (24 ч, у эльфа 20 ч).</li>
            <li><b>🌿 Любой записанный отдых</b> (отдых, сон, транс, медитация, свидания, чтение — всё из раздела «Отдых» в вики) снимает <b>1 за каждые 3 часа</b>:
              3 ч — 1, <b>6 ч (большой сон) — 2</b>, 9 ч — 3. Меньше 3 ч — ничего.</li>
            <li><b>⚡ Затраты выносливости ×2</b>, пока у героя есть изнурение: сайт сам подставит удвоенную выносливость в новую запись (отдых не удваивается — он её возвращает).</li>
            <li><b>😴 5 изнурений — «Сон».</b> У героя в шапке загорится «😴 5/5 · Сон», в форме — предупреждение, а у записи, которая доведёт до 5, — метка «😴 до 5 — Сон»: её увидит и мастер на проверке.</li>
            <li><b>Своё число</b> можно вписать в «Подробнее → Изнурение» (минус — снять) — тогда сайт возьмёт его, а не правило.</li>
          </ul>
          <div class="ai-demo">
            <small>Примеры (герой спит 8 ч; было 3 изнурения)</small>
            <table class="ai-ex">
              <tr><td>Длительная тренировка владения, 24 ч</td><td>сутки со сном</td><td>0</td><td>3 → 3</td></tr>
              <tr><td>Обычная тренировка, 8 ч · 0,2/ч</td><td>1,6 × 2 (изнурение)</td><td>⚡ 3,2</td><td>3</td></tr>
              <tr><td>Отдых (Чтение), 6 ч</td><td>6 / 3</td><td class="down">−2</td><td>3 → 1</td></tr>
              <tr><td>Свидание (Прогулка), 4 ч</td><td>4 / 3</td><td class="down">−1</td><td>1 → 0</td></tr>
              <tr><td>Отдых (Хобби), 2 ч</td><td>меньше 3 ч</td><td>0</td><td>0</td></tr>
            </table>
          </div>
          <p class="ai-tip">💡 Если в листе изнурение откатили руками в истории листа — так нельзя: то, что пришло из журнала, отменяется только снятием «учтено» в журнале (иначе снимется дважды).</p>
        </section>

        <!-- связи -->
        <section v-else-if="tab === 'links'">
          <ul>
            <li><b>📖 Название</b>, найденное в вики, — ссылка на правило: наведи, увидишь длительность и выносливость.</li>
            <li><b>С кем</b> — отметь других героев: запись появится и в их журналах (↔ «из журнала …», в их суммы не входит).</li>
            <li><b>📍 Где</b> — город на карте, по щелчку карта покажет его.</li>
            <li><b>⧉ Ещё раз</b> — повторить запись (для 12 одинаковых тренировок).</li>
            <li><b>★ Избранное</b> — свои заготовки: «Долгая тренировка (Тело) · 24 ч → тренировка «Тело»» — потом одной кнопкой.</li>
          </ul>
        </section>

        <!-- план -->
        <section v-else-if="tab === 'plan'">
          <p>Вкладка <b>🗓 План</b> раскладывает сессию по 14 дням. Отдых из настроек героя (сон, у эльфов — транс 4 ч) отложен в каждом дне. Карточки перетаскиваются между днями,
            день, где больше 24 часов, подсвечивается. Набросал черновики — <b>«📨 Отправить мастеру»</b> отправит их на проверку разом.</p>
          <p><b>⚙ Настройки героя</b>: <b>🧝 Я эльф</b> (транс 4 ч, длительная — 20 ч; мастер видит отметку), отдых в день — сон, транс, медитация, подзарядка и сколько часов (Кованому — 0), особенности, избранное. Мастер задаёт герою свой лимит часов и <b>запреты</b> («нельзя в подземелье — ранен»).</p>
          <p><b>⌛ Таймскип</b> (мастер): закрыть прошедший период — его больше не правят; заблокировать следующий — игроки могут только планировать черновики.</p>
        </section>

        <!-- статистика -->
        <section v-else>
          <p>Вкладка <b>📊 Статистика</b>: на что уходит время героя, самые частые дела, сколько попыток удачны, сколько очков ушло в тренировки,
            серия сессий с тренировками, часы по сессиям — и весь отряд рядом.</p>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import gsap from 'gsap'
import LottieFx from './LottieFx.vue'
import SessionBar from './SessionBar.vue'
import ActivityRow from './ActivityRow.vue'
import { hourglass } from './lottie.js'
import { celebrate, sparks } from './actFx.js'
import { sfx } from '../../sound/sound.js'

defineProps({ limit: { type: Number, default: 336 } })
defineEmits(['close'])
const TABS = [
  { id: 'write', icon: '✍', name: 'Записать' }, { id: 'check', icon: '🔏', name: 'Проверка' }, { id: 'sheet', icon: '📜', name: 'Лист' },
  { id: 'dice', icon: '🎲', name: 'Броски' }, { id: 'exh', icon: '😵', name: 'Изнурение' }, { id: 'links', icon: '🔗', name: 'Связи' }, { id: 'plan', icon: '🗓', name: 'План и настройки' }, { id: 'stats', icon: '📊', name: 'Статистика' }
]
const tab = ref('write')
const glass = hourglass()

// песочные часы заполняются по одной записи
const demoRows = [
  { name: 'Отдых (Сон)', hours: '96' }, { name: 'Долгая тренировка (Тело)', hours: '64' }, { name: 'Заказ гильдии: «Зачистка»', hours: '48' },
  { name: 'Изучение базовой магии', hours: '32' }, { name: 'Свидание (Парк)', hours: '6' }, { name: 'Поход за покупками', hours: '4' },
  { name: 'Телепорт в Ширатори', hours: '1' }, { name: 'Крафт: обычный предмет', hours: '30' }, { name: 'Долгая тренировка (Тело)', hours: '80' }
]
const grow = ref(0)
// запись, которую «проверяет мастер»
const STEPS = ['pending', 'done', 'pending', 'fail', 'pending', 'cancel']
const demoRec = ref({ id: 'demo', date: '2026-05-08', name: 'Долгая тренировка (Характеристика: Телосложение)', hours: '16', stamina: '3,2', type: 'repeat', status: 'pending', result: '42+1', trainId: 't', pts: 43 })
let step = 0, timer = 0
onMounted(() => {
  timer = setInterval(() => {
    grow.value = grow.value >= demoRows.length ? 1 : grow.value + 1
    if (tab.value === 'check') { step = (step + 1) % STEPS.length; demoRec.value = { ...demoRec.value, status: STEPS[step], applied: STEPS[step] === 'done' } }
  }, 1500)
})
watch(tab, () => { grow.value = 0 })
onBeforeUnmount(() => clearInterval(timer))

// очки в тренировку
const trainCur = ref(170)
const trainPct = ref(85)
const trainDemo = ref(null), sparkBtn = ref(null)
function demoTrain() {
  sparks(sparkBtn.value, trainDemo.value, '#7ed07a')
  sfx('bookPlace', 0.4)
  setTimeout(() => {
    const v = { n: trainCur.value }
    gsap.to(v, { n: Math.min(200, trainCur.value + 43), duration: 0.8, onUpdate: () => { trainCur.value = Math.round(v.n); trainPct.value = (v.n / 200) * 100 } })
    if (trainCur.value + 43 >= 200) setTimeout(() => { celebrate(trainDemo.value, true); sfx('crit', 0.5); trainCur.value = 200 }, 800)
  }, 700)
  setTimeout(() => { trainCur.value = 170; trainPct.value = 85 }, 4000)
}
// бросок для примера — не настоящими кубиками, чтобы не сыпать в ленту отряда
const die = ref('20')
const rolling = ref(false)
const dieNote = ref('')
function demoRoll() {
  rolling.value = true
  dieNote.value = ''
  sfx('diceShake')
  const d20 = 1 + Math.floor(Math.random() * 20), d10 = 1 + Math.floor(Math.random() * 10)
  let n = 0
  const t = setInterval(() => { die.value = String(1 + Math.floor(Math.random() * 20)); if (++n > 12) { clearInterval(t); die.value = String(d20 + d10 + 4); rolling.value = false; dieNote.value = `d20: ${d20} · d10: ${d10} · +4 повторения = ${d20 + d10 + 4}`; if (d20 === 20) celebrate(null) } }, 70)
}
</script>

<style scoped>
.ai-back { position: fixed; inset: 0; z-index: 500; display: grid; place-items: center; padding: 16px; background: rgba(5, 7, 11, .72); }
.ai { display: grid; grid-template-rows: auto auto minmax(0, 1fr); width: min(760px, 100%); max-height: min(760px, calc(100vh - 32px)); border-radius: 20px; background: linear-gradient(180deg, #1d1710, #14100b); border: 1px solid rgba(231, 197, 111, .35); box-shadow: 0 30px 70px rgba(0, 0, 0, .6); color: #efe3c8; overflow: hidden; animation: ai-in .25s ease; }
@keyframes ai-in { from { opacity: 0; transform: translateY(12px) scale(.98); } }
.ai-head { display: flex; align-items: center; gap: 12px; padding: 14px 16px 6px; }
.ai-head > div { flex: 1; }
.ai-kick { color: #a8936c; font: 800 11px 'Manrope', sans-serif; letter-spacing: .12em; text-transform: uppercase; }
.ai-head h2 { margin: 0; font: 700 28px 'Cormorant Garamond', serif; color: #f3dc9e; }
.ai-x { width: 34px; height: 34px; border-radius: 10px; border: 1px solid rgba(231, 197, 111, .25); background: none; color: #cdbf9f; cursor: pointer; }
.ai-tabs { display: flex; gap: 4px; overflow-x: auto; padding: 6px 16px 10px; border-bottom: 1px solid rgba(231, 197, 111, .12); }
.ai-tabs button { flex: none; padding: 6px 11px; border-radius: 99px; border: 1px solid rgba(231, 197, 111, .18); background: none; color: #cdbf9f; font: 700 12.5px 'Manrope', sans-serif; cursor: pointer; }
.ai-tabs button.on { background: rgba(231, 197, 111, .16); border-color: #e7c56f; color: #f3dc9e; }
.ai-body { overflow-y: auto; padding: 14px 18px 18px; font: 500 14px/1.6 'Manrope', sans-serif; }
.ai-body p { margin: 0 0 10px; }
.ai-body ul, .ai-body ol { margin: 0 0 10px; padding-left: 20px; }
.ai-body li { margin-bottom: 4px; }
.ai-body b { color: #f3dc9e; }
.ai-tip { padding: 8px 12px; border-radius: 10px; background: rgba(231, 197, 111, .07); color: #cdbf9f; }
.ai-demo { display: grid; gap: 8px; margin: 10px 0; padding: 12px; border-radius: 14px; border: 1px dashed rgba(231, 197, 111, .3); background: rgba(0, 0, 0, .2); }
.ai-demo > small { color: #a8936c; font: 700 11.5px 'Manrope', sans-serif; }
.ai-demo.center { justify-items: center; text-align: center; }
.ai-btn { padding: 8px 16px; border-radius: 10px; border: 1px solid #c9a24f; background: linear-gradient(180deg, #f0d083, #c9a24f); color: #1b1408; font: 800 13px 'Manrope', sans-serif; cursor: pointer; }
.ai-btn:disabled { opacity: .6; }
.ai-train { display: grid; grid-template-columns: auto 200px auto; align-items: center; gap: 8px; font: 700 13px 'Manrope', sans-serif; }
.ai-train i { height: 10px; border-radius: 99px; background: rgba(255, 255, 255, .06); overflow: hidden; }
.ai-train i b { display: block; height: 100%; background: linear-gradient(90deg, #3fae5a, #7ee06a); }
.ai-train small { color: #a8936c; }
.ai-die { display: grid; place-items: center; width: 70px; height: 70px; border-radius: 16px; background: radial-gradient(circle at 35% 30%, #3a2c18, #15110c); border: 2px solid #c9a24f; color: #f3dc9e; font: 900 28px 'Manrope', sans-serif; box-shadow: 0 0 20px rgba(231, 197, 111, .25); }
.ai-die.spin { animation: ai-spin .25s linear infinite; }
@keyframes ai-spin { 50% { transform: rotate(18deg) scale(1.08); } }
@media (max-width: 600px) { .ai-train { grid-template-columns: 1fr; } .ai-train i { width: 200px; } }
.ai-code { display: block; margin: 4px 0; padding: 5px 9px; border-radius: 8px; background: rgba(0, 0, 0, .35); border: 1px solid rgba(231, 197, 111, .2); color: #ffcf7a; font: 600 12.5px ui-monospace, Consolas, monospace; white-space: pre-wrap; }
.ai-ex { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.ai-ex td { padding: 5px 8px; border-bottom: 1px solid rgba(231, 197, 111, .12); color: #e9dfc8; }
.ai-ex td:first-child { color: #f3dc9e; font-weight: 700; }
.ai-ex td:nth-child(3) { font-weight: 800; white-space: nowrap; }
.ai-ex .up { color: #ffb3aa; } .ai-ex .down { color: #b4ecb0; }
</style>
