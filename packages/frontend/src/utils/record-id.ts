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

export const buildRoomCodeToken = (roomName: string): string => {
  const ignoredTokens = new Set(["RUANG", "RUANGAN", "KAMAR", "LT", "LANTAI"])
  const tokens = roomName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((token) => token && !ignoredTokens.has(token))

  if (tokens.length === 0) return "ROOM"
  if (tokens.length === 1) return tokens[0].slice(0, 5)

  return `${tokens[0].slice(0, 3)}${tokens.slice(1).map((token) => token[0]).join("")}`.slice(0, 8)
}

export const rebaseRoomScopedDetailCode = (
  code: RecordIdValue,
  assetPrefix: string,
  oldRoomName: string,
  newRoomName: string,
): string => {
  const rawCode = String(code ?? "").trim()
  if (!rawCode) return rawCode

  const normalizedPrefix = sanitizeToken(assetPrefix || "ID") || "ID"
  const oldToken = buildRoomCodeToken(oldRoomName)
  const newToken = buildRoomCodeToken(newRoomName)
  if (oldToken === newToken) return rawCode

  const sanitizedCode = sanitizeToken(rawCode)
  const oldBase = `${normalizedPrefix}-${oldToken}-`
  if (!sanitizedCode.startsWith(oldBase)) return rawCode

  return `${normalizedPrefix}-${newToken}-${sanitizedCode.slice(oldBase.length)}`
}
