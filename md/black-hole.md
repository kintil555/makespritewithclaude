# Black hole prosedural — lensa gravitasi, cakram akresi, dan serpihan jatuh

> Cara menggambar black hole piksel — lensa per piksel yang membelokkan latar, cakram elips berdoppler, halo di atas bayangan, tekstur spiral Kepler, partikel tersedot berputar, serta timeline lahir–hidup–runtuh.

Kategori: Efek (VFX) · URL: https://makespritewithclaude.pages.dev/articles/black-hole.html

Teknik dianalisis dari `black-hole.ts` buatan Sprite Fusion (lisensi MIT). Kode demo di bawah ditulis ulang lebih sederhana: lensa + cakram + partikel + flare. Bagian timeline, jet, dan keruntuhan dijelaskan sebagai tambahan.

> **Demo interaktif "blackhole"**: buka halaman web artikel ini untuk menjalankannya. Kodenya ada di bawah.

Klik untuk melempar serpihan; matikan "Lensa gravitasi" untuk melihat bedanya; geser kemiringan dan twist.

## Anatomi (5 komponen)
1. **Bayangan** — lingkaran hitam radius `Rs` (horizon).
2. **Cincin foton** — tepi tipis sangat terang tepat di luar `Rs` (`r < 1.075`).
3. **Cakram akresi** — elips miring, dari `1.4·Rs` sampai `3.5·Rs`.
4. **Halo** — bagian cakram sisi belakang yang "terlipat" melewati atas (dan bawah) bayangan akibat lensa.
5. **Lensa gravitasi** — latar di sekitar dibelokkan dan sedikit diputar.

Koordinat: semua dihitung dalam satuan `Rs`. Untuk piksel `(x,y)`: `dx,dy = (piksel + 0.5 − pusat)/Rs`, lalu putar sebesar `tilt` → `u, v`, `r = hypot(u,v)`.

## Lensa per piksel
Untuk piksel pada jarak `r` dari pusat (dalam piksel), ambil warna dari titik sumber yang bergeser:

```
s    = (r − rE²/r) / r                    // rE = 1.4·Rs, jari-jari Einstein
fade = smooth(0.45·rOut, rOut, r)         // efek hilang di tepi, rOut = 6·Rs
s    = s·(1 − fade) + fade
rot  = −twist · min(1.6, (rE/r)^1.5) · (1 − fade)
sumber = pusat + putar(rot) · (d · s)     // d = vektor piksel dari pusat
```
Di dalam `rE`, `s` negatif sehingga bayangan latar terbalik — itulah cincin Einstein. Mengambil sampel *nearest* dari buffer latar menjaga hasil tetap tajam (tanpa interpolasi). Demo menyalin latar ke buffer lalu menimpa piksel di radius `rOut` saja.

Varian kanvas (jika latar adalah adegan penuh): ambil snapshot persegi `2·rOut`, bagi radius menjadi cincin-cincin (lebih rapat di dekat `rE` karena gradien tinggi), dan gambar tiap cincin dengan `clip` + `setTransform(skala 1/s, rotasi rot)`. Hasilnya sama; pakai varian per piksel bila adegan sudah berupa buffer piksel.

## Cakram miring
- Elips: `ρ = hypot(u, v/q)`, `q = 0.2` (makin kecil makin tipis). Cakram ada pada `1.4 ≤ ρ ≤ 3.5`.
- **Depan** (`v ≥ 0`): menutupi bayangan. **Belakang** (`v < 0`): hanya tampak bila `r ≥ 1` (di luar horizon), selain itu tertutup bayangan.
- Profil radial: `Id = 1.25·(1−k)^1.1 · (0.7 + 0.3·smooth(0,0.05,k)) · (1 − smooth(0.72,1,k)) · tex · dop`, dengan `k = (ρ−1.4)/2.1`.
- **Halo atas**: `s = max(0, −v/r)`, lebar `h = 0.1 + 0.62·s^1.3`, `e = (r−1)/h`; jika `e < 1` → `I = (1−e^1.6)·tekstur·0.9`. Lebar terbesar tepat di atas lubang (`s = 1`), mengecil ke samping — bentuk "topi" di atas bayangan. Halo bawah lebih tipis (`0.04 + 0.2·s^1.3`, intensitas 0.5).
- **Cincin foton**: `r < 1.075 + 0.04·flare` → `I = 1.05·kedip`.

## Doppler
Sisi cakram yang mendekat lebih terang dan kebiruan:

```
D    = 1 − 0.5·(u/r)         // u = komponen horizontal ter-rotasi
I   *= D^1.25
biru = max(0, D − 1.25)·1.6  // dipakai hanya pada 2 warna ramp paling terang
```

## Tekstur cakram
Guratan spiral berputar dengan kecepatan sudut `∝ ρ^−1.5` (bagian dalam lebih cepat):

```
a      = θ + 5·ρ^−1.5·t
streak = 0.66 + 0.2·sin(6a + 9.5ρ) + 0.14·sin(13a − 21ρ + 1.7)
lane   = 0.78 + 0.22·cos(12.5ρ + sin(2a)·0.6)
knot   = max(0, sin(3a + 7ρ + sin(1.3t)·2) · sin(5a − 11ρ + 0.9t))³ · 0.55
tex    = streak·lane + knot
```
Intensitas akhir `I·bright` → `tone()`: ramp **9 warna** (`#3a0e16 … #ffffff`, merah gelap → oranye → putih krem) dengan Bayer; di bawah `I = 0.08` didither ke transparan sehingga tepi luar cakram larut. Satu piksel genap/ganjil (`(x+y)&1==0`) yang terang menambah glow kecil (kilau).

## Serpihan yang jatuh
Tiap partikel dalam radius `REACH = 12.4·Rs` mendapat percepatan

```
a  = G / (d² + Rs²) · min(1, (REACH − d)/(0.25·REACH))     // lunak di dekat pusat
v += (û − û⊥·SWIRL)·a ; û = arah ke pusat, û⊥ = tegak lurusnya, SWIRL = 0.55
v −= v·drag(d)                                              // drag naik saat mendekat
```
`SWIRL` membuat jalur spiral alih-alih lurus; `d < eat` → partikel dimakan dan memanggil `feed()` (menaikkan `flare`). Partikel digambar sebagai garis pendek berekor ([resep VFX](https://makespritewithclaude.pages.dev/md/vfx-recipe.md)). Pada implementasi penuh, jenis partikel berbeda bobot tarikan (`mote ×1.4`, `debu ×0.55`) dan kepingan tanah (slab persegi) ditarik, memanjang searah tarikan, lalu ditelan.

## Timeline (implementasi penuh)
| Fase | Durasi | Perilaku |
|---|---|---|
| Lahir `FORM` | 0.4 dtk | radius overshoot `1 + 1.7(k−1)³ + 0.7(k−1)²`; cincin ungu + partikel mengitari |
| Hidup `LIFE` | 3.8 dtk | napas `1 + 0.025·sin(3.1t) + 0.01·sin(7.3t)`; denyut jantung 0.85 dtk (`pulse`) menambah tarikan, radius, spawn |
| Runtuh `COLLAPSE` | 0.42 dtk | membesar 14% lalu menyusut `(1 − ((k−0.3)/0.7)²)`, tarikan ×1.8, kilat layar |
| Ledakan akhir | ~2.5 dtk | cincin 3 lapis, 150 mote, 40 plasma, 130 serpihan berwarna benda yang pernah dimakan, `impulse` menolak partikel dan kepingan |

Intensitas yang bergantung waktu: `kuat = smooth(0, 0.8·FORM, t)·(1 + 0.8·runtuh + 0.45·denyut)`; `twist` dan `gloom` (kegelapan di sekitar) naik perlahan dan melonjak saat runtuh — keduanya dimasukkan ke lensa.

**Jet**: saat `feed ≥ 3` (dengan cooldown 1.1 dtk) dua semburan keluar tegak lurus cakram: partikel plasma cepat + garis berlapis tiga warna (`#7a5cff` tepi, `#9fd8ff` badan, `#f4fbff` inti) dengan goyangan `sin(0.45·s − 40·t)` yang melebar lalu menyempit.

**Guncangan & efek layar**: `shake(0.006·kuat + gulp·0.01)` terus-menerus, `0.1` pada puncak denyut, `0.35` saat lahir, `0.6` saat runtuh; `flash(0.7)` + riak saat runtuh.

## Urutan gambar
`partikel belakang (debu, serpihan) → kepingan → lubang + cakram → kilatan sinar → partikel depan (mote, plasma) → cincin → buffer cahaya`. Mengekspos layer `back`/`front` memungkinkan karakter ditempatkan di antaranya.

## Variasi cepat
- **Quasar**: `tilt ≈ 0`, jet permanen, cakram lebih terang.
- **Bintang neutron / pulsar**: tanpa bayangan; lihat [pulsar](https://makespritewithclaude.pages.dev/md/neutron-psr.md).
- **Lubang cacing**: tanpa cakram, hanya lensa + cincin foton.

## Checklist untuk AI
1. Lensa dulu (tanpa lensa black hole hanya terlihat seperti planet bercincin).
2. Cakram = elips `q≈0.2` + halo atas; depan menutupi bayangan.
3. Doppler pada satu sisi, ujung terang dibiru-putihkan.
4. Semua warna lewat ramp + Bayer; tidak ada `arc()` anti-alias.
5. Partikel berputar masuk (SWIRL), dimakan di horizon, memicu `flare`.
6. Loop piksel dibatasi kotak `rout·Rs`; lensa dibatasi `rOut`.
7. Render beberapa frame ke PNG dan periksa visual sebelum menyetel.

## Kode

**Kode: `src/code/50-demo-blackhole.js`**

```js
// Demo black hole: lensa per-piksel (latar bintang dibelokkan), disk elips berdoppler, halo di atas bayangan, partikel jatuh berputar. Klik = lempar serpihan.
PX.demos.blackhole = (host) => {
  const W = 160, H = 90, cv = PX.canvas(host, W, H, 800), c = cv.getContext('2d'), buf = new PX.Buf(W, H), star = new PX.Buf(W, H), lit = new PX.Light(W, H), p = PX.pointer(cv);
  const CX = W / 2, CY = H / 2 + 2, Rs = 9, rE = Rs * 1.4, rOut = Rs * 6, q = 0.2, rin = 1.4, rout = 3.5, REACH = Rs * 12.4, G = 5e5, SWIRL = 0.55;
  let tilt = -0.2, twist = 0.8, lens = true, flare = 0, t = 0, acc = 0;
  const RAMP = ['#3a0e16', '#701a17', '#ad2f17', '#e2561d', '#ff8a2a', '#ffb24a', '#ffd98c', '#fff2cf', '#ffffff'].map(PX.hex), BLUEW = PX.hex('#dcecff'), SHADOW = [2, 1, 5];
  const SHREDS = ['#e4ddf4', '#b5abd4', '#8b80b4', '#5d5488'].map(PX.hex), parts = [], R = PX.rng(7);
  const sm = (a, b, x) => { const k = PX.clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
  const ui = PX.ui(host);
  ui.range('Kemiringan', -0.5, 0.5, 0.02, tilt, (v) => (tilt = v)); ui.range('Twist lensa', 0, 1.6, 0.1, twist, (v) => (twist = v)); ui.check('Lensa gravitasi', true, (v) => (lens = v));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {                                    // latar: nebula berdither + bintang
    const n = Math.max(0, (PX.fbm(x / W * 3, y / H * 3, 5, 0, 0, 3) - 0.45) * 1.6), h = PX.hash(x, y, 3);
    if (h > 0.985) star.px(x, y, h > 0.995 ? [255, 255, 255] : h > 0.99 ? [180, 200, 255] : [255, 220, 180]); else if (n > PX.bayer(x, y)) star.px(x, y, [30, 14, 52]); else star.px(x, y, [8, 6, 16]);
  }
  const tex = (rho, th, tt) => {                                                               // tekstur disk: guratan spiral, tiap radius berputar dengan kecepatan ∝ ρ^-1.5 (Kepler)
    const a = th + 5 * Math.pow(rho, -1.5) * tt, streak = 0.66 + 0.2 * Math.sin(a * 6 + rho * 9.5) + 0.14 * Math.sin(a * 13 - rho * 21 + 1.7), lane = 0.78 + 0.22 * Math.cos(rho * 12.5 + Math.sin(a * 2) * 0.6);
    const knot = Math.max(0, Math.sin(a * 3 + rho * 7 + Math.sin(tt * 1.3) * 2) * Math.sin(a * 5 - rho * 11 + tt * 0.9));
    return streak * lane + knot * knot * knot * 0.55;
  };
  const tone = (I, x, y, blue) => {                                                            // intensitas -> ramp 9 warna + Bayer; ujung terang dibiru-putihkan (Doppler)
    if (I < 0.08 && PX.bayer(x, y) > I / 0.08) return null;
    const n = RAMP.length - 1, f = PX.clamp((I / 1.12) * n, 0, n); let i = Math.floor(f); if (f - i > PX.bayer(x, y)) i = Math.min(n, i + 1);
    return blue > 0.05 && i >= n - 2 ? PX.mix(RAMP[i], BLUEW, Math.min(1, blue)) : RAMP[i];
  };
  const lensPass = () => {                                                                     // buffer = star, tapi tiap piksel dekat lubang mengambil sampel dari posisi yang dibelokkan
    buf.d.set(star.d);
    if (!lens) return;
    for (let y = Math.max(0, Math.floor(CY - rOut)); y < Math.min(H, Math.ceil(CY + rOut)); y++) for (let x = Math.max(0, Math.floor(CX - rOut)); x < Math.min(W, Math.ceil(CX + rOut)); x++) {
      const dx = x + 0.5 - CX, dy = y + 0.5 - CY, r = Math.hypot(dx, dy); if (r >= rOut || r < 0.5) continue;
      const fade = sm(rOut * 0.45, rOut, r), s = ((r - (rE * rE) / r) / r) * (1 - fade) + fade, rot = -twist * Math.min(1.6, Math.pow(rE / r, 1.5)) * (1 - fade);
      const ux = dx * s, uy = dy * s, sx = Math.floor(CX + ux * Math.cos(rot) - uy * Math.sin(rot)), sy = Math.floor(CY + ux * Math.sin(rot) + uy * Math.cos(rot));
      buf.d[y * W + x] = sx < 0 || sy < 0 || sx >= W || sy >= H ? 0xff000000 : star.d[sy * W + sx];
    }
  };
  const hole = () => {
    const bright = 1 + 0.45 * Math.min(2, flare), tl = tilt + Math.sin(t * 1.7) * 0.04, ct = Math.cos(tl), st = Math.sin(tl), ext = Math.ceil(Rs * rout * 1.05) + 2, fl = 1 + Math.sin(t * 23) * 0.04 + Math.sin(t * 57) * 0.03;
    let blue = 0; const dop = (s) => { const D = 1 - 0.5 * s; blue = Math.max(0, D - 1.25) * 1.6; return Math.pow(D, 1.25); };
    for (let y = Math.floor(CY - ext); y <= Math.ceil(CY + ext); y++) for (let x = Math.floor(CX - ext); x <= Math.ceil(CX + ext); x++) {
      const dx = (x + 0.5 - CX) / Rs, dy = (y + 0.5 - CY) / Rs, u = dx * ct + dy * st, v = -dx * st + dy * ct, r = Math.hypot(u, v); if (r > rout * 1.05) continue;
      let I = 0, on = false; blue = 0;
      if (r >= 1) {
        const s = Math.max(0, -v / r), e = (r - 1) / (0.1 + 0.62 * Math.pow(s, 1.3));                 // halo: cakram sisi belakang yang terlipat di atas bayangan
        if (v < 0.25 && e < 1) { I = Math.max(I, (1 - Math.pow(e, 1.6)) * (0.72 + 0.28 * tex(rin + e * 1.5, Math.atan2(v, u), t)) * 0.9 * dop(u / r)); on = true; }
        const s2 = Math.max(0, v / r), e2 = (r - 1) / (0.04 + 0.2 * Math.pow(s2, 1.3));               // halo tipis di bawah
        if (v > -0.25 && e2 < 1) { I = Math.max(I, (1 - Math.pow(e2, 1.4)) * 0.5 * dop(u / r)); on = true; }
        if (r < 1.075 + 0.04 * flare) { I = Math.max(I, 1.05 * fl * (0.75 + 0.25 * dop(u / r))); on = true; }   // cincin foton
      }
      let shadow = r < 1; const rho = Math.hypot(u, v / q);
      if (rho >= rin && rho <= rout && (v >= 0 || r >= 1)) {                                       // cakram elips: ρ = jarak di bidang cakram (v diregangkan 1/q)
        const k = (rho - rin) / (rout - rin), Id = 1.25 * Math.pow(1 - k, 1.1) * (0.7 + 0.3 * sm(0, 0.05, k)) * (1 - sm(0.72, 1, k)) * tex(rho, Math.atan2(v / q, u), t) * dop(u / rho);
        if (v >= 0) { if (Id > 0.08) { I = Id; shadow = false; on = true; } } else if (Id > I) { I = Id; on = true; }   // v>=0 = sisi depan menutupi bayangan
      }
      const col = shadow || !on ? null : tone(I * bright, x, y, blue);
      if (!col) { if (r < 1) buf.px(x, y, SHADOW); continue; }
      buf.px(x, y, col);
      if (I * bright > 0.35 && ((x + y) & 1) === 0) lit.glow(x, y, 1.5, col, 0.1 * Math.min(1.3, I * bright));
    }
    lit.glow(CX, CY, Rs * 5.5, [255, 170, 90], 0.3 * bright); lit.glow(CX, CY, Rs * 2.2, [255, 225, 190], 0.14 * bright);
  };
  const spawn = (x, y, n) => { for (let i = 0; i < n; i++) { const a = Math.atan2(y - CY, x - CX) + R() * 0.8 - 0.4, d = Math.hypot(x - CX, y - CY) || 40, vt = 40 + R() * 60; parts.push({ x: x + R() * 4, y: y + R() * 4, vx: -Math.sin(a) * vt, vy: Math.cos(a) * vt, life: 1.8 + R(), col: SHREDS[(R() * 4) | 0] }); } };
  PX.loop(host, (dt) => {
    t += dt; flare -= flare * 3 * dt; acc += dt;
    if (acc > 0.5) { acc = 0; const a = R() * 6.283; spawn(CX + Math.cos(a) * 70, CY + Math.sin(a) * 40, 2); }
    for (const k of p.clicks.splice(0)) spawn(k.x, k.y, 14);
    for (let i = parts.length - 1; i >= 0; i--) {                                                  // gravitasi + pusaran + drag, dimakan bila masuk horizon
      const o = parts[i], dx = CX - o.x, dy = CY - o.y, d2 = dx * dx + dy * dy, d = Math.sqrt(d2) || 1;
      if (d < Rs * 0.9 || (o.life -= dt) <= 0) { if (d < Rs * 0.9) flare = Math.min(2.5, flare + 0.3); parts.splice(i, 1); continue; }
      const a = (G / (d2 + Rs * Rs)) * Math.min(1, (REACH - d) / (REACH * 0.25)) * dt, ux = dx / d, uy = dy / d;
      o.vx += (ux - uy * SWIRL) * Math.max(0, a); o.vy += (uy + ux * SWIRL) * Math.max(0, a); const drag = Math.min(0.2, (1 - Math.min(1, d / REACH)) * 1.4 * dt); o.vx -= o.vx * drag; o.vy -= o.vy * drag;
      o.x += o.vx * dt; o.y += o.vy * dt;
    }
    lit.clear(); lensPass(); hole();
    for (const o of parts) { const sp = Math.hypot(o.vx, o.vy) || 1, L = Math.min(8, 1 + sp * 0.03);                      // serpihan = garis pendek berekor searah kecepatan
      for (let s = 0; s <= L; s++) { const k = 1 - s / L; buf.px(o.x - (o.vx / sp) * s, o.y - (o.vy / sp) * s, PX.mix(PX.hex('#2a1a44'), o.col, k)); }
      lit.glow(o.x, o.y, 3, o.col, 0.25); }
    buf.flush(c); lit.flush(c);
  });
};
```

