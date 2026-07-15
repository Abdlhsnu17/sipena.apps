# SIPENA

Sistem Inventaris, Peminjaman, dan Pemeliharaan Sarana (SIPENA) adalah aplikasi web untuk membantu pengelolaan sarana dan prasarana rumah sakit secara lebih rapi, cepat, dan terpusat. Aplikasi ini memadukan pengelolaan aset, peminjaman, pengembalian, penggunaan aset, pemeliharaan, SPK prioritas aset, laporan, unggah dokumen, dan dokumentasi sistem dalam satu monorepo.

Dokumen kebutuhan produk dan baseline perilaku aplikasi tersedia di [`docs/PRD.md`](docs/PRD.md).

| Metadata | Nilai |
| --- | --- |
| Versi aplikasi | 2.5.0 |
| Baseline dokumentasi | Implementasi aktif per 15 Juli 2026 |
| PRD | Versi 1.1 (as-built) |

## Ringkasan Kegunaan

SIPENA berfungsi sebagai pusat pengelolaan digital untuk sarana dan prasarana rumah sakit. Aplikasi ini membantu petugas dan admin mengelola aset, memantau peminjaman dan pengembalian, mencatat penggunaan aset, mengatur pemeliharaan, menentukan prioritas aset dengan SPK, serta menyusun laporan dalam satu sistem yang terhubung.

Secara praktis, SIPENA digunakan untuk:

- Menyimpan data aset medis dan non-medis secara terstruktur agar mudah dicari, diperbarui, dan diaudit.
- Mengatur alur peminjaman, persetujuan, pengembalian, status keterlambatan, serta penautan Pemilik/PJ inventaris ke akun aktif berdasarkan nama atau NIP.
- Mencatat penggunaan aset berdasarkan ruangan, operator, waktu pemakaian, kondisi, sumber pencatatan, dan catatan operasional.
- Memantau frekuensi penggunaan per detail inventaris, memberi peringatan setelah lebih dari 10 kali penggunaan, dan membuat tiket cek rutin otomatis saat mencapai 25 kali penggunaan.
- Menjadwalkan dan memantau pemeliharaan aset, termasuk penautan Teknisi/PJ ke akun aktif dan pemisahan tiket manual dari tiket otomatis.
- Membantu penentuan prioritas aset melalui modul SPK Prioritas Aset.
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

Database utama menggunakan MySQL. Skema lokal dan artefak database disimpan terpisah di paket `packages/database` agar mudah diatur dan diimpor ulang.

Isi paket database:

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
- Jadwal pemeliharaan terpisah yang tersinkron ke record pemeliharaan.
- SPK Prioritas Aset untuk membantu pemeringkatan aset berdasarkan bobot dan matriks penilaian.
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

Baseline 15 Juli 2026 mencakup pembaruan berikut:

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

## Arsitektur

SIPENA memakai monorepo berbasis clean architecture secara bertahap:

1. Frontend Next.js berada di `apps/frontend` dan hanya berkomunikasi dengan API.
2. Backend Express berada di `apps/backend` dengan lapisan `controllers`, `services`, `repositories`, `middlewares`, `config`, dan `utils`.
3. Shared packages berada di `packages/*` untuk database client, tipe bersama, utilitas umum, dan konfigurasi aplikasi.
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
├── packages/
│   ├── config/
│   ├── database/
│   ├── types/
│   └── utils/
├── docker/
├── scripts/
├── .env.example
├── package.json
└── README.md
```

`packages/database` menyimpan `migrations/`, `seeds/`, dan shared database client. Migrasi query SQL dari service lama ke repository dilakukan per modul agar alur produksi yang sudah berjalan tidak berubah secara massal dalam satu perubahan.

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
