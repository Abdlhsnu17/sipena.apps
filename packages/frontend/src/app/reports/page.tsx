"use client"

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { API_BASE_URL } from "@/services/api.service";
import { assetUsageService, type AssetUsageLog } from "@/services/asset-usage.service";
import { assetService } from "@/services/asset.service";
import { getAuthToken } from "@/services/auth-utils";
import authService, { type User as AuthUser } from "@/services/auth.service";
import { borrowingService } from "@/services/borrowing.service";
import { maintenanceService } from "@/services/maintenance.service";
import reportService from "@/services/report.service";
import userService, { type User } from "@/services/user.service";
import { getSpecificationDetails } from "@/utils/api-mappers";
import { parseDateValue } from "@/utils/format";
import { isAdminOrLeaderRole } from "@/utils/role";
import {
    BarChart3,
    Boxes,
    CalendarCheck2,
    Download,
    FileSpreadsheet,
    Hammer,
    PackageCheck,
    RotateCcw,
    Stethoscope,
    TrendingUp
} from "lucide-react";
import { useCallback, useEffect, useState, type ComponentType, type ReactNode } from "react";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from "recharts";

// usageContextLabels removed — reports now aggregate into broader categories

type IconComponent = ComponentType<{ className?: string }>
type ExportReportType = "assets" | "borrowing" | "maintenance" | "usage" | "activity" | "all"
type ExportFilters = {
  reportType: ExportReportType
  startDate: string
  endDate: string
  status: string
  type: string
  userId: string
}

type FilterOption = {
  value: string
  label: string
}

const chartColors = {
  assets: "#0284c7",
  maintenance: "#f97316",
  borrowing: "#e11d48",
  usage: "#059669",
  neutral: "#475569",
}

const formatNumber = (value: number) => new Intl.NumberFormat("id-ID").format(value)

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value)

const reportTypeOptions: Array<FilterOption & { value: ExportReportType; description: string }> = [
  { value: "assets", label: "Aset", description: "Data inventaris medis dan non medis" },
  { value: "borrowing", label: "Peminjaman", description: "Transaksi pinjam pakai alat" },
  { value: "maintenance", label: "Pemeliharaan", description: "Jadwal dan riwayat pemeliharaan" },
  { value: "usage", label: "Penggunaan", description: "Log pemakaian alat per ruangan dan konteks" },
  { value: "activity", label: "Aktivitas", description: "Arsip riwayat aktivitas pengguna" },
  { value: "all", label: "Semua Modul", description: "Ringkasan terpadu semua laporan" },
]

const borrowingStatusOptions: FilterOption[] = [
  { value: "pending", label: "Menunggu" },
  { value: "approved", label: "Disetujui" },
  { value: "borrowed", label: "Dipinjam" },
  { value: "returned", label: "Dikembalikan" },
  { value: "overdue", label: "Terlambat" },
]

const maintenanceStatusOptions: FilterOption[] = [
  { value: "requested", label: "Request" },
  { value: "scheduled", label: "Terjadwal" },
  { value: "in_progress", label: "Proses" },
  { value: "completed", label: "Selesai" },
  { value: "validated", label: "Tervalidasi" },
]

const assetTypeOptions: FilterOption[] = [
  { value: "medical", label: "Medis" },
  { value: "non_medical", label: "Non Medis" },
]

const maintenanceTypeOptions: FilterOption[] = [
  { value: "preventive", label: "Preventive" },
  { value: "corrective", label: "Corrective" },
  { value: "calibration", label: "Calibration" },
  { value: "inspection", label: "Inspection" },
]

const usageContextOptions: FilterOption[] = [
  { value: "procedure", label: "Antar Sub Ruangan" },
]

const initialExportFilters: ExportFilters = {
  reportType: "assets",
  startDate: "",
  endDate: "",
  status: "",
  type: "",
  userId: "",
}

const toDateInputValue = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

const getDateRangePreset = (preset: "all" | "today" | "month" | "last30" | "year") => {
  const today = new Date()

  if (preset === "all") {
    return { startDate: "", endDate: "" }
  }

  if (preset === "today") {
    const date = toDateInputValue(today)
    return { startDate: date, endDate: date }
  }

  if (preset === "month") {
    return {
      startDate: toDateInputValue(new Date(today.getFullYear(), today.getMonth(), 1)),
      endDate: toDateInputValue(today),
    }
  }

  if (preset === "year") {
    return {
      startDate: toDateInputValue(new Date(today.getFullYear(), 0, 1)),
      endDate: toDateInputValue(today),
    }
  }

  const startDate = new Date(today)
  startDate.setDate(today.getDate() - 29)
  return {
    startDate: toDateInputValue(startDate),
    endDate: toDateInputValue(today),
  }
}

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  accentClassName,
}: {
  title: string
  value: string
  description: string
  icon: IconComponent
  accentClassName: string
}) {
  return (
    <Card className="rounded-lg border-slate-200 py-0 shadow-sm">
      <CardContent className="flex min-h-28 items-center justify-between gap-3 px-4 py-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
          <p className="mt-2 truncate text-2xl font-semibold text-slate-900">{value}</p>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{description}</p>
        </div>
        <div className={`flex size-10 shrink-0 items-center justify-center rounded-md ${accentClassName}`}>
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  )
}

function ChartCard({
  title,
  description,
  children,
  className = "",
}: {
  title: string
  description: string
  children: ReactNode
  className?: string
}) {
  return (
    <Card className={`rounded-lg border-slate-200 py-0 shadow-sm ${className}`}>
      <CardHeader className="border-b border-slate-100 px-4 py-3">
        <CardTitle className="text-sm font-semibold text-slate-900">{title}</CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent className="px-3 py-3">{children}</CardContent>
    </Card>
  )
}

/**
 * Komponen Halaman Laporan & Analitik.
 * Mengambil data inventaris, pemeliharaan, dan peminjaman dari API.
 */
export default function ReportsPage() {
  const [nonMedicalRooms, setNonMedicalRooms] = useState<any[]>([])
  const [medicalRooms, setMedicalRooms] = useState<any[]>([])
  const [maintenance, setMaintenance] = useState<any[]>([])
  const [borrowings, setBorrowings] = useState<any[]>([])
  const [assetUsageLogs, setAssetUsageLogs] = useState<AssetUsageLog[]>([])
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [monthlyData, setMonthlyData] = useState<any[]>([])
  const [monthlyDataByLocation, setMonthlyDataByLocation] = useState<any[]>([])
  const [usageMonthlyData, setUsageMonthlyData] = useState<any[]>([])
  const [usageRoomData, setUsageRoomData] = useState<any[]>([])
  const [usageYearData, setUsageYearData] = useState<any[]>([])
  const [usageContextData, setUsageContextData] = useState<any[]>([])
  const [exporting, setExporting] = useState<"pdf" | "excel" | null>(null)
  const [exportFilters, setExportFilters] = useState<ExportFilters>(initialExportFilters)

  const toArray = <T,>(value: T[] | undefined | null): T[] => (Array.isArray(value) ? value : [])

  useEffect(() => {
    setCurrentUser(authService.getCurrentUser())
  }, [])

  const generateMonthlyData = useCallback((data: any[]) => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

    const monthlyStats = months.map((month, index) => ({
      month,
      completed: data.filter((m) => {
        const monthIndex = parseDateValue(m.scheduledDate)?.getMonth()
        return monthIndex === index && m.status === "validated"
      }).length,
      pending: data.filter((m) => {
        const monthIndex = parseDateValue(m.scheduledDate)?.getMonth()
        return monthIndex === index && m.status !== "validated"
      }).length,
    }))

    setMonthlyData(monthlyStats)

    // Generate data grouped by location
    const locationMap = new Map<string, any>()
    
    months.forEach((month, index) => {
      const monthMaintenance = data.filter((m) => {
        const monthIndex = parseDateValue(m.scheduledDate)?.getMonth()
        return monthIndex === index
      })
      
      monthMaintenance.forEach((m) => {
        const location = m.location || "Tidak Ditentukan"
        if (!locationMap.has(location)) {
          locationMap.set(location, {
            location,
            months: {}
          })
        }
        const locationData = locationMap.get(location)
        locationData.months[month] = (locationData.months[month] || 0) + 1
      })
    })

    const monthlyByLocation = Array.from(locationMap.values()).map((item) => ({
      location: item.location,
      ...item.months
    }))

    setMonthlyDataByLocation(monthlyByLocation)
  }, [])

  const generateUsageData = useCallback((logs: AssetUsageLog[]) => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

    const monthlyStats = months.map((month, index) => ({
      month,
      total: logs.reduce((sum, log) => {
        const monthIndex = parseDateValue(log.startedAt)?.getMonth()
        return monthIndex === index ? sum + (log.usageCount || 1) : sum
      }, 0),
    }))

    setUsageMonthlyData(monthlyStats)

    const roomTotals = logs.reduce<Record<string, number>>((acc, log) => {
      const roomName = (log.roomName || log.assetLocation || "Tidak Ditentukan").trim() || "Tidak Ditentukan"
      acc[roomName] = (acc[roomName] || 0) + (log.usageCount || 1)
      return acc
    }, {})

    setUsageRoomData(
      Object.entries(roomTotals)
        .map(([room, total]) => ({ room, total }))
        .sort((a, b) => b.total - a.total)
    )

    const yearTotals = logs.reduce<Record<string, number>>((acc, log) => {
      const startedAt = parseDateValue(log.startedAt)
      const year = startedAt ? String(startedAt.getFullYear()) : "Tidak Ditentukan"
      acc[year] = (acc[year] || 0) + (log.usageCount || 1)
      return acc
    }, {})

    setUsageYearData(
      Object.entries(yearTotals)
        .map(([year, total]) => ({ year, total }))
        .sort((a, b) => a.year.localeCompare(b.year, "id", { numeric: true }))
    )

    const classifyUsageCategory = (ctx?: string | null) => {
      const key = (ctx || "other").toString()
      if (key === "procedure" || key === "same_unit_cross_room") return "Antar Sub Ruangan"
      return null
    }

    const contextMap = logs.reduce<Record<string, number>>((acc, log) => {
      const category = classifyUsageCategory(log.usageContext)
      if (!category) return acc
      acc[category] = (acc[category] || 0) + (log.usageCount || 1)
      return acc
    }, {})

    setUsageContextData(
      Object.entries(contextMap)
        .map(([category, total]) => ({
          context: category,
          total,
        }))
        .sort((a, b) => b.total - a.total)
    )
  }, [])

  useEffect(() => {
    const loadReportData = async () => {
      try {
        const results = await Promise.allSettled([
          assetService.getMedicalAssets({ page: 1, limit: 1000 }),
          assetService.getNonMedicalAssets({ page: 1, limit: 1000 }),
          maintenanceService.getAll({ page: 1, limit: 1000 }),
          borrowingService.getAll({ page: 1, limit: 1000 }),
          assetUsageService.getAll({ page: 1, limit: 1000 }),
        ])

        const [medicalResult, nonMedicalResult, maintenanceResult, borrowingResult, usageResult] = results

        if (medicalResult.status === "fulfilled" && medicalResult.value.success) {
          const medicalData = toArray(medicalResult.value.data)
          setMedicalRooms(medicalData)
        } else if (medicalResult.status === "rejected") {
          console.error("Failed to load medical assets:", medicalResult.reason)
        }

        if (nonMedicalResult.status === "fulfilled" && nonMedicalResult.value.success) {
          const nonMedicalData = toArray(nonMedicalResult.value.data)
          setNonMedicalRooms(nonMedicalData)
        } else if (nonMedicalResult.status === "rejected") {
          console.error("Failed to load non-medical assets:", nonMedicalResult.reason)
        }

        if (maintenanceResult.status === "fulfilled" && maintenanceResult.value.success) {
          const maintenanceData = toArray(maintenanceResult.value.data)
          setMaintenance(maintenanceData)
          generateMonthlyData(maintenanceData)
        } else if (maintenanceResult.status === "rejected") {
          console.error("Failed to load maintenance data:", maintenanceResult.reason)
        }

        if (borrowingResult.status === "fulfilled" && borrowingResult.value.success) {
          setBorrowings(toArray(borrowingResult.value.data))
        } else if (borrowingResult.status === "rejected") {
          console.error("Failed to load borrowing data:", borrowingResult.reason)
        }

        if (usageResult.status === "fulfilled" && usageResult.value.success) {
          const usageData = toArray(usageResult.value.data)
          setAssetUsageLogs(usageData)
          generateUsageData(usageData)
        } else if (usageResult.status === "rejected") {
          console.error("Failed to load asset usage data:", usageResult.reason)
        }

      } catch (error) {
        console.error("An unexpected error occurred in loadReportData:", error)
      }
    }

    loadReportData()
  }, [generateMonthlyData, generateUsageData])

  useEffect(() => {
    if (!isAdminOrLeaderRole(currentUser?.role)) return
    const loadUsers = async () => {
      try {
        const response = await userService.getAll({ page: 1, limit: 500 })
        if (response.success && Array.isArray(response.data)) {
          setUsers(response.data)
        }
      } catch (error) {
        console.error("Failed to load users for activity report:", error)
      }
    }
    void loadUsers()
  }, [currentUser?.role])

  const totalNonMedicalRooms = nonMedicalRooms.length
  const totalMedicalRooms = medicalRooms.length
  const totalRooms = totalNonMedicalRooms + totalMedicalRooms
  const totalNonMedicalInventoryDetails = nonMedicalRooms.reduce(
    (sum, room) => sum + getSpecificationDetails(room.specifications).length,
    0
  )
  const totalMedicalInventoryDetails = medicalRooms.reduce(
    (sum, room) => sum + getSpecificationDetails(room.specifications).length,
    0
  )
  const totalInventoryDetails = totalNonMedicalInventoryDetails + totalMedicalInventoryDetails

  const totalCost = maintenance.reduce((sum, m) => sum + (Number.parseInt(m.cost) || 0), 0)
  const totalUsageCount = assetUsageLogs.reduce((sum, log) => sum + (log.usageCount || 1), 0)
  const uniqueUsedAssets = assetUsageLogs.length > 0
    ? new Set(assetUsageLogs.map((log) => log.assetDetailName || log.assetName || String(log.assetId))).size
    : 0
  const inventorySummaryData = [
    { name: "Total", ruangan: totalRooms, inventaris: totalInventoryDetails },
    { name: "Medis", ruangan: totalMedicalRooms, inventaris: totalMedicalInventoryDetails },
    { name: "Non Medis", ruangan: totalNonMedicalRooms, inventaris: totalNonMedicalInventoryDetails },
  ]
  const operationalSummaryData = [
    { name: "Pemeliharaan", total: maintenance.length },
    { name: "Peminjaman", total: borrowings.length },
    { name: "Penggunaan", total: totalUsageCount },
    { name: "Inventaris", total: totalInventoryDetails },
    { name: "Alat Terpakai", total: uniqueUsedAssets },
  ]
  const maintenanceStatusData = [
    { status: "Tervalidasi", total: maintenance.filter((m) => m.status === "validated").length },
    { status: "Belum Validasi", total: maintenance.filter((m) => m.status !== "validated").length },
  ]
  const maintenanceRoomData = monthlyDataByLocation
    .map((item) => ({
      room: item.location,
      total: Object.values(item).reduce((sum: number, value) => (typeof value === "number" ? sum + value : sum), 0),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)
  const maintenanceAssetData = Object.values(
    maintenance.reduce<Record<string, { name: string; total: number }>>((acc, item) => {
      const key = item.assetDetailName || item.assetName || "Tidak Ditentukan"
      acc[key] = { name: key, total: (acc[key]?.total || 0) + 1 }
      return acc
    }, {})
  )
    .sort((a, b) => b.total - a.total)
    .slice(0, 8)
  const borrowingStatusData = [
    { status: "Total", total: borrowings.length },
    { status: "Dipinjam", total: borrowings.filter((b) => ["approved", "borrowed"].includes(b.status)).length },
    { status: "Kembali", total: borrowings.filter((b) => b.status === "returned").length },
    { status: "Terlambat", total: borrowings.filter((b) => b.status === "overdue").length },
  ]
  const maintenanceCostData = [
    { name: "Biaya", total: totalCost },
  ]
  const usedAssetData = Object.values(
    assetUsageLogs.reduce<Record<string, { label: string; count: number }>>((acc, log) => {
      const key = log.assetDetailName || log.assetName || `Aset ${log.assetId}`
      acc[key] = { label: key, count: (acc[key]?.count || 0) + (log.usageCount || 1) }
      return acc
    }, {})
  )
    .map((item) => ({ name: item.label, total: item.count }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8)

  const selectedReportType = reportTypeOptions.find((option) => option.value === exportFilters.reportType) ?? reportTypeOptions[0]
  const availableStatusOptions =
    exportFilters.reportType === "borrowing"
      ? borrowingStatusOptions
      : exportFilters.reportType === "maintenance"
        ? maintenanceStatusOptions
        : exportFilters.reportType === "usage"
          ? usageContextOptions
          : []
  const availableTypeOptions =
    exportFilters.reportType === "assets" || exportFilters.reportType === "usage"
      ? assetTypeOptions
      : exportFilters.reportType === "maintenance"
        ? maintenanceTypeOptions
        : []
  const showStatusFilter = availableStatusOptions.length > 0
  const showTypeFilter = availableTypeOptions.length > 0
  const showUserFilter = exportFilters.reportType === "activity" || exportFilters.reportType === "all"
  const canSelectReportUser = isAdminOrLeaderRole(currentUser?.role)
  const dateRangeInvalid = Boolean(
    exportFilters.startDate && exportFilters.endDate && exportFilters.startDate > exportFilters.endDate
  )
  const selectedStatusLabel = availableStatusOptions.find((option) => option.value === exportFilters.status)?.label
  const selectedTypeLabel = availableTypeOptions.find((option) => option.value === exportFilters.type)?.label
  const selectedUserLabel =
    canSelectReportUser && exportFilters.userId
      ? users.find((user) => String(user.id) === exportFilters.userId)?.name ?? "User terpilih"
      : canSelectReportUser
        ? "Semua user"
        : currentUser?.name ?? "Akun sendiri"
  const periodLabel =
    exportFilters.startDate && exportFilters.endDate
      ? `${exportFilters.startDate} s/d ${exportFilters.endDate}`
      : exportFilters.startDate
        ? `Mulai ${exportFilters.startDate}`
        : exportFilters.endDate
          ? `Sampai ${exportFilters.endDate}`
          : "Semua periode"
  const activeExportFilterLabels = [
    selectedReportType.label,
    periodLabel,
    selectedStatusLabel ? `${exportFilters.reportType === "usage" ? "Konteks" : "Status"}: ${selectedStatusLabel}` : null,
    selectedTypeLabel ? `Jenis: ${selectedTypeLabel}` : null,
    showUserFilter ? `User: ${selectedUserLabel}` : null,
  ].filter(Boolean)

  const setReportType = (reportType: ExportReportType) => {
    setExportFilters((current) => ({
      ...current,
      reportType,
      status: "",
      type: "",
      userId: reportType === "activity" || reportType === "all" ? current.userId : "",
    }))
  }

  const setDatePreset = (preset: "all" | "today" | "month" | "last30" | "year") => {
    setExportFilters((current) => ({
      ...current,
      ...getDateRangePreset(preset),
    }))
  }

  const handleExport = async (format: "pdf" | "excel") => {
    if (dateRangeInvalid) {
      alert("Tanggal mulai tidak boleh lebih besar dari tanggal akhir")
      return
    }

    setExporting(format)
    try {
      const params = Object.fromEntries(
        Object.entries(exportFilters).filter(([, value]) => value.trim())
      )
      const endpoint = reportService.getExportEndpoint(format, params)
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: {
          ...(getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {}),
        },
      })

      if (!response.ok) {
        throw new Error("Gagal mengunduh laporan")
      }

      const blob = await response.blob()
      const disposition = response.headers.get("content-disposition") ?? ""
      const match = disposition.match(/filename="?([^"]+)"?/i)
      const fileName = match?.[1] ?? `laporan-${exportFilters.reportType}-${new Date().toISOString().slice(0, 10)}.${format === "excel" ? "xlsx" : "pdf"}`
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Failed to export report:", error)
      alert(error instanceof Error ? error.message : "Gagal mengunduh laporan")
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="min-w-0">
      <div className="w-full space-y-5">
        <section className="rounded-2xl border border-slate-200/70 bg-white/90 panel-gutter shadow-sm backdrop-blur-sm dark:border-slate-800/70 dark:bg-slate-900/60">
          <div className="flex items-start gap-3 sm:items-center sm:gap-5">
            <div className="rounded-lg bg-linear-to-br from-teal-500 to-teal-700 p-2.5">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="mt-1 text-[18px] font-bold text-foreground">Laporan & Analitik</h1>
            </div>
          </div>
        </section>

        <Card className="rounded-lg border-slate-200 py-0 shadow-sm">
          <CardHeader className="border-b border-slate-100 px-4 py-3">
            <CardTitle className="text-sm font-semibold text-slate-900">Ekspor Laporan</CardTitle>
            <CardDescription className="text-xs">Pilih modul dan filter laporan, lalu unduh file dari ringkasan di sisi kanan.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 px-4 py-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
                {reportTypeOptions.map((option) => {
                  const active = exportFilters.reportType === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setReportType(option.value)}
                      className={`min-h-20 rounded-md border px-3 py-2 text-left transition ${
                        active
                          ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <span className="block text-sm font-semibold">{option.label}</span>
                      <span className={`mt-1 block text-xs ${active ? "text-slate-200" : "text-slate-500"}`}>{option.description}</span>
                    </button>
                  )
                })}
              </div>

              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Periode</p>
                  <div className="flex flex-wrap gap-2">
                    {([
                      ["all", "Semua"],
                      ["today", "Hari ini"],
                      ["month", "Bulan ini"],
                      ["last30", "30 hari"],
                      ["year", "Tahun ini"],
                    ] as const).map(([preset, label]) => (
                      <Button key={preset} type="button" variant="outline" size="sm" onClick={() => setDatePreset(preset)}>
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="space-y-1 text-xs font-medium text-slate-600">
                    <span>Tanggal mulai</span>
                    <input
                      aria-label="Tanggal mulai"
                      type="date"
                      value={exportFilters.startDate}
                      onChange={(event) => setExportFilters((current) => ({ ...current, startDate: event.target.value }))}
                      className={`h-10 w-full rounded-md border bg-white px-3 text-sm text-slate-700 shadow-xs outline-none transition focus:border-slate-400 ${
                        dateRangeInvalid ? "border-red-300" : "border-slate-200"
                      }`}
                    />
                  </label>
                  <label className="space-y-1 text-xs font-medium text-slate-600">
                    <span>Tanggal akhir</span>
                    <input
                      aria-label="Tanggal akhir"
                      type="date"
                      value={exportFilters.endDate}
                      onChange={(event) => setExportFilters((current) => ({ ...current, endDate: event.target.value }))}
                      className={`h-10 w-full rounded-md border bg-white px-3 text-sm text-slate-700 shadow-xs outline-none transition focus:border-slate-400 ${
                        dateRangeInvalid ? "border-red-300" : "border-slate-200"
                      }`}
                    />
                  </label>
                  {dateRangeInvalid ? (
                    <p className="text-xs font-medium text-red-600 sm:col-span-2">Tanggal mulai harus sebelum atau sama dengan tanggal akhir.</p>
                  ) : null}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="h-10"
                  onClick={() => setExportFilters(initialExportFilters)}
                >
                  <RotateCcw className="mr-2 size-4" />
                  Reset
                </Button>
              </div>

              {(showStatusFilter || showTypeFilter || showUserFilter) ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {showStatusFilter ? (
                    <label className="space-y-1 text-xs font-medium text-slate-600">
                      <span>{exportFilters.reportType === "usage" ? "Konteks penggunaan" : "Status"}</span>
                      <select
                        aria-label={exportFilters.reportType === "usage" ? "Konteks penggunaan" : "Status laporan"}
                        value={exportFilters.status}
                        onChange={(event) => setExportFilters((current) => ({ ...current, status: event.target.value }))}
                        className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-xs outline-none transition focus:border-slate-400"
                      >
                        <option value="">Semua status</option>
                        {availableStatusOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  {showTypeFilter ? (
                    <label className="space-y-1 text-xs font-medium text-slate-600">
                      <span>{exportFilters.reportType === "maintenance" ? "Jenis pemeliharaan" : "Jenis aset"}</span>
                      <select
                        aria-label={exportFilters.reportType === "maintenance" ? "Jenis pemeliharaan" : "Jenis aset"}
                        value={exportFilters.type}
                        onChange={(event) => setExportFilters((current) => ({ ...current, type: event.target.value }))}
                        className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-xs outline-none transition focus:border-slate-400"
                      >
                        <option value="">Semua jenis</option>
                        {availableTypeOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  {showUserFilter ? (
                    canSelectReportUser ? (
                      <label className="space-y-1 text-xs font-medium text-slate-600">
                        <span>User aktivitas</span>
                        <select
                          aria-label="User aktivitas"
                          value={exportFilters.userId}
                          onChange={(event) => setExportFilters((current) => ({ ...current, userId: event.target.value }))}
                          className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-xs outline-none transition focus:border-slate-400"
                        >
                          <option value="">Semua user</option>
                          {users.map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.name} - {user.nip}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                        <p className="text-xs font-medium text-slate-500">User aktivitas</p>
                        <p className="mt-1 text-sm font-semibold text-slate-800">{selectedUserLabel}</p>
                      </div>
                    )
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="border-t border-slate-200 pt-4 xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0">
              <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Unduh file</p>
              <p className="mt-1 text-sm font-semibold text-slate-950">{selectedReportType.label}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {activeExportFilterLabels.map((label) => (
                  <span key={String(label)} className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600">
                    {label}
                  </span>
                ))}
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                <Button type="button" variant="outline" className="justify-start bg-white" onClick={() => void handleExport("excel")} disabled={exporting !== null || dateRangeInvalid}>
                  <FileSpreadsheet className="mr-2 size-4" />
                  {exporting === "excel" ? "Menyiapkan Excel..." : "Unduh Excel"}
                </Button>
                <Button type="button" className="justify-start" onClick={() => void handleExport("pdf")} disabled={exporting !== null || dateRangeInvalid}>
                  <Download className="mr-2 size-4" />
                  {exporting === "pdf" ? "Menyiapkan PDF..." : "Unduh PDF"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <MetricCard title="Total Ruangan" value={formatNumber(totalRooms)} description="Ruangan medis dan non medis" icon={Boxes} accentClassName="bg-sky-50 text-sky-700" />
          <MetricCard title="Ruangan Medis" value={formatNumber(totalMedicalRooms)} description="Ruangan inventaris klinis" icon={Stethoscope} accentClassName="bg-cyan-50 text-cyan-700" />
          <MetricCard title="Ruangan Non Medis" value={formatNumber(totalNonMedicalRooms)} description="Ruangan sarana pendukung" icon={PackageCheck} accentClassName="bg-indigo-50 text-indigo-700" />
          <MetricCard title="Inventaris Terinput" value={formatNumber(totalInventoryDetails)} description="Detail aset di semua ruangan" icon={Boxes} accentClassName="bg-violet-50 text-violet-700" />
          <MetricCard title="Inventaris Medis" value={formatNumber(totalMedicalInventoryDetails)} description="Detail aset klinis terinput" icon={Stethoscope} accentClassName="bg-teal-50 text-teal-700" />
          <MetricCard title="Inventaris Non Medis" value={formatNumber(totalNonMedicalInventoryDetails)} description="Detail sarana terinput" icon={PackageCheck} accentClassName="bg-blue-50 text-blue-700" />
          <MetricCard title="Pemeliharaan" value={formatNumber(maintenance.length)} description="Semua jadwal tercatat" icon={Hammer} accentClassName="bg-amber-50 text-amber-700" />
          <MetricCard title="Peminjaman" value={formatNumber(borrowings.length)} description="Sesi pinjam pakai" icon={CalendarCheck2} accentClassName="bg-rose-50 text-rose-700" />
          <MetricCard title="Penggunaan" value={formatNumber(totalUsageCount)} description="Akumulasi pemakaian" icon={TrendingUp} accentClassName="bg-emerald-50 text-emerald-700" />
        </div>

        <Tabs defaultValue="overview" className="gap-4">
          <div className="overflow-x-auto">
            <TabsList className="h-10 min-w-max bg-white p-1 shadow-sm">
              <TabsTrigger value="overview" className="px-3">Ringkasan</TabsTrigger>
              <TabsTrigger value="assets" className="px-3">Aset</TabsTrigger>
              <TabsTrigger value="maintenance" className="px-3">Pemeliharaan</TabsTrigger>
              <TabsTrigger value="borrowing" className="px-3">Peminjaman</TabsTrigger>
              <TabsTrigger value="usage" className="px-3">Penggunaan</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <ChartCard title="Aktivitas Operasional" description="Perbandingan aktivitas lintas modul" className="xl:col-span-2">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={operationalSummaryData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="total" fill={chartColors.usage} name="Total" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
              <ChartCard title="Komposisi Data Inventaris" description="Ruangan dibanding detail inventaris terinput">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={inventorySummaryData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="ruangan" fill={chartColors.assets} name="Ruangan" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="inventaris" fill="#7c3aed" name="Inventaris Terinput" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
            <ChartCard title="Biaya Pemeliharaan" description={`Total biaya tercatat: ${formatCurrency(totalCost)}`}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={maintenanceCostData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="total" fill={chartColors.neutral} name="Rupiah" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </TabsContent>

          <TabsContent value="assets" className="space-y-4">
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <ChartCard title="Komposisi Ruangan dan Inventaris" description="Pisahkan jumlah ruangan dari detail aset terinput" className="xl:col-span-2">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={inventorySummaryData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="ruangan" fill={chartColors.assets} name="Ruangan" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="inventaris" fill="#7c3aed" name="Inventaris Terinput" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
              <ChartCard title="Aset Paling Sering Dipakai" description="Delapan alat dengan frekuensi pemakaian tertinggi">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={usedAssetData} layout="vertical" margin={{ top: 8, right: 8, left: 18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                    <YAxis dataKey="name" type="category" width={118} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="total" fill={chartColors.assets} name="Total Pemakaian" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
          </TabsContent>

          <TabsContent value="maintenance" className="space-y-4">
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <ChartCard title="Pemeliharaan Per Bulan" description="Perbandingan jadwal tervalidasi dan belum validasi" className="xl:col-span-2">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={monthlyData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} interval={0} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="completed" stackId="maintenance" fill="#2563eb" name="Tervalidasi" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="pending" stackId="maintenance" fill={chartColors.maintenance} name="Belum Validasi" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
              <ChartCard title="Status Pemeliharaan" description="Distribusi validasi jadwal">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={maintenanceStatusData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="status" tick={{ fontSize: 10 }} interval={0} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="total" fill={chartColors.maintenance} name="Jumlah" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <ChartCard title="Pemeliharaan Per Ruangan" description="Sepuluh ruangan dengan aktivitas terbanyak">
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={maintenanceRoomData} layout="vertical" margin={{ top: 8, right: 8, left: 18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                    <YAxis dataKey="room" type="category" width={118} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="total" fill={chartColors.maintenance} name="Total Pemeliharaan" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
              <ChartCard title="Inventaris Sering Dipelihara" description="Delapan inventaris teratas">
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={maintenanceAssetData} layout="vertical" margin={{ top: 8, right: 8, left: 18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                    <YAxis dataKey="name" type="category" width={118} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="total" fill={chartColors.maintenance} name="Frekuensi" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
          </TabsContent>

          <TabsContent value="borrowing" className="space-y-4">
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <ChartCard title="Status Peminjaman" description="Distribusi status sesi peminjaman" className="xl:col-span-2">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={borrowingStatusData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="status" tick={{ fontSize: 10 }} interval={0} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="total" fill={chartColors.borrowing} name="Jumlah" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
              <ChartCard title="Ringkasan Peminjaman" description="Jumlah sesi berdasarkan status utama">
                <div className="grid min-h-75 content-center gap-3 px-2">
                  {borrowingStatusData.map((item) => (
                    <div key={item.status} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
                      <span className="text-sm text-slate-600">{item.status}</span>
                      <span className="text-sm font-semibold text-slate-950">{formatNumber(item.total)}</span>
                    </div>
                  ))}
                </div>
              </ChartCard>
            </div>
          </TabsContent>

          <TabsContent value="usage" className="space-y-4">
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <ChartCard title="Penggunaan Alat Per Bulan" description="Tren pemakaian alat sepanjang tahun" className="xl:col-span-2">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={usageMonthlyData} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} interval={0} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="total" stroke={chartColors.usage} strokeWidth={2} name="Total Pemakaian" dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>
              <ChartCard title="Konteks Penggunaan" description="Kategori penggunaan alat">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={usageContextData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="context" tick={{ fontSize: 10 }} interval={0} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="total" fill={chartColors.usage} name="Total" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <ChartCard title="Penggunaan Alat Per Ruangan" description="Sepuluh ruangan dengan pemakaian terbanyak" className="xl:col-span-2">
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={usageRoomData.slice(0, 10)} layout="vertical" margin={{ top: 8, right: 8, left: 18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                    <YAxis dataKey="room" type="category" width={118} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="total" fill={chartColors.usage} name="Total Pemakaian" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
              <ChartCard title="Penggunaan Tahunan" description="Akumulasi pemakaian per tahun">
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={usageYearData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="year" tick={{ fontSize: 10 }} interval={0} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="total" fill={chartColors.usage} name="Total Tahunan" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-8 border-t border-border pt-6 text-center">
          <p className="text-[13px] text-muted-foreground">
            Sistem Inventaris  Peminjaman serta Pemeliharaan  sarana (SiPeNa)
          </p>
        </div>
      </div>
    </div>
  )
}
