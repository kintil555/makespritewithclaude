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
  cv.style.width = cssW + 'px'; cv.style.maxWidth = '100%'; cv.style.height = 'auto';
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

/* 40-demo-tracer.js */
// Tracer + muzzle flash + percikan tumbukan. Klik = tembak ke arah kursor (idle: tembak otomatis).
PX.demos.tracer = (host) => {
  const W = 160, H = 90, GY = 76, cv = PX.canvas(host, W, H, 640, false), c = cv.getContext('2d'), p = PX.pointer(cv);
  const GUN = { x: 16, y: 60 }, CORE = '#fffbd0', MIDS = '#ffd24a', DARK = '#a8841f';
  const bl = [], sp = [], fl = []; let cd = 0, kick = 0, ang = 0;
  const rays = (x, y, a, n, len, col) => { for (let i = 0; i < n; i++) { const q = a + (Math.random() - 0.5) * 1.3, l = len * (0.4 + Math.random() * 0.6); PX.line(c, x, y, x + Math.cos(q) * l, y + Math.sin(q) * l, col); } };
  const glow = (x, y, r, col) => { c.fillStyle = col; for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) { const d = Math.hypot(i, j) / r; if (d <= 1 && (1 - d) * 0.55 > PX.bayer(x + i, y + j)) c.fillRect(x + i, y + j, 1, 1); } };
  const fire = (a) => { bl.push({ x: GUN.x + Math.cos(a) * 9, y: GUN.y + Math.sin(a) * 9, a, trav: 0 }); fl.push({ t: 0, a }); kick = 2; };
  const tracer = (b) => {                       // kepala 1px terang -> pasangan piksel tebal -> piksel tunggal gelap memudar
    const ca = Math.cos(b.a), sa = Math.sin(b.a), len = Math.min(b.trav, 28), m = Math.max(Math.abs(ca), Math.abs(sa)),
      N = Math.max(3, Math.round(len * m)), vert = Math.abs(sa) >= Math.abs(ca), ox = vert ? (ca >= 0 ? -1 : 1) : 0, oy = vert ? 0 : (sa >= 0 ? -1 : 1);
    glow(Math.round(b.x), Math.round(b.y), 5, MIDS);
    for (let k = N; k >= 0; k--) {
      const t = k / N, x = Math.round(b.x - (ca / m) * k), y = Math.round(b.y - (sa / m) * k);
      if (k === 0) { c.globalAlpha = 1; c.fillStyle = CORE; c.fillRect(x, y, 1, 1); }
      else if (t <= 0.5) { c.globalAlpha = 1; c.fillStyle = MIDS; c.fillRect(x, y, 1, 1); c.fillRect(x + ox, y + oy, 1, 1); }
      else { c.globalAlpha = Math.max(0.4, 1 - (t - 0.5) * 1.1); c.fillStyle = DARK; c.fillRect(x, y, 1, 1); }
    }
    c.globalAlpha = 1;
  };
  PX.loop(host, (dt, t) => {
    cd -= dt; kick = Math.max(0, kick - dt * 20);
    ang = p.in ? Math.atan2(p.y - GUN.y, p.x - GUN.x) : -0.12 + Math.sin(t * 0.9) * 0.2;
    while (p.clicks.length) { p.clicks.length = 0; fire(ang); }
    if (cd <= 0 && (p.down || !p.in)) { fire(ang + (Math.random() - 0.5) * 0.04); cd = p.in ? 0.09 : 0.35; }
    for (const b of bl) {
      const v = 300 * dt; b.x += Math.cos(b.a) * v; b.y += Math.sin(b.a) * v; b.trav += v;
      if (b.x >= W - 6 || b.y >= GY || b.y < 0) {
        b.dead = true; const base = b.y >= GY ? -Math.PI / 2 : Math.PI;
        for (let i = 0; i < 9; i++) { const q = base + (Math.random() - 0.5) * 2.2, s = 40 + Math.random() * 90; sp.push({ x: b.x, y: Math.min(b.y, GY - 1), vx: Math.cos(q) * s, vy: Math.sin(q) * s, life: 0.25 + Math.random() * 0.3 }); }
      }
    }
    for (let i = bl.length - 1; i >= 0; i--) if (bl[i].dead) bl.splice(i, 1);
    for (const s of sp) { s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 260 * dt; s.life -= dt; }
    for (let i = sp.length - 1; i >= 0; i--) if (sp[i].life <= 0) sp.splice(i, 1);
    for (const f of fl) f.t += dt; while (fl.length && fl[0].t > 0.07) fl.shift();
    c.clearRect(0, 0, W, H); c.fillStyle = '#26263a'; c.fillRect(0, GY, W, H - GY); c.fillStyle = '#34344e'; c.fillRect(W - 6, 0, 6, GY);
    PX.line(c, GUN.x - Math.cos(ang) * kick, GUN.y - Math.sin(ang) * kick, GUN.x + Math.cos(ang) * 9 - Math.cos(ang) * kick, GUN.y + Math.sin(ang) * 9 - Math.sin(ang) * kick, '#8a8aa8');
    c.fillStyle = '#5c5c78'; c.fillRect(GUN.x - 3, GUN.y - 1, 5, 6);
    for (const f of fl) { const x = GUN.x + Math.cos(f.a) * 9, y = GUN.y + Math.sin(f.a) * 9; rays(x, y, f.a, 5, 9, MIDS); rays(x, y, f.a, 3, 5, CORE); c.fillStyle = '#fff'; c.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3); }
    bl.forEach(tracer);
    for (const s of sp) { c.fillStyle = s.life > 0.2 ? CORE : MIDS; c.fillRect(Math.round(s.x), Math.round(s.y), 1, 1); }
  });
};

/* 41-demo-blast.js */
// Ledakan prosedural berlapis: kilat putih -> gumpalan bola api (5 lapis disc) -> sinar -> gelombang kejut tak beraturan -> partikel -> asap.
PX.PALS = {
  api:     { c: ['#8a1f17', '#f2561d', '#ff8a2a', '#ffe26b', '#ffffff'], smoke: ['#7e3030', '#4a2a2a', '#2e2024', '#1a161c'] },
  neutron: { c: ['#1b2fb0', '#3a5cff', '#8fb4ff', '#c9d8ff', '#ffffff'], smoke: ['#5a6aa8', '#3a4278', '#262a4c', '#14162a'] },
};
PX.Blast = class {
  constructor(x, y, R, pal = PX.PALS.api) {
    const r = Math.random; this.x = Math.round(x); this.y = Math.round(y); this.R = R; this.t = 0; this.life = 0.95 + r() * 0.25;
    this.c = pal.c.map(PX.hex); this.sm = pal.smoke.map(PX.hex);
    this.rays = Array.from({ length: 26 }, () => ({ a: r() * 6.283, len: 0.4 + r() * 1.9, w: r() < 0.25, t0: r() * 0.12 }));
    this.lobes = Array.from({ length: 10 }, () => ({ a: r() * 6.283, d: r() * 0.75, r: 0.2 + r() * 0.28, t0: r() * 0.22, tl: 0.45 + r() * 0.4 }));
    this.ph = [r() * 6.283, r() * 6.283, r() * 6.283];
    this.parts = Array.from({ length: 60 }, () => { const g = r() * 6.283, v = (0.4 + Math.sqrt(r()) * 2.4) * R * 3; return { x: this.x, y: this.y, vx: Math.cos(g) * v, vy: Math.sin(g) * v - R, life: 0.25 + r() * 0.65, ci: (r() * 4) | 0 }; });
    this.smoke = Array.from({ length: 7 }, () => ({ x: this.x + (r() - 0.5) * R, y: this.y + (r() - 0.5) * R, vx: (r() - 0.5) * 8, vy: -4 - r() * 9, life: 1 + r() * 0.6, r0: R * 0.18, r1: R * (0.4 + r() * 0.4) }));
  }
  get done() { return this.t > this.life + 0.8; }
  step(dt) {
    this.t += dt;
    for (const p of this.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += this.R * 14 * dt; }
    for (const s of this.smoke) { s.x += s.vx * dt; s.y += s.vy * dt; }
  }
  draw(b) {
    const { x: cx, y: cy, R, c } = this, u = this.t / this.life, e = 1 - (1 - u) * (1 - u), a = Math.pow(Math.max(0, 1 - u), 1.1), rnd = Math.random;
    for (const s of this.smoke) { const su = this.t / s.life; if (su > 1 || su < 0.12) continue; b.disc(s.x, s.y, s.r0 + (s.r1 - s.r0) * su, this.sm[Math.min(3, (su * 4) | 0)], 0.55 * (1 - su)); }
    if (u < 1) {
      b.disc(cx, cy, R * (1 + 0.9 * e), c[0], a * 0.14);
      if (u < 0.14) b.disc(cx, cy, R * (0.5 + (0.9 * u) / 0.14), c[4], 1 - u / 0.14);       // kilat
      for (const l of this.lobes) {                                                       // gumpalan bola api: 5 disc konsentris
        const lu = (u - l.t0) / l.tl; if (lu < 0 || lu > 1) continue;
        const le = 1 - (1 - lu) * (1 - lu), al = Math.pow(1 - lu, 1.1), sz = l.r * R * (0.4 + 1.1 * le),
          lx = cx + Math.cos(l.a) * l.d * R * 1.5 * le, ly = cy + Math.sin(l.a) * l.d * R * 1.5 * le;
        [[0, 1, 0.55], [1, 0.86, 0.7], [2, 0.64, 0.85], [3, 0.42, 0.95], [4, 0.22 * (1 - lu * 0.6), 1]].forEach(([ci, k, A]) => b.disc(lx, ly, sz * k, c[ci], al * A));
      }
      for (const r of this.rays) {                                                        // sinar radiasi
        const ru = (u - r.t0) / (1 - r.t0); if (ru < 0) continue;
        const re = 1 - (1 - ru) * (1 - ru), L = R * r.len * 1.3 * re, s0 = R * 0.3, ca = Math.cos(r.a), sa = Math.sin(r.a), al = Math.pow(1 - ru, 1.2);
        for (let d = s0; d < s0 + L; d++) {
          if (rnd() < 0.1) continue; const f = (d - s0) / L, col = f < 0.25 ? c[4] : f < 0.6 ? c[2] : c[1];
          b.px(cx + ca * d, cy + sa * d, col, al * (1 - f) * 0.95);
        }
      }
      for (let k = 0; k < 2; k++) {                                                       // gelombang kejut 2 lapis, radius bergelombang
        const rr = R * (k ? 0.3 + 1.2 * e : 0.4 + 1.7 * e), n = Math.ceil(rr * 6.3), aa = a * (k ? 0.55 : 0.9); if (rr < 1) continue;
        for (let i = 0; i < n; i++) {
          if (rnd() < 0.22) continue; const g = (i / n) * 6.283,
            rd = rr + rr * (Math.sin(g * 3 + this.ph[0]) * 0.07 + Math.sin(g * 5 + this.ph[1]) * 0.05 + Math.sin(g * 9 + this.ph[2]) * 0.03) + (rnd() - 0.5) * 1.4;
          b.px(cx + Math.cos(g) * (rd + 1.5), cy + Math.sin(g) * (rd + 1.5), c[1], aa); b.px(cx + Math.cos(g) * rd, cy + Math.sin(g) * rd, k ? c[2] : c[4], aa);
        }
      }
    }
    for (const p of this.parts) { const pu = this.t / p.life; if (pu < 1) b.px(p.x, p.y, c[Math.min(4, 4 - ((pu * 3) | 0))], 1 - pu * 0.5); }
  }
};

PX.demos.blast = (host) => {
  const W = 160, H = 90, cv = PX.canvas(host, W, H, 640), c = cv.getContext('2d'), buf = new PX.Buf(W, H), p = PX.pointer(cv);
  cv.style.background = '#12121c';
  let pal = 'api', list = [], idle = 0;
  PX.ui(host).select('Palet', Object.keys(PX.PALS), 'api', (v) => (pal = v));
  PX.loop(host, (dt) => {
    for (const k of p.clicks.splice(0)) list.push(new PX.Blast(k.x, k.y, 14, PX.PALS[pal]));
    idle -= dt; if (idle <= 0) { idle = 1.8; if (!p.in) list.push(new PX.Blast(30 + Math.random() * 100, 25 + Math.random() * 40, 11 + Math.random() * 6, PX.PALS[pal])); }
    list = list.filter((q) => !q.done); buf.clear();
    for (const q of list) { q.step(dt); q.draw(buf); }
    buf.flush(c);
  });
};

/* 42-demo-crater.js */
// Lubang di dinding: hapus piksel (tepi tak beraturan), tampilkan dinding belakang, bayangan kedalaman di bawah bibir atas,
// gosong = cincin hitam tipis lalu dither Bayer memudar keluar, serpihan mewarisi warna asli, bara di tepi lubang.
PX.demos.crater = (host) => {
  const W = 160, H = 90, cv = PX.canvas(host, W, H, 640), c = cv.getContext('2d'), p = PX.pointer(cv), rnd = PX.rng(7);
  const PALB = ['#8c4a3a', '#9b5644', '#7d4132', '#a4604b'].map(PX.hex);
  const brick = (x, y, off, dark, seed) => {                         // pola bata + noise per bata/per piksel
    const row = Math.floor(y / 6), ox = x + (row & 1 ? 7 : 0) + off, bx = Math.floor(ox / 14);
    const mortar = y % 6 === 0 || ox % 14 === 0, base = mortar ? [60, 44, 40] : PALB[Math.floor(PX.hash(bx, row, seed) * 4)];
    const n = (PX.hash(x, y, 9) - 0.5) * 16, k = dark * (mortar ? 1 : 1);
    return [PX.clamp((base[0] + n) * k, 0, 255), PX.clamp((base[1] + n) * k, 0, 255), PX.clamp((base[2] + n) * k, 0, 255)];
  };
  const base = new ImageData(W, H), back = new ImageData(W, H), img = new ImageData(W, H), hole = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4, f = brick(x, y, 0, 1, 1), b = brick(x, y, 5, 0.42, 2);
    base.data.set([...f, 255], i); back.data.set([...b, 255], i);
  }
  img.data.set(base.data);
  const debris = [], heat = [];
  const mul = (i, k) => { for (let j = 0; j < 3; j++) img.data[i + j] *= k; };
  function carve(cx, cy, r) {
    const ph = [rnd() * 6.28, rnd() * 6.28, rnd() * 6.28], wid = 7, E = Math.ceil(r * 1.3 + wid);
    const rr = (a) => r * (1 + 0.12 * Math.sin(3 * a + ph[0]) + 0.07 * Math.sin(5 * a + ph[1]) + 0.04 * Math.sin(9 * a + ph[2]));
    const x0 = Math.max(0, cx - E), x1 = Math.min(W - 1, cx + E), y0 = Math.max(0, cy - E), y1 = Math.min(H - 1, cy + E);
    const scorch = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy) - rr(Math.atan2(dy, dx)), i = y * W + x;
      if (d <= 0) {
        if (!hole[i]) {                                           // serpihan membawa warna asli piksel
          hole[i] = 1;
          if (rnd() < 0.35) { const a = Math.atan2(dy, dx), v = 30 + rnd() * 70; debris.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, life: 0.6 + rnd() * 0.6, c: Array.from(img.data.slice(i * 4, i * 4 + 3)) }); }
        }
      } else if (d <= wid) scorch.push([x, y, d]);
    }
    for (const [x, y, d] of scorch) {                              // gosong pada dinding depan (kumulatif)
      const i = y * W + x; if (hole[i]) continue;
      if (d <= 1.5) { mul(i * 4, 0.15); if (rnd() < 0.5) heat.push({ i, t: rnd() * 0.1 }); }
      else { const t = (d - 1.5) / (wid - 1.5), lv = 0.95 * Math.pow(1 - t, 1.15); if (lv > PX.bayer(x, y)) mul(i * 4, 0.35); }
    }
    const al = (x, y) => x >= 0 && y >= 0 && x < W && y < H && !hole[y * W + x];
    for (let y = Math.max(0, y0 - 5); y <= Math.min(H - 1, y1 + 5); y++) for (let x = Math.max(0, x0 - 3); x <= Math.min(W - 1, x1 + 3); x++) {
      const i = y * W + x; if (!hole[i]) continue;
      let k = 0; for (let q = 2; q <= 5; q++) if (al(x - ((q + 1) >> 1), y - q)) { k = q; break; }     // jarak ke bibir atas
      const s = k && k <= 2 ? 0.45 : k === 3 && 0.6 > PX.bayer(x, y) ? 0.45 : k === 4 && 0.3 > PX.bayer(x, y) ? 0.45 : 1;
      for (let j = 0; j < 3; j++) img.data[i * 4 + j] = back.data[i * 4 + j] * s;
    }
  }
  const sx = document.createElement('canvas'); sx.width = W; sx.height = H; const sc = sx.getContext('2d');
  let idle = 0.5;
  PX.loop(host, (dt) => {
    for (const k of p.clicks.splice(0)) carve(k.x, k.y, 9 + Math.floor(rnd() * 6));
    idle -= dt; if (idle <= 0) { idle = 2.2; if (!p.in) carve(20 + Math.floor(rnd() * 120), 15 + Math.floor(rnd() * 60), 9 + Math.floor(rnd() * 6)); }
    sc.putImageData(img, 0, 0); c.drawImage(sx, 0, 0);
    for (const h of heat) { h.t += dt; if (h.t < 0.75) { c.fillStyle = h.t < 0.3 ? '#ffb24a' : '#d9561c'; c.globalAlpha = (1 - h.t / 0.75) * 0.9; c.fillRect(h.i % W, (h.i / W) | 0, 1, 1); } }
    c.globalAlpha = 1; while (heat.length && heat[0].t > 0.75) heat.shift();
    for (let i = debris.length - 1; i >= 0; i--) { const d = debris[i]; d.x += d.vx * dt; d.y += d.vy * dt; d.vy += 260 * dt; d.life -= dt; if (d.life <= 0) { debris.splice(i, 1); continue; } c.fillStyle = PX.rgb(d.c); c.fillRect(Math.round(d.x), Math.round(d.y), 1, 1); }
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
  const W = 160, H = 90, cv = PX.canvas(host, W, H, 640), c = cv.getContext('2d'), buf = new PX.Buf(W, H), p = PX.pointer(cv);
  cv.style.background = '#12121c';
  const ramp = PX.PALS.neutron.c.map(PX.hex), orbs = [], blasts = []; let idle = 0.3;
  const shoot = (tx, ty) => { const a = Math.atan2(ty - 66, tx - 14); orbs.push({ x: 14, y: 66, a, tx, ty, t: 0 }); };
  PX.loop(host, (dt, t) => {
    for (const k of p.clicks.splice(0)) shoot(k.x, k.y);
    idle -= dt; if (idle <= 0) { idle = 2; if (!p.in) shoot(100 + Math.random() * 50, 20 + Math.random() * 50); }
    buf.clear();
    for (let i = orbs.length - 1; i >= 0; i--) {
      const o = orbs[i], v = 130 * dt; o.x += Math.cos(o.a) * v; o.y += Math.sin(o.a) * v;
      if ((o.tx - o.x) * Math.cos(o.a) + (o.ty - o.y) * Math.sin(o.a) <= 0) { blasts.push(new PX.Blast(o.tx, o.ty, 15, PX.PALS.neutron)); orbs.splice(i, 1); continue; }
      PX.drawOrb(buf, o.x, o.y, o.a, 3.3 * (1 + Math.sin(t * 40) * 0.06), ramp);
    }
    for (let i = blasts.length - 1; i >= 0; i--) { blasts[i].step(dt); blasts[i].draw(buf); if (blasts[i].done) blasts.splice(i, 1); }
    buf.flush(c); c.fillStyle = '#5c5c78'; c.fillRect(8, 63, 8, 6);
  });
};

/* 45-demo-pulsar.js */
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
// percikan setengah elips yang melebar, serpihan air berparabola. Lapis depan digambar SETELAH objek (di depan karakter).
PX.noise1 = (x, s = 0) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f), a = PX.hash(i, 0, s), b = PX.hash(i + 1, 0, s); return (a + (b - a) * u) * 2 - 1; };

PX.Rain = class {
  constructor({ w = 160, ground = 76, density = 1, slant = -0.22, seed = 1 } = {}) {
    this.w = w; this.G = ground; this.slant = slant; this.t = 0; this.R = PX.rng(seed);
    this.C = { far: '#38446e', farH: '#56659a', mid: '#5f74ab', midH: '#9ab0e0', near: '#6f86bd', nearH: '#d6e5ff', mist: '#4b5a8c' };
    for (const k in this.C) this.C[k] = PX.hex(this.C[k]);
    this.SPEED = [380, 525, 725]; this.LEN = [2, 4, 8];
    this.drops = []; this.splashes = []; this.bits = [];
    [[0, 90], [1, 50], [2, 16]].forEach(([layer, n]) => { for (let i = 0; i < Math.round(n * density); i++) { const d = { layer }; this.reset(d, false); this.drops.push(d); } });
  }
  rg(a, b) { return a + (b - a) * this.R(); }
  reset(d, top) {
    d.x = this.rg(0, this.w + 90);
    d.y = top ? -this.rg(0, 100) : this.rg(-100, this.G);
    d.sp = this.SPEED[d.layer] * this.rg(0.9, 1.1);
    d.stop = this.G - this.rg(5, 70);                  // lapis jauh berhenti di udara = ilusi kedalaman
  }
  update(dt) {
    this.t += dt;
    const L = Math.hypot(this.slant, 1), ux = this.slant / L, uy = 1 / L, G = this.G;
    for (const d of this.drops) {
      d.x += ux * d.sp * dt; d.y += uy * d.sp * dt;
      if (d.layer === 0 && d.y > d.stop) this.reset(d, true);
      else if (d.y >= G) {
        if (d.x > -10 && d.x < this.w + 10) {
          if (d.layer === 2 || this.R() < 0.6) this.splashes.push({ x: d.x, t: this.t });
          for (let k = 0, n = d.layer === 2 ? 3 : Math.floor(this.rg(0, 2.99)); k < n; k++) this.bits.push({ x: d.x, y: G - 1, vx: this.rg(-45, 35), vy: -this.rg(55, 115), life: this.rg(0.18, 0.32) });
        }
        this.reset(d, true);
      }
    }
    for (let i = this.bits.length - 1; i >= 0; i--) { const b = this.bits[i]; b.life -= dt; b.vy += 950 * dt; b.x += b.vx * dt; b.y += b.vy * dt; if (b.life <= 0 || b.y > G) this.bits.splice(i, 1); }
    this.splashes = this.splashes.filter((s) => this.t - s.t <= 0.4);
  }
  dot(buf, x, y, c, a = 1) { const px = Math.floor(x), py = Math.floor(y); if (a >= 1 || a > PX.bayer(px, py)) buf.px(px, py, c); }   // alpha -> dither
  line(buf, x0, y0, x1, y1, c) { const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)))); for (let i = 0; i <= n; i++) buf.px(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c); }
  layer(buf, k) {
    const L = Math.hypot(this.slant, 1), ux = this.slant / L, uy = 1 / L, len = this.LEN[k], body = [this.C.far, this.C.mid, this.C.near][k], head = [this.C.farH, this.C.midH, this.C.nearH][k];
    for (const d of this.drops) if (d.layer === k) {      // tetes = ekor gelap (60%) + kepala terang (40%)
      this.line(buf, d.x - ux * len, d.y - uy * len, d.x - ux * len * 0.4, d.y - uy * len * 0.4, body);
      this.line(buf, d.x - ux * len * 0.4, d.y - uy * len * 0.4, d.x, d.y, head);
    }
  }
  drawBack(buf) {
    this.layer(buf, 0); this.layer(buf, 1);
    const G = this.G, t = this.t;
    for (let x = 0; x < this.w; x++) {                    // kabut tanah
      const m = (PX.noise1(x * 0.06 + t * 0.5, 3) + PX.noise1(x * 0.15 - t * 0.8, 4) * 0.5 + 1) / 2.5;
      if (PX.hash(x, Math.floor(t * 8)) < 0.04) this.dot(buf, x, G, this.C.midH);
      for (let r = 0; r < 9; r++) this.dot(buf, x, G - r, this.C.mist, m * 0.32 * (1 - r / 9));
    }
    for (const s of this.splashes) {                      // percikan: setengah elips melebar
      const u = (t - s.t) / 0.4, rx = 1 + 3 * Math.sqrt(u), ry = rx * 0.35, n = Math.ceil(rx * 8), col = u < 0.3 ? this.C.midH : this.C.mid;
      for (let j = 0; j < n; j++) { const a = (j / n) * Math.PI * 2, sa = Math.sin(a); if (sa < -0.2) continue; this.dot(buf, s.x + Math.cos(a) * rx, G + sa * ry, col, 1 - u); }
    }
    for (const b of this.bits) this.dot(buf, b.x, b.y, this.C.nearH);
  }
  drawFront(buf) { this.layer(buf, 2); }
};

PX.demos.rain = (host) => {
  const W = 160, H = 90, G = 76, cv = PX.canvas(host, W, H, 640), c = cv.getContext('2d');
  const back = new PX.Buf(W, H), front = new PX.Buf(W, H), oc = document.createElement('canvas'); oc.width = W; oc.height = H; const o = oc.getContext('2d');
  let rain = new PX.Rain({ w: W, ground: G }), opt = { density: 1, slant: -0.22 };
  const rebuild = () => (rain = new PX.Rain({ w: W, ground: G, ...opt }));
  const ui = PX.ui(host);
  ui.range('Kepadatan', 0.5, 2, 0.5, 1, (v) => { opt.density = v; rebuild(); });
  ui.select('Kemiringan', [{ label: 'miring kiri', value: -0.22 }, { label: 'tegak', value: 0 }, { label: 'miring kanan', value: 0.3 }], -0.22, (v) => { opt.slant = +v; rebuild(); });
  const flush = (b) => { b.flush(o); c.drawImage(oc, 0, 0); };
  PX.loop(host, (dt, t) => {
    rain.update(dt); back.clear(); front.clear(); rain.drawBack(back); rain.drawFront(front);
    c.clearRect(0, 0, W, H); flush(back);
    c.fillStyle = '#1b2036'; c.fillRect(0, G, W, H - G);                       // tanah basah
    c.fillStyle = '#2a3150'; c.fillRect(0, G, W, 1);
    c.fillStyle = '#3a3a58'; c.fillRect(70, G - 22, 12, 22); c.fillRect(72, G - 28, 8, 6);   // "karakter" pengganti
    c.fillStyle = '#5a5a80'; c.fillRect(72, G - 28, 8, 1); c.fillStyle = '#8ff3ff'; c.fillRect(74, G - 25, 1, 1); c.fillRect(77, G - 25, 1, 1);
    flush(front);                                                               // lapis depan di atas karakter
  });
};
