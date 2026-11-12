<template>
  <!-- «в лист»: заклинание попадает в активные навыки персонажа (листов несколько — выбираешь, в какой).
       Меню — поверх всего (в body, fixed): карточки и липкая строка поиска его не перекрывают; открывается вниз или вверх —
       где больше места, не выходит за экран (длинный список — с прокруткой) -->
  <span class="sts">
    <button ref="btn" type="button" class="sts-btn" :disabled="busy" title="Добавить заклинание в навыки персонажа"
      aria-haspopup="menu" :aria-expanded="menu ? 'true' : 'false'" @click="menu ? close() : start()">＋ в лист</button>
    <Teleport to="body">
      <div v-if="menu" ref="box" class="sts-menu" :class="{ up: pos.up }" :style="pos.style" role="menu" aria-label="В чей лист?" @keydown="onKey">
        <b>В чей лист?</b>
        <div class="sts-list">
          <button v-for="s in mine" :key="s.id" type="button" role="menuitem" @click="add(s)">{{ s.name || 'Без имени' }}<small v-if="s.level"> · {{ s.level }} ур.</small></button>
        </div>
        <button type="button" role="menuitem" class="x" @click="close(true)">Отмена</button>
      </div>
    </Teleport>
  </span>
</template>

<script setup>
import { nextTick, onBeforeUnmount, reactive, ref } from 'vue'
import { api, toast, sheetAddTop } from '../../map/store.js'
import { htmlToText, normName } from '../../shared/rules.js'

const props = defineProps({ spell: { type: Object, required: true }, school: { type: Object, required: true } })
const busy = ref(false)
const menu = ref(false)
const mine = ref([])
const btn = ref(null)
const box = ref(null)
const pos = reactive({ up: false, style: {} })

async function start() {
  busy.value = true
  try {
    const j = await api('GET', '/api/sheets')
    mine.value = (j.sheets || []).filter(s => s.canEdit && !s.deletedAt)
    if (!mine.value.length) toast('Нет листа, который ты можешь править', 'error')
    else if (mine.value.length === 1) await add(mine.value[0])
    else await open()
  } catch (e) { toast(e.message, 'error') } finally { busy.value = false }
}

/* ---------- меню: место у кнопки, закрытие снаружи / Esc / прокрутка ---------- */
const GAP = 6, EDGE = 8
function place() {
  const b = btn.value?.getBoundingClientRect()
  const m = box.value
  if (!b || !m) return
  const vw = window.innerWidth, vh = window.innerHeight
  const below = vh - b.bottom - GAP - EDGE, above = b.top - GAP - EDGE
  const need = m.scrollHeight
  // вниз, если влезает или снизу места больше; иначе вверх
  const up = need > below && above > below
  const maxH = Math.max(120, up ? above : below)
  const w = m.offsetWidth
  const left = Math.min(Math.max(EDGE, b.right - w), vw - w - EDGE)
  pos.up = up
  pos.style = { left: Math.max(EDGE, left) + 'px', maxHeight: maxH + 'px', ...(up ? { bottom: vh - b.top + GAP + 'px' } : { top: b.bottom + GAP + 'px' }) }
}
async function open() {
  pos.style = { left: '-9999px', top: '0px' } // сперва меряем, потом ставим на место
  menu.value = true
  await nextTick()
  place()
  addEventListener('pointerdown', onOutside, true)
  addEventListener('scroll', onScroll, true)
  addEventListener('resize', onResize)
  box.value?.querySelector('[role=menuitem]')?.focus({ preventScroll: true })
}
function close(refocus = false) {
  if (menu.value && refocus) btn.value?.focus({ preventScroll: true })
  menu.value = false
  removeEventListener('pointerdown', onOutside, true)
  removeEventListener('scroll', onScroll, true)
  removeEventListener('resize', onResize)
}
const onOutside = e => { if (!box.value?.contains(e.target) && !btn.value?.contains(e.target)) close() }
// прокрутка страницы уводит кнопку — меню закрываем; прокрутка внутри самого меню — нет
const onScroll = e => { if (!box.value?.contains(e.target)) close() }
const onResize = () => close()
function onKey(e) {
  if (e.key === 'Escape') { e.preventDefault(); close(true); return }
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return
  e.preventDefault()
  const items = [...(box.value?.querySelectorAll('[role=menuitem]') || [])]
  const i = items.indexOf(document.activeElement)
  const n = items.length
  const next = e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : (i + (e.key === 'ArrowDown' ? 1 : -1) + n) % n
  items[next]?.focus()
}
onBeforeUnmount(() => close())

async function add(s) {
  close(true)
  busy.value = true
  try {
    const { data } = await api('GET', `/api/sheets/${s.id}`)
    const x = props.spell
    if ([...data.Skills, ...data.PassiveSkills].some(k => normName(k.SkillName) === normName(x.name))) {
      toast(`«${x.name}» уже есть в листе ${s.name}`)
      return
    }
    const head = [
      'Заклинание.',
      `${props.school.name}${x.circle ? (x.circle === 'Б' ? ', базовое' : `, круг ${x.circle}`) : ''}.`,
      x.cost ? `Расход: ${x.cost}.` : '',
      x.cd ? `Перезарядка: ${x.cd}.` : ''
    ].filter(Boolean).join(' ')
    const skill = { SkillName: x.name, CategoryIndex: 2, Description: head + '\n\n' + htmlToText(x.html), IsActiveSymbol: false }
    // в начало или в конец — как выбрано в профиле («Настройки» → «Листы персонажей»)
    const top = sheetAddTop()
    await api('PATCH', `/api/sheets/${s.id}`, { ops: [{ p: 'Skills', v: top ? [skill, ...data.Skills] : [...data.Skills, skill] }] })
    toast(`«${x.name}» — в навыках ${s.name}, ${top ? 'в начале' : 'в конце'} списка`)
  } catch (e) { toast(e.message, 'error') } finally { busy.value = false }
}
</script>

<style scoped>
.sts { position: relative; }
.sts-btn { padding: 3px 9px; border-radius: 8px; border: 1px solid rgba(126, 208, 122, .4); background: rgba(126, 208, 122, .1); color: #b5ecb2; font: 800 11.5px 'Manrope', sans-serif; cursor: pointer; }
.sts-btn:hover:not(:disabled) { background: rgba(126, 208, 122, .2); }
/* в body — поверх карточек, липкой строки поиска и шапки (окна-«задники» сайта — 650–700) */
.sts-menu { position: fixed; z-index: 760; display: flex; flex-direction: column; gap: 2px; min-width: 190px; max-width: min(320px, calc(100vw - 16px)); padding: 8px; border-radius: 12px; border: 1px solid rgba(185, 166, 255, .4); background: #17132a; box-shadow: 0 14px 30px rgba(0, 0, 0, .55); box-sizing: border-box; animation: sts-in .12s ease-out; }
.sts-menu.up { animation-name: sts-in-up; }
.sts-menu > b { flex: none; padding: 0 4px 4px; color: #b3a8d6; font: 800 11px 'Manrope', sans-serif; letter-spacing: .06em; text-transform: uppercase; }
.sts-list { display: grid; gap: 2px; min-height: 0; overflow-y: auto; overscroll-behavior: contain; }
.sts-menu button { flex: none; padding: 6px 8px; border: 0; border-radius: 8px; background: none; color: #ece6ff; font: 700 13px 'Manrope', sans-serif; text-align: left; cursor: pointer; }
.sts-menu button:hover, .sts-menu button:focus-visible { background: rgba(155, 125, 255, .2); outline: none; }
.sts-menu button small { color: #b3a8d6; }
.sts-menu .x { color: #b3a8d6; }
@keyframes sts-in { from { opacity: 0; transform: translateY(-4px); } }
@keyframes sts-in-up { from { opacity: 0; transform: translateY(4px); } }
@media (prefers-reduced-motion: reduce) { .sts-menu { animation: none; } }
</style>
