<template>
  <nav class="side" aria-label="Разделы вики">
    <div class="side-kicker">Разделы</div>
    <button
      v-for="cat in categories"
      :key="cat.id"
      class="side-item"
      :class="{ active: cat.id === activeId }"
      :aria-current="cat.id === activeId ? 'page' : undefined"
      @click="select(cat.id)"
    >
      <span class="side-title">{{ cat.title }}</span>
      <span v-if="cat.description" class="side-desc">{{ cat.description }}</span>
    </button>
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
.side { display: flex; flex-direction: column; gap: 4px; }
.side-kicker { font-size: 11px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: var(--a-muted); margin: 0 0 8px 10px; }
.side-item { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; text-align: left; padding: 10px 12px; border-radius: 10px; border: 1px solid transparent; background: none; color: var(--a-text); cursor: pointer; transition: background .15s, border-color .15s; font-family: var(--a-sans); }
.side-item:hover { background: rgba(255, 255, 255, 0.04); }
.side-item.active { background: rgba(231, 197, 111, 0.1); border-color: rgba(231, 197, 111, 0.35); }
.side-item.active .side-title { color: var(--a-gold-2); }
.side-title { font-weight: 700; font-size: 14px; }
.side-desc { font-size: 12px; color: var(--a-muted); line-height: 1.35; }
.side-foot { margin: 12px 0 0 10px; font-size: 12px; color: var(--a-muted); }
.side-item:focus-visible { outline: 2px solid var(--a-gold); outline-offset: 2px; }
</style>
