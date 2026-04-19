export type RecordIdValue = string | number | null | undefined

const sanitizeToken = (value: string): string =>
  value
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "-")
    .replace(/[^A-Z0-9-_]/g, "")

export const formatNoId = (
  prefix: string,
  id: RecordIdValue,
  fallbackCode?: string,
  padding = 5
): string => {
  const normalizedPrefix = sanitizeToken(prefix || "ID") || "ID"
  const explicitCode = fallbackCode?.trim()
  if (explicitCode) return sanitizeToken(explicitCode)

  if (typeof id === "number" && Number.isFinite(id)) {
    return `${normalizedPrefix}-${Math.max(0, Math.trunc(id)).toString().padStart(padding, "0")}`
  }

  const raw = String(id ?? "").trim()
  if (!raw) return `${normalizedPrefix}-${"0".repeat(padding)}`

  if (/^\d+$/.test(raw)) {
    return `${normalizedPrefix}-${raw.padStart(padding, "0")}`
  }

  return `${normalizedPrefix}-${sanitizeToken(raw)}`
}
