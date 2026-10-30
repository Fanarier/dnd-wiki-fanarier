<template>
  <!-- карточка уникального предмета (лист и вики «Предметы»): шапка с картинкой и редкостью, типы, характеристики
       (кубы в них — кнопки броска), компоненты, требования, пассивные и активные эффекты -->
  <article class="itc" :class="{ compact }" :style="rar ? { '--rc': rar.color, '--rb': rar.bg } : null">
    <header class="itc-h">
      <span class="itc-img">
        <img v-if="img" :src="img" alt="" />
        <span v-else>{{ icon }}</span>
      </span>
      <div class="itc-t">
        <b class="itc-name">{{ name || 'Без названия' }}</b>
        <span class="itc-sub">
          <em v-if="rarity" class="itc-rar">{{ rarity }}</em>
          <span v-if="typeLine">{{ typeLine }}</span>
        </span>
        <span v-if="card?.Attune || card?.Origin" class="itc-meta">
          <span v-if="card.Attune">🔗 Настройка: <b>{{ card.Attune }}</b></span>
          <span v-if="card.Origin">⚒ {{ card.Origin }}</span>
        </span>
      </div>
      <slot name="badge" />
    </header>

    <div v-if="card?.Chars?.length" class="itc-chars">
      <template v-for="(c, i) in card.Chars" :key="i">
        <span v-if="c.V" class="itc-kv"><small>{{ c.K }}</small><b><DiceText :text="c.V" :label="`${name}: ${c.K}`" /></b></span>
        <span v-else class="itc-flag">{{ c.K }}</span>
      </template>
    </div>

    <div v-if="lists.length" class="itc-lists">
      <section v-for="l in lists" :key="l.k" class="itc-list" :class="l.k">
        <h4>{{ l.icon }} {{ l.name }}</h4>
        <ul><li v-for="(x, i) in card[l.k]" :key="i"><DiceText :text="x" :label="name" /></li></ul>
      </section>
    </div>

    <div v-if="html && !compact" class="itc-desc"><DiceText :text="html" :label="name" /></div>
    <slot />
  </article>
</template>

<script setup>
import { computed } from 'vue'
import DiceText from '../../sheets/ui/DiceText.vue'
import { rarityOf } from '../../shared/sheet.js'
import { CARD_LISTS } from '../../shared/items.js'

const props = defineProps({
  name: { type: String, default: '' }, rarity: { type: String, default: '' }, img: { type: String, default: '' },
  html: { type: String, default: '' }, card: { type: Object, default: null }, icon: { type: String, default: '✦' }, compact: Boolean
})
const rar = computed(() => rarityOf(props.rarity))
const typeLine = computed(() => {
  const c = props.card
  if (!c) return ''
  const types = [c.Type1, c.Type2].filter(Boolean).join(' · ')
  return [types, c.Kind].filter(Boolean).join(' — ')
})
// пустые списки и «Нет» не показываем
const lists = computed(() => CARD_LISTS.filter(l => (props.card?.[l.k] || []).some(x => x && !/^нет$/i.test(String(x).trim()))))
</script>

<style scoped>
.itc { --rc: #c9a24f; --rb: #4a3a1a; display: grid; gap: 10px; padding: 12px; border-radius: 14px; color: #efe3c8;
  background: radial-gradient(120% 80% at 0 0, color-mix(in srgb, var(--rc) 14%, transparent), transparent 60%), linear-gradient(180deg, rgba(34, 27, 19, .92), rgba(20, 16, 11, .92));
  border: 1px solid color-mix(in srgb, var(--rc) 45%, transparent); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .03), 0 8px 24px rgba(0, 0, 0, .35); min-width: 0; }
.itc-h { display: flex; gap: 12px; align-items: center; min-width: 0; }
.itc-img { flex: none; display: grid; place-items: center; width: 64px; height: 64px; border-radius: 12px; font-size: 28px; color: var(--rc);
  background: radial-gradient(circle, color-mix(in srgb, var(--rc) 28%, transparent), rgba(0, 0, 0, .45) 72%); border: 1.5px solid color-mix(in srgb, var(--rc) 65%, transparent); box-shadow: 0 0 16px color-mix(in srgb, var(--rc) 30%, transparent); overflow: hidden; }
.itc-img img { width: 100%; height: 100%; object-fit: contain; }
.itc-t { display: grid; gap: 3px; min-width: 0; flex: 1; }
.itc-name { font: 700 21px/1.1 'Cormorant Garamond', serif; color: color-mix(in srgb, var(--rc) 55%, #fff3d6); text-shadow: 0 0 14px color-mix(in srgb, var(--rc) 35%, transparent); overflow-wrap: anywhere; }
.itc-sub { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font: 600 12.5px 'Manrope', sans-serif; color: #c8b48c; }
.itc-rar { font: 800 10.5px 'Manrope', sans-serif; font-style: normal; letter-spacing: .07em; text-transform: uppercase; padding: 2px 8px; border-radius: 99px; color: var(--rc); background: color-mix(in srgb, var(--rc) 14%, transparent); border: 1px solid color-mix(in srgb, var(--rc) 50%, transparent); }
.itc-meta { display: flex; flex-wrap: wrap; gap: 10px; font: 600 12px 'Manrope', sans-serif; color: #a8936c; }
.itc-meta b { color: #e6d3ad; }
.itc-chars { display: flex; flex-wrap: wrap; gap: 6px; }
.itc-kv { display: grid; gap: 1px; padding: 5px 10px; border-radius: 10px; background: rgba(0, 0, 0, .28); border: 1px solid color-mix(in srgb, var(--rc) 25%, transparent); }
.itc-kv small { font: 700 9.5px 'Manrope', sans-serif; letter-spacing: .07em; text-transform: uppercase; color: #a8936c; }
.itc-kv b { font: 700 14px 'Manrope', sans-serif; color: #f3e6c8; }
.itc-flag { align-self: center; padding: 4px 10px; border-radius: 99px; font: 700 12px 'Manrope', sans-serif; color: color-mix(in srgb, var(--rc) 50%, #e6d3ad); background: color-mix(in srgb, var(--rc) 10%, transparent); border: 1px dashed color-mix(in srgb, var(--rc) 40%, transparent); }
.itc-lists { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(180px, 100%), 1fr)); gap: 8px; }
.itc-list { padding: 8px 10px; border-radius: 10px; background: rgba(0, 0, 0, .22); min-width: 0; }
.itc-list h4 { margin: 0 0 4px; font: 800 10.5px 'Manrope', sans-serif; letter-spacing: .08em; text-transform: uppercase; color: #a8936c; }
.itc-list.Active h4 { color: color-mix(in srgb, var(--rc) 60%, #e6c27a); }
.itc-list ul { margin: 0; padding-left: 16px; display: grid; gap: 2px; font: 600 13px/1.4 'Manrope', sans-serif; }
.itc-desc { font: 500 13.5px/1.55 'Manrope', sans-serif; color: #e2d4b6; }
.itc.compact { padding: 10px; gap: 8px; }
.itc.compact .itc-img { width: 48px; height: 48px; font-size: 22px; }
.itc.compact .itc-name { font-size: 18px; }
</style>
