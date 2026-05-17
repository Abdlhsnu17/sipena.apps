export type UserRole = "admin" | "leader" | "staff" | "staff_pj" | "teknisi" | "user"
export type StaffAccessType = "medis" | "non-medis" | "all"



export interface User {
  id: string | number
  nip: string
  name: string
  email: string
  password?: string
  role: UserRole
  staffAccessType?: StaffAccessType
  gender?: string
  workUnit?: string
  homeAddress?: string
  phoneNumber?: string
  photoPath?: string
  createdAt?: string
  lastLogin?: string
}


export interface LoginCredentials {
  nip: string
  password: string
}


export interface RegisterCredentials {
  nip: string
  name: string
  email: string
  phoneNumber: string
  password: string
  confirmPassword: string
  role?: UserRole
  staffAccessType?: StaffAccessType
}
