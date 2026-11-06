// Demo texturing air: penampang samping (tint + permukaan + caustic + serpihan) atau tile top-down dua lapis. Matikan tiap lapisan untuk melihat kontribusinya.
PX.demos.water = (host) => {
  const W = 160, H = 90, TOP = 24, FLOOR = 78, cv = PX.canvas(host, W, H, 800), c = cv.getContext('2d'), buf = new PX.Buf(W, H), lit = new PX.Light(W, H);
  const wat = new PX.Water(0, W, TOP, FLOOR), sc = PX.poolScene(W, H, TOP, () => FLOOR), A = PX.bakeTex('water', 32, { emb: 0, seed: 2 }), B = PX.bakeTex('water', 32, { emb: 0, seed: 9 });
  let mode = 'side', tint = true, caus = true, snow = true, t = 0;
  const ui = PX.ui(host);
  ui.select('Tampilan', [{ label: 'penampang samping', value: 'side' }, { label: 'tile top-down (2 lapis scroll)', value: 'top' }], mode, (v) => (mode = v));
  ui.check('Tint kedalaman', true, (v) => (tint = v)); ui.check('Caustic', true, (v) => (caus = v)); ui.check('Serpihan', true, (v) => (snow = v));
  PX.loop(host, (dt) => {
    t += dt;
    if (mode === 'top') { PX.waterTile(buf, A, B, t); buf.flush(c); return; }
    const sy = (x) => wat.surf(x, t);
    lit.clear(); wat.compose(buf, sc.sky, sc.under, sy);
    if (tint) wat.tint(buf, sy);
    if (snow) wat.snow(buf, t);
    wat.surface(buf, lit, t, sy);
    if (caus) wat.caustics(lit, t);
    buf.flush(c); lit.flush(c);
  });
};
