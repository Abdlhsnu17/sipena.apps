"use client"

import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { assetService } from "@/services/asset.service"
import { getCurrentUser } from "@/services/auth-utils"
import { maintenanceService, type Maintenance } from "@/services/maintenance.service"
import type { User } from "@/types/auth-types"
import type { DetailInventoryItem } from "@/types/detail-inventory"
import { flattenDetailInventories } from "@/utils/detail-inventory"
import type { LucideIcon } from "lucide-react"
import { BookOpen, Shield, Sparkles, Users, Workflow, Zap } from "lucide-react"

const MaintenanceHistoryList = dynamic(() => import("@/components/maintenance-history-list"), {
  ssr: false,
})

type AfterMaintenanceHighlight = {
  title: string
  description: string
  icon: LucideIcon
  accent: string
}

const afterMaintenanceHighlights: AfterMaintenanceHighlight[] = [
  {
    title: "Catat Hasil Lapangan",
    description: "Form after-maintenance sekarang menonjolkan catatan teknis, foto kondisi, dan validator untuk audit cepat.",
    icon: BookOpen,
    accent: "from-teal-500/80 via-cyan-500/70 to-blue-500/60",
  },
  {
    title: "Status Terintegrasi",
    description: "Data pemeliharaan memicu milestone dalam dashboard sehingga tim dapat melihat dampak atas inventory secara real-time.",
    icon: Workflow,
    accent: "from-fuchsia-500/80 via-purple-500/70 to-indigo-500/60",
  },
  {
    title: "Audit Inline",
    description: "Validasi oleh supervisor disertai catatan cepat, fokus pada kepatuhan dokumentasi UML.",
    icon: Shield,
    accent: "from-emerald-500/80 via-lime-500/70 to-emerald-400/60",
  },
  {
    title: "Tindak Lanjut",
    description: "Aksi selanjutnya (pemeliharaan ulang, permintaan pengadaan) dikomunikasikan lewat notif dan timeline.",
    icon: Zap,
    accent: "from-orange-500/80 via-amber-500/70 to-yellow-400/60",
  },
]

export default function FeaturesPage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [maintenance, setMaintenance] = useState<Maintenance[]>([])
  const [assets, setAssets] = useState<DetailInventoryItem[]>([])
  const [maintenanceLoaded, setMaintenanceLoaded] = useState(false)

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  return (
    <div className="flex-1 overflow-auto bg-background">
      <main className="flex-1 overflow-auto">
        <div className="p-6 md:p-8 space-y-6">

          <section className="rounded-[30px] border border-teal-100/70 bg-gradient-to-br from-white via-teal-50 to-cyan-50/80 p-6 shadow-[0_30px_60px_rgba(14,165,233,0.15)] dark:border-slate-800/70 dark:bg-gradient-to-br dark:from-slate-950 dark:via-slate-900 dark:to-teal-950/30">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3">
                <p className="text-[18px] font-bold uppercase tracking-[0.4em] text-slate-900">Maintenance</p>
                <div className="flex flex-wrap gap-3">
                  <Badge variant="outline" className="rounded-full border-white/70 bg-white/30 px-3 py-1 text-xs text-teal-700 dark:border-white/30 dark:bg-slate-900/40 dark:text-teal-300">
                    
                  </Badge>
                  <Badge variant="outline" className="rounded-full border-white/70 bg-white/30 px-3 py-1 text-xs text-slate-600 dark:border-white/30 dark:bg-slate-900/40 dark:text-slate-300">
                  </Badge>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="uppercase tracking-[0.4em] text-[11px]"
                  onClick={() => router.push("/maintenance")}
                >
                  Kembali ke Jadwal
                </Button>
              </div>
            </div>

            <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
              {afterMaintenanceHighlights.map((highlight) => (
                <div
                  key={highlight.title}
                  className="mx-auto w-full max-w-sm rounded-[28px] border border-slate-200/70 bg-white/90 p-5 shadow-[0_20px_40px_rgba(15,23,42,0.08)] dark:border-slate-800/70 dark:bg-slate-900/70"
                >
                  <div className={`inline-flex items-center justify-center rounded-2xl bg-gradient-to-br ${highlight.accent} p-3 text-white`}>
                    <highlight.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-foreground">{highlight.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{highlight.description}</p>
                </div>
              ))}
            </section>

            {maintenanceLoaded ? (
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <div className="rounded-[24px] border border-slate-200/70 bg-white/90 p-5 shadow-lg dark:border-slate-800/70 dark:bg-slate-900/70">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.5em] text-slate-500">
                    <Sparkles className="h-4 w-4 text-teal-600" />
                    Laporan Tercatat
                  </div>
                  <p className="text-3xl font-bold text-teal-700 mt-4">{totalSchedules.toLocaleString("id-ID")}</p>
                  <p className="text-xs text-muted-foreground">Laporan pemeliharaan tercatat</p>
                </div>
                <div className="rounded-[24px] border border-slate-200/70 bg-white/90 p-5 shadow-lg dark:border-slate-800/70 dark:bg-slate-900/70">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.5em] text-slate-500">
                    <Users className="h-4 w-4 text-slate-600" />
                    Tertunda
                  </div>
                  <p className="text-3xl font-bold text-foreground mt-4">{pendingCount}</p>
                  <p className="text-xs text-muted-foreground">Hasil pemeliharaan tertunda</p>
                </div>
                <div className="rounded-[24px] border border-slate-200/70 bg-white/90 p-5 shadow-lg dark:border-slate-800/70 dark:bg-slate-900/70">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.5em] text-slate-500">
                    <Users className="h-4 w-4 text-slate-600" />
                    Ditolak
                  </div>
                  <p className="text-3xl font-bold text-foreground mt-4">{cancelledCount}</p>
                  <p className="text-xs text-muted-foreground">Hasil pemeliharaan ditolak</p>
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-[24px] border border-dashed border-slate-200/70 bg-white/90 p-5 text-sm text-muted-foreground shadow-inner">
                Menunggu proses jadwal pemeliharaan selesai sebelum menampilkan ringkasan inventaris.
              </div>
            )}
          </section>

          {currentUser && (
            <section className="rounded-[28px] border border-slate-200/70 bg-white/90 shadow-[0_30px_60px_rgba(15,23,42,0.15)] dark:border-slate-800/70 dark:bg-slate-950/70">
              <div className="flex flex-col gap-2 border-b border-slate-200/70 px-6 py-4 dark:border-slate-800/70">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Riwayat Tindak Lanjut</p>
                    <p className="text-lg font-semibold text-foreground">Dibuka setelah pemeliharaan</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadMaintenance}
                    className="text-xs font-semibold uppercase tracking-[0.3em]"
                  >
                    Segarkan
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Catatan teknisi, validator, dan penugasan aset ditampilkan mengikuti prinsip narratif.
                </p>
              </div>
              <div className="p-0">
                <MaintenanceHistoryList
                  user={currentUser}
                  assets={assets}
                  maintenance={maintenance}
                  onRefresh={loadMaintenance}
                  disableWrapper
                />
              </div>
            </section>
          )}

          <div className="text-xs text-muted-foreground">Kementerian Kesehatan RI - RSUP Persahabatan</div>
        </div>
      </main>
    </div>
  )
}
