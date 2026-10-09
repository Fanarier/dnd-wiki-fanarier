<template>
  <div class="gt">
    <h3>Гарнизон <small>{{ open }} из {{ GARRISON_SLOTS }} слотов открыто · воинов {{ total }} · сила {{ strength }}</small>
      <button v-if="master" class="ed" title="Помощник боя: гарнизон защищает поселение" @click="$emit('battle', 'garrison')">⚔ Бой у стен</button>
    </h3>
    <div v-if="missing.length" class="alert">
      Не заполнены статы рас: <b>{{ missing.map(r => RACES[r]?.label).join(', ') }}</b> — без них автобой не посчитать.
      <button v-if="master" class="link" @click="$emit('edit', 'army')">Заполнить статы →</button>
      <span v-else>Это сделает мастер.</span>
    </div>

    <div class="gar">
      <div v-for="g in SLOT_GROUPS" :key="g.from" class="col">
        <div class="colh">{{ g.label }} <b v-if="g.to <= open">открыты</b><b v-else class="no">{{ g.need === 'palisade' ? 'нужен частокол' : 'нужна каменная стена' }}</b></div>
        <template v-if="g.to <= open">
          <UnitSlot v-for="i in g.to - g.from" :key="i" :unit="units[g.from + i - 1]" :face="faceOf(s, garrison[g.from + i - 1])" :label="faceOf(s, garrison[g.from + i - 1])?.label"
                    :clickable="master" @pick="editSlot(g.from + i - 1)" />
        </template>
        <div v-else class="locktag">🔒<br />{{ g.lock }}</div>
      </div>
    </div>

    <h3 class="sub">Обучение <small>житель становится воином за сезон — {{ TRAIN_DAYS }} дней; полоска двигается с «Прошёл день»</small></h3>
    <div v-if="!training.length" class="muted">Сейчас никто не учится.</div>
    <div v-for="t in training" :key="t.id" class="train">
      <b>{{ RACES[t.race]?.label }} × {{ t.count }}<span v-if="t.talent" class="star" :title="t.talent.note">★ {{ t.talent.note || 'талант' }}</span></b>
      <div>
        <div class="bar"><i :style="{ width: (t.done / t.days) * 100 + '%' }" :class="{ tal: t.talent }" /></div>
        <div class="mini-row"><span>{{ t.talent ? 'талантливый ребёнок растёт' : 'учится воевать' }}</span><span>{{ t.done }} из {{ t.days }} дн. · осталось {{ t.days - t.done }}</span></div>
      </div>
      <button v-if="master" class="x" title="Отменить обучение" @click="dropTraining(t)">×</button>
    </div>

    <!-- мастер ставит обучение, глава — приказ -->
    <div v-if="master || decider" class="tform">
      <select v-model="tf.race"><option v-for="r in s.races" :key="r.race" :value="r.race">{{ RACES[r.race]?.label }}</option></select>
      <input v-model.number="tf.count" type="number" min="1" max="100" class="num" />
      <template v-if="master">
        <label class="chk"><input v-model="tf.talent" type="checkbox" /> талантливый ребёнок</label>
        <template v-if="tf.talent">
          <input v-model="tf.note" placeholder="Дар: «Сильная рука»" />
          <select v-model="tf.sex" class="num"><option value="male">♂</option><option value="female">♀</option></select>
          <label v-for="(l, k) in STATS" :key="k" class="bon">{{ l.slice(0, 3).toLowerCase() }}<input v-model.number="tf[k]" type="number" /></label>
        </template>
        <button class="btn" @click="addTraining">Начать обучение</button>
      </template>
      <button v-else class="btn" @click="orderTraining">Приказ: обучить</button>
    </div>
    <p class="muted note">Воины берутся из «Боевых» своей расы. Вторые 5 слотов открывает кольцо частокола, последние 5 — кольцо каменной стены (вкладка карты «Стены»). ★ — талантливые: у каждого свой бонус.</p>

    <SlotEditor v-if="editing != null" :settlement="s" :slot="garrison[editing]" mode="garrison" :title="`Гарнизон · слот ${editing + 1}`"
                @close="editing = null" @save="saveSlot" @stats="editing = null; $emit('edit', 'army')" />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { act } from '../map/store.js'
import { RACES } from '../shared/settlement.js'
import { STATS, GARRISON_SLOTS, SLOT_GROUPS, TRAIN_DAYS, openSlots, unitOf, power, missingRaceStats } from '../shared/army.js'
import { faceOf } from './armyFaces.js'
import UnitSlot from './UnitSlot.vue'
import SlotEditor from './SlotEditor.vue'

const props = defineProps({ settlement: Object, calc: Object, master: Boolean, decider: Boolean })
defineEmits(['edit', 'battle'])
const s = computed(() => props.settlement)
const base = () => `/api/settlements/${s.value.id}`
const open = computed(() => openSlots(s.value))
const garrison = computed(() => Array.from({ length: GARRISON_SLOTS }, (_, i) => s.value.army?.garrison?.[i] || null))
const units = computed(() => garrison.value.map(sl => unitOf(s.value, sl)))
const total = computed(() => units.value.reduce((n, u) => n + (u?.count || 0), 0))
const strength = computed(() => units.value.reduce((n, u) => n + power(u), 0))
const missing = computed(() => missingRaceStats(s.value))
const training = computed(() => s.value.army?.training || [])

const saveArmy = (patch, ok, extra = {}) => act('PATCH', base(), { army: { ...(s.value.army || {}), ...patch }, ...extra }, ok).catch(() => null)

const editing = ref(null)
const editSlot = i => { editing.value = i }
function saveSlot({ slot, assetStats, takenPending }) {
  const g = [...garrison.value]
  g[editing.value] = slot
  const patch = { garrison: g }
  if (takenPending) patch.pendingTalents = { ...(s.value.army?.pendingTalents || {}), [takenPending]: [] }
  const extra = assetStats ? { assets: (s.value.assets || []).map(a => (a.id === assetStats.id ? { ...a, stats: assetStats.stats } : a)) } : {}
  saveArmy(patch, slot ? 'Гарнизон обновлён' : 'Слот освобождён', extra)
  editing.value = null
}

const tf = ref({ race: s.value.races?.[0]?.race || '', count: 1, talent: false, note: '', sex: 'male', atk: 1, def: 0, hp: 0, ini: 0 })
function addTraining() {
  const t = tf.value
  const item = { id: 't' + Date.now().toString(36), race: t.race, count: Math.max(1, t.count || 1), days: TRAIN_DAYS, done: 0 }
  if (t.talent) Object.assign(item, { talent: { note: t.note, atk: t.atk || 0, def: t.def || 0, hp: t.hp || 0, ini: t.ini || 0 }, sex: t.sex })
  saveArmy({ training: [...training.value, item] }, `${RACES[t.race]?.label}: обучение началось`)
}
const dropTraining = t => confirm('Отменить обучение?') && saveArmy({ training: training.value.filter(x => x.id !== t.id) }, 'Обучение отменено')
function orderTraining() {
  const text = prompt(`Приказ: обучить ${tf.value.count} × ${RACES[tf.value.race]?.label}. Комментарий для мастера (необязательно):`, '')
  if (text === null) return
  act('POST', `${base()}/orders`, { kind: 'train', race: tf.value.race, count: tf.value.count, text }, 'Приказ отправлен мастеру').catch(() => null)
}
</script>

<style scoped>
.gt { display: grid; gap: 8px; }
h3 { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin: 0; font: 700 21px var(--a-serif); color: var(--a-gold-2); }
h3 small { font: 600 12px var(--a-sans); color: var(--a-muted); }
h3.sub { font-size: 18px; margin-top: 10px; }
.ed { margin-left: auto; padding: 4px 10px; border-radius: 8px; border: 1px solid rgba(255, 107, 94, .45); background: rgba(255, 107, 94, .08); color: #ff9b8f; font: 700 12px var(--a-sans); cursor: pointer; }
.alert { padding: 8px 12px; border-radius: 10px; border: 1px solid rgba(255, 179, 107, .5); background: rgba(255, 179, 107, .08); color: #ffcf9b; font-size: 12.5px; }
.link { border: 0; background: none; color: var(--a-gold-2); font: 800 12.5px var(--a-sans); text-decoration: underline; cursor: pointer; }
.gar { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
.col { display: grid; gap: 8px; align-content: start; }
.colh { display: flex; justify-content: space-between; gap: 6px; font: 800 10.5px var(--a-sans); letter-spacing: .05em; text-transform: uppercase; color: var(--a-muted); }
.colh b { color: #9be07a; text-transform: none; letter-spacing: 0; }
.colh b.no { color: #ff9b8f; }
.locktag { display: grid; place-items: center; min-height: 160px; padding: 12px; border: 2px dashed rgba(255, 255, 255, .14); border-radius: 12px; text-align: center; color: var(--a-muted); font-size: 12px; }
.train { display: grid; grid-template-columns: minmax(110px, auto) 1fr auto; gap: 10px; align-items: center; padding: 6px 0; border-top: 1px dashed var(--a-line); }
.train b { font-size: 13px; }
.star { display: block; color: #ffe08a; font-size: 11px; }
.bar { height: 8px; border-radius: 99px; overflow: hidden; background: rgba(0, 0, 0, .4); box-shadow: inset 0 0 0 1px rgba(201, 162, 79, .2); }
.bar i { display: block; height: 100%; border-radius: 99px; background: linear-gradient(90deg, #a87a33, #f2d58f); transition: width .6s; }
.bar i.tal { background: linear-gradient(90deg, #c99a48, #ffe08a); }
.mini-row { display: flex; justify-content: space-between; gap: 8px; margin-top: 3px; font-size: 11px; color: var(--a-muted); }
.x { border: 0; background: none; color: var(--a-muted); font-size: 18px; cursor: pointer; }
.tform { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; padding: 8px; border-radius: 10px; background: rgba(231, 197, 111, .05); }
.tform select, .tform input { min-height: 30px; padding: 3px 7px; border-radius: 7px; border: 1px solid var(--a-line-2); background: rgba(0, 0, 0, .3); color: var(--a-text); font: 600 12.5px var(--a-sans); }
.tform .num { width: 64px; }
.tform .bon { display: grid; font-size: 10px; color: var(--a-muted); width: 46px; }
.tform .bon input { width: 46px; padding: 2px 4px; }
.chk { display: flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 700; color: var(--a-muted); }
.btn { height: 30px; padding: 0 12px; border-radius: 8px; border: 0; background: linear-gradient(180deg, #f0d083, #c9a24f); color: #1b1408; font: 800 12px var(--a-sans); cursor: pointer; }
.muted { color: var(--a-muted); font-size: 12.5px; }
.note { margin: 4px 0 0; }
</style>
