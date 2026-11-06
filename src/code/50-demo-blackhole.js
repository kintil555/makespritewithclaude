// Demo black hole: lensa per-piksel (latar bintang dibelokkan), disk elips berdoppler, halo di atas bayangan, partikel jatuh berputar. Klik = lempar serpihan.
PX.demos.blackhole = (host) => {
  const W = 160, H = 90, cv = PX.canvas(host, W, H, 800), c = cv.getContext('2d'), buf = new PX.Buf(W, H), star = new PX.Buf(W, H), lit = new PX.Light(W, H), p = PX.pointer(cv);
  const CX = W / 2, CY = H / 2 + 2, Rs = 9, rE = Rs * 1.4, rOut = Rs * 6, q = 0.2, rin = 1.4, rout = 3.5, REACH = Rs * 12.4, G = 5e5, SWIRL = 0.55;
  let tilt = -0.2, twist = 0.8, lens = true, flare = 0, t = 0, acc = 0;
  const RAMP = ['#3a0e16', '#701a17', '#ad2f17', '#e2561d', '#ff8a2a', '#ffb24a', '#ffd98c', '#fff2cf', '#ffffff'].map(PX.hex), BLUEW = PX.hex('#dcecff'), SHADOW = [2, 1, 5];
  const SHREDS = ['#e4ddf4', '#b5abd4', '#8b80b4', '#5d5488'].map(PX.hex), parts = [], R = PX.rng(7);
  const sm = (a, b, x) => { const k = PX.clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
  const ui = PX.ui(host);
  ui.range('Kemiringan', -0.5, 0.5, 0.02, tilt, (v) => (tilt = v)); ui.range('Twist lensa', 0, 1.6, 0.1, twist, (v) => (twist = v)); ui.check('Lensa gravitasi', true, (v) => (lens = v));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {                                    // latar: nebula berdither + bintang
    const n = Math.max(0, (PX.fbm(x / W * 3, y / H * 3, 5, 0, 0, 3) - 0.45) * 1.6), h = PX.hash(x, y, 3);
    if (h > 0.985) star.px(x, y, h > 0.995 ? [255, 255, 255] : h > 0.99 ? [180, 200, 255] : [255, 220, 180]); else if (n > PX.bayer(x, y)) star.px(x, y, [30, 14, 52]); else star.px(x, y, [8, 6, 16]);
  }
  const tex = (rho, th, tt) => {                                                               // tekstur disk: guratan spiral, tiap radius berputar dengan kecepatan ∝ ρ^-1.5 (Kepler)
    const a = th + 5 * Math.pow(rho, -1.5) * tt, streak = 0.66 + 0.2 * Math.sin(a * 6 + rho * 9.5) + 0.14 * Math.sin(a * 13 - rho * 21 + 1.7), lane = 0.78 + 0.22 * Math.cos(rho * 12.5 + Math.sin(a * 2) * 0.6);
    const knot = Math.max(0, Math.sin(a * 3 + rho * 7 + Math.sin(tt * 1.3) * 2) * Math.sin(a * 5 - rho * 11 + tt * 0.9));
    return streak * lane + knot * knot * knot * 0.55;
  };
  const tone = (I, x, y, blue) => {                                                            // intensitas -> ramp 9 warna + Bayer; ujung terang dibiru-putihkan (Doppler)
    if (I < 0.08 && PX.bayer(x, y) > I / 0.08) return null;
    const n = RAMP.length - 1, f = PX.clamp((I / 1.12) * n, 0, n); let i = Math.floor(f); if (f - i > PX.bayer(x, y)) i = Math.min(n, i + 1);
    return blue > 0.05 && i >= n - 2 ? PX.mix(RAMP[i], BLUEW, Math.min(1, blue)) : RAMP[i];
  };
  const lensPass = () => {                                                                     // buffer = star, tapi tiap piksel dekat lubang mengambil sampel dari posisi yang dibelokkan
    buf.d.set(star.d);
    if (!lens) return;
    for (let y = Math.max(0, Math.floor(CY - rOut)); y < Math.min(H, Math.ceil(CY + rOut)); y++) for (let x = Math.max(0, Math.floor(CX - rOut)); x < Math.min(W, Math.ceil(CX + rOut)); x++) {
      const dx = x + 0.5 - CX, dy = y + 0.5 - CY, r = Math.hypot(dx, dy); if (r >= rOut || r < 0.5) continue;
      const fade = sm(rOut * 0.45, rOut, r), s = ((r - (rE * rE) / r) / r) * (1 - fade) + fade, rot = -twist * Math.min(1.6, Math.pow(rE / r, 1.5)) * (1 - fade);
      const ux = dx * s, uy = dy * s, sx = Math.floor(CX + ux * Math.cos(rot) - uy * Math.sin(rot)), sy = Math.floor(CY + ux * Math.sin(rot) + uy * Math.cos(rot));
      buf.d[y * W + x] = sx < 0 || sy < 0 || sx >= W || sy >= H ? 0xff000000 : star.d[sy * W + sx];
    }
  };
  const hole = () => {
    const bright = 1 + 0.45 * Math.min(2, flare), tl = tilt + Math.sin(t * 1.7) * 0.04, ct = Math.cos(tl), st = Math.sin(tl), ext = Math.ceil(Rs * rout * 1.05) + 2, fl = 1 + Math.sin(t * 23) * 0.04 + Math.sin(t * 57) * 0.03;
    let blue = 0; const dop = (s) => { const D = 1 - 0.5 * s; blue = Math.max(0, D - 1.25) * 1.6; return Math.pow(D, 1.25); };
    for (let y = Math.floor(CY - ext); y <= Math.ceil(CY + ext); y++) for (let x = Math.floor(CX - ext); x <= Math.ceil(CX + ext); x++) {
      const dx = (x + 0.5 - CX) / Rs, dy = (y + 0.5 - CY) / Rs, u = dx * ct + dy * st, v = -dx * st + dy * ct, r = Math.hypot(u, v); if (r > rout * 1.05) continue;
      let I = 0, on = false; blue = 0;
      if (r >= 1) {
        const s = Math.max(0, -v / r), e = (r - 1) / (0.1 + 0.62 * Math.pow(s, 1.3));                 // halo: cakram sisi belakang yang terlipat di atas bayangan
        if (v < 0.25 && e < 1) { I = Math.max(I, (1 - Math.pow(e, 1.6)) * (0.72 + 0.28 * tex(rin + e * 1.5, Math.atan2(v, u), t)) * 0.9 * dop(u / r)); on = true; }
        const s2 = Math.max(0, v / r), e2 = (r - 1) / (0.04 + 0.2 * Math.pow(s2, 1.3));               // halo tipis di bawah
        if (v > -0.25 && e2 < 1) { I = Math.max(I, (1 - Math.pow(e2, 1.4)) * 0.5 * dop(u / r)); on = true; }
        if (r < 1.075 + 0.04 * flare) { I = Math.max(I, 1.05 * fl * (0.75 + 0.25 * dop(u / r))); on = true; }   // cincin foton
      }
      let shadow = r < 1; const rho = Math.hypot(u, v / q);
      if (rho >= rin && rho <= rout && (v >= 0 || r >= 1)) {                                       // cakram elips: ρ = jarak di bidang cakram (v diregangkan 1/q)
        const k = (rho - rin) / (rout - rin), Id = 1.25 * Math.pow(1 - k, 1.1) * (0.7 + 0.3 * sm(0, 0.05, k)) * (1 - sm(0.72, 1, k)) * tex(rho, Math.atan2(v / q, u), t) * dop(u / rho);
        if (v >= 0) { if (Id > 0.08) { I = Id; shadow = false; on = true; } } else if (Id > I) { I = Id; on = true; }   // v>=0 = sisi depan menutupi bayangan
      }
      const col = shadow || !on ? null : tone(I * bright, x, y, blue);
      if (!col) { if (r < 1) buf.px(x, y, SHADOW); continue; }
      buf.px(x, y, col);
      if (I * bright > 0.35 && ((x + y) & 1) === 0) lit.glow(x, y, 1.5, col, 0.1 * Math.min(1.3, I * bright));
    }
    lit.glow(CX, CY, Rs * 5.5, [255, 170, 90], 0.3 * bright); lit.glow(CX, CY, Rs * 2.2, [255, 225, 190], 0.14 * bright);
  };
  const spawn = (x, y, n) => { for (let i = 0; i < n; i++) { const a = Math.atan2(y - CY, x - CX) + R() * 0.8 - 0.4, d = Math.hypot(x - CX, y - CY) || 40, vt = 40 + R() * 60; parts.push({ x: x + R() * 4, y: y + R() * 4, vx: -Math.sin(a) * vt, vy: Math.cos(a) * vt, life: 1.8 + R(), col: SHREDS[(R() * 4) | 0] }); } };
  PX.loop(host, (dt) => {
    t += dt; flare -= flare * 3 * dt; acc += dt;
    if (acc > 0.5) { acc = 0; const a = R() * 6.283; spawn(CX + Math.cos(a) * 70, CY + Math.sin(a) * 40, 2); }
    for (const k of p.clicks.splice(0)) spawn(k.x, k.y, 14);
    for (let i = parts.length - 1; i >= 0; i--) {                                                  // gravitasi + pusaran + drag, dimakan bila masuk horizon
      const o = parts[i], dx = CX - o.x, dy = CY - o.y, d2 = dx * dx + dy * dy, d = Math.sqrt(d2) || 1;
      if (d < Rs * 0.9 || (o.life -= dt) <= 0) { if (d < Rs * 0.9) flare = Math.min(2.5, flare + 0.3); parts.splice(i, 1); continue; }
      const a = (G / (d2 + Rs * Rs)) * Math.min(1, (REACH - d) / (REACH * 0.25)) * dt, ux = dx / d, uy = dy / d;
      o.vx += (ux - uy * SWIRL) * Math.max(0, a); o.vy += (uy + ux * SWIRL) * Math.max(0, a); const drag = Math.min(0.2, (1 - Math.min(1, d / REACH)) * 1.4 * dt); o.vx -= o.vx * drag; o.vy -= o.vy * drag;
      o.x += o.vx * dt; o.y += o.vy * dt;
    }
    lit.clear(); lensPass(); hole();
    for (const o of parts) { const sp = Math.hypot(o.vx, o.vy) || 1, L = Math.min(8, 1 + sp * 0.03);                      // serpihan = garis pendek berekor searah kecepatan
      for (let s = 0; s <= L; s++) { const k = 1 - s / L; buf.px(o.x - (o.vx / sp) * s, o.y - (o.vy / sp) * s, PX.mix(PX.hex('#2a1a44'), o.col, k)); }
      lit.glow(o.x, o.y, 3, o.col, 0.25); }
    buf.flush(c); lit.flush(c);
  });
};
