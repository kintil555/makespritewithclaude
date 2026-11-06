# Bola neutron dan pulsar (PSR)

> Proyektil bola neutron biru dengan jejak, ledakan Cherenkov, dan pulsar ber-sinar menyapu dengan garis medan dipol.

Kategori: Efek (VFX) · URL: https://makespritewithclaude.pages.dev/articles/neutron-psr.html

## Bola neutron (proyektil)
- Bola `R≈3.3` ter-shade 5 ambang Lambert (`l<.2, .45, .7, .9`) dengan arah cahaya tetap kiri-atas.
- Tepi yang gelap dinaikkan satu tingkat agar siluet terbaca di latar gelap.
- **Jejak**: 18 disc di belakang, mengecil dan alpha `(1−u)^1.4`; 40% pertama warna terang.
- 3 percikan piksel acak mengorbit bola tiap frame.
- Mengenai target → ledakan neutron: bintang sinar yang tumbuh, berputar, bergetar, dan berdenyut terang ke ujung, plus cincin kejut, riak, cahaya, dan getaran (lihat [ledakan](https://makespritewithclaude.pages.dev/md/explosion.md)). Bola juga memancarkan cahaya kecil.

> **Demo interaktif "neutron"**: buka halaman web artikel ini untuk menjalankannya. Kodenya ada di bawah.

Klik target untuk menembak.

## Pulsar
Bintang neutron berputar dengan sumbu magnet miring:

- **Sinar**: untuk tiap piksel hitung `u` (sepanjang sumbu) dan `v` (tegak lurus). Intensitas `I = (1−u/L)·(1−|v|/w)^0.8`, lebar `w = 1.5 + 0.1u` (kerucut). Piksel menyala jika `I > bayer(x,y)·0.9`; warna dari `I`.
- **Panjang sinar** dimodulasi `|cos|` agar tampak miring ke arah kamera.
- **Garis medan dipol**: `r = s·cos²λ`; posisi = `r·sinλ` sepanjang sumbu, `±r·cosλ` tegak lurus, ditampilkan sebagian titik (hash) agar putus-putus.
- **Bola**: shading ramp 6 warna + noise blok yang bergeser dengan waktu (kesan berputar).

> **Demo interaktif "pulsar"**: buka halaman web artikel ini untuk menjalankannya. Kodenya ada di bawah.

## Kode

**Kode: `src/code/44-demo-neutron.js`**

```js
// Bola neutron (proyektil): bola ter-shade 5 ambang Lambert + jejak disc memudar + percikan; mengenai target -> PX.Blast biru.
PX.drawOrb = (b, x, y, ang, R, ramp) => {
  const ca = Math.cos(ang), sa = Math.sin(ang), L = 18;
  for (let d = 0; d < L; d++) {                                         // jejak: disc mengecil + alpha turun
    const u = d / L, w = (1 - u) * R * 1.15 + 0.4, al = Math.pow(1 - u, 1.4) * (0.3 + Math.random() * 0.1);
    b.disc(x - ca * d, y - sa * d, w + 1.3, ramp[0], al * 0.5); b.disc(x - ca * d, y - sa * d, w, d < L * 0.4 ? ramp[2] : ramp[1], al);
  }
  b.disc(x, y, R + 2.6, ramp[1], 0.2); b.disc(x, y, R + 1.5, ramp[2], 0.32);
  const ox = Math.round(x), oy = Math.round(y), Ri = Math.ceil(R);
  for (let j = -Ri; j <= Ri; j++) for (let i = -Ri; i <= Ri; i++) {
    const d2 = i * i + j * j; if (d2 > R * R) continue;
    const nx = i / R, ny = j / R, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny)), l = Math.max(0, nx * -0.4 + ny * -0.5 + nz * 0.77);
    let col = l < 0.2 ? ramp[0] : l < 0.45 ? ramp[1] : l < 0.7 ? ramp[2] : l < 0.9 ? ramp[3] : ramp[4];
    if (d2 > (R - 1) * (R - 1) && l < 0.7) col = ramp[2];              // tepi lebih terang agar siluet terbaca
    b.px(ox + i, oy + j, col);
  }
  for (let i = 0; i < 3; i++) { const g = Math.random() * 6.28, d = R + 1 + Math.random() * 2.5; b.px(x + Math.cos(g) * d, y + Math.sin(g) * d, Math.random() < 0.5 ? ramp[4] : ramp[2]); }
};
PX.demos.neutron = (host) => {
  const W = 160, H = 90, cv = PX.canvas(host, W, H, 640), c = cv.getContext('2d'), buf = new PX.Buf(W, H), lit = new PX.Light(W, H), p = PX.pointer(cv);
  cv.style.background = '#12121c';
  const ramp = PX.PALS.neutron.c.map(PX.hex), orbs = [], blasts = []; let idle = 0.3;
  const shoot = (tx, ty) => { const a = Math.atan2(ty - 66, tx - 14); orbs.push({ x: 14, y: 66, a, tx, ty, t: 0 }); };
  PX.loop(host, (dt, t) => {
    for (const k of p.clicks.splice(0)) shoot(k.x, k.y);
    idle -= dt; if (idle <= 0) { idle = 2; if (!p.in) shoot(100 + Math.random() * 50, 20 + Math.random() * 50); }
    buf.clear(); lit.clear(); let shake = 0;
    for (let i = orbs.length - 1; i >= 0; i--) {
      const o = orbs[i], v = 130 * dt; o.x += Math.cos(o.a) * v; o.y += Math.sin(o.a) * v;
      if ((o.tx - o.x) * Math.cos(o.a) + (o.ty - o.y) * Math.sin(o.a) <= 0) { blasts.push(new PX.Blast(o.tx, o.ty, 15, PX.PALS.neutron)); orbs.splice(i, 1); continue; }
      PX.drawOrb(buf, o.x, o.y, o.a, 3.3 * (1 + Math.sin(t * 40) * 0.06), ramp); lit.glow(o.x, o.y, 11, ramp[2], 0.35);
    }
    for (let i = blasts.length - 1; i >= 0; i--) { blasts[i].step(dt); blasts[i].draw(buf); blasts[i].light(lit); shake = Math.max(shake, blasts[i].shake); if (blasts[i].done) blasts.splice(i, 1); }
    buf.flush(c); lit.flush(c); cv.style.transform = shake > 0.02 ? `translate(${((Math.random() - 0.5) * 5 * shake).toFixed(1)}px,${((Math.random() - 0.5) * 5 * shake).toFixed(1)}px)` : ''; c.fillStyle = '#5c5c78'; c.fillRect(8, 63, 8, 6);
  });
};
```



**Kode: `src/code/45-demo-pulsar.js`**

```js
// Pulsar (bintang neutron): bola bernoise + 2 sinar yang menyapu + garis medan dipol. Semua per-piksel, ramp 6 warna + Bayer.
PX.demos.pulsar = (host) => {
  const W = 128, H = 72, cv = PX.canvas(host, W, H, 640), c = cv.getContext('2d'), img = c.createImageData(W, H);
  const V = ['#241a66', '#2f3cb4', '#4f7bff', '#8fcbff', '#dff2ff', '#ffffff'].map(PX.hex), CX = W / 2, CY = H / 2, R = 9;
  const put = (x, y, ci) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 4, k = V[ci]; img.data[i] = k[0]; img.data[i + 1] = k[1]; img.data[i + 2] = k[2]; img.data[i + 3] = 255; };
  PX.loop(host, (dt, t) => {
    img.data.fill(0);
    const th = t * 2.2, ca = Math.cos(th), sa = Math.sin(th), tilt = 0.55 + 0.45 * Math.abs(Math.cos(t * 0.6));   // sinar memendek saat miring ke arah kamera
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {                                                      // sinar
      const dx = x + 0.5 - CX, dy = y + 0.5 - CY, u = Math.abs(dx * ca + dy * sa), v = -dx * sa + dy * ca, Lb = 56 * tilt;
      if (u < R * 0.8 || u > Lb) continue;
      const w = 1.5 + u * 0.1, prof = Math.max(0, 1 - Math.abs(v) / w), I = (1 - u / Lb) * Math.pow(prof, 0.8);
      if (I > PX.bayer(x, y) * 0.9) put(x, y, Math.min(5, Math.floor(I * 6)));
    }
    for (const s of [16, 25, 36]) for (let k = -90; k <= 90; k += 1) {                                              // garis medan dipol: r = s·cos²λ
      const lam = (k * Math.PI) / 180, r = s * Math.cos(lam) ** 2, al = r * Math.sin(lam), pe = r * Math.cos(lam);
      for (const side of [-1, 1]) { const px = CX + ca * al - sa * pe * side * 1.0, py = CY + sa * al + ca * pe * side * 1.0; if (PX.hash(Math.round(px), Math.round(py), 5) < 0.55) put(px, py, 2); }
    }
    for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) {                                                  // bola
      const nx = x / R, ny = y / R, r2 = nx * nx + ny * ny; if (r2 > 1) continue;
      const nz = Math.sqrt(1 - r2), l = Math.max(0, nx * -0.45 + ny * -0.5 + nz * 0.75), X = x + CX | 0, Y = y + CY | 0;
      const nzz = PX.hash(Math.floor(x + t * 3) >> 1, y >> 1, 11) - 0.5;
      const k = PX.clamp(0.1 + 0.8 * l + nzz * 0.25 + (r2 > 0.7 ? 0.1 : 0), 0, 0.999) * 5;
      put(X, Y, Math.min(5, Math.floor(k + PX.bayer(X, Y))));
    }
    c.putImageData(img, 0, 0);
  });
};
```

