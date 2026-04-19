const toDateTimeLocalInputValue = (value?: string | Date | null) => {
  if (!value) return ""
  const date = typeof value === "string" ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return ""
  const offsetMs = date.getTimezoneOffset() * 60000
  const localDate = new Date(date.getTime() - offsetMs)
  return localDate.toISOString().slice(0, 16)
}

export { toDateTimeLocalInputValue }
export const getCurrentLocalDateTimeValue = () => toDateTimeLocalInputValue(new Date())
