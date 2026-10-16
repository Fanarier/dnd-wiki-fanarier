<template>
  <!-- кто ещё может смотреть лист (без правок): никто, все игроки или выбранные. Решают владелец и мастер -->
  <Teleport to="body">
    <div class="ss-back" @pointerdown.self="$emit('close')">
      <div class="ssd" role="dialog" aria-label="Кто видит лист">
        <header><b>👁 Кто видит лист</b><button type="button" class="sb-x" @click="$emit('close')">✕</button></header>
        <div class="ssd-modes">
          <label v-for="m in MODES" :key="m.v" class="ssd-mode" :class="{ on: mode === m.v }">
            <input v-model="mode" type="radio" :value="m.v" />
            <span class="ssd-ic">{{ m.ic }}</span>
            <span><b>{{ m.t }}</b><small>{{ m.d }}</small></span>
          </label>
        </div>
        <div v-if="mode === 'some'" class="ssd-list">
          <div v-if="!players.length" class="ssd-none">Других игроков пока нет.</div>
          <label v-for="p in players" :key="p.id" class="ssd-p" :class="{ on: picked.has(p.id) }">
            <input type="checkbox" :checked="picked.has(p.id)" @change="toggle(p.id)" />
            <img v-if="p.avatar" :src="avatarUrl(p.avatar)" alt="" />
            <i v-else :style="{ background: p.color }">{{ (p.character || '?')[0] }}</i>
            <span>{{ p.character }}</span>
          </label>
        </div>
        <p class="ssd-hint">Смотреть — значит видеть лист целиком и его изменения вживую, бросать кубы из него, но ничего не менять. Мастер видит все листы всегда.</p>
        <footer>
          <span class="grow" />
          <button type="button" class="sb-btn" @click="$emit('close')">Отмена</button>
          <button type="button" class="sb-btn primary" :disabled="busy" @click="save">Сохранить</button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { store, toast, api, avatarUrl } from '../map/store.js'
import { sheet } from './sheetState.js'

const emit = defineEmits(['close'])
const MODES = [
  { v: 'none', ic: '🔒', t: 'Только я и мастер', d: 'как сейчас у всех листов' },
  { v: 'all', ic: '🌍', t: 'Все игроки', d: 'любой вошедший игрок может открыть' },
  { v: 'some', ic: '👥', t: 'Выбранные игроки', d: 'например, напарники по группе' }
]
const share = sheet.meta?.share || { all: false, ids: [] }
const mode = ref(share.all ? 'all' : share.ids?.length ? 'some' : 'none')
const picked = reactive(new Set(share.ids || []))
const toggle = id => (picked.has(id) ? picked.delete(id) : picked.add(id))
// одобренные игроки, кроме владельца листа
const players = computed(() => (store.data.roster || []).filter(p => p.id !== sheet.meta?.ownerId).sort((a, b) => a.character.localeCompare(b.character, 'ru')))
const busy = ref(false)
async function save() {
  busy.value = true
  try {
    const m = await api('PATCH', `/api/sheets/${sheet.id}/share`, { all: mode.value === 'all', ids: mode.value === 'some' ? [...picked] : [] })
    if (sheet.meta) sheet.meta.share = m.share
    toast(mode.value === 'none' ? 'Лист снова только твой и мастера' : 'Готово — им виден лист')
    emit('close')
  } catch (e) { toast(e.message, 'error') } finally { busy.value = false }
}
</script>

<style scoped>
.ss-back { position: fixed; inset: 0; z-index: 640; display: grid; place-items: center; padding: 16px; background: rgba(5, 4, 3, .7); animation: ssd-fade .2s; --acc: #c9a24f; --ink: #efe3c8; --muted: #a8936c; --line: rgba(231, 197, 111, .25); }
.ssd { width: min(460px, 100%); max-height: calc(100vh - 32px); overflow-y: auto; display: grid; gap: 12px; padding: 16px; border-radius: 16px; background: linear-gradient(180deg, #221b13, #17130e); border: 1px solid #8a6630; box-shadow: 0 30px 80px rgba(0, 0, 0, .7); color: var(--ink); font-family: 'Manrope', sans-serif; }
.ssd header { display: flex; align-items: center; }
.ssd header b { flex: 1; font: 700 21px 'Cormorant Garamond', serif; color: #f3dc9e; }
.ssd-modes { display: grid; gap: 6px; }
.ssd-mode { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: 12px; border: 1px solid var(--line); cursor: pointer; transition: background .2s, border-color .2s; }
.ssd-mode input { display: none; }
.ssd-mode.on { border-color: var(--acc); background: rgba(231, 197, 111, .1); }
.ssd-ic { font-size: 20px; }
.ssd-mode b { display: block; font-size: 14px; }
.ssd-mode small { color: var(--muted); font-size: 12px; }
.ssd-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
.ssd-p { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 10px; border: 1px solid var(--line); cursor: pointer; font: 700 13px 'Manrope', sans-serif; min-width: 0; }
.ssd-p.on { border-color: var(--acc); background: rgba(231, 197, 111, .1); }
.ssd-p input { accent-color: #c9a24f; }
.ssd-p img, .ssd-p i { width: 26px; height: 26px; flex: none; border-radius: 50%; object-fit: cover; display: grid; place-items: center; font-style: normal; color: #1b1408; font-weight: 800; }
.ssd-p span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ssd-none { grid-column: 1 / -1; color: var(--muted); font-size: 13px; }
.ssd-hint { margin: 0; color: var(--muted); font-size: 12px; line-height: 1.5; }
.ssd footer { display: flex; gap: 8px; }
.grow { flex: 1; }
@keyframes ssd-fade { from { opacity: 0; } }
@media (max-width: 420px) { .ssd-list { grid-template-columns: 1fr; } }
</style>
