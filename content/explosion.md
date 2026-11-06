---
title: Ledakan prosedural berlapis
category: efek
order: 60
summary: Kilat putih, gumpalan bola api 5 lapis, sinar radiasi, gelombang kejut bergelombang, partikel, dan asap — dengan palet api atau neutron.
---
## Lapisan (urutan gambar)
1. **Asap** (di belakang): disc besar bertahap gelap, alpha ~0.55 menurun.
2. **Haze**: disc radius `R·(1+0.9e)` alpha 0.14 warna paling gelap.
3. **Kilat**: 14% awal, disc putih membesar dengan alpha menurun.
4. **Gumpalan bola api**: 10 lobus acak. Tiap lobus = **5 disc konsentris** (gelap → putih) dengan radius `1, .86, .64, .42, .22` dan alpha `.55, .7, .85, .95, 1`.
5. **Sinar**: 26 garis dari 0.3R, pendek–panjang acak, warna putih → tengah → gelap menurut jarak, 10% piksel dilewat agar bergerigi.
6. **Gelombang kejut**: 2 cincin, radius `rr·(1 + 0.07·sin3θ + 0.05·sin5θ + 0.03·sin9θ)` + jitter ±0.7. Bentuk tak beraturan membuatnya terasa organik.
7. **Partikel**: 60 piksel, kecepatan `√random` (lebih banyak dekat pusat), gravitasi.

Easing keluar: `e = 1 - (1-u)²`, alpha `a = (1-u)^1.1`, `u = t/life`. Semua posisi di-`round` oleh `PX.Buf`.

## Ganti palet = ganti tema
Hanya 5 warna ramp + 4 warna asap. Pilih "neutron" pada demo untuk versi biru.

{{demo:blast}}

Klik untuk meledakkan.

## Kode
{{code:41-demo-blast}}
