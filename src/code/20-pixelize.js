// 20-pixelize.js — render halus resolusi tinggi -> grid piksel (tanpa menggambar model piksel manual)
// Langkah: (1) gambar vektor halus di canvas besar  (2) bagi jadi sel B×B  (3) sel jadi piksel bila
// cakupan alpha >= thr  (4) kelas warna depan/belakang  (5) tepi atas = highlight, tepi bawah = shade
// (6) tetangga kosong di sekitar siluet = outline 1 piksel.
PX.PAL = { F: [238, 122, 28], B: [184, 84, 26], HI: [255, 178, 90], FS: [214, 100, 14], BS: [140, 62, 18], OL: [40, 20, 10] };

PX.pixelize = (src, N, pal = PX.PAL, thr = 0.5) => {
  const S = src.width, B = S / N;                       // B harus integer
  const s = src.getContext('2d').getImageData(0, 0, S, S).data;
  const mid = (pal.F[0] + pal.B[0]) / 2;                // pembeda depan/belakang lewat kanal merah
  const cls = new Uint8Array(N * N);                    // 0 kosong, 1 depan, 2 belakang
  for (let cy = 0; cy < N; cy++) for (let cx = 0; cx < N; cx++) {
    let sa = 0, fw = 0, bw = 0;
    for (let y = 0; y < B; y++) for (let x = 0; x < B; x++) {
      const i = ((cy * B + y) * S + cx * B + x) * 4, a = s[i + 3];
      if (a) { sa += a; if (s[i] > mid) fw += a; else bw += a; }
    }
    if (sa / (B * B * 255) >= thr) cls[cy * N + cx] = fw >= bw ? 1 : 2;
  }
  const out = new ImageData(N, N), d = out.data;
  for (let cy = 0; cy < N; cy++) for (let cx = 0; cx < N; cx++) {
    const i = cy * N + cx, c = cls[i]; let col = null;
    if (c) {
      const up = cy === 0 || !cls[i - N], dn = cy === N - 1 || !cls[i + N];
      col = c === 1 ? (up ? pal.HI : dn ? pal.FS : pal.F) : (dn ? pal.BS : pal.B);
    } else if ((cx > 0 && cls[i - 1]) || (cx < N - 1 && cls[i + 1]) || (cy > 0 && cls[i - N]) || (cy < N - 1 && cls[i + N])) col = pal.OL;
    if (col) { d[i * 4] = col[0]; d[i * 4 + 1] = col[1]; d[i * 4 + 2] = col[2]; d[i * 4 + 3] = 255; }
  }
  return out;                                           // alpha hanya 0 atau 255 -> tidak ada halo
};
