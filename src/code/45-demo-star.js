// Bola PSR (senjata bintang neutron) — port teknik gambar dari game. Semua per-piksel, 6 warna + Bayer 4x4, tanpa arah cahaya.
// Resep bola (f0): kecerahan k = (0.42 + 0.58·nz)·(1 − 0.6·bercak) + 0.8·tutupKutub + 0.3·kutubMenghadapKamera; tepi luar 1.5 px dibatasi k ≤ 0.22 (cincin gelap);
// indeks ramp = floor(k·5 + bayer − 0.5). Bercak = noise 3D yang diputar bersama bola (sumbu putar miring), tutup putih = kutub magnet yang berputar miring (oblique rotator).
PX.demos.star = (host) => {
  const W = 144, H = 96, cv = PX.canvas(host, W, H, 640), c = cv.getContext('2d'), img = c.createImageData(W, H), lit = new PX.Light(W, H);
  cv.style.background = '#0a0a16';
  const RAMP = ['#241a66', '#2f3cb4', '#4f7bff', '#8fcbff', '#dff2ff', '#ffffff'].map(PX.hex);   // ramp bola (index 0..5)
  const WHITE = PX.hex('#ffffff'), ICE = PX.hex('#e9f6ff'), SKY = PX.hex('#8fd3ff'), BLUE = PX.hex('#3b6cff'), VIO = PX.hex('#7a4dff');
  const CX = W / 2, CY = H / 2, R = 15, LOOP = 6, TP = (2 * Math.PI) / LOOP, SPIN = 3 * 2 * Math.PI, LEAN = 0.35, INC = 0.62, AZ = 0.9;   // SPIN: 3 putaran/detik (bulat per LOOP -> GIF loop mulus)
  const FR = [Math.cos(AZ) * Math.cos(LEAN), Math.sin(AZ) * Math.cos(LEAN), Math.sin(LEAN), -Math.sin(AZ), Math.cos(AZ), 0, -Math.sin(LEAN) * Math.cos(AZ), -Math.sin(LEAN) * Math.sin(AZ), Math.cos(LEAN)];   // frame 3x3: [0..2] sumbu putar (miring ke kamera), [3..5] & [6..8] basis tegak lurus
  const ss = (a, b, x) => { const u = PX.clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
  const noise3 = (x, y, z) => {                                                      // value noise 3D (hash integer + interpolasi smoothstep)
    const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z), u = ss(0, 1, x - X), v = ss(0, 1, y - Y), w = ss(0, 1, z - Z), L = (a, b, t) => a + (b - a) * t, h = (i, j, k) => PX.hash(X + i, Y + j, Z + k + 500);
    return L(L(L(h(0, 0, 0), h(1, 0, 0), u), L(h(0, 1, 0), h(1, 1, 0), u), v), L(L(h(0, 0, 1), h(1, 0, 1), u), L(h(0, 1, 1), h(1, 1, 1), u), v), w);
  };
  const put = (x, y, col, a = 255) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 4; img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = a; };
  const axisAt = (ang) => { const s = Math.sin(INC) * Math.cos(ang), q = Math.sin(INC) * Math.sin(ang), k = Math.cos(INC); return [k * FR[0] + s * FR[3] + q * FR[6], k * FR[1] + s * FR[4] + q * FR[7], k * FR[2] + s * FR[5] + q * FR[8]]; };   // sumbu magnet = sumbu putar dimiringkan INC, ikut berputar
  const fieldLines = (ang, radii, front, dens, colA, colB) => {                      // garis medan dipol r = s·sin²λ, 6 azimut; hanya sisi depan (z>=0) atau belakang; titik lolos jika dens > bayer -> garis putus-putus berbintik
    const K = Math.cos(INC), S = Math.sin(INC), c0 = Math.cos(ang), s0 = Math.sin(ang), e = [c0 * FR[3] + s0 * FR[6], c0 * FR[4] + s0 * FR[7], c0 * FR[5] + s0 * FR[8]], f = [-s0 * FR[3] + c0 * FR[6], -s0 * FR[4] + c0 * FR[7], -s0 * FR[5] + c0 * FR[8]];
    const a = [S * e[0] + K * FR[0], S * e[1] + K * FR[1], S * e[2] + K * FR[2]], p = [K * e[0] - S * FR[0], K * e[1] - S * FR[1], K * e[2] - S * FR[2]];   // a: sumbu magnet, p: basis tegak lurus
    for (const s of radii) { const l0 = Math.asin(Math.sqrt(R / s)), step = PX.clamp(0.7 / s, 0.004, 0.08);
      for (let h = 0; h < 6; h++) { const d = (h / 6) * 6.2832 + s * 0.013, cd = Math.cos(d), sd = Math.sin(d), qx = cd * p[0] + sd * f[0], qy = cd * p[1] + sd * f[1], qz = cd * p[2] + sd * f[2];
        for (let l = l0; l <= Math.PI - l0; l += step) { const r = s * Math.sin(l) ** 2, cl = Math.cos(l), sl = Math.sin(l), x = r * (cl * a[0] + sl * qx), y = r * (cl * a[1] + sl * qy), z = r * (cl * a[2] + sl * qz);
          if ((z >= 0) !== front) continue; if (!front && x * x + y * y < R * R) continue;
          const px = Math.round(CX + x), py = Math.round(CY + y); if (dens > PX.bayer(px, py)) put(px, py, Math.abs(cl) > 0.6 ? colB : colA); } } }
  };
  const draw = (t) => {
    img.data.fill(0); lit.clear();
    const ang = SPIN * t, ax = axisAt(ang), pole = ss(Math.sin(LEAN + INC) - 0.2, Math.sin(LEAN + INC), ax[2]) + 0.45 * ss(Math.sin(INC - LEAN) - 0.12, Math.sin(INC - LEAN), -ax[2]);   // pole: seberapa kutub menghadap kamera -> bola lebih terang
    const flick = 0.9 + 0.1 * Math.sin(TP * 54 * t) * Math.sin(TP * 24 * t), dens = 0.28 + 0.3 * pole;
    for (let i = 0; i < 40; i++) if (PX.hash(i, (Math.floor(t * 3) + i) % 18, 78) > 0.4) put(PX.hash(i, 1, 77) * W, PX.hash(i, 2, 77) * H, PX.hash(i, 3, 77) < 0.2 ? BLUE : RAMP[0]);   // bintang latar
    const HR = R * (1.75 + 0.25 * pole);
    for (let y = Math.floor(CY - HR); y <= Math.ceil(CY + HR); y++) for (let x = Math.floor(CX - HR); x <= Math.ceil(CX + HR); x++) {   // halo dither: padat dekat bola, f^2.2
      const d = Math.hypot(x + 0.5 - CX, y + 0.5 - CY); if (d < R - 0.5 || d > HR) continue;
      const m = Math.pow(1 - (d - R) / (HR - R), 2.2) * (0.85 + 0.3 * pole); if (m <= PX.bayer(x, y)) continue; put(x, y, m > 0.7 ? ICE : m > 0.45 ? SKY : m > 0.22 ? BLUE : VIO);
    }
    fieldLines(ang, [R * 2.1, R * 3.3], false, dens * 0.9, RAMP[1], RAMP[2]);              // garis medan SISI BELAKANG (digambar sebelum bola)
    const cs = Math.cos(ang), sn = Math.sin(ang), J = Math.max(0, 1 - 1.5 / R);
    for (let y = Math.floor(CY - R); y <= Math.ceil(CY + R); y++) for (let x = Math.floor(CX - R); x <= Math.ceil(CX + R); x++) {   // BOLA
      const nx = (x + 0.5 - CX) / R, ny = (y + 0.5 - CY) / R, r2 = nx * nx + ny * ny; if (r2 > 1) continue;
      const nz = Math.sqrt(1 - r2), u = nx * FR[3] + ny * FR[4] + nz * FR[5], v = nx * FR[6] + ny * FR[7] + nz * FR[8], w = nx * FR[0] + ny * FR[1] + nz * FR[2];   // titik permukaan di frame bola
      const hx = u * cs + v * sn, hy = -u * sn + v * cs;                             // putar mengelilingi sumbu putar -> bercak ikut berputar
      const n = noise3(hx * 2.4 + 11, hy * 2.4, w * 2.4) * 0.62 + noise3(hx * 6 + 3, hy * 6, w * 6 + 7) * 0.38, spot = ss(0.46, 0.7, n);   // 2 oktaf noise 3D -> bercak gelap
      const cap = ss(0.84, 0.96, Math.abs(nx * ax[0] + ny * ax[1] + nz * ax[2]));  // tutup putih di kutub magnet
      let k = (0.42 + 0.58 * nz) * (1 - 0.6 * spot) + cap * 0.8 + pole * 0.3;     // terang = menghadap kamera (emisif), bukan Lambert
      if (r2 > J * J) k = Math.min(k, 0.22);                                         // cincin tepi 1.5 px gelap -> siluet terbaca
      put(x, y, RAMP[PX.clamp(Math.floor(k * 5 + PX.bayer(x, y) - 0.5), 0, 5)]);
    }
    fieldLines(ang, [R * 2.1, R * 3.3], true, dens * 1.3, RAMP[2], SKY);                      // garis medan SISI DEPAN (menimpa bola)
    const AT = R * (1.4 + 2.2 * pole);
    for (let i = Math.ceil(R); i < AT; i++) { const f = 1 - (i - R) / (AT - R); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = Math.round(CX + dx * i), y = Math.round(CY + dy * i); if (PX.bayer(x, y) < f * 1.4) put(x, y, f > 0.6 ? WHITE : f > 0.3 ? ICE : SKY); } }   // 4 duri silang berdither
    lit.glow(CX, CY, R * 5, SKY, (0.5 + 0.4 * pole) * 0.35 * flick); lit.glow(CX, CY, R * 2.2, WHITE, (0.45 + 0.4 * pole) * 0.35);
    c.putImageData(img, 0, 0); lit.flush(c);
  };
  PX.loop(host, (dt, t) => draw(t));
  PX.gifButton(host, cv, draw, { loop: LOOP, scale: 4, name: 'bola-psr' });
};
