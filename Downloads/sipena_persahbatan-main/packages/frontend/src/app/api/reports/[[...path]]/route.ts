import { NextRequest, NextResponse } from "next/server"
import { buildForwardHeaders } from "../request-utils"

const API_PROXY_TARGET = (process.env.API_PROXY_TARGET || "http://localhost:4000").replace(/\/$/, "")

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
  const params = await resolveRouteParams(context.params)
  const targetUrl = buildTargetUrl(params, request)

  const headers = new Headers(buildForwardHeaders(request))
  headers.delete("host")

  const body = ["GET", "HEAD"].includes(request.method) ? undefined : await request.arrayBuffer().catch(() => undefined)

  const apiResponse = await fetch(targetUrl, {
    method: request.method,
    headers,
    body,
    redirect: "manual",
  })

  const responseHeaders = new Headers(apiResponse.headers)
  responseHeaders.delete("content-encoding")
  responseHeaders.delete("content-length")

  const responseBody = apiResponse.body

  return new NextResponse(responseBody, {
    status: apiResponse.status,
    headers: responseHeaders,
  })
}

export const GET = proxyRequest
export const POST = proxyRequest
export const PUT = proxyRequest
export const PATCH = proxyRequest
export const DELETE = proxyRequest
export const HEAD = proxyRequest
