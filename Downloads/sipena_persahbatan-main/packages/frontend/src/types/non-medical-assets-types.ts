import type { NonMedicalAssetType } from "@/constants/non-medical-asset-types"

export interface NonMedicalRoom {
  id: string
  roomName: string
  assetName: string
  assetCode: string
  category: string
  assets: NonMedicalAsset[]
}

export interface NonMedicalAsset {
  id: string
  roomId: string
  assetCode: string
  inventoryName: string
  type: NonMedicalAssetType
  name: string
  serialNumber: string
  purchaseDate: string
  lastMaintenance: string
  nextMaintenance: string
  condition: "Baik" | "Cukup" | "Rusak"
  status: "Aktif" | "Non-Aktif" | "Dalam Perbaikan"
  notes: string
  usagePurpose: string
}

export type { NonMedicalAssetType }
