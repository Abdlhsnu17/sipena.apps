# Backend SIPENA

Workspace `inventory-backend` adalah REST API SIPENA berbasis Express dan TypeScript. Backend menjadi sumber aturan bisnis, autentikasi/otorisasi, validasi request, akses MySQL, notifikasi, audit aktivitas, ekspor laporan, dan penyimpanan file operasional.

## Tanggung Jawab

- Autentikasi JWT, profil, keamanan login, dan reset password melalui WhatsApp/SMS/email.
- CRUD aset medis/non-medis, impor aset, peminjaman, pengembalian, penggunaan, sanksi, disposal, dan permintaan arsip.
- Workflow pemeliharaan dari request hingga validasi, termasuk approval pekerjaan kritis/berbiaya tinggi, reminder, recurrence, attachment, dan sinkronisasi riwayat.
- SPK AHP–TOPSIS, preferensi bobot per pengguna, audit skor, dan riwayat pemeringkatan.
- Laporan, unggahan dokumen, aktivitas pengguna, kontrol akses menu, notifikasi dan stream SSE, serta dokumentasi UML.

Struktur utama:

```text
src/
├── config/        # environment, MySQL, dan Redis
├── controllers/   # adapter HTTP request/response
├── middlewares/   # auth, request context, dan error handler
├── models/        # kontrak/model domain lama yang masih digunakan
├── repositories/  # akses data yang sudah dipisahkan dari service
├── routes/        # endpoint dan validator
├── services/      # aturan bisnis dan orkestrasi
├── scripts/       # runner migrasi/maintenance data
└── utils/         # schema bootstrap, logger, storage, waktu, dan delivery
```

Refactor menuju repository dilakukan bertahap; sejumlah service masih berisi query SQL. Ikuti pola modul yang sedang disentuh dan jangan memindahkan bounded context lain tanpa pengujian regresi.

## Menjalankan Lokal

Salin `.env.example` menjadi `.env`, siapkan MySQL, lalu dari root monorepo jalankan:

```bash
npm install
npm run build:packages
npm run dev:backend
```

Backend default berjalan pada `http://localhost:4000`. Endpoint `GET /health` dan `GET /api/health` menampilkan status server, database, Redis, dan schema. Redis bersifat opsional pada development, tetapi production mewajibkan konfigurasinya dan `ALLOW_IN_MEMORY_PASSWORD_RESET_STORE=false`.

Untuk database baru, set kelima variabel `INITIAL_ADMIN_*` sebelum startup pertama. Akun admin hanya dibuat bila tabel `users` belum memiliki admin. Lihat [`../../packages/database/README.md`](../../packages/database/README.md) untuk seed dan migrasi.
Jika akun admin awal dipakai untuk Selenium atau demo lokal, set `INITIAL_ADMIN_MUST_CHANGE_PASSWORD=false` agar login langsung masuk ke dashboard.

## Environment Penting

| Kelompok | Variabel |
| --- | --- |
| Runtime | `NODE_ENV`, `PORT`, `FRONTEND_URL`, `TRUST_PROXY_HOPS` |
| Database | `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_AUTO_INIT_FROM_SCHEMA` |
| Auth | `JWT_SECRET`, `INITIAL_ADMIN_*`, rate-limit variables |
| Redis/SSE | `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `SSE_TICKET_TTL_SECONDS` |
| File | `UPLOADS_ROOT` |
| OTP/notifikasi | `WHATSAPP_*`, `SMS_*`, `SMTP_*`, `EMAIL_*` |

Production menolak JWT yang pendek/nilai contoh, password database lemah, origin frontend localhost, atau in-memory password reset store. Jangan menyimpan secret asli di repository.

## Grup Endpoint

Semua grup selain endpoint auth publik dan health memerlukan autentikasi.

| Prefix | Fungsi |
| --- | --- |
| `/api/auth`, `/api/users`, `/api/access-control` | akun, profil, user, dan hak akses |
| `/api/assets`, `/api/asset-usage` | inventaris dan penggunaan |
| `/api/borrowing`, `/api/sanctions` | peminjaman, pengembalian, dan sanksi |
| `/api/maintenance`, `/api/maintenance-history`, `/api/maintenance-schedule` | workflow pemeliharaan |
| `/api/dss` | bobot, ranking, dan riwayat SPK |
| `/api/asset-disposal`, `/api/deletion-requests` | disposal dan arsip terkontrol |
| `/api/reports`, `/api/user-activities`, `/api/uml` | laporan, audit, dan dokumentasi |
| `/api/notifications` | inbox, status delivery, tiket SSE, dan stream |

File profil disajikan dari `/uploads/profiles`; attachment pemeliharaan dari `/uploads/maintenance`. Folder aktual ditentukan oleh `UPLOADS_ROOT` dan harus memakai volume persisten di production.

## Perintah dan Verifikasi

```bash
npm run lint --workspace=inventory-backend
npm run test:backend
npm run build:backend
```

`npm run migrate --workspace=inventory-backend` menjalankan migration runner menggunakan TypeScript. Pada build production gunakan script workspace `migrate:prod`. Selalu backup database dan uji migrasi pada salinan data sebelum menjalankannya di production.
