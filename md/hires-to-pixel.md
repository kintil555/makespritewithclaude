# Render halus lalu turunkan ke grid piksel

> Teknik inti — gambar karakter sebagai vektor halus beresolusi tinggi, lalu ubah per sel menjadi piksel ber-shading dan ber-outline.

Kategori: Teknik Rendering · URL: https://kintil555.github.io/makespritewithclaude/articles/hires-to-pixel.html

## Masalah
Menggambar karakter bergerak langsung dari piksel (garis Bresenham, rotasi manual) menghasilkan bentuk bergerigi tidak konsisten: lengan menipis, kepala berkedip, outline pecah. AI sangat sering gagal di sini.

## Ide
Pisahkan **bentuk** dari **gaya**:

1. Gambar rig (tulang + IK) dengan `lineTo`/`arc` biasa di canvas besar (anti-alias boleh).
2. Bagi canvas menjadi sel `B×B` piksel. Satu sel = satu piksel akhir.
3. Sel menjadi piksel jika **cakupan alpha ≥ 50%**. Ini menghilangkan piksel "sisa" dari anti-alias.
4. Tiap sel diberi kelas: depan atau belakang (dibedakan lewat warna sumber, mis. kanal merah).
5. Shading dari tetangga: sel tanpa tetangga di atas = **highlight**, tanpa tetangga di bawah = **shade**.
6. Sel kosong yang bersebelahan dengan siluet = **outline** 1 piksel.

Hasilnya: gerakan mulus (IK/vektor), tampilan tetap piksel tajam. Alpha output hanya 0 atau 255, jadi tidak ada halo.

> **Demo interaktif "hires"**: buka halaman web artikel ini untuk menjalankannya. Kodenya ada di bawah.

Coba ubah `B`: `B=2` terlihat halus/detail, `B=8` kasar seperti sprite 24×24.

## Aturan
- `S / N` harus bilangan bulat (`S=192`, `N=48` → `B=4`).
- Ketebalan garis sumber ≈ `1.5–2 × B` agar anggota badan setebal 2 piksel.
- Warna depan dan belakang harus terpisah jelas pada satu kanal (di sini merah 238 vs 184).
- Jangan menggeser hasil dengan koordinat desimal; gambar ke layar dengan `drawImage` integer.

## Kode
Fungsi inti `PX.pixelize`:


**Kode: `src/code/20-pixelize.js`**

```js
// 20-pixelize.js — render halus resolusi tinggi -> grid piksel (tanpa menggambar model piksel manual)
// Langkah: (1) gambar vektor halus di canvas besar  (2) bagi jadi sel B×B  (3) sel jadi piksel bila
// cakupan alpha >= thr  (4) kelas warna depan/belakang  (5) tepi atas = highlight, tepi bawah = shade
// (6) tetangga kosong di sekitar siluet = outline 1 piksel.
PX.PAL = { F: [238, 122, 28], B: [184, 84, 26], HI: [255, 178, 90], FS: [214, 100, 14], BS: [140, 62, 18], OL: [40, 20, 10] };

PX.pixelize = (src, N, pal = PX.PAL, thr = 0.5) => {
  const S = src.width, B = S / N;                       // B harus integer
  const s = src.getContext('2d').getImageData(0, 0, S, S).data;
  const mid = (pal.F[0] + pal.B[0]) / 2;                // pembeda depan/belakang lewat kanal merah
  const cls = new Uint8Array(N * N);                    // 0 kosong, 1 depan, 2 belakang
  for (let cy = 0; cy < N; cy++) for (let cx = 0; cx < N; cx++) {
    let sa = 0, fw = 0, bw = 0;
    for (let y = 0; y < B; y++) for (let x = 0; x < B; x++) {
      const i = ((cy * B + y) * S + cx * B + x) * 4, a = s[i + 3];
      if (a) { sa += a; if (s[i] > mid) fw += a; else bw += a; }
    }
    if (sa / (B * B * 255) >= thr) cls[cy * N + cx] = fw >= bw ? 1 : 2;
  }
  const out = new ImageData(N, N), d = out.data;
  for (let cy = 0; cy < N; cy++) for (let cx = 0; cx < N; cx++) {
    const i = cy * N + cx, c = cls[i]; let col = null;
    if (c) {
      const up = cy === 0 || !cls[i - N], dn = cy === N - 1 || !cls[i + N];
      col = c === 1 ? (up ? pal.HI : dn ? pal.FS : pal.F) : (dn ? pal.BS : pal.B);
    } else if ((cx > 0 && cls[i - 1]) || (cx < N - 1 && cls[i + 1]) || (cy > 0 && cls[i - N]) || (cy < N - 1 && cls[i + N])) col = pal.OL;
    if (col) { d[i * 4] = col[0]; d[i * 4 + 1] = col[1]; d[i * 4 + 2] = col[2]; d[i * 4 + 3] = 255; }
  }
  return out;                                           // alpha hanya 0 atau 255 -> tidak ada halo
};
```


Rig stickman halus yang menjadi sumbernya (2-bone IK, `PX.ik`):


**Kode: `src/code/21-stickman.js`**

```js
// 21-stickman.js — rig stickman 2-bone IK, digambar halus (vektor). Tanah di y=168 (basis 192).
PX.ik = (a, b, l1, l2, s) => {           // titik sendi (lutut/siku) untuk 2 tulang
  const dx = b.x - a.x, dy = b.y - a.y, D = Math.hypot(dx, dy) || 1, d = Math.min(D, l1 + l2 - 0.01);
  const k = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - k * k));
  return { x: a.x + (dx / D) * k - (dy / D) * h * s, y: a.y + (dy / D) * k + (dx / D) * h * s };
};
PX.stickman = (c, t, S = 192) => {
  const P = PX.PAL, G = 168, p = t * 6, rgb = PX.rgb;
  c.clearRect(0, 0, S, S); c.save(); c.scale(S / 192, S / 192);
  c.lineCap = c.lineJoin = 'round'; c.lineWidth = 8;
  const hip = { x: 96, y: 90 - Math.abs(Math.cos(p)) * 5 }, sh = { x: hip.x + 6, y: hip.y - 48 };
  const leg = (i) => { const ph = p + i * Math.PI, f = { x: 96 + Math.sin(ph) * 28, y: G - Math.max(0, Math.cos(ph)) * 14 }; return [hip, PX.ik(hip, f, 44, 44, -1), f]; };
  const arm = (i) => { const ph = p + i * Math.PI, h = { x: sh.x - Math.sin(ph) * 22, y: sh.y + 36 }; return [sh, PX.ik(sh, h, 22, 22, 1), h]; };
  const limb = (q) => { c.beginPath(); c.moveTo(q[0].x, q[0].y); c.lineTo(q[1].x, q[1].y); c.lineTo(q[2].x, q[2].y); c.stroke(); };
  c.strokeStyle = rgb(P.B); limb(leg(1)); limb(arm(1));          // anggota belakang (warna B)
  c.strokeStyle = rgb(P.F);                                       // torso + kaki depan + kepala + lengan depan (warna F)
  c.beginPath(); c.moveTo(hip.x, hip.y); c.lineTo(sh.x, sh.y); c.stroke(); limb(leg(0));
  c.beginPath(); c.arc(sh.x + 4, sh.y - 18, 12, 0, Math.PI * 2); c.stroke(); limb(arm(0));
  c.restore();
};
```


Kode demo:


**Kode: `src/code/30-demo-hires.js`**

```js
// Demo: render halus (kiri) -> grid piksel (kanan). Ubah ukuran sel B untuk melihat efeknya.
PX.demos.hires = (host) => {
  const S = 192, hi = PX.canvas(host, S, S, 288, true, 'Render halus 192×192'), lo = PX.canvas(host, 48, 48, 288, false, 'Grid piksel');
  let N = 48;
  PX.ui(host).select('Ukuran sel B', [2, 3, 4, 6, 8], 4, (v) => { N = S / v; lo.width = lo.height = N; });
  PX.loop(host, (dt, t) => {
    PX.stickman(hi.getContext('2d'), t, S);
    lo.getContext('2d').putImageData(PX.pixelize(hi, N), 0, 0);
  });
};
```

