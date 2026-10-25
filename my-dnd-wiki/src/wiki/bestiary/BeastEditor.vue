<template>
  <!-- правка существа (мастер): основное, характеристики, чувства и скорость, списки (через запятую), описание, заметки -->
  <Teleport to="body">
    <div class="be-back" @pointerdown.self="$emit('close')">
      <form class="be" @submit.prevent="save">
        <header><small>Бестиарий</small><b>{{ f.name || 'Существо' }}</b><button type="button" class="be-x" @click="$emit('close')">✕</button></header>
        <div class="be-grid">
          <label class="w2">Имя<input v-model.trim="f.name" maxlength="80" required /></label>
          <label>Группа<input v-model.trim="f.group" maxlength="60" list="be-groups" placeholder="Големы, Нежить…" /></label>
          <label>Опасность<input v-model.trim="f.danger" maxlength="60" list="be-dangers" /></label>
          <label>Размер<input v-model.trim="f.size" maxlength="60" /></label>
          <label>Тип<input v-model.trim="f.type" maxlength="60" /></label>
          <label>Раса<input v-model.trim="f.race" maxlength="60" /></label>
          <label>Мировоззрение<input v-model.trim="f.align" maxlength="60" /></label>
          <label>Хиты<input v-model="f.hp" maxlength="20" /></label>
          <label>Защита<input v-model="f.def" maxlength="20" /></label>
          <label>Уклонение<input v-model="f.eva" maxlength="20" /></label>
          <label>БМ<input v-model="f.bm" maxlength="20" /></label>
          <label>Опыт<input v-model="f.exp" maxlength="20" /></label>
          <label class="w2">Языки<input v-model.trim="f.langs" maxlength="60" /></label>
        </div>
        <div class="be-sub">Характеристики</div>
        <div class="be-grid six"><label v-for="s in f.stats" :key="s.k">{{ s.k }}<input v-model="s.v" maxlength="20" /></label></div>
        <div class="be-sub">Чувства и скорость</div>
        <div class="be-grid six">
          <label v-for="s in f.senses" :key="s.k">{{ s.k }}<input v-model="s.v" maxlength="20" /></label>
          <label v-for="s in f.speed" :key="s.k">{{ s.k }}<input v-model="s.v" maxlength="20" /></label>
        </div>
        <div class="be-sub">Списки — через запятую. Навыки описываются в общем справочнике НПС (✎ у навыка в листе)</div>
        <div class="be-grid two">
          <label v-for="l in LIST_TITLES" :key="l.key">{{ l.title }}<textarea v-model="lists[l.key]" rows="2" /></label>
        </div>
        <div class="be-f">Описание (видят все, кто встретил)<RichEditor v-model="f.desc" :min-height="90" /></div>
        <label class="be-f">🔒 Заметки мастера<textarea v-model="f.secret" rows="2" maxlength="4000" /></label>
        <footer>
          <button type="button" class="be-btn danger" @click="remove">Удалить существо</button>
          <span class="grow" />
          <button type="button" class="be-btn" @click="$emit('close')">Отмена</button>
          <button type="submit" class="be-btn primary" :disabled="busy">Сохранить</button>
        </footer>
        <datalist id="be-groups"><option v-for="g in groups" :key="g" :value="g" /></datalist>
        <datalist id="be-dangers"><option v-for="d in DANGERS" :key="d.v" :value="d.v" /></datalist>
      </form>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { api, toast, beastState, loadBestiary } from '../../map/store.js'
import RichEditor from '../../components/RichEditor.vue'
import { DANGERS, SKILL_BLOCKS, DEF_BLOCKS } from './beasts.js'

const props = defineProps({ b: { type: Object, required: true } })
const emit = defineEmits(['close', 'deleted'])
const f = reactive(JSON.parse(JSON.stringify(props.b)))
const LIST_TITLES = [...DEF_BLOCKS, ...SKILL_BLOCKS].map(x => ({ key: x.key, title: `${x.icon} ${x.title}` }))
const lists = reactive(Object.fromEntries(LIST_TITLES.map(l => [l.key, (props.b[l.key] || []).join(', ')])))
const groups = computed(() => [...new Set(beastState.beasts.map(x => x.group).filter(Boolean))])
const busy = ref(false)
async function save() {
  busy.value = true
  const body = { ...f, ...Object.fromEntries(Object.entries(lists).map(([k, v]) => [k, v.split(/[,\n]/).map(s => s.trim()).filter(Boolean)])) }
  delete body.arts
  try { await api('PATCH', `/api/bestiary/${props.b.id}`, body); await loadBestiary(true); toast('Сохранено'); emit('close') } catch (e) { toast(e.message, 'error') } finally { busy.value = false }
}
async function remove() {
  if (!confirm(`Удалить «${props.b.name}» из бестиария? Вернуть нельзя.`)) return
  try { await api('DELETE', `/api/bestiary/${props.b.id}`); await loadBestiary(true); toast('Удалено'); emit('deleted') } catch (e) { toast(e.message, 'error') }
}
</script>

<style scoped>
.be-back { position: fixed; inset: 0; z-index: 650; display: grid; place-items: center; padding: 16px; background: rgba(5, 4, 3, .72); backdrop-filter: blur(3px); }
.be { width: min(760px, 100%); max-height: calc(100vh - 32px); overflow-y: auto; display: grid; gap: 10px; padding: 16px; border-radius: 16px; background: linear-gradient(180deg, #221b13, #17130e); border: 1px solid rgba(231, 197, 111, .45); box-shadow: 0 30px 80px rgba(0, 0, 0, .7); color: #efe3c8; font: 600 13px 'Manrope', sans-serif; }
.be header { display: grid; grid-template-columns: 1fr auto; }
.be header small { color: #a8936c; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; font-size: 10.5px; }
.be header b { grid-row: 2; font: 700 26px 'Cormorant Garamond', serif; color: #f3dc9e; }
.be-x { grid-row: 1 / 3; grid-column: 2; align-self: start; width: 30px; height: 30px; border-radius: 9px; border: 1px solid rgba(231, 197, 111, .3); background: none; color: #f3dc9e; cursor: pointer; }
.be-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.be-grid.six { grid-template-columns: repeat(6, minmax(0, 1fr)); }
.be-grid.two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.be-grid .w2 { grid-column: span 2; }
.be label, .be-f { display: grid; gap: 3px; color: #a8936c; font-size: 11.5px; font-weight: 800; min-width: 0; }
.be input, .be textarea { width: 100%; box-sizing: border-box; padding: 6px 8px; border-radius: 8px; border: 1px solid rgba(231, 197, 111, .25); background: rgba(0, 0, 0, .35); color: #efe3c8; font: 600 13px 'Manrope', sans-serif; outline: none; resize: vertical; }
.be input:focus, .be textarea:focus { border-color: #e7c56f; }
.be-sub { margin-top: 4px; color: #f3dc9e; font: 700 16px 'Cormorant Garamond', serif; }
.be footer { display: flex; gap: 8px; align-items: center; }
.be footer .grow { flex: 1; }
.be-btn { height: 34px; padding: 0 14px; border-radius: 9px; border: 1px solid rgba(231, 197, 111, .35); background: rgba(0, 0, 0, .3); color: #f3dc9e; font: 700 13px 'Manrope', sans-serif; cursor: pointer; }
.be-btn.primary { background: linear-gradient(180deg, #f0d083, #c9a24f); color: #1b1408; border: 0; }
.be-btn.danger { color: #ff8f7f; border-color: rgba(255, 107, 94, .4); background: none; }
@media (max-width: 640px) { .be-grid, .be-grid.six { grid-template-columns: repeat(2, minmax(0, 1fr)); } .be-grid.two { grid-template-columns: minmax(0, 1fr); } }
</style>
