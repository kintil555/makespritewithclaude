// Bola neutron (proyektil): bola ter-shade 5 ambang Lambert + bercak biru gelap yang ikut berputar + jejak disc memudar + percikan; mengenai target -> PX.Blast biru.
// spin = sudut putar bola (rad). Bercak = noise blok 3D pada titik permukaan yang diputar (sumbu putar miring), jadi bercak tampak berputar bersama bola.
PX.SPOT = [[14, 24, 112], [8, 13, 70]];                                // biru gelap (bercak) dan biru lebih gelap (inti bercak)
PX.drawOrb = (b, x, y, ang, R, ramp, spin = 0) => {
  const ca = Math.cos(ang), sa = Math.sin(ang), L = 18;
  for (let d = 0; d < L; d++) {                                         // jejak: disc mengecil + alpha turun
    const u = d / L, w = (1 - u) * R * 1.15 + 0.4, al = Math.pow(1 - u, 1.4) * (0.3 + Math.random() * 0.1);
    b.disc(x - ca * d, y - sa * d, w + 1.3, ramp[0], al * 0.5); b.disc(x - ca * d, y - sa * d, w, d < L * 0.4 ? ramp[2] : ramp[1], al);
  }
  b.disc(x, y, R + 2.6, ramp[1], 0.2); b.disc(x, y, R + 1.5, ramp[2], 0.32);
  const ox = Math.round(x), oy = Math.round(y), Ri = Math.ceil(R), cs = Math.cos(spin), ss = Math.sin(spin), TC = 0.9, TS = 0.44;   // TC/TS: kemiringan sumbu putar
  for (let j = -Ri; j <= Ri; j++) for (let i = -Ri; i <= Ri; i++) {
    const d2 = i * i + j * j; if (d2 > R * R) continue;
    const nx = i / R, ny = j / R, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny)), l = Math.max(0, nx * -0.4 + ny * -0.5 + nz * 0.77);
    let col = l < 0.2 ? ramp[0] : l < 0.45 ? ramp[1] : l < 0.7 ? ramp[2] : l < 0.9 ? ramp[3] : ramp[4];
    if (d2 > (R - 1) * (R - 1) && l < 0.7) col = ramp[2];              // tepi lebih terang agar siluet terbaca
    else {                                                              // bercak: putar titik permukaan (spin), miringkan sumbu, ambil noise blok 3D
      const rx = nx * cs + nz * ss, rz = -nx * ss + nz * cs, qy = ny * TC - rz * TS, qz = ny * TS + rz * TC;
      const h = PX.hash(Math.floor(rx * 1.8 + 8), Math.floor(qy * 1.8 + 8), Math.floor(qz * 1.8 + 8) + 31);
      if (h > 0.8) col = PX.SPOT[1]; else if (h > 0.6) col = PX.SPOT[0];
    }
    b.px(ox + i, oy + j, col);
  }
  for (let i = 0; i < 3; i++) { const g = Math.random() * 6.28, d = R + 1 + Math.random() * 2.5; b.px(x + Math.cos(g) * d, y + Math.sin(g) * d, Math.random() < 0.5 ? ramp[4] : ramp[2]); }
};
PX.demos.neutron = (host) => {
  const W = 160, H = 90, cv = PX.canvas(host, W, H, 640), c = cv.getContext('2d'), buf = new PX.Buf(W, H), lit = new PX.Light(W, H), p = PX.pointer(cv);
  cv.style.background = '#12121c';
  const ramp = PX.PALS.neutron.c.map(PX.hex), orbs = [], blasts = [], sparks = [], rings = [], flashes = [];
  const OX = 10, OY = 80, SPEED = 330, SPIN = 24; let idle = 0.3;   // meriam di pojok kiri-bawah -> lintasan miring; kecepatan tinggi
  const burst = (x, y, a, spread, n, v0, v1) => { for (let i = 0; i < n; i++) { const g = a + (Math.random() - 0.5) * spread, v = v0 + Math.random() * (v1 - v0); sparks.push({ x, y, vx: Math.cos(g) * v, vy: Math.sin(g) * v, life: 0.2 + Math.random() * 0.35, m: 0.55, ci: 2 + ((Math.random() * 3) | 0) }); } };
  const shoot = (tx, ty) => {
    const a = Math.atan2(ty - OY, tx - OX); orbs.push({ x: OX, y: OY, a, tx, ty, t: 0 });
    burst(OX + Math.cos(a) * 4, OY + Math.sin(a) * 4, a, 0.9, 14, 40, 150);       // semburan moncong
    rings.push({ x: OX + Math.cos(a) * 3, y: OY + Math.sin(a) * 3, t: 0, max: 0.22, r1: 11 }); flashes.push({ x: OX + 2, y: OY, t: 0, max: 0.16, r: 22, k: 0.7 });
  };
  PX.loop(host, (dt, t) => {
    for (const k of p.clicks.splice(0)) shoot(k.x, k.y);
    idle -= dt; if (idle <= 0) { idle = 1.5; if (!p.in) shoot(95 + Math.random() * 58, 8 + Math.random() * 38); }
    buf.clear(); lit.clear(); let shake = 0;
    for (let i = orbs.length - 1; i >= 0; i--) {
      const o = orbs[i], v = SPEED * dt; o.t += dt; o.x += Math.cos(o.a) * v; o.y += Math.sin(o.a) * v;
      if ((o.tx - o.x) * Math.cos(o.a) + (o.ty - o.y) * Math.sin(o.a) <= 0) {
        blasts.push(new PX.Blast(o.tx, o.ty, 15, PX.PALS.neutron)); burst(o.tx, o.ty, 0, 6.3, 26, 30, 170);
        rings.push({ x: o.tx, y: o.ty, t: 0, max: 0.35, r1: 26 }); flashes.push({ x: o.tx, y: o.ty, t: 0, max: 0.22, r: 40, k: 1 }); orbs.splice(i, 1); continue;
      }
      for (let n = 0; n < 2; n++) { const g = o.a + Math.PI + (Math.random() - 0.5) * 0.9, s = 20 + Math.random() * 60; sparks.push({ x: o.x - Math.cos(o.a) * 2, y: o.y - Math.sin(o.a) * 2, vx: Math.cos(g) * s, vy: Math.sin(g) * s, life: 0.15 + Math.random() * 0.3, m: 0.45, ci: 1 + ((Math.random() * 3) | 0) }); }   // percikan jejak
      PX.drawOrb(buf, o.x, o.y, o.a, 3.3 * (1 + Math.sin(t * 40) * 0.06), ramp, o.t * SPIN); lit.glow(o.x, o.y, 12, ramp[1], 0.22); lit.glow(o.x - Math.cos(o.a) * 7, o.y - Math.sin(o.a) * 7, 9, ramp[1], 0.22);
    }
    for (let i = blasts.length - 1; i >= 0; i--) { blasts[i].step(dt); blasts[i].draw(buf); blasts[i].light(lit); shake = Math.max(shake, blasts[i].shake); if (blasts[i].done) blasts.splice(i, 1); }
    for (let i = rings.length - 1; i >= 0; i--) {                                      // cincin kejut piksel (muncul di moncong & titik kena)
      const q = rings[i]; q.t += dt; const u = q.t / q.max; if (u >= 1) { rings.splice(i, 1); continue; }
      const r = q.r1 * (1 - Math.pow(1 - u, 2)), n = Math.max(12, Math.round(r * 5)), col = u < 0.4 ? ramp[4] : ramp[2];
      for (let k = 0; k < n; k++) { const g = (k / n) * 6.283; if (PX.hash(k, Math.round(q.t * 60), 3) < 0.85 - u * 0.5) buf.px(q.x + Math.cos(g) * r, q.y + Math.sin(g) * r, col, 1 - u); }
    }
    for (let i = sparks.length - 1; i >= 0; i--) {                                     // percikan: bergerak, melambat, memudar
      const s = sparks[i]; s.life -= dt; if (s.life <= 0) { sparks.splice(i, 1); continue; }
      s.x += s.vx * dt; s.y += s.vy * dt; s.vx *= 1 - 3 * dt; s.vy *= 1 - 3 * dt; s.vy += 18 * dt;
      buf.px(s.x, s.y, ramp[s.life > s.m * 0.5 ? s.ci : 1], Math.min(1, s.life / 0.15));
    }
    for (let i = flashes.length - 1; i >= 0; i--) { const f = flashes[i]; f.t += dt; if (f.t >= f.max) { flashes.splice(i, 1); continue; } lit.glow(f.x, f.y, f.r, ramp[3], f.k * Math.pow(1 - f.t / f.max, 1.5)); }
    buf.flush(c); lit.flush(c); cv.style.transform = shake > 0.02 ? `translate(${((Math.random() - 0.5) * 5 * shake).toFixed(1)}px,${((Math.random() - 0.5) * 5 * shake).toFixed(1)}px)` : ''; c.fillStyle = '#5c5c78'; c.fillRect(OX - 5, OY - 3, 8, 6);
  });
};
