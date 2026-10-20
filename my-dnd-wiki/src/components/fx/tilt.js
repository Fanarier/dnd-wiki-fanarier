// v-tilt: карточка слегка наклоняется за курсором (стили — fx.css).
// v-tilt="6" — сила наклона в градусах. На телефоне и при «меньше анимаций» — ничего не делает.
const still = () => matchMedia('(hover: none), (prefers-reduced-motion: reduce)').matches
export const vTilt = {
  mounted(el, binding) {
    if (still()) return
    const max = Number(binding.value) || 6
    el.classList.add('fx-tilt')
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative'
    let frame = 0
    el._tiltMove = e => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect()
        const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height
        el.classList.add('tilting')
        el.style.transform = `perspective(700px) rotateX(${(0.5 - y) * max}deg) rotateY(${(x - 0.5) * max}deg) translateY(-3px)`
      })
    }
    el._tiltLeave = () => { cancelAnimationFrame(frame); el.classList.remove('tilting'); el.style.transform = '' }
    el.addEventListener('pointermove', el._tiltMove)
    el.addEventListener('pointerleave', el._tiltLeave)
  },
  unmounted(el) {
    el.removeEventListener('pointermove', el._tiltMove)
    el.removeEventListener('pointerleave', el._tiltLeave)
  }
}
