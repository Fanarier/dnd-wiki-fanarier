<template>
  <!-- чужой профиль: обложка, аватар, «О себе», герои (только те, что игроку и так видны), отряд. Ни логина, ни настроек -->
  <div class="pf-pub">
    <div v-if="loading && !p" class="pf-wait"><SteamLoader kind="gate" /></div>
    <section v-else-if="err" class="pf-card pf-center">
      <h2>{{ err }}</h2>
      <router-link class="pf-btn" to="/profile">← В свой профиль</router-link>
    </section>
    <template v-else-if="p">
      <ProfileHead :p="p" />

      <section class="pf-card">
        <h3>О себе</h3>
        <RichText v-if="p.about" class="pf-about" :text="p.about" />
        <p v-else class="pf-muted">Здесь пока пусто{{ p.linked ? ' — это персонаж мастера' : '' }}.</p>
      </section>

      <section class="pf-card">
        <h3>Герои <small>{{ heroes.length || 'пока нет' }}</small></h3>
        <HeroTiles v-if="heroes.length" :heroes="heroes" />
        <p v-else class="pf-muted">Карточек в «Героях Анкарии» у этого игрока нет{{ isMaster ? '' : ' (или они пока в тени)' }}.</p>
      </section>

      <section v-if="parties.length" class="pf-card">
        <h3>Отряд</h3>
        <div class="pf-parties">
          <router-link v-for="g in parties" :key="g.id" class="pf-party" :to="{ path: '/', query: { focus: 'parties:' + g.id } }" :style="{ '--pc': g.color || '#e8b04a' }">
            <i />{{ g.name || 'Отряд' }}<small>{{ g.members.length }} {{ plural(g.members.length) }}</small>
          </router-link>
        </div>
      </section>

      <PlayersStrip title="Другие игроки" :except="p.id" />
    </template>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { store, api } from '../../map/store.js'
import SteamLoader from '../SteamLoader.vue'
import RichText from '../RichText.vue'
import ProfileHead from './ProfileHead.vue'
import HeroTiles from './HeroTiles.vue'
import PlayersStrip from './PlayersStrip.vue'

const props = defineProps({ id: { type: String, required: true } })
const p = ref(null)
const err = ref('')
const loading = ref(false)
const isMaster = computed(() => store.role === 'master')

// грузим при смене id; обновления (сменил обложку, переименовался) — тихо, по новому состоянию с сервера
let seq = 0
async function load(quiet) {
  const my = ++seq
  if (!quiet) { loading.value = true; err.value = ''; p.value = null }
  try {
    const r = await api('GET', `/api/profiles/${encodeURIComponent(props.id)}`)
    if (my === seq) { p.value = r; err.value = '' }
  } catch (e) {
    if (my === seq && !quiet) err.value = e.status === 404 ? 'Такого игрока нет — или его аккаунт ещё ждёт одобрения' : e.message
  } finally {
    if (my === seq) loading.value = false
  }
}
watch(() => props.id, () => load(false), { immediate: true })
// в списке игроков у него что-то поменялось — перечитаем профиль
watch(() => JSON.stringify(store.data.roster?.find(x => x.id === props.id) || null), (v, old) => { if (old && v !== old) load(true) })

// сервер уже прячет карточки «в тени» от всех, кроме владельца и мастера
const heroes = computed(() => (store.data.heroes || []).filter(h => h.ownerId === props.id).sort((a, b) => (a.kind === 'character' ? 0 : 1) - (b.kind === 'character' ? 0 : 1) || (a.order || 0) - (b.order || 0)))
const parties = computed(() => (store.data.parties || []).filter(g => g.members?.includes(props.id)))
const plural = n => (n % 10 === 1 && n % 100 !== 11 ? 'участник' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'участника' : 'участников')
</script>

<style scoped>
.pf-pub { display: grid; gap: 16px; }
.pf-wait { display: grid; place-items: center; min-height: 40vh; }
.pf-card { position: relative; padding: 18px 20px; border-radius: 16px; background: linear-gradient(160deg, #241c13, #18130d); border: 1px solid #6e4f22; box-shadow: 0 0 0 3px #1a140e, 0 14px 30px rgba(0, 0, 0, .4); }
.pf-center { text-align: center; display: grid; gap: 14px; justify-items: center; }
.pf-card h2, .pf-card h3 { margin: 0 0 12px; font: 700 24px var(--a-serif); color: #f3d99a; }
.pf-card h3 small { font: 600 13px var(--a-sans); color: #a8936c; margin-left: 8px; }
.pf-about { font: 500 14.5px/1.6 var(--a-sans); color: #efe3c8; }
.pf-muted { margin: 0; color: #a8936c; font-size: 13.5px; }
.pf-btn { color: #e6c27a; font-weight: 700; text-decoration: none; }
.pf-parties { display: flex; flex-wrap: wrap; gap: 8px; }
.pf-party { display: inline-flex; align-items: center; gap: 8px; padding: 7px 12px; border-radius: 10px; border: 1px solid color-mix(in srgb, var(--pc) 50%, transparent); background: color-mix(in srgb, var(--pc) 10%, transparent); color: #efe3c8; font: 700 13px var(--a-sans); text-decoration: none; }
.pf-party i { width: 10px; height: 10px; border-radius: 50%; background: var(--pc); }
.pf-party small { color: #a8936c; font-weight: 600; }
.pf-party:hover { background: color-mix(in srgb, var(--pc) 20%, transparent); }
</style>
