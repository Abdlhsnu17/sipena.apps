# SIPENA

Sistem Inventaris, Peminjaman, dan Pemeliharaan Sarana (SIPENA) adalah aplikasi web untuk membantu pengelolaan sarana dan prasarana rumah sakit secara lebih rapi, cepat, dan terpusat. Aplikasi ini memadukan pengelolaan aset, peminjaman, pengembalian, penggunaan aset, pemeliharaan, SPK prioritas aset, laporan, unggah dokumen, dan dokumentasi sistem dalam satu monorepo.

Dokumen kebutuhan produk dan baseline perilaku aplikasi tersedia di [`docs/PRD.md`](docs/PRD.md).

| Metadata | Nilai |
| --- | --- |
| Versi aplikasi | 2.5.0 |
| Baseline dokumentasi | Implementasi aktif per 19 Juli 2026 |
| PRD | Versi 1.1 (as-built) |

## Ringkasan Kegunaan

SIPENA berfungsi sebagai pusat pengelolaan digital untuk sarana dan prasarana rumah sakit. Aplikasi ini membantu petugas dan admin mengelola aset, memantau peminjaman dan pengembalian, mencatat penggunaan aset, mengatur pemeliharaan, menentukan prioritas aset dengan SPK, serta menyusun laporan dalam satu sistem yang terhubung.

Secara praktis, SIPENA digunakan untuk:

- Menyimpan data aset medis dan non-medis secara terstruktur agar mudah dicari, diperbarui, dan diaudit.
- Mengatur alur peminjaman, persetujuan, pengembalian, status keterlambatan, serta penautan Pemilik/PJ inventaris ke akun aktif berdasarkan nama atau NIP.
- Mencatat penggunaan aset berdasarkan ruangan, operator, waktu pemakaian, kondisi, sumber pencatatan, dan catatan operasional.
- Memantau frekuensi penggunaan per detail inventaris, memberi peringatan setelah lebih dari 10 kali penggunaan, dan membuat tiket cek rutin otomatis saat mencapai 25 kali penggunaan.
- Menjadwalkan dan memantau pemeliharaan aset, termasuk penautan Teknisi/PJ ke akun aktif dan pemisahan tiket manual dari tiket otomatis.
- Membantu penentuan prioritas aset melalui modul SPK Prioritas Aset dengan bobot manual atau AHP dan pemeringkatan TOPSIS.
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
- Penghapusan aset (disposal) dengan pengajuan, persetujuan/penolakan, serta sinkronisasi otomatis status aset atau detail aset yang dihapuskan.
- Permintaan arsip data (deletion request) untuk user, peminjaman/pengembalian, dan pemeliharaan, lengkap dengan alur review sebelum data benar-benar diarsipkan.
- Manajemen sanksi atas keterlambatan pengembalian aset: daftar sanksi aktif/selesai, penyelesaian sanksi, pembebasan sanksi dengan catatan, dan statistik ringkas.
- Kontrol akses berbasis menu (access control) untuk mengatur menu apa saja yang dapat diakses tiap role, termasuk matriks role-menu yang dapat diubah admin.
- Autentikasi lengkap: login, register, reset password, profil, dan unggah foto profil.
- Reset password multikanal dengan prioritas WhatsApp, fallback SMS, lalu email bila kanal telepon gagal; preview kode hanya tersedia pada mode pengembangan.
- Scanner QR/barcode responsif melalui kamera atau unggah gambar, dengan hasil diarahkan ke pencarian inventaris medis/non-medis.
- Dashboard dan laporan aset, peminjaman, pemeliharaan, export PDF/Excel, serta unggah dokumen pendukung.
- Dashboard ambang penggunaan dan kategori frekuensi yang juga tersedia pada hasil SPK Prioritas Aset.
- Arsip & Riwayat untuk detail aktivitas pengguna, riwayat penggunaan, dan riwayat peminjaman; serta endpoint dokumentasi sistem.

## Pembaruan Implementasi Terbaru

Baseline 19 Juli 2026 mencakup pembaruan berikut:

- Struktur proyek telah dipisahkan menjadi workspace `apps/frontend`, `apps/backend`, dan artefak database di `database/`; konfigurasi Docker, script runtime, dan Selenium berada di folder khusus masing-masing.
- Pemeliharaan kini mencatat estimasi, waktu aktual, vendor/garansi, diagnosis dan tindakan, checklist/suku cadang, bukti foto atau lampiran, hasil verifikasi, kondisi akhir, dan tanggal pemeliharaan berikutnya.
- Pemeliharaan prioritas kritis atau berestimasi minimal Rp5.000.000 masuk ke alur persetujuan. Admin/leader juga dapat membuat notifikasi pengingat H-7, H-3, dan H-1 serta mengaktifkan pekerjaan berulang.
- SPK Prioritas Aset mendukung bobot manual dan AHP. Matriks AHP yang tidak konsisten (`CR > 0,1`) menggunakan bobot manual/default sebagai fallback; hasil akhir tetap dihitung dengan TOPSIS.
- Preferensi bobot, ringkasan hasil, dan matriks perbandingan disimpan pada riwayat SPK per pengguna untuk kebutuhan audit dan pemakaian ulang.

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
- `/api/maintenance` untuk pemeliharaan aset, termasuk filter sumber manual atau `usage_threshold`.
- `/api/maintenance/technician-candidates` untuk pencarian akun aktif calon Teknisi/PJ.
- `/api/maintenance-history` untuk riwayat pemeliharaan.
- `/api/maintenance-schedule` untuk jadwal pemeliharaan.
- `/api/asset-disposal` untuk pengajuan, persetujuan, penolakan, dan pembatalan penghapusan aset.
- `/api/deletion-requests` untuk pengajuan dan review permintaan arsip data (user, peminjaman/pengembalian, pemeliharaan).
- `/api/sanctions` untuk daftar sanksi, penyelesaian, pembebasan, dan statistik sanksi keterlambatan.
- `/api/access-control` untuk matriks hak akses menu per role dan menu yang aktif bagi pengguna saat ini.
- `/api/reports` untuk dashboard, laporan, unggah dokumen, dan ekspor.
- `/api/user-activities` untuk riwayat aktivitas pengguna.
- `/api/uml` untuk akses dokumentasi sistem.

## Konfigurasi Kanal Reset Password

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
