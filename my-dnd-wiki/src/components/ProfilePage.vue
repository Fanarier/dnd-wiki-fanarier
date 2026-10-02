<template>
  <div class="profile">
    <header class="p-top">
      <router-link to="/" class="back">← Карта</router-link>
      <router-link to="/wiki" class="back">Вики</router-link>
      <span class="grow" />
      <UserMenu />
    </header>

    <div v-if="!store.ready" class="p-load"><SteamLoader kind="gate" /></div>
    <div v-else-if="!store.me" class="p-card center">
      <h2>Профиль доступен после входа</h2>
      <button class="brass" @click="store.gate = 'choose'">Войти</button>
    </div>

    <main v-else class="p-main">
      <!-- карточка персонажа -->
      <section class="p-card hero">
        <i class="rivet tl" /><i class="rivet tr" /><i class="rivet bl" /><i class="rivet br" />
        <label class="avatar" title="Сменить аватарку">
          <img v-if="avatarPreview" :src="avatarPreview" alt="" />
          <span v-else :style="{ background: f.color }">{{ (f.name || '?')[0] }}</span>
          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden @change="pickAvatar" />
          <em>сменить</em>
        </label>
        <div class="hero-fields">
          <div class="role">{{ isMaster ? '♛ Мастер' : '⚔ Игрок' }} · логин <b>{{ store.me.login }}</b>
            <span v-if="!isMaster" class="rank" :style="{ background: rank.color, color: rank.text }">{{ rank.label }}</span>
          </div>
          <label>{{ isMaster ? 'Имя (видно на курсоре и в пингах)' : 'Имя персонажа' }}<input v-model="f.name" maxlength="40" /></label>
          <label v-if="!isMaster">Раса<input v-model="f.race" maxlength="40" placeholder="необязательно" /></label>
          <div class="row">
            <label class="color">Цвет курсора и пингов<input v-model="f.color" type="color" /></label>
            <button v-if="f.avatar === null" class="link" @click="f.avatar = undefined">вернуть аватар</button>
            <button v-else-if="store.me.avatar || f.avatar" class="link" @click="f.avatar = null">убрать аватар</button>
          </div>
          <div class="row end">
            <button class="brass" :disabled="busy" @click="saveProfile">Сохранить</button>
          </div>
        </div>
      </section>

      <!-- персонаж мастера: мастер тоже может играть -->
      <section v-if="isMaster" class="p-card">
        <h3>Мой персонаж <small>{{ store.me.character ? 'можно играть: «♛ Мастер ⇄ ⚔ Персонаж» в меню' : 'если ты не только ведёшь, но и играешь' }}</small></h3>
        <div class="char-row">
          <label>Имя персонажа<input v-model="ch.character" maxlength="40" placeholder="напр. Федя-паладин" /></label>
          <label>Раса<input v-model="ch.race" maxlength="40" placeholder="необязательно" /></label>
          <button class="brass small" :disabled="!ch.character.trim()" @click="saveCharacter">{{ store.me.character ? 'Сохранить' : 'Создать персонажа' }}</button>
        </div>
        <p class="muted small">Персонаж появится в списке игроков: его можно брать в группы заказов, добавлять в отряд и открывать ему секреты. Аватарка — твоя мастерская, пока в режиме персонажа не поставишь другую.</p>
      </section>
      <section v-if="store.me.asMaster" class="p-card">
        <h3>Режим персонажа</h3>
        <p class="muted">Ты сейчас играешь «{{ store.me.name }}». Имя, расу и аватарку персонажа меняй выше; пароль — в режиме мастера.</p>
      </section>

      <!-- игроки (мастер) -->
      <section v-if="isMaster" class="p-card">
        <h3>Игроки <small>{{ activePlayers.length }} в игре · {{ pendingPlayers.length }} ждут</small></h3>
        <div v-if="!store.data.players?.length" class="muted">Заявок пока не было. Игроки отправляют их с экрана входа.</div>
        <div v-for="p in sortedPlayers" :key="p.id" class="pl" :class="'pl-' + p.status">
          <img v-if="p.avatar" :src="avatarUrl(p.avatar)" alt="" class="pl-av" />
          <span v-else class="pl-av ini" :style="{ background: p.color }">{{ p.character[0] }}</span>
          <div class="pl-main">
            <b>{{ p.character }}</b><span v-if="p.race" class="muted"> · {{ p.race }}</span>
            <div class="muted small">{{ p.linked ? `персонаж мастера ${p.login}` : `логин ${p.login} · ${STATUS[p.status]}` }}</div>
          </div>
          <template v-if="p.status === 'pending'">
            <button class="mini ok" @click="call(`/api/players/${p.id}/approve`, 'POST', 'Игрок одобрен')">Одобрить</button>
            <button class="mini no" @click="call(`/api/players/${p.id}/reject`, 'POST', 'Отклонено')">Отказать</button>
          </template>
          <template v-else>
            <select :value="p.rank" class="mini-sel" title="Ранг авантюриста" @change="call(`/api/players/${p.id}`, 'PATCH', 'Ранг изменён', { rank: $event.target.value })">
              <option v-for="r in RANKS" :key="r.key" :value="r.key">{{ r.label }}</option>
            </select>
            <button v-if="p.status === 'rejected'" class="mini" @click="call(`/api/players/${p.id}`, 'PATCH', 'Восстановлен', { status: 'active' })">Восстановить</button>
          </template>
          <button class="mini no" title="Удалить аккаунт" @click="removePlayer(p)">✕</button>
        </div>
      </section>

      <!-- заметки -->
      <section class="p-card">
        <h3>Мои заметки на карте <small>{{ myNotes.length }}</small></h3>
        <div v-if="!myNotes.length" class="muted">Ставь заметки инструментом «Заметка» на карте — их видишь только ты (или твой отряд, если отметишь).</div>
        <div v-for="n in myNotes" :key="n.id" class="note-row">
          <i class="dot" :style="{ background: n.color }" />
          <span class="grow">{{ n.text || 'Без текста' }}<em v-if="n.share === 'group'" class="muted"> · видит отряд</em></span>
          <router-link class="mini" :to="{ path: '/', query: { focus: 'notes:' + n.id } }">на карте</router-link>
          <button class="mini no" @click="call(`/api/notes/${n.id}`, 'DELETE', 'Заметка удалена')">✕</button>
        </div>
      </section>

      <!-- безопасность и настройки -->
      <section class="p-card">
        <h3>Пароль и настройки</h3>
        <form v-if="!store.me.asMaster" class="pw" @submit.prevent="changePassword">
          <label>Старый пароль<input v-model="pw.old" type="password" autocomplete="current-password" /></label>
          <label>Новый пароль<input v-model="pw.new1" type="password" autocomplete="new-password" minlength="6" /></label>
          <label>Ещё раз<input v-model="pw.new2" type="password" autocomplete="new-password" minlength="6" /></label>
          <button class="brass small" :disabled="!pw.old || !pw.new1 || pw.new1 !== pw.new2">Сменить пароль</button>
        </form>
        <div v-if="pw.new2 && pw.new1 !== pw.new2" class="err">Пароли не совпадают</div>
        <label class="chk"><input type="checkbox" :checked="store.sound" @change="setSound($event.target.checked)" /> Звук пингов</label>
        <div class="row end"><button class="mini no" @click="out">Выйти из аккаунта</button></div>
      </section>

      <footer class="love">Позже добавится коннект с моим приложением.<br />С любовью, Энди ⚙🛠</footer>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import UserMenu from './UserMenu.vue'
import SteamLoader from './SteamLoader.vue'
import { store, init, act, toast, logout, updateProfile, imageToDataUrl, avatarUrl, setSound } from '../map/store.js'
import { RANKS } from '../shared/catalog.js'

const router = useRouter()
onMounted(init)

const isMaster = computed(() => store.role === 'master')
const STATUS = { pending: 'ждёт одобрения', active: 'в игре', rejected: 'отклонён' }
const rank = computed(() => RANKS.find(r => r.key === store.me?.rank) || RANKS[0])

const f = reactive({ name: '', race: '', color: '#ffd166', avatar: undefined })
watch(() => store.me?.id, () => {
  if (!store.me) return
  const me = store.data.roster?.find(p => p.id === store.me.id)
  Object.assign(f, { name: store.me.name, race: me?.race || '', color: store.me.color || '#ffd166', avatar: undefined })
}, { immediate: true })
// undefined — не трогать, null — убрать, строка — новая картинка
const avatarPreview = computed(() => (f.avatar === null ? '' : f.avatar || avatarUrl(store.me?.avatar)))

async function pickAvatar(e) {
  const file = e.target.files[0]
  e.target.value = ''
  if (!file) return
  try { f.avatar = await imageToDataUrl(file) } catch (x) { toast(x.message, 'error') }
}

const busy = ref(false)
async function saveProfile() {
  busy.value = true
  try {
    const patch = { name: f.name, color: f.color }
    if (!isMaster.value) patch.race = f.race
    if (f.avatar !== undefined) patch.avatar = f.avatar
    await updateProfile(patch)
    f.avatar = undefined
    toast('Профиль сохранён')
  } catch (e) {
    toast(e.message, 'error')
  } finally {
    busy.value = false
  }
}

// персонаж мастера
const ch = reactive({ character: '', race: '' })
watch(() => [store.me?.character, store.data.roster?.length], () => {
  const mine = store.data.roster?.find(p => p.linked && p.character === store.me?.character)
  ch.character = store.me?.character || ''
  ch.race = mine?.race || ''
}, { immediate: true })
async function saveCharacter() {
  try {
    await act('POST', '/api/me/character', { character: ch.character, race: ch.race }, store.me.character ? 'Персонаж обновлён' : 'Персонаж создан — переключайся в меню')
  } catch { /* тост */ }
}

const pw = reactive({ old: '', new1: '', new2: '' })
async function changePassword() {
  try {
    await updateProfile({ oldPassword: pw.old, newPassword: pw.new1 })
    Object.assign(pw, { old: '', new1: '', new2: '' })
    toast('Пароль изменён — на других устройствах нужно войти заново')
  } catch (e) {
    toast(e.message, 'error')
  }
}

const sortedPlayers = computed(() => {
  const order = { pending: 0, active: 1, rejected: 2 }
  return [...(store.data.players || [])].sort((a, b) => order[a.status] - order[b.status] || a.character.localeCompare(b.character, 'ru'))
})
const activePlayers = computed(() => (store.data.players || []).filter(p => p.status === 'active'))
const pendingPlayers = computed(() => (store.data.players || []).filter(p => p.status === 'pending'))
const myNotes = computed(() => (store.data.notes || []).filter(n => n.ownerId === store.me?.id))

const call = (url, method, text, body) => act(method, url, method === 'DELETE' ? undefined : (body || {}), text).catch(() => {})
function removePlayer(p) {
  if (confirm(`Удалить аккаунт «${p.character}» (${p.login})? Это нельзя отменить.`)) call(`/api/players/${p.id}`, 'DELETE', 'Аккаунт удалён')
}
function out() {
  logout()
  router.push('/')
}
</script>

<style scoped>
.profile { min-height: 100vh; background: radial-gradient(1000px 500px at 50% -10%, rgba(201, 162, 79, .14), transparent 70%), #0f0c09; color: #efe3c8; font-family: 'Manrope', sans-serif; }
.p-top { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; gap: 14px; height: 60px; padding: 0 20px; background: rgba(15, 12, 9, .9); backdrop-filter: blur(10px); border-bottom: 1px solid rgba(201, 162, 79, .25); }
.back { color: #e6c27a; text-decoration: none; font-weight: 700; font-size: 14px; }
.grow { flex: 1; }
.p-load { display: grid; place-items: center; min-height: 60vh; }
.p-main { max-width: 760px; margin: 0 auto; padding: 24px 16px 40px; display: grid; gap: 16px; }
.p-card { position: relative; padding: 18px 20px; border-radius: 16px; background: linear-gradient(160deg, #241c13, #18130d); border: 1px solid #6e4f22; box-shadow: 0 0 0 3px #1a140e, 0 14px 30px rgba(0, 0, 0, .4); }
.p-card.center { max-width: 420px; margin: 60px auto; text-align: center; display: grid; gap: 14px; justify-items: center; }
.rivet { position: absolute; width: 9px; height: 9px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #f5d99a, #a37b3a 55%, #4a3415); }
.tl { top: 9px; left: 9px; } .tr { top: 9px; right: 9px; } .bl { bottom: 9px; left: 9px; } .br { bottom: 9px; right: 9px; }
h2, h3 { margin: 0 0 12px; font: 700 24px 'Cormorant Garamond', Georgia, serif; color: #f3d99a; }
h3 small { font: 600 13px 'Manrope', sans-serif; color: #a8936c; margin-left: 8px; }
.hero { display: flex; gap: 22px; align-items: flex-start; }
.avatar { position: relative; width: 128px; height: 128px; flex: none; border-radius: 50%; overflow: hidden; cursor: pointer; border: 4px solid #b8893f; box-shadow: 0 0 0 3px #3a2a16, 0 8px 18px rgba(0, 0, 0, .5); }
.avatar img, .avatar span { width: 100%; height: 100%; object-fit: cover; display: grid; place-items: center; font: 700 52px 'Cormorant Garamond', Georgia, serif; color: #1b1408; }
.avatar em { position: absolute; inset: auto 0 0; padding: 4px 0 8px; text-align: center; font-size: 11px; font-weight: 800; font-style: normal; color: #fff; background: rgba(0, 0, 0, .55); opacity: 0; transition: opacity .2s; }
.avatar:hover em { opacity: 1; }
.hero-fields { flex: 1; display: grid; gap: 10px; }
.role { font-size: 13px; color: #a8936c; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.role b { color: #efe3c8; }
.rank { padding: 1px 10px; border-radius: 4px; font-weight: 800; font-size: 12px; }
label { display: grid; gap: 4px; font-size: 12px; font-weight: 700; color: #a8936c; }
input { min-height: 38px; padding: 7px 11px; border-radius: 9px; border: 1px solid #6e4f22; background: #120e09; color: #efe3c8; font: 500 14px 'Manrope', sans-serif; }
input:focus { outline: none; border-color: #e6c27a; }
input[type='color'] { width: 60px; padding: 3px; cursor: pointer; }
.color { grid-template-columns: auto 60px; align-items: center; gap: 10px; }
.row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.row.end { justify-content: flex-end; }
.chk { display: flex; align-items: center; gap: 8px; color: #efe3c8; font-size: 13px; margin: 12px 0; }
.chk input { min-height: 0; width: 16px; height: 16px; accent-color: #e6c27a; }
.brass { height: 38px; padding: 0 20px; border-radius: 10px; border: 1px solid #6e4f22; cursor: pointer; color: #1e150a; font: 800 14px 'Manrope', sans-serif; background: linear-gradient(180deg, #f2d58f, #c99a48 55%, #a87a33); box-shadow: inset 0 1px 0 rgba(255, 245, 210, .7), 0 3px 0 #5a3e1a; }
.brass.small { height: 38px; align-self: end; }
.brass:disabled { opacity: .5; cursor: not-allowed; }
.link { background: none; border: 0; color: #a8936c; font: 600 12px 'Manrope', sans-serif; cursor: pointer; text-decoration: underline; }
.mini { display: inline-flex; align-items: center; border: 1px solid rgba(255, 255, 255, .15); background: rgba(255, 255, 255, .06); color: #efe3c8; border-radius: 8px; padding: 5px 10px; font: 700 12px 'Manrope', sans-serif; cursor: pointer; text-decoration: none; }
.mini.ok { background: #3f7d10; border-color: #3f7d10; color: #fff; }
.mini.no { color: #ff9b8f; }
.mini-sel { min-height: 30px; padding: 3px 8px; border-radius: 8px; border: 1px solid #6e4f22; background: #120e09; color: #efe3c8; font: 600 12px 'Manrope', sans-serif; }
.muted { color: #a8936c; }
.small { font-size: 12px; }
.err { color: #ff8a7a; font-size: 13px; font-weight: 600; margin-top: 6px; }
.pl { display: flex; align-items: center; gap: 10px; padding: 9px 4px; border-top: 1px solid rgba(201, 162, 79, .14); }
.pl-pending { background: rgba(224, 96, 74, .08); border-radius: 10px; padding: 9px; }
.pl-rejected { opacity: .55; }
.pl-av { width: 38px; height: 38px; border-radius: 50%; object-fit: cover; border: 2px solid #b8893f; flex: none; }
.pl-av.ini { display: grid; place-items: center; color: #1b1408; font-weight: 800; }
.pl-main { flex: 1; min-width: 0; }
.note-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-top: 1px solid rgba(201, 162, 79, .14); font-size: 13.5px; }
.dot { width: 12px; height: 12px; border-radius: 50%; flex: none; }
.char-row { display: grid; grid-template-columns: 1fr 1fr auto; gap: 10px; align-items: end; }
.pw { display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 10px; align-items: end; }
.love { text-align: center; margin-top: 18px; font: italic 600 18px/1.5 'Cormorant Garamond', Georgia, serif; color: #a8936c; }
@media (max-width: 640px) {
  .hero { flex-direction: column; align-items: center; }
  .pw, .char-row { grid-template-columns: 1fr; }
}
</style>
