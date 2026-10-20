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
// искры: вспыхивают веером над элементом и дугой слетаются в цель (или вверх) — «очки ушли в тренировку»;
// цель в конце коротко вспыхивает
export function sparks(from, to, color = '#f3d36b', n = 12) {
  if (reduced() || !from) return
  const a = from.getBoundingClientRect()
  const b = to?.getBoundingClientRect?.() || { left: a.left + a.width / 2, top: a.top - 120, width: 0, height: 0 }
  const tx = b.left + b.width / 2, ty = b.top + b.height / 2
  const x0 = a.left + a.width / 2, y0 = a.top + a.height / 2
  for (let i = 0; i < n; i++) {
    const s = document.createElement('i')
    const size = 5 + Math.random() * 4
    s.style.cssText = `position:fixed;z-index:700;left:${x0}px;top:${y0}px;width:${size}px;height:${size}px;margin:${-size / 2}px 0 0 ${-size / 2}px;border-radius:50%;pointer-events:none;background:${color};box-shadow:0 0 12px ${color},0 0 4px #fff`
    document.body.appendChild(s)
    const ang = Math.PI * (1.05 + Math.random() * 0.9) // веер вверх
    const r = 40 + Math.random() * 50
    gsap.timeline({ onComplete: () => s.remove() })
      .fromTo(s, { scale: 0, opacity: 0 }, { x: Math.cos(ang) * r * 1.6, y: Math.sin(ang) * r, scale: 1.2, opacity: 1, duration: 0.3 + Math.random() * 0.15, ease: 'power2.out', delay: i * 0.02 })
      .to(s, { x: tx - x0, y: ty - y0, scale: 0.2, opacity: 0, duration: 0.55 + Math.random() * 0.2, ease: 'power3.in' })
  }
  if (to?.animate) setTimeout(() => to.animate([{ transform: 'scale(1)', filter: 'brightness(1)' }, { transform: 'scale(1.18)', filter: 'brightness(1.6)' }, { transform: 'scale(1)', filter: 'brightness(1)' }], { duration: 450 }), 900)
}
// запись трескается (провал) или перечёркивается (отмена) — короткая встряска
export function shake(el) {
  if (reduced() || !el) return
  gsap.fromTo(el, { x: 0 }, { x: 6, duration: 0.06, repeat: 5, yoyo: true, ease: 'none', clearProps: 'x' })
}
