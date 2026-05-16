import type { LoginCredentials, RegisterCredentials, User } from "@/types/auth-types"

const USERS_STORAGE_KEY = "hospital_users"
const CURRENT_USER_KEY = "hospital_current_user"
const TOKEN_STORAGE_KEY = "token"
const USER_STORAGE_KEY = "user"

type AuthStorageKind = "local" | "session"

function getStorage(kind: AuthStorageKind): Storage | null {
  if (typeof window === "undefined") return null
  return kind === "local" ? window.localStorage : window.sessionStorage
}

function getActiveAuthStorage(): Storage | null {
  const sessionStorageRef = getStorage("session")
  if (sessionStorageRef?.getItem(TOKEN_STORAGE_KEY)) {
    return sessionStorageRef
  }

  const localStorageRef = getStorage("local")
  if (localStorageRef?.getItem(TOKEN_STORAGE_KEY)) {
    return localStorageRef
  }

  return null
}

function dispatchAuthUserUpdated(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event("auth-user-updated"))
}

function removeAuthSessionData(): void {
  const storages = [getStorage("session"), getStorage("local")]

  storages.forEach((storage) => {
    storage?.removeItem(TOKEN_STORAGE_KEY)
    storage?.removeItem(USER_STORAGE_KEY)
    storage?.removeItem(CURRENT_USER_KEY)
  })
}

// Simple hash function for passwords (NOT for production - use bcrypt in real app)
function hashPassword(password: string): string {
  let hash = 0
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(16)
}

function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash
}

export function getUsers(): User[] {
  if (typeof window === "undefined") return []
  const users = localStorage.getItem(USERS_STORAGE_KEY)
  return users ? JSON.parse(users) : []
}

export function getAuthToken(): string | null {
  const storage = getActiveAuthStorage()
  return storage?.getItem(TOKEN_STORAGE_KEY) ?? null
}

export function getCurrentUser(): User | null {
  const storage = getActiveAuthStorage()
  const token = storage?.getItem(TOKEN_STORAGE_KEY)
  if (!token) return null
  const user = storage?.getItem(CURRENT_USER_KEY) || storage?.getItem(USER_STORAGE_KEY)
  return user ? JSON.parse(user) : null
}

export function buildLoginRedirectUrl(): string {
  if (typeof window === "undefined") {
    return "/login?redirect=%2F"
  }

  const targetPath = `${window.location.pathname}${window.location.search}` || "/"
  return `/login?redirect=${encodeURIComponent(targetPath)}`
}

export function resolveSafeRedirectPath(redirectPath: string | null | undefined): string {
  if (!redirectPath) return "/"

  if (!redirectPath.startsWith("/") || redirectPath.startsWith("//") || redirectPath.includes("://")) {
    return "/"
  }

  return redirectPath
}

export function persistAuthSession(user: User, token: string, rememberMe = false): void {
  removeAuthSessionData()

  const storage = getStorage(rememberMe ? "local" : "session")
  if (!storage) return

  const serializedUser = JSON.stringify(user)
  storage.setItem(TOKEN_STORAGE_KEY, token)
  storage.setItem(USER_STORAGE_KEY, serializedUser)
  storage.setItem(CURRENT_USER_KEY, serializedUser)
  dispatchAuthUserUpdated()
}

export function setCurrentUser(user: User | null): void {
  const storage = getActiveAuthStorage()
  if (!storage) return

  if (!user) {
    storage.removeItem(CURRENT_USER_KEY)
    dispatchAuthUserUpdated()
    return
  }

  const serializedUser = JSON.stringify(user)
  storage.setItem(USER_STORAGE_KEY, serializedUser)
  storage.setItem(CURRENT_USER_KEY, serializedUser)
  dispatchAuthUserUpdated()
}


export function login(credentials: LoginCredentials): { success: boolean; message: string; user?: User } {
  const users = getUsers()
  const identifier = credentials.nip.trim().toLowerCase()
  const user = users.find((u) => u.nip === credentials.nip.trim() || u.email?.toLowerCase() === identifier)

  if (!user) {
    return { success: false, message: "Akun tidak ditemukan" }
  }

  if (!user.password || !verifyPassword(credentials.password, user.password)) {
    return { success: false, message: "Password yang Anda masukkan salah" }
  }

  const updatedUser = { ...user, lastLogin: new Date().toISOString() }
  const updatedUsers = users.map((u) => (u.id === user.id ? updatedUser : u))
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updatedUsers))

  return { success: true, message: "Login berhasil", user: updatedUser }
}

export function logout(): void {
  removeAuthSessionData()
  dispatchAuthUserUpdated()
}

export function clearAuthSession(): void {
  logout()
}


export function register(credentials: RegisterCredentials): { success: boolean; message: string; user?: User } {
  if (credentials.password !== credentials.confirmPassword) {
    return { success: false, message: "Password tidak cocok" }
  }

  const users = getUsers()
  if (users.some((u) => u.nip === credentials.nip)) {
    return { success: false, message: "NIP sudah terdaftar" }
  }

  // Generate email from NIP for backward compatibility
  const generatedEmail = `${credentials.nip}@hospital.local`

  const newUser: User = {
    id: `user_${Date.now()}`,
    nip: credentials.nip,
    name: credentials.name,
    email: credentials.email || generatedEmail,
    password: hashPassword(credentials.password),
    role: credentials.role ?? "user",
    staffAccessType: undefined,
    createdAt: new Date().toISOString(),
  }

  users.push(newUser)
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users))

  return { success: true, message: "Pendaftaran berhasil", user: newUser }
}

export function updateUser(userId: string, updates: Partial<User>): { success: boolean; message: string } {
  const users = getUsers()
  const userIndex = users.findIndex((u) => u.id === userId)

  if (userIndex === -1) {
    return { success: false, message: "Pengguna tidak ditemukan" }
  }

  users[userIndex] = { ...users[userIndex], ...updates }
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users))

  const currentUser = getCurrentUser()
  if (currentUser?.id === userId) {
    setCurrentUser(users[userIndex])
  }

  return { success: true, message: "Pengguna berhasil diperbarui" }
}

export function deleteUser(userId: string): { success: boolean; message: string } {
  const users = getUsers().filter((u) => u.id !== userId)
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users))
  return { success: true, message: "Pengguna berhasil dihapus" }
}

export function deleteAllUsers(excludeIds: string[] = []): { success: boolean; message: string } {
  const users = getUsers().filter((u) => excludeIds.includes(String(u.id)))
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users))
  return { success: true, message: "Semua pengguna selain yang dipilih berhasil dihapus" }
}

export function resetPassword(userId: string, newPassword: string): { success: boolean; message: string } {
  const users = getUsers()
  const userIndex = users.findIndex((u) => u.id === userId)

  if (userIndex === -1) {
    return { success: false, message: "Pengguna tidak ditemukan" }
  }

  users[userIndex] = {
    ...users[userIndex],
    password: hashPassword(newPassword),
  }
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users))

  return { success: true, message: "Password berhasil diubah" }
}

export function changePassword(userId: string, currentPassword: string, newPassword: string): { success: boolean; message: string } {
  const users = getUsers()
  const userIndex = users.findIndex((u) => u.id === userId)

  if (userIndex === -1) {
    return { success: false, message: "Pengguna tidak ditemukan" }
  }

  const user = users[userIndex]
  
  // Verify current password
  if (!user.password || !verifyPassword(currentPassword, user.password)) {
    return { success: false, message: "Password saat ini salah" }
  }

  // Update password
  users[userIndex] = {
    ...user,
    password: hashPassword(newPassword),
  }
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users))

  // Update current user in session if it's the same user
  const currentUser = getCurrentUser()
  if (currentUser?.id === userId) {
    setCurrentUser(users[userIndex])
  }

  return { success: true, message: "Password berhasil diubah" }
}


export function initializeDefaultAdmin(): void {
  const users = getUsers()
  if (users.length === 0) {
    const adminUser: User = {
      id: "admin_001",
      nip: "199803172025211031",
      name: "Administrator",
      email: "admin@hospital.com",
      password: hashPassword("170398"),
      role: "admin",
      createdAt: new Date().toISOString(),
    }
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify([adminUser]))
  }
}
