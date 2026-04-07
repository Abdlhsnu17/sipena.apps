export type UserRole = "admin" | "leader" | "staff" | "staff_pj" | "teknisi" | string
export type StaffAccessType = "medis" | "non-medis" | "all" | string | null

export interface User {
  id: number | string
  nip: string
  name: string
  email: string
  role: UserRole
  staffAccessType?: StaffAccessType
  gender?: string
  workUnit?: string
  homeAddress?: string
  photoPath?: string
  createdAt: Date | string
  lastLogin?: Date | string
  umlAccess?: boolean | {
    isApproved: boolean
    approvedBy?: string
    approvedAt?: string
    requestedAt?: string
  }
}

export interface LoginCredentials {
  nip: string
  password: string
}

export interface RegisterCredentials {
  nip: string
  name: string
  email: string
  password: string
  confirmPassword: string
  role?: UserRole
  staffAccessType?: StaffAccessType
  gender?: string
  workUnit?: string
  homeAddress?: string
}

export interface PasswordResetRequestPayload {
  nip: string
}

export interface PasswordResetConfirmPayload {
  nip: string
  verificationCode: string
  newPassword: string
  confirmPassword: string
}

export interface AuthResponse {
  success: boolean
  message: string
  data?: {
    user: User
    token: string
  }
}

export interface TokenPayload {
  id: number | string
  nip: string
  name: string
  email: string
  role: UserRole
  staffAccessType?: StaffAccessType
  gender?: string
  workUnit?: string
  homeAddress?: string
  photoPath?: string
  iat?: number
  exp?: number
}
