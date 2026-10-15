<template>
  <!-- квесты кампании и хроника сюжета: игроки читают, мастер правит -->
  <div class="cp">
    <header class="cp-head">
      <div>
        <h2>Квесты</h2>
        <div class="subtitle-1">Задания, которые встретились героям в Анкарии, и летопись сюжета — глава за главой.</div>
      </div>
      <button v-if="master" class="cp-btn primary" @click="tab === 'quests' ? editQuest({}) : editChapter({})">{{ tab === 'quests' ? '+ Квест' : '+ Глава' }}</button>
    </header>

    <nav class="cp-tabs">
      <button :class="{ on: tab === 'quests' }" @click="tab = 'quests'">Квесты<span>{{ quests.length }}</span></button>
      <button :class="{ on: tab === 'story' }" @click="tab = 'story'">Сюжет<span>{{ chapters.length }}</span></button>
    </nav>

    <!-- ===== Квесты ===== -->
    <template v-if="tab === 'quests'">
      <div class="cp-filters">
        <input v-model="q" placeholder="Поиск: название, место, кто дал…" />
        <select v-model="fStatus">
          <option value="actual">Актуальные</option>
          <option value="">Все статусы</option>
          <option v-for="s in CQ_STATUS" :key="s" :value="s">{{ s }}</option>
        </select>
        <select v-model="fRegion"><option value="">Все регионы</option><option v-for="r in regions" :key="r" :value="r">{{ r }}</option></select>
        <select v-model="fType"><option value="">Любой тип</option><option v-for="t in CQ_TYPES" :key="t" :value="t">{{ TYPE_IC[t] }} {{ t }}</option></select>
        <select v-model="fTaker"><option value="">Кто угодно</option><option value="-">Никто не взял</option><option v-for="t in takers" :key="t" :value="t">{{ t }}</option></select>
      </div>
      <div class="cp-diffs">
        <button v-for="d in CQ_DIFFICULTY" :key="d" type="button" :class="{ on: fDiff.has(d) }" :style="{ '--dc': DIFF[d].color }" @click="toggleDiff(d)">{{ DIFF[d].ic }} {{ d }}</button>
        <span class="grow" />
        <small>{{ shownQuests.length }} из {{ quests.length }}</small>
      </div>

      <div v-if="!shownQuests.length" class="cp-empty">{{ fStatus === 'actual' ? 'Актуальных квестов сейчас нет — загляни в «Все статусы».' : 'Ничего не нашлось.' }}</div>
      <section v-for="g in groups" :key="g.region" class="cp-region">
        <h3><span class="cp-flag" />{{ g.region || 'Без региона' }} <small>{{ g.items.length }}</small></h3>
        <TransitionGroup tag="div" name="cp-card" class="cp-grid">
          <article v-for="it in g.items" :key="it.id" class="cp-q" :class="{ hid: it.hidden, done: DONE.has(it.status) }" :style="{ '--dc': DIFF[it.difficulty]?.color || '#9d978b', '--sc': STATUS[it.status]?.color || '#9d978b' }">
            <header>
              <b class="cp-name">{{ it.name }}</b>
              <span class="cp-st">{{ STATUS[it.status]?.ic }} {{ it.status }}</span>
            </header>
            <div class="cp-tags">
              <span class="cp-diff">{{ DIFF[it.difficulty]?.ic }} {{ it.difficulty }}</span>
              <span v-if="it.type" class="cp-type">{{ TYPE_IC[it.type] }} {{ it.type }}</span>
              <span v-if="it.hidden" class="cp-hidden">👁 скрыт от игроков</span>
            </div>
            <p v-if="it.desc" class="cp-desc">{{ it.desc }}</p>
            <dl class="cp-meta">
              <template v-if="it.location"><dt>📍</dt><dd><router-link v-if="placeTo(it.location)" :to="placeTo(it.location)" title="Показать на карте">{{ it.location }}</router-link><template v-else>{{ it.location }}</template></dd></template>
              <template v-if="it.source"><dt>💬</dt><dd><router-link v-if="npcTo(it.source)" :to="npcTo(it.source)" title="Лист НПС">{{ it.source }}</router-link><template v-else>{{ it.source }}</template></dd></template>
              <template v-if="it.taker"><dt>⚔</dt><dd><router-link v-if="heroTo(it.taker)" :to="heroTo(it.taker)" title="Карточка героя">{{ it.taker }}</router-link><template v-else>{{ it.taker }}</template></dd></template>
            </dl>
            <footer v-if="master" class="cp-acts">
              <button type="button" title="Править" @click="editQuest(it)">✎</button>
              <button type="button" :title="it.hidden ? 'Показать игрокам' : 'Скрыть от игроков'" @click="patch('quests', it, { hidden: !it.hidden })">{{ it.hidden ? '👁' : '🙈' }}</button>
              <button type="button" class="danger" title="Удалить" @click="drop('quests', it, it.name)">✕</button>
            </footer>
          </article>
        </TransitionGroup>
      </section>
    </template>

    <!-- ===== Сюжет ===== -->
    <template v-else>
      <div v-for="v in volumes" :key="v.name" class="cp-vol">
        <h3 class="cp-vol-h">
          <span>{{ v.name }}</span>
          <button v-if="master" type="button" class="cp-mini" title="Переименовать том" @click="renameVolume(v.name)">✎</button>
        </h3>
        <div v-if="!v.acts.length" class="cp-empty small">Глав пока нет{{ master ? ' — добавь первую.' : '.' }}</div>
        <section v-for="a in v.acts" :key="a.name" class="cp-act">
          <h4><span>{{ a.name || 'Без акта' }}</span></h4>
          <ol class="cp-line">
            <li v-for="c in a.items" :key="c.id" :class="[statusCls(c.status), { hid: c.hidden }]">
              <i class="cp-dot" />
              <div class="cp-when">
                <span>{{ c.dateWorld || '—' }}</span>
                <small v-if="c.dateReal">{{ c.dateReal }}</small>
              </div>
              <div class="cp-ch">
                <div class="cp-ch-top">
                  <b>{{ chapterLabel(c.title).label }}</b>
                  <em v-if="chapterLabel(c.title).arc" class="cp-arc">{{ chapterLabel(c.title).arc }}</em>
                  <span v-if="c.status !== 'Завершено'" class="cp-ch-st">{{ c.status }}</span>
                  <span v-if="c.hidden" class="cp-hidden">скрыта</span>
                  <span class="grow" />
                  <template v-if="master">
                    <button type="button" class="cp-mini" title="Править" @click="editChapter(c)">✎</button>
                    <button type="button" class="cp-mini" :title="c.hidden ? 'Показать игрокам' : 'Скрыть от игроков'" @click="patch('chapters', c, { hidden: !c.hidden })">{{ c.hidden ? '👁' : '🙈' }}</button>
                    <button type="button" class="cp-mini danger" title="Удалить" @click="drop('chapters', c, c.title)">✕</button>
                  </template>
                </div>
                <p v-if="c.result">{{ c.result }}</p>
              </div>
            </li>
          </ol>
        </section>
      </div>
      <button v-if="master" type="button" class="cp-btn" @click="addVolume">+ Том</button>
    </template>

    <!-- редактор (мастер) -->
    <div v-if="form" class="cp-back" @pointerdown.self="form = null">
      <form class="cp-dialog" @submit.prevent="save">
        <h3>{{ form.kind === 'quests' ? (form.id ? 'Квест' : 'Новый квест') : (form.id ? 'Глава' : 'Новая глава') }}</h3>
        <template v-if="form.kind === 'quests'">
          <label>Название<input v-model="form.name" required maxlength="160" /></label>
          <div class="cp-row">
            <label>Сложность<select v-model="form.difficulty"><option v-for="d in CQ_DIFFICULTY" :key="d">{{ d }}</option></select></label>
            <label>Тип<select v-model="form.type"><option v-for="t in CQ_TYPES" :key="t">{{ t }}</option></select></label>
            <label>Статус<select v-model="form.status"><option v-for="s in CQ_STATUS" :key="s">{{ s }}</option></select></label>
          </div>
          <div class="cp-row">
            <label>Регион<input v-model="form.region" list="cp-regions" /></label>
            <label>Локация<input v-model="form.location" list="cp-places" placeholder="Город Тасэко" /></label>
          </div>
          <div class="cp-row">
            <label>Кто дал (источник)<input v-model="form.source" list="cp-npcs" /></label>
            <label>Кто взял<input v-model="form.taker" list="cp-heroes" placeholder="Герои / имя героя" /></label>
          </div>
          <label>Описание<textarea v-model="form.desc" rows="3" maxlength="4000" /></label>
        </template>
        <template v-else>
          <label>Название<input v-model="form.title" required maxlength="200" placeholder='Глава 52 Арка "…"' /></label>
          <div class="cp-row">
            <label>Том<input v-model="form.volume" list="cp-vols" /></label>
            <label>Акт<input v-model="form.act" list="cp-acts" placeholder="Акт V" /></label>
            <label>Статус<select v-model="form.status"><option v-for="s in CH_STATUS" :key="s">{{ s }}</option></select></label>
          </div>
          <div class="cp-row">
            <label>Дата в Анкарии<input v-model="form.dateWorld" placeholder="364 лунный виток. Осень" /></label>
            <label>Дата в реале<input v-model="form.dateReal" placeholder="18.10.2026" /></label>
          </div>
          <label>Итог<textarea v-model="form.result" rows="4" maxlength="4000" /></label>
        </template>
        <label class="cp-chk"><input v-model="form.hidden" type="checkbox" /> Скрыть от игроков</label>
        <footer><span class="grow" /><button type="button" class="cp-btn" @click="form = null">Отмена</button><button class="cp-btn primary" :disabled="busy">Сохранить</button></footer>
      </form>
    </div>
    <datalist id="cp-regions"><option v-for="r in regions" :key="r" :value="r" /></datalist>
    <datalist id="cp-places"><option v-for="c in placeNames" :key="c" :value="c" /></datalist>
    <datalist id="cp-npcs"><option v-for="n in npcState.npcs" :key="n.id" :value="n.name" /></datalist>
    <datalist id="cp-heroes"><option value="Герои" /><option v-for="h in store.data.heroes || []" :key="h.id" :value="h.name" /></datalist>
    <datalist id="cp-vols"><option v-for="v in volumes" :key="v.name" :value="v.name" /></datalist>
    <datalist id="cp-acts"><option v-for="a in actNames" :key="a" :value="a" /></datalist>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { store, isMaster, act, npcState, loadNpcs } from '../map/store.js'
import { findPlace, placeLink } from '../shared/npc.js'

const master = isMaster
const CQ_DIFFICULTY = ['Легкий', 'Обычный', 'Сложный', 'Опасный', 'Смертельный']
const CQ_TYPES = ['Деятельность', 'Побочный', 'Сюжетный', 'Гибридный']
const CQ_STATUS = ['Новое', 'Взят', 'Приостановлено', 'Завершен', 'Провален', 'Не актуален']
const CH_STATUS = ['Завершено', 'В процессе', 'Запланировано', 'В разработке']
const DIFF = {
  Легкий: { color: '#7ee06a', ic: '◇' }, Обычный: { color: '#4fd8ff', ic: '◈' }, Сложный: { color: '#ffb36b', ic: '◆' },
  Опасный: { color: '#ff6b5e', ic: '✶' }, Смертельный: { color: '#c47aff', ic: '☠' }
}
const STATUS = {
  Новое: { color: '#ffd166', ic: '✦' }, Взят: { color: '#7cc4ff', ic: '⚑' }, Приостановлено: { color: '#ff9a4e', ic: '⏸' },
  Завершен: { color: '#6fdc8c', ic: '✔' }, Провален: { color: '#ff6b5e', ic: '✖' }, 'Не актуален': { color: '#8a8478', ic: '–' }
}
const TYPE_IC = { Деятельность: '⚒', Побочный: '✧', Сюжетный: '📜', Гибридный: '⚜' }
const ACTUAL = new Set(['Новое', 'Взят', 'Приостановлено'])
const DONE = new Set(['Завершен', 'Провален', 'Не актуален'])

const tab = ref('quests')
const campaign = computed(() => store.data.campaign || { volumes: [], quests: [], chapters: [] })
const quests = computed(() => campaign.value.quests || [])
const chapters = computed(() => campaign.value.chapters || [])

/* ---------- фильтры квестов ---------- */
const q = ref(''), fStatus = ref('actual'), fRegion = ref(''), fType = ref(''), fTaker = ref('')
const fDiff = reactive(new Set())
const toggleDiff = d => (fDiff.has(d) ? fDiff.delete(d) : fDiff.add(d))
const regions = computed(() => [...new Set(quests.value.map(x => x.region).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru')))
const takers = computed(() => [...new Set(quests.value.map(x => x.taker).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru')))
const shownQuests = computed(() => {
  const s = q.value.trim().toLowerCase()
  return quests.value.filter(x =>
    (!s || `${x.name} ${x.desc} ${x.location} ${x.source} ${x.taker} ${x.region}`.toLowerCase().includes(s)) &&
    (!fStatus.value || (fStatus.value === 'actual' ? ACTUAL.has(x.status) : x.status === fStatus.value)) &&
    (!fRegion.value || x.region === fRegion.value) && (!fType.value || x.type === fType.value) &&
    (!fTaker.value || (fTaker.value === '-' ? !x.taker : x.taker === fTaker.value)) &&
    (!fDiff.size || fDiff.has(x.difficulty)))
})
const ORDER = s => { const i = CQ_STATUS.indexOf(s); return i === -1 ? 99 : i }
const groups = computed(() => {
  const by = new Map()
  for (const x of shownQuests.value) {
    if (!by.has(x.region)) by.set(x.region, [])
    by.get(x.region).push(x)
  }
  return [...by].map(([region, items]) => ({ region, items: items.slice().sort((a, b) => ORDER(a.status) - ORDER(b.status) || CQ_DIFFICULTY.indexOf(b.difficulty) - CQ_DIFFICULTY.indexOf(a.difficulty)) }))
    .sort((a, b) => (a.region || 'я').localeCompare(b.region || 'я', 'ru'))
})

/* ---------- связи с сайтом по названиям ---------- */
const norm = s => String(s || '').trim().toLowerCase()
function heroTo(name) {
  const h = (store.data.heroes || []).find(x => norm(x.name) === norm(name))
  return h ? { path: '/wiki', query: { hero: h.id } } : null
}
function npcTo(name) {
  const n = npcState.npcs.find(x => norm(x.name) === norm(name))
  return n ? { path: '/wiki', query: { npc: n.id } } : null
}
const placeTo = name => placeLink(findPlace(name, store.data.cities || [], store.data.settlements || []))
const placeNames = computed(() => [...new Set([...(store.data.cities || []).map(c => c.name), ...quests.value.map(x => x.location)].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru')))

/* ---------- сюжет: Том → Акт → главы ---------- */
const volumes = computed(() => {
  const names = [...(campaign.value.volumes || [])]
  for (const c of chapters.value) if (c.volume && !names.includes(c.volume)) names.push(c.volume)
  return names.map(name => {
    const acts = []
    for (const c of chapters.value.filter(x => x.volume === name || (!x.volume && name === names[0]))) {
      let a = acts.find(x => x.name === c.act)
      if (!a) acts.push(a = { name: c.act, items: [] })
      a.items.push(c)
    }
    return { name, acts }
  })
})
const actNames = computed(() => [...new Set(chapters.value.map(c => c.act).filter(Boolean))])
// «Глава 25 Арка "Тартарос: В путь!"» → «Глава 25» + арка отдельно
function chapterLabel(t) {
  const m = String(t).match(/^(.*?)\s*Арка\s+[«"](.+?)[»"]\s*$/)
  return m ? { label: m[1] || 'Глава', arc: m[2] } : { label: t, arc: '' }
}
const statusCls = s => ({ 'Завершено': 'st-done', 'В процессе': 'st-now', 'Запланировано': 'st-plan', 'В разработке': 'st-dev' }[s] || '')

/* ---------- правка (мастер) ---------- */
const form = ref(null), busy = ref(false)
function editQuest(it) {
  form.value = { kind: 'quests', difficulty: 'Обычный', type: 'Деятельность', status: 'Новое', region: fRegion.value || '', hidden: false, ...it }
}
function editChapter(c) {
  const last = chapters.value[chapters.value.length - 1]
  form.value = { kind: 'chapters', volume: last?.volume || volumes.value[0]?.name || '', act: last?.act || '', status: 'Запланировано', hidden: false, ...c }
}
async function save() {
  const { kind, id, ...body } = form.value
  busy.value = true
  try {
    await act(id ? 'PATCH' : 'POST', id ? `/api/campaign/${kind}/${id}` : `/api/campaign/${kind}`, body, 'Сохранено')
    form.value = null
  } catch { /* тост */ } finally { busy.value = false }
}
const patch = (kind, it, body) => act('PATCH', `/api/campaign/${kind}/${it.id}`, body).catch(() => {})
function drop(kind, it, name) {
  if (confirm(`Удалить «${name}»? Отменить нельзя.`)) act('DELETE', `/api/campaign/${kind}/${it.id}`, undefined, 'Удалено').catch(() => {})
}
async function renameVolume(old) {
  const name = prompt('Название тома', old)?.trim()
  if (!name || name === old) return
  const vols = (campaign.value.volumes || []).map(v => (v === old ? name : v))
  try {
    await act('PATCH', '/api/campaign/volumes', { volumes: vols })
    for (const c of chapters.value.filter(x => x.volume === old)) await act('PATCH', `/api/campaign/chapters/${c.id}`, { volume: name })
  } catch { /* тост */ }
}
function addVolume() {
  const name = prompt('Название нового тома', `Том ${(campaign.value.volumes || []).length + 1}: `)?.trim()
  if (name) act('PATCH', '/api/campaign/volumes', { volumes: [...(campaign.value.volumes || []), name] }, 'Том добавлен').catch(() => {})
}

onMounted(() => loadNpcs())
</script>

<style scoped>
.cp-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; margin-bottom: 14px; flex-wrap: wrap; }
.cp-tabs { display: flex; gap: 4px; margin-bottom: 14px; border-bottom: 1px solid rgba(231, 197, 111, .2); }
.cp-tabs button { display: flex; gap: 6px; align-items: center; padding: 8px 14px; border: 0; border-bottom: 2px solid transparent; background: none; color: #9d978b; font: 700 14px 'Manrope', sans-serif; cursor: pointer; }
.cp-tabs button.on { color: #f3dc9e; border-color: #e7c56f; }
.cp-tabs span { padding: 0 7px; border-radius: 99px; background: rgba(231, 197, 111, .18); color: #f3dc9e; font-size: 11px; }
.cp-filters { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; }
.cp-filters input, .cp-filters select, .cp-dialog input, .cp-dialog select, .cp-dialog textarea {
  min-height: 36px; padding: 6px 10px; border-radius: 9px; border: 1px solid rgba(255, 255, 255, .1); background: rgba(0, 0, 0, .3); color: #ece6da; font: 500 13px 'Manrope', sans-serif; box-sizing: border-box; min-width: 0;
}
.cp-filters input { flex: 1 1 220px; }
.cp-diffs { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-bottom: 16px; }
.cp-diffs button { padding: 4px 11px; border-radius: 99px; border: 1px solid color-mix(in srgb, var(--dc) 45%, transparent); background: none; color: var(--dc); font: 700 12px 'Manrope', sans-serif; cursor: pointer; transition: background .15s; }
.cp-diffs button.on { background: color-mix(in srgb, var(--dc) 20%, transparent); box-shadow: 0 0 10px color-mix(in srgb, var(--dc) 35%, transparent); }
.cp-diffs small { color: #9d978b; font: 600 12px 'Manrope', sans-serif; }
.grow { flex: 1; }
.cp-empty { padding: 36px; text-align: center; color: #9d978b; border: 1px dashed rgba(255, 255, 255, .12); border-radius: 14px; }
.cp-empty.small { padding: 16px; }
.cp-btn { padding: 9px 16px; border-radius: 10px; border: 1px solid rgba(255, 255, 255, .12); background: rgba(255, 255, 255, .05); color: #ece6da; font: 700 13px 'Manrope', sans-serif; cursor: pointer; }
.cp-btn.primary { border: 0; background: linear-gradient(180deg, #f0d083, #c9a24f); color: #1b1408; }

.cp-region { margin-bottom: 22px; }
.cp-region h3 { display: flex; align-items: center; gap: 10px; margin: 0 0 10px; font: 700 22px 'Cormorant Garamond', serif; color: #e6c27a; }
.cp-region h3 small { font: 700 12px 'Manrope', sans-serif; color: #9d978b; }
.cp-flag { width: 10px; height: 18px; background: linear-gradient(#e7c56f, #b8893f); clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 75%, 0 100%); }
.cp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr)); gap: 12px; }
.cp-q { position: relative; display: grid; gap: 8px; align-content: start; padding: 12px 14px 12px 16px; border-radius: 14px; background: linear-gradient(180deg, rgba(255, 255, 255, .045), rgba(255, 255, 255, .02)); border: 1px solid rgba(255, 255, 255, .07); box-shadow: 0 10px 24px rgba(0, 0, 0, .25); overflow: hidden; transition: transform .2s, border-color .2s, box-shadow .2s; }
.cp-q::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: var(--dc); box-shadow: 0 0 12px var(--dc); }
.cp-q:hover { transform: translateY(-2px); border-color: color-mix(in srgb, var(--dc) 40%, transparent); box-shadow: 0 14px 30px rgba(0, 0, 0, .35), 0 0 20px color-mix(in srgb, var(--dc) 15%, transparent); }
.cp-q.done { opacity: .72; }
.cp-q.hid { border-style: dashed; }
.cp-q header { display: flex; align-items: flex-start; gap: 8px; }
.cp-name { flex: 1; font: 700 18px/1.2 'Cormorant Garamond', serif; color: #f3dc9e; }
.cp-st { flex: none; padding: 2px 9px; border-radius: 99px; background: color-mix(in srgb, var(--sc) 18%, transparent); border: 1px solid color-mix(in srgb, var(--sc) 45%, transparent); color: var(--sc); font: 800 11px 'Manrope', sans-serif; white-space: nowrap; }
.cp-tags { display: flex; flex-wrap: wrap; gap: 6px; font: 700 11.5px 'Manrope', sans-serif; }
.cp-diff { color: var(--dc); }
.cp-type { color: #c9bfa8; }
.cp-hidden { color: #b9a6ff; font: 700 11px 'Manrope', sans-serif; }
.cp-desc { margin: 0; color: #d9d2c3; font: 500 13.5px/1.5 'Manrope', sans-serif; }
.cp-meta { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 3px 8px; margin: 0; font: 600 12.5px 'Manrope', sans-serif; color: #b9b1a1; }
.cp-meta dt { opacity: .8; }
.cp-meta dd { margin: 0; overflow-wrap: anywhere; }
.cp-meta a { color: #8fc7ff; text-decoration: none; border-bottom: 1px dotted rgba(143, 199, 255, .5); }
.cp-meta a:hover { color: #bfe0ff; }
.cp-acts { display: flex; gap: 4px; justify-content: flex-end; }
.cp-acts button, .cp-mini { width: 28px; height: 26px; border-radius: 7px; border: 1px solid rgba(255, 255, 255, .1); background: rgba(0, 0, 0, .2); color: #d9d2c3; cursor: pointer; font-size: 12px; }
.cp-acts .danger:hover, .cp-mini.danger:hover { color: #ff9b8f; border-color: rgba(255, 122, 107, .5); }
.cp-card-enter-active, .cp-card-leave-active { transition: opacity .25s, transform .25s; }
.cp-card-enter-from, .cp-card-leave-to { opacity: 0; transform: translateY(8px) scale(.98); }

/* сюжет */
.cp-vol { margin-bottom: 26px; }
.cp-vol-h { display: flex; align-items: center; gap: 10px; margin: 0 0 12px; font: 700 28px 'Cormorant Garamond', serif; color: #f3dc9e; }
.cp-vol-h::after { content: ''; flex: 1; height: 1px; background: linear-gradient(90deg, rgba(231, 197, 111, .45), transparent); }
.cp-act { margin: 0 0 16px 6px; }
.cp-act h4 { margin: 0 0 8px; font: 800 12px 'Manrope', sans-serif; letter-spacing: .2em; text-transform: uppercase; color: #c9a24f; }
.cp-line { position: relative; list-style: none; margin: 0; padding: 0 0 0 22px; display: grid; gap: 8px; }
.cp-line::before { content: ''; position: absolute; left: 6px; top: 6px; bottom: 6px; width: 2px; background: linear-gradient(rgba(231, 197, 111, .45), rgba(231, 197, 111, .12)); }
.cp-line li { position: relative; display: grid; grid-template-columns: 170px minmax(0, 1fr); gap: 14px; padding: 10px 12px; border-radius: 12px; background: rgba(255, 255, 255, .03); border: 1px solid rgba(255, 255, 255, .05); }
.cp-line li.hid { border-style: dashed; opacity: .7; }
.cp-dot { position: absolute; left: -21px; top: 15px; width: 12px; height: 12px; border-radius: 50%; background: #6fdc8c; border: 2px solid #0d1017; box-shadow: 0 0 0 1px rgba(111, 220, 140, .4); }
.st-now .cp-dot { background: #ffd166; box-shadow: 0 0 0 3px rgba(255, 209, 102, .25), 0 0 14px #ffd166; animation: cp-pulse 1.8s ease-in-out infinite; }
.st-now { border-color: rgba(255, 209, 102, .35) !important; background: rgba(255, 209, 102, .06) !important; }
.st-plan .cp-dot { background: #7cc4ff; }
.st-dev .cp-dot { background: #8a8478; }
@keyframes cp-pulse { 50% { box-shadow: 0 0 0 6px rgba(255, 209, 102, .1), 0 0 22px #ffd166; } }
.cp-when { display: grid; align-content: start; gap: 2px; font: 700 12px 'Manrope', sans-serif; color: #c9bfa8; }
.cp-when small { color: #8a8478; font-weight: 600; }
.cp-ch-top { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.cp-ch-top b { font: 700 15px 'Manrope', sans-serif; color: #f3dc9e; }
.cp-arc { font: italic 600 16px 'Cormorant Garamond', serif; color: #e6c27a; }
.cp-ch-st { padding: 1px 8px; border-radius: 99px; background: rgba(124, 196, 255, .15); color: #9fd2ff; font: 800 11px 'Manrope', sans-serif; }
.st-now .cp-ch-st { background: rgba(255, 209, 102, .18); color: #ffd166; }
.cp-ch p { margin: 4px 0 0; color: #d9d2c3; font: 500 13.5px/1.55 'Manrope', sans-serif; }

/* редактор */
.cp-back { position: fixed; inset: 0; z-index: 600; display: grid; place-items: center; padding: 16px; background: rgba(5, 4, 3, .7); }
.cp-dialog { width: min(640px, 100%); max-height: calc(100vh - 32px); overflow-y: auto; display: grid; gap: 10px; padding: 18px; border-radius: 16px; background: linear-gradient(180deg, #1d1912, #14110c); border: 1px solid #8a6630; box-shadow: 0 30px 80px rgba(0, 0, 0, .7); color: #ece6da; }
.cp-dialog h3 { margin: 0; font: 700 22px 'Cormorant Garamond', serif; color: #f3dc9e; }
.cp-dialog label { display: grid; gap: 4px; font: 700 12px 'Manrope', sans-serif; color: #9d978b; min-width: 0; }
.cp-dialog textarea { resize: vertical; }
.cp-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
.cp-chk { display: flex !important; align-items: center; gap: 6px; }
.cp-dialog footer { display: flex; gap: 8px; }
@media (max-width: 600px) { .cp-line li { grid-template-columns: minmax(0, 1fr); gap: 4px; } }
</style>
