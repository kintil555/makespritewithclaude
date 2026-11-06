// Demo air sel: tuang air / gambar tembok / hapus dengan menyeret. Tampilan sama dengan demo kolam: latar senja, tint kedalaman 4 tingkat (dither), garis permukaan, caustic.
PX.demos.waterca = (host) => {
  const W = 128, H = 72, cv = PX.canvas(host, W, H, 768, false, 'Seret di atas kanvas untuk memakai alat'), c = cv.getContext('2d'), buf = new PX.Buf(W, H), p = PX.pointer(cv), sim = new PX.CAWater(W, H), lit = new PX.Light(W, H), wat = new PX.Water(0, W, 0, H - 2), sc = PX.poolScene(W, H, H * 0.45, () => H - 2), P = PX.WATER;
  const STONE = ['#2b2a3a', '#4a4a5e', '#6e6f80'].map(PX.hex), A = [0.1, 0.18, 0.26, 0.34];
  let tool = 'water', faucet = true, caus = true, t = 0; const dep = new Uint16Array(W);
  const build = () => { sim.g.fill(0); for (let x = 0; x < W; x++) sim.g[(H - 1) * W + x] = sim.g[(H - 2) * W + x] = 2; for (let y = 0; y < H; y++) sim.g[y * W] = sim.g[y * W + W - 1] = 2; for (let x = 24; x < 72; x++) sim.g[44 * W + x] = sim.g[45 * W + x] = 2; for (let y = 30; y < 46; y++) sim.g[y * W + 90] = sim.g[y * W + 91] = 2; };
  const ui = PX.ui(host);
  ui.select('Alat', [{ label: 'tuang air', value: 'water' }, { label: 'tembok', value: 'wall' }, { label: 'hapus', value: 'erase' }], tool, (v) => (tool = v));
  ui.range('Aliran samping', 1, 8, 1, sim.flow, (v) => (sim.flow = v)); ui.check('Keran', true, (v) => (faucet = v)); ui.check('Caustic', true, (v) => (caus = v)); ui.button('Reset', build);
  build();
  PX.loop(host, (dt) => {
    t += dt;
    if (p.down && p.in) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const x = p.x + dx, y = p.y + dy, i = y * W + x; if (x < 1 || y < 0 || x >= W - 1 || y >= H - 2 || dx * dx + dy * dy > 5) continue;
      if (tool === 'water' && sim.g[i] === 0) sim.g[i] = 1; else if (tool === 'wall' && sim.g[i] !== 2) sim.g[i] = 2; else if (tool === 'erase') sim.g[i] = 0;
    }
    for (let k = 0; k < 2; k++) { if (faucet) for (let x = 40; x < 44; x++) if (sim.g[2 * W + x] === 0) sim.g[2 * W + x] = 1; sim.step(); }   // keran menyuntik tiap langkah -> aliran utuh
    dep.fill(0); lit.clear();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const v = sim.g[y * W + x], o = y * W + x;
      if (v === 2) { buf.px(x, y, STONE[PX.tone(0.25 + 0.6 * PX.hash(x >> 1, y >> 1, 3), x, y, 3, 0.25)]); dep[x] = 0; }
      else if (v === 1) {
        const above = y > 0 && sim.g[o - W] === 1, d = above ? dep[x] + 1 : 0; dep[x] = d;
        buf.d[o] = sc.under.d[o];                                                                            // isi air = dinding bawah air (sama dengan demo kolam)
        buf.px(x, y, P.TINT, A[PX.tone(1 - Math.min(1, d / 14), x, y, 4, 0.25)]);                            // tint kedalaman dari permukaan, 4 tingkat + dither
        if (d === 0) { const glint = Math.sin(x * 0.37 - t * 2.3) * Math.sin(x * 0.13 + t * 1.1) > 0.55; buf.px(x, y, glint ? P.HI : P.LIT); }
        else if (d === 1) buf.px(x, y, P.RIM);
        else if (d < 7 && PX.bayer(x, y) < 0.5 - d * 0.07) buf.px(x, y, P.SHADE);                            // pita bayangan menipis di bawah permukaan
        if (d === 0 && (x & 3) === 0) lit.glow(x, y + 2, 7, P.LIT, 0.09);
      } else { buf.d[o] = sc.sky.d[o]; dep[x] = 0; }
    }
    if (caus) wat.caustics(lit, t, (x, y) => y < H && sim.g[y * W + x] === 1);
    buf.flush(c); lit.flush(c);
  });
};
