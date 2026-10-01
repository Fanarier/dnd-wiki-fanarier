<template>
  <div class="picker">
    <div class="pk-group">
      <div class="pk-title">
        Свои иконки
        <label class="ui-btn small upload" :class="{ busy }">
          <Icon name="plus" :size="15" /> {{ busy ? 'Загрузка…' : 'Загрузить' }}
          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple hidden :disabled="busy" @change="onFiles" />
        </label>
      </div>
      <div v-if="store.data.icons.length" class="pk-grid">
        <div v-for="ic in store.data.icons" :key="ic.id" class="pk-cell custom" :class="{ on: modelValue === 'u:' + ic.id }">
          <button type="button" class="pk-btn" :title="ic.name" @click="$emit('update:modelValue', 'u:' + ic.id)">
            <img :src="`/usericons/${ic.file}`" alt="" />
          </button>
          <button type="button" class="pk-x" title="Удалить из библиотеки" @click="remove(ic)">×</button>
        </div>
      </div>
      <div v-else class="pk-empty">Загрузи портреты НПС, гербы, свои значки — PNG с прозрачным фоном останется прозрачным.</div>
      <input v-if="selectedCustom" :value="selectedCustom.name" class="ui-input pk-name" maxlength="60" placeholder="Название иконки" @change="rename(selectedCustom, $event.target.value)" />
    </div>

    <div v-for="(list, g) in groups" :key="g" class="pk-group">
      <div class="pk-title">{{ g }}</div>
      <div class="pk-grid">
        <button v-for="[k, e] in list" :key="k" type="button" class="pk-cell pk-btn" :class="{ on: modelValue === k }" :title="e.label"
                @click="$emit('update:modelValue', k)">
          <img :src="`/icons/${e.img}.png`" alt="" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import Icon from './Icon.vue'
import { store, act, toast, uploadIcon } from './store.js'
import { POINT_EFFECTS } from '../shared/catalog.js'

const props = defineProps({ modelValue: { type: String, default: '' } })
const emit = defineEmits(['update:modelValue'])

const groups = Object.entries(POINT_EFFECTS).reduce((acc, [k, e]) => {
  (acc[e.group] ||= []).push([k, e])
  return acc
}, {})

const selectedCustom = computed(() => (props.modelValue?.startsWith('u:') ? store.data.icons.find(i => i.id === props.modelValue.slice(2)) : null))

const busy = ref(false)
async function onFiles(e) {
  const files = [...e.target.files]
  e.target.value = ''
  busy.value = true
  let last = null
  for (const f of files) {
    try {
      last = await uploadIcon(f)
    } catch (err) {
      toast(`${f.name}: ${err.message}`, 'error')
    }
  }
  busy.value = false
  if (last) {
    toast(files.length > 1 ? `Загружено иконок: ${files.length}` : 'Иконка загружена')
    emit('update:modelValue', 'u:' + last.id)
  }
}

async function remove(ic) {
  if (!confirm(`Удалить иконку «${ic.name}» из библиотеки? Метки с ней станут «Неизвестно».`)) return
  await act('DELETE', `/api/icons/${ic.id}`, undefined, 'Иконка удалена').catch(() => {})
}

const rename = (ic, name) => act('PATCH', `/api/icons/${ic.id}`, { name }).catch(() => {})
</script>

<style scoped>
.picker { display: grid; gap: 10px; max-height: 300px; overflow-y: auto; padding: 10px; border-radius: 12px; background: rgba(0, 0, 0, 0.25); border: 1px solid var(--line-2); scrollbar-width: thin; }
.pk-title { display: flex; justify-content: space-between; align-items: center; font-size: 11px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); margin-bottom: 6px; }
.pk-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(38px, 1fr)); gap: 5px; }
.pk-cell { position: relative; }
.pk-btn { width: 100%; aspect-ratio: 1; display: grid; place-items: center; padding: 3px; border-radius: 9px; border: 2px solid transparent; background: rgba(255, 255, 255, 0.04); cursor: pointer; }
.pk-btn img { max-width: 100%; max-height: 100%; }
.pk-btn:hover { background: rgba(255, 255, 255, 0.1); }
.pk-cell.on, .pk-cell.on .pk-btn { border-color: var(--gold); background: rgba(231, 197, 111, 0.15); border-radius: 9px; }
.custom.on { border: 0; }
.pk-x { position: absolute; top: -5px; right: -5px; width: 18px; height: 18px; border-radius: 50%; border: 0; background: #2a1d1d; color: #ffb0a8; font: 700 13px/1 var(--sans); cursor: pointer; display: none; }
.custom:hover .pk-x, .custom.on .pk-x { display: block; }
.pk-empty { font-size: 12px; color: var(--muted); }
.pk-name { margin-top: 6px; min-height: 32px; }
.upload { cursor: pointer; text-transform: none; letter-spacing: 0; }
.upload.busy { opacity: .6; }
</style>
