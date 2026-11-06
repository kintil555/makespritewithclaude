// 16-water.js — texturing air: tint kedalaman 4 tingkat, garis permukaan, caustic (anyaman sinus), serpihan mengambang, dan tile top-down yang di-scroll 2 lapis.
PX.WATER = { HI: PX.hex('#ffffff'), LIT: PX.hex('#c6f3ff'), RIM: PX.hex('#68bfe6'), SHADE: PX.hex('#2f7fb6'), TINT: PX.hex('#0b3550'), SPECK: ['#5f8a9a', '#7fa3a8', '#4c6f86'].map(PX.hex) };
PX.Light.prototype.add = function (x, y, c, k) {            // tambah 1 piksel cahaya (additive) tanpa profil glow
  if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
  const o = (y * this.w + x) * 3; this.d[o] += c[0] * k; this.d[o + 1] += c[1] * k; this.d[o + 2] += c[2] * k;
};
PX.MAT.water = { ramp: ['#0e3a5c', '#1a6a9a', '#3aa0cc', '#8fe0f0', '#ffffff'], f: (x, y, S, s) => {   // tile top-down: jaring terang = batas sel Worley
  const w = PX.worley(x / 8, y / 8, s, S / 8), line = Math.max(0, 1 - w[1] / 0.3);
  return 0.18 + 0.22 * PX.fbm(x / 4, y / 4, s + 4, S / 4) + 0.62 * line * line;
} };

// Latar kolam: langit senja + dinding bawah air + dasar pasir. Dua buffer; compose() memilih salah satunya per kolom menurut tinggi permukaan.
PX.poolScene = (W, H, top, floorY) => {
  const sky = new PX.Buf(W, H), under = new PX.Buf(W, H);
  const SKY = ['#1b1030', '#3a2250', '#74386a', '#c0566a', '#f08a5a'].map(PX.hex), WALL = ['#0a2236', '#123650', '#1b4a6a'].map(PX.hex), SAND = ['#3a2f3a', '#6a5648', '#a08462', '#d2b383'].map(PX.hex);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    sky.px(x, y, SKY[PX.tone(y / (top + 4) + (PX.fbm(x / 30, y / 8, 3, 0, 0, 2) - 0.5) * 0.25, x, y, 5, 0.25)]);
    const fl = floorY(x);
    if (y >= fl) under.px(x, y, SAND[PX.tone(0.25 + 0.45 * PX.fbm(x / 6, y / 3, 7, 0, 0, 3) + (y === Math.round(fl) ? 0.25 : 0), x, y, 4, 0.25)]);
    else under.px(x, y, WALL[PX.tone(0.2 + 0.5 * PX.fbm(x / 18, y / 10, 4, 0, 0, 3), x, y, 3, 0.25)]);
  }
  return { sky, under };
};

PX.Water = class {
  constructor(x0, x1, top, bottom, seed = 1) {
    Object.assign(this, { x0, x1, top, bottom, pal: PX.WATER });
    this.specks = Array.from({ length: 90 }, (_, i) => ({ x: x0 + PX.hash(i, 1, seed) * (x1 - x0), y: PX.hash(i, 2, seed) * (bottom - top), s: PX.hash(i, 3, seed) * 100, c: i % 3 }));
  }
  surf(x, t) { return this.top + Math.sin(x * 0.11 + t * 1.6) * 0.6 + Math.sin(x * 0.043 - t * 0.9) * 0.8; }   // permukaan default: 2 sinus beda frekuensi
  compose(buf, sky, under, surfY) {                                                                        // atas permukaan = langit, bawah = isi kolam
    for (let x = 0; x < buf.w; x++) { const s = Math.round(surfY(x)); for (let y = 0; y < buf.h; y++) buf.d[y * buf.w + x] = y < s ? sky.d[y * buf.w + x] : under.d[y * buf.w + x]; }
  }
  tint(buf, surfY) {                                                    // lapisan warna air: 4 tingkat kedalaman, batasnya didither (bukan alpha kontinu)
    const A = [0.1, 0.18, 0.26, 0.34], span = Math.max(1, this.bottom - this.top);
    for (let x = this.x0; x < this.x1; x++) for (let y = Math.max(0, Math.ceil(surfY(x))); y < this.bottom + 4; y++) buf.px(x, y, this.pal.TINT, A[PX.tone((y - this.top) / span, x, y, 4, 0.25)]);
  }
  surface(buf, lit, t, surfY) {                                         // garis permukaan: terang 1px, rim 1px, lalu pita bayangan yang menipis (Bayer)
    const P = this.pal;
    for (let x = this.x0; x < this.x1; x++) {
      const sy = Math.round(surfY(x)), glint = Math.sin(x * 0.37 - t * 2.3) * Math.sin(x * 0.13 + t * 1.1) > 0.55;
      buf.px(x, sy, glint ? P.HI : P.LIT); buf.px(x, sy + 1, P.RIM);
      for (let k = 2; k < 7; k++) if (PX.bayer(x, sy + k) < 0.5 - k * 0.07) buf.px(x, sy + k, P.SHADE);
      if ((x & 3) === 0) lit.glow(x, sy + 2, 7, P.LIT, glint ? 0.2 : 0.09);
    }
  }
  caustics(lit, t) {                                                    // anyaman cahaya: garis tempat sin(u)+sin(v) ≈ 0, dua medan ber-warp, 3 tingkat via Bayer, memudar ke atas kecuali di dasar
    const P = this.pal, gy = this.bottom, top = this.top;
    for (let y = top; y <= gy + 6; y++) {
      const k = y >= gy - 1 ? 1 : 0.18 + 0.32 * (1 - (y - top) / Math.max(1, gy - top));
      for (let x = this.x0; x < this.x1; x++) {
        const u = x * 0.16 + 1.9 * Math.sin(y * 0.12 + t * 0.9), v = y * 0.19 + 1.9 * Math.sin(x * 0.1 - t * 0.7);
        const n1 = Math.sin(u) + Math.sin(v), n2 = Math.sin(x * 0.09 + y * 0.07 + 1.4 * Math.sin(y * 0.15 - t * 0.6)) + Math.sin(y * 0.11 - x * 0.05 + 1.4 * Math.sin(x * 0.13 + t * 0.8));
        const f = (Math.max(0, 1 - Math.abs(n1) * 3) + 0.7 * Math.max(0, 1 - Math.abs(n2) * 3)) * k, d = PX.bayer(x, y);
        if (f > 1.05 || (f > 0.8 && d < (f - 0.8) / 0.25)) lit.add(x, y, P.LIT, 0.3);
        else if (f > 0.45 || (f > 0.3 && d < (f - 0.3) / 0.15)) lit.add(x, y, P.RIM, 0.15);
      }
    }
  }
  snow(buf, t) {                                                        // serpihan mengambang (marine snow): hanyut pelan, berkedip lewat ambang Bayer
    const h = this.bottom - this.top;
    for (const s of this.specks) {
      const x = Math.floor(s.x + 6 * Math.sin(t * 0.3 + s.s)), y = Math.floor(this.top + ((s.y + (2.5 + 1.5 * Math.sin(s.s)) * t) % h)), tw = Math.sin(t * 1.3 + s.s);
      if (PX.bayer(x, y) > 0.55 + 0.3 * tw) continue;
      buf.px(x, y, tw > 0.85 ? this.pal.LIT : this.pal.SPECK[s.c]);
    }
  }
};

// Air top-down: 2 tile yang sama (seed beda) digeser berlawanan, offset INTEGER per frame; piksel terang yang tumpang tindih jadi kilau putih.
PX.waterTile = (buf, A, B, t) => {
  const S = A.S, n = A.pal.length, ax = Math.floor(t * 4), ay = Math.floor(t * 2), bx = Math.floor(t * 3), by = Math.floor(t * 3);
  for (let y = 0; y < buf.h; y++) for (let x = 0; x < buf.w; x++) {
    const a = A.idx[((y + ay) % S) * S + ((x + ax) % S)], b = B.idx[(((y - by) % S + S) % S) * S + (((x - bx) % S + S) % S)];
    let i = a; if (b >= n - 2) i = a >= n - 2 ? n - 1 : Math.max(a, n - 3);
    buf.px(x, y, A.pal[i]);
  }
};
