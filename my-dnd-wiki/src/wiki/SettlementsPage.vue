<template>
  <div class="stp">
    <header class="stp-head">
      <h2><img src="/settlement/medieval-village-01.png" alt="" class="stp-ico" />Поселения</h2>
      <div class="subtitle-1">Земли, которые основали и держат наши герои. Внутри — своя карта, жители, стройка и журнал событий.</div>
    </header>

    <div v-if="!store.ready" class="stp-load"><SteamLoader kind="board" /></div>
    <p v-else-if="!list.length" class="stp-empty">Поселений пока нет.</p>

    <article v-for="x in list" :key="x.s.id" class="stp-card">
      <div class="stp-top">
        <img class="crest" src="/settlement/medieval-village-01.png" alt="" />
        <div class="ttl">
          <h3>{{ x.s.name }}</h3>
          <div class="sub">{{ x.s.kind }} · <span class="ok">{{ x.s.status }}</span>
            <router-link v-if="x.city" :to="{ path: '/', query: { focus: 'cities:' + x.city.id } }">на карте мира</router-link>
          </div>
        </div>
      </div>

      <div class="nums">
        <div><b>{{ x.c.population }}</b><small>жителей</small></div>
        <div><b>{{ x.c.morale }}</b><small>мораль</small></div>
        <div><b>{{ x.c.stability }}</b><small>стабильность</small></div>
        <div :class="{ warn: x.c.threat > 0 }"><b>{{ x.c.threat }}</b><small>угрозы</small></div>
        <div><b>{{ x.built }}</b><small>построек</small></div>
        <div v-if="x.s.day"><b>{{ x.s.day }}</b><small>день</small></div>
      </div>

      <div class="who">
        <span>Глава:
          <router-link v-if="x.head" :to="{ path: '/wiki', query: { hero: x.head.id } }">{{ x.head.name }}</router-link>
          <b v-else>—</b>
        </span>
        <span v-if="x.mine" class="me">✦ ты принимаешь решения за поселение</span>
      </div>

      <div class="acts">
        <router-link class="enter" :to="`/settlement/${x.s.id}`">Войти в поселение <span aria-hidden="true">→</span></router-link>
        <router-link class="q" :to="{ path: `/settlement/${x.s.id}`, query: { tab: 'journal' } }">Журнал<em v-if="x.waiting">{{ x.waiting }}</em></router-link>
        <router-link class="q" :to="{ path: `/settlement/${x.s.id}`, query: { tab: 'orders' } }">Приказы<em v-if="x.pending">{{ x.pending }}</em></router-link>
        <router-link class="q" :to="{ path: `/settlement/${x.s.id}`, query: { tab: 'history' } }">История</router-link>
      </div>
    </article>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { store, isMaster } from '../map/store.js'
import { computeSettlement } from '../shared/settlement.js'
import SteamLoader from '../components/SteamLoader.vue'

const list = computed(() => (store.data.settlements || []).map(s => ({
  s,
  c: computeSettlement(s),
  city: s.cityId && store.data.cities?.find(c => c.id === s.cityId),
  head: store.data.heroes?.find(h => h.id === s.headHeroId) || null,
  built: (s.buildings || []).filter(b => b.state === 'built').length,
  mine: !!store.me && s.deciders?.includes(store.me.id),
  // ждут решения главы; приказы на рассмотрении — счётчик видит мастер
  waiting: (s.events || []).filter(e => e.duration?.includes('decide') && !e.decision).length,
  pending: isMaster.value ? (s.orders || []).filter(o => o.status === 'pending').length : 0
})))
</script>

<style scoped>
.stp { font-family: 'Manrope', sans-serif; color: #efe3c8; }
.stp-head { margin-bottom: 18px; }
.stp-head h2 { display: flex; align-items: center; gap: 10px; }
.stp-ico { width: 34px; height: 34px; padding: 4px; border-radius: 9px; background: #d6d2c8; }
.stp-load { display: grid; place-items: center; min-height: 30vh; }
.stp-empty { color: #9d978b; }
.stp-card { max-width: 760px; padding: 18px 20px; margin-bottom: 18px; border-radius: 18px; background: linear-gradient(170deg, #241c13, #16110c); border: 1px solid #6e4f22; box-shadow: 0 0 0 3px #1a140e, 0 0 0 4px rgba(201, 162, 79, .3), 0 18px 40px rgba(0, 0, 0, .35); }
.stp-top { display: flex; align-items: center; gap: 14px; }
.crest { width: 64px; height: 64px; padding: 7px; border-radius: 16px; background: #d6d2c8; border: 2px solid #b06cff; flex: none; }
.ttl h3 { margin: 0; font: 700 34px/1 'Cormorant Garamond', Georgia, serif; color: #f3d99a; }
.sub { margin-top: 5px; color: #b9ab8a; font-size: 13px; font-weight: 600; }
.sub .ok { color: #9be07a; }
.sub a { margin-left: 8px; color: #e6c27a; font-size: 12px; }
.nums { display: grid; grid-template-columns: repeat(auto-fit, minmax(92px, 1fr)); gap: 6px; margin-top: 14px; }
.nums div { display: grid; justify-items: center; padding: 8px 4px; border-radius: 11px; background: rgba(0, 0, 0, .25); border: 1px solid rgba(201, 162, 79, .18); }
.nums b { font: 700 24px/1.1 'Cormorant Garamond', Georgia, serif; color: #f3d99a; }
.nums small { font-size: 11px; color: #a8936c; font-weight: 700; }
.nums .warn b { color: #ffb36b; }
.who { display: flex; flex-wrap: wrap; gap: 6px 16px; margin-top: 12px; font-size: 13px; color: #b9ab8a; font-weight: 600; }
.who a { color: #f3d99a; font-weight: 800; text-decoration: underline dotted; text-underline-offset: 3px; }
.who .me { color: #e6c27a; }
.acts { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
.enter { padding: 10px 18px; border-radius: 12px; background: linear-gradient(180deg, #f0d083, #c9a24f); color: #1b1408 !important; font: 800 14px 'Manrope', sans-serif; text-decoration: none; box-shadow: 0 6px 18px rgba(201, 162, 79, .25); transition: transform .15s, box-shadow .15s; }
.enter:hover { transform: translateY(-1px); box-shadow: 0 8px 22px rgba(201, 162, 79, .35); }
.enter span { display: inline-block; transition: transform .15s; }
.enter:hover span { transform: translateX(3px); }
.q { display: inline-flex; align-items: center; gap: 6px; padding: 10px 14px; border-radius: 12px; border: 1px solid rgba(231, 197, 111, .3); background: rgba(231, 197, 111, .06); color: #efe3c8 !important; font: 700 13px 'Manrope', sans-serif; text-decoration: none; }
.q:hover { background: rgba(231, 197, 111, .14); }
.q em { font-style: normal; min-width: 18px; padding: 0 6px; border-radius: 99px; background: #e0281e; color: #fff; font-size: 11px; line-height: 18px; text-align: center; }
@media (max-width: 600px) {
  .stp-card { padding: 14px; }
  .ttl h3 { font-size: 28px; }
  .enter { flex-basis: 100%; text-align: center; }
}
</style>
