// Demo air sel hibrida: badan air = sel (mengalir), muka air = pegas 1D (gelombang), tumbukan -> percikan + busa + gelembung mikro. Alat 'aduk' = mengobok air.
PX.demos.waterca = (host) => {
  const W = 128, H = 72, FL = H - 2, cv = PX.canvas(host, W, H, 768, false, 'Seret di atas kanvas untuk memakai alat'), c = cv.getContext('2d'), buf = new PX.Buf(W, H), p = PX.pointer(cv);
  const sim = new PX.CAWater(W, H), g = sim.g, lit = new PX.Light(W, H), wat = new PX.Water(0, W, 0, FL), sc = PX.poolScene(W, H, H * 0.45, () => FL), P = PX.WATER;
  const surf = new PX.Surface(W, 0), foam = new PX.Foam(W), R = PX.rng(11), rg = (a, b) => a + (b - a) * R();
  const STONE = ['#2b2a3a', '#4a4a5e', '#6e6f80'].map(PX.hex), TA = [0.1, 0.18, 0.26, 0.34];
  const top = new Int16Array(W).fill(-1), y0 = new Int16Array(W).fill(-1), dp = new Uint16Array(W), drops = [], cool = new Float32Array((W >> 2) + 1);     // top = muka air efektif (-1 = kolom tanpa muka air), y0 = muka sel mentah
  const inW = (x, y) => x >= 0 && y >= 0 && x < W && y < H && g[y * W + x] === 1 && !(top[x] >= 0 && y < top[x]);
  const spray = (x, y, v, n) => { for (let i = 0; i < n && drops.length < 400; i++) drops.push({ x: x + rg(-1.5, 1.5), y: y - 1, vx: rg(-30, 30), vy: -(30 + rg(0.3, 1) * Math.min(70, v * 3)) }); };
  const fizz = new PX.Fizz(inW, (x) => { surf.splash(x, -0.05); foam.add(x, 0.1, 1); if (R() < 0.4) spray(x, top[x] >= 0 ? top[x] : 0, 4, 1); });
  let tool = 'water', faucet = true, caus = true, t = 0, px0 = 0, py0 = 0;
  const build = () => { g.fill(0); sim.fall.fill(0); drops.length = 0; fizz.list.length = 0; surf.h.fill(0); surf.v.fill(0); foam.f.fill(0);
    for (let x = 0; x < W; x++) g[(H - 1) * W + x] = g[(H - 2) * W + x] = 2; for (let y = 0; y < H; y++) g[y * W] = g[y * W + W - 1] = 2; for (let x = 24; x < 72; x++) g[44 * W + x] = g[45 * W + x] = 2; for (let y = 30; y < 46; y++) g[y * W + 90] = g[y * W + 91] = 2; };
  const ui = PX.ui(host);
  ui.select('Alat', [{ label: 'tuang air', value: 'water' }, { label: 'aduk', value: 'stir' }, { label: 'tembok', value: 'wall' }, { label: 'hapus', value: 'erase' }], tool, (v) => (tool = v));
  ui.range('Aliran samping', 1, 8, 1, sim.flow, (v) => (sim.flow = v)); ui.check('Keran', true, (v) => (faucet = v)); ui.check('Caustic', true, (v) => (caus = v)); ui.button('Reset', build);
  build();
  const impacts = () => {                                                                                       // sel jatuh mendarat -> gelombang, busa, gelembung terseret, percikan
    for (const e of sim.ev) {
      const sp = Math.min(40, e.v), k = e.x >> 2; if (t - cool[k] < 0.12) continue; cool[k] = t;                    // jeda per ~4 kolom: aliran utuh tidak memicu semburan tiap sel
      if (e.water) { surf.splash(e.x, -Math.min(2.2, sp * 0.06)); foam.add(e.x, Math.min(1, sp * 0.04), 3); fizz.burst(e.x, e.y + 2, Math.min(6, 1 + ((sp * 0.15) | 0)), 3, 24); }
      spray(e.x, e.y, sp, Math.min(e.water ? 5 : 3, 1 + ((sp * 0.12) | 0)));
    }
    sim.ev.length = 0;
  };
  const surface = () => {                                                                                       // muka air per kolom: sel teratas yang ditopang, dihaluskan, lalu digeser gelombang pegas
    for (let x = 0; x < W; x++) { y0[x] = top[x] = -1; let y = 0; while (y < H && g[y * W + x] === 0) y++; if (y < H - 1 && g[y * W + x] === 1 && g[(y + 1) * W + x] !== 0) y0[x] = y; }
    for (let x = 0; x < W; x++) {
      const a = y0[x]; if (a < 0) continue;
      const l = x > 0 && y0[x - 1] >= 0 ? y0[x - 1] : a, r = x < W - 1 && y0[x + 1] >= 0 ? y0[x + 1] : a;
      let ty = Math.round(PX.clamp(PX.clamp((l + 2 * a + r) / 4, a - 1, a + 1) - PX.clamp(surf.h[x] * 1.3, -3, 3), a - 3, a + 3));
      while (ty > a && g[ty * W + x] !== 1) ty--; while (ty < a && g[ty * W + x] !== 0) ty++;                      // lembah hanya memotong sel air, puncak hanya mengisi sel kosong
      top[x] = ty;
    }
  };
  PX.loop(host, (dt) => {
    t += dt; const mx = p.x | 0, my = p.y | 0, sp = Math.hypot(mx - px0, my - py0);
    if (p.down && p.in) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const x = mx + dx, y = my + dy, i = y * W + x; if (x < 1 || y < 0 || x >= W - 1 || y >= H - 2 || dx * dx + dy * dy > 5) continue;
      if (tool === 'water' && g[i] === 0) g[i] = 1; else if (tool === 'wall' && g[i] !== 2) g[i] = 2; else if (tool === 'erase') g[i] = 0;
    }
    if (p.down && p.in && tool === 'stir' && sp > 0.3) {                                                           // kobok: geser sel air acak searah seretan + gelembung + riak + percikan
      const sx = Math.sign(mx - px0), sy = Math.sign(my - py0);
      for (let k = 0; k < 14; k++) {
        const x = mx + ((R() * 7 - 3.5) | 0), y = my + ((R() * 7 - 3.5) | 0); if (x < 1 || x >= W - 1 || y < 0 || y >= H - 2 || g[y * W + x] !== 1) continue;
        const nx = x + (R() < 0.6 ? sx : ((R() * 3 - 1) | 0)), ny = y + (R() < 0.6 ? sy : ((R() * 3 - 1) | 0));
        if (nx > 0 && nx < W - 1 && ny >= 0 && ny < H - 2 && g[ny * W + nx] === 0) { g[ny * W + nx] = 1; g[y * W + x] = 0; sim.fall[ny * W + nx] = 0; }
      }
      fizz.burst(mx, my, Math.min(3, 1 + ((sp * 0.6) | 0)), 3, 6);
      const ts = top[mx]; if (ts >= 0 && Math.abs(my - ts) < 7) { surf.splash(mx, -Math.min(1.2, sp * 0.1)); foam.add(mx, Math.min(0.6, sp * 0.05), 3); if (R() < Math.min(1, sp * 0.1)) spray(mx, ts, sp * 2, 1); }
    }
    px0 = mx; py0 = my;
    for (let k = 0; k < 2; k++) { if (faucet) for (let x = 40; x < 44; x++) if (g[2 * W + x] === 0) { g[2 * W + x] = 1; sim.fall[2 * W + x] = 0; } sim.step(); }   // keran menyuntik tiap langkah -> aliran utuh
    impacts(); surf.update(dt); surface(); fizz.update(dt); foam.update(dt);
    for (let i = drops.length - 1; i >= 0; i--) {                                                                 // tetes: gravitasi; jatuh ke air = riak + busa + kadang gelembung
      const d = drops[i]; d.vy += 220 * dt; d.x += d.vx * dt; d.y += d.vy * dt; const ix = Math.round(d.x), iy = Math.round(d.y);
      if (ix < 0 || ix >= W || iy >= H) { drops.splice(i, 1); continue; }
      if (iy >= 0) { const v = g[iy * W + ix]; if (v === 2) drops.splice(i, 1); else if (v === 1 && d.vy > 0 && inW(ix, iy)) { surf.splash(ix, -0.12); foam.add(ix, 0.12, 1); if (R() < 0.3) fizz.burst(ix, iy + 1, 1 + ((R() * 2) | 0), 1.5, 14); drops.splice(i, 1); } }
    }
    dp.fill(0); lit.clear();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const o = y * W + x, v = g[o], tx = top[x], open = tx >= 0;
      if (v === 2) { buf.px(x, y, STONE[PX.tone(0.25 + 0.6 * PX.hash(x >> 1, y >> 1, 3), x, y, 3, 0.25)]); dp[x] = 0; continue; }
      const w = open ? (v === 1 && y >= tx) || (v === 0 && y >= tx && y < y0[x]) : v === 1;
      if (!w) { buf.d[o] = sc.sky.d[o]; dp[x] = 0; continue; }
      const d = y > 0 && g[o - W] === 2 ? 4 : dp[x]; dp[x] = d + 1;                                              // d = kedalaman dari muka; di bawah tembok dianggap dalam (tanpa kilau muka)
      buf.d[o] = sc.under.d[o];
      if (!open && y < H - 1 && g[o + W] === 0) { buf.px(x, y, (x + y) & 1 ? P.LIT : P.RIM); continue; }       // sel jatuh bebas (aliran/tetes) = terang
      buf.px(x, y, P.TINT, TA[PX.tone(1 - Math.min(1, d / 14), x, y, 4, 0.25)]);
      if (d === 0) { const glint = Math.sin(x * 0.37 - t * 2.3) * Math.sin(x * 0.13 + t * 1.1) > 0.55; buf.px(x, y, glint ? P.HI : P.LIT); if ((x & 3) === 0) lit.glow(x, y + 2, 7, P.LIT, glint ? 0.2 : 0.09); }
      else if (d === 1) buf.px(x, y, P.RIM);
      else if (d < 7 && PX.bayer(x, y) < 0.5 - d * 0.07) buf.px(x, y, P.SHADE);
    }
    foam.draw(buf, (x) => top[x]); fizz.draw(buf, lit);
    for (const d of drops) { buf.px(d.x, d.y, P.HI); buf.px(d.x - d.vx * 0.02, d.y - d.vy * 0.02, P.LIT); }
    if (caus) wat.caustics(lit, t, (x, y) => y < H && inW(x, y));
    buf.flush(c); lit.flush(c);
  });
};
