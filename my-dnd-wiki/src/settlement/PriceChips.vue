<template>
  <span class="price">
    <span v-for="(v, k) in price" :key="k" class="pc" :class="{ short: stock && (stock[k] || 0) < v }"
          :title="stock ? `${RES[k]?.label}: нужно ${v}, на складе ${Math.floor(stock[k] || 0)}` : RES[k]?.label">
      <i :style="{ background: RES[k]?.color }" />{{ short ? SHORT[k] || RES[k]?.label : RES[k]?.label }} {{ v }}
    </span>
    <span v-if="!price || !Object.keys(price).length" class="pc free">бесплатно</span>
  </span>
</template>

<script setup>
import { RES } from '../shared/settlement.js'

// short — компактно: короткие названия (полное — в подсказке)
defineProps({ price: Object, stock: Object, short: Boolean })
const SHORT = { wood: 'дерево', stone: 'камень', build: 'стройм.', clay: 'глина', straw: 'солома', iron: 'железо', parts: 'детали', goods: 'товары', herbs: 'травы', fiber: 'волокно' }
</script>

<style scoped>
.price { display: inline-flex; flex-wrap: wrap; gap: 3px; }
.pc { display: inline-flex; align-items: center; gap: 3px; padding: 0 6px; border-radius: 99px; background: rgba(255, 255, 255, .06); color: #d9cdb0; font: 700 10.5px/17px var(--a-sans); white-space: nowrap; }
.pc i { width: 7px; height: 7px; border-radius: 50%; }
.pc.short { background: rgba(255, 107, 94, .16); color: #ff9b8f; }
.pc.free { color: var(--a-muted); }
</style>
