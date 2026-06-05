"use client"

import { buildLoginRedirectUrl, getCurrentUser } from "@/services/auth-utils";
import { assetService } from "@/services/asset.service";
import dssService, { type DssAssetRanking, type DssAssetType, type DssRankingResult } from "@/services/dss.service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/utils";
import { flattenDetailInventories } from "@/utils/detail-inventory";
import { Activity, ArrowDownUp, Calculator, RefreshCw, Search, SlidersHorizontal } from "lucide-react";
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
  { id: "condition", name: "Kondisi Aset", type: "cost", weight: 0 },
  { id: "age", name: "Usia Aset", type: "cost", weight: 0 },
  { id: "maintenanceDue", name: "Kedekatan Jadwal Maintenance", type: "cost", weight: 0 },
  { id: "usageFrequency", name: "Frekuensi Pemakaian", type: "benefit", weight: 0 },
  { id: "maintenanceHistory", name: "Riwayat Maintenance", type: "cost", weight: 0 },
  { id: "functionalUrgency", name: "Urgensi Fungsi", type: "benefit", weight: 0 },
  { id: "statusRisk", name: "Risiko Status", type: "cost", weight: 0 },
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

const recommendationClassName = (recommendation: string) => {
  const normalized = recommendation.toLowerCase()
  if (normalized.includes("tinggi")) return "border-red-200 bg-red-50 text-red-700"
  if (normalized.includes("sedang")) return "border-amber-200 bg-amber-50 text-amber-700"
  return "border-emerald-200 bg-emerald-50 text-emerald-700"
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

const buildClientFallbackRanking = async (
  assetType: DssAssetType,
  normalizedWeights: Record<string, number>
): Promise<DssRankingResult> => {
  const [medicalResponse, nonMedicalResponse] = await Promise.all([
    assetType === "non_medical" ? Promise.resolve(null) : assetService.getMedicalAssets({ page: 1, limit: 1000 }),
    assetType === "medical" ? Promise.resolve(null) : assetService.getNonMedicalAssets({ page: 1, limit: 1000 }),
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
    const criteriaScores: Record<string, number> = {
      condition: conditionScore(item.conditionLabel || item.condition),
      age: ageScore((item as typeof item & { purchaseDate?: string }).purchaseDate),
      maintenanceDue: maintenanceDueScore(item.nextMaintenance),
      usageFrequency: 0,
      maintenanceHistory: item.lastMaintenance ? 1 : 0,
      functionalUrgency: functionalUrgencyScore(item.detailName, item.detailType, item.assetCategory),
      statusRisk: statusRiskScore(item.statusLabel || item.availability),
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
      detailType: item.detailType,
      conditionLabel: item.conditionLabel || item.condition,
      statusLabel: item.statusLabel || item.availability,
      purchaseDate: undefined,
      lastMaintenance: item.lastMaintenance,
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
    const weightedScores: Record<string, number> = Object.fromEntries(criteria.map((criterion) => {
      const normalized = (alternative.criteriaScores[criterion.id] || 0) / denominators[criterion.id]
      return [criterion.id, normalized * criterion.weight]
    }))
    return { ...alternative, weightedScores }
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
        preferenceScore,
        recommendation: preferenceScore >= 0.7 ? "Prioritas tinggi" : preferenceScore >= 0.45 ? "Prioritas sedang" : "Prioritas rendah",
      }
    })
    .sort((left, right) => right.preferenceScore - left.preferenceScore)
    .slice(0, 250)
    .map((item, index) => ({ ...item, rank: index + 1 }))

  return {
    criteria,
    consistency: null,
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

  useEffect(() => {
    const user = getCurrentUser()
    if (!user) {
      router.replace(buildLoginRedirectUrl())
    }
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
      try {
        const fallbackResult = await buildClientFallbackRanking(assetType, normalizedWeights)
        setRankingResult(fallbackResult)
        setRankingSource("fallback")
        setErrorMessage("Perhitungan memakai mode fallback dari data aset karena endpoint SPK backend belum merespons.")
      } catch (fallbackError) {
        console.error("Error loading DSS fallback ranking:", fallbackError)
        setErrorMessage(error instanceof Error ? error.message : "Gagal memuat ranking SPK")
      }
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
      item.assetName,
      item.assetCode,
      item.assetLocation,
      item.assetCategory,
      item.recommendation,
    ].some((value) => String(value || "").toLowerCase().includes(query)))
  }, [rankingResult?.rankings, searchTerm])

  const topRankings = rankingResult?.rankings.slice(0, 3) || []

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold text-teal-700">
              <Calculator className="h-4 w-4" />
              AHP-TOPSIS
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal text-slate-950 sm:text-3xl">
              SPK Prioritas Aset
            </h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              Ranking menggunakan data inventaris yang sudah tersimpan. AHP menghitung bobot kriteria dari matriks perbandingan, lalu TOPSIS menghitung prioritas aset detail.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select value={assetType} onValueChange={(value) => setAssetType(value as DssAssetType)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Jenis aset" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua aset</SelectItem>
                <SelectItem value="medical">Medis</SelectItem>
                <SelectItem value="non_medical">Non-Medis</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => void loadRanking()} disabled={isLoading} className="gap-2">
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
              Hitung Ulang
            </Button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <SlidersHorizontal className="h-4 w-4 text-teal-700" />
                Bobot Kriteria
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {rankingResult?.criteria.map((criterion) => {
                const rawValue = weights[criterion.id] ?? 0
                return (
                  <div key={criterion.id} className="space-y-2 rounded-md border border-slate-200 bg-white p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Label htmlFor={`weight-${criterion.id}`} className="text-sm font-semibold text-slate-900">
                          {criterion.name}
                        </Label>
                        <p className="mt-0.5 text-xs leading-5 text-slate-500">{criteriaHelp[criterion.id]}</p>
                      </div>
                      <Badge variant="outline" className="shrink-0">
                        {criterion.type === "benefit" ? "Benefit" : "Cost"}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-[1fr_72px] items-center gap-3">
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
                      <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-right text-sm font-semibold text-slate-800">
                        {formatPercent(criterion.weight)}
                      </div>
                    </div>
                  </div>
                )
              }) ?? (
                <div className="space-y-3">
                  {Object.keys(DEFAULT_WEIGHTS).map((criterionId) => (
                    <div key={criterionId} className="h-20 animate-pulse rounded-md bg-slate-100" />
                  ))}
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setWeights(DEFAULT_WEIGHTS)}
              >
                Reset Bobot Default
              </Button>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <Card className="border-slate-200 shadow-sm">
                <CardContent className="p-4">
                  <div className="text-xs font-medium uppercase text-slate-500">Alternatif</div>
                  <div className="mt-1 text-2xl font-semibold text-slate-950">
                    {rankingResult?.totalAlternatives ?? 0}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">Item inventaris detail</div>
                </CardContent>
              </Card>
              <Card className="border-slate-200 shadow-sm">
                <CardContent className="p-4">
                  <div className="text-xs font-medium uppercase text-slate-500">Sumber Data</div>
                  <div className="mt-1 text-2xl font-semibold text-slate-950">{assetTypeLabel(assetType)}</div>
                  <div className="mt-1 text-xs text-slate-500">Medis dan non-medis</div>
                </CardContent>
              </Card>
              <Card className="border-slate-200 shadow-sm">
                <CardContent className="p-4">
                  <div className="text-xs font-medium uppercase text-slate-500">Ranking Tertinggi</div>
                  <div className="mt-1 truncate text-lg font-semibold text-slate-950">
                    {topRankings[0]?.detailName ?? "-"}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {topRankings[0] ? formatScore(topRankings[0].preferenceScore) : "Belum dihitung"}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-slate-200 shadow-sm">
              <CardContent className="grid gap-3 p-4 md:grid-cols-3">
                <div>
                  <div className="text-xs font-medium uppercase text-slate-500">Metode AHP</div>
                  <div className="mt-1 text-sm font-semibold text-slate-950">Matriks perbandingan kriteria</div>
                  <div className="mt-1 text-xs leading-5 text-slate-500">Slider membentuk matriks AHP, backend menghitung bobot dan rasio konsistensi.</div>
                </div>
                <div>
                  <div className="text-xs font-medium uppercase text-slate-500">Konsistensi AHP</div>
                  <div className="mt-1 text-sm font-semibold text-slate-950">
                    {rankingResult?.consistency ? (
                      rankingResult.consistency.isConsistent ? "Konsisten" : "Tidak konsisten"
                    ) : (
                      rankingSource === "fallback" ? "Tidak tersedia di fallback" : "Belum dihitung"
                    )}
                  </div>
                  <div className="mt-1 text-xs leading-5 text-slate-500">
                    CR {rankingResult?.consistency ? rankingResult.consistency.consistencyRatio.toFixed(4) : "-"} · batas maksimal 0.1000
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium uppercase text-slate-500">Metode TOPSIS</div>
                  <div className="mt-1 text-sm font-semibold text-slate-950">Ranking aset detail</div>
                  <div className="mt-1 text-xs leading-5 text-slate-500">
                    Sumber hasil: {rankingSource === "backend" ? "backend SPK" : rankingSource === "fallback" ? "fallback frontend" : "-"}
                  </div>
                </div>
              </CardContent>
            </Card>

            {topRankings.length > 0 && (
              <div className="grid gap-3 lg:grid-cols-3">
                {topRankings.map((item) => (
                  <Card key={`${item.assetType}-${item.assetId}-${item.detailId}`} className="border-slate-200 shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <Badge className="bg-slate-950 text-white">#{item.rank}</Badge>
                        <Badge variant="outline" className={recommendationClassName(item.recommendation)}>
                          {item.recommendation}
                        </Badge>
                      </div>
                      <div className="mt-3 min-w-0">
                        <div className="truncate text-base font-semibold text-slate-950">{item.detailName}</div>
                        <div className="mt-1 text-sm text-slate-600">{item.detailCode}</div>
                        <div className="mt-2 text-xs leading-5 text-slate-500">{item.assetLocation || item.assetName}</div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="gap-3 pb-3 lg:flex-row lg:items-center lg:justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ArrowDownUp className="h-4 w-4 text-teal-700" />
                  Ranking Prioritas
                </CardTitle>
                <div className="relative w-full lg:w-80">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Cari aset, kode, ruangan"
                    className="pl-9"
                  />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {errorMessage && (
                  <div className="m-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {errorMessage}
                  </div>
                )}
                {isLoading ? (
                  <div className="space-y-2 p-4">
                    {Array.from({ length: 8 }).map((_, index) => (
                      <div key={index} className="h-14 animate-pulse rounded-md bg-slate-100" />
                    ))}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[980px] text-left text-sm">
                      <thead className="border-y border-slate-200 bg-slate-100 text-xs uppercase text-slate-600">
                        <tr>
                          <th className="px-4 py-3">Rank</th>
                          <th className="px-4 py-3">Aset Detail</th>
                          <th className="px-4 py-3">Lokasi</th>
                          <th className="px-4 py-3">Jenis</th>
                          <th className="px-4 py-3">Kondisi</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Skor</th>
                          <th className="px-4 py-3">Rekomendasi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {filteredRankings.map((item) => (
                          <tr key={`${item.assetType}-${item.assetId}-${item.detailId}-${item.rank}`} className="hover:bg-slate-50">
                            <td className="px-4 py-3 align-top font-semibold text-slate-950">#{item.rank}</td>
                            <td className="px-4 py-3 align-top">
                              <div className="font-semibold text-slate-950">{item.detailName}</div>
                              <div className="mt-1 text-xs text-slate-500">{item.detailCode} · {item.assetName}</div>
                            </td>
                            <td className="px-4 py-3 align-top text-slate-700">{item.assetLocation || "-"}</td>
                            <td className="px-4 py-3 align-top">
                              <Badge variant="outline">{assetTypeLabel(item.assetType)}</Badge>
                            </td>
                            <td className="px-4 py-3 align-top text-slate-700">{item.conditionLabel}</td>
                            <td className="px-4 py-3 align-top text-slate-700">{item.statusLabel}</td>
                            <td className="px-4 py-3 align-top font-semibold text-slate-950">{formatScore(item.preferenceScore)}</td>
                            <td className="px-4 py-3 align-top">
                              <Badge variant="outline" className={recommendationClassName(item.recommendation)}>
                                {item.recommendation}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                        {filteredRankings.length === 0 && (
                          <tr>
                            <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500">
                              Tidak ada data ranking yang sesuai.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Activity className="h-4 w-4" />
              Hasil dihitung dari kondisi, usia, jadwal maintenance, pemakaian, riwayat maintenance, urgensi fungsi, dan risiko status aset.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
