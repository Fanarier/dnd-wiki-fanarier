// Живые фоны школ магии (canvas 2D) — у каждой школы свой: ветер, камни, лучи света, тени, знаки порядка,
// осколки хаоса, круг призыва, руны зачарования, сеть разума, созвездия арканы, страницы гримуара.
// Сцена: build(s) — один раз и при смене размера, draw(s, t, dt) — каждый кадр (~30/с).
// s = { g, W, H, K, rnd, edges, still } — холст, размеры в пикселях холста, пикселей на CSS-пиксель,
// случайность с зерном, края колонки статьи, «меньше анимаций».

const TAU = Math.PI * 2
const glow = (g, x, y, r, col, a) => {
  const gr = g.createRadialGradient(x, y, 0, x, y, r)
  gr.addColorStop(0, `rgba(${col}, ${a})`)
  gr.addColorStop(1, `rgba(${col}, 0)`)
  g.fillStyle = gr
  g.fillRect(x - r, y - r, r * 2, r * 2)
}
const wrap = (v, max) => ((v % max) + max) % max

/* ---------- воздух: потоки ветра и летящие листья ---------- */
const air = {
  build(s) {
    const { rnd, W, H, K } = s
    s.streaks = Array.from({ length: Math.round(W / K / 28) }, () => ({ y: rnd() * H, x: rnd() * W, len: (120 + rnd() * 260) * K, v: (90 + rnd() * 160) * K, amp: (6 + rnd() * 22) * K, ph: rnd() * TAU, a: 0.05 + rnd() * 0.16 }))
    s.leaves = Array.from({ length: Math.round(W / K / 120) + 4 }, () => ({ x: rnd() * W, y: rnd() * H, v: (60 + rnd() * 90) * K, r: (3 + rnd() * 4) * K, rot: rnd() * TAU, spin: (rnd() - 0.5) * 4, ph: rnd() * TAU }))
  },
  draw(s, t, dt) {
    const { g, W, H, K } = s
    g.clearRect(0, 0, W, H)
    g.lineCap = 'round'
    for (const k of s.streaks) {
      k.x += k.v * dt
      if (k.x - k.len > W) { k.x = -k.len * 0.2; k.y = Math.random() * H }
      const gr = g.createLinearGradient(k.x - k.len, 0, k.x, 0)
      gr.addColorStop(0, 'rgba(220, 240, 255, 0)')
      gr.addColorStop(1, `rgba(220, 240, 255, ${k.a})`)
      g.strokeStyle = gr
      g.lineWidth = 1.4 * K
      g.beginPath()
      for (let i = 0; i <= 12; i++) {
        const x = k.x - k.len + (k.len * i) / 12
        const y = k.y + Math.sin(x * 0.006 / K + t * 1.4 + k.ph) * k.amp
        i ? g.lineTo(x, y) : g.moveTo(x, y)
      }
      g.stroke()
    }
    for (const l of s.leaves) {
      l.x += l.v * dt; l.rot += l.spin * dt
      const y = l.y + Math.sin(t * 1.2 + l.ph) * 30 * K
      if (l.x > W + 20) { l.x = -20; l.y = Math.random() * H }
      g.save(); g.translate(l.x, y); g.rotate(l.rot)
      g.fillStyle = 'rgba(170, 225, 190, .55)'
      g.beginPath(); g.ellipse(0, 0, l.r * 1.8, l.r * 0.7, 0, 0, TAU); g.fill()
      g.restore()
    }
  }
}

/* ---------- земля: слои породы с тлеющими трещинами, парящие обломки скал, пыль ---------- */
const earth = {
  build(s) {
    const { rnd, W, H, K } = s
    const e = s.edges()
    s.rocks = []
    for (const ax of [e.treeL, e.treeR]) {
      for (let i = 0; i < 7; i++) {
        const n = 6 + Math.floor(rnd() * 3), r = (10 + rnd() * 34) * K
        s.rocks.push({ x: ax + (rnd() - 0.5) * 220 * K, y0: H * (0.35 + rnd() * 0.5), r, ph: rnd() * TAU, spin: (rnd() - 0.5) * 0.3,
          pts: Array.from({ length: n }, (_, j) => [Math.cos((j / n) * TAU) * r * (0.7 + rnd() * 0.4), Math.sin((j / n) * TAU) * r * (0.7 + rnd() * 0.4)]) })
      }
    }
    // слои породы внизу — один раз в отдельный холст
    s.strata = document.createElement('canvas'); s.strata.width = W; s.strata.height = Math.round(H * 0.16)
    const sg = s.strata.getContext('2d'), sh = s.strata.height
    const cols = ['rgba(70, 48, 30, .55)', 'rgba(96, 66, 40, .5)', 'rgba(58, 42, 30, .6)', 'rgba(110, 80, 50, .45)']
    for (let l = 0; l < 4; l++) {
      sg.fillStyle = cols[l]
      sg.beginPath(); sg.moveTo(0, sh)
      for (let x = 0; x <= W; x += 20 * K) sg.lineTo(x, sh * (0.15 + l * 0.22) + Math.sin(x * 0.004 / K + l * 2) * 10 * K + rnd() * 4 * K)
      sg.lineTo(W, sh); sg.closePath(); sg.fill()
    }
    s.cracks = Array.from({ length: 9 }, () => { const x = rnd() * W, pts = [[x, sh]]; let y = sh, cx = x; while (y > sh * 0.2) { y -= (8 + rnd() * 16) * K; cx += (rnd() - 0.5) * 22 * K; pts.push([cx, y]) } return { pts, ph: rnd() * TAU } })
    s.dust = Array.from({ length: Math.round(W / K / 30) }, () => ({ x: rnd() * W, y: rnd() * H, v: (4 + rnd() * 10) * K, r: (0.6 + rnd()) * K }))
  },
  draw(s, t, dt) {
    const { g, W, H, K } = s
    g.clearRect(0, 0, W, H)
    const top = H - s.strata.height
    g.drawImage(s.strata, 0, top)
    g.lineCap = 'round'
    for (const c of s.cracks) {
      const a = 0.25 + 0.25 * Math.sin(t * 0.9 + c.ph)
      g.strokeStyle = `rgba(255, 170, 70, ${a})`; g.lineWidth = 2 * K
      g.beginPath(); c.pts.forEach(([x, y], i) => (i ? g.lineTo(x, top + y) : g.moveTo(x, top + y))); g.stroke()
    }
    for (const r of s.rocks) {
      const y = r.y0 + Math.sin(t * 0.5 + r.ph) * 14 * K
      g.save(); g.translate(r.x, y); g.rotate(t * r.spin + r.ph)
      glow(g, 0, r.r * 0.6, r.r * 1.6, '255, 160, 70', 0.12)
      g.fillStyle = 'rgba(84, 70, 58, .85)'; g.strokeStyle = 'rgba(210, 150, 80, .45)'; g.lineWidth = 1.2 * K
      g.beginPath(); r.pts.forEach(([x, yy], i) => (i ? g.lineTo(x, yy) : g.moveTo(x, yy))); g.closePath(); g.fill(); g.stroke()
      g.fillStyle = 'rgba(160, 130, 100, .35)'
      g.beginPath(); g.moveTo(r.pts[0][0], r.pts[0][1]); g.lineTo(r.pts[1][0], r.pts[1][1]); g.lineTo(0, 0); g.closePath(); g.fill()
      g.restore()
    }
    g.fillStyle = 'rgba(200, 170, 130, .35)'
    g.beginPath()
    for (const d of s.dust) { d.y -= d.v * dt; if (d.y < -4) { d.y = H; d.x = Math.random() * W } g.moveTo(d.x + d.r, d.y); g.arc(d.x, d.y, d.r, 0, TAU) }
    g.fill()
  }
}

/* ---------- свет: лучи сверху, поднимающиеся золотые искры ---------- */
const light = {
  build(s) {
    const { rnd, W, H, K } = s
    s.rays = Array.from({ length: 7 }, () => ({ a: (rnd() - 0.5) * 1.1, w: 0.05 + rnd() * 0.08, ph: rnd() * TAU }))
    s.motes = Array.from({ length: Math.round(W / K / 18) }, () => ({ x: rnd() * W, y: rnd() * H, v: (10 + rnd() * 24) * K, r: (0.8 + rnd() * 1.8) * K, ph: rnd() * TAU }))
  },
  draw(s, t, dt) {
    const { g, W, H, K } = s
    g.clearRect(0, 0, W, H)
    g.globalCompositeOperation = 'lighter'
    const cx = W / 2, cy = -H * 0.15
    glow(g, cx, 0, Math.max(W, H) * 0.45, '255, 230, 160', 0.12)
    for (const r of s.rays) {
      const a = r.a + Math.sin(t * 0.15 + r.ph) * 0.06, w = r.w * (0.8 + 0.2 * Math.sin(t * 0.6 + r.ph))
      const L = H * 1.4
      const gr = g.createLinearGradient(cx, cy, cx + Math.sin(a) * L, cy + Math.cos(a) * L)
      gr.addColorStop(0, `rgba(255, 236, 180, ${0.1 + 0.05 * Math.sin(t + r.ph)})`)
      gr.addColorStop(1, 'rgba(255, 236, 180, 0)')
      g.fillStyle = gr
      g.beginPath(); g.moveTo(cx, cy)
      g.lineTo(cx + Math.sin(a - w) * L, cy + Math.cos(a - w) * L); g.lineTo(cx + Math.sin(a + w) * L, cy + Math.cos(a + w) * L)
      g.closePath(); g.fill()
    }
    for (const m of s.motes) {
      m.y -= m.v * dt
      if (m.y < -4) { m.y = H + 4; m.x = Math.random() * W }
      const tw = 0.5 + 0.5 * Math.sin(t * 3 + m.ph)
      g.fillStyle = `rgba(255, 220, 140, ${0.35 + 0.45 * tw})`
      g.beginPath(); g.arc(m.x + Math.sin(t + m.ph) * 8 * K, m.y, m.r * (0.7 + 0.5 * tw), 0, TAU); g.fill()
    }
    g.globalCompositeOperation = 'source-over'
  }
}

/* ---------- тьма: щупальца теней от краёв, падающий фиолетовый пепел, глаза во мраке ---------- */
const dark = {
  build(s) {
    const { rnd, W, H, K } = s
    s.tend = []
    for (let i = 0; i < 14; i++) {
      const side = i % 3 // 0 — слева, 1 — справа, 2 — снизу
      s.tend.push({ side, p: rnd(), len: (140 + rnd() * 260) * K, w: (10 + rnd() * 22) * K, ph: rnd() * TAU, sp: 0.3 + rnd() * 0.5 })
    }
    s.ash = Array.from({ length: Math.round(W / K / 26) }, () => ({ x: rnd() * W, y: rnd() * H, v: (8 + rnd() * 18) * K, r: (0.8 + rnd() * 1.6) * K, ph: rnd() * TAU }))
    s.eyes = []; s.nextEyes = 3
  },
  draw(s, t, dt) {
    const { g, W, H, K } = s
    g.clearRect(0, 0, W, H)
    // виньетка дышит
    const v = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75)
    v.addColorStop(0, 'rgba(10, 4, 20, 0)')
    v.addColorStop(1, `rgba(10, 4, 20, ${0.55 + 0.1 * Math.sin(t * 0.4)})`)
    g.fillStyle = v; g.fillRect(0, 0, W, H)
    g.lineCap = 'round'
    for (const k of s.tend) {
      const base = k.side === 0 ? [0, k.p * H] : k.side === 1 ? [W, k.p * H] : [k.p * W, H]
      const dir = k.side === 0 ? [1, 0] : k.side === 1 ? [-1, 0] : [0, -1]
      const reach = k.len * (0.7 + 0.3 * Math.sin(t * k.sp + k.ph))
      g.beginPath(); g.moveTo(base[0], base[1])
      for (let i = 1; i <= 10; i++) {
        const u = i / 10, wob = Math.sin(t * 1.3 + k.ph + u * 5) * 26 * K * u
        g.lineTo(base[0] + dir[0] * reach * u + dir[1] * wob, base[1] + dir[1] * reach * u + dir[0] * wob)
      }
      g.strokeStyle = 'rgba(24, 6, 40, .55)'; g.lineWidth = k.w; g.stroke()
      g.strokeStyle = 'rgba(120, 50, 190, .18)'; g.lineWidth = k.w * 0.25; g.stroke()
    }
    g.fillStyle = 'rgba(170, 110, 255, .4)'
    g.beginPath()
    for (const a of s.ash) { a.y += a.v * dt; if (a.y > H + 4) { a.y = -4; a.x = Math.random() * W } const x = a.x + Math.sin(t * 0.7 + a.ph) * 12 * K; g.moveTo(x + a.r, a.y); g.arc(x, a.y, a.r, 0, TAU) }
    g.fill()
    // глаза: появляются у края, моргают и пропадают
    if (!s.still && t > s.nextEyes) {
      const left = Math.random() < 0.5
      s.eyes.push({ x: left ? (30 + Math.random() * 90) * K : W - (30 + Math.random() * 90) * K, y: H * (0.25 + Math.random() * 0.6), t0: t, life: 3 + Math.random() * 2 })
      s.nextEyes = t + 5 + Math.random() * 6
    }
    s.eyes = s.eyes.filter(e => t - e.t0 < e.life)
    for (const e of s.eyes) {
      const u = (t - e.t0) / e.life, a = Math.min(1, u * 4, (1 - u) * 4)
      const blink = Math.abs(Math.sin((t - e.t0) * 2.1)) > 0.97 ? 0.15 : 1
      for (const dx of [-9, 9]) {
        glow(g, e.x + dx * K, e.y, 12 * K, '200, 80, 255', 0.35 * a)
        g.fillStyle = `rgba(240, 190, 255, ${0.9 * a})`
        g.beginPath(); g.ellipse(e.x + dx * K, e.y, 4 * K, 2.2 * K * blink, 0, 0, TAU); g.fill()
      }
    }
  }
}

/* ---------- порядок: вращающиеся золотые круги-печати, ровная сетка, пульс в такт ---------- */
const order = {
  build(s) {
    const e = s.edges()
    s.seals = [[e.treeL, s.H * 0.72, 1], [e.treeR, s.H * 0.72, -1], [s.W / 2, -s.H * 0.05, 1]].map(([x, y, d], i) => ({ x, y, d, r: (i === 2 ? 200 : 130) * s.K }))
  },
  draw(s, t) {
    const { g, W, H, K } = s
    g.clearRect(0, 0, W, H)
    const beat = Math.pow(1 - (t % 1), 4) // удар раз в секунду
    g.strokeStyle = `rgba(240, 200, 110, ${0.035 + 0.03 * beat})`; g.lineWidth = 1 * K
    g.beginPath()
    for (let x = wrap(W / 2, 48 * K); x < W; x += 48 * K) { g.moveTo(x, 0); g.lineTo(x, H) }
    for (let y = 0; y < H; y += 48 * K) { g.moveTo(0, y); g.lineTo(W, y) }
    g.stroke()
    for (const sl of s.seals) {
      g.save(); g.translate(sl.x, sl.y)
      glow(g, 0, 0, sl.r * 1.3, '255, 210, 120', 0.08 + 0.08 * beat)
      g.strokeStyle = `rgba(245, 210, 130, ${0.45 + 0.25 * beat})`; g.lineWidth = 1.5 * K
      for (const [f, sides, sp] of [[1, 0, 0.1], [0.82, 6, -0.2], [0.62, 4, 0.3], [0.42, 3, -0.45]]) {
        g.save(); g.rotate(t * sp * sl.d)
        const r = sl.r * f
        g.beginPath()
        if (!sides) { g.arc(0, 0, r, 0, TAU); for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU; g.moveTo(Math.cos(a) * r, Math.sin(a) * r); g.lineTo(Math.cos(a) * r * 0.93, Math.sin(a) * r * 0.93) } } else for (let i = 0; i <= sides; i++) { const a = (i / sides) * TAU - Math.PI / 2; i ? g.lineTo(Math.cos(a) * r, Math.sin(a) * r) : g.moveTo(Math.cos(a) * r, Math.sin(a) * r) }
        g.stroke(); g.restore()
      }
      g.restore()
    }
  }
}

/* ---------- хаос: летящие осколки, рывки, разрывы картинки ---------- */
const chaos = {
  build(s) {
    const { rnd, W, H, K } = s
    s.shards = Array.from({ length: Math.round(W / K / 40) + 6 }, () => ({ x: rnd() * W, y: rnd() * H, vx: (rnd() - 0.5) * 120 * K, vy: (rnd() - 0.5) * 120 * K, r: (5 + rnd() * 16) * K, rot: rnd() * TAU, sp: (rnd() - 0.5) * 6, c: Math.floor(rnd() * 3) }))
    s.tears = []; s.nextTear = 1
  },
  draw(s, t, dt) {
    const { g, W, H, K } = s
    g.clearRect(0, 0, W, H)
    const COL = ['255, 60, 120', '80, 230, 255', '255, 200, 60']
    for (const p of s.shards) {
      if (Math.random() < dt * 0.8) { p.vx = (Math.random() - 0.5) * 220 * K; p.vy = (Math.random() - 0.5) * 220 * K } // рывок в новую сторону
      p.x = wrap(p.x + p.vx * dt, W); p.y = wrap(p.y + p.vy * dt, H); p.rot += p.sp * dt
      g.save(); g.translate(p.x, p.y); g.rotate(p.rot)
      g.fillStyle = `rgba(${COL[p.c]}, .28)`; g.strokeStyle = `rgba(${COL[p.c]}, .7)`; g.lineWidth = 1 * K
      g.beginPath(); g.moveTo(0, -p.r); g.lineTo(p.r * 0.6, p.r * 0.7); g.lineTo(-p.r * 0.8, p.r * 0.3); g.closePath(); g.fill(); g.stroke()
      g.restore()
    }
    if (!s.still && t > s.nextTear) { s.tears.push({ y: Math.random() * H, h: (4 + Math.random() * 30) * K, dx: (Math.random() - 0.5) * 60 * K, life: 0.25, c: Math.floor(Math.random() * 3) }); s.nextTear = t + 0.3 + Math.random() * 1.8 }
    for (const tr of s.tears) {
      tr.life -= dt
      g.fillStyle = `rgba(${COL[tr.c]}, ${0.12 * Math.max(0, tr.life * 4)})`
      g.fillRect(tr.dx, tr.y, W, tr.h)
      g.fillStyle = `rgba(255, 255, 255, ${0.08 * Math.max(0, tr.life * 4)})`
      g.fillRect(0, tr.y + tr.h * 0.4, W, 1 * K)
    }
    s.tears = s.tears.filter(x => x.life > 0)
  }
}

/* ---------- призыв: круг с рунами внизу, частицы стягиваются и уходят столбом вверх ---------- */
const RUNES = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ'
const summon = {
  build(s) {
    const { rnd, W, H, K } = s
    s.cx = W / 2; s.cy = H * 0.9; s.R = Math.min(W * 0.32, 360 * K)
    s.parts = Array.from({ length: 70 }, () => ({ a: rnd() * TAU, d: rnd(), sp: 0.2 + rnd() * 0.4, up: 0 }))
  },
  draw(s, t, dt) {
    const { g, W, H, K, cx, cy, R } = s
    g.clearRect(0, 0, W, H)
    const pulse = 0.5 + 0.5 * Math.sin(t * 1.6)
    // столб света
    const col = g.createLinearGradient(0, cy, 0, 0)
    col.addColorStop(0, `rgba(170, 90, 255, ${0.14 + 0.08 * pulse})`); col.addColorStop(1, 'rgba(170, 90, 255, 0)')
    g.fillStyle = col; g.fillRect(cx - R * 0.35, 0, R * 0.7, cy)
    g.save(); g.translate(cx, cy); g.scale(1, 0.32)
    glow(g, 0, 0, R * 1.2, '170, 90, 255', 0.18 + 0.1 * pulse)
    g.strokeStyle = `rgba(200, 150, 255, ${0.5 + 0.3 * pulse})`; g.lineWidth = 2 * K
    for (const f of [1, 0.86]) { g.beginPath(); g.arc(0, 0, R * f, 0, TAU); g.stroke() }
    g.save(); g.rotate(t * 0.25)
    g.beginPath() // пятиконечная звезда
    for (let i = 0; i <= 5; i++) { const a = (i * 2 * TAU) / 5 - Math.PI / 2; i ? g.lineTo(Math.cos(a) * R * 0.84, Math.sin(a) * R * 0.84) : g.moveTo(Math.cos(a) * R * 0.84, Math.sin(a) * R * 0.84) }
    g.stroke(); g.restore()
    g.save(); g.rotate(-t * 0.15)
    g.fillStyle = `rgba(225, 200, 255, ${0.6 + 0.3 * pulse})`; g.font = `${Math.round(22 * K)}px serif`; g.textAlign = 'center'; g.textBaseline = 'middle'
    for (let i = 0; i < 18; i++) { const a = (i / 18) * TAU; g.save(); g.translate(Math.cos(a) * R * 0.93, Math.sin(a) * R * 0.93); g.rotate(a + Math.PI / 2); g.fillText(RUNES[i % RUNES.length], 0, 0); g.restore() }
    g.restore(); g.restore()
    // частицы: по спирали к центру, потом вверх
    g.fillStyle = 'rgba(220, 180, 255, .7)'
    g.beginPath()
    for (const p of s.parts) {
      if (p.up) { p.up += dt * 0.5; if (p.up > 1) { p.up = 0; p.d = 1; p.a = Math.random() * TAU } } else { p.d -= dt * p.sp * 0.4; p.a += dt * p.sp * 2; if (p.d <= 0.05) p.up = 0.01 }
      const x = p.up ? cx + Math.cos(p.a) * R * 0.05 : cx + Math.cos(p.a) * R * p.d
      const y = p.up ? cy - p.up * cy : cy + Math.sin(p.a) * R * p.d * 0.32
      g.moveTo(x + 1.6 * K, y); g.arc(x, y, 1.6 * K, 0, TAU)
    }
    g.fill()
  }
}

/* ---------- зачарование: всплывающие светящиеся руны, искры по орбитам ---------- */
const enchant = {
  build(s) {
    const { rnd, W, H, K } = s
    s.glyphs = Array.from({ length: Math.round(W / K / 70) + 6 }, () => ({ x: rnd() * W, y: rnd() * H, v: (8 + rnd() * 14) * K, ch: RUNES[Math.floor(rnd() * RUNES.length)], sz: (16 + rnd() * 22) * K, ph: rnd() * TAU, gold: rnd() < 0.35 }))
    s.orbs = Array.from({ length: 16 }, () => ({ cx: rnd() * W, cy: rnd() * H, r: (20 + rnd() * 60) * K, sp: (rnd() - 0.5) * 2, ph: rnd() * TAU }))
  },
  draw(s, t, dt) {
    const { g, W, H, K } = s
    g.clearRect(0, 0, W, H)
    g.textAlign = 'center'; g.textBaseline = 'middle'
    for (const r of s.glyphs) {
      r.y -= r.v * dt
      if (r.y < -40 * K) { r.y = H + 40 * K; r.x = Math.random() * W }
      const a = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(t * 1.2 + r.ph))
      const col = r.gold ? '245, 210, 120' : '110, 240, 220'
      glow(g, r.x, r.y, r.sz * 1.3, col, a * 0.35)
      g.fillStyle = `rgba(${col}, ${a})`; g.font = `${Math.round(r.sz)}px serif`
      g.fillText(r.ch, r.x + Math.sin(t * 0.6 + r.ph) * 10 * K, r.y)
    }
    g.globalCompositeOperation = 'lighter'
    for (const o of s.orbs) {
      for (let k = 0; k < 6; k++) { // искра с хвостом
        const a = t * o.sp + o.ph - k * 0.08
        g.fillStyle = `rgba(150, 255, 230, ${0.5 * (1 - k / 6)})`
        g.beginPath(); g.arc(o.cx + Math.cos(a) * o.r, o.cy + Math.sin(a) * o.r * 0.5, (2 - k * 0.25) * K, 0, TAU); g.fill()
      }
    }
    g.globalCompositeOperation = 'source-over'
  }
}

/* ---------- разум: плавающие узлы, связи между близкими, бегущие по ним импульсы ---------- */
const mind = {
  build(s) {
    const { rnd, W, H, K } = s
    s.nodes = Array.from({ length: Math.round((W / K) * (H / K) / 10000) + 22 }, () => ({ x: rnd() * W, y: rnd() * H, vx: (rnd() - 0.5) * 14 * K, vy: (rnd() - 0.5) * 14 * K, ph: rnd() * TAU }))
    s.pulses = []
  },
  draw(s, t, dt) {
    const { g, W, H, K } = s
    g.clearRect(0, 0, W, H)
    const N = s.nodes, D = 200 * K
    for (const n of N) { n.x = wrap(n.x + n.vx * dt, W); n.y = wrap(n.y + n.vy * dt, H) }
    g.lineWidth = 1 * K
    const links = []
    for (let i = 0; i < N.length; i++) for (let j = i + 1; j < N.length; j++) {
      const d = Math.hypot(N[i].x - N[j].x, N[i].y - N[j].y)
      if (d < D) { links.push([i, j]); g.strokeStyle = `rgba(230, 120, 255, ${0.42 * (1 - d / D)})`; g.beginPath(); g.moveTo(N[i].x, N[i].y); g.lineTo(N[j].x, N[j].y); g.stroke() }
    }
    if (!s.still && links.length && Math.random() < dt * 4) { const [i, j] = links[Math.floor(Math.random() * links.length)]; s.pulses.push({ i, j, u: 0 }) }
    for (const p of s.pulses) {
      p.u += dt * 0.9
      const a = N[p.i], b = N[p.j], x = a.x + (b.x - a.x) * p.u, y = a.y + (b.y - a.y) * p.u
      glow(g, x, y, 10 * K, '120, 230, 255', 0.6 * Math.sin(Math.min(1, p.u) * Math.PI))
    }
    s.pulses = s.pulses.filter(p => p.u < 1)
    for (const n of N) {
      const a = 0.5 + 0.5 * Math.sin(t * 2 + n.ph)
      glow(g, n.x, n.y, 9 * K, '240, 150, 255', 0.25 * a)
      g.fillStyle = `rgba(255, 220, 255, ${0.5 + 0.4 * a})`; g.beginPath(); g.arc(n.x, n.y, 2 * K, 0, TAU); g.fill()
    }
  }
}

/* ---------- аркана: звёздное небо, туманности, созвездия складываются линиями, падающие звёзды ---------- */
const arcana = {
  build(s) {
    const { rnd, W, H, K } = s
    s.sky = document.createElement('canvas'); s.sky.width = W; s.sky.height = H
    const sg = s.sky.getContext('2d')
    for (const [c, n] of [['90, 60, 200', 5], ['40, 120, 220', 4], ['200, 70, 160', 3]]) for (let i = 0; i < n; i++) glow(sg, rnd() * W, rnd() * H, (160 + rnd() * 260) * K, c, 0.07)
    s.stars = Array.from({ length: Math.round((W / K) * (H / K) / 2600) }, () => ({ x: rnd() * W, y: rnd() * H, r: (0.4 + rnd() * 1.3) * K, ph: rnd() * TAU, sp: 0.5 + rnd() * 2 }))
    s.consts = []; s.nextConst = 0.5; s.meteors = []; s.nextMeteor = 3
  },
  draw(s, t, dt) {
    const { g, W, H, K } = s
    g.clearRect(0, 0, W, H)
    g.drawImage(s.sky, 0, 0)
    for (const st of s.stars) { const a = 0.35 + 0.5 * (0.5 + 0.5 * Math.sin(t * st.sp + st.ph)); g.fillStyle = `rgba(230, 235, 255, ${a})`; g.fillRect(st.x, st.y, st.r * 1.4, st.r * 1.4) }
    if (!s.still && t > s.nextConst) {
      const cx = W * (0.1 + Math.random() * 0.8), cy = H * (0.1 + Math.random() * 0.7), pts = []
      let x = cx, y = cy
      for (let i = 0; i < 5 + Math.floor(Math.random() * 3); i++) { pts.push([x, y]); x += (Math.random() - 0.5) * 120 * K; y += (Math.random() - 0.5) * 90 * K }
      s.consts.push({ pts, t0: t }); s.nextConst = t + 2.5 + Math.random() * 2
    }
    s.consts = s.consts.filter(c => t - c.t0 < 9)
    g.lineWidth = 1.2 * K
    for (const c of s.consts) {
      const age = t - c.t0, grow = Math.min(1, age / 3), fade = age > 6 ? 1 - (age - 6) / 3 : 1
      const segs = (c.pts.length - 1) * grow
      g.strokeStyle = `rgba(190, 200, 255, ${0.45 * fade})`
      g.beginPath(); g.moveTo(c.pts[0][0], c.pts[0][1])
      for (let i = 1; i <= Math.ceil(segs); i++) { const u = Math.min(1, segs - (i - 1)), [ax, ay] = c.pts[i - 1], [bx, by] = c.pts[i]; g.lineTo(ax + (bx - ax) * u, ay + (by - ay) * u) }
      g.stroke()
      for (let i = 0; i <= Math.floor(segs); i++) { glow(g, c.pts[i][0], c.pts[i][1], 9 * K, '210, 220, 255', 0.6 * fade); g.fillStyle = `rgba(255, 255, 255, ${fade})`; g.beginPath(); g.arc(c.pts[i][0], c.pts[i][1], 2.2 * K, 0, TAU); g.fill() }
    }
    if (!s.still && t > s.nextMeteor) { s.meteors.push({ x: Math.random() * W, y: Math.random() * H * 0.4, life: 1 }); s.nextMeteor = t + 4 + Math.random() * 6 }
    for (const m of s.meteors) {
      m.life -= dt * 1.4; m.x += 520 * K * dt; m.y += 260 * K * dt
      const gr = g.createLinearGradient(m.x - 110 * K, m.y - 55 * K, m.x, m.y)
      gr.addColorStop(0, 'rgba(255, 255, 255, 0)'); gr.addColorStop(1, `rgba(255, 255, 255, ${Math.max(0, m.life)})`)
      g.strokeStyle = gr; g.lineWidth = 1.6 * K; g.beginPath(); g.moveTo(m.x - 110 * K, m.y - 55 * K); g.lineTo(m.x, m.y); g.stroke()
    }
    s.meteors = s.meteors.filter(m => m.life > 0)
  }
}

/* ---------- гримуар: парящие страницы, спокойные свечи с потёками воска и дымком в нижних углах ---------- */
const grimoire = {
  build(s) {
    const { rnd, W, H, K } = s
    const e = s.edges()
    // по три свечи в каждом нижнем углу: разной толщины и высоты, с потёками воска
    s.candles = []
    for (const ax of [e.treeL, e.treeR]) {
      for (const [dx, hh, ww] of [[-34, 62, 13], [0, 96, 16], [30, 44, 11]]) {
        const w = ww * K * (0.9 + rnd() * 0.2), h = hh * K * (0.85 + rnd() * 0.3)
        s.candles.push({ x: ax + dx * K, w, h, ph: rnd() * TAU, drips: Array.from({ length: 2 + Math.floor(rnd() * 2) }, () => ({ u: rnd() * 1.6 - 0.8, l: (6 + rnd() * 18) * K })), next: 3 + rnd() * 6 })
      }
    }
    s.pools = [e.treeL, e.treeR]
    s.smoke = []
    s.pages = Array.from({ length: 9 }, () => ({ x: rnd() * W, y: rnd() * H, w: (40 + rnd() * 30) * K, rot: rnd() * TAU, sp: (rnd() - 0.5) * 0.4, vy: -(6 + rnd() * 10) * K, ph: rnd() * TAU }))
  },
  draw(s, t, dt) {
    const { g, W, H, K } = s
    g.clearRect(0, 0, W, H)
    for (const p of s.pages) {
      p.y += p.vy * dt; p.rot += p.sp * dt
      if (p.y < -80 * K) { p.y = H + 80 * K; p.x = Math.random() * W }
      g.save(); g.translate(p.x + Math.sin(t * 0.4 + p.ph) * 20 * K, p.y); g.rotate(p.rot)
      const w = p.w, h = w * 1.35, flap = 0.85 + 0.15 * Math.sin(t * 2 + p.ph)
      g.fillStyle = 'rgba(232, 214, 170, .16)'; g.strokeStyle = 'rgba(232, 214, 170, .35)'; g.lineWidth = 1 * K
      g.beginPath(); g.rect(-w / 2 * flap, -h / 2, w * flap, h); g.fill(); g.stroke()
      g.strokeStyle = 'rgba(120, 60, 40, .35)'
      g.beginPath(); for (let i = 1; i < 7; i++) { const y = -h / 2 + (h * i) / 7; g.moveTo(-w / 2 * flap + 5 * K, y); g.lineTo(w / 2 * flap - 5 * K, y) } g.stroke()
      g.restore()
    }
    // тёплое пятно света на «столе» под свечами — дышит медленно
    for (const x of s.pools) glow(g, x, H, 170 * K, '255, 170, 80', 0.09 + 0.015 * Math.sin(t * 0.7 + x))
    // дымок: изредка тонкая струйка поднимается и тает
    g.lineCap = 'round'
    for (const m of s.smoke) {
      m.age += dt
      const u = m.age / m.life
      g.strokeStyle = `rgba(200, 190, 180, ${0.1 * Math.sin(Math.min(1, u) * Math.PI)})`; g.lineWidth = (1 + u * 3) * K
      g.beginPath()
      for (let i = 0; i <= 10; i++) { const k = i / 10, y = m.y - k * 70 * K * Math.min(1, u * 1.6), x = m.x + Math.sin(k * 5 + t * 0.8 + m.ph) * 6 * K * k; i ? g.lineTo(x, y) : g.moveTo(x, y) }
      g.stroke()
    }
    s.smoke = s.smoke.filter(m => m.age < m.life)
    for (const c of s.candles) {
      const top = H - c.h, hw = c.w / 2
      // воск: объём — тень по краям, свет посередине; оплывший край и потёки
      const wax = g.createLinearGradient(c.x - hw, 0, c.x + hw, 0)
      wax.addColorStop(0, 'rgba(120, 92, 66, .95)'); wax.addColorStop(0.45, 'rgba(236, 222, 190, .97)'); wax.addColorStop(1, 'rgba(150, 118, 86, .95)')
      g.fillStyle = wax
      g.beginPath(); g.roundRect(c.x - hw, top, c.w, c.h + 4 * K, [hw * 0.5, hw * 0.5, 0, 0]); g.fill()
      for (const d of c.drips) { g.beginPath(); g.roundRect(c.x + d.u * hw * 0.8 - 1.6 * K, top, 3.2 * K, d.l, 1.6 * K); g.fill() }
      g.fillStyle = 'rgba(250, 238, 205, .6)'
      g.beginPath(); g.ellipse(c.x, top + 1.5 * K, hw * 0.92, 2.6 * K, 0, 0, TAU); g.fill()
      // фитиль
      g.strokeStyle = 'rgba(40, 28, 20, .95)'; g.lineWidth = 1.4 * K
      g.beginPath(); g.moveTo(c.x, top + 1 * K); g.lineTo(c.x, top - 4 * K); g.stroke()
      // пламя: капля, медленно колышется и дышит (без частого мерцания)
      const sway = (Math.sin(t * 0.9 + c.ph) * 0.7 + Math.sin(t * 1.7 + c.ph * 1.3) * 0.3) * 2.2 * K
      const fh = (16 + 6 * (c.w / (16 * K))) * K * (1 + 0.05 * Math.sin(t * 1.1 + c.ph) + 0.03 * Math.sin(t * 2.3 + c.ph * 2))
      const fw = fh * 0.32, bx = c.x, by = top - 3 * K
      glow(g, bx + sway * 0.4, by - fh * 0.45, fh * 3.2, '255, 180, 90', 0.16 + 0.02 * Math.sin(t * 0.8 + c.ph))
      const fg = g.createRadialGradient(bx + sway * 0.3, by - fh * 0.28, 0, bx + sway * 0.3, by - fh * 0.35, fh)
      fg.addColorStop(0, 'rgba(255, 252, 235, .97)'); fg.addColorStop(0.28, 'rgba(255, 226, 150, .92)'); fg.addColorStop(0.62, 'rgba(255, 150, 55, .55)'); fg.addColorStop(1, 'rgba(255, 100, 30, 0)')
      g.fillStyle = fg
      g.beginPath(); g.moveTo(bx, by + fw * 0.35)
      g.bezierCurveTo(bx - fw * 1.1, by - fh * 0.12, bx - fw * 0.55 + sway * 0.5, by - fh * 0.62, bx + sway, by - fh)
      g.bezierCurveTo(bx + fw * 0.55 + sway * 0.5, by - fh * 0.62, bx + fw * 1.1, by - fh * 0.12, bx, by + fw * 0.35)
      g.fill()
      g.fillStyle = 'rgba(120, 160, 255, .22)' // синеватое основание пламени
      g.beginPath(); g.ellipse(bx, by - fh * 0.05, fw * 0.45, fh * 0.12, 0, 0, TAU); g.fill()
      if (!s.still && t > c.next) { s.smoke.push({ x: bx + sway, y: by - fh, age: 0, life: 3 + Math.random() * 2, ph: Math.random() * TAU }); c.next = t + 6 + Math.random() * 8 }
    }
  }
}

export const SCENES = { air, earth, light, dark, order, chaos, summon, enchant, mind, arcana, grimoire }
