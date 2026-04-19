import apiService from "./api.service"

export interface UserActivity {
  id: number
  userId: number
  feature: string
  action: string
  description: string
  metadata?: Record<string, unknown> | null
  createdAt: string
}

export interface UserActivityResponse {
  success: boolean
  message: string
  data: UserActivity[]
}

const normalizeUserActivity = (activity: any): UserActivity => ({
  id: Number(activity.id),
  userId: Number(activity.userId ?? activity.user_id),
  feature: String(activity.feature ?? ""),
  action: String(activity.action ?? ""),
  description: String(activity.description ?? ""),
  metadata: activity.metadata ?? null,
  createdAt: String(activity.createdAt ?? activity.created_at ?? new Date().toISOString()),
})

class UserActivityService {
  async getMyActivities(limit: number = 8): Promise<UserActivityResponse> {
    const safeLimit = Math.max(1, Math.min(limit, 30))
    const response = await apiService.get<UserActivityResponse>(`/user-activities/me?limit=${safeLimit}`)
    return {
      ...response,
      data: Array.isArray(response.data) ? response.data.map(normalizeUserActivity) : [],
    }
  }
}

export const userActivityService = new UserActivityService()
export default userActivityService
