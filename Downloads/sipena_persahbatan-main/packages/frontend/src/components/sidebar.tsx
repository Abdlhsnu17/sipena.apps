"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import type { LucideIcon } from "lucide-react"

import type { User } from "@/services/auth.service"
import authService from "@/services/auth.service"
import { cn } from "@/utils"
import { toPublicPhotoUrl } from "@/utils/photoUrl"
import {
    BarChart3,
    Building,
    Calendar,
    ChevronLeft,
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
import { useEffect, useState } from "react"



interface SidebarProps {
  isCollapsed: boolean
  toggleSidebar: () => void
}

type SidebarLink = {
  href: string
  label: string
  icon: LucideIcon
  iconColor?: string
}

export default function Sidebar({ isCollapsed, toggleSidebar }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<User | null>(authService.getCurrentUser())
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [pathname])

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
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isMobileMenuOpen])

  const fullAccessLinks: SidebarLink[] = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard, iconColor: "text-black" },
    { href: "/uml", label: "Dokumentasi & Unggahan", icon: FileText, iconColor: "text-slate-500" },
    { href: "/features", label: "Pemeliharaan", icon: Wrench, iconColor: "text-teal-700" },
    { href: "/medical-assets", label: "Inventaris Medis", icon: Stethoscope, iconColor: "text-cyan-600" },
    { href: "/non-medical-assets", label: "Inventaris Non-Medis", icon: Building, iconColor: "text-teal-600" },
    { href: "/maintenance", label: "Jadwal Pemeliharaan", icon: Calendar, iconColor: "text-red-600" },
    { href: "/reports", label: "Laporan", icon: BarChart3, iconColor: "text-purple-600" },
    { href: "/users", label: "Manajemen Pengguna", icon: Users, iconColor: "text-yellow-500" },
    { href: "/borrowing", label: "Peminjaman Alat", icon: HandHelping, iconColor: "text-amber-600" },
    { href: "/settings", label: "Pengaturan", icon: Settings, iconColor: "text-orange-700" },
    { href: "/returns", label: "Pengembalian Alat", icon: RotateCcw, iconColor: "text-green-600" },
  ].sort((a, b) => a.label.localeCompare(b.label, 'id'))

  const staffLinks: SidebarLink[] = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard, iconColor: "text-black" },
    { href: "/uml", label: "Dokumentasi & Unggahan", icon: FileText, iconColor: "text-slate-500" },
    { href: "/features", label: "Pemeliharaan", icon: Wrench, iconColor: "text-teal-700" },
    { href: "/medical-assets", label: "Inventaris Medis", icon: Stethoscope, iconColor: "text-cyan-600" },
    { href: "/non-medical-assets", label: "Inventaris Non-Medis", icon: Building, iconColor: "text-teal-600" },
    { href: "/maintenance", label: "Jadwal Pemeliharaan", icon: Calendar, iconColor: "text-red-600" },
    { href: "/borrowing", label: "Peminjaman Alat", icon: HandHelping, iconColor: "text-amber-600" },
    { href: "/settings", label: "Pengaturan", icon: Settings, iconColor: "text-orange-700" },
    { href: "/returns", label: "Pengembalian Alat", icon: RotateCcw, iconColor: "text-green-600" },
  ].sort((a, b) => a.label.localeCompare(b.label, 'id'))

  const hasFullAccess = currentUser?.role === "admin" || currentUser?.role === "leader"
  const links = hasFullAccess ? fullAccessLinks : staffLinks

  const cacheKey =
    (currentUser as any)?.updatedAt || currentUser?.lastLogin || currentUser?.createdAt || Date.now()
  const profileImageUrl = toPublicPhotoUrl(currentUser?.photoPath, cacheKey)

  const handleLogout = async () => {
    await authService.logout()
    router.push("/login")
  }

  const getRoleLabel = () => {
    switch (currentUser?.role) {
      case "admin":
        return "Administrator"
      case "leader":
        return "Leader"
      default:
        return "Staff"
    }
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
          <p className="text-xs text-muted-foreground mt-2 px-4">
            Sistem Inventaris & Pemeliharaan Sarana Serta Peminjaman
          </p>
        )}
      </div>

      <nav
        className={cn(
          "flex-1 min-h-0 space-y-2 overflow-y-auto",
          isCollapsed ? "p-2" : "p-4",
        )}
      >
        {links.map((link) => {
          const Icon = link.icon
          const isActive = pathname === link.href
          const iconColorClass = isActive ? "text-white" : link.iconColor ?? "text-foreground"
          return (
            <Link key={link.href} href={link.href} onClick={() => setIsMobileMenuOpen(false)}>
              <div
                className={cn(
                  "flex items-center rounded-lg transition-colors",
                  isCollapsed ? "justify-center px-2 py-2" : "gap-3 px-4 py-2",
                  isActive ? "bg-teal-600 text-white" : "text-foreground hover:bg-muted",
                )}
                title={link.label}
              >
                <Icon className={cn(isCollapsed ? "w-5 h-5" : "w-4 h-4", iconColorClass)} />
                {isCollapsed ? (
                  <span className="sr-only">{link.label}</span>
                ) : (
                  <span className="text-sm font-medium">{link.label}</span>
                )}
              </div>
            </Link>
          )
        })}
      </nav>

      {currentUser && !isCollapsed && (
        <div className="p-4">
          <div className="rounded-2xl border border-slate-200/70 bg-white/90 shadow-[0_15px_30px_rgba(15,23,42,0.08)] dark:border-slate-800/70 dark:bg-slate-900/70">
            <div className="flex flex-col gap-3 p-4">
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
              <Button
                variant="outline"
                size="sm"
                className="text-xs font-semibold uppercase tracking-[0.4em]"
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

      <div className={cn("lg:hidden fixed inset-0 z-50 flex pointer-events-none", isMobileMenuOpen && "pointer-events-auto")}
        style={{ display: isMobileMenuOpen ? 'flex' : 'none' }}
      >
        <div
          className="absolute inset-0 bg-black/60"
          onClick={() => setIsMobileMenuOpen(false)}
        />
        <aside
          className={cn(
          "relative w-full max-w-full h-full bg-card flex flex-col transform transition-transform duration-300 ease-in-out",
            isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          )}
          style={{ minWidth: 0 }}
        >
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="absolute top-4 right-4 p-2 hover:bg-muted rounded-lg transition-colors z-10"
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
