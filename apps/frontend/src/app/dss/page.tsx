"use client"

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buildLoginRedirectUrl, getCurrentUser } from "@/services/auth-utils";
import dssService, { type DssAssetRanking, type DssAssetType, type DssRankingHistoryEntry, type DssRankingResult } from "@/services/dss.service";
import { cn } from "@/utils";
import { locationBadgeClass } from "@/utils/api-mappers";
import { buildTableExportRows, exportTableData, type TableExportColumn } from "@/utils/export-table";
import { canCreateMaintenanceRole } from "@/utils/role";
import {
    Activity,
    AlertTriangle,
    ArrowDownUp,
    Award,
    Building2,
    Calculator,
    CheckCircle2,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ChevronUp,
    Clock,
    Download,
    Eye,
    Flame,
    Gauge,
    HandHelping,
    History,
    ListChecks,
    MapPin,
    Medal,
    PauseCircle,
    RefreshCw,
    Save,
    Scale,
    Search,
    ShieldAlert,
    SlidersHorizontal,
    Stethoscope,
    Trophy,
    Wrench,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

const DEFAULT_WEIGHTS: Record<string, number> = {
  condition: 19,
  age: 12,
  maintenanceDue: 15,
  usageFrequency: 13,
  maintenanceHistory: 13,
  functionalUrgency: 14,
  statusRisk: 6,
  maintenanceCost: 8,
}

const DEFAULT_CRITERIA: DssRankingResult["criteria"] = [
  { id: "condition", name: "Kondisi Aset", type: "benefit", weight: 0 },
  { id: "age", name: "Usia Aset", type: "benefit", weight: 0 },
  { id: "maintenanceDue", name: "Kedekatan Jadwal Maintenance", type: "benefit", weight: 0 },
  { id: "usageFrequency", name: "Frekuensi Pemakaian", type: "benefit", weight: 0 },
  { id: "maintenanceHistory", name: "Riwayat Maintenance", type: "benefit", weight: 0 },
  { id: "functionalUrgency", name: "Urgensi Fungsi", type: "benefit", weight: 0 },
  { id: "statusRisk", name: "Risiko Status", type: "benefit", weight: 0 },
  { id: "maintenanceCost", name: "Akumulasi Biaya Maintenance", type: "cost", weight: 0 },
]

const CRITERIA_IDS = DEFAULT_CRITERIA.map((criterion) => criterion.id)

const SAATY_SCALE_OPTIONS = [
  { value: 9, label: "9 - Mutlak lebih penting" },
  { value: 7, label: "7 - Sangat lebih penting" },
  { value: 5, label: "5 - Lebih penting" },
  { value: 3, label: "3 - Sedikit lebih penting" },
  { value: 1, label: "1 - Sama penting" },
  { value: 1 / 3, label: "1/3 - Sedikit lebih penting" },
  { value: 1 / 5, label: "1/5 - Lebih penting" },
  { value: 1 / 7, label: "1/7 - Sangat lebih penting" },
  { value: 1 / 9, label: "1/9 - Mutlak lebih penting" },
]

const closestSaatyValue = (value: number) => {
  return SAATY_SCALE_OPTIONS.reduce((closest, option) => (
    Math.abs(option.value - value) < Math.abs(closest - value) ? option.value : closest
  ), 1)
}

const buildPairwiseKey = (rowId: string, colId: string) => `${rowId}__${colId}`

const buildDefaultPairwiseValues = (): Record<string, number> => {
  const values: Record<string, number> = {}
  for (let i = 0; i < CRITERIA_IDS.length; i += 1) {
    for (let j = i + 1; j < CRITERIA_IDS.length; j += 1) {
      values[buildPairwiseKey(CRITERIA_IDS[i], CRITERIA_IDS[j])] = 1
    }
  }
  return values
}

const buildPairwiseMatrixFromValues = (values: Record<string, number>): number[][] => {
  const n = CRITERIA_IDS.length
  const matrix = Array.from({ length: n }, () => Array.from({ length: n }, () => 1))
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const raw = Number(values[buildPairwiseKey(CRITERIA_IDS[i], CRITERIA_IDS[j])])
      const value = Number.isFinite(raw) && raw > 0 ? raw : 1
      matrix[i][j] = value
      matrix[j][i] = 1 / value
    }
  }
  return matrix
}

// Saved/historical weights are fractions that sum to 1 (backend-normalized);
// the manual sliders expect integers in [1, 40]. Both restore paths (saved
// preference on mount, "Gunakan Bobot" from history) must rescale through
// this so a fraction like 0.19 doesn't just clamp to the slider minimum.
const rescaleWeightsToSliderRange = (entryWeights: Record<string, number>, base: Record<string, number>): Record<string, number> => {
  const positiveValues = Object.values(entryWeights).filter((value) => Number.isFinite(value) && value > 0)
  if (positiveValues.length === 0) return base
  const maxWeight = Math.max(...positiveValues)
  const scale = 40 / maxWeight
  const next = { ...base }
  Object.entries(entryWeights).forEach(([key, value]) => {
    if (Number.isFinite(value) && value > 0) {
      next[key] = Math.min(40, Math.max(1, Math.round(value * scale)))
    }
  })
  return next
}

const criteriaHelp: Record<string, string> = {
  condition: "Semakin buruk kondisi, semakin tinggi prioritas.",
  age: "Semakin tua usia aset, semakin tinggi prioritas.",
  maintenanceDue: "Semakin dekat atau lewat jadwal maintenance, semakin tinggi prioritas.",
  usageFrequency: "Semakin sering digunakan, semakin tinggi prioritas.",
  maintenanceHistory: "Semakin sering masuk maintenance, semakin tinggi prioritas.",
  functionalUrgency: "Semakin kritis fungsi aset, semakin tinggi prioritas.",
  maintenanceCost: "Semakin besar akumulasi biaya maintenance, semakin rendah prioritas investasi lanjutan (kriteria cost).",
  statusRisk: "Status bermasalah meningkatkan prioritas.",
}

const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`

const formatScore = (value: number) => value.toFixed(4)

const RANKINGS_PER_PAGE = 10

const assetTypeLabel = (value: DssAssetType | DssAssetRanking["assetType"]) => {
  if (value === "medical") return "Medis"
  if (value === "non_medical") return "Non-Medis"
  return "Semua"
}

const inventoryStatusLabel = (status?: string | null) => {
  if (status === "Aktif" || status === "available") return "Tersedia"
  if (status === "Non-Aktif" || status === "Nonaktif" || status === "disposed") return "Nonaktif"
  if (status === "borrowed") return "Dipinjam"
  if (status === "in_use") return "Sedang Digunakan"
  if (status === "maintenance") return "Dalam Perbaikan"
  return status || "Tersedia"
}

const recommendationMeta = (recommendation: string) => {
  const normalized = recommendation.toLowerCase()
  if (normalized.includes("tinggi")) return { className: "border-red-200 bg-red-50 text-red-700 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-300", icon: Flame }
  if (normalized.includes("sedang")) return { className: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300", icon: ShieldAlert }
  return { className: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-300", icon: CheckCircle2 }
}

const jenisMeta = (value: DssAssetType | DssAssetRanking["assetType"]) => {
  if (value === "medical") return { className: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/30 dark:bg-sky-400/10 dark:text-sky-300", icon: Stethoscope }
  if (value === "non_medical") return { className: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-400/30 dark:bg-violet-400/10 dark:text-violet-300", icon: Building2 }
  return { className: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700/40 dark:bg-slate-800/40 dark:text-slate-300", icon: Gauge }
}

const conditionMeta = (value?: string | null) => {
  const normalized = String(value || "").toLowerCase()
  if (normalized.includes("rusak") || normalized.includes("damaged")) {
    return { className: "border-red-200 bg-red-50 text-red-700 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-300", icon: AlertTriangle }
  }
  if (normalized.includes("poor") || normalized.includes("buruk") || normalized.includes("kurang")) {
    return { className: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300", icon: AlertTriangle }
  }
  if (normalized.includes("cukup") || normalized.includes("fair")) {
    return { className: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300", icon: Wrench }
  }
  return { className: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-300", icon: CheckCircle2 }
}

const statusMeta = (value?: string | null) => {
  const normalized = String(value || "").toLowerCase()
  if (normalized.includes("nonaktif") || normalized.includes("non-aktif")) {
    return { className: "border-red-200 bg-red-50 text-red-700 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-300", icon: AlertTriangle }
  }
  if (normalized.includes("perbaikan") || normalized.includes("inspeksi") || normalized.includes("maintenance")) {
    return { className: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300", icon: Wrench }
  }
  if (normalized.includes("dipinjam")) {
    return { className: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/30 dark:bg-blue-400/10 dark:text-blue-300", icon: HandHelping }
  }
  if (normalized.includes("digunakan")) {
    return { className: "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-400/30 dark:bg-purple-400/10 dark:text-purple-300", icon: Clock }
  }
  if (normalized.includes("tersedia")) {
    return { className: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-300", icon: CheckCircle2 }
  }
  return { className: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700/40 dark:bg-slate-800/40 dark:text-slate-300", icon: PauseCircle }
}

const rankMeta = (rank: number) => {
  if (rank === 1) return { className: "bg-amber-400 text-amber-950 dark:bg-amber-400/80 dark:text-amber-950", icon: Trophy }
  if (rank === 2) return { className: "bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-slate-200", icon: Medal }
  if (rank === 3) return { className: "bg-orange-300 text-orange-900 dark:bg-orange-400/70 dark:text-orange-950", icon: Award }
  return null
}

export default function DssPage() {
  const router = useRouter()
  const [rankingResult, setRankingResult] = useState<DssRankingResult | null>(null)
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS)
  const [assetType, setAssetType] = useState<DssAssetType>("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [rankingPage, setRankingPage] = useState(1)
  const [auditItem, setAuditItem] = useState<DssAssetRanking | null>(null)
  const [canRequestMaintenance, setCanRequestMaintenance] = useState(false)
  const [weightsLoaded, setWeightsLoaded] = useState(false)
  const [isSavingWeights, setIsSavingWeights] = useState(false)
  const [weightsSavedMessage, setWeightsSavedMessage] = useState<string | null>(null)
  const [historyEntries, setHistoryEntries] = useState<DssRankingHistoryEntry[]>([])
  const [isHistoryLoading, setIsHistoryLoading] = useState(false)
  const [weightMode, setWeightMode] = useState<"manual" | "ahp">("manual")
  const [pairwiseValues, setPairwiseValues] = useState<Record<string, number>>(buildDefaultPairwiseValues)
  const [historyDetailEntry, setHistoryDetailEntry] = useState<DssRankingHistoryEntry | null>(null)
  const [isWeightsMinimized, setIsWeightsMinimized] = useState(false)
  const [isRankingMinimized, setIsRankingMinimized] = useState(false)
  const [isHistoryMinimized, setIsHistoryMinimized] = useState(false)

  useEffect(() => {
    const user = getCurrentUser()
    if (!user) {
      router.replace(buildLoginRedirectUrl())
      return
    }
    setCanRequestMaintenance(canCreateMaintenanceRole(user.role))
  }, [router])

  useEffect(() => {
    let cancelled = false
    dssService.getWeightPreference()
      .then((response) => {
        if (cancelled) return
        if (response.success && response.data) {
          setWeights((current) => rescaleWeightsToSliderRange(response.data!.weights, current))
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setWeightsLoaded(true)
      })
    return () => { cancelled = true }
  }, [])

  const loadHistory = useCallback(async () => {
    setIsHistoryLoading(true)
    try {
      const response = await dssService.getRankingHistory(10)
      if (response.success) {
        setHistoryEntries(response.data)
      }
    } catch {
      // History is a supplementary audit trail; failing silently keeps the
      // main ranking flow usable even if this call fails.
    } finally {
      setIsHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  const normalizedWeights = useMemo(() => {
    const total = Object.values(weights).reduce((sum, value) => sum + Number(value || 0), 0)
    if (total <= 0) return DEFAULT_WEIGHTS
    return Object.fromEntries(Object.entries(weights).map(([key, value]) => [key, Number(value || 0) / total]))
  }, [weights])

  const saveWeightsAsDefault = useCallback(async () => {
    setIsSavingWeights(true)
    setWeightsSavedMessage(null)
    try {
      // Persist the weights actually applied to the last ranking (rankingResult.criteria),
      // not the raw manual slider state, so this works correctly in AHP mode too.
      const effectiveWeights = rankingResult
        ? Object.fromEntries(rankingResult.criteria.map((criterion) => [criterion.id, criterion.weight]))
        : normalizedWeights
      const response = await dssService.saveWeightPreference(effectiveWeights, assetType)
      if (response.success) {
        setWeightsSavedMessage("Bobot tersimpan sebagai default Anda.")
      }
    } catch {
      setWeightsSavedMessage("Gagal menyimpan bobot. Coba lagi.")
    } finally {
      setIsSavingWeights(false)
    }
  }, [rankingResult, normalizedWeights, assetType])

  const applyWeightsFromEntry = useCallback((entryWeights: Record<string, number>) => {
    setWeights((current) => rescaleWeightsToSliderRange(entryWeights, current))
    setWeightMode("manual")
  }, [])

  const setPairwiseValue = useCallback((rowId: string, colId: string, value: number) => {
    setPairwiseValues((current) => ({ ...current, [buildPairwiseKey(rowId, colId)]: value }))
  }, [])

  const requestMaintenanceForItem = useCallback((item: DssAssetRanking) => {
    const params = new URLSearchParams({
      source: "dss",
      assetType: item.assetType,
      assetId: String(item.assetId),
      detailId: item.detailId,
      detailCode: item.detailCode || "",
      score: item.preferenceScore.toFixed(4),
      rank: String(item.rank),
    })
    router.push(`/maintenance?${params.toString()}`)
  }, [router])

  const loadRanking = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage(null)
    try {
      const response = await dssService.getRanking(
        weightMode === "ahp"
          // Manual weights ride along as the fallback the backend uses when
          // the pairwise matrix turns out inconsistent (CR > 0.1), so that
          // fallback actually matches what the UI tells the user happens.
          ? { assetType, limit: 250, pairwiseMatrix: buildPairwiseMatrixFromValues(pairwiseValues), weights: normalizedWeights }
          : { assetType, limit: 250, weights: normalizedWeights }
      )
      if (response.success) {
        setRankingResult(response.data)
        void loadHistory()
      }
    } catch (error) {
      console.error("Error loading DSS ranking:", error)
      setRankingResult(null)
      setErrorMessage(error instanceof Error ? error.message : "Endpoint SPK tidak dapat dihubungi. Periksa layanan backend lalu muat ulang.")
    } finally {
      setIsLoading(false)
    }
  }, [assetType, normalizedWeights, weightMode, pairwiseValues, loadHistory])

  // Gated on weightsLoaded so we don't fetch twice on mount (once with
  // defaults, once with the restored saved preference).
  useEffect(() => {
    if (!weightsLoaded) return
    void loadRanking()
  }, [weightsLoaded, loadRanking])

  const filteredRankings = useMemo(() => {
    const rankings = rankingResult?.rankings || []
    const query = searchTerm.trim().toLowerCase()
    if (!query) return rankings
    return rankings.filter((item) => [
      item.detailName,
      item.detailCode,
      item.serialNumber,
      item.assetName,
      item.assetCode,
      item.assetLocation,
      item.assetCategory,
      item.recommendation,
    ].some((value) => String(value || "").toLowerCase().includes(query)))
  }, [rankingResult?.rankings, searchTerm])

  const exportRanking = useCallback(async (format: "excel" | "pdf") => {
    const columns: TableExportColumn<DssAssetRanking>[] = [
      { key: "rank", label: "Rank", getValue: (item) => String(item.rank) },
      { key: "detailName", label: "Nama Aset Detail", getValue: (item) => item.detailName },
      { key: "detailCode", label: "Kode", getValue: (item) => item.detailCode },
      { key: "serialNumber", label: "Serial", getValue: (item) => item.serialNumber || "-" },
      { key: "assetLocation", label: "Lokasi", getValue: (item) => item.assetLocation || "-" },
      { key: "assetType", label: "Jenis", getValue: (item) => assetTypeLabel(item.assetType) },
      { key: "conditionLabel", label: "Kondisi", getValue: (item) => item.conditionLabel },
      { key: "statusLabel", label: "Status", getValue: (item) => inventoryStatusLabel(item.statusLabel) },
      { key: "preferenceScore", label: "Skor", getValue: (item) => formatScore(item.preferenceScore) },
      { key: "recommendation", label: "Rekomendasi", getValue: (item) => item.recommendation },
    ]
    await exportTableData(format, {
      title: "Ranking Prioritas Aset SPK",
      columns: columns.map((column) => column.label),
      rows: buildTableExportRows(columns, filteredRankings),
      filePrefix: `spk-ranking-prioritas-${assetType}`,
    })
  }, [filteredRankings, assetType])

  useEffect(() => {
    setRankingPage(1)
  }, [assetType, rankingResult?.rankings, searchTerm])

  const totalRankingPages = Math.max(1, Math.ceil(filteredRankings.length / RANKINGS_PER_PAGE))
  const currentRankingPage = Math.min(rankingPage, totalRankingPages)
  const rankingStartIndex = (currentRankingPage - 1) * RANKINGS_PER_PAGE
  const paginatedRankings = filteredRankings.slice(rankingStartIndex, rankingStartIndex + RANKINGS_PER_PAGE)
  const visibleRankingPages = useMemo(() => {
    if (totalRankingPages <= 7) {
      return Array.from({ length: totalRankingPages }, (_, index) => index + 1)
    }

    const pages = new Set([
      1,
      totalRankingPages,
      currentRankingPage - 1,
      currentRankingPage,
      currentRankingPage + 1,
    ])
    const sortedPages = Array.from(pages)
      .filter((page) => page >= 1 && page <= totalRankingPages)
      .sort((left, right) => left - right)

    return sortedPages.flatMap((page, index) => {
      const previousPage = sortedPages[index - 1]
      if (index > 0 && previousPage && page - previousPage > 1) {
        return [`ellipsis-${previousPage}-${page}`, page]
      }
      return [page]
    })
  }, [currentRankingPage, totalRankingPages])

  const goToRankingPage = (page: number) => {
    setRankingPage(Math.min(totalRankingPages, Math.max(1, page)))
  }

  const topRankings = rankingResult?.rankings.slice(0, 3) || []

  return (
    <div>
      <div className="w-full space-y-6">
        <Card className="overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800/35 bg-white dark:bg-slate-900/60 shadow-sm">
          <CardContent className="p-0">
            <div className="border-b border-slate-100 dark:border-slate-800/35 bg-slate-50 dark:bg-slate-900/40 panel-gutter">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-3xl flex items-center gap-3">
                  <div className="inline-flex rounded-lg bg-linear-to-br from-teal-500 to-teal-700 p-2.5">
                    <Calculator className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h1 className="text-[18px] font-semibold tracking-tight text-slate-900 dark:text-slate-100">SPK Prioritas Aset</h1>
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center w-full lg:w-auto">
                  <Select value={assetType} onValueChange={(value) => setAssetType(value as DssAssetType)}>
                    <SelectTrigger className="w-full sm:w-45">
                      <SelectValue placeholder="Jenis aset" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua aset</SelectItem>
                      <SelectItem value="medical">Medis</SelectItem>
                      <SelectItem value="non_medical">Non-Medis</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={() => void loadRanking()} disabled={isLoading} className="gap-2 rounded-2xl">
                    <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                    Hitung Ulang
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(340px,420px)]">
          <Card className="border-slate-200 dark:border-slate-800/35 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Ringkasan Prioritas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-slate-200 dark:border-slate-800/35 bg-slate-50/70 dark:bg-slate-900/40 p-4">
                  <div className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Alternatif</div>
                  <div className="mt-1 text-2xl font-semibold text-slate-950 dark:text-slate-50">
                    {rankingResult?.totalAlternatives ?? 0}
                  </div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Item inventaris detail</div>
                </div>
                <div className="rounded-lg border border-slate-200 dark:border-slate-800/35 bg-slate-50/70 dark:bg-slate-900/40 p-4">
                  <div className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Sumber Data</div>
                  <div className="mt-1 text-2xl font-semibold text-slate-950 dark:text-slate-50">{assetTypeLabel(assetType)}</div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Medis dan non-medis</div>
                </div>
                <div className="rounded-lg border border-slate-200 dark:border-slate-800/35 bg-slate-50/70 dark:bg-slate-900/40 p-4">
                  <div className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Ranking Tertinggi</div>
                  <div className="mt-1 line-clamp-1 text-lg font-semibold text-slate-950 dark:text-slate-50">
                    {topRankings[0]?.detailName ?? "-"}
                  </div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {topRankings[0] ? formatScore(topRankings[0].preferenceScore) : "Belum dihitung"}
                  </div>
                </div>
              </div>

              <div className="grid gap-3 border-t border-slate-100 dark:border-slate-800/35 pt-4 md:grid-cols-2">
                <div>
                  <div className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Pembobotan Kriteria</div>
                  <div className="mt-1 text-sm font-semibold text-slate-950 dark:text-slate-50">
                    {weightMode === "ahp" ? "AHP (perbandingan berpasangan)" : "Bobot manual"}
                  </div>
                  <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    {weightMode === "ahp"
                      ? "Bobot dihitung dari perbandingan berpasangan antar kriteria memakai skala Saaty."
                      : "Bobot tiap kriteria diatur langsung lewat slider dan dinormalisasi ke total 100%."}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Metode TOPSIS</div>
                  <div className="mt-1 text-sm font-semibold text-slate-950 dark:text-slate-50">Ranking aset detail</div>
                  <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">Ranking aset dihitung berdasarkan bobot kriteria dan nilai alternatif.</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 dark:border-slate-800/35 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Top Ranking</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {topRankings.length > 0 ? (
                topRankings.map((item) => {
                  const rankBadge = rankMeta(item.rank)
                  const recommendation = recommendationMeta(item.recommendation)
                  return (
                    <div key={`${item.assetType}-${item.assetId}-${item.detailId}`} className="grid gap-3 rounded-md border border-slate-200 dark:border-slate-800/35 bg-slate-50/60 dark:bg-slate-900/40 p-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-start">
                      {rankBadge ? (
                        <span className={cn("inline-flex h-7 w-7 items-center justify-center rounded-full", rankBadge.className)}>
                          <rankBadge.icon className="h-4 w-4" />
                        </span>
                      ) : (
                        <Badge className="w-fit bg-slate-950 text-white">#{item.rank}</Badge>
                      )}
                      <div className="min-w-0">
                        <div className="line-clamp-1 text-sm font-semibold text-slate-950 dark:text-slate-50">{item.detailName}</div>
                        <div className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400">{item.detailCode} · {item.serialNumber || "-"}</div>
                      </div>
                      <Badge variant="outline" className={cn("w-fit justify-self-start gap-1 sm:justify-self-end", recommendation.className)}>
                        <recommendation.icon className="h-3.5 w-3.5" />
                        {item.recommendation}
                      </Badge>
                    </div>
                  )
                })
              ) : (
                <div className="rounded-md border border-dashed border-slate-200 dark:border-slate-800/35 bg-slate-50 dark:bg-slate-900/40 p-3 text-sm text-slate-500 dark:text-slate-400">
                  Belum ada ranking untuk ditampilkan.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="border-slate-200 dark:border-slate-800/35 shadow-sm">
          <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <SlidersHorizontal className="h-4 w-4 text-teal-700" />
              Bobot Kriteria
            </CardTitle>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {weightsSavedMessage && (
                <span className="text-xs text-slate-500 dark:text-slate-400">{weightsSavedMessage}</span>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => setIsWeightsMinimized((prev) => !prev)}
              >
                {isWeightsMinimized ? (
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
              {weightMode === "manual" && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => setWeights(DEFAULT_WEIGHTS)}
                >
                  Reset Bobot Default
                </Button>
              )}
              {weightMode === "ahp" && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => setPairwiseValues(buildDefaultPairwiseValues())}
                >
                  Reset Matriks AHP
                </Button>
              )}
              <Button
                type="button"
                className="w-full gap-2 sm:w-auto"
                disabled={isSavingWeights}
                onClick={() => void saveWeightsAsDefault()}
              >
                <Save className={cn("h-4 w-4", isSavingWeights && "animate-pulse")} />
                Simpan sebagai Default Saya
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            {isWeightsMinimized ? (
              <div className="rounded-2xl border border-blue-100 bg-blue-50/80 px-4 py-4 text-center text-[14px] text-blue-900 dark:border-blue-400/20 dark:bg-blue-400/5 dark:text-blue-200">
                Section bobot kriteria disembunyikan. Tekan tombol tampilkan untuk membuka kembali detail.
              </div>
            ) : (
              <>
            <Tabs value={weightMode} onValueChange={(value) => setWeightMode(value as "manual" | "ahp")}>
              <TabsList>
                <TabsTrigger value="manual">Bobot Manual</TabsTrigger>
                <TabsTrigger value="ahp">AHP (Perbandingan Berpasangan)</TabsTrigger>
              </TabsList>
            </Tabs>

            {weightMode === "manual" ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {rankingResult?.criteria.map((criterion) => {
                  const rawValue = weights[criterion.id] ?? 0
                  return (
                    <div key={criterion.id} className="space-y-3 rounded-xl border border-slate-200 dark:border-slate-800/35 bg-slate-50/60 dark:bg-slate-900/40 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Label htmlFor={`weight-${criterion.id}`} className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {criterion.name}
                          </Label>
                          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{criteriaHelp[criterion.id]}</p>
                        </div>
                        <Badge variant="outline" className="shrink-0 bg-white dark:bg-slate-900/60">
                          {criterion.type === "benefit" ? "Benefit" : "Cost"}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-[minmax(0,1fr)_76px] items-center gap-3">
                        <input
                          id={`weight-${criterion.id}`}
                          type="range"
                          min="1"
                          max="40"
                          value={rawValue}
                          onChange={(event) => setWeights((current) => ({
                            ...current,
                            [criterion.id]: Number(event.target.value),
                          }))}
                          className="h-2 w-full accent-teal-700"
                        />
                        <div className="rounded-md border border-slate-200 dark:border-slate-800/35 bg-white dark:bg-slate-900/60 px-2 py-1.5 text-right text-sm font-semibold text-slate-800 dark:text-slate-200">
                          {formatPercent(criterion.weight)}
                        </div>
                      </div>
                    </div>
                  )
                }) ?? (
                  <div className="col-span-full grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {Object.keys(DEFAULT_WEIGHTS).map((criterionId) => (
                      <div key={criterionId} className="h-28 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800/60" />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {rankingResult?.consistency && (
                  <div className={cn(
                    "flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between",
                    rankingResult.consistency.isConsistent
                      ? "border-emerald-200 bg-emerald-50 dark:border-emerald-400/30 dark:bg-emerald-400/10"
                      : "border-red-200 bg-red-50 dark:border-red-400/30 dark:bg-red-400/10"
                  )}>
                    <div className="flex items-center gap-2">
                      {rankingResult.consistency.isConsistent ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-red-700 dark:text-red-300" />
                      )}
                      <div>
                        <div className={cn("text-sm font-semibold", rankingResult.consistency.isConsistent ? "text-emerald-800 dark:text-emerald-200" : "text-red-800 dark:text-red-200")}>
                          {rankingResult.consistency.isConsistent ? "Matriks AHP konsisten" : "Matriks AHP tidak konsisten (CR > 0,1)"}
                        </div>
                        <div className="mt-0.5 text-xs leading-5 text-slate-600 dark:text-slate-400">
                          {rankingResult.consistency.isConsistent
                            ? "Bobot AHP dipakai untuk perhitungan TOPSIS di bawah ini."
                            : "Sistem otomatis kembali memakai bobot manual/terakhir karena CR melebihi ambang 0,1. Perbaiki beberapa perbandingan lalu hitung ulang."}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-4 text-xs text-slate-600 dark:text-slate-400">
                      <div><span className="font-semibold text-slate-900 dark:text-slate-100">λmax</span> {rankingResult.consistency.lambdaMax.toFixed(4)}</div>
                      <div><span className="font-semibold text-slate-900 dark:text-slate-100">CI</span> {rankingResult.consistency.consistencyIndex.toFixed(4)}</div>
                      <div><span className="font-semibold text-slate-900 dark:text-slate-100">CR</span> {rankingResult.consistency.consistencyRatio.toFixed(4)}</div>
                    </div>
                  </div>
                )}

                <div className="rounded-xl border border-slate-200 dark:border-slate-800/35">
                  <div className="border-b border-slate-200 dark:border-slate-800/35 bg-slate-50/70 dark:bg-slate-900/40 px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400">
                    Bandingkan tingkat kepentingan tiap pasangan kriteria memakai skala Saaty (1-9).
                  </div>
                  <div className="max-h-125 space-y-2 overflow-y-auto p-4">
                    {DEFAULT_CRITERIA.flatMap((rowCriterion, i) =>
                      DEFAULT_CRITERIA.slice(i + 1).map((colCriterion) => {
                        const key = buildPairwiseKey(rowCriterion.id, colCriterion.id)
                        const value = closestSaatyValue(pairwiseValues[key] ?? 1)
                        return (
                          <div key={key} className="grid grid-cols-1 items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-800/35 bg-slate-50/60 dark:bg-slate-900/40 p-3 sm:grid-cols-[minmax(0,1fr)_200px]">
                            <div className="text-sm text-slate-800 dark:text-slate-200">
                              <span className="font-semibold">{rowCriterion.name}</span>
                              <span className="mx-1.5 text-slate-400">vs</span>
                              <span className="font-semibold">{colCriterion.name}</span>
                            </div>
                            <Select
                              value={String(value)}
                              onValueChange={(next) => setPairwiseValue(rowCriterion.id, colCriterion.id, Number(next))}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {SAATY_SCALE_OPTIONS.map((option) => (
                                  <SelectItem key={option.label} value={String(option.value)}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              </div>
            )}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-800/35 shadow-sm">
          <CardHeader className="gap-3 pb-3 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <ArrowDownUp className="h-4 w-4 text-teal-700" />
              Ranking Prioritas
            </CardTitle>
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:w-auto">
              <div className="relative w-full lg:w-80">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Cari aset, kode, nomor seri"
                  className="pl-9"
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" className="w-full gap-2 sm:w-auto">
                    <Download className="h-4 w-4" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => void exportRanking("excel")}>
                    Export ke Excel
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void exportRanking("pdf")}>
                    Export ke PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => setIsRankingMinimized((prev) => !prev)}
              >
                {isRankingMinimized ? (
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
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isRankingMinimized ? (
              <div className="m-4 rounded-2xl border border-blue-100 bg-blue-50/80 px-4 py-4 text-center text-[14px] text-blue-900 dark:border-blue-400/20 dark:bg-blue-400/5 dark:text-blue-200">
                Section ranking prioritas disembunyikan. Tekan tombol tampilkan untuk membuka kembali detail.
              </div>
            ) : (
            <>
            {errorMessage && (
              <div className="m-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-300">
                {errorMessage}
              </div>
            )}
            {isLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 8 }).map((_, index) => (
                  <div key={index} className="h-14 animate-pulse rounded-md bg-slate-100 dark:bg-slate-800/60" />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-275 text-left text-[13px]">
                  <thead className="border-y border-slate-200 dark:border-slate-800/35 bg-slate-100 dark:bg-slate-800/60 text-xs uppercase text-slate-600 dark:text-slate-300">
                    <tr>
                      <th className="px-3 py-2.5">Rank</th>
                      <th className="px-3 py-2.5">Aset Detail</th>
                      <th className="px-3 py-2.5">Lokasi</th>
                      <th className="px-3 py-2.5">Jenis</th>
                      <th className="px-3 py-2.5">Kondisi</th>
                      <th className="px-3 py-2.5">Status</th>
                      <th className="px-3 py-2.5">Skor</th>
                      <th className="px-3 py-2.5">Rekomendasi</th>
                      <th className="px-3 py-2.5 text-right">Audit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800/35 bg-white dark:bg-slate-900/60">
                    {paginatedRankings.map((item) => {
                      const statusLabel = inventoryStatusLabel(item.statusLabel)
                      const jenis = jenisMeta(item.assetType)
                      const condition = conditionMeta(item.conditionLabel)
                      const status = statusMeta(statusLabel)
                      const recommendation = recommendationMeta(item.recommendation)
                      return (
                        <tr key={`${item.assetType}-${item.assetId}-${item.detailId}-${item.rank}`} className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                          <td className="px-3 py-2.5 align-top">
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800/60 font-semibold text-slate-600 dark:text-slate-300">
                              {item.rank}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 align-top">
                            <div className="font-semibold text-slate-950 dark:text-slate-50">{item.detailName}</div>
                            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.detailCode} · {item.serialNumber || "-"}</div>
                          </td>
                          <td className="px-3 py-2.5 align-top text-slate-700 dark:text-slate-300">
                            <Badge className={cn("gap-1", locationBadgeClass)}>
                              <MapPin className="h-3.5 w-3.5" />
                              {item.assetLocation || "-"}
                            </Badge>
                          </td>
                          <td className="px-3 py-2.5 align-top">
                            <Badge variant="outline" className={cn("gap-1", jenis.className)}>
                              <jenis.icon className="h-3.5 w-3.5" />
                              {assetTypeLabel(item.assetType)}
                            </Badge>
                          </td>
                          <td className="px-3 py-2.5 align-top">
                            <Badge variant="outline" className={cn("gap-1", condition.className)}>
                              <condition.icon className="h-3.5 w-3.5" />
                              {item.conditionLabel}
                            </Badge>
                          </td>
                          <td className="px-3 py-2.5 align-top">
                            <Badge variant="outline" className={cn("gap-1", status.className)}>
                              <status.icon className="h-3.5 w-3.5" />
                              {statusLabel}
                            </Badge>
                          </td>
                          <td className="px-3 py-2.5 align-top">
                            <div className="font-semibold text-slate-950 dark:text-slate-50">{formatScore(item.preferenceScore)}</div>
                            <div className="mt-1 h-1.5 w-20 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800/60">
                              <div
                                className="h-full rounded-full bg-linear-to-r from-teal-400 to-teal-600"
                                style={{ width: `${Math.min(100, Math.round(item.preferenceScore * 100))}%` }}
                              />
                            </div>
                          </td>
                          <td className="px-3 py-2.5 align-top">
                            <Badge variant="outline" className={cn("gap-1", recommendation.className)}>
                              <recommendation.icon className="h-3.5 w-3.5" />
                              {item.recommendation}
                            </Badge>
                          </td>
                          <td className="px-3 py-2.5 align-top text-right">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="gap-1"
                              onClick={() => setAuditItem(item)}
                            >
                              <Scale className="h-3.5 w-3.5" />
                              Detail
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                    {filteredRankings.length === 0 && (
                      <tr>
                        <td colSpan={9} className="px-3 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                          Tidak ada data ranking yang sesuai.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {filteredRankings.length > 0 && (
                  <div className="flex flex-col gap-3 border-t border-slate-200 dark:border-slate-800/35 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Menampilkan {rankingStartIndex + 1}-{Math.min(rankingStartIndex + RANKINGS_PER_PAGE, filteredRankings.length)} dari {filteredRankings.length} ranking
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        disabled={currentRankingPage === 1}
                        onClick={() => setRankingPage((page) => Math.max(1, page - 1))}
                        aria-label="Halaman ranking sebelumnya"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      {visibleRankingPages.map((page) => (
                        typeof page === "number" ? (
                          <Button
                            key={page}
                            type="button"
                            variant={page === currentRankingPage ? "default" : "outline"}
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => goToRankingPage(page)}
                            aria-label={`Halaman ranking ${page}`}
                            aria-current={page === currentRankingPage ? "page" : undefined}
                          >
                            {page}
                          </Button>
                        ) : (
                          <span key={page} className="flex h-8 w-8 items-center justify-center text-sm text-slate-400 dark:text-slate-500">
                            ...
                          </span>
                        )
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        disabled={currentRankingPage === totalRankingPages}
                        onClick={() => setRankingPage((page) => Math.min(totalRankingPages, page + 1))}
                        aria-label="Halaman ranking berikutnya"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
            </>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-800/35 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4 text-teal-700" />
              Riwayat Perhitungan
            </CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => setIsHistoryMinimized((prev) => !prev)}
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
          </CardHeader>
          <CardContent className="pt-0">
            {isHistoryMinimized ? (
              <div className="rounded-2xl border border-blue-100 bg-blue-50/80 px-4 py-4 text-center text-[14px] text-blue-900 dark:border-blue-400/20 dark:bg-blue-400/5 dark:text-blue-200">
                Section riwayat perhitungan disembunyikan. Tekan tombol tampilkan untuk membuka kembali detail.
              </div>
            ) : isHistoryLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="h-12 animate-pulse rounded-md bg-slate-100 dark:bg-slate-800/60" />
                ))}
              </div>
            ) : historyEntries.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-175 text-left text-[13px]">
                  <thead className="border-y border-slate-200 dark:border-slate-800/35 bg-slate-100 dark:bg-slate-800/60 text-xs uppercase text-slate-600 dark:text-slate-300">
                    <tr>
                      <th className="px-3 py-2">Waktu</th>
                      <th className="px-3 py-2">Jenis Aset</th>
                      <th className="px-3 py-2">Alternatif</th>
                      <th className="px-3 py-2">Ranking Tertinggi</th>
                      <th className="px-3 py-2">Skor</th>
                      <th className="px-3 py-2 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800/35">
                    {historyEntries.map((entry) => (
                      <tr key={entry.id}>
                        <td className="px-3 py-2 align-top text-slate-700 dark:text-slate-300">
                          {new Date(entry.createdAt).toLocaleString("id-ID")}
                        </td>
                        <td className="px-3 py-2 align-top text-slate-700 dark:text-slate-300">{assetTypeLabel(entry.assetType as DssAssetType)}</td>
                        <td className="px-3 py-2 align-top text-slate-700 dark:text-slate-300">{entry.totalAlternatives}</td>
                        <td className="px-3 py-2 align-top text-slate-700 dark:text-slate-300">{entry.topRankings[0]?.detailName ?? "-"}</td>
                        <td className="px-3 py-2 align-top text-slate-700 dark:text-slate-300">
                          {entry.topRankings[0] ? formatScore(entry.topRankings[0].preferenceScore) : "-"}
                        </td>
                        <td className="px-3 py-2 align-top text-right">
                          <div className="flex justify-end gap-1.5">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="gap-1"
                              onClick={() => setHistoryDetailEntry(entry)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Detail
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="gap-1"
                              onClick={() => applyWeightsFromEntry(entry.weights)}
                            >
                              <ListChecks className="h-3.5 w-3.5" />
                              Gunakan Bobot
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-slate-200 dark:border-slate-800/35 bg-slate-50 dark:bg-slate-900/40 p-3 text-sm text-slate-500 dark:text-slate-400">
                Belum ada riwayat perhitungan. Riwayat tercatat otomatis setiap kali ranking dihitung ulang.
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Activity className="h-4 w-4" />
          Hasil dihitung dari kondisi, usia, jadwal maintenance, pemakaian, riwayat maintenance, urgensi fungsi, risiko status, dan akumulasi biaya maintenance aset.
        </div>
      </div>

      <Dialog open={Boolean(auditItem)} onOpenChange={(open) => { if (!open) setAuditItem(null) }}>
        <DialogContent className="grid max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-5xl grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0">
          <DialogHeader className="shrink-0 px-6 pb-0 pt-6">
            <DialogTitle className="flex min-w-0 items-start gap-2 pr-8 text-xl leading-tight">
              <Scale className="h-4 w-4 text-teal-700" />
              <span className="min-w-0 wrap-break-word">Audit TOPSIS · {auditItem?.detailName}</span>
            </DialogTitle>
            <DialogDescription>
              {auditItem ? `${auditItem.detailCode} · ${auditItem.serialNumber || "Tanpa nomor seri"} · Rank #${auditItem.rank}` : ""}
            </DialogDescription>
          </DialogHeader>
          {auditItem && (
            <div className="min-h-0 min-w-0 space-y-4 overflow-y-auto px-6 py-4">
              <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-3">
                <div className="min-w-0 rounded-lg border border-slate-200 dark:border-slate-800/35 bg-slate-50/70 dark:bg-slate-900/40 p-3">
                  <div className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Preference Score</div>
                  <div className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-50">{formatScore(auditItem.preferenceScore)}</div>
                </div>
                <div className="min-w-0 rounded-lg border border-slate-200 dark:border-slate-800/35 bg-slate-50/70 dark:bg-slate-900/40 p-3">
                  <div className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Jarak Ideal Positif (D+)</div>
                  <div className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-50">
                    {auditItem.positiveDistance != null ? formatScore(auditItem.positiveDistance) : "-"}
                  </div>
                </div>
                <div className="min-w-0 rounded-lg border border-slate-200 dark:border-slate-800/35 bg-slate-50/70 dark:bg-slate-900/40 p-3">
                  <div className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Jarak Ideal Negatif (D-)</div>
                  <div className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-50">
                    {auditItem.negativeDistance != null ? formatScore(auditItem.negativeDistance) : "-"}
                  </div>
                </div>
              </div>

              <div className="min-w-0 max-w-full overflow-auto rounded-lg border border-slate-200 dark:border-slate-800/35">
                <table className="w-full min-w-208 text-left text-[13px]">
                  <thead className="sticky top-0 border-b border-slate-200 dark:border-slate-800/35 bg-slate-100 dark:bg-slate-800/60 text-xs uppercase text-slate-600 dark:text-slate-300">
                    <tr>
                      <th className="px-3 py-2">Kriteria</th>
                      <th className="px-3 py-2 text-right">Bobot</th>
                      <th className="px-3 py-2 text-right">Nilai Mentah</th>
                      <th className="px-3 py-2 text-right">Normalisasi</th>
                      <th className="px-3 py-2 text-right">Terbobot</th>
                      <th className="px-3 py-2 text-right">Ideal +</th>
                      <th className="px-3 py-2 text-right">Ideal -</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800/35">
                    {(rankingResult?.criteria ?? []).map((criterion) => (
                      <tr key={criterion.id} className="text-slate-700 dark:text-slate-300">
                        <td className="px-3 py-2 align-top">
                          <div className="font-medium text-slate-900 dark:text-slate-100">{criterion.name}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">{criterion.type === "benefit" ? "Benefit" : "Cost"}</div>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums align-top">{formatPercent(criterion.weight)}</td>
                        <td className="px-3 py-2 text-right tabular-nums align-top">{(auditItem.criteriaScores?.[criterion.id] ?? 0).toString()}</td>
                        <td className="px-3 py-2 text-right tabular-nums align-top">
                          {auditItem.normalizedScores?.[criterion.id] != null ? formatScore(auditItem.normalizedScores[criterion.id]) : "-"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums align-top">
                          {auditItem.weightedScores?.[criterion.id] != null ? formatScore(auditItem.weightedScores[criterion.id]) : "-"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums align-top">
                          {rankingResult?.idealSolutions?.positive?.[criterion.id] != null ? formatScore(rankingResult.idealSolutions.positive[criterion.id]) : "-"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums align-top">
                          {rankingResult?.idealSolutions?.negative?.[criterion.id] != null ? formatScore(rankingResult.idealSolutions.negative[criterion.id]) : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                Preference score = D- / (D+ + D-). Nilai terbobot = normalisasi × bobot kriteria. Solusi ideal positif/negatif diambil dari nilai terbobot terbaik/terburuk seluruh alternatif.
              </p>
            </div>
          )}
          {auditItem && canRequestMaintenance && (
            <DialogFooter className="shrink-0 border-t border-slate-200 px-6 py-4 dark:border-slate-800/35">
              <Button
                type="button"
                className="gap-2"
                onClick={() => requestMaintenanceForItem(auditItem)}
              >
                <Wrench className="h-4 w-4" />
                Ajukan Pemeliharaan
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(historyDetailEntry)} onOpenChange={(open) => { if (!open) setHistoryDetailEntry(null) }}>
        <DialogContent className="grid max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-3xl grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0">
          <DialogHeader className="shrink-0 px-6 pb-0 pt-6">
            <DialogTitle className="flex items-center gap-2 text-xl leading-tight">
              <History className="h-4 w-4 text-teal-700" />
              Detail Riwayat Perhitungan
            </DialogTitle>
            <DialogDescription>
              {historyDetailEntry ? `${new Date(historyDetailEntry.createdAt).toLocaleString("id-ID")} · ${assetTypeLabel(historyDetailEntry.assetType as DssAssetType)} · ${historyDetailEntry.totalAlternatives} alternatif` : ""}
            </DialogDescription>
          </DialogHeader>
          {historyDetailEntry && (
            <div className="min-h-0 space-y-4 overflow-y-auto px-6 py-4">
              <div>
                <div className="mb-2 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Bobot Kriteria</div>
                <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800/35">
                  <table className="w-full text-left text-[13px]">
                    <thead className="bg-slate-100 dark:bg-slate-800/60 text-xs uppercase text-slate-600 dark:text-slate-300">
                      <tr>
                        <th className="px-3 py-2">Kriteria</th>
                        <th className="px-3 py-2">Tipe</th>
                        <th className="px-3 py-2 text-right">Bobot</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800/35">
                      {historyDetailEntry.criteria.map((criterion) => (
                        <tr key={criterion.id}>
                          <td className="px-3 py-2 text-slate-800 dark:text-slate-200">{criterion.name}</td>
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{criterion.type === "benefit" ? "Benefit" : "Cost"}</td>
                          <td className="px-3 py-2 text-right font-semibold text-slate-900 dark:text-slate-100">{formatPercent(criterion.weight)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div>
                <div className="mb-2 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Top 10 Ranking</div>
                <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800/35">
                  <table className="w-full text-left text-[13px]">
                    <thead className="bg-slate-100 dark:bg-slate-800/60 text-xs uppercase text-slate-600 dark:text-slate-300">
                      <tr>
                        <th className="px-3 py-2">Rank</th>
                        <th className="px-3 py-2">Aset</th>
                        <th className="px-3 py-2 text-right">Skor</th>
                        <th className="px-3 py-2">Rekomendasi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800/35">
                      {historyDetailEntry.topRankings.map((ranking) => (
                        <tr key={`${ranking.rank}-${ranking.detailCode}`}>
                          <td className="px-3 py-2 text-slate-800 dark:text-slate-200">#{ranking.rank}</td>
                          <td className="px-3 py-2 text-slate-800 dark:text-slate-200">
                            {ranking.detailName}
                            <span className="ml-1 text-xs text-slate-500 dark:text-slate-400">({ranking.detailCode})</span>
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-slate-900 dark:text-slate-100">{formatScore(ranking.preferenceScore)}</td>
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{ranking.recommendation}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="mt-8 flex w-full justify-center border-t border-border pt-6">
        <p className="text-center text-[13px] text-muted-foreground">
          Sistem Inventaris  Peminjaman serta Pemeliharaan  sarana (SiPeNa)
        </p>
      </div>
    </div>
  )
}
