import { toDateTimeLocalInputValue } from "./date-input";
import { parseServerDateTimeValue } from "./format";

/**
 * Status peminjaman yang masih "mengunci" inventaris.
 *
 * Termasuk peminjaman berstatus `returned` yang pengembaliannya belum
 * divalidasi, karena barang secara administratif belum benar-benar kembali.
 */
export const isBorrowingLockRecord = (record: {
  status: string
  returnValidatedAt?: string | null
}) =>
  ["pending", "approved", "borrowed", "overdue"].includes(record.status) ||
  (record.status === "returned" && !record.returnValidatedAt)

/** Peminjaman yang terhitung terlambat dan karenanya memblokir aksi lanjutan. */
export const isOverdueBorrowingBlock = (record: {
  status: string
  returnValidatedAt?: string | null
  dueDate?: string | Date | null
  overdueDays?: number | null
}) => {
  if (record.status === "overdue") return true
  if (record.status !== "returned" || record.returnValidatedAt) return false
  if ((record.overdueDays || 0) > 0) return true

  const dueDate = parseServerDateTimeValue(record.dueDate)
  return Boolean(dueDate && Date.now() > dueDate.getTime())
}

/**
 * Usulan tanggal perpanjangan: satu hari setelah jatuh tempo saat ini, atau
 * setelah waktu kini bila jatuh temponya sudah lewat.
 */
export const getRecommendedExtensionDateValue = (record?: {
  dueDate?: string | Date | null
} | null) => {
  const now = new Date()
  const currentDueDate = parseServerDateTimeValue(record?.dueDate)
  const base = currentDueDate && currentDueDate > now ? currentDueDate : now
  const recommended = new Date(base)

  recommended.setDate(recommended.getDate() + 1)
  recommended.setSeconds(0, 0)

  return toDateTimeLocalInputValue(recommended)
}

export const borrowingPurposeTypeLabels = {
  inside_hospital: "Penggunaan di dalam Rumah Sakit",
  outside_hospital: "Penggunaan di luar Rumah Sakit",
} as const

export const borrowingDurationUnitLabels = {
  day: "Hari",
  month: "Bulan",
  year: "Tahun",
} as const

export const formatBorrowingPurposeType = (
  value?: keyof typeof borrowingPurposeTypeLabels | null,
) => (value ? borrowingPurposeTypeLabels[value] ?? "-" : "-")

export const formatBorrowingDuration = (
  value?: number | null,
  unit?: keyof typeof borrowingDurationUnitLabels | null,
) => {
  if (!value || !unit) return "-"
  const label = borrowingDurationUnitLabels[unit]
  return label ? `${value} ${label}` : String(value)
}

/** Rentang waktu dalam bahasa Indonesia, mis. "2 hari 3 jam". */
export const formatDurationDiff = (diffMs: number): string => {
  if (!Number.isFinite(diffMs) || diffMs <= 0) return "0 menit"

  const totalSeconds = Math.floor(diffMs / 1000)
  const days = Math.floor(totalSeconds / (24 * 60 * 60))
  const hours = Math.floor((totalSeconds % (24 * 60 * 60)) / (60 * 60))
  const minutes = Math.floor((totalSeconds % (60 * 60)) / 60)
  const seconds = totalSeconds % 60

  const parts: string[] = []
  if (days > 0) parts.push(`${days} hari`)
  if (hours > 0) parts.push(`${hours} jam`)
  if (minutes > 0) parts.push(`${minutes} menit`)
  if (seconds > 0 && days === 0) parts.push(`${seconds} detik`)

  return parts.length > 0 ? parts.join(" ") : "0 menit"
}
