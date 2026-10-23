<template>
  <!-- цель группы: отметка «выполнено», название (у секретной для игроков — «???»), ссылка на квест, заметка.
       Мастеру — правка, «раскрыть» и удаление -->
  <div ref="row" class="gr" :class="[goal.kind, { done: goal.done, secret: goal.secret, editing }]">
    <button type="button" class="gr-check" :disabled="!master" :title="master ? (goal.done ? 'Вернуть в активные' : 'Отметить выполненной') : (goal.done ? 'Выполнена' : 'Не выполнена')" @click="toggle">
      <svg viewBox="0 0 20 20"><path d="M4 10.5 L8.5 15 L16 5.5" /></svg>
    </button>
    <div class="gr-body">
      <template v-if="!editing">
        <b v-if="goal.secret && !master" class="gr-title q">??? <small>цель пока скрыта</small></b>
        <b v-else class="gr-title">{{ goal.title || 'Без названия' }}<small v-if="goal.secret" class="gr-lock">🔒 скрыта от игроков</small></b>
        <router-link v-if="quest" :to="{ path: '/activity', query: { section: 'campaign', cq: quest.id } }" class="gr-quest">📜 {{ quest.name }}</router-link>
        <p v-if="goal.note" class="gr-note">{{ goal.note }}</p>
      </template>
      <div v-else class="gr-edit">
        <input :value="goal.title" class="ps-in" maxlength="200" placeholder="Что нужно сделать" autofocus @change="emit('save', { title: $event.target.value })" />
        <div class="gr-edit-row">
          <select :value="goal.kind" class="ps-in" @change="emit('save', { kind: $event.target.value })"><option value="main">Главная</option><option value="side">Побочная</option></select>
          <select :value="goal.questId || ''" class="ps-in" @change="emit('save', { questId: $event.target.value || null })">
            <option value="">— без квеста —</option>
            <option v-for="q in quests" :key="q.id" :value="q.id">{{ q.name }}{{ q.type ? ' · ' + q.type : '' }}</option>
          </select>
        </div>
        <textarea :value="goal.note" class="ps-in" rows="2" maxlength="1000" placeholder="Заметка (по желанию)" @change="emit('save', { note: $event.target.value })" />
        <label class="gr-sec"><input :checked="goal.secret" type="checkbox" @change="emit('save', { secret: $event.target.checked })" /> Скрыть от игроков — они видят «???»</label>
      </div>
    </div>
    <div v-if="master" class="gr-act">
      <button v-if="goal.secret && !editing" type="button" class="reveal" title="Игроки нашли — раскрыть цель" @click="emit('reveal')">👁 Раскрыть</button>
      <button type="button" :title="editing ? 'Готово' : 'Изменить'" @click="emit('edit')">{{ editing ? '✓' : '✎' }}</button>
      <button type="button" class="x" title="Удалить" @click="emit('remove')">✕</button>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { celebrate } from '../wiki/rules/actFx.js'
import { sfx } from '../sound/sound.js'

const props = defineProps({ goal: { type: Object, required: true }, master: Boolean, quests: { type: Array, default: () => [] }, editing: Boolean })
const emit = defineEmits(['toggle', 'edit', 'save', 'reveal', 'remove'])
const row = ref(null)
const quest = computed(() => props.goal.questId && props.quests.find(q => q.id === props.goal.questId))
function toggle() {
  if (!props.master) return
  if (!props.goal.done) { celebrate(row.value); sfx('crit', 0.35) }
  emit('toggle')
}
</script>

<style scoped>
.gr { display: flex; gap: 10px; align-items: flex-start; padding: 9px 10px; border-radius: 12px; background: rgba(0, 0, 0, .28); border: 1px solid rgba(255, 207, 122, .18); border-left: 3px solid #ffb35a; transition: background .2s, opacity .3s; }
.gr.side { border-left-color: #6fa8ff; border-color: rgba(111, 168, 255, .18); }
.gr.done { opacity: .6; border-left-color: #7ed07a; }
.gr.secret:not(.editing) .gr-title.q { color: #a8936c; letter-spacing: .2em; }
.gr-check { flex: none; width: 24px; height: 24px; margin-top: 1px; padding: 3px; border-radius: 7px; border: 2px solid rgba(255, 207, 122, .55); background: rgba(0, 0, 0, .3); cursor: pointer; }
.gr-check:disabled { cursor: default; }
.gr-check svg { width: 100%; height: 100%; fill: none; stroke: #7ed07a; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 22; stroke-dashoffset: 22; transition: stroke-dashoffset .35s ease; }
.gr.done .gr-check { border-color: #7ed07a; background: rgba(126, 208, 122, .15); }
.gr.done .gr-check svg { stroke-dashoffset: 0; }
.gr-body { flex: 1; min-width: 0; display: grid; gap: 3px; }
.gr-title { color: #f3dc9e; font: 700 15px 'Manrope', sans-serif; overflow-wrap: anywhere; }
.gr.done .gr-title { text-decoration: line-through; text-decoration-color: rgba(126, 208, 122, .7); }
.gr-title small { margin-left: 6px; font-size: 11px; font-weight: 700; color: #a8936c; letter-spacing: 0; }
.gr-lock { color: #c9b8ff !important; }
.gr-quest { justify-self: start; padding: 1px 8px; border-radius: 99px; background: rgba(231, 197, 111, .1); border: 1px solid rgba(231, 197, 111, .3); color: #ffcf7a; font: 700 12px 'Manrope', sans-serif; text-decoration: none; }
.gr-quest:hover { background: rgba(231, 197, 111, .2); }
.gr-note { margin: 0; color: #c9b896; font-size: 13px; white-space: pre-wrap; }
.gr-act { display: flex; gap: 3px; flex: none; }
.gr-act button { height: 26px; min-width: 26px; padding: 0 6px; border-radius: 7px; border: 1px solid rgba(231, 197, 111, .3); background: rgba(0, 0, 0, .3); color: #f3dc9e; font: 700 12px 'Manrope', sans-serif; cursor: pointer; }
.gr-act .reveal { color: #c9b8ff; border-color: rgba(185, 166, 255, .45); }
.gr-act .x { color: #ff8f7f; }
.gr-edit { display: grid; gap: 6px; }
.gr-edit-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 2fr); gap: 6px; }
.ps-in { width: 100%; box-sizing: border-box; padding: 6px 8px; border-radius: 8px; border: 1px solid rgba(231, 197, 111, .3); background: rgba(0, 0, 0, .35); color: #efe3c8; font: 600 13px 'Manrope', sans-serif; outline: none; resize: vertical; }
.ps-in option { background: #1a130c; }
.gr-sec { display: flex; align-items: center; gap: 6px; color: #c9b8ff; font: 700 12px 'Manrope', sans-serif; }
</style>
