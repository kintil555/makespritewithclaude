---
title: Hujan prosedural 3 lapis kedalaman
category: efek
order: 85
summary: Tetes dua warna, tiga lapis kecepatan, kabut tanah ber-noise, percikan setengah elips, dan lapis depan yang menutupi karakter.
---
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

{{demo:rain}}

## Kode
{{code:47-demo-rain}}
