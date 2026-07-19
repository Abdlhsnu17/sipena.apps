# Frontend SIPENA

Workspace `inventory-frontend` adalah antarmuka web SIPENA berbasis Next.js 16, React 19, TypeScript, Tailwind CSS, Radix UI, dan shadcn/ui. Frontend mengurus navigasi, autentikasi di browser, validasi/interaksi form, visualisasi data, pemindaian QR/barcode, dan komunikasi ke REST API backend.

## Fungsi Utama

- Dashboard operasional dan indikator ambang penggunaan aset.
- Inventaris medis/non-medis, impor data, detail inventaris, QR, dan riwayat.
- Peminjaman, pengembalian, penggunaan aset, sanksi, dan penghapusan aset.
- Pemeliharaan aktif/riwayat, jadwal, Teknisi/PJ, approval, reminder, pekerjaan berulang, lampiran, serta verifikasi pekerjaan.
- SPK Prioritas Aset dengan bobot manual atau AHP, pemeriksaan konsistensi, pemeringkatan TOPSIS, dan riwayat perhitungan.
- Laporan/analitik, ekspor, unggah dokumen, notifikasi real-time, kontrol akses menu, pengaturan, dokumentasi UML, dan arsip aktivitas.

Halaman berada di `src/app`, komponen lintas halaman di `src/components`, akses API di `src/services`, dan tipe/utility frontend di folder `src` terkait.

## Konfigurasi API

Salin `.env.example` menjadi `.env.local`.

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_LOGIN_REQUEST_TIMEOUT_MS=20000
API_PROXY_TIMEOUT_MS=20000
```

`NEXT_PUBLIC_API_URL` boleh dikosongkan. Dalam mode tersebut browser memanggil `/api` pada origin frontend dan route handler Next.js meneruskan request ke `API_PROXY_TARGET` (default `http://localhost:4000`). Pola same-origin ini direkomendasikan untuk deployment frontend dan backend dalam satu stack. Jika `NEXT_PUBLIC_API_URL` diisi, service otomatis menambahkan suffix `/api` bila belum ada.

## Menjalankan

Dari root monorepo:

```bash
npm install
npm run dev
```

Atau langsung melalui workspace:

```bash
npm run dev --workspace=inventory-frontend
```

Perintah yang tersedia:

| Perintah | Fungsi |
| --- | --- |
| `npm run dev` | Development server dengan Webpack |
| `npm run build` | Production build |
| `npm run start` | Menjalankan hasil production build |
| `npm run lint` | Memeriksa ESLint |
| `npm run type-check` | Memeriksa TypeScript tanpa membuat output |
| `npm run test` | Menjalankan unit test Vitest |

## Integrasi dan Keamanan

- Request terautentikasi memakai bearer token dari sesi browser; respons `401` membersihkan sesi lokal.
- Proxy mempertahankan method, query, body, dan header yang diperlukan. Stream notifikasi SSE tidak diberi timeout proxy karena koneksinya berumur panjang.
- Upload laporan dan maintenance memakai `FormData`; jangan menetapkan `Content-Type` multipart secara manual.
- Hak akses tampilan mengikuti menu aktif dari backend. Penyembunyian tombol di frontend bukan pengganti pemeriksaan role pada API.

Sebelum menyerahkan perubahan frontend, jalankan `npm run lint`, `npm run type-check`, dan `npm run build` dari workspace ini atau `npm run verify` dari root.
