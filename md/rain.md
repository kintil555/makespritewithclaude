# Hujan prosedural 3 lapis kedalaman

> Tetes dua warna, tiga lapis kecepatan, kabut tanah ber-noise, percikan setengah elips, dan lapis depan yang menutupi karakter.

Kategori: Efek (VFX) · URL: https://makespritewithclaude.pages.dev/articles/rain.html

> Ide diambil dari `rain.ts` oleh Sprite Fusion (lisensi MIT, © 2026 Hugo Duprez). Implementasi di bawah ditulis ulang untuk situs ini.

## Mengapa terlihat bagus
1. **Tiga lapis kedalaman.** Jauh / tengah / dekat berbeda dalam kecepatan (`380 / 525 / 725`), panjang (`2 / 4 / 8` piksel), dan warna. Semakin dekat, semakin cepat, panjang, dan terang.
2. **Tetes = dua segmen.** 60% ekor warna gelap + 40% kepala warna terang. Satu garis polos terlihat datar; dua tone memberi arah gerak.
3. **Lapis jauh berhenti di udara.** Tiap tetes lapis jauh punya `stop` acak 5–70 piksel di atas tanah lalu respawn. Tidak ada percikan, sehingga terkesan jauh di belakang.
4. **Hanya lapis depan menyentuh tanah dengan percikan penuh** (lapis tengah 60%). Percikan = cincin **setengah elips** (`ry = 0.35·rx`) yang melebar `rx = 1 + 3·√u`, alpha turun.
5. **Alpha menjadi dither.** `dot(x,y,c,a)` menggambar hanya jika `a > bayer(x,y)`. Tidak ada piksel semi-transparan.
6. **Kabut tanah**: noise 1D dua frekuensi yang bergerak berlawanan arah, tinggi 9 piksel, alpha ≤ 0.32 → dither.
7. **Serpihan air**: 0–2 partikel 1px per tetes dengan gravitasi, hidup 0.18–0.32 detik.
8. **Urutan gambar**: lapis jauh+tengah → tanah/objek/karakter → **lapis depan**. Tetes yang lewat di depan karakter memberi kesan ruang.

Semua tetes direspawn dari atas (`reset(d, true)`), jadi jumlah partikel konstan, tanpa alokasi per frame.

> **Demo interaktif "rain"**: buka halaman web artikel ini untuk menjalankannya. Kodenya ada di bawah.

## Kode

**Kode: `src/code/47-demo-rain.js`**

```js
// Hujan prosedural 3 lapis kedalaman: kecepatan/panjang/warna beda per lapis, kabut tanah ber-noise + Bayer,
// percikan setengah elips yang melebar, serpihan air berparabola. Lapis depan digambar SETELAH objek (di depan karakter).
PX.noise1 = (x, s = 0) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f), a = PX.hash(i, 0, s), b = PX.hash(i + 1, 0, s); return (a + (b - a) * u) * 2 - 1; };

PX.Rain = class {
  constructor({ w = 160, ground = 76, density = 1, slant = -0.22, seed = 1 } = {}) {
    this.w = w; this.G = ground; this.slant = slant; this.t = 0; this.R = PX.rng(seed);
    this.C = { far: '#38446e', farH: '#56659a', mid: '#5f74ab', midH: '#9ab0e0', near: '#6f86bd', nearH: '#d6e5ff', mist: '#4b5a8c' };
    for (const k in this.C) this.C[k] = PX.hex(this.C[k]);
    this.SPEED = [380, 525, 725]; this.LEN = [2, 4, 8];
    this.drops = []; this.splashes = []; this.bits = [];
    [[0, 90], [1, 50], [2, 16]].forEach(([layer, n]) => { for (let i = 0; i < Math.round(n * density); i++) { const d = { layer }; this.reset(d, false); this.drops.push(d); } });
  }
  rg(a, b) { return a + (b - a) * this.R(); }
  reset(d, top) {
    d.x = this.rg(0, this.w + 90);
    d.y = top ? -this.rg(0, 100) : this.rg(-100, this.G);
    d.sp = this.SPEED[d.layer] * this.rg(0.9, 1.1);
    d.stop = this.G - this.rg(5, 70);                  // lapis jauh berhenti di udara = ilusi kedalaman
  }
  update(dt) {
    this.t += dt;
    const L = Math.hypot(this.slant, 1), ux = this.slant / L, uy = 1 / L, G = this.G;
    for (const d of this.drops) {
      d.x += ux * d.sp * dt; d.y += uy * d.sp * dt;
      if (d.layer === 0 && d.y > d.stop) this.reset(d, true);
      else if (d.y >= G) {
        if (d.x > -10 && d.x < this.w + 10) {
          if (d.layer === 2 || this.R() < 0.6) this.splashes.push({ x: d.x, t: this.t });
          for (let k = 0, n = d.layer === 2 ? 3 : Math.floor(this.rg(0, 2.99)); k < n; k++) this.bits.push({ x: d.x, y: G - 1, vx: this.rg(-45, 35), vy: -this.rg(55, 115), life: this.rg(0.18, 0.32) });
        }
        this.reset(d, true);
      }
    }
    for (let i = this.bits.length - 1; i >= 0; i--) { const b = this.bits[i]; b.life -= dt; b.vy += 950 * dt; b.x += b.vx * dt; b.y += b.vy * dt; if (b.life <= 0 || b.y > G) this.bits.splice(i, 1); }
    this.splashes = this.splashes.filter((s) => this.t - s.t <= 0.4);
  }
  dot(buf, x, y, c, a = 1) { const px = Math.floor(x), py = Math.floor(y); if (a >= 1 || a > PX.bayer(px, py)) buf.px(px, py, c); }   // alpha -> dither
  line(buf, x0, y0, x1, y1, c) { const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)))); for (let i = 0; i <= n; i++) buf.px(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c); }
  layer(buf, k) {
    const L = Math.hypot(this.slant, 1), ux = this.slant / L, uy = 1 / L, len = this.LEN[k], body = [this.C.far, this.C.mid, this.C.near][k], head = [this.C.farH, this.C.midH, this.C.nearH][k];
    for (const d of this.drops) if (d.layer === k) {      // tetes = ekor gelap (60%) + kepala terang (40%)
      this.line(buf, d.x - ux * len, d.y - uy * len, d.x - ux * len * 0.4, d.y - uy * len * 0.4, body);
      this.line(buf, d.x - ux * len * 0.4, d.y - uy * len * 0.4, d.x, d.y, head);
    }
  }
  drawBack(buf) {
    this.layer(buf, 0); this.layer(buf, 1);
    const G = this.G, t = this.t;
    for (let x = 0; x < this.w; x++) {                    // kabut tanah
      const m = (PX.noise1(x * 0.06 + t * 0.5, 3) + PX.noise1(x * 0.15 - t * 0.8, 4) * 0.5 + 1) / 2.5;
      if (PX.hash(x, Math.floor(t * 8)) < 0.04) this.dot(buf, x, G, this.C.midH);
      for (let r = 0; r < 9; r++) this.dot(buf, x, G - r, this.C.mist, m * 0.32 * (1 - r / 9));
    }
    for (const s of this.splashes) {                      // percikan: setengah elips melebar
      const u = (t - s.t) / 0.4, rx = 1 + 3 * Math.sqrt(u), ry = rx * 0.35, n = Math.ceil(rx * 8), col = u < 0.3 ? this.C.midH : this.C.mid;
      for (let j = 0; j < n; j++) { const a = (j / n) * Math.PI * 2, sa = Math.sin(a); if (sa < -0.2) continue; this.dot(buf, s.x + Math.cos(a) * rx, G + sa * ry, col, 1 - u); }
    }
    for (const b of this.bits) this.dot(buf, b.x, b.y, this.C.nearH);
  }
  drawFront(buf) { this.layer(buf, 2); }
};

PX.demos.rain = (host) => {
  const W = 160, H = 90, G = 76, cv = PX.canvas(host, W, H, 640), c = cv.getContext('2d');
  const back = new PX.Buf(W, H), front = new PX.Buf(W, H), oc = document.createElement('canvas'); oc.width = W; oc.height = H; const o = oc.getContext('2d');
  let rain = new PX.Rain({ w: W, ground: G }), opt = { density: 1, slant: -0.22 };
  const rebuild = () => (rain = new PX.Rain({ w: W, ground: G, ...opt }));
  const ui = PX.ui(host);
  ui.select('Kepadatan', ['0.5', '1', '2'], '1', (v) => { opt.density = +v; rebuild(); });
  ui.select('Kemiringan', [{ label: 'miring kiri', value: -0.22 }, { label: 'tegak', value: 0 }, { label: 'miring kanan', value: 0.3 }], -0.22, (v) => { opt.slant = +v; rebuild(); });
  const flush = (b) => { b.flush(o); c.drawImage(oc, 0, 0); };
  PX.loop(host, (dt, t) => {
    rain.update(dt); back.clear(); front.clear(); rain.drawBack(back); rain.drawFront(front);
    c.clearRect(0, 0, W, H); flush(back);
    c.fillStyle = '#1b2036'; c.fillRect(0, G, W, H - G);                       // tanah basah
    c.fillStyle = '#2a3150'; c.fillRect(0, G, W, 1);
    c.fillStyle = '#3a3a58'; c.fillRect(70, G - 22, 12, 22); c.fillRect(72, G - 28, 8, 6);   // "karakter" pengganti
    c.fillStyle = '#5a5a80'; c.fillRect(72, G - 28, 8, 1); c.fillStyle = '#8ff3ff'; c.fillRect(74, G - 25, 1, 1); c.fillRect(77, G - 25, 1, 1);
    flush(front);                                                               // lapis depan di atas karakter
  });
};
```

