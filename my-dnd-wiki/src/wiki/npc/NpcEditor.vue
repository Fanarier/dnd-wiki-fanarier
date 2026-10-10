<template>
  <!-- редактор листа НПС (мастер). Арты сохраняются сразу, остальное — кнопкой «Сохранить» -->
  <div class="ne-back" @pointerdown.self="tryClose">
    <section class="ne" role="dialog" aria-modal="true" :aria-label="`Лист: ${f.name}`">
      <header>
        <div><small>Правка листа · {{ groupOf(f.group).one }}</small><b>{{ f.name || 'Без имени' }}</b></div>
        <button type="button" class="ne-x" aria-label="Закрыть" @click="tryClose">×</button>
      </header>
      <nav class="ne-nav">
        <button v-for="s in SECTIONS" :key="s.key" type="button" :class="{ on: sec === s.key }" @click="sec = s.key">{{ s.label }}</button>
      </nav>

      <div class="ne-body">
        <!-- ===== Основное ===== -->
        <template v-if="sec === 'main'">
          <div class="ne-grid">
            <label>Имя<input v-model.trim="f.name" maxlength="80" /></label>
            <label>Группа<select v-model="f.group"><option v-for="g in NPC_GROUPS" :key="g.key" :value="g.key">{{ g.label }}</option></select></label>
            <label>Карточка в «Героях Анкарии»
              <select v-model="f.heroId"><option :value="null">— не связан —</option><option v-for="h in heroes" :key="h.id" :value="h.id">{{ h.name }} ({{ KIND[h.kind] || h.kind }})</option></select>
            </label>
            <label>Где живёт<input v-model.trim="f.home" maxlength="120" placeholder="Город Мунлихт" /></label>
          </div>
          <label class="ne-chk"><input v-model="f.hidden" type="checkbox" /> ☾ Скрыть от игроков — лист видят только мастера</label>
          <div class="ne-sub">Статус <small>любая фраза и цвет</small></div>
          <div class="ne-status">
            <input v-model.trim="f.status.text" maxlength="80" placeholder="Свободен, В группе, Занят…" />
            <input v-model="f.status.color" type="color" title="Цвет статуса" />
            <span class="ne-pill" :style="{ '--sc': f.status.color }">{{ f.status.text || 'пример' }}</span>
          </div>
          <div class="ne-presets">
            <button v-for="p in STATUS_PRESETS" :key="p[0]" type="button" :style="{ '--sc': p[1] }" @click="Object.assign(f.status, { text: p[0], color: p[1] })">{{ p[0] }}</button>
          </div>
          <div class="ne-sub">Основная информация <button v-if="missingInfo.length" type="button" class="ne-mini" @click="addMissingInfo">+ поля группы ({{ missingInfo.length }})</button></div>
          <div v-for="(r, i) in f.info" :key="i" class="ne-row">
            <input v-model.trim="r.k" class="k" list="ne-info-keys" placeholder="Поле" />
            <input v-model="r.v" placeholder="Значение (??? — пока неизвестно)" />
            <RowBtns :list="f.info" :i="i" />
          </div>
          <button type="button" class="ne-add" @click="f.info.push({ k: '', v: '' })">+ поле</button>
          <datalist id="ne-info-keys"><option v-for="k in allInfoKeys" :key="k" :value="k" /></datalist>
        </template>

        <!-- ===== Специализации и слабости ===== -->
        <template v-else-if="sec === 'levels'">
          <div class="ne-sub">Специализации <small>Новичок → Легенда</small></div>
          <div v-for="(r, i) in f.specs" :key="'s' + i" class="ne-row">
            <input v-model.trim="r.name" placeholder="Охота" />
            <select v-model="r.level" class="lv"><option value="">—</option><option v-for="l in SPEC_LEVELS" :key="l.name" :value="l.name">{{ l.name }}</option></select>
            <RowBtns :list="f.specs" :i="i" />
          </div>
          <button type="button" class="ne-add" @click="f.specs.push({ name: '', level: 'Новичок' })">+ специализация</button>
          <div class="ne-sub">Слабости <small>Плохо → Ужасно</small></div>
          <div v-for="(r, i) in f.weak" :key="'w' + i" class="ne-row">
            <input v-model.trim="r.name" placeholder="Тактика" />
            <select v-model="r.level" class="lv"><option value="">—</option><option v-for="l in WEAK_LEVELS" :key="l.name" :value="l.name">{{ l.name }}</option></select>
            <RowBtns :list="f.weak" :i="i" />
          </div>
          <button type="button" class="ne-add" @click="f.weak.push({ name: '', level: 'Плохо' })">+ слабость</button>
        </template>

        <!-- ===== Владения ===== -->
        <template v-else-if="sec === 'prof'">
          <div v-for="(r, i) in f.prof" :key="i" class="ne-row">
            <input v-model.trim="r.name" placeholder="Секиры, Общий язык…" />
            <input v-model.trim="r.level" class="lv" list="ne-prof-levels" placeholder="Эксперт" />
            <RowBtns :list="f.prof" :i="i" />
          </div>
          <button type="button" class="ne-add" @click="f.prof.push({ name: '', level: '' })">+ владение</button>
          <datalist id="ne-prof-levels"><option v-for="l in PROF_LEVELS" :key="l" :value="l" /></datalist>
          <label class="ne-num">Свободных слотов владения<input v-model.number="f.profSlots" type="number" min="0" max="30" /></label>
        </template>

        <!-- ===== Навыки ===== -->
        <template v-else-if="sec === 'skills'">
          <p class="ne-hint">Название подсказывается из справочника. Описание навыка общее — его правит ✎ (меняется у всех, у кого этот навык).</p>
          <div class="ne-sub">Пассивные навыки</div>
          <div v-for="(r, i) in f.passives" :key="'p' + i" class="ne-row four">
            <input v-model.trim="r.name" list="ne-pass" placeholder="Название" @change="fillPassive(r)" />
            <input v-model.trim="r.type" class="lv" list="ne-types" placeholder="Расовый" />
            <button type="button" class="ne-mini" :class="{ warn: !libDesc('passive', r.name) }" :title="libDesc('passive', r.name) ? 'Общее описание' : 'Описания нет — добавить'" :disabled="!r.name" @click="skill = { kind: 'passive', entry: r }">✎</button>
            <RowBtns :list="f.passives" :i="i" />
          </div>
          <button type="button" class="ne-add" @click="f.passives.push({ name: '', type: '' })">+ пассивный навык</button>

          <div class="ne-sub">Активные навыки</div>
          <div v-for="(r, i) in f.actives" :key="'a' + i" class="ne-act">
            <div class="ne-row four">
              <input v-model.trim="r.name" list="ne-act" placeholder="Название" @change="fillActive(r)" />
              <input v-model.trim="r.type" class="lv" list="ne-types" placeholder="Классовый" />
              <button type="button" class="ne-mini" :class="{ warn: !libDesc('active', r.name) && !r.desc }" title="Общее описание" :disabled="!r.name" @click="skill = { kind: 'active', entry: r }">✎</button>
              <RowBtns :list="f.actives" :i="i" />
            </div>
            <div class="ne-row two">
              <input v-model.trim="r.cooldown" placeholder="Перезарядка 2 хода" />
              <input v-model.trim="r.cost" placeholder="Требует 30 Ярости" />
            </div>
            <label class="ne-chk small"><input type="checkbox" :checked="r.desc !== undefined" @change="toggleOwn(r, $event.target.checked)" /> своё описание только у этого НПС</label>
            <textarea v-if="r.desc !== undefined" v-model="r.desc" rows="3" placeholder="Описание для этого НПС" />
            <p v-else-if="libDesc('active', r.name)" class="ne-lib">{{ libDesc('active', r.name) }}</p>
          </div>
          <button type="button" class="ne-add" @click="f.actives.push({ name: '', type: '', cooldown: '', cost: '' })">+ активный навык</button>
          <datalist id="ne-pass"><option v-for="s in libOf('passive')" :key="s.id" :value="s.name" /></datalist>
          <datalist id="ne-act"><option v-for="s in libOf('active')" :key="s.id" :value="s.name" /></datalist>
          <datalist id="ne-types"><option v-for="t in TYPES" :key="t" :value="t" /></datalist>
        </template>

        <!-- ===== Бой ===== -->
        <template v-else-if="sec === 'combat'">
          <div class="ne-grid six">
            <label v-for="c in COMBAT" :key="c.k">{{ c.icon }} {{ c.k }}<input v-model.trim="f.combat[c.k]" /></label>
          </div>
          <div class="ne-grid six">
            <label v-for="s in STATS" :key="s">{{ s }} <small v-if="mod(f.stats[s]) != null">{{ signed(mod(f.stats[s])) }}</small><input v-model.trim="f.stats[s]" /></label>
          </div>
          <div class="ne-sub">Спасброски</div>
          <div v-for="(r, i) in f.saves" :key="'v' + i" class="ne-row">
            <input v-model.trim="r.stat" list="ne-stats" placeholder="Сила" />
            <input v-model.trim="r.value" class="lv" placeholder="10" />
            <RowBtns :list="f.saves" :i="i" />
          </div>
          <button type="button" class="ne-add" @click="f.saves.push({ stat: '', value: '' })">+ спасбросок</button>
          <datalist id="ne-stats"><option v-for="s in STATS" :key="s" :value="s" /></datalist>
          <div class="ne-sub">Сопротивления и уязвимости</div>
          <div v-for="(r, i) in f.resist" :key="'r' + i" class="ne-row">
            <input v-model.trim="r.kind" placeholder="Огонь" />
            <input v-model.trim="r.value" class="lv" list="ne-res" placeholder="Сопротивление 35%" />
            <RowBtns :list="f.resist" :i="i" />
          </div>
          <button type="button" class="ne-add" @click="f.resist.push({ kind: '', value: '' })">+ строка</button>
          <datalist id="ne-res"><option value="Сопротивление 35%" /><option value="Уязвимость" /><option value="Иммунитет" /></datalist>
          <div class="ne-sub">Атаки</div>
          <div v-for="(r, i) in f.attacks" :key="'t' + i" class="ne-row atk">
            <input v-model.trim="r.name" placeholder="Секира" />
            <input v-model.trim="r.dtype" placeholder="Физический" />
            <input v-model.trim="r.kind" placeholder="Разрез" />
            <input v-model.trim="r.dmg" class="num" placeholder="24" />
            <input v-model.trim="r.note" placeholder="Заметка" />
            <RowBtns :list="f.attacks" :i="i" />
          </div>
          <button type="button" class="ne-add" @click="f.attacks.push({ name: '', dtype: '', kind: '', dmg: '', note: '' })">+ атака</button>
          <div class="ne-sub">Заклинания, техники, дрессировки</div>
          <label class="ne-num">Заголовок блока<input v-model.trim="f.spellsTitle" :placeholder="SPELLS_TITLE[f.group] || 'Заклинания и Техники'" /></label>
          <div v-for="(r, i) in f.spells" :key="'z' + i" class="ne-row one">
            <input v-model="f.spells[i]" placeholder="Название" />
            <RowBtns :list="f.spells" :i="i" />
          </div>
          <button type="button" class="ne-add" @click="f.spells.push('')">+ строка</button>
          <label class="ne-num">Свободных слотов<input v-model.number="f.spellSlots" type="number" min="0" max="30" /></label>
        </template>

        <!-- ===== Списки ===== -->
        <template v-else-if="sec === 'lists'">
          <p class="ne-hint">Занятия и хобби, снаряжение, инвентарь, любимые вещи, профессии, квесты — по строке на пункт.</p>
          <div v-for="(l, i) in f.lists" :key="i" class="ne-list">
            <div class="ne-row one"><input v-model.trim="l.title" placeholder="Заголовок" /><RowBtns :list="f.lists" :i="i" /></div>
            <textarea :value="l.items.join('\n')" rows="4" placeholder="Каждый пункт с новой строки" @input="l.items = $event.target.value.split('\n')" />
          </div>
          <div class="ne-presets">
            <button v-for="t in missingLists" :key="t" type="button" @click="f.lists.push({ title: t, items: [] })">+ {{ t }}</button>
            <button type="button" @click="f.lists.push({ title: '', items: [] })">+ свой список</button>
          </div>
        </template>

        <!-- ===== Арты (сохраняются сразу) ===== -->
        <template v-else-if="sec === 'arts'">
          <div class="ne-sub">Миниатюра на карте <small>кружок над городом, где живёт НПС</small></div>
          <div class="ne-avrow">
            <span class="ne-av"><img v-if="avatarSrc" :src="avatarSrc" :style="avatarStyle" alt="" /></span>
            <div class="ne-avside">
              <div class="ne-presets">
                <button type="button" :disabled="!arts.length || avBusy" @click="cropFromArt">✂ Вырезать из первого арта</button>
                <label class="ne-filebtn">{{ avBusy ? 'Загружаю…' : 'Своя картинка' }}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden @change="ownAvatar" /></label>
                <button v-if="live?.avatar" type="button" @click="resetAvatar">Сбросить</button>
              </div>
              <p class="ne-hint">{{ live?.avatar ? 'Своя миниатюра.' : 'Сейчас берётся из первого арта.' }} {{ placeHint }}</p>
            </div>
          </div>
          <div class="ne-sub">Арты</div>
          <p class="ne-hint">Первый арт — обложка. «Форма» объединяет арты в переключатели (у Луны — две формы и наряды). Изменения здесь сохраняются сразу.</p>
          <div class="ne-arts">
            <div v-for="(a, i) in arts" :key="a.id" class="ne-art">
              <img :src="heroPortraitUrl(a.thumb || a.file)" alt="" />
              <input :value="a.label" placeholder="Подпись" maxlength="60" @change="patchArt(a, { label: $event.target.value })" />
              <input :value="a.group" placeholder="Форма / наряд" list="ne-forms" maxlength="40" @change="patchArt(a, { group: $event.target.value })" />
              <div class="ne-art-btns">
                <button type="button" :disabled="i === 0" title="Левее" @click="moveArt(i, -1)">◀</button>
                <button type="button" :disabled="i === arts.length - 1" title="Правее" @click="moveArt(i, 1)">▶</button>
                <button type="button" class="no" title="Удалить арт" @click="dropArt(a)">✕</button>
              </div>
            </div>
            <label class="ne-art add">{{ uploading ? 'Загружаю…' : '＋ арты' }}<input type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif" hidden @change="upload" /></label>
          </div>
          <datalist id="ne-forms"><option v-for="g in formsUsed" :key="g" :value="g" /></datalist>
        </template>
      </div>

      <footer>
        <button type="button" class="ne-btn no" @click="remove">Удалить НПС</button>
        <span class="grow" />
        <span v-if="dirty" class="ne-dirty">есть несохранённые правки</span>
        <button type="button" class="ne-btn" @click="tryClose">Отмена</button>
        <button type="button" class="ne-btn primary" :disabled="busy || !f.name" @click="save">Сохранить</button>
      </footer>
    </section>
    <NpcSkillDialog v-if="skill" :kind="skill.kind" :entry="skill.entry" @close="skill = null" />
  </div>
</template>

<script setup>
import { computed, defineComponent, h, reactive, ref } from 'vue'
import NpcSkillDialog from './NpcSkillDialog.vue'
import { store, npcState, loadNpcs, act, api, toast, heroPortraitUrl, uploadNpcArt, uploadNpcAvatar } from '../../map/store.js'
import { cropImage } from '../../components/cropState.js'
import { NPC_GROUPS, groupOf, SPEC_LEVELS, WEAK_LEVELS, STATS, COMBAT, mod, signed, INFO_KEYS, LIST_TITLES, SPELLS_TITLE, skillKey, findPlace } from '../../shared/npc.js'

const props = defineProps({ npc: { type: Object, required: true } })
const emit = defineEmits(['close'])

// кнопки строки: выше, ниже, удалить
const RowBtns = defineComponent({
  props: { list: Array, i: Number },
  setup: p => () => h('span', { class: 'ne-rb' }, [
    h('button', { type: 'button', title: 'Выше', disabled: p.i === 0, onClick: () => p.list.splice(p.i - 1, 0, p.list.splice(p.i, 1)[0]) }, '↑'),
    h('button', { type: 'button', title: 'Ниже', disabled: p.i === p.list.length - 1, onClick: () => p.list.splice(p.i + 1, 0, p.list.splice(p.i, 1)[0]) }, '↓'),
    h('button', { type: 'button', title: 'Удалить строку', class: 'no', onClick: () => p.list.splice(p.i, 1) }, '✕')
  ])
})

const SECTIONS = [
  { key: 'main', label: 'Основное' }, { key: 'levels', label: 'Специализации' }, { key: 'prof', label: 'Владения' },
  { key: 'skills', label: 'Навыки' }, { key: 'combat', label: 'Бой' }, { key: 'lists', label: 'Списки' }, { key: 'arts', label: 'Арты' }
]
const sec = ref('main')
const KIND = { character: 'персонаж', sidekick: 'сайд-кик', companion: 'компаньон' }
const STATUS_PRESETS = [['Свободен', '#9be07a'], ['В группе', '#8fc7ff'], ['Занят', '#ffb36b'], ['Обучение', '#c9a2ff'], ['Отдыхает', '#6fd6c8'], ['В бою', '#ff7a6b'], ['Недоступен', '#9a948a']]
const PROF_LEVELS = ['Базовое', 'Эксперт', 'Мастер', 'Полное', 'Носитель', 'Понимание']
const TYPES = ['Расовый', 'Классовый', 'Видовой', 'Расовый, Видовой', 'Особый']

// рабочая копия листа без артов
const clone = n => {
  const { arts, ...rest } = JSON.parse(JSON.stringify(n))
  rest.status ||= { text: '', color: '#9be07a' }
  for (const k of ['info', 'lists', 'specs', 'weak', 'prof', 'passives', 'actives', 'saves', 'resist', 'attacks', 'spells']) rest[k] ||= []
  rest.combat ||= {}
  rest.stats ||= {}
  return rest
}
const f = reactive(clone(props.npc))
const start = JSON.stringify(f)
const dirty = computed(() => JSON.stringify(f) !== start)

const heroes = computed(() => (store.data.heroes || []).filter(h => h.kind !== 'character' || h.id === f.heroId))
const allInfoKeys = computed(() => [...new Set(Object.values(INFO_KEYS).flat())])
const missingInfo = computed(() => (INFO_KEYS[f.group] || []).filter(k => !f.info.some(r => r.k === k)))
const addMissingInfo = () => missingInfo.value.forEach(k => f.info.push({ k, v: '' }))
const missingLists = computed(() => (LIST_TITLES[f.group] || []).filter(t => !f.lists.some(l => l.title === t)))

// справочник навыков: подсказки, автозаполнение и общее описание
const libOf = kind => npcState.skills.filter(s => s.kind === kind)
const lib = (kind, name) => npcState.skills.find(s => skillKey(s.kind, s.name) === skillKey(kind, name))
const libDesc = (kind, name) => lib(kind, name)?.desc || ''
function fillPassive(r) { const s = lib('passive', r.name); if (s && !r.type) r.type = s.type }
function fillActive(r) {
  const s = lib('active', r.name)
  if (!s) return
  r.type ||= s.type
  r.cooldown ||= s.cooldown
  r.cost ||= s.cost
}
function toggleOwn(r, on) {
  if (on) r.desc = libDesc('active', r.name)
  else delete r.desc
}

const busy = ref(false)
async function save() {
  busy.value = true
  try {
    const body = JSON.parse(JSON.stringify(f))
    body.lists = body.lists.map(l => ({ ...l, items: l.items.map(s => s.trim()).filter(Boolean) }))
    // своё описание, совпавшее с общим, не храним
    for (const a of body.actives) if (a.desc !== undefined && (!a.desc.trim() || a.desc === libDesc('active', a.name))) delete a.desc
    await api('PATCH', `/api/npcs/${props.npc.id}`, body)
    // новые навыки сразу попадают в справочник — дальше им можно дописать описание
    for (const [kind, rows] of [['passive', body.passives], ['active', body.actives]]) {
      for (const r of rows) {
        if (!r.name || r.name === '???' || lib(kind, r.name)) continue
        await api('POST', '/api/npc-skills', { kind, name: r.name, type: r.type, cooldown: r.cooldown || '', cost: r.cost || '' }).catch(() => null)
      }
    }
    toast('Лист сохранён')
    await loadNpcs(true)
    emit('close')
  } catch (e) {
    toast(e.message, 'error')
  } finally {
    busy.value = false
  }
}
function tryClose() {
  if (dirty.value && !confirm('Закрыть без сохранения? Правки пропадут.')) return
  emit('close')
}
async function remove() {
  if (!confirm(`Удалить НПС «${props.npc.name}» вместе с артами? Это нельзя отменить.`)) return
  try { await act('DELETE', `/api/npcs/${props.npc.id}`, undefined, 'НПС удалён'); emit('close') } catch { /* тост */ }
}

// арты — прямо на сервер
const arts = computed(() => npcState.npcs.find(n => n.id === props.npc.id)?.arts || [])
const formsUsed = computed(() => [...new Set(npcState.npcs.flatMap(n => (n.arts || []).map(a => a.group)).filter(Boolean))])
const uploading = ref(false)
async function upload(e) {
  const files = [...(e.target.files || [])]
  e.target.value = ''
  if (!files.length) return
  uploading.value = true
  try {
    for (const file of files) await uploadNpcArt(props.npc.id, file)
    toast(files.length > 1 ? `Загружено артов: ${files.length}` : 'Арт загружен')
    await loadNpcs(true)
  } catch (err) { toast(err.message, 'error') } finally { uploading.value = false }
}
async function patchArt(a, patch) {
  try { await api('PATCH', `/api/npcs/${props.npc.id}/arts/${a.id}`, patch); await loadNpcs(true) } catch (e) { toast(e.message, 'error') }
}
async function moveArt(i, d) {
  const ids = arts.value.map(a => a.id)
  ids.splice(i + d, 0, ids.splice(i, 1)[0])
  try { await api('POST', `/api/npcs/${props.npc.id}/arts-order`, { ids }); await loadNpcs(true) } catch (e) { toast(e.message, 'error') }
}
async function dropArt(a) {
  if (!confirm('Удалить этот арт?')) return
  try { await api('DELETE', `/api/npcs/${props.npc.id}/arts/${a.id}`); await loadNpcs(true) } catch (e) { toast(e.message, 'error') }
}
const skill = ref(null)

// миниатюра на карту: своя (квадрат) или — по умолчанию — первый арт
const live = computed(() => npcState.npcs.find(n => n.id === props.npc.id))
const avatarSrc = computed(() => heroPortraitUrl(live.value?.avatar || arts.value[0]?.thumb || arts.value[0]?.file || ''))
const avatarStyle = computed(() => (live.value?.avatar ? null : { objectPosition: `${arts.value[0]?.pos?.x ?? 50}% ${arts.value[0]?.pos?.y ?? 20}%` }))
const placeHint = computed(() => {
  const p = findPlace(f.home, store.data.cities, store.data.settlements)
  return p?.city ? `Видна на карте над «${p.city.name}».` : f.home ? 'Место жительства не совпало ни с одним городом на карте — на карте её не будет.' : 'Впиши, где живёт НПС, — тогда она появится над этим городом.'
})
const avBusy = ref(false)
async function setAvatar(file) {
  const blob = await cropImage(file, { title: `Миниатюра: ${f.name}`, size: 256 })
  if (!blob) return
  avBusy.value = true
  try { await uploadNpcAvatar(props.npc.id, blob); toast('Миниатюра обновлена'); await loadNpcs(true) } catch (e) { toast(e.message, 'error') } finally { avBusy.value = false }
}
async function cropFromArt() {
  try {
    const a = arts.value[0]
    const blob = await (await fetch(heroPortraitUrl(a.file))).blob()
    await setAvatar(new File([blob], 'art', { type: blob.type || 'image/webp' }))
  } catch (e) { toast(e.message, 'error') }
}
async function ownAvatar(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (file) try { await setAvatar(file) } catch (err) { toast(err.message, 'error') }
}
async function resetAvatar() {
  try { await api('DELETE', `/api/npcs/${props.npc.id}/avatar`); toast('Миниатюра снова из первого арта'); await loadNpcs(true) } catch (e) { toast(e.message, 'error') }
}
</script>

<style scoped>
.ne-back { position: fixed; inset: 0; z-index: 300; display: grid; place-items: center; padding: 16px; background: rgba(5, 6, 10, .72); backdrop-filter: blur(3px); }
.ne { display: flex; flex-direction: column; width: min(860px, 100%); height: min(860px, calc(100vh - 32px)); border-radius: 16px; background: #17130e; border: 1px solid #8a6630; box-shadow: 0 24px 60px rgba(0, 0, 0, .6); color: #efe3c8; font: 13px 'Manrope', sans-serif; overflow: hidden; }
.ne header, .ne footer { display: flex; align-items: center; gap: 8px; padding: 12px 16px; }
.ne header { justify-content: space-between; border-bottom: 1px solid rgba(201, 162, 79, .2); }
.ne header small { display: block; color: #a8936c; font-weight: 800; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; }
.ne header b { font: 700 21px 'Cormorant Garamond', serif; color: #f3d99a; }
.ne-x { border: 0; background: none; color: #a8936c; font-size: 22px; cursor: pointer; }
.ne-nav { display: flex; gap: 4px; padding: 8px 16px; overflow-x: auto; border-bottom: 1px solid rgba(201, 162, 79, .12); }
.ne-nav button { flex: none; padding: 6px 12px; border-radius: 99px; border: 1px solid rgba(231, 197, 111, .25); background: none; color: #cdbf9f; font: 700 12.5px 'Manrope', sans-serif; cursor: pointer; }
.ne-nav button.on { background: rgba(231, 197, 111, .2); color: #f3dc9e; border-color: #e7c56f; }
.ne-body { flex: 1; overflow-y: auto; padding: 14px 16px 18px; display: grid; grid-template-columns: minmax(0, 1fr); align-content: start; gap: 8px; }
.ne-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(190px, 100%), 1fr)); gap: 8px 10px; }
.ne-grid.six { grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); }
.ne-body label { display: grid; gap: 4px; min-width: 0; color: #a8936c; font-weight: 700; font-size: 12px; }
.ne-body label small { color: #8fc7ff; }
.ne-body input:not([type=checkbox]):not([type=color]), .ne-body select, .ne-body textarea { width: 100%; min-width: 0; box-sizing: border-box; padding: 7px 9px; border-radius: 8px; border: 1px solid rgba(231, 197, 111, .25); background: #0f0c08; color: #efe3c8; font: 500 13px/1.45 'Manrope', sans-serif; }
.ne-body textarea { resize: vertical; }
.ne-sub { display: flex; align-items: center; gap: 8px; margin-top: 10px; color: #e6c27a; font: 700 16px 'Cormorant Garamond', serif; }
.ne-sub small { color: #a8936c; font: 700 11.5px 'Manrope', sans-serif; }
.ne-row { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) auto; gap: 6px; align-items: center; }
.ne-row.four { grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) auto auto; }
.ne-row.two { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
.ne-row.one { grid-template-columns: minmax(0, 1fr) auto; }
.ne-row.atk { grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr) minmax(0, 1fr) 64px minmax(0, 1.2fr) auto; }
.ne-row input.k { font-weight: 700; }
.ne-act { display: grid; grid-template-columns: minmax(0, 1fr); gap: 6px; padding: 8px; border-radius: 10px; border: 1px solid rgba(231, 197, 111, .14); background: rgba(255, 255, 255, .02); }
.ne-lib { margin: 0; padding: 6px 9px; border-radius: 8px; background: rgba(255, 255, 255, .03); color: #a8936c; font-size: 12.5px; line-height: 1.5; white-space: pre-line; }
.ne-list { display: grid; grid-template-columns: minmax(0, 1fr); gap: 6px; }
.ne-rb { display: flex; gap: 3px; }
.ne-rb :deep(button), .ne-mini { padding: 5px 8px; border-radius: 7px; border: 1px solid rgba(231, 197, 111, .3); background: rgba(231, 197, 111, .06); color: #f3d99a; font: 700 12px 'Manrope', sans-serif; cursor: pointer; }
.ne-rb :deep(button:disabled), .ne-mini:disabled { opacity: .35; cursor: default; }
.ne-rb :deep(button.no) { color: #ff9b8f; border-color: rgba(255, 107, 91, .35); }
.ne-mini.warn { border-color: rgba(255, 179, 107, .6); color: #ffb36b; }
.ne-add { justify-self: start; padding: 5px 12px; border-radius: 8px; border: 1px dashed rgba(231, 197, 111, .4); background: none; color: #e6c27a; font: 700 12.5px 'Manrope', sans-serif; cursor: pointer; }
.ne-chk { display: flex !important; grid-template-columns: none; align-items: center; gap: 8px; color: #efe3c8 !important; font-size: 13px !important; }
.ne-chk.small { font-size: 12px !important; color: #a8936c !important; }
.ne-num { max-width: 260px; }
.ne-hint { margin: 0; color: #a8936c; font-size: 12.5px; }
.ne-status { display: flex; gap: 8px; align-items: center; }
.ne-status input:first-child { flex: 1; }
.ne-status input[type=color] { width: 40px; height: 34px; padding: 2px; border-radius: 8px; border: 1px solid rgba(231, 197, 111, .25); background: #0f0c08; }
.ne-pill { padding: 3px 10px; border-radius: 99px; border: 1px solid var(--sc); color: var(--sc); background: color-mix(in srgb, var(--sc) 14%, transparent); font-weight: 800; font-size: 12px; white-space: nowrap; }
.ne-presets { display: flex; flex-wrap: wrap; gap: 5px; }
.ne-presets button { --sc: #e6c27a; padding: 3px 10px; border-radius: 99px; border: 1px solid color-mix(in srgb, var(--sc) 55%, transparent); background: none; color: var(--sc); font: 700 12px 'Manrope', sans-serif; cursor: pointer; }
.ne-avrow { display: flex; flex-wrap: wrap; gap: 14px; align-items: center; }
.ne-av { flex: none; width: 72px; height: 72px; border-radius: 50%; overflow: hidden; border: 2px solid #e7c56f; background: #120e09; box-shadow: 0 0 0 3px #241c13, 0 6px 16px rgba(0, 0, 0, .5); }
.ne-av img { width: 100%; height: 100%; object-fit: cover; }
.ne-avside { flex: 1 1 220px; min-width: 0; display: grid; gap: 6px; }
.ne-filebtn { display: inline-block !important; padding: 3px 10px; border-radius: 99px; border: 1px solid rgba(230, 194, 122, .55); color: #e6c27a !important; font: 700 12px 'Manrope', sans-serif !important; cursor: pointer; }
.ne-arts { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
.ne-art { display: grid; gap: 5px; align-content: start; padding: 6px; border-radius: 10px; border: 1px solid rgba(231, 197, 111, .2); background: rgba(255, 255, 255, .02); }
.ne-art img { width: 100%; aspect-ratio: 3 / 4; object-fit: cover; border-radius: 7px; }
.ne-art:first-child { border-color: #e7c56f; }
.ne-art-btns { display: flex; gap: 4px; }
.ne-art-btns button { flex: 1; padding: 4px 0; border-radius: 6px; border: 1px solid rgba(231, 197, 111, .3); background: none; color: #f3d99a; cursor: pointer; }
.ne-art-btns button:disabled { opacity: .3; }
.ne-art-btns .no { color: #ff9b8f; border-color: rgba(255, 107, 91, .35); }
.ne-art.add { display: grid !important; place-items: center; min-height: 180px; border-style: dashed; color: #e6c27a !important; font-size: 14px !important; cursor: pointer; }
.ne footer { border-top: 1px solid rgba(201, 162, 79, .2); flex-wrap: wrap; }
.ne-dirty { color: #ffb36b; font-size: 12px; font-weight: 700; }
.ne-btn { padding: 7px 14px; border-radius: 9px; border: 1px solid rgba(201, 162, 79, .45); background: rgba(231, 197, 111, .08); color: #f3d99a; font: 700 13px 'Manrope', sans-serif; cursor: pointer; }
.ne-btn.primary { background: linear-gradient(180deg, #f0cf83, #c99a45); color: #1b140c; border-color: #e6c27a; }
.ne-btn.no { border-color: rgba(255, 107, 91, .45); color: #ff9b8f; background: none; }
.ne-btn:disabled { opacity: .5; }
.grow { flex: 1; }
@media (max-width: 600px) {
  .ne-row, .ne-row.four, .ne-row.atk { grid-template-columns: minmax(0, 1fr) auto; }
  .ne-row > input.lv, .ne-row > select.lv { grid-column: 1; }
}
</style>
