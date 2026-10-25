<template>
  <!-- Бестиарий: карточки существ по группам. Встреченные — с артом и стихией, изученные — с отметкой 📖,
       невстреченные — силуэт «???» (видно, сколько ещё не открыто). Мастер видит всех и кто что знает -->
  <section class="bp">
    <template v-if="!open">
      <header class="bp-head">
        <div>
          <h1>📜 Бестиарий</h1>
          <p v-if="master">{{ beasts.length }} существ · встретили хоть кто-то: {{ beasts.filter(b => b.seen?.all || b.seen?.ids?.length).length }} · скрыто: {{ beasts.filter(b => b.hidden).length }}</p>
          <p v-else>Открыто {{ known.length }} из {{ beasts.length }} · изучено {{ beasts.filter(b => b.studied).length }}</p>
        </div>
        <button v-if="master" type="button" class="bp-btn primary" @click="create">＋ Существо</button>
      </header>
      <div class="bp-tools">
        <input v-model="q" class="bp-q" placeholder="Найти существо…" />
        <button v-for="g in groups" :key="g" type="button" class="bp-chip" :class="{ on: group === g }" @click="group = group === g ? '' : g">{{ g }} <small>{{ beasts.filter(b => b.group === g).length }}</small></button>
      </div>
      <RuneLoader v-if="!beastState.loaded" text="Листаю бестиарий…" />
      <template v-else>
        <div v-for="g in shownGroups" :key="g.name" class="bp-group">
          <h2>{{ g.name || 'Без группы' }}</h2>
          <div class="bp-grid">
            <button v-for="(b, i) in g.items" :key="b.id" v-tilt="5" type="button" class="bp-card" :class="[elementOf(b), { unknown: b.unknown, hid: b.hidden }]"
                    :style="{ '--i': i, '--ec': ELEMENTS[elementOf(b)].color, '--eg': ELEMENTS[elementOf(b)].glow, '--dc': dangerColor(b.danger) }" :disabled="b.unknown" @click="go(b)">
              <BeastArt :beast="b" :el="elementOf(b)" :unknown="b.unknown" />
              <div class="bp-info">
                <b>{{ b.unknown ? '???' : b.name }}</b>
                <small v-if="!b.unknown">{{ [b.type, b.size].filter(Boolean).join(' · ') }}</small>
                <small v-else>Ещё не встречено</small>
                <span v-if="!b.unknown" class="bp-tags">
                  <i class="bp-danger">{{ b.danger || '—' }}</i>
                  <i v-if="master" class="bp-vis" title="Встретили / изучили">🔍 {{ visCount(b.seen) }} · 📖 {{ visCount(b.studied) }}</i>
                  <i v-else class="bp-st" :class="{ full: b.studied }">{{ b.studied ? '📖 изучено' : '🔍 встречено' }}</i>
                  <i v-if="b.hidden" class="bp-hid">🔒</i>
                </span>
              </div>
            </button>
          </div>
        </div>
        <p v-if="!shownGroups.length" class="bp-empty">{{ q ? 'Ничего не нашлось.' : 'Бестиарий пока пуст.' }}</p>
      </template>
    </template>

    <template v-else>
      <button type="button" class="bp-back" @click="go(null)">← Все существа</button>
      <BeastSheet :key="open.id" :b="open" :master="master" @edit="editing = open" @skill="(kind, s) => (skillEdit = { kind, entry: s })" />
    </template>

    <BeastEditor v-if="editing" :b="editing" @close="editing = null" @deleted="editing = null; go(null)" />
    <NpcSkillDialog v-if="skillEdit" :kind="skillEdit.kind" :entry="skillEdit.entry" @close="skillEdit = null" />
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { store, isMaster, api, toast, init, beastState, loadBestiary, loadNpcs } from '../../map/store.js'
import RuneLoader from '../../components/fx/RuneLoader.vue'
import BeastArt from './BeastArt.vue'
import BeastSheet from './BeastSheet.vue'
import BeastEditor from './BeastEditor.vue'
import NpcSkillDialog from '../npc/NpcSkillDialog.vue'
import { ELEMENTS, elementOf, dangerColor } from './beasts.js'

init()
const master = isMaster
const route = useRoute(), router = useRouter()
// бестиарий и справочник навыков (общий с НПС) — свои запросы; обновляются, когда меняются на сервере
watch(() => [store.data.bestiaryRev, store.role, store.me?.id], () => loadBestiary(), { immediate: true })
watch(() => store.data.npcsRev, () => loadNpcs(), { immediate: true })

const beasts = computed(() => [...beastState.beasts].sort((a, b) => (a.order || 0) - (b.order || 0)))
const known = computed(() => beasts.value.filter(b => !b.unknown))
const groups = computed(() => [...new Set(beasts.value.map(b => b.group).filter(Boolean))])
const q = ref(''), group = ref('')
const shownGroups = computed(() => {
  const s = q.value.trim().toLowerCase()
  const list = beasts.value.filter(b => (!group.value || b.group === group.value) && (!s || (!b.unknown && `${b.name} ${b.type} ${b.race}`.toLowerCase().includes(s))))
  const by = new Map()
  for (const b of list) { if (!by.has(b.group || '')) by.set(b.group || '', []); by.get(b.group || '').push(b) }
  return [...by.entries()].map(([name, items]) => ({ name, items }))
})
const visCount = w => (w?.all ? 'все' : w?.ids?.length || 0)

// открытое существо — в адресе (?beast=…)
const open = computed(() => beasts.value.find(b => b.id === route.query.beast && !b.unknown) || null)
const go = b => router.replace({ query: { ...route.query, beast: b?.id || undefined } })
const editing = ref(null), skillEdit = ref(null)
async function create() {
  try { const b = await api('POST', '/api/bestiary', { name: 'Новое существо', group: group.value }); await loadBestiary(true); go(b); editing.value = beastState.beasts.find(x => x.id === b.id) || b } catch (e) { toast(e.message, 'error') }
}
</script>

<style scoped>
.bp { display: grid; gap: 14px; color: #efe3c8; font-family: 'Manrope', sans-serif; }
.bp-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; flex-wrap: wrap; }
.bp-head h1 { margin: 0; font: 700 36px 'Cormorant Garamond', serif; color: #f3dc9e; }
.bp-head p { margin: 2px 0 0; color: #a8936c; font-weight: 600; }
.bp-tools { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.bp-q { flex: 1; min-width: 200px; max-width: 320px; padding: 8px 12px; border-radius: 10px; border: 1px solid rgba(231, 197, 111, .25); background: rgba(0, 0, 0, .3); color: #efe3c8; font: 600 13.5px 'Manrope', sans-serif; outline: none; }
.bp-chip { padding: 5px 12px; border-radius: 99px; border: 1px solid rgba(231, 197, 111, .25); background: none; color: #cdbf9f; font: 700 12.5px 'Manrope', sans-serif; cursor: pointer; }
.bp-chip.on { background: rgba(231, 197, 111, .16); border-color: #e7c56f; color: #f3dc9e; }
.bp-chip small { opacity: .6; }
.bp-group h2 { margin: 6px 0 10px; font: 700 24px 'Cormorant Garamond', serif; color: #e6cf98; }
.bp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 14px; }
.bp-card { display: grid; gap: 0; padding: 0; overflow: hidden; border-radius: 16px; border: 1px solid color-mix(in srgb, var(--ec) 35%, transparent); background: #120e0a; color: inherit; text-align: left; cursor: pointer;
  box-shadow: 0 10px 26px rgba(0, 0, 0, .45); animation: bp-in .5s cubic-bezier(.2, .8, .3, 1) both; animation-delay: calc(var(--i) * .06s); transition: box-shadow .25s, border-color .25s; }
.bp-card:hover { border-color: var(--ec); box-shadow: 0 14px 34px rgba(0, 0, 0, .55), 0 0 26px var(--eg); }
.bp-card:hover :deep(.ba-img) { transform: scale(1.05); }
.bp-card :deep(.ba) { border-radius: 0; }
.bp-card.unknown { cursor: default; border-color: rgba(120, 100, 160, .2); }
.bp-card.hid { opacity: .6; }
.bp-info { display: grid; gap: 3px; padding: 10px 12px 12px; background: linear-gradient(180deg, rgba(0, 0, 0, .1), rgba(0, 0, 0, .4)); }
.bp-info b { color: #f3dc9e; font: 700 19px/1.1 'Cormorant Garamond', serif; }
.bp-card.unknown .bp-info b { color: #5d5468; letter-spacing: .2em; }
.bp-info small { color: #a8936c; font: 700 11.5px 'Manrope', sans-serif; }
.bp-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 3px; }
.bp-tags i { padding: 1px 8px; border-radius: 99px; font: 800 10.5px 'Manrope', sans-serif; font-style: normal; background: rgba(255, 255, 255, .06); color: #cdbf9f; }
.bp-tags .bp-danger { background: color-mix(in srgb, var(--dc) 18%, transparent); color: var(--dc); }
.bp-tags .bp-st.full { background: rgba(126, 208, 122, .14); color: #b4ecb0; }
.bp-tags .bp-vis { background: rgba(127, 180, 255, .12); color: #b9d6ff; }
.bp-empty { color: #a8936c; }
.bp-back { justify-self: start; padding: 6px 12px; border-radius: 9px; border: 1px solid rgba(231, 197, 111, .3); background: rgba(0, 0, 0, .3); color: #f3dc9e; font: 700 13px 'Manrope', sans-serif; cursor: pointer; }
.bp-btn { height: 34px; padding: 0 14px; border-radius: 9px; border: 1px solid rgba(231, 197, 111, .35); background: rgba(0, 0, 0, .3); color: #f3dc9e; font: 700 13px 'Manrope', sans-serif; cursor: pointer; }
.bp-btn.primary { background: linear-gradient(180deg, #f0d083, #c9a24f); color: #1b1408; border: 0; }
@keyframes bp-in { from { opacity: 0; transform: translateY(16px) scale(.97); } }
@media (prefers-reduced-motion: reduce) { .bp-card { animation: none; } }
</style>
