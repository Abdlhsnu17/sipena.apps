"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import type { LucideIcon } from "lucide-react"

import type { User } from "@/services/auth.service"
import authService from "@/services/auth.service"
import userActivityService, { type UserActivity } from "@/services/user-activity.service"
import { cn } from "@/utils"
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
  Wrench,
  X
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"



interface SidebarProps {
  isCollapsed: boolean
  toggleSidebar: () => void
}

type SidebarLink = {
  href: string
  label: string
  icon: LucideIcon
  iconColor?: string
  searchKeywords?: string[]
}

const featureLabelMap: Record<string, string> = {
  unggahan: "Unggahan",
  jadwal_pemeliharaan: "Jadwal Pemeliharaan",
  pemeliharaan: "Pemeliharaan",
  peminjaman_alat: "Peminjaman Alat",
  pengembalian_alat: "Pengembalian Alat",
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
        setRecentActivities(response.data)
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
      if (window.innerWidth >= 1024) {
        closeMobileMenu()
      }
    }
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
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
    { href: "/uml", label: "Dokumentasi & Unggahan", icon: FileText, iconColor: "text-slate-500", searchKeywords: ["dokumentasi", "unggahan", "arsip"] },
    { href: "/features", label: "Pemeliharaan", icon: Wrench, iconColor: "text-teal-700", searchKeywords: ["fitur", "maintenance"] },
    { href: "/medical-assets", label: "Inventaris Medis", icon: Stethoscope, iconColor: "text-cyan-600", searchKeywords: ["medis", "alat medis", "inventaris medis"] },
    { href: "/non-medical-assets", label: "Inventaris Non-Medis", icon: Building, iconColor: "text-teal-600", searchKeywords: ["non medis", "sarana", "prasarana"] },
    { href: "/maintenance", label: "Jadwal Pemeliharaan", icon: Calendar, iconColor: "text-red-600", searchKeywords: ["jadwal", "maintenance", "perawatan"] },
    { href: "/reports", label: "Laporan", icon: BarChart3, iconColor: "text-purple-600", searchKeywords: ["report", "analitik", "rekap"] },
    { href: "/users", label: "Manajemen Pengguna", icon: Users, iconColor: "text-yellow-500", searchKeywords: ["pengguna", "user", "nip", "nik", "akun"] },
    { href: "/borrowing", label: "Peminjaman Alat", icon: HandHelping, iconColor: "text-amber-600", searchKeywords: ["pinjam", "peminjaman", "borrow"] },
    { href: "/settings", label: "Pengaturan", icon: Settings, iconColor: "text-orange-700", searchKeywords: ["setting", "settings", "akun", "profil", "nip", "nik", "password", "tema"] },
    { href: "/returns", label: "Pengembalian Alat", icon: RotateCcw, iconColor: "text-green-600", searchKeywords: ["kembali", "pengembalian", "return"] },
  ].sort((a, b) => a.label.localeCompare(b.label, 'id'))

  const staffLinks: SidebarLink[] = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard, iconColor: "text-black", searchKeywords: ["beranda", "home", "ringkasan"] },
    { href: "/uml", label: "Dokumentasi & Unggahan", icon: FileText, iconColor: "text-slate-500", searchKeywords: ["dokumentasi", "unggahan", "arsip"] },
    { href: "/features", label: "Pemeliharaan", icon: Wrench, iconColor: "text-teal-700", searchKeywords: ["fitur", "maintenance"] },
    { href: "/maintenance", label: "Jadwal Pemeliharaan", icon: Calendar, iconColor: "text-red-600", searchKeywords: ["jadwal", "maintenance", "perawatan"] },
    { href: "/reports", label: "Laporan", icon: BarChart3, iconColor: "text-purple-600", searchKeywords: ["report", "analitik", "rekap"] },
    { href: "/borrowing", label: "Peminjaman Alat", icon: HandHelping, iconColor: "text-amber-600", searchKeywords: ["pinjam", "peminjaman", "borrow"] },
    { href: "/returns", label: "Pengembalian Alat", icon: RotateCcw, iconColor: "text-green-600", searchKeywords: ["kembali", "pengembalian", "return"] },
    { href: "/settings", label: "Pengaturan", icon: Settings, iconColor: "text-orange-700", searchKeywords: ["setting", "settings", "akun", "profil", "nip", "nik", "password", "tema"] },
  ].sort((a, b) => a.label.localeCompare(b.label, 'id'))

  const staffPjLinks: SidebarLink[] = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard, iconColor: "text-black", searchKeywords: ["beranda", "home", "ringkasan"] },
    { href: "/uml", label: "Dokumentasi & Unggahan", icon: FileText, iconColor: "text-slate-500", searchKeywords: ["dokumentasi", "unggahan", "arsip"] },
    { href: "/features", label: "Pemeliharaan", icon: Wrench, iconColor: "text-teal-700", searchKeywords: ["fitur", "maintenance"] },
    { href: "/medical-assets", label: "Inventaris Medis", icon: Stethoscope, iconColor: "text-cyan-600", searchKeywords: ["medis", "alat medis", "inventaris medis"] },
    { href: "/non-medical-assets", label: "Inventaris Non-Medis", icon: Building, iconColor: "text-teal-600", searchKeywords: ["non medis", "sarana", "prasarana"] },
    { href: "/maintenance", label: "Jadwal Pemeliharaan", icon: Calendar, iconColor: "text-red-600", searchKeywords: ["jadwal", "maintenance", "perawatan"] },
    { href: "/reports", label: "Laporan", icon: BarChart3, iconColor: "text-purple-600", searchKeywords: ["report", "analitik", "rekap"] },
    { href: "/borrowing", label: "Peminjaman Alat", icon: HandHelping, iconColor: "text-amber-600", searchKeywords: ["pinjam", "peminjaman", "borrow"] },
    { href: "/returns", label: "Pengembalian Alat", icon: RotateCcw, iconColor: "text-green-600", searchKeywords: ["kembali", "pengembalian", "return"] },
    { href: "/settings", label: "Pengaturan", icon: Settings, iconColor: "text-orange-700", searchKeywords: ["setting", "settings", "akun", "profil", "nip", "nik", "password", "tema"] },
  ].sort((a, b) => a.label.localeCompare(b.label, 'id'))

  const technicianLinks: SidebarLink[] = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard, iconColor: "text-black", searchKeywords: ["beranda", "home", "ringkasan"] },
    { href: "/uml", label: "Dokumentasi & Unggahan", icon: FileText, iconColor: "text-slate-500", searchKeywords: ["dokumentasi", "unggahan", "arsip"] },
    { href: "/features", label: "Pemeliharaan", icon: Wrench, iconColor: "text-teal-700", searchKeywords: ["fitur", "maintenance"] },
    { href: "/maintenance", label: "Jadwal Pemeliharaan", icon: Calendar, iconColor: "text-red-600", searchKeywords: ["jadwal", "maintenance", "perawatan"] },
    { href: "/settings", label: "Pengaturan", icon: Settings, iconColor: "text-orange-700", searchKeywords: ["setting", "settings", "akun", "profil", "nip", "nik", "password", "tema"] },
  ].sort((a, b) => a.label.localeCompare(b.label, 'id'))

  const userLinks: SidebarLink[] = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard, iconColor: "text-black", searchKeywords: ["beranda", "home", "ringkasan"] },
    { href: "/uml", label: "Dokumentasi UML", icon: FileText, iconColor: "text-slate-500", searchKeywords: ["dokumentasi", "uml", "arsip"] },
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
    router.push("/login")
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
          <div className="hidden lg:flex flex-col items-center gap-3">
            <Image
              src="/images/logo-RS.png"
              alt="Logo Kemenkes RS Persahabatan"
              width={56}
              height={56}
              className="h-10 w-auto object-contain drop-shadow-sm"
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
                priority
              />
            </div>
            <button
              onClick={toggleSidebar}
              className="hidden lg:block p-2 hover:bg-muted rounded-lg"
              aria-label="Tutup sidebar"
              title="Tutup sidebar"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          </div>
        )}
        {!isCollapsed && (
          <p className="text-xs text-muted-foreground mt-2 px-4 font-bold">
            Sistem Inventaris & Peminjaman Serta Pemeliharaan Sarana Prasarana
          </p>
        )}
      </div>

      <nav
        className={cn(
          "flex-1 min-h-0 space-y-2 overflow-y-auto",
          isCollapsed ? "p-2" : "p-4",
        )}
      >
        {visibleLinks.map((link) => {
            const Icon = link.icon
            const isActive = isLinkActive(link.href)
            const iconColorClass = isActive ? "text-white" : link.iconColor ?? "text-foreground"
            const isVisualAdjustedIcon = link.href === "/borrowing" || link.href === "/settings"
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
            <button
              onClick={() => setIsActivityHistoryExpanded(!isActivityHistoryExpanded)}
              className="w-full flex items-center justify-between gap-2 border-b border-slate-200/70 px-4 py-2 dark:border-slate-800/70 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Clock3 className="h-3.5 w-3.5 text-teal-600" />
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-600 dark:text-slate-300">
                  Riwayat Aktivitas
                </p>
              </div>
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 text-teal-600 transition-transform duration-300",
                  isActivityHistoryExpanded ? "rotate-0" : "-rotate-90"
                )}
              />
            </button>
            <div
              className={cn(
                "transition-all duration-300 ease-in-out overflow-hidden",
                isActivityHistoryExpanded ? "max-h-52 overflow-y-auto" : "max-h-0"
              )}
            >
              <div className="px-3 py-2">
                {recentActivities.length === 0 ? (
                  <p className="py-3 text-center text-xs text-muted-foreground">Belum ada aktivitas tercatat.</p>
                ) : (
                  <div className="space-y-2">
                    {recentActivities.map((activity) => (
                      <div
                        key={activity.id}
                        className="rounded-xl border border-slate-200/70 bg-white/90 px-3 py-2 dark:border-slate-800/70 dark:bg-slate-900/60"
                      >
                        <p className="text-[11px] font-semibold text-teal-700 dark:text-teal-300">
                          {featureLabelMap[activity.feature] || activity.feature}
                        </p>
                        <p className="text-xs leading-snug text-foreground">{activity.description}</p>
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
          "lg:hidden fixed top-4 left-4 z-50 flex items-center gap-2 px-3 py-2 bg-card border border-border rounded-lg shadow-md hover:bg-muted transition-colors",
          isMobileMenuOpen && "hidden",
        )}
        aria-label="Open menu"
      >
        <Menu className="w-6 h-6 text-foreground" />
        <Image
          src="/images/logo-RS.png"
          alt="Logo Kemenkes RS Persahabatan"
          width={120}
          height={32}
          className="h-6 w-auto object-contain"
          priority
        />
      </button>

      <div className={cn("lg:hidden fixed inset-0 z-40 flex", isMobileMenuOpen ? "pointer-events-auto" : "pointer-events-none")}
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
            "relative h-full w-[88vw] min-w-[16rem] max-w-88 overflow-y-auto bg-card flex flex-col transform transition-transform duration-300 ease-in-out z-50",
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
        "hidden lg:flex bg-card h-screen lg:sticky lg:top-0 flex-col transition-all duration-300 ease-in-out",
          isCollapsed ? "w-20" : "w-64"
        )}
      >
        <SidebarContent />
      </aside>
    </>
  )
}
