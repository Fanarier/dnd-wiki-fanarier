// Свои анимации Lottie для журнала деятельностей — собираются кодом (без скачанных файлов):
// сургучная печать «учтено» / «провал», песочные часы, вспышка искр. Проигрывает их dotLottie (LottieFx.vue).
const P = k => ({ a: 0, k })
// ключевые кадры: [[кадр, значение], …] — с мягким замедлением
const A = (frames, ease = [0.25, 1]) => ({
  a: 1,
  k: frames.map(([t, s], i) => (i < frames.length - 1
    ? { t, s: [].concat(s), i: { x: [ease[0]], y: [ease[1]] }, o: { x: [0.4], y: [0] } }
    : { t, s: [].concat(s) }))
})
const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).concat(1)
const tr = (o = {}) => ({ ty: 'tr', p: P([0, 0]), a: P([0, 0]), s: P([100, 100]), r: P(0), o: P(100), sk: P(0), sa: P(0), ...o })
const group = (it, o) => ({ ty: 'gr', it: [...it, tr(o)] })
const fill = hex => ({ ty: 'fl', c: P(rgb(hex)), o: P(100), r: 1 })
const stroke = (hex, w, o = 100) => ({ ty: 'st', c: P(rgb(hex)), o: P(o), w: P(w), lc: 2, lj: 2 })
const ellipse = (w, h = w) => ({ ty: 'el', p: P([0, 0]), s: P([w, h]), d: 1 })
const path = (v, closed = false) => ({ ty: 'sh', ks: P({ i: v.map(() => [0, 0]), o: v.map(() => [0, 0]), v, c: closed }) })
const star = (pt, outer, inner) => ({ ty: 'sr', sy: 1, d: 1, pt: P(pt), p: P([0, 0]), r: P(0), ir: P(inner), is: P(0), or: P(outer), os: P(0) })
function layer(ind, shapes, ks, ip, op) {
  return { ddd: 0, ind, ty: 4, nm: 'l' + ind, sr: 1, ao: 0, ip, op, st: 0, bm: 0,
    ks: { o: P(100), r: P(0), p: P([100, 100, 0]), a: P([0, 0, 0]), s: P([100, 100, 100]), ...ks }, shapes }
}
const anim = (op, layers, w = 200, h = 200) => ({ v: '5.7.4', fr: 60, ip: 0, op, w, h, nm: 'fx', ddd: 0, assets: [], layers })

// печать: сургуч с зубчатым краем падает с высоты, бьёт и расходится кольцом, держится и гаснет; внутри — галочка или крестик
export function stamp(kind = 'done') {
  const wax = kind === 'done' ? '#b3261e' : kind === 'fail' ? '#4a4a52' : '#7a5a2a'
  const rim = kind === 'done' ? '#7d1712' : '#2c2c33'
  const mark = kind === 'fail'
    ? [group([path([[-22, -22], [22, 22]]), stroke('#f3e2c0', 9)]), group([path([[22, -22], [-22, 22]]), stroke('#f3e2c0', 9)])]
    : [group([path([[-24, 2], [-7, 19], [26, -18]]), stroke('#f3e2c0', 9)])]
  const seal = layer(1, [
    ...mark,
    group([ellipse(92), stroke('#f3e2c0', 3, 55)]),
    group([star(22, 70, 62), fill(wax), stroke(rim, 3)])
  ], {
    s: A([[0, [260, 260, 100]], [12, [86, 86, 100]], [18, [104, 104, 100]], [24, [100, 100, 100]], [72, [100, 100, 100]], [98, [55, 55, 100]]]),
    r: A([[0, -32], [12, -10], [24, -12], [98, 8]]),
    o: A([[0, 0], [6, 100], [72, 100], [98, 0]])
  }, 0, 100)
  const ring = layer(2, [group([ellipse(150), stroke(kind === 'done' ? '#e7c56f' : '#9a9aa6', 6)])], {
    s: A([[10, [70, 70, 100]], [40, [135, 135, 100]]]),
    o: A([[10, 0], [13, 90], [40, 0]])
  }, 10, 100)
  return anim(100, [seal, ring])
}

// песочные часы: песок пересыпается сверху вниз, струйка, переворот — по кругу
export function hourglass(color = '#e7c56f', sand = '#f0b54f') {
  const glass = layer(1, [
    group([path([[-38, -62], [38, -62], [6, -4], [6, 4], [38, 62], [-38, 62], [-6, 4], [-6, -4]], true), stroke(color, 5)]),
    group([path([[-46, -66], [46, -66]]), stroke(color, 8)]),
    group([path([[-46, 66], [46, 66]]), stroke(color, 8)])
  ], { r: A([[0, 0], [150, 0], [180, 180]], [0.5, 1]) }, 0, 180)
  const top = layer(2, [group([path([[-30, -56], [30, -56], [0, -6]], true), fill(sand)])],
    { a: P([0, -6, 0]), p: P([100, 94, 0]), s: A([[0, [100, 100, 100]], [140, [100, 0, 100]]]), o: A([[0, 100], [150, 100], [152, 0]]) }, 0, 180)
  const bottom = layer(3, [group([path([[-32, 58], [32, 58], [0, 14]], true), fill(sand)])],
    { a: P([0, 58, 0]), p: P([100, 158, 0]), s: A([[0, [100, 0, 100]], [140, [100, 100, 100]]]), o: A([[0, 100], [150, 100], [152, 0]]) }, 0, 180)
  const stream = layer(4, [group([path([[0, -4], [0, 56]]), stroke(sand, 3)])], { o: A([[0, 0], [8, 100], [132, 100], [140, 0]]) }, 0, 180)
  return anim(180, [stream, top, bottom, glass])
}

// вспышка: искры разлетаются из центра и гаснут
export function burst(color = '#ffd36b', n = 10) {
  const layers = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2, d = 70 + (i % 3) * 12
    return layer(i + 1, [group([star(4, 9, 3.5), fill(i % 2 ? '#fff4c8' : color)])], {
      p: A([[0, [100, 100, 0]], [36, [100 + Math.cos(a) * d, 100 + Math.sin(a) * d, 0]]], [0.2, 1]),
      s: A([[0, [40, 40, 100]], [10, [120, 120, 100]], [40, [20, 20, 100]]]),
      r: A([[0, 0], [40, 180]]),
      o: A([[0, 0], [4, 100], [30, 100], [42, 0]])
    }, 0, 45)
  })
  return anim(45, layers)
}
