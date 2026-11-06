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
