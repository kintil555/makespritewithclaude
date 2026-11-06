// 17-fluid.js — tiga model fluida murah untuk piksel: (1) PX.Surface = permukaan 1D berpegas, (2) PX.Bubbles = gelembung dari ventilasi, (3) PX.CAWater = air 2D berbasis sel (automata).

// (1) Permukaan: tiap kolom = pegas (Hooke) + penyebaran ke tetangga. h>0 = naik. Langkah tetap 1/60 dtk agar stabil.
PX.Surface = class {
  constructor(n, base, o = {}) {
    this.n = n; this.base = base; this.h = new Float32Array(n); this.v = new Float32Array(n); this.dl = new Float32Array(n); this.dr = new Float32Array(n);
    this.k = o.k ?? 0.03; this.damp = o.damp ?? 0.03; this.spread = o.spread ?? 0.22; this.acc = 0;
  }
  splash(x, f) { const i = PX.clamp(Math.round(x), 0, this.n - 1); this.v[i] += f; if (i > 0) this.v[i - 1] += f * 0.5; if (i < this.n - 1) this.v[i + 1] += f * 0.5; }   // f<0 = ditekan ke bawah
  y(x) { x = PX.clamp(x, 0, this.n - 1); const i = Math.floor(x), j = Math.min(this.n - 1, i + 1), f = x - i; return this.base - (this.h[i] * (1 - f) + this.h[j] * f); }
  update(dt) { this.acc += dt; while (this.acc >= 1 / 60) { this.acc -= 1 / 60; this.step(); } }
  step() {
    const { n, h, v, dl, dr, k, damp, spread } = this;
    for (let i = 0; i < n; i++) { v[i] += -k * h[i] - damp * v[i]; h[i] += v[i]; }                    // pegas ke tinggi 0 + redaman
    for (let pass = 0; pass < 4; pass++) {                                                            // sebar: tetangga ditarik ke selisih tinggi
      for (let i = 0; i < n; i++) { if (i > 0) { dl[i] = spread * (h[i] - h[i - 1]); v[i - 1] += dl[i]; } if (i < n - 1) { dr[i] = spread * (h[i] - h[i + 1]); v[i + 1] += dr[i]; } }
      for (let i = 0; i < n; i++) { if (i > 0) h[i - 1] += dl[i]; if (i < n - 1) h[i + 1] += dr[i]; }
    }
  }
};

// (2) Gelembung (dari sistem Sprite Fusion, ditulis ulang): ventilasi -> naik, goyang, tumbuh, menyatu (volume kekal), pecah di permukaan.
PX.Bubbles = class {
  constructor({ x0, x1, top, ground, surfY, vents, density = 1, seed = 1 }) {
    Object.assign(this, { x0, x1, top, ground, D: density, surfY: surfY ?? (() => top), t: 0, list: [], pops: [] });
    const R = (this.R = PX.rng(seed)); this.rg = (a, b) => a + (b - a) * R();
    this.vents = (vents ?? [0.17, 0.5, 0.83].map((f) => x0 + f * (x1 - x0))).map((x) => ({ x, acc: R(), burst: this.rg(0.5, 2.5), seed: this.rg(0, 100) }));
    for (const v of this.vents) for (let y = ground(v.x) - 4; y > top; y -= this.rg(9, 23) / density) {      // isi awal sepanjang kolom supaya adegan tidak kosong
      this.spawn(v, y, 0); const b = this.list[this.list.length - 1]; b.r *= 1 + (1 - (y - top) / (ground(v.x) - top)) * 0.4; b.vy = -(20 + 13 * b.r);
    }
  }
  spawn(v, y, big) {
    const R = this.R, rg = this.rg, r = big ? rg(1.5, 3.2) * big : R() < 0.7 ? rg(0.5, 1.4) : rg(1.4, 2.6);
    this.list.push({ x0: v.x + rg(-2, 2), x: v.x, y, r, vy: 0, ph: rg(0, 6.283), wob: 0, near: R() < 0.35 });
  }
  add(x, y, r) { this.list.push({ x0: x, x, y, r, vy: -(20 + 13 * r), ph: this.rg(0, 6.283), wob: 0, near: false }); }   // gelembung dari sumber lain (benda jatuh)
  update(dt) {
    const L = this.list, rg = this.rg, n1 = (x, s) => PX.vnoise(x, s * 3.7) * 2 - 1; this.t += dt; const t = this.t;
    for (const v of this.vents) {
      v.acc += dt * 5 * this.D * (0.7 + 0.3 * n1(t * 0.8 + v.seed, 3));                                           // laju spawn berfluktuasi pelan
      for (; v.acc > 1; v.acc--) this.spawn(v, this.ground(v.x) - 2, 0);
      if ((v.burst -= dt) < 0) { v.burst = rg(1.4, 3.2); const n = 5 + Math.floor(this.R() * 6); for (let i = 0; i < n; i++) this.spawn(v, this.ground(v.x) - 2 - i * 2.5, rg(0.6, 1)); }   // semburan
    }
    for (let i = L.length - 1; i >= 0; i--) {
      const b = L[i];
      b.vy += (-(20 + 13 * b.r) - b.vy) * Math.min(1, dt * 3);                                                     // kecepatan naik ∝ ukuran, mendekati bertahap
      b.y += b.vy * dt; b.ph += dt * (4 + 2 / b.r);
      b.x = b.x0 + Math.sin(b.ph) * (0.5 + 0.8 * b.r); b.x0 += n1(t * 0.4 + i * 0.13, 5) * 3 * dt;                 // goyang kiri-kanan + hanyut
      b.r = Math.min(5, b.r + dt * 0.12); b.wob *= 1 - Math.min(1, dt * 4);                                         // tumbuh (tekanan turun)
      if (b.y < this.surfY(b.x) + 1) { this.pops.push({ x: b.x, y: this.surfY(b.x), r: b.r, t: 0 }); L.splice(i, 1); }
    }
    for (let i = 0; i < L.length; i++) {                                                                           // menyatu: volume kekal r = ∛(ra³+rb³)
      const a = L[i]; if (a.r < 1) continue;
      for (let j = i + 1; j < L.length; j++) { const b = L[j]; if (b.r < 1 || Math.hypot(a.x - b.x, a.y - b.y) > (a.r + b.r) * 0.75) continue; a.r = Math.cbrt(a.r ** 3 + b.r ** 3); a.x0 = (a.x0 + b.x0) / 2; a.wob = 1; L.splice(j--, 1); }
    }
    for (let i = this.pops.length - 1; i >= 0; i--) if ((this.pops[i].t += dt) > 0.2) this.pops.splice(i, 1);
  }
  draw(buf, lit, layer) {
    if (layer !== 'front') { for (const b of this.list) if (!b.near) this.bubble(buf, lit, b); for (const p of this.pops) this.pop(buf, p); }
    if (layer !== 'back') for (const b of this.list) if (b.near) this.bubble(buf, lit, b);
  }
  bubble(buf, lit, b) {                                              // ukuran menentukan detail: <0.9 = 1px, <1.5 = 2×2 empat warna, lainnya = cincin + highlight
    const { HI, LIT, RIM, SHADE } = PX.WATER, FILL = PX.mix(RIM, SHADE, 0.5), cx = b.x, cy = b.y, r = b.r;
    if (r < 0.9) { buf.px(Math.floor(cx), Math.floor(cy), r < 0.7 ? RIM : LIT); return; }
    if (r < 1.5) { const px = Math.floor(cx), py = Math.floor(cy); buf.px(px, py, HI); buf.px(px + 1, py, LIT); buf.px(px, py + 1, RIM); buf.px(px + 1, py + 1, SHADE); lit.glow(cx + 0.5, cy + 0.5, 3, LIT, 0.12); return; }
    const sq = 0.1 * Math.sin(b.ph * 2) * Math.min(1, (r - 1.5) / 2) + b.wob * 0.25, rx = r * (1 + sq), ry = r * (1 - sq);   // bentuk bergetar (gepeng bergantian) + kejut saat menyatu
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, d = Math.sqrt(dx * dx + dy * dy) * r; if (d > r + 0.5) continue;
      const l = (-dx - dy) / Math.SQRT2 / Math.max(0.01, d / r);                                                    // + = menghadap cahaya kiri-atas
      if (d > r - 0.6) buf.px(x, y, l > 0.45 ? LIT : l < -0.55 ? SHADE : RIM); else if (PX.bayer(x, y) < 0.12) buf.px(x, y, FILL);   // tepi 1px; isi hanya 12% dither
    }
    const hx = Math.round(cx - rx * 0.45), hy = Math.round(cy - ry * 0.45);
    buf.px(hx, hy, HI); if (r >= 2.5) { buf.px(hx + 1, hy, LIT); buf.px(hx, hy + 1, LIT); } if (r >= 2) buf.px(Math.round(cx + rx * 0.5), Math.round(cy + ry * 0.5), LIT);
    lit.glow(cx, cy, r * 2.4 + 2, RIM, 0.14);
  }
  pop(buf, p) {                                                      // pecah: setengah elips percikan melebar + 2 tetes naik, memudar via Bayer
    const k = p.t / 0.2, r = p.r + 1 + k * 3, dot = (x, y, c) => { const px = Math.floor(x), py = Math.floor(y); if (1 - k > PX.bayer(px, py)) buf.px(px, py, c); };
    for (let a = 0; a < 6.283; a += 0.5 / r) if (Math.sin(a) < 0.2) dot(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r * 0.5, k < 0.5 ? PX.WATER.HI : PX.WATER.LIT);
    if (p.r > 1.5) { dot(p.x - 2, p.y - 2 - k * 4, PX.WATER.LIT); dot(p.x + 2, p.y - 3 - k * 5, PX.WATER.LIT); }
  }
};

// (3) Air sel (cellular automata). g: 0 kosong, 1 air, 2 tembok. Pindai bawah->atas, arah kiri/kanan bergantian tiap langkah agar tidak miring sebelah.
PX.CAWater = class {
  constructor(w, h, seed = 3) { this.w = w; this.h = h; this.g = new Uint8Array(w * h); this.m = new Uint8Array(w * h); this.stamp = 0; this.dir = 0; this.flow = 4; this.R = PX.rng(seed); }
  step() {
    const { w, h, g, m } = this; if (++this.stamp > 250) { this.stamp = 1; m.fill(0); } const st = this.stamp; this.dir ^= 1;
    for (let y = h - 2; y >= 0; y--) for (let k = 0; k < w; k++) {
      const x = this.dir ? k : w - 1 - k, i = y * w + x; if (g[i] !== 1 || m[i] === st) continue;       // m: sel yang baru dipindah langkah ini jangan diproses lagi
      const b = i + w, d = this.R() < 0.5 ? -1 : 1; let to = -1;
      if (g[b] === 0) to = b;                                                                          // 1) jatuh lurus
      else {
        for (let q = 0; q < 2 && to < 0; q++) { const s = q ? -d : d; if (x + s >= 0 && x + s < w && g[b + s] === 0 && g[i + s] === 0) to = b + s; }   // 2) diagonal bawah
        for (let q = 0; q < 2 && to < 0; q++) { const s = q ? -d : d; let j = 0; while (j < this.flow && x + s * (j + 1) >= 0 && x + s * (j + 1) < w && g[i + s * (j + 1)] === 0) j++; if (j > 0) to = i + s * j; }   // 3) mengalir ke samping
      }
      if (to >= 0) { g[to] = 1; g[i] = 0; m[to] = st; }
    }
  }
};
