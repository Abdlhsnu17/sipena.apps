import { NextRequest } from "next/server"
import { applyProxyForwardHeaders } from "../request-utils"

export const buildForwardHeaders = (request: NextRequest): Headers => {
  const headers = new Headers()
  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization")
  const cookieHeader = request.headers.get("cookie")

  if (authHeader) {
    headers.set("Authorization", authHeader)
  }

  if (cookieHeader) {
    headers.set("Cookie", cookieHeader)
  }

  headers.set("Accept", "application/json")
  applyProxyForwardHeaders(request, headers)
  return headers
}
