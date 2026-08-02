# Active Migrations

Folder ini khusus untuk migrasi SQL aktif (baru) setelah baseline schema terbaru.

## Aturan

- Simpan file migrasi baru langsung di folder ini (`database/migrations/*.sql`).
- Gunakan format nama berurutan waktu: `YYYYMMDD_deskripsi.sql`.
- Jangan mengubah isi migrasi yang sudah pernah dijalankan di environment mana pun.
- Untuk perubahan lama, lihat arsip di `database/migrations/archive/`.
- Setelah migrasi baru lolos validasi, sinkronkan juga `database/seeds/schema.sql` sebelum push/merge.

## Baseline Saat Ini

- Baseline schema sudah mencakup seluruh perubahan historis sampai modul DSS (termasuk tabel preferensi bobot, riwayat ranking, dan matriks pairwise).
- Migrasi historis dipindahkan ke `database/migrations/archive/2026-08-02-baseline/` agar folder migrasi aktif tetap ringkas.

## Catatan Runner

Migration runner backend membaca file `.sql` dari level root folder `database/migrations` (non-recursive). Karena itu file di `archive/` tidak akan dijalankan ulang.

## Ringkasan Alur

1. Tambah migrasi baru untuk setiap perubahan skema fitur.
2. Jalankan migrasi dan verifikasi aplikasi.
3. Update `schema.sql` agar baseline mengikuti hasil migrasi terbaru.
4. Push migrasi + `schema.sql` bersamaan.
