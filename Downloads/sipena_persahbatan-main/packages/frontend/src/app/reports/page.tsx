"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { assetService, type Asset } from "@/services/asset.service"
import { borrowingService } from "@/services/borrowing.service"
import { maintenanceService } from "@/services/maintenance.service"
import type { DetailInventoryItem } from "@/types/detail-inventory"
import { flattenDetailInventories } from "@/utils/detail-inventory"
import { parseDateValue } from "@/utils/format"
import ExcelJS from "exceljs"
import { BookOpen, ChartBar } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
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
    YAxis,
} from "recharts"

/**
 * Komponen Halaman Laporan & Analitik.
 * Mengambil data inventaris, pemeliharaan, dan peminjaman dari API.
 */
export default function ReportsPage() {
  const router = useRouter()

  const [nonMedicalRooms, setNonMedicalRooms] = useState<any[]>([])
  const [medicalRooms, setMedicalRooms] = useState<any[]>([])
  const [maintenance, setMaintenance] = useState<any[]>([])
  const [borrowings, setBorrowings] = useState<any[]>([])
  const [monthlyData, setMonthlyData] = useState<any[]>([])
  const [assetDetails, setAssetDetails] = useState<DetailInventoryItem[]>([])

  const toArray = <T,>(value: T[] | undefined | null): T[] => (Array.isArray(value) ? value : [])

  const generateMonthlyData = useCallback((data: any[]) => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

    const monthlyStats = months.map((month, index) => ({
      month,
      completed: data.filter((m) => {
        const monthIndex = parseDateValue(m.scheduledDate)?.getMonth()
        return monthIndex === index && m.status === "completed"
      }).length,
      pending: data.filter((m) => {
        const monthIndex = parseDateValue(m.scheduledDate)?.getMonth()
        return monthIndex === index && m.status !== "completed"
      }).length,
    }))

    setMonthlyData(monthlyStats)
  }, [])

  useEffect(() => {
    const loadReportData = async () => {
      try {
        const results = await Promise.allSettled([
          assetService.getMedicalAssets({ page: 1, limit: 1000 }),
          assetService.getNonMedicalAssets({ page: 1, limit: 1000 }),
          maintenanceService.getAll({ page: 1, limit: 1000 }),
          borrowingService.getAll({ page: 1, limit: 1000 }),
        ])

        const [medicalResult, nonMedicalResult, maintenanceResult, borrowingResult] = results
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
      } catch (error) {
        console.error("An unexpected error occurred in loadReportData:", error)
      }
    }

    loadReportData()
  }, [generateMonthlyData])

  const totalNonMedicalAssets = nonMedicalRooms.length
  const totalMedicalAssets = medicalRooms.length
  const totalAssets = totalNonMedicalAssets + totalMedicalAssets

  const distributionData = [
    { name: "Inventaris Non Medis", value: totalNonMedicalAssets, color: "#14b8a6" },
    { name: "Inventaris Medis", value: totalMedicalAssets, color: "#06b6d4" },
  ]

  const totalCost = maintenance.reduce((sum, m) => sum + (Number.parseInt(m.cost) || 0), 0)

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
      className="flex-1 bg-gradient-to-br from-slate-50 via-white to-teal-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-teal-950/30 min-h-screen"
      data-main-scroll
    >
      <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">

        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-1 lg:pr-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-500 shadow-xl">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold leading-tight bg-gradient-to-r from-teal-600 to-cyan-500 bg-clip-text text-transparent">
                  Laporan & Analitik
                </h1>
                <p className="text-sm text-muted-foreground">
                  Analisis inventaris, pemeliharaan, dan peminjaman berbasis versi terbaru.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200">
                {/* ... */}
              </Badge>
              <Badge variant="outline" className="bg-white/70 text-slate-700 border-slate-200">
                <ChartBar className="w-3 h-3 mr-1" />
                Laporan Terintegrasi
              </Badge>
            </div>
          </div>
          <Button onClick={exportReport} className="bg-teal-600 hover:bg-teal-700 text-white shadow-lg">
            Unduh Laporan
          </Button>
        </div>

        <div className="p-4 bg-gradient-to-r from-teal-500/10 via-cyan-500/10 to-blue-500/10 border border-teal-200/60 rounded-3xl backdrop-blur-sm">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-teal-100 rounded-xl">
              <BookOpen className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <h3 className="font-semibold text-teal-800">Ringkasan Terpadu</h3>
              <p className="text-sm text-teal-700/80 mt-1">
                Laporan ini menyatukan titik data penting dari inventaris, pemeliharaan, dan peminjaman untuk mendukung keputusan operasional.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="rounded-3xl border border-border bg-white/80 shadow-sm">
            <CardHeader className="pb-1 border-0">
              <CardTitle className="text-xs uppercase tracking-[0.4em] text-muted-foreground">
                Total Inventaris
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-4xl font-semibold text-foreground">{totalAssets.toLocaleString("id-ID")}</p>
              <p className="text-xs text-muted-foreground mt-1">Gabungan medis & non-medis</p>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border border-border bg-white/80 shadow-sm">
            <CardHeader className="pb-1 border-0">
              <CardTitle className="text-xs uppercase tracking-[0.4em] text-muted-foreground">
                Inventaris Non Medis
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-4xl font-semibold text-teal-600">
                {totalNonMedicalAssets.toLocaleString("id-ID")}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Unit non-medis</p>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border border-border bg-white/80 shadow-sm">
            <CardHeader className="pb-1 border-0">
              <CardTitle className="text-xs uppercase tracking-[0.4em] text-muted-foreground">
                Inventaris Medis
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-4xl font-semibold text-cyan-600">
                {totalMedicalAssets.toLocaleString("id-ID")}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Unit medis</p>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border border-border bg-white/80 shadow-sm">
            <CardHeader className="pb-1 border-0">
              <CardTitle className="text-xs uppercase tracking-[0.4em] text-muted-foreground">
                Total Pemeliharaan
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-4xl font-semibold text-foreground">
                {maintenance.length.toLocaleString("id-ID")}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Jadwal tersimpan</p>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border border-border bg-white/80 shadow-sm">
            <CardHeader className="pb-1 border-0">
              <CardTitle className="text-xs uppercase tracking-[0.4em] text-muted-foreground">
                Total Peminjaman
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-4xl font-semibold text-teal-700">
                {borrowings.length.toLocaleString("id-ID")}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Sesi perizinan</p>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border border-border bg-white/80 shadow-sm">
            <CardHeader className="pb-1 border-0">
              <CardTitle className="text-xs uppercase tracking-[0.4em] text-muted-foreground">
                Total Biaya
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-3xl font-semibold text-foreground">
                Rp {totalCost.toLocaleString("id-ID")}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Nilai biaya perawatan</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="rounded-[32px] border border-cyan-200/80 bg-gradient-to-br from-slate-50 to-white/80 shadow-xl">
            <CardHeader className="border-0 p-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold leading-tight">Status Ringkas</CardTitle>
                <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200">
                  Real-time
                </Badge>
              </div>
              <CardDescription className="text-sm text-muted-foreground">
                Menyajikan ringkasan KPI maintenance dan peminjaman sesuai panduan UI/UX terbaru.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="rounded-3xl border border-border bg-white/90 shadow-sm">
            <CardHeader className="border-b border-border/60">
              <CardTitle>Pemeliharaan Per Bulan</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="completed" stroke="#10b981" name="Selesai" />
                  <Line type="monotone" dataKey="pending" stroke="#ef4444" name="Tertunda" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border border-border bg-white/90 shadow-sm">
            <CardHeader className="border-b border-border/60">
              <CardTitle>Distribusi Inventaris</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={distributionData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#14b8a6" name="Jumlah Unit" />
                </BarChart>
              </ResponsiveContainer>

              <div className="mt-4 space-y-2">
                {distributionData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between p-2 border border-border rounded">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-foreground">{item.name}</span>
                    </div>
                    <Badge>{item.value} unit</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="rounded-3xl border border-border bg-white/90 shadow-sm">
            <CardHeader className="border-b border-border/60">
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
                    .map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center p-2 border border-border rounded">
                        <span className="text-foreground">{item.name}</span>
                        <Badge variant="secondary">{item.count}x</Badge>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border border-border bg-white/90 shadow-sm">
            <CardHeader className="border-b border-border/60">
              <CardTitle>Statistik Peminjaman</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between items-center p-2 border border-border rounded">
                  <span className="text-foreground">Total Peminjaman</span>
                  <Badge>{borrowings.length}</Badge>
                </div>
                <div className="flex justify-between items-center p-2 border border-border rounded">
                  <span className="text-foreground">Sedang Dipinjam</span>
                  <Badge variant="secondary">
                    {borrowings.filter((b) => ["approved", "borrowed"].includes(b.status)).length}
                  </Badge>
                </div>
                <div className="flex justify-between items-center p-2 border border-border rounded">
                  <span className="text-foreground">Dikembalikan</span>
                  <Badge className="bg-teal-100 text-teal-800">
                    {borrowings.filter((b) => b.status === "returned").length}
                  </Badge>
                </div>
                <div className="flex justify-between items-center p-2 border border-border rounded">
                  <span className="text-foreground">Terlambat</span>
                  <Badge variant="destructive">
                    {borrowings.filter((b) => b.status === "overdue").length}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 pt-6 border-t border-border text-center">
          <p className="text-sm text-muted-foreground">
            Kementerian Kesehatan RI - RSUP Persahabatan • Sistem Informasi Inventaris & Pemeliharaan Sarana
            Prasarana Peminjaman
          </p>
        </div>
      </div>
    </div>
  )
}
