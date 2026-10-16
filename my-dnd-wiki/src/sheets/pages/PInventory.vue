<template>
  <div class="pi">
    <h2 class="sb-h sb-anim"><SheetIcon name="inv" class="ic" />Инвентарь <small class="pi-n">{{ items.length }}</small></h2>

    <div class="pi-wallet sb-anim" data-find="wallet">
      <span class="pi-wl">👛 Кошелёк</span>
      <div v-for="c in COINS" :key="c.k" class="pi-coin" :class="c.k">
        <i :key="coinFx[c.k]?.key || 0" :class="{ bounce: coinFx[c.k] }" />
        <Fld :path="c.p" type="num" center /><small>{{ c.u }}</small>
        <span v-if="coinFx[c.k]" :key="'d' + coinFx[c.k].key" class="pi-delta" :class="coinFx[c.k].d > 0 ? 'up' : 'down'">{{ coinFx[c.k].d > 0 ? '+' : '−' }}{{ Math.abs(coinFx[c.k].d) }}</span>
      </div>
    </div>

    <!-- при себе и личный склад: предмет перекладывается одной кнопкой -->
    <div class="pi-tabs sb-anim" role="tablist">
      <button type="button" role="tab" :class="{ on: tab === 'carry' }" :aria-selected="tab === 'carry'" @click="tab = 'carry'">🎒 При себе <small>{{ carried.length }}</small></button>
      <button type="button" role="tab" :class="{ on: tab === 'store' }" :aria-selected="tab === 'store'" @click="tab = 'store'">🏛 Склад <small>{{ stored.length }}</small></button>
    </div>

    <div class="sb-tools sb-anim">
      <input v-model="q" class="sb-input pi-q" placeholder="Поиск…" />
      <button type="button" class="sb-chip" :class="{ on: !rar }" @click="rar = ''">Все</button>
      <button v-for="r in RARITIES" :key="r.name" type="button" class="sb-chip" :class="{ on: rar === r.name }" :style="{ color: r.color }" @click="rar = rar === r.name ? '' : r.name">{{ r.name }}</button>
      <button v-if="tab === 'carry'" type="button" class="sb-chip" :class="{ on: onlyEq }" @click="onlyEq = !onlyEq">Надетые</button>
      <span class="grow" />
      <button v-if="!ro" type="button" class="sb-btn primary" @click="add">＋ Предмет</button>
    </div>

    <div v-if="!model.length" class="sb-empty sb-anim">{{ tab === 'store' ? 'На складе пусто. Кнопка 🏛 у предмета отправляет его сюда.' : 'Сумка пуста.' }}</div>
    <div v-else-if="!shown.length" class="sb-empty">Ничего не нашлось.</div>
    <VueDraggable v-model="model" handle=".sb-handle" :animation="200" :disabled="filtered || ro" class="pi-list">
      <article v-for="it in model" v-show="visible(it)" :key="keyOf(it)" class="pi-item sb-anim" :class="{ eq: it.Equipped, moving: moving === it }" :style="rarityOf(it.Rarity) ? { '--rc': rarityOf(it.Rarity).color } : null" :data-find="`Inventory-${idx(it)}`">
        <span v-if="!filtered && !ro" class="sb-handle">⠿</span>
        <button type="button" class="pi-img" title="Открыть предмет" @click="open = idx(it)">
          <img v-if="it.ImageFile" :src="sheetImg(it.ImageFile)" alt="" />
          <span v-else>📦</span>
        </button>
        <div class="pi-main" @click="open = idx(it)">
          <b>{{ it.Name || 'Без названия' }}</b>
          <small>
            <em v-if="it.Rarity" class="pi-rar">{{ it.Rarity }}</em>
            <span v-if="it.Description" class="pi-desc">{{ it.Description }}</span>
          </small>
        </div>
        <div class="pi-qty" title="Количество">
          <button type="button" :disabled="ro || it.Quantity <= 0" @click="set(idx(it), 'Quantity', it.Quantity - 1)">−</button>
          <b><Num :value="it.Quantity" /></b>
          <button type="button" :disabled="ro" @click="set(idx(it), 'Quantity', it.Quantity + 1)">＋</button>
        </div>
        <button v-if="tab === 'carry'" type="button" class="pi-eq" :class="{ on: it.Equipped }" :title="it.Equipped ? 'Надет' : 'Не надет'" @click="set(idx(it), 'Equipped', !it.Equipped)">⚔</button>
        <button v-if="!ro" type="button" class="pi-move" :title="it.Stored ? 'Забрать со склада' : 'Отнести на склад'" @click="move(it)">{{ it.Stored ? '🎒' : '🏛' }}</button>
        <button v-if="!ro" type="button" class="sb-x" title="Удалить" @click="del(idx(it))">✕</button>
      </article>
    </VueDraggable>

    <ItemEditor v-if="open !== null && items[open]" :path="`Inventory.${open}`" kind="inv" title="Предмет" icon="📦" @close="open = null" @remove="del(open, true)" />
  </div>
</template>

<script setup>
import SheetIcon from '../ui/SheetIcon.vue'
import { computed, inject, reactive, ref, watch } from 'vue'
import { sfx } from '../../sound/sound.js'
import { VueDraggable } from 'vue-draggable-plus'
import Fld from '../ui/Fld.vue'
import Num from '../ui/Num.vue'
import ItemEditor from '../ui/ItemEditor.vue'
import { sheet, edit, keyOf, listOps, sheetImg } from '../sheetState.js'
import { RARITIES, rarityOf } from '../../shared/sheet.js'

const ro = inject('sheetReadOnly', ref(false))
const COINS = [{ k: 'gold', p: 'GoldCoins', u: 'зм' }, { k: 'silver', p: 'SilverCoins', u: 'см' }, { k: 'copper', p: 'CopperCoins', u: 'мм' }]
// монеты: когда сумма поменялась (и ввод утих) — подпрыгивают со звоном и показывают разницу
const coinFx = reactive({})
const coinBase = {}
const coinTimer = {}
let coinKey = 0
watch(() => COINS.map(c => sheet.data[c.p]), (n, o) => {
  if (!o) return
  COINS.forEach((c, i) => {
    if (n[i] === o[i]) return
    if (!(c.k in coinBase)) coinBase[c.k] = o[i]
    clearTimeout(coinTimer[c.k])
    coinTimer[c.k] = setTimeout(() => {
      const d = (sheet.data[c.p] || 0) - coinBase[c.k]
      delete coinBase[c.k]
      if (!d) return
      const fx = { d, key: ++coinKey }
      coinFx[c.k] = fx
      sfx('coins', 0.45)
      setTimeout(() => { if (coinFx[c.k] === fx) delete coinFx[c.k] }, 1300)
    }, 400)
  })
})
const items = computed(() => sheet.data.Inventory)
const ops = listOps('Inventory')
const tab = ref('carry')
const carried = computed(() => items.value.filter(it => !it.Stored))
const stored = computed(() => items.value.filter(it => it.Stored))
const idx = it => items.value.indexOf(it)
// перетаскивание внутри вкладки: предметы другой вкладки остаются на своих местах
const model = computed({
  get: () => (tab.value === 'store' ? stored.value : carried.value),
  set: v => {
    const slots = items.value.map((it, i) => (!!it.Stored === (tab.value === 'store') ? i : -1)).filter(i => i >= 0)
    const next = items.value.slice()
    slots.forEach((slot, k) => { next[slot] = v[k] })
    ops.set(next)
  }
})
const q = ref(''), rar = ref(''), onlyEq = ref(false), open = ref(null)
watch(tab, () => { onlyEq.value = false })
const filtered = computed(() => !!q.value.trim() || !!rar.value || onlyEq.value)
const visible = it => {
  const s = q.value.trim().toLowerCase()
  return (!s || `${it.Name} ${it.Description} ${it.Notes}`.toLowerCase().includes(s)) && (!rar.value || rarityOf(it.Rarity)?.name === rar.value) && (!onlyEq.value || it.Equipped)
}
const shown = computed(() => model.value.filter(visible))
const set = (i, k, v) => { if (!ro.value && i >= 0) edit(`Inventory.${i}.${k}`, v) }
// на склад и обратно: на складе предмет не надет
const moving = ref(null)
function move(it) {
  const i = idx(it)
  if (i < 0 || ro.value) return
  moving.value = it
  sfx('coins', 0.15)
  setTimeout(() => {
    moving.value = null
    edit(`Inventory.${i}`, { ...it, Stored: !it.Stored, Equipped: false }, { now: true })
  }, 260)
}
function add() {
  q.value = ''; rar.value = ''; onlyEq.value = false
  ops.add({ Name: 'Новый предмет', Rarity: 'Обычный', Quantity: 1, Description: '', Notes: '', Equipped: false, ImageFile: '', Stored: tab.value === 'store' }, { first: true })
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
.pi-coin { position: relative; display: flex; align-items: center; gap: 4px; flex: 1 1 90px; }
.pi-coin i.bounce { animation: pi-bounce .7s cubic-bezier(.2, 1.6, .4, 1); }
@keyframes pi-bounce { 0% { transform: translateY(0) rotateY(0); } 35% { transform: translateY(-12px) rotateY(180deg); } 70% { transform: translateY(0) rotateY(360deg); } 85% { transform: translateY(-3px); } }
.pi-delta { position: absolute; left: 4px; top: -6px; font: 900 15px 'Manrope', sans-serif; pointer-events: none; text-shadow: 0 1px 0 rgba(0, 0, 0, .7); animation: pi-float 1.3s ease-out forwards; }
.pi-delta.up { color: #7ee06a; }
.pi-delta.down { color: #ff8a7a; }
@keyframes pi-float { from { transform: translateY(0) scale(.7); opacity: 0; } 15% { transform: translateY(-6px) scale(1.15); opacity: 1; } to { transform: translateY(-30px) scale(1); opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .pi-coin i.bounce, .pi-delta { animation: none; } }
.pi-coin i { width: 18px; height: 18px; flex: none; border-radius: 50%; box-shadow: inset -2px -2px 0 rgba(0, 0, 0, .3), 0 0 8px currentColor; }
.pi-coin.gold { color: #ffd166; } .pi-coin.gold i { background: radial-gradient(circle at 35% 35%, #fff2b3, #e2a92b); }
.pi-coin.silver { color: #d6dde6; } .pi-coin.silver i { background: radial-gradient(circle at 35% 35%, #fff, #9aa6b2); }
.pi-coin.copper { color: #e08a52; } .pi-coin.copper i { background: radial-gradient(circle at 35% 35%, #ffc59a, #a85a2a); }
.pi-coin small { font: 800 11px 'Manrope', sans-serif; }
.pi-coin :deep(input) { font-size: 17px; font-weight: 800; color: inherit; }
.pi-q { flex: 1 1 140px; }
.pi-tabs { display: flex; gap: 4px; margin-bottom: 10px; padding: 3px; border-radius: 11px; background: rgba(0, 0, 0, .25); border: 1px solid var(--line); }
.pi-tabs button { flex: 1; padding: 7px 10px; border: 0; border-radius: 8px; background: none; color: var(--muted); font: 800 13px 'Manrope', sans-serif; cursor: pointer; transition: background .2s, color .2s; }
.pi-tabs button small { opacity: .7; }
.pi-tabs button.on { background: color-mix(in srgb, var(--acc) 20%, transparent); color: var(--ink); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--acc) 45%, transparent); }
.pi-move { flex: none; width: 30px; height: 30px; border-radius: 8px; border: 1px solid var(--line); background: none; cursor: pointer; font-size: 14px; transition: transform .2s; }
.pi-move:hover { transform: scale(1.12); border-color: var(--acc); }
/* уезжает на склад (или со склада) */
.pi-item.moving { animation: pi-away .26s ease-in forwards; }
@keyframes pi-away { to { opacity: 0; transform: translateX(40px) scale(.96); } }
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
