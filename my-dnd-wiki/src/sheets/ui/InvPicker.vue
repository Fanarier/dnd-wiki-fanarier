<template>
  <!-- выбор вещи из инвентаря для слота снаряжения: подходящие слоту — первыми; щелчок — вещь надевается -->
  <div class="ip">
    <div class="ip-top">
      <input v-model="q" class="sb-input ip-q" :placeholder="`Найти в инвентаре (${items.length})…`" />
      <button v-if="!all && rest.length" type="button" class="sb-chip" @click="all = true">все вещи</button>
    </div>
    <div v-if="!shown.length" class="ip-empty">{{ items.length ? 'Ничего не нашлось.' : 'Инвентарь пуст.' }}</div>
    <div v-else class="ip-list">
      <button v-for="x in shown" :key="x.i" type="button" class="ip-it" :style="rarityOf(x.it.Rarity) ? { '--rc': rarityOf(x.it.Rarity).color } : null"
              :title="`Надеть в «${slotName}»${occupied ? ' — что там сейчас, уйдёт в инвентарь' : ''}`" @click="emit('pick', x.i)">
        <span class="ip-img"><img v-if="x.it.ImageFile" :src="sheetImg(x.it.ImageFile)" alt="" /><span v-else>📦</span></span>
        <span class="ip-t">
          <b>{{ x.it.Name || 'Без названия' }}<i v-if="x.it.Quantity > 1"> ×{{ x.it.Quantity }}</i></b>
          <small><em v-if="x.it.Rarity">{{ x.it.Rarity }}</em><span v-if="x.fits" class="ip-fit">подходит</span><span v-if="x.it.Stored" class="ip-pl">склад</span><span v-else-if="x.it.Pack" class="ip-pl">вьюк</span></small>
        </span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { sheet, sheetImg } from '../sheetState.js'
import { EQUIP_SLOTS, rarityOf } from '../../shared/sheet.js'
import { fitsSlot } from '../../shared/items.js'

const props = defineProps({ slot: { type: String, required: true }, occupied: Boolean })
const emit = defineEmits(['pick'])
const q = ref('')
const all = ref(false)
const slotName = computed(() => EQUIP_SLOTS.find(s => s.key === props.slot)?.name || '')
const items = computed(() => (sheet.data?.Inventory || []).map((it, i) => ({ it, i, fits: fitsSlot(it, props.slot) })))
const plain = s => String(s || '').toLowerCase().replace(/ё/g, 'е')
// подходящие — первыми; по поиску — все; без поиска — подходящие (или все, если подходящих нет / попросили)
const sorted = computed(() => [...items.value].sort((a, b) => b.fits - a.fits || !!a.it.Stored - !!b.it.Stored))
const rest = computed(() => sorted.value.filter(x => !x.fits))
const shown = computed(() => {
  const t = plain(q.value.trim())
  if (t) return sorted.value.filter(x => plain(`${x.it.Name} ${x.it.Card?.Type1 || ''} ${x.it.Card?.Kind || ''}`).includes(t))
  return all.value || rest.value.length === sorted.value.length ? sorted.value : sorted.value.filter(x => x.fits)
})
</script>

<style scoped>
.ip { display: grid; gap: 6px; min-width: 0; }
.ip-top { display: flex; gap: 6px; align-items: center; }
.ip-q { flex: 1; min-width: 0; }
.ip-empty { padding: 6px 2px; color: var(--muted); font: 600 12.5px 'Manrope', sans-serif; }
.ip-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 1fr)); gap: 6px; max-height: 300px; overflow-y: auto; padding: 2px; }
.ip-it { display: flex; gap: 8px; align-items: center; min-width: 0; padding: 5px 8px; border-radius: 10px; border: 1px solid color-mix(in srgb, var(--rc, var(--acc)) 30%, transparent); background: rgba(0, 0, 0, .25); color: var(--ink); text-align: left; cursor: pointer; transition: border-color .15s, background .15s, transform .15s; }
.ip-it:hover { border-color: color-mix(in srgb, var(--rc, var(--acc)) 70%, transparent); background: color-mix(in srgb, var(--rc, var(--acc)) 12%, rgba(0, 0, 0, .3)); transform: translateY(-1px); }
.ip-img { flex: none; display: grid; place-items: center; width: 34px; height: 34px; font-size: 18px; }
.ip-img img { width: 34px; height: 34px; object-fit: contain; }
.ip-t { display: grid; gap: 1px; min-width: 0; }
.ip-t b { font: 700 13px 'Manrope', sans-serif; color: var(--rc, var(--ink)); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ip-t b i { font-style: normal; color: var(--muted); }
.ip-t small { display: flex; flex-wrap: wrap; gap: 6px; font: 700 10.5px 'Manrope', sans-serif; color: var(--muted); }
.ip-t em { font-style: normal; }
.ip-fit { color: #7fd69a; }
.ip-pl { color: #d9b46a; }
</style>
