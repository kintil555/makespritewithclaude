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
