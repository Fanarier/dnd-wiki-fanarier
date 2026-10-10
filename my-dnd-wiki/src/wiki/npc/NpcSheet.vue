<template>
  <!-- полный лист НПС: шапка с артом, затем вкладки «Обзор», «Навыки», «Бой» -->
  <article class="ns">
    <header class="ns-head">
      <div class="ns-art">
        <button v-if="cur" type="button" class="ns-cover" title="Смотреть арт целиком" @click="viewer = true">
          <img :src="heroPortraitUrl(cur.thumb || cur.file)" :style="focus(cur)" alt="" />
        </button>
        <div v-else class="ns-cover ph">{{ (npc.name || '?')[0] }}</div>
        <!-- формы и наряды: группы артов, внутри — миниатюры -->
        <div v-if="forms.length > 1" class="ns-forms">
          <button v-for="f in forms" :key="f" type="button" :class="{ on: f === form }" @click="pickForm(f)">{{ f || 'Основная' }}</button>
        </div>
        <div v-if="shown.length > 1" class="ns-thumbs">
          <button v-for="a in shown" :key="a.id" type="button" :class="{ on: a.id === cur?.id }" :title="a.label || ''" @click="artId = a.id">
            <img :src="heroPortraitUrl(a.thumb || a.file)" alt="" />
          </button>
        </div>
        <div v-if="cur?.label" class="ns-label">{{ cur.label }}</div>
      </div>

      <div class="ns-main">
        <div class="ns-kicker">
          <span class="ns-group">{{ groupOf(npc.group).icon }} {{ groupOf(npc.group).one }}</span>
          <span v-if="npc.hidden" class="ns-hidden" title="Игроки этого НПС не видят">☾ скрыт от игроков</span>
        </div>
        <h2 class="ns-name">{{ npc.name }}</h2>
        <div class="ns-badges">
          <span v-if="level" class="ns-lvl">ур. {{ level }}</span>
          <span v-if="npc.status?.text" class="ns-status" :style="{ '--sc': npc.status.color }">{{ npc.status.text }}</span>
          <span v-if="npc.home" class="ns-home">📍 {{ npc.home }}</span>
          <router-link v-if="hero" class="ns-hero" :to="{ path: '/wiki', query: { hero: hero.id } }">⚑ Карточка «{{ hero.name }}»</router-link>
        </div>
        <dl class="ns-info">
          <template v-for="r in npc.info" :key="r.k">
            <dt>{{ r.k }}</dt><dd :class="{ unk: unknown(r.v) }">{{ r.v || '—' }}</dd>
          </template>
        </dl>
        <div v-if="master" class="ns-acts">
          <button type="button" class="ns-btn primary" @click="$emit('edit')">✎ Править лист</button>
        </div>
      </div>
    </header>

    <nav class="ns-tabs" role="tablist">
      <button v-for="t in TABS" :key="t.key" type="button" role="tab" :aria-selected="tab === t.key" :class="{ on: tab === t.key }" @click="setTab(t.key)">
        {{ t.label }}<small v-if="t.count">{{ t.count }}</small>
      </button>
    </nav>

    <!-- ===== Обзор ===== -->
    <section v-if="tab === 'overview'" class="ns-body">
      <div v-if="npc.specs.length || npc.weak.length || hasSpecs(npc.group)" class="ns-two">
        <div class="ns-box">
          <h4>Специализации</h4>
          <div v-for="s in npc.specs" :key="s.name" class="ns-lv">
            <span :class="{ unk: unknown(s.name) }">{{ s.name }}</span>
            <em :style="{ '--lc': levelColor(SPEC_LEVELS, s.level) }">{{ s.level || '—' }}</em>
          </div>
          <p v-if="!npc.specs.length" class="ns-empty">нет</p>
        </div>
        <div class="ns-box">
          <h4>Слабости</h4>
          <div v-for="s in npc.weak" :key="s.name" class="ns-lv">
            <span :class="{ unk: unknown(s.name) }">{{ s.name }}</span>
            <em :style="{ '--lc': levelColor(WEAK_LEVELS, s.level) }">{{ s.level || '—' }}</em>
          </div>
          <p v-if="!npc.weak.length" class="ns-empty">нет</p>
        </div>
      </div>
      <div class="ns-box">
        <h4>Владение</h4>
        <div class="ns-prof">
          <div v-for="(p, i) in npc.prof" :key="i" class="ns-pf" :class="{ unk: unknown(p.name) }"><b>{{ p.name }}</b><span>{{ p.level }}</span></div>
          <div v-for="i in npc.profSlots" :key="'s' + i" class="ns-pf slot">свободный слот</div>
        </div>
        <p v-if="!npc.prof.length && !npc.profSlots" class="ns-empty">нет</p>
      </div>
      <div v-if="npc.lists.length" class="ns-lists">
        <div v-for="l in npc.lists" :key="l.title" class="ns-box">
          <h4>{{ l.title }}</h4>
          <ul v-if="l.items.length"><li v-for="(it, i) in l.items" :key="i">{{ it }}</li></ul>
          <p v-else class="ns-empty">пусто</p>
        </div>
      </div>
    </section>

    <!-- ===== Навыки ===== -->
    <section v-else-if="tab === 'skills'" class="ns-body">
      <h4 class="ns-h">Пассивные навыки <small>{{ npc.passives.length }}</small></h4>
      <div class="ns-skills">
        <div v-for="(p, i) in npc.passives" :key="'p' + i" class="ns-sk" :class="{ unk: unknown(p.name) }">
          <div class="ns-sk-h">
            <b>{{ p.name }}</b><span v-if="p.type" class="ns-type">{{ p.type }}</span>
            <button v-if="master && !unknown(p.name)" type="button" class="ns-ed" title="Описание навыка (общее для всех, у кого он есть)" @click="$emit('skill', 'passive', p)">✎</button>
          </div>
          <p v-if="lib('passive', p.name)?.desc"><FxText :text="lib('passive', p.name).desc" :effects="effects" /></p>
          <p v-else-if="!unknown(p.name)" class="ns-nodesc">{{ master ? 'Описание пока не заполнено — нажми ✎' : 'Описание пока не заполнено' }}</p>
        </div>
      </div>
      <p v-if="!npc.passives.length" class="ns-empty">нет</p>

      <h4 class="ns-h">Активные навыки <small>{{ npc.actives.length }}</small></h4>
      <div class="ns-skills act">
        <div v-for="(a, i) in npc.actives" :key="'a' + i" class="ns-sk" :class="{ unk: unknown(a.name) }">
          <div class="ns-sk-h">
            <b>{{ a.name }}</b><span v-if="a.type" class="ns-type">{{ a.type }}</span>
            <button v-if="master && !unknown(a.name)" type="button" class="ns-ed" title="Описание навыка" @click="$emit('skill', 'active', a)">✎</button>
          </div>
          <div v-if="cd(a) || cost(a)" class="ns-sk-meta">
            <span v-if="cd(a)" class="cd">⟳ {{ cd(a) }}</span>
            <span v-if="cost(a)" class="cost">◆ {{ cost(a) }}</span>
          </div>
          <p v-if="desc(a)"><FxText :text="desc(a)" :effects="effects" /></p>
          <p v-else-if="!unknown(a.name)" class="ns-nodesc">Описание пока не заполнено</p>
        </div>
      </div>
      <p v-if="!npc.actives.length" class="ns-empty">нет</p>
    </section>

    <!-- ===== Бой ===== -->
    <section v-else class="ns-body">
      <div class="ns-combat">
        <div v-for="c in COMBAT" :key="c.k" class="ns-tile" :class="{ unk: unknown(npc.combat[c.k]) }">
          <i>{{ c.icon }}</i><b>{{ npc.combat[c.k] || '—' }}</b><small>{{ c.k }}</small>
        </div>
      </div>
      <div class="ns-stats">
        <div v-for="s in STATS" :key="s" class="ns-stat" :class="{ unk: unknown(npc.stats[s]) }">
          <small>{{ s }}</small><b>{{ npc.stats[s] || '—' }}</b><em v-if="mod(npc.stats[s]) != null">{{ signed(mod(npc.stats[s])) }}</em>
        </div>
      </div>
      <div class="ns-two">
        <div class="ns-box">
          <h4>Спасброски</h4>
          <div v-for="s in npc.saves" :key="s.stat" class="ns-lv"><span :class="{ unk: unknown(s.stat) }">{{ s.stat }}</span><em v-if="s.value" style="--lc: #e6c27a">{{ s.value }}</em></div>
          <p v-if="!npc.saves.length" class="ns-empty">нет</p>
        </div>
        <div class="ns-box">
          <h4>Сопротивления и уязвимости</h4>
          <div v-for="r in npc.resist" :key="r.kind" class="ns-lv">
            <span :class="{ unk: unknown(r.kind) }">{{ r.kind }}</span>
            <em :style="{ '--lc': /уязв/i.test(r.value) ? '#ff8a6b' : /иммун/i.test(r.value) ? '#ffd166' : '#8fc7ff' }">{{ r.value }}</em>
          </div>
          <p v-if="!npc.resist.length" class="ns-empty">нет</p>
        </div>
      </div>
      <div class="ns-box">
        <h4>Атаки</h4>
        <div v-if="npc.attacks.length" class="ns-table">
          <div class="ns-tr th"><span>Атака</span><span>Урон</span><span>Тип</span><span>Значение</span><span>Заметка</span></div>
          <div v-for="(a, i) in npc.attacks" :key="i" class="ns-tr" :class="{ unk: unknown(a.name) }">
            <b>{{ a.name }}</b><span>{{ a.dtype }}</span><span>{{ a.kind }}</span><span class="dmg">{{ a.dmg }}</span><span class="note">{{ a.note }}</span>
          </div>
        </div>
        <p v-else class="ns-empty">нет</p>
      </div>
      <div class="ns-box">
        <h4>{{ npc.spellsTitle || 'Заклинания и техники' }}</h4>
        <div class="ns-prof">
          <div v-for="(s, i) in npc.spells" :key="i" class="ns-pf" :class="{ unk: unknown(s) }"><b>{{ s }}</b></div>
          <div v-for="i in npc.spellSlots" :key="'s' + i" class="ns-pf slot">свободный слот</div>
        </div>
        <p v-if="!npc.spells.length && !npc.spellSlots" class="ns-empty">нет</p>
      </div>
    </section>

    <HeroGalleryViewer v-if="viewer && shown.length" :arts="shown" :start="Math.max(0, shown.findIndex(a => a.id === cur?.id))" :name="npc.name" @close="viewer = false" @index="i => (artId = shown[i]?.id)" />
  </article>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import FxText from './FxText.vue'
import HeroGalleryViewer from '../HeroGalleryViewer.vue'
import { store, heroPortraitUrl } from '../../map/store.js'
import { groupOf, SPEC_LEVELS, WEAK_LEVELS, levelColor, STATS, COMBAT, mod, signed, hasSpecs, unknown, npcLevel, skillKey } from '../../shared/npc.js'

const props = defineProps({
  npc: { type: Object, required: true },
  skills: { type: Map, required: true }, // справочник навыков по ключу вид:название
  effects: { type: Array, default: () => [] },
  master: Boolean
})
defineEmits(['edit', 'skill'])

// вкладку помним между НПС — листаешь персонажей и смотришь сразу их бой
const tab = ref(sessionStorageGet('npc-tab') || 'overview')
function setTab(t) { tab.value = t; try { sessionStorage.setItem('npc-tab', t) } catch { /* приватный режим */ } }
function sessionStorageGet(k) { try { return sessionStorage.getItem(k) } catch { return null } }
const TABS = computed(() => [
  { key: 'overview', label: 'Обзор' },
  { key: 'skills', label: 'Навыки', count: props.npc.passives.length + props.npc.actives.length },
  { key: 'combat', label: 'Бой', count: props.npc.attacks.length }
])

const level = computed(() => npcLevel(props.npc))
const hero = computed(() => props.npc.heroId && store.data.heroes?.find(h => h.id === props.npc.heroId))
const lib = (kind, name) => props.skills.get(skillKey(kind, name))
const desc = a => a.desc || lib('active', a.name)?.desc || ''
const cd = a => a.cooldown || lib('active', a.name)?.cooldown || ''
const cost = a => a.cost || lib('active', a.name)?.cost || ''

// арты: группы («формы», наряды) — переключатели, внутри — миниатюры
const forms = computed(() => [...new Set((props.npc.arts || []).map(a => a.group || ''))])
const form = ref('')
const shown = computed(() => (props.npc.arts || []).filter(a => (a.group || '') === form.value))
const artId = ref(null)
const cur = computed(() => shown.value.find(a => a.id === artId.value) || shown.value[0] || null)
function pickForm(f) { form.value = f; artId.value = null }
watch(() => props.npc.id, () => { form.value = forms.value[0] ?? ''; artId.value = null }, { immediate: true })
const viewer = ref(false)
const focus = a => ({ objectPosition: `${a.pos?.x ?? 50}% ${a.pos?.y ?? 20}%` })
</script>

<style scoped>
.ns { font-family: 'Manrope', sans-serif; color: #e9dfc8; }
.ns-head { display: grid; grid-template-columns: minmax(200px, 300px) minmax(0, 1fr); gap: 22px; align-items: start; }
.ns-art { display: grid; gap: 8px; min-width: 0; }
.ns-cover { display: block; width: 100%; aspect-ratio: 3 / 4; padding: 0; border-radius: 16px; overflow: hidden; border: 1px solid #6b5127; background: radial-gradient(circle at 50% 35%, #2a2015, #120e09 75%); box-shadow: 0 0 0 3px #241c13, 0 0 0 4px rgba(201, 162, 79, .35), 0 18px 40px rgba(0, 0, 0, .5); cursor: zoom-in; }
.ns-cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
.ns-cover.ph { display: grid; place-items: center; font: 700 64px 'Cormorant Garamond', serif; color: #8a6630; cursor: default; }
.ns-forms { display: flex; flex-wrap: wrap; gap: 4px; }
.ns-forms button, .ns-tabs button { border: 1px solid rgba(231, 197, 111, .3); background: rgba(231, 197, 111, .06); color: #cdbf9f; border-radius: 99px; padding: 4px 11px; font: 700 12px 'Manrope', sans-serif; cursor: pointer; }
.ns-forms button.on { background: rgba(231, 197, 111, .22); color: #f3dc9e; border-color: #e7c56f; }
.ns-thumbs { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 2px; }
.ns-thumbs button { flex: none; width: 52px; height: 64px; padding: 0; border-radius: 8px; overflow: hidden; border: 2px solid transparent; background: #120e09; cursor: pointer; opacity: .65; }
.ns-thumbs button.on { border-color: #e7c56f; opacity: 1; }
.ns-thumbs img { width: 100%; height: 100%; object-fit: cover; }
.ns-label { color: #a8936c; font-size: 12.5px; font-style: italic; text-align: center; }

.ns-main { min-width: 0; }
.ns-kicker { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.ns-group { color: #c9a24f; font: 800 11.5px 'Manrope', sans-serif; text-transform: uppercase; letter-spacing: .08em; }
.ns-hidden { color: #b9a6ff; font-size: 12px; font-weight: 700; }
.ns-name { margin: 4px 0 10px; font: 700 34px/1.1 'Cormorant Garamond', serif; color: #f3dc9e; }
.ns-badges { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-bottom: 14px; }
.ns-lvl { padding: 3px 10px; border-radius: 99px; background: linear-gradient(180deg, #f0cf83, #c99a45); color: #1b140c; font-weight: 800; font-size: 12.5px; }
.ns-status { padding: 3px 10px; border-radius: 99px; border: 1px solid var(--sc); background: color-mix(in srgb, var(--sc) 14%, transparent); color: var(--sc); font-weight: 800; font-size: 12.5px; }
.ns-home { color: #cdbf9f; font-size: 13px; font-weight: 600; }
.ns-hero { padding: 3px 10px; border-radius: 99px; border: 1px solid rgba(201, 162, 79, .45); color: #f3d99a; font-weight: 700; font-size: 12px; text-decoration: none; }
.ns-hero:hover { background: rgba(201, 162, 79, .18); }
.ns-info { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 6px 16px; margin: 0; padding: 14px 16px; border-radius: 14px; background: rgba(255, 255, 255, .025); border: 1px solid rgba(231, 197, 111, .14); }
.ns-info dt { color: #a8936c; font-size: 12.5px; font-weight: 700; }
.ns-info dd { margin: 0; font-size: 13.5px; font-weight: 600; overflow-wrap: anywhere; }
.ns-acts { margin-top: 12px; display: flex; gap: 8px; }
.ns-btn { border: 1px solid rgba(255, 255, 255, .12); background: rgba(255, 255, 255, .05); color: #ece6da; border-radius: 10px; padding: 8px 14px; font: 700 13px 'Manrope', sans-serif; cursor: pointer; }
.ns-btn.primary { background: linear-gradient(180deg, #f0cf83, #c99a45); color: #1b140c; border-color: #e6c27a; }

.ns-tabs { display: flex; gap: 6px; flex-wrap: wrap; margin: 22px 0 14px; padding-bottom: 10px; border-bottom: 1px solid rgba(231, 197, 111, .18); }
.ns-tabs button { padding: 7px 16px; font-size: 13.5px; }
.ns-tabs button.on { background: rgba(231, 197, 111, .22); color: #f3dc9e; border-color: #e7c56f; }
.ns-tabs small { margin-left: 6px; color: #a8936c; font-weight: 800; }
.ns-body { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; }
.ns-two { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(240px, 100%), 1fr)); gap: 14px; }
.ns-lists { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; }
.ns-box { min-width: 0; padding: 12px 14px; border-radius: 14px; background: rgba(255, 255, 255, .025); border: 1px solid rgba(231, 197, 111, .14); }
.ns-box h4, .ns-h { margin: 0 0 8px; color: #e6c27a; font: 700 17px 'Cormorant Garamond', serif; }
.ns-h small { color: #a8936c; font: 800 12px 'Manrope', sans-serif; margin-left: 4px; }
.ns-box ul { margin: 0; padding-left: 18px; display: grid; gap: 3px; font-size: 13.5px; }
.ns-lv { display: flex; justify-content: space-between; gap: 10px; padding: 5px 0; border-top: 1px dashed rgba(231, 197, 111, .1); font-size: 13.5px; font-weight: 600; }
.ns-lv:first-of-type { border-top: 0; }
.ns-lv em { flex: none; font-style: normal; font-weight: 800; font-size: 12px; color: var(--lc); padding: 1px 9px; border-radius: 99px; background: color-mix(in srgb, var(--lc) 13%, transparent); }
.ns-prof { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 6px; }
.ns-pf { display: flex; justify-content: space-between; gap: 8px; padding: 7px 10px; border-radius: 10px; background: rgba(255, 255, 255, .035); border: 1px solid rgba(255, 255, 255, .07); font-size: 13px; }
.ns-pf b { font-weight: 700; overflow-wrap: anywhere; }
.ns-pf span { color: #a8d8ff; font-weight: 700; font-size: 12px; white-space: nowrap; }
.ns-pf.slot { justify-content: center; border-style: dashed; border-color: rgba(201, 162, 79, .3); background: none; color: #6f6656; font-style: italic; font-size: 12px; }
.ns-empty { margin: 0; color: #6f6656; font-size: 12.5px; font-style: italic; }
.unk, .unk b, .unk span { color: #6f6656 !important; font-style: italic; }

.ns-skills { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(260px, 100%), 1fr)); gap: 10px; }
.ns-skills.act { grid-template-columns: repeat(auto-fill, minmax(min(320px, 100%), 1fr)); }
.ns-sk { min-width: 0; padding: 10px 12px; border-radius: 12px; background: rgba(255, 255, 255, .03); border: 1px solid rgba(231, 197, 111, .14); }
.ns-sk-h { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.ns-sk-h b { font-size: 14px; color: #f3dc9e; }
.ns-type { padding: 1px 8px; border-radius: 99px; background: rgba(143, 199, 255, .12); color: #8fc7ff; font-size: 11px; font-weight: 800; }
.ns-ed { margin-left: auto; border: 0; background: none; color: #a8936c; cursor: pointer; font-size: 14px; padding: 0 2px; }
.ns-ed:hover { color: #f3dc9e; }
.ns-sk p { margin: 6px 0 0; font-size: 13px; line-height: 1.55; color: #ddd2b9; }
.ns-nodesc { color: #6f6656 !important; font-style: italic; }
.ns-sk-meta { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.ns-sk-meta span { padding: 1px 8px; border-radius: 99px; font-size: 11.5px; font-weight: 800; }
.ns-sk-meta .cd { background: rgba(255, 224, 138, .1); color: #ffe08a; }
.ns-sk-meta .cost { background: rgba(255, 155, 143, .1); color: #ff9b8f; }

.ns-combat { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 8px; }
.ns-tile { display: grid; justify-items: center; gap: 2px; padding: 10px 6px; border-radius: 12px; background: rgba(255, 255, 255, .03); border: 1px solid rgba(231, 197, 111, .14); }
.ns-tile i { font-style: normal; font-size: 16px; }
.ns-tile b { font: 800 20px 'Manrope', sans-serif; color: #f3dc9e; }
.ns-tile small { color: #a8936c; font-size: 11.5px; font-weight: 700; }
.ns-stats { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 8px; }
.ns-stat { display: grid; justify-items: center; padding: 8px 6px; border-radius: 12px; border: 1px solid rgba(143, 199, 255, .18); background: rgba(143, 199, 255, .04); }
.ns-stat small { color: #a8936c; font-size: 11.5px; font-weight: 700; }
.ns-stat b { font: 800 22px 'Manrope', sans-serif; }
.ns-stat em { font-style: normal; font-weight: 800; font-size: 12px; color: #8fc7ff; }
.ns-table { display: grid; gap: 2px; font-size: 13px; overflow-x: auto; }
.ns-tr { display: grid; grid-template-columns: minmax(110px, 1.3fr) minmax(80px, 1fr) minmax(80px, 1fr) 70px minmax(90px, 1.2fr); gap: 8px; padding: 6px 4px; border-top: 1px dashed rgba(231, 197, 111, .1); min-width: 480px; }
.ns-tr.th { border-top: 0; color: #a8936c; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; }
.ns-tr .dmg { color: #ff9b8f; font-weight: 800; }
.ns-tr .note { color: #a8936c; }

@media (max-width: 760px) {
  .ns-head { grid-template-columns: minmax(0, 1fr); }
  .ns-art { max-width: 320px; width: 100%; justify-self: center; }
  .ns-name { font-size: 28px; text-align: center; }
  .ns-kicker, .ns-badges { justify-content: center; }
  .ns-skills, .ns-skills.act { grid-template-columns: minmax(0, 1fr); }
}
</style>
