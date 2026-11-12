<template>
  <!-- шапка профиля: обложка (полоса 3:1), аватар на её краю, имя и короткие сведения. Свой профиль — обложку и аватар меняют прямо здесь -->
  <section class="pf-head">
    <div class="pf-banner" :class="{ empty: !p.banner }">
      <img v-if="p.banner" :src="avatarUrl(p.banner)" alt="" />
      <div v-if="editable" class="pf-banner-acts">
        <label class="pf-chip" :class="{ busy }">
          🖼 {{ p.banner ? 'Сменить обложку' : 'Поставить обложку' }}
          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden :disabled="busy" @change="pickBanner" />
        </label>
        <button v-if="p.banner" type="button" class="pf-chip" :disabled="busy" @click="dropBanner">Убрать</button>
      </div>
    </div>

    <div class="pf-id">
      <component :is="editable ? 'label' : 'div'" class="pf-av" :class="{ edit: editable }" :title="editable ? 'Сменить аватарку' : ''">
        <img v-if="p.avatar" :src="avatarUrl(p.avatar)" alt="" />
        <span v-else :style="{ background: p.color || '#e7c56f' }">{{ (p.name || '?')[0] }}</span>
        <template v-if="editable">
          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden :disabled="busy" @change="pickAvatar" />
          <em>сменить</em>
        </template>
      </component>
      <div class="pf-names">
        <h1>{{ p.name }}</h1>
        <div class="pf-meta">
          <span>{{ roleLabel }}</span>
          <span v-if="p.race">· {{ p.race }}</span>
          <b v-if="rank" class="pf-rank" :style="{ background: rank.color, color: rank.text }">{{ rank.label }}</b>
          <span v-if="p.since" class="pf-since">· в Анкарии с {{ since }}</span>
        </div>
        <button v-if="editable && p.avatar" type="button" class="pf-link" :disabled="busy" @click="dropAvatar">убрать аватарку</button>
      </div>
      <slot />
    </div>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import { avatarUrl, uploadBanner, cropAvatar, updateProfile, toast } from '../../map/store.js'
import { RANKS } from '../../shared/catalog.js'

// p: { name, avatar, color, banner, race, rank, since, master, linked }; editable — это свой профиль
const props = defineProps({ p: { type: Object, required: true }, editable: Boolean })
const rank = computed(() => (props.p.master ? null : RANKS.find(r => r.key === props.p.rank) || null))
const roleLabel = computed(() => (props.p.master ? '♛ Мастер' : props.p.linked ? '⚔ Персонаж мастера' : '⚔ Игрок'))
const since = computed(() => new Date(props.p.since).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }))

const busy = ref(false)
async function run(fn, ok) {
  busy.value = true
  try { if ((await fn()) !== null && ok) toast(ok) } catch (e) { toast(e.message, 'error') } finally { busy.value = false }
}
function pickBanner(e) {
  const file = e.target.files[0]
  e.target.value = ''
  if (file) run(() => uploadBanner(file), 'Обложка обновлена')
}
const dropBanner = () => run(() => updateProfile({ banner: null }), 'Обложка убрана')
function pickAvatar(e) {
  const file = e.target.files[0]
  e.target.value = ''
  if (file) run(async () => { const avatar = await cropAvatar(file); return avatar && updateProfile({ avatar }) }, 'Аватарка обновлена')
}
const dropAvatar = () => run(() => updateProfile({ avatar: null }), 'Аватарка убрана')
</script>

<style scoped>
.pf-head { position: relative; border-radius: 16px; overflow: hidden; background: linear-gradient(160deg, #241c13, #18130d); border: 1px solid #6e4f22; box-shadow: 0 0 0 3px #1a140e, 0 14px 30px rgba(0, 0, 0, .4); }
/* обложка 3:1; без картинки — латунная гравировка */
.pf-banner { position: relative; aspect-ratio: 3 / 1; background: #120e09; border-bottom: 1px solid #6e4f22; }
.pf-banner img { width: 100%; height: 100%; object-fit: cover; display: block; }
.pf-banner.empty { background:
  radial-gradient(600px 200px at 30% 0%, rgba(231, 197, 111, .18), transparent 70%),
  repeating-linear-gradient(135deg, rgba(231, 197, 111, .05) 0 2px, transparent 2px 14px),
  linear-gradient(180deg, #2a2016, #15100b); }
.pf-banner::after { content: ''; position: absolute; inset: auto 0 0; height: 45%; background: linear-gradient(transparent, rgba(15, 12, 9, .75)); pointer-events: none; }
.pf-banner-acts { position: absolute; z-index: 2; top: 10px; right: 10px; display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
.pf-chip { display: inline-flex; align-items: center; gap: 4px; padding: 6px 12px; border-radius: 99px; border: 1px solid rgba(231, 197, 111, .5); background: rgba(15, 12, 9, .72); backdrop-filter: blur(4px); color: #f3d99a; font: 700 12.5px var(--a-sans); cursor: pointer; }
.pf-chip:hover { background: rgba(40, 30, 18, .9); }
.pf-chip.busy, .pf-chip:disabled { opacity: .6; cursor: wait; }
.pf-id { position: relative; display: flex; align-items: flex-end; gap: 18px; padding: 0 20px 18px; margin-top: -54px; flex-wrap: wrap; }
.pf-av { position: relative; z-index: 2; width: 116px; height: 116px; flex: none; border-radius: 50%; overflow: hidden; border: 4px solid #b8893f; box-shadow: 0 0 0 3px #3a2a16, 0 8px 18px rgba(0, 0, 0, .5); background: #120e09; }
.pf-av.edit { cursor: pointer; }
.pf-av img, .pf-av span { width: 100%; height: 100%; object-fit: cover; display: grid; place-items: center; font: 700 48px var(--a-serif); color: #1b1408; }
.pf-av em { position: absolute; inset: auto 0 0; padding: 4px 0 9px; text-align: center; font: 800 11px var(--a-sans); font-style: normal; color: #fff; background: rgba(0, 0, 0, .55); opacity: 0; transition: opacity .2s; }
.pf-av.edit:hover em, .pf-av.edit:focus-within em { opacity: 1; }
.pf-names { flex: 1; min-width: 0; padding-bottom: 4px; display: grid; gap: 4px; justify-items: start; }
.pf-names h1 { margin: 0; font: 700 32px/1.1 var(--a-serif); color: #f3d99a; overflow-wrap: anywhere; text-shadow: 0 2px 8px rgba(0, 0, 0, .6); }
.pf-meta { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font: 600 13px var(--a-sans); color: #a8936c; }
.pf-rank { padding: 1px 10px; border-radius: 4px; font-weight: 800; font-size: 12px; }
.pf-link { background: none; border: 0; padding: 0; color: #a8936c; font: 600 12px var(--a-sans); cursor: pointer; text-decoration: underline; }
@media (max-width: 640px) {
  /* телефон: аватар на краю обложки, имя и сведения — под ним во всю ширину */
  .pf-id { flex-direction: column; align-items: flex-start; margin-top: -44px; gap: 10px; padding: 0 14px 14px; }
  .pf-names { width: 100%; }
  .pf-av { width: 88px; height: 88px; }
  .pf-names h1 { font-size: 26px; }
  .pf-chip { padding: 5px 10px; font-size: 12px; }
}
@media (prefers-reduced-motion: reduce) { .pf-av em { transition: none; } }
</style>
