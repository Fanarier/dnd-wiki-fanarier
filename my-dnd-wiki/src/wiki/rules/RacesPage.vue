<template>
  <!-- расы: сетка карточек; раса — базовые навыки и лента уровней («сразу» + «на выбор») -->
  <div class="rc">
    <div v-if="!rulesState.loaded" class="rc-load">Листаю свод правил…</div>

    <!-- одна раса -->
    <template v-else-if="race">
      <button type="button" class="rc-back" @click="go(null)">← Все расы</button>
      <header class="rc-hero">
        <span class="rc-sig">{{ race.name[0] }}</span>
        <div>
          <h1>{{ race.name }}</h1>
          <p>{{ race.base.length }} базовых навыка · уровни {{ race.levels.map(l => l.lv).join(', ') || '—' }}</p>
        </div>
        <span class="grow" />
        <button v-if="master && !edit" type="button" class="rc-btn" @click="startEdit">✎ Править</button>
      </header>

      <RaceEditor v-if="edit" v-model="edit" :busy="busy" @save="save" @cancel="edit = null" @remove="remove" />
      <template v-else>
        <div v-if="race.empty && !race.levels.length" class="rc-load">Раса ещё в разработке.</div>
        <RulesHtml v-if="race.intro" class="rc-intro" :html="race.intro" />
        <section v-if="race.base.length" class="rc-sec">
          <h2><b>0</b> Базовые навыки <small>есть у каждого представителя расы</small></h2>
          <div class="rc-grid">
            <article v-for="(s, i) in race.base" :key="'b' + i" class="rc-card base" :style="{ '--i': i }">
              <h3>{{ s.name }}</h3>
              <RulesHtml :html="s.html" />
            </article>
          </div>
        </section>
        <section v-for="l in race.levels" :key="l.lv" class="rc-sec">
          <h2><b>{{ l.lv }}</b> уровень</h2>
          <div class="rc-lv">
            <article v-if="l.auto" class="rc-card auto">
              <span class="rc-tag">получаешь сразу</span>
              <h3>{{ l.auto.name }}</h3>
              <RulesHtml :html="l.auto.html" />
            </article>
            <div v-if="l.options.length" class="rc-opts">
              <span class="rc-tag pick">{{ PICK_WORD[l.pick || 1] || `выбери ${l.pick}` }}</span>
              <div class="rc-grid">
                <article v-for="(o, i) in l.options" :key="i" class="rc-card opt" :style="{ '--i': i }">
                  <h3><i>{{ i + 1 }}</i>{{ o.name }}</h3>
                  <RulesHtml :html="o.html" />
                </article>
              </div>
            </div>
          </div>
        </section>
        <RulesHtml v-if="race.outro" class="rc-intro" :html="race.outro" />
      </template>
    </template>

    <!-- все расы + справка -->
    <template v-else>
      <header class="rc-head">
        <h1>Расы</h1>
        <p>Базовые навыки, навыки по уровням и выборы — из вики Heroes &amp; Adventures.</p>
      </header>
      <nav class="rc-tabs">
        <button type="button" :class="{ on: !info }" @click="info = null">Все расы <small>{{ races.length }}</small></button>
        <button v-for="a in infos" :key="a.id" type="button" :class="{ on: info === a.id }" @click="info = a.id">{{ a.title }}</button>
      </nav>
      <article v-if="info" class="rc-art"><RulesHtml :html="infos.find(a => a.id === info)?.html || ''" /></article>
      <div v-else class="rc-cards">
        <button v-for="(r, i) in races" :key="r.id" type="button" class="rc-race" :class="{ empty: r.empty && !r.levels.length, hid: r.hidden }" :style="{ '--i': i }" @click="go(r.id)">
          <span class="rc-sig">{{ r.name[0] }}</span>
          <b>{{ r.name }}</b>
          <small v-if="r.empty && !r.levels.length">в разработке</small>
          <small v-else>{{ r.levels.length }} уровней · {{ r.levels.reduce((n, l) => n + l.options.length, 0) }} выборов</small>
          <em v-if="r.hidden">скрыта</em>
        </button>
        <button v-if="master" type="button" class="rc-race add" @click="create">＋<b>Новая раса</b></button>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { store, rulesState, loadRules, api, toast } from '../../map/store.js'
import RulesHtml from './RulesHtml.vue'
import RaceEditor from './RaceEditor.vue'

const route = useRoute()
const router = useRouter()
const master = computed(() => store.role === 'master')
const races = computed(() => rulesState.races.slice().sort((a, b) => a.order - b.order))
const infos = computed(() => rulesState.articles.filter(a => a.group === 'races').sort((a, b) => a.order - b.order))
const race = computed(() => rulesState.races.find(r => r.id === route.query.race) || null)
const info = ref(null)
const PICK_WORD = { 1: 'выбери один', 2: 'выбери два', 3: 'выбери три' }
const go = id => { edit.value = null; router.push({ query: { ...route.query, race: id || undefined } }); scrollTo({ top: 0 }) }
onMounted(() => loadRules())
watch(() => store.data.rulesRev, () => loadRules())

const edit = ref(null)
const busy = ref(false)
const startEdit = () => { edit.value = JSON.parse(JSON.stringify(race.value)) }
async function save() {
  busy.value = true
  try {
    await api('PUT', `/api/rules/races/${race.value.id}`, edit.value)
    edit.value = null
    await loadRules(true)
    toast('Раса сохранена')
  } catch (e) { toast(e.message, 'error') } finally { busy.value = false }
}
async function create() {
  try {
    const r = await api('POST', '/api/rules/races', { name: 'Новая раса', base: [], levels: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20].map(lv => ({ lv, auto: null, options: [] })) })
    await loadRules(true)
    go(r.id)
    startEdit()
  } catch (e) { toast(e.message, 'error') }
}
async function remove() {
  if (!confirm(`Удалить расу «${race.value.name}»?`)) return
  try { await api('DELETE', `/api/rules/races/${race.value.id}`); edit.value = null; await loadRules(true); go(null) } catch (e) { toast(e.message, 'error') }
}
</script>

<style scoped>
.rc-load { padding: 30px; text-align: center; color: #a8936c; }
.rc-head h1, .rc-hero h1 { margin: 0; font: 700 34px 'Cormorant Garamond', serif; color: #f3dc9e; }
.rc-head p, .rc-hero p { margin: 4px 0 14px; color: #a8936c; font-weight: 600; }
.rc-tabs { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 14px; }
.rc-tabs button { padding: 6px 12px; border-radius: 9px; border: 1px solid rgba(231, 197, 111, .18); background: none; color: #cdbf9f; font: 700 13px 'Manrope', sans-serif; cursor: pointer; }
.rc-tabs button.on { background: rgba(231, 197, 111, .16); color: #f3dc9e; border-color: rgba(231, 197, 111, .45); }
.rc-tabs small { opacity: .7; }
.rc-art { padding: 18px 22px; border-radius: 16px; background: rgba(20, 16, 11, .7); border: 1px solid rgba(231, 197, 111, .18); }
.rc-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; }
.rc-race { position: relative; display: grid; justify-items: center; gap: 4px; padding: 16px 10px 14px; border-radius: 16px; border: 1px solid rgba(231, 197, 111, .2); background: radial-gradient(circle at 50% 0%, rgba(231, 197, 111, .12), transparent 70%), linear-gradient(180deg, #221b13, #15110c); color: #efe3c8; cursor: pointer; transition: transform .2s, border-color .2s, box-shadow .2s; animation: rc-up .4s ease backwards; animation-delay: calc(var(--i, 0) * 25ms); }
.rc-race:hover { transform: translateY(-3px); border-color: #e7c56f; box-shadow: 0 12px 30px rgba(0, 0, 0, .45), 0 0 20px rgba(231, 197, 111, .15); }
.rc-race b { font: 700 19px 'Cormorant Garamond', serif; color: #f3dc9e; text-align: center; }
.rc-race small { color: #a8936c; font: 700 11.5px 'Manrope', sans-serif; }
.rc-race em { position: absolute; top: 8px; right: 10px; color: #ff9b8f; font: 800 10px 'Manrope', sans-serif; font-style: normal; }
.rc-race.empty { opacity: .55; }
.rc-race.hid { border-style: dashed; }
.rc-race.add { border-style: dashed; color: #e7c56f; font-size: 26px; }
@keyframes rc-up { from { opacity: 0; transform: translateY(8px); } }
.rc-sig { display: grid; place-items: center; width: 52px; height: 52px; border-radius: 50%; border: 2px solid #c9a24f; background: radial-gradient(circle at 35% 30%, #3a2c18, #120d08); font: 700 26px 'Cormorant Garamond', serif; color: #f3dc9e; box-shadow: 0 0 18px rgba(231, 197, 111, .2); flex: none; }
.rc-back { margin-bottom: 10px; padding: 5px 10px; border-radius: 9px; border: 1px solid rgba(231, 197, 111, .25); background: none; color: #f3d99a; font: 700 12.5px 'Manrope', sans-serif; cursor: pointer; }
.rc-hero { display: flex; align-items: center; gap: 14px; margin-bottom: 8px; }
.grow { flex: 1; }
.rc-btn { padding: 6px 12px; border-radius: 9px; border: 1px solid rgba(231, 197, 111, .35); background: rgba(231, 197, 111, .08); color: #f3d99a; font: 700 12.5px 'Manrope', sans-serif; cursor: pointer; }
.rc-intro { margin: 10px 0; padding: 14px 18px; border-radius: 14px; background: rgba(255, 255, 255, .025); border: 1px solid rgba(231, 197, 111, .12); }
.rc-sec { margin-top: 18px; }
.rc-sec h2 { display: flex; align-items: center; gap: 10px; margin: 0 0 10px; font: 700 22px 'Cormorant Garamond', serif; color: #f3dc9e; }
.rc-sec h2 b { display: grid; place-items: center; min-width: 36px; height: 36px; padding: 0 6px; border-radius: 50%; background: linear-gradient(180deg, #f0d083, #b8893f); color: #1b1408; font: 900 16px 'Manrope', sans-serif; box-shadow: 0 0 14px rgba(231, 197, 111, .35); }
.rc-sec h2 small { color: #a8936c; font: 600 12.5px 'Manrope', sans-serif; }
.rc-lv { display: grid; gap: 10px; padding-left: 18px; border-left: 2px solid rgba(231, 197, 111, .2); margin-left: 17px; }
.rc-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px; }
.rc-card { position: relative; padding: 12px 14px; border-radius: 14px; background: rgba(20, 16, 11, .75); border: 1px solid rgba(231, 197, 111, .16); animation: rc-up .35s ease backwards; animation-delay: calc(var(--i, 0) * 40ms); }
.rc-card h3 { display: flex; align-items: center; gap: 8px; margin: 0 0 6px; font: 700 18px 'Cormorant Garamond', serif; color: #f3dc9e; }
.rc-card h3 i { display: grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; border: 1px solid rgba(111, 168, 220, .6); color: #9cc6ec; font: 800 11px 'Manrope', sans-serif; font-style: normal; }
.rc-card :deep(.rh) { font-size: 13.5px; }
.rc-card.auto { border-color: rgba(231, 197, 111, .5); background: linear-gradient(180deg, rgba(231, 197, 111, .1), rgba(20, 16, 11, .8)); box-shadow: 0 0 22px rgba(231, 197, 111, .08); }
.rc-card.opt { border-color: rgba(111, 168, 220, .28); }
.rc-card.base { border-color: rgba(126, 208, 122, .3); }
.rc-tag { display: inline-block; margin-bottom: 6px; padding: 2px 9px; border-radius: 99px; background: rgba(231, 197, 111, .18); color: #f3dc9e; font: 800 10.5px 'Manrope', sans-serif; letter-spacing: .06em; text-transform: uppercase; }
.rc-tag.pick { background: rgba(111, 168, 220, .16); color: #9cc6ec; }
.rc-opts { display: grid; }
@media (max-width: 600px) { .rc-grid { grid-template-columns: 1fr; } .rc-lv { padding-left: 10px; margin-left: 8px; } .rc-head h1, .rc-hero h1 { font-size: 28px; } }
</style>
