<template>
  <!-- калькулятор тренировки: моды, место, наставник, кубик, повторение (только у повторяемых), моды к каждому кубику —
       средний итог обычных и длительной ×N за одно и то же время (N суток длительной против обычных по 8 ч на то же время),
       очки в час и на выносливость. Средние значения: к20 с учётом натуральных 1 и 20 -->
  <div class="ac">
    <div class="ac-in">
      <label>Моды броска<input v-model.number="f.flat" type="number" /></label>
      <label>Место
        <select v-model="f.place"><option value="">—</option><option v-for="m in places" :key="m.name" :value="m.formula">{{ m.name }} · {{ m.die }}</option></select>
      </label>
      <label>Наставник<input v-model.number="f.mentor" type="number" placeholder="+0" /></label>
      <label>Кубик<select v-model.number="f.die"><option v-for="d in ACT_DICE" :key="d" :value="d">к{{ d }}</option></select></label>
      <label>Повторение с<input v-model.number="f.rep" type="number" min="0" max="10" /></label>
      <label>Раз подряд ×N<input v-model.number="f.times" type="number" min="1" :max="MAX_TIMES" /></label>
      <label class="chk" title="Бонус повторения — только у повторяемых деятельностей (и у длительной тоже)"><input v-model="f.repeat" type="checkbox" /> ↻ повторяемая</label>
      <label class="chk" title="Модификаторы прибавляются к каждому кубику броска (у длительной 2к20 — дважды, кубик места — тоже), а не один раз"><input v-model="f.perDie" type="checkbox" /> ➕ моды к каждому кубику</label>
      <label class="chk"><input v-model="f.elf" type="checkbox" /> 🧝 эльф (20 ч)</label>
    </div>

    <table class="ac-t">
      <thead><tr><th /><th>Попыток</th><th>Часы</th><th>Выносл.</th><th>В среднем</th><th>Очков в час</th><th>Очков на 1 выносл.</th></tr></thead>
      <tbody>
        <tr v-for="r in rows" :key="r.id" :class="r.id">
          <td><b>{{ r.name }}</b><small>{{ r.formula }}</small></td>
          <td>{{ r.n }}</td><td>{{ r.hours }}</td><td>{{ fmt(r.stamina) }}</td>
          <td><b>{{ r.total }}</b><small v-if="r.each.length > 1">{{ r.each.length > 8 ? r.each.slice(0, 3).join(' + ') + ' + … + ' + r.each[r.each.length - 1] : r.each.join(' + ') }}</small></td>
          <td :class="{ win: r.perH >= other(r).perH }">{{ fmt(r.perH) }}</td>
          <td :class="{ win: r.perSt >= other(r).perSt }">{{ fmt(r.perSt) }}</td>
        </tr>
      </tbody>
    </table>
    <p class="ac-sum">
      Длительная по сравнению с обычной: <b :class="kpdH >= 100 ? 'up' : 'down'">{{ kpdH }}%</b> по времени,
      <b :class="kpdSt >= 100 ? 'up' : 'down'">{{ kpdSt }}%</b> по выносливости <small>(100% — так же выгодно)</small>.
      {{ advice }}
    </p>
    <p class="ac-note">Средние значения кубиков{{ f.die === 20 ? '; на к20 учтены натуральные 1 (кубик не в счёт) и 20 (×2)' : '' }}. Сброс повторения от 1 здесь не считается — в игре он немного уменьшит итог у обоих.</p>
  </div>
</template>

<script setup>
import { computed, reactive } from 'vue'
import { rulesState, loadRules } from '../../map/store.js'
import { ACT_DICE, LONG_MULT, LONG_STAMINA, MAX_TIMES, activityMods } from '../../shared/activities.js'

loadRules()
const f = reactive({ flat: 13, place: '1d20', mentor: 0, die: 20, rep: 0, times: 1, elf: false, repeat: true, perDie: false })
const places = computed(() => activityMods(rulesState.articles))
const fmt = n => (Math.round(n * 10) / 10).toLocaleString('ru-RU')
const SHORT_H = 8, SHORT_ST = 1.6

// среднее «кубиков + модов» одной попытки: базовые кубики (с натуральными на к20), место, моды и наставник
const avgDice = s => [...String(s || '').matchAll(/(\d+)d(\d+)/g)].reduce((a, [, n, d]) => a + (Number(n) * (Number(d) + 1)) / 2, 0)
const base = n => n * ((f.die + 1) / 2 + (f.die === 20 ? 0.95 : 0))
// кубиков места в броске (к каждому из них — моды, если «к каждому кубику»)
const placeDice = computed(() => [...String(f.place || '').matchAll(/(\d*)d\d+/g)].reduce((a, x) => a + (Number(x[1]) || 1), 0))
const flatOf = n => ((Number(f.flat) || 0) + (Number(f.mentor) || 0)) * (f.perDie ? n + placeDice.value : 1)
const mods = n => avgDice(f.place) + flatOf(n)
// бонус повторения — только у повторяемых
const adds = n => Array.from({ length: n }, (_, i) => (f.repeat ? Math.min(10, (Number(f.rep) || 0) + i) : 0))

const rows = computed(() => {
  const times = Math.max(1, Math.min(MAX_TIMES, Number(f.times) || 1))
  const hours = (f.elf ? 20 : 24) * times
  const longEach = adds(times).map(a => Math.floor((base(2) + mods(2)) * LONG_MULT) + a)
  const nShort = Math.max(1, Math.floor(hours / SHORT_H))
  const shortEach = adds(nShort).map(a => Math.floor(base(1) + mods(1) + a))
  const flat = (Number(f.flat) || 0) + (Number(f.mentor) || 0)
  const extra = n => `${f.place ? ' + ' + f.place.replace(/d/g, 'к') : ''}${flat ? (flat > 0 ? ' + ' : ' − ') + Math.abs(flat) + (f.perDie && n + placeDice.value > 1 ? '×' + (n + placeDice.value) : '') : ''}`
  const rep = f.repeat ? ' + повт.' : ''
  const row = (id, name, formula, each, h, st) => {
    const total = each.reduce((a, b) => a + b, 0)
    return { id, name, formula, each, n: each.length, hours: h, stamina: st, total, perH: total / h, perSt: total / st }
  }
  return [
    row('short', `Обычная${nShort > 1 ? ' ×' + nShort : ''}`, `1к${f.die}${extra(1)}${rep}`, shortEach, nShort * SHORT_H, nShort * SHORT_ST),
    row('long', `Длительная${times > 1 ? ' ×' + times : ''}`, `(2к${f.die}${extra(2)}) × ${LONG_MULT}${rep}`, longEach, hours, LONG_STAMINA * times)
  ]
})
const other = r => rows.value.find(x => x !== r)
const kpdH = computed(() => Math.round((rows.value[1].perH / rows.value[0].perH) * 100))
const kpdSt = computed(() => Math.round((rows.value[1].perSt / rows.value[0].perSt) * 100))
const advice = computed(() => (kpdH.value >= 100 && kpdSt.value >= 100 ? 'Длительная выгоднее во всём.'
  : kpdSt.value >= 100 ? 'Длительная экономит выносливость, обычные дают больше очков за то же время.'
    : kpdH.value >= 100 ? 'Длительная быстрее, но дороже по выносливости.' : 'Обычные тренировки выгоднее.'))
</script>

<style scoped>
.ac { display: grid; gap: 10px; }
.ac-in { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 8px; align-items: end; }
.ac-in label { display: grid; gap: 3px; min-width: 0; color: #a8936c; font: 800 10.5px 'Manrope', sans-serif; letter-spacing: .05em; text-transform: uppercase; }
.ac-in input, .ac-in select { width: 100%; box-sizing: border-box; height: 32px; padding: 0 8px; border-radius: 8px; border: 1px solid rgba(231, 197, 111, .25); background: rgba(0, 0, 0, .35); color: #efe3c8; font: 700 13px 'Manrope', sans-serif; outline: none; text-transform: none; letter-spacing: 0; }
.ac-in label.chk { display: flex; align-items: center; gap: 6px; height: 32px; color: #efe3c8; font-size: 12.5px; text-transform: none; letter-spacing: 0; }
.ac-in label.chk input { width: auto; height: auto; }
.ac-t { width: 100%; border-collapse: collapse; font: 600 13px 'Manrope', sans-serif; color: #efe3c8; }
.ac-t th { padding: 6px 8px; color: #a8936c; font: 800 10.5px 'Manrope', sans-serif; letter-spacing: .05em; text-transform: uppercase; text-align: right; }
.ac-t td { padding: 7px 8px; border-top: 1px solid rgba(231, 197, 111, .15); text-align: right; vertical-align: top; }
.ac-t td:first-child, .ac-t th:first-child { text-align: left; }
.ac-t td small { display: block; color: #a8936c; font: 600 11px 'Manrope', sans-serif; }
.ac-t tr.long td:first-child b { color: #c9a6ff; }
.ac-t td.win { color: #b4ecb0; font-weight: 800; }
.ac-sum { margin: 0; color: #efe3c8; font: 600 13.5px/1.5 'Manrope', sans-serif; }
.ac-sum .up { color: #b4ecb0; } .ac-sum .down { color: #ffb3aa; }
.ac-sum small, .ac-note { color: #a8936c; font: 600 11.5px 'Manrope', sans-serif; }
.ac-note { margin: 0; }
@media (max-width: 640px) { .ac-t { font-size: 12px; } .ac-t th, .ac-t td { padding: 5px 4px; } }
</style>
