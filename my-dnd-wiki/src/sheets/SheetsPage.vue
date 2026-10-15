<template>
  <!-- листы персонажей: книги на полке. Игрок — свои; мастер — все (по игрокам), сводка отряда и корзина -->
  <div class="sp-root">
    <header class="sp-top">
      <router-link to="/" class="sp-logo" title="Карта мира">
        <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true"><path d="M16 3 L19 16 L16 29 L13 16 Z" fill="currentColor" /><path d="M3 16 L16 13.5 L29 16 L16 18.5 Z" fill="currentColor" opacity=".55" /></svg>
        <span>Анкария</span>
      </router-link>
      <nav class="sp-tabs">
        <router-link to="/" class="sp-tab">Карта</router-link>
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
          <h1>{{ isMaster ? 'Листы персонажей' : 'Мои персонажи' }}</h1>
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
          <div v-else-if="!groups.length" class="sp-empty">
            <template v-if="view === 'trash'">Корзина пуста.</template>
            <template v-else-if="q || ownerFilter">Ничего не нашлось.</template>
            <template v-else>Листов пока нет. Создай новый или загрузи <b>.json</b> из приложения — можно просто перетащить файл сюда.</template>
          </div>

          <section v-for="g in groups" :key="g.key" class="sp-group">
            <h2 v-if="isMaster && view === 'shelf'">{{ g.title }} <small>{{ g.items.length }}</small></h2>
            <div class="sp-shelf">
              <article v-for="(s, i) in g.items" :key="s.id" class="sp-book" :style="{ '--acc': s.accent || '#C9A24F', '--i': i }" @pointermove="tilt($event)" @pointerleave="untilt($event)">
                <button type="button" class="sp-cover" :aria-label="`Открыть лист: ${s.name}`" @click="openBook($event, s)">
                  <span class="sp-glint" />
                  <span class="sp-medal"><img v-if="s.photo" :src="sheetImg(s.photo)" alt="" loading="lazy" /><span v-else>{{ (s.name || '?')[0] }}</span></span>
                  <b class="sp-name">{{ s.name }}</b>
                  <small class="sp-sub">{{ [s.cls, s.level ? s.level + ' ур.' : ''].filter(Boolean).join(' · ') || 'без класса' }}</small>
                  <span class="sp-hp" :title="`Хиты ${s.hp.cur} / ${s.hp.max}`"><i :style="{ width: (s.hp.max ? Math.max(0, Math.min(100, s.hp.cur / s.hp.max * 100)) : 0) + '%' }" /></span>
                  <small v-if="isMaster" class="sp-owner">{{ s.ownerName || 'без игрока' }}</small>
                  <i v-if="s.heroId" class="sp-hero" title="Привязан к карточке героя">⚑</i>
                </button>
                <div class="sp-acts">
                  <template v-if="view === 'trash'">
                    <button type="button" title="Вернуть из корзины" @click="restore(s)">↶</button>
                    <button type="button" class="danger" title="Удалить насовсем" @click="purge(s)">✕</button>
                  </template>
                  <template v-else>
                    <button type="button" title="Выгрузить .json" @click="exportSheet(s.id, s.name).catch(e => toast(e.message, 'error'))">⇩</button>
                    <button v-if="isMaster" type="button" title="Владелец и карточка героя" @click="metaFor = s">👤</button>
                    <button type="button" class="danger" title="В корзину" @click="trashIt(s)">🗑</button>
                  </template>
                </div>
              </article>
            </div>
          </section>
        </template>
      </template>
    </main>

    <SheetMeta v-if="metaFor" :sheet-id="metaFor.id" :summary="metaFor" @close="metaFor = null" />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import UserMenu from '../components/UserMenu.vue'
import PartyBoard from './PartyBoard.vue'
import SheetMeta from './SheetMeta.vue'
import { store, init, toast } from '../map/store.js'
import { sheets, loadSheets, createSheet, importSheet, exportSheet, deleteSheet, restoreSheet, sheetImg } from './sheetState.js'

const router = useRouter()
const isMaster = computed(() => store.role === 'master')
const VIEWS = [{ k: 'shelf', t: 'Полка' }, { k: 'party', t: 'Отряд' }, { k: 'trash', t: 'Корзина' }]
const view = ref('shelf')
const q = ref(''), ownerFilter = ref(''), busy = ref(false), metaFor = ref(null), dropHint = ref(false)

// сменили вход (мастер ↔ игра персонажем, другой аккаунт) — список листов другой
watch(() => `${store.me?.id}|${store.role}`, (n, o) => {
  if (!o || o.startsWith('undefined|') || n === o) return
  sheets.loaded = false; sheets.list = []; if (store.me) loadSheets(); if (store.role !== 'master') view.value = 'shelf' })
const live = computed(() => sheets.list.filter(s => !s.deletedAt))
const trash = computed(() => sheets.list.filter(s => s.deletedAt))
const groups = computed(() => {
  const s = q.value.trim().toLowerCase()
  const src = (view.value === 'trash' ? trash.value : live.value)
    .filter(x => !s || `${x.name} ${x.cls} ${x.sub} ${x.race} ${x.ownerName} ${x.heroName}`.toLowerCase().includes(s))
    .filter(x => !ownerFilter.value || (ownerFilter.value === 'none' ? !x.ownerName : x.ownerId === ownerFilter.value))
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  if (!isMaster.value || view.value === 'trash') return src.length ? [{ key: 'all', title: '', items: src }] : []
  const by = new Map()
  for (const x of src) {
    const k = x.ownerName ? x.ownerId : 'none'
    if (!by.has(k)) by.set(k, { key: k, title: x.ownerName || 'Без игрока — листы мастера', items: [] })
    by.get(k).items.push(x)
  }
  return [...by.values()].sort((a, b) => (a.key === 'none') - (b.key === 'none') || a.title.localeCompare(b.title, 'ru'))
})

// обложка «наклоняется» за мышкой
function tilt(e) {
  if (e.pointerType !== 'mouse') return
  const el = e.currentTarget, r = el.getBoundingClientRect()
  const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5
  el.style.setProperty('--rx', `${(-y * 10).toFixed(2)}deg`)
  el.style.setProperty('--ry', `${(x * 14).toFixed(2)}deg`)
  el.style.setProperty('--gx', `${(x + 0.5) * 100}%`)
}
function untilt(e) { for (const p of ['--rx', '--ry', '--gx']) e.currentTarget.style.removeProperty(p) }
// запомнить, где была обложка: книга прилетит оттуда
function openBook(e, s) {
  const r = e.currentTarget.getBoundingClientRect()
  try { sessionStorage.setItem('sheet-fly', JSON.stringify({ id: s.id, x: r.left, y: r.top, w: r.width, h: r.height })) } catch { /* нет хранилища */ }
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
.sp-main { max-width: 1400px; margin: 0 auto; padding: 20px 16px 60px; }
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
.sp-group { margin-bottom: 26px; }
.sp-group h2 { margin: 0 0 12px; font: 700 22px 'Cormorant Garamond', serif; color: #e6c27a; }
.sp-group h2 small { font: 700 13px 'Manrope', sans-serif; color: #a8936c; }
.sp-shelf { display: grid; grid-template-columns: repeat(auto-fill, minmax(176px, 1fr)); gap: 22px 18px; padding-bottom: 14px; border-bottom: 10px solid #2a1f14; box-shadow: 0 6px 0 #140f09, 0 18px 30px rgba(0, 0, 0, .5); border-radius: 0 0 6px 6px; }

/* книга-обложка */
.sp-book { position: relative; perspective: 900px; animation: sp-in .5s cubic-bezier(.2, .9, .3, 1.15) both; animation-delay: calc(var(--i) * 45ms); }
@keyframes sp-in { from { opacity: 0; transform: translateY(26px) rotateX(-20deg); } }
.sp-cover { position: relative; display: grid; justify-items: center; align-content: start; gap: 8px; width: 100%; aspect-ratio: 3 / 4.2; padding: 18px 12px 12px 20px; box-sizing: border-box; overflow: hidden; border-radius: 4px 12px 12px 4px; border: 1px solid color-mix(in srgb, var(--acc) 50%, #000); cursor: pointer; color: #fff3d6; text-align: center;
  background: radial-gradient(ellipse at 40% 25%, color-mix(in srgb, var(--acc) 42%, #3a2716), color-mix(in srgb, var(--acc) 16%, #120c07) 78%);
  box-shadow: inset 0 0 0 6px rgba(0, 0, 0, .16), inset 0 0 40px rgba(0, 0, 0, .55), 6px 12px 22px rgba(0, 0, 0, .55);
  transform: rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg)) translateZ(0); transform-style: preserve-3d; transition: transform .25s ease-out, box-shadow .25s; }
.sp-cover::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 12px; background: linear-gradient(90deg, rgba(0, 0, 0, .55), rgba(255, 255, 255, .08), transparent); }
.sp-cover::after { content: ''; position: absolute; inset: 8px 8px 8px 16px; border: 1.5px solid color-mix(in srgb, var(--acc) 60%, #fff3d6); border-radius: 8px; opacity: .55; pointer-events: none; }
.sp-book:hover .sp-cover { box-shadow: inset 0 0 0 6px rgba(0, 0, 0, .16), inset 0 0 40px rgba(0, 0, 0, .55), 10px 22px 34px rgba(0, 0, 0, .6), 0 0 30px color-mix(in srgb, var(--acc) 30%, transparent); }
.sp-book:hover { z-index: 2; }
.sp-glint { position: absolute; inset: 0; background: radial-gradient(circle at var(--gx, -30%) 20%, rgba(255, 245, 220, .22), transparent 45%); pointer-events: none; transition: opacity .3s; }
.sp-medal { position: relative; display: grid; place-items: center; width: 74%; aspect-ratio: 1; border-radius: 50%; overflow: hidden; border: 3px solid color-mix(in srgb, var(--acc) 80%, #fff3d6); box-shadow: 0 0 18px color-mix(in srgb, var(--acc) 45%, transparent), inset 0 0 14px rgba(0, 0, 0, .6); background: #120d08; font: 700 46px 'Cormorant Garamond', serif; color: var(--acc); transform: translateZ(20px); }
.sp-medal img { width: 100%; height: 100%; object-fit: cover; }
.sp-name { position: relative; font: 700 19px/1.1 'Cormorant Garamond', serif; color: color-mix(in srgb, var(--acc) 45%, #fff3d6); text-shadow: 0 2px 0 rgba(0, 0, 0, .6); overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.sp-sub { position: relative; font: 800 10px 'Manrope', sans-serif; letter-spacing: .12em; text-transform: uppercase; color: color-mix(in srgb, var(--acc) 35%, #d9c9a6); }
.sp-hp { position: relative; width: 70%; height: 5px; border-radius: 99px; background: rgba(0, 0, 0, .5); overflow: hidden; margin-top: auto; }
.sp-hp i { position: absolute; left: 0; top: 0; bottom: 0; background: linear-gradient(90deg, #3fae5a, #7ee06a); }
.sp-owner { position: relative; font: 700 11px 'Manrope', sans-serif; color: #d9c9a6; opacity: .8; }
.sp-hero { position: absolute; right: 12px; top: 10px; font-style: normal; color: var(--acc); }
.sp-acts { position: absolute; right: 6px; bottom: -14px; display: flex; gap: 4px; opacity: 0; transform: translateY(-4px); transition: opacity .2s, transform .2s; z-index: 3; }
.sp-book:hover .sp-acts, .sp-book:focus-within .sp-acts { opacity: 1; transform: none; }
.sp-acts button { width: 30px; height: 30px; border-radius: 9px; border: 1px solid rgba(231, 197, 111, .35); background: #17130e; color: #f3d99a; cursor: pointer; box-shadow: 0 4px 10px rgba(0, 0, 0, .5); }
.sp-acts .danger:hover { color: #ff9b8f; border-color: rgba(255, 122, 107, .5); }
@media (hover: none) { .sp-acts { opacity: 1; transform: none; } }
@media (max-width: 600px) {
  .sp-top { gap: 8px; padding: 8px 10px; }
  .sp-logo span { display: none; }
  .sp-tab { padding: 6px 10px; }
  .sp-head h1 { font-size: 26px; }
  .sp-shelf { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px 12px; }
}
@media (prefers-reduced-motion: reduce) { .sp-book { animation: none; } .sp-cover { transition: none; transform: none; } }
</style>
