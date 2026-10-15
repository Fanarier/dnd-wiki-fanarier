<template>
  <!-- мастер: чей лист и к какой карточке «Героев Анкарии» он привязан -->
  <Teleport to="body">
    <div class="sm-back" @pointerdown.self="$emit('close')">
      <div class="sm" role="dialog" aria-label="Владелец листа">
        <header><b>Владелец и карточка героя</b><button type="button" class="sb-x" @click="$emit('close')">✕</button></header>
        <label>Игрок
          <select v-model="owner" class="sb-input">
            <option value="">— без игрока (лист у мастера) —</option>
            <option v-for="o in sheets.owners" :key="o.id" :value="o.id">{{ o.name }} · {{ o.linked ? (o.tech ? 'персонаж техспециалиста ' : 'персонаж мастера ') + o.login : o.login }}</option>
          </select>
        </label>
        <label>Карточка героя (вики)
          <select v-model="hero" class="sb-input">
            <option value="">— не привязан —</option>
            <option v-for="h in heroes" :key="h.id" :value="h.id">{{ h.name }}</option>
          </select>
        </label>
        <label v-if="hero && !hasPhoto" class="sm-chk"><input v-model="copyPortrait" type="checkbox" /> Взять портрет с карточки героя</label>
        <p class="sm-hint">Игрок видит и правит только свои листы. На привязанной карточке героя появится кнопка «📜 Лист персонажа» — для владельца листа и мастеров.</p>
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
import { computed, onMounted, ref } from 'vue'
import { store, toast } from '../map/store.js'
import { sheet, sheets, loadSheets, setMeta } from './sheetState.js'

// открывают и из книги (лист загружен), и из списка листов (только краткие сведения — summary)
const props = defineProps({ sheetId: { type: String, required: true }, summary: { type: Object, default: null } })
const emit = defineEmits(['close'])
const src = props.summary || sheet.meta || {}
const owner = ref(src.ownerId || '')
const hero = ref(src.heroId || '')
const hasPhoto = computed(() => (props.summary ? !!props.summary.photo : !!sheet.data?.PhotoFile))
const copyPortrait = ref(true)
const busy = ref(false)
const heroes = computed(() => (store.data.heroes || []).slice().sort((a, b) => a.name.localeCompare(b.name, 'ru')))
onMounted(() => { if (!sheets.loaded) loadSheets() })
async function save() {
  busy.value = true
  try {
    const m = await setMeta(props.sheetId, { ownerId: owner.value || null, heroId: hero.value || null, copyPortrait: copyPortrait.value })
    if (sheet.id === props.sheetId && sheet.meta) Object.assign(sheet.meta, m)
    loadSheets()
    toast('Сохранено')
    emit('close')
  } catch (e) { toast(e.message, 'error') } finally { busy.value = false }
}
</script>

<style scoped>
.sm-back { position: fixed; inset: 0; z-index: 640; display: grid; place-items: center; padding: 16px; background: rgba(5, 4, 3, .7); animation: sm-fade .2s; --acc: #c9a24f; --ink: #efe3c8; --muted: #a8936c; --line: rgba(231, 197, 111, .25); }
.sm { width: min(460px, 100%); display: grid; gap: 12px; padding: 16px; border-radius: 16px; background: linear-gradient(180deg, #221b13, #17130e); border: 1px solid #8a6630; box-shadow: 0 30px 80px rgba(0, 0, 0, .7); color: var(--ink); font-family: 'Manrope', sans-serif; }
.sm header { display: flex; align-items: center; }
.sm header b { flex: 1; font: 700 21px 'Cormorant Garamond', serif; color: #f3dc9e; }
.sm label { display: grid; gap: 4px; font: 700 12px 'Manrope', sans-serif; color: var(--muted); }
.sm select { color-scheme: dark; }
.sm-chk { display: flex !important; align-items: center; gap: 6px; }
.sm-hint { margin: 0; color: var(--muted); font-size: 12px; line-height: 1.5; }
.sm footer { display: flex; gap: 8px; }
.grow { flex: 1; }
@keyframes sm-fade { from { opacity: 0; } }
</style>
