---
title: Resep VFX prosedural — dari ide ke efek piksel (pulsar, black hole, ledakan)
category: efek
order: 45
summary: Kerangka satu pola untuk membuat efek apa pun — fase waktu, bentuk dari persamaan per piksel, intensitas → ramp + Bayer, partikel berekor, glow additive, layer belakang/depan, game feel — beserta peta efek ke artikel contoh.
---
## Satu pola untuk semua efek
Pulsar, black hole, ledakan, api, hujan: semuanya tersusun dari bahan yang sama. Jika AI hafal pola ini, efek baru tinggal memilih bahan dan persamaan.

1. **Fase waktu.** Pecah efek jadi fase: *lahir* (0.2–0.5 dtk, ukuran overshoot), *hidup* (loop, bereaksi pada input), *akhir* (runtuh/memudar). Simpan satu `t` dan turunkan semua nilai dari fungsi `t`, bukan banyak timer terpisah.
2. **Bentuk dari persamaan, per piksel.** Untuk tiap piksel dalam kotak pembatas, hitung koordinat lokal lalu intensitas `I` 0..1.
3. **Intensitas → warna.** `I` dipetakan ke **ramp** 6–9 warna dengan **Bayer** (`idx = floor(I·(n−1) + bayer)`), bukan gradient. Lihat [palet & dither](dither-palette.html).
4. **Partikel** untuk hal yang bergerak bebas: garis pendek berekor searah kecepatan (bukan lingkaran blur).
5. **Cahaya** di buffer terpisah, additive: [glow](glow.html).
6. **Layer** *belakang* dan *depan* agar efek bisa menyelimuti karakter/objek.
7. **Game feel**: guncangan layar, kilat layar, riak/lensa — kecil tapi menentukan.

## Bentuk dasar (persamaan per piksel)
`dx, dy` = piksel dikurangi pusat (tambah 0.5 untuk pusat piksel). `u, v` = `dx, dy` diputar sebesar sudut sumbu.

| Bentuk | Persamaan |
|---|---|
| Disc | `dx²+dy² ≤ r²` |
| Cincin | `abs(hypot(dx,dy) − r) ≤ tebal/2` |
| Sinar / kerucut | `I = (1 − u/L)·(1 − abs(v)/w)^0.8`, lebar `w = w0 + k·u` |
| Elips (cakram miring) | `ρ = hypot(u, v/q)`, `q` = rasio miring (0.2 ≈ hampir tepi) |
| Spiral berputar | `sudut = θ + c·ρ^−1.5·t` (dalam lebih cepat, hukum Kepler) |
| Garis medan dipol | `r = s·cos²λ`; titik `(r·sinλ, ±r·cosλ)` |
| Gelombang kejut | cincin `r0 → r1` dengan `e = 1 − (1−k)³`, tebal mengecil |
| Halo cahaya | `(1 − d/r)²` di buffer additive |

## Fungsi waktu dan easing yang dipakai berulang
```js
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };   // 0->1 halus
const easeOut = (k) => 1 - (1 - k) ** 3;                                       // cepat lalu melambat: ledakan, gelombang
const pulse = (p, c, w) => Math.exp(-(((p - c) / w) ** 2));                    // satu denyut (lonceng) di posisi c
const heartbeat = (t, T = 0.85) => { const p = (t % T) / T; return pulse(p, 0.06, 0.045) + 0.7 * pulse(p, 0.26, 0.045); };
const overshoot = (k) => 1 + 1.7 * (k - 1) ** 3 + 0.7 * (k - 1) ** 2;           // lahir membesar lalu mengendap (k 0..1)
```

## Kerangka kode efek
```js
function makeFX({ x, y, life = 2, seed = 1 }) {
  const R = PX.rng(seed), parts = [], rings = [];
  let t = 0;
  return {
    update(dt) {
      t += dt;
      // 1) spawn partikel/cincin sesuai fase  2) gerakkan  3) buang yang mati (iterasi mundur + splice)
    },
    draw(buf, lit, layer) {            // layer: 'back' | 'front'
      // per piksel dalam kotak pembatas: hitung I -> ramp+Bayer -> buf.px ; cahaya -> lit.glow
    },
    done: () => t > life && parts.length === 0,   // pemanggil membuang efek setelah done
  };
}
```
Urutan gambar per frame: partikel belakang → objek/sprite → bentuk utama → partikel depan → cincin → `lit.flush()` (cahaya paling akhir).

## Partikel berekor (bukan lingkaran)
Hitung kecepatan `sp`, arah `(ux, uy) = v/sp`, panjang `L = min(maks, 1 + sp·k)`. Gambar dua segmen: ekor lebih gelap (`warna × 0.55`) lalu kepala terang. Di akhir umur (`life/max < 0.35`) hilangkan piksel dengan Bayer: `if (bayer(x,y) > k/0.35) skip` — memudar tanpa alpha.

## Reaktif: efek yang "makan" input
Efek hidup terasa nyata bila bereaksi. Pola `feed(jumlah)`: tiap benda yang diserap menambah `flare` (kecerahan sementara), `gulp` (radius berdenyut), `grow` (ukuran permanen kecil); semuanya meluruh eksponensial: `flare -= flare·3·dt`. Satu fungsi `feed` dipanggil dari partikel yang termakan, dari serpihan tanah, dan dari tembakan pemain — seluruh reaksi visual tinggal di satu tempat. Contoh lengkap di [black hole](black-hole.html).

## Game feel
- **Guncangan**: `trauma` 0..1 yang ditambah saat event dan meluruh; offset = `trauma²·amplitudo·noise`. Efek kecil → `0.006–0.1`, ledakan besar → `0.35–0.6`.
- **Kilat layar**: overlay warna alpha 0.7 meluruh 0.1–0.2 dtk saat momen puncak.
- **Riak/lensa**: distorsi lokal (lihat lensa di [black hole](black-hole.html)).
- Puncak efek selalu didahului **antisipasi** singkat (partikel tersedot, cincin menyempit) lalu **dampak**.

## Performa
- Loop piksel hanya di **kotak pembatas** efek (`radius·rout`), bukan seluruh layar.
- Buffer `Uint32` + satu `putImageData` ([buffer piksel](pixel-buffer.html)); jangan `fillRect` per piksel pada efek besar.
- Batasi partikel (mis. ≤ 300), hapus dengan iterasi mundur.
- `PX.loop` menghentikan animasi saat di luar layar; RNG ber-seed membuat efek bisa direproduksi.

## Peta efek → bahan
| Efek | Bentuk | Partikel | Cahaya | Artikel |
|---|---|---|---|---|
| Pulsar | bola ber-noise + 2 sinar + garis dipol | — | opsional | [neutron & pulsar](neutron-psr.html) |
| Black hole | elips cakram + halo + lensa | serpihan jatuh berputar | glow oranye | [black hole](black-hole.html) |
| Ledakan | cincin + puff disc | percikan | kilat + glow | [ledakan](explosion.html) |
| Api | disc membesar saat menua | asap | additive | [api](fire.html) |
| Hujan | garis jatuh 3 lapis | percikan | — | [hujan](rain.html) |
| Air, gelembung, percikan | permukaan berpegas / sel | tetes, gelembung | caustic | [fluida](fluid-system.html), [texturing air](water-texturing.html) |
| Tekstur material | height + ramp | — | — | [texturing](pixel-texturing.html) |

## Prosedur untuk AI saat diminta efek baru
1. Tuliskan 3–5 fase dan durasinya. 2. Pilih 1–2 bentuk dari tabel. 3. Pilih ramp (hue bergeser) dan warna aksen. 4. Tulis `update` (partikel, fase) lalu `draw` (bentuk, partikel, cahaya). 5. Tambah `feed`/reaksi jika efek berinteraksi. 6. Tambah satu guncangan dan satu kilat di puncak. 7. Render beberapa frame ke PNG dan **lihat** hasilnya diperbesar, sebelum menyetel angka.
