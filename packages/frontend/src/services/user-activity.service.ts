import apiService from "./api.service"
import { isLocalAuthSession } from "./auth-utils"

export interface UserActivity {
  id: number
  userId: number
  userName?: string | null
  userNip?: string | null
  feature: string
  action: string
  description: string
  metadata?: Record<string, unknown> | null
  createdAt: string
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface UserActivityResponse {
  success: boolean
  message: string
  data: UserActivity[]
  pagination?: PaginationMeta
}

const normalizeUserActivity = (activity: any): UserActivity => ({
  id: Number(activity.id),
  userId: Number(activity.userId ?? activity.user_id),
  userName: activity.userName ?? activity.user_name ?? null,
  userNip: activity.userNip ?? activity.user_nip ?? null,
  feature: String(activity.feature ?? ""),
  action: String(activity.action ?? ""),
  description: String(activity.description ?? ""),
  metadata: activity.metadata ?? null,
  createdAt: String(activity.createdAt ?? activity.created_at ?? new Date().toISOString()),
})

class UserActivityService {
  private isRouteNotFound(error: unknown, route: string): boolean {
    const apiError = error as { message?: string; response?: { status?: number; body?: unknown } }
    const body = apiError.response?.body as { message?: string } | null | undefined
    return apiError.response?.status === 404 && String(body?.message ?? apiError.message ?? "").includes(route)
  }

  async getMyActivities(limit: number = 10): Promise<UserActivityResponse> {
    const safeLimit = Math.max(1, Math.min(limit, 10))
    if (isLocalAuthSession()) {
      return {
        success: true,
        message: "Aktivitas lokal tidak tersedia",
        data: [],
      }
    }
    const response = await apiService.get<UserActivityResponse>(`/user-activities/me?limit=${safeLimit}`)
    return {
      ...response,
      data: Array.isArray(response.data) ? response.data.map(normalizeUserActivity) : [],
    }
  }

  async getActivities(params: Record<string, string | number> = {}): Promise<UserActivityResponse> {
    if (isLocalAuthSession()) {
      return {
        success: true,
        message: "Aktivitas lokal tidak tersedia",
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      }
    }

    const query = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== "") {
        query.append(key, String(value))
      }
    })
    const endpoint = `/user-activities${query.toString() ? `?${query.toString()}` : ""}`
    let response: UserActivityResponse
    try {
      response = await apiService.get<UserActivityResponse>(endpoint)
    } catch (error) {
      if (!this.isRouteNotFound(error, "/api/user-activities")) {
        throw error
      }

      const fallbackLimit = Math.max(1, Math.min(Number(params.limit) || 20, 30))
      const fallback = await apiService.get<UserActivityResponse>(`/user-activities/me?limit=${fallbackLimit}`)
      return {
        ...fallback,
        message: "Arsip aktivitas terbatas sampai backend diperbarui",
        data: Array.isArray(fallback.data) ? fallback.data.map(normalizeUserActivity) : [],
        pagination: {
          page: 1,
          limit: fallbackLimit,
          total: Array.isArray(fallback.data) ? fallback.data.length : 0,
          totalPages: 1,
        },
      }
    }
    return {
      ...response,
      data: Array.isArray(response.data) ? response.data.map(normalizeUserActivity) : [],
    }
  }
}

export const userActivityService = new UserActivityService()
export default userActivityService
