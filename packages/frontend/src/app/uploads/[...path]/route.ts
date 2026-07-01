import { NextRequest, NextResponse } from "next/server"
import { createProxyAbortSignal } from "../../api/proxy-timeout"
import { applyProxyForwardHeaders } from "../../api/request-utils"

const API_PROXY_TARGET = (process.env.API_PROXY_TARGET || "http://localhost:4000").replace(/\/$/, "")
export const dynamic = "force-dynamic"

const proxyRequest = async (req: NextRequest): Promise<NextResponse> => {
  const { pathname, search } = new URL(req.url)
  const targetUrl = `${API_PROXY_TARGET}${pathname}${search}`

  const headers = new Headers(req.headers)
  headers.delete("host")
  applyProxyForwardHeaders(req, headers)

  try {
    const apiResponse = await fetch(targetUrl, {
      method: req.method,
      headers,
      redirect: "manual",
      signal: createProxyAbortSignal(),
    })

    const responseHeaders = new Headers(apiResponse.headers)
    responseHeaders.delete("content-encoding")
    responseHeaders.delete("content-length")

    return new NextResponse(apiResponse.body, {
      status: apiResponse.status,
      headers: responseHeaders,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof DOMException && error.name === "TimeoutError"
          ? "Backend terlalu lama merespons"
          : "Upload proxy request failed",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 502 },
    )
  }
}

export const GET = proxyRequest
export const HEAD = proxyRequest
