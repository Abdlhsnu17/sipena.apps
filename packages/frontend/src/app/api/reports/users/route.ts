import { NextRequest, NextResponse } from "next/server"
import { createExportResponse, ExportFormat } from "../export-utils"
import { buildForwardHeaders } from "../request-utils"

const API_PROXY_TARGET = (process.env.API_PROXY_TARGET || "http://localhost:4000").replace(/\/$/, "")
const ALLOWED_FORMATS: ExportFormat[] = ["excel", "csv"]
const PARAM_KEYS = ["search", "role", "page", "limit"]

const buildBackendUrl = (params: URLSearchParams): string => {
  const query = params.toString()
  return `${API_PROXY_TARGET}/api/users${query ? `?${query}` : ""}`
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
  PARAM_KEYS.forEach((key) => {
    const value =
      request.nextUrl.searchParams.get(key) ??
      (key === "limit" ? "1000" : undefined)
    if (value) {
      params.set(key, value)
    }
  })

  if (!params.has("limit")) {
    params.set("limit", "1000")
  }

  const backendUrl = buildBackendUrl(params)
  const response = await fetch(backendUrl, {
    headers: buildForwardHeaders(request),
    method: "GET",
  })

  if (!response.ok) {
    const body = await response.text()
    return new NextResponse(body || "Gagal mengambil data pengguna", {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("content-type") ?? "text/plain",
      },
    })
  }

  const payload = await response.json()
  if (!payload?.success || !Array.isArray(payload.data)) {
    return NextResponse.json(
      { success: false, message: payload?.message ?? "Respons pengguna tidak valid" },
      { status: 502 },
    )
  }

  return createExportResponse(payload.data, {
    format,
    fileNamePrefix: "laporan-pengguna",
    sheetName: "Pengguna",
    fallbackColumnKeys: [
      "id",
      "nip",
      "name",
      "email",
      "role",
      "staff_access_type",
      "work_unit",
      "gender",
      "uml_access",
      "created_at",
      "last_login",
    ],
    headers: {
      "X-Report-Type": "users",
    },
  })
}
