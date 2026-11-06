// Bola neutron (proyektil): bola ter-shade 5 ambang Lambert + jejak disc memudar + percikan; mengenai target -> PX.Blast biru.
PX.drawOrb = (b, x, y, ang, R, ramp) => {
  const ca = Math.cos(ang), sa = Math.sin(ang), L = 18;
  for (let d = 0; d < L; d++) {                                         // jejak: disc mengecil + alpha turun
    const u = d / L, w = (1 - u) * R * 1.15 + 0.4, al = Math.pow(1 - u, 1.4) * (0.3 + Math.random() * 0.1);
    b.disc(x - ca * d, y - sa * d, w + 1.3, ramp[0], al * 0.5); b.disc(x - ca * d, y - sa * d, w, d < L * 0.4 ? ramp[2] : ramp[1], al);
  }
  b.disc(x, y, R + 2.6, ramp[1], 0.2); b.disc(x, y, R + 1.5, ramp[2], 0.32);
  const ox = Math.round(x), oy = Math.round(y), Ri = Math.ceil(R);
  for (let j = -Ri; j <= Ri; j++) for (let i = -Ri; i <= Ri; i++) {
    const d2 = i * i + j * j; if (d2 > R * R) continue;
    const nx = i / R, ny = j / R, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny)), l = Math.max(0, nx * -0.4 + ny * -0.5 + nz * 0.77);
    let col = l < 0.2 ? ramp[0] : l < 0.45 ? ramp[1] : l < 0.7 ? ramp[2] : l < 0.9 ? ramp[3] : ramp[4];
    if (d2 > (R - 1) * (R - 1) && l < 0.7) col = ramp[2];              // tepi lebih terang agar siluet terbaca
    b.px(ox + i, oy + j, col);
  }
  for (let i = 0; i < 3; i++) { const g = Math.random() * 6.28, d = R + 1 + Math.random() * 2.5; b.px(x + Math.cos(g) * d, y + Math.sin(g) * d, Math.random() < 0.5 ? ramp[4] : ramp[2]); }
};
PX.demos.neutron = (host) => {
  const W = 160, H = 90, cv = PX.canvas(host, W, H, 640), c = cv.getContext('2d'), buf = new PX.Buf(W, H), lit = new PX.Light(W, H), p = PX.pointer(cv);
  cv.style.background = '#12121c';
  const ramp = PX.PALS.neutron.c.map(PX.hex), orbs = [], blasts = []; let idle = 0.3;
  const shoot = (tx, ty) => { const a = Math.atan2(ty - 66, tx - 14); orbs.push({ x: 14, y: 66, a, tx, ty, t: 0 }); };
  PX.loop(host, (dt, t) => {
    for (const k of p.clicks.splice(0)) shoot(k.x, k.y);
    idle -= dt; if (idle <= 0) { idle = 2; if (!p.in) shoot(100 + Math.random() * 50, 20 + Math.random() * 50); }
    buf.clear(); lit.clear(); let shake = 0;
    for (let i = orbs.length - 1; i >= 0; i--) {
      const o = orbs[i], v = 130 * dt; o.x += Math.cos(o.a) * v; o.y += Math.sin(o.a) * v;
      if ((o.tx - o.x) * Math.cos(o.a) + (o.ty - o.y) * Math.sin(o.a) <= 0) { blasts.push(new PX.Blast(o.tx, o.ty, 15, PX.PALS.neutron)); orbs.splice(i, 1); continue; }
      PX.drawOrb(buf, o.x, o.y, o.a, 3.3 * (1 + Math.sin(t * 40) * 0.06), ramp); lit.glow(o.x, o.y, 11, ramp[2], 0.35);
    }
    for (let i = blasts.length - 1; i >= 0; i--) { blasts[i].step(dt); blasts[i].draw(buf); blasts[i].light(lit); shake = Math.max(shake, blasts[i].shake); if (blasts[i].done) blasts.splice(i, 1); }
    buf.flush(c); lit.flush(c); cv.style.transform = shake > 0.02 ? `translate(${((Math.random() - 0.5) * 5 * shake).toFixed(1)}px,${((Math.random() - 0.5) * 5 * shake).toFixed(1)}px)` : ''; c.fillStyle = '#5c5c78'; c.fillRect(8, 63, 8, 6);
  });
};
