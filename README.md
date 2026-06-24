# SIPENA

Sistem Inventaris, Peminjaman, dan Pemeliharaan Sarana (SIPENA) adalah aplikasi web untuk membantu pengelolaan sarana dan prasarana rumah sakit secara lebih rapi, cepat, dan terpusat. Aplikasi ini memadukan pengelolaan aset, peminjaman, pengembalian, penggunaan aset, pemeliharaan, SPK prioritas aset, laporan, unggah dokumen, dan dokumentasi sistem dalam satu monorepo.

## Ringkasan Kegunaan

SIPENA berfungsi sebagai pusat pengelolaan digital untuk sarana dan prasarana rumah sakit. Aplikasi ini membantu petugas dan admin mengelola aset, memantau peminjaman dan pengembalian, mencatat penggunaan aset, mengatur pemeliharaan, menentukan prioritas aset dengan SPK, serta menyusun laporan dalam satu sistem yang terhubung.

Secara praktis, SIPENA digunakan untuk:

- Menyimpan data aset medis dan non-medis secara terstruktur agar mudah dicari, diperbarui, dan diaudit.
- Mengatur alur peminjaman, persetujuan, pengembalian, dan status keterlambatan alat.
- Mencatat penggunaan aset berdasarkan ruangan, operator, waktu pemakaian, kondisi, dan catatan operasional.
- Menjadwalkan dan memantau pemeliharaan aset agar kondisi peralatan tetap terjaga.
- Membantu penentuan prioritas aset melalui modul SPK Prioritas Aset.
- Mencatat riwayat pemeliharaan dan aktivitas pengguna sebagai bahan evaluasi dan kontrol.
- Mengelola laporan operasional, dokumen pendukung, dan dokumentasi sistem agar lebih mudah ditinjau kembali.

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
- `migrations/` untuk perubahan tabel tambahan, termasuk kolom keamanan pengguna, ekstensi peminjaman, sanksi, penggunaan aset, dan kontrol akses.
- `seeds/` untuk skema seed dan dokumentasi penggunaan MySQL/phpMyAdmin lokal.


## Fitur Utama

- Inventaris aset medis dan non-medis dengan pencarian, filter, tambah, ubah, dan hapus.
- Peminjaman dan pengembalian aset dengan alur persetujuan, penolakan, validasi pengembalian, dan status keterlambatan.
- Penggunaan aset untuk mencatat ruangan pemakaian, operator, konteks penggunaan, waktu mulai/selesai, jumlah penggunaan, kondisi sebelum/sesudah, dan catatan tambahan.
- Pemeliharaan aset dengan status request, jadwal, proses, selesai, validasi, dan riwayat pemeliharaan.
- Jadwal pemeliharaan terpisah yang tersinkron ke record pemeliharaan.
- SPK Prioritas Aset untuk membantu pemeringkatan aset berdasarkan bobot dan matriks penilaian.
- Penghapusan aset (disposal) dengan pengajuan, persetujuan/penolakan, serta sinkronisasi otomatis status aset atau detail aset yang dihapuskan.
- Permintaan arsip data (deletion request) untuk user, peminjaman/pengembalian, dan pemeliharaan, lengkap dengan alur review sebelum data benar-benar diarsipkan.
- Manajemen sanksi atas keterlambatan pengembalian aset: daftar sanksi aktif/selesai, penyelesaian sanksi, pembebasan sanksi dengan catatan, dan statistik ringkas.
- Kontrol akses berbasis menu (access control) untuk mengatur menu apa saja yang dapat diakses tiap role, termasuk matriks role-menu yang dapat diubah admin.
- Autentikasi lengkap: login, register, reset password, profil, dan unggah foto profil.
- Dashboard dan laporan aset, peminjaman, pemeliharaan, export PDF/Excel, serta unggah dokumen pendukung.
- Riwayat aktivitas pengguna dan endpoint dokumentasi sistem.

## Arsitektur

SIPENA memakai arsitektur three-tier:

1. Frontend Next.js menampilkan UI dan mengirim request ke API.
2. Backend Node.js dan Express memproses request serta validasi bisnis.
3. Database MySQL menyimpan data utama aplikasi.

## Struktur Monorepo

```
.
├── packages/
│   ├── backend/
│   ├── frontend/
│   └── database/
├── package.json
└── README.md
```

## Endpoint Backend

Endpoint utama yang aktif mencakup:

- `/api/health` untuk pengecekan status server.
- `/api/auth` untuk login, register, reset password, dan update profil.
- `/api/users` untuk manajemen data pengguna.
- `/api/assets` untuk aset medis dan non-medis.
- `/api/asset-usage` untuk pencatatan dan pengelolaan penggunaan aset.
- `/api/borrowing` untuk peminjaman, approval, reject, return, dan validasi return.
- `/api/dss` untuk SPK Prioritas Aset dan pemeringkatan aset.
- `/api/maintenance` untuk pemeliharaan aset.
- `/api/maintenance-history` untuk riwayat pemeliharaan.
- `/api/maintenance-schedule` untuk jadwal pemeliharaan.
- `/api/asset-disposal` untuk pengajuan, persetujuan, penolakan, dan pembatalan penghapusan aset.
- `/api/deletion-requests` untuk pengajuan dan review permintaan arsip data (user, peminjaman/pengembalian, pemeliharaan).
- `/api/sanctions` untuk daftar sanksi, penyelesaian, pembebasan, dan statistik sanksi keterlambatan.
- `/api/access-control` untuk matriks hak akses menu per role dan menu yang aktif bagi pengguna saat ini.
- `/api/reports` untuk dashboard, laporan, unggah dokumen, dan ekspor.
- `/api/user-activities` untuk riwayat aktivitas pengguna.
- `/api/uml` untuk akses dokumentasi sistem.

## Hak Akses

- Pengguna Publik: hanya dapat login, register, dan reset password.
- Pengguna Terautentikasi: dapat logout, mengelola profil sendiri, unggah foto profil, ubah password, akses dokumentasi sistem, riwayat aktivitas, serta dokumen sesuai hak akses file.
- Admin: akses paling luas untuk CRUD inventaris, validasi transaksi, kelola pemeliharaan dan jadwal, kelola seluruh laporan, hapus dokumen, serta manajemen penuh pengguna.
- Leader: mengawasi operasional, memvalidasi peminjaman, pengembalian, dan pemeliharaan, mengelola user operasional, serta mengakses laporan; tidak menghapus aset, jadwal, user admin, atau dokumen.
- Staff Pelayanan: melihat inventaris sesuai `staffAccessType`, mengajukan peminjaman, mencatat pengembalian dan penggunaan aset, membuat permintaan pemeliharaan, melihat jadwal, dan mengakses laporan operasional.
- Staff PJ: melihat inventaris serta menambah atau mengubah data inventaris sesuai `staffAccessType`, mengajukan peminjaman, mencatat pengembalian dan penggunaan aset, membuat jadwal pemeliharaan, dan memantau laporan.
- Teknisi: fokus pada daftar pemeliharaan dan jadwal, mengubah status jadwal, menandai pekerjaan selesai, melakukan validasi akhir teknis, dan membatalkan pemeliharaan bila diperlukan.
- User: role self-service untuk melihat inventaris, mengajukan peminjaman, mencatat pengembalian dan penggunaan aset, serta mengelola akun sendiri; tidak memiliki akses ke laporan maupun manajemen data master.
