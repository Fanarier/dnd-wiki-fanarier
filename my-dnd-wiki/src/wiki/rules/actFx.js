// Праздничные эффекты журнала деятельностей: конфетти (закрыта тренировка, «учесть все»), искры от записи
// к счётчику очков. Всё уважает «меньше анимаций» в системе.
import { gsap } from 'gsap'

const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
let confettiFn = null
async function confetti(opts) {
  if (reduced()) return
  confettiFn ||= (await import('canvas-confetti')).default
  confettiFn({ disableForReducedMotion: true, zIndex: 700, ...opts })
}
// золотой дождь из точки на экране (элемент или центр)
export function celebrate(el, big = false) {
  const r = el?.getBoundingClientRect?.()
  const origin = r ? { x: (r.left + r.width / 2) / innerWidth, y: (r.top + r.height / 2) / innerHeight } : { x: 0.5, y: 0.4 }
  confetti({ particleCount: big ? 160 : 70, spread: big ? 100 : 70, startVelocity: big ? 45 : 30, origin, colors: ['#f3d36b', '#e7c56f', '#fff4c8', '#7ed07a', '#b9a6ff'], scalar: big ? 1.1 : 0.9 })
}
// искры летят от элемента к цели (или вверх) — «очки ушли в тренировку»
export function sparks(from, to, color = '#f3d36b', n = 9) {
  if (reduced() || !from) return
  const a = from.getBoundingClientRect()
  const b = to?.getBoundingClientRect?.() || { left: a.left + a.width / 2, top: a.top - 120, width: 0, height: 0 }
  for (let i = 0; i < n; i++) {
    const s = document.createElement('i')
    s.style.cssText = `position:fixed;z-index:700;left:${a.left + a.width * Math.random()}px;top:${a.top + a.height / 2}px;width:7px;height:7px;border-radius:50%;pointer-events:none;background:${color};box-shadow:0 0 10px ${color}`
    document.body.appendChild(s)
    gsap.to(s, {
      duration: 0.7 + Math.random() * 0.4, delay: i * 0.03, ease: 'power2.in',
      x: b.left + b.width / 2 - parseFloat(s.style.left) + (Math.random() - 0.5) * 20, y: b.top + b.height / 2 - parseFloat(s.style.top),
      scale: 0.3, opacity: 0.2, onComplete: () => s.remove()
    })
  }
}
// запись трескается (провал) или перечёркивается (отмена) — короткая встряска
export function shake(el) {
  if (reduced() || !el) return
  gsap.fromTo(el, { x: 0 }, { x: 6, duration: 0.06, repeat: 5, yoyo: true, ease: 'none', clearProps: 'x' })
}
