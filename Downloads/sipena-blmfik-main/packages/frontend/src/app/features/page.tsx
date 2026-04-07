"use client"

import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { assetService } from "@/services/asset.service"
import { getCurrentUser } from "@/services/auth-utils"
import { maintenanceService, type Maintenance } from "@/services/maintenance.service"
import type { User } from "@/types/auth-types"
import type { DetailInventoryItem } from "@/types/detail-inventory"
import { flattenDetailInventories } from "@/utils/detail-inventory"
import { AlertCircle, ChevronDown, ChevronUp, ShieldCheck, Wrench } from "lucide-react"

const MaintenanceHistoryList = dynamic(() => import("@/components/maintenance-history-list"), {
  ssr: false,
})

export default function FeaturesPage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [maintenance, setMaintenance] = useState<Maintenance[]>([])
  const [assets, setAssets] = useState<DetailInventoryItem[]>([])
  const [maintenanceLoaded, setMaintenanceLoaded] = useState(false)
  const [isHistoryMinimized, setIsHistoryMinimized] = useState(false)

  useEffect(() => {
    const user = getCurrentUser()
    if (!user) {
      router.push("/login")
      return
    }
    setCurrentUser(user)
  }, [router])

  const loadMaintenance = async () => {
    try {
      const response = await maintenanceService.getAll({ page: 1, limit: 1000 })
      if (response.success) setMaintenance(response.data)
      setMaintenanceLoaded(true)
    } catch (error) {
      console.error("Failed to load maintenance data:", error)
      setMaintenanceLoaded(true)
    }
  }

  const loadAssets = async () => {
    try {
      const [medicalAssets, nonMedicalAssets] = await Promise.all([
        assetService.getMedicalAssets({ page: 1, limit: 1000 }),
        assetService.getNonMedicalAssets({ page: 1, limit: 1000 }),
      ])

      const detailItems = flattenDetailInventories(
        [
          ...(medicalAssets.success ? medicalAssets.data : []),
          ...(nonMedicalAssets.success ? nonMedicalAssets.data : []),
        ],
        { includeAssetFallback: true }
      )

      setAssets(detailItems)
    } catch (error) {
      console.error("Failed to load asset data:", error)
    }
  }

  useEffect(() => {
    void loadMaintenance()
    void loadAssets()
  }, [])

  const totalSchedules = maintenance.length
  const pendingCount = useMemo(
    () =>
      maintenance.filter((m) => m.status === "scheduled" || m.status === "in_progress")
        .length,
    [maintenance],
  )
  const cancelledCount = useMemo(
    () => maintenance.filter((m) => m.status === "cancelled").length,
    [maintenance],
  )
  const followUpHistoryCount = useMemo(
    () => maintenance.filter((m) => m.status === "completed" || m.status === "validated").length,
    [maintenance],
  )

  return (
    <main
      className="min-h-full bg-linear-to-br from-slate-50 via-white to-cyan-50 dark:from-slate-950 dark:via-slate-900 dark:to-teal-950/40"
      style={{ fontFamily: "Arial, sans-serif", fontSize: "14px" }}
    >
      <div className="px-0 py-4 sm:py-6">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 sm:gap-5">
          <section className="rounded-3xl border border-teal-100/80 bg-white/90 p-4 shadow-2xl backdrop-blur-sm dark:border-teal-800/60 dark:bg-slate-900/70">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start">
                <div className="p-2 bg-linear-to-br from-teal-500 to-cyan-500 rounded-lg">
                  <Wrench className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-xl font-bold text-foreground sm:text-2xl">Pemeliharaan</h1>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {currentUser?.role !== "staff" && (
                      <Badge
                        variant="outline"
                        className="bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-200 text-[11px]"
                      >
                        {maintenanceLoaded ? "Data siap ditinjau" : "Memuat data pemeliharaan"}
                      </Badge>
                    )}
                    <Badge
                      variant="outline"
                      className="bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-200 text-[11px]"
                    >
                      Role: {currentUser?.role || "-"}
                    </Badge>
                  </div>
                </div>
              </div>
              <Button
                size="sm"
                className="w-full rounded-2xl bg-teal-600 px-4 text-white hover:bg-teal-700 sm:w-auto"
                onClick={() => router.push("/maintenance")}
              >
                Buka Jadwal Pemeliharaan
              </Button>
            </div>
          </section>

          <Card className="rounded-2xl border border-slate-200/80 bg-white/90 shadow-lg dark:border-slate-700 dark:bg-slate-900/70">
            <CardContent className="p-4">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <div className="flex items-start justify-between gap-3 rounded-lg bg-teal-50/50 dark:bg-teal-950/30 p-3">
                  <div>
                    <p className="text-[12px] text-muted-foreground">Laporan Tercatat</p>
                    <p className="text-xl font-semibold text-foreground mt-1">{totalSchedules.toLocaleString("id-ID")}</p>
                  </div>
                  <ShieldCheck className="h-4 w-4 text-teal-500 shrink-0" />
                </div>
                <div className="flex items-start justify-between gap-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/30 p-3">
                  <div>
                    <p className="text-[12px] text-muted-foreground">Tertunda / Proses</p>
                    <p className="text-xl font-semibold text-amber-600 mt-1">{pendingCount}</p>
                  </div>
                  <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                </div>
                <div className="flex items-start justify-between gap-3 rounded-lg bg-red-50/50 dark:bg-red-950/30 p-3">
                  <div>
                    <p className="text-[12px] text-muted-foreground">Dibatalkan</p>
                    <p className="text-xl font-semibold text-red-600 mt-1">{cancelledCount}</p>
                  </div>
                  <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                </div>
              </div>
            </CardContent>
          </Card>

          {currentUser && (
            <Card className="gap-3 rounded-3xl border border-slate-200 bg-white/90 shadow-xl dark:border-slate-700 dark:bg-slate-900/70">
              <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <CardTitle className="text-lg">Daftar Riwayat Pemeliharaan</CardTitle>
                  <CardDescription className="text-[13px] text-muted-foreground">
                    Total: {followUpHistoryCount} riwayat selesai/divalidasi
                  </CardDescription>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsHistoryMinimized((prev) => !prev)}
                    className="w-full rounded-2xl px-3 sm:w-auto"
                  >
                    {isHistoryMinimized ? (
                      <>
                        <ChevronDown className="mr-2 h-4 w-4" />
                        Tampilkan
                      </>
                    ) : (
                      <>
                        <ChevronUp className="mr-2 h-4 w-4" />
                        Sembunyikan
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void loadMaintenance()}
                    className="w-full rounded-2xl px-3 sm:w-auto"
                  >
                    Segarkan
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {isHistoryMinimized ? (
                  <div className="rounded-2xl border border-blue-100 bg-blue-50/80 px-4 py-4 text-center text-[14px] text-blue-900">
                    Riwayat disembunyikan. Tekan tombol tampilkan untuk membuka kembali detail.
                  </div>
                ) : (
                  <MaintenanceHistoryList
                    user={currentUser}
                    assets={assets}
                    maintenance={maintenance}
                    onRefresh={loadMaintenance}
                    disableWrapper
                  />
                )}
              </CardContent>
            </Card>
          )}

          <div className="text-center text-[13px] font-medium tracking-wider text-muted-foreground">
            Kementerian Kesehatan RI - RSUP Persahabatan
          </div>
        </div>
      </div>
    </main>
  )
}
