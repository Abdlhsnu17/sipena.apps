type FeaturePresentation = {
  label: string
  backgroundColor: string
  textColor: string
  borderColor: string
}

const FEATURE_PRESENTATIONS: Record<string, FeaturePresentation> = {
  dashboard: {
    label: "Dashboard",
    backgroundColor: "#ccfbf1",
    textColor: "#0f766e",
    borderColor: "#5eead4",
  },
  dokumentasi_unggahan: {
    label: "Dokumentasi Sistem",
    backgroundColor: "#e2e8f0",
    textColor: "#475569",
    borderColor: "#cbd5e1",
  },
  inventaris_medis: {
    label: "Inventaris Medis",
    backgroundColor: "#cffafe",
    textColor: "#0e7490",
    borderColor: "#67e8f9",
  },
  inventaris_non_medis: {
    label: "Inventaris Non-Medis",
    backgroundColor: "#ccfbf1",
    textColor: "#0f766e",
    borderColor: "#5eead4",
  },
  pemeliharaan: {
    label: "Pemeliharaan Sarana",
    backgroundColor: "#fee2e2",
    textColor: "#dc2626",
    borderColor: "#fca5a5",
  },
  laporan: {
    label: "Laporan & Analitik",
    backgroundColor: "#f3e8ff",
    textColor: "#9333ea",
    borderColor: "#d8b4fe",
  },
  unggahan: {
    label: "Unggah Dokumen",
    backgroundColor: "#e0f2fe",
    textColor: "#0369a1",
    borderColor: "#7dd3fc",
  },
  manajemen_pengguna: {
    label: "Manajemen Pengguna",
    backgroundColor: "#fef3c7",
    textColor: "#d97706",
    borderColor: "#fcd34d",
  },
  peminjaman_alat: {
    label: "Peminjaman",
    backgroundColor: "#fef3c7",
    textColor: "#d97706",
    borderColor: "#fcd34d",
  },
  pengaturan: {
    label: "Pengaturan",
    backgroundColor: "#ffedd5",
    textColor: "#c2410c",
    borderColor: "#fdba74",
  },
  pengembalian_alat: {
    label: "Pengembalian",
    backgroundColor: "#dcfce7",
    textColor: "#16a34a",
    borderColor: "#86efac",
  },
  pencarian: {
    label: "Pencarian",
    backgroundColor: "#ede9fe",
    textColor: "#6d28d9",
    borderColor: "#c4b5fd",
  },
}

const FEATURE_ALIASES: Record<string, string> = {
  dashboard: "dashboard",
  dokumentasi: "dokumentasi_unggahan",
  "dokumentasi sistem": "dokumentasi_unggahan",
  "dokumentasi uml": "dokumentasi_unggahan",
  uml: "dokumentasi_unggahan",
  unggahan: "unggahan",
  "unggah dokumen": "unggahan",
  "dokumen pendukung": "unggahan",
  "inventaris medis": "inventaris_medis",
  medis: "inventaris_medis",
  "inventaris non medis": "inventaris_non_medis",
  "inventaris non-medis": "inventaris_non_medis",
  "non medis": "inventaris_non_medis",
  "non-medis": "inventaris_non_medis",
  jadwal_pemeliharaan: "pemeliharaan",
  pemeliharaan: "pemeliharaan",
  "pemeliharaan sarana": "pemeliharaan",
  "pemelirahaan sarana": "pemeliharaan",
  laporan: "laporan",
  "manajemen pengguna": "manajemen_pengguna",
  pengguna: "manajemen_pengguna",
  peminjaman_alat: "peminjaman_alat",
  "peminjaman alat": "peminjaman_alat",
  pencarian: "pencarian",
  pengaturan: "pengaturan",
  pengembalian_alat: "pengembalian_alat",
  "pengembalian alat": "pengembalian_alat",
}

const FALLBACK_FEATURE_PRESENTATION: FeaturePresentation = {
  label: "Fitur",
  backgroundColor: "#e5e7eb",
  textColor: "#374151",
  borderColor: "#d1d5db",
}

const normalizeFeatureLookupKey = (value?: string | null) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s*&\s*/g, " & ")
    .replace(/\s+/g, " ")

const titleCase = (value: string) =>
  value.replace(/\b\w/g, (char) => char.toUpperCase())

export const isFeatureColumn = (column: string) => {
  const normalized = normalizeFeatureLookupKey(column)
  return normalized === "fitur" || normalized === "feature"
}

export const getFeaturePresentation = (value?: string | null): FeaturePresentation => {
  const normalized = normalizeFeatureLookupKey(value)
  const alias = FEATURE_ALIASES[normalized]
  if (alias && FEATURE_PRESENTATIONS[alias]) {
    return FEATURE_PRESENTATIONS[alias]
  }

  if (!normalized) {
    return {
      ...FALLBACK_FEATURE_PRESENTATION,
      label: "-",
    }
  }

  return {
    ...FALLBACK_FEATURE_PRESENTATION,
    label: titleCase(normalized),
  }
}

export const getFeatureLabel = (value?: string | null) => getFeaturePresentation(value).label
