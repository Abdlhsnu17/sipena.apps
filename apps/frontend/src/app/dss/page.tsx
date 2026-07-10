"use client"

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { assetUsageService } from "@/services/asset-usage.service";
import { assetService } from "@/services/asset.service";
import { buildLoginRedirectUrl, getCurrentUser } from "@/services/auth-utils";
import dssService, { type DssAssetRanking, type DssAssetType, type DssRankingResult } from "@/services/dss.service";
import { maintenanceService } from "@/services/maintenance.service";
import { cn } from "@/utils";
import { locationBadgeClass } from "@/utils/api-mappers";
import { flattenDetailInventories } from "@/utils/detail-inventory";
import { canCreateMaintenanceRole } from "@/utils/role";
import {
    Activity,
    AlertTriangle,
    ArrowDownUp,
    Award,
    Building2,
    Calculator,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Clock,
    Flame,
    Gauge,
    HandHelping,
    MapPin,
    Medal,
    PauseCircle,
    RefreshCw,
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
  condition: 22,
  age: 12,
  maintenanceDue: 16,
  usageFrequency: 14,
  maintenanceHistory: 14,
  functionalUrgency: 16,
  statusRisk: 6,
}

const DEFAULT_CRITERIA: DssRankingResult["criteria"] = [
  { id: "condition", name: "Kondisi Aset", type: "benefit", weight: 0 },
  { id: "age", name: "Usia Aset", type: "benefit", weight: 0 },
  { id: "maintenanceDue", name: "Kedekatan Jadwal Maintenance", type: "benefit", weight: 0 },
  { id: "usageFrequency", name: "Frekuensi Pemakaian", type: "benefit", weight: 0 },
  { id: "maintenanceHistory", name: "Riwayat Maintenance", type: "benefit", weight: 0 },
  { id: "functionalUrgency", name: "Urgensi Fungsi", type: "benefit", weight: 0 },
  { id: "statusRisk", name: "Risiko Status", type: "benefit", weight: 0 },
]

const criteriaHelp: Record<string, string> = {
  condition: "Semakin buruk kondisi, semakin tinggi prioritas.",
  age: "Semakin tua usia aset, semakin tinggi prioritas.",
  maintenanceDue: "Semakin dekat atau lewat jadwal maintenance, semakin tinggi prioritas.",
  usageFrequency: "Semakin sering digunakan, semakin tinggi prioritas.",
  maintenanceHistory: "Semakin sering masuk maintenance, semakin tinggi prioritas.",
  functionalUrgency: "Semakin kritis fungsi aset, semakin tinggi prioritas.",
  statusRisk: "Status bermasalah meningkatkan prioritas.",
}

const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`

const formatScore = (value: number) => value.toFixed(4)

const RANKINGS_PER_PAGE = 10

const buildAhpPairwiseMatrix = (normalizedWeights: Record<string, number>) => {
  const criteriaIds = DEFAULT_CRITERIA.map((criterion) => criterion.id)
  return criteriaIds.map((rowId) => criteriaIds.map((columnId) => {
    const rowWeight = normalizedWeights[rowId] || 1
    const columnWeight = normalizedWeights[columnId] || 1
    return rowWeight / columnWeight
  }))
}

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

const dayMs = 24 * 60 * 60 * 1000

const parseDate = (value?: string | null) => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const daysBetween = (from: Date, to: Date) => Math.round((to.getTime() - from.getTime()) / dayMs)

const conditionScore = (value?: string | null) => {
  const normalized = String(value || "").toLowerCase()
  if (normalized.includes("rusak") || normalized.includes("damaged")) return 5
  if (normalized.includes("poor") || normalized.includes("buruk") || normalized.includes("kurang")) return 4
  if (normalized.includes("cukup") || normalized.includes("fair")) return 3
  return 1
}

const statusRiskScore = (value?: string | null) => {
  const normalized = String(value || "").toLowerCase()
  if (normalized.includes("disposed") || normalized.includes("non")) return 5
  if (normalized.includes("maintenance") || normalized.includes("perbaikan")) return 4
  if (normalized.includes("borrowed") || normalized.includes("dipinjam")) return 3
  if (normalized.includes("digunakan") || normalized.includes("in_use") || normalized.includes("in use")) return 2
  return 1
}

const functionalUrgencyScore = (name?: string | null, type?: string | null, category?: string | null) => {
  const text = `${name || ""} ${type || ""} ${category || ""}`.toLowerCase()
  if (/(ventilator|defibrillator|aed|crash|resuscitation|monitor|infusion|syringe|oxygen|suction|ctg|incubator|icu|emergency)/.test(text)) return 5
  if (/(ecg|ekg|pump|bed|stretcher|doppler|radiology|diagnostic|respiratory|fire|apar|ups|power|security|smoke)/.test(text)) return 4
  if (/(thermometer|stethoscope|cctv|network|access|hvac|ahu|hepa|sanitation)/.test(text)) return 3
  if (/(storage|rack|whiteboard|display|office)/.test(text)) return 1
  return 2
}

const maintenanceDueScore = (nextMaintenance?: string | null) => {
  const nextDate = parseDate(nextMaintenance)
  if (!nextDate) return 1
  const days = daysBetween(new Date(), nextDate)
  if (days < 0) return 5
  if (days <= 30) return 4
  if (days <= 90) return 3
  if (days <= 180) return 2
  return 1
}

const ageScore = (purchaseDate?: string | null) => {
  const purchasedAt = parseDate(purchaseDate)
  if (!purchasedAt) return 1
  return Math.max(1, Math.round(Math.max(0, daysBetween(purchasedAt, new Date())) / 365))
}

const RANDOM_INDEX: Record<number, number> = {
  1: 0,
  2: 0,
  3: 0.58,
  4: 0.9,
  5: 1.12,
  6: 1.24,
  7: 1.32,
  8: 1.41,
  9: 1.45,
  10: 1.49,
}

const computeAhpConsistency = (matrix: number[][]): DssRankingResult["consistency"] => {
  const n = matrix.length
  if (!n || matrix.some((row) => row.length !== n)) return null

  const numericMatrix = matrix.map((row) => row.map((value) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
  }))

  let vector = Array.from({ length: n }, () => 1 / n)
  for (let iter = 0; iter < 1000; iter += 1) {
    const next = numericMatrix.map((row) => row.reduce((sum, value, j) => sum + value * vector[j], 0))
    const total = next.reduce((acc, value) => acc + value, 0) || 1
    const normalized = next.map((value) => value / total)
    const diff = Math.max(...normalized.map((value, i) => Math.abs(value - vector[i])))
    vector = normalized
    if (diff < 1e-12) break
  }

  const weightSum = vector.reduce((sum, value) => sum + value, 0) || 1
  const weights = vector.map((value) => value / weightSum)
  const weightedSums = numericMatrix.map((row) => row.reduce((sum, value, j) => sum + value * weights[j], 0))
  const lambdaMax = weightedSums.reduce((sum, value, i) => sum + value / (weights[i] || 1), 0) / n
  const consistencyIndex = n > 1 ? (lambdaMax - n) / (n - 1) : 0
  const randomIndex = RANDOM_INDEX[n] || 1.49
  const consistencyRatio = randomIndex === 0 ? 0 : consistencyIndex / randomIndex

  return {
    lambdaMax,
    consistencyIndex,
    consistencyRatio,
    isConsistent: Number.isFinite(consistencyRatio) ? consistencyRatio <= 0.1 : false,
  }
}

const buildDetailCountKey = (
  assetType: string,
  assetId: number | string,
  detailId?: string | null,
  detailCode?: string | null
) => {
  const type = assetType === "non_medical" ? "non_medical" : "medical"
  const id = String(detailId || "").trim()
  const code = String(detailCode || "").trim()
  return `${type}|${assetId}|${id || code || "asset"}`
}

type DetailCountEntry = {
  assetId?: number | null
  assetType?: string | null
  assetDetailId?: string | null
  assetDetailCode?: string | null
}

const aggregateDetailCounts = (entries: DetailCountEntry[]) => {
  const counts = new Map<string, number>()
  entries.forEach((entry) => {
    if (entry.assetId == null) return
    const key = buildDetailCountKey(String(entry.assetType || ""), entry.assetId, entry.assetDetailId, entry.assetDetailCode)
    counts.set(key, (counts.get(key) || 0) + 1)
  })
  return counts
}

const lookupDetailCount = (
  counts: Map<string, number>,
  assetType: string,
  assetId: number,
  detailId?: string | null,
  detailCode?: string | null
) => counts.get(buildDetailCountKey(assetType, assetId, detailId, detailCode)) || 0

const loadFallbackUsageCounts = async (assetType: DssAssetType): Promise<Map<string, number> | null> => {
  try {
    const response = await assetUsageService.getAll({
      limit: 1000,
      ...(assetType !== "all" ? { assetType } : {}),
    })
    if (!response.success) return null
    return aggregateDetailCounts(response.data.map((log) => ({
      assetId: log.assetId,
      assetType: log.assetType,
      assetDetailId: log.assetDetailId,
      assetDetailCode: log.assetDetailCode,
    })))
  } catch {
    return null
  }
}

const loadFallbackMaintenanceCounts = async (assetType: DssAssetType): Promise<Map<string, number> | null> => {
  try {
    const response = await maintenanceService.getAll({
      limit: 1000,
      ...(assetType !== "all" ? { assetType } : {}),
    })
    if (!response.success) return null
    return aggregateDetailCounts(response.data
      .filter((record) => record.status !== "cancelled")
      .map((record) => ({
        assetId: record.assetId,
        assetType: record.assetType,
        assetDetailId: record.assetDetailId,
        assetDetailCode: record.assetDetailCode,
      })))
  } catch {
    return null
  }
}

const _buildClientFallbackRanking = async (
  assetType: DssAssetType,
  normalizedWeights: Record<string, number>
): Promise<DssRankingResult> => {
  const [medicalResponse, nonMedicalResponse, usageCounts, maintenanceCounts] = await Promise.all([
    assetType === "non_medical" ? Promise.resolve(null) : assetService.getMedicalAssets({ page: 1, limit: 1000 }),
    assetType === "medical" ? Promise.resolve(null) : assetService.getNonMedicalAssets({ page: 1, limit: 1000 }),
    loadFallbackUsageCounts(assetType),
    loadFallbackMaintenanceCounts(assetType),
  ])

  const assets = [
    ...(medicalResponse?.success ? medicalResponse.data : []),
    ...(nonMedicalResponse?.success ? nonMedicalResponse.data : []),
  ]
  const detailItems = flattenDetailInventories(assets, { includeAssetFallback: true })
  const criteria = DEFAULT_CRITERIA.map((criterion) => ({
    ...criterion,
    weight: normalizedWeights[criterion.id] || 0,
  }))

  const alternatives = detailItems.map((item) => {
    const statusLabel = inventoryStatusLabel(item.statusLabel || item.availability)
    const criteriaScores: Record<string, number> = {
      condition: conditionScore(item.conditionLabel || item.condition),
      age: ageScore((item as typeof item & { purchaseDate?: string }).purchaseDate),
      maintenanceDue: maintenanceDueScore(item.nextMaintenance),
      usageFrequency: usageCounts
        ? lookupDetailCount(usageCounts, item.assetType, item.assetId, item.detailId, item.detailCode)
        : 0,
      maintenanceHistory: maintenanceCounts
        ? lookupDetailCount(maintenanceCounts, item.assetType, item.assetId, item.detailId, item.detailCode)
        : (item.lastMaintenance || item.lastRepair ? 1 : 0),
      functionalUrgency: functionalUrgencyScore(item.detailName, item.detailType, item.assetCategory),
      statusRisk: statusRiskScore(statusLabel),
    }

    return {
      assetId: item.assetId,
      assetType: item.assetType,
      assetName: item.assetName,
      assetCode: item.assetCode,
      assetCategory: item.assetCategory,
      assetLocation: item.roomName || item.assetLocation,
      detailId: item.detailId,
      detailName: item.detailName,
      detailCode: item.detailCode,
      serialNumber: item.serialNumber,
      detailType: item.detailType,
      conditionLabel: item.conditionLabel || item.condition,
      statusLabel,
      purchaseDate: undefined,
      lastMaintenance: item.lastMaintenance,
      lastRepair: item.lastRepair,
      nextMaintenance: item.nextMaintenance,
      criteriaScores,
    }
  })

  const denominators = Object.fromEntries(criteria.map((criterion) => {
    const sumSquares = alternatives.reduce((sum, alternative) => {
      const value = alternative.criteriaScores[criterion.id] || 0
      return sum + value * value
    }, 0)
    return [criterion.id, Math.sqrt(sumSquares) || 1]
  }))

  const scored = alternatives.map((alternative) => {
    const normalizedScores: Record<string, number> = {}
    const weightedScores: Record<string, number> = {}
    criteria.forEach((criterion) => {
      const normalized = (alternative.criteriaScores[criterion.id] || 0) / denominators[criterion.id]
      normalizedScores[criterion.id] = normalized
      weightedScores[criterion.id] = normalized * criterion.weight
    })
    return { ...alternative, normalizedScores, weightedScores }
  })

  const positiveIdeal: Record<string, number> = {}
  const negativeIdeal: Record<string, number> = {}
  criteria.forEach((criterion) => {
    const values = scored.map((alternative) => alternative.weightedScores[criterion.id])
    positiveIdeal[criterion.id] = criterion.type === "benefit" ? Math.max(...values) : Math.min(...values)
    negativeIdeal[criterion.id] = criterion.type === "benefit" ? Math.min(...values) : Math.max(...values)
  })

  const rankings = scored
    .map((alternative) => {
      const positiveDistance = Math.sqrt(criteria.reduce((sum, criterion) => {
        const diff = alternative.weightedScores[criterion.id] - positiveIdeal[criterion.id]
        return sum + diff * diff
      }, 0))
      const negativeDistance = Math.sqrt(criteria.reduce((sum, criterion) => {
        const diff = alternative.weightedScores[criterion.id] - negativeIdeal[criterion.id]
        return sum + diff * diff
      }, 0))
      const preferenceScore = positiveDistance + negativeDistance === 0 ? 0 : negativeDistance / (positiveDistance + negativeDistance)
      return {
        ...alternative,
        positiveDistance,
        negativeDistance,
        preferenceScore,
        recommendation: preferenceScore >= 0.7 ? "Prioritas tinggi" : preferenceScore >= 0.45 ? "Prioritas sedang" : "Prioritas rendah",
      }
    })
    .sort((left, right) => right.preferenceScore - left.preferenceScore)
    .slice(0, 250)
    .map((item, index) => ({ ...item, rank: index + 1 }))

  return {
    criteria,
    consistency: computeAhpConsistency(buildAhpPairwiseMatrix(normalizedWeights)),
    idealSolutions: { positive: positiveIdeal, negative: negativeIdeal },
    generatedAt: new Date().toISOString(),
    totalAlternatives: alternatives.length,
    rankings,
  }
}

export default function DssPage() {
  const router = useRouter()
  const [rankingResult, setRankingResult] = useState<DssRankingResult | null>(null)
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS)
  const [assetType, setAssetType] = useState<DssAssetType>("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [rankingSource, setRankingSource] = useState<"backend" | "fallback" | null>(null)
  const [rankingPage, setRankingPage] = useState(1)
  const [auditItem, setAuditItem] = useState<DssAssetRanking | null>(null)
  const [canRequestMaintenance, setCanRequestMaintenance] = useState(false)

  useEffect(() => {
    const user = getCurrentUser()
    if (!user) {
      router.replace(buildLoginRedirectUrl())
      return
    }
    setCanRequestMaintenance(canCreateMaintenanceRole(user.role))
  }, [router])

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

  const normalizedWeights = useMemo(() => {
    const total = Object.values(weights).reduce((sum, value) => sum + Number(value || 0), 0)
    if (total <= 0) return DEFAULT_WEIGHTS
    return Object.fromEntries(Object.entries(weights).map(([key, value]) => [key, Number(value || 0) / total]))
  }, [weights])

  const loadRanking = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage(null)
    try {
      const response = await dssService.getRanking({
        assetType,
        limit: 250,
        weights: normalizedWeights,
        pairwiseMatrix: buildAhpPairwiseMatrix(normalizedWeights),
      })
      if (response.success) {
        setRankingResult(response.data)
        setRankingSource("backend")
      }
    } catch (error) {
      console.error("Error loading DSS ranking:", error)
      setRankingResult(null)
      setRankingSource(null)
      setErrorMessage(error instanceof Error ? error.message : "Endpoint SPK tidak dapat dihubungi. Periksa layanan backend lalu muat ulang.")
    } finally {
      setIsLoading(false)
    }
  }, [assetType, normalizedWeights])

  useEffect(() => {
    void loadRanking()
  }, [loadRanking])

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

              <div className="grid gap-3 border-t border-slate-100 dark:border-slate-800/35 pt-4 md:grid-cols-3">
                <div>
                  <div className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Metode AHP</div>
                  <div className="mt-1 text-sm font-semibold text-slate-950 dark:text-slate-50">Perbandingan kriteria</div>
                  <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">Bobot kriteria dihitung dari perbandingan slider.</div>
                </div>
                <div>
                  <div className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Konsistensi AHP</div>
                  <div className="mt-1 text-sm font-semibold text-slate-950 dark:text-slate-50">
                    {rankingResult?.consistency ? (
                      rankingResult.consistency.isConsistent ? "Konsisten" : "Tidak konsisten"
                    ) : (
                      rankingSource === "fallback" ? "Tidak tersedia di fallback" : "Belum dihitung"
                    )}
                  </div>
                  <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    CR {rankingResult?.consistency ? rankingResult.consistency.consistencyRatio.toFixed(4) : "-"} / Maksimal 0.1000
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
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setWeights(DEFAULT_WEIGHTS)}
            >
              Reset Bobot Default
            </Button>
          </CardHeader>
          <CardContent className="grid gap-3 pt-0 md:grid-cols-2 xl:grid-cols-3">
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
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-800/35 shadow-sm">
          <CardHeader className="gap-3 pb-3 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <ArrowDownUp className="h-4 w-4 text-teal-700" />
              Ranking Prioritas
            </CardTitle>
            <div className="relative w-full lg:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Cari aset, kode, nomor seri"
                className="pl-9"
              />
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
          </CardContent>
        </Card>

        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Activity className="h-4 w-4" />
          Hasil dihitung dari kondisi, usia, jadwal maintenance, pemakaian, riwayat maintenance, urgensi fungsi, dan risiko status aset.
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

      <div className="mt-8 flex w-full justify-center border-t border-border pt-6">
        <p className="text-center text-[13px] text-muted-foreground">
          Sistem Inventaris  Peminjaman serta Pemeliharaan  sarana (SiPeNa)
        </p>
      </div>
    </div>
  )
}
