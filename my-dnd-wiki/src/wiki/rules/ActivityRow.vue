<template>
  <!-- одна запись журнала: что делал (ссылка на правило в вики), часы, выносливость, результат и броски, статус;
       с кем, где, что ушло в лист. Мастер проверяет — на запись падает печать -->
  <article ref="el" :data-rec="rec.id" class="ar" :class="['st-' + rec.status, { cut: rec.status === 'cancel', mirror }]" :style="{ '--sc': ST.color, '--cc': CAT.color }">
    <span class="ar-type" :class="{ grip: sortable }" :title="`${CAT.name}${TYPE ? ' · ' + TYPE.name : ''}${sortable ? ' — перетащи, чтобы поменять порядок' : ''}`">{{ CAT.icon }}</span>
    <b class="ar-name">
      <router-link v-if="wiki" class="ar-wiki" :to="{ path: '/wiki', query: { section: 'activities', a: wiki.articleId } }" :title="`В вики: ${wiki.name} — ${wiki.dur}, ${wiki.rate} выносливости в час${wiki.cost ? ', ' + wiki.cost : ''}`">{{ rec.name }}<sup>📖</sup></router-link>
      <template v-else>{{ rec.name }}</template>
    </b>
    <!-- место под печать: пока она падает, часы, выносливость и статус отъезжают вправо — ничего не закрыто -->
    <span class="ar-sealslot" :class="{ on: seal }"><LottieFx v-if="seal" :key="seal.key" class="ar-seal" :data="seal.data" :size="80" @done="seal = null" /></span>
    <div class="ar-nums">
      <span class="ar-num" title="Часы">⏱ {{ rec.hours || '—' }}<small v-if="rec.hours && /^[\d.,]+$/.test(rec.hours)"> ч</small></span>
      <span class="ar-num st" :class="{ free: rec.coin?.win }" title="Выносливость">⚡ {{ rec.stamina || '—' }}</span>
    </div>
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
    <div class="ar-body">
      <RichText v-if="rec.result" class="ar-res" :text="rec.result" @click="openImg" />
      <div class="ar-meta">
        <span v-if="mirror" class="ar-tag mir" title="Совместная деятельность — запись в журнале другого героя, в суммы этого не входит">↔ из журнала {{ mirror }}</span>
        <span v-if="showDate" class="ar-tag">{{ rec.date.split('-').reverse().join('.') }}</span>
        <span v-if="rec.day" class="ar-tag">день {{ rec.day }}</span>
        <span v-for="w in partners" :key="w.heroId" class="ar-tag with">с {{ w.name.split(' ')[0] }}</span>
        <router-link v-for="v in vod || []" :key="'v' + v.heroId" class="ar-tag vod" :to="{ query: { ...$route.query, log: v.heroId } }"
                     title="Взаимная общая деятельность: часы и выносливость общие (меняются у обоих, пока не проверено), название, описание и броски — у каждого свои">🤝 ВОД · {{ v.name }}</router-link>
        <router-link v-if="city" class="ar-tag place" :to="{ path: '/', query: { focus: 'cities:' + city.id } }" title="Показать на карте">📍 {{ city.name }}</router-link>
        <span v-if="rec.mod" class="ar-tag" title="Место — модификатор из вики">🏛 {{ rec.mod }}</span>
        <span v-if="rec.mentor || rec.mentorBonus" class="ar-tag mentor" title="Наставник — фиксированный бонус к броску">🎓 <router-link v-if="mentor" :to="mentor.to" :title="`${mentor.kind}: ${mentor.name}`">{{ rec.mentor }}</router-link><template v-else>{{ rec.mentor || 'наставник' }}</template><b v-if="rec.mentorBonus">&nbsp;{{ rec.mentorBonus > 0 ? '+' : '' }}{{ rec.mentorBonus }}</b></span>
        <span v-if="rec.times > 1" class="ar-tag" :title="long ? 'Несколько длительных подряд одной записью' : 'Несколько раз подряд одной записью'">×{{ rec.times }}</span>
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
        <span v-for="r in series.last" :key="'r' + r.i" class="ar-tag roll" :class="{ crit: r.twenties, fumble: r.ones, fresh: r.i === fresh }" :title="rollTitle(r)">{{ r.twenties ? '✨' : r.ones ? '💀' : '🎲' }} {{ r.label ? r.label + ': ' : '' }}{{ r.notation }}<span v-if="advDice(r)" class="ar-mode" :class="advDice(r).cls">{{ advDice(r).sign }}<template v-if="advDice(r).keep != null"> {{ advDice(r).keep }} <s>{{ advDice(r).drop }}</s></template></span> = <template v-if="steps(r)">{{ r.total }}{{ steps(r) }}</template><b>{{ r.final ?? r.total }}</b><em v-if="r.miss" class="ar-miss">⚠ без числа: {{ r.miss }}</em></span>
        <!-- переброшено: прежние броски остаются в записи (видно, что было), но не считаются -->
        <button v-if="series.old.length" type="button" class="ar-tag oldbtn" :title="showOld ? 'Спрятать прежние броски' : 'Показать, что выпадало до переброса'" @click="showOld = !showOld">↺ перебросы: {{ series.old.length }}</button>
        <template v-if="showOld"><span v-for="r in series.old" :key="'o' + r.i" class="ar-tag roll old" :title="'Переброшено — не считается. ' + rollTitle(r)">🎲 {{ r.label ? r.label + ': ' : '' }}{{ r.notation }}<span v-if="advDice(r)" class="ar-mode" :class="advDice(r).cls">{{ advDice(r).sign }}</span> = <b>{{ r.final ?? r.total }}</b></span></template>
        <!-- ещё не брошено — что будет брошено (проверить, подхватились ли модификаторы) -->
        <!-- преимущество / помеха: видно, что подтянулось (и откуда) -->
        <span v-if="advTag" class="ar-tag mode" :class="advTag.cls" :title="advTag.title">{{ advTag.text }}</span>
        <span v-if="plan?.perDieAsk" class="ar-tag mode" :class="rec.perDie ? 'm-hi' : rec.perDie == null ? 'warn' : ''"
              :title="`В броске ${plan.nDice} кубика, модификаторы ${plan.modSum > 0 ? '+' : ''}${plan.modSum}: ${rec.perDie ? 'к каждому кубику — всего ' + plan.sum : rec.perDie == null ? 'не выбрано, считается один раз — выбери в записи (✎)' : 'один раз'}`">{{ rec.perDie ? `➕ моды к каждому кубику ×${plan.nDice}` : rec.perDie == null ? '❓ моды: один раз или к каждому?' : '➕ моды один раз' }}</span>
        <span v-if="plan?.repNo" class="ar-tag mode off" title="В описании написан «Бонус повторения», но деятельность не повторяемая (↻) — он не прибавляется">↻ бонус не действует</span>
        <span v-if="preview" class="ar-tag plan" :title="`Ещё не брошено. В среднем ≈ ${preview.avg}${plan.unknown.length ? '. Без числа, не войдут: ' + plan.unknown.join(', ') : ''}`">🎲 {{ preview.text }} = <b>?</b><template v-if="preview.left > 1"> · ещё {{ preview.left }} {{ timesWord(preview.left) }}</template></span>
        <template v-for="v in vod || []" :key="'vr' + v.heroId">
          <span v-if="v.rolls.length" class="ar-vodrolls"><i>Броски {{ v.name }}:</i>
            <span v-for="r in v.rolls" :key="r.i" class="ar-tag roll vodr" :class="{ crit: r.twenties, fumble: r.ones }" :title="rollTitle(r)">{{ r.twenties ? '✨' : r.ones ? '💀' : '🎲' }} {{ r.notation }}<span v-if="advDice(r)" class="ar-mode" :class="advDice(r).cls">{{ advDice(r).sign }}</span> = <b>{{ r.final ?? r.total }}</b></span>
          </span>
        </template>
        <span v-if="multiSum" class="ar-tag sum" :title="`Сумма бросков: ${multiSum.list.join(' + ')}`">Σ {{ multiSum.total }}<template v-if="multiSum.left"> + ? ({{ multiSum.left }})</template></span>
        <span v-if="rec.coin" class="ar-tag coin" :class="{ win: rec.coin.win }" :title="rec.coin.win ? 'Выносливость на эту деятельность не потрачена' : 'Монетка не помогла'">🍀 {{ rec.coin.win ? 'выносливость сохранена' : 'не повезло' }}</span>
      </div>
      <ol v-if="showHist" class="ar-hist">
        <li v-for="(x, i) in [...rec.hist].reverse()" :key="i"><time>{{ new Date(x.at).toLocaleString('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) }}</time><b>{{ x.by }}</b><span>{{ x.t }}</span></li>
      </ol>
      <p v-if="rec.masterEdit && !mirror" class="ar-edited" :title="`Мастер ${rec.masterEdit.by || ''}, ${new Date(rec.masterEdit.at).toLocaleString('ru')}`">✎ Мастер поправил: {{ rec.masterEdit.fields.join(', ') }}</p>
      <div v-if="(rec.reply || replying) && !mirror" class="ar-reply">
        <b>💬 Мастер<small v-if="rec.replyAt && !replying"> · {{ new Date(rec.replyAt).toLocaleDateString('ru', { day: 'numeric', month: 'short' }) }}</small></b>
        <template v-if="replying">
          <textarea v-model="replyText" class="ar-reply-in" rows="2" maxlength="2000" placeholder="Ответ игроку: почему так, что поменял, что дальше… (не обязательно)" />
          <span class="ar-reply-acts"><button type="button" @click="replying = false">Отмена</button><button type="button" class="go" @click="sendReply">Ответить</button></span>
        </template>
        <p v-else>{{ rec.reply }}</p>
      </div>
    </div>
    <div v-if="mirror && confirmable" class="ar-foot">
      <span class="ar-by">{{ mirror }} зовёт в общую деятельность</span>
      <span class="grow" />
      <div class="ar-more">
        <button type="button" class="ar-dots" title="Действия" @click="menu = !menu">⋯</button>
        <div v-if="menu" class="ar-menu" @pointerleave="menu = false">
          <button type="button" @click="menu = false; $emit('confirm')">🤝 Подтвердить — добавить в свой журнал</button>
        </div>
      </div>
    </div>
    <div v-if="!mirror" class="ar-foot">
      <span v-if="rec.by && rec.at" class="ar-by">{{ rec.by }}</span>
      <span class="grow" />
      <div class="ar-acts">
        <button v-if="rec.hist?.length" type="button" :class="{ on: showHist }" :title="`История записи: кто и что менял (${rec.hist.length})`" @click="showHist = !showHist">🕑</button>
        <button v-if="master" type="button" :title="rec.reply ? 'Изменить ответ игроку' : 'Ответить игроку (увидит под записью, придёт уведомление)'" @click="openReply">💬</button>
        <button v-if="editable" type="button" title="Бросить кубики в эту запись (видно, что брошено на сайте)" @click="$emit('roll')">🎲</button>
        <button v-if="coinable" type="button" title="Первая уникальная деятельность периода: 50% не потратить выносливость" @click="$emit('coin')">🍀</button>
        <button v-if="hero?.canWrite" type="button" title="Ещё раз — такой же записью" @click="$emit('repeat')">⧉</button>
        <template v-if="editable">
          <button type="button" :title="master && rec.status === 'pending' ? 'Поправить перед проверкой (игрок увидит, что поменял мастер)' : 'Править'" @click="$emit('edit')">✎</button>
          <button type="button" class="del" title="Удалить" @click="$emit('remove')">✕</button>
        </template>
      </div>
    </div>
  </article>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { store, actState } from '../../map/store.js'
import { ACT_STATUS, ACT_TYPES, ACT_CATS, categoryOf, exhOf, isLongTraining, EXH_MAX, moneyCheck, fmtCoins, planText, planAvg, avgText, timesWord, seriesInfo, ADV_NAME, ADV_SIGN } from '../../shared/activities.js'
import { mentorLink } from './mentor.js'
import LottieFx from './LottieFx.vue'
import RichText from '../../components/RichText.vue'
import { stamp } from './lottie.js'
import { sparks, shake } from './actFx.js'
import { sfx } from '../../sound/sound.js'

const props = defineProps({
  rec: { type: Object, required: true }, hero: { type: Object, default: null }, master: Boolean, showDate: Boolean,
  wiki: { type: Object, default: null }, mirror: { type: String, default: '' }, coinable: Boolean,
  sortable: Boolean, // можно перетаскивать за значок
  vod: { type: Array, default: null }, // взаимная общая деятельность: связанные записи других героев
  confirmable: Boolean, // чужая запись «с этим героем» — можно подтвердить
  plan: { type: Object, default: null } // что будет брошено (из журнала: модификаторы, место, наставник, повторение)
})
const emit = defineEmits(['status', 'edit', 'remove', 'repeat', 'roll', 'coin', 'reply', 'confirm'])
const menu = ref(false)
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
// как получился итог: натуральные на к20 (20 — ×2, 1 — не в счёт), у длительной × множитель (с которым бросали;
// старые — × 1.35), бонус повторения. Пусто — итог равен броску
function steps(r) {
  if (r.final == null) return ''
  let s = ''
  if (r.sum != null && r.sum !== r.total) s += ` → ${[r.twenties && '20 ×2', r.ones && '1 не в счёт'].filter(Boolean).join(', ')}: ${r.sum}`
  const base = r.sum ?? r.total
  if (r.long) s += ` × ${r.mult || 1.35}` + (r.add ? ` = ${Math.floor(base * (r.mult || 1.35))}` : '')
  if (r.add) s += ` + ${r.add} повт.`
  if (r.reset) s += ' (повторение сначала)'
  return s ? s + ' = ' : ''
}
// фото в описании — открыть целиком
const openImg = e => { if (e.target.tagName === 'IMG') window.open(e.target.src, '_blank', 'noopener') }
// бросок с преимуществом / помехой: оба к20 — засчитанный и отброшенный
function advDice(r) {
  if (r.adv !== 'adv' && r.adv !== 'dis') return null
  const g = (r.groups || []).find(x => x.sides === 20)
  const v = g?.values || []
  const keep = v.length === 2 ? (r.adv === 'adv' ? Math.max(...v) : Math.min(...v)) : null
  return { cls: r.adv === 'adv' ? 'm-hi' : 'm-lo', sign: ADV_SIGN[r.adv], keep, drop: keep == null ? null : v[0] === keep ? v[1] : v[0] }
}
// метка у записи: с преимуществом / помехой (из текста или выбрано), не действует или и то и другое в тексте
const advTag = computed(() => {
  const p = props.plan
  if (!p) return null
  if (p.advBoth) return { cls: 'warn', text: '⚠ ▲▼ и преимущество, и помеха', title: 'В описании есть оба слова — оба сразу нельзя, бросок обычный. Выбери одно в записи (✎)' }
  const w = p.advWant
  if (!w) return null
  const src = p.advSrc === 'text' ? 'Подтянуто из описания записи' : 'Выбрано в записи'
  if (p.advNo) return { cls: 'off', text: `${ADV_SIGN[w]} ${ADV_NAME[w].toLowerCase()} — не действует`, title: `${src}, но не действует: ${p.advNo}` }
  return { cls: w === 'adv' ? 'm-hi' : 'm-lo', text: `${ADV_SIGN[w]} ${ADV_NAME[w]}`, title: `${src}. ${w === 'adv' ? 'к20 бросается дважды, засчитывается больший' : 'к20 бросается дважды, засчитывается меньший'}` }
})
const rollTitle = r => `Брошено на сайте ${new Date(r.at).toLocaleString('ru')}: ${dieText(r)}${advDice(r)?.keep != null ? `. ${ADV_NAME[r.adv]}: выпало ${advDice(r).keep} и ${advDice(r).drop}, засчитано ${advDice(r).keep}` : ''}${r.twenties ? '. Натуральная 20 — кубик ×2' : ''}${r.ones ? '. Натуральная 1 — кубик не в счёт, бонус повторения начинается заново' : ''}${r.miss ? '. Без числа, не вошли: ' + r.miss : ''}`
const long = computed(() => isLongTraining(props.rec.name))
const mentor = computed(() => mentorLink(props.rec.mentor))
// броски: последняя серия считается, прежние (переброшенные) — под кнопкой
const series = computed(() => seriesInfo(props.rec))
const showOld = ref(false)
const showHist = ref(false)
// только что брошенный — вспыхивает (крит — золотом, провал — трещиной)
const fresh = ref(-1)
watch(() => props.rec.rolls?.length || 0, (n, o) => {
  if (o == null || n <= o) return
  fresh.value = n - 1
  setTimeout(() => { fresh.value = -1 }, 2200)
})
// план броска, пока не брошено (у «несколько» — пока брошены не все)
const preview = computed(() => {
  const p = props.plan
  if (!p || props.rec.status === 'done' || props.mirror || !(p.long || p.items.length || p.dice.length || props.rec.mod || p.rep || p.die !== 20 || p.times > 1)) return null
  const left = series.value.full ? 0 : series.value.need - series.value.done
  if (left <= 0) return null
  const a = planAvg(p)
  return { text: planText(p), left, avg: avgText(a) }
})
// «несколько» (×N, у любой деятельности) — сумма брошенного
const multiSum = computed(() => {
  const last = series.value.last
  if (!(props.rec.times > 1) || !last.length) return null
  const list = last.slice(0, props.rec.times).map(r => r.final ?? r.total)
  return { list, total: list.reduce((a, b) => a + b, 0), left: Math.max(0, props.rec.times - list.length) }
})
// учтённая — сколько на самом деле ушло в лист; остальные — сколько уйдёт по правилам
// деньги: хватит ли (до «учтено»; мастеру — метка на проверке)
const purse = computed(() => (props.rec.status === 'done' ? null : moneyCheck(props.hero?.coins, props.rec)))
const sleepH = computed(() => actState.cfg[props.hero?.heroId]?.sleep ?? 8)
const exh = computed(() => (props.rec.status === 'done' ? props.rec.appliedSheet?.want?.exh || 0 : exhOf(props.rec, sleepH.value)))
// подсказка: откуда число
const exhWhy = computed(() => {
  return exh.value > 0 ? 'Изнурение в лист (при «учтено»)' : 'Отдых снимает изнурение в листе (при «учтено»): 1 за каждые 3 часа'
})
// до 5 — эффект «Сон»: предупредить и игрока, и мастера на проверке
const toSleep = computed(() => exh.value > 0 && props.rec.status !== 'done' && (Number(props.hero?.exh) || 0) + exh.value >= EXH_MAX)
const dieText = r => (r.groups || []).map(g => `d${g.sides}: ${g.values.join(', ')}`).join('; ') + (r.mod ? `; ${r.mod > 0 ? '+' : ''}${r.mod}` : '')

// проверка мастером — печать на запись, искры к тренировке, звук; провал и отмена — встряска
const seal = ref(null)
// ответ мастера под записью
const replying = ref(false), replyText = ref('')
function openReply() { replyText.value = props.rec.reply || ''; replying.value = true }
function sendReply() { emit('reply', replyText.value.trim()); replying.value = false }
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
.ar { position: relative; display: grid; grid-template-columns: 26px minmax(0, 1fr) auto auto auto; grid-template-areas: 'i n seal nums st' '. b b b b' '. f f f f'; align-items: center; gap: 4px 10px; padding: 10px 12px 8px 8px; border-radius: 12px; border-left: 3px solid var(--sc); background: rgba(255, 255, 255, .02); transition: background .15s; }
.ar-type { grid-area: i; }
.ar-name { grid-area: n; }
.ar-nums { grid-area: nums; display: flex; gap: 6px; }
.ar-st { grid-area: st; }
.ar-body { grid-area: b; min-width: 0; }
.ar-foot { grid-area: f; display: flex; align-items: center; gap: 8px; min-height: 26px; }
.ar-foot .grow { flex: 1; }
.ar-edited { margin: 6px 0 0; color: #f3d36b; font: 700 11.5px 'Manrope', sans-serif; }
.ar-reply { margin-top: 8px; padding: 7px 10px; border-radius: 10px; background: rgba(127, 180, 255, .08); border-left: 3px solid #7fb4ff; }
.ar-reply b { display: block; color: #b9d6ff; font: 800 11.5px 'Manrope', sans-serif; }
.ar-reply b small { color: #7d8aa6; font-weight: 700; }
.ar-reply p { margin: 2px 0 0; color: #dfe8f7; font: 500 13px/1.45 'Manrope', sans-serif; white-space: pre-line; overflow-wrap: anywhere; }
.ar-reply-in { width: 100%; box-sizing: border-box; margin-top: 4px; padding: 6px 8px; border-radius: 8px; border: 1px solid rgba(127, 180, 255, .4); background: rgba(0, 0, 0, .35); color: #efe3c8; font: 500 13px 'Manrope', sans-serif; resize: vertical; outline: none; }
.ar-reply-acts { display: flex; justify-content: flex-end; gap: 6px; margin-top: 4px; }
.ar-reply-acts button { padding: 3px 10px; border-radius: 8px; border: 1px solid rgba(231, 197, 111, .3); background: none; color: #cdbf9f; font: 700 12px 'Manrope', sans-serif; cursor: pointer; }
.ar-reply-acts .go { background: #7fb4ff; border: 0; color: #0d1420; }
.ar:hover { background: rgba(231, 197, 111, .05); }
.ar.st-plan { border-left-style: dashed; background: rgba(185, 166, 255, .04); }
.ar.mirror { opacity: .72; border-left-style: dotted; }
.ar-type { display: grid; place-items: center; width: 24px; height: 24px; border-radius: 7px; background: color-mix(in srgb, var(--cc) 18%, transparent); font-size: 13px; }
.ar-type.grip { cursor: grab; touch-action: none; transition: box-shadow .15s; }
.ar-type.grip:hover { box-shadow: 0 0 0 1px color-mix(in srgb, var(--cc) 70%, transparent), 0 0 10px color-mix(in srgb, var(--cc) 40%, transparent); }
.ar-type.grip:active { cursor: grabbing; }
.ar-name { display: block; color: #efe3c8; font: 700 13.5px/1.35 'Manrope', sans-serif; overflow-wrap: anywhere; }
.ar-wiki { color: inherit; text-decoration: none; border-bottom: 1px dotted rgba(231, 197, 111, .5); }
.ar-wiki:hover { color: #f3dc9e; border-bottom-color: #e7c56f; }
.ar-wiki sup { margin-left: 2px; font-size: 9px; opacity: .7; }
.ar.cut .ar-name { text-decoration: line-through; color: #8f8574; }
.ar-res { margin: 4px 0 0; color: #cdbf9f; font: 500 12.5px/1.4 'Manrope', sans-serif; white-space: pre-line; overflow-wrap: anywhere; }
.ar-meta { display: flex; flex-wrap: wrap; gap: 4px 6px; margin-top: 6px; }
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
.ar-tag.vod { background: rgba(255, 140, 190, .14); color: #ffc3dc; box-shadow: inset 0 0 0 1px rgba(255, 140, 190, .35); }
.ar-vodrolls { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 4px; padding: 2px 6px; border-radius: 10px; border: 1px dashed rgba(255, 140, 190, .35); }
.ar-vodrolls > i { color: #e6a9c4; font: 700 10.5px 'Manrope', sans-serif; font-style: normal; }
.ar-tag.roll.vodr { background: rgba(255, 140, 190, .1); color: #f3c9da; }
.ar-more { position: relative; }
.ar-dots { width: 30px; height: 26px; border-radius: 8px; border: 1px solid rgba(255, 140, 190, .4); background: rgba(255, 140, 190, .08); color: #ffc3dc; font: 900 15px/1 'Manrope', sans-serif; cursor: pointer; }
.ar-menu { position: absolute; right: 0; bottom: calc(100% + 4px); z-index: 20; display: grid; min-width: 260px; padding: 4px; border-radius: 10px; border: 1px solid rgba(255, 140, 190, .4); background: #1b1410; box-shadow: 0 12px 28px rgba(0, 0, 0, .6); }
.ar-menu button { padding: 7px 10px; border: 0; border-radius: 7px; background: none; color: #efe3c8; font: 700 12.5px 'Manrope', sans-serif; text-align: left; cursor: pointer; }
.ar-menu button:hover { background: rgba(255, 140, 190, .14); }
.ar-tag.roll.crit { background: rgba(243, 211, 107, .2); color: #ffe7a0; box-shadow: 0 0 10px rgba(243, 211, 107, .35); }
.ar-tag.roll.fumble { background: rgba(255, 107, 94, .16); color: #ffb3aa; }
.ar.found { animation: ar-found 2.4s ease-out; }
@keyframes ar-found { 0%, 40% { box-shadow: 0 0 0 2px #e7c56f, 0 0 26px rgba(231, 197, 111, .55); } 100% { box-shadow: none; } }
.ar-hist { display: grid; gap: 2px; margin: 6px 0 0; padding: 6px 8px; list-style: none; border-radius: 10px; background: rgba(0, 0, 0, .25); border: 1px dashed rgba(231, 197, 111, .2); max-height: 220px; overflow-y: auto; }
.ar-hist li { display: grid; grid-template-columns: auto auto minmax(0, 1fr); gap: 8px; align-items: baseline; color: #cdbf9f; font: 600 11.5px/1.4 'Manrope', sans-serif; }
.ar-hist time { color: #7d7160; white-space: nowrap; }
.ar-hist b { color: #e6cf98; white-space: nowrap; }
.ar-hist span { overflow-wrap: anywhere; }
.ar-tag.roll.fresh { animation: ar-roll-in .6s cubic-bezier(.2, .9, .3, 1.4); }
.ar-tag.roll.crit.fresh { animation: ar-crit 1.8s ease-out; }
.ar-tag.roll.fumble.fresh { animation: ar-fumble .9s ease-out; }
@keyframes ar-roll-in { from { transform: scale(.6); opacity: 0; } }
@keyframes ar-crit {
  0% { transform: scale(.6); box-shadow: 0 0 0 rgba(243, 211, 107, 0); }
  25% { transform: scale(1.25); box-shadow: 0 0 26px 6px rgba(243, 211, 107, .8); background: rgba(243, 211, 107, .45); }
  100% { transform: scale(1); }
}
@keyframes ar-fumble {
  0%, 100% { transform: none; }
  15% { transform: translateX(-4px) rotate(-3deg); background: rgba(255, 70, 60, .45); }
  30% { transform: translateX(4px) rotate(2deg); }
  45% { transform: translateX(-3px); }
  60% { transform: translateX(2px); }
}
@media (prefers-reduced-motion: reduce) { .ar-tag.roll.fresh { animation: none; } }
.ar-tag.roll.old { opacity: .55; text-decoration: line-through; text-decoration-color: rgba(255, 255, 255, .35); }
.ar-tag.oldbtn { border: 1px dashed rgba(231, 197, 111, .35); background: none; color: #a8936c; cursor: pointer; }
.ar-res :deep(img) { display: block; max-width: min(100%, 420px); max-height: 300px; margin: 6px 0; border-radius: 10px; border: 1px solid rgba(231, 197, 111, .25); cursor: zoom-in; object-fit: contain; }
.ar-tag.plan { background: none; border: 1px dashed rgba(127, 180, 255, .4); color: #9fbfe8; }
.ar-tag.plan b { color: #f0b54f; }
/* преимущество / помеха (классы без «adv» — блокировщики рекламы прячут .adv) */
.ar-tag.mode.m-hi { background: rgba(124, 207, 139, .16); color: #8fe09c; box-shadow: inset 0 0 0 1px rgba(124, 207, 139, .45); }
.ar-tag.mode.m-lo { background: rgba(255, 122, 107, .14); color: #ff9b8f; box-shadow: inset 0 0 0 1px rgba(255, 122, 107, .45); }
.ar-tag.mode.warn { background: rgba(240, 184, 96, .12); color: #f0b860; }
.ar-tag.mode.off { background: none; border: 1px dashed rgba(168, 147, 108, .45); color: #a8936c; }
.ar-mode { margin-left: 5px; padding: 0 6px; border-radius: 99px; font-weight: 800; white-space: nowrap; }
.ar-mode.m-hi { background: rgba(124, 207, 139, .2); color: #8fe09c; }
.ar-mode.m-lo { background: rgba(255, 122, 107, .18); color: #ff9b8f; }
.ar-mode s { opacity: .55; font-weight: 600; }
.ar-tag.sum { background: rgba(126, 208, 122, .14); color: #b4ecb0; }
.ar-tag.mentor { background: rgba(231, 197, 111, .12); color: #f3dc9e; }
.ar-tag.mentor a { color: inherit; text-decoration: underline dotted; }
.ar-miss { margin-left: 6px; font-style: normal; color: #ffcf7a; }
.ar-tag.coin { background: rgba(143, 133, 116, .15); color: #c9bda5; }
.ar-tag.coin.win { background: rgba(243, 211, 107, .16); color: #f3d36b; }
.ar-tag.mir { background: rgba(185, 166, 255, .12); color: #d2c8ff; }
.ar-by { color: #7d7160; font: 600 11px 'Manrope', sans-serif; }
.ar-num { padding: 2px 8px; border-radius: 8px; background: rgba(255, 255, 255, .04); color: #e6dcc4; font: 800 12.5px 'Manrope', sans-serif; white-space: nowrap; }
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
.ar-acts button.on { border-color: #e7c56f; background: rgba(231, 197, 111, .15); color: #f3dc9e; }
.ar-acts .del:hover { border-color: #ff7a6b; color: #ff7a6b; }
.ar-sealslot { grid-area: seal; position: relative; width: 0; height: 26px; transition: width .3s cubic-bezier(.3, 1.3, .5, 1); }
.ar-sealslot.on { width: 64px; }
.ar-seal { position: absolute; left: 50%; top: 50%; margin: -40px 0 0 -40px; z-index: 3; pointer-events: none; }
.ar-badge.hit, .ar-sel.hit { animation: ar-hit .7s ease; }
@keyframes ar-hit { 0% { transform: scale(1); } 30% { transform: scale(1.25); box-shadow: 0 0 18px var(--sc); } 100% { transform: scale(1); } }
@media (max-width: 760px) {
  .ar { grid-template-columns: 24px minmax(0, 1fr) auto; grid-template-areas: 'i n n' '. nums st' '. b b' '. f f'; }
  .ar-sealslot { position: absolute; right: 44px; top: 16px; width: 0 !important; }
}
</style>
