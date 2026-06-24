import apiService from './api.service';

export interface Asset {
  id: number;
  assetCode: string;
  name: string;
  description?: string;
  category: string;
  brand?: string;
  model?: string;
  type: 'medical' | 'non_medical';
  status: 'available' | 'borrowed' | 'maintenance' | 'disposed';
  condition: 'good' | 'fair' | 'poor' | 'damaged';
  location?: string;
  purchaseDate?: string;
  purchasePrice?: number;
  warrantyExpiry?: string;
  specifications?: Record<string, any>;
  imageUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AssetFilters {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  status?: string;
  type?: string;
}

export interface AssetResponse {
  success: boolean;
  message: string;
  data: Asset[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface SingleAssetResponse {
  success: boolean;
  message: string;
  data: Asset;
}

export interface ResetInventorySummary {
  returnRecords: number;
  maintenanceHistory: number;
  assetUsageLogs: number;
  maintenanceRecords: number;
  maintenanceSchedules: number;
  borrowingRecords: number;
  medicalAssets: number;
  nonMedicalAssets: number;
  totalDeleted: number;
}

const normalizeAsset = (asset: any): Asset => ({
  id: asset.id,
  assetCode: asset.assetCode ?? asset.asset_code,
  name: asset.name,
  description: asset.description,
  category: asset.category,
  brand: asset.brand ?? asset.brand_name ?? asset.brandName,
  model: asset.model ?? asset.model_name ?? asset.modelName,
  type: asset.type,
  status: asset.status,
  condition: asset.condition ?? asset.condition_status,
  location: asset.location,
  purchaseDate: asset.purchaseDate ?? asset.purchase_date,
  purchasePrice: asset.purchasePrice ?? asset.purchase_price,
  warrantyExpiry: asset.warrantyExpiry ?? asset.warranty_expiry,
  specifications: asset.specifications ?? asset.specifications,
  imageUrl: asset.imageUrl ?? asset.image_url,
  createdAt: asset.createdAt ?? asset.created_at,
  updatedAt: asset.updatedAt ?? asset.updated_at,
});

class AssetService {
  async getAll(filters: AssetFilters = {}): Promise<AssetResponse> {
    const params = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        params.append(key, String(value));
      }
    });

    const queryString = params.toString();
    const endpoint = `/assets${queryString ? `?${queryString}` : ''}`;
    
    const response = await apiService.get<AssetResponse>(endpoint);
    return {
      ...response,
      data: Array.isArray(response.data) ? response.data.map(normalizeAsset) : [],
    };
  }

  async getById(id: number | string): Promise<SingleAssetResponse> {
    const response = await apiService.get<SingleAssetResponse>(`/assets/${id}`);
    return { ...response, data: normalizeAsset(response.data) };
  }

  async create(data: Partial<Asset>): Promise<SingleAssetResponse> {
    const response = await apiService.post<SingleAssetResponse>('/assets', data);
    return { ...response, data: normalizeAsset(response.data) };
  }

  async update(id: number | string, data: Partial<Asset>): Promise<SingleAssetResponse> {
    const response = await apiService.put<SingleAssetResponse>(`/assets/${id}`, data);
    return { ...response, data: normalizeAsset(response.data) };
  }

  async delete(id: number | string, type?: Asset['type']): Promise<{ success: boolean; message: string }> {
    const query = type ? `?type=${encodeURIComponent(type)}` : '';
    return apiService.delete(`/assets/${id}${query}`);
  }

  async resetInventory(): Promise<{ success: boolean; message: string; data?: ResetInventorySummary }> {
    return apiService.delete('/assets/reset/all');
  }

  async getMedicalAssets(filters: AssetFilters = {}): Promise<AssetResponse> {
    return this.getAll({ ...filters, type: 'medical' });
  }

  async getNonMedicalAssets(filters: AssetFilters = {}): Promise<AssetResponse> {
    return this.getAll({ ...filters, type: 'non_medical' });
  }
}

export const assetService = new AssetService();
export default assetService;
