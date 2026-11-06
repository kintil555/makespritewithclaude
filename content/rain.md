---
title: Hujan prosedural 3 lapis kedalaman
category: efek
order: 85
summary: Tetes dua warna, tiga lapis kecepatan, kabut tanah ber-noise, percikan setengah elips, dan lapis depan yang menutupi karakter.
---
> Ide diambil dari `rain.ts` oleh Sprite Fusion (lisensi MIT, © 2026 Hugo Duprez). Implementasi di bawah ditulis ulang untuk situs ini.

## Mengapa terlihat bagus
1. **Tiga lapis kedalaman.** Jauh / tengah / dekat berbeda dalam kecepatan (`380 / 525 / 725`), panjang (`3 / 6 / 12` piksel), dan warna. Semakin dekat, semakin cepat, panjang, dan terang.
2. **Tetes = dua segmen.** 60% ekor warna gelap + 40% kepala warna terang. Satu garis polos terlihat datar; dua tone memberi arah gerak.
3. **Lapis jauh berhenti di udara.** Tiap tetes lapis jauh punya `stop` acak 5–70 piksel di atas tanah lalu respawn. Tidak ada percikan, sehingga terkesan jauh di belakang.
4. **Hanya lapis depan menyentuh tanah dengan percikan penuh** (lapis tengah 60%). Percikan = cincin **setengah elips** (`ry = 0.25·rx`) yang melebar `rx = 1 + 5·√u`, digambar 3 lintasan radius (±0.5) agar tebal dan alpha turun. Elips berada **di bawah** garis tanah, jadi tanah harus digambar *sebelum* hujan belakang, bukan sesudahnya.
5. **Alpha menjadi dither.** `dot(x,y,c,a)` menggambar hanya jika `a > bayer(x,y)`. Tidak ada piksel semi-transparan.
6. **Kabut tanah**: noise 1D dua frekuensi yang bergerak berlawanan arah, tinggi 9 piksel, alpha ≤ 0.32 → dither.
7. **Serpihan air**: 0–2 partikel 1px per tetes dengan gravitasi, hidup 0.18–0.32 detik.
8. **Tanah tak rata.** `ground` boleh angka atau fungsi `x → y`. Tetes, percikan, serpihan, dan kabut semuanya membaca `gy(x)`, jadi hujan mengikuti bukit dan tangga.
9. **Urutan gambar**: latar + tanah → **lapis jauh/tengah + kabut + percikan** → karakter → **lapis depan**. Tetes yang lewat di depan karakter memberi kesan ruang.
10. **Reda bertahap.** `stop()` menghentikan respawn; tetes yang sudah ada habis sendiri dan `done` bernilai `true` saat semuanya hilang, tanpa memotong hujan mendadak.
11. **Sebaran mendatar mengikuti kemiringan.** Margin spawn `|slant|·(tinggi+110)` ditaruh di sisi hulu angin, sehingga hujan miring kanan tidak meninggalkan sisi kiri kosong.

Semua tetes direspawn dari atas (`reset(d, true)`), jadi jumlah partikel konstan, tanpa alokasi per frame.

{{demo:rain}}

## Kode
{{code:47-demo-rain}}
