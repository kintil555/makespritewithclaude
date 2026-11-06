---
title: Api dan asap dari partikel disc berlapis
category: efek
order: 80
summary: Ramp 9 warna, partikel membesar saat menua, inti bergeser ke atas, highlight kecil, glow additive, dan asap.
---
## Resep
- **Ramp** (panas → dingin): `#fff, #fff3a6, #ffe26b, #ffc23d, #ff8a2a, #f2561d, #c9281f, #8a1f17, #4a1712`.
- Indeks warna dari umur: `ct = floor((u·1.12 + acak·0.08) · 9)`.
- Radius membesar: `it = sz·1.8·(0.55 + u^0.6·1.9)`.
- **Gambar 3 disc**: tepi = `ramp[ct+2]` (lebih gelap), badan = `ramp[ct]` bergeser `(−0.14, −0.2)·it` (naik), highlight = `ramp[ct−1]` kecil (hanya saat muda).
- **Glow**: tiap partikel genap menambah 3 disc additive alpha 0.035–0.06.
- Partikel mati → 45% menjadi **asap** (disc abu bertahap gelap, alpha 0.5 → 0).
- Gerak: dorongan naik (buoyancy), goyangan `sin` per partikel agar tidak lurus.

{{demo:fire}}

Gerakkan mouse untuk memindah api.

## Kode
{{code:43-demo-fire}}
