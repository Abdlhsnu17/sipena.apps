import { NextRequest } from "next/server"

const normalizeForwardedProto = (value: string | null | undefined): string => {
  const normalized = value?.trim().replace(/:$/, "")
  return normalized || "https"
}

const resolveRealIp = (request: NextRequest): string => {
  const realIp = request.headers.get("x-real-ip")?.trim()
  if (realIp) {
    return realIp
  }

  const forwardedFor = request.headers.get("x-forwarded-for")
  return forwardedFor?.split(",")[0]?.trim() || ""
}

export const applyProxyForwardHeaders = (request: NextRequest, headers: Headers): void => {
  const forwardedFor = request.headers.get("x-forwarded-for")?.trim()
  const realIp = resolveRealIp(request)
  const forwardedProto = normalizeForwardedProto(
    request.headers.get("x-forwarded-proto") || request.nextUrl.protocol,
  )
  const forwardedHost = request.headers.get("x-forwarded-host") || request.headers.get("host")

  if (forwardedFor) {
    headers.set("x-forwarded-for", forwardedFor)
  } else if (realIp) {
    headers.set("x-forwarded-for", realIp)
  }

  if (realIp) {
    headers.set("x-real-ip", realIp)
  }

  if (forwardedHost) {
    headers.set("x-forwarded-host", forwardedHost)
  }

  headers.set("x-forwarded-proto", forwardedProto)
}
