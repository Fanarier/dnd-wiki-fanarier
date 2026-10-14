<template>
  <!-- владения: черты 4/9/18 уровня, черты гуманоидов (до 5), владения и языки с уровнем 0–3 -->
  <div class="pt">
    <h2 class="sb-h sb-anim"><span class="ic">🎓</span>Черты</h2>
    <div class="pt-traits sb-anim">
      <div v-for="t in LEVEL_TRAITS" :key="t.p" class="pt-trait" :class="{ got: d[t.p].IsAcquired }" :data-find="t.p">
        <span class="pt-lv">{{ t.lv }}<small>ур.</small></span>
        <Fld :path="`${t.p}.Description`" type="area" :rows="1" :placeholder="`Черта ${t.lv} уровня`" />
        <button type="button" class="pt-got" :class="{ on: d[t.p].IsAcquired }" :title="d[t.p].IsAcquired ? 'Получена' : 'Ещё не получена'" @click="set(`${t.p}.IsAcquired`, !d[t.p].IsAcquired)">✓</button>
      </div>
    </div>

    <h3 class="sb-h2 sb-anim">Черты гуманоидов <small>{{ d.HumanoidTraits.length }} / 5</small></h3>
    <div class="pt-hum sb-anim">
      <div v-for="(t, i) in d.HumanoidTraits" :key="keyOf(t)" class="pt-trait hum" :class="{ got: t.IsAcquired }" :data-find="`HumanoidTraits-${i}`">
        <Fld :path="`HumanoidTraits.${i}.Name`" placeholder="Название" class="nm" />
        <Fld :path="`HumanoidTraits.${i}.Description`" type="area" :rows="1" placeholder="Описание" />
        <button type="button" class="pt-got" :class="{ on: t.IsAcquired }" title="Получена" @click="set(`HumanoidTraits.${i}.IsAcquired`, !t.IsAcquired)">✓</button>
        <button v-if="!ro" type="button" class="sb-x" title="Удалить" @click="hum.remove(i)">✕</button>
      </div>
      <button v-if="!ro && d.HumanoidTraits.length < 5" type="button" class="sb-btn" @click="hum.add({ Name: '', Description: '', IsAcquired: false })">＋ Черта гуманоида</button>
    </div>

    <h2 class="sb-h sb-anim" style="margin-top: 22px"><span class="ic">📚</span>Владения и языки</h2>
    <div class="sb-tools sb-anim">
      <button v-for="f in FILTERS" :key="f.v" type="button" class="sb-chip" :class="{ on: kind === f.v }" @click="kind = f.v">{{ f.t }}</button>
      <span class="grow" />
      <template v-if="!ro">
        <button type="button" class="sb-btn" @click="addProf(0)">＋ Владение</button>
        <button type="button" class="sb-btn" @click="addProf(1)">＋ Язык</button>
      </template>
    </div>
    <div v-if="!d.Proficiencies.length" class="sb-empty">Пока пусто.</div>
    <VueDraggable v-model="profModel" handle=".sb-handle" :animation="200" :disabled="ro || kind !== -1" class="pt-profs">
      <div v-for="(p, i) in profModel" v-show="kind === -1 || p.TypeIndex === kind" :key="keyOf(p)" class="pt-prof sb-anim" :data-find="`Proficiencies-${i}`">
        <span v-if="!ro && kind === -1" class="sb-handle">⠿</span>
        <button type="button" class="pt-type" :class="p.TypeIndex ? 'lang' : 'own'" :title="'Щёлкни, чтобы сменить тип'" @click="set(`Proficiencies.${i}.TypeIndex`, p.TypeIndex ? 0 : 1)">{{ p.TypeIndex ? '🗣 Язык' : '🛠 Владение' }}</button>
        <Fld :path="`Proficiencies.${i}.Description`" placeholder="Что именно" class="pt-desc" />
        <IconRating :path="`Proficiencies.${i}.Rating`" :max="3" icon="diamond" title="Уровень" />
        <button v-if="!ro" type="button" class="sb-x" title="Удалить" @click="prof.remove(i)">✕</button>
      </div>
    </VueDraggable>
  </div>
</template>

<script setup>
import { computed, inject, ref } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import Fld from '../ui/Fld.vue'
import IconRating from '../ui/IconRating.vue'
import { sheet, edit, keyOf, listOps } from '../sheetState.js'

const ro = inject('sheetReadOnly', ref(false))
const d = computed(() => sheet.data)
const LEVEL_TRAITS = [{ p: 'Trait4', lv: 4 }, { p: 'Trait9', lv: 9 }, { p: 'Trait18', lv: 18 }]
const FILTERS = [{ v: -1, t: 'Все' }, { v: 0, t: 'Владения' }, { v: 1, t: 'Языки' }]
const kind = ref(-1)
const hum = listOps('HumanoidTraits')
const prof = listOps('Proficiencies')
const profModel = computed({ get: () => d.value.Proficiencies, set: v => prof.set(v) })
const set = (p, v) => { if (!ro.value) edit(p, v, { now: true }) }
const addProf = t => { kind.value = -1; prof.add({ TypeIndex: t, Description: '', Rating: 1 }) }
</script>

<style scoped>
.pt-traits, .pt-hum { display: grid; gap: 8px; }
.pt-trait { display: grid; grid-template-columns: 54px minmax(0, 1fr) 30px; gap: 8px; align-items: center; padding: 8px 10px; border-radius: 12px; background: rgba(0, 0, 0, .18); border: 1px solid var(--line); transition: border-color .2s, background .2s; }
.pt-trait.hum { grid-template-columns: minmax(0, 160px) minmax(0, 1fr) 30px 26px; }
.pt-trait.got { border-color: color-mix(in srgb, var(--acc) 50%, transparent); background: color-mix(in srgb, var(--acc) 6%, rgba(0, 0, 0, .18)); }
.pt-lv { display: grid; place-items: center; height: 46px; border-radius: 10px; background: color-mix(in srgb, var(--acc) 14%, transparent); color: var(--acc); font: 800 20px 'Manrope', sans-serif; line-height: 1; }
.pt-lv small { font-size: 9px; letter-spacing: .1em; }
.pt-trait .nm :deep(input) { font-weight: 800; }
.pt-got { width: 30px; height: 30px; border-radius: 50%; border: 2px solid color-mix(in srgb, var(--acc) 40%, transparent); background: none; color: transparent; font-weight: 900; cursor: pointer; transition: all .2s; }
.pt-got.on { background: var(--acc); color: #1b140c; border-color: var(--acc); box-shadow: 0 0 12px color-mix(in srgb, var(--acc) 60%, transparent); }
.sb-h2 small { color: var(--muted); margin-left: 6px; }
.pt-profs { display: grid; gap: 6px; }
.pt-prof { display: flex; align-items: center; gap: 8px; padding: 5px 8px; border-radius: 10px; background: rgba(0, 0, 0, .15); }
.pt-type { flex: none; min-width: 100px; padding: 3px 8px; border-radius: 8px; border: 1px solid; background: none; font: 700 12px 'Manrope', sans-serif; cursor: pointer; text-align: left; }
.pt-type.own { color: #ffd166; border-color: rgba(255, 209, 102, .4); }
.pt-type.lang { color: #7cc4ff; border-color: rgba(124, 196, 255, .4); }
.pt-desc { flex: 1; }
.pt-prof :deep(.ir) { --ir: 20px; flex: none; }
@media (max-width: 560px) {
  .pt-trait.hum { grid-template-columns: minmax(0, 1fr) 30px 26px; }
  .pt-trait.hum .nm { grid-column: 1 / -1; }
  .pt-prof { flex-wrap: wrap; }
  .pt-desc { flex-basis: 100%; order: 3; }
}
</style>
