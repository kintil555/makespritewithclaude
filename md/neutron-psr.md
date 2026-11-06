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

## Bola PSR (senjata bintang neutron)
Cara game menggambar bola PSR yang muncul dari senjata. Pelajaran utamanya: bola **tidak** diberi arah cahaya. Ia bintang, jadi terang karena *menghadap kamera*, dan volume datang dari tepi yang menggelap, bercak 3D yang berputar, dan tutup putih di kutub magnet.

- **Satu rumus kecerahan**: `k = (0.42 + 0.58·nz)·(1 − 0.6·bercak) + 0.8·tutupKutub + 0.3·kutubMenghadapKamera`. `nz` = komponen sumbu kamera di permukaan bola (1 di tengah, 0 di tepi).
- **Ramp 6 warna** `#241a66 #2f3cb4 #4f7bff #8fcbff #dff2ff #ffffff`, indeks `floor(k·5 + bayer(x,y) − 0.5)` (Bayer 4×4 koordinat layar). Tengah ≈ `#dff2ff`/putih, tepi turun ke biru: bola tidak putih rata.
- **Cincin tepi**: piksel 1.5 px terluar dibatasi `k ≤ 0.22` supaya siluet jelas di latar gelap.
- **Bercak berputar**: titik permukaan diproyeksikan ke frame bola (sumbu putar miring 0.35 rad ke kamera), diputar sudut spin, lalu 2 oktaf **value noise 3D** (`×2.4` bobot 0.62, `×6` bobot 0.38) → `smoothstep(0.46, 0.7)` = bercak gelap. Karena noise 3D, bercak bergerak melengkung mengikuti permukaan, bukan menggeser texture 2D.
- **Kutub magnet (oblique rotator)**: sumbu magnet = sumbu putar dimiringkan 0.62 rad yang ikut berputar. `smoothstep(0.84, 0.96, |n·sumbuMagnet|)` memberi tutup putih yang berputar; saat kutub menghadap kamera seluruh bola dan halo lebih terang.
- **Halo dither**: dari tepi bola ke `R·(1.75..2)`, `m = (1 − d)^2.2`, piksel menyala jika `m > bayer`; warna `m>0.7 #e9f6ff`, `>0.45 #8fd3ff`, `>0.22 #3b6cff`, sisanya `#7a4dff`.
- **Garis medan dipol**: `r = s·sin²λ`, 6 azimut, radius `R·2.1` dan `R·3.3`. Sisi belakang (`z<0`) digambar **sebelum** bola dan tidak boleh masuk lingkaran bola; sisi depan sesudahnya. Tiap titik hanya menyala jika `rapat > bayer` → garis putus-putus berbintik.
- **Duri silang** 4 arah dengan dither memudar, lalu 2 `glow` additif (biru muda besar, putih kecil) dengan kedip `0.9 + 0.1·sin·sin`.
- Semua frekuensi kelipatan bulat `2π/6` → GIF loop mulus. (Sinar jet panjang di game tidak dimasukkan; lihat bagian Pulsar.)

> **Demo interaktif "star"**: buka halaman web artikel ini untuk menjalankannya. Kodenya ada di bawah.


**Kode: `src/code/45-demo-star.js`**

```js
// Bola PSR (senjata bintang neutron) — port teknik gambar dari game. Semua per-piksel, 6 warna + Bayer 4x4, tanpa arah cahaya.
// Resep bola (f0): kecerahan k = (0.42 + 0.58·nz)·(1 − 0.6·bercak) + 0.8·tutupKutub + 0.3·kutubMenghadapKamera; tepi luar 1.5 px dibatasi k ≤ 0.22 (cincin gelap);
// indeks ramp = floor(k·5 + bayer − 0.5). Bercak = noise 3D yang diputar bersama bola (sumbu putar miring), tutup putih = kutub magnet yang berputar miring (oblique rotator).
PX.demos.star = (host) => {
  const W = 144, H = 96, cv = PX.canvas(host, W, H, 640), c = cv.getContext('2d'), img = c.createImageData(W, H), lit = new PX.Light(W, H);
  cv.style.background = '#0a0a16';
  const RAMP = ['#241a66', '#2f3cb4', '#4f7bff', '#8fcbff', '#dff2ff', '#ffffff'].map(PX.hex);   // ramp bola (index 0..5)
  const WHITE = PX.hex('#ffffff'), ICE = PX.hex('#e9f6ff'), SKY = PX.hex('#8fd3ff'), BLUE = PX.hex('#3b6cff'), VIO = PX.hex('#7a4dff');
  const CX = W / 2, CY = H / 2, R = 15, LOOP = 6, TP = (2 * Math.PI) / LOOP, SPIN = 3 * 2 * Math.PI, LEAN = 0.35, INC = 0.62, AZ = 0.9;   // SPIN: 3 putaran/detik (bulat per LOOP -> GIF loop mulus)
  const FR = [Math.cos(AZ) * Math.cos(LEAN), Math.sin(AZ) * Math.cos(LEAN), Math.sin(LEAN), -Math.sin(AZ), Math.cos(AZ), 0, -Math.sin(LEAN) * Math.cos(AZ), -Math.sin(LEAN) * Math.sin(AZ), Math.cos(LEAN)];   // frame 3x3: [0..2] sumbu putar (miring ke kamera), [3..5] & [6..8] basis tegak lurus
  const ss = (a, b, x) => { const u = PX.clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
  const noise3 = (x, y, z) => {                                                      // value noise 3D (hash integer + interpolasi smoothstep)
    const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z), u = ss(0, 1, x - X), v = ss(0, 1, y - Y), w = ss(0, 1, z - Z), L = (a, b, t) => a + (b - a) * t, h = (i, j, k) => PX.hash(X + i, Y + j, Z + k + 500);
    return L(L(L(h(0, 0, 0), h(1, 0, 0), u), L(h(0, 1, 0), h(1, 1, 0), u), v), L(L(h(0, 0, 1), h(1, 0, 1), u), L(h(0, 1, 1), h(1, 1, 1), u), v), w);
  };
  const put = (x, y, col, a = 255) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 4; img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = a; };
  const axisAt = (ang) => { const s = Math.sin(INC) * Math.cos(ang), q = Math.sin(INC) * Math.sin(ang), k = Math.cos(INC); return [k * FR[0] + s * FR[3] + q * FR[6], k * FR[1] + s * FR[4] + q * FR[7], k * FR[2] + s * FR[5] + q * FR[8]]; };   // sumbu magnet = sumbu putar dimiringkan INC, ikut berputar
  const fieldLines = (ang, radii, front, dens, colA, colB) => {                      // garis medan dipol r = s·sin²λ, 6 azimut; hanya sisi depan (z>=0) atau belakang; titik lolos jika dens > bayer -> garis putus-putus berbintik
    const K = Math.cos(INC), S = Math.sin(INC), c0 = Math.cos(ang), s0 = Math.sin(ang), e = [c0 * FR[3] + s0 * FR[6], c0 * FR[4] + s0 * FR[7], c0 * FR[5] + s0 * FR[8]], f = [-s0 * FR[3] + c0 * FR[6], -s0 * FR[4] + c0 * FR[7], -s0 * FR[5] + c0 * FR[8]];
    const a = [S * e[0] + K * FR[0], S * e[1] + K * FR[1], S * e[2] + K * FR[2]], p = [K * e[0] - S * FR[0], K * e[1] - S * FR[1], K * e[2] - S * FR[2]];   // a: sumbu magnet, p: basis tegak lurus
    for (const s of radii) { const l0 = Math.asin(Math.sqrt(R / s)), step = PX.clamp(0.7 / s, 0.004, 0.08);
      for (let h = 0; h < 6; h++) { const d = (h / 6) * 6.2832 + s * 0.013, cd = Math.cos(d), sd = Math.sin(d), qx = cd * p[0] + sd * f[0], qy = cd * p[1] + sd * f[1], qz = cd * p[2] + sd * f[2];
        for (let l = l0; l <= Math.PI - l0; l += step) { const r = s * Math.sin(l) ** 2, cl = Math.cos(l), sl = Math.sin(l), x = r * (cl * a[0] + sl * qx), y = r * (cl * a[1] + sl * qy), z = r * (cl * a[2] + sl * qz);
          if ((z >= 0) !== front) continue; if (!front && x * x + y * y < R * R) continue;
          const px = Math.round(CX + x), py = Math.round(CY + y); if (dens > PX.bayer(px, py)) put(px, py, Math.abs(cl) > 0.6 ? colB : colA); } } }
  };
  const draw = (t) => {
    img.data.fill(0); lit.clear();
    const ang = SPIN * t, ax = axisAt(ang), pole = ss(Math.sin(LEAN + INC) - 0.2, Math.sin(LEAN + INC), ax[2]) + 0.45 * ss(Math.sin(INC - LEAN) - 0.12, Math.sin(INC - LEAN), -ax[2]);   // pole: seberapa kutub menghadap kamera -> bola lebih terang
    const flick = 0.9 + 0.1 * Math.sin(TP * 54 * t) * Math.sin(TP * 24 * t), dens = 0.28 + 0.3 * pole;
    for (let i = 0; i < 40; i++) if (PX.hash(i, (Math.floor(t * 3) + i) % 18, 78) > 0.4) put(PX.hash(i, 1, 77) * W, PX.hash(i, 2, 77) * H, PX.hash(i, 3, 77) < 0.2 ? BLUE : RAMP[0]);   // bintang latar
    const HR = R * (1.75 + 0.25 * pole);
    for (let y = Math.floor(CY - HR); y <= Math.ceil(CY + HR); y++) for (let x = Math.floor(CX - HR); x <= Math.ceil(CX + HR); x++) {   // halo dither: padat dekat bola, f^2.2
      const d = Math.hypot(x + 0.5 - CX, y + 0.5 - CY); if (d < R - 0.5 || d > HR) continue;
      const m = Math.pow(1 - (d - R) / (HR - R), 2.2) * (0.85 + 0.3 * pole); if (m <= PX.bayer(x, y)) continue; put(x, y, m > 0.7 ? ICE : m > 0.45 ? SKY : m > 0.22 ? BLUE : VIO);
    }
    fieldLines(ang, [R * 2.1, R * 3.3], false, dens * 0.9, RAMP[1], RAMP[2]);              // garis medan SISI BELAKANG (digambar sebelum bola)
    const cs = Math.cos(ang), sn = Math.sin(ang), J = Math.max(0, 1 - 1.5 / R);
    for (let y = Math.floor(CY - R); y <= Math.ceil(CY + R); y++) for (let x = Math.floor(CX - R); x <= Math.ceil(CX + R); x++) {   // BOLA
      const nx = (x + 0.5 - CX) / R, ny = (y + 0.5 - CY) / R, r2 = nx * nx + ny * ny; if (r2 > 1) continue;
      const nz = Math.sqrt(1 - r2), u = nx * FR[3] + ny * FR[4] + nz * FR[5], v = nx * FR[6] + ny * FR[7] + nz * FR[8], w = nx * FR[0] + ny * FR[1] + nz * FR[2];   // titik permukaan di frame bola
      const hx = u * cs + v * sn, hy = -u * sn + v * cs;                             // putar mengelilingi sumbu putar -> bercak ikut berputar
      const n = noise3(hx * 2.4 + 11, hy * 2.4, w * 2.4) * 0.62 + noise3(hx * 6 + 3, hy * 6, w * 6 + 7) * 0.38, spot = ss(0.46, 0.7, n);   // 2 oktaf noise 3D -> bercak gelap
      const cap = ss(0.84, 0.96, Math.abs(nx * ax[0] + ny * ax[1] + nz * ax[2]));  // tutup putih di kutub magnet
      let k = (0.42 + 0.58 * nz) * (1 - 0.6 * spot) + cap * 0.8 + pole * 0.3;     // terang = menghadap kamera (emisif), bukan Lambert
      if (r2 > J * J) k = Math.min(k, 0.22);                                         // cincin tepi 1.5 px gelap -> siluet terbaca
      put(x, y, RAMP[PX.clamp(Math.floor(k * 5 + PX.bayer(x, y) - 0.5), 0, 5)]);
    }
    fieldLines(ang, [R * 2.1, R * 3.3], true, dens * 1.3, RAMP[2], SKY);                      // garis medan SISI DEPAN (menimpa bola)
    const AT = R * (1.4 + 2.2 * pole);
    for (let i = Math.ceil(R); i < AT; i++) { const f = 1 - (i - R) / (AT - R); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = Math.round(CX + dx * i), y = Math.round(CY + dy * i); if (PX.bayer(x, y) < f * 1.4) put(x, y, f > 0.6 ? WHITE : f > 0.3 ? ICE : SKY); } }   // 4 duri silang berdither
    lit.glow(CX, CY, R * 5, SKY, (0.5 + 0.4 * pole) * 0.35 * flick); lit.glow(CX, CY, R * 2.2, WHITE, (0.45 + 0.4 * pole) * 0.35);
    c.putImageData(img, 0, 0); lit.flush(c);
  };
  PX.loop(host, (dt, t) => draw(t));
  PX.gifButton(host, cv, draw, { loop: LOOP, scale: 4, name: 'bola-psr' });
};
```


## Pulsar
Bintang neutron berputar dengan sumbu magnet miring:

- **Sinar**: untuk tiap piksel hitung `u` (sepanjang sumbu) dan `v` (tegak lurus). Intensitas `I = (1−u/L)·(1−|v|/w)^0.8`, lebar `w = 1.5 + 0.1u` (kerucut). Piksel menyala jika `I > bayer(x,y)·0.9`; warna dari `I`.
- **Ayunan cepat, bukan putaran penuh**: sumbu berayun `θ = base + 22.5°·tanh(k·sin ωt)/tanh k` (total 45°, ω tinggi). `tanh` membuat sapuan tajam dan sedikit diam di ujung. Sinar dan medan memakai sumbu yang sama sehingga ikut berayun.
- **Panjang sinar** dimodulasi `|cos|` agar tampak miring ke arah kamera.
- **Garis medan dipol 3D**: `r = s·cos²λ`; tiap garis punya azimut `φ` mengelilingi sumbu. Posisi 3D = `r·sinλ·a + r·cosλ·(cosφ·p + sinφ·q)` (`a` sumbu miring ke kamera, `p`,`q` basis tegak lurus), diproyeksikan ortografis. `z>0` digambar **setelah** bola (menimpa), `z<0` digambar **sebelum** bola (tertutup) dan lebih gelap; titik dengan `r<R` dibuang. `φ` berputar pelan sehingga garis tampak memutari bola. Dash mengalir sepanjang garis (`(k + arah·t·70) mod 40`), kepala dash diberi `lit.glow`.
- **Ayunan smooth**: `SNAP` kecil (mendekati sinus) + interpolasi sub-langkah: sudut frame lalu→sekarang dibagi 5, tiap sinar dirender di semua sub-sudut (yang lama lebih redup) dan diambil nilai maksimum → jejak halus tanpa loncatan.
- **Efek**: halo cahaya berdenyut, cincin + percikan di tiap ujung ayunan, bintang latar berkedip.
- **Bola berputar cepat**: peta tekstur lon/lat (96×48, di-bake sekali dengan `fbm` yang tile di sumbu lon). Tiap piksel dipetakan terbalik ke titik bola `(nx,ny,nz)`, sumbu putar dimiringkan, `lon = atan2(ax,nz) + t·ω`, `lat = asin(ay)`, lalu ambil texel. Tekstur berputar (ω ≈ 10 rad/s). Bola **bercahaya (emisif)**, memakai resep bola PSR dari game (lihat [Bola PSR](#bola-psr-senjata-bintang-neutron) di bawah): `k = (0.42 + 0.58·nz)·(1 − 0.45·bercak³) + 0.8·tutupKutub`, tepi luar `r²>0.9` dibatasi `k ≤ 0.22` (cincin gelap tipis), lalu `ci = floor(k·5 + bayer(tx,ty) − 0.5)` di ramp 6 warna. **Bercak**: puncak `fbm` + **benua** di sekitar katulistiwa. **Dither dihitung di koordinat tekstur** (Bayer memakai `(tx,ty)`) agar pola ikut berputar. Butiran halus: `hash(tx,ty) < 0.06` → satu tingkat lebih gelap, `> 0.97` → satu tingkat lebih terang, hanya di dalam (`r²<0.72`). **Halo luar** (`R..R+12`, lebih jauh dan lebih padat dekat bola): `(f^1.5·(0.04 + 0.38·noise) + 0.4·f⁴)·(0.85+0.15·pulse) > bayer`, `f = 1 − d/12`; lapisan awal (`f>0.8`) campuran biru muda/biru terang, lalu `f>0.45` biru `#2f3cb4`, sisanya `#241a66`; tiap piksel halo punya opasitas acak 60–100% (`alpha = 255·(0.6 + 0.4·hash)`). Noise halo bergeser melingkar pelan (periodik), plus 16 partikel yang melayang keluar.
- **GIF**: tiap demo animasi punya tombol **Unduh GIF** (`PX.gifAuto`: merekam 5 detik dengan `dt = 1/50` tetap, dikomposit di atas warna latar kanvas, palet 256 warna dari histogram). Delay GIF satuan 1/100 s, jadi **50 fps** (delay 2) adalah yang tercepat yang dihormati browser (live ≈ 60 fps). Khusus pulsar loop-nya **mulus**: demo adalah fungsi murni `draw(t)` tanpa state, semua frekuensi dibulatkan ke kelipatan `2π/LOOP` (LOOP = 6 s), cincin/percikan/partikel dihitung dari waktu sejak kejadian dengan `hash` (bukan `Math.random`), sehingga frame ke-300 identik dengan frame 0 (`PX.gifButton`).


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
  const BASE = -0.72, SWING = Math.PI / 8, SNAP = 0.9, LOOP = 6, TP = (2 * Math.PI) / LOOP, FREQ = 8 * TP;   // LOOP: periode animasi (s). Semua frekuensi = kelipatan bulat 2π/LOOP -> animasi persis berulang tiap LOOP detik (dasar GIF loop mulus). FREQ ≈ 8.4 rad/s               // sumbu miring, amplitudo 22.5°, ayunan cepat (periode ≈ 0.74 s), SNAP kecil = gerak halus (mendekati sinus)
  const NORM = Math.tanh(SNAP), NSUB = 5, TAU = 0.5, CT = Math.cos(TAU), ST = Math.sin(TAU);   // NSUB: sub-langkah interpolasi sudut per frame; TAU: sumbu miring ke arah kamera (untuk medan 3D)
  const SPIN = 10 * TP, AXT = 0.35, TW = 96, TH = 48, TEX = new Float32Array(TW * TH), CON = new Float32Array(TW * TH), CA_ = Math.cos(AXT), SA_ = Math.sin(AXT);   // SPIN: rad/s putaran bola (≈1.6 putaran/detik), AXT: kemiringan sumbu putar
  for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {                       // bake SEKALI: peta lon/lat (tile di lon). fbm besar + kontras -> bercak gelap & titik panas yang jelas saat berputar
    const f = PX.fbm(x / 12, y / 12, 21, TW / 12, 0, 4);
    const lt = (y / TH - 0.5) * Math.PI, g = PX.fbm(x / 16, y / 16, 33, TW / 16, 0, 4);                // benua: bercak tebal & gelap, hanya di sekitar katulistiwa (lat≈0), sebagian saja
    CON[y * TW + x] = PX.clamp((g - 0.56) * 6, 0, 1) * Math.exp(-((lt / 0.5) ** 2));
    TEX[y * TW + x] = PX.clamp((f - 0.5) * 5, 0, 1);                                // bercak: hanya puncak fbm (≈15% area) -> bola bersih, bercak sedikit
  }
  const put = (x, y, ci, al = 255) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 4, k = V[ci]; img.data[i] = k[0]; img.data[i + 1] = k[1]; img.data[i + 2] = k[2]; img.data[i + 3] = al; };
  const draw = (t) => {
    img.data.fill(0); lit.clear();
    const thAt = (u) => BASE + SWING * Math.tanh(SNAP * Math.sin(u * FREQ)) / NORM, th = thAt(t), ca = Math.cos(th), sa = Math.sin(th), tilt = 0.7 + 0.3 * Math.abs(Math.cos((t * TP) / 2)), Lb = 56 * tilt;
    const speed = Math.abs(Math.cos(t * FREQ)), pulse = 0.5 + 0.5 * Math.sin(t * TP);   // speed: 1 saat menyapu cepat, 0 di ujung ayunan
    const em = Math.floor((t * FREQ - Math.PI / 2) / Math.PI);                       // indeks ujung ayunan terakhir (cos(FREQ·t) berganti tanda): cincin + percikan dihitung SEBAGAI FUNGSI waktu sejak kejadian -> tanpa state, periodik
    const evSign = (m) => (((m % 2) + 2) % 2 === 0 ? 1 : -1), evT = (m) => (Math.PI / 2 + m * Math.PI) / FREQ;
    for (let i = 0; i < 46; i++) {                                                   // bintang latar berkedip
      const sx = (PX.hash(i, 1, 77) * W) | 0, sy = (PX.hash(i, 2, 77) * H) | 0;
      if (PX.hash(i, (Math.floor(t * 3) + i) % 18, 78) > 0.35) put(sx, sy, PX.hash(i, 3, 77) < 0.2 ? 2 : 0);
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {                        // halo dither di luar bola: kerapatan turun ke luar, dimodulasi noise yang bergeser SANGAT pelan
      const d = Math.hypot(x + 0.5 - CX, y + 0.5 - CY) - R; if (d < 0.5 || d > HR) continue;
      const f = 1 - d / HR, dens = (Math.pow(f, 1.5) * (0.04 + 0.38 * PX.vnoise(x / 7 + 0.25 * Math.cos(t * TP), y / 7 + 0.25 * Math.sin(t * TP), 3)) + 0.4 * Math.pow(f, 4)) * (0.85 + 0.15 * pulse);   // + suku f^4: lebih padat tepat di dekat bola
      if (dens > PX.bayer(x, y)) put(x, y, f > 0.8 ? (PX.hash(x, y, 6) < 0.5 ? 3 : 2) : f > 0.45 ? 1 : 0, 255 * (0.6 + 0.4 * PX.hash(x, y, 5)));   // lapisan awal biru terang, lalu langsung biru lebih gelap; opasitas 60–100%
    }
    for (let i = 0; i < 16; i++) {                                                   // partikel kecil melayang keluar dengan lambat; posisi = fungsi waktu (n siklus per LOOP), arah acak tiap siklus
      const n = 1 + (i & 1), Li = LOOP / n, ph = t / Li + PX.hash(i, 0, 60), u = ph - Math.floor(ph), cyc = ((Math.floor(ph) % n) + n) % n;
      const d = 1 + u * (HR - 1), a = PX.hash(i, cyc, 61) * 6.283 + (PX.hash(i, 1, 62) - 0.5) * 0.25 * u * Li, rr = R + d, f = 1 - d / HR;
      put(CX + Math.cos(a) * rr, CY + Math.sin(a) * rr, f > 0.8 ? 3 : f > 0.45 ? 1 : 0, 200);
    }
    for (let m = em - 1; m <= em; m++) {                                             // cincin kejut dari bola (umur 0.7 s sejak ujung ayunan)
      const age = t - evT(m), u = age / 0.7; if (u < 0 || u >= 1) continue;
      const r = R + 2 + u * 44, n = Math.round(r * 5);
      for (let k = 0; k < n; k++) { const g = (k / n) * 6.283; if (PX.hash(k, Math.floor(age * 30), 9) < 0.7 - u * 0.5) put(CX + Math.cos(g) * r, CY + Math.sin(g) * r, u < 0.3 ? 3 : u < 0.6 ? 2 : 1); }
    }
    const SC = [], SS = [], SW_ = []; for (let s = 1; s <= NSUB; s++) { const a = thAt(t - ((NSUB - s) / NSUB) / 60); SC.push(Math.cos(a)); SS.push(Math.sin(a)); SW_.push(0.5 + (0.5 * s) / NSUB); }   // jejak: sudut ayunan beberapa sub-langkah (≤1/60 s) ke belakang, lama = lebih redup
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {                        // sinar
      const dx = x + 0.5 - CX, dy = y + 0.5 - CY; let I = 0;
      for (let s = 0; s < NSUB; s++) {
        const u = Math.abs(dx * SC[s] + dy * SS[s]); if (u < R * 0.8 || u > Lb) continue;
        const v = -dx * SS[s] + dy * SC[s], w = 1.5 + u * 0.1, prof = Math.max(0, 1 - Math.abs(v) / w), Is = (1 - u / Lb) * Math.pow(prof, 0.8) * (0.85 + 0.15 * Math.sin(u * 0.6 - t * 29 * TP)) * SW_[s];   // denyut kecil mengalir sepanjang sinar
        if (Is > I) I = Is;
      }
      if (I > PX.bayer(x, y) * 0.9) put(x, y, Math.min(5, Math.floor(I * 6)));
    }
    const front = [], PXX = -sa, PYY = ca;                                           // medan dipol 3D: tiap garis punya azimut φ mengelilingi sumbu; titik belakang digambar sebelum bola (tertutup), titik depan sesudahnya
    [20, 29, 40].forEach((s0, si) => {                                               // r = s·cos²λ; posisi = al·sumbu + pe·(cosφ·p + sinφ·q); z>0 = menghadap kamera
      const s = s0 * (1 + 0.05 * Math.sin(t * 6 * TP + si)), dir = si % 2 ? -1 : 1, NA = 5;
      for (let a = 0; a < NA; a++) {
        const phi = (a / NA) * 6.2832 + si * 0.6 + t * TP * dir, cp = Math.cos(phi), sp = Math.sin(phi);   // azimut berputar pelan: garis tampak memutari bola
        for (let k = -90; k <= 90; k += 0.5) {                                       // langkah 0.5° agar garis menyambung
          const lam = (k * Math.PI) / 180, r = s * Math.cos(lam) ** 2; if (r < R + 0.6) continue;
          const al = r * Math.sin(lam), pe = r * Math.cos(lam), m = (((k + 90 + dir * t * (440 / LOOP)) % 40) + 40) % 40;   // m: posisi dalam siklus dash (40° per siklus)
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
      const sp = Math.min(1, TEX[ty * TW + tx] + CON[ty * TW + tx]), pn = PX.hash(tx, ty, 123);   // fl: bintik tetap di tekstur; sp: bercak; pn: butiran halus -> semuanya ikut berputar
      const cap = PX.clamp((Math.abs(ay) - 0.84) / 0.12, 0, 1);                                            // tutup putih di kutub sumbu putar (seperti bola PSR di game)
      let k = (0.42 + 0.58 * nz) * (1 - 0.45 * sp * sp * sp) + 0.8 * cap * cap * (3 - 2 * cap);                      // terang = menghadap kamera (emisif), bercak menggelapkan; tanpa arah cahaya
      if (r2 > 0.9) k = Math.min(k, 0.22);                                                                // cincin tepi gelap tipis -> siluet terbaca
      let ci = PX.clamp(Math.floor(k * 5 + PX.bayer(tx, ty) - 0.5), 0, 5);                                // 6 warna, dither di koordinat TEKSTUR -> ikut berputar
      if (r2 < 0.72 && nz > 0.5) { if (pn < 0.06) ci = Math.max(0, ci - 1); else if (pn > 0.97) ci = Math.min(5, ci + 1); }   // butiran halus
      put(X, Y, ci);
    }
    for (const f of front) put(f[0], f[1], f[2]);                                    // garis medan sisi depan menimpa bola
    for (let m = em - 2; m <= em; m++) for (const sg of [-1, 1]) for (let i = 0; i < 9; i++) {   // percikan dari ujung sinar: lintasan tertutup (redaman eksponensial), acak dari hash(kejadian mod 16) -> periodik
      const age = t - evT(m), sd = ((m % 16) + 16) % 16 * 2 + (sg < 0 ? 0 : 1), life = 0.35 + PX.hash(i, sd, 73) * 0.5, left = life - age; if (age < 0 || left <= 0) continue;
      const thm = BASE + SWING * evSign(m), g = thm + (sg < 0 ? Math.PI : 0) + (PX.hash(i, sd, 71) - 0.5) * 0.5, v = 20 + PX.hash(i, sd, 72) * 55, dd = (1 - Math.exp(-1.5 * age)) / 1.5;
      put(CX + Math.cos(thm) * sg * R + Math.cos(g) * v * dd, CY + Math.sin(thm) * sg * R + Math.sin(g) * v * dd, left > 0.48 ? 5 : left > 0.24 ? 3 : 2);
    }
    lit.glow(CX, CY, R + 5, V[4], 0.07);                                              // glow putih di sekitar bola
    lit.glow(CX, CY, 34 + 4 * pulse, V[1], 0.22 + 0.08 * pulse);   // cahaya: halo bintang + titik terang sepanjang sinar (lebih terang saat menyapu cepat)
    for (const sg of [-1, 1]) { lit.glow(CX + ca * sg * Lb * 0.35, CY + sa * sg * Lb * 0.35, 16, V[3], 0.14 + 0.16 * speed); lit.glow(CX + ca * sg * Lb * 0.75, CY + sa * sg * Lb * 0.75, 10, V[2], 0.1 + 0.12 * speed); }
    c.putImageData(img, 0, 0); lit.flush(c);
  };
  PX.loop(host, (dt, t) => draw(t));
  PX.gifButton(host, cv, draw, { loop: LOOP, scale: 4, name: 'pulsar' });   // unduh GIF: 6 detik @50 fps, frame ke-300 = frame 0 (loop mulus)
};
```



**Kode: `src/code/18-gif.js`**

```js
// 18-gif.js — PX.gif: encoder GIF89a (palet global 256 warna, LZW) + PX.gifButton: tombol "Unduh GIF" untuk demo yang periodik.
// Loop mulus = demo digambar sebagai fungsi waktu murni draw(t) yang periodik dengan periode `loop` detik; frame ke-N (t = N/fps) berikutnya identik dengan frame 0.
PX.gif = (frames, w, h, delayCs, scale = 1) => {                                  // frames: [Uint8ClampedArray RGBA w*h*4] sudah dikomposit (alpha 255)
  const B = 6, SH = 8 - B, KN = 1 << (3 * B), key = (r, g, b) => ((r >> SH) << (2 * B)) | ((g >> SH) << B) | (b >> SH);
  const cnt = new Int32Array(KN), sr = new Float64Array(KN), sg = new Float64Array(KN), sb = new Float64Array(KN);
  for (const f of frames) for (let i = 0; i < f.length; i += 4) { const k = key(f[i], f[i + 1], f[i + 2]); cnt[k]++; sr[k] += f[i]; sg[k] += f[i + 1]; sb[k] += f[i + 2]; }
  const ks = []; for (let k = 0; k < KN; k++) if (cnt[k]) ks.push(k);
  ks.sort((a, b) => cnt[b] - cnt[a]);
  const pal = ks.slice(0, 256).map((k) => [sr[k] / cnt[k], sg[k] / cnt[k], sb[k] / cnt[k]]); while (pal.length < 256) pal.push([0, 0, 0]);
  const near = new Int16Array(KN).fill(-1), nearest = (k) => {                       // palet terdekat untuk satu bucket warna (di-cache)
    if (near[k] >= 0) return near[k];
    const r = sr[k] / cnt[k], g = sg[k] / cnt[k], b = sb[k] / cnt[k]; let best = 0, bd = 1e9;
    for (let i = 0; i < 256; i++) { const d = (pal[i][0] - r) ** 2 + (pal[i][1] - g) ** 2 + (pal[i][2] - b) ** 2; if (d < bd) { bd = d; best = i; } }
    return (near[k] = best);
  };
  const W = w * scale, H = h * scale, out = [], u16 = (v) => out.push(v & 255, v >> 8);
  out.push(...[...'GIF89a'].map((c) => c.charCodeAt(0))); u16(W); u16(H); out.push(0xf7, 0, 0);
  for (const c of pal) out.push(Math.round(c[0]), Math.round(c[1]), Math.round(c[2]));
  out.push(0x21, 0xff, 0x0b, ...[...'NETSCAPE2.0'].map((c) => c.charCodeAt(0)), 3, 1, 0, 0, 0);   // loop tak hingga
  const table = new Int32Array(1 << 20), stamp = new Int32Array(1 << 20); let gen = 0;
  for (const f of frames) {
    const px = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) px[i] = nearest(key(f[i * 4], f[i * 4 + 1], f[i * 4 + 2]));
    const idx = new Uint8Array(W * H);                                              // perbesar skala bulat (nearest) agar piksel tetap tajam
    for (let y = 0; y < H; y++) { const sy = ((y / scale) | 0) * w, o = y * W; for (let x = 0; x < W; x++) idx[o + x] = px[sy + ((x / scale) | 0)]; }
    out.push(0x21, 0xf9, 4, 4); u16(delayCs); out.push(0, 0);                       // disposal 1, delay
    out.push(0x2c); u16(0); u16(0); u16(W); u16(H); out.push(0, 8);                 // image descriptor + min code size 8
    gen++; let size = 9, next = 258, cur = 0, nb = 0, blk = [];
    const put = (b) => { blk.push(b); if (blk.length === 255) { out.push(255, ...blk); blk = []; } };
    const emit = (code) => { cur |= code << nb; nb += size; while (nb >= 8) { put(cur & 255); cur >>>= 8; nb -= 8; } };
    emit(256); let prefix = idx[0];
    for (let i = 1; i < idx.length; i++) {
      const k = idx[i], kk = (prefix << 8) | k;
      if (stamp[kk] === gen) { prefix = table[kk]; continue; }
      emit(prefix);
      if (next === 4096) { emit(256); gen++; size = 9; next = 258; }
      else { if (next >= 1 << size) size++; table[kk] = next++; stamp[kk] = gen; }
      prefix = k;
    }
    emit(prefix); emit(257); if (nb > 0) put(cur & 255);
    if (blk.length) out.push(blk.length, ...blk); out.push(0);
  }
  out.push(0x3b);
  return new Blob([new Uint8Array(out)], { type: 'image/gif' });
};

// Perekam: frameFn(k) memajukan/menggambar frame ke-k pada kanvas cv; hasil dibaca, dikomposit di atas warna latar `bg`, lalu dienkode. Tombol menampilkan progres.
PX.gifRecord = async (btn, cv, frameFn, { n, fps, scale, bg, name }) => {
  if (btn.disabled) return; btn.disabled = true; const label = btn.textContent;
  try {
    const c = cv.getContext('2d', { willReadFrequently: true }), frames = [];
    for (let k = 0; k < n; k++) {
      frameFn(k);
      const d = c.getImageData(0, 0, cv.width, cv.height).data, f = new Uint8ClampedArray(d.length);
      for (let i = 0; i < d.length; i += 4) { const a = d[i + 3] / 255; f[i] = d[i] * a + bg[0] * (1 - a); f[i + 1] = d[i + 1] * a + bg[1] * (1 - a); f[i + 2] = d[i + 2] * a + bg[2] * (1 - a); f[i + 3] = 255; }
      frames.push(f);
      if (k % 10 === 9) { btn.textContent = `Merender ${Math.round(((k + 1) / n) * 100)}%`; await new Promise((r) => setTimeout(r)); }
    }
    btn.textContent = 'Menyusun GIF…'; await new Promise((r) => setTimeout(r, 20));
    const url = URL.createObjectURL(PX.gif(frames, cv.width, cv.height, Math.round(100 / fps), scale)), a = document.createElement('a');   // delay GIF satuan 1/100 s: 50 fps = 2 (batas terkecil yang dihormati browser)
    a.href = url; a.download = name + '.gif'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
  } catch (e) { console.error(e); alert('Gagal membuat GIF: ' + e.message); }
  btn.textContent = label; btn.disabled = false;
};
PX.gifBtn = (host, run) => {                                                       // tombol di bar kontrol demo (pakai bar yang sudah ada, kalau tidak buat baru)
  let bar = host.querySelector(':scope > .ctl'); if (!bar) { PX.ui(host); bar = host.querySelector(':scope > .ctl'); }
  const b = document.createElement('button'); b.type = 'button'; b.textContent = 'Unduh GIF'; b.onclick = () => run(b); bar.appendChild(b); host.dataset.gif = '1'; return b;
};
const GIF_FPS = 50;                                                                // GIF hanya punya resolusi 1/100 s -> 50 fps adalah yang tercepat yang dihormati browser (live ≈ 60 fps)

// Demo periodik (frame ke-n == frame 0): draw(t) fungsi murni, `loop` detik, GIF berputar mulus.
PX.gifButton = (host, cv, draw, o = {}) => {
  const { loop = 6, fps = GIF_FPS, scale = 4, bg = '#0a0a16', name = 'demo' } = o;
  return PX.gifBtn(host, (b) => PX.gifRecord(b, cv, (k) => draw(k / fps), { n: Math.round(loop * fps), fps, scale, bg: PX.hex(bg), name }));
};

// Demo apa saja yang memakai PX.loop (tidak harus loop mulus): merekam `sec` detik dengan langkah dt tetap 1/fps, melanjutkan dari keadaan simulasi saat ini.
PX.gifAuto = (host, { sec = 5, fps = GIF_FPS } = {}) => {
  const loops = host._loops; if (!loops || host.dataset.gif) return;
  const cv = [...host.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0]; if (!cv) return;
  const bgOf = (el) => { for (; el; el = el.parentElement) { const m = getComputedStyle(el).backgroundColor.match(/[\d.]+/g); if (m && (m.length < 4 || +m[3] > 0)) return m.slice(0, 3).map(Number); } return [255, 255, 255]; };
  const scale = PX.clamp(Math.round(560 / cv.width), 1, 4), name = host.dataset.demo || 'demo';
  PX.gifBtn(host, async (b) => {
    loops.forEach((l) => (l.rec = true));
    try { await PX.gifRecord(b, cv, () => loops.forEach((l) => l.step(1 / fps)), { n: Math.round(sec * fps), fps, scale, bg: bgOf(cv), name }); }
    finally { loops.forEach((l) => (l.rec = false)); }
  });
};
```

