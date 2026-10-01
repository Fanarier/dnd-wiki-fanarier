<template>
  <svg class="ico" :width="size" :height="size" viewBox="0 0 24 24" aria-hidden="true">
    <path :d="ICONS[name] || ICONS.help" fill="currentColor" />
  </svg>
</template>

<script setup>
import { ICONS } from './icons.js'
defineProps({ name: { type: String, required: true }, size: { type: [Number, String], default: 20 } })
</script>

<style scoped>
.ico { display: inline-block; flex: none; vertical-align: middle; }
</style>
