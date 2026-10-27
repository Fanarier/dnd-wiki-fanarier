<template>
  <!-- герой в слоте группы / лагеря / компаньонов: портрет, имя, уровень, выносливость; мастеру — куда переставить -->
  <div class="pc" :class="{ small, unknown: hero.unknown, [hero.tab]: true }">
    <component :is="hero.unknown ? 'div' : 'router-link'" :to="hero.unknown ? undefined : hero.to" class="pc-link" draggable="false">
      <span class="pc-pic">
        <img v-if="hero.pic" :src="hero.pic" alt="" draggable="false" />
        <template v-else>{{ hero.unknown ? '?' : hero.name[0] }}</template>
      </span>
      <b class="pc-name">{{ hero.unknown ? 'Неизвестный' : hero.name }}</b>
      <small v-if="!hero.unknown" class="pc-sub">{{ hero.level ? 'ур. ' + hero.level : '' }}<template v-if="hero.tab !== 'character'">{{ hero.level ? ' · ' : '' }}{{ hero.label }}</template></small>
      <!-- из листа: хиты, выносливость, изнурение (5 — эффект «Сон») -->
      <span v-if="!hero.unknown && (hero.hpMax || hero.staminaMax)" class="pc-bars">
        <i v-if="hero.hpMax" class="pc-bar hp" :class="{ low: hero.hp / hero.hpMax <= .3 }" :title="`Хиты ${hero.hp} / ${hero.hpMax}`"><i :style="{ width: pct(hero.hp, hero.hpMax) }" /></i>
        <i v-if="hero.staminaMax" class="pc-bar st" :title="`Выносливость ${hero.stamina} / ${hero.staminaMax}`"><i :style="{ width: pct(hero.stamina, hero.staminaMax) }" /></i>
      </span>
      <span v-if="hero.exh" class="pc-exh" :class="{ sleep: hero.exh >= 5 }" :title="hero.exh >= 5 ? 'Изнурение 5 из 5 — эффект «Сон»' : `Изнурение ${hero.exh} из 5`">
        <template v-if="hero.exh >= 5">😴 Сон</template><template v-else>😵<b v-for="n in 5" :key="n" :class="{ on: n <= hero.exh }" /></template>
      </span>
    </component>
    <div v-if="master" class="pc-act">
      <button v-for="m in moves" :key="m" type="button" :title="TITLE[m]" @click.stop="$emit('move', m)">{{ ICON[m] }}</button>
      <button type="button" title="Убрать" class="x" @click.stop="$emit('remove')">✕</button>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({ hero: { type: Object, required: true }, master: Boolean, small: Boolean, moves: { type: Array, default: () => [] } })
defineEmits(['move', 'remove'])
const ICON = { slots: '⚔', camp: '⛺', companions: '🐾' }
const TITLE = { slots: 'В группу', camp: 'В лагерь', companions: 'В компаньоны' }
const pct = (v, max) => Math.max(0, Math.min(100, ((Number(v) || 0) / max) * 100)) + '%'
</script>

<style scoped>
.pc { position: relative; min-height: 150px; border-radius: 14px; background: linear-gradient(170deg, #2c2116, #15100a); border: 1px solid rgba(231, 197, 111, .3); box-shadow: 0 8px 18px rgba(0, 0, 0, .35); transition: transform .2s, box-shadow .2s, border-color .2s; }
.pc.small { min-height: 118px; }
.pc:hover { transform: translateY(-3px); border-color: rgba(255, 190, 100, .7); box-shadow: 0 12px 24px rgba(0, 0, 0, .45), 0 0 18px rgba(255, 150, 60, .2); }
.pc.sidekick { border-color: rgba(159, 198, 255, .4); }
.pc.companion { border-color: rgba(126, 208, 122, .4); }
.pc.personal { border-color: rgba(201, 184, 255, .45); }
.pc.unknown { opacity: .6; }
.pc-link { display: grid; justify-items: center; gap: 3px; height: 100%; padding: 12px 8px 10px; color: inherit; text-decoration: none; text-align: center; }
.pc-pic { display: grid; place-items: center; width: 74px; height: 74px; border-radius: 50%; overflow: hidden; border: 2px solid #c9a24f; background: #0f0b07; color: #f3dc9e; font: 700 30px 'Cormorant Garamond', serif; box-shadow: 0 0 14px rgba(255, 160, 60, .25); }
.small .pc-pic { width: 54px; height: 54px; font-size: 22px; }
.pc-pic img { width: 100%; height: 100%; object-fit: cover; }
.pc-name { color: #f3dc9e; font: 700 16px 'Cormorant Garamond', serif; line-height: 1.1; overflow-wrap: anywhere; }
.small .pc-name { font-size: 14px; }
.pc-sub { color: #a8936c; font: 700 11px 'Manrope', sans-serif; }
.pc-bars { display: grid; gap: 3px; width: 70%; }
.pc-bar { display: block; height: 4px; border-radius: 4px; background: rgba(255, 255, 255, .1); overflow: hidden; }
.pc-bar i { display: block; height: 100%; transition: width .6s cubic-bezier(.2, .8, .3, 1); }
.pc-bar.hp i { background: linear-gradient(90deg, #d8433a, #ff8a6b); }
.pc-bar.hp.low i { animation: pc-low 1.4s ease-in-out infinite; }
.pc-bar.st i { background: linear-gradient(90deg, #7ed07a, #c6f08a); }
@keyframes pc-low { 50% { filter: brightness(1.6); } }
.pc-exh { display: flex; align-items: center; gap: 2px; color: #ffb3aa; font: 800 10.5px 'Manrope', sans-serif; }
.pc-exh b { width: 6px; height: 6px; border-radius: 50%; background: rgba(255, 255, 255, .12); }
.pc-exh b.on { background: #ff7a6b; box-shadow: 0 0 4px rgba(255, 122, 107, .7); }
.pc-exh.sleep { padding: 1px 7px; border-radius: 99px; background: rgba(155, 125, 255, .2); color: #d2c4ff; box-shadow: 0 0 10px rgba(155, 125, 255, .35); }
@media (prefers-reduced-motion: reduce) { .pc-bar.hp.low i { animation: none; } }
.pc-act { position: absolute; top: 4px; right: 4px; display: flex; gap: 2px; opacity: 0; transition: opacity .15s; }
.pc:hover .pc-act, .pc:focus-within .pc-act { opacity: 1; }
.pc-act button { width: 24px; height: 24px; border-radius: 7px; border: 1px solid rgba(231, 197, 111, .35); background: rgba(15, 11, 7, .9); color: #f3dc9e; font-size: 12px; cursor: pointer; padding: 0; }
.pc-act button.x { color: #ff8f7f; }
@media (hover: none) { .pc-act { opacity: 1; } }
</style>
