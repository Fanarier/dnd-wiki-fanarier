<template>
  <aside class="legend ui-panel" :class="{ open }">
    <button class="legend-toggle" @click="open = !open" :aria-expanded="open">
      <Icon name="layers" :size="18" />
      <span>Слои и легенда</span>
      <Icon :name="open ? 'left' : 'right'" :size="18" class="chev" />
    </button>

    <div v-if="open" class="legend-body ui-scroll">
      <section>
        <div class="ui-kicker sec">Карта</div>
        <div class="toggles">
          <button v-for="l in BASE" :key="l.key" class="tgl" :class="{ on: store.layers[l.key] }" @click="store.layers[l.key] = !store.layers[l.key]">
            <Icon :name="l.icon" :size="17" /> {{ l.label }}
          </button>
        </div>
        <div class="ui-kicker sec">Объекты</div>
        <div class="toggles">
          <button v-for="l in OBJ" :key="l.key" class="tgl" :class="{ on: store.layers[l.key] }" @click="store.layers[l.key] = !store.layers[l.key]">
            <Icon :name="l.icon" :size="17" /> {{ l.label }}
          </button>
          <button v-if="master" class="tgl" :class="{ on: store.layers.fog }" @click="store.layers.fog = !store.layers.fog" title="Только у тебя: игроки туман видят всегда">
            <Icon name="fog" :size="17" /> Туман (у меня)
          </button>
          <button v-if="master" class="tgl" :class="{ on: store.layers.grid }" @click="store.layers.grid = !store.layers.grid" :title="`Клетка = ${grid.cellKm} км (меняется в ⚙)`">
            <Icon name="grid" :size="17" /> Сетка {{ grid.cellKm }} км
          </button>
          <button class="tgl" :class="{ on: store.layers.cursors }" @click="store.layers.cursors = !store.layers.cursors">
            <Icon name="cursors" :size="17" /> Курсоры мастеров
          </button>
        </div>
      </section>

      <section class="me">
        <div class="ui-kicker sec">Пинги</div>
        <div class="me-row">
          <input :value="store.nick" class="ui-input" maxlength="24" :placeholder="master ? 'Ты — мастер' : 'Твоё имя для пингов'" :disabled="master"
                 @change="setNick($event.target.value)" />
          <button class="ui-btn icon" :title="store.sound ? 'Звук пингов включён' : 'Звук пингов выключен'" @click="setSound(!store.sound)">
            <Icon :name="store.sound ? 'soundOn' : 'soundOff'" :size="18" />
          </button>
        </div>
        <div class="ui-muted tiny">Alt+клик или долгое нажатие — пинг, его увидят все. Alt+Shift — «опасность».</div>
      </section>

      <section v-if="travelling.length">
        <div class="ui-kicker sec">Отряды в пути</div>
        <button v-for="p in travelling" :key="p.id" class="trip" @click="focus('parties', p)">
          <i class="pdot" :style="{ background: p.color }" />
          <div class="trip-main">
            <div class="trip-top"><b>{{ p.name }}</b><span class="ui-muted">{{ p.j.waiting ? 'ждёт старта' : Math.round(p.j.progress * 100) + '%' }}</span></div>
            <div class="ui-progress"><i :style="{ width: p.j.progress * 100 + '%', background: p.color }" /></div>
            <div class="ui-muted tiny">{{ p.j.waiting ? 'выступит ' + fmtDateTime(p.journey.startAt) : 'прибудет через ' + fmtDuration(p.journey.endAt - store.now) }}</div>
          </div>
        </button>
      </section>

      <section>
        <div class="ui-kicker sec">Легенда</div>
        <div class="leg-grid">
          <div class="leg"><img src="/icons/elven-castle.png" class="leg-img" alt="" /> Столица</div>
          <div class="leg"><svg width="22" height="22" viewBox="-11 -11 22 22"><rect x="-5" y="-5" width="10" height="10" rx="2" fill="#f6ecd6" stroke="#3b2a1a" stroke-width="1.6" /></svg> Город</div>
          <div class="leg"><svg width="22" height="22" viewBox="-11 -11 22 22"><rect x="-5" y="-5" width="10" height="10" rx="2" fill="#f6ecd6" stroke="#3b2a1a" stroke-width="1.6" transform="rotate(45)" /></svg> Крепость</div>
          <div class="leg"><svg width="22" height="22" viewBox="-11 -11 22 22"><circle r="3.6" fill="#2a1d12" stroke="#f6ecd6" stroke-width="1.4" /></svg> Поселение</div>
          <div v-for="(r, k) in ROAD_TYPES" :key="k" class="leg">
            <svg width="22" height="22">
              <line x1="1" y1="11" x2="21" y2="11" :stroke="r.color" :stroke-width="r.width" :stroke-dasharray="r.dash" stroke-linecap="round" />
              <line v-if="r.overlay" x1="1" y1="11" x2="21" y2="11" :stroke="r.overlay.color" :stroke-width="r.overlay.width" :stroke-dasharray="r.overlay.dash" />
            </svg> {{ r.label }}
          </div>
        </div>
        <div class="ui-kicker sec small-sec leg-head">
          Метки
          <button class="link" @click="allMarks = !allMarks">{{ allMarks ? 'Только на карте' : 'Все типы' }}</button>
        </div>
        <template v-for="(list, g) in markGroups" :key="g">
          <div class="leg-group">{{ g }}</div>
          <div class="leg-grid">
            <div v-for="[k, e] in list" :key="k" class="leg"><img :src="`/icons/${e.img}.png`" class="leg-img" alt="" /> {{ e.label }}</div>
          </div>
        </template>
        <div v-if="!Object.keys(markGroups).length" class="ui-muted tiny">На карте пока нет меток.</div>

        <div class="ui-kicker sec small-sec">Аномалии</div>
        <div class="leg-grid">
          <div v-for="(e, k) in ZONE_EFFECTS" :key="k" class="leg">
            <i class="zone-dot" :style="{ background: `radial-gradient(circle, ${e.color} 0%, ${e.glow} 60%, transparent 72%)` }" /> {{ e.label }}
          </div>
        </div>
        <div class="leg fog-leg"><i class="fog-dot" /> Туман войны — неизведанные земли</div>
        <div class="credit">Иконки: game-icons.net (CC BY 3.0)</div>
      </section>

      <section v-if="statesList.length">
        <div class="ui-kicker sec">Народы ({{ statesList.length }})</div>
        <div class="states">
          <button v-for="s in statesList" :key="s.id" class="state" @click="focus('states', s)">
            <i class="swatch" :style="{ background: s.color }" />{{ s.name }}
          </button>
        </div>
      </section>
    </div>
  </aside>
</template>

<script setup>
import { computed, ref } from 'vue'
import Icon from './Icon.vue'
import { ICONS } from './icons.js'
import { store, isMaster, fmtDuration, fmtDateTime, setNick, setSound } from './store.js'
import { ROAD_TYPES, ZONE_EFFECTS, POINT_EFFECTS } from '../shared/catalog.js'
import { journeyState } from '../shared/geo.js'

const emit = defineEmits(['focus'])
const master = isMaster
const grid = computed(() => store.data.settings.grid || { cellKm: 10 })

// метки: по умолчанию только те типы, что реально стоят на карте
const allMarks = ref(false)
const markGroups = computed(() => {
  const used = new Set(store.data.anomalies.filter(a => a.kind === 'point').map(a => a.effect))
  const out = {}
  for (const [k, e] of Object.entries(POINT_EFFECTS)) {
    if (allMarks.value || used.has(k)) (out[e.group] ||= []).push([k, e])
  }
  return out
})
const open = ref(window.innerWidth > 760)

const BASE = [
  { key: 'states', label: 'Народы', icon: 'states' },
  { key: 'borders', label: 'Границы', icon: 'shape' },
  { key: 'rivers', label: 'Реки', icon: 'rivers' },
  { key: 'labels', label: 'Подписи', icon: 'labels' },
  { key: 'relief', label: 'Горы и леса', icon: 'relief' },
  { key: 'biomes', label: 'Биомы', icon: 'biomes' },
  { key: 'heights', label: 'Высоты', icon: 'heights' }
]
const OBJ = [
  { key: 'cities', label: 'Города', icon: 'castle' },
  { key: 'towns', label: 'Поселения', icon: 'home' },
  { key: 'roads', label: 'Дороги', icon: 'roadType' },
  { key: 'routes', label: 'Маршруты', icon: 'ship' },
  { key: 'quests', label: 'Заказы гильдий', icon: 'note' },
  { key: 'anomalies', label: 'Аномалии', icon: 'anomaly' },
  { key: 'parties', label: 'Отряды', icon: 'party' }
]

const travelling = computed(() => store.data.parties
  .map(p => ({ ...p, j: journeyState(p.journey, store.now) }))
  .filter(p => p.j && !p.j.done))

const statesList = computed(() => [...store.data.states].filter(s => s.name !== '???').sort((a, b) => a.name.localeCompare(b.name, 'ru')))

function focus(type, obj) {
  store.selection = { type, id: obj.id }
  emit('focus', type, obj)
  if (window.innerWidth <= 760) open.value = false
}
</script>

<style scoped>
.legend { position: absolute; top: 76px; left: 16px; width: 300px; max-height: calc(100% - 170px); display: flex; flex-direction: column; z-index: 15; overflow: hidden; }
.legend:not(.open) { width: auto; }
.legend-toggle { display: flex; align-items: center; gap: 9px; height: 44px; padding: 0 14px; background: none; border: 0; color: var(--text); font: 700 13px var(--sans); cursor: pointer; width: 100%; }
.legend-toggle .chev { margin-left: auto; color: var(--muted); }
.legend-body { padding: 0 14px 14px; }
.sec { margin: 12px 0 8px; }
.small-sec { margin-top: 14px; }
.toggles { display: flex; flex-wrap: wrap; gap: 6px; }
.tgl { display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 10px; border-radius: 99px; border: 1px solid var(--line-2); background: rgba(255, 255, 255, 0.03); color: var(--muted); font: 600 12.5px var(--sans); cursor: pointer; transition: all .15s; }
.tgl:hover { color: var(--text); }
.tgl.on { color: var(--gold-2); border-color: rgba(231, 197, 111, 0.45); background: rgba(231, 197, 111, 0.12); }
.trip { display: flex; gap: 10px; align-items: flex-start; width: 100%; text-align: left; padding: 9px 10px; margin-bottom: 6px; border-radius: 10px; border: 1px solid var(--line-2); background: rgba(255, 255, 255, 0.03); color: var(--text); cursor: pointer; font: 500 13px var(--sans); }
.trip:hover { border-color: rgba(231, 197, 111, 0.35); }
.pdot { width: 10px; height: 10px; border-radius: 50%; margin-top: 4px; flex: none; }
.trip-main { flex: 1; display: grid; gap: 5px; min-width: 0; }
.trip-top { display: flex; justify-content: space-between; gap: 8px; }
.tiny { font-size: 11.5px; }
.leg-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 10px; }
.leg { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--text); min-height: 24px; }
.leg svg { flex: none; }
.zone-dot { width: 18px; height: 18px; border-radius: 50%; flex: none; margin: 0 2px; }
.poi-ico { width: 20px; height: 20px; border-radius: 50%; display: grid; place-items: center; background: #120d1f; border: 1.5px solid currentColor; flex: none; margin: 0 1px; }
.fog-leg { margin-top: 8px; }
.leg-img { width: 20px; height: 20px; flex: none; margin: 0 1px; }
.leg-head { display: flex; justify-content: space-between; align-items: center; }
.leg-group { font-size: 11px; font-weight: 700; color: var(--muted); margin: 8px 0 4px; }
.link { background: none; border: 0; color: var(--gold-2); font: 700 11px var(--sans); cursor: pointer; text-transform: none; letter-spacing: 0; }
.credit { margin-top: 10px; font-size: 10.5px; color: var(--muted); }
.me-row { display: flex; gap: 6px; margin-bottom: 6px; }
.me-row .ui-input { min-height: 34px; }
.fog-dot { width: 20px; height: 14px; border-radius: 6px; flex: none; background: radial-gradient(circle at 30% 40%, #6b7383, #2b3140 70%); box-shadow: 0 0 6px #6b7383; }
.states { display: flex; flex-wrap: wrap; gap: 5px; }
.state { display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 9px; border-radius: 8px; border: 0; background: rgba(255, 255, 255, 0.05); color: var(--text); font: 600 12px var(--sans); cursor: pointer; }
.state:hover { background: rgba(231, 197, 111, 0.15); }
.swatch { width: 9px; height: 9px; border-radius: 2px; }

@media (max-width: 760px) {
  .legend { top: 106px; left: 8px; max-height: calc(100% - 200px); width: calc(100% - 16px); }
  .legend:not(.open) { width: auto; }
}
</style>
