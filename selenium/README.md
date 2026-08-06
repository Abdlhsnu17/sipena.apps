# Selenium E2E

Suite ini menguji alur bisnis inti dan memastikan halaman utama SIPENA dapat dibuka menggunakan Chrome.

## Cakupan

- `full-regression.test.mjs`: 26 skenario autentikasi, pengguna, aset, peminjaman, pengembalian, alur pengajuan dan penjadwalan pemeliharaan, penguncian status aset antar transaksi, validasi input, role, kontrol fitur utama, dan logout.
- `navigation-smoke.test.mjs`: smoke test 16 menu fitur yang terdaftar pada aplikasi, ditutup dengan 5 skenario penguncian status aset yang sama dengan suite regresi.
- `../support/asset-status-scenarios.mjs`: modul bersama berisi 5 skenario penguncian status aset. Kedua suite memanggil modul yang sama sehingga aturan bisnisnya hanya ditulis satu kali; modul ini membuat akun peminjam dan aset ujinya sendiri lalu membersihkannya.

## Persiapan

1. Gunakan Node.js sesuai `.nvmrc`.
2. Pastikan Chrome tersedia.
3. Jalankan backend dan frontend, atau jalankan stack Docker.
4. Salin `selenium.env.example.json` menjadi `selenium.env.json` dan isi akun admin khusus pengujian.
5. Jika database masih kosong, jalankan `npm run bootstrap:test-admin` setelah backend terhubung ke database agar akun admin test tersedia.

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
Sebelum browser dijalankan, seluruh rute dipanaskan secara berurutan — dokumen
HTML dan payload navigasi klien (header `RSC`) — karena keduanya dikompilasi
terpisah oleh dev server. Tanpa pemanasan payload tersebut, klik menu menunggu
kompilasi puluhan detik dan rute yang gagal berpindah-pindah setiap run.
Urutan kunjungan menu mengikuti alur fitur pada regresi penuh agar hasil headed
dan log screenshot lebih mudah dibandingkan antar-suite.

`test:selenium:core` menguji alur bisnis dan interaksi kontrol UI seperti form,
tab, filter, hak akses, arsip, laporan, dokumentasi, kalender dan tab pemeliharaan, serta
bobot/ranking/riwayat SPK. Setup dan cleanup data
tetap dilakukan melalui API agar run dapat diulang secara konsisten, sedangkan
kontrol fitur diperiksa melalui klik browser. Screenshot full regression memakai
mode full-page sehingga seluruh panjang halaman dan kolom ikut tersimpan; panel
bukti ditampilkan sebagai kartu kecil yang konsisten di tengah tanpa mengubah
ukuran normal konten aplikasi. Alias
`npm run selenium:smoke:headed` juga tersedia untuk kompatibilitas.

## Skenario penguncian status aset

Kelima skenario ini berada di `support/asset-status-scenarios.mjs` dan dijalankan
oleh **kedua** suite: sebagai skenario 18–22 pada regresi penuh, dan sebagai
rangkaian `Aturan status aset: …` setelah kunjungan menu pada smoke test.

| Skenario | Ekspektasi |
| --- | --- |
| Aset berstatus dipinjam dijadwalkan pemeliharaan | Ditolak, aset masih dalam peminjaman aktif |
| Aset dalam pemeliharaan dipinjam | Ditolak, aset sedang dalam pemeliharaan aktif |
| Aset sedang digunakan dipinjam | Ditolak, alat sedang digunakan |
| Aset dihapuskan | Hilang dari daftar pilihan inventaris pada formulir peminjaman dan ditolak lewat API |
| Pemeliharaan divalidasi selesai | Aset kembali `available` dan berhasil dipinjam |

Modul ini mandiri: ia membaca sesi admin dari browser yang sudah login, membuat
akun peminjam dan seluruh aset ujinya sendiri (prefix `SEL-LOCK-`/`E2ELOCK-`),
lalu membersihkannya lewat `cleanup()`. Karena itu urutannya tidak bergantung
pada skenario lain di suite mana pun, tetapi tetap harus dijalankan setelah
login sebagai admin.

Catatan implementasi:

- Skenario penggunaan mencatat pemakaian alat lewat akun uji, sehingga akun
  tersebut dibuat dengan sub unit kerja yang sama dengan lokasi aset ujinya —
  validasi backend hanya mengizinkan pencatatan penggunaan oleh akun pada sub
  ruangan yang sama.
- Skenario penghapusan memverifikasi daftar transaksi lewat pemilih inventaris di
  formulir peminjaman (bukan hanya lewat API), lalu meninggalkan permintaan
  penghapusan yang sudah disetujui karena API tidak mengizinkan pembatalan
  permintaan yang sudah diproses.

Variabel opsional:

- `SELENIUM_BASE_URL`, default `http://localhost:3000`.
- `SELENIUM_TIMEOUT_MS`, default `20000` pada mode headless dan `60000` pada
  mode headed agar kompilasi halaman development tidak memicu false timeout.
- `SELENIUM_NAVIGATION_TIMEOUT_MS`, batas khusus perpindahan halaman; default
  `90000` atau `SELENIUM_TIMEOUT_MS` bila lebih besar. App Router baru mengubah
  URL setelah payload rute selesai diambil, sehingga satu klik menu pada dev
  server yang sibuk dapat memakan belasan detik.
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
