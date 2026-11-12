<template>
  <div class="profile">
    <header class="p-top">
      <router-link to="/" class="back">← Карта</router-link>
      <router-link to="/wiki" class="back">Вики</router-link>
      <router-link v-if="viewId" to="/profile" class="back">Мой профиль</router-link>
      <span class="grow" />
      <UserMenu />
    </header>

    <div v-if="!store.ready" class="p-load"><SteamLoader kind="gate" /></div>
    <div v-else-if="!store.me" class="p-card center">
      <h2>{{ viewId ? 'Профили игроков видны после входа' : 'Профиль доступен после входа' }}</h2>
      <button class="brass" @click="store.gate = 'choose'">Войти</button>
    </div>

    <!-- чужой профиль -->
    <main v-else-if="viewId" class="p-main">
      <PublicProfile :id="viewId" />
    </main>

    <main v-else class="p-main">
      <ProfileHead :p="head" editable>
        <router-link v-if="publicId" class="mini p-as" :to="'/profile/' + publicId" title="Твой профиль глазами других игроков">👁 Как видят другие</router-link>
      </ProfileHead>

      <!-- вкладки: профиль, настройки, у мастера — игроки и мастера -->
      <nav class="p-tabs" role="tablist" aria-label="Разделы профиля">
        <button v-for="t in tabs" :key="t.k" type="button" role="tab" :aria-selected="tab === t.k" :class="{ on: tab === t.k }" @click="setTab(t.k)">
          {{ t.t }}<b v-if="t.n" class="p-tab-n">{{ t.n }}</b>
        </button>
      </nav>

      <template v-if="tab === 'profile'">
        <!-- анкета: имя, раса, цвет -->
        <section class="p-card">
          <h3>Анкета <small>аватарку и обложку меняй прямо на них</small></h3>
          <div class="p-form">
            <label>{{ isMaster ? 'Имя (видно на курсоре и в пингах)' : 'Имя персонажа' }}<input v-model="f.name" maxlength="40" /></label>
            <label v-if="!isMaster">Раса<input v-model="f.race" maxlength="40" placeholder="необязательно" /></label>
            <label class="color">Цвет курсора и пингов<input v-model="f.color" type="color" /></label>
            <button class="brass small" :disabled="busy || !formDirty" @click="saveProfile">Сохранить</button>
          </div>
        </section>

        <!-- о себе: видят все вошедшие игроки -->
        <section class="p-card">
          <h3>О себе <small>{{ isMaster ? 'в режиме мастера твой профиль другим не виден' : 'видят все игроки, гости — нет' }}</small></h3>
          <RichEditor v-if="aboutReady" v-model="about" :min-height="140" placeholder="Пара слов о себе или о персонаже: кто ты, во что любишь играть, когда удобно собираться…" />
          <div v-else class="muted small">Загружаю…</div>
          <div class="row end p-about-acts">
            <span v-if="aboutDirty" class="muted small">есть несохранённое</span>
            <button class="brass small" :disabled="busy || !aboutDirty" @click="saveAbout">Сохранить</button>
          </div>
        </section>

        <!-- персонаж мастера: мастер тоже может играть -->
        <section v-if="isMaster" class="p-card">
          <h3>Мой персонаж <small>{{ store.me.character ? 'можно играть: «♛ Мастер ⇄ ⚔ Персонаж» в меню' : 'если ты не только ведёшь, но и играешь' }}</small></h3>
          <div class="char-row">
            <label>Имя персонажа<input v-model="ch.character" maxlength="40" /></label>
            <label>Раса<input v-model="ch.race" maxlength="40" placeholder="необязательно" /></label>
            <button class="brass small" :disabled="!ch.character.trim()" @click="saveCharacter">{{ store.me.character ? 'Сохранить' : 'Создать персонажа' }}</button>
          </div>
          <p class="muted small">Персонаж появится в списке игроков: его можно брать в группы заказов, добавлять в отряд и открывать ему секреты. Аватарка, обложка и «О себе» — твои мастерские, пока в режиме персонажа не поставишь другие.</p>
        </section>
        <section v-if="store.me.asMaster" class="p-card">
          <h3>Режим персонажа</h3>
          <p class="muted">Ты сейчас играешь «{{ store.me.name }}». Имя, расу, аватарку и обложку персонажа меняй здесь; пароль — в режиме мастера.</p>
        </section>

        <!-- карточки героев, привязанные к игроку -->
        <section v-if="myHeroes.length" class="p-card">
          <h3>Мои карточки <small>в разделе «Герои Анкарии»</small></h3>
          <HeroTiles :heroes="myHeroes" mine />
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

        <PlayersStrip />
      </template>

      <ProfileSettings v-else-if="tab === 'settings'" />

      <template v-else-if="tab === 'players'">
        <!-- игроки (мастер) -->
        <section class="p-card">
          <h3>Игроки <small>{{ activePlayers.length }} в игре · {{ pendingPlayers.length }} ждут</small></h3>
          <div v-if="!store.data.players?.length" class="muted">Заявок пока не было. Игроки отправляют их с экрана входа.</div>
          <div v-for="p in sortedPlayers" :key="p.id" class="pl" :class="'pl-' + p.status">
            <img v-if="p.avatar" :src="avatarUrl(p.avatar)" alt="" class="pl-av" />
            <span v-else class="pl-av ini" :style="{ background: p.color }">{{ p.character[0] }}</span>
            <div class="pl-main">
              <router-link v-if="p.status === 'active'" class="p-name" :to="'/profile/' + p.id" title="Открыть профиль">{{ p.character }}</router-link><b v-else>{{ p.character }}</b><span v-if="p.race" class="muted"> · {{ p.race }}</span>
              <div class="muted small">{{ p.linked ? `персонаж ${p.tech ? 'техспециалиста' : 'мастера'} ${p.login}` : `логин ${p.login} · ${STATUS[p.status]}` }}</div>
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
              <button v-if="!p.linked" class="mini" title="Игрок забыл пароль — выдать новый, старые входы сбросятся" @click="resetPlayer(p)">Новый пароль</button>
              <button v-if="p.status === 'active' && !p.linked" class="mini" :class="{ ok: p.wiki }" :title="p.wiki ? 'Редактор вики — изменить права' : 'Сделать редактором вики: разделы или отдельные страницы'" @click="wikiFor = p">📖 {{ p.wiki ? 'Редактор' : 'Вики' }}</button>
            </template>
            <button v-if="store.me.owner && !p.linked" class="mini" :class="{ ok: ipFor?.id === p.id }" title="С каких IP заходил игрок" @click="showIps(p)">🌐 IP</button>
            <button class="mini no" title="Удалить аккаунт" @click="removePlayer(p)">✕</button>
            <div v-if="ipFor?.id === p.id" class="pl-ips">
              <div v-if="!ipFor.list.length" class="muted small">Пока ни одного входа не записано — журнал ведётся с 27 октября 2026.</div>
              <table v-else>
                <tr><th>IP</th><th>Первый раз</th><th>Последний</th><th>Раз</th><th>Браузер</th></tr>
                <tr v-for="x in ipFor.list" :key="x.ip"><td><b>{{ x.ip }}</b></td><td>{{ dt(x.first) }}</td><td>{{ dt(x.last) }}</td><td>{{ x.n }}</td><td class="ua" :title="x.ua">{{ uaShort(x.ua) }}</td></tr>
              </table>
              <button v-if="ipFor.list.length" class="mini" @click="copyIps">Скопировать</button>
            </div>
          </div>
          <WikiPermsDialog v-if="wikiFor" :player="store.data.players.find(x => x.id === wikiFor.id) || wikiFor" @close="wikiFor = null" />
          <div v-if="issuedPlayer" class="ms-issued">
            Передай игроку — логин <b>{{ issuedPlayer.login }}</b>, пароль <b>{{ issuedPlayer.password }}</b>
            <button class="mini" @click="copyIssuedPlayer">Скопировать</button>
            <button class="mini" title="Скрыть" @click="issuedPlayer = null">✕</button>
          </div>
        </section>

        <!-- мастера: заводит и убирает только владелец сайта -->
        <section v-if="store.me.owner" class="p-card">
          <h3>Мастера <small>{{ masters.length }} · входят тем же окном, что и игроки</small></h3>
          <div v-for="m in masters" :key="m.login" class="pl">
            <img v-if="m.avatar" :src="avatarUrl(m.avatar)" alt="" class="pl-av" />
            <span v-else class="pl-av ini" style="background: #e7c56f">{{ (m.name || m.login)[0] }}</span>
            <div class="pl-main">
              <b>{{ m.name }}</b>
              <div class="muted small">логин {{ m.login }}{{ m.owner ? ' · владелец сайта' : '' }}</div>
            </div>
            <template v-if="!m.owner">
              <button class="mini" title="Выдать новый пароль — старые входы этого мастера сбросятся" @click="resetMaster(m)">Новый пароль</button>
              <button class="mini no" title="Убрать мастера" @click="dropMaster(m)">✕</button>
            </template>
          </div>
          <form class="pw ms-add" @submit.prevent="addMaster">
            <label>Логин нового мастера<input v-model.trim="nm.login" autocomplete="off" maxlength="32" placeholder="например, Fedya" /></label>
            <label>Пароль<span class="ms-pass"><input v-model="nm.password" type="text" autocomplete="new-password" minlength="6" /><button type="button" class="mini" title="Придумать пароль" @click="nm.password = genPass()">🎲</button></span></label>
            <button class="brass small" :disabled="nm.login.length < 3 || nm.password.length < 6">Добавить мастера</button>
          </form>
          <div v-if="issued" class="ms-issued">
            Передай мастеру — логин <b>{{ issued.login }}</b>, пароль <b>{{ issued.password }}</b>
            <button class="mini" @click="copyIssued">Копировать</button>
            <button class="mini" title="Скрыть" @click="issued = null">✕</button>
          </div>
        </section>
      </template>

      <footer class="love">Позже добавится коннект с моим приложением.<br />С любовью, Энди ⚙🛠</footer>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import UserMenu from './UserMenu.vue'
import SteamLoader from './SteamLoader.vue'
import WikiPermsDialog from './WikiPermsDialog.vue'
import RichEditor from './RichEditor.vue'
import ProfileHead from './profile/ProfileHead.vue'
import ProfileSettings from './profile/ProfileSettings.vue'
import PublicProfile from './profile/PublicProfile.vue'
import HeroTiles from './profile/HeroTiles.vue'
import PlayersStrip from './profile/PlayersStrip.vue'
import { store, init, api, act, toast, updateProfile, avatarUrl } from '../map/store.js'
import { RANKS } from '../shared/catalog.js'

const route = useRoute()
const router = useRouter()
onMounted(init)

const isMaster = computed(() => store.role === 'master')
const wikiFor = ref(null) // игрок, которому мастер выдаёт права редактора вики
const STATUS = { pending: 'ждёт одобрения', active: 'в игре', rejected: 'отклонён' }

// /profile/:id — чужой профиль; свой id в адресе — это просто свой профиль
const viewId = computed(() => {
  const id = route.params.id ? String(route.params.id) : ''
  return id && id !== store.me?.id ? id : ''
})
watch(() => [route.params.id, store.me?.id], ([id, me]) => { if (id && id === me) router.replace({ path: '/profile', query: route.query }) })

/* ---------- вкладки ---------- */
const tabs = computed(() => [
  { k: 'profile', t: 'Профиль' },
  { k: 'settings', t: 'Настройки' },
  ...(isMaster.value ? [{ k: 'players', t: 'Игроки', n: pendingPlayers.value.length }] : [])
])
const tab = computed(() => (tabs.value.some(t => t.k === route.query.tab) ? route.query.tab : 'profile'))
const setTab = k => router.replace({ query: { ...route.query, tab: k === 'profile' ? undefined : k } })

/* ---------- шапка: обложка, аватар, имя ---------- */
const own = ref(null) // свой профиль с сервера: «О себе», с какого дня в игре
const myRoster = computed(() => store.data.roster?.find(p => p.id === store.me?.id))
const head = computed(() => ({
  name: store.me.name, avatar: store.me.avatar, color: store.me.color, banner: store.me.banner, rank: store.me.rank,
  race: myRoster.value?.race || '', master: isMaster.value, linked: !!store.me.asMaster, since: own.value?.since || null
}))
// игрок (и персонаж мастера) может посмотреть, как его профиль видят другие; мастера в режиме мастера другие не видят
const publicId = computed(() => (store.role === 'player' ? store.me.id : ''))

/* ---------- анкета ---------- */
const f = reactive({ name: '', race: '', color: '#ffd166' })
const resetForm = () => Object.assign(f, { name: store.me?.name || '', race: myRoster.value?.race || '', color: store.me?.color || '#ffd166' })
watch(() => [store.me?.id, store.me?.name, store.me?.color, myRoster.value?.race], resetForm, { immediate: true })
const formDirty = computed(() => !!store.me && (f.name !== store.me.name || f.color !== store.me.color || (!isMaster.value && f.race !== (myRoster.value?.race || ''))))

const busy = ref(false)
async function saveProfile() {
  busy.value = true
  try {
    const patch = { name: f.name, color: f.color }
    if (!isMaster.value) patch.race = f.race
    await updateProfile(patch)
    toast('Профиль сохранён')
  } catch (e) {
    toast(e.message, 'error')
  } finally {
    busy.value = false
  }
}

/* ---------- о себе ---------- */
const about = ref('')
const aboutSaved = ref('')
const aboutReady = ref(false)
const aboutDirty = computed(() => aboutReady.value && about.value !== aboutSaved.value)
async function loadOwn() {
  if (!store.me || viewId.value) return
  aboutReady.value = false
  try {
    own.value = await api('GET', '/api/profiles/me')
    about.value = aboutSaved.value = own.value.about || ''
  } catch (e) { toast(e.message, 'error') } finally { aboutReady.value = true }
}
// сменил режим «мастер ⇄ персонаж» — это уже другой профиль
watch(() => [store.me?.id, viewId.value], loadOwn, { immediate: true })
async function saveAbout() {
  busy.value = true
  try {
    await updateProfile({ about: about.value })
    aboutSaved.value = about.value
    toast('«О себе» сохранено')
  } catch (e) { toast(e.message, 'error') } finally { busy.value = false }
}

/* ---------- персонаж мастера ---------- */
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

const sortedPlayers = computed(() => {
  const order = { pending: 0, active: 1, rejected: 2 }
  return [...(store.data.players || [])].sort((a, b) => order[a.status] - order[b.status] || a.character.localeCompare(b.character, 'ru'))
})
const activePlayers = computed(() => (store.data.players || []).filter(p => p.status === 'active'))
const pendingPlayers = computed(() => (store.data.players || []).filter(p => p.status === 'pending'))
const myHeroes = computed(() => (store.data.heroes || []).filter(h => h.ownerId && h.ownerId === store.me?.id))
const myNotes = computed(() => (store.data.notes || []).filter(n => n.ownerId === store.me?.id))

// мастера (только у владельца сайта): список, новый мастер, новый пароль, убрать
const masters = ref([])
async function loadMasters() {
  if (!store.me?.owner) return
  try { masters.value = await api('GET', '/api/masters') } catch (e) { toast(e.message, 'error') }
}
watch(() => store.me?.owner, loadMasters, { immediate: true })
const nm = reactive({ login: '', password: '' })
const issued = ref(null) // логин и пароль, которые надо передать мастеру
function genPass() {
  const abc = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return [...crypto.getRandomValues(new Uint32Array(12))].map(x => abc[x % abc.length]).join('')
}
async function addMaster() {
  try {
    await act('POST', '/api/masters', { login: nm.login, password: nm.password }, `Мастер «${nm.login}» добавлен`)
    issued.value = { login: nm.login, password: nm.password }
    Object.assign(nm, { login: '', password: '' })
    loadMasters()
  } catch { /* тост */ }
}
async function resetMaster(m) {
  if (!confirm(`Выдать мастеру «${m.login}» новый пароль? Старый перестанет работать, его выкинет со всех устройств.`)) return
  const password = genPass()
  try {
    await act('POST', `/api/masters/${encodeURIComponent(m.login)}/password`, { password }, 'Пароль сменён')
    issued.value = { login: m.login, password }
  } catch { /* тост */ }
}
async function dropMaster(m) {
  if (!confirm(`Убрать мастера «${m.login}»? Он сразу потеряет доступ.`)) return
  try {
    await act('DELETE', `/api/masters/${encodeURIComponent(m.login)}`, undefined, 'Мастер убран')
    loadMasters()
  } catch { /* тост */ }
}
async function copyIssued() {
  try {
    await navigator.clipboard.writeText(`Анкария — вход мастера\nЛогин: ${issued.value.login}\nПароль: ${issued.value.password}`)
    toast('Скопировано')
  } catch { toast('Не получилось скопировать — перепиши вручную', 'error') }
}

// журнал входов игрока (только владелец сайта)
const ipFor = ref(null)
async function showIps(p) {
  if (ipFor.value?.id === p.id) { ipFor.value = null; return }
  try { ipFor.value = { id: p.id, name: p.character, list: await api('GET', `/api/players/${p.id}/ips`) } } catch (e) { toast(e.message, 'error') }
}
const dt = t => new Date(t).toLocaleString('ru-RU', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })
const uaShort = ua => { const s = String(ua || ''); const os = /Android/.test(s) ? 'Android' : /iPhone|iPad/.test(s) ? 'iOS' : /Windows/.test(s) ? 'Windows' : /Mac OS/.test(s) ? 'macOS' : /Linux/.test(s) ? 'Linux' : ''; const br = /YaBrowser/.test(s) ? 'Яндекс' : /Edg\//.test(s) ? 'Edge' : /OPR\//.test(s) ? 'Opera' : /Firefox/.test(s) ? 'Firefox' : /Chrome/.test(s) ? 'Chrome' : /Safari/.test(s) ? 'Safari' : ''; return [br, os].filter(Boolean).join(' · ') || '—' }
async function copyIps() {
  const t = `${ipFor.value.name}:\n` + ipFor.value.list.map(x => `${x.ip} — ${dt(x.first)} … ${dt(x.last)}, ${x.n} раз, ${uaShort(x.ua)}`).join('\n')
  try { await navigator.clipboard.writeText(t); toast('Скопировано') } catch { prompt('Скопируй:', t) }
}
const call = (url, method, text, body) => act(method, url, method === 'DELETE' ? undefined : (body || {}), text).catch(() => {})
// игрок забыл пароль: новый придумывает сайт, мастер передаёт его игроку
const issuedPlayer = ref(null)
async function resetPlayer(p) {
  if (!confirm(`Выдать игроку «${p.character}» (${p.login}) новый пароль? Старый перестанет работать, его выкинет со всех устройств.`)) return
  const password = genPass()
  try {
    await act('POST', `/api/players/${p.id}/password`, { password }, 'Пароль сменён')
    issuedPlayer.value = { login: p.login, password }
  } catch { /* тост */ }
}
async function copyIssuedPlayer() {
  try {
    await navigator.clipboard.writeText(`Анкария — вход\nЛогин: ${issuedPlayer.value.login}\nПароль: ${issuedPlayer.value.password}\nПароль можно сменить в профиле.`)
    toast('Скопировано')
  } catch { toast('Не получилось скопировать — перепиши вручную', 'error') }
}
function removePlayer(p) {
  if (confirm(`Удалить аккаунт «${p.character}» (${p.login})? Это нельзя отменить.`)) call(`/api/players/${p.id}`, 'DELETE', 'Аккаунт удалён')
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
label { display: grid; gap: 4px; font-size: 12px; font-weight: 700; color: #a8936c; }
input { min-height: 38px; padding: 7px 11px; border-radius: 9px; border: 1px solid #6e4f22; background: #120e09; color: #efe3c8; font: 500 14px 'Manrope', sans-serif; }
input:focus { outline: none; border-color: #e6c27a; }
input[type='color'] { width: 60px; padding: 3px; cursor: pointer; }
.color { grid-template-columns: auto 60px; align-items: center; gap: 10px; }
.row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.row.end { justify-content: flex-end; }
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
.pl { display: flex; align-items: center; gap: 10px; padding: 9px 4px; border-top: 1px solid rgba(201, 162, 79, .14); flex-wrap: wrap; }
.pl-ips { flex-basis: 100%; display: grid; gap: 6px; padding: 8px 10px; border-radius: 10px; background: rgba(0, 0, 0, .25); border: 1px dashed rgba(201, 162, 79, .3); overflow-x: auto; }
.pl-ips table { border-collapse: collapse; font: 600 12px 'Manrope', sans-serif; }
.pl-ips th { padding: 3px 8px; color: #a8936c; font-weight: 800; text-align: left; white-space: nowrap; }
.pl-ips td { padding: 3px 8px; border-top: 1px solid rgba(201, 162, 79, .12); white-space: nowrap; }
.pl-ips td.ua { max-width: 160px; overflow: hidden; text-overflow: ellipsis; }
.pl-ips .mini { justify-self: start; }
.pl-pending { background: rgba(224, 96, 74, .08); border-radius: 10px; padding: 9px; }
.pl-rejected { opacity: .55; }
.pl-av { width: 38px; height: 38px; border-radius: 50%; object-fit: cover; border: 2px solid #b8893f; flex: none; }
.pl-av.ini { display: grid; place-items: center; color: #1b1408; font-weight: 800; }
.pl-main { flex: 1; min-width: 0; }
.note-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-top: 1px solid rgba(201, 162, 79, .14); font-size: 13.5px; }
.dot { width: 12px; height: 12px; border-radius: 50%; flex: none; }
.char-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto; gap: 10px; align-items: end; }
.ms-pass { display: flex; gap: 6px; }
.ms-pass input { flex: 1; min-width: 0; }
.ms-issued { margin-top: 10px; padding: 10px 12px; border-radius: 10px; background: rgba(155, 224, 122, .08); border: 1px solid rgba(155, 224, 122, .35); color: #cfe9bf; font-size: 13.5px; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.love { text-align: center; margin-top: 18px; font: italic 600 18px/1.5 'Cormorant Garamond', Georgia, serif; color: #a8936c; }
.pw.ms-add { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto; gap: 10px; align-items: end; margin-top: 12px; }
/* вкладки профиля: латунная плашка у выбранной */
.p-tabs { display: flex; gap: 4px; padding: 4px; border-radius: 13px; background: rgba(0, 0, 0, .3); border: 1px solid rgba(201, 162, 79, .25); }
.p-tabs button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 8px 18px; border: 0; border-radius: 9px; background: none; color: #a8936c; font: 800 13.5px 'Manrope', sans-serif; cursor: pointer; }
.p-tabs button:hover:not(.on) { color: #efe3c8; background: rgba(255, 255, 255, .04); }
.p-tabs button.on { color: #1e150a; background: linear-gradient(180deg, #f2d58f, #c99a48 55%, #a87a33); box-shadow: inset 0 1px 0 rgba(255, 245, 210, .7); }
.p-tabs button:focus-visible { outline: 2px solid #e6c27a; outline-offset: 2px; }
.p-tab-n { min-width: 18px; height: 18px; padding: 0 5px; border-radius: 99px; background: #e0281e; color: #fff; font-size: 11px; line-height: 18px; }
.p-form { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto auto; gap: 10px; align-items: end; }
.p-form .color { grid-template-columns: none; }
.p-form input:not([type='color']) { min-width: 0; }
.p-about-acts { margin-top: 10px; }
.p-as { align-self: end; margin-bottom: 6px; }
.p-name { color: #f3d99a; font-weight: 800; text-decoration: none; border-bottom: 1px dashed rgba(231, 197, 111, .5); }
.p-name:hover { color: #fff3d6; border-bottom-style: solid; }
@media (max-width: 640px) {
  .pw.ms-add, .char-row, .p-form { grid-template-columns: minmax(0, 1fr); }
  .p-tabs button { flex: 1; padding: 8px 10px; }
}
</style>
