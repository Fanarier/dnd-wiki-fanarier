<template>
  <!-- атлас народов (из таблицы «Атлас»): гербы, сведения, политика, население, природа, ресурсы, глобальные структуры.
       Народ открывается по ?n=<id>; на карте у страны с тем же названием — кнопка «Атлас» (InfoPanel) -->
  <div class="at">
    <RuneLoader v-if="!rulesState.loaded" text="Разворачиваю атлас…" />
    <template v-else-if="cur">
      <button type="button" class="at-back" @click="openN('')">← Все народы</button>
      <header class="at-hero">
        <div class="at-emb big"><img v-if="cur.emblem" :src="cur.emblem" alt="" /></div>
        <div class="at-id">
          <h1>{{ cur.name }}<em v-if="cur.hidden">скрыт от игроков</em></h1>
          <div class="at-chips">
            <span v-for="c in chips(cur)" :key="c.k" class="at-chip" :title="c.k"><small>{{ c.k }}</small>{{ c.v }}</span>
          </div>
          <router-link v-if="stateOf(cur)" class="at-map" :to="{ path: '/', query: { focus: 'states:' + stateOf(cur).id } }">🗺 Показать на карте →</router-link>
        </div>
      </header>

      <section v-for="(s, si) in cur.sections" :key="s.title" class="at-sec" :style="{ '--i': si }">
        <h2>{{ s.title }}</h2>
        <div class="at-cols">
          <div v-for="side in ['left', 'right']" :key="side" class="at-col">
            <template v-for="(it, i) in s[side]" :key="i">
              <h3 v-if="it.h" class="at-sub">{{ it.h }}</h3>
              <div v-else class="at-row">
                <span class="at-k">{{ it.k }}</span>
                <span class="at-v" :class="{ lvl: level(it.v) >= 0 }">
                  <i v-if="level(it.v) >= 0" class="at-bar" :style="{ '--lv': level(it.v) }"><b v-for="n in 5" :key="n" :class="{ on: n <= level(it.v) }" /></i>
                  {{ it.v }}
                </span>
              </div>
            </template>
          </div>
        </div>
      </section>

      <section v-if="cur.natural.length || cur.built.length" class="at-sec">
        <h2>Глобальные структуры</h2>
        <div v-if="cur.natural.length" class="at-struct">
          <h3 class="at-sub">Естественные</h3>
          <div v-for="x in cur.natural" :key="x.name" class="at-card">
            <b>{{ x.name }}</b>
            <span v-if="x.place">📍 {{ x.place }}</span>
            <span v-if="x.size">Размер: {{ x.size }}</span>
            <span v-if="x.evo">Эволюция: {{ x.evo }}</span>
            <span v-if="x.danger" class="danger">☠ Опасность {{ x.danger }}</span>
            <p v-if="x.note">{{ x.note }}</p>
          </div>
        </div>
        <div v-if="cur.built.length" class="at-struct">
          <h3 class="at-sub">Построенные</h3>
          <div v-for="x in cur.built" :key="x.name" class="at-card built">
            <b>{{ x.name }}</b>
            <span v-for="(bn, i) in x.bonus" :key="i" class="bonus">✦ {{ bn }}</span>
            <p v-if="x.note">{{ x.note }}</p>
          </div>
        </div>
      </section>
    </template>
    <template v-else>
      <header class="at-head">
        <h1>{{ content.title || 'Атлас' }}</h1>
        <p>{{ content.description }}</p>
      </header>
      <div class="at-grid">
        <button v-for="(n, i) in list" :key="n.id" type="button" class="at-tile" :class="{ hid: n.hidden }" :style="{ '--i': i }" @click="openN(n.id)">
          <span class="at-emb"><img v-if="n.emblem" :src="n.emblem" alt="" loading="lazy" /></span>
          <b>{{ n.name }}</b>
          <small>{{ [val(n, 'Название столицы'), val(n, 'Общее население')].filter(Boolean).join(' · ') }}</small>
          <span class="at-tags"><i v-for="t in [val(n, 'Система власти'), val(n, 'Технологическая эпоха'), val(n, 'Магический потенциал') && 'магия: ' + val(n, 'Магический потенциал')].filter(Boolean)" :key="t">{{ t }}</i></span>
        </button>
      </div>
      <p v-if="!list.length" class="at-none">Атлас пока пуст.</p>
    </template>
  </div>
</template>

<script setup>
import RuneLoader from '../../components/fx/RuneLoader.vue'
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { store, rulesState, loadRules } from '../../map/store.js'

defineProps({ content: { type: Object, default: () => ({}) } })
onMounted(() => loadRules())
watch(() => store.data.rulesRev, () => loadRules())
const route = useRoute(), router = useRouter()

const list = computed(() => rulesState.atlas || [])
const cur = computed(() => list.value.find(n => n.id === route.query.n) || null)
const openN = id => { router.push({ query: { ...route.query, n: id || undefined } }); scrollTo({ top: 0, behavior: 'smooth' }) }
// значение признака по названию (во всех разделах)
const val = (n, k) => n.sections.flatMap(s => [...s.left, ...s.right]).find(x => x.k === k)?.v || ''
const CHIPS = ['Система власти', 'Управление', 'Религия', 'Технологическая эпоха', 'Магический потенциал', 'Название столицы', 'Общее население']
const chips = n => CHIPS.map(k => ({ k, v: val(n, k) })).filter(c => c.v)
// «Очень мало … Очень много» → полоска из пяти делений
const LEVELS = { 'нет': 0, 'очень мало': 1, 'мало': 2, 'средне': 3, 'много': 4, 'очень много': 5 }
const level = v => LEVELS[String(v || '').toLowerCase().trim()] ?? -1
const norm = s => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я]/g, '')
const stateOf = n => (store.data.states || []).find(s => norm(s.name) === norm(n.name)) || null
</script>

<style scoped>
.at-head h1, .at-id h1 { margin: 0; font: 700 34px 'Cormorant Garamond', serif; color: #f3dc9e; }
.at-head p { margin: 4px 0 14px; color: #a8936c; font-weight: 600; }
.at-none { color: #a8936c; text-align: center; padding: 24px; }
.at-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 220px), 1fr)); gap: 12px; }
.at-tile { display: grid; justify-items: center; gap: 6px; padding: 16px 12px 14px; border-radius: 16px; border: 1px solid rgba(231, 197, 111, .2); background: radial-gradient(circle at 50% 20%, rgba(231, 197, 111, .1), rgba(20, 16, 11, .82) 70%); color: #efe3c8; cursor: pointer; text-align: center; animation: at-in .4s ease backwards; animation-delay: calc(var(--i) * 40ms); transition: transform .25s, border-color .25s, box-shadow .25s; }
.at-tile:hover { transform: translateY(-4px); border-color: rgba(231, 197, 111, .55); box-shadow: 0 14px 30px rgba(0, 0, 0, .45), 0 0 26px rgba(231, 197, 111, .15); }
.at-tile.hid { border-style: dashed; opacity: .7; }
.at-tile b { font: 700 22px 'Cormorant Garamond', serif; color: #f3dc9e; }
.at-tile small { color: #a8936c; font: 700 12px 'Manrope', sans-serif; }
.at-tags { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px; }
.at-tags i { padding: 1px 8px; border-radius: 99px; background: rgba(231, 197, 111, .1); color: #cdbf9f; font: 700 10.5px 'Manrope', sans-serif; font-style: normal; }
.at-emb { display: grid; place-items: center; width: 110px; height: 110px; }
.at-emb img { width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 8px 16px rgba(0, 0, 0, .5)); transition: transform .4s; }
.at-tile:hover .at-emb img { transform: scale(1.08) rotate(-3deg); }
.at-emb.big { width: 190px; height: 190px; flex: none; animation: at-float 6s ease-in-out infinite; }
.at-emb.big img { filter: drop-shadow(0 0 24px rgba(231, 197, 111, .25)) drop-shadow(0 10px 20px rgba(0, 0, 0, .5)); }
@keyframes at-float { 50% { transform: translateY(-6px); } }
@keyframes at-in { from { opacity: 0; transform: translateY(10px); } }
.at-back { margin-bottom: 10px; padding: 5px 12px; border-radius: 9px; border: 1px solid rgba(231, 197, 111, .35); background: none; color: #f3d99a; font: 700 12.5px 'Manrope', sans-serif; cursor: pointer; }
.at-hero { display: flex; flex-wrap: wrap; align-items: center; gap: 18px; margin-bottom: 14px; }
.at-id { flex: 1 1 260px; display: grid; gap: 8px; }
.at-id h1 em { margin-left: 10px; color: #ff9b8f; font: 800 11px 'Manrope', sans-serif; font-style: normal; }
.at-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.at-chip { display: grid; padding: 4px 10px; border-radius: 10px; background: rgba(231, 197, 111, .08); border: 1px solid rgba(231, 197, 111, .2); color: #efe3c8; font: 700 13px 'Manrope', sans-serif; }
.at-chip small { color: #a8936c; font: 800 9.5px 'Manrope', sans-serif; letter-spacing: .06em; text-transform: uppercase; }
.at-map { justify-self: start; color: #e7c56f; font: 700 13px 'Manrope', sans-serif; text-decoration: none; }
.at-map:hover { text-decoration: underline; }
.at-sec { margin-bottom: 14px; padding: 12px 14px; border-radius: 16px; background: rgba(20, 16, 11, .72); border: 1px solid rgba(231, 197, 111, .14); animation: at-in .4s ease backwards; animation-delay: calc(var(--i, 0) * 60ms); }
.at-sec h2 { margin: 0 0 8px; font: 700 22px 'Cormorant Garamond', serif; color: #f3dc9e; }
.at-cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); gap: 4px 24px; }
.at-col { display: grid; align-content: start; gap: 2px; }
.at-sub { margin: 8px 0 2px; color: #e7c56f; font: 800 11px 'Manrope', sans-serif; letter-spacing: .08em; text-transform: uppercase; }
.at-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 3px 0; border-bottom: 1px dashed rgba(231, 197, 111, .1); }
.at-k { color: #cdbf9f; font: 600 13px 'Manrope', sans-serif; }
.at-v { display: flex; align-items: center; gap: 8px; color: #f6ecd2; font: 700 13px 'Manrope', sans-serif; text-align: right; }
.at-bar { display: flex; gap: 2px; }
.at-bar b { width: 9px; height: 9px; border-radius: 2px; background: rgba(231, 197, 111, .12); }
.at-bar b.on { background: linear-gradient(180deg, #f3d38a, #c9952f); box-shadow: 0 0 6px rgba(231, 197, 111, .4); }
.at-struct { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 240px), 1fr)); gap: 8px; margin-bottom: 8px; }
.at-struct .at-sub { grid-column: 1 / -1; }
.at-card { display: grid; gap: 3px; padding: 10px 12px; border-radius: 12px; background: rgba(0, 0, 0, .25); border: 1px solid rgba(126, 208, 122, .25); color: #cdbf9f; font: 600 12.5px 'Manrope', sans-serif; }
.at-card.built { border-color: rgba(111, 168, 255, .3); }
.at-card b { color: #f3dc9e; font: 700 17px 'Cormorant Garamond', serif; }
.at-card .danger { color: #ff9b8f; }
.at-card .bonus { color: #b8d4ff; }
.at-card p { margin: 0; }
@media (prefers-reduced-motion: reduce) { .at-tile, .at-sec, .at-emb.big { animation: none; } }
</style>
