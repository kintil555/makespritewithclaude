# Lubang, kawah, dan gosong pada dinding

> Menghapus piksel dengan tepi tak beraturan, menampilkan dinding belakang, bayangan kedalaman, gosong dither, serpihan berwarna asli, dan bara.

Kategori: Efek (VFX) · URL: https://makespritewithclaude.pages.dev/articles/crater-hole.html

## Langkah
1. **Bentuk lubang**: radius per sudut `r·(1 + 0.12 sin3θ + 0.07 sin5θ + 0.04 sin9θ)` dengan fase acak. Piksel di dalamnya ditandai `hole=1`.
2. **Serpihan**: sebelum dihapus, ambil warna asli piksel dan jadikan partikel 1px (sebagian kecil saja). Lubang jadi terlihat "pecah dari material itu".
3. **Dinding belakang**: piksel lubang diganti pola yang sama tetapi ×0.42 lebih gelap dan digeser.
4. **Kedalaman**: untuk tiap piksel lubang, cari piksel non-lubang di atas-kiri (`x-((q+1)>>1), y-q`, `q=2..5`). Jika `q≤2` → gelapkan padat; `q=3` → dither 60%; `q=4` → dither 30%. Bayangan jatuh di bawah bibir atas.
5. **Gosong**: jarak `d` dari tepi lubang. `d≤1.5` → hitam pekat (cincin tipis). Lalu `lv = 0.95·(1−t)^1.15`; gelapkan jika `lv > bayer(x,y)`. Memudar keluar tanpa gradient.
6. **Bara**: piksel cincin pertama berpendar oranye 0.75 detik lalu padam.

Efek bersifat kumulatif: lubang yang saling tumpuk tetap benar.

> **Demo interaktif "crater"**: buka halaman web artikel ini untuk menjalankannya. Kodenya ada di bawah.

Klik dinding untuk membuat lubang.

## Kode

**Kode: `src/code/42-demo-crater.js`**

```js
// Lubang di dinding: hapus piksel (tepi tak beraturan), tampilkan dinding belakang, bayangan kedalaman di bawah bibir atas,
// gosong = cincin hitam tipis lalu dither Bayer memudar keluar, serpihan mewarisi warna asli, bara di tepi lubang.
PX.demos.crater = (host) => {
  const W = 160, H = 90, cv = PX.canvas(host, W, H, 640), c = cv.getContext('2d'), p = PX.pointer(cv), rnd = PX.rng(7);
  const PALB = ['#8c4a3a', '#9b5644', '#7d4132', '#a4604b'].map(PX.hex);
  const brick = (x, y, off, dark, seed) => {                         // pola bata + noise per bata/per piksel
    const row = Math.floor(y / 6), ox = x + (row & 1 ? 7 : 0) + off, bx = Math.floor(ox / 14);
    const mortar = y % 6 === 0 || ox % 14 === 0, base = mortar ? [60, 44, 40] : PALB[Math.floor(PX.hash(bx, row, seed) * 4)];
    const n = (PX.hash(x, y, 9) - 0.5) * 16, k = dark * (mortar ? 1 : 1);
    return [PX.clamp((base[0] + n) * k, 0, 255), PX.clamp((base[1] + n) * k, 0, 255), PX.clamp((base[2] + n) * k, 0, 255)];
  };
  const base = new ImageData(W, H), back = new ImageData(W, H), img = new ImageData(W, H), hole = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4, f = brick(x, y, 0, 1, 1), b = brick(x, y, 5, 0.42, 2);
    base.data.set([...f, 255], i); back.data.set([...b, 255], i);
  }
  img.data.set(base.data);
  const debris = [], heat = [];
  const mul = (i, k) => { for (let j = 0; j < 3; j++) img.data[i + j] *= k; };
  function carve(cx, cy, r) {
    const ph = [rnd() * 6.28, rnd() * 6.28, rnd() * 6.28], wid = 7, E = Math.ceil(r * 1.3 + wid);
    const rr = (a) => r * (1 + 0.12 * Math.sin(3 * a + ph[0]) + 0.07 * Math.sin(5 * a + ph[1]) + 0.04 * Math.sin(9 * a + ph[2]));
    const x0 = Math.max(0, cx - E), x1 = Math.min(W - 1, cx + E), y0 = Math.max(0, cy - E), y1 = Math.min(H - 1, cy + E);
    const scorch = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy) - rr(Math.atan2(dy, dx)), i = y * W + x;
      if (d <= 0) {
        if (!hole[i]) {                                           // serpihan membawa warna asli piksel
          hole[i] = 1;
          if (rnd() < 0.35) { const a = Math.atan2(dy, dx), v = 30 + rnd() * 70; debris.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, life: 0.6 + rnd() * 0.6, c: Array.from(img.data.slice(i * 4, i * 4 + 3)) }); }
        }
      } else if (d <= wid) scorch.push([x, y, d]);
    }
    for (const [x, y, d] of scorch) {                              // gosong pada dinding depan (kumulatif)
      const i = y * W + x; if (hole[i]) continue;
      if (d <= 1.5) { mul(i * 4, 0.15); if (rnd() < 0.5) heat.push({ i, t: rnd() * 0.1 }); }
      else { const t = (d - 1.5) / (wid - 1.5), lv = 0.95 * Math.pow(1 - t, 1.15); if (lv > PX.bayer(x, y)) mul(i * 4, 0.35); }
    }
    const al = (x, y) => x >= 0 && y >= 0 && x < W && y < H && !hole[y * W + x];
    for (let y = Math.max(0, y0 - 5); y <= Math.min(H - 1, y1 + 5); y++) for (let x = Math.max(0, x0 - 3); x <= Math.min(W - 1, x1 + 3); x++) {
      const i = y * W + x; if (!hole[i]) continue;
      let k = 0; for (let q = 2; q <= 5; q++) if (al(x - ((q + 1) >> 1), y - q)) { k = q; break; }     // jarak ke bibir atas
      const s = k && k <= 2 ? 0.45 : k === 3 && 0.6 > PX.bayer(x, y) ? 0.45 : k === 4 && 0.3 > PX.bayer(x, y) ? 0.45 : 1;
      for (let j = 0; j < 3; j++) img.data[i * 4 + j] = back.data[i * 4 + j] * s;
    }
  }
  const sx = document.createElement('canvas'); sx.width = W; sx.height = H; const sc = sx.getContext('2d');
  let idle = 0.5;
  PX.loop(host, (dt) => {
    for (const k of p.clicks.splice(0)) carve(k.x, k.y, 9 + Math.floor(rnd() * 6));
    idle -= dt; if (idle <= 0) { idle = 2.2; if (!p.in) carve(20 + Math.floor(rnd() * 120), 15 + Math.floor(rnd() * 60), 9 + Math.floor(rnd() * 6)); }
    sc.putImageData(img, 0, 0); c.drawImage(sx, 0, 0);
    for (const h of heat) { h.t += dt; if (h.t < 0.75) { c.fillStyle = h.t < 0.3 ? '#ffb24a' : '#d9561c'; c.globalAlpha = (1 - h.t / 0.75) * 0.9; c.fillRect(h.i % W, (h.i / W) | 0, 1, 1); } }
    c.globalAlpha = 1; while (heat.length && heat[0].t > 0.75) heat.shift();
    for (let i = debris.length - 1; i >= 0; i--) { const d = debris[i]; d.x += d.vx * dt; d.y += d.vy * dt; d.vy += 260 * dt; d.life -= dt; if (d.life <= 0) { debris.splice(i, 1); continue; } c.fillStyle = PX.rgb(d.c); c.fillRect(Math.round(d.x), Math.round(d.y), 1, 1); }
  });
};
```

