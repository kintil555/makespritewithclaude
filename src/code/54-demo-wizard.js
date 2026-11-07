// Penyihir prosedural dengan physics: JUBAH = rantai Verlet (9 titik, dirender sebagai kapsul meruncing), PUCUK TOPI = rantai pegas ke pose istirahat (memantul).
// Semua digambar per-piksel (query bentuk), physics jalan di langkah tetap 1/60 s agar stabil. Gerakkan mouse: penyihir berjalan ke sana, jubah menjuntai, pucuk topi bergoyang.
PX.demos.wizard = (host) => {
  const W = 112, H = 72, GY = 63, cv = PX.canvas(host, W, H, 640, false, 'Penyihir — jubah dan pucuk topi ber-physics'), c = cv.getContext('2d'), img = c.createImageData(W, H), p = PX.pointer(cv), ui = PX.ui(host);
  cv.style.background = '#14102a';
  let wind = 0.35, floppy = 0.5, gust = 0;
  ui.range('Angin', 0, 1, 0.01, wind, (v) => (wind = v));
  ui.range('Pucuk topi lemas', 0, 1, 0.01, floppy, (v) => (floppy = v));
  ui.button('Hembusan', () => (gust = 1));
  const PAL = ['#00000000', '#120d24', '#6a3fb5', '#4a2a85', '#8f68e0', '#ffd166', '#3a56c8', '#26398f', '#6f8cf5', '#ffd0b8', '#e0a58a', '#eef1ff', '#aab4e0', '#2b3a8a', '#1c2566', '#4b5cc0', '#ffd166', '#1c1530', '#2a2050', '#0e0a20', '#cfd6ff', '#3a2d6b'].map((h) => (h.length > 7 ? [0, 0, 0, 0] : [...PX.hex(h), 255]));
  const [E, OL, CAPE, CAPES, CAPEL, TRIM, ROBE, ROBES, ROBEL, SKIN, SKINS, BEARD, BEARDS, HAT, HATS, HATL, BAND, EYE, GROUND, SHAD, STAR, GRL] = PAL.map((_, i) => i);
  const NC = 9, SL = 3.7, NH = 5, HL = 4.4, h = 1 / 60;                                            // NC titik jubah (jarak SL), NH titik topi (jarak HL)
  const CR = Array.from({ length: NC }, (_, i) => 2 + 5.5 * Math.pow(i / (NC - 1), 1.15));          // radius jubah: sempit di leher, melebar di ujung
  const HR = Array.from({ length: NH }, (_, i) => 0.6 + 6.4 * (1 - i / (NH - 1)));                  // radius topi: lebar di dasar, runcing di pucuk
  const cx = new Float32Array(NC), cy = new Float32Array(NC), cpx = new Float32Array(NC), cpy = new Float32Array(NC);   // jubah: posisi & posisi sebelumnya (Verlet)
  const hx = new Float32Array(NH), hy = new Float32Array(NH), hpx = new Float32Array(NH), hpy = new Float32Array(NH), tx_ = new Float32Array(NH), ty_ = new Float32Array(NH);
  let ox = W / 2, vx = 0, dir = 1, phase = 0, bob = 0, lean = 0, acc = 0, ts = 0, inited = false, mv = 0;
  let CA, HA;                                                                                      // jangkar: belakang leher (jubah) & atas kepala (topi)
  const hdY = () => GY - 35 - bob;                                                                  // pusat kepala

  const pose = () => {                                                                              // pose istirahat pucuk topi: melengkung ke belakang makin ke ujung
    let x = HA[0], y = HA[1], a = 0.12; tx_[0] = x; ty_[0] = y;
    for (let i = 1; i < NH; i++) { a += 0.22; x += -dir * Math.sin(a) * HL; y -= Math.cos(a) * HL; tx_[i] = x; ty_[i] = y; }
  };
  const solve = (X, Y, n, len, iters) => {                                                          // batasan jarak: titik 0 terkunci pada jangkar
    for (let k = 0; k < iters; k++) for (let i = 1; i < n; i++) {
      const dx = X[i] - X[i - 1], dy = Y[i] - Y[i - 1], d = Math.hypot(dx, dy) || 1e-6, f = (d - len) / d, w0 = i === 1 ? 0 : 0.5, w1 = i === 1 ? 1 : 0.5;
      X[i - 1] += dx * f * w0; Y[i - 1] += dy * f * w0; X[i] -= dx * f * w1; Y[i] -= dy * f * w1;
    }
  };
  const step = () => {
    ts += h; const t = ts;
    const tgt = p.in ? PX.clamp(p.x, 14, W - 14) : W / 2 + Math.sin(t * 0.55) * 34;                // target jalan: mouse, atau patroli otomatis
    vx = PX.clamp(vx + ((tgt - ox) * 6 - vx * 3.2) * h, -46, 46); ox += vx * h;                      // pegas teredam kritis -> berhenti halus
    if (Math.abs(vx) > 4) dir = vx > 0 ? 1 : -1;
    mv = Math.min(1, Math.abs(vx) / 20); phase += Math.abs(vx) * h * Math.PI / 8;
    bob = Math.abs(Math.sin(phase)) * 1.3 * mv + 0.5 * Math.sin(t * 2.2) * (1 - mv); lean = PX.clamp(vx * 0.045, -2.2, 2.2);
    CA = [ox - dir * 3.2 + lean * 0.9, GY - 28 - bob]; HA = [ox + dir * 0.8 + lean, hdY() - 3.2];
    pose(); gust *= Math.exp(-h * 1.2);
    const windF = wind * (0.55 + 0.45 * Math.sin(t * 1.7) * Math.sin(t * 0.43 + 1)) + gust * 1.2;     // hembusan: 2 sinus berbeda frekuensi
    if (!inited) { inited = true; for (let i = 0; i < NC; i++) { cx[i] = cpx[i] = CA[0]; cy[i] = cpy[i] = CA[1] + i * SL; } for (let i = 0; i < NH; i++) { hx[i] = hpx[i] = tx_[i]; hy[i] = hpy[i] = ty_[i]; } }
    cx[0] = CA[0]; cy[0] = CA[1];
    for (let i = 1; i < NC; i++) {                                                                  // Verlet jubah: inersia + gravitasi + angin + pegas lembut ke "menjuntai di belakang"
      const k = i / (NC - 1), vxx = (cx[i] - cpx[i]) * 0.985, vyy = (cy[i] - cpy[i]) * 0.985; cpx[i] = cx[i]; cpy[i] = cy[i];
      const rx = CA[0] - dir * SL * i * 0.85, ry = CA[1] + SL * i * 0.5;
      cx[i] += vxx + (windF * 260 * (0.3 + 0.7 * k) + (rx - cx[i]) * 10) * h * h;
      cy[i] += vyy + (260 + (ry - cy[i]) * 10) * h * h;
    }
    solve(cx, cy, NC, SL, 5);
    for (let i = 1; i < NC; i++) if (cy[i] > GY - 1) { cy[i] = GY - 1; cpy[i] = cy[i]; }            // lantai
    hx[0] = HA[0]; hy[0] = HA[1];
    const ks = 55 + 240 * (1 - floppy), gr = 60 + 360 * floppy;                                       // kaku pegas & gravitasi pucuk
    for (let i = 1; i < NH; i++) {                                                                  // pucuk topi: pegas ke pose istirahat, redaman kecil -> memantul
      const vxx = (hx[i] - hpx[i]) * 0.965, vyy = (hy[i] - hpy[i]) * 0.965; hpx[i] = hx[i]; hpy[i] = hy[i];
      hx[i] += vxx + ((tx_[i] - hx[i]) * ks + windF * 40) * h * h;
      hy[i] += vyy + ((ty_[i] - hy[i]) * ks + gr) * h * h;
    }
    solve(hx, hy, NH, HL, 3);
  };

  let cs = 0, cl = 0;                                                                               // hasil kueri rantai: indeks+t sepanjang rantai, posisi lateral bertanda (-1..1)
  const chain = (x, y, X, Y, R, n) => {                                                             // kapsul meruncing berantai: jarak ke tulang punggung / radius lokal
    let best = 9;
    for (let i = 0; i < n - 1; i++) {
      const dx = X[i + 1] - X[i], dy = Y[i + 1] - Y[i], tt = PX.clamp(((x - X[i]) * dx + (y - Y[i]) * dy) / (dx * dx + dy * dy), 0, 1);
      const qx = x - X[i] - dx * tt, qy = y - Y[i] - dy * tt, e = Math.hypot(qx, qy) / (R[i] + (R[i + 1] - R[i]) * tt);
      if (e < best) { best = e; cs = i + tt; cl = (qx * dy - qy * dx > 0 ? 1 : -1) * e; }
    }
    return best;
  };
  const seg = (x, y, ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay, t = PX.clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy), 0, 1); return Math.hypot(x - ax - dx * t, y - ay - dy * t); };

  const draw = (t) => {
    const idx = new Uint8Array(W * H), hcY = hdY(), hcX = ox + lean + dir * 0.6, nkY = GY - 29 - bob, blink = (t % 3.2) < 0.12;
    const sh = [ox + lean * 0.9 + dir * 0.5, GY - 26 - bob], sw = Math.sin(phase) * mv * 3.5 + 0.4 * Math.sin(t * 2), hand = [sh[0] + dir * (1.2 + sw), sh[1] + 10.5];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const px = x + 0.5, py = y + 0.5; let v = E;
      if (py > GY) v = ((px - ox) / 13) ** 2 + ((py - GY - 2) / 2.2) ** 2 <= 1 ? SHAD : py < GY + 1.5 ? GRL : GROUND;     // tanah + bayangan
      else if (PX.hash(x, y, 91) > 0.992) v = STAR;                                                  // bintang latar (statis)
      if (py <= GY + 0.5 && chain(px, py, cx, cy, CR, NC) <= 1) {                                    // jubah (paling belakang)
        const e = chain(px, py, cx, cy, CR, NC);
        v = e > 0.8 || Math.abs(Math.sin(cl * 3.2 + cs * 0.35)) > 0.86 ? CAPES : e < 0.4 && cs < 3.5 ? CAPEL : CAPE;
        if (cs > NC - 2.35 && cs < NC - 1.9) v = TRIM;                                               // list emas dekat ujung
      }
      const dxr = px - ox - lean * (1 - (GY - py) / 30), rw = 5 + (py - nkY) * 0.26;                // jubah baju (robe): condong ke arah gerak di atas, kaki tetap
      if (py >= nkY && py <= GY - 2 && Math.abs(dxr) <= rw) {
        v = Math.abs(dxr) / rw > 0.82 || py > GY - 4 ? ROBES : dxr < -rw * 0.4 ? ROBEL : ROBE;
        if (py > GY - 17 && py < GY - 15.5) v = BAND;                                               // sabuk
      }
      for (const s of [-1, 1]) {                                                                    // sepatu: kaki yang "melangkah" terangkat
        const lift = Math.max(0, Math.sin(phase + (s > 0 ? 0 : Math.PI))) * 2.2 * mv;
        if (((px - ox - s * 3.6 - dir * 0.8) / 2.8) ** 2 + ((py - (GY - 1 - lift)) / 1.5) ** 2 <= 1) v = HATS;
      }
      const ae = seg(px, py, sh[0], sh[1], hand[0], hand[1]) / 1.9;                                  // lengan dekat (ayun saat jalan)
      if (ae <= 1) v = ae > 0.62 ? ROBES : ROBEL;
      if (Math.hypot(px - hand[0], py - hand[1]) <= 1.6) v = SKIN;
      const hd = Math.hypot(px - hcX, py - hcY), fx = (px - hcX) * dir;                              // kepala
      if (hd <= 6 || (fx >= 5.4 && fx < 7 && py >= hcY + 1.5 && py < hcY + 3.5)) v = hd > 4.8 ? SKINS : SKIN;
      if (!blink && py >= hcY + 0.5 && py < hcY + 2.5 && ((fx >= 1 && fx < 2) || (fx >= 3.6 && fx < 4.6))) v = EYE;
      const db = py - (hcY + 2.5);                                                                  // jenggot: bergoyang tertinggal oleh kecepatan
      if (db >= 0 && db <= 11) {
        const half = 5.2 * Math.pow(1 - db / 12, 0.7), ex = px - (hcX + dir * 0.5 - PX.clamp(vx * 0.03, -1.5, 1.5) * (db / 11));
        if (Math.abs(ex) <= half) v = Math.abs(ex) > half - 1.2 || db > 9 ? BEARDS : BEARD;
      }
      if (py <= HA[1] + 1 && chain(px, py, hx, hy, HR, NH) <= 1) {                                   // kerucut topi (di atas brim saja)
        const e = chain(px, py, hx, hy, HR, NH);
        v = e > 0.75 ? HATS : cl < -0.35 ? HATL : HAT;
        if (cs > 0.25 && cs < 0.85) v = BAND;
      }
      if (((px - HA[0]) / 10) ** 2 + ((py - HA[1] - 1.2) / 2.3) ** 2 <= 1) v = py < HA[1] + 1.2 ? HAT : HATS;   // brim
      idx[y * W + x] = v;
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {                                       // outline 1 piksel dari siluet sprite (indeks 1..17)
      const i = y * W + x, sp = (j) => idx[j] > 0 && idx[j] < GROUND; let v = idx[i];
      if (!sp(i) && ((x > 0 && sp(i - 1)) || (x < W - 1 && sp(i + 1)) || (y > 0 && sp(i - W)) || (y < H - 1 && sp(i + W)))) v = OL;
      img.data.set(v === STAR ? (PX.hash(x, y, 92 + (Math.floor(t * 2) % 3)) > 0.4 ? PAL[STAR] : PAL[E]) : PAL[v], i * 4);
    }
    c.putImageData(img, 0, 0);
  };

  PX.loop(host, (dt, t) => { acc += dt; while (acc >= h) { step(); acc -= h; } draw(t); });
};
