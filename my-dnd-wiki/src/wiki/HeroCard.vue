<template>
  <div class="slot" :id="'hero-' + hero.id"
       :class="[hero.kind, { flip, mine, shade: hero.hidden, pulse, unique: hero.kind === 'companion' && hero.rarity === 'unique' }]"
       :style="{ '--gc': gc, '--rc': rarity?.color, animationDelay: delay + 'ms' }"
       @mousemove="tilt" @mouseleave="untilt">
    <div class="card" :style="tiltStyle">
      <!-- ===== лицо ===== -->
      <div class="face front">
        <i class="rivet a" /><i class="rivet b" /><i class="rivet c" /><i class="rivet d" /><i class="stripe" />
        <div class="port">
          <img v-if="hero.portrait" :src="heroPortraitUrl(hero.portrait)" alt="" loading="lazy" />
          <div v-else class="ph">{{ initial }}</div>
          <div v-if="hero.kind !== 'companion'" class="lvl"><div><small>УР.</small>{{ hero.level }}</div></div>
          <div v-if="hero.kind !== 'companion'" class="bm"><small>БМ</small>{{ hero.bm || '—' }}</div>
          <div v-else class="rar">{{ rarity.label }}</div>
          <div v-if="hero.kind === 'sidekick' && hero.status" :key="hero.status" class="stamp">{{ hero.status }}</div>
          <div v-if="hero.hidden" class="shade-tag" title="Игроки её не видят">☾ в тени</div>
          <img v-if="owner && !mine" class="owner-av" :src="avatarUrl(owner.avatar)" :title="`Персонаж игрока ${owner.character}`" alt="" />
          <div class="name">
            {{ hero.name }}
            <span v-if="hero.kind === 'character' && mine" class="sub me">✦ твой персонаж{{ hero.canEdit ? ' · можно править' : '' }}</span>
            <span v-else-if="hero.kind === 'sidekick'" class="sub sk">сайд-кик</span>
            <span v-else-if="hero.kind === 'companion' && keeper" class="sub">
              <svg viewBox="0 0 24 24"><path :d="PAW" fill="currentColor" /></svg> хозяин:
              <a href="#" @click.prevent="$emit('focus', keeper.id)">{{ keeper.name }}</a>
            </span>
          </div>
          <button v-if="canEdit" class="edit" title="Изменить карточку" @click.stop="$emit('edit', hero)">✎</button>
        </div>

        <div v-if="hero.kind === 'character'" class="stam" :title="`Выносливость ${hero.stamina} из ${hero.staminaMax}`">
          <span class="k">Выносл.</span>
          <div class="gauge"><i :style="{ width: staminaPct + '%' }" /></div>
          <b>{{ hero.stamina === hero.staminaMax ? hero.staminaMax : `${hero.stamina} / ${hero.staminaMax}` }}</b>
        </div>

        <div class="rows">
          <div class="row">
            <svg viewBox="0 0 24 24"><path :d="PIN" fill="currentColor" /></svg><span class="k">Локация</span>
            <router-link v-if="city" class="v link" :to="{ path: '/', query: { focus: 'cities:' + city.id } }" title="Показать на карте">{{ hero.location }}</router-link>
            <span v-else class="v">{{ hero.location || '—' }}</span>
          </div>
          <div class="row"><svg viewBox="0 0 24 24"><path :d="HOME" fill="currentColor" /></svg><span class="k">Жильё</span><span class="v">{{ hero.housing || '—' }}</span></div>
          <div class="row"><svg viewBox="0 0 24 24"><path :d="FLAG" fill="currentColor" /></svg><span class="k">Группа</span><span class="v grp">{{ noGroup ? 'Нет' : hero.group }}</span></div>
          <div v-if="hero.kind === 'companion'" class="row"><i class="sp" /><span class="k">БМ</span><span class="v">{{ hero.bm || '—' }}</span></div>
        </div>

        <div class="sect">
          <h4>Статус</h4>
          <div class="row"><span class="k">Болезнь</span><HexPips :value="hero.illness" :max="ILLNESS_MAX" color="#e8473b" :size="14" /></div>
          <div class="fx">
            <span v-if="hero.effectPlus" class="p">+ {{ hero.effectPlus }}</span>
            <span v-if="hero.effectMinus" class="m">− {{ hero.effectMinus }}</span>
            <span v-if="!hero.effectPlus && !hero.effectMinus" class="e">эффектов нет</span>
          </div>
        </div>
        <button v-if="hero.kind === 'character'" class="turn" @click.stop="turn">↻ Расходы и отношения</button>
      </div>

      <!-- ===== оборот (только персонажи) ===== -->
      <div v-if="hero.kind === 'character'" class="face back">
        <i class="rivet a" /><i class="rivet b" /><i class="rivet c" /><i class="rivet d" /><i class="stripe" />
        <div class="b-title">{{ hero.name }}</div>
        <div class="b-sub">ур. {{ hero.level }} · {{ hero.location || 'где-то в Анкарии' }}</div>
        <div v-if="flip" class="sect">
          <h4>Расходы</h4>
          <div class="kv">
            <template v-for="(label, key) in EXPENSES" :key="key">
              <span class="k">{{ label }}</span><HexPips :value="hero.expenses?.[key] || 0" :max="hero.expensesMax || 5" :size="15" />
            </template>
          </div>
        </div>
        <div v-if="flip" class="sect rels">
          <h4>Отношения</h4>
          <div v-if="!relations.length" class="e">пока ни с кем</div>
          <div v-for="(r, i) in relations" :key="i" class="rel">
            <div class="who">
              <a v-if="r.hero" href="#" @click.prevent="$emit('focus', r.hero.id)">{{ r.name }}</a>
              <span v-else>{{ r.name }}</span>
              <small>{{ r.level >= REL_LEVELS && r.points >= REL_CELL ? 'максимум' : `${r.points} / ${REL_CELL}` }}</small>
            </div>
            <HexPips :value="r.level" :max="REL_LEVELS" color="#ff86b8" :size="14" />
            <div class="relbar"><i :style="{ width: (r.points / REL_CELL) * 100 + '%' }" /></div>
          </div>
        </div>
        <button class="turn" @click.stop="turn">↻ Назад</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { mdiMapMarker, mdiHome, mdiFlag, mdiPaw } from '@mdi/js'
import HexPips from './HexPips.vue'
import { store, heroPortraitUrl, avatarUrl } from '../map/store.js'
import { RARITY, ILLNESS_MAX, REL_LEVELS, REL_CELL, EXPENSES, groupColor, isNoGroup } from '../shared/catalog.js'

const props = defineProps({
  hero: { type: Object, required: true },
  canEdit: { type: Boolean, default: false },
  delay: { type: Number, default: 0 },
  pulse: { type: Boolean, default: false }
})
defineEmits(['edit', 'focus'])
const PIN = mdiMapMarker, HOME = mdiHome, FLAG = mdiFlag, PAW = mdiPaw

const mine = computed(() => !!store.me && props.hero.ownerId === store.me.id)
const owner = computed(() => props.hero.ownerId && store.data.roster?.find(p => p.id === props.hero.ownerId && p.avatar))
const noGroup = computed(() => isNoGroup(props.hero.group))
const gc = computed(() => groupColor(props.hero.group))
const rarity = computed(() => RARITY[props.hero.rarity] || RARITY.common)
const initial = computed(() => (props.hero.name || '?').trim()[0]?.toUpperCase() || '?')
const staminaPct = computed(() => (props.hero.staminaMax ? Math.max(0, Math.min(100, (props.hero.stamina / props.hero.staminaMax) * 100)) : 0))
const keeper = computed(() => props.hero.masterId && store.data.heroes?.find(h => h.id === props.hero.masterId))
// локация совпала с городом на карте — становится ссылкой
const city = computed(() => {
  const l = (props.hero.location || '').trim().toLowerCase()
  return l ? store.data.cities.find(c => c.name.trim().toLowerCase() === l) : null
})
const relations = computed(() => (props.hero.relations || []).map(r => {
  const hero = r.heroId ? store.data.heroes?.find(h => h.id === r.heroId) : null
  return { ...r, hero, name: hero?.name || r.name }
}))

/* переворот и наклон за мышкой */
const flip = ref(false)
const rx = ref(0), ry = ref(0)
const tiltStyle = computed(() => (flip.value ? null : { transform: `rotateX(${rx.value}deg) rotateY(${ry.value}deg)` }))
function turn() {
  rx.value = ry.value = 0
  flip.value = !flip.value
}
function tilt(e) {
  if (flip.value || matchMedia('(hover: none)').matches) return
  const r = e.currentTarget.getBoundingClientRect()
  ry.value = ((e.clientX - r.left) / r.width - 0.5) * 12
  rx.value = -((e.clientY - r.top) / r.height - 0.5) * 12
}
function untilt() { rx.value = ry.value = 0 }
</script>

<style scoped>
.slot { height: 548px; perspective: 1400px; animation: deal .7s cubic-bezier(.2, .9, .3, 1.2) both; font-family: 'Manrope', sans-serif; color: #efe3c8; }
.card { position: relative; width: 100%; height: 100%; transform-style: preserve-3d; transition: transform .25s ease-out; }
.slot.flip .card { transform: rotateY(180deg); transition: transform .8s cubic-bezier(.3, 1.4, .5, 1); }
.face { position: absolute; inset: 0; backface-visibility: hidden; -webkit-backface-visibility: hidden; border-radius: 18px; padding: 12px; background: linear-gradient(180deg, #221b13, #15110c); border: 1px solid #5d4521; box-shadow: 0 0 0 3px #241c13, 0 0 0 4px rgba(201, 162, 79, .35), 0 18px 40px rgba(0, 0, 0, .55); overflow: hidden; display: flex; flex-direction: column; }
.slot.sidekick, .slot.companion { height: 468px; }
.back { transform: rotateY(180deg); }
.slot.flip .front, .slot:not(.flip) .back { pointer-events: none; }
/* блик при наведении */
.front::before { content: ''; position: absolute; inset: 0; z-index: 5; pointer-events: none; background: linear-gradient(115deg, transparent 35%, rgba(255, 236, 190, .13) 48%, transparent 60%); transform: translateX(-120%); }
.slot:hover .front::before { transform: translateX(120%); transition: transform 1s ease; }
.rivet { position: absolute; z-index: 4; width: 8px; height: 8px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #ffe9b0, #8a6630 60%, #3b2a12); }
.rivet.a { top: 7px; left: 7px; } .rivet.b { top: 7px; right: 7px; } .rivet.c { bottom: 7px; left: 7px; } .rivet.d { bottom: 7px; right: 7px; }
.stripe { position: absolute; top: 0; left: 20%; right: 20%; height: 3px; border-radius: 0 0 4px 4px; background: var(--gc); box-shadow: 0 0 12px var(--gc); }

.port { position: relative; height: 250px; flex: none; border-radius: 12px; overflow: hidden; border: 1px solid #6b5127; background: radial-gradient(circle at 50% 35%, color-mix(in srgb, var(--gc) 28%, #2a2015), #120e09 75%); }
.port > img:first-child { width: 100%; height: 100%; object-fit: cover; object-position: center 20%; transition: transform 6s ease; }
.slot:hover .port > img:first-child { transform: scale(1.07); }
/* портрет при наклоне карточки (3D) иначе перехватывает клики у кнопок поверх него */
.port > img:first-child, .ph { pointer-events: none; }
.ph { width: 100%; height: 100%; display: grid; place-items: center; font: 700 120px 'Cormorant Garamond', Georgia, serif; color: rgba(255, 240, 210, .16); }
.port::after { content: ''; position: absolute; inset: 0; pointer-events: none; background: linear-gradient(180deg, transparent 50%, rgba(16, 12, 8, .94)); }
.lvl { position: absolute; z-index: 2; top: 8px; left: 8px; width: 46px; height: 52px; clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%); background: linear-gradient(180deg, #f2d58f, #a87a33); display: grid; place-items: center; text-align: center; color: #1e150a; font: 800 18px/1 'Manrope', sans-serif; }
.lvl small { display: block; font-size: 8px; letter-spacing: .5px; }
.bm, .rar { position: absolute; z-index: 2; top: 10px; right: 10px; background: rgba(16, 12, 8, .78); border: 1px solid #b8893f; border-radius: 99px; padding: 3px 10px; font: 800 13px 'Manrope', sans-serif; color: #f3d99a; }
.bm small { color: #a8936c; margin-right: 4px; }
.rar { font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: var(--rc); border-color: var(--rc); }
.name { position: absolute; z-index: 2; left: 12px; right: 12px; bottom: 8px; font: 700 25px/1.05 'Cormorant Garamond', Georgia, serif; color: #fff3d6; text-shadow: 0 2px 8px #000; }
.sub { display: block; margin-top: 3px; font: 700 11px 'Manrope', sans-serif; letter-spacing: .3px; color: #e6c27a; }
.sub svg { width: 11px; height: 11px; vertical-align: -1px; }
.sub a { color: inherit; }
.sub.me { color: #9be07a; }
.sub.sk { color: #5fd3bd; }
.stamp { position: absolute; z-index: 3; right: 12px; top: 52px; transform: rotate(-12deg); border: 2px solid #9be07a; color: #9be07a; padding: 2px 8px; border-radius: 6px; background: rgba(20, 40, 20, .6); font: 800 12px 'Manrope', sans-serif; letter-spacing: 1px; text-transform: uppercase; max-width: 70%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; animation: stamp .5s .9s cubic-bezier(.3, 1.6, .5, 1) both; }
.shade-tag { position: absolute; z-index: 3; left: 62px; top: 14px; padding: 2px 8px; border-radius: 99px; background: rgba(40, 30, 70, .85); color: #cfc2ff; font: 800 11px 'Manrope', sans-serif; }
.owner-av { position: absolute; z-index: 3; right: 10px; bottom: 12px; width: 30px; height: 30px; border-radius: 50%; object-fit: cover; border: 2px solid var(--gc); }
.edit { position: absolute; z-index: 6; left: 12px; top: 68px; width: 32px; height: 32px; border-radius: 50%; border: 1px solid #b8893f; background: rgba(16, 12, 8, .85); color: #f3d99a; font-size: 15px; cursor: pointer; opacity: 0; transition: opacity .2s, transform .2s; }
.slot:hover .edit, .edit:focus-visible { opacity: 1; }
.edit:hover { transform: rotate(-15deg) scale(1.1); }
@media (hover: none) { .edit { opacity: 1; } }

.stam { display: flex; align-items: center; gap: 8px; margin: 10px 2px 0; }
.stam .k, .row .k { color: #a8936c; font-size: 12px; width: 70px; flex: none; }
.gauge { flex: 1; height: 8px; border-radius: 99px; overflow: hidden; background: rgba(255, 255, 255, .07); border: 1px solid rgba(255, 255, 255, .06); }
.gauge i { display: block; height: 100%; background: linear-gradient(90deg, #c0392b, #ff6b5b); transform-origin: left; animation: grow 1.2s .5s ease both; transition: width .5s; }
.stam b { font-size: 12px; white-space: nowrap; }
.rows { display: grid; gap: 5px; margin: 10px 2px 0; font-size: 12.5px; }
.row { display: flex; align-items: center; gap: 8px; min-width: 0; }
.row svg, .row .sp { width: 15px; height: 15px; flex: none; color: #b8893f; }
.rows .k { width: 52px; }
.v { font-weight: 700; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.v.link { color: #f3d99a; text-decoration: underline dotted; text-underline-offset: 3px; }
.grp { color: var(--gc); }
.sect { margin: 10px 2px 0; padding-top: 8px; border-top: 1px dashed rgba(201, 162, 79, .25); }
.sect h4 { margin: 0 0 6px; font: 800 11px 'Manrope', sans-serif; letter-spacing: 1.2px; text-transform: uppercase; color: #a8936c; }
.fx { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 7px; }
.fx span { font: 700 11px/1.3 'Manrope', sans-serif; padding: 2px 8px; border-radius: 6px; overflow-wrap: anywhere; }
.fx .p { background: rgba(126, 224, 163, .12); color: #9be07a; border: 1px solid rgba(126, 224, 163, .3); }
.fx .m { background: rgba(255, 107, 91, .1); color: #ff9b8f; border: 1px solid rgba(255, 107, 91, .3); }
.e { color: #a8936c; font: italic 400 12px 'Manrope', sans-serif; }
.fx .e { padding-left: 0; }
.turn { margin-top: auto; align-self: center; padding: 6px; border: 0; background: none; color: #a8936c; font: 800 11px 'Manrope', sans-serif; letter-spacing: .8px; text-transform: uppercase; cursor: pointer; }
.turn:hover { color: #e6c27a; }

.b-title { margin: 6px 6px 0; font: 700 24px 'Cormorant Garamond', Georgia, serif; color: #f3d99a; }
.b-sub { margin: 0 6px 4px; font-size: 12px; color: #a8936c; }
.kv { display: grid; grid-template-columns: 62px 1fr; align-items: center; gap: 7px 8px; font-size: 12.5px; }
.kv .k { color: #a8936c; }
.rels { min-height: 0; overflow-y: auto; scrollbar-width: thin; }
.rel { display: grid; gap: 4px; margin-bottom: 10px; }
.who { display: flex; justify-content: space-between; gap: 8px; font-weight: 800; font-size: 13px; color: #ff86b8; }
.who a { color: inherit; text-decoration: none; border-bottom: 1px dotted; }
.who small { color: #a8936c; font-weight: 700; white-space: nowrap; }
.relbar { height: 5px; border-radius: 99px; overflow: hidden; background: rgba(255, 126, 182, .12); }
.relbar i { display: block; height: 100%; background: linear-gradient(90deg, #c2185b, #ff86b8); transform-origin: left; animation: grow 1.1s .3s ease both; }

/* сайд-кик — бирюза */
.sidekick .face { border-color: #2f6b62; box-shadow: 0 0 0 3px #13201d, 0 0 0 4px rgba(80, 200, 180, .3), 0 18px 40px rgba(0, 0, 0, .55); }
.sidekick .lvl { background: linear-gradient(180deg, #9ff0de, #2f8f7d); }
/* компаньон — рамка по редкости; уникальный переливается */
.companion .face { border-color: color-mix(in srgb, var(--rc) 60%, #000); box-shadow: 0 0 0 3px #1a1510, 0 0 0 4px color-mix(in srgb, var(--rc) 45%, transparent), 0 18px 40px rgba(0, 0, 0, .55); }
.unique .front::after { content: ''; position: absolute; inset: 0; border-radius: 18px; padding: 2px; pointer-events: none; background: conic-gradient(from var(--a), #f3d99a, #ff86b8, #8fd3ff, #9be07a, #f3d99a); -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude; animation: rot 4s linear infinite; }
/* свой персонаж — зелёный отблеск; в тени — приглушённый */
.mine .face { box-shadow: 0 0 0 3px #241c13, 0 0 0 4px rgba(155, 224, 122, .55), 0 0 26px rgba(155, 224, 122, .18), 0 18px 40px rgba(0, 0, 0, .55); }
.shade .face { filter: saturate(.55) brightness(.85); }
.pulse .face { animation: pulse 1.4s ease 2; }

@property --a { syntax: '<angle>'; inherits: false; initial-value: 0deg; }
@keyframes rot { to { --a: 360deg; } }
@keyframes deal { from { opacity: 0; transform: translateY(60px) rotate(-6deg) scale(.9); } }
@keyframes grow { from { transform: scaleX(0); } }
@keyframes stamp { from { opacity: 0; transform: rotate(-12deg) scale(2.5); } }
@keyframes pulse { 50% { box-shadow: 0 0 0 3px #241c13, 0 0 0 6px #f3d99a, 0 0 40px rgba(243, 217, 154, .6); } }
@media (prefers-reduced-motion: reduce) {
  .slot, .stamp, .gauge i, .relbar i, .companion .front::after { animation: none !important; }
  .card { transition: none !important; }
}
</style>
