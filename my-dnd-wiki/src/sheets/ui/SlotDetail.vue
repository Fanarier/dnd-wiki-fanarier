<template>
  <!-- выбранный слот снаряжения (или модуля кованого): вещь, замок, снять / надеть из инвентаря / передать / править -->
  <section class="pe-detail sb-card" :style="rar ? { '--rc': rar.color } : null">
    <header>
      <span class="pe-dslot">{{ info.icon }} {{ info.name }}</span>
      <span class="grow" />
      <button v-if="!ro" type="button" class="sb-btn" :title="locked ? 'Отпереть слот' : 'Запереть слот'" @click="edit(`SlotLocks.${slot}`, !locked, { now: true })">
        <SheetIcon :name="locked ? 'lock' : 'unlock'" :on="locked" tone="#ffc15e" class="pe-lk" /> {{ locked ? 'Заперт' : 'Открыт' }}
      </button>
      <button v-if="!ro && !locked && it" type="button" class="sb-btn" title="Снять и положить в сумку" @click="unequipToInv(slot)">↩ В инвентарь</button>
      <button v-if="!ro && !locked && it && invCount" type="button" class="sb-btn" :class="{ on: pickOpen }" title="Надеть другую вещь из инвентаря (эта уйдёт в инвентарь)" @click="pickOpen = !pickOpen">⇄ Из инвентаря</button>
      <button v-if="!ro && !locked && it" type="button" class="sb-btn" title="Отдать вещь другому герою (сразу, ему придёт уведомление)" @click="giveOpen = true">🤝 Передать</button>
      <button v-if="!ro && !locked" type="button" class="sb-btn" :title="it ? '' : 'Новая вещь прямо в слот (не из инвентаря)'" @click="editOpen = true">✎ {{ it ? 'Править' : isModule ? 'Новый модуль' : 'Новый предмет' }}</button>
    </header>
    <template v-if="it">
      <!-- и у простой вещи — шапка с большой картинкой (щелчок — на весь экран) -->
      <ItemCard :name="it.Name" :rarity="it.Rarity" :img="sheetImg(it.ImageFile)" :card="cardFilled(it.Card) ? it.Card : null" :icon="info.icon" />
      <p v-if="it.Stats" class="pe-txt"><b>Статы:</b> <DiceText :text="it.Stats" :label="it.Name" /></p>
      <p v-if="it.Effects" class="pe-txt"><b>Эффекты:</b> <DiceText :text="it.Effects" :label="it.Name" /></p>
      <p v-if="cap" class="pe-txt pe-capline">{{ cap.title }}</p>
    </template>
    <p v-else class="pe-txt muted">Слот пуст.{{ hint ? ' ' + hint : '' }}<template v-if="!ro && !locked && invCount"> Выбери вещь из инвентаря — она {{ isModule ? 'установится' : 'наденется' }}:</template></p>
    <!-- быстро надеть из инвентаря: у пустого слота — сразу, у занятого — по кнопке «Из инвентаря» -->
    <InvPicker v-if="!ro && !locked && invCount && (!it || pickOpen)" :slot="slot" :occupied="!!it" @pick="i => { equipFromInv(i, slot); pickOpen = false }" />

    <GiveDialog v-if="giveOpen && it" :path="slot" :item="it" @close="giveOpen = false" @done="giveOpen = false" />
    <ItemEditor v-if="editOpen" :path="slot" kind="equip" :title="`${info.name}: ${isModule ? 'модуль' : 'предмет'}`" :icon="info.icon" :removable="!!it" @close="editOpen = false" @remove="clearSlot" />
  </section>
</template>

<script setup>
import { computed, inject, ref } from 'vue'
import DiceText from './DiceText.vue'
import ItemEditor from './ItemEditor.vue'
import SheetIcon from './SheetIcon.vue'
import GiveDialog from './GiveDialog.vue'
import InvPicker from './InvPicker.vue'
import ItemCard from '../../components/items/ItemCard.vue'
import { equipFromInv, unequipToInv } from '../equipMove.js'
import { cardFilled } from '../../shared/items.js'
import { sheet, edit, sheetImg } from '../sheetState.js'
import { ALL_SLOTS, rarityOf } from '../../shared/sheet.js'

// cap — что даёт вещь (карманы, ячейки), hint — подсказка у пустого слота
const props = defineProps({ slot: { type: String, required: true }, cap: { type: Object, default: null }, hint: { type: String, default: '' } })
const ro = inject('sheetReadOnly', ref(false))
const info = computed(() => ALL_SLOTS.find(s => s.key === props.slot) || { name: props.slot, icon: '?' })
const isModule = computed(() => /^Mod/.test(props.slot))
const it = computed(() => sheet.data[props.slot])
const locked = computed(() => !!sheet.data.SlotLocks?.[props.slot])
const rar = computed(() => rarityOf(it.value?.Rarity))
const invCount = computed(() => sheet.data.Inventory?.length || 0)
const pickOpen = ref(false)
const editOpen = ref(false)
const giveOpen = ref(false)
function clearSlot() {
  if (!confirm(`Убрать «${it.value?.Name || 'предмет'}» из слота? Картинка и описание пропадут (мастер сможет вернуть из истории).`)) return
  edit(props.slot, null, { now: true })
  editOpen.value = false
}
</script>

<style scoped>
.pe-detail { margin-top: 14px; display: grid; gap: 6px; border-color: color-mix(in srgb, var(--rc, var(--acc)) 45%, transparent); animation: pe-in .25s ease-out; }
.pe-detail header { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.pe-dslot { font: 800 12px 'Manrope', sans-serif; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
.pe-lk { width: 16px; height: 16px; }
.pe-txt { margin: 0; font: 500 13.5px/1.55 'Manrope', sans-serif; }
.pe-txt b { color: var(--muted); font-weight: 800; }
.pe-capline { color: var(--muted); font-weight: 700; }
.muted { color: var(--muted); }
.grow { flex: 1; }
@keyframes pe-in { from { opacity: 0; transform: translateY(8px); } }
</style>
