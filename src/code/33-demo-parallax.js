// Demo parallax: 4 lapisan siluet, kamera jalan otomatis; kursor (vertikal) menggeser kamera Y.
PX.demos.parallax = (host) => {
  const W = 240, H = 135, cv = PX.canvas(host, W, H, 640, false, 'Gerakkan kursor naik-turun untuk parallax vertikal. Matikan "Kabut palet" untuk melihat kenapa warna lapisan penting.'), c = cv.getContext('2d'), p = PX.pointer(cv);
  const top = [34, 28, 76], bot = [246, 154, 112], dark = [14, 18, 32];
  const spec = [
    { w: 256, h: 74, speed: 0.12, seed: 3, amp: 0.9, base: 0.5, d: 0.45 },
    { w: 200, h: 60, speed: 0.28, seed: 8, amp: 0.8, base: 0.45, d: 0.62 },
    { w: 168, h: 46, speed: 0.55, seed: 15, amp: 0.5, base: 0.4, d: 0.8, trees: 9 },
    { w: 136, h: 32, speed: 0.9, seed: 21, amp: 0.35, base: 0.35, d: 1, trees: 7 },   // lebar tile berbeda-beda -> pola tidak sejajar
  ];
  let spd = 30, snap = true, fog = true, par, sky, cam = 0;
  const build = () => {
    const b = new PX.Buf(W, H); sky = document.createElement('canvas'); sky.width = W; sky.height = H;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) b.px(x, y, Math.min(1, y / (H * 0.75)) > PX.bayer(x, y) ? bot : top);   // langit: gradien dither
    b.flush(sky.getContext('2d'));
    par = new PX.Parallax(spec.map((s) => {
      const col = PX.mix(fog ? bot : dark, dark, fog ? s.d : 1);                  // kabut = warna lapisan dicampur ke warna langit (dibakar sekali)
      return PX.parallaxLayer(s.w, s.h, { ...s, col: PX.rgb(col), edge: PX.rgb(PX.mix(col, bot, 0.35)) });
    }));
  };
  build();
  const ui = PX.ui(host);
  ui.range('Kecepatan kamera', 0, 120, 5, spd, (v) => (spd = v));
  ui.check('Snap integer', true, (v) => (snap = v));
  ui.check('Kabut palet', true, (v) => { fog = v; build(); });
  PX.loop(host, (dt) => {
    cam += spd * dt;
    c.imageSmoothingEnabled = !snap;                                              // snap mati = interpolasi bawaan canvas -> blur
    c.drawImage(sky, 0, 0);
    par.draw(c, cam, p.in ? (p.y / H - 0.5) * 2 : 0, W, H, snap);
  });
};
