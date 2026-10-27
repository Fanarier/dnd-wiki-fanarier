<template>
  <div class="mt">
    <transition name="fade">
      <div v-if="hint" class="mt-hint ui-panel">{{ hint }}</div>
    </transition>

    <div v-if="isFogTool && master" class="fog-bar ui-panel">
      <label v-if="isBrushTool" class="brush">
        <span class="ui-kicker">Кисть</span>
        <input v-model.number="store.brush" type="range" min="5" max="160" />
        <b>{{ fmtKm(store.brush) }}</b>
      </label>
      <button class="ui-btn small" :disabled="!store.fogUndo.length" @click="undoFog" title="Убрать последний мазок тумана"><Icon name="undo" :size="16" /> Отменить</button>
      <button class="ui-btn small" @click="fillFog" title="Закрыть туманом всю карту"><Icon name="fill" :size="16" /> Залить всё</button>
      <button class="ui-btn small danger" @click="clearFog" title="Убрать весь туман"><Icon name="fogOff" :size="16" /> Очистить</button>
      <label class="ui-check fog-on"><input type="checkbox" :checked="store.data.settings.fogEnabled" @change="toggleFog($event.target.checked)" /> Туман включён</label>
    </div>

    <div class="mt-bar ui-panel" role="toolbar" aria-label="Инструменты мастера">
      <template v-if="master">
        <button class="tool" :disabled="!history.undo.length || history.busy" title="Отменить (Ctrl+Z). Ещё: Ctrl+C / Ctrl+X / Ctrl+V — копировать, вырезать, вставить под курсор; Ctrl+D — дубликат; Delete — удалить; стрелки — сдвинуть" @click="undo"><Icon name="undo" :size="20" /><span>Отмена</span></button>
        <button class="tool" :disabled="!history.redo.length || history.busy" title="Вернуть (Ctrl+Y или Ctrl+Shift+Z)" @click="redo"><Icon name="redo" :size="20" /><span>Вернуть</span></button>
        <i class="sep" />
      </template>
      <template v-for="(g, gi) in groups" :key="gi">
        <i v-if="gi" class="sep" />
        <!-- телефон: объекты и туман свёрнуты в кнопку-группу, раскрываются по нажатию -->
        <button v-if="narrow && gi" class="tool grp" :class="{ active: g.some(t => t.id === store.tool), open: openGroup === gi }" @click="openGroup = openGroup === gi ? -1 : gi">
          <Icon :name="GROUP_META[gi].icon" :size="20" />
          <span>{{ GROUP_META[gi].short }} {{ openGroup === gi ? '▸' : '◂' }}</span>
        </button>
        <template v-if="!narrow || !gi || openGroup === gi">
          <button v-for="t in g" :key="t.id" class="tool" :class="{ active: store.tool === t.id }" :title="t.label + (t.key ? ` (${t.key})` : '')" @click="setTool(t.id)">
            <Icon :name="t.icon" :size="20" />
            <span>{{ t.short }}</span>
          </button>
        </template>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import Icon from './Icon.vue'
import { store, act, fmtKm, isMaster } from './store.js'
import { history, undo, redo } from './history.js'

const master = isMaster

// Первая группа — для всех (игроки тоже меряют и пингуют), остальное — только мастеру
const COMMON = [
  { id: 'select', icon: 'select', short: 'Выбор', label: 'Выбор и перемещение', key: 'V' },
  { id: 'ruler', icon: 'ruler', short: 'Линейка', label: 'Линейка', key: 'M' },
  { id: 'ping', icon: 'pingTool', short: 'Пинг', label: 'Пинг для всех (или Alt+клик / долгое нажатие)', key: 'G' }
]
const NOTE_TOOL = { id: 'note', icon: 'note', short: 'Заметка', label: 'Личная заметка на карте', key: 'N' }
const GROUPS = [
  COMMON,
  [
    { id: 'city', icon: 'cityAdd', short: 'Город', label: 'Поставить город', key: 'C' },
    { id: 'label', icon: 'label', short: 'Подпись', label: 'Подпись на карте (море, горы, регион)', key: 'T' },
    { id: 'road', icon: 'road', short: 'Дорога', label: 'Проложить дорогу', key: 'R' },
    { id: 'route', icon: 'ship', short: 'Маршрут', label: 'Маршрут с остановками (морской путь)', key: 'W' },
    { id: 'zone', icon: 'zone', short: 'Зона', label: 'Аномалия-зона', key: 'A' },
    { id: 'point', icon: 'anomaly', short: 'Метка', label: 'Метка: задание, подземелье, порт…', key: 'P' },
    { id: 'party', icon: 'party', short: 'Отряд', label: 'Новый отряд' }
  ],
  [
    { id: 'fogBrush', icon: 'brush', short: 'Туман', label: 'Кисть тумана', key: 'F' },
    { id: 'fogErase', icon: 'eraser', short: 'Стереть', label: 'Стереть туман', key: 'E' },
    { id: 'fogLasso', icon: 'lasso', short: 'Лассо+', label: 'Туман по контуру' },
    { id: 'fogLassoErase', icon: 'lasso', short: 'Лассо−', label: 'Открыть по контуру' }
  ]
]

// узкий экран — группы инструментов мастера свёрнуты
const GROUP_META = { 1: { icon: 'cityAdd', short: 'Объекты' }, 2: { icon: 'brush', short: 'Туман' } }
const narrowMq = matchMedia('(max-width: 760px)')
const narrow = ref(narrowMq.matches)
const onNarrow = e => { narrow.value = e.matches }
const openGroup = ref(-1)
// заметка — для вошедших; гостям только выбор и линейка
const groups = computed(() => {
  const common = store.me ? [...COMMON, NOTE_TOOL] : COMMON.filter(t => t.id !== 'ping')
  return master.value ? [common, ...GROUPS.slice(1)] : [common]
})

const HINTS = {
  note: 'Кликни, где поставить заметку — её видишь только ты (или твой отряд)',
  ruler: 'Кликай точки — длина пути. Протяни — замер по прямой. Двойной клик или Enter — готово, Esc — убрать',
  ping: 'Кликни — пинг увидят все. Ещё: Alt+клик (Alt+Shift — «опасность») или долгое нажатие',
  label: 'Кликни, где поставить подпись',
  city: 'Кликни по карте, чтобы поставить город',
  route: 'Кликай точки маршрута (по морю — вдоль берега). Двойной клик или Enter — готово, потом добавь остановки',
  road: 'Кликай точки дороги. Двойной клик или Enter — готово, Backspace — шаг назад, Esc — отмена',
  zone: 'Кликни, где возникнет аномалия',
  point: 'Кликни, где поставить метку',
  party: 'Кликни, где стоит отряд',
  fogBrush: 'Рисуй, чтобы скрыть земли от игроков',
  fogErase: 'Рисуй, чтобы открыть земли',
  fogLasso: 'Обведи область — она скроется',
  fogLassoErase: 'Обведи область — она откроется'
}

const isFogTool = computed(() => store.tool.startsWith('fog'))
const isBrushTool = computed(() => ['fogBrush', 'fogErase'].includes(store.tool))
const hint = computed(() => {
  if (store.journeyPlan) return 'Кликай по карте — точки маршрута отряда'
  if (store.pick?.purpose === 'questLoc') return 'Кликни, где находится цель заказа'
  if (store.pick?.purpose === 'routeStop') return 'Кликни на линию маршрута — там встанет остановка'
  if (store.pick?.purpose === 'moveRoad') return 'Кликни по дороге или морскому маршруту — метка пойдёт по нему'
  if (store.pick?.purpose === 'moveRoadEnd') return 'Кликни, докуда идти по выбранной линии. Esc — отмена'
  if (store.pick?.purpose === 'moveStop') return 'Кликни на путь метки — там будет стоянка. Esc — отмена'
  if (store.draft?.kind === 'move') return 'Кликай точки пути метки. Двойной клик или Enter — готово, Backspace — шаг назад, Esc — отмена'
  if (store.pick) return 'Кликни, куда будет двигаться аномалия'
  return HINTS[store.tool] || ''
})

function setTool(id) {
  store.journeyPlan = null
  store.pick = null
  store.tool = store.tool === id && id !== 'select' ? 'select' : id
  if (id !== 'select') store.selection = null
}

async function undoFog() {
  const id = store.fogUndo.pop()
  if (id) await act('DELETE', `/api/fog/${id}`).catch(() => {})
}
async function fillFog() {
  if (!confirm('Закрыть туманом всю карту? Потом можно открывать области стиранием.')) return
  await act('POST', '/api/fog/fill', {}, 'Карта скрыта туманом').catch(() => {})
  store.fogUndo = []
}
async function clearFog() {
  if (!confirm('Убрать весь туман? Игроки увидят всю карту.')) return
  await act('POST', '/api/fog/clear', {}, 'Туман рассеян').catch(() => {})
  store.fogUndo = []
}
const toggleFog = on => act('PATCH', '/api/settings', { fogEnabled: on }, on ? 'Туман включён' : 'Туман выключен для всех').catch(() => {})

const KEYS = { v: 'select', m: 'ruler', g: 'ping', n: 'note', c: 'city', t: 'label', r: 'road', w: 'route', a: 'zone', p: 'point', f: 'fogBrush', e: 'fogErase' }
const RU = { м: 'v', ь: 'm', п: 'g', т: 'n', с: 'c', е: 't', к: 'r', ц: 'w', ф: 'a', з: 'p', а: 'f', у: 'e' }
const PLAYER_TOOLS = ['select', 'ruler', 'ping', 'note']
function onKey(e) {
  // печатаешь (поле ввода или текст с оформлением) — буквы не переключают инструменты
  if (e.target.closest?.('input, textarea, select, [contenteditable]') || e.altKey || e.metaKey) return
  if (e.ctrlKey) return
  const k = e.key.toLowerCase()
  const t = KEYS[k] || KEYS[RU[k]]
  if (t && (master.value || PLAYER_TOOLS.includes(t))) setTool(t)
}
onMounted(() => { window.addEventListener('keydown', onKey); narrowMq.addEventListener('change', onNarrow) })
onBeforeUnmount(() => { window.removeEventListener('keydown', onKey); narrowMq.removeEventListener('change', onNarrow) })
</script>

<style scoped>
.mt { position: absolute; left: 50%; bottom: 16px; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 8px; z-index: 18; max-width: calc(100% - 24px); }
.mt-bar { display: flex; align-items: center; gap: 2px; padding: 5px; overflow-x: auto; max-width: 100%; scrollbar-width: none; }
.tool { display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 56px; height: 52px; padding: 6px 6px 4px; border-radius: 10px; border: 1px solid transparent; background: none; color: var(--muted); font: 700 10.5px var(--sans); cursor: pointer; transition: all .15s; flex: none; }
.tool:hover { color: var(--text); background: rgba(255, 255, 255, 0.05); }
.tool:disabled { opacity: .35; cursor: default; background: none; }
.tool.active { color: var(--gold-2); background: rgba(231, 197, 111, 0.15); border-color: rgba(231, 197, 111, 0.45); }
.tool.grp { border-style: dashed; border-color: rgba(231, 197, 111, .3); }
.tool.grp.open { color: var(--gold-2); }
.sep { width: 1px; height: 32px; background: var(--line-2); margin: 0 4px; flex: none; }
.mt-hint { padding: 7px 14px; font-size: 12.5px; font-weight: 600; color: var(--gold-2); text-align: center; }
.fog-bar { display: flex; align-items: center; gap: 8px; padding: 8px 10px; flex-wrap: wrap; justify-content: center; }
.brush { display: flex; align-items: center; gap: 8px; min-width: 220px; }
.brush b { font-size: 12px; min-width: 52px; }
.fog-on { margin: 0 4px; font-size: 12.5px; }
/* телефон: панель начинается правее кнопки кубиков, чтобы та не закрывала первый инструмент */
@media (max-width: 760px) {
  .mt { left: 70px; right: 8px; bottom: 14px; transform: none; max-width: none; align-items: stretch; }
  .mt-bar { align-self: flex-start; flex-wrap: wrap; overflow: visible; }
  /* телефон: только значки, панель переносится на вторую строку вместо прокрутки вбок */
  .tool { min-width: 42px; height: 42px; padding: 4px; justify-content: center; }
  .tool span { display: none; }
  .tool.grp span { display: block; font-size: 9.5px; }
  .tool.grp { min-width: 64px; }
  .sep { height: 26px; margin: 0 2px; }
}
</style>
