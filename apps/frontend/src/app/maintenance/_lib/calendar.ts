export const calendarWeekDays = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"]

export const parseCalendarDate = (value?: string | null) => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export const isSameCalendarDate = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate()

export const getCalendarStartOffset = (date: Date) => (date.getDay() + 6) % 7
