---
title: Buffer piksel Uint32 dan aturan integer
category: rendering
order: 30
summary: Cara menggambar ribuan piksel efek per frame dengan cepat dan tanpa blur, memakai buffer Uint32 dan satu putImageData.
---
## Mengapa
Efek (api, ledakan, partikel) berarti ratusan lingkaran per frame. Memanggil `fillRect(x,y,1,1)` per piksel mahal dan `arc()` menghasilkan anti-alias. Solusi: tulis langsung ke `Uint32Array` yang berbagi memori dengan `ImageData`, lalu `putImageData` **sekali** per frame.

## Aturan canvas piksel
- Canvas dibuat kecil (mis. 160×90) dan **diperbesar dengan CSS** memakai `image-rendering: pixelated`.
- Semua koordinat digambar di-`Math.round` sebelum menyentuh buffer.
- Lingkaran = `x*x + y*y <= r*r` per baris, bukan `arc()`.
- Glow = disc ber-alpha atau **dither disc** (kepadatan piksel turun ke tepi), bukan `createRadialGradient`.
- Mode additive (`add=true`) untuk cahaya; alpha biasa untuk asap.

## Kode
`PX.Buf` dipakai oleh demo api, ledakan, dan bola neutron:

{{code:10-buf}}

Contoh pemakaian:

```js
const buf = new PX.Buf(160, 90);
function frame() {
  buf.clear();
  buf.disc(80, 45, 6, [255, 138, 42]);           // disc solid
  buf.add = true; buf.disc(80, 45, 12, [255, 200, 90], 0.06); buf.add = false; // glow
  buf.flush(ctx);                                // 1x putImageData
}
```
