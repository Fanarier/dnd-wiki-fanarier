<template>
  <div v-if="hud || master" class="hud" :class="{ collapsed }">
    <button class="hud-toggle ui-panel" :title="collapsed ? 'Показать погоду и луну' : 'Свернуть'" @click="collapsed = !collapsed">
      <Icon name="weather" :size="18" />
      <span v-if="collapsed && hud?.weather?.tempDay" class="hud-mini">{{ hud.weather.tempDay }}° · {{ hud.moon?.north }}</span>
    </button>

    <template v-if="!collapsed">
      <div v-if="!hud" class="hud-card ui-panel empty">
        <div class="ui-muted">Панель погоды скрыта от игроков.</div>
        <button class="ui-btn small" @click="openEdit"><Icon name="edit" :size="15" /> Настроить</button>
      </div>

      <template v-else>
        <section class="hud-card ui-panel">
          <header><Icon name="weather" :size="17" /> <span class="ui-title">Погода</span></header>
          <dl>
            <div><dt>Локация</dt><dd>{{ hud.weather.location || '—' }}</dd></div>
            <div><dt>День</dt><dd>{{ temp(hud.weather.tempDay) }}</dd></div>
            <div><dt>Ночь</dt><dd>{{ temp(hud.weather.tempNight) }}</dd></div>
            <div><dt>Ветер</dt><dd>{{ hud.weather.wind || '—' }}</dd></div>
            <div><dt>Облачность</dt><dd>{{ hud.weather.clouds || '—' }}</dd></div>
            <div><dt>Осадки</dt><dd>{{ hud.weather.precipitation || '—' }}</dd></div>
          </dl>
        </section>

        <section class="hud-card ui-panel">
          <header>
            <Icon name="moon" :size="17" /> <span class="ui-title">Лунный виток: {{ hud.moon.cycle }}</span>
            <button v-if="master" class="ui-btn icon ghost small edit" title="Изменить" @click="openEdit"><Icon name="edit" :size="15" /></button>
          </header>
          <div class="season">
            <div class="ui-progress"><i :style="{ width: Math.min(100, (hud.moon.seasonDay / hud.moon.seasonLength) * 100) + '%' }" /></div>
            <span>{{ hud.moon.seasonDay }}/{{ hud.moon.seasonLength }} день сезона</span>
          </div>
          <dl>
            <div><dt>Север</dt><dd>{{ hud.moon.north || '—' }}</dd></div>
            <div><dt>Юг</dt><dd>{{ hud.moon.south || '—' }}</dd></div>
          </dl>
          <div v-for="(m, i) in hud.moon.meters" :key="i" class="meter">
            <div class="meter-top"><span>{{ m.name }}</span><b :style="{ color: lvl(m).color }">{{ lvl(m).label }}</b></div>
            <div class="meter-bar"><i :style="{ width: lvl(m).value + '%', background: lvl(m).color }" /></div>
          </div>
        </section>
      </template>
    </template>

    <!-- Редактор (мастер) -->
    <div v-if="editing" class="modal" @mousedown.self="editing = false">
      <form class="dialog ui-panel" @submit.prevent="save">
        <div class="ui-kicker">Мастер</div>
        <h2 class="ui-title">Погода и луна</h2>
        <label class="ui-check"><input v-model="f.visible" type="checkbox" /> Показывать игрокам</label>

        <div class="ui-kicker sec">Погода</div>
        <label class="ui-field"><span>Локация</span><input v-model="f.weather.location" class="ui-input" /></label>
        <div class="ui-row">
          <label class="ui-field"><span>Днём, °C</span><input v-model="f.weather.tempDay" class="ui-input" placeholder="+18" /></label>
          <label class="ui-field"><span>Ночью, °C</span><input v-model="f.weather.tempNight" class="ui-input" placeholder="+6" /></label>
        </div>
        <div class="ui-row">
          <label class="ui-field"><span>Ветер</span><input v-model="f.weather.wind" class="ui-input" list="hud-wind" /></label>
          <label class="ui-field"><span>Осадки</span><input v-model="f.weather.precipitation" class="ui-input" list="hud-prec" /></label>
        </div>
        <label class="ui-field"><span>Облачность</span><input v-model="f.weather.clouds" class="ui-input" list="hud-clouds" /></label>

        <div class="ui-kicker sec">Луна и сезон</div>
        <div class="ui-row">
          <label class="ui-field"><span>Лунный виток</span><input v-model.number="f.moon.cycle" type="number" min="0" class="ui-input" /></label>
          <label class="ui-field"><span>День сезона</span><input v-model.number="f.moon.seasonDay" type="number" min="0" class="ui-input" /></label>
          <label class="ui-field"><span>из</span><input v-model.number="f.moon.seasonLength" type="number" min="1" class="ui-input" /></label>
        </div>
        <div class="ui-row">
          <label class="ui-field"><span>Северное полушарие</span><input v-model="f.moon.north" class="ui-input" list="hud-seasons" /></label>
          <label class="ui-field"><span>Южное полушарие</span><input v-model="f.moon.south" class="ui-input" list="hud-seasons" /></label>
        </div>

        <div class="ui-kicker sec">Шкалы</div>
        <div v-for="(m, i) in f.moon.meters" :key="i" class="ui-row meter-row">
          <input v-model="m.name" class="ui-input" placeholder="Название" />
          <select v-model.number="m.level" class="ui-input">
            <option v-for="(l, li) in HUD_LEVELS" :key="li" :value="li">{{ l.label }}</option>
          </select>
          <button type="button" class="ui-btn icon danger" title="Убрать" @click="f.moon.meters.splice(i, 1)"><Icon name="delete" :size="16" /></button>
        </div>
        <button v-if="f.moon.meters.length < 8" type="button" class="ui-btn small" @click="f.moon.meters.push({ name: '', level: 0 })"><Icon name="plus" :size="15" /> Шкала</button>

        <datalist id="hud-wind"><option v-for="o in ['Штиль', 'Слабый', 'Умеренный', 'Сильный', 'Шторм', 'Ураган']" :key="o" :value="o" /></datalist>
        <datalist id="hud-prec"><option v-for="o in ['Нет', 'Морось', 'Дождь', 'Ливень', 'Снег', 'Метель', 'Град', 'Туман']" :key="o" :value="o" /></datalist>
        <datalist id="hud-clouds"><option v-for="o in ['Ясно', 'Перистые облака', 'Кучевые облака', 'Переменная облачность', 'Пасмурно', 'Грозовые тучи']" :key="o" :value="o" /></datalist>
        <datalist id="hud-seasons"><option v-for="o in ['Весна', 'Лето', 'Осень', 'Зима']" :key="o" :value="o" /></datalist>

        <div class="dialog-actions">
          <button type="button" class="ui-btn" @click="editing = false">Отмена</button>
          <button type="submit" class="ui-btn primary">Сохранить</button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import Icon from './Icon.vue'
import { store, isMaster, act } from './store.js'
import { HUD_LEVELS } from '../shared/catalog.js'

const master = isMaster
const hud = computed(() => store.data.hud)
const collapsed = ref(window.innerWidth <= 760)
const editing = ref(false)
const f = ref(null)

const lvl = m => HUD_LEVELS[m.level] || HUD_LEVELS[0]
const temp = t => (t ? (/^[+-]?\d/.test(t) && !/°/.test(t) ? `${t}°C` : t) : '—')

const EMPTY = {
  weather: { location: '', tempDay: '', tempNight: '', wind: '', clouds: '', precipitation: '' },
  moon: { cycle: 0, seasonDay: 1, seasonLength: 90, north: '', south: '', meters: [] },
  visible: true
}

function openEdit() {
  const h = hud.value || EMPTY
  f.value = JSON.parse(JSON.stringify({ ...EMPTY, ...h, weather: { ...EMPTY.weather, ...h.weather }, moon: { ...EMPTY.moon, ...h.moon } }))
  editing.value = true
}

async function save() {
  try {
    await act('PATCH', '/api/hud', f.value, 'Панель обновлена')
    editing.value = false
  } catch { /* тост */ }
}
</script>

<style scoped>
.hud { position: absolute; right: 16px; top: 76px; display: flex; flex-direction: column; align-items: flex-end; gap: 8px; z-index: 14; max-height: calc(100% - 170px); overflow-y: auto; scrollbar-width: none; }
.hud-toggle { width: 40px; height: 40px; display: grid; place-items: center; border-radius: 12px; color: var(--gold-2); cursor: pointer; flex: none; padding: 0; }
.collapsed .hud-toggle { width: auto; padding: 0 12px; display: flex; gap: 8px; }
.hud-mini { font: 700 12.5px var(--sans); color: var(--text); }
.hud-card { padding: 12px 14px; width: 250px; flex: none; }
.hud-card.empty { display: grid; gap: 8px; font-size: 13px; }
.hud-card header { display: flex; align-items: center; gap: 7px; color: var(--gold); margin-bottom: 8px; }
.hud-card header .ui-title { font-size: 19px; }
.hud-card .edit { margin-left: auto; width: 28px; height: 28px; }
dl { margin: 0; display: grid; gap: 3px; }
dl div { display: flex; justify-content: space-between; gap: 10px; font-size: 12.5px; }
dt { color: var(--muted); }
dd { margin: 0; font-weight: 700; text-align: right; }
.season { display: grid; gap: 4px; margin-bottom: 8px; font-size: 12px; color: var(--muted); }
.meter { margin-top: 8px; }
.meter-top { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; margin-bottom: 3px; }
.meter-bar { height: 8px; border-radius: 99px; background: rgba(255, 255, 255, 0.08); overflow: hidden; }
.meter-bar i { display: block; height: 100%; border-radius: inherit; transition: width .4s; }

.modal { position: fixed; inset: 0; background: rgba(5, 7, 11, 0.6); display: grid; place-items: center; z-index: 60; padding: 16px; backdrop-filter: blur(3px); }
.dialog { width: 100%; max-width: 520px; max-height: calc(100vh - 32px); overflow-y: auto; padding: 22px 22px 18px; }
.dialog h2 { margin: 2px 0 14px; font-size: 30px; }
.sec { margin: 14px 0 8px; color: var(--gold); }
.meter-row { margin-bottom: 8px; align-items: center; }
.meter-row > .ui-btn { flex: none; }
.dialog-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }

@media (max-width: 760px) {
  .hud { top: 106px; right: 8px; max-height: calc(100% - 210px); }
  .hud-card { width: min(250px, calc(100vw - 16px)); padding: 10px 12px; }
}
</style>
