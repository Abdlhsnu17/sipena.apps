export type AssetCondition = "good" | "fair" | "poor" | "damaged"
export type AssetStatus = "available" | "borrowed" | "maintenance" | "disposed"

export interface AssetSpecifications<T = any> {
  details?: T[]
  [key: string]: any
}

export const parseSpecifications = <T = any>(value: unknown): AssetSpecifications<T> => {
  if (!value) return {}
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as AssetSpecifications<T>
    } catch {
      return {}
    }
  }
  if (typeof value === "object") {
    return value as AssetSpecifications<T>
  }
  return {}
}

export const getSpecificationDetails = <T = any>(value: unknown): T[] => {
  const specs = parseSpecifications<T>(value)
  return Array.isArray(specs.details) ? specs.details : []
}

export const buildSpecifications = <T = any>(details: T[], extra: Record<string, any> = {}): AssetSpecifications<T> => ({
  ...extra,
  details,
})

export const maintenanceDetailStatusLabels = [
  "Dalam Pemeliharaan",
  "Dalam Perbaikan",
  "Dalam Kalibrasi",
  "Dalam Inspeksi",
] as const

export const isMaintenanceDetailStatus = (status?: string | null) =>
  Boolean(status && maintenanceDetailStatusLabels.includes(status as (typeof maintenanceDetailStatusLabels)[number]))

export const deriveAssetCondition = (details: Array<{ condition?: string }>): AssetCondition => {
  const conditions = details.map((detail) => detail.condition)
  if (conditions.includes("Rusak")) return "damaged"
  if (conditions.includes("Cukup")) return "fair"
  return "good"
}

export const deriveAssetStatus = (details: Array<{ status?: string }>): AssetStatus => {
  const statuses = details.map((detail) => detail.status)
  if (statuses.some((status) => isMaintenanceDetailStatus(status) || status === "maintenance")) return "maintenance"
  if (statuses.includes("Nonaktif") || statuses.includes("Non-Aktif")) return "disposed"
  if (statuses.includes("Dipinjam") || statuses.includes("Sedang Digunakan") || statuses.includes("Dalam Penggunaan")) return "borrowed"
  return "available"
}

export const borrowingStatusLabel = (status: string): string => {
  switch (status) {
    case "pending":
      return "Menunggu Persetujuan"
    case "approved":
      return "Disetujui"
    case "borrowed":
      return "Sedang Dipinjam"
    case "returned":
      return "Dikembalikan"
    case "overdue":
      return "Terlambat"
    case "rejected":
      return "Ditolak"
    default:
      return status
  }
}

export type AssetSourceKey = "medis" | "non_medis" | "Semua"

/**
 * Normalisasi asal aset peminjaman agar konsisten antara tabel dan filter.
 * Menggunakan assetType dari API dan fallback ke prefix kode aset.
 */
export const deriveAssetSource = (assetType?: string, assetCode?: string): AssetSourceKey => {
  const normalized = assetType?.toLowerCase().replace(/-/g, "_")
  if (normalized === "medical" || normalized === "medis") return "medis"
  if (normalized === "non_medical" || normalized === "non_medis" || normalized === "non medis") return "non_medis"

  const codePrefix = assetCode?.toUpperCase()
  if (codePrefix?.startsWith("NMD") || codePrefix?.startsWith("INM")) return "non_medis"
  if (codePrefix?.startsWith("MED") || codePrefix?.startsWith("IMD")) return "medis"

  return "Semua"
}

export const assetSourceLabel = (source: AssetSourceKey): string => {
  switch (source) {
    case "medis":
      return "Medis"
    case "non_medis":
      return "Non-Medis"
    default:
      return "-"
  }
}

/**
 * Kelas warna badge kategori aset agar konsisten di seluruh halaman
 * (peminjaman, pengembalian, pemeliharaan, dsb).
 */
export const assetSourceBadgeClass = (source: AssetSourceKey): string => {
  switch (source) {
    case "medis":
      return "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-50"
    case "non_medis":
      return "border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-50"
    default:
      return "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-50"
  }
}

/**
 * Kelas warna badge lokasi/ruangan agar konsisten dan terbedakan dari badge kategori.
 */
export const locationBadgeClass =
  "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50"

export const maintenanceStatusLabel = (status: string): string => {
  switch (status) {
    case "requested":
      return "Diajukan"
    case "scheduled":
      return "Disetujui"
    case "in_progress":
      return "Sedang Pengecekan Lanjutan"
    case "completed":
      return "Dalam Proses Pengerjaan"
    case "validated":
      return "Selesai Pemeliharaan Sarana"
    case "cancelled":
      return "Ditolak / Dibatalkan"
    default:
      return status
  }
}

export const maintenanceTypeLabel = (type: string): string => {
  switch (type) {
    case "preventive":
      return "Rutin"
    case "corrective":
      return "Perbaikan"
    case "calibration":
      return "Kalibrasi"
    case "inspection":
      return "Inspeksi"
    default:
      return type
  }
}

/** Kelas warna badge tipe layanan pemeliharaan agar konsisten dengan badge kategori/lokasi. */
export const maintenanceTypeBadgeClass = (type: string): string => {
  switch (type) {
    case "preventive":
      return "border-green-200 bg-green-50 text-green-700 hover:bg-green-50"
    case "corrective":
      return "border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-50"
    case "calibration":
      return "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-50"
    case "inspection":
      return "border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-50"
    default:
      return "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-50"
  }
}
