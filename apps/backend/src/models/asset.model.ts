// NonMedicalAsset sesuai tabel non_medical_assets
export interface NonMedicalAsset {
  id: number;
  assetCode: string;
  name: string;
  category: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  purchaseDate?: Date;
  warrantyExpiry?: Date;
  location?: string;
  status: string;
  condition: string;
  usagePurpose?: string;
  createdBy?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateNonMedicalAssetDTO {
  assetCode: string;
  name: string;
  category: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  purchaseDate?: Date;
  warrantyExpiry?: Date;
  location?: string;
  status?: string;
  condition?: string;
  usagePurpose?: string;
  createdBy?: number;
}

export interface UpdateNonMedicalAssetDTO {
  name?: string;
  category?: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  purchaseDate?: Date;
  warrantyExpiry?: Date;
  location?: string;
  status?: string;
  condition?: string;
  usagePurpose?: string;
}
export interface Asset {
  id: number;
  assetCode: string;
  name: string;
  description?: string;
  category: string;
  type: AssetType;
  status: AssetStatus;
  condition: AssetCondition;
  location?: string;
  purchaseDate?: Date;
  purchasePrice?: number;
  warrantyExpiry?: Date;
  specifications?: Record<string, any>;
  imageUrl?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type AssetType = 'medical' | 'non_medical';

export type AssetStatus = 'available' | 'borrowed' | 'maintenance' | 'disposed';

export type AssetCondition = 'good' | 'fair' | 'poor' | 'damaged';

export interface CreateAssetDTO {
  assetCode: string;
  name: string;
  description?: string;
  category: string;
  type: AssetType;
  status?: AssetStatus;
  condition?: AssetCondition;
  location?: string;
  purchaseDate?: Date;
  purchasePrice?: number;
  warrantyExpiry?: Date;
  specifications?: Record<string, any>;
  imageUrl?: string;
}

export interface UpdateAssetDTO {
  name?: string;
  description?: string;
  category?: string;
  type?: AssetType;
  status?: AssetStatus;
  condition?: AssetCondition;
  location?: string;
  purchaseDate?: Date;
  purchasePrice?: number;
  warrantyExpiry?: Date;
  specifications?: Record<string, any>;
  imageUrl?: string;
}

export interface AssetFilters {
  page: number;
  limit: number;
  search?: string;
  category?: string;
  status?: string;
  type?: string;
}

export interface ResetInventorySummary {
  returnRecords: number;
  maintenanceHistory: number;
  assetUsageLogs: number;
  maintenanceRecords: number;
  borrowingRecords: number;
  medicalAssets: number;
  nonMedicalAssets: number;
  totalDeleted: number;
}
