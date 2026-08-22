"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import BrandLogo from "@/components/layout/brand-logo";
import accessControlService, { type AccessMenu } from "@/services/access-control.service";
import { buildLoginRedirectUrl, isLocalAuthSession } from "@/services/auth-utils";
import type { User } from "@/services/auth.service";
import authService from "@/services/auth.service";
import userActivityService, { type UserActivity } from "@/services/user-activity.service";
import { cn } from "@/utils";
import { getFeatureLabel } from "@/utils/feature-presentation";
import { toPublicPhotoUrl } from "@/utils/photo-url";
import { getUserRoleLabel, isAdminOrLeaderRole, isStaffPjRole, isTechnicianRole, isUserRole } from "@/utils/role";
import {
    Archive,
    BarChart3,
    Building,
    Calendar,
    ChevronDown,
    ClipboardList,
    Clock3,
    FileUp,
    FileText,
    HandHelping,
    LayoutDashboard,
    ListChecks,
    LogOut,
    Menu,
    PanelLeftClose,
    PanelLeftOpen,
    RotateCcw,
    Settings,
    Shield,
    Sparkles,
    Trash2,
    Stethoscope,
    Users,
    X
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useState, type ComponentType, type MouseEvent, type SyntheticEvent } from "react";



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

const featureIconColor = "text-teal-600"
const SIDEBAR_NAV_SCROLL_KEY = "sipena-sidebar-nav-scroll-top"
const sortSidebarLinksByLabel = (links: SidebarLink[]) => [...links].sort((a, b) => a.label.localeCompare(b.label, "id"))

const isVisibleElement = (element: HTMLElement) => {
  if (typeof window === "undefined") return false
  const style = window.getComputedStyle(element)
  return style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0
}

const getVisibleSidebarNavElements = () => {
  if (typeof document === "undefined") return []
  return Array.from(document.querySelectorAll<HTMLElement>("[data-sidebar-nav]")).filter(isVisibleElement)
}

const getSavedSidebarScrollTop = () => {
  if (typeof window === "undefined") return null
  const savedScrollTopValue = window.sessionStorage.getItem(SIDEBAR_NAV_SCROLL_KEY)
  if (savedScrollTopValue === null) return null

  const savedScrollTop = Number(savedScrollTopValue)
  return Number.isFinite(savedScrollTop) ? savedScrollTop : null
}

const restoreVisibleSidebarScrollTop = () => {
  const savedScrollTop = getSavedSidebarScrollTop()
  if (savedScrollTop === null) return

  getVisibleSidebarNavElements().forEach((navElement) => {
    navElement.scrollTop = savedScrollTop
  })
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
  const [profileImageError, setProfileImageError] = useState(false)
  const [recentActivities, setRecentActivities] = useState<UserActivity[]>([])
  const [allowedMenus, setAllowedMenus] = useState<AccessMenu[] | null>(null)
  const [isActivityHistoryExpanded, setIsActivityHistoryExpanded] = useState(() => {
    if (typeof window === "undefined") return false
    const saved = localStorage.getItem("sidebar-activity-expanded")
    return saved !== null ? JSON.parse(saved) : false
  })
  const [isProfileExpanded, setIsProfileExpanded] = useState(() => {
    if (typeof window === "undefined") return false
    const saved = localStorage.getItem("sidebar-profile-expanded")
    return saved !== null ? JSON.parse(saved) : false
  })
  const closeMobileMenu = useCallback(() => {
    setIsMobileMenuOpen(false)
  }, [])

  useEffect(() => {
    closeMobileMenu()
  }, [closeMobileMenu, pathname])

  useLayoutEffect(() => {
    if (typeof window === "undefined") return

    restoreVisibleSidebarScrollTop()

    const animationFrameId = window.requestAnimationFrame(() => {
      restoreVisibleSidebarScrollTop()
    })
    const timeoutId = window.setTimeout(() => {
      restoreVisibleSidebarScrollTop()
    }, 80)

    return () => {
      window.cancelAnimationFrame(animationFrameId)
      window.clearTimeout(timeoutId)
    }
  }, [pathname, isCollapsed, isMobileMenuOpen])

  const loadActivities = useCallback(async () => {
    if (!currentUser?.id) {
      setRecentActivities([])
      return
    }
    if (isLocalAuthSession()) {
      setRecentActivities([])
      return
    }
    try {
      const response = await userActivityService.getMyActivities(10)
      if (response.success) {
        setRecentActivities(response.data.filter((activity) => !isSearchActivity(activity)))
      }
    } catch (error) {
      console.error("Failed to load user activities:", error)
    }
  }, [currentUser?.id])

  useEffect(() => {
    const handler = () => {
      setCurrentUser(authService.getCurrentUser())
      setProfileImageError(false)
    }
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
      if (window.innerWidth >= 768) {
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
    if (!currentUser?.id || isLocalAuthSession()) {
      setAllowedMenus(null)
      return
    }

    let isMounted = true
    accessControlService.getMyMenus()
      .then((response) => {
        if (isMounted && response.success) {
          setAllowedMenus(response.data)
        }
      })
      .catch((error) => {
        console.error("Failed to load role menus:", error)
        if (isMounted) setAllowedMenus(null)
      })

    return () => {
      isMounted = false
    }
  }, [currentUser?.id, currentUser?.role])

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
    { href: "/uml", label: "Dokumentasi Sistem", icon: FileText, iconColor: "text-slate-500", searchKeywords: ["dokumentasi", "sistem", "uml", "panduan", "alur"] },
    { href: "/medical-assets", label: "Inventaris Medis", icon: Stethoscope, iconColor: "text-cyan-600", searchKeywords: ["medis", "alat medis", "inventaris medis"] },
    { href: "/non-medical-assets", label: "Inventaris Non-Medis", icon: Building, iconColor: "text-teal-600", searchKeywords: ["non medis", "sarana", "prasarana"] },
    { href: "/maintenance", label: "Pemeliharaan Sarana", icon: Calendar, iconColor: "text-teal-600", searchKeywords: ["jadwal", "maintenance", "perawatan", "pemeliharaan"] },
    { href: "/dss", label: "SPK Prioritas Aset", icon: ListChecks, iconColor: "text-indigo-600", searchKeywords: ["spk", "dss", "ahp", "topsis", "prioritas", "ranking"] },
    { href: "/asset-usage", label: "Penggunaan", icon: ClipboardList, iconColor: "text-emerald-600", searchKeywords: ["penggunaan", "pemakaian", "alat", "inventaris", "ruangan", "log"] },
    { href: "/reports", label: "Laporan & Analitik", icon: BarChart3, iconColor: "text-purple-600", searchKeywords: ["report", "analitik", "rekap"] },
    { href: "/unggahan", label: "Unggah Dokumen", icon: FileUp, iconColor: featureIconColor, searchKeywords: ["unggah", "upload", "dokumen", "berkas", "arsip"] },
    { href: "/activity-archive", label: "Arsip & Riwayat", icon: Archive, iconColor: "text-slate-600", searchKeywords: ["arsip", "aktivitas", "riwayat", "penggunaan", "peminjaman"] },
    { href: "/users", label: "Manajemen Pengguna", icon: Users, iconColor: "text-amber-600", searchKeywords: ["pengguna", "user", "nip", "nik", "akun"] },
    { href: "/borrowing", label: "Peminjaman", icon: HandHelping, iconColor: "text-amber-600", searchKeywords: ["pinjam", "peminjaman", "borrow"] },
    { href: "/sanctions", label: "Manajemen Sanksi", icon: Shield, iconColor: "text-red-600", searchKeywords: ["sanksi", "denda", "overdue", "terlambat", "penalti"] },
    { href: "/disposal", label: "Penghapusan Aset", icon: Trash2, iconColor: "text-destructive", searchKeywords: ["hapus", "disposal", "penghapusan", "scrapping"] },
    { href: "/settings", label: "Pengaturan", icon: Settings, iconColor: "text-orange-700", searchKeywords: ["setting", "settings", "akun", "profil", "nip", "nik", "password", "tema"] },
    { href: "/returns", label: "Pengembalian", icon: RotateCcw, iconColor: featureIconColor, searchKeywords: ["kembali", "pengembalian", "return"] },
  ].sort((a, b) => a.label.localeCompare(b.label, 'id'))

  const staffLinks: SidebarLink[] = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard, iconColor: "text-black", searchKeywords: ["beranda", "home", "ringkasan"] },
    { href: "/uml", label: "Dokumentasi Sistem", icon: FileText, iconColor: "text-slate-500", searchKeywords: ["dokumentasi", "sistem", "uml", "panduan", "alur"] },
    { href: "/medical-assets", label: "Inventaris Medis", icon: Stethoscope, iconColor: "text-cyan-600", searchKeywords: ["medis", "alat medis", "inventaris medis"] },
    { href: "/non-medical-assets", label: "Inventaris Non-Medis", icon: Building, iconColor: "text-teal-600", searchKeywords: ["non medis", "sarana", "prasarana"] },
    { href: "/maintenance", label: "Pemeliharaan Sarana", icon: Calendar, iconColor: "text-teal-600", searchKeywords: ["jadwal", "maintenance", "perawatan", "pemeliharaan"] },
    { href: "/dss", label: "SPK Prioritas Aset", icon: ListChecks, iconColor: "text-indigo-600", searchKeywords: ["spk", "dss", "ahp", "topsis", "prioritas", "ranking"] },
    { href: "/asset-usage", label: "Penggunaan", icon: ClipboardList, iconColor: "text-emerald-600", searchKeywords: ["penggunaan", "pemakaian", "alat", "inventaris", "ruangan", "log"] },
    { href: "/reports", label: "Laporan & Analitik", icon: BarChart3, iconColor: "text-purple-600", searchKeywords: ["report", "analitik", "rekap"] },
    { href: "/unggahan", label: "Unggah Dokumen", icon: FileUp, iconColor: featureIconColor, searchKeywords: ["unggah", "upload", "dokumen", "berkas", "arsip"] },
    { href: "/activity-archive", label: "Arsip & Riwayat", icon: Archive, iconColor: "text-slate-600", searchKeywords: ["arsip", "aktivitas", "riwayat", "penggunaan", "peminjaman"] },
    { href: "/borrowing", label: "Peminjaman", icon: HandHelping, iconColor: "text-amber-600", searchKeywords: ["pinjam", "peminjaman", "borrow"] },
    { href: "/returns", label: "Pengembalian", icon: RotateCcw, iconColor: featureIconColor, searchKeywords: ["kembali", "pengembalian", "return"] },
    { href: "/settings", label: "Pengaturan", icon: Settings, iconColor: "text-orange-700", searchKeywords: ["setting", "settings", "akun", "profil", "nip", "nik", "password", "tema"] },
  ].sort((a, b) => a.label.localeCompare(b.label, 'id'))

  const staffPjLinks: SidebarLink[] = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard, iconColor: "text-black", searchKeywords: ["beranda", "home", "ringkasan"] },
    { href: "/uml", label: "Dokumentasi Sistem", icon: FileText, iconColor: "text-slate-500", searchKeywords: ["dokumentasi", "sistem", "uml", "panduan", "alur"] },
    { href: "/medical-assets", label: "Inventaris Medis", icon: Stethoscope, iconColor: "text-cyan-600", searchKeywords: ["medis", "alat medis", "inventaris medis"] },
    { href: "/non-medical-assets", label: "Inventaris Non-Medis", icon: Building, iconColor: "text-teal-600", searchKeywords: ["non medis", "sarana", "prasarana"] },
    { href: "/maintenance", label: "Pemeliharaan Sarana", icon: Calendar, iconColor: "text-teal-600", searchKeywords: ["jadwal", "maintenance", "perawatan", "pemeliharaan"] },
    { href: "/dss", label: "SPK Prioritas Aset", icon: ListChecks, iconColor: "text-indigo-600", searchKeywords: ["spk", "dss", "ahp", "topsis", "prioritas", "ranking"] },
    { href: "/asset-usage", label: "Penggunaan", icon: ClipboardList, iconColor: "text-emerald-600", searchKeywords: ["penggunaan", "pemakaian", "alat", "inventaris", "ruangan", "log"] },
    { href: "/reports", label: "Laporan & Analitik", icon: BarChart3, iconColor: "text-purple-600", searchKeywords: ["report", "analitik", "rekap"] },
    { href: "/unggahan", label: "Unggah Dokumen", icon: FileUp, iconColor: featureIconColor, searchKeywords: ["unggah", "upload", "dokumen", "berkas", "arsip"] },
    { href: "/activity-archive", label: "Arsip & Riwayat", icon: Archive, iconColor: "text-slate-600", searchKeywords: ["arsip", "aktivitas", "riwayat", "penggunaan", "peminjaman"] },
    { href: "/borrowing", label: "Peminjaman", icon: HandHelping, iconColor: "text-amber-600", searchKeywords: ["pinjam", "peminjaman", "borrow"] },
    { href: "/returns", label: "Pengembalian", icon: RotateCcw, iconColor: featureIconColor, searchKeywords: ["kembali", "pengembalian", "return"] },
    { href: "/settings", label: "Pengaturan", icon: Settings, iconColor: "text-orange-700", searchKeywords: ["setting", "settings", "akun", "profil", "nip", "nik", "password", "tema"] },
  ].sort((a, b) => a.label.localeCompare(b.label, 'id'))

  const technicianLinks: SidebarLink[] = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard, iconColor: "text-black", searchKeywords: ["beranda", "home", "ringkasan"] },
    { href: "/uml", label: "Dokumentasi Sistem", icon: FileText, iconColor: "text-slate-500", searchKeywords: ["dokumentasi", "sistem", "uml", "panduan", "alur"] },
    { href: "/maintenance", label: "Pemeliharaan Sarana", icon: Calendar, iconColor: "text-red-600", searchKeywords: ["jadwal", "maintenance", "perawatan", "pemeliharaan"] },
    { href: "/dss", label: "SPK Prioritas Aset", icon: ListChecks, iconColor: "text-indigo-600", searchKeywords: ["spk", "dss", "ahp", "topsis", "prioritas", "ranking"] },
    { href: "/reports", label: "Laporan & Analitik", icon: BarChart3, iconColor: "text-purple-600", searchKeywords: ["report", "analitik", "rekap"] },
    { href: "/unggahan", label: "Unggah Dokumen", icon: FileUp, iconColor: featureIconColor, searchKeywords: ["unggah", "upload", "dokumen", "berkas", "arsip"] },
    { href: "/activity-archive", label: "Arsip & Riwayat", icon: Archive, iconColor: "text-slate-600", searchKeywords: ["arsip", "aktivitas", "riwayat", "penggunaan", "peminjaman"] },
    { href: "/settings", label: "Pengaturan", icon: Settings, iconColor: "text-orange-700", searchKeywords: ["setting", "settings", "akun", "profil", "nip", "nik", "password", "tema"] },
  ].sort((a, b) => a.label.localeCompare(b.label, 'id'))

  const userLinks: SidebarLink[] = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard, iconColor: "text-black", searchKeywords: ["beranda", "home", "ringkasan"] },
    { href: "/uml", label: "Dokumentasi Sistem", icon: FileText, iconColor: "text-slate-500", searchKeywords: ["dokumentasi", "sistem", "uml", "panduan", "alur"] },
    { href: "/medical-assets", label: "Inventaris Medis", icon: Stethoscope, iconColor: "text-cyan-600", searchKeywords: ["medis", "alat medis", "inventaris medis"] },
    { href: "/non-medical-assets", label: "Inventaris Non-Medis", icon: Building, iconColor: "text-teal-600", searchKeywords: ["non medis", "sarana", "prasarana"] },
    { href: "/dss", label: "SPK Prioritas Aset", icon: ListChecks, iconColor: "text-indigo-600", searchKeywords: ["spk", "dss", "ahp", "topsis", "prioritas", "ranking"] },
    { href: "/asset-usage", label: "Penggunaan", icon: ClipboardList, iconColor: "text-emerald-600", searchKeywords: ["penggunaan", "pemakaian", "alat", "inventaris", "ruangan", "log"] },
    { href: "/reports", label: "Laporan & Analitik", icon: BarChart3, iconColor: "text-purple-600", searchKeywords: ["report", "analitik", "rekap"] },
    { href: "/unggahan", label: "Unggah Dokumen", icon: FileUp, iconColor: featureIconColor, searchKeywords: ["unggah", "upload", "dokumen", "berkas", "arsip"] },
    { href: "/activity-archive", label: "Arsip & Riwayat", icon: Archive, iconColor: "text-slate-600", searchKeywords: ["arsip", "aktivitas", "riwayat", "penggunaan", "peminjaman"] },
    { href: "/borrowing", label: "Peminjaman", icon: HandHelping, iconColor: "text-amber-600", searchKeywords: ["pinjam", "peminjaman", "borrow"] },
    { href: "/returns", label: "Pengembalian", icon: RotateCcw, iconColor: featureIconColor, searchKeywords: ["kembali", "pengembalian", "return"] },
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
  const allowedPaths = allowedMenus
    ? new Set(allowedMenus.map((menu) => menu.path))
    : null
  const visibleLinks = allowedPaths
    ? sortSidebarLinksByLabel(fullAccessLinks.filter((link) => allowedPaths.has(link.href)))
    : links

  const saveSidebarScrollTop = useCallback((scrollTop: number) => {
    if (typeof window === "undefined") return
    window.sessionStorage.setItem(SIDEBAR_NAV_SCROLL_KEY, String(scrollTop))
  }, [])

  const handleLinkClick = useCallback((event?: MouseEvent<HTMLAnchorElement>) => {
    const navElement =
      event?.currentTarget.closest<HTMLElement>("[data-sidebar-nav]") ??
      getVisibleSidebarNavElements()[0]
    if (navElement && isVisibleElement(navElement)) {
      saveSidebarScrollTop(navElement.scrollTop)
    }

    // Next/Link tidak mengatur ulang elemen scroll kustom ketika `scroll={false}`.
    // Jika menu yang sedang aktif diklik lagi, kembalikan konten ke awal agar
    // halaman tidak terbuka dari posisi scroll lama (terlihat seperti terpotong).
    if (event && new URL(event.currentTarget.href).pathname === pathname) {
      const mainScroll = document.querySelector<HTMLElement>("[data-main-scroll]")
      mainScroll?.scrollTo({ top: 0, left: 0, behavior: "auto" })
    }

    closeMobileMenu()
  }, [closeMobileMenu, pathname, saveSidebarScrollTop])

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

  const handleProfileImageError = (error: SyntheticEvent<HTMLImageElement, Event>) => {
    console.error('[Sidebar] Profile image failed to load:', error)
    setProfileImageError(true)
  }

  const handleLogout = async () => {
    await authService.logout()
    router.replace(buildLoginRedirectUrl())
  }

  const getRoleLabel = () => {
    return getUserRoleLabel(currentUser?.role)
  }

  const getCompactRoleLabel = () => {
    const label = getRoleLabel()
    const compactRoleMap: Record<string, string> = {
      Administrator: "Admin",
      "Staff Pelayanan": "Staff",
      "Staff PJ": "Staff PJ",
      "Kepala Unit": "Leader",
    }

    return compactRoleMap[label] ?? label
  }

  const getInitials = () => {
    const name = (currentUser?.name ?? "").trim()
    if (!name) return "U"
    const parts = name.split(/\s+/).filter(Boolean)
    const first = parts[0]?.[0] ?? ""
    const second = parts.length > 1 ? parts[1]?.[0] ?? "" : ""
    return (first + second).toUpperCase()
  }

  const renderSidebarContent = ({ collapsed = isCollapsed }: { collapsed?: boolean } = {}) => (
    <>
      <div className="border-b border-border bg-(--app-shell-background) px-4 py-3">
        {collapsed ? (
          <div className="hidden flex-col items-center gap-3 md:flex">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden">
              <BrandLogo
                width={48}
                height={28}
                className="h-auto w-12 object-contain"
                priority
              />
            </div>
            <button
              onClick={toggleSidebar}
              className="rounded-lg border border-border/70 bg-background/80 p-2.5 shadow-sm transition-colors hover:bg-muted"
              aria-label="Buka sidebar"
              title="Buka sidebar"
            >
              <PanelLeftOpen className="h-5 w-5 text-foreground" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center">
              <div className="relative h-14 min-w-0 flex-1 overflow-hidden">
                <BrandLogo
                width={170}
                height={96}
                  className="h-auto max-h-14 w-full object-contain object-left"
                priority
              />
              </div>
            </div>
            <button
              onClick={toggleSidebar}
              className="hidden shrink-0 rounded-lg border border-border/70 bg-background/80 p-2.5 shadow-sm transition-colors hover:bg-muted md:block"
              aria-label="Tutup sidebar"
              title="Tutup sidebar"
            >
              <PanelLeftClose className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>

      <nav
        data-sidebar-nav
        onScroll={(event) => {
          if (!isVisibleElement(event.currentTarget)) return
          saveSidebarScrollTop(event.currentTarget.scrollTop)
        }}
        className={cn(
          "flex-1 min-h-0 space-y-1.5 overflow-y-auto scrollbar-gutter-stable scrollbar-thin [scrollbar-color:rgb(13_148_136)_transparent] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-teal-500/70 [&::-webkit-scrollbar-track]:bg-transparent",
          collapsed ? "p-2" : "p-3",
        )}
      >
        {visibleLinks.map((link) => {
            const Icon = link.icon
            const isActive = isLinkActive(link.href)
            const iconColorClass = isActive ? "text-white" : featureIconColor
            const iconSizeClass = "w-5 h-5"
            return (
              <Link 
                key={link.href} 
                href={link.href} 
                scroll={false}
                onClick={handleLinkClick}
                aria-current={isActive ? "page" : undefined}
                data-sidebar-link-active={isActive ? "true" : undefined}
                className="block touch-manipulation"
              >
                <div
                  className={cn(
                    "flex items-center rounded-lg transition-colors cursor-pointer select-none",
                    collapsed ? "justify-center px-2 py-2" : "gap-3 px-3 py-2",
                    isActive ? "bg-teal-600 text-white" : "text-foreground hover:bg-muted",
                  )}
                  title={link.label}
                  role="menuitem"
                  onMouseDown={(event) => {
                    event.stopPropagation()
                  }}
                >
                  <Icon className={cn(iconSizeClass, iconColorClass)} />
                  {collapsed ? (
                    <span className="sr-only">{link.label}</span>
                  ) : (
                    <span className="min-w-0 truncate text-[13px] font-semibold leading-tight">{link.label}</span>
                  )}
                </div>
              </Link>
            )
          })}
      </nav>

      {currentUser && !collapsed && (
        <div className="px-3 pb-0 z-0">
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800/35 dark:bg-slate-900/70">
            <div className="w-full border-b border-slate-200/70 px-4 py-2 dark:border-slate-800/35">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-teal-600" />
                  <p className="text-[13px] font-semibold tracking-[0.08em] text-slate-600 dark:text-slate-300">
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
                      "h-5 w-5 transition-transform duration-300",
                      isActivityHistoryExpanded ? "rotate-0" : "-rotate-90"
                    )}
                  />
                </button>
              </div>
              <Link
                href="/activity-archive"
                scroll={false}
                onClick={handleLinkClick}
                className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-800 dark:text-teal-300"
              >
                <Archive className="h-3.5 w-3.5" />
                Lihat Arsip
              </Link>
            </div>
            <div
              className={cn(
                "transition-all duration-300 ease-in-out overflow-hidden scrollbar-thin [scrollbar-color:rgb(13_148_136)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-teal-500/70 [&::-webkit-scrollbar-track]:bg-transparent",
                isActivityHistoryExpanded ? "max-h-64 overflow-y-scroll pr-1" : "max-h-0"
              )}
            >
              <div className="px-2 py-1.5">
                {recentActivities.length === 0 ? (
                  <p className="py-2 text-center text-[13px] text-muted-foreground">Belum ada aktivitas tercatat.</p>
                ) : (
                  <div className="space-y-1.5">
                    {recentActivities.map((activity) => (
                      <div
                        key={activity.id}
                        className="rounded-xl border border-slate-200/70 bg-white/90 px-3 py-2 dark:border-slate-800/35 dark:bg-slate-900/60"
                      >
                        <p className="text-[13px] font-semibold text-teal-700 dark:text-teal-300">
                          {getFeatureLabel(activity.feature)}
                        </p>
                        <p className="text-[13px] leading-snug text-foreground">{formatActivityDescription(activity)}</p>
                        {getActivityItemName(activity) ? (
                          <p className="mt-1 text-[13px] text-slate-700 dark:text-slate-300">
                            Nama Alat: {getActivityItemName(activity)}
                          </p>
                        ) : null}
                        {getActivityItemCode(activity) ? (
                          <p className="mt-1 text-[13px] tracking-[0.08em] text-slate-500 dark:text-slate-400">
                            Kode Barang: {getActivityItemCode(activity)}
                          </p>
                        ) : null}
                        {getActivityTransactionId(activity) ? (
                          <p className="mt-1 text-[13px] tracking-[0.08em] text-slate-500 dark:text-slate-400">
                            No ID: {getActivityTransactionId(activity)}
                          </p>
                        ) : null}
                        <p className="mt-1 text-[13px] tracking-[0.08em] text-muted-foreground">
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


      {currentUser && !collapsed && (
        <div className="px-3 py-2 z-0">
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800/35 dark:bg-slate-900/70">
            <button
              onClick={() => setIsProfileExpanded(!isProfileExpanded)}
              className="w-full flex items-center justify-between gap-2 border-b border-slate-200/70 px-4 py-2 dark:border-slate-800/35 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors rounded-t-lg cursor-pointer"
            >
              <p className="text-[13px] font-semibold tracking-[0.08em] text-slate-600 dark:text-slate-300">
                Profil Akun
              </p>
              <ChevronDown
                className={cn(
                  "h-5 w-5 text-teal-600 transition-transform duration-300",
                  isProfileExpanded ? "rotate-0" : "-rotate-90"
                )}
              />
            </button>
            <div
              className={cn(
                "transition-all duration-300 ease-in-out overflow-hidden",
                isProfileExpanded ? "max-h-80" : "max-h-0"
              )}
            >
              <div className="px-3 py-2.5">
                <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm dark:border-slate-700/35 dark:bg-slate-900/60">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-14 w-14 shrink-0 rounded-full border border-slate-200/70 shadow-sm dark:border-slate-700/35">
                      {profileImageUrl && !profileImageError ? (
                        <AvatarImage src={profileImageUrl} alt={`${currentUser.name} photo`} onError={handleProfileImageError} />
                      ) : null}
                      <AvatarFallback className="text-base font-semibold uppercase text-white dark:text-slate-100">
                        {getInitials()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold leading-tight text-foreground wrap-break-word">{currentUser.name}</p>
                      <div className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-1.5 gap-y-0.5 text-[13px] leading-tight">
                        <span className="text-muted-foreground">NIP</span>
                        <span className="min-w-0 font-semibold text-slate-700 break-all dark:text-slate-200">{currentUser.nip}</span>
                        <span className="text-muted-foreground">Role</span>
                        <span
                          className="min-w-0 font-semibold text-teal-700 wrap-break-word dark:text-teal-300"
                          title={getRoleLabel()}
                        >
                          {getCompactRoleLabel()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="border-t border-slate-200/70 dark:border-slate-800/35 px-3 py-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-center gap-2 text-[13px] font-semibold tracking-[0.08em]"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      )}
      {currentUser && collapsed && (
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
          collapsed ? "flex-col gap-1" : ""
        )}>
          
          {collapsed ? (
            <span
              className="flex items-center justify-center w-8 h-8 bg-teal-100 text-teal-700 rounded-full cursor-pointer hover:bg-teal-200 transition"
              title="SiPeNa"
            >
              <Sparkles className="w-6 h-6" />
            </span>
          ) : (
            <span className="flex items-center gap-1 px-2 py-1 bg-teal-100 text-teal-700 text-[13px] font-medium rounded-full cursor-pointer hover:bg-teal-200 transition">
              <Sparkles className="w-4.5 h-4.5" />
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
          "fixed left-[max(0.75rem,env(safe-area-inset-left))] top-[max(0.75rem,env(safe-area-inset-top))] z-50 flex h-11 w-11 items-center justify-center rounded-lg border border-teal-200 bg-(--app-shell-background) text-foreground shadow-sm backdrop-blur-sm transition-colors duration-300 hover:bg-muted md:hidden",
          isMobileMenuOpen && "hidden",
        )}
        aria-label="Buka menu navigasi"
        title="Buka menu navigasi"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-teal-600 text-white shadow-sm">
          <Menu className="h-5 w-5" />
        </span>
      </button>

      <div className={cn("fixed inset-0 z-40 flex md:hidden", isMobileMenuOpen ? "pointer-events-auto" : "pointer-events-none")}
      >
        <div
          className={cn("absolute inset-0 z-40 bg-black/60 transition-opacity duration-300",
            isMobileMenuOpen ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
          onClick={closeMobileMenu}
          role="presentation"
        />
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex h-dvh min-h-screen w-[min(88vw,21rem)] max-w-84 transform flex-col overflow-hidden bg-(--app-shell-background) transition-transform duration-300 ease-in-out",
            isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          )}
          style={{ minWidth: 0 }}
          role="dialog"
          aria-modal="true"
          aria-label="Menu navigasi"
        >
          <button
            onClick={closeMobileMenu}
            className="absolute right-[max(0.75rem,env(safe-area-inset-right))] top-[max(0.75rem,env(safe-area-inset-top))] z-40 rounded-lg p-2 transition-colors hover:bg-muted"
            aria-label="Close menu"
          >
            <X className="w-5 h-5 text-foreground" />
          </button>
          {isMobileMenuOpen ? renderSidebarContent({ collapsed: false }) : null}
        </aside>
      </div>

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden h-dvh min-h-screen shrink-0 flex-col overflow-hidden bg-(--app-shell-background) shadow-[1px_0_0_rgba(15,23,42,0.06)] overscroll-contain transition-all duration-300 ease-in-out md:flex",
          isCollapsed ? "w-20" : "w-64"
        )}
      >
        {renderSidebarContent()}
      </aside>
    </>
  )
}
