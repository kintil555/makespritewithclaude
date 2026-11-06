# Ledakan prosedural — roket dan neutron

> Dua jenis ledakan berbeda — roket/launcher (kilat, cincin, puff bola api, asap besar, percikan) dan neutron (Cherenkov: gumpalan 5 disc, sinar, gelombang kejut) — plus cahaya glow dan getaran layar.

Kategori: Efek (VFX) · URL: https://makespritewithclaude.pages.dev/articles/explosion.html

Satu ledakan = beberapa lapis yang hidup dengan jam masing-masing. Pilih **jenis** di demo: bentuknya sengaja berbeda supaya pemain langsung tahu senjata apa yang meledak.

> **Demo interaktif "blast"**: buka halaman web artikel ini untuk menjalankannya. Kodenya ada di bawah.

Klik untuk meledakkan. Pilih "roket" atau "neutron".

## Ledakan roket (`PX.Rocket`)
Berasal dari gaya `fx.explosion` (Sprite Fusion) dan `bigBlast` (Stickman Pixel). Urutan gambar, dari belakang ke depan:

1. **Asap besar** (22 gumpal): menyebar cepat dari pusat lalu melambat (`v·e^(−2.2t)`). Tiap gumpal = 3 disc bergeser (tubuh, bayangan sedikit ke kanan-bawah, highlight kiri-atas) agar terlihat bervolume. 6 gumpal pertama berwarna merah panas, sisanya meredup lewat ramp 4 abu.
2. **Puff bola api** (38 puff, 3 kelompok): *inti* (5, pendek 0.2 dtk), *menyebar* (28, 0.55–1 dtk, miring ke atas), *naik* (5, ke atas, tertunda). Warna dipilih dari **ramp 9 tingkat** (putih → kuning → oranye → merah → coklat) menurut umur: `idx = (u^0.62 + noise·0.1)·8`. Ukuran membesar cepat lalu menyusut: `h = size·(0.55 + 0.45·min(1, 7u))·(1 − 0.55u)`. Setiap puff digambar sebagai tubuh + disc bergeser + "benjolan" atas + highlight, bukan satu lingkaran polos.
3. **Kilat**: disc putih radius `1.05R` hanya 0.06 detik. Singkat — kilat panjang menutupi bola api.
4. **Dua cincin**: kuning (`0.1R → 2.7R`, 0.5 dtk) dan kuning pucat (`0.1R → 1.9R`, 0.34 dtk). Radius memakai easing kubik `1−(1−u)³`, alpha `(1−u)^1.4`, tebal menyusut ke minimum 0.9 px.
5. **Percikan** (90): kecepatan acak, gravitasi, 1 piksel + 1 piksel ekor redup di belakangnya. Warna acak dari 5 tingkat putih → oranye.
6. **Cahaya**: `PX.Light` oranye radius `3.4R` redup selama 0.7 dtk + putih `1.6R` selama 0.12 dtk — lihat [glow](https://makespritewithclaude.pages.dev/md/glow.md).
7. **Getaran**: `translate` acak pada kanvas, amplitudo turun linear (≈0.33 dtk). Di game, dikalikan jarak ke pemain.

## Ledakan neutron (`PX.Blast`)
Cherenkov biru, lebih "bersih" dan geometris:

1. **Haze**: disc radius `R(1+0.9e)` alpha 0.14 warna paling gelap.
2. **Kilat**: 14% awal umur, disc putih membesar sambil memudar.
3. **Gumpalan**: 10 lobus acak; tiap lobus = **5 disc konsentris** gelap → putih (radius `1, .86, .64, .42, .22`; alpha `.55, .7, .85, .95, 1`).
4. **Sinar (teranimasi)**: 10 duri utama merata + jitter (panjang `1.4–2.5R`, pangkal tebal 3–5 piksel yang meruncing) dan 22 sinar pendek acak, dari `0.3R`. Tiap sinar adalah ruas `[ekor, kepala]` dan **sekali jalan, tanpa memantul**:
   - **kepala** melesat keluar dengan ease-out kubik di paruh awal umur sinar: `head = Lmaks·(1 − (1 − min(1, ru/0.5))³)`;
   - **ekor** mengejar dari pangkal: `tail = head·ru^1.5`, sehingga sinar muncul penuh lalu langsung terkikis dari pangkal sampai habis (panjang tidak pernah naik lagi);
   - terang di kepala (putih), redup di ekor; alpha `(1 − ru)^0.5` turun satu arah;
   - **putaran tidak linear**: sudut seluruh bintang `spin·(1 − (1 − u)³)` (ease-out kubik: cepat di awal, melambat sampai berhenti saat sinar habis), tiap sinar dengan faktor `0.85–1.15` agar tidak kaku;
   - 4% piksel dilewati acak tiap frame supaya tepinya bergerigi. Tidak ada `sin` pada panjang atau sudut — itu yang membuat sinar terlihat memantul.
5. **Gelombang kejut**: 2 cincin dengan radius `rr·(1 + 0.07·sin3θ + 0.05·sin5θ + 0.03·sin9θ)` + jitter, supaya tidak bulat sempurna.
6. **Kilau silang**: 22% awal umur, 4 garis tipis (kiri/kanan/atas/bawah) dengan alpha berkedip.
7. **Cincin riak ketiga**: tipis, lebih lambat, radius `R(0.3 + 2.6e)`; riaknya `sin(7θ − 9t)` merambat di sepanjang cincin.
8. **Partikel** 70 piksel, kecepatan `√random`, masing-masing dengan ekor redup; **asap** 7 gumpal biru-abu.
9. **Cahaya** (`light(L)`): halo `3.6R` berdenyut, kilat putih 0.14 dtk, dan glow kecil di ujung tiap sinar (posisinya dicatat saat menggambar, jadi ikut berputar). **Getaran**: `shake` turun linear.

## Beda roket vs neutron
| | Roket | Neutron |
|---|---|---|
| Karakter | api, volumetrik, kotor | energi, tajam, simetris |
| Dominan | puff + asap + percikan | sinar berputar + gelombang kejut |
| Warna | ramp api 9 tingkat | ramp biru 5 tingkat |
| Cahaya | oranye hangat, lama | biru, mengikuti umur |
| Asap | banyak, besar, lama | sedikit |

Kaidah umum: durasi tiap lapis berbeda (kilat 0.06 dtk, cincin 0.3–0.5, puff 0.5–1, asap 1–2), easing keluar `1−(1−u)²`, alpha `(1−u)^1.1`, dan semua posisi di-`round` oleh `PX.Buf`.

## Ganti palet = ganti tema
`PX.PALS` berisi ramp 5 warna + 4 warna asap; `PX.FB` ramp api roket. Ledakan jenis baru cukup menukar ramp dan memilih lapisan yang dipakai.

## Kode

**Kode: `src/code/41-demo-blast.js`**

```js
// Dua jenis ledakan. PX.Rocket (roket/launcher): kilat -> 2 cincin -> puff bola api -> asap besar -> percikan berparabola.
// PX.Blast (neutron): kilat -> gumpalan 5 disc -> sinar -> gelombang kejut tak beraturan -> partikel -> asap. Keduanya memberi cahaya lewat PX.Light.
PX.PALS = {
  api:     { c: ['#8a1f17', '#f2561d', '#ff8a2a', '#ffe26b', '#ffffff'], smoke: ['#7e3030', '#4a2a2a', '#2e2024', '#1a161c'] },
  neutron: { c: ['#1b2fb0', '#3a5cff', '#8fb4ff', '#c9d8ff', '#ffffff'], smoke: ['#5a6aa8', '#3a4278', '#262a4c', '#14162a'] },
};
PX.Blast = class {
  constructor(x, y, R, pal = PX.PALS.api) {
    const r = Math.random, rg = (a, b) => a + r() * (b - a); this.x = Math.round(x); this.y = Math.round(y); this.R = R; this.t = 0; this.life = 1.05 + r() * 0.25; this.shake = 1;
    this.c = pal.c.map(PX.hex); this.sm = pal.smoke.map(PX.hex);
    // sinar: 10 duri utama (merata + jitter, tebal, panjang) + 22 sinar pendek acak. Tiap sinar = ruas [ekor, kepala]: kepala melesat keluar, ekor mengejar dari pangkal, lalu lenyap (tanpa memantul).
    this.rays = [
      ...Array.from({ length: 10 }, (_, i) => ({ a: (i / 10) * 6.283 + rg(-0.15, 0.15), len: rg(1.4, 2.5), big: true, t0: rg(0, 0.05), sr: rg(0.85, 1.15) })),
      ...Array.from({ length: 22 }, () => ({ a: r() * 6.283, len: rg(0.4, 1.3), big: false, t0: rg(0.02, 0.14), sr: rg(0.85, 1.15) })),
    ];
    this.spin = (r() < 0.5 ? -1 : 1) * rg(1.4, 2.4); this.tips = [];
    this.lobes = Array.from({ length: 10 }, () => ({ a: r() * 6.283, d: r() * 0.75, r: 0.2 + r() * 0.28, t0: r() * 0.22, tl: 0.45 + r() * 0.4 }));
    this.ph = [r() * 6.283, r() * 6.283, r() * 6.283];
    this.parts = Array.from({ length: 70 }, () => { const g = r() * 6.283, v = (0.4 + Math.sqrt(r()) * 2.4) * R * 3; return { x: this.x, y: this.y, vx: Math.cos(g) * v, vy: Math.sin(g) * v - R, life: 0.25 + r() * 0.75, ci: (r() * 4) | 0 }; });
    this.smoke = Array.from({ length: 7 }, () => ({ x: this.x + (r() - 0.5) * R, y: this.y + (r() - 0.5) * R, vx: (r() - 0.5) * 8, vy: -4 - r() * 9, life: 1 + r() * 0.6, r0: R * 0.18, r1: R * (0.4 + r() * 0.4) }));
  }
  get done() { return this.t > this.life + 0.8; }
  step(dt) {
    this.t += dt; this.shake = Math.max(0, this.shake - dt * 3.5);
    for (const p of this.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += this.R * 14 * dt; }
    for (const s of this.smoke) { s.x += s.vx * dt; s.y += s.vy * dt; }
  }
  light(L) {                                                                           // cahaya: halo berdenyut + kilat + titik terang di ujung tiap sinar (ikut bergerak)
    const u = Math.min(1, this.t / this.life), k = Math.pow(1 - u, 1.4), f = 0.88 + 0.12 * Math.sin(this.t * 55);
    L.glow(this.x, this.y, this.R * 3.6, this.c[1], 0.7 * k * f); if (this.t < 0.14) L.glow(this.x, this.y, this.R * 1.7, [255, 255, 255], 0.7 * (1 - this.t / 0.14));
    for (let i = 0; i < this.tips.length; i += 3) L.glow(this.tips[i], this.tips[i + 1], 4, this.c[2], 0.3 * this.tips[i + 2]);
  }
  draw(b) {
    const { x: cx, y: cy, R, c } = this, T = this.t, u = T / this.life, e = 1 - (1 - u) * (1 - u), a = Math.pow(Math.max(0, 1 - u), 1.1), rnd = Math.random;
    for (const s of this.smoke) { const su = T / s.life; if (su > 1 || su < 0.12) continue; b.disc(s.x, s.y, s.r0 + (s.r1 - s.r0) * su, this.sm[Math.min(3, (su * 4) | 0)], 0.55 * (1 - su)); }
    this.tips.length = 0;
    if (u < 1) {
      b.disc(cx, cy, R * (1 + 0.9 * e), c[0], a * 0.14);
      if (u < 0.14) b.disc(cx, cy, R * (0.5 + (0.9 * u) / 0.14), c[4], 1 - u / 0.14);       // kilat
      if (u < 0.22) {                                                                     // kilau silang (lens flare): 4 garis tipis, berkedip
        const k = 1 - u / 0.22, len = R * (0.8 + 2.2 * Math.sqrt(k));
        for (let d = 1; d < len; d++) { const al = k * (1 - d / len) * (0.7 + 0.3 * rnd()); b.px(cx + d, cy, c[4], al); b.px(cx - d, cy, c[4], al); b.px(cx, cy + d, c[4], al); b.px(cx, cy - d, c[4], al); }
      }
      for (const l of this.lobes) {                                                       // gumpalan bola api: 5 disc konsentris
        const lu = (u - l.t0) / l.tl; if (lu < 0 || lu > 1) continue;
        const le = 1 - (1 - lu) * (1 - lu), al = Math.pow(1 - lu, 1.1), sz = l.r * R * (0.4 + 1.1 * le),
          lx = cx + Math.cos(l.a) * l.d * R * 1.5 * le, ly = cy + Math.sin(l.a) * l.d * R * 1.5 * le;
        [[0, 1, 0.55], [1, 0.86, 0.7], [2, 0.64, 0.85], [3, 0.42, 0.95], [4, 0.22 * (1 - lu * 0.6), 1]].forEach(([ci, k, A]) => b.disc(lx, ly, sz * k, c[ci], al * A));
      }
      const spin = this.spin * (1 - Math.pow(1 - Math.min(1, u * 1.15), 3));              // putaran ease-out kubik: cepat di awal, melambat sampai berhenti saat sinar habis (tidak linear)
      for (const r of this.rays) {                                                        // sinar: muncul lalu langsung lenyap, searah (tanpa tumbuh-menciut-tumbuh)
        const ru = (u - r.t0) / (0.78 - r.t0); if (ru < 0 || ru >= 1) continue;
        const Lm = R * r.len * 1.5, head = Lm * (1 - Math.pow(1 - Math.min(1, ru / 0.5), 3)), tail = head * Math.pow(ru, 1.5);   // kepala melesat (ease-out), ekor mengejar dari pangkal
        if (head - tail < 1) continue;
        const ang = r.a + spin * r.sr, ca = Math.cos(ang), sa = Math.sin(ang), s0 = R * 0.3, al = Math.pow(1 - ru, 0.5);
        for (let d = tail; d < head; d += 0.8) {
          if (rnd() < 0.04) continue; const fv = (d - tail) / (head - tail), g = d / Lm, k = Math.min(1, (0.3 + 0.9 * fv) * al);   // terang di kepala, redup di ekor
          const col = fv > 0.8 ? c[4] : fv > 0.35 ? c[3] : c[1], px = cx + ca * (s0 + d), py = cy + sa * (s0 + d);
          b.px(px, py, col, k);
          if (r.big) { const w = g < 0.35 ? 1 : g < 0.7 ? 0.6 : 0; if (w) { const cc = g < 0.35 ? c[3] : c[2]; b.px(px - sa, py + ca, cc, k * w); b.px(px + sa, py - ca, cc, k * w); if (g < 0.12) { b.px(px - 2 * sa, py + 2 * ca, c[1], k * 0.6); b.px(px + 2 * sa, py - 2 * ca, c[1], k * 0.6); } } }   // duri utama: pangkal tebal 3-5 piksel
        }
        const tx = cx + ca * (s0 + head), ty = cy + sa * (s0 + head); this.tips.push(tx, ty, al); if (r.big) b.px(tx, ty, c[4], al * 0.9);
      }
      for (let k = 0; k < 2; k++) {                                                       // gelombang kejut 2 lapis, radius bergelombang
        const rr = R * (k ? 0.3 + 1.2 * e : 0.4 + 1.7 * e), n = Math.ceil(rr * 6.3), aa = a * (k ? 0.55 : 0.9); if (rr < 1) continue;
        for (let i = 0; i < n; i++) {
          if (rnd() < 0.22) continue; const g = (i / n) * 6.283,
            rd = rr + rr * (Math.sin(g * 3 + this.ph[0]) * 0.07 + Math.sin(g * 5 + this.ph[1]) * 0.05 + Math.sin(g * 9 + this.ph[2]) * 0.03) + (rnd() - 0.5) * 1.4;
          b.px(cx + Math.cos(g) * (rd + 1.5), cy + Math.sin(g) * (rd + 1.5), c[1], aa); b.px(cx + Math.cos(g) * rd, cy + Math.sin(g) * rd, k ? c[2] : c[4], aa);
        }
      }
      const u2 = (u - 0.1) / 0.9;                                                         // cincin riak ketiga, tipis, lebih lambat; riaknya merambat di sepanjang cincin
      if (u2 > 0 && u2 < 1) {
        const rr = R * (0.3 + 2.6 * (1 - Math.pow(1 - u2, 3))), n = Math.ceil(rr * 6.3), a2 = Math.pow(1 - u2, 1.3) * 0.7;
        for (let i = 0; i < n; i++) { if (rnd() < 0.3) continue; const g = (i / n) * 6.283, rd = rr * (1 + Math.sin(g * 7 - T * 9 + this.ph[2]) * 0.035); b.px(cx + Math.cos(g) * rd, cy + Math.sin(g) * rd, c[2], a2); }
      }
    }
    for (const p of this.parts) { const pu = T / p.life; if (pu >= 1) continue; const col = c[Math.min(4, 4 - ((pu * 3) | 0))]; b.px(p.x, p.y, col, 1 - pu * 0.5); b.px(p.x - p.vx * 0.025, p.y - p.vy * 0.025, col, (1 - pu) * 0.4); }   // partikel + ekor
  }
};

// ---- Ledakan roket: port gaya fx.explosion (Sprite Fusion) + bigBlast (Stickman Pixel). Skala: R = radius ledakan dalam piksel kanvas.
PX.FB = ['#ffffff', '#fff3a6', '#ffe26b', '#ffc23d', '#ff8a2a', '#f2561d', '#c9281f', '#8a1f17', '#4a1712'].map(PX.hex);
PX.Rocket = class {
  constructor(x, y, R) {
    const r = Math.random, rg = (a, b) => a + r() * (b - a), z = R * 0.95; this.x = Math.round(x); this.y = Math.round(y); this.R = R; this.t = 0; this.shake = 1;
    this.rings = [{ r0: R * 0.1, r1: R * 2.7, life: 0.5, th: 1.8, c: PX.hex('#ffd84a') }, { r0: R * 0.1, r1: R * 1.9, life: 0.34, th: 1.2, c: PX.hex('#fff1a8') }];
    this.puffs = []; const puff = (px, py, vx, vy, life, size, d = 0) => this.puffs.push({ x: px, y: py, vx, vy, life, size, d, sd: r() });
    for (let i = 0; i < 5; i++) puff(x + rg(-1, 1), y + rg(-1, 1), rg(-10, 10), rg(-20, -5), rg(0.18, 0.3), rg(z * 0.8, z * 1.1));                          // inti
    for (let i = 0; i < 28; i++) { const a = r() * 6.283, e = rg(0, R * 0.55), sp = rg(20, 105); puff(x + Math.cos(a) * e, y + Math.sin(a) * e, Math.cos(a) * sp, Math.sin(a) * sp * 0.8 - 20, rg(0.55, 1), rg(z * 0.45, z * 0.9)); }   // menyebar
    for (let i = 0; i < 5; i++) puff(x + rg(-R * 0.25, R * 0.25), y, rg(-6, 6), rg(-90, -50), rg(0.7, 1), rg(z * 0.5, z * 0.7), rg(0, 0.1));              // naik
    this.smoke = Array.from({ length: 22 }, (_, i) => { const a = r() * 6.283, v = R * (1 + r() * 2), l = 1 + r() * 0.9; return { x: x + Math.cos(a) * R * 0.1, y: y + Math.sin(a) * R * 0.1, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.85 - 5, life: l, r1: 2 + r() * 3.5, hot: i < 6 }; });
    const PAL = ['#ffffff', '#fff3b0', '#ffc23a', '#ff8a1f', '#ff6a1a'].map(PX.hex);
    this.sparks = Array.from({ length: 90 }, () => { const a = r() * 6.283, v = 60 + r() * 240; return { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 50, life: 0.45 + r() * 0.85, c: PAL[(r() * 5) | 0] }; });
  }
  get done() { return this.t > 2.2; }
  step(dt) {
    this.t += dt; this.shake = Math.max(0, this.shake - dt * 3);
    for (const p of this.puffs) { p.d -= dt; if (p.d > 0) continue; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= Math.exp(-2.5 * dt); p.vy *= Math.exp(-2.5 * dt); p.vy -= 12 * dt; p.t = (p.t || 0) + dt; }
    for (const s of this.smoke) { s.x += s.vx * dt; s.y += s.vy * dt; s.vx *= Math.exp(-2.2 * dt); s.vy *= Math.exp(-2.2 * dt); }
    for (const s of this.sparks) { s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 380 * dt; }
  }
  light(L) { const u = Math.min(1, this.t / 0.7); L.glow(this.x, this.y, this.R * 3.4, [255, 176, 80], 0.6 * Math.pow(1 - u, 1.5)); if (this.t < 0.12) L.glow(this.x, this.y, this.R * 1.6, [255, 255, 255], 0.6 * (1 - this.t / 0.12)); }
  draw(b) {
    const SM = ['#7e3030', '#4a2a2a', '#2e2024', '#1a161c'].map(PX.hex), c = this.t;
    for (const s of this.smoke) {                                                           // asap: bola besar menyebar, 3 disc bergeser (tubuh + bayangan + highlight)
      const t = c / s.life; if (t >= 1 || t < 0.04) continue; const r = 1.5 + (s.r1 * 1.25 - 1.5) * (1 - (1 - t) * (1 - t)), a = Math.min(1, t * 12) * Math.min(1, (1 - t) * 2.4) * 0.6, col = s.hot && t < 0.25 ? PX.hex('#a8402a') : SM[Math.min(3, (t * 4) | 0)];
      b.disc(s.x, s.y, r, col, a * 0.45); b.disc(s.x + r * 0.05, s.y + r * 0.06, r * 0.74, col, a * 0.62); if (t < 0.5) b.disc(s.x - r * 0.22, s.y - r * 0.3, r * 0.5, SM[Math.max(0, Math.min(3, (t * 4) | 0) - 1)], a * 0.4 * (1 - t * 2));
    }
    if (c < 0.06) b.disc(this.x, this.y, this.R * 1.05, PX.FB[0], 1);                         // kilat 0.06 dtk
    for (const p of this.puffs) {                                                           // puff bola api: warna turun sepanjang ramp 9 tingkat
      if (p.d > 0) continue; const T = p.t || 0, at = T / p.life; if (at >= 1) continue;
      const et = 1 - at, it = Math.min(0.999, Math.pow(at, 0.62) + p.sd * 0.1), lt = Math.min(7, Math.floor(it * 8)), h = p.size * (0.55 + 0.45 * Math.min(1, at * 7)) * (1 - at * 0.55), FB = PX.FB;
      if (lt >= 7) b.disc(p.x, p.y, h, FB[lt], Math.min(1, et * 3) * 0.85);
      else { b.disc(p.x, p.y, h, FB[Math.min(8, lt + 2)]); b.disc(p.x - h * 0.16, p.y - h * 0.22, h * 0.78, FB[lt]); if (h > 1.6) b.disc(p.x, p.y - h * 0.9, h * 0.42, FB[lt]); if (lt <= 3 && h > 1.8) b.disc(p.x - h * 0.28, p.y - h * 0.34, h * 0.36, FB[Math.max(0, lt - 1)]); }
    }
    for (const q of this.rings) {                                                           // cincin: radius easing kubik, alpha (1-u)^1.4, tebal menyusut
      const u = c / q.life; if (u >= 1) continue; const e = 1 - Math.pow(1 - u, 3), Rc = q.r0 + (q.r1 - q.r0) * e, th = Math.max(0.9, q.th * (1 - u * 0.5)), n = Math.ceil(Rc * 6.3), al = Math.pow(1 - u, 1.4);
      for (let i = 0; i < n; i++) { const g = (i / n) * 6.283; for (let k = 0; k < th; k++) b.px(this.x + Math.cos(g) * (Rc + k), this.y + Math.sin(g) * (Rc + k), q.c, al); }
    }
    for (const s of this.sparks) { const u = c / s.life; if (u >= 1) continue; b.px(s.x, s.y, s.c, 1 - u * 0.5); b.px(s.x - s.vx * 0.02, s.y - s.vy * 0.02, s.c, (1 - u) * 0.5); }
  }
};

PX.demos.blast = (host) => {
  const W = 240, H = 135, cv = PX.canvas(host, W, H, 640), c = cv.getContext('2d'), buf = new PX.Buf(W, H), lit = new PX.Light(W, H), p = PX.pointer(cv);
  cv.style.background = '#12121c';
  let kind = 'roket', list = [], idle = 0, shake = 0;
  PX.ui(host).select('Jenis', ['roket', 'neutron'], 'roket', (v) => (kind = v));
  const boom = (x, y, k = kind) => list.push(k === 'roket' ? new PX.Rocket(x, y, 11) : new PX.Blast(x, y, 16, PX.PALS.neutron));
  PX.loop(host, (dt) => {
    for (const k of p.clicks.splice(0)) boom(k.x, k.y);
    idle -= dt; if (idle <= 0) { idle = 2; if (!p.in) boom(50 + Math.random() * 140, 40 + Math.random() * 60); }
    list = list.filter((q) => !q.done); buf.clear(); lit.clear(); shake = 0;
    for (const q of list) { q.step(dt); q.draw(buf); if (q.light) q.light(lit); else lit.glow(q.x, q.y, q.R * 3, [90, 130, 255], 0.5 * Math.pow(Math.max(0, 1 - q.t / q.life), 1.5)); if (q.shake) shake = Math.max(shake, q.shake); }
    buf.flush(c); lit.flush(c);
    cv.style.transform = shake > 0.02 ? `translate(${((Math.random() - 0.5) * 6 * shake).toFixed(1)}px,${((Math.random() - 0.5) * 6 * shake).toFixed(1)}px)` : '';
  });
};
```

