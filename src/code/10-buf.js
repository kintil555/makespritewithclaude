// 10-buf.js — PX.Buf: buffer piksel Uint32 + 1x putImageData per frame.
// Tanpa panggilan canvas per piksel; koordinat selalu integer; mendukung alpha & additive.
// (Asumsi little-endian: urutan byte RGBA -> Uint32 ABGR, berlaku di semua browser utama.)
PX.Buf = class {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.img = new ImageData(w, h);
    this.d = new Uint32Array(this.img.data.buffer);
    this.add = false;                       // true = pencampuran additive (cahaya)
  }
  clear() { this.d.fill(0); }
  px(x, y, c, a = 1) {                      // c = [r,g,b], a = 0..1
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || a <= 0) return;
    const i = y * this.w + x, p = this.d[i], pa = (p >>> 24) / 255;
    if (a >= 0.998 && !this.add) { this.d[i] = (0xff000000 | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0; return; }
    let r, g, b, A;
    if (this.add) {
      A = Math.min(1, pa + a);
      r = Math.min(255, (p & 255) * pa + c[0] * a); g = Math.min(255, ((p >>> 8) & 255) * pa + c[1] * a); b = Math.min(255, ((p >>> 16) & 255) * pa + c[2] * a);
      r /= A; g /= A; b /= A;
    } else {
      A = a + pa * (1 - a); const k = pa * (1 - a);
      r = ((p & 255) * k + c[0] * a) / A; g = (((p >>> 8) & 255) * k + c[1] * a) / A; b = (((p >>> 16) & 255) * k + c[2] * a) / A;
    }
    this.d[i] = (((A * 255 + 0.5) | 0) << 24 | ((b + 0.5) | 0) << 16 | ((g + 0.5) | 0) << 8 | ((r + 0.5) | 0)) >>> 0;
  }
  disc(cx, cy, r, c, a = 1) {               // lingkaran piksel: xx*xx+yy*yy <= r*r
    if (r < 0.5 || a <= 0.01) return;
    cx = Math.round(cx); cy = Math.round(cy);
    const R = Math.ceil(r), r2 = r * r;
    for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) if (x * x + y * y <= r2) this.px(cx + x, cy + y, c, a);
  }
  ditherDisc(cx, cy, r, c, a = 1) {         // glow tanpa gradient: kepadatan piksel turun ke tepi (Bayer)
    cx = Math.round(cx); cy = Math.round(cy);
    const R = Math.ceil(r);
    for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) {
      const d = Math.hypot(x, y) / r;
      if (d <= 1 && (1 - d) * a > PX.bayer(cx + x, cy + y)) this.px(cx + x, cy + y, c, 1);
    }
  }
  flush(ctx) { ctx.putImageData(this.img, 0, 0); }
};
