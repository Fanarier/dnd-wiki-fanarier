// Живые фоны школ магии (canvas 2D) — у каждой школы свой: ветер, камни, магма, лучи света, тени, знаки порядка,
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
    // щупальца: из краёв; кончик медленно тянется к мыши, если она недалеко (s.mouse — из MagicBackdrop), иначе колышется
    const m = s.mouse
    for (const k of s.tend) {
      const base = k.side === 0 ? [0, k.p * H] : k.side === 1 ? [W, k.p * H] : [k.p * W, H]
      const dir = k.side === 0 ? [1, 0] : k.side === 1 ? [-1, 0] : [0, -1]
      const reach = k.len * (0.7 + 0.3 * Math.sin(t * k.sp + k.ph))
      let tx = base[0] + dir[0] * reach, ty = base[1] + dir[1] * reach
      if (m) {
        const dx = m.x - base[0], dy = m.y - base[1], d = Math.hypot(dx, dy), max = k.len * 1.35
        // тянутся только «смотрящие» в сторону мыши и те, до кого она близко
        if (d < k.len * 2.4 && dx * dir[0] + dy * dir[1] > 0) { const q = Math.min(1, max / d); tx = base[0] + dx * q * 0.92; ty = base[1] + dy * q * 0.92 }
      }
      if (k.ex == null) { k.ex = tx; k.ey = ty }
      const ease = Math.min(1, dt * 0.7) // медленно, вязко
      k.ex += (tx - k.ex) * ease; k.ey += (ty - k.ey) * ease
      // изгиб: сначала выходит из края по своему направлению, потом заворачивает к кончику
      const cx = base[0] + dir[0] * reach * 0.45, cy = base[1] + dir[1] * reach * 0.45
      let px = base[0], py = base[1]
      for (let i = 1; i <= 14; i++) {
        const u = i / 14, iu = 1 - u
        const bx = iu * iu * base[0] + 2 * iu * u * cx + u * u * k.ex, by = iu * iu * base[1] + 2 * iu * u * cy + u * u * k.ey
        const wob = Math.sin(t * 1.3 + k.ph + u * 5) * 18 * K * u * (1 - u * 0.4)
        const x = bx + dir[1] * wob + Math.cos(t * 0.9 + u * 4 + k.ph) * 6 * K * u, y = by + dir[0] * wob
        const w = k.w * (1 - u * 0.85) // к кончику тоньше
        g.strokeStyle = 'rgba(24, 6, 40, .55)'; g.lineWidth = w
        g.beginPath(); g.moveTo(px, py); g.lineTo(x, y); g.stroke()
        g.strokeStyle = 'rgba(150, 70, 230, .38)'; g.lineWidth = w * 0.28
        g.beginPath(); g.moveTo(px, py); g.lineTo(x, y); g.stroke()
        px = x; py = y
      }
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
        s.candles.push({ x: ax + dx * K, w, h, ph: rnd() * TAU, drips: Array.from({ length: 2 + Math.floor(rnd() * 2) }, () => ({ u: rnd() * 1.6 - 0.8, l: (6 + rnd() * 18) * K })),
          // свежая капля медленно стекает по боку, у конца — бусина; дотекла — застывает и бледнеет, потом новая
          flow: { u: rnd() * 1.4 - 0.7, t0: -rnd() * 20, dur: 18 + rnd() * 16, max: Math.min(h * 0.7, (24 + rnd() * 40) * K) },
          smokeAt: 4 + rnd() * 10, smokeTill: 0, puffAt: 0 })
      }
    }
    s.pools = [e.treeL, e.treeR]
    s.smoke = []
    // мягкий клуб дыма — один раз, дальше рисуется картинкой (дёшево)
    s.puff = document.createElement('canvas'); s.puff.width = s.puff.height = 64
    const pg = s.puff.getContext('2d'), pr = pg.createRadialGradient(32, 32, 0, 32, 32, 32)
    pr.addColorStop(0, 'rgba(205, 198, 190, .55)'); pr.addColorStop(0.5, 'rgba(190, 184, 178, .22)'); pr.addColorStop(1, 'rgba(180, 175, 170, 0)')
    pg.fillStyle = pr; pg.fillRect(0, 0, 64, 64)
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
    // дым: мягкие клубы поднимаются, расплываются и закручиваются, тают — как от настоящей свечи (изредка, не от всех сразу)
    for (const m of s.smoke) {
      m.age += dt
      const u = m.age / m.life
      m.y -= (20 + 10 * (1 - u)) * K * dt
      m.x += (Math.sin(m.age * 1.3 + m.ph) * 9 + m.drift) * K * dt
      const r = (2.5 + u * 14) * K, a = 0.3 * Math.min(1, m.age * 2.5) * (1 - u) * (1 - u)
      if (a <= 0.003) continue
      g.globalAlpha = a
      g.drawImage(s.puff, m.x - r, m.y - r, r * 2, r * 2)
    }
    g.globalAlpha = 1
    s.smoke = s.smoke.filter(m => m.age < m.life)
    for (const c of s.candles) {
      const top = H - c.h, hw = c.w / 2
      // воск: объём — тень по краям, свет посередине; оплывший край и потёки
      const wax = g.createLinearGradient(c.x - hw, 0, c.x + hw, 0)
      wax.addColorStop(0, 'rgba(120, 92, 66, .95)'); wax.addColorStop(0.45, 'rgba(236, 222, 190, .97)'); wax.addColorStop(1, 'rgba(150, 118, 86, .95)')
      g.fillStyle = wax
      g.beginPath(); g.roundRect(c.x - hw, top, c.w, c.h + 4 * K, [hw * 0.5, hw * 0.5, 0, 0]); g.fill()
      for (const d of c.drips) { g.beginPath(); g.roundRect(c.x + d.u * hw * 0.8 - 1.6 * K, top, 3.2 * K, d.l, 1.6 * K); g.fill() }
      // стекающая капля: растёт с замедлением, на конце бусина с бликом; потом застывает и уходит, начинается новая
      const f = c.flow, age = t - f.t0, life = f.dur + 8
      if (!s.still && age > life) { f.t0 = t; f.u = Math.random() * 1.4 - 0.7; f.dur = 18 + Math.random() * 16 }
      const pr = Math.min(1, Math.max(0, age) / f.dur), len = f.max * (1 - Math.pow(1 - pr, 2.2))
      const fade = age > f.dur ? Math.max(0, 1 - (age - f.dur) / 8) : 1
      if (len > 1 * K && fade > 0) {
        const fx = c.x + f.u * hw * 0.85, bead = (2.1 + 0.5 * Math.sin(t * 1.4 + c.ph)) * K
        const dg = g.createLinearGradient(fx - 2 * K, 0, fx + 2 * K, 0)
        dg.addColorStop(0, `rgba(170, 140, 105, ${0.95 * fade})`); dg.addColorStop(0.5, `rgba(252, 242, 215, ${0.97 * fade})`); dg.addColorStop(1, `rgba(185, 155, 118, ${0.95 * fade})`)
        // тень справа — капля выпуклая, видна и на светлом воске
        g.fillStyle = `rgba(95, 66, 44, ${0.45 * fade})`
        g.beginPath(); g.roundRect(fx - 0.6 * K, top, 3.4 * K, len, 1.7 * K); g.fill()
        g.beginPath(); g.ellipse(fx + 0.9 * K, top + len + 0.8 * K, bead * 0.95, bead * 1.2, 0, 0, TAU); g.fill()
        g.fillStyle = dg
        g.beginPath(); g.roundRect(fx - 1.6 * K, top - 1 * K, 3.2 * K, len, 1.6 * K); g.fill()
        g.beginPath(); g.ellipse(fx, top + len, bead * 0.95, bead * 1.2, 0, 0, TAU); g.fill()
        g.fillStyle = `rgba(255, 252, 240, ${0.5 * fade})` // мокрый блик вдоль капли
        g.fillRect(fx - 1 * K, top, 0.8 * K, len * 0.9)
        g.fillStyle = `rgba(255, 255, 245, ${0.55 * fade})` // блик на бусине
        g.beginPath(); g.arc(fx - bead * 0.3, top + len - bead * 0.35, bead * 0.35, 0, TAU); g.fill()
      }
      // лужица растопленного воска сверху — блик медленно скользит
      g.fillStyle = 'rgba(250, 238, 205, .6)'
      g.beginPath(); g.ellipse(c.x, top + 1.5 * K, hw * 0.92, 2.6 * K, 0, 0, TAU); g.fill()
      g.fillStyle = `rgba(255, 245, 210, ${0.35 + 0.15 * Math.sin(t * 0.6 + c.ph)})`
      g.beginPath(); g.ellipse(c.x + Math.sin(t * 0.35 + c.ph) * hw * 0.4, top + 1.2 * K, hw * 0.3, 1.1 * K, 0, 0, TAU); g.fill()
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
      // дымит изредка: несколько секунд подряд тонкой струйкой, потом долго нет
      if (!s.still && t > c.smokeAt) { c.smokeTill = t + 3 + Math.random() * 3; c.smokeAt = t + 12 + Math.random() * 16 }
      if (!s.still && t < c.smokeTill && t > c.puffAt) {
        s.smoke.push({ x: bx + sway, y: by - fh * 0.95, age: 0, life: 3.2 + Math.random() * 1.6, ph: Math.random() * TAU, drift: (Math.random() - 0.5) * 6 })
        c.puffAt = t + 0.06
      }
    }
  }
}

/* ---------- магма: обсидиановые шпили в нижних углах с раскалёнными прожилками, стекающая лава,
   лавовое озеро внизу (течёт, корка, лопаются пузыри), искры вверх, пепел вниз ---------- */
const magma = {
  build(s) {
    const { rnd, W, H, K } = s
    const e = s.edges()
    const big = Math.min(H * 0.42, 340 * K) * (W / K > 700 ? 1 : 0.7)
    s.poolH = 20 * K
    s.shards = []
    for (const ax of [e.treeL, e.treeR]) {
      for (const [n, scale, spread] of [[7, 1, 1.4], [6, 0.45, 2]]) {
        for (let i = 0; i < n; i++) {
          const sp = (i / (n - 1) - 0.5) * spread + (rnd() - 0.5) * 0.16
          const len = big * scale * (1 - Math.abs(sp) * 0.45) * (0.6 + rnd() * 0.45)
          const ang = -Math.PI / 2 + sp, dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx
          const bx = ax + sp * 50 * K + (rnd() - 0.5) * 20 * K, by = H - s.poolH * 0.4, hw = len * (0.09 + rnd() * 0.05)
          const j = () => (rnd() - 0.5) * hw * 0.5
          const pts = [[bx - nx * hw, by - ny * hw], [bx + dx * len * 0.55 - nx * (hw * 0.8 + j()), by + dy * len * 0.55 - ny * (hw * 0.8 + j())],
            [bx + dx * len, by + dy * len], [bx + dx * len * 0.6 + nx * (hw * 0.75 + j()), by + dy * len * 0.6 + ny * (hw * 0.75 + j())], [bx + nx * hw, by + ny * hw]]
          // прожилка: от основания по оси вверх, с изломами
          const vein = []
          const top = 0.55 + rnd() * 0.25
          for (let k = 0; k <= 7; k++) { const u = (k / 7) * top, o = (rnd() - 0.5) * hw * 0.7; vein.push([bx + dx * len * u + nx * o, by + dy * len * u + ny * o]) }
          s.shards.push({ pts, vein, len, bx, by, dx, dy, nx, ny, hw, ph: rnd() * TAU, flow: scale === 1 && rnd() < 0.45 })
        }
      }
    }
    s.shards.sort((a, b) => b.len - a.len)
    // шпили — один раз в отдельный холст: тёмный базальт, грань в тени, раскалённый низ, холодный блеск обсидиана
    s.rock = document.createElement('canvas'); s.rock.width = W; s.rock.height = H
    const rg = s.rock.getContext('2d')
    const poly = (c, p) => { c.beginPath(); p.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath() }
    for (const sh of s.shards) {
      const tip = sh.pts[2]
      const gr = rg.createLinearGradient(sh.bx, sh.by, tip[0], tip[1])
      gr.addColorStop(0, 'rgba(70, 22, 12, .97)'); gr.addColorStop(0.35, 'rgba(26, 12, 12, .97)'); gr.addColorStop(1, 'rgba(40, 30, 40, .95)')
      poly(rg, sh.pts); rg.fillStyle = gr; rg.fill()
      poly(rg, [sh.pts[0], sh.pts[1], sh.pts[2], [sh.bx, sh.by]]); rg.fillStyle = 'rgba(0, 0, 0, .35)'; rg.fill()
      poly(rg, sh.pts); rg.strokeStyle = 'rgba(160, 120, 150, .18)'; rg.lineWidth = 1 * K; rg.stroke()
      rg.strokeStyle = 'rgba(255, 255, 255, .1)'; rg.beginPath(); rg.moveTo(sh.bx, sh.by); rg.lineTo(tip[0], tip[1]); rg.stroke()
    }
    // корка на озере: тёмные пятна дрейфуют
    s.crust = Array.from({ length: Math.round(W / K / 45) }, () => ({ x: rnd() * W, w: (20 + rnd() * 60) * K, v: (4 + rnd() * 8) * K, ph: rnd() * TAU }))
    s.embers = []
    s.ash = Array.from({ length: Math.round(W / K / 40) }, () => ({ x: rnd() * W, y: rnd() * H, v: (6 + rnd() * 10) * K, r: (0.8 + rnd() * 1.4) * K, ph: rnd() * TAU }))
    s.bubbles = []; s.nextBubble = 0.5
  },
  draw(s, t, dt) {
    const { g, W, H, K } = s
    g.clearRect(0, 0, W, H)
    const top = H - s.poolH
    const surf = x => top + Math.sin(x * 0.011 / K + t * 0.6) * 3 * K + Math.sin(x * 0.027 / K - t * 0.9) * 1.6 * K
    // жар снизу — медленно дышит
    const heat = g.createLinearGradient(0, H, 0, H - 260 * K)
    heat.addColorStop(0, `rgba(255, 90, 20, ${0.22 + 0.04 * Math.sin(t * 0.5)})`); heat.addColorStop(1, 'rgba(255, 60, 10, 0)')
    g.fillStyle = heat; g.fillRect(0, H - 260 * K, W, 260 * K)
    // пепел падает
    g.fillStyle = 'rgba(90, 80, 80, .5)'
    g.beginPath()
    for (const a of s.ash) {
      a.y += a.v * dt
      if (a.y > H) { a.y = -4; a.x = Math.random() * W }
      const x = a.x + Math.sin(t * 0.6 + a.ph) * 14 * K
      g.moveTo(x + a.r, a.y); g.arc(x, a.y, a.r, 0, TAU)
    }
    g.fill()
    // шпили и раскалённые прожилки в них — медленный пульс жара
    g.drawImage(s.rock, 0, 0)
    g.globalCompositeOperation = 'lighter'
    g.lineCap = 'round'; g.lineJoin = 'round'
    for (const sh of s.shards) {
      const p = 0.55 + 0.45 * Math.sin(t * 0.8 + sh.ph)
      for (const [w, col, a] of [[7, '255, 80, 20', 0.16], [2.6, '255, 150, 50', 0.55], [1, '255, 230, 150', 0.8]]) {
        g.strokeStyle = `rgba(${col}, ${a * p})`; g.lineWidth = w * K
        g.beginPath(); sh.vein.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke()
      }
      // лава стекает по боку шпиля: сгустки бегут вниз
      if (sh.flow) {
        const u0 = 0.62, sx = sh.bx + sh.dx * sh.len * u0 + sh.nx * sh.hw * 0.5, sy = sh.by + sh.dy * sh.len * u0 + sh.ny * sh.hw * 0.5
        const ex = sh.bx + sh.nx * sh.hw * 0.9, ey = sh.by, cx = (sx + ex) / 2 + sh.nx * sh.hw * 0.6, cy = (sy + ey) / 2
        g.strokeStyle = 'rgba(255, 90, 20, .5)'; g.lineWidth = 4 * K
        g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo(cx, cy, ex, ey); g.stroke()
        g.strokeStyle = 'rgba(255, 200, 90, .6)'; g.lineWidth = 1.6 * K; g.stroke()
        for (let k = 0; k < 3; k++) {
          const u = (t * 0.12 + k / 3 + sh.ph) % 1, iu = 1 - u
          glow(g, iu * iu * sx + 2 * iu * u * cx + u * u * ex, iu * iu * sy + 2 * iu * u * cy + u * u * ey, 7 * K, '255, 210, 120', 0.6)
        }
      }
    }
    // лавовое озеро: течёт, по нему дрейфует тёмная корка
    g.globalCompositeOperation = 'source-over'
    const lava = g.createLinearGradient(0, top - 4 * K, 0, H)
    lava.addColorStop(0, 'rgba(255, 190, 80, .95)'); lava.addColorStop(0.4, 'rgba(255, 110, 30, .95)'); lava.addColorStop(1, 'rgba(150, 30, 10, .95)')
    g.fillStyle = lava
    g.beginPath(); g.moveTo(0, H)
    for (let x = 0; x <= W; x += 12 * K) g.lineTo(x, surf(x))
    g.lineTo(W, H); g.closePath(); g.fill()
    g.fillStyle = 'rgba(45, 14, 8, .55)'
    for (const c of s.crust) {
      c.x = (c.x + c.v * dt) % (W + c.w)
      const y = surf(c.x) + s.poolH * 0.45
      g.beginPath(); g.ellipse(c.x - c.w / 2, y, c.w / 2, s.poolH * (0.18 + 0.06 * Math.sin(t * 0.7 + c.ph)), 0, 0, TAU); g.fill()
    }
    // пузыри: вспухают и лопаются брызгами
    if (!s.still && t > s.nextBubble) { s.bubbles.push({ x: Math.random() * W, t0: t, r: (4 + Math.random() * 6) * K, drops: [] }); s.nextBubble = t + 0.5 + Math.random() * 1.2 }
    g.globalCompositeOperation = 'lighter'
    for (const b of s.bubbles) {
      const a = t - b.t0, y = surf(b.x)
      if (a < 1.1) {
        const r = b.r * Math.min(1, a / 1.1)
        g.fillStyle = 'rgba(255, 170, 60, .55)'
        g.beginPath(); g.ellipse(b.x, y, r, r * 0.8, 0, Math.PI, TAU); g.fill()
        g.fillStyle = 'rgba(255, 240, 180, .5)'
        g.beginPath(); g.arc(b.x - r * 0.3, y - r * 0.45, r * 0.22, 0, TAU); g.fill()
      } else {
        if (!b.drops.length) b.drops = Array.from({ length: 5 }, () => ({ vx: (Math.random() - 0.5) * 70 * K, vy: -(60 + Math.random() * 60) * K }))
        const u = a - 1.1
        g.strokeStyle = `rgba(255, 200, 100, ${Math.max(0, 0.6 - u)})`; g.lineWidth = 1.4 * K
        g.beginPath(); g.ellipse(b.x, y, b.r * (1 + u * 3), b.r * 0.35 * (1 + u * 2), 0, 0, TAU); g.stroke()
        for (const d of b.drops) { const x = b.x + d.vx * u, yy = y + d.vy * u + 160 * K * u * u; if (yy < y + 2 * K) glow(g, x, yy, 4 * K, '255, 170, 70', 0.8) }
      }
    }
    s.bubbles = s.bubbles.filter(b => t - b.t0 < 2)
    // искры: из озера и от шпилей вверх, мерцают и гаснут
    if (!s.still) for (let i = 0; i < 2; i++) if (Math.random() < dt * 9) {
      const sh = Math.random() < 0.4 ? s.shards[Math.floor(Math.random() * s.shards.length)] : null
      const u = Math.random() * 0.7
      s.embers.push({ x: sh ? sh.bx + sh.dx * sh.len * u : Math.random() * W, y: sh ? sh.by + sh.dy * sh.len * u : top, vy: (30 + Math.random() * 50) * K, life: 2 + Math.random() * 3, age: 0, ph: Math.random() * TAU, r: (0.8 + Math.random() * 1.4) * K })
    }
    for (const m of s.embers) {
      m.age += dt; m.y -= m.vy * dt; m.x += Math.sin(m.age * 2 + m.ph) * 14 * K * dt
      const u = m.age / m.life, fl = 0.7 + 0.3 * Math.sin(t * 9 + m.ph)
      const col = u < 0.35 ? '255, 220, 140' : u < 0.7 ? '255, 150, 60' : '220, 70, 30'
      glow(g, m.x, m.y, m.r * 5, col, 0.35 * (1 - u) * fl)
      g.fillStyle = `rgba(${col}, ${(1 - u) * fl})`; g.beginPath(); g.arc(m.x, m.y, m.r, 0, TAU); g.fill()
    }
    s.embers = s.embers.filter(m => m.age < m.life)
    g.globalCompositeOperation = 'source-over'
  }
}

export const SCENES = { air, earth, magma, light, dark, order, chaos, summon, enchant, mind, arcana, grimoire }
