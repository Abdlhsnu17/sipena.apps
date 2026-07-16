# Selenium E2E

Suite ini menguji alur bisnis inti dan memastikan halaman utama SIPENA dapat dibuka menggunakan Chrome.

## Cakupan

- `full-regression.test.mjs`: 20 skenario autentikasi, pengguna, aset, peminjaman, pengembalian, pemeliharaan, validasi input, role, dan logout.
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
```

Variabel opsional:

- `SELENIUM_BASE_URL`, default `http://localhost:3000`.
- `SELENIUM_TIMEOUT_MS`, default `20000`.
- `SELENIUM_HEADLESS=false` untuk menampilkan Chrome.
- `SELENIUM_SCREENSHOT_DIR` untuk mengganti folder artefak.
- `SELENIUM_E2E_USERNAME` dan `SELENIUM_E2E_PASSWORD` sebagai alternatif file konfigurasi.

Suite regresi membuat data dengan prefix `SEL-AST-`/`E2E` dan mencoba membersihkannya setelah selesai. Gunakan database pengujian terpisah karena proses yang dihentikan paksa masih dapat meninggalkan data uji.
