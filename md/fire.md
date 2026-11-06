# Api dan asap dari partikel disc berlapis

> Ramp 9 warna, partikel membesar saat menua, inti bergeser ke atas, highlight kecil, glow additive, dan asap.

Kategori: Efek (VFX) · URL: https://kintil555.github.io/makespritewithclaude/articles/fire.html

## Resep
- **Ramp** (panas → dingin): `#fff, #fff3a6, #ffe26b, #ffc23d, #ff8a2a, #f2561d, #c9281f, #8a1f17, #4a1712`.
- Indeks warna dari umur: `ct = floor((u·1.12 + acak·0.08) · 9)`.
- Radius membesar: `it = sz·1.8·(0.55 + u^0.6·1.9)`.
- **Gambar 3 disc**: tepi = `ramp[ct+2]` (lebih gelap), badan = `ramp[ct]` bergeser `(−0.14, −0.2)·it` (naik), highlight = `ramp[ct−1]` kecil (hanya saat muda).
- **Glow**: tiap partikel genap menambah 3 disc additive alpha 0.035–0.06.
- Partikel mati → 45% menjadi **asap** (disc abu bertahap gelap, alpha 0.5 → 0).
- Gerak: dorongan naik (buoyancy), goyangan `sin` per partikel agar tidak lurus.

> **Demo interaktif "fire"**: buka halaman web artikel ini untuk menjalankannya. Kodenya ada di bawah.

Gerakkan mouse untuk memindah api.

## Kode

**Kode: `src/code/43-demo-fire.js`**

```js
// Api: partikel disc berlapis dari ramp 9 warna, inti bergeser ke atas, highlight kecil, glow additive, 45% jadi asap.
PX.demos.fire = (host) => {
  const W = 100, H = 80, cv = PX.canvas(host, W, H, 600), c = cv.getContext('2d'), buf = new PX.Buf(W, H), p = PX.pointer(cv);
  cv.style.background = '#14121c';
  const FE = ['#ffffff', '#fff3a6', '#ffe26b', '#ffc23d', '#ff8a2a', '#f2561d', '#c9281f', '#8a1f17', '#4a1712'].map(PX.hex);
  const SM = ['#7b6f72', '#5d5660', '#433d48', '#2b2630'].map(PX.hex);
  const fl = [], sm = []; let acc = 0;
  PX.loop(host, (dt, t) => {
    const bx = p.in ? p.x : W / 2 + Math.sin(t * 0.7) * 22; acc += dt * 260;
    for (; acc >= 1; acc--) fl.push({ x: bx + (Math.random() - 0.5) * 8, y: H - 8, vx: (Math.random() - 0.5) * 16, vy: -(26 + Math.random() * 30), t: 0, life: 0.45 + Math.random() * 0.45, sz: 0.5 + Math.random() * 0.6, sd: Math.random() });
    buf.clear();
    for (let i = sm.length - 1; i >= 0; i--) { const s = sm[i]; s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt; if (s.t > s.life) { sm.splice(i, 1); continue; } const u = s.t / s.life; buf.disc(s.x, s.y, 1.5 + u * 4, SM[Math.min(3, (u * 4) | 0)], 0.5 * (1 - u)); }
    for (let i = fl.length - 1; i >= 0; i--) {
      const q = fl[i]; q.t += dt; q.vy -= 40 * dt; q.vx += Math.sin(q.t * 14 + q.sd * 9) * 30 * dt; q.x += q.vx * dt; q.y += q.vy * dt;
      const u = q.t / q.life; if (u >= 1) { if (q.sd < 0.45) sm.push({ x: q.x, y: q.y, vx: q.vx * 0.3, vy: -14, t: 0, life: 0.9 }); fl.splice(i, 1); continue; }
      const it = q.sz * 1.8 * (0.55 + Math.pow(u, 0.6) * 1.9), ct = Math.min(8, Math.floor(Math.min(0.999, u * 1.12 + q.sd * 0.08) * 9));
      if (u < 0.03) { buf.disc(q.x, q.y, it * 0.95, FE[0]); continue; }
      if (ct >= 7) { buf.disc(q.x, q.y, it, FE[ct], Math.min(1, (1 - u) * 3) * 0.8); continue; }
      if (i & 1) { buf.add = true; [[it * 2.6 + 2, 0.035], [it * 1.9 + 1, 0.045], [it * 1.2 + 1, 0.06]].forEach(([r, a]) => buf.disc(q.x, q.y, r, FE[ct], a * (0.4 + 1 - u))); buf.add = false; }
      buf.disc(q.x, q.y, it, FE[Math.min(8, ct + 2)]); buf.disc(q.x - it * 0.14, q.y - it * 0.2, it * 0.76, FE[ct]);
      if (ct <= 3 && it > 1.6) buf.disc(q.x - it * 0.25, q.y - it * 0.3, it * 0.34, FE[Math.max(0, ct - 1)]);
    }
    buf.flush(c);
  });
};
```

