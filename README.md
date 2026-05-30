# SIPENA

Sistem Inventaris  Peminjaman serta Pemeliharaan  sarana (SiPeNa) adalah aplikasi web untuk membantu pengelolaan sarana dan prasarana rumah sakit secara lebih rapi, cepat, dan terpusat. Aplikasi ini memadukan pengelolaan aset, peminjaman, pemeliharaan, laporan, dan dokumentasi sistem dalam satu monorepo.

## Ringkasan Kegunaan

SIPENA berfungsi sebagai pusat pengelolaan digital untuk sarana dan prasarana rumah sakit. Aplikasi ini membantu petugas dan admin mengelola aset, memantau peminjaman, mengatur pemeliharaan, serta menyusun laporan dalam satu sistem yang terhubung.

Secara praktis, SIPENA digunakan untuk:

- Menyimpan data aset medis dan non-medis secara terstruktur agar mudah dicari, diperbarui, dan diaudit.
- Mengatur alur peminjaman, persetujuan, pengembalian, dan status keterlambatan alat.
- Menjadwalkan dan memantau pemeliharaan aset agar kondisi peralatan tetap terjaga.
- Mencatat riwayat pemeliharaan dan aktivitas pengguna sebagai bahan evaluasi dan kontrol.
- Mengelola laporan operasional dan dokumentasi sistem agar lebih mudah ditinjau kembali.

## Gambaran Umum

SIPENA dibagi menjadi tiga lapisan utama:

- Frontend untuk antarmuka pengguna.
- Backend untuk REST API dan logika bisnis.
- Database untuk penyimpanan data operasional.

Pemisahan ini membuat pengembangan fitur lebih terarah dan memudahkan pemeliharaan sistem.

### Frontend

Frontend dibangun dengan Next.js dan React untuk menampilkan dashboard, form, tabel data, halaman autentikasi, dan fitur operasional lain. Frontend ini juga menjadi lapisan yang berkomunikasi dengan backend melalui API.

Teknologi utama yang dipakai:

- Next.js 16
- React 19
- Tailwind CSS
- Radix UI dan shadcn/ui
- React Hook Form, Zod, dan komponen pendukung lain untuk validasi dan interaksi UI

Peran frontend:

- Menampilkan data aset, peminjaman, pemeliharaan, laporan, dan aktivitas pengguna.
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
- Memproses operasi aset, peminjaman, pemeliharaan, laporan, dan aktivitas pengguna.
- Menyimpan file profil dan laporan di folder uploads.

### Database

Database utama menggunakan MySQL. Skema lokal dan artefak database disimpan terpisah di paket `db` agar mudah diatur dan diimpor ulang.

Isi paket database:

- `schema.sql` sebagai skema utama lokal.
- `seeds/` untuk data contoh dan dokumentasi seed.
- Dokumentasi tambahan untuk penggunaan MySQL dan phpMyAdmin lokal.


## Fitur Utama

- Inventaris aset medis dan non-medis dengan pencarian, filter, tambah, ubah, dan hapus.
- Peminjaman dan pengembalian aset dengan alur persetujuan, penolakan, validasi pengembalian, dan status keterlambatan.
- Pemeliharaan aset dengan status request, jadwal, proses, selesai, validasi, dan riwayat pemeliharaan.
- Jadwal pemeliharaan terpisah yang tersinkron ke record pemeliharaan.
- Autentikasi lengkap: login, register, reset password, profil, dan unggah foto profil.
- Dashboard dan laporan aset, peminjaman, pemeliharaan, export PDF/Excel, serta unggahan laporan.
- Riwayat aktivitas pengguna dan endpoint dokumentasi UML.

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
- `/api/borrowing` untuk peminjaman, approval, reject, return, dan validasi return.
- `/api/maintenance` untuk pemeliharaan aset.
- `/api/maintenance-history` untuk riwayat pemeliharaan.
- `/api/maintenance-schedule` untuk jadwal pemeliharaan.
- `/api/reports` untuk dashboard, laporan, unggahan, dan ekspor.
- `/api/user-activities` untuk riwayat aktivitas pengguna.
- `/api/uml` untuk akses dokumentasi UML.

## Hak Akses

- Pengguna Publik: hanya dapat login, register, dan reset password.
- Pengguna Terautentikasi: dapat logout, mengelola profil sendiri, unggah foto profil, ubah password, akses UML, riwayat aktivitas, serta unggahan sesuai hak akses file.
- Admin: akses paling luas untuk CRUD inventaris, validasi transaksi, kelola pemeliharaan dan jadwal, kelola seluruh laporan, hapus unggahan, serta manajemen penuh pengguna.
- Leader: mengawasi operasional, memvalidasi peminjaman, pengembalian, dan pemeliharaan, mengelola user operasional, serta mengakses laporan; tidak menghapus aset, jadwal, user admin, atau unggahan.
- Staff Pelayanan: melihat inventaris sesuai `staffAccessType`, mengajukan peminjaman, mencatat pengembalian, membuat permintaan pemeliharaan, melihat jadwal, dan mengakses laporan operasional.
- Staff PJ: melihat inventaris serta menambah atau mengubah data inventaris sesuai `staffAccessType`, mengajukan peminjaman, mencatat pengembalian, membuat jadwal pemeliharaan, dan memantau laporan.
- Teknisi: fokus pada daftar pemeliharaan dan jadwal, mengubah status jadwal, menandai pekerjaan selesai, melakukan validasi akhir teknis, dan membatalkan pemeliharaan bila diperlukan.
- User: role self-service untuk melihat inventaris, mengajukan peminjaman, mencatat pengembalian, dan mengelola akun sendiri; tidak memiliki akses ke laporan maupun manajemen data master.

Catatan:

- `staffAccessType` membatasi cakupan inventaris untuk role `staff` dan `staff_pj` menjadi `medis`, `non-medis`, atau `all`.
- Dokumentasi UML di frontend menampilkan rincian role pada halaman `/uml`, sedangkan sumber diagram use case tersimpan di `packages/backend/src/routes/uml-usecase.puml`.

## Prasyarat
## Catatan Dokumentasi

- [packages/backend/src/routes/uml-latest.puml](packages/backend/src/routes/uml-latest.puml): diagram domain/class untuk struktur dan relasi utama backend.
- [packages/backend/src/routes/uml-usecase.puml](packages/backend/src/routes/uml-usecase.puml): diagram use case untuk alur interaksi pengguna dengan fitur sistem.

## Kesiapan Production

Sebelum deploy ke server public, pastikan konfigurasi production sudah memakai nilai nyata dan bukan default lokal:

- `NODE_ENV=production`
- `FRONTEND_URL` berisi domain frontend production, bukan `localhost`
- `JWT_SECRET` minimal 32 karakter dan dibuat acak
- `DB_PASSWORD`, `MYSQL_PASSWORD`, dan `MYSQL_ROOT_PASSWORD` memakai password kuat
- `ALLOW_IN_MEMORY_PASSWORD_RESET_STORE=false`
- Redis aktif untuk reset password dan OTP
- Reverse proxy meneruskan `X-Real-IP`, `X-Forwarded-For`, dan `X-Forwarded-Proto`

Backend sekarang akan gagal start di production jika secret/default penting masih lemah atau Redis tidak tersedia.

Checklist lengkap tersedia di [docs/production-checklist.md](docs/production-checklist.md).

## Catatan Dokumentasi

- [packages/backend/src/routes/uml-latest.puml](packages/backend/src/routes/uml-latest.puml): diagram domain/class untuk struktur dan relasi utama backend.
- [packages/backend/src/routes/uml-usecase.puml](packages/backend/src/routes/uml-usecase.puml): diagram use case untuk alur interaksi pengguna dengan fitur sistem.
