import { parseServerDateTimeValue, toLocalDateTimeString } from "./format";

/**
 * Mengubah nilai tanggal dari server menjadi isian `<input type="datetime-local">`.
 *
 * Parsing didelegasikan ke `parseServerDateTimeValue` agar format datetime
 * milik backend ditangani konsisten dengan bagian lain aplikasi.
 */
export const toDateTimeLocalInputValue = (value?: string | Date | null) => {
  const date = parseServerDateTimeValue(value)
  if (!date) return ""
  const offsetMs = date.getTimezoneOffset() * 60000
  const localDate = new Date(date.getTime() - offsetMs)
  return localDate.toISOString().slice(0, 16)
}

export const getCurrentLocalDateTimeValue = () => toDateTimeLocalInputValue(new Date())

/**
 * Memformat objek `Date` menjadi isian `datetime-local` memakai getter waktu lokal.
 *
 * Berbeda dari `toDateTimeLocalInputValue`, fungsi ini tidak mem-parsing nilai
 * dari server: argumennya sudah harus berupa `Date` dan default-nya waktu kini.
 */
export const formatLocalDateTimeInputValue = (date = new Date()) => {
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * Varian toleran yang mengembalikan string apa adanya bila nilai tidak dapat
 * diformat, dipakai pada form yang boleh menampilkan nilai mentah.
 */
export const toLocalInputValue = (value?: string | Date | null): string => {
  if (!value) return ""
  const result = toLocalDateTimeString(value)
  if (result) return result
  if (value instanceof Date) {
    const offsetMs = value.getTimezoneOffset() * 60000
    const localDate = new Date(value.getTime() - offsetMs)
    return localDate.toISOString().slice(0, 16)
  }
  return String(value)
}

/**
 * Mengubah isian `datetime-local` menjadi string ISO UTC untuk payload API.
 *
 * Backend peminjaman memvalidasi `borrowDate`/`dueDate` sebagai ISO 8601
 * lengkap dengan zona waktu, jadi nilai lokal dari form harus dinormalisasi
 * sebelum dikirim.
 */
export const toIsoDateTimeString = (value?: string | Date | null): string => {
  if (!value) return ""

  const parsed = value instanceof Date ? value : parseLocalDateTimeInput(value)
  if (!parsed || Number.isNaN(parsed.getTime())) return ""

  return parsed.toISOString()
}

/**
 * Mem-parsing isian `datetime-local` sebagai waktu lokal.
 *
 * `new Date("2026-01-02T03:04")` dapat ditafsirkan berbeda antar-runtime,
 * sehingga komponen tanggal dipecah manual lebih dulu; format lain jatuh ke
 * `new Date`.
 */
export const parseLocalDateTimeInput = (value?: string | null): Date | null => {
  if (!value) return null
  const raw = String(value).trim()
  if (!raw) return null

  const matched = raw.match(/^((\d{4})-(\d{2})-(\d{2}))[T ](\d{2}):(\d{2})(?::(\d{2}))?$/)
  if (!matched) {
    const fallback = new Date(raw)
    return Number.isNaN(fallback.getTime()) ? null : fallback
  }

  const [, , year, month, day, hour, minute, second = "0"] = matched
  const parsed = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  )
  return Number.isNaN(parsed.getTime()) ? null : parsed
}
