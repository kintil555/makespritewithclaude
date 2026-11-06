# Ledakan prosedural berlapis

> Kilat putih, gumpalan bola api 5 lapis, sinar radiasi, gelombang kejut bergelombang, partikel, dan asap — dengan palet api atau neutron.

Kategori: Efek (VFX) · URL: https://makespritewithclaude.pages.dev/articles/explosion.html

## Lapisan (urutan gambar)
1. **Asap** (di belakang): disc besar bertahap gelap, alpha ~0.55 menurun.
2. **Haze**: disc radius `R·(1+0.9e)` alpha 0.14 warna paling gelap.
3. **Kilat**: 14% awal, disc putih membesar dengan alpha menurun.
4. **Gumpalan bola api**: 10 lobus acak. Tiap lobus = **5 disc konsentris** (gelap → putih) dengan radius `1, .86, .64, .42, .22` dan alpha `.55, .7, .85, .95, 1`.
5. **Sinar**: 26 garis dari 0.3R, pendek–panjang acak, warna putih → tengah → gelap menurut jarak, 10% piksel dilewat agar bergerigi.
6. **Gelombang kejut**: 2 cincin, radius `rr·(1 + 0.07·sin3θ + 0.05·sin5θ + 0.03·sin9θ)` + jitter ±0.7. Bentuk tak beraturan membuatnya terasa organik.
7. **Partikel**: 60 piksel, kecepatan `√random` (lebih banyak dekat pusat), gravitasi.

Easing keluar: `e = 1 - (1-u)²`, alpha `a = (1-u)^1.1`, `u = t/life`. Semua posisi di-`round` oleh `PX.Buf`.

## Ganti palet = ganti tema
Hanya 5 warna ramp + 4 warna asap. Pilih "neutron" pada demo untuk versi biru.

> **Demo interaktif "blast"**: buka halaman web artikel ini untuk menjalankannya. Kodenya ada di bawah.

Klik untuk meledakkan.

## Kode

**Kode: `src/code/41-demo-blast.js`**

```js
// Ledakan prosedural berlapis: kilat putih -> gumpalan bola api (5 lapis disc) -> sinar -> gelombang kejut tak beraturan -> partikel -> asap.
PX.PALS = {
  api:     { c: ['#8a1f17', '#f2561d', '#ff8a2a', '#ffe26b', '#ffffff'], smoke: ['#7e3030', '#4a2a2a', '#2e2024', '#1a161c'] },
  neutron: { c: ['#1b2fb0', '#3a5cff', '#8fb4ff', '#c9d8ff', '#ffffff'], smoke: ['#5a6aa8', '#3a4278', '#262a4c', '#14162a'] },
};
PX.Blast = class {
  constructor(x, y, R, pal = PX.PALS.api) {
    const r = Math.random; this.x = Math.round(x); this.y = Math.round(y); this.R = R; this.t = 0; this.life = 0.95 + r() * 0.25;
    this.c = pal.c.map(PX.hex); this.sm = pal.smoke.map(PX.hex);
    this.rays = Array.from({ length: 26 }, () => ({ a: r() * 6.283, len: 0.4 + r() * 1.9, w: r() < 0.25, t0: r() * 0.12 }));
    this.lobes = Array.from({ length: 10 }, () => ({ a: r() * 6.283, d: r() * 0.75, r: 0.2 + r() * 0.28, t0: r() * 0.22, tl: 0.45 + r() * 0.4 }));
    this.ph = [r() * 6.283, r() * 6.283, r() * 6.283];
    this.parts = Array.from({ length: 60 }, () => { const g = r() * 6.283, v = (0.4 + Math.sqrt(r()) * 2.4) * R * 3; return { x: this.x, y: this.y, vx: Math.cos(g) * v, vy: Math.sin(g) * v - R, life: 0.25 + r() * 0.65, ci: (r() * 4) | 0 }; });
    this.smoke = Array.from({ length: 7 }, () => ({ x: this.x + (r() - 0.5) * R, y: this.y + (r() - 0.5) * R, vx: (r() - 0.5) * 8, vy: -4 - r() * 9, life: 1 + r() * 0.6, r0: R * 0.18, r1: R * (0.4 + r() * 0.4) }));
  }
  get done() { return this.t > this.life + 0.8; }
  step(dt) {
    this.t += dt;
    for (const p of this.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += this.R * 14 * dt; }
    for (const s of this.smoke) { s.x += s.vx * dt; s.y += s.vy * dt; }
  }
  draw(b) {
    const { x: cx, y: cy, R, c } = this, u = this.t / this.life, e = 1 - (1 - u) * (1 - u), a = Math.pow(Math.max(0, 1 - u), 1.1), rnd = Math.random;
    for (const s of this.smoke) { const su = this.t / s.life; if (su > 1 || su < 0.12) continue; b.disc(s.x, s.y, s.r0 + (s.r1 - s.r0) * su, this.sm[Math.min(3, (su * 4) | 0)], 0.55 * (1 - su)); }
    if (u < 1) {
      b.disc(cx, cy, R * (1 + 0.9 * e), c[0], a * 0.14);
      if (u < 0.14) b.disc(cx, cy, R * (0.5 + (0.9 * u) / 0.14), c[4], 1 - u / 0.14);       // kilat
      for (const l of this.lobes) {                                                       // gumpalan bola api: 5 disc konsentris
        const lu = (u - l.t0) / l.tl; if (lu < 0 || lu > 1) continue;
        const le = 1 - (1 - lu) * (1 - lu), al = Math.pow(1 - lu, 1.1), sz = l.r * R * (0.4 + 1.1 * le),
          lx = cx + Math.cos(l.a) * l.d * R * 1.5 * le, ly = cy + Math.sin(l.a) * l.d * R * 1.5 * le;
        [[0, 1, 0.55], [1, 0.86, 0.7], [2, 0.64, 0.85], [3, 0.42, 0.95], [4, 0.22 * (1 - lu * 0.6), 1]].forEach(([ci, k, A]) => b.disc(lx, ly, sz * k, c[ci], al * A));
      }
      for (const r of this.rays) {                                                        // sinar radiasi
        const ru = (u - r.t0) / (1 - r.t0); if (ru < 0) continue;
        const re = 1 - (1 - ru) * (1 - ru), L = R * r.len * 1.3 * re, s0 = R * 0.3, ca = Math.cos(r.a), sa = Math.sin(r.a), al = Math.pow(1 - ru, 1.2);
        for (let d = s0; d < s0 + L; d++) {
          if (rnd() < 0.1) continue; const f = (d - s0) / L, col = f < 0.25 ? c[4] : f < 0.6 ? c[2] : c[1];
          b.px(cx + ca * d, cy + sa * d, col, al * (1 - f) * 0.95);
        }
      }
      for (let k = 0; k < 2; k++) {                                                       // gelombang kejut 2 lapis, radius bergelombang
        const rr = R * (k ? 0.3 + 1.2 * e : 0.4 + 1.7 * e), n = Math.ceil(rr * 6.3), aa = a * (k ? 0.55 : 0.9); if (rr < 1) continue;
        for (let i = 0; i < n; i++) {
          if (rnd() < 0.22) continue; const g = (i / n) * 6.283,
            rd = rr + rr * (Math.sin(g * 3 + this.ph[0]) * 0.07 + Math.sin(g * 5 + this.ph[1]) * 0.05 + Math.sin(g * 9 + this.ph[2]) * 0.03) + (rnd() - 0.5) * 1.4;
          b.px(cx + Math.cos(g) * (rd + 1.5), cy + Math.sin(g) * (rd + 1.5), c[1], aa); b.px(cx + Math.cos(g) * rd, cy + Math.sin(g) * rd, k ? c[2] : c[4], aa);
        }
      }
    }
    for (const p of this.parts) { const pu = this.t / p.life; if (pu < 1) b.px(p.x, p.y, c[Math.min(4, 4 - ((pu * 3) | 0))], 1 - pu * 0.5); }
  }
};

PX.demos.blast = (host) => {
  const W = 160, H = 90, cv = PX.canvas(host, W, H, 640), c = cv.getContext('2d'), buf = new PX.Buf(W, H), p = PX.pointer(cv);
  cv.style.background = '#12121c';
  let pal = 'api', list = [], idle = 0;
  PX.ui(host).select('Palet', Object.keys(PX.PALS), 'api', (v) => (pal = v));
  PX.loop(host, (dt) => {
    for (const k of p.clicks.splice(0)) list.push(new PX.Blast(k.x, k.y, 14, PX.PALS[pal]));
    idle -= dt; if (idle <= 0) { idle = 1.8; if (!p.in) list.push(new PX.Blast(30 + Math.random() * 100, 25 + Math.random() * 40, 11 + Math.random() * 6, PX.PALS[pal])); }
    list = list.filter((q) => !q.done); buf.clear();
    for (const q of list) { q.step(dt); q.draw(buf); }
    buf.flush(c);
  });
};
```

