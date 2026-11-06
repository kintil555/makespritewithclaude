---
title: Palet terbatas dan ordered dithering
category: rendering
order: 20
summary: Shading bola/benda dengan 5–6 warna dan matriks Bayer 4×4 sebagai ganti gradient, supaya tetap terlihat pixel art.
---
## Prinsip
Gradient halus langsung merusak gaya piksel. Gunakan **ramp** 5–6 warna (gelap → terang) dan pilih indeks per piksel dari nilai cahaya `k` (0..1):

```
v   = k * (n - 1)
idx = floor(v + bayer(x, y))     // bayer(x,y) di (0,1), tak bias
```

`bayer(x,y)` memakai matriks 4×4 yang bergantung pada posisi piksel, jadi pola dither **stabil** (tidak berkedip saat objek diam). Tanpa dither (`round(v)`) kita dapat pita warna keras; dengan dither, transisi terlihat bertekstur.

{{demo:dither}}

## Resep ramp
| Peran | Aturan |
|---|---|
| Warna 0 | sangat gelap, hue digeser ke ungu/biru (bukan hitam murni) |
| Warna 1–3 | tubuh utama; kecerahan naik, hue bergeser ke kuning |
| Warna 4–5 | highlight; terakhir hampir putih |

Tekstur permukaan: tambahkan noise **blok** (hash integer, bukan noise halus) ke `k` sebelum dither. Lihat `PX.hash`.

## Aturan
- Maksimal 6 warna per material; seluruh adegan idealnya ≤ 32 warna.
- Pola Bayer ditentukan **koordinat layar/atlas**, bukan koordinat lokal objek, bila ingin pola tetap saat objek bergerak; pakai koordinat lokal bila ingin pola "menempel" pada objek.
- Dither hanya di area luas (bola, tanah). Pada garis 1–2 piksel, pakai warna solid.

## Kode
{{code:32-demo-dither}}

Helper (Bayer & hash) ada di inti:

{{code:00-core}}
