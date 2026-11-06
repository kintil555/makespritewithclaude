// Demo fluida: permukaan berpegas + benda berapung/tenggelam (Archimedes sederhana) + percikan + gelembung. Klik = jatuhkan batu.
PX.demos.fluid = (host) => {
  const W = 160, H = 90, TOP = 30, FLOOR = 82, cv = PX.canvas(host, W, H, 800), c = cv.getContext('2d'), buf = new PX.Buf(W, H), lit = new PX.Light(W, H), p = PX.pointer(cv);
  const wat = new PX.Water(0, W, TOP, FLOOR), sc = PX.poolScene(W, H, TOP, () => FLOOR), surf = new PX.Surface(W, TOP), R = PX.rng(5), rg = (a, b) => a + (b - a) * R();
  const objs = [], drops = []; let t = 0, rho = 1.6, caus = true;
  const sy = (x) => surf.y(x) + Math.sin(x * 0.11 + t * 1.6) * 0.4 + Math.sin(x * 0.043 - t * 0.9) * 0.5;      // permukaan = simulasi + ombak halus
  const bub = new PX.Bubbles({ x0: 0, x1: W, top: TOP, ground: () => FLOOR, surfY: sy, density: 0.7, seed: 2 });
  const ui = PX.ui(host);
  ui.range('Massa jenis benda', 0.4, 2.5, 0.1, rho, (v) => (rho = v)); ui.check('Caustic', true, (v) => (caus = v));
  ui.button('Hujan batu', () => { for (let i = 0; i < 6; i++) drop(rg(10, W - 10), -i * 12); });
  const drop = (x, y) => { objs.push({ x, y, vx: rg(-8, 8), vy: 0, r: rg(2, 4), rho, wet: false }); if (objs.length > 14) objs.shift(); };
  const spray = (x, y, speed, r) => { const n = Math.min(14, Math.floor(speed * r * 0.05)); for (let i = 0; i < n; i++) drops.push({ x: x + rg(-r, r), y, vx: rg(-30, 30), vy: -(40 + rg(0.2, 0.7) * speed) }); };
  PX.loop(host, (dt) => {
    t += dt; for (const k of p.clicks.splice(0)) drop(k.x, 2);
    for (const o of objs) {
      const s = sy(o.x), sub = PX.clamp((o.y + o.r - s) / (2 * o.r), 0, 1);                                  // fraksi tercelup 0..1
      o.vy += 150 * (1 - sub / o.rho) * dt;                                                                    // gravitasi - gaya apung (∝ tercelup / massa jenis)
      o.vy -= o.vy * 2.2 * sub * dt; o.vx -= o.vx * 1.5 * sub * dt; o.x += o.vx * dt; o.y += o.vy * dt;        // hambatan hanya saat tercelup
      if (o.y + o.r > FLOOR) { o.y = FLOOR - o.r; o.vy *= -0.2; o.vx *= 0.5; }
      if (!o.wet && sub > 0) { o.wet = true; surf.splash(o.x, -Math.min(3, o.vy * o.r * 0.004)); spray(o.x, s, Math.abs(o.vy), o.r); }   // masuk air: tekan permukaan + percikan
      if (sub === 0) o.wet = false;
      if (sub > 0.5 && Math.hypot(o.vx, o.vy) > 30 && R() < dt * 12) bub.add(o.x + rg(-1, 1), o.y - o.r * 0.5, rg(0.6, 1.4));   // jejak gelembung
    }
    for (let i = drops.length - 1; i >= 0; i--) { const d = drops[i]; d.vy += 220 * dt; d.x += d.vx * dt; d.y += d.vy * dt; if (d.vy > 0 && d.y >= sy(d.x)) { surf.splash(d.x, -0.25); drops.splice(i, 1); } }   // tetes jatuh -> riak kecil
    surf.update(dt); bub.update(dt);
    lit.clear(); wat.compose(buf, sc.sky, sc.under, sy);
    for (const o of objs) { buf.disc(o.x, o.y, o.r, [58, 52, 78]); buf.disc(o.x - 0.5, o.y - 0.5, o.r - 1, [110, 106, 128]); buf.px(o.x - o.r * 0.4, o.y - o.r * 0.4, [207, 205, 210]); }
    wat.tint(buf, sy); wat.snow(buf, t); bub.draw(buf, lit, 'back'); wat.surface(buf, lit, t, sy); bub.draw(buf, lit, 'front');
    for (const d of drops) { buf.px(d.x, d.y, PX.WATER.HI); buf.px(d.x - d.vx * 0.02, d.y - d.vy * 0.02, PX.WATER.LIT); }
    if (caus) wat.caustics(lit, t);
    buf.flush(c); lit.flush(c);
  });
};
