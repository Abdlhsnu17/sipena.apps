import { NextRequest, NextResponse } from "next/server";
import { createProxyAbortSignal } from "../proxy-timeout";
import { applyProxyForwardHeaders } from "../request-utils";

const API_PROXY_TARGET = (process.env.API_PROXY_TARGET || "http://localhost:4000").replace(/\/$/, "")
export const dynamic = "force-dynamic"

const proxyRequest = async (req: NextRequest): Promise<NextResponse> => {
  const { pathname, search } = new URL(req.url)
  const targetUrl = `${API_PROXY_TARGET}${pathname}${search}`

  // Server-Sent Events are long-lived; the standard proxy timeout would abort
  // the notification stream after a few seconds, so it is disabled for it.
  const isEventStream = pathname.endsWith("/notifications/stream")

  const headers = new Headers(req.headers)
  headers.delete("host")
  applyProxyForwardHeaders(req, headers)

  let body: BodyInit | undefined
  if (req.method !== "GET" && req.method !== "HEAD") {
    const buffer = await req.arrayBuffer()
    body = buffer.byteLength ? buffer : undefined
  }

  try {
    const apiResponse = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
      redirect: "manual",
      signal: isEventStream ? undefined : createProxyAbortSignal(),
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
          : "API proxy request failed",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 502 },
    )
  }
}

export const GET = proxyRequest
export const POST = proxyRequest
export const PUT = proxyRequest
export const PATCH = proxyRequest
export const DELETE = proxyRequest
export const OPTIONS = proxyRequest
