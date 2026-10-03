<template>
  <router-view />
  <!-- экран входа поверх всего: мастер / игрок / заявка / гость -->
  <GateScreen v-if="store.gate && !store.offline" :key="store.gate" />
  <!-- нет связи с сервером дольше 5 секунд -->
  <OfflineScreen v-if="store.offline" />
  <!-- всплывающие сообщения вне карты (у карты свои, под верхней панелью) -->
  <div v-if="route.path !== '/'" class="app-toasts" aria-live="polite">
    <transition-group name="app-toast">
      <div v-for="t in store.toasts" :key="t.id" class="app-toast" :class="t.kind">{{ t.text }}</div>
    </transition-group>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'
import GateScreen from './components/GateScreen.vue'
import OfflineScreen from './components/OfflineScreen.vue'
import { store, init } from './map/store.js'

const route = useRoute()
onMounted(init)
</script>

<style>
.app-toasts { position: fixed; z-index: 300; top: 76px; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 6px; width: max-content; max-width: calc(100vw - 32px); pointer-events: none; }
.app-toast { padding: 9px 16px; border-radius: 12px; background: rgba(23, 19, 14, .96); border: 1px solid #8a6630; box-shadow: 0 10px 30px rgba(0, 0, 0, .5); color: #efe3c8; font: 600 13px 'Manrope', sans-serif; text-align: center; }
.app-toast.error { border-color: rgba(255, 107, 94, .6); color: #ffc2bb; }
.app-toast-enter-active, .app-toast-leave-active { transition: opacity .25s, transform .25s; }
.app-toast-enter-from, .app-toast-leave-to { opacity: 0; transform: translateY(-8px); }
</style>
