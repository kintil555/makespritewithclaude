// 21-stickman.js — rig stickman 2-bone IK, digambar halus (vektor). Tanah di y=168 (basis 192).
PX.ik = (a, b, l1, l2, s) => {           // titik sendi (lutut/siku) untuk 2 tulang
  const dx = b.x - a.x, dy = b.y - a.y, D = Math.hypot(dx, dy) || 1, d = Math.min(D, l1 + l2 - 0.01);
  const k = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - k * k));
  return { x: a.x + (dx / D) * k - (dy / D) * h * s, y: a.y + (dy / D) * k + (dx / D) * h * s };
};
PX.stickman = (c, t, S = 192) => {
  const P = PX.PAL, G = 168, p = t * 6, rgb = PX.rgb;
  c.clearRect(0, 0, S, S); c.save(); c.scale(S / 192, S / 192);
  c.lineCap = c.lineJoin = 'round'; c.lineWidth = 8;
  const hip = { x: 96, y: 90 - Math.abs(Math.cos(p)) * 5 }, sh = { x: hip.x + 6, y: hip.y - 48 };
  const leg = (i) => { const ph = p + i * Math.PI, f = { x: 96 + Math.sin(ph) * 28, y: G - Math.max(0, Math.cos(ph)) * 14 }; return [hip, PX.ik(hip, f, 44, 44, -1), f]; };
  const arm = (i) => { const ph = p + i * Math.PI, h = { x: sh.x - Math.sin(ph) * 22, y: sh.y + 36 }; return [sh, PX.ik(sh, h, 22, 22, 1), h]; };
  const limb = (q) => { c.beginPath(); c.moveTo(q[0].x, q[0].y); c.lineTo(q[1].x, q[1].y); c.lineTo(q[2].x, q[2].y); c.stroke(); };
  c.strokeStyle = rgb(P.B); limb(leg(1)); limb(arm(1));          // anggota belakang (warna B)
  c.strokeStyle = rgb(P.F);                                       // torso + kaki depan + kepala + lengan depan (warna F)
  c.beginPath(); c.moveTo(hip.x, hip.y); c.lineTo(sh.x, sh.y); c.stroke(); limb(leg(0));
  c.beginPath(); c.arc(sh.x + 4, sh.y - 18, 12, 0, Math.PI * 2); c.stroke(); limb(arm(0));
  c.restore();
};
