/**
 * Pengaturan global aplikasi yang berlaku untuk seluruh pengguna, disimpan
 * sebagai key-value di tabel `app_settings`.
 *
 * Berbeda dengan `notifications` yang selalu terikat ke satu `user_id`,
 * pengaturan di sini hanya punya satu baris per key sehingga cocok untuk hal
 * seperti teks pemberitahuan berjalan di topbar.
 */
export type AppSettingKey = 'topbar_announcement' | 'topbar_announcement_style' | 'brand_logo';

export const APP_SETTING_KEYS: readonly AppSettingKey[] = [
  'topbar_announcement',
  'topbar_announcement_style',
  'brand_logo',
] as const;

/**
 * Pilihan warna teks pemberitahuan. Sengaja berupa daftar preset, bukan CSS
 * bebas, supaya nilai dari admin tidak pernah dipakai langsung sebagai style di
 * frontend dan tampilannya tetap terbaca di mode terang maupun gelap.
 */
export const TOPBAR_ANNOUNCEMENT_STYLES = [
  'default',
  'teal',
  'ocean',
  'sunset',
  'violet',
  'emerald',
] as const;

export type TopbarAnnouncementStyle = (typeof TOPBAR_ANNOUNCEMENT_STYLES)[number];

export const DEFAULT_TOPBAR_ANNOUNCEMENT_STYLE: TopbarAnnouncementStyle = 'default';

export const isTopbarAnnouncementStyle = (value: unknown): value is TopbarAnnouncementStyle =>
  typeof value === 'string' && (TOPBAR_ANNOUNCEMENT_STYLES as readonly string[]).includes(value);

/**
 * Teks yang dipakai bila baris pengaturan belum ada di database, misalnya pada
 * instalasi baru yang dibuat dari `schema.sql` (struktur saja, tanpa seed).
 * Nilainya sengaja sama dengan teks yang dulu di-hardcode di topbar frontend.
 */
export const DEFAULT_TOPBAR_ANNOUNCEMENT =
  'Selamat datang di Sistem Informasi Manajemen Sarana dan Prasarana. Periksa pemberitahuan secara berkala agar informasi penting tidak terlewat. Terima Kasih';

export const APP_SETTING_DEFAULTS: Record<AppSettingKey, string> = {
  topbar_announcement: DEFAULT_TOPBAR_ANNOUNCEMENT,
  topbar_announcement_style: DEFAULT_TOPBAR_ANNOUNCEMENT_STYLE,
  brand_logo: '/images/logo-sipena-transparent.png',
};

export const DEFAULT_BRAND_LOGO = APP_SETTING_DEFAULTS.brand_logo;

/** Batas panjang teks pemberitahuan; kolom `setting_value` bertipe TEXT. */
export const TOPBAR_ANNOUNCEMENT_MAX_LENGTH = 500;

export interface AppSetting {
  key: AppSettingKey;
  value: string;
  updatedBy?: number | null;
  updatedByName?: string | null;
  updatedAt?: Date | string | null;
}

export interface UpdateAppSettingDTO {
  key: AppSettingKey;
  value: string;
  updatedBy: number;
}

/** Bentuk gabungan teks + warna yang dikonsumsi topbar dalam sekali panggil. */
export interface TopbarAnnouncement {
  value: string;
  style: TopbarAnnouncementStyle;
  updatedBy?: number | null;
  updatedByName?: string | null;
  updatedAt?: Date | string | null;
}

export interface UpdateTopbarAnnouncementDTO {
  value: string;
  style: TopbarAnnouncementStyle;
  updatedBy: number;
}
