export type UserRole = "admin" | "leader" | "staff" | "staff_pj" | "teknisi" | string
export type StaffAccessType = "medis" | "non-medis" | "all" | string | null
export type AccountStatus = "active" | "inactive" | "suspended"

export interface User {
  id: number | string
  nip: string
  name: string
  email: string
  role: UserRole
  staffAccessType?: StaffAccessType
  gender?: string
  workUnit?: string
  subWorkUnit?: string
  homeAddress?: string
  phoneNumber?: string
  photoPath?: string
  createdAt: Date | string
  updatedAt?: Date | string
  lastLogin?: Date | string
  sessionVersion?: number
  accountStatus?: AccountStatus
  mustChangePassword?: boolean
  /** True bila akun belum punya nomor telepon valid untuk menerima OTP. */
  mustCompletePhoneNumber?: boolean
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
  subWorkUnit?: string
  homeAddress?: string
  phoneNumber?: string
}

export interface PasswordResetRequestPayload {
  nip: string
}

export interface PasswordResetOtpVerifyPayload {
  nip: string
  verificationCode: string
}

export interface PasswordResetConfirmPayload {
  nip: string
  verificationCode: string
  newPassword: string
  confirmPassword: string
}

/** Jalur reset token: OTP sudah divalidasi lebih dulu di endpoint verify-otp. */
export interface PasswordResetTokenPayload {
  resetToken: string
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
  subWorkUnit?: string
  homeAddress?: string
  phoneNumber?: string
  photoPath?: string
  updatedAt?: Date | string
  sessionVersion?: number
  accountStatus?: AccountStatus
  mustChangePassword?: boolean
  iat?: number
  exp?: number
}
