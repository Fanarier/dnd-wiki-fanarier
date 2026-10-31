<template>
  <!-- карточка уникального предмета (лист и вики «Предметы»): большая картинка (щелчок — на весь экран), шапка с редкостью,
       типы, характеристики (кубы в них — кнопки броска), компоненты, требования, пассивные и активные эффекты.
       Пункты с примечанием (в таблице — комментарий к ячейке) раскрываются щелчком; отметки — цветом, как заливка в таблице -->
  <article class="itc" :class="{ compact }" :style="rar ? { '--rc': rar.color, '--rb': rar.bg } : null">
    <div class="itc-in" :class="{ art: showArt }">
      <button v-if="showArt" type="button" class="itc-art" title="Открыть картинку" @click="view = true">
        <img :src="img" alt="" loading="lazy" />
        <span class="itc-zoom">⤢</span>
      </button>
      <div class="itc-body">
        <header class="itc-h">
          <component :is="img ? 'button' : 'span'" v-if="!showArt" :type="img ? 'button' : null" class="itc-img" :class="{ zoom: img }" :title="img ? 'Открыть картинку' : null" @click="img && (view = true)">
            <img v-if="img" :src="img" alt="" />
            <span v-else>{{ icon }}</span>
          </component>
          <div class="itc-t">
            <b class="itc-name">{{ name || 'Без названия' }}</b>
            <span class="itc-sub">
              <em v-if="rarity" class="itc-rar">{{ rarity }}</em>
              <span v-if="typeLine">{{ typeLine }}</span>
            </span>
            <span v-if="card?.Attune || card?.Origin" class="itc-meta">
              <span v-if="card.Attune" class="itc-att" :style="{ '--ac': attuneColor(card.Attune) }">🔗 Настройка: <b>{{ card.Attune }}</b></span>
              <span v-if="card.Origin">⚒ {{ card.Origin }}</span>
            </span>
          </div>
          <slot name="badge" />
        </header>

        <p v-if="card?.Note" class="itc-note">✎ <DiceText :text="card.Note" :label="name" /></p>

        <div v-if="card?.Chars?.length" class="itc-chars">
          <template v-for="(c, i) in card.Chars" :key="i">
            <component :is="c.N ? 'button' : 'span'" :type="c.N ? 'button' : null" :class="[c.V ? 'itc-kv' : 'itc-flag', c.M && 'm-' + c.M, { has: c.N, on: openChar === i }]"
                       :title="c.N || null" @click="c.N && (openChar = openChar === i ? -1 : i)">
              <template v-if="c.V"><small>{{ c.K }}<i v-if="c.N">•</i></small><b><DiceText :text="c.V" :label="`${name}: ${c.K}`" /></b></template>
              <template v-else>{{ c.K }}<i v-if="c.N">•</i></template>
            </component>
          </template>
        </div>
        <p v-if="card?.Chars?.[openChar]?.N" class="itc-cnote"><b>{{ card.Chars[openChar].K }}</b> <DiceText :text="card.Chars[openChar].N" :label="`${name}: ${card.Chars[openChar].K}`" /></p>

        <div v-if="lists.length" class="itc-lists">
          <section v-for="l in lists" :key="l.k" class="itc-list" :class="l.k">
            <h4>{{ l.icon }} {{ l.name }}</h4>
            <ul>
              <li v-for="(e, i) in l.items" :key="i" :class="[e.M && 'm-' + e.M, { has: e.N, on: open[l.k + i] }]" :title="e.M ? markOf(e.M).name : null">
                <!-- span, а не button: кнопка — блок целиком, и маркер пункта съезжал на последнюю строку -->
                <span class="itc-li" :class="{ btn: e.N }" :role="e.N ? 'button' : null" :tabindex="e.N ? 0 : null" :aria-expanded="e.N ? !!open[l.k + i] : null"
                      @click="e.N && (open[l.k + i] = !open[l.k + i])" @keydown.enter.prevent="e.N && (open[l.k + i] = !open[l.k + i])">
                  <DiceText :text="e.T" :label="name" /><i v-if="e.N" class="itc-more" :title="open[l.k + i] ? 'Свернуть' : 'Подробнее'">{{ open[l.k + i] ? '▴' : '▾' }}</i>
                </span>
                <div v-if="e.N && open[l.k + i]" class="itc-lnote"><DiceText :text="e.N" :label="`${name}: ${e.T}`" /></div>
              </li>
            </ul>
          </section>
        </div>

        <div v-if="html && !compact" class="itc-desc"><DiceText :text="html" :label="name" /></div>
        <slot />
      </div>
    </div>
    <HeroGalleryViewer :z="2000" v-if="view" :arts="[{ id: 'img', file: img }]" :name="name" :url="f => f" @close="view = false" />
  </article>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import DiceText from '../../sheets/ui/DiceText.vue'
import HeroGalleryViewer from '../../wiki/HeroGalleryViewer.vue'
import { rarityOf } from '../../shared/sheet.js'
import { CARD_LISTS, liOf, markOf, attuneColor } from '../../shared/items.js'

const props = defineProps({
  name: { type: String, default: '' }, rarity: { type: String, default: '' }, img: { type: String, default: '' },
  html: { type: String, default: '' }, card: { type: Object, default: null }, icon: { type: String, default: '✦' }, compact: Boolean
})
const rar = computed(() => rarityOf(props.rarity))
const showArt = computed(() => !!props.img && !props.compact)
const view = ref(false)
const open = reactive({})
const openChar = ref(-1)
const typeLine = computed(() => {
  const c = props.card
  if (!c) return ''
  const types = [c.Type1, c.Type2].filter(Boolean).join(' · ')
  return [types, c.Kind].filter(Boolean).join(' — ')
})
// пустые списки и «Нет» не показываем
const lists = computed(() => CARD_LISTS.map(l => ({ ...l, items: (props.card?.[l.k] || []).map(liOf).filter(e => e.T && !/^нет$/i.test(e.T.trim())) })).filter(l => l.items.length))
</script>

<style scoped>
.itc { --rc: #c9a24f; --rb: #4a3a1a; container-type: inline-size; padding: 12px; border-radius: 14px; color: #efe3c8;
  background: radial-gradient(120% 80% at 0 0, color-mix(in srgb, var(--rc) 14%, transparent), transparent 60%), linear-gradient(180deg, rgba(34, 27, 19, .92), rgba(20, 16, 11, .92));
  border: 1px solid color-mix(in srgb, var(--rc) 45%, transparent); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .03), 0 8px 24px rgba(0, 0, 0, .35); min-width: 0; }
.itc-in { display: grid; gap: 12px; min-width: 0; }
.itc-body { display: grid; gap: 10px; align-content: start; min-width: 0; }
/* большая картинка: на широкой карточке — колонкой слева, на узкой — сверху */
.itc-art { position: relative; display: block; width: 100%; height: 240px; padding: 0; border-radius: 12px; overflow: hidden; cursor: zoom-in;
  border: 1.5px solid color-mix(in srgb, var(--rc) 55%, transparent); background: radial-gradient(circle at 50% 40%, color-mix(in srgb, var(--rc) 22%, #1a140d), #0d0a07 75%);
  box-shadow: 0 0 18px color-mix(in srgb, var(--rc) 22%, transparent), inset 0 0 30px rgba(0, 0, 0, .5); }
.itc-art img { width: 100%; height: 100%; object-fit: contain; transition: transform .4s; }
.itc-art:hover img { transform: scale(1.03); }
.itc-zoom { position: absolute; right: 6px; bottom: 6px; display: grid; place-items: center; width: 26px; height: 26px; border-radius: 8px; background: rgba(0, 0, 0, .55); color: #f3e6c8; font-size: 15px; opacity: .8; }
@container (min-width: 560px) {
  .itc-in.art { grid-template-columns: minmax(170px, 34%) minmax(0, 1fr); }
  .itc-art { height: auto; min-height: 260px; max-height: 520px; }
}
.itc-h { display: flex; gap: 12px; align-items: center; min-width: 0; }
.itc-img { flex: none; display: grid; place-items: center; width: 64px; height: 64px; padding: 0; border-radius: 12px; font-size: 28px; color: var(--rc);
  background: radial-gradient(circle, color-mix(in srgb, var(--rc) 28%, transparent), rgba(0, 0, 0, .45) 72%); border: 1.5px solid color-mix(in srgb, var(--rc) 65%, transparent); box-shadow: 0 0 16px color-mix(in srgb, var(--rc) 30%, transparent); overflow: hidden; }
.itc-img.zoom { cursor: zoom-in; }
.itc-img img { width: 100%; height: 100%; object-fit: contain; }
.itc-t { display: grid; gap: 3px; min-width: 0; flex: 1; }
.itc-name { font: 700 23px/1.1 'Cormorant Garamond', serif; color: color-mix(in srgb, var(--rc) 55%, #fff3d6); text-shadow: 0 0 14px color-mix(in srgb, var(--rc) 35%, transparent); overflow-wrap: anywhere; }
.itc-sub { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font: 600 13px 'Manrope', sans-serif; color: #c8b48c; }
.itc-rar { font: 800 10.5px 'Manrope', sans-serif; font-style: normal; letter-spacing: .07em; text-transform: uppercase; padding: 2px 8px; border-radius: 99px; color: var(--rc); background: color-mix(in srgb, var(--rc) 14%, transparent); border: 1px solid color-mix(in srgb, var(--rc) 50%, transparent); }
.itc-meta { display: flex; flex-wrap: wrap; gap: 10px; font: 600 12.5px 'Manrope', sans-serif; color: #a8936c; }
.itc-meta b { color: #e6d3ad; }
.itc-att b { color: var(--ac); }
.itc-note { margin: 0; padding: 7px 10px; border-radius: 10px; background: rgba(0, 0, 0, .22); border-left: 3px solid color-mix(in srgb, var(--rc) 60%, transparent); font: italic 600 13px/1.45 'Manrope', sans-serif; color: #e6d3ad; }
.itc-chars { display: flex; flex-wrap: wrap; gap: 6px; }
.itc-kv { display: grid; gap: 1px; padding: 5px 10px; border-radius: 10px; background: rgba(0, 0, 0, .28); border: 1px solid color-mix(in srgb, var(--rc) 25%, transparent); text-align: left; color: inherit; }
.itc-kv small { font: 700 9.5px 'Manrope', sans-serif; letter-spacing: .07em; text-transform: uppercase; color: #a8936c; }
.itc-kv b { font: 700 15px 'Manrope', sans-serif; color: #f3e6c8; }
.itc-flag { align-self: center; padding: 4px 10px; border-radius: 99px; font: 700 12.5px 'Manrope', sans-serif; color: color-mix(in srgb, var(--rc) 50%, #e6d3ad); background: color-mix(in srgb, var(--rc) 10%, transparent); border: 1px dashed color-mix(in srgb, var(--rc) 40%, transparent); }
.itc-chars i { font-style: normal; margin-left: 3px; color: var(--rc); }
.itc-chars .has { cursor: pointer; }
.itc-chars .has:hover, .itc-chars .on { border-color: color-mix(in srgb, var(--rc) 75%, transparent); background: color-mix(in srgb, var(--rc) 14%, rgba(0, 0, 0, .3)); }
.itc-cnote, .itc-lnote { margin: 0; padding: 7px 10px; border-radius: 9px; background: rgba(0, 0, 0, .3); border: 1px solid color-mix(in srgb, var(--rc) 25%, transparent); font: 500 12.5px/1.5 'Manrope', sans-serif; color: #e2d4b6; }
.itc-cnote b { color: color-mix(in srgb, var(--rc) 60%, #fff3d6); margin-right: 4px; }
.itc-lnote { margin: 4px 0 2px; }
.itc-lists { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr)); gap: 8px; }
.itc-list { padding: 9px 11px; border-radius: 10px; background: rgba(0, 0, 0, .22); min-width: 0; }
.itc-list h4 { margin: 0 0 5px; font: 800 10.5px 'Manrope', sans-serif; letter-spacing: .08em; text-transform: uppercase; color: #a8936c; }
.itc-list.Active h4 { color: color-mix(in srgb, var(--rc) 60%, #e6c27a); }
.itc-list ul { margin: 0; padding-left: 16px; display: grid; gap: 3px; font: 600 13.5px/1.45 'Manrope', sans-serif; }
.itc-li.btn { cursor: pointer; text-decoration: underline dotted color-mix(in srgb, var(--rc) 55%, transparent); text-underline-offset: 3px; }
.itc-li.btn:hover { color: #fff3d6; }
.itc-more { font-style: normal; margin-left: 5px; font-size: 10px; color: var(--rc); }
/* отметки — как заливка ячейки в таблице */
.itc-list li[class*='m-'] { margin-left: -6px; padding: 1px 6px; border-radius: 6px; }
.itc-list li[class*='m-']::marker { color: var(--mc); }
.m-green { --mc: #5cc77a; } .m-yellow { --mc: #f0c040; } .m-red { --mc: #e8574a; } .m-blue { --mc: #5b9cf0; } .m-gone { --mc: #cc3a2e; }
.itc-list li[class*='m-'], .itc-chars [class*='m-'] { background: color-mix(in srgb, var(--mc) 18%, transparent); box-shadow: inset 3px 0 0 var(--mc); }
.itc-list li.m-gone .itc-li, .itc-chars .m-gone { text-decoration: line-through; text-decoration-color: var(--mc); color: color-mix(in srgb, var(--mc) 60%, #e6d3ad); }
.itc-desc { font: 500 13.5px/1.55 'Manrope', sans-serif; color: #e2d4b6; }
.itc.compact { padding: 10px; }
.itc.compact .itc-in, .itc.compact .itc-body { gap: 8px; }
.itc.compact .itc-img { width: 52px; height: 52px; font-size: 22px; }
.itc.compact .itc-name { font-size: 19px; }
</style>
