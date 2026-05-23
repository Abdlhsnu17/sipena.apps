import { toLocalDateTimeString } from "@/utils/format";
import apiService from "./api.service";

export type AssetUsageContext = "own_room" | "same_unit_cross_room" | "cross_room" | "emergency" | "procedure" | "rounding" | "other";

export interface AssetUsageLog {
  id: number;
  assetId: number;
  assetType: "medical" | "non_medical";
  assetName?: string;
  assetCode?: string;
  assetDetailId?: string;
  assetDetailName?: string;
  assetDetailCode?: string;
  assetLocation?: string;
  roomName: string;
  operatorUserId?: number;
  operatorName?: string;
  operatorNip?: string;
  usageContext: AssetUsageContext;
  startedAt: string;
  endedAt?: string;
  usageCount: number;
  conditionBefore?: string;
  conditionAfter?: string;
  notes?: string;
  createdBy: number;
  createdByName?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AssetUsageFilters {
  page?: number;
  limit?: number;
  assetId?: string;
  assetType?: "medical" | "non_medical";
  roomName?: string;
  usageContext?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface AssetUsageResponse {
  success: boolean;
  message: string;
  data: AssetUsageLog[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface SingleAssetUsageResponse {
  success: boolean;
  message: string;
  data?: AssetUsageLog;
}

export interface CreateAssetUsageData {
  assetId: number;
  assetType: "medical" | "non_medical";
  assetDetailId?: string;
  assetDetailName?: string;
  assetDetailCode?: string;
  assetLocation?: string;
  roomName: string;
  operatorUserId?: number;
  usageContext?: AssetUsageContext;
  startedAt: string;
  endedAt?: string;
  usageCount?: number;
  conditionBefore?: string;
  conditionAfter?: string;
  notes?: string;
}

const normalizeUsage = (usage: any): AssetUsageLog => ({
  id: usage.id,
  assetId: usage.assetId ?? usage.asset_id,
  assetType: usage.assetType ?? usage.asset_type,
  assetName: usage.assetName ?? usage.asset_name,
  assetCode: usage.assetCode ?? usage.asset_code,
  assetDetailId: usage.assetDetailId ?? usage.asset_detail_id,
  assetDetailName: usage.assetDetailName ?? usage.asset_detail_name,
  assetDetailCode: usage.assetDetailCode ?? usage.asset_detail_code,
  assetLocation: usage.assetLocation ?? usage.asset_location,
  roomName: usage.roomName ?? usage.room_name,
  operatorUserId: usage.operatorUserId ?? usage.operator_user_id,
  operatorName: usage.operatorName ?? usage.operator_name,
  operatorNip: usage.operatorNip ?? usage.operator_nip,
  usageContext: usage.usageContext ?? usage.usage_context,
  startedAt: toLocalDateTimeString(usage.startedAt ?? usage.started_at) ?? "",
  endedAt: toLocalDateTimeString(usage.endedAt ?? usage.ended_at),
  usageCount: usage.usageCount ?? usage.usage_count ?? 1,
  conditionBefore: usage.conditionBefore ?? usage.condition_before,
  conditionAfter: usage.conditionAfter ?? usage.condition_after,
  notes: usage.notes,
  createdBy: usage.createdBy ?? usage.created_by,
  createdByName: usage.createdByName ?? usage.created_by_name,
  createdAt: usage.createdAt ?? usage.created_at,
  updatedAt: usage.updatedAt ?? usage.updated_at,
});

class AssetUsageService {
  async getAll(filters: AssetUsageFilters = {}): Promise<AssetUsageResponse> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== "") params.append(key, String(value));
    });
    const queryString = params.toString();
    const response = await apiService.get<AssetUsageResponse>(`/asset-usage${queryString ? `?${queryString}` : ""}`);
    return {
      ...response,
      data: Array.isArray(response.data) ? response.data.map(normalizeUsage) : [],
    };
  }

  async create(data: CreateAssetUsageData): Promise<SingleAssetUsageResponse> {
    const response = await apiService.post<SingleAssetUsageResponse>("/asset-usage", data);
    return response.data ? { ...response, data: normalizeUsage(response.data) } : response;
  }

  async delete(id: number | string): Promise<{ success: boolean; message: string }> {
    return apiService.delete(`/asset-usage/${id}`);
  }
}

export const assetUsageService = new AssetUsageService();
export default assetUsageService;
