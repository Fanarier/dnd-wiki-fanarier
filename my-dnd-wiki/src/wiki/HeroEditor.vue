<template>
  <div class="he-modal" @mousedown.self="$emit('close')">
    <form class="he" @submit.prevent="save">
      <i class="rivet a" /><i class="rivet b" /><i class="rivet c" /><i class="rivet d" />
      <header>
        <div>
          <div class="kicker">{{ h.id ? 'Карточка' : 'Новая карточка' }} · {{ HERO_KINDS[h.kind].label }}</div>
          <h3>{{ h.name || 'Без имени' }}</h3>
        </div>
        <button type="button" class="x" aria-label="Закрыть" @click="$emit('close')">×</button>
      </header>

      <div class="body">
        <!-- портрет и основное -->
        <div class="top">
          <!-- арты карточки: первый — обложка, у каждого своя видимая область -->
          <div class="pcol">
            <PortraitFocus v-if="selItem" :key="selItem.id || selItem.tmp" v-model="selItem.pos" :src="srcOf(selItem)" />
            <label v-else class="portrait" title="Загрузить арты">
              <span>＋<br />арты<br /><small>можно сразу несколько</small></span>
              <input type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif" hidden @change="pickArts" />
            </label>
            <div v-if="gal.length" class="gstrip">
              <!-- арты перетаскиваются; первый — обложка -->
              <VueDraggable v-model="gal" :animation="200" ghost-class="he-ghost" class="gstrip-in" @start="dragSel = selItem" @end="sel = Math.max(0, gal.indexOf(dragSel))">
              <button v-for="(g, n) in gal" :key="g.id || g.tmp" type="button" class="gth" :class="{ on: n === sel }" :title="n === 0 ? 'Обложка' : `Арт ${n + 1}`" @click="sel = n">
                <img :src="srcOf(g)" alt="" /><i v-if="n === 0">★</i>
              </button>
              </VueDraggable>
              <label class="gadd" title="Добавить арты">＋<input type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif" hidden @change="pickArts" /></label>
            </div>
            <div v-if="selItem" class="pbtns">
              <button type="button" class="link" :disabled="sel === 0" title="Левее" @click="moveSel(-1)">◀</button>
              <button v-if="sel > 0" type="button" class="link" @click="makeCover">★ сделать обложкой</button>
              <span v-else class="cover-note">★ обложка</span>
              <button type="button" class="link" :disabled="sel === gal.length - 1" title="Правее" @click="moveSel(1)">▶</button>
              <button type="button" class="link no" @click="removeSel">убрать</button>
            </div>
          </div>
          <div class="grid">
            <label v-if="master" class="wide">Тип
              <select v-model="h.kind">
                <option v-for="(k, key) in HERO_KINDS" :key="key" :value="key" :disabled="key === 'sidekick' && sidekickFull">{{ k.label }}{{ key === 'sidekick' && sidekickFull ? ` (уже ${MAX_SIDEKICKS})` : '' }}</option>
              </select>
            </label>
            <label class="wide">Имя<input v-model="h.name" maxlength="60" required /></label>
            <label v-if="h.kind !== 'companion'">Уровень<input v-model.number="h.level" type="number" min="0" max="99" /></label>
            <label>БМ<input v-model="h.bm" maxlength="8" /></label>
            <template v-if="h.kind === 'character'">
              <label>Выносливость<input v-model.number="h.stamina" type="number" min="0" max="999" /></label>
              <label>Макс. выносливость<input v-model.number="h.staminaMax" type="number" min="0" max="999" /></label>
            </template>
            <label v-if="h.kind === 'sidekick' && master">Статус<input v-model="h.status" maxlength="60" list="he-sk-status" /></label>
            <template v-if="h.kind === 'companion' && master">
              <label>Редкость<select v-model="h.rarity"><option v-for="(r, key) in RARITY" :key="key" :value="key">{{ r.label }}</option></select></label>
              <label>Хозяин<select v-model="h.masterId"><option :value="null">—</option><option v-for="c in characters" :key="c.id" :value="c.id">{{ c.name }}</option></select></label>
            </template>
          </div>
        </div>

        <div class="grid three">
          <label>Локация<input v-model="h.location" maxlength="80" list="he-loc" /></label>
          <label>Жильё<input v-model="h.housing" maxlength="80" list="he-home" /></label>
          <label>Группа<input v-model="h.group" maxlength="40" list="he-group" /></label>
        </div>

        <fieldset>
          <legend>Статус</legend>
          <div class="pip-row"><span>Болезнь</span><HexPips :value="h.illness" :max="ILLNESS_MAX" color="#e8473b" :size="20" editable @update="h.illness = $event" /></div>
          <div class="grid two">
            <label>Эффект +<textarea v-model="h.effectPlus" maxlength="300" rows="2" /></label>
            <label>Эффект −<textarea v-model="h.effectMinus" maxlength="300" rows="2" /></label>
          </div>
        </fieldset>

        <template v-if="h.kind === 'character'">
          <fieldset>
            <legend>Расходы</legend>
            <div v-for="(label, key) in EXPENSES" :key="key" class="pip-row">
              <span>{{ label }}</span>
              <HexPips :value="h.expenses[key]" :max="h.expensesMax" :size="20" editable @update="h.expenses[key] = $event" />
            </div>
            <label class="inline">Ячеек<input v-model.number="h.expensesMax" type="number" min="1" max="10" /></label>
          </fieldset>

          <fieldset>
            <legend>Отношения <small>одна ячейка — {{ REL_CELL }} очков</small></legend>
            <div v-for="(r, i) in h.relations" :key="i" class="rel">
              <select :value="r.heroId || ''" @change="setRelHero(r, $event.target.value)">
                <option value="">другое имя…</option>
                <option v-for="o in others" :key="o.id" :value="o.id">{{ o.name }}</option>
              </select>
              <input v-if="!r.heroId" v-model="r.name" maxlength="60" placeholder="Имя" />
              <HexPips :value="r.level" :max="REL_LEVELS" color="#ff86b8" :size="18" editable @update="r.level = $event" />
              <span class="pts">
                <input v-model.number="r.points" type="number" min="0" :max="REL_CELL" @change="carry(r)" />/ {{ REL_CELL }}
              </span>
              <button type="button" class="mini no" title="Убрать" @click="h.relations.splice(i, 1)">✕</button>
            </div>
            <button type="button" class="mini" @click="h.relations.push({ heroId: null, name: '', level: 1, points: 0 })">+ Отношение</button>
          </fieldset>
        </template>

        <fieldset v-if="master && h.kind === 'character'">
          <legend>Игрок</legend>
          <div class="grid two">
            <label>Чей персонаж
              <select v-model="h.ownerId">
                <option :value="null">ничей (ведёт мастер)</option>
                <option v-for="p in players" :key="p.id" :value="p.id">{{ p.character }} — {{ p.linked ? 'персонаж мастера' : p.login }}</option>
              </select>
            </label>
            <label class="chk" :class="{ off: !h.ownerId }"><input v-model="h.canEdit" type="checkbox" :disabled="!h.ownerId" /> Игрок может менять карточку сам</label>
          </div>
        </fieldset>
        <label v-if="master" class="chk"><input v-model="h.hidden" type="checkbox" /> ☾ В тени — игроки не видят карточку (владелец видит)</label>
        <label v-if="master" class="chk"><input v-model="h.holo" type="checkbox" /> ✦ Голо-блеск — радужный отлив за мышкой{{ h.kind === 'companion' && h.rarity === 'unique' ? ' (у уникальных и так есть)' : '' }}</label>
      </div>

      <footer>
        <button v-if="master && h.id" type="button" class="mini no" @click="$emit('delete', h)">Удалить</button>
        <span class="grow" />
        <button type="button" class="ghost" @click="$emit('close')">Отмена</button>
        <button class="brass" :disabled="busy || !h.name.trim()">{{ busy ? 'Сохраняю…' : 'Сохранить' }}</button>
      </footer>

      <datalist id="he-loc"><option v-for="v in locations" :key="v" :value="v" /></datalist>
      <datalist id="he-home"><option v-for="v in homes" :key="v" :value="v" /></datalist>
      <datalist id="he-group"><option v-for="v in groups" :key="v" :value="v" /></datalist>
      <datalist id="he-sk-status"><option value="В группе" /><option value="Свободен" /><option value="Занят" /><option value="Недоступен" /></datalist>
    </form>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import HexPips from './HexPips.vue'
import PortraitFocus from './PortraitFocus.vue'
import { VueDraggable } from 'vue-draggable-plus'
import { store, heroPortraitUrl } from '../map/store.js'
import { HERO_KINDS, RARITY, MAX_SIDEKICKS, ILLNESS_MAX, REL_LEVELS, REL_CELL, EXPENSES } from '../shared/catalog.js'

const props = defineProps({
  hero: { type: Object, required: true },
  master: { type: Boolean, default: false },
  busy: { type: Boolean, default: false }
})
const emit = defineEmits(['close', 'save', 'delete'])

const BLANK = {
  kind: 'character', name: '', level: 1, bm: '+5', staminaMax: 20, stamina: 20, location: '', housing: '', group: '',
  illness: 0, effectPlus: '', effectMinus: '', expenses: { life: 0, housing: 0, business: 0 }, expensesMax: 5, relations: [],
  ownerId: null, canEdit: false, status: '', rarity: 'common', masterId: null, hidden: false, holo: false
}
const h = reactive({ ...JSON.parse(JSON.stringify(BLANK)), ...JSON.parse(JSON.stringify(props.hero)) })
h.expenses = { ...BLANK.expenses, ...h.expenses }

const heroes = computed(() => store.data.heroes || [])
const sidekickFull = computed(() => props.hero.kind !== 'sidekick' && heroes.value.filter(x => x.kind === 'sidekick').length >= MAX_SIDEKICKS)
const characters = computed(() => heroes.value.filter(x => x.kind === 'character'))
const others = computed(() => heroes.value.filter(x => x.id !== h.id))
const players = computed(() => (store.data.players || []).filter(p => p.status === 'active'))
const uniq = list => [...new Set(list.map(v => (v || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru'))
const locations = computed(() => uniq([...heroes.value.map(x => x.location), ...store.data.cities.map(c => c.name)]))
const homes = computed(() => uniq(heroes.value.map(x => x.housing)))
const groups = computed(() => uniq(['Герои', 'Нет', ...heroes.value.map(x => x.group)]))

function setRelHero(r, id) {
  r.heroId = id || null
  if (id) r.name = heroes.value.find(x => x.id === id)?.name || r.name
}
// набрал 200 очков — ячейка заполнилась, остаток переходит в следующую
function carry(r) {
  r.points = Math.max(0, Math.round(r.points || 0))
  while (r.points >= REL_CELL && r.level < REL_LEVELS) {
    r.points -= REL_CELL
    r.level++
  }
  r.points = Math.min(r.points, REL_CELL)
}

/* арты: новые файлы держим до сохранения (загрузит страница после сохранения карточки) */
const DEFPOS = { x: 50, y: 20, zoom: 1 }
const gal = ref((props.hero.gallery || []).map(g => ({ ...g, pos: { ...DEFPOS, ...g.pos } })))
const removed = []
const sel = ref(0)
const selItem = computed(() => gal.value[sel.value] || null)
const dragSel = ref(null) // какой арт был выбран, когда начали тащить — после броска выбор остаётся на нём
const srcOf = g => g.url || heroPortraitUrl(g.thumb || g.file)
function pickArts(e) {
  const files = [...e.target.files].filter(f => f.type.startsWith('image/') && !f.type.includes('svg'))
  e.target.value = ''
  if (!files.length) return
  const first = gal.value.length
  for (const f of files.slice(0, 24 - gal.value.length)) gal.value.push({ tmp: Math.random().toString(36).slice(2), fileObj: f, url: URL.createObjectURL(f), pos: { ...DEFPOS } })
  sel.value = Math.min(first, gal.value.length - 1)
}
function moveSel(d) {
  const a = gal.value, i = sel.value, j = i + d
  if (j < 0 || j >= a.length) return
  ;[a[i], a[j]] = [a[j], a[i]]
  sel.value = j
}
function makeCover() {
  const [g] = gal.value.splice(sel.value, 1)
  gal.value.unshift(g)
  sel.value = 0
}
function removeSel() {
  const [g] = gal.value.splice(sel.value, 1)
  if (g.id) removed.push(g.id)
  if (g.url) URL.revokeObjectURL(g.url)
  sel.value = Math.max(0, Math.min(sel.value, gal.value.length - 1))
}
onBeforeUnmount(() => { for (const g of gal.value) if (g.url) URL.revokeObjectURL(g.url) })

function save() {
  for (const r of h.relations) carry(r)
  if (!h.ownerId) h.canEdit = false
  const { id, gallery, createdAt, onlyYou, order, ...body } = h
  if (!props.master) for (const k of ['kind', 'ownerId', 'canEdit', 'hidden', 'holo', 'masterId', 'rarity', 'status']) delete body[k]
  emit('save', { id, body, gallery: gal.value, removed })
}
</script>

<style scoped>
.he-modal { position: fixed; inset: 0; z-index: 120; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(5, 4, 2, .7); backdrop-filter: blur(3px); animation: fade .2s; }
.he { position: relative; width: min(720px, 100%); max-height: calc(100vh - 32px); display: flex; flex-direction: column; border-radius: 18px; background: linear-gradient(170deg, #241c13, #16110c); border: 1px solid #6e4f22; box-shadow: 0 0 0 3px #1a140e, 0 0 0 4px rgba(201, 162, 79, .35), 0 30px 70px rgba(0, 0, 0, .7); color: #efe3c8; font-family: 'Manrope', sans-serif; animation: rise .3s cubic-bezier(.2, .9, .3, 1.2); }
.rivet { position: absolute; z-index: 2; width: 8px; height: 8px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #ffe9b0, #8a6630 60%, #3b2a12); }
.rivet.a { top: 8px; left: 8px; } .rivet.b { top: 8px; right: 8px; } .rivet.c { bottom: 8px; left: 8px; } .rivet.d { bottom: 8px; right: 8px; }
header { display: flex; justify-content: space-between; align-items: flex-start; padding: 18px 22px 10px; border-bottom: 1px solid rgba(201, 162, 79, .2); }
.kicker { font-size: 11px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: #a8936c; }
h3 { margin: 2px 0 0; font: 700 28px 'Cormorant Garamond', Georgia, serif; color: #f3d99a; }
.x { border: 0; background: none; color: #a8936c; font-size: 28px; line-height: 1; cursor: pointer; }
.body { padding: 14px 22px; overflow-y: auto; display: grid; gap: 12px; }
.top { display: flex; gap: 16px; align-items: flex-start; }
.pcol { width: 276px; flex: none; display: grid; gap: 6px; }
.pbtns { display: flex; gap: 12px; justify-content: center; align-items: center; flex-wrap: wrap; }
.pbtns .link:disabled { opacity: .3; cursor: default; }
.link.no { color: #ff9b8f; }
.cover-note { font-size: 12px; font-weight: 700; color: #e6c27a; }
.gstrip { display: flex; gap: 6px; overflow-x: auto; padding: 2px 0 4px; scrollbar-width: thin; }
.gth { position: relative; flex: none; width: 46px; height: 54px; padding: 0; border-radius: 7px; overflow: hidden; border: 2px solid transparent; background: #120e09; cursor: pointer; opacity: .6; }
.gth img { width: 100%; height: 100%; object-fit: cover; }
.gth.on { opacity: 1; border-color: #e6c27a; }
.gth i { position: absolute; top: 1px; left: 3px; color: #f3d99a; font-size: 11px; font-style: normal; text-shadow: 0 1px 3px #000; }
.gadd { flex: none; width: 46px; height: 54px; display: grid; place-items: center; border-radius: 7px; border: 2px dashed rgba(201, 162, 79, .45); color: #e6c27a; font-size: 20px; cursor: pointer; }
.gadd:hover { border-color: #e6c27a; }
.portrait small { font-weight: 600; font-size: 11px; opacity: .8; }
.portrait { width: 100%; height: 250px; border-radius: 12px; overflow: hidden; cursor: pointer; display: grid; place-items: center; text-align: center; border: 2px dashed rgba(201, 162, 79, .45); background: #120e09; color: #a8936c; font: 700 13px/1.4 'Manrope', sans-serif; }
.portrait img { width: 100%; height: 100%; object-fit: cover; object-position: center 20%; }
.portrait:hover { border-color: #e6c27a; color: #e6c27a; }
.grid { flex: 1; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.grid.three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.grid.two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.wide { grid-column: span 2; }
label { display: grid; gap: 4px; font-size: 12px; font-weight: 700; color: #a8936c; }
input, select, textarea { min-height: 36px; padding: 6px 10px; border-radius: 9px; border: 1px solid #6e4f22; background: #120e09; color: #efe3c8; font: 500 14px 'Manrope', sans-serif; width: 100%; box-sizing: border-box; }
textarea { resize: vertical; }
select option { background: #16110c; }
input:focus, select:focus, textarea:focus { outline: none; border-color: #e6c27a; }
fieldset { margin: 0; padding: 10px 14px 14px; border: 1px solid rgba(201, 162, 79, .25); border-radius: 12px; display: grid; gap: 10px; }
legend { padding: 0 6px; font: 700 18px 'Cormorant Garamond', Georgia, serif; color: #f3d99a; }
legend small { font: 600 11px 'Manrope', sans-serif; color: #a8936c; margin-left: 6px; }
.pip-row { display: flex; align-items: center; gap: 12px; font-size: 13px; }
.pip-row > span { width: 70px; color: #a8936c; font-weight: 700; font-size: 12px; }
.inline { grid-template-columns: auto 80px; align-items: center; justify-content: start; gap: 10px; }
.rel { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 6px 0; border-bottom: 1px dashed rgba(201, 162, 79, .15); }
.rel select { width: 190px; }
.rel > input { width: 160px; }
.pts { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #a8936c; }
.pts input { width: 72px; }
.chk { display: flex; align-items: center; gap: 8px; color: #efe3c8; font-size: 13px; font-weight: 600; }
.chk input { width: 16px; height: 16px; min-height: 0; accent-color: #e6c27a; }
.chk.off { opacity: .5; }
.row-end { display: flex; justify-content: flex-start; margin-top: -6px; }
footer { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 12px 22px 18px; border-top: 1px solid rgba(201, 162, 79, .2); }
.grow { flex: 1; }
.brass { height: 38px; padding: 0 20px; border-radius: 10px; border: 1px solid #6e4f22; cursor: pointer; color: #1e150a; font: 800 14px 'Manrope', sans-serif; background: linear-gradient(180deg, #f2d58f, #c99a48 55%, #a87a33); box-shadow: inset 0 1px 0 rgba(255, 245, 210, .7), 0 3px 0 #5a3e1a; }
.brass:disabled { opacity: .5; cursor: not-allowed; }
.ghost { height: 38px; padding: 0 16px; border-radius: 10px; border: 1px solid rgba(255, 255, 255, .15); background: rgba(255, 255, 255, .05); color: #efe3c8; font: 700 13px 'Manrope', sans-serif; cursor: pointer; }
.mini { justify-self: start; border: 1px solid rgba(255, 255, 255, .15); background: rgba(255, 255, 255, .06); color: #efe3c8; border-radius: 8px; padding: 5px 10px; font: 700 12px 'Manrope', sans-serif; cursor: pointer; }
.mini.no { color: #ff9b8f; }
.link { background: none; border: 0; color: #a8936c; font: 600 12px 'Manrope', sans-serif; cursor: pointer; text-decoration: underline; padding: 0; }
@keyframes fade { from { opacity: 0; } }
@keyframes rise { from { opacity: 0; transform: translateY(24px) scale(.97); } }
@media (max-width: 640px) {
  .body, header, footer { padding-left: 14px; padding-right: 14px; }
  .top { flex-direction: column; align-items: stretch; }
  .pcol { width: 100%; }
  .grid, .grid.three, .grid.two { grid-template-columns: 1fr; width: 100%; }
  .wide { grid-column: auto; }
  .rel select, .rel > input { width: 100%; }
}
.gstrip-in { display: contents; }
.gth { cursor: grab; }
.he-ghost { opacity: .35; outline: 2px dashed #e7c56f; }
</style>
