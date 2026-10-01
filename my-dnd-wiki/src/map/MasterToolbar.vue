<template>
  <div class="mt">
    <transition name="fade">
      <div v-if="hint" class="mt-hint ui-panel">{{ hint }}</div>
    </transition>

    <div v-if="isFogTool" class="fog-bar ui-panel">
      <label v-if="isBrushTool" class="brush">
        <span class="ui-kicker">Кисть</span>
        <input v-model.number="store.brush" type="range" min="5" max="160" />
        <b>{{ fmtKm(store.brush) }}</b>
      </label>
      <button class="ui-btn small" :disabled="!store.fogUndo.length" @click="undoFog" title="Отменить последний мазок (Ctrl+Z)"><Icon name="undo" :size="16" /> Отменить</button>
      <button class="ui-btn small" @click="fillFog" title="Закрыть туманом всю карту"><Icon name="fill" :size="16" /> Залить всё</button>
      <button class="ui-btn small danger" @click="clearFog" title="Убрать весь туман"><Icon name="fogOff" :size="16" /> Очистить</button>
      <label class="ui-check fog-on"><input type="checkbox" :checked="store.data.settings.fogEnabled" @change="toggleFog($event.target.checked)" /> Туман включён</label>
    </div>

    <div class="mt-bar ui-panel" role="toolbar" aria-label="Инструменты мастера">
      <template v-for="(g, gi) in GROUPS" :key="gi">
        <i v-if="gi" class="sep" />
        <button v-for="t in g" :key="t.id" class="tool" :class="{ active: store.tool === t.id }" :title="t.label + (t.key ? ` (${t.key})` : '')" @click="setTool(t.id)">
          <Icon :name="t.icon" :size="20" />
          <span>{{ t.short }}</span>
        </button>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount } from 'vue'
import Icon from './Icon.vue'
import { store, act, fmtKm } from './store.js'

const GROUPS = [
  [{ id: 'select', icon: 'select', short: 'Выбор', label: 'Выбор и перемещение', key: 'V' }],
  [
    { id: 'city', icon: 'cityAdd', short: 'Город', label: 'Поставить город', key: 'C' },
    { id: 'road', icon: 'road', short: 'Дорога', label: 'Проложить дорогу', key: 'R' },
    { id: 'zone', icon: 'zone', short: 'Зона', label: 'Аномалия-зона', key: 'A' },
    { id: 'point', icon: 'anomaly', short: 'Место', label: 'Аномалия-точка / место', key: 'P' },
    { id: 'party', icon: 'party', short: 'Отряд', label: 'Новый отряд' }
  ],
  [
    { id: 'fogBrush', icon: 'brush', short: 'Туман', label: 'Кисть тумана', key: 'F' },
    { id: 'fogErase', icon: 'eraser', short: 'Стереть', label: 'Стереть туман', key: 'E' },
    { id: 'fogLasso', icon: 'lasso', short: 'Лассо+', label: 'Туман по контуру' },
    { id: 'fogLassoErase', icon: 'lasso', short: 'Лассо−', label: 'Открыть по контуру' }
  ]
]

const HINTS = {
  city: 'Кликни по карте, чтобы поставить город',
  road: 'Кликай точки дороги. Двойной клик или Enter — готово, Backspace — шаг назад, Esc — отмена',
  zone: 'Кликни, где возникнет аномалия',
  point: 'Кликни, где находится место',
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

const KEYS = { v: 'select', c: 'city', r: 'road', a: 'zone', p: 'point', f: 'fogBrush', e: 'fogErase' }
function onKey(e) {
  if (e.target.closest?.('input, textarea, select') || e.altKey || e.metaKey) return
  if (e.ctrlKey && e.key.toLowerCase() === 'z') { e.preventDefault(); undoFog(); return }
  if (e.ctrlKey) return
  const t = KEYS[e.key.toLowerCase()] || KEYS[{ м: 'v', с: 'c', к: 'r', ф: 'a', з: 'p', а: 'f', у: 'e' }[e.key.toLowerCase()]]
  if (t) setTool(t)
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<style scoped>
.mt { position: absolute; left: 50%; bottom: 16px; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 8px; z-index: 18; max-width: calc(100% - 24px); }
.mt-bar { display: flex; align-items: center; gap: 2px; padding: 5px; overflow-x: auto; max-width: 100%; scrollbar-width: none; }
.tool { display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 56px; height: 52px; padding: 6px 6px 4px; border-radius: 10px; border: 1px solid transparent; background: none; color: var(--muted); font: 700 10.5px var(--sans); cursor: pointer; transition: all .15s; flex: none; }
.tool:hover { color: var(--text); background: rgba(255, 255, 255, 0.05); }
.tool.active { color: var(--gold-2); background: rgba(231, 197, 111, 0.15); border-color: rgba(231, 197, 111, 0.45); }
.sep { width: 1px; height: 32px; background: var(--line-2); margin: 0 4px; flex: none; }
.mt-hint { padding: 7px 14px; font-size: 12.5px; font-weight: 600; color: var(--gold-2); text-align: center; }
.fog-bar { display: flex; align-items: center; gap: 8px; padding: 8px 10px; flex-wrap: wrap; justify-content: center; }
.brush { display: flex; align-items: center; gap: 8px; min-width: 220px; }
.brush b { font-size: 12px; min-width: 52px; }
.fog-on { margin: 0 4px; font-size: 12.5px; }
</style>
