// Sprite sheet prosedural: bake N frame -> 1 atlas dengan padding 1px, pivot bottom-center, posisi integer.
PX.bakeSheet = (frames = 6, FR = 32, pad = 1) => {
  const hr = document.createElement('canvas'); hr.width = hr.height = FR * 4;          // render halus 4× lebih besar
  const sheet = document.createElement('canvas');
  sheet.width = frames * FR + (frames + 1) * pad; sheet.height = FR + 2 * pad;           // pad di semua sisi
  const sc = sheet.getContext('2d'), rects = [];
  for (let f = 0; f < frames; f++) {
    PX.stickman(hr.getContext('2d'), (f / frames) * Math.PI * 2 / 6, hr.width);          // 1 siklus jalan penuh
    const x = pad + f * (FR + pad), y = pad;
    sc.putImageData(PX.pixelize(hr, FR), x, y);                                          // integer, tanpa skala
    rects.push({ x, y, w: FR, h: FR });
  }
  return { canvas: sheet, rects, FR, pad, pivot: { x: FR / 2, y: 28 } };                 // pivot = garis tanah (kaki)
};

PX.demos.sheet = (host) => {
  const sh = PX.bakeSheet(6, 32, 1), W = 192, H = 64, GY = 56;
  const view = PX.canvas(host, W, H, 576, false, 'Animasi: drawImage integer, pivot di kaki');
  const atlas = PX.canvas(host, sh.canvas.width, sh.canvas.height, sh.canvas.width * 3, false, 'Atlas (6 frame, pad 1px)');
  const info = document.createElement('pre'); info.className = 'info';
  info.textContent = sh.rects.map((r, i) => `frame ${i}: x=${r.x} y=${r.y} w=${r.w} h=${r.h}`).join('\n') + `\npivot: (${sh.pivot.x}, ${sh.pivot.y})`;
  host.appendChild(info);
  let grid = true;
  PX.ui(host).check('Tampilkan grid', true, (v) => (grid = v));
  const vc = view.getContext('2d'), ac = atlas.getContext('2d');
  vc.imageSmoothingEnabled = ac.imageSmoothingEnabled = false;
  PX.loop(host, (dt, t) => {
    vc.clearRect(0, 0, W, H); vc.fillStyle = '#2a2a3c'; vc.fillRect(0, GY, W, H - GY);
    const f = Math.floor(t * 10) % 6, r = sh.rects[f], x = Math.round(((t * 36) % (W + 32)) - 16);
    vc.drawImage(sh.canvas, r.x, r.y, r.w, r.h, x - sh.pivot.x, GY - sh.pivot.y, r.w, r.h);   // semua argumen integer
    ac.clearRect(0, 0, atlas.width, atlas.height); ac.drawImage(sh.canvas, 0, 0);
    if (grid) { ac.fillStyle = 'rgba(255,0,200,.55)'; sh.rects.forEach((q, i) => { ac.fillRect(q.x - 1, q.y - 1, q.w + 2, 1); ac.fillRect(q.x - 1, q.y + q.h, q.w + 2, 1); ac.fillRect(q.x - 1, q.y - 1, 1, q.h + 2); ac.fillRect(q.x + q.w, q.y - 1, 1, q.h + 2); }); }
    ac.fillStyle = '#0f0'; ac.fillRect(sh.rects[f].x + sh.pivot.x, sh.rects[f].y + sh.pivot.y, 1, 1);
  });
};
