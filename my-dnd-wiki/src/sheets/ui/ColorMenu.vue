<template>
  <Teleport to="body">
    <div v-if="colorMenu.open" class="cm-back" @pointerdown.self="colorMenu.open = false" @contextmenu.prevent="colorMenu.open = false">
      <div class="cm" :style="{ left: colorMenu.x + 'px', top: colorMenu.y + 'px' }" role="dialog" :aria-label="colorMenu.title">
        <b>{{ colorMenu.title }}</b>
        <div class="cm-grid">
          <button v-for="c in PALETTE" :key="c" type="button" :style="{ background: c }" :class="{ on: c === colorMenu.value }" :title="c" @click="pickColor(c)" />
        </div>
        <div class="cm-row">
          <label class="cm-own" title="Свой цвет"><input type="color" :value="colorMenu.value || '#E7C56F'" @change="pickColor($event.target.value)" /> свой</label>
          <button type="button" class="cm-reset" @click="pickColor('')">Как было</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { onBeforeUnmount, onMounted } from 'vue'
import { colorMenu, PALETTE, pickColor } from './colorMenu.js'

const esc = e => { if (e.key === 'Escape') colorMenu.open = false }
onMounted(() => addEventListener('keydown', esc))
onBeforeUnmount(() => { removeEventListener('keydown', esc); colorMenu.open = false })
</script>

<style scoped>
.cm-back { position: fixed; inset: 0; z-index: 600; }
.cm { position: fixed; display: grid; gap: 8px; width: 214px; padding: 10px; border-radius: 12px; background: #17130e; border: 1px solid #8a6630; box-shadow: 0 16px 40px rgba(0, 0, 0, .6); color: #efe3c8; font: 600 12px 'Manrope', sans-serif; animation: cm-in .14s ease-out; }
.cm b { font: 700 12px 'Manrope', sans-serif; color: #a8936c; letter-spacing: .06em; text-transform: uppercase; }
.cm-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; }
.cm-grid button { aspect-ratio: 1; border-radius: 50%; border: 2px solid rgba(0, 0, 0, .4); cursor: pointer; transition: transform .12s; }
.cm-grid button:hover { transform: scale(1.15); }
.cm-grid button.on { box-shadow: 0 0 0 2px #17130e, 0 0 0 4px #efe3c8; }
.cm-row { display: flex; gap: 6px; align-items: center; justify-content: space-between; }
.cm-own { display: flex; align-items: center; gap: 6px; color: #a8936c; cursor: pointer; }
.cm-own input { width: 26px; height: 22px; padding: 0; border: 0; background: none; cursor: pointer; }
.cm-reset { padding: 4px 10px; border-radius: 8px; border: 1px solid rgba(231, 197, 111, .35); background: none; color: #f3d99a; font: 700 12px 'Manrope', sans-serif; cursor: pointer; }
@keyframes cm-in { from { opacity: 0; transform: scale(.94); } }
</style>
