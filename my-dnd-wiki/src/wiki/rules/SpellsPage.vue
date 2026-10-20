<template>
  <!-- школы магии одной страницы вики (Огонь + Магма, утилитарная…): карточки заклинаний с фильтром по кругу,
       правка на месте (мастер и редакторы магии) и «в лист» — заклинание попадает в навыки своего персонажа -->
  <div class="sp">
    <header class="sp-head">
      <h1>{{ content.title }}</h1>
      <p>{{ content.description }}</p>
    </header>
    <RuneLoader v-if="!rulesState.loaded" text="Листаю гримуар…" />
    <template v-else>
      <div class="sp-tools">
        <input v-model="q" class="sp-q" placeholder="Найти заклинание…" />
        <div v-if="circles.length > 1" class="sp-circ">
          <button type="button" :class="{ on: !circ }" @click="circ = ''">Все круги</button>
          <button v-for="c in circles" :key="c" type="button" :class="{ on: circ === c }" :title="c === 'Б' ? 'Базовая магия' : `${c} круг`" @click="circ = circ === c ? '' : c">{{ c || '—' }}</button>
        </div>
        <nav v-if="schools.length > 1" class="sp-tabs">
          <button type="button" :class="{ on: !only }" @click="only = ''">Все школы</button>
          <button v-for="s in schools" :key="s.id" type="button" :class="{ on: only === s.id }" :style="{ '--sc': tone(s.id) }" @click="only = s.id">{{ s.name }}</button>
        </nav>
      </div>

      <section v-for="s in shownSchools" :key="s.id" class="sp-school" :class="{ hid: s.hidden }" :style="{ '--sc': tone(s.id) }">
        <!-- школа: название и вступление -->
        <div v-if="schoolEdit?.id === s.id" class="sp-sedit">
          <input v-model="schoolEdit.name" class="sp-in big" placeholder="Название школы" />
          <RulesEditor v-model="schoolEdit.about" :min-height="70" />
          <div class="sp-acts">
            <label class="sp-chk"><input v-model="schoolEdit.hidden" type="checkbox" /> Скрыть от игроков</label>
            <span class="grow" />
            <button v-if="canManageSchools" type="button" class="sp-btn danger" @click="removeSchool(s)">Удалить школу</button>
            <button type="button" class="sp-btn" @click="schoolEdit = null">Отмена</button>
            <button type="button" class="sp-btn primary" :disabled="busy" @click="saveSchool">Сохранить</button>
          </div>
        </div>
        <template v-else>
          <h2>
            <span class="sp-sig" aria-hidden="true">✦</span>{{ s.name }}
            <small>{{ spellsOf(s).length }} {{ plural(spellsOf(s).length) }}</small>
            <em v-if="s.hidden">скрыта</em>
            <span class="grow" />
            <button v-if="canEdit('schools', s)" type="button" class="sp-btn" @click="schoolEdit = { ...s }">✎ Школа</button>
            <button v-if="canManageSpells(s)" type="button" class="sp-btn" @click="addSpell(s)">＋ Заклинание</button>
          </h2>
          <RulesHtml v-if="s.about" class="sp-about" :html="s.about" />
        </template>

        <div class="sp-grid">
          <template v-for="(x, i) in filtered(s)" :key="x.id">
            <!-- правка заклинания -->
            <article v-if="spellEdit?.id === x.id" class="sp-card editing">
              <div class="sp-erow">
                <input v-model="spellEdit.name" class="sp-in big" placeholder="Название" />
                <label class="sp-lab">Круг <input v-model="spellEdit.circle" class="sp-in tiny" placeholder="Б, 1…9" /></label>
              </div>
              <div class="sp-erow">
                <label class="sp-lab grow">Расход <input v-model="spellEdit.cost" class="sp-in" placeholder="50 маны" /></label>
                <label class="sp-lab grow">Перезарядка <input v-model="spellEdit.cd" class="sp-in" placeholder="2 хода" /></label>
              </div>
              <label v-if="movable.length > 1" class="sp-lab">Школа
                <select v-model="spellEdit.school" class="sp-in"><option v-for="m in movable" :key="m.id" :value="m.id">{{ m.name }}</option></select>
              </label>
              <RulesEditor v-model="spellEdit.html" :min-height="90" />
              <div class="sp-acts">
                <label class="sp-chk"><input v-model="spellEdit.hidden" type="checkbox" /> Скрыть</label>
                <span class="grow" />
                <button v-if="canManageSpells(s)" type="button" class="sp-btn danger" @click="removeSpell(x)">Удалить</button>
                <button type="button" class="sp-btn" @click="spellEdit = null">Отмена</button>
                <button type="button" class="sp-btn primary" :disabled="busy" @click="saveSpell">Сохранить</button>
              </div>
            </article>
            <article v-else v-tilt="4" class="sp-card" :class="{ hid: x.hidden }" :style="{ '--i': Math.min(i, 20) }">
              <!-- стихия школы при наведении: искры, пузырьки, снежинки, ветер, молнии, пыль, листья -->
              <span class="sp-el" :class="'el-' + x.school" aria-hidden="true"><i v-for="k in 8" :key="k" :style="{ '--k': k }">{{ GLYPH[x.school] || '' }}</i></span>
              <header>
                <span class="sp-c" :class="{ base: x.circle === 'Б', none: !x.circle }" :title="x.circle === 'Б' ? 'Базовая магия' : x.circle ? `${x.circle} круг` : 'Без круга'">{{ x.circle || '✧' }}</span>
                <h3>{{ x.name }}</h3>
                <em v-if="x.hidden">скрыто</em>
              </header>
              <RulesHtml class="sp-text" :html="x.html" />
              <footer>
                <span v-if="x.cost" class="sp-chip mana" title="Расход">✦ {{ x.cost }}</span>
                <span v-if="x.cd" class="sp-chip cd" title="Перезарядка">⟳ {{ x.cd }}</span>
                <span class="grow" />
                <SpellToSheet v-if="store.me" :spell="x" :school="s" />
                <button v-if="canEdit('spells', x)" type="button" class="sp-ico" title="Править" @click="spellEdit = { ...x }">✎</button>
              </footer>
            </article>
          </template>
        </div>
        <p v-if="!filtered(s).length" class="sp-none">{{ q || circ ? 'Ничего не нашлось.' : 'В этой школе пока нет заклинаний.' }}</p>
      </section>

      <button v-if="canManageSchools" type="button" class="sp-btn sp-newschool" @click="addSchool">＋ Новая школа на этой странице</button>
    </template>
  </div>
</template>

<script setup>
import RuneLoader from '../../components/fx/RuneLoader.vue'
import { computed, onMounted, ref, watch } from 'vue'
import { store, rulesState, loadRules, api, toast, wikiUser } from '../../map/store.js'
import { canEditRule, canManageRule } from '../../shared/wikiPerms.js'
import RulesHtml from './RulesHtml.vue'
import RulesEditor from './RulesEditor.vue'
import SpellToSheet from './SpellToSheet.vue'

const props = defineProps({ content: { type: Object, default: () => ({}) } })
onMounted(() => loadRules())
watch(() => store.data.rulesRev, () => loadRules())

// цвет школы — по стихии
const TONES = { fire: '#ff8a4c', magma: '#ff5a36', water: '#4fb3ff', ice: '#9fe3ff', air: '#cfe8ff', lightning: '#ffe35a', earth: '#c9a066', nature: '#7ed07a', utility: '#b9a6ff' }
const tone = id => TONES[id] || '#b9a6ff'
// значки частиц стихии (огонь, магма, вода, земля, воздух — просто точки и черты, их рисует CSS)
const GLYPH = { ice: '❄', nature: '🍃', lightning: 'ϟ', utility: '✦' }
const plural = n => (n % 10 === 1 && n % 100 !== 11 ? 'заклинание' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'заклинания' : 'заклинаний')

const schools = computed(() => rulesState.schools.filter(s => s.page === props.content.id).sort((a, b) => a.order - b.order))
const only = ref('')
const shownSchools = computed(() => schools.value.filter(s => !only.value || s.id === only.value))
const spellsOf = s => rulesState.spells.filter(x => x.school === s.id).sort((a, b) => circleRank(a.circle) - circleRank(b.circle) || a.order - b.order)
// порядок кругов: Б, 1…9, потом остальное
const circleRank = c => (c === 'Б' ? 0 : /^\d/.test(c) ? parseInt(c, 10) : c ? 50 : 99)

const q = ref('')
const circ = ref('')
const norm = s => String(s || '').toLowerCase().replace(/ё/g, 'е')
const circles = computed(() => [...new Set(schools.value.flatMap(s => spellsOf(s).map(x => mainCircle(x.circle))))].sort((a, b) => circleRank(a) - circleRank(b)))
const mainCircle = c => (c === 'Б' ? 'Б' : (String(c).match(/\d/) || [''])[0])
function filtered(s) {
  const t = norm(q.value.trim())
  return spellsOf(s).filter(x => (!circ.value || mainCircle(x.circle) === circ.value) &&
    (!t || norm(x.name).includes(t) || norm(x.html.replace(/<[^>]+>/g, ' ')).includes(t) || norm(x.cost + ' ' + x.cd).includes(t)))
}

/* ---------- правка (src/shared/wikiPerms.js) ---------- */
const canEdit = (list, x) => canEditRule(wikiUser(), list, x)
const canManageSpells = s => canManageRule(wikiUser(), 'spells', { school: s.id })
const canManageSchools = computed(() => canManageRule(wikiUser(), 'schools', {}))
// куда можно перенести заклинание: школы, которые этот человек правит
const movable = computed(() => rulesState.schools.filter(s => canEdit('spells', { school: s.id })))
const busy = ref(false)
const spellEdit = ref(null)
const schoolEdit = ref(null)

async function run(fn, ok) {
  busy.value = true
  try { await fn(); await loadRules(true); if (ok) toast(ok); return true } catch (e) { toast(e.message, 'error'); return false } finally { busy.value = false }
}
async function saveSpell() {
  const { id, order, ...body } = spellEdit.value
  if (await run(() => api('PUT', `/api/rules/spells/${id}`, body), 'Заклинание сохранено')) spellEdit.value = null
}
async function addSpell(s) {
  let made = null
  await run(async () => { made = await api('POST', '/api/rules/spells', { school: s.id, name: 'Новое заклинание', circle: circ.value || '1', html: '<p></p>' }) })
  if (made) { q.value = ''; spellEdit.value = { ...made } }
}
async function removeSpell(x) {
  if (!confirm(`Удалить заклинание «${x.name}»? Мастер сможет вернуть его из журнала правок.`)) return
  if (await run(() => api('DELETE', `/api/rules/spells/${x.id}`), 'Заклинание удалено')) spellEdit.value = null
}
async function saveSchool() {
  const { id, order, ...body } = schoolEdit.value
  if (await run(() => api('PUT', `/api/rules/schools/${id}`, { ...body, page: props.content.id }), 'Школа сохранена')) schoolEdit.value = null
}
async function addSchool() {
  let made = null
  await run(async () => { made = await api('POST', '/api/rules/schools', { name: 'Новая школа', page: props.content.id, about: '' }) })
  if (made) schoolEdit.value = { ...made }
}
async function removeSchool(s) {
  if (!confirm(`Удалить школу «${s.name}»?`)) return
  if (await run(() => api('DELETE', `/api/rules/schools/${s.id}`), 'Школа удалена')) schoolEdit.value = null
}
</script>

<style scoped>
.sp-head h1 { margin: 0; font: 700 34px 'Cormorant Garamond', serif; color: #e6deff; text-shadow: 0 0 18px rgba(155, 125, 255, .5); }
.sp-head p { margin: 4px 0 14px; color: #b3a8d6; font-weight: 600; }
.sp-load, .sp-none { padding: 24px; text-align: center; color: #b3a8d6; }
.sp-tools { position: sticky; top: 64px; z-index: 5; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 0 -6px 14px; padding: 8px 6px; border-radius: 14px; background: rgba(16, 14, 30, .78); backdrop-filter: blur(8px); }
.sp-q { flex: 1 1 220px; padding: 8px 12px; border-radius: 10px; border: 1px solid rgba(185, 166, 255, .3); background: rgba(0, 0, 0, .35); color: #ece6ff; font: 600 13.5px 'Manrope', sans-serif; }
.sp-q:focus { outline: none; border-color: #b9a6ff; box-shadow: 0 0 0 3px rgba(155, 125, 255, .2); }
.sp-circ, .sp-tabs { display: flex; flex-wrap: wrap; gap: 4px; }
.sp-circ button, .sp-tabs button { min-width: 32px; padding: 5px 9px; border-radius: 9px; border: 1px solid rgba(185, 166, 255, .22); background: none; color: #cfc6e8; font: 800 12.5px 'Manrope', sans-serif; cursor: pointer; transition: background .2s, border-color .2s; }
.sp-circ button.on, .sp-tabs button.on { background: rgba(155, 125, 255, .25); border-color: #b9a6ff; color: #fff; }
.sp-tabs button.on { background: color-mix(in srgb, var(--sc, #b9a6ff) 22%, transparent); border-color: var(--sc, #b9a6ff); }
.sp-school { margin-bottom: 26px; }
.sp-school.hid { opacity: .75; }
.sp .sp-school h2 { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin: 0 0 8px; font: 700 26px 'Cormorant Garamond', serif; color: #ece6ff !important; text-shadow: 0 0 16px color-mix(in srgb, var(--sc) 60%, transparent) !important; }
.sp-school h2 small { color: #b3a8d6; font: 700 12.5px 'Manrope', sans-serif; text-shadow: none; }
.sp-school h2 em { color: #ff9b8f; font: 800 11px 'Manrope', sans-serif; font-style: normal; text-shadow: none; }
.sp-sig { color: var(--sc); }
.sp-about { margin: 0 0 12px; color: #cfc6e8; }
.sp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr)); gap: 10px; }
.sp-card { position: relative; display: flex; flex-direction: column; gap: 6px; padding: 12px 14px 10px; border-radius: 14px; background: linear-gradient(180deg, color-mix(in srgb, var(--sc) 9%, rgba(16, 14, 30, .82)), rgba(16, 14, 30, .82)); border: 1px solid color-mix(in srgb, var(--sc) 30%, transparent); box-shadow: 0 10px 26px rgba(0, 0, 0, .3); animation: sp-in .35s ease backwards; animation-delay: calc(var(--i, 0) * 22ms); transition: transform .2s, border-color .2s, box-shadow .2s; }
.sp-card:hover { transform: translateY(-2px); border-color: color-mix(in srgb, var(--sc) 65%, transparent); box-shadow: 0 14px 30px rgba(0, 0, 0, .4), 0 0 22px color-mix(in srgb, var(--sc) 18%, transparent); }
.sp-card.hid { border-style: dashed; opacity: .75; }
.sp-card.editing { grid-column: 1 / -1; gap: 8px; animation: none; transform: none; }
@keyframes sp-in { from { opacity: 0; transform: translateY(6px); } }
/* стихия на карточке: слой частиц, видимый только при наведении (иначе анимации на паузе) */
.sp-el { position: absolute; inset: 0; border-radius: inherit; overflow: hidden; pointer-events: none; opacity: 0; transition: opacity .3s; z-index: 0; }
.sp-card > :not(.sp-el) { position: relative; z-index: 1; }
.sp-card:hover .sp-el { opacity: 1; }
.sp-el i { position: absolute; left: calc(var(--k) * 11.5% - 6%); bottom: -10px; font-style: normal; animation: el-rise 2.4s linear infinite; animation-delay: calc(var(--k) * -.31s); animation-play-state: paused; }
.sp-card:hover .sp-el i { animation-play-state: running; }
/* огонь и магма — угольки снизу вверх */
.el-fire i, .el-magma i { width: 4px; height: 4px; border-radius: 50%; background: #ffb347; box-shadow: 0 0 8px #ff6a1f, 0 0 2px #fff; }
.el-magma i { width: 6px; height: 6px; background: #ff5a36; box-shadow: 0 0 12px #c41e00; animation-duration: 3.4s; }
.el-fire { background: radial-gradient(ellipse at 50% 120%, rgba(255, 110, 30, .22), transparent 60%); }
.el-magma { background: radial-gradient(ellipse at 50% 120%, rgba(200, 40, 0, .3), transparent 65%); }
/* вода — пузырьки */
.el-water i { width: 7px; height: 7px; border-radius: 50%; border: 1px solid rgba(160, 215, 255, .8); background: rgba(79, 179, 255, .12); animation-duration: 3s; }
.el-water { background: radial-gradient(ellipse at 50% 120%, rgba(79, 179, 255, .18), transparent 60%); }
/* лёд — снежинки сверху и иней по краю */
.el-ice { box-shadow: inset 0 0 18px rgba(170, 225, 255, .35); }
.el-ice i { top: -14px; bottom: auto; color: #dff6ff; font-size: 11px; text-shadow: 0 0 6px #9fe3ff; animation-name: el-fall; animation-duration: 3.6s; }
/* воздух — потоки ветра слева направо */
.el-air i { left: -40%; bottom: auto; top: calc(var(--k) * 11% ); width: 36%; height: 1.5px; border-radius: 2px; background: linear-gradient(90deg, transparent, rgba(220, 240, 255, .7), transparent); animation-name: el-wind; animation-duration: 1.6s; }
/* молнии — вспышки */
.el-lightning { animation: el-flash 1.8s steps(1) infinite; animation-play-state: paused; }
.sp-card:hover .el-lightning { animation-play-state: running; }
.el-lightning i { bottom: auto; top: calc(var(--k) * 9%); color: #fff7a8; font-size: 16px; text-shadow: 0 0 8px #ffe35a, 0 0 2px #fff; opacity: 0; animation-name: el-zap; animation-duration: 1.2s; }
/* земля — пыль и камешки сверху */
.el-earth i { top: -8px; bottom: auto; width: 4px; height: 4px; border-radius: 1px; background: #b8925a; animation-name: el-fall; animation-duration: 2.2s; }
/* природа — листья кружатся */
.el-nature i { top: -16px; bottom: auto; font-size: 12px; animation-name: el-leaf; animation-duration: 4s; }
/* утилитарная — искорки мерцают */
.el-utility i { bottom: auto; top: calc(var(--k) * 10%); color: #e6deff; font-size: 10px; text-shadow: 0 0 6px #b9a6ff; animation-name: el-twinkle; animation-duration: 1.8s; }
@keyframes el-rise { 0% { transform: translateY(0) scale(1); opacity: 0; } 15% { opacity: 1; } 100% { transform: translate(10px, -170px) scale(.3); opacity: 0; } }
@keyframes el-fall { 0% { transform: translateY(0) rotate(0); opacity: 0; } 15% { opacity: 1; } 100% { transform: translate(12px, 190px) rotate(200deg); opacity: 0; } }
@keyframes el-leaf { 0% { transform: translate(0, 0) rotate(0); opacity: 0; } 15% { opacity: 1; } 50% { transform: translate(18px, 90px) rotate(160deg); } 100% { transform: translate(-6px, 190px) rotate(320deg); opacity: 0; } }
@keyframes el-wind { from { transform: translateX(0); opacity: 0; } 30% { opacity: 1; } to { transform: translateX(380%); opacity: 0; } }
@keyframes el-zap { 0%, 70% { opacity: 0; } 72% { opacity: 1; } 78% { opacity: .2; } 82% { opacity: 1; } 90%, 100% { opacity: 0; } }
@keyframes el-flash { 0%, 90% { background: transparent; } 92% { background: rgba(255, 243, 160, .14); } 95% { background: transparent; } 97% { background: rgba(255, 243, 160, .1); } }
@keyframes el-twinkle { 0%, 100% { opacity: 0; transform: scale(.4); } 50% { opacity: 1; transform: scale(1.1) rotate(45deg); } }
.sp-card header { display: flex; align-items: center; gap: 10px; }
.sp .sp-card h3 { flex: 1; margin: 0; font: 700 19px 'Cormorant Garamond', serif; color: #f1ecff !important; }
.sp-card header em { color: #ff9b8f; font: 800 10px 'Manrope', sans-serif; font-style: normal; }
.sp-c { display: grid; place-items: center; flex: none; min-width: 30px; height: 30px; padding: 0 5px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, color-mix(in srgb, var(--sc) 70%, #fff), color-mix(in srgb, var(--sc) 45%, #120d20)); color: #120d20; font: 900 13px 'Manrope', sans-serif; box-shadow: 0 0 14px color-mix(in srgb, var(--sc) 45%, transparent); }
.sp-c.base { background: radial-gradient(circle at 35% 30%, #fff, #c9c0e6); }
.sp-c.none { background: rgba(185, 166, 255, .18); color: #e6deff; box-shadow: none; }
.sp-text { flex: 1; color: #ddd6f3; font-size: 13.5px; }
.sp-text :deep(p) { margin: 0 0 4px; }
.sp-card footer { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding-top: 6px; border-top: 1px solid rgba(185, 166, 255, .12); }
.sp-chip { padding: 2px 8px; border-radius: 99px; font: 800 11.5px 'Manrope', sans-serif; }
.sp-chip.mana { background: rgba(79, 179, 255, .14); color: #9fd2ff; }
.sp-chip.cd { background: rgba(185, 166, 255, .14); color: #d2c8ff; }
.sp-ico { width: 28px; height: 28px; border-radius: 8px; border: 1px solid rgba(185, 166, 255, .3); background: none; color: #d9ceff; cursor: pointer; }
.sp-ico:hover { border-color: #b9a6ff; background: rgba(155, 125, 255, .15); }
.grow { flex: 1; }
.sp-btn { padding: 5px 11px; border-radius: 9px; border: 1px solid rgba(185, 166, 255, .4); background: rgba(155, 125, 255, .1); color: #e6deff; font: 700 12.5px 'Manrope', sans-serif; cursor: pointer; text-shadow: none; }
.sp-btn:hover { background: rgba(155, 125, 255, .2); }
.sp-btn.primary { background: linear-gradient(180deg, #c7b5ff, #8d6cff); color: #120d20; border-color: #8d6cff; }
.sp-btn.danger { border-color: rgba(255, 122, 107, .45); color: #ff9b8f; background: none; }
.sp-newschool { display: block; margin: 0 auto 20px; border-style: dashed; }
.sp-sedit { display: grid; gap: 8px; margin-bottom: 12px; padding: 12px; border-radius: 14px; border: 1px solid rgba(185, 166, 255, .35); background: rgba(16, 14, 30, .85); }
.sp-erow { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.sp-lab { display: flex; align-items: center; gap: 6px; color: #b3a8d6; font: 700 12px 'Manrope', sans-serif; }
.sp-lab.grow { flex: 1 1 180px; }
.sp-lab.grow .sp-in { flex: 1; min-width: 0; }
.sp-in { padding: 6px 9px; border-radius: 8px; border: 1px solid rgba(185, 166, 255, .3); background: rgba(0, 0, 0, .35); color: #ece6ff; font: 600 13px 'Manrope', sans-serif; color-scheme: dark; }
.sp-in.big { flex: 1 1 220px; font: 700 18px 'Cormorant Garamond', serif; }
.sp-in.tiny { width: 70px; text-align: center; }
.sp-acts { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.sp-chk { display: flex; align-items: center; gap: 6px; color: #cfc6e8; font: 600 13px 'Manrope', sans-serif; }
@media (max-width: 600px) {
  .sp-head h1 { font-size: 28px; }
  .sp-tools { position: static; }
  .sp-school h2 { font-size: 22px; }
}
@media (prefers-reduced-motion: reduce) { .sp-card { animation: none; } }
</style>
