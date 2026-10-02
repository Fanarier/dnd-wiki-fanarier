<template>
  <div class="offline" role="alert">
    <div class="lamp">
      <img v-if="offlineArt" :src="offlineArt" alt="Энди спит, уткнувшись в механические руки" />
    </div>
    <h2>{{ OFFLINE_TEXT }}</h2>
    <p>Связи с сервером нет. Пробуем достучаться сами<span class="dots" /> <small v-if="store.reconnectTries > 1">попытка {{ store.reconnectTries }}</small></p>
    <button class="wake" @click="reconnectNow">Разбудить</button>
  </div>
</template>

<script setup>
import { store, reconnectNow, offlineArt } from '../map/store.js'
import { OFFLINE_TEXT } from '../shared/phrases.js'
</script>

<style scoped>
.offline {
  position: fixed; inset: 0; z-index: 700; display: grid; place-content: center; justify-items: center; gap: 10px; padding: 20px; text-align: center;
  background: radial-gradient(520px 420px at 50% 40%, rgba(255, 214, 150, .16), transparent 70%), rgba(10, 8, 6, .93);
  backdrop-filter: blur(4px); color: #efe3c8; font-family: 'Manrope', sans-serif;
  animation: appear .5s ease;
}
/* тёплое пятно лампы, на котором спит Энди */
.lamp { width: min(340px, 70vw); aspect-ratio: 1; border-radius: 50%; display: grid; place-items: center;
  background: radial-gradient(circle at 50% 55%, #f6ead2 0%, #e9d6b0 45%, rgba(233, 214, 176, 0) 70%); }
.lamp img { width: 92%; animation: breathe 4.5s ease-in-out infinite; transform-origin: 50% 80%; }
h2 { margin: 6px 0 0; font: 700 32px 'Cormorant Garamond', Georgia, serif; color: #f3d99a; }
p { margin: 0; color: #a8936c; font-size: 14px; }
small { margin-left: 6px; opacity: .8; }
.dots::after { content: '…'; display: inline-block; width: 1.2em; text-align: left; animation: dots 1.6s steps(4) infinite; overflow: hidden; vertical-align: bottom; }
.wake { margin-top: 8px; height: 38px; padding: 0 20px; border-radius: 10px; border: 1px solid #6e4f22; cursor: pointer; color: #1e150a; font: 800 14px 'Manrope', sans-serif; background: linear-gradient(180deg, #f2d58f, #c99a48 55%, #a87a33); box-shadow: inset 0 1px 0 rgba(255, 245, 210, .7), 0 3px 0 #5a3e1a; }
@keyframes breathe { 50% { transform: scale(1.025) translateY(-2px); } }
@keyframes dots { from { width: 0; } to { width: 1.2em; } }
@keyframes appear { from { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .lamp img, .dots::after { animation: none; } }
</style>
