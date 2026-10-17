<template>
  <!-- правка класса мастером: основы, навыки по уровням, архетипы со своими навыками -->
  <div class="ce">
    <div class="ce-row">
      <input v-model="m.name" class="ce-name" placeholder="Название класса" />
      <label class="ce-chk"><input v-model="m.hidden" type="checkbox" /> Скрыть от игроков</label>
    </div>
    <details class="ce-box" open>
      <summary>Основы класса: требования, хиты, владения, спасброски</summary>
      <RulesEditor v-model="m.intro" :min-height="100" />
    </details>

    <h3>Навыки класса</h3>
    <p class="ce-hint">Строка без описания и типа («Выбор архетипа», «Выбор расового навыка») показывается вехой на ленте.</p>
    <div class="ce-list">
      <SkillEdit v-for="(s, i) in m.skills" :key="'s' + i" v-model="m.skills[i]" with-lv with-kind @remove="m.skills.splice(i, 1)" />
      <button type="button" class="ce-add" @click="m.skills.push({ lv: m.skills.at(-1)?.lv || 1, name: '', kind: 'Активный навык', tags: [], html: '' })">＋ Навык</button>
    </div>

    <h3>Архетипы</h3>
    <div v-for="(a, ai) in m.archetypes" :key="'a' + ai" class="ce-arch">
      <div class="ce-row">
        <input v-model="a.name" class="ce-aname" placeholder="Название архетипа" />
        <button type="button" class="ce-x" title="Удалить архетип" @click="confirmDrop(ai)">✕</button>
      </div>
      <details class="ce-box">
        <summary>Описание архетипа</summary>
        <RulesEditor v-model="a.about" :min-height="80" />
      </details>
      <div class="ce-list">
        <SkillEdit v-for="(s, i) in a.skills" :key="i" v-model="a.skills[i]" with-lv with-kind @remove="a.skills.splice(i, 1)" />
        <button type="button" class="ce-add" @click="a.skills.push({ lv: a.skills.at(-1)?.lv || 3, name: '', kind: 'Активный навык', tags: [], html: '' })">＋ Навык архетипа</button>
      </div>
    </div>
    <button type="button" class="ce-add" @click="m.archetypes.push({ name: '', about: '', skills: [] })">＋ Архетип</button>

    <details class="ce-box">
      <summary>Текст после навыков</summary>
      <RulesEditor v-model="m.outro" :min-height="80" />
    </details>

    <div class="ce-acts">
      <button v-if="canRemove" type="button" class="ce-btn danger" @click="$emit('remove')">Удалить класс</button>
      <span class="grow" />
      <button type="button" class="ce-btn" @click="$emit('cancel')">Отмена</button>
      <button type="button" class="ce-btn primary" :disabled="busy" @click="$emit('save')">Сохранить</button>
    </div>
  </div>
</template>

<script setup>
import RulesEditor from './RulesEditor.vue'
import SkillEdit from './SkillEdit.vue'

const m = defineModel({ type: Object, required: true })
defineProps({ busy: Boolean, canRemove: { type: Boolean, default: true } })
defineEmits(['save', 'cancel', 'remove'])
const confirmDrop = i => { if (confirm(`Удалить архетип «${m.value.archetypes[i].name}» со всеми навыками?`)) m.value.archetypes.splice(i, 1) }
</script>

<style scoped>
.ce { display: grid; gap: 10px; padding: 14px; border-radius: 16px; background: rgba(20, 16, 11, .8); border: 1px solid rgba(231, 197, 111, .3); }
.ce h3 { margin: 8px 0 0; font: 700 20px 'Cormorant Garamond', serif; color: #f3dc9e; }
.ce-hint { margin: 0; color: #a8936c; font: 600 12px 'Manrope', sans-serif; }
.ce-row { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.ce-name, .ce-aname { flex: 1; min-width: 200px; padding: 8px 10px; border-radius: 9px; border: 1px solid rgba(231, 197, 111, .25); background: rgba(0, 0, 0, .3); color: #f3dc9e; font: 700 20px 'Cormorant Garamond', serif; }
.ce-aname { font-size: 18px; }
.ce-chk { display: flex; align-items: center; gap: 6px; color: #cdbf9f; font: 600 13px 'Manrope', sans-serif; }
.ce-box { padding: 8px 10px; border-radius: 10px; border: 1px solid rgba(231, 197, 111, .14); }
.ce-box summary { cursor: pointer; color: #cdbf9f; font: 700 13px 'Manrope', sans-serif; margin-bottom: 6px; }
.ce-list { display: grid; gap: 6px; }
.ce-arch { display: grid; gap: 6px; padding: 10px; border-radius: 12px; border: 1px solid rgba(194, 123, 255, .25); background: rgba(0, 0, 0, .15); }
.ce-add { justify-self: start; padding: 5px 12px; border-radius: 9px; border: 1px dashed rgba(231, 197, 111, .4); background: none; color: #e7c56f; font: 700 12.5px 'Manrope', sans-serif; cursor: pointer; }
.ce-x { width: 30px; height: 30px; border-radius: 8px; border: 1px solid rgba(255, 122, 107, .35); background: none; color: #ff9b8f; cursor: pointer; }
.ce-acts { position: sticky; bottom: 0; display: flex; gap: 8px; padding: 10px 0 2px; background: linear-gradient(180deg, transparent, rgba(20, 16, 11, .95) 30%); }
.grow { flex: 1; }
.ce-btn { padding: 7px 14px; border-radius: 9px; border: 1px solid rgba(231, 197, 111, .35); background: rgba(231, 197, 111, .08); color: #f3d99a; font: 700 13px 'Manrope', sans-serif; cursor: pointer; }
.ce-btn.primary { background: linear-gradient(180deg, #f0d083, #c9a24f); color: #1b1408; border-color: #c9a24f; }
.ce-btn.danger { border-color: rgba(255, 122, 107, .45); color: #ff9b8f; background: none; }
</style>
