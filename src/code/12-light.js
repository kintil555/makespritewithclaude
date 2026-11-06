// 12-light.js — PX.Light: buffer cahaya terpisah. glow() menambah (additive) ke buffer ini, lalu flush() menimpa kanvas dengan 'lighter'.
// Profil: intensitas = (1 - jarak/r)^2 * k  -> terang di pusat, jatuh cepat ke tepi (tanpa tepi keras).
PX.Light = class {
  constructor(w, h) {
    this.w = w; this.h = h; this.d = new Float32Array(w * h * 3);
    this.cv = document.createElement('canvas'); this.cv.width = w; this.cv.height = h;
    this.cx = this.cv.getContext('2d'); this.img = new ImageData(w, h);
  }
  clear() { this.d.fill(0); }
  glow(x, y, r, col, k = 1, prof = 2) {          // prof: 2 = kuadrat (default), 1 = linear, 0 = datar
    if (r < 1 || k <= 0.01) return;
    const w = this.w, h = this.h, x0 = Math.max(0, Math.floor(x - r)), x1 = Math.min(w - 1, Math.ceil(x + r)),
      y0 = Math.max(0, Math.floor(y - r)), y1 = Math.min(h - 1, Math.ceil(y + r)), q = 1 / r;
    for (let j = y0; j <= y1; j++) {
      const dy = (j + 0.5 - y) * q;
      for (let i = x0; i <= x1; i++) {
        const dx = (i + 0.5 - x) * q, t = dx * dx + dy * dy; if (t >= 1) continue;
        const f = 1 - Math.sqrt(t), a = (prof === 2 ? f * f : prof === 1 ? f : 1) * k, o = (j * w + i) * 3;
        this.d[o] += col[0] * a; this.d[o + 1] += col[1] * a; this.d[o + 2] += col[2] * a;
      }
    }
  }
  flush(ctx) {
    const D = this.img.data, s = this.d;
    for (let i = 0, n = this.w * this.h; i < n; i++) {
      const r = Math.min(255, s[i * 3]), g = Math.min(255, s[i * 3 + 1]), b = Math.min(255, s[i * 3 + 2]), m = Math.max(r, g, b, 1);
      D[i * 4] = (r / m) * 255; D[i * 4 + 1] = (g / m) * 255; D[i * 4 + 2] = (b / m) * 255; D[i * 4 + 3] = m;   // alpha = kecerahan -> area gelap tetap transparan
    }
    this.cx.putImageData(this.img, 0, 0);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.imageSmoothingEnabled = false; ctx.drawImage(this.cv, 0, 0); ctx.restore();
  }
};
