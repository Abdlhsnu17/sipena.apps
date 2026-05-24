# SIPENA

Sistem Informasi Inventaris dan Pemeliharaan Sarana Prasarana Peminjaman (SiPeNa) adalah aplikasi web untuk membantu pengelolaan sarana dan prasarana rumah sakit secara lebih rapi, cepat, dan terpusat. Aplikasi ini memadukan pengelolaan aset, peminjaman, pemeliharaan, laporan, dan dokumentasi sistem dalam satu monorepo.

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
- Dashboard dan laporan aset, peminjaman, pemeliharaan, serta unggahan laporan.
- Riwayat aktivitas pengguna dan endpoint dokumentasi UML.

Catatan: endpoint export PDF dan Excel sudah disiapkan di backend, tetapi implementasi export-nya masih bertahap.

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
│   └── db/
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

- Node.js 20.18 atau lebih baru.
- npm 11.7 atau lebih baru.
- MySQL 8.0 jika menjalankan database lokal.
- Redis opsional untuk backend.
- Docker Desktop / Docker Engine + Docker Compose jika ingin menjalankan via container.

## Konfigurasi Environment

### Frontend

Jika ingin mengarahkan frontend ke API tertentu, set `NEXT_PUBLIC_API_URL`.

### Backend

Variabel environment yang umum dipakai backend:

- `NODE_ENV`
- `PORT`
- `FRONTEND_URL`
- `TRUST_PROXY_HOPS`
- `GENERAL_RATE_LIMIT_MAX`
- `LOGIN_RATE_LIMIT_MAX`
- `UPLOADS_ROOT`
- `DB_CONNECTION_LIMIT`
- `DB_QUEUE_LIMIT`
- `DB_CONNECT_TIMEOUT_MS`
- `DB_IDLE_TIMEOUT_MS`
- `DB_KEEP_ALIVE_INITIAL_DELAY_MS`
- `ALLOW_IN_MEMORY_PASSWORD_RESET_STORE`
- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `JWT_SECRET`
- `REDIS_HOST`
- `REDIS_PORT`
- `OTP_BRAND_NAME`
- `WHATSAPP_OTP_WEBHOOK_URL`
- `WHATSAPP_OTP_WEBHOOK_TOKEN`
- `SMS_OTP_WEBHOOK_URL`
- `SMS_OTP_WEBHOOK_TOKEN`

Di mode development, backend bisa memakai default lokal seperti `DB_HOST=127.0.0.1`, `DB_PORT=3306`, `DB_NAME=sipena_db_local`, dan `DB_USER=root`.

Untuk production di balik reverse proxy, set minimal:

- `TRUST_PROXY_HOPS=1` untuk arsitektur `Nginx -> Next.js -> Backend`
- `GENERAL_RATE_LIMIT_MAX=1000`
- `LOGIN_RATE_LIMIT_MAX=20`
- `DB_CONNECTION_LIMIT=30`
- `ALLOW_IN_MEMORY_PASSWORD_RESET_STORE=false`

Catatan:

- `GENERAL_RATE_LIMIT_MAX` dipakai untuk traffic API umum.
- `LOGIN_RATE_LIMIT_MAX` dipakai khusus percobaan login.
- Jika ada lebih dari satu proxy tepercaya di depan backend, sesuaikan `TRUST_PROXY_HOPS`.
- Untuk production, reset password sebaiknya memakai webhook WhatsApp aktif, SMS fallback aktif, dan Redis aktif.
- `UPLOADS_ROOT` bisa diarahkan ke mounted shared storage jika backend dijalankan lebih dari satu instance.

## Menjalankan Aplikasi

### Install Dependensi

1. Jalankan `npm install` dari root repository.

### Frontend

1. Jalankan `npm run dev` untuk mode development.
2. Jalankan `npm run build` untuk build production.
3. Jalankan `npm run start` untuk menjalankan hasil build.

### Backend

1. Jalankan `npm run dev:backend` untuk mode development.
2. Jalankan `npm run build:backend` untuk build TypeScript backend.
3. Jalankan `npm run start:backend` untuk menjalankan hasil build backend.
4. Jalankan `npm run migrate:user-security-columns` jika ingin menambahkan kolom `phone_number` dan `session_version` ke database aktif secara manual.

### Jalankan Keduanya

1. Jalankan `npm run dev:all` jika ingin menyalakan workspace yang tersedia secara bersamaan.

## Menjalankan Dengan Docker

Docker Compose utama ada di `packages/backend/docker-compose.yml`.

Service yang disiapkan:

- `mysql` di `localhost:3306`
- `redis` di `localhost:6379`
- `phpmyadmin` di `http://localhost:8081`
- `backend` di `http://localhost:4000`
- `frontend` di `http://localhost:3000`

Langkah cepat:

1. Opsional: copy `packages/backend/.docker.env.example` menjadi `packages/backend/.docker.env`.
2. Jika memakai file env tadi, jalankan `docker compose --env-file packages/backend/.docker.env -f packages/backend/docker-compose.yml up --build`.
3. Jika ingin memakai nilai default bawaan compose, jalankan `docker compose -f packages/backend/docker-compose.yml up --build`.

Catatan:

- Schema database otomatis diimpor dari `packages/database/seeds/schema.sql` saat volume MySQL masih baru.
- Jika sebelumnya sudah pernah membuat volume MySQL dan ingin mengulang inisialisasi dari nol, jalankan `docker compose -f packages/backend/docker-compose.yml down -v` lalu `up` lagi.
- Frontend Docker memakai proxy internal Next.js ke `backend`, jadi `NEXT_PUBLIC_API_URL` bisa dibiarkan kosong.
- Jika hanya ingin menyalakan service infrastruktur, jalankan `docker compose -f packages/backend/docker-compose.yml up mysql redis phpmyadmin -d`.

## Kesiapan Production

Untuk deploy di Hostinger VPS, Railway, AWS, atau platform serupa:

- pastikan reverse proxy meneruskan `X-Real-IP`, `X-Forwarded-For`, dan `X-Forwarded-Proto`
- sesuaikan `TRUST_PROXY_HOPS` dengan jumlah hop proxy yang dipercaya
- atur `GENERAL_RATE_LIMIT_MAX` dan `LOGIN_RATE_LIMIT_MAX` sesuai beban

Checklist ringkas tersedia di [docs/production-checklist.md](/Users/abdillah/sipena-rsup/docs/production-checklist.md).

Untuk simulasi login serentak, jalankan:

```bash
LOAD_TEST_URL=http://127.0.0.1:3000/api/auth/login \
LOAD_TEST_CONCURRENCY=20 \
LOAD_TEST_TOTAL=100 \
LOAD_TEST_NIP=user-uji \
LOAD_TEST_PASSWORD=password-salah \
npm run load-test:login
```

## Catatan Dokumentasi

- [packages/backend/src/routes/uml-latest.puml](packages/backend/src/routes/uml-latest.puml): diagram domain/class untuk struktur dan relasi utama backend.
- [packages/backend/src/routes/uml-usecase.puml](packages/backend/src/routes/uml-usecase.puml): diagram use case untuk alur interaksi pengguna dengan fitur sistem.
