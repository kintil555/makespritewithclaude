---
title: Physics untuk karakter prosedural — jubah dan topi sihir
category: karakter
order: 105
summary: Rantai Verlet untuk jubah dan pegas-ke-pose untuk pucuk topi; physics hanya menghasilkan titik, bentuknya tetap digambar per-piksel sebagai kapsul meruncing.
---
## Prinsip: physics menghasilkan titik, bukan piksel
Karakter dari [artikel sebelumnya](procedural-character.html) digambar dengan *query per-piksel*. Physics tidak mengubah itu. Pisahkan dua tahap:

1. **Simulasi**: bagian lemas (jubah, pucuk topi, jenggot, rambut, syal) diwakili **rantai titik** `(x, y)`. Fisika hanya menggeser titik-titik ini.
2. **Render**: tiap piksel menanyakan "seberapa dekat aku ke rantai ini?" memakai **kapsul meruncing** (radius berubah di sepanjang rantai). Bentuk, shading, dan outline tetap lewat indeks palet seperti biasa.

Hasilnya tetap pixel art bersih (tanpa anti-alias), tapi gerakannya hidup. AI cukup menulis dua blok kecil: `step()` dan `draw()`.

## Jubah: rantai Verlet
Jubah = 9 titik, titik 0 **terkunci** di belakang leher (jangkar yang ikut karakter). Tiap langkah untuk titik `i ≥ 1`:

- **Inersia (Verlet)**: `v = (x − xPrev) · 0.985`; simpan `xPrev = x`; `x += v`. Tidak perlu menyimpan kecepatan, dan stabil.
- **Gravitasi** ke bawah ≈ 260 px/s².
- **Angin** ke samping, makin kuat ke ujung: `angin · 260 · (0.3 + 0.7·k)`, `k = i/(N−1)`. Angin = dua sinus berbeda frekuensi dikalikan agar terasa berhembus, bukan konstan. Hembusan sesaat = pulsa yang meluruh `gust *= exp(−dt·1.2)`.
- **Pegas lembut ke posisi istirahat** "menjuntai di belakang": `target = jangkar + (−arah·jarak·i·0.85, jarak·i·0.5)`, kekakuan kecil (≈10). Tanpa ini rantai jatuh lurus ke bawah dan tersembunyi di balik badan.
- **Batasan jarak**: ulangi 5 kali, untuk tiap pasangan titik koreksi selisih panjang dari `SL` (titik 0 tidak bergerak, sisanya dibagi dua). Iterasi lebih banyak = kain lebih kaku.
- **Lantai**: `y ≤ lantai − 1`, lalu samakan `yPrev = y` agar ujung jubah menyeret di tanah, bukan memantul.

Karena jangkar ikut bergerak, jubah **tertinggal otomatis** saat karakter berjalan dan **menyapu balik** saat berhenti. Itu semua efek inersia, tanpa kode animasi khusus.

## Pucuk topi: pegas ke pose, bukan rantai bebas
Rantai bebas yang hanya bergantung pada gravitasi akan layu. Pucuk topi harus **kembali tegak lalu memantul**. Caranya:

- Hitung **pose istirahat** tiap frame dari jangkar topi: titik demi titik, sudut bertambah (`a += 0.22`) sehingga pucuk melengkung ke belakang seperti topi penyihir klasik.
- Tiap titik `i ≥ 1` ditarik ke target pose-nya: `percepatan = (target − x)·ks + gravitasi`, dengan `ks ≈ 55–295`.
- **Redaman kecil** (`0.965` per langkah 60 Hz) = *underdamped*, jadi pucuk berayun beberapa kali sebelum diam. Ini yang membuatnya "mantul". Redaman besar (`0.9`) terasa seperti di dalam madu.
- Lalu batasan jarak 3 iterasi menjaga panjang tiap ruas.
- Satu slider cukup untuk karakter: "lemas" = `ks` turun dan gravitasi naik.

Karena target bergantung pada jangkar, kepala yang menyentak atau berhenti mendadak langsung memberi pucuk **dorongan awal**; pegas yang mengurus sisanya.

## Render: kapsul meruncing berantai
Untuk tiap ruas rantai `A→B` dengan radius `rA→rB`:

```js
t = clamp(dot(p−A, B−A) / |B−A|², 0, 1);      // titik terdekat di ruas
e = |p − (A + (B−A)·t)| / (rA + (rB−rA)·t);   // jarak dibagi radius lokal; e ≤ 1 = di dalam
```

Ambil `e` terkecil dari semua ruas. Dari satu kueri itu didapat semua shading:

- `e > 0.78` → warna tepi (shade), memberi volume.
- `cs = i + t` (posisi di sepanjang rantai) → **list emas** di jubah (`cs` pada rentang sempit di dekat ujung) dan **band** di topi.
- `cl` = `e` dengan **tanda sisi** (`sign(cross)`) → sorot cahaya: `cl < −0.3` = sisi terang (di jubah hanya `cs < 5`, bagian atas).
- **Cukup 3 tone per material** (dasar, gelap, terang). Jangan menambah garis lipatan, noise, atau dither: pada sprite sekecil ini semuanya terbaca sebagai kotor.

Radius jubah `2 → 7.5` (melebar ke ujung), radius topi `7 → 0.6` (runcing). Bentuk kain lahir dari kurva radius itu, bukan dari gambar.

**Urutan lapisan** (belakang ke depan): bayangan kontak → **jubah** → baju → sepatu → lengan → kepala → wajah → jenggot → **kerucut topi** → brim. Kerucut topi dipotong di garis brim (`y ≤ jangkarTopi.y + 1`) agar alasnya yang bulat tidak menutupi wajah; brim digambar terakhir sebagai elips pipih.

## Gaya sprite game: besar, bersih, tegas
Hasil awal terlalu "ramai" (piksel rapat, garis lipatan, bintang). Gaya game yang bagus justru **lebih sedikit detail**:

- **Resolusi rendah**: kanvas 80×52 (≈8 px layar per piksel); sprite ±35 piksel tinggi. Simulasi dan bentuk tetap di koordinat desain 112×72; tiap piksel kanvas mengambil sampel di `((x+.5)/S, (y+.5)/S)` dengan `S = 80/112`. Mengganti `S` = mengganti kerapatan piksel tanpa menyentuh physics.
- **Bentuk besar dan terbaca**: kepala, topi, badan = massa jelas; fitur wajah cukup 1 piksel (satu mata profil). Fitur lebih kecil dari 1 piksel kanvas akan hilang/berkedip saat sampling, jadi buat selebar ≥ 1.4 satuan desain (`1/S`).
- **Outline 1 piksel gelap berwarna** (`#120d24`, bukan hitam murni) dari siluet.
- **Bayangan jatuh**: piksel kosong yang tepat di kanan-bawah piksel sprite/outline diwarnai hitam 30% (`rgba(0,0,0,.31)`). Ini memberi kedalaman murah dan membuat siluet menonjol di latar abu-abu.
- **Latar polos**, tanpa bintang atau tanah bertekstur; cukup bayangan kontak elips di kaki.

## Menggerakkan karakternya
- **Jalan ke target** dengan pegas teredam kritis: `v += ((target − x)·6 − v·3.2)·dt`. Berhenti halus, tanpa overshoot, kecepatan dibatasi.
- **Arah** hanya berubah jika `|v| > 4` agar tidak menggeletar saat diam. Semua fitur wajah memakai koordinat `fx = (x − x0)·arah`, jadi menghadap kiri = cukup balik tanda.
- **Condong ke arah gerak**: `lean = clamp(v·0.045)`, bagian atas badan, jangkar jubah, dan jangkar topi bergeser; kaki tetap. Itulah yang memberi "dorongan" ke physics.
- **Bob + ayun**: `phase += |v|·dt·π/8` (satu siklus per 16 px, kaki tidak meluncur). Sepatu terangkat `max(0, sin(phase))`, lengan mengayun, jenggot tertinggal sebanding `v`.

## Aturan agar tidak meledak
- **Langkah tetap 1/60 s** dengan akumulator (`while (acc ≥ h) step()`). `dt` variabel membuat Verlet tidak stabil dan hasil GIF tidak sama antar komputer.
- **Jangkar selalu dikunci** (`titik[0] = jangkar`) sebelum batasan jarak dihitung.
- **Jangan menaruh physics di dalam loop piksel.** Simulasi satu kali per langkah; `draw()` hanya membaca array.
- **Clamp** kecepatan karakter dan semua posisi (lantai); tanpa clamp, satu hembusan bisa membawa titik ke tak hingga.
- **Float32Array** untuk titik; alokasi array baru per frame hanya untuk buffer indeks piksel.
- Tambah bagian lemas lain dengan resep yang sama: jenggot/rambut = rantai Verlet pendek, syal = Verlet, bulu/ekor = pegas-ke-pose.

## Prompt untuk AI
> Gambar penyihir pixel 80×52 per-piksel (query bentuk, bukan sprite manual), gaya game: 3 tone per material, outline 1 piksel, bayangan jatuh kanan-bawah, tanpa tekstur. Jubah = rantai Verlet 9 titik (jangkar di leher, gravitasi, angin, pegas lembut ke belakang, batasan jarak 5 iterasi, lantai), dirender sebagai kapsul meruncing dengan shading dari `e`, posisi rantai, dan sisi. Pucuk topi = rantai 5 titik yang ditarik pegas ke pose melengkung, redaman 0.965 agar memantul. Physics berjalan di langkah tetap 1/60 s. Karakter berjalan ke arah mouse dengan pegas teredam kritis dan condong ke arah gerak.

{{demo:wizard}}

Gerakkan mouse untuk menyuruh penyihir berjalan. Geser **Angin** dan **Pucuk topi lemas**, atau tekan **Hembusan**.

## Kode
{{code:54-demo-wizard}}
