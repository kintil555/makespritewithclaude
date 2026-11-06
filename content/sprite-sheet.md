---
title: Sprite sheet — grid, pivot, texturing, ekspor anti-halo
category: rendering
order: 40
summary: Skema koordinat atlas, pivot bottom-center, kode canvas dan CSS, palet terbatas, kompresi PNG, image-rendering, dan cara menghindari halo putih.
---
Panduan ini menjawab spesifikasi umum: *frame tunggal 32×32, animasi Walk 6 frame, JS Canvas + CSS, gaya retro pixel art, padding 1px, pivot bottom-center.* Ganti angka sesuai proyek.

## 1. Skema koordinat matriks grid
Atlas satu baris, `F` frame, ukuran frame `FR`, padding `P` di **semua** sisi frame:

```
lebar atlas  = F·FR + (F+1)·P
tinggi atlas = FR + 2·P
frame i: x = P + i·(FR+P),  y = P,  w = h = FR
```

Untuk `F=6, FR=32, P=1`: atlas **199×34**.

| frame | x | y | w | h |
|---|---|---|---|---|
| 0 | 1 | 1 | 32 | 32 |
| 1 | 34 | 1 | 32 | 32 |
| 2 | 67 | 1 | 32 | 32 |
| 3 | 100 | 1 | 32 | 32 |
| 4 | 133 | 1 | 32 | 32 |
| 5 | 166 | 1 | 32 | 32 |

**Pivot / anchor:** titik kaki di `(FR/2, FR-4) = (16, 28)` pada setiap frame. Saat menggambar: `dx = round(posX) - 16`, `dy = round(posY) - 28`. Karena pivot sama di tiap frame, karakter tidak "melompat".

**Aturan integer:** semua argumen `drawImage` (sx, sy, sw, sh, dx, dy) harus integer. Posisi dunia boleh desimal, tetapi dibulatkan **hanya saat render**.

{{demo:sheet}}

## 2. Kode implementasi

### JS Canvas
{{code:31-demo-sheet}}

### CSS sprite (alternatif tanpa canvas)
```css
.hero {
  width: 32px; height: 32px;                 /* ukuran 1 frame */
  background: url(walk.png) -1px -1px;       /* offset padding */
  image-rendering: pixelated;
  transform: scale(3); transform-origin: bottom center;  /* skala bilangan bulat */
  animation: walk .6s steps(6) infinite;
}
@keyframes walk { to { background-position-x: -199px; } }  /* -1 - 6·33 */
```
`steps(6)` melompat 33px per langkah (32 + 1 padding), jadi tiap langkah tepat di frame berikutnya.

## 3. Texturing dan optimasi aset
- **Palet**: 16–32 warna total. Tiap material 4–6 warna (lihat [dither & palet](dither-palette.html)). Hindari hitam murni; outline pakai warna sangat gelap bergeser hue.
- **Shading**: 1 sumber cahaya tetap (kiri-atas). Highlight di tepi atas, shade di tepi bawah, outline 1px, dither hanya di area luas. Teknik ini otomatis dihasilkan oleh [pixelize](hires-to-pixel.html).
- **Format**: PNG indexed (PNG-8) — kecil dan palet tepat. Kompres lossless dengan `oxipng -o max` atau `pngquant --nofs --quality 100`. Jangan JPEG. WebP lossless boleh; hindari WebP/AVIF lossy karena menodai piksel.
- **Properti render browser**:
  ```css
  canvas, img.sprite { image-rendering: pixelated; image-rendering: crisp-edges; } /* fallback Firefox lama */
  ```
  ```js
  ctx.imageSmoothingEnabled = false;
  ```
- **Skala tampilan**: pilih faktor **bilangan bulat** (2×, 3×, 4×). Skala 2.5× membuat piksel tidak seragam. Untuk layar HiDPI: `canvas.width = round(cssW · dpr)` dan pilih skala sehingga `scale · dpr` integer.
- **Hindari sub-pixel**: `Math.round` posisi sebelum `drawImage`; jangan `translate(0.5, …)` kecuali untuk garis 1px.
- **Padding 0 vs 1px**: dengan `imageSmoothingEnabled=false` dan skala integer, 0px sudah aman. Pakai 1px bila memakai WebGL/mipmap, skala non-integer, atau atlas dipotong otomatis oleh engine.

### Mencegah halo putih / garis tepi
1. Ekspor dengan alpha **0 atau 255** saja (tanpa anti-alias tepi). `PX.pixelize` sudah begini.
2. Bila tetap memakai tepi lunak: **alpha bleed** — isi RGB piksel transparan dengan warna piksel solid terdekat (jangan putih) sebelum ekspor, atau ekspor tanpa "matte" putih.
3. WebGL: gunakan *premultiplied alpha* secara konsisten (`gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)` + `blendFunc(ONE, ONE_MINUS_SRC_ALPHA)`).
4. Jangan menyimpan sprite di atas latar putih lalu di-"cut"; render langsung ke canvas transparan.
5. Beri **ekstrusi** 1px (gandakan piksel tepi frame ke padding) bila memakai skala non-integer atau filter linear.
