# Texturing pixel art prosedural — ramp, klaster, tile, dan bake efisien

> Cara membuat tekstur (batu, rumput, kayu, bata, lava) yang tetap terasa piksel — ramp bergeser hue, noise yang bisa di-tile, dither hanya di batas klaster, lighting dari height-map — lalu di-bake sekali ke indeks palet agar murah.

Kategori: Teknik Rendering · URL: https://makespritewithclaude.pages.dev/articles/pixel-texturing.html

## Prinsip: tekstur piksel = keputusan, bukan gradient
Tekstur piksel yang bagus punya tiga lapis yang dibaca mata berurutan: **(1) bentuk besar** (blok warna, retakan, alur), **(2) klaster** (kumpulan piksel sewarna, bukan piksel tunggal acak), **(3) detail kecil** (1–2 piksel highlight/bintik). Noise halus yang langsung dipetakan ke warna menghasilkan lapis (3) saja — hasilnya tampak kotor dan seperti hasil *resize*. Karena itu seluruh pipeline di bawah selalu: **nilai halus → kuantisasi ke ramp kecil → dither hanya di batas**.

Ringkas untuk AI: jangan menaruh warna per piksel dengan `random()`. Hitung satu **nilai `k` 0..1** per texel dari persamaan, beri **cahaya**, lalu ubah ke **indeks ramp** dengan `PX.tone`.

## Pipeline 5 langkah
1. **Material = ramp + fungsi nilai.** Ramp 5–6 warna (gelap → terang). Fungsi `f(x, y, S)` mengembalikan `k` (mis. batu = noise sel + fbm, retakan menurunkan `k`).
2. **Height-field.** Isi array `F[S×S]` dengan `f`. Nilai ini sekaligus dianggap *tinggi permukaan*.
3. **Lighting dari height (emboss).** `lit = (F[kiri-atas] − F[kanan-bawah]) · emb`. Tepi yang menghadap kiri-atas jadi terang, kanan-bawah gelap — cahaya satu arah yang konsisten dengan seluruh sprite. Tetangga di-*wrap* (`(i+S)%S`) agar tile tetap mulus.
4. **Tone.** `idx = PX.tone(F·0.75 + 0.12 + lit, x, y, jumlahRamp, w)` (lihat bagian dither).
5. **Bake.** Simpan `Uint8Array` indeks + palet. Seterusnya yang dipakai tiap frame hanya hasil bake.

> **Demo interaktif "texture"**: buka halaman web artikel ini untuk menjalankannya. Kodenya ada di bawah.

Ganti material, mode dither, dan ukuran tile. Tampilan 3×3 membuktikan tile mulus. Mode "tanpa dither" memperlihatkan banding; "dither penuh" memperlihatkan kenapa noise di mana-mana terlihat kotor.

## Ramp bergeser hue
Aturan yang dipakai pixel artist dan pack tekstur retro: mulai dari **midtone**, tambah **satu bayangan dan satu highlight**, baru tambah tingkat lain; jarak kecerahan antar tingkat **seimbang**; dan geser hue — bayangan sedikit lebih dingin (ungu/biru), highlight lebih hangat (kuning/putih). Tanpa pergeseran, ramp terlihat seperti sekadar pengaturan kecerahan dan pucat.

| Material | Ramp (gelap → terang) | Catatan |
|---|---|---|
| Batu | `#2b2a3a #4a4a5e #6e6f80 #9a9aa6 #cfcdd2` | bayangan keunguan |
| Rumput | `#1f3a2e #2f6b3a #4f9a3f #86c24a #c9e56e` | bayangan kebiruan, highlight kekuningan |
| Kayu | `#2a1a22 #5a3326 #8a5530 #b57d44 #dba868` | bayangan ke arah ungu-cokelat |
| Bata | `#2d1b25 #5c2b2e #8c4636 #b86a48 #e0a070` | |
| Lava | `#1a0e1e #4a1424 #a82a1a #f06a1e #ffd24a #fff4c8` | 6 warna, ujung terang = emisi |

Jangan pakai hitam murni (`#000`) atau putih murni sebagai warna material; sisakan untuk outline atau kilat.

## Noise yang cocok untuk piksel
Semua fungsi ada di `15-texture.js`, deterministik per `seed`, dan **bisa di-tile**.

- `PX.vnoise(x, y, seed, px, py)` — value noise halus. `x,y` dalam satuan sel lattice. Argumen `px/py` adalah **periode dalam sel**; dengan periode, noise berulang tepat tiap periode sehingga tile mulus.
- `PX.fbm(...)` — jumlah oktaf (frekuensi ×2, amplitudo ×0.5). Periode ikut dikali 2 tiap oktaf.
- `PX.worley(...)` → `[jarakTerdekat, jarak2 − jarak1]`. Elemen kedua ≈ 0 di batas sel: pakai untuk **retakan batu, mortar, pecahan lava**.
- `PX.hash(x, y, seed)` — noise blok tanpa interpolasi: untuk bintik acak 1 piksel (bunga/helai rumput), bukan untuk bentuk besar.

**Aturan tile mulus:** ukuran tile `S` kelipatan 4 (16/32/64) agar Bayer 4×4 ikut mulus; ukuran sel noise harus **pembagi `S`** (`S/8`, `S/4`) sehingga periode = bilangan bulat; tetangga lighting di-wrap. Cek tile dalam tampilan 3×3 **sebelum** menambah shading — kesalahan tile lebih mudah terlihat di tahap awal.

**Anisotropi**: rumput = fbm direntang vertikal (`x/2, y/8`), kayu = `sin` pada `y + warp` dengan `warp` dari fbm. Cukup skala sumbu berbeda; bukan rotasi.

## Klaster vs dither
`PX.tone(k, x, y, n, w)` memetakan `k` ke indeks ramp. Parameter `w` adalah lebar pita dither di sekitar batas dua tingkat:

| `w` | Hasil | Pakai untuk |
|---|---|---|
| `0` | klaster keras, ada banding | permukaan datar bergaya NES/GB, UI |
| `0.25` (default) | klaster solid, dither **hanya di batas** | hampir semua tekstur |
| `1` | dither di seluruh area | transisi besar (langit, kabut), bukan material |

Dither yang menyebar ke seluruh permukaan membuat tekstur berisik dan menghilangkan "bentuk". Dither di batas membuat transisi terlihat sengaja. Pola Bayer memakai koordinat texel lokal, jadi tetap stabil dan ikut tile.

## Resep material
| Material | Inti persamaan |
|---|---|
| Batu | `worley(x/8,y/8)`: `edge < 0.09` → `k ×= 0.3` (retak); `k = 0.25 + 0.55·fbm + 0.2·d1` |
| Rumput | `0.2 + 0.55·fbm(x/2, y/8)` + 10% piksel `hash > 0.9` dinaikkan `+0.25` |
| Kayu | `0.5 + 0.35·sin((y+warp)·2π·4/S) + 0.15·(hash−0.5)` |
| Bata | tinggi bata `S/4`, lebar `S/2`, baris ganjil digeser setengah; garis mortar `k = 0.1`; tiap bata `0.45 + 0.3·hash(id) + 0.25·fbm` |
| Lava | `glow = 1 − edge/0.35` kuadrat; `k = 0.12 + 0.2·fbm + 0.75·glow²` — retakan menjadi sumber cahaya |

## Teknik efisien
- **Bake sekali.** Hitung noise hanya saat memuat atau ganti seed. Tiap frame cukup `drawImage(tile)`. Noise fbm per piksel per frame adalah kesalahan performa paling umum.
- **Indeks, bukan RGB.** Simpan texel sebagai 1 byte (`Uint8Array`) + palet. Memori 4× lebih kecil, dan *recolor* = mengganti palet (biome, siang/malam, kena-hit) tanpa menghitung ulang tekstur.
- **Animasi dengan memutar palet** (*palette cycling*): untuk lava/air, geser indeks pada daerah bertanda: `color = pal[(idx + floor(t·8)) % n]` hanya untuk texel bermask. Nol hitungan noise.
- **Tile kecil + variasi.** Bake 3–4 varian tile 16×16 atau 32×32 (seed berbeda), pilih per sel dengan `hash(cx, cy) → varian`. Ini menghilangkan pola berulang tanpa atlas besar.
- **Layar penuh**: `ctx.createPattern(tileCanvas, 'repeat')` dengan `imageSmoothingEnabled = false`, atau `drawImage` per sel dengan posisi integer.
- **Ekspor**: PNG-8 (indexed) dan skala tampilan bilangan bulat — lihat [sprite sheet](https://makespritewithclaude.pages.dev/md/sprite-sheet.md). Anti-halo & `image-rendering: pixelated` ada di sana.
- **Detail di atas tile**, bukan di dalamnya: retak besar, lumut, noda dibuat sebagai *decal* sprite kecil ([komposit](https://makespritewithclaude.pages.dev/md/sprite-composite.md)) agar tile tetap bisa diulang.

```js
// pakai: bake sekali -> gambar berulang
const tile = PX.texCanvas(PX.bakeTex('brick', 32, { seed: 4, dither: 'cluster', emb: 0.5 }));
for (let y = 0; y < H; y += 32) for (let x = 0; x < W; x += 32) ctx.drawImage(tile, x, y);

// palette cycling untuk lava (mask = texel yang boleh beranimasi)
const colorOf = (i, mask, t, pal) => pal[mask ? (i + Math.floor(t * 6)) % pal.length : i];
```

## Checklist untuk AI
1. Ramp 4–6 warna per material, bergeser hue, tanpa hitam murni.
2. Satu arah cahaya (kiri-atas) untuk seluruh adegan.
3. Nilai `k` dari persamaan, bukan `Math.random()` per piksel.
4. Sel noise membagi `S`; `S` ∈ {16, 32, 64}; tile diuji dalam grid 3×3.
5. `w = 0.25` kecuali ada alasan; tidak ada piksel yatim (1 piksel warna beda di tengah klaster) kecuali sebagai bintik yang disengaja.
6. Bake sekali, simpan indeks, ubah ke canvas, gambar dengan skala bilangan bulat.
7. Periksa dengan **melihat** hasil yang diperbesar nearest-neighbor, bukan menebak.

Referensi yang dipakai untuk aturan di atas: [Minecraft Style Guide (Blockbench)](https://blockbench.net/wiki/guides/minecraft-style-guide) — ramp dari midtone, hue shifting, dithering, uji tile 3×3; [Phaser retro textures](https://phaser.io/packs/retro-textures/api) — ramp 8 tingkat bergeser hue, height-map dan glow-mask per texel; [Phaser procgen](https://phaser.io/packs/procgen/api) — noise Perlin/value/Worley dengan parameter `period` agar tile.

## Kode

**Kode: `src/code/15-texture.js`**

```js
// 15-texture.js — texturing prosedural bergaya piksel: noise yang bisa di-tile, ramp bergeser hue, dither hanya di batas klaster, lighting dari height-map. Dibake SEKALI ke indeks palet.
PX.vnoise = (x, y, seed = 0, px = 0, py = px) => {      // value noise halus 0..1; x,y dalam satuan sel lattice; px/py = periode (sel) agar tile mulus
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const wx = (i) => (px ? ((i % px) + px) % px : i), wy = (j) => (py ? ((j % py) + py) % py : j);
  const a = PX.hash(wx(x0), wy(y0), seed), b = PX.hash(wx(x0 + 1), wy(y0), seed), c = PX.hash(wx(x0), wy(y0 + 1), seed), d = PX.hash(wx(x0 + 1), wy(y0 + 1), seed);
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};
PX.fbm = (x, y, seed = 0, px = 0, py = px, oct = 3) => {   // tumpuk oktaf: frekuensi x2, amplitudo x0.5 (periode ikut x2 -> tetap tile)
  let s = 0, n = 0, a = 0.5;
  for (let o = 0; o < oct; o++, a *= 0.5, x *= 2, y *= 2, px *= 2, py *= 2) { s += a * PX.vnoise(x, y, seed + o * 17, px, py); n += a; }
  return s / n;
};
PX.worley = (x, y, seed = 0, px = 0, py = px) => {      // noise sel: [jarak titik terdekat, jarak2 - jarak1]; elemen ke-2 ≈ 0 di batas sel (retakan/mortar)
  const x0 = Math.floor(x), y0 = Math.floor(y); let d1 = 9, d2 = 9;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = x0 + i, cy = y0 + j, wx = px ? ((cx % px) + px) % px : cx, wy = py ? ((cy % py) + py) % py : cy;
    const d = Math.hypot(cx + PX.hash(wx, wy, seed) - x, cy + PX.hash(wx, wy, seed + 1) - y);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
  }
  return [d1, d2 - d1];
};

// Pilih indeks ramp dari nilai k (0..1). w = lebar pita dither: 0 = klaster keras tanpa dither, 0.25 = dither hanya di batas klaster, 1 = dither penuh.
PX.tone = (k, x, y, n, w = 0.25) => {
  const v = PX.clamp(k, 0, 0.9999) * (n - 1), i = Math.floor(v), f = v - i;
  if (w <= 0) return f >= 0.5 ? i + 1 : i;
  const t = PX.clamp((f - 0.5) / w + 0.5, 0, 1);
  return i + (t > PX.bayer(x, y) ? 1 : 0);
};

// Material = ramp (gelap -> terang, hue bergeser) + fungsi nilai f(x,y,S,seed) -> 0..1. Semua noise memakai periode bulat agar tile mulus.
PX.MAT = {
  stone: { ramp: ['#2b2a3a', '#4a4a5e', '#6e6f80', '#9a9aa6', '#cfcdd2'], f: (x, y, S, s) => {
    const w = PX.worley(x / 8, y / 8, s, S / 8), crack = w[1] < 0.09 ? 0.3 : 1;
    return (0.25 + 0.55 * PX.fbm(x / 4, y / 4, s + 5, S / 4) + 0.2 * w[0]) * crack;
  } },
  grass: { ramp: ['#1f3a2e', '#2f6b3a', '#4f9a3f', '#86c24a', '#c9e56e'], f: (x, y, S, s) =>
    0.2 + 0.55 * PX.fbm(x / 2, y / 8, s, S / 2, S / 8) + (PX.hash(x, y, s + 3) > 0.9 ? 0.25 : 0) },
  wood: { ramp: ['#2a1a22', '#5a3326', '#8a5530', '#b57d44', '#dba868'], f: (x, y, S, s) => {
    const warp = PX.fbm(x / 8, y / 4, s, S / 8, S / 4) * 5, g = Math.sin(((y + warp) * Math.PI * 2 * 4) / S);
    return 0.5 + 0.35 * g + 0.15 * (PX.hash(x, y, s + 9) - 0.5);
  } },
  brick: { ramp: ['#2d1b25', '#5c2b2e', '#8c4636', '#b86a48', '#e0a070'], f: (x, y, S, s) => {
    const bh = S / 4, bw = S / 2, row = Math.floor(y / bh), xx = (x + (row & 1) * (bw / 2)) % S;
    if (y % bh === 0 || xx % bw === 0) return 0.1;
    return 0.45 + 0.3 * PX.hash(Math.floor(xx / bw), row, s) + 0.25 * PX.fbm(x / 4, y / 4, s + 2, S / 4);
  } },
  lava: { ramp: ['#1a0e1e', '#4a1424', '#a82a1a', '#f06a1e', '#ffd24a', '#fff4c8'], f: (x, y, S, s) => {
    const w = PX.worley(x / 8, y / 8, s, S / 8), glow = Math.max(0, 1 - w[1] / 0.35);
    return 0.12 + 0.2 * PX.fbm(x / 4, y / 4, s, S / 4) + 0.75 * glow * glow;
  } },
};

// Bake: height-field -> lighting emboss (kiri-atas) -> indeks palet Uint8. Dijalankan sekali; hasilnya yang dipakai tiap frame.
PX.bakeTex = (mat, S = 32, o = {}) => {
  const m = PX.MAT[mat], n = m.ramp.length, seed = o.seed ?? 1, emb = o.emb ?? 0.5, w = o.dither === 'none' ? 0 : o.dither === 'full' ? 1 : 0.25;
  const F = new Float32Array(S * S), idx = new Uint8Array(S * S), W = (i) => (i + S) % S;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) F[y * S + x] = PX.clamp(m.f(x, y, S, seed), 0, 1);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const h = F[y * S + x], lit = (F[W(y - 1) * S + W(x - 1)] - F[W(y + 1) * S + W(x + 1)]) * emb;   // beda tetangga kiri-atas vs kanan-bawah
    idx[y * S + x] = PX.tone(h * 0.75 + 0.12 + lit, x, y, n, w);                                   // Bayer memakai koordinat lokal (S kelipatan 4 -> tetap tile)
  }
  return { S, idx, pal: m.ramp.map(PX.hex) };
};
PX.texCanvas = (t) => {                                  // indeks -> canvas kecil (1 piksel = 1 texel); gambar membesar dengan image-rendering: pixelated
  const cv = document.createElement('canvas'); cv.width = cv.height = t.S;
  const img = new ImageData(t.S, t.S);
  for (let i = 0; i < t.idx.length; i++) { const c = t.pal[t.idx[i]]; img.data[i * 4] = c[0]; img.data[i * 4 + 1] = c[1]; img.data[i * 4 + 2] = c[2]; img.data[i * 4 + 3] = 255; }
  cv.getContext('2d').putImageData(img, 0, 0);
  return cv;
};
```



**Kode: `src/code/49-demo-texture.js`**

```js
// Demo texturing: bake 1 tile ke indeks palet, tampilkan 3x3 untuk mengecek tile. Ganti material, mode dither, ukuran tile, kekuatan emboss.
PX.demos.texture = (host) => {
  let mat = 'stone', dither = 'cluster', S = 32, emb = 0.5, seed = 1, tile;
  const cv = PX.canvas(host, 96, 96, 480, false, '3×3 tile — garis sambungan tidak boleh terlihat'), c = cv.getContext('2d'), ui = PX.ui(host);
  const bake = () => { tile = PX.texCanvas(PX.bakeTex(mat, S, { dither, emb, seed })); draw(); };
  const draw = () => { c.clearRect(0, 0, 96, 96); c.imageSmoothingEnabled = false; for (let j = 0; j < 96 / S; j++) for (let i = 0; i < 96 / S; i++) c.drawImage(tile, i * S, j * S); };
  ui.select('Material', ['stone', 'grass', 'wood', 'brick', 'lava'], mat, (v) => { mat = v; bake(); });
  ui.select('Dither', [{ label: 'klaster + dither di batas', value: 'cluster' }, { label: 'dither penuh (noisy)', value: 'full' }, { label: 'tanpa dither (banding)', value: 'none' }], dither, (v) => { dither = v; bake(); });
  ui.select('Tile', ['16', '32'], String(S), (v) => { S = +v; bake(); });
  ui.range('Emboss', 0, 1.2, 0.1, emb, (v) => { emb = v; bake(); });
  ui.button('Seed baru', () => { seed = (seed * 7 + 3) % 97; bake(); });
  bake();
};
```

