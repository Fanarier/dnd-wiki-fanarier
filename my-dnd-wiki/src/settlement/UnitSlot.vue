<template>
  <!-- слот войска: лицо + стат-блок как в старой таблице (атака | защита / количество / хиты | инициатива) -->
  <component :is="clickable ? 'button' : 'div'" type="button" class="us" :class="[size, { empty: !unit, locked, click: clickable, warn: unit && !unit.ok }]"
             :title="title" @click="clickable && $emit('pick')">
    <div class="us-face" :class="{ asset: face?.asset, dead: face?.dead }" :style="face ? { '--fc': face.color } : null">
      <img v-if="face?.img" :src="face.img" alt="" />
      <span v-else-if="face">{{ face.letter }}</span>
      <span v-else class="us-plus">{{ locked ? '🔒' : clickable ? '＋' : '' }}</span>
      <small v-if="label">{{ label }}</small>
    </div>
    <div class="us-stat" :class="{ off: !unit }">
      <i class="a" :class="{ up: buff === 'atk' }">{{ show('atk') }}</i>
      <i class="d" :class="{ up: buff === 'def' }">{{ show('def') }}</i>
      <i class="n">{{ unit ? unit.count : '' }}</i>
      <i class="h">{{ show('hp') }}</i>
      <i class="s" :class="{ up: buff === 'ini' }">{{ show('ini') }}</i>
    </div>
    <em v-if="unit?.talents" class="us-tal" :title="`Талантливых: ${unit.talents}`">★{{ unit.talents }}</em>
  </component>
</template>

<script setup>
import { computed } from 'vue'
const props = defineProps({
  unit: { type: Object, default: null }, // из unitOf()
  face: { type: Object, default: null },
  label: { type: String, default: '' },
  size: { type: String, default: 'md' }, // md | sm
  locked: Boolean,
  clickable: Boolean,
  buff: { type: String, default: '' } // стат, который усиливает линия отряда
})
defineEmits(['pick'])
const show = k => (props.unit ? (props.unit.ok ? String(props.unit[k]).replace('.', ',') : '?') : '')
const title = computed(() => {
  const u = props.unit
  if (!u) return props.locked ? 'Слот закрыт' : props.clickable ? 'Пустой слот — поставить' : 'Пусто'
  return `${u.name}: ${u.count} · атака ${u.atk}, защита ${u.def}, хиты ${u.hp}, инициатива ${u.ini}${u.ok ? '' : ' — статы не заполнены!'}`
})
</script>

<style scoped>
.us { position: relative; display: flex; align-items: center; gap: 6px; padding: 6px; border-radius: 12px; background: rgba(255, 255, 255, .03); border: 1px solid rgba(255, 255, 255, .07); color: inherit; font: inherit; text-align: left; min-width: 0; }
.us.click { cursor: pointer; transition: border-color .15s, background .15s; }
.us.click:hover { border-color: rgba(231, 197, 111, .5); background: rgba(231, 197, 111, .06); }
.us.locked { opacity: .4; filter: grayscale(1); }
.us.warn { border-color: rgba(255, 179, 107, .6); }
.us-face { --fc: #c9b88f; position: relative; width: 56px; height: 56px; flex: none; border-radius: 50%; display: grid; place-items: center; background: var(--fc); border: 2px solid #fff3d6; color: #1b140c; font: 700 22px var(--a-serif); }
.us-face img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
.us-face.asset { border-color: #b77aff; box-shadow: 0 0 0 2px #2a1a40; }
.us-face.dead { filter: grayscale(1) brightness(.6); }
.empty .us-face { background: none; border: 2px dashed rgba(255, 255, 255, .25); color: var(--a-muted); font: 700 18px var(--a-sans); }
.us-face small { position: absolute; bottom: -7px; left: 50%; transform: translateX(-50%); max-width: 90px; overflow: hidden; text-overflow: ellipsis; padding: 0 5px; border-radius: 5px; background: #1a140e; color: #d9cdb0; font: 700 9px var(--a-sans); white-space: nowrap; }
.us-stat { display: grid; grid-template-columns: 30px 30px; grid-template-rows: 20px 22px 20px; gap: 2px; flex: none; }
.us-stat i { position: relative; display: grid; place-items: center; border: 1.5px solid rgba(255, 255, 255, .75); border-radius: 3px; color: #fff; font: 800 11px var(--a-sans); font-style: normal; }
.us-stat i::before { position: absolute; top: -1px; left: 2px; font-size: 7.5px; font-weight: 700; color: var(--a-muted); }
.us-stat .a { color: #ff9b8f; } .us-stat .a::before { content: 'атк'; }
.us-stat .d { color: #8fc7ff; } .us-stat .d::before { content: 'защ'; }
.us-stat .n { grid-column: span 2; color: var(--a-gold-2); font-size: 15px; }
.us-stat .h { color: #9be07a; } .us-stat .h::before { content: 'хп'; }
.us-stat .s { color: #ffe08a; } .us-stat .s::before { content: 'иниц'; }
.us-stat i.up { box-shadow: 0 0 0 1.5px #9be07a; }
.us-stat.off i { border-color: rgba(255, 255, 255, .2); box-shadow: none; }
.us-tal { position: absolute; top: 3px; right: 6px; color: #ffe08a; font: 800 10px var(--a-sans); font-style: normal; }
.us.sm { flex-direction: column; justify-content: flex-start; gap: 8px; padding: 6px 4px; }
.sm .us-face { width: 40px; height: 40px; font-size: 16px; }
.sm .us-face small { bottom: -8px; max-width: 70px; }
.sm .us-stat { grid-template-columns: 24px 24px; grid-template-rows: 17px 19px 17px; }
.sm .us-stat i { font-size: 10px; }
.sm .us-stat .n { font-size: 13px; }
</style>
