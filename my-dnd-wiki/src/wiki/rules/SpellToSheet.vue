<template>
  <!-- «в лист»: заклинание попадает в активные навыки персонажа (листов несколько — выбираешь, в какой) -->
  <span class="sts">
    <button type="button" class="sts-btn" :disabled="busy" title="Добавить заклинание в навыки персонажа" @click="start">＋ в лист</button>
    <div v-if="menu" class="sts-menu" @click.stop>
      <b>В чей лист?</b>
      <button v-for="s in mine" :key="s.id" type="button" @click="add(s)">{{ s.name || 'Без имени' }}<small v-if="s.level"> · {{ s.level }} ур.</small></button>
      <button type="button" class="x" @click="menu = false">Отмена</button>
    </div>
  </span>
</template>

<script setup>
import { onBeforeUnmount, ref } from 'vue'
import { api, toast } from '../../map/store.js'
import { htmlToText, normName } from '../../shared/rules.js'

const props = defineProps({ spell: { type: Object, required: true }, school: { type: Object, required: true } })
const busy = ref(false)
const menu = ref(false)
const mine = ref([])

async function start() {
  busy.value = true
  try {
    const j = await api('GET', '/api/sheets')
    mine.value = (j.sheets || []).filter(s => s.canEdit && !s.deletedAt)
    if (!mine.value.length) toast('Нет листа, который ты можешь править', 'error')
    else if (mine.value.length === 1) await add(mine.value[0])
    else { menu.value = true; setTimeout(() => addEventListener('click', close), 0) }
  } catch (e) { toast(e.message, 'error') } finally { busy.value = false }
}
const close = () => { menu.value = false; removeEventListener('click', close) }
onBeforeUnmount(close)

async function add(s) {
  close()
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
    const skill = { SkillName: x.name, CategoryIndex: 0, Description: head + '\n\n' + htmlToText(x.html), IsActiveSymbol: false }
    await api('PATCH', `/api/sheets/${s.id}`, { ops: [{ p: 'Skills', v: [...data.Skills, skill] }] })
    toast(`«${x.name}» — в навыках ${s.name}`)
  } catch (e) { toast(e.message, 'error') } finally { busy.value = false }
}
</script>

<style scoped>
.sts { position: relative; }
.sts-btn { padding: 3px 9px; border-radius: 8px; border: 1px solid rgba(126, 208, 122, .4); background: rgba(126, 208, 122, .1); color: #b5ecb2; font: 800 11.5px 'Manrope', sans-serif; cursor: pointer; }
.sts-btn:hover:not(:disabled) { background: rgba(126, 208, 122, .2); }
.sts-menu { position: absolute; right: 0; bottom: calc(100% + 6px); z-index: 30; display: grid; gap: 2px; min-width: 190px; padding: 8px; border-radius: 12px; border: 1px solid rgba(185, 166, 255, .4); background: #17132a; box-shadow: 0 14px 30px rgba(0, 0, 0, .55); }
.sts-menu b { padding: 0 4px 4px; color: #b3a8d6; font: 800 11px 'Manrope', sans-serif; letter-spacing: .06em; text-transform: uppercase; }
.sts-menu button { padding: 6px 8px; border: 0; border-radius: 8px; background: none; color: #ece6ff; font: 700 13px 'Manrope', sans-serif; text-align: left; cursor: pointer; }
.sts-menu button:hover { background: rgba(155, 125, 255, .2); }
.sts-menu button small { color: #b3a8d6; }
.sts-menu .x { color: #b3a8d6; }
</style>
