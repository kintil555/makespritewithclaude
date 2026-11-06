// Demo glow: kursor = sumber cahaya. Cahaya ditambahkan (additive) di buffer terpisah, lalu ditimpakan 'lighter' di atas adegan.
PX.demos.glow = (host) => {
  const W = 240, H = 135, cv = PX.canvas(host, W, H, 640), c = cv.getContext('2d'), buf = new PX.Buf(W, H), lit = new PX.Light(W, H), p = PX.pointer(cv);
  let R = 40, K = 0.8, prof = 2, col = PX.hex('#ffb050'); const flashes = [];
  const ui = PX.ui(host);
  ui.range('Radius', 10, 80, 2, R, (v) => (R = v)); ui.range('Intensitas', 0.2, 1.5, 0.1, K, (v) => (K = v));
  ui.select('Profil', [{ label: 'kuadrat (1-d)²', value: 2 }, { label: 'linear (1-d)', value: 1 }, { label: 'datar', value: 0 }], 2, (v) => (prof = +v));
  ui.select('Warna', [{ label: 'api', value: '#ffb050' }, { label: 'neutron', value: '#6f95ff' }, { label: 'hijau', value: '#6dff9a' }], '#ffb050', (v) => (col = PX.hex(v)));
  const tiles = []; for (let i = 0; i < 40; i++) tiles.push({ x: (PX.hash(i, 1) * 220) | 0, y: 20 + ((PX.hash(i, 2) * 100) | 0), w: 8 + ((PX.hash(i, 3) * 20) | 0), h: 6 + ((PX.hash(i, 4) * 14) | 0) });
  PX.loop(host, (dt, t) => {
    for (const k of p.clicks.splice(0)) flashes.push({ x: k.x, y: k.y, t: 0 });
    buf.clear(); lit.clear();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) buf.px(x, y, ((x >> 3) + (y >> 3)) & 1 ? [28, 28, 40] : [24, 24, 34]);
    for (const q of tiles) for (let y = 0; y < q.h; y++) for (let x = 0; x < q.w; x++) buf.px(q.x + x, q.y + y, y === 0 ? [92, 92, 120] : [60, 60, 84]);   // blok adegan: tepi atas lebih terang
    const lx = p.in ? p.x : W / 2 + Math.cos(t) * 70, ly = p.in ? p.y : H / 2 + Math.sin(t * 1.3) * 30;
    lit.glow(lx, ly, R, col, K, prof);
    for (let i = flashes.length - 1; i >= 0; i--) { const f = flashes[i]; f.t += dt; const u = f.t / 0.5; if (u >= 1) { flashes.splice(i, 1); continue; } lit.glow(f.x, f.y, 30 + 40 * u, [255, 255, 255], 1.2 * (1 - u), 2); }
    buf.disc(lx, ly, 2, [255, 255, 255]);
    buf.flush(c); lit.flush(c);
  });
};
