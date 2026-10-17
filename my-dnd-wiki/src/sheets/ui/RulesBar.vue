<template>
  <!-- навыки из вики: какая раса, класс и архетип (узнаются сами, можно поправить) + выбор расового навыка уровня -->
  <div v-if="rulesState.loaded" class="rb">
    <div class="rb-row">
      <span class="rb-h">📖 Из вики</span>
      <label class="rb-f" :class="{ miss: !race }">
        <span>Раса</span>
        <select :value="race?.name || ''" :disabled="ro" @change="edit('RulesRace', $event.target.value, { now: true })">
          <option value="">{{ d.Race ? `не нашлась «${d.Race}»` : '— выбрать —' }}</option>
          <option v-for="r in rulesState.races" :key="r.id" :value="r.name">{{ r.name }}</option>
        </select>
      </label>
      <label class="rb-f" :class="{ miss: !cls }">
        <span>Класс</span>
        <select :value="cls?.name || ''" :disabled="ro" @change="edit('RulesClass', $event.target.value, { now: true }); edit('RulesArch', '', { now: true })">
          <option value="">{{ d.Class ? `не нашёлся «${d.Class}»` : '— выбрать —' }}</option>
          <option v-for="k in rulesState.classes" :key="k.id" :value="k.name">{{ k.name }}</option>
        </select>
      </label>
      <label v-if="cls?.archetypes.length" class="rb-f" :class="{ miss: !arch && d.Level >= 3 }">
        <span>Архетип</span>
        <select :value="arch?.name || ''" :disabled="ro" @change="edit('RulesArch', $event.target.value, { now: true })">
          <option value="">{{ d.Subclass ? `не нашёлся «${d.Subclass}»` : '— выбрать —' }}</option>
          <option v-for="a in cls.archetypes" :key="a.name" :value="a.name">{{ a.name }}</option>
        </select>
      </label>
      <span class="grow" />
      <router-link v-if="race" class="rb-link" :to="{ path: '/wiki', query: { race: race.id } }">раса в вики →</router-link>
      <router-link v-if="cls" class="rb-link" :to="{ path: '/wiki', query: { cls: cls.id, arch: arch?.name } }">класс в вики →</router-link>
    </div>
    <p class="rb-hint">Навыки расы, класса и архетипа на {{ d.Level || 0 }} уровне добавляются сами; удалённый вручную не вернётся.</p>

    <!-- пора выбрать расовый навык -->
    <div v-for="l in pending" :key="l.lv" class="rb-pick">
      <b class="rb-pick-h">✦ {{ pickOf(l) > 1 ? `Выбери ${pickOf(l)} расовых навыка ${l.lv} уровня` : `Выбери расовый навык ${l.lv} уровня` }}
        <small v-if="pickOf(l) > 1">выбрано {{ chosen(l).length }} из {{ pickOf(l) }}</small></b>
      <div class="rb-opts">
        <button v-for="o in l.options" :key="o.name" type="button" class="rb-opt" :class="{ on: isChosen(l, o) }" :disabled="ro" :title="text(o.html)" @click="choose(l, o)">
          <b>{{ isChosen(l, o) ? '✓ ' : '' }}{{ o.name }}</b>
          <small>{{ text(o.html).slice(0, 180) }}{{ text(o.html).length > 180 ? '…' : '' }}</small>
        </button>
      </div>
    </div>

    <!-- владение навыком по выбору за уровень расы («Разносторонний»): одна точка в навыке -->
    <div v-for="l in profs" :key="'p' + l.lv" class="rb-prof" :class="{ todo: profsAt(d, l.lv).length < profOf(l) }">
      <b class="rb-pick-h">{{ profsAt(d, l.lv).length < profOf(l) ? '✦ ' : '✓ ' }}Владение {{ profOf(l) > 1 ? profOf(l) + ' навыками' : 'навыком' }} по выбору
        <small>{{ l.lv }} ур.{{ l.auto ? ` · «${l.auto.name}»` : '' }}</small></b>
      <select v-for="k in profOf(l)" :key="k" :value="profsAt(d, l.lv)[k - 1] || ''" :disabled="ro" @change="setProf(l, k - 1, $event.target.value)">
        <option value="">— выбрать навык —</option>
        <option v-for="s in SKILLS" :key="s.key" :value="s.key" :disabled="s.key !== profsAt(d, l.lv)[k - 1] && (taken(s.key) || profP(s.key) > 0)">
          {{ s.name }}{{ profP(s.key) > 0 && s.key !== profsAt(d, l.lv)[k - 1] ? ' · уже есть' : '' }}
        </option>
      </select>
    </div>
  </div>
</template>

<script setup>
import { computed, inject, ref } from 'vue'
import { rulesState } from '../../map/store.js'
import { sheet, edit } from '../sheetState.js'
import { findRace, findClass, findArch, pendingChoices, htmlToText, choicesAt, joinChoices, pickOf, normName, profOf, profsAt, profLevels } from '../../shared/rules.js'
import { SKILLS } from '../../shared/sheet.js'
import { sfx } from '../../sound/sound.js'

const ro = inject('sheetReadOnly', ref(false))
const d = computed(() => sheet.data)
const race = computed(() => findRace(rulesState.races, d.value))
const cls = computed(() => findClass(rulesState.classes, d.value))
const arch = computed(() => findArch(cls.value, d.value))
const pending = computed(() => pendingChoices(rulesState, d.value))
const text = h => htmlToText(h).replace(/\s+/g, ' ')
const chosen = l => choicesAt(d.value, l.lv)
const isChosen = (l, o) => chosen(l).some(c => normName(c) === normName(o.name))
// щелчок — выбрать вариант (у людей набирается два), повторный — передумать
function choose(l, o) {
  if (ro.value) return
  const cur = chosen(l)
  const next = isChosen(l, o) ? cur.filter(c => normName(c) !== normName(o.name)) : [...cur, o.name].slice(-pickOf(l))
  edit('RaceChoices', { ...(d.value.RaceChoices || {}), [l.lv]: joinChoices(next) }, { now: true })
  if (!isChosen(l, o)) sfx('crit', 0.35)
}

// владение за расу: выбранный навык получает одну точку (базовое владение); передумал — точка снимается,
// если выше её никто не поднимал
const profs = computed(() => profLevels(rulesState, d.value))
const profP = key => Number(d.value.Stats?.[key + 'P']) || 0
const taken = key => Object.values(d.value.RaceProf || {}).some(v => String(v).split(',').includes(key))
function setProf(l, i, key) {
  if (ro.value) return
  const cur = profsAt(d.value, l.lv)
  const old = cur[i]
  if (old === key) return
  if (old && profP(old) === 1) edit(`Stats.${old}P`, 0, { now: true })
  if (key && profP(key) < 1) edit(`Stats.${key}P`, 1, { now: true })
  const next = [...cur]
  next[i] = key
  edit('RaceProf', { ...(d.value.RaceProf || {}), [l.lv]: next.filter(Boolean).join(',') }, { now: true })
  if (key) sfx('crit', 0.35)
}
</script>

<style scoped>
.rb { display: grid; gap: 8px; margin-bottom: 12px; padding: 10px 12px; border-radius: 12px; background: color-mix(in srgb, var(--acc) 6%, rgba(0, 0, 0, .2)); border: 1px solid var(--line); }
.rb-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.rb-h { font: 800 12px 'Manrope', sans-serif; letter-spacing: .06em; color: color-mix(in srgb, var(--acc) 60%, #fff3d6); }
.rb-f { display: flex; align-items: center; gap: 5px; font: 700 11px 'Manrope', sans-serif; color: var(--muted); }
.rb-f select { max-width: 170px; padding: 3px 6px; border-radius: 8px; border: 1px solid var(--line); background: rgba(0, 0, 0, .3); color: var(--ink); font: 700 12px 'Manrope', sans-serif; color-scheme: dark; }
.rb-f.miss select { border-color: rgba(255, 170, 90, .6); color: #ffc58a; }
.grow { flex: 1; }
.rb-link { color: color-mix(in srgb, var(--acc) 60%, #fff3d6); font: 700 12px 'Manrope', sans-serif; text-decoration: none; }
.rb-link:hover { text-decoration: underline; }
.rb-hint { margin: 0; color: var(--muted); font: 600 11.5px 'Manrope', sans-serif; }
.rb-pick { display: grid; gap: 6px; padding: 8px; border-radius: 10px; border: 1px dashed color-mix(in srgb, var(--acc) 60%, transparent); background: color-mix(in srgb, var(--acc) 8%, transparent); animation: rb-glow 2.4s ease-in-out infinite; }
@keyframes rb-glow { 50% { box-shadow: 0 0 18px color-mix(in srgb, var(--acc) 30%, transparent); } }
.rb-pick-h { font: 800 13px 'Manrope', sans-serif; color: color-mix(in srgb, var(--acc) 60%, #fff3d6); }
.rb-opts { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 6px; }
.rb-opt { display: grid; gap: 3px; padding: 8px 10px; border-radius: 10px; border: 1px solid var(--line); background: rgba(0, 0, 0, .25); color: var(--ink); text-align: left; cursor: pointer; transition: border-color .2s, transform .2s; }
.rb-opt:hover:not(:disabled) { border-color: var(--acc); transform: translateY(-2px); }
.rb-opt b { font: 700 15px 'Cormorant Garamond', serif; }
.rb-opt.on { border-color: var(--acc); background: color-mix(in srgb, var(--acc) 18%, rgba(0, 0, 0, .25)); }
.rb-pick-h small { margin-left: 6px; color: var(--muted); font-weight: 700; }
.rb-opt small { color: var(--muted); font: 500 11.5px/1.4 'Manrope', sans-serif; }
.rb-prof { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 10px; border: 1px solid var(--line); }
.rb-prof.todo { border-style: dashed; border-color: color-mix(in srgb, var(--acc) 60%, transparent); background: color-mix(in srgb, var(--acc) 8%, transparent); animation: rb-glow 2.4s ease-in-out infinite; }
.rb-prof small { margin-left: 4px; color: var(--muted); font-weight: 700; }
.rb-prof select { padding: 3px 6px; border-radius: 8px; border: 1px solid var(--line); background: rgba(0, 0, 0, .3); color: var(--ink); font: 700 12px 'Manrope', sans-serif; color-scheme: dark; }
@media (prefers-reduced-motion: reduce) { .rb-pick, .rb-prof { animation: none; } }
</style>
