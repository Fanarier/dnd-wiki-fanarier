<template>
  <router-view />
  <!-- экран входа поверх всего: мастер / игрок / заявка / гость -->
  <GateScreen v-if="store.gate && !store.offline" :key="store.gate" />
  <!-- нет связи с сервером дольше 5 секунд -->
  <OfflineScreen v-if="store.offline" />
  <!-- сайт обновили, а вкладка открыта со старой версией -->
  <div v-if="store.newVersion" class="app-update" role="status">
    <span>⚙ Энди выкатил обновление сайта</span>
    <button @click="reload">Обновить</button>
  </div>
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
const reload = () => location.reload()
onMounted(init)
</script>

<style>
.app-toasts { position: fixed; z-index: 300; top: 76px; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 6px; width: max-content; max-width: calc(100vw - 32px); pointer-events: none; }
.app-toast { padding: 9px 16px; border-radius: 12px; background: rgba(23, 19, 14, .96); border: 1px solid #8a6630; box-shadow: 0 10px 30px rgba(0, 0, 0, .5); color: #efe3c8; font: 600 13px 'Manrope', sans-serif; text-align: center; }
.app-toast.error { border-color: rgba(255, 107, 94, .6); color: #ffc2bb; }
.app-update { position: fixed; z-index: 320; left: 50%; bottom: 18px; transform: translateX(-50%); display: flex; align-items: center; gap: 12px; max-width: calc(100vw - 32px); padding: 8px 8px 8px 16px; border-radius: 14px; background: rgba(23, 19, 14, .97); border: 1px solid #b8893f; box-shadow: 0 0 0 3px #2a2117, 0 14px 40px rgba(0, 0, 0, .6); color: #efe3c8; font: 600 13px 'Manrope', sans-serif; animation: app-up .4s cubic-bezier(.2, .9, .3, 1.2); }
.app-update button { flex: none; height: 32px; padding: 0 14px; border-radius: 9px; border: 1px solid #6e4f22; cursor: pointer; color: #1e150a; font: 800 13px 'Manrope', sans-serif; background: linear-gradient(180deg, #f2d58f, #c99a48 55%, #a87a33); }
@keyframes app-up { from { opacity: 0; transform: translate(-50%, 20px); } }
.app-toast-enter-active, .app-toast-leave-active { transition: opacity .25s, transform .25s; }
.app-toast-enter-from, .app-toast-leave-to { opacity: 0; transform: translateY(-8px); }
</style>
