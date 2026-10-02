<template>
  <router-view />
  <!-- экран входа поверх всего: мастер / игрок / заявка / гость -->
  <GateScreen v-if="store.gate && !store.offline" :key="store.gate" />
  <!-- нет связи с сервером дольше 5 секунд -->
  <OfflineScreen v-if="store.offline" />
</template>

<script setup>
import { onMounted } from 'vue'
import GateScreen from './components/GateScreen.vue'
import OfflineScreen from './components/OfflineScreen.vue'
import { store, init } from './map/store.js'

onMounted(init)
</script>
