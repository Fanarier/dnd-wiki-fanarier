<template>
  <!-- журнал правок вики (мастер): кто что поменял; любую правку можно открыть («было → стало») и откатить -->
  <div class="rh-log">
    <header class="rl-head">
      <h1>{{ content.title || 'Журнал правок вики' }}</h1>
      <p>Правки мастера и редакторов в расах, классах, статьях, магии, эффектах и предметах — последние 400. Откат возвращает запись как было.</p>
    </header>
    <div class="rl-tools">
      <select v-model="list" class="rl-in">
        <option value="">Все разделы</option>
        <option v-for="(n, k) in LIST_NAMES" :key="k" :value="k">{{ n }}</option>
      </select>
      <select v-model="who" class="rl-in">
        <option value="">Все</option>
        <option v-for="p in people" :key="p.id" :value="p.id">{{ p.name }}</option>
      </select>
      <span class="grow" />
      <button type="button" class="rl-btn" :disabled="loading" @click="load">↻ Обновить</button>
    </div>
    <div v-if="loading && !rows.length" class="rl-empty">Листаю журнал…</div>
    <div v-else-if="!shown.length" class="rl-empty">Правок пока нет.</div>
    <div class="rl-list">
      <article v-for="r in shown" :key="r.hid" class="rl-row" :class="[r.action, { rev: r.reverted, open: openId === r.hid }]">
        <button type="button" class="rl-main" @click="toggle(r)">
          <span class="rl-act">{{ ACTIONS[r.action] }}</span>
          <span class="rl-what"><b>{{ r.title || '—' }}</b><small>{{ LIST_NAMES[r.list] }}<template v-if="r.note"> · {{ r.note }}</template></small></span>
          <span class="rl-who">{{ r.by }}<small v-if="r.role === 'master'"> · мастер</small></span>
          <time :title="new Date(r.at).toLocaleString('ru')">{{ ago(r.at) }}</time>
        </button>
        <div v-if="openId === r.hid" class="rl-detail">
          <div v-if="!detail" class="rl-empty">Загружаю…</div>
          <template v-else>
            <div class="rl-diff">
              <div v-for="f in diff" :key="f.id" class="rl-f">
                <b>{{ f.label }}</b>
                <div class="rl-cols">
                  <div v-for="side in ['was', 'now']" :key="side" :class="side">
                    <small>{{ side === 'was' ? 'было' : 'стало' }}</small>
                    <!-- картинки: сами картинки; новая/убранная — в рамке -->
                    <div v-if="f.pic" class="rl-pics">
                      <a v-for="u in f[side]" :key="u" :href="u" target="_blank" rel="noopener" class="rl-thumb" :class="{ hit: f[side].length > 1 && !f[side === 'was' ? 'now' : 'was'].includes(u) }"><img class="rl-pic" :src="u" :alt="u.split('/').pop()" :title="u" loading="lazy" /></a>
                      <p v-if="!f[side].length">нет картинки</p>
                    </div>
                    <!-- поменялось только оформление: текст отрисован, как на странице -->
                    <div v-else-if="f.html" class="rl-rich"><RulesHtml :html="f[side]" /></div>
                    <!-- текст построчно: изменившиеся строки подсвечены, в длинном — только они и соседние -->
                    <p v-else-if="f[side].length"><span v-for="(l, i) in f[side]" :key="i" class="rl-ln" :class="{ hit: l.hit, gap: l.gap }">{{ l.t }}</span></p>
                    <p v-else>—</p>
                  </div>
                </div>
              </div>
              <p v-if="!diff.length" class="rl-empty">Видимых отличий нет (порядок, служебные поля).</p>
            </div>
            <div class="rl-acts">
              <span v-if="r.reverted" class="rl-done">откачено {{ ago(r.reverted) }}</span>
              <span class="grow" />
              <button v-if="!r.reverted" type="button" class="rl-btn danger" :disabled="busy" @click="revert(r)">↶ Откатить</button>
            </div>
          </template>
        </div>
      </article>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { store, api, toast, loadRules } from '../../map/store.js'
import { htmlToText } from '../../shared/rules.js'
import { CARD_LISTS, liOf, blankCard, cardFilled } from '../../shared/items.js'
import RulesHtml from './RulesHtml.vue'

defineProps({ content: { type: Object, default: () => ({}) } })
const LIST_NAMES = { articles: 'Статьи', races: 'Расы', classes: 'Классы', schools: 'Школы магии', spells: 'Заклинания', effects: 'Эффекты', items: 'Предметы' }
const ACTIONS = { create: 'создано', update: 'изменено', delete: 'удалено' }
const rows = ref([])
const loading = ref(false)
const busy = ref(false)
const list = ref('')
const who = ref('')
async function load() {
  loading.value = true
  try { rows.value = await api('GET', '/api/rules/history') } catch (e) { toast(e.message, 'error') } finally { loading.value = false }
}
onMounted(load)
watch(() => store.data.rulesRev, load)
const people = computed(() => [...new Map(rows.value.map(r => [r.byId, { id: r.byId, name: r.by }])).values()])
const shown = computed(() => rows.value.filter(r => (!list.value || r.list === list.value) && (!who.value || r.byId === who.value)))

const openId = ref(null)
const detail = ref(null)
async function toggle(r) {
  if (openId.value === r.hid) { openId.value = null; return }
  openId.value = r.hid
  detail.value = null
  try { detail.value = await api('GET', `/api/rules/history/${r.hid}`) } catch (e) { toast(e.message, 'error') }
}

// «было → стало» по полям, понятным человеку: текст без разметки; навыки и уровни — списком названий.
// Показываем ВСЕ поля, кроме служебных (незнакомое поле — под своим именем), чтобы правка не терялась за «видимых отличий нет»
const SKIP = new Set(['id', 'order', 'empty'])
const LABELS = { title: 'Название', name: 'Название', html: 'Текст', intro: 'Вступление', outro: 'Текст после', about: 'Описание', hidden: 'Скрыто',
  circle: 'Круг', cost: 'Расход', cd: 'Перезарядка', school: 'Школа', kind: 'Вид', tag: 'Чей', icon: 'Иконка', group: 'Раздел', page: 'Страница',
  base: 'Базовые навыки', levels: 'Уровни', skills: 'Навыки', archetypes: 'Архетипы', sign: 'Знак',
  img: 'Картинка', rarity: 'Редкость', shared: 'Общий для группы', card: 'Карточка предмета' }
// названия кусочков пути во вложенных полях (карточка предмета, уровни расы, навыки класса…)
const PART_NAMES = { ...LABELS, Type1: 'Тип основной', Type2: 'Тип дополнительный', Attune: 'Настройка', Kind: 'Вид', Origin: 'Происхождение', Note: 'Примечание',
  Chars: 'Характеристика', Comps: 'Компоненты', Reqs: 'Требования', Passive: 'Пассивные эффекты', Active: 'Активные эффекты',
  K: 'название', V: 'значение', N: 'примечание', M: 'отметка', T: 'текст', lv: 'ур.', pick: 'выбор', prof: 'владения', auto: 'сам', options: 'варианты', tags: 'метки' }
// карточка предмета — построчно: типы, характеристики, списки с примечаниями и отметками
const MARK_NAMES = { green: 'зелёный', yellow: 'жёлтый', red: 'красный', blue: 'синий', gone: 'зачёркнуто' }
const cardLines = c => (!c ? '' : [
  ['Тип', [c.Type1, c.Type2].filter(Boolean).join(' · ')], ['Настройка', c.Attune], ['Вид', c.Kind], ['Происхождение', c.Origin], ['Примечание', c.Note],
  ...(c.Chars || []).map(x => [x.K, x.V + (x.N ? ` (${x.N})` : '') + (x.M ? ` [${MARK_NAMES[x.M] || x.M}]` : '')]),
  ...CARD_LISTS.flatMap(l => (c[l.k] || []).map(liOf).map(e => [l.name, e.T + (e.N ? ` (${e.N})` : '') + (e.M ? ` [${MARK_NAMES[e.M] || e.M}]` : '')]))
].filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('\n'))

/* ---------- картинки: в любом поле и на любой глубине (img, icon, sign, ImageFile, галерея, <img> в тексте) ---------- */
const HASH_IMG = /^[a-f0-9]{16,64}\.(png|jpe?g|gif|webp)$/i // картинка листа — только имя файла
const PATH_IMG = /^(\/[\w/.%-]+|https?:\/\/\S+)\.(png|jpe?g|gif|webp|svg|avif)(\?\S*)?$/i
const isPic = v => typeof v === 'string' && (HASH_IMG.test(v) || PATH_IMG.test(v) || /^data:image\//.test(v))
const picUrl = v => (HASH_IMG.test(v) ? '/sheet-img/' + v : v)
function picsOf(v, out = []) {
  if (typeof v === 'string') {
    if (isPic(v)) out.push(picUrl(v))
    else if (/<img\b/i.test(v)) for (const m of v.matchAll(/<img\b[^>]*?\ssrc\s*=\s*["']([^"']+)["']/gi)) out.push(m[1])
  } else if (Array.isArray(v)) v.forEach(x => picsOf(x, out))
  else if (v && typeof v === 'object') Object.values(v).forEach(x => picsOf(x, out))
  return [...new Set(out)]
}
// поле — только картинка (или список картинок): показываем картинки, без текста
const onlyPics = v => !v || isPic(v) || (Array.isArray(v) && v.every(isPic))

/* ---------- сравнение без учёта порядка ключей; пустая карточка = нет карточки, старые пункты-строки = { T } ---------- */
const stable = v => (Array.isArray(v) ? '[' + v.map(stable).join(',') + ']'
  : v && typeof v === 'object' ? '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}'
    : JSON.stringify(v ?? ''))
const normCard = c => (!cardFilled(c) ? null : { ...blankCard(), ...c,
  Chars: (c.Chars || []).map(x => ({ K: '', V: '', N: '', M: '', ...x })),
  ...Object.fromEntries(CARD_LISTS.map(l => [l.k, (c[l.k] || []).map(liOf)])) })
const norm = (v, k) => (k === 'card' ? normCard(v) : v === false || v == null ? '' : v)

// значение для человека: текст без разметки, да/нет, списки — по строке
const show = (v, k) => {
  if (v == null || v === '') return ''
  if (k === 'card') return cardLines(v)
  if (typeof v === 'boolean') return v ? 'да' : 'нет'
  if (typeof v === 'string') return isPic(v) ? '' : /<[a-z]/i.test(v) ? htmlToText(v) : v
  if (typeof v === 'number') return String(v)
  if (Array.isArray(v)) return v.map(x => (x && typeof x === 'object' ? [x.lv != null ? x.lv + ' ур.' : '', x.name || x.auto?.name || x.T || x.K || '', ...(x.options || []).map(o => o.name)].filter(Boolean).join(' ') : isPic(x) ? '' : String(x))).filter(Boolean).join('\n')
  return ''
}
// запасной вариант, когда сводка одинакова, а данные — нет: построчно «путь: значение» только у отличающихся мест
function flat(v, path, out) {
  if (Array.isArray(v)) v.forEach((x, i) => flat(x, [...path, '#' + (i + 1)], out))
  else if (v && typeof v === 'object') for (const k of Object.keys(v)) flat(v[k], [...path, k], out)
  else out.set(path.join('\u0001'), v)
  return out
}
const leaf = (v, part) => {
  if (v == null || v === '' || v === false) return v === false ? 'нет' : '—'
  if (v === true) return 'да'
  if (part === 'M') return MARK_NAMES[v] || v
  return typeof v === 'string' && /<[a-z]/i.test(v) ? htmlToText(v) : String(v)
}
// fmt — места, где поменялось только оформление текста (цвет, размер, жирный): их покажем отрисованными
function deepLines(b, a) {
  const fb = flat(b, [], new Map()), fa = flat(a, [], new Map())
  const was = [], now = [], fmt = []
  for (const p of new Set([...fb.keys(), ...fa.keys()])) {
    const x = fb.get(p), y = fa.get(p)
    if ((x ?? '') === (y ?? '') || isPic(x) || isPic(y)) continue
    const parts = p.split('\u0001')
    const name = parts.filter(Boolean).map(s => PART_NAMES[s] || s).join(' › ')
    const lx = leaf(x, parts.at(-1)), ly = leaf(y, parts.at(-1))
    if (lx === ly && fb.has(p) && fa.has(p)) { if (/<[a-z]/i.test(`${x}${y}`)) fmt.push({ name, was: String(x ?? ''), now: String(y ?? '') }); continue }
    if (fb.has(p)) was.push(name ? `${name}: ${lx}` : lx)
    if (fa.has(p)) now.push(name ? `${name}: ${ly}` : ly)
  }
  return { was: was.join('\n'), now: now.join('\n'), fmt }
}
// строки «было/стало»: отличающиеся подсвечены; длинный текст — только изменённые строки и по одной соседней
function lineSides(was, now) {
  const lw = was ? was.split('\n') : [], ln = now ? now.split('\n') : []
  const multi = (lw.length > 1 || ln.length > 1) && lw.length > 0 && ln.length > 0 // создание/удаление — без подсветки
  const mark = (xs, other) => {
    const left = new Map()
    for (const t of other) left.set(t, (left.get(t) || 0) + 1)
    return xs.map(t => { const n = left.get(t) || 0; if (n) left.set(t, n - 1); return { t, hit: multi && !n } })
  }
  const squeeze = xs => {
    if (xs.length <= 10 || !xs.some(l => l.hit)) return xs
    const keep = xs.map((l, i) => l.hit || xs[i - 1]?.hit || xs[i + 1]?.hit)
    const out = []
    xs.forEach((l, i) => { if (keep[i]) out.push(l); else if (keep[i - 1] || i === 0) out.push({ t: '…', gap: true }) })
    return out
  }
  return { was: squeeze(mark(lw, ln)), now: squeeze(mark(ln, lw)) }
}
const diff = computed(() => {
  const b = detail.value?.before || {}, a = detail.value?.after || {}
  const rows = []
  for (const k of new Set([...Object.keys(b), ...Object.keys(a)])) {
    if (SKIP.has(k)) continue
    const nb = norm(b[k], k), na = norm(a[k], k)
    if (stable(nb) === stable(na)) continue
    const label = LABELS[k] || k
    // картинки поля: добавили, убрали, заменили
    const pb = picsOf(b[k]), pa = picsOf(a[k])
    const picOnly = onlyPics(b[k]) && onlyPics(a[k])
    if (stable(pb) !== stable(pa)) rows.push({ id: k + ':pic', label: picOnly ? label : label + ' · картинки', pic: true, was: pb, now: pa })
    if (picOnly) continue
    const tw = show(b[k], k), tn = show(a[k], k)
    if (tw !== tn) { rows.push({ id: k, label, ...lineSides(tw, tn) }); continue }
    // сводка одинакова, а данные разные (примечание, отметка, вложенное поле) — показываем сами отличия
    const d = deepLines(nb, na)
    if (d.was !== d.now) rows.push({ id: k, label, ...lineSides(d.was, d.now) })
    // текст тот же, поменялось оформление — показываем оба варианта как на странице
    d.fmt.slice(0, 6).forEach((f, i) => rows.push({ id: `${k}:fmt${i}`, label: `${label}${f.name ? ' › ' + f.name : ''} · оформление`, html: true, was: f.was, now: f.now }))
  }
  return rows
})

async function revert(r) {
  if (!confirm(`Откатить «${r.title}» (${ACTIONS[r.action]})?`)) return
  busy.value = true
  try {
    await api('POST', `/api/rules/history/${r.hid}/revert`)
    toast('Откачено')
    await Promise.all([load(), loadRules(true)])
    openId.value = null
  } catch (e) { toast(e.message, 'error') } finally { busy.value = false }
}
const ago = t => {
  const m = Math.round((Date.now() - t) / 60000)
  if (m < 1) return 'только что'
  if (m < 60) return m + ' мин назад'
  if (m < 1440) return Math.round(m / 60) + ' ч назад'
  return new Date(t).toLocaleDateString('ru', { day: 'numeric', month: 'short' })
}
</script>

<style scoped>
.rl-head h1 { margin: 0; font: 700 34px 'Cormorant Garamond', serif; color: #f3dc9e; }
.rl-head p { margin: 4px 0 14px; color: #a8936c; font-weight: 600; }
.rl-tools { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.rl-in { padding: 6px 9px; border-radius: 9px; border: 1px solid rgba(231, 197, 111, .25); background: rgba(0, 0, 0, .3); color: #efe3c8; font: 600 13px 'Manrope', sans-serif; color-scheme: dark; }
.grow { flex: 1; }
.rl-btn { padding: 6px 12px; border-radius: 9px; border: 1px solid rgba(231, 197, 111, .35); background: rgba(231, 197, 111, .08); color: #f3d99a; font: 700 12.5px 'Manrope', sans-serif; cursor: pointer; }
.rl-btn.danger { border-color: rgba(255, 122, 107, .45); color: #ff9b8f; background: none; }
.rl-empty { padding: 20px; text-align: center; color: #a8936c; }
.rl-list { display: grid; gap: 6px; }
.rl-row { border-radius: 12px; border: 1px solid rgba(231, 197, 111, .14); background: rgba(20, 16, 11, .7); overflow: hidden; }
.rl-row.open { border-color: rgba(231, 197, 111, .4); }
.rl-row.rev { opacity: .6; }
.rl-main { display: grid; grid-template-columns: 90px minmax(0, 1fr) auto auto; align-items: center; gap: 12px; width: 100%; padding: 9px 12px; border: 0; background: none; color: #efe3c8; text-align: left; cursor: pointer; }
.rl-main:hover { background: rgba(231, 197, 111, .05); }
.rl-act { justify-self: start; padding: 2px 8px; border-radius: 99px; background: rgba(231, 197, 111, .14); color: #f3dc9e; font: 800 10.5px 'Manrope', sans-serif; text-transform: uppercase; letter-spacing: .05em; }
.rl-row.create .rl-act { background: rgba(126, 208, 122, .16); color: #b5ecb2; }
.rl-row.delete .rl-act { background: rgba(255, 107, 94, .16); color: #ffb3aa; }
.rl-what { display: grid; min-width: 0; }
.rl-what b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 700 16px 'Cormorant Garamond', serif; color: #f3dc9e; }
.rl-what small, .rl-who small { color: #a8936c; font: 600 11.5px 'Manrope', sans-serif; }
.rl-who { font: 700 12.5px 'Manrope', sans-serif; color: #cdbf9f; }
.rl-main time { color: #a8936c; font: 600 12px 'Manrope', sans-serif; white-space: nowrap; }
.rl-detail { padding: 4px 12px 12px; border-top: 1px solid rgba(231, 197, 111, .12); }
.rl-diff { display: grid; gap: 10px; max-height: 60vh; overflow-y: auto; padding-top: 8px; }
.rl-f > b { color: #cdbf9f; font: 800 11px 'Manrope', sans-serif; letter-spacing: .06em; text-transform: uppercase; }
.rl-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 4px; }
.rl-cols > div { min-width: 0; padding: 8px 10px; border-radius: 10px; }
.rl-cols small { color: #a8936c; font: 800 10px 'Manrope', sans-serif; text-transform: uppercase; }
.rl-cols p { margin: 2px 0 0; max-height: 220px; overflow-y: auto; white-space: pre-wrap; overflow-wrap: anywhere; font: 500 12.5px/1.5 'Manrope', sans-serif; color: #e6dcc4; }
.rl-pic { display: block; min-width: 72px; min-height: 72px; max-width: 100%; max-height: 180px; border-radius: 8px; object-fit: contain; background: rgba(0, 0, 0, .25); color: #a8936c; font: 600 11px 'Manrope', sans-serif; }
.rl-pics { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
.rl-pics p { margin: 0; }
.rl-thumb { display: block; max-width: 100%; border-radius: 9px; border: 2px solid transparent; }
.rl-thumb.hit { border-color: currentColor; }
.was .rl-thumb { color: rgba(255, 122, 107, .7); }
.now .rl-thumb { color: rgba(126, 208, 122, .7); }
.rl-ln { display: block; min-height: 1.5em; }
.rl-ln.hit { margin: 0 -4px; padding: 0 4px; border-radius: 4px; }
.was .rl-ln.hit { background: rgba(255, 107, 94, .18); text-decoration: line-through; text-decoration-color: rgba(255, 155, 143, .55); }
.now .rl-ln.hit { background: rgba(126, 208, 122, .18); }
.rl-ln.gap { color: #a8936c; }
.rl-rich { max-height: 260px; margin-top: 2px; overflow-y: auto; font-size: 13px; }
.was { background: rgba(255, 107, 94, .07); border: 1px solid rgba(255, 107, 94, .2); }
.now { background: rgba(126, 208, 122, .07); border: 1px solid rgba(126, 208, 122, .2); }
.rl-acts { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
.rl-done { color: #a8936c; font: 700 12px 'Manrope', sans-serif; }
@media (max-width: 640px) {
  .rl-main { grid-template-columns: minmax(0, 1fr) auto; }
  .rl-act { grid-column: 1 / -1; }
  .rl-cols { grid-template-columns: 1fr; }
}
</style>
