// Demo: render halus (kiri) -> grid piksel (kanan). Ubah ukuran sel B untuk melihat efeknya.
PX.demos.hires = (host) => {
  const S = 192, hi = PX.canvas(host, S, S, 288, true, 'Render halus 192×192'), lo = PX.canvas(host, 48, 48, 288, false, 'Grid piksel');
  let N = 48;
  PX.ui(host).select('Ukuran sel B', [2, 3, 4, 6, 8], 4, (v) => { N = S / v; lo.width = lo.height = N; });
  PX.loop(host, (dt, t) => {
    PX.stickman(hi.getContext('2d'), t, S);
    lo.getContext('2d').putImageData(PX.pixelize(hi, N), 0, 0);
  });
};
