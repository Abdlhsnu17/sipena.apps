# Product Requirements Document (PRD) — SIPENA

| Metadata | Nilai |
| --- | --- |
| Produk | SIPENA — Sistem Inventaris, Peminjaman, dan Pemeliharaan Sarana |
| Jenis dokumen | As-built PRD |
| Versi dokumen | 1.0 |
| Versi aplikasi | 2.5.0 |
| Status | Baseline implementasi aktif |
| Terakhir diperbarui | 12 Juli 2026 |
| Sumber kebenaran teknis | Implementasi di `apps/frontend`, `apps/backend`, dan `packages/database` |

## 1. Tujuan Dokumen

Dokumen ini menjelaskan kebutuhan produk yang tercermin pada implementasi SIPENA saat ini. Karena aplikasi telah dibangun, dokumen ini berfungsi sebagai baseline _as-built_: menjelaskan kemampuan yang tersedia, pengguna yang dilayani, aturan bisnis utama, batas sistem, dan kriteria penerimaan tingkat produk.

Jika terdapat perbedaan antara dokumen ini dan perilaku aplikasi, kode serta skema database yang sedang berjalan menjadi sumber kebenaran sampai perbedaan tersebut ditinjau dan PRD diperbarui.

## 2. Ringkasan Produk

SIPENA adalah aplikasi web terpusat untuk mengelola sarana dan prasarana rumah sakit. Produk menyatukan inventaris aset medis dan non-medis, peminjaman, pengembalian, penggunaan aset, pemeliharaan, penentuan prioritas aset, penghapusan aset, sanksi, laporan, dokumen, notifikasi, dan audit aktivitas.

### 2.1 Masalah yang diselesaikan

- Data aset dan riwayat operasional tersebar atau sulit ditelusuri.
- Status ketersediaan, peminjaman, penggunaan, dan pemeliharaan aset tidak mudah dipantau secara terpadu.
- Persetujuan dan validasi transaksi memerlukan batas kewenangan yang jelas.
- Keterlambatan pengembalian dan kondisi aset perlu dicatat serta ditindaklanjuti.
- Manajemen memerlukan laporan dan prioritas aset berbasis data.
- Aktivitas penting perlu dapat diaudit.

### 2.2 Nilai produk

- Menyediakan satu sumber data operasional aset.
- Menjaga kesinambungan riwayat aset dari inventaris hingga penghapusan.
- Memisahkan pengajuan, pelaksanaan, persetujuan, dan validasi berdasarkan role.
- Mempermudah pemantauan kondisi, lokasi, peminjam, penggunaan, dan pekerjaan pemeliharaan.
- Menyediakan laporan, ekspor, notifikasi, dan jejak aktivitas untuk pengawasan.

## 3. Tujuan dan Ukuran Keberhasilan

### 3.1 Tujuan produk

1. Seluruh aset medis dan non-medis yang dikelola tercatat secara terstruktur.
2. Transaksi peminjaman, pengembalian, penggunaan, dan pemeliharaan dapat ditelusuri hingga pengguna pelaksana.
3. Hanya role berwenang yang dapat melakukan tindakan sensitif.
4. Pengguna dapat mengetahui status transaksi dan tugas yang perlu ditindaklanjuti.
5. Manajemen memperoleh laporan operasional yang dapat difilter dan diekspor.

### 3.2 KPI yang direkomendasikan

Implementasi saat ini belum mendefinisikan target KPI bisnis formal. Baseline berikut perlu disepakati pemilik produk sebelum dijadikan target layanan:

- Persentase aset aktif dengan data identitas, lokasi, jumlah, kondisi, dan kategori yang lengkap.
- Persentase peminjaman yang memiliki persetujuan dan validasi pengembalian tercatat.
- Jumlah transaksi melewati jatuh tempo dan rata-rata waktu penyelesaiannya.
- Persentase pemeliharaan selesai sesuai jadwal.
- Persentase penggunaan aset yang ditutup dengan kondisi akhir tercatat.
- Waktu rata-rata dari pengajuan menuju persetujuan atau penolakan.
- Jumlah tindakan sensitif yang memiliki jejak audit lengkap.

Status: **Planned — target numerik belum ditetapkan.**

## 4. Pengguna dan Role

SIPENA memiliki enam role aktif. Nama role disimpan sebagai `admin`, `leader`, `staff`, `staff_pj`, `teknisi`, dan `user`.

| Role | Persona | Tanggung jawab utama |
| --- | --- | --- |
| Admin | Administrator sistem | Mengelola seluruh data, pengguna, hak akses menu, validasi, arsip, sanksi, dan tindakan destruktif. |
| Leader | Pimpinan/pengawas operasional | Mengawasi transaksi, menyetujui alur operasional, mengelola data tertentu, serta mengajukan arsip atau penghapusan untuk ditinjau admin. |
| Staff Pelayanan | Pelaksana layanan | Menjalankan aktivitas harian seperti peminjaman, pengembalian, penggunaan, dan permintaan pemeliharaan. |
| Staff PJ | Penanggung jawab inventaris/unit | Mengelola inventaris dalam cakupan aksesnya dan ikut menyetujui serta memvalidasi transaksi peminjaman. |
| Teknisi | Pelaksana teknis | Menangani jadwal serta status pemeliharaan dan memantau informasi teknis terkait. |
| User | Pengguna self-service | Melihat inventaris, mengajukan peminjaman, mencatat pengembalian/penggunaan, dan mengelola profil sendiri. |

### 4.1 Prinsip akses

- Seluruh API operasional memerlukan autentikasi kecuali endpoint publik autentikasi dan health check.
- Akses halaman dikendalikan oleh kombinasi daftar route frontend dan matriks menu berbasis database.
- Admin selalu memperoleh seluruh menu agar tidak terkunci oleh konfigurasi matriks.
- Akses terhadap sebuah menu tidak otomatis memberikan izin untuk semua tindakan di dalamnya.
- Aksi sensitif tetap diperiksa oleh otorisasi backend.
- `staffAccessType` membatasi cakupan inventaris staff menjadi medis, non-medis, atau seluruhnya bila diterapkan pada akun.

## 5. Ruang Lingkup Produk

### 5.1 Termasuk dalam scope

- Autentikasi dan profil pengguna.
- Dashboard operasional.
- Inventaris aset medis dan non-medis.
- Impor data inventaris.
- Peminjaman, persetujuan, penolakan, perpanjangan, pengembalian, dan validasi pengembalian.
- Pencatatan penggunaan aset.
- Pemeliharaan, riwayat, dan jadwal pemeliharaan.
- SPK prioritas aset.
- Penghapusan aset.
- Permintaan arsip data.
- Sanksi keterlambatan.
- Laporan, analitik, ekspor, dan unggah dokumen.
- Notifikasi dalam aplikasi dan status kanal pengiriman yang tersedia.
- Riwayat aktivitas pengguna.
- Dokumentasi sistem/UML.
- Pengaturan profil dan hak akses menu.

### 5.2 Di luar scope saat ini

- Pengadaan dan proses pembelian aset end-to-end.
- Akuntansi, depresiasi, dan integrasi buku besar keuangan.
- Integrasi langsung dengan SIMRS, ERP, SSO, atau sistem vendor eksternal.
- Aplikasi mobile native dan mode offline.
- Pelacakan lokasi real-time berbasis RFID/IoT.
- Tanda tangan elektronik tersertifikasi.
- SLA dan KPI bisnis dengan target numerik yang disepakati.

## 6. Modul dan Kebutuhan Fungsional

Status yang digunakan: **Implemented**, **Partial**, **Planned**, atau **Out of scope**.

### 6.1 Autentikasi dan akun

| ID | Requirement | Status |
| --- | --- | --- |
| AUTH-01 | Pengguna dapat login menggunakan NIP/identitas atau email dan password. | Implemented |
| AUTH-02 | Pengguna dapat mendaftar dengan NIP, nama, email, nomor telepon, dan password kuat. | Implemented |
| AUTH-03 | Password minimal delapan karakter serta mengandung huruf besar, huruf kecil, dan angka. | Implemented |
| AUTH-04 | Pengguna dapat mereset password dengan kode verifikasi enam digit. | Implemented |
| AUTH-05 | Pengguna terautentikasi dapat logout dan melihat profil sendiri. | Implemented |
| AUTH-06 | Pengguna dapat memperbarui profil dan mengunggah foto JPG, JPEG, PNG, atau WebP maksimal 5 MB. | Implemented |
| AUTH-07 | Sistem menerapkan status akun dan dukungan kewajiban mengganti password. | Implemented |

### 6.2 Manajemen pengguna dan akses

| ID | Requirement | Status |
| --- | --- | --- |
| USR-01 | Admin dan leader dapat membuat serta memperbarui akun pengguna sesuai batas backend. | Implemented |
| USR-02 | Admin dapat melihat detail dan menghapus/mengarsipkan akun secara langsung. | Implemented |
| USR-03 | Leader dapat mengajukan permintaan arsip pengguna untuk ditinjau admin. | Implemented |
| USR-04 | Admin dapat mengaktifkan atau menonaktifkan akun. | Implemented |
| USR-05 | Admin dapat mengatur menu yang tersedia untuk setiap role. | Implemented |
| USR-06 | Sistem menyediakan enam role aktif dan cakupan inventaris staff. | Implemented |

### 6.3 Inventaris aset

| ID | Requirement | Status |
| --- | --- | --- |
| AST-01 | Pengguna berizin dapat melihat dan mencari inventaris medis maupun non-medis. | Implemented |
| AST-02 | Admin, leader, dan Staff PJ dapat menambah, mengubah, serta mengimpor aset. | Implemented |
| AST-03 | Admin dapat menghapus aset dan mereset inventaris. | Implemented |
| AST-04 | Data aset mencakup identitas, tipe, kategori, jumlah, kondisi, lokasi, dan rincian spesifik sesuai jenis aset. | Implemented |
| AST-05 | Sistem membatasi hasil inventaris sesuai `staffAccessType` dan konteks pengguna bila berlaku. | Implemented |
| AST-06 | Sistem menyediakan template impor inventaris. | Implemented |

### 6.4 Peminjaman dan pengembalian

| ID | Requirement | Status |
| --- | --- | --- |
| BRW-01 | Pengguna berizin dapat mengajukan peminjaman aset dengan tanggal, tujuan, jumlah, lokasi tujuan, dan catatan. | Implemented |
| BRW-02 | Status utama peminjaman adalah `pending`, `approved`, `rejected`, `borrowed`, `returned`, dan `overdue`. | Implemented |
| BRW-03 | Admin, leader, dan Staff PJ dapat menyetujui atau menolak peminjaman. | Implemented |
| BRW-04 | Pengguna dalam alur peminjaman dapat mencatat pengembalian dan kondisi aset. | Implemented |
| BRW-05 | Admin, leader, dan Staff PJ dapat memvalidasi pengembalian. | Implemented |
| BRW-06 | Peminjaman aktif dapat diajukan untuk perpanjangan tanggal jatuh tempo sesuai validasi bisnis. | Implemented |
| BRW-07 | Sistem menandai dan menampilkan transaksi yang melewati jatuh tempo. | Implemented |
| BRW-08 | Admin dapat menghapus record; leader menggunakan mekanisme permintaan arsip bila tersedia pada konteks transaksi. | Implemented |

Alur utama:

```text
Pengajuan -> Pending -> Disetujui -> Dipinjam -> Dicatat kembali -> Divalidasi kembali
                  \-> Ditolak
                              \-> Overdue apabila melewati jatuh tempo
```

### 6.5 Penggunaan aset

| ID | Requirement | Status |
| --- | --- | --- |
| USE-01 | Pengguna berizin dapat mencatat penggunaan aset, operator, ruangan, waktu mulai, jumlah, kondisi awal, dan catatan. | Implemented |
| USE-02 | Penggunaan dapat diselesaikan dengan waktu selesai dan kondisi akhir. | Implemented |
| USE-03 | Sistem menghubungkan penggunaan dengan aset dan, bila relevan, transaksi peminjaman. | Implemented |
| USE-04 | Penggunaan aset yang berasal dari peminjaman mengikuti pembatasan pengguna dan unit kerja. | Implemented |
| USE-05 | Penggunaan darurat atas peminjaman overdue hanya dapat dikelola admin, leader, atau role yang sama dengan peminjam asal. | Implemented |
| USE-06 | Admin dan leader dapat menghapus catatan penggunaan. | Implemented |

### 6.6 Pemeliharaan dan jadwal

| ID | Requirement | Status |
| --- | --- | --- |
| MNT-01 | Admin, leader, staff, dan Staff PJ dapat membuat permintaan pemeliharaan. | Implemented |
| MNT-02 | Admin, leader, staff, Staff PJ, dan teknisi dapat memperbarui data pemeliharaan sesuai batas aksi. | Implemented |
| MNT-03 | Admin, leader, dan teknisi dapat mengubah status operasional lanjutan. | Implemented |
| MNT-04 | Sistem menyimpan riwayat pemeliharaan aset. | Implemented |
| MNT-05 | Sistem menyediakan jadwal terpisah yang dapat dibuat, dilihat, diubah, dan diperbarui statusnya oleh role operasional yang diizinkan. | Implemented |
| MNT-06 | Admin dapat menghapus record dan jadwal pemeliharaan. | Implemented |
| MNT-07 | Sistem mendukung penyelesaian, validasi, dan pembatalan disertai alasan bila diperlukan. | Implemented |

### 6.7 SPK Prioritas Aset

| ID | Requirement | Status |
| --- | --- | --- |
| DSS-01 | Pengguna yang memiliki akses menu dapat menjalankan perhitungan prioritas aset. | Implemented |
| DSS-02 | Sistem menerima bobot dan matriks penilaian sebagai masukan pemeringkatan. | Implemented |
| DSS-03 | Sistem menampilkan hasil peringkat sebagai bahan pendukung keputusan, bukan keputusan otomatis final. | Implemented |

### 6.8 Penghapusan aset

| ID | Requirement | Status |
| --- | --- | --- |
| DSP-01 | Admin, leader, staff, dan Staff PJ dapat mengajukan penghapusan aset. | Implemented |
| DSP-02 | Admin dapat menyetujui atau menolak pengajuan. | Implemented |
| DSP-03 | Persetujuan menyinkronkan status atau detail inventaris yang dihapuskan. | Implemented |
| DSP-04 | Admin dapat menghapus record pengajuan. | Implemented |

### 6.9 Permintaan arsip data

| ID | Requirement | Status |
| --- | --- | --- |
| DEL-01 | Leader dapat mengajukan arsip untuk entitas yang didukung, termasuk pengguna, peminjaman/pengembalian, dan pemeliharaan. | Implemented |
| DEL-02 | Admin dapat menyetujui atau menolak permintaan arsip. | Implemented |
| DEL-03 | Daftar permintaan hanya dapat dilihat admin dan leader. | Implemented |
| DEL-04 | Penghapusan operasional menggunakan pendekatan arsip/soft delete bila didukung oleh entitas. | Implemented |

### 6.10 Sanksi

| ID | Requirement | Status |
| --- | --- | --- |
| SNC-01 | Admin dan leader dapat melihat daftar serta statistik sanksi. | Implemented |
| SNC-02 | Sistem mencatat sanksi terkait keterlambatan pengembalian. | Implemented |
| SNC-03 | Admin dan leader dapat menyelesaikan atau membebaskan sanksi dengan catatan. | Implemented |

### 6.11 Laporan, dokumen, dan audit

| ID | Requirement | Status |
| --- | --- | --- |
| RPT-01 | Sistem menyediakan dashboard dan laporan aset, pengguna, peminjaman, penggunaan, dan pemeliharaan. | Implemented |
| RPT-02 | Laporan dapat difilter dan diekspor ke format yang didukung, termasuk PDF/Excel pada layar terkait. | Implemented |
| RPT-03 | Pengguna berizin dapat mengunggah, melihat, mengunduh, dan mempratinjau dokumen. | Implemented |
| RPT-04 | Admin dapat menghapus dokumen unggahan. | Implemented |
| RPT-05 | Sistem mencatat dan menampilkan riwayat aktivitas; cakupan melihat aktivitas orang lain bergantung pada role. | Implemented |
| RPT-06 | Sistem menyediakan dokumentasi UML melalui endpoint dan halaman khusus. | Implemented |

### 6.12 Notifikasi

| ID | Requirement | Status |
| --- | --- | --- |
| NTF-01 | Pengguna menerima notifikasi yang relevan dengan role dan transaksi. | Implemented |
| NTF-02 | Pengguna dapat melihat jumlah belum dibaca, menandai satu/semua notifikasi telah dibaca, dan menghapus notifikasi. | Implemented |
| NTF-03 | Sistem menyediakan pembaruan real-time melalui Server-Sent Events. | Implemented |
| NTF-04 | Sistem dapat melaporkan status kanal pengiriman notifikasi yang dikonfigurasi. | Implemented |

## 7. Matriks Kemampuan Role

Tabel berikut merangkum kemampuan utama. Detail endpoint backend tetap menjadi otoritas untuk tindakan spesifik.

| Kemampuan | Admin | Leader | Staff | Staff PJ | Teknisi | User |
| --- | :---: | :---: | :---: | :---: | :---: | :---: |
| Melihat dashboard dan profil | Ya | Ya | Ya | Ya | Ya | Ya |
| Mengelola matriks menu | Ya | — | — | — | — | — |
| Mengelola akun pengguna | Ya | Terbatas | — | — | — | — |
| Melihat inventaris | Ya | Ya | Sesuai cakupan | Sesuai cakupan | Melalui konteks teknis | Ya |
| Menambah/mengubah inventaris | Ya | Ya | — | Ya | — | — |
| Menghapus inventaris | Ya | — | — | — | — | — |
| Mengajukan peminjaman | Ya | Ya | Ya | Ya | — | Ya |
| Menyetujui/menolak peminjaman | Ya | Ya | — | Ya | — | — |
| Mencatat pengembalian | Ya | Ya | Ya | Ya | — | Ya |
| Memvalidasi pengembalian | Ya | Ya | — | Ya | — | — |
| Mencatat penggunaan | Ya | Ya | Ya | Ya | — | Ya |
| Membuat permintaan pemeliharaan | Ya | Ya | Ya | Ya | — | — |
| Mengelola status pemeliharaan | Ya | Ya | Terbatas | Terbatas | Ya | — |
| Mengajukan penghapusan aset | Ya | Ya | Ya | Ya | — | — |
| Menyetujui penghapusan aset | Ya | — | — | — | — | — |
| Mengelola sanksi | Ya | Ya | — | — | — | — |
| Mengajukan arsip data | — | Ya | — | — | — | — |
| Meninjau permintaan arsip | Ya | — | — | — | — | — |

Catatan: menu dapat dinonaktifkan oleh admin melalui matriks akses. Karena itu, kemampuan role di atas adalah batas maksimum default dan dapat lebih sempit pada konfigurasi runtime.

## 8. Aturan Bisnis Utama

1. Jumlah aset yang dipinjam atau digunakan tidak boleh melampaui jumlah yang tersedia menurut validasi transaksi.
2. Tanggal kembali tidak boleh lebih awal dari tanggal pinjam.
3. Persetujuan/penolakan dan validasi pengembalian hanya dilakukan role berwenang.
4. Peminjaman yang melewati jatuh tempo harus dapat dikenali sebagai overdue dan menjadi dasar tindak lanjut atau sanksi.
5. Kondisi aset dicatat pada titik penting: inventaris, penggunaan, pengembalian, dan pemeliharaan.
6. Penghapusan aset merupakan proses pengajuan dan review; persetujuan memengaruhi inventaris terkait.
7. Leader tidak melakukan penghapusan data sensitif secara langsung, tetapi menggunakan permintaan arsip untuk ditinjau admin pada entitas yang didukung.
8. Tindakan pengguna harus menggunakan identitas aktor terautentikasi dan dicatat pada aktivitas yang relevan.
9. Pembatasan backend tetap berlaku walaupun sebuah menu terlihat di frontend.

## 9. Kebutuhan Nonfungsional

### 9.1 Keamanan

- API menggunakan JWT untuk autentikasi.
- Password disimpan dalam bentuk hash dan tunduk pada kebijakan kompleksitas saat dibuat/direset.
- Produksi wajib menggunakan `JWT_SECRET` kuat dan password database non-default.
- Produksi membatasi origin CORS ke `FRONTEND_URL` yang dikonfigurasi.
- Backend menggunakan Helmet, pembatasan request, validasi input, dan pembatasan tipe/ukuran unggahan.
- Hak akses tindakan kritis harus diperiksa di backend, bukan hanya disembunyikan di UI.
- Rahasia tidak boleh disimpan dalam repository.

### 9.2 Kinerja dan kapasitas

- Daftar data besar harus mendukung paginasi, pencarian, atau filter bila endpoint menyediakannya.
- Database menggunakan connection pool yang dapat dikonfigurasi.
- Respons HTTP dapat dikompresi, kecuali aliran SSE.
- Target waktu respons dan kapasitas pengguna bersamaan belum ditetapkan. Status: **Planned**.

### 9.3 Keandalan

- Endpoint `/api/health` menyediakan status layanan dan dependensi utama.
- Startup backend memverifikasi koneksi database, Redis, dan kesiapan skema.
- Redis dapat digunakan untuk kebutuhan runtime; konfigurasi produksi mengharuskannya tersedia.
- Perubahan skema dijalankan melalui migrasi dan pemeriksaan startup yang terkendali.

### 9.4 Audit dan observabilitas

- Backend menghasilkan log terstruktur dengan konteks request.
- Aktivitas pengguna disimpan untuk kebutuhan audit operasional.
- Error API ditangani melalui middleware global dan tidak boleh mengekspos rahasia.

### 9.5 Kompatibilitas dan pengalaman pengguna

- Frontend berbasis web responsif menggunakan Next.js dan React.
- UI menggunakan Bahasa Indonesia sebagai bahasa utama.
- Status proses, validasi, loading, kosong, sukses, dan gagal harus terlihat jelas.
- Dukungan browser formal belum ditetapkan. Status: **Planned**.

### 9.6 Maintainability

- Repository menggunakan monorepo npm workspaces.
- Frontend hanya berkomunikasi dengan backend melalui API.
- Backend memisahkan controller, service, repository, middleware, config, dan utilitas secara bertahap.
- Perubahan wajib lolos lint, build, dan type-check melalui `npm run verify`.

## 10. Arsitektur dan Batas Sistem

```text
Browser
  -> Frontend Next.js (`apps/frontend`)
     -> same-origin proxy `/api` atau `NEXT_PUBLIC_API_URL`
        -> Backend Express (`apps/backend`)
           -> MySQL (data operasional)
           -> Redis (komponen runtime/notifikasi)
           -> filesystem uploads (profil dan dokumen)
           -> email/kanal OTP bila dikonfigurasi
```

- Skema, migrasi, dan seed database berada di `packages/database`.
- Konfigurasi infrastruktur berada di `docker/`.
- Shared types, config, database client, dan utilities berada di `packages/*`.
- API utama menggunakan prefix `/api`.

## 11. Acceptance Criteria Tingkat Produk

Baseline rilis dinyatakan memenuhi PRD bila:

1. Pengguna dapat login dan hanya melihat menu sesuai role serta konfigurasi aksesnya.
2. Admin dapat mengelola pengguna dan matriks akses tanpa kehilangan akses administratif.
3. Aset medis dan non-medis dapat dicari, ditambah, diubah, dan diproses sesuai otorisasi.
4. Satu alur peminjaman dapat berjalan dari pengajuan sampai pengembalian tervalidasi, termasuk jalur penolakan dan overdue.
5. Penggunaan aset dapat dicatat dan diselesaikan dengan jejak operator, waktu, lokasi, dan kondisi.
6. Pemeliharaan dapat dibuat, dijadwalkan, diproses, diselesaikan, serta ditelusuri riwayatnya.
7. Penghapusan aset dan arsip data mengikuti mekanisme pengajuan-review yang berlaku.
8. Notifikasi relevan muncul kepada pengguna dan status baca dapat dikelola.
9. Laporan utama dapat dimuat dan ekspor yang tersedia dapat dihasilkan.
10. Tindakan kritis yang tidak diizinkan ditolak oleh backend walaupun request dibuat langsung.
11. `npm run verify` berhasil pada kode yang akan dirilis.
12. Konfigurasi Docker valid dan health check produksi menunjukkan layanan beserta dependensi utama siap.

## 12. Asumsi, Risiko, dan Keputusan Terbuka

### 12.1 Asumsi

- Rumah sakit memiliki struktur NIP, unit kerja, subunit, dan penanggung jawab yang dapat dipetakan ke akun SIPENA.
- MySQL merupakan sumber data utama dan tersedia pada lingkungan produksi.
- Setiap pengguna memakai akun individual; akun bersama tidak direkomendasikan.
- Klasifikasi medis/non-medis cukup untuk pembatasan inventaris tingkat awal.

### 12.2 Risiko

- Matriks akses menu dapat berbeda dari izin aksi backend sehingga perlu pengujian role secara berkala.
- Kualitas laporan bergantung pada kelengkapan input inventaris dan disiplin penutupan transaksi.
- Penyimpanan unggahan pada filesystem memerlukan strategi volume persisten, backup, dan retensi.
- Ketergantungan pada kanal email/OTP dan Redis dapat memengaruhi pengalaman autentikasi/notifikasi.
- Belum adanya target KPI, SLA, kapasitas, retensi, RPO, dan RTO formal menyulitkan evaluasi layanan produksi.

### 12.3 Keputusan terbuka

- Pemilik produk dan approver final PRD.
- Target KPI serta frekuensi evaluasinya.
- SLA respons aplikasi, RPO/RTO, backup, dan retensi data.
- Browser/perangkat minimum yang didukung.
- Kebijakan retensi audit, dokumen, dan data yang diarsipkan.
- Integrasi SIMRS/SSO dan kanal notifikasi produksi.

## 13. Roadmap Dokumentasi

| Prioritas | Item | Status |
| --- | --- | --- |
| P0 | Validasi PRD ini bersama pemilik proses rumah sakit | Planned |
| P0 | Tetapkan KPI, SLA, RPO/RTO, retensi, dan pemilik produk | Planned |
| P1 | Buat diagram rinci peminjaman-pengembalian-penggunaan | Planned |
| P1 | Dokumentasikan state machine pemeliharaan dan penghapusan | Planned |
| P1 | Turunkan requirement kritis menjadi test case role dan end-to-end | Planned |
| P2 | Buat changelog requirement yang terhubung dengan issue/PR | Planned |

## 14. Tata Kelola Perubahan

- Perubahan fitur yang memengaruhi perilaku pengguna harus memperbarui requirement terkait dalam dokumen ini.
- Requirement baru memperoleh ID unik per modul.
- Pull request mencantumkan ID requirement yang dipenuhi atau diubah.
- Perubahan role, status, approval, atau aturan arsip wajib ditinjau sebagai perubahan product policy, bukan sekadar perubahan UI.
- Versi dokumen diperbarui ketika scope, aturan bisnis, atau acceptance criteria berubah secara material.

## 15. Referensi Implementasi

- `README.md` — ringkasan produk dan struktur monorepo.
- `apps/frontend/src/app` — halaman dan alur UI.
- `apps/frontend/src/utils/role.ts` — fallback akses route dan helper role.
- `apps/backend/src/routes` — kontrak endpoint dan batas role tindakan.
- `apps/backend/src/services/access_control.service.ts` — menu dan matriks akses default.
- `apps/backend/src/services` — aturan bisnis modul.
- `packages/database` — skema, seed, dan migrasi database.
- `docker` — konfigurasi runtime container.
