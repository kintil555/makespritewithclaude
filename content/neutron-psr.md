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
- **Bercak biru gelap** di permukaan ikut berputar: titik permukaan `(nx,ny,nz)` diputar sudut `spin` (sumbu putar dimiringkan), lalu diberi noise blok 3D; `h>0.6` → biru gelap, `h>0.8` → lebih gelap. Tepi tidak dibercaki agar siluet tetap terbaca.
- **Glow + aura**: 3 disc additif di bawah bola (`b.add=true`) agar glow tidak memutihkan bola; aura luar biru gelap berupa lidah per sektor sudut (`hash(sel)`) yang berputar dan berganti sel, dengan ~8% piksel putih.
- Ditembakkan cepat (330 px/s) dari pojok kiri-bawah sehingga lintasannya miring. Efek tambahan: semburan moncong + cincin, percikan sepanjang jejak, kilat cahaya dan cincin kejut saat kena.
- 3 percikan piksel acak mengorbit bola tiap frame.
- Mengenai target → ledakan neutron: sinar yang terlontar keluar lalu memudar (waktu lontarnya bertingkat, sebagian serentak, sebagian telat) dengan ekor yang mengikuti inti dan putaran kecil, plus cincin kejut, riak, cahaya, dan getaran (lihat [ledakan](explosion.html)). Bola juga memancarkan cahaya kecil.

{{demo:neutron}}

Klik target untuk menembak.

## Pulsar
Bintang neutron berputar dengan sumbu magnet miring:

- **Sinar**: untuk tiap piksel hitung `u` (sepanjang sumbu) dan `v` (tegak lurus). Intensitas `I = (1−u/L)·(1−|v|/w)^0.8`, lebar `w = 1.5 + 0.1u` (kerucut). Piksel menyala jika `I > bayer(x,y)·0.9`; warna dari `I`.
- **Ayunan cepat, bukan putaran penuh**: sumbu berayun `θ = base + 22.5°·tanh(k·sin ωt)/tanh k` (total 45°, ω tinggi). `tanh` membuat sapuan tajam dan sedikit diam di ujung. Sinar dan medan memakai sumbu yang sama sehingga ikut berayun.
- **Panjang sinar** dimodulasi `|cos|` agar tampak miring ke arah kamera.
- **Garis medan dipol 3D**: `r = s·cos²λ`; tiap garis punya azimut `φ` mengelilingi sumbu. Posisi 3D = `r·sinλ·a + r·cosλ·(cosφ·p + sinφ·q)` (`a` sumbu miring ke kamera, `p`,`q` basis tegak lurus), diproyeksikan ortografis. `z>0` digambar **setelah** bola (menimpa), `z<0` digambar **sebelum** bola (tertutup) dan lebih gelap; titik dengan `r<R` dibuang. `φ` berputar pelan sehingga garis tampak memutari bola. Dash mengalir sepanjang garis (`(k + arah·t·70) mod 40`), kepala dash diberi `lit.glow`.
- **Ayunan smooth**: `SNAP` kecil (mendekati sinus) + interpolasi sub-langkah: sudut frame lalu→sekarang dibagi 5, tiap sinar dirender di semua sub-sudut (yang lama lebih redup) dan diambil nilai maksimum → jejak halus tanpa loncatan.
- **Efek**: halo cahaya berdenyut, cincin + percikan di tiap ujung ayunan, bintang latar berkedip.
- **Bola berputar cepat**: peta tekstur lon/lat (64×32, di-bake sekali dengan `fbm` yang tile di sumbu lon). Tiap piksel dipetakan terbalik ke titik bola `(nx,ny,nz)`, sumbu putar dimiringkan, `lon = atan2(ax,nz) + t·ω`, `lat = asin(ay)`, lalu ambil texel. Cahaya tetap, tekstur berputar (ω = 10 rad/s). `k = 0.06 + 0.42·l + (tex−0.5)·0.85` → `PX.tone(k, x, y, 5, 0.9)`: dither Bayer lebar pada 5 warna (tanpa putih penuh) sehingga pola dither terlihat dan bola tidak biru-keputihan rata. **Halo luar**: tipis dan jarang: tiap piksel di `R..R+8` menyala jika `(1−d/8)^1.5 · (0.04 + 0.38·noise(x/7 + 0.1t, y/7 − 0.07t)) > bayer(x,y)` — noise bergeser sangat pelan; ditambah 16 partikel yang melayang keluar 1–2.5 px/s. **Pinggiran**: `rim = (r²−0.45)/0.55`, `k ×= 1 − 0.85·rim²` sehingga tepi menjadi biru gelap; `r²>0.8` dipaksa ke 2 warna tergelap; bintik putih = `hash(tx>>1, ty>>1) > 0.9` pada `r²>0.6`. Karena bintik di-hash dari koordinat **tekstur** (bukan layar), pinggiran gelap + putih ikut berputar bersama bola.

{{demo:pulsar}}

## Kode
{{code:44-demo-neutron}}

{{code:45-demo-pulsar}}
