// Pulsar (bintang neutron): bola bernoise + 2 sinar + garis medan dipol. Sumbu TIDAK berputar penuh: berayun cepat ±22.5° (total 45°) di sekitar sumbu miring.
// Efek: halo cahaya berdenyut, dash yang mengalir di garis medan, cincin + percikan di ujung ayunan, bintang latar berkedip. Semua per-piksel, ramp 6 warna + Bayer.
PX.demos.pulsar = (host) => {
  const W = 128, H = 72, cv = PX.canvas(host, W, H, 640), c = cv.getContext('2d'), img = c.createImageData(W, H), lit = new PX.Light(W, H);
  cv.style.background = '#0a0a16';
  const V = ['#241a66', '#2f3cb4', '#4f7bff', '#8fcbff', '#dff2ff', '#ffffff'].map(PX.hex), CX = W / 2, CY = H / 2, R = 9;
  const BASE = -0.72, SWING = Math.PI / 8, FREQ = 8.5, SNAP = 1.7;               // sumbu miring, amplitudo 22.5°, ayunan cepat (periode ≈ 0.74 s), SNAP: makin besar makin tajam di ujung
  const NORM = Math.tanh(SNAP), sparks = [], rings = []; let prevCos = 1;
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
      const nzz = PX.hash(Math.floor(x + t * 3) >> 1, y >> 1, 11) - 0.5;
      const k = PX.clamp(0.1 + 0.8 * l + nzz * 0.25 + (r2 > 0.7 ? 0.1 : 0), 0, 0.999) * 5;
      put(X, Y, Math.min(5, Math.floor(k + PX.bayer(X, Y))));
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
