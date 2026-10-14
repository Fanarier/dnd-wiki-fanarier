<template>
  <!-- уголок страницы: потяни мышкой или пальцем — страница загибается по линии сгиба, как настоящая;
       отпустишь далеко — перевернётся, недалеко — вернётся. При наведении уголок чуть приподнимается. -->
  <div v-if="enabled" ref="root" class="pcn" :style="box" aria-hidden="true">
    <div class="pcn-under" :style="{ clipPath: cutClip, background: underBg }" />
    <div class="pcn-flapwrap"><div class="pcn-flap" :style="{ clipPath: flapClip, background: flapBg }" /></div>
    <div class="pcn-hit" title="Потяни за уголок — перелистнуть" @pointerenter="enter" @pointerleave="leave" @pointerdown="down" />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import gsap from 'gsap'

const props = defineProps({
  page: { type: Object, default: null }, // элемент страницы (правой)
  book: { type: Object, default: null }, // книга — относительно неё ставим уголок
  scroll: { type: Object, default: null }, // содержимое страницы — его «отрезаем» по сгибу
  enabled: { type: Boolean, default: true }
})
const emit = defineEmits(['turn'])
const root = ref(null)
const rect = reactive({ x: 0, y: 0, w: 0, h: 0 })
const P = reactive({ x: 0, y: 0 }) // где сейчас кончик загнутого угла (в координатах страницы)
let tw = null, dragging = false, hovering = false
const DOG = 26 // в покое уголок чуть загнут — видно, за что тянуть

function measure() {
  if (!props.page || !props.book) return
  const r = props.page.getBoundingClientRect(), b = props.book.getBoundingClientRect()
  Object.assign(rect, { x: r.left - b.left, y: r.top - b.top, w: r.width, h: r.height })
  if (!dragging && !tw?.isActive()) { P.x = rect.w - DOG; P.y = rect.h - DOG }
}
const box = computed(() => ({ left: rect.x + 'px', top: rect.y + 'px', width: rect.w + 'px', height: rect.h + 'px' }))

/* ---------- геометрия сгиба ---------- */
// линия сгиба — серединный перпендикуляр между углом страницы C и кончиком P
const geo = computed(() => {
  const W = rect.w, H = rect.h, dx = P.x - W, dy = P.y - H
  const len = Math.hypot(dx, dy)
  if (!W || len < 0.5) return null
  const mx = (P.x + W) / 2, my = (P.y + H) / 2
  const side = q => (q.x - mx) * dx + (q.y - my) * dy // < 0 — сторона угла (отгибается)
  const clip = (poly, keep) => {
    const out = []
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length], sa = side(a), sb = side(b)
      if (keep(sa)) out.push(a)
      if (keep(sa) !== keep(sb)) { const t = sa / (sa - sb); out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }) }
    }
    return out
  }
  const rectPoly = [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }]
  const keep = clip(rectPoly, s => s >= 0)
  const cut = clip(rectPoly, s => s < 0)
  const nx = dx / len, ny = dy / len
  const reflect = q => { const k = 2 * ((q.x - mx) * nx + (q.y - my) * ny); return { x: q.x - k * nx, y: q.y - k * ny } }
  return { keep, cut, flap: cut.map(reflect), ang: (Math.atan2(dx, -dy) * 180) / Math.PI, len }
})
const poly = pts => (pts?.length > 2 ? `polygon(${pts.map(p => `${p.x.toFixed(1)}px ${p.y.toFixed(1)}px`).join(',')})` : 'polygon(0 0)')
const cutClip = computed(() => poly(geo.value?.cut))
const flapClip = computed(() => poly(geo.value?.flap))
// изнанка страницы: от сгиба (тень) к кончику (светлее); под ней — следующий лист с тенью у сгиба
const flapBg = computed(() => {
  const a = geo.value?.ang ?? 0
  return `linear-gradient(${a}deg, rgba(0,0,0,.12), rgba(255,236,200,.16) 18%, rgba(255,240,210,.22) 60%, rgba(255,240,210,.08)), linear-gradient(180deg, color-mix(in srgb, var(--paper2) 72%, #d9c49a), color-mix(in srgb, var(--paper) 80%, #b9a47a))`
})
const underBg = computed(() => {
  const a = (geo.value?.ang ?? 0) + 180
  return `linear-gradient(${a}deg, rgba(0,0,0,.55), rgba(0,0,0,.08) 30%, transparent 60%), linear-gradient(180deg, var(--paper2), var(--paper))`
})
// содержимое страницы обрезаем по сгибу
watch(() => [geo.value, props.scroll], () => {
  const el = props.scroll
  if (!el) return
  el.style.clipPath = geo.value ? poly(geo.value.keep) : ''
})

/* ---------- движение ---------- */
const animTo = (x, y, opts = {}) => { tw?.kill(); tw = gsap.to(P, { x, y, duration: 0.35, ease: 'power2.out', ...opts }) }
const rest = () => animTo(rect.w - DOG, rect.h - DOG, { duration: 0.6, ease: 'elastic.out(1, 0.5)' })
// бумага не растягивается: кончик не дальше ширины страницы от низа корешка
function constrain(x, y) {
  const bx = 0, by = rect.h, d = Math.hypot(x - bx, y - by), W = rect.w
  if (d > W) { x = bx + ((x - bx) / d) * W; y = by + ((y - by) / d) * W }
  return { x: Math.min(rect.w, x), y: Math.min(rect.h, y) }
}
function enter(e) {
  if (e.pointerType !== 'mouse' || dragging) return
  hovering = true
  measure()
  animTo(rect.w - 38, rect.h - 30, { duration: 0.4, ease: 'back.out(2)' })
}
function leave() {
  hovering = false
  if (!dragging) rest()
}
function down(e) {
  e.preventDefault()
  e.stopPropagation()
  measure()
  dragging = true
  tw?.kill()
  addEventListener('pointermove', move)
  addEventListener('pointerup', up)
  addEventListener('pointercancel', up)
  move(e)
}
function move(e) {
  if (!dragging) return
  const r = props.page.getBoundingClientRect()
  const q = constrain(e.clientX - r.left, e.clientY - r.top)
  // мягко догоняет палец — бумага «тянется» за рукой
  tw?.kill()
  tw = gsap.to(P, { x: q.x, y: q.y, duration: 0.12, ease: 'power1.out' })
}
function up() {
  dragging = false
  removeEventListener('pointermove', move)
  removeEventListener('pointerup', up)
  removeEventListener('pointercancel', up)
  // протащили дальше трети страницы — переворачиваем до конца
  if (P.x < rect.w * 0.62) {
    animTo(-rect.w, rect.h, {
      duration: 0.45, ease: 'power2.in',
      onComplete: () => { P.x = rect.w - DOG; P.y = rect.h - DOG; emit('turn') }
    })
  } else if (hovering) animTo(rect.w - 38, rect.h - 30, { duration: 0.5, ease: 'elastic.out(1, 0.5)' })
  else rest()
}

let ro = null
onMounted(() => {
  measure()
  ro = new ResizeObserver(measure)
  if (props.page) ro.observe(props.page)
  addEventListener('resize', measure)
})
watch(() => props.page, (p, o) => { if (o) ro?.unobserve(o); if (p) { ro?.observe(p); measure() } })
onBeforeUnmount(() => {
  tw?.kill()
  ro?.disconnect()
  removeEventListener('resize', measure)
  removeEventListener('pointermove', move)
  removeEventListener('pointerup', up)
  if (props.scroll) props.scroll.style.clipPath = ''
})
</script>

<style scoped>
.pcn { position: absolute; z-index: 12; pointer-events: none; }
.pcn-under, .pcn-flap { position: absolute; inset: 0; }
.pcn-flapwrap { position: absolute; inset: 0; filter: drop-shadow(-6px 4px 8px rgba(0, 0, 0, .55)); }
.pcn-flap { border-radius: 2px; }
.pcn-hit { position: absolute; right: 0; bottom: 0; width: 64px; height: 64px; pointer-events: auto; cursor: grab; touch-action: none; }
.pcn-hit:active { cursor: grabbing; }
</style>
