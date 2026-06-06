# Dokumentasi Modul SPK Prioritas Aset untuk Laporan

> Modul ini ditambahkan berdasarkan usulan revisi dari Ketua Dosen Penguji.
> Metode yang digunakan: **TOPSIS** (perangkingan) dikombinasikan dengan **AHP** (pembobotan kriteria).
> Bagian-bagian di bawah ini dapat langsung disusun ulang ke dalam dokumen Sempro/Laporan.

---

## A. TINJAUAN PUSTAKA (Bab II) — Sub-bab Tambahan

### 2.1.x Sistem Penunjang Keputusan (SPK)

Sistem Penunjang Keputusan (SPK) atau *Decision Support System* (DSS) merupakan sistem
informasi berbasis komputer yang dirancang untuk membantu pengambilan keputusan dengan
memanfaatkan data, model, dan analisis terstruktur. SPK tidak menggantikan peran pengambil
keputusan, melainkan memberikan rekomendasi sebagai bahan pertimbangan. Dalam penelitian ini,
SPK diterapkan untuk menentukan prioritas aset yang perlu mendapat perhatian (misalnya untuk
pemeliharaan atau penggantian) berdasarkan beberapa kriteria penilaian, sehingga pengelola aset
dapat mengambil keputusan secara lebih objektif dan terukur.

### 2.1.x Metode AHP (Analytic Hierarchy Process)

AHP merupakan metode pengambilan keputusan multikriteria yang dikembangkan oleh Thomas L.
Saaty. AHP digunakan untuk menentukan bobot kepentingan dari setiap kriteria melalui matriks
perbandingan berpasangan (*pairwise comparison*). Pada penelitian ini, AHP digunakan untuk
menentukan bobot dari tujuh kriteria penilaian prioritas aset. Konsistensi penilaian diukur
melalui *Consistency Ratio* (CR), dengan ketentuan penilaian dianggap konsisten apabila CR ≤ 0,1.

Rumus konsistensi AHP:

- Consistency Index (CI):

  CI = (λmaks − n) / (n − 1)

- Consistency Ratio (CR):

  CR = CI / RI

  dengan *n* = jumlah kriteria, λmaks = nilai eigen maksimum, dan RI = *Random Index*.

### 2.1.x Metode TOPSIS

TOPSIS (*Technique for Order Preference by Similarity to Ideal Solution*) merupakan metode
perangkingan multikriteria yang didasarkan pada konsep bahwa alternatif terbaik adalah alternatif
yang memiliki jarak terdekat dengan solusi ideal positif dan jarak terjauh dari solusi ideal
negatif. Pada penelitian ini, TOPSIS digunakan untuk menghasilkan urutan (ranking) prioritas aset
berdasarkan skor preferensi.

---

## B. PERANCANGAN (Bab III)

### Tabel — Kriteria Penilaian Prioritas Aset

| No | Kriteria | Jenis | Bobot Default | Keterangan Penilaian |
|----|----------|-------|---------------|----------------------|
| C1 | Kondisi Aset | Cost | 0,22 (22%) | Rusak=5, Buruk=4, Cukup=3, Baik=1 |
| C2 | Usia Aset | Cost | 0,12 (12%) | Lama pemakaian (tahun) sejak tanggal pembelian |
| C3 | Kedekatan Jadwal Pemeliharaan | Cost | 0,16 (16%) | Terlewat=5, <30 hari=4, <90 hari=3, <180 hari=2, >180 hari=1 |
| C4 | Frekuensi Pemakaian | Benefit | 0,14 (14%) | Jumlah catatan penggunaan aset |
| C5 | Riwayat Pemeliharaan | Cost | 0,14 (14%) | Jumlah catatan pemeliharaan aset |
| C6 | Urgensi Fungsi | Benefit | 0,16 (16%) | Tingkat kekritisan fungsi aset (skala 1–5) |
| C7 | Risiko Status | Cost | 0,06 (6%) | Dihapuskan=5, Pemeliharaan=4, Dipinjam=3, Digunakan=2, Tersedia=1 |
| | **Total** | | **1,00 (100%)** | |

> Kriteria *benefit*: semakin besar nilai, semakin tinggi prioritas.
> Kriteria *cost*: nilai dirancang sehingga kondisi yang lebih membutuhkan perhatian
> (mis. rusak, terlambat dipelihara) memperoleh skor lebih tinggi.

### Langkah Perhitungan TOPSIS

**Langkah 1 — Normalisasi Matriks Keputusan (Normalisasi Vektor / Euclidean)**

    r_ij = x_ij / √( Σ (x_ij)² )

dengan x_ij = nilai aset ke-i pada kriteria ke-j.

**Langkah 2 — Pembobotan Matriks Ternormalisasi**

    v_ij = w_j × r_ij

dengan w_j = bobot kriteria ke-j.

**Langkah 3 — Menentukan Solusi Ideal Positif (A⁺) dan Negatif (A⁻)**

- Untuk kriteria *benefit*: A⁺ = max(v_ij), A⁻ = min(v_ij)
- Untuk kriteria *cost*:    A⁺ = min(v_ij), A⁻ = max(v_ij)

**Langkah 4 — Menghitung Jarak terhadap Solusi Ideal**

    D_i⁺ = √( Σ (v_ij − v_j⁺)² )
    D_i⁻ = √( Σ (v_ij − v_j⁻)² )

**Langkah 5 — Menghitung Nilai Preferensi (Preference Score)**

    C_i = D_i⁻ / (D_i⁺ + D_i⁻)

Nilai C_i berada pada rentang 0–1. Semakin mendekati 1, semakin tinggi prioritas aset.

**Langkah 6 — Perangkingan**

Alternatif (aset) diurutkan berdasarkan nilai C_i dari yang terbesar ke terkecil.

### Klasifikasi Rekomendasi (Output)

| Nilai Preferensi (C_i) | Rekomendasi |
|------------------------|-------------|
| C_i ≥ 0,70 | Prioritas Tinggi |
| 0,45 ≤ C_i < 0,70 | Prioritas Sedang |
| C_i < 0,45 | Prioritas Rendah |

### Use Case Tambahan

Tambahkan ke Use Case Diagram: **"Melihat Prioritas Aset (SPK)"** yang dapat diakses oleh
seluruh aktor terautentikasi (Admin, Leader, Staff, Staff PJ, Teknisi, User).

### Activity Diagram

Lihat file `docs/spk-activity-diagram.puml` (dapat di-render menjadi gambar untuk dimasukkan
ke laporan, mis. Gambar 3.16 Activity Diagram SPK Prioritas Aset).

---

## C. PENGUJIAN (Bab III/IV) — Skenario Black-Box Testing Modul SPK

**Tabel 3.x Skenario Black-Box Testing Modul SPK Prioritas Aset**

| No | Skenario Pengujian | Aksi/Input | Hasil yang Diharapkan | Hasil |
|----|--------------------|------------|------------------------|-------|
| 1 | Membuka halaman SPK | Pengguna memilih menu "SPK Prioritas Aset" | Sistem menampilkan daftar aset dengan bobot default dan ranking awal | Valid |
| 2 | Memfilter jenis aset | Memilih filter "Medis" / "Non-Medis" / "Semua" | Sistem menampilkan ranking sesuai jenis aset yang dipilih | Valid |
| 3 | Menyesuaikan bobot kriteria | Mengubah slider bobot lalu klik "Hitung Ulang" | Sistem menormalisasi bobot ke 100% dan memperbarui ranking | Valid |
| 4 | Menghitung ranking | Klik tombol "Hitung Ulang" | Sistem menampilkan tabel ranking aset beserta skor preferensi dan rekomendasi | Valid |
| 5 | Validasi konsistensi AHP | Bobot menghasilkan matriks tidak konsisten (CR > 0,1) | Sistem memberi peringatan dan memakai bobot default/manual | Valid |
| 6 | Mencari aset pada hasil | Memasukkan kata kunci nama/kode/lokasi aset | Sistem menampilkan hasil ranking yang sesuai dengan pencarian | Valid |
| 7 | Navigasi halaman hasil | Berpindah halaman pada tabel ranking | Sistem menampilkan data ranking sesuai halaman (paginasi) | Valid |
| 8 | Data aset kosong | Tidak ada data aset yang memenuhi filter | Sistem menampilkan informasi bahwa tidak ada data untuk dirangking | Valid |

---

## D. CATATAN UNTUK PENYUSUNAN ULANG

1. Tambahkan teori **SPK, AHP, dan TOPSIS** pada Bab II (Landasan Teori).
2. Tambahkan **Tabel Kriteria** dan **langkah perhitungan TOPSIS** pada Bab III (Perancangan).
3. Tambahkan **Activity Diagram SPK** pada daftar gambar (mis. Gambar 3.16).
4. Tambahkan **use case "Melihat Prioritas Aset (SPK)"** pada Use Case Diagram dan tabel hak akses.
5. Tambahkan **Tabel Black-Box Testing Modul SPK** pada Bab pengujian.
6. Perbarui **Daftar Tabel** dan **Daftar Gambar** sesuai penomoran baru.
7. (Opsional) Sebutkan singkat di Batasan Masalah bahwa SPK menggunakan metode TOPSIS-AHP.
