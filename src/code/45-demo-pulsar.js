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
