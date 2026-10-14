<template>
  <!-- свои листы: таблицы с любыми колонками (текст, флажок, число) -->
  <div class="pc">
    <h2 class="sb-h sb-anim"><span class="ic">📋</span>Свои листы</h2>
    <div class="pc-tabs sb-anim">
      <button v-for="(t, i) in tables" :key="keyOf(t)" type="button" class="sb-chip" :class="{ on: i === ti }" @click="ti = i">{{ t.Name || 'Без названия' }}</button>
      <button v-if="!ro && tables.length < 20" type="button" class="sb-btn" @click="addTable">＋ Лист</button>
    </div>
    <div v-if="!tables.length" class="sb-empty sb-anim">Здесь можно завести свою таблицу: список квестов, заклинаний, долгов — что угодно.</div>

    <section v-if="tab" class="pc-tab sb-anim" :data-find="`CustomSheets-${ti}`">
      <div class="pc-head">
        <Fld :path="`CustomSheets.${ti}.Name`" placeholder="Название листа" big />
        <button v-if="!ro" type="button" class="sb-btn danger" @click="delTable">🗑</button>
      </div>
      <div class="pc-scroll">
        <table>
          <thead>
            <tr>
              <th v-for="(c, ci) in tab.Columns" :key="ci">
                <input :value="c.Header" :readonly="ro" placeholder="Колонка" @input="setCol(ci, 'Header', $event.target.value)" />
                <span v-if="!ro" class="pc-colacts">
                  <select :value="c.ColumnType" title="Тип колонки" @change="setCol(ci, 'ColumnType', $event.target.value)">
                    <option value="text">текст</option><option value="toggle">флажок</option><option value="number">число</option>
                  </select>
                  <button type="button" title="Удалить колонку" @click="delCol(ci)">✕</button>
                </span>
              </th>
              <th v-if="!ro" class="pc-add"><button type="button" :disabled="tab.Columns.length >= 12" title="Добавить колонку" @click="addCol">＋</button></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, ri) in tab.Rows" :key="ri">
              <td v-for="(c, ci) in tab.Columns" :key="ci" :class="c.ColumnType">
                <input v-if="c.ColumnType === 'toggle'" type="checkbox" :checked="isTrue(r.Cells[ci])" :disabled="ro" @change="setCell(ri, ci, $event.target.checked ? 'True' : 'False')" />
                <input v-else :value="r.Cells[ci] ?? ''" :readonly="ro" :inputmode="c.ColumnType === 'number' ? 'numeric' : 'text'" @input="setCell(ri, ci, $event.target.value)" />
              </td>
              <td v-if="!ro" class="pc-add"><button type="button" title="Удалить строку" @click="delRow(ri)">✕</button></td>
            </tr>
          </tbody>
        </table>
      </div>
      <button v-if="!ro" type="button" class="sb-btn" :disabled="!tab.Columns.length" @click="addRow">＋ Строка</button>
    </section>
  </div>
</template>

<script setup>
import { computed, inject, ref } from 'vue'
import Fld from '../ui/Fld.vue'
import { sheet, edit, keyOf, listOps } from '../sheetState.js'

const ro = inject('sheetReadOnly', ref(false))
const tables = computed(() => sheet.data.CustomSheets)
const ops = listOps('CustomSheets')
const ti = ref(0)
const tab = computed(() => tables.value[ti.value] || null)
const base = () => `CustomSheets.${ti.value}`
const isTrue = v => /^(true|1|да)$/i.test(String(v || ''))
const clone = () => JSON.parse(JSON.stringify(tab.value))
const setCol = (ci, k, v) => edit(`${base()}.Columns.${ci}.${k}`, v)
function setCell(ri, ci, v) {
  const cells = [...(tab.value.Rows[ri].Cells || [])]
  while (cells.length < tab.value.Columns.length) cells.push('')
  cells[ci] = v
  edit(`${base()}.Rows.${ri}.Cells`, cells)
}
function addTable() {
  ops.add({ Name: 'Новый лист', Columns: [{ Header: 'Название', ColumnType: 'text' }, { Header: 'Заметки', ColumnType: 'text' }], Rows: [{ Cells: ['', ''] }] })
  ti.value = tables.value.length - 1
}
function delTable() {
  if (!confirm(`Удалить лист «${tab.value.Name}» целиком?`)) return
  ops.remove(ti.value)
  ti.value = Math.max(0, ti.value - 1)
}
function addCol() {
  const t = clone()
  t.Columns.push({ Header: '', ColumnType: 'text' })
  for (const r of t.Rows) r.Cells.push('')
  edit(base(), t, { now: true })
}
function delCol(ci) {
  if (!confirm(`Удалить колонку «${tab.value.Columns[ci].Header || ci + 1}» со всеми значениями?`)) return
  const t = clone()
  t.Columns.splice(ci, 1)
  for (const r of t.Rows) r.Cells.splice(ci, 1)
  edit(base(), t, { now: true })
}
const addRow = () => edit(`${base()}.Rows`, [...tab.value.Rows, { Cells: tab.value.Columns.map(c => (c.ColumnType === 'toggle' ? 'False' : '')) }], { now: true })
const delRow = ri => { const rows = [...tab.value.Rows]; rows.splice(ri, 1); edit(`${base()}.Rows`, rows, { now: true }) }
</script>

<style scoped>
.pc-tabs { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-bottom: 12px; }
.pc-tab { display: grid; gap: 10px; }
.pc-head { display: flex; align-items: center; gap: 8px; }
.pc-head .fld { flex: 1; }
.pc-scroll { overflow-x: auto; border-radius: 12px; border: 1px solid var(--line); }
table { width: 100%; border-collapse: collapse; font: 600 13px 'Manrope', sans-serif; }
th, td { border-bottom: 1px solid var(--line); padding: 2px 4px; text-align: left; vertical-align: middle; }
th { background: color-mix(in srgb, var(--acc) 10%, rgba(0, 0, 0, .3)); min-width: 110px; }
th input { font-weight: 800; color: color-mix(in srgb, var(--acc) 60%, #fff3d6); }
th, td { border-right: 1px solid var(--line); }
input:not([type='checkbox']), select { width: 100%; box-sizing: border-box; padding: 5px 6px; border: 0; background: transparent; color: var(--ink); font: inherit; outline: none; border-radius: 6px; }
input:focus { background: color-mix(in srgb, var(--acc) 10%, transparent); }
td.number input { text-align: right; font-variant-numeric: tabular-nums; }
td.toggle { text-align: center; }
td.toggle input { width: 18px; height: 18px; accent-color: var(--acc); }
.pc-colacts { display: flex; gap: 2px; }
.pc-colacts select { font-size: 11px; color: var(--muted); padding: 2px; color-scheme: dark; }
.pc-colacts button, .pc-add button { border: 0; background: none; color: var(--muted); cursor: pointer; padding: 2px 6px; border-radius: 6px; }
.pc-colacts button:hover, .pc-add button:hover { color: #ff9b8f; }
.pc-add { width: 30px; min-width: 30px; text-align: center; }
</style>
