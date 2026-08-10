# Database SIPENA

Folder ini adalah lokasi kanonis artefak skema database SIPENA. Isinya murni SQL — koneksi database dikelola backend di `apps/backend/src/config`.

## Isi Folder

- `seeds/schema.sql`: struktur dasar untuk instalasi database baru; tidak berisi data contoh.
- `migrations/*.sql`: migrasi aktif (baru) setelah baseline schema terbaru.
- `migrations/archive/`: arsip migrasi historis yang sudah digabung ke baseline schema.
- `seeds/README.md`: panduan khusus impor seed melalui MySQL/phpMyAdmin.

## Inisialisasi Database

1. Buat database sesuai `DB_NAME` (default development: `sipena_db_local`).
2. Impor `seeds/schema.sql` untuk instalasi baru, atau set `DB_AUTO_INIT_FROM_SCHEMA=true` hanya pada database kosong yang memang ingin diinisialisasi otomatis.
3. Jalankan seluruh file migrasi aktif di `migrations/` berurutan berdasarkan nama file.
4. Set kelima `INITIAL_ADMIN_*` sebelum startup backend pertama bila belum ada akun admin.
5. Jalankan backend dan periksa `GET /api/health`.

Dari root monorepo, migration runner dapat dipanggil dengan:

```bash
npm run migrate --workspace=inventory-backend
```

Migration runner mencatat migrasi yang selesai agar tidak diterapkan dua kali. Tetap lakukan backup dan uji restore sebelum migrasi production.

Baseline saat ini sudah mencakup migrasi historis sampai perubahan DSS. Arsip migrasi historis disimpan di `migrations/archive/2026-08-02-baseline/` untuk audit, namun tidak dibaca ulang oleh migration runner.

## Workflow Perubahan Skema

Gunakan urutan kerja berikut agar migrasi dan baseline selalu sinkron:

1. Saat ada fitur yang mengubah struktur DB, buat file baru di `migrations/*.sql` (jangan edit migrasi lama).
2. Jalankan migration runner dan validasi aplikasi pada database lokal/staging.
3. Sebelum push/merge, sinkronkan `seeds/schema.sql` agar mencerminkan hasil akhir seluruh migrasi aktif.
4. Commit migrasi dan perubahan `schema.sql` dalam rangkaian perubahan yang sama.

Dengan pola ini, histori perubahan tetap tercatat di migrasi, sementara `schema.sql` selalu menjadi baseline terbaru untuk instalasi baru.

## Docker

Service MySQL pada `docker/compose.yml` memasang `seeds/schema.sql` ke `/docker-entrypoint-initdb.d/01-schema.sql`. Script init MySQL hanya berjalan saat volume database masih baru. Perubahan pada seed tidak mengubah volume yang sudah berisi data; gunakan migration runner untuk instance yang sudah berjalan.

Host backend dalam container adalah `mysql:3306`, sedangkan backend yang berjalan langsung di host menggunakan port MySQL yang dipublikasikan oleh override development.

Pada image produksi (`docker/backend.Dockerfile`), `migrations/` disalin ke `/database/migrations` agar tetap terbaca oleh migration runner.

#