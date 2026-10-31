<template>
  <!-- предметы: уникальные вещи без хозяина и общие для группы. Вещь героя живёт в его листе (там и правится);
       мастер выдаёт вещь из вики герою — она переезжает в лист; из листа мастер может вернуть её сюда -->
  <div class="itp">
    <header class="itp-head">
      <h1>{{ content.title || 'Предметы' }}</h1>
      <p>Уникальные вещи без хозяина и общие вещи группы. Вещи героев — в их листах (инвентарь и снаряжение), там они и правятся.</p>
    </header>
    <RuneLoader v-if="!rulesState.loaded" text="Перебираю сундуки…" />
    <template v-else>
      <!-- мастер: сколько ячеек сумки у героя без рюкзака -->
      <div v-if="store.role === 'master'" class="itp-set">
        <span>▦ Ячеек сумки без рюкзака</span>
        <input v-model.number="baseCells" type="number" min="0" max="200" />
        <button type="button" class="itp-btn" :disabled="baseCells === rulesState.settings.baseCells || busy" @click="saveCells">Сохранить</button>
        <small>Рюкзак добавляет свои («Ячейки: N» у рюкзака), пояс даёт карманы («Карманы: N»), поклажа — вьюк.</small>
      </div>

      <div class="itp-tools">
        <input v-model="q" class="itp-q" placeholder="Поиск: название, тип, эффект…" />
        <button type="button" class="itp-chip" :class="{ on: !who }" @click="who = ''">Все <small>{{ all.length }}</small></button>
        <button type="button" class="itp-chip" :class="{ on: who === 'shared' }" @click="who = who === 'shared' ? '' : 'shared'">🤝 Общие группы <small>{{ all.filter(x => x.shared).length }}</small></button>
        <button type="button" class="itp-chip" :class="{ on: who === 'free' }" @click="who = who === 'free' ? '' : 'free'">❔ Без хозяина <small>{{ all.filter(x => !x.shared).length }}</small></button>
        <span class="itp-grow" />
        <button v-if="canManage" type="button" class="itp-btn primary" :disabled="busy" @click="add">＋ Предмет</button>
      </div>
      <div class="itp-rars">
        <button v-for="r in RARITIES" :key="r.name" type="button" class="itp-chip" :class="{ on: rar === r.name }" :style="{ color: r.color }" @click="rar = rar === r.name ? '' : r.name">{{ r.name }}</button>
      </div>

      <p v-if="!shown.length" class="itp-empty">{{ all.length ? 'Ничего не нашлось.' : 'Пока пусто: здесь будут вещи без хозяина и общие вещи группы.' }}</p>
      <div class="itp-grid">
        <ItemCard v-for="(it, i) in shown" :key="it.id" :style="{ '--i': i }" class="itp-card" :class="{ hid: it.hidden }" :name="it.name" :rarity="it.rarity" :img="it.img" :html="it.html" :card="it.card">
          <template #badge>
            <span class="itp-badges">
              <em v-if="it.shared" class="itp-own shared" title="Общая вещь группы">🤝 общее</em>
              <em v-else class="itp-own" title="Хозяина пока нет">❔ без хозяина</em>
              <em v-if="it.hidden" class="itp-own" title="Видят только мастер и редакторы">🙈 скрыт</em>
            </span>
          </template>
          <footer v-if="canEdit(it) || store.role === 'master'" class="itp-acts">
            <button v-if="canEdit(it)" type="button" class="itp-btn" @click="startEdit(it)">✎ Править</button>
            <button v-if="store.role === 'master'" type="button" class="itp-btn" title="Вещь переедет в инвентарь листа героя" @click="giveOf = it">🎁 Выдать герою</button>
          </footer>
        </ItemCard>
      </div>
    </template>

    <!-- правка предмета -->
    <Teleport to="body">
      <div v-if="edit" class="itp-back" @pointerdown.self="edit = null">
        <form class="itp-ed" @submit.prevent="save">
          <header><b>{{ edit.id ? 'Предмет' : 'Новый предмет' }}</b><button type="button" class="itp-x" @click="edit = null">✕</button></header>
          <div class="itp-ed-top">
            <label class="itp-img" :style="rarOf(edit.rarity) ? { '--rc': rarOf(edit.rarity).color } : null" title="Картинка предмета">
              <img v-if="edit.img" :src="edit.img" alt="" />
              <span v-else>🖼</span>
              <input type="file" accept="image/*" hidden @change="upload" />
            </label>
            <div class="itp-ed-f">
              <label class="itp-f"><span>Название</span><input v-model="edit.name" maxlength="160" required /></label>
              <div class="itp-f"><span>Редкость</span>
                <div class="itp-rar">
                  <button v-for="r in RARITIES" :key="r.name" type="button" :style="{ '--rc': r.color }" :class="{ on: edit.rarity === r.name }" @click="edit.rarity = edit.rarity === r.name ? '' : r.name">{{ r.name }}</button>
                </div>
              </div>
              <div class="itp-checks">
                <label><input v-model="edit.shared" type="checkbox" /> 🤝 Общая вещь группы</label>
                <label><input v-model="edit.hidden" type="checkbox" /> 🙈 Скрыть от игроков</label>
                <button v-if="edit.img" type="button" class="itp-btn small" @click="edit.img = ''">убрать картинку</button>
              </div>
            </div>
          </div>
          <div class="itp-f"><span>Описание</span><RulesEditor v-model="edit.html" :min-height="80" /></div>
          <CardEdit v-model="edit.card" />
          <footer>
            <button v-if="edit.id && canManage" type="button" class="itp-btn danger" @click="remove(edit)">🗑 Удалить</button>
            <span class="itp-grow" />
            <button type="button" class="itp-btn" @click="edit = null">Отмена</button>
            <button type="submit" class="itp-btn primary" :disabled="busy">Сохранить</button>
          </footer>
        </form>
      </div>
    </Teleport>

    <!-- выдать герою (мастер) -->
    <Teleport to="body">
      <div v-if="giveOf" class="itp-back" @pointerdown.self="giveOf = null">
        <div class="itp-ed small">
          <header><b>🎁 {{ giveOf.name }} — кому?</b><button type="button" class="itp-x" @click="giveOf = null">✕</button></header>
          <input v-model="gq" class="itp-q" placeholder="Имя героя…" />
          <div class="itp-who">
            <button v-for="t in targetsShown" :key="t.id" type="button" class="itp-t" :disabled="busy" @click="giveTo(t)">
              <img v-if="t.photo" :src="`/sheet-img/${t.photo}`" alt="" /><span v-else class="itp-ph">{{ (t.name || '?')[0] }}</span>
              <b>{{ t.name }}</b>
            </button>
            <p v-if="!targetsShown.length" class="itp-empty">{{ targets.length ? 'Никого не нашлось.' : 'Загрузка…' }}</p>
          </div>
          <small class="itp-note">Вещь уйдёт из вики в инвентарь листа (в журнале правок — «выдан»), игроку придёт уведомление.</small>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import RuneLoader from '../../components/fx/RuneLoader.vue'
import ItemCard from '../../components/items/ItemCard.vue'
import CardEdit from '../../components/items/CardEdit.vue'
import RulesEditor from './RulesEditor.vue'
import { store, rulesState, loadRules, api, toast, wikiUser, postBlob, shrink } from '../../map/store.js'
import { canEditRule, canManageRule } from '../../shared/wikiPerms.js'
import { RARITIES, rarityOf } from '../../shared/sheet.js'
import { cardText } from '../../shared/items.js'

defineProps({ content: { type: Object, default: () => ({}) } })
onMounted(() => loadRules())
watch(() => store.data.rulesRev, () => loadRules())

const rarOf = rarityOf
const norm = s => String(s || '').toLowerCase().replace(/ё/g, 'е')
const all = computed(() => (rulesState.items || []).slice().sort((a, b) => a.order - b.order))
const q = ref(''), rar = ref(''), who = ref('')
const shown = computed(() => {
  const t = norm(q.value.trim())
  return all.value.filter(x => (!t || norm(`${x.name} ${x.html.replace(/<[^>]+>/g, ' ')} ${cardText(x.card)}`).includes(t)) &&
    (!rar.value || rarityOf(x.rarity)?.name === rar.value) && (!who.value || (who.value === 'shared') === !!x.shared))
})

/* ---------- правка (права — src/shared/wikiPerms.js, раздел «Предметы») ---------- */
const canEdit = x => canEditRule(wikiUser(), 'items', x)
const canManage = computed(() => canManageRule(wikiUser(), 'items', {}))
const edit = ref(null)
const busy = ref(false)
async function run(fn, ok) {
  busy.value = true
  try { const r = await fn(); await loadRules(true); if (ok) toast(ok); return r || true } catch (e) { toast(e.message, 'error'); return null } finally { busy.value = false }
}
const startEdit = x => { edit.value = JSON.parse(JSON.stringify(x)) }
function add() { edit.value = { name: '', rarity: 'Эпический', img: '', html: '<p></p>', shared: false, hidden: false, card: null } }
async function save() {
  const { id, order, ...body } = edit.value
  const r = await run(() => (id ? api('PUT', `/api/rules/items/${id}`, body) : api('POST', '/api/rules/items', body)), 'Предмет сохранён')
  if (r) edit.value = null
}
async function remove(x) {
  if (!confirm(`Удалить «${x.name}»? Мастер сможет вернуть из журнала правок вики.`)) return
  if (await run(() => api('DELETE', `/api/rules/items/${x.id}`), 'Предмет удалён')) edit.value = null
}
async function upload(ev) {
  const f = ev.target.files?.[0]
  ev.target.value = ''
  if (!f) return
  // картинка предмета смотрится на весь экран — храним до 1200 точек (webp), не больше лимита загрузки
  try { edit.value.img = (await postBlob('/api/rules/icon', (await shrink(f, 1200, 0.9)).blob)).icon } catch (e) { toast(e.message, 'error') }
}

/* ---------- мастер: ячейки без рюкзака, выдать герою ---------- */
const baseCells = ref(rulesState.settings?.baseCells ?? 5)
watch(() => rulesState.settings?.baseCells, v => { if (v != null) baseCells.value = v })
const saveCells = () => run(() => api('PUT', '/api/rules/settings', { baseCells: baseCells.value }), 'Сохранено: ячеек без рюкзака — ' + baseCells.value)
const giveOf = ref(null)
const targets = ref([])
const gq = ref('')
const targetsShown = computed(() => targets.value.filter(t => !gq.value.trim() || norm(`${t.name} ${t.hero}`).includes(norm(gq.value.trim()))))
watch(giveOf, async v => {
  if (!v || targets.value.length) return
  try { targets.value = (await api('GET', '/api/sheets-targets')).sort((a, b) => a.name.localeCompare(b.name, 'ru')) } catch (e) { toast(e.message, 'error') }
})
async function giveTo(t) {
  const it = giveOf.value
  if (!it || !confirm(`Выдать «${it.name}» — ${t.name}? Вещь уйдёт из вики в его лист.`)) return
  if (await run(() => api('POST', `/api/rules/items/${it.id}/give`, { sheetId: t.id }), `«${it.name}» → ${t.name}`)) giveOf.value = null
}
</script>

<style scoped>
.itp-head h1 { margin: 0; font: 700 34px 'Cormorant Garamond', serif; color: #f3dc9e; }
.itp-head p { margin: 4px 0 14px; color: #a8936c; font-weight: 600; }
.itp-set { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 12px; padding: 10px 12px; border-radius: 12px; border: 1px dashed rgba(231, 197, 111, .3); background: rgba(0, 0, 0, .2); font: 700 13px 'Manrope', sans-serif; color: #e6d3ad; }
.itp-set input { width: 70px; padding: 5px 8px; border-radius: 8px; border: 1px solid rgba(231, 197, 111, .3); background: rgba(0, 0, 0, .3); color: #efe3c8; font: 800 14px 'Manrope', sans-serif; }
.itp-set small { flex: 1 1 100%; color: #a8936c; font-weight: 600; }
.itp-tools { position: sticky; top: 64px; z-index: 5; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin: 0 -6px 6px; padding: 8px 6px; border-radius: 14px; background: rgba(13, 16, 23, .85); backdrop-filter: blur(8px); }
.itp-rars { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 14px; }
.itp-q { flex: 1 1 200px; padding: 7px 12px; border-radius: 10px; border: 1px solid rgba(231, 197, 111, .22); background: rgba(0, 0, 0, .3); color: #efe3c8; font: 600 13.5px 'Manrope', sans-serif; }
.itp-q:focus { outline: none; border-color: #e7c56f; }
.itp-chip { padding: 5px 11px; border-radius: 99px; border: 1px solid rgba(231, 197, 111, .2); background: none; color: #cdbf9f; font: 700 12.5px 'Manrope', sans-serif; cursor: pointer; }
.itp-chip small { opacity: .65; }
.itp-chip.on { background: rgba(231, 197, 111, .14); border-color: currentColor; }
.itp-grow { flex: 1; }
.itp-btn { padding: 6px 12px; border-radius: 10px; border: 1px solid rgba(231, 197, 111, .28); background: rgba(0, 0, 0, .25); color: #e6d3ad; font: 800 12.5px 'Manrope', sans-serif; cursor: pointer; }
.itp-btn:hover:not(:disabled) { border-color: #e7c56f; }
.itp-btn.primary { background: linear-gradient(180deg, #d9b25e, #a8802f); color: #1b140c; border: 0; }
.itp-btn.danger { color: #ff9b8c; border-color: rgba(255, 107, 94, .4); }
.itp-btn.small { padding: 3px 8px; font-size: 11.5px; }
.itp-btn:disabled { opacity: .45; cursor: default; }
.itp-empty { color: #a8936c; font-weight: 600; }
.itp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 540px), 1fr)); gap: 12px; align-items: start; }
.itp-card { animation: itp-in .35s ease backwards; animation-delay: calc(var(--i, 0) * 25ms); transition: transform .2s, box-shadow .2s; }
.itp-card:hover { transform: translateY(-2px); box-shadow: 0 14px 30px rgba(0, 0, 0, .45), 0 0 20px color-mix(in srgb, var(--rc) 22%, transparent); }
.itp-card.hid { opacity: .6; }
.itp-badges { display: grid; gap: 3px; justify-items: end; align-self: start; }
.itp-own { padding: 2px 8px; border-radius: 99px; font: 800 10.5px 'Manrope', sans-serif; font-style: normal; color: #cdbf9f; background: rgba(0, 0, 0, .3); border: 1px solid rgba(231, 197, 111, .2); white-space: nowrap; }
.itp-own.shared { color: #9fe0a0; border-color: rgba(126, 208, 122, .4); }
.itp-acts { display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end; }
@keyframes itp-in { from { opacity: 0; transform: translateY(10px); } }
/* окна */
.itp-back { position: fixed; inset: 0; z-index: 650; display: grid; place-items: center; padding: 16px; background: rgba(5, 4, 3, .72); backdrop-filter: blur(3px); }
.itp-ed { --acc: #c9a24f; width: min(900px, 100%); max-height: calc(100vh - 32px); overflow-y: auto; display: grid; gap: 12px; padding: 16px; border-radius: 16px; background: linear-gradient(180deg, #221b13, #17130e); border: 1px solid #5a4426; box-shadow: 0 30px 80px rgba(0, 0, 0, .7); color: #efe3c8; }
.itp-ed.small { width: min(440px, 100%); }
.itp-ed header, .itp-ed footer { display: flex; align-items: center; gap: 8px; }
.itp-ed header b { flex: 1; font: 700 22px 'Cormorant Garamond', serif; color: #f3dfb2; }
.itp-x { width: 30px; height: 30px; border-radius: 8px; border: 1px solid #4a3a24; background: none; color: #c8b48c; cursor: pointer; }
.itp-ed-top { display: grid; grid-template-columns: 130px minmax(0, 1fr); gap: 12px; }
.itp-img { --rc: #c9a24f; display: grid; place-items: center; width: 130px; height: 130px; border-radius: 14px; cursor: pointer; overflow: hidden; font-size: 40px; background: radial-gradient(circle, color-mix(in srgb, var(--rc) 25%, transparent), rgba(0, 0, 0, .4) 70%); border: 2px dashed color-mix(in srgb, var(--rc) 60%, transparent); }
.itp-img img { width: 100%; height: 100%; object-fit: contain; }
.itp-ed-f { display: grid; gap: 8px; min-width: 0; align-content: start; }
.itp-f { display: grid; gap: 4px; min-width: 0; }
.itp-f > span { font: 700 10.5px 'Manrope', sans-serif; letter-spacing: .06em; text-transform: uppercase; color: #a8936c; }
.itp-f input { padding: 7px 10px; border-radius: 9px; border: 1px solid rgba(201, 162, 79, .25); background: rgba(0, 0, 0, .3); color: #efe3c8; font: 700 15px 'Manrope', sans-serif; }
.itp-rar { display: flex; flex-wrap: wrap; gap: 5px; }
.itp-rar button { padding: 3px 9px; border-radius: 99px; border: 1px solid color-mix(in srgb, var(--rc) 50%, transparent); background: none; color: var(--rc); font: 700 12px 'Manrope', sans-serif; cursor: pointer; }
.itp-rar button.on { background: color-mix(in srgb, var(--rc) 22%, transparent); box-shadow: 0 0 10px color-mix(in srgb, var(--rc) 40%, transparent); }
.itp-checks { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 14px; font: 700 13px 'Manrope', sans-serif; color: #cdbf9f; }
.itp-checks label { display: flex; align-items: center; gap: 5px; cursor: pointer; }
.itp-who { display: grid; gap: 5px; max-height: 50vh; overflow-y: auto; }
.itp-t { display: flex; align-items: center; gap: 10px; padding: 6px 8px; border-radius: 11px; border: 1px solid rgba(201, 162, 79, .18); background: rgba(0, 0, 0, .2); color: inherit; cursor: pointer; text-align: left; font: 700 14px 'Manrope', sans-serif; }
.itp-t:hover { border-color: #c9a24f; background: rgba(201, 162, 79, .1); }
.itp-t img, .itp-ph { width: 34px; height: 34px; border-radius: 50%; object-fit: cover; display: grid; place-items: center; background: rgba(201, 162, 79, .15); }
.itp-note { color: #a8936c; font: 600 12px 'Manrope', sans-serif; }
@media (max-width: 560px) { .itp-ed-top { grid-template-columns: minmax(0, 1fr); } }
</style>
