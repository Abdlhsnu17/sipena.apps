"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { assetService, type Asset } from "@/services/asset.service"
import { clearAuthSession, getCurrentUser } from "@/services/auth-utils"
import { borrowingService } from "@/services/borrowing.service"
import { maintenanceService } from "@/services/maintenance.service"
import type { User } from "@/types/auth-types"
import { getSpecificationDetails } from "@/utils/api-mappers"
import { canAccessRoute, normalizeUserRole } from "@/utils/role"
import type { LucideIcon } from "lucide-react"
import { ArrowRight, BarChart3, Building2, FileText, HandHelping, Home, RotateCcw, Settings, Stethoscope, UploadCloud, Wrench } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"

type QuickActionLink = {
  key: string
  label: string
  description: string
  href: string
  icon: LucideIcon
  gradient: string
}

const quickActionLinks: QuickActionLink[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    description: "Kembali ke ringkasan utama.",
    href: "/",
    icon: Home,
    gradient: "from-cyan-500/70 via-blue-500/70 to-indigo-500/60",
  },
  {
    key: "uml",
    label: "Dokumentasi UML",
    description: "Buka panduan diagram UML dan alur teknis.",
    href: "/uml",
    icon: FileText,
    gradient: "from-emerald-500/70 via-teal-500/70 to-blue-500/60",
  },
  {
    key: "medical-assets",
    label: "Tambah Inventaris Medis",
    description: "Masuk ke form input dan edit inventaris medis.",
    href: "/medical-assets",
    icon: Stethoscope,
    gradient: "from-cyan-500/70 via-blue-500/60 to-purple-500/50",
  },
  {
    key: "non-medical-assets",
    label: "Tambah Inventaris Non-Medis",
    description: "Masuk ke form input dan edit inventaris non-medis.",
    href: "/non-medical-assets",
    icon: Building2,
    gradient: "from-teal-500/80 via-cyan-500/70 to-cyan-400/60",
  },
  {
    key: "maintenance-schedule",
    label: "Jadwal Pemeliharaan",
    description: "Buat dan kelola jadwal perawatan aset.",
    href: "/maintenance",
    icon: Wrench,
    gradient: "from-amber-400/70 via-orange-500/70 to-rose-500/50",
  },
  {
    key: "unggahan",
    label: "Unggah Folder",
    description: "Pilih banyak file sekaligus dari satu folder.",
    href: "/unggahan",
    icon: UploadCloud,
    gradient: "from-sky-500/70 via-cyan-500/70 to-teal-400/60",
  },
  {
    key: "reports",
    label: "Laporan",
    description: "Analitik & unggahan PDF/Excel/Word.",
    href: "/reports",
    icon: BarChart3,
    gradient: "from-fuchsia-500/70 via-purple-500/70 to-indigo-500/60",
  },
  {
    key: "maintenance",
    label: "Pemeliharaan",
    description: "Buka ringkasan dan tindak lanjut proses pemeliharaan.",
    href: "/features",
    icon: Wrench,
    gradient: "from-rose-500/70 via-red-500/70 to-orange-500/50",
  },
  {
    key: "borrowing",
    label: "Peminjaman",
    description: "Kelola request peminjaman dengan timeline standar UML.",
    href: "/borrowing",
    icon: HandHelping,
    gradient: "from-orange-400/70 via-amber-500/70 to-yellow-400/60",
  },
  {
    key: "settings",
    label: "Edit Profil",
    description: "Perbarui data akun, foto profil, dan sandi.",
    href: "/settings",
    icon: Settings,
    gradient: "from-slate-500/70 via-slate-400/70 to-slate-300/60",
  },
  {
    key: "returns",
    label: "Pengembalian",
    description: "Konfirmasi kondisi aset yang kembali.",
    href: "/returns",
    icon: RotateCcw,
    gradient: "from-emerald-500/70 via-lime-500/60 to-emerald-400/50",
  },
]

const quickActionKeysByRole: Record<string, string[]> = {
  admin: quickActionLinks.map((action) => action.key),
  leader: quickActionLinks.map((action) => action.key),
  staff: ["dashboard", "uml", "maintenance", "maintenance-schedule", "unggahan", "reports", "borrowing", "returns", "settings"],
  staff_pj: [
    "dashboard",
    "uml",
    "medical-assets",
    "non-medical-assets",
    "maintenance",
    "maintenance-schedule",
    "unggahan",
    "reports",
    "borrowing",
    "returns",
    "settings",
  ],
  teknisi: ["dashboard", "uml", "maintenance", "unggahan", "settings"],
  user: ["dashboard", "uml", "unggahan", "borrowing", "returns", "settings"],
}

export default function DashboardPage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<User | null>(null)

  const collectRoomKeys = (assets: Asset[]): Set<string> => {
    const rooms = new Set<string>()
    assets.forEach((asset) => {
      const normalizedLocation = asset.location?.trim()
      if (normalizedLocation) {
        rooms.add(normalizedLocation.toLowerCase())
      } else if (asset.assetCode) {
        rooms.add(asset.assetCode)
      } else {
        rooms.add(`asset-${asset.id}`)
      }
    })
    return rooms
  }

  const [stats, setStats] = useState({
    totalNonMedicalAssets: 0,
    activeNonMedicalAssets: 0,
    totalMedicalAssets: 0,
    activeMedicalAssets: 0,
    nonMedicalDetailsCount: 0,
    medicalDetailsCount: 0,
    maintenanceDue: 0,
    completedMaintenance: 0,
    activeBorrowings: 0,
    returnedBorrowings: 0,
    nonMedicalRoomCount: 0,
    medicalRoomCount: 0,
    totalRoomCount: 0,
  })

  useEffect(() => {
    const user = getCurrentUser()
    if (!user) {
      router.push("/login")
    } else {
      setCurrentUser(user)
    }
  }, [router])

  useEffect(() => {
    if (!currentUser) return
    loadStats()
    const interval = setInterval(loadStats, 30000)
    return () => clearInterval(interval)
  }, [currentUser])

  const loadStats = async () => {
    try {
      const [medicalResponse, nonMedicalResponse, maintenanceResponse, borrowingResponse] = await Promise.all([
        assetService.getMedicalAssets({ page: 1, limit: 1000 }),
        assetService.getNonMedicalAssets({ page: 1, limit: 1000 }),
        maintenanceService.getAll({ page: 1, limit: 1000 }),
        borrowingService.getAll({ page: 1, limit: 1000 }),
      ])

      const medicalAssets = medicalResponse.success ? medicalResponse.data : []
      const nonMedicalAssets = nonMedicalResponse.success ? nonMedicalResponse.data : []
      const maintenanceData = maintenanceResponse.success ? maintenanceResponse.data : []
      const borrowingsData = borrowingResponse.success ? borrowingResponse.data : []

      const totalNonMedicalAssets = nonMedicalAssets.length
      const nonMedicalRoomAssets = nonMedicalAssets.filter((a) => a.status !== "disposed")
      const nonMedicalRoomSet = collectRoomKeys(nonMedicalRoomAssets)
      const activeNonMedicalAssets = nonMedicalRoomSet.size

      const totalMedicalAssets = medicalAssets.length
      const medicalRoomAssets = medicalAssets.filter((a) => a.status !== "disposed")
      const medicalRoomSet = collectRoomKeys(medicalRoomAssets)
      const activeMedicalAssets = medicalRoomSet.size
      const nonMedicalDetailsCount = nonMedicalAssets.reduce(
        (sum, asset) => sum + getSpecificationDetails(asset.specifications).length,
        0
      )
      const medicalDetailsCount = medicalAssets.reduce(
        (sum, asset) => sum + getSpecificationDetails(asset.specifications).length,
        0
      )

      const maintenanceDue = maintenanceData.filter((m) => m.status === "scheduled").length
      const completedMaintenance = maintenanceData.filter((m) => m.status === "completed").length
      const activeBorrowings = borrowingsData.filter((b) =>
        ["approved", "borrowed", "overdue"].includes(b.status)
      ).length
      const returnedBorrowings = borrowingsData.filter((b) => b.status === "returned").length

      const totalRoomCount = new Set([...nonMedicalRoomSet, ...medicalRoomSet]).size
      setStats({
        totalNonMedicalAssets,
        activeNonMedicalAssets,
        totalMedicalAssets,
        activeMedicalAssets,
        maintenanceDue,
        completedMaintenance,
        activeBorrowings,
        returnedBorrowings,
        nonMedicalDetailsCount,
        medicalDetailsCount,
        nonMedicalRoomCount: nonMedicalRoomSet.size,
        medicalRoomCount: medicalRoomSet.size,
        totalRoomCount,
      })
    } catch (error: any) {
      const status = error?.response?.status
      if (status === 401 || status === 403) {
        clearAuthSession()
        setCurrentUser(null)
        router.push("/login")
        return
      }
      console.error("Failed to load dashboard stats:", error)
    }
  }

  const statCardClass =
    "rounded-[28px] border border-slate-200/70 bg-white/90 shadow-[0_20px_40px_rgba(15,23,42,0.08)] dark:border-slate-800/70 dark:bg-slate-900/60"

  const quickActions = useMemo(() => {
    const normalizedRole = normalizeUserRole(currentUser?.role)
    const allowedKeys =
      quickActionKeysByRole[normalizedRole] ?? quickActionKeysByRole.user

    return quickActionLinks.filter((action) => allowedKeys.includes(action.key))
  }, [currentUser?.role])

  const handleQuickActionClick = (action: QuickActionLink) => {
    if (canAccessRoute(currentUser?.role, action.href)) {
      router.push(action.href)
    }
  }

  if (!currentUser) return null

  return (
    <div className="flex-1 overflow-auto bg-background">
      <div className="p-6 space-y-6">
        <div className="flex flex-col gap-1 rounded-2xl border border-slate-200/60 bg-white/90 p-4 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500">Ringkasan inventaris, peminjaman, dan pemeliharaan secara singkat.</p>
        </div>

        {/* Quick Actions */}
        <Card className="rounded-[28px] border-0 bg-linear-to-br from-teal-50/80 via-white/80 to-cyan-50/80 shadow-[0_30px_60px_rgba(14,165,233,0.15)]">
          <CardHeader>
            <CardTitle className="text-base">Menu Cepat</CardTitle>
            <CardDescription>
              Menu ini menggabungkan tanda visual agar di setiap alur akses terlihat konsisten.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {quickActions.map((action) => {
                const Icon = action.icon
                return (
                  <button
                    key={action.label}
                    type="button"
                    onClick={() => handleQuickActionClick(action)}
                    className={`group flex h-full flex-col justify-between rounded-3xl border border-white/50 bg-linear-to-br ${action.gradient} p-5 text-left shadow-[0_25px_45px_rgba(15,23,42,0.25)] transition-transform duration-200 hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500`}
                    aria-label={`Navigasi ke ${action.label}`}
                  >
                    <div className="flex items-center gap-4">
                      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/30 text-white backdrop-blur">
                        <Icon className="h-5 w-5 text-white" />
                      </span>
                      <div className="flex-1 space-y-1">
                        <p className="text-sm font-semibold text-white">{action.label}</p>
                        <p className="text-xs text-white/80">{action.description}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <Badge variant="outline" className="rounded-full border-white/60 bg-white/20 px-3 py-1 text-[11px] text-white">

                      </Badge>
                      <ArrowRight className="h-4 w-4 text-white/80" />
                    </div>
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className={statCardClass}>
            <CardHeader className="flex items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Inventaris Non Medis</CardTitle>
              <div className="rounded-2xl bg-teal-50/80 p-2 text-teal-600 shadow-inner">
                <Building2 className="w-5 h-5" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="text-4xl font-semibold text-muted-foreground tracking-tight">
                  {stats.activeNonMedicalAssets.toLocaleString("id-ID")}
                </div>
                <Badge variant="outline" className="text-[10px] uppercase tracking-[0.4em] text-teal-500 border-teal-200">
                  Ruangan Aktif
                </Badge>
              </div>
              <p className="text-sm text-foreground/70">
                {stats.nonMedicalRoomCount.toLocaleString("id-ID")} ruangan non-medis aktif dari total {stats.totalRoomCount.toLocaleString("id-ID")} ruangan tercatat.
              </p>
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>Detail inventaris terinput</span>
                  <span className="text-muted-foreground">
                    {stats.nonMedicalDetailsCount.toLocaleString("id-ID")}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={statCardClass}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Inventaris Medis</CardTitle>
              <div className="rounded-2xl bg-cyan-50/80 p-2 text-cyan-600 shadow-inner">
                <Stethoscope className="w-5 h-5" />
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="space-y-2">
                <div className="text-4xl font-semibold text-muted-foreground tracking-tight">
                  {stats.activeMedicalAssets.toLocaleString("id-ID")}
                </div>
                <Badge variant="outline" className="text-[10px] uppercase tracking-[0.4em] text-cyan-500 border-cyan-200">
                  Ruangan Aktif
                </Badge>
              </div>
              <p className="text-sm text-foreground/70">
                {stats.medicalRoomCount.toLocaleString("id-ID")} ruangan medis aktif dari total {stats.totalRoomCount.toLocaleString("id-ID")} ruangan tercatat.
              </p>
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>Detail inventaris terinput</span>
                  <span className="text-muted-foreground">
                    {stats.medicalDetailsCount.toLocaleString("id-ID")}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={statCardClass}>
            <CardHeader className="flex items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Peminjaman Aktif</CardTitle>
              <div className="rounded-2xl bg-amber-50/80 p-2 text-amber-600 shadow-inner">
                <HandHelping className="w-5 h-5" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-end gap-2">
                <div className="text-4xl font-semibold text-muted-foreground tracking-tight">{stats.activeBorrowings}</div>
                <Badge variant="outline" className="text-[10px] uppercase tracking-[0.4em] text-amber-500 border-amber-200">
                  Aktif
                </Badge>
              </div>
              <p className="text-sm text-foreground/70">Status peminjaman yang sedang berjalan</p>
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>Dikembalikan</span>
                  <span className="text-muted-foreground">{stats.returnedBorrowings}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={statCardClass}>
            <CardHeader className="flex items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pemeliharaan</CardTitle>
              <div className="rounded-2xl bg-red-50/80 p-2 text-red-600 shadow-inner">
                <Wrench className="w-5 h-5" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-end gap-2">
                <div className="text-4xl font-semibold text-muted-foreground tracking-tight">{stats.maintenanceDue}</div>
                <Badge variant="outline" className="text-[10px] uppercase tracking-[0.4em] text-red-500 border-red-200">
                  Tertunda
                </Badge>
              </div>
              <p className="text-sm text-foreground/70">Jadwal pemeliharaan dan inspeksi yang menunggu teknisi</p>
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>Selesai</span>
                  <span className="text-muted-foreground">{stats.completedMaintenance}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="text-center text-sm text-muted-foreground">
          Kementerian Kesehatan RI - RSUP Persahabatan
          <br />
          Sistem Informasi Inventaris dan Pemeliharaan Sarana Prasarana Peminjaman
        </div>
      </div>
    </div>
  )
}
