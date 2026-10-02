<template>
  <article class="note" :class="['st-' + q.status, { hidden: q.hidden }]" :style="{ '--tilt': tilt + 'deg', '--guild': guild.color }">
    <i class="pin" />
    <header class="n-head">
      <span class="n-guild">{{ q.guild }}</span>
      <span class="n-kind">Заказ</span>
      <span class="n-guild">{{ guild.country }}</span>
    </header>

    <div v-if="urgent" class="ribbon" :style="{ background: urg.color }">{{ urg.label }}</div>

    <h3 class="n-type">{{ q.type }}</h3>
    <div v-if="q.tags?.length" class="n-tags">
      <span v-for="t in q.tags" :key="t" class="n-tag" :style="{ borderColor: QUEST_TAGS[t]?.color, color: QUEST_TAGS[t]?.color }">{{ QUEST_TAGS[t]?.label }}</span>
    </div>

    <p class="n-desc">{{ q.description || 'Подробности у распорядителя гильдии.' }}</p>
    <dl class="n-terms">
      <div v-if="q.duration"><dt>Длительность</dt><dd>{{ durationText }}</dd></div>
      <div><dt>Основная награда</dt><dd>{{ rewardText(q.reward) || '—' }}</dd></div>
      <div v-if="rewardText(q.bonus)"><dt>Дополнительная награда</dt><dd>{{ rewardText(q.bonus) }}</dd></div>
    </dl>

    <ul v-if="q.tasks?.length" class="n-tasks">
      <li v-for="(t, i) in q.tasks" :key="i" :class="{ main: t.main, ['ts-' + t.status]: true }">
        <img v-if="TASK_STATUS[t.status]?.img" :src="`/icons/${TASK_STATUS[t.status].img}.png`" alt="" :title="TASK_STATUS[t.status].label" />
        <i v-else class="info-dot" title="В процессе">i</i>
        <span><b>{{ t.main ? 'Основная задача' : 'Дополнительная задача' }}:</b> {{ t.text }}</span>
      </li>
    </ul>

    <div class="n-scales">
      <div class="scale">
        <span>Опасность</span>
        <div class="boxes">
          <i v-for="n in 3" :key="n" class="box"><img v-if="n <= q.danger" :src="`/icons/${dangerIcon}.png`" alt="" /></i>
        </div>
      </div>
      <div class="scale right">
        <div class="boxes rtl">
          <i v-for="n in 3" :key="n" class="box"><img v-if="n <= q.difficulty" :src="`/icons/${q.difficulty >= 3 ? 'warn-red' : 'warn-yellow'}.png`" alt="" /></i>
        </div>
        <span>Сложность</span>
      </div>
    </div>

    <div class="n-rank">
      <span>Минимальный ранг</span>
      <b :style="{ background: rank.color, color: rank.text }">{{ rank.label }}</b>
    </div>

    <div class="n-bottom">
      <div class="n-group">
        <span>Группа</span>
        <div class="slots">
          <i v-for="n in MAX_GROUP" :key="n" class="slot" :title="q.group[n - 1]?.name || 'Свободно'">
            <img v-if="memberImg(q.group[n - 1])" :src="memberImg(q.group[n - 1])" alt="" />
            <b v-else-if="q.group[n - 1]">{{ initials(q.group[n - 1].name) }}</b>
          </i>
        </div>
      </div>
      <div class="n-status" :style="{ background: status.color }">
        <i class="seal" :title="q.guild">{{ q.guild[0] }}</i>
        {{ status.label }}
        <small v-if="!master && q.status === 'available' && q.applicantsCount">откликов: {{ q.applicantsCount }}</small>
      </div>
    </div>

    <!-- итог: штамп и отчёт -->
    <div v-if="stamp" class="stamp" :class="'stamp-' + q.status">
      <img v-if="q.result" :src="`/icons/${QUEST_RESULT[q.result].img}.png`" alt="" />{{ stamp }}
    </div>
    <div v-if="q.report || q.closedReason" class="n-report">
      <b>{{ q.status === 'closed' ? 'Заказ снят' : 'Отчёт' }}:</b> {{ q.report || q.closedReason }}
    </div>


    <footer class="n-actions">
      <button v-if="q.loc" class="n-btn" @click="$emit('map', q)">🗺 На карте</button>
      <button v-if="!master && q.status === 'available'" class="n-btn primary" @click="$emit('apply', q)">Откликнуться</button>
      <template v-if="master">
        <button class="n-btn" @click="$emit('edit', q)">✎ Изменить</button>
      </template>
    </footer>

    <!-- мастеру: таймер, шанс досрочного закрытия, заявки -->
    <section v-if="master && hasMasterInfo" class="n-master">
      <div v-if="q.hidden" class="m-line warn">Скрыт от игроков</div>
      <div v-if="q.expiresAt && q.status === 'available'" class="m-line">⏳ Истекает через <b>{{ fmtLeft(q.expiresAt - now) }}</b></div>
      <div v-if="q.early?.enabled && q.status === 'available'" class="m-chance">
        <div class="m-line">
          🎲 Шанс досрочного закрытия: <b>{{ chance.toFixed(0) }}%</b>
          <span v-if="q.early.auto" class="m-muted"> · авто-бросок через {{ fmtLeft(nextRollAt(q) - now) }}</span>
        </div>
        <div class="m-bar"><i :style="{ width: chance + '%', background: urg.color }" /></div>
        <button class="n-btn small" @click="$emit('roll', q)">Бросить d100 сейчас</button>
        <div v-if="lastRoll" class="m-muted">Последний бросок: {{ lastRoll.roll }} против {{ lastRoll.chance }}% — {{ lastRoll.closed ? 'закрыт' : 'устоял' }}</div>
      </div>
      <div v-if="q.applicants?.length" class="m-apps">
        <div class="m-line">Отклики ({{ q.applicants.length }}):</div>
        <div v-for="a in q.applicants" :key="a.id" class="m-app">
          <span><b>{{ a.name }}</b><em v-if="a.note"> — {{ a.note }}</em></span>
          <button class="n-btn small ok" :disabled="q.group.length >= MAX_GROUP" title="В группу" @click="$emit('accept', q, a)">✓</button>
          <button class="n-btn small no" title="Отклонить" @click="$emit('reject', q, a)">✕</button>
        </div>
      </div>
    </section>
  </article>
</template>

<script setup>
import { computed } from 'vue'
import { GUILDS, RANKS, QUEST_STATUS, TASK_STATUS, QUEST_RESULT, MAX_GROUP } from '../shared/catalog.js'
import { URGENCY, QUEST_TAGS, earlyChance, nextRollAt, rewardText } from '../shared/quests.js'
import { store } from '../map/store.js'

const props = defineProps({ q: { type: Object, required: true }, master: Boolean })
defineEmits(['edit', 'apply', 'map', 'roll', 'accept', 'reject'])

const now = computed(() => store.now)
const guild = computed(() => GUILDS.find(g => g.name === props.q.guild) || GUILDS[0])
const rank = computed(() => RANKS.find(r => r.key === props.q.rank) || RANKS[0])
const status = computed(() => QUEST_STATUS[props.q.status] || QUEST_STATUS.available)
const urg = computed(() => URGENCY[props.q.urgency] || URGENCY.normal)
const urgent = computed(() => ['high', 'critical'].includes(props.q.urgency) && props.q.status === 'available')
const dangerIcon = computed(() => ['thunder-skull', 'thunder-skull', 'thunder-skull_1', 'thunder-skull_2'][props.q.danger] || 'thunder-skull')
const chance = computed(() => earlyChance(props.q, now.value))
const hasMasterInfo = computed(() => props.q.hidden || props.q.applicants?.length ||
  (props.q.status === 'available' && (props.q.expiresAt || props.q.early?.enabled)))
const lastRoll = computed(() => props.q.early?.history?.[props.q.early.history.length - 1])

// каждый листок слегка повёрнут — по id, чтобы не прыгал при обновлении
const tilt = computed(() => {
  let h = 0
  for (const ch of props.q.id) h = (h * 31 + ch.charCodeAt(0)) | 0
  return ((Math.abs(h) % 9) - 4) * 0.35
})

const durationText = computed(() => {
  const h = props.q.duration
  return h >= 48 && h % 24 === 0 ? `${h / 24} дн. (${h} ч)` : `${h} ч`
})

const STAMPS = { done: 'Выполнено', failed: 'Провалено', closed: 'Снят' }
const stamp = computed(() => STAMPS[props.q.status] || '')

function memberImg(m) {
  if (!m?.icon?.startsWith('u:')) return null
  const ic = store.data.icons.find(i => i.id === m.icon.slice(2))
  return ic ? `/usericons/${ic.file}` : null
}
const initials = n => (n || '?').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()

function fmtLeft(ms) {
  if (ms <= 0) return 'сейчас'
  const m = Math.round(ms / 60000)
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60)
  return d ? `${d} д ${h} ч` : h ? `${h} ч ${m % 60} мин` : `${m} мин`
}
</script>

<style scoped>
.note {
  position: relative; transform: rotate(var(--tilt)); padding: 22px 18px 14px; color: #2b2116;
  background:
    radial-gradient(120% 90% at 30% 10%, rgba(255, 255, 255, 0.35), transparent 60%),
    radial-gradient(80% 60% at 80% 100%, rgba(120, 80, 30, 0.18), transparent 70%),
    linear-gradient(175deg, #f3e6c8, #e7d3a6 60%, #dcc28c);
  border-radius: 3px 5px 4px 6px;
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.4) inset, 0 14px 24px rgba(0, 0, 0, 0.45), 0 2px 4px rgba(0, 0, 0, 0.35);
  font-family: 'Manrope', sans-serif; font-size: 12.5px; line-height: 1.45;
  transition: transform .2s ease, box-shadow .2s;
}
.note:hover { transform: rotate(0deg) translateY(-3px); box-shadow: 0 20px 34px rgba(0, 0, 0, 0.5); z-index: 2; }
.note.hidden { opacity: .6; outline: 2px dashed #7a5cff; }
.note.st-done, .note.st-failed, .note.st-closed { filter: saturate(.75); }
.pin { position: absolute; top: 7px; left: 50%; width: 14px; height: 14px; margin-left: -7px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #ff8a7a, #a3170c 60%, #5a0b05); box-shadow: 0 3px 4px rgba(0, 0, 0, .5); }

.n-head { display: flex; justify-content: space-between; align-items: baseline; gap: 6px; }
.n-guild { color: var(--guild); filter: brightness(.8); font-weight: 800; font-size: 10.5px; letter-spacing: .02em; max-width: 34%; }
.n-guild:last-child { text-align: right; }
.n-kind { font: 700 22px 'Cormorant Garamond', Georgia, serif; letter-spacing: .08em; text-transform: uppercase; }
.n-type { margin: 2px 0 6px; text-align: center; font: 700 26px/1.05 'Cormorant Garamond', Georgia, serif; color: #3a2410; border-bottom: 1px solid rgba(90, 60, 20, .35); padding-bottom: 6px; }
.ribbon { position: absolute; top: 14px; right: -8px; padding: 3px 12px 3px 10px; color: #fff; font: 800 11px 'Manrope', sans-serif; letter-spacing: .04em; text-transform: uppercase; box-shadow: 0 3px 6px rgba(0, 0, 0, .35); clip-path: polygon(8px 0, 100% 0, 100% 100%, 8px 100%, 0 50%); animation: pulse-r 2s ease-in-out infinite; }
@keyframes pulse-r { 50% { filter: brightness(1.25); } }
.n-tags { display: flex; flex-wrap: wrap; gap: 4px; justify-content: center; margin-bottom: 6px; }
.n-tag { border: 1.5px solid; border-radius: 3px; padding: 0 6px; font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: .03em; transform: rotate(-1deg); }
.n-desc { margin: 0 0 8px; white-space: pre-wrap; color: #2b2116; font-size: 12.5px; }
.n-terms { margin: 0 0 8px; display: grid; gap: 1px; font-size: 12px; }
.n-terms div { display: flex; gap: 6px; }
.n-terms dt { color: #6b5232; white-space: nowrap; }
.n-terms dt::after { content: ':'; }
.n-terms dd { margin: 0; font-weight: 700; }
.n-tasks { list-style: none; margin: 0 0 10px; padding: 7px 8px; background: rgba(90, 60, 20, .08); border: 1px solid rgba(90, 60, 20, .25); border-radius: 4px; display: grid; gap: 3px; }
.n-tasks li { margin: 0; color: #2b2116; display: flex; gap: 6px; align-items: flex-start; font-size: 12px; }
.n-tasks li.main { color: #1f6b12; }
.n-tasks li.ts-done span { text-decoration: line-through; opacity: .75; }
.n-tasks li.ts-failed span { color: #8c1a10; }
.n-tasks img, .info-dot { width: 15px; height: 15px; flex: none; margin-top: 1px; }
.info-dot { border-radius: 50%; background: #2a72f0; color: #fff; font: 800 10px/15px Georgia, serif; text-align: center; font-style: normal; }

.n-scales { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 8px; }
.scale { display: flex; align-items: center; gap: 6px; font-weight: 700; }
.boxes { display: flex; }
.boxes.rtl { flex-direction: row-reverse; }
.box { width: 22px; height: 22px; border: 1.5px solid rgba(60, 40, 15, .55); margin-left: -1.5px; display: grid; place-items: center; background: rgba(255, 255, 255, .25); }
.box img { width: 100%; height: 100%; }
.n-rank { display: grid; justify-items: center; gap: 3px; margin-bottom: 10px; font-weight: 700; }
.n-rank b { min-width: 60%; text-align: center; padding: 3px 10px; border-radius: 3px; font-size: 13px; box-shadow: 0 2px 0 rgba(0, 0, 0, .25); }
.n-bottom { display: flex; gap: 8px; align-items: stretch; }
.n-group { flex: 1; border: 1.5px solid rgba(60, 40, 15, .4); border-radius: 4px; padding: 4px 6px 6px; display: grid; justify-items: center; gap: 4px; font-weight: 700; }
.slots { display: flex; gap: 2px; flex-wrap: wrap; justify-content: center; }
.slot { width: 30px; height: 30px; border-radius: 50%; border: 1.5px solid rgba(60, 40, 15, .5); overflow: hidden; display: grid; place-items: center; background: rgba(255, 255, 255, .3); font-style: normal; }
.slot img { width: 100%; height: 100%; object-fit: cover; }
.slot b { font-size: 11px; color: #3a2410; }
.n-status { width: 88px; flex: none; display: grid; place-content: center; text-align: center; color: #fff; font-weight: 800; font-size: 13px; border-radius: 4px; box-shadow: 0 3px 0 rgba(0, 0, 0, .25); }
.n-status small { font-weight: 600; font-size: 10px; opacity: .85; }

.stamp { position: absolute; top: 42%; left: 50%; transform: translate(-50%, -50%) rotate(-14deg); display: flex; align-items: center; gap: 8px; padding: 6px 16px; border: 4px double currentColor; border-radius: 8px; font: 800 26px 'Cormorant Garamond', Georgia, serif; letter-spacing: .1em; text-transform: uppercase; pointer-events: none; mix-blend-mode: multiply; opacity: .85; }
.stamp img { width: 30px; height: 30px; mix-blend-mode: normal; }
.stamp-done { color: #1a4fb3; }
.stamp-failed { color: #a3170c; }
.stamp-closed { color: #5d4a30; }
.n-report { margin-top: 8px; padding: 6px 8px; border-left: 3px solid var(--guild); background: rgba(255, 255, 255, .25); font-style: italic; white-space: pre-wrap; }
.n-status { position: relative; }
.seal { position: absolute; right: -12px; top: -14px; font-style: normal; width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; color: rgba(255, 255, 255, .85); font: 700 17px 'Cormorant Garamond', Georgia, serif; background: radial-gradient(circle at 35% 30%, color-mix(in srgb, var(--guild) 70%, white), var(--guild) 55%, color-mix(in srgb, var(--guild) 60%, black)); box-shadow: 0 2px 3px rgba(0, 0, 0, .4), inset 0 0 0 3px rgba(0, 0, 0, .12); transform: rotate(-12deg); opacity: .9; pointer-events: none; }
.n-actions { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 10px; }
.n-actions:empty { display: none; }
.n-btn { border: 1.5px solid rgba(60, 40, 15, .5); background: rgba(255, 255, 255, .35); color: #2b2116; border-radius: 4px; padding: 4px 10px; font: 700 12px 'Manrope', sans-serif; cursor: pointer; }
.n-btn:hover { background: rgba(255, 255, 255, .6); }
.n-btn.primary { background: #4c9a0c; border-color: #3a7a08; color: #fff; }
.n-btn.small { padding: 2px 8px; font-size: 11px; }
.n-btn.ok { color: #1f6b12; }
.n-btn.no { color: #a3170c; }
.n-btn:disabled { opacity: .4; cursor: not-allowed; }

.n-master { margin-top: 10px; padding: 8px; border-radius: 4px; background: rgba(20, 16, 30, .88); color: #ece6da; font-size: 11.5px; display: grid; gap: 6px; }
.m-line b { color: #f3dc9e; }
.m-line.warn { color: #c9b8ff; }
.m-muted { color: #9d978b; }
.m-bar { height: 6px; border-radius: 99px; background: rgba(255, 255, 255, .12); overflow: hidden; }
.m-bar i { display: block; height: 100%; }
.m-chance { display: grid; gap: 4px; }
.n-master .n-btn { background: rgba(255, 255, 255, .08); color: #ece6da; border-color: rgba(255, 255, 255, .2); justify-self: start; }
.m-app { display: flex; gap: 4px; align-items: center; }
.m-app span { flex: 1; min-width: 0; }
.m-app em { color: #9d978b; }
</style>
