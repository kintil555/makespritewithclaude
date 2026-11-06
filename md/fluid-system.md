# Sistem fluida piksel — permukaan berpegas, gelembung, air sel, benda apung

> Tiga model fluida murah untuk piksel — permukaan 1D berpegas (kolam, percikan), gelembung dari ventilasi (naik, goyang, menyatu, pecah), dan air sel 2D (automata) — plus benda apung/tenggelam dan cara menggabungkannya dengan texturing air.

Kategori: Efek (VFX) · URL: https://makespritewithclaude.pages.dev/articles/fluid-system.html

Bagian gelembung dianalisis dari `bubbles.ts` buatan Sprite Fusion (MIT); bagian pegas, benda apung, dan air sel adalah teknik standar yang ditulis ulang di sini. Semuanya JavaScript murni, satu unit = satu piksel logis.

## Pilih model sesuai kebutuhan
| Kebutuhan | Model | Biaya | Kelemahan |
|---|---|---|---|
| Permukaan kolam, ombak, riak, tempat benda jatuh | **Pegas 1D** (`PX.Surface`) | O(lebar) | tidak mengalir, tidak ada air di luar bak |
| Gelembung, uap, partikel naik | **Partikel + volume** (`PX.Bubbles`) | O(n²) kecil | hanya partikel |
| Air yang dituang, mengalir, mengisi cekungan | **Sel / automata** (`PX.CAWater`) | O(lebar·tinggi) | permukaan sedikit berkedip, volume bisa bocor di sudut |

Jangan memakai SPH atau solver Navier-Stokes untuk piksel: biayanya besar dan hasilnya halus (merusak gaya). Ketiga model di atas lebih cocok dengan estetika grid. Tampilan air (warna, permukaan, caustic) dikerjakan terpisah di [texturing air](https://makespritewithclaude.pages.dev/md/water-texturing.md).

> **Demo interaktif "fluid"**: buka halaman web artikel ini untuk menjalankannya. Kodenya ada di bawah.

Klik untuk menjatuhkan batu. Geser **massa jenis**: di bawah 1 benda mengapung, di atas 1 tenggelam.

## 1. Permukaan berpegas (heightfield)
Tiap kolom `i` punya tinggi `h[i]` dan kecepatan `v[i]`. Dua langkah per tick:

```
// pegas ke tinggi 0 + redaman
v[i] += −k·h[i] − damp·v[i];   h[i] += v[i]
// sebar ke tetangga (ulang 4 kali, hitung dulu semua delta baru terapkan)
dl[i] = spread·(h[i] − h[i−1]);  v[i−1] += dl[i]
dr[i] = spread·(h[i] − h[i+1]);  v[i+1] += dr[i]
h[i−1] += dl[i];  h[i+1] += dr[i]
```
Nilai awal yang stabil: `k = 0.03`, `damp = 0.03`, `spread = 0.22` (harus < 0.5). Jalankan dengan **langkah tetap 1/60 dtk** (akumulator), bukan `dt` variabel — kalau tidak, gelombang meledak saat frame lambat.

- **Percikan masuk**: `splash(x, −gaya)` menambah kecepatan negatif di kolom itu (±½ di tetangga). Permukaan turun lalu memantul menjadi gelombang menjalar.
- **Tinggi di `x` pecahan**: interpolasi linear dua kolom, lalu dibulatkan hanya saat menggambar.
- Tambahkan ombak ambien (dua sinus kecil) **setelah** simulasi: `y = sim.y(x) + ambien(x,t)`; simulasi tetap bersih.

## 2. Benda apung (Archimedes sederhana)
```
sub = clamp((y + r − permukaan) / (2r), 0, 1)       // fraksi tercelup
ay  = g·(1 − sub/rho)                               // rho = massa jenis relatif air
v  −= v·drag·sub·dt                                  // hambatan hanya saat tercelup
```
Pada `rho < 1` benda berhenti saat `sub = rho` (mengapung dengan sebagian di atas air); pada `rho > 1` tenggelam sampai dasar. Satu persamaan, tanpa cabang "terapung/tenggelam".

**Saat masuk air** (`sub` berubah dari 0 ke > 0, sekali): `surface.splash(x, −min(3, vy·r·0.004))`, semburkan `min(14, vy·r·0.05)` tetes, dan mulai jejak gelembung. Saat bergerak cepat di bawah air, munculkan gelembung kecil dengan probabilitas `dt·12`.

## 3. Percikan (tetes)
Partikel dengan gravitasi (`vy += 220·dt`), digambar 1 piksel terang + 1 piksel ekor `LIT` di belakang arah gerak. Saat `vy > 0` dan `y ≥ permukaan(x)`: buang tetes dan `splash(x, −0.25)` — riak kecil. Rantai sebab-akibat ini (benda → percikan → tetes → riak) membuat air terasa hidup tanpa simulasi mahal.

## 4. Gelembung
Setiap **ventilasi** punya laju spawn berfluktuasi (`dt·5·density·(0.7 + 0.3·noise)`) dan **semburan** tiap 1.4–3.2 dtk (5–10 gelembung rapat). Per gelembung:

```
vy  += (−(20 + 13r) − vy)·min(1, 3dt)       // naik lebih cepat bila besar, mendekati bertahap
ph  += dt·(4 + 2/r)                         // gelembung kecil bergetar lebih cepat
x    = x0 + sin(ph)·(0.5 + 0.8r)            // goyang kiri-kanan
x0  += noise(0.4t + i·0.13)·3·dt            // hanyut
r    = min(5, r + 0.12·dt)                  // tumbuh (tekanan turun)
```
- **Menyatu**: dua gelembung (r ≥ 1) yang jaraknya < `0.75·(ra + rb)` menjadi satu dengan `r = ∛(ra³ + rb³)` (volume kekal), posisi dirata-rata, dan `wob = 1` (getaran gepeng sesaat).
- **Pecah**: saat `y < permukaan(x) + 1` → efek pecah 0.2 dtk: setengah elips percikan yang melebar (`rx = r + 1 + 3k`, tinggi ½) + dua tetes naik, memudar lewat Bayer.
- **Layer**: sekitar 35% gelembung `near` digambar setelah benda (layer depan), sisanya di belakang — kedalaman murah.
- **Isi awal**: sebar gelembung di sepanjang kolom ventilasi saat dibuat agar adegan tidak kosong pada detik pertama.

**Gambar menurut ukuran** (detail berbanding ukuran, jangan menggambar cincin untuk 1 piksel):

| `r` | Gambar |
|---|---|
| < 0.9 | 1 piksel (`RIM` atau `LIT`) |
| < 1.5 | blok 2×2: `HI LIT / RIM SHADE` + glow kecil |
| ≥ 1.5 | cincin 1 piksel (sisi terang kiri-atas `LIT`, sisi gelap `SHADE`, lainnya `RIM`), isi 12% dither `FILL`, highlight `HI` di (−0.45, −0.45)·r, titik `LIT` di sisi berlawanan bila `r ≥ 2`, bentuk gepeng bergantian `±10%` |

## 5. Air sel (automata)
Grid `g`: 0 kosong, 1 air, 2 tembok. Pindai **dari bawah ke atas**; untuk tiap sel air, coba berurutan:

1. **Jatuh lurus** jika sel di bawah kosong.
2. **Diagonal bawah** (arah acak) jika sel samping dan diagonal kosong.
3. **Mengalir ke samping** sejauh `flow` sel (1–8) ke arah acak.

Aturan yang membuatnya benar: (a) **arah pindai kiri/kanan bergantian** tiap langkah supaya air tidak condong ke satu sisi; (b) tandai sel yang baru dipindah (`stamp`) agar tidak diproses dua kali dalam satu langkah; (c) jalankan 2 langkah per frame agar alirannya cepat; (d) sumber (keran) menyuntik sel **tiap langkah**, bukan tiap frame, supaya aliran utuh.

> **Demo interaktif "waterca"**: buka halaman web artikel ini untuk menjalankannya. Kodenya ada di bawah.

**Pewarnaan**: hitung kedalaman dari permukaan per kolom (pindai dari atas: sel air tanpa air di atas → `d = 0`, selain itu `d = d_atas + 1`). Warna `RAMP[tone(1 − min(1, d/14), x, y, 4, 0.25)]` dan kilau berjalan di permukaan (`(x + floor(6t)) % 9 == 0` → `HI`). Kedalaman dari *permukaan* membuat kolam dangkal tetap terang walaupun ada di dasar peta.

**Kelemahan yang perlu diketahui**: permukaan sedikit berkedip (sel teratas bergerak ke samping), dan genangan tipis 1 sel tidak merata sempurna. Itu bisa diterima sebagai "kilau" di gaya piksel; jika tidak boleh, hanya izinkan gerak samping bila sel di atasnya air atau ada penurunan tinggi di tujuan.

## Menggabungkan semuanya
1. `surface.update(dt)`, benda, tetes, `bubbles.update(dt)`.
2. `compose` latar menurut tinggi permukaan, benda bawah air, `tint`, `snow`, gelembung belakang, `surface()`, gelembung depan, tetes, `caustics()`.
3. Satu fungsi `sy(x)` dibagikan ke gelembung (titik pecah), benda (fraksi tercelup), tint, dan garis permukaan — satu sumber kebenaran untuk tinggi air.

## Performa
- Gelembung: tabrakan O(n²); batasi populasi (≤ ~150) atau pakai grid sel jika lebih.
- Pegas 1D: 4 putaran penyebaran × lebar; murah.
- Air sel: ~9.000 sel × 2 langkah masih lancar; gunakan `Uint8Array`, hindari alokasi array di dalam loop sel.
- Semua posisi digambar setelah pembulatan; simulasi tetap float.

## Checklist untuk AI
1. Pilih model dari tabel; jangan menggunakan solver fluida kontinu.
2. Langkah tetap 1/60 untuk pegas; `spread < 0.5`.
3. Benda: satu rumus `ay = g(1 − sub/rho)`; masuk air memicu percikan sekali.
4. Gelembung: kecepatan, goyang, tumbuh, menyatu dengan `∛`, pecah dengan efek setengah elips; detail menurut ukuran.
5. Air sel: pindai bawah→atas, arah bergantian, stamp, keran per langkah.
6. Satu fungsi tinggi permukaan dibagikan ke semua komponen.
7. Lihat hasil render diperbesar sebelum menyetel angka.

## Kode

**Kode: `src/code/17-fluid.js`**

```js
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
```



**Kode: `src/code/52-demo-fluid.js`**

```js
// Demo fluida: permukaan berpegas + benda berapung/tenggelam (Archimedes sederhana) + percikan + gelembung. Klik = jatuhkan batu.
PX.demos.fluid = (host) => {
  const W = 160, H = 90, TOP = 30, FLOOR = 82, cv = PX.canvas(host, W, H, 800), c = cv.getContext('2d'), buf = new PX.Buf(W, H), lit = new PX.Light(W, H), p = PX.pointer(cv);
  const wat = new PX.Water(0, W, TOP, FLOOR), sc = PX.poolScene(W, H, TOP, () => FLOOR), surf = new PX.Surface(W, TOP), R = PX.rng(5), rg = (a, b) => a + (b - a) * R();
  const objs = [], drops = []; let t = 0, rho = 1.6, caus = true;
  const sy = (x) => surf.y(x) + Math.sin(x * 0.11 + t * 1.6) * 0.4 + Math.sin(x * 0.043 - t * 0.9) * 0.5;      // permukaan = simulasi + ombak halus
  const bub = new PX.Bubbles({ x0: 0, x1: W, top: TOP, ground: () => FLOOR, surfY: sy, density: 0.7, seed: 2 });
  const ui = PX.ui(host);
  ui.range('Massa jenis benda', 0.4, 2.5, 0.1, rho, (v) => (rho = v)); ui.check('Caustic', true, (v) => (caus = v));
  ui.button('Hujan batu', () => { for (let i = 0; i < 6; i++) drop(rg(10, W - 10), -i * 12); });
  const drop = (x, y) => { objs.push({ x, y, vx: rg(-8, 8), vy: 0, r: rg(2, 4), rho, wet: false }); if (objs.length > 14) objs.shift(); };
  const spray = (x, y, speed, r) => { const n = Math.min(14, Math.floor(speed * r * 0.05)); for (let i = 0; i < n; i++) drops.push({ x: x + rg(-r, r), y, vx: rg(-30, 30), vy: -(40 + rg(0.2, 0.7) * speed) }); };
  PX.loop(host, (dt) => {
    t += dt; for (const k of p.clicks.splice(0)) drop(k.x, 2);
    for (const o of objs) {
      const s = sy(o.x), sub = PX.clamp((o.y + o.r - s) / (2 * o.r), 0, 1);                                  // fraksi tercelup 0..1
      o.vy += 150 * (1 - sub / o.rho) * dt;                                                                    // gravitasi - gaya apung (∝ tercelup / massa jenis)
      o.vy -= o.vy * 2.2 * sub * dt; o.vx -= o.vx * 1.5 * sub * dt; o.x += o.vx * dt; o.y += o.vy * dt;        // hambatan hanya saat tercelup
      if (o.y + o.r > FLOOR) { o.y = FLOOR - o.r; o.vy *= -0.2; o.vx *= 0.5; }
      if (!o.wet && sub > 0) { o.wet = true; surf.splash(o.x, -Math.min(3, o.vy * o.r * 0.004)); spray(o.x, s, Math.abs(o.vy), o.r); }   // masuk air: tekan permukaan + percikan
      if (sub === 0) o.wet = false;
      if (sub > 0.5 && Math.hypot(o.vx, o.vy) > 30 && R() < dt * 12) bub.add(o.x + rg(-1, 1), o.y - o.r * 0.5, rg(0.6, 1.4));   // jejak gelembung
    }
    for (let i = drops.length - 1; i >= 0; i--) { const d = drops[i]; d.vy += 220 * dt; d.x += d.vx * dt; d.y += d.vy * dt; if (d.vy > 0 && d.y >= sy(d.x)) { surf.splash(d.x, -0.25); drops.splice(i, 1); } }   // tetes jatuh -> riak kecil
    surf.update(dt); bub.update(dt);
    lit.clear(); wat.compose(buf, sc.sky, sc.under, sy);
    for (const o of objs) { buf.disc(o.x, o.y, o.r, [58, 52, 78]); buf.disc(o.x - 0.5, o.y - 0.5, o.r - 1, [110, 106, 128]); buf.px(o.x - o.r * 0.4, o.y - o.r * 0.4, [207, 205, 210]); }
    wat.tint(buf, sy); wat.snow(buf, t); bub.draw(buf, lit, 'back'); wat.surface(buf, lit, t, sy); bub.draw(buf, lit, 'front');
    for (const d of drops) { buf.px(d.x, d.y, PX.WATER.HI); buf.px(d.x - d.vx * 0.02, d.y - d.vy * 0.02, PX.WATER.LIT); }
    if (caus) wat.caustics(lit, t);
    buf.flush(c); lit.flush(c);
  });
};
```



**Kode: `src/code/53-demo-waterca.js`**

```js
// Demo air sel: tuang air / gambar tembok / hapus dengan menyeret. Warna menurut kedalaman dari permukaan (ramp 4 + dither), kilau di permukaan.
PX.demos.waterca = (host) => {
  const W = 128, H = 72, cv = PX.canvas(host, W, H, 768, false, 'Seret di atas kanvas untuk memakai alat'), c = cv.getContext('2d'), buf = new PX.Buf(W, H), p = PX.pointer(cv), sim = new PX.CAWater(W, H);
  const RAMP = ['#0f3f6b', '#2f7fb6', '#68bfe6', '#c6f3ff'].map(PX.hex), STONE = ['#2b2a3a', '#4a4a5e', '#6e6f80'].map(PX.hex), BG = ['#0a0f1c', '#121a2e'].map(PX.hex);
  let tool = 'water', faucet = true, t = 0; const dep = new Uint16Array(W);
  const build = () => { sim.g.fill(0); for (let x = 0; x < W; x++) sim.g[(H - 1) * W + x] = sim.g[(H - 2) * W + x] = 2; for (let y = 0; y < H; y++) sim.g[y * W] = sim.g[y * W + W - 1] = 2; for (let x = 24; x < 72; x++) sim.g[44 * W + x] = sim.g[45 * W + x] = 2; for (let y = 30; y < 46; y++) sim.g[y * W + 90] = sim.g[y * W + 91] = 2; };
  const ui = PX.ui(host);
  ui.select('Alat', [{ label: 'tuang air', value: 'water' }, { label: 'tembok', value: 'wall' }, { label: 'hapus', value: 'erase' }], tool, (v) => (tool = v));
  ui.range('Aliran samping', 1, 8, 1, sim.flow, (v) => (sim.flow = v)); ui.check('Keran', true, (v) => (faucet = v)); ui.button('Reset', build);
  build();
  PX.loop(host, (dt) => {
    t += dt;
    if (p.down && p.in) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const x = p.x + dx, y = p.y + dy, i = y * W + x; if (x < 1 || y < 0 || x >= W - 1 || y >= H - 2 || dx * dx + dy * dy > 5) continue;
      if (tool === 'water' && sim.g[i] === 0) sim.g[i] = 1; else if (tool === 'wall' && sim.g[i] !== 2) sim.g[i] = 2; else if (tool === 'erase') sim.g[i] = 0;
    }
    for (let k = 0; k < 2; k++) { if (faucet) for (let x = 40; x < 44; x++) if (sim.g[2 * W + x] === 0) sim.g[2 * W + x] = 1; sim.step(); }   // keran menyuntik tiap langkah -> aliran utuh
    dep.fill(0);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const v = sim.g[y * W + x];
      if (v === 2) { buf.px(x, y, STONE[PX.tone(0.25 + 0.6 * PX.hash(x >> 1, y >> 1, 3), x, y, 3, 0.25)]); dep[x] = 0; }
      else if (v === 1) {
        const above = y > 0 && sim.g[(y - 1) * W + x] === 1, d = above ? dep[x] + 1 : 0; dep[x] = d;
        let col = RAMP[PX.tone(1 - Math.min(1, d / 14), x, y, 4, 0.25)];
        if (d === 0 && (x + Math.floor(t * 6)) % 9 === 0) col = PX.WATER.HI;                                // kilau berjalan di permukaan
        buf.px(x, y, col);
      } else { buf.px(x, y, BG[PX.tone(y / H, x, y, 2, 0.25)]); dep[x] = 0; }
    }
    buf.flush(c);
  });
};
```

