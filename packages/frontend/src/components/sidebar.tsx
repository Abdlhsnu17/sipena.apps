"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { buildLoginRedirectUrl } from "@/services/auth-utils"
import type { User } from "@/services/auth.service"
import authService from "@/services/auth.service"
import userActivityService, { type UserActivity } from "@/services/user-activity.service"
import { cn } from "@/utils"
import { getFeatureLabel } from "@/utils/feature-presentation"
import { toPublicPhotoUrl } from "@/utils/photoUrl"
import { getUserRoleLabel, isAdminOrLeaderRole, isStaffPjRole, isTechnicianRole, isUserRole } from "@/utils/role"
import {
  BarChart3,
  Building,
  Calendar,
  ChevronDown,
  ChevronLeft,
  Clock3,
  FileText,
  HandHelping,
  LayoutDashboard,
  LogOut,
  Menu,
  RotateCcw,
  Settings,
  Sparkles,
  Stethoscope,
  Users,
  X
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useCallback, useEffect, useState, type ComponentType } from "react"



interface SidebarProps {
  isCollapsed: boolean
  toggleSidebar: () => void
}

type SidebarLink = {
  href: string
  label: string
  icon: ComponentType<{ className?: string }>
  iconColor?: string
  searchKeywords?: string[]
}

const normalizeActivityValue = (value?: string | null) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")

const toPositiveNumber = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

const ACTIVITY_CODE_PATTERN = /\b([A-Z0-9]+(?:-[A-Z0-9]+)+)\b/

const getCodeLikeIdentifier = (value: unknown) => {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed) return null

  const matchedCode = trimmed.match(ACTIVITY_CODE_PATTERN)
  return matchedCode?.[1] ?? null
}

const getActivityCodeFromMetadata = (activity: UserActivity) => {
  const metadata = activity.metadata ?? {}
  const codeKeys = [
    "transactionCode",
    "transaction_code",
    "borrowingCode",
    "borrowing_code",
    "maintenanceCode",
    "maintenance_code",
    "recordNoId",
    "record_no_id",
    "code",
    "transactionId",
    "transaction_id",
  ]

  for (const key of codeKeys) {
    const value = (metadata as Record<string, unknown>)[key]
    const code = getCodeLikeIdentifier(value)
    if (code) return code
  }

  return null
}

const getActivityIdentifierFromMetadata = (activity: UserActivity) => {
  const metadata = activity.metadata ?? {}
  const idKeys = [
    'transactionId',
    'transaction_id',
    'borrowingId',
    'borrowing_id',
    'maintenanceId',
    'maintenance_id',
    'scheduleId',
    'schedule_id',
    'uploadId',
    'upload_id',
    'id',
  ]

  for (const key of idKeys) {
    const value = (metadata as Record<string, unknown>)[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
    const id = toPositiveNumber(value)
    if (id) {
      return `#${id}`
    }
  }
  return null
}

const getActivityTransactionId = (activity: UserActivity) => {
  const explicitCode = getActivityCodeFromMetadata(activity) ?? getCodeLikeIdentifier(activity.description)
  if (explicitCode) return explicitCode

  const metadataIdentifier = getActivityIdentifierFromMetadata(activity)
  if (!metadataIdentifier) return null

  if (metadataIdentifier.startsWith("#")) return null

  return metadataIdentifier
}

const getMetadataTextValue = (metadata: Record<string, unknown> | null | undefined, keys: string[]) => {
  if (!metadata) return null
  for (const key of keys) {
    const value = metadata[key]
    if (typeof value === "string" && value.trim()) {
      return value.trim()
    }
  }
  return null
}

const getActivityItemName = (activity: UserActivity) =>
  getMetadataTextValue(activity.metadata as Record<string, unknown> | null | undefined, [
    "recordItemName",
    "record_item_name",
    "assetName",
    "asset_name",
    "itemName",
    "item_name",
  ])

const getActivityItemCode = (activity: UserActivity) =>
  getMetadataTextValue(activity.metadata as Record<string, unknown> | null | undefined, [
    "recordItemCode",
    "record_item_code",
    "assetCode",
    "asset_code",
    "itemCode",
    "item_code",
  ])

const isSearchActivity = (activity: UserActivity) =>
  normalizeActivityValue(activity.feature) === "pencarian" && normalizeActivityValue(activity.action) === "search"

const formatActivityStatus = (value: unknown) => {
  const normalized = normalizeActivityValue(typeof value === "string" ? value : "")
  switch (normalized) {
    case "scheduled":
      return "tertunda"
    case "in progress":
      return "proses"
    case "completed":
      return "selesai"
    case "validated":
      return "tervalidasi"
    case "cancelled":
      return "dibatalkan"
    case "pending":
      return "menunggu"
    case "approved":
    case "borrowed":
      return "dipinjam"
    case "returned":
      return "dikembalikan"
    case "rejected":
      return "ditolak"
    case "overdue":
      return "terlambat"
    default:
      return normalized || null
  }
}

const getActivityActionLabel = (activity: UserActivity) => {
  const feature = normalizeActivityValue(activity.feature)
  const action = normalizeActivityValue(activity.action)

  if (feature === "pengembalian alat") {
    if (action === "validate") return "Memvalidasi pengembalian alat"
    if (action === "return") return "Mengembalikan alat"
  }

  if (feature === "peminjaman alat") {
    if (action === "create") return "Membuat peminjaman alat"
    if (action === "update") return "Mengubah data peminjaman"
    if (action === "approve") return "Menyetujui peminjaman"
    if (action === "reject") return "Menolak peminjaman"
    if (action === "delete") return "Menghapus data peminjaman"
  }

  if (feature === "jadwal pemeliharaan") {
    if (action === "create") return "Membuat jadwal pemeliharaan"
    if (action === "update") return "Mengubah jadwal pemeliharaan"
    if (action === "status update") return "Memperbarui status jadwal pemeliharaan"
    if (action === "delete") return "Menghapus jadwal pemeliharaan"
  }

  if (feature === "pemeliharaan" && action === "complete") {
    return "Menyelesaikan pemeliharaan"
  }

  if (feature === "unggahan") {
    if (action === "upload") return "Mengunggah file"
    if (action === "delete") return "Menghapus unggahan"
  }

  return null
}

const formatActivityDescription = (activity: UserActivity) => {
  const actionLabel = getActivityActionLabel(activity)
  if (!actionLabel) {
    return activity.description
  }

  const status = activity.action === "status_update" ? formatActivityStatus(activity.metadata?.status) : null

  return [actionLabel, status ? `menjadi ${status}` : null].filter(Boolean).join(" ")
}

const formatActivityTime = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"

  const diffMs = Date.now() - date.getTime()
  if (diffMs < 60_000) return "Baru saja"
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)} menit lalu`
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)} jam lalu`

  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function Sidebar({ isCollapsed, toggleSidebar }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<User | null>(authService.getCurrentUser())
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [recentActivities, setRecentActivities] = useState<UserActivity[]>([])
  const [isActivityHistoryExpanded, setIsActivityHistoryExpanded] = useState(() => {
    if (typeof window === "undefined") return true
    const saved = localStorage.getItem("sidebar-activity-expanded")
    return saved !== null ? JSON.parse(saved) : true
  })
  const [isProfileExpanded, setIsProfileExpanded] = useState(() => {
    if (typeof window === "undefined") return true
    const saved = localStorage.getItem("sidebar-profile-expanded")
    return saved !== null ? JSON.parse(saved) : true
  })
  const closeMobileMenu = useCallback(() => {
    setIsMobileMenuOpen(false)
  }, [])

  useEffect(() => {
    closeMobileMenu()
  }, [closeMobileMenu, pathname])

  const loadActivities = useCallback(async () => {
    if (!currentUser?.id) {
      setRecentActivities([])
      return
    }
    try {
      const response = await userActivityService.getMyActivities(7)
      if (response.success) {
        setRecentActivities(response.data.filter((activity) => !isSearchActivity(activity)))
      }
    } catch (error) {
      console.error("Failed to load user activities:", error)
    }
  }, [currentUser?.id])

  useEffect(() => {
    const handler = () => setCurrentUser(authService.getCurrentUser())
    if (typeof window !== "undefined") {
      window.addEventListener("auth-user-updated", handler)
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("auth-user-updated", handler)
      }
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    const handleResize = () => {
      if (window.innerWidth >= 1280) {
        closeMobileMenu()
      }
    }
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [closeMobileMenu])

  useEffect(() => {
    if (typeof window === "undefined") return

    const handleOrientationChange = () => {
      closeMobileMenu()
    }

    window.addEventListener("orientationchange", handleOrientationChange)
    return () => window.removeEventListener("orientationchange", handleOrientationChange)
  }, [closeMobileMenu])

  useEffect(() => {
    if (!isMobileMenuOpen || typeof window === "undefined") return
    const previousOverflow = document.body.style.overflow
    const previousPaddingRight = document.body.style.paddingRight
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth

    document.body.style.overflow = "hidden"
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`
    }

    return () => {
      document.body.style.overflow = previousOverflow
      document.body.style.paddingRight = previousPaddingRight
    }
  }, [isMobileMenuOpen])

  useEffect(() => {
    if (!isMobileMenuOpen || typeof window === "undefined") return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        closeMobileMenu()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [closeMobileMenu, isMobileMenuOpen])

  useEffect(() => {
    loadActivities()
  }, [loadActivities, pathname])

  useEffect(() => {
    if (typeof window === "undefined") return

    const handleUserActivityRecorded = () => {
      void loadActivities()
    }

    window.addEventListener("user-activity-recorded", handleUserActivityRecorded)
    return () => window.removeEventListener("user-activity-recorded", handleUserActivityRecorded)
  }, [loadActivities])

  useEffect(() => {
    if (!currentUser?.id) return
    const intervalId = window.setInterval(() => {
      void loadActivities()
    }, 30000)
    return () => window.clearInterval(intervalId)
  }, [currentUser?.id, loadActivities])

  // Persist activity history expanded state to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("sidebar-activity-expanded", JSON.stringify(isActivityHistoryExpanded))
    }
  }, [isActivityHistoryExpanded])

  // Persist profile expanded state to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("sidebar-profile-expanded", JSON.stringify(isProfileExpanded))
    }
  }, [isProfileExpanded])

  const fullAccessLinks: SidebarLink[] = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard, iconColor: "text-black", searchKeywords: ["beranda", "home", "ringkasan"] },
    { href: "/uml", label: "Dokumentasi", icon: FileText, iconColor: "text-slate-500", searchKeywords: ["dokumentasi", "uml", "unggahan", "arsip"] },
    { href: "/medical-assets", label: "Inventaris Medis", icon: Stethoscope, iconColor: "text-cyan-600", searchKeywords: ["medis", "alat medis", "inventaris medis"] },
    { href: "/non-medical-assets", label: "Inventaris Non-Medis", icon: Building, iconColor: "text-teal-600", searchKeywords: ["non medis", "sarana", "prasarana"] },
    { href: "/maintenance", label: "Pemelirahaan Sarana", icon: Calendar, iconColor: "text-red-600", searchKeywords: ["jadwal", "maintenance", "perawatan", "pemeliharaan"] },
    { href: "/reports", label: "Laporan", icon: BarChart3, iconColor: "text-purple-600", searchKeywords: ["report", "analitik", "rekap"] },
    { href: "/users", label: "Manajemen Pengguna", icon: Users, iconColor: "text-amber-600", searchKeywords: ["pengguna", "user", "nip", "nik", "akun"] },
    { href: "/borrowing", label: "Peminjaman Alat", icon: HandHelping, iconColor: "text-amber-600", searchKeywords: ["pinjam", "peminjaman", "borrow"] },
    { href: "/settings", label: "Pengaturan", icon: Settings, iconColor: "text-orange-700", searchKeywords: ["setting", "settings", "akun", "profil", "nip", "nik", "password", "tema"] },
    { href: "/returns", label: "Pengembalian Alat", icon: RotateCcw, iconColor: "text-green-600", searchKeywords: ["kembali", "pengembalian", "return"] },
  ].sort((a, b) => a.label.localeCompare(b.label, 'id'))

  const staffLinks: SidebarLink[] = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard, iconColor: "text-black", searchKeywords: ["beranda", "home", "ringkasan"] },
    { href: "/uml", label: "Dokumentasi", icon: FileText, iconColor: "text-slate-500", searchKeywords: ["dokumentasi", "uml", "unggahan", "arsip"] },
    { href: "/medical-assets", label: "Inventaris Medis", icon: Stethoscope, iconColor: "text-cyan-600", searchKeywords: ["medis", "alat medis", "inventaris medis"] },
    { href: "/non-medical-assets", label: "Inventaris Non-Medis", icon: Building, iconColor: "text-teal-600", searchKeywords: ["non medis", "sarana", "prasarana"] },
    { href: "/maintenance", label: "Pemelirahaan Sarana", icon: Calendar, iconColor: "text-red-600", searchKeywords: ["jadwal", "maintenance", "perawatan", "pemeliharaan"] },
    { href: "/reports", label: "Laporan", icon: BarChart3, iconColor: "text-purple-600", searchKeywords: ["report", "analitik", "rekap"] },
    { href: "/borrowing", label: "Peminjaman Alat", icon: HandHelping, iconColor: "text-amber-600", searchKeywords: ["pinjam", "peminjaman", "borrow"] },
    { href: "/returns", label: "Pengembalian Alat", icon: RotateCcw, iconColor: "text-green-600", searchKeywords: ["kembali", "pengembalian", "return"] },
    { href: "/settings", label: "Pengaturan", icon: Settings, iconColor: "text-orange-700", searchKeywords: ["setting", "settings", "akun", "profil", "nip", "nik", "password", "tema"] },
  ].sort((a, b) => a.label.localeCompare(b.label, 'id'))

  const staffPjLinks: SidebarLink[] = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard, iconColor: "text-black", searchKeywords: ["beranda", "home", "ringkasan"] },
    { href: "/uml", label: "Dokumentasi", icon: FileText, iconColor: "text-slate-500", searchKeywords: ["dokumentasi", "uml", "unggahan", "arsip"] },
    { href: "/medical-assets", label: "Inventaris Medis", icon: Stethoscope, iconColor: "text-cyan-600", searchKeywords: ["medis", "alat medis", "inventaris medis"] },
    { href: "/non-medical-assets", label: "Inventaris Non-Medis", icon: Building, iconColor: "text-teal-600", searchKeywords: ["non medis", "sarana", "prasarana"] },
    { href: "/maintenance", label: "Pemelirahaan Sarana", icon: Calendar, iconColor: "text-red-600", searchKeywords: ["jadwal", "maintenance", "perawatan", "pemeliharaan"] },
    { href: "/reports", label: "Laporan", icon: BarChart3, iconColor: "text-purple-600", searchKeywords: ["report", "analitik", "rekap"] },
    { href: "/borrowing", label: "Peminjaman Alat", icon: HandHelping, iconColor: "text-amber-600", searchKeywords: ["pinjam", "peminjaman", "borrow"] },
    { href: "/returns", label: "Pengembalian Alat", icon: RotateCcw, iconColor: "text-green-600", searchKeywords: ["kembali", "pengembalian", "return"] },
    { href: "/settings", label: "Pengaturan", icon: Settings, iconColor: "text-orange-700", searchKeywords: ["setting", "settings", "akun", "profil", "nip", "nik", "password", "tema"] },
  ].sort((a, b) => a.label.localeCompare(b.label, 'id'))

  const technicianLinks: SidebarLink[] = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard, iconColor: "text-black", searchKeywords: ["beranda", "home", "ringkasan"] },
    { href: "/uml", label: "Dokumentasi", icon: FileText, iconColor: "text-slate-500", searchKeywords: ["dokumentasi", "uml", "unggahan", "arsip"] },
    { href: "/maintenance", label: "Pemelirahaan Sarana", icon: Calendar, iconColor: "text-red-600", searchKeywords: ["jadwal", "maintenance", "perawatan", "pemeliharaan"] },
    { href: "/settings", label: "Pengaturan", icon: Settings, iconColor: "text-orange-700", searchKeywords: ["setting", "settings", "akun", "profil", "nip", "nik", "password", "tema"] },
  ].sort((a, b) => a.label.localeCompare(b.label, 'id'))

  const userLinks: SidebarLink[] = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard, iconColor: "text-black", searchKeywords: ["beranda", "home", "ringkasan"] },
    { href: "/uml", label: "Dokumentasi", icon: FileText, iconColor: "text-slate-500", searchKeywords: ["dokumentasi", "uml", "unggahan", "arsip"] },
    { href: "/medical-assets", label: "Inventaris Medis", icon: Stethoscope, iconColor: "text-cyan-600", searchKeywords: ["medis", "alat medis", "inventaris medis"] },
    { href: "/non-medical-assets", label: "Inventaris Non-Medis", icon: Building, iconColor: "text-teal-600", searchKeywords: ["non medis", "sarana", "prasarana"] },
    { href: "/borrowing", label: "Peminjaman Alat", icon: HandHelping, iconColor: "text-amber-600", searchKeywords: ["pinjam", "peminjaman", "borrow"] },
    { href: "/returns", label: "Pengembalian Alat", icon: RotateCcw, iconColor: "text-green-600", searchKeywords: ["kembali", "pengembalian", "return"] },
    { href: "/settings", label: "Pengaturan", icon: Settings, iconColor: "text-orange-700", searchKeywords: ["setting", "settings", "akun", "profil", "nip", "nik", "password", "tema"] },
  ].sort((a, b) => a.label.localeCompare(b.label, 'id'))

  const hasFullAccess = isAdminOrLeaderRole(currentUser?.role)
  const isStaffPj = isStaffPjRole(currentUser?.role)
  const isTechnician = isTechnicianRole(currentUser?.role)
  const isRegularUser = isUserRole(currentUser?.role)
  const links = hasFullAccess
    ? fullAccessLinks
    : isStaffPj
      ? staffPjLinks
      : isTechnician
        ? technicianLinks
        : isRegularUser
          ? userLinks
          : staffLinks
  const visibleLinks = isCollapsed ? links : links

  const handleLinkClick = useCallback(() => {
    closeMobileMenu()
  }, [closeMobileMenu])

  const isLinkActive = useCallback(
    (href: string) => {
      if (href === "/") return pathname === "/"
      return pathname === href || pathname.startsWith(`${href}/`)
    },
    [pathname],
  )

  const cacheKey =
    (currentUser as any)?.updatedAt || currentUser?.lastLogin || currentUser?.createdAt || Date.now()
  const profileImageUrl = toPublicPhotoUrl(currentUser?.photoPath, cacheKey)

  const handleLogout = async () => {
    await authService.logout()
    router.replace(buildLoginRedirectUrl())
  }

  const getRoleLabel = () => {
    return getUserRoleLabel(currentUser?.role)
  }

  const getInitials = () => {
    const name = (currentUser?.name ?? "").trim()
    if (!name) return "U"
    const parts = name.split(/\s+/).filter(Boolean)
    const first = parts[0]?.[0] ?? ""
    const second = parts.length > 1 ? parts[1]?.[0] ?? "" : ""
    return (first + second).toUpperCase()
  }

  const SidebarContent = () => (
    <>
      <div className="p-4 border-b border-border">
        {isCollapsed ? (
          <div className="hidden flex-col items-center gap-3 xl:flex">
            <Image
              src="/images/logo-RS.png"
              alt="Logo Kemenkes RS Persahabatan"
              width={40}
              height={40}
              className="object-contain drop-shadow-sm"
              style={{ width: "auto", height: "auto" }}
              priority
            />
            <button
              onClick={toggleSidebar}
              className="p-2 hover:bg-muted rounded-lg"
              aria-label="Buka sidebar"
              title="Buka sidebar"
            >
              <Menu className="w-5 h-5 text-foreground" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Image
                src="/images/logo-RS.png"
                alt="Logo Kemenkes RS Persahabatan"
                width={150}
                height={60}
                className="object-contain drop-shadow-sm"
                style={{ width: "auto", height: "auto" }}
                priority
              />
            </div>
            <button
              onClick={toggleSidebar}
              className="hidden rounded-lg p-2 hover:bg-muted xl:block"
              aria-label="Tutup sidebar"
              title="Tutup sidebar"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          </div>
        )}
        {!isCollapsed && (
          <p className="text-xs text-muted-foreground mt-2 px-4 font-bold">
            Sistem Inventaris & Peminjaman Serta Pemeliharaan Sarana
          </p>
        )}
      </div>

      <nav
        className={cn(
          "flex-1 min-h-0 space-y-2 overflow-y-scroll [scrollbar-gutter:stable] [scrollbar-width:thin] [scrollbar-color:rgb(13_148_136)_transparent] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-teal-500/70 [&::-webkit-scrollbar-track]:bg-transparent",
          isCollapsed ? "p-2" : "p-4",
        )}
      >
        {visibleLinks.map((link) => {
            const Icon = link.icon
            const isActive = isLinkActive(link.href)
            const iconColorClass = isActive ? "text-white" : link.iconColor ?? "text-foreground"
            const isVisualAdjustedIcon = link.href === "/borrowing" || link.href === "/settings" || link.href === "/users"
            const iconSizeClass = isCollapsed
              ? isVisualAdjustedIcon
                ? "w-[22px] h-[22px]"
                : "w-5 h-5"
              : isVisualAdjustedIcon
                ? "w-[18px] h-[18px]"
                : "w-4 h-4"
            return (
              <Link 
                key={link.href} 
                href={link.href} 
                onClick={handleLinkClick}
                aria-current={isActive ? "page" : undefined}
                className="block touch-manipulation"
              >
                <div
                  className={cn(
                    "flex items-center rounded-lg transition-colors cursor-pointer select-none",
                    isCollapsed ? "justify-center px-2 py-2" : "gap-3 px-4 py-2",
                    isActive ? "bg-teal-600 text-white" : "text-foreground hover:bg-muted",
                  )}
                  title={link.label}
                  role="menuitem"
                  onMouseDown={(event) => {
                    event.stopPropagation()
                  }}
                >
                  <Icon className={cn(iconSizeClass, iconColorClass)} />
                  {isCollapsed ? (
                    <span className="sr-only">{link.label}</span>
                  ) : (
                    <span className="text-sm font-bold">{link.label}</span>
                  )}
                </div>
              </Link>
            )
          })}
      </nav>

      {currentUser && !isCollapsed && (
        <div className="px-4 pb-0 z-0">
          <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white/90 shadow-[0_10px_25px_rgba(15,23,42,0.06)] dark:border-slate-800/70 dark:bg-slate-900/70">
            <div className="w-full border-b border-slate-200/70 px-4 py-2 dark:border-slate-800/70">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Clock3 className="h-3.5 w-3.5 text-teal-600" />
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-600 dark:text-slate-300">
                    Riwayat Aktivitas
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsActivityHistoryExpanded(!isActivityHistoryExpanded)}
                  className="rounded-full p-2 text-teal-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                  aria-label={isActivityHistoryExpanded ? "Sembunyikan riwayat" : "Tampilkan riwayat"}
                >
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 transition-transform duration-300",
                      isActivityHistoryExpanded ? "rotate-0" : "-rotate-90"
                    )}
                  />
                </button>
              </div>
            </div>
            <div
              className={cn(
                "transition-all duration-300 ease-in-out overflow-hidden [scrollbar-width:thin] [scrollbar-color:rgb(13_148_136)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-teal-500/70 [&::-webkit-scrollbar-track]:bg-transparent",
                isActivityHistoryExpanded ? "max-h-64 overflow-y-scroll pr-1" : "max-h-0"
              )}
            >
              <div className="px-2 py-1.5">
                {recentActivities.length === 0 ? (
                  <p className="py-2 text-center text-[11px] text-muted-foreground">Belum ada aktivitas tercatat.</p>
                ) : (
                  <div className="space-y-1.5">
                    {recentActivities.map((activity) => (
                      <div
                        key={activity.id}
                        className="rounded-xl border border-slate-200/70 bg-white/90 px-2 py-1.5 dark:border-slate-800/70 dark:bg-slate-900/60"
                      >
                        <p className="text-[10px] font-semibold text-teal-700 dark:text-teal-300">
                          {getFeatureLabel(activity.feature)}
                        </p>
                        <p className="text-xs leading-snug text-foreground">{formatActivityDescription(activity)}</p>
                        {getActivityItemName(activity) ? (
                          <p className="mt-1 text-[11px] text-slate-700 dark:text-slate-300">
                            Nama Alat: {getActivityItemName(activity)}
                          </p>
                        ) : null}
                        {getActivityItemCode(activity) ? (
                          <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                            Kode Barang: {getActivityItemCode(activity)}
                          </p>
                        ) : null}
                        {getActivityTransactionId(activity) ? (
                          <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                            No ID: {getActivityTransactionId(activity)}
                          </p>
                        ) : null}
                        <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                          {formatActivityTime(activity.createdAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}


      {currentUser && !isCollapsed && (
        <div className="px-4 py-2 z-0">
          <div className="rounded-2xl border border-slate-200/70 bg-white/90 shadow-[0_15px_30px_rgba(15,23,42,0.08)] dark:border-slate-800/70 dark:bg-slate-900/70">
            <button
              onClick={() => setIsProfileExpanded(!isProfileExpanded)}
              className="w-full flex items-center justify-between gap-2 border-b border-slate-200/70 px-4 py-2 dark:border-slate-800/70 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors rounded-t-2xl cursor-pointer"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-600 dark:text-slate-300">
                Profil Akun
              </p>
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 text-teal-600 transition-transform duration-300",
                  isProfileExpanded ? "rotate-0" : "-rotate-90"
                )}
              />
            </button>
            <div
              className={cn(
                "transition-all duration-300 ease-in-out overflow-hidden",
                isProfileExpanded ? "max-h-96" : "max-h-0"
              )}
            >
              <div className="flex flex-col gap-3 px-3 py-2">
                <div className="flex items-center gap-3">
                  <Avatar className="h-16 w-16 rounded-full border border-slate-200/70 shadow-sm dark:border-slate-700/70">
                    {profileImageUrl ? (
                      <AvatarImage src={profileImageUrl} alt={`${currentUser.name} photo`} />
                    ) : (
                      <AvatarFallback className="text-lg font-semibold uppercase text-muted-foreground dark:text-slate-300">
                        {getInitials()}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div className="flex-1 space-y-0.5">
                    <p className="text-sm font-semibold text-foreground leading-snug">{currentUser.name}</p>
                    <p className="text-xs text-muted-foreground">NIP {currentUser.nip}</p>
                    <p className="text-[10px] uppercase tracking-[0.4em] text-teal-600 dark:text-teal-300">
                      {getRoleLabel()}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="border-t border-slate-200/70 dark:border-slate-800/70 px-3 py-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs font-semibold uppercase tracking-[0.4em]"
                onClick={handleLogout}
              >
                <LogOut className="mr-1 h-3 w-3" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      )}
      {currentUser && isCollapsed && (
        <div className="flex flex-col items-center p-2 pb-4">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full text-teal-700 hover:bg-teal-100"
            onClick={handleLogout}
            title="Logout"
            aria-label="Logout"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      )}

      <div className="p-4 border-t border-border">
        <div className={cn(
          "flex items-center justify-center gap-2",
          isCollapsed ? "flex-col gap-1" : ""
        )}>
          
          {isCollapsed ? (
            <span
              className="flex items-center justify-center w-8 h-8 bg-teal-100 text-teal-700 rounded-full cursor-pointer hover:bg-teal-200 transition"
              title="SiPeNa"
            >
              <Sparkles className="w-5 h-5" />
            </span>
          ) : (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-teal-100 text-teal-700 text-xs font-medium rounded-full cursor-pointer hover:bg-teal-200 transition">
              <Sparkles className="w-4 h-4" />
              SiPeNa
            </span>
          )}
        </div>
      </div>
    </>
  )

  return (
    <>
      <button
        onClick={() => setIsMobileMenuOpen(true)}
        className={cn(
          "xl:hidden fixed top-4 left-4 z-50 flex items-center gap-2 px-3 py-2 bg-card border border-border rounded-lg shadow-md hover:bg-muted transition-colors",
          isMobileMenuOpen && "hidden",
        )}
        aria-label="Open menu"
      >
        <Menu className="w-6 h-6 text-foreground" />
        <Image
          src="/images/logo-RS.png"
          alt="Logo Kemenkes RS Persahabatan"
          width={90}
          height={24}
          className="object-contain"
          style={{ width: "auto", height: "auto" }}
          priority
        />
      </button>

      <div className={cn("xl:hidden fixed inset-0 z-40 flex", isMobileMenuOpen ? "pointer-events-auto" : "pointer-events-none")}
      >
        <div
          className={cn("absolute inset-0 bg-black/60 z-40 transition-opacity duration-300", 
            isMobileMenuOpen ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
          onClick={closeMobileMenu}
          role="presentation"
        />
        <aside
          className={cn(
            "relative h-svh min-h-svh w-[min(88vw,22rem)] max-w-88 overflow-y-auto bg-card flex flex-col transform transition-transform duration-300 ease-in-out z-50",
            isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          )}
          style={{ minWidth: 0 }}
          role="dialog"
          aria-modal="true"
          aria-label="Menu navigasi"
        >
          <button
            onClick={closeMobileMenu}
            className="absolute top-4 right-4 p-2 hover:bg-muted rounded-lg transition-colors z-40"
            aria-label="Close menu"
          >
            <X className="w-5 h-5 text-foreground" />
          </button>
          <SidebarContent />
        </aside>
      </div>

      <aside
        className={cn(
          "relative shrink-0 border-r border-border bg-card h-dvh flex-col overflow-y-scroll overscroll-contain [scrollbar-gutter:stable] [scrollbar-width:thin] [scrollbar-color:rgb(13_148_136)_transparent] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-teal-500/70 [&::-webkit-scrollbar-track]:bg-transparent transition-all duration-300 ease-in-out xl:fixed xl:inset-y-0 xl:left-0 xl:z-40",
          "hidden xl:flex",
          isCollapsed ? "w-20" : "w-64"
        )}
      >
        <SidebarContent />
      </aside>
    </>
  )
}
