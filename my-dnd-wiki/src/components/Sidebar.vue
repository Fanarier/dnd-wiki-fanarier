<template>
  <nav class="side" aria-label="Разделы вики">
    <div class="side-kicker">Разделы</div>
    <template v-for="cat in categories" :key="cat.id">
      <!-- подзаголовок группы (школы магии: базовые, продвинутые, основные) -->
      <div v-if="cat.sep" class="side-sep">{{ cat.sep }}</div>
      <button
        class="side-item"
        :class="{ active: cat.id === activeId, iconed: !!cat.icon }"
        :aria-current="cat.id === activeId ? 'page' : undefined"
        @click="select(cat.id)"
      >
        <img v-if="cat.icon" class="side-icon" :src="cat.icon" alt="" aria-hidden="true" loading="lazy" />
        <span class="side-title">{{ cat.title }}<em v-if="cat.badge" class="side-badge" :title="cat.badgeTitle">{{ cat.badge }}</em></span>
        <span v-if="cat.description" class="side-desc">{{ cat.description }}</span>
      </button>
    </template>
    <div class="side-foot">Статей: {{ categories.length }}</div>
  </nav>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  categories: { type: Array, required: true, default: () => [] },
  initialActive: { type: String, required: false, default: null }
})

const emit = defineEmits(['select'])

const activeId = ref(props.initialActive ?? (props.categories[0]?.id ?? null))

watch(() => props.initialActive, v => { if (v) activeId.value = v })

function select(id) {
  activeId.value = id
  emit('select', id)
}
</script>

<style scoped>
.side-badge { margin-left: 6px; padding: 0 6px; border-radius: 99px; background: #f0b54f; color: #1b1408; font: 900 11px/17px 'Manrope', sans-serif; font-style: normal; vertical-align: 1px; }
.side { display: flex; flex-direction: column; gap: 4px; }
.side-kicker { font-size: 11px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: var(--a-muted); margin: 0 0 8px 10px; }
.side-item { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; text-align: left; padding: 10px 12px; border-radius: 10px; border: 1px solid transparent; background: none; color: var(--a-text); cursor: pointer; transition: background .15s, border-color .15s; font-family: var(--a-sans); }
.side-item:hover { background: rgba(255, 255, 255, 0.04); }
.side-item.active { background: rgba(231, 197, 111, 0.1); border-color: rgba(231, 197, 111, 0.35); }
.side-item.active .side-title { color: var(--a-gold-2); }
.side-title { font-weight: 700; font-size: 14px; }
.side-desc { font-size: 12px; color: var(--a-muted); line-height: 1.35; }
.side-sep { margin: 10px 0 2px 10px; font: 800 10.5px var(--a-sans); letter-spacing: .12em; text-transform: uppercase; color: #b9a6ff; }
.side-item.iconed { display: grid; grid-template-columns: 30px minmax(0, 1fr); column-gap: 8px; align-items: center; }
.side-item.iconed .side-desc { grid-column: 2; }
.side-icon { grid-row: span 2; width: 30px; height: 30px; object-fit: contain; filter: drop-shadow(0 0 6px rgba(185, 166, 255, .45)); transition: transform .3s; }
.side-item:hover .side-icon, .side-item.active .side-icon { transform: scale(1.12) rotate(-6deg); }
.side-foot { margin: 12px 0 0 10px; font-size: 12px; color: var(--a-muted); }
.side-item:focus-visible { outline: 2px solid var(--a-gold); outline-offset: 2px; }
</style>
