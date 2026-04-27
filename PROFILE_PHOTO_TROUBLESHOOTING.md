# Panduan Troubleshooting: Upload Foto Profil

Dokumen ini membantu menyelesaikan masalah upload foto profil yang menampilkan background putih atau foto tidak terupload.

## Daftar Periksa Cepat

1. **Ukuran file** - Pastikan foto kurang dari 5MB
2. **Format file** - Gunakan JPG, PNG, atau WEBP
3. **Browser** - Refresh browser (Ctrl+F5 atau Cmd+Shift+R)
4. **Browser DevTools** - Buka Console untuk melihat error

## Langkah-Langkah Testing

### 1. Persiapan
- Siapkan file foto JPG/PNG berukuran kurang dari 5MB
- Buka aplikasi di browser
- Buka DevTools (tekan F12)
- Pilih tab "Console"

### 2. Upload Foto
- Masuk ke halaman **Pengaturan**
- Scroll ke section **Profil Akun**
- Klik tombol **"Unggah Foto"**
- Pilih file foto
- Perhatikan Console untuk log: `[Photo] Selected file: ...`

### 3. Simpan Profil
- Klik tombol **"Simpan Profil"**
- Monitor Console untuk pesan berikut (dalam urutan):

```
[Profile] Submitting profile update with photo file: filename.jpg
[Upload] Profile photo uploaded: timestamp-filename.jpg, size: XXXX bytes, mime: image/jpeg
[Service] Profile updated for user X
[Service] Updated user photo_path: profiles/timestamp-filename.jpg
```

### 4. Verifikasi Hasil
- Foto seharusnya muncul di Avatar
- Jika muncul fallback (huruf pertama nama), periksa Console untuk error
- Refresh halaman untuk cache-bust

## Troubleshooting: Foto Tidak Muncul (Background Putih)

### Kemungkinan 1: File Tidak Terupload
**Tanda:**
- Console tidak menunjukkan `[Upload] Profile photo uploaded`
- Response error muncul

**Solusi:**
- Periksa ukuran file (max 5MB)
- Periksa format file (JPG/PNG/WEBP saja)
- Cek izin upload folder: `packages/backend/uploads/profiles`

### Kemungkinan 2: Path Tidak Disimpan di Database
**Tanda:**
- Upload berhasil tapi `[Service] Updated user photo_path:` tidak ada atau undefined

**Solusi:**
```bash
# Di backend server, cek database
# SELECT id, name, photo_path FROM users WHERE id=YOUR_USER_ID;
# Photo_path harus berisi: profiles/timestamp-filename.jpg
```

### Kemungkinan 3: Image URL Salah
**Tanda:**
- Console menunjukkan: `[Photo] Image failed to load`
- Network tab menunjukkan 404 untuk image request

**Solusi:**
- Cek URL di Browser DevTools > Network tab > Img
- URL harus bentuk: `http://localhost:3001/uploads/profiles/...`
- Pastikan backend sudah start dengan `npm run dev`

### Kemungkinan 4: CORS atau Network Issue
**Tanda:**
- Network tab menunjukkan error/blocked
- Console ada CORS warning

**Solusi:**
- Pastikan frontend dan backend domain sama
- Cek backend cors configuration di `src/index.ts`
- Restart backend server

## Debug Commands

### Frontend Debug (Browser Console)
```javascript
// Lihat user yang ter-login
getCurrentUser()

// Test URL generation
toPublicPhotoUrl('profiles/test.jpg', Date.now())
```

### Backend Debug
```bash
# Lihat log upload saat process berjalan
npm run dev | grep -i upload

# Cek file yang tersimpan
ls -la packages/backend/uploads/profiles/

# Cek permission folder
ls -ld packages/backend/uploads/profiles/
```

## Perbaikan Sudah Diterapkan

1. ✅ AvatarImage sekarang memiliki error handling
2. ✅ Fallback Avatar punya background gradient (tidak putih)
3. ✅ Logging ditambahkan untuk debug
4. ✅ Multer error handling diperbaiki
5. ✅ Database operations di-log

## Cara Reset/Testing Ulang

Jika ingin test dari awal:

1. Bersihkan foto lama:
```bash
rm -f packages/backend/uploads/profiles/*
```

2. Reset database photo_path:
```sql
UPDATE users SET photo_path = NULL WHERE id = YOUR_USER_ID;
```

3. Reload page dan coba upload lagi

## Support

Jika masih ada masalah:
1. Buka DevTools Console (F12)
2. Jalankan langkah upload
3. Copy semua pesan console
4. Include info: browser version, OS, file size
