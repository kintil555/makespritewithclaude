# Physics untuk karakter prosedural — jubah dan topi sihir

> Rantai Verlet untuk jubah dan pegas-ke-pose untuk pucuk topi; physics hanya menghasilkan titik, bentuknya tetap digambar per-piksel sebagai kapsul meruncing.

Kategori: Karakter Prosedural · URL: https://makespritewithclaude.pages.dev/articles/character-physics.html

## Prinsip: physics menghasilkan titik, bukan piksel
Karakter dari [artikel sebelumnya](https://makespritewithclaude.pages.dev/md/procedural-character.md) digambar dengan *query per-piksel*. Physics tidak mengubah itu. Pisahkan dua tahap:

1. **Simulasi**: bagian lemas (jubah, pucuk topi, jenggot, rambut, syal) diwakili **rantai titik** `(x, y)`. Fisika hanya menggeser titik-titik ini.
2. **Render**: tiap piksel menanyakan "seberapa dekat aku ke rantai ini?" memakai **kapsul meruncing** (radius berubah di sepanjang rantai). Bentuk, shading, dan outline tetap lewat indeks palet seperti biasa.

Hasilnya tetap pixel art bersih (tanpa anti-alias), tapi gerakannya hidup. AI cukup menulis dua blok kecil: `step()` dan `draw()`.

## Jubah: rantai Verlet
Jubah = 9 titik, titik 0 **terkunci** di belakang leher (jangkar yang ikut karakter). Tiap langkah untuk titik `i ≥ 1`:

- **Inersia (Verlet)**: `v = (x − xPrev) · 0.985`; simpan `xPrev = x`; `x += v`. Tidak perlu menyimpan kecepatan, dan stabil.
- **Gravitasi** ke bawah ≈ 260 px/s².
- **Angin** ke samping, makin kuat ke ujung: `angin · 260 · (0.3 + 0.7·k)`, `k = i/(N−1)`. Angin = dua sinus berbeda frekuensi dikalikan agar terasa berhembus, bukan konstan. Hembusan sesaat = pulsa yang meluruh `gust *= exp(−dt·1.2)`.
- **Pegas lembut ke posisi istirahat** "menjuntai di belakang": `target = jangkar + (−arah·jarak·i·0.85, jarak·i·0.5)`, kekakuan kecil (≈10). Tanpa ini rantai jatuh lurus ke bawah dan tersembunyi di balik badan.
- **Batasan jarak**: ulangi 5 kali, untuk tiap pasangan titik koreksi selisih panjang dari `SL` (titik 0 tidak bergerak, sisanya dibagi dua). Iterasi lebih banyak = kain lebih kaku.
- **Lantai**: `y ≤ lantai − 1`, lalu samakan `yPrev = y` agar ujung jubah menyeret di tanah, bukan memantul.

Karena jangkar ikut bergerak, jubah **tertinggal otomatis** saat karakter berjalan dan **menyapu balik** saat berhenti. Itu semua efek inersia, tanpa kode animasi khusus.

## Pucuk topi: pegas ke pose, bukan rantai bebas
Rantai bebas yang hanya bergantung pada gravitasi akan layu. Pucuk topi harus **kembali tegak lalu memantul**. Caranya:

- Hitung **pose istirahat** tiap frame dari jangkar topi: titik demi titik, sudut bertambah (`a += 0.22`) sehingga pucuk melengkung ke belakang seperti topi penyihir klasik.
- Tiap titik `i ≥ 1` ditarik ke target pose-nya: `percepatan = (target − x)·ks + gravitasi`, dengan `ks ≈ 55–295`.
- **Redaman kecil** (`0.965` per langkah 60 Hz) = *underdamped*, jadi pucuk berayun beberapa kali sebelum diam. Ini yang membuatnya "mantul". Redaman besar (`0.9`) terasa seperti di dalam madu.
- Lalu batasan jarak 3 iterasi menjaga panjang tiap ruas.
- Satu slider cukup untuk karakter: "lemas" = `ks` turun dan gravitasi naik.

Karena target bergantung pada jangkar, kepala yang menyentak atau berhenti mendadak langsung memberi pucuk **dorongan awal**; pegas yang mengurus sisanya.

## Render: kapsul meruncing berantai
Untuk tiap ruas rantai `A→B` dengan radius `rA→rB`:

```js
t = clamp(dot(p−A, B−A) / |B−A|², 0, 1);      // titik terdekat di ruas
e = |p − (A + (B−A)·t)| / (rA + (rB−rA)·t);   // jarak dibagi radius lokal; e ≤ 1 = di dalam
```

Ambil `e` terkecil dari semua ruas. Dari satu kueri itu didapat semua shading:

- `e > 0.78` → warna tepi (shade), memberi volume.
- `cs = i + t` (posisi di sepanjang rantai) → **list emas** di jubah (`cs` pada rentang sempit di dekat ujung) dan **band** di topi.
- `cl` = `e` dengan **tanda sisi** (`sign(cross)`) → sorot cahaya: `cl < −0.3` = sisi terang (di jubah hanya `cs < 5`, bagian atas).
- **Cukup 3 tone per material** (dasar, gelap, terang). Jangan menambah garis lipatan, noise, atau dither: pada sprite sekecil ini semuanya terbaca sebagai kotor.

Radius jubah `2 → 7.5` (melebar ke ujung), radius topi `7 → 0.6` (runcing). Bentuk kain lahir dari kurva radius itu, bukan dari gambar.

**Urutan lapisan** (belakang ke depan): bayangan kontak → **jubah** → baju → sepatu → lengan → kepala → wajah → jenggot → **kerucut topi** → brim. Kerucut topi dipotong di garis brim (`y ≤ jangkarTopi.y + 1`) agar alasnya yang bulat tidak menutupi wajah; brim digambar terakhir sebagai elips pipih.

## Gaya sprite game: besar, bersih, tegas
Hasil awal terlalu "ramai" (piksel rapat, garis lipatan, bintang). Gaya game yang bagus justru **lebih sedikit detail**:

- **Resolusi rendah**: kanvas 80×52 (≈8 px layar per piksel); sprite ±35 piksel tinggi. Simulasi dan bentuk tetap di koordinat desain 112×72; tiap piksel kanvas mengambil sampel di `((x+.5)/S, (y+.5)/S)` dengan `S = 80/112`. Mengganti `S` = mengganti kerapatan piksel tanpa menyentuh physics.
- **Bentuk besar dan terbaca**: kepala, topi, badan = massa jelas; fitur wajah cukup 1 piksel (satu mata profil). Fitur lebih kecil dari 1 piksel kanvas akan hilang/berkedip saat sampling, jadi buat selebar ≥ 1.4 satuan desain (`1/S`).
- **Outline 1 piksel gelap berwarna** (`#120d24`, bukan hitam murni) dari siluet.
- **Bayangan jatuh**: piksel kosong yang tepat di kanan-bawah piksel sprite/outline diwarnai hitam 30% (`rgba(0,0,0,.31)`). Ini memberi kedalaman murah dan membuat siluet menonjol di latar abu-abu.
- **Latar polos**, tanpa bintang atau tanah bertekstur; cukup bayangan kontak elips di kaki.

## Menggerakkan karakternya
- **Jalan ke target** dengan pegas teredam kritis: `v += ((target − x)·6 − v·3.2)·dt`. Berhenti halus, tanpa overshoot, kecepatan dibatasi.
- **Arah** hanya berubah jika `|v| > 4` agar tidak menggeletar saat diam. Semua fitur wajah memakai koordinat `fx = (x − x0)·arah`, jadi menghadap kiri = cukup balik tanda.
- **Condong ke arah gerak**: `lean = clamp(v·0.045)`, bagian atas badan, jangkar jubah, dan jangkar topi bergeser; kaki tetap. Itulah yang memberi "dorongan" ke physics.
- **Bob + ayun**: `phase += |v|·dt·π/8` (satu siklus per 16 px, kaki tidak meluncur). Sepatu terangkat `max(0, sin(phase))`, lengan mengayun, jenggot tertinggal sebanding `v`.

## Aturan agar tidak meledak
- **Langkah tetap 1/60 s** dengan akumulator (`while (acc ≥ h) step()`). `dt` variabel membuat Verlet tidak stabil dan hasil GIF tidak sama antar komputer.
- **Jangkar selalu dikunci** (`titik[0] = jangkar`) sebelum batasan jarak dihitung.
- **Jangan menaruh physics di dalam loop piksel.** Simulasi satu kali per langkah; `draw()` hanya membaca array.
- **Clamp** kecepatan karakter dan semua posisi (lantai); tanpa clamp, satu hembusan bisa membawa titik ke tak hingga.
- **Float32Array** untuk titik; alokasi array baru per frame hanya untuk buffer indeks piksel.
- Tambah bagian lemas lain dengan resep yang sama: jenggot/rambut = rantai Verlet pendek, syal = Verlet, bulu/ekor = pegas-ke-pose.

## Prompt untuk AI
> Gambar penyihir pixel 80×52 per-piksel (query bentuk, bukan sprite manual), gaya game: 3 tone per material, outline 1 piksel, bayangan jatuh kanan-bawah, tanpa tekstur. Jubah = rantai Verlet 9 titik (jangkar di leher, gravitasi, angin, pegas lembut ke belakang, batasan jarak 5 iterasi, lantai), dirender sebagai kapsul meruncing dengan shading dari `e`, posisi rantai, dan sisi. Pucuk topi = rantai 5 titik yang ditarik pegas ke pose melengkung, redaman 0.965 agar memantul. Physics berjalan di langkah tetap 1/60 s. Karakter berjalan ke arah mouse dengan pegas teredam kritis dan condong ke arah gerak.

> **Demo interaktif "wizard"**: buka halaman web artikel ini untuk menjalankannya. Kodenya ada di bawah.

Gerakkan mouse untuk menyuruh penyihir berjalan. Geser **Angin** dan **Pucuk topi lemas**, atau tekan **Hembusan**.

## Kode

**Kode: `src/code/54-demo-wizard.js`**

```js
// Penyihir prosedural dengan physics: JUBAH = rantai Verlet (9 titik, dirender sebagai kapsul meruncing), PUCUK TOPI = rantai pegas ke pose istirahat (memantul).
// Gaya game: piksel besar (kanvas 80x52), 3 tone per material, outline gelap 1 px, bayangan jatuh abu-abu di kanan-bawah. Tanpa tekstur, tanpa dither.
// Simulasi & bentuk memakai koordinat desain 112x72 (DW x DH); tiap piksel kanvas mengambil sampel di (x+.5)/S. Physics jalan di langkah tetap 1/60 s.
PX.demos.wizard = (host) => {
  const DW = 112, GY = 63, W = 80, H = 52, S = W / DW;
  const cv = PX.canvas(host, W, H, 640, false, 'Penyihir — jubah dan pucuk topi ber-physics'), c = cv.getContext('2d'), img = c.createImageData(W, H), p = PX.pointer(cv), ui = PX.ui(host);
  cv.style.background = '#3a3a3a';
  let wind = 0.35, floppy = 0.5, gust = 0;
  ui.range('Angin', 0, 1, 0.01, wind, (v) => (wind = v));
  ui.range('Pucuk topi lemas', 0, 1, 0.01, floppy, (v) => (floppy = v));
  ui.button('Hembusan', () => (gust = 1));
  const HEX = ['#00000000', '#120d24', '#6a3fb5', '#4a2a85', '#8f68e0', '#ffd166', '#3a56c8', '#26398f', '#6f8cf5', '#ffd0b8', '#e0a58a', '#eef1ff', '#aab4e0', '#2b3a8a', '#1c2566', '#4b5cc0', '#ffd166', '#1c1530'];
  const PAL = [...HEX.map((h) => (h.length > 7 ? [0, 0, 0, 0] : [...PX.hex(h), 255])), [0, 0, 0, 80]];   // indeks terakhir = bayangan (setengah transparan)
  const [E, OL, CAPE, CAPES, CAPEL, TRIM, ROBE, ROBES, ROBEL, SKIN, SKINS, BEARD, BEARDS, HAT, HATS, HATL, BAND, EYE, SH] = PAL.map((_, i) => i);
  const NC = 9, SL = 3.7, NH = 5, HL = 4.4, h = 1 / 60;                                            // NC titik jubah (jarak SL), NH titik topi (jarak HL)
  const CR = Array.from({ length: NC }, (_, i) => 2 + 5.5 * Math.pow(i / (NC - 1), 1.15));          // radius jubah: sempit di leher, melebar di ujung
  const HR = Array.from({ length: NH }, (_, i) => 0.6 + 6.4 * (1 - i / (NH - 1)));                  // radius topi: lebar di dasar, runcing di pucuk
  const cx = new Float32Array(NC), cy = new Float32Array(NC), cpx = new Float32Array(NC), cpy = new Float32Array(NC);   // jubah: posisi & posisi sebelumnya (Verlet)
  const hx = new Float32Array(NH), hy = new Float32Array(NH), hpx = new Float32Array(NH), hpy = new Float32Array(NH), tx_ = new Float32Array(NH), ty_ = new Float32Array(NH);
  let ox = DW / 2, vx = 0, dir = 1, phase = 0, bob = 0, lean = 0, acc = 0, ts = 0, inited = false, mv = 0;
  let CA, HA;                                                                                      // jangkar: belakang leher (jubah) & atas kepala (topi)
  const hdY = () => GY - 35 - bob;                                                                  // pusat kepala

  const pose = () => {                                                                              // pose istirahat pucuk topi: melengkung ke belakang makin ke ujung
    let x = HA[0], y = HA[1], a = 0.12; tx_[0] = x; ty_[0] = y;
    for (let i = 1; i < NH; i++) { a += 0.22; x += -dir * Math.sin(a) * HL; y -= Math.cos(a) * HL; tx_[i] = x; ty_[i] = y; }
  };
  const solve = (X, Y, n, len, iters) => {                                                          // batasan jarak: titik 0 terkunci pada jangkar
    for (let k = 0; k < iters; k++) for (let i = 1; i < n; i++) {
      const dx = X[i] - X[i - 1], dy = Y[i] - Y[i - 1], d = Math.hypot(dx, dy) || 1e-6, f = (d - len) / d, w0 = i === 1 ? 0 : 0.5, w1 = i === 1 ? 1 : 0.5;
      X[i - 1] += dx * f * w0; Y[i - 1] += dy * f * w0; X[i] -= dx * f * w1; Y[i] -= dy * f * w1;
    }
  };
  const step = () => {
    ts += h; const t = ts;
    const tgt = p.in ? PX.clamp(p.x / S, 14, DW - 14) : DW / 2 + Math.sin(t * 0.55) * 34;           // target jalan: mouse, atau patroli otomatis
    vx = PX.clamp(vx + ((tgt - ox) * 6 - vx * 3.2) * h, -46, 46); ox += vx * h;                      // pegas teredam kritis -> berhenti halus
    if (Math.abs(vx) > 4) dir = vx > 0 ? 1 : -1;
    mv = Math.min(1, Math.abs(vx) / 20); phase += Math.abs(vx) * h * Math.PI / 8;
    bob = Math.abs(Math.sin(phase)) * 1.3 * mv + 0.5 * Math.sin(t * 2.2) * (1 - mv); lean = PX.clamp(vx * 0.045, -2.2, 2.2);
    CA = [ox - dir * 3.2 + lean * 0.9, GY - 28 - bob]; HA = [ox + dir * 0.8 + lean, hdY() - 3.2];
    pose(); gust *= Math.exp(-h * 1.2);
    const windF = wind * (0.55 + 0.45 * Math.sin(t * 1.7) * Math.sin(t * 0.43 + 1)) + gust * 1.2;     // hembusan: 2 sinus berbeda frekuensi
    if (!inited) { inited = true; for (let i = 0; i < NC; i++) { cx[i] = cpx[i] = CA[0]; cy[i] = cpy[i] = CA[1] + i * SL; } for (let i = 0; i < NH; i++) { hx[i] = hpx[i] = tx_[i]; hy[i] = hpy[i] = ty_[i]; } }
    cx[0] = CA[0]; cy[0] = CA[1];
    for (let i = 1; i < NC; i++) {                                                                  // Verlet jubah: inersia + gravitasi + angin + pegas lembut ke "menjuntai di belakang"
      const k = i / (NC - 1), vxx = (cx[i] - cpx[i]) * 0.985, vyy = (cy[i] - cpy[i]) * 0.985; cpx[i] = cx[i]; cpy[i] = cy[i];
      const rx = CA[0] - dir * SL * i * 0.85, ry = CA[1] + SL * i * 0.5;
      cx[i] += vxx + (windF * 260 * (0.3 + 0.7 * k) + (rx - cx[i]) * 10) * h * h;
      cy[i] += vyy + (260 + (ry - cy[i]) * 10) * h * h;
    }
    solve(cx, cy, NC, SL, 5);
    for (let i = 1; i < NC; i++) if (cy[i] > GY - 1) { cy[i] = GY - 1; cpy[i] = cy[i]; }            // lantai
    hx[0] = HA[0]; hy[0] = HA[1];
    const ks = 55 + 240 * (1 - floppy), gr = 60 + 360 * floppy;                                       // kaku pegas & gravitasi pucuk
    for (let i = 1; i < NH; i++) {                                                                  // pucuk topi: pegas ke pose istirahat, redaman kecil -> memantul
      const vxx = (hx[i] - hpx[i]) * 0.965, vyy = (hy[i] - hpy[i]) * 0.965; hpx[i] = hx[i]; hpy[i] = hy[i];
      hx[i] += vxx + ((tx_[i] - hx[i]) * ks + windF * 40) * h * h;
      hy[i] += vyy + ((ty_[i] - hy[i]) * ks + gr) * h * h;
    }
    solve(hx, hy, NH, HL, 3);
  };

  let cs = 0, cl = 0;                                                                               // hasil kueri rantai: posisi sepanjang rantai (indeks+t), sisi bertanda
  const chain = (x, y, X, Y, R, n) => {                                                             // kapsul meruncing berantai: jarak ke tulang punggung / radius lokal
    let best = 9;
    for (let i = 0; i < n - 1; i++) {
      const dx = X[i + 1] - X[i], dy = Y[i + 1] - Y[i], tt = PX.clamp(((x - X[i]) * dx + (y - Y[i]) * dy) / (dx * dx + dy * dy), 0, 1);
      const qx = x - X[i] - dx * tt, qy = y - Y[i] - dy * tt, e = Math.hypot(qx, qy) / (R[i] + (R[i + 1] - R[i]) * tt);
      if (e < best) { best = e; cs = i + tt; cl = (qx * dy - qy * dx > 0 ? 1 : -1) * e; }
    }
    return best;
  };
  const seg = (x, y, ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay, t = PX.clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy), 0, 1); return Math.hypot(x - ax - dx * t, y - ay - dy * t); };

  const draw = (t) => {
    const idx = new Uint8Array(W * H), hcY = hdY(), hcX = ox + lean + dir * 0.6, nkY = GY - 29 - bob, blink = (t % 3.2) < 0.12;
    const sh = [ox + lean * 0.9 + dir * 0.5, GY - 26 - bob], sw = Math.sin(phase) * mv * 3.5 + 0.4 * Math.sin(t * 2), hand = [sh[0] + dir * (1.2 + sw), sh[1] + 10.5];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const px = (x + 0.5) / S, py = (y + 0.5) / S; let v = E;                                       // koordinat desain
      if (((px - ox) / 13) ** 2 + ((py - GY - 0.5) / 2) ** 2 <= 1) v = SH;                           // bayangan kontak di tanah
      if (py <= GY + 0.5 && chain(px, py, cx, cy, CR, NC) <= 1) {                                    // jubah (paling belakang): 3 tone + 1 list emas
        const e = chain(px, py, cx, cy, CR, NC);
        v = e > 0.78 ? CAPES : cl < -0.3 && cs < 5 ? CAPEL : CAPE;
        if (cs > NC - 2.35 && cs < NC - 1.9) v = TRIM;
      }
      const dxr = px - ox - lean * (1 - (GY - py) / 30), rw = 5 + (py - nkY) * 0.26;                // baju (robe): condong ke arah gerak di atas, kaki tetap
      if (py >= nkY && py <= GY - 2 && Math.abs(dxr) <= rw) {
        v = Math.abs(dxr) / rw > 0.78 ? ROBES : dxr < -rw * 0.45 ? ROBEL : ROBE;
        if (py > GY - 17 && py < GY - 15) v = BAND;                                                 // sabuk
      }
      for (const s of [-1, 1]) {                                                                    // sepatu: kaki yang "melangkah" terangkat
        const lift = Math.max(0, Math.sin(phase + (s > 0 ? 0 : Math.PI))) * 2.2 * mv;
        if (((px - ox - s * 3.6 - dir * 0.8) / 3) ** 2 + ((py - (GY - 1 - lift)) / 1.7) ** 2 <= 1) v = HATS;
      }
      const ae = seg(px, py, sh[0], sh[1], hand[0], hand[1]) / 2;                                    // lengan dekat (ayun saat jalan)
      if (ae <= 1) v = ae > 0.6 ? ROBES : ROBEL;
      if (Math.hypot(px - hand[0], py - hand[1]) <= 1.9) v = SKIN;
      const hd = Math.hypot(px - hcX, py - hcY), fx = (px - hcX) * dir;                              // kepala
      if (hd <= 6.2 || (fx >= 5.4 && fx < 7.4 && py >= hcY + 1.2 && py < hcY + 3.8)) v = hd > 5 ? SKINS : SKIN;
      if (!blink && py >= hcY + 0.7 && py < hcY + 3.1 && fx >= 1.6 && fx < 3.6) v = EYE;            // satu mata besar (profil), 1 piksel, di bawah brim
      const db = py - (hcY + 3.3);                                                                 // jenggot: bergoyang tertinggal oleh kecepatan
      if (db >= 0 && db <= 10) {
        const half = 5 * Math.pow(1 - db / 11, 0.7), ex = px - (hcX + dir * 0.5 - PX.clamp(vx * 0.03, -1.5, 1.5) * (db / 10));
        if (Math.abs(ex) <= half) v = ex * dir > half - 1.6 ? BEARDS : BEARD;
      }
      if (py <= HA[1] + 1 && chain(px, py, hx, hy, HR, NH) <= 1) {                                   // kerucut topi (di atas brim saja)
        const e = chain(px, py, hx, hy, HR, NH);
        v = e > 0.72 ? HATS : cl < -0.3 ? HATL : HAT;
        if (cs > 0.25 && cs < 0.95) v = BAND;
      }
      if (((px - HA[0]) / 10.5) ** 2 + ((py - HA[1] - 1.2) / 2.5) ** 2 <= 1) v = py < HA[1] + 1.2 ? HAT : HATS;   // brim
      idx[y * W + x] = v;
    }
    const sp = (a, j) => a[j] > 0 && a[j] < SH, out = new Uint8Array(W * H);                        // sprite = indeks 1..SH-1
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {                                       // outline 1 piksel dari siluet
      const i = y * W + x; let v = idx[i];
      if (!sp(idx, i) && ((x > 0 && sp(idx, i - 1)) || (x < W - 1 && sp(idx, i + 1)) || (y > 0 && sp(idx, i - W)) || (y < H - 1 && sp(idx, i + W)))) v = OL;
      out[i] = v;
    }
    for (let y = 1; y < H; y++) for (let x = 1; x < W; x++) {                                       // bayangan jatuh: 1 piksel ke kanan-bawah dari siluet (outline termasuk)
      const i = y * W + x; if (out[i] === E && sp(out, i - W - 1)) out[i] = SH;
    }
    for (let i = 0; i < W * H; i++) img.data.set(PAL[out[i]], i * 4);
    c.putImageData(img, 0, 0);
  };

  step();                                                                                           // inisialisasi jangkar & rantai sebelum draw pertama (dt frame pertama bisa < 1/60 s)
  PX.loop(host, (dt, t) => { acc += dt; while (acc >= h) { step(); acc -= h; } draw(t); });
};
```

