<template>
  <!-- «Вид книги»: переплёт, цвет, размер, потёртость, знак, украшения и описание. Слева — как книга встанет на полку -->
  <div class="ble-back" @pointerdown.self="$emit('close')">
    <section class="ble" role="dialog" aria-label="Вид книги">
      <header>
        <h2>Вид книги</h2>
        <small>{{ sheet.name }}</small>
        <button type="button" class="ble-x" aria-label="Закрыть" @click="$emit('close')">✕</button>
      </header>

      <div class="ble-grid">
        <div class="ble-stage">
          <div class="ble-shelf"><BookSpine :look="look" :name="sheet.name" :level="sheet.level" /></div>
          <div class="ble-board" />
        </div>

        <div class="ble-form">
          <fieldset>
            <legend>Переплёт</legend>
            <div class="ble-chips"><button v-for="m in MATERIALS" :key="m.k" type="button" :class="{ on: look.m === m.k }" @click="look.m = m.k">{{ m.t }}</button></div>
            <div class="ble-swatches">
              <button v-for="c in COVER_COLORS" :key="c" type="button" :class="{ on: look.c === c }" :style="{ background: c }" :aria-label="'Цвет ' + c" @click="look.c = c" />
              <label class="ble-pick" title="Свой цвет"><input v-model="look.c" type="color" /></label>
            </div>
          </fieldset>

          <fieldset class="ble-two">
            <label>Высота<input v-model.number="look.h" type="range" min="0" max="1" step="0.05" /></label>
            <label>Толщина<input v-model.number="look.w" type="range" min="0" max="1" step="0.05" /></label>
            <label>Потёртость<input v-model.number="look.wear" type="range" min="0" max="3" step="1" /></label>
            <label>Рубцы на корешке<input v-model.number="look.bands" type="range" min="0" max="5" step="1" /></label>
          </fieldset>

          <fieldset>
            <legend>Название</legend>
            <div class="ble-chips"><button v-for="t in TITLES" :key="t.k" type="button" :class="{ on: look.title === t.k }" @click="look.title = t.k">{{ t.t }}</button></div>
            <div class="ble-swatches">
              <button v-for="c in FOIL_COLORS" :key="c" type="button" :class="{ on: look.f === c }" :style="{ background: c }" :aria-label="'Цвет тиснения ' + c" @click="look.f = c" />
              <label class="ble-pick" title="Свой цвет"><input v-model="look.f" type="color" /></label>
            </div>
          </fieldset>

          <fieldset>
            <legend>Знак</legend>
            <div class="ble-emblems">
              <button v-for="e in EMBLEMS" :key="e.k" type="button" :class="{ on: look.em === e.k }" :title="e.t" :aria-label="e.t" @click="look.em = e.k">
                <svg v-if="e.k" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path :d="EMBLEM_PATHS[e.k]" fill-rule="evenodd" :fill="EMBLEM_FILL[e.k] ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" /></svg>
                <span v-else>нет</span>
              </button>
            </div>
          </fieldset>

          <fieldset>
            <legend>Украшения</legend>
            <div class="ble-chips wrap"><button v-for="d in DECOS" :key="d.k" type="button" :class="{ on: look.deco.includes(d.k) }" @click="toggle(d.k)">{{ d.t }}</button></div>
            <div class="ble-two tight">
              <label v-if="look.deco.includes('ribbon') || look.deco.includes('gem')">Ляссе и камень<input v-model="look.rib" type="color" /></label>
              <label>Свечение
                <span class="ble-glow"><input type="checkbox" :checked="!!look.glow" @change="look.glow = $event.target.checked ? '#4fd8ff' : ''" /><input v-if="look.glow" v-model="look.glow" type="color" /></span>
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend>Описание</legend>
            <textarea v-model="look.desc" rows="5" maxlength="1500" placeholder="Какая эта книга на вид и на ощупь. Текст видят все, кто наведёт на неё на стеллаже." />
          </fieldset>
        </div>
      </div>

      <footer>
        <button type="button" class="ble-btn" :disabled="busy" @click="reset">Вернуть обычный вид</button>
        <span class="grow" />
        <button type="button" class="ble-btn" @click="$emit('close')">Отмена</button>
        <button type="button" class="ble-btn primary" :disabled="busy" @click="save">Сохранить вид</button>
      </footer>
    </section>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import BookSpine from './BookSpine.vue'
import { EMBLEM_PATHS, EMBLEM_FILL } from './emblems.js'
import { MATERIALS, TITLES, EMBLEMS, DECOS, COVER_COLORS, FOIL_COLORS, lookOf, cleanLook } from '../../shared/bookLook.js'
import { saveLook, loadSheets } from '../sheetState.js'
import { toast } from '../../map/store.js'

const props = defineProps({ sheet: { type: Object, required: true } })
const emit = defineEmits(['close'])
const look = reactive(lookOf(props.sheet))
const busy = ref(false)
const toggle = k => { const i = look.deco.indexOf(k); if (i < 0) { if (look.deco.length < 8) look.deco.push(k); else toast('Не больше восьми украшений', 'error') } else look.deco.splice(i, 1) }
async function send(value, done) {
  busy.value = true
  try { await saveLook(props.sheet.id, value); toast(done); loadSheets(); emit('close') } catch (e) { toast(e.message, 'error') } finally { busy.value = false }
}
const save = () => send(cleanLook(look), 'Вид книги сохранён')
const reset = () => send(null, 'Книге вернули обычный вид')
const onKey = e => { if (e.key === 'Escape') emit('close') }
onMounted(() => addEventListener('keydown', onKey))
onBeforeUnmount(() => removeEventListener('keydown', onKey))
</script>

<style scoped>
.ble-back { position: fixed; inset: 0; z-index: 70; display: grid; place-items: center; padding: 12px; background: rgba(8, 6, 4, .78); backdrop-filter: blur(3px); }
.ble { display: grid; grid-template-rows: auto minmax(0, 1fr) auto; width: min(880px, 100%); max-height: min(760px, calc(100vh - 24px)); border-radius: 14px; border: 1px solid #6e4f22; background: linear-gradient(165deg, #2a2016, #17110b); color: #efe3c8; box-shadow: 0 0 0 3px #120c07, 0 30px 70px rgba(0, 0, 0, .7); font-family: 'Manrope', sans-serif; }
.ble header { display: flex; align-items: baseline; gap: 10px; padding: 14px 16px 10px; border-bottom: 1px solid rgba(231, 197, 111, .16); }
.ble h2 { margin: 0; font: 700 26px/1 'Cormorant Garamond', serif; color: #f3dc9e; }
.ble header small { flex: 1; min-width: 0; color: #a8936c; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ble-x { width: 30px; height: 30px; border-radius: 8px; border: 1px solid rgba(231, 197, 111, .3); background: none; color: #f3d99a; cursor: pointer; }
.ble-grid { display: grid; grid-template-columns: 210px minmax(0, 1fr); min-height: 0; }
.ble-stage { display: grid; grid-template-rows: minmax(0, 1fr) auto; background: linear-gradient(180deg, #0c1417, #16242a); border-right: 1px solid rgba(231, 197, 111, .16); }
.ble-shelf { display: flex; align-items: flex-end; justify-content: center; padding: 40px 10px 0; min-height: 300px; filter: drop-shadow(3px 4px 5px rgba(0, 0, 0, .6)); }
.ble-shelf :deep(svg) { transform: scale(1.3); transform-origin: 50% 100%; }
.ble-board { height: 18px; background: linear-gradient(180deg, #8a5f36, #6b4526 14%, #3b2415 48%, #24150b); box-shadow: inset 0 1px 0 rgba(255, 225, 180, .35); }
.ble-form { display: grid; align-content: start; gap: 12px; padding: 14px 16px; overflow: auto; }
fieldset { display: grid; gap: 8px; margin: 0; padding: 0; border: 0; min-width: 0; }
legend { padding: 0; margin-bottom: 6px; font: 700 13px 'Manrope', sans-serif; color: #d9c9a6; }
.ble-chips { display: flex; flex-wrap: wrap; gap: 5px; }
.ble-chips button, .ble-emblems button { padding: 5px 10px; border-radius: 8px; border: 1px solid rgba(231, 197, 111, .25); background: rgba(0, 0, 0, .25); color: #c8b285; font: 700 12.5px 'Manrope', sans-serif; cursor: pointer; }
.ble-chips button.on, .ble-emblems button.on { border-color: #e7c56f; background: rgba(231, 197, 111, .16); color: #f3dc9e; }
.ble-swatches { display: flex; flex-wrap: wrap; gap: 5px; align-items: center; }
.ble-swatches button { width: 24px; height: 24px; border-radius: 6px; border: 1px solid rgba(255, 255, 255, .22); cursor: pointer; }
.ble-swatches button.on { outline: 2px solid #f3dc9e; outline-offset: 1px; }
.ble-pick input, .ble-two input[type=color], .ble-glow input[type=color] { width: 30px; height: 26px; padding: 0; border: 1px solid rgba(231, 197, 111, .3); border-radius: 6px; background: none; cursor: pointer; }
.ble-two { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 14px; }
div.ble-two { display: grid; }
.ble-two.tight { margin-top: 2px; }
.ble-two label { display: grid; gap: 3px; font: 600 12.5px 'Manrope', sans-serif; color: #c8b285; min-width: 0; }
.ble-two input[type=range] { width: 100%; accent-color: #d9b25c; }
.ble-glow { display: flex; align-items: center; gap: 8px; }
.ble-glow input[type=checkbox] { width: 16px; height: 16px; accent-color: #d9b25c; }
.ble-emblems { display: grid; grid-template-columns: repeat(auto-fill, minmax(38px, 1fr)); gap: 5px; }
.ble-emblems button { display: grid; place-items: center; height: 34px; padding: 0; font-size: 10.5px; }
textarea { width: 100%; box-sizing: border-box; padding: 8px 10px; border-radius: 10px; border: 1px solid rgba(231, 197, 111, .25); background: rgba(0, 0, 0, .3); color: #efe3c8; font: 500 15px/1.4 'Cormorant Garamond', serif; resize: vertical; }
.ble footer { display: flex; flex-wrap: wrap; gap: 8px; padding: 10px 16px 14px; border-top: 1px solid rgba(231, 197, 111, .16); }
.grow { flex: 1; }
.ble-btn { padding: 8px 14px; border-radius: 10px; border: 1px solid rgba(231, 197, 111, .4); background: rgba(231, 197, 111, .08); color: #f3d99a; font: 700 13px 'Manrope', sans-serif; cursor: pointer; }
.ble-btn.primary { background: linear-gradient(180deg, #f0cf83, #c99a45); color: #1b140c; border-color: #e6c27a; }
.ble-btn:disabled { opacity: .5; cursor: default; }
@media (max-width: 640px) {
  .ble-grid { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr); }
  .ble-stage { border-right: 0; border-bottom: 1px solid rgba(231, 197, 111, .16); }
  .ble-shelf { min-height: 230px; padding-top: 20px; }
  .ble-shelf :deep(svg) { transform: none; }
}
</style>
