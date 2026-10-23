<template>
  <!-- Статус группы: кто в группе (мест = игроков + 3) и кто в лагере, компаньоны, цели группы, эффекты местности.
       Правит мастер (перетаскивание между группой, лагерем и компаньонами; секретные цели игроки видят как «???») -->
  <section class="ps">
    <header class="ps-head">
      <div>
        <h1><span class="ps-fire">🔥</span> Статус группы</h1>
        <p>{{ party.slots.length }} из {{ cap }} в группе · в лагере {{ party.camp.length }} · компаньонов {{ party.companions.length }}</p>
      </div>
      <label v-if="master" class="ps-players" title="Мест в группе = игроков + 3">
        Игроков <input :value="party.players" type="number" min="1" max="30" @change="setPlayers($event)" />
        <small>→ мест {{ cap }}</small>
      </label>
    </header>

    <!-- группа и лагерь: карточки героев; мастер перетаскивает между списками -->
    <div class="ps-grid">
      <div class="ps-card ps-party">
        <h2>⚔ Группа <small>{{ party.slots.length }} / {{ cap }}</small></h2>
        <VueDraggable v-model="slotsModel" :group="{ name: 'party', put: () => party.slots.length < cap }" :disabled="!master" draggable=".pc"
                      :animation="220" ghost-class="pc-ghost" class="ps-slots">
          <HeroSlot v-for="id in party.slots" :key="id" :hero="heroOf(id)" :master="master" :moves="['camp', 'companions']" @move="to => move(id, to)" @remove="remove(id)" />
          <button v-for="k in free" :key="'f' + k" type="button" class="ph" :disabled="!master" :title="master ? 'Поставить героя' : 'Свободное место'" @click="openPick('slots')">
            <span>{{ master ? '＋' : '' }}</span><small>свободно</small>
          </button>
        </VueDraggable>
      </div>

      <div class="ps-card ps-camp">
        <h2>⛺ Лагерь <small>{{ party.camp.length }}</small></h2>
        <VueDraggable v-model="campModel" group="party" :disabled="!master" draggable=".pc" :animation="220" ghost-class="pc-ghost" class="ps-slots small">
          <HeroSlot v-for="id in party.camp" :key="id" :hero="heroOf(id)" :master="master" small :moves="['slots', 'companions']" @move="to => move(id, to)" @remove="remove(id)" />
          <button v-if="master" type="button" class="ph add" @click="openPick('camp')"><span>＋</span><small>в лагерь</small></button>
        </VueDraggable>
        <p v-if="!party.camp.length && !master" class="ps-empty">В лагере никого.</p>
      </div>

      <div class="ps-card ps-comp">
        <h2>🐾 Компаньоны <small>{{ party.companions.length }}</small></h2>
        <VueDraggable v-model="compModel" group="party" :disabled="!master" draggable=".pc" :animation="220" ghost-class="pc-ghost" class="ps-slots small">
          <HeroSlot v-for="id in party.companions" :key="id" :hero="heroOf(id)" :master="master" small :moves="['slots', 'camp']" @move="to => move(id, to)" @remove="remove(id)" />
          <button v-if="master" type="button" class="ph add" @click="openPick('companions')"><span>＋</span><small>компаньон</small></button>
        </VueDraggable>
        <p v-if="!party.companions.length && !master" class="ps-empty">Компаньонов пока нет.</p>
      </div>
    </div>

    <!-- цели группы -->
    <div class="ps-card ps-goals">
      <h2>🎯 Цели группы <small>активных {{ active.length }}{{ doneGoals.length ? ` · выполнено ${doneGoals.length}` : '' }}</small>
        <button v-if="master" type="button" class="ps-btn" @click="newGoal">＋ Цель</button>
      </h2>
      <div class="ps-cols">
        <div v-for="col in COLS" :key="col.kind" class="ps-col" :class="col.kind">
          <h3>{{ col.title }} <small>{{ active.filter(g => g.kind === col.kind).length }}</small></h3>
          <TransitionGroup name="goal" tag="div" class="ps-goal-list">
            <GoalRow v-for="g in active.filter(g => g.kind === col.kind)" :key="g.id" :goal="g" :master="master" :quests="quests"
                     :editing="editGoal === g.id" @toggle="toggleGoal(g)" @edit="editGoal = editGoal === g.id ? null : g.id" @save="p => patchGoal(g.id, p)" @reveal="patchGoal(g.id, { secret: false }, 'Цель раскрыта')"
                     @remove="removeGoal(g)" />
          </TransitionGroup>
          <p v-if="!active.some(g => g.kind === col.kind)" class="ps-empty">{{ col.kind === 'main' ? 'Главных целей сейчас нет.' : 'Побочных целей нет.' }}</p>
        </div>
      </div>
      <details v-if="doneGoals.length" class="ps-done">
        <summary>✔ Выполненные цели ({{ doneGoals.length }})</summary>
        <GoalRow v-for="g in doneGoals" :key="g.id" :goal="g" :master="master" :quests="quests" :editing="editGoal === g.id"
                 @toggle="toggleGoal(g)" @edit="editGoal = editGoal === g.id ? null : g.id" @save="p => patchGoal(g.id, p)" @reveal="patchGoal(g.id, { secret: false }, 'Цель раскрыта')" @remove="removeGoal(g)" />
      </details>
    </div>

    <!-- эффекты местности: где сейчас группа и в лагере -->
    <div class="ps-terrain">
      <div v-for="t in TERRAINS" :key="t.key" class="ps-card ps-place" :class="t.key">
        <h2>{{ t.icon }} {{ t.title }}</h2>
        <input v-if="master" :value="party[t.key].name" class="ps-place-name" :placeholder="t.ph" @change="setPlace(t.key, $event.target.value)" />
        <div v-else-if="party[t.key].name" class="ps-place-name ro">{{ party[t.key].name }}</div>
        <div class="ps-fx">
          <div v-for="e in party[t.key].effects" :key="e.id" class="te" :class="e.tone" tabindex="0">
            <img v-if="e.img" :src="e.img" alt="" />
            <span v-else class="te-ic">{{ e.tone === 'good' ? '▲' : e.tone === 'bad' ? '▼' : '✦' }}</span>
            <b>{{ e.name || 'Эффект' }}</b>
            <button v-if="master" type="button" class="te-edit" title="Изменить" @click="fxEdit = { place: t.key, ...JSON.parse(JSON.stringify(e)) }">✎</button>
            <div v-if="e.desc" class="te-tip"><b>{{ e.name }}</b><RichText :text="e.desc" /></div>
          </div>
          <button v-if="master" type="button" class="te add" @click="fxEdit = { place: t.key, id: '', name: '', img: '', desc: '', tone: 'odd' }">＋ эффект</button>
          <p v-if="!party[t.key].effects.length && !master" class="ps-empty">Местность ни на что не влияет.</p>
        </div>
      </div>
    </div>

    <!-- выбор героя в слот -->
    <div v-if="pick" class="ps-modal" @mousedown.self="pick = null">
      <div class="ps-pick">
        <h3>{{ PICK_TITLE[pick] }}</h3>
        <input v-model="pickQ" class="ps-input" placeholder="Поиск по имени…" autofocus />
        <div class="ps-pick-tabs">
          <button v-for="t in PICK_TABS" :key="t.id" type="button" :class="{ on: pickTab === t.id }" @click="pickTab = t.id">{{ t.title }} <small>{{ pool(t.id).length }}</small></button>
        </div>
        <div class="ps-pick-list">
          <button v-for="h in pickList" :key="h.id" type="button" class="ps-pick-row" @click="add(h.id)">
            <img v-if="h.pic" :src="h.pic" alt="" /><span v-else class="ini">{{ h.name[0] }}</span>
            <b>{{ h.name }}</b><small>{{ h.label }}{{ h.level ? ' · ур. ' + h.level : '' }}{{ h.sub ? ' · ' + h.sub : '' }}{{ placeOf(h.id) ? ' · сейчас: ' + PLACE[placeOf(h.id)] : '' }}</small>
          </button>
          <p v-if="!pickList.length" class="ps-empty">Никого не нашлось.</p>
        </div>
      </div>
    </div>

    <!-- эффект местности: картинка (своя или из эффектов вики), название, описание -->
    <div v-if="fxEdit" class="ps-modal" @mousedown.self="fxEdit = null">
      <div class="ps-pick wide">
        <h3>{{ fxEdit.id ? 'Эффект местности' : 'Новый эффект местности' }} <small>{{ fxEdit.place === 'here' ? 'там, где группа' : 'в лагере' }}</small></h3>
        <div class="fx-row">
          <label class="fx-img" title="Загрузить свою картинку">
            <img v-if="fxEdit.img" :src="fxEdit.img" alt="" /><span v-else>＋<small>картинка</small></span>
            <input type="file" accept="image/*" hidden @change="upload" />
          </label>
          <div class="fx-fields">
            <input v-model="fxEdit.name" class="ps-input" maxlength="80" placeholder="Название (например, «Ядовитые испарения»)" />
            <div class="fx-tone">
              <button v-for="t in TONES" :key="t.v" type="button" :class="[t.v, { on: fxEdit.tone === t.v }]" @click="fxEdit.tone = t.v">{{ t.t }}</button>
            </div>
          </div>
        </div>
        <RichInput v-model="fxEdit.desc" :min-height="70" :compact="false" placeholder="Описание — видно при наведении (по желанию)" />
        <details class="fx-lib" @toggle="loadRules()">
          <summary>Взять из эффектов вики</summary>
          <input v-model="libQ" class="ps-input" placeholder="Поиск эффекта…" />
          <div class="fx-lib-grid">
            <button v-for="e in libList" :key="e.id" type="button" :title="e.name" @click="fromLib(e)"><img :src="e.icon" alt="" /><span>{{ e.name }}</span></button>
          </div>
        </details>
        <div class="ps-actions">
          <button v-if="fxEdit.id" type="button" class="ps-btn danger" @click="removeFx">Удалить</button>
          <span class="grow" />
          <button type="button" class="ps-btn" @click="fxEdit = null">Отмена</button>
          <button type="button" class="ps-btn primary" @click="saveFx">Сохранить</button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { store, isMaster, api, toast, postBlob, rulesState, loadRules, init, npcState, loadNpcs } from '../map/store.js'
import { memberOf } from './members.js'
import RichText from '../components/RichText.vue'
import RichInput from '../components/rich/RichInput.vue'
import HeroSlot from './HeroSlot.vue'
import GoalRow from './GoalRow.vue'

init()
const master = isMaster
const EMPTY = { players: 6, slots: [], camp: [], companions: [], goals: [], here: { name: '', effects: [] }, base: { name: '', effects: [] } }
const party = computed(() => ({ ...EMPTY, ...(store.data.party || {}) }))
const cap = computed(() => party.value.players + 3)
const free = computed(() => Math.max(0, cap.value - party.value.slots.length))

const COLS = [{ kind: 'main', title: 'Главные' }, { kind: 'side', title: 'Побочные' }]
const TERRAINS = [
  { key: 'here', icon: '🧭', title: 'Местность, где группа', ph: 'Где сейчас группа (например, «Болота Хаси»)' },
  { key: 'base', icon: '⛺', title: 'Местность лагеря', ph: 'Где разбит лагерь' }
]
const TONES = [{ v: 'good', t: '▲ Полезный' }, { v: 'bad', t: '▼ Вредный' }, { v: 'odd', t: '✦ Особый' }]
const PICK_TITLE = { slots: 'Кого поставить в группу', camp: 'Кого отправить в лагерь', companions: 'Компаньон' }
const PLACE = { slots: 'в группе', camp: 'в лагере', companions: 'компаньон' }

// в слотах — герои (карточки вики) и НПС-сайд-кики, личные сайд-кики, компаньоны (листы НПС)
onMounted(() => loadNpcs())
const heroOf = id => memberOf(id)
const placeOf = id => ['slots', 'camp', 'companions'].find(k => party.value[k].includes(id))
const quests = computed(() => (store.data.campaign?.quests || []).filter(q => !['Не актуален'].includes(q.status)))

/* ---------- сохранение: вся группа одним запросом, сразу видно у себя ---------- */
let timer = 0
function save(mut, text) {
  const p = JSON.parse(JSON.stringify(party.value))
  mut(p)
  store.data.party = p
  clearTimeout(timer)
  timer = setTimeout(async () => {
    try {
      store.data.party = await api('PUT', '/api/party', store.data.party)
      if (text) toast(text)
    } catch (e) { toast(e.message, 'error') }
  }, 250)
}
const listModel = key => computed({ get: () => party.value[key], set: v => save(p => { for (const k of ['slots', 'camp', 'companions']) p[k] = p[k].filter(id => !v.includes(id)); p[key] = v.slice(0, key === 'slots' ? cap.value : 200) }) })
const slotsModel = listModel('slots'), campModel = listModel('camp'), compModel = listModel('companions')

function setPlayers(e) {
  const n = Math.max(1, Math.min(30, Math.round(Number(e.target.value) || 1)))
  const over = party.value.slots.length - (n + 3)
  if (over > 0 && !confirm(`Мест станет ${n + 3} — последние ${over} из группы уйдут в лагерь. Продолжить?`)) { e.target.value = party.value.players; return }
  save(p => { p.players = n; const extra = p.slots.splice(n + 3); p.camp.push(...extra) }, `Игроков: ${n}, мест в группе: ${n + 3}`)
}
function move(id, to) {
  if (to === 'slots' && party.value.slots.length >= cap.value) return toast('В группе нет свободных мест', 'error')
  save(p => { for (const k of ['slots', 'camp', 'companions']) p[k] = p[k].filter(x => x !== id); p[to].push(id) })
}
const remove = id => save(p => { for (const k of ['slots', 'camp', 'companions']) p[k] = p[k].filter(x => x !== id) })

const pick = ref(null), pickQ = ref(''), pickTab = ref('character')
const PICK_TABS = [
  { id: 'character', title: 'Персонажи' }, { id: 'sidekick', title: 'Сайд-кики' }, { id: 'personal', title: 'Личные сайд-кики' },
  { id: 'companion', title: 'Компаньоны' }, { id: 'all', title: 'Все' }
]
function openPick(where) {
  if (!master.value) return
  if (where === 'slots' && party.value.slots.length >= cap.value) return toast('В группе нет свободных мест', 'error')
  pick.value = where
  pickQ.value = ''
  pickTab.value = where === 'companions' ? 'companion' : 'character'
}
// кого можно выбрать на вкладке: персонажи — карточки героев; сайд-кики и компаньоны — карточки героев и листы НПС
const everyone = computed(() => [
  ...(store.data.heroes || []).map(h => memberOf(h.id)),
  // НПС, у которого есть карточка героя, уже есть в списке как герой
  ...npcState.npcs.filter(n => ['sidekick', 'personal', 'companion'].includes(n.group) && !n.heroId).map(n => memberOf(n.id))
])
const pool = tab => everyone.value.filter(m => tab === 'all' || m.tab === tab)
const pickList = computed(() => {
  const q = pickQ.value.trim().toLowerCase()
  return pool(pickTab.value)
    .filter(m => !party.value[pick.value]?.includes(m.id) && (!q || m.name.toLowerCase().includes(q)))
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
})
function add(id) {
  const where = pick.value
  pick.value = null
  move(id, where)
}

/* ---------- цели ---------- */
const active = computed(() => party.value.goals.filter(g => !g.done))
const doneGoals = computed(() => party.value.goals.filter(g => g.done))
const editGoal = ref(null)
function newGoal() {
  const id = 'g' + Math.random().toString(36).slice(2, 10)
  save(p => { p.goals.unshift({ id, title: '', kind: 'main', done: false, secret: false, questId: null, note: '' }) })
  editGoal.value = id
}
const patchGoal = (id, patch, text) => save(p => { const g = p.goals.find(x => x.id === id); if (g) Object.assign(g, patch) }, text)
function toggleGoal(g) {
  if (!master.value) return
  patchGoal(g.id, { done: !g.done }, g.done ? 'Цель снова активна' : 'Цель выполнена!')
}
function removeGoal(g) {
  if (!confirm(`Удалить цель «${g.title || 'без названия'}»?`)) return
  if (editGoal.value === g.id) editGoal.value = null
  save(p => { p.goals = p.goals.filter(x => x.id !== g.id) })
}

/* ---------- местность ---------- */
const setPlace = (key, name) => save(p => { p[key].name = name.trim().slice(0, 80) })
const fxEdit = ref(null), libQ = ref('')
const libList = computed(() => {
  const q = libQ.value.trim().toLowerCase()
  return rulesState.effects.filter(e => e.icon && (!q || e.name.toLowerCase().includes(q))).slice(0, 60)
})
function fromLib(e) {
  Object.assign(fxEdit.value, { name: e.name, img: e.icon, desc: e.html || '', tone: e.kind === 'buff' ? 'good' : e.kind === 'debuff' ? 'bad' : 'odd' })
}
async function upload(ev) {
  const f = ev.target.files?.[0]
  ev.target.value = ''
  if (!f) return
  try { fxEdit.value.img = (await postBlob('/api/rules/icon', f)).icon } catch (e) { toast(e.message, 'error') }
}
function saveFx() {
  const { place, ...e } = fxEdit.value
  if (!e.name.trim() && !e.img) return toast('Дай эффекту название или картинку', 'error')
  fxEdit.value = null
  save(p => {
    const list = p[place].effects
    const i = list.findIndex(x => x.id === e.id)
    if (i >= 0) list[i] = e
    else list.push({ ...e, id: 'te' + Math.random().toString(36).slice(2, 10) })
  }, 'Эффект местности сохранён')
}
function removeFx() {
  const { place, id } = fxEdit.value
  fxEdit.value = null
  save(p => { p[place].effects = p[place].effects.filter(x => x.id !== id) }, 'Эффект убран')
}
</script>

<style scoped>
.ps { display: grid; gap: 16px; color: var(--a-text, #efe3c8); }
.ps-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.ps-head h1 { margin: 0; font: 700 34px var(--a-serif, 'Cormorant Garamond', serif); color: #f3dc9e; }
.ps-head p { margin: 2px 0 0; color: var(--a-muted, #a8936c); font-weight: 600; }
.ps-fire { display: inline-block; filter: drop-shadow(0 0 10px rgba(255, 140, 40, .8)); animation: ps-flame 1.6s ease-in-out infinite; }
@keyframes ps-flame { 0%, 100% { transform: scale(1) rotate(-2deg); } 50% { transform: scale(1.08) rotate(3deg); } }
.ps-players { display: flex; align-items: center; gap: 8px; padding: 6px 12px; border-radius: 12px; background: rgba(0, 0, 0, .3); border: 1px solid rgba(231, 197, 111, .25); font: 700 13px var(--a-sans, 'Manrope', sans-serif); color: var(--a-muted, #a8936c); }
.ps-players input { width: 56px; padding: 4px 6px; border-radius: 8px; border: 1px solid rgba(231, 197, 111, .35); background: rgba(0, 0, 0, .35); color: #f3dc9e; font: 800 15px var(--a-sans, 'Manrope', sans-serif); text-align: center; }
.ps-players small { color: #f3dc9e; }

.ps-card { min-width: 0; padding: 14px 16px; border-radius: 16px; background: linear-gradient(160deg, rgba(42, 30, 18, .82), rgba(20, 15, 10, .82)); border: 1px solid rgba(231, 197, 111, .22); box-shadow: 0 14px 30px rgba(0, 0, 0, .35), inset 0 1px 0 rgba(255, 220, 160, .06); }
.ps-card h2 { display: flex; align-items: center; gap: 8px; margin: 0 0 10px; font: 700 22px var(--a-serif, 'Cormorant Garamond', serif); color: #f3dc9e; }
.ps-card h2 small { font: 700 12px var(--a-sans, 'Manrope', sans-serif); color: var(--a-muted, #a8936c); }
.ps-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; }
@media (min-width: 1100px) { .ps-grid { grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); } .ps-party { grid-row: span 2; } }
.ps-party { background: linear-gradient(160deg, rgba(58, 36, 16, .88), rgba(22, 15, 9, .88)); border-color: rgba(255, 170, 80, .35); }

.ps-slots { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 10px; min-height: 60px; }
.ps-slots.small { grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); }
.ph { display: grid; place-items: center; align-content: center; gap: 2px; min-height: 150px; border-radius: 14px; border: 2px dashed rgba(231, 197, 111, .25); background: rgba(0, 0, 0, .18); color: rgba(231, 197, 111, .5); font: 700 12px var(--a-sans, 'Manrope', sans-serif); cursor: pointer; transition: border-color .2s, background .2s, color .2s; }
.ps-slots.small .ph { min-height: 118px; }
.ph span { font-size: 26px; line-height: 1; }
.ph:disabled { cursor: default; }
.ph:not(:disabled):hover { border-color: #ffb35a; background: rgba(255, 160, 60, .08); color: #ffcf7a; }
.ph.add { border-style: dotted; }
:deep(.pc-ghost) { opacity: .35; }

.ps-goals h2 .ps-btn { margin-left: auto; }
.ps-cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; }
.ps-col h3 { margin: 0 0 8px; font: 800 12px var(--a-sans, 'Manrope', sans-serif); letter-spacing: .1em; text-transform: uppercase; color: #ffcf7a; }
.ps-col.side h3 { color: #9fc6ff; }
.ps-col h3 small { color: var(--a-muted, #a8936c); }
.ps-goal-list { display: grid; gap: 8px; }
.goal-enter-active, .goal-leave-active { transition: all .35s ease; }
.goal-enter-from, .goal-leave-to { opacity: 0; transform: translateX(-12px); }
.ps-done { margin-top: 12px; }
.ps-done summary { cursor: pointer; color: #7ed07a; font: 700 13px var(--a-sans, 'Manrope', sans-serif); margin-bottom: 8px; }
.ps-done > :deep(.gr) { margin-bottom: 6px; }

.ps-terrain { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; }
.ps-place.here { border-color: rgba(126, 208, 122, .3); }
.ps-place.base { border-color: rgba(255, 170, 80, .3); }
.ps-place-name { width: 100%; box-sizing: border-box; margin-bottom: 10px; padding: 7px 10px; border-radius: 10px; border: 1px dashed rgba(231, 197, 111, .3); background: rgba(0, 0, 0, .25); color: #f3dc9e; font: 700 15px var(--a-sans, 'Manrope', sans-serif); }
.ps-place-name.ro { border-style: solid; border-color: transparent; }
.ps-fx { display: flex; flex-wrap: wrap; gap: 8px; }
.te { position: relative; display: inline-flex; align-items: center; gap: 7px; padding: 5px 10px 5px 5px; border-radius: 99px; border: 1px solid rgba(231, 197, 111, .35); background: rgba(0, 0, 0, .35); color: #efe3c8; font: 700 13px var(--a-sans, 'Manrope', sans-serif); cursor: default; outline: none; }
.te img, .te-ic { width: 30px; height: 30px; flex: none; border-radius: 50%; object-fit: cover; display: grid; place-items: center; background: rgba(255, 255, 255, .06); }
.te.good { border-color: rgba(126, 208, 122, .55); box-shadow: 0 0 12px rgba(126, 208, 122, .15); }
.te.bad { border-color: rgba(255, 107, 94, .55); box-shadow: 0 0 12px rgba(255, 107, 94, .15); }
.te.odd { border-color: rgba(185, 166, 255, .55); box-shadow: 0 0 12px rgba(185, 166, 255, .15); }
.te.add { padding: 8px 14px; border-style: dashed; background: none; color: #ffcf7a; cursor: pointer; }
.te-edit { border: 0; background: none; color: var(--a-muted, #a8936c); cursor: pointer; padding: 0 2px; }
.te-tip { display: none; position: absolute; z-index: 30; left: 0; bottom: calc(100% + 8px); width: min(320px, 80vw); padding: 10px 12px; border-radius: 12px; background: #17110b; border: 1px solid rgba(231, 197, 111, .45); box-shadow: 0 14px 34px rgba(0, 0, 0, .6); font: 500 13px/1.45 var(--a-sans, 'Manrope', sans-serif); color: #efe3c8; }
.te-tip > b { display: block; margin-bottom: 4px; color: #f3dc9e; }
.te:hover .te-tip, .te:focus .te-tip { display: block; animation: tip-in .18s ease; }
@keyframes tip-in { from { opacity: 0; transform: translateY(4px); } }
.ps-empty { margin: 4px 0; color: var(--a-muted, #a8936c); font-size: 13px; }

.ps-btn { height: 32px; padding: 0 12px; border-radius: 9px; border: 1px solid rgba(231, 197, 111, .35); background: rgba(231, 197, 111, .1); color: #f3dc9e; font: 700 13px var(--a-sans, 'Manrope', sans-serif); cursor: pointer; }
.ps-btn.primary { background: linear-gradient(180deg, #f0d083, #c9a24f); color: #1b1408; border: 0; }
.ps-btn.danger { color: #ff8f7f; border-color: rgba(255, 107, 94, .4); background: none; }
.ps-modal { position: fixed; inset: 0; z-index: 300; display: grid; place-items: center; padding: 16px; background: rgba(5, 4, 3, .6); backdrop-filter: blur(3px); }
.ps-pick { width: min(460px, 100%); max-height: min(680px, 90vh); display: grid; grid-template-rows: auto auto auto minmax(0, 1fr); gap: 10px; padding: 16px; border-radius: 16px; background: #1a130c; border: 1px solid rgba(231, 197, 111, .35); box-shadow: 0 24px 60px rgba(0, 0, 0, .6); }
.ps-pick.wide { width: min(560px, 100%); grid-template-rows: none; overflow-y: auto; }
.ps-pick h3 { margin: 0; font: 700 22px var(--a-serif, 'Cormorant Garamond', serif); color: #f3dc9e; }
.ps-pick h3 small { font: 600 12px var(--a-sans, 'Manrope', sans-serif); color: var(--a-muted, #a8936c); }
.ps-input { width: 100%; box-sizing: border-box; padding: 8px 10px; border-radius: 10px; border: 1px solid rgba(231, 197, 111, .3); background: rgba(0, 0, 0, .35); color: #efe3c8; font: 600 14px var(--a-sans, 'Manrope', sans-serif); outline: none; }
.ps-pick-tabs { display: flex; flex-wrap: wrap; gap: 4px; }
.ps-pick-tabs button { padding: 4px 10px; border-radius: 99px; border: 1px solid rgba(231, 197, 111, .25); background: none; color: var(--a-muted, #a8936c); font: 700 12px var(--a-sans, 'Manrope', sans-serif); cursor: pointer; }
.ps-pick-tabs button.on { background: rgba(231, 197, 111, .16); border-color: rgba(231, 197, 111, .6); color: #f3dc9e; }
.ps-pick-tabs small { opacity: .7; }
.ps-pick-list { overflow-y: auto; display: grid; gap: 4px; align-content: start; }
.ps-pick-row { display: grid; grid-template-columns: 36px 1fr; grid-template-rows: auto auto; column-gap: 10px; align-items: center; text-align: left; padding: 6px 8px; border-radius: 10px; border: 0; background: none; color: #efe3c8; cursor: pointer; }
.ps-pick-row:hover { background: rgba(231, 197, 111, .12); }
.ps-pick-row img, .ps-pick-row .ini { grid-row: span 2; width: 36px; height: 36px; border-radius: 50%; object-fit: cover; display: grid; place-items: center; background: #2a2016; color: #f3dc9e; font-weight: 800; }
.ps-pick-row b { font-size: 14px; }
.ps-pick-row small { color: var(--a-muted, #a8936c); font-size: 11.5px; }
.fx-row { display: flex; gap: 12px; align-items: center; }
.fx-img { width: 76px; height: 76px; flex: none; display: grid; place-items: center; border-radius: 16px; border: 2px dashed rgba(231, 197, 111, .4); background: rgba(0, 0, 0, .3); color: #ffcf7a; cursor: pointer; overflow: hidden; text-align: center; font-size: 22px; }
.fx-img small { display: block; font-size: 11px; }
.fx-img img { width: 100%; height: 100%; object-fit: cover; }
.fx-fields { flex: 1; display: grid; gap: 8px; }
.fx-tone { display: flex; gap: 6px; flex-wrap: wrap; }
.fx-tone button { padding: 4px 10px; border-radius: 99px; border: 1px solid rgba(255, 255, 255, .15); background: none; color: var(--a-muted, #a8936c); font: 700 12px var(--a-sans, 'Manrope', sans-serif); cursor: pointer; }
.fx-tone button.on.good { color: #7ed07a; border-color: #7ed07a; background: rgba(126, 208, 122, .12); }
.fx-tone button.on.bad { color: #ff8f7f; border-color: #ff6b5e; background: rgba(255, 107, 94, .12); }
.fx-tone button.on.odd { color: #c9b8ff; border-color: #b9a6ff; background: rgba(185, 166, 255, .12); }
.fx-lib summary { cursor: pointer; color: #ffcf7a; font: 700 13px var(--a-sans, 'Manrope', sans-serif); margin-bottom: 6px; }
.fx-lib-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 6px; max-height: 220px; overflow-y: auto; margin-top: 6px; }
.fx-lib-grid button { display: grid; justify-items: center; gap: 3px; padding: 6px 4px; border-radius: 10px; border: 1px solid rgba(255, 255, 255, .08); background: rgba(0, 0, 0, .25); color: #efe3c8; font: 600 11px var(--a-sans, 'Manrope', sans-serif); cursor: pointer; }
.fx-lib-grid button:hover { border-color: rgba(231, 197, 111, .5); }
.fx-lib-grid img { width: 34px; height: 34px; border-radius: 50%; }
.fx-lib-grid span { text-align: center; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.ps-actions { display: flex; gap: 8px; align-items: center; }
.ps-actions .grow { flex: 1; }
@media (prefers-reduced-motion: reduce) { .ps-fire { animation: none; } }
</style>
