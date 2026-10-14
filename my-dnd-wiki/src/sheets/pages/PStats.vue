<template>
  <!-- характеристики: шесть атрибутов, спасброски и 22 навыка; щелчок по бонусу — бросок d20 -->
  <div class="ps">
    <h2 class="sb-h sb-anim"><span class="ic">📊</span>Характеристики</h2>
    <div class="ps-top sb-anim">
      <Radar :axes="radar" :max="radarMax" :size="250" class="ps-radar" />
      <div class="ps-bm sb-card">
        <span>Мастерство</span>
        <Fld path="Mastery" center />
        <small>Владение навыком: ◆ +мастерство, ◆◆ +2×мастерство, ◆◆◆ ещё +уровень/4</small>
      </div>
    </div>

    <div class="ps-attrs">
      <section v-for="a in ATTRS" :key="a.key" class="ps-attr sb-anim" :data-find="`attr-${a.key}`">
        <header>
          <div class="ps-base">
            <b>{{ a.name }}</b>
            <Fld :path="`Stats.${a.key}Base`" type="num" center class="base" />
          </div>
          <div class="ps-mod" title="Модификатор">
            <small>мод.</small>
            <Bonus :value="attrMod(d.Stats[a.key + 'Base'])" :label="`${a.name} (проверка)`" />
          </div>
          <div class="ps-save" title="Спасбросок: точка — владение (+мастерство)">
            <small>спас.</small>
            <div class="ps-save-row">
              <IconRating :path="`Stats.${a.key}SaveProf`" :max="1" icon="diamond" title="Владение спасброском" />
              <Bonus :value="saveBonus(d, a.key)" :label="`Спасбросок: ${a.name}`" small />
            </div>
          </div>
        </header>
        <div v-for="s in skillsOf(a.key)" :key="s.key" class="ps-skill" :data-find="`skill-${s.key}`">
          <span class="nm">{{ s.name }}</span>
          <Fld :path="`Stats.${s.key}T`" type="num" center class="tr" title="Тренировка" />
          <IconRating :path="`Stats.${s.key}P`" :max="3" icon="diamond" :title="`Владение: ${s.name}`" />
          <Bonus :value="skillBonus(d, s)" :label="s.name" small />
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import Fld from '../ui/Fld.vue'
import Bonus from '../ui/Bonus.vue'
import IconRating from '../ui/IconRating.vue'
import Radar from '../ui/Radar.vue'
import { sheet } from '../sheetState.js'
import { ATTRS, SKILLS, attrMod, saveBonus, skillBonus } from '../../shared/sheet.js'

const d = computed(() => sheet.data)
const skillsOf = k => SKILLS.filter(s => s.attr === k)
const radar = computed(() => ATTRS.map(a => ({ label: a.short, value: d.value.Stats[a.key + 'Base'] })))
const radarMax = computed(() => Math.max(20, ...radar.value.map(x => Number(x.value) || 0)))
</script>

<style scoped>
.ps-top { display: grid; grid-template-columns: minmax(0, 1fr) 200px; gap: 14px; align-items: center; margin-bottom: 12px; }
.ps-radar { --rs: 270px; justify-self: center; }
.ps-bm { display: grid; gap: 4px; text-align: center; }
.ps-bm > span { font: 800 11px 'Manrope', sans-serif; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
.ps-bm :deep(input) { font-size: 28px; font-weight: 800; color: var(--acc); }
.ps-bm small { color: var(--muted); font-size: 11px; line-height: 1.4; }
.ps-attrs { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr)); gap: 12px; align-items: start; }
.ps-attr { padding: 10px 10px 8px; border-radius: 14px; background: color-mix(in srgb, var(--acc) 4%, rgba(0, 0, 0, .2)); border: 1px solid var(--line); }
.ps-attr header { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 10px; align-items: end; padding-bottom: 8px; margin-bottom: 4px; border-bottom: 1px solid var(--line); }
.ps-base b { display: block; font: 700 18px 'Cormorant Garamond', serif; color: color-mix(in srgb, var(--acc) 60%, #fff3d6); }
.ps-base .base :deep(input) { font-size: 24px; font-weight: 800; text-align: left; padding-left: 2px; }
.ps-mod, .ps-save { display: grid; justify-items: center; gap: 2px; }
.ps-mod small, .ps-save small { font: 800 9.5px 'Manrope', sans-serif; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }
.ps-save-row { display: flex; align-items: center; gap: 4px; }
.ps-skill { display: grid; grid-template-columns: minmax(0, 1fr) 44px auto auto; gap: 6px; align-items: center; padding: 3px 2px; border-radius: 8px; transition: background .15s; }
.ps-skill:hover { background: color-mix(in srgb, var(--acc) 6%, transparent); }
.ps-skill .nm { font: 600 13px 'Manrope', sans-serif; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ps-skill .tr :deep(input) { padding: 2px; font-size: 13px; color: var(--muted); }
.ps-skill :deep(.ir) { --ir: 20px; }
@media (max-width: 560px) { .ps-top { grid-template-columns: minmax(0, 1fr); } }
</style>
