import apiService from "./api.service"
import { normalizeUserRole } from "@/utils/role"

export interface User {
  id: number
  nip: string
  name: string
  email: string
  role: "admin" | "leader" | "staff" | "staff_pj" | "teknisi" | "user"
  staffAccessType?: "medis" | "non-medis" | "all"
  createdAt?: string
  lastLogin?: string
  umlAccess?: boolean
  gender?: string
  workUnit?: string
  homeAddress?: string
  photoPath?: string
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface UserResponse {
  success: boolean
  message: string
  data: User | User[]
  pagination?: PaginationMeta
}

const normalizeUser = (user: any): User => ({
  id: user.id,
  nip: user.nip,
  name: user.name,
  email: user.email,
  role: normalizeUserRole(user.role) as User["role"],
  staffAccessType: user.staffAccessType ?? user.staff_access_type,
  gender: user.gender,
  workUnit: user.workUnit ?? user.work_unit,
  homeAddress: user.homeAddress ?? user.home_address,
  photoPath: user.photoPath ?? user.photo_path,
  createdAt: user.createdAt ?? user.created_at,
  lastLogin: user.lastLogin ?? user.last_login,
  umlAccess: user.umlAccess ?? user.uml_access,
})

export interface CreateUserPayload {
  nip: string
  name: string
  email: string
  password: string
  role: "admin" | "leader" | "staff" | "staff_pj" | "teknisi" | "user"
  staffAccessType?: "medis" | "non-medis" | "all"
  gender?: string
  workUnit?: string
  homeAddress?: string
  photoPath?: string
}

export interface UpdateUserPayload {
  name?: string
  email?: string
  role?: "admin" | "leader" | "staff" | "staff_pj" | "teknisi" | "user"
  staffAccessType?: "medis" | "non-medis" | "all"
  umlAccess?: boolean
  gender?: string
  workUnit?: string
  homeAddress?: string
  photoPath?: string
}

class UserService {
  async getAll(params: Record<string, string | number> = {}): Promise<UserResponse> {
    const query = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== "") {
        query.append(key, String(value))
      }
    })
    const endpoint = `/users${query.toString() ? `?${query.toString()}` : ""}`
    const response = await apiService.get<UserResponse>(endpoint)
    return {
      ...response,
      data: Array.isArray(response.data) ? response.data.map(normalizeUser) : [],
    }
  }

  async getById(id: number | string): Promise<UserResponse> {
    const response = await apiService.get<UserResponse>(`/users/${id}`)
    return { ...response, data: normalizeUser(response.data) }
  }

  async create(payload: CreateUserPayload): Promise<UserResponse> {
    const response = await apiService.post<UserResponse>("/users", payload)
    return { ...response, data: normalizeUser(response.data) }
  }

  async update(id: number | string, payload: UpdateUserPayload): Promise<UserResponse> {
    const response = await apiService.put<UserResponse>(`/users/${id}`, payload)
    return { ...response, data: normalizeUser(response.data) }
  }

  async delete(id: number | string): Promise<UserResponse> {
    return apiService.delete<UserResponse>(`/users/${id}`)
  }

  async changePassword(id: number | string, currentPassword: string, newPassword: string): Promise<UserResponse> {
    return apiService.patch<UserResponse>(`/users/${id}/password`, { currentPassword, newPassword })
  }
}

export const userService = new UserService()
export default userService
