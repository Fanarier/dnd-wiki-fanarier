<template>
  <!-- история изменений листа (видит мастер): кто, когда, что было → стало; любую правку можно откатить -->
  <Teleport to="body">
    <div class="sh-back" @pointerdown.self="$emit('close')">
      <aside class="sh" :style="{ '--acc': sheet.data?.Accent || '#C9A24F' }" role="dialog" aria-label="История изменений">
        <header>
          <b>🕓 История изменений</b>
          <button type="button" class="sb-x" title="Закрыть" @click="$emit('close')">✕</button>
        </header>
        <div class="sh-tools">
          <input v-model="q" class="sb-input" placeholder="Поле или автор…" />
          <select v-model="who" class="sb-input">
            <option value="">Все</option>
            <option v-for="a in authors" :key="a" :value="a">{{ a }}</option>
          </select>
        </div>
        <div v-if="loading" class="sh-empty">Загружаю…</div>
        <div v-else-if="!shown.length" class="sh-empty">Изменений нет.</div>
        <div class="sh-list">
          <template v-for="(g, gi) in groups" :key="gi">
            <h4>{{ g.day }}</h4>
            <div v-for="e in g.items" :key="e.id" class="sh-e" :class="{ master: e.by.role === 'master', note: !!e.note }">
              <div class="sh-top">
                <b>{{ e.by.name }}</b>
                <small>{{ time(e.at) }}</small>
                <span class="grow" />
                <button v-if="canRevert(e)" type="button" class="sb-btn sh-rev" :disabled="busy === e.id" title="Вернуть как было до этой правки" @click="revert(e)">↶ Откатить</button>
              </div>
              <div class="sh-what">{{ label(e) }}</div>
              <div v-if="e.p === '#owner'" class="sh-diff"><span class="from">{{ e.from }}</span><span class="arr">→</span><span class="to">{{ e.to }}</span></div>
              <div v-else-if="!e.note || e.note === 'откат'" class="sh-diff">
                <img v-if="isImageFile(e.from)" :src="sheetImg(e.from)" alt="было" class="sh-img from" />
                <span v-else class="from">{{ shortValue(e.from) }}</span>
                <span class="arr">→</span>
                <img v-if="isImageFile(e.to)" :src="sheetImg(e.to)" alt="стало" class="sh-img" />
                <span v-else class="to">{{ shortValue(e.to) }}</span>
                <em v-if="e.note">({{ e.note }})</em>
              </div>
              <div v-else class="sh-diff"><em>{{ e.note }}</em></div>
            </div>
          </template>
        </div>
      </aside>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { sheet, loadHistory, revertEntry, remoteTick, sheetImg } from './sheetState.js'
import { pathLabel, shortValue, isImageFile } from '../shared/sheet.js'
import { toast } from '../map/store.js'

defineEmits(['close'])
const list = ref([]), loading = ref(true), busy = ref(''), q = ref(''), who = ref('')
async function load() {
  try { list.value = await loadHistory(sheet.id) } catch (e) { toast(e.message, 'error') } finally { loading.value = false }
}
onMounted(load)
watch(() => [remoteTick.value, sheet.rev], () => setTimeout(load, 300))
const label = e => (e.p === '' ? 'Весь лист' : e.p.startsWith('#') ? (e.p === '#owner' ? 'Владелец' : 'Корзина') : pathLabel(e.p, sheet.data))
const authors = computed(() => [...new Set(list.value.map(e => e.by.name))])
const shown = computed(() => {
  const s = q.value.trim().toLowerCase()
  return list.value.filter(e => (!who.value || e.by.name === who.value) && (!s || `${label(e)} ${e.by.name}`.toLowerCase().includes(s)))
})
const groups = computed(() => {
  const out = []
  for (const e of shown.value) {
    const day = new Date(e.at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'short' })
    if (out[out.length - 1]?.day !== day) out.push({ day, items: [] })
    out[out.length - 1].items.push(e)
  }
  return out
})
const time = t => new Date(t).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
const canRevert = e => !e.p.startsWith('#') && !(e.p === '' && !e.from) && e.note !== 'лист создан'
async function revert(e) {
  if (!confirm(`Вернуть «${label(e)}» к значению «${shortValue(e.from)}»?`)) return
  busy.value = e.id
  try { await revertEntry(sheet.id, e.id); toast('Откатил'); await load() } catch (err) { toast(err.message, 'error') } finally { busy.value = '' }
}
</script>

<style scoped>
.sh-back { position: fixed; inset: 0; z-index: 640; background: rgba(5, 4, 3, .5); animation: sh-fade .2s; }
.sh { position: absolute; right: 0; top: 0; bottom: 0; width: min(440px, 100vw); display: flex; flex-direction: column; gap: 10px; padding: 14px; box-sizing: border-box; background: linear-gradient(180deg, #221b13, #15110c); border-left: 1px solid #8a6630; box-shadow: -20px 0 50px rgba(0, 0, 0, .6); color: #efe3c8; font-family: 'Manrope', sans-serif; animation: sh-in .3s cubic-bezier(.2, .9, .3, 1); --ink: #efe3c8; --muted: #a8936c; --line: color-mix(in srgb, var(--acc) 22%, transparent); }
.sh header { display: flex; align-items: center; }
.sh header b { flex: 1; font: 700 21px 'Cormorant Garamond', serif; color: #f3dc9e; }
.sh-tools { display: grid; grid-template-columns: minmax(0, 1fr) 130px; gap: 6px; }
.sh-tools select { color-scheme: dark; }
.sh-list { flex: 1; overflow-y: auto; overflow-x: hidden; display: grid; grid-template-columns: minmax(0, 1fr); gap: 6px; align-content: start; padding-right: 4px; }
.sh-list h4 { margin: 8px 0 2px; font: 800 11px 'Manrope', sans-serif; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }
.sh-e { min-width: 0; display: grid; gap: 3px; padding: 8px 10px; border-radius: 10px; background: rgba(0, 0, 0, .25); border-left: 3px solid #7cc4ff; }
.sh-e.master { border-left-color: #e7c56f; }
.sh-e.note { opacity: .85; }
.sh-top { display: flex; align-items: center; gap: 8px; }
.sh-top b { font-size: 13px; }
.sh-top small { color: var(--muted); font-size: 11.5px; }
.grow { flex: 1; }
.sh-rev { padding: 3px 9px; font-size: 11.5px; }
.sh-what { font: 700 12.5px 'Manrope', sans-serif; color: color-mix(in srgb, var(--acc) 60%, #fff3d6); }
.sh-diff { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; font-size: 12.5px; min-width: 0; overflow-wrap: anywhere; }
.sh-diff span { min-width: 0; }
.sh-img { width: 44px; height: 44px; object-fit: cover; border-radius: 8px; border: 1px solid rgba(231, 197, 111, .35); }
.sh-img.from { opacity: .55; filter: grayscale(.6); }
.sh-diff .from { color: #ff9b8f; text-decoration: line-through; text-decoration-color: rgba(255, 155, 143, .5); }
.sh-diff .to { color: #a8e6a1; }
.sh-diff .arr { color: var(--muted); }
.sh-diff em { color: var(--muted); }
.sh-empty { color: var(--muted); padding: 20px; text-align: center; }
@keyframes sh-fade { from { opacity: 0; } }
@keyframes sh-in { from { transform: translateX(40px); opacity: 0; } }
</style>
