---
title: Black hole prosedural — lensa gravitasi, cakram akresi, dan serpihan jatuh
category: efek
order: 95
summary: Cara menggambar black hole piksel — lensa per piksel yang membelokkan latar, cakram elips berdoppler, halo di atas bayangan, tekstur spiral Kepler, partikel tersedot berputar, serta timeline lahir–hidup–runtuh.
---
Teknik dianalisis dari `black-hole.ts` buatan Sprite Fusion (lisensi MIT). Kode demo di bawah ditulis ulang lebih sederhana: lensa + cakram + partikel + flare. Bagian timeline, jet, dan keruntuhan dijelaskan sebagai tambahan.

{{demo:blackhole}}

Klik untuk melempar serpihan; matikan "Lensa gravitasi" untuk melihat bedanya; geser kemiringan dan twist.

## Anatomi (5 komponen)
1. **Bayangan** — lingkaran hitam radius `Rs` (horizon).
2. **Cincin foton** — tepi tipis sangat terang tepat di luar `Rs` (`r < 1.075`).
3. **Cakram akresi** — elips miring, dari `1.4·Rs` sampai `3.5·Rs`.
4. **Halo** — bagian cakram sisi belakang yang "terlipat" melewati atas (dan bawah) bayangan akibat lensa.
5. **Lensa gravitasi** — latar di sekitar dibelokkan dan sedikit diputar.

Koordinat: semua dihitung dalam satuan `Rs`. Untuk piksel `(x,y)`: `dx,dy = (piksel + 0.5 − pusat)/Rs`, lalu putar sebesar `tilt` → `u, v`, `r = hypot(u,v)`.

## Lensa per piksel
Untuk piksel pada jarak `r` dari pusat (dalam piksel), ambil warna dari titik sumber yang bergeser:

```
s    = (r − rE²/r) / r                    // rE = 1.4·Rs, jari-jari Einstein
fade = smooth(0.45·rOut, rOut, r)         // efek hilang di tepi, rOut = 6·Rs
s    = s·(1 − fade) + fade
rot  = −twist · min(1.6, (rE/r)^1.5) · (1 − fade)
sumber = pusat + putar(rot) · (d · s)     // d = vektor piksel dari pusat
```
Di dalam `rE`, `s` negatif sehingga bayangan latar terbalik — itulah cincin Einstein. Mengambil sampel *nearest* dari buffer latar menjaga hasil tetap tajam (tanpa interpolasi). Demo menyalin latar ke buffer lalu menimpa piksel di radius `rOut` saja.

Varian kanvas (jika latar adalah adegan penuh): ambil snapshot persegi `2·rOut`, bagi radius menjadi cincin-cincin (lebih rapat di dekat `rE` karena gradien tinggi), dan gambar tiap cincin dengan `clip` + `setTransform(skala 1/s, rotasi rot)`. Hasilnya sama; pakai varian per piksel bila adegan sudah berupa buffer piksel.

## Cakram miring
- Elips: `ρ = hypot(u, v/q)`, `q = 0.2` (makin kecil makin tipis). Cakram ada pada `1.4 ≤ ρ ≤ 3.5`.
- **Depan** (`v ≥ 0`): menutupi bayangan. **Belakang** (`v < 0`): hanya tampak bila `r ≥ 1` (di luar horizon), selain itu tertutup bayangan.
- Profil radial: `Id = 1.25·(1−k)^1.1 · (0.7 + 0.3·smooth(0,0.05,k)) · (1 − smooth(0.72,1,k)) · tex · dop`, dengan `k = (ρ−1.4)/2.1`.
- **Halo atas**: `s = max(0, −v/r)`, lebar `h = 0.1 + 0.62·s^1.3`, `e = (r−1)/h`; jika `e < 1` → `I = (1−e^1.6)·tekstur·0.9`. Lebar terbesar tepat di atas lubang (`s = 1`), mengecil ke samping — bentuk "topi" di atas bayangan. Halo bawah lebih tipis (`0.04 + 0.2·s^1.3`, intensitas 0.5).
- **Cincin foton**: `r < 1.075 + 0.04·flare` → `I = 1.05·kedip`.

## Doppler
Sisi cakram yang mendekat lebih terang dan kebiruan:

```
D    = 1 − 0.5·(u/r)         // u = komponen horizontal ter-rotasi
I   *= D^1.25
biru = max(0, D − 1.25)·1.6  // dipakai hanya pada 2 warna ramp paling terang
```

## Tekstur cakram
Guratan spiral berputar dengan kecepatan sudut `∝ ρ^−1.5` (bagian dalam lebih cepat):

```
a      = θ + 5·ρ^−1.5·t
streak = 0.66 + 0.2·sin(6a + 9.5ρ) + 0.14·sin(13a − 21ρ + 1.7)
lane   = 0.78 + 0.22·cos(12.5ρ + sin(2a)·0.6)
knot   = max(0, sin(3a + 7ρ + sin(1.3t)·2) · sin(5a − 11ρ + 0.9t))³ · 0.55
tex    = streak·lane + knot
```
Intensitas akhir `I·bright` → `tone()`: ramp **9 warna** (`#3a0e16 … #ffffff`, merah gelap → oranye → putih krem) dengan Bayer; di bawah `I = 0.08` didither ke transparan sehingga tepi luar cakram larut. Satu piksel genap/ganjil (`(x+y)&1==0`) yang terang menambah glow kecil (kilau).

## Serpihan yang jatuh
Tiap partikel dalam radius `REACH = 12.4·Rs` mendapat percepatan

```
a  = G / (d² + Rs²) · min(1, (REACH − d)/(0.25·REACH))     // lunak di dekat pusat
v += (û − û⊥·SWIRL)·a ; û = arah ke pusat, û⊥ = tegak lurusnya, SWIRL = 0.55
v −= v·drag(d)                                              // drag naik saat mendekat
```
`SWIRL` membuat jalur spiral alih-alih lurus; `d < eat` → partikel dimakan dan memanggil `feed()` (menaikkan `flare`). Partikel digambar sebagai garis pendek berekor ([resep VFX](vfx-recipe.html)). Pada implementasi penuh, jenis partikel berbeda bobot tarikan (`mote ×1.4`, `debu ×0.55`) dan kepingan tanah (slab persegi) ditarik, memanjang searah tarikan, lalu ditelan.

## Timeline (implementasi penuh)
| Fase | Durasi | Perilaku |
|---|---|---|
| Lahir `FORM` | 0.4 dtk | radius overshoot `1 + 1.7(k−1)³ + 0.7(k−1)²`; cincin ungu + partikel mengitari |
| Hidup `LIFE` | 3.8 dtk | napas `1 + 0.025·sin(3.1t) + 0.01·sin(7.3t)`; denyut jantung 0.85 dtk (`pulse`) menambah tarikan, radius, spawn |
| Runtuh `COLLAPSE` | 0.42 dtk | membesar 14% lalu menyusut `(1 − ((k−0.3)/0.7)²)`, tarikan ×1.8, kilat layar |
| Ledakan akhir | ~2.5 dtk | cincin 3 lapis, 150 mote, 40 plasma, 130 serpihan berwarna benda yang pernah dimakan, `impulse` menolak partikel dan kepingan |

Intensitas yang bergantung waktu: `kuat = smooth(0, 0.8·FORM, t)·(1 + 0.8·runtuh + 0.45·denyut)`; `twist` dan `gloom` (kegelapan di sekitar) naik perlahan dan melonjak saat runtuh — keduanya dimasukkan ke lensa.

**Jet**: saat `feed ≥ 3` (dengan cooldown 1.1 dtk) dua semburan keluar tegak lurus cakram: partikel plasma cepat + garis berlapis tiga warna (`#7a5cff` tepi, `#9fd8ff` badan, `#f4fbff` inti) dengan goyangan `sin(0.45·s − 40·t)` yang melebar lalu menyempit.

**Guncangan & efek layar**: `shake(0.006·kuat + gulp·0.01)` terus-menerus, `0.1` pada puncak denyut, `0.35` saat lahir, `0.6` saat runtuh; `flash(0.7)` + riak saat runtuh.

## Urutan gambar
`partikel belakang (debu, serpihan) → kepingan → lubang + cakram → kilatan sinar → partikel depan (mote, plasma) → cincin → buffer cahaya`. Mengekspos layer `back`/`front` memungkinkan karakter ditempatkan di antaranya.

## Variasi cepat
- **Quasar**: `tilt ≈ 0`, jet permanen, cakram lebih terang.
- **Bintang neutron / pulsar**: tanpa bayangan; lihat [pulsar](neutron-psr.html).
- **Lubang cacing**: tanpa cakram, hanya lensa + cincin foton.

## Checklist untuk AI
1. Lensa dulu (tanpa lensa black hole hanya terlihat seperti planet bercincin).
2. Cakram = elips `q≈0.2` + halo atas; depan menutupi bayangan.
3. Doppler pada satu sisi, ujung terang dibiru-putihkan.
4. Semua warna lewat ramp + Bayer; tidak ada `arc()` anti-alias.
5. Partikel berputar masuk (SWIRL), dimakan di horizon, memicu `flare`.
6. Loop piksel dibatasi kotak `rout·Rs`; lensa dibatasi `rOut`.
7. Render beberapa frame ke PNG dan periksa visual sebelum menyetel.

## Kode
{{code:50-demo-blackhole}}
