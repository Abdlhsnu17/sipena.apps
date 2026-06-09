"use client"

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { assetUsageService } from "@/services/asset-usage.service";
import { assetService, type Asset } from "@/services/asset.service";
import { buildLoginRedirectUrl, clearAuthSession, getCurrentUser, isLocalAuthSession } from "@/services/auth-utils";
import { borrowingService } from "@/services/borrowing.service";
import { maintenanceService } from "@/services/maintenance.service";
import reportService from "@/services/report.service";
import type { User } from "@/types/auth-types";
import { getSpecificationDetails } from "@/utils/api-mappers";
import { canAccessRoute, normalizeUserRole } from "@/utils/role";
import { Archive, ArrowRight, BarChart3, Building2, ClipboardList, FileText, HandHelping, ListChecks, RotateCcw, Settings, Shield, Stethoscope, Trash2, UploadCloud, Users, Wrench } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ComponentType } from "react";

type IconComponent = ComponentType<{ className?: string }>

type QuickActionLink = {
  key: string
  label: string
  description: string
  href: string
  icon: IconComponent
  gradient: string
}

const quickActionLinks: QuickActionLink[] = [
  {
    key: "uml",
    label: "Dokumentasi Sistem",
    description: "Lihat UML, panduan, dan alur proses sistem.",
    href: "/uml",
    icon: FileText,
    gradient: "from-emerald-500/70 via-teal-500/70 to-blue-500/60",
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
    key: "medical-assets",
    label: "Inventaris Medis",
    description: "Lihat dan kelola data inventaris medis.",
    href: "/medical-assets",
    icon: Stethoscope,
    gradient: "from-cyan-500/70 via-blue-500/60 to-purple-500/50",
  },
  {
    key: "non-medical-assets",
    label: "Inventaris Non-Medis",
    description: "Lihat dan kelola data inventaris non-medis.",
    href: "/non-medical-assets",
    icon: Building2,
    gradient: "from-sky-500/80 via-cyan-500/70 to-teal-400/60",
  },
  {
    key: "reports",
    label: "Laporan & Analitik",
    description: "Rekap, statistik, dashboard, dan ekspor data.",
    href: "/reports",
    icon: BarChart3,
    gradient: "from-fuchsia-500/70 via-purple-500/70 to-indigo-500/60",
  },
  {
    key: "maintenance-schedule",
    label: "Pemeliharaan Sarana",
    description: "Buat dan kelola proses pemeliharaan sarana aset.",
    href: "/maintenance",
    icon: Wrench,
    gradient: "from-amber-400/70 via-orange-500/70 to-rose-500/50",
  },
  {
    key: "dss",
    label: "SPK Prioritas Aset",
    description: "Hitung prioritas aset dengan metode pendukung keputusan.",
    href: "/dss",
    icon: ListChecks,
    gradient: "from-violet-500/70 via-indigo-500/70 to-blue-500/60",
  },
  {
    key: "asset-usage",
    label: "Penggunaan",
    description: "Catat dan pantau penggunaan alat atau inventaris.",
    href: "/asset-usage",
    icon: ClipboardList,
    gradient: "from-teal-500/80 via-emerald-500/70 to-green-400/60",
  },
  {
    key: "borrowing",
    label: "Peminjaman",
    description: "Ajukan dan kelola peminjaman alat.",
    href: "/borrowing",
    icon: HandHelping,
    gradient: "from-orange-400/70 via-amber-500/70 to-yellow-400/60",
  },
  {
    key: "returns",
    label: "Pengembalian",
    description: "Validasi dan kelola pengembalian alat.",
    href: "/returns",
    icon: RotateCcw,
    gradient: "from-lime-500/70 via-green-500/60 to-emerald-400/50",
  },
  {
    key: "sanctions",
    label: "Manajemen Sanksi",
    description: "Kelola sanksi peminjaman aset yang melewati jatuh tempo.",
    href: "/sanctions",
    icon: Shield,
    gradient: "from-rose-500/70 via-red-500/70 to-pink-500/60",
  },
  {
    key: "disposal",
    label: "Penghapusan Aset",
    description: "Tinjau dan proses permintaan penghapusan aset.",
    href: "/disposal",
    icon: Trash2,
    gradient: "from-stone-500/70 via-zinc-500/70 to-slate-400/60",
  },
  {
    key: "unggahan",
    label: "Unggah Dokumen",
    description: "Unggah file atau folder dokumen pendukung.",
    href: "/unggahan",
    icon: UploadCloud,
    gradient: "from-cyan-400/70 via-sky-500/70 to-blue-400/60",
  },
  {
    key: "activity-archive",
    label: "Arsip Riwayat Aktivitas",
    description: "Lihat rekam aktivitas pengguna dan perubahan data.",
    href: "/activity-archive",
    icon: Archive,
    gradient: "from-slate-600/70 via-gray-500/70 to-zinc-400/60",
  },
  {
    key: "users",
    label: "Manajemen Pengguna",
    description: "Kelola akun, role, dan akses pengguna sistem.",
    href: "/users",
    icon: Users,
    gradient: "from-amber-500/70 via-yellow-500/70 to-lime-400/60",
  },
]

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
    totalUsageLogs: 0,
    usedAssetCount: 0,
    nonMedicalRoomCount: 0,
    medicalRoomCount: 0,
    totalRoomCount: 0,
    overdueBorrowings: 0,
    pendingBorrowings: 0,
    availableAssets: 0,
    borrowedAssets: 0,
    maintenanceAssets: 0,
  })

  useEffect(() => {
    const user = getCurrentUser()
    if (!user) {
      router.replace(buildLoginRedirectUrl())
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
    if (isLocalAuthSession()) {
      setStats({
        totalNonMedicalAssets: 0,
        activeNonMedicalAssets: 0,
        totalMedicalAssets: 0,
        activeMedicalAssets: 0,
        maintenanceDue: 0,
        completedMaintenance: 0,
        activeBorrowings: 0,
        returnedBorrowings: 0,
        totalUsageLogs: 0,
        usedAssetCount: 0,
        nonMedicalDetailsCount: 0,
        medicalDetailsCount: 0,
        nonMedicalRoomCount: 0,
        medicalRoomCount: 0,
        totalRoomCount: 0,
        overdueBorrowings: 0,
        pendingBorrowings: 0,
        availableAssets: 0,
        borrowedAssets: 0,
        maintenanceAssets: 0,
      })
      return
    }

    try {
      const [medicalResponse, nonMedicalResponse, maintenanceResponse, borrowingResponse, usageResponse, reportResponse] = await Promise.all([
        assetService.getMedicalAssets({ page: 1, limit: 1000 }),
        assetService.getNonMedicalAssets({ page: 1, limit: 1000 }),
        maintenanceService.getAll({ page: 1, limit: 1000 }),
        borrowingService.getAll({ page: 1, limit: 1000 }),
        assetUsageService.getAll({ page: 1, limit: 1000 }),
        reportService.getDashboard(),
      ])

      const medicalAssets = medicalResponse.success ? medicalResponse.data : []
      const nonMedicalAssets = nonMedicalResponse.success ? nonMedicalResponse.data : []
      const maintenanceData = maintenanceResponse.success ? maintenanceResponse.data : []
      const borrowingsData = borrowingResponse.success ? borrowingResponse.data : []
      const usageLogs = usageResponse.success ? usageResponse.data : []

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

      const maintenanceDue = maintenanceData.filter((m) =>
        ["requested", "scheduled", "completed"].includes(m.status)
      ).length
      const completedMaintenance = maintenanceData.filter((m) => m.status === "validated").length
      const activeBorrowings = borrowingsData.filter((b) =>
        ["approved", "borrowed", "overdue"].includes(b.status)
      ).length
      const returnedBorrowings = borrowingsData.filter((b) => b.status === "returned").length
      const totalUsageLogs = usageLogs.reduce((sum, log) => sum + (log.usageCount || 0), 0)
      const usedAssetCount = new Set(
        usageLogs.map((log) => log.assetDetailName || log.assetName || String(log.assetId))
      ).size

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
        totalUsageLogs,
        usedAssetCount,
        nonMedicalDetailsCount,
        medicalDetailsCount,
        nonMedicalRoomCount: nonMedicalRoomSet.size,
        medicalRoomCount: medicalRoomSet.size,
        totalRoomCount,
        overdueBorrowings: reportResponse.success ? reportResponse.data.overdueBorrowings : borrowingsData.filter((b) => b.status === "overdue").length,
        pendingBorrowings: reportResponse.success ? reportResponse.data.pendingBorrowings : borrowingsData.filter((b) => b.status === "pending").length,
        availableAssets: reportResponse.success ? reportResponse.data.availableAssets : 0,
        borrowedAssets: reportResponse.success ? reportResponse.data.borrowedAssets : 0,
        maintenanceAssets: reportResponse.success ? reportResponse.data.maintenanceAssets : 0,
      })

    } catch (error: any) {
      const status = error?.response?.status
      if (status === 401 || status === 403) {
        clearAuthSession()
        setCurrentUser(null)
        router.replace(buildLoginRedirectUrl())
        return
      }
      console.error("Failed to load dashboard stats:", error)
    }
  }

  const statCardClass =
    "rounded-[28px] border border-slate-200/70 bg-white/90 shadow-[0_20px_40px_rgba(15,23,42,0.08)] dark:border-slate-800/70 dark:bg-slate-900/60"

  const quickActions = useMemo(() => {
    const normalizedRole = normalizeUserRole(currentUser?.role)
    return quickActionLinks.filter((action) => canAccessRoute(normalizedRole, action.href))
  }, [currentUser?.role])



  const handleQuickActionClick = (action: QuickActionLink) => {
    if (canAccessRoute(currentUser?.role, action.href)) {
      router.push(action.href)
    }
  }

  if (!currentUser) return null

  return (
    <div className="min-h-full">
      <div className="space-y-6">
        {/* Quick Actions */}
        <Card className="rounded-[28px] border-0 bg-linear-to-br from-teal-50/80 via-white/80 to-cyan-50/80 shadow-[0_30px_60px_rgba(14,165,233,0.15)]">
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
                      <ArrowRight className="h-4 w-4 text-white/80" />
                    </div>
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Card className={`${statCardClass} bg-linear-to-br from-teal-50/65 via-white to-cyan-50/50`}>
            <CardHeader className="flex items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Inventaris Non Medis</CardTitle>
              <div className="rounded-2xl bg-linear-to-br from-teal-100 to-cyan-100 p-2 text-teal-700 shadow-inner">
                <Building2 className="w-5 h-5" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="text-3xl font-semibold tracking-tight text-muted-foreground sm:text-4xl">
                  {stats.activeNonMedicalAssets.toLocaleString("id-ID")}
                </div>
                <Badge variant="outline" className="max-w-full text-[10px] uppercase tracking-[0.28em] text-teal-600 border-teal-300 bg-teal-50/70">
                  Ruangan Aktif
                </Badge>
              </div>
              <p className="text-sm text-foreground/70">
                Ruangan tercatat
              </p>
              <div className="rounded-2xl border border-teal-200/70 bg-white/70 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>Detail inventaris terinput</span>
                  <span className="text-muted-foreground">
                    {stats.nonMedicalDetailsCount.toLocaleString("id-ID")}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`${statCardClass} bg-linear-to-br from-cyan-50/65 via-white to-sky-50/50`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Inventaris Medis</CardTitle>
              <div className="rounded-2xl bg-linear-to-br from-cyan-100 to-sky-100 p-2 text-cyan-700 shadow-inner">
                <Stethoscope className="w-5 h-5" />
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="space-y-2">
                <div className="text-3xl font-semibold tracking-tight text-muted-foreground sm:text-4xl">
                  {stats.activeMedicalAssets.toLocaleString("id-ID")}
                </div>
                <Badge variant="outline" className="max-w-full text-[10px] uppercase tracking-[0.28em] text-cyan-600 border-cyan-300 bg-cyan-50/70">
                  Ruangan Aktif
                </Badge>
              </div>
              <p className="text-sm text-foreground/70">
                Ruangan tercatat
              </p>
              <div className="rounded-2xl border border-cyan-200/70 bg-white/70 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>Detail inventaris terinput</span>
                  <span className="text-muted-foreground">
                    {stats.medicalDetailsCount.toLocaleString("id-ID")}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`${statCardClass} bg-linear-to-br from-amber-50/65 via-white to-orange-50/45`}>
            <CardHeader className="flex items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Peminjaman Aktif</CardTitle>
              <div className="rounded-2xl bg-linear-to-br from-amber-100 to-orange-100 p-2 text-amber-700 shadow-inner">
                <HandHelping className="w-5 h-5" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-end gap-2">
                <div className="text-3xl font-semibold tracking-tight text-muted-foreground sm:text-4xl">{stats.activeBorrowings}</div>
                <Badge variant="outline" className="max-w-full text-[10px] uppercase tracking-[0.28em] text-amber-600 border-amber-300 bg-amber-50/70">
                  Aktif
                </Badge>
              </div>
              <p className="text-sm text-foreground/70">Status peminjaman yang sedang berjalan</p>
              <div className="rounded-2xl border border-amber-200/70 bg-white/70 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>Dikembalikan</span>
                  <span className="text-muted-foreground">{stats.returnedBorrowings}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`${statCardClass} bg-linear-to-br from-rose-50/65 via-white to-red-50/45`}>
            <CardHeader className="flex items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pemeliharaan Sarana</CardTitle>
              <div className="rounded-2xl bg-linear-to-br from-rose-100 to-red-100 p-2 text-rose-700 shadow-inner">
                <Wrench className="w-5 h-5" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-end gap-2">
                <div className="text-3xl font-semibold tracking-tight text-muted-foreground sm:text-4xl">{stats.maintenanceDue}</div>
                <Badge variant="outline" className="max-w-full whitespace-normal wrap-break-word text-[10px] leading-4 uppercase tracking-[0.24em] text-rose-600 border-rose-300 bg-rose-50/70">
                  Perlu Tindak Lanjut
                </Badge>
              </div>
              <p className="text-sm text-foreground/70">Jadwal pemeliharaan dan inspeksi yang menunggu teknisi</p>
              <div className="rounded-2xl border border-rose-200/70 bg-white/70 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>Selesai Final</span>
                  <span className="text-muted-foreground">{stats.completedMaintenance}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`${statCardClass} bg-linear-to-br from-emerald-50/65 via-white to-teal-50/45`}>
            <CardHeader className="flex items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Penggunaan</CardTitle>
              <div className="rounded-2xl bg-linear-to-br from-emerald-100 to-teal-100 p-2 text-emerald-700 shadow-inner">
                <ClipboardList className="w-5 h-5" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-end gap-2">
                <div className="text-3xl font-semibold tracking-tight text-muted-foreground sm:text-4xl">
                  {stats.totalUsageLogs.toLocaleString("id-ID")}
                </div>
                <Badge variant="outline" className="max-w-full text-[10px] uppercase tracking-[0.28em] text-emerald-600 border-emerald-300 bg-emerald-50/70">
                  Tercatat
                </Badge>
              </div>
              <p className="text-sm text-foreground/70">Log penggunaan alat yang sudah masuk sistem</p>
              <div className="rounded-2xl border border-emerald-200/70 bg-white/70 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <div className="flex items-center justify-between gap-3">
                  <span>Aset terpakai</span>
                  <span className="text-muted-foreground">{stats.usedAssetCount.toLocaleString("id-ID")}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 pt-6 border-t border-border text-center">
          <p className="text-[13px] text-muted-foreground">
            Sistem Inventaris  Peminjaman serta Pemeliharaan  sarana (SiPeNa)
          </p>
        </div>
      </div>
    </div>
  )
}
