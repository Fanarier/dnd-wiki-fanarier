<template>
  <!-- новая запись журнала / правка. Подсказки: избранное героя, заказы гильдий, справочник из вики (тип и выносливость
       считаются сами), бонус повторения. «Подробнее» — с кем, где, модификатор места, тренировка, монеты, опыт,
       изнурение и вещи: при «учтено» всё это уйдёт в лист героя (снимут статус — вернётся) -->
  <form class="af" @submit.prevent="submit(master ? '' : 'pending')">
    <div v-if="favs.length || quests.length" class="af-quick">
      <button v-for="f in favs" :key="f.id" type="button" class="af-fav" :title="`Заполнить: ${f.name}${f.hours ? ' · ' + f.hours + ' ч' : ''}`" @click="useFav(f)">★ {{ f.name.length > 34 ? f.name.slice(0, 32) + '…' : f.name }}</button>
      <select v-if="quests.length" class="af-in af-quest" :value="''" title="Заполнить из заказа гильдии" @change="useQuest($event.target.value); $event.target.value = ''">
        <option value="">📜 Из заказа гильдии…</option>
        <option v-for="q in quests" :key="q.id" :value="q.id">{{ q.type }} · {{ q.guild }} · {{ q.danger }}/{{ q.difficulty }}{{ q.status === 'done' ? ' · выполнен' : '' }}</option>
      </select>
    </div>
    <div class="af-row">
      <label class="af-f date">Сессия<input v-model="m.date" type="date" required class="af-in" /></label>
      <label class="af-f name">Деятельность
        <ActNameInput v-model="m.name" :recent="recent" :catalog="catalog" placeholder="Например: Долгая тренировка (Владение: Звездная колода)" />
      </label>
    </div>
    <div class="af-row">
      <label class="af-f sm">Часы<input v-model="m.hours" class="af-in" placeholder="8" maxlength="30" /></label>
      <label class="af-f sm">Выносливость<input v-model="m.stamina" class="af-in" :placeholder="hint ? String(autoSt) : '1,6'" maxlength="30" @input="manualSt = true" /></label>
      <label class="af-f sm">Тип
        <select v-model="m.type" class="af-in"><option value="">—</option><option v-for="(t, k) in ACT_TYPES" :key="k" :value="k">{{ t.icon }} {{ t.name }}</option></select>
      </label>
      <label v-if="planDays" class="af-f sm">День<select v-model.number="m.day" class="af-in"><option :value="0">—</option><option v-for="d in planDays" :key="d" :value="d">{{ d }}</option></select></label>
      <label v-if="master" class="af-f sm">Статус
        <select v-model="m.status" class="af-in"><option v-for="(s, k) in ACT_STATUS" :key="k" :value="k">{{ s.name }}</option></select>
      </label>
    </div>
    <p v-if="hint || repeatNo > 1 || sleepWarn || formula || dblOffer" class="af-hint">
      <template v-if="hint">📖 В вики: <router-link :to="{ path: '/wiki', query: { section: 'activities', a: hint.articleId } }" target="_blank">{{ hint.name }}</router-link> — {{ hint.dur }}, {{ hint.rate }} выносливости в час<template v-if="num(m.hours)"> → {{ autoSt }}<template v-if="exhK > 1"> (×2 — у героя изнурение)</template></template>. </template>
      <template v-if="repeatNo > 1">↻ Повтор №{{ repeatNo }} в этой сессии — <b>+{{ repBonus }}</b> к броску. </template>
      <b v-if="sleepWarn" class="af-sleep">{{ sleepWarn }} </b>
      <span v-if="dblOffer" class="af-dbl">😵 У героя {{ hero.exh }} изнур. — выносливость удваивается: <b>{{ dblOffer.from }} → {{ dblOffer.to }}</b>
        <button type="button" class="af-dbl-yes" @click="applyDbl">Пересчитать</button><button type="button" class="af-dbl-no" @click="keepSt = true">Оставить</button></span>
      <template v-if="formula">🎲 Бросок: <b>{{ formula }}</b> — кнопкой 🎲 у записи.<template v-if="plan.unknown.length"> Без числа, не войдут: {{ plan.unknown.join(', ') }}.</template></template>
    </p>
    <div class="af-f">Результат<RichInput v-model="m.result" class="af-rich" placeholder="Броски, очки, что получилось… (можно с цветом и свечением)" :min-height="44" /></div>

    <button type="button" class="af-more" @click="more = !more">{{ more ? '▴ Меньше' : '▾ Подробнее: с кем, где, тренировка, монеты, вещи' }}<small v-if="!more && extras"> · заполнено: {{ extras }}</small></button>
    <div v-if="more" class="af-extra">
      <div v-if="others.length" class="af-f">С кем (запись появится и в их журналах)
        <div class="af-chips">
          <button v-for="h in others" :key="h.heroId" type="button" :class="{ on: m.with.includes(h.heroId) }" @click="toggleWith(h.heroId)">{{ h.name.split(' ')[0] }}</button>
        </div>
      </div>
      <div class="af-row">
        <label class="af-f name">Где (город на карте)
          <select v-model="m.place" class="af-in"><option value="">—</option><option v-for="c in cities" :key="c.id" :value="c.id">{{ c.name }}</option></select>
        </label>
        <label v-if="mods.length" class="af-f name">Место-модификатор из вики
          <select v-model="m.mod" class="af-in"><option value="">—</option><option v-for="x in mods" :key="x.name" :value="x.name">{{ x.name }} · {{ x.what }} · {{ x.die }}</option></select>
        </label>
      </div>
      <div v-if="hero?.trainings?.length" class="af-row">
        <label class="af-f name">Очки — в тренировку листа
          <select v-model="m.trainId" class="af-in">
            <option value="">не связывать</option>
            <option v-for="t in hero.trainings.filter(t => t.Id)" :key="t.Id" :value="t.Id">{{ t.Name }}{{ t.Stage ? ` (${t.Stage})` : '' }} · {{ t.Cur }}/{{ t.Max }}</option>
          </select>
        </label>
        <label v-if="m.trainId" class="af-f sm">Очки<input v-model.number="m.pts" type="number" class="af-in" @input="manualPts = true" /></label>
      </div>
      <div class="af-row">
        <label class="af-f xs">ЗМ<input v-model.number="m.gold" type="number" class="af-in" title="Плюс — получено, минус — потрачено" /></label>
        <label class="af-f xs">СМ<input v-model.number="m.silver" type="number" class="af-in" /></label>
        <label class="af-f xs">ММ<input v-model.number="m.copper" type="number" class="af-in" /></label>
        <label class="af-f xs">Опыт<input v-model.number="m.exp" type="number" class="af-in" /></label>
        <label class="af-f xs" title="Длительная тренировка: +4 и сразу минус ночной сон (сон −2, транс −1). Отдых снимает 1 за каждые 3 часа (минус — снять)">Изнурение<input v-model.number="m.exh" type="number" min="-5" max="5" class="af-in" @input="manualExh = true" /></label>
      </div>
      <p v-if="money" class="af-money" :class="{ short: money.short }">
        <template v-if="money.short">⚠ Не хватает денег: в листе {{ fmtCoins(money.have) }}, а тратится {{ fmtCoins(money.need) }}. Мастер увидит метку на проверке.</template>
        <template v-else>💱 Мелких монет не хватает — при «учтено» крупные разменяются (1 зм = 100 см, 1 см = 100 мм).</template>
      </p>
      <small v-if="hero?.coins" class="af-coins">В листе: {{ fmtCoins(coinsCopper(hero.coins)) }}</small>
      <div class="af-f">Вещи (плюс — получено, минус — отдано или продано; из инвентаря, склад или нет — неважно)
        <div v-for="(it, i) in m.items" :key="i" class="af-item">
          <ActNameInput v-model="it.name" :recent="invHints" :catalog="[]" :required="false" :maxlength="160" mine-title="В инвентаре героя" placeholder="Название" />
          <input v-model.number="it.qty" type="number" class="af-in qty" title="Плюс — получено, минус — отдано" />
          <label class="af-chk"><input v-model="it.stored" type="checkbox" /> на склад</label>
          <button type="button" class="af-x" @click="m.items.splice(i, 1)">✕</button>
          <div v-if="it.name.trim()" class="af-istat">
            <template v-if="it.qty < 0">
              <span v-if="it.created" class="ok">✨ создана в инвентаре — уйдёт при «учтено»</span>
              <span v-else-if="invHas(inv, it.name) && invCount(inv, it.name) >= -it.qty" class="ok">✓ в инвентаре: {{ invCount(inv, it.name) }} шт.</span>
              <span v-else-if="invHas(inv, it.name)" class="warn">⚠ в инвентаре только {{ invCount(inv, it.name) }} шт.</span>
              <span v-else class="warn">⚠ Не нашёл в инвентаре <button type="button" @click="askExists(it)">Она есть — добавить</button></span>
            </template>
            <template v-else-if="it.qty > 0">
              <span v-if="invHas(inv, it.name)" class="ok">✓ уже есть ({{ invCount(inv, it.name) }} шт.) — прибавится</span>
              <span v-else class="new">✦ новая вещь<template v-if="it.info"> · описана</template> <button type="button" @click="quick = { it, mode: 'describe' }">{{ it.info ? 'Изменить' : 'Описать' }}</button></span>
            </template>
          </div>
        </div>
        <button type="button" class="af-add" @click="m.items.push({ name: '', qty: 1, stored: false })">＋ вещь</button>
      </div>
      <ItemQuick v-if="quick" :item="quick.it" :mode="quick.mode" :busy="busyItem" @close="quick = null" @save="saveQuick" />
      <p v-if="sheetTouch" class="af-hint">Когда мастер поставит «учтено», это уйдёт в лист героя; снимет статус — вернётся обратно.</p>
    </div>

    <div class="af-acts">
      <button v-if="hero?.canWrite && m.name.trim()" type="button" class="af-btn ghost" title="Запомнить как заготовку — потом одной кнопкой" @click="$emit('fav', { ...m })">★ В избранное</button>
      <span class="grow" />
      <button type="button" class="af-btn" @click="$emit('cancel')">{{ isNew ? 'Закрыть' : 'Отмена' }}</button>
      <template v-if="master"><button type="submit" class="af-btn primary" :disabled="busy || !m.name.trim()">{{ isNew ? 'Записать' : 'Сохранить' }}</button></template>
      <template v-else>
        <button type="button" class="af-btn" :disabled="busy || !m.name.trim()" title="Черновик плана — мастер его не проверяет, пока не отправишь" @click="submit('plan')">В черновик</button>
        <button type="submit" class="af-btn primary" :disabled="busy || !m.name.trim()">На проверку</button>
      </template>
    </div>
  </form>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { store, actState } from '../../map/store.js'
import RichInput from '../../components/rich/RichInput.vue'
import ActNameInput from './ActNameInput.vue'
import ItemQuick from './ItemQuick.vue'
import { api, toast } from '../../map/store.js'
import { ACT_STATUS, ACT_TYPES, num, ptsOf, round, catalogMatch, normAct, rewardOf, rollPlan, isLongTraining, longExhNet, restExh, isRestRec, EXH_MAX, exhStaminaK, staminaDouble, moneyCheck, fmtCoins, coinsCopper, invCount, invHas } from '../../shared/activities.js'

const m = defineModel({ type: Object, required: true })
const props = defineProps({
  hero: { type: Object, default: null }, master: Boolean, catalog: { type: Array, default: () => [] }, mods: { type: Array, default: () => [] },
  busy: Boolean, isNew: Boolean, planDays: { type: Number, default: 0 }
})
const emit = defineEmits(['save', 'cancel', 'fav'])
// старые записи без новых полей
for (const [k, v] of Object.entries({ with: [], items: [], place: '', mod: '', gold: 0, silver: 0, copper: 0, exp: 0, exh: 0, day: 0, trainId: '', pts: 0 })) if (m.value[k] == null) m.value[k] = Array.isArray(v) ? [] : v

const log = computed(() => actState.logs[props.hero?.heroId] || [])
const cfg = computed(() => actState.cfg[props.hero?.heroId] || {})
const favs = computed(() => cfg.value.favs || [])
// прошлые записи героя — самые частые сверху (повторяемые пишут десятками)
const recent = computed(() => {
  const cnt = new Map()
  for (const r of log.value) cnt.set(r.name, (cnt.get(r.name) || 0) + 1)
  return [...cnt.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30).map(x => x[0]).filter(n => n.length < 120)
})
const hint = computed(() => catalogMatch(props.catalog, m.value.name))
// изнурение удваивает затраты выносливости (отдых не трогаем — он её возвращает)
const exhK = computed(() => (hint.value?.rate > 0 ? exhStaminaK(props.hero?.exh) : 1))
const autoSt = computed(() => (hint.value ? round(num(m.value.hours) * hint.value.rate * exhK.value, 3) : 0))
// выносливость не удвоена, а у героя изнурение — предложить пересчитать (или оставить)
const keepSt = ref(false)
const dblOffer = computed(() => (keepSt.value ? null : staminaDouble(m.value, props.hero, hint.value)))
watch(() => [m.value.name, m.value.hours], () => { keepSt.value = false })
function applyDbl() { m.value.stamina = dblOffer.value.to; manualSt.value = true }
// 5 изнурений — эффект «Сон»
const exhNow = computed(() => Number(props.hero?.exh) || 0)
const sleepWarn = computed(() => {
  if (isRest()) return ''
  if (exhNow.value >= EXH_MAX) return `😴 У героя ${EXH_MAX} изнурений — эффект «Сон»: пока изнурение не снимут отдыхом, по правилам можно только отдыхать.`
  if (m.value.exh > 0 && exhNow.value + m.value.exh >= EXH_MAX) return `⚠ Эта запись доведёт изнурение до ${EXH_MAX} (сейчас ${exhNow.value}, +${m.value.exh}) — эффект «Сон».`
  return ''
})
const manualSt = ref(!!m.value.stamina)
const manualPts = ref(!!m.value.pts)
const manualExh = ref(!props.isNew)
watch([hint, () => m.value.hours], () => {
  if (!hint.value) return
  if (!m.value.type) m.value.type = hint.value.type
  if (!manualSt.value && num(m.value.hours)) m.value.stamina = String(autoSt.value).replace('.', ',')
})
// изнурение само: длительная тренировка/обучение даёт 4, отдых снимает — 1 за каждые 3 часа (6 часов — 2)
const isRest = () => isRestRec(m.value)
watch([() => m.value.name, () => m.value.hours, () => m.value.stamina], () => {
  if (manualExh.value) return
  m.value.exh = isLongTraining(m.value.name) ? longExhNet(cfg.value.sleep) : isRest() ? restExh(m.value.hours) : 0
})
watch([() => m.value.result, () => m.value.trainId], () => {
  if (m.value.trainId && !manualPts.value) m.value.pts = ptsOf(m.value.result)
})

// бонус повторяемой деятельности: +1 за каждое повторение в сессии, не больше 10
const repeatNo = computed(() => {
  if (m.value.type !== 'repeat') return 0
  const n = normAct(m.value.name)
  return log.value.filter(r => r.date === m.value.date && r.id !== m.value.id && normAct(r.name) === n && r.status !== 'cancel').length + 1
})
const repBonus = computed(() => Math.min(10, Math.max(0, repeatNo.value - 1)))
const mod = computed(() => props.mods.find(x => x.name === m.value.mod))
// бросок: модификаторы из строки «Модификаторы броска: …» складываются сами
const plan = computed(() => rollPlan(m.value, mod.value, m.value.type === 'repeat' ? repBonus.value : 0))
const formula = computed(() => {
  const p = plan.value
  if (!(m.value.type === 'repeat' || mod.value || p.items.length || p.long || p.rep != null)) return ''
  return p.long ? `(${p.formula}) × 1.35${p.add ? ' + ' + p.add : ''}` : p.formula
})

const others = computed(() => actState.heroes.filter(h => h.heroId !== props.hero?.heroId))
const toggleWith = id => { const w = m.value.with; const i = w.indexOf(id); i >= 0 ? w.splice(i, 1) : w.push(id) }
const cities = computed(() => (store.data.cities || []).slice().sort((a, b) => a.name.localeCompare(b.name, 'ru')))
const quests = computed(() => (store.data.quests || []).filter(q => ['taken', 'done', 'available'].includes(q.status)).slice().sort((a, b) => (b.postedAt || 0) - (a.postedAt || 0)).slice(0, 30))
const sheetTouch = computed(() => !!(m.value.gold || m.value.silver || m.value.copper || m.value.exp || m.value.exh || m.value.items.length || m.value.trainId))
const extras = computed(() => [m.value.with.length && 'с кем', m.value.place && 'где', m.value.mod && 'место', m.value.trainId && 'тренировка', (m.value.gold || m.value.silver || m.value.copper) && 'монеты', m.value.exp && 'опыт', m.value.exh && 'изнурение', m.value.items.length && 'вещи'].filter(Boolean).join(', '))
const more = ref(!!extras.value)

function useFav(f) {
  Object.assign(m.value, { name: f.name, hours: f.hours, stamina: f.stamina, type: f.type, trainId: f.trainId, mod: f.mod, place: f.place })
  manualSt.value = !!f.stamina
  if (f.trainId || f.mod || f.place) more.value = true
}
function useQuest(id) {
  const q = (store.data.quests || []).find(x => x.id === id)
  if (!q) return
  const rw = q.reward && typeof q.reward === 'object' ? q.reward : rewardOf(q.reward)
  Object.assign(m.value, {
    name: `Заказ гильдии: «${q.type}» (${q.danger} опасность, ${q.difficulty} сложность)`, hours: q.duration ? String(q.duration) : m.value.hours,
    stamina: '0', type: 'unique', gold: Number(rw.gold) || 0, exp: Number(rw.exp) || 0, result: m.value.result || (q.reward?.other || '')
  })
  manualSt.value = true
  more.value = true
}
function submit(status) {
  m.value.items = m.value.items.filter(it => it.name.trim() && it.qty)
  // отдаётся вещь, которой нет в инвентаре, — спросить: точно есть? Да — окно, вещь ляжет в инвентарь; нет — поправить
  const lost = m.value.items.find(it => it.qty < 0 && !it.created && !invHas(inv.value, it.name))
  if (lost && props.hero?.hasSheet) {
    if (confirm(`Не могу найти «${lost.name}» в инвентаре героя (ни в сумке, ни на складе).\nУверен, что эта вещь у него есть?\n\nОК — да, добавлю её в инвентарь; Отмена — поправлю запись`)) askExists(lost)
    return
  }
  emit('save', status)
}

/* ---------- вещи и деньги: что есть в листе ---------- */
const inv = computed(() => props.hero?.inv || [])
const invHints = computed(() => {
  const by = new Map()
  for (const x of inv.value) { const k = x.name.toLowerCase(); const o = by.get(k) || { name: x.name, qty: 0, stored: 0 }; o.qty += x.qty; if (x.stored) o.stored += x.qty; by.set(k, o) }
  return [...by.values()].map(o => ({ name: o.name, sub: `${o.qty} шт.${o.stored ? (o.stored === o.qty ? ' · склад' : ` · ${o.stored} на складе`) : ''}` }))
})
const money = computed(() => moneyCheck(props.hero?.coins, m.value))
const quick = ref(null), busyItem = ref(false)
const askExists = it => { quick.value = { it, mode: 'exists' } }
async function saveQuick(v) {
  const { it, mode } = quick.value
  if (mode === 'describe') { Object.assign(it, { name: v.name, stored: v.stored, info: v.info }); it.qty = Math.abs(v.qty); quick.value = null; return }
  busyItem.value = true
  try {
    await api('POST', `/api/activities-item/${props.hero.heroId}`, { name: v.name, qty: v.qty, stored: v.stored, info: v.info })
    Object.assign(it, { name: v.name, created: true })
    if (-it.qty > v.qty) it.qty = -v.qty // отдать больше, чем есть, нельзя
    toast(`«${v.name}» добавлена в инвентарь — при «учтено» уйдёт. Теперь сохрани запись`)
    quick.value = null
  } catch (e) { toast(e.message, 'error') } finally { busyItem.value = false }
}
</script>

<style scoped>
.af { display: grid; gap: 8px; padding: 12px; border-radius: 16px; border: 1px solid rgba(231, 197, 111, .4); background: linear-gradient(180deg, rgba(231, 197, 111, .08), rgba(20, 16, 11, .9)); box-shadow: 0 12px 30px rgba(0, 0, 0, .35); }
.af-quick { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
.af-fav { padding: 3px 9px; border-radius: 99px; border: 1px solid rgba(243, 211, 107, .4); background: rgba(243, 211, 107, .08); color: #f3d36b; font: 700 12px 'Manrope', sans-serif; cursor: pointer; }
.af-fav:hover { background: rgba(243, 211, 107, .18); }
.af-quest { width: auto; max-width: 280px; padding: 3px 8px; font-size: 12px; }
.af-row { display: flex; flex-wrap: wrap; gap: 8px; }
.af-f { display: grid; gap: 3px; color: #a8936c; font: 800 10.5px 'Manrope', sans-serif; letter-spacing: .06em; text-transform: uppercase; }
.af-f.name { flex: 1 1 240px; }
.af-f.date { flex: 0 0 160px; }
.af-f.sm { flex: 1 1 110px; max-width: 180px; }
.af-f.xs { flex: 1 1 70px; max-width: 110px; }
.af-in { width: 100%; box-sizing: border-box; padding: 7px 9px; border-radius: 9px; border: 1px solid rgba(231, 197, 111, .25); background: rgba(0, 0, 0, .35); color: #efe3c8; font: 600 13px 'Manrope', sans-serif; letter-spacing: 0; text-transform: none; color-scheme: dark; resize: vertical; }
.af-in:focus { outline: none; border-color: #e7c56f; }
.af-rich { background: rgba(0, 0, 0, .35); letter-spacing: 0; text-transform: none; font-weight: 500; }
.af-hint { margin: 0; color: #a8936c; font: 600 12px/1.5 'Manrope', sans-serif; }
.af-hint b, .af-hint a { color: #f3dc9e; }
.af-more { justify-self: start; padding: 4px 0; border: 0; background: none; color: #e7c56f; font: 700 12.5px 'Manrope', sans-serif; cursor: pointer; }
.af-more small { color: #a8936c; }
.af-extra { display: grid; gap: 8px; padding: 10px; border-radius: 12px; background: rgba(0, 0, 0, .2); border: 1px solid rgba(231, 197, 111, .12); }
.af-chips { display: flex; flex-wrap: wrap; gap: 4px; }
.af-chips button { padding: 3px 10px; border-radius: 99px; border: 1px solid rgba(239, 127, 176, .3); background: none; color: #e9c4d6; font: 700 12px 'Manrope', sans-serif; letter-spacing: 0; text-transform: none; cursor: pointer; }
.af-chips button.on { background: rgba(239, 127, 176, .2); border-color: #ef7fb0; color: #fff; }
.af-item { display: flex; gap: 6px; align-items: center; }
.af-item .qty { width: 80px; flex: none; }
.af-chk { display: flex; align-items: center; gap: 4px; flex: none; color: #cdbf9f; font: 600 12px 'Manrope', sans-serif; letter-spacing: 0; text-transform: none; }
.af-x { flex: none; width: 28px; height: 28px; border-radius: 8px; border: 1px solid rgba(255, 122, 107, .35); background: none; color: #ff9b8f; cursor: pointer; }
.af-add { justify-self: start; padding: 4px 10px; border-radius: 8px; border: 1px dashed rgba(231, 197, 111, .4); background: none; color: #e7c56f; font: 700 12px 'Manrope', sans-serif; letter-spacing: 0; text-transform: none; cursor: pointer; }
.af-acts { display: flex; flex-wrap: wrap; gap: 8px; }
.grow { flex: 1; }
.af-btn { padding: 7px 14px; border-radius: 9px; border: 1px solid rgba(231, 197, 111, .35); background: rgba(231, 197, 111, .08); color: #f3d99a; font: 700 12.5px 'Manrope', sans-serif; cursor: pointer; }
.af-btn.primary { background: linear-gradient(180deg, #f0d083, #c9a24f); color: #1b1408; border-color: #c9a24f; }
.af-btn.ghost { border-style: dashed; }
.af-btn:disabled { opacity: .5; }
@media (max-width: 600px) { .af-f.date, .af-f.sm { flex: 1 1 45%; max-width: none; } .af-f.xs { flex: 1 1 28%; } }
.af-sleep { display: block; margin-bottom: 4px; color: #ffb3aa; }
.af-dbl { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin: 2px 0 6px; padding: 6px 9px; border-radius: 10px; background: rgba(255, 122, 107, .1); border: 1px solid rgba(255, 122, 107, .3); color: #ffcfc8; }
.af-dbl button { padding: 3px 10px; border-radius: 8px; border: 1px solid rgba(231, 197, 111, .35); background: rgba(0, 0, 0, .3); color: #f3dc9e; font: 700 12px 'Manrope', sans-serif; cursor: pointer; }
.af-dbl .af-dbl-yes { background: linear-gradient(180deg, #f0d083, #c9a24f); color: #1b1408; border: 0; }
.af-item { flex-wrap: wrap; }
.af-item > .ani { flex: 1; min-width: 160px; }
.af-istat { flex-basis: 100%; font: 700 11.5px 'Manrope', sans-serif; padding-left: 2px; }
.af-istat .ok { color: #9fdc9a; } .af-istat .warn { color: #ffb3aa; } .af-istat .new { color: #f3d36b; }
.af-istat button { margin-left: 4px; padding: 2px 9px; border-radius: 7px; border: 0; background: linear-gradient(180deg, #f0d083, #c9a24f); color: #1b1408; font: 800 11px 'Manrope', sans-serif; cursor: pointer; }
.af-money { margin: 0; padding: 6px 9px; border-radius: 10px; background: rgba(240, 181, 79, .1); color: #f6cf86; font: 700 12px 'Manrope', sans-serif; }
.af-money.short { background: rgba(255, 122, 107, .12); color: #ffb3aa; }
.af-coins { color: #a8936c; font: 700 11.5px 'Manrope', sans-serif; }
</style>
