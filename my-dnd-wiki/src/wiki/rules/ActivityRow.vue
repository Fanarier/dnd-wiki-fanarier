<template>
  <!-- одна запись журнала: что делал (ссылка на правило в вики), часы, выносливость, результат и броски, статус;
       с кем, где, что ушло в лист. Мастер проверяет — на запись падает печать -->
  <article ref="el" class="ar" :class="['st-' + rec.status, { cut: rec.status === 'cancel', mirror }]" :style="{ '--sc': ST.color, '--cc': CAT.color }">
    <span class="ar-type" :title="`${CAT.name}${TYPE ? ' · ' + TYPE.name : ''}`">{{ CAT.icon }}</span>
    <div class="ar-main">
      <b class="ar-name">
        <router-link v-if="wiki" class="ar-wiki" :to="{ path: '/wiki', query: { section: 'activities', a: wiki.articleId } }" :title="`В вики: ${wiki.name} — ${wiki.dur}, ${wiki.rate} выносливости в час${wiki.cost ? ', ' + wiki.cost : ''}`">{{ rec.name }}<sup>📖</sup></router-link>
        <template v-else>{{ rec.name }}</template>
      </b>
      <RichText v-if="rec.result" class="ar-res" :text="rec.result" />
      <div class="ar-meta">
        <span v-if="mirror" class="ar-tag mir" title="Совместная деятельность — запись в журнале другого героя, в суммы этого не входит">↔ из журнала {{ mirror }}</span>
        <span v-if="showDate" class="ar-tag">{{ rec.date.split('-').reverse().join('.') }}</span>
        <span v-if="rec.day" class="ar-tag">день {{ rec.day }}</span>
        <span v-for="w in partners" :key="w.heroId" class="ar-tag with">с {{ w.name.split(' ')[0] }}</span>
        <router-link v-if="city" class="ar-tag place" :to="{ path: '/', query: { focus: 'cities:' + city.id } }" title="Показать на карте">📍 {{ city.name }}</router-link>
        <span v-if="rec.mod" class="ar-tag" title="Место — модификатор из вики">🏛 {{ rec.mod }}</span>
        <span v-if="rec.trainId" ref="trainTag" class="ar-tag train" :class="{ ok: rec.applied }" :title="rec.applied ? 'Очки уже в прогрессе тренировки' : 'Очки прибавятся, когда мастер учтёт запись'">
          🏋 {{ trainName || 'тренировка' }} <b>+{{ rec.pts }}</b>{{ rec.applied ? ' ✓' : '' }}
        </span>
        <span v-if="money" class="ar-tag gold" :class="{ ok: rec.appliedSheet }" :title="rec.appliedSheet ? 'Уже в листе' : 'Уйдёт в лист, когда мастер учтёт'">💰 {{ money }}</span>
        <span v-if="rec.exp" class="ar-tag exp" :class="{ ok: rec.appliedSheet }">✦ {{ rec.exp > 0 ? '+' : '' }}{{ rec.exp }} опыта</span>
        <span v-if="exh > 0" class="ar-tag exh" :class="{ ok: rec.appliedSheet }" :title="exhWhy">😵 +{{ exh }} изнур.</span>
        <span v-else-if="exh < 0" class="ar-tag unexh" :class="{ ok: rec.appliedSheet }" :title="exhWhy">🌿 −{{ -exh }} изнур.</span>
        <span v-if="toSleep" class="ar-tag sleep" :title="`Сейчас у героя ${hero?.exh || 0}, с этой записью — ${EXH_MAX} и больше: эффект «Сон»`">😴 до {{ EXH_MAX }} — «Сон»</span>
        <span v-for="(it, i) in rec.items || []" :key="'i' + i" class="ar-tag item" :class="{ ok: rec.appliedSheet, made: it.created }"
              :title="it.created ? 'Этой вещи не было в листе — игрок сам добавил её в инвентарь из журнала' : it.info?.desc ? 'Новая вещь с описанием' : ''">{{ it.qty > 0 ? '🎒 +' : '🎒 −' }}{{ Math.abs(it.qty) > 1 ? Math.abs(it.qty) + '× ' : '' }}{{ it.name }}{{ it.stored ? ' (склад)' : '' }}{{ it.created ? ' ✨ не было в листе' : '' }}{{ it.info && !it.created ? ' 📝' : '' }}</span>
        <span v-if="purse?.short" class="ar-tag poor" :title="`В листе ${fmtCoins(purse.have)}, тратится ${fmtCoins(purse.need)}`">⚠ не хватает денег</span>
        <span v-for="(r, i) in rec.rolls || []" :key="'r' + i" class="ar-tag roll" :title="`Брошено на сайте ${new Date(r.at).toLocaleString('ru')}: ${dieText(r)}${r.miss ? '. Без числа, не вошли: ' + r.miss : ''}`">🎲 {{ r.label ? r.label + ': ' : '' }}{{ r.notation }} = <b v-if="!r.long">{{ r.total }}</b><template v-else>{{ longSteps(r) }}<b>{{ r.final }}</b></template><em v-if="r.miss" class="ar-miss">⚠ без числа: {{ r.miss }}</em></span>
        <span v-if="rec.coin" class="ar-tag coin" :class="{ win: rec.coin.win }" :title="rec.coin.win ? 'Выносливость на эту деятельность не потрачена' : 'Монетка не помогла'">🍀 {{ rec.coin.win ? 'выносливость сохранена' : 'не повезло' }}</span>
        <span v-if="rec.by && rec.at && !mirror" class="ar-by">{{ rec.by }}</span>
      </div>
    </div>
    <span class="ar-num" title="Часы">{{ rec.hours || '—' }}<small v-if="rec.hours && /^[\d.,]+$/.test(rec.hours)"> ч</small></span>
    <span class="ar-num st" :class="{ free: rec.coin?.win }" title="Выносливость">{{ rec.stamina || '—' }}</span>
    <div class="ar-st">
      <select v-if="master && !mirror" :value="rec.status" class="ar-sel" :class="{ hit }" title="Статус" @change="$emit('status', $event.target.value)">
        <option v-for="(s, k) in ACT_STATUS" :key="k" :value="k">{{ s.name }}</option>
      </select>
      <span v-else class="ar-badge" :class="{ hit }">{{ ST.name }}</span>
      <span v-if="master && !mirror && rec.status === 'pending'" class="ar-quick">
        <button type="button" class="ok" title="Учесть" @click="$emit('status', 'done')">✓</button>
        <button type="button" class="no" title="Провал" @click="$emit('status', 'fail')">✗</button>
      </span>
    </div>
    <div v-if="!mirror" class="ar-acts">
      <button v-if="editable" type="button" title="Бросить кубики в эту запись (видно, что брошено на сайте)" @click="$emit('roll')">🎲</button>
      <button v-if="coinable" type="button" title="Первая уникальная деятельность периода: 50% не потратить выносливость" @click="$emit('coin')">🍀</button>
      <button v-if="hero?.canWrite" type="button" title="Ещё раз — такой же записью" @click="$emit('repeat')">⧉</button>
      <template v-if="editable">
        <button type="button" title="Править" @click="$emit('edit')">✎</button>
        <button type="button" class="del" title="Удалить" @click="$emit('remove')">✕</button>
      </template>
    </div>
    <LottieFx v-if="seal" :key="seal.key" class="ar-seal" :data="seal.data" :size="84" @done="seal = null" />
  </article>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { store, actState } from '../../map/store.js'
import { ACT_STATUS, ACT_TYPES, ACT_CATS, categoryOf, exhOf, isLongTraining, LONG_EXH, nightExh, EXH_MAX, moneyCheck, fmtCoins } from '../../shared/activities.js'
import LottieFx from './LottieFx.vue'
import RichText from '../../components/RichText.vue'
import { stamp } from './lottie.js'
import { sparks, shake } from './actFx.js'
import { sfx } from '../../sound/sound.js'

const props = defineProps({
  rec: { type: Object, required: true }, hero: { type: Object, default: null }, master: Boolean, showDate: Boolean,
  wiki: { type: Object, default: null }, mirror: { type: String, default: '' }, coinable: Boolean
})
defineEmits(['status', 'edit', 'remove', 'repeat', 'roll', 'coin'])
const el = ref(null)
const trainTag = ref(null)
const ST = computed(() => ACT_STATUS[props.rec.status] || ACT_STATUS.pending)
const TYPE = computed(() => ACT_TYPES[props.rec.type])
const CAT = computed(() => ACT_CATS[categoryOf(props.rec.name)])
const trainName = computed(() => props.hero?.trainings?.find(t => t.Id === props.rec.trainId)?.Name || '')
// черновик и «на проверке» правит хозяин; мастер — всегда
const editable = computed(() => props.master || (props.hero?.canWrite && ['plan', 'pending'].includes(props.rec.status)))
const partners = computed(() => (props.rec.with || []).map(id => actState.heroes.find(h => h.heroId === id)).filter(Boolean))
const city = computed(() => (props.rec.place ? (store.data.cities || []).find(c => c.id === props.rec.place) : null))
const money = computed(() => [['gold', 'ЗМ'], ['silver', 'СМ'], ['copper', 'ММ']].filter(([k]) => props.rec[k]).map(([k, u]) => `${props.rec[k] > 0 ? '+' : ''}${props.rec[k]} ${u}`).join(' '))
// длительная тренировка: каждый к20 со своими модами, сумма, +35% (вниз), бонус повторения
function longSteps(r) {
  const d20 = (r.groups || []).find(g => g.sides === 20)?.values || []
  const each = d20.length === 2 ? Math.round(((r.total - d20[0] - d20[1]) / 2) * 100) / 100 : null
  const part = v => (each ? `(${v}${each > 0 ? '+' : ''}${each})` : String(v))
  const sum = d20.length === 2 ? `${part(d20[0])} + ${part(d20[1])} = ${r.total}` : String(r.total)
  return r.add ? `${sum} → +35% = ${Math.floor(r.total * 1.35)} → +${r.add} повт. = ` : `${sum} → +35% = `
}
// учтённая — сколько на самом деле ушло в лист; остальные — сколько уйдёт по правилам
// деньги: хватит ли (до «учтено»; мастеру — метка на проверке)
const purse = computed(() => (props.rec.status === 'done' ? null : moneyCheck(props.hero?.coins, props.rec)))
const sleepH = computed(() => actState.cfg[props.hero?.heroId]?.sleep ?? 8)
const exh = computed(() => (props.rec.status === 'done' ? props.rec.appliedSheet?.want?.exh || 0 : exhOf(props.rec, sleepH.value)))
// подсказка: откуда число («+4 за тренировку − 2 ночной сон»)
const exhWhy = computed(() => {
  if (isLongTraining(props.rec.name) && exh.value === LONG_EXH + nightExh(sleepH.value)) return `+${LONG_EXH} за длительную тренировку, ${nightExh(sleepH.value)} — ночной ${sleepH.value < 8 ? 'транс' : 'сон'} (${sleepH.value} ч) → ${exh.value > 0 ? '+' : ''}${exh.value}`
  return exh.value > 0 ? 'Изнурение в лист (при «учтено»)' : 'Отдых снимает изнурение в листе (при «учтено»): 1 за каждые 3 часа'
})
// до 5 — эффект «Сон»: предупредить и игрока, и мастера на проверке
const toSleep = computed(() => exh.value > 0 && props.rec.status !== 'done' && (Number(props.hero?.exh) || 0) + exh.value >= EXH_MAX)
const dieText = r => (r.groups || []).map(g => `d${g.sides}: ${g.values.join(', ')}`).join('; ') + (r.mod ? `; ${r.mod > 0 ? '+' : ''}${r.mod}` : '')

// проверка мастером — печать на запись, искры к тренировке, звук; провал и отмена — встряска
const seal = ref(null)
const hit = ref(false) // статус вспыхивает, когда на запись падает печать
watch(() => props.rec.status, (now, was) => {
  if (!was || now === was || props.mirror) return
  hit.value = false
  setTimeout(() => { hit.value = true; setTimeout(() => { hit.value = false }, 800) }, 200)
  if (now === 'done') {
    seal.value = { key: Date.now(), data: stamp('done') }
    sfx('bookPlace', 0.5)
    if (props.rec.trainId && props.rec.pts) setTimeout(() => sparks(el.value, trainTag.value, '#7ed07a'), 350)
    if (props.rec.gold > 0) setTimeout(() => sfx('coins', 0.4), 450)
  } else if (now === 'fail') {
    seal.value = { key: Date.now(), data: stamp('fail') }
    sfx('fail', 0.35)
    shake(el.value)
  } else if (now === 'cancel') shake(el.value)
})
</script>

<style scoped>
.ar { position: relative; display: grid; grid-template-columns: 24px minmax(0, 1fr) 70px 60px 128px 104px; align-items: center; gap: 8px; padding: 7px 6px; border-radius: 10px; border-left: 3px solid var(--sc); background: rgba(255, 255, 255, .015); transition: background .15s; }
.ar:hover { background: rgba(231, 197, 111, .05); }
.ar.st-plan { border-left-style: dashed; background: rgba(185, 166, 255, .04); }
.ar.mirror { opacity: .72; border-left-style: dotted; }
.ar-type { display: grid; place-items: center; width: 24px; height: 24px; border-radius: 7px; background: color-mix(in srgb, var(--cc) 18%, transparent); font-size: 13px; }
.ar-main { min-width: 0; }
.ar-name { display: block; color: #efe3c8; font: 700 13.5px/1.35 'Manrope', sans-serif; overflow-wrap: anywhere; }
.ar-wiki { color: inherit; text-decoration: none; border-bottom: 1px dotted rgba(231, 197, 111, .5); }
.ar-wiki:hover { color: #f3dc9e; border-bottom-color: #e7c56f; }
.ar-wiki sup { margin-left: 2px; font-size: 9px; opacity: .7; }
.ar.cut .ar-name { text-decoration: line-through; color: #8f8574; }
.ar-res { margin: 2px 0 0; color: #cdbf9f; font: 500 12.5px/1.4 'Manrope', sans-serif; white-space: pre-line; overflow-wrap: anywhere; }
.ar-meta { display: flex; flex-wrap: wrap; gap: 4px 6px; margin-top: 3px; }
.ar-meta:empty { display: none; }
.ar-tag { padding: 1px 7px; border-radius: 99px; background: rgba(255, 255, 255, .05); color: #cdbf9f; font: 700 11px 'Manrope', sans-serif; text-decoration: none; white-space: nowrap; }
.ar-tag.ok { box-shadow: inset 0 0 0 1px rgba(126, 208, 122, .45); }
.ar-tag.train { background: rgba(126, 208, 122, .1); color: #b5ecb2; }
.ar-tag.with { background: rgba(239, 127, 176, .12); color: #f6b4d2; }
.ar-tag.place { background: rgba(126, 208, 122, .08); color: #b5ecb2; }
.ar-tag.place:hover { background: rgba(126, 208, 122, .18); }
.ar-tag.gold { background: rgba(243, 211, 107, .12); color: #f3d36b; }
.ar-tag.exp { background: rgba(185, 166, 255, .12); color: #d2c8ff; }
.ar-tag.exh { background: rgba(255, 122, 107, .12); color: #ffb3aa; }
.ar-tag.unexh { background: rgba(126, 208, 122, .12); color: #b4ecb0; }
.ar-tag.item.made { box-shadow: inset 0 0 0 1px rgba(243, 211, 107, .6); }
.ar-tag.poor { background: rgba(255, 122, 107, .14); color: #ffb3aa; }
.ar-tag.sleep { background: rgba(155, 125, 255, .16); color: #d2c4ff; }
.ar-tag.item { background: rgba(201, 180, 138, .12); color: #e6d4ad; }
.ar-tag.roll { background: rgba(127, 180, 255, .12); color: #b9d6ff; }
.ar-tag.roll b { color: #fff; }
.ar-miss { margin-left: 6px; font-style: normal; color: #ffcf7a; }
.ar-tag.coin { background: rgba(143, 133, 116, .15); color: #c9bda5; }
.ar-tag.coin.win { background: rgba(243, 211, 107, .16); color: #f3d36b; }
.ar-tag.mir { background: rgba(185, 166, 255, .12); color: #d2c8ff; }
.ar-by { color: #7d7160; font: 600 11px 'Manrope', sans-serif; }
.ar-num { color: #e6dcc4; font: 800 13px 'Manrope', sans-serif; text-align: right; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ar-num small { color: #a8936c; font-weight: 600; }
.ar-num.st { color: #f6cf86; }
.ar-num.free { text-decoration: line-through; opacity: .6; }
.ar-st { display: flex; align-items: center; gap: 4px; justify-content: flex-end; }
.ar-badge { padding: 2px 9px; border-radius: 99px; background: color-mix(in srgb, var(--sc) 16%, transparent); color: var(--sc); font: 800 11.5px 'Manrope', sans-serif; white-space: nowrap; }
.ar-sel { max-width: 100%; padding: 3px 4px; border-radius: 8px; border: 1px solid color-mix(in srgb, var(--sc) 55%, transparent); background: color-mix(in srgb, var(--sc) 12%, #120d08); color: var(--sc); font: 800 11.5px 'Manrope', sans-serif; color-scheme: dark; }
.ar-quick { display: flex; gap: 2px; }
.ar-quick button, .ar-acts button { width: 24px; height: 24px; padding: 0; border-radius: 7px; border: 1px solid rgba(231, 197, 111, .22); background: none; color: #cdbf9f; font: 800 12px 'Manrope', sans-serif; cursor: pointer; }
.ar-quick .ok { border-color: rgba(126, 208, 122, .5); color: #7ed07a; }
.ar-quick .no { border-color: rgba(255, 122, 107, .45); color: #ff7a6b; }
.ar-acts { display: flex; flex-wrap: wrap; gap: 2px; justify-content: flex-end; }
.ar-acts button:hover { border-color: #e7c56f; color: #f3dc9e; }
.ar-acts .del:hover { border-color: #ff7a6b; color: #ff7a6b; }
.ar-seal { position: absolute; right: 230px; top: 50%; margin-top: -42px; z-index: 3; } /* над часами и выносливостью — статус не закрывает */
.ar-badge.hit, .ar-sel.hit { animation: ar-hit .7s ease; }
@keyframes ar-hit { 0% { transform: scale(1); } 30% { transform: scale(1.25); box-shadow: 0 0 18px var(--sc); } 100% { transform: scale(1); } }
@media (max-width: 760px) {
  .ar { grid-template-columns: 22px minmax(0, 1fr) auto auto; grid-template-areas: 't m m m' '. h s st' '. a a a'; row-gap: 4px; }
  .ar-type { grid-area: t; }
  .ar-main { grid-area: m; }
  .ar-num { grid-area: h; text-align: left; }
  .ar-num.st { grid-area: s; }
  .ar-st { grid-area: st; }
  .ar-acts { grid-area: a; justify-content: flex-start; }
  .ar-acts:empty { display: none; }
  .ar-seal { right: auto; left: 40%; }
}
</style>
