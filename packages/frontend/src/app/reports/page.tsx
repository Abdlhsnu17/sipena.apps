"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { assetUsageService, type AssetUsageLog } from "@/services/asset-usage.service";
import { assetService } from "@/services/asset.service";
import { borrowingService } from "@/services/borrowing.service";
import { maintenanceService } from "@/services/maintenance.service";
import { parseDateValue } from "@/utils/format";
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

  return (
    <div
      className="bg-white dark:bg-slate-950"
      data-main-scroll
    >
      <div className="mx-auto max-w-7xl space-y-4 page-gutter">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Card className="rounded-lg border-0 bg-linear-to-br from-cyan-50/80 via-sky-50/70 to-blue-50/80 shadow-sm">
            <CardHeader className="border-b border-cyan-200/50 px-4 py-3">
              <CardTitle className="text-sm font-semibold text-cyan-800">Komposisi Ruangan Aktif</CardTitle>
              <CardDescription className="text-xs">Total, medis, dan non medis</CardDescription>
            </CardHeader>
            <CardContent className="px-3 py-3">
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={inventorySummaryData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#bae6fd" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="total" fill="#0284c7" name="Jumlah Ruangan" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="rounded-lg border-0 bg-linear-to-br from-emerald-50/80 via-teal-50/70 to-cyan-50/80 shadow-sm xl:col-span-2">
            <CardHeader className="border-b border-emerald-200/50 px-4 py-3">
              <CardTitle className="text-sm font-semibold text-emerald-800">Aktivitas Operasional</CardTitle>
              <CardDescription className="text-xs">Pemeliharaan, peminjaman, penggunaan, dan alat terpakai</CardDescription>
            </CardHeader>
            <CardContent className="px-3 py-3">
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={operationalSummaryData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#a7f3d0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="total" fill="#059669" name="Total" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Card className="rounded-lg border-0 bg-linear-to-br from-blue-50/80 via-indigo-50/70 to-slate-50/80 shadow-sm xl:col-span-2">
            <CardHeader className="border-b border-blue-200/50 px-4 py-3">
              <CardTitle className="text-sm font-semibold text-blue-800">Pemeliharaan Per Bulan</CardTitle>
              <CardDescription className="text-xs">Perbandingan jadwal tervalidasi dan belum validasi</CardDescription>
            </CardHeader>
            <CardContent className="px-3 py-3">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={monthlyData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#bfdbfe" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} interval={0} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="completed" stackId="maintenance" fill="#2563eb" name="Tervalidasi" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="pending" stackId="maintenance" fill="#f97316" name="Belum Validasi" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="rounded-lg border-0 bg-linear-to-br from-orange-50/80 via-amber-50/70 to-yellow-50/80 shadow-sm">
            <CardHeader className="border-b border-orange-200/50 px-4 py-3">
              <CardTitle className="text-sm font-semibold text-orange-800">Status Pemeliharaan</CardTitle>
              <CardDescription className="text-xs">Distribusi validasi jadwal</CardDescription>
            </CardHeader>
            <CardContent className="px-3 py-3">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={maintenanceStatusData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#fed7aa" />
                  <XAxis dataKey="status" tick={{ fontSize: 10 }} interval={0} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="total" fill="#f97316" name="Jumlah" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card className="rounded-lg border-0 bg-linear-to-br from-cyan-50/80 via-teal-50/70 to-emerald-50/80 shadow-sm">
            <CardHeader className="border-b border-cyan-200/50 px-4 py-3">
              <CardTitle className="text-sm font-semibold text-cyan-800">Pemeliharaan Per Ruangan</CardTitle>
              <CardDescription className="text-xs">Sepuluh ruangan dengan aktivitas terbanyak</CardDescription>
            </CardHeader>
            <CardContent className="px-3 py-3">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={maintenanceRoomData} layout="vertical" margin={{ top: 8, right: 8, left: 18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#99f6e4" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                  <YAxis dataKey="room" type="category" width={118} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="total" fill="#0891b2" name="Total Pemeliharaan" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="rounded-lg border-0 bg-linear-to-br from-indigo-50/80 via-blue-50/70 to-cyan-50/80 shadow-sm">
            <CardHeader className="border-b border-indigo-200/50 px-4 py-3">
              <CardTitle className="text-sm font-semibold text-indigo-800">Inventaris Sering Dipelihara</CardTitle>
              <CardDescription className="text-xs">Delapan inventaris teratas</CardDescription>
            </CardHeader>
            <CardContent className="px-3 py-3">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={maintenanceAssetData} layout="vertical" margin={{ top: 8, right: 8, left: 18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#c7d2fe" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" width={118} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="total" fill="#4f46e5" name="Frekuensi" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Card className="rounded-lg border-0 bg-linear-to-br from-emerald-50/80 via-green-50/70 to-teal-50/80 shadow-sm xl:col-span-2">
            <CardHeader className="border-b border-emerald-200/50 px-4 py-3">
              <CardTitle className="text-sm font-semibold text-emerald-800">Penggunaan Alat Per Bulan</CardTitle>
              <CardDescription className="text-xs">Tren pemakaian alat sepanjang tahun</CardDescription>
            </CardHeader>
            <CardContent className="px-3 py-3">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={usageMonthlyData} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#a7f3d0" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} interval={0} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="total" stroke="#059669" strokeWidth={2} name="Total Pemakaian" dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="rounded-lg border-0 bg-linear-to-br from-violet-50/80 via-purple-50/70 to-fuchsia-50/80 shadow-sm">
            <CardHeader className="border-b border-violet-200/50 px-4 py-3">
              <CardTitle className="text-sm font-semibold text-violet-800">Konteks Penggunaan</CardTitle>
              <CardDescription className="text-xs">Kategori penggunaan alat</CardDescription>
            </CardHeader>
            <CardContent className="px-3 py-3">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={usageContextData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ddd6fe" />
                  <XAxis dataKey="context" tick={{ fontSize: 10 }} interval={0} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="total" fill="#7c3aed" name="Total" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Card className="rounded-lg border-0 bg-linear-to-br from-teal-50/80 via-emerald-50/70 to-green-50/80 shadow-sm xl:col-span-2">
            <CardHeader className="border-b border-teal-200/50 px-4 py-3">
              <CardTitle className="text-sm font-semibold text-teal-800">Penggunaan Alat Per Ruangan</CardTitle>
              <CardDescription className="text-xs">Sepuluh ruangan dengan pemakaian terbanyak</CardDescription>
            </CardHeader>
            <CardContent className="px-3 py-3">
              <ResponsiveContainer width="100%" height={310}>
                <BarChart data={usageRoomData.slice(0, 10)} layout="vertical" margin={{ top: 8, right: 8, left: 18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#99f6e4" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                  <YAxis dataKey="room" type="category" width={118} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="total" fill="#0d9488" name="Total Pemakaian" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="rounded-lg border-0 bg-linear-to-br from-fuchsia-50/80 via-pink-50/70 to-rose-50/80 shadow-sm">
            <CardHeader className="border-b border-fuchsia-200/50 px-4 py-3">
              <CardTitle className="text-sm font-semibold text-fuchsia-800">Penggunaan Tahunan</CardTitle>
              <CardDescription className="text-xs">Akumulasi pemakaian per tahun</CardDescription>
            </CardHeader>
            <CardContent className="px-3 py-3">
              <ResponsiveContainer width="100%" height={310}>
                <BarChart data={usageYearData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5d0fe" />
                  <XAxis dataKey="year" tick={{ fontSize: 10 }} interval={0} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="total" fill="#c026d3" name="Total Tahunan" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Card className="rounded-lg border-0 bg-linear-to-br from-sky-50/80 via-blue-50/70 to-indigo-50/80 shadow-sm xl:col-span-2">
            <CardHeader className="border-b border-sky-200/50 px-4 py-3">
              <CardTitle className="text-sm font-semibold text-sky-800">Alat Paling Sering Dipakai</CardTitle>
              <CardDescription className="text-xs">Delapan alat dengan frekuensi pemakaian tertinggi</CardDescription>
            </CardHeader>
            <CardContent className="px-3 py-3">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={usedAssetData} layout="vertical" margin={{ top: 8, right: 8, left: 18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#bae6fd" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" width={118} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="total" fill="#0284c7" name="Total Pemakaian" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="rounded-lg border-0 bg-linear-to-br from-rose-50/80 via-red-50/70 to-orange-50/80 shadow-sm">
            <CardHeader className="border-b border-rose-200/50 px-4 py-3">
              <CardTitle className="text-sm font-semibold text-rose-800">Status Peminjaman</CardTitle>
              <CardDescription className="text-xs">Distribusi status sesi peminjaman</CardDescription>
            </CardHeader>
            <CardContent className="px-3 py-3">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={borrowingStatusData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#fecdd3" />
                  <XAxis dataKey="status" tick={{ fontSize: 10 }} interval={0} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="total" fill="#e11d48" name="Jumlah" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Card className="rounded-lg border-0 bg-linear-to-br from-slate-50/80 via-zinc-50/70 to-stone-50/80 shadow-sm xl:col-span-3">
            <CardHeader className="border-b border-slate-200/50 px-4 py-3">
              <CardTitle className="text-sm font-semibold text-slate-800">Biaya Pemeliharaan</CardTitle>
              <CardDescription className="text-xs">Total nilai biaya perawatan tersimpan</CardDescription>
            </CardHeader>
            <CardContent className="px-3 py-3">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={maintenanceCostData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="total" fill="#475569" name="Rupiah" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 pt-6 border-t border-border text-center">
          <p className="text-[13px] text-muted-foreground">
            Sistem Inventaris dan Pemeliharaan Sarana Prasarana Peminjaman (SiPeNa)
          </p>
        </div>
      </div>
    </div>
  )
}
