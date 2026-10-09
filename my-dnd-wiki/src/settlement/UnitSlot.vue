<template>
  <!-- слот войска: портрет с числом воинов, имя и крупные статы с иконками -->
  <component :is="clickable ? 'button' : 'div'" type="button" class="us" :class="[size, { empty: !unit, locked, click: clickable, warn: unit && !unit.ok }]"
             :title="title" @click="clickable && $emit('pick')">
    <template v-if="!unit">
      <div class="us-face"><span>{{ locked ? '🔒' : clickable ? '＋' : '' }}</span></div>
      <span class="us-empty">{{ locked ? 'закрыто' : clickable ? (emptyText || 'поставить') : 'пусто' }}</span>
    </template>
    <template v-else>
      <div class="us-face" :class="{ asset: face?.asset, dead: face?.dead, glyph: face?.glyph }" :style="face ? { '--fc': face.color } : null">
        <img v-if="face?.img" :src="face.img" alt="" />
        <span v-else-if="face">{{ face.letter }}</span>
        <em class="us-count" title="Сколько воинов">×{{ unit.count }}</em>
      </div>
      <div class="us-info">
        <b>{{ label || unit.name }}<i v-if="unit.talents" title="Талантливые">★{{ unit.talents }}</i></b>
        <div v-if="unit.ok" class="us-pills">
          <span class="a" :class="{ up: buff === 'atk' }" title="Атака">⚔ {{ show('atk') }}</span>
          <span class="d" :class="{ up: buff === 'def' }" title="Защита">🛡 {{ show('def') }}</span>
          <span class="h" title="Хиты">❤ {{ show('hp') }}</span>
          <span class="s" :class="{ up: buff === 'ini' }" title="Инициатива">⚡ {{ show('ini') }}</span>
        </div>
        <span v-else class="us-bad">статы не заполнены</span>
        <small v-if="size === 'md' && unit.ok">сила {{ power(unit) }}</small>
      </div>
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
const show = k => String(props.unit[k]).replace('.', ',')
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
.us-face { --fc: #c9b88f; position: relative; width: 54px; height: 54px; flex: none; border-radius: 50%; display: grid; place-items: center; background: var(--fc); border: 2px solid #fff3d6; color: #1b140c; font: 700 22px var(--a-serif); }
.us-face img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
.us-face.glyph { background: #d6d2c8; }
.us-face.glyph img { object-fit: contain; padding: 7px; box-sizing: border-box; }
.us-face.asset { border-color: #b77aff; box-shadow: 0 0 0 2px #2a1a40; }
.us-face.dead { filter: grayscale(1) brightness(.6); }
.us-count { position: absolute; right: -8px; bottom: -4px; min-width: 22px; padding: 1px 5px; border-radius: 99px; background: #1a140e; border: 1.5px solid #e6c27a; color: #f3d99a; font: 800 12px var(--a-sans); font-style: normal; text-align: center; }
.empty .us-face { background: none; border: 2px dashed rgba(201, 162, 79, .4); color: #e6c27a; font: 700 20px var(--a-sans); }
.us-empty { color: var(--a-muted); font: 700 12.5px var(--a-sans); }
.us-info { display: grid; gap: 4px; min-width: 0; font-size: 11.5px; color: var(--a-muted); }
.us-info b { font: 700 16px var(--a-serif); color: var(--a-gold-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.us-info b i { margin-left: 6px; font: 800 11px var(--a-sans); font-style: normal; color: #ffe08a; }
.us-pills { display: grid; grid-template-columns: repeat(2, auto); justify-content: start; gap: 3px 10px; }
.us-pills span { font: 800 14px var(--a-sans); white-space: nowrap; }
.us-pills .a { color: #ff9b8f; } .us-pills .d { color: #8fc7ff; } .us-pills .h { color: #9be07a; } .us-pills .s { color: #ffe08a; }
.us-pills .up { text-decoration: underline 2px #9be07a; text-underline-offset: 3px; }
.us-bad { color: #ffb36b; font-weight: 700; }
/* маленький слот (линии отряда): портрет сверху, статы под ним */
.us.sm { flex-direction: column; gap: 6px; padding: 8px 4px; min-height: 140px; }
.sm .us-face { width: 42px; height: 42px; font-size: 17px; }
.sm .us-info { justify-items: center; text-align: center; width: 100%; }
.sm .us-info b { font-size: 13px; max-width: 100%; }
.sm .us-pills { gap: 2px 6px; }
.sm .us-pills span { font-size: 12px; }
.sm.empty { justify-content: center; }
</style>
