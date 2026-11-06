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
