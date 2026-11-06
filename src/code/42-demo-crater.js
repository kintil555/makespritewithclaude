// Lubang & kerusakan berbasis ELEMEN (sistem Sprite Fusion). Halaman = grid sel; tiap sel punya pemilik (elemen).
// - carve(x,y,r,irr): hapus sel dalam radius tak beraturan; tiap sel hilang menambah blok.lost.
// - Kekerasan elemen: hp = 20 + k*sqrt(luas dunia), k = 0.4 (kotak/teks) atau 0.32 (gambar). Elemen kecil rapuh, besar kokoh.
// - damageBlock: damage += dmg; retak di 30/55/80% hp; lepas jadi serpihan jatuh bila damage>=hp ATAU lost>=38% sel (jika canDetach).
// - canDetach=false untuk elemen sangat besar (luas >= 28% layar): hanya berlubang, tidak pernah copot.
PX.demos.crater = (host) => {
  const W = 240, H = 135, E = 2, cv = PX.canvas(host, W, H, 640), c = cv.getContext('2d'), p = PX.pointer(cv), rnd = PX.rng(11), R = Math.random;
  const N = W * H, img = new ImageData(W, H), back = new Uint8ClampedArray(N * 4), owner = new Int16Array(N), hole = new Uint8Array(N);
  let blocks, debris = [], heat = [], chunks = [], dmgTxt = [];
  const hash = PX.hash;
  const mul = (i, k) => { for (let j = 0; j < 3; j++) img.data[i * 4 + j] *= k; };
  const rect = (x, y, w, h, col, o, nz = 6) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) { if (i < 0 || j < 0 || i >= W || j >= H) continue; const k = j * W + i, n = (hash(i, j, 5) - 0.5) * nz; img.data.set([col[0] + n, col[1] + n, col[2] + n, 255], k * 4); owner[k] = o; } };
  function build() {
    img.data.fill(0); owner.fill(-1); hole.fill(0); debris = []; heat = []; chunks = [];
    const B = (kind, x, y, w, h, extra = {}) => ({ kind, x, y, w, h, damage: 0, lost: 0, alive: true, cells: 0, flash: 0, ...extra });
    blocks = [B('halaman', 0, 0, W, H), B('navbar', 0, 0, W, 14), B('gambar', 6, 22, 132, 70), B('kartu', 146, 22, 88, 46), B('tombol', 146, 76, 40, 14), B('tombol', 194, 76, 40, 14), B('teks', 8, 98, 150, 28), B('ikon', 170, 100, 22, 22), B('ikon', 204, 100, 28, 24)];
    blocks.forEach((b, i) => {
      const a = b.w * E * b.h * E;                                        // luas dalam satuan dunia (1 sel = E satuan)
      b.hp = 20 + (b.kind === 'gambar' ? 0.32 : 0.4) * Math.sqrt(a);
      b.canDetach = a < 0.28 * W * E * H * E;                             // elemen sangat besar tidak bisa copot
    });
    rect(0, 0, W, H, [34, 34, 52], 0, 8);
    rect(0, 0, W, 14, [58, 64, 110], 1); rect(0, 13, W, 1, [30, 34, 70], 1); rect(10, 5, 30, 4, [220, 220, 240], 1); [120, 150, 180, 210].forEach((x) => rect(x, 5, 18, 4, [150, 156, 200], 1));
    const g = blocks[2]; for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) { const t = y / g.h, k = (g.y + y) * W + g.x + x; const ridge = 38 + Math.sin(x * 0.09) * 9 + Math.sin(x * 0.23) * 4; const col = y > ridge ? [40 + (y - ridge) * 0.4, 94 - (y - ridge) * 0.3, 70] : [120 + t * 90, 160 + t * 50, 230 - t * 20]; img.data.set([...col.map((v) => PX.clamp(v + (hash(x, y, 3) - 0.5) * 8, 0, 255)), 255], k * 4); owner[k] = 2; }
    for (let y = -7; y <= 7; y++) for (let x = -7; x <= 7; x++) if (x * x + y * y <= 49) { const k = (32 + y) * W + 100 + x; img.data.set([255, 224, 120, 255], k * 4); owner[k] = 2; }
    rect(146, 22, 88, 46, [226, 222, 210], 3); rect(146, 22, 88, 8, [200, 90, 60], 3); rect(152, 36, 50, 3, [90, 86, 80], 3); for (let i = 0; i < 4; i++) rect(152, 44 + i * 5, 60 + ((i * 17) % 20), 2, [150, 146, 138], 3);
    for (const i of [4, 5]) { const b = blocks[i]; rect(b.x, b.y, b.w, b.h, i === 4 ? [255, 138, 42] : [110, 160, 255], i); rect(b.x + 4, b.y + 5, b.w - 8, 3, [255, 255, 255], i, 0); }
    rect(8, 98, 150, 28, [52, 52, 76], 6); for (let i = 0; i < 4; i++) rect(12, 102 + i * 6, 100 + ((i * 29) % 40), 2, [180, 180, 205], 6);
    rect(170, 100, 22, 22, [120, 220, 150], 7); rect(176, 106, 10, 10, [30, 90, 50], 7); rect(204, 100, 28, 24, [230, 120, 180], 8); rect(212, 108, 12, 8, [120, 30, 70], 8);
    for (let i = 0; i < N; i++) { const o = owner[i]; if (o >= 0) blocks[o].cells++; const f = 0.85; for (let j = 0; j < 3; j++) back[i * 4 + j] = 44 * f + ((hash(i % W, (i / W) | 0, 8) - 0.5) * 7) + (j === 2 ? 8 : 0); back[i * 4 + 3] = 255; }
  }
  const alive = (x, y) => x >= 0 && y >= 0 && x < W && y < H && !hole[y * W + x];
  function shade(x0, y0, x1, y1) {                                        // dinding belakang + bayangan di bawah bibir atas
    for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) {
      const i = y * W + x; if (!hole[i]) continue;
      let k = 0; for (let q = 2; q <= 5; q++) if (alive(x - ((q + 1) >> 1), y - q)) { k = q; break; }
      const s = k && k <= 2 ? 0.55 : k === 3 && 0.6 > PX.bayer(x, y) ? 0.55 : k === 4 && 0.3 > PX.bayer(x, y) ? 0.55 : 1;
      for (let j = 0; j < 3; j++) img.data[i * 4 + j] = back[i * 4 + j] * s; img.data[i * 4 + 3] = 255;
    }
  }
  function take(i, spall) {                                               // satu sel hilang (take() Sprite Fusion)
    if (hole[i]) return false; hole[i] = 1; const o = owner[i]; if (o >= 0) blocks[o].lost++;
    if (spall && debris.length < 260 && R() < 0.3) { const x = i % W, y = (i / W) | 0, a = R() * 6.283, v = 30 + R() * 90; debris.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, life: 0.5 + R() * 0.6, c: Array.from(img.data.slice(i * 4, i * 4 + 3)) }); }
    return true;
  }
  function carve(cx, cy, r, irr, spall = true) {                          // tepi tak beraturan: 3 sinus (3, 7, 13 lobus) dengan fase acak
    const X = R() * 6.28, Q = R() * 6.28, Z = R() * 6.28, K = 0.4 + R() * 0.6, K2 = 0.4 + R() * 0.6, J = r * (1 + irr * 1.6) + 1, hit = new Set(), carved = [];
    for (let y = Math.max(0, Math.floor(cy - J)); y <= Math.min(H - 1, Math.ceil(cy + J)); y++) for (let x = Math.max(0, Math.floor(cx - J)); x <= Math.min(W - 1, Math.ceil(cx + J)); x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy); if (d > J) continue;
      const a = Math.atan2(dy, dx), kt = r * (1 + irr * (K * Math.sin(3 * a + X) * 0.6 + K2 * Math.sin(7 * a + Q) * 0.4 + Math.sin(13 * a + Z) * 0.25));
      if (d <= kt) { const i = y * W + x, o = owner[i]; if (take(i, spall)) { carved.push(i); if (o >= 0) hit.add(o); } }
    }
    return { hit, carved, J };
  }
  function scorch(cx, cy, r, wid) {                                       // cincin hitam tipis + dither memudar keluar (hanya sel yang masih utuh)
    const E2 = Math.ceil(r + wid + 2);
    for (let y = Math.max(0, cy - E2); y <= Math.min(H - 1, cy + E2); y++) for (let x = Math.max(0, cx - E2); x <= Math.min(W - 1, cx + E2); x++) {
      const i = y * W + x; if (hole[i]) continue;
      let md = 99; for (let j = -3; j <= 3 && md > 1.5; j++) for (let k = -3; k <= 3; k++) if (alive(x + k, y + j) === false && x + k >= 0 && y + j >= 0 && x + k < W && y + j < H) md = Math.min(md, Math.hypot(j, k));
      if (md > wid) continue;
      if (md <= 1.5) { mul(i, 0.2); if (R() < 0.5) heat.push({ i, t: R() * 0.1 }); } else { const t = (md - 1.5) / (wid - 1.5); if (0.9 * Math.pow(1 - t, 1.15) > PX.bayer(x, y)) mul(i, 0.4); }
    }
  }
  function crack(x, y, bi, level, len) {                                  // retakan: jalan acak di dalam elemen, bercabang sesuai level
    for (let b = 0; b < level + 1; b++) { let px = x, py = y, a = R() * 6.283; for (let s = 0; s < len; s++) { a += (R() - 0.5) * 0.9; px += Math.cos(a); py += Math.sin(a); const i = Math.round(py) * W + Math.round(px); if (Math.round(px) < 0 || Math.round(py) < 0 || Math.round(px) >= W || Math.round(py) >= H) break; if (owner[i] === bi && !hole[i]) mul(i, 0.35); } }
  }
  function detach(bi, ix, iy, ex) {                                       // elemen copot: sel tersisa jadi sprite yang jatuh berputar
    const b = blocks[bi]; b.alive = false; const sp = document.createElement('canvas'); sp.width = b.w; sp.height = b.h; const sc = sp.getContext('2d'), id = sc.createImageData(b.w, b.h);
    for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) { const i = (b.y + y) * W + b.x + x; if (owner[i] === bi && !hole[i]) { id.data.set(img.data.subarray(i * 4, i * 4 + 4), (y * b.w + x) * 4); hole[i] = 1; } }
    sc.putImageData(id, 0, 0); shade(b.x - 6, b.y - 6, b.x + b.w + 6, b.y + b.h + 6);
    const area = Math.max(1, b.w * E * b.h * E), sp0 = Math.max(15, Math.min(380, 2600 / Math.sqrt(area))) / E, dx = b.x + b.w / 2 - ix, dy = b.y + b.h / 2 - iy, d = Math.hypot(dx, dy) || 1;
    chunks.push({ sp, w: b.w, h: b.h, x: b.x + b.w / 2, y: b.y + b.h / 2, vx: (dx / d) * sp0 * 1.4, vy: (dy / d) * sp0 * 1.4 - 60, a: 0, av: (R() * 3 - 1.5) * Math.min(3, 300 / Math.sqrt(area)), t: 0 });
    for (let k = 0; k < 14; k++) debris.push({ x: b.x + R() * b.w, y: b.y + R() * b.h, vx: (R() - 0.5) * 60, vy: -R() * 50, life: 0.5 + R() * 0.5, c: [200, 200, 210] });
  }
  function damageBlock(bi, dmg, ix, iy) {
    const b = blocks[bi]; if (!b || !b.alive) return;
    const u0 = b.damage / b.hp; b.damage += dmg; const u1 = b.damage / b.hp; b.flash = 0.25;
    [0.3, 0.55, 0.8].forEach((th, lv) => { if (u0 < th && u1 >= th) crack(PX.clamp(ix, b.x + 3, b.x + b.w - 3), PX.clamp(iy, b.y + 3, b.y + b.h - 3), bi, 2 + lv, Math.min(34, 5 + (Math.sqrt(b.w * b.h) * (0.2 + lv * 0.1)))); });
    if (!b.canDetach || (b.damage < b.hp && b.lost < b.cells * 0.38)) return;
    detach(bi, ix, iy);
  }
  const WEAPONS = { peluru: { r: 2.4, irr: 0.42, dmg: 14, tunnel: true }, roket: { r: 11, irr: 0.16, dmg: 90, splash: 34 }, bom: { r: 20, irr: 0.16, dmg: 170, splash: 60 } };
  let weapon = 'roket';
  function fire(x, y, wk = weapon) {
    const w = WEAPONS[wk], res = carve(x, y, w.r, w.irr), hit = res.hit;
    if (w.tunnel) {                                                       // peluru: tembus selama ada sel padat (2 lubang lanjutan makin kecil)
      const gx = 6, gy = H - 8, d = Math.hypot(x - gx, y - gy) || 1, ux = (x - gx) / d, uy = (y - gy) / d;
      for (const [j, t] of [[0.9, 0.72], [1.75, 0.5]]) { const ex = x + ux * w.r * j * 2.2, ey = y + uy * w.r * j * 2.2; if (alive(Math.floor(ex), Math.floor(ey))) { const r2 = carve(ex, ey, w.r * t, 0.5); r2.hit.forEach((o) => hit.add(o)); } }
      scorch(Math.round(x), Math.round(y), w.r, 2);
    } else scorch(Math.round(x), Math.round(y), w.r, 7);
    shade(Math.floor(x - w.r * 3), Math.floor(y - w.r * 3), Math.ceil(x + w.r * 3), Math.ceil(y + w.r * 3));
    hit.forEach((o) => damageBlock(o, w.dmg, x, y));
    if (w.splash) blocks.forEach((b, o) => { if (!b.alive || hit.has(o) || o === 0) return; const dx = Math.max(b.x - x, 0, x - (b.x + b.w)), dy = Math.max(b.y - y, 0, y - (b.y + b.h)), d = Math.hypot(dx, dy); if (d < w.splash) damageBlock(o, w.dmg * 0.7 * (1 - d / w.splash), x, y); });
    if (w.splash) for (let i = 0; i < 6; i++) { const a = R() * 6.283, v = 40 + R() * 100; debris.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, life: 0.3 + R() * 0.4, c: [255, 190 + R() * 60, 80] }); }
  }
  build();
  const ui = PX.ui(host);
  ui.select('Senjata', Object.keys(WEAPONS), 'roket', (v) => (weapon = v)); ui.button('Reset', build);
  const sx = document.createElement('canvas'); sx.width = W; sx.height = H; const sc = sx.getContext('2d'); let idle = 1, rst = 0;
  PX.loop(host, (dt) => {
    for (const k of p.clicks.splice(0)) { fire(k.x, k.y); rst = 0; }
    idle -= dt; rst += dt; if (idle <= 0 && !p.in) { idle = 1.4; const b = blocks[2 + ((R() * 7) | 0)]; if (b && b.alive) fire(b.x + R() * b.w, b.y + R() * b.h, ['peluru', 'roket', 'bom'][(R() * 3) | 0]); }
    if (rst > 22 && !p.in) { build(); rst = 0; }
    sc.putImageData(img, 0, 0); c.drawImage(sx, 0, 0);
    for (const h of heat) { h.t += dt; if (h.t < 0.75 && !hole[h.i]) { c.fillStyle = h.t < 0.3 ? '#ffb24a' : '#d9561c'; c.globalAlpha = (1 - h.t / 0.75) * 0.9; c.fillRect(h.i % W, (h.i / W) | 0, 1, 1); } }
    c.globalAlpha = 1; while (heat.length && heat[0].t > 0.75) heat.shift();
    c.imageSmoothingEnabled = false;
    for (let i = chunks.length - 1; i >= 0; i--) { const q = chunks[i]; q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 320 * dt; q.a += q.av * dt; if (q.t > 2.2 || q.y > H + 60) { chunks.splice(i, 1); continue; } c.save(); c.globalAlpha = Math.min(1, (2.2 - q.t) * 2); c.translate(Math.round(q.x), Math.round(q.y)); c.rotate(q.a); c.drawImage(q.sp, -q.w / 2, -q.h / 2); c.restore(); }
    for (let i = debris.length - 1; i >= 0; i--) { const d = debris[i]; d.x += d.vx * dt; d.y += d.vy * dt; d.vy += 260 * dt; d.life -= dt; if (d.life <= 0) { debris.splice(i, 1); continue; } c.fillStyle = PX.rgb(d.c); c.fillRect(Math.round(d.x), Math.round(d.y), 1, 1); }
    for (const b of blocks) { if (!b.alive || b.kind === 'halaman') continue; b.flash = Math.max(0, b.flash - dt); const k = Math.max(0, 1 - b.damage / b.hp);   // bar hp: terlihat saat baru kena
      if (b.damage > 0 && b.flash > 0 || (b.damage > 0 && k < 0.999)) { c.globalAlpha = b.flash > 0 ? 1 : 0.55; c.fillStyle = '#000'; c.fillRect(b.x + 1, b.y - 3 < 0 ? b.y + b.h + 1 : b.y - 3, Math.min(b.w - 2, 30) + 2, 3); c.fillStyle = k > 0.5 ? '#6dff9a' : k > 0.25 ? '#ffd24a' : '#ff5a4a'; c.fillRect(b.x + 2, b.y - 3 < 0 ? b.y + b.h + 2 : b.y - 2, Math.round(Math.min(b.w - 2, 30) * k), 1); c.globalAlpha = 1; } }
  });
};
