<template>
  <!-- правка расы мастером: название, вступление, базовые навыки, уровни (навык «сразу» и варианты на выбор) -->
  <div class="re2">
    <div class="re2-row">
      <input v-model="m.name" class="re2-name" placeholder="Название расы" />
      <label class="re2-chk"><input v-model="m.hidden" type="checkbox" /> Скрыть от игроков</label>
    </div>
    <details class="re2-box">
      <summary>Вступление (текст перед навыками)</summary>
      <RulesEditor v-model="m.intro" :min-height="80" />
    </details>

    <h3>Базовые навыки (уровень 0)</h3>
    <div class="re2-list">
      <SkillEdit v-for="(s, i) in m.base" :key="'b' + i" v-model="m.base[i]" @remove="m.base.splice(i, 1)" />
      <button type="button" class="re2-add" @click="m.base.push({ name: '', html: '' })">＋ Базовый навык</button>
    </div>

    <h3>Уровни</h3>
    <div v-for="(l, li) in m.levels" :key="'l' + li" class="re2-lv">
      <div class="re2-lvh">
        <input v-model.number="l.lv" type="number" min="1" max="40" class="re2-lvn" title="Уровень" /> уровень
        <span class="grow" />
        <button type="button" class="re2-x" title="Убрать уровень" @click="m.levels.splice(li, 1)">✕</button>
      </div>
      <div class="re2-sub">Получаешь сразу</div>
      <SkillEdit v-if="l.auto" v-model="l.auto" placeholder="Навык уровня" @remove="l.auto = null" />
      <button v-else type="button" class="re2-add" @click="l.auto = { name: '', html: '' }">＋ Навык «сразу»</button>
      <div class="re2-sub">На выбор — сколько выбрать: <input v-model.number="l.pick" type="number" min="1" max="6" class="re2-pk" placeholder="1" />
        · владение навыками по выбору: <input v-model.number="l.prof" type="number" min="0" max="6" class="re2-pk" placeholder="0" title="Сколько навыков (Атлетика, Внимание…) персонаж берёт во владение на этом уровне — одна точка" /></div>
      <div class="re2-list">
        <SkillEdit v-for="(o, oi) in l.options" :key="oi" v-model="l.options[oi]" :placeholder="`Вариант ${oi + 1}`" @remove="l.options.splice(oi, 1)" />
        <button type="button" class="re2-add" @click="l.options.push({ name: '', html: '' })">＋ Вариант</button>
      </div>
    </div>
    <button type="button" class="re2-add" @click="m.levels.push({ lv: (m.levels.at(-1)?.lv || 0) + 2, auto: null, options: [] })">＋ Уровень</button>

    <details class="re2-box">
      <summary>Текст после навыков</summary>
      <RulesEditor v-model="m.outro" :min-height="80" />
    </details>

    <div class="re2-acts">
      <button v-if="canRemove" type="button" class="re2-btn danger" @click="$emit('remove')">Удалить расу</button>
      <span class="grow" />
      <button type="button" class="re2-btn" @click="$emit('cancel')">Отмена</button>
      <button type="button" class="re2-btn primary" :disabled="busy" @click="$emit('save')">Сохранить</button>
    </div>
  </div>
</template>

<script setup>
import RulesEditor from './RulesEditor.vue'
import SkillEdit from './SkillEdit.vue'

const m = defineModel({ type: Object, required: true })
defineProps({ busy: Boolean, canRemove: { type: Boolean, default: true } })
defineEmits(['save', 'cancel', 'remove'])
</script>

<style scoped>
.re2 { display: grid; gap: 10px; padding: 14px; border-radius: 16px; background: rgba(20, 16, 11, .8); border: 1px solid rgba(231, 197, 111, .3); }
.re2 h3 { margin: 8px 0 0; font: 700 20px 'Cormorant Garamond', serif; color: #f3dc9e; }
.re2-row { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.re2-name { flex: 1; min-width: 200px; padding: 8px 10px; border-radius: 9px; border: 1px solid rgba(231, 197, 111, .25); background: rgba(0, 0, 0, .3); color: #f3dc9e; font: 700 20px 'Cormorant Garamond', serif; }
.re2-chk { display: flex; align-items: center; gap: 6px; color: #cdbf9f; font: 600 13px 'Manrope', sans-serif; }
.re2-box { padding: 8px 10px; border-radius: 10px; border: 1px solid rgba(231, 197, 111, .14); }
.re2-box summary { cursor: pointer; color: #cdbf9f; font: 700 13px 'Manrope', sans-serif; margin-bottom: 6px; }
.re2-list { display: grid; gap: 6px; }
.re2-lv { display: grid; gap: 6px; padding: 10px; border-radius: 12px; border: 1px solid rgba(231, 197, 111, .2); background: rgba(0, 0, 0, .15); }
.re2-lvh { display: flex; align-items: center; gap: 6px; color: #f3dc9e; font: 700 15px 'Manrope', sans-serif; }
.re2-lvn { width: 56px; padding: 4px 6px; border-radius: 8px; border: 1px solid rgba(231, 197, 111, .3); background: rgba(0, 0, 0, .3); color: #f3dc9e; font: 800 15px 'Manrope', sans-serif; text-align: center; }
.re2-pk { width: 46px; margin-left: 4px; padding: 2px 4px; border-radius: 6px; border: 1px solid rgba(231, 197, 111, .3); background: rgba(0, 0, 0, .3); color: #f3dc9e; font: 800 12px 'Manrope', sans-serif; text-align: center; }
.re2-sub { color: #a8936c; font: 800 10.5px 'Manrope', sans-serif; letter-spacing: .1em; text-transform: uppercase; }
.re2-add { justify-self: start; padding: 5px 12px; border-radius: 9px; border: 1px dashed rgba(231, 197, 111, .4); background: none; color: #e7c56f; font: 700 12.5px 'Manrope', sans-serif; cursor: pointer; }
.re2-x { width: 28px; height: 28px; border-radius: 8px; border: 1px solid rgba(255, 122, 107, .35); background: none; color: #ff9b8f; cursor: pointer; }
.re2-acts { position: sticky; bottom: 0; display: flex; gap: 8px; padding: 10px 0 2px; background: linear-gradient(180deg, transparent, rgba(20, 16, 11, .95) 30%); }
.grow { flex: 1; }
.re2-btn { padding: 7px 14px; border-radius: 9px; border: 1px solid rgba(231, 197, 111, .35); background: rgba(231, 197, 111, .08); color: #f3d99a; font: 700 13px 'Manrope', sans-serif; cursor: pointer; }
.re2-btn.primary { background: linear-gradient(180deg, #f0d083, #c9a24f); color: #1b1408; border-color: #c9a24f; }
.re2-btn.danger { border-color: rgba(255, 122, 107, .45); color: #ff9b8f; background: none; }
</style>
