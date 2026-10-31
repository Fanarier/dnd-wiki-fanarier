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

    <!-- при себе (сумка — ячейки рюкзака, карманы пояса), вьюк поклажи и личный склад; вещь перекладывается меню ⇄ -->
    <div class="pi-tabs sb-anim" role="tablist">
      <button type="button" role="tab" :class="{ on: tab === 'carry' }" :aria-selected="tab === 'carry'" @click="tab = 'carry'">🎒 При себе <small>{{ st.bag.length + st.worn.length + st.pocket.length }}</small><i v-if="st.bagOver" class="pi-warn">!</i></button>
      <button v-if="st.hasPack || tab === 'pack'" type="button" role="tab" :class="{ on: tab === 'pack' }" :aria-selected="tab === 'pack'" @click="tab = 'pack'">🐎 Вьюк <small>{{ st.pack.length }}</small><i v-if="st.packOver" class="pi-warn">!</i></button>
      <button type="button" role="tab" :class="{ on: tab === 'store' }" :aria-selected="tab === 'store'" @click="tab = 'store'">🏛 Склад <small>{{ st.store.length }}</small></button>
    </div>

    <!-- сколько места: ячейки сумки (база + рюкзак) или вьюка; стопка одинаковых — одна ячейка -->
    <div v-if="tab !== 'store'" class="pi-cap sb-anim" :class="{ over: capOver }" data-find="cells">
      <div class="pi-cap-h">
        <b>{{ tab === 'pack' ? '🐎 Вьюк' : '▦ Сумка' }}</b>
        <span>{{ capUsed }} / {{ capMax }} ячеек</span>
        <em v-if="capOver" class="pi-over">перегруз {{ capOver }}</em>
        <small class="pi-cap-src">{{ capSrc }}</small>
      </div>
      <div class="pi-cells" :title="capSrc">
        <i v-for="n in Math.min(cellsShown, 80)" :key="n" :class="{ full: n <= capUsed, bad: n > capMax }" />
      </div>
    </div>

    <!-- карманы пояса: быстрый доступ в бою; вещь в кармане не занимает ячейку -->
    <div v-if="tab === 'carry'" class="pi-pockets sb-anim" data-find="pockets">
      <div class="pi-cap-h"><b>👝 Карманы</b><small class="pi-cap-src">{{ pocketNote }}</small></div>
      <div v-if="st.pockets" class="pi-pk-row">
        <div v-for="n in st.pockets" :key="n" class="pi-pk" :class="{ full: st.pocketAt[n] != null }" :style="pkRar(n)">
          <template v-if="st.pocketAt[n] != null">
            <button type="button" class="pi-pk-in" :title="`${items[st.pocketAt[n]].Name} — открыть`" @click="open = st.pocketAt[n]">
              <img v-if="items[st.pocketAt[n]].ImageFile" :src="sheetImg(items[st.pocketAt[n]].ImageFile)" alt="" />
              <span v-else>📦</span>
              <small>{{ items[st.pocketAt[n]].Name }}</small>
              <b v-if="items[st.pocketAt[n]].Quantity !== 1" class="pi-pk-q">{{ items[st.pocketAt[n]].Quantity }}</b>
            </button>
            <button v-if="!ro" type="button" class="pi-pk-out" title="Убрать в сумку" @click="moveTo(items[st.pocketAt[n]], 'bag')">↩</button>
          </template>
          <button v-else type="button" class="pi-pk-empty" :disabled="ro || !st.bag.length" :title="ro ? 'Пустой карман' : 'Положить вещь из сумки'" @click.stop="pickPocket = pickPocket === n ? 0 : n">
            <span>{{ n }}</span><small>{{ ro ? 'пусто' : '＋' }}</small>
          </button>
          <div v-if="pickPocket === n" class="pi-menu pk" @pointerdown.stop>
            <small>В карман {{ n }}:</small>
            <button v-for="i in st.bag" :key="i" type="button" @click="moveTo(items[i], 'pocket', n)">{{ items[i].Name || 'Без названия' }}<i v-if="items[i].Quantity !== 1"> ×{{ items[i].Quantity }}</i></button>
          </div>
        </div>
      </div>
    </div>

    <div class="sb-tools sb-anim">
      <input v-model="q" class="sb-input pi-q" placeholder="Поиск…" />
      <button type="button" class="sb-chip" :class="{ on: !rar }" @click="rar = ''">Все</button>
      <button v-for="r in RARITIES" :key="r.name" type="button" class="sb-chip" :class="{ on: rar === r.name }" :style="{ color: r.color }" @click="rar = rar === r.name ? '' : r.name">{{ r.name }}</button>
      <button v-if="tab === 'carry'" type="button" class="sb-chip" :class="{ on: onlyEq }" @click="onlyEq = !onlyEq">Надетые</button>
      <button type="button" class="sb-chip" :class="{ on: onlyUniq }" title="С карточкой уникального предмета" @click="onlyUniq = !onlyUniq">✦ Уникальные</button>
      <span class="grow" />
      <button v-if="!ro" type="button" class="sb-btn primary" @click="add">＋ Предмет</button>
    </div>

    <div v-if="!model.length" class="sb-empty sb-anim">{{ EMPTY[tab] }}</div>
    <div v-else-if="!shown.length" class="sb-empty">Ничего не нашлось.</div>
    <VueDraggable v-model="model" handle=".sb-handle" :animation="200" :disabled="filtered || ro" class="pi-list">
      <article v-for="it in model" v-show="visible(it)" :key="keyOf(it)" class="pi-item sb-anim" :class="{ eq: it.Equipped, moving: moving === it, over: isOver(it), menu: menuFor === it }" :style="rarityOf(it.Rarity) ? { '--rc': rarityOf(it.Rarity).color } : null" :data-find="`Inventory-${idx(it)}`">
        <span v-if="!filtered && !ro" class="sb-handle">⠿</span>
        <button type="button" class="pi-img" :class="{ zoom: it.ImageFile }" :title="it.ImageFile ? 'Посмотреть картинку' : 'Открыть предмет'" @click="it.ImageFile ? (viewImg = it) : (open = idx(it))">
          <img v-if="it.ImageFile" :src="sheetImg(it.ImageFile)" alt="" />
          <span v-else>📦</span>
          <i v-if="cardFilled(it.Card)" class="pi-uniq" title="Уникальный предмет — с карточкой">✦</i>
        </button>
        <div class="pi-main" @click="open = idx(it)">
          <b>{{ it.Name || 'Без названия' }}</b>
          <small>
            <em v-if="it.Rarity" class="pi-rar">{{ it.Rarity }}</em>
            <span v-if="it.Pocket > 0 && !it.Stored && !it.Pack" class="pi-tag bad" title="Карман с этим номером пропал (пояс сменили) — вещь лежит в сумке">👝 нет кармана {{ it.Pocket }}</span>
            <span v-else-if="it.Equipped && tab === 'carry'" class="pi-tag" title="Надетое не занимает ячеек сумки">надето</span>
            <span v-else-if="isOver(it)" class="pi-tag bad" title="Не влезает: нужен рюкзак (или вьюк) побольше, или отнеси лишнее">не влезает</span>
            <span v-if="typeLine(it)" class="pi-desc">{{ typeLine(it) }}</span>
            <span v-else-if="it.Description" class="pi-desc">{{ plain(it.Description) }}</span>
          </small>
        </div>
        <div class="pi-qty" title="Количество">
          <button type="button" :disabled="ro || it.Quantity <= 0" @click="set(idx(it), 'Quantity', it.Quantity - 1)">−</button>
          <b><Num :value="it.Quantity" /></b>
          <button type="button" :disabled="ro" @click="set(idx(it), 'Quantity', it.Quantity + 1)">＋</button>
        </div>
        <button v-if="tab === 'carry'" type="button" class="pi-eq" :class="{ on: it.Equipped }" :disabled="ro" :title="it.Equipped ? 'Надет (не занимает ячейку)' : 'Не надет'" @click="set(idx(it), 'Equipped', !it.Equipped)">⚔</button>
        <button v-if="!ro" type="button" class="pi-move" title="Куда положить, передать герою" @click.stop="menuFor = menuFor === it ? null : it">⇄</button>
        <button v-if="!ro" type="button" class="sb-x" title="Удалить" @click="del(idx(it))">✕</button>
        <div v-if="menuFor === it" class="pi-menu" @pointerdown.stop>
          <button v-if="placeOf(it) !== 'bag' && placeOf(it) !== 'worn'" type="button" @click="moveTo(it, 'bag')">🎒 В сумку</button>
          <template v-if="st.pockets">
            <small>👝 В карман:</small>
            <div class="pi-menu-pk">
              <button v-for="n in st.pockets" :key="n" type="button" :class="{ busy: st.pocketAt[n] != null }" :title="st.pocketAt[n] != null ? `занят: ${items[st.pocketAt[n]].Name} (поменяются местами)` : 'свободен'" @click="moveTo(it, 'pocket', n)">{{ n }}</button>
            </div>
          </template>
          <button v-if="placeOf(it) !== 'pack'" type="button" :title="st.hasPack ? '' : 'Поклажи нет — надень её в «Снаряжении»'" @click="moveTo(it, 'pack')">🐎 Во вьюк</button>
          <button v-if="placeOf(it) !== 'store'" type="button" @click="moveTo(it, 'store')">🏛 На склад</button>
          <button type="button" class="give" @click="give = idx(it); menuFor = null">🤝 Передать герою…</button>
        </div>
      </article>
    </VueDraggable>

    <ItemEditor v-if="open !== null && items[open]" :path="`Inventory.${open}`" kind="inv" title="Предмет" icon="📦" @close="open = null" @remove="del(open, true)" />
    <HeroGalleryViewer :z="2000" v-if="viewImg?.ImageFile" :arts="[{ id: 'img', file: viewImg.ImageFile }]" :name="viewImg.Name" :url="sheetImg" @close="viewImg = null" />
    <GiveDialog v-if="give !== null && items[give]" :path="`Inventory.${give}`" :item="items[give]" @close="give = null" @done="give = null" />
  </div>
</template>

<script setup>
// описания бывают с оформлением — в коротком списке и поиске только текст
const plain = s => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim()
import SheetIcon from '../ui/SheetIcon.vue'
import { computed, inject, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { sfx } from '../../sound/sound.js'
import { VueDraggable } from 'vue-draggable-plus'
import Fld from '../ui/Fld.vue'
import Num from '../ui/Num.vue'
import ItemEditor from '../ui/ItemEditor.vue'
import GiveDialog from '../ui/GiveDialog.vue'
import HeroGalleryViewer from '../../wiki/HeroGalleryViewer.vue'
import { sheet, edit, keyOf, listOps, sheetImg } from '../sheetState.js'
import { RARITIES, rarityOf } from '../../shared/sheet.js'
import { carryState, placeOf, cardFilled, cardText, DEFAULT_BASE_CELLS } from '../../shared/items.js'
import { rulesState } from '../../map/store.js'

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
// раскладка: ячейки сумки (база из вики + рюкзак), карманы пояса, вьюк поклажи
const st = computed(() => carryState(sheet.data, rulesState.settings?.baseCells ?? DEFAULT_BASE_CELLS))
// вкладка вещи: склад, вьюк или «при себе» (сумка, надетое, вещь из пропавшего кармана); в кармане — в ряду карманов, не в списке
const tabOf = it => (it.Stored ? 'store' : it.Pack ? 'pack' : 'carry')
const inList = it => tabOf(it) === tab.value && !(tab.value === 'carry' && it.Pocket > 0 && it.Pocket <= st.value.pockets)
const idx = it => items.value.indexOf(it)
// перетаскивание внутри вкладки: предметы других вкладок и карманов остаются на своих местах
const model = computed({
  get: () => items.value.filter(inList),
  set: v => {
    const slots = items.value.map((it, i) => (inList(it) ? i : -1)).filter(i => i >= 0)
    const next = items.value.slice()
    slots.forEach((slot, k) => { next[slot] = v[k] })
    ops.set(next)
  }
})
const EMPTY = { carry: 'Сумка пуста.', pack: 'Во вьюке пусто. Меню ⇄ у вещи → «Во вьюк».', store: 'На складе пусто. Меню ⇄ у вещи → «На склад».' }
// место: сумка или вьюк
const capMax = computed(() => (tab.value === 'pack' ? st.value.packCells : st.value.cells))
const capUsed = computed(() => (tab.value === 'pack' ? st.value.pack.length : st.value.bag.length))
const capOver = computed(() => Math.max(0, capUsed.value - capMax.value))
const cellsShown = computed(() => Math.max(capMax.value, capUsed.value))
const capSrc = computed(() => {
  const d = sheet.data
  if (tab.value === 'pack') return d.PackItem ? `поклажа «${d.PackItem.Name || 'вьюк'}»${st.value.packCells ? '' : ' — напиши у неё «Ячейки: N» в снаряжении'}` : 'поклажи нет — надень её в «Снаряжении» (слот «Поклажа»)'
  const back = d.BackpackItem ? `рюкзак «${d.BackpackItem.Name || 'рюкзак'}» +${st.value.backCells}${st.value.backCells ? '' : ' (напиши у него «Ячейки: N»)'}` : 'без рюкзака — надень его в «Снаряжении»'
  return `${st.value.baseCells} базовых · ${back} · надетое и карманы ячеек не занимают`
})
const pocketNote = computed(() => {
  const b = sheet.data.BeltItem
  if (!b) return 'нет пояса — карманы даёт пояс (надень его в «Снаряжении»)'
  return st.value.pockets ? `пояс «${b.Name || 'пояс'}» · быстрый доступ в бою, ячеек не занимают` : `у пояса «${b.Name || 'пояс'}» не указаны карманы — напиши у него «Карманы: N» в «Снаряжении»`
})
// не влезает: вещи сумки (вьюка) сверх ячеек — по порядку в списке
const isOver = it => {
  const list = it.Stored ? null : it.Pack ? st.value.pack : st.value.bag
  const k = list ? list.indexOf(idx(it)) : -1
  if (k < 0) return false
  return k >= (it.Pack ? st.value.packCells : st.value.cells)
}
const pkRar = n => { const i = st.value.pocketAt[n]; const r = i != null ? rarityOf(items.value[i].Rarity) : null; return r ? { '--rc': r.color } : null }
const typeLine = it => (cardFilled(it.Card) ? [[it.Card.Type1, it.Card.Type2].filter(Boolean).join(' · '), it.Card.Kind].filter(Boolean).join(' — ') : '')
const q = ref(''), rar = ref(''), onlyEq = ref(false), onlyUniq = ref(false), open = ref(null), give = ref(null), viewImg = ref(null)
watch(tab, () => { onlyEq.value = false; menuFor.value = null })
const filtered = computed(() => !!q.value.trim() || !!rar.value || onlyEq.value || onlyUniq.value)
const visible = it => {
  const s = q.value.trim().toLowerCase()
  return (!s || plain(`${it.Name} ${it.Description} ${it.Notes} ${cardText(it.Card)}`).toLowerCase().includes(s)) && (!rar.value || rarityOf(it.Rarity)?.name === rar.value) &&
    (!onlyEq.value || it.Equipped) && (!onlyUniq.value || cardFilled(it.Card))
}
const shown = computed(() => model.value.filter(visible))
// меню «куда положить»: закрывается щелчком мимо
const menuFor = ref(null)
const pickPocket = ref(0)
const closeMenus = () => { menuFor.value = null; pickPocket.value = 0 }
onMounted(() => addEventListener('pointerdown', closeMenus))
onBeforeUnmount(() => removeEventListener('pointerdown', closeMenus))
const set = (i, k, v) => { if (!ro.value && i >= 0) edit(`Inventory.${i}.${k}`, v) }
// переложить: сумка, карман (занятый — вещи меняются местами), вьюк, склад. Вне сумки вещь не надета
const moving = ref(null)
function moveTo(it, place, n = 0) {
  const i = idx(it)
  if (i < 0 || ro.value) return
  closeMenus()
  const at = { Stored: place === 'store', Pack: place === 'pack', Pocket: place === 'pocket' ? n : 0, Equipped: place === 'bag' ? !!it.Equipped : false }
  if (place === 'pocket') {
    const j = st.value.pocketAt[n]
    if (j === i) return
    // в кармане уже что-то — оно уходит туда, где была наша вещь (или в сумку)
    if (j != null) {
      const back = it.Pocket > 0 && it.Pocket <= st.value.pockets && !it.Stored && !it.Pack ? { Pocket: it.Pocket } : { Pocket: 0, Stored: !!it.Stored, Pack: !!it.Pack }
      edit(`Inventory.${j}`, { ...items.value[j], ...back, Equipped: false })
    }
  }
  const out = tabOf({ ...it, ...at }) !== tab.value || place === 'pocket'
  sfx(place === 'pocket' ? 'cardPlace' : 'coins', 0.15)
  const go = () => edit(`Inventory.${i}`, { ...it, ...at }, { now: true })
  if (!out) return go()
  moving.value = it
  setTimeout(() => { moving.value = null; go() }, 220)
}
function add() {
  q.value = ''; rar.value = ''; onlyEq.value = false
  ops.add({ Name: 'Новый предмет', Rarity: 'Обычный', Quantity: 1, Description: '', Notes: '', Equipped: false, ImageFile: '', Stored: tab.value === 'store', Pack: tab.value === 'pack', Pocket: 0, Card: null }, { first: true })
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
.pi-move { color: var(--ink); font-weight: 800; }
.pi-warn { display: inline-grid; place-items: center; width: 15px; height: 15px; margin-left: 5px; border-radius: 50%; background: #d9534f; color: #fff; font: 900 10px 'Manrope', sans-serif; font-style: normal; vertical-align: 1px; }
/* место: ячейки сумки и вьюка */
.pi-cap, .pi-pockets { display: grid; gap: 7px; margin-bottom: 10px; padding: 9px 11px; border-radius: 12px; background: rgba(0, 0, 0, .2); border: 1px solid var(--line); }
.pi-cap.over { border-color: rgba(217, 83, 79, .6); box-shadow: inset 0 0 18px rgba(217, 83, 79, .12); }
.pi-cap-h { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; font: 700 13px 'Manrope', sans-serif; }
.pi-cap-h b { font: 800 12px 'Manrope', sans-serif; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
.pi-over { font: 800 12px 'Manrope', sans-serif; font-style: normal; color: #ff8a7a; animation: pi-pulse 1.6s ease-in-out infinite; }
@keyframes pi-pulse { 50% { opacity: .55; } }
.pi-cap-src { flex: 1 1 100%; color: var(--muted); font: 600 11.5px 'Manrope', sans-serif; }
.pi-cells { display: flex; flex-wrap: wrap; gap: 3px; }
.pi-cells i { width: 14px; height: 14px; border-radius: 4px; border: 1px solid color-mix(in srgb, var(--acc) 35%, transparent); background: rgba(0, 0, 0, .25); transition: background .3s; }
.pi-cells i.full { background: color-mix(in srgb, var(--acc) 55%, transparent); border-color: color-mix(in srgb, var(--acc) 80%, transparent); }
.pi-cells i.bad { background: rgba(217, 83, 79, .55); border-color: #d9534f; }
/* карманы пояса */
.pi-pk-row { display: grid; grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); gap: 6px; }
.pi-pk { position: relative; min-width: 0; display: flex; border-radius: 11px; border: 1px dashed color-mix(in srgb, var(--acc) 35%, transparent); background: rgba(0, 0, 0, .2); }
.pi-pk.full { border-style: solid; border-color: color-mix(in srgb, var(--rc, var(--acc)) 55%, transparent); background: radial-gradient(circle at 50% 30%, color-mix(in srgb, var(--rc, var(--acc)) 14%, transparent), rgba(0, 0, 0, .25)); }
.pi-pk-in, .pi-pk-empty { flex: 1; min-width: 0; display: grid; justify-items: center; gap: 2px; padding: 6px 4px; border: 0; background: none; color: var(--ink); cursor: pointer; }
.pi-pk-in img { width: 34px; height: 34px; object-fit: contain; }
.pi-pk-in > span { font-size: 22px; line-height: 34px; }
.pi-pk-in small { max-width: 100%; font: 700 11px 'Manrope', sans-serif; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pi-pk-q { position: absolute; left: 5px; top: 3px; font: 900 11px 'Manrope', sans-serif; color: var(--rc, var(--acc)); }
.pi-pk-out { position: absolute; right: 2px; top: 2px; width: 20px; height: 20px; padding: 0; border-radius: 6px; border: 0; background: rgba(0, 0, 0, .45); color: var(--muted); cursor: pointer; font-size: 11px; }
.pi-pk-out:hover { color: var(--ink); }
.pi-pk-empty span { font: 800 16px 'Manrope', sans-serif; color: var(--muted); opacity: .6; }
.pi-pk-empty small { font: 800 13px 'Manrope', sans-serif; color: var(--muted); }
.pi-pk-empty:disabled { cursor: default; }
/* меню «куда положить» */
.pi-item { position: relative; }
.pi-item.menu { z-index: 5; }
.pi-menu { position: absolute; right: 8px; top: calc(100% - 4px); z-index: 30; display: grid; gap: 3px; min-width: 190px; max-height: 300px; overflow-y: auto; padding: 6px; border-radius: 12px; background: #1f1810; border: 1px solid color-mix(in srgb, var(--acc) 45%, #3b2a1a); box-shadow: 0 14px 34px rgba(0, 0, 0, .6); animation: pi-pop .16s ease-out; }
.pi-menu.pk { left: 0; right: auto; top: calc(100% + 4px); }
.pi-menu > button { padding: 6px 9px; border: 0; border-radius: 8px; background: none; color: var(--ink); font: 700 13px 'Manrope', sans-serif; text-align: left; cursor: pointer; }
.pi-menu > button:hover { background: color-mix(in srgb, var(--acc) 18%, transparent); }
.pi-menu > button i { font-style: normal; color: var(--muted); }
.pi-menu > button.give { border-top: 1px solid var(--line); border-radius: 0 0 8px 8px; margin-top: 2px; }
.pi-menu small { padding: 2px 9px 0; color: var(--muted); font: 800 10.5px 'Manrope', sans-serif; letter-spacing: .06em; text-transform: uppercase; }
.pi-menu-pk { display: flex; flex-wrap: wrap; gap: 4px; padding: 0 6px 4px; }
.pi-menu-pk button { width: 28px; height: 28px; border-radius: 8px; border: 1px solid var(--line); background: rgba(0, 0, 0, .25); color: var(--ink); font: 800 12px 'Manrope', sans-serif; cursor: pointer; }
.pi-menu-pk button.busy { border-style: dashed; color: var(--muted); }
.pi-menu-pk button:hover { border-color: var(--acc); }
@keyframes pi-pop { from { opacity: 0; transform: translateY(-4px) scale(.97); } }
/* вещь: метки */
.pi-img { position: relative; }
.pi-uniq { position: absolute; right: -4px; top: -5px; font-size: 12px; font-style: normal; color: var(--rc, var(--acc)); text-shadow: 0 0 6px var(--rc, var(--acc)); }
.pi-tag { flex: none; padding: 0 6px; border-radius: 99px; font: 800 10.5px/16px 'Manrope', sans-serif; color: var(--muted); border: 1px solid var(--line); white-space: nowrap; }
.pi-tag.bad { color: #ff8a7a; border-color: rgba(217, 83, 79, .5); }
.pi-item.over { background: rgba(217, 83, 79, .07); }
/* уезжает на склад (или со склада) */
.pi-item.moving { animation: pi-away .26s ease-in forwards; }
@keyframes pi-away { to { opacity: 0; transform: translateX(40px) scale(.96); } }
.pi-list { display: grid; gap: 6px; }
.pi-item { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 12px; background: rgba(0, 0, 0, .18); border: 1px solid var(--line); border-left: 3px solid var(--rc, var(--line)); transition: background .2s; }
.pi-item:hover { background: color-mix(in srgb, var(--rc, var(--acc)) 7%, rgba(0, 0, 0, .18)); }
.pi-item.eq { box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--acc) 40%, transparent); }
.pi-img { flex: none; display: grid; place-items: center; width: 48px; height: 48px; padding: 0; border-radius: 10px; border: 1px solid color-mix(in srgb, var(--rc, var(--acc)) 40%, transparent); background: radial-gradient(circle, color-mix(in srgb, var(--rc, var(--acc)) 18%, transparent), rgba(0, 0, 0, .3)); cursor: pointer; font-size: 20px; }
.pi-img img { width: 44px; height: 44px; object-fit: contain; }
.pi-img.zoom { cursor: zoom-in; }
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
