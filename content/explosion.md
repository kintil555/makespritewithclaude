---
title: Ledakan prosedural — roket dan neutron
category: efek
order: 60
summary: Dua jenis ledakan berbeda — roket/launcher (kilat, cincin, puff bola api, asap besar, percikan) dan neutron (Cherenkov: gumpalan 5 disc, sinar, gelombang kejut) — plus cahaya glow dan getaran layar.
---
Satu ledakan = beberapa lapis yang hidup dengan jam masing-masing. Pilih **jenis** di demo: bentuknya sengaja berbeda supaya pemain langsung tahu senjata apa yang meledak.

{{demo:blast}}

Klik untuk meledakkan. Pilih "roket" atau "neutron".

## Ledakan roket (`PX.Rocket`)
Berasal dari gaya `fx.explosion` (Sprite Fusion) dan `bigBlast` (Stickman Pixel). Urutan gambar, dari belakang ke depan:

1. **Asap besar** (22 gumpal): menyebar cepat dari pusat lalu melambat (`v·e^(−2.2t)`). Tiap gumpal = 3 disc bergeser (tubuh, bayangan sedikit ke kanan-bawah, highlight kiri-atas) agar terlihat bervolume. 6 gumpal pertama berwarna merah panas, sisanya meredup lewat ramp 4 abu.
2. **Puff bola api** (38 puff, 3 kelompok): *inti* (5, pendek 0.2 dtk), *menyebar* (28, 0.55–1 dtk, miring ke atas), *naik* (5, ke atas, tertunda). Warna dipilih dari **ramp 9 tingkat** (putih → kuning → oranye → merah → coklat) menurut umur: `idx = (u^0.62 + noise·0.1)·8`. Ukuran membesar cepat lalu menyusut: `h = size·(0.55 + 0.45·min(1, 7u))·(1 − 0.55u)`. Setiap puff digambar sebagai tubuh + disc bergeser + "benjolan" atas + highlight, bukan satu lingkaran polos.
3. **Kilat**: disc putih radius `1.05R` hanya 0.06 detik. Singkat — kilat panjang menutupi bola api.
4. **Dua cincin**: kuning (`0.1R → 2.7R`, 0.5 dtk) dan kuning pucat (`0.1R → 1.9R`, 0.34 dtk). Radius memakai easing kubik `1−(1−u)³`, alpha `(1−u)^1.4`, tebal menyusut ke minimum 0.9 px.
5. **Percikan** (90): kecepatan acak, gravitasi, 1 piksel + 1 piksel ekor redup di belakangnya. Warna acak dari 5 tingkat putih → oranye.
6. **Cahaya**: `PX.Light` oranye radius `3.4R` redup selama 0.7 dtk + putih `1.6R` selama 0.12 dtk — lihat [glow](glow.html).
7. **Getaran**: `translate` acak pada kanvas, amplitudo turun linear (≈0.33 dtk). Di game, dikalikan jarak ke pemain.

## Ledakan neutron (`PX.Blast`)
Cherenkov biru, lebih "bersih" dan geometris:

1. **Haze**: disc radius `R(1+0.9e)` alpha 0.14 warna paling gelap.
2. **Kilat**: 14% awal umur, disc putih membesar sambil memudar.
3. **Gumpalan**: 10 lobus acak; tiap lobus = **5 disc konsentris** gelap → putih (radius `1, .86, .64, .42, .22`; alpha `.55, .7, .85, .95, 1`).
4. **Sinar (teranimasi)**: 10 duri utama merata + jitter (panjang `1.4–2.5R`, pangkal tebal 3–5 piksel yang meruncing) dan 22 sinar pendek acak, dari `0.3R`. Tiap sinar punya fase `ph`, frekuensi `f`, dan kecepatan denyut `sp` sendiri, sehingga hidup dengan 5 gerak:
   - **tumbuh** cepat (ease-out kubik di 45% awal), bertahan, lalu **menciut** 45% di akhir;
   - **panjang bergetar** `0.8 + 0.2·sin(t·f + ph)`;
   - **berputar**: seluruh bintang memakai sudut `a + ω·(1 − e^(−3t))/3` (melambat) plus goyang kecil per sinar `sin(0.35·t·f + ph)`;
   - **denyut terang merambat**: posisi `pf = (t·sp + ph) mod 1` di sepanjang sinar; piksel dekat `pf` memakai putih dan lebih terang;
   - **gerigi**: 4% piksel dilewati acak tiap frame, jadi tepinya berkedip. Alpha `1 − ru^2.2` (bertahan lalu jatuh), bukan memudar linear dari awal.
5. **Gelombang kejut**: 2 cincin dengan radius `rr·(1 + 0.07·sin3θ + 0.05·sin5θ + 0.03·sin9θ)` + jitter, supaya tidak bulat sempurna.
6. **Kilau silang**: 22% awal umur, 4 garis tipis (kiri/kanan/atas/bawah) dengan alpha berkedip.
7. **Cincin riak ketiga**: tipis, lebih lambat, radius `R(0.3 + 2.6e)`; riaknya `sin(7θ − 9t)` merambat di sepanjang cincin.
8. **Partikel** 70 piksel, kecepatan `√random`, masing-masing dengan ekor redup; **asap** 7 gumpal biru-abu.
9. **Cahaya** (`light(L)`): halo `3.6R` berdenyut, kilat putih 0.14 dtk, dan glow kecil di ujung tiap sinar (posisinya dicatat saat menggambar, jadi ikut berputar). **Getaran**: `shake` turun linear.

## Beda roket vs neutron
| | Roket | Neutron |
|---|---|---|
| Karakter | api, volumetrik, kotor | energi, tajam, simetris |
| Dominan | puff + asap + percikan | sinar berputar + gelombang kejut |
| Warna | ramp api 9 tingkat | ramp biru 5 tingkat |
| Cahaya | oranye hangat, lama | biru, mengikuti umur |
| Asap | banyak, besar, lama | sedikit |

Kaidah umum: durasi tiap lapis berbeda (kilat 0.06 dtk, cincin 0.3–0.5, puff 0.5–1, asap 1–2), easing keluar `1−(1−u)²`, alpha `(1−u)^1.1`, dan semua posisi di-`round` oleh `PX.Buf`.

## Ganti palet = ganti tema
`PX.PALS` berisi ramp 5 warna + 4 warna asap; `PX.FB` ramp api roket. Ledakan jenis baru cukup menukar ramp dan memilih lapisan yang dipakai.

## Kode
{{code:41-demo-blast}}
