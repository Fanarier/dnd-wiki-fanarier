<template>
  <!-- карточки героев игрока: обложка, имя, уровень — ведут в вики. Карточки «в тени» сюда приходят только владельцу и мастеру -->
  <div class="pf-heroes">
    <router-link v-for="h in heroes" :key="h.id" class="pf-hero" :to="{ path: '/wiki', query: { hero: h.id } }">
      <img v-if="heroCover(h)" :src="heroPortraitUrl(heroCover(h).thumb || heroCover(h).file)" alt="" />
      <span v-else class="pf-hero-ini">{{ (h.name || '?')[0] }}</span>
      <span class="pf-hero-t">
        <b>{{ h.name }}</b>
        <small>{{ KIND[h.kind] || 'герой' }}<template v-if="h.kind !== 'companion' && h.level"> · ур. {{ h.level }}</template><template v-if="h.hidden"> · ☾ в тени</template><template v-if="h.canEdit && mine"> · можешь править сам</template></small>
      </span>
    </router-link>
  </div>
</template>

<script setup>
import { heroPortraitUrl, heroCover } from '../../map/store.js'

defineProps({ heroes: { type: Array, required: true }, mine: Boolean })
const KIND = { character: 'персонаж', sidekick: 'сайд-кик', companion: 'компаньон' }
</script>

<style scoped>
.pf-heroes { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(220px, 100%), 1fr)); gap: 10px; }
.pf-hero { display: flex; align-items: center; gap: 12px; min-width: 0; padding: 8px; border-radius: 12px; border: 1px solid rgba(201, 162, 79, .22); background: rgba(0, 0, 0, .18); color: #efe3c8; text-decoration: none; }
.pf-hero:hover, .pf-hero:focus-visible { border-color: rgba(231, 197, 111, .55); background: rgba(231, 197, 111, .07); outline: none; }
.pf-hero img, .pf-hero-ini { width: 52px; height: 64px; flex: none; border-radius: 8px; object-fit: cover; object-position: 50% 20%; border: 1px solid #6e4f22; }
.pf-hero-ini { display: grid; place-items: center; background: #2a2016; color: #e6c27a; font: 700 26px var(--a-serif); }
.pf-hero-t { display: grid; gap: 2px; min-width: 0; }
.pf-hero-t b { font: 700 18px/1.15 var(--a-serif); color: #f3d99a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pf-hero-t small { font: 600 12px var(--a-sans); color: #a8936c; }
</style>
