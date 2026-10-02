<template>
  <div class="qb">
    <header class="qb-head">
      <div>
        <h2>Заказы гильдий</h2>
        <div class="subtitle-1">Доска объявлений авантюристов Анкарии. Откликайся — распорядитель гильдии (мастер) решит, кто пойдёт.</div>
      </div>
      <button v-if="master" class="qb-btn primary" @click="edit({})">+ Новый заказ</button>
    </header>

    <nav class="qb-tabs">
      <button v-for="t in TABS" :key="t.id" :class="{ on: tab === t.id }" @click="tab = t.id">{{ t.label }}<span v-if="t.count">{{ t.count }}</span></button>
    </nav>

    <!-- ===== Доска ===== -->
    <template v-if="tab === 'board'">
      <div class="qb-filters">
        <select v-model="fGuild"><option value="">Все гильдии</option><option v-for="g in GUILDS" :key="g.name" :value="g.name">{{ g.name }}</option></select>
        <select v-model="fRank"><option value="">Любой ранг</option><option v-for="r in RANKS" :key="r.key" :value="r.key">{{ r.label }}</option></select>
        <select v-model="fStatus">
          <option value="active">Доступные и в работе</option>
          <option value="">Все</option>
          <option v-for="(s, k) in QUEST_STATUS" :key="k" :value="k">{{ s.label }}</option>
        </select>
        <input v-model="fText" placeholder="Поиск по заказам…" />
      </div>

      <div v-if="!store.ready" class="qb-empty">Загружаем доску…</div>
      <div v-else-if="!board.length" class="qb-empty">На доске пусто{{ master ? ' — вывеси первый заказ.' : '. Загляни позже.' }}</div>
      <div v-else class="qb-wood">
        <QuestNote v-for="q in board" :key="q.id" :q="q" :master="master"
                   @edit="edit" @apply="apply = { q, name: store.nick || '', note: '' }" @map="showOnMap"
                   @roll="roll" @accept="accept" @reject="reject" />
      </div>
    </template>

    <!-- ===== Хроника ===== -->
    <template v-if="tab === 'chronicle'">
      <div v-if="!chronicle.length" class="qb-empty">Хроника пока пуста — здесь появятся завершённые заказы.</div>
      <ol class="chron">
        <li v-for="q in chronicle" :key="q.id" :class="'c-' + q.status">
          <div class="c-date">{{ fmtDate(q.completedAt) }}</div>
          <div class="c-body">
            <div class="c-top">
              <img v-if="q.result" :src="`/icons/${QUEST_RESULT[q.result].img}.png`" alt="" />
              <b>{{ q.type }}</b> · {{ q.guild }}
              <span class="c-st" :style="{ background: QUEST_STATUS[q.status].color }">{{ QUEST_STATUS[q.status].label }}</span>
              <span v-if="questRep(q)" class="c-rep" :class="questRep(q) > 0 ? 'up' : 'down'">{{ questRep(q) > 0 ? '+' : '' }}{{ questRep(q) }} реп.</span>
            </div>
            <div v-if="q.group.length" class="c-group">Группа: {{ q.group.map(m => m.name).filter(Boolean).join(', ') }}</div>
            <p v-if="q.report || q.closedReason">{{ q.report || q.closedReason }}</p>
          </div>
        </li>
      </ol>
    </template>

    <!-- ===== Гильдии ===== -->
    <template v-if="tab === 'guilds'">
      <div class="guilds">
        <div v-for="g in guilds" :key="g.name" class="guild" :style="{ '--g': g.color }">
          <div class="g-seal">{{ g.name[0] }}</div>
          <div class="g-main">
            <div class="g-name">{{ g.name }}</div>
            <div class="g-country">{{ g.country }}</div>
            <div class="g-tier" :style="{ color: g.tier.color }">{{ g.tier.label }} · {{ g.rep }}</div>
            <div class="g-bar"><i :style="{ width: g.progress * 100 + '%', background: g.tier.color }" /></div>
            <div class="g-next">{{ g.next ? `до «${g.next.label}»: ${g.next.min - g.rep}` : 'Высшее признание' }}</div>
            <div class="g-stats">
              <span>📜 открыто {{ g.open }}</span><span>✔ выполнено {{ g.done }}</span><span>✘ провалено {{ g.failed }}</span>
            </div>
            <div v-if="master" class="g-adj">
              Поправка мастера
              <input type="number" :value="store.data.guildRep?.[g.name] || 0" @change="adjustRep(g.name, $event.target.value)" />
            </div>
          </div>
        </div>
      </div>
      <p class="qb-note">Репутация считается сама: выполненный заказ с наградой «репутация гильдии» даёт +10 (+5 за доп. награду, +2 за каждый череп опасности), проваленный — минус столько же. Мастер может добавить поправку.</p>
    </template>

    <!-- Отклик игрока -->
    <div v-if="apply" class="qb-modal" @mousedown.self="apply = null">
      <form class="qb-dialog" @submit.prevent="sendApply">
        <div class="qe-kicker">Отклик на заказ</div>
        <h3>{{ apply.q.type }} · {{ apply.q.guild }}</h3>
        <label>Имя персонажа<input v-model="apply.name" maxlength="40" required autofocus /></label>
        <label>Пара слов распорядителю (необязательно)<textarea v-model="apply.note" maxlength="300" rows="3" placeholder="Раса, класс, уровень, чем полезен" /></label>
        <div class="qb-actions">
          <button type="button" class="qb-btn" @click="apply = null">Отмена</button>
          <button type="submit" class="qb-btn primary" :disabled="sending">Откликнуться</button>
        </div>
      </form>
    </div>

    <QuestEditor v-if="editing" :quest="editing" :busy="sending" @close="editing = null" @save="save" @delete="remove" @pick-on-map="pickOnMap" />
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import QuestNote from './QuestNote.vue'
import QuestEditor from './QuestEditor.vue'
import { store, isMaster, init, act, api, toast, setNick } from '../map/store.js'
import { GUILDS, RANKS, QUEST_STATUS, QUEST_RESULT, MAX_GROUP } from '../shared/catalog.js'
import { URGENCY, guildStats, questRep } from '../shared/quests.js'

const route = useRoute()
const router = useRouter()
const master = isMaster
onMounted(init)

const tab = ref('board')
const fGuild = ref('')
const fRank = ref('')
const fStatus = ref('active')
const fText = ref('')

const quests = computed(() => store.data.quests || [])
const URG_ORDER = Object.keys(URGENCY).reverse()
const board = computed(() => {
  const t = fText.value.trim().toLowerCase()
  return quests.value
    .filter(q => !fGuild.value || q.guild === fGuild.value)
    .filter(q => !fRank.value || q.rank === fRank.value)
    .filter(q => (fStatus.value === 'active' ? ['available', 'taken'].includes(q.status) : !fStatus.value || q.status === fStatus.value))
    .filter(q => !t || [q.type, q.description, q.guild, ...q.tasks.map(x => x.text)].join(' ').toLowerCase().includes(t))
    // сверху — срочные и свежие
    .sort((a, b) => URG_ORDER.indexOf(a.urgency) - URG_ORDER.indexOf(b.urgency) || (b.postedAt || 0) - (a.postedAt || 0))
})
const chronicle = computed(() => quests.value.filter(q => ['done', 'failed', 'closed'].includes(q.status)).sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0)))
const guilds = computed(() => guildStats(quests.value, store.data.guildRep || {}))

const TABS = computed(() => [
  { id: 'board', label: 'Доска', count: quests.value.filter(q => q.status === 'available').length },
  { id: 'chronicle', label: 'Хроника', count: chronicle.value.length },
  { id: 'guilds', label: 'Гильдии и репутация' }
])

const fmtDate = ms => (ms ? new Date(ms).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—')

/* ---------- мастер ---------- */
const editing = ref(null)
const sending = ref(false)
const edit = q => { editing.value = q }

async function save(q) {
  sending.value = true
  const { id, applicants, applicantsCount, completedAt, createdAt, ...body } = q
  try {
    if (id) await act('PATCH', `/api/quests/${id}`, body, 'Заказ обновлён')
    else await act('POST', '/api/quests', body, 'Заказ вывешен на доску')
    editing.value = null
  } catch { /* тост */ } finally {
    sending.value = false
  }
}

async function remove(q) {
  if (!confirm('Снять заказ с доски насовсем? Он пропадёт и из хроники.')) return
  await act('DELETE', `/api/quests/${q.id}`, undefined, 'Заказ удалён').catch(() => {})
  editing.value = null
}

async function roll(q) {
  try {
    const r = await api('POST', `/api/quests/${q.id}/roll`, {})
    toast(`d100 = ${r.roll} против ${r.chance.toFixed(0)}% — ${r.closed ? 'заказ забрала другая группа!' : 'заказ остаётся на доске'}`, r.closed ? 'error' : 'info')
  } catch (e) { toast(e.message, 'error') }
}

async function accept(q, a) {
  if (q.group.length >= MAX_GROUP) return toast(`В группе уже ${MAX_GROUP}`, 'error')
  await act('PATCH', `/api/quests/${q.id}`, {
    group: [...q.group, { name: a.name, icon: '' }],
    applicants: q.applicants.filter(x => x.id !== a.id)
  }, `${a.name} в группе`).catch(() => {})
}
const reject = (q, a) => act('PATCH', `/api/quests/${q.id}`, { applicants: q.applicants.filter(x => x.id !== a.id) }).catch(() => {})

const adjustRep = (guild, value) => act('PATCH', '/api/guild-rep', { guild, value: Number(value) || 0 }, 'Репутация обновлена').catch(() => {})

/* ---------- игрок ---------- */
const apply = ref(null)
async function sendApply() {
  sending.value = true
  try {
    await api('POST', `/api/quests/${apply.value.q.id}/apply`, { name: apply.value.name, note: apply.value.note })
    setNick(apply.value.name)
    toast('Отклик отправлен — распорядитель рассмотрит')
    apply.value = null
  } catch (e) { toast(e.message, 'error') } finally {
    sending.value = false
  }
}

/* ---------- карта ---------- */
const showOnMap = q => router.push({ path: '/', query: { focus: 'quests:' + q.id } })
function pickOnMap(q) {
  editing.value = null
  router.push({ path: '/', query: { pick: 'quest:' + q.id } })
}

// /wiki?quest=ID — открыть заказ (например, после выбора точки на карте)
watch(() => [route.query.quest, store.ready, master.value], () => {
  const id = route.query.quest
  if (!id || !store.ready) return
  const q = quests.value.find(x => x.id === id)
  if (q && master.value) editing.value = q
  router.replace({ query: {} })
}, { immediate: true })
</script>

<style scoped>
.qb-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; margin-bottom: 14px; flex-wrap: wrap; }
.qb-tabs { display: flex; gap: 4px; margin-bottom: 14px; border-bottom: 1px solid rgba(231, 197, 111, .2); }
.qb-tabs button { background: none; border: 0; border-bottom: 2px solid transparent; color: #9d978b; padding: 8px 14px; font: 700 14px 'Manrope', sans-serif; cursor: pointer; display: flex; gap: 6px; align-items: center; }
.qb-tabs button.on { color: #f3dc9e; border-color: #e7c56f; }
.qb-tabs span { background: rgba(231, 197, 111, .18); color: #f3dc9e; border-radius: 99px; padding: 0 7px; font-size: 11px; }
.qb-filters { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
.qb-filters select, .qb-filters input, .qb-dialog input, .qb-dialog textarea, .g-adj input {
  min-height: 36px; padding: 6px 10px; border-radius: 9px; border: 1px solid rgba(255, 255, 255, .1); background: rgba(0, 0, 0, .3); color: #ece6da; font: 500 13px 'Manrope', sans-serif;
}
.qb-filters select option { background: #141a24; }
.qb-filters input { flex: 1; min-width: 180px; }
.qb-empty { padding: 40px; text-align: center; color: #9d978b; border: 1px dashed rgba(255, 255, 255, .12); border-radius: 14px; }
.qb-btn { border: 1px solid rgba(255, 255, 255, .12); background: rgba(255, 255, 255, .05); color: #ece6da; border-radius: 10px; padding: 9px 16px; font: 700 13px 'Manrope', sans-serif; cursor: pointer; }
.qb-btn.primary { background: linear-gradient(180deg, #f0d083, #c9a24f); color: #1b1408; border: 0; }

/* деревянная доска */
.qb-wood {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 26px 22px; padding: 30px 24px;
  border-radius: 12px; border: 10px solid #3b2615;
  background:
    repeating-linear-gradient(90deg, rgba(0, 0, 0, .12) 0 2px, transparent 2px 120px),
    repeating-linear-gradient(0deg, rgba(255, 255, 255, .03) 0 1px, transparent 1px 7px),
    linear-gradient(180deg, #6e4a2a, #5a3b20);
  box-shadow: inset 0 0 40px rgba(0, 0, 0, .55), 0 18px 40px rgba(0, 0, 0, .4);
}

.chron { list-style: none; padding: 0; margin: 0; display: grid; gap: 10px; }
.chron li { display: grid; grid-template-columns: 120px 1fr; gap: 14px; padding: 12px 14px; border-radius: 12px; background: rgba(255, 255, 255, .03); border-left: 3px solid #2a72f0; }
.chron li.c-failed { border-color: #c21d1d; }
.chron li.c-closed { border-color: #5d6470; }
.c-date { color: #9d978b; font-size: 12.5px; }
.c-top { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.c-top img { width: 20px; height: 20px; }
.c-st { color: #fff; font-size: 11px; font-weight: 800; padding: 1px 8px; border-radius: 99px; }
.c-rep { font-size: 12px; font-weight: 800; }
.c-rep.up { color: #7ee0a3; }
.c-rep.down { color: #ff8a7a; }
.c-group { font-size: 12.5px; color: #c9c2b4; margin-top: 4px; }
.chron p { margin: 6px 0 0; font-style: italic; color: #d4cdbf; }

.guilds { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
.guild { display: flex; gap: 12px; padding: 14px; border-radius: 14px; background: rgba(255, 255, 255, .03); border: 1px solid rgba(255, 255, 255, .07); }
.g-seal { width: 44px; height: 44px; flex: none; border-radius: 50%; display: grid; place-items: center; font: 700 22px 'Cormorant Garamond', Georgia, serif; color: rgba(255, 255, 255, .9); background: radial-gradient(circle at 35% 30%, color-mix(in srgb, var(--g) 70%, white), var(--g) 55%, color-mix(in srgb, var(--g) 55%, black)); box-shadow: 0 3px 6px rgba(0, 0, 0, .4); }
.g-main { flex: 1; min-width: 0; display: grid; gap: 3px; }
.g-name { font: 700 19px 'Cormorant Garamond', Georgia, serif; color: #f3dc9e; }
.g-country { font-size: 12px; color: #9d978b; }
.g-tier { font-weight: 800; font-size: 13px; margin-top: 4px; }
.g-bar { height: 7px; border-radius: 99px; background: rgba(255, 255, 255, .08); overflow: hidden; }
.g-bar i { display: block; height: 100%; }
.g-next { font-size: 11.5px; color: #9d978b; }
.g-stats { display: flex; gap: 10px; flex-wrap: wrap; font-size: 12px; margin-top: 4px; }
.g-adj { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #9d978b; margin-top: 6px; }
.g-adj input { width: 80px; min-height: 30px; }
.qb-note { margin-top: 14px; font-size: 12.5px; color: #9d978b; }

.qb-modal { position: fixed; inset: 0; z-index: 100; background: rgba(5, 7, 11, .65); display: grid; place-items: center; padding: 16px; }
.qb-dialog { width: min(420px, 100%); background: #141a24; border: 1px solid rgba(231, 197, 111, .25); border-radius: 16px; padding: 20px; display: grid; gap: 10px; }
.qb-dialog h3 { margin: 0 0 4px; font: 700 24px 'Cormorant Garamond', Georgia, serif; color: #f3dc9e; }
.qb-dialog label { display: grid; gap: 4px; font-size: 12px; font-weight: 700; color: #9d978b; }
.qe-kicker { font-size: 11px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: #9d978b; }
.qb-actions { display: flex; justify-content: flex-end; gap: 8px; }
@media (max-width: 600px) {
  .qb-wood { padding: 18px 12px; border-width: 6px; grid-template-columns: 1fr; }
  .chron li { grid-template-columns: 1fr; gap: 4px; }
}
</style>
