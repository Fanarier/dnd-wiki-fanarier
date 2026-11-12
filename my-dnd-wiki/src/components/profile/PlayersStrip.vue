<template>
  <!-- игроки Анкарии: аватарки со ссылкой на профиль (себя и того, чей профиль открыт, — без ссылки) -->
  <section v-if="list.length" class="pf-strip">
    <h3>{{ title }} <small>{{ list.length }}</small></h3>
    <div class="pf-strip-row">
      <router-link v-for="p in list" :key="p.id" class="pf-pl" :to="'/profile/' + p.id" :title="p.race ? `${p.character} · ${p.race}` : p.character">
        <img v-if="p.avatar" :src="avatarUrl(p.avatar)" alt="" />
        <span v-else class="pf-ini" :style="{ background: p.color }">{{ (p.character || '?')[0] }}</span>
        <b>{{ p.character }}</b>
      </router-link>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { store, avatarUrl } from '../../map/store.js'

const props = defineProps({ title: { type: String, default: 'Игроки Анкарии' }, except: { type: String, default: '' } })
const list = computed(() => (store.data.roster || [])
  .filter(p => p.character && p.id !== store.me?.id && p.id !== props.except)
  .sort((a, b) => a.character.localeCompare(b.character, 'ru')))
</script>

<style scoped>
.pf-strip { padding: 18px 20px; border-radius: 16px; background: linear-gradient(160deg, #241c13, #18130d); border: 1px solid #6e4f22; box-shadow: 0 0 0 3px #1a140e, 0 14px 30px rgba(0, 0, 0, .4); }
.pf-strip h3 { margin: 0 0 12px; font: 700 24px var(--a-serif); color: #f3d99a; }
.pf-strip h3 small { font: 600 13px var(--a-sans); color: #a8936c; margin-left: 8px; }
.pf-strip-row { display: grid; grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); gap: 8px; }
.pf-pl { display: grid; justify-items: center; gap: 6px; padding: 10px 6px; border-radius: 12px; border: 1px solid transparent; color: #efe3c8; text-decoration: none; min-width: 0; }
.pf-pl:hover, .pf-pl:focus-visible { background: rgba(231, 197, 111, .08); border-color: rgba(231, 197, 111, .3); outline: none; }
.pf-pl img, .pf-ini { width: 54px; height: 54px; border-radius: 50%; object-fit: cover; border: 2px solid #b8893f; }
.pf-ini { display: grid; place-items: center; color: #1b1408; font: 800 20px var(--a-sans); }
.pf-pl b { max-width: 100%; font: 700 12.5px var(--a-sans); text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
