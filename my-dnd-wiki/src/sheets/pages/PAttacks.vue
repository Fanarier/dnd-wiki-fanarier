<template>
  <!-- атаки: тип и описание; кубы в описании («1к8 + 11») — кнопки броска урона -->
  <div class="pa">
    <h2 class="sb-h sb-anim"><span class="ic">⚔</span>Атаки</h2>
    <div class="sb-tools sb-anim">
      <span class="pa-hint">Щёлкни по кубам в описании — бросок урона. ● — отметка, например «основная атака».</span>
      <span class="grow" />
      <button v-if="!ro" type="button" class="sb-btn primary" @click="add">＋ Атака</button>
    </div>
    <div v-if="!items.length" class="sb-empty sb-anim">Атак пока нет.</div>
    <VueDraggable v-model="model" handle=".sb-handle" :animation="200" :disabled="ro" class="pa-list">
      <article v-for="(it, i) in model" :key="keyOf(it)" class="pa-card sb-anim" :class="{ marked: it.IsActive }" :data-find="`Attacks-${i}`">
        <header>
          <span v-if="!ro" class="sb-handle" title="Перетащить">⠿</span>
          <button type="button" class="sb-dot" :class="{ on: it.IsActive }" title="Отметка ●" @click="set(i, 'IsActive', !it.IsActive)" />
          <Fld :path="`Attacks.${i}.AttackType`" placeholder="Атака" class="pa-name" />
          <button v-if="!ro" type="button" class="sb-x" :title="editing.has(keyOf(it)) ? 'Готово' : 'Править'" @click="toggle(it)">{{ editing.has(keyOf(it)) ? '✓' : '✎' }}</button>
          <button v-if="!ro" type="button" class="sb-x" title="Удалить" @click="del(i)">✕</button>
        </header>
        <Fld v-if="editing.has(keyOf(it))" :path="`Attacks.${i}.Description`" type="area" :rows="2" placeholder="Например: 1к8 + 11 колющего урона" />
        <p v-else class="pa-desc" @dblclick="!ro && toggle(it)"><DiceText :text="it.Description || '—'" :label="it.AttackType" /></p>
      </article>
    </VueDraggable>
  </div>
</template>

<script setup>
import { computed, inject, reactive, ref } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import Fld from '../ui/Fld.vue'
import DiceText from '../ui/DiceText.vue'
import { sheet, edit, keyOf, listOps } from '../sheetState.js'

const ro = inject('sheetReadOnly', ref(false))
const items = computed(() => sheet.data.Attacks)
const ops = listOps('Attacks')
const model = computed({ get: () => items.value, set: v => ops.set(v) })
const editing = reactive(new Set())
const toggle = it => { const k = keyOf(it); editing.has(k) ? editing.delete(k) : editing.add(k) }
const set = (i, k, v) => { if (!ro.value) edit(`Attacks.${i}.${k}`, v, { now: true }) }
function add() {
  ops.add({ AttackType: 'Атака', Description: '', IsActive: false })
  setTimeout(() => editing.add(keyOf(items.value[items.value.length - 1])), 0)
}
const del = i => { if (confirm(`Удалить атаку «${items.value[i].AttackType}»?`)) ops.remove(i) }
</script>

<style scoped>
.pa-hint { color: var(--muted); font: 600 12px 'Manrope', sans-serif; }
.pa-list { display: grid; gap: 8px; }
.pa-card { padding: 8px 10px; border-radius: 12px; background: rgba(0, 0, 0, .18); border: 1px solid var(--line); }
.pa-card.marked { border-color: color-mix(in srgb, var(--acc) 55%, transparent); }
.pa-card header { display: flex; align-items: center; gap: 6px; }
.pa-name { flex: 1; }
.pa-name :deep(input) { font: 700 17px 'Cormorant Garamond', serif; }
.pa-desc { margin: 6px 4px 2px 30px; font: 600 14px/1.6 'Manrope', sans-serif; }
.pa-card > .fld { margin: 6px 0 2px 30px; }
</style>
