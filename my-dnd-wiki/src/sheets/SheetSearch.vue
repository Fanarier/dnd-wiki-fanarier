<template>
  <!-- поиск по всему листу (Ctrl+F): навыки, предметы, атаки, черты, журнал… → к разделу с подсветкой -->
  <div class="ss" :class="{ open: open && q }">
    <input ref="inp" v-model="q" class="ss-in" placeholder="🔎 Поиск по листу" aria-label="Поиск по листу" @focus="open = true" @blur="close" @keydown.down.prevent="move(1)" @keydown.up.prevent="move(-1)" @keydown.enter.prevent="pick(results[sel])" @keydown.esc="q = ''; inp.blur()" />
    <div v-if="open && q" class="ss-drop">
      <button v-for="(r, i) in results" :key="i" type="button" :class="{ on: i === sel }" @mousedown.prevent="pick(r)" @mouseenter="sel = i">
        <span class="ss-sec">{{ secName(r.section) }}</span>
        <b>{{ r.label }}</b>
        <small v-if="r.text">{{ snippet(r.text) }}</small>
      </button>
      <div v-if="!results.length" class="ss-none">Ничего не нашлось</div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import Fuse from 'fuse.js'
import { sheet } from './sheetState.js'
import { SKILLS, ATTRS, EQUIP_SLOTS } from '../shared/sheet.js'

const props = defineProps({ sections: { type: Array, required: true } })
const emit = defineEmits(['go'])
const q = ref(''), open = ref(false), sel = ref(0), inp = ref(null)
const strip = s => String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
const secName = k => props.sections.find(s => s.key === k)?.name || ''

// что можно найти: подпись, текст, раздел и метка места на странице
const index = computed(() => {
  const d = sheet.data
  if (!d) return []
  const out = []
  const add = (section, anchor, label, text = '') => { if (label || text) out.push({ section, anchor, label: strip(label) || '—', text: strip(text) }) }
  for (const [p, l] of [['CharacterName', 'Имя'], ['Class', 'Класс'], ['Subclass', 'Подкласс'], ['Mana', 'Мана'], ['Stamina', 'Выносливость'], ['Hits', 'Хиты'], ['Initiative', 'Инициатива']]) add('main', p, l, String(d[p] ?? ''))
  for (let i = 1; i <= 4; i++) if (d[`CustomField${i}Label`] || d[`CustomField${i}Value`]) add('main', `CustomField${i}Value`, d[`CustomField${i}Label`] || `Поле ${i}`, d[`CustomField${i}Value`])
  for (const [p, l] of [['Race', 'Раса'], ['Worldview', 'Мировоззрение'], ['Appearance', 'Внешность'], ['Backstory', 'Предыстория'], ['Buff', 'Бафф'], ['Debuff', 'Дебафф'], ['StartBonus1', 'Старт-бонус 1'], ['StartBonus2', 'Старт-бонус 2'], ['StartBonus3', 'Старт-бонус 3']]) if (d[p]) add('details', p, l, d[p])
  for (const a of ATTRS) add('stats', `attr-${a.key}`, a.name, `спасбросок ${a.short}`)
  for (const s of SKILLS) add('stats', `skill-${s.key}`, s.name, ATTRS.find(a => a.key === s.attr).name)
  d.Skills.forEach((s, i) => add('active', `Skills-${i}`, s.SkillName, s.Description))
  d.PassiveSkills.forEach((s, i) => add('passive', `PassiveSkills-${i}`, s.SkillName, s.Description))
  d.Attacks.forEach((a, i) => add('attacks', `Attacks-${i}`, a.AttackType, a.Description))
  for (const t of ['Trait4', 'Trait9', 'Trait18']) if (d[t].Description) add('traits', t, `Черта ${t.slice(5)} ур.`, d[t].Description)
  d.HumanoidTraits.forEach((t, i) => add('traits', `HumanoidTraits-${i}`, t.Name || 'Черта гуманоида', t.Description))
  d.Proficiencies.forEach((p, i) => add('traits', `Proficiencies-${i}`, p.Description, p.TypeIndex ? 'язык' : 'владение'))
  for (const s of EQUIP_SLOTS) if (d[s.key]) add('equip', s.key, d[s.key].Name || s.name, `${s.name} ${d[s.key].Rarity} ${d[s.key].Stats} ${d[s.key].Effects}`)
  d.Inventory.forEach((it, i) => add('inv', `Inventory-${i}`, it.Name, `${it.Rarity} ${it.Description} ${it.Notes}`))
  d.Resources.forEach((r, i) => add('res', `Resources-${i}`, `${r.Icon} ${r.Name}`, r.Notes))
  d.JournalEntries.forEach((e, i) => add('journal', `JournalEntries-${i}`, e.Title, `${e.Tags} ${e.Content}`))
  d.CustomSheets.forEach((t, i) => add('custom', `CustomSheets-${i}`, t.Name, t.Rows.map(r => r.Cells.join(' ')).join(' ')))
  return out
})
const fuse = computed(() => new Fuse(index.value, { keys: [{ name: 'label', weight: 2 }, 'text'], threshold: 0.34, ignoreLocation: true, minMatchCharLength: 2 }))
const results = computed(() => (q.value.trim().length < 2 ? [] : fuse.value.search(q.value.trim(), { limit: 12 }).map(r => r.item)))
watch(q, () => { sel.value = 0 })
const move = k => { sel.value = (sel.value + k + results.value.length) % Math.max(1, results.value.length) }
function snippet(t) {
  const s = q.value.trim().toLowerCase(), i = t.toLowerCase().indexOf(s)
  if (i < 0) return t.slice(0, 80) + (t.length > 80 ? '…' : '')
  const a = Math.max(0, i - 30)
  return (a ? '…' : '') + t.slice(a, i + 60) + (i + 60 < t.length ? '…' : '')
}
function pick(r) {
  if (!r) return
  emit('go', r)
  open.value = false
  inp.value?.blur()
}
const close = () => setTimeout(() => { open.value = false }, 120)
defineExpose({ focus: () => { inp.value?.focus(); inp.value?.select() } })
</script>

<style scoped>
.ss { position: relative; width: min(260px, 32vw); }
.ss-in { width: 100%; box-sizing: border-box; padding: 7px 10px; border-radius: 9px; border: 1px solid rgba(231, 197, 111, .25); background: rgba(0, 0, 0, .3); color: #efe3c8; font: 600 13px 'Manrope', sans-serif; transition: border-color .2s; }
.ss-in:focus { outline: none; border-color: #e7c56f; }
.ss-drop { position: absolute; right: 0; top: 40px; z-index: 60; width: min(380px, 92vw); max-height: 60vh; overflow-y: auto; display: grid; padding: 6px; border-radius: 12px; background: #17130e; border: 1px solid #8a6630; box-shadow: 0 18px 40px rgba(0, 0, 0, .6); animation: ss-in .14s ease-out; }
.ss-drop button { display: grid; gap: 1px; padding: 7px 9px; border: 0; border-radius: 8px; background: none; color: #efe3c8; text-align: left; cursor: pointer; }
.ss-drop button.on { background: rgba(231, 197, 111, .12); }
.ss-sec { font: 800 9.5px 'Manrope', sans-serif; letter-spacing: .1em; text-transform: uppercase; color: #a8936c; }
.ss-drop b { font: 700 13.5px 'Manrope', sans-serif; }
.ss-drop small { color: #a8936c; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ss-none { padding: 10px; color: #a8936c; font: 600 13px 'Manrope', sans-serif; }
@keyframes ss-in { from { opacity: 0; transform: translateY(-4px); } }
@media (max-width: 760px) and (min-width: 641px) { .ss { width: 34px; } .ss-in { padding: 7px 4px; text-indent: 4px; } .ss-in:focus { position: absolute; right: 0; width: 70vw; z-index: 61; } }
</style>
