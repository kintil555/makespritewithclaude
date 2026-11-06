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
- **Bola berputar cepat**: peta tekstur lon/lat (96×48, di-bake sekali dengan `fbm` yang tile di sumbu lon). Tiap piksel dipetakan terbalik ke titik bola `(nx,ny,nz)`, sumbu putar dimiringkan, `lon = atan2(ax,nz) + t·ω`, `lat = asin(ay)`, lalu ambil texel. Tekstur berputar (ω ≈ 10 rad/s). Bola **bercahaya (emisif)**: tanpa arah cahaya, `k = (0.66 + 0.2·nz − 0.55·bercak − 0.3·benua − 0.3·shade)·(1 − 0.35·rim²)`. **Bercak**: puncak `fbm` (`(f−0.5)·5`) + **benua** tebal di sekitar katulistiwa (`fbm` kedua × `exp(−(lat/0.5)²)`, sebagian saja). **Palet bola** hanya 3 warna terang: biru muda `#8fcbff` → putih kebiruan `#dff2ff` → putih (`3 + PX.tone(k, tx, ty, 3, 0.7)`); **dither dihitung di koordinat tekstur** (Bayer memakai `(tx,ty)` bukan `(x,y)` layar) agar pola dither ikut berputar — koordinat layar membuat dither tampak menempel diam di atas bola. **Shading tipis**: `sh = clamp(0.8·ny + 0.25·nx)·rim` (bawah-kanan); hanya garis sempit berdither `sh > 0.62 + 0.25·bayer` yang jatuh ke biru terang `#4f7bff`, sisanya tetap biru muda — shading terbaca tanpa menggelapkan bola. Butiran partikel: `hash(tx,ty) < 0.06` → satu tingkat lebih biru, `> 0.97` → putih, hanya di dalam (`r²<0.72`). Pinggiran: `r²>0.88` dibatasi biru muda; bintik terang = `hash(tx>>1, ty>>1) > 0.9` pada `r²>0.6` (ikut berputar). **Halo luar** (`R..R+12`, lebih jauh dan lebih padat dekat bola): `(f^1.5·(0.04 + 0.38·noise) + 0.4·f⁴)·(0.85+0.15·pulse) > bayer`, `f = 1 − d/12`; lapisan awal (`f>0.8`) campuran biru muda/biru terang, lalu `f>0.45` biru `#2f3cb4`, sisanya `#241a66`; tiap piksel halo punya opasitas acak 60–100% (`alpha = 255·(0.6 + 0.4·hash)`). Noise halo bergeser melingkar pelan (periodik), plus 16 partikel yang melayang keluar.
- **GIF**: tiap demo animasi punya tombol **Unduh GIF** (`PX.gifAuto`: merekam 5 detik dengan `dt = 1/50` tetap, dikomposit di atas warna latar kanvas, palet 256 warna dari histogram). Delay GIF satuan 1/100 s, jadi **50 fps** (delay 2) adalah yang tercepat yang dihormati browser (live ≈ 60 fps). Khusus pulsar loop-nya **mulus**: demo adalah fungsi murni `draw(t)` tanpa state, semua frekuensi dibulatkan ke kelipatan `2π/LOOP` (LOOP = 6 s), cincin/percikan/partikel dihitung dari waktu sejak kejadian dengan `hash` (bukan `Math.random`), sehingga frame ke-300 identik dengan frame 0 (`PX.gifButton`).


{{demo:pulsar}}

## Kode
{{code:44-demo-neutron}}

{{code:45-demo-pulsar}}

{{code:18-gif}}
