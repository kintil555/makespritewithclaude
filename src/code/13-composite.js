// 13-composite.js — sprite berindeks + komposit bertahap dari MASK: bayangan -> outline -> badan (+ flash, tint sisi jauh).
// Sprite = { w, h, idx (0 kosong, 1.. indeks palet), far (1 = bagian sisi jauh), pal }.
PX.mix = (a, b, t) => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t));

PX.fromAscii = (rows, legend) => {           // '.' = kosong; legend: { huruf: { col: [r,g,b], far?: true } }
  const h = rows.length, w = rows[0].length, idx = new Uint8Array(w * h), far = new Uint8Array(w * h), pal = [null], id = {};
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '.') return;
    if (!id[ch]) { id[ch] = pal.length; pal.push(legend[ch].col); }
    idx[y * w + x] = id[ch]; far[y * w + x] = legend[ch].far ? 1 : 0;
  }));
  return { w, h, idx, far, pal };
};

// o: { flip, outline: [r,g,b], shadow: alpha, tint: { col, k }, flash: [r,g,b] }. x,y = pojok kiri-atas, SELALU dibulatkan (snap).
PX.drawSprite = (buf, s, x, y, o = {}) => {
  x = Math.round(x); y = Math.round(y);
  const { w, h, idx, far, pal } = s;
  const q = (i, j) => (i < 0 || j < 0 || i >= w || j >= h ? -1 : j * w + (o.flip ? w - 1 - i : i));   // flip membalik idx & far sekaligus
  const solid = (i, j) => { const k = q(i, j); return k >= 0 && idx[k] > 0; };
  const cells = [];                                          // [i, j, k]; k = -1 -> sel outline
  for (let j = -1; j <= h; j++) for (let i = -1; i <= w; i++) {   // padding 1 sel agar outline di tepi sprite tidak terpotong
    if (solid(i, j)) cells.push([i, j, q(i, j)]);
    else if (o.outline && (solid(i - 1, j) || solid(i + 1, j) || solid(i, j - 1) || solid(i, j + 1))) cells.push([i, j, -1]);
  }
  if (o.shadow) for (const [i, j] of cells) buf.px(x + i + 1, y + j + 1, [0, 0, 0], o.shadow);   // 1) bayangan: badan + outline digeser (+1,+1)
  for (const [i, j, k] of cells) {                           // 2) badan/outline opaque di atas bayangan
    let c = o.outline;
    if (k >= 0) {
      c = pal[idx[k]];
      if (far[k] && o.tint) c = PX.mix(c, o.tint.col, o.tint.k);   // sisi jauh -> dicampur warna gelap
      if (o.flash) c = o.flash;                                    // flash hanya mengganti badan, bukan outline
    }
    buf.px(x + i, y + j, c, 1);
  }
};
