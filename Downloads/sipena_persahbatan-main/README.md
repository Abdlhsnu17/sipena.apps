# Deskripsi dan Struktur Aplikasi SIPENA

SIPENA (Sistem Inventaris, Pemeliharaan Sarana, dan Peminjaman) merupakan aplikasi berbasis web yang dikembangkan untuk mendukung pengelolaan sarana dan prasarana secara terintegrasi, terstruktur, dan terdokumentasi. Sistem ini dirancang sebagai solusi atas permasalahan pencatatan inventaris, pemeliharaan sarana, serta proses peminjaman barang yang masih dilakukan secara manual atau belum terintegrasi dalam satu sistem.

Pengembangan SIPENA menggunakan pendekatan System Development Life Cycle (SDLC) dengan tahapan analisis kebutuhan, perancangan sistem, implementasi, pengujian, dan pemeliharaan. Sistem dibangun menggunakan arsitektur client–server dengan pemisahan antara backend, frontend, dan database dalam satu monorepo.

## Tujuan Pengembangan Sistem

Tujuan dari pengembangan sistem SIPENA adalah sebagai berikut:

- Menyediakan sistem informasi inventaris sarana yang terstruktur dan mudah dikelola.
- Mendukung pencatatan dan monitoring pemeliharaan sarana secara berkala.
- Mengelola proses peminjaman dan pengembalian barang secara transparan.
- Meningkatkan akurasi data, efisiensi kerja, dan akuntabilitas pengelolaan sarana.
- Menyediakan sistem berbasis web yang mudah diakses oleh pengguna sesuai hak akses.

## Ruang Lingkup Sistem

Ruang lingkup pengembangan SIPENA meliputi:

- Pengelolaan data inventaris sarana
- Pengelolaan data pemeliharaan sarana
- Pengelolaan peminjaman dan pengembalian barang
- Manajemen pengguna dan hak akses
- Penyimpanan riwayat aktivitas sistem

Sistem ini tidak menggantikan SIMRS, tetapi berfungsi sebagai sistem pendukung (supporting system) yang terintegrasi secara konseptual dengan sistem informasi institusi.

## Arsitektur Sistem

SIPENA menggunakan arsitektur three-tier architecture:

Presentation Layer (Frontend - Next.js)
            │
Application Layer (Backend API - Node.js & Express)
            │
Data Layer (Database - MySQL)

Pendekatan ini memudahkan pengembangan, pemeliharaan, serta pengujian sistem secara terpisah.

## Struktur Direktori Utama

```
.
├── packages/
│   ├── backend/    # Kode sisi server (Backend)
│   ├── frontend/   # Kode sisi klien (Frontend)
│   └── database/   # Skema, migrasi, dan seed database
├── .gitignore
├── package.json
├── README.md
└── TODO.md
```

### 1. packages/backend/

**Fungsi:** Menyediakan RESTful API, mengelola database, otentikasi, dan logika bisnis.

**Struktur:**
```
packages/backend/
├── src/
│   ├── controllers/    # Mengatur alur request-response dari klien ke service.
│   ├── models/         # Skema data/model database (ORM/ODM).
│   ├── routes/         # Mendefinisikan endpoint API dan menghubungkan ke controller.
│   ├── services/       # Logika bisnis utama, pemrosesan data.
│   ├── middlewares/    # Fungsi perantara (otentikasi, logging, error handling).
│   └── index.ts        # Entry point utama aplikasi backend.
├── node_modules/
└── package.json        # Dependensi dan skrip backend.
```

- **controllers/**: Menangani permintaan dari user, memanggil service, dan mengembalikan response.
- **models/**: Mendefinisikan struktur data yang digunakan di database.
- **routes/**: Menyusun rute API, menghubungkan URL ke controller.
- **services/**: Berisi logika bisnis, seperti validasi, pemrosesan data, dsb.
- **middlewares/**: Fungsi yang dijalankan sebelum controller, misal cek login.
- **index.ts**: File utama untuk menjalankan server backend.

### 2. packages/frontend/

**Fungsi:** Menyediakan antarmuka pengguna berbasis web, dibangun dengan Next.js (App Router).

**Struktur:**
```
packages/frontend/
├── app/                # Halaman dan layout utama (App Router Next.js)
│   ├── (auth)/         # Halaman otentikasi (login, register)
│   ├── (dashboard)/    # Halaman utama setelah login (dashboard, fitur utama)
│   │   ├── medical-assets/
│   │   └── page.tsx
│   ├── api/            # Route handlers API sisi frontend (jika ada)
│   └── layout.tsx      # Layout global aplikasi
├── components/         # Komponen UI yang dapat digunakan ulang (Button, Card, Modal, dsb)
├── lib/                # Fungsi bantuan, hooks, konfigurasi
├── public/             # Aset statis (gambar, ikon, dsb)
└── package.json        # Dependensi dan skrip frontend
```

- **app/**: Struktur halaman Next.js, termasuk layout, halaman login, dashboard, dsb.
- **components/**: Komponen UI seperti tombol, kartu, modal, tabel, dsb.
- **lib/**: Utility functions, custom hooks, konfigurasi.
- **public/**: File statis yang bisa diakses langsung (logo, gambar, favicon).
- **package.json**: Daftar dependensi dan skrip untuk frontend.

### 3. packages/database/

**Fungsi:** Menyimpan skema, migrasi, dan seed data untuk database aplikasi.

**Struktur:**
```
packages/database/
├── migrations/   # File migrasi database
├── seeds/        # Data awal (seed) untuk database
├── schema.sql    # Skema utama database
└── README.md     # Dokumentasi database
```

### 4. File Konfigurasi & Dokumentasi

- **.gitignore**: Daftar file/folder yang diabaikan oleh git.
- **README.md**: Dokumentasi utama proyek, penjelasan setup, troubleshooting, dsb.
- **TODO.md**: Daftar tugas, dokumentasi struktur, dan catatan pengembangan.

## Local MySQL + phpMyAdmin

If you need to spin up a disposable MySQL instance with phpMyAdmin for `sipena_db_local`, use the Docker Compose manifest in `packages/backend/docker-compose.yml`:

1. Run `docker compose -f packages/backend/docker-compose.yml up mysql phpmyadmin` from the repo root to start MySQL (port `3306`) and phpMyAdmin (port `8081`). The default database, user, and password are all configured as `sipena_db_local` / `root` / `root`.
2. Visit `http://localhost:8081`, log in with `root` / `root`, create or select the `sipena_db_local` database, and import `packages/database/schema.sql`.
3. Update `packages/backend/.env` so `DB_PASSWORD=root` before running the backend (the file currently leaves `DB_PASSWORD` empty for local installs).

After the schema is imported, the backend and frontend can connect to `sipena_db_local` on `localhost:3306` using the credentials above, and phpMyAdmin remains available for browsing or seeding additional data.

---

Aplikasi ini dirancang modular dan scalable, sehingga mudah dikembangkan dan dipelihara ke depannya.

# Sistem Inventaris

Monorepo for inventory management, maintenance, and borrowing.

## Packages

- `packages/frontend`: Next.js frontend
- `packages/backend`: API server
- `packages/database`: schema, migrations, and seeds


## Fitur Utama SIPENA

- Manajemen data inventaris (tambah, edit, hapus, pencarian)
- Penjadwalan dan pencatatan pemeliharaan sarana
- Sistem peminjaman dan pengembalian barang
- Otentikasi dan manajemen pengguna (admin, leader, user)
- Laporan dan riwayat aktivitas

## Teknologi yang Digunakan

- Backend: Node.js, Express, TypeScript
- Frontend: Next.js, React, TypeScript, Tailwind CSS
- Basis Data: SQL (lihat folder `packages/database`)
- Lainnya: Docker (opsional), Redis (opsional)

## Instalasi & Menjalankan Aplikasi

1. Kloning repository:
   ```bash
   git clone <repo-url>
   cd <nama-folder>
   ```
2. Install dependensi:
   ```bash
   npm install
   ```
3. Atur environment variable:
   - Lihat contoh file `.env.example` di masing-masing folder (`backend`, `frontend`).
   - Sesuaikan konfigurasi database, port, dan API URL.
4. Jalankan backend:
   ```bash
   cd packages/backend
   npm run dev
   ```
5. Jalankan frontend:
   ```bash
   cd packages/frontend
   npm run dev
   ```

## Struktur Pengguna & Hak Akses

- **Admin:** Akses penuh ke seluruh fitur (inventaris, pemeliharaan, peminjaman, manajemen pengguna)
- **Leader:** Akses hampir penuh, kecuali manajemen pengguna
- **User:** Akses terbatas, hanya dapat melakukan peminjaman dan melihat data

## Alur Pengembangan

- Tambahkan fitur baru di folder yang sesuai (backend/frontend)
- Gunakan branch terpisah untuk pengembangan fitur
- Lakukan pengujian sebelum merge ke branch utama
- Dokumentasikan perubahan di README/TODO jika perlu

## Kontribusi & Lisensi

Kontribusi terbuka untuk pengembangan lebih lanjut. Silakan buat pull request atau issue untuk diskusi. Lisensi proyek dapat disesuaikan sesuai kebutuhan institusi.

---
