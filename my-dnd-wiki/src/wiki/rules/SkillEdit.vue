<template>
  <!-- один навык в редакторе правил: название (+ уровень, тип, теги у классов) и описание, которое раскрывается по кнопке -->
  <div class="se" :class="{ open }">
    <div class="se-row">
      <input v-if="withLv" v-model.number="model.lv" class="se-lv" type="number" min="0" max="40" title="Уровень" />
      <input v-model="model.name" class="se-name" :placeholder="placeholder" />
      <input v-if="withKind" v-model="model.kind" class="se-kind" list="se-kinds" placeholder="Тип навыка" />
      <button type="button" class="se-btn" :title="open ? 'Свернуть' : 'Править описание'" @click="open = !open">{{ open ? '▴' : '✎' }}</button>
      <button v-if="removable" type="button" class="se-btn danger" title="Удалить" @click="$emit('remove')">✕</button>
    </div>
    <input v-if="withKind && open" class="se-tags" :value="(model.tags || []).join(', ')" placeholder="Теги через запятую: Лечение, Эффекты…" @change="model.tags = $event.target.value.split(',').map(t => t.trim()).filter(Boolean)" />
    <RulesEditor v-if="open" v-model="model.html" :min-height="90" />
    <div v-else-if="model.html" class="se-prev" @click="open = true">{{ preview }}</div>
    <datalist id="se-kinds"><option value="Пассивный навык" /><option value="Активный навык" /><option value="Ультимативный навык" /></datalist>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import RulesEditor from './RulesEditor.vue'

const model = defineModel({ type: Object, required: true })
defineProps({ withLv: Boolean, withKind: Boolean, removable: { type: Boolean, default: true }, placeholder: { type: String, default: 'Название навыка' } })
defineEmits(['remove'])
const open = ref(false)
const preview = computed(() => String(model.value.html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160))
</script>

<style scoped>
.se { display: grid; gap: 6px; padding: 7px; border-radius: 10px; background: rgba(0, 0, 0, .2); border: 1px solid rgba(231, 197, 111, .14); }
.se.open { border-color: rgba(231, 197, 111, .35); }
.se-row { display: flex; gap: 6px; align-items: center; min-width: 0; }
.se input { min-width: 0; padding: 5px 8px; border-radius: 8px; border: 1px solid rgba(231, 197, 111, .2); background: rgba(0, 0, 0, .3); color: #efe3c8; font: 600 13px 'Manrope', sans-serif; }
.se input:focus { outline: none; border-color: #e7c56f; }
.se-lv { width: 52px; text-align: center; }
.se-name { flex: 1; font-weight: 700 !important; }
.se-kind { width: 150px; }
.se-tags { width: 100%; box-sizing: border-box; }
.se-btn { flex: none; width: 28px; height: 28px; border-radius: 8px; border: 1px solid rgba(231, 197, 111, .25); background: none; color: #f3d99a; cursor: pointer; }
.se-btn.danger { color: #ff9b8f; border-color: rgba(255, 122, 107, .35); }
.se-prev { color: #a8936c; font: 500 12px 'Manrope', sans-serif; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
