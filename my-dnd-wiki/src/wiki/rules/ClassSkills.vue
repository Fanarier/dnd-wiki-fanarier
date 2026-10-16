<template>
  <!-- навыки класса или архетипа лентой по уровням; «Выбор архетипа» и подобные строки — вехи -->
  <div class="cs">
    <section v-for="g in byLevel" :key="g.lv" class="cs-lv">
      <b class="cs-n">{{ g.lv }}</b>
      <div class="cs-items">
        <template v-for="(s, i) in g.items" :key="i">
          <span v-if="!s.html && !s.kind" class="cs-mile">◆ {{ s.name }}</span>
          <article v-else class="cs-card" :class="kindCls(s.kind)" :style="{ '--i': i }">
            <header>
              <h3>{{ s.name }}</h3>
              <span v-if="s.kind" class="cs-kind">{{ s.kind }}</span>
            </header>
            <div v-if="s.tags?.length" class="cs-tags"><i v-for="t in s.tags" :key="t">{{ t }}</i></div>
            <RulesHtml :html="s.html" />
          </article>
        </template>
      </div>
    </section>
    <div v-if="!skills.length" class="cs-empty">Навыков пока нет.</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import RulesHtml from './RulesHtml.vue'

const props = defineProps({ skills: { type: Array, default: () => [] } })
const byLevel = computed(() => {
  const m = new Map()
  for (const s of props.skills) { if (!m.has(s.lv)) m.set(s.lv, []); m.get(s.lv).push(s) }
  return [...m].sort((a, b) => a[0] - b[0]).map(([lv, items]) => ({ lv, items }))
})
const kindCls = k => (/пассив/i.test(k) ? 'passive' : /ульт/i.test(k) ? 'ult' : /актив/i.test(k) ? 'active' : '')
</script>

<style scoped>
.cs { display: grid; gap: 14px; }
.cs-lv { display: grid; grid-template-columns: 40px minmax(0, 1fr); gap: 12px; align-items: start; }
.cs-n { position: sticky; top: 80px; display: grid; place-items: center; width: 38px; height: 38px; border-radius: 50%; background: linear-gradient(180deg, #f0d083, #b8893f); color: #1b1408; font: 900 15px 'Manrope', sans-serif; box-shadow: 0 0 14px rgba(231, 197, 111, .3); }
.cs-items { display: grid; gap: 8px; min-width: 0; }
.cs-mile { justify-self: start; padding: 4px 12px; border-radius: 99px; border: 1px dashed rgba(231, 197, 111, .4); color: #e7c56f; font: 800 12px 'Manrope', sans-serif; }
.cs-card { padding: 12px 14px; border-radius: 14px; background: rgba(20, 16, 11, .75); border: 1px solid rgba(231, 197, 111, .16); border-left: 3px solid var(--kc, rgba(231, 197, 111, .4)); animation: cs-up .35s ease backwards; animation-delay: calc(var(--i, 0) * 40ms); }
@keyframes cs-up { from { opacity: 0; transform: translateY(6px); } }
.cs-card.passive { --kc: #6fc3d1; }
.cs-card.active { --kc: #e7c56f; }
.cs-card.ult { --kc: #c27bff; box-shadow: 0 0 22px rgba(194, 123, 255, .12); }
.cs-card header { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.cs-card h3 { margin: 0; font: 700 19px 'Cormorant Garamond', serif; color: #f3dc9e; }
.cs-kind { padding: 1px 9px; border-radius: 99px; background: color-mix(in srgb, var(--kc, #e7c56f) 18%, transparent); color: var(--kc, #e7c56f); font: 800 10.5px 'Manrope', sans-serif; text-transform: uppercase; letter-spacing: .05em; }
.cs-tags { display: flex; flex-wrap: wrap; gap: 4px; margin: 6px 0; }
.cs-tags i { padding: 1px 8px; border-radius: 6px; background: rgba(255, 255, 255, .05); color: #cdbf9f; font: 700 11px 'Manrope', sans-serif; font-style: normal; }
.cs-card :deep(.rh) { font-size: 13.5px; }
.cs-empty { color: #a8936c; }
@media (max-width: 600px) { .cs-lv { grid-template-columns: 30px minmax(0, 1fr); gap: 8px; } .cs-n { width: 30px; height: 30px; font-size: 13px; } }
</style>
