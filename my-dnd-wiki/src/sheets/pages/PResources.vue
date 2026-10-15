<template>
  <div class="pr">
    <h2 class="sb-h sb-anim"><SheetIcon name="res" class="ic" />Хиты</h2>
    <section class="pr-hp sb-card sb-anim" data-find="HpData" :class="{ hit: flash === 'hit', heal: flash === 'heal' }">
      <div class="pr-hp-nums">
        <Fld path="HpData.Current" type="num" label="Текущие" center class="cur" />
        <span class="pr-sl">/</span>
        <div v-if="fromHits" class="pr-max" title="Максимум берётся из поля «Хиты» на главной странице">
          <span>Максимум</span><b><Num :value="maxHp" /></b><small>из «Хиты»</small>
        </div>
        <Fld v-else path="HpData.Max" type="num" label="Максимум" center />
        <Fld path="HpData.Temp" type="num" label="Временные" center class="tmp" />
      </div>
      <div class="pr-bar"><i :style="{ width: pct + '%' }" :class="tone" /><i v-if="hp.Temp" class="t" :style="{ width: tmpPct + '%' }" /></div>
      <div v-if="!ro" class="pr-apply">
        <input v-model.number="amount" class="sb-input" type="number" min="0" placeholder="Сколько" @keydown.enter="apply(-1)" />
        <button type="button" class="sb-btn heal" :disabled="!amount" @click="apply(1)">❤ Лечение</button>
        <button type="button" class="sb-btn danger" :disabled="!amount" @click="apply(-1)">⚔ Урон</button>
        <span class="grow" />
        <button type="button" class="sb-btn" @click="fullHeal">✚ Полное исцеление</button>
      </div>
    </section>

    <h3 class="sb-h2 sb-anim">☠ Спасброски от смерти</h3>
    <section class="pr-ds sb-card sb-anim" data-find="death">
      <div class="pr-ds-row ok"><span>Успехи</span><button v-for="k in 3" :key="'s' + k" type="button" :class="{ on: hp['DS_S' + k] }" @click="ds('S', k)">✓</button></div>
      <div class="pr-ds-row bad"><span>Провалы</span><button v-for="k in 3" :key="'f' + k" type="button" :class="{ on: hp['DS_F' + k] }" @click="ds('F', k)">✕</button></div>
      <button v-if="!ro" type="button" class="sb-btn" @click="resetDs">🔄 Сбросить</button>
      <button type="button" class="sb-btn" title="Бросок спасброска от смерти" @click="roll('1d20', 'Спасбросок от смерти')">🎲 Бросить</button>
    </section>

    <h2 class="sb-h sb-anim" style="margin-top: 20px"><SheetIcon name="res" class="ic" />Ресурсы персонажа</h2>
    <div class="sb-tools sb-anim">
      <span class="pr-hint">Щелчок по кружку или ячейке — отметить до неё, правый щелчок — снять одну.</span>
      <span class="grow" />
      <template v-if="!ro">
        <button v-if="res.length" type="button" class="sb-btn" @click="restoreAll">🔄 Восстановить всё</button>
        <button type="button" class="sb-btn primary" @click="addRes">＋ Ресурс</button>
      </template>
    </div>
    <div v-if="!res.length" class="sb-empty sb-anim">
      Свои ресурсы: хвосты кицунэ (⭕ кружки), слоты заклинаний и патроны (🟫 ячейки), Ki или любые числа (🔢).
    </div>
    <div class="pr-list">
      <article v-for="(r, i) in res" :key="r.Id || keyOf(r)" class="pr-res sb-anim" :style="{ '--rc': r.Color || 'var(--acc)' }" :data-find="`Resources-${i}`">
        <header>
          <Fld :path="`Resources.${i}.Icon`" class="pr-icon" placeholder="✦" :max="4" center />
          <Fld :path="`Resources.${i}.Name`" placeholder="Название" class="pr-name" />
          <span class="pr-count"><b><Num :value="r.Current" /></b> / {{ r.Max }}</span>
          <button v-if="!ro" type="button" class="sb-x" title="Настроить" @click="flip(i)">⚙</button>
        </header>

        <div v-if="r.Style === 'number'" class="pr-num">
          <button type="button" :disabled="ro" @click="setCur(i, r.Current - 1)">−</button>
          <Fld :path="`Resources.${i}.Current`" type="num" center class="pr-big" />
          <button type="button" :disabled="ro" @click="setCur(i, r.Current + 1)">＋</button>
        </div>
        <div v-else class="pr-marks" :class="r.Style" @contextmenu.prevent="setCur(i, r.Current - 1)">
          <button v-for="k in Math.min(r.Max, 60)" :key="k" type="button" :class="{ on: k <= r.Current }" :title="`${k} из ${r.Max}`" @click="setCur(i, k === r.Current ? k - 1 : k)">
            <template v-if="r.Style === 'boxes'">{{ k <= r.Current ? '✓' : '' }}</template>
          </button>
          <span v-if="!r.Max" class="pr-hint">Задай максимум в настройках ⚙</span>
        </div>
        <p v-if="r.Notes && !setup.has(i)" class="pr-notes">{{ r.Notes }}</p>

        <div v-if="setup.has(i)" class="pr-setup">
          <div class="pr-styles">
            <button v-for="s in RES_STYLES" :key="s.key" type="button" class="sb-chip" :class="{ on: r.Style === s.key }" :title="s.hint" @click="edit(`Resources.${i}.Style`, s.key, { now: true })">{{ s.name }}</button>
          </div>
          <div class="pr-setup-row">
            <Fld :path="`Resources.${i}.Max`" type="num" label="Максимум" />
            <label class="pr-col"><span>Цвет</span><button type="button" class="pr-swatch" :style="{ background: r.Color || 'var(--acc)' }" @click="openColorMenu($event, `Resources.${i}.Color`, r.Color, 'Цвет ресурса')" /></label>
            <span class="grow" />
            <button type="button" class="sb-btn danger" @click="delRes(i)">🗑 Удалить</button>
          </div>
          <Fld :path="`Resources.${i}.Notes`" type="area" :rows="1" label="Заметки" />
        </div>
      </article>
    </div>
  </div>
</template>

<script setup>
import SheetIcon from '../ui/SheetIcon.vue'
import { computed, inject, reactive, ref } from 'vue'
import Fld from '../ui/Fld.vue'
import Num from '../ui/Num.vue'
import { sheet, edit, keyOf, listOps, roll } from '../sheetState.js'
import { RES_STYLES, hpMax } from '../../shared/sheet.js'
import { openColorMenu } from '../ui/colorMenu.js'

const ro = inject('sheetReadOnly', ref(false))
const hp = computed(() => sheet.data.HpData)
const res = computed(() => sheet.data.Resources)
const ops = listOps('Resources')
const maxHp = computed(() => hpMax(sheet.data))
const fromHits = computed(() => parseInt(String(sheet.data.Hits || '').replace(/^\+/, ''), 10) > 0)
const pct = computed(() => (maxHp.value > 0 ? Math.max(0, Math.min(100, (hp.value.Current / maxHp.value) * 100)) : 0))
const tmpPct = computed(() => (maxHp.value > 0 ? Math.min(100, (hp.value.Temp / maxHp.value) * 100) : 0))
const tone = computed(() => (pct.value <= 25 ? 'low' : pct.value <= 55 ? 'mid' : ''))
const amount = ref(null)
const flash = ref('')
const blink = k => { flash.value = k; setTimeout(() => { flash.value = '' }, 600) }

// урон сначала съедает временные хиты; лечение — не выше максимума
function apply(sign) {
  let n = Math.abs(Math.round(Number(amount.value) || 0))
  if (!n || ro.value) return
  const h = hp.value
  if (sign < 0) {
    if (h.Temp > 0) { const a = Math.min(h.Temp, n); edit('HpData.Temp', h.Temp - a); n -= a }
    edit('HpData.Current', Math.max(0, h.Current - n), { now: true })
    blink('hit')
  } else {
    edit('HpData.Current', maxHp.value > 0 ? Math.min(maxHp.value, h.Current + n) : h.Current + n, { now: true })
    blink('heal')
  }
  amount.value = null
}
function fullHeal() { edit('HpData.Current', maxHp.value, { now: true }); blink('heal') }
const ds = (kind, k) => { if (!ro.value) edit(`HpData.DS_${kind}${k}`, !hp.value[`DS_${kind}${k}`], { now: true }) }
function resetDs() { for (const k of ['S1', 'S2', 'S3', 'F1', 'F2']) edit(`HpData.DS_${k}`, false); edit('HpData.DS_F3', false, { now: true }) }

const setup = reactive(new Set())
const flip = i => (setup.has(i) ? setup.delete(i) : setup.add(i))
const setCur = (i, v) => { if (!ro.value) edit(`Resources.${i}.Current`, Math.max(0, res.value[i].Style === 'number' ? v : Math.min(res.value[i].Max, v)), { now: true }) }
function addRes() {
  ops.add({ Id: crypto.randomUUID?.() || String(Date.now()), Name: 'Новый ресурс', Current: 3, Max: 3, Color: '', ResetOn: 'long', Style: 'pips', Notes: '', Icon: '✦' })
  setup.clear()
  setup.add(res.value.length - 1)
}
function delRes(i) { if (confirm(`Удалить ресурс «${res.value[i].Name}»?`)) { setup.clear(); ops.remove(i) } }
function restoreAll() {
  if (!confirm('Восстановить все ресурсы до максимума?')) return
  edit('Resources', res.value.map(r => ({ ...r, Current: r.Max || r.Current })), { now: true })
}
</script>

<style scoped>
.pr-hp { display: grid; gap: 10px; transition: box-shadow .3s; }
.pr-hp.hit { animation: pr-hit .5s; }
.pr-hp.heal { box-shadow: 0 0 30px rgba(126, 224, 106, .35); }
@keyframes pr-hit { 20% { transform: translateX(-6px); box-shadow: 0 0 30px rgba(255, 90, 70, .5); } 40% { transform: translateX(5px); } 60% { transform: translateX(-3px); } 80% { transform: translateX(2px); } }
.pr-hp-nums { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) minmax(0, 1fr); gap: 8px; align-items: end; }
.pr-hp-nums :deep(input) { font-size: 26px; font-weight: 800; }
.pr-hp-nums .cur :deep(input) { color: #7ee06a; font-size: 32px; }
.pr-hp-nums .tmp :deep(input) { color: #4fd8ff; }
.pr-max { display: grid; justify-items: center; gap: 1px; }
.pr-max span { font: 700 10.5px 'Manrope', sans-serif; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
.pr-max b { font: 800 26px 'Manrope', sans-serif; }
.pr-max small { color: var(--muted); font-size: 10.5px; }
.pr-sl { font: 300 30px 'Manrope', sans-serif; color: var(--muted); padding-bottom: 4px; }
.pr-bar { position: relative; height: 16px; border-radius: 99px; background: rgba(0, 0, 0, .45); overflow: hidden; box-shadow: inset 0 1px 4px rgba(0, 0, 0, .6); }
.pr-bar i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 99px; background: linear-gradient(90deg, #3fae5a, #7ee06a); transition: width .6s cubic-bezier(.2, .9, .3, 1); }
.pr-bar i.mid { background: linear-gradient(90deg, #c98a1f, #ffd166); }
.pr-bar i.low { background: linear-gradient(90deg, #a5281c, #ff6b5e); }
.pr-bar i.t { left: auto; right: 0; background: repeating-linear-gradient(45deg, #4fd8ff, #4fd8ff 5px, #2a8db0 5px, #2a8db0 10px); }
.pr-apply { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.pr-apply .sb-input { width: 100px; }
.sb-btn.heal { border-color: rgba(126, 224, 106, .45); color: #a8e6a1; }
.grow { flex: 1; }
.pr-ds { display: flex; flex-wrap: wrap; gap: 12px 18px; align-items: center; }
.pr-ds-row { display: flex; align-items: center; gap: 6px; }
.pr-ds-row span { font: 800 11px 'Manrope', sans-serif; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); margin-right: 4px; }
.pr-ds-row button { width: 30px; height: 30px; border-radius: 50%; border: 2px solid; background: none; color: transparent; font-weight: 900; cursor: pointer; transition: all .2s; }
.pr-ds-row.ok button { border-color: rgba(126, 224, 106, .5); }
.pr-ds-row.bad button { border-color: rgba(255, 107, 94, .5); }
.pr-ds-row.ok button.on { background: #5cc96f; color: #0f1a10; box-shadow: 0 0 12px rgba(126, 224, 106, .6); }
.pr-ds-row.bad button.on { background: #e5483b; color: #1a0c0b; box-shadow: 0 0 12px rgba(255, 107, 94, .6); }
.pr-hint { color: var(--muted); font: 600 12px 'Manrope', sans-serif; }
.pr-list { display: grid; gap: 10px; }
.pr-res { display: grid; gap: 8px; padding: 10px 12px; border-radius: 14px; background: color-mix(in srgb, var(--rc) 6%, rgba(0, 0, 0, .2)); border: 1px solid color-mix(in srgb, var(--rc) 40%, transparent); }
.pr-res header { display: flex; align-items: center; gap: 6px; }
.pr-icon { width: 42px; flex: none; }
.pr-icon :deep(input) { font-size: 20px; padding: 2px; }
.pr-name { flex: 1; }
.pr-name :deep(input) { font: 700 17px 'Cormorant Garamond', serif; }
.pr-count { font: 700 13px 'Manrope', sans-serif; color: var(--muted); white-space: nowrap; }
.pr-count b { font-size: 18px; color: var(--rc); }
.pr-marks { display: flex; flex-wrap: wrap; gap: 6px; }
.pr-marks button { width: 26px; height: 26px; padding: 0; border: 2px solid color-mix(in srgb, var(--rc) 60%, transparent); background: none; cursor: pointer; transition: transform .15s, background .2s, box-shadow .2s; color: #1b140c; font-weight: 900; }
.pr-marks button:hover { transform: scale(1.12); }
.pr-marks.pips button { border-radius: 50%; }
.pr-marks.ammo button { width: 16px; height: 30px; border-radius: 4px; }
.pr-marks.boxes button { border-radius: 6px; }
.pr-marks button.on { background: var(--rc); box-shadow: 0 0 10px color-mix(in srgb, var(--rc) 60%, transparent); }
.pr-num { display: flex; align-items: center; gap: 8px; }
.pr-num > button { width: 34px; height: 34px; border-radius: 10px; border: 1px solid color-mix(in srgb, var(--rc) 50%, transparent); background: none; color: var(--ink); font-size: 18px; cursor: pointer; }
.pr-big { width: 110px; }
.pr-big :deep(input) { font-size: 26px; font-weight: 800; color: var(--rc); }
.pr-notes { margin: 0; color: var(--muted); font: 500 12.5px/1.5 'Manrope', sans-serif; white-space: pre-wrap; }
.pr-setup { display: grid; gap: 8px; padding-top: 8px; border-top: 1px dashed color-mix(in srgb, var(--rc) 30%, transparent); }
.pr-styles { display: flex; flex-wrap: wrap; gap: 5px; }
.pr-setup-row { display: flex; flex-wrap: wrap; align-items: end; gap: 10px; }
.pr-setup-row .fld { width: 100px; }
.pr-col { display: grid; gap: 2px; }
.pr-col span { font: 700 10.5px 'Manrope', sans-serif; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
.pr-swatch { width: 34px; height: 28px; border-radius: 8px; border: 2px solid rgba(255, 255, 255, .25); cursor: pointer; }
@media (max-width: 560px) { .pr-hp-nums { grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); } .pr-hp-nums .tmp { grid-column: 1 / -1; } }
</style>
