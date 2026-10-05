<template>
  <div class="slot" :id="'hero-' + hero.id"
       :class="[hero.kind, theme && 'themed th-' + theme, { flip, mine, shade: hero.hidden, pulse, live, unique: hero.kind === 'companion' && hero.rarity === 'unique' }]"
       :style="[{ '--gc': gc, '--rc': rarity?.color, animationDelay: delay + 'ms' }, tvars, mouse]"
       @mousemove="tilt" @mouseenter="enter" @mouseleave="untilt" @touchstart.passive="tap">
    <div class="card" :style="tiltStyle">
      <!-- ===== лицо ===== -->
      <div class="face front">
        <div v-if="theme" class="tdeco">
          <svg class="mark" viewBox="0 0 24 24"><path :d="THEMES[theme].icon" fill="currentColor" /></svg>
          <!-- Энди: медные патрубки вокруг характеристик, манометр и вентиль -->
          <template v-if="theme === 'steam'">
            <svg class="pipes" viewBox="0 0 330 548" preserveAspectRatio="none">
              <g vector-effect="non-scaling-stroke">
                <path class="p-body" d="M7 284V522Q7 543 28 543H302Q323 543 323 522V284" />
                <path class="p-shine" d="M6 284V522Q6 542 28 542H302Q322 542 322 522V284" />
                <path class="p-flange" d="M1 300h12M1 430h12M317 300h12M317 470h12M90 537v12M240 537v12" />
              </g>
            </svg>
            <svg class="valve" viewBox="-12 -12 24 24"><g class="wheel"><circle r="9" /><path d="M0-9V9M-9 0H9" /><circle r="2.4" class="hub" /></g></svg>
            <svg class="mano" viewBox="-20 -20 40 40">
              <circle r="18" class="rim" /><circle r="14.5" class="dial" />
              <path class="ticks" d="M0-12.5v3M8.8-8.8l-2 2M12.5 0h-3M-12.5 0h3M-8.8-8.8l2 2M8.8 8.8l-2-2M-8.8 8.8l2-2" />
              <path class="red" d="M8.8-8.8A12.5 12.5 0 0 1 12.5 0" />
              <!-- стрелку крутит сам SVG вокруг центра шкалы (0,0) — CSS-повороты в SVG браузеры считают по-разному -->
              <g transform="rotate(-110)"><path class="needle" d="M0 2V-11" />
                <animateTransform ref="needleAnim" attributeName="transform" type="rotate" begin="indefinite" dur="2.8s" repeatCount="indefinite"
                                  values="-110;30;18;38;26;26;-110" keyTimes="0;.35;.45;.55;.65;.8;1" />
              </g>
              <circle r="2" class="hub" />
            </svg>
          </template>
        </div>
        <HeroFx v-if="theme && live && !flip" :theme="theme" layer="back" />
        <i class="rivet a" /><i class="rivet b" /><i class="rivet c" /><i class="rivet d" /><i class="stripe" />
        <div class="port" :class="{ art: arts.length }" :title="arts.length ? 'Посмотреть арт целиком' : undefined"
             @click="arts.length && (viewer = true)" @touchstart.passive="tStart" @touchend="tEnd">
          <!-- колода артов: верхний — на виду, следующие выглядывают из-за него -->
          <div v-for="c in deck" :key="c.a.id" class="dcard" :class="[c.anim, { top: c.d === 0 }]" :style="c.style" @animationend="c.anim && (anim = null)">
            <img class="pimg" :src="heroPortraitUrl(c.a.thumb || c.a.file)" :style="focusStyle(c.a)" alt="" loading="lazy" />
          </div>
          <div v-if="!arts.length" class="ph">{{ initial }}</div>
          <!-- полоски кадров: сколько артов и какой сейчас; по ним можно щёлкать -->
          <div v-if="arts.length > 1" class="frames" :class="{ left: hero.kind === 'companion' }">
            <button v-for="(a, n) in arts" :key="a.id" type="button" :class="{ on: n === idx }" :aria-label="`Арт ${n + 1}`" @click.stop="go(n)" />
          </div>
          <template v-if="arts.length > 1">
            <button type="button" class="dnav prev" aria-label="Предыдущий арт" @click.stop="step(-1)">‹</button>
            <button type="button" class="dnav next" aria-label="Следующий арт" @click.stop="step(1)">›</button>
          </template>
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
              <a href="#" @click.prevent.stop="$emit('focus', keeper.id)">{{ keeper.name }}</a>
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
        <HeroFx v-if="theme && live && !flip" :theme="theme" layer="front" />
      </div>

      <!-- ===== оборот (только персонажи) ===== -->
      <div v-if="hero.kind === 'character'" class="face back">
        <div v-if="theme" class="tdeco"><svg class="mark" viewBox="0 0 24 24"><path :d="THEMES[theme].icon" fill="currentColor" /></svg></div>
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
    <HeroGalleryViewer v-if="viewer" :arts="arts" :start="idx" :name="hero.name" :theme="theme" @close="viewer = false" @index="go" />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { mdiMapMarker, mdiHome, mdiFlag, mdiPaw } from '@mdi/js'
import HexPips from './HexPips.vue'
import HeroGalleryViewer from './HeroGalleryViewer.vue'
import HeroFx from './HeroFx.vue'
import { HERO_THEMES, heroThemeKey, themeVars } from './heroThemes.js'
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

/* арты карточки: колода, первый — обложка; листаются стрелками, полосками и свайпом */
const arts = computed(() => props.hero.gallery || [])
const idx = ref(0)
watch(() => arts.value.length, n => { if (idx.value >= n) idx.value = 0 })
// какая часть арта видна (выбирается в редакторе)
function focusStyle(a) {
  const p = { x: 50, y: 20, zoom: 1, ...a?.pos }
  return { objectPosition: `${p.x}% ${p.y}%`, transformOrigin: `${p.x}% ${p.y}%`, '--z': p.zoom }
}
// куда сдвинут и повёрнут арт на глубине d колоды (0 — верхний)
const SPOT = [
  'none',
  'translate(5px, -4px) rotate(2.2deg) scale(.985)',
  'translate(9px, -7px) rotate(4.2deg) scale(.97)'
]
const SPOT_FAN = [
  'none',
  'translate(8px, -5px) rotate(3.4deg) scale(.985)',
  'translate(14px, -8px) rotate(6.4deg) scale(.97)'
]
// последняя смена: 'toss' — верхний улетел назад в колоду, 'draw' — нижний вытянут наверх
const anim = ref(null)
const deck = computed(() => {
  const n = arts.value.length
  const out = []
  arts.value.forEach((a, i) => {
    const d = (i - idx.value + n) % n
    const moving = anim.value?.id === a.id ? anim.value.kind : null
    if (d > 2 && !moving) return
    const spots = hover.value ? SPOT_FAN : SPOT
    out.push({
      a, d, anim: moving,
      style: { '--rest': spots[Math.min(d, 2)], zIndex: 3 - Math.min(d, 3), '--dim': d ? 0.45 + 0.2 / d : 1, '--op': d > 2 ? 0 : 1 }
    })
  })
  return out
})
function go(n) {
  const len = arts.value.length
  if (len < 2 || n === idx.value) return
  const fwd = (n - idx.value + len) % len <= len / 2
  anim.value = fwd ? { id: arts.value[idx.value].id, kind: 'toss' } : { id: arts.value[n].id, kind: 'draw' }
  idx.value = (n + len) % len
}
const step = d => go((idx.value + d + arts.value.length) % arts.value.length)
let tx = null
const tStart = e => { tx = e.touches[0].clientX }
function tEnd(e) {
  if (tx === null || arts.value.length < 2) return
  const dx = e.changedTouches[0].clientX - tx
  tx = null
  if (Math.abs(dx) < 40) return
  e.preventDefault() // свайп — не клик
  step(dx < 0 ? 1 : -1)
}

/* тема героя: рамка, узор, знак и эффекты при наведении */
const THEMES = HERO_THEMES
const theme = computed(() => heroThemeKey(props.hero))
const tvars = computed(() => themeVars(theme.value))
const hover = ref(false)
// на телефоне касание тоже шлёт mouseenter, а mouseleave — нет; там эффекты включает tap()
const enter = () => { if (!matchMedia('(hover: none)').matches) hover.value = true }
// на телефоне наведения нет — эффекты показываем несколько секунд после касания
const touchLive = ref(false)
let touchTimer = null
function tap() {
  touchLive.value = true
  clearTimeout(touchTimer)
  touchTimer = setTimeout(() => { touchLive.value = false }, 3500)
}
onBeforeUnmount(() => clearTimeout(touchTimer))
const live = computed(() => hover.value || touchLive.value)
// стрелка манометра Энди скачет, пока карточка «живая»
const needleAnim = ref(null)
watch(live, on => {
  const a = needleAnim.value
  if (!a || matchMedia('(prefers-reduced-motion: reduce)').matches) return
  try { on ? a.beginElement() : a.endElement() } catch { /* SMIL нет — стрелка просто стоит */ }
})
const mouse = ref(null)

/* арты на весь экран */
const viewer = ref(false)

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
  if (theme.value === 'marksman') mouse.value = { '--mx': `${Math.round(e.clientX - r.left)}px`, '--my': `${Math.round(e.clientY - r.top)}px` }
  ry.value = ((e.clientX - r.left) / r.width - 0.5) * 12
  rx.value = -((e.clientY - r.top) / r.height - 0.5) * 12
}
function untilt() {
  rx.value = ry.value = 0
  hover.value = false
}
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

/* портрет; арты лежат в нём колодой — края нижних выглядывают за рамку */
.port { position: relative; z-index: 1; height: 250px; flex: none; border-radius: 12px; }
.port:not(.art), .dcard { border: 1px solid #6b5127; background: radial-gradient(circle at 50% 35%, color-mix(in srgb, var(--gc) 28%, #2a2015), #120e09 75%); }
.port:not(.art) { overflow: hidden; }
.dcard { position: absolute; inset: 0; border-radius: 12px; overflow: hidden; transform: var(--rest); opacity: var(--op); filter: brightness(var(--dim)); box-shadow: 0 4px 14px rgba(0, 0, 0, .55); transition: transform .5s cubic-bezier(.2, .8, .2, 1), filter .5s, opacity .4s; }
.dcard.toss { animation: toss .75s cubic-bezier(.3, .7, .25, 1) both; }
.dcard.draw { animation: draw .75s cubic-bezier(.3, .7, .25, 1) both; }
@keyframes toss {
  0% { transform: none; filter: none; opacity: 1; z-index: 4; }
  42% { transform: translate(-58%, -5%) rotate(-12deg) scale(.92); filter: none; opacity: 1; z-index: 4; }
  43% { z-index: 0; }
  100% { transform: var(--rest); filter: brightness(var(--dim)); opacity: var(--op); z-index: 0; }
}
@keyframes draw {
  0% { transform: translate(9px, -7px) rotate(4.2deg) scale(.97); filter: brightness(.5); opacity: 0; z-index: 0; }
  20% { opacity: 1; }
  42% { transform: translate(-58%, -5%) rotate(-12deg) scale(.92); filter: none; opacity: 1; z-index: 0; }
  43% { z-index: 4; }
  100% { transform: none; filter: none; z-index: 4; }
}
.pimg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transform: scale(var(--z, 1)); transition: transform 6s ease; }
.frames { position: absolute; z-index: 6; top: 3px; left: 62px; right: 74px; display: flex; gap: 3px; }
.frames.left { left: 12px; right: 120px; }
.frames button { flex: 1; height: 15px; padding: 6px 0; border: 0; border-radius: 2px; background: rgba(255, 240, 210, .3) content-box; cursor: pointer; filter: drop-shadow(0 1px 2px rgba(0, 0, 0, .8)); transition: background-color .2s; }
.frames button:hover { background-color: rgba(255, 240, 210, .6); }
.frames button.on { background-color: #f3d99a; }
.dnav { position: absolute; z-index: 6; top: 50%; width: 30px; height: 30px; margin-top: -15px; border-radius: 50%; border: 1px solid rgba(201, 162, 79, .6); background: rgba(16, 12, 8, .72); color: #f3d99a; font-size: 20px; line-height: 1; cursor: pointer; opacity: 0; transition: opacity .2s, transform .2s, background .2s; }
.dnav.prev { left: 6px; } .dnav.next { right: 6px; }
.port:hover .dnav, .dnav:focus-visible { opacity: 1; }
.dnav:hover { background: rgba(201, 162, 79, .3); transform: scale(1.1); }
@media (hover: none) { .dnav { opacity: .75; } }
.port.art { cursor: zoom-in; }
.slot:hover .dcard.top .pimg { transform: scale(calc(var(--z, 1) * 1.07)); }
/* портрет при наклоне карточки (3D) иначе перехватывает клики у кнопок поверх него */
.pimg, .ph { pointer-events: none; }
.ph { width: 100%; height: 100%; display: grid; place-items: center; font: 700 120px 'Cormorant Garamond', Georgia, serif; color: rgba(255, 240, 210, .16); }
.port::after { content: ''; position: absolute; z-index: 4; inset: 0; border-radius: 12px; pointer-events: none; background: linear-gradient(180deg, transparent 50%, rgba(16, 12, 8, .94)); }
.lvl { position: absolute; z-index: 5; top: 8px; left: 8px; width: 46px; height: 52px; clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%); background: linear-gradient(180deg, #f2d58f, #a87a33); display: grid; place-items: center; text-align: center; color: #1e150a; font: 800 18px/1 'Manrope', sans-serif; }
.lvl small { display: block; font-size: 8px; letter-spacing: .5px; }
.bm, .rar { position: absolute; z-index: 5; top: 10px; right: 10px; background: rgba(16, 12, 8, .78); border: 1px solid #b8893f; border-radius: 99px; padding: 3px 10px; font: 800 13px 'Manrope', sans-serif; color: #f3d99a; }
.bm small { color: #a8936c; margin-right: 4px; }
.rar { font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: var(--rc); border-color: var(--rc); }
.name { position: absolute; z-index: 5; left: 12px; right: 12px; bottom: 8px; font: 700 25px/1.05 'Cormorant Garamond', Georgia, serif; color: #fff3d6; text-shadow: 0 2px 8px #000; }
.sub { display: block; margin-top: 3px; font: 700 11px 'Manrope', sans-serif; letter-spacing: .3px; color: #e6c27a; }
.sub svg { width: 11px; height: 11px; vertical-align: -1px; }
.sub a { color: inherit; }
.sub.me { color: #9be07a; }
.sub.sk { color: #5fd3bd; }
.stamp { position: absolute; z-index: 5; right: 12px; top: 52px; transform: rotate(-12deg); border: 2px solid #9be07a; color: #9be07a; padding: 2px 8px; border-radius: 6px; background: rgba(20, 40, 20, .6); font: 800 12px 'Manrope', sans-serif; letter-spacing: 1px; text-transform: uppercase; max-width: 70%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; animation: stamp .5s .9s cubic-bezier(.3, 1.6, .5, 1) both; }
.shade-tag { position: absolute; z-index: 5; left: 62px; top: 14px; padding: 2px 8px; border-radius: 99px; background: rgba(40, 30, 70, .85); color: #cfc2ff; font: 800 11px 'Manrope', sans-serif; }
.owner-av { position: absolute; z-index: 5; right: 10px; bottom: 12px; width: 30px; height: 30px; border-radius: 50%; object-fit: cover; border: 2px solid var(--gc); }
.edit { position: absolute; z-index: 7; left: 12px; top: 68px; width: 32px; height: 32px; border-radius: 50%; border: 1px solid #b8893f; background: rgba(16, 12, 8, .85); color: #f3d99a; font-size: 15px; cursor: pointer; opacity: 0; transition: opacity .2s, transform .2s; }
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

/* ===== темы героев (heroThemes.js) ===== */
.themed { --ring: color-mix(in srgb, var(--ta) 45%, transparent); }
.themed.mine { --ring: rgba(155, 224, 122, .6); }
.themed .face { background: var(--tpat), linear-gradient(180deg, var(--tbg1), var(--tbg2)); border-color: var(--tf); box-shadow: 0 0 0 3px var(--tbg2), 0 0 0 4px var(--ring), 0 0 var(--glow-r, 18px) color-mix(in srgb, var(--ta) var(--glow-a, 12%), transparent), 0 18px 40px rgba(0, 0, 0, .55); transition: box-shadow .5s; }
.themed.live .face { --glow-r: 38px; --glow-a: 36%; }
.face > :not(.tdeco, .rivet, .stripe, .hfx, .port) { position: relative; z-index: 1; }
.tdeco { position: absolute; inset: 0; z-index: 0; pointer-events: none; }
.mark { position: absolute; right: -28px; bottom: -30px; width: 170px; height: 170px; color: var(--ta); opacity: .07; transition: opacity .6s, filter .6s; }
.themed.live .mark { opacity: .17; filter: drop-shadow(0 0 10px var(--ta)); }
.themed .port:not(.art), .themed .dcard { border-color: color-mix(in srgb, var(--ta) 50%, #000); background: radial-gradient(circle at 50% 35%, color-mix(in srgb, var(--ta) 26%, var(--tbg1)), var(--tbg2) 75%); }
.themed .port::after { background: linear-gradient(180deg, transparent 50%, color-mix(in srgb, var(--tbg2) 94%, transparent)); }
.themed .lvl { background: linear-gradient(180deg, var(--tl), var(--ta)); color: var(--tbg2); }
.themed .bm { border-color: var(--ta); color: var(--tl); }
.themed .bm small, .themed .stam .k, .themed .row .k, .themed .sect h4, .themed .kv .k, .themed .b-sub, .themed .turn, .themed .e, .themed .who small { color: color-mix(in srgb, var(--tl) 52%, #6b6862); }
.themed .row svg { color: var(--ta); }
.themed .v.link, .themed .b-title { color: var(--tl); }
.themed .turn:hover { color: var(--ta); }
.themed .sect { border-top-color: color-mix(in srgb, var(--ta) 28%, transparent); }
.themed .rivet { background: radial-gradient(circle at 35% 35%, var(--tl), var(--ta) 60%, var(--tbg2)); box-shadow: 0 0 6px color-mix(in srgb, var(--ta) 55%, transparent); }
.themed .frames button.on { background-color: var(--tl); }
.themed .dnav { border-color: color-mix(in srgb, var(--ta) 65%, transparent); color: var(--tl); background: color-mix(in srgb, var(--tbg2) 75%, transparent); }
.themed .dnav:hover { background: color-mix(in srgb, var(--ta) 32%, var(--tbg2)); }
/* знак темы оживает при наведении */
.th-steam.live .mark, .th-frost.live .mark { animation: spin 9s linear infinite; }
.th-sun.live .mark { animation: spin 20s linear infinite; }
.th-chi.live .mark { animation: spin 5s linear infinite; }
.th-tarot.live .mark { animation: throb 1.8s ease-in-out infinite; }
.th-demon.live .mark, .th-dragon.live .mark, .th-marksman.live .mark { animation: throb 1.8s ease-in-out infinite; }
/* при наведении арт подсвечивается по краю — сам арт эффекты не закрывают */
.themed .dcard.top, .themed .port:not(.art) { transition: transform .5s cubic-bezier(.2, .8, .2, 1), filter .5s, opacity .4s, box-shadow .6s; }
.th-demon.live :is(.dcard.top, .port:not(.art)) { box-shadow: 0 0 0 1px rgba(224, 51, 90, .55), 0 0 22px rgba(224, 51, 90, .45), 0 0 40px rgba(155, 77, 255, .25); }
.th-sun.live :is(.dcard.top, .port:not(.art)) { box-shadow: 0 0 0 1px rgba(255, 220, 140, .6), 0 0 26px rgba(255, 201, 74, .55), 0 0 60px rgba(255, 138, 42, .25); }
.th-chi.live :is(.dcard.top, .port:not(.art)) { animation: chi-breathe 3s ease-in-out infinite alternate; }
.th-frost.live :is(.dcard.top, .port:not(.art)) { box-shadow: 0 0 0 1px rgba(225, 247, 255, .75), 0 0 16px rgba(127, 214, 255, .55); }
.th-frost.live .gauge { border-color: rgba(220, 245, 255, .6); box-shadow: 0 0 8px rgba(127, 214, 255, .6); }
.th-frost.live .sect { border-top-color: rgba(200, 238, 255, .55); }
.th-dragon.live :is(.dcard.top, .port:not(.art)) { box-shadow: 0 0 0 1px rgba(169, 112, 255, .55), 0 0 22px rgba(169, 112, 255, .45); }
.th-tarot.live :is(.dcard.top, .port:not(.art)) { box-shadow: 0 0 0 1px rgba(217, 180, 90, .65), 0 0 22px rgba(232, 52, 74, .4); }
.th-steam.live :is(.dcard.top, .port:not(.art)) { box-shadow: 0 0 0 1px rgba(217, 162, 90, .6), 0 0 18px rgba(240, 244, 247, .25); }
@keyframes chi-breathe {
  from { box-shadow: 0 0 0 1px rgba(236, 47, 66, .45), 0 0 14px rgba(236, 47, 66, .3); }
  to { box-shadow: 0 0 0 1px rgba(255, 110, 70, .65), 0 0 28px rgba(236, 47, 66, .5); }
}
/* мелочи под тему */
/* Энди: патрубки, вентиль и манометр — часть узора; при наведении вентиль крутится, стрелка прыгает */
.pipes, .valve, .mano { position: absolute; opacity: .4; transition: opacity .6s; }
.pipes { inset: 0; width: 100%; height: 100%; }
.themed.live .pipes, .themed.live .valve, .themed.live .mano { opacity: .85; }
.pipes path { vector-effect: non-scaling-stroke; }
.p-body { fill: none; stroke: #6b4320; stroke-width: 7; }
.p-shine { fill: none; stroke: #e0a95e; stroke-width: 1.6; opacity: .7; }
.p-flange { stroke: #b8843f; stroke-width: 4; }
.valve { right: -3px; top: 380px; width: 28px; height: 28px; }
.valve circle, .valve path { fill: none; stroke: #d9a25a; stroke-width: 2.4; }
.valve .hub { fill: #8a6233; }
.wheel { transform-box: fill-box; transform-origin: center; }
.th-steam.live .wheel { animation: spin 2.4s linear infinite; }
.mano { left: 6px; bottom: 14px; width: 42px; height: 42px; }
.mano .rim { fill: #2a1c10; stroke: #c99248; stroke-width: 2.5; }
.mano .dial { fill: #e8dcc0; opacity: .9; }
.mano .ticks { stroke: #3a2a18; stroke-width: 1.2; }
.mano .red { fill: none; stroke: #c0392b; stroke-width: 2.2; }
.mano .needle { stroke: #9b1c1c; stroke-width: 1.6; stroke-linecap: round; }
.mano .hub { fill: #6b4320; }
.th-steam .gauge { border-color: #8a6233; background: repeating-linear-gradient(90deg, rgba(217, 162, 90, .14) 0 2px, transparent 2px 9px), rgba(0, 0, 0, .3); }
.th-frost .face { background: var(--tpat), radial-gradient(ellipse at 50% 120%, rgba(127, 214, 255, .12), transparent 60%), linear-gradient(180deg, var(--tbg1), var(--tbg2)); }
.th-frost .gauge i { background: linear-gradient(90deg, #2b7fb8, #9fe3ff); }
.th-sun .face { background: var(--tpat), radial-gradient(ellipse at 50% -10%, rgba(255, 201, 74, .2), transparent 55%), linear-gradient(180deg, var(--tbg1), var(--tbg2)); }
.th-demon .face { background: var(--tpat), radial-gradient(ellipse at 50% 115%, rgba(155, 77, 255, .16), transparent 60%), linear-gradient(180deg, var(--tbg1), var(--tbg2)); }
.th-dragon .face { background: var(--tpat), radial-gradient(ellipse at 80% 100%, rgba(169, 112, 255, .16), transparent 55%), linear-gradient(180deg, var(--tbg1), var(--tbg2)); }
.th-chi .gauge i { background: linear-gradient(90deg, #8d1420, #ff6a4c); }

@keyframes spin { to { rotate: 360deg; } }
@keyframes compass { 0%, 100% { rotate: -14deg; } 50% { rotate: 18deg; } }
@keyframes throb { 50% { scale: 1.08; } }
@property --a { syntax: '<angle>'; inherits: false; initial-value: 0deg; }
@keyframes rot { to { --a: 360deg; } }
@keyframes deal { from { opacity: 0; transform: translateY(60px) rotate(-6deg) scale(.9); } }
@keyframes grow { from { transform: scaleX(0); } }
@keyframes stamp { from { opacity: 0; transform: rotate(-12deg) scale(2.5); } }
@keyframes pulse { 50% { box-shadow: 0 0 0 3px #241c13, 0 0 0 6px #f3d99a, 0 0 40px rgba(243, 217, 154, .6); } }
@media (prefers-reduced-motion: reduce) {
  .slot, .stamp, .gauge i, .relbar i, .companion .front::after, .mark, .dcard, .port, .wheel { animation: none !important; }
  .card { transition: none !important; }
}
</style>
