import type { UserRole } from "@/types/auth-types"

export const normalizeUserRole = (role?: string | null): string => {
  if (!role) return "user"
  const normalized = role.toLowerCase().trim().replace(/[\s-]+/g, "_")

  if (normalized === "tekniksi") return "teknisi"
  if (normalized === "staffpj") return "staff_pj"
  if (normalized === "staffpelayanan" || normalized === "staff_pelayanan") return "staff"
  if (normalized === "pengguna") return "user"

  return normalized
}

export const isAdminOrLeaderRole = (role?: string | null): boolean => {
  const normalized = normalizeUserRole(role)
  return normalized === "admin" || normalized === "leader"
}

export const isAdminRole = (role?: string | null): boolean => normalizeUserRole(role) === "admin"

export const isTechnicianRole = (role?: string | null): boolean => normalizeUserRole(role) === "teknisi"

export const isStaffPjRole = (role?: string | null): boolean => normalizeUserRole(role) === "staff_pj"

export const isUserRole = (role?: string | null): boolean => normalizeUserRole(role) === "user"

const fullAccessRoutes = [
  "/",
  "/uml",
  "/unggahan",
  "/maintenance",
  "/asset-usage",
  "/medical-assets",
  "/non-medical-assets",
  "/reports",
  "/activity-archive",
  "/users",
  "/borrowing",
  "/returns",
  "/settings",
]

const staffRoutes = ["/", "/uml", "/unggahan", "/maintenance", "/asset-usage", "/reports", "/activity-archive", "/borrowing", "/returns", "/settings"]
const staffPjRoutes = [
  "/",
  "/uml",
  "/unggahan",
  "/maintenance",
  "/asset-usage",
  "/medical-assets",
  "/non-medical-assets",
  "/reports",
  "/activity-archive",
  "/borrowing",
  "/returns",
  "/settings",
]
const technicianRoutes = ["/", "/uml", "/unggahan", "/maintenance", "/reports", "/activity-archive", "/settings"]
const inventoryRoutes = ["/medical-assets", "/non-medical-assets"]
const userRoutes = ["/", "/uml", "/unggahan", "/maintenance", "/asset-usage", "/reports", "/activity-archive", "/borrowing", "/returns", "/settings", ...inventoryRoutes]

export const getAllowedRoutesForRole = (role?: string | UserRole | null): string[] => {
  switch (normalizeUserRole(role)) {
    case "admin":
    case "leader":
      return fullAccessRoutes
    case "staff_pj":
      return staffPjRoutes
    case "teknisi":
      return technicianRoutes
    case "user":
      return userRoutes
    default:
        return [...staffRoutes, ...inventoryRoutes]
  }
}

export const canAccessRoute = (role: string | UserRole | null | undefined, pathname: string): boolean => {
  const normalizedPath = pathname.split("?")[0] || "/"

  return getAllowedRoutesForRole(role).some((route) => {
    if (route === "/") return normalizedPath === "/"
    return normalizedPath === route || normalizedPath.startsWith(`${route}/`)
  })
}

export const getDefaultRouteForRole = (role?: string | UserRole | null): string => {
  switch (normalizeUserRole(role)) {
    case "staff_pj":
      return "/medical-assets"
    case "teknisi":
      return "/"
    case "user":
      return "/"
    default:
      return "/"
  }
}

export const canManageMaintenanceStatusRole = (role?: string | null): boolean => {
  return isAdminOrLeaderRole(role) || isTechnicianRole(role)
}

export const canCreateMaintenanceRole = (role?: string | null): boolean => {
  const normalized = normalizeUserRole(role)
  return ["admin", "leader", "staff", "staff_pj", "user"].includes(normalized)
}

export const canManageInventoryRole = (role?: string | null): boolean => {
  return isAdminOrLeaderRole(role) || isStaffPjRole(role)
}

export const canAccessBorrowingRole = (role?: string | null): boolean => {
  const normalized = normalizeUserRole(role)
  return ["admin", "leader", "staff", "staff_pj", "user"].includes(normalized)
}

export const getUserRoleLabel = (role?: UserRole | string | null): string => {
  switch (normalizeUserRole(role)) {
    case "admin":
      return "Administrator"
    case "leader":
      return "Leader"
    case "staff":
      return "Staff Pelayanan"
    case "staff_pj":
      return "Staff PJ"
    case "teknisi":
      return "Teknisi"
    default:
      return "Pengguna"
  }
}
