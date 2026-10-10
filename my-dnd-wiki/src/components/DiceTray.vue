<template>
  <!-- кубики: кнопка в углу, панель броска, 3D-кубики по экрану у бросающего, карточки с результатом у всех -->
  <div v-if="store.me" class="dt" :class="{ raised: route.path.startsWith('/settlement') }">
    <!-- 3D-кубики (dice-box) — поверх всего, мышь не перехватывают -->
    <div id="dice-box" class="dt-3d" :class="{ on: rolling3d }" />

    <!-- карточки бросков: свои и чужие -->
    <div class="dt-pops" aria-live="polite">
      <TransitionGroup name="dt-pop">
        <div v-for="p in dice.pops" :key="p.key" class="dt-card" :class="{ crit: isCrit(p), fail: isFail(p), secret: p.secret }" :style="{ '--pc': p.color || '#e6c27a' }">
          <img v-if="p.avatar" :src="avatarUrl(p.avatar)" alt="" class="dt-av" />
          <span v-else class="dt-av ini">{{ (p.name || '?')[0] }}</span>
          <div class="dt-who">
            <b>{{ p.mine ? 'Твой бросок' : p.name }}<em v-if="p.secret"> · 🔒 тайно</em></b>
            <small>{{ p.label ? p.label + ' · ' : '' }}{{ p.notation }}<em v-if="p.adv" class="dt-advtag" :class="p.adv">{{ ADV_SIGN[p.adv] }} {{ ADV_LABEL[p.adv] }}</em><template v-if="p.groups?.length"> · <span v-for="(x, i) in detailParts(p)" :key="i" :class="{ 'dt-drop': x.drop }">{{ x.t }}</span></template></small>
          </div>
          <div class="dt-total"><span class="dt-num">{{ p.total }}</span><i v-if="isCrit(p)">КРИТ!</i><i v-else-if="isFail(p)">провал</i></div>
        </div>
      </TransitionGroup>
    </div>

    <button type="button" class="dt-fab" :class="{ open }" :title="open ? 'Закрыть' : 'Бросить кубики'" @click="open = !open; open && sfx('diceGrab', 0.22)">🎲</button>

    <section v-if="open" class="dt-panel" @keydown.enter.prevent="roll">
      <header><b>Кубики</b><small>Enter — бросить</small></header>
      <div class="dt-dice">
        <button v-for="d in SIDES" :key="d" type="button" :class="{ on: pick[d] }" :title="`Добавить d${d}; правый щелчок — убрать`" @click="pick[d] = Math.min(20, (pick[d] || 0) + 1)" @contextmenu.prevent="pick[d] = Math.max(0, (pick[d] || 0) - 1)">
          <span class="dt-die">d{{ d }}</span><em v-if="pick[d]">×{{ pick[d] }}</em>
        </button>
      </div>
      <!-- преимущество / помеха: d20 бросается дважды, засчитывается больший / меньший -->
      <div class="dt-adv" role="group" aria-label="Преимущество или помеха">
        <button v-for="m in ADV_BTNS" :key="m.v" type="button" :class="[m.v || 'plain', { on: mode === m.v }]" :title="m.hint" @click="setMode(m.v)">{{ m.t }}</button>
      </div>
      <!-- формула: пишется сама от кнопок, а можно набрать руками — кнопки подстроятся -->
      <label class="dt-formula">Формула
        <span class="dt-frow">
          <input v-model="text" :class="{ bad: textError }" placeholder="2d6 + 1d20 + 3" spellcheck="false" autocomplete="off" @input="fromText" />
          <button type="button" class="dt-star" title="Запомнить формулу (с подписью «Что бросаем»)" :disabled="!formula" @click="saveFav">☆</button>
        </span>
        <small v-if="textError || advError" class="dt-err">{{ textError || advError }}</small>
      </label>
      <div v-if="favs.length" class="dt-favs">
        <button v-for="(fv, i) in favs" :key="i" type="button" :title="`${fv.formula} — щелчок: подставить, правый щелчок: забыть`" @click="useFav(fv)" @contextmenu.prevent="dropFav(i)">★ {{ fv.label || fv.formula }}</button>
      </div>
      <div class="dt-row">
        <label>Модификатор
          <span class="dt-mod"><button type="button" @click="mod--">−</button><input v-model.number="mod" type="number" min="-99" max="99" /><button type="button" @click="mod++">+</button></span>
        </label>
        <label class="grow">Что бросаем<input v-model.trim="label" maxlength="60" placeholder="Атлетика, атака секирой…" /></label>
      </div>
      <label v-if="store.role === 'master'" class="dt-chk"><input v-model="secret" type="checkbox" /> 🔒 Тайно — увидят только мастера</label>
      <div class="dt-acts">
        <button type="button" class="dt-btn" @click="quick(20)">d20</button>
        <button type="button" class="dt-btn" @click="quick(100)">d100</button>
        <span class="grow" />
        <button type="button" class="dt-btn" :disabled="!formula" @click="clearPick(); mode = ''">Сброс</button>
        <button type="button" class="dt-btn primary" :disabled="!formula || busy || !!textError || !!advError" @click="roll">{{ busy ? 'Катятся…' : 'Бросить' }}</button>
      </div>
      <div v-if="dice.rolls.length" class="dt-log">
        <div v-for="(r, i) in dice.rolls.slice(0, 12)" :key="i" class="dt-line" :style="{ '--pc': r.color || '#e6c27a' }">
          <i class="dot" /><b>{{ r.mine ? 'Ты' : r.name }}</b>
          <span>{{ r.label ? r.label + ' · ' : '' }}{{ r.notation }}{{ r.adv ? ' ' + ADV_SIGN[r.adv] : '' }}{{ r.secret ? ' 🔒' : '' }}</span>
          <strong :class="{ crit: isCrit(r), fail: isFail(r) }">{{ r.total }}</strong>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { store, dice, sendRoll, avatarUrl, toast } from '../map/store.js'
import { sfx } from '../sound/sound.js'
import { ADV_LABEL, keptIndex, natural } from '../shared/dice.js'

const route = useRoute() // в поселении внизу слева шкала масштаба — кнопку поднимаем

const SIDES = [4, 6, 8, 10, 12, 20, 100]
const open = ref(false)
const pick = reactive({})
const mod = ref(0)
const label = ref('')
const secret = ref(false)
const busy = ref(false)
const rolling3d = ref(false)
// преимущество / помеха: держится, пока не сбросят; работает, когда в формуле один d20
const mode = ref('')
const ADV_SIGN = { adv: '▲', dis: '▼' }
const ADV_BTNS = [
  { v: '', t: 'Обычный', hint: 'Обычный бросок' },
  { v: 'adv', t: '▲ Преимущество', hint: 'd20 бросается дважды, засчитывается больший' },
  { v: 'dis', t: '▼ Помеха', hint: 'd20 бросается дважды, засчитывается меньший' }
]
function setMode(v) {
  mode.value = v
  if (v && !pick[20]) pick[20] = 1 // нечего было усиливать — добавляем d20
}
const advOn = computed(() => (mode.value && pick[20] ? mode.value : ''))
const advError = computed(() => (advOn.value && pick[20] > 1 ? 'Преимущество и помеха — только для одного d20' : ''))
const formula = computed(() => {
  const parts = SIDES.filter(d => pick[d]).map(d => `${pick[d]}d${d}`)
  if (!parts.length) return ''
  const m = Number(mod.value) || 0
  return parts.join(' + ') + (m ? (m > 0 ? ` + ${m}` : ` − ${-m}`) : '') + (advOn.value ? ` ${ADV_LABEL[advOn.value]}` : '')
})
const clearPick = () => { for (const d of SIDES) pick[d] = 0; mod.value = 0 }

// строка формулы: от кнопок — сама, руками — разбираем и выставляем кнопки и модификатор
const text = ref('')
const textError = ref('')
let typing = false
watch(formula, v => { if (!typing) { text.value = v.replace(/−/g, '-'); textError.value = '' } })
function parseFormula(raw) {
  // слова «преимущество» / «помеха» (или adv / dis) — где угодно в строке
  let adv = ''
  const src = String(raw || '').toLowerCase()
    .replace(/\(?\s*(преим[а-яё]*|adv[a-z]*)\s*\)?/g, () => { adv = 'adv'; return ' ' })
    .replace(/\(?\s*(помех[а-яё]*|dis[a-z]*)\s*\)?/g, () => { adv = 'dis'; return ' ' })
    .replace(/[кд]/g, 'd').replace(/[−–—]/g, '-').replace(/\s+/g, '')
  if (!src) return { counts: {}, mod: 0, adv }
  const counts = {}
  let m = 0, pos = 0
  const re = /([+-]?)(\d*)d(\d+)|([+-]?)(\d+)/y
  while (pos < src.length) {
    re.lastIndex = pos
    const t = re.exec(src)
    if (!t || (pos > 0 && !(t[1] || t[4]))) return { error: `Не понимаю «${src.slice(pos, pos + 8)}» — пиши так: 2d6 + 1d20 + 3` }
    if (t[3]) {
      const sides = Number(t[3]), n = t[2] === '' ? 1 : Number(t[2])
      if (t[1] === '-') return { error: 'Вычитать кубики нельзя — только число' }
      if (!SIDES.includes(sides)) return { error: `Нет кубика d${sides} — есть d4, d6, d8, d10, d12, d20, d100` }
      counts[sides] = (counts[sides] || 0) + n
      if (counts[sides] > 20 || n < 1) return { error: 'От 1 до 20 кубиков одного вида' }
    } else m += (t[4] === '-' ? -1 : 1) * Number(t[5])
    pos = re.lastIndex
  }
  if (Math.abs(m) > 99) return { error: 'Модификатор — от −99 до 99' }
  if (adv && counts[20] !== 1) return { error: 'Преимущество и помеха — только для одного d20' }
  return { counts, mod: m, adv }
}
function applyText(v) {
  const p = parseFormula(v)
  if (p.error) { textError.value = p.error; return false }
  textError.value = ''
  typing = true
  for (const d of SIDES) pick[d] = p.counts[d] || 0
  mod.value = p.mod
  mode.value = p.adv
  nextTick(() => { typing = false })
  return true
}
const fromText = () => applyText(text.value)

// любимые формулы — в этом браузере
const FAV_KEY = 'anacaria-dice-favs'
const favs = ref((() => { try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]') } catch { return [] } })())
const keepFavs = () => { try { localStorage.setItem(FAV_KEY, JSON.stringify(favs.value)) } catch { /* приватный режим */ } }
function saveFav() {
  const fv = { formula: text.value.trim() || formula.value, label: label.value }
  favs.value = [fv, ...favs.value.filter(x => x.formula !== fv.formula || x.label !== fv.label)].slice(0, 10)
  keepFavs()
  toast(`Формула запомнена: ${fv.label || fv.formula}`)
}
function useFav(fv) { text.value = fv.formula; label.value = fv.label || ''; applyText(fv.formula) }
function dropFav(i) { favs.value.splice(i, 1); keepFavs() }
function quick(d) { clearPick(); pick[d] = 1; roll() }

// натуральная 20 / 1 — только если бросали один d20 (с преимуществом — по засчитанному)
const isCrit = r => natural(r) === 20
const isFail = r => natural(r) === 1
// звук на каждую новую карточку: свой бросок — крит/провал, чужой — «плюк»
watch(() => dice.pops.length, (n, o) => {
  if (n <= o) return
  const p = dice.pops[n - 1]
  if (isCrit(p)) sfx('crit')
  else if (isFail(p)) sfx('fail')
  else if (!p.mine) sfx('roll', 0.4)
})
// значения по видам кубиков; при преимуществе/помехе незасчитанный d20 — зачёркнут
const detailParts = r => (r.groups || []).flatMap((g, gi) => {
  const k = keptIndex(g, r.adv)
  return [...(gi ? [{ t: ' | ' }] : []), ...g.values.flatMap((v, i) => [...(i ? [{ t: ', ' }] : []), { t: String(v), drop: k !== -1 && i !== k }])]
})

// 3D: библиотека тяжёлая — грузим при первом броске, дальше переиспользуем
let box = null, boxReady = null, clearTimer = 0
function getBox() {
  boxReady ||= (async () => {
    const { default: DiceBox } = await import('@3d-dice/dice-box')
    const b = new DiceBox({ assetPath: '/assets/dice-box/', container: '#dice-box', theme: 'default', themeColor: '#b8862e', scale: 6, gravity: 1.4, throwForce: 6, spinForce: 5, settleTimeout: 4000, offscreen: true })
    await b.init()
    box = b
    return b
  })().catch(e => { boxReady = null; throw e })
  return boxReady
}
// без 3D (старый браузер, «меньше анимаций») — честный случайный бросок
// сколько кубиков катить: при преимуществе/помехе d20 — два
const howMany = d => (d === 20 && advOn.value ? 2 : pick[d])
const randomRoll = () => SIDES.filter(d => pick[d]).map(d => ({ sides: d, values: Array.from({ length: howMany(d) }, () => 1 + Math.floor(Math.random() * d)) }))

async function roll() {
  if (textError.value || advError.value || !formula.value || busy.value) return
  busy.value = true
  sfx('diceShake')
  const m = Number(mod.value) || 0
  const meta = { mod: m, adv: advOn.value, label: label.value, secret: secret.value && store.role === 'master' }
  const notation = SIDES.filter(d => pick[d]).map(d => `${howMany(d)}d${d}`)
  try {
    let groups
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) groups = randomRoll()
    else {
      const b = await getBox()
      clearTimeout(clearTimer)
      rolling3d.value = true
      b.clear()
      setTimeout(() => sfx('diceThrow'), 350)
      const res = await b.roll(notation)
      // roll() отдаёт плоский список кубиков { sides, value } — собираем по видам; «0» у d10/d100 — это 10/100
      const by = new Map()
      for (const d of res) {
        const sides = Number(d.sides)
        if (!by.has(sides)) by.set(sides, [])
        by.get(sides).push(d.value <= 0 ? sides : d.value)
      }
      groups = [...by].map(([sides, values]) => ({ sides, values }))
      clearTimer = setTimeout(() => { b.clear(); rolling3d.value = false }, 2600)
    }
    sendRoll({ groups, ...meta })
  } catch (e) {
    console.warn('[dice] 3D не завелось, бросаю без анимации', e)
    rolling3d.value = false
    sendRoll({ groups: randomRoll(), ...meta })
    toast('3D-кубики не загрузились — бросил без анимации', 'error')
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.dt-3d { position: fixed; inset: 0; z-index: 440; pointer-events: none; opacity: 0; transition: opacity .3s; }
.dt-3d.on { opacity: 1; }
.dt-3d :deep(canvas) { width: 100% !important; height: 100% !important; }

.dt-fab { position: fixed; left: 14px; bottom: 14px; z-index: 260; width: 48px; height: 48px; border-radius: 50%; border: 1px solid #8a6630; background: radial-gradient(circle at 35% 30%, #3a2c18, #15110c 70%); box-shadow: 0 8px 22px rgba(0, 0, 0, .5), 0 0 0 3px rgba(20, 16, 11, .8); font-size: 22px; cursor: pointer; transition: transform .2s, box-shadow .2s; }
.dt-fab:hover { transform: rotate(-12deg) scale(1.06); box-shadow: 0 10px 26px rgba(0, 0, 0, .55), 0 0 18px rgba(231, 197, 111, .35); }
.dt-fab.open { transform: rotate(180deg); }
.raised .dt-fab { bottom: 44px; }
.raised .dt-panel { bottom: 102px; }

.dt-panel { position: fixed; left: 14px; bottom: 72px; z-index: 260; width: min(360px, calc(100vw - 28px)); max-height: calc(100vh - 100px); overflow-y: auto; display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; padding: 12px; border-radius: 16px; background: #17130e; border: 1px solid #8a6630; box-shadow: 0 20px 50px rgba(0, 0, 0, .6); color: #efe3c8; font: 13px 'Manrope', sans-serif; animation: dt-in .2s ease; }
.dt-panel header { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.dt-panel header b { font: 700 19px 'Cormorant Garamond', serif; color: #f3d99a; }
.dt-panel header small { color: #a8936c; font-weight: 700; }
.dt-dice { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 5px; }
.dt-dice button { position: relative; display: grid; place-items: center; aspect-ratio: 1; padding: 0; border-radius: 10px; border: 1px solid rgba(231, 197, 111, .3); background: rgba(231, 197, 111, .05); color: #f3d99a; cursor: pointer; user-select: none; }
.dt-dice button.on { background: rgba(231, 197, 111, .22); border-color: #e7c56f; }
.dt-die { font: 800 12px 'Manrope', sans-serif; }
.dt-dice em { position: absolute; right: -4px; top: -6px; padding: 0 5px; border-radius: 99px; background: #e7c56f; color: #1b140c; font: 800 10.5px 'Manrope', sans-serif; font-style: normal; }
.dt-adv { display: grid; grid-template-columns: minmax(0, .8fr) minmax(0, 1.3fr) minmax(0, 1fr); gap: 4px; padding: 3px; border-radius: 10px; background: #0f0c08; border: 1px solid rgba(231, 197, 111, .2); }
.dt-adv button { padding: 5px 3px; border-radius: 7px; border: 0; background: none; color: #a8936c; font: 700 11.5px 'Manrope', sans-serif; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; transition: background .15s, color .15s; }
.dt-adv button:hover { color: #f3d99a; }
.dt-adv button.on { background: rgba(231, 197, 111, .18); color: #f3d99a; }
.dt-adv button.adv.on { background: rgba(120, 200, 120, .2); color: #a8e6a1; }
.dt-adv button.dis.on { background: rgba(255, 122, 107, .18); color: #ff9b8f; }
.dt-advtag { margin-left: 5px; font-style: normal; font-weight: 800; }
.dt-advtag.adv { color: #a8e6a1; }
.dt-advtag.dis { color: #ff9b8f; }
.dt-drop { text-decoration: line-through; opacity: .55; }
.dt-formula { display: grid; gap: 4px; }
.dt-frow { display: flex; gap: 6px; }
.dt-frow input { flex: 1; min-width: 0; padding: 7px 10px; border-radius: 8px; border: 1px solid rgba(231, 197, 111, .35); background: #0f0c08; color: #f3dc9e; font: 800 15px 'Manrope', sans-serif; letter-spacing: .02em; }
.dt-frow input.bad { border-color: #ff7a6b; }
.dt-star { width: 34px; border-radius: 8px; border: 1px solid rgba(231, 197, 111, .35); background: none; color: #ffd166; font-size: 16px; cursor: pointer; }
.dt-star:disabled { opacity: .35; cursor: default; }
.dt-err { color: #ff9b8f; font-weight: 700; }
.dt-favs { display: flex; flex-wrap: wrap; gap: 5px; }
.dt-favs button { padding: 3px 10px; border-radius: 99px; border: 1px solid rgba(255, 209, 102, .4); background: rgba(255, 209, 102, .08); color: #ffd166; font: 700 12px 'Manrope', sans-serif; cursor: pointer; }
.dt-row { display: flex; gap: 8px; align-items: end; }
.dt-row label, .dt-panel label { display: grid; gap: 4px; color: #a8936c; font-weight: 700; font-size: 12px; min-width: 0; }
.dt-row .grow { flex: 1; }
.dt-row input { width: 100%; box-sizing: border-box; padding: 6px 8px; border-radius: 8px; border: 1px solid rgba(231, 197, 111, .25); background: #0f0c08; color: #efe3c8; font: 600 13px 'Manrope', sans-serif; }
.dt-mod { display: flex; gap: 3px; }
.dt-mod input { width: 52px; text-align: center; }
.dt-mod button { width: 26px; border-radius: 7px; border: 1px solid rgba(231, 197, 111, .3); background: none; color: #f3d99a; font-weight: 800; cursor: pointer; }
.dt-chk { display: flex !important; align-items: center; gap: 6px; color: #b9a6ff !important; }
.dt-acts { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.dt-acts .grow { flex: 1; }
.dt-btn { padding: 7px 12px; border-radius: 9px; border: 1px solid rgba(201, 162, 79, .45); background: rgba(231, 197, 111, .08); color: #f3d99a; font: 700 12.5px 'Manrope', sans-serif; cursor: pointer; }
.dt-btn.primary { background: linear-gradient(180deg, #f0cf83, #c99a45); color: #1b140c; border-color: #e6c27a; }
.dt-btn:disabled { opacity: .45; cursor: default; }
.dt-log { display: grid; gap: 3px; padding-top: 8px; border-top: 1px solid rgba(231, 197, 111, .15); }
.dt-line { display: grid; grid-template-columns: auto auto minmax(0, 1fr) auto; gap: 6px; align-items: center; font-size: 12.5px; }
.dt-line .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--pc); }
.dt-line b { color: #f3dc9e; max-width: 90px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dt-line span { color: #a8936c; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dt-line strong { font: 800 15px 'Manrope', sans-serif; color: #f3dc9e; }
.dt-line strong.crit { color: #ffd166; }
.dt-line strong.fail { color: #ff7a6b; }

.dt-pops { position: fixed; top: 76px; right: 16px; z-index: 450; display: grid; gap: 8px; width: min(320px, calc(100vw - 32px)); pointer-events: none; }
.dt-card { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 14px; background: linear-gradient(180deg, #221b13, #15110c); border: 1px solid color-mix(in srgb, var(--pc) 55%, #3b2a1a); box-shadow: 0 14px 34px rgba(0, 0, 0, .55); color: #efe3c8; font: 13px 'Manrope', sans-serif; pointer-events: auto; }
.dt-card.secret { border-style: dashed; }
.dt-card.crit { border-color: #ffd166; box-shadow: 0 14px 34px rgba(0, 0, 0, .55), 0 0 26px rgba(255, 209, 102, .45); }
.dt-card.fail { border-color: #ff7a6b; }
.dt-av { flex: none; width: 36px; height: 36px; border-radius: 50%; object-fit: cover; border: 2px solid var(--pc); }
.dt-av.ini { display: grid; place-items: center; background: var(--pc); color: #1b140c; font-weight: 800; }
.dt-who { display: grid; min-width: 0; flex: 1; }
.dt-who b { color: #f3dc9e; font-size: 13.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dt-who em { color: #b9a6ff; font-style: normal; font-weight: 700; font-size: 12px; }
.dt-who small { color: #a8936c; font-size: 12px; overflow-wrap: anywhere; }
.dt-total { display: grid; justify-items: center; }
.dt-num { font: 800 28px/1 'Manrope', sans-serif; color: #f3dc9e; animation: dt-num .7s cubic-bezier(.2, 1.4, .4, 1); }
.dt-card.crit .dt-num { color: #ffd166; text-shadow: 0 0 14px rgba(255, 209, 102, .8); }
.dt-card.fail .dt-num { color: #ff7a6b; }
.dt-total i { font: 800 10px 'Manrope', sans-serif; font-style: normal; letter-spacing: .08em; text-transform: uppercase; color: #ffd166; }
.dt-card.fail .dt-total i { color: #ff7a6b; }
.dt-pop-enter-active { transition: opacity .3s, transform .45s cubic-bezier(.2, 1.2, .4, 1); }
.dt-pop-leave-active { transition: opacity .3s, transform .3s; }
.dt-pop-enter-from { opacity: 0; transform: translateX(40px) scale(.9); }
.dt-pop-leave-to { opacity: 0; transform: translateX(30px); }
@keyframes dt-num { from { transform: scale(.3) rotate(-25deg); opacity: 0; } }
@keyframes dt-in { from { opacity: 0; transform: translateY(10px); } }
@media (prefers-reduced-motion: reduce) { .dt-num, .dt-panel { animation: none; } .dt-fab, .dt-fab.open { transition: none; transform: none; } }
</style>
