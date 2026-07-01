// Asset types
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
  purchaseDate?: string;
  purchasePrice?: number;
  warrantyExpiry?: string;
  specifications?: Record<string, any>;
  imageUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type AssetType = 'medical' | 'non_medical';

export type AssetStatus = 'available' | 'borrowed' | 'maintenance' | 'disposed';

export type AssetCondition = 'good' | 'fair' | 'poor' | 'damaged';

// Asset filters
export interface AssetFilters {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  status?: AssetStatus;
  type?: AssetType;
  condition?: AssetCondition;
}

// Asset form data
export interface AssetFormData {
  assetCode?: string;
  name: string;
  description?: string;
  category: string;
  type: AssetType;
  status?: AssetStatus;
  condition?: AssetCondition;
  location?: string;
  purchaseDate?: string;
  purchasePrice?: number;
  warrantyExpiry?: string;
  specifications?: Record<string, any>;
  imageUrl?: string;
}

// Asset response
export interface AssetResponse {
  success: boolean;
  message: string;
  data: Asset | Asset[];
  pagination?: PaginationInfo;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
