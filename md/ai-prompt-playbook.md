# Panduan prompt untuk AI — sprite pixel yang benar sejak percobaan pertama

> Template spesifikasi, aturan ketat, urutan kerja, dan checklist verifikasi agar Claude atau AI lain menghasilkan sprite pixel prosedural yang tajam dan konsisten.

Kategori: Panduan untuk AI · URL: https://makespritewithclaude.pages.dev/articles/ai-prompt-playbook.html

## Aturan emas (jika hanya membaca satu bagian)
1. **Jangan menggambar piksel secara manual.** Render halus resolusi tinggi → turunkan ke grid ([teknik inti](https://makespritewithclaude.pages.dev/md/hires-to-pixel.md)).
2. **Semua koordinat tujuan adalah integer.** Bulatkan saat render, bukan saat simulasi.
3. **Palet terbatas** (≤ 6 warna per material) dengan ramp dan dither Bayer ([palet](https://makespritewithclaude.pages.dev/md/dither-palette.md)).
4. **Efek = lapisan disc berpiksel**, bukan gradient/`arc()` anti-alias ([buffer](https://makespritewithclaude.pages.dev/md/pixel-buffer.md)).
5. **Alpha hanya 0 atau 255** pada hasil akhir (anti-halo).
6. **Verifikasi dengan melihat**: render ke PNG, perbesar (nearest-neighbor), periksa; jangan menebak.

## Template spesifikasi (isi lalu kirim ke AI)
```
Nama aset        : [mis. Karakter utama / ubin tanah / efek ledakan]
Ukuran 1 frame  : [mis. 32x32 px]
Animasi & frame : [mis. Idle 4, Walk 6]
Output kode     : [JS Canvas | CSS sprite]
Gaya visual     : [Retro pixel art | clean vector | hand-drawn]
Palet           : [mis. 16 warna, hue shift dingin di bayangan]
Padding atlas   : [0px | 1px]
Pivot           : [mis. bottom-center (16,28)]
Latar uji       : [mis. #14121c gelap]
```
Minta hasil dalam urutan: (1) skema koordinat atlas, (2) kode implementasi bersih, (3) panduan texturing & optimasi (format, kompresi warna, `image-rendering`). Contoh jawaban lengkap: [sprite sheet](https://makespritewithclaude.pages.dev/md/sprite-sheet.md).

## Aturan ketat untuk AI
- **Grid & padding**: X/Y integer, tanpa desimal (cegah blur sub-pixel). Hitung `x = P + i·(FR+P)`.
- **Spacing**: gunakan 1px padding bila WebGL / skala non-integer; 0px cukup untuk canvas 2D dengan smoothing mati.
- **Pivot**: tentukan satu titik tetap (mis. kaki) dan gambar dengan `dx = round(x) − pivot.x`.
- **Texturing**: 1 arah cahaya; highlight di tepi atas, shade di tepi bawah, outline 1px, dither hanya di area luas.
- **Ekspor**: PNG-8 indexed, tanpa anti-alias tepi; jika ada tepi lunak lakukan alpha bleed.
- **Browser**: `image-rendering: pixelated`, `ctx.imageSmoothingEnabled = false`, skala tampilan integer.

## Urutan kerja yang disarankan
1. Tentukan spesifikasi (template di atas).
2. Buat **rig** halus (tulang/IK atau persamaan bentuk) — [stickman IK](https://makespritewithclaude.pages.dev/md/hires-to-pixel.md) atau [karakter dari persamaan](https://makespritewithclaude.pages.dev/md/procedural-character.md).
3. Turunkan ke piksel dengan `PX.pixelize` / pemetaan per-piksel.
4. Tambah efek dari katalog: [tracer](https://makespritewithclaude.pages.dev/md/tracer-muzzle.md), [ledakan](https://makespritewithclaude.pages.dev/md/explosion.md), [lubang](https://makespritewithclaude.pages.dev/md/crater-hole.md), [api](https://makespritewithclaude.pages.dev/md/fire.md), [neutron/pulsar](https://makespritewithclaude.pages.dev/md/neutron-psr.md).
5. Bake atlas ([sprite sheet](https://makespritewithclaude.pages.dev/md/sprite-sheet.md)) dan uji di latar gelap.
6. Periksa checklist.

## Checklist verifikasi
- [ ] Zoom 800% nearest-neighbor: tidak ada piksel setengah transparan.
- [ ] Tidak ada warna di luar palet (hitung warna unik).
- [ ] Siluet terbaca di latar gelap dan terang (ada outline).
- [ ] Tidak ada garis putih di tepi pada latar #14121c.
- [ ] Antar frame: pivot tidak bergeser (kaki tidak "melayang").
- [ ] Posisi gambar di layar integer; tidak ada jitter saat bergerak lambat.

## Kesalahan umum AI
| Gejala | Penyebab | Perbaikan |
|---|---|---|
| Sprite buram | canvas di-scale non-integer / smoothing aktif | skala integer, `image-rendering: pixelated` |
| Tepi berduri/halo | anti-alias di PNG akhir | ambang cakupan ≥50%, alpha 0/255 |
| Bayangan berkedip | pola dither pakai koordinat objek yang berubah | pakai koordinat layar/atlas |
| Efek "mengambang" tidak menyatu | glow dengan gradient | disc dither atau additive alpha rendah |
| Anggota badan menipis saat bergerak | menggambar piksel langsung | render halus dulu |
