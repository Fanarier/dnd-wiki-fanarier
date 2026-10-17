<template>
  <!-- мастер делает игрока редактором вики: целые разделы правил или отдельные страницы (раса, класс, статья, школа магии, эффект) -->
  <div class="wp-back" @click.self="$emit('close')">
    <div class="wp" role="dialog" aria-label="Редактор вики">
      <header>
        <div>
          <span class="wp-kick">Редактор вики</span>
          <h3>{{ player.character }}</h3>
        </div>
        <button type="button" class="wp-x" aria-label="Закрыть" @click="$emit('close')">✕</button>
      </header>
      <p class="wp-hint">Отмеченное игрок сможет править прямо в вики. Раздел целиком — ещё и добавлять и удалять страницы в нём.
        Каждая правка попадает в «Журнал правок вики», откуда её можно откатить. Остальной сайт у игрока как был.</p>
      <div v-if="!rulesState.loaded" class="wp-hint">Загружаю правила…</div>
      <template v-else>
        <input v-model="q" class="wp-q" placeholder="Найти страницу…" />
        <div class="wp-list">
          <section v-for="sec in tree" :key="sec.id" class="wp-sec" :class="{ on: sections.has(sec.id) }">
            <label class="wp-sh">
              <input type="checkbox" :checked="sections.has(sec.id)" @change="toggle(sections, sec.id)" />
              <b>{{ sec.name }}</b><small>весь раздел</small>
              <span class="grow" />
              <em v-if="!sections.has(sec.id) && picked(sec)">{{ picked(sec) }} стр.</em>
              <button v-if="!sections.has(sec.id)" type="button" class="wp-more" @click.prevent="openSec[sec.id] = !openSec[sec.id]">{{ openSec[sec.id] || q ? 'скрыть' : 'страницы' }} ▾</button>
            </label>
            <div v-if="!sections.has(sec.id) && (openSec[sec.id] || q)" class="wp-pages">
              <label v-for="p in filter(sec.pages)" :key="p.key" class="wp-p">
                <input type="checkbox" :checked="pages.has(p.key)" @change="toggle(pages, p.key)" />
                <span>{{ p.name }}<small v-if="p.sub">{{ p.sub }}</small></span>
              </label>
              <p v-if="!filter(sec.pages).length" class="wp-hint">Нет страниц.</p>
            </div>
          </section>
        </div>
      </template>
      <footer>
        <button type="button" class="mini no" :disabled="busy || (!sections.size && !pages.size)" @click="sections.clear(); pages.clear()">Снять все права</button>
        <span class="grow" />
        <button type="button" class="mini" @click="$emit('close')">Отмена</button>
        <button type="button" class="mini ok" :disabled="busy" @click="save">Сохранить</button>
      </footer>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { rulesState, loadRules, act } from '../map/store.js'
import { WIKI_SECTIONS } from '../shared/wikiPerms.js'

const props = defineProps({ player: { type: Object, required: true } })
const emit = defineEmits(['close'])
onMounted(() => loadRules())

const sections = reactive(new Set(props.player.wiki?.sections || []))
const pages = reactive(new Set(props.player.wiki?.pages || []))
const toggle = (set, k) => (set.has(k) ? set.delete(k) : set.add(k))
const openSec = reactive({})
const q = ref('')
const norm = s => String(s || '').toLowerCase().replace(/ё/g, 'е')
const filter = list => (q.value.trim() ? list.filter(p => norm(p.name).includes(norm(q.value.trim()))) : list)

// страницы каждого раздела: ключ — как в src/shared/wikiPerms.js («races:r-1a2b»)
const byOrder = (a, b) => (a.order || 0) - (b.order || 0)
const arts = g => rulesState.articles.filter(a => a.group === g).sort(byOrder).map(a => ({ key: 'articles:' + a.id, name: a.title, sub: 'статья' }))
const tree = computed(() => WIKI_SECTIONS.map(s => {
  let list = []
  if (s.id === 'races') list = [...rulesState.races.slice().sort(byOrder).map(r => ({ key: 'races:' + r.id, name: r.name })), ...arts('races')]
  else if (s.id === 'classes') list = [...rulesState.classes.slice().sort(byOrder).map(k => ({ key: 'classes:' + k.id, name: k.name })), ...arts('classes')]
  else if (s.id === 'magic') list = [...rulesState.schools.slice().sort(byOrder).map(x => ({ key: 'schools:' + x.id, name: x.name, sub: 'школа и её заклинания' })), ...arts('magic')]
  else if (s.id === 'effects') list = rulesState.effects.slice().sort(byOrder).map(e => ({ key: 'effects:' + e.id, name: e.name }))
  else list = arts(s.id)
  return { ...s, pages: list }
}))
const picked = sec => sec.pages.filter(p => pages.has(p.key)).length

const busy = ref(false)
async function save() {
  busy.value = true
  // страницы раздела, отмеченного целиком, не храним — они и так входят
  const full = new Set(sections)
  const keep = [...pages].filter(k => !tree.value.some(s => full.has(s.id) && s.pages.some(p => p.key === k)))
  try {
    await act('PATCH', `/api/players/${props.player.id}`, { wiki: { sections: [...sections], pages: keep } },
      sections.size || keep.length ? 'Права редактора вики сохранены' : 'Права редактора сняты')
    emit('close')
  } catch { /* act показывает ошибку */ } finally { busy.value = false }
}
</script>

<style scoped>
.wp-back { position: fixed; inset: 0; z-index: 400; display: grid; place-items: center; padding: 16px; background: rgba(5, 7, 11, .7); }
.wp { display: grid; grid-template-rows: auto auto auto minmax(0, 1fr) auto; gap: 10px; width: min(560px, 100%); max-height: min(720px, calc(100vh - 32px)); padding: 18px; border-radius: 18px; background: #141a24; border: 1px solid rgba(231, 197, 111, .3); box-shadow: 0 24px 60px rgba(0, 0, 0, .6); color: #efe3c8; }
header { display: flex; align-items: flex-start; gap: 10px; }
header > div { flex: 1; }
.wp-kick { color: #a8936c; font: 800 11px 'Manrope', sans-serif; letter-spacing: .12em; text-transform: uppercase; }
h3 { margin: 0; font: 700 26px 'Cormorant Garamond', serif; color: #f3dc9e; }
.wp-x { width: 32px; height: 32px; border-radius: 9px; border: 1px solid rgba(231, 197, 111, .25); background: none; color: #cdbf9f; cursor: pointer; }
.wp-hint { margin: 0; color: #a8936c; font: 600 12.5px/1.5 'Manrope', sans-serif; }
.wp-q { padding: 7px 11px; border-radius: 9px; border: 1px solid rgba(231, 197, 111, .22); background: rgba(0, 0, 0, .3); color: #efe3c8; font: 600 13px 'Manrope', sans-serif; }
.wp-list { display: grid; gap: 6px; align-content: start; overflow-y: auto; padding-right: 4px; }
.wp-sec { border-radius: 12px; border: 1px solid rgba(231, 197, 111, .14); background: rgba(255, 255, 255, .02); }
.wp-sec.on { border-color: rgba(126, 208, 122, .5); background: rgba(126, 208, 122, .06); }
.wp-sh { display: flex; align-items: center; gap: 8px; padding: 8px 10px; cursor: pointer; }
.wp-sh b { font: 700 14px 'Manrope', sans-serif; }
.wp-sh small { color: #a8936c; font: 600 11.5px 'Manrope', sans-serif; }
.wp-sh em { color: #b5ecb2; font: 800 11px 'Manrope', sans-serif; font-style: normal; }
.wp-more { padding: 2px 8px; border-radius: 8px; border: 1px solid rgba(231, 197, 111, .25); background: none; color: #f3d99a; font: 700 11.5px 'Manrope', sans-serif; cursor: pointer; }
.wp-pages { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 220px), 1fr)); gap: 2px; padding: 0 10px 10px 30px; }
.wp-p { display: flex; align-items: flex-start; gap: 6px; padding: 3px 0; font: 600 13px 'Manrope', sans-serif; cursor: pointer; }
.wp-p small { display: block; color: #a8936c; font-size: 11px; font-weight: 600; }
input[type=checkbox] { accent-color: #7ed07a; }
footer { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.grow { flex: 1; }
.mini { padding: 6px 12px; border-radius: 9px; border: 1px solid rgba(231, 197, 111, .35); background: rgba(231, 197, 111, .08); color: #f3d99a; font: 700 12.5px 'Manrope', sans-serif; cursor: pointer; }
.mini.ok { background: linear-gradient(180deg, #f0d083, #c9a24f); color: #1b1408; border-color: #c9a24f; }
.mini.no { border-color: rgba(255, 122, 107, .45); color: #ff9b8f; background: none; }
.mini:disabled { opacity: .5; cursor: default; }
</style>
