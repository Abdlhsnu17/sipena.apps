import apiService, { API_BASE_URL } from "./api.service"

export const DEFAULT_BRAND_LOGO = "/images/logo-sipena-transparent.png"
export const BRAND_LOGO_MAX_BYTES = 2 * 1024 * 1024
export const BRANDING_UPDATED_EVENT = "app-branding-updated"

export type BrandLogoSetting = {
  key: "brand_logo"
  value: string
  updatedBy?: number | null
  updatedByName?: string | null
  updatedAt?: string | null
}

type BrandLogoResponse = {
  success: boolean
  message: string
  data?: BrandLogoSetting
}

export const resolveBrandLogoUrl = (value?: string | null, version?: string | null): string => {
  const logoPath = value?.trim() || DEFAULT_BRAND_LOGO
  if (!logoPath.startsWith("/uploads/")) return logoPath
  const staticBaseUrl = API_BASE_URL.replace(/\/api\/?$/, "")
  const suffix = version ? `?v=${encodeURIComponent(version)}` : ""
  return `${staticBaseUrl}${logoPath}${suffix}`
}

/**
 * Teks cadangan bila API pengaturan belum bisa dihubungi (backend lama, jaringan
 * putus, atau migrasi `app_settings` belum dijalankan). Nilainya sama dengan
 * default di backend agar marquee topbar tidak pernah tampil kosong.
 */
export const DEFAULT_TOPBAR_ANNOUNCEMENT =
  "Selamat datang di Sistem Informasi Manajemen Sarana dan Prasarana. Periksa pemberitahuan secara berkala agar informasi penting tidak terlewat. Terima Kasih"

/** Sinkron dengan `TOPBAR_ANNOUNCEMENT_MAX_LENGTH` di backend. */
export const TOPBAR_ANNOUNCEMENT_MAX_LENGTH = 500

/** Event untuk memberi tahu topbar agar memuat ulang teks setelah admin menyimpan. */
export const ANNOUNCEMENT_UPDATED_EVENT = "topbar-announcement-updated"

/** Daftar preset warna; harus sama persis dengan `TOPBAR_ANNOUNCEMENT_STYLES` di backend. */
export const TOPBAR_ANNOUNCEMENT_STYLES = ["default", "teal", "ocean", "sunset", "violet", "emerald"] as const

export type TopbarAnnouncementStyle = (typeof TOPBAR_ANNOUNCEMENT_STYLES)[number]

export const DEFAULT_TOPBAR_ANNOUNCEMENT_STYLE: TopbarAnnouncementStyle = "default"

export const isTopbarAnnouncementStyle = (value: unknown): value is TopbarAnnouncementStyle =>
  typeof value === "string" && (TOPBAR_ANNOUNCEMENT_STYLES as readonly string[]).includes(value)

/**
 * Kelas Tailwind per preset. Ditulis sebagai literal (bukan dirakit dari potongan
 * string) supaya Tailwind bisa mendeteksinya saat memindai sumber.
 *
 * Semua gradien memakai rentang warna 400-500 agar tetap terbaca di latar terang
 * maupun gelap, karena topbar memakai warna latar yang berbeda di kedua mode.
 */
export const TOPBAR_ANNOUNCEMENT_STYLE_CLASSES: Record<TopbarAnnouncementStyle, string> = {
  default: "text-muted-foreground",
  teal: "bg-linear-to-r from-teal-500 via-cyan-500 to-sky-500 bg-clip-text text-transparent",
  ocean: "bg-linear-to-r from-sky-500 via-blue-500 to-indigo-500 bg-clip-text text-transparent",
  sunset: "bg-linear-to-r from-amber-500 via-orange-500 to-rose-500 bg-clip-text text-transparent",
  violet: "bg-linear-to-r from-violet-500 via-fuchsia-500 to-pink-500 bg-clip-text text-transparent",
  emerald: "bg-linear-to-r from-emerald-500 via-green-500 to-lime-500 bg-clip-text text-transparent",
}

/** Label dan contoh warna untuk pemilih preset di halaman Pengaturan. */
export const TOPBAR_ANNOUNCEMENT_STYLE_OPTIONS: {
  value: TopbarAnnouncementStyle
  label: string
  swatch: string
}[] = [
  { value: "default", label: "Standar", swatch: "bg-linear-to-r from-slate-400 to-slate-500" },
  { value: "teal", label: "Toska", swatch: "bg-linear-to-r from-teal-500 via-cyan-500 to-sky-500" },
  { value: "ocean", label: "Samudra", swatch: "bg-linear-to-r from-sky-500 via-blue-500 to-indigo-500" },
  { value: "sunset", label: "Senja", swatch: "bg-linear-to-r from-amber-500 via-orange-500 to-rose-500" },
  { value: "violet", label: "Ungu", swatch: "bg-linear-to-r from-violet-500 via-fuchsia-500 to-pink-500" },
  { value: "emerald", label: "Zamrud", swatch: "bg-linear-to-r from-emerald-500 via-green-500 to-lime-500" },
]

export const getAnnouncementStyleClass = (style?: TopbarAnnouncementStyle | null): string =>
  TOPBAR_ANNOUNCEMENT_STYLE_CLASSES[style ?? DEFAULT_TOPBAR_ANNOUNCEMENT_STYLE] ??
  TOPBAR_ANNOUNCEMENT_STYLE_CLASSES[DEFAULT_TOPBAR_ANNOUNCEMENT_STYLE]

export type TopbarAnnouncement = {
  value: string
  style: TopbarAnnouncementStyle
  updatedBy?: number | null
  updatedByName?: string | null
  updatedAt?: string | null
}

type AnnouncementResponse = {
  success: boolean
  message: string
  data?: TopbarAnnouncement
}

class AppSettingService {
  async getBrandLogo(): Promise<BrandLogoSetting> {
    const response = await apiService.get<BrandLogoResponse>("/auth/branding")
    return response.data ?? { key: "brand_logo", value: DEFAULT_BRAND_LOGO }
  }

  async updateBrandLogo(logo: File): Promise<BrandLogoResponse> {
    const formData = new FormData()
    formData.append("logo", logo)
    return apiService.post<BrandLogoResponse>("/app-settings/branding", formData)
  }

  async resetBrandLogo(): Promise<BrandLogoResponse> {
    return apiService.delete<BrandLogoResponse>("/app-settings/branding")
  }

  async getAnnouncement(): Promise<TopbarAnnouncement> {
    const response = await apiService.get<AnnouncementResponse>("/app-settings/announcement")
    const value = response.data?.value?.trim()
    return {
      ...response.data,
      value: value || DEFAULT_TOPBAR_ANNOUNCEMENT,
      style: isTopbarAnnouncementStyle(response.data?.style)
        ? response.data.style
        : DEFAULT_TOPBAR_ANNOUNCEMENT_STYLE,
    }
  }

  async updateAnnouncement(value: string, style: TopbarAnnouncementStyle): Promise<AnnouncementResponse> {
    return apiService.put<AnnouncementResponse>("/app-settings/announcement", { value, style })
  }
}

export const appSettingService = new AppSettingService()
export default appSettingService
