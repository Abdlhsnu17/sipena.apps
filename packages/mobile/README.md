# SIPENA Mobile (Flutter)

Klien mobile untuk backend SIPENA yang sudah ada di `packages/backend`. Paket
ini hanya berisi kode Dart (`lib/`, `pubspec.yaml`); folder platform native
(`android/`, `ios/`) belum digenerate karena Flutter SDK tidak tersedia di
environment ini.

## Setup pertama kali

```bash
cd packages/mobile
flutter create . --org com.sipena --project-name sipena_mobile --platforms=android,ios
flutter pub get
```

`flutter create .` akan mengisi folder `android/` dan `ios/` di direktori ini
tanpa menimpa `lib/` dan `pubspec.yaml` yang sudah ada.

## Menjalankan

```bash
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:5000/api
```

- `10.0.2.2` adalah alias localhost dari Android emulator ke host. Untuk iOS
  simulator gunakan `http://127.0.0.1:5000/api`, dan untuk perangkat fisik
  gunakan IP LAN komputer yang menjalankan backend.
- Default `API_BASE_URL` ada di `lib/core/constants.dart`.

## Struktur

```
lib/
├── core/        # API client, session/token storage, konstanta
├── models/      # Model data (User, record generik untuk modul lain)
├── services/    # AuthService + CrudService generik per endpoint
├── providers/   # AuthProvider (state login, bootstrap sesi)
├── screens/     # Login, dashboard, dan layar daftar per modul
└── app_theme.dart
```

## Status implementasi

- Login, sesi (token JWT tersimpan di SharedPreferences), logout: selesai.
- Dashboard ringkas (`/api/reports`): selesai.
- Daftar data untuk Aset, Peminjaman, Penggunaan Aset, Pemeliharaan, Jadwal
  Pemeliharaan, Pengguna, Aktivitas: selesai (read-only list).
- Form tambah/ubah per modul, SPK Prioritas Aset, dan Laporan/export: belum
  diimplementasikan — saat ini placeholder atau read-only. Tambahkan layar
  form baru di `lib/screens/<modul>/` sesuai kebutuhan, memakai `CrudService`
  yang sudah ada di `lib/services/crud_service.dart`.
