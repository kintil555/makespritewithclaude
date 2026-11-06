# Parallax berlapis — kedalaman dari faktor kecepatan

> Latar 3–5 lapisan siluet yang di-tile mulus, digeser dengan faktor kecepatan berbeda, di-snap ke piksel integer, dengan kabut yang dibakar ke palet lapisan, bukan alpha per frame.

Kategori: Teknik Rendering · URL: https://makespritewithclaude.pages.dev/articles/parallax.html

## Prinsip
Kedalaman dibuat dari **perbedaan kecepatan**, bukan dari 3D. Tiap lapisan adalah kanvas kecil beresolusi logis yang di-tile mendatar; lapisan jauh bergeser sedikit, lapisan dekat bergeser hampir sebesar dunia. Pola ini dianalisis dari latar berlapis pada referensi Sprite Fusion (3–5 lapisan, faktor kecil untuk yang jauh, besar untuk yang dekat).

1. **Offset mendatar.** `ox = -(((camX · speed) mod w) + w) mod w`. Modulo ganda membuat kamera negatif tetap benar. Tile digambar dari `ox` sampai melewati lebar layar, tiap `w` piksel.
2. **Offset vertikal.** `oy = H − h + camY · h · 0.3 · (0.3 + speed)` dengan `camY` ternormalisasi `−1..1`. Lapisan dekat bergeser lebih jauh, jadi mendongak/menunduk juga terasa dalam.
3. **Snap integer.** `ox` dan `oy` dibulatkan sebelum `drawImage`. Tanpa snap, canvas menginterpolasi dan tepi siluet mengabur lalu bergetar.
4. **Tile mulus.** Permukaan dibangun dari jumlah sinus berfrekuensi **bulat** per lebar tile (1, 2, 5), sehingga ujung kiri dan kanan bertemu. Objek (pohon) digambar di `x−w`, `x`, `x+w` agar tidak terpotong di jahitan.
5. **Kabut lewat palet.** Warna lapisan = campuran warna langit bawah dan warna gelap, makin jauh makin dekat ke langit. Dihitung sekali saat membangun lapisan; tidak ada alpha per frame, jadi palet tetap terbatas.
6. **Lebar tile berbeda-beda** (256, 200, 168, 136). Lebar yang sama membuat jahitan semua lapisan selalu sejajar dan pola terlihat berulang.
7. **Isi di bawah lapisan** dengan warna dasarnya, agar tidak ada celah saat kamera naik atau turun.

> **Demo interaktif "parallax"**: buka halaman web artikel ini untuk menjalankannya. Kodenya ada di bawah.

## Faktor kecepatan
| Lapisan | Faktor | Kabut `d` |
|---|---|---|
| Langit | 0 (statis) | — |
| Gunung jauh | 0.1–0.15 | 0.45 |
| Gunung dekat | 0.25–0.3 | 0.6 |
| Pohon/bukit | 0.5 | 0.8 |
| Latar depan | 0.85–0.95 | 1 |

Referensi memakai angka 0.01–0.16 karena satuan kameranya berbeda; yang penting adalah **urutan dan rasionya**. Faktor di atas 1 membuat lapisan bergerak lebih cepat dari dunia dan terkesan berada di depan karakter.

## Jebakan
- **Sinus berfrekuensi pecahan** meninggalkan jahitan yang terlihat tiap `w` piksel.
- **Tanpa kabut**, semua lapisan berwarna sama dan menyatu jadi satu bercak; matikan "Kabut palet" di demo untuk melihatnya.
- **Lapisan lebih lebar dari layar tidak wajib**, tetapi lapisan lebih sempit dari layar tetap benar selama loop tile berjalan sampai `W`.
- **`camY` dalam piksel** (bukan ternormalisasi) membuat lapisan melompat ratusan piksel. Normalisasi dulu.

## Kode

**Kode: `src/code/14-parallax.js`**

```js
// 14-parallax.js — latar berlapis: tiap lapisan = kanvas kecil yang di-tile mendatar dan digeser dengan faktor berbeda.
PX.Parallax = class {
  constructor(layers) { this.layers = layers; }                  // urut terjauh -> terdekat; layer = { cv, w, h, speed, base }
  draw(ctx, camX, camY, W, H, snap = true) {                     // camX dalam piksel logis; camY ternormalisasi -1..1
    for (const L of this.layers) {
      let ox = -((((camX * L.speed) % L.w) + L.w) % L.w);        // modulo ganda: aman untuk kamera negatif
      let oy = H - L.h + camY * L.h * 0.3 * (0.3 + L.speed);     // lapisan dekat bergeser vertikal lebih jauh
      if (snap) { ox = Math.round(ox); oy = Math.round(oy); }    // tanpa snap: tepi mengabur dan bergetar
      ctx.fillStyle = L.base; ctx.fillRect(0, Math.floor(oy + L.h), W, H);   // isi di bawah lapisan agar tak bolong saat kamera bergerak
      for (let x = ox; x < W; x += L.w) ctx.drawImage(L.cv, x, oy);
    }
  }
};

// Satu lapisan siluet yang MULUS saat di-tile: tinggi permukaan = jumlah sinus berfrekuensi BULAT per lebar tile.
PX.parallaxLayer = (w, h, { speed, seed, col, edge, amp = 0.5, base = 0.45, trees = 0 }) => {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const c = cv.getContext('2d'), r = PX.rng(seed), ph = [r(), r(), r()].map((v) => v * Math.PI * 2), T = (Math.PI * 2) / w;
  const ys = (x) => h * (1 - base) - amp * h * 0.25 * (Math.sin(T * x + ph[0]) + 0.6 * Math.sin(T * 2 * x + ph[1]) + 0.35 * Math.sin(T * 5 * x + ph[2]));
  for (let x = 0; x < w; x++) {
    const y = Math.round(ys(x));
    c.fillStyle = col; c.fillRect(x, y, 1, h - y);               // badan
    c.fillStyle = edge; c.fillRect(x, y, 1, 1);                  // 1 piksel tepi atas lebih terang
  }
  for (let i = 0; i < trees; i++) {                              // pohon pinus segitiga; digambar di x-w, x, x+w agar mulus di jahitan tile
    const tx = Math.round(((i + 0.5 + (PX.hash(i, 7, seed) - 0.5) * 0.7) * w) / trees), th = 6 + Math.round(PX.hash(i, 9, seed) * 6), gy = Math.round(ys((tx + w) % w));
    c.fillStyle = col;
    for (let j = 0; j < th; j++) for (const o of [-w, 0, w]) { const half = Math.floor(j / 2.2); c.fillRect(tx - half + o, gy - th + j, half * 2 + 1, 1); }
  }
  return { cv, w, h, speed, base: col };
};
```

