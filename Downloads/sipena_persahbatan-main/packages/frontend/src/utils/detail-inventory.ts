import type { Asset } from "@/services/asset.service"
import type { DetailAvailability, DetailCondition, DetailInventoryItem } from "@/types/detail-inventory"
import type { MedicalAsset } from "@/types/medical-assets-types"
import type { NonMedicalAsset } from "@/types/non-medical-assets-types"
import { getSpecificationDetails } from "./api-mappers"

const normalizeAvailability = (status?: string): DetailAvailability => {
  const normalized = (status || "").toLowerCase()
  if (normalized.includes("perbaikan") || normalized.includes("maintenance")) return "maintenance"
  if (normalized.includes("dipinjam") || normalized.includes("borrowed")) return "borrowed"
  if (normalized.includes("non-aktif") || normalized.includes("non aktif") || normalized.includes("disposed")) {
    return "disposed"
  }
  return "available"
}

const normalizeCondition = (condition?: string): DetailCondition => {
  const normalized = (condition || "").toLowerCase()
  if (normalized.includes("cukup") || normalized.includes("fair")) return "fair"
  if (normalized.includes("poor")) return "poor"
  if (normalized.includes("rusak") || normalized.includes("damaged")) return "damaged"
  return "good"
}

const joinBrandParts = (parts: Array<string | undefined | null>) =>
  parts
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .join(" ")

const deriveBrandModelLabel = (detail: Record<string, any> | undefined, asset: Asset) => {
  const detailCandidate = joinBrandParts([detail?.brand, detail?.model, detail?.brandModel])
  if (detailCandidate) return detailCandidate
  if (detail?.name && typeof detail.name === "string" && detail.name.trim()) {
    return detail.name.trim()
  }
  const assetCandidate = joinBrandParts([asset.brand, asset.model])
  return assetCandidate || undefined
}

type FlattenOptions = {
  includeAssetFallback?: boolean
}

/**
 * Flatten spesifikasi detail dari aset medis & non-medis menjadi daftar item siap pakai
 * untuk pemeliharaan/peminjaman/pengembalian.
 */
export const flattenDetailInventories = (assets: Asset[], options: FlattenOptions = {}): DetailInventoryItem[] => {
  const { includeAssetFallback = false } = options
  return assets.flatMap((asset) => {
    const assetType = asset.type === "non_medical" ? "non_medical" : "medical"
    const details = getSpecificationDetails<MedicalAsset | NonMedicalAsset>(asset.specifications)

    const mappedDetails = details.map((detail, index) => {
      const detailRecord = detail as Record<string, any>
      const detailBrandModel = deriveBrandModelLabel(detailRecord, asset)
      const computedDetailId =
        detailRecord.id ??
        detailRecord.assetCode ??
        detailRecord.serialNumber ??
        `${asset.id}-detail-${String(index)}`
      const roomName =
        detailRecord.roomName ||
        detailRecord.room_name ||
        detailRecord.ruangan ||
        detailRecord.lokasi ||
        detailRecord.location ||
        detailRecord.room?.name ||
        detailRecord.room?.roomName ||
        asset.roomName ||
        asset.location ||
        undefined
      return {
        assetId: asset.id,
        assetType,
        assetName: asset.name,
        assetCode: asset.assetCode,
        assetCategory: asset.category,
        assetStatus: normalizeAvailability(asset.status),
        assetLocation: asset.location,
        roomName,
        detailId: String(computedDetailId),
        detailInventoryName: detailRecord.inventoryName || undefined,
        detailBrandModel,
        detailName: detailRecord.inventoryName || detailRecord.name || asset.name,
        detailCode: detailRecord.assetCode || asset.assetCode,
        detailType: detailRecord.type,
        statusLabel: detailRecord.status,
        availability: normalizeAvailability(detailRecord.status),
        conditionLabel: detailRecord.condition,
        condition: normalizeCondition(detailRecord.condition),
        usagePurpose: detailRecord.usagePurpose,
        lastMaintenance: detailRecord.lastMaintenance,
        nextMaintenance: detailRecord.nextMaintenance,
        serialNumber: detailRecord.serialNumber,
        notes: detailRecord.notes,
        source: assetType === "non_medical" ? "non_medis" : "medis",
      }
    })

    if (mappedDetails.length === 0 && includeAssetFallback) {
      return [
        {
          assetId: asset.id,
          assetType,
          assetName: asset.name,
          assetCode: asset.assetCode,
          assetCategory: asset.category,
          assetStatus: normalizeAvailability(asset.status),
          assetLocation: asset.location,
          roomName: asset.roomName || asset.location,
          detailId: `asset-${asset.type}-${asset.id}`,
          detailName: asset.name,
          detailInventoryName: asset.name,
          detailBrandModel: deriveBrandModelLabel(undefined, asset),
          detailCode: asset.assetCode,
          statusLabel: asset.status,
          availability: normalizeAvailability(asset.status),
          conditionLabel: asset.condition,
          condition: normalizeCondition(asset.condition),
          source: assetType === "non_medical" ? "non_medis" : "medis",
        },
      ]
    }

    return mappedDetails
  })
}
