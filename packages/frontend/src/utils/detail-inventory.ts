import type { Asset } from "@/services/asset.service";
import type { DetailAvailability, DetailCondition, DetailInventoryItem } from "@/types/detail-inventory";
import type { MedicalAsset } from "@/types/medical-assets-types";
import type { NonMedicalAsset } from "@/types/non-medical-assets-types";
import { getSpecificationDetails } from "./api-mappers";

const normalizeAvailability = (status?: string): DetailAvailability => {
  const normalized = (status || "").toLowerCase()
  if (normalized.includes("perbaikan") || normalized.includes("maintenance")) return "maintenance"
  if (
    normalized.includes("sedang digunakan") ||
    normalized.includes("dalam penggunaan") ||
    normalized.includes("in use")
  ) {
    return "in_use"
  }
  if (normalized.includes("dipinjam") || normalized.includes("borrowed")) return "borrowed"
  if (
    normalized.includes("nonaktif") ||
    normalized.includes("non-aktif") ||
    normalized.includes("non aktif") ||
    normalized.includes("disposed")
  ) {
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

const isNumericId = (value: unknown) => /^\d+$/.test(String(value ?? "").trim())

const buildAssetLocationLookup = (assets: Asset[]) => {
  const lookup = new Map<string, string>()
  assets.forEach((asset) => {
    const assetType = asset.type === "non_medical" ? "non_medical" : "medical"
    const label = (asset.location || asset.name || "").trim()
    if (label) {
      lookup.set(`${assetType}|${asset.id}`, label)
    }
  })
  return lookup
}

const resolveDetailRoomName = (
  detailRecord: Record<string, any>,
  asset: Asset,
  assetRoomName: string | undefined,
  assetLocationLookup: Map<string, string>
) => {
  const assetType = asset.type === "non_medical" ? "non_medical" : "medical"
  const rawRoomName =
    detailRecord.roomId ??
    detailRecord.roomName ??
    detailRecord.room_name ??
    detailRecord.ruangan ??
    detailRecord.lokasi ??
    detailRecord.location ??
    detailRecord.room?.name ??
    detailRecord.room?.roomName

  if (isNumericId(rawRoomName)) {
    return assetLocationLookup.get(`${assetType}|${String(rawRoomName).trim()}`) || assetRoomName || asset.location || asset.name || undefined
  }

  return rawRoomName || assetRoomName || asset.location || undefined
}

/**
 * Flatten spesifikasi detail dari aset medis & non-medis menjadi daftar item siap pakai
 * untuk pemeliharaan/peminjaman/pengembalian.
 */
export const flattenDetailInventories = (assets: Asset[], options: FlattenOptions = {}): DetailInventoryItem[] => {
  const { includeAssetFallback = false } = options
  const assetLocationLookup = buildAssetLocationLookup(assets)

  return assets.flatMap((asset): DetailInventoryItem[] => {
    const assetType = asset.type === "non_medical" ? "non_medical" : "medical"
    const assetRoomName = (asset as Asset & { roomName?: string }).roomName
    const details = getSpecificationDetails<MedicalAsset | NonMedicalAsset>(asset.specifications)

    const mappedDetails: DetailInventoryItem[] = details.map((detail, index) => {
      const detailRecord = detail as Record<string, any>
      const detailBrandModel = deriveBrandModelLabel(detailRecord, asset)
      const computedDetailId =
        detailRecord.id ??
        detailRecord.assetCode ??
        detailRecord.serialNumber ??
        `${asset.id}-detail-${String(index)}`
      const roomName =
        resolveDetailRoomName(detailRecord, asset, assetRoomName, assetLocationLookup)
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
        lastRepair: detailRecord.lastRepair,
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
          roomName: assetRoomName || asset.location,
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

export const getDetailInventoryStatusLabel = (item: Pick<DetailInventoryItem, "statusLabel" | "availability" | "assetStatus">): string => {
  const rawStatus = item.statusLabel?.trim()
  const normalizedStatus = rawStatus ? normalizeAvailability(rawStatus) : (item.availability || item.assetStatus)
  switch (normalizedStatus) {
    case "maintenance":
      return "Dalam Perbaikan"
    case "disposed":
      return "Nonaktif"
    case "borrowed":
      return "Dipinjam"
    case "in_use":
      return "Sedang Digunakan"
    case "available":
    default:
      return "Tersedia"
  }
}
