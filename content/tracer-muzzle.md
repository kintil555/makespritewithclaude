---
title: Tracer peluru, muzzle flash, dan percikan tumbukan
category: efek
order: 50
summary: Jejak peluru 3 tingkat (inti 1px, pasangan piksel, ekor gelap), kilatan moncong dari sinar acak, dan percikan berpantul.
---
## Anatomi tracer
Tracer yang baik terbaca di sudut apa pun karena **ketebalan** dan **kecerahan** berubah sepanjang jejak:

| Bagian | Piksel | Warna |
|---|---|---|
| Kepala | 1 piksel | inti hampir putih |
| 0–50% jejak | **pasangan** piksel (tebal) | warna tengah, terang |
| 50–100% | 1 piksel diagonal | warna gelap, alpha 1 → 0.4 |

Pasangan piksel digeser tegak lurus terhadap sumbu dominan (`vert ? x±1 : y±1`). Langkah jejak = 1 piksel sepanjang sumbu dominan (`ca/m, sa/m` dengan `m=max(|ca|,|sa|)`) sehingga garis rapat tanpa lubang.

## Muzzle flash
Hidup 2–4 frame (~70 ms): 5 sinar kuning + 3 sinar inti pendek dengan sudut acak ±0.65 rad dari arah tembak, plus kotak putih 3×3 di moncong. Moncong juga **recoil** mundur 2px lalu pulih.

## Glow tanpa gradient
Disc dither: piksel ke-`(x,y)` menyala jika `(1 - d/r) * alpha > bayer(x,y)`. Terlihat seperti cahaya, tetapi tetap piksel.

## Percikan
Saat mengenai permukaan: 9 partikel 1px, sudut = normal permukaan ± 1.1 rad, kecepatan 40–130 px/s, gravitasi 260, hidup 0.25–0.55 s. Warna inti → tengah menurut sisa umur.

{{demo:tracer}}

Klik untuk menembak ke arah kursor; tahan untuk auto-fire.

## Kode
{{code:40-demo-tracer}}
