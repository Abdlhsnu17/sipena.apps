export type DetailSource = "medis" | "non_medis"

export type DetailAvailability = "available" | "borrowed" | "maintenance" | "disposed"
export type DetailCondition = "good" | "fair" | "poor" | "damaged"

export interface DetailInventoryItem {
  assetId: number
  assetType: "medical" | "non_medical"
  assetName: string
  assetCode: string
  assetCategory: string
  assetStatus?: DetailAvailability
  assetLocation?: string
  roomName?: string
  detailId: string
  detailInventoryName?: string
  detailName: string
  detailCode: string
  detailType?: string
  statusLabel?: string
  availability: DetailAvailability
  conditionLabel?: string
  condition: DetailCondition
  detailBrandModel?: string
  usagePurpose?: string
  lastMaintenance?: string
  nextMaintenance?: string
  serialNumber?: string
  notes?: string
  source: DetailSource
}
