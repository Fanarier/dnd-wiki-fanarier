<template>
  <!-- справочник НПС: эффекты (подсказки в описаниях) и навыки (описание одно на всех, у кого навык) -->
  <div class="ng-back" @pointerdown.self="$emit('close')">
    <section class="ng" role="dialog" aria-modal="true" aria-label="Справочник">
      <header>
        <b>📖 Справочник</b>
        <button type="button" class="ng-x" aria-label="Закрыть" @click="$emit('close')">×</button>
      </header>
      <nav class="ng-tabs">
        <button v-for="t in TABS" :key="t.key" type="button" :class="{ on: tab === t.key }" @click="tab = t.key; openId = null">{{ t.label }}<small>{{ t.n() }}</small></button>
      </nav>
      <div class="ng-bar">
        <input v-model="q" type="search" placeholder="Поиск по названию и описанию…" />
        <label v-if="tab !== 'effects'" class="ng-chk"><input v-model="emptyOnly" type="checkbox" /> без описания</label>
        <button v-if="master" type="button" class="ng-btn" @click="add">+ {{ tab === 'effects' ? 'Эффект' : 'Навык' }}</button>
      </div>

      <div class="ng-list">
        <div v-for="x in rows" :key="x.id" class="ng-row" :class="{ open: openId === x.id }">
          <button type="button" class="ng-head" @click="toggle(x)">
            <span v-if="tab === 'effects'" class="ng-dot" :style="{ background: x.color }" />
            <b :style="tab === 'effects' ? { color: x.color } : null">{{ x.name }}</b>
            <span v-if="x.type" class="ng-type">{{ x.type }}</span>
            <small v-if="tab !== 'effects'" class="ng-used">{{ usedBy(x).length }} НПС</small>
            <span class="ng-short">{{ x.desc || '— описания пока нет —' }}</span>
          </button>
          <div v-if="openId === x.id" class="ng-full">
            <template v-if="master">
              <div class="ng-grid">
                <label>Название<input v-model.trim="f.name" maxlength="80" /></label>
                <template v-if="tab === 'effects'">
                  <label>Другие формы слова<input v-model="f.aliases" placeholder="Провокацию, Провокации" /></label>
                  <label class="ng-color">Цвет<input v-model="f.color" type="color" /></label>
                </template>
                <template v-else>
                  <label>Тип<input v-model.trim="f.type" maxlength="40" /></label>
                  <template v-if="tab === 'active'">
                    <label>Перезарядка<input v-model.trim="f.cooldown" maxlength="80" /></label>
                    <label>Затраты<input v-model.trim="f.cost" maxlength="80" /></label>
                  </template>
                </template>
              </div>
              <label class="ng-desc">Описание<textarea v-model="f.desc" rows="5" maxlength="4000" /></label>
              <div class="ng-acts">
                <button type="button" class="ng-btn no" @click="remove(x)">Удалить</button>
                <span class="grow" />
                <button type="button" class="ng-btn" @click="openId = null">Отмена</button>
                <button type="button" class="ng-btn primary" :disabled="!f.name" @click="save(x)">Сохранить</button>
              </div>
            </template>
            <template v-else>
              <p v-if="x.desc"><FxText :text="x.desc" :effects="npcState.effects" /></p>
              <p v-else class="ng-none">Описание пока не заполнено.</p>
              <p v-if="tab === 'active' && (x.cooldown || x.cost)" class="ng-meta">{{ [x.cooldown, x.cost].filter(Boolean).join(' · ') }}</p>
            </template>
            <p v-if="tab !== 'effects' && usedBy(x).length" class="ng-who">Есть у: {{ usedBy(x).join(', ') }}</p>
          </div>
        </div>
        <p v-if="!rows.length" class="ng-none">Ничего не нашлось.</p>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import FxText from './FxText.vue'
import { store, npcState, act } from '../../map/store.js'
import { skillKey } from '../../shared/npc.js'

defineEmits(['close'])
const master = computed(() => store.role === 'master')
const tab = ref('effects')
const q = ref('')
const emptyOnly = ref(false)
const skillsOf = kind => npcState.skills.filter(s => s.kind === kind)
const TABS = [
  { key: 'effects', label: 'Эффекты', n: () => npcState.effects.length },
  { key: 'passive', label: 'Пассивные навыки', n: () => skillsOf('passive').length },
  { key: 'active', label: 'Активные навыки', n: () => skillsOf('active').length }
]
const source = computed(() => (tab.value === 'effects' ? npcState.effects : skillsOf(tab.value)))
const rows = computed(() => {
  const w = q.value.trim().toLowerCase()
  return source.value
    .filter(x => (!w || `${x.name} ${(x.aliases || []).join(' ')} ${x.desc}`.toLowerCase().includes(w)) && (!emptyOnly.value || !x.desc))
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
})
const usedBy = x => npcState.npcs.filter(n => (x.kind === 'active' ? n.actives : n.passives).some(s => skillKey(x.kind, s.name) === skillKey(x.kind, x.name))).map(n => n.name)

const openId = ref(null)
const f = reactive({})
function toggle(x) {
  if (openId.value === x.id) { openId.value = null; return }
  openId.value = x.id
  Object.assign(f, { name: x.name, type: x.type || '', cooldown: x.cooldown || '', cost: x.cost || '', desc: x.desc || '', color: x.color || '#c9a2ff', aliases: (x.aliases || []).join(', ') })
}
const url = () => (tab.value === 'effects' ? '/api/npc-effects' : '/api/npc-skills')
const body = () => (tab.value === 'effects'
  ? { name: f.name, color: f.color, desc: f.desc, aliases: String(f.aliases || '').split(',').map(s => s.trim()).filter(Boolean) }
  : { kind: tab.value, name: f.name, type: f.type, cooldown: f.cooldown, cost: f.cost, desc: f.desc })
async function save(x) {
  try { await act('PATCH', `${url()}/${x.id}`, body(), 'Сохранено'); openId.value = null } catch { /* тост */ }
}
async function remove(x) {
  if (!confirm(`Удалить «${x.name}» из справочника?${tab.value !== 'effects' && usedBy(x).length ? ' У НПС навык останется, но без описания.' : ''}`)) return
  try { await act('DELETE', `${url()}/${x.id}`, undefined, 'Удалено'); openId.value = null } catch { /* тост */ }
}
async function add() {
  const name = prompt(tab.value === 'effects' ? 'Название эффекта (как в скобках в описаниях):' : 'Название навыка:')
  if (!name?.trim()) return
  try {
    const x = await act('POST', url(), tab.value === 'effects' ? { name: name.trim() } : { kind: tab.value, name: name.trim() }, 'Добавлено — заполни описание')
    q.value = ''
    setTimeout(() => { const y = source.value.find(s => s.id === x.id); if (y) toggle(y) }, 400)
  } catch { /* тост */ }
}
</script>

<style scoped>
.ng-back { position: fixed; inset: 0; z-index: 320; display: grid; place-items: center; padding: 16px; background: rgba(5, 6, 10, .7); backdrop-filter: blur(3px); }
.ng { display: flex; flex-direction: column; width: min(820px, 100%); height: min(760px, calc(100vh - 32px)); border-radius: 16px; background: #17130e; border: 1px solid #8a6630; box-shadow: 0 24px 60px rgba(0, 0, 0, .6); color: #efe3c8; font: 13px 'Manrope', sans-serif; overflow: hidden; }
.ng header { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid rgba(201, 162, 79, .2); }
.ng header b { font: 700 21px 'Cormorant Garamond', serif; color: #f3d99a; }
.ng-x { border: 0; background: none; color: #a8936c; font-size: 22px; cursor: pointer; }
.ng-tabs { display: flex; flex-wrap: wrap; gap: 4px; padding: 10px 16px 0; }
.ng-tabs button { display: flex; gap: 6px; align-items: center; padding: 6px 12px; border-radius: 99px; border: 1px solid rgba(231, 197, 111, .3); background: none; color: #cdbf9f; font: 700 12.5px 'Manrope', sans-serif; cursor: pointer; }
.ng-tabs button.on { background: rgba(231, 197, 111, .2); color: #f3dc9e; border-color: #e7c56f; }
.ng-tabs small { opacity: .7; }
.ng-bar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding: 10px 16px; }
.ng-bar input[type=search] { flex: 1 1 220px; min-width: 0; padding: 7px 10px; border-radius: 9px; border: 1px solid rgba(231, 197, 111, .25); background: #0f0c08; color: #efe3c8; font: 500 13px 'Manrope', sans-serif; }
.ng-chk { display: flex; gap: 6px; align-items: center; color: #a8936c; font-weight: 700; }
.ng-list { flex: 1; overflow-y: auto; padding: 0 16px 16px; display: grid; grid-template-columns: minmax(0, 1fr); align-content: start; gap: 6px; }
.ng-row { border-radius: 11px; border: 1px solid rgba(231, 197, 111, .14); background: rgba(255, 255, 255, .02); }
.ng-row.open { border-color: rgba(231, 197, 111, .45); }
.ng-head { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; width: 100%; padding: 8px 12px; border: 0; background: none; color: inherit; text-align: left; cursor: pointer; font: inherit; }
.ng-head b { font-size: 13.5px; color: #f3dc9e; }
.ng-dot { width: 10px; height: 10px; border-radius: 50%; flex: none; }
.ng-type { padding: 1px 8px; border-radius: 99px; background: rgba(143, 199, 255, .12); color: #8fc7ff; font-size: 11px; font-weight: 800; }
.ng-used { color: #a8936c; font-weight: 700; }
.ng-short { flex-basis: 100%; color: #a8936c; font-size: 12.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ng-row.open .ng-short { display: none; }
.ng-full { padding: 0 12px 12px; display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; }
.ng-full p { margin: 0; line-height: 1.55; font-size: 13px; }
.ng-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(160px, 100%), 1fr)); gap: 8px; }
.ng-full label { display: grid; gap: 4px; color: #a8936c; font-weight: 700; font-size: 12px; }
.ng-full input, .ng-full textarea { width: 100%; box-sizing: border-box; padding: 7px 9px; border-radius: 8px; border: 1px solid rgba(231, 197, 111, .25); background: #0f0c08; color: #efe3c8; font: 500 13px/1.5 'Manrope', sans-serif; }
.ng-color input { height: 34px; padding: 2px; }
.ng-acts { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.ng-btn { padding: 6px 12px; border-radius: 9px; border: 1px solid rgba(201, 162, 79, .45); background: rgba(231, 197, 111, .08); color: #f3d99a; font: 700 12.5px 'Manrope', sans-serif; cursor: pointer; }
.ng-btn.primary { background: linear-gradient(180deg, #f0cf83, #c99a45); color: #1b140c; border-color: #e6c27a; }
.ng-btn.no { border-color: rgba(255, 107, 91, .45); color: #ff9b8f; background: none; }
.ng-btn:disabled { opacity: .5; }
.ng-none { color: #6f6656; font-style: italic; }
.ng-meta, .ng-who { color: #a8936c; font-size: 12px !important; }
.grow { flex: 1; }
</style>
