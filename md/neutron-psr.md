# Bola neutron dan pulsar (PSR)

> Proyektil bola neutron biru dengan jejak, ledakan Cherenkov, dan pulsar ber-sinar menyapu dengan garis medan dipol.

Kategori: Efek (VFX) · URL: https://makespritewithclaude.pages.dev/articles/neutron-psr.html

## Bola neutron (proyektil)
- Bola `R≈3.3` ter-shade 5 ambang Lambert (`l<.2, .45, .7, .9`) dengan arah cahaya tetap kiri-atas.
- Tepi yang gelap dinaikkan satu tingkat agar siluet terbaca di latar gelap.
- **Jejak**: 18 disc di belakang, mengecil dan alpha `(1−u)^1.4`; 40% pertama warna terang.
- **Bercak biru gelap** di permukaan ikut berputar: titik permukaan `(nx,ny,nz)` diputar sudut `spin` (sumbu putar dimiringkan), lalu diberi noise blok 3D; `h>0.6` → biru gelap, `h>0.8` → lebih gelap. Tepi tidak dibercaki agar siluet tetap terbaca.
- **Glow + aura**: 3 disc additif di bawah bola (`b.add=true`) agar glow tidak memutihkan bola; aura luar biru gelap berupa lidah per sektor sudut (`hash(sel)`) yang berputar dan berganti sel, dengan ~8% piksel putih.
- Ditembakkan cepat (330 px/s) dari pojok kiri-bawah sehingga lintasannya miring. Efek tambahan: semburan moncong + cincin, percikan sepanjang jejak, kilat cahaya dan cincin kejut saat kena.
- 3 percikan piksel acak mengorbit bola tiap frame.
- Mengenai target → ledakan neutron: sinar yang terlontar keluar lalu memudar (waktu lontarnya bertingkat, sebagian serentak, sebagian telat) dengan ekor yang mengikuti inti dan putaran kecil, plus cincin kejut, riak, cahaya, dan getaran (lihat [ledakan](https://makespritewithclaude.pages.dev/md/explosion.md)). Bola juga memancarkan cahaya kecil.

> **Demo interaktif "neutron"**: buka halaman web artikel ini untuk menjalankannya. Kodenya ada di bawah.

Klik target untuk menembak.

## Pulsar
Bintang neutron berputar dengan sumbu magnet miring:

- **Sinar**: untuk tiap piksel hitung `u` (sepanjang sumbu) dan `v` (tegak lurus). Intensitas `I = (1−u/L)·(1−|v|/w)^0.8`, lebar `w = 1.5 + 0.1u` (kerucut). Piksel menyala jika `I > bayer(x,y)·0.9`; warna dari `I`.
- **Ayunan cepat, bukan putaran penuh**: sumbu berayun `θ = base + 22.5°·tanh(k·sin ωt)/tanh k` (total 45°, ω tinggi). `tanh` membuat sapuan tajam dan sedikit diam di ujung. Sinar dan medan memakai sumbu yang sama sehingga ikut berayun.
- **Panjang sinar** dimodulasi `|cos|` agar tampak miring ke arah kamera.
- **Garis medan dipol 3D**: `r = s·cos²λ`; tiap garis punya azimut `φ` mengelilingi sumbu. Posisi 3D = `r·sinλ·a + r·cosλ·(cosφ·p + sinφ·q)` (`a` sumbu miring ke kamera, `p`,`q` basis tegak lurus), diproyeksikan ortografis. `z>0` digambar **setelah** bola (menimpa), `z<0` digambar **sebelum** bola (tertutup) dan lebih gelap; titik dengan `r<R` dibuang. `φ` berputar pelan sehingga garis tampak memutari bola. Dash mengalir sepanjang garis (`(k + arah·t·70) mod 40`), kepala dash diberi `lit.glow`.
- **Ayunan smooth**: `SNAP` kecil (mendekati sinus) + interpolasi sub-langkah: sudut frame lalu→sekarang dibagi 5, tiap sinar dirender di semua sub-sudut (yang lama lebih redup) dan diambil nilai maksimum → jejak halus tanpa loncatan.
- **Efek**: halo cahaya berdenyut, cincin + percikan di tiap ujung ayunan, bintang latar berkedip.
- **Bola berputar cepat**: peta tekstur lon/lat (64×32, di-bake sekali dengan `fbm` yang tile di sumbu lon). Tiap piksel dipetakan terbalik ke titik bola `(nx,ny,nz)`, sumbu putar dimiringkan, `lon = atan2(ax,nz) + t·ω`, `lat = asin(ay)`, lalu ambil texel. Cahaya tetap, tekstur berputar (ω = 10 rad/s). Bola **bercahaya (emisif)**, bukan bola berlampu: tanpa arah cahaya, `k = (0.4 + 0.26·nz − 0.4·bercak)·(1 − 0.85·rim²)` (terang di tengah, gelap di tepi). Bercak sedikit: hanya puncak `fbm` (`(f−0.6)·6`, ±15% area). **Dither dihitung di koordinat tekstur**: `PX.tone(k, tx, ty, 5, 0.9)` — Bayer memakai `(tx,ty)` bukan `(x,y)` layar, sehingga pola dither ikut berputar (jangan memakai koordinat layar: dither akan tampak menempel diam di atas bola). Butiran partikel: `hash(tx,ty) > 0.93` → +2 warna (terang), `< 0.04` → −2 (gelap), hanya di bagian dalam (`r²<0.72`), juga ikut berputar sehingga putaran terasa. **Halo luar**: tipis dan jarang: tiap piksel di `R..R+8` menyala jika `(1−d/8)^1.5 · (0.04 + 0.38·noise(x/7 + 0.1t, y/7 − 0.07t)) > bayer(x,y)` — noise bergeser sangat pelan; ditambah 16 partikel yang melayang keluar 1–2.5 px/s. **Pinggiran**: `rim = (r²−0.45)/0.55`, `k ×= 1 − 0.85·rim²` sehingga tepi menjadi biru gelap; `r²>0.8` dipaksa ke 2 warna tergelap; bintik putih = `hash(tx>>1, ty>>1) > 0.9` pada `r²>0.6`. Karena bintik di-hash dari koordinat **tekstur** (bukan layar), pinggiran gelap + putih ikut berputar bersama bola.

> **Demo interaktif "pulsar"**: buka halaman web artikel ini untuk menjalankannya. Kodenya ada di bawah.

## Kode

**Kode: `src/code/44-demo-neutron.js`**

```js
// Bola neutron (proyektil): bola ter-shade 5 ambang Lambert + bercak biru gelap yang ikut berputar + jejak disc memudar + percikan; mengenai target -> PX.Blast biru.
// spin = sudut putar bola (rad). Bercak = noise blok 3D pada titik permukaan yang diputar (sumbu putar miring), jadi bercak tampak berputar bersama bola.
PX.SPOT = [[14, 24, 112], [8, 13, 70]];                                // biru gelap (bercak) dan biru lebih gelap (inti bercak)
PX.drawOrb = (b, x, y, ang, R, ramp, spin = 0) => {
  const ca = Math.cos(ang), sa = Math.sin(ang), L = 18;
  for (let d = 0; d < L; d++) {                                         // jejak: disc mengecil + alpha turun
    const u = d / L, w = (1 - u) * R * 1.15 + 0.4, al = Math.pow(1 - u, 1.4) * (0.3 + Math.random() * 0.1);
    b.disc(x - ca * d, y - sa * d, w + 1.3, ramp[0], al * 0.5); b.disc(x - ca * d, y - sa * d, w, d < L * 0.4 ? ramp[2] : ramp[1], al);
  }
  b.add = true; b.disc(x, y, R + 5.2, ramp[0], 0.2); b.disc(x, y, R + 3.8, ramp[1], 0.22); b.disc(x, y, R + 2.5, ramp[2], 0.3); b.add = false;   // glow: halo additif berlapis di BAWAH bola (tidak memutihkan bola)
  const ox = Math.round(x), oy = Math.round(y), ox0 = ox, oy0 = oy, Ri = Math.ceil(R), cs = Math.cos(spin), ss = Math.sin(spin), TC = 0.9, TS = 0.44;   // TC/TS: kemiringan sumbu putar
  const Ra = Math.ceil(R + 4.5);                                        // aura luar: lidah biru gelap yang bergerak (berputar + berganti sel) dengan sedikit putih
  for (let j = -Ra; j <= Ra; j++) for (let i = -Ra; i <= Ra; i++) {
    const d = Math.hypot(i, j), e = d - R; if (e < -1 || e > 4.2) continue;
    const cell = Math.floor((Math.atan2(j, i) + spin * 0.55) * 3.4), reach = 1.2 + PX.hash(cell, 7, 63) * 3, fl = PX.hash(cell, Math.floor(e + spin * 0.9), 64);
    if (e > reach) continue;
    b.px(ox0 + i, oy0 + j, fl > 0.92 ? ramp[4] : fl > 0.45 ? PX.SPOT[0] : PX.SPOT[1], 0.8 - e * 0.15);
  }
  for (let j = -Ri; j <= Ri; j++) for (let i = -Ri; i <= Ri; i++) {
    const d2 = i * i + j * j; if (d2 > R * R) continue;
    const nx = i / R, ny = j / R, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny)), l = Math.max(0, nx * -0.4 + ny * -0.5 + nz * 0.77);
    let col = l < 0.2 ? ramp[0] : l < 0.45 ? ramp[1] : l < 0.7 ? ramp[2] : l < 0.9 ? ramp[3] : ramp[4];
    if (d2 > (R - 1) * (R - 1) && l < 0.7) col = ramp[2];              // tepi lebih terang agar siluet terbaca
    else {                                                              // bercak: putar titik permukaan (spin), miringkan sumbu, ambil noise blok 3D
      const rx = nx * cs + nz * ss, rz = -nx * ss + nz * cs, qy = ny * TC - rz * TS, qz = ny * TS + rz * TC;
      const h = PX.hash(Math.floor(rx * 1.8 + 8), Math.floor(qy * 1.8 + 8), Math.floor(qz * 1.8 + 8) + 31);
      if (h > 0.88) col = PX.SPOT[1]; else if (h > 0.72) col = PX.SPOT[0];
    }
    b.px(ox + i, oy + j, col);
  }
  for (let i = 0; i < 3; i++) { const g = Math.random() * 6.28, d = R + 1 + Math.random() * 2.5; b.px(x + Math.cos(g) * d, y + Math.sin(g) * d, Math.random() < 0.5 ? ramp[4] : ramp[2]); }
};
PX.demos.neutron = (host) => {
  const W = 160, H = 90, cv = PX.canvas(host, W, H, 640), c = cv.getContext('2d'), buf = new PX.Buf(W, H), lit = new PX.Light(W, H), p = PX.pointer(cv);
  cv.style.background = '#12121c';
  const ramp = PX.PALS.neutron.c.map(PX.hex), orbs = [], blasts = [], sparks = [], rings = [], flashes = [];
  const OX = 10, OY = 80, SPEED = 330, SPIN = 24; let idle = 0.3;   // meriam di pojok kiri-bawah -> lintasan miring; kecepatan tinggi
  const burst = (x, y, a, spread, n, v0, v1) => { for (let i = 0; i < n; i++) { const g = a + (Math.random() - 0.5) * spread, v = v0 + Math.random() * (v1 - v0); sparks.push({ x, y, vx: Math.cos(g) * v, vy: Math.sin(g) * v, life: 0.2 + Math.random() * 0.35, m: 0.55, ci: 2 + ((Math.random() * 3) | 0) }); } };
  const shoot = (tx, ty) => {
    const a = Math.atan2(ty - OY, tx - OX); orbs.push({ x: OX, y: OY, a, tx, ty, t: 0 });
    burst(OX + Math.cos(a) * 4, OY + Math.sin(a) * 4, a, 0.9, 14, 40, 150);       // semburan moncong
    rings.push({ x: OX + Math.cos(a) * 3, y: OY + Math.sin(a) * 3, t: 0, max: 0.22, r1: 11 }); flashes.push({ x: OX + 2, y: OY, t: 0, max: 0.16, r: 22, k: 0.7 });
  };
  PX.loop(host, (dt, t) => {
    for (const k of p.clicks.splice(0)) shoot(k.x, k.y);
    idle -= dt; if (idle <= 0) { idle = 1.5; if (!p.in) shoot(95 + Math.random() * 58, 8 + Math.random() * 38); }
    buf.clear(); lit.clear(); let shake = 0;
    for (let i = orbs.length - 1; i >= 0; i--) {
      const o = orbs[i], v = SPEED * dt; o.t += dt; o.x += Math.cos(o.a) * v; o.y += Math.sin(o.a) * v;
      if ((o.tx - o.x) * Math.cos(o.a) + (o.ty - o.y) * Math.sin(o.a) <= 0) {
        blasts.push(new PX.Blast(o.tx, o.ty, 15, PX.PALS.neutron)); burst(o.tx, o.ty, 0, 6.3, 26, 30, 170);
        rings.push({ x: o.tx, y: o.ty, t: 0, max: 0.35, r1: 26 }); flashes.push({ x: o.tx, y: o.ty, t: 0, max: 0.22, r: 40, k: 1 }); orbs.splice(i, 1); continue;
      }
      for (let n = 0; n < 2; n++) { const g = o.a + Math.PI + (Math.random() - 0.5) * 0.9, s = 20 + Math.random() * 60; sparks.push({ x: o.x - Math.cos(o.a) * 2, y: o.y - Math.sin(o.a) * 2, vx: Math.cos(g) * s, vy: Math.sin(g) * s, life: 0.15 + Math.random() * 0.3, m: 0.45, ci: 1 + ((Math.random() * 3) | 0) }); }   // percikan jejak
      PX.drawOrb(buf, o.x, o.y, o.a, 3.3 * (1 + Math.sin(t * 40) * 0.06), ramp, o.t * SPIN); lit.glow(o.x, o.y, 15, ramp[1], 0.3); lit.glow(o.x - Math.cos(o.a) * 7, o.y - Math.sin(o.a) * 7, 9, ramp[1], 0.22);
    }
    for (let i = blasts.length - 1; i >= 0; i--) { blasts[i].step(dt); blasts[i].draw(buf); blasts[i].light(lit); shake = Math.max(shake, blasts[i].shake); if (blasts[i].done) blasts.splice(i, 1); }
    for (let i = rings.length - 1; i >= 0; i--) {                                      // cincin kejut piksel (muncul di moncong & titik kena)
      const q = rings[i]; q.t += dt; const u = q.t / q.max; if (u >= 1) { rings.splice(i, 1); continue; }
      const r = q.r1 * (1 - Math.pow(1 - u, 2)), n = Math.max(12, Math.round(r * 5)), col = u < 0.4 ? ramp[4] : ramp[2];
      for (let k = 0; k < n; k++) { const g = (k / n) * 6.283; if (PX.hash(k, Math.round(q.t * 60), 3) < 0.85 - u * 0.5) buf.px(q.x + Math.cos(g) * r, q.y + Math.sin(g) * r, col, 1 - u); }
    }
    for (let i = sparks.length - 1; i >= 0; i--) {                                     // percikan: bergerak, melambat, memudar
      const s = sparks[i]; s.life -= dt; if (s.life <= 0) { sparks.splice(i, 1); continue; }
      s.x += s.vx * dt; s.y += s.vy * dt; s.vx *= 1 - 3 * dt; s.vy *= 1 - 3 * dt; s.vy += 18 * dt;
      buf.px(s.x, s.y, ramp[s.life > s.m * 0.5 ? s.ci : 1], Math.min(1, s.life / 0.15));
    }
    for (let i = flashes.length - 1; i >= 0; i--) { const f = flashes[i]; f.t += dt; if (f.t >= f.max) { flashes.splice(i, 1); continue; } lit.glow(f.x, f.y, f.r, ramp[3], f.k * Math.pow(1 - f.t / f.max, 1.5)); }
    buf.flush(c); lit.flush(c); cv.style.transform = shake > 0.02 ? `translate(${((Math.random() - 0.5) * 5 * shake).toFixed(1)}px,${((Math.random() - 0.5) * 5 * shake).toFixed(1)}px)` : ''; c.fillStyle = '#5c5c78'; c.fillRect(OX - 5, OY - 3, 8, 6);
  });
};
```



**Kode: `src/code/45-demo-pulsar.js`**

```js
// Pulsar (bintang neutron): bola bernoise + 2 sinar + garis medan dipol. Sumbu TIDAK berputar penuh: berayun cepat ±22.5° (total 45°) di sekitar sumbu miring.
// Efek: halo cahaya berdenyut, dash yang mengalir di garis medan, cincin + percikan di ujung ayunan, bintang latar berkedip. Semua per-piksel, ramp 6 warna + Bayer.
PX.demos.pulsar = (host) => {
  const W = 128, H = 72, cv = PX.canvas(host, W, H, 640), c = cv.getContext('2d'), img = c.createImageData(W, H), lit = new PX.Light(W, H);
  cv.style.background = '#0a0a16';
  const V = ['#241a66', '#2f3cb4', '#4f7bff', '#8fcbff', '#dff2ff', '#ffffff'].map(PX.hex), CX = W / 2, CY = H / 2, R = 18, HR = 12;   // R: radius bola, HR: tebal halo dither di luar bola
  const BASE = -0.72, SWING = Math.PI / 8, FREQ = 8.5, SNAP = 0.9;               // sumbu miring, amplitudo 22.5°, ayunan cepat (periode ≈ 0.74 s), SNAP kecil = gerak halus (mendekati sinus)
  const NORM = Math.tanh(SNAP), sparks = [], rings = [], NSUB = 5, TAU = 0.5, CT = Math.cos(TAU), ST = Math.sin(TAU); let prevCos = 1, thPrev = null;   // NSUB: sub-langkah interpolasi sudut per frame; TAU: sumbu miring ke arah kamera (untuk medan 3D)
  const SPIN = 10, AXT = 0.35, TW = 96, TH = 48, TEX = new Float32Array(TW * TH), CON = new Float32Array(TW * TH), CA_ = Math.cos(AXT), SA_ = Math.sin(AXT);   // SPIN: rad/s putaran bola (≈1.6 putaran/detik), AXT: kemiringan sumbu putar
  for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {                       // bake SEKALI: peta lon/lat (tile di lon). fbm besar + kontras -> bercak gelap & titik panas yang jelas saat berputar
    const f = PX.fbm(x / 12, y / 12, 21, TW / 12, 0, 4);
    const lt = (y / TH - 0.5) * Math.PI, g = PX.fbm(x / 16, y / 16, 33, TW / 16, 0, 4);                // benua: bercak tebal & gelap, hanya di sekitar katulistiwa (lat≈0), sebagian saja
    CON[y * TW + x] = PX.clamp((g - 0.56) * 6, 0, 1) * Math.exp(-((lt / 0.5) ** 2));
    TEX[y * TW + x] = PX.clamp((f - 0.5) * 5, 0, 1);                                // bercak: hanya puncak fbm (≈15% area) -> bola bersih, bercak sedikit
  }
  const motes = Array.from({ length: 16 }, () => ({ d: Math.random() * HR, a: Math.random() * 6.283, sp: 1 + Math.random() * 1.5, w: (Math.random() - 0.5) * 0.25 }));
  const put = (x, y, ci, al = 255) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 4, k = V[ci]; img.data[i] = k[0]; img.data[i + 1] = k[1]; img.data[i + 2] = k[2]; img.data[i + 3] = al; };
  PX.loop(host, (dt, t) => {
    img.data.fill(0); lit.clear();
    const sw = Math.tanh(SNAP * Math.sin(t * FREQ)) / NORM, th = BASE + SWING * sw, ca = Math.cos(th), sa = Math.sin(th), tilt = 0.7 + 0.3 * Math.abs(Math.cos(t * 0.6)), Lb = 56 * tilt;
    const speed = Math.abs(Math.cos(t * FREQ)), pulse = 0.5 + 0.5 * Math.sin(t * 0.9);   // speed: 1 saat menyapu cepat, 0 di ujung ayunan
    const cn = Math.cos(t * FREQ);                                                  // ujung ayunan: cos berganti tanda -> cincin + percikan dari kedua ujung sinar
    if (cn * prevCos < 0) {
      rings.push({ t: 0 });
      for (const sg of [-1, 1]) for (let i = 0; i < 9; i++) { const g = th + (sg < 0 ? Math.PI : 0) + (Math.random() - 0.5) * 0.5, v = 20 + Math.random() * 55; sparks.push({ x: CX + Math.cos(th) * sg * R, y: CY + Math.sin(th) * sg * R, vx: Math.cos(g) * v, vy: Math.sin(g) * v, life: 0.35 + Math.random() * 0.5, m: 0.8 }); }
    }
    prevCos = cn;
    for (let i = 0; i < 46; i++) {                                                   // bintang latar berkedip
      const sx = (PX.hash(i, 1, 77) * W) | 0, sy = (PX.hash(i, 2, 77) * H) | 0;
      if (PX.hash(i, Math.floor(t * 3 + i), 78) > 0.35) put(sx, sy, PX.hash(i, 3, 77) < 0.2 ? 2 : 0);
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {                        // halo dither di luar bola: kerapatan turun ke luar, dimodulasi noise yang bergeser SANGAT pelan
      const d = Math.hypot(x + 0.5 - CX, y + 0.5 - CY) - R; if (d < 0.5 || d > HR) continue;
      const f = 1 - d / HR, dens = (Math.pow(f, 1.5) * (0.04 + 0.38 * PX.vnoise(x / 7 + t * 0.1, y / 7 - t * 0.07, 3)) + 0.4 * Math.pow(f, 4)) * (0.85 + 0.15 * pulse);   // + suku f^4: lebih padat tepat di dekat bola
      if (dens > PX.bayer(x, y)) put(x, y, f > 0.8 ? 2 : f > 0.45 ? 1 : 0, 255 * (0.6 + 0.4 * PX.hash(x, y, 5)));   // lapisan awal biru terang, lalu langsung biru lebih gelap; opasitas 60–100%
    }
    for (const q of motes) {                                                         // partikel kecil melayang keluar dengan lambat (2–4 px/s) sambil mengorbit pelan
      q.d += q.sp * dt; q.a += q.w * dt; if (q.d > HR) { q.d = 1; q.a = Math.random() * 6.283; }
      const rr = R + q.d, f = 1 - q.d / HR; put(CX + Math.cos(q.a) * rr, CY + Math.sin(q.a) * rr, f > 0.8 ? 2 : f > 0.45 ? 1 : 0, 200);
    }
    for (let i = rings.length - 1; i >= 0; i--) {                                    // cincin kejut dari bola
      const q = rings[i]; q.t += dt; const u = q.t / 0.7; if (u >= 1) { rings.splice(i, 1); continue; }
      const r = R + 2 + u * 44, n = Math.round(r * 5);
      for (let k = 0; k < n; k++) { const g = (k / n) * 6.283; if (PX.hash(k, Math.floor(q.t * 30), 9) < 0.7 - u * 0.5) put(CX + Math.cos(g) * r, CY + Math.sin(g) * r, u < 0.3 ? 3 : u < 0.6 ? 2 : 1); }
    }
    if (thPrev === null) thPrev = th;                                                // interpolasi: sudut frame lalu -> sekarang dibagi NSUB sub-langkah; sub-langkah lama lebih redup (jejak halus, tanpa loncatan)
    const SC = [], SS = [], SW_ = []; for (let s = 1; s <= NSUB; s++) { const a = thPrev + ((th - thPrev) * s) / NSUB; SC.push(Math.cos(a)); SS.push(Math.sin(a)); SW_.push(0.5 + (0.5 * s) / NSUB); }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {                        // sinar
      const dx = x + 0.5 - CX, dy = y + 0.5 - CY; let I = 0;
      for (let s = 0; s < NSUB; s++) {
        const u = Math.abs(dx * SC[s] + dy * SS[s]); if (u < R * 0.8 || u > Lb) continue;
        const v = -dx * SS[s] + dy * SC[s], w = 1.5 + u * 0.1, prof = Math.max(0, 1 - Math.abs(v) / w), Is = (1 - u / Lb) * Math.pow(prof, 0.8) * (0.85 + 0.15 * Math.sin(u * 0.6 - t * 30)) * SW_[s];   // denyut kecil mengalir sepanjang sinar
        if (Is > I) I = Is;
      }
      if (I > PX.bayer(x, y) * 0.9) put(x, y, Math.min(5, Math.floor(I * 6)));
    }
    const front = [], PXX = -sa, PYY = ca;                                           // medan dipol 3D: tiap garis punya azimut φ mengelilingi sumbu; titik belakang digambar sebelum bola (tertutup), titik depan sesudahnya
    [20, 29, 40].forEach((s0, si) => {                                               // r = s·cos²λ; posisi = al·sumbu + pe·(cosφ·p + sinφ·q); z>0 = menghadap kamera
      const s = s0 * (1 + 0.05 * Math.sin(t * 6 + si)), dir = si % 2 ? -1 : 1, NA = 5;
      for (let a = 0; a < NA; a++) {
        const phi = (a / NA) * 6.2832 + si * 0.6 + t * 0.9 * dir, cp = Math.cos(phi), sp = Math.sin(phi);   // azimut berputar pelan: garis tampak memutari bola
        for (let k = -90; k <= 90; k += 0.5) {                                       // langkah 0.5° agar garis menyambung
          const lam = (k * Math.PI) / 180, r = s * Math.cos(lam) ** 2; if (r < R + 0.6) continue;
          const al = r * Math.sin(lam), pe = r * Math.cos(lam), m = (((k + 90 + dir * t * 70) % 40) + 40) % 40;   // m: posisi dalam siklus dash (40° per siklus)
          const x = CX + al * ca * CT + pe * (cp * PXX - sp * ST * ca), y = CY + al * sa * CT + pe * (cp * PYY - sp * ST * sa), z = al * ST + pe * sp * CT;
          const head = m < 4 ? 4 : m < 14 ? 3 : m < 26 ? 2 : -1;                      // kepala terang -> ekor -> celah pendek antar dash
          if (z > 0) { if (head >= 0) front.push([x, y, head]); if (m < 0.5) lit.glow(x, y, 4, V[3], 0.45); }   // inti (kepala) dash depan diberi glow
          else if (head >= 0) put(x, y, head > 2 ? 2 : 1);                             // sisi belakang: lebih gelap, nanti tertutup bola
        }
      }
    });
    for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) {                    // bola
      const nx = x / R, ny = y / R, r2 = nx * nx + ny * ny; if (r2 > 1) continue;
      const nz = Math.sqrt(1 - r2), X = x + CX | 0, Y = y + CY | 0;
      const ax = nx * CA_ + ny * SA_, ay = -nx * SA_ + ny * CA_, lon = Math.atan2(ax, nz) + t * SPIN, lat = Math.asin(PX.clamp(ay, -1, 1));   // pemetaan terbalik: piksel -> titik bola (sumbu miring) -> lon/lat
      const tu = (((lon / 6.2832) % 1) + 1) % 1, tx = (tu * TW) | 0, ty = PX.clamp(((lat / Math.PI + 0.5) * TH) | 0, 0, TH - 1);
      const rim = PX.clamp((r2 - 0.45) / 0.55, 0, 1), fl = PX.hash(tx >> 1, ty >> 1, 91);                    // rim: 0 di tengah -> 1 di tepi; fl: bintik tetap di tekstur, jadi ikut berputar
      const sp = Math.min(1, TEX[ty * TW + tx] + CON[ty * TW + tx]), cn_ = CON[ty * TW + tx], pn = PX.hash(tx, ty, 123);                                              // sp: bercak sedikit (di tekstur); pn: butiran partikel halus per texel -> keduanya ikut berputar
      const sh = PX.clamp(ny * 0.8 + nx * 0.25, 0, 1) * rim;                                               // shading tipis di pinggir bawah (berdither)
      const k = PX.clamp((0.62 + 0.2 * nz - 0.55 * sp - 0.3 * cn_ - 0.4 * sh) * (1 - 0.5 * rim * rim), 0, 1);                      // bola BERCAHAYA: tanpa arah cahaya; terang di tengah, makin gelap ke tepi
      let ci = 2 + PX.tone(k, tx, ty, 4, 0.7);                                                                  // dither di koordinat TEKSTUR (bukan layar) -> pola dither ikut berputar
      if (r2 < 0.72) { if (pn < 0.06) ci = Math.max(3, ci - 1); else if (pn > 0.97) ci = 5; }   // sedikit butiran putih-kebiruan di dalam bola (jarang), berputar bersama bola
      if (r2 > 0.6 && fl > 0.9) ci = fl > 0.96 ? 4 : 3;                                                   // sedikit putih di pinggiran (berputar bersama bola)
      else if (r2 > 0.88) ci = Math.min(ci, fl > 0.5 ? 3 : 2);                                              // pinggiran luar: biru gelap
      put(X, Y, ci);
    }
    for (const f of front) put(f[0], f[1], f[2]);                                    // garis medan sisi depan menimpa bola
    thPrev = th;
    for (let i = sparks.length - 1; i >= 0; i--) {                                   // percikan dari ujung sinar
      const s = sparks[i]; s.life -= dt; if (s.life <= 0) { sparks.splice(i, 1); continue; }
      s.x += s.vx * dt; s.y += s.vy * dt; s.vx *= 1 - 1.5 * dt; s.vy *= 1 - 1.5 * dt; put(s.x, s.y, s.life > s.m * 0.6 ? 5 : s.life > s.m * 0.3 ? 3 : 2);
    }
    lit.glow(CX, CY, R + 5, V[4], 0.07);                                              // glow putih di sekitar bola
    lit.glow(CX, CY, 34 + 4 * pulse, V[1], 0.22 + 0.08 * pulse);   // cahaya: halo bintang + titik terang sepanjang sinar (lebih terang saat menyapu cepat)
    for (const sg of [-1, 1]) { lit.glow(CX + ca * sg * Lb * 0.35, CY + sa * sg * Lb * 0.35, 16, V[3], 0.14 + 0.16 * speed); lit.glow(CX + ca * sg * Lb * 0.75, CY + sa * sg * Lb * 0.75, 10, V[2], 0.1 + 0.12 * speed); }
    c.putImageData(img, 0, 0); lit.flush(c);
  });
};
```

