"use client"

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { API_BASE_URL } from "@/services/api.service";
import { assetUsageService, type AssetUsageLog } from "@/services/asset-usage.service";
import { assetService } from "@/services/asset.service";
import { getAuthToken } from "@/services/auth-utils";
import { borrowingService } from "@/services/borrowing.service";
import { maintenanceService } from "@/services/maintenance.service";
import reportService from "@/services/report.service";
import { parseDateValue } from "@/utils/format";
import {
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
  const [monthlyData, setMonthlyData] = useState<any[]>([])
  const [monthlyDataByLocation, setMonthlyDataByLocation] = useState<any[]>([])
  const [usageMonthlyData, setUsageMonthlyData] = useState<any[]>([])
  const [usageRoomData, setUsageRoomData] = useState<any[]>([])
  const [usageYearData, setUsageYearData] = useState<any[]>([])
  const [usageContextData, setUsageContextData] = useState<any[]>([])
  const [exporting, setExporting] = useState<"pdf" | "excel" | null>(null)
  const [exportFilters, setExportFilters] = useState({
    reportType: "assets",
    startDate: "",
    endDate: "",
    status: "",
    type: "",
  })

  const toArray = <T,>(value: T[] | undefined | null): T[] => (Array.isArray(value) ? value : [])

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
      if (key === "emergency") return "Emergency"
      if (key === "rounding") return "Antar Instalasi"
      if (key === "procedure") return "Antar Sub Ruangan"
      // default to room-related category for other contexts
      return "Ruangan"
    }

    const contextMap = logs.reduce<Record<string, number>>((acc, log) => {
      const category = classifyUsageCategory(log.usageContext)
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

  const totalNonMedicalAssets = nonMedicalRooms.length
  const totalMedicalAssets = medicalRooms.length
  const totalAssets = totalNonMedicalAssets + totalMedicalAssets

  const totalCost = maintenance.reduce((sum, m) => sum + (Number.parseInt(m.cost) || 0), 0)
  const totalUsageCount = assetUsageLogs.reduce((sum, log) => sum + (log.usageCount || 1), 0)
  const uniqueUsedAssets = assetUsageLogs.length > 0
    ? new Set(assetUsageLogs.map((log) => log.assetDetailName || log.assetName || String(log.assetId))).size
    : 0
  const inventorySummaryData = [
    { name: "Total", total: totalAssets },
    { name: "Non Medis", total: totalNonMedicalAssets },
    { name: "Medis", total: totalMedicalAssets },
  ]
  const operationalSummaryData = [
    { name: "Pemeliharaan", total: maintenance.length },
    { name: "Peminjaman", total: borrowings.length },
    { name: "Penggunaan", total: totalUsageCount },
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

  const handleExport = async (format: "pdf" | "excel") => {
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
    <div className="bg-slate-50/70 dark:bg-slate-950" data-main-scroll>
      <div className="mx-auto max-w-7xl space-y-5 page-gutter">
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Laporan operasional</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-950">Laporan & Analitik</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Pantau aset, pemeliharaan, peminjaman, dan penggunaan alat dalam satu tampilan ringkas.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={() => void handleExport("excel")} disabled={exporting !== null}>
              <FileSpreadsheet className="mr-2 size-4" />
              {exporting === "excel" ? "Menyiapkan..." : exportFilters.reportType === "all" ? "Excel Semua" : "Export Excel"}
            </Button>
            <Button type="button" onClick={() => void handleExport("pdf")} disabled={exporting !== null}>
              <Download className="mr-2 size-4" />
              {exporting === "pdf" ? "Menyiapkan..." : exportFilters.reportType === "all" ? "PDF Semua" : "Export PDF"}
            </Button>
          </div>
        </div>

        <Card className="rounded-lg border-slate-200 py-0 shadow-sm">
          <CardHeader className="border-b border-slate-100 px-4 py-3">
            <CardTitle className="text-sm font-semibold text-slate-900">Filter Export</CardTitle>
            <CardDescription className="text-xs">Atur jenis laporan, periode, status, dan jenis aset sebelum mengunduh file.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 px-4 py-4 md:grid-cols-6">
            <select
              aria-label="Jenis laporan"
              value={exportFilters.reportType}
              onChange={(event) => setExportFilters((current) => ({ ...current, reportType: event.target.value, status: "", type: "" }))}
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-xs outline-none transition focus:border-slate-400 md:col-span-1"
            >
              <option value="assets">Aset</option>
              <option value="borrowing">Peminjaman</option>
              <option value="maintenance">Pemeliharaan</option>
              <option value="all">Semua Modul</option>
            </select>
            <input
              aria-label="Tanggal mulai"
              type="date"
              value={exportFilters.startDate}
              onChange={(event) => setExportFilters((current) => ({ ...current, startDate: event.target.value }))}
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-xs outline-none transition focus:border-slate-400 md:col-span-1"
            />
            <input
              aria-label="Tanggal akhir"
              type="date"
              value={exportFilters.endDate}
              onChange={(event) => setExportFilters((current) => ({ ...current, endDate: event.target.value }))}
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-xs outline-none transition focus:border-slate-400 md:col-span-1"
            />
            <select
              aria-label="Status laporan"
              value={exportFilters.status}
              onChange={(event) => setExportFilters((current) => ({ ...current, status: event.target.value }))}
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-xs outline-none transition focus:border-slate-400 disabled:bg-slate-100 disabled:text-slate-400 md:col-span-1"
              disabled={exportFilters.reportType === "assets" || exportFilters.reportType === "all"}
            >
              <option value="">Semua status</option>
              {exportFilters.reportType === "borrowing" ? (
                <>
                  <option value="pending">Menunggu</option>
                  <option value="approved">Disetujui</option>
                  <option value="borrowed">Dipinjam</option>
                  <option value="returned">Dikembalikan</option>
                  <option value="overdue">Terlambat</option>
                </>
              ) : (
                <>
                  <option value="requested">Request</option>
                  <option value="scheduled">Terjadwal</option>
                  <option value="in_progress">Proses</option>
                  <option value="completed">Selesai</option>
                  <option value="validated">Tervalidasi</option>
                </>
              )}
            </select>
            <select
              aria-label="Jenis aset"
              value={exportFilters.type}
              onChange={(event) => setExportFilters((current) => ({ ...current, type: event.target.value }))}
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-xs outline-none transition focus:border-slate-400 disabled:bg-slate-100 disabled:text-slate-400 md:col-span-1"
              disabled={exportFilters.reportType === "all"}
            >
              <option value="">Semua jenis</option>
              {exportFilters.reportType === "maintenance" ? (
                <>
                  <option value="preventive">Preventive</option>
                  <option value="corrective">Corrective</option>
                  <option value="calibration">Calibration</option>
                  <option value="inspection">Inspection</option>
                </>
              ) : exportFilters.reportType === "all" ? null : (
                <>
                  <option value="medical">Medis</option>
                  <option value="non_medical">Non Medis</option>
                </>
              )}
            </select>
            <Button
              type="button"
              variant="outline"
              className="h-10 md:col-span-1"
              onClick={() => setExportFilters({ reportType: "assets", startDate: "", endDate: "", status: "", type: "" })}
            >
              <RotateCcw className="mr-2 size-4" />
              Reset
            </Button>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <MetricCard title="Total Aset" value={formatNumber(totalAssets)} description="Medis dan non medis" icon={Boxes} accentClassName="bg-sky-50 text-sky-700" />
          <MetricCard title="Aset Medis" value={formatNumber(totalMedicalAssets)} description="Inventaris klinis" icon={Stethoscope} accentClassName="bg-cyan-50 text-cyan-700" />
          <MetricCard title="Aset Non Medis" value={formatNumber(totalNonMedicalAssets)} description="Sarana pendukung" icon={PackageCheck} accentClassName="bg-indigo-50 text-indigo-700" />
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
              <ChartCard title="Komposisi Aset" description="Total, medis, dan non medis">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={inventorySummaryData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="total" fill={chartColors.assets} name="Jumlah Aset" radius={[6, 6, 0, 0]} />
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
              <ChartCard title="Komposisi Ruangan Aktif" description="Perbandingan total, medis, dan non medis" className="xl:col-span-2">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={inventorySummaryData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="total" fill={chartColors.assets} name="Jumlah Ruangan" radius={[6, 6, 0, 0]} />
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
            Sistem Inventaris dan Pemeliharaan Sarana Prasarana Peminjaman (SiPeNa)
          </p>
        </div>
      </div>
    </div>
  )
}
