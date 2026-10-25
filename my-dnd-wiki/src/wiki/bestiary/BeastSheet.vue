<template>
  <!-- лист существа. Встретили — арт, имя, тип, опасность, описание; изучили — ещё характеристики, защиты, слабости, навыки.
       Мастеру — всё, кто что видит (встретили / изучили — по игрокам или всем), правка и арты -->
  <article class="bs" :class="el" :style="{ '--ec': E.color, '--eg': E.glow, '--dc': dangerColor(b.danger) }">
    <header class="bs-hero">
      <BeastArt :beast="b" :el="el" big class="bs-art" />
      <div class="bs-head">
        <small class="bs-kicker">{{ E.icon }} {{ b.group || 'Существо' }}<template v-if="b.hidden"> · 🔒 скрыто от игроков</template></small>
        <h1>{{ b.name }}</h1>
        <div class="bs-tags">
          <span v-if="b.type">{{ b.type }}</span><span v-if="b.race">{{ b.race }}</span><span v-if="b.size">{{ b.size }}</span>
          <span v-if="b.align && b.align !== 'Нет'">{{ b.align }}</span>
        </div>
        <div class="bs-danger"><i />Опасность: <b>{{ b.danger || '—' }}</b><template v-if="full && b.exp"> · ✦ {{ b.exp }} опыта</template></div>
        <div v-if="full" class="bs-big">
          <div class="bs-num hp"><small>Хиты</small><b>{{ shown.hp }}</b></div>
          <div class="bs-num def"><small>Защита</small><b>{{ shown.def }}</b></div>
          <div class="bs-num eva"><small>Уклонение</small><b>{{ shown.eva }}</b></div>
          <div class="bs-num bm"><small>БМ</small><b>{{ b.bm ? '+' + b.bm : '—' }}</b></div>
        </div>
        <p v-if="!master" class="bs-know" :class="{ full }">{{ full ? '📖 Изучено — известно всё' : '🔍 Встречено — повадки и сила пока неизвестны' }}</p>
        <div v-if="master" class="bs-acts">
          <button type="button" class="bs-btn primary" @click="$emit('edit')">✎ Править</button>
          <label class="bs-btn">🖼 Арт<input type="file" accept="image/*" hidden @change="addArt" /></label>
          <button type="button" class="bs-btn" @click="patch({ hidden: !b.hidden })">{{ b.hidden ? '👁 Показать в бестиарии' : '🔒 Скрыть совсем' }}</button>
        </div>
      </div>
    </header>

    <!-- мастер: кто встретил, кто изучил -->
    <section v-if="master" class="bs-card bs-vis">
      <div v-for="lv in LEVELS" :key="lv.key" class="bs-vis-row">
        <b>{{ lv.icon }} {{ lv.title }}</b><small>{{ lv.hint }}</small>
        <div class="bs-chips">
          <button type="button" class="all" :class="{ on: b[lv.key]?.all }" @click="toggleAll(lv.key)">Все</button>
          <button v-for="p in roster" :key="p.id" type="button" :class="{ on: b[lv.key]?.all || b[lv.key]?.ids.includes(p.id), dim: b[lv.key]?.all }" :style="{ '--pc': p.color || '#e7c56f' }" @click="togglePlayer(lv.key, p.id)">{{ p.character || p.name || 'Игрок' }}</button>
        </div>
      </div>
    </section>

    <section v-if="b.desc" class="bs-card"><RichText :text="b.desc" /></section>
    <section v-if="master && b.secret" class="bs-card bs-secret"><small>🔒 Заметки мастера</small><p>{{ b.secret }}</p></section>

    <template v-if="full">
      <section class="bs-card">
        <h2>Характеристики</h2>
        <div class="bs-stats">
          <div v-for="(s, i) in b.stats" :key="s.k" class="bs-stat" :style="{ '--i': i }">
            <small>{{ s.k }}</small><b>{{ s.v }}</b><i><i :style="{ width: Math.min(100, (Number(s.v) || 0) / 30 * 100) + '%' }" /></i>
          </div>
        </div>
        <div class="bs-line">
          <span v-for="s in b.senses" :key="s.k" class="bs-pill" :class="{ zero: !Number(s.v) }">{{ SENSE_ICON[s.k] || '•' }} {{ s.k }} {{ s.v }}</span>
          <span v-for="s in b.speed" :key="s.k" class="bs-pill" :class="{ zero: !Number(s.v) }">{{ SPEED_ICON[s.k] || '➜' }} {{ s.k === 'Базовая скорость' ? 'Скорость' : s.k }} {{ s.v }}</span>
          <span v-if="b.langs" class="bs-pill">🗣 Языки: {{ b.langs }}</span>
        </div>
      </section>

      <section class="bs-card">
        <h2>Защита и слабости</h2>
        <div class="bs-defs">
          <div v-for="d in DEF_BLOCKS.filter(d => b[d.key]?.length)" :key="d.key" class="bs-def" :class="d.cls">
            <small>{{ d.icon }} {{ d.title }}</small>
            <div><span v-for="x in b[d.key]" :key="x" class="bs-x">{{ x }}</span></div>
          </div>
        </div>
      </section>

      <section v-for="blk in SKILL_BLOCKS.filter(s => b[s.key]?.length)" :key="blk.key" class="bs-card bs-skills" :class="blk.cls">
        <h2>{{ blk.icon }} {{ blk.title }}</h2>
        <div class="bs-sk-list">
          <div v-for="(name, i) in b[blk.key]" :key="name" class="bs-sk" :style="{ '--i': i }">
            <div class="bs-sk-h">
              <b>{{ name }}</b>
              <small v-if="lib(blk.kind, name)?.type">{{ lib(blk.kind, name).type }}</small>
              <small v-if="lib(blk.kind, name)?.cooldown">⏳ {{ lib(blk.kind, name).cooldown }}</small>
              <small v-if="lib(blk.kind, name)?.cost">💧 {{ lib(blk.kind, name).cost }}</small>
              <button v-if="master" type="button" class="bs-sk-ed" :title="lib(blk.kind, name) ? 'Править описание (общее со справочником НПС)' : 'Описать навык (справочник НПС)'" @click="$emit('skill', blk.kind, { name })">✎</button>
            </div>
            <p v-if="lib(blk.kind, name)?.desc"><FxText :text="lib(blk.kind, name).desc" :effects="npcState.effects" /></p>
            <p v-else class="bs-sk-none">Описание пока не заполнено{{ master ? ' — нажми ✎' : '' }}.</p>
          </div>
        </div>
      </section>
    </template>
    <section v-else class="bs-card bs-locked">
      <div class="bs-blur"><span v-for="k in 6" :key="k" /></div>
      <p>📖 Существо не изучено. Характеристики, слабости и навыки откроются, когда мастер отметит, что вы его изучили —
        например, после проверки знаний, наблюдения или боя.</p>
    </section>

    <!-- мастер: арты -->
    <section v-if="master && b.arts?.length" class="bs-card bs-arts">
      <h2>Арты</h2>
      <div class="bs-art-list">
        <div v-for="(a, i) in b.arts" :key="a.id" class="bs-art-it" :class="{ cover: i === 0 }">
          <img :src="heroPortraitUrl(a.thumb || a.file)" alt="" />
          <span>
            <button v-if="i" type="button" title="Сделать главным" @click="artCall('POST', `/api/bestiary/${b.id}/arts/${a.id}/cover`)">★</button>
            <button type="button" title="Удалить" @click="confirm('Удалить арт?') && artCall('DELETE', `/api/bestiary/${b.id}/arts/${a.id}`)">✕</button>
          </span>
        </div>
      </div>
    </section>
  </article>
</template>

<script setup>
import { computed, onMounted, reactive, watch } from 'vue'
import { store, api, toast, npcState, heroPortraitUrl, uploadBeastArt, loadBestiary } from '../../map/store.js'
import RichText from '../../components/RichText.vue'
import FxText from '../npc/FxText.vue'
import BeastArt from './BeastArt.vue'
import { ELEMENTS, elementOf, dangerColor, SKILL_BLOCKS, DEF_BLOCKS } from './beasts.js'
import { skillIndex, skillKey } from '../../shared/npc.js'

const props = defineProps({ b: { type: Object, required: true }, master: Boolean })
defineEmits(['edit', 'skill'])
const el = computed(() => elementOf(props.b))
const E = computed(() => ELEMENTS[el.value])
const full = computed(() => props.master || props.b.studied)
const roster = computed(() => store.data.roster || [])
const skills = computed(() => skillIndex(npcState.skills))
const lib = (kind, name) => skills.value.get(skillKey(kind, name))
const LEVELS = [
  { key: 'seen', icon: '🔍', title: 'Встретили', hint: 'видят арт, имя, тип, опасность и описание' },
  { key: 'studied', icon: '📖', title: 'Изучили', hint: 'видят всё: характеристики, защиты, слабости, навыки' }
]
const SENSE_ICON = { Зрение: '👁', Слух: '👂', Аура: '✦' }
const SPEED_ICON = { 'Базовая скорость': '🦶', Полет: '🪽', Плавание: '🌊' }

// хиты, защита, уклонение — «набегают» при открытии
const shown = reactive({ hp: 0, def: 0, eva: 0 })
function countUp() {
  const to = { hp: Number(props.b.hp) || 0, def: Number(props.b.def) || 0, eva: Number(props.b.eva) || 0 }
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return Object.assign(shown, to)
  const t0 = performance.now()
  const step = t => {
    const k = Math.min(1, (t - t0) / 700), e = 1 - (1 - k) ** 3
    for (const x of ['hp', 'def', 'eva']) shown[x] = Math.round(to[x] * e)
    if (k < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}
onMounted(countUp)
watch(() => [props.b.hp, props.b.def, props.b.eva], countUp)

async function patch(body) {
  try { await api('PATCH', `/api/bestiary/${props.b.id}`, body); await loadBestiary(true) } catch (e) { toast(e.message, 'error') }
}
function toggleAll(key) { const w = props.b[key] || { all: false, ids: [] }; patch({ [key]: { ...w, all: !w.all } }) }
function togglePlayer(key, id) {
  const w = props.b[key] || { all: false, ids: [] }
  const ids = w.ids.includes(id) ? w.ids.filter(x => x !== id) : [...w.ids, id]
  // изучил — значит и встретил
  const extra = key === 'studied' && !w.ids.includes(id) && !props.b.seen?.ids.includes(id) ? { seen: { ...props.b.seen, ids: [...(props.b.seen?.ids || []), id] } } : {}
  patch({ [key]: { all: false, ids }, ...extra })
}
async function addArt(e) {
  const f = e.target.files?.[0]
  e.target.value = ''
  if (!f) return
  try { await uploadBeastArt(props.b.id, f); await loadBestiary(true); toast('Арт добавлен') } catch (err) { toast(err.message, 'error') }
}
async function artCall(method, url) {
  try { await api(method, url); await loadBestiary(true) } catch (e) { toast(e.message, 'error') }
}
const confirm = m => window.confirm(m)
</script>

<style scoped>
.bs { display: grid; gap: 14px; color: #efe3c8; font-family: 'Manrope', sans-serif; }
.bs-hero { display: grid; grid-template-columns: minmax(200px, 300px) minmax(0, 1fr); gap: 20px; align-items: start; animation: bs-in .5s cubic-bezier(.2, .8, .3, 1) both; }
.bs-art { box-shadow: 0 0 0 2px color-mix(in srgb, var(--ec) 55%, transparent), 0 20px 50px rgba(0, 0, 0, .6), 0 0 40px var(--eg); }
.bs-head { display: grid; gap: 8px; align-content: start; }
.bs-kicker { color: var(--ec); font: 800 11.5px 'Manrope', sans-serif; letter-spacing: .12em; text-transform: uppercase; }
.bs-head h1 { margin: 0; font: 700 44px/1 'Cormorant Garamond', serif; color: #f3dc9e; text-shadow: 0 0 24px var(--eg); }
.bs-tags { display: flex; flex-wrap: wrap; gap: 6px; }
.bs-tags span { padding: 2px 10px; border-radius: 99px; background: rgba(255, 255, 255, .06); color: #e6d4ad; font: 700 12px 'Manrope', sans-serif; }
.bs-danger { display: flex; align-items: center; gap: 6px; color: #cdbf9f; font: 600 13px 'Manrope', sans-serif; }
.bs-danger i { width: 10px; height: 10px; border-radius: 50%; background: var(--dc); box-shadow: 0 0 10px var(--dc); animation: bs-pulse 1.8s ease-in-out infinite; }
.bs-danger b { color: var(--dc); }
.bs-big { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-top: 4px; }
.bs-num { display: grid; justify-items: center; padding: 10px 6px; border-radius: 14px; background: linear-gradient(180deg, rgba(255, 255, 255, .06), rgba(0, 0, 0, .25)); border: 1px solid rgba(231, 197, 111, .18); }
.bs-num small { color: #a8936c; font: 800 10.5px 'Manrope', sans-serif; letter-spacing: .1em; text-transform: uppercase; }
.bs-num b { font: 700 32px/1.1 'Cormorant Garamond', serif; color: #f3dc9e; }
.bs-num.hp b { color: #ff9b8c; } .bs-num.def b { color: #9fc6ff; } .bs-num.eva b { color: #b4ecb0; }
.bs-know { margin: 0; padding: 6px 10px; border-radius: 10px; background: rgba(240, 181, 79, .1); color: #f6cf86; font: 700 12.5px 'Manrope', sans-serif; }
.bs-know.full { background: rgba(126, 208, 122, .1); color: #b4ecb0; }
.bs-acts { display: flex; flex-wrap: wrap; gap: 6px; }
.bs-btn { display: inline-flex; align-items: center; height: 32px; padding: 0 12px; border-radius: 9px; border: 1px solid rgba(231, 197, 111, .35); background: rgba(0, 0, 0, .3); color: #f3dc9e; font: 700 13px 'Manrope', sans-serif; cursor: pointer; }
.bs-btn.primary { background: linear-gradient(180deg, #f0d083, #c9a24f); color: #1b1408; border: 0; }
.bs-card { padding: 14px 16px; border-radius: 16px; background: linear-gradient(160deg, rgba(36, 28, 19, .82), rgba(18, 14, 10, .82)); border: 1px solid rgba(231, 197, 111, .16); animation: bs-in .5s cubic-bezier(.2, .8, .3, 1) both; animation-delay: .08s; }
.bs-card h2 { margin: 0 0 10px; font: 700 22px 'Cormorant Garamond', serif; color: #f3dc9e; }
.bs-vis { display: grid; gap: 10px; border-color: rgba(127, 180, 255, .3); }
.bs-vis-row { display: grid; gap: 4px; }
.bs-vis-row > b { font: 800 13px 'Manrope', sans-serif; color: #dfe8f7; }
.bs-vis-row > small { color: #8f9bb4; font-size: 11.5px; }
.bs-chips { display: flex; flex-wrap: wrap; gap: 4px; }
.bs-chips button { padding: 3px 10px; border-radius: 99px; border: 1px solid rgba(255, 255, 255, .14); background: none; color: #a8936c; font: 700 12px 'Manrope', sans-serif; cursor: pointer; transition: all .15s; }
.bs-chips button.on { border-color: var(--pc, #7fb4ff); background: color-mix(in srgb, var(--pc, #7fb4ff) 18%, transparent); color: #fff; }
.bs-chips button.all.on { --pc: #7fb4ff; }
.bs-chips button.dim { opacity: .55; }
.bs-secret small { color: #c9b8ff; font-weight: 800; }
.bs-secret p { margin: 4px 0 0; white-space: pre-wrap; color: #ddd3ef; }
.bs-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 8px; }
.bs-stat { display: grid; gap: 2px; padding: 8px 10px; border-radius: 12px; background: rgba(0, 0, 0, .28); animation: bs-in .4s ease both; animation-delay: calc(.1s + var(--i) * .05s); }
.bs-stat small { color: #a8936c; font: 800 10.5px 'Manrope', sans-serif; letter-spacing: .06em; text-transform: uppercase; }
.bs-stat b { font: 700 26px/1 'Cormorant Garamond', serif; color: #f3dc9e; }
.bs-stat > i { display: block; height: 4px; border-radius: 4px; background: rgba(255, 255, 255, .08); overflow: hidden; }
.bs-stat > i > i { display: block; height: 100%; background: linear-gradient(90deg, color-mix(in srgb, var(--ec) 60%, #000), var(--ec)); animation: bs-bar .9s cubic-bezier(.2, .8, .3, 1) both; animation-delay: calc(.2s + var(--i) * .06s); }
.bs-line { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.bs-pill { padding: 3px 10px; border-radius: 99px; background: rgba(255, 255, 255, .05); color: #e6d4ad; font: 700 12px 'Manrope', sans-serif; }
.bs-pill.zero { opacity: .45; }
.bs-defs { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; }
.bs-def { padding: 8px 10px; border-radius: 12px; background: rgba(0, 0, 0, .25); border-left: 3px solid #a8936c; }
.bs-def small { display: block; margin-bottom: 4px; color: #cdbf9f; font: 800 11px 'Manrope', sans-serif; letter-spacing: .06em; text-transform: uppercase; }
.bs-def div { display: flex; flex-wrap: wrap; gap: 4px 6px; font: 700 13px 'Manrope', sans-serif; }
.bs-x { padding: 2px 9px; border-radius: 99px; background: rgba(255, 255, 255, .06); color: #efe3c8; }
.bs-def.res .bs-x { background: rgba(127, 180, 255, .14); color: #cfe2ff; } .bs-def.vul .bs-x { background: rgba(255, 122, 107, .14); color: #ffc9c2; }
.bs-def.imm .bs-x { background: rgba(243, 211, 107, .14); color: #f8e6a8; }
.bs-def.res { border-color: #7fb4ff; } .bs-def.vul { border-color: #ff7a6b; } .bs-def.imm { border-color: #f3d36b; } .bs-def.pro { border-color: #b4ecb0; } .bs-def.sav { border-color: #c9a6ff; }
.bs-sk-list { display: grid; gap: 8px; }
.bs-sk { padding: 9px 12px; border-radius: 12px; background: rgba(0, 0, 0, .25); border: 1px solid rgba(231, 197, 111, .1); animation: bs-in .4s ease both; animation-delay: calc(.1s + var(--i) * .05s); }
.bs-sk-h { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.bs-sk-h b { color: #f3dc9e; font: 800 14.5px 'Manrope', sans-serif; }
.bs-sk-h small { padding: 1px 7px; border-radius: 99px; background: rgba(255, 255, 255, .05); color: #a8936c; font: 700 11px 'Manrope', sans-serif; }
.bs-sk-ed { margin-left: auto; width: 26px; height: 26px; border-radius: 8px; border: 1px solid rgba(231, 197, 111, .3); background: none; color: #f3dc9e; cursor: pointer; }
.bs-sk p { margin: 4px 0 0; color: #ddd0b4; font: 500 13px/1.5 'Manrope', sans-serif; }
.bs-sk .bs-sk-none { color: #7d7160; font-style: italic; }
.bs-skills.legend { border-color: rgba(243, 211, 107, .5); box-shadow: 0 0 30px rgba(243, 211, 107, .12); }
.bs-skills.legend h2 { color: #f3d36b; text-shadow: 0 0 14px rgba(243, 211, 107, .5); }
.bs-skills.myth { border-color: rgba(201, 166, 255, .5); box-shadow: 0 0 30px rgba(170, 130, 255, .15); }
.bs-skills.myth h2 { color: #d7c4ff; text-shadow: 0 0 14px rgba(170, 130, 255, .55); }
.bs-locked { position: relative; overflow: hidden; }
.bs-blur { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; filter: blur(6px); opacity: .5; }
.bs-blur span { height: 46px; border-radius: 10px; background: linear-gradient(90deg, rgba(231, 197, 111, .15), rgba(231, 197, 111, .05)); }
.bs-locked p { position: relative; margin: 12px 0 0; color: #cdbf9f; font: 600 13.5px/1.5 'Manrope', sans-serif; text-align: center; }
.bs-art-list { display: flex; flex-wrap: wrap; gap: 8px; }
.bs-art-it { position: relative; width: 96px; height: 120px; border-radius: 10px; overflow: hidden; border: 1px solid rgba(231, 197, 111, .2); }
.bs-art-it.cover { border-color: #e7c56f; box-shadow: 0 0 12px rgba(231, 197, 111, .4); }
.bs-art-it img { width: 100%; height: 100%; object-fit: cover; }
.bs-art-it span { position: absolute; top: 4px; right: 4px; display: flex; gap: 3px; }
.bs-art-it button { width: 22px; height: 22px; border-radius: 6px; border: 0; background: rgba(0, 0, 0, .7); color: #f3dc9e; cursor: pointer; font-size: 11px; }
@keyframes bs-in { from { opacity: 0; transform: translateY(10px); } }
@keyframes bs-bar { from { width: 0; } }
@keyframes bs-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .45; } }
@media (max-width: 760px) {
  .bs-hero { grid-template-columns: minmax(0, 1fr); }
  .bs-art { max-width: 320px; }
  .bs-head h1 { font-size: 34px; }
  .bs-big { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (prefers-reduced-motion: reduce) { .bs-hero, .bs-card, .bs-stat, .bs-sk, .bs-stat > i > i, .bs-danger i { animation: none; } }
</style>
