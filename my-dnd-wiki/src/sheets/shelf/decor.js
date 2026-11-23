// Вещи на полках и раскладка стеллажа: книги встают плотно слева направо, полка кончилась — следующая;
// свободное место на полке занимают старые тома и вещи. Раскладка зависит только от ширины и числа книг,
// поэтому у всех, кто смотрит с одинаковым экраном, стеллаж одинаковый.
export const DECOR = {
  lantern: { w: 84, h: 140 }, candle: { w: 56, h: 96 }, globe: { w: 86, h: 124 }, hourglass: { w: 60, h: 112 }, bottles: { w: 96, h: 104 },
  frame: { w: 110, h: 130 }, chest: { w: 104, h: 76 }, ink: { w: 64, h: 110 }, scrolls: { w: 100, h: 58 }, crystal: { w: 80, h: 92 }, plate: { w: 96, h: 96 }, stack: { w: 120, h: 84 }
}
const ORDER = ['lantern', 'stack', 'globe', 'bottles', 'candle', 'frame', 'hourglass', 'chest', 'ink', 'lantern', 'scrolls', 'crystal', 'plate', 'stack', 'candle']
// у каждой свечи и фонаря свой ритм пламени: период и сдвиг — от номера вещи
export function flicker(seed) {
  const r = rng(seed * 2654435 + 977)
  return { '--ft': (1.25 + r() * 1.1).toFixed(2) + 's', '--fd': (-r() * 6).toFixed(2) + 's' }
}
export const TAG_W = 34, BOOK_GAP = 1, GROUP_GAP = 12

function rng(s) { return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9 | 0) >>> 0) / 4294967296 }

// groups: [{ key, title, own, books: [{ id, w, ... }] }] → полки: [{ items: [{ t: 'tag'|'book'|'decor'|'gap', ... }] }]
export function packShelves(groups, width, minRows = 3) {
  const rows = [{ items: [], x: 0 }]
  let row = rows[0]
  const next = () => { row = { items: [], x: 0 }; rows.push(row) }
  const put = (item, w) => { row.items.push(item); row.x += w }
  for (const g of groups) {
    if (!g.books.length) continue
    if (row.x && row.x + GROUP_GAP + TAG_W + g.books[0].w > width) next()
    if (row.x) put({ t: 'gap', w: GROUP_GAP }, GROUP_GAP)
    put({ t: 'tag', w: TAG_W, group: g }, TAG_W)
    for (const b of g.books) {
      if (row.x + b.w + BOOK_GAP > width && row.x) next()
      put({ t: 'book', w: b.w, book: b, group: g }, b.w + BOOK_GAP)
    }
  }
  while (rows.length < minRows) next()
  // свободное место: вещи и ряды старых томов
  let q = 0
  rows.forEach((r, i) => {
    const rnd = rng(i * 97 + 31)
    let rest = width - r.x
    const add = (item, w) => { r.items.push(item); rest -= w }
    let tomesNext = r.x === 0 ? rnd() > 0.5 : false
    let guard = 0
    while (rest >= 44 && guard++ < 24) {
      if (tomesNext) {
        const w = Math.min(rest, 64 + Math.round(rnd() * 120))
        // остаток, в который вещь уже не встанет, отдаём томам целиком
        const take = rest - w < 60 ? rest : w
        add({ t: 'decor', kind: 'tomes', w: take, seed: i * 31 + guard }, take)
      } else {
        let kind = null
        for (let k = 0; k < ORDER.length; k++) { const c = ORDER[(q + k) % ORDER.length]; if (DECOR[c].w + 18 <= rest) { kind = c; q = q + k + 1; break } }
        if (!kind) { tomesNext = true; continue }
        const pad = Math.min(rest - DECOR[kind].w, 8 + Math.round(rnd() * 14))
        add({ t: 'gap', w: pad }, pad)
        add({ t: 'decor', kind, w: DECOR[kind].w, seed: i * 17 + guard }, DECOR[kind].w)
        if (rest >= 10) add({ t: 'gap', w: 10 }, 10)
      }
      tomesNext = !tomesNext
    }
  })
  return rows
}
