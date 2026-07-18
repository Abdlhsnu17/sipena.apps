import type { DetailSource } from "@/types/detail-inventory"

export interface ScannedAssetTarget {
  detailId: string
  assetId: number | null
  type: DetailSource | null
}

export const buildScanTargetParams = (target: ScannedAssetTarget): URLSearchParams => {
  const params = new URLSearchParams()
  params.set("detailId", target.detailId)
  if (target.assetId !== null) params.set("assetId", String(target.assetId))
  if (target.type) params.set("type", target.type)
  return params
}

export const parseScanTargetFromSearchParams = (
  params: URLSearchParams | { get(name: string): string | null },
): ScannedAssetTarget | null => {
  const detailId = params.get("detailId")?.trim()
  if (!detailId) return null

  const assetIdRaw = params.get("assetId")
  const assetId = assetIdRaw ? Number(assetIdRaw) : null
  const typeRaw = params.get("type")
  const type: DetailSource | null = typeRaw === "medis" || typeRaw === "non_medis" ? typeRaw : null

  return {
    detailId,
    assetId: Number.isFinite(assetId) ? assetId : null,
    type,
  }
}

export const findAssetByScanTarget = <T extends { detailId: string; assetId: number; source?: string }>(
  assets: T[],
  target: ScannedAssetTarget | null,
  fallbackQuery?: string,
  fallbackMatcher?: (assets: T[], query: string) => T | undefined,
): T | undefined => {
  if (target) {
    const byDetailId = assets.find((asset) => asset.detailId === target.detailId)
    if (byDetailId) return byDetailId

    if (target.assetId !== null) {
      const byAssetIdAndType = assets.find(
        (asset) => asset.assetId === target.assetId && (!target.type || asset.source === target.type),
      )
      if (byAssetIdAndType) return byAssetIdAndType
    }
  }

  if (fallbackQuery && fallbackMatcher) {
    return fallbackMatcher(assets, fallbackQuery)
  }

  return undefined
}
