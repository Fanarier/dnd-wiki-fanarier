<template>
  <!-- правка словаря «ключ → число»: ресурсы в день, места работ и т. п. -->
  <div class="me">
    <div v-for="(r, i) in rows" :key="i" class="me-r">
      <select :value="r.k" @change="set(i, $event.target.value, r.v)"><option v-for="o in keys" :key="o.key" :value="o.key">{{ o.label }}</option></select>
      <input type="number" :value="r.v" step="any" @change="set(i, r.k, Number($event.target.value) || 0)" />
      <button type="button" class="x" title="Убрать" @click="drop(i)">×</button>
    </div>
    <button type="button" class="add" :disabled="!free.length" @click="addRow">＋ {{ addLabel }}</button>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({ modelValue: { type: Object, default: null }, keys: { type: Array, required: true }, addLabel: { type: String, default: 'добавить' } })
const emit = defineEmits(['update:modelValue'])
const rows = computed(() => Object.entries(props.modelValue || {}).map(([k, v]) => ({ k, v })))
const free = computed(() => props.keys.filter(o => !(o.key in (props.modelValue || {}))))
function put(list) {
  const o = Object.fromEntries(list.map(r => [r.k, r.v]))
  emit('update:modelValue', Object.keys(o).length ? o : null)
}
function set(i, k, v) {
  const list = rows.value.map(r => ({ ...r }))
  if (k !== list[i].k && list.some(r => r.k === k)) return
  list[i] = { k, v }
  put(list)
}
const drop = i => put(rows.value.filter((_, j) => j !== i))
const addRow = () => put([...rows.value, { k: free.value[0].key, v: 1 }])
</script>

<style scoped>
.me { display: grid; gap: 3px; }
.me-r { display: grid; grid-template-columns: minmax(0, 1fr) 70px 22px; gap: 4px; }
select, input { min-width: 0; padding: 3px 6px; border-radius: 7px; border: 1px solid var(--a-line-2); background: rgba(0, 0, 0, .3); color: var(--a-text); font: 600 12px var(--a-sans); }
.x { border: 0; background: none; color: var(--a-muted); font-size: 16px; cursor: pointer; }
.add { justify-self: start; padding: 2px 8px; border-radius: 7px; border: 1px dashed var(--a-line); background: none; color: var(--a-gold-2); font: 700 11.5px var(--a-sans); cursor: pointer; }
.add:disabled { opacity: .4; cursor: default; }
</style>
