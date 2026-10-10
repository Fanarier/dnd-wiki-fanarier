<template>
  <!-- описание навыка в общем справочнике: одно на всех НПС, у кого этот навык -->
  <div class="nsd-back" @pointerdown.self="$emit('close')">
    <section class="nsd" role="dialog" aria-modal="true">
      <header>
        <div><small>{{ kind === 'active' ? 'Активный навык' : 'Пассивный навык' }} · справочник</small><b>{{ f.name }}</b></div>
        <button type="button" class="nsd-x" aria-label="Закрыть" @click="$emit('close')">×</button>
      </header>
      <div class="nsd-body">
        <p class="nsd-who">Есть у {{ users.length }} НПС: {{ users.slice(0, 8).join(', ') }}{{ users.length > 8 ? '…' : '' }}</p>
        <label>Название<input v-model.trim="f.name" maxlength="80" /></label>
        <label>Тип<input v-model.trim="f.type" maxlength="40" placeholder="Расовый, Классовый, Видовой…" /></label>
        <div v-if="kind === 'active'" class="nsd-row">
          <label>Перезарядка<input v-model.trim="f.cooldown" maxlength="80" placeholder="Перезарядка 2 хода" /></label>
          <label>Затраты<input v-model.trim="f.cost" maxlength="80" placeholder="Требует 30 Ярости" /></label>
        </div>
        <label>Описание<textarea v-model="f.desc" rows="7" maxlength="4000" placeholder="Что делает навык. Эффекты пиши в скобках: получает эффект (Рана)" /></label>
        <div v-if="f.desc" class="nsd-prev"><small>Как увидят игроки</small><FxText :text="f.desc" :effects="npcState.effects" /></div>
      </div>
      <footer>
        <button type="button" class="nsd-btn" @click="$emit('close')">Отмена</button>
        <button type="button" class="nsd-btn primary" :disabled="busy || !f.name" @click="save">Сохранить</button>
      </footer>
    </section>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import FxText from './FxText.vue'
import { act, npcState } from '../../map/store.js'
import { skillKey } from '../../shared/npc.js'

const props = defineProps({ kind: { type: String, required: true }, entry: { type: Object, required: true } })
const emit = defineEmits(['close'])
const existing = npcState.skills.find(s => skillKey(s.kind, s.name) === skillKey(props.kind, props.entry.name))
const f = reactive({ name: props.entry.name, type: existing?.type ?? props.entry.type ?? '', cooldown: existing?.cooldown ?? props.entry.cooldown ?? '', cost: existing?.cost ?? props.entry.cost ?? '', desc: existing?.desc ?? '' })
const users = computed(() => npcState.npcs.filter(n => (props.kind === 'active' ? n.actives : n.passives).some(s => skillKey(props.kind, s.name) === skillKey(props.kind, props.entry.name))).map(n => n.name))
const busy = ref(false)
async function save() {
  busy.value = true
  try {
    const body = { kind: props.kind, ...f }
    if (existing) await act('PATCH', `/api/npc-skills/${existing.id}`, body, 'Описание сохранено — у всех, у кого этот навык')
    else await act('POST', '/api/npc-skills', body, 'Навык добавлен в справочник')
    emit('close')
  } catch { /* тост */ } finally { busy.value = false }
}
</script>

<style scoped>
.nsd-back { position: fixed; inset: 0; z-index: 350; display: grid; place-items: center; padding: 16px; background: rgba(5, 6, 10, .7); backdrop-filter: blur(3px); }
.nsd { width: min(560px, 100%); max-height: calc(100vh - 32px); overflow: auto; border-radius: 16px; background: #17130e; border: 1px solid #8a6630; box-shadow: 0 24px 60px rgba(0, 0, 0, .6); color: #efe3c8; font: 13px 'Manrope', sans-serif; }
.nsd header, .nsd footer { display: flex; align-items: center; gap: 8px; padding: 12px 16px; }
.nsd header { justify-content: space-between; border-bottom: 1px solid rgba(201, 162, 79, .2); }
.nsd header small { display: block; color: #a8936c; font-weight: 800; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; }
.nsd header b { font: 700 20px 'Cormorant Garamond', serif; color: #f3d99a; }
.nsd-x { border: 0; background: none; color: #a8936c; font-size: 22px; cursor: pointer; }
.nsd-body { display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; padding: 14px 16px; }
.nsd-who { margin: 0; color: #a8936c; font-size: 12.5px; }
.nsd-body label { display: grid; gap: 4px; color: #a8936c; font-weight: 700; font-size: 12px; }
.nsd-body input, .nsd-body textarea { width: 100%; box-sizing: border-box; padding: 8px 10px; border-radius: 9px; border: 1px solid rgba(231, 197, 111, .25); background: #0f0c08; color: #efe3c8; font: 500 13.5px/1.5 'Manrope', sans-serif; }
.nsd-body textarea { resize: vertical; }
.nsd-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.nsd-prev { padding: 10px 12px; border-radius: 10px; background: rgba(255, 255, 255, .03); border: 1px dashed rgba(231, 197, 111, .2); font-size: 13px; line-height: 1.55; }
.nsd-prev small { display: block; margin-bottom: 4px; color: #a8936c; font-weight: 800; font-size: 11px; }
.nsd footer { justify-content: flex-end; border-top: 1px solid rgba(201, 162, 79, .2); }
.nsd-btn { padding: 7px 14px; border-radius: 9px; border: 1px solid rgba(201, 162, 79, .45); background: rgba(231, 197, 111, .08); color: #f3d99a; font: 700 13px 'Manrope', sans-serif; cursor: pointer; }
.nsd-btn.primary { background: linear-gradient(180deg, #f0cf83, #c99a45); color: #1b140c; border-color: #e6c27a; }
.nsd-btn:disabled { opacity: .5; }
@media (max-width: 520px) { .nsd-row { grid-template-columns: 1fr; } }
</style>
