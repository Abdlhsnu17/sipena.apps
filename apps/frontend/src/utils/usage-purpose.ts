const normalizeWhitespace = (value?: string | null) => (value ?? "").trim().replace(/\s+/g, " ")

const normalizeLookupKey = (value?: string | null) => normalizeWhitespace(value).toLowerCase()

const resolveAliasValue = (value: string, aliases: Record<string, string>) => {
  const normalizedValue = normalizeLookupKey(value)
  const matchedAliasEntry = Object.entries(aliases).find(
    ([alias]) => normalizeLookupKey(alias) === normalizedValue,
  )

  return matchedAliasEntry?.[1]
}

export const capitalizeUsagePurpose = (value?: string | null) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return ""
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

export const normalizeUsagePurpose = (
  value: string | undefined,
  knownOptions: readonly string[],
  aliases: Record<string, string> = {},
) => {
  const normalizedValue = normalizeWhitespace(value)
  if (!normalizedValue) return ""

  const aliasedValue = resolveAliasValue(normalizedValue, aliases) ?? normalizedValue

  const matchedOption = knownOptions.find((option) => normalizeLookupKey(option) === normalizeLookupKey(aliasedValue))
  if (matchedOption) return matchedOption

  return capitalizeUsagePurpose(aliasedValue)
}

export const buildUsagePurposeOptions = (
  knownOptions: readonly string[],
  currentValue?: string,
  aliases: Record<string, string> = {},
) => {
  const canonicalOptions = [...knownOptions]
  const normalizedCurrentValue = normalizeUsagePurpose(currentValue, knownOptions, aliases)

  if (normalizedCurrentValue && !canonicalOptions.some((option) => option === normalizedCurrentValue)) {
    canonicalOptions.push(normalizedCurrentValue)
  }

  return canonicalOptions
}

export const buildOrderedUsagePurposeList = (
  knownOptions: readonly string[],
  values: string[],
  aliases: Record<string, string> = {},
) => {
  const normalizedValues = values
    .map((value) => normalizeUsagePurpose(value, knownOptions, aliases))
    .filter(Boolean)

  const extraOptions = Array.from(new Set(normalizedValues)).filter(
    (value) => !knownOptions.some((option) => option === value),
  )

  extraOptions.sort((left, right) => left.localeCompare(right, "id"))

  return [...knownOptions, ...extraOptions]
}
