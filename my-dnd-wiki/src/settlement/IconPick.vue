<template>
  <!-- выбор значка: из набора game-icons или своя картинка -->
  <div class="ip" @click.stop>
    <div class="ip-h">{{ title }}<button type="button" class="x" aria-label="Закрыть" @click="$emit('close')">×</button></div>
    <div class="ip-icons">
      <button v-for="ic in SPEC_ICONS" :key="ic" type="button" :class="{ on: current === `/settlement/${ic}.png` }" :title="ic" @click="$emit('pick', `/settlement/${ic}.png`)">
        <img :src="`/settlement/${ic}.png`" alt="" />
      </button>
    </div>
    <div class="ip-acts">
      <label class="mini">{{ busy ? 'Загружаю…' : 'Своя картинка' }}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden @change="upload" /></label>
      <button v-if="current" type="button" class="mini" @click="$emit('pick', '')">Убрать</button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { toast, uploadSettlementPortrait } from '../map/store.js'
import { SPEC_ICONS } from './specIcons.js'

const props = defineProps({ settlementId: String, current: { type: String, default: '' }, title: { type: String, default: 'Значок' } })
const emit = defineEmits(['pick', 'close'])
const busy = ref(false)
async function upload(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  busy.value = true
  try { const r = await uploadSettlementPortrait(props.settlementId, file, props.title); if (r) emit('pick', r.url) } catch (err) { toast(err.message, 'error') } finally { busy.value = false }
}
</script>

<style scoped>
.ip { position: absolute; z-index: 30; top: calc(100% + 6px); left: 0; width: min(300px, 80vw); padding: 10px; border-radius: 12px; background: #17130e; border: 1px solid #8a6630; box-shadow: 0 16px 40px rgba(0, 0, 0, .6); cursor: default; }
.ip-h { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; font: 800 12px var(--a-sans); color: var(--a-gold-2); }
.x { border: 0; background: none; color: var(--a-muted); font-size: 20px; cursor: pointer; }
.ip-icons { display: grid; grid-template-columns: repeat(auto-fill, minmax(34px, 1fr)); gap: 4px; max-height: 180px; overflow-y: auto; }
.ip-icons button { aspect-ratio: 1; padding: 4px; border-radius: 7px; border: 2px solid transparent; background: #d6d2c8; cursor: pointer; }
.ip-icons button:hover { border-color: #e6c27a; }
.ip-icons button.on { border-color: #9be07a; }
.ip-icons img { width: 100%; height: 100%; object-fit: contain; }
.ip-acts { display: flex; gap: 6px; margin-top: 8px; }
.mini { padding: 4px 10px; border-radius: 8px; border: 1px solid var(--a-line); background: rgba(231, 197, 111, .08); color: var(--a-gold-2); font: 700 12px var(--a-sans); cursor: pointer; }
</style>
