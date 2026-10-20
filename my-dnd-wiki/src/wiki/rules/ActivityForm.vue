<template>
  <!-- новая запись журнала / правка: подсказки из вики («Повторяемые» и «Уникальные деятельности») и из прошлых записей героя;
       выносливость считается сама — часы × выносливость в час; очки к тренировке листа — из результата («42+1» → 43) -->
  <form class="af" @submit.prevent="$emit('save')">
    <div class="af-row">
      <label class="af-f date">Сессия<input v-model="m.date" type="date" required class="af-in" /></label>
      <label class="af-f name">Деятельность
        <input v-model="m.name" :list="listId" required maxlength="600" class="af-in" placeholder="Например: Долгая тренировка (Владение: Звездная колода)" />
        <datalist :id="listId">
          <option v-for="n in recent" :key="'r' + n" :value="n" />
          <option v-for="c in catalog" :key="'c' + c.name" :value="c.name">{{ c.dur }} · {{ c.rate }} / ч</option>
        </datalist>
      </label>
    </div>
    <div class="af-row">
      <label class="af-f sm">Часы<input v-model="m.hours" class="af-in" placeholder="8" maxlength="30" /></label>
      <label class="af-f sm">Выносливость<input v-model="m.stamina" class="af-in" :placeholder="hint ? String(autoSt) : '1,6'" maxlength="30" @input="manualSt = true" /></label>
      <label class="af-f sm">Тип
        <select v-model="m.type" class="af-in"><option value="">—</option><option v-for="(t, k) in ACT_TYPES" :key="k" :value="k">{{ t.icon }} {{ t.name }}</option></select>
      </label>
      <label v-if="master" class="af-f sm">Статус
        <select v-model="m.status" class="af-in"><option v-for="(s, k) in ACT_STATUS" :key="k" :value="k">{{ s.name }}</option></select>
      </label>
    </div>
    <p v-if="hint" class="af-hint">📖 В вики: <b>{{ hint.name }}</b> — {{ hint.dur }}, {{ hint.rate }} выносливости в час<template v-if="num(m.hours)"> → {{ autoSt }}</template></p>
    <label class="af-f">Результат<textarea v-model="m.result" rows="2" maxlength="2000" class="af-in" placeholder="Броски, очки, что получилось…" /></label>
    <div v-if="hero?.trainings?.length" class="af-row">
      <label class="af-f name">Очки — в тренировку листа
        <select v-model="m.trainId" class="af-in">
          <option value="">не связывать</option>
          <option v-for="t in hero.trainings.filter(t => t.Id)" :key="t.Id" :value="t.Id">{{ t.Name }}{{ t.Stage ? ` (${t.Stage})` : '' }} · {{ t.Cur }}/{{ t.Max }}</option>
        </select>
      </label>
      <label v-if="m.trainId" class="af-f sm">Очки<input v-model.number="m.pts" type="number" class="af-in" @input="manualPts = true" /></label>
    </div>
    <p v-if="m.trainId" class="af-hint">Очки прибавятся к прогрессу тренировки, когда мастер поставит «учтено»; снимет статус — убавятся.</p>
    <div class="af-acts">
      <span class="grow" />
      <button type="button" class="af-btn" @click="$emit('cancel')">{{ isNew ? 'Закрыть' : 'Отмена' }}</button>
      <button type="submit" class="af-btn primary" :disabled="busy || !m.name.trim()">{{ isNew ? (master ? 'Записать' : 'Записать на проверку') : 'Сохранить' }}</button>
    </div>
  </form>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { actState } from '../../map/store.js'
import { ACT_STATUS, ACT_TYPES, num, ptsOf, round } from '../../shared/activities.js'

const m = defineModel({ type: Object, required: true })
const props = defineProps({ hero: { type: Object, default: null }, master: Boolean, catalog: { type: Array, default: () => [] }, busy: Boolean, isNew: Boolean })
defineEmits(['save', 'cancel'])
const listId = 'af-list-' + Math.random().toString(36).slice(2, 8)

// прошлые записи героя — самые частые сверху (повторяемые пишут десятками)
const recent = computed(() => {
  const cnt = new Map()
  for (const r of actState.logs[props.hero?.heroId] || []) cnt.set(r.name, (cnt.get(r.name) || 0) + 1)
  return [...cnt.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30).map(x => x[0]).filter(n => n.length < 120)
})
// подсказка из вики: самое длинное название из справочника, с которого начинается запись
const norm = s => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/g, ' ').trim()
const hint = computed(() => {
  const n = norm(m.value.name)
  if (n.length < 3) return null
  return props.catalog.filter(c => n.startsWith(norm(c.name)) || norm(c.name).startsWith(n)).sort((a, b) => b.name.length - a.name.length)[0] || null
})
const autoSt = computed(() => (hint.value ? round(num(m.value.hours) * hint.value.rate, 3) : 0))
const manualSt = ref(!!m.value.stamina)
const manualPts = ref(!!m.value.pts)
watch([hint, () => m.value.hours], () => {
  if (!hint.value) return
  if (!m.value.type) m.value.type = hint.value.type
  if (!manualSt.value && num(m.value.hours)) m.value.stamina = String(autoSt.value).replace('.', ',')
})
watch([() => m.value.result, () => m.value.trainId], () => {
  if (m.value.trainId && !manualPts.value) m.value.pts = ptsOf(m.value.result)
})
</script>

<style scoped>
.af { display: grid; gap: 8px; padding: 12px; border-radius: 16px; border: 1px solid rgba(231, 197, 111, .4); background: linear-gradient(180deg, rgba(231, 197, 111, .08), rgba(20, 16, 11, .85)); box-shadow: 0 12px 30px rgba(0, 0, 0, .35); }
.af-row { display: flex; flex-wrap: wrap; gap: 8px; }
.af-f { display: grid; gap: 3px; color: #a8936c; font: 800 10.5px 'Manrope', sans-serif; letter-spacing: .06em; text-transform: uppercase; }
.af-f.name { flex: 1 1 260px; }
.af-f.date { flex: 0 0 160px; }
.af-f.sm { flex: 1 1 110px; max-width: 180px; }
.af-in { width: 100%; box-sizing: border-box; padding: 7px 9px; border-radius: 9px; border: 1px solid rgba(231, 197, 111, .25); background: rgba(0, 0, 0, .35); color: #efe3c8; font: 600 13px 'Manrope', sans-serif; letter-spacing: 0; text-transform: none; color-scheme: dark; resize: vertical; }
.af-in:focus { outline: none; border-color: #e7c56f; }
.af-hint { margin: 0; color: #a8936c; font: 600 12px 'Manrope', sans-serif; }
.af-hint b { color: #f3dc9e; }
.af-acts { display: flex; gap: 8px; }
.grow { flex: 1; }
.af-btn { padding: 7px 14px; border-radius: 9px; border: 1px solid rgba(231, 197, 111, .35); background: rgba(231, 197, 111, .08); color: #f3d99a; font: 700 12.5px 'Manrope', sans-serif; cursor: pointer; }
.af-btn.primary { background: linear-gradient(180deg, #f0d083, #c9a24f); color: #1b1408; border-color: #c9a24f; }
.af-btn:disabled { opacity: .5; }
@media (max-width: 600px) { .af-f.date, .af-f.sm { flex: 1 1 45%; max-width: none; } }
</style>
