# Paket Database SIPENA

Package `@sipena/database` menyediakan shared MySQL pool untuk workspace SIPENA dan menjadi lokasi kanonis artefak skema database.

## Isi Paket

- `src/client.ts`: membuat dan menutup singleton pool `mysql2/promise` berdasarkan `@sipena/config`.
- `seeds/schema.sql`: struktur dasar untuk instalasi database baru; tidak berisi data contoh.
- `migrations/*.sql`: perubahan skema inkremental dan idempotent setelah seed.
- `seeds/README.md`: panduan khusus impor seed melalui MySQL/phpMyAdmin.

## Inisialisasi Database

1. Buat database sesuai `DB_NAME` (default development: `sipena_db_local`).
2. Impor `seeds/schema.sql` untuk instalasi baru, atau set `DB_AUTO_INIT_FROM_SCHEMA=true` hanya pada database kosong yang memang ingin diinisialisasi otomatis.
3. Jalankan seluruh file di `migrations/` berurutan berdasarkan nama file.
4. Set kelima `INITIAL_ADMIN_*` sebelum startup backend pertama bila belum ada akun admin.
5. Jalankan backend dan periksa `GET /api/health`.

Dari root monorepo, migration runner dapat dipanggil dengan:

```bash
npm run migrate --workspace=inventory-backend
```

Migration runner mencatat migrasi yang selesai agar tidak diterapkan dua kali. Tetap lakukan backup dan uji restore sebelum migrasi production.

## Docker

Service MySQL pada `docker/compose.yml` memasang `seeds/schema.sql` ke `/docker-entrypoint-initdb.d/01-schema.sql`. Script init MySQL hanya berjalan saat volume database masih baru. Perubahan pada seed tidak mengubah volume yang sudah berisi data; gunakan migration runner untuk instance yang sudah berjalan.

Host backend dalam container adalah `mysql:3306`, sedangkan backend yang berjalan langsung di host menggunakan port MySQL yang dipublikasikan oleh override development.

## Paket TypeScript

```bash
npm run build --workspace=@sipena/database
```

Gunakan `getDatabaseClient()` untuk memperoleh pool dan `closeDatabaseClient()` saat proses shutdown. Konfigurasi pool berasal dari `DB_CONNECTION_LIMIT`, `DB_QUEUE_LIMIT`, `DB_CONNECT_TIMEOUT_MS`, `DB_IDLE_TIMEOUT_MS`, dan `DB_KEEP_ALIVE_INITIAL_DELAY_MS`.
