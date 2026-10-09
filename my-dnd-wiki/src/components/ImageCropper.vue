<template>
  <!-- обрезка картинки перед загрузкой: квадратная рамка, двигать мышью/пальцем, приближать колесом или ползунком -->
  <div v-if="crop.file" class="icrop-back" @pointerdown.self="cancel">
    <section class="icrop" role="dialog" aria-modal="true" :aria-label="crop.title">
      <header>
        <b>{{ crop.title }}</b>
        <button type="button" class="icrop-x" aria-label="Закрыть" @click="cancel">×</button>
      </header>

      <div class="icrop-body">
        <div ref="view" class="icrop-view" :style="{ width: V + 'px', height: V + 'px' }"
             @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="up" @wheel.prevent="wheel">
          <img v-if="url" :src="url" alt="" draggable="false" :style="imgStyle" @load="loaded" />
          <i class="icrop-ring" />
        </div>

        <aside class="icrop-side">
          <small>Так будет выглядеть</small>
          <div class="icrop-prev">
            <span v-for="p in [64, 42, 28]" :key="p" :style="{ width: p + 'px', height: p + 'px' }">
              <img v-if="url" :src="url" alt="" :style="prevStyle(p)" />
            </span>
          </div>
          <label class="icrop-zoom">Масштаб
            <input type="range" :min="sMin" :max="sMax" step="any" :value="s" @input="zoomTo(+$event.target.value)" />
          </label>
          <div class="icrop-acts">
            <button type="button" title="Обрезать прозрачные и однотонные поля вокруг рисунка" @click="trim">✂ Убрать пустые края</button>
            <button type="button" @click="fit">⤢ Вписать целиком</button>
          </div>
          <p class="icrop-hint">Тяни картинку мышью или пальцем, приближай колесом. Кружок — то, что видно в круглых значках.</p>
        </aside>
      </div>

      <footer>
        <button type="button" class="icrop-btn" @click="cancel">Отмена</button>
        <button type="button" class="icrop-btn primary" :disabled="!img" @click="done">Готово</button>
      </footer>
    </section>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { crop, finishCrop } from './cropState.js'

const V = Math.min(320, Math.round((typeof innerWidth === 'number' ? innerWidth : 400) - 64)) // сторона рамки в CSS-пикселях
const view = ref(null)
const url = ref('')
const img = ref(null) // { w, h } натуральный размер
const s = ref(1) // CSS-пикселей рамки на пиксель картинки
const x = ref(0), y = ref(0) // где левый верхний угол картинки внутри рамки
const sMin = computed(() => (img.value ? (V / Math.max(img.value.w, img.value.h)) * 0.4 : 0.1))
const sMax = computed(() => (img.value ? (V / Math.min(img.value.w, img.value.h)) * 8 : 10))
const imgStyle = computed(() => (img.value ? { width: img.value.w * s.value + 'px', height: img.value.h * s.value + 'px', transform: `translate(${x.value}px, ${y.value}px)` } : null))
const prevStyle = p => (img.value ? { width: img.value.w * s.value * (p / V) + 'px', height: img.value.h * s.value * (p / V) + 'px', transform: `translate(${x.value * (p / V)}px, ${y.value * (p / V)}px)` } : null)

watch(() => crop.file, f => {
  if (url.value) URL.revokeObjectURL(url.value)
  img.value = null
  url.value = f ? URL.createObjectURL(f) : ''
})
onBeforeUnmount(() => url.value && URL.revokeObjectURL(url.value))

// при открытии сразу подрезаем пустые поля — частая причина «иконка вышла крошечной»
function loaded(e) {
  img.value = { w: e.target.naturalWidth, h: e.target.naturalHeight, el: e.target }
  trim()
}
function place(box) { // вписать прямоугольник картинки box в рамку с небольшим отступом
  const pad = 0.06 * V
  s.value = Math.min((V - pad * 2) / box.w, (V - pad * 2) / box.h)
  x.value = V / 2 - (box.x + box.w / 2) * s.value
  y.value = V / 2 - (box.y + box.h / 2) * s.value
}
const fit = () => img.value && place({ x: 0, y: 0, w: img.value.w, h: img.value.h })

// границы рисунка: непрозрачные пиксели, а если фон сплошной — отличающиеся от цвета углов
function trim() {
  const im = img.value
  if (!im) return
  const k = Math.min(1, 400 / Math.max(im.w, im.h))
  const w = Math.max(1, Math.round(im.w * k)), h = Math.max(1, Math.round(im.h * k))
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const g = c.getContext('2d', { willReadFrequently: true })
  g.drawImage(im.el, 0, 0, w, h)
  const d = g.getImageData(0, 0, w, h).data
  const at = (px, py) => (py * w + px) * 4
  const corners = [at(0, 0), at(w - 1, 0), at(0, h - 1), at(w - 1, h - 1)]
  const transparent = corners.some(i => d[i + 3] < 30)
  const bg = corners.map(i => [d[i], d[i + 1], d[i + 2]])[0]
  const filled = i => (transparent ? d[i + 3] > 24 : Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2]) > 48 && d[i + 3] > 24)
  let x0 = w, y0 = h, x1 = -1, y1 = -1
  for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
    if (!filled(at(px, py))) continue
    if (px < x0) x0 = px
    if (px > x1) x1 = px
    if (py < y0) y0 = py
    if (py > y1) y1 = py
  }
  if (x1 < 0) return fit() // пусто или сплошная заливка — показываем целиком
  place({ x: x0 / k, y: y0 / k, w: (x1 - x0 + 1) / k, h: (y1 - y0 + 1) / k })
}

// приближение вокруг точки (cx, cy) рамки — по умолчанию её центр
function zoomTo(ns, cx = V / 2, cy = V / 2) {
  ns = Math.min(sMax.value, Math.max(sMin.value, ns))
  x.value = cx - ((cx - x.value) * ns) / s.value
  y.value = cy - ((cy - y.value) * ns) / s.value
  s.value = ns
}
function wheel(e) {
  const r = view.value.getBoundingClientRect()
  zoomTo(s.value * Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top)
}

// перетаскивание; двумя пальцами — щипок
const pts = new Map()
let pinch = 0
function down(e) {
  view.value.setPointerCapture?.(e.pointerId)
  pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
  if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y) }
}
function move(e) {
  const p = pts.get(e.pointerId)
  if (!p) return
  if (pts.size === 2) {
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const [a, b] = [...pts.values()], dist = Math.hypot(a.x - b.x, a.y - b.y)
    const r = view.value.getBoundingClientRect()
    if (pinch) zoomTo(s.value * (dist / pinch), (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top)
    pinch = dist
    return
  }
  x.value += e.clientX - p.x
  y.value += e.clientY - p.y
  pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
}
function up(e) { pts.delete(e.pointerId); pinch = 0 }

// итог: квадрат size×size, прозрачность сохраняется (WebP с альфой)
async function done() {
  const im = img.value, O = crop.size, k = O / V
  const c = document.createElement('canvas')
  c.width = c.height = O
  const g = c.getContext('2d')
  g.imageSmoothingQuality = 'high'
  g.drawImage(im.el, x.value * k, y.value * k, im.w * s.value * k, im.h * s.value * k)
  finishCrop(await new Promise(r => c.toBlob(r, 'image/webp', 0.92)))
}
const cancel = () => finishCrop(null)
const onKey = e => { if (crop.file && e.key === 'Escape') cancel() }
addEventListener('keydown', onKey)
onBeforeUnmount(() => removeEventListener('keydown', onKey))
</script>

<style scoped>
.icrop-back { position: fixed; inset: 0; z-index: 400; display: grid; place-items: center; padding: 16px; background: rgba(5, 6, 10, .72); backdrop-filter: blur(3px); }
.icrop { width: min(640px, 100%); max-height: calc(100vh - 32px); overflow: auto; border-radius: 16px; background: #17130e; border: 1px solid #8a6630; box-shadow: 0 24px 60px rgba(0, 0, 0, .6); color: #efe3c8; font: 13px 'Manrope', sans-serif; }
.icrop header, .icrop footer { display: flex; align-items: center; gap: 8px; padding: 12px 16px; }
.icrop header { justify-content: space-between; border-bottom: 1px solid rgba(201, 162, 79, .2); }
.icrop header b { font: 700 17px 'Cormorant Garamond', serif; color: #f3d99a; }
.icrop-x { border: 0; background: none; color: #a8936c; font-size: 22px; cursor: pointer; }
.icrop-body { display: flex; flex-wrap: wrap; gap: 16px; padding: 16px; justify-content: center; }
/* шахматка — видно, где прозрачно */
.icrop-view { position: relative; flex: none; overflow: hidden; border-radius: 10px; cursor: grab; touch-action: none; user-select: none; outline: 2px solid #e6c27a;
  background: repeating-conic-gradient(#2b2620 0 25%, #3a332a 0 50%) 0 0 / 20px 20px; }
.icrop-view:active { cursor: grabbing; }
.icrop-view img { position: absolute; left: 0; top: 0; max-width: none; transform-origin: 0 0; pointer-events: none; }
.icrop-ring { position: absolute; inset: 0; border-radius: 50%; box-shadow: 0 0 0 9999px rgba(0, 0, 0, .35); border: 1.5px dashed rgba(255, 243, 214, .7); pointer-events: none; }
.icrop-side { display: grid; align-content: start; gap: 10px; min-width: 200px; flex: 1; }
.icrop-side small { color: #a8936c; font-weight: 800; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; }
.icrop-prev { display: flex; align-items: center; gap: 12px; }
.icrop-prev span { position: relative; overflow: hidden; border-radius: 50%; background: #d6d2c8; border: 2px solid #fff3d6; flex: none; }
.icrop-prev img { position: absolute; left: 0; top: 0; max-width: none; transform-origin: 0 0; }
.icrop-zoom { display: grid; gap: 4px; color: #a8936c; font-weight: 700; }
.icrop-zoom input { width: 100%; accent-color: #e6c27a; }
.icrop-acts { display: flex; flex-wrap: wrap; gap: 6px; }
.icrop-acts button, .icrop-btn { padding: 6px 12px; border-radius: 9px; border: 1px solid rgba(201, 162, 79, .45); background: rgba(231, 197, 111, .08); color: #f3d99a; font: 700 12.5px 'Manrope', sans-serif; cursor: pointer; }
.icrop-acts button:hover, .icrop-btn:hover { background: rgba(231, 197, 111, .16); }
.icrop-hint { margin: 0; color: #a8936c; font-size: 12px; line-height: 1.45; }
.icrop footer { justify-content: flex-end; border-top: 1px solid rgba(201, 162, 79, .2); }
.icrop-btn.primary { background: linear-gradient(180deg, #f0cf83, #c99a45); color: #1b140c; border-color: #e6c27a; }
.icrop-btn:disabled { opacity: .5; cursor: default; }
</style>
