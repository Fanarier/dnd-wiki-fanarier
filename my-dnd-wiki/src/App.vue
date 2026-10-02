<template>
  <router-view />
  <!-- экран входа поверх всего: мастер / игрок / заявка / гость -->
  <GateScreen v-if="store.gate" :key="store.gate" />
</template>

<script setup>
import { onMounted } from 'vue'
import GateScreen from './components/GateScreen.vue'
import { store, init } from './map/store.js'

onMounted(init)
</script>
