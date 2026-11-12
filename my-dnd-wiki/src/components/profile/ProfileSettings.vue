<template>
  <!-- настройки профиля: всё, что человек включает и выключает под себя. Применяется сразу, без «Сохранить»
       (кроме пароля). Личные — на сервере, ходят за аккаунтом; «на этом устройстве» — в браузере -->
  <div class="pf-set">
    <!-- листы персонажей -->
    <section class="pf-group">
      <h3>Листы персонажей</h3>
      <div class="pf-row">
        <div class="pf-txt" id="pf-sheet-add">
          <b>Куда добавлять новое из вики</b>
          <small>Кнопка «＋ в лист» у заклинаний и навыки расы и класса, которые лист добавляет сам. Навык, созданный в листе вручную, всё равно появляется сверху.</small>
        </div>
        <div class="pf-seg" role="radiogroup" aria-labelledby="pf-sheet-add">
          <button v-for="o in SHEET_ADD" :key="o.v" type="button" role="radio" :aria-checked="sheetAdd === o.v" :class="{ on: sheetAdd === o.v }" :disabled="busy" @click="setSheetAdd(o.v)">{{ o.t }}</button>
        </div>
      </div>
    </section>

    <!-- уведомления (у мастера своих переключателей пока нет) -->
    <section v-if="store.role === 'player'" class="pf-group">
      <h3>Уведомления</h3>
      <label class="pf-row pf-sw">
        <span class="pf-txt"><b>Новые арты мастера</b><small>Колокольчик звякнет, когда в «Героях Анкарии» появятся новые арты.</small></span>
        <input type="checkbox" role="switch" :checked="store.me.notifyArts" :disabled="busy" @change="setNotifyArts($event.target.checked)" />
      </label>
    </section>

    <!-- звук: хранится в браузере -->
    <section class="pf-group">
      <h3>Звук <small>на этом устройстве</small></h3>
      <label class="pf-row pf-sw">
        <span class="pf-txt"><b>Звуки сайта</b><small>Пинги, кубики, уведомления, стихии. Выключишь — замолчит всё, и фон стихий тоже.</small></span>
        <input type="checkbox" role="switch" :checked="store.sound" @change="setSound($event.target.checked)" />
      </label>
      <label class="pf-row pf-sw" :class="{ off: !store.sound }">
        <span class="pf-txt"><b>Фон стихий в вики</b><small>На страницах школ магии тихо шумит огонь, вода, ветер… Включается и там — кнопкой у заголовка.</small></span>
        <input type="checkbox" role="switch" :checked="amb" :disabled="!store.sound" @change="setAmb($event.target.checked)" />
      </label>
      <label v-if="amb && store.sound" class="pf-row pf-vol">
        <span class="pf-txt"><b>Громкость фона</b></span>
        <input type="range" min="0" max="1" step="0.05" :value="vol" aria-label="Громкость фона стихий" @input="setVol(+$event.target.value)" />
        <output>{{ Math.round(vol * 100) }}%</output>
      </label>
    </section>

    <!-- вход и пароль -->
    <section class="pf-group">
      <h3>Вход</h3>
      <form v-if="!store.me.asMaster" class="pf-pw" @submit.prevent="changePassword">
        <input type="text" :value="store.me.login" autocomplete="username" hidden readonly />
        <label>Старый пароль<input v-model="pw.old" type="password" autocomplete="current-password" /></label>
        <label>Новый пароль<input v-model="pw.new1" type="password" autocomplete="new-password" minlength="6" /></label>
        <label>Ещё раз<input v-model="pw.new2" type="password" autocomplete="new-password" minlength="6" /></label>
        <button class="pf-brass" :disabled="!pw.old || pw.new1.length < 6 || pw.new1 !== pw.new2">Сменить пароль</button>
      </form>
      <p v-else class="pf-note">Ты сейчас играешь персонажем — пароль меняется в режиме мастера.</p>
      <div v-if="pw.new2 && pw.new1 !== pw.new2" class="pf-err">Пароли не совпадают</div>
      <div v-else-if="pw.new1 && pw.new1.length < 6" class="pf-note">Новый пароль — минимум 6 символов</div>
      <div class="pf-row pf-out">
        <span class="pf-txt"><b>Логин: {{ store.me.login }}</b><small>После смены пароля на других устройствах нужно будет войти заново.</small></span>
        <button type="button" class="pf-mini no" @click="out">Выйти из аккаунта</button>
      </div>
    </section>

    <!-- заставки событий героев у всех на сайте: только владелец сайта -->
    <section v-if="store.role === 'master' && store.me.owner" class="pf-group site">
      <h3>Для всего сайта <small>видит только владелец</small></h3>
      <p class="pf-note">Заставки событий героев — показываются у всех, кто сейчас на сайте.</p>
      <label v-for="e in HERO_EVENTS" :key="e.k" class="pf-row pf-sw">
        <span class="pf-txt"><b>{{ e.t }}</b><small v-if="e.h">{{ e.h }}</small></span>
        <input type="checkbox" role="switch" :checked="!!store.data.settings.heroEvents?.[e.k]" @change="setHeroEvent(e.k, $event.target.checked)" />
      </label>
    </section>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { store, api, toast, logout, updateProfile, setSound, setPrefs } from '../../map/store.js'
import { getAmbienceVolume, setAmbienceVolume } from '../../sound/sound.js'

const router = useRouter()
const busy = ref(false)
async function run(fn, ok) {
  busy.value = true
  try { await fn(); if (ok) toast(ok) } catch (e) { toast(e.message, 'error') } finally { busy.value = false }
}

/* ---------- листы ---------- */
const SHEET_ADD = [{ v: 'bottom', t: 'В конец списка' }, { v: 'top', t: 'В начало списка' }]
const sheetAdd = computed(() => store.me?.prefs?.sheetAdd || 'bottom')
function setSheetAdd(v) {
  if (v !== sheetAdd.value) run(() => setPrefs({ sheetAdd: v }), v === 'top' ? 'Новое из вики — в начало листа' : 'Новое из вики — в конец листа')
}

/* ---------- уведомления ---------- */
const setNotifyArts = on => run(() => updateProfile({ notifyArts: on }), on ? 'Будем звать на новые арты' : 'Об артах больше не напоминаем')

/* ---------- фон стихий (тот же ключ, что у кнопки в вики) ---------- */
const AMB_KEY = 'anacaria-ambience'
const amb = ref((() => { try { return localStorage.getItem(AMB_KEY) === 'on' } catch { return false } })())
function setAmb(on) {
  amb.value = on
  try { localStorage.setItem(AMB_KEY, on ? 'on' : 'off') } catch { /* приватный режим */ }
}
const vol = ref(getAmbienceVolume())
function setVol(v) { vol.value = v; setAmbienceVolume(v) }

/* ---------- пароль и выход ---------- */
const pw = reactive({ old: '', new1: '', new2: '' })
const changePassword = () => run(async () => {
  await updateProfile({ oldPassword: pw.old, newPassword: pw.new1 })
  Object.assign(pw, { old: '', new1: '', new2: '' })
}, 'Пароль изменён — на других устройствах нужно войти заново')
function out() {
  logout()
  router.push('/')
}

/* ---------- заставки событий героев (HeroEventFx): по умолчанию выключены ---------- */
const HERO_EVENTS = [
  { k: 'level', t: 'Новый уровень', h: 'С конфетти.' },
  { k: 'train', t: 'Завершённая тренировка', h: 'И через журнал деятельностей.' },
  { k: 'race', t: 'Взятый расовый навык' },
  { k: 'death', t: 'Три проваленных спасброска', h: 'Тёмно-красная, с тряской.' },
  { k: 'stable', t: 'Три успешных спасброска', h: '«Стабилизирован».' }
]
const setHeroEvent = (k, on) => run(() => api('PATCH', '/api/settings', { heroEvents: { ...store.data.settings.heroEvents, [k]: on } }), on ? 'Заставка включена' : 'Заставка выключена')
</script>

<style scoped>
.pf-set { display: grid; gap: 16px; }
.pf-group { padding: 16px 20px 8px; border-radius: 16px; background: linear-gradient(160deg, #241c13, #18130d); border: 1px solid #6e4f22; box-shadow: 0 0 0 3px #1a140e, 0 14px 30px rgba(0, 0, 0, .4); }
.pf-group.site { border-color: rgba(231, 197, 111, .55); }
.pf-group h3 { margin: 0 0 6px; font: 700 22px var(--a-serif); color: #f3d99a; }
.pf-group h3 small { font: 600 12.5px var(--a-sans); color: #a8936c; margin-left: 8px; }
.pf-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 8px 16px; padding: 12px 0; border-top: 1px solid rgba(201, 162, 79, .14); }
.pf-group h3 + .pf-row, .pf-group h3 + form { border-top: 0; }
.pf-row.off { opacity: .55; }
.pf-txt { display: grid; gap: 3px; min-width: 0; }
.pf-txt b { font: 700 14px var(--a-sans); color: #efe3c8; }
.pf-txt small { font: 500 12.5px/1.45 var(--a-sans); color: #a8936c; }
.pf-note { margin: 0 0 8px; font-size: 12.5px; color: #a8936c; }
.pf-err { margin: 6px 0; color: #ff8a7a; font-size: 13px; font-weight: 600; }

/* переключатель: латунный ползунок вместо галочки */
.pf-sw { cursor: pointer; }
.pf-sw input { appearance: none; position: relative; width: 44px; height: 24px; margin: 0; border-radius: 99px; border: 1px solid #6e4f22; background: #120e09; cursor: pointer; transition: background .2s, border-color .2s; }
.pf-sw input::after { content: ''; position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #c9b590, #6e5a3a); transition: transform .2s; }
.pf-sw input:checked { background: rgba(231, 197, 111, .25); border-color: #e6c27a; }
.pf-sw input:checked::after { transform: translateX(20px); background: radial-gradient(circle at 35% 30%, #f5d99a, #a37b3a 70%); }
.pf-sw input:focus-visible { outline: 2px solid #e6c27a; outline-offset: 2px; }
.pf-sw input:disabled { cursor: not-allowed; }

/* выбор из двух: сегменты */
.pf-seg { display: inline-flex; padding: 3px; border-radius: 11px; background: #120e09; border: 1px solid #6e4f22; }
.pf-seg button { padding: 7px 12px; border: 0; border-radius: 8px; background: none; color: #a8936c; font: 700 12.5px var(--a-sans); cursor: pointer; white-space: nowrap; }
.pf-seg button:hover:not(.on) { color: #efe3c8; }
.pf-seg button.on { background: linear-gradient(180deg, #f2d58f, #c99a48 55%, #a87a33); color: #1e150a; box-shadow: inset 0 1px 0 rgba(255, 245, 210, .7); }
.pf-seg button:focus-visible { outline: 2px solid #e6c27a; outline-offset: 1px; }

.pf-vol { grid-template-columns: minmax(0, 1fr) minmax(120px, 200px) 44px; border-top: 0; padding-top: 0; }
.pf-vol input { width: 100%; accent-color: #e6c27a; }
.pf-vol output { font: 700 12.5px var(--a-sans); color: #a8936c; text-align: right; }

.pf-pw { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)) auto; gap: 10px; align-items: end; padding: 6px 0 10px; }
.pf-pw label { display: grid; gap: 4px; font: 700 12px var(--a-sans); color: #a8936c; min-width: 0; }
.pf-pw input { min-height: 38px; min-width: 0; padding: 7px 11px; border-radius: 9px; border: 1px solid #6e4f22; background: #120e09; color: #efe3c8; font: 500 14px var(--a-sans); }
.pf-pw input:focus { outline: none; border-color: #e6c27a; }
.pf-brass { height: 38px; padding: 0 16px; border-radius: 10px; border: 1px solid #6e4f22; cursor: pointer; color: #1e150a; font: 800 13.5px var(--a-sans); background: linear-gradient(180deg, #f2d58f, #c99a48 55%, #a87a33); box-shadow: inset 0 1px 0 rgba(255, 245, 210, .7), 0 3px 0 #5a3e1a; }
.pf-brass:disabled { opacity: .5; cursor: not-allowed; }
.pf-mini { border: 1px solid rgba(255, 255, 255, .15); background: rgba(255, 255, 255, .06); color: #efe3c8; border-radius: 8px; padding: 6px 12px; font: 700 12.5px var(--a-sans); cursor: pointer; }
.pf-mini.no { color: #ff9b8f; }
@media (max-width: 640px) {
  .pf-group { padding: 14px 14px 6px; }
  .pf-pw { grid-template-columns: minmax(0, 1fr); }
  .pf-row { grid-template-columns: minmax(0, 1fr); }
  .pf-row.pf-sw { grid-template-columns: minmax(0, 1fr) auto; }
  .pf-vol { grid-template-columns: minmax(0, 1fr) 44px; }
  .pf-vol .pf-txt { grid-column: 1 / -1; }
}
@media (prefers-reduced-motion: reduce) { .pf-sw input, .pf-sw input::after { transition: none; } }
</style>
