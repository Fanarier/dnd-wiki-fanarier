<template>
  <!-- слот войска: лицо + стат-блок как в старой таблице (атака | защита / количество / хиты | инициатива) -->
  <component :is="clickable ? 'button' : 'div'" type="button" class="us" :class="[size, { empty: !unit, locked, click: clickable, warn: unit && !unit.ok }]"
             :title="title" @click="clickable && $emit('pick')">
    <!-- пусто: аккуратная плашка вместо пустых клеток -->
    <template v-if="!unit">
      <div class="us-face"><span class="us-plus">{{ locked ? '🔒' : clickable ? '＋' : '' }}</span></div>
      <span class="us-empty">{{ locked ? 'закрыто' : clickable ? (emptyText || 'поставить') : 'пусто' }}</span>
    </template>
    <template v-else>
      <div class="us-face" :class="{ asset: face?.asset, dead: face?.dead }" :style="face ? { '--fc': face.color } : null">
        <img v-if="face?.img" :src="face.img" alt="" />
        <span v-else-if="face">{{ face.letter }}</span>
      </div>
      <div class="us-stat">
        <i class="a" :class="{ up: buff === 'atk' }">{{ show('atk') }}</i>
        <i class="d" :class="{ up: buff === 'def' }">{{ show('def') }}</i>
        <i class="n">{{ unit.count }}</i>
        <i class="h">{{ show('hp') }}</i>
        <i class="s" :class="{ up: buff === 'ini' }">{{ show('ini') }}</i>
      </div>
      <div v-if="size === 'md'" class="us-info">
        <b>{{ label || unit.name }}</b>
        <span v-if="!unit.ok" class="us-bad">статы не заполнены</span>
        <span v-else>сила {{ power(unit) }}</span>
        <em v-if="unit.talents" :title="`Талантливых: ${unit.talents}`">★ {{ unit.talents }} талант{{ unit.talents === 1 ? '' : 'а' }}</em>
      </div>
      <small v-else class="us-name">{{ label || unit.name }}</small>
      <em v-if="size !== 'md' && unit.talents" class="us-tal">★{{ unit.talents }}</em>
    </template>
  </component>
</template>

<script setup>
import { computed } from 'vue'
import { power } from '../shared/army.js'
const props = defineProps({
  unit: { type: Object, default: null }, // из unitOf()
  face: { type: Object, default: null },
  label: { type: String, default: '' },
  emptyText: { type: String, default: '' },
  size: { type: String, default: 'md' }, // md | sm
  locked: Boolean,
  clickable: Boolean,
  buff: { type: String, default: '' } // стат, который усиливает линия отряда
})
defineEmits(['pick'])
const show = k => (props.unit.ok ? String(props.unit[k]).replace('.', ',') : '?')
const title = computed(() => {
  const u = props.unit
  if (!u) return props.locked ? 'Слот закрыт' : props.clickable ? 'Пустой слот — поставить' : 'Пусто'
  return `${u.name}: ${u.count} · атака ${u.atk}, защита ${u.def}, хиты ${u.hp}, инициатива ${u.ini}${u.ok ? '' : ' — статы не заполнены!'}${props.clickable ? '\nЩёлкни, чтобы изменить' : ''}`
})
</script>

<style scoped>
.us { position: relative; display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 12px; background: rgba(255, 255, 255, .03); border: 1px solid rgba(255, 255, 255, .08); color: inherit; font: inherit; text-align: left; min-width: 0; width: 100%; }
.us.click { cursor: pointer; transition: border-color .15s, background .15s; }
.us.click:hover { border-color: rgba(231, 197, 111, .55); background: rgba(231, 197, 111, .06); }
.us.locked { opacity: .4; filter: grayscale(1); }
.us.warn { border-color: rgba(255, 179, 107, .55); }
.us.empty { border-style: dashed; border-color: rgba(201, 162, 79, .3); background: none; }
.us.empty.click:hover { border-color: #e6c27a; }
.us-face { --fc: #c9b88f; position: relative; width: 52px; height: 52px; flex: none; border-radius: 50%; display: grid; place-items: center; overflow: hidden; background: var(--fc); border: 2px solid #fff3d6; color: #1b140c; font: 700 22px var(--a-serif); }
.us-face img { width: 100%; height: 100%; object-fit: cover; }
.us-face.asset { border-color: #b77aff; box-shadow: 0 0 0 2px #2a1a40; }
.us-face.dead { filter: grayscale(1) brightness(.6); }
.empty .us-face { background: none; border: 2px dashed rgba(201, 162, 79, .4); color: #e6c27a; font: 700 20px var(--a-sans); }
.us-empty { color: var(--a-muted); font: 700 12.5px var(--a-sans); }
.empty.click:hover .us-empty { color: var(--a-gold-2); }
.us-stat { display: grid; grid-template-columns: 30px 30px; grid-template-rows: 20px 22px 20px; gap: 2px; flex: none; }
.us-stat i { position: relative; display: grid; place-items: center; border: 1.5px solid rgba(255, 255, 255, .75); border-radius: 3px; color: #fff; font: 800 11px var(--a-sans); font-style: normal; }
.us-stat i::before { position: absolute; top: -1px; left: 2px; font-size: 7.5px; font-weight: 700; color: var(--a-muted); }
.us-stat .a { color: #ff9b8f; } .us-stat .a::before { content: 'атк'; }
.us-stat .d { color: #8fc7ff; } .us-stat .d::before { content: 'защ'; }
.us-stat .n { grid-column: span 2; color: var(--a-gold-2); font-size: 15px; }
.us-stat .h { color: #9be07a; } .us-stat .h::before { content: 'хп'; }
.us-stat .s { color: #ffe08a; } .us-stat .s::before { content: 'иниц'; }
.us-stat i.up { box-shadow: 0 0 0 1.5px #9be07a; }
.us-info { display: grid; gap: 1px; min-width: 0; font-size: 11.5px; color: var(--a-muted); }
.us-info b { font: 700 16px var(--a-serif); color: var(--a-gold-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.us-info em { font-style: normal; color: #ffe08a; font-weight: 700; }
.us-bad { color: #ffb36b; font-weight: 700; }
.us-tal { position: absolute; top: 3px; right: 5px; color: #ffe08a; font: 800 10px var(--a-sans); font-style: normal; }
/* маленький слот (линии отряда): лицо сверху, стат-блок под ним */
.us.sm { flex-direction: column; justify-content: flex-start; gap: 4px; padding: 6px 4px; min-height: 128px; }
.sm .us-face { width: 40px; height: 40px; font-size: 16px; }
.sm .us-stat { grid-template-columns: 24px 24px; grid-template-rows: 17px 19px 17px; }
.sm .us-stat i { font-size: 10px; }
.sm .us-stat .n { font-size: 13px; }
.us-name { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 700 10px var(--a-sans); color: #d9cdb0; }
.sm.empty { justify-content: center; }
</style>
