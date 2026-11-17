<template>
  <!-- листы персонажей: книги на полке. Игрок — свои; мастер — все (по игрокам), сводка отряда и корзина -->
  <div class="sp-root">
    <header class="sp-top">
      <router-link to="/" class="sp-logo" title="Карта мира">
        <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true"><path d="M16 3 L19 16 L16 29 L13 16 Z" fill="currentColor" /><path d="M3 16 L16 13.5 L29 16 L16 18.5 Z" fill="currentColor" opacity=".55" /></svg>
        <span>Анкария</span>
      </router-link>
      <nav v-tabslide class="sp-tabs">
        <router-link to="/" class="sp-tab">Карта</router-link>
        <router-link to="/activity" class="sp-tab">Активность</router-link>
        <router-link to="/wiki" class="sp-tab">Вики</router-link>
        <router-link to="/sheets" class="sp-tab active">Листы</router-link>
      </nav>
      <span class="grow" />
      <UserMenu />
    </header>

    <main class="sp-main">
      <div v-if="!store.me" class="sp-empty big">Листы персонажей видны после входа.</div>
      <template v-else>
        <div class="sp-head">
          <h1>Листы персонажей</h1>
          <div v-if="isMaster" class="sp-views">
            <button v-for="v in VIEWS" :key="v.k" type="button" :class="{ on: view === v.k }" @click="view = v.k">{{ v.t }}<small v-if="v.k === 'trash' && trash.length"> {{ trash.length }}</small></button>
          </div>
        </div>

        <PartyBoard v-if="view === 'party'" />

        <template v-else>
          <div class="sp-tools">
            <input v-model="q" class="sp-input" placeholder="🔎 Имя, класс, раса, игрок…" />
            <select v-if="isMaster && view === 'shelf'" v-model="ownerFilter" class="sp-input">
              <option value="">Все игроки</option>
              <option value="none">Без игрока</option>
              <option v-for="o in sheets.owners" :key="o.id" :value="o.id">{{ o.name }}</option>
            </select>
            <span class="grow" />
            <template v-if="view === 'shelf'">
              <button type="button" class="sp-btn" :disabled="busy" @click="create">＋ Новый лист</button>
              <button type="button" class="sp-btn primary" :disabled="busy" title="Файл .json из приложения CharacterApp (можно несколько)" @click="pickFiles">⇪ Загрузить .json</button>
            </template>
          </div>
          <p v-if="dropHint" class="sp-drop-hint">Отпусти файлы — загружу листы</p>

          <div v-if="!sheets.loaded" class="sp-empty"><span class="sp-spin" /> Снимаю книги с полки…</div>
          <div v-else-if="view === 'trash' && !groups.length" class="sp-empty">Корзина пуста.</div>
          <p v-if="sheets.loaded && view === 'shelf' && !live.length" class="sp-note">Твоих книг на стеллаже пока нет. Создай новый лист или загрузи <b>.json</b> из приложения — файл можно просто перетащить сюда.</p>
          <p v-else-if="sheets.loaded && hasFilter && !found" class="sp-note">Ничего не нашлось — подходящих книг на стеллаже нет.</p>

          <BookCase v-if="sheets.loaded && (view === 'shelf' || groups.length)" :groups="groups" :title="caseTitle" :match="hasFilter ? matches : null" :mode="view" :is-master="isMaster"
            @open="openBook" @look="lookFor = $event" @export="s => exportSheet(s.id, s.name).catch(e => toast(e.message, 'error'))" @meta="metaFor = $event" @trash="trashIt" @restore="restore" @purge="purge" />
        </template>
      </template>
    </main>

    <SheetMeta v-if="metaFor" :sheet-id="metaFor.id" :summary="metaFor" @close="metaFor = null" />
    <BookLookEditor v-if="lookFor" :sheet="lookFor" @close="lookFor = null" />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import UserMenu from '../components/UserMenu.vue'
import PartyBoard from './PartyBoard.vue'
import SheetMeta from './SheetMeta.vue'
import BookCase from './shelf/BookCase.vue'
import BookLookEditor from './shelf/BookLookEditor.vue'
import { store, init, toast } from '../map/store.js'
import { sheets, loadSheets, createSheet, importSheet, exportSheet, deleteSheet, restoreSheet } from './sheetState.js'

const router = useRouter()
const isMaster = computed(() => store.role === 'master')
const VIEWS = [{ k: 'shelf', t: 'Полка' }, { k: 'party', t: 'Отряд' }, { k: 'trash', t: 'Корзина' }]
const view = ref('shelf')
const q = ref(''), ownerFilter = ref(''), busy = ref(false), metaFor = ref(null), lookFor = ref(null), dropHint = ref(false)

// сменили вход (мастер ↔ игра персонажем, другой аккаунт) — список листов другой
watch(() => `${store.me?.id}|${store.role}`, (n, o) => {
  if (!o || o.startsWith('undefined|') || n === o) return
  sheets.loaded = false; sheets.list = []; sheets.locked = []; if (store.me) loadSheets(); if (store.role !== 'master') view.value = 'shelf' })
const live = computed(() => sheets.list.filter(s => !s.deletedAt))
const trash = computed(() => sheets.list.filter(s => s.deletedAt))
// поиск и выбор игрока не убирают книги с полки, а гасят неподходящие: стеллаж остаётся на месте
const hasFilter = computed(() => !!q.value.trim() || !!ownerFilter.value)
function matches(x) {
  const s = q.value.trim().toLowerCase()
  if (s && !`${x.name} ${x.cls} ${x.sub || ''} ${x.race || ''} ${x.ownerName || x.ownerShort || ''} ${x.heroName || ''}`.toLowerCase().includes(s)) return false
  return !ownerFilter.value || (ownerFilter.value === 'none' ? !x.ownerId : x.ownerId === ownerFilter.value)
}
const caseTitle = computed(() => (view.value === 'trash' ? 'Корзина' : 'Книги героев Анкарии'))
// стеллаж один на всех: свои книги первыми, дальше по игрокам, книги мастера — в конце; чужие стоят запертыми
const groups = computed(() => {
  const me = store.me?.id
  const src = view.value === 'trash' ? trash.value : [...live.value, ...sheets.locked]
  const by = new Map()
  for (const x of src) {
    const k = x.ownerId || 'none'
    if (!by.has(k)) {
      const own = !isMaster.value && k === me
      by.set(k, { key: k, own, title: x.ownerShort || (isMaster.value ? 'Без игрока' : 'Мастер'), hint: x.ownerId ? (own ? 'Твои книги' : `Книги игрока ${x.ownerShort}`) : 'Листы мастера', items: [] })
    }
    by.get(k).items.push({ ...x, mine: !isMaster.value && x.ownerId === me })
  }
  for (const g of by.values()) g.items.sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  return [...by.values()].sort((a, b) => b.own - a.own || (a.key === 'none') - (b.key === 'none') || a.title.localeCompare(b.title, 'ru'))
})
const found = computed(() => groups.value.some(g => g.items.some(matches)))

// запомнить, где стоял корешок: книга прилетит оттуда
function openBook(s, r) {
  try { if (r) sessionStorage.setItem('sheet-fly', JSON.stringify({ id: s.id, x: r.left, y: r.top, w: r.width, h: r.height })) } catch { /* нет хранилища */ }
  router.push(`/sheets/${s.id}`)
}

const ownerForNew = () => (isMaster.value && ownerFilter.value && ownerFilter.value !== 'none' ? ownerFilter.value : null)
async function create() {
  const name = prompt('Имя персонажа', 'Новый персонаж')
  if (name === null) return
  busy.value = true
  try {
    const s = await createSheet(name.trim() || 'Новый персонаж', ownerForNew())
    router.push(`/sheets/${s.id}`)
  } catch (e) { toast(e.message, 'error') } finally { busy.value = false }
}
function pickFiles() {
  const inp = Object.assign(document.createElement('input'), { type: 'file', accept: '.json,application/json', multiple: true })
  inp.onchange = () => importFiles([...inp.files])
  inp.click()
}
async function importFiles(files) {
  files = files.filter(f => /\.json$/i.test(f.name))
  if (!files.length) return
  busy.value = true
  let ok = 0
  for (const f of files) {
    try { await importSheet(f, ownerForNew()); ok++ } catch (e) { toast(e.message, 'error') }
  }
  busy.value = false
  if (ok) toast(ok === 1 ? 'Лист загружен' : `Загружено листов: ${ok}`)
  loadSheets()
}
// перетащили файлы на страницу
const onDragOver = e => { if ([...(e.dataTransfer?.items || [])].some(i => i.kind === 'file')) { e.preventDefault(); dropHint.value = true } }
const onDragLeave = e => { if (!e.relatedTarget) dropHint.value = false }
const onDrop = e => { if (!e.dataTransfer?.files?.length) return; e.preventDefault(); dropHint.value = false; if (view.value === 'shelf') importFiles([...e.dataTransfer.files]) }

async function trashIt(s) {
  if (!confirm(`Убрать лист «${s.name}» в корзину?${isMaster.value ? '' : ' Вернуть его сможет только мастер.'}`)) return
  try { await deleteSheet(s.id); toast('Лист в корзине'); loadSheets() } catch (e) { toast(e.message, 'error') }
}
async function restore(s) { try { await restoreSheet(s.id); toast('Лист вернулся'); loadSheets() } catch (e) { toast(e.message, 'error') } }
async function purge(s) {
  if (!confirm(`Удалить лист «${s.name}» НАВСЕГДА? Вернуть будет нельзя.`)) return
  try { await deleteSheet(s.id); loadSheets() } catch (e) { toast(e.message, 'error') }
}

onMounted(() => {
  init()
  document.title = 'Анкария — листы персонажей'
  loadSheets()
  addEventListener('dragover', onDragOver)
  addEventListener('dragleave', onDragLeave)
  addEventListener('drop', onDrop)
})
onBeforeUnmount(() => {
  removeEventListener('dragover', onDragOver)
  removeEventListener('dragleave', onDragLeave)
  removeEventListener('drop', onDrop)
})
</script>

<style scoped>
.sp-root { min-height: 100vh; background: radial-gradient(ellipse at 50% -10%, #241b11 0%, #0d0b08 55%, #070605 100%); color: #efe3c8; font-family: 'Manrope', sans-serif; }
.sp-top { position: sticky; top: 0; z-index: 20; display: flex; align-items: center; gap: 14px; padding: 10px 16px; border-bottom: 1px solid rgba(231, 197, 111, .14); background: rgba(13, 11, 8, .88); backdrop-filter: blur(6px); }
.sp-logo { display: flex; align-items: center; gap: 8px; color: #e7c56f; text-decoration: none; font: 700 22px 'Cormorant Garamond', serif; }
.sp-tabs { display: flex; gap: 4px; padding: 3px; border-radius: 11px; background: rgba(0, 0, 0, .35); border: 1px solid rgba(231, 197, 111, .16); }
.sp-tab { padding: 6px 14px; border-radius: 8px; color: #a8936c; text-decoration: none; font: 700 13px 'Manrope', sans-serif; }
.sp-tab.active { background: rgba(231, 197, 111, .16); color: #f3d99a; }
.grow { flex: 1; }
.sp-main { max-width: 1500px; margin: 0 auto; padding: 20px 16px 60px; }
.sp-head { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-bottom: 14px; }
.sp-head h1 { margin: 0; flex: 1; font: 700 34px 'Cormorant Garamond', serif; color: #f3dc9e; }
.sp-views { display: flex; padding: 3px; border-radius: 11px; background: rgba(0, 0, 0, .35); border: 1px solid rgba(231, 197, 111, .16); }
.sp-views button { padding: 6px 14px; border: 0; border-radius: 8px; background: none; color: #a8936c; font: 700 13px 'Manrope', sans-serif; cursor: pointer; }
.sp-views button.on { background: rgba(231, 197, 111, .16); color: #f3d99a; }
.sp-views small { color: #ff9b8f; }
.sp-tools { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 18px; }
.sp-input { padding: 8px 12px; border-radius: 10px; border: 1px solid rgba(231, 197, 111, .25); background: rgba(0, 0, 0, .3); color: #efe3c8; font: 600 13.5px 'Manrope', sans-serif; color-scheme: dark; min-width: 0; }
.sp-input:first-child { flex: 1 1 220px; max-width: 360px; }
.sp-btn { padding: 8px 14px; border-radius: 10px; border: 1px solid rgba(231, 197, 111, .4); background: rgba(231, 197, 111, .08); color: #f3d99a; font: 700 13px 'Manrope', sans-serif; cursor: pointer; }
.sp-btn.primary { background: linear-gradient(180deg, #f0cf83, #c99a45); color: #1b140c; border-color: #e6c27a; }
.sp-btn:disabled { opacity: .5; cursor: default; }
.sp-drop-hint { position: fixed; inset: 0; z-index: 30; display: grid; place-items: center; margin: 0; background: rgba(13, 11, 8, .8); border: 3px dashed #e7c56f; font: 700 26px 'Cormorant Garamond', serif; color: #f3dc9e; pointer-events: none; }
.sp-empty { display: flex; gap: 10px; align-items: center; justify-content: center; padding: 50px 20px; color: #a8936c; font: 600 14px 'Manrope', sans-serif; text-align: center; border: 1px dashed rgba(231, 197, 111, .2); border-radius: 16px; }
.sp-empty.big { margin-top: 60px; font-size: 16px; }
.sp-spin { width: 20px; height: 20px; border-radius: 50%; border: 3px solid rgba(231, 197, 111, .2); border-top-color: #e7c56f; animation: sp-spin .9s linear infinite; }
@keyframes sp-spin { to { transform: rotate(360deg); } }
.sp-note { margin: 0 2px 14px; color: #a8936c; font: 600 13.5px/1.5 'Manrope', sans-serif; }
.sp-note b { color: #d9c9a6; }
@media (max-width: 600px) {
  .sp-top { gap: 6px; padding: 10px 8px; }
  .sp-logo span { display: none; }
  .sp-top .grow { display: none; }
  .sp-tabs { flex: 1 1 auto; min-width: 0; overflow-x: auto; scrollbar-width: none; margin-right: auto; max-width: max-content; }
  .sp-tab { padding: 6px 10px; white-space: nowrap; flex: none; }
  .sp-head h1 { font-size: 26px; }
}
</style>
