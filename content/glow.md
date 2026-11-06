---
title: Glow — cahaya additive di buffer terpisah
category: efek
order: 55
summary: Cara membuat cahaya (glow) pixel art yang halus tapi tetap tajam — buffer cahaya sendiri, profil (1−d)², pencampuran additive, dan kapan memakai dither sebagai gantinya.
---
## Prinsip
Glow **bukan** lingkaran transparan yang digambar di atas sprite. Glow adalah *cahaya*, jadi ia harus **menambah** warna di bawahnya (additive), bukan menimpanya. Tiga aturan:

1. **Buffer cahaya terpisah.** Semua `glow()` dalam satu frame ditumpuk di `PX.Light` (float RGB), baru dikomposit sekali di akhir. Dua cahaya yang bertumpuk jadi lebih terang, bukan saling menutup.
2. **Profil kuadrat.** Intensitas piksel `I = (1 − d/r)² · k`, dengan `d` jarak ke pusat. Pusat terang, jatuh cepat, dan **tepinya nol** — tidak ada garis tepi lingkaran. Profil linear `(1 − d/r)` terlihat seperti kabut kelabu; profil datar terlihat seperti stiker.
3. **Komposit `lighter`.** Buffer cahaya digambar dengan `globalCompositeOperation = 'lighter'` setelah adegan. Alpha = kecerahan, sehingga area tanpa cahaya tetap transparan (tidak jadi kotak hitam).

Pola ini sama dengan fungsi `glow(x, y, r, warna, intensitas)` pada referensi Sprite Fusion: loop di kotak `[x−r, x+r]`, hitung `t = dx² + dy²` ternormalisasi, lewati bila `t ≥ 1`, lalu `add(x, y, warna, (1 − √t)² · k)`.

{{demo:glow}}

Gerakkan kursor untuk memindah cahaya, klik untuk kilatan putih. Bandingkan tiga profil.

## Kapan dipakai
| Efek | Radius | Intensitas | Durasi |
|---|---|---|---|
| Ledakan roket | `3.4 · R` oranye + `1.6 · R` putih | 0.6 | putih 0.12 dtk, oranye 0.7 dtk |
| Ledakan neutron | `3 · R` biru | 0.5 | mengikuti umur ledakan |
| Peluru (opsional) | kecil, 5–8 px | 0.25–0.4 | sepanjang peluru |
| Api / obor | 12–20 px | 0.5 | berkedip pelan |

Memudarkan cahaya: kalikan `k` dengan `(1 − u)^1.5` (`u = t / umur`) agar cepat redup di awal dan halus di akhir.

## Jebakan
- **Jangan pakai glow lebar untuk peluru.** Radius besar membuat proyektil terlihat gemuk; tracer yang bagus justru tanpa glow, atau glow kecil dan redup.
- **Glow di atas adegan gelap saja yang terlihat.** Bila latar sudah terang, additive langsung jenuh ke putih. Batasi dengan `min(255, ...)` per kanal (sudah di `flush`).
- **Piksel tetap bulat.** Glow dihitung per piksel kanvas logis dan diperbesar `image-rendering: pixelated`, jadi anak tangganya tetap piksel — gradasi halus hanya pada kecerahan, bukan pada ukuran piksel.
- **Gradient ala pixel-art murni?** Ganti additive dengan `ditherDisc` (kepadatan piksel turun ke tepi, ambang Bayer) — lihat [palet dan dithering](dither-palette.html).

## Kode
{{code:12-light}}
