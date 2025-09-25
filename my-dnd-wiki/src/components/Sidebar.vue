<template>
  <v-list nav dense>
    <v-subheader>Категории</v-subheader>

    <v-list-item
      v-for="cat in categories"
      :key="cat.id"
      class="touch-target"
      role="button"
      tabindex="0"
      @click="select(cat.id)"
      @keydown.enter="select(cat.id)"
      @keydown.space.prevent="select(cat.id)"
      :aria-current="cat.id === activeId ? 'true' : 'false'"
    >
      <v-list-item-content>
        <v-list-item-title class="subtitle-1">{{ cat.title }}</v-list-item-title>
        <v-list-item-subtitle v-if="cat.description" class="text--secondary">{{ cat.description }}</v-list-item-subtitle>
      </v-list-item-content>
      <v-list-item-icon>
        <v-icon v-if="cat.id === activeId">mdi-chevron-right</v-icon>
      </v-list-item-icon>
    </v-list-item>

    <v-divider class="my-2" />

    <v-list-item class="touch-target" role="status" aria-live="polite">
      <v-list-item-content>
        <v-list-item-title>Всего категорий: {{ categories.length }}</v-list-item-title>
      </v-list-item-content>
    </v-list-item>
  </v-list>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  categories: {
    type: Array,
    required: true,
    default: () => []
  },
  initialActive: {
    type: String,
    required: false,
    default: null
  }
})

const emit = defineEmits(['select'])

const activeId = ref(props.initialActive ?? (props.categories[0]?.id ?? null))

// Обновляем activeId при изменении входных данных
watch(() => props.initialActive, (v) => {
  if (v) activeId.value = v
})

// Функция выбора категории
function select(id) {
  activeId.value = id
  emit('select', id)
}
</script>

<style scoped>
.touch-target {
  min-height: 48px;
  padding: 10px 12px;
  display: flex;
  align-items: center;
  cursor: pointer;
  user-select: none;
  transition: transform 160ms ease, box-shadow 160ms ease;
  border-radius: 8px;
}

.touch-target:focus {
  outline: none;
  box-shadow: 0 0 0 4px rgba(25, 118, 210, 0.12);
}

.touch-target:hover {
  transform: translateY(-2px);
}

.v-list-item-subtitle {
  font-size: 0.85rem;
}

.v-subheader {
  font-weight: 600;
  color: rgba(0,0,0,0.7);
}
</style>
