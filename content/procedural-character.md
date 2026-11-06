---
title: Karakter prosedural dari persamaan
category: karakter
order: 100
summary: Setiap piksel menanyakan koordinat lokal badan; bentuk berasal dari persamaan elips/kapsul, wajah dari bitmap string, outline dari siluet.
---
## Pendekatan "per-piksel query"
Alih-alih menaruh piksel satu per satu, untuk tiap piksel layar:

1. Ubah ke **koordinat lokal** `(f, u)` = (maju, atas) dengan rotasi miring terhadap titik kaki. Rotasi memakai pemetaan **terbalik**, jadi tidak ada lubang.
2. Uji bentuk dengan persamaan: kapsul (jarak titik ke segmen ≤ r) untuk anggota badan, superellipse `|f/rf|ⁿ + |u/ru|ⁿ ≤ 1` untuk kepala/badan (`n=2` elips, `n=3` kotak membulat).
3. Urutan tulis = urutan lapisan: anggota badan **jauh** (tone gelap) → torso → anggota **dekat** → kepala.
4. Shading dari persamaan sendiri: nilai superellipse > 0.78 = tepi (shade); bagian kiri-atas = highlight.
5. Wajah: **bitmap string** (`'.##...##.'`) dipetakan terbalik ke koordinat lokal; kedip = lewati bitmap.
6. Setelah semua indeks palet terisi: kosong yang bertetangga dengan terisi → outline.

Keuntungan: ukuran dan proporsi parametrik; pose (swing, tilt, bob) cukup mengubah angka; AI mudah memodifikasinya.

{{demo:char}}

Gerakkan mouse untuk memiringkan robo.

## Kode
{{code:46-demo-char}}
