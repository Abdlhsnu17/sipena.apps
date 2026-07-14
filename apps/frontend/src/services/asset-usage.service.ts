import { toLocalDateTimeString } from "@/utils/format";
import apiService from "./api.service";

export type AssetUsageContext = "own_room" | "same_unit_cross_room" | "cross_room" | "emergency" | "procedure" | "rounding" | "other";

export type AssetUsageSourceType = "manual" | "borrowing_sync";

export interface AssetUsageLog {
  id: number;
  no?: string;
  borrowingId?: number;
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
  operatorRole?: string;
  usageContext: AssetUsageContext;
  startedAt: string;
  endedAt?: string;
  usageCount: number;
  conditionBefore?: string;
  conditionAfter?: string;
  notes?: string;
  sourceType: AssetUsageSourceType;
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

export type UpdateAssetUsageData = Partial<Omit<CreateAssetUsageData, "assetId" | "assetType">>;

const normalizeUsage = (usage: any): AssetUsageLog => {
  const borrowingId = usage.borrowingId ?? usage.borrowing_id;
  return {
    id: usage.id,
    no: usage.no,
    borrowingId,
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
    operatorRole: usage.operatorRole ?? usage.operator_role,
    usageContext: usage.usageContext ?? usage.usage_context,
    startedAt: toLocalDateTimeString(usage.startedAt ?? usage.started_at) ?? "",
    endedAt: toLocalDateTimeString(usage.endedAt ?? usage.ended_at),
    usageCount: usage.usageCount ?? usage.usage_count ?? 1,
    conditionBefore: usage.conditionBefore ?? usage.condition_before,
    conditionAfter: usage.conditionAfter ?? usage.condition_after,
    notes: usage.notes,
    sourceType: borrowingId ? "borrowing_sync" : usage.sourceType ?? usage.source_type ?? "manual",
    createdBy: usage.createdBy ?? usage.created_by,
    createdByName: usage.createdByName ?? usage.created_by_name,
    createdAt: usage.createdAt ?? usage.created_at,
    updatedAt: usage.updatedAt ?? usage.updated_at,
  };
};

const emitNotificationsRefresh = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("notifications-refresh"));
};

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

  async getAllPages(filters: Omit<AssetUsageFilters, "page" | "limit"> = {}): Promise<AssetUsageResponse> {
    const pageSize = 500;
    const firstPage = await this.getAll({ ...filters, page: 1, limit: pageSize });
    if (!firstPage.success || !firstPage.pagination || firstPage.pagination.totalPages <= 1) {
      return firstPage;
    }

    const remainingPages = Array.from(
      { length: firstPage.pagination.totalPages - 1 },
      (_, index) => index + 2
    );
    const pageResponses: AssetUsageResponse[] = [];
    const concurrentPageLimit = 4;
    for (let index = 0; index < remainingPages.length; index += concurrentPageLimit) {
      const pageBatch = remainingPages.slice(index, index + concurrentPageLimit);
      pageResponses.push(
        ...(await Promise.all(
          pageBatch.map((page) => this.getAll({ ...filters, page, limit: pageSize }))
        ))
      );
    }
    const failedPage = pageResponses.find((response) => !response.success);
    if (failedPage) return failedPage;

    const recordsById = new Map<number, AssetUsageLog>();
    [firstPage, ...pageResponses].forEach((response) => {
      response.data.forEach((record) => recordsById.set(record.id, record));
    });
    const data = Array.from(recordsById.values()).sort(
      (left, right) => new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime()
    );

    return {
      ...firstPage,
      data,
      pagination: {
        page: 1,
        limit: data.length,
        total: firstPage.pagination.total,
        totalPages: 1,
      },
    };
  }

  async create(data: CreateAssetUsageData): Promise<SingleAssetUsageResponse> {
    const response = await apiService.post<SingleAssetUsageResponse>("/asset-usage", data);
    const normalized = response.data ? { ...response, data: normalizeUsage(response.data) } : response;
    if (normalized.success) emitNotificationsRefresh();
    return normalized;
  }

  async update(id: number | string, data: UpdateAssetUsageData): Promise<SingleAssetUsageResponse> {
    const response = await apiService.patch<SingleAssetUsageResponse>(`/asset-usage/${id}`, data);
    const normalized = response.data ? { ...response, data: normalizeUsage(response.data) } : response;
    if (normalized.success) emitNotificationsRefresh();
    return normalized;
  }

  async delete(id: number | string, deleteReason?: string): Promise<{ success: boolean; message: string }> {
    const response = await apiService.delete<{ success: boolean; message: string }>(`/asset-usage/${id}`, {
      deleteReason,
    });
    if (response.success) emitNotificationsRefresh();
    return response;
  }
}

export const assetUsageService = new AssetUsageService();
export default assetUsageService;
