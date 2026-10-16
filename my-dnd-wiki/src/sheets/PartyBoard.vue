<template>
  <!-- сводка отряда для мастера: хиты, защита, мана и ресурсы всех персонажей вживую; хиты можно править прямо здесь -->
  <div class="pb">
    <div class="pb-tools">
      <label class="pb-chk"><input v-model="withNpc" type="checkbox" /> Показывать листы без игрока</label>
      <span class="grow" />
      <small>Меняется вживую, когда игроки правят листы</small>
    </div>
    <div v-if="!list.length" class="pb-empty">Пока нет листов, привязанных к игрокам.</div>
    <div class="pb-grid">
      <article v-for="(s, i) in list" :key="s.id" class="pb-card" :style="{ '--acc': s.accent || '#C9A24F', '--i': i }" :class="{ down: s.hp.max && s.hp.cur <= 0, lvlup: leveled.has(s.id) }">
        <span v-if="leveled.has(s.id)" class="pb-lvl">⬆ {{ s.level }} уровень!</span>
        <header>
          <router-link :to="`/sheets/${s.id}`" class="pb-av" :title="`Открыть лист: ${s.name}`"><img v-if="s.photo" :src="sheetImg(s.photo)" alt="" /><span v-else>{{ s.name[0] }}</span></router-link>
          <div class="pb-id">
            <router-link :to="`/sheets/${s.id}`" class="pb-name">{{ s.name }}</router-link>
            <small>{{ [s.cls, s.level ? s.level + ' ур.' : ''].filter(Boolean).join(' · ') }}<template v-if="s.ownerName"> · {{ s.ownerName.split(' · ')[0] }}</template></small>
          </div>
          <div class="pb-def" title="Броня / уклонение"><span>🛡 {{ s.defense }}</span><span>💨 {{ s.evasion }}</span></div>
        </header>

        <div class="pb-hp">
          <div class="pb-bar"><i :style="{ width: pct(s) + '%' }" :class="tone(s)" /><i v-if="s.hp.temp" class="t" :style="{ width: Math.min(100, s.hp.temp / Math.max(1, s.hp.max) * 100) + '%' }" /></div>
          <div class="pb-hp-row">
            <b class="pb-hp-n">❤ {{ s.hp.cur }}<small> / {{ s.hp.max }}</small><em v-if="s.hp.temp"> +{{ s.hp.temp }}</em></b>
            <span class="grow" />
            <input v-model.number="amt[s.id]" type="number" min="0" class="pb-amt" placeholder="±" @keydown.enter="hit(s, -1)" />
            <button type="button" class="heal" title="Лечение" :disabled="!amt[s.id]" @click="hit(s, 1)">❤</button>
            <button type="button" class="dmg" title="Урон (сначала временные хиты)" :disabled="!amt[s.id]" @click="hit(s, -1)">⚔</button>
          </div>
        </div>

        <div class="pb-pools">
          <span v-if="s.mana" class="mana">✦ Мана {{ s.mana }}</span>
          <span v-if="s.stamina" class="sta">⚡ Выносл. {{ s.stamina }}</span>
          <span v-if="s.superHits && s.superHits !== '0'" class="sup">💠 {{ s.superHits }}</span>
          <span v-if="s.exhaustion" class="exh">Изнурение {{ s.exhaustion }}</span>
          <span v-if="s.ds.some(Boolean)" class="ds" title="Спасброски от смерти">☠ <i v-for="k in 3" :key="'s' + k" :class="{ on: s.ds[k - 1] }" class="ok" /><i v-for="k in 3" :key="'f' + k" :class="{ on: s.ds[k + 2] }" class="bad" /></span>
        </div>

        <!-- что сейчас тренирует: ближе всего к завершению — первым -->
        <div v-if="s.train?.length" class="pb-train" :title="trainTitle(s)">
          <span class="pb-tr-h">🏋 Тренирует <small v-if="s.train.length > 2">ещё {{ s.train.length - 2 }}</small></span>
          <div v-for="(t, ti) in s.train.slice(0, 2)" :key="ti" class="pb-tr">
            <span class="pb-tr-n">{{ t.name }}<small v-if="t.stage"> · {{ t.stage }}</small></span>
            <span class="pb-tr-bar"><i :style="{ width: (t.max ? Math.min(100, t.cur / t.max * 100) : 0) + '%' }" /></span>
            <span class="pb-tr-v">{{ t.cur }}<small>/{{ t.max }}</small></span>
          </div>
        </div>
        <div v-if="s.res.length" class="pb-res">
          <div v-for="(r, ri) in s.res" :key="r.id || ri" class="pb-r" :style="{ '--rc': r.color || 'var(--acc)' }">
            <span class="pb-r-n">{{ r.icon }} {{ r.name }}</span>
            <span v-if="r.style === 'number' || r.max > 20" class="pb-r-num">
              <button type="button" @click="setRes(s, ri, r.cur - 1)">−</button><b>{{ r.cur }}</b><small v-if="r.max">/{{ r.max }}</small><button type="button" @click="setRes(s, ri, r.cur + 1)">＋</button>
            </span>
            <span v-else class="pb-r-pips" @contextmenu.prevent="setRes(s, ri, r.cur - 1)">
              <i v-for="k in r.max" :key="k" :class="[{ on: k <= r.cur }, r.style]" @click="setRes(s, ri, k === r.cur ? k - 1 : k)" />
            </span>
          </div>
        </div>
      </article>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { sfx } from '../sound/sound.js'
import { api, toast } from '../map/store.js'
import { sheets, loadSheets, sheetImg } from './sheetState.js'

const withNpc = ref(false)
// подсказка: все тренировки «в процессе» построчно
const trainTitle = s => s.train.map(t => `${t.name}${t.stage ? ` (${t.stage})` : ''}: ${t.cur}/${t.max}`).join('\n')
// кто-то поднял уровень — карточка на пару секунд вспыхивает золотом
const leveled = reactive(new Set())
const lastLevel = new Map()
watch(() => sheets.list.map(s => [s.id, s.level]), list => {
  for (const [id, lv] of list) {
    const was = lastLevel.get(id)
    lastLevel.set(id, lv)
    if (was != null && lv > was) {
      leveled.add(id)
      sfx('crit', 0.4)
      setTimeout(() => leveled.delete(id), 3200)
    }
  }
}, { immediate: true })
const amt = reactive({})
const list = computed(() => sheets.list.filter(s => !s.deletedAt && (withNpc.value || s.ownerName)).sort((a, b) => a.name.localeCompare(b.name, 'ru')))
const pct = s => (s.hp.max > 0 ? Math.max(0, Math.min(100, (s.hp.cur / s.hp.max) * 100)) : 0)
const tone = s => (pct(s) <= 25 ? 'low' : pct(s) <= 55 ? 'mid' : '')
async function patch(s, ops) {
  try { await api('PATCH', `/api/sheets/${s.id}`, { ops }) } catch (e) { toast(e.message, 'error'); loadSheets() }
}
function hit(s, sign) {
  let n = Math.abs(Math.round(Number(amt[s.id]) || 0))
  if (!n) return
  const ops = []
  if (sign < 0) {
    if (s.hp.temp > 0) { const a = Math.min(s.hp.temp, n); s.hp.temp -= a; n -= a; ops.push({ p: 'HpData.Temp', v: s.hp.temp }) }
    s.hp.cur = Math.max(0, s.hp.cur - n)
  } else s.hp.cur = s.hp.max > 0 ? Math.min(s.hp.max, s.hp.cur + n) : s.hp.cur + n
  ops.push({ p: 'HpData.Current', v: s.hp.cur })
  amt[s.id] = null
  patch(s, ops)
}
function setRes(s, ri, v) {
  const r = s.res[ri]
  r.cur = Math.max(0, r.style === 'number' ? v : Math.min(r.max, v))
  patch(s, [{ p: `Resources.${ri}.Current`, v: r.cur }])
}
</script>

<style scoped>
.pb-tools { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-bottom: 14px; color: #a8936c; font: 600 12.5px 'Manrope', sans-serif; }
.pb-chk { display: flex; align-items: center; gap: 6px; cursor: pointer; }
.grow { flex: 1; }
.pb-empty { padding: 40px; text-align: center; color: #a8936c; border: 1px dashed rgba(231, 197, 111, .2); border-radius: 16px; }
.pb-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 330px), 1fr)); gap: 14px; }
.pb-card { display: grid; gap: 10px; padding: 12px; border-radius: 16px; background: linear-gradient(180deg, color-mix(in srgb, var(--acc) 8%, #1d1710), #14100b); border: 1px solid color-mix(in srgb, var(--acc) 35%, #3b2a1a); box-shadow: 0 12px 30px rgba(0, 0, 0, .45); animation: pb-in .45s cubic-bezier(.2, .9, .3, 1.15) both; animation-delay: calc(var(--i) * 50ms); transition: box-shadow .3s; }
.pb-card { position: relative; }
.pb-card.lvlup { animation: pb-lvl 3.2s ease-out; }
@keyframes pb-lvl { 0% { box-shadow: 0 0 0 0 rgba(255, 209, 102, 0); } 12% { box-shadow: 0 0 0 3px #ffd166, 0 0 40px rgba(255, 209, 102, .7); transform: translateY(-4px) scale(1.02); } 100% { box-shadow: 0 12px 30px rgba(0, 0, 0, .45); } }
.pb-lvl { position: absolute; right: 12px; top: -12px; z-index: 2; padding: 3px 10px; border-radius: 99px; background: linear-gradient(180deg, #ffe39a, #e0a93e); color: #1b140c; font: 900 12px 'Manrope', sans-serif; box-shadow: 0 0 16px rgba(255, 209, 102, .7); animation: pb-lvl-tag 3.2s ease-out forwards; }
@keyframes pb-lvl-tag { 0% { transform: translateY(10px) scale(.6); opacity: 0; } 12% { transform: none; opacity: 1; } 80% { opacity: 1; } 100% { transform: translateY(-8px); opacity: 0; } }
.pb-card.down { border-color: rgba(255, 107, 94, .6); box-shadow: 0 0 26px rgba(255, 90, 70, .25); }
@keyframes pb-in { from { opacity: 0; transform: translateY(18px) scale(.97); } }
.pb-card header { display: flex; align-items: center; gap: 10px; }
.pb-av { display: grid; place-items: center; width: 48px; height: 48px; flex: none; border-radius: 50%; overflow: hidden; border: 2px solid var(--acc); background: #120d08; color: var(--acc); font: 700 22px 'Cormorant Garamond', serif; text-decoration: none; }
.pb-av img { width: 100%; height: 100%; object-fit: cover; }
.pb-id { flex: 1; min-width: 0; display: grid; }
.pb-name { color: #f3dc9e; font: 700 19px 'Cormorant Garamond', serif; text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pb-name:hover { color: var(--acc); }
.pb-id small { color: #a8936c; font: 700 11.5px 'Manrope', sans-serif; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pb-def { display: grid; gap: 2px; font: 800 12.5px 'Manrope', sans-serif; color: #d9c9a6; text-align: right; }
.pb-hp { display: grid; gap: 6px; }
.pb-bar { position: relative; height: 12px; border-radius: 99px; background: rgba(0, 0, 0, .5); overflow: hidden; }
.pb-bar i { position: absolute; left: 0; top: 0; bottom: 0; background: linear-gradient(90deg, #3fae5a, #7ee06a); transition: width .5s cubic-bezier(.2, .9, .3, 1); }
.pb-bar i.mid { background: linear-gradient(90deg, #c98a1f, #ffd166); }
.pb-bar i.low { background: linear-gradient(90deg, #a5281c, #ff6b5e); }
.pb-bar i.t { left: auto; right: 0; background: repeating-linear-gradient(45deg, #4fd8ff, #4fd8ff 4px, #2a8db0 4px, #2a8db0 8px); }
.pb-hp-row { display: flex; align-items: center; gap: 5px; }
.pb-hp-n { font: 800 17px 'Manrope', sans-serif; color: #efe3c8; }
.pb-hp-n small { color: #a8936c; font-size: 13px; }
.pb-hp-n em { color: #4fd8ff; font-style: normal; font-size: 13px; }
.pb-amt { width: 62px; padding: 4px 6px; border-radius: 8px; border: 1px solid rgba(231, 197, 111, .25); background: rgba(0, 0, 0, .3); color: #efe3c8; font: 700 13px 'Manrope', sans-serif; color-scheme: dark; }
.pb-hp-row button { width: 30px; height: 28px; border-radius: 8px; border: 1px solid; background: none; cursor: pointer; }
.pb-hp-row button:disabled { opacity: .35; cursor: default; }
.pb-hp-row .heal { border-color: rgba(126, 224, 106, .45); color: #a8e6a1; }
.pb-hp-row .dmg { border-color: rgba(255, 122, 107, .45); color: #ff9b8f; }
.pb-pools { display: flex; flex-wrap: wrap; gap: 5px; }
.pb-pools > span { padding: 2px 8px; border-radius: 99px; background: rgba(0, 0, 0, .3); font: 700 11.5px 'Manrope', sans-serif; color: #d9c9a6; }
.pb-pools .mana { color: #9fb4ff; }
.pb-pools .sta { color: #ffd166; }
.pb-pools .exh { color: #ff9b8f; }
.pb-pools .ds { display: inline-flex; align-items: center; gap: 3px; }
.pb-pools .ds i { width: 8px; height: 8px; border-radius: 50%; border: 1px solid; }
.pb-pools .ds i.ok { border-color: #5cc96f; } .pb-pools .ds i.ok.on { background: #5cc96f; }
.pb-pools .ds i.bad { border-color: #e5483b; } .pb-pools .ds i.bad.on { background: #e5483b; }
.pb-res { display: grid; gap: 5px; }
.pb-train { display: grid; gap: 4px; padding: 6px 8px; border-radius: 10px; background: rgba(0, 0, 0, .22); border: 1px solid rgba(230, 194, 90, .18); }
.pb-tr-h { font: 800 10px 'Manrope', sans-serif; letter-spacing: .12em; text-transform: uppercase; color: #a8936c; }
.pb-tr-h small { letter-spacing: 0; text-transform: none; opacity: .8; }
.pb-tr { display: grid; grid-template-columns: minmax(0, 1fr) 70px auto; align-items: center; gap: 8px; }
.pb-tr-n { font: 700 12.5px 'Manrope', sans-serif; color: #d9c9a6; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pb-tr-n small { color: #a8936c; }
.pb-tr-bar { height: 7px; border-radius: 99px; background: rgba(0, 0, 0, .45); overflow: hidden; }
.pb-tr-bar i { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #b8893f, #e6c25a); transition: width .6s; }
.pb-tr-v { font: 800 12px 'Manrope', sans-serif; color: #e6c25a; font-variant-numeric: tabular-nums; }
.pb-tr-v small { color: #a8936c; }
.pb-r { display: flex; align-items: center; gap: 8px; }
.pb-r-n { flex: 1; min-width: 0; font: 700 12.5px 'Manrope', sans-serif; color: #d9c9a6; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pb-r-pips { display: flex; flex-wrap: wrap; gap: 3px; justify-content: flex-end; }
.pb-r-pips i { width: 13px; height: 13px; border-radius: 50%; border: 2px solid color-mix(in srgb, var(--rc) 60%, transparent); cursor: pointer; transition: background .2s; }
.pb-r-pips i.ammo { width: 8px; height: 15px; border-radius: 3px; }
.pb-r-pips i.boxes { border-radius: 4px; }
.pb-r-pips i.on { background: var(--rc); }
.pb-r-num { display: flex; align-items: center; gap: 4px; font: 800 14px 'Manrope', sans-serif; color: var(--rc); }
.pb-r-num small { color: #a8936c; }
.pb-r-num button { width: 22px; height: 22px; border-radius: 6px; border: 1px solid rgba(231, 197, 111, .25); background: none; color: #efe3c8; cursor: pointer; }
</style>
