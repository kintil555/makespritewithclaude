# Karakter prosedural dari persamaan

> Setiap piksel menanyakan koordinat lokal badan; bentuk berasal dari persamaan elips/kapsul, wajah dari bitmap string, outline dari siluet.

Kategori: Karakter Prosedural · URL: https://makespritewithclaude.pages.dev/articles/procedural-character.html

## Pendekatan "per-piksel query"
Alih-alih menaruh piksel satu per satu, untuk tiap piksel layar:

1. Ubah ke **koordinat lokal** `(f, u)` = (maju, atas) dengan rotasi miring terhadap titik kaki. Rotasi memakai pemetaan **terbalik**, jadi tidak ada lubang.
2. Uji bentuk dengan persamaan: kapsul (jarak titik ke segmen ≤ r) untuk anggota badan, superellipse `|f/rf|ⁿ + |u/ru|ⁿ ≤ 1` untuk kepala/badan (`n=2` elips, `n=3` kotak membulat).
3. Urutan tulis = urutan lapisan: anggota badan **jauh** (tone gelap) → torso → anggota **dekat** → kepala.
4. Shading dari persamaan sendiri: nilai superellipse > 0.78 = tepi (shade); bagian kiri-atas = highlight.
5. Wajah: **bitmap string** (`'.##...##.'`) dipetakan terbalik ke koordinat lokal; kedip = lewati bitmap.
6. Setelah semua indeks palet terisi: kosong yang bertetangga dengan terisi → outline.

Keuntungan: ukuran dan proporsi parametrik; pose (swing, tilt, bob) cukup mengubah angka; AI mudah memodifikasinya.

> **Demo interaktif "char"**: buka halaman web artikel ini untuk menjalankannya. Kodenya ada di bawah.

Gerakkan mouse untuk memiringkan robo.

## Kode

**Kode: `src/code/46-demo-char.js`**

```js
// Karakter prosedural per-piksel (gaya rig Sprite Fusion): setiap piksel di-"query" ke koordinat lokal badan (f=maju, u=atas).
// Bentuk = persamaan (ellipse/kapsul), bitmap string untuk wajah, tone near/far untuk anggota badan, outline dari siluet.
PX.demos.char = (host) => {
  const N = 64, cv = PX.canvas(host, N, N, 384, false, 'Robo — digambar dari persamaan'), c = cv.getContext('2d'), img = c.createImageData(N, N), p = PX.pointer(cv);
  const PAL = ['#00000000', '#1c1530', '#7c8cff', '#4552c4', '#b8c2ff', '#2f3786', '#8ff3ff', '#ff8a5c', '#ffd0b8'].map((h) => (h.length > 7 ? [0, 0, 0, 0] : [...PX.hex(h), 255]));
  const [E, OL, BASE, SHADE, LIGHT, FAR, EYE, ANT, ANTL] = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  const FACE = ['.##...##.', '####.####', '####.####', '.##...##.'];                       // bitmap mata, '#'=menyala
  const cap = (f, u, a, b, r) => { const abx = b[0] - a[0], aby = b[1] - a[1], t = PX.clamp(((f - a[0]) * abx + (u - a[1]) * aby) / (abx * abx + aby * aby), 0, 1); return Math.hypot(f - a[0] - abx * t, u - a[1] - aby * t) <= r; };
  const sup = (f, u, cf, cu, rf, ru, n) => Math.pow(Math.abs((f - cf) / rf), n) + Math.pow(Math.abs((u - cu) / ru), n);   // superellipse: n=2 elips, n=3 kotak membulat
  PX.loop(host, (dt, t) => {
    const lean = p.in ? PX.clamp((p.x - N / 2) / N, -0.5, 0.5) * 0.6 : Math.sin(t * 0.7) * 0.12, ca = Math.cos(lean), sa = Math.sin(lean), sw = Math.sin(t * 6) * 4.5, blink = (t % 3) < 0.12, pulse = 0.5 + 0.5 * Math.sin(t * 5);
    const idx = new Uint8Array(N * N), OX = N / 2, OY = N - 8;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const dx = x + 0.5 - OX, dy = OY - (y + 0.5), f = dx * ca - dy * sa, u = dx * sa + dy * ca;     // koordinat lokal (miring terhadap kaki)
      let v = E;
      if (cap(f, u, [-3.5, 13], [-3.5 - sw, 2], 2.4)) v = FAR;                                      // kaki jauh
      if (cap(f, u, [-8, 28], [-8 + sw, 19], 2)) v = FAR;                                           // lengan jauh
      const tm = sup(f, u, 0, 22, 8.5, 8.5, 3);
      if (tm <= 1) v = tm > 0.62 || u < 15 ? SHADE : f < -2 && u > 24 ? LIGHT : BASE;               // torso
      if (cap(f, u, [3.5, 13], [3.5 + sw, 2], 2.4)) v = u < 5 ? SHADE : BASE;                      // kaki dekat
      if (cap(f, u, [8, 28], [8 - sw, 19], 2)) v = BASE;                                            // lengan dekat
      if (cap(f, u, [0, 44], [0, 51], 0.7)) v = SHADE;                                              // antena
      if (Math.hypot(f, u - 52.5) <= 2) v = pulse > 0.5 ? ANTL : ANT;
      const hm = sup(f, u, 0, 38, 11, 8, 3);
      if (hm <= 1) {                                                                                // kepala
        v = hm > 0.78 ? SHADE : f < -3 && u > 41 && hm < 0.55 ? LIGHT : BASE;
        if (Math.abs(f) < 8.5 && u > 34 && u < 42) v = OL;                                          // visor gelap
        const bi = Math.floor(f + 4.5), bj = Math.floor(40 - u);                                    // bitmap mata (mapping terbalik = tanpa lubang)
        if (!blink && bj >= 0 && bj < 4 && bi >= 0 && bi < 9 && FACE[bj][bi] === '#') v = EYE;
      }
      idx[y * N + x] = v;
    }
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {                                         // outline 1 piksel dari siluet
      const i = y * N + x; let v = idx[i];
      if (!v && ((x > 0 && idx[i - 1]) || (x < N - 1 && idx[i + 1]) || (y > 0 && idx[i - N]) || (y < N - 1 && idx[i + N]))) v = OL;
      const col = PAL[v]; img.data.set(v ? [...PAL[v]] : [0, 0, 0, 0], i * 4);
    }
    c.putImageData(img, 0, 0);
  });
};
```

