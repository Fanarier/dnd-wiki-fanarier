<template>
  <div class="um">
    <template v-if="store.me">
      <div class="bell-wrap">
        <button class="um-btn bell" :class="{ ring: unread }" :title="unread ? `Новых: ${unread}` : 'Уведомления'" @click="toggle">
          <svg viewBox="0 0 24 24" width="19" height="19"><path :d="BELL" fill="currentColor" /></svg>
          <b v-if="unread" class="count">{{ unread > 9 ? '9+' : unread }}</b>
        </button>
        <div v-if="open" class="panel" @click.stop>
          <header>
            <span>Уведомления</span>
            <button v-if="unread" class="mini" @click="markRead()">прочитать все</button>
          </header>
          <div v-if="!list.length" class="empty">Тихо, как в мастерской ночью.</div>
          <ul>
            <li v-for="n in list" :key="n.id" :class="{ unread: !n.read, pending: actionable(n) }">
              <div class="n-text">{{ n.text }}</div>
              <div class="n-meta">{{ ago(n.createdAt) }}</div>
              <div v-if="actionable(n)" class="n-actions">
                <template v-if="n.kind === 'register'">
                  <button class="mini ok" @click="act2(`/api/players/${n.data.playerId}/approve`, 'Игрок одобрен')">Одобрить</button>
                  <button class="mini no" @click="act2(`/api/players/${n.data.playerId}/reject`, 'Заявка отклонена')">Отказать</button>
                </template>
                <template v-if="n.kind === 'apply'">
                  <button class="mini ok" @click="act2(`/api/quests/${n.data.questId}/applicants/${n.data.applicantId}/accept`, 'Взят в группу')">В группу</button>
                  <button class="mini no" @click="act2(`/api/quests/${n.data.questId}/applicants/${n.data.applicantId}/reject`, 'Отклик отклонён')">Отклонить</button>
                </template>
              </div>
              <router-link v-if="n.data?.questId" class="n-link" :to="{ path: '/wiki', query: { quest: n.data.questId } }" @click="open = false">к заказу →</router-link>
            </li>
          </ul>
        </div>
      </div>
      <router-link to="/profile" class="um-btn me" :title="`${store.me.name} — профиль`">
        <img v-if="store.me.avatar" :src="avatarUrl(store.me.avatar)" alt="" />
        <span v-else class="ini" :style="{ background: store.me.color }">{{ store.me.name[0] }}</span>
        <span class="me-name">{{ store.me.name }}</span>
        <i v-if="store.role === 'master'" class="crown" title="Мастер">♛</i>
      </router-link>
    </template>
    <button v-else class="um-login" @click="store.gate = 'choose'">Войти</button>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { mdiBell } from '@mdi/js'
import { store, unread, markRead, act, avatarUrl } from '../map/store.js'

const BELL = mdiBell
const open = ref(false)
// заявки и отклики, ждущие решения, — наверху
const actionable = n => !n.resolved && (n.kind === 'register' || n.kind === 'apply') && store.role === 'master'
const list = computed(() => [...(store.data.notifications || [])].sort((a, b) => actionable(b) - actionable(a) || b.createdAt - a.createdAt))

function toggle() {
  open.value = !open.value
  // открыл — значит прочитал (заявки и отклики висят, пока их не решат)
  if (open.value) {
    const ids = list.value.filter(n => !n.read && !actionable(n)).map(n => n.id)
    if (ids.length) setTimeout(() => markRead(ids), 1200)
  }
}
const close = () => { open.value = false }
onMounted(() => document.addEventListener('click', onDoc))
onBeforeUnmount(() => document.removeEventListener('click', onDoc))
function onDoc(e) { if (!e.target.closest?.('.bell-wrap')) close() }

const act2 = (url, text) => act('POST', url, {}, text).catch(() => {})

function ago(ms) {
  const m = Math.round((Date.now() - ms) / 60000)
  if (m < 1) return 'только что'
  if (m < 60) return `${m} мин назад`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} ч назад`
  return new Date(ms).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}
</script>

<style scoped>
.um { display: flex; align-items: center; gap: 6px; font-family: 'Manrope', sans-serif; }
.um-btn { position: relative; display: inline-flex; align-items: center; gap: 8px; height: 36px; padding: 0 8px; border-radius: 10px; border: 1px solid transparent; background: none; color: #ece6da; cursor: pointer; text-decoration: none; font: 700 13px 'Manrope', sans-serif; }
.um-btn:hover { background: rgba(255, 255, 255, .07); }
.bell.ring svg { animation: ring 2.4s ease-in-out infinite; transform-origin: 50% 10%; color: #f3d99a; }
.count { position: absolute; top: 2px; right: 0; min-width: 16px; height: 16px; padding: 0 4px; border-radius: 99px; background: #e0281e; color: #fff; font-size: 10px; line-height: 16px; text-align: center; }
.me img, .ini { width: 28px; height: 28px; border-radius: 50%; object-fit: cover; border: 2px solid #b8893f; flex: none; }
.ini { display: grid; place-items: center; color: #1b1408; font-weight: 800; }
.me-name { max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.crown { color: #e6c27a; font-style: normal; }
.um-login { height: 34px; padding: 0 14px; border-radius: 10px; border: 1px solid #6e4f22; cursor: pointer; color: #1e150a; font: 800 13px 'Manrope', sans-serif; background: linear-gradient(180deg, #f2d58f, #c99a48 55%, #a87a33); box-shadow: inset 0 1px 0 rgba(255, 245, 210, .7), 0 2px 0 #5a3e1a; }
.bell-wrap { position: relative; }
.panel { position: absolute; right: 0; top: calc(100% + 8px); width: min(360px, 90vw); max-height: 70vh; overflow-y: auto; z-index: 300; background: #17130e; border: 1px solid #8a6630; border-radius: 14px; box-shadow: 0 0 0 3px #2a2117, 0 20px 50px rgba(0, 0, 0, .6); color: #efe3c8; }
.panel header { display: flex; justify-content: space-between; align-items: center; padding: 12px 14px; border-bottom: 1px solid rgba(201, 162, 79, .25); font: 700 18px 'Cormorant Garamond', Georgia, serif; color: #f3d99a; position: sticky; top: 0; background: #17130e; }
.empty { padding: 20px; text-align: center; color: #a8936c; font-style: italic; }
ul { list-style: none; margin: 0; padding: 6px; display: grid; gap: 4px; }
li { padding: 9px 10px; border-radius: 10px; border-left: 3px solid transparent; }
li.unread { background: rgba(201, 162, 79, .09); border-color: #e6c27a; }
li.pending { background: rgba(224, 40, 30, .08); border-color: #e0604a; }
.n-text { font-size: 13px; line-height: 1.4; }
.n-meta { font-size: 11px; color: #a8936c; margin-top: 2px; }
.n-actions { display: flex; gap: 6px; margin-top: 6px; }
.n-link { display: inline-block; margin-top: 4px; font-size: 12px; color: #e6c27a; }
.mini { border: 1px solid rgba(255, 255, 255, .15); background: rgba(255, 255, 255, .06); color: #efe3c8; border-radius: 8px; padding: 4px 10px; font: 700 12px 'Manrope', sans-serif; cursor: pointer; }
.mini.ok { background: #3f7d10; border-color: #3f7d10; color: #fff; }
.mini.no { color: #ff9b8f; }
@keyframes ring { 0%, 70%, 100% { transform: rotate(0); } 75% { transform: rotate(14deg); } 80% { transform: rotate(-12deg); } 85% { transform: rotate(8deg); } 90% { transform: rotate(-4deg); } }
@media (max-width: 760px) { .me-name { display: none; } }
</style>
