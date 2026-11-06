---
title: Bola neutron dan pulsar (PSR)
category: efek
order: 90
summary: Proyektil bola neutron biru dengan jejak, ledakan Cherenkov, dan pulsar ber-sinar menyapu dengan garis medan dipol.
---
## Bola neutron (proyektil)
- Bola `R≈3.3` ter-shade 5 ambang Lambert (`l<.2, .45, .7, .9`) dengan arah cahaya tetap kiri-atas.
- Tepi yang gelap dinaikkan satu tingkat agar siluet terbaca di latar gelap.
- **Jejak**: 18 disc di belakang, mengecil dan alpha `(1−u)^1.4`; 40% pertama warna terang.
- 3 percikan piksel acak mengorbit bola tiap frame.
- Mengenai target → ledakan neutron: bintang sinar yang tumbuh, berputar, bergetar, dan berdenyut terang ke ujung, plus cincin kejut, riak, cahaya, dan getaran (lihat [ledakan](explosion.html)). Bola juga memancarkan cahaya kecil.

{{demo:neutron}}

Klik target untuk menembak.

## Pulsar
Bintang neutron berputar dengan sumbu magnet miring:

- **Sinar**: untuk tiap piksel hitung `u` (sepanjang sumbu) dan `v` (tegak lurus). Intensitas `I = (1−u/L)·(1−|v|/w)^0.8`, lebar `w = 1.5 + 0.1u` (kerucut). Piksel menyala jika `I > bayer(x,y)·0.9`; warna dari `I`.
- **Panjang sinar** dimodulasi `|cos|` agar tampak miring ke arah kamera.
- **Garis medan dipol**: `r = s·cos²λ`; posisi = `r·sinλ` sepanjang sumbu, `±r·cosλ` tegak lurus, ditampilkan sebagian titik (hash) agar putus-putus.
- **Bola**: shading ramp 6 warna + noise blok yang bergeser dengan waktu (kesan berputar).

{{demo:pulsar}}

## Kode
{{code:44-demo-neutron}}

{{code:45-demo-pulsar}}
