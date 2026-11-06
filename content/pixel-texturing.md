---
title: Texturing pixel art prosedural — ramp, klaster, tile, dan bake efisien
category: rendering
order: 43
summary: Cara membuat tekstur (batu, rumput, kayu, bata, lava) yang tetap terasa piksel — ramp bergeser hue, noise yang bisa di-tile, dither hanya di batas klaster, lighting dari height-map — lalu di-bake sekali ke indeks palet agar murah.
---
## Prinsip: tekstur piksel = keputusan, bukan gradient
Tekstur piksel yang bagus punya tiga lapis yang dibaca mata berurutan: **(1) bentuk besar** (blok warna, retakan, alur), **(2) klaster** (kumpulan piksel sewarna, bukan piksel tunggal acak), **(3) detail kecil** (1–2 piksel highlight/bintik). Noise halus yang langsung dipetakan ke warna menghasilkan lapis (3) saja — hasilnya tampak kotor dan seperti hasil *resize*. Karena itu seluruh pipeline di bawah selalu: **nilai halus → kuantisasi ke ramp kecil → dither hanya di batas**.

Ringkas untuk AI: jangan menaruh warna per piksel dengan `random()`. Hitung satu **nilai `k` 0..1** per texel dari persamaan, beri **cahaya**, lalu ubah ke **indeks ramp** dengan `PX.tone`.

## Pipeline 5 langkah
1. **Material = ramp + fungsi nilai.** Ramp 5–6 warna (gelap → terang). Fungsi `f(x, y, S)` mengembalikan `k` (mis. batu = noise sel + fbm, retakan menurunkan `k`).
2. **Height-field.** Isi array `F[S×S]` dengan `f`. Nilai ini sekaligus dianggap *tinggi permukaan*.
3. **Lighting dari height (emboss).** `lit = (F[kiri-atas] − F[kanan-bawah]) · emb`. Tepi yang menghadap kiri-atas jadi terang, kanan-bawah gelap — cahaya satu arah yang konsisten dengan seluruh sprite. Tetangga di-*wrap* (`(i+S)%S`) agar tile tetap mulus.
4. **Tone.** `idx = PX.tone(F·0.75 + 0.12 + lit, x, y, jumlahRamp, w)` (lihat bagian dither).
5. **Bake.** Simpan `Uint8Array` indeks + palet. Seterusnya yang dipakai tiap frame hanya hasil bake.

{{demo:texture}}

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
- **Ekspor**: PNG-8 (indexed) dan skala tampilan bilangan bulat — lihat [sprite sheet](sprite-sheet.html). Anti-halo & `image-rendering: pixelated` ada di sana.
- **Detail di atas tile**, bukan di dalamnya: retak besar, lumut, noda dibuat sebagai *decal* sprite kecil ([komposit](sprite-composite.html)) agar tile tetap bisa diulang.

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
{{code:15-texture}}

{{code:49-demo-texture}}
