<template>
  <!-- правка статьи правил (механики, справка рас и классов, магия): название, текст, скрыть, удалить -->
  <div class="ae">
    <input v-model="m.title" class="ae-title" placeholder="Название" />
    <RulesEditor v-model="m.html" :min-height="320" />
    <div class="ae-acts">
      <label class="ae-chk"><input v-model="m.hidden" type="checkbox" /> Скрыть от игроков</label>
      <span class="grow" />
      <button v-if="canRemove" type="button" class="ae-btn danger" @click="$emit('remove')">Удалить</button>
      <button type="button" class="ae-btn" @click="$emit('cancel')">Отмена</button>
      <button type="button" class="ae-btn primary" :disabled="busy" @click="$emit('save')">Сохранить</button>
    </div>
  </div>
</template>

<script setup>
import RulesEditor from './RulesEditor.vue'

const m = defineModel({ type: Object, required: true })
defineProps({ busy: Boolean, canRemove: Boolean })
defineEmits(['save', 'cancel', 'remove'])
</script>

<style scoped>
.ae-title { width: 100%; box-sizing: border-box; margin-bottom: 8px; padding: 8px 10px; border-radius: 9px; border: 1px solid rgba(231, 197, 111, .25); background: rgba(0, 0, 0, .3); color: #f3dc9e; font: 700 20px 'Cormorant Garamond', serif; }
.ae-acts { position: sticky; bottom: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 10px; padding: 8px 0 2px; background: linear-gradient(180deg, transparent, rgba(20, 16, 11, .95) 35%); }
.ae-chk { display: flex; align-items: center; gap: 6px; color: #cdbf9f; font: 600 13px 'Manrope', sans-serif; }
.grow { flex: 1; }
.ae-btn { padding: 6px 12px; border-radius: 9px; border: 1px solid rgba(231, 197, 111, .35); background: rgba(231, 197, 111, .08); color: #f3d99a; font: 700 12.5px 'Manrope', sans-serif; cursor: pointer; }
.ae-btn.primary { background: linear-gradient(180deg, #f0d083, #c9a24f); color: #1b1408; border-color: #c9a24f; }
.ae-btn.danger { border-color: rgba(255, 122, 107, .45); color: #ff9b8f; background: none; }
</style>
