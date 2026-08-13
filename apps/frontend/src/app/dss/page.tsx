"use client"

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useConfirm } from "@/hooks/use-confirm";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buildLoginRedirectUrl, getCurrentUser } from "@/services/auth-utils";
import dssService, { type DssAssetRanking, type DssAssetType, type DssMethodComparisonResult, type DssRankingHistoryEntry, type DssRankingResult, type DssScenarioComparisonResult, type DssSensitivityResult, type DssStabilityLabel } from "@/services/dss.service";
import { cn } from "@/utils";
import {
    buildDefaultPairwiseValues,
    buildPairwiseKey,
    buildPairwiseMatrixFromValues,
    buildPairwiseValuesFromMatrix,
    closestSaatyValue,
    computePairwiseConsistencyHints,
    rescaleWeightsToSliderRange,
    SAATY_SCALE_OPTIONS,
} from "@/utils/ahp";
import { locationBadgeClass } from "@/utils/api-mappers";
import { buildTableExportRows, exportTableData, type TableExportColumn } from "@/utils/export-table";
import { canCreateMaintenanceRole } from "@/utils/role";
import { formatDayTimeLabel } from "@/utils/format";
import {
    Activity,
    AlertTriangle,
    ArrowDownUp,
    Building2,
    Calculator,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Clock,
    Download,
    Eye,
    Flame,
    Gauge,
    HandHelping,
    History,
    ListChecks,
    MapPin,
    PauseCircle,
    RefreshCw,
    Save,
    Scale,
    Search,
    ShieldAlert,
    SlidersHorizontal,
    Stethoscope,
    Trash2,
    X,
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

const formatCorrelation = (value: number) => value.toFixed(3)

// Ringkasan satu set bobot: apakah semua kriteria bernilai sama (baseline tanpa
// prioritas) atau ada kriteria yang mendominasi. Dipakai agar entri riwayat bisa
// dibaca tanpa harus membuka tabel bobotnya.
const summarizeWeights = (criteria: DssRankingHistoryEntry["criteria"]) => {
  const weights = criteria.map((criterion) => Number(criterion.weight) || 0)
  if (weights.length === 0) return null
  const max = Math.max(...weights)
  const min = Math.min(...weights)
  // Toleransi 0,5 poin persen: pembulatan slider bisa menyisakan selisih kecil
  // yang secara praktis tetap berarti "rata".
  if (max - min < 0.005) return { uniform: true, label: `Bobot merata ${formatPercent(max)}` }
  const dominant = criteria.reduce((best, criterion) => (criterion.weight > best.weight ? criterion : best))
  return { uniform: false, label: `${dominant.name} ${formatPercent(dominant.weight)}` }
}

const weightMethodLabel = (entry: DssRankingHistoryEntry) =>
  entry.pairwiseMatrix && entry.pairwiseMatrix.length > 0 ? "AHP" : "Manual"

// Identitas satu skenario: jenis aset + bobot yang benar-benar dipakai backend.
// Dibulatkan agar selisih pembulatan float tidak bikin skenario yang sama
// terbaca sebagai skenario berbeda.
const buildRankingSignature = (assetType: DssAssetType, criteria: DssRankingResult["criteria"]) =>
  JSON.stringify({
    assetType,
    weights: criteria.map((criterion) => [criterion.id, criterion.weight.toFixed(6)]),
  })

const stabilityBadgeClass = (stability: DssStabilityLabel) => {
  if (stability === "stabil") return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-300"
  if (stability === "cukup stabil") return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300"
  return "border-red-200 bg-red-50 text-red-700 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-300"
}

const rankingBadgeClass = "min-h-6 max-w-full gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-medium shadow-xs [&>svg]:size-3 [&>svg]:shrink-0"

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

export default function DssPage() {
  const router = useRouter()
  const { confirm } = useConfirm()
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
  const [pairwiseValues, setPairwiseValues] = useState<Record<string, number>>(() => buildDefaultPairwiseValues(CRITERIA_IDS))
  const [historyDetailEntry, setHistoryDetailEntry] = useState<DssRankingHistoryEntry | null>(null)
  const [deletingHistoryId, setDeletingHistoryId] = useState<number | null>(null)
  const [historyActionMessage, setHistoryActionMessage] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<"weights" | "ranking" | "history" | "validation">("weights")
  const [sensitivityResult, setSensitivityResult] = useState<DssSensitivityResult | null>(null)
  const [comparisonResult, setComparisonResult] = useState<DssMethodComparisonResult | null>(null)
  const [isValidationLoading, setIsValidationLoading] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [validationStamp, setValidationStamp] = useState<string | null>(null)
  // Tanda tangan konfigurasi (bobot + jenis aset) dari ranking yang tampil dan
  // dari ranking yang terakhir disimpan; selisihnya dipakai untuk memberi tahu
  // pengguna bahwa skenario di layar belum masuk riwayat.
  const [currentSignature, setCurrentSignature] = useState<string | null>(null)
  const [savedSignature, setSavedSignature] = useState<string | null>(null)
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false)
  const [scenarioLabel, setScenarioLabel] = useState("")
  const [isSavingScenario, setIsSavingScenario] = useState(false)
  const [saveScenarioError, setSaveScenarioError] = useState<string | null>(null)
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<number[]>([])
  const [scenarioComparison, setScenarioComparison] = useState<DssScenarioComparisonResult | null>(null)
  const [isComparisonLoading, setIsComparisonLoading] = useState(false)
  const [comparisonError, setComparisonError] = useState<string | null>(null)
  const [isComparisonOpen, setIsComparisonOpen] = useState(false)
  // Skenario riwayat yang sedang dipulihkan. Selama ini aktif, ranking dihitung
  // memakai bobot persis dari riwayat — bukan hasil pembulatan slider — sehingga
  // hasilnya benar-benar sama dengan snapshot yang tersimpan. Begitu pengguna
  // menyentuh bobot, mode, atau jenis aset, tautan ini dilepas.
  const [activeScenario, setActiveScenario] = useState<{
    id: number
    label: string
    weights: Record<string, number>
    pairwiseMatrix: number[][] | null
  } | null>(null)

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
        setWeightsSavedMessage("Bobot ini akan terpasang otomatis saat Anda membuka SPK. Tidak masuk Riwayat Perhitungan.")
      }
    } catch {
      setWeightsSavedMessage("Gagal menyimpan bobot. Coba lagi.")
    } finally {
      setIsSavingWeights(false)
    }
  }, [rankingResult, normalizedWeights, assetType])

  const applyHistoryEntry = useCallback((entry: DssRankingHistoryEntry) => {
    // Jenis aset ikut dipulihkan: bobot yang sama pada dataset berbeda
    // menghasilkan ranking berbeda, jadi memuat bobot saja tidak cukup untuk
    // mereproduksi skenario.
    setAssetType((entry.assetType as DssAssetType) || "all")

    const usesAhp = Boolean(entry.pairwiseMatrix && entry.pairwiseMatrix.length === CRITERIA_IDS.length)
    if (usesAhp) {
      setPairwiseValues(buildPairwiseValuesFromMatrix(entry.pairwiseMatrix!, CRITERIA_IDS))
      setWeightMode("ahp")
    } else {
      // Slider hanya menerima bilangan bulat 1-40, jadi tampilannya berupa
      // pendekatan. Nilai eksaknya disimpan di activeScenario dan itulah yang
      // dikirim ke backend.
      setWeights((current) => rescaleWeightsToSliderRange(entry.weights, current))
      setWeightMode("manual")
    }

    setActiveScenario({
      id: entry.id,
      label: entry.label || `Riwayat ${formatDayTimeLabel(entry.createdAt, { showWeekday: false })}`,
      weights: entry.weights,
      pairwiseMatrix: usesAhp ? entry.pairwiseMatrix! : null,
    })
    setActiveSection("ranking")
  }, [])

  /** Melepas tautan ke skenario riwayat begitu konfigurasinya diubah manual. */
  const detachActiveScenario = useCallback(() => setActiveScenario(null), [])

  const deleteHistoryEntry = useCallback(async (entry: DssRankingHistoryEntry) => {
    const confirmed = await confirm({
      title: "Hapus riwayat perhitungan?",
      description: `Riwayat ${formatDayTimeLabel(entry.createdAt, { showWeekday: false })} akan dihapus permanen.`,
      confirmText: "Ya, hapus",
      cancelText: "Batal",
      destructive: true,
    })
    if (!confirmed) return

    setDeletingHistoryId(entry.id)
    setHistoryActionMessage(null)
    try {
      const response = await dssService.deleteRankingHistory(entry.id)
      if (response.success) {
        setHistoryEntries((current) => current.filter((item) => item.id !== entry.id))
        setHistoryDetailEntry((current) => current?.id === entry.id ? null : current)
        setSelectedHistoryIds((current) => current.filter((id) => id !== entry.id))
        setHistoryActionMessage("Riwayat perhitungan berhasil dihapus.")
      }
    } catch {
      setHistoryActionMessage("Riwayat gagal dihapus. Silakan coba lagi.")
    } finally {
      setDeletingHistoryId(null)
    }
  }, [confirm])

  const setPairwiseValue = useCallback((rowId: string, colId: string, value: number) => {
    detachActiveScenario()
    setPairwiseValues((current) => ({ ...current, [buildPairwiseKey(rowId, colId)]: value }))
  }, [detachActiveScenario])

  // Live per-pair inconsistency hint, recomputed as the user edits — doesn't wait
  // for "Hitung Ulang" or the backend's CR check, so contradictory judgments can
  // be spotted and fixed before submitting.
  const pairwiseHints = useMemo(
    () => computePairwiseConsistencyHints(buildPairwiseMatrixFromValues(pairwiseValues, CRITERIA_IDS), CRITERIA_IDS),
    [pairwiseValues]
  )

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

  const loadRanking = useCallback(async (options: { persistHistory?: boolean; label?: string } = {}) => {
    setIsLoading(true)
    setErrorMessage(null)
    try {
      // Saat skenario riwayat sedang dipulihkan, yang dikirim adalah bobot
      // eksak dari riwayat, bukan hasil pembulatan slider — supaya rankingnya
      // identik dengan snapshot yang tersimpan.
      const effectiveWeights = activeScenario?.weights ?? normalizedWeights
      const effectivePairwiseMatrix = activeScenario
        ? activeScenario.pairwiseMatrix ?? undefined
        : weightMode === "ahp"
          ? buildPairwiseMatrixFromValues(pairwiseValues, CRITERIA_IDS)
          : undefined

      const response = await dssService.getRanking(
        effectivePairwiseMatrix
          // Manual weights ride along as the fallback the backend uses when
          // the pairwise matrix turns out inconsistent (CR > 0.1), so that
          // fallback actually matches what the UI tells the user happens.
          ? { assetType, limit: 250, pairwiseMatrix: effectivePairwiseMatrix, weights: effectiveWeights, saveHistory: options.persistHistory, label: options.label }
          : { assetType, limit: 250, weights: effectiveWeights, saveHistory: options.persistHistory, label: options.label }
      )
      if (response.success) {
        setRankingResult(response.data)
        const signature = buildRankingSignature(assetType, response.data.criteria)
        setCurrentSignature(signature)
        if (options.persistHistory) {
          // Backend melaporkan hasil simpan sebenarnya; kalau gagal, jangan
          // tandai tersimpan supaya badge tidak menjanjikan riwayat yang kosong.
          if (response.data.historySaved === false) {
            setErrorMessage("Skenario gagal disimpan ke Riwayat Perhitungan. Pastikan migrasi database terbaru sudah dijalankan (npm run migrate --workspace=inventory-backend).")
            void loadHistory()
            return false
          }
          setSavedSignature(signature)
        }
        void loadHistory()
        return true
      }
      return false
    } catch (error) {
      console.error("Error loading DSS ranking:", error)
      setRankingResult(null)
      setErrorMessage(error instanceof Error ? error.message : "Endpoint SPK tidak dapat dihubungi. Periksa layanan backend lalu muat ulang.")
      return false
    } finally {
      setIsLoading(false)
    }
  }, [assetType, normalizedWeights, weightMode, pairwiseValues, activeScenario, loadHistory])

  // Gated on weightsLoaded so we don't fetch twice on mount (once with
  // defaults, once with the restored saved preference).
  useEffect(() => {
    if (!weightsLoaded) return
    void loadRanking()
  }, [weightsLoaded, loadRanking])

  // Tersimpan bila konfigurasi ini baru saja disimpan di sesi ini, atau memang
  // sedang memulihkan skenario dari riwayat.
  const isRankingSaved = Boolean(activeScenario) || Boolean(currentSignature && currentSignature === savedSignature)

  const saveScenario = useCallback(async () => {
    setIsSavingScenario(true)
    setSaveScenarioError(null)
    try {
      const saved = await loadRanking({ persistHistory: true, label: scenarioLabel.trim() || undefined })
      // Dialog hanya ditutup saat penyimpanan benar-benar berhasil, supaya
      // kegagalan tidak terlihat seperti keberhasilan.
      if (saved) {
        setIsSaveDialogOpen(false)
        setScenarioLabel("")
      } else {
        setSaveScenarioError("Skenario gagal disimpan ke Riwayat Perhitungan. Jalankan migrasi database terbaru lalu coba lagi.")
      }
    } finally {
      setIsSavingScenario(false)
    }
  }, [loadRanking, scenarioLabel])

  const toggleHistorySelection = useCallback((historyId: number) => {
    setSelectedHistoryIds((current) => {
      if (current.includes(historyId)) return current.filter((id) => id !== historyId)
      // Perbandingan hanya menerima dua skenario; pilihan terlama digeser keluar
      // agar pengguna tidak perlu membatalkan centang lebih dulu.
      return [...current, historyId].slice(-2)
    })
  }, [])

  const compareSelectedScenarios = useCallback(async () => {
    if (selectedHistoryIds.length !== 2) return
    setIsComparisonOpen(true)
    setIsComparisonLoading(true)
    setComparisonError(null)
    setScenarioComparison(null)
    try {
      const response = await dssService.getScenarioComparison({
        assetType,
        topK: 10,
        scenarios: selectedHistoryIds.map((historyId) => ({ historyId })),
      })
      if (response.success) setScenarioComparison(response.data)
    } catch (error) {
      console.error("Error comparing DSS scenarios:", error)
      setComparisonError(error instanceof Error ? error.message : "Perbandingan skenario gagal dimuat.")
    } finally {
      setIsComparisonLoading(false)
    }
  }, [assetType, selectedHistoryIds])

  // Uji sensitivitas dan pembandingan metode memakai bobot yang sama persis
  // dengan ranking yang sedang ditampilkan, sehingga hasilnya benar-benar
  // memvalidasi konfigurasi yang dipakai — bukan konfigurasi default.
  const loadValidation = useCallback(async () => {
    setIsValidationLoading(true)
    setValidationError(null)
    // Sama seperti ranking: kalau skenario riwayat sedang dipulihkan, yang diuji
    // adalah bobot eksaknya, bukan pendekatan slider.
    const validationWeights = activeScenario?.weights ?? normalizedWeights
    const validationPairwise = activeScenario
      ? activeScenario.pairwiseMatrix ?? undefined
      : weightMode === "ahp"
        ? buildPairwiseMatrixFromValues(pairwiseValues, CRITERIA_IDS)
        : undefined
    const payload = validationPairwise
      ? { assetType, weights: validationWeights, pairwiseMatrix: validationPairwise, topK: 10 }
      : { assetType, weights: validationWeights, topK: 10 }
    try {
      const [sensitivity, comparison] = await Promise.all([
        dssService.getSensitivityAnalysis(payload),
        dssService.getMethodComparison(payload),
      ])
      if (sensitivity.success) setSensitivityResult(sensitivity.data)
      if (comparison.success) setComparisonResult(comparison.data)
      setValidationStamp(new Date().toISOString())
    } catch (error) {
      console.error("Error loading DSS validation:", error)
      setValidationError(error instanceof Error ? error.message : "Analisis validasi gagal dimuat.")
    } finally {
      setIsValidationLoading(false)
    }
  }, [assetType, normalizedWeights, weightMode, pairwiseValues, activeScenario])

  // Analisis ini jauh lebih berat daripada satu kali ranking (8 kriteria x 4
  // skenario + 3 metode), jadi hanya dijalankan saat tabnya dibuka.
  useEffect(() => {
    if (activeSection !== "validation") return
    if (sensitivityResult || comparisonResult || isValidationLoading) return
    void loadValidation()
  }, [activeSection, sensitivityResult, comparisonResult, isValidationLoading, loadValidation])

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

  const exportHistory = useCallback(async (format: "excel" | "pdf") => {
    const selectedEntries = selectedHistoryIds.length > 0
      ? selectedHistoryIds
          .map((historyId) => historyEntries.find((entry) => entry.id === historyId))
          .filter((entry): entry is DssRankingHistoryEntry => Boolean(entry))
      : historyEntries

    const columns = [
      "Skenario",
      "Waktu",
      "Jenis Aset",
      "Alternatif",
      "Metode",
      "Ringkasan Bobot",
      "Rank",
      "Nama Aset Detail",
      "Kode",
      "Skor",
      "Rekomendasi",
    ]

    const rows = selectedEntries.flatMap((entry) =>
      entry.topRankings.slice(0, 10).map((ranking) => ({
        Skenario: entry.label || "Tanpa nama",
        Waktu: formatDayTimeLabel(entry.createdAt, { showWeekday: false }),
        "Jenis Aset": assetTypeLabel(entry.assetType as DssAssetType),
        Alternatif: String(entry.totalAlternatives),
        Metode: weightMethodLabel(entry),
        "Ringkasan Bobot": summarizeWeights(entry.criteria)?.label || "-",
        Rank: String(ranking.rank),
        "Nama Aset Detail": ranking.detailName,
        Kode: ranking.detailCode,
        Skor: formatScore(ranking.preferenceScore),
        Rekomendasi: ranking.recommendation,
      }))
    )

    await exportTableData(format, {
      title: "Riwayat Perhitungan SPK",
      columns,
      rows,
      filePrefix: "spk-riwayat-perhitungan",
    })
  }, [historyEntries, selectedHistoryIds])

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

  const sensitivityCriteria = sensitivityResult?.criteria ?? []
  const dominantCriterionId = sensitivityCriteria.reduce<string | null>((currentDominantId, criterion) => {
    if (!currentDominantId) return criterion.id
    const currentDominant = sensitivityCriteria.find((item) => item.id === currentDominantId)
    return !currentDominant || criterion.baseWeight > currentDominant.baseWeight ? criterion.id : currentDominantId
  }, null)

  const topRankings = rankingResult?.rankings.slice(0, 3) || []
  const topScoreGap = topRankings.length > 1 ? Math.max(0, topRankings[0].preferenceScore - topRankings[1].preferenceScore) : null

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
                  <Select value={assetType} onValueChange={(value) => { detachActiveScenario(); setAssetType(value as DssAssetType) }}>
                    <SelectTrigger className="w-full sm:w-45">
                      <SelectValue placeholder="Jenis aset" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="focus:bg-teal-600 focus:text-white focus:[&_svg]:text-white">Semua aset</SelectItem>
                      <SelectItem value="medical" className="focus:bg-teal-600 focus:text-white focus:[&_svg]:text-white">Medis</SelectItem>
                      <SelectItem value="non_medical" className="focus:bg-teal-600 focus:text-white focus:[&_svg]:text-white">Non-Medis</SelectItem>
                    </SelectContent>
                  </Select>
                  {rankingResult && (
                    <Badge
                      variant="outline"
                      className={cn(
                        "h-9 shrink-0 rounded-2xl px-3",
                        isRankingSaved
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-300"
                          : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300"
                      )}
                    >
                      {activeScenario
                        ? `Skenario tersimpan · ${activeScenario.label}`
                        : isRankingSaved
                          ? "Skenario tersimpan"
                          : "Skenario belum disimpan"}
                    </Badge>
                  )}
                  <Button
                    onClick={() => { setSaveScenarioError(null); setIsSaveDialogOpen(true) }}
                    disabled={isLoading || !rankingResult}
                    className="gap-2 rounded-2xl bg-teal-600 text-white hover:bg-teal-700 dark:bg-teal-600 dark:text-white dark:hover:bg-teal-700"
                  >
                    <Save className="h-4 w-4" />
                    Simpan Skenario
                  </Button>
                  <Button onClick={() => void loadRanking()} disabled={isLoading} className="gap-2 rounded-2xl bg-teal-600 text-white hover:bg-teal-700">
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

              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800/35 dark:bg-slate-900/40">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="rounded-full border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-700 dark:border-slate-700/40 dark:bg-slate-900/60 dark:text-slate-300">
                    Ringkasan presentasi
                  </Badge>
                  {rankingResult?.consistency && (
                    <Badge
                      variant="outline"
                      className={cn(
                        "rounded-full px-3 py-1 text-[11px]",
                        rankingResult.consistency.isConsistent
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-300"
                          : "border-red-200 bg-red-50 text-red-700 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-300"
                      )}
                    >
                      Konsistensi model: {rankingResult.consistency.isConsistent ? "konsisten" : "tidak konsisten"}
                    </Badge>
                  )}
                  {topRankings[0] && (
                    <Badge variant="outline" className="rounded-full border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-700 dark:border-slate-700/40 dark:bg-slate-900/60 dark:text-slate-300">
                      Nilai preferensi puncak: {formatScore(topRankings[0].preferenceScore)}
                    </Badge>
                  )}
                  {topScoreGap != null && (
                    <Badge variant="outline" className="rounded-full border-teal-200 bg-teal-50 px-3 py-1 text-[11px] text-teal-700 dark:border-teal-400/30 dark:bg-teal-400/10 dark:text-teal-300">
                      Selisih peringkat teratas: {formatScore(topScoreGap)}
                    </Badge>
                  )}
                  {sensitivityResult && (
                    <Badge variant="outline" className={cn("rounded-full px-3 py-1 text-[11px]", stabilityBadgeClass(sensitivityResult.overallStability))}>
                      Stabilitas sensitivitas: {sensitivityResult.overallStability}
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 dark:border-slate-800/35 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Peringkat Teratas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {topRankings.length > 0 ? (
                topRankings.map((item) => {
                  const recommendation = recommendationMeta(item.recommendation)
                  return (
                    <div key={`${item.assetType}-${item.assetId}-${item.detailId}`} className="grid gap-3 rounded-md border border-slate-200 dark:border-slate-800/35 bg-slate-50/60 dark:bg-slate-900/40 p-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-start">
                      <span className="inline-flex size-7 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200 dark:bg-slate-800/70 dark:text-slate-300 dark:ring-slate-700">
                        {item.rank}
                      </span>
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

        <Tabs
          value={activeSection}
          onValueChange={(value) => setActiveSection(value as "weights" | "ranking" | "history" | "validation")}
          className="gap-4"
        >
          <div className="overflow-x-auto pb-1">
            <TabsList
              aria-label="Navigasi fitur SPK"
              className="h-auto min-w-max gap-1 rounded-2xl bg-slate-100 p-1.5 dark:bg-slate-800/60"
            >
              <TabsTrigger
                value="weights"
                className="h-11 rounded-xl px-4 text-sm data-[state=active]:bg-teal-600 data-[state=active]:text-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-teal-600 dark:data-[state=active]:text-white"
              >
                <SlidersHorizontal className="h-4 w-4" />
                Bobot Kriteria
              </TabsTrigger>
              <TabsTrigger
                value="ranking"
                className="h-11 rounded-xl px-4 text-sm data-[state=active]:bg-teal-600 data-[state=active]:text-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-teal-600 dark:data-[state=active]:text-white"
              >
                <ArrowDownUp className="h-4 w-4" />
                Ranking Prioritas
              </TabsTrigger>
              <TabsTrigger
                value="validation"
                className="h-11 rounded-xl px-4 text-sm data-[state=active]:bg-teal-600 data-[state=active]:text-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-teal-600 dark:data-[state=active]:text-white"
              >
                <Gauge className="h-4 w-4" />
                Validasi Model
              </TabsTrigger>
              <TabsTrigger
                value="history"
                className="h-11 rounded-xl px-4 text-sm data-[state=active]:bg-teal-600 data-[state=active]:text-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-teal-600 dark:data-[state=active]:text-white"
              >
                <History className="h-4 w-4" />
                Riwayat Perhitungan
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="weights" className="mt-0">
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
              {weightMode === "manual" && (
                <Button
                  type="button"
                  className="w-full bg-teal-600 text-white hover:bg-teal-700 sm:w-auto"
                  onClick={() => { detachActiveScenario(); setWeights(DEFAULT_WEIGHTS) }}
                >
                  Reset Bobot Default
                </Button>
              )}
              {weightMode === "ahp" && (
                <Button
                  type="button"
                  className="w-full bg-teal-600 text-white hover:bg-teal-700 sm:w-auto"
                  onClick={() => { detachActiveScenario(); setPairwiseValues(buildDefaultPairwiseValues(CRITERIA_IDS)) }}
                >
                  Reset Matriks AHP
                </Button>
              )}
              <Button
                type="button"
                className="w-full gap-2 bg-teal-600 text-white hover:bg-teal-700 sm:w-auto"
                disabled={isSavingWeights}
                onClick={() => void saveWeightsAsDefault()}
              >
                <SlidersHorizontal className={cn("h-4 w-4", isSavingWeights && "animate-pulse")} />
                Jadikan Bobot Awal Saya
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <Tabs value={weightMode} onValueChange={(value) => { detachActiveScenario(); setWeightMode(value as "manual" | "ahp") }}>
              <TabsList>
                <TabsTrigger
                  value="manual"
                  className="data-[state=active]:bg-teal-600 data-[state=active]:text-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-teal-600 dark:data-[state=active]:text-white"
                >
                  Bobot Manual
                </TabsTrigger>
                <TabsTrigger
                  value="ahp"
                  className="data-[state=active]:bg-teal-600 data-[state=active]:text-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-teal-600 dark:data-[state=active]:text-white"
                >
                  AHP (Perbandingan Berpasangan)
                </TabsTrigger>
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
                          onChange={(event) => {
                            detachActiveScenario()
                            setWeights((current) => ({
                              ...current,
                              [criterion.id]: Number(event.target.value),
                            }))
                          }}
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

                {rankingResult?.consistency?.isConsistent && (
                  <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800/35">
                    <div className="border-b border-slate-200 dark:border-slate-800/35 bg-slate-50/70 dark:bg-slate-900/40 px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400">
                      Bobot hasil AHP yang dipakai untuk perhitungan TOPSIS (diurutkan dari yang terbesar).
                    </div>
                    <table className="w-full text-left text-[13px]">
                      <thead className="bg-slate-100 dark:bg-slate-800/60 text-xs uppercase text-slate-600 dark:text-slate-300">
                        <tr>
                          <th className="px-4 py-2">Kriteria</th>
                          <th className="px-4 py-2">Tipe</th>
                          <th className="px-4 py-2 text-right">Bobot AHP</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800/35">
                        {[...rankingResult.criteria]
                          .sort((a, b) => b.weight - a.weight)
                          .map((criterion) => (
                            <tr key={criterion.id}>
                              <td className="px-4 py-2 text-slate-800 dark:text-slate-200">{criterion.name}</td>
                              <td className="px-4 py-2">
                                <Badge variant="outline" className="bg-white dark:bg-slate-900/60">
                                  {criterion.type === "benefit" ? "Benefit" : "Cost"}
                                </Badge>
                              </td>
                              <td className="px-4 py-2 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800/60">
                                    <div
                                      className="h-full rounded-full bg-linear-to-r from-teal-400 to-teal-600"
                                      style={{ width: `${Math.min(100, Math.round(criterion.weight * 100))}%` }}
                                    />
                                  </div>
                                  <span className="w-14 font-semibold text-slate-900 dark:text-slate-100">{formatPercent(criterion.weight)}</span>
                                </div>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
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
                        const hint = pairwiseHints.find((entry) => entry.rowId === rowCriterion.id && entry.colId === colCriterion.id)
                        return (
                          <div key={key} className="grid grid-cols-1 items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-800/35 bg-slate-50/60 dark:bg-slate-900/40 p-3 sm:grid-cols-[minmax(0,1fr)_200px]">
                            <div className="text-sm text-slate-800 dark:text-slate-200">
                              <span className="font-semibold">{rowCriterion.name}</span>
                              <span className="mx-1.5 text-slate-400">vs</span>
                              <span className="font-semibold">{colCriterion.name}</span>
                              {hint?.isHighContributor && (
                                <Badge variant="outline" className="ml-2 gap-1 border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300">
                                  <AlertTriangle className="h-3 w-3" />
                                  Kontribusi inkonsistensi tinggi
                                </Badge>
                              )}
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
          </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ranking" className="mt-0">
            <Card className="overflow-hidden border-slate-200 shadow-sm dark:border-slate-800/35">
          <CardHeader className="gap-4 border-b border-slate-100 bg-linear-to-r from-white via-white to-teal-50/70 pb-4 dark:border-slate-800/50 dark:from-slate-950 dark:via-slate-950 dark:to-teal-950/30 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle className="flex items-center gap-3 text-base">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-700 ring-1 ring-teal-200/70 dark:bg-teal-400/10 dark:text-teal-300 dark:ring-teal-400/20">
                <ArrowDownUp className="size-4" />
              </span>
              <span>
                <span className="block font-semibold text-slate-950 dark:text-slate-50">Ranking Prioritas</span>
                <span className="mt-0.5 block text-xs font-normal text-slate-500 dark:text-slate-400">Urutan aset berdasarkan skor keputusan</span>
              </span>
            </CardTitle>
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:w-auto">
              <div className="relative w-full lg:w-80">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 shrink-0 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Cari aset, kode, nomor seri"
                  className="pl-9"
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" className="w-full gap-2 rounded-xl bg-white shadow-xs hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700 dark:bg-slate-950 dark:hover:bg-teal-400/10 dark:hover:text-teal-300 sm:w-auto">
                    <Download className="size-4 shrink-0" />
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
            </div>
          </CardHeader>
          <CardContent className="p-0">
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
                <table className="w-full min-w-245 text-left text-xs">
                  <thead className="border-y border-teal-700/20 bg-teal-600 text-[11px] uppercase tracking-wide text-white shadow-sm dark:border-teal-400/20 dark:bg-teal-700 dark:text-white">
                    <tr>
                      <th className="w-14 px-2.5 py-2">Rank</th>
                      <th className="px-2.5 py-2">Aset Detail</th>
                      <th className="px-2.5 py-2">Lokasi</th>
                      <th className="px-2.5 py-2">Jenis</th>
                      <th className="px-2.5 py-2">Kondisi</th>
                      <th className="px-2.5 py-2">Status</th>
                      <th className="px-2.5 py-2">Skor</th>
                      <th className="px-2.5 py-2">Rekomendasi</th>
                      <th className="px-2.5 py-2 text-right">Audit</th>
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
                        <tr key={`${item.assetType}-${item.assetId}-${item.detailId}-${item.rank}`} className="group transition-colors hover:bg-teal-50/35 dark:hover:bg-teal-950/10">
                          <td className="px-2.5 py-2 align-top">
                            <span
                              className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200 dark:bg-slate-800/70 dark:text-slate-300 dark:ring-slate-700"
                              aria-label={`Peringkat ${item.rank}`}
                            >
                              {item.rank}
                            </span>
                          </td>
                          <td className="px-2.5 py-2 align-top">
                            <div className="font-semibold text-slate-950 transition-colors group-hover:text-teal-800 dark:text-slate-50 dark:group-hover:text-teal-300">{item.detailName}</div>
                            <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{item.detailCode} · {item.serialNumber || "-"}</div>
                          </td>
                          <td className="px-2.5 py-2 align-top text-slate-700 dark:text-slate-300">
                            <Badge className={cn(rankingBadgeClass, locationBadgeClass)}>
                              <MapPin aria-hidden="true" />
                              {item.assetLocation || "-"}
                            </Badge>
                          </td>
                          <td className="px-2.5 py-2 align-top">
                            <Badge variant="outline" className={cn(rankingBadgeClass, jenis.className)}>
                              <jenis.icon aria-hidden="true" />
                              {assetTypeLabel(item.assetType)}
                            </Badge>
                          </td>
                          <td className="px-2.5 py-2 align-top">
                            <Badge variant="outline" className={cn(rankingBadgeClass, condition.className)}>
                              <condition.icon aria-hidden="true" />
                              {item.conditionLabel}
                            </Badge>
                          </td>
                          <td className="px-2.5 py-2 align-top">
                            <Badge variant="outline" className={cn(rankingBadgeClass, status.className)}>
                              <status.icon aria-hidden="true" />
                              {statusLabel}
                            </Badge>
                          </td>
                          <td className="px-2.5 py-2 align-top">
                            <div className="font-semibold text-slate-950 dark:text-slate-50">{formatScore(item.preferenceScore)}</div>
                            <div className="mt-1.5 h-1.5 w-20 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200/60 dark:bg-slate-800/60 dark:ring-slate-700/50">
                              <div
                                className="h-full rounded-full bg-linear-to-r from-teal-400 to-teal-600"
                                style={{ width: `${Math.min(100, Math.round(item.preferenceScore * 100))}%` }}
                              />
                            </div>
                          </td>
                          <td className="px-2.5 py-2 align-top">
                            <Badge variant="outline" className={cn(rankingBadgeClass, recommendation.className)}>
                              <recommendation.icon aria-hidden="true" />
                              {item.recommendation}
                            </Badge>
                          </td>
                          <td className="px-2.5 py-2 align-top text-right">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="gap-1.5 rounded-xl bg-white shadow-xs transition-colors hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700 dark:bg-slate-950 dark:hover:bg-teal-400/10 dark:hover:text-teal-300"
                              onClick={() => setAuditItem(item)}
                            >
                              <Scale className="size-3.5 shrink-0" />
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
          </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="validation" className="mt-0">
            <div className="space-y-4">
              <Card className="border-slate-200 dark:border-slate-800/35 shadow-sm">
                <CardHeader className="flex flex-col gap-3 border-b border-slate-100 bg-linear-to-r from-white via-white to-teal-50/70 pb-4 dark:border-slate-800/35 dark:from-slate-950 dark:via-slate-950 dark:to-teal-950/30 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Gauge className="h-4 w-4 text-teal-700" />
                    Uji Sensitivitas Bobot
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {validationStamp && (
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        Diperbarui {new Date(validationStamp).toLocaleTimeString("id-ID")}
                      </span>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      disabled={isValidationLoading}
                      onClick={() => void loadValidation()}
                    >
                      <RefreshCw className={cn("h-3.5 w-3.5", isValidationLoading && "animate-spin")} />
                      {isValidationLoading ? "Menghitung..." : "Perbarui Analisis"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-0">
                  <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                    Setiap bobot kriteria diuji dengan perubahan -20%, -10%, +10%, dan +20% (bobot lain dinormalisasi ulang),
                    lalu hasilnya dibandingkan dengan ranking dasar menggunakan korelasi peringkat Spearman dan irisan top-10.
                    Nilai yang mendekati 1 menunjukkan peringkat tetap stabil meskipun bobot digeser.
                  </p>

                  {validationError && (
                    <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-300" role="alert">
                      {validationError}
                    </div>
                  )}

                  {isValidationLoading && !sensitivityResult ? (
                    <div className="space-y-2">
                      {Array.from({ length: 4 }).map((_, index) => (
                        <div key={index} className="h-12 animate-pulse rounded-md bg-slate-100 dark:bg-slate-800/60" />
                      ))}
                    </div>
                  ) : sensitivityResult && sensitivityResult.criteria.length > 0 ? (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={stabilityBadgeClass(sensitivityResult.overallStability)}>
                          Kestabilan: {sensitivityResult.overallStability}
                        </Badge>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          Spearman terendah {formatCorrelation(sensitivityResult.overallMinSpearman)} · {sensitivityResult.totalAlternatives} alternatif
                        </span>
                      </div>
                      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-800/35 dark:bg-slate-900/40 dark:text-slate-400">
                        <span className="font-medium text-slate-700 dark:text-slate-300">Interpretasi warna:</span> badge amber menandai kriteria paling sensitif, sedangkan badge teal menandai bobot dominan pada konfigurasi saat ini.
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full min-w-175 text-left text-[13px]">
                          <thead className="border-y border-slate-200 bg-slate-100 text-xs uppercase text-slate-600 dark:border-slate-800/35 dark:bg-slate-800/60 dark:text-slate-300">
                            <tr>
                              <th className="px-3 py-2">Kriteria</th>
                              <th className="px-3 py-2 text-right">Bobot</th>
                              <th className="px-3 py-2 text-right">Spearman min</th>
                              <th className="px-3 py-2 text-right">Spearman rata-rata</th>
                              <th className="px-3 py-2 text-right">Irisan Top-10 min</th>
                              <th className="px-3 py-2 text-right">Rank 1 berubah</th>
                              <th className="px-3 py-2">Kestabilan</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-800/35">
                            {sensitivityResult.criteria.map((criterion) => (
                              <tr key={criterion.id}>
                                <td className="px-3 py-2 text-slate-800 dark:text-slate-200">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span>{criterion.name}</span>
                                    {criterion.id === dominantCriterionId && (
                                      <Badge variant="outline" className="border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-400/30 dark:bg-teal-400/10 dark:text-teal-300">
                                        Bobot dominan
                                      </Badge>
                                    )}
                                    {criterion.id === sensitivityResult.mostSensitiveCriterionId && (
                                      <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300">
                                        Paling sensitif
                                      </Badge>
                                    )}
                                  </div>
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300">{formatPercent(criterion.baseWeight)}</td>
                                <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-900 dark:text-slate-100">{formatCorrelation(criterion.minSpearman)}</td>
                                <td className="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300">{formatCorrelation(criterion.meanSpearman)}</td>
                                <td className="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300">{formatPercent(criterion.minTopKOverlap)}</td>
                                <td className="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300">
                                  {criterion.rankOneChanges}/{criterion.scenarios.length}
                                </td>
                                <td className="px-3 py-2">
                                  <Badge variant="outline" className={cn(rankingBadgeClass, stabilityBadgeClass(criterion.stability))}>
                                    {criterion.stability}
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">{sensitivityResult.interpretation}</p>
                    </>
                  ) : (
                    <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-500 dark:border-slate-800/35 dark:bg-slate-900/40 dark:text-slate-400">
                      Belum ada data alternatif untuk diuji.
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-slate-200 dark:border-slate-800/35 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Scale className="h-4 w-4 text-teal-700" />
                    Perbandingan Metode (TOPSIS vs SAW vs WP)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-0">
                  <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                    Matriks keputusan dan bobot yang sama dihitung ulang dengan SAW dan WP sebagai pembanding. Kesepakatan yang tinggi
                    menunjukkan prioritas yang dihasilkan bukan artefak dari satu metode saja.
                  </p>

                  {isValidationLoading && !comparisonResult ? (
                    <div className="space-y-2">
                      {Array.from({ length: 3 }).map((_, index) => (
                        <div key={index} className="h-12 animate-pulse rounded-md bg-slate-100 dark:bg-slate-800/60" />
                      ))}
                    </div>
                  ) : comparisonResult && comparisonResult.methods.length > 0 ? (
                    <>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-150 text-left text-[13px]">
                          <thead className="border-y border-slate-200 bg-slate-100 text-xs uppercase text-slate-600 dark:border-slate-800/35 dark:bg-slate-800/60 dark:text-slate-300">
                            <tr>
                              <th className="px-3 py-2">Pasangan Metode</th>
                              <th className="px-3 py-2 text-right">Spearman</th>
                              <th className="px-3 py-2 text-right">Kendall tau-b</th>
                              <th className="px-3 py-2 text-right">Irisan Top-{comparisonResult.topK}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-800/35">
                            {comparisonResult.agreements.map((agreement) => (
                              <tr key={`${agreement.methodA}-${agreement.methodB}`}>
                                <td className="px-3 py-2 text-slate-800 dark:text-slate-200">{agreement.methodA} ↔ {agreement.methodB}</td>
                                <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-900 dark:text-slate-100">{formatCorrelation(agreement.spearman)}</td>
                                <td className="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300">{formatCorrelation(agreement.kendall)}</td>
                                <td className="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300">{formatPercent(agreement.topKOverlap)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="grid gap-3 md:grid-cols-3">
                        {comparisonResult.methods.map((method) => (
                          <div key={method.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800/35">
                            <div className="mb-2 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">{method.name}</div>
                            <ol className="space-y-1.5">
                              {method.top.map((entry) => (
                                <li key={`${method.id}-${entry.rank}-${entry.detailCode}`} className="flex items-start justify-between gap-2 text-[13px]">
                                  <span className="min-w-0 text-slate-700 dark:text-slate-300">
                                    <span className="mr-1 text-slate-400">#{entry.rank}</span>
                                    <span className="wrap-break-word">{entry.detailName}</span>
                                  </span>
                                  <span className="shrink-0 tabular-nums text-slate-500 dark:text-slate-400">{formatScore(entry.score)}</span>
                                </li>
                              ))}
                            </ol>
                          </div>
                        ))}
                      </div>

                      <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">{comparisonResult.interpretation}</p>
                    </>
                  ) : (
                    <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-500 dark:border-slate-800/35 dark:bg-slate-900/40 dark:text-slate-400">
                      Belum ada data alternatif untuk dibandingkan.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-0">
            <Card className="border-slate-200 dark:border-slate-800/35 shadow-sm">
          <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4 text-teal-700" />
              Riwayat Perhitungan
            </CardTitle>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" className="w-full gap-2 rounded-xl bg-white shadow-xs hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700 dark:bg-slate-950 dark:hover:bg-teal-400/10 dark:hover:text-teal-300 sm:w-auto">
                    <Download className="size-4 shrink-0" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => void exportHistory("excel")}>
                    Export ke Excel
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void exportHistory("pdf")}>
                    Export ke PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {selectedHistoryIds.length}/2 skenario dipilih
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  disabled={selectedHistoryIds.length !== 2}
                  onClick={() => void compareSelectedScenarios()}
                >
                  <ArrowDownUp className="h-3.5 w-3.5" />
                  Bandingkan
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {historyActionMessage && (
              <div className="mb-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-800/35 dark:bg-slate-900/40 dark:text-slate-300" role="status">
                {historyActionMessage}
              </div>
            )}
            {isHistoryLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="h-12 animate-pulse rounded-md bg-slate-100 dark:bg-slate-800/60" />
                ))}
              </div>
            ) : historyEntries.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-175 text-left text-[13px]">
                  <thead className="border-y border-teal-700/20 bg-teal-600 text-xs uppercase text-white shadow-sm dark:border-teal-400/20 dark:bg-teal-700 dark:text-white">
                    <tr>
                      <th className="w-10 px-3 py-2">
                        <span className="sr-only">Pilih untuk dibandingkan</span>
                      </th>
                      <th className="px-3 py-2">Skenario</th>
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
                      <tr key={entry.id} className={cn(selectedHistoryIds.includes(entry.id) && "bg-teal-50/60 dark:bg-teal-400/5")}>
                        <td className="px-3 py-2 align-top">
                          <input
                            type="checkbox"
                            className="mt-1 h-4 w-4 accent-teal-600"
                            checked={selectedHistoryIds.includes(entry.id)}
                            onChange={() => toggleHistorySelection(entry.id)}
                            aria-label={`Pilih skenario ${entry.label || formatDayTimeLabel(entry.createdAt, { showWeekday: false })} untuk dibandingkan`}
                          />
                        </td>
                        <td className="px-3 py-2 align-top text-slate-800 dark:text-slate-200">
                          <div>{entry.label || <span className="text-slate-400 dark:text-slate-500">Tanpa nama</span>}</div>
                          {/* Metode + kriteria dominan: identitas skenario yang membedakannya
                              dari baris lain, tanpa perlu membuka Detail. */}
                          <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                            {weightMethodLabel(entry)}
                            {summarizeWeights(entry.criteria) && ` · ${summarizeWeights(entry.criteria)!.label}`}
                          </div>
                        </td>
                        <td className="px-3 py-2 align-top text-slate-700 dark:text-slate-300">
                          {formatDayTimeLabel(entry.createdAt, { showWeekday: false })}
                        </td>
                        <td className="px-3 py-2 align-top text-slate-700 dark:text-slate-300">{assetTypeLabel(entry.assetType as DssAssetType)}</td>
                        <td className="px-3 py-2 align-top text-slate-700 dark:text-slate-300">{entry.totalAlternatives}</td>
                        <td className="px-3 py-2 align-top text-slate-700 dark:text-slate-300">
                          {entry.topRankings[0]?.detailName ?? "-"}
                          {/* Baris tabel hanya memuat peringkat teratas; sisanya dibuka lewat Detail. */}
                          {entry.topRankings.length > 1 && (
                            <button
                              type="button"
                              className="ml-1 text-xs text-teal-700 underline-offset-2 hover:underline dark:text-teal-300"
                              onClick={() => setHistoryDetailEntry(entry)}
                            >
                              +{entry.topRankings.length - 1} lainnya
                            </button>
                          )}
                        </td>
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
                              onClick={() => applyHistoryEntry(entry)}
                            >
                              <ListChecks className="h-3.5 w-3.5" />
                              Gunakan Bobot
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="gap-1 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-400/30 dark:text-red-300 dark:hover:bg-red-400/10"
                              disabled={deletingHistoryId === entry.id}
                              onClick={() => void deleteHistoryEntry(entry)}
                              aria-label={`Hapus riwayat ${formatDayTimeLabel(entry.createdAt, { showWeekday: false })}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              {deletingHistoryId === entry.id ? "Menghapus..." : "Hapus"}
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
                Belum ada riwayat perhitungan. Tekan &quot;Simpan Skenario&quot; pada halaman ranking untuk mengarsipkan konfigurasi bobot yang ingin dibandingkan.
              </div>
            )}
          </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Activity className="h-4 w-4" />
          Hasil dihitung dari kondisi, usia, jadwal maintenance, pemakaian, riwayat maintenance, urgensi fungsi, risiko status, dan akumulasi biaya maintenance aset.
        </div>
      </div>

      <Dialog open={isSaveDialogOpen} onOpenChange={(open) => { if (!open) setIsSaveDialogOpen(false) }}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl leading-tight">
              <Save className="h-4 w-4 text-teal-700" />
              Simpan Skenario Bobot
            </DialogTitle>
            <DialogDescription>
              Konfigurasi bobot yang sedang tampil akan diarsipkan ke Riwayat Perhitungan dan dapat dibandingkan dengan skenario lain.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="scenario-label">Nama skenario (opsional)</Label>
            <Input
              id="scenario-label"
              value={scenarioLabel}
              maxLength={120}
              placeholder="Contoh: Bobot kondisi dominan 30%"
              onChange={(event) => setScenarioLabel(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !isSavingScenario) void saveScenario()
              }}
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Tanpa nama pun tetap tersimpan, tapi memberi nama membuat riwayat jauh lebih mudah dibaca saat dibandingkan.
            </p>
            {saveScenarioError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-300" role="alert">
                {saveScenarioError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="gap-2 border-teal-200 bg-white text-teal-700 shadow-xs hover:border-teal-300 hover:bg-teal-50 hover:text-teal-800 dark:border-teal-400/30 dark:bg-slate-950 dark:text-teal-300 dark:hover:bg-teal-400/10 dark:hover:text-teal-200"
              onClick={() => setIsSaveDialogOpen(false)}
              disabled={isSavingScenario}
            >
              <X className="h-4 w-4" />
              Batal
            </Button>
            <Button
              type="button"
              className="gap-2 bg-teal-600 text-white hover:bg-teal-700 dark:bg-teal-600 dark:text-white dark:hover:bg-teal-700"
              onClick={() => void saveScenario()}
              disabled={isSavingScenario}
            >
              <Save className="h-4 w-4" />
              {isSavingScenario ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isComparisonOpen} onOpenChange={(open) => { if (!open) setIsComparisonOpen(false) }}>
        <DialogContent className="grid max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-4xl grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0">
          <DialogHeader className="shrink-0 px-6 pb-0 pt-6">
            <DialogTitle className="flex items-center gap-2 text-xl leading-tight">
              <ArrowDownUp className="h-4 w-4 text-teal-700" />
              Perbandingan Skenario Bobot
            </DialogTitle>
            <DialogDescription>
              {scenarioComparison
                ? `${scenarioComparison.scenarios[0].label} vs ${scenarioComparison.scenarios[1].label} · ${scenarioComparison.totalAlternatives} alternatif dihitung ulang penuh`
                : "Kedua skenario dihitung ulang penuh dari bobot tersimpan."}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 space-y-4 overflow-y-auto px-6 py-4">
            {comparisonError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-300" role="alert">
                {comparisonError}
              </div>
            )}

            {isComparisonLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="h-10 animate-pulse rounded-md bg-slate-100 dark:bg-slate-800/60" />
                ))}
              </div>
            ) : scenarioComparison && scenarioComparison.movements.length > 0 ? (
              <>
                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800/35">
                    <div className="text-xs uppercase text-slate-500 dark:text-slate-400">Spearman</div>
                    <div className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">{formatCorrelation(scenarioComparison.spearman)}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800/35">
                    <div className="text-xs uppercase text-slate-500 dark:text-slate-400">Irisan Top-{scenarioComparison.topK}</div>
                    <div className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">{formatPercent(scenarioComparison.topKOverlap)}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800/35">
                    <div className="text-xs uppercase text-slate-500 dark:text-slate-400">Masuk / Keluar</div>
                    <div className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">
                      {scenarioComparison.summary.enteredTopK} / {scenarioComparison.summary.leftTopK}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800/35">
                    <div className="text-xs uppercase text-slate-500 dark:text-slate-400">Pergeseran terbesar</div>
                    <div className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">{scenarioComparison.summary.biggestMove} posisi</div>
                  </div>
                </div>

                <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800/35">
                  <table className="w-full text-left text-[13px]">
                    <thead className="bg-teal-600 text-xs uppercase text-white shadow-sm dark:bg-teal-700 dark:text-white">
                      <tr>
                        <th className="px-3 py-2">Aset</th>
                        <th className="px-3 py-2 text-right">{scenarioComparison.scenarios[0].label}</th>
                        <th className="px-3 py-2 text-right">{scenarioComparison.scenarios[1].label}</th>
                        <th className="px-3 py-2 text-right">Perubahan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800/35">
                      {scenarioComparison.movements.map((movement) => (
                        <tr key={`${movement.detailCode}-${movement.rankA}-${movement.rankB}`}>
                          <td className="px-3 py-2 text-slate-800 dark:text-slate-200">
                            {movement.detailName}
                            <span className="ml-1 text-xs text-slate-500 dark:text-slate-400">({movement.detailCode})</span>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300">
                            #{movement.rankA}{!movement.inTopKA && <span className="ml-1 text-xs text-slate-400">di luar top-{scenarioComparison.topK}</span>}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300">
                            #{movement.rankB}{!movement.inTopKB && <span className="ml-1 text-xs text-slate-400">di luar top-{scenarioComparison.topK}</span>}
                          </td>
                          <td className={cn(
                            "px-3 py-2 text-right tabular-nums font-semibold",
                            movement.delta > 0 && "text-emerald-700 dark:text-emerald-300",
                            movement.delta < 0 && "text-red-700 dark:text-red-300",
                            movement.delta === 0 && "text-slate-500 dark:text-slate-400"
                          )}>
                            {movement.delta > 0 ? `naik ${movement.delta}` : movement.delta < 0 ? `turun ${Math.abs(movement.delta)}` : "tetap"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">{scenarioComparison.interpretation}</p>
              </>
            ) : !comparisonError && (
              <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-500 dark:border-slate-800/35 dark:bg-slate-900/40 dark:text-slate-400">
                Tidak ada alternatif yang bisa dibandingkan.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

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
              {historyDetailEntry?.pairwiseMatrix && (
                <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/30 dark:bg-sky-400/10 dark:text-sky-300">
                  Dihitung dengan AHP
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              {historyDetailEntry ? [
                historyDetailEntry.label,
                formatDayTimeLabel(historyDetailEntry.createdAt, { showWeekday: false }),
                assetTypeLabel(historyDetailEntry.assetType as DssAssetType),
                `${historyDetailEntry.totalAlternatives} alternatif`,
              ].filter(Boolean).join(" · ") : ""}
            </DialogDescription>
          </DialogHeader>
          {historyDetailEntry && (
            <div className="min-h-0 space-y-4 overflow-y-auto px-6 py-4">
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Bobot Kriteria</span>
                  <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                    Metode: {weightMethodLabel(historyDetailEntry)}
                  </Badge>
                  {summarizeWeights(historyDetailEntry.criteria)?.uniform && (
                    <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300">
                      Bobot merata
                    </Badge>
                  )}
                </div>
                {summarizeWeights(historyDetailEntry.criteria)?.uniform && (
                  <p className="mb-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    Seluruh kriteria berbobot sama, sehingga pembobotan tidak memengaruhi urutan — prioritas
                    sepenuhnya ditentukan nilai kriteria tiap aset. Cocok sebagai baseline pembanding.
                  </p>
                )}
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
