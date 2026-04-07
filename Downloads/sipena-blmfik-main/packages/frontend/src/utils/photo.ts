import { API_BASE_URL } from "@/services/api.service"

const API_STATIC_URL = API_BASE_URL.replace(/\/api\/?$/, "")

export const toPublicPhotoUrl = (photoPath?: string | null, version?: string | number): string | null => {
  if (!photoPath) return null

  const cleaned = photoPath
    .replace(/^\/+/, "")
    .replace(/^public\/+/i, "")
    .replace(/^uploads\/+/i, "")

  const v = version ? `?v=${encodeURIComponent(String(version))}` : ""
  return `${API_STATIC_URL}/uploads/${cleaned}${v}`
}
