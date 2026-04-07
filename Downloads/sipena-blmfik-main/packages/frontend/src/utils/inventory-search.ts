import type { DetailInventoryItem } from '@/types/detail-inventory'
import { formatNoId } from '@/utils/record-id'

export const buildInventorySearchKey = (asset: DetailInventoryItem): string => {
  const sourcePrefix = asset.source === "medis" ? "IMD" : "INM"
  const inventoryTypeKeywords =
    asset.assetType === "non_medical"
      ? ["non medis", "nonmedis", "non-medis", "non medical", "nonmedical"]
      : ["medis", "medical"]
  const values = [
    formatNoId(sourcePrefix, asset.assetId),
    formatNoId(`${sourcePrefix}-DTL`, asset.detailId),
    ...inventoryTypeKeywords,
    asset.assetType,
    asset.source,
    asset.assetId,
    asset.detailId,
    asset.detailInventoryName,
    asset.detailName,
    asset.detailBrandModel,
    asset.detailCode,
    asset.assetName,
    asset.assetCode,
    asset.assetLocation,
    asset.roomName,
    asset.usagePurpose,
    asset.assetCategory,
  ]
    .filter(Boolean)
    .map((value) => value?.toString().toLowerCase())
    .filter(Boolean)
  return values.join(' ')
}
