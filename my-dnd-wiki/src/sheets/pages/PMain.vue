<template>
  <!-- главная: портрет, имя, класс, хиты и всё, что нужно в бою под рукой -->
  <div class="pm">
    <div class="pm-head sb-anim">
      <div class="pm-photo" :class="{ empty: !d.PhotoFile }" data-find="photo">
        <img v-if="d.PhotoFile" :src="sheetImg(d.PhotoFile)" alt="Портрет" @click="viewOpen = true" />
        <button v-else type="button" class="pm-add" :disabled="ro" @click="setPhoto">＋<small>портрет</small></button>
        <div v-if="!ro" class="pm-photo-acts">
          <button type="button" title="Загрузить портрет" @click="setPhoto">📷</button>
          <button v-if="d.PhotoFile" type="button" title="Убрать портрет" @click="edit('PhotoFile', '', { now: true })">✕</button>
        </div>
      </div>
      <div class="pm-id">
        <Fld path="CharacterName" big placeholder="Имя персонажа" data-find="CharacterName" />
        <div class="pm-cls">
          <Fld path="Class" label="Класс" data-find="Class" />
          <Fld path="Subclass" label="Подкласс" data-find="Subclass" />
        </div>
        <div class="pm-lvl">
          <span class="pm-badge" title="Уровень (меняется в «Предыстории»)"><Num :value="d.Level" /><small>ур.</small></span>
          <span v-if="d.Race" class="pm-race">{{ d.Race }}</span>
        </div>
      </div>
    </div>

    <!-- хиты из трекера: полоса, щелчок — к «Ресурсам» -->
    <button type="button" class="pm-hp sb-anim" title="Хиты: открыть трекер на странице «Ресурсы»" @click="$emit('go', 'res')">
      <span class="pm-hp-bar"><i :style="{ width: hpPct + '%' }" :class="hpTone" /><i v-if="d.HpData.Temp" class="tmp" :style="{ width: tmpPct + '%' }" /></span>
      <span class="pm-hp-txt">❤ <b><Num :value="d.HpData.Current" /></b> / {{ maxHp }}<em v-if="d.HpData.Temp"> +{{ d.HpData.Temp }}</em></span>
    </button>

    <div class="pm-pools sb-anim">
      <Fld path="Mana" label="Мана" center data-find="Mana" class="pool mana" />
      <Fld path="Stamina" label="Выносливость" center data-find="Stamina" class="pool sta" />
      <Fld path="Hits" label="Хиты" center data-find="Hits" class="pool hp" />
    </div>

    <h3 class="sb-h2 sb-anim">Основные характеристики</h3>
    <div class="pm-stats sb-anim">
      <div v-for="f in MAIN" :key="f.p" class="pm-stat" :data-find="f.p">
        <span class="pm-ic">{{ f.ic }}</span>
        <Fld :path="f.p" :type="f.num ? 'num' : 'text'" :label="f.l" center />
      </div>
      <div class="pm-stat ini" data-find="Initiative">
        <span class="pm-ic">⚡</span>
        <Fld path="Initiative" type="num" label="Инициатива" center />
        <Bonus small :value="d.Initiative" label="Инициатива" title="Бросить инициативу" />
      </div>
    </div>

    <h3 class="sb-h2 sb-anim">Состояние и восприятие</h3>
    <div class="pm-rates sb-anim">
      <div v-for="r in RATES" :key="r.p" class="pm-rate" :data-find="r.p">
        <span>{{ r.l }}</span>
        <IconRating :path="r.p" :max="r.max" :icon="r.icon" :title="r.l" />
      </div>
    </div>

    <h3 class="sb-h2 sb-anim">🔺 Треугольник развития</h3>
    <div class="pm-tri sb-anim" data-find="BodyDev">
      <Radar :axes="tri" :max="8" :size="220" class="pm-radar" />
      <div class="pm-tri-f">
        <Fld path="BodyDev" type="num" label="⚔ Тело" suffix="/8" center />
        <Fld path="MindDev" type="num" label="📖 Разум" suffix="/8" center />
        <Fld path="SpiritDev" type="num" label="✨ Дух" suffix="/8" center />
      </div>
    </div>

    <h3 class="sb-h2 sb-anim">Свои поля</h3>
    <div class="pm-custom sb-anim">
      <div v-for="i in 4" :key="i" class="pm-cf" :data-find="`CustomField${i}Value`">
        <Fld :path="`CustomField${i}Label`" placeholder="Название" class="lbl" />
        <Fld :path="`CustomField${i}Value`" placeholder="Значение" />
      </div>
    </div>

    <Teleport to="body">
      <div v-if="viewOpen" class="pm-view" @click="viewOpen = false"><img :src="sheetImg(d.PhotoFile)" alt="Портрет" /></div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, inject, ref } from 'vue'
import Fld from '../ui/Fld.vue'
import Num from '../ui/Num.vue'
import Bonus from '../ui/Bonus.vue'
import IconRating from '../ui/IconRating.vue'
import Radar from '../ui/Radar.vue'
import { sheet, sheetImg, pickImage, edit } from '../sheetState.js'
import { toast } from '../../map/store.js'
import { hpMax } from '../../shared/sheet.js'

defineEmits(['go'])
const d = computed(() => sheet.data)
const ro = inject('sheetReadOnly', ref(false))
const viewOpen = ref(false)
const MAIN = [
  { p: 'Defense', l: 'Броня', ic: '🛡', num: true },
  { p: 'Evasion', l: 'Уклонение', ic: '💨', num: true },
  { p: 'SuperHits', l: 'Сверх-хиты', ic: '💠' },
  { p: 'Speed', l: 'Скорость', ic: '👣', num: true },
  { p: 'CarryCapacity', l: 'Грузоподъёмность', ic: '🎒', num: true },
  { p: 'Mastery', l: 'Мастерство', ic: '⭐' }
]
const RATES = [
  { p: 'Exhaustion', l: 'Изнурение', max: 5, icon: 'block' },
  { p: 'DeathSaves', l: 'Спасброски от смерти', max: 3, icon: 'heart' },
  { p: 'Vision', l: 'Восприятие (Зрение)', max: 10, icon: 'eyes' },
  { p: 'Hearing', l: 'Восприятие (Слух)', max: 10, icon: 'ear' },
  { p: 'Aura', l: 'Восприятие (Аура)', max: 10, icon: 'aura' }
]
const tri = computed(() => [{ label: 'ТЕЛО', value: d.value.BodyDev }, { label: 'РАЗУМ', value: d.value.MindDev }, { label: 'ДУХ', value: d.value.SpiritDev }])
const maxHp = computed(() => hpMax(d.value))
const hpPct = computed(() => { const h = d.value.HpData; return maxHp.value > 0 ? Math.max(0, Math.min(100, (h.Current / maxHp.value) * 100)) : 0 })
const tmpPct = computed(() => { const h = d.value.HpData; return maxHp.value > 0 ? Math.min(100, (h.Temp / maxHp.value) * 100) : 0 })
const hpTone = computed(() => (hpPct.value <= 25 ? 'low' : hpPct.value <= 55 ? 'mid' : ''))
async function setPhoto() {
  try { await pickImage('PhotoFile', { title: 'Портрет персонажа', size: 640 }) } catch (e) { toast(e.message, 'error') }
}
</script>

<style scoped>
.pm { display: grid; gap: 4px; }
.pm-head { display: grid; grid-template-columns: 150px minmax(0, 1fr); gap: 16px; align-items: start; }
.pm-photo { position: relative; width: 150px; aspect-ratio: 3 / 4; border-radius: 14px; overflow: hidden; border: 2px solid color-mix(in srgb, var(--acc) 60%, transparent); box-shadow: 0 10px 26px rgba(0, 0, 0, .5), 0 0 0 4px rgba(0, 0, 0, .25); background: rgba(0, 0, 0, .3); }
.pm-photo img { width: 100%; height: 100%; object-fit: cover; cursor: zoom-in; transition: transform .5s; }
.pm-photo:hover img { transform: scale(1.04); }
.pm-add { width: 100%; height: 100%; display: grid; place-content: center; gap: 4px; border: 0; background: none; color: var(--muted); font-size: 34px; cursor: pointer; }
.pm-add small { font: 700 12px 'Manrope', sans-serif; }
.pm-photo-acts { position: absolute; right: 6px; bottom: 6px; display: flex; gap: 4px; opacity: 0; transition: opacity .2s; }
.pm-photo:hover .pm-photo-acts { opacity: 1; }
.pm-photo-acts button { width: 28px; height: 28px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, .2); background: rgba(10, 8, 6, .8); color: #fff; cursor: pointer; font-size: 13px; }
.pm-id { display: grid; gap: 8px; min-width: 0; }
.pm-cls { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.pm-lvl { display: flex; align-items: center; gap: 10px; }
.pm-badge { display: inline-flex; align-items: baseline; gap: 3px; padding: 4px 12px; border-radius: 99px; background: linear-gradient(180deg, color-mix(in srgb, var(--acc) 80%, #fff), var(--acc)); color: #1b140c; font: 800 18px 'Manrope', sans-serif; box-shadow: 0 0 18px color-mix(in srgb, var(--acc) 40%, transparent); }
.pm-badge small { font-size: 11px; }
.pm-race { color: var(--muted); font: 700 13px 'Manrope', sans-serif; }

.pm-hp { display: grid; gap: 5px; margin-top: 14px; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--line); background: rgba(0, 0, 0, .22); cursor: pointer; text-align: left; color: var(--ink); transition: border-color .2s; }
.pm-hp:hover { border-color: var(--acc); }
.pm-hp-bar { position: relative; display: block; height: 12px; border-radius: 99px; background: rgba(0, 0, 0, .45); overflow: hidden; box-shadow: inset 0 1px 3px rgba(0, 0, 0, .6); }
.pm-hp-bar i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 99px; background: linear-gradient(90deg, #3fae5a, #7ee06a); transition: width .6s cubic-bezier(.2, .9, .3, 1); }
.pm-hp-bar i.mid { background: linear-gradient(90deg, #c98a1f, #ffd166); }
.pm-hp-bar i.low { background: linear-gradient(90deg, #a5281c, #ff6b5e); animation: pm-pulse 1.4s ease-in-out infinite; }
.pm-hp-bar i.tmp { left: auto; right: 0; background: repeating-linear-gradient(45deg, #4fd8ff, #4fd8ff 4px, #2a8db0 4px, #2a8db0 8px); opacity: .85; }
@keyframes pm-pulse { 50% { filter: brightness(1.4); } }
.pm-hp-txt { font: 700 13px 'Manrope', sans-serif; color: var(--muted); }
.pm-hp-txt b { color: var(--ink); font-size: 17px; }
.pm-hp-txt em { color: #4fd8ff; font-style: normal; }
.pm-pools { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-top: 8px; }
.pool { padding: 6px 6px 4px; border-radius: 10px; background: rgba(0, 0, 0, .2); border: 1px solid var(--line); }
.pool.mana { border-color: rgba(124, 156, 255, .35); }
.pool.sta { border-color: rgba(255, 209, 102, .3); }
.pool.hp { border-color: rgba(126, 224, 106, .3); }
.pool :deep(input) { font-size: 18px; font-weight: 800; }

.pm-stats { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
.pm-stat { position: relative; min-width: 0; display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: end; gap: 6px; padding: 8px 8px 6px; border-radius: 10px; background: rgba(0, 0, 0, .18); border: 1px solid var(--line); }
.pm-ic { font-size: 18px; filter: saturate(.75); padding-bottom: 6px; }
.pm-stat :deep(input) { font-size: 18px; font-weight: 800; }
.pm-stat.ini { grid-template-columns: auto minmax(0, 1fr) auto; grid-column: span 2; }
.pm-stat.ini .bn { margin-bottom: 4px; }
.pm-rates { display: grid; gap: 8px; }
.pm-rate { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px 12px; padding: 6px 10px; border-radius: 10px; background: rgba(0, 0, 0, .14); }
.pm-rate > span { font: 700 12.5px 'Manrope', sans-serif; color: var(--muted); }
.pm-tri { display: grid; grid-template-columns: minmax(0, 1fr) 150px; gap: 12px; align-items: center; }
.pm-radar { --rs: 230px; justify-self: center; }
.pm-tri-f { display: grid; gap: 8px; }
.pm-tri-f :deep(input) { font-size: 18px; font-weight: 800; }
.pm-custom { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.pm-cf { display: grid; gap: 2px; padding: 6px 8px; border-radius: 10px; background: rgba(0, 0, 0, .14); }
.pm-cf .lbl :deep(input) { font: 800 10.5px 'Manrope', sans-serif; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); padding: 2px 6px; }
.pm-view { position: fixed; inset: 0; z-index: 700; display: grid; place-items: center; background: rgba(5, 4, 3, .9); cursor: zoom-out; animation: pm-fade .2s; }
.pm-view img { max-width: 94vw; max-height: 92vh; border-radius: 12px; box-shadow: 0 30px 80px rgba(0, 0, 0, .8); }
@keyframes pm-fade { from { opacity: 0; } }
@media (max-width: 560px) {
  .pm-head { grid-template-columns: 110px minmax(0, 1fr); gap: 12px; }
  .pm-photo { width: 110px; }
  .pm-cls, .pm-custom { grid-template-columns: minmax(0, 1fr); }
  .pm-tri { grid-template-columns: minmax(0, 1fr); }
  .pm-tri-f { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
</style>
