# Production Checklist

Checklist ini dipakai untuk memastikan SIPENA siap dipakai banyak user secara bersamaan tanpa menjatuhkan semua request ke satu bucket rate limit yang sama.

## 1. Backend

- Set `TRUST_PROXY_HOPS` di `packages/backend/.env` sesuai jumlah proxy tepercaya di depan backend.
- Gunakan `GENERAL_RATE_LIMIT_MAX` untuk traffic API umum.
- Gunakan `LOGIN_RATE_LIMIT_MAX` untuk percobaan login.
- Gunakan `UPLOADS_ROOT` yang mengarah ke shared volume atau persistent storage.
- Set `DB_CONNECTION_LIMIT` sesuai kapasitas MySQL production.
- Pastikan `JWT_SECRET` kuat dan tidak memakai nilai development.
- Pastikan webhook OTP WhatsApp dan SMS aktif untuk reset password di production.

Rekomendasi awal:

```env
TRUST_PROXY_HOPS=1
GENERAL_RATE_LIMIT_MAX=1000
LOGIN_RATE_LIMIT_MAX=20
UPLOADS_ROOT=/mnt/sipena/uploads
DB_CONNECTION_LIMIT=30
ALLOW_IN_MEMORY_PASSWORD_RESET_STORE=false
WHATSAPP_OTP_WEBHOOK_URL=https://gateway-internal.example/otp/whatsapp
SMS_OTP_WEBHOOK_URL=https://gateway-internal.example/otp/sms
```

Catatan:

- `TRUST_PROXY_HOPS=1` biasanya cocok untuk `Nginx -> Next.js -> Backend`.
- Jika ada layer tambahan seperti CDN atau load balancer terpisah, sesuaikan nilainya.
- Jangan biarkan `ALLOW_IN_MEMORY_PASSWORD_RESET_STORE=true` di production multi-instance.

## 2. Reverse Proxy

Jika memakai Nginx, teruskan header ini ke frontend atau backend:

```nginx
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
```

Tanpa header ini, rate limit bisa menganggap banyak user berasal dari satu IP yang sama.

## 3. Frontend Proxy

Frontend Next.js di repo ini sudah meneruskan:

- `X-Forwarded-For`
- `X-Real-IP`
- `X-Forwarded-Proto`
- `X-Forwarded-Host`

Bagian ini tidak perlu diubah lagi kecuali Anda menambah gateway baru di depan Next.js.

## 3a. Reset Password

Untuk production:

- aktifkan `WHATSAPP_OTP_WEBHOOK_URL` sebagai channel utama
- aktifkan `SMS_OTP_WEBHOOK_URL` sebagai fallback
- jangan menampilkan kode reset langsung di frontend
- gunakan Redis aktif agar sesi reset password konsisten antar instance

## 4. Sizing Infrastruktur

Untuk penggunaan internal kecil, 2 vCPU / 2 GB RAM masih mungkin cukup.

Untuk target ratusan user aktif, lebih aman mulai dari:

- `2-4 vCPU`
- `4-8 GB RAM`
- storage cukup untuk database, uploads, dan logs

Jika database, frontend, dan backend berada di VPS yang sama, kebutuhan resource akan naik lebih cepat.

## 5. Verifikasi Setelah Deploy

Jalankan:

```bash
npm run build:backend
npm run type-check --workspace=inventory-frontend
```

Jika ingin memastikan kolom keamanan user langsung masuk ke database aktif tanpa menunggu startup backend, jalankan:

```bash
npm run migrate:user-security-columns
```

Alternatif manual SQL tersedia di:

```text
packages/database/migrations/20260517_add_user_security_columns.sql
```

Jika memakai Docker:

```bash
docker compose -f packages/backend/docker-compose.yml up -d --build
docker ps
docker logs <backend-container> --tail=50
```

## 6. Load Test Login

Gunakan skrip bawaan repo ini:

```bash
LOAD_TEST_URL=http://127.0.0.1:3000/api/auth/login \
LOAD_TEST_CONCURRENCY=20 \
LOAD_TEST_TOTAL=100 \
LOAD_TEST_NIP=user-uji \
LOAD_TEST_PASSWORD=password-salah \
npm run load-test:login
```

Interpretasi:

- `401/404` berarti request sampai ke aplikasi dan ditolak normal
- `429` berarti limiter aktif
- `Lainnya` berarti ada error lain yang perlu diselidiki
