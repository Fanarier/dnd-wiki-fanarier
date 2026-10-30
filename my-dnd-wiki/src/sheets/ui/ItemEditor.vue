<template>
  <!-- редактор предмета (слот экипировки или вещь из инвентаря): правки сразу идут в лист -->
  <Teleport to="body">
    <div class="ie-back" :style="vars" @pointerdown.self="$emit('close')">
      <div class="ie" role="dialog" aria-label="Предмет">
        <header>
          <b>{{ title }}</b>
          <button type="button" class="sb-x" title="Закрыть" @click="$emit('close')">✕</button>
        </header>
        <div class="ie-body">
          <div class="ie-img" :style="rar ? { '--rc': rar.color } : null">
            <img v-if="item?.ImageFile" :src="sheetImg(item.ImageFile)" alt="" />
            <span v-else class="ie-ph">{{ icon || '🖼' }}</span>
            <div class="ie-img-acts">
              <button type="button" class="sb-btn" @click="setImg">📷 {{ item?.ImageFile ? 'Сменить' : 'Картинка' }}</button>
              <button v-if="item?.ImageFile" type="button" class="sb-btn danger" @click="edit(`${path}.ImageFile`, '', { now: true })">✕</button>
            </div>
          </div>
          <div class="ie-fields">
            <Fld :path="`${path}.Name`" label="Название" />
            <label class="fld-like">
              <span>Редкость</span>
              <div class="ie-rar">
                <button v-for="r in RARITIES" :key="r.name" type="button" :style="{ '--rc': r.color }" :class="{ on: rar?.name === r.name }" :title="r.note || r.name" :disabled="ro" @click="edit(`${path}.Rarity`, r.name, { now: true })">{{ r.name }}</button>
              </div>
            </label>
            <template v-if="kind === 'equip'">
              <Fld :path="`${path}.Stats`" type="rich" :rows="2" label="Статы" placeholder="Например: 3к12 Физический урон. Модификатор — Ловкость." />
              <Fld :path="`${path}.Effects`" type="rich" :rows="3" label="Эффекты" />
            </template>
            <template v-else>
              <div class="ie-row">
                <Fld :path="`${path}.Quantity`" type="num" label="Количество" />
                <label class="ie-eq"><input type="checkbox" :checked="item?.Equipped" @change="edit(`${path}.Equipped`, $event.target.checked, { now: true })" /> Надет / экипирован</label>
              </div>
              <Fld :path="`${path}.Description`" type="rich" :rows="3" label="Описание" />
              <Fld :path="`${path}.Notes`" type="rich" :rows="2" label="Заметки" />
            </template>
          </div>
        </div>
        <!-- уникальный предмет: карточка из таблицы предметов (типы, характеристики, требования, эффекты) -->
        <ItemCard v-if="ro && cardFilled(item?.Card)" :name="item.Name" :rarity="item.Rarity" :img="sheetImg(item.ImageFile)" :card="item.Card" :icon="icon || '✦'" compact />
        <CardEdit v-else-if="!ro" :model-value="item?.Card ?? null" @update:model-value="v => edit(`${path}.Card`, v, { now: v === null || !item?.Card })" />
        <footer>
          <button v-if="removable" type="button" class="sb-btn danger" @click="$emit('remove')">🗑 {{ kind === 'equip' ? 'Снять и удалить' : 'Удалить' }}</button>
          <span class="grow" />
          <button type="button" class="sb-btn primary" @click="$emit('close')">Готово</button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, inject, onBeforeUnmount, onMounted, ref } from 'vue'
import Fld from './Fld.vue'
import CardEdit from '../../components/items/CardEdit.vue'
import ItemCard from '../../components/items/ItemCard.vue'
import { cardFilled } from '../../shared/items.js'
import { sheet, val, edit, sheetImg, pickImage } from '../sheetState.js'
import { RARITIES, rarityOf } from '../../shared/sheet.js'
import { toast } from '../../map/store.js'

const props = defineProps({ path: { type: String, required: true }, kind: { type: String, default: 'equip' }, title: { type: String, default: 'Предмет' }, icon: { type: String, default: '' }, removable: { type: Boolean, default: true } })
const emit = defineEmits(['close', 'remove'])
const ro = inject('sheetReadOnly', ref(false))
const item = computed(() => val(props.path))
const rar = computed(() => rarityOf(item.value?.Rarity))
const vars = computed(() => ({ '--acc': sheet.data?.Accent || '#C9A24F' }))
async function setImg() {
  try { await pickImage(`${props.path}.ImageFile`, { title: 'Картинка предмета', size: 256 }) } catch (e) { toast(e.message, 'error') }
}
const esc = e => { if (e.key === 'Escape') emit('close') }
onMounted(() => addEventListener('keydown', esc))
onBeforeUnmount(() => removeEventListener('keydown', esc))
</script>

<style scoped>
.ie-back { --ink: #efe3c8; --muted: #a8936c; --line: color-mix(in srgb, var(--acc) 22%, transparent); position: fixed; inset: 0; z-index: 650; display: grid; place-items: center; padding: 16px; background: rgba(5, 4, 3, .72); backdrop-filter: blur(3px); animation: ie-fade .2s; }
.ie { width: min(640px, 100%); max-height: calc(100vh - 32px); overflow-y: auto; display: grid; gap: 12px; padding: 16px; border-radius: 16px; background: linear-gradient(180deg, #221b13, #17130e); border: 1px solid color-mix(in srgb, var(--acc) 45%, #3b2a1a); box-shadow: 0 30px 80px rgba(0, 0, 0, .7); color: var(--ink); animation: ie-in .28s cubic-bezier(.2, 1.2, .4, 1); }
.ie header, .ie footer { display: flex; align-items: center; gap: 8px; }
.ie header b { flex: 1; font: 700 22px 'Cormorant Garamond', serif; color: color-mix(in srgb, var(--acc) 60%, #fff3d6); }
.grow { flex: 1; }
.ie-body { display: grid; grid-template-columns: 170px minmax(0, 1fr); gap: 14px; }
.ie-img { display: grid; gap: 8px; align-content: start; }
.ie-img img, .ie-ph { width: 170px; height: 170px; border-radius: 14px; object-fit: contain; background: radial-gradient(circle, color-mix(in srgb, var(--rc, var(--acc)) 25%, transparent), rgba(0, 0, 0, .4) 70%); border: 2px solid color-mix(in srgb, var(--rc, var(--acc)) 60%, transparent); box-shadow: 0 0 24px color-mix(in srgb, var(--rc, var(--acc)) 30%, transparent); image-rendering: auto; }
.ie-ph { display: grid; place-items: center; font-size: 54px; opacity: .6; }
.ie-img-acts { display: flex; gap: 6px; }
.ie-fields { display: grid; gap: 10px; min-width: 0; }
.fld-like { display: grid; gap: 4px; }
.fld-like > span { font: 700 10.5px 'Manrope', sans-serif; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
.ie-rar { display: flex; flex-wrap: wrap; gap: 5px; }
.ie-rar button { padding: 3px 9px; border-radius: 99px; border: 1px solid color-mix(in srgb, var(--rc) 50%, transparent); background: none; color: var(--rc); font: 700 12px 'Manrope', sans-serif; cursor: pointer; }
.ie-rar button.on { background: color-mix(in srgb, var(--rc) 22%, transparent); box-shadow: 0 0 10px color-mix(in srgb, var(--rc) 40%, transparent); }
.ie-row { display: grid; grid-template-columns: 120px minmax(0, 1fr); gap: 10px; align-items: end; }
.ie-eq { display: flex; align-items: center; gap: 6px; font: 700 13px 'Manrope', sans-serif; color: var(--muted); padding-bottom: 6px; }
@keyframes ie-fade { from { opacity: 0; } }
@keyframes ie-in { from { opacity: 0; transform: translateY(20px) scale(.96); } }
@media (max-width: 560px) {
  .ie-body { grid-template-columns: minmax(0, 1fr); }
  .ie-img { grid-template-columns: 110px minmax(0, 1fr); align-items: end; }
  .ie-img img, .ie-ph { width: 110px; height: 110px; }
  .ie-img-acts { flex-direction: column; align-items: start; }
}
</style>
