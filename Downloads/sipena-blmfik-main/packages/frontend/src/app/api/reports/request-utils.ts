import { NextRequest } from "next/server"

export const buildForwardHeaders = (request: NextRequest): Record<string, string> => {
  const headers: Record<string, string> = {}
  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization")
  const cookieHeader = request.headers.get("cookie")

  if (authHeader) {
    headers["Authorization"] = authHeader
  }

  if (cookieHeader) {
    headers["Cookie"] = cookieHeader
  }

  headers["Accept"] = "application/json"
  return headers
}
