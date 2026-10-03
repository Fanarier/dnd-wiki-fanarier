<template>
  <div class="ag">
    <div v-if="master" class="drop" :class="{ over: dragOver, busy: uploading }"
         @dragover.prevent="dragOver = true" @dragleave="dragOver = false" @drop.prevent="onDrop">
      <template v-if="uploading">
        <div class="cog" aria-hidden="true">⚙</div>
        <b>Загружаю {{ progress.done }} / {{ progress.total }}…</b>
        <div class="bar"><i :style="{ width: (progress.done / progress.total) * 100 + '%' }" /></div>
      </template>
      <template v-else>
        <b>Перетащи сюда новые арты</b>
        <span>или <label class="pick">выбери файлы<input type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif" hidden @change="onPick" /></label> · сколько угодно за раз, до 40 МБ каждый</span>
      </template>
    </div>

    <div v-if="!arts.length" class="empty">
      <div class="frame">🖼</div>
      {{ master ? 'Стена пуста — выложи первые работы.' : 'Мастер ещё не выложил новые арты. Загляни позже.' }}
    </div>
    <div v-else class="meta">
      <span>{{ arts.length }} {{ plural(arts.length, 'работа', 'работы', 'работ') }} · последняя загрузка {{ fmtDate(lastAt) }}</span>
      <button v-if="master && !uploading" class="clear" @click="clearAll">Очистить всё</button>
    </div>

    <div class="wall">
      <figure v-for="(a, i) in sorted" :key="a.id" class="art" :style="{ animationDelay: Math.min(i, 20) * 50 + 'ms' }" @click="open(i)">
        <img :src="artUrl(a.thumb || a.file)" :width="a.w" :height="a.h" alt="" loading="lazy" />
        <i v-if="a.createdAt > seenAtOpen" class="new">НОВОЕ</i>
        <button v-if="master" class="del" title="Удалить арт" @click.stop="remove(a)">✕</button>
      </figure>
    </div>

    <!-- просмотр на весь экран -->
    <teleport to="body">
      <div v-if="current" class="lb" @click.self="close" @wheel.prevent>
        <img :key="current.id" :src="artUrl(current.file)" alt="" class="lb-img" />
        <button class="lb-x" aria-label="Закрыть" @click="close">×</button>
        <button v-if="sorted.length > 1" class="lb-nav prev" aria-label="Предыдущий" @click="step(-1)">‹</button>
        <button v-if="sorted.length > 1" class="lb-nav next" aria-label="Следующий" @click="step(1)">›</button>
        <div class="lb-bar">
          <span>{{ idx + 1 }} / {{ sorted.length }}<template v-if="current.name"> · {{ current.name }}</template></span>
          <a :href="artUrl(current.file)" :download="downloadName(current)" class="lb-dl">Скачать</a>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { store, isMaster, act, toast, uploadArt, artUrl, artsSeen, markArtsSeen } from '../map/store.js'

const master = isMaster
const arts = computed(() => store.data.arts || [])
const sorted = computed(() => [...arts.value].sort((a, b) => b.createdAt - a.createdAt))
const lastAt = computed(() => Math.max(...arts.value.map(a => a.createdAt)))
const plural = (n, one, few, many) => (n % 10 === 1 && n % 100 !== 11 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? few : many)
const fmtDate = ms => new Date(ms).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })

// ленточка «НОВОЕ» держится, пока страница открыта; отметку «видел» ставим через пару секунд
const seenAtOpen = artsSeen.value
let seenTimer = null
onMounted(() => { seenTimer = setTimeout(markArtsSeen, 2000) })

/* ---------- загрузка (мастер) ---------- */
const dragOver = ref(false)
const uploading = ref(false)
const progress = ref({ done: 0, total: 0 })
const onDrop = e => { dragOver.value = false; upload([...e.dataTransfer.files]) }
const onPick = e => { const files = [...e.target.files]; e.target.value = ''; upload(files) }

async function upload(files) {
  files = files.filter(f => f.type.startsWith('image/') && !f.type.includes('svg'))
  if (!files.length) return toast('Нужны картинки PNG, JPG, WebP или GIF', 'error')
  uploading.value = true
  progress.value = { done: 0, total: files.length }
  let ok = 0
  // по две параллельно — быстрее, но не душит сервер
  const queue = [...files]
  const worker = async () => {
    for (let f = queue.shift(); f; f = queue.shift()) {
      try { await uploadArt(f); ok++ } catch (e) { toast(e.message, 'error') }
      progress.value.done++
    }
  }
  await Promise.all([worker(), worker()])
  uploading.value = false
  if (ok) {
    await act('POST', '/api/arts/announce', { count: ok }).catch(() => {})
    toast(`Выложено: ${ok} — игроки получат уведомление`)
  }
}

const remove = a => act('DELETE', `/api/arts/${a.id}`, undefined, 'Арт удалён').catch(() => {})
function clearAll() {
  if (confirm(`Удалить все ${arts.value.length} артов? Файлы сотрутся с сервера.`)) act('DELETE', '/api/arts', undefined, 'Стена очищена').catch(() => {})
}

/* ---------- просмотр ---------- */
const idx = ref(-1)
const current = computed(() => sorted.value[idx.value] || null)
const open = i => { idx.value = i }
const close = () => { idx.value = -1 }
const step = d => { idx.value = (idx.value + d + sorted.value.length) % sorted.value.length }
const downloadName = a => (a.name || 'anacaria-art') + a.file.slice(a.file.lastIndexOf('.'))
function onKey(e) {
  if (!current.value) return
  if (e.key === 'Escape') close()
  else if (e.key === 'ArrowRight') step(1)
  else if (e.key === 'ArrowLeft') step(-1)
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  clearTimeout(seenTimer)
  markArtsSeen()
})
</script>

<style scoped>
.ag { font-family: 'Manrope', sans-serif; color: #efe3c8; }
.drop { position: relative; display: grid; justify-items: center; gap: 6px; padding: 26px 16px; margin-bottom: 18px; border-radius: 16px; border: 2px dashed rgba(201, 162, 79, .4); background: repeating-linear-gradient(45deg, rgba(201, 162, 79, .04) 0 10px, transparent 10px 20px); text-align: center; transition: border-color .2s, background-color .2s; }
.drop.over { border-color: #e6c27a; background-color: rgba(231, 197, 111, .08); }
.drop b { font: 700 22px 'Cormorant Garamond', Georgia, serif; color: #f3d99a; }
.drop span { font-size: 13px; color: #a8936c; }
.pick { color: #e6c27a; text-decoration: underline; cursor: pointer; }
.cog { font-size: 34px; color: #b8893f; animation: spin 2s linear infinite; }
.bar { width: min(320px, 80%); height: 6px; border-radius: 99px; background: rgba(255, 255, 255, .08); overflow: hidden; }
.bar i { display: block; height: 100%; background: linear-gradient(90deg, #a87a33, #f2d58f); transition: width .3s; }
.clear { flex: none; border: 1px solid rgba(255, 107, 91, .35); background: rgba(255, 107, 91, .08); color: #ff9b8f; border-radius: 8px; padding: 5px 10px; font: 700 12px 'Manrope', sans-serif; cursor: pointer; }
.empty { padding: 50px 20px; text-align: center; color: #a8936c; font-style: italic; border: 1px dashed rgba(255, 255, 255, .12); border-radius: 16px; }
.frame { font-size: 40px; font-style: normal; margin-bottom: 8px; opacity: .6; }
.meta { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin: 0 0 12px; font-size: 12.5px; color: #a8936c; }
.wall { columns: 4 220px; column-gap: 14px; }
.art { position: relative; margin: 0 0 14px; break-inside: avoid; border-radius: 12px; overflow: hidden; cursor: zoom-in; border: 1px solid #4a381c; background: #16110c; box-shadow: 0 0 0 2px #1c160f; animation: deal .6s cubic-bezier(.2, .9, .3, 1.2) both; transition: transform .25s, box-shadow .25s; }
.art:hover { transform: translateY(-3px); box-shadow: 0 0 0 2px #b8893f, 0 14px 30px rgba(0, 0, 0, .6); }
.art img { display: block; width: 100%; height: auto; }
.new { position: absolute; top: 12px; left: -32px; transform: rotate(-40deg); padding: 2px 36px; background: #e0281e; color: #fff; font: 800 10px 'Manrope', sans-serif; font-style: normal; letter-spacing: 1px; box-shadow: 0 2px 6px rgba(0, 0, 0, .5); }
.del { position: absolute; top: 8px; right: 8px; width: 28px; height: 28px; border-radius: 50%; border: 1px solid rgba(255, 107, 91, .5); background: rgba(16, 12, 8, .85); color: #ff9b8f; cursor: pointer; opacity: 0; transition: opacity .2s; }
.art:hover .del, .del:focus-visible { opacity: 1; }
@media (hover: none) { .del { opacity: 1; } }

.lb { position: fixed; inset: 0; z-index: 200; display: grid; place-items: center; background: rgba(6, 4, 2, .93); animation: fade .2s; }
.lb-img { max-width: calc(100vw - 120px); max-height: calc(100vh - 110px); object-fit: contain; border-radius: 6px; box-shadow: 0 20px 60px rgba(0, 0, 0, .8); animation: zoom .3s cubic-bezier(.2, .9, .3, 1.1); }
.lb-x { position: absolute; top: 12px; right: 18px; border: 0; background: none; color: #efe3c8; font-size: 40px; cursor: pointer; }
.lb-nav { position: absolute; top: 50%; transform: translateY(-50%); width: 52px; height: 52px; border-radius: 50%; border: 1px solid rgba(201, 162, 79, .5); background: rgba(20, 15, 10, .7); color: #f3d99a; font-size: 34px; line-height: 1; cursor: pointer; }
.lb-nav:hover { background: rgba(201, 162, 79, .25); }
.prev { left: 16px; } .next { right: 16px; }
.lb-bar { position: absolute; bottom: 14px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 14px; padding: 7px 16px; border-radius: 99px; background: rgba(20, 15, 10, .85); border: 1px solid rgba(201, 162, 79, .35); font-size: 13px; color: #c9b88f; white-space: nowrap; max-width: calc(100vw - 32px); overflow: hidden; text-overflow: ellipsis; }
.lb-dl { color: #f3d99a; font-weight: 800; }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes deal { from { opacity: 0; transform: translateY(40px) scale(.94); } }
@keyframes fade { from { opacity: 0; } }
@keyframes zoom { from { opacity: 0; transform: scale(.92); } }
@media (max-width: 640px) {
  .lb-img { max-width: 100vw; max-height: calc(100vh - 120px); border-radius: 0; }
  .lb-nav { top: auto; bottom: 64px; transform: none; width: 44px; height: 44px; }
}
@media (prefers-reduced-motion: reduce) { .art, .lb-img, .cog { animation: none; } }
</style>
