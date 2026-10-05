<template>
  <div class="sp">
    <header class="sp-top">
      <router-link to="/" class="sp-brand">
        <svg class="sigil" viewBox="0 0 32 32" aria-hidden="true">
          <circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" stroke-width="1.5" />
          <path d="M16 3 L19 16 L16 29 L13 16 Z" fill="currentColor" />
          <path d="M3 16 L16 13.5 L29 16 L16 18.5 Z" fill="currentColor" opacity=".55" />
        </svg>
        <span>Анкария</span>
      </router-link>
      <nav class="sp-tabs">
        <router-link to="/" class="sp-tab">Карта</router-link>
        <router-link to="/wiki" class="sp-tab">Вики</router-link>
        <router-link :to="`/settlement/${s?.id || ''}`" class="sp-tab active">Поселение</router-link>
      </nav>
      <span class="grow" />
      <UserMenu />
    </header>

    <div v-if="!store.ready" class="sp-load"><SteamLoader kind="map" /></div>
    <div v-else-if="!s" class="sp-load">Поселение не найдено</div>
    <div v-else class="sp-body">
      <SettlementMap class="sp-map" :settlement="s" :calc="calc" :selected="sel" @select="sel = $event" />

      <aside class="sp-panel">
        <!-- шапка поселения -->
        <section class="sp-head">
          <div class="sp-title">
            <img class="sp-crest" src="/settlement/medieval-village-01.png" alt="" />
            <div>
              <h1>{{ s.name }}</h1>
              <div class="sp-sub">{{ s.kind }} · <span class="sp-status">{{ s.status }}</span>
                <router-link v-if="city" class="sp-onmap" :to="{ path: '/', query: { focus: 'cities:' + city.id } }">на карте мира</router-link>
              </div>
            </div>
          </div>
          <div class="sp-quick">
            <div><b>{{ calc.population }}</b><small>жителей</small></div>
            <div><b>{{ calc.morale }}</b><small>мораль</small></div>
            <div><b>{{ calc.stability }}</b><small>стабильность</small></div>
            <div :class="{ warn: calc.threat > 0 }"><b>{{ calc.threat }}</b><small>угрозы</small></div>
          </div>
        </section>

        <!-- выбранная на карте постройка или аванпост -->
        <BuildingCard v-if="selItem" :settlement="s" :calc="calc" :sel="sel" :item="selItem" @close="sel = null" />

        <nav class="sp-tabbar">
          <button v-for="tb in TABS" :key="tb.id" :class="{ on: tab === tb.id }" @click="setTab(tb.id)">
            {{ tb.label }}<i v-if="tb.dot" class="dot" />
          </button>
        </nav>
        <SettlementTabs :tab="tab" :settlement="s" :calc="calc" @pick="sel = $event" />
        <p class="sp-credit">Значки: game-icons.net (CC BY 3.0)</p>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import UserMenu from '../components/UserMenu.vue'
import SteamLoader from '../components/SteamLoader.vue'
import SettlementMap from './SettlementMap.vue'
import SettlementTabs from './SettlementTabs.vue'
import BuildingCard from './BuildingCard.vue'
import { store } from '../map/store.js'
import { computeSettlement } from '../shared/settlement.js'

const route = useRoute()
const router = useRouter()
const s = computed(() => {
  const list = store.data.settlements || []
  return list.find(x => x.id === route.params.id) || (!route.params.id ? list[0] : null)
})
const calc = computed(() => computeSettlement(s.value || {}))
const city = computed(() => s.value?.cityId && store.data.cities?.find(c => c.id === s.value.cityId))
watch(s, v => { if (v) document.title = `${v.name} — Анкария` }, { immediate: true })

const sel = ref(null)
const selItem = computed(() => {
  if (!sel.value || !s.value) return null
  const list = sel.value.kind === 'outpost' ? s.value.outposts : s.value.buildings
  return list?.find(x => x.id === sel.value.id) || null
})

const tab = ref(route.query.tab || 'overview')
const TABS = computed(() => [
  { id: 'overview', label: 'Обзор' },
  { id: 'resources', label: 'Ресурсы', dot: Object.values(calc.value.balance).some(v => v < 0) },
  { id: 'residents', label: 'Жители' },
  { id: 'jobs', label: 'Работы' },
  { id: 'assets', label: 'Активы' },
  { id: 'outposts', label: 'Аванпосты' },
  { id: 'journal', label: 'Журнал', dot: (s.value?.events || []).some(e => e.duration?.includes('decide') && !e.decision) }
])
function setTab(id) {
  tab.value = id
  router.replace({ query: { ...route.query, tab: id === 'overview' ? undefined : id } })
}
</script>

<style scoped>
.sp { min-height: 100vh; background: radial-gradient(1200px 600px at 20% -10%, #1b2333 0%, var(--a-bg) 60%) fixed; color: var(--a-text); font-family: var(--a-sans); }
.sp-top { position: sticky; top: 0; z-index: 20; display: flex; align-items: center; gap: 18px; height: 64px; padding: 0 22px; background: rgba(13, 16, 23, .9); backdrop-filter: blur(12px); border-bottom: 1px solid var(--a-line); }
.sp-brand { display: flex; align-items: center; gap: 10px; color: var(--a-gold-2); text-decoration: none; font: 700 24px var(--a-serif); }
.sigil { width: 28px; height: 28px; color: var(--a-gold); }
.sp-tabs { display: flex; gap: 4px; padding: 3px; border-radius: 11px; background: rgba(255, 255, 255, .04); border: 1px solid rgba(255, 255, 255, .06); }
.sp-tab { padding: 6px 14px; border-radius: 8px; color: var(--a-muted); text-decoration: none; font-weight: 700; font-size: 13px; }
.sp-tab:hover { color: var(--a-text); }
.sp-tab.active { background: rgba(231, 197, 111, .16); color: var(--a-gold-2); }
.grow { flex: 1; }
.sp-load { display: grid; place-items: center; min-height: 70vh; color: var(--a-muted); }

.sp-body { display: grid; grid-template-columns: minmax(0, 1fr) 460px; height: calc(100vh - 64px); }
.sp-map { height: 100%; border-right: 1px solid var(--a-line); }
.sp-panel { overflow-y: auto; padding: 18px 18px 30px; scrollbar-width: thin; }

.sp-head { padding: 14px 16px; border-radius: 16px; background: linear-gradient(170deg, #241c13, #16110c); border: 1px solid #6e4f22; box-shadow: 0 0 0 3px #1a140e, 0 0 0 4px rgba(201, 162, 79, .3); }
.sp-title { display: flex; align-items: center; gap: 12px; }
.sp-crest { width: 52px; height: 52px; padding: 6px; border-radius: 14px; background: #d6d2c8; border: 2px solid #b06cff; }
.sp-title h1 { margin: 0; font: 700 32px/1 var(--a-serif); color: var(--a-gold-2); }
.sp-sub { margin-top: 4px; color: #b9ab8a; font-size: 13px; font-weight: 600; }
.sp-status { color: #9be07a; }
.sp-onmap { margin-left: 8px; color: var(--a-gold); font-size: 12px; }
.sp-quick { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-top: 12px; }
.sp-quick div { display: grid; justify-items: center; padding: 7px 4px; border-radius: 10px; background: rgba(0, 0, 0, .25); border: 1px solid rgba(201, 162, 79, .18); }
.sp-quick b { font: 700 22px/1.1 var(--a-serif); color: #f3d99a; }
.sp-quick small { font-size: 11px; color: #a8936c; font-weight: 700; }
.sp-quick .warn b { color: #ffb36b; }

.sp-tabbar { position: sticky; top: -18px; z-index: 5; display: flex; flex-wrap: wrap; gap: 4px; margin: 14px -18px 12px; padding: 10px 18px 8px; background: rgba(13, 16, 23, .94); backdrop-filter: blur(8px); border-bottom: 1px solid var(--a-line); }
.sp-tabbar button { position: relative; padding: 6px 11px; border-radius: 9px; border: 1px solid transparent; background: none; color: var(--a-muted); font: 700 13px var(--a-sans); cursor: pointer; }
.sp-tabbar button:hover { color: var(--a-text); }
.sp-tabbar button.on { background: rgba(231, 197, 111, .14); border-color: rgba(231, 197, 111, .35); color: var(--a-gold-2); }
.dot { position: absolute; top: 3px; right: 3px; width: 7px; height: 7px; border-radius: 50%; background: #ff6b5b; }
.sp-credit { margin-top: 24px; color: #6d675b; font-size: 11px; text-align: center; }

@media (max-width: 900px) {
  .sp-top { gap: 10px; padding: 0 12px; }
  .sp-brand span { display: none; }
  .sp-body { grid-template-columns: 1fr; height: auto; }
  .sp-map { height: 58vh; border-right: 0; border-bottom: 1px solid var(--a-line); }
  .sp-panel { overflow: visible; padding: 14px 12px 30px; }
  .sp-tabbar { top: 64px; margin: 14px -12px 12px; padding: 10px 12px 8px; }
}
</style>
