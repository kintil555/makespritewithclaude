---
title: Render halus lalu turunkan ke grid piksel
category: rendering
order: 10
summary: Teknik inti — gambar karakter sebagai vektor halus beresolusi tinggi, lalu ubah per sel menjadi piksel ber-shading dan ber-outline.
---
## Masalah
Menggambar karakter bergerak langsung dari piksel (garis Bresenham, rotasi manual) menghasilkan bentuk bergerigi tidak konsisten: lengan menipis, kepala berkedip, outline pecah. AI sangat sering gagal di sini.

## Ide
Pisahkan **bentuk** dari **gaya**:

1. Gambar rig (tulang + IK) dengan `lineTo`/`arc` biasa di canvas besar (anti-alias boleh).
2. Bagi canvas menjadi sel `B×B` piksel. Satu sel = satu piksel akhir.
3. Sel menjadi piksel jika **cakupan alpha ≥ 50%**. Ini menghilangkan piksel "sisa" dari anti-alias.
4. Tiap sel diberi kelas: depan atau belakang (dibedakan lewat warna sumber, mis. kanal merah).
5. Shading dari tetangga: sel tanpa tetangga di atas = **highlight**, tanpa tetangga di bawah = **shade**.
6. Sel kosong yang bersebelahan dengan siluet = **outline** 1 piksel.

Hasilnya: gerakan mulus (IK/vektor), tampilan tetap piksel tajam. Alpha output hanya 0 atau 255, jadi tidak ada halo.

{{demo:hires}}

Coba ubah `B`: `B=2` terlihat halus/detail, `B=8` kasar seperti sprite 24×24.

## Aturan
- `S / N` harus bilangan bulat (`S=192`, `N=48` → `B=4`).
- Ketebalan garis sumber ≈ `1.5–2 × B` agar anggota badan setebal 2 piksel.
- Warna depan dan belakang harus terpisah jelas pada satu kanal (di sini merah 238 vs 184).
- Jangan menggeser hasil dengan koordinat desimal; gambar ke layar dengan `drawImage` integer.

## Kode
Fungsi inti `PX.pixelize`:

{{code:20-pixelize}}

Rig stickman halus yang menjadi sumbernya (2-bone IK, `PX.ik`):

{{code:21-stickman}}

Kode demo:

{{code:30-demo-hires}}
