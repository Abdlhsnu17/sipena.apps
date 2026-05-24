"use client"

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { assetUsageService, type AssetUsageLog } from "@/services/asset-usage.service";
import { assetService, type Asset } from "@/services/asset.service";
import { borrowingService } from "@/services/borrowing.service";
import { maintenanceService } from "@/services/maintenance.service";
import type { DetailInventoryItem } from "@/types/detail-inventory";
import { flattenDetailInventories } from "@/utils/detail-inventory";
import { parseDateValue } from "@/utils/format";
import ExcelJS from "exceljs";
import { BookOpen } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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
  const [assetDetails, setAssetDetails] = useState<DetailInventoryItem[]>([])

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
        let medicalAssets: Asset[] = []
        let nonMedicalAssets: Asset[] = []

        if (medicalResult.status === "fulfilled" && medicalResult.value.success) {
          const medicalData = toArray(medicalResult.value.data)
          setMedicalRooms(medicalData)
          medicalAssets = medicalData
        } else if (medicalResult.status === "rejected") {
          console.error("Failed to load medical assets:", medicalResult.reason)
        }

        if (nonMedicalResult.status === "fulfilled" && nonMedicalResult.value.success) {
          const nonMedicalData = toArray(nonMedicalResult.value.data)
          setNonMedicalRooms(nonMedicalData)
          nonMedicalAssets = nonMedicalData
        } else if (nonMedicalResult.status === "rejected") {
          console.error("Failed to load non-medical assets:", nonMedicalResult.reason)
        }

        const combinedAssets = [...medicalAssets, ...nonMedicalAssets]
        if (combinedAssets.length > 0) {
          setAssetDetails(flattenDetailInventories(combinedAssets, { includeAssetFallback: true }))
        } else {
          setAssetDetails([])
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
  }, [generateMonthlyData])

  const totalNonMedicalAssets = nonMedicalRooms.length
  const totalMedicalAssets = medicalRooms.length
  const totalAssets = totalNonMedicalAssets + totalMedicalAssets

  // Group assets by location/room
  const getDistributionByLocation = () => {
    const locationMap = new Map<string, number>()
    
    ;[...nonMedicalRooms, ...medicalRooms].forEach((asset) => {
      const location = asset.location || "Tidak Ditentukan"
      locationMap.set(location, (locationMap.get(location) || 0) + 1)
    })
    
    return Array.from(locationMap, ([name, value]) => ({ name, value }))
  }

  // distributionData not currently used in the UI; remove to avoid unused var

  const totalCost = maintenance.reduce((sum, m) => sum + (Number.parseInt(m.cost) || 0), 0)
  const totalUsageCount = assetUsageLogs.reduce((sum, log) => sum + (log.usageCount || 1), 0)
  const usageRoomTop = usageRoomData[0]
  const usageYearTop = usageYearData[0]
  const topUsedAsset = Object.values(
    assetUsageLogs.reduce<Record<string, { label: string; count: number }>>((acc, log) => {
      const key = log.assetDetailName || log.assetName || `Aset ${log.assetId}`
      acc[key] = { label: key, count: (acc[key]?.count || 0) + (log.usageCount || 1) }
      return acc
    }, {})
  ).sort((a, b) => b.count - a.count)[0]
  const topUsageContext = usageContextData[0]

  const exportReport = async () => {
    const createdAt = new Date()
    const createdAtLabel = createdAt.toLocaleString("id-ID")
    const summaryEntries = [
      ["Dicetak pada", createdAtLabel],
      ["Total inventaris non medis", totalNonMedicalAssets.toLocaleString("id-ID")],
      ["Total inventaris medis", totalMedicalAssets.toLocaleString("id-ID")],
      ["Total inventaris", totalAssets.toLocaleString("id-ID")],
      ["Total pemeliharaan tersimpan", maintenance.length.toString()],
      ["Total peminjaman", borrowings.length.toString()],
      ["Total penggunaan alat", totalUsageCount.toLocaleString("id-ID")],
      ["Total biaya", `Rp ${totalCost.toLocaleString("id-ID")}`],
    ]

    const workbook = new ExcelJS.Workbook()
    workbook.creator = "SIPENARS"
    workbook.created = createdAt

    const summarySheet = workbook.addWorksheet("Ringkasan")
    summarySheet.columns = [
      { header: "Keterangan", width: 35 },
      { header: "Nilai", width: 50 },
    ]
    summaryEntries.forEach(([label, value]) => summarySheet.addRow([label, value]))

    const buildSheet = (title: string, rows: any[]) => {
      const sheet = workbook.addWorksheet(title)
      if (!rows?.length) {
        sheet.addRow(["Tidak ada data tersedia"])
        return
      }
      const columns = new Set<string>()
      rows.forEach((row) => {
        if (row && typeof row === "object") {
          Object.keys(row).forEach((key) => columns.add(key))
        }
      })
      if (!columns.size) {
        sheet.addRow(["Tidak ada kolom yang dapat ditampilkan"])
        return
      }
      const headers = Array.from(columns)
      sheet.addRow(headers)
      const formatCell = (value: unknown) => {
        if (value === null || value === undefined) return ""
        if (typeof value === "object") return JSON.stringify(value)
        return value
      }
      rows.forEach((row) => {
        const rowValues = headers.map((header) => formatCell(row?.[header]))
        sheet.addRow(rowValues)
      })
    }

    const detailRows = assetDetails.map((detail) => ({
      ...detail,
      keterangan: detail.notes ?? detail.detailInventoryName ?? detail.detailName ?? detail.detailCode ?? "",
    }))

    buildSheet("Inventaris Non Medis", nonMedicalRooms)
    buildSheet("Inventaris Medis", medicalRooms)
    buildSheet("Rincian Barang", detailRows)
    buildSheet("Pemeliharaan", maintenance)
    buildSheet("Peminjaman", borrowings)
    buildSheet("Statistik Bulanan", monthlyData)
    buildSheet("Penggunaan Alat", assetUsageLogs)
    buildSheet("Penggunaan Per Ruangan", usageRoomData)
    buildSheet("Penggunaan Per Tahun", usageYearData)
    buildSheet("Statistik Penggunaan", usageMonthlyData)

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })
    const objectUrl = URL.createObjectURL(blob)
    const element = document.createElement("a")
    element.href = objectUrl
    element.download = `laporan-${createdAt.toISOString().split("T")[0]}.xlsx`
    element.style.display = "none"
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
    URL.revokeObjectURL(objectUrl)
  }

  return (
    <div
      className="bg-white dark:bg-slate-950"
      data-main-scroll
    >
      <div className="mx-auto max-w-7xl space-y-8 page-gutter">

        <section className="rounded-2xl border border-slate-200/70 bg-white/90 panel-gutter shadow-sm backdrop-blur-sm dark:border-slate-800/70 dark:bg-slate-900/60">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <div className="flex items-start gap-3 sm:items-center">
                <div className="rounded-2xl bg-linear-to-br from-cyan-500 to-teal-500 p-2.5 shadow-lg">
                  <BookOpen className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold leading-tight text-foreground sm:text-2xl lg:text-3xl">
                    Laporan & Analitik
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Ringkasan operasional inventaris, pemeliharaan, dan peminjaman.
                  </p>
                </div>
              </div>

            </div>
            <Button onClick={exportReport} className="w-full rounded-2xl bg-slate-700 px-5 text-white shadow-lg hover:bg-slate-800 sm:w-auto">
              Unduh Laporan
            </Button>
          </div>
        </section>

        <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4 shadow-sm backdrop-blur-sm dark:border-slate-800/70 dark:bg-slate-900/50">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-linear-to-br from-cyan-500 to-teal-500 p-2">
              <BookOpen className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">Ringkasan Terpadu</h3>
              <p className="mt-1 text-sm text-slate-700/80 dark:text-slate-300/80">
                Laporan ini menyatukan titik data penting dari inventaris, pemeliharaan, peminjaman, dan penggunaan alat untuk mendukung keputusan operasional.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
          <Card className="rounded-2xl border-0 bg-linear-to-br from-cyan-50/80 via-cyan-100/60 to-blue-50/80 shadow-md transition-shadow hover:shadow-lg">
            <CardHeader className="border-0 px-4 pt-2 pb-0 sm:px-5 sm:pt-2.5">
              <CardTitle className="text-[10px] uppercase tracking-[0.28em] text-cyan-700">
                Total Keseluruhan Ruangan Yang Aktif 
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-2 pt-0 sm:px-5 sm:pb-2.5">
              <p className="text-[1.85rem] font-semibold leading-none text-cyan-900 sm:text-[2rem]">{totalAssets.toLocaleString("id-ID")}</p>
              <p className="mt-0.5 text-[10px] leading-snug text-cyan-600">Gabungan Ruangan Medis & Non-Medis</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-0 bg-linear-to-br from-teal-50/80 via-emerald-100/60 to-green-50/80 shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="border-0 px-4 pt-2 pb-0 sm:px-5 sm:pt-2.5">
              <CardTitle className="text-[10px] uppercase tracking-[0.28em] text-teal-700">
                Ruangan Dengan Unit Non Medis Aktif
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-2 pt-0 sm:px-5 sm:pb-2.5">
              <p className="text-[1.85rem] font-semibold leading-none text-teal-900 sm:text-[2rem]">
                {totalNonMedicalAssets.toLocaleString("id-ID")}
              </p>
              <p className="mt-0.5 text-[10px] leading-snug text-teal-600">Ruangan Aktif Dengan Unit Non-Medis Yang Berbeda</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-0 bg-linear-to-br from-blue-50/80 via-indigo-100/60 to-purple-50/80 shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="border-0 px-4 pt-2 pb-0 sm:px-5 sm:pt-2.5">
              <CardTitle className="text-[10px] uppercase tracking-[0.28em] text-blue-700">
                Ruangan Dengan Unit Medis Aktif
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-2 pt-0 sm:px-5 sm:pb-2.5">
              <p className="text-[1.85rem] font-semibold leading-none text-blue-900 sm:text-[2rem]">
                {totalMedicalAssets.toLocaleString("id-ID")}
              </p>
              <p className="mt-0.5 text-[10px] leading-snug text-blue-600">Ruangan Aktif Dengan Unit Medis Yang Berbeda</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-0 bg-linear-to-br from-rose-50/80 via-red-100/60 to-orange-50/80 shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="border-0 px-4 pt-2 pb-0 sm:px-5 sm:pt-2.5">
              <CardTitle className="text-[10px] uppercase tracking-[0.28em] text-rose-700">
                Total Pemeliharaan
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-2 pt-0 sm:px-5 sm:pb-2.5">
              <p className="text-[1.85rem] font-semibold leading-none text-rose-900 sm:text-[2rem]">
                {maintenance.length.toLocaleString("id-ID")}
              </p>
              <p className="mt-0.5 text-[10px] leading-snug text-rose-600">Jadwal tersimpan</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-0 bg-linear-to-br from-orange-50/80 via-amber-100/60 to-yellow-50/80 shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="border-0 px-4 pt-2 pb-0 sm:px-5 sm:pt-2.5">
              <CardTitle className="text-[10px] uppercase tracking-[0.28em] text-orange-700">
                Total Peminjaman
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-2 pt-0 sm:px-5 sm:pb-2.5">
              <p className="text-[1.85rem] font-semibold leading-none text-orange-900 sm:text-[2rem]">
                {borrowings.length.toLocaleString("id-ID")}
              </p>
              <p className="mt-0.5 text-[10px] leading-snug text-orange-600">Sesi perizinan</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-0 bg-linear-to-br from-violet-50/80 via-fuchsia-100/60 to-pink-50/80 shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="border-0 px-4 pt-2 pb-0 sm:px-5 sm:pt-2.5">
              <CardTitle className="text-[10px] uppercase tracking-[0.28em] text-violet-700">
                Total Biaya
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-2 pt-0 sm:px-5 sm:pb-2.5">
              <p className="text-[1.85rem] font-semibold leading-none text-violet-900 sm:text-[2rem]">
                Rp {totalCost.toLocaleString("id-ID")}
              </p>
              <p className="mt-0.5 text-[10px] leading-snug text-violet-600">Nilai biaya perawatan</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
          <Card className="rounded-3xl border-0 bg-linear-to-br from-slate-50/80 via-gray-100/60 to-zinc-50/80 shadow-md lg:col-span-2">
            <CardHeader className="border-0 p-4 border-b border-slate-200/50">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-lg font-semibold leading-tight">Status Ringkas</CardTitle>
                <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-300">
                  Real-time
                </Badge>
              </div>
              <CardDescription className="text-sm text-muted-foreground">
                Menyajikan ringkasan KPI maintenance dan peminjaman sesuai panduan UI/UX terbaru.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-border/40 bg-white/80 p-3 space-y-1">
                  <p className="text-xs text-muted-foreground">Total maintenance</p>
                  <p className="text-lg font-semibold">{maintenance.length}</p>
                </div>
                <div className="rounded-2xl border border-border/40 bg-white/80 p-3 space-y-1">
                  <p className="text-xs text-muted-foreground">Total peminjaman</p>
                  <p className="text-lg font-semibold">{borrowings.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
          <Card className="rounded-3xl border-0 bg-linear-to-br from-emerald-50/80 via-green-100/60 to-teal-50/80 shadow-md">
            <CardHeader className="border-b border-emerald-200/50">
              <CardTitle>Penggunaan Alat Per Bulan</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={usageMonthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d1fae5" />
                  <XAxis dataKey="month" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="total" stroke="#059669" strokeWidth={2} name="Total Pemakaian" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-0 bg-linear-to-br from-teal-50/80 via-cyan-100/60 to-blue-50/80 shadow-md">
            <CardHeader className="border-b border-teal-200/50">
              <CardTitle>Ringkasan Penggunaan Alat</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-col gap-2 rounded-2xl border border-teal-200 bg-white/80 p-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm font-medium text-foreground">Total penggunaan</span>
                <Badge className="bg-teal-100 text-teal-700 border-0">{totalUsageCount.toLocaleString("id-ID")}</Badge>
              </div>
              <div className="flex flex-col gap-2 rounded-2xl border border-cyan-200 bg-white/80 p-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm font-medium text-foreground">Alat terpakai</span>
                <Badge className="bg-cyan-100 text-cyan-700 border-0">{assetUsageLogs.length > 0 ? new Set(assetUsageLogs.map((log) => log.assetDetailName || log.assetName || String(log.assetId))).size : 0}</Badge>
              </div>
              <div className="flex flex-col gap-2 rounded-2xl border border-emerald-200 bg-white/80 p-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm font-medium text-foreground">Konteks terbanyak</span>
                <Badge className="bg-emerald-100 text-emerald-700 border-0">{topUsageContext ? `${topUsageContext.context} (${topUsageContext.total})` : "Belum ada data"}</Badge>
              </div>
              <div className="flex flex-col gap-2 rounded-2xl border border-blue-200 bg-white/80 p-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm font-medium text-foreground">Aset paling sering dipakai</span>
                <Badge className="bg-blue-100 text-blue-700 border-0">{topUsedAsset ? `${topUsedAsset.label} (${topUsedAsset.count})` : "Belum ada data"}</Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-0 bg-linear-to-br from-cyan-50/80 via-teal-100/60 to-green-50/80 shadow-md lg:col-span-2">
            <CardHeader className="border-b border-cyan-200/50">
              <CardTitle>Pemeliharaan Per Ruangan</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {monthlyDataByLocation.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Tidak ada data pemeliharaan</p>
                ) : (
                  monthlyDataByLocation.map((item, idx) => {
                    const colors = [
                      "bg-cyan-50 border-cyan-200 text-cyan-700",
                      "bg-teal-50 border-teal-200 text-teal-700",
                      "bg-emerald-50 border-emerald-200 text-emerald-700",
                      "bg-green-50 border-green-200 text-green-700",
                      "bg-blue-50 border-blue-200 text-blue-700",
                      "bg-sky-50 border-sky-200 text-sky-700",
                    ]
                    const colorClass = colors[idx % colors.length]
                    const totalMaintenance = Object.values(item).reduce((sum: number, val: any) => {
                      return typeof val === "number" ? sum + val : sum
                    }, 0)
                    return (
                      <div key={item.location} className={`flex flex-col gap-2 p-2 sm:flex-row sm:items-center sm:justify-between border rounded ${colorClass}`}>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{item.location}</span>
                        </div>
                        <Badge className="bg-current/20 text-current border-0 text-xs">{totalMaintenance} kali</Badge>
                      </div>
                    )
                  }))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="rounded-3xl border-0 bg-linear-to-br from-emerald-50/80 via-green-100/60 to-teal-50/80 shadow-md lg:col-span-2">
            <CardHeader className="border-b border-emerald-200/50">
              <CardTitle>Penggunaan Alat Per Ruangan</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={usageRoomData.slice(0, 10)} layout="vertical" margin={{ left: 16, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d1fae5" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis dataKey="room" type="category" width={150} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="total" fill="#059669" name="Total Pemakaian" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-0 bg-linear-to-br from-violet-50/80 via-fuchsia-100/60 to-pink-50/80 shadow-md">
            <CardHeader className="border-b border-violet-200/50">
              <CardTitle>Akumulasi Tahunan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={usageYearData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e9d5ff" />
                  <XAxis dataKey="year" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="total" fill="#7c3aed" name="Total Tahunan" />
                </BarChart>
              </ResponsiveContainer>
              <div className="space-y-3">
                <div className="rounded-2xl border border-violet-200 bg-white/80 p-3">
                  <p className="text-xs text-muted-foreground">Ruangan terdata</p>
                  <p className="text-lg font-semibold">{usageRoomData.length}</p>
                </div>
                <div className="rounded-2xl border border-fuchsia-200 bg-white/80 p-3">
                  <p className="text-xs text-muted-foreground">Tahun tertinggi</p>
                  <p className="text-lg font-semibold">{usageYearTop ? `${usageYearTop.year} (${usageYearTop.total})` : "Belum ada data"}</p>
                </div>
                <div className="rounded-2xl border border-pink-200 bg-white/80 p-3">
                  <p className="text-xs text-muted-foreground">Ruangan terpadat</p>
                  <p className="text-lg font-semibold">{usageRoomTop ? `${usageRoomTop.room} (${usageRoomTop.total})` : "Belum ada data"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
          <Card className="rounded-3xl border-0 bg-linear-to-br from-blue-50/80 via-indigo-100/60 to-purple-50/80 shadow-md">
            <CardHeader className="border-b border-blue-200/50">
              <CardTitle>Inventaris Paling Sering Dipelihara</CardTitle>
            </CardHeader>
            <CardContent>
              {maintenance.length === 0 ? (
                <p className="text-muted-foreground text-sm">Tidak ada data</p>
              ) : (
                <div className="space-y-2">
                  {[...new Set(maintenance.map((m) => m.assetDetailName || m.assetName))]
                    .map((name) => ({
                      name,
                      count: maintenance.filter((m) => (m.assetDetailName || m.assetName) === name).length,
                    }))
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 5)
                    .map((item, idx) => {
                      const colors = [
                        "bg-blue-50/80 border-blue-200 text-blue-700",
                        "bg-cyan-50/80 border-cyan-200 text-cyan-700",
                        "bg-teal-50/80 border-teal-200 text-teal-700",
                        "bg-emerald-50/80 border-emerald-200 text-emerald-700",
                        "bg-indigo-50/80 border-indigo-200 text-indigo-700",
                      ]
                      const colorClass = colors[idx % colors.length]
                      return (
                        <div key={idx} className={`flex flex-col gap-2 p-2 sm:flex-row sm:items-center sm:justify-between border rounded ${colorClass}`}>
                          <span className="font-medium">{item.name}</span>
                          <Badge className="bg-current/20 text-current border-0">{item.count}x</Badge>
                        </div>
                      )
                    })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-0 bg-linear-to-br from-rose-50/80 via-pink-100/60 to-red-50/80 shadow-md">
            <CardHeader className="border-b border-rose-200/50">
              <CardTitle>Statistik Peminjaman</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex flex-col gap-1.5 px-3 py-2 sm:flex-row sm:items-center sm:justify-between border border-blue-200 bg-blue-50/50 rounded">
                  <span className="text-foreground font-medium">Total Peminjaman</span>
                  <Badge className="bg-blue-100 text-blue-700 border-0">{borrowings.length}</Badge>
                </div>
                <div className="flex flex-col gap-1.5 px-3 py-2 sm:flex-row sm:items-center sm:justify-between border border-emerald-200 bg-emerald-50/50 rounded">
                  <span className="text-foreground font-medium">Sedang Dipinjam</span>
                  <Badge className="bg-emerald-100 text-emerald-700 border-0">
                    {borrowings.filter((b) => ["approved", "borrowed"].includes(b.status)).length}
                  </Badge>
                </div>
                <div className="flex flex-col gap-1.5 px-3 py-2 sm:flex-row sm:items-center sm:justify-between border border-cyan-200 bg-cyan-50/50 rounded">
                  <span className="text-foreground font-medium">Dikembalikan</span>
                  <Badge className="bg-cyan-100 text-cyan-700 border-0">
                    {borrowings.filter((b) => b.status === "returned").length}
                  </Badge>
                </div>
                <div className="flex flex-col gap-1.5 px-3 py-2 sm:flex-row sm:items-center sm:justify-between border border-red-200 bg-red-50/50 rounded">
                  <span className="text-foreground font-medium">Terlambat</span>
                  <Badge className="bg-red-100 text-red-700 border-0">
                    {borrowings.filter((b) => b.status === "overdue").length}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 pt-6 border-t border-border text-center">
          <p className="text-[13px] text-muted-foreground">
            Sistem Inventaris Peminjaman Serta Pemeliharaan Sarana
          </p>
        </div>
      </div>
    </div>
  )
}
