<template>
  <!-- загрузка: вращающийся рунный круг и подпись -->
  <div class="rl" role="status">
    <span class="fx-rune">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3 5" />
        <circle cx="50" cy="50" r="36" fill="none" stroke="currentColor" stroke-width="2" opacity=".6" />
        <g class="inner">
          <path d="M50 18 L58 50 L50 82 L42 50 Z" fill="none" stroke="currentColor" stroke-width="2" />
          <path d="M18 50 L50 44 L82 50 L50 56 Z" fill="none" stroke="currentColor" stroke-width="1.5" opacity=".7" />
        </g>
        <g class="glyph" fill="currentColor" font-size="9" font-family="serif" text-anchor="middle">
          <text x="50" y="11">ᚠ</text><text x="91" y="53">ᚱ</text><text x="50" y="96">ᛟ</text><text x="9" y="53">ᚦ</text>
          <text x="79" y="23">ᛉ</text><text x="79" y="84">ᚨ</text><text x="21" y="84">ᛗ</text><text x="21" y="23">ᛝ</text>
        </g>
      </svg>
    </span>
    <span v-if="text" class="rl-t">{{ text }}</span>
  </div>
</template>

<script setup>
defineProps({ text: { type: String, default: '' } })
</script>

<style scoped>
.rl { display: grid; justify-items: center; gap: 10px; padding: 30px; color: #a8936c; font: 600 13.5px 'Manrope', sans-serif; }
</style>
