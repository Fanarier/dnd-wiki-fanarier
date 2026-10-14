<template>
  <div class="pd">
    <h2 class="sb-h sb-anim"><span class="ic">📜</span>Предыстория</h2>
    <div class="sb-grid3 sb-anim">
      <Fld path="Race" label="Раса" data-find="Race" />
      <Fld path="Worldview" label="Мировоззрение" data-find="Worldview" />
      <Fld path="Age" type="num" label="Возраст" data-find="Age" />
      <Fld path="HeightWeight" label="Рост / вес" data-find="HeightWeight" />
      <Fld path="BodySize" label="Размер тела" data-find="BodySize" />
    </div>

    <h3 class="sb-h2 sb-anim">Прогресс</h3>
    <div class="pd-prog sb-card sb-anim" data-find="Level">
      <Fld path="Level" type="num" label="Уровень" center class="lv" />
      <Fld path="Experience" type="num" label="Опыт" center />
      <Fld path="Awakening" label="Пробуждение" center data-find="Awakening" />
    </div>

    <h3 class="sb-h2 sb-anim">Состояния</h3>
    <div class="sb-grid2 sb-anim">
      <Fld path="Buff" type="area" :rows="2" label="✨ Бафф" data-find="Buff" class="buff" />
      <Fld path="Debuff" type="area" :rows="2" label="☠ Дебафф" data-find="Debuff" class="debuff" />
    </div>

    <h3 class="sb-h2 sb-anim">Стартовые бонусы</h3>
    <div class="sb-grid3 sb-anim">
      <Fld v-for="i in 3" :key="i" :path="`StartBonus${i}`" :label="`Бонус ${i}`" :data-find="`StartBonus${i}`" />
    </div>

    <h3 class="sb-h2 sb-anim">Внешность</h3>
    <Fld path="Appearance" type="area" :rows="3" placeholder="Как выглядит персонаж…" class="sb-anim" data-find="Appearance" />

    <h3 class="sb-h2 sb-anim">История персонажа</h3>
    <Fld path="Backstory" type="area" :rows="8" placeholder="Откуда он, что с ним было…" class="sb-anim story" data-find="Backstory" />
  </div>
</template>

<script setup>
import Fld from '../ui/Fld.vue'
</script>

<style scoped>
.pd { display: grid; gap: 6px; }
.pd-prog { display: grid; grid-template-columns: 110px minmax(0, 1fr) minmax(0, 1fr); gap: 10px; }
.pd-prog :deep(input) { font-size: 20px; font-weight: 800; }
.lv :deep(input) { color: var(--acc); }
.buff :deep(textarea) { border-color: rgba(126, 224, 106, .35); }
.debuff :deep(textarea) { border-color: rgba(255, 122, 107, .35); }
.story :deep(textarea) { font-family: 'Cormorant Garamond', serif; font-size: 17px; line-height: 1.55; }
@media (max-width: 560px) { .pd-prog { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } }
</style>
