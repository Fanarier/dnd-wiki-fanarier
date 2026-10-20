<template>
  <!-- эффекты: положительные, отрицательные и особые — иконка, название, что делает; их же вешают на персонажей в листах -->
  <div class="fx">
    <header class="fx-head">
      <h1>{{ content.title || 'Эффекты' }}</h1>
      <p>{{ content.description }}</p>
    </header>
    <RuneLoader v-if="!rulesState.loaded" text="Листаю свод правил…" />
    <template v-else>
      <div class="fx-tools">
        <nav class="fx-tabs">
          <button v-for="k in KINDS" :key="k.id" type="button" :class="[k.id, { on: kind === k.id }]" @click="kind = k.id; edit = null">
            {{ k.icon }} {{ k.name }} <small>{{ count(k.id) }}</small>
          </button>
        </nav>
        <input v-model="q" class="fx-q" placeholder="Найти эффект…" />
        <button v-if="canManage" type="button" class="fx-btn" @click="add">＋ Эффект</button>
      </div>

      <div class="fx-grid">
        <template v-for="(e, i) in shown" :key="e.id">
          <article v-if="edit?.id === e.id" class="fx-card editing">
            <div class="fx-erow">
              <button type="button" class="fx-icon pick" :class="edit.kind" title="Сменить иконку" @click="picker = !picker">
                <img v-if="edit.icon" :src="edit.icon" alt="" /><span v-else>?</span>
              </button>
              <input v-model="edit.name" class="fx-in big" placeholder="Название" />
              <select v-model="edit.kind" class="fx-in"><option v-for="k in KINDS" :key="k.id" :value="k.id">{{ k.name }}</option></select>
              <input v-model="edit.tag" class="fx-in" placeholder="Чей (раса, класс…)" />
            </div>
            <div v-if="picker" class="fx-picker">
              <label class="fx-btn">⬆ Своя картинка<input type="file" accept="image/*" hidden @change="upload" /></label>
              <button v-for="u in icons" :key="u" type="button" :class="{ on: edit.icon === u }" @click="edit.icon = u; picker = false"><img :src="u" alt="" loading="lazy" /></button>
            </div>
            <RulesEditor v-model="edit.html" :min-height="80" />
            <div class="fx-acts">
              <label class="fx-chk"><input v-model="edit.hidden" type="checkbox" /> Скрыть от игроков</label>
              <span class="grow" />
              <button v-if="canManage" type="button" class="fx-btn danger" @click="remove(e)">Удалить</button>
              <button type="button" class="fx-btn" @click="edit = null">Отмена</button>
              <button type="button" class="fx-btn primary" :disabled="busy" @click="save">Сохранить</button>
            </div>
          </article>
          <article v-else v-tilt="4" class="fx-card" :class="[e.kind, { hid: e.hidden }]" :style="{ '--i': Math.min(i, 24) }">
            <span class="fx-icon" :class="e.kind"><img v-if="e.icon" :src="e.icon" alt="" loading="lazy" /><span v-else>{{ e.name[0] }}</span></span>
            <div class="fx-body">
              <h3>{{ e.name }}<small v-if="e.tag">{{ e.tag }}</small><em v-if="e.hidden">скрыт</em></h3>
              <RulesHtml class="fx-text" :html="e.html" />
            </div>
            <button v-if="canEdit(e)" type="button" class="fx-ico" title="Править" @click="startEdit(e)">✎</button>
          </article>
        </template>
      </div>
      <p v-if="!shown.length" class="fx-load">{{ q ? 'Ничего не нашлось.' : 'Пока пусто.' }}</p>
    </template>
  </div>
</template>

<script setup>
import RuneLoader from '../../components/fx/RuneLoader.vue'
import { computed, onMounted, ref, watch } from 'vue'
import { store, rulesState, loadRules, api, toast, wikiUser, postBlob } from '../../map/store.js'
import { canEditRule, canManageRule } from '../../shared/wikiPerms.js'
import { EFFECT_KINDS } from '../../shared/rules.js'
import RulesHtml from './RulesHtml.vue'
import RulesEditor from './RulesEditor.vue'

defineProps({ content: { type: Object, default: () => ({}) } })
onMounted(() => loadRules())
watch(() => store.data.rulesRev, () => loadRules())

const KINDS = EFFECT_KINDS
const kind = ref('buff')
const q = ref('')
const norm = s => String(s || '').toLowerCase().replace(/ё/g, 'е')
const all = computed(() => rulesState.effects.slice().sort((a, b) => a.order - b.order))
const count = k => all.value.filter(e => e.kind === k).length
// поиск — по всем трём вкладкам сразу
const shown = computed(() => {
  const t = norm(q.value.trim())
  return all.value.filter(e => (t ? norm(e.name + ' ' + e.tag).includes(t) || norm(e.html.replace(/<[^>]+>/g, ' ')).includes(t) : e.kind === kind.value))
})
const icons = computed(() => [...new Set(all.value.map(e => e.icon).filter(Boolean))])

/* ---------- правка (src/shared/wikiPerms.js) ---------- */
const canEdit = e => canEditRule(wikiUser(), 'effects', e)
const canManage = computed(() => canManageRule(wikiUser(), 'effects', {}))
const edit = ref(null)
const busy = ref(false)
const picker = ref(false)
const startEdit = e => { edit.value = { ...e }; picker.value = false }
async function run(fn, ok) {
  busy.value = true
  try { const r = await fn(); await loadRules(true); if (ok) toast(ok); return r || true } catch (e) { toast(e.message, 'error'); return null } finally { busy.value = false }
}
async function save() {
  const { id, order, ...body } = edit.value
  if (await run(() => api('PUT', `/api/rules/effects/${id}`, body), 'Эффект сохранён')) { kind.value = body.kind; edit.value = null }
}
async function add() {
  const e = await run(() => api('POST', '/api/rules/effects', { kind: kind.value, name: 'Новый эффект', html: '<p></p>' }))
  if (e?.id) { q.value = ''; startEdit(e); picker.value = true }
}
async function remove(e) {
  if (!confirm(`Удалить эффект «${e.name}»? Мастер сможет вернуть его из журнала правок.`)) return
  if (await run(() => api('DELETE', `/api/rules/effects/${e.id}`), 'Эффект удалён')) edit.value = null
}
async function upload(ev) {
  const f = ev.target.files?.[0]
  ev.target.value = ''
  if (!f) return
  try {
    const r = await postBlob('/api/rules/icon', f)
    edit.value.icon = r.icon
    picker.value = false
  } catch (e) { toast(e.message, 'error') }
}
</script>

<style scoped>
.fx-head h1 { margin: 0; font: 700 34px 'Cormorant Garamond', serif; color: #f3dc9e; }
.fx-head p { margin: 4px 0 14px; color: #a8936c; font-weight: 600; }
.fx-load { padding: 24px; text-align: center; color: #a8936c; }
.fx-tools { position: sticky; top: 64px; z-index: 5; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 0 -6px 14px; padding: 8px 6px; border-radius: 14px; background: rgba(13, 16, 23, .85); backdrop-filter: blur(8px); }
.fx-tabs { display: flex; flex-wrap: wrap; gap: 4px; }
.fx-tabs button { padding: 6px 12px; border-radius: 10px; border: 1px solid rgba(231, 197, 111, .18); background: none; color: #cdbf9f; font: 700 13px 'Manrope', sans-serif; cursor: pointer; }
.fx-tabs button small { opacity: .7; }
.fx-tabs button.on.buff { background: rgba(126, 208, 122, .16); border-color: #7ed07a; color: #c9f2c6; }
.fx-tabs button.on.debuff { background: rgba(255, 107, 94, .16); border-color: #ff6b5e; color: #ffc9c3; }
.fx-tabs button.on.special { background: rgba(185, 166, 255, .18); border-color: #b9a6ff; color: #e6deff; }
.fx-q { flex: 1 1 200px; padding: 7px 12px; border-radius: 10px; border: 1px solid rgba(231, 197, 111, .22); background: rgba(0, 0, 0, .3); color: #efe3c8; font: 600 13.5px 'Manrope', sans-serif; }
.fx-q:focus { outline: none; border-color: #e7c56f; }
.fx-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr)); gap: 10px; }
.fx-card { --fc: #7ed07a; position: relative; display: flex; gap: 12px; padding: 12px; border-radius: 14px; background: linear-gradient(135deg, color-mix(in srgb, var(--fc) 8%, rgba(20, 16, 11, .8)), rgba(20, 16, 11, .8)); border: 1px solid color-mix(in srgb, var(--fc) 26%, transparent); animation: fx-in .35s ease backwards; animation-delay: calc(var(--i, 0) * 18ms); transition: border-color .2s, transform .2s; }
.fx-card:hover { border-color: color-mix(in srgb, var(--fc) 60%, transparent); transform: translateY(-2px); }
.fx-card.debuff { --fc: #ff6b5e; }
.fx-card.special { --fc: #b9a6ff; }
.fx-card.hid { border-style: dashed; opacity: .75; }
.fx-card.editing { grid-column: 1 / -1; display: grid; gap: 8px; animation: none; transform: none; }
@keyframes fx-in { from { opacity: 0; transform: translateY(6px); } }
.fx-icon { --fc: #7ed07a; display: grid; place-items: center; flex: none; width: 54px; height: 54px; border-radius: 12px; background: radial-gradient(circle at 50% 35%, color-mix(in srgb, var(--fc) 30%, #1a140c), #0e0b07); border: 1px solid color-mix(in srgb, var(--fc) 55%, transparent); box-shadow: 0 0 14px color-mix(in srgb, var(--fc) 25%, transparent); overflow: hidden; color: #fff; font: 800 20px 'Cormorant Garamond', serif; }
.fx-icon.debuff { --fc: #ff6b5e; }
.fx-icon.special { --fc: #b9a6ff; }
.fx-icon img { width: 100%; height: 100%; object-fit: cover; }
.fx-card .fx-icon { animation: fx-breath 3.2s ease-in-out infinite; animation-delay: calc(var(--i, 0) * -.27s); }
.fx-card.debuff .fx-icon { animation: fx-twitch 4.2s ease-in-out infinite; animation-delay: calc(var(--i, 0) * -.33s); }
.fx-card.special .fx-icon { position: relative; animation: fx-breath 4s ease-in-out infinite; }
.fx-card.special .fx-icon::before { content: ''; position: absolute; inset: -3px; border-radius: 14px; background: conic-gradient(from 0deg, transparent, #b9a6ff, transparent 40%, #4fd8ff, transparent 75%); z-index: -1; animation: fx-halo 4s linear infinite; }
.fx-card:hover .fx-icon { transform: scale(1.08); }
@keyframes fx-breath { 50% { box-shadow: 0 0 22px color-mix(in srgb, var(--fc) 55%, transparent); filter: brightness(1.12); } }
@keyframes fx-twitch { 0%, 86%, 100% { transform: none; } 88% { transform: translate(-1px, 1px) rotate(-2deg); } 90% { transform: translate(1px, -1px) rotate(2deg); } 92% { transform: translate(-1px, 0); } }
@keyframes fx-halo { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .fx-card .fx-icon, .fx-card .fx-icon::before { animation: none !important; } }
.fx-icon.pick { cursor: pointer; }
.fx-body { flex: 1; min-width: 0; }
.fx-body h3 { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px; margin: 0 0 4px; font: 700 19px 'Cormorant Garamond', serif; color: #f3dc9e; }
.fx-body h3 small { padding: 1px 7px; border-radius: 99px; background: rgba(231, 197, 111, .12); color: #cdbf9f; font: 700 10.5px 'Manrope', sans-serif; }
.fx-body h3 em { color: #ff9b8f; font: 800 10px 'Manrope', sans-serif; font-style: normal; }
.fx-text { color: #d8ccb0; font-size: 13.5px; }
.fx-text :deep(p) { margin: 0 0 4px; }
.fx-ico { position: absolute; top: 8px; right: 8px; width: 26px; height: 26px; border-radius: 8px; border: 1px solid rgba(231, 197, 111, .3); background: rgba(20, 16, 11, .8); color: #f3d99a; cursor: pointer; opacity: 0; transition: opacity .2s; }
.fx-card:hover .fx-ico, .fx-ico:focus { opacity: 1; }
@media (hover: none) { .fx-ico { opacity: 1; } }
.fx-erow { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.fx-in { padding: 6px 9px; border-radius: 8px; border: 1px solid rgba(231, 197, 111, .25); background: rgba(0, 0, 0, .3); color: #efe3c8; font: 600 13px 'Manrope', sans-serif; color-scheme: dark; }
.fx-in.big { flex: 1 1 200px; font: 700 18px 'Cormorant Garamond', serif; color: #f3dc9e; }
.fx-picker { display: flex; flex-wrap: wrap; gap: 4px; max-height: 190px; overflow-y: auto; padding: 8px; border-radius: 10px; background: rgba(0, 0, 0, .3); border: 1px solid rgba(231, 197, 111, .15); }
.fx-picker > button { width: 40px; height: 40px; padding: 0; border-radius: 8px; border: 1px solid transparent; background: none; cursor: pointer; overflow: hidden; }
.fx-picker > button.on, .fx-picker > button:hover { border-color: #e7c56f; }
.fx-picker img { width: 100%; height: 100%; }
.fx-acts { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.fx-chk { display: flex; align-items: center; gap: 6px; color: #cdbf9f; font: 600 13px 'Manrope', sans-serif; }
.grow { flex: 1; }
.fx-btn { padding: 6px 12px; border-radius: 9px; border: 1px solid rgba(231, 197, 111, .35); background: rgba(231, 197, 111, .08); color: #f3d99a; font: 700 12.5px 'Manrope', sans-serif; cursor: pointer; }
.fx-btn.primary { background: linear-gradient(180deg, #f0d083, #c9a24f); color: #1b1408; border-color: #c9a24f; }
.fx-btn.danger { border-color: rgba(255, 122, 107, .45); color: #ff9b8f; background: none; }
@media (max-width: 600px) { .fx-tools { position: static; } .fx-head h1 { font-size: 28px; } }
@media (prefers-reduced-motion: reduce) { .fx-card { animation: none; } }
</style>
