// Pulsar (bintang neutron): bola bernoise + 2 sinar + garis medan dipol. Sumbu TIDAK berputar penuh: berayun cepat ±22.5° (total 45°) di sekitar sumbu miring.
// Efek: halo cahaya berdenyut, dash yang mengalir di garis medan, cincin + percikan di ujung ayunan, bintang latar berkedip. Semua per-piksel, ramp 6 warna + Bayer.
PX.demos.pulsar = (host) => {
  const W = 128, H = 72, cv = PX.canvas(host, W, H, 640), c = cv.getContext('2d'), img = c.createImageData(W, H), lit = new PX.Light(W, H);
  cv.style.background = '#0a0a16';
  const V = ['#241a66', '#2f3cb4', '#4f7bff', '#8fcbff', '#dff2ff', '#ffffff'].map(PX.hex), CX = W / 2, CY = H / 2, R = 13, HR = 8;   // R: radius bola, HR: tebal halo dither di luar bola
  const BASE = -0.72, SWING = Math.PI / 8, FREQ = 8.5, SNAP = 0.9;               // sumbu miring, amplitudo 22.5°, ayunan cepat (periode ≈ 0.74 s), SNAP kecil = gerak halus (mendekati sinus)
  const NORM = Math.tanh(SNAP), sparks = [], rings = [], NSUB = 5, TAU = 0.5, CT = Math.cos(TAU), ST = Math.sin(TAU); let prevCos = 1, thPrev = null;   // NSUB: sub-langkah interpolasi sudut per frame; TAU: sumbu miring ke arah kamera (untuk medan 3D)
  const SPIN = 10, AXT = 0.35, TW = 96, TH = 48, TEX = new Float32Array(TW * TH), CA_ = Math.cos(AXT), SA_ = Math.sin(AXT);   // SPIN: rad/s putaran bola (≈1.6 putaran/detik), AXT: kemiringan sumbu putar
  for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {                       // bake SEKALI: peta lon/lat (tile di lon). fbm besar + kontras -> bercak gelap & titik panas yang jelas saat berputar
    const f = PX.fbm(x / 12, y / 12, 21, TW / 12, 0, 4), hot = PX.fbm(x / 8, y / 8, 47, TW / 8, 0, 3);   // oktaf lebih banyak -> bercak lebih beragam
    TEX[y * TW + x] = PX.clamp((f - 0.5) * 2.6 + 0.5 - Math.max(0, hot - 0.62) * 1.6 + Math.max(0, 0.3 - hot) * 1.4, 0, 1);
  }
  const motes = Array.from({ length: 16 }, () => ({ d: Math.random() * HR, a: Math.random() * 6.283, sp: 1 + Math.random() * 1.5, w: (Math.random() - 0.5) * 0.25 }));
  const put = (x, y, ci) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 4, k = V[ci]; img.data[i] = k[0]; img.data[i + 1] = k[1]; img.data[i + 2] = k[2]; img.data[i + 3] = 255; };
  PX.loop(host, (dt, t) => {
    img.data.fill(0); lit.clear();
    const sw = Math.tanh(SNAP * Math.sin(t * FREQ)) / NORM, th = BASE + SWING * sw, ca = Math.cos(th), sa = Math.sin(th), tilt = 0.7 + 0.3 * Math.abs(Math.cos(t * 0.6)), Lb = 56 * tilt;
    const speed = Math.abs(Math.cos(t * FREQ)), pulse = 0.5 + 0.5 * Math.sin(t * 0.9);   // speed: 1 saat menyapu cepat, 0 di ujung ayunan
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
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {                        // halo dither di luar bola: kerapatan turun ke luar, dimodulasi noise yang bergeser SANGAT pelan
      const d = Math.hypot(x + 0.5 - CX, y + 0.5 - CY) - R; if (d < 0.5 || d > HR) continue;
      const f = 1 - d / HR, dens = Math.pow(f, 1.5) * (0.04 + 0.38 * PX.vnoise(x / 7 + t * 0.1, y / 7 - t * 0.07, 3)) * (0.85 + 0.15 * pulse);
      if (dens > PX.bayer(x, y)) put(x, y, f > 0.6 ? 2 : f > 0.3 ? 1 : 0);
    }
    for (const q of motes) {                                                         // partikel kecil melayang keluar dengan lambat (2–4 px/s) sambil mengorbit pelan
      q.d += q.sp * dt; q.a += q.w * dt; if (q.d > HR) { q.d = 1; q.a = Math.random() * 6.283; }
      const rr = R + q.d, f = 1 - q.d / HR; put(CX + Math.cos(q.a) * rr, CY + Math.sin(q.a) * rr, f > 0.6 ? 3 : f > 0.3 ? 2 : 1);
    }
    for (let i = rings.length - 1; i >= 0; i--) {                                    // cincin kejut dari bola
      const q = rings[i]; q.t += dt; const u = q.t / 0.7; if (u >= 1) { rings.splice(i, 1); continue; }
      const r = R + 2 + u * 44, n = Math.round(r * 5);
      for (let k = 0; k < n; k++) { const g = (k / n) * 6.283; if (PX.hash(k, Math.floor(q.t * 30), 9) < 0.7 - u * 0.5) put(CX + Math.cos(g) * r, CY + Math.sin(g) * r, u < 0.3 ? 3 : u < 0.6 ? 2 : 1); }
    }
    if (thPrev === null) thPrev = th;                                                // interpolasi: sudut frame lalu -> sekarang dibagi NSUB sub-langkah; sub-langkah lama lebih redup (jejak halus, tanpa loncatan)
    const SC = [], SS = [], SW_ = []; for (let s = 1; s <= NSUB; s++) { const a = thPrev + ((th - thPrev) * s) / NSUB; SC.push(Math.cos(a)); SS.push(Math.sin(a)); SW_.push(0.5 + (0.5 * s) / NSUB); }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {                        // sinar
      const dx = x + 0.5 - CX, dy = y + 0.5 - CY; let I = 0;
      for (let s = 0; s < NSUB; s++) {
        const u = Math.abs(dx * SC[s] + dy * SS[s]); if (u < R * 0.8 || u > Lb) continue;
        const v = -dx * SS[s] + dy * SC[s], w = 1.5 + u * 0.1, prof = Math.max(0, 1 - Math.abs(v) / w), Is = (1 - u / Lb) * Math.pow(prof, 0.8) * (0.85 + 0.15 * Math.sin(u * 0.6 - t * 30)) * SW_[s];   // denyut kecil mengalir sepanjang sinar
        if (Is > I) I = Is;
      }
      if (I > PX.bayer(x, y) * 0.9) put(x, y, Math.min(5, Math.floor(I * 6)));
    }
    const front = [], PXX = -sa, PYY = ca;                                           // medan dipol 3D: tiap garis punya azimut φ mengelilingi sumbu; titik belakang digambar sebelum bola (tertutup), titik depan sesudahnya
    [20, 29, 40].forEach((s0, si) => {                                               // r = s·cos²λ; posisi = al·sumbu + pe·(cosφ·p + sinφ·q); z>0 = menghadap kamera
      const s = s0 * (1 + 0.05 * Math.sin(t * 6 + si)), dir = si % 2 ? -1 : 1, NA = 5;
      for (let a = 0; a < NA; a++) {
        const phi = (a / NA) * 6.2832 + si * 0.6 + t * 0.9 * dir, cp = Math.cos(phi), sp = Math.sin(phi);   // azimut berputar pelan: garis tampak memutari bola
        for (let k = -90; k <= 90; k += 0.5) {                                       // langkah 0.5° agar garis menyambung
          const lam = (k * Math.PI) / 180, r = s * Math.cos(lam) ** 2; if (r < R + 0.6) continue;
          const al = r * Math.sin(lam), pe = r * Math.cos(lam), m = (((k + 90 + dir * t * 70) % 40) + 40) % 40;   // m: posisi dalam siklus dash (40° per siklus)
          const x = CX + al * ca * CT + pe * (cp * PXX - sp * ST * ca), y = CY + al * sa * CT + pe * (cp * PYY - sp * ST * sa), z = al * ST + pe * sp * CT;
          const head = m < 4 ? 4 : m < 14 ? 3 : m < 26 ? 2 : -1;                      // kepala terang -> ekor -> celah pendek antar dash
          if (z > 0) { if (head >= 0) front.push([x, y, head]); if (m < 0.5) lit.glow(x, y, 4, V[3], 0.45); }   // inti (kepala) dash depan diberi glow
          else if (head >= 0) put(x, y, head > 2 ? 2 : 1);                             // sisi belakang: lebih gelap, nanti tertutup bola
        }
      }
    });
    for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) {                    // bola
      const nx = x / R, ny = y / R, r2 = nx * nx + ny * ny; if (r2 > 1) continue;
      const nz = Math.sqrt(1 - r2), l = Math.max(0, nx * -0.45 + ny * -0.5 + nz * 0.75), X = x + CX | 0, Y = y + CY | 0;
      const ax = nx * CA_ + ny * SA_, ay = -nx * SA_ + ny * CA_, lon = Math.atan2(ax, nz) + t * SPIN, lat = Math.asin(PX.clamp(ay, -1, 1));   // pemetaan terbalik: piksel -> titik bola (sumbu miring) -> lon/lat
      const tu = (((lon / 6.2832) % 1) + 1) % 1, tx = (tu * TW) | 0, ty = PX.clamp(((lat / Math.PI + 0.5) * TH) | 0, 0, TH - 1);
      const rim = PX.clamp((r2 - 0.45) / 0.55, 0, 1), fl = PX.hash(tx >> 1, ty >> 1, 91);                    // rim: 0 di tengah -> 1 di tepi; fl: bintik tetap di tekstur, jadi ikut berputar
      const k = PX.clamp((0.06 + 0.42 * l + (TEX[ty * TW + tx] - 0.5) * 0.85) * (1 - 0.85 * rim * rim), 0, 1);   // cahaya tetap, tekstur berputar (kontras tinggi), makin gelap ke tepi; puncak tidak putih penuh
      let ci = PX.tone(k, X, Y, 5, 0.9);                                                                    // dither Bayer lebar (5 warna, tanpa putih) -> terlihat pola dither di seluruh bola
      if (r2 > 0.6 && fl > 0.9) ci = fl > 0.96 ? 5 : 4;                                                   // sedikit putih di pinggiran (berputar bersama bola)
      else if (r2 > 0.8) ci = Math.min(ci, fl > 0.5 ? 1 : 0);                                              // pinggiran luar: biru gelap
      put(X, Y, ci);
    }
    for (const f of front) put(f[0], f[1], f[2]);                                    // garis medan sisi depan menimpa bola
    thPrev = th;
    for (let i = sparks.length - 1; i >= 0; i--) {                                   // percikan dari ujung sinar
      const s = sparks[i]; s.life -= dt; if (s.life <= 0) { sparks.splice(i, 1); continue; }
      s.x += s.vx * dt; s.y += s.vy * dt; s.vx *= 1 - 1.5 * dt; s.vy *= 1 - 1.5 * dt; put(s.x, s.y, s.life > s.m * 0.6 ? 5 : s.life > s.m * 0.3 ? 3 : 2);
    }
    lit.glow(CX, CY, 34 + 4 * pulse, V[1], 0.22 + 0.08 * pulse);   // cahaya: halo bintang + titik terang sepanjang sinar (lebih terang saat menyapu cepat)
    for (const sg of [-1, 1]) { lit.glow(CX + ca * sg * Lb * 0.35, CY + sa * sg * Lb * 0.35, 16, V[3], 0.14 + 0.16 * speed); lit.glow(CX + ca * sg * Lb * 0.75, CY + sa * sg * Lb * 0.75, 10, V[2], 0.1 + 0.12 * speed); }
    c.putImageData(img, 0, 0); lit.flush(c);
  });
};
