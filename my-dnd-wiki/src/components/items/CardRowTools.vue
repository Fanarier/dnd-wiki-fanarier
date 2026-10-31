<template>
  <!-- кнопки строки карточки: отметка цветом (выбор из шести), примечание, удалить -->
  <span class="crt">
    <span class="crt-mk">
      <button type="button" class="crt-b dot" :class="mark && 'm-' + mark" :title="`Отметка: ${markOf(mark).name}`" @click="emit('pick')"><i /></button>
      <span v-if="picking" class="crt-pick">
        <button v-for="m in MARKS" :key="m.k" type="button" class="crt-sw" :class="[m.k && 'm-' + m.k, { on: m.k === mark }]" :title="m.name" @click="emit('mark', m.k)"><i /></button>
      </span>
    </span>
    <button type="button" class="crt-b" :class="{ on: hasNote || noteOpen }" :title="hasNote ? 'Примечание' : 'Добавить примечание'" @click="emit('note')">✎</button>
    <button type="button" class="crt-b del" title="Удалить пункт" @click="emit('del')">✕</button>
  </span>
</template>

<script setup>
import { MARKS, markOf } from '../../shared/items.js'
defineProps({ mark: { type: String, default: '' }, hasNote: Boolean, noteOpen: Boolean, picking: Boolean })
const emit = defineEmits(['pick', 'mark', 'note', 'del'])
</script>

<style scoped>
.crt { display: flex; gap: 3px; align-items: center; padding-top: 4px; }
.crt-mk { position: relative; display: flex; }
.crt-b { display: grid; place-items: center; width: 26px; height: 26px; padding: 0; border-radius: 8px; border: 1px solid rgba(201, 162, 79, .2); background: rgba(0, 0, 0, .25); color: #a8936c; font: 700 12px 'Manrope', sans-serif; cursor: pointer; }
.crt-b:hover { color: #f3e6c8; border-color: rgba(201, 162, 79, .5); }
.crt-b.on { color: #f3d58a; border-color: rgba(231, 197, 111, .55); background: rgba(231, 197, 111, .12); }
.crt-b.del:hover { color: #ff9d8a; border-color: rgba(224, 96, 80, .5); }
.dot i, .crt-sw i { display: block; width: 11px; height: 11px; border-radius: 50%; border: 1.5px dashed rgba(201, 162, 79, .55); }
.dot[class*='m-'] i, .crt-sw[class*='m-'] i { border: none; background: var(--mc); box-shadow: 0 0 6px color-mix(in srgb, var(--mc) 60%, transparent); }
.m-gone i { background: linear-gradient(135deg, transparent 44%, #fff 44%, #fff 56%, transparent 56%), var(--mc) !important; }
.m-green { --mc: #5cc77a; } .m-yellow { --mc: #f0c040; } .m-red { --mc: #e8574a; } .m-blue { --mc: #5b9cf0; } .m-gone { --mc: #cc3a2e; }
.crt-pick { position: absolute; z-index: 5; right: 0; top: calc(100% + 4px); display: flex; gap: 4px; padding: 5px; border-radius: 10px; background: #1e1710; border: 1px solid rgba(201, 162, 79, .4); box-shadow: 0 8px 20px rgba(0, 0, 0, .5); }
.crt-sw { display: grid; place-items: center; width: 24px; height: 24px; padding: 0; border-radius: 7px; border: 1px solid transparent; background: rgba(0, 0, 0, .3); cursor: pointer; }
.crt-sw.on, .crt-sw:hover { border-color: rgba(231, 197, 111, .7); }
</style>
