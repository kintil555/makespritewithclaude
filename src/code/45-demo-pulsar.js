// Pulsar (bintang neutron): bola bernoise + 2 sinar + garis medan dipol. Sumbu TIDAK berputar penuh: berayun cepat ±22.5° (total 45°) di sekitar sumbu miring.
// Efek: halo cahaya berdenyut, dash yang mengalir di garis medan, cincin + percikan di ujung ayunan, bintang latar berkedip. Semua per-piksel, ramp 6 warna + Bayer.
PX.demos.pulsar = (host) => {
  const W = 128, H = 72, cv = PX.canvas(host, W, H, 640), c = cv.getContext('2d'), img = c.createImageData(W, H), lit = new PX.Light(W, H);
  cv.style.background = '#0a0a16';
  const V = ['#241a66', '#2f3cb4', '#4f7bff', '#8fcbff', '#dff2ff', '#ffffff'].map(PX.hex), CX = W / 2, CY = H / 2, R = 18, HR = 12;   // R: radius bola, HR: tebal halo dither di luar bola
  const BASE = -0.72, SWING = Math.PI / 8, SNAP = 0.9, LOOP = 6, TP = (2 * Math.PI) / LOOP, FREQ = 8 * TP;   // LOOP: periode animasi (s). Semua frekuensi = kelipatan bulat 2π/LOOP -> animasi persis berulang tiap LOOP detik (dasar GIF loop mulus). FREQ ≈ 8.4 rad/s               // sumbu miring, amplitudo 22.5°, ayunan cepat (periode ≈ 0.74 s), SNAP kecil = gerak halus (mendekati sinus)
  const NORM = Math.tanh(SNAP), NSUB = 5, TAU = 0.5, CT = Math.cos(TAU), ST = Math.sin(TAU);   // NSUB: sub-langkah interpolasi sudut per frame; TAU: sumbu miring ke arah kamera (untuk medan 3D)
  const SPIN = 10 * TP, AXT = 0.35, TW = 96, TH = 48, TEX = new Float32Array(TW * TH), CON = new Float32Array(TW * TH), CA_ = Math.cos(AXT), SA_ = Math.sin(AXT);   // SPIN: rad/s putaran bola (≈1.6 putaran/detik), AXT: kemiringan sumbu putar
  for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {                       // bake SEKALI: peta lon/lat (tile di lon). fbm besar + kontras -> bercak gelap & titik panas yang jelas saat berputar
    const f = PX.fbm(x / 12, y / 12, 21, TW / 12, 0, 4);
    const lt = (y / TH - 0.5) * Math.PI, g = PX.fbm(x / 16, y / 16, 33, TW / 16, 0, 4);                // benua: bercak tebal & gelap, hanya di sekitar katulistiwa (lat≈0), sebagian saja
    CON[y * TW + x] = PX.clamp((g - 0.56) * 6, 0, 1) * Math.exp(-((lt / 0.5) ** 2));
    TEX[y * TW + x] = PX.clamp((f - 0.5) * 5, 0, 1);                                // bercak: hanya puncak fbm (≈15% area) -> bola bersih, bercak sedikit
  }
  const put = (x, y, ci, al = 255) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 4, k = V[ci]; img.data[i] = k[0]; img.data[i + 1] = k[1]; img.data[i + 2] = k[2]; img.data[i + 3] = al; };
  const draw = (t) => {
    img.data.fill(0); lit.clear();
    const thAt = (u) => BASE + SWING * Math.tanh(SNAP * Math.sin(u * FREQ)) / NORM, th = thAt(t), ca = Math.cos(th), sa = Math.sin(th), tilt = 0.7 + 0.3 * Math.abs(Math.cos((t * TP) / 2)), Lb = 56 * tilt;
    const speed = Math.abs(Math.cos(t * FREQ)), pulse = 0.5 + 0.5 * Math.sin(t * TP);   // speed: 1 saat menyapu cepat, 0 di ujung ayunan
    const em = Math.floor((t * FREQ - Math.PI / 2) / Math.PI);                       // indeks ujung ayunan terakhir (cos(FREQ·t) berganti tanda): cincin + percikan dihitung SEBAGAI FUNGSI waktu sejak kejadian -> tanpa state, periodik
    const evSign = (m) => (((m % 2) + 2) % 2 === 0 ? 1 : -1), evT = (m) => (Math.PI / 2 + m * Math.PI) / FREQ;
    for (let i = 0; i < 46; i++) {                                                   // bintang latar berkedip
      const sx = (PX.hash(i, 1, 77) * W) | 0, sy = (PX.hash(i, 2, 77) * H) | 0;
      if (PX.hash(i, (Math.floor(t * 3) + i) % 18, 78) > 0.35) put(sx, sy, PX.hash(i, 3, 77) < 0.2 ? 2 : 0);
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {                        // halo dither di luar bola: kerapatan turun ke luar, dimodulasi noise yang bergeser SANGAT pelan
      const d = Math.hypot(x + 0.5 - CX, y + 0.5 - CY) - R; if (d < 0.5 || d > HR) continue;
      const f = 1 - d / HR, dens = (Math.pow(f, 1.5) * (0.04 + 0.38 * PX.vnoise(x / 7 + 0.25 * Math.cos(t * TP), y / 7 + 0.25 * Math.sin(t * TP), 3)) + 0.4 * Math.pow(f, 4)) * (0.85 + 0.15 * pulse);   // + suku f^4: lebih padat tepat di dekat bola
      if (dens > PX.bayer(x, y)) put(x, y, f > 0.8 ? (PX.hash(x, y, 6) < 0.5 ? 3 : 2) : f > 0.45 ? 1 : 0, 255 * (0.6 + 0.4 * PX.hash(x, y, 5)));   // lapisan awal biru terang, lalu langsung biru lebih gelap; opasitas 60–100%
    }
    for (let i = 0; i < 16; i++) {                                                   // partikel kecil melayang keluar dengan lambat; posisi = fungsi waktu (n siklus per LOOP), arah acak tiap siklus
      const n = 1 + (i & 1), Li = LOOP / n, ph = t / Li + PX.hash(i, 0, 60), u = ph - Math.floor(ph), cyc = ((Math.floor(ph) % n) + n) % n;
      const d = 1 + u * (HR - 1), a = PX.hash(i, cyc, 61) * 6.283 + (PX.hash(i, 1, 62) - 0.5) * 0.25 * u * Li, rr = R + d, f = 1 - d / HR;
      put(CX + Math.cos(a) * rr, CY + Math.sin(a) * rr, f > 0.8 ? 3 : f > 0.45 ? 1 : 0, 200);
    }
    for (let m = em - 1; m <= em; m++) {                                             // cincin kejut dari bola (umur 0.7 s sejak ujung ayunan)
      const age = t - evT(m), u = age / 0.7; if (u < 0 || u >= 1) continue;
      const r = R + 2 + u * 44, n = Math.round(r * 5);
      for (let k = 0; k < n; k++) { const g = (k / n) * 6.283; if (PX.hash(k, Math.floor(age * 30), 9) < 0.7 - u * 0.5) put(CX + Math.cos(g) * r, CY + Math.sin(g) * r, u < 0.3 ? 3 : u < 0.6 ? 2 : 1); }
    }
    const SC = [], SS = [], SW_ = []; for (let s = 1; s <= NSUB; s++) { const a = thAt(t - ((NSUB - s) / NSUB) / 60); SC.push(Math.cos(a)); SS.push(Math.sin(a)); SW_.push(0.5 + (0.5 * s) / NSUB); }   // jejak: sudut ayunan beberapa sub-langkah (≤1/60 s) ke belakang, lama = lebih redup
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {                        // sinar
      const dx = x + 0.5 - CX, dy = y + 0.5 - CY; let I = 0;
      for (let s = 0; s < NSUB; s++) {
        const u = Math.abs(dx * SC[s] + dy * SS[s]); if (u < R * 0.8 || u > Lb) continue;
        const v = -dx * SS[s] + dy * SC[s], w = 1.5 + u * 0.1, prof = Math.max(0, 1 - Math.abs(v) / w), Is = (1 - u / Lb) * Math.pow(prof, 0.8) * (0.85 + 0.15 * Math.sin(u * 0.6 - t * 29 * TP)) * SW_[s];   // denyut kecil mengalir sepanjang sinar
        if (Is > I) I = Is;
      }
      if (I > PX.bayer(x, y) * 0.9) put(x, y, Math.min(5, Math.floor(I * 6)));
    }
    const front = [], PXX = -sa, PYY = ca;                                           // medan dipol 3D: tiap garis punya azimut φ mengelilingi sumbu; titik belakang digambar sebelum bola (tertutup), titik depan sesudahnya
    [20, 29, 40].forEach((s0, si) => {                                               // r = s·cos²λ; posisi = al·sumbu + pe·(cosφ·p + sinφ·q); z>0 = menghadap kamera
      const s = s0 * (1 + 0.05 * Math.sin(t * 6 * TP + si)), dir = si % 2 ? -1 : 1, NA = 5;
      for (let a = 0; a < NA; a++) {
        const phi = (a / NA) * 6.2832 + si * 0.6 + t * TP * dir, cp = Math.cos(phi), sp = Math.sin(phi);   // azimut berputar pelan: garis tampak memutari bola
        for (let k = -90; k <= 90; k += 0.5) {                                       // langkah 0.5° agar garis menyambung
          const lam = (k * Math.PI) / 180, r = s * Math.cos(lam) ** 2; if (r < R + 0.6) continue;
          const al = r * Math.sin(lam), pe = r * Math.cos(lam), m = (((k + 90 + dir * t * (440 / LOOP)) % 40) + 40) % 40;   // m: posisi dalam siklus dash (40° per siklus)
          const x = CX + al * ca * CT + pe * (cp * PXX - sp * ST * ca), y = CY + al * sa * CT + pe * (cp * PYY - sp * ST * sa), z = al * ST + pe * sp * CT;
          const head = m < 4 ? 4 : m < 14 ? 3 : m < 26 ? 2 : -1;                      // kepala terang -> ekor -> celah pendek antar dash
          if (z > 0) { if (head >= 0) front.push([x, y, head]); if (m < 0.5) lit.glow(x, y, 4, V[3], 0.45); }   // inti (kepala) dash depan diberi glow
          else if (head >= 0) put(x, y, head > 2 ? 2 : 1);                             // sisi belakang: lebih gelap, nanti tertutup bola
        }
      }
    });
    for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) {                    // bola
      const nx = x / R, ny = y / R, r2 = nx * nx + ny * ny; if (r2 > 1) continue;
      const nz = Math.sqrt(1 - r2), X = x + CX | 0, Y = y + CY | 0;
      const ax = nx * CA_ + ny * SA_, ay = -nx * SA_ + ny * CA_, lon = Math.atan2(ax, nz) + t * SPIN, lat = Math.asin(PX.clamp(ay, -1, 1));   // pemetaan terbalik: piksel -> titik bola (sumbu miring) -> lon/lat
      const tu = (((lon / 6.2832) % 1) + 1) % 1, tx = (tu * TW) | 0, ty = PX.clamp(((lat / Math.PI + 0.5) * TH) | 0, 0, TH - 1);
      const sp = Math.min(1, TEX[ty * TW + tx] + CON[ty * TW + tx]), pn = PX.hash(tx, ty, 123);   // fl: bintik tetap di tekstur; sp: bercak; pn: butiran halus -> semuanya ikut berputar
      const cap = PX.clamp((Math.abs(ay) - 0.84) / 0.12, 0, 1);                                            // tutup putih di kutub sumbu putar (seperti bola PSR di game)
      let k = (0.42 + 0.58 * nz) * (1 - 0.45 * sp * sp * sp) + 0.8 * cap * cap * (3 - 2 * cap);                      // terang = menghadap kamera (emisif), bercak menggelapkan; tanpa arah cahaya
      if (r2 > 0.9) k = Math.min(k, 0.22);                                                                // cincin tepi gelap tipis -> siluet terbaca
      let ci = PX.clamp(Math.floor(k * 5 + PX.bayer(tx, ty) - 0.5), 0, 5);                                // 6 warna, dither di koordinat TEKSTUR -> ikut berputar
      if (r2 < 0.72 && nz > 0.5) { if (pn < 0.06) ci = Math.max(0, ci - 1); else if (pn > 0.97) ci = Math.min(5, ci + 1); }   // butiran halus
      put(X, Y, ci);
    }
    for (const f of front) put(f[0], f[1], f[2]);                                    // garis medan sisi depan menimpa bola
    for (let m = em - 2; m <= em; m++) for (const sg of [-1, 1]) for (let i = 0; i < 9; i++) {   // percikan dari ujung sinar: lintasan tertutup (redaman eksponensial), acak dari hash(kejadian mod 16) -> periodik
      const age = t - evT(m), sd = ((m % 16) + 16) % 16 * 2 + (sg < 0 ? 0 : 1), life = 0.35 + PX.hash(i, sd, 73) * 0.5, left = life - age; if (age < 0 || left <= 0) continue;
      const thm = BASE + SWING * evSign(m), g = thm + (sg < 0 ? Math.PI : 0) + (PX.hash(i, sd, 71) - 0.5) * 0.5, v = 20 + PX.hash(i, sd, 72) * 55, dd = (1 - Math.exp(-1.5 * age)) / 1.5;
      put(CX + Math.cos(thm) * sg * R + Math.cos(g) * v * dd, CY + Math.sin(thm) * sg * R + Math.sin(g) * v * dd, left > 0.48 ? 5 : left > 0.24 ? 3 : 2);
    }
    lit.glow(CX, CY, R + 5, V[4], 0.07);                                              // glow putih di sekitar bola
    lit.glow(CX, CY, 34 + 4 * pulse, V[1], 0.22 + 0.08 * pulse);   // cahaya: halo bintang + titik terang sepanjang sinar (lebih terang saat menyapu cepat)
    for (const sg of [-1, 1]) { lit.glow(CX + ca * sg * Lb * 0.35, CY + sa * sg * Lb * 0.35, 16, V[3], 0.14 + 0.16 * speed); lit.glow(CX + ca * sg * Lb * 0.75, CY + sa * sg * Lb * 0.75, 10, V[2], 0.1 + 0.12 * speed); }
    c.putImageData(img, 0, 0); lit.flush(c);
  };
  PX.loop(host, (dt, t) => draw(t));
  PX.gifButton(host, cv, draw, { loop: LOOP, scale: 4, name: 'pulsar' });   // unduh GIF: 6 detik @50 fps, frame ke-300 = frame 0 (loop mulus)
};
