# Selenium E2E

Suite ini menguji alur bisnis inti dan memastikan halaman utama SIPENA dapat dibuka menggunakan Chrome.

## Cakupan

- `full-regression.test.mjs`: 21 skenario autentikasi, pengguna, aset, peminjaman, pengembalian, pemeliharaan, validasi input, role, kontrol fitur utama, dan logout.
- `navigation-smoke.test.mjs`: smoke test seluruh halaman operasional utama.

## Persiapan

1. Gunakan Node.js sesuai `.nvmrc`.
2. Pastikan Chrome tersedia.
3. Jalankan backend dan frontend, atau jalankan stack Docker.
4. Salin `selenium.env.example.json` menjadi `selenium.env.json` dan isi akun admin khusus pengujian.

`selenium.env.json` dan seluruh screenshot diabaikan Git. Jangan memakai akun atau database produksi.

## Menjalankan

```bash
npm run test:selenium
```

Pilihan suite:

```bash
npm run test:selenium:core
npm run test:selenium:smoke
npm run test:selenium:smoke:headed
npm run test:selenium:core:headed
npm run test:selenium:headed
```

`test:selenium:smoke` membuka setiap fitur melalui klik menu sidebar, lalu
memvalidasi URL, judul, serta label fitur/kolom utama pada setiap halaman.
Urutan kunjungan menu dan pemeriksaan kontrol fitur menggunakan abjad Indonesia
agar hasil headed dan log screenshot mudah diikuti.
`test:selenium:core` menguji alur bisnis dan interaksi kontrol UI seperti form,
tab, filter, hak akses, arsip, laporan, dokumentasi, tab pemeliharaan, serta
bobot/ranking/riwayat SPK. Setup dan cleanup data
tetap dilakukan melalui API agar run dapat diulang secara konsisten, sedangkan
kontrol fitur diperiksa melalui klik browser. Screenshot full regression memakai
mode full-page sehingga seluruh panjang halaman dan kolom ikut tersimpan; panel
bukti ditampilkan sebagai kartu kecil yang konsisten di tengah tanpa mengubah
ukuran normal konten aplikasi. Alias
`npm run selenium:smoke:headed` juga tersedia untuk kompatibilitas.

Variabel opsional:

- `SELENIUM_BASE_URL`, default `http://localhost:3000`.
- `SELENIUM_TIMEOUT_MS`, default `20000` pada mode headless dan `60000` pada
  mode headed agar kompilasi halaman development tidak memicu false timeout.
- `SELENIUM_HEADLESS=false` untuk menampilkan Chrome.
- `SELENIUM_EVIDENCE_DELAY_MS` untuk mengatur lama panel hasil tampil; default
  `2500` ms pada mode headed dan `0` pada mode headless. Panel selalu dihapus
  sebelum skenario berikutnya dimulai agar pesan lama tidak tertinggal.
- `SELENIUM_STEP_DELAY_MS` untuk memberi jeda antarklik, pengisian form, dan
  navigasi; default `600` ms pada mode headed dan `0` pada mode headless.
- `SELENIUM_SCREENSHOT_DIR` untuk mengganti folder artefak.
- `SELENIUM_E2E_USERNAME` dan `SELENIUM_E2E_PASSWORD` sebagai alternatif file konfigurasi.

Suite regresi membuat data dengan prefix `SEL-AST-`/`E2E` dan mencoba membersihkannya setelah selesai. Gunakan database pengujian terpisah karena proses yang dihentikan paksa masih dapat meninggalkan data uji.

Folder screenshot (`selenium/screenshots` secara default, atau `SELENIUM_SCREENSHOT_DIR` bila diisi) dibersihkan otomatis setiap kali salah satu perintah `test:selenium*` dijalankan, sehingga hasil `-fail.png` dari run sebelumnya tidak tertinggal begitu skenario tersebut lulus di run berikutnya.
