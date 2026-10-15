<template>
  <!-- слой эффектов книги: урон и лечение, результат броска у навыка, крит и провал, новый уровень.
       Всё короткое (до секунды-полутора) и не мешает правке — слой не ловит мышь. -->
  <div ref="root" class="bfx" aria-hidden="true">
    <div ref="hurt" class="bfx-hurt" />
    <div ref="heal" class="bfx-heal" />
    <div ref="gold" class="bfx-gold" />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import gsap from 'gsap'

const props = defineProps({ book: { type: Object, default: null } })
const root = ref(null), hurt = ref(null), heal = ref(null), gold = ref(null)
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches

// точка элемента в координатах книги (или середина верха, если элемента нет на развороте)
function at(el, fx = 0.5, fy = 0.5) {
  const b = props.book?.getBoundingClientRect()
  if (!b) return { x: 0, y: 0 }
  const r = el?.isConnected ? el.getBoundingClientRect() : null
  if (!r || !r.width) return { x: b.width / 2, y: b.height * 0.25 }
  return { x: r.left - b.left + r.width * fx, y: r.top - b.top + r.height * fy }
}
function make(cls, text) {
  const n = document.createElement('div')
  n.className = cls
  if (text != null) n.textContent = text
  root.value?.append(n)
  return n
}
// всплывающее число: «−12», «+8», итог броска
function floatText(p, text, cls, { rise = 70, dur = 1.1, scale = 1 } = {}) {
  const n = make('bfx-num ' + cls, text)
  gsap.timeline({ onComplete: () => n.remove() })
    .fromTo(n, { x: p.x, y: p.y, xPercent: -50, yPercent: -50, scale: 0.4 * scale, opacity: 0 }, { scale: 1.15 * scale, opacity: 1, duration: 0.22, ease: 'back.out(3)' })
    .to(n, { scale, duration: 0.15 }, '>')
    .to(n, { y: p.y - rise, duration: dur, ease: 'power1.out' }, 0)
    .to(n, { opacity: 0, duration: 0.35, ease: 'power1.in' }, dur - 0.25)
}
// искры от точки
function burst(p, cls, count = 18, spread = 70, up = 40) {
  for (let i = 0; i < count; i++) {
    const s = make('bfx-spark ' + cls)
    const a = Math.random() * Math.PI * 2, d = spread * (0.4 + Math.random() * 0.8)
    gsap.timeline({ onComplete: () => s.remove() })
      .fromTo(s, { x: p.x, y: p.y, scale: 0.5 + Math.random() * 0.8, opacity: 1 }, { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d - up * Math.random(), duration: 0.5 + Math.random() * 0.5, ease: 'power2.out' })
      .to(s, { opacity: 0, scale: 0.1, duration: 0.3 }, '-=0.3')
  }
}
const flash = (el, peak, dur = 0.7) => gsap.fromTo(el, { opacity: 0 }, { opacity: peak, duration: dur * 0.25, ease: 'power2.out', yoyo: true, repeat: 1, repeatDelay: dur * 0.2 })

defineExpose({
  // урон: красная вспышка по краям, книгу встряхивает, «−N» у хитов
  hit(n, el) {
    if (reduce) return
    flash(hurt.value, 0.85, 0.7)
    gsap.fromTo(props.book, { x: 0 }, { keyframes: { x: [-7, 6, -4, 3, -1, 0] }, duration: 0.42, ease: 'none', clearProps: 'x' })
    floatText(at(el, 0.5, 0.3), `−${n}`, 'hurt', { rise: 60 })
    burst(at(el, 0.5, 0.5), 'red', 10, 50, 10)
  },
  // лечение: зелёное сияние, искры вверх, «+N»
  heal(n, el) {
    if (reduce) return
    flash(heal.value, 0.7, 0.9)
    const p = at(el, 0.5, 0.4)
    floatText(p, `+${n}`, 'heal', { rise: 70 })
    burst(p, 'green', 16, 60, 60)
  },
  // итог броска у того, по чему щёлкнули; крит — золото, провал — чернильная клякса
  roll(total, kind, el) {
    if (reduce) return
    const p = at(el, 0.5, 0.5)
    if (kind === 'crit') {
      flash(gold.value, 0.8, 0.9)
      burst(p, 'gold', 26, 110, 50)
      floatText(p, `${total}!`, 'crit', { rise: 80, dur: 1.4, scale: 1.5 })
    } else if (kind === 'fail') {
      const blot = make('bfx-blot')
      gsap.timeline({ onComplete: () => blot.remove() })
        .fromTo(blot, { x: p.x, y: p.y, xPercent: -50, yPercent: -50, scale: 0.2, opacity: 0.9, rotation: Math.random() * 360 }, { scale: 1, duration: 0.35, ease: 'power3.out' })
        .to(blot, { opacity: 0, duration: 0.6 }, '+=0.5')
      floatText(p, String(total), 'fail', { rise: 40, dur: 1.3, scale: 1.3 })
    } else {
      const ring = make('bfx-ring')
      gsap.timeline({ onComplete: () => ring.remove() })
        .fromTo(ring, { x: p.x, y: p.y, xPercent: -50, yPercent: -50, scale: 0.3, opacity: 0.9 }, { scale: 1.6, opacity: 0, duration: 0.6, ease: 'power2.out' })
      floatText(p, String(total), 'roll', { rise: 55, dur: 1.2, scale: 1.2 })
    }
  },
  // новый уровень: столп света из книги, надпись, искры
  levelUp(lv) {
    if (reduce) return
    const b = props.book.getBoundingClientRect(), p = { x: b.width / 2, y: b.height / 2 }
    const pillar = make('bfx-pillar')
    gsap.timeline({ onComplete: () => pillar.remove() })
      .fromTo(pillar, { x: p.x, xPercent: -50, scaleX: 0.1, opacity: 0 }, { scaleX: 1, opacity: 1, duration: 0.3, ease: 'power2.out' })
      .to(pillar, { opacity: 0, scaleX: 1.6, duration: 0.8, ease: 'power1.in' }, '+=0.35')
    flash(gold.value, 0.6, 1)
    burst(p, 'gold', 36, 220, 120)
    floatText({ x: p.x, y: p.y + 40 }, `Уровень ${lv}!`, 'level', { rise: 90, dur: 1.6, scale: 1 })
  }
})
</script>

<style scoped>
.bfx { position: absolute; inset: 0; z-index: 40; pointer-events: none; overflow: visible; }
.bfx-hurt, .bfx-heal, .bfx-gold { position: absolute; inset: 0; border-radius: 20px; opacity: 0; }
.bfx-hurt { box-shadow: inset 0 0 90px 30px rgba(220, 40, 30, .75); }
.bfx-heal { box-shadow: inset 0 0 90px 24px rgba(90, 220, 120, .55); }
.bfx-gold { background: radial-gradient(ellipse at 50% 50%, rgba(255, 220, 140, .35), transparent 60%); box-shadow: inset 0 0 80px 20px rgba(255, 200, 90, .5); }
.bfx :deep(.bfx-num) { position: absolute; left: 0; top: 0; font: 900 34px 'Cormorant Garamond', serif; white-space: nowrap; text-shadow: 0 2px 0 rgba(0, 0, 0, .7), 0 0 14px currentColor; }
.bfx :deep(.bfx-num.hurt) { color: #ff5b4d; }
.bfx :deep(.bfx-num.heal) { color: #7ee06a; }
.bfx :deep(.bfx-num.roll) { color: #f3dc9e; }
.bfx :deep(.bfx-num.crit) { color: #ffd166; }
.bfx :deep(.bfx-num.fail) { color: #b0a6ff; text-shadow: 0 2px 0 rgba(0, 0, 0, .8), 0 0 10px #000; }
.bfx :deep(.bfx-num.level) { font-size: 48px; color: #ffe7a8; letter-spacing: .02em; text-shadow: 0 3px 0 rgba(0, 0, 0, .7), 0 0 26px #ffcf6a; }
.bfx :deep(.bfx-spark) { position: absolute; left: -3px; top: -3px; width: 6px; height: 6px; border-radius: 50%; }
.bfx :deep(.bfx-spark.red) { background: #ff6b5e; box-shadow: 0 0 8px #ff3b2e; }
.bfx :deep(.bfx-spark.green) { background: #a8f59a; box-shadow: 0 0 8px #5cd86b; }
.bfx :deep(.bfx-spark.gold) { background: #fff1c4; box-shadow: 0 0 10px #ffc94f; }
.bfx :deep(.bfx-ring) { position: absolute; left: 0; top: 0; width: 70px; height: 70px; border-radius: 50%; border: 2px solid rgba(243, 220, 158, .8); box-shadow: 0 0 14px rgba(243, 220, 158, .5); }
.bfx :deep(.bfx-blot) { position: absolute; left: 0; top: 0; width: 110px; height: 110px; background: radial-gradient(circle at 45% 45%, rgba(20, 12, 30, .95) 0 38%, rgba(20, 12, 30, .7) 45%, transparent 62%), radial-gradient(circle at 75% 30%, rgba(20, 12, 30, .9) 0 9%, transparent 12%), radial-gradient(circle at 20% 75%, rgba(20, 12, 30, .9) 0 7%, transparent 10%); filter: blur(.4px); }
.bfx :deep(.bfx-pillar) { position: absolute; left: 0; top: -40%; bottom: -10%; width: 220px; background: linear-gradient(90deg, transparent, rgba(255, 226, 150, .55), rgba(255, 250, 225, .85), rgba(255, 226, 150, .55), transparent); filter: blur(6px); mix-blend-mode: screen; }
</style>
