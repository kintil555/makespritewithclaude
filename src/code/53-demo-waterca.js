// Demo air sel: tuang air / gambar tembok / hapus dengan menyeret. Warna menurut kedalaman dari permukaan (ramp 4 + dither), kilau di permukaan.
PX.demos.waterca = (host) => {
  const W = 128, H = 72, cv = PX.canvas(host, W, H, 768, false, 'Seret di atas kanvas untuk memakai alat'), c = cv.getContext('2d'), buf = new PX.Buf(W, H), p = PX.pointer(cv), sim = new PX.CAWater(W, H);
  const RAMP = ['#0f3f6b', '#2f7fb6', '#68bfe6', '#c6f3ff'].map(PX.hex), STONE = ['#2b2a3a', '#4a4a5e', '#6e6f80'].map(PX.hex), BG = ['#0a0f1c', '#121a2e'].map(PX.hex);
  let tool = 'water', faucet = true, t = 0; const dep = new Uint16Array(W);
  const build = () => { sim.g.fill(0); for (let x = 0; x < W; x++) sim.g[(H - 1) * W + x] = sim.g[(H - 2) * W + x] = 2; for (let y = 0; y < H; y++) sim.g[y * W] = sim.g[y * W + W - 1] = 2; for (let x = 24; x < 72; x++) sim.g[44 * W + x] = sim.g[45 * W + x] = 2; for (let y = 30; y < 46; y++) sim.g[y * W + 90] = sim.g[y * W + 91] = 2; };
  const ui = PX.ui(host);
  ui.select('Alat', [{ label: 'tuang air', value: 'water' }, { label: 'tembok', value: 'wall' }, { label: 'hapus', value: 'erase' }], tool, (v) => (tool = v));
  ui.range('Aliran samping', 1, 8, 1, sim.flow, (v) => (sim.flow = v)); ui.check('Keran', true, (v) => (faucet = v)); ui.button('Reset', build);
  build();
  PX.loop(host, (dt) => {
    t += dt;
    if (p.down && p.in) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const x = p.x + dx, y = p.y + dy, i = y * W + x; if (x < 1 || y < 0 || x >= W - 1 || y >= H - 2 || dx * dx + dy * dy > 5) continue;
      if (tool === 'water' && sim.g[i] === 0) sim.g[i] = 1; else if (tool === 'wall' && sim.g[i] !== 2) sim.g[i] = 2; else if (tool === 'erase') sim.g[i] = 0;
    }
    for (let k = 0; k < 2; k++) { if (faucet) for (let x = 40; x < 44; x++) if (sim.g[2 * W + x] === 0) sim.g[2 * W + x] = 1; sim.step(); }   // keran menyuntik tiap langkah -> aliran utuh
    dep.fill(0);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const v = sim.g[y * W + x];
      if (v === 2) { buf.px(x, y, STONE[PX.tone(0.25 + 0.6 * PX.hash(x >> 1, y >> 1, 3), x, y, 3, 0.25)]); dep[x] = 0; }
      else if (v === 1) {
        const above = y > 0 && sim.g[(y - 1) * W + x] === 1, d = above ? dep[x] + 1 : 0; dep[x] = d;
        let col = RAMP[PX.tone(1 - Math.min(1, d / 14), x, y, 4, 0.25)];
        if (d === 0 && (x + Math.floor(t * 6)) % 9 === 0) col = PX.WATER.HI;                                // kilau berjalan di permukaan
        buf.px(x, y, col);
      } else { buf.px(x, y, BG[PX.tone(y / H, x, y, 2, 0.25)]); dep[x] = 0; }
    }
    buf.flush(c);
  });
};
