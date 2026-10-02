<template>
  <div class="qe-modal" @mousedown.self="$emit('close')">
    <form class="qe" @submit.prevent="save">
      <header class="qe-head">
        <div>
          <div class="qe-kicker">{{ isNew ? 'Новый заказ' : 'Заказ' }}</div>
          <h2>{{ f.type || 'Заказ' }} · {{ f.guild }}</h2>
        </div>
        <button type="button" class="qe-x" @click="$emit('close')">×</button>
      </header>

      <div class="qe-body">
        <section>
          <div class="row">
            <label>Гильдия
              <select v-model="f.guild"><option v-for="g in GUILDS" :key="g.name" :value="g.name">{{ g.name }} — {{ g.country }}</option></select>
            </label>
            <label>Тип заказа
              <input v-model="f.type" list="qe-types" maxlength="40" />
              <datalist id="qe-types"><option v-for="t in QUEST_TYPES" :key="t" :value="t" /></datalist>
            </label>
          </div>
          <label>Описание<textarea v-model="f.description" rows="4" /></label>
          <div class="row">
            <label>Длительность, ч<input v-model.number="f.duration" type="number" min="0" /></label>
            <label>Минимальный ранг
              <select v-model="f.rank"><option v-for="r in RANKS" :key="r.key" :value="r.key">{{ r.label }}</option></select>
            </label>
          </div>
          <div class="row three">
            <label>Опасность<select v-model.number="f.danger"><option v-for="n in 4" :key="n" :value="n - 1">{{ n - 1 }}</option></select></label>
            <label>Сложность<select v-model.number="f.difficulty"><option v-for="n in 4" :key="n" :value="n - 1">{{ n - 1 }}</option></select></label>
            <label>Срочность (видят игроки)
              <select v-model="f.urgency"><option v-for="(u, k) in URGENCY" :key="k" :value="k">{{ u.label }}</option></select>
            </label>
          </div>
          <div class="tags">
            <label v-for="(t, k) in QUEST_TAGS" :key="k" class="chk"><input v-model="f.tags" type="checkbox" :value="k" /> {{ t.label }}</label>
          </div>
        </section>

        <section>
          <h4>Награда</h4>
          <div v-for="key in ['reward', 'bonus']" :key="key" class="row reward">
            <span class="rw-title">{{ key === 'reward' ? 'Основная' : 'Дополнительная' }}</span>
            <label>Опыт<input v-model.number="f[key].exp" type="number" min="0" /></label>
            <label>ЗМ<input v-model.number="f[key].gold" type="number" min="0" /></label>
            <label class="chk"><input v-model="f[key].rep" type="checkbox" /> Репутация</label>
            <label class="grow">Ещё<input v-model="f[key].other" maxlength="200" placeholder="предмет, услуга…" /></label>
          </div>
        </section>

        <section>
          <h4>Задачи</h4>
          <div v-for="(t, i) in f.tasks" :key="i" class="task">
            <select v-model="t.main" class="t-kind"><option :value="true">Основная</option><option :value="false">Дополнительная</option></select>
            <input v-model="t.text" maxlength="300" placeholder="Добыть 10 туш «Большерогий чибис»" />
            <select v-model="t.status" class="t-st"><option v-for="(s, k) in TASK_STATUS" :key="k" :value="k">{{ s.label }}</option></select>
            <button type="button" class="mini no" @click="f.tasks.splice(i, 1)">×</button>
          </div>
          <button v-if="f.tasks.length < 20" type="button" class="mini" @click="f.tasks.push({ text: '', main: !f.tasks.length, status: 'active' })">+ Задача</button>
        </section>

        <section>
          <h4>Группа (до {{ MAX_GROUP }})</h4>
          <div class="group">
            <div v-for="(m, i) in f.group" :key="i" class="member">
              <button type="button" class="face" :title="'Портрет: выбери ниже'" @click="pickFor = pickFor === i ? null : i">
                <img v-if="imgOf(m.icon)" :src="imgOf(m.icon)" alt="" />
                <span v-else>?</span>
              </button>
              <input v-model="m.name" maxlength="40" placeholder="Имя" />
              <button type="button" class="mini no" @click="f.group.splice(i, 1)">×</button>
            </div>
            <button v-if="f.group.length < MAX_GROUP" type="button" class="mini" @click="f.group.push({ name: '', icon: '' })">+ Участник</button>
          </div>
          <div v-if="pickFor !== null" class="faces">
            <div class="hint">Портреты берутся из библиотеки своих иконок (загружаются на карте в карточке метки).</div>
            <button v-for="ic in store.data.icons" :key="ic.id" type="button" class="face" :title="ic.name" @click="f.group[pickFor].icon = 'u:' + ic.id; pickFor = null">
              <img :src="`/usericons/${ic.file}`" alt="" />
            </button>
            <button type="button" class="face" title="Без портрета" @click="f.group[pickFor].icon = ''; pickFor = null"><span>—</span></button>
          </div>
        </section>

        <section>
          <h4>Статус и итог</h4>
          <div class="row three">
            <label>Статус<select v-model="f.status"><option v-for="(s, k) in QUEST_STATUS" :key="k" :value="k">{{ s.label }}</option></select></label>
            <label>Итог
              <select v-model="f.result"><option :value="null">—</option><option v-for="(r, k) in QUEST_RESULT" :key="k" :value="k">{{ r.label }}</option></select>
            </label>
            <label class="chk"><input v-model="f.hidden" type="checkbox" /> Скрыть от игроков</label>
          </div>
          <label>Отчёт для хроники (видят все)<textarea v-model="f.report" rows="2" placeholder="Чибисы добыты, Нэко ранен в стычке…" /></label>
          <label>🔒 Заметки мастера<textarea v-model="f.secret" rows="2" /></label>
        </section>

        <section class="master-only">
          <h4>⏳ Срок и шанс досрочного закрытия <small>(видит только мастер)</small></h4>
          <div class="row">
            <label>Опубликован<input v-model="postedStr" type="datetime-local" /></label>
            <label>Снять с доски в<input v-model="expiresStr" type="datetime-local" /></label>
          </div>
          <label class="chk"><input v-model="f.early.enabled" type="checkbox" /> Заказ может забрать другая группа</label>
          <template v-if="f.early.enabled">
            <div class="row three">
              <label>Шанс при публикации, %<input v-model.number="f.early.start" type="number" min="0" max="100" /></label>
              <label>+ % за реальные сутки<input v-model.number="f.early.perDay" type="number" min="0" max="100" step="0.5" /></label>
              <label>Потолок, %<input v-model.number="f.early.max" type="number" min="0" max="100" /></label>
            </div>
            <label class="chk"><input v-model="f.early.auto" type="checkbox" /> Бросать d100 автоматически раз в сутки</label>
            <div class="curve">
              <div v-for="d in curve" :key="d.day" class="c-col" :title="`через ${d.day} дн.: ${d.v.toFixed(0)}%`">
                <i :style="{ height: d.v + '%', background: urgColor }" /><span>{{ d.day }}д</span><b>{{ d.v.toFixed(0) }}</b>
              </div>
            </div>
            <div class="hint">
              Сейчас: <b>{{ chanceNow.toFixed(0) }}%</b>. Срочность «{{ URGENCY[f.urgency].label }}» ускоряет рост ×{{ URGENCY[f.urgency].mult }}.
              Если d100 ≤ шанса — заказ снимается: «его выполнила другая группа».
            </div>
          </template>
        </section>

        <section>
          <h4>🗺 Место на карте</h4>
          <div class="row">
            <label>Город
              <select :value="cityAt" @change="setCity($event.target.value)">
                <option value="">— не привязан —</option>
                <option v-if="cityAt === '__pt'" value="__pt">Точка на карте ({{ Math.round(f.loc.x) }}, {{ Math.round(f.loc.y) }})</option>
                <option v-for="c in citiesSorted" :key="c.id" :value="c.id">{{ c.name }}</option>
              </select>
            </label>
            <button type="button" class="mini pick" @click="$emit('pick-on-map', f)">📍 Указать точку на карте…</button>
          </div>
        </section>
      </div>

      <footer class="qe-foot">
        <button v-if="!isNew" type="button" class="mini no" @click="$emit('delete', f)">Удалить</button>
        <span class="grow" />
        <button type="button" class="btn" @click="$emit('close')">Отмена</button>
        <button type="submit" class="btn primary" :disabled="busy">{{ isNew ? 'Вывесить на доску' : 'Сохранить' }}</button>
      </footer>
    </form>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { GUILDS, RANKS, QUEST_TYPES, QUEST_STATUS, TASK_STATUS, QUEST_RESULT, MAX_GROUP } from '../shared/catalog.js'
import { URGENCY, QUEST_TAGS, EARLY_DEFAULT, earlyChance, DAY } from '../shared/quests.js'
import { store, portraitUrl } from '../map/store.js'

const props = defineProps({ quest: { type: Object, default: null }, busy: Boolean })
const emit = defineEmits(['close', 'save', 'delete', 'pick-on-map'])

const isNew = !props.quest?.id
const blank = {
  guild: GUILDS[0].name, type: 'Охота', description: '', duration: 24, rank: 'bronze', danger: 0, difficulty: 0,
  urgency: 'normal', tags: [], reward: { exp: 100, gold: 20, rep: true, other: '' }, bonus: { exp: 0, gold: 0, rep: false, other: '' },
  tasks: [{ text: '', main: true, status: 'active' }], group: [], status: 'available', result: null, report: '', secret: '',
  hidden: false, postedAt: Date.now(), expiresAt: null, early: { ...EARLY_DEFAULT }, loc: null
}
const f = ref(JSON.parse(JSON.stringify({ ...blank, ...(props.quest || {}) })))
f.value.early = { ...EARLY_DEFAULT, ...f.value.early }
f.value.reward = { ...blank.reward, ...f.value.reward }
f.value.bonus = { ...blank.bonus, ...f.value.bonus }

const pickFor = ref(null)
const imgOf = icon => portraitUrl(icon) || null

const toLocal = ms => {
  if (!ms) return ''
  const d = new Date(ms)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
const postedStr = computed({ get: () => toLocal(f.value.postedAt), set: v => { f.value.postedAt = v ? new Date(v).getTime() : Date.now() } })
const expiresStr = computed({ get: () => toLocal(f.value.expiresAt), set: v => { f.value.expiresAt = v ? new Date(v).getTime() : null } })

const urgColor = computed(() => URGENCY[f.value.urgency]?.color)
const chanceNow = computed(() => earlyChance(f.value, store.now))
// как будет расти шанс в ближайшую неделю
const curve = computed(() => Array.from({ length: 8 }, (_, day) => ({ day, v: earlyChance(f.value, (f.value.postedAt || Date.now()) + day * DAY) })))

const citiesSorted = computed(() => [...store.data.cities].sort((a, b) => a.name.localeCompare(b.name, 'ru')))
// город, если место совпадает с городом; иначе «точка на карте»
const cityAt = computed(() => (f.value.loc ? store.data.cities.find(c => Math.hypot(c.x - f.value.loc.x, c.y - f.value.loc.y) < 0.5)?.id || '__pt' : ''))
function setCity(id) {
  if (id === '__pt') return
  const c = store.data.cities.find(x => x.id === id)
  f.value.loc = c ? { x: c.x, y: c.y } : null
}

function save() {
  const q = f.value
  q.tasks = q.tasks.filter(t => t.text.trim())
  q.group = q.group.filter(m => m.name.trim() || m.icon)
  emit('save', q)
}
</script>

<style scoped>
.qe-modal { position: fixed; inset: 0; z-index: 100; background: rgba(5, 7, 11, .65); display: grid; place-items: center; padding: 16px; backdrop-filter: blur(3px); }
.qe { width: min(760px, 100%); max-height: calc(100vh - 32px); display: flex; flex-direction: column; background: #141a24; color: #ece6da; border: 1px solid rgba(231, 197, 111, .25); border-radius: 16px; box-shadow: 0 20px 60px rgba(0, 0, 0, .6); font: 13.5px 'Manrope', sans-serif; }
.qe-head { display: flex; justify-content: space-between; align-items: flex-start; padding: 16px 20px 10px; border-bottom: 1px solid rgba(255, 255, 255, .08); }
.qe-kicker { font-size: 11px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: #9d978b; }
.qe-head h2 { margin: 2px 0 0; font: 700 26px 'Cormorant Garamond', Georgia, serif; color: #f3dc9e; }
.qe-x { background: none; border: 0; color: #9d978b; font-size: 26px; cursor: pointer; }
.qe-body { overflow-y: auto; padding: 8px 20px 16px; }
section { padding: 12px 0; border-bottom: 1px solid rgba(255, 255, 255, .06); }
h4 { margin: 0 0 10px; font: 700 15px 'Manrope', sans-serif; color: #e7c56f; }
h4 small { color: #9d978b; font-weight: 600; }
label { display: grid; gap: 4px; font-size: 11.5px; font-weight: 700; color: #9d978b; margin-bottom: 8px; }
input, select, textarea { width: 100%; min-height: 34px; padding: 6px 9px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, .1); background: rgba(0, 0, 0, .3); color: #ece6da; font: 500 13px 'Manrope', sans-serif; box-sizing: border-box; }
select option { background: #141a24; }
textarea { resize: vertical; }
input:focus, select:focus, textarea:focus { outline: none; border-color: rgba(231, 197, 111, .6); }
input[type='checkbox'] { width: 16px; min-height: 16px; accent-color: #e7c56f; }
.chk { display: flex; align-items: center; gap: 8px; color: #ece6da; font-size: 13px; font-weight: 600; }
.row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; align-items: end; }
.row.three { grid-template-columns: 1fr 1fr 1fr; }
.tags { display: flex; flex-wrap: wrap; gap: 4px 16px; }
.reward { grid-template-columns: 110px 90px 90px auto 1fr; }
.rw-title { font-weight: 800; padding-bottom: 16px; }
.task { display: grid; grid-template-columns: 130px 1fr 130px 30px; gap: 6px; margin-bottom: 6px; }
.mini { border: 1px solid rgba(255, 255, 255, .15); background: rgba(255, 255, 255, .05); color: #ece6da; border-radius: 8px; padding: 6px 12px; font: 700 12px 'Manrope', sans-serif; cursor: pointer; }
.mini.no { color: #ff9b8f; }
.mini.pick { margin-bottom: 8px; }
.group { display: grid; gap: 6px; }
.member { display: grid; grid-template-columns: 40px 1fr 30px; gap: 6px; align-items: center; }
.face { width: 38px; height: 38px; border-radius: 50%; border: 1.5px solid rgba(231, 197, 111, .5); background: rgba(255, 255, 255, .05); overflow: hidden; padding: 0; cursor: pointer; display: grid; place-items: center; color: #9d978b; }
.face img { width: 100%; height: 100%; object-fit: cover; }
.faces { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; padding: 10px; border-radius: 10px; background: rgba(0, 0, 0, .25); }
.hint { width: 100%; font-size: 12px; color: #9d978b; margin-bottom: 4px; }
.hint b { color: #f3dc9e; }
.master-only { background: rgba(122, 92, 255, .06); margin: 8px -20px; padding: 12px 20px; }
.curve { display: flex; gap: 6px; align-items: flex-end; height: 90px; margin: 4px 0 8px; }
.c-col { flex: 1; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; font-size: 10px; color: #9d978b; position: relative; }
.c-col i { width: 100%; border-radius: 4px 4px 0 0; min-height: 2px; }
.c-col b { position: absolute; top: 0; color: #ece6da; font-size: 10.5px; }
.qe-foot { display: flex; gap: 8px; align-items: center; padding: 12px 20px; border-top: 1px solid rgba(255, 255, 255, .08); }
.grow { flex: 1; }
.btn { border: 1px solid rgba(255, 255, 255, .12); background: rgba(255, 255, 255, .05); color: #ece6da; border-radius: 10px; padding: 9px 16px; font: 700 13px 'Manrope', sans-serif; cursor: pointer; }
.btn.primary { background: linear-gradient(180deg, #f0d083, #c9a24f); color: #1b1408; border: 0; }
.btn:disabled { opacity: .5; }
@media (max-width: 640px) {
  .row, .row.three, .reward, .task { grid-template-columns: 1fr; }
}
</style>
