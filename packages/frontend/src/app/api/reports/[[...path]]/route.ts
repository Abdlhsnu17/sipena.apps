import { NextRequest, NextResponse } from "next/server"
import { applyProxyForwardHeaders } from "../../request-utils"
import { createProxyAbortSignal } from "../../proxy-timeout"

const API_PROXY_TARGET = (process.env.API_PROXY_TARGET || "http://localhost:4000").replace(/\/$/, "")
export const dynamic = "force-dynamic"

type ReportsRouteParams = {
  path?: string[]
}

type ReportsRouteContext = {
  params: Promise<ReportsRouteParams | undefined>
}

const buildTargetUrl = (params: ReportsRouteParams, request: NextRequest): string => {
  const pathSegments = params.path ?? []
  const suffix = pathSegments.length ? `/${pathSegments.join("/")}` : ""
  const query = request.nextUrl.search
  return `${API_PROXY_TARGET}/api/reports${suffix}${query}`
}

const resolveRouteParams = async (params: Promise<ReportsRouteParams | undefined>): Promise<ReportsRouteParams> => {
  return (await params) ?? {}
}

const proxyRequest = async (request: NextRequest, context: ReportsRouteContext) => {
  try {
    const params = await resolveRouteParams(context.params)
    const targetUrl = buildTargetUrl(params, request)

    // Forward original headers so multipart/form-data uploads keep their boundary.
    const headers = new Headers(request.headers)
    headers.delete("host")
    applyProxyForwardHeaders(request, headers)

    let body: BodyInit | undefined
    if (!["GET", "HEAD"].includes(request.method)) {
      const rawBody = await request.arrayBuffer().catch(() => undefined)
      body = rawBody && rawBody.byteLength > 0 ? rawBody : undefined
    }

    const apiResponse = await fetch(targetUrl, {
      method: request.method,
      headers,
      body,
      redirect: "manual",
      cache: "no-store",
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
          : "Reports API proxy request failed",
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
export const HEAD = proxyRequest
