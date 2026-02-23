import type { DetailInventoryItem } from '@/types/detail-inventory'

export const buildInventorySearchKey = (asset: DetailInventoryItem): string => {
  const values = [
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
