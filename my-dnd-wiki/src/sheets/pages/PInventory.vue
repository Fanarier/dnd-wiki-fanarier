<template>
  <div class="pi">
    <h2 class="sb-h sb-anim"><span class="ic">🎒</span>Инвентарь <small class="pi-n">{{ items.length }}</small></h2>

    <div class="pi-wallet sb-anim" data-find="wallet">
      <span class="pi-wl">👛 Кошелёк</span>
      <div class="pi-coin gold"><i /><Fld path="GoldCoins" type="num" center /><small>зм</small></div>
      <div class="pi-coin silver"><i /><Fld path="SilverCoins" type="num" center /><small>см</small></div>
      <div class="pi-coin copper"><i /><Fld path="CopperCoins" type="num" center /><small>мм</small></div>
    </div>

    <div class="sb-tools sb-anim">
      <input v-model="q" class="sb-input pi-q" placeholder="Поиск…" />
      <button type="button" class="sb-chip" :class="{ on: !rar }" @click="rar = ''">Все</button>
      <button v-for="r in RARITIES" :key="r.name" type="button" class="sb-chip" :class="{ on: rar === r.name }" :style="{ color: r.color }" @click="rar = rar === r.name ? '' : r.name">{{ r.name }}</button>
      <button type="button" class="sb-chip" :class="{ on: onlyEq }" @click="onlyEq = !onlyEq">Надетые</button>
      <span class="grow" />
      <button v-if="!ro" type="button" class="sb-btn primary" @click="add">＋ Предмет</button>
    </div>

    <div v-if="!items.length" class="sb-empty sb-anim">Сумка пуста.</div>
    <div v-else-if="!shown.length" class="sb-empty">Ничего не нашлось.</div>
    <VueDraggable v-model="model" handle=".sb-handle" :animation="200" :disabled="filtered || ro" class="pi-list">
      <article v-for="(it, i) in model" v-show="visible(it)" :key="keyOf(it)" class="pi-item sb-anim" :class="{ eq: it.Equipped }" :style="rarityOf(it.Rarity) ? { '--rc': rarityOf(it.Rarity).color } : null" :data-find="`Inventory-${i}`">
        <span v-if="!filtered && !ro" class="sb-handle">⠿</span>
        <button type="button" class="pi-img" title="Открыть предмет" @click="open = i">
          <img v-if="it.ImageFile" :src="sheetImg(it.ImageFile)" alt="" />
          <span v-else>📦</span>
        </button>
        <div class="pi-main" @click="open = i">
          <b>{{ it.Name || 'Без названия' }}</b>
          <small>
            <em v-if="it.Rarity" class="pi-rar">{{ it.Rarity }}</em>
            <span v-if="it.Description" class="pi-desc">{{ it.Description }}</span>
          </small>
        </div>
        <div class="pi-qty" title="Количество">
          <button type="button" :disabled="ro || it.Quantity <= 0" @click="set(i, 'Quantity', it.Quantity - 1)">−</button>
          <b><Num :value="it.Quantity" /></b>
          <button type="button" :disabled="ro" @click="set(i, 'Quantity', it.Quantity + 1)">＋</button>
        </div>
        <button type="button" class="pi-eq" :class="{ on: it.Equipped }" :title="it.Equipped ? 'Надет' : 'Не надет'" @click="set(i, 'Equipped', !it.Equipped)">⚔</button>
        <button v-if="!ro" type="button" class="sb-x" title="Удалить" @click="del(i)">✕</button>
      </article>
    </VueDraggable>

    <ItemEditor v-if="open !== null && items[open]" :path="`Inventory.${open}`" kind="inv" title="Предмет" icon="📦" @close="open = null" @remove="del(open, true)" />
  </div>
</template>

<script setup>
import { computed, inject, ref } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import Fld from '../ui/Fld.vue'
import Num from '../ui/Num.vue'
import ItemEditor from '../ui/ItemEditor.vue'
import { sheet, edit, keyOf, listOps, sheetImg } from '../sheetState.js'
import { RARITIES, rarityOf } from '../../shared/sheet.js'

const ro = inject('sheetReadOnly', ref(false))
const items = computed(() => sheet.data.Inventory)
const ops = listOps('Inventory')
const model = computed({ get: () => items.value, set: v => ops.set(v) })
const q = ref(''), rar = ref(''), onlyEq = ref(false), open = ref(null)
const filtered = computed(() => !!q.value.trim() || !!rar.value || onlyEq.value)
const visible = it => {
  const s = q.value.trim().toLowerCase()
  return (!s || `${it.Name} ${it.Description} ${it.Notes}`.toLowerCase().includes(s)) && (!rar.value || rarityOf(it.Rarity)?.name === rar.value) && (!onlyEq.value || it.Equipped)
}
const shown = computed(() => items.value.filter(visible))
const set = (i, k, v) => { if (!ro.value) edit(`Inventory.${i}.${k}`, v) }
function add() {
  q.value = ''; rar.value = ''; onlyEq.value = false
  ops.add({ Name: 'Новый предмет', Rarity: 'Обычный', Quantity: 1, Description: '', Notes: '', Equipped: false, ImageFile: '' }, { first: true })
  open.value = 0
}
function del(i, fromEditor) {
  if (!confirm(`Удалить «${items.value[i]?.Name || 'предмет'}»?`)) return
  if (fromEditor) open.value = null
  ops.remove(i)
}
</script>

<style scoped>
.pi-n { margin-left: 4px; font: 800 12px 'Manrope', sans-serif; color: var(--muted); }
.pi-wallet { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 10px 12px; margin-bottom: 12px; border-radius: 12px; background: rgba(0, 0, 0, .2); border: 1px solid var(--line); }
.pi-wl { font: 800 12px 'Manrope', sans-serif; color: var(--muted); letter-spacing: .06em; text-transform: uppercase; }
.pi-coin { display: flex; align-items: center; gap: 4px; flex: 1 1 90px; }
.pi-coin i { width: 18px; height: 18px; flex: none; border-radius: 50%; box-shadow: inset -2px -2px 0 rgba(0, 0, 0, .3), 0 0 8px currentColor; }
.pi-coin.gold { color: #ffd166; } .pi-coin.gold i { background: radial-gradient(circle at 35% 35%, #fff2b3, #e2a92b); }
.pi-coin.silver { color: #d6dde6; } .pi-coin.silver i { background: radial-gradient(circle at 35% 35%, #fff, #9aa6b2); }
.pi-coin.copper { color: #e08a52; } .pi-coin.copper i { background: radial-gradient(circle at 35% 35%, #ffc59a, #a85a2a); }
.pi-coin small { font: 800 11px 'Manrope', sans-serif; }
.pi-coin :deep(input) { font-size: 17px; font-weight: 800; color: inherit; }
.pi-q { flex: 1 1 140px; }
.pi-list { display: grid; gap: 6px; }
.pi-item { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 12px; background: rgba(0, 0, 0, .18); border: 1px solid var(--line); border-left: 3px solid var(--rc, var(--line)); transition: background .2s; }
.pi-item:hover { background: color-mix(in srgb, var(--rc, var(--acc)) 7%, rgba(0, 0, 0, .18)); }
.pi-item.eq { box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--acc) 40%, transparent); }
.pi-img { flex: none; display: grid; place-items: center; width: 48px; height: 48px; padding: 0; border-radius: 10px; border: 1px solid color-mix(in srgb, var(--rc, var(--acc)) 40%, transparent); background: radial-gradient(circle, color-mix(in srgb, var(--rc, var(--acc)) 18%, transparent), rgba(0, 0, 0, .3)); cursor: pointer; font-size: 20px; }
.pi-img img { width: 44px; height: 44px; object-fit: contain; }
.pi-main { flex: 1; min-width: 0; display: grid; cursor: pointer; }
.pi-main b { font: 700 15px 'Manrope', sans-serif; color: var(--rc, var(--ink)); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pi-main small { display: flex; gap: 6px; min-width: 0; color: var(--muted); font: 600 12px 'Manrope', sans-serif; }
.pi-rar { font-style: normal; color: var(--rc); white-space: nowrap; }
.pi-desc { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pi-qty { flex: none; display: flex; align-items: center; gap: 2px; }
.pi-qty button { width: 24px; height: 24px; border-radius: 7px; border: 1px solid var(--line); background: none; color: var(--ink); cursor: pointer; font-weight: 800; }
.pi-qty button:disabled { opacity: .35; cursor: default; }
.pi-qty b { min-width: 28px; text-align: center; font: 800 15px 'Manrope', sans-serif; }
.pi-eq { flex: none; width: 30px; height: 30px; border-radius: 8px; border: 1px solid var(--line); background: none; color: var(--muted); cursor: pointer; opacity: .5; transition: all .2s; }
.pi-eq.on { opacity: 1; color: #1b140c; background: var(--acc); border-color: var(--acc); }
@media (max-width: 560px) { .pi-desc { display: none; } }
</style>
