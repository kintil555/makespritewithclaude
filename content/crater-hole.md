---
title: Lubang, kawah, dan gosong pada dinding
category: efek
order: 70
summary: Menghapus piksel dengan tepi tak beraturan, menampilkan dinding belakang, bayangan kedalaman, gosong dither, serpihan berwarna asli, dan bara.
---
## Langkah
1. **Bentuk lubang**: radius per sudut `r·(1 + 0.12 sin3θ + 0.07 sin5θ + 0.04 sin9θ)` dengan fase acak. Piksel di dalamnya ditandai `hole=1`.
2. **Serpihan**: sebelum dihapus, ambil warna asli piksel dan jadikan partikel 1px (sebagian kecil saja). Lubang jadi terlihat "pecah dari material itu".
3. **Dinding belakang**: piksel lubang diganti pola yang sama tetapi ×0.42 lebih gelap dan digeser.
4. **Kedalaman**: untuk tiap piksel lubang, cari piksel non-lubang di atas-kiri (`x-((q+1)>>1), y-q`, `q=2..5`). Jika `q≤2` → gelapkan padat; `q=3` → dither 60%; `q=4` → dither 30%. Bayangan jatuh di bawah bibir atas.
5. **Gosong**: jarak `d` dari tepi lubang. `d≤1.5` → hitam pekat (cincin tipis). Lalu `lv = 0.95·(1−t)^1.15`; gelapkan jika `lv > bayer(x,y)`. Memudar keluar tanpa gradient.
6. **Bara**: piksel cincin pertama berpendar oranye 0.75 detik lalu padam.

Efek bersifat kumulatif: lubang yang saling tumpuk tetap benar.

{{demo:crater}}

Klik dinding untuk membuat lubang.

## Kode
{{code:42-demo-crater}}
