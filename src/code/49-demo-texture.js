// Demo texturing: bake 1 tile ke indeks palet, tampilkan 3x3 untuk mengecek tile. Ganti material, mode dither, ukuran tile, kekuatan emboss.
PX.demos.texture = (host) => {
  let mat = 'stone', dither = 'cluster', S = 32, emb = 0.5, seed = 1, tile;
  const cv = PX.canvas(host, 96, 96, 480, false, '3×3 tile — garis sambungan tidak boleh terlihat'), c = cv.getContext('2d'), ui = PX.ui(host);
  const bake = () => { tile = PX.texCanvas(PX.bakeTex(mat, S, { dither, emb, seed })); draw(); };
  const draw = () => { c.clearRect(0, 0, 96, 96); c.imageSmoothingEnabled = false; for (let j = 0; j < 96 / S; j++) for (let i = 0; i < 96 / S; i++) c.drawImage(tile, i * S, j * S); };
  ui.select('Material', ['stone', 'grass', 'wood', 'brick', 'lava'], mat, (v) => { mat = v; bake(); });
  ui.select('Dither', [{ label: 'klaster + dither di batas', value: 'cluster' }, { label: 'dither penuh (noisy)', value: 'full' }, { label: 'tanpa dither (banding)', value: 'none' }], dither, (v) => { dither = v; bake(); });
  ui.select('Tile', ['16', '32'], String(S), (v) => { S = +v; bake(); });
  ui.range('Emboss', 0, 1.2, 0.1, emb, (v) => { emb = v; bake(); });
  ui.button('Seed baru', () => { seed = (seed * 7 + 3) % 97; bake(); });
  bake();
};
