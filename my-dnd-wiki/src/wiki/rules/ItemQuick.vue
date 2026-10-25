<template>
  <!-- быстрое создание вещи из журнала: «вещь есть, но её нет в листе» (сразу ляжет в инвентарь) или описание новой
       полученной вещи (ляжет при «учтено»). Название, сколько, редкость, описание, склад -->
  <Teleport to="body">
    <div class="iq-back" @pointerdown.self="$emit('close')">
      <form class="iq" @submit.prevent="save">
        <header>
          <small>{{ mode === 'exists' ? 'Вещи нет в листе' : 'Новая вещь' }}</small>
          <b>{{ mode === 'exists' ? 'Добавить в инвентарь' : 'Описать вещь' }}</b>
          <p>{{ mode === 'exists'
            ? 'Вещь сразу появится в инвентаре героя (в истории листа — «создана из журнала»), а при «учтено» уйдёт. Мастер увидит метку ✨ на проверке.'
            : 'Так она и ляжет в инвентарь, когда мастер поставит «учтено».' }}</p>
        </header>
        <label>Название<input v-model.trim="f.name" class="iq-in" maxlength="160" required autofocus /></label>
        <div class="iq-row">
          <label>{{ mode === 'exists' ? 'Сколько у героя есть' : 'Сколько получено' }}<input v-model.number="f.qty" type="number" min="1" class="iq-in" required /></label>
          <label class="iq-chk"><input v-model="f.stored" type="checkbox" /> на складе</label>
        </div>
        <div class="iq-f">Редкость
          <div class="iq-rar">
            <button v-for="r in RARITIES" :key="r.name" type="button" :style="{ '--rc': r.color }" :class="{ on: f.rarity === r.name }" @click="f.rarity = f.rarity === r.name ? '' : r.name">{{ r.name }}</button>
          </div>
        </div>
        <div class="iq-f">Описание<RichInput v-model="f.desc" :min-height="60" placeholder="Что это за вещь, свойства (по желанию)" /></div>
        <label>Заметки<input v-model="f.notes" class="iq-in" maxlength="300" placeholder="Откуда, у кого куплена… (по желанию)" /></label>
        <footer>
          <button type="button" class="iq-btn" @click="$emit('close')">Отмена</button>
          <button type="submit" class="iq-btn primary" :disabled="busy || !f.name">{{ mode === 'exists' ? 'Добавить в инвентарь' : 'Готово' }}</button>
        </footer>
      </form>
    </div>
  </Teleport>
</template>

<script setup>
import { reactive } from 'vue'
import { RARITIES } from '../../shared/sheet.js'
import RichInput from '../../components/rich/RichInput.vue'

const props = defineProps({ item: { type: Object, required: true }, mode: { type: String, default: 'describe' }, busy: Boolean })
const emit = defineEmits(['save', 'close'])
const f = reactive({ name: props.item.name || '', qty: Math.abs(props.item.qty) || 1, stored: !!props.item.stored, rarity: props.item.info?.rarity || '', desc: props.item.info?.desc || '', notes: props.item.info?.notes || '' })
const save = () => emit('save', { name: f.name, qty: Math.max(1, Math.round(f.qty) || 1), stored: f.stored, info: { rarity: f.rarity, desc: f.desc, notes: f.notes } })
</script>

<style scoped>
.iq-back { position: fixed; inset: 0; z-index: 700; display: grid; place-items: center; padding: 16px; background: rgba(5, 4, 3, .7); backdrop-filter: blur(3px); }
.iq { width: min(480px, 100%); max-height: calc(100vh - 32px); overflow-y: auto; display: grid; gap: 10px; padding: 16px; border-radius: 16px; background: linear-gradient(180deg, #221b13, #17130e); border: 1px solid rgba(231, 197, 111, .45); box-shadow: 0 30px 80px rgba(0, 0, 0, .7); color: #efe3c8; font: 600 13px 'Manrope', sans-serif; }
.iq header small { color: #ffb3aa; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; font-size: 10.5px; }
.iq header b { display: block; font: 700 22px 'Cormorant Garamond', serif; color: #f3dc9e; }
.iq header p { margin: 2px 0 0; color: #a8936c; font-size: 12px; font-weight: 500; }
.iq label, .iq-f { display: grid; gap: 4px; color: #a8936c; font-size: 11.5px; font-weight: 800; letter-spacing: .04em; }
.iq-in { width: 100%; box-sizing: border-box; padding: 7px 9px; border-radius: 9px; border: 1px solid rgba(231, 197, 111, .25); background: rgba(0, 0, 0, .35); color: #efe3c8; font: 600 13px 'Manrope', sans-serif; outline: none; }
.iq-in:focus { border-color: #e7c56f; }
.iq-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; align-items: end; }
.iq .iq-chk { display: flex; align-items: center; gap: 6px; padding-bottom: 8px; color: #efe3c8; }
.iq-rar { display: flex; flex-wrap: wrap; gap: 4px; }
.iq-rar button { padding: 4px 10px; border-radius: 99px; border: 1px solid color-mix(in srgb, var(--rc) 50%, transparent); background: none; color: var(--rc); font: 700 12px 'Manrope', sans-serif; cursor: pointer; }
.iq-rar button.on { background: color-mix(in srgb, var(--rc) 22%, transparent); box-shadow: 0 0 10px color-mix(in srgb, var(--rc) 40%, transparent); }
.iq footer { display: flex; justify-content: flex-end; gap: 8px; }
.iq-btn { height: 34px; padding: 0 14px; border-radius: 9px; border: 1px solid rgba(231, 197, 111, .35); background: rgba(0, 0, 0, .3); color: #f3dc9e; font: 700 13px 'Manrope', sans-serif; cursor: pointer; }
.iq-btn.primary { background: linear-gradient(180deg, #f0d083, #c9a24f); color: #1b1408; border: 0; }
.iq-btn:disabled { opacity: .5; cursor: default; }
</style>
