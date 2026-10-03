<template>
  <div class="pips" :class="{ editable }" :style="{ '--pc': color, '--ps': size + 'px' }" role="meter" :aria-valuenow="value" :aria-valuemax="max">
    <component :is="editable ? 'button' : 'i'" v-for="i in max" :key="i" class="pip" :class="{ f: i <= value }"
               :style="{ '--i': i - 1 }" :type="editable ? 'button' : undefined"
               :title="editable ? `${i <= value && i === value ? i - 1 : i} из ${max}` : undefined"
               @click="editable && $emit('update', i === value ? i - 1 : i)" />
  </div>
</template>

<script setup>
// Шестигранные ячейки: болезнь, расходы, отношения. Клик по последней заполненной — снять её.
defineProps({
  value: { type: Number, default: 0 },
  max: { type: Number, default: 5 },
  color: { type: String, default: '#f3ead2' },
  size: { type: Number, default: 15 },
  editable: { type: Boolean, default: false }
})
defineEmits(['update'])
</script>

<style scoped>
.pips { display: flex; gap: 3px; flex-wrap: wrap; }
.pip { display: block; width: var(--ps); height: calc(var(--ps) * 1.13); padding: 0; border: 0; clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%); background: rgba(255, 255, 255, .11); flex: none; }
.pip.f { background: var(--pc); animation: pop .45s calc(var(--i) * 80ms + .35s) cubic-bezier(.3, 1.8, .5, 1) both; }
.editable .pip { cursor: pointer; transition: transform .12s, filter .12s; }
.editable .pip:hover { transform: scale(1.18); filter: brightness(1.3); }
@keyframes pop { from { transform: scale(0); } }
@media (prefers-reduced-motion: reduce) { .pip.f { animation: none; } }
</style>
