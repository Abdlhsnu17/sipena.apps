import { API_BASE_URL } from "@/services/api.service"

export const API_STATIC_URL = API_BASE_URL.replace(/\/api\/?$/, "")

export function toPublicPhotoUrl(photoPath?: string | null, version?: string | number | null) {
  if (!photoPath) return null

  // hilangkan prefix yang sering dobel
  const cleaned = photoPath
    .replace(/^\/+/, "")
    .replace(/^public\/+/, "")
    .replace(/^uploads\/+/, "")

  const v = version ? `?v=${encodeURIComponent(String(version))}` : ""
  return `${API_STATIC_URL}/uploads/${cleaned}${v}`
}
