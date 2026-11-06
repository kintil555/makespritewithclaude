// Hujan prosedural 3 lapis kedalaman: kecepatan/panjang/warna beda per lapis, kabut tanah ber-noise + Bayer,
// percikan setengah elips yang melebar, serpihan air berparabola, tanah tak rata (ground = fungsi x), stop() bertahap.
// Urutan gambar: latar + tanah -> drawBack (tetes jauh/tengah, kabut, percikan) -> karakter -> drawFront (tetes dekat).
PX.noise1 = (x, s = 0) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f), a = PX.hash(i, 0, s), b = PX.hash(i + 1, 0, s); return (a + (b - a) * u) * 2 - 1; };

PX.Rain = class {
  constructor({ w = 160, ground = 76, density = 1, slant = -0.22, seed = 1 } = {}) {
    this.w = w; this.gy = typeof ground === 'function' ? ground : () => ground;   // ground: angka, atau fungsi x -> y permukaan tanah
    this.G = 0; for (let x = 0; x < w; x++) this.G = Math.max(this.G, this.gy(x));
    this.slant = slant; this.t = 0; this.stopped = false; this.R = PX.rng(seed);
    this.C = { far: '#38446e', farH: '#56659a', mid: '#5f74ab', midH: '#9ab0e0', near: '#6f86bd', nearH: '#d6e5ff', mist: '#4b5a8c' };
    for (const k in this.C) this.C[k] = PX.hex(this.C[k]);
    this.SPEED = [380, 525, 725]; this.LEN = [3, 6, 12];
    const m = Math.abs(slant) * (this.G + 110) + 10;      // margin spawn mendatar: sebaran tetap merata untuk kemiringan apa pun
    this.x0 = slant > 0 ? -m : 0; this.x1 = w + (slant < 0 ? m : 0);
    this.drops = []; this.splashes = []; this.bits = [];
    [[0, 120], [1, 64], [2, 20]].forEach(([layer, n]) => { for (let i = 0; i < Math.round(n * density); i++) { const d = { layer }; this.reset(d, false); this.drops.push(d); } });
  }
  rg(a, b) { return a + (b - a) * this.R(); }
  reset(d, top) {
    d.x = this.rg(this.x0, this.x1);
    const g = this.gy(d.x);
    d.y = top ? -this.rg(0, 100) : this.rg(-100, g);
    d.sp = this.SPEED[d.layer] * this.rg(0.9, 1.1);
    d.stop = g - this.rg(5, 70);                          // lapis jauh berhenti di udara = ilusi kedalaman
  }
  again(i) { if (this.stopped) this.drops.splice(i, 1); else this.reset(this.drops[i], true); }
  stop() { this.stopped = true; }                         // tetes tidak direspawn -> hujan reda bertahap
  get done() { return this.stopped && !this.drops.length && !this.bits.length; }
  update(dt) {
    this.t += dt;
    const L = Math.hypot(this.slant, 1), ux = this.slant / L, uy = 1 / L;
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i]; d.x += ux * d.sp * dt; d.y += uy * d.sp * dt;
      const g = this.gy(d.x);
      if (d.layer === 0 && d.y > d.stop) this.again(i);
      else if (d.y >= g) {
        if (d.x > -10 && d.x < this.w + 10) {
          if (d.layer === 2 || this.R() < 0.6) this.splashes.push({ x: d.x, t: this.t });
          for (let k = 0, n = d.layer === 2 ? 3 : Math.floor(this.rg(0, 2.99)); k < n; k++) this.bits.push({ x: d.x, y: g - 1, vx: this.rg(-45, 35), vy: -this.rg(55, 115), life: this.rg(0.18, 0.32) });
        }
        this.again(i);
      }
    }
    for (let i = this.bits.length - 1; i >= 0; i--) { const b = this.bits[i]; b.life -= dt; b.vy += 950 * dt; b.x += b.vx * dt; b.y += b.vy * dt; if (b.life <= 0 || b.y > this.gy(b.x)) this.bits.splice(i, 1); }
    this.splashes = this.splashes.filter((s) => this.t - s.t <= 0.4);
  }
  dot(buf, x, y, c, a = 1) { const px = Math.floor(x), py = Math.floor(y); if (a >= 1 || a > PX.bayer(px, py)) buf.px(px, py, c); }   // alpha -> dither
  line(buf, x0, y0, x1, y1, c) { const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)))); for (let i = 0; i <= n; i++) buf.px(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c); }
  splash(buf, cx, cy, rx, ry, c, a) {                     // setengah elips bawah garis tanah, 3 lintasan radius -> tebal ~1 piksel
    const n = Math.ceil(Math.max(rx, ry) * Math.PI * 2 * 1.3);
    for (let j = 0; j < n; j++) {
      const ang = (j / n) * Math.PI * 2, ca = Math.cos(ang), sa = Math.sin(ang);
      if (sa < -0.2) continue;
      for (let o = -0.5; o <= 0.5; o += 0.5) this.dot(buf, cx + ca * (rx + o), cy + sa * (ry + o * (ry / Math.max(1, rx))), c, a);
    }
  }
  layer(buf, k) {
    const L = Math.hypot(this.slant, 1), ux = this.slant / L, uy = 1 / L, len = this.LEN[k], body = [this.C.far, this.C.mid, this.C.near][k], head = [this.C.farH, this.C.midH, this.C.nearH][k];
    for (const d of this.drops) if (d.layer === k) {      // tetes = ekor gelap (60%) + kepala terang (40%)
      this.line(buf, d.x - ux * len, d.y - uy * len, d.x - ux * len * 0.4, d.y - uy * len * 0.4, body);
      this.line(buf, d.x - ux * len * 0.4, d.y - uy * len * 0.4, d.x, d.y, head);
    }
  }
  drawBack(buf) {
    this.layer(buf, 0); this.layer(buf, 1);
    const t = this.t;
    for (let x = 0; x < this.w; x++) {                    // kabut tanah mengikuti kontur tanah
      const fy = Math.round(this.gy(x)), m = (PX.noise1(x * 0.06 + t * 0.5, 3) + PX.noise1(x * 0.15 - t * 0.8, 4) * 0.5 + 1) / 2.5;
      if (PX.hash(x, Math.floor(t * 8)) < 0.04) this.dot(buf, x, fy, this.C.midH);
      for (let r = 0; r < 9; r++) this.dot(buf, x, fy - r, this.C.mist, m * 0.32 * (1 - r / 9));
    }
    for (const s of this.splashes) { const u = (t - s.t) / 0.4, rx = 1 + 5 * Math.sqrt(u); this.splash(buf, s.x, this.gy(s.x), rx, rx * 0.25, u < 0.3 ? this.C.midH : this.C.mid, 1 - u); }
    for (const b of this.bits) this.dot(buf, b.x, b.y, this.C.nearH);
  }
  drawFront(buf) { this.layer(buf, 2); }
};

PX.demos.rain = (host) => {
  const W = 160, H = 90, cv = PX.canvas(host, W, H, 640, false, 'Urutan gambar: latar + tanah → hujan belakang (tetes jauh/tengah, kabut, percikan) → karakter → hujan depan.'), c = cv.getContext('2d');
  const gy = (x) => 72 + Math.round(2.5 * Math.sin(x * 0.045) + 1.5 * Math.sin(x * 0.11 + 1.3));   // tanah tak rata
  const mk = () => { const e = document.createElement('canvas'); e.width = W; e.height = H; return e; }, bg = mk(), ch = mk(), oc = mk(), o = oc.getContext('2d');
  { // latar statis: langit dither, dua lapis bukit, tanah
    const b = new PX.Buf(W, H), hill = (x, a, p, q) => a + Math.round(6 * Math.sin(x * p + q) + 3 * Math.sin(x * p * 3));
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let col = Math.min(1, y / (H * 0.85)) > PX.bayer(x, y) ? [38, 50, 92] : [14, 18, 40];
      if (y >= hill(x, 58, 0.03, 1)) col = [24, 30, 62];
      if (y >= hill(x, 66, 0.05, 2)) col = [20, 26, 54];
      const g = gy(x);
      if (y >= g) col = y === g ? [58, 69, 111] : PX.hash(x, y) < 0.08 ? [34, 40, 66] : [27, 32, 54];
      b.px(x, y, col, 1);
    }
    b.flush(bg.getContext('2d'));
  }
  { // karakter berjubah memakai PX.drawSprite (outline + bayangan)
    const cloak = PX.fromAscii(['..cccc..', '.cccccc.', '.cefecc.', '.cffffc.', '..cccc..', '.cccccc.', 'cccccccc', 'cccccccc', 'cccccccc', 'cccccccc', 'cccccccc', '.cc..cc.', '.bb..bb.'],
      { c: { col: [58, 64, 104] }, f: { col: [40, 44, 70] }, e: { col: [143, 243, 255] }, b: { col: [34, 36, 58] } });
    const b = new PX.Buf(W, H); PX.drawSprite(b, cloak, 76 - 4, gy(76) - cloak.h + 1, { outline: [14, 12, 28], shadow: 0.28 }); b.flush(ch.getContext('2d'));
  }
  const back = new PX.Buf(W, H), front = new PX.Buf(W, H), opt = { density: 1, slant: -0.22 };
  let rain, btn;
  const rebuild = () => { rain = new PX.Rain({ w: W, ground: gy, ...opt }); if (btn) btn.textContent = 'Hentikan hujan'; };
  rebuild();
  const ui = PX.ui(host);
  ui.range('Kepadatan', 0.5, 2.5, 0.5, 1, (v) => { opt.density = v; rebuild(); });
  ui.select('Kemiringan', [{ label: 'miring kiri', value: -0.22 }, { label: 'tegak', value: 0 }, { label: 'miring kanan', value: 0.3 }], -0.22, (v) => { opt.slant = +v; rebuild(); });
  btn = ui.button('Hentikan hujan', () => { if (rain.stopped) rebuild(); else { rain.stop(); btn.textContent = 'Mulai hujan'; } });
  const flush = (b) => { b.flush(o); c.drawImage(oc, 0, 0); };
  PX.loop(host, (dt) => {
    rain.update(dt); back.clear(); front.clear(); rain.drawBack(back); rain.drawFront(front);
    c.drawImage(bg, 0, 0); flush(back); c.drawImage(ch, 0, 0); flush(front);
  });
};
