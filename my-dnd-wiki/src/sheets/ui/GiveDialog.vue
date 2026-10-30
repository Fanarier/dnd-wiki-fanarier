<template>
  <!-- передать вещь другому герою: сразу, получателю — уведомление; мастер может вернуть вещь в вики «Предметы» -->
  <Teleport to="body">
    <div class="gv-back" @pointerdown.self="$emit('close')">
      <form class="gv" @submit.prevent="send">
        <header>
          <small>Передать</small>
          <b :style="rar ? { color: rar.color } : null">{{ item?.Name || 'Предмет' }}</b>
          <button type="button" class="gv-x" title="Закрыть" @click="$emit('close')">✕</button>
        </header>
        <label v-if="max > 1" class="gv-qty">Сколько <input v-model.number="qty" type="number" min="1" :max="max" /> <small>из {{ max }}</small></label>
        <input v-model="q" class="gv-q" placeholder="Кому… (имя героя)" />
        <div class="gv-list">
          <p v-if="loading" class="gv-empty">Загрузка…</p>
          <p v-else-if="!shown.length" class="gv-empty">Никого не нашлось.</p>
          <button v-for="t in shown" :key="t.id" type="button" class="gv-t" :class="{ on: to === t.id }" @click="to = t.id">
            <img v-if="t.photo" :src="sheetImg(t.photo)" alt="" />
            <span v-else class="gv-ph">{{ (t.name || '?')[0] }}</span>
            <span class="gv-n"><b>{{ t.name || 'Без имени' }}</b><small v-if="t.hero && t.hero !== t.name">{{ t.hero }}</small></span>
          </button>
          <button v-if="store.role === 'master'" type="button" class="gv-t wiki" :class="{ on: to === 'wiki' }" @click="to = 'wiki'">
            <span class="gv-ph">📜</span>
            <span class="gv-n"><b>В вики «Предметы»</b><small>без хозяина — потом можно выдать кому угодно</small></span>
          </button>
        </div>
        <footer>
          <small>{{ to === 'wiki' ? 'Вещь уйдёт из листа в вики.' : 'Вещь сразу переедет в лист получателя, ему придёт уведомление.' }}</small>
          <button type="button" class="gv-btn" @click="$emit('close')">Отмена</button>
          <button type="submit" class="gv-btn primary" :disabled="!to || busy">🤝 Передать</button>
        </footer>
      </form>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { api, store, toast } from '../../map/store.js'
import { sheet, sheetImg, flush } from '../sheetState.js'
import { rarityOf } from '../../shared/sheet.js'
import { sfx } from '../../sound/sound.js'

const props = defineProps({ path: { type: String, required: true }, item: { type: Object, default: null } })
const emit = defineEmits(['close', 'done'])
const rar = computed(() => rarityOf(props.item?.Rarity))
const max = computed(() => (props.path.startsWith('Inventory.') ? Math.max(1, Number(props.item?.Quantity) || 1) : 1))
const qty = ref(max.value)
const targets = ref([])
const loading = ref(true)
const q = ref('')
const to = ref('')
const busy = ref(false)
const shown = computed(() => {
  const s = q.value.trim().toLowerCase()
  return targets.value.filter(t => t.id !== sheet.id && (!s || `${t.name} ${t.hero}`.toLowerCase().includes(s)))
})
onMounted(async () => {
  try { targets.value = (await api('GET', '/api/sheets-targets')).sort((a, b) => a.name.localeCompare(b.name, 'ru')) } catch (e) { toast(e.message, 'error') }
  loading.value = false
})
async function send() {
  if (!to.value || busy.value) return
  busy.value = true
  try {
    await flush() // недописанные правки листа — сначала на сервер, иначе номер вещи может съехать
    const n = Math.max(1, Math.min(max.value, Math.round(qty.value) || 1))
    await api('POST', `/api/sheets/${sheet.id}/give`, { path: props.path, to: to.value, qty: n })
    const who = to.value === 'wiki' ? 'в вики «Предметы»' : targets.value.find(t => t.id === to.value)?.name
    sfx('coins', 0.4)
    toast(`«${props.item?.Name || 'Предмет'}» → ${who}`)
    emit('done')
  } catch (e) { toast(e.message, 'error') } finally { busy.value = false }
}
</script>

<style scoped>
.gv-back { position: fixed; inset: 0; z-index: 700; display: grid; place-items: center; padding: 16px; background: rgba(5, 4, 3, .72); backdrop-filter: blur(3px); }
.gv { width: min(440px, 100%); max-height: calc(100vh - 32px); display: grid; grid-template-rows: auto auto auto minmax(0, 1fr) auto; gap: 10px; padding: 16px; border-radius: 16px; background: linear-gradient(180deg, #221b13, #17130e); border: 1px solid #5a4426; box-shadow: 0 30px 80px rgba(0, 0, 0, .7); color: #efe3c8; }
.gv header { display: grid; grid-template-columns: minmax(0, 1fr) auto; }
.gv header small { grid-column: 1; font: 800 11px 'Manrope', sans-serif; letter-spacing: .08em; text-transform: uppercase; color: #a8936c; }
.gv header b { grid-column: 1; font: 700 22px 'Cormorant Garamond', serif; color: #f3dfb2; overflow-wrap: anywhere; }
.gv-x { grid-column: 2; grid-row: 1 / 3; align-self: start; width: 30px; height: 30px; border-radius: 8px; border: 1px solid #4a3a24; background: none; color: #c8b48c; cursor: pointer; }
.gv-qty { display: flex; align-items: center; gap: 8px; font: 700 13px 'Manrope', sans-serif; color: #c8b48c; }
.gv-qty input { width: 80px; }
.gv-qty input, .gv-q { padding: 7px 10px; border-radius: 9px; border: 1px solid rgba(201, 162, 79, .3); background: rgba(0, 0, 0, .3); color: #efe3c8; font: 600 14px 'Manrope', sans-serif; }
.gv-list { display: grid; gap: 5px; align-content: start; overflow-y: auto; min-height: 120px; padding-right: 2px; }
.gv-empty { margin: 8px 0; color: #a8936c; font: 600 13px 'Manrope', sans-serif; }
.gv-t { display: flex; align-items: center; gap: 10px; padding: 6px 8px; border-radius: 11px; border: 1px solid rgba(201, 162, 79, .18); background: rgba(0, 0, 0, .2); color: inherit; cursor: pointer; text-align: left; }
.gv-t:hover { background: rgba(201, 162, 79, .08); }
.gv-t.on { border-color: #c9a24f; background: rgba(201, 162, 79, .16); box-shadow: 0 0 12px rgba(201, 162, 79, .25); }
.gv-t img, .gv-ph { flex: none; width: 36px; height: 36px; border-radius: 50%; object-fit: cover; display: grid; place-items: center; background: rgba(201, 162, 79, .15); font: 800 15px 'Manrope', sans-serif; }
.gv-n { display: grid; min-width: 0; }
.gv-n b { font: 700 14px 'Manrope', sans-serif; }
.gv-n small { font: 600 11.5px 'Manrope', sans-serif; color: #a8936c; }
.gv-t.wiki { border-style: dashed; }
.gv footer { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.gv footer small { flex: 1 1 100%; color: #a8936c; font: 600 12px 'Manrope', sans-serif; }
.gv-btn { padding: 8px 14px; border-radius: 10px; border: 1px solid #4a3a24; background: none; color: #e6d3ad; font: 800 13px 'Manrope', sans-serif; cursor: pointer; }
.gv-btn.primary { margin-left: auto; background: linear-gradient(180deg, #d9b25e, #a8802f); color: #1b140c; border: 0; }
.gv-btn:disabled { opacity: .45; cursor: default; }
</style>
