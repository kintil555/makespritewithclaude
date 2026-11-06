// Demo komposit sprite: pahlawan kecil mengikuti kursor. Strip bawah = tahapan. Klik = flash putih.
PX.demos.composite = (host) => {
  const W = 128, H = 72, cv = PX.canvas(host, W, H, 640, false, 'Strip bawah, kiri ke kanan: badan saja · +outline · +bayangan · +tint sisi jauh. Klik area atas untuk flash.'), buf = new PX.Buf(W, H), c = cv.getContext('2d'), p = PX.pointer(cv);
  const hero = PX.fromAscii([
    '....hhhh....', '...hhhhhh...', '...hsssshh..', '...hsessss..', '...hsssss...', '.....ss.....',
    '..AAbbbbaa..', '..AAbbbbaa..', '..A.bbbbagg.', '....bbbb.gg.', '....pppp....', '....pppp....',
    '....pp.pp...', '....pp.pp...', '....ll.ll...', '...lll.lll..',
  ], {
    h: { col: [96, 58, 38] }, s: { col: [240, 196, 156] }, e: { col: [30, 24, 40] }, b: { col: [74, 120, 214] }, a: { col: [64, 104, 196] },
    A: { col: [64, 104, 196], far: true }, p: { col: [60, 64, 104] }, l: { col: [44, 40, 56] }, g: { col: [150, 152, 162] },
  });
  const OL = [28, 18, 34], TINT = { col: [18, 22, 64], k: 0.5 }, on = { outline: true, shadow: true, tint: true };
  let x = W / 2, face = 1, flash = 0;
  const ui = PX.ui(host);
  ui.check('Outline', true, (v) => (on.outline = v)); ui.check('Bayangan', true, (v) => (on.shadow = v)); ui.check('Tint sisi jauh', true, (v) => (on.tint = v));
  PX.loop(host, (dt, t) => {
    if (p.clicks.splice(0).length) flash = 0.12;
    const tx = p.in ? p.x : W / 2 + Math.sin(t * 0.8) * 34;
    if (Math.abs(tx - x) > 0.25) face = tx > x ? 1 : -1;
    const moving = Math.abs(tx - x) > 0.5;
    x += (tx - x) * Math.min(1, dt * 6); flash = Math.max(0, flash - dt);      // posisi dunia pecahan; drawSprite yang membulatkan
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) buf.px(i, j, j < 48 ? (((i >> 2) + (j >> 2)) & 1 ? [150, 178, 120] : [140, 168, 112]) : [96, 122, 92], 1);
    PX.drawSprite(buf, hero, x - hero.w / 2, 46 - hero.h + (moving ? -Math.round(Math.abs(Math.sin(t * 14))) : 0), {
      flip: face < 0, outline: on.outline ? OL : null, shadow: on.shadow ? 0.28 : 0, tint: on.tint ? TINT : null, flash: flash > 0 ? [255, 255, 255] : null,
    });
    [{}, { outline: OL }, { outline: OL, shadow: 0.28 }, { outline: OL, shadow: 0.28, tint: TINT }].forEach((o, i) => PX.drawSprite(buf, hero, 16 + i * 32 - hero.w / 2, 52, o));
    buf.flush(c);
  });
};
