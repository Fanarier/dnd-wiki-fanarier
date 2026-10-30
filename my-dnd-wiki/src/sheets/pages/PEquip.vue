<template>
  <!-- снаряжение: 17 слотов вокруг персонажа (рюкзак и поклажа — снизу); перетащи предмет на другой слот — поменяются местами -->
  <div class="pe">
    <h2 class="sb-h sb-anim"><SheetIcon name="equip" class="ic" />Снаряжение</h2>
    <p class="pe-hint sb-anim">Щёлкни по слоту — посмотреть и править. Перетащи предмет на другой слот — поменяются местами. 🔒 — слот заперт от случайных правок.</p>
    <div class="pe-doll sb-anim">
      <div class="pe-sil" aria-hidden="true">
        <img v-if="d.PhotoFile" :src="sheetImg(d.PhotoFile)" alt="" />
      </div>
      <button v-for="s in EQUIP_SLOTS" :key="s.key" type="button" class="pe-slot" :style="{ gridArea: AREA[s.key], ...(rarOf(s.key) ? { '--rc': rarOf(s.key).color } : {}) }"
              :class="{ filled: !!d[s.key], locked: locked(s.key), sel: sel === s.key, over: over === s.key }" :data-find="s.key"
              :draggable="!!d[s.key] && !locked(s.key) && !ro" @click="sel = s.key"
              @dragstart="dragStart($event, s.key)" @dragover.prevent="over = s.key" @dragleave="over === s.key && (over = '')" @drop.prevent="drop(s.key)" @dragend="over = ''">
        <span class="pe-img">
          <img v-if="d[s.key]?.ImageFile" :src="sheetImg(d[s.key].ImageFile)" alt="" draggable="false" />
          <span v-else class="pe-ph">{{ s.icon }}</span>
        </span>
        <small class="pe-nm">{{ d[s.key]?.Name || s.name }}</small>
        <i v-if="capLabel(s.key)" class="pe-cap" :title="capLabel(s.key).title">{{ capLabel(s.key).short }}</i>
        <i v-if="locked(s.key)" class="pe-lock">🔒</i>
      </button>
    </div>

    <!-- выбранный слот -->
    <section v-if="sel" class="pe-detail sb-card" :style="selRar ? { '--rc': selRar.color } : null">
      <header>
        <span class="pe-dslot">{{ slotOf(sel).icon }} {{ slotOf(sel).name }}</span>
        <span class="grow" />
        <button v-if="!ro" type="button" class="sb-btn" :title="locked(sel) ? 'Отпереть слот' : 'Запереть слот'" @click="edit(`SlotLocks.${sel}`, !locked(sel), { now: true })">
          <SheetIcon :name="locked(sel) ? 'lock' : 'unlock'" :on="locked(sel)" tone="#ffc15e" class="pe-lk" /> {{ locked(sel) ? 'Заперт' : 'Открыт' }}
        </button>
        <button v-if="!ro && !locked(sel) && d[sel]" type="button" class="sb-btn" title="Отдать вещь другому герою (сразу, ему придёт уведомление)" @click="giveOpen = true">🤝 Передать</button>
        <button v-if="!ro && !locked(sel)" type="button" class="sb-btn" @click="editOpen = true">✎ {{ d[sel] ? 'Править' : 'Положить предмет' }}</button>
      </header>
      <template v-if="d[sel]">
        <ItemCard v-if="cardFilled(d[sel].Card)" :name="d[sel].Name" :rarity="d[sel].Rarity" :img="sheetImg(d[sel].ImageFile)" :card="d[sel].Card" :icon="slotOf(sel).icon" />
        <h3 v-else class="pe-name">{{ d[sel].Name || 'Без названия' }} <em v-if="d[sel].Rarity" class="pe-rar">{{ d[sel].Rarity }}</em></h3>
        <p v-if="d[sel].Stats" class="pe-txt"><b>Статы:</b> <DiceText :text="d[sel].Stats" :label="d[sel].Name" /></p>
        <p v-if="d[sel].Effects" class="pe-txt"><b>Эффекты:</b> <DiceText :text="d[sel].Effects" :label="d[sel].Name" /></p>
        <p v-if="capLabel(sel)" class="pe-txt pe-capline">{{ capLabel(sel).title }}</p>
      </template>
      <p v-else class="pe-txt muted">Слот пуст.{{ SLOT_HINT[sel] ? ' ' + SLOT_HINT[sel] : '' }}</p>
    </section>

    <GiveDialog v-if="giveOpen && sel && d[sel]" :path="sel" :item="d[sel]" @close="giveOpen = false" @done="giveOpen = false" />
    <ItemEditor v-if="editOpen && sel" :path="sel" kind="equip" :title="`${slotOf(sel).name}: предмет`" :icon="slotOf(sel).icon" :removable="!!d[sel]" @close="editOpen = false" @remove="clearSlot" />
  </div>
</template>

<script setup>
import { computed, inject, ref } from 'vue'
import DiceText from '../ui/DiceText.vue'
import ItemEditor from '../ui/ItemEditor.vue'
import SheetIcon from '../ui/SheetIcon.vue'
import ItemCard from '../../components/items/ItemCard.vue'
import GiveDialog from '../ui/GiveDialog.vue'
import { capOf, cardFilled, MAX_POCKETS } from '../../shared/items.js'
import { sheet, edit, sheetImg } from '../sheetState.js'
import { EQUIP_SLOTS, rarityOf } from '../../shared/sheet.js'

const ro = inject('sheetReadOnly', ref(false))
const d = computed(() => sheet.data)
const AREA = {
  Ring1Item: 'r1', HeadItem: 'hd', AmuletItem: 'am', Ring2Item: 'r2', BodyItem: 'bd', Ornament1Item: 'o1', HandsItem: 'hn', BeltItem: 'bl',
  Ornament2Item: 'o2', Weapon1Item: 'w1', LegsItem: 'lg', Weapon2Item: 'w2', Artifact1Item: 'a1', ShieldItem: 'sh', Artifact2Item: 'a2',
  BackpackItem: 'bp', PackItem: 'pk'
}
// пояс даёт карманы, рюкзак — ячейки сумки, поклажа — ячейки вьюка: число пишется у вещи («Карманы: 4», «Ячейки: 12»)
const SLOT_HINT = {
  BeltItem: 'Пояс даёт карманы быстрого доступа (до 8): напиши у него «Карманы: 4».',
  BackpackItem: 'Рюкзак даёт ячейки сумки: напиши у него «Ячейки: 10». Без рюкзака — только базовые ячейки.',
  PackItem: 'Поклажа — вьюк на коне или в повозке, свои ячейки («Ячейки: 20»). В бою недоступна.'
}
function capLabel(k) {
  const it = d.value[k]
  if (!it) return null
  if (k === 'BeltItem') { const n = Math.min(MAX_POCKETS, capOf(it, 'pockets')); return { short: `👝 ${n}`, title: n ? `Карманов: ${n}` : 'Карманов нет — напиши у пояса «Карманы: N»' } }
  if (k === 'BackpackItem' || k === 'PackItem') { const n = capOf(it, 'cells'); return { short: `▦ ${n}`, title: n ? `Ячеек: ${n}` : 'Ячеек не указано — напиши «Ячейки: N»' } }
  return null
}
const slotOf = k => EQUIP_SLOTS.find(s => s.key === k)
const locked = k => !!d.value.SlotLocks?.[k]
const rarOf = k => rarityOf(d.value[k]?.Rarity)
const sel = ref('')
const selRar = computed(() => (sel.value ? rarOf(sel.value) : null))
const editOpen = ref(false)
const giveOpen = ref(false)
const over = ref('')
let dragFrom = ''
function dragStart(e, k) { dragFrom = k; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', k) }
function drop(to) {
  over.value = ''
  const from = dragFrom
  dragFrom = ''
  if (!from || from === to || ro.value || locked(to) || locked(from)) return
  const a = d.value[from], b = d.value[to]
  edit(from, b ? JSON.parse(JSON.stringify(b)) : null)
  edit(to, a ? JSON.parse(JSON.stringify(a)) : null, { now: true })
  sel.value = to
}
function clearSlot() {
  if (!confirm(`Убрать «${d.value[sel.value]?.Name || 'предмет'}» из слота? Картинка и описание пропадут (мастер сможет вернуть из истории).`)) return
  edit(sel.value, null, { now: true })
  editOpen.value = false
}
</script>

<style scoped>
.pe-hint { margin: -4px 0 10px; color: var(--muted); font: 600 12px 'Manrope', sans-serif; }
.pe-doll { position: relative; display: grid; gap: 10px; grid-template-columns: repeat(3, minmax(0, 1fr)); grid-template-areas: 'r1 hd am' 'r2 bd o1' 'hn bl o2' 'w1 lg w2' 'a1 sh a2' 'bp . pk'; max-width: 520px; margin: 0 auto; }
.pe-sil { position: absolute; left: 33.3%; right: 33.3%; top: 0; bottom: 0; border-radius: 50% 50% 18px 18px / 30% 30% 18px 18px; background: radial-gradient(ellipse at 50% 30%, color-mix(in srgb, var(--acc) 14%, transparent), transparent 70%); overflow: hidden; opacity: .5; pointer-events: none; }
.pe-sil img { width: 100%; height: 100%; object-fit: cover; opacity: .18; filter: grayscale(.6) blur(1px); mask-image: linear-gradient(transparent, #000 25%, #000 70%, transparent); }
.pe-slot { position: relative; z-index: 1; display: grid; justify-items: center; gap: 4px; padding: 8px 6px 6px; border-radius: 14px; border: 1px dashed color-mix(in srgb, var(--acc) 30%, transparent); background: rgba(0, 0, 0, .25); color: var(--ink); cursor: pointer; transition: transform .2s, border-color .2s, box-shadow .2s, background .2s; }
.pe-slot.filled { border-style: solid; border-color: color-mix(in srgb, var(--rc, var(--acc)) 55%, transparent); background: radial-gradient(circle at 50% 35%, color-mix(in srgb, var(--rc, var(--acc)) 16%, transparent), rgba(0, 0, 0, .3) 70%); }
.pe-slot:hover { transform: translateY(-3px); box-shadow: 0 10px 20px rgba(0, 0, 0, .4), 0 0 18px color-mix(in srgb, var(--rc, var(--acc)) 30%, transparent); }
.pe-slot.sel { box-shadow: 0 0 0 2px var(--rc, var(--acc)), 0 0 24px color-mix(in srgb, var(--rc, var(--acc)) 45%, transparent); }
.pe-slot.over { transform: scale(1.06); border-color: var(--acc); background: color-mix(in srgb, var(--acc) 20%, transparent); }
.pe-slot.locked { opacity: .6; }
.pe-img { display: grid; place-items: center; width: 64px; height: 64px; }
.pe-img img { width: 64px; height: 64px; object-fit: contain; filter: drop-shadow(0 4px 6px rgba(0, 0, 0, .5)); }
.pe-ph { font-size: 28px; opacity: .3; }
.pe-nm { max-width: 100%; font: 700 11.5px 'Manrope', sans-serif; color: var(--muted); text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pe-slot.filled .pe-nm { color: var(--ink); }
.pe-lock { position: absolute; right: 6px; top: 4px; font-size: 12px; font-style: normal; }
.pe-cap { position: absolute; left: 6px; top: 4px; padding: 1px 6px; border-radius: 99px; font: 800 10.5px 'Manrope', sans-serif; font-style: normal; color: var(--ink); background: color-mix(in srgb, var(--acc) 25%, rgba(0, 0, 0, .5)); }
.pe-capline { color: var(--muted); font-weight: 700; }
.pe-detail { margin-top: 14px; display: grid; gap: 6px; border-color: color-mix(in srgb, var(--rc, var(--acc)) 45%, transparent); animation: pe-in .25s ease-out; }
.pe-detail header { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.pe-dslot { font: 800 12px 'Manrope', sans-serif; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
.pe-lk { width: 16px; height: 16px; }
.pe-name { margin: 2px 0; font: 700 21px 'Cormorant Garamond', serif; color: var(--rc, var(--ink)); }
.pe-rar { margin-left: 6px; font: 800 11px 'Manrope', sans-serif; font-style: normal; letter-spacing: .06em; text-transform: uppercase; padding: 2px 8px; border-radius: 99px; border: 1px solid color-mix(in srgb, var(--rc, var(--acc)) 50%, transparent); vertical-align: middle; }
.pe-txt { margin: 0; font: 500 13.5px/1.55 'Manrope', sans-serif; }
.pe-txt b { color: var(--muted); font-weight: 800; }
.muted { color: var(--muted); }
.grow { flex: 1; }
@keyframes pe-in { from { opacity: 0; transform: translateY(8px); } }
@media (max-width: 560px) { .pe-img, .pe-img img { width: 48px; height: 48px; } }
</style>
