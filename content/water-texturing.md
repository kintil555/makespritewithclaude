---
title: Texturing air piksel — tint kedalaman, permukaan, caustic, dan tile top-down
category: rendering
order: 44
summary: Air terdiri dari beberapa lapis sederhana yang ditumpuk — tint 4 tingkat, garis permukaan, anyaman caustic dari sinus, serpihan mengambang, dan tile top-down 2 lapis yang di-scroll — semuanya di grid integer dengan ramp biru dan dither Bayer.
---
Teknik dianalisis dari sistem gelembung Sprite Fusion (`bubbles.ts`, MIT): bagian tint, permukaan, caustic, dan serpihan. Kode di sini ditulis ulang agar bisa dipakai tanpa bergantung pada game tertentu.

{{demo:water}}

Ganti tampilan, lalu matikan tiap lapisan (tint, caustic, serpihan) untuk melihat kontribusinya.

## Prinsip
Air tidak bisa dibuat dengan satu tekstur. Air terbaca dari **lapisan yang saling menimpa**, masing-masing murah dan hanya memakai ramp kecil:

1. **Tint kedalaman** — warna biru gelap di atas apa pun yang ada di belakang, makin pekat ke bawah.
2. **Garis permukaan** — 1 piksel terang, 1 piksel rim, lalu pita bayangan yang menipis.
3. **Caustic** — jaring cahaya di dasar dan benda di bawah air.
4. **Serpihan mengambang** — titik kecil yang hanyut dan berkedip.
5. **Gelembung / benda / percikan** — lihat [sistem fluida](fluid-system.html).

Urutan gambar: latar → benda bawah air → tint → serpihan → gelembung belakang → permukaan → gelembung depan → percikan → caustic (buffer cahaya, paling akhir).

## Ramp air
| Peran | Warna | Dipakai untuk |
|---|---|---|
| `HI` | `#ffffff` | kilau puncak, highlight gelembung |
| `LIT` | `#c6f3ff` | garis permukaan, sisi terang |
| `RIM` | `#68bfe6` | tepi, rim permukaan |
| `SHADE` | `#2f7fb6` | sisi gelap, pita di bawah permukaan |
| `TINT` | `#0b3550` | warna overlay kedalaman |

Semakin dalam, air makin gelap, makin jenuh, dan bergeser ke biru-ungu; jangan hanya menurunkan kecerahan. Untuk jenis air lain ganti ramp (rawa: hijau zaitun, lava: lihat [texturing](pixel-texturing.html), racun: hijau neon), logikanya tetap.

## 1. Tint kedalaman 4 tingkat
Alpha kontinu menghasilkan ratusan warna di atas latar bertekstur. Kuantisasi kedalaman ke 4 tingkat (`PX.tone(k, x, y, 4, 0.25)`) dengan dither hanya di batas, lalu pakai tiap tingkat sebagai alpha overlay: `[0.10, 0.18, 0.26, 0.34]`. `k = (y − atas)/(dasar − atas)`. Hasilnya pita kedalaman yang terlihat disengaja, bukan gradient.

## 2. Garis permukaan
```
sy    = round(atas + sin(0.11x + 1.6t)·A1 + sin(0.043x − 0.9t)·A2)     // 2 sinus beda frekuensi -> tidak terasa berulang
glint = sin(0.37x − 2.3t) · sin(0.13x + 1.1t) > 0.55                    // perkalian 2 sinus = kilau yang berjalan acak
piksel(x, sy)     = glint ? HI : LIT
piksel(x, sy + 1) = RIM
untuk k = 2..6: jika bayer(x, sy+k) < 0.5 − 0.07k → SHADE              // pita yang menipis ke bawah
```
`sy` selalu **integer**. Bila permukaan berasal dari simulasi ([pegas](fluid-system.html)), ganti rumus sinus dengan tinggi kolom; sisanya sama. Setiap 4 kolom tambahkan `glow` kecil di bawah garis (0.09, naik ke 0.2 saat glint) agar permukaan terasa bercahaya.

## 3. Caustic: jaring dari dua medan sinus
Caustic adalah garis tempat nilai medan ≈ 0:

```
u  = 0.16x + 1.9·sin(0.12y + 0.9t)        v  = 0.19y + 1.9·sin(0.1x − 0.7t)
n1 = sin(u) + sin(v)                       // 0 di sepanjang jalur yang berkelok -> jaring
n2 = sin(0.09x + 0.07y + 1.4·sin(0.15y − 0.6t)) + sin(0.11y − 0.05x + 1.4·sin(0.13x + 0.8t))
f  = (max(0, 1 − |n1|·3) + 0.7·max(0, 1 − |n2|·3)) · k(y)
```
- `1 − |n|·3` mengubah "dekat nol" menjadi garis setebal sekitar 1/3 satuan.
- `1.9·sin(...)` adalah **warp**: tanpanya garisnya kisi lurus; dengan warp menjadi jaring organik yang bergerak.
- Dua medan berbeda arah dijumlahkan, medan kedua 0.7× agar menjadi anyaman sekunder yang lebih redup.
- `k(y)`: 1 di dasar, `0.18 + 0.32·(1 − kedalaman)` di atasnya — cahaya lebih kuat di dasar dan memudar ke permukaan.
- **Tiga tingkat via Bayer**: `f > 1.05` atau (`f > 0.8` dan `bayer < (f−0.8)/0.25`) → `LIT` ×0.3; `f > 0.45` atau (`f > 0.3` dan `bayer < (f−0.3)/0.15`) → `RIM` ×0.15; selain itu tidak ada cahaya.
- Ditambahkan **additive** ke buffer cahaya (`PX.Light.add`), bukan menimpa piksel — sehingga warna benda di bawahnya tetap terbaca ([glow](glow.html)).

## 4. Serpihan mengambang
Tanpa state: posisi dihitung dari `hash(i)` dan waktu. `y = atas + (y0 + (2.5 + 1.5·sin(s))·t) mod tinggi`, `x = x0 + 6·sin(0.3t + s)`. Gambar bila `bayer(x,y) ≤ 0.55 + 0.3·sin(1.3t + s)` (berkedip tanpa alpha). Satu dari tiga warna redup `#5f8a9a #7fa3a8 #4c6f86`; puncak kedipan memakai `LIT`. Sekitar 90 titik untuk layar 160×90.

## 5. Air top-down (tile)
Untuk lantai air dilihat dari atas, pakai [tile hasil bake](pixel-texturing.html) bermaterial `water`: jaring terang = batas sel Worley (`1 − edge/0.3`, dikuadratkan), plus fbm halus. Animasi tanpa menghitung ulang noise:

- Gambar **dua** salinan tile (seed berbeda) yang digeser **berlawanan arah**; offset integer per frame (`floor(t·4)`).
- Gabung dalam domain indeks: jika lapis B terang dan lapis A terang → indeks tertinggi (kilau putih); jika hanya B terang → naikkan ke tingkat terang menengah; selain itu pakai A.
- Kecepatan rendah (2–4 piksel/dtk). Gerak cepat dan non-integer menghilangkan kesan piksel.

```js
// satu piksel hasil gabungan (n = jumlah warna ramp)
let i = a;
if (b >= n - 2) i = a >= n - 2 ? n - 1 : Math.max(a, n - 3);
```

## Performa
- **Caustic** adalah bagian termahal (≈ 6 `sin` per piksel). Batasi ke kotak air, atau hitung tiap 2 frame, atau di setengah resolusi lalu `drawImage` 2×.
- Tint dan permukaan hanya melintasi kolom area air; tile top-down hanya indeks dan tidak memanggil fungsi matematika.
- Latar (langit dan dinding/dasar) di-bake sekali ke dua buffer; tiap frame hanya memilih salah satu per kolom menurut tinggi permukaan (`compose`).

## Checklist untuk AI
1. Ramp air 4–5 warna dari putih ke biru gelap, hue bergeser; tidak ada `rgba()` kontinu.
2. Tint kedalaman dikuantisasi 4 tingkat dengan dither di batas.
3. Permukaan: 1px terang, 1px rim, pita bayangan Bayer; posisi `sy` integer.
4. Caustic = nol-persilangan dua medan sinus ber-warp, additive di buffer cahaya, kuat di dasar.
5. Animasi top-down = dua tile digeser berlawanan, offset integer.
6. Semua pola Bayer memakai koordinat layar agar stabil saat kamera diam.
7. Periksa visual diperbesar; matikan lapisan satu per satu untuk memastikan tiap lapis berguna.

## Kode
{{code:16-water}}

{{code:51-demo-water}}
