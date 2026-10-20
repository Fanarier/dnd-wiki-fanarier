<template>
  <!-- личные настройки героя в журнале: сон в день, особенности, избранное (заготовки в один клик);
       мастер — свой лимит часов герою и запреты деятельностей. Внизу у мастера — таймскип и блокировка для всех -->
  <div class="st">
    <section class="st-box">
      <h3>🙋 {{ hero.name }}</h3>
      <div class="st-row">
        <label class="st-f">Отдых в день
          <input v-model="c.rest" class="st-in" :list="'rest-kinds'" maxlength="30" :disabled="!hero.canWrite" placeholder="Сон" />
          <datalist id="rest-kinds"><option v-for="k in REST_KINDS" :key="k" :value="k" /></datalist>
        </label>
        <label class="st-f">Сколько часов
          <select v-model.number="c.sleep" class="st-in" :disabled="!hero.canWrite">
            <option v-for="h in [0, 2, 4, 6, 8, 10, 12]" :key="h" :value="h">{{ h ? h + ' ч' : 'не нужен (Кованый, нежить…)' }}</option>
          </select>
        </label>
        <label v-if="master" class="st-f">Свой лимит часов<input v-model.number="c.limit" type="number" min="0" class="st-in" placeholder="как у всех" title="0 — как у всех" /></label>
      </div>
      <label class="st-f">Особенности героя (видно в журнале)
        <textarea v-model="c.note" rows="2" maxlength="2000" class="st-in" :disabled="!hero.canWrite" placeholder="Например: Кованый — не спит, восстанавливается подзарядкой 4 ч; Нэко — +1 к броскам отдыха" />
      </label>
    </section>

    <section class="st-box">
      <h3>★ Избранное <small>заготовки — одной кнопкой в форме записи</small></h3>
      <div v-if="!c.favs.length" class="st-empty">Пусто. В форме записи есть кнопка «★ В избранное».</div>
      <div v-for="(f, i) in c.favs" :key="f.id" class="st-fav">
        <input v-model="f.name" class="st-in" maxlength="600" :disabled="!hero.canWrite" />
        <input v-model="f.hours" class="st-in sm" placeholder="ч" :disabled="!hero.canWrite" />
        <input v-model="f.stamina" class="st-in sm" placeholder="выносл." :disabled="!hero.canWrite" />
        <button v-if="hero.canWrite" type="button" class="st-x" title="Убрать" @click="c.favs.splice(i, 1)">✕</button>
      </div>
    </section>

    <section v-if="master || c.banned.length" class="st-box">
      <h3>⛔ Запреты <small>{{ master ? 'игрок не сможет записать такую деятельность' : 'мастер запретил герою' }}</small></h3>
      <div v-for="(b, i) in c.banned" :key="i" class="st-fav">
        <input v-model="b.name" class="st-in" placeholder="Начало названия: «Поход в подземелье»" :disabled="!master" />
        <input v-model="b.reason" class="st-in" placeholder="Почему: ранен, под арестом…" :disabled="!master" />
        <button v-if="master" type="button" class="st-x" @click="c.banned.splice(i, 1)">✕</button>
      </div>
      <button v-if="master" type="button" class="st-add" @click="c.banned.push({ name: '', reason: '' })">＋ запрет</button>
    </section>

    <div v-if="hero.canWrite" class="st-acts"><span class="grow" /><button type="button" class="st-btn primary" :disabled="busy" @click="saveHero">Сохранить настройки героя</button></div>

    <section v-if="master" class="st-box master">
      <h3>⌛ Таймскип и блокировка <small>для всех героев</small></h3>
      <div class="st-row">
        <label class="st-f">Часов между сессиями<input v-model.number="g.limit" type="number" min="1" class="st-in" /></label>
        <label class="st-f">Закрыть период до (включительно)<input v-model="g.until" type="date" class="st-in" /></label>
      </div>
      <p class="st-hint">Закрытый период игроки больше не правят — всё учтено. Мастер правит как прежде.</p>
      <label class="st-chk"><input v-model="g.blocked" type="checkbox" /> 🔒 Заблокировать следующий период деятельностей (можно только планировать черновики)</label>
      <input v-if="g.blocked" v-model="g.reason" class="st-in" maxlength="300" placeholder="Причина — увидят игроки: «впереди сюжетный таймскип»" />
      <div class="st-acts"><span class="grow" /><button type="button" class="st-btn primary" :disabled="busy" @click="saveGlobal">Сохранить</button></div>
    </section>
  </div>
</template>

<script setup>
import { reactive, ref, watch } from 'vue'
import { actState, api, toast, loadActivities } from '../../map/store.js'

const props = defineProps({ hero: { type: Object, required: true }, master: Boolean })
const blank = () => ({ limit: 0, sleep: 8, rest: 'Сон', note: '', favs: [], banned: [] })
// эльфы и дроу уходят в транс, монахи медитируют, Кованые подзаряжаются
const REST_KINDS = ['Сон', 'Транс', 'Медитация', 'Подзарядка']
const c = reactive(blank())
const g = reactive({ limit: 336, until: '', blocked: false, reason: '' })
function fill() {
  Object.assign(c, blank(), JSON.parse(JSON.stringify(actState.cfg[props.hero.heroId] || {})))
  Object.assign(g, { limit: actState.limit, ...actState.lock })
}
// чужие правки журнала не сбрасывают то, что сейчас набираешь: перечитываем при смене героя и после сохранения
watch(() => props.hero.heroId, fill, { immediate: true })
const busy = ref(false)
async function run(fn, ok) {
  busy.value = true
  try { await fn(); await loadActivities(true); fill(); toast(ok) } catch (e) { toast(e.message, 'error') } finally { busy.value = false }
}
const saveHero = () => run(() => api('PUT', `/api/activities-hero/${props.hero.heroId}`, { ...c, favs: c.favs.filter(f => f.name.trim()), banned: c.banned.filter(b => b.name.trim()) }), 'Настройки героя сохранены')
const saveGlobal = () => run(() => api('PUT', '/api/activities-settings', { ...g }), 'Сохранено')
</script>

<style scoped>
.st { display: grid; gap: 10px; }
.st-box { display: grid; gap: 8px; padding: 12px; border-radius: 14px; background: rgba(20, 16, 11, .6); border: 1px solid rgba(231, 197, 111, .14); }
.st-box.master { border-color: rgba(240, 181, 79, .4); }
.st-box h3 { margin: 0; font: 700 19px 'Cormorant Garamond', serif; color: #f3dc9e; }
.st-box h3 small { color: #a8936c; font: 600 12px 'Manrope', sans-serif; }
.st-row { display: flex; flex-wrap: wrap; gap: 8px; }
.st-f { display: grid; gap: 3px; flex: 1 1 200px; color: #a8936c; font: 800 10.5px 'Manrope', sans-serif; letter-spacing: .06em; text-transform: uppercase; }
.st-in { width: 100%; box-sizing: border-box; padding: 7px 9px; border-radius: 9px; border: 1px solid rgba(231, 197, 111, .25); background: rgba(0, 0, 0, .35); color: #efe3c8; font: 600 13px 'Manrope', sans-serif; letter-spacing: 0; text-transform: none; color-scheme: dark; resize: vertical; }
.st-in.sm { width: 90px; flex: none; }
.st-fav { display: flex; gap: 6px; align-items: center; }
.st-x { flex: none; width: 28px; height: 28px; border-radius: 8px; border: 1px solid rgba(255, 122, 107, .35); background: none; color: #ff9b8f; cursor: pointer; }
.st-add { justify-self: start; padding: 4px 10px; border-radius: 8px; border: 1px dashed rgba(231, 197, 111, .4); background: none; color: #e7c56f; font: 700 12px 'Manrope', sans-serif; cursor: pointer; }
.st-empty, .st-hint { margin: 0; color: #a8936c; font: 600 12.5px 'Manrope', sans-serif; }
.st-chk { display: flex; align-items: center; gap: 8px; color: #efe3c8; font: 700 13px 'Manrope', sans-serif; }
.st-acts { display: flex; }
.grow { flex: 1; }
.st-btn { padding: 7px 14px; border-radius: 9px; border: 1px solid rgba(231, 197, 111, .35); background: rgba(231, 197, 111, .08); color: #f3d99a; font: 700 12.5px 'Manrope', sans-serif; cursor: pointer; }
.st-btn.primary { background: linear-gradient(180deg, #f0d083, #c9a24f); color: #1b1408; border-color: #c9a24f; }
</style>
