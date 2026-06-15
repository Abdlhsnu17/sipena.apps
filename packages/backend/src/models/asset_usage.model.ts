import { AssetType } from './asset.model';

export type AssetUsageContext = 'own_room' | 'same_unit_cross_room' | 'cross_room' | 'emergency' | 'procedure' | 'rounding' | 'other';

export interface AssetUsageLog {
  id: number;
  no?: string;
  borrowingId?: number;
  assetId: number;
  assetType: AssetType;
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
  startedAt: Date;
  endedAt?: Date;
  usageCount: number;
  conditionBefore?: string;
  conditionAfter?: string;
  notes?: string;
  createdBy: number;
  createdByName?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateAssetUsageLogDTO {
  no?: string;
  borrowingId?: number;
  assetId: number;
  assetType?: AssetType;
  assetDetailId?: string;
  assetDetailName?: string;
  assetDetailCode?: string;
  assetLocation?: string;
  roomName: string;
  operatorUserId?: number;
  usageContext?: AssetUsageContext;
  startedAt: Date | string;
  endedAt?: Date | string;
  usageCount?: number;
  conditionBefore?: string;
  conditionAfter?: string;
  notes?: string;
  createdBy: number;
  actorRole?: string;
}

export interface UpdateAssetUsageLogDTO {
  roomName?: string;
  operatorUserId?: number | null;
  usageContext?: AssetUsageContext;
  startedAt?: Date | string;
  endedAt?: Date | string | null;
  usageCount?: number;
  conditionBefore?: string;
  conditionAfter?: string;
  notes?: string;
  actorId?: number;
  actorRole?: string;
}

export interface AssetUsageFilters {
  page: number;
  limit: number;
  assetId?: string;
  assetType?: AssetType;
  roomName?: string;
  usageContext?: string;
  dateFrom?: string;
  dateTo?: string;
  actorUserId?: number | string | null;
  actorRole?: string | null;
}
