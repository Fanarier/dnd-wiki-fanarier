<template>
  <!-- эффекты на персонаже: иконки из вики со стаками и оставшимися ходами; щелчок — что делает (и правка),
       «＋» — выбрать эффект из вики или вписать свой. Общий для книги персонажа и сводки отряда -->
  <div class="ec" :class="{ compact }">
    <button v-for="(fx, i) in list" :key="i" ref="chips" type="button" class="ec-chip" :class="[kindOf(fx), { on: openIdx === i, fresh: fresh === (fx.Id || fx.Name) }]"
            :title="tip(fx)" @click="openAt(i, $event)">
      <img v-if="wiki(fx)?.icon" :src="wiki(fx).icon" alt="" />
      <span v-else class="ec-ini">{{ (fx.Name || '?')[0] }}</span>
      <b v-if="fx.Stacks > 1" class="ec-st">{{ fx.Stacks }}</b>
      <i v-if="fx.Turns" class="ec-t">{{ fx.Turns }}</i>
    </button>
    <button v-if="editable" type="button" class="ec-add" :title="list.length ? 'Наложить эффект' : 'Наложить эффект (из вики или свой)'" @click="openPicker($event)">＋<span v-if="!list.length && !compact"> эффект</span></button>
    <span v-if="!list.length && !editable && !compact" class="ec-none">нет эффектов</span>

    <Teleport to="body">
      <!-- карточка эффекта -->
      <div v-if="openIdx != null && cur" ref="pop" class="ec-pop" :class="kindOf(cur)" :style="popStyle" @click.stop>
        <header>
          <span class="ec-big"><img v-if="wiki(cur)?.icon" :src="wiki(cur).icon" alt="" /><span v-else>{{ (cur.Name || '?')[0] }}</span></span>
          <div>
            <b>{{ cur.Name }}</b>
            <small>{{ KIND[kindOf(cur)]?.one }} эффект{{ wiki(cur)?.tag ? ' · ' + wiki(cur).tag : '' }}</small>
          </div>
          <button type="button" class="ec-x" aria-label="Закрыть" @click="close">✕</button>
        </header>
        <p v-if="desc(cur)" class="ec-desc">{{ desc(cur) }}</p>
        <template v-if="editable">
          <div class="ec-row">
            <span>Стаки</span>
            <button type="button" @click="bump(openIdx, 'Stacks', -1)">−</button><b>{{ cur.Stacks || 1 }}</b><button type="button" @click="bump(openIdx, 'Stacks', 1)">＋</button>
            <span class="grow" />
            <span>Ходов</span>
            <button type="button" @click="bump(openIdx, 'Turns', -1)">−</button><b>{{ cur.Turns || '∞' }}</b><button type="button" @click="bump(openIdx, 'Turns', 1)">＋</button>
          </div>
          <input class="ec-note" :value="cur.Note" maxlength="400" placeholder="Заметка: откуда, условие снятия…" @change="set(openIdx, { Note: $event.target.value })" />
          <button type="button" class="ec-rm" @click="remove(openIdx)">Снять эффект</button>
        </template>
        <template v-else>
          <p class="ec-meta"><span v-if="cur.Stacks > 1">Стаки: {{ cur.Stacks }}</span><span v-if="cur.Turns">Осталось ходов: {{ cur.Turns }}</span><span v-if="cur.Note">{{ cur.Note }}</span></p>
        </template>
      </div>

      <!-- выбор эффекта -->
      <div v-if="picker" ref="pop" class="ec-pop ec-pick" :style="popStyle" @click.stop>
        <header>
          <input ref="qIn" v-model="q" class="ec-q" placeholder="Найти или вписать свой…" @keydown.enter="addFirst" />
          <button type="button" class="ec-x" aria-label="Закрыть" @click="close">✕</button>
        </header>
        <nav class="ec-tabs">
          <button v-for="k in EFFECT_KINDS" :key="k.id" type="button" :class="[k.id, { on: kind === k.id }]" @click="kind = k.id">{{ k.icon }} {{ k.name }}</button>
        </nav>
        <div class="ec-grid">
          <button v-for="e in found" :key="e.id" type="button" :class="e.kind" :title="text(e.html)" @click="add(e)">
            <img v-if="e.icon" :src="e.icon" alt="" loading="lazy" /><span>{{ e.name }}</span>
          </button>
          <button v-if="q.trim() && !exact" type="button" class="own" :class="kind" @click="addOwn">✎ Свой: «{{ q.trim() }}»</button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { rulesState, loadRules } from '../../map/store.js'
import { EFFECT_KINDS, findEffect, htmlToText, normName } from '../../shared/rules.js'
import { sfx } from '../../sound/sound.js'

const props = defineProps({ modelValue: { type: Array, default: () => [] }, editable: Boolean, compact: Boolean })
const emit = defineEmits(['update:modelValue'])
onMounted(() => loadRules())

const KIND = Object.fromEntries(EFFECT_KINDS.map(k => [k.id, k]))
const list = computed(() => props.modelValue || [])
const wiki = fx => findEffect(rulesState.effects, fx)
const kindOf = fx => wiki(fx)?.kind || fx.Kind || 'buff'
const text = html => htmlToText(html).replace(/\s+/g, ' ')
const desc = fx => (wiki(fx) ? text(wiki(fx).html) : '')
const tip = fx => [fx.Name + (fx.Stacks > 1 ? ` ×${fx.Stacks}` : '') + (fx.Turns ? ` · ещё ${fx.Turns} х.` : ''), desc(fx), fx.Note].filter(Boolean).join('\n')

/* ---------- всплывашка у значка ---------- */
const openIdx = ref(null)
const picker = ref(false)
const cur = computed(() => (openIdx.value != null ? list.value[openIdx.value] : null))
const pos = ref({ x: 0, y: 0, up: false })
const pop = ref(null)
const popStyle = computed(() => ({ left: pos.value.x + 'px', [pos.value.up ? 'bottom' : 'top']: pos.value.y + 'px' }))
function place(ev) {
  const r = ev.currentTarget.getBoundingClientRect()
  const w = Math.min(320, innerWidth - 16)
  const up = r.bottom + 300 > innerHeight && r.top > 300
  pos.value = { x: Math.max(8, Math.min(innerWidth - w - 8, r.left)), y: up ? innerHeight - r.top + 6 : r.bottom + 6, up }
}
function openAt(i, ev) {
  if (openIdx.value === i) return close()
  picker.value = false
  place(ev)
  openIdx.value = i
  listen()
}
const kind = ref('debuff')
const q = ref('')
const qIn = ref(null)
function openPicker(ev) {
  if (picker.value) return close()
  openIdx.value = null
  place(ev)
  q.value = ''
  picker.value = true
  listen()
  nextTick(() => qIn.value?.focus())
}
const norm = s => String(s || '').toLowerCase().replace(/ё/g, 'е')
const found = computed(() => {
  const t = norm(q.value.trim())
  const all = rulesState.effects.slice().sort((a, b) => a.order - b.order)
  return t ? all.filter(e => norm(e.name + ' ' + e.tag).includes(t)).slice(0, 40) : all.filter(e => e.kind === kind.value)
})
const exact = computed(() => rulesState.effects.some(e => normName(e.name) === normName(q.value)))

function close() { openIdx.value = null; picker.value = false; unlisten() }
const outside = e => { if (!pop.value?.contains(e.target) && !e.target.closest?.('.ec')) close() }
const esc = e => { if (e.key === 'Escape') close() }
// прокрутили страницу — окошко уезжает от значка, закрываем; прокрутка внутри самого окошка (список эффектов) — нет
const onScroll = e => { if (!(e.target instanceof Node && pop.value?.contains(e.target))) close() }
function listen() { setTimeout(() => { addEventListener('pointerdown', outside); addEventListener('keydown', esc); addEventListener('scroll', onScroll, { capture: true }) }) }
function unlisten() { removeEventListener('pointerdown', outside); removeEventListener('keydown', esc); removeEventListener('scroll', onScroll, { capture: true }) }
onBeforeUnmount(unlisten)

/* ---------- правка ---------- */
const put = next => emit('update:modelValue', next)
function set(i, patch) { put(list.value.map((x, j) => (j === i ? { ...x, ...patch } : x))) }
function bump(i, key, d) {
  const x = list.value[i]
  const v = Math.max(key === 'Stacks' ? 1 : 0, (Number(x[key]) || (key === 'Stacks' ? 1 : 0)) + d)
  set(i, { [key]: v })
}
function remove(i) { put(list.value.filter((_, j) => j !== i)); close() }
// тот же эффект ещё раз — плюс стак, а не второй значок
// только что наложенный эффект вспыхивает кольцом
const fresh = ref('')
function flash(key) { fresh.value = key; setTimeout(() => { if (fresh.value === key) fresh.value = '' }, 1200) }
function add(e) {
  flash(e.id)
  const i = list.value.findIndex(x => x.Id === e.id || normName(x.Name) === normName(e.name))
  if (i >= 0) bump(i, 'Stacks', 1)
  else put([...list.value, { Id: e.id, Name: e.name, Kind: e.kind, Stacks: 1, Turns: 0, Note: '' }])
  sfx(e.kind === 'debuff' ? 'fail' : 'crit', 0.3)
  close()
}
function addOwn() {
  const name = q.value.trim().slice(0, 80)
  if (!name) return
  put([...list.value, { Id: '', Name: name, Kind: kind.value, Stacks: 1, Turns: 0, Note: '' }])
  close()
}
const addFirst = () => (found.value.length && q.value.trim() ? add(found.value[0]) : addOwn())
</script>

<style scoped>
.ec { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.ec-chip { position: relative; width: 38px; height: 38px; padding: 0; flex: none; border-radius: 10px; border: 1.5px solid var(--fc); background: radial-gradient(circle at 50% 35%, color-mix(in srgb, var(--fc) 30%, #1a140c), #0e0b07); box-shadow: 0 0 10px color-mix(in srgb, var(--fc) 30%, transparent); cursor: pointer; transition: transform .15s; }
.ec-chip:hover, .ec-chip.on { transform: translateY(-2px) scale(1.06); }
/* значки дышат: положительные мягко светятся, отрицательные изредка вздрагивают */
.ec-chip { animation: ec-breath 3.2s ease-in-out infinite; }
.ec-chip.debuff { animation: ec-twitch 4.4s ease-in-out infinite; }
.ec-chip.fresh { animation: ec-fresh 1.1s cubic-bezier(.2, .9, .3, 1.3); }
.ec-chip.fresh::after { content: ''; position: absolute; inset: -4px; border-radius: 13px; border: 2px solid var(--fc); animation: ec-ring 1s ease-out forwards; pointer-events: none; }
@keyframes ec-breath { 50% { box-shadow: 0 0 16px color-mix(in srgb, var(--fc) 55%, transparent); } }
@keyframes ec-twitch { 0%, 88%, 100% { transform: none; } 90% { transform: translateX(-1px) rotate(-3deg); } 93% { transform: translateX(1px) rotate(3deg); } }
@keyframes ec-fresh { 0% { transform: scale(.2) rotate(-30deg); opacity: 0; filter: brightness(2.5); } 60% { transform: scale(1.25); opacity: 1; } 100% { transform: none; filter: none; } }
@keyframes ec-ring { from { transform: scale(.8); opacity: 1; } to { transform: scale(1.9); opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .ec-chip, .ec-chip.debuff, .ec-chip.fresh, .ec-chip.fresh::after { animation: none; } }
.ec-chip img { width: 100%; height: 100%; border-radius: 8px; object-fit: cover; }
.ec-chip, .ec-pop, .ec-grid button { --fc: #7ed07a; }
.debuff { --fc: #ff6b5e; }
.special { --fc: #b9a6ff; }
.ec-ini { color: #fff; font: 800 16px 'Cormorant Garamond', serif; }
.ec-st { position: absolute; right: -5px; top: -6px; min-width: 16px; height: 16px; padding: 0 3px; border-radius: 99px; background: var(--fc); color: #120d08; font: 900 10px/16px 'Manrope', sans-serif; }
.ec-t { position: absolute; left: 50%; bottom: -7px; transform: translateX(-50%); padding: 0 4px; border-radius: 6px; background: #120d08; border: 1px solid var(--fc); color: #fff; font: 800 9.5px/13px 'Manrope', sans-serif; font-style: normal; }
.ec-add { height: 30px; padding: 0 10px; border-radius: 9px; border: 1px dashed rgba(231, 197, 111, .45); background: none; color: #e7c56f; font: 800 13px 'Manrope', sans-serif; cursor: pointer; }
.ec-none { color: #a8936c; font: 600 12px 'Manrope', sans-serif; }
.compact .ec-chip { width: 30px; height: 30px; border-radius: 8px; }
.compact .ec-add { height: 26px; padding: 0 8px; }
.ec-pop { position: fixed; z-index: 600; display: grid; gap: 8px; width: min(320px, calc(100vw - 16px)); padding: 12px; border-radius: 14px; background: #17120c; border: 1px solid color-mix(in srgb, var(--fc) 50%, #3b2a1a); box-shadow: 0 18px 40px rgba(0, 0, 0, .6), 0 0 22px color-mix(in srgb, var(--fc) 15%, transparent); color: #efe3c8; animation: ec-in .15s ease; }
@keyframes ec-in { from { opacity: 0; transform: translateY(4px); } }
.ec-pop header { display: flex; align-items: center; gap: 10px; }
.ec-pop header > div { flex: 1; display: grid; }
.ec-pop header b { font: 700 19px 'Cormorant Garamond', serif; color: #f3dc9e; }
.ec-pop header small { color: #a8936c; font: 700 11px 'Manrope', sans-serif; }
.ec-big { display: grid; place-items: center; width: 46px; height: 46px; flex: none; border-radius: 11px; border: 1.5px solid var(--fc); overflow: hidden; background: #0e0b07; color: #fff; font: 800 20px 'Cormorant Garamond', serif; }
.ec-big img { width: 100%; height: 100%; }
.ec-x { width: 28px; height: 28px; flex: none; border-radius: 8px; border: 1px solid rgba(231, 197, 111, .25); background: none; color: #cdbf9f; cursor: pointer; }
.ec-desc { margin: 0; color: #ddd0b3; font: 500 13px/1.5 'Manrope', sans-serif; }
.ec-meta { display: flex; flex-wrap: wrap; gap: 4px 12px; margin: 0; color: #cdbf9f; font: 700 12px 'Manrope', sans-serif; }
.ec-row { display: flex; align-items: center; gap: 6px; color: #a8936c; font: 700 12px 'Manrope', sans-serif; }
.ec-row button { width: 26px; height: 26px; border-radius: 7px; border: 1px solid rgba(231, 197, 111, .3); background: rgba(231, 197, 111, .06); color: #f3d99a; font: 800 14px 'Manrope', sans-serif; cursor: pointer; }
.ec-row b { min-width: 22px; text-align: center; color: #f3dc9e; font: 800 14px 'Manrope', sans-serif; }
.grow { flex: 1; }
.ec-note, .ec-q { width: 100%; box-sizing: border-box; padding: 6px 9px; border-radius: 8px; border: 1px solid rgba(231, 197, 111, .22); background: rgba(0, 0, 0, .35); color: #efe3c8; font: 600 12.5px 'Manrope', sans-serif; }
.ec-rm { justify-self: start; padding: 5px 11px; border-radius: 8px; border: 1px solid rgba(255, 122, 107, .45); background: none; color: #ff9b8f; font: 700 12px 'Manrope', sans-serif; cursor: pointer; }
.ec-pick { width: min(380px, calc(100vw - 16px)); --fc: #e7c56f; }
.ec-tabs { display: flex; gap: 4px; }
.ec-tabs button { flex: 1; padding: 5px 4px; border-radius: 8px; border: 1px solid rgba(231, 197, 111, .18); background: none; color: #cdbf9f; font: 700 11.5px 'Manrope', sans-serif; cursor: pointer; }
.ec-tabs button.on { border-color: var(--fc); background: color-mix(in srgb, var(--fc) 15%, transparent); color: #fff; }
.ec-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 4px; max-height: 280px; overflow-y: auto; }
.ec-grid button { display: flex; align-items: center; gap: 7px; padding: 4px 6px; border-radius: 9px; border: 1px solid transparent; background: none; color: #efe3c8; font: 600 12.5px 'Manrope', sans-serif; text-align: left; cursor: pointer; }
.ec-grid button:hover { border-color: var(--fc); background: color-mix(in srgb, var(--fc) 10%, transparent); }
.ec-grid img { width: 28px; height: 28px; flex: none; border-radius: 7px; border: 1px solid var(--fc); }
.ec-grid .own { grid-column: 1 / -1; color: #e7c56f; }
</style>
