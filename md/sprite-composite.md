# Komposit sprite bertahap — outline, bayangan jatuh, flash, tint sisi jauh

> Satu sprite berindeks diolah dari mask dalam urutan tetap — bayangan, outline, badan — lalu flash putih saat kena hit dan tint untuk bagian sisi jauh, semuanya di grid integer.

Kategori: Teknik Rendering · URL: https://makespritewithclaude.pages.dev/articles/sprite-composite.html

## Prinsip
Sprite disimpan sebagai **indeks palet** (0 = kosong), bukan gambar jadi. Dari *mask* `idx > 0` itulah semua efek dihitung, jadi teknik ini berlaku untuk sprite apa pun, termasuk hasil [pixelize](https://makespritewithclaude.pages.dev/md/hires-to-pixel.md) atau [sprite sheet](https://makespritewithclaude.pages.dev/md/sprite-sheet.md).

Urutan komposit **tetap** (dianalisis dari pipeline gambar karakter pada referensi Sprite Fusion):

1. **Outline** — sel kosong yang punya tetangga terisi di 4 arah (atas, bawah, kiri, kanan) ditandai sebagai sel outline. Diagonal tidak dihitung, supaya garis tetap 1 piksel tipis.
2. **Bayangan** — seluruh sel mask *dan* outline digeser `(+1, +1)` lalu dicampur hitam dengan alpha `0.28`. Ditulis **sebelum** badan agar tidak menimpa sprite sendiri; hanya bagian yang menjulur keluar siluet yang tersisa.
3. **Badan** — sel mask dan outline ditulis opaque di atas bayangan.
4. **Flash** — saat kena hit, warna *badan* diganti putih selama sekitar 0.1 detik. Outline tidak ikut, sehingga siluet tidak melebar.
5. **Tint sisi jauh** — bagian yang ditandai `far` (lengan di belakang tubuh) dicampur ke warna gelap `k ≈ 0.4–0.5`. Satu tanda per sel memberi kesan kedalaman tanpa menggambar ulang.

Posisi dunia boleh pecahan, tetapi posisi gambar **selalu dibulatkan** (`Math.round`) dan pivot dikurangkan sebagai integer. Tanpa itu sprite bergetar karena sebagian sel jatuh di piksel yang berbeda tiap frame.

> **Demo interaktif "composite"**: buka halaman web artikel ini untuk menjalankannya. Kodenya ada di bawah.

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

**Kode: `src/code/13-composite.js`**

```js
// 13-composite.js — sprite berindeks + komposit bertahap dari MASK: bayangan -> outline -> badan (+ flash, tint sisi jauh).
// Sprite = { w, h, idx (0 kosong, 1.. indeks palet), far (1 = bagian sisi jauh), pal }.
PX.mix = (a, b, t) => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t));

PX.fromAscii = (rows, legend) => {           // '.' = kosong; legend: { huruf: { col: [r,g,b], far?: true } }
  const h = rows.length, w = rows[0].length, idx = new Uint8Array(w * h), far = new Uint8Array(w * h), pal = [null], id = {};
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '.') return;
    if (!id[ch]) { id[ch] = pal.length; pal.push(legend[ch].col); }
    idx[y * w + x] = id[ch]; far[y * w + x] = legend[ch].far ? 1 : 0;
  }));
  return { w, h, idx, far, pal };
};

// o: { flip, outline: [r,g,b], shadow: alpha, tint: { col, k }, flash: [r,g,b] }. x,y = pojok kiri-atas, SELALU dibulatkan (snap).
PX.drawSprite = (buf, s, x, y, o = {}) => {
  x = Math.round(x); y = Math.round(y);
  const { w, h, idx, far, pal } = s;
  const q = (i, j) => (i < 0 || j < 0 || i >= w || j >= h ? -1 : j * w + (o.flip ? w - 1 - i : i));   // flip membalik idx & far sekaligus
  const solid = (i, j) => { const k = q(i, j); return k >= 0 && idx[k] > 0; };
  const cells = [];                                          // [i, j, k]; k = -1 -> sel outline
  for (let j = -1; j <= h; j++) for (let i = -1; i <= w; i++) {   // padding 1 sel agar outline di tepi sprite tidak terpotong
    if (solid(i, j)) cells.push([i, j, q(i, j)]);
    else if (o.outline && (solid(i - 1, j) || solid(i + 1, j) || solid(i, j - 1) || solid(i, j + 1))) cells.push([i, j, -1]);
  }
  if (o.shadow) for (const [i, j] of cells) buf.px(x + i + 1, y + j + 1, [0, 0, 0], o.shadow);   // 1) bayangan: badan + outline digeser (+1,+1)
  for (const [i, j, k] of cells) {                           // 2) badan/outline opaque di atas bayangan
    let c = o.outline;
    if (k >= 0) {
      c = pal[idx[k]];
      if (far[k] && o.tint) c = PX.mix(c, o.tint.col, o.tint.k);   // sisi jauh -> dicampur warna gelap
      if (o.flash) c = o.flash;                                    // flash hanya mengganti badan, bukan outline
    }
    buf.px(x + i, y + j, c, 1);
  }
};
```

