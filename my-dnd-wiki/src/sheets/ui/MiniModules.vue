<template>
  <!-- мини-модули кованого: название, эффект, иконка (значок или картинка). Сколько даёт платформа к уровню — счётчик,
       сверх него (особые бонусы) можно, но не больше 120. Эффекты складываются, овладения не требуют -->
  <div class="mm" data-find="MiniModules">
    <h3 class="sb-h2 sb-anim">🔩 Мини-модули <small :class="{ over: limit && list.length > limit }" :title="limitTitle">{{ list.length }}{{ limit ? ' / ' + limit : '' }}</small></h3>
    <p class="mm-hint sb-anim">Активируются сразу и не требуют овладения, эффекты складываются. {{ limitTitle }}</p>
    <div class="sb-tools sb-anim">
      <input v-if="list.length > 6" v-model="q" class="sb-input mm-q" placeholder="Найти мини-модуль…" />
      <span class="grow" />
      <button v-if="!ro && list.length < MAX_MINI" type="button" class="sb-btn primary" @click="add">＋ Мини-модуль</button>
    </div>
    <div v-if="!list.length" class="sb-empty">Пока ни одного.</div>
    <div class="mm-grid">
      <div v-for="(m, i) in list" v-show="shown(m)" :key="keyOf(m)" class="mm-card sb-anim" :data-find="`MiniModules-${i}`">
        <div class="mm-ic">
          <button type="button" class="mm-pic" :disabled="ro" :title="ro ? '' : 'Сменить иконку'" @click="iconAt = iconAt === i ? -1 : i">
            <img v-if="m.ImageFile" :src="sheetImg(m.ImageFile)" alt="" /><span v-else>{{ m.Icon || '🔩' }}</span>
          </button>
          <div v-if="iconAt === i" class="mm-icpop" @pointerdown.stop>
            <button v-for="e in EMOJI" :key="e" type="button" :class="{ on: !m.ImageFile && m.Icon === e }" @click="setIcon(i, e)">{{ e }}</button>
            <input class="sb-input mm-emo" :value="m.ImageFile ? '' : m.Icon" maxlength="4" placeholder="свой" title="Свой значок (эмодзи)" @change="setIcon(i, $event.target.value.trim())" />
            <button type="button" class="sb-btn" @click="upload(i)">⬆ Картинка</button>
          </div>
        </div>
        <Fld :path="`MiniModules.${i}.Name`" placeholder="Название" class="mm-nm" />
        <Fld :path="`MiniModules.${i}.Effect`" type="rich" :rows="1" placeholder="Эффект" class="mm-eff" />
        <button v-if="!ro" type="button" class="sb-x" title="Удалить" @click="remove(i)">✕</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, inject, onBeforeUnmount, onMounted, ref } from 'vue'
import Fld from './Fld.vue'
import { sheet, edit, keyOf, listOps, pickImage, sheetImg } from '../sheetState.js'
import { MAX_MINI, miniLimitOf, platformOf } from '../../shared/forged.js'

const ro = inject('sheetReadOnly', ref(false))
const ops = listOps('MiniModules')
const list = computed(() => sheet.data.MiniModules || [])
const limit = computed(() => miniLimitOf(sheet.data))
const limitTitle = computed(() => {
  const p = platformOf(sheet.data)
  if (!p) return 'Сколько их можно — зависит от платформы (поле «Платформа» на главной).'
  return `${p.name}: +${p.mini} за уровень — к ${Math.max(1, sheet.data.Level || 1)} ур. это ${limit.value}; особые бонусы — сверх, всего до ${MAX_MINI}.`
})
const q = ref('')
const norm = s => String(s || '').replace(/<[^>]+>/g, ' ').toLowerCase().replace(/ё/g, 'е')
const shown = m => !q.value.trim() || norm(m.Name + ' ' + m.Effect).includes(norm(q.value.trim()))
const add = () => { q.value = ''; ops.add({ Id: 'mm' + Date.now().toString(36), Name: '', Effect: '', Icon: '🔩', ImageFile: '' }) }
function remove(i) {
  const m = list.value[i]
  if ((m.Name || m.Effect) && !confirm(`Удалить мини-модуль «${m.Name || 'без названия'}»?`)) return
  ops.remove(i)
}

// иконка: значок из набора, свой эмодзи или картинка
const EMOJI = ['🔩', '⚙', '🔋', '⚡', '🛡', '⚔', '🎯', '📡', '🔧', '💠', '🧲', '🔥', '❄', '💨', '👁', '🦾']
const iconAt = ref(-1)
function setIcon(i, e) {
  edit(`MiniModules.${i}.ImageFile`, '')
  edit(`MiniModules.${i}.Icon`, e, { now: true })
  iconAt.value = -1
}
async function upload(i) {
  iconAt.value = -1
  await pickImage(`MiniModules.${i}.ImageFile`, { title: 'Иконка мини-модуля', size: 256 })
}
const close = () => { iconAt.value = -1 }
onMounted(() => document.addEventListener('pointerdown', close))
onBeforeUnmount(() => document.removeEventListener('pointerdown', close))
</script>

<style scoped>
.mm { margin-top: 22px; }
.sb-h2 small { margin-left: 6px; color: var(--muted); }
.sb-h2 small.over { color: #ffb36b; }
.mm-hint { margin: -2px 0 8px; color: var(--muted); font: 600 12px 'Manrope', sans-serif; }
.mm-q { flex: 1 1 180px; }
.mm-grid { display: grid; gap: 8px; }
.mm-card { display: grid; grid-template-columns: 46px minmax(0, 200px) minmax(0, 1fr) 26px; gap: 8px; align-items: center; padding: 7px 9px; border-radius: 12px; background: rgba(0, 0, 0, .18); border: 1px solid var(--line); }
.mm-ic { position: relative; }
.mm-pic { display: grid; place-items: center; width: 44px; height: 44px; padding: 0; border-radius: 10px; border: 1px solid color-mix(in srgb, var(--acc) 40%, transparent); background: radial-gradient(circle, color-mix(in srgb, var(--acc) 16%, transparent), rgba(0, 0, 0, .3)); cursor: pointer; font-size: 22px; overflow: hidden; }
.mm-pic:disabled { cursor: default; }
.mm-pic img { width: 100%; height: 100%; object-fit: cover; }
.mm-icpop { position: absolute; z-index: 20; top: 50px; left: 0; display: grid; grid-template-columns: repeat(8, 30px); gap: 3px; padding: 8px; border-radius: 12px; background: var(--card, #17120c); border: 1px solid var(--line); box-shadow: 0 12px 28px rgba(0, 0, 0, .5); }
.mm-icpop > button:not(.sb-btn) { width: 30px; height: 30px; padding: 0; border-radius: 8px; border: 1px solid transparent; background: none; cursor: pointer; font-size: 17px; }
.mm-icpop > button.on, .mm-icpop > button:not(.sb-btn):hover { border-color: var(--acc); }
.mm-emo { grid-column: span 3; padding: 4px 6px; }
.mm-icpop .sb-btn { grid-column: span 5; }
.mm-nm :deep(input) { font-weight: 800; }
@media (max-width: 560px) {
  .mm-card { grid-template-columns: 46px minmax(0, 1fr) 26px; }
  .mm-eff { grid-column: 1 / -1; }
}
</style>
