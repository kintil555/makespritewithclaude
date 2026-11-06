# Texturing air piksel — tint kedalaman, permukaan, caustic, dan tile top-down

> Air terdiri dari beberapa lapis sederhana yang ditumpuk — tint 4 tingkat, garis permukaan, anyaman caustic dari sinus, serpihan mengambang, dan tile top-down 2 lapis yang di-scroll — semuanya di grid integer dengan ramp biru dan dither Bayer.

Kategori: Teknik Rendering · URL: https://makespritewithclaude.pages.dev/articles/water-texturing.html

Teknik dianalisis dari sistem gelembung Sprite Fusion (`bubbles.ts`, MIT): bagian tint, permukaan, caustic, dan serpihan. Kode di sini ditulis ulang agar bisa dipakai tanpa bergantung pada game tertentu.

> **Demo interaktif "water"**: buka halaman web artikel ini untuk menjalankannya. Kodenya ada di bawah.

Ganti tampilan, lalu matikan tiap lapisan (tint, caustic, serpihan) untuk melihat kontribusinya.

## Prinsip
Air tidak bisa dibuat dengan satu tekstur. Air terbaca dari **lapisan yang saling menimpa**, masing-masing murah dan hanya memakai ramp kecil:

1. **Tint kedalaman** — warna biru gelap di atas apa pun yang ada di belakang, makin pekat ke bawah.
2. **Garis permukaan** — 1 piksel terang, 1 piksel rim, lalu pita bayangan yang menipis.
3. **Caustic** — jaring cahaya di dasar dan benda di bawah air.
4. **Serpihan mengambang** — titik kecil yang hanyut dan berkedip.
5. **Gelembung / benda / percikan** — lihat [sistem fluida](https://makespritewithclaude.pages.dev/md/fluid-system.md).

Urutan gambar: latar → benda bawah air → tint → serpihan → gelembung belakang → permukaan → gelembung depan → percikan → caustic (buffer cahaya, paling akhir).

## Ramp air
| Peran | Warna | Dipakai untuk |
|---|---|---|
| `HI` | `#ffffff` | kilau puncak, highlight gelembung |
| `LIT` | `#c6f3ff` | garis permukaan, sisi terang |
| `RIM` | `#68bfe6` | tepi, rim permukaan |
| `SHADE` | `#2f7fb6` | sisi gelap, pita di bawah permukaan |
| `TINT` | `#0b3550` | warna overlay kedalaman |

Semakin dalam, air makin gelap, makin jenuh, dan bergeser ke biru-ungu; jangan hanya menurunkan kecerahan. Untuk jenis air lain ganti ramp (rawa: hijau zaitun, lava: lihat [texturing](https://makespritewithclaude.pages.dev/md/pixel-texturing.md), racun: hijau neon), logikanya tetap.

## 1. Tint kedalaman 4 tingkat
Alpha kontinu menghasilkan ratusan warna di atas latar bertekstur. Kuantisasi kedalaman ke 4 tingkat (`PX.tone(k, x, y, 4, 0.25)`) dengan dither hanya di batas, lalu pakai tiap tingkat sebagai alpha overlay: `[0.10, 0.18, 0.26, 0.34]`. `k = (y − atas)/(dasar − atas)`. Hasilnya pita kedalaman yang terlihat disengaja, bukan gradient.

## 2. Garis permukaan
```
sy    = round(atas + sin(0.11x + 1.6t)·A1 + sin(0.043x − 0.9t)·A2)     // 2 sinus beda frekuensi -> tidak terasa berulang
glint = sin(0.37x − 2.3t) · sin(0.13x + 1.1t) > 0.55                    // perkalian 2 sinus = kilau yang berjalan acak
piksel(x, sy)     = glint ? HI : LIT
piksel(x, sy + 1) = RIM
untuk k = 2..6: jika bayer(x, sy+k) < 0.5 − 0.07k → SHADE              // pita yang menipis ke bawah
```
`sy` selalu **integer**. Bila permukaan berasal dari simulasi ([pegas](https://makespritewithclaude.pages.dev/md/fluid-system.md)), ganti rumus sinus dengan tinggi kolom; sisanya sama. Setiap 4 kolom tambahkan `glow` kecil di bawah garis (0.09, naik ke 0.2 saat glint) agar permukaan terasa bercahaya.

## 3. Caustic: jaring dari dua medan sinus
Caustic adalah garis tempat nilai medan ≈ 0:

```
u  = 0.16x + 1.9·sin(0.12y + 0.9t)        v  = 0.19y + 1.9·sin(0.1x − 0.7t)
n1 = sin(u) + sin(v)                       // 0 di sepanjang jalur yang berkelok -> jaring
n2 = sin(0.09x + 0.07y + 1.4·sin(0.15y − 0.6t)) + sin(0.11y − 0.05x + 1.4·sin(0.13x + 0.8t))
f  = (max(0, 1 − |n1|·3) + 0.7·max(0, 1 − |n2|·3)) · k(y)
```
- `1 − |n|·3` mengubah "dekat nol" menjadi garis setebal sekitar 1/3 satuan.
- `1.9·sin(...)` adalah **warp**: tanpanya garisnya kisi lurus; dengan warp menjadi jaring organik yang bergerak.
- Dua medan berbeda arah dijumlahkan, medan kedua 0.7× agar menjadi anyaman sekunder yang lebih redup.
- `k(y)`: 1 di dasar, `0.18 + 0.32·(1 − kedalaman)` di atasnya — cahaya lebih kuat di dasar dan memudar ke permukaan.
- **Tiga tingkat via Bayer**: `f > 1.05` atau (`f > 0.8` dan `bayer < (f−0.8)/0.25`) → `LIT` ×0.3; `f > 0.45` atau (`f > 0.3` dan `bayer < (f−0.3)/0.15`) → `RIM` ×0.15; selain itu tidak ada cahaya.
- Ditambahkan **additive** ke buffer cahaya (`PX.Light.add`), bukan menimpa piksel — sehingga warna benda di bawahnya tetap terbaca ([glow](https://makespritewithclaude.pages.dev/md/glow.md)).

## 4. Serpihan mengambang
Tanpa state: posisi dihitung dari `hash(i)` dan waktu. `y = atas + (y0 + (2.5 + 1.5·sin(s))·t) mod tinggi`, `x = x0 + 6·sin(0.3t + s)`. Gambar bila `bayer(x,y) ≤ 0.55 + 0.3·sin(1.3t + s)` (berkedip tanpa alpha). Satu dari tiga warna redup `#5f8a9a #7fa3a8 #4c6f86`; puncak kedipan memakai `LIT`. Sekitar 90 titik untuk layar 160×90.

## 5. Air top-down (tile)
Untuk lantai air dilihat dari atas, pakai [tile hasil bake](https://makespritewithclaude.pages.dev/md/pixel-texturing.md) bermaterial `water`: jaring terang = batas sel Worley (`1 − edge/0.3`, dikuadratkan), plus fbm halus. Animasi tanpa menghitung ulang noise:

- Gambar **dua** salinan tile (seed berbeda) yang digeser **berlawanan arah**; offset integer per frame (`floor(t·4)`).
- Gabung dalam domain indeks: jika lapis B terang dan lapis A terang → indeks tertinggi (kilau putih); jika hanya B terang → naikkan ke tingkat terang menengah; selain itu pakai A.
- Kecepatan rendah (2–4 piksel/dtk). Gerak cepat dan non-integer menghilangkan kesan piksel.

```js
// satu piksel hasil gabungan (n = jumlah warna ramp)
let i = a;
if (b >= n - 2) i = a >= n - 2 ? n - 1 : Math.max(a, n - 3);
```

## Performa
- **Caustic** adalah bagian termahal (≈ 6 `sin` per piksel). Batasi ke kotak air, atau hitung tiap 2 frame, atau di setengah resolusi lalu `drawImage` 2×.
- Tint dan permukaan hanya melintasi kolom area air; tile top-down hanya indeks dan tidak memanggil fungsi matematika.
- Latar (langit dan dinding/dasar) di-bake sekali ke dua buffer; tiap frame hanya memilih salah satu per kolom menurut tinggi permukaan (`compose`).

## Checklist untuk AI
1. Ramp air 4–5 warna dari putih ke biru gelap, hue bergeser; tidak ada `rgba()` kontinu.
2. Tint kedalaman dikuantisasi 4 tingkat dengan dither di batas.
3. Permukaan: 1px terang, 1px rim, pita bayangan Bayer; posisi `sy` integer.
4. Caustic = nol-persilangan dua medan sinus ber-warp, additive di buffer cahaya, kuat di dasar.
5. Animasi top-down = dua tile digeser berlawanan, offset integer.
6. Semua pola Bayer memakai koordinat layar agar stabil saat kamera diam.
7. Periksa visual diperbesar; matikan lapisan satu per satu untuk memastikan tiap lapis berguna.

## Kode

**Kode: `src/code/16-water.js`**

```js
// 16-water.js — texturing air: tint kedalaman 4 tingkat, garis permukaan, caustic (anyaman sinus), serpihan mengambang, dan tile top-down yang di-scroll 2 lapis.
PX.WATER = { HI: PX.hex('#ffffff'), LIT: PX.hex('#c6f3ff'), RIM: PX.hex('#68bfe6'), SHADE: PX.hex('#2f7fb6'), TINT: PX.hex('#0b3550'), SPECK: ['#5f8a9a', '#7fa3a8', '#4c6f86'].map(PX.hex) };
PX.Light.prototype.add = function (x, y, c, k) {            // tambah 1 piksel cahaya (additive) tanpa profil glow
  if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
  const o = (y * this.w + x) * 3; this.d[o] += c[0] * k; this.d[o + 1] += c[1] * k; this.d[o + 2] += c[2] * k;
};
PX.MAT.water = { ramp: ['#0e3a5c', '#1a6a9a', '#3aa0cc', '#8fe0f0', '#ffffff'], f: (x, y, S, s) => {   // tile top-down: jaring terang = batas sel Worley
  const w = PX.worley(x / 8, y / 8, s, S / 8), line = Math.max(0, 1 - w[1] / 0.3);
  return 0.18 + 0.22 * PX.fbm(x / 4, y / 4, s + 4, S / 4) + 0.62 * line * line;
} };

// Latar kolam: langit senja + dinding bawah air + dasar pasir. Dua buffer; compose() memilih salah satunya per kolom menurut tinggi permukaan.
PX.poolScene = (W, H, top, floorY) => {
  const sky = new PX.Buf(W, H), under = new PX.Buf(W, H);
  const SKY = ['#1b1030', '#3a2250', '#74386a', '#c0566a', '#f08a5a'].map(PX.hex), WALL = ['#0a2236', '#123650', '#1b4a6a'].map(PX.hex), SAND = ['#3a2f3a', '#6a5648', '#a08462', '#d2b383'].map(PX.hex);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    sky.px(x, y, SKY[PX.tone(y / (top + 4) + (PX.fbm(x / 30, y / 8, 3, 0, 0, 2) - 0.5) * 0.25, x, y, 5, 0.25)]);
    const fl = floorY(x);
    if (y >= fl) under.px(x, y, SAND[PX.tone(0.25 + 0.45 * PX.fbm(x / 6, y / 3, 7, 0, 0, 3) + (y === Math.round(fl) ? 0.25 : 0), x, y, 4, 0.25)]);
    else under.px(x, y, WALL[PX.tone(0.2 + 0.5 * PX.fbm(x / 18, y / 10, 4, 0, 0, 3), x, y, 3, 0.25)]);
  }
  return { sky, under };
};

PX.Water = class {
  constructor(x0, x1, top, bottom, seed = 1) {
    Object.assign(this, { x0, x1, top, bottom, pal: PX.WATER });
    this.specks = Array.from({ length: 90 }, (_, i) => ({ x: x0 + PX.hash(i, 1, seed) * (x1 - x0), y: PX.hash(i, 2, seed) * (bottom - top), s: PX.hash(i, 3, seed) * 100, c: i % 3 }));
  }
  surf(x, t) { return this.top + Math.sin(x * 0.11 + t * 1.6) * 0.6 + Math.sin(x * 0.043 - t * 0.9) * 0.8; }   // permukaan default: 2 sinus beda frekuensi
  compose(buf, sky, under, surfY) {                                                                        // atas permukaan = langit, bawah = isi kolam
    for (let x = 0; x < buf.w; x++) { const s = Math.round(surfY(x)); for (let y = 0; y < buf.h; y++) buf.d[y * buf.w + x] = y < s ? sky.d[y * buf.w + x] : under.d[y * buf.w + x]; }
  }
  tint(buf, surfY) {                                                    // lapisan warna air: 4 tingkat kedalaman, batasnya didither (bukan alpha kontinu)
    const A = [0.1, 0.18, 0.26, 0.34], span = Math.max(1, this.bottom - this.top);
    for (let x = this.x0; x < this.x1; x++) for (let y = Math.max(0, Math.ceil(surfY(x))); y < this.bottom + 4; y++) buf.px(x, y, this.pal.TINT, A[PX.tone((y - this.top) / span, x, y, 4, 0.25)]);
  }
  surface(buf, lit, t, surfY) {                                         // garis permukaan: terang 1px, rim 1px, lalu pita bayangan yang menipis (Bayer)
    const P = this.pal;
    for (let x = this.x0; x < this.x1; x++) {
      const sy = Math.round(surfY(x)), glint = Math.sin(x * 0.37 - t * 2.3) * Math.sin(x * 0.13 + t * 1.1) > 0.55;
      buf.px(x, sy, glint ? P.HI : P.LIT); buf.px(x, sy + 1, P.RIM);
      for (let k = 2; k < 7; k++) if (PX.bayer(x, sy + k) < 0.5 - k * 0.07) buf.px(x, sy + k, P.SHADE);
      if ((x & 3) === 0) lit.glow(x, sy + 2, 7, P.LIT, glint ? 0.2 : 0.09);
    }
  }
  caustics(lit, t) {                                                    // anyaman cahaya: garis tempat sin(u)+sin(v) ≈ 0, dua medan ber-warp, 3 tingkat via Bayer, memudar ke atas kecuali di dasar
    const P = this.pal, gy = this.bottom, top = this.top;
    for (let y = top; y <= gy + 6; y++) {
      const k = y >= gy - 1 ? 1 : 0.18 + 0.32 * (1 - (y - top) / Math.max(1, gy - top));
      for (let x = this.x0; x < this.x1; x++) {
        const u = x * 0.16 + 1.9 * Math.sin(y * 0.12 + t * 0.9), v = y * 0.19 + 1.9 * Math.sin(x * 0.1 - t * 0.7);
        const n1 = Math.sin(u) + Math.sin(v), n2 = Math.sin(x * 0.09 + y * 0.07 + 1.4 * Math.sin(y * 0.15 - t * 0.6)) + Math.sin(y * 0.11 - x * 0.05 + 1.4 * Math.sin(x * 0.13 + t * 0.8));
        const f = (Math.max(0, 1 - Math.abs(n1) * 3) + 0.7 * Math.max(0, 1 - Math.abs(n2) * 3)) * k, d = PX.bayer(x, y);
        if (f > 1.05 || (f > 0.8 && d < (f - 0.8) / 0.25)) lit.add(x, y, P.LIT, 0.3);
        else if (f > 0.45 || (f > 0.3 && d < (f - 0.3) / 0.15)) lit.add(x, y, P.RIM, 0.15);
      }
    }
  }
  snow(buf, t) {                                                        // serpihan mengambang (marine snow): hanyut pelan, berkedip lewat ambang Bayer
    const h = this.bottom - this.top;
    for (const s of this.specks) {
      const x = Math.floor(s.x + 6 * Math.sin(t * 0.3 + s.s)), y = Math.floor(this.top + ((s.y + (2.5 + 1.5 * Math.sin(s.s)) * t) % h)), tw = Math.sin(t * 1.3 + s.s);
      if (PX.bayer(x, y) > 0.55 + 0.3 * tw) continue;
      buf.px(x, y, tw > 0.85 ? this.pal.LIT : this.pal.SPECK[s.c]);
    }
  }
};

// Air top-down: 2 tile yang sama (seed beda) digeser berlawanan, offset INTEGER per frame; piksel terang yang tumpang tindih jadi kilau putih.
PX.waterTile = (buf, A, B, t) => {
  const S = A.S, n = A.pal.length, ax = Math.floor(t * 4), ay = Math.floor(t * 2), bx = Math.floor(t * 3), by = Math.floor(t * 3);
  for (let y = 0; y < buf.h; y++) for (let x = 0; x < buf.w; x++) {
    const a = A.idx[((y + ay) % S) * S + ((x + ax) % S)], b = B.idx[(((y - by) % S + S) % S) * S + (((x - bx) % S + S) % S)];
    let i = a; if (b >= n - 2) i = a >= n - 2 ? n - 1 : Math.max(a, n - 3);
    buf.px(x, y, A.pal[i]);
  }
};
```



**Kode: `src/code/51-demo-water.js`**

```js
// Demo texturing air: penampang samping (tint + permukaan + caustic + serpihan) atau tile top-down dua lapis. Matikan tiap lapisan untuk melihat kontribusinya.
PX.demos.water = (host) => {
  const W = 160, H = 90, TOP = 24, FLOOR = 78, cv = PX.canvas(host, W, H, 800), c = cv.getContext('2d'), buf = new PX.Buf(W, H), lit = new PX.Light(W, H);
  const wat = new PX.Water(0, W, TOP, FLOOR), sc = PX.poolScene(W, H, TOP, () => FLOOR), A = PX.bakeTex('water', 32, { emb: 0, seed: 2 }), B = PX.bakeTex('water', 32, { emb: 0, seed: 9 });
  let mode = 'side', tint = true, caus = true, snow = true, t = 0;
  const ui = PX.ui(host);
  ui.select('Tampilan', [{ label: 'penampang samping', value: 'side' }, { label: 'tile top-down (2 lapis scroll)', value: 'top' }], mode, (v) => (mode = v));
  ui.check('Tint kedalaman', true, (v) => (tint = v)); ui.check('Caustic', true, (v) => (caus = v)); ui.check('Serpihan', true, (v) => (snow = v));
  PX.loop(host, (dt) => {
    t += dt;
    if (mode === 'top') { PX.waterTile(buf, A, B, t); buf.flush(c); return; }
    const sy = (x) => wat.surf(x, t);
    lit.clear(); wat.compose(buf, sc.sky, sc.under, sy);
    if (tint) wat.tint(buf, sy);
    if (snow) wat.snow(buf, t);
    wat.surface(buf, lit, t, sy);
    if (caus) wat.caustics(lit, t);
    buf.flush(c); lit.flush(c);
  });
};
```

