import { NextRequest, NextResponse } from "next/server"
import { createExportResponse, ExportFormat } from "../export-utils"
import { buildForwardHeaders } from "../request-utils"

const API_PROXY_TARGET = (process.env.API_PROXY_TARGET || "http://localhost:4000").replace(/\/$/, "")
const ALLOWED_FORMATS: ExportFormat[] = ["excel", "csv"]
const FILTER_KEYS = ["startDate", "endDate", "category", "type"]

const buildBackendUrl = (params: URLSearchParams): string => {
  const query = params.toString()
  return `${API_PROXY_TARGET}/api/reports/assets${query ? `?${query}` : ""}`
}

export async function GET(request: NextRequest) {
  const formatParam = (request.nextUrl.searchParams.get("format") ?? "excel").toLowerCase()
  if (!ALLOWED_FORMATS.includes(formatParam as ExportFormat)) {
    return NextResponse.json(
      { success: false, message: "Format ekspor tidak valid" },
      { status: 400 },
    )
  }

  const format = formatParam as ExportFormat
  const params = new URLSearchParams()
  FILTER_KEYS.forEach((key) => {
    const value = request.nextUrl.searchParams.get(key)
    if (value) {
      params.set(key, value)
    }
  })

  const backendUrl = buildBackendUrl(params)
  const response = await fetch(backendUrl, {
    headers: buildForwardHeaders(request),
    method: "GET",
  })

  if (!response.ok) {
    const body = await response.text()
    return new NextResponse(body || "Gagal mengambil data aset", {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("content-type") ?? "text/plain",
      },
    })
  }

  const payload = await response.json()
  if (!payload?.success || !Array.isArray(payload.data)) {
    return NextResponse.json(
      { success: false, message: payload?.message ?? "Respons laporan aset tidak valid" },
      { status: 502 },
    )
  }

  return createExportResponse(payload.data, {
    format,
    fileNamePrefix: "laporan-aset",
    sheetName: "Laporan Aset",
    fallbackColumnKeys: [
      "id",
      "asset_code",
      "name",
      "category",
      "type",
      "status",
      "location",
      "total_borrowings",
      "total_maintenance",
      "created_at",
    ],
    headers: {
      "X-Report-Type": "assets",
    },
  })
}
