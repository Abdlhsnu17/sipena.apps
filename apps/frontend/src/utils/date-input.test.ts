import { describe, expect, it } from "vitest"

import { parseLocalDateTimeInput, toIsoDateTimeString } from "./date-input"

describe("toIsoDateTimeString", () => {
  it("mengubah input datetime-local menjadi ISO UTC", () => {
    const input = "2026-08-14T09:30"
    const parsed = parseLocalDateTimeInput(input)

    expect(parsed).not.toBeNull()
    expect(toIsoDateTimeString(input)).toBe(parsed?.toISOString())
  })

  it("meneruskan Date menjadi ISO UTC", () => {
    const input = new Date("2026-08-14T09:30:00.000Z")

    expect(toIsoDateTimeString(input)).toBe("2026-08-14T09:30:00.000Z")
  })

  it("mengembalikan string kosong untuk input yang tidak valid", () => {
    expect(toIsoDateTimeString("bukan-tanggal")).toBe("")
  })
})
