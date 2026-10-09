<template>
  <div class="hp">
    <h3>Дом целителя <small>коек {{ split.beds }} = {{ healers }} целител{{ healers === 1 ? 'ь' : 'я' }} × {{ BEDS_PER_HEALER }} · занято {{ split.beds - split.free }} · ждут {{ split.queue.length }}</small></h3>
    <div v-if="!split.beds" class="alert">Лечить некому: нужен «Дом целителя» и целители на работе (вкладка «Работы»). Больные ждут в очереди.</div>
    <p class="muted">Сюда попадают те, кто не вылечился сам. Метод лечения выбирает глава, полоску двигает мастер: начало — 50%, 0 — не вылечили (смерть), 100 — здоров.</p>

    <div class="head"><span>Пациент</span><span>Болезнь</span><span>Лечение</span><span>Выздоровление</span></div>
    <div v-for="p in rows" :key="p.id" class="bed" :class="{ queue: p.queued }">
      <div class="who">
        <div class="face" :style="{ '--fc': face(p).color }"><img v-if="face(p).img" :src="face(p).img" alt="" /><span v-else>{{ face(p).letter }}</span></div>
        <b>{{ face(p).label }}<template v-if="p.count > 1"> ×{{ p.count }}</template></b>
        <small v-if="p.queued" class="q">ждёт койку</small>
      </div>
      <div class="box"><small>болезнь</small>
        <input v-if="master" :value="p.disease" placeholder="Рваная рана, лихорадка…" @change="patchP(p, { disease: $event.target.value })" />
        <span v-else>{{ p.disease || '—' }}</span>
      </div>
      <div class="box"><small>лечение{{ p.treatmentBy ? ' · выбрал ' + p.treatmentBy : '' }}</small>
        <input v-if="master || decider" :value="p.treatment" placeholder="Метод выбирает глава" @change="setTreatment(p, $event.target.value)" />
        <span v-else :class="{ none: !p.treatment }">{{ p.treatment || 'ещё не выбрано' }}</span>
      </div>
      <div class="heal">
        <div class="seg" :title="`${p.progress}%`">
          <i v-for="n in 10" :key="n" :style="n * HEAL_STEP <= p.progress ? { background: color(p.progress) } : null" :class="{ start: n === 5 }" />
        </div>
        <div class="ctl">
          <button v-if="master" :disabled="p.queued" title="Хуже" @click="step(p, -HEAL_STEP)">−</button>
          <b :style="{ color: color(p.progress) }">{{ p.progress }}%</b>
          <button v-if="master" :disabled="p.queued" title="Лучше" @click="step(p, HEAL_STEP)">+</button>
          <span>{{ note(p) }}</span>
        </div>
      </div>
    </div>
    <div v-for="n in split.free" :key="'free' + n" class="bed empty"><div class="who"><div class="face empty">койка</div></div><div class="box" /><div class="box" /><div class="heal"><div class="seg"><i v-for="m in 10" :key="m" /></div><div class="ctl">свободна</div></div></div>

    <!-- мастер кладёт больного -->
    <div v-if="master" class="admit">
      <b>Положить в лечебницу</b>
      <select v-model="ad.kind"><option value="race">жители расы</option><option value="asset">актив</option><option value="hero">герой</option><option value="name">по имени</option></select>
      <template v-if="ad.kind === 'race'">
        <select v-model="ad.race"><option v-for="r in s.races" :key="r.race" :value="r.race">{{ RACES[r.race]?.label }}</option></select>
        <input v-model.number="ad.count" type="number" min="1" class="num" />
      </template>
      <select v-else-if="ad.kind === 'asset'" v-model="ad.asset"><option v-for="a in s.assets" :key="a.id" :value="a.id">{{ a.name }}</option></select>
      <select v-else-if="ad.kind === 'hero'" v-model="ad.hero"><option v-for="h in heroes" :key="h.id" :value="h.id">{{ h.name }}</option></select>
      <template v-else><input v-model="ad.name" placeholder="Имя" /><button type="button" class="nm-dice" title="Случайное имя — раса по жителям поселения" @click="ad.name = makeName(raceFromPeople(s.races))">🎲</button></template>
      <input v-model="ad.disease" placeholder="Болезнь или ранение" class="wide" />
      <button class="btn" @click="admit">Положить</button>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { store, act } from '../map/store.js'
import { RACES } from '../shared/settlement.js'
import { HEAL_STEP, BEDS_PER_HEALER, hospitalSplit } from '../shared/army.js'
import { faceOf } from './armyFaces.js'
import { makeName, raceFromPeople } from '../shared/names.js'

const props = defineProps({ settlement: Object, calc: Object, master: Boolean, decider: Boolean })
const s = computed(() => props.settlement)
const base = () => `/api/settlements/${s.value.id}`
const heroes = computed(() => store.data.heroes || [])
const healers = computed(() => props.calc.jobs.healer?.workers || 0)
const split = computed(() => hospitalSplit(s.value, props.calc))
const rows = computed(() => [...split.value.inBed, ...split.value.queue.map(p => ({ ...p, queued: true }))])
const face = p => (p.who.name ? { letter: p.who.name[0], color: '#c9b88f', label: p.who.name } : faceOf(s.value, p.who))
const color = v => (v >= 70 ? '#9be07a' : v >= 50 ? '#e8c33a' : v >= 30 ? '#ff9a3c' : '#e0503a')
const note = p => (p.progress >= 100 ? 'здоров — выписать' : p.progress <= 0 ? 'не вылечили' : p.progress > 50 ? 'идёт на поправку' : p.progress < 50 ? 'хуже' : 'только поступил(а)')

const patchP = (p, patch) => act('PATCH', base(), { hospital: (s.value.hospital || []).map(x => (x.id === p.id ? { ...x, ...patch } : x)) }).catch(() => null)
const setTreatment = (p, text) => act('POST', `${base()}/hospital/${p.id}/treatment`, { treatment: text }, 'Лечение выбрано').catch(() => null)
async function step(p, d) {
  const v = Math.max(0, Math.min(100, (p.progress ?? 50) + d))
  if (v === 0 && !confirm(`${face(p).label}${p.count > 1 ? ' ×' + p.count : ''}: не вылечили — это смерть. Подтвердить?`)) return
  if (v === 100 && !confirm(`${face(p).label}: здоров(ы)? Выписать из лечебницы?`)) return patchP(p, { progress: v })
  if (v === 0 || v === 100) return act('POST', `${base()}/hospital/${p.id}/${v === 100 ? 'healed' : 'dead'}`, {}, v === 100 ? 'Выписаны здоровыми' : 'Не спасли…').catch(() => null)
  patchP(p, { progress: v })
}
const ad = ref({ kind: 'race', race: s.value.races?.[0]?.race, count: 1, asset: s.value.assets?.[0]?.id, hero: '', name: '', disease: '' })
function admit() {
  const a = ad.value
  const who = a.kind === 'race' ? { race: a.race } : a.kind === 'asset' ? { asset: a.asset } : a.kind === 'hero' ? { hero: a.hero } : { name: a.name }
  act('POST', `${base()}/hospital`, { who, count: a.count, disease: a.disease }, 'Положили в лечебницу').then(() => { a.disease = '' }).catch(() => null)
}
</script>

<style scoped>
.hp { display: grid; gap: 8px; }
h3 { margin: 0; font: 700 21px var(--a-serif); color: var(--a-gold-2); }
h3 small { font: 600 12px var(--a-sans); color: var(--a-muted); margin-left: 6px; }
.muted { margin: 0; color: var(--a-muted); font-size: 12.5px; }
.alert { padding: 8px 12px; border-radius: 10px; border: 1px solid rgba(255, 107, 91, .5); background: rgba(255, 107, 91, .08); color: #ffb0a6; font-size: 12.5px; font-weight: 700; }
.head, .bed { display: grid; grid-template-columns: 120px 1fr 1fr 1.4fr; gap: 10px; align-items: center; }
.head { padding: 0 8px; font: 800 10.5px var(--a-sans); color: var(--a-muted); text-transform: uppercase; letter-spacing: .05em; }
.bed { padding: 8px; border-radius: 12px; background: rgba(255, 255, 255, .03); border: 1px solid rgba(255, 255, 255, .07); }
.bed.queue { border-style: dashed; opacity: .75; }
.bed.empty { opacity: .45; }
.who { display: grid; justify-items: center; gap: 3px; text-align: center; font-size: 12px; }
.face { --fc: #c9b88f; width: 48px; height: 48px; border-radius: 50%; display: grid; place-items: center; overflow: hidden; background: var(--fc); border: 2px solid #fff3d6; color: #1b140c; font: 700 19px var(--a-serif); }
.face img { width: 100%; height: 100%; object-fit: cover; }
.face.empty { background: none; border: 2px dashed rgba(255, 255, 255, .25); color: var(--a-muted); font: 700 10px var(--a-sans); }
.q { color: #ffb36b; font-weight: 800; }
.box { min-height: 44px; padding: 5px 8px; border: 1.5px solid rgba(255, 255, 255, .55); border-radius: 6px; font-size: 12.5px; display: grid; gap: 2px; align-content: start; }
.box small { color: var(--a-muted); font: 800 9.5px var(--a-sans); text-transform: uppercase; }
.box input { width: 100%; box-sizing: border-box; padding: 2px 4px; border: 0; border-bottom: 1px dashed var(--a-line); background: none; color: var(--a-text); font: 600 12.5px var(--a-sans); }
.box input:focus { outline: none; border-bottom-color: var(--a-gold); }
.box .none { color: #ffb36b; font-style: italic; }
.seg { display: grid; grid-template-columns: repeat(10, 1fr); gap: 2px; height: 14px; }
.seg i { border-radius: 2px; background: rgba(255, 255, 255, .08); transition: background .3s; }
.seg i.start { box-shadow: inset -2px 0 0 rgba(255, 255, 255, .5); }
.ctl { display: flex; align-items: center; gap: 6px; margin-top: 4px; font-size: 11px; color: var(--a-muted); }
.ctl button { width: 26px; height: 22px; border-radius: 6px; border: 1px solid var(--a-line); background: rgba(231, 197, 111, .08); color: var(--a-gold-2); font-weight: 800; cursor: pointer; }
.ctl button:disabled { opacity: .3; }
.admit { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; padding: 8px; border-radius: 10px; background: rgba(231, 197, 111, .05); }
.admit b { font-size: 12.5px; color: var(--a-gold-2); }
.admit select, .admit input { min-height: 30px; padding: 3px 7px; border-radius: 7px; border: 1px solid var(--a-line-2); background: rgba(0, 0, 0, .3); color: var(--a-text); font: 600 12.5px var(--a-sans); }
.admit .num { width: 60px; }
.admit .wide { flex: 1; min-width: 160px; }
.btn { height: 30px; padding: 0 12px; border-radius: 8px; border: 0; background: linear-gradient(180deg, #f0d083, #c9a24f); color: #1b1408; font: 800 12px var(--a-sans); cursor: pointer; }
@media (max-width: 640px) { .head { display: none; } .bed { grid-template-columns: 1fr; } .who { display: flex; align-items: center; gap: 8px; justify-items: start; text-align: left; } }
.nm-dice { padding: 4px 8px; border-radius: 8px; border: 1px solid var(--a-line); background: rgba(231, 197, 111, .08); font-size: 15px; line-height: 1; cursor: pointer; }
</style>
