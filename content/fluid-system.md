---
title: Sistem fluida piksel — permukaan berpegas, gelembung, air sel, benda apung
category: efek
order: 56
summary: Tiga model fluida murah untuk piksel — permukaan 1D berpegas (kolam, percikan), gelembung dari ventilasi (naik, goyang, menyatu, pecah), dan air sel 2D (automata) — plus benda apung/tenggelam dan cara menggabungkannya dengan texturing air.
---
Bagian gelembung dianalisis dari `bubbles.ts` buatan Sprite Fusion (MIT); bagian pegas, benda apung, dan air sel adalah teknik standar yang ditulis ulang di sini. Semuanya JavaScript murni, satu unit = satu piksel logis.

## Pilih model sesuai kebutuhan
| Kebutuhan | Model | Biaya | Kelemahan |
|---|---|---|---|
| Permukaan kolam, ombak, riak, tempat benda jatuh | **Pegas 1D** (`PX.Surface`) | O(lebar) | tidak mengalir, tidak ada air di luar bak |
| Gelembung, uap, partikel naik | **Partikel + volume** (`PX.Bubbles`) | O(n²) kecil | hanya partikel |
| Air yang dituang, mengalir, mengisi cekungan | **Sel / automata** (`PX.CAWater`) | O(lebar·tinggi) | permukaan sedikit berkedip, volume bisa bocor di sudut |

Jangan memakai SPH atau solver Navier-Stokes untuk piksel: biayanya besar dan hasilnya halus (merusak gaya). Ketiga model di atas lebih cocok dengan estetika grid. Tampilan air (warna, permukaan, caustic) dikerjakan terpisah di [texturing air](water-texturing.html).

{{demo:fluid}}

Klik untuk menjatuhkan batu. Geser **massa jenis**: di bawah 1 benda mengapung, di atas 1 tenggelam.

## 1. Permukaan berpegas (heightfield)
Tiap kolom `i` punya tinggi `h[i]` dan kecepatan `v[i]`. Dua langkah per tick:

```
// pegas ke tinggi 0 + redaman
v[i] += −k·h[i] − damp·v[i];   h[i] += v[i]
// sebar ke tetangga (ulang 4 kali, hitung dulu semua delta baru terapkan)
dl[i] = spread·(h[i] − h[i−1]);  v[i−1] += dl[i]
dr[i] = spread·(h[i] − h[i+1]);  v[i+1] += dr[i]
h[i−1] += dl[i];  h[i+1] += dr[i]
```
Nilai awal yang stabil: `k = 0.03`, `damp = 0.03`, `spread = 0.22` (harus < 0.5). Jalankan dengan **langkah tetap 1/60 dtk** (akumulator), bukan `dt` variabel — kalau tidak, gelombang meledak saat frame lambat.

- **Percikan masuk**: `splash(x, −gaya)` menambah kecepatan negatif di kolom itu (±½ di tetangga). Permukaan turun lalu memantul menjadi gelombang menjalar.
- **Tinggi di `x` pecahan**: interpolasi linear dua kolom, lalu dibulatkan hanya saat menggambar.
- Tambahkan ombak ambien (dua sinus kecil) **setelah** simulasi: `y = sim.y(x) + ambien(x,t)`; simulasi tetap bersih.

## 2. Benda apung (Archimedes sederhana)
```
sub = clamp((y + r − permukaan) / (2r), 0, 1)       // fraksi tercelup
ay  = g·(1 − sub/rho)                               // rho = massa jenis relatif air
v  −= v·drag·sub·dt                                  // hambatan hanya saat tercelup
```
Pada `rho < 1` benda berhenti saat `sub = rho` (mengapung dengan sebagian di atas air); pada `rho > 1` tenggelam sampai dasar. Satu persamaan, tanpa cabang "terapung/tenggelam".

**Saat masuk air** (`sub` berubah dari 0 ke > 0, sekali): `surface.splash(x, −min(3, vy·r·0.004))`, semburkan `min(14, vy·r·0.05)` tetes, dan mulai jejak gelembung. Saat bergerak cepat di bawah air, munculkan gelembung kecil dengan probabilitas `dt·12`.

## 3. Percikan (tetes)
Partikel dengan gravitasi (`vy += 220·dt`), digambar 1 piksel terang + 1 piksel ekor `LIT` di belakang arah gerak. Saat `vy > 0` dan `y ≥ permukaan(x)`: buang tetes dan `splash(x, −0.25)` — riak kecil. Rantai sebab-akibat ini (benda → percikan → tetes → riak) membuat air terasa hidup tanpa simulasi mahal.

## 4. Gelembung
Setiap **ventilasi** punya laju spawn berfluktuasi (`dt·5·density·(0.7 + 0.3·noise)`) dan **semburan** tiap 1.4–3.2 dtk (5–10 gelembung rapat). Per gelembung:

```
vy  += (−(20 + 13r) − vy)·min(1, 3dt)       // naik lebih cepat bila besar, mendekati bertahap
ph  += dt·(4 + 2/r)                         // gelembung kecil bergetar lebih cepat
x    = x0 + sin(ph)·(0.5 + 0.8r)            // goyang kiri-kanan
x0  += noise(0.4t + i·0.13)·3·dt            // hanyut
r    = min(5, r + 0.12·dt)                  // tumbuh (tekanan turun)
```
- **Menyatu**: dua gelembung (r ≥ 1) yang jaraknya < `0.75·(ra + rb)` menjadi satu dengan `r = ∛(ra³ + rb³)` (volume kekal), posisi dirata-rata, dan `wob = 1` (getaran gepeng sesaat).
- **Pecah**: saat `y < permukaan(x) + 1` → efek pecah 0.2 dtk: setengah elips percikan yang melebar (`rx = r + 1 + 3k`, tinggi ½) + dua tetes naik, memudar lewat Bayer.
- **Layer**: sekitar 35% gelembung `near` digambar setelah benda (layer depan), sisanya di belakang — kedalaman murah.
- **Isi awal**: sebar gelembung di sepanjang kolom ventilasi saat dibuat agar adegan tidak kosong pada detik pertama.

**Gambar menurut ukuran** (detail berbanding ukuran, jangan menggambar cincin untuk 1 piksel):

| `r` | Gambar |
|---|---|
| < 0.9 | 1 piksel (`RIM` atau `LIT`) |
| < 1.5 | blok 2×2: `HI LIT / RIM SHADE` + glow kecil |
| ≥ 1.5 | cincin 1 piksel (sisi terang kiri-atas `LIT`, sisi gelap `SHADE`, lainnya `RIM`), isi 12% dither `FILL`, highlight `HI` di (−0.45, −0.45)·r, titik `LIT` di sisi berlawanan bila `r ≥ 2`, bentuk gepeng bergantian `±10%` |

## 5. Air sel (automata)
Grid `g`: 0 kosong, 1 air, 2 tembok. Pindai **dari bawah ke atas**; untuk tiap sel air, coba berurutan:

1. **Jatuh lurus** jika sel di bawah kosong.
2. **Diagonal bawah** (arah acak) jika sel samping dan diagonal kosong.
3. **Mengalir ke samping** sejauh `flow` sel (1–8) ke arah acak.

Aturan yang membuatnya benar: (a) **arah pindai kiri/kanan bergantian** tiap langkah supaya air tidak condong ke satu sisi; (b) tandai sel yang baru dipindah (`stamp`) agar tidak diproses dua kali dalam satu langkah; (c) jalankan 2 langkah per frame agar alirannya cepat; (d) sumber (keran) menyuntik sel **tiap langkah**, bukan tiap frame, supaya aliran utuh.

{{demo:waterca}}

**Pewarnaan**: pakai tampilan yang sama dengan demo kolam supaya ketiganya terlihat satu keluarga. Hitung kedalaman dari permukaan per kolom (pindai dari atas: sel air tanpa air di atas → `d = 0`, selain itu `d = d_atas + 1`). Isi sel air = piksel dinding bawah air dari `poolScene`, ditimpa `TINT` dengan alpha 4 tingkat menurut `tone(1 − min(1, d/14), x, y, 4, 0.25)`. Sel `d = 0` = `LIT` (kilau berjalan → `HI`), `d = 1` = `RIM`, `d = 2…6` = pita `SHADE` yang menipis lewat Bayer, sel kosong = langit. Caustic memakai `Water.caustics(lit, t, mask)` dengan `mask` = hanya sel air. Kedalaman dari *permukaan* membuat kolam dangkal tetap terang walaupun ada di dasar peta.

**Hibrida dengan permukaan pegas (demo di atas)**: sel air hanya model badan air; tumbukan dan gelombangnya dibuat oleh komponen lain supaya tidak terasa dua jenis air yang berbeda:
1. **Deteksi mendarat**: tiap sel menyimpan `fall` (berapa langkah ia jatuh lurus). Saat ia berhenti, catat `{x, y, v, water}` ke `ev`. Itu satu-satunya "gaya" yang dibutuhkan.
2. **Muka air** per kolom = sel teratas yang ditopang (bawahnya tidak kosong), dihaluskan `(l + 2a + r)/4` dan dibatasi ±1 dari sel mentah — ini juga menghilangkan kedipan permukaan. Lalu digeser oleh `PX.Surface` (`h[x]`): lembah hanya memotong sel air, puncak hanya mengisi sel kosong.
3. **Saat `ev` datang**: `surface.splash(x, −sp·0.06)` (gelombang menjalar), `foam.add` (busa putih di muka air), `spray` (tetes bergravitasi; mendarat di air = riak kecil), dan `fizz.burst` (gelembung mikro terseret turun lalu naik). Beri jeda ~0,12 dtk per 4 kolom, kalau tidak aliran keran memicu semburan tiap sel.
4. **Gelembung mikro** (`PX.Fizz`): titik 1 piksel (r < 0,9, berkedip) atau blok 2×2; naik dengan goyang kecil, hilang bila keluar dari sel air, pecah (riak + tetes kecil) bila mencapai muka air. `inWater(x, y)` dari sel membuat gelembung hanya hidup di dalam air berbentuk bebas.
5. **Aduk**: geser acak sel air searah seretan, lalu `fizz.burst` + `splash` + `foam` sebanding kecepatan seretan.

Demo kolam di atas memakai hal yang sama: benda masuk air melepas busa dan gelembung mikro, tetes yang jatuh kembali kadang menyeret satu gelembung.

**Kelemahan yang perlu diketahui**: genangan tipis 1 sel tidak merata sempurna dan volume bisa bocor di sudut. Itu bisa diterima sebagai "kilau" di gaya piksel.

## Menggabungkan semuanya
1. `surface.update(dt)`, benda, tetes, `bubbles.update(dt)`.
2. `compose` latar menurut tinggi permukaan, benda bawah air, `tint`, `snow`, gelembung belakang, `surface()`, gelembung depan, tetes, `caustics()`.
3. Satu fungsi `sy(x)` dibagikan ke gelembung (titik pecah), benda (fraksi tercelup), tint, dan garis permukaan — satu sumber kebenaran untuk tinggi air.

## Performa
- Gelembung: tabrakan O(n²); batasi populasi (≤ ~150) atau pakai grid sel jika lebih.
- Pegas 1D: 4 putaran penyebaran × lebar; murah.
- Air sel: ~9.000 sel × 2 langkah masih lancar; gunakan `Uint8Array`, hindari alokasi array di dalam loop sel.
- Semua posisi digambar setelah pembulatan; simulasi tetap float.

## Checklist untuk AI
1. Pilih model dari tabel; jangan menggunakan solver fluida kontinu.
2. Langkah tetap 1/60 untuk pegas; `spread < 0.5`.
3. Benda: satu rumus `ay = g(1 − sub/rho)`; masuk air memicu percikan sekali.
4. Gelembung: kecepatan, goyang, tumbuh, menyatu dengan `∛`, pecah dengan efek setengah elips; detail menurut ukuran.
5. Air sel: pindai bawah→atas, arah bergantian, stamp, keran per langkah; catat pendaratan (`fall`) untuk gelombang, busa, percikan, dan gelembung mikro.
6. Satu fungsi tinggi permukaan dibagikan ke semua komponen.
7. Lihat hasil render diperbesar sebelum menyetel angka.

## Kode
{{code:17-fluid}}

{{code:52-demo-fluid}}

{{code:53-demo-waterca}}
