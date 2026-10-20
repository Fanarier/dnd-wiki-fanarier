<template>
  <!-- одна запись журнала деятельностей: что делал, часы, выносливость, результат, статус; мастер проверяет -->
  <article class="ar" :class="['st-' + rec.status, { cut: rec.status === 'cancel' }]" :style="{ '--sc': ST.color }">
    <span class="ar-type" :title="TYPE?.name || 'Тип не указан'">{{ TYPE?.icon || '·' }}</span>
    <div class="ar-main">
      <b class="ar-name">{{ rec.name }}</b>
      <p v-if="rec.result" class="ar-res">{{ rec.result }}</p>
      <div class="ar-meta">
        <span v-if="showDate" class="ar-tag">{{ rec.date.split('-').reverse().join('.') }}</span>
        <span v-if="rec.trainId" class="ar-tag train" :class="{ ok: rec.applied }" :title="rec.applied ? 'Очки уже в прогрессе тренировки' : 'Очки прибавятся, когда мастер учтёт запись'">
          🏋 {{ trainName || 'тренировка' }} <b>+{{ rec.pts }}</b>{{ rec.applied ? ' ✓' : '' }}
        </span>
        <span v-if="rec.by && rec.at" class="ar-by">{{ rec.by }}</span>
      </div>
    </div>
    <span class="ar-num" title="Часы">{{ rec.hours || '—' }}<small v-if="rec.hours && /^[\d.,]+$/.test(rec.hours)"> ч</small></span>
    <span class="ar-num st" title="Выносливость">{{ rec.stamina || '—' }}</span>
    <div class="ar-st">
      <select v-if="master" :value="rec.status" class="ar-sel" title="Статус" @change="$emit('status', $event.target.value)">
        <option v-for="(s, k) in ACT_STATUS" :key="k" :value="k">{{ s.name }}</option>
      </select>
      <span v-else class="ar-badge">{{ ST.name }}</span>
      <span v-if="master && rec.status === 'pending'" class="ar-quick">
        <button type="button" class="ok" title="Учесть" @click="$emit('status', 'done')">✓</button>
        <button type="button" class="no" title="Провал" @click="$emit('status', 'fail')">✗</button>
      </span>
    </div>
    <div class="ar-acts">
      <button v-if="hero?.canWrite" type="button" title="Ещё раз — такой же записью" @click="$emit('repeat')">⧉</button>
      <template v-if="master || (hero?.canWrite && rec.status === 'pending')">
        <button type="button" title="Править" @click="$emit('edit')">✎</button>
        <button type="button" class="del" title="Удалить" @click="$emit('remove')">✕</button>
      </template>
    </div>
  </article>
</template>

<script setup>
import { computed } from 'vue'
import { ACT_STATUS, ACT_TYPES } from '../../shared/activities.js'

const props = defineProps({ rec: { type: Object, required: true }, hero: { type: Object, default: null }, master: Boolean, showDate: Boolean })
defineEmits(['status', 'edit', 'remove', 'repeat'])
const ST = computed(() => ACT_STATUS[props.rec.status] || ACT_STATUS.pending)
const TYPE = computed(() => ACT_TYPES[props.rec.type])
const trainName = computed(() => props.hero?.trainings?.find(t => t.Id === props.rec.trainId)?.Name || '')
</script>

<style scoped>
.ar { display: grid; grid-template-columns: 22px minmax(0, 1fr) 70px 60px 128px 74px; align-items: center; gap: 8px; padding: 7px 6px; border-radius: 10px; border-left: 3px solid var(--sc); background: rgba(255, 255, 255, .015); transition: background .15s; }
.ar:hover { background: rgba(231, 197, 111, .05); }
.ar-type { color: #a8936c; font: 800 14px 'Manrope', sans-serif; text-align: center; }
.ar-main { min-width: 0; }
.ar-name { display: block; color: #efe3c8; font: 700 13.5px/1.35 'Manrope', sans-serif; overflow-wrap: anywhere; }
.ar.cut .ar-name { text-decoration: line-through; color: #8f8574; }
.ar-res { margin: 2px 0 0; color: #cdbf9f; font: 500 12.5px/1.4 'Manrope', sans-serif; white-space: pre-line; overflow-wrap: anywhere; }
.ar-meta { display: flex; flex-wrap: wrap; gap: 4px 8px; margin-top: 3px; }
.ar-meta:empty { display: none; }
.ar-tag { padding: 1px 7px; border-radius: 99px; background: rgba(255, 255, 255, .05); color: #cdbf9f; font: 700 11px 'Manrope', sans-serif; }
.ar-tag.train { background: rgba(126, 208, 122, .1); color: #b5ecb2; }
.ar-tag.train.ok { background: rgba(126, 208, 122, .2); }
.ar-by { color: #7d7160; font: 600 11px 'Manrope', sans-serif; }
.ar-num { color: #e6dcc4; font: 800 13px 'Manrope', sans-serif; text-align: right; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ar-num small { color: #a8936c; font-weight: 600; }
.ar-num.st { color: #f6cf86; }
.ar-st { display: flex; align-items: center; gap: 4px; justify-content: flex-end; }
.ar-badge { padding: 2px 9px; border-radius: 99px; background: color-mix(in srgb, var(--sc) 16%, transparent); color: var(--sc); font: 800 11.5px 'Manrope', sans-serif; white-space: nowrap; }
.ar-sel { max-width: 100%; padding: 3px 4px; border-radius: 8px; border: 1px solid color-mix(in srgb, var(--sc) 55%, transparent); background: color-mix(in srgb, var(--sc) 12%, #120d08); color: var(--sc); font: 800 11.5px 'Manrope', sans-serif; color-scheme: dark; }
.ar-quick { display: flex; gap: 2px; }
.ar-quick button, .ar-acts button { width: 24px; height: 24px; border-radius: 7px; border: 1px solid rgba(231, 197, 111, .22); background: none; color: #cdbf9f; font: 800 12px 'Manrope', sans-serif; cursor: pointer; }
.ar-quick .ok { border-color: rgba(126, 208, 122, .5); color: #7ed07a; }
.ar-quick .no { border-color: rgba(255, 122, 107, .45); color: #ff7a6b; }
.ar-acts { display: flex; gap: 2px; justify-content: flex-end; }
.ar-acts button:hover { border-color: #e7c56f; color: #f3dc9e; }
.ar-acts .del:hover { border-color: #ff7a6b; color: #ff7a6b; }
@media (max-width: 760px) {
  .ar { grid-template-columns: 18px minmax(0, 1fr) auto auto; grid-template-areas: 't m m m' '. h s st' '. a a a'; row-gap: 4px; }
  .ar-type { grid-area: t; }
  .ar-main { grid-area: m; }
  .ar-num { grid-area: h; text-align: left; }
  .ar-num.st { grid-area: s; }
  .ar-st { grid-area: st; }
  .ar-acts { grid-area: a; justify-content: flex-start; }
  .ar-acts:empty { display: none; }
}
</style>
