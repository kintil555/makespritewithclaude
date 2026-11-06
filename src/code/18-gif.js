// 18-gif.js — PX.gif: encoder GIF89a (palet global 256 warna, LZW) + PX.gifButton: tombol "Unduh GIF" untuk demo yang periodik.
// Loop mulus = demo digambar sebagai fungsi waktu murni draw(t) yang periodik dengan periode `loop` detik; frame ke-N (t = N/fps) berikutnya identik dengan frame 0.
PX.gif = (frames, w, h, delayCs, scale = 1) => {                                  // frames: [Uint8ClampedArray RGBA w*h*4] sudah dikomposit (alpha 255)
  const B = 6, SH = 8 - B, KN = 1 << (3 * B), key = (r, g, b) => ((r >> SH) << (2 * B)) | ((g >> SH) << B) | (b >> SH);
  const cnt = new Int32Array(KN), sr = new Float64Array(KN), sg = new Float64Array(KN), sb = new Float64Array(KN);
  for (const f of frames) for (let i = 0; i < f.length; i += 4) { const k = key(f[i], f[i + 1], f[i + 2]); cnt[k]++; sr[k] += f[i]; sg[k] += f[i + 1]; sb[k] += f[i + 2]; }
  const ks = []; for (let k = 0; k < KN; k++) if (cnt[k]) ks.push(k);
  ks.sort((a, b) => cnt[b] - cnt[a]);
  const pal = ks.slice(0, 256).map((k) => [sr[k] / cnt[k], sg[k] / cnt[k], sb[k] / cnt[k]]); while (pal.length < 256) pal.push([0, 0, 0]);
  const near = new Int16Array(KN).fill(-1), nearest = (k) => {                       // palet terdekat untuk satu bucket warna (di-cache)
    if (near[k] >= 0) return near[k];
    const r = sr[k] / cnt[k], g = sg[k] / cnt[k], b = sb[k] / cnt[k]; let best = 0, bd = 1e9;
    for (let i = 0; i < 256; i++) { const d = (pal[i][0] - r) ** 2 + (pal[i][1] - g) ** 2 + (pal[i][2] - b) ** 2; if (d < bd) { bd = d; best = i; } }
    return (near[k] = best);
  };
  const W = w * scale, H = h * scale, out = [], u16 = (v) => out.push(v & 255, v >> 8);
  out.push(...[...'GIF89a'].map((c) => c.charCodeAt(0))); u16(W); u16(H); out.push(0xf7, 0, 0);
  for (const c of pal) out.push(Math.round(c[0]), Math.round(c[1]), Math.round(c[2]));
  out.push(0x21, 0xff, 0x0b, ...[...'NETSCAPE2.0'].map((c) => c.charCodeAt(0)), 3, 1, 0, 0, 0);   // loop tak hingga
  const table = new Int32Array(1 << 20), stamp = new Int32Array(1 << 20); let gen = 0;
  for (const f of frames) {
    const px = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) px[i] = nearest(key(f[i * 4], f[i * 4 + 1], f[i * 4 + 2]));
    const idx = new Uint8Array(W * H);                                              // perbesar skala bulat (nearest) agar piksel tetap tajam
    for (let y = 0; y < H; y++) { const sy = ((y / scale) | 0) * w, o = y * W; for (let x = 0; x < W; x++) idx[o + x] = px[sy + ((x / scale) | 0)]; }
    out.push(0x21, 0xf9, 4, 4); u16(delayCs); out.push(0, 0);                       // disposal 1, delay
    out.push(0x2c); u16(0); u16(0); u16(W); u16(H); out.push(0, 8);                 // image descriptor + min code size 8
    gen++; let size = 9, next = 258, cur = 0, nb = 0, blk = [];
    const put = (b) => { blk.push(b); if (blk.length === 255) { out.push(255, ...blk); blk = []; } };
    const emit = (code) => { cur |= code << nb; nb += size; while (nb >= 8) { put(cur & 255); cur >>>= 8; nb -= 8; } };
    emit(256); let prefix = idx[0];
    for (let i = 1; i < idx.length; i++) {
      const k = idx[i], kk = (prefix << 8) | k;
      if (stamp[kk] === gen) { prefix = table[kk]; continue; }
      emit(prefix);
      if (next === 4096) { emit(256); gen++; size = 9; next = 258; }
      else { if (next >= 1 << size) size++; table[kk] = next++; stamp[kk] = gen; }
      prefix = k;
    }
    emit(prefix); emit(257); if (nb > 0) put(cur & 255);
    if (blk.length) out.push(blk.length, ...blk); out.push(0);
  }
  out.push(0x3b);
  return new Blob([new Uint8Array(out)], { type: 'image/gif' });
};

// Perekam: frameFn(k) memajukan/menggambar frame ke-k pada kanvas cv; hasil dibaca, dikomposit di atas warna latar `bg`, lalu dienkode. Tombol menampilkan progres.
PX.gifRecord = async (btn, cv, frameFn, { n, fps, scale, bg, name }) => {
  if (btn.disabled) return; btn.disabled = true; const label = btn.textContent;
  try {
    const c = cv.getContext('2d', { willReadFrequently: true }), frames = [];
    for (let k = 0; k < n; k++) {
      frameFn(k);
      const d = c.getImageData(0, 0, cv.width, cv.height).data, f = new Uint8ClampedArray(d.length);
      for (let i = 0; i < d.length; i += 4) { const a = d[i + 3] / 255; f[i] = d[i] * a + bg[0] * (1 - a); f[i + 1] = d[i + 1] * a + bg[1] * (1 - a); f[i + 2] = d[i + 2] * a + bg[2] * (1 - a); f[i + 3] = 255; }
      frames.push(f);
      if (k % 10 === 9) { btn.textContent = `Merender ${Math.round(((k + 1) / n) * 100)}%`; await new Promise((r) => setTimeout(r)); }
    }
    btn.textContent = 'Menyusun GIF…'; await new Promise((r) => setTimeout(r, 20));
    const url = URL.createObjectURL(PX.gif(frames, cv.width, cv.height, Math.round(100 / fps), scale)), a = document.createElement('a');   // delay GIF satuan 1/100 s: 50 fps = 2 (batas terkecil yang dihormati browser)
    a.href = url; a.download = name + '.gif'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
  } catch (e) { console.error(e); alert('Gagal membuat GIF: ' + e.message); }
  btn.textContent = label; btn.disabled = false;
};
PX.gifBtn = (host, run) => {                                                       // tombol di bar kontrol demo (pakai bar yang sudah ada, kalau tidak buat baru)
  let bar = host.querySelector(':scope > .ctl'); if (!bar) { PX.ui(host); bar = host.querySelector(':scope > .ctl'); }
  const b = document.createElement('button'); b.type = 'button'; b.textContent = 'Unduh GIF'; b.onclick = () => run(b); bar.appendChild(b); host.dataset.gif = '1'; return b;
};
const GIF_FPS = 50;                                                                // GIF hanya punya resolusi 1/100 s -> 50 fps adalah yang tercepat yang dihormati browser (live ≈ 60 fps)

// Demo periodik (frame ke-n == frame 0): draw(t) fungsi murni, `loop` detik, GIF berputar mulus.
PX.gifButton = (host, cv, draw, o = {}) => {
  const { loop = 6, fps = GIF_FPS, scale = 4, bg = '#0a0a16', name = 'demo' } = o;
  return PX.gifBtn(host, (b) => PX.gifRecord(b, cv, (k) => draw(k / fps), { n: Math.round(loop * fps), fps, scale, bg: PX.hex(bg), name }));
};

// Demo apa saja yang memakai PX.loop (tidak harus loop mulus): merekam `sec` detik dengan langkah dt tetap 1/fps, melanjutkan dari keadaan simulasi saat ini.
PX.gifAuto = (host, { sec = 5, fps = GIF_FPS } = {}) => {
  const loops = host._loops; if (!loops || host.dataset.gif) return;
  const cv = [...host.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0]; if (!cv) return;
  const bgOf = (el) => { for (; el; el = el.parentElement) { const m = getComputedStyle(el).backgroundColor.match(/[\d.]+/g); if (m && (m.length < 4 || +m[3] > 0)) return m.slice(0, 3).map(Number); } return [255, 255, 255]; };
  const scale = PX.clamp(Math.round(560 / cv.width), 1, 4), name = host.dataset.demo || 'demo';
  PX.gifBtn(host, async (b) => {
    loops.forEach((l) => (l.rec = true));
    try { await PX.gifRecord(b, cv, () => loops.forEach((l) => l.step(1 / fps)), { n: Math.round(sec * fps), fps, scale, bg: bgOf(cv), name }); }
    finally { loops.forEach((l) => (l.rec = false)); }
  });
};
