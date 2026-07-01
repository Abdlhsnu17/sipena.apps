import ExcelJS from "exceljs"
import { NextResponse } from "next/server"

export type ExportFormat = "excel" | "csv"

export interface ExportOptions {
  format: ExportFormat
  fileNamePrefix: string
  sheetName?: string
  fallbackColumnKeys?: string[]
  fileTimestamp?: string
  headers?: Record<string, string>
}

const normalizeCellValue = (value: unknown): string => {
  if (value === undefined || value === null) {
    return ""
  }
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

const buildRowMap = (record: unknown): Record<string, string> => {
  if (!record || typeof record !== "object") {
    return {}
  }

  return Object.entries(record).reduce<Record<string, string>>((acc, [key, value]) => {
    acc[key] = normalizeCellValue(value)
    return acc
  }, {})
}

const formatHeader = (value: string): string =>
  value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/ {2,}/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())

const escapeCsvValue = (value: string): string => {
  if (value.includes('"') || value.includes(",") || value.includes("\n") || value.includes("\r")) {
    return `"${value.replace(/"/g, '""')}"`
  }

  return value
}

const buildColumnKeys = (rows: Record<string, string>[], fallback?: string[]): string[] => {
  const derivedKeys = rows.reduce<string[]>((acc, row) => {
    Object.keys(row).forEach((key) => {
      if (key && !acc.includes(key)) {
        acc.push(key)
      }
    })
    return acc
  }, [])

  const fallbackKeys = (fallback ?? []).filter(Boolean)
  const combined = [...fallbackKeys]
  derivedKeys.forEach((key) => {
    if (!combined.includes(key)) {
      combined.push(key)
    }
  })

  if (combined.length === 0) {
    return ["info"]
  }

  return combined
}

const buildExcelBuffer = async (
  rows: Record<string, string>[],
  columnKeys: string[],
  sheetName: string,
): Promise<Buffer> => {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet(sheetName || "Laporan")

  worksheet.columns = columnKeys.map((key) => ({
    header: formatHeader(key),
    key,
    width: Math.max(14, key.length + 5),
  }))

  rows.forEach((row) => {
    worksheet.addRow(row)
  })

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

const buildCsvBuffer = (rows: Record<string, string>[], columnKeys: string[]): Buffer => {
  const headerLine = columnKeys.map((key) => escapeCsvValue(formatHeader(key))).join(",")
  const dataLines = rows.map((row) =>
    columnKeys
      .map((key) => escapeCsvValue(row[key] ?? ""))
      .join(","),
  )
  const csvContent = [headerLine, ...dataLines].join("\r\n")
  return Buffer.from(csvContent, "utf8")
}

export async function createExportResponse(records: unknown[], options: ExportOptions): Promise<NextResponse> {
  const normalizedRows = Array.isArray(records) ? records.map(buildRowMap) : []
  const columnKeys = buildColumnKeys(normalizedRows, options.fallbackColumnKeys)
  const timestamp = options.fileTimestamp ?? new Date().toISOString().split("T")[0]
  const extension = options.format === "excel" ? "xlsx" : "csv"
  const fileName = `${options.fileNamePrefix}-${timestamp}.${extension}`

  const buffer =
    options.format === "excel"
      ? await buildExcelBuffer(normalizedRows, columnKeys, options.sheetName ?? "Sheet1")
      : buildCsvBuffer(normalizedRows, columnKeys)

  const defaultHeaders: Record<string, string> = {
    "Content-Type":
      options.format === "excel"
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : "text/csv;charset=utf-8",
    "Content-Disposition": `attachment; filename="${fileName}"`,
  }

  const bodyInit = new Uint8Array(buffer)

  return new NextResponse(bodyInit, {
    headers: {
      ...defaultHeaders,
      ...(options.headers ?? {}),
    },
  })
}
