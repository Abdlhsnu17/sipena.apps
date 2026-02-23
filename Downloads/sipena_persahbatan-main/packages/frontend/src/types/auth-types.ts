export type UserRole = "admin" | "leader" | "staff" | "user"
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
  password: string
  confirmPassword: string
  role: UserRole
  staffAccessType?: StaffAccessType
}
