# Deskripsi Activity Diagram (12 Modul)

Format: **Fungsi – Alur – Tujuan**. Dapat langsung disalin ke laporan di bawah masing-masing gambar.

---

## 1. Activity Diagram Login

**Fungsi:** mengatur proses masuk pengguna ke dalam sistem berdasarkan hak akses.

**Alur:** pengguna membuka halaman login dan memasukkan email serta password. Sistem memvalidasi format input, lalu mencocokkan kredensial dengan basis data. Apabila kredensial benar, sistem membuat token sesi (JWT) dan mengarahkan pengguna ke dashboard sesuai perannya. Apabila salah, sistem menampilkan pesan kesalahan.

**Tujuan:** memastikan hanya pengguna terdaftar yang dapat mengakses sistem sesuai hak aksesnya.

---

## 2. Activity Diagram Registrasi Akun

**Fungsi:** mengelola pendaftaran akun pengguna baru ke dalam sistem.

**Alur:** pengguna mengisi data diri (nama, email, NIP, unit kerja, password). Sistem memvalidasi kelengkapan data dan memeriksa apakah email/NIP sudah terdaftar. Jika valid dan belum terdaftar, sistem mengenkripsi password serta menyimpan data akun, kemudian menampilkan notifikasi berhasil dan mengarahkan pengguna ke halaman login.

**Tujuan:** menyediakan mekanisme pembuatan akun yang aman dan terverifikasi.

---

## 3. Activity Diagram Lupa Password

**Fungsi:** membantu pengguna memulihkan akses akun melalui verifikasi OTP.

**Alur:** pengguna memasukkan email/nomor terdaftar. Sistem memeriksa keberadaan akun, lalu mengirim kode OTP melalui WhatsApp/email. Pengguna memasukkan OTP, dan jika benar serta belum kedaluwarsa, pengguna dapat memasukkan password baru. Sistem mengenkripsi dan menyimpan password baru, kemudian mengarahkan ke halaman login.

**Tujuan:** memberikan jalur pemulihan akun yang aman tanpa melibatkan administrator.

---

## 4. Activity Diagram Tambah Inventaris

**Fungsi:** mengelola penambahan data aset medis maupun non-medis ke dalam inventaris.

**Alur:** petugas pengelola aset membuka menu inventaris dan mengisi data aset (nama, kategori, kondisi, lokasi, spesifikasi). Sistem memvalidasi kelengkapan data, membuat kode aset, menetapkan status awal "Tersedia", lalu menyimpan data ke basis data dan memperbarui daftar inventaris.

**Tujuan:** memastikan setiap aset tercatat secara terstruktur dengan status yang jelas.

---

## 5. Activity Diagram Peminjaman Aset

**Fungsi:** mengelola proses pengajuan dan persetujuan peminjaman aset antarunit.

**Alur:** pemohon memilih aset dan mengisi data peminjaman (tujuan, durasi, unit). Sistem memeriksa status aset; jika tidak "Tersedia", pengajuan ditolak. Jika tersedia, pengajuan disimpan dengan status menunggu persetujuan. Penyetuju (admin/leader) meninjau pengajuan. Jika disetujui, status aset berubah menjadi "Dipinjam"; jika ditolak, sistem menyimpan alasan penolakan dan memberi notifikasi kepada pemohon.

**Tujuan:** memastikan peminjaman hanya dapat dilakukan pada aset yang benar-benar tersedia serta tercatat melalui persetujuan.

---

## 6. Activity Diagram Pengembalian Aset

**Fungsi:** mengelola proses pengembalian aset yang telah dipinjam beserta validasinya.

**Alur:** peminjam memilih data peminjaman aktif dan mengisi kondisi aset saat dikembalikan. Sistem memeriksa tanggal pengembalian; apabila melewati batas waktu, sistem mencatat keterlambatan dan menerapkan sanksi. Petugas memvalidasi kondisi fisik aset, kemudian sistem menyimpan data pengembalian, mengubah status aset menjadi "Tersedia", dan memperbarui riwayat peminjaman.

**Tujuan:** memastikan aset kembali tercatat dengan kondisi jelas serta menegakkan disiplin waktu pengembalian.

---

## 7. Activity Diagram Pemeliharaan Aset

**Fungsi:** mengelola proses pemeliharaan (maintenance) aset, baik preventif maupun korektif.

**Alur:** petugas mengajukan pemeliharaan dan menetapkan jadwalnya, kemudian sistem mengubah status aset menjadi "Dalam Pemeliharaan". Teknisi mengerjakan pemeliharaan dan memperbarui progres di lapangan, lalu menandai pekerjaan selesai dikerjakan (completed). Setelah itu, administrator memvalidasi hasil pemeliharaan sehingga status menjadi selesai (validated) dan aset kembali berstatus "Tersedia".

**Tujuan:** menjaga aset agar tetap layak pakai dan mendukung kontinuitas pelayanan.

---

## 8. Activity Diagram Laporan dan Arsip

**Fungsi:** menyajikan laporan data aset dan mengelola arsip dokumen.

**Alur:** pengguna memilih jenis laporan (aset, peminjaman, pemeliharaan) dan menentukan rentang tanggal/filter. Sistem mengambil data sesuai filter, lalu menampilkan ringkasan dan grafik. Pengguna dapat mengekspor laporan ke format PDF/Excel atau mengunggah dokumen ke arsip sistem.

**Tujuan:** mendukung pemantauan dan pendokumentasian pengelolaan aset secara terstruktur.

---

## 9. Activity Diagram Penggunaan Aset (Mutasi Sementara Antarunit)

**Fungsi:** mencatat penggunaan aset oleh unit lain secara sementara tanpa mengubah kepemilikan.

**Alur:** petugas unit memilih aset dan mengisi data penggunaan (unit pengguna, ruangan, operator, waktu mulai, tujuan). Sistem memeriksa status aset; jika tidak tersedia, penggunaan ditolak. Jika tersedia, sistem mencatat mutasi sementara dari unit asal ke unit tujuan dan mengubah status menjadi "Digunakan". Setelah selesai, petugas mengisi waktu selesai dan kondisi aset, lalu sistem mengembalikan status aset menjadi "Tersedia" dan menyimpan riwayat penggunaan.

**Tujuan:** memperjelas status dan lokasi aset ketika digunakan antarunit serta menjaga keterlacakan perpindahan sementara.

---

## 10. Activity Diagram Manajemen Pengguna

**Fungsi:** mengelola data akun pengguna beserta hak aksesnya oleh administrator.

**Alur:** administrator memilih aksi tambah, ubah, atau hapus pengguna. Untuk tambah/ubah, administrator mengisi data (nama, email, peran, hak akses, unit) dan sistem memvalidasi serta menyimpannya. Untuk hapus, administrator mengonfirmasi penghapusan dan sistem menonaktifkan/menghapus akun. Setiap perubahan dicatat ke log aktivitas.

**Tujuan:** memastikan pengelolaan akun dan hak akses berjalan terkendali dan terdokumentasi.

---

## 11. Activity Diagram Arsip Riwayat Aktivitas

**Fungsi:** menampilkan rekam jejak aktivitas pengguna di dalam sistem.

**Alur:** pengguna membuka menu arsip riwayat aktivitas dan menentukan filter (tanggal, jenis aktivitas). Sistem mengambil data log sesuai hak akses, lalu menampilkan daftar aktivitas (waktu, aktor, aksi, modul). Pengguna dapat menelusuri atau melihat detail aktivitas.

**Tujuan:** mendukung transparansi dan kebutuhan audit terhadap aktivitas sistem.

---

## 12. Activity Diagram SPK Prioritas Aset (TOPSIS-AHP)

**Fungsi:** memberikan rekomendasi prioritas aset berdasarkan beberapa kriteria penilaian.

**Alur:** pengguna membuka menu SPK dan memilih jenis aset. Sistem menampilkan data aset dengan bobot default; pengguna dapat menyesuaikan bobot kriteria. Setelah menekan "Hitung Ulang", sistem melakukan normalisasi nilai, menentukan solusi ideal, menghitung jarak dan nilai preferensi dengan metode TOPSIS, serta memvalidasi konsistensi bobot melalui AHP. Hasil akhir berupa tabel ranking prioritas aset beserta rekomendasinya.

**Tujuan:** membantu pengelola mengambil keputusan prioritas pemeliharaan/penggantian aset secara objektif dan terukur.
