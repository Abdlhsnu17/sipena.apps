# Seed Database SIPENA

Folder ini menyimpan `schema.sql`, yaitu struktur dasar MySQL untuk instalasi SIPENA baru. File ini tidak berisi akun, aset, transaksi, atau data contoh. Perubahan skema setelah baseline seed berada di `../migrations` (migrasi aktif) dan tetap harus dijalankan berurutan.

`schema.sql` harus selalu ikut diperbarui setiap ada migrasi baru yang akan di-push/merge, supaya baseline instalasi baru tetap setara dengan state database hasil migrasi terbaru.

Dokumentasi database secara keseluruhan tersedia di [`../README.md`](../README.md).

## MySQL dan phpMyAdmin melalui Docker

Dari root repository jalankan:

```bash
docker compose -f docker/compose.yml -f docker/compose.override.yml up -d mysql phpmyadmin
```

Pada konfigurasi development bawaan:

- phpMyAdmin: `http://localhost:8081`
- database: `sipena_db_local`
- login phpMyAdmin: `root` / `root_changeme`
- koneksi dari container backend: `mysql:3306`, user `sipena_app`, password `changeme`

Nilai bawaan hanya untuk mesin lokal. Gunakan `--env-file docker/.env` dengan kredensial kuat untuk environment bersama dan production.

Saat volume `mysql_data` masih kosong, MySQL otomatis menjalankan `schema.sql` karena file tersebut dipasang ke `/docker-entrypoint-initdb.d/01-schema.sql`. Jika volume sudah pernah dibuat, perubahan seed tidak diterapkan ulang. Jalankan migration runner untuk database yang sudah ada:

```bash
npm run migrate --workspace=inventory-backend
```

## Impor Manual

Untuk MySQL yang tidak dibuat melalui Compose:

1. Buat database dengan charset `utf8mb4`.
2. Impor `packages/database/seeds/schema.sql` ke database tersebut.
3. Isi konfigurasi `DB_*` di `apps/backend/.env`.
4. Jalankan seluruh migrasi melalui migration runner.
5. Isi `INITIAL_ADMIN_NIP`, `INITIAL_ADMIN_NAME`, `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_PASSWORD`, dan `INITIAL_ADMIN_PHONE` sebelum startup backend pertama.

Backend membuat tepat satu admin awal hanya bila seluruh variabel tersebut terisi dan tabel `users` belum memiliki admin. Endpoint register publik tidak dapat membuat role admin.

## Migrasi Aktif

Migration runner membaca semua file `.sql` di root `database/migrations` (non-recursive) berdasarkan urutan nama dan mencatat hasilnya di tabel `schema_migrations`.

Baseline `schema.sql` saat ini sudah mencakup perubahan berikut:

- sanksi, perpanjangan peminjaman, dan keamanan user;
- log/sumber/audit penggunaan aset dan hubungan dengan peminjaman;
- sub-unit kerja, kontrol akses user/menu, dan notifikasi;
- deletion request, soft delete, dan disposal aset;
- workflow pemeliharaan, pilihan detail aset, lampiran, approval, reminder, recurrence, serta verifikasi;
- penautan Pemilik/PJ peminjaman ke akun aktif;
- preferensi bobot, riwayat ranking, dan matriks AHP pada modul SPK.

Jangan mengedit migration yang sudah diterapkan untuk mengubah perilaku database. Buat file migration baru agar perubahan dapat diaudit dan diterapkan konsisten pada seluruh environment.
