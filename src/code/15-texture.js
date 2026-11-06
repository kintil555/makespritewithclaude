// 15-texture.js — texturing prosedural bergaya piksel: noise yang bisa di-tile, ramp bergeser hue, dither hanya di batas klaster, lighting dari height-map. Dibake SEKALI ke indeks palet.
PX.vnoise = (x, y, seed = 0, px = 0, py = px) => {      // value noise halus 0..1; x,y dalam satuan sel lattice; px/py = periode (sel) agar tile mulus
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const wx = (i) => (px ? ((i % px) + px) % px : i), wy = (j) => (py ? ((j % py) + py) % py : j);
  const a = PX.hash(wx(x0), wy(y0), seed), b = PX.hash(wx(x0 + 1), wy(y0), seed), c = PX.hash(wx(x0), wy(y0 + 1), seed), d = PX.hash(wx(x0 + 1), wy(y0 + 1), seed);
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};
PX.fbm = (x, y, seed = 0, px = 0, py = px, oct = 3) => {   // tumpuk oktaf: frekuensi x2, amplitudo x0.5 (periode ikut x2 -> tetap tile)
  let s = 0, n = 0, a = 0.5;
  for (let o = 0; o < oct; o++, a *= 0.5, x *= 2, y *= 2, px *= 2, py *= 2) { s += a * PX.vnoise(x, y, seed + o * 17, px, py); n += a; }
  return s / n;
};
PX.worley = (x, y, seed = 0, px = 0, py = px) => {      // noise sel: [jarak titik terdekat, jarak2 - jarak1]; elemen ke-2 ≈ 0 di batas sel (retakan/mortar)
  const x0 = Math.floor(x), y0 = Math.floor(y); let d1 = 9, d2 = 9;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = x0 + i, cy = y0 + j, wx = px ? ((cx % px) + px) % px : cx, wy = py ? ((cy % py) + py) % py : cy;
    const d = Math.hypot(cx + PX.hash(wx, wy, seed) - x, cy + PX.hash(wx, wy, seed + 1) - y);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
  }
  return [d1, d2 - d1];
};

// Pilih indeks ramp dari nilai k (0..1). w = lebar pita dither: 0 = klaster keras tanpa dither, 0.25 = dither hanya di batas klaster, 1 = dither penuh.
PX.tone = (k, x, y, n, w = 0.25) => {
  const v = PX.clamp(k, 0, 0.9999) * (n - 1), i = Math.floor(v), f = v - i;
  if (w <= 0) return f >= 0.5 ? i + 1 : i;
  const t = PX.clamp((f - 0.5) / w + 0.5, 0, 1);
  return i + (t > PX.bayer(x, y) ? 1 : 0);
};

// Material = ramp (gelap -> terang, hue bergeser) + fungsi nilai f(x,y,S,seed) -> 0..1. Semua noise memakai periode bulat agar tile mulus.
PX.MAT = {
  stone: { ramp: ['#2b2a3a', '#4a4a5e', '#6e6f80', '#9a9aa6', '#cfcdd2'], f: (x, y, S, s) => {
    const w = PX.worley(x / 8, y / 8, s, S / 8), crack = w[1] < 0.09 ? 0.3 : 1;
    return (0.25 + 0.55 * PX.fbm(x / 4, y / 4, s + 5, S / 4) + 0.2 * w[0]) * crack;
  } },
  grass: { ramp: ['#1f3a2e', '#2f6b3a', '#4f9a3f', '#86c24a', '#c9e56e'], f: (x, y, S, s) =>
    0.2 + 0.55 * PX.fbm(x / 2, y / 8, s, S / 2, S / 8) + (PX.hash(x, y, s + 3) > 0.9 ? 0.25 : 0) },
  wood: { ramp: ['#2a1a22', '#5a3326', '#8a5530', '#b57d44', '#dba868'], f: (x, y, S, s) => {
    const warp = PX.fbm(x / 8, y / 4, s, S / 8, S / 4) * 5, g = Math.sin(((y + warp) * Math.PI * 2 * 4) / S);
    return 0.5 + 0.35 * g + 0.15 * (PX.hash(x, y, s + 9) - 0.5);
  } },
  brick: { ramp: ['#2d1b25', '#5c2b2e', '#8c4636', '#b86a48', '#e0a070'], f: (x, y, S, s) => {
    const bh = S / 4, bw = S / 2, row = Math.floor(y / bh), xx = (x + (row & 1) * (bw / 2)) % S;
    if (y % bh === 0 || xx % bw === 0) return 0.1;
    return 0.45 + 0.3 * PX.hash(Math.floor(xx / bw), row, s) + 0.25 * PX.fbm(x / 4, y / 4, s + 2, S / 4);
  } },
  lava: { ramp: ['#1a0e1e', '#4a1424', '#a82a1a', '#f06a1e', '#ffd24a', '#fff4c8'], f: (x, y, S, s) => {
    const w = PX.worley(x / 8, y / 8, s, S / 8), glow = Math.max(0, 1 - w[1] / 0.35);
    return 0.12 + 0.2 * PX.fbm(x / 4, y / 4, s, S / 4) + 0.75 * glow * glow;
  } },
};

// Bake: height-field -> lighting emboss (kiri-atas) -> indeks palet Uint8. Dijalankan sekali; hasilnya yang dipakai tiap frame.
PX.bakeTex = (mat, S = 32, o = {}) => {
  const m = PX.MAT[mat], n = m.ramp.length, seed = o.seed ?? 1, emb = o.emb ?? 0.5, w = o.dither === 'none' ? 0 : o.dither === 'full' ? 1 : 0.25;
  const F = new Float32Array(S * S), idx = new Uint8Array(S * S), W = (i) => (i + S) % S;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) F[y * S + x] = PX.clamp(m.f(x, y, S, seed), 0, 1);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const h = F[y * S + x], lit = (F[W(y - 1) * S + W(x - 1)] - F[W(y + 1) * S + W(x + 1)]) * emb;   // beda tetangga kiri-atas vs kanan-bawah
    idx[y * S + x] = PX.tone(h * 0.75 + 0.12 + lit, x, y, n, w);                                   // Bayer memakai koordinat lokal (S kelipatan 4 -> tetap tile)
  }
  return { S, idx, pal: m.ramp.map(PX.hex) };
};
PX.texCanvas = (t) => {                                  // indeks -> canvas kecil (1 piksel = 1 texel); gambar membesar dengan image-rendering: pixelated
  const cv = document.createElement('canvas'); cv.width = cv.height = t.S;
  const img = new ImageData(t.S, t.S);
  for (let i = 0; i < t.idx.length; i++) { const c = t.pal[t.idx[i]]; img.data[i * 4] = c[0]; img.data[i * 4 + 1] = c[1]; img.data[i * 4 + 2] = c[2]; img.data[i * 4 + 3] = 255; }
  cv.getContext('2d').putImageData(img, 0, 0);
  return cv;
};
