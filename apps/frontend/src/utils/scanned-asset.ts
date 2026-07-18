import { matchesSearchKeyword } from "@/utils/search-keyword"

export type ScanSourceType = "medical" | "non-medical" | "unknown"

export type ParsedScannedBarcode = {
  query: string
  source: ScanSourceType
}

const extractQueryFromUrl = (raw: string): string | null => {
  try {
    const url = new URL(raw)
    const q = url.searchParams.get("q")?.trim()
    return q || null
  } catch {
    return null
  }
}

export const parseScannedBarcode = (raw: string): ParsedScannedBarcode => {
  const normalized = raw.trim()
  if (!normalized) {
    return { query: "", source: "unknown" }
  }

  const urlQuery = extractQueryFromUrl(normalized)

  const noId = normalized.match(/NO\s*ID\s*:\s*([^\n\r]+)/i)?.[1]?.trim() || ""
  const code = normalized.match(/KODE\s*:\s*([^\n\r]+)/i)?.[1]?.trim() || ""
  const sourceRaw = normalized.match(/SUMBER\s*:\s*([^\n\r]+)/i)?.[1]?.trim().toLowerCase() || ""
  const firstLine = normalized.split(/\r?\n/)[0]?.trim() || ""

  const source: ScanSourceType = sourceRaw.includes("non")
    ? "non-medical"
    : sourceRaw.includes("med")
      ? "medical"
      : "unknown"

  return {
    query: urlQuery || noId || code || firstLine,
    source,
  }
}

export const findMatchingAsset = <T,>(
  assets: T[],
  query: string,
  searchValue: (asset: T) => string,
): T | undefined => {
  const normalizedQuery = query.trim()
  if (!normalizedQuery) return undefined

  return assets.find((asset) => matchesSearchKeyword(normalizedQuery, [searchValue(asset)]))
}
