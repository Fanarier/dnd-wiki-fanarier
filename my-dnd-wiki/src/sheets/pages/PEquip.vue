<template>
  <!-- снаряжение: 17 слотов вокруг персонажа (рюкзак и поклажа — снизу); перетащи предмет на другой слот — поменяются местами.
       У кованого вместо снаряжения — слоты модулей платформы (вооружение, защита, общие) и мини-модули (src/shared/forged.js) -->
  <div class="pe" :class="{ forged }">
    <h2 class="sb-h sb-anim"><SheetIcon name="equip" class="ic" />{{ forged ? 'Модули' : 'Снаряжение' }}</h2>
    <template v-if="forged">
      <p class="pe-hint sb-anim">Снаряжение кованый не носит — вместо него модули в слотах платформы{{ plat ? ` «${plat.name}»` : '' }}. Щёлкни по слоту — посмотреть и править, перетащи модуль на другой слот того же вида — поменяются местами. Рюкзак и поклажа — в «Инвентаре».</p>
      <p v-if="!plat" class="pe-hint warn sb-anim">Платформа не выбрана (поле «Платформа» на главной) — слоты пока как у Сентинела.</p>
      <p v-else-if="plat.guess" class="pe-hint warn sb-anim">Сколько слотов у платформы «{{ plat.name }}», в вики не расписано — пока как у Сентинела.</p>
      <div v-for="g in groups" :key="g.k" class="pe-mg sb-anim">
        <div class="pe-mg-h"><span>{{ g.icon }} {{ g.name }}</span><small>{{ g.slots.filter(s => d[s.key]).length }} / {{ g.slots.length }}</small></div>
        <div class="pe-mods">
          <button v-for="s in g.slots" :key="s.key" type="button" class="pe-slot" :style="rarOf(s.key) ? { '--rc': rarOf(s.key).color } : null"
                  :class="{ filled: !!d[s.key], locked: locked(s.key), sel: sel === s.key, over: over === s.key }" :data-find="s.key"
                  :draggable="!!d[s.key] && !locked(s.key) && !ro" @click="sel = s.key"
                  @dragstart="dragStart($event, s.key)" @dragover.prevent="over = s.key" @dragleave="over === s.key && (over = '')" @drop.prevent="drop(s.key)" @dragend="over = ''">
            <span class="pe-img">
              <img v-if="d[s.key]?.ImageFile" :src="sheetImg(d[s.key].ImageFile)" alt="" draggable="false" />
              <span v-else class="pe-ph">{{ s.icon }}</span>
            </span>
            <small class="pe-nm">{{ d[s.key]?.Name || s.name }}</small>
            <i v-if="locked(s.key)" class="pe-lock">🔒</i>
          </button>
        </div>
      </div>
    </template>
    <template v-else>
      <p class="pe-hint sb-anim">Щёлкни по слоту — посмотреть и править. Перетащи предмет на другой слот — поменяются местами. 🔒 — слот заперт от случайных правок.</p>
      <div class="pe-doll sb-anim">
        <div class="pe-sil" aria-hidden="true">
          <img v-if="d.PhotoFile" :src="sheetImg(d.PhotoFile)" alt="" />
        </div>
        <button v-for="s in EQUIP_SLOTS" :key="s.key" type="button" class="pe-slot" :style="{ gridArea: AREA[s.key], ...(rarOf(s.key) ? { '--rc': rarOf(s.key).color } : {}) }"
                :class="{ filled: !!d[s.key], locked: locked(s.key), sel: sel === s.key, over: over === s.key }" :data-find="s.key"
                :draggable="!!d[s.key] && !locked(s.key) && !ro" @click="sel = s.key"
                @dragstart="dragStart($event, s.key)" @dragover.prevent="over = s.key" @dragleave="over === s.key && (over = '')" @drop.prevent="drop(s.key)" @dragend="over = ''">
          <span class="pe-img">
            <img v-if="d[s.key]?.ImageFile" :src="sheetImg(d[s.key].ImageFile)" alt="" draggable="false" />
            <span v-else class="pe-ph">{{ s.icon }}</span>
          </span>
          <small class="pe-nm">{{ d[s.key]?.Name || s.name }}</small>
          <i v-if="capLabel(s.key)" class="pe-cap" :title="capLabel(s.key).title">{{ capLabel(s.key).short }}</i>
          <i v-if="locked(s.key)" class="pe-lock">🔒</i>
        </button>
      </div>
    </template>

    <!-- выбранный слот -->
    <SlotDetail v-if="sel" :key="sel" :slot="sel" :cap="capLabel(sel)" :hint="SLOT_HINT[sel] || ''" />

    <MiniModules v-if="forged" />
  </div>
</template>

<script setup>
import { computed, inject, ref, watch } from 'vue'
import SheetIcon from '../ui/SheetIcon.vue'
import SlotDetail from '../ui/SlotDetail.vue'
import MiniModules from '../ui/MiniModules.vue'
import { capLabel } from '../ui/slotCap.js'
import { sheet, edit, sheetImg } from '../sheetState.js'
import { EQUIP_SLOTS, rarityOf } from '../../shared/sheet.js'
import { isForged, platformOf, moduleSlotsOf } from '../../shared/forged.js'

const ro = inject('sheetReadOnly', ref(false))
const d = computed(() => sheet.data)
const forged = computed(() => isForged(d.value))
const plat = computed(() => platformOf(d.value))
const groups = computed(() => moduleSlotsOf(d.value).filter(g => g.slots.length))
const AREA = {
  Ring1Item: 'r1', HeadItem: 'hd', AmuletItem: 'am', Ring2Item: 'r2', BodyItem: 'bd', Ornament1Item: 'o1', HandsItem: 'hn', BeltItem: 'bl',
  Ornament2Item: 'o2', Weapon1Item: 'w1', LegsItem: 'lg', Weapon2Item: 'w2', Artifact1Item: 'a1', ShieldItem: 'sh', Artifact2Item: 'a2',
  BackpackItem: 'bp', PackItem: 'pk'
}
const SLOT_HINT = {
  BeltItem: 'Пояс даёт карманы быстрого доступа (до 8): напиши у него «Карманы: 4».',
  BackpackItem: 'Рюкзак даёт ячейки сумки: напиши у него «Ячейки: 10». Без рюкзака — только базовые ячейки.',
  PackItem: 'Поклажа — вьюк на коне или в повозке, свои ячейки («Ячейки: 20»). В бою недоступна.'
}
const locked = k => !!d.value.SlotLocks?.[k]
const rarOf = k => rarityOf(d.value[k]?.Rarity)
const sel = ref('')
watch(forged, () => { sel.value = '' })
const over = ref('')
let dragFrom = ''
function dragStart(e, k) { dragFrom = k; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', k) }
// модули меняются местами только в слотах того же вида (вооружение ↔ вооружение)
const kindOf = k => k.replace(/\d+$/, '')
function drop(to) {
  over.value = ''
  const from = dragFrom
  dragFrom = ''
  if (!from || from === to || ro.value || locked(to) || locked(from)) return
  if (forged.value && kindOf(from) !== kindOf(to)) return
  const a = d.value[from], b = d.value[to]
  edit(from, b ? JSON.parse(JSON.stringify(b)) : null)
  edit(to, a ? JSON.parse(JSON.stringify(a)) : null, { now: true })
  sel.value = to
}
</script>

<style scoped>
.pe-hint { margin: -4px 0 10px; color: var(--muted); font: 600 12px 'Manrope', sans-serif; }
.pe-hint.warn { color: #ffb36b; }
.pe-mg { margin-bottom: 12px; }
.pe-mg-h { display: flex; align-items: baseline; gap: 8px; margin-bottom: 6px; font: 800 12px 'Manrope', sans-serif; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
.pe-mg-h small { letter-spacing: 0; }
.pe-mods { display: grid; gap: 10px; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); }
.pe-doll { position: relative; display: grid; gap: 10px; grid-template-columns: repeat(3, minmax(0, 1fr)); grid-template-areas: 'r1 hd am' 'r2 bd o1' 'hn bl o2' 'w1 lg w2' 'a1 sh a2' 'bp . pk'; max-width: 520px; margin: 0 auto; }
.pe-sil { position: absolute; left: 33.3%; right: 33.3%; top: 0; bottom: 0; border-radius: 50% 50% 18px 18px / 30% 30% 18px 18px; background: radial-gradient(ellipse at 50% 30%, color-mix(in srgb, var(--acc) 14%, transparent), transparent 70%); overflow: hidden; opacity: .5; pointer-events: none; }
.pe-sil img { width: 100%; height: 100%; object-fit: cover; opacity: .18; filter: grayscale(.6) blur(1px); mask-image: linear-gradient(transparent, #000 25%, #000 70%, transparent); }
.pe-slot { position: relative; z-index: 1; display: grid; justify-items: center; gap: 4px; padding: 8px 6px 6px; border-radius: 14px; border: 1px dashed color-mix(in srgb, var(--acc) 30%, transparent); background: rgba(0, 0, 0, .25); color: var(--ink); cursor: pointer; transition: transform .2s, border-color .2s, box-shadow .2s, background .2s; }
.pe-slot.filled { border-style: solid; border-color: color-mix(in srgb, var(--rc, var(--acc)) 55%, transparent); background: radial-gradient(circle at 50% 35%, color-mix(in srgb, var(--rc, var(--acc)) 16%, transparent), rgba(0, 0, 0, .3) 70%); }
.pe-slot:hover { transform: translateY(-3px); box-shadow: 0 10px 20px rgba(0, 0, 0, .4), 0 0 18px color-mix(in srgb, var(--rc, var(--acc)) 30%, transparent); }
.pe-slot.sel { box-shadow: 0 0 0 2px var(--rc, var(--acc)), 0 0 24px color-mix(in srgb, var(--rc, var(--acc)) 45%, transparent); }
.pe-slot.over { transform: scale(1.06); border-color: var(--acc); background: color-mix(in srgb, var(--acc) 20%, transparent); }
.pe-slot.locked { opacity: .6; }
.pe-img { display: grid; place-items: center; width: 64px; height: 64px; }
.pe-img img { width: 64px; height: 64px; object-fit: contain; filter: drop-shadow(0 4px 6px rgba(0, 0, 0, .5)); }
.pe-ph { font-size: 28px; opacity: .3; }
.pe-nm { max-width: 100%; font: 700 11.5px 'Manrope', sans-serif; color: var(--muted); text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pe-slot.filled .pe-nm { color: var(--ink); }
.pe-lock { position: absolute; right: 6px; top: 4px; font-size: 12px; font-style: normal; }
.pe-cap { position: absolute; left: 6px; top: 4px; padding: 1px 6px; border-radius: 99px; font: 800 10.5px 'Manrope', sans-serif; font-style: normal; color: var(--ink); background: color-mix(in srgb, var(--acc) 25%, rgba(0, 0, 0, .5)); }
@media (max-width: 560px) { .pe-img, .pe-img img { width: 48px; height: 48px; } }
</style>
