# Glow — cahaya additive di buffer terpisah

> Cara membuat cahaya (glow) pixel art yang halus tapi tetap tajam — buffer cahaya sendiri, profil (1−d)², pencampuran additive, dan kapan memakai dither sebagai gantinya.

Kategori: Efek (VFX) · URL: https://makespritewithclaude.pages.dev/articles/glow.html

## Prinsip
Glow **bukan** lingkaran transparan yang digambar di atas sprite. Glow adalah *cahaya*, jadi ia harus **menambah** warna di bawahnya (additive), bukan menimpanya. Tiga aturan:

1. **Buffer cahaya terpisah.** Semua `glow()` dalam satu frame ditumpuk di `PX.Light` (float RGB), baru dikomposit sekali di akhir. Dua cahaya yang bertumpuk jadi lebih terang, bukan saling menutup.
2. **Profil kuadrat.** Intensitas piksel `I = (1 − d/r)² · k`, dengan `d` jarak ke pusat. Pusat terang, jatuh cepat, dan **tepinya nol** — tidak ada garis tepi lingkaran. Profil linear `(1 − d/r)` terlihat seperti kabut kelabu; profil datar terlihat seperti stiker.
3. **Komposit `lighter`.** Buffer cahaya digambar dengan `globalCompositeOperation = 'lighter'` setelah adegan. Alpha = kecerahan, sehingga area tanpa cahaya tetap transparan (tidak jadi kotak hitam).

Pola ini sama dengan fungsi `glow(x, y, r, warna, intensitas)` pada referensi Sprite Fusion: loop di kotak `[x−r, x+r]`, hitung `t = dx² + dy²` ternormalisasi, lewati bila `t ≥ 1`, lalu `add(x, y, warna, (1 − √t)² · k)`.

> **Demo interaktif "glow"**: buka halaman web artikel ini untuk menjalankannya. Kodenya ada di bawah.

Gerakkan kursor untuk memindah cahaya, klik untuk kilatan putih. Bandingkan tiga profil.

## Kapan dipakai
| Efek | Radius | Intensitas | Durasi |
|---|---|---|---|
| Ledakan roket | `3.4 · R` oranye + `1.6 · R` putih | 0.6 | putih 0.12 dtk, oranye 0.7 dtk |
| Ledakan neutron | `3 · R` biru | 0.5 | mengikuti umur ledakan |
| Peluru (opsional) | kecil, 5–8 px | 0.25–0.4 | sepanjang peluru |
| Api / obor | 12–20 px | 0.5 | berkedip pelan |

Memudarkan cahaya: kalikan `k` dengan `(1 − u)^1.5` (`u = t / umur`) agar cepat redup di awal dan halus di akhir.

## Jebakan
- **Jangan pakai glow lebar untuk peluru.** Radius besar membuat proyektil terlihat gemuk; tracer yang bagus justru tanpa glow, atau glow kecil dan redup.
- **Glow di atas adegan gelap saja yang terlihat.** Bila latar sudah terang, additive langsung jenuh ke putih. Batasi dengan `min(255, ...)` per kanal (sudah di `flush`).
- **Piksel tetap bulat.** Glow dihitung per piksel kanvas logis dan diperbesar `image-rendering: pixelated`, jadi anak tangganya tetap piksel — gradasi halus hanya pada kecerahan, bukan pada ukuran piksel.
- **Gradient ala pixel-art murni?** Ganti additive dengan `ditherDisc` (kepadatan piksel turun ke tepi, ambang Bayer) — lihat [palet dan dithering](https://makespritewithclaude.pages.dev/md/dither-palette.md).

## Kode

**Kode: `src/code/12-light.js`**

```js
// 12-light.js — PX.Light: buffer cahaya terpisah. glow() menambah (additive) ke buffer ini, lalu flush() menimpa kanvas dengan 'lighter'.
// Profil: intensitas = (1 - jarak/r)^2 * k  -> terang di pusat, jatuh cepat ke tepi (tanpa tepi keras).
PX.Light = class {
  constructor(w, h) {
    this.w = w; this.h = h; this.d = new Float32Array(w * h * 3);
    this.cv = document.createElement('canvas'); this.cv.width = w; this.cv.height = h;
    this.cx = this.cv.getContext('2d'); this.img = new ImageData(w, h);
  }
  clear() { this.d.fill(0); }
  glow(x, y, r, col, k = 1, prof = 2) {          // prof: 2 = kuadrat (default), 1 = linear, 0 = datar
    if (r < 1 || k <= 0.01) return;
    const w = this.w, h = this.h, x0 = Math.max(0, Math.floor(x - r)), x1 = Math.min(w - 1, Math.ceil(x + r)),
      y0 = Math.max(0, Math.floor(y - r)), y1 = Math.min(h - 1, Math.ceil(y + r)), q = 1 / r;
    for (let j = y0; j <= y1; j++) {
      const dy = (j + 0.5 - y) * q;
      for (let i = x0; i <= x1; i++) {
        const dx = (i + 0.5 - x) * q, t = dx * dx + dy * dy; if (t >= 1) continue;
        const f = 1 - Math.sqrt(t), a = (prof === 2 ? f * f : prof === 1 ? f : 1) * k, o = (j * w + i) * 3;
        this.d[o] += col[0] * a; this.d[o + 1] += col[1] * a; this.d[o + 2] += col[2] * a;
      }
    }
  }
  flush(ctx) {
    const D = this.img.data, s = this.d;
    for (let i = 0, n = this.w * this.h; i < n; i++) {
      const r = Math.min(255, s[i * 3]), g = Math.min(255, s[i * 3 + 1]), b = Math.min(255, s[i * 3 + 2]), m = Math.max(r, g, b, 1);
      D[i * 4] = (r / m) * 255; D[i * 4 + 1] = (g / m) * 255; D[i * 4 + 2] = (b / m) * 255; D[i * 4 + 3] = m;   // alpha = kecerahan -> area gelap tetap transparan
    }
    this.cx.putImageData(this.img, 0, 0);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.imageSmoothingEnabled = false; ctx.drawImage(this.cv, 0, 0); ctx.restore();
  }
};
```

