"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { API_BASE_URL } from "@/services/api.service"
import { assetService, type Asset } from "@/services/asset.service"
import { clearAuthSession, getCurrentUser } from "@/services/auth-utils"
import { borrowingService } from "@/services/borrowing.service"
import { maintenanceService, type Maintenance } from "@/services/maintenance.service"
import type { User, UserRole } from "@/types/auth-types"
import { getSpecificationDetails } from "@/utils/api-mappers"
import { formatDateId } from "@/utils/format"
import type { LucideIcon } from "lucide-react"
import { ArrowRight, BarChart3, Building2, HandHelping, RotateCcw, Stethoscope, Wrench } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

type QuickActionLink = {
  label: string
  description: string
  href: string
  icon: LucideIcon
  gradient: string
}

const quickActionLinks: QuickActionLink[] = [
  {
    label: "Inventaris Non Medis",
    description: "Pantau sarana & prasarana non-medis secara real-time.",
    href: "/non-medical-assets",
    icon: Building2,
    gradient: "from-teal-500/80 via-cyan-500/70 to-cyan-400/60",
  },
  {
    label: "Inventaris Medis",
    description: "Cek ketersediaan dan validasi alat medis.",
    href: "/medical-assets",
    icon: Stethoscope,
    gradient: "from-cyan-500/70 via-blue-500/60 to-purple-500/50",
  },
  {
    label: "Peminjaman",
    description: "Kelola request peminjaman dengan timeline standar UML.",
    href: "/borrowing",
    icon: HandHelping,
    gradient: "from-orange-400/70 via-amber-500/70 to-yellow-400/60",
  },
  {
    label: "Pengembalian",
    description: "Konfirmasi kondisi aset yang kembali.",
    href: "/returns",
    icon: RotateCcw,
    gradient: "from-emerald-500/70 via-lime-500/60 to-emerald-400/50",
  },
  {
    label: "Pemeliharaan",
    description: "Dashboard jadwal dan status teknisi.",
    href: "/maintenance",
    icon: Wrench,
    gradient: "from-rose-500/70 via-red-500/70 to-orange-500/50",
  },
  {
    label: "Laporan",
    description: "Analitik & unggahan PDF/Excel/Word.",
    href: "/reports",
    icon: BarChart3,
    gradient: "from-fuchsia-500/70 via-purple-500/70 to-indigo-500/60",
  },
]

const API_STATIC_URL = API_BASE_URL.replace(/\/api\/?$/, "")
const roleLabels: Record<UserRole, string> = {
  admin: "Administrator",
  leader: "Pimpinan",
  staff: "Staf Pelayanan",
  user: "Pengguna",
}

const getInitials = (value: string) => {
  const letters = value
    .split(" ")
    .map((segment) => segment.charAt(0))
    .filter(Boolean)
  return letters.slice(0, 2).join("") || value.charAt(0) || ""
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
  const [maintenanceSchedule, setMaintenanceSchedule] = useState<Maintenance[]>([])
  const [postMaintenance, setPostMaintenance] = useState<Maintenance[]>([])

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
      const upcoming = maintenanceData
        .filter((m) => m.status === "scheduled" || m.status === "in_progress")
        .slice(0, 4)
      const completedList = maintenanceData.filter((m) => m.status === "completed").slice(0, 4)

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
      setMaintenanceSchedule(upcoming)
      setPostMaintenance(completedList)
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

  const chartData = [
    { name: "Non-Medis", total: stats.totalNonMedicalAssets, aktif: stats.activeNonMedicalAssets },
    { name: "Medis", total: stats.totalMedicalAssets, aktif: stats.activeMedicalAssets },
  ]

  const statCardClass =
    "rounded-[28px] border border-slate-200/70 bg-white/90 shadow-[0_20px_40px_rgba(15,23,42,0.08)] dark:border-slate-800/70 dark:bg-slate-900/60"

  if (!currentUser) return null

  const profileImageUrl = currentUser.photoPath ? `${API_STATIC_URL}/uploads/${currentUser.photoPath}` : undefined
  const roleLabel = roleLabels[currentUser.role] ?? currentUser.role
  const userInitials = getInitials(currentUser.name)

  return (
    <div className="flex-1 overflow-auto bg-background">
      <div className="p-6 space-y-6">
        <section className="rounded-[32px] border border-teal-100/70 bg-gradient-to-br from-white via-teal-50 to-cyan-50/80 p-6 shadow-[0_30px_60px_rgba(14,165,233,0.15)] dark:border-slate-800/70 dark:bg-gradient-to-br dark:from-slate-950 dark:via-slate-900 dark:to-teal-950/30">
          <div className="space-y-5 lg:space-y-6">
            <div className="flex flex-col gap-4 rounded-[26px] border border-white/50 bg-white/80 px-5 py-4 shadow-sm backdrop-blur dark:border-slate-800/70 dark:bg-slate-900/70">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Avatar className="h-16 w-16 rounded-full border border-slate-200/60 shadow-sm dark:border-slate-700/70">
                  {profileImageUrl ? (
                    <AvatarImage src={profileImageUrl} alt={`${currentUser.name} photo`} />
                  ) : (
                    <AvatarFallback className="text-xl font-semibold uppercase text-muted-foreground dark:text-slate-300">
                      {userInitials}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="flex flex-1 flex-col gap-1">
                  <p className="text-lg font-semibold text-foreground">{currentUser.name}</p>
                  <p className="text-sm text-muted-foreground">NIP {currentUser.nip}</p>
                  <p className="text-xs font-semibold uppercase tracking-[0.4em] text-teal-600 dark:text-teal-300">
                    {roleLabel}
                  </p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground sm:max-w-3xl">
                Dashboard ini memadukan status inventaris, jadwal pemeliharaan, serta akses cepat dengan memprioritaskan visibilitas dan kontekstualisasi setiap aksi.
              </p>
            </div>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <Badge
                  variant="outline"
                  className="rounded-full border-white/70 bg-white/30 px-3 py-1 text-xs text-teal-700 dark:border-white/30 dark:bg-slate-900/40 dark:text-teal-300"
                >
                </Badge>
                <Badge
                  variant="outline"
                  className="rounded-full border-white/70 bg-white/30 px-3 py-1 text-xs text-slate-600 dark:border-white/30 dark:bg-slate-900/40 dark:text-slate-300"
                >
                  
                </Badge>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => router.push("/uml")}
                className="text-xs font-semibold"
              >
                Lihat Dokumentasi
              </Button>
            </div>
          </div>
        </section>

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
        <p className="text-center text-xs text-muted-foreground">
          Angka {stats.nonMedicalRoomCount.toLocaleString("id-ID")} dan {stats.medicalRoomCount.toLocaleString("id-ID")} merujuk pada ruangan aktif masing-masing kategori; total {stats.totalRoomCount.toLocaleString("id-ID")} ruangan adalah gabungan keduanya.
        </p>

        {/* Quick Actions */}
        <Card className="rounded-[28px] border-0 bg-gradient-to-br from-teal-50/80 via-white/80 to-cyan-50/80 shadow-[0_30px_60px_rgba(14,165,233,0.15)]">
          <CardHeader>
            <CardTitle className="text-base">Menu Cepat</CardTitle>
            <CardDescription>
              Menu ini menggabungkan tanda visual agar di setiap alur akses terlihat konsisten.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {quickActionLinks.map((action) => {
                const Icon = action.icon
                return (
                  <button
                    key={action.label}
                    type="button"
                    onClick={() => router.push(action.href)}
                    className={`group flex h-full flex-col justify-between rounded-3xl border border-white/50 bg-gradient-to-br ${action.gradient} p-5 text-left shadow-[0_25px_45px_rgba(15,23,42,0.25)] transition-transform duration-200 hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500`}
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

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Jadwal Pemeliharaan</CardTitle>
              <CardDescription>4 jadwal terbaru</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {maintenanceSchedule.length === 0 ? (
                <p className="text-sm text-muted-foreground">Tidak ada jadwal pemeliharaan</p>
              ) : (
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                      <th className="py-2 pr-3 text-left">Nama Alat</th>
                      <th className="py-2 pr-3 text-left">Jadwal</th>
                      <th className="py-2 pr-3 text-left">Status</th>
                      <th className="py-2 pr-3 text-left">Teknisi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {maintenanceSchedule.map((item) => (
                      <tr key={item.id} className="border-b border-border last:border-b-0">
                        <td className="py-2 pr-3 text-foreground">
                          {item.assetDetailName || item.assetName || "-"}
                        </td>
                        <td className="py-2 pr-3 text-muted-foreground">
                          {formatDateId(item.scheduledDate)}
                        </td>
                        <td className="py-2 pr-3">
                          <Badge variant="outline" className="text-[11px]">
                            {item.status === "scheduled"
                              ? "Tertunda"
                              : item.status === "in_progress"
                                ? "Proses"
                                : item.status}
                          </Badge>
                        </td>
                        <td className="py-2 pr-3 text-muted-foreground">{item.technician || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Setelah Pemeliharaan</CardTitle>
              <CardDescription>Catatan paling baru</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {postMaintenance.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada pemeliharaan selesai</p>
              ) : (
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                      <th className="py-2 pr-3 text-left">Nama Alat</th>
                      <th className="py-2 pr-3 text-left">Tanggal Selesai</th>
                      <th className="py-2 pr-3 text-left">Teknisi</th>
                      <th className="py-2 pr-3 text-left">Catatan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {postMaintenance.map((item) => (
                      <tr key={item.id} className="border-b border-border last:border-b-0">
                        <td className="py-2 pr-3 text-foreground">
                          {item.assetDetailName || item.assetName || "-"}
                        </td>
                        <td className="py-2 pr-3 text-muted-foreground">
                          {item.completedDate ? new Date(item.completedDate).toLocaleDateString("id-ID") : "-"}
                        </td>
                        <td className="py-2 pr-3 text-muted-foreground">{item.technician || "-"}</td>
                        <td className="py-2 pr-3 text-muted-foreground max-w-[180px]">{item.notes || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Distribusi Inventaris</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="total" fill="#14b8a6" name="Total" />
                  <Bar dataKey="aktif" fill="#06b6d4" name="Aktif" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ringkasan Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                  <span className="text-sm text-foreground">Total Inventaris Non-Medis</span>
                  <Badge>{stats.totalNonMedicalAssets}</Badge>
                </div>
                <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                  <span className="text-sm text-foreground">Total Inventaris Medis</span>
                  <Badge>{stats.totalMedicalAssets}</Badge>
                </div>
                <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                  <span className="text-sm text-foreground">Peminjaman Aktif</span>
                  <Badge variant="secondary">{stats.activeBorrowings}</Badge>
                </div>
                <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                  <span className="text-sm text-foreground">Pemeliharaan Tertunda</span>
                  <Badge variant="destructive">{stats.maintenanceDue}</Badge>
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
