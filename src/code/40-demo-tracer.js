// Tracer + muzzle flash + percikan tumbukan. Klik = tembak ke arah kursor (idle: tembak otomatis).
PX.demos.tracer = (host) => {
  const W = 160, H = 90, GY = 76, cv = PX.canvas(host, W, H, 640, false), c = cv.getContext('2d'), p = PX.pointer(cv);
  const GUN = { x: 16, y: 60 }, CORE = '#fffbd0', MIDS = '#ffd24a', DARK = '#a8841f';
  const bl = [], sp = [], fl = []; let cd = 0, kick = 0, ang = 0;
  const rays = (x, y, a, n, len, col) => { for (let i = 0; i < n; i++) { const q = a + (Math.random() - 0.5) * 1.3, l = len * (0.4 + Math.random() * 0.6); PX.line(c, x, y, x + Math.cos(q) * l, y + Math.sin(q) * l, col); } };
  const glow = (x, y, r, col) => { c.fillStyle = col; for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) { const d = Math.hypot(i, j) / r; if (d <= 1 && (1 - d) * 0.55 > PX.bayer(x + i, y + j)) c.fillRect(x + i, y + j, 1, 1); } };
  const fire = (a) => { bl.push({ x: GUN.x + Math.cos(a) * 9, y: GUN.y + Math.sin(a) * 9, a, trav: 0 }); fl.push({ t: 0, a }); kick = 2; };
  const tracer = (b) => {                       // kepala 1px terang -> pasangan piksel tebal -> piksel tunggal gelap memudar
    const ca = Math.cos(b.a), sa = Math.sin(b.a), len = Math.min(b.trav, 28), m = Math.max(Math.abs(ca), Math.abs(sa)),
      N = Math.max(3, Math.round(len * m)), vert = Math.abs(sa) >= Math.abs(ca), ox = vert ? (ca >= 0 ? -1 : 1) : 0, oy = vert ? 0 : (sa >= 0 ? -1 : 1);
    glow(Math.round(b.x), Math.round(b.y), 5, MIDS);
    for (let k = N; k >= 0; k--) {
      const t = k / N, x = Math.round(b.x - (ca / m) * k), y = Math.round(b.y - (sa / m) * k);
      if (k === 0) { c.globalAlpha = 1; c.fillStyle = CORE; c.fillRect(x, y, 1, 1); }
      else if (t <= 0.5) { c.globalAlpha = 1; c.fillStyle = MIDS; c.fillRect(x, y, 1, 1); c.fillRect(x + ox, y + oy, 1, 1); }
      else { c.globalAlpha = Math.max(0.4, 1 - (t - 0.5) * 1.1); c.fillStyle = DARK; c.fillRect(x, y, 1, 1); }
    }
    c.globalAlpha = 1;
  };
  PX.loop(host, (dt, t) => {
    cd -= dt; kick = Math.max(0, kick - dt * 20);
    ang = p.in ? Math.atan2(p.y - GUN.y, p.x - GUN.x) : -0.12 + Math.sin(t * 0.9) * 0.2;
    while (p.clicks.length) { p.clicks.length = 0; fire(ang); }
    if (cd <= 0 && (p.down || !p.in)) { fire(ang + (Math.random() - 0.5) * 0.04); cd = p.in ? 0.09 : 0.35; }
    for (const b of bl) {
      const v = 300 * dt; b.x += Math.cos(b.a) * v; b.y += Math.sin(b.a) * v; b.trav += v;
      if (b.x >= W - 6 || b.y >= GY || b.y < 0) {
        b.dead = true; const base = b.y >= GY ? -Math.PI / 2 : Math.PI;
        for (let i = 0; i < 9; i++) { const q = base + (Math.random() - 0.5) * 2.2, s = 40 + Math.random() * 90; sp.push({ x: b.x, y: Math.min(b.y, GY - 1), vx: Math.cos(q) * s, vy: Math.sin(q) * s, life: 0.25 + Math.random() * 0.3 }); }
      }
    }
    for (let i = bl.length - 1; i >= 0; i--) if (bl[i].dead) bl.splice(i, 1);
    for (const s of sp) { s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 260 * dt; s.life -= dt; }
    for (let i = sp.length - 1; i >= 0; i--) if (sp[i].life <= 0) sp.splice(i, 1);
    for (const f of fl) f.t += dt; while (fl.length && fl[0].t > 0.07) fl.shift();
    c.clearRect(0, 0, W, H); c.fillStyle = '#26263a'; c.fillRect(0, GY, W, H - GY); c.fillStyle = '#34344e'; c.fillRect(W - 6, 0, 6, GY);
    PX.line(c, GUN.x - Math.cos(ang) * kick, GUN.y - Math.sin(ang) * kick, GUN.x + Math.cos(ang) * 9 - Math.cos(ang) * kick, GUN.y + Math.sin(ang) * 9 - Math.sin(ang) * kick, '#8a8aa8');
    c.fillStyle = '#5c5c78'; c.fillRect(GUN.x - 3, GUN.y - 1, 5, 6);
    for (const f of fl) { const x = GUN.x + Math.cos(f.a) * 9, y = GUN.y + Math.sin(f.a) * 9; rays(x, y, f.a, 5, 9, MIDS); rays(x, y, f.a, 3, 5, CORE); c.fillStyle = '#fff'; c.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3); }
    bl.forEach(tracer);
    for (const s of sp) { c.fillStyle = s.life > 0.2 ? CORE : MIDS; c.fillRect(Math.round(s.x), Math.round(s.y), 1, 1); }
  });
};
