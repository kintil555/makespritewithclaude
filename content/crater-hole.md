---
title: Lubang, kawah, dan kerusakan per elemen
category: efek
order: 70
summary: Sistem Sprite Fusion — halaman = grid sel milik elemen; tiap elemen punya kekerasan (hp) berbeda, retak bertahap, dan bisa copot; lubang bertepi tak beraturan dengan gosong, bayangan kedalaman, dan serpihan berwarna asli.
---
Dinding bukan satu gambar polos. Di Sprite Fusion, halaman web dipecah menjadi **sel grid** (1 sel = 2 satuan dunia) dan setiap sel punya **pemilik** — elemen asalnya (navbar, gambar, kartu, tombol, teks, ikon). Karena itu kekerasan, retak, dan copotnya bisa berbeda untuk tiap elemen.

{{demo:crater}}

Pilih senjata (peluru, roket, bom) lalu klik elemen. Bar kecil di atas elemen = sisa hp. Tombol Reset membangun ulang halaman.

## 1. Data per elemen
Setiap elemen dibuat sekali saat halaman dimuat:

```js
hp        = 20 + k * Math.sqrt(luas)      // k = 0.4 (kotak, teks, tombol), 0.32 (gambar)
canDetach = luas < 0.28 * luasLayar       // elemen raksasa tidak bisa copot
damage = 0, lost = 0, cells = jumlah sel miliknya
```

Akibatnya kekerasan **bukan angka tetap**, tetapi mengikuti ukuran dan jenis:

| Elemen | Ukuran | hp (perkiraan) | Nasib |
|---|---|---|---|
| Tombol | 40×14 | ±39 | rapuh: 1 roket cukup |
| Ikon | 22×22 | ±38 | rapuh |
| Kartu | 88×46 | ±71 | 1 roket + sedikit sisa |
| Teks (paragraf) | 150×28 | ±72 | sedang |
| Navbar | 240×14 | ±66 | sedang, tipis, retak dulu |
| Gambar besar | 132×70 | ±82 | k = 0.32 (lebih lunak per luas), tetapi luasnya 28,5% layar → `canDetach = false`: hanya berlubang |
| Halaman (latar) | seluruh layar | tinggi | tidak pernah copot, hanya berlubang |

Elemen kecil lebih mudah hancur dan, ketika copot, **terlempar lebih jauh**: kecepatan `2600/√luas` (batas 15–380).

## 2. Membuat lubang: `carve(x, y, r, irr)`
Semua sel dalam radius dihapus. Radius bergantung sudut agar tidak bulat:

```
batas(θ) = r · (1 + irr · (K1·sin(3θ+φ1)·0.6 + K2·sin(7θ+φ2)·0.4 + sin(13θ+φ3)·0.25))
```

`φ` dan `K` acak per lubang. Tiap sel yang hilang memanggil `take()`: tandai kosong, tambah `lost` milik elemennya, dan (sebagian kecil) jadikan **serpihan 1 piksel dengan warna asli sel itu**. `carve` mengembalikan himpunan elemen yang terkena — itulah yang menerima damage.

`irr` menentukan karakter: ledakan `0.16` (hampir bulat, sedikit bergerigi), peluru `0.42` (kasar).

## 3. Peluru menembus
Setelah lubang utama (`irr 0.42`), dua lubang lanjutan di sepanjang arah tembak: pada `0.9·r` berradius `0.72·r`, lalu `1.75·r` berradius `0.5·r` — **hanya jika di titik itu masih ada sel padat**. Hasilnya terowongan menyempit yang berhenti saat bertemu ruang kosong.

## 4. Damage, retak, copot
```
damageBlock(blok, dmg):
  damage += dmg
  tiap melewati 30% / 55% / 80% hp  ->  retak (level 2, 3, 4)
  bila canDetach dan (damage >= hp  atau  lost >= 38% sel)  ->  copot
```
- **Retak**: jalan acak sepanjang `min(34, 5 + √luas · (0.2 + 0.1·level))` sel di dalam elemen itu, bercabang `level+1` kali, menggelapkan sel ×0.35. Level lebih tinggi = retakan lebih panjang.
- **Copot**: sel yang tersisa disalin jadi sprite, area asal dikosongkan, sprite diberi kecepatan menjauhi titik tumbuk, putaran `≤ min(3, 300/√luas)`, gravitasi, lalu memudar.
- Senjata: peluru 14 damage; roket 90 langsung + percik `0.7·dmg·(1 − jarak/radius percik)` ke elemen di sekitar; bom 170 dengan percik lebih luas. Elemen raksasa hanya akan berlubang karena `canDetach = false`.

## 5. Tampilan lubang
1. **Dinding belakang**: sel kosong ditampilkan sebagai pola gelap, bukan transparan.
2. **Kedalaman**: untuk tiap sel lubang, cari sel utuh di atas-kiri (`x−((q+1)>>1), y−q`, `q=2..5`). `q≤2` → gelapkan padat; `q=3` → dither 60%; `q=4` → dither 30%. Bayangan jatuh di bawah bibir atas.
3. **Gosong**: jarak `d` dari tepi lubang. `d≤1.5` → hitam pekat tipis; lalu `0.9·(1−t)^1.15` dibandingkan ambang Bayer → memudar keluar tanpa gradient.
4. **Bara**: sebagian sel cincin pertama berpendar oranye 0.75 detik.

Semua kumulatif: lubang yang bertumpuk, retak, dan gosong tetap konsisten karena disimpan di grid.

## Kode
{{code:42-demo-crater}}
