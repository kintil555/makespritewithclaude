# Make Sprite With Claude

Blog statis berisi teknik agar Claude (atau AI lain) bisa membuat **sprite pixel art prosedural** yang bagus: render halus → grid piksel, palet + dithering, buffer piksel, sprite sheet, komposit sprite (outline/bayangan/flash), parallax berlapis, texturing prosedural (ramp, klaster, tile, bake, air), resep VFX, serta efek (tracer, ledakan, lubang, api, hujan, bola neutron/pulsar, black hole, fluida dan gelembung) dan karakter dari persamaan.

Situs: https://makespritewithclaude.pages.dev/ (Cloudflare Pages: preset None, tanpa build command, output dir kosong).

## Akses untuk AI
- `/llms.txt` — indeks + tautan markdown per artikel
- `/llms-full.txt` — seluruh isi + seluruh kode
- `/index.json` — metadata, `/md/<slug>.md` — tiap artikel, `/sitemap.xml`

## Struktur
```
content/*.md     artikel (frontmatter + {{demo:x}} / {{code:file}})
src/code/*.js    kode sumber tunggal: library (PX.*) + demo; ditampilkan di artikel dan di-bundle ke assets/px.js
build.mjs        generator statis (npm i && npm run build)
assets/          css, js, bundle
articles/ md/    hasil build (di-commit agar Pages langsung jalan)
```

## Menambah artikel
1. Tulis `content/<slug>.md` (`title`, `category`, `order`, `summary`).
2. Tambah kode di `src/code/NN-nama.js` (demo: `PX.demos.nama = (host) => {...}`).
3. `npm run build`, commit hasilnya.

Teknik dianalisis dari dua referensi (game stickman pixel milik pemilik repo dan bundel "Destroy Any Website" dari Sprite Fusion); seluruh kode di repo ini ditulis ulang dan orisinal.
