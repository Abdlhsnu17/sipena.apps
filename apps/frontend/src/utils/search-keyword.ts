type SearchableValue = string | number | null | undefined

const normalizeBase = (value: string): string =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()

const normalizeToken = (value: string): string => normalizeBase(value).replace(/[^a-z0-9]/g, "")

export const matchesSearchKeyword = (
  keyword: string,
  values: SearchableValue[]
): boolean => {
  const normalizedKeyword = normalizeBase(keyword.trim())
  if (!normalizedKeyword) return true

  const searchableValues = values
    .filter((value): value is string | number => value !== null && value !== undefined)
    .map((value) => {
      const raw = normalizeBase(String(value))
      return {
        raw,
        normalized: normalizeToken(raw),
      }
    })

  if (searchableValues.length === 0) return false

  const compactKeyword = normalizeToken(normalizedKeyword)
  const tokenPairs = normalizedKeyword
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .map((raw) => ({
      raw,
      normalized: normalizeToken(raw),
    }))
    .filter((token) => token.raw || token.normalized)

  const hasExactMatchInAnyField = searchableValues.some((value) => {
    if (value.raw.includes(normalizedKeyword)) return true
    if (!compactKeyword) return false
    return value.normalized.includes(compactKeyword)
  })

  if (hasExactMatchInAnyField) return true

  if (tokenPairs.length === 0) return false

  return tokenPairs.every((token) =>
    searchableValues.some((value) => {
      if (value.raw.includes(token.raw)) return true
      if (!token.normalized) return false
      return value.normalized.includes(token.normalized)
    })
  )
}
