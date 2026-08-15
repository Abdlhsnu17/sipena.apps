# SIPENA

Sistem Inventaris, Peminjaman, dan Pemeliharaan Sarana (SIPENA) adalah aplikasi web untuk membantu pengelolaan sarana dan prasarana rumah sakit secara lebih rapi, cepat, dan terpusat. Aplikasi ini memadukan pengelolaan aset, peminjaman, pengembalian, penggunaan aset, pemeliharaan, SPK prioritas aset, laporan, unggah dokumen, dan dokumentasi sistem dalam satu monorepo.

Dokumen kebutuhan produk dan baseline perilaku aplikasi tersedia di [`docs/PRD.md`](docs/PRD.md).

| Metadata | Nilai |
| --- | --- |
| Versi aplikasi | 2.5.0 |
| Baseline dokumentasi | Implementasi aktif per 12 Agustus 2026 |
| PRD | Versi 1.2 (as-built) |

## Ringkasan Kegunaan

SIPENA berfungsi sebagai pusat pengelolaan digital untuk sarana dan prasarana rumah sakit. Aplikasi ini membantu petugas dan admin mengelola aset, memantau peminjaman dan pengembalian, mencatat penggunaan aset, mengatur pemeliharaan, menentukan prioritas aset dengan SPK, serta menyusun laporan dalam satu sistem yang terhubung.

Secara praktis, SIPENA digunakan untuk:

- Menyimpan data aset medis dan non-medis secara terstruktur agar mudah dicari, diperbarui, dan diaudit.
- Mengatur alur peminjaman, persetujuan, pengembalian, status keterlambatan, serta penautan Pemilik/PJ inventaris ke akun aktif berdasarkan nama atau NIP.
- Mencatat penggunaan aset berdasarkan ruangan, operator, waktu pemakaian, kondisi, sumber pencatatan, dan catatan operasional.
- Memantau frekuensi penggunaan per detail inventaris, memberi peringatan setelah lebih dari 10 kali penggunaan, dan membuat tiket cek rutin otomatis saat mencapai 25 kali penggunaan.
- Menjadwalkan dan memantau pemeliharaan aset, termasuk penautan Teknisi/PJ ke akun aktif dan pemisahan tiket manual dari tiket otomatis.
- Membantu penentuan prioritas aset melalui modul SPK Prioritas Aset dengan bobot manual atau AHP dan pemeringkatan TOPSIS.
- Menyimpan, membandingkan, dan mengekspor riwayat skenario SPK prioritas aset yang dipilih.
- Mencatat riwayat pemeliharaan dan aktivitas pengguna sebagai bahan evaluasi dan kontrol.
- Mengelola laporan operasional, dokumen pendukung, dan dokumentasi sistem agar lebih mudah ditinjau kembali.
- Memindai QR/barcode melalui kamera atau gambar untuk mencari aset dan membuka inventaris yang sesuai.
- Menelusuri riwayat aktivitas, penggunaan, dan peminjaman dari satu halaman Arsip & Riwayat.

## Gambaran Umum

SIPENA dibagi menjadi tiga lapisan utama:

- Frontend untuk antarmuka pengguna.
- Backend untuk REST API dan logika bisnis.
- Database untuk penyimpanan data operasional.

Pemisahan ini membuat pengembangan fitur lebih terarah dan memudahkan pemeliharaan sistem.

### Frontend

Frontend dibangun dengan Next.js dan React untuk menampilkan dashboard, form, tabel data, halaman autentikasi, dokumentasi sistem, dan fitur operasional lain. Frontend ini juga menjadi lapisan yang berkomunikasi dengan backend melalui API.

Teknologi utama yang dipakai:

- Next.js 16
- React 19
- Tailwind CSS
- Radix UI dan shadcn/ui
- React Hook Form, Zod, dan komponen pendukung lain untuk validasi dan interaksi UI

Peran frontend:

- Menampilkan data aset, peminjaman, pengembalian, penggunaan aset, pemeliharaan, SPK prioritas aset, laporan, unggah dokumen, dokumentasi sistem, dan aktivitas pengguna.
- Menyediakan form untuk login, register, reset password, dan profil pengguna.
- Mengirim dan menerima data ke backend melalui endpoint API.
- Mendukung penggunaan `NEXT_PUBLIC_API_URL`; jika tidak diisi, frontend memakai proxy same-origin melalui `/api`.

### Backend

Backend dibangun dengan Node.js, Express, dan TypeScript untuk menangani autentikasi, validasi, alur bisnis, dan akses data ke database MySQL.

Teknologi utama yang dipakai:

- Express
- MySQL2
- Sequelize TypeScript
- JWT untuk autentikasi
- Multer untuk unggahan file
- Nodemailer untuk kebutuhan email
- Redis sebagai komponen opsional

Peran backend:

- Menyediakan endpoint REST API untuk seluruh modul SIPENA.
- Menangani autentikasi dan otorisasi berbasis peran.
- Memproses operasi aset, peminjaman, pengembalian, penggunaan aset, pemeliharaan, SPK prioritas aset, laporan, dokumen, dan aktivitas pengguna.
- Menyimpan file profil, laporan, dan dokumen pendukung di folder uploads.

### Database

Database utama menggunakan MySQL. Skema lokal dan artefak database disimpan terpisah di folder `database/` pada root repositori agar mudah diatur dan diimpor ulang.

Isi folder database:

- `seeds/schema.sql` sebagai skema utama lokal.
- `migrations/` untuk perubahan tabel tambahan, termasuk keamanan pengguna, ekstensi peminjaman, penyelesaian sanksi, audit penggunaan aset, kontrol akses, notifikasi, operasi pemeliharaan, dan penautan akun Pemilik/PJ.
- `seeds/` untuk skema seed dan dokumentasi penggunaan MySQL/phpMyAdmin lokal.


## Fitur Utama

- Inventaris aset medis dan non-medis dengan pencarian, filter, tambah, ubah, dan hapus.
- Peminjaman dan pengembalian aset dengan alur persetujuan, penolakan, validasi pengembalian, status keterlambatan, serta Pemilik/PJ tertaut ke akun aktif dengan tampilan nama, NIP, jabatan, dan unit kerja.
- Penggunaan aset untuk mencatat ruangan, operator, konteks, waktu mulai/selesai, jumlah penggunaan, kondisi sebelum/sesudah, sumber manual atau sinkron peminjaman, dan alasan pengarsipan.
- Ringkasan frekuensi penggunaan pada setiap detail inventaris dan halaman riwayat yang dapat difilter berdasarkan alat, detail, kata kunci, serta rentang tanggal.
- Otomasi ambang penggunaan: status peringatan pada total lebih dari 10 kali dan wajib cek rutin pada total minimal 25 kali, disertai notifikasi dan pembuatan tiket pemeliharaan preventif otomatis.
- Pemeliharaan aset dengan status request, jadwal, proses, selesai, validasi, riwayat, filter sumber manual/otomatis, serta Teknisi/PJ tertaut ke akun aktif.
- Workflow pemeliharaan lanjutan: estimasi durasi/biaya, persetujuan pekerjaan kritis atau bernilai minimal Rp5.000.000, vendor dan garansi, diagnosis, tindakan, checklist, suku cadang, bukti foto/lampiran, verifikasi hasil, pengingat H-7/H-3/H-1, serta jadwal berulang bulanan, triwulanan, atau tahunan.
- Jadwal pemeliharaan terpisah yang tersinkron ke record pemeliharaan.
- SPK Prioritas Aset dengan delapan kriteria, bobot manual atau matriks perbandingan berpasangan AHP, pemeriksaan rasio konsistensi, pemeringkatan TOPSIS, preferensi bobot per pengguna, dan riwayat hasil yang dapat dipulihkan atau dihapus.
- Skenario pembobotan dapat diberi nama dan diarsipkan lewat tombol "Simpan Skenario"; dua skenario pada Riwayat Perhitungan dapat dibandingkan langsung (pergeseran peringkat per aset, alternatif yang masuk/keluar sepuluh besar, serta korelasi Spearman/Kendall).
- Riwayat perhitungan SPK dapat dicentang lalu diekspor ke PDF/Excel; isi ekspor mengikuti skenario yang dipilih dan membawa 10 ranking teratas per skenario.
- Validasi model SPK berupa uji sensitivitas bobot (pergeseran ±10% dan ±20% per kriteria, diukur dengan korelasi peringkat Spearman/Kendall dan irisan top-10) serta pembandingan hasil TOPSIS dengan metode SAW dan WP pada matriks keputusan dan bobot yang sama.
- Penghapusan aset (disposal) dengan pengajuan, persetujuan/penolakan, serta sinkronisasi otomatis status aset atau detail aset yang dihapuskan.
- Permintaan arsip data (deletion request) untuk user, peminjaman/pengembalian, dan pemeliharaan, lengkap dengan alur review sebelum data benar-benar diarsipkan.
- Manajemen sanksi atas keterlambatan pengembalian aset: daftar sanksi aktif/selesai, penyelesaian sanksi, pembebasan sanksi dengan catatan, dan statistik ringkas.
- Kontrol akses berbasis menu (access control) untuk mengatur menu apa saja yang dapat diakses tiap role, termasuk matriks role-menu yang dapat diubah admin.
- Autentikasi lengkap: login, register, reset password, profil, dan unggah foto profil.
- Reset password tiga langkah (minta kode → verifikasi OTP → password baru) dengan Twilio Verify sebagai kanal utama bila dikonfigurasi dan webhook WhatsApp/SMS sebagai cadangan. OTP hanya dikirim ke nomor terdaftar, sehingga nomor telepon menjadi data wajib bagi setiap akun; preview kode hanya tersedia pada mode pengembangan.
- Scanner QR/barcode responsif melalui kamera atau unggah gambar, dengan hasil diarahkan ke pencarian inventaris medis/non-medis.
- Dashboard dan laporan aset, peminjaman, pemeliharaan, export PDF/Excel, serta unggah dokumen pendukung.
- Dashboard ambang penggunaan dan kategori frekuensi yang juga tersedia pada hasil SPK Prioritas Aset.
- Arsip & Riwayat untuk detail aktivitas pengguna, riwayat penggunaan, dan riwayat peminjaman; serta endpoint dokumentasi sistem.

## Pembaruan Implementasi Terbaru

Baseline 12 Agustus 2026 mencakup pembaruan berikut:

- Struktur proyek telah dipisahkan menjadi workspace `apps/frontend`, `apps/backend`, dan artefak database di `database/`; konfigurasi Docker, script runtime, dan Selenium berada di folder khusus masing-masing.
- Pemeliharaan kini mencatat estimasi, waktu aktual, vendor/garansi, diagnosis dan tindakan, checklist/suku cadang, bukti foto atau lampiran, hasil verifikasi, kondisi akhir, dan tanggal pemeliharaan berikutnya.
- Pemeliharaan prioritas kritis atau berestimasi minimal Rp5.000.000 masuk ke alur persetujuan. Admin/leader juga dapat membuat notifikasi pengingat H-7, H-3, dan H-1 serta mengaktifkan pekerjaan berulang.
- SPK Prioritas Aset mendukung bobot manual dan AHP. Matriks AHP yang tidak konsisten (`CR > 0,1`) menggunakan bobot manual/default sebagai fallback; hasil akhir tetap dihitung dengan TOPSIS.
- Preferensi bobot, ringkasan hasil, dan matriks perbandingan disimpan pada riwayat SPK per pengguna untuk kebutuhan audit dan pemakaian ulang.
- Riwayat SPK kini hanya terisi saat pengguna menekan "Simpan Skenario" (bukan setiap kali ranking dihitung ulang), sehingga riwayat berisi keputusan, bukan draf. Halaman ranking menandai apakah konfigurasi yang tampil sudah tersimpan atau belum. Pembandingan dua skenario memakai `POST /api/dss/scenario-comparison` dan selalu menghitung ulang penuh dari bobot tersimpan, bukan membandingkan ringkasan top-10.
- Perhitungan MCDM dipisahkan ke util murni (`apps/backend/src/utils/mcdm.ts`) dan akses datanya ke `apps/backend/src/repositories/dss.repository.ts`. Dataset SPK di-cache singkat per jenis aset (`DSS_DATASET_CACHE_TTL_MS`, default 60 detik), endpoint `POST /api/dss/ranking` menerima `offset` untuk paginasi, serta tersedia `POST /api/dss/sensitivity` dan `POST /api/dss/method-comparison` untuk validasi model.
- Frekuensi pemakaian pada SPK memakai `SUM(usage_count)` dan mengabaikan data yang diarsipkan lunak, agar konsisten dengan ambang 10/25 pada modul Penggunaan Aset.

- Pemilik/PJ pada peminjaman dipilih dari akun aktif melalui pencarian nama, NIP, atau unit kerja. Sistem menyimpan `owner_user_id` beserta snapshot nama, NIP, jabatan, dan unit kerja agar dokumen transaksi tetap dapat ditelusuri.
- Teknisi/PJ pada pemeliharaan menggunakan pola penautan akun yang sama dan menampilkan nama serta NIP pada ringkasan maupun detail.
- Peminjaman aktif disinkronkan ke Penggunaan dengan sumber `borrowing_sync`; pencatatan langsung menggunakan sumber `manual`.
- Penghapusan catatan Penggunaan menjadi pengarsipan lunak dan mewajibkan alasan, identitas pelaksana, serta waktu pengarsipan.
- Frekuensi penggunaan tersedia pada kartu detail inventaris dan dibagi menjadi total, manual, serta peminjaman. Riwayat lengkap dapat dibuka langsung dari detail inventaris.
- Dashboard menampilkan aset yang melewati ambang penggunaan. Total lebih dari 10 kali berstatus peringatan; total minimal 25 kali berstatus wajib cek rutin dan dapat menghasilkan tiket pemeliharaan preventif otomatis.
- Topbar menyediakan pemindaian QR/barcode dari kamera atau gambar. Callback scanner distabilkan agar kamera seluler tidak terus membuka dan menutup saat topbar memperbarui waktu.
- Halaman Arsip & Riwayat menyatukan audit aktivitas dengan riwayat penggunaan dan peminjaman yang dapat dicari, difilter, dan dibuka rinciannya.
- Konfigurasi reset password mendukung WhatsApp, SMS, dan Gmail SMTP, serta halaman Pengaturan menampilkan status kanal tanpa mengekspos kredensial.

Perubahan skema yang menjadi bagian dari baseline ini antara lain:

- `20260621_add_borrowing_sanction_resolution_columns.sql` menambahkan waktu, aktor, dan catatan penyelesaian/pembebasan sanksi.
- `20260622_add_asset_usage_audit_columns.sql` menambahkan metadata arsip lunak dan sumber pencatatan Penggunaan, termasuk penandaan data yang berasal dari peminjaman.
- `20260714_link_borrowing_owner_accounts.sql` menautkan Pemilik/PJ peminjaman ke akun pengguna dan menyimpan snapshot NIP.
- `20260717_add_maintenance_advanced_workflow.sql` menambahkan waktu aktual, pekerjaan berulang, approval, reminder, dan metadata validasi pemeliharaan.
- `20260717_expand_maintenance_workflow_details.sql` menambahkan estimasi, bukti foto, diagnosis, tindakan, checklist, suku cadang, hasil verifikasi, kondisi akhir, dan tanggal berikutnya.
- `20260718_add_dss_weight_and_history.sql` menambahkan preferensi bobot dan riwayat pemeringkatan SPK.
- `20260719_add_dss_history_pairwise_matrix.sql` menyimpan matriks AHP pada riwayat SPK.
- `20260812_add_dss_aggregate_indexes.sql` menambahkan index komposit untuk agregasi frekuensi pemakaian dan pemeliharaan yang dipakai SPK.
- `20260812_add_dss_history_label.sql` menambahkan kolom label skenario pada riwayat perhitungan SPK.

## Arsitektur

SIPENA memakai monorepo berbasis clean architecture secara bertahap:

1. Frontend Next.js berada di `apps/frontend` dan hanya berkomunikasi dengan API.
2. Backend Express berada di `apps/backend` dengan lapisan `controllers`, `services`, `repositories`, `middlewares`, `config`, dan `utils`.
3. Artefak skema database (seed dan migrasi) berada di `database/` pada root repositori.
4. Infrastruktur Docker berada di `docker/`, sedangkan otomasi runtime berada di `scripts/`.

Kontrak utama backend:

- Controller hanya menangani request/response dan meneruskan error ke middleware global.
- Service menyimpan business logic dan orkestrasi antar modul.
- Repository menjadi satu-satunya tempat query SQL untuk bounded context yang sudah dimigrasikan.
- Config, logger, env loading, database client, dan shared types dipisah agar bisa digunakan ulang oleh service lain.

## Struktur Monorepo

```
.
├── apps/
│   ├── backend/
│   │   └── src/
│   │       ├── config/
│   │       ├── controllers/
│   │       ├── middlewares/
│   │       ├── models/
│   │       ├── repositories/
│   │       ├── routes/
│   │       ├── services/
│   │       └── utils/
│   └── frontend/
│       └── src/
│           ├── app/
│           ├── components/   # ui/ (shadcn) + subfolder per domain
│           ├── constants/
│           ├── hooks/
│           ├── services/
│           ├── types/
│           └── utils/
├── database/
│   ├── migrations/
│   └── seeds/
├── docker/
├── docs/
│   ├── diagrams/
│   └── reports/
├── scripts/
├── selenium/
├── .env.example
├── package.json
└── README.md
```

`database/` menyimpan `migrations/` dan `seeds/` sebagai lokasi kanonis skema. Migrasi query SQL dari service lama ke repository dilakukan per modul agar alur produksi yang sudah berjalan tidak berubah secara massal dalam satu perubahan.

Konvensi penamaan file: seluruh workspace memakai `kebab-case`, dengan sufiks peran pada backend (`*.controller.ts`, `*.service.ts`, `*.routes.ts`, `*.model.ts`, `*.repository.ts`, `*.middleware.ts`).

Dokumentasi teknis per bagian:

- [`apps/frontend/README.md`](apps/frontend/README.md) — halaman, proxy API, konfigurasi, dan perintah frontend.
- [`apps/backend/README.md`](apps/backend/README.md) — tanggung jawab API, infrastruktur, environment, endpoint, migrasi, dan penyimpanan file.
- [`database/README.md`](database/README.md) — database client, seed, urutan migrasi, dan inisialisasi database.
- [`selenium/README.md`](selenium/README.md) — persiapan dan cakupan pengujian end-to-end.

## Menjalankan Secara Lokal

Prasyarat: Node.js sesuai [`.nvmrc`](.nvmrc), npm 11.7+, MySQL 8, dan Redis bila ingin memakai penyimpanan OTP/SSE secara penuh.

```bash
npm install
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env.local
npm run dev:backend
```

Pada terminal lain:

```bash
npm run dev
```

Frontend tersedia di `http://localhost:3000`, backend di `http://localhost:4000`, dan health check di `http://localhost:4000/api/health`. Siapkan skema dan migrasi database mengikuti [`database/README.md`](database/README.md). Untuk menjalankan seluruh stack menggunakan container, salin konfigurasi dari `apps/backend/.docker.env.example` ke `docker/.env`, ganti semua kredensial contoh, lalu jalankan:

```bash
docker compose --env-file docker/.env -f docker/compose.yml up --build
```

## Verifikasi Perubahan

```bash
npm run lint
npm run build
npm run type-check
npm run test:backend
```

Gunakan `npm run verify` untuk menjalankan keempat pemeriksaan tersebut secara berurutan. Pengujian browser dijalankan terpisah dengan `npm run test:selenium` setelah frontend, backend, dan database pengujian aktif.

### Akun Pengujian Selenium

Suite Selenium login memakai akun admin khusus pengujian. Akun ini dibuat atau diperbarui otomatis oleh `npm run bootstrap:test-admin`, yang mencocokkan baris berdasarkan **NIP atau email** — pastikan nilainya tidak menyerupai akun asli, karena baris yang cocok akan ditimpa (termasuk passwordnya).

| Kolom | Nilai |
| --- | --- |
| NIP (dipakai sebagai username saat login) | `99999999` |
| Password | `SeleniumE2E#2026` |
| Nama | `Admin Selenium` |
| Email | `admin.selenium@sipena.test` |
| Role | `admin` |

> **Khusus lingkungan lokal.** Kredensial ini hanya untuk database pengembangan dan sengaja dicantumkan agar pengujian mudah diulang. Jangan pernah memakainya di server bersama atau produksi, dan jangan mendaftarkan akun ini pada database yang memuat data nyata. Bila membutuhkan kredensial yang tidak ikut ter-commit, isi `selenium.env.json` (sudah masuk `.gitignore`) mengikuti [`selenium.env.example.json`](selenium.env.example.json).

Jalankan suite setelah frontend (`http://localhost:3000`), backend, dan database aktif:

```bash
export INITIAL_ADMIN_NIP=99999999
export INITIAL_ADMIN_NAME="Admin Selenium"
export INITIAL_ADMIN_EMAIL="admin.selenium@sipena.test"
export INITIAL_ADMIN_PASSWORD="SeleniumE2E#2026"
export INITIAL_ADMIN_PHONE="081200000000"
export INITIAL_ADMIN_MUST_CHANGE_PASSWORD=false

export SELENIUM_E2E_USERNAME=99999999
export SELENIUM_E2E_PASSWORD="SeleniumE2E#2026"
export SELENIUM_AUTO_START_LOCAL_STACK=false
export SELENIUM_HEADLESS=true

npm run test:selenium:smoke   # 24 skenario navigasi dan aturan status aset
npm run test:selenium:core    # 26 skenario regresi alur utama
```

Catatan penting:

- Variabel `INITIAL_ADMIN_*` tetap wajib meski akunnya sudah ada, karena suite memanggil ulang `bootstrap:test-admin` sebelum login.
- `SELENIUM_AUTO_START_LOCAL_STACK=false` mencegah suite menyalakan stack Docker Compose ketika aplikasi sudah dijalankan manual.
- Tambahkan `:headed` pada nama skrip (mis. `npm run test:selenium:smoke:headed`) untuk melihat jalannya pengujian di browser.

## Endpoint Backend

Endpoint utama yang aktif mencakup:

- `/api/health` untuk pengecekan status server.
- `/api/auth` untuk login, register, reset password, dan update profil.
- `/api/users` untuk manajemen data pengguna.
- `/api/assets` untuk aset medis dan non-medis.
- `/api/asset-usage` untuk pencatatan dan pengelolaan penggunaan aset.
- `/api/asset-usage/threshold-overview` untuk ringkasan aset yang melewati ambang frekuensi penggunaan.
- `/api/borrowing` untuk peminjaman, approval, reject, return, validasi return, dan data Pemilik/PJ tertaut.
- `/api/borrowing/owner-candidates` untuk pencarian akun aktif calon Pemilik/PJ.
- `/api/dss` untuk SPK Prioritas Aset dan pemeringkatan aset.
- `/api/dss/history` untuk riwayat perhitungan SPK.
- `/api/dss/scenario-comparison` untuk perbandingan dua skenario riwayat atau bobot aktif.
- `/api/dss/sensitivity` untuk uji sensitivitas bobot.
- `/api/dss/method-comparison` untuk pembandingan TOPSIS dengan SAW dan WP.
- `/api/dss/weights` untuk preferensi bobot per pengguna.
- `/api/maintenance` untuk pemeliharaan aset, termasuk filter sumber manual atau `usage_threshold`.
- `/api/maintenance/technician-candidates` untuk pencarian akun aktif calon Teknisi/PJ.
- `/api/maintenance-history` untuk riwayat pemeliharaan.
- `/api/maintenance-schedule` untuk jadwal pemeliharaan.
- `/api/asset-disposal` untuk pengajuan, persetujuan, penolakan, dan pembatalan penghapusan aset.
- `/api/deletion-requests` untuk pengajuan dan review permintaan arsip data (user, peminjaman/pengembalian, pemeliharaan).
- `/api/sanctions` untuk daftar sanksi, penyelesaian, pembebasan, dan statistik sanksi keterlambatan.
- `/api/access-control` untuk matriks hak akses menu per role dan menu yang aktif bagi pengguna saat ini.
- `/api/app-settings/announcement` untuk membaca teks pemberitahuan berjalan di topbar; pembaruannya khusus admin.
- `/api/reports` untuk dashboard, laporan, unggah dokumen, dan ekspor.
- `/api/user-activities` untuk riwayat aktivitas pengguna.
- `/api/uml` untuk akses dokumentasi sistem.

## Konfigurasi Kanal Reset Password

Alur reset password memakai tiga endpoint berurutan, ditambah endpoint kirim ulang:

```text
POST /api/auth/reset-password/verify      → kirim OTP ke nomor terdaftar
POST /api/auth/reset-password/resend      → kirim ulang OTP (cooldown 60 detik)
POST /api/auth/reset-password/verify-otp  → tukar OTP dengan resetToken sekali pakai
POST /api/auth/reset-password             → ubah password memakai resetToken
```

Status "sudah terverifikasi" tidak pernah dipercaya dari frontend: `verify-otp` membalas `resetToken` acak yang disimpan server sebagai hash, berlaku 10 menit, dan hangus setelah satu kali pakai. Endpoint `POST /api/auth/reset-password` masih menerima payload lama (`nip` + `verificationCode` + password baru) agar klien versi sebelumnya tetap berfungsi.

### Aturan yang berlaku

| Aturan | Nilai | Catatan |
| --- | --- | --- |
| Masa berlaku OTP | 10 menit | Pada jalur Twilio, masa berlaku dipegang Twilio Verify |
| Maksimal percobaan kode | 5 per sesi | Habis percobaan berarti sesi dihapus, wajib minta kode baru |
| Cooldown kirim ulang | 60 detik | Permintaan di dalam cooldown dibalas 200 tanpa mengirim kode baru |
| Maksimal kirim ulang | 3 per sesi | Setelahnya 429 sampai sesi kedaluwarsa (10 menit) |
| Rate limit per IP | `PASSWORD_RESET_RATE_LIMIT_MAX` | Default 20 per 15 menit di produksi |
| Masa berlaku reset token | 10 menit, sekali pakai | Disimpan sebagai hash SHA-256, dikonsumsi sebelum password diubah |
| Kebijakan password baru | Min. 8 karakter, huruf besar + kecil + angka | Tidak boleh sama dengan password lama |
| Akun nonaktif/ditangguhkan | Tidak bisa reset | Balasannya disamakan dengan NIP tidak dikenal |
| Kanal OTP | Hanya nomor telepon terdaftar | Email sudah dicabut sebagai kanal OTP |
| Akun tanpa nomor valid | Tidak bisa reset sendiri | Dipandu melengkapi nomor saat login; jalur daruratnya reset oleh admin |

Anti-enumerasi: balasan `verify` dan `resend` seragam untuk NIP terdaftar, NIP asing, maupun akun nonaktif — pesan, status, dan bentuk `data` sama persis. Nomor tujuan ditampilkan dalam bentuk tersamar (`+628*******890`); NIP yang tidak berhak menerima kode mendapat **tujuan umpan** berbentuk sama, diturunkan secara deterministik dari NIP lewat HMAC sehingga permintaan berulang selalu menampilkan nilai yang sama. NIP asing juga tetap membuat sesi umpan supaya selisih waktu cooldown tidak membocorkan akun mana yang ada. Nama kanal (`sms`/`email`) tidak pernah dikirim ke klien di luar preview pengembangan, karena itu sendiri menyingkap apakah sebuah akun punya nomor terdaftar.

### Nomor telepon wajib

OTP kini hanya dikirim ke nomor terdaftar. Email dicabut sebagai kanal OTP karena bentuk tujuannya menyingkap akun mana yang tidak punya nomor, dan karena kotak surat yang ikut jebol membuat OTP tidak lagi menjadi faktor terpisah dari password.

Konsekuensinya, nomor telepon menjadi data wajib: tidak bisa dikosongkan lewat pembaruan profil maupun pembaruan data pengguna oleh admin. Akun lama yang belum mengisinya ditandai `mustCompletePhoneNumber` dan diarahkan ke halaman Pengaturan sebelum boleh memakai modul lain — pola yang sama dengan `mustChangePassword`.

Untuk mendata akun yang terdampak sebelum aturan ini terasa oleh pengguna:

```bash
npm run report:users-without-phone --workspace apps/backend
```

Jalur darurat bagi akun yang terlanjur lupa password **dan** belum punya nomor: admin atau leader mereset lewat `PATCH /api/users/:id/password/reset`.

Setelah reset berhasil: `session_version` dinaikkan (semua JWT lama gugur), penghitung gagal login dan status terkunci dibersihkan sehingga akun yang sempat terkunci langsung bisa dipakai, dan pemilik akun diberi notifikasi WhatsApp/SMS bahwa passwordnya berubah. OTP tidak pernah ditulis ke log pada mode produksi.

### Twilio Verify

Bila `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, dan `TWILIO_VERIFY_SERVICE_SID` terisi dan akun memiliki nomor telepon valid, OTP dikirim lewat Twilio Verify. Twilio yang membuat, mengirim, dan memvalidasi kodenya, sehingga tidak ada OTP plaintext yang disimpan aplikasi — Redis hanya menyimpan metadata sesi (provider, nomor tujuan, sisa percobaan) dan hash reset token. Nomor telepon disimpan dalam format E.164 (`+62…`) sesuai syarat Twilio. `TWILIO_VERIFY_CHANNEL` dapat diisi `sms` (default) atau `whatsapp`.

Kredensial Twilio hanya boleh berada di backend. Jangan pernah memakai prefix `NEXT_PUBLIC_` untuk nilai-nilai tersebut. Bila Twilio tidak dikonfigurasi atau pengirimannya gagal, sistem kembali memakai webhook WhatsApp/SMS.

Setiap environment membaca kredensial dari satu tempat yang berbeda, dan tidak bisa dicampur:

| Cara menjalankan | Sumber kredensial |
| --- | --- |
| `npm run dev` di host | `apps/backend/.env` |
| Docker Compose | `docker/.env` (diinterpolasi ke `docker/compose.yml`) |
| Railway/produksi | Variabel environment di dashboard, tanpa file |

`loadEnvironment()` hanya memuat **satu** file — kandidat pertama yang ditemukan, dengan `apps/backend/.env` lebih diprioritaskan daripada `.env` di root. Jadi konfigurasi tidak boleh dipecah ke dua file.

Untuk memastikan kredensial valid dan terbaca backend tanpa mengirim SMS:

```bash
npm run check:twilio --workspace apps/backend
```

Perintah itu mencetak file env mana yang benar-benar dipakai, lalu memanggil Verify Service dan membedakan sebab kegagalan: 401 berarti SID/token salah, 404 berarti Verify Service SID tidak ada di akun tersebut. Nilai rahasianya tidak pernah dicetak.

Template variabel tersedia di `.env.example` dan `apps/backend/.env.example`. Untuk konfigurasi Docker secara interaktif, jalankan:

```bash
npm run configure:notifications
```

Script menyimpan rahasia ke `docker/.env`, memvalidasi URL webhook WhatsApp/SMS, mengatur Gmail SMTP bila dipakai, lalu membuat ulang service backend. Kredensial asli tidak boleh dimasukkan ke repository.

## Hak Akses

- Pengguna Publik: hanya dapat login, register, dan reset password.
- Pengguna Terautentikasi: dapat logout, mengelola profil sendiri, unggah foto profil, ubah password, akses dokumentasi sistem, riwayat aktivitas, serta dokumen sesuai hak akses file.
- Admin: akses paling luas untuk CRUD inventaris, validasi transaksi, kelola pemeliharaan dan jadwal, kelola seluruh laporan, hapus dokumen, serta manajemen penuh pengguna.
- Leader: mengawasi operasional, memvalidasi peminjaman, pengembalian, dan pemeliharaan, mengelola user operasional, serta mengakses laporan; tidak menghapus aset, jadwal, user admin, atau dokumen.
- Staff Pelayanan: melihat inventaris sesuai `staffAccessType`, mengajukan peminjaman, mencatat pengembalian dan penggunaan aset, membuat permintaan pemeliharaan, melihat jadwal, dan mengakses laporan operasional.
- Staff PJ: melihat inventaris serta menambah atau mengubah data inventaris sesuai `staffAccessType`, mengajukan peminjaman, mencatat pengembalian dan penggunaan aset, membuat jadwal pemeliharaan, dan memantau laporan.
- Teknisi: fokus pada daftar pemeliharaan dan jadwal, mengubah status jadwal, menandai pekerjaan selesai, melakukan validasi akhir teknis, dan membatalkan pemeliharaan bila diperlukan.
- User: role self-service untuk melihat inventaris, mengajukan peminjaman, mencatat pengembalian dan penggunaan aset, serta mengelola akun sendiri; tidak memiliki akses ke laporan maupun manajemen data master.
# sipena.space
