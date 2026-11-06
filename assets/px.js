/* 00-core.js */
// 00-core.js — helper dasar: RNG, warna, Bayer 4x4, canvas pixelated, loop, kontrol UI
const PX = (window.PX = { demos: {} });

PX.rng = (seed) => () => {            // mulberry32: deterministik per seed
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
PX.hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
PX.rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;
PX.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
PX.BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
PX.bayer = (x, y) => (PX.BAYER[((y & 3) << 2) | (x & 3)] + 0.5) / 16; // ambang 0..1 per piksel
PX.hash = (x, y, s = 0) => {          // hash integer -> 0..1 (noise blok, tanpa interpolasi)
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(s, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// Canvas resolusi rendah, ditampilkan membesar tanpa blur (image-rendering: pixelated)
PX.canvas = (host, w, h, cssW, smooth = false, caption = '') => {
  const fig = document.createElement('figure');
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  cv.style.maxWidth = '100%'; cv.style.height = 'auto';
  if (cssW >= 576) { fig.className = 'fluid'; cv.style.width = '100%'; }   // kanvas utama: selebar kontainer (aspek tetap, piksel tetap tajam); kanvas kecil/berpasangan tetap ukuran tetap
  else cv.style.width = cssW + 'px';
  cv.style.imageRendering = smooth ? 'auto' : 'pixelated';
  fig.appendChild(cv);
  if (caption) { const f = document.createElement('figcaption'); f.textContent = caption; fig.appendChild(f); }
  host.appendChild(fig);
  return cv;
};

// Loop animasi: berhenti otomatis saat demo di luar layar
PX.loop = (host, fn) => {
  let on = true, last = performance.now(), t = 0;
  new IntersectionObserver((e) => (on = e[0].isIntersecting)).observe(host);
  const f = (now) => {
    const dt = PX.clamp((now - last) / 1000, 0, 0.05); last = now;
    if (on) { t += dt; fn(dt, t); }
    requestAnimationFrame(f);
  };
  requestAnimationFrame(f);
};

// Pointer dalam koordinat piksel logis canvas
PX.pointer = (cv) => {
  const p = { x: 0, y: 0, in: false, down: false, clicks: [] };
  const set = (e) => {
    const r = cv.getBoundingClientRect();
    p.x = Math.floor(((e.clientX - r.left) / r.width) * cv.width);
    p.y = Math.floor(((e.clientY - r.top) / r.height) * cv.height);
  };
  cv.addEventListener('pointermove', (e) => { set(e); p.in = true; });
  cv.addEventListener('pointerleave', () => { p.in = false; p.down = false; });
  cv.addEventListener('pointerdown', (e) => { set(e); p.in = p.down = true; p.clicks.push({ x: p.x, y: p.y }); });
  cv.addEventListener('pointerup', () => (p.down = false));
  cv.style.touchAction = 'none'; cv.style.cursor = 'crosshair';
  return p;
};

// Kontrol minimal
PX.ui = (host) => {
  const bar = document.createElement('div'); bar.className = 'ctl'; host.prepend(bar);
  const wrap = (label, el) => { const l = document.createElement('label'); l.append(label + ' ', el); bar.appendChild(l); return el; };
  return {
    select(label, opts, val, fn) {
      const s = document.createElement('select');
      opts.forEach((o) => s.add(new Option(o.label ?? o, o.value ?? o)));
      s.value = val; s.onchange = () => fn(s.value); wrap(label, s); return s;
    },
    range(label, min, max, step, val, fn) {
      const r = document.createElement('input'); r.type = 'range'; r.min = min; r.max = max; r.step = step; r.value = val;
      const fill = () => r.style.setProperty('--p', ((r.value - min) / (max - min)) * 100 + '%');
      r.oninput = () => { fill(); fn(+r.value); }; fill(); wrap(label, r); return r;
    },
    button(label, fn) { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.onclick = fn; bar.appendChild(b); return b; },
    check(label, val, fn) {
      const c = document.createElement('input'); c.type = 'checkbox'; c.checked = val;
      c.onchange = () => fn(c.checked); wrap(label, c); return c;
    },
  };
};

// Garis piksel integer (DDA) — tanpa anti-alias
PX.line = (c, x0, y0, x1, y1, col) => {
  const n = Math.max(1, Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)));
  c.fillStyle = col;
  for (let i = 0; i <= n; i++) c.fillRect(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), 1, 1);
};

/* 10-buf.js */
// 10-buf.js — PX.Buf: buffer piksel Uint32 + 1x putImageData per frame.
// Tanpa panggilan canvas per piksel; koordinat selalu integer; mendukung alpha & additive.
// (Asumsi little-endian: urutan byte RGBA -> Uint32 ABGR, berlaku di semua browser utama.)
PX.Buf = class {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.img = new ImageData(w, h);
    this.d = new Uint32Array(this.img.data.buffer);
    this.add = false;                       // true = pencampuran additive (cahaya)
  }
  clear() { this.d.fill(0); }
  px(x, y, c, a = 1) {                      // c = [r,g,b], a = 0..1
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || a <= 0) return;
    const i = y * this.w + x, p = this.d[i], pa = (p >>> 24) / 255;
    if (a >= 0.998 && !this.add) { this.d[i] = (0xff000000 | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0; return; }
    let r, g, b, A;
    if (this.add) {
      A = Math.min(1, pa + a);
      r = Math.min(255, (p & 255) * pa + c[0] * a); g = Math.min(255, ((p >>> 8) & 255) * pa + c[1] * a); b = Math.min(255, ((p >>> 16) & 255) * pa + c[2] * a);
      r /= A; g /= A; b /= A;
    } else {
      A = a + pa * (1 - a); const k = pa * (1 - a);
      r = ((p & 255) * k + c[0] * a) / A; g = (((p >>> 8) & 255) * k + c[1] * a) / A; b = (((p >>> 16) & 255) * k + c[2] * a) / A;
    }
    this.d[i] = (((A * 255 + 0.5) | 0) << 24 | ((b + 0.5) | 0) << 16 | ((g + 0.5) | 0) << 8 | ((r + 0.5) | 0)) >>> 0;
  }
  disc(cx, cy, r, c, a = 1) {               // lingkaran piksel: xx*xx+yy*yy <= r*r
    if (r < 0.5 || a <= 0.01) return;
    cx = Math.round(cx); cy = Math.round(cy);
    const R = Math.ceil(r), r2 = r * r;
    for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) if (x * x + y * y <= r2) this.px(cx + x, cy + y, c, a);
  }
  ditherDisc(cx, cy, r, c, a = 1) {         // glow tanpa gradient: kepadatan piksel turun ke tepi (Bayer)
    cx = Math.round(cx); cy = Math.round(cy);
    const R = Math.ceil(r);
    for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) {
      const d = Math.hypot(x, y) / r;
      if (d <= 1 && (1 - d) * a > PX.bayer(cx + x, cy + y)) this.px(cx + x, cy + y, c, 1);
    }
  }
  flush(ctx) { ctx.putImageData(this.img, 0, 0); }
};

/* 12-light.js */
// 12-light.js — PX.Light: buffer cahaya terpisah. glow() menambah (additive) ke buffer ini, lalu flush() menimpa kanvas dengan 'lighter'.
// Profil: intensitas = (1 - jarak/r)^2 * k  -> terang di pusat, jatuh cepat ke tepi (tanpa tepi keras).
PX.Light = class {
  constructor(w, h) {
    this.w = w; this.h = h; this.d = new Float32Array(w * h * 3);
    this.cv = document.createElement('canvas'); this.cv.width = w; this.cv.height = h;
    this.cx = this.cv.getContext('2d'); this.img = new ImageData(w, h);
  }
  clear() { this.d.fill(0); }
  glow(x, y, r, col, k = 1, prof = 2) {          // prof: 2 = kuadrat (default), 1 = linear, 0 = datar
    if (r < 1 || k <= 0.01) return;
    const w = this.w, h = this.h, x0 = Math.max(0, Math.floor(x - r)), x1 = Math.min(w - 1, Math.ceil(x + r)),
      y0 = Math.max(0, Math.floor(y - r)), y1 = Math.min(h - 1, Math.ceil(y + r)), q = 1 / r;
    for (let j = y0; j <= y1; j++) {
      const dy = (j + 0.5 - y) * q;
      for (let i = x0; i <= x1; i++) {
        const dx = (i + 0.5 - x) * q, t = dx * dx + dy * dy; if (t >= 1) continue;
        const f = 1 - Math.sqrt(t), a = (prof === 2 ? f * f : prof === 1 ? f : 1) * k, o = (j * w + i) * 3;
        this.d[o] += col[0] * a; this.d[o + 1] += col[1] * a; this.d[o + 2] += col[2] * a;
      }
    }
  }
  flush(ctx) {
    const D = this.img.data, s = this.d;
    for (let i = 0, n = this.w * this.h; i < n; i++) {
      const r = Math.min(255, s[i * 3]), g = Math.min(255, s[i * 3 + 1]), b = Math.min(255, s[i * 3 + 2]), m = Math.max(r, g, b, 1);
      D[i * 4] = (r / m) * 255; D[i * 4 + 1] = (g / m) * 255; D[i * 4 + 2] = (b / m) * 255; D[i * 4 + 3] = m;   // alpha = kecerahan -> area gelap tetap transparan
    }
    this.cx.putImageData(this.img, 0, 0);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.imageSmoothingEnabled = false; ctx.drawImage(this.cv, 0, 0); ctx.restore();
  }
};

/* 13-composite.js */
// 13-composite.js — sprite berindeks + komposit bertahap dari MASK: bayangan -> outline -> badan (+ flash, tint sisi jauh).
// Sprite = { w, h, idx (0 kosong, 1.. indeks palet), far (1 = bagian sisi jauh), pal }.
PX.mix = (a, b, t) => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t));

PX.fromAscii = (rows, legend) => {           // '.' = kosong; legend: { huruf: { col: [r,g,b], far?: true } }
  const h = rows.length, w = rows[0].length, idx = new Uint8Array(w * h), far = new Uint8Array(w * h), pal = [null], id = {};
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '.') return;
    if (!id[ch]) { id[ch] = pal.length; pal.push(legend[ch].col); }
    idx[y * w + x] = id[ch]; far[y * w + x] = legend[ch].far ? 1 : 0;
  }));
  return { w, h, idx, far, pal };
};

// o: { flip, outline: [r,g,b], shadow: alpha, tint: { col, k }, flash: [r,g,b] }. x,y = pojok kiri-atas, SELALU dibulatkan (snap).
PX.drawSprite = (buf, s, x, y, o = {}) => {
  x = Math.round(x); y = Math.round(y);
  const { w, h, idx, far, pal } = s;
  const q = (i, j) => (i < 0 || j < 0 || i >= w || j >= h ? -1 : j * w + (o.flip ? w - 1 - i : i));   // flip membalik idx & far sekaligus
  const solid = (i, j) => { const k = q(i, j); return k >= 0 && idx[k] > 0; };
  const cells = [];                                          // [i, j, k]; k = -1 -> sel outline
  for (let j = -1; j <= h; j++) for (let i = -1; i <= w; i++) {   // padding 1 sel agar outline di tepi sprite tidak terpotong
    if (solid(i, j)) cells.push([i, j, q(i, j)]);
    else if (o.outline && (solid(i - 1, j) || solid(i + 1, j) || solid(i, j - 1) || solid(i, j + 1))) cells.push([i, j, -1]);
  }
  if (o.shadow) for (const [i, j] of cells) buf.px(x + i + 1, y + j + 1, [0, 0, 0], o.shadow);   // 1) bayangan: badan + outline digeser (+1,+1)
  for (const [i, j, k] of cells) {                           // 2) badan/outline opaque di atas bayangan
    let c = o.outline;
    if (k >= 0) {
      c = pal[idx[k]];
      if (far[k] && o.tint) c = PX.mix(c, o.tint.col, o.tint.k);   // sisi jauh -> dicampur warna gelap
      if (o.flash) c = o.flash;                                    // flash hanya mengganti badan, bukan outline
    }
    buf.px(x + i, y + j, c, 1);
  }
};

/* 14-parallax.js */
// 14-parallax.js — latar berlapis: tiap lapisan = kanvas kecil yang di-tile mendatar dan digeser dengan faktor berbeda.
PX.Parallax = class {
  constructor(layers) { this.layers = layers; }                  // urut terjauh -> terdekat; layer = { cv, w, h, speed, base }
  draw(ctx, camX, camY, W, H, snap = true) {                     // camX dalam piksel logis; camY ternormalisasi -1..1
    for (const L of this.layers) {
      let ox = -((((camX * L.speed) % L.w) + L.w) % L.w);        // modulo ganda: aman untuk kamera negatif
      let oy = H - L.h + camY * L.h * 0.3 * (0.3 + L.speed);     // lapisan dekat bergeser vertikal lebih jauh
      if (snap) { ox = Math.round(ox); oy = Math.round(oy); }    // tanpa snap: tepi mengabur dan bergetar
      ctx.fillStyle = L.base; ctx.fillRect(0, Math.floor(oy + L.h), W, H);   // isi di bawah lapisan agar tak bolong saat kamera bergerak
      for (let x = ox; x < W; x += L.w) ctx.drawImage(L.cv, x, oy);
    }
  }
};

// Satu lapisan siluet yang MULUS saat di-tile: tinggi permukaan = jumlah sinus berfrekuensi BULAT per lebar tile.
PX.parallaxLayer = (w, h, { speed, seed, col, edge, amp = 0.5, base = 0.45, trees = 0 }) => {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const c = cv.getContext('2d'), r = PX.rng(seed), ph = [r(), r(), r()].map((v) => v * Math.PI * 2), T = (Math.PI * 2) / w;
  const ys = (x) => h * (1 - base) - amp * h * 0.25 * (Math.sin(T * x + ph[0]) + 0.6 * Math.sin(T * 2 * x + ph[1]) + 0.35 * Math.sin(T * 5 * x + ph[2]));
  for (let x = 0; x < w; x++) {
    const y = Math.round(ys(x));
    c.fillStyle = col; c.fillRect(x, y, 1, h - y);               // badan
    c.fillStyle = edge; c.fillRect(x, y, 1, 1);                  // 1 piksel tepi atas lebih terang
  }
  for (let i = 0; i < trees; i++) {                              // pohon pinus segitiga; digambar di x-w, x, x+w agar mulus di jahitan tile
    const tx = Math.round(((i + 0.5 + (PX.hash(i, 7, seed) - 0.5) * 0.7) * w) / trees), th = 6 + Math.round(PX.hash(i, 9, seed) * 6), gy = Math.round(ys((tx + w) % w));
    c.fillStyle = col;
    for (let j = 0; j < th; j++) for (const o of [-w, 0, w]) { const half = Math.floor(j / 2.2); c.fillRect(tx - half + o, gy - th + j, half * 2 + 1, 1); }
  }
  return { cv, w, h, speed, base: col };
};

/* 15-texture.js */
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

/* 16-water.js */
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
  caustics(lit, t, mask) {                                                    // anyaman cahaya: garis tempat sin(u)+sin(v) ≈ 0, dua medan ber-warp, 3 tingkat via Bayer, memudar ke atas kecuali di dasar
    const P = this.pal, gy = this.bottom, top = this.top;
    for (let y = top; y <= gy + 6; y++) {
      const k = y >= gy - 1 ? 1 : 0.18 + 0.32 * (1 - (y - top) / Math.max(1, gy - top));
      for (let x = this.x0; x < this.x1; x++) {
        if (mask && !mask(x, y)) continue;                               // mask opsional: caustic hanya di piksel air (air sel)
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

/* 17-fluid.js */
// 17-fluid.js — tiga model fluida murah untuk piksel: (1) PX.Surface = permukaan 1D berpegas, (2) PX.Bubbles = gelembung dari ventilasi, (3) PX.CAWater = air 2D berbasis sel (automata) + pelengkap: PX.Foam (busa), PX.Fizz (gelembung mikro).

// (1) Permukaan: tiap kolom = pegas (Hooke) + penyebaran ke tetangga. h>0 = naik. Langkah tetap 1/60 dtk agar stabil.
PX.Surface = class {
  constructor(n, base, o = {}) {
    this.n = n; this.base = base; this.h = new Float32Array(n); this.v = new Float32Array(n); this.dl = new Float32Array(n); this.dr = new Float32Array(n);
    this.k = o.k ?? 0.03; this.damp = o.damp ?? 0.03; this.spread = o.spread ?? 0.22; this.acc = 0;
  }
  splash(x, f) { const i = PX.clamp(Math.round(x), 0, this.n - 1); this.v[i] += f; if (i > 0) this.v[i - 1] += f * 0.5; if (i < this.n - 1) this.v[i + 1] += f * 0.5; }   // f<0 = ditekan ke bawah
  y(x) { x = PX.clamp(x, 0, this.n - 1); const i = Math.floor(x), j = Math.min(this.n - 1, i + 1), f = x - i; return this.base - (this.h[i] * (1 - f) + this.h[j] * f); }
  update(dt) { this.acc += dt; while (this.acc >= 1 / 60) { this.acc -= 1 / 60; this.step(); } }
  step() {
    const { n, h, v, dl, dr, k, damp, spread } = this;
    for (let i = 0; i < n; i++) { v[i] += -k * h[i] - damp * v[i]; h[i] += v[i]; }                    // pegas ke tinggi 0 + redaman
    for (let pass = 0; pass < 4; pass++) {                                                            // sebar: tetangga ditarik ke selisih tinggi
      for (let i = 0; i < n; i++) { if (i > 0) { dl[i] = spread * (h[i] - h[i - 1]); v[i - 1] += dl[i]; } if (i < n - 1) { dr[i] = spread * (h[i] - h[i + 1]); v[i + 1] += dr[i]; } }
      for (let i = 0; i < n; i++) { if (i > 0) h[i - 1] += dl[i]; if (i < n - 1) h[i + 1] += dr[i]; }
    }
  }
};

// (2) Gelembung (dari sistem Sprite Fusion, ditulis ulang): ventilasi -> naik, goyang, tumbuh, menyatu (volume kekal), pecah di permukaan.
PX.Bubbles = class {
  constructor({ x0, x1, top, ground, surfY, vents, density = 1, seed = 1 }) {
    Object.assign(this, { x0, x1, top, ground, D: density, surfY: surfY ?? (() => top), t: 0, list: [], pops: [] });
    const R = (this.R = PX.rng(seed)); this.rg = (a, b) => a + (b - a) * R();
    this.vents = (vents ?? [0.17, 0.5, 0.83].map((f) => x0 + f * (x1 - x0))).map((x) => ({ x, acc: R(), burst: this.rg(0.5, 2.5), seed: this.rg(0, 100) }));
    for (const v of this.vents) for (let y = ground(v.x) - 4; y > top; y -= this.rg(9, 23) / density) {      // isi awal sepanjang kolom supaya adegan tidak kosong
      this.spawn(v, y, 0); const b = this.list[this.list.length - 1]; b.r *= 1 + (1 - (y - top) / (ground(v.x) - top)) * 0.4; b.vy = -(20 + 13 * b.r);
    }
  }
  spawn(v, y, big) {
    const R = this.R, rg = this.rg, r = big ? rg(1.5, 3.2) * big : R() < 0.7 ? rg(0.5, 1.4) : rg(1.4, 2.6);
    this.list.push({ x0: v.x + rg(-2, 2), x: v.x, y, r, vy: 0, ph: rg(0, 6.283), wob: 0, near: R() < 0.35 });
  }
  add(x, y, r) { this.list.push({ x0: x, x, y, r, vy: -(20 + 13 * r), ph: this.rg(0, 6.283), wob: 0, near: false }); }   // gelembung dari sumber lain (benda jatuh)
  update(dt) {
    const L = this.list, rg = this.rg, n1 = (x, s) => PX.vnoise(x, s * 3.7) * 2 - 1; this.t += dt; const t = this.t;
    for (const v of this.vents) {
      v.acc += dt * 5 * this.D * (0.7 + 0.3 * n1(t * 0.8 + v.seed, 3));                                           // laju spawn berfluktuasi pelan
      for (; v.acc > 1; v.acc--) this.spawn(v, this.ground(v.x) - 2, 0);
      if ((v.burst -= dt) < 0) { v.burst = rg(1.4, 3.2); const n = 5 + Math.floor(this.R() * 6); for (let i = 0; i < n; i++) this.spawn(v, this.ground(v.x) - 2 - i * 2.5, rg(0.6, 1)); }   // semburan
    }
    for (let i = L.length - 1; i >= 0; i--) {
      const b = L[i];
      b.vy += (-(20 + 13 * b.r) - b.vy) * Math.min(1, dt * 3);                                                     // kecepatan naik ∝ ukuran, mendekati bertahap
      b.y += b.vy * dt; b.ph += dt * (4 + 2 / b.r);
      b.x = b.x0 + Math.sin(b.ph) * (0.5 + 0.8 * b.r); b.x0 += n1(t * 0.4 + i * 0.13, 5) * 3 * dt;                 // goyang kiri-kanan + hanyut
      b.r = Math.min(5, b.r + dt * 0.12); b.wob *= 1 - Math.min(1, dt * 4);                                         // tumbuh (tekanan turun)
      if (b.y < this.surfY(b.x) + 1) { this.pops.push({ x: b.x, y: this.surfY(b.x), r: b.r, t: 0 }); L.splice(i, 1); }
    }
    for (let i = 0; i < L.length; i++) {                                                                           // menyatu: volume kekal r = ∛(ra³+rb³)
      const a = L[i]; if (a.r < 1) continue;
      for (let j = i + 1; j < L.length; j++) { const b = L[j]; if (b.r < 1 || Math.hypot(a.x - b.x, a.y - b.y) > (a.r + b.r) * 0.75) continue; a.r = Math.cbrt(a.r ** 3 + b.r ** 3); a.x0 = (a.x0 + b.x0) / 2; a.wob = 1; L.splice(j--, 1); }
    }
    for (let i = this.pops.length - 1; i >= 0; i--) if ((this.pops[i].t += dt) > 0.2) this.pops.splice(i, 1);
  }
  draw(buf, lit, layer) {
    if (layer !== 'front') { for (const b of this.list) if (!b.near) this.bubble(buf, lit, b); for (const p of this.pops) this.pop(buf, p); }
    if (layer !== 'back') for (const b of this.list) if (b.near) this.bubble(buf, lit, b);
  }
  bubble(buf, lit, b) {                                              // ukuran menentukan detail: <0.9 = 1px, <1.5 = 2×2 empat warna, lainnya = cincin + highlight
    const { HI, LIT, RIM, SHADE } = PX.WATER, FILL = PX.mix(RIM, SHADE, 0.5), cx = b.x, cy = b.y, r = b.r;
    if (r < 0.9) { buf.px(Math.floor(cx), Math.floor(cy), r < 0.7 ? RIM : LIT); return; }
    if (r < 1.5) { const px = Math.floor(cx), py = Math.floor(cy); buf.px(px, py, HI); buf.px(px + 1, py, LIT); buf.px(px, py + 1, RIM); buf.px(px + 1, py + 1, SHADE); lit.glow(cx + 0.5, cy + 0.5, 3, LIT, 0.12); return; }
    const sq = 0.1 * Math.sin(b.ph * 2) * Math.min(1, (r - 1.5) / 2) + b.wob * 0.25, rx = r * (1 + sq), ry = r * (1 - sq);   // bentuk bergetar (gepeng bergantian) + kejut saat menyatu
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, d = Math.sqrt(dx * dx + dy * dy) * r; if (d > r + 0.5) continue;
      const l = (-dx - dy) / Math.SQRT2 / Math.max(0.01, d / r);                                                    // + = menghadap cahaya kiri-atas
      if (d > r - 0.6) buf.px(x, y, l > 0.45 ? LIT : l < -0.55 ? SHADE : RIM); else if (PX.bayer(x, y) < 0.12) buf.px(x, y, FILL);   // tepi 1px; isi hanya 12% dither
    }
    const hx = Math.round(cx - rx * 0.45), hy = Math.round(cy - ry * 0.45);
    buf.px(hx, hy, HI); if (r >= 2.5) { buf.px(hx + 1, hy, LIT); buf.px(hx, hy + 1, LIT); } if (r >= 2) buf.px(Math.round(cx + rx * 0.5), Math.round(cy + ry * 0.5), LIT);
    lit.glow(cx, cy, r * 2.4 + 2, RIM, 0.14);
  }
  pop(buf, p) {                                                      // pecah: setengah elips percikan melebar + 2 tetes naik, memudar via Bayer
    const k = p.t / 0.2, r = p.r + 1 + k * 3, dot = (x, y, c) => { const px = Math.floor(x), py = Math.floor(y); if (1 - k > PX.bayer(px, py)) buf.px(px, py, c); };
    for (let a = 0; a < 6.283; a += 0.5 / r) if (Math.sin(a) < 0.2) dot(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r * 0.5, k < 0.5 ? PX.WATER.HI : PX.WATER.LIT);
    if (p.r > 1.5) { dot(p.x - 2, p.y - 2 - k * 4, PX.WATER.LIT); dot(p.x + 2, p.y - 3 - k * 5, PX.WATER.LIT); }
  }
};

// (3) Air sel (cellular automata). g: 0 kosong, 1 air, 2 tembok. Pindai bawah->atas, arah kiri/kanan bergantian tiap langkah agar tidak miring sebelah.
// fall[i] = berapa langkah sel itu jatuh berturut-turut. Saat berhenti (mendarat) dicatat ke ev = {x, y, v, water} -> sumber percikan, gelombang, gelembung.
PX.CAWater = class {
  constructor(w, h, seed = 3) { this.w = w; this.h = h; this.g = new Uint8Array(w * h); this.m = new Uint8Array(w * h); this.fall = new Uint8Array(w * h); this.ev = []; this.lv = []; this.lvRate = 6; this.stamp = 0; this.dir = 0; this.flow = 4; this.R = PX.rng(seed); }
  step() {
    const { w, h, g, m, fall: fl, ev } = this; if (++this.stamp > 250) { this.stamp = 1; m.fill(0); } const st = this.stamp; this.dir ^= 1;
    for (let y = h - 2; y >= 0; y--) for (let k = 0; k < w; k++) {
      const x = this.dir ? k : w - 1 - k, i = y * w + x; if (g[i] !== 1 || m[i] === st) continue;       // m: sel yang baru dipindah langkah ini jangan diproses lagi
      const b = i + w, d = this.R() < 0.5 ? -1 : 1; let to = -1;
      if (g[b] === 0) to = b;                                                                          // 1) jatuh lurus
      else {
        for (let q = 0; q < 2 && to < 0; q++) { const s = q ? -d : d; if (x + s >= 0 && x + s < w && g[b + s] === 0 && g[i + s] === 0) to = b + s; }   // 2) diagonal bawah
        for (let q = 0; q < 2 && to < 0; q++) { const s = q ? -d : d; let j = 0; while (j < this.flow && x + s * (j + 1) >= 0 && x + s * (j + 1) < w && g[i + s * (j + 1)] === 0) j++; if (j > 0) to = i + s * j; }   // 3) mengalir ke samping
      }
      if (to !== b) { if (fl[i] >= 3 && ev.length < 48) ev.push({ x, y, v: fl[i], water: g[b] === 1 }); fl[i] = 0; }   // tidak lagi jatuh lurus = mendarat
      if (to >= 0) { g[to] = 1; g[i] = 0; m[to] = st; fl[to] = to === b ? Math.min(255, fl[i] + 1) : 0; fl[i] = 0; }
    }
    if (this.lvRate > 0) this.level();
  }
  // Bejana berhubungan: tiap badan air (sel air terhubung 4 arah) disamakan tingginya. Muka tertinggi di badan itu menyumbang sel,
  // muka terendah menerimanya (sel diletakkan tepat di atasnya), selama selisih >= 2 baris. Maks lvRate sel per badan per langkah = debit penyamaan.
  // Sel yang masih jatuh (fall > 0) dan sel tanpa topangan bukan muka air, jadi aliran keran tidak ikut "disedot". Posisi pindah dicatat di lv (x asal, x tujuan) untuk gelombang.
  level() {
    const { w, h, g, fall: fl, R } = this, n = w * h, lab = this.lab || (this.lab = new Int32Array(n)), stk = this.stk || (this.stk = new Int32Array(n)); lab.fill(0); let c = 0;
    for (let s0 = 0; s0 < n; s0++) {
      if (g[s0] !== 1 || lab[s0]) continue;
      let sp = 0, hy = 1e9, ly = -1, S = [], K = []; stk[sp++] = s0; lab[s0] = ++c;
      while (sp) {
        const i = stk[--sp], x = i % w, y = (i / w) | 0;
        if (y > 0 && y < h - 1 && g[i - w] === 0 && g[i + w] !== 0 && fl[i] === 0) {
          if (y < hy) { hy = y; S = []; } if (y === hy) S.push(i);
          if (y > ly) { ly = y; K = []; } if (y === ly) K.push(i);
        }
        if (x > 0 && g[i - 1] === 1 && !lab[i - 1]) { lab[i - 1] = c; stk[sp++] = i - 1; }
        if (x < w - 1 && g[i + 1] === 1 && !lab[i + 1]) { lab[i + 1] = c; stk[sp++] = i + 1; }
        if (y > 0 && g[i - w] === 1 && !lab[i - w]) { lab[i - w] = c; stk[sp++] = i - w; }
        if (y < h - 1 && g[i + w] === 1 && !lab[i + w]) { lab[i + w] = c; stk[sp++] = i + w; }
      }
      if (ly - hy < 2) continue;
      for (let m = Math.min(this.lvRate, (ly - hy) >> 1); m > 0 && S.length && K.length; m--) {
        const a = S.splice((R() * S.length) | 0, 1)[0], b = K.splice((R() * K.length) | 0, 1)[0] - w;
        g[a] = 0; g[b] = 1; fl[a] = fl[b] = 0; if (this.lv.length < 256) this.lv.push(a % w, b % w);
      }
    }
  }
};

// (4) Busa permukaan: intensitas per kolom, meluruh pelan; digambar sebagai piksel putih berambang Bayer tepat di muka air.
PX.Foam = class {
  constructor(n) { this.f = new Float32Array(n); }
  add(x, a, s = 3) { for (let dx = -s; dx <= s; dx++) { const i = Math.round(x) + dx; if (i >= 0 && i < this.f.length) this.f[i] = Math.min(1, this.f[i] + a * (1 - Math.abs(dx) / (s + 1))); } }
  update(dt) { for (let i = 0; i < this.f.length; i++) this.f[i] = Math.max(0, this.f[i] - dt * 0.35); }
  draw(buf, surfY) {                                                   // surfY(x) < 0 = kolom tanpa muka air
    for (let x = 0; x < this.f.length; x++) { const a = this.f[x]; if (a < 0.04) continue; const y = Math.round(surfY(x)); if (y < 0) continue;
      if (a > PX.bayer(x, y)) buf.px(x, y, PX.WATER.HI); if (a * 0.8 > PX.bayer(x + 1, y - 1)) buf.px(x, y - 1, PX.WATER.LIT); }
  }
};

// (5) Gelembung mikro di dalam air (titik-titik): tiap gelembung naik dengan goyang kecil, hilang bila keluar dari air, pecah (onPop) bila mencapai muka air.
// inWater(x, y) -> bool menentukan di mana gelembung boleh ada, jadi cocok untuk air sel berbentuk bebas.
PX.Fizz = class {
  constructor(inWater, onPop, seed = 7) { Object.assign(this, { inW: inWater, onPop, list: [], max: 320, R: PX.rng(seed) }); }
  burst(x, y, n, spread = 3, down = 0) {                              // down > 0: awalnya terseret turun oleh air yang jatuh, lalu naik
    const R = this.R, rg = (a, b) => a + (b - a) * R();
    for (let i = 0; i < n && this.list.length < this.max; i++) this.list.push({ x: x + rg(-spread, spread), y: y + rg(0, spread), r: rg(0.4, 1.3), vy: rg(-4, down), ph: rg(0, 6.283) });
  }
  update(dt) {
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const b = L[i]; b.ph += dt * (6 + 2 / b.r); b.vy += (-(10 + 14 * b.r) - b.vy) * Math.min(1, 2.5 * dt); b.y += b.vy * dt; b.x += Math.sin(b.ph) * 6 * dt;
      const ix = Math.round(b.x), iy = Math.round(b.y);
      if (!this.inW(ix, iy)) { if (b.vy < 0 && this.inW(ix, iy + 1) && this.onPop) this.onPop(ix, iy); L.splice(i, 1); }
    }
  }
  draw(buf, lit) {
    const P = PX.WATER;
    for (const b of this.list) {
      const x = Math.round(b.x), y = Math.round(b.y);
      if (b.r < 0.9) buf.px(x, y, Math.sin(b.ph * 0.7) > 0.6 ? P.HI : P.RIM);                    // kecil = 1 piksel, berkedip
      else { buf.px(x, y, P.HI); buf.px(x + 1, y, P.LIT); buf.px(x, y + 1, P.RIM); buf.px(x + 1, y + 1, P.SHADE); lit.glow(x + 0.5, y + 0.5, 3, P.LIT, 0.12); }
    }
  }
};

/* 20-pixelize.js */
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

/* 21-stickman.js */
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

/* 30-demo-hires.js */
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

/* 31-demo-sheet.js */
// Sprite sheet prosedural: bake N frame -> 1 atlas dengan padding 1px, pivot bottom-center, posisi integer.
PX.bakeSheet = (frames = 6, FR = 32, pad = 1) => {
  const hr = document.createElement('canvas'); hr.width = hr.height = FR * 4;          // render halus 4× lebih besar
  const sheet = document.createElement('canvas');
  sheet.width = frames * FR + (frames + 1) * pad; sheet.height = FR + 2 * pad;           // pad di semua sisi
  const sc = sheet.getContext('2d'), rects = [];
  for (let f = 0; f < frames; f++) {
    PX.stickman(hr.getContext('2d'), (f / frames) * Math.PI * 2 / 6, hr.width);          // 1 siklus jalan penuh
    const x = pad + f * (FR + pad), y = pad;
    sc.putImageData(PX.pixelize(hr, FR), x, y);                                          // integer, tanpa skala
    rects.push({ x, y, w: FR, h: FR });
  }
  return { canvas: sheet, rects, FR, pad, pivot: { x: FR / 2, y: 28 } };                 // pivot = garis tanah (kaki)
};

PX.demos.sheet = (host) => {
  const sh = PX.bakeSheet(6, 32, 1), W = 192, H = 64, GY = 56;
  const view = PX.canvas(host, W, H, 576, false, 'Animasi: drawImage integer, pivot di kaki');
  const atlas = PX.canvas(host, sh.canvas.width, sh.canvas.height, sh.canvas.width * 3, false, 'Atlas (6 frame, pad 1px)');
  const info = document.createElement('pre'); info.className = 'info';
  info.textContent = sh.rects.map((r, i) => `frame ${i}: x=${r.x} y=${r.y} w=${r.w} h=${r.h}`).join('\n') + `\npivot: (${sh.pivot.x}, ${sh.pivot.y})`;
  host.appendChild(info);
  let grid = true;
  PX.ui(host).check('Tampilkan grid', true, (v) => (grid = v));
  const vc = view.getContext('2d'), ac = atlas.getContext('2d');
  vc.imageSmoothingEnabled = ac.imageSmoothingEnabled = false;
  PX.loop(host, (dt, t) => {
    vc.clearRect(0, 0, W, H); vc.fillStyle = '#2a2a3c'; vc.fillRect(0, GY, W, H - GY);
    const f = Math.floor(t * 10) % 6, r = sh.rects[f], x = Math.round(((t * 36) % (W + 32)) - 16);
    vc.drawImage(sh.canvas, r.x, r.y, r.w, r.h, x - sh.pivot.x, GY - sh.pivot.y, r.w, r.h);   // semua argumen integer
    ac.clearRect(0, 0, atlas.width, atlas.height); ac.drawImage(sh.canvas, 0, 0);
    if (grid) { ac.fillStyle = 'rgba(255,0,200,.55)'; sh.rects.forEach((q, i) => { ac.fillRect(q.x - 1, q.y - 1, q.w + 2, 1); ac.fillRect(q.x - 1, q.y + q.h, q.w + 2, 1); ac.fillRect(q.x - 1, q.y - 1, 1, q.h + 2); ac.fillRect(q.x + q.w, q.y - 1, 1, q.h + 2); }); }
    ac.fillStyle = '#0f0'; ac.fillRect(sh.rects[f].x + sh.pivot.x, sh.rects[f].y + sh.pivot.y, 1, 1);
  });
};

/* 32-demo-dither.js */
// Shading bola dengan ramp palet terbatas + ordered dithering Bayer 4×4. Gerakkan mouse = arah cahaya.
PX.demos.dither = (host) => {
  const N = 48, cv = PX.canvas(host, N, N, 288, false, 'Bola 6 warna'), c = cv.getContext('2d'), img = c.createImageData(N, N), p = PX.pointer(cv);
  const RAMPS = {
    oranye: ['#2a1208', '#7a2e0e', '#c4561a', '#ee7a1c', '#ffb25a', '#fff1c9'],
    biru: ['#241a66', '#2f3cb4', '#4f7bff', '#8fcbff', '#dff2ff', '#ffffff'],
    hijau: ['#0d2a1c', '#1c5a38', '#2f9355', '#5fd17f', '#b6f2c4', '#f0fff3'],
  };
  let ramp = RAMPS.oranye.map(PX.hex), dither = true;
  const ui = PX.ui(host);
  ui.select('Ramp', Object.keys(RAMPS), 'oranye', (v) => (ramp = RAMPS[v].map(PX.hex)));
  ui.check('Dither Bayer', true, (v) => (dither = v));
  PX.loop(host, (dt, t) => {
    let lx = Math.cos(t * 0.8) * 0.7, ly = -0.55;
    if (p.in) { lx = (p.x / N - 0.5) * 2; ly = (p.y / N - 0.5) * 2; }
    const lz = 0.75, ln = Math.hypot(lx, ly, lz); lx /= ln; ly /= ln; const Lz = lz / ln;
    const R = N / 2 - 1, d = img.data, n = ramp.length;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = (y * N + x) * 4, nx = (x + 0.5 - N / 2) / R, ny = (y + 0.5 - N / 2) / R, r2 = nx * nx + ny * ny;
      if (r2 > 1) { d[i + 3] = 0; continue; }
      const nz = Math.sqrt(1 - r2), l = Math.max(0, nx * lx + ny * ly + nz * Lz);
      let k = 0.1 + 0.9 * l + (PX.hash(Math.floor(x + t * 4) >> 1, y >> 1, 3) - 0.5) * 0.14;   // tekstur blok kasar
      k = PX.clamp(k, 0, 0.999) * (n - 1);
      const idx = dither ? Math.floor(k + PX.bayer(x, y)) : Math.round(k);                       // inti ordered dithering
      const col = ramp[Math.min(n - 1, idx)];
      d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
    }
    c.putImageData(img, 0, 0);
  });
};

/* 33-demo-parallax.js */
// Demo parallax: 4 lapisan siluet, kamera jalan otomatis; kursor (vertikal) menggeser kamera Y.
PX.demos.parallax = (host) => {
  const W = 240, H = 135, cv = PX.canvas(host, W, H, 640, false, 'Gerakkan kursor naik-turun untuk parallax vertikal. Matikan "Kabut palet" untuk melihat kenapa warna lapisan penting.'), c = cv.getContext('2d'), p = PX.pointer(cv);
  const top = [34, 28, 76], bot = [246, 154, 112], dark = [14, 18, 32];
  const spec = [
    { w: 256, h: 74, speed: 0.12, seed: 3, amp: 0.9, base: 0.5, d: 0.45 },
    { w: 200, h: 60, speed: 0.28, seed: 8, amp: 0.8, base: 0.45, d: 0.62 },
    { w: 168, h: 46, speed: 0.55, seed: 15, amp: 0.5, base: 0.4, d: 0.8, trees: 9 },
    { w: 136, h: 32, speed: 0.9, seed: 21, amp: 0.35, base: 0.35, d: 1, trees: 7 },   // lebar tile berbeda-beda -> pola tidak sejajar
  ];
  let spd = 30, snap = true, fog = true, par, sky, cam = 0;
  const build = () => {
    const b = new PX.Buf(W, H); sky = document.createElement('canvas'); sky.width = W; sky.height = H;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) b.px(x, y, Math.min(1, y / (H * 0.75)) > PX.bayer(x, y) ? bot : top);   // langit: gradien dither
    b.flush(sky.getContext('2d'));
    par = new PX.Parallax(spec.map((s) => {
      const col = PX.mix(fog ? bot : dark, dark, fog ? s.d : 1);                  // kabut = warna lapisan dicampur ke warna langit (dibakar sekali)
      return PX.parallaxLayer(s.w, s.h, { ...s, col: PX.rgb(col), edge: PX.rgb(PX.mix(col, bot, 0.35)) });
    }));
  };
  build();
  const ui = PX.ui(host);
  ui.range('Kecepatan kamera', 0, 120, 5, spd, (v) => (spd = v));
  ui.check('Snap integer', true, (v) => (snap = v));
  ui.check('Kabut palet', true, (v) => { fog = v; build(); });
  PX.loop(host, (dt) => {
    cam += spd * dt;
    c.imageSmoothingEnabled = !snap;                                              // snap mati = interpolasi bawaan canvas -> blur
    c.drawImage(sky, 0, 0);
    par.draw(c, cam, p.in ? (p.y / H - 0.5) * 2 : 0, W, H, snap);
  });
};

/* 34-demo-composite.js */
// Demo komposit sprite: pahlawan kecil mengikuti kursor. Strip bawah = tahapan. Klik = flash putih.
PX.demos.composite = (host) => {
  const W = 128, H = 72, cv = PX.canvas(host, W, H, 640, false, 'Strip bawah, kiri ke kanan: badan saja · +outline · +bayangan · +tint sisi jauh. Klik area atas untuk flash.'), buf = new PX.Buf(W, H), c = cv.getContext('2d'), p = PX.pointer(cv);
  const hero = PX.fromAscii([
    '....hhhh....', '...hhhhhh...', '...hsssshh..', '...hsessss..', '...hsssss...', '.....ss.....',
    '..AAbbbbaa..', '..AAbbbbaa..', '..A.bbbbagg.', '....bbbb.gg.', '....pppp....', '....pppp....',
    '....pp.pp...', '....pp.pp...', '....ll.ll...', '...lll.lll..',
  ], {
    h: { col: [96, 58, 38] }, s: { col: [240, 196, 156] }, e: { col: [30, 24, 40] }, b: { col: [74, 120, 214] }, a: { col: [64, 104, 196] },
    A: { col: [64, 104, 196], far: true }, p: { col: [60, 64, 104] }, l: { col: [44, 40, 56] }, g: { col: [150, 152, 162] },
  });
  const OL = [28, 18, 34], TINT = { col: [18, 22, 64], k: 0.5 }, on = { outline: true, shadow: true, tint: true };
  let x = W / 2, face = 1, flash = 0;
  const ui = PX.ui(host);
  ui.check('Outline', true, (v) => (on.outline = v)); ui.check('Bayangan', true, (v) => (on.shadow = v)); ui.check('Tint sisi jauh', true, (v) => (on.tint = v));
  PX.loop(host, (dt, t) => {
    if (p.clicks.splice(0).length) flash = 0.12;
    const tx = p.in ? p.x : W / 2 + Math.sin(t * 0.8) * 34;
    if (Math.abs(tx - x) > 0.25) face = tx > x ? 1 : -1;
    const moving = Math.abs(tx - x) > 0.5;
    x += (tx - x) * Math.min(1, dt * 6); flash = Math.max(0, flash - dt);      // posisi dunia pecahan; drawSprite yang membulatkan
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) buf.px(i, j, j < 48 ? (((i >> 2) + (j >> 2)) & 1 ? [150, 178, 120] : [140, 168, 112]) : [96, 122, 92], 1);
    PX.drawSprite(buf, hero, x - hero.w / 2, 46 - hero.h + (moving ? -Math.round(Math.abs(Math.sin(t * 14))) : 0), {
      flip: face < 0, outline: on.outline ? OL : null, shadow: on.shadow ? 0.28 : 0, tint: on.tint ? TINT : null, flash: flash > 0 ? [255, 255, 255] : null,
    });
    [{}, { outline: OL }, { outline: OL, shadow: 0.28 }, { outline: OL, shadow: 0.28, tint: TINT }].forEach((o, i) => PX.drawSprite(buf, hero, 16 + i * 32 - hero.w / 2, 52, o));
    buf.flush(c);
  });
};

/* 40-demo-tracer.js */
// Tracer + muzzle flash + percikan tumbukan. Klik = tembak ke arah kursor (idle: tembak otomatis).
PX.demos.tracer = (host) => {
  const W = 320, H = 180, GY = 152, cv = PX.canvas(host, W, H, 640, false), c = cv.getContext('2d'), p = PX.pointer(cv);
  const GUN = { x: 32, y: 120 }, CORE = '#fffbd0', MIDS = '#ffd24a', DARK = '#a8841f';
  const bl = [], sp = [], fl = []; let cd = 0, kick = 0, ang = 0;
  const rays = (x, y, a, n, len, col) => { for (let i = 0; i < n; i++) { const q = a + (Math.random() - 0.5) * 1.3, l = len * (0.4 + Math.random() * 0.6); PX.line(c, x, y, x + Math.cos(q) * l, y + Math.sin(q) * l, col); } };
  const fire = (a) => { bl.push({ x: GUN.x + Math.cos(a) * 18, y: GUN.y + Math.sin(a) * 18, a, trav: 0 }); fl.push({ t: 0, a }); kick = 3; };
  const tracer = (b) => {                       // kepala 1px terang -> pasangan piksel tebal -> piksel tunggal gelap memudar
    const ca = Math.cos(b.a), sa = Math.sin(b.a), len = Math.min(b.trav, 14), m = Math.max(Math.abs(ca), Math.abs(sa)),
      N = Math.max(3, Math.round(len * m)), vert = Math.abs(sa) >= Math.abs(ca), ox = vert ? (ca >= 0 ? -1 : 1) : 0, oy = vert ? 0 : (sa >= 0 ? -1 : 1);
    for (let k = N; k >= 0; k--) {
      const t = k / N, x = Math.round(b.x - (ca / m) * k), y = Math.round(b.y - (sa / m) * k);
      if (k === 0) { c.globalAlpha = 1; c.fillStyle = CORE; c.fillRect(x, y, 1, 1); }
      else if (t <= 0.55) { c.globalAlpha = 1; c.fillStyle = MIDS; c.fillRect(x, y, 1, 1); c.fillRect(x + ox, y + oy, 1, 1); }
      else { c.globalAlpha = Math.max(0.55, 1 - (t - 0.55) * 1.2); c.fillStyle = DARK; c.fillRect(x, y, 1, 1); }
    }
    c.globalAlpha = 1;
  };
  PX.loop(host, (dt, t) => {
    cd -= dt; kick = Math.max(0, kick - dt * 20);
    ang = p.in ? Math.atan2(p.y - GUN.y, p.x - GUN.x) : -0.12 + Math.sin(t * 0.9) * 0.2;
    while (p.clicks.length) { p.clicks.length = 0; fire(ang); }
    if (cd <= 0 && (p.down || !p.in)) { fire(ang + (Math.random() - 0.5) * 0.04); cd = p.in ? 0.09 : 0.35; }
    for (const b of bl) {
      const v = 600 * dt; b.x += Math.cos(b.a) * v; b.y += Math.sin(b.a) * v; b.trav += v;
      if (b.x >= W - 12 || b.y >= GY || b.y < 0) {
        b.dead = true; const base = b.y >= GY ? -Math.PI / 2 : Math.PI;
        for (let i = 0; i < 9; i++) { const q = base + (Math.random() - 0.5) * 2.2, s = 80 + Math.random() * 180; sp.push({ x: b.x, y: Math.min(b.y, GY - 1), vx: Math.cos(q) * s, vy: Math.sin(q) * s, life: 0.25 + Math.random() * 0.3 }); }
      }
    }
    for (let i = bl.length - 1; i >= 0; i--) if (bl[i].dead) bl.splice(i, 1);
    for (const s of sp) { s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 520 * dt; s.life -= dt; }
    for (let i = sp.length - 1; i >= 0; i--) if (sp[i].life <= 0) sp.splice(i, 1);
    for (const f of fl) f.t += dt; while (fl.length && fl[0].t > 0.07) fl.shift();
    c.clearRect(0, 0, W, H); c.fillStyle = '#26263a'; c.fillRect(0, GY, W, H - GY); c.fillStyle = '#34344e'; c.fillRect(W - 12, 0, 12, GY);
    PX.line(c, GUN.x - Math.cos(ang) * kick, GUN.y - Math.sin(ang) * kick, GUN.x + Math.cos(ang) * 18 - Math.cos(ang) * kick, GUN.y + Math.sin(ang) * 18 - Math.sin(ang) * kick, '#8a8aa8');
    c.fillStyle = '#5c5c78'; c.fillRect(GUN.x - 6, GUN.y - 2, 10, 12);
    for (const f of fl) { const x = GUN.x + Math.cos(f.a) * 18, y = GUN.y + Math.sin(f.a) * 18; rays(x, y, f.a, 5, 12, MIDS); rays(x, y, f.a, 3, 6, CORE); c.fillStyle = '#fff'; c.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3); }
    bl.forEach(tracer);
    for (const s of sp) { c.fillStyle = s.life > 0.2 ? CORE : MIDS; c.fillRect(Math.round(s.x), Math.round(s.y), 1, 1); }
  });
};

/* 41-demo-blast.js */
// Dua jenis ledakan. PX.Rocket (roket/launcher): kilat -> 2 cincin -> puff bola api -> asap besar -> percikan berparabola.
// PX.Blast (neutron): kilat -> gumpalan bertekstur prosedural -> sinar -> gelombang kejut tak beraturan -> partikel -> asap. Keduanya memberi cahaya lewat PX.Light.
PX.PALS = {
  api:     { c: ['#8a1f17', '#f2561d', '#ff8a2a', '#ffe26b', '#ffffff'], smoke: ['#7e3030', '#4a2a2a', '#2e2024', '#1a161c'] },
  neutron: { c: ['#1b2fb0', '#3a5cff', '#8fb4ff', '#c9d8ff', '#ffffff'], smoke: ['#5a6aa8', '#3a4278', '#262a4c', '#14162a'] },
};
PX.Blast = class {
  constructor(x, y, R, pal = PX.PALS.api) {
    const r = Math.random, rg = (a, b) => a + r() * (b - a); this.x = Math.round(x); this.y = Math.round(y); this.R = R; this.t = 0; this.life = 1.05 + r() * 0.25; this.shake = 1;
    this.c = pal.c.map(PX.hex); this.sm = pal.smoke.map(PX.hex);
    // sinar: 10 duri utama (merata + jitter, tebal, panjang) + 22 sinar pendek acak. Tiap sinar = kepala (inti) yang dilontarkan keluar + ekor yang mengikuti jejak kepala lalu hilang; waktu lontarnya bertingkat (sebagian serentak, sebagian telat).
    const dl = () => { const q = r(); return q < 0.4 ? rg(0, 0.02) : q < 0.7 ? rg(0.06, 0.12) : rg(0.15, 0.3); };   // waktu lontar: 40% serentak, 30% sedikit telat, 30% lebih telat
    this.rays = [
      ...Array.from({ length: 10 }, (_, i) => ({ a: (i / 10) * 6.283 + rg(-0.15, 0.15), len: rg(1.4, 2.5), big: true, t0: dl(), dur: rg(0.45, 0.65), sr: rg(0.85, 1.15) })),
      ...Array.from({ length: 22 }, () => ({ a: r() * 6.283, len: rg(0.4, 1.3), big: false, t0: dl(), dur: rg(0.35, 0.55), sr: rg(0.85, 1.15) })),
    ];
    this.spin = (r() < 0.5 ? -1 : 1) * rg(0.25, 0.5); this.tips = [];
    this.lobes = Array.from({ length: 10 }, () => ({ v: (r() * 4) | 0, ox: (r() * 32) | 0, oy: (r() * 32) | 0, a: r() * 6.283, d: r() * 0.75, r: 0.2 + r() * 0.28, t0: r() * 0.22, tl: 0.45 + r() * 0.4 }));
    this.ph = [r() * 6.283, r() * 6.283, r() * 6.283];
    this.parts = Array.from({ length: 70 }, () => { const g = r() * 6.283, v = (0.4 + Math.sqrt(r()) * 2.4) * R * 3; return { x: this.x, y: this.y, vx: Math.cos(g) * v, vy: Math.sin(g) * v - R, life: 0.25 + r() * 0.75, ci: (r() * 4) | 0 }; });
    this.smoke = Array.from({ length: 7 }, () => ({ x: this.x + (r() - 0.5) * R, y: this.y + (r() - 0.5) * R, vx: (r() - 0.5) * 8, vy: -4 - r() * 9, life: 1 + r() * 0.6, r0: R * 0.18, r1: R * (0.4 + r() * 0.4) }));
  }
  get done() { return this.t > this.life + 0.8; }
  step(dt) {
    this.t += dt; this.shake = Math.max(0, this.shake - dt * 3.5);
    for (const p of this.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += this.R * 14 * dt; }
    for (const s of this.smoke) { s.x += s.vx * dt; s.y += s.vy * dt; }
  }
  light(L) {                                                                           // cahaya: halo berdenyut + kilat + titik terang di ujung tiap sinar (ikut bergerak)
    const u = Math.min(1, this.t / this.life), k = Math.pow(1 - u, 1.4), f = 0.88 + 0.12 * Math.sin(this.t * 55);
    L.glow(this.x, this.y, this.R * 3.6, this.c[1], 0.7 * k * f); if (this.t < 0.14) L.glow(this.x, this.y, this.R * 1.7, [255, 255, 255], 0.7 * (1 - this.t / 0.14));
    for (let i = 0; i < this.tips.length; i += 3) L.glow(this.tips[i], this.tips[i + 1], 4, this.c[2], 0.3 * this.tips[i + 2]);
  }
  draw(b) {
    const { x: cx, y: cy, R, c } = this, T = this.t, u = T / this.life, e = 1 - (1 - u) * (1 - u), a = Math.pow(Math.max(0, 1 - u), 1.1), rnd = Math.random;
    for (const s of this.smoke) { const su = T / s.life; if (su > 1 || su < 0.12) continue; b.disc(s.x, s.y, s.r0 + (s.r1 - s.r0) * su, this.sm[Math.min(3, (su * 4) | 0)], 0.55 * (1 - su)); }
    this.tips.length = 0;
    if (u < 1) {
      b.disc(cx, cy, R * (1 + 0.9 * e), c[0], a * 0.14);
      if (u < 0.14) b.disc(cx, cy, R * (0.5 + (0.9 * u) / 0.14), c[4], 1 - u / 0.14);       // kilat
      if (u < 0.22) {                                                                     // kilau silang (lens flare): 4 garis tipis, berkedip
        const k = 1 - u / 0.22, len = R * (0.8 + 2.2 * Math.sqrt(k));
        for (let d = 1; d < len; d++) { const al = k * (1 - d / len) * (0.7 + 0.3 * rnd()); b.px(cx + d, cy, c[4], al); b.px(cx - d, cy, c[4], al); b.px(cx, cy + d, c[4], al); b.px(cx, cy - d, c[4], al); }
      }
      const BT = PX.blastTex || (PX.blastTex = [0, 1, 2, 3].map((v) => { const t = new Float32Array(1024); for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) t[y * 32 + x] = PX.fbm(x / 8, y / 8, 11 + v * 5, 4, 4); return t; }));   // 4 varian tekstur fbm 32x32 yang bisa di-tile, dibake sekali
      for (const l of this.lobes) {                                                       // gumpalan: baca tekstur bake (digeser = bergolak) -> siluet tak bulat + emboss kiri-atas + ramp 5 tingkat + dither hanya di batas klaster; memudar dengan menurunkan k, bukan alpha
        const lu = (u - l.t0) / l.tl; if (lu < 0 || lu > 1) continue;
        const le = 1 - (1 - lu) * (1 - lu), al = Math.min(1, lu * 10) * Math.pow(1 - lu, 0.9), sz = l.r * R * (0.4 + 1.1 * le),
          lx = Math.round(cx + Math.cos(l.a) * l.d * R * 1.5 * le), ly = Math.round(cy + Math.sin(l.a) * l.d * R * 1.5 * le), M = Math.ceil(sz * 1.4), tx = BT[l.v], sc = 10 / sz, o = Math.floor(T * 5);
        for (let j = -M; j <= M; j++) for (let i = -M; i <= M; i++) {
          const d = Math.hypot(i, j); if (d > sz * 1.4) continue;
          const X = Math.floor(i * sc) + l.ox + o, Y = Math.floor(j * sc) + l.oy - (o >> 1), n = tx[(Y & 31) * 32 + (X & 31)], rho = d / sz + (n - 0.5) * 0.7; if (rho > 1) continue;
          const k = (1 - rho) * 0.95 + (n - 0.5) * 0.3 + (tx[((Y - 1) & 31) * 32 + ((X - 1) & 31)] - tx[((Y + 1) & 31) * 32 + ((X + 1) & 31)]) * 0.9 - lu * 0.25 - (1 - al) * 0.5;   // radial + noise + emboss; mendingin lalu menyusut mengikuti noise
          if (k < 0.04) continue; b.px(lx + i, ly + j, c[PX.tone(k, lx + i, ly + j, 5, 0.25)]);
        }
      }
      const sp = (uu) => this.spin * (1 - Math.pow(1 - Math.min(1, uu * 1.15), 3)), ez = (q) => 1 - Math.pow(1 - q, 3);   // putaran kecil (ease-out kubik); ez = lontaran ease-out
      for (const r of this.rays) {                                                        // sinar: kepala (inti) dilontarkan keluar; ekor = jejak posisi kepala beberapa saat lalu -> mengikuti inti, memendek lalu hilang saat kepala melambat
        const ru = (u - r.t0) / r.dur; if (ru < 0 || ru >= 1) continue;
        const Lm = R * r.len * 1.5, s0 = R * 0.3, q0 = Math.max(0, ru - (r.big ? 0.25 : 0.2)), al = Math.pow(1 - ru, 1.1), n = Math.ceil(Lm * (ez(ru) - ez(q0)) / 0.6);
        const pos = (q) => { const d = s0 + Lm * ez(q), g = r.a + sp(r.t0 + q * r.dur) * r.sr; return [cx + Math.cos(g) * d, cy + Math.sin(g) * d, Math.cos(g), Math.sin(g)]; };
        if (n >= 1) for (let i = 0; i <= n; i++) {
          if (rnd() < 0.04) continue; const fv = i / n, [px, py, ca, sa] = pos(q0 + (ru - q0) * fv), k = Math.min(1, (0.3 + 0.9 * fv) * al);   // terang di kepala, redup di ekor
          const col = fv > 0.8 ? c[4] : fv > 0.35 ? c[3] : c[1];
          b.px(px, py, col, k);
          if (r.big) { const w = fv > 0.55 ? 1 : fv > 0.2 ? 0.6 : 0; if (w) { const cc = fv > 0.55 ? c[3] : c[2]; b.px(px - sa, py + ca, cc, k * w); b.px(px + sa, py - ca, cc, k * w); } }   // duri utama: berbentuk komet, kepala 3 piksel meruncing ke ekor
        }
        const [tx, ty] = pos(ru); this.tips.push(tx, ty, al); if (r.big) b.px(tx, ty, c[4], al * 0.9);
      }
      for (let k = 0; k < 2; k++) {                                                       // gelombang kejut 2 lapis, radius bergelombang
        const rr = R * (k ? 0.3 + 1.2 * e : 0.4 + 1.7 * e), n = Math.ceil(rr * 6.3), aa = a * (k ? 0.55 : 0.9); if (rr < 1) continue;
        for (let i = 0; i < n; i++) {
          if (rnd() < 0.22) continue; const g = (i / n) * 6.283,
            rd = rr + rr * (Math.sin(g * 3 + this.ph[0]) * 0.07 + Math.sin(g * 5 + this.ph[1]) * 0.05 + Math.sin(g * 9 + this.ph[2]) * 0.03) + (rnd() - 0.5) * 1.4;
          b.px(cx + Math.cos(g) * (rd + 1.5), cy + Math.sin(g) * (rd + 1.5), c[1], aa); b.px(cx + Math.cos(g) * rd, cy + Math.sin(g) * rd, k ? c[2] : c[4], aa);
        }
      }
      const u2 = (u - 0.1) / 0.9;                                                         // cincin riak ketiga, tipis, lebih lambat; riaknya merambat di sepanjang cincin
      if (u2 > 0 && u2 < 1) {
        const rr = R * (0.3 + 2.6 * (1 - Math.pow(1 - u2, 3))), n = Math.ceil(rr * 6.3), a2 = Math.pow(1 - u2, 1.3) * 0.7;
        for (let i = 0; i < n; i++) { if (rnd() < 0.3) continue; const g = (i / n) * 6.283, rd = rr * (1 + Math.sin(g * 7 - T * 9 + this.ph[2]) * 0.035); b.px(cx + Math.cos(g) * rd, cy + Math.sin(g) * rd, c[2], a2); }
      }
    }
    for (const p of this.parts) { const pu = T / p.life; if (pu >= 1) continue; const col = c[Math.min(4, 4 - ((pu * 3) | 0))]; b.px(p.x, p.y, col, 1 - pu * 0.5); b.px(p.x - p.vx * 0.025, p.y - p.vy * 0.025, col, (1 - pu) * 0.4); }   // partikel + ekor
  }
};

// ---- Ledakan roket: port gaya fx.explosion (Sprite Fusion) + bigBlast (Stickman Pixel). Skala: R = radius ledakan dalam piksel kanvas.
PX.FB = ['#ffffff', '#fff3a6', '#ffe26b', '#ffc23d', '#ff8a2a', '#f2561d', '#c9281f', '#8a1f17', '#4a1712'].map(PX.hex);
PX.Rocket = class {
  constructor(x, y, R) {
    const r = Math.random, rg = (a, b) => a + r() * (b - a), z = R * 0.95; this.x = Math.round(x); this.y = Math.round(y); this.R = R; this.t = 0; this.shake = 1;
    this.rings = [{ r0: R * 0.1, r1: R * 2.7, life: 0.5, th: 1.8, c: PX.hex('#ffd84a') }, { r0: R * 0.1, r1: R * 1.9, life: 0.34, th: 1.2, c: PX.hex('#fff1a8') }];
    this.puffs = []; const puff = (px, py, vx, vy, life, size, d = 0) => this.puffs.push({ x: px, y: py, vx, vy, life, size, d, sd: r() });
    for (let i = 0; i < 5; i++) puff(x + rg(-1, 1), y + rg(-1, 1), rg(-10, 10), rg(-20, -5), rg(0.18, 0.3), rg(z * 0.8, z * 1.1));                          // inti
    for (let i = 0; i < 28; i++) { const a = r() * 6.283, e = rg(0, R * 0.55), sp = rg(20, 105); puff(x + Math.cos(a) * e, y + Math.sin(a) * e, Math.cos(a) * sp, Math.sin(a) * sp * 0.8 - 20, rg(0.55, 1), rg(z * 0.45, z * 0.9)); }   // menyebar
    for (let i = 0; i < 5; i++) puff(x + rg(-R * 0.25, R * 0.25), y, rg(-6, 6), rg(-90, -50), rg(0.7, 1), rg(z * 0.5, z * 0.7), rg(0, 0.1));              // naik
    this.smoke = Array.from({ length: 22 }, (_, i) => { const a = r() * 6.283, v = R * (1 + r() * 2), l = 1 + r() * 0.9; return { x: x + Math.cos(a) * R * 0.1, y: y + Math.sin(a) * R * 0.1, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.85 - 5, life: l, r1: 2 + r() * 3.5, hot: i < 6 }; });
    const PAL = ['#ffffff', '#fff3b0', '#ffc23a', '#ff8a1f', '#ff6a1a'].map(PX.hex);
    this.sparks = Array.from({ length: 90 }, () => { const a = r() * 6.283, v = 60 + r() * 240; return { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 50, life: 0.45 + r() * 0.85, c: PAL[(r() * 5) | 0] }; });
  }
  get done() { return this.t > 2.2; }
  step(dt) {
    this.t += dt; this.shake = Math.max(0, this.shake - dt * 3);
    for (const p of this.puffs) { p.d -= dt; if (p.d > 0) continue; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= Math.exp(-2.5 * dt); p.vy *= Math.exp(-2.5 * dt); p.vy -= 12 * dt; p.t = (p.t || 0) + dt; }
    for (const s of this.smoke) { s.x += s.vx * dt; s.y += s.vy * dt; s.vx *= Math.exp(-2.2 * dt); s.vy *= Math.exp(-2.2 * dt); }
    for (const s of this.sparks) { s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 380 * dt; }
  }
  light(L) { const u = Math.min(1, this.t / 0.7); L.glow(this.x, this.y, this.R * 3.4, [255, 176, 80], 0.6 * Math.pow(1 - u, 1.5)); if (this.t < 0.12) L.glow(this.x, this.y, this.R * 1.6, [255, 255, 255], 0.6 * (1 - this.t / 0.12)); }
  draw(b) {
    const SM = ['#7e3030', '#4a2a2a', '#2e2024', '#1a161c'].map(PX.hex), c = this.t;
    for (const s of this.smoke) {                                                           // asap: bola besar menyebar, 3 disc bergeser (tubuh + bayangan + highlight)
      const t = c / s.life; if (t >= 1 || t < 0.04) continue; const r = 1.5 + (s.r1 * 1.25 - 1.5) * (1 - (1 - t) * (1 - t)), a = Math.min(1, t * 12) * Math.min(1, (1 - t) * 2.4) * 0.6, col = s.hot && t < 0.25 ? PX.hex('#a8402a') : SM[Math.min(3, (t * 4) | 0)];
      b.disc(s.x, s.y, r, col, a * 0.45); b.disc(s.x + r * 0.05, s.y + r * 0.06, r * 0.74, col, a * 0.62); if (t < 0.5) b.disc(s.x - r * 0.22, s.y - r * 0.3, r * 0.5, SM[Math.max(0, Math.min(3, (t * 4) | 0) - 1)], a * 0.4 * (1 - t * 2));
    }
    if (c < 0.06) b.disc(this.x, this.y, this.R * 1.05, PX.FB[0], 1);                         // kilat 0.06 dtk
    for (const p of this.puffs) {                                                           // puff bola api: warna turun sepanjang ramp 9 tingkat
      if (p.d > 0) continue; const T = p.t || 0, at = T / p.life; if (at >= 1) continue;
      const et = 1 - at, it = Math.min(0.999, Math.pow(at, 0.62) + p.sd * 0.1), lt = Math.min(7, Math.floor(it * 8)), h = p.size * (0.55 + 0.45 * Math.min(1, at * 7)) * (1 - at * 0.55), FB = PX.FB;
      if (lt >= 7) b.disc(p.x, p.y, h, FB[lt], Math.min(1, et * 3) * 0.85);
      else { b.disc(p.x, p.y, h, FB[Math.min(8, lt + 2)]); b.disc(p.x - h * 0.16, p.y - h * 0.22, h * 0.78, FB[lt]); if (h > 1.6) b.disc(p.x, p.y - h * 0.9, h * 0.42, FB[lt]); if (lt <= 3 && h > 1.8) b.disc(p.x - h * 0.28, p.y - h * 0.34, h * 0.36, FB[Math.max(0, lt - 1)]); }
    }
    for (const q of this.rings) {                                                           // cincin: radius easing kubik, alpha (1-u)^1.4, tebal menyusut
      const u = c / q.life; if (u >= 1) continue; const e = 1 - Math.pow(1 - u, 3), Rc = q.r0 + (q.r1 - q.r0) * e, th = Math.max(0.9, q.th * (1 - u * 0.5)), n = Math.ceil(Rc * 6.3), al = Math.pow(1 - u, 1.4);
      for (let i = 0; i < n; i++) { const g = (i / n) * 6.283; for (let k = 0; k < th; k++) b.px(this.x + Math.cos(g) * (Rc + k), this.y + Math.sin(g) * (Rc + k), q.c, al); }
    }
    for (const s of this.sparks) { const u = c / s.life; if (u >= 1) continue; b.px(s.x, s.y, s.c, 1 - u * 0.5); b.px(s.x - s.vx * 0.02, s.y - s.vy * 0.02, s.c, (1 - u) * 0.5); }
  }
};

PX.demos.blast = (host) => {
  const W = 240, H = 135, cv = PX.canvas(host, W, H, 640), c = cv.getContext('2d'), buf = new PX.Buf(W, H), lit = new PX.Light(W, H), p = PX.pointer(cv);
  cv.style.background = '#12121c';
  let kind = 'roket', list = [], idle = 0, shake = 0;
  PX.ui(host).select('Jenis', ['roket', 'neutron'], 'roket', (v) => (kind = v));
  const boom = (x, y, k = kind) => list.push(k === 'roket' ? new PX.Rocket(x, y, 11) : new PX.Blast(x, y, 16, PX.PALS.neutron));
  PX.loop(host, (dt) => {
    for (const k of p.clicks.splice(0)) boom(k.x, k.y);
    idle -= dt; if (idle <= 0) { idle = 2; if (!p.in) boom(50 + Math.random() * 140, 40 + Math.random() * 60); }
    list = list.filter((q) => !q.done); buf.clear(); lit.clear(); shake = 0;
    for (const q of list) { q.step(dt); q.draw(buf); if (q.light) q.light(lit); else lit.glow(q.x, q.y, q.R * 3, [90, 130, 255], 0.5 * Math.pow(Math.max(0, 1 - q.t / q.life), 1.5)); if (q.shake) shake = Math.max(shake, q.shake); }
    buf.flush(c); lit.flush(c);
    cv.style.transform = shake > 0.02 ? `translate(${((Math.random() - 0.5) * 6 * shake).toFixed(1)}px,${((Math.random() - 0.5) * 6 * shake).toFixed(1)}px)` : '';
  });
};

/* 42-demo-crater.js */
// Lubang & kerusakan berbasis ELEMEN (sistem Sprite Fusion). Halaman = grid sel; tiap sel punya pemilik (elemen).
// - carve(x,y,r,irr): hapus sel dalam radius tak beraturan; tiap sel hilang menambah blok.lost.
// - Kekerasan elemen: hp = 20 + k*sqrt(luas dunia), k = 0.4 (kotak/teks) atau 0.32 (gambar). Elemen kecil rapuh, besar kokoh.
// - damageBlock: damage += dmg; retak di 30/55/80% hp; lepas jadi serpihan jatuh bila damage>=hp ATAU lost>=38% sel (jika canDetach).
// - canDetach=false untuk elemen sangat besar (luas >= 28% layar): hanya berlubang, tidak pernah copot.
PX.demos.crater = (host) => {
  const W = 240, H = 135, E = 2, cv = PX.canvas(host, W, H, 640), c = cv.getContext('2d'), p = PX.pointer(cv), rnd = PX.rng(11), R = Math.random;
  const N = W * H, img = new ImageData(W, H), back = new Uint8ClampedArray(N * 4), owner = new Int16Array(N), hole = new Uint8Array(N);
  let blocks, debris = [], heat = [], chunks = [], dmgTxt = [];
  const hash = PX.hash;
  const mul = (i, k) => { for (let j = 0; j < 3; j++) img.data[i * 4 + j] *= k; };
  const rect = (x, y, w, h, col, o, nz = 6) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) { if (i < 0 || j < 0 || i >= W || j >= H) continue; const k = j * W + i, n = (hash(i, j, 5) - 0.5) * nz; img.data.set([col[0] + n, col[1] + n, col[2] + n, 255], k * 4); owner[k] = o; } };
  function build() {
    img.data.fill(0); owner.fill(-1); hole.fill(0); debris = []; heat = []; chunks = [];
    const B = (kind, x, y, w, h, extra = {}) => ({ kind, x, y, w, h, damage: 0, lost: 0, alive: true, cells: 0, flash: 0, ...extra });
    blocks = [B('halaman', 0, 0, W, H), B('navbar', 0, 0, W, 14), B('gambar', 6, 22, 132, 70), B('kartu', 146, 22, 88, 46), B('tombol', 146, 76, 40, 14), B('tombol', 194, 76, 40, 14), B('teks', 8, 98, 150, 28), B('ikon', 170, 100, 22, 22), B('ikon', 204, 100, 28, 24)];
    blocks.forEach((b, i) => {
      const a = b.w * E * b.h * E;                                        // luas dalam satuan dunia (1 sel = E satuan)
      b.hp = 20 + (b.kind === 'gambar' ? 0.32 : 0.4) * Math.sqrt(a);
      b.canDetach = a < 0.28 * W * E * H * E;                             // elemen sangat besar tidak bisa copot
    });
    rect(0, 0, W, H, [34, 34, 52], 0, 8);
    rect(0, 0, W, 14, [58, 64, 110], 1); rect(0, 13, W, 1, [30, 34, 70], 1); rect(10, 5, 30, 4, [220, 220, 240], 1); [120, 150, 180, 210].forEach((x) => rect(x, 5, 18, 4, [150, 156, 200], 1));
    const g = blocks[2]; for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) { const t = y / g.h, k = (g.y + y) * W + g.x + x; const ridge = 38 + Math.sin(x * 0.09) * 9 + Math.sin(x * 0.23) * 4; const col = y > ridge ? [40 + (y - ridge) * 0.4, 94 - (y - ridge) * 0.3, 70] : [120 + t * 90, 160 + t * 50, 230 - t * 20]; img.data.set([...col.map((v) => PX.clamp(v + (hash(x, y, 3) - 0.5) * 8, 0, 255)), 255], k * 4); owner[k] = 2; }
    for (let y = -7; y <= 7; y++) for (let x = -7; x <= 7; x++) if (x * x + y * y <= 49) { const k = (32 + y) * W + 100 + x; img.data.set([255, 224, 120, 255], k * 4); owner[k] = 2; }
    rect(146, 22, 88, 46, [226, 222, 210], 3); rect(146, 22, 88, 8, [200, 90, 60], 3); rect(152, 36, 50, 3, [90, 86, 80], 3); for (let i = 0; i < 4; i++) rect(152, 44 + i * 5, 60 + ((i * 17) % 20), 2, [150, 146, 138], 3);
    for (const i of [4, 5]) { const b = blocks[i]; rect(b.x, b.y, b.w, b.h, i === 4 ? [255, 138, 42] : [110, 160, 255], i); rect(b.x + 4, b.y + 5, b.w - 8, 3, [255, 255, 255], i, 0); }
    rect(8, 98, 150, 28, [52, 52, 76], 6); for (let i = 0; i < 4; i++) rect(12, 102 + i * 6, 100 + ((i * 29) % 40), 2, [180, 180, 205], 6);
    rect(170, 100, 22, 22, [120, 220, 150], 7); rect(176, 106, 10, 10, [30, 90, 50], 7); rect(204, 100, 28, 24, [230, 120, 180], 8); rect(212, 108, 12, 8, [120, 30, 70], 8);
    for (let i = 0; i < N; i++) { const o = owner[i]; if (o >= 0) blocks[o].cells++; const f = 0.85; for (let j = 0; j < 3; j++) back[i * 4 + j] = 44 * f + ((hash(i % W, (i / W) | 0, 8) - 0.5) * 7) + (j === 2 ? 8 : 0); back[i * 4 + 3] = 255; }
  }
  const alive = (x, y) => x >= 0 && y >= 0 && x < W && y < H && !hole[y * W + x];
  function shade(x0, y0, x1, y1) {                                        // dinding belakang + bayangan di bawah bibir atas
    for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) {
      const i = y * W + x; if (!hole[i]) continue;
      let k = 0; for (let q = 2; q <= 5; q++) if (alive(x - ((q + 1) >> 1), y - q)) { k = q; break; }
      const s = k && k <= 2 ? 0.55 : k === 3 && 0.6 > PX.bayer(x, y) ? 0.55 : k === 4 && 0.3 > PX.bayer(x, y) ? 0.55 : 1;
      for (let j = 0; j < 3; j++) img.data[i * 4 + j] = back[i * 4 + j] * s; img.data[i * 4 + 3] = 255;
    }
  }
  function take(i, spall) {                                               // satu sel hilang (take() Sprite Fusion)
    if (hole[i]) return false; hole[i] = 1; const o = owner[i]; if (o >= 0) blocks[o].lost++;
    if (spall && debris.length < 260 && R() < 0.3) { const x = i % W, y = (i / W) | 0, a = R() * 6.283, v = 30 + R() * 90; debris.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, life: 0.5 + R() * 0.6, c: Array.from(img.data.slice(i * 4, i * 4 + 3)) }); }
    return true;
  }
  function carve(cx, cy, r, irr, spall = true) {                          // tepi tak beraturan: 3 sinus (3, 7, 13 lobus) dengan fase acak
    const X = R() * 6.28, Q = R() * 6.28, Z = R() * 6.28, K = 0.4 + R() * 0.6, K2 = 0.4 + R() * 0.6, J = r * (1 + irr * 1.6) + 1, hit = new Set(), carved = [];
    for (let y = Math.max(0, Math.floor(cy - J)); y <= Math.min(H - 1, Math.ceil(cy + J)); y++) for (let x = Math.max(0, Math.floor(cx - J)); x <= Math.min(W - 1, Math.ceil(cx + J)); x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy); if (d > J) continue;
      const a = Math.atan2(dy, dx), kt = r * (1 + irr * (K * Math.sin(3 * a + X) * 0.6 + K2 * Math.sin(7 * a + Q) * 0.4 + Math.sin(13 * a + Z) * 0.25));
      if (d <= kt) { const i = y * W + x, o = owner[i]; if (take(i, spall)) { carved.push(i); if (o >= 0) hit.add(o); } }
    }
    return { hit, carved, J };
  }
  function scorch(cx, cy, r, wid) {                                       // cincin hitam tipis + dither memudar keluar (hanya sel yang masih utuh)
    const E2 = Math.ceil(r + wid + 2);
    for (let y = Math.max(0, cy - E2); y <= Math.min(H - 1, cy + E2); y++) for (let x = Math.max(0, cx - E2); x <= Math.min(W - 1, cx + E2); x++) {
      const i = y * W + x; if (hole[i]) continue;
      let md = 99; for (let j = -3; j <= 3 && md > 1.5; j++) for (let k = -3; k <= 3; k++) if (alive(x + k, y + j) === false && x + k >= 0 && y + j >= 0 && x + k < W && y + j < H) md = Math.min(md, Math.hypot(j, k));
      if (md > wid) continue;
      if (md <= 1.5) { mul(i, 0.2); if (R() < 0.5) heat.push({ i, t: R() * 0.1 }); } else { const t = (md - 1.5) / (wid - 1.5); if (0.9 * Math.pow(1 - t, 1.15) > PX.bayer(x, y)) mul(i, 0.4); }
    }
  }
  function crack(x, y, bi, level, len) {                                  // retakan: jalan acak di dalam elemen, bercabang sesuai level
    for (let b = 0; b < level + 1; b++) { let px = x, py = y, a = R() * 6.283; for (let s = 0; s < len; s++) { a += (R() - 0.5) * 0.9; px += Math.cos(a); py += Math.sin(a); const i = Math.round(py) * W + Math.round(px); if (Math.round(px) < 0 || Math.round(py) < 0 || Math.round(px) >= W || Math.round(py) >= H) break; if (owner[i] === bi && !hole[i]) mul(i, 0.35); } }
  }
  function detach(bi, ix, iy, ex) {                                       // elemen copot: sel tersisa jadi sprite yang jatuh berputar
    const b = blocks[bi]; b.alive = false; const sp = document.createElement('canvas'); sp.width = b.w; sp.height = b.h; const sc = sp.getContext('2d'), id = sc.createImageData(b.w, b.h);
    for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) { const i = (b.y + y) * W + b.x + x; if (owner[i] === bi && !hole[i]) { id.data.set(img.data.subarray(i * 4, i * 4 + 4), (y * b.w + x) * 4); hole[i] = 1; } }
    sc.putImageData(id, 0, 0); shade(b.x - 6, b.y - 6, b.x + b.w + 6, b.y + b.h + 6);
    const area = Math.max(1, b.w * E * b.h * E), sp0 = Math.max(15, Math.min(380, 2600 / Math.sqrt(area))) / E, dx = b.x + b.w / 2 - ix, dy = b.y + b.h / 2 - iy, d = Math.hypot(dx, dy) || 1;
    chunks.push({ sp, w: b.w, h: b.h, x: b.x + b.w / 2, y: b.y + b.h / 2, vx: (dx / d) * sp0 * 1.4, vy: (dy / d) * sp0 * 1.4 - 60, a: 0, av: (R() * 3 - 1.5) * Math.min(3, 300 / Math.sqrt(area)), t: 0 });
    for (let k = 0; k < 14; k++) debris.push({ x: b.x + R() * b.w, y: b.y + R() * b.h, vx: (R() - 0.5) * 60, vy: -R() * 50, life: 0.5 + R() * 0.5, c: [200, 200, 210] });
  }
  function damageBlock(bi, dmg, ix, iy) {
    const b = blocks[bi]; if (!b || !b.alive) return;
    const u0 = b.damage / b.hp; b.damage += dmg; const u1 = b.damage / b.hp; b.flash = 0.25;
    [0.3, 0.55, 0.8].forEach((th, lv) => { if (u0 < th && u1 >= th) crack(PX.clamp(ix, b.x + 3, b.x + b.w - 3), PX.clamp(iy, b.y + 3, b.y + b.h - 3), bi, 2 + lv, Math.min(34, 5 + (Math.sqrt(b.w * b.h) * (0.2 + lv * 0.1)))); });
    if (!b.canDetach || (b.damage < b.hp && b.lost < b.cells * 0.38)) return;
    detach(bi, ix, iy);
  }
  const WEAPONS = { peluru: { r: 2.4, irr: 0.42, dmg: 14, tunnel: true }, roket: { r: 11, irr: 0.16, dmg: 90, splash: 34 }, bom: { r: 20, irr: 0.16, dmg: 170, splash: 60 } };
  let weapon = 'roket';
  function fire(x, y, wk = weapon) {
    const w = WEAPONS[wk], res = carve(x, y, w.r, w.irr), hit = res.hit;
    if (w.tunnel) {                                                       // peluru: tembus selama ada sel padat (2 lubang lanjutan makin kecil)
      const gx = 6, gy = H - 8, d = Math.hypot(x - gx, y - gy) || 1, ux = (x - gx) / d, uy = (y - gy) / d;
      for (const [j, t] of [[0.9, 0.72], [1.75, 0.5]]) { const ex = x + ux * w.r * j * 2.2, ey = y + uy * w.r * j * 2.2; if (alive(Math.floor(ex), Math.floor(ey))) { const r2 = carve(ex, ey, w.r * t, 0.5); r2.hit.forEach((o) => hit.add(o)); } }
      scorch(Math.round(x), Math.round(y), w.r, 2);
    } else scorch(Math.round(x), Math.round(y), w.r, 7);
    shade(Math.floor(x - w.r * 3), Math.floor(y - w.r * 3), Math.ceil(x + w.r * 3), Math.ceil(y + w.r * 3));
    hit.forEach((o) => damageBlock(o, w.dmg, x, y));
    if (w.splash) blocks.forEach((b, o) => { if (!b.alive || hit.has(o) || o === 0) return; const dx = Math.max(b.x - x, 0, x - (b.x + b.w)), dy = Math.max(b.y - y, 0, y - (b.y + b.h)), d = Math.hypot(dx, dy); if (d < w.splash) damageBlock(o, w.dmg * 0.7 * (1 - d / w.splash), x, y); });
    if (w.splash) for (let i = 0; i < 6; i++) { const a = R() * 6.283, v = 40 + R() * 100; debris.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, life: 0.3 + R() * 0.4, c: [255, 190 + R() * 60, 80] }); }
  }
  build();
  const ui = PX.ui(host);
  ui.select('Senjata', Object.keys(WEAPONS), 'roket', (v) => (weapon = v)); ui.button('Reset', build);
  const sx = document.createElement('canvas'); sx.width = W; sx.height = H; const sc = sx.getContext('2d'); let idle = 1, rst = 0;
  PX.loop(host, (dt) => {
    for (const k of p.clicks.splice(0)) { fire(k.x, k.y); rst = 0; }
    idle -= dt; rst += dt; if (idle <= 0 && !p.in) { idle = 1.4; const b = blocks[2 + ((R() * 7) | 0)]; if (b && b.alive) fire(b.x + R() * b.w, b.y + R() * b.h, ['peluru', 'roket', 'bom'][(R() * 3) | 0]); }
    if (rst > 22 && !p.in) { build(); rst = 0; }
    sc.putImageData(img, 0, 0); c.drawImage(sx, 0, 0);
    for (const h of heat) { h.t += dt; if (h.t < 0.75 && !hole[h.i]) { c.fillStyle = h.t < 0.3 ? '#ffb24a' : '#d9561c'; c.globalAlpha = (1 - h.t / 0.75) * 0.9; c.fillRect(h.i % W, (h.i / W) | 0, 1, 1); } }
    c.globalAlpha = 1; while (heat.length && heat[0].t > 0.75) heat.shift();
    c.imageSmoothingEnabled = false;
    for (let i = chunks.length - 1; i >= 0; i--) { const q = chunks[i]; q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 320 * dt; q.a += q.av * dt; if (q.t > 2.2 || q.y > H + 60) { chunks.splice(i, 1); continue; } c.save(); c.globalAlpha = Math.min(1, (2.2 - q.t) * 2); c.translate(Math.round(q.x), Math.round(q.y)); c.rotate(q.a); c.drawImage(q.sp, -q.w / 2, -q.h / 2); c.restore(); }
    for (let i = debris.length - 1; i >= 0; i--) { const d = debris[i]; d.x += d.vx * dt; d.y += d.vy * dt; d.vy += 260 * dt; d.life -= dt; if (d.life <= 0) { debris.splice(i, 1); continue; } c.fillStyle = PX.rgb(d.c); c.fillRect(Math.round(d.x), Math.round(d.y), 1, 1); }
    for (const b of blocks) { if (!b.alive || b.kind === 'halaman') continue; b.flash = Math.max(0, b.flash - dt); const k = Math.max(0, 1 - b.damage / b.hp);   // bar hp: terlihat saat baru kena
      if (b.damage > 0 && b.flash > 0 || (b.damage > 0 && k < 0.999)) { c.globalAlpha = b.flash > 0 ? 1 : 0.55; c.fillStyle = '#000'; c.fillRect(b.x + 1, b.y - 3 < 0 ? b.y + b.h + 1 : b.y - 3, Math.min(b.w - 2, 30) + 2, 3); c.fillStyle = k > 0.5 ? '#6dff9a' : k > 0.25 ? '#ffd24a' : '#ff5a4a'; c.fillRect(b.x + 2, b.y - 3 < 0 ? b.y + b.h + 2 : b.y - 2, Math.round(Math.min(b.w - 2, 30) * k), 1); c.globalAlpha = 1; } }
  });
};

/* 43-demo-fire.js */
// Api: partikel disc berlapis dari ramp 9 warna, inti bergeser ke atas, highlight kecil, glow additive, 45% jadi asap.
PX.demos.fire = (host) => {
  const W = 100, H = 80, cv = PX.canvas(host, W, H, 600), c = cv.getContext('2d'), buf = new PX.Buf(W, H), p = PX.pointer(cv);
  cv.style.background = '#14121c';
  const FE = ['#ffffff', '#fff3a6', '#ffe26b', '#ffc23d', '#ff8a2a', '#f2561d', '#c9281f', '#8a1f17', '#4a1712'].map(PX.hex);
  const SM = ['#7b6f72', '#5d5660', '#433d48', '#2b2630'].map(PX.hex);
  const fl = [], sm = []; let acc = 0;
  PX.loop(host, (dt, t) => {
    const bx = p.in ? p.x : W / 2 + Math.sin(t * 0.7) * 22; acc += dt * 260;
    for (; acc >= 1; acc--) fl.push({ x: bx + (Math.random() - 0.5) * 8, y: H - 8, vx: (Math.random() - 0.5) * 16, vy: -(26 + Math.random() * 30), t: 0, life: 0.45 + Math.random() * 0.45, sz: 0.5 + Math.random() * 0.6, sd: Math.random() });
    buf.clear();
    for (let i = sm.length - 1; i >= 0; i--) { const s = sm[i]; s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt; if (s.t > s.life) { sm.splice(i, 1); continue; } const u = s.t / s.life; buf.disc(s.x, s.y, 1.5 + u * 4, SM[Math.min(3, (u * 4) | 0)], 0.5 * (1 - u)); }
    for (let i = fl.length - 1; i >= 0; i--) {
      const q = fl[i]; q.t += dt; q.vy -= 40 * dt; q.vx += Math.sin(q.t * 14 + q.sd * 9) * 30 * dt; q.x += q.vx * dt; q.y += q.vy * dt;
      const u = q.t / q.life; if (u >= 1) { if (q.sd < 0.45) sm.push({ x: q.x, y: q.y, vx: q.vx * 0.3, vy: -14, t: 0, life: 0.9 }); fl.splice(i, 1); continue; }
      const it = q.sz * 1.8 * (0.55 + Math.pow(u, 0.6) * 1.9), ct = Math.min(8, Math.floor(Math.min(0.999, u * 1.12 + q.sd * 0.08) * 9));
      if (u < 0.03) { buf.disc(q.x, q.y, it * 0.95, FE[0]); continue; }
      if (ct >= 7) { buf.disc(q.x, q.y, it, FE[ct], Math.min(1, (1 - u) * 3) * 0.8); continue; }
      if (i & 1) { buf.add = true; [[it * 2.6 + 2, 0.035], [it * 1.9 + 1, 0.045], [it * 1.2 + 1, 0.06]].forEach(([r, a]) => buf.disc(q.x, q.y, r, FE[ct], a * (0.4 + 1 - u))); buf.add = false; }
      buf.disc(q.x, q.y, it, FE[Math.min(8, ct + 2)]); buf.disc(q.x - it * 0.14, q.y - it * 0.2, it * 0.76, FE[ct]);
      if (ct <= 3 && it > 1.6) buf.disc(q.x - it * 0.25, q.y - it * 0.3, it * 0.34, FE[Math.max(0, ct - 1)]);
    }
    buf.flush(c);
  });
};

/* 44-demo-neutron.js */
// Bola neutron (proyektil): bola ter-shade 5 ambang Lambert + bercak biru gelap yang ikut berputar + jejak disc memudar + percikan; mengenai target -> PX.Blast biru.
// spin = sudut putar bola (rad). Bercak = noise blok 3D pada titik permukaan yang diputar (sumbu putar miring), jadi bercak tampak berputar bersama bola.
PX.SPOT = [[14, 24, 112], [8, 13, 70]];                                // biru gelap (bercak) dan biru lebih gelap (inti bercak)
PX.drawOrb = (b, x, y, ang, R, ramp, spin = 0) => {
  const ca = Math.cos(ang), sa = Math.sin(ang), L = 18;
  for (let d = 0; d < L; d++) {                                         // jejak: disc mengecil + alpha turun
    const u = d / L, w = (1 - u) * R * 1.15 + 0.4, al = Math.pow(1 - u, 1.4) * (0.3 + Math.random() * 0.1);
    b.disc(x - ca * d, y - sa * d, w + 1.3, ramp[0], al * 0.5); b.disc(x - ca * d, y - sa * d, w, d < L * 0.4 ? ramp[2] : ramp[1], al);
  }
  b.disc(x, y, R + 2.6, ramp[1], 0.2); b.disc(x, y, R + 1.5, ramp[2], 0.32);
  const ox = Math.round(x), oy = Math.round(y), Ri = Math.ceil(R), cs = Math.cos(spin), ss = Math.sin(spin), TC = 0.9, TS = 0.44;   // TC/TS: kemiringan sumbu putar
  for (let j = -Ri; j <= Ri; j++) for (let i = -Ri; i <= Ri; i++) {
    const d2 = i * i + j * j; if (d2 > R * R) continue;
    const nx = i / R, ny = j / R, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny)), l = Math.max(0, nx * -0.4 + ny * -0.5 + nz * 0.77);
    let col = l < 0.2 ? ramp[0] : l < 0.45 ? ramp[1] : l < 0.7 ? ramp[2] : l < 0.9 ? ramp[3] : ramp[4];
    if (d2 > (R - 1) * (R - 1) && l < 0.7) col = ramp[2];              // tepi lebih terang agar siluet terbaca
    else {                                                              // bercak: putar titik permukaan (spin), miringkan sumbu, ambil noise blok 3D
      const rx = nx * cs + nz * ss, rz = -nx * ss + nz * cs, qy = ny * TC - rz * TS, qz = ny * TS + rz * TC;
      const h = PX.hash(Math.floor(rx * 1.8 + 8), Math.floor(qy * 1.8 + 8), Math.floor(qz * 1.8 + 8) + 31);
      if (h > 0.8) col = PX.SPOT[1]; else if (h > 0.6) col = PX.SPOT[0];
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
      PX.drawOrb(buf, o.x, o.y, o.a, 3.3 * (1 + Math.sin(t * 40) * 0.06), ramp, o.t * SPIN); lit.glow(o.x, o.y, 12, ramp[1], 0.22); lit.glow(o.x - Math.cos(o.a) * 7, o.y - Math.sin(o.a) * 7, 9, ramp[1], 0.22);
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

/* 45-demo-pulsar.js */
// Pulsar (bintang neutron): bola bernoise + 2 sinar + garis medan dipol. Sumbu TIDAK berputar penuh: berayun cepat ±22.5° (total 45°) di sekitar sumbu miring.
// Efek: halo cahaya berdenyut, dash yang mengalir di garis medan, cincin + percikan di ujung ayunan, bintang latar berkedip. Semua per-piksel, ramp 6 warna + Bayer.
PX.demos.pulsar = (host) => {
  const W = 128, H = 72, cv = PX.canvas(host, W, H, 640), c = cv.getContext('2d'), img = c.createImageData(W, H), lit = new PX.Light(W, H);
  cv.style.background = '#0a0a16';
  const V = ['#241a66', '#2f3cb4', '#4f7bff', '#8fcbff', '#dff2ff', '#ffffff'].map(PX.hex), CX = W / 2, CY = H / 2, R = 9;
  const BASE = -0.72, SWING = Math.PI / 8, FREQ = 8.5, SNAP = 1.7;               // sumbu miring, amplitudo 22.5°, ayunan cepat (periode ≈ 0.74 s), SNAP: makin besar makin tajam di ujung
  const NORM = Math.tanh(SNAP), sparks = [], rings = []; let prevCos = 1;
  const SPIN = 10, AXT = 0.35, TW = 64, TH = 32, TEX = new Float32Array(TW * TH), CA_ = Math.cos(AXT), SA_ = Math.sin(AXT);   // SPIN: rad/s putaran bola (≈1.6 putaran/detik), AXT: kemiringan sumbu putar
  for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {                       // bake SEKALI: peta lon/lat (tile di lon). fbm besar + kontras -> bercak gelap & titik panas yang jelas saat berputar
    const f = PX.fbm(x / 8, y / 8, 21, TW / 8, 0, 3), hot = PX.fbm(x / 5, y / 5, 47, TW / 5 | 0, 0, 2);
    TEX[y * TW + x] = PX.clamp((f - 0.5) * 2.6 + 0.5 - Math.max(0, hot - 0.62) * 1.6 + Math.max(0, 0.3 - hot) * 1.4, 0, 1);
  }
  const put = (x, y, ci) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 4, k = V[ci]; img.data[i] = k[0]; img.data[i + 1] = k[1]; img.data[i + 2] = k[2]; img.data[i + 3] = 255; };
  PX.loop(host, (dt, t) => {
    img.data.fill(0); lit.clear();
    const sw = Math.tanh(SNAP * Math.sin(t * FREQ)) / NORM, th = BASE + SWING * sw, ca = Math.cos(th), sa = Math.sin(th), tilt = 0.7 + 0.3 * Math.abs(Math.cos(t * 0.6)), Lb = 56 * tilt;
    const speed = Math.abs(Math.cos(t * FREQ)), pulse = 0.5 + 0.5 * Math.sin(t * 5);   // speed: 1 saat menyapu cepat, 0 di ujung ayunan
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
    for (let i = rings.length - 1; i >= 0; i--) {                                    // cincin kejut dari bola
      const q = rings[i]; q.t += dt; const u = q.t / 0.7; if (u >= 1) { rings.splice(i, 1); continue; }
      const r = R + 2 + u * 44, n = Math.round(r * 5);
      for (let k = 0; k < n; k++) { const g = (k / n) * 6.283; if (PX.hash(k, Math.floor(q.t * 30), 9) < 0.7 - u * 0.5) put(CX + Math.cos(g) * r, CY + Math.sin(g) * r, u < 0.3 ? 3 : u < 0.6 ? 2 : 1); }
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {                        // sinar
      const dx = x + 0.5 - CX, dy = y + 0.5 - CY, u = Math.abs(dx * ca + dy * sa), v = -dx * sa + dy * ca;
      if (u < R * 0.8 || u > Lb) continue;
      const w = 1.5 + u * 0.1, prof = Math.max(0, 1 - Math.abs(v) / w), I = (1 - u / Lb) * Math.pow(prof, 0.8) * (0.85 + 0.15 * Math.sin(u * 0.6 - t * 30));   // denyut kecil mengalir sepanjang sinar
      if (I > PX.bayer(x, y) * 0.9) put(x, y, Math.min(5, Math.floor(I * 6)));
    }
    [16, 25, 36].forEach((s0, si) => {                                               // garis medan dipol: r = s·cos²λ, ikut berayun; dash mengalir di sepanjang garis
      const s = s0 * (1 + 0.05 * Math.sin(t * 6 + si)), dir = si % 2 ? -1 : 1;
      for (let k = -90; k <= 90; k += 1) {
        const lam = (k * Math.PI) / 180, r = s * Math.cos(lam) ** 2, al = r * Math.sin(lam), pe = r * Math.cos(lam), m = (((k + 90 + dir * t * 70) % 36) + 36) % 36;
        if (m > 14) continue;
        for (const side of [-1, 1]) { const px = CX + ca * al - sa * pe * side, py = CY + sa * al + ca * pe * side; if (PX.hash(Math.round(px), Math.round(py), 5) < 0.8) put(px, py, m < 3 ? 4 : m < 7 ? 3 : 2); }
      }
    });
    for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) {                    // bola
      const nx = x / R, ny = y / R, r2 = nx * nx + ny * ny; if (r2 > 1) continue;
      const nz = Math.sqrt(1 - r2), l = Math.max(0, nx * -0.45 + ny * -0.5 + nz * 0.75), X = x + CX | 0, Y = y + CY | 0;
      const ax = nx * CA_ + ny * SA_, ay = -nx * SA_ + ny * CA_, lon = Math.atan2(ax, nz) + t * SPIN, lat = Math.asin(PX.clamp(ay, -1, 1));   // pemetaan terbalik: piksel -> titik bola (sumbu miring) -> lon/lat
      const tu = (((lon / 6.2832) % 1) + 1) % 1, tx = (tu * TW) | 0, ty = PX.clamp(((lat / Math.PI + 0.5) * TH) | 0, 0, TH - 1);
      const k = PX.clamp(0.08 + 0.5 * l + (TEX[ty * TW + tx] - 0.5) * 0.6 + (r2 > 0.75 ? 0.08 : 0), 0, 1);   // cahaya tetap, tekstur berputar
      put(X, Y, PX.tone(k, X, Y, 6, 0.3));
    }
    for (let i = sparks.length - 1; i >= 0; i--) {                                   // percikan dari ujung sinar
      const s = sparks[i]; s.life -= dt; if (s.life <= 0) { sparks.splice(i, 1); continue; }
      s.x += s.vx * dt; s.y += s.vy * dt; s.vx *= 1 - 1.5 * dt; s.vy *= 1 - 1.5 * dt; put(s.x, s.y, s.life > s.m * 0.6 ? 5 : s.life > s.m * 0.3 ? 3 : 2);
    }
    lit.glow(CX, CY, 26 + 4 * pulse, V[1], 0.3 + 0.12 * pulse);   // cahaya: halo bintang + titik terang sepanjang sinar (lebih terang saat menyapu cepat)
    for (const sg of [-1, 1]) { lit.glow(CX + ca * sg * Lb * 0.35, CY + sa * sg * Lb * 0.35, 16, V[3], 0.14 + 0.16 * speed); lit.glow(CX + ca * sg * Lb * 0.75, CY + sa * sg * Lb * 0.75, 10, V[2], 0.1 + 0.12 * speed); }
    c.putImageData(img, 0, 0); lit.flush(c);
  });
};

/* 46-demo-char.js */
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

/* 47-demo-rain.js */
// Hujan prosedural 3 lapis kedalaman: kecepatan/panjang/warna beda per lapis, kabut tanah ber-noise + Bayer,
// percikan setengah elips yang melebar, serpihan air berparabola, tanah tak rata (ground = fungsi x), stop() bertahap.
// Urutan gambar: latar + tanah -> drawBack (tetes jauh/tengah, kabut, percikan) -> karakter -> drawFront (tetes dekat).
PX.noise1 = (x, s = 0) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f), a = PX.hash(i, 0, s), b = PX.hash(i + 1, 0, s); return (a + (b - a) * u) * 2 - 1; };

PX.Rain = class {
  constructor({ w = 160, ground = 76, density = 1, slant = -0.22, seed = 1 } = {}) {
    this.w = w; this.gy = typeof ground === 'function' ? ground : () => ground;   // ground: angka, atau fungsi x -> y permukaan tanah
    this.G = 0; for (let x = 0; x < w; x++) this.G = Math.max(this.G, this.gy(x));
    this.slant = slant; this.t = 0; this.stopped = false; this.R = PX.rng(seed);
    this.C = { far: '#38446e', farH: '#56659a', mid: '#5f74ab', midH: '#9ab0e0', near: '#6f86bd', nearH: '#d6e5ff', mist: '#4b5a8c' };
    for (const k in this.C) this.C[k] = PX.hex(this.C[k]);
    this.SPEED = [380, 525, 725]; this.LEN = [3, 6, 12];
    const m = Math.abs(slant) * (this.G + 110) + 10;      // margin spawn mendatar: sebaran tetap merata untuk kemiringan apa pun
    this.x0 = slant > 0 ? -m : 0; this.x1 = w + (slant < 0 ? m : 0);
    this.drops = []; this.splashes = []; this.bits = [];
    [[0, 120], [1, 64], [2, 20]].forEach(([layer, n]) => { for (let i = 0; i < Math.round(n * density); i++) { const d = { layer }; this.reset(d, false); this.drops.push(d); } });
  }
  rg(a, b) { return a + (b - a) * this.R(); }
  reset(d, top) {
    d.x = this.rg(this.x0, this.x1);
    const g = this.gy(d.x);
    d.y = top ? -this.rg(0, 100) : this.rg(-100, g);
    d.sp = this.SPEED[d.layer] * this.rg(0.9, 1.1);
    d.stop = g - this.rg(5, 70);                          // lapis jauh berhenti di udara = ilusi kedalaman
  }
  again(i) { if (this.stopped) this.drops.splice(i, 1); else this.reset(this.drops[i], true); }
  stop() { this.stopped = true; }                         // tetes tidak direspawn -> hujan reda bertahap
  get done() { return this.stopped && !this.drops.length && !this.bits.length; }
  update(dt) {
    this.t += dt;
    const L = Math.hypot(this.slant, 1), ux = this.slant / L, uy = 1 / L;
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i]; d.x += ux * d.sp * dt; d.y += uy * d.sp * dt;
      const g = this.gy(d.x);
      if (d.layer === 0 && d.y > d.stop) this.again(i);
      else if (d.y >= g) {
        if (d.x > -10 && d.x < this.w + 10) {
          if (d.layer === 2 || this.R() < 0.6) this.splashes.push({ x: d.x, t: this.t });
          for (let k = 0, n = d.layer === 2 ? 3 : Math.floor(this.rg(0, 2.99)); k < n; k++) this.bits.push({ x: d.x, y: g - 1, vx: this.rg(-45, 35), vy: -this.rg(55, 115), life: this.rg(0.18, 0.32) });
        }
        this.again(i);
      }
    }
    for (let i = this.bits.length - 1; i >= 0; i--) { const b = this.bits[i]; b.life -= dt; b.vy += 950 * dt; b.x += b.vx * dt; b.y += b.vy * dt; if (b.life <= 0 || b.y > this.gy(b.x)) this.bits.splice(i, 1); }
    this.splashes = this.splashes.filter((s) => this.t - s.t <= 0.4);
  }
  dot(buf, x, y, c, a = 1) { const px = Math.floor(x), py = Math.floor(y); if (a >= 1 || a > PX.bayer(px, py)) buf.px(px, py, c); }   // alpha -> dither
  line(buf, x0, y0, x1, y1, c) { const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)))); for (let i = 0; i <= n; i++) buf.px(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c); }
  splash(buf, cx, cy, rx, ry, c, a) {                     // setengah elips bawah garis tanah, 3 lintasan radius -> tebal ~1 piksel
    const n = Math.ceil(Math.max(rx, ry) * Math.PI * 2 * 1.3);
    for (let j = 0; j < n; j++) {
      const ang = (j / n) * Math.PI * 2, ca = Math.cos(ang), sa = Math.sin(ang);
      if (sa < -0.2) continue;
      for (let o = -0.5; o <= 0.5; o += 0.5) this.dot(buf, cx + ca * (rx + o), cy + sa * (ry + o * (ry / Math.max(1, rx))), c, a);
    }
  }
  layer(buf, k) {
    const L = Math.hypot(this.slant, 1), ux = this.slant / L, uy = 1 / L, len = this.LEN[k], body = [this.C.far, this.C.mid, this.C.near][k], head = [this.C.farH, this.C.midH, this.C.nearH][k];
    for (const d of this.drops) if (d.layer === k) {      // tetes = ekor gelap (60%) + kepala terang (40%)
      this.line(buf, d.x - ux * len, d.y - uy * len, d.x - ux * len * 0.4, d.y - uy * len * 0.4, body);
      this.line(buf, d.x - ux * len * 0.4, d.y - uy * len * 0.4, d.x, d.y, head);
    }
  }
  drawBack(buf) {
    this.layer(buf, 0); this.layer(buf, 1);
    const t = this.t;
    for (let x = 0; x < this.w; x++) {                    // kabut tanah mengikuti kontur tanah
      const fy = Math.round(this.gy(x)), m = (PX.noise1(x * 0.06 + t * 0.5, 3) + PX.noise1(x * 0.15 - t * 0.8, 4) * 0.5 + 1) / 2.5;
      if (PX.hash(x, Math.floor(t * 8)) < 0.04) this.dot(buf, x, fy, this.C.midH);
      for (let r = 0; r < 9; r++) this.dot(buf, x, fy - r, this.C.mist, m * 0.32 * (1 - r / 9));
    }
    for (const s of this.splashes) { const u = (t - s.t) / 0.4, rx = 1 + 5 * Math.sqrt(u); this.splash(buf, s.x, this.gy(s.x), rx, rx * 0.25, u < 0.3 ? this.C.midH : this.C.mid, 1 - u); }
    for (const b of this.bits) this.dot(buf, b.x, b.y, this.C.nearH);
  }
  drawFront(buf) { this.layer(buf, 2); }
};

PX.demos.rain = (host) => {
  const W = 160, H = 90, cv = PX.canvas(host, W, H, 640, false, 'Urutan gambar: latar + tanah → hujan belakang (tetes jauh/tengah, kabut, percikan) → karakter → hujan depan.'), c = cv.getContext('2d');
  const gy = (x) => 72 + Math.round(2.5 * Math.sin(x * 0.045) + 1.5 * Math.sin(x * 0.11 + 1.3));   // tanah tak rata
  const mk = () => { const e = document.createElement('canvas'); e.width = W; e.height = H; return e; }, bg = mk(), ch = mk(), oc = mk(), o = oc.getContext('2d');
  { // latar statis: langit dither, dua lapis bukit, tanah
    const b = new PX.Buf(W, H), hill = (x, a, p, q) => a + Math.round(6 * Math.sin(x * p + q) + 3 * Math.sin(x * p * 3));
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let col = Math.min(1, y / (H * 0.85)) > PX.bayer(x, y) ? [38, 50, 92] : [14, 18, 40];
      if (y >= hill(x, 58, 0.03, 1)) col = [24, 30, 62];
      if (y >= hill(x, 66, 0.05, 2)) col = [20, 26, 54];
      const g = gy(x);
      if (y >= g) col = y === g ? [58, 69, 111] : PX.hash(x, y) < 0.08 ? [34, 40, 66] : [27, 32, 54];
      b.px(x, y, col, 1);
    }
    b.flush(bg.getContext('2d'));
  }
  { // karakter berjubah memakai PX.drawSprite (outline + bayangan)
    const cloak = PX.fromAscii(['..cccc..', '.cccccc.', '.cefecc.', '.cffffc.', '..cccc..', '.cccccc.', 'cccccccc', 'cccccccc', 'cccccccc', 'cccccccc', 'cccccccc', '.cc..cc.', '.bb..bb.'],
      { c: { col: [58, 64, 104] }, f: { col: [40, 44, 70] }, e: { col: [143, 243, 255] }, b: { col: [34, 36, 58] } });
    const b = new PX.Buf(W, H); PX.drawSprite(b, cloak, 76 - 4, gy(76) - cloak.h + 1, { outline: [14, 12, 28], shadow: 0.28 }); b.flush(ch.getContext('2d'));
  }
  const back = new PX.Buf(W, H), front = new PX.Buf(W, H), opt = { density: 1, slant: -0.22 };
  let rain, btn;
  const rebuild = () => { rain = new PX.Rain({ w: W, ground: gy, ...opt }); if (btn) btn.textContent = 'Hentikan hujan'; };
  rebuild();
  const ui = PX.ui(host);
  ui.range('Kepadatan', 0.5, 2.5, 0.5, 1, (v) => { opt.density = v; rebuild(); });
  ui.select('Kemiringan', [{ label: 'miring kiri', value: -0.22 }, { label: 'tegak', value: 0 }, { label: 'miring kanan', value: 0.3 }], -0.22, (v) => { opt.slant = +v; rebuild(); });
  btn = ui.button('Hentikan hujan', () => { if (rain.stopped) rebuild(); else { rain.stop(); btn.textContent = 'Mulai hujan'; } });
  const flush = (b) => { b.flush(o); c.drawImage(oc, 0, 0); };
  PX.loop(host, (dt) => {
    rain.update(dt); back.clear(); front.clear(); rain.drawBack(back); rain.drawFront(front);
    c.drawImage(bg, 0, 0); flush(back); c.drawImage(ch, 0, 0); flush(front);
  });
};

/* 48-demo-glow.js */
// Demo glow: kursor = sumber cahaya. Cahaya ditambahkan (additive) di buffer terpisah, lalu ditimpakan 'lighter' di atas adegan.
PX.demos.glow = (host) => {
  const W = 240, H = 135, cv = PX.canvas(host, W, H, 640), c = cv.getContext('2d'), buf = new PX.Buf(W, H), lit = new PX.Light(W, H), p = PX.pointer(cv);
  let R = 40, K = 0.8, prof = 2, col = PX.hex('#ffb050'); const flashes = [];
  const ui = PX.ui(host);
  ui.range('Radius', 10, 80, 2, R, (v) => (R = v)); ui.range('Intensitas', 0.2, 1.5, 0.1, K, (v) => (K = v));
  ui.select('Profil', [{ label: 'kuadrat (1-d)²', value: 2 }, { label: 'linear (1-d)', value: 1 }, { label: 'datar', value: 0 }], 2, (v) => (prof = +v));
  ui.select('Warna', [{ label: 'api', value: '#ffb050' }, { label: 'neutron', value: '#6f95ff' }, { label: 'hijau', value: '#6dff9a' }], '#ffb050', (v) => (col = PX.hex(v)));
  const tiles = []; for (let i = 0; i < 40; i++) tiles.push({ x: (PX.hash(i, 1) * 220) | 0, y: 20 + ((PX.hash(i, 2) * 100) | 0), w: 8 + ((PX.hash(i, 3) * 20) | 0), h: 6 + ((PX.hash(i, 4) * 14) | 0) });
  PX.loop(host, (dt, t) => {
    for (const k of p.clicks.splice(0)) flashes.push({ x: k.x, y: k.y, t: 0 });
    buf.clear(); lit.clear();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) buf.px(x, y, ((x >> 3) + (y >> 3)) & 1 ? [28, 28, 40] : [24, 24, 34]);
    for (const q of tiles) for (let y = 0; y < q.h; y++) for (let x = 0; x < q.w; x++) buf.px(q.x + x, q.y + y, y === 0 ? [92, 92, 120] : [60, 60, 84]);   // blok adegan: tepi atas lebih terang
    const lx = p.in ? p.x : W / 2 + Math.cos(t) * 70, ly = p.in ? p.y : H / 2 + Math.sin(t * 1.3) * 30;
    lit.glow(lx, ly, R, col, K, prof);
    for (let i = flashes.length - 1; i >= 0; i--) { const f = flashes[i]; f.t += dt; const u = f.t / 0.5; if (u >= 1) { flashes.splice(i, 1); continue; } lit.glow(f.x, f.y, 30 + 40 * u, [255, 255, 255], 1.2 * (1 - u), 2); }
    buf.disc(lx, ly, 2, [255, 255, 255]);
    buf.flush(c); lit.flush(c);
  });
};

/* 49-demo-texture.js */
// Demo texturing: bake 1 tile ke indeks palet, tampilkan 3x3 untuk mengecek tile. Ganti material, mode dither, ukuran tile, kekuatan emboss.
PX.demos.texture = (host) => {
  let mat = 'stone', dither = 'cluster', S = 32, emb = 0.5, seed = 1, tile;
  const cv = PX.canvas(host, 96, 96, 480, false, '3×3 tile — garis sambungan tidak boleh terlihat'), c = cv.getContext('2d'), ui = PX.ui(host);
  const bake = () => { tile = PX.texCanvas(PX.bakeTex(mat, S, { dither, emb, seed })); draw(); };
  const draw = () => { c.clearRect(0, 0, 96, 96); c.imageSmoothingEnabled = false; for (let j = 0; j < 96 / S; j++) for (let i = 0; i < 96 / S; i++) c.drawImage(tile, i * S, j * S); };
  ui.select('Material', ['stone', 'grass', 'wood', 'brick', 'lava'], mat, (v) => { mat = v; bake(); });
  ui.select('Dither', [{ label: 'klaster + dither di batas', value: 'cluster' }, { label: 'dither penuh (noisy)', value: 'full' }, { label: 'tanpa dither (banding)', value: 'none' }], dither, (v) => { dither = v; bake(); });
  ui.select('Tile', ['16', '32'], String(S), (v) => { S = +v; bake(); });
  ui.range('Emboss', 0, 1.2, 0.1, emb, (v) => { emb = v; bake(); });
  ui.button('Seed baru', () => { seed = (seed * 7 + 3) % 97; bake(); });
  bake();
};

/* 50-demo-blackhole.js */
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

/* 51-demo-water.js */
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

/* 52-demo-fluid.js */
// Demo fluida: permukaan berpegas + benda berapung/tenggelam (Archimedes sederhana) + percikan + gelembung. Klik = jatuhkan batu.
PX.demos.fluid = (host) => {
  const W = 160, H = 90, TOP = 30, FLOOR = 82, cv = PX.canvas(host, W, H, 800), c = cv.getContext('2d'), buf = new PX.Buf(W, H), lit = new PX.Light(W, H), p = PX.pointer(cv);
  const wat = new PX.Water(0, W, TOP, FLOOR), sc = PX.poolScene(W, H, TOP, () => FLOOR), surf = new PX.Surface(W, TOP), R = PX.rng(5), rg = (a, b) => a + (b - a) * R();
  const objs = [], drops = []; let t = 0, rho = 1.6, caus = true;
  const sy = (x) => surf.y(x) + Math.sin(x * 0.11 + t * 1.6) * 0.4 + Math.sin(x * 0.043 - t * 0.9) * 0.5;      // permukaan = simulasi + ombak halus
  const bub = new PX.Bubbles({ x0: 0, x1: W, top: TOP, ground: () => FLOOR, surfY: sy, density: 0.7, seed: 2 });
  const foam = new PX.Foam(W), ui = PX.ui(host);
  ui.range('Massa jenis benda', 0.4, 2.5, 0.1, rho, (v) => (rho = v)); ui.check('Caustic', true, (v) => (caus = v));
  ui.button('Hujan batu', () => { for (let i = 0; i < 6; i++) drop(rg(10, W - 10), -i * 12); });
  const drop = (x, y) => { objs.push({ x, y, vx: rg(-8, 8), vy: 0, r: rg(2, 4), rho, wet: false }); if (objs.length > 14) objs.shift(); };
  const spray = (x, y, speed, r) => { const n = Math.min(14, Math.floor(speed * r * 0.05)); for (let i = 0; i < n; i++) drops.push({ x: x + rg(-r, r), y, vx: rg(-30, 30), vy: -(40 + rg(0.2, 0.7) * speed) }); };
  PX.loop(host, (dt) => {
    t += dt; for (const k of p.clicks.splice(0)) drop(k.x, 2);
    for (const o of objs) {
      const s = sy(o.x), sub = PX.clamp((o.y + o.r - s) / (2 * o.r), 0, 1);                                  // fraksi tercelup 0..1
      o.vy += 150 * (1 - sub / o.rho) * dt;                                                                    // gravitasi - gaya apung (∝ tercelup / massa jenis)
      o.vy -= o.vy * 2.2 * sub * dt; o.vx -= o.vx * 1.5 * sub * dt; o.x += o.vx * dt; o.y += o.vy * dt;        // hambatan hanya saat tercelup
      if (o.y + o.r > FLOOR) { o.y = FLOOR - o.r; o.vy *= -0.2; o.vx *= 0.5; }
      if (!o.wet && sub > 0) { o.wet = true; surf.splash(o.x, -Math.min(3, o.vy * o.r * 0.004)); spray(o.x, s, Math.abs(o.vy), o.r); foam.add(o.x, Math.min(1, Math.abs(o.vy) * o.r * 0.004), 3); for (let n = Math.min(16, Math.floor(Math.abs(o.vy) * o.r * 0.06)); n > 0; n--) bub.add(o.x + rg(-o.r, o.r), s + rg(3, 3 + 2 * o.r), rg(0.4, 0.8)); }   // masuk air: tekan permukaan + percikan
      if (sub === 0) o.wet = false;
      if (sub > 0.5 && Math.hypot(o.vx, o.vy) > 30 && R() < dt * 12) bub.add(o.x + rg(-1, 1), o.y - o.r * 0.5, rg(0.6, 1.4));
      if (sub > 0.3 && Math.hypot(o.vx, o.vy) > 15 && R() < dt * 30) bub.add(o.x + rg(-o.r, o.r), o.y + rg(-o.r, o.r), rg(0.4, 0.8));   // titik-titik gelembung mikro   // jejak gelembung
    }
    for (let i = drops.length - 1; i >= 0; i--) { const d = drops[i]; d.vy += 220 * dt; d.x += d.vx * dt; d.y += d.vy * dt; if (d.vy > 0 && d.y >= sy(d.x)) { surf.splash(d.x, -0.25); foam.add(d.x, 0.15, 1); if (R() < 0.35) bub.add(d.x, sy(d.x) + rg(2, 5), rg(0.4, 0.7)); drops.splice(i, 1); } }   // tetes jatuh -> riak kecil
    surf.update(dt); bub.update(dt); foam.update(dt);
    lit.clear(); wat.compose(buf, sc.sky, sc.under, sy);
    for (const o of objs) { buf.disc(o.x, o.y, o.r, [58, 52, 78]); buf.disc(o.x - 0.5, o.y - 0.5, o.r - 1, [110, 106, 128]); buf.px(o.x - o.r * 0.4, o.y - o.r * 0.4, [207, 205, 210]); }
    wat.tint(buf, sy); wat.snow(buf, t); bub.draw(buf, lit, 'back'); wat.surface(buf, lit, t, sy); foam.draw(buf, sy); bub.draw(buf, lit, 'front');
    for (const d of drops) { buf.px(d.x, d.y, PX.WATER.HI); buf.px(d.x - d.vx * 0.02, d.y - d.vy * 0.02, PX.WATER.LIT); }
    if (caus) wat.caustics(lit, t);
    buf.flush(c); lit.flush(c);
  });
};

/* 53-demo-waterca.js */
// Demo air sel hibrida: badan air = sel (mengalir + penyamaan tinggi / bejana berhubungan), muka air = pegas 1D (gelombang), tumbukan -> percikan + busa + gelembung mikro. Alat 'aduk' = mengobok air.
PX.demos.waterca = (host) => {
  const W = 128, H = 72, FL = H - 2, cv = PX.canvas(host, W, H, 768, false, 'Seret di atas kanvas untuk memakai alat'), c = cv.getContext('2d'), buf = new PX.Buf(W, H), p = PX.pointer(cv);
  const sim = new PX.CAWater(W, H), g = sim.g, lit = new PX.Light(W, H), wat = new PX.Water(0, W, 0, FL), sc = PX.poolScene(W, H, H * 0.45, () => FL), P = PX.WATER;
  const surf = new PX.Surface(W, 0), foam = new PX.Foam(W), R = PX.rng(11), rg = (a, b) => a + (b - a) * R();
  const STONE = ['#2b2a3a', '#4a4a5e', '#6e6f80'].map(PX.hex), TA = [0.1, 0.18, 0.26, 0.34];
  const top = new Int16Array(W).fill(-1), y0 = new Int16Array(W).fill(-1), dp = new Uint16Array(W), drops = [], cool = new Float32Array((W >> 2) + 1);     // top = muka air efektif (-1 = kolom tanpa muka air), y0 = muka sel mentah
  const inW = (x, y) => x >= 0 && y >= 0 && x < W && y < H && g[y * W + x] === 1 && !(top[x] >= 0 && y < top[x]);
  const spray = (x, y, v, n) => { for (let i = 0; i < n && drops.length < 400; i++) drops.push({ x: x + rg(-1.5, 1.5), y: y - 1, vx: rg(-30, 30), vy: -(30 + rg(0.3, 1) * Math.min(70, v * 3)) }); };
  const fizz = new PX.Fizz(inW, (x) => { surf.splash(x, -0.05); foam.add(x, 0.1, 1); if (R() < 0.4) spray(x, top[x] >= 0 ? top[x] : 0, 4, 1); });
  let tool = 'water', faucet = true, caus = true, t = 0, px0 = 0, py0 = 0, fx = 40, fq = 4;
  const box = (x0, x1, y0, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y * W + x] = 2; };
  const build = (layout) => { g.fill(0); sim.fall.fill(0); drops.length = 0; fizz.list.length = 0; surf.h.fill(0); surf.v.fill(0); foam.f.fill(0); fx = 40;
    box(0, W - 1, H - 2, H - 1); box(0, 0, 0, H - 1); box(W - 1, W - 1, 0, H - 1);
    if (layout === 'vessels') {                                                                                // 5 bejana beda lebar, tersambung saluran di bawah (sekat berhenti di y=66); A penuh, sisanya kosong
      box(97, 97, 0, H - 1); box(W - 1, W - 1, 0, H - 1); box(7, 8, 4, 66); box(29, 30, 26, 66); box(43, 44, 18, 66); box(75, 76, 34, 66); fx = 14;
      for (let y = 6; y < FL; y++) for (let x = 1; x <= 6; x++) g[y * W + x] = 1;
    } else { box(24, 71, 44, 45); box(90, 91, 30, 45); } };
  const ui = PX.ui(host);
  ui.select('Alat', [{ label: 'tuang air', value: 'water' }, { label: 'aduk', value: 'stir' }, { label: 'tembok', value: 'wall' }, { label: 'hapus', value: 'erase' }], tool, (v) => (tool = v));
  ui.range('Aliran samping', 1, 8, 1, sim.flow, (v) => (sim.flow = v)); ui.range('Penyamaan tinggi', 0, 12, 1, sim.lvRate, (v) => (sim.lvRate = v)); ui.range('Debit keran', 1, 4, 1, fq, (v) => (fq = v));
  const fc = ui.check('Keran', true, (v) => (faucet = v)); ui.check('Caustic', true, (v) => (caus = v));
  ui.button('Reset', () => build()); ui.button('Bejana berhubungan', () => { build('vessels'); faucet = fc.checked = false; });
  build();
  const impacts = () => {                                                                                       // sel jatuh mendarat -> gelombang, busa, gelembung terseret, percikan
    for (const e of sim.ev) {
      const sp = Math.min(40, e.v), k = e.x >> 2; if (t - cool[k] < 0.12) continue; cool[k] = t;                    // jeda per ~4 kolom: aliran utuh tidak memicu semburan tiap sel
      if (e.water) { surf.splash(e.x, -Math.min(2.2, sp * 0.06)); foam.add(e.x, Math.min(1, sp * 0.04), 3); fizz.burst(e.x, e.y + 2, Math.min(6, 1 + ((sp * 0.15) | 0)), 3, 24); }
      spray(e.x, e.y, sp, Math.min(e.water ? 5 : 3, 1 + ((sp * 0.12) | 0)));
    }
    sim.ev.length = 0;
  };
  const surface = () => {                                                                                       // muka air per kolom: sel teratas yang ditopang, dihaluskan, lalu digeser gelombang pegas
    for (let x = 0; x < W; x++) { y0[x] = top[x] = -1; let y = 0; while (y < H && g[y * W + x] === 0) y++; if (y < H - 1 && g[y * W + x] === 1 && g[(y + 1) * W + x] !== 0) y0[x] = y; }
    for (let x = 0; x < W; x++) {
      const a = y0[x]; if (a < 0) continue;
      const l = x > 0 && y0[x - 1] >= 0 ? y0[x - 1] : a, r = x < W - 1 && y0[x + 1] >= 0 ? y0[x + 1] : a;
      let ty = Math.round(PX.clamp(PX.clamp((l + 2 * a + r) / 4, a - 1, a + 1) - PX.clamp(surf.h[x] * 1.3, -3, 3), a - 3, a + 3));
      while (ty > a && g[ty * W + x] !== 1) ty--; while (ty < a && g[ty * W + x] !== 0) ty++;                      // lembah hanya memotong sel air, puncak hanya mengisi sel kosong
      top[x] = ty;
    }
  };
  PX.loop(host, (dt) => {
    t += dt; const mx = p.x | 0, my = p.y | 0, sp = Math.hypot(mx - px0, my - py0);
    if (p.down && p.in) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const x = mx + dx, y = my + dy, i = y * W + x; if (x < 1 || y < 0 || x >= W - 1 || y >= H - 2 || dx * dx + dy * dy > 5) continue;
      if (tool === 'water' && g[i] === 0) g[i] = 1; else if (tool === 'wall' && g[i] !== 2) g[i] = 2; else if (tool === 'erase') g[i] = 0;
    }
    if (p.down && p.in && tool === 'stir' && sp > 0.3) {                                                           // kobok: geser sel air acak searah seretan + gelembung + riak + percikan
      const sx = Math.sign(mx - px0), sy = Math.sign(my - py0);
      for (let k = 0; k < 14; k++) {
        const x = mx + ((R() * 7 - 3.5) | 0), y = my + ((R() * 7 - 3.5) | 0); if (x < 1 || x >= W - 1 || y < 0 || y >= H - 2 || g[y * W + x] !== 1) continue;
        const nx = x + (R() < 0.6 ? sx : ((R() * 3 - 1) | 0)), ny = y + (R() < 0.6 ? sy : ((R() * 3 - 1) | 0));
        if (nx > 0 && nx < W - 1 && ny >= 0 && ny < H - 2 && g[ny * W + nx] === 0) { g[ny * W + nx] = 1; g[y * W + x] = 0; sim.fall[ny * W + nx] = 0; }
      }
      fizz.burst(mx, my, Math.min(3, 1 + ((sp * 0.6) | 0)), 3, 6);
      const ts = top[mx]; if (ts >= 0 && Math.abs(my - ts) < 7) { surf.splash(mx, -Math.min(1.2, sp * 0.1)); foam.add(mx, Math.min(0.6, sp * 0.05), 3); if (R() < Math.min(1, sp * 0.1)) spray(mx, ts, sp * 2, 1); }
    }
    px0 = mx; py0 = my;
    for (let k = 0; k < 2; k++) { if (faucet) for (let x = fx; x < fx + fq; x++) if (g[2 * W + x] === 0) { g[2 * W + x] = 1; sim.fall[2 * W + x] = 0; } sim.step(); }   // keran menyuntik tiap langkah -> aliran utuh
    for (let k = 0; k < sim.lv.length; k += 2) { surf.splash(sim.lv[k], -0.04); surf.splash(sim.lv[k + 1], 0.04); }      // penyamaan tinggi: muka asal turun, muka tujuan naik -> ombak
    sim.lv.length = 0;
    for (let x = 0; x < W; x++) surf.v[x] = PX.clamp(surf.v[x], -1.5, 1.5);
    impacts(); surf.update(dt); surface(); fizz.update(dt); foam.update(dt);
    for (let i = drops.length - 1; i >= 0; i--) {                                                                 // tetes: gravitasi; jatuh ke air = riak + busa + kadang gelembung
      const d = drops[i]; d.vy += 220 * dt; d.x += d.vx * dt; d.y += d.vy * dt; const ix = Math.round(d.x), iy = Math.round(d.y);
      if (ix < 0 || ix >= W || iy >= H) { drops.splice(i, 1); continue; }
      if (iy >= 0) { const v = g[iy * W + ix]; if (v === 2) drops.splice(i, 1); else if (v === 1 && d.vy > 0 && inW(ix, iy)) { surf.splash(ix, -0.12); foam.add(ix, 0.12, 1); if (R() < 0.3) fizz.burst(ix, iy + 1, 1 + ((R() * 2) | 0), 1.5, 14); drops.splice(i, 1); } }
    }
    dp.fill(0); lit.clear();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const o = y * W + x, v = g[o], tx = top[x], open = tx >= 0;
      if (v === 2) { buf.px(x, y, STONE[PX.tone(0.25 + 0.6 * PX.hash(x >> 1, y >> 1, 3), x, y, 3, 0.25)]); dp[x] = 0; continue; }
      const w = open ? (v === 1 && y >= tx) || (v === 0 && y >= tx && y < y0[x]) : v === 1;
      if (!w) { buf.d[o] = sc.sky.d[o]; dp[x] = 0; continue; }
      const d = y > 0 && g[o - W] === 2 ? 4 : dp[x]; dp[x] = d + 1;                                              // d = kedalaman dari muka; di bawah tembok dianggap dalam (tanpa kilau muka)
      buf.d[o] = sc.under.d[o];
      if (!open && y < H - 1 && g[o + W] === 0) { buf.px(x, y, (x + y) & 1 ? P.LIT : P.RIM); continue; }       // sel jatuh bebas (aliran/tetes) = terang
      buf.px(x, y, P.TINT, TA[PX.tone(1 - Math.min(1, d / 14), x, y, 4, 0.25)]);
      if (d === 0) { const glint = Math.sin(x * 0.37 - t * 2.3) * Math.sin(x * 0.13 + t * 1.1) > 0.55; buf.px(x, y, glint ? P.HI : P.LIT); if ((x & 3) === 0) lit.glow(x, y + 2, 7, P.LIT, glint ? 0.2 : 0.09); }
      else if (d === 1) buf.px(x, y, P.RIM);
      else if (d < 7 && PX.bayer(x, y) < 0.5 - d * 0.07) buf.px(x, y, P.SHADE);
    }
    foam.draw(buf, (x) => top[x]); fizz.draw(buf, lit);
    for (const d of drops) { buf.px(d.x, d.y, P.HI); buf.px(d.x - d.vx * 0.02, d.y - d.vy * 0.02, P.LIT); }
    if (caus) wat.caustics(lit, t, (x, y) => y < H && inW(x, y));
    buf.flush(c); lit.flush(c);
  });
};
