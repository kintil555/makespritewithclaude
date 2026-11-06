---
title: Parallax berlapis — kedalaman dari faktor kecepatan
category: rendering
order: 45
summary: Latar 3–5 lapisan siluet yang di-tile mulus, digeser dengan faktor kecepatan berbeda, di-snap ke piksel integer, dengan kabut yang dibakar ke palet lapisan, bukan alpha per frame.
---
## Prinsip
Kedalaman dibuat dari **perbedaan kecepatan**, bukan dari 3D. Tiap lapisan adalah kanvas kecil beresolusi logis yang di-tile mendatar; lapisan jauh bergeser sedikit, lapisan dekat bergeser hampir sebesar dunia. Pola ini dianalisis dari latar berlapis pada referensi Sprite Fusion (3–5 lapisan, faktor kecil untuk yang jauh, besar untuk yang dekat).

1. **Offset mendatar.** `ox = -(((camX · speed) mod w) + w) mod w`. Modulo ganda membuat kamera negatif tetap benar. Tile digambar dari `ox` sampai melewati lebar layar, tiap `w` piksel.
2. **Offset vertikal.** `oy = H − h + camY · h · 0.3 · (0.3 + speed)` dengan `camY` ternormalisasi `−1..1`. Lapisan dekat bergeser lebih jauh, jadi mendongak/menunduk juga terasa dalam.
3. **Snap integer.** `ox` dan `oy` dibulatkan sebelum `drawImage`. Tanpa snap, canvas menginterpolasi dan tepi siluet mengabur lalu bergetar.
4. **Tile mulus.** Permukaan dibangun dari jumlah sinus berfrekuensi **bulat** per lebar tile (1, 2, 5), sehingga ujung kiri dan kanan bertemu. Objek (pohon) digambar di `x−w`, `x`, `x+w` agar tidak terpotong di jahitan.
5. **Kabut lewat palet.** Warna lapisan = campuran warna langit bawah dan warna gelap, makin jauh makin dekat ke langit. Dihitung sekali saat membangun lapisan; tidak ada alpha per frame, jadi palet tetap terbatas.
6. **Lebar tile berbeda-beda** (256, 200, 168, 136). Lebar yang sama membuat jahitan semua lapisan selalu sejajar dan pola terlihat berulang.
7. **Isi di bawah lapisan** dengan warna dasarnya, agar tidak ada celah saat kamera naik atau turun.

{{demo:parallax}}

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
{{code:14-parallax}}
