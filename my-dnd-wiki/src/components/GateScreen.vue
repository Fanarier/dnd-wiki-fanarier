<template>
  <div class="gate" @mousedown.self="closable && close()">
    <div class="console">
      <i class="rivet tl" /><i class="rivet tr" /><i class="rivet bl" /><i class="rivet br" />
      <div class="plate">
        <svg class="emblem" viewBox="0 0 64 64" aria-hidden="true">
          <g class="emblem-gear"><path :d="gear(22, 12, 5)" /></g>
          <circle cx="32" cy="32" r="13" class="em-core" />
          <path d="M32 21 L35 32 L32 43 L29 32 Z" class="em-needle" />
        </svg>
        <div>
          <div class="kicker">Врата картографов</div>
          <h1>Анкария</h1>
        </div>
        <button v-if="closable" class="x" title="Закрыть" @click="close">×</button>
      </div>

      <!-- выбор -->
      <div v-if="mode === 'choose'" class="choices">
        <button class="brass-btn" @click="mode = 'master'"><span class="ico">♛</span><b>Войти как мастер</b><small>логин и пароль от Энди</small></button>
        <button class="brass-btn" @click="mode = 'player'"><span class="ico">⚔</span><b>Войти как игрок</b><small>если заявку уже одобрили</small></button>
        <button class="brass-btn alt" @click="mode = 'register'"><span class="ico">✉</span><b>Отправить заявку</b><small>новый игрок — мастер рассмотрит</small></button>
        <button class="guest" @click="guest">Смотреть как гость →</button>
      </div>

      <!-- вход -->
      <form v-else-if="mode === 'master' || mode === 'player'" class="form" @submit.prevent="doLogin">
        <h2>{{ mode === 'master' ? 'Вход мастера' : 'Вход игрока' }}</h2>
        <label>Логин<input ref="first" v-model="f.login" autocomplete="username" required /></label>
        <label>Пароль<input v-model="f.password" type="password" autocomplete="current-password" required /></label>
        <div v-if="err" class="err">{{ err }}</div>
        <div class="row">
          <button type="button" class="link" @click="back">← Назад</button>
          <button type="submit" class="brass-btn small" :disabled="busy">{{ busy ? 'Проверяем…' : 'Войти' }}</button>
        </div>
      </form>

      <!-- заявка -->
      <form v-else-if="mode === 'register'" class="form" @submit.prevent="doRegister">
        <h2>Заявка игрока</h2>
        <div class="avatar-pick">
          <label class="avatar" :title="'Аватарка (необязательно)'">
            <img v-if="f.avatar" :src="f.avatar" alt="" />
            <span v-else>＋<small>аватар</small></span>
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden @change="pickAvatar" />
          </label>
          <div class="avatar-fields">
            <label>Имя персонажа<input ref="first" v-model="f.character" maxlength="40" required placeholder="Энди" /></label>
            <label><span>Раса <i>(необязательно)</i></span><input v-model="f.race" maxlength="40" placeholder="Гном" /></label>
          </div>
        </div>
        <label>Логин<input v-model="f.login" autocomplete="username" required minlength="3" maxlength="32" placeholder="латиница или кириллица, без пробелов" /></label>
        <div class="row2">
          <label>Пароль<input v-model="f.password" type="password" autocomplete="new-password" required minlength="6" /></label>
          <label>Повтори пароль<input v-model="f.password2" type="password" autocomplete="new-password" required minlength="6" /></label>
        </div>
        <div v-if="f.password2 && f.password !== f.password2" class="err">Пароли не совпадают</div>
        <div v-if="err" class="err">{{ err }}</div>
        <div class="row">
          <button type="button" class="link" @click="back">← Назад</button>
          <button type="submit" class="brass-btn small" :disabled="busy || f.password !== f.password2">{{ busy ? 'Отправляем…' : 'Отправить' }}</button>
        </div>
      </form>

      <!-- ждём мастера -->
      <div v-else-if="mode === 'sent'" class="sent">
        <div class="seal">✉</div>
        <h2>Пожалуйста, ждите</h2>
        <p>Ваша заявка у мастера. Когда её одобрят — входите как игрок со своим логином и паролем.</p>
        <button class="brass-btn small" @click="guest">Пока посмотреть как гость</button>
      </div>

      <div class="footer">{{ footer }}</div>
    </div>
  </div>
</template>

<script setup>
import { nextTick, reactive, ref, watch } from 'vue'
import { store, login, enterAsGuest, registerPlayer, imageToDataUrl } from '../map/store.js'
import { phrase } from '../shared/phrases.js'

const mode = ref(store.gate || 'choose')
const busy = ref(false)
const err = ref('')
const first = ref(null)
const f = reactive({ login: '', password: '', password2: '', character: '', race: '', avatar: '' })
const footer = phrase('gate')
// если открыли из шапки (уже был гостем) — можно закрыть
const closable = (() => { try { return !!localStorage.getItem('anacaria-guest') } catch { return false } })()

watch(mode, () => {
  err.value = ''
  nextTick(() => first.value?.focus())
})

function back() { mode.value = 'choose' }
function close() { store.gate = null }
function guest() { enterAsGuest() }

async function doLogin() {
  busy.value = true
  err.value = ''
  try {
    await login(f.login.trim(), f.password)
  } catch (e) {
    err.value = e.message
  } finally {
    busy.value = false
    f.password = ''
  }
}

async function pickAvatar(e) {
  const file = e.target.files[0]
  e.target.value = ''
  if (!file) return
  try { f.avatar = await imageToDataUrl(file) } catch (x) { err.value = x.message }
}

async function doRegister() {
  busy.value = true
  err.value = ''
  try {
    await registerPlayer({ login: f.login.trim(), password: f.password, password2: f.password2, character: f.character.trim(), race: f.race.trim(), avatar: f.avatar || undefined })
    mode.value = 'sent'
  } catch (e) {
    err.value = e.message
  } finally {
    busy.value = false
  }
}

function gear(r, teeth, h) {
  const pts = []
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2, w = Math.PI / teeth * 0.55
    for (const [ang, rad] of [[a - w, r], [a - w * 0.6, r + h], [a + w * 0.6, r + h], [a + w, r]]) {
      pts.push(`${(32 + Math.cos(ang) * rad).toFixed(1)},${(32 + Math.sin(ang) * rad).toFixed(1)}`)
    }
  }
  return 'M' + pts.join('L') + 'Z'
}
</script>

<style scoped>
.gate {
  position: fixed; inset: 0; z-index: 500; display: grid; place-items: center; padding: 16px; overflow-y: auto;
  background:
    radial-gradient(900px 500px at 50% 0%, rgba(201, 162, 79, .16), transparent 70%),
    radial-gradient(circle at 20% 80%, rgba(90, 60, 25, .25), transparent 50%),
    rgba(8, 7, 6, .94);
  backdrop-filter: blur(6px);
  font-family: 'Manrope', sans-serif; color: #efe3c8;
}
.console {
  position: relative; width: min(520px, 100%); padding: 22px 26px 18px; border-radius: 18px;
  background: linear-gradient(160deg, #2a2117, #1a140e 55%, #231a11);
  border: 2px solid #8a6630; box-shadow: 0 0 0 4px #3a2a16, 0 0 0 5px #a37b3a, 0 30px 80px rgba(0, 0, 0, .7), inset 0 1px 0 rgba(255, 220, 150, .15);
}
.rivet { position: absolute; width: 10px; height: 10px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #f5d99a, #a37b3a 55%, #4a3415); box-shadow: 0 1px 2px rgba(0, 0, 0, .6); }
.tl { top: 10px; left: 10px; } .tr { top: 10px; right: 10px; } .bl { bottom: 10px; left: 10px; } .br { bottom: 10px; right: 10px; }
.plate { display: flex; align-items: center; gap: 14px; padding: 6px 4px 16px; border-bottom: 1px solid rgba(201, 162, 79, .3); margin-bottom: 16px; }
.emblem { width: 58px; height: 58px; flex: none; }
.emblem-gear { transform-origin: 32px 32px; animation: spin 14s linear infinite; }
.emblem-gear path { fill: #b8893f; stroke: #5a3e1a; stroke-width: 1; }
.em-core { fill: #1b1610; stroke: #d8b26a; stroke-width: 1.5; }
.em-needle { fill: #e6c27a; }
.kicker { font-size: 11px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; color: #a8936c; }
h1 { margin: 0; font: 700 40px/1 'Cormorant Garamond', Georgia, serif; color: #f3d99a; text-shadow: 0 2px 0 #3a2a16; }
h2 { margin: 0 0 12px; font: 700 26px 'Cormorant Garamond', Georgia, serif; color: #f3d99a; }
.x { margin-left: auto; align-self: flex-start; background: none; border: 0; color: #a8936c; font-size: 26px; cursor: pointer; }
.choices { display: grid; gap: 10px; }
.brass-btn {
  display: grid; grid-template-columns: 36px 1fr; grid-template-rows: auto auto; column-gap: 10px; text-align: left; align-items: center;
  padding: 12px 16px; border-radius: 12px; cursor: pointer; color: #1e150a;
  background: linear-gradient(180deg, #f2d58f, #c99a48 55%, #a87a33); border: 1px solid #6e4f22;
  box-shadow: inset 0 1px 0 rgba(255, 245, 210, .7), 0 3px 0 #5a3e1a, 0 6px 14px rgba(0, 0, 0, .4);
  font: 600 13px 'Manrope', sans-serif; transition: transform .08s, filter .15s;
}
.brass-btn:hover { filter: brightness(1.07); }
.brass-btn:active { transform: translateY(2px); box-shadow: inset 0 1px 0 rgba(255, 245, 210, .7), 0 1px 0 #5a3e1a; }
.brass-btn .ico { grid-row: span 2; font-size: 24px; text-align: center; }
.brass-btn b { font-size: 16px; }
.brass-btn small { color: #4a3415; }
.brass-btn.alt { background: linear-gradient(180deg, #d9c7a4, #a8936c 55%, #8a7550); }
.brass-btn.small { display: inline-flex; padding: 9px 18px; font-weight: 800; }
.brass-btn:disabled { opacity: .5; cursor: not-allowed; }
.guest { justify-self: center; margin-top: 4px; background: none; border: 0; color: #a8936c; font: 600 13px 'Manrope', sans-serif; cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }
.guest:hover { color: #f3d99a; }
.form { display: grid; gap: 10px; }
label { display: grid; gap: 4px; font-size: 12px; font-weight: 700; color: #a8936c; }
label i { font-weight: 500; }
input { min-height: 38px; padding: 7px 11px; border-radius: 9px; border: 1px solid #6e4f22; background: #120e09; color: #efe3c8; font: 500 14px 'Manrope', sans-serif; box-shadow: inset 0 2px 4px rgba(0, 0, 0, .5); }
input:focus { outline: none; border-color: #e6c27a; }
.row { display: flex; justify-content: space-between; align-items: center; margin-top: 4px; }
.row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.link { background: none; border: 0; color: #a8936c; font: 600 13px 'Manrope', sans-serif; cursor: pointer; }
.err { color: #ff8a7a; font-size: 13px; font-weight: 600; }
.avatar-pick { display: flex; gap: 14px; align-items: center; }
.avatar { width: 84px; height: 84px; flex: none; border-radius: 50%; border: 3px solid #a37b3a; box-shadow: 0 0 0 2px #3a2a16; overflow: hidden; cursor: pointer; display: grid; place-items: center; background: #120e09; color: #a8936c; font-size: 26px; text-align: center; line-height: 1; }
.avatar small { display: block; font-size: 11px; }
.avatar img { width: 100%; height: 100%; object-fit: cover; }
.avatar-fields { flex: 1; display: grid; gap: 8px; }
.sent { text-align: center; display: grid; justify-items: center; gap: 6px; padding: 10px 0; }
.sent .seal { width: 64px; height: 64px; border-radius: 50%; display: grid; place-items: center; font-size: 28px; color: #fff; background: radial-gradient(circle at 35% 30%, #e0604a, #a3170c 60%, #5a0b05); box-shadow: 0 4px 10px rgba(0, 0, 0, .5); transform: rotate(-10deg); }
.sent p { margin: 0 0 8px; color: #d4c4a0; }
.footer { margin-top: 16px; text-align: center; font: italic 600 15px 'Cormorant Garamond', Georgia, serif; color: #8a7550; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 480px) { .row2 { grid-template-columns: 1fr; } h1 { font-size: 32px; } }
</style>
