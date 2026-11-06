---
title: Komposit sprite bertahap — outline, bayangan jatuh, flash, tint sisi jauh
category: rendering
order: 42
summary: Satu sprite berindeks diolah dari mask dalam urutan tetap — bayangan, outline, badan — lalu flash putih saat kena hit dan tint untuk bagian sisi jauh, semuanya di grid integer.
---
## Prinsip
Sprite disimpan sebagai **indeks palet** (0 = kosong), bukan gambar jadi. Dari *mask* `idx > 0` itulah semua efek dihitung, jadi teknik ini berlaku untuk sprite apa pun, termasuk hasil [pixelize](hires-to-pixel.html) atau [sprite sheet](sprite-sheet.html).

Urutan komposit **tetap** (dianalisis dari pipeline gambar karakter pada referensi Sprite Fusion):

1. **Outline** — sel kosong yang punya tetangga terisi di 4 arah (atas, bawah, kiri, kanan) ditandai sebagai sel outline. Diagonal tidak dihitung, supaya garis tetap 1 piksel tipis.
2. **Bayangan** — seluruh sel mask *dan* outline digeser `(+1, +1)` lalu dicampur hitam dengan alpha `0.28`. Ditulis **sebelum** badan agar tidak menimpa sprite sendiri; hanya bagian yang menjulur keluar siluet yang tersisa.
3. **Badan** — sel mask dan outline ditulis opaque di atas bayangan.
4. **Flash** — saat kena hit, warna *badan* diganti putih selama sekitar 0.1 detik. Outline tidak ikut, sehingga siluet tidak melebar.
5. **Tint sisi jauh** — bagian yang ditandai `far` (lengan di belakang tubuh) dicampur ke warna gelap `k ≈ 0.4–0.5`. Satu tanda per sel memberi kesan kedalaman tanpa menggambar ulang.

Posisi dunia boleh pecahan, tetapi posisi gambar **selalu dibulatkan** (`Math.round`) dan pivot dikurangkan sebagai integer. Tanpa itu sprite bergetar karena sebagian sel jatuh di piksel yang berbeda tiap frame.

{{demo:composite}}

Coba matikan satu per satu. Strip bawah memperlihatkan efek tiap tahap secara berurutan.

## Parameter
| Bagian | Nilai | Catatan |
|---|---|---|
| Warna outline | sangat gelap, hue digeser | hindari hitam murni |
| Bayangan | offset `(1,1)`, alpha `0.2–0.3` | arah sama dengan sumber cahaya sprite |
| Flash | putih, `0.08–0.15` detik | hanya warna badan |
| Tint jauh | `k = 0.35–0.5` ke biru/ungu gelap | warna dasar boleh sama dengan sisi dekat |

## Jebakan
- **Outline di tepi array terpotong.** Loop komposit harus berjalan dari `-1` sampai `w` (padding 1 sel), bukan `0..w-1`.
- **Bayangan alpha 1** terlihat seperti sprite kembar; pakai alpha rendah dan tetap 1 piksel.
- **Flip horizontal harus membalik `idx` dan `far` bersamaan.** Cara paling aman: balik indeks baca (`w-1-i`), jangan menyalin ulang array.
- **Flash yang menimpa outline** membuat siluet tampak membesar dan kehilangan bentuk.
- **Bayangan dihitung sebelum outline** akan melewatkan sel outline; hasilnya garis bayangan putus di tepi.

## Kode
{{code:13-composite}}
