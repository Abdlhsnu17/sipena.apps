import { ActivityMetadata, ApiResponse, CreateUserActivityDTO, UserActivity } from '../models';
import { UserActivityRow } from '../repositories/user_activity.repository';
import { userActivityRepository } from '../repositories';
import { createScopedLogger } from '../utils/logger';
import { canViewOtherUsersActivity } from '../utils/role';

const logger = createScopedLogger('service:user-activity');

interface ActivityRecordInfo {
  recordNoId?: string | null;
  recordItemName?: string | null;
  recordItemCode?: string | null;
}

interface ActivityListFilters {
  actorUserId: number | string;
  actorRole?: string | null;
  userId?: number | string | null;
  page?: number | string;
  limit?: number | string;
  startDate?: string | null;
  endDate?: string | null;
}

interface PaginatedActivityResponse extends ApiResponse<UserActivity[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const toNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const normalizeDateFilter = (value: string | null | undefined): string | null => {
  const normalized = value?.trim();
  return normalized && /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
};

const CODE_PATTERN = /\b([A-Z0-9]+(?:-[A-Z0-9]+)+)\b/;

const isActivityMetadata = (value: unknown): value is ActivityMetadata => {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
};

const parseMetadata = (value: string | null): ActivityMetadata | null => {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return isActivityMetadata(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const extractCode = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const matched = trimmed.match(CODE_PATTERN);
  return matched?.[1] ?? null;
};

const getNumericMetadataValue = (metadata: ActivityMetadata | null | undefined, keys: string[]): number | null => {
  if (!metadata) return null;
  for (const key of keys) {
    const numericValue = toNumber(metadata[key]);
    if (numericValue) return numericValue;
  }
  return null;
};

const getExplicitMetadataCode = (metadata: ActivityMetadata | null | undefined): string | null => {
  if (!metadata) return null;

  const codeKeys = [
    'recordNoId',
    'record_no_id',
    'transactionCode',
    'transaction_code',
    'borrowingCode',
    'borrowing_code',
    'maintenanceCode',
    'maintenance_code',
    'transactionId',
    'transaction_id',
  ];

  for (const key of codeKeys) {
    const code = extractCode(metadata[key]);
    if (code) return code;
  }

  return null;
};

const getDescriptionCode = (description: string): string | null => extractCode(description);

const getTextMetadataValue = (metadata: ActivityMetadata | null | undefined, keys: string[]): string | null => {
  if (!metadata) return null;
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
};

const resolveBorrowingRecordInfo = async (borrowingId: number): Promise<ActivityRecordInfo | null> => {
  const record = await userActivityRepository.findBorrowingRecordInfo(borrowingId);
  if (!record) return null;

  return {
    recordNoId: record.borrowing_code ?? null,
    recordItemName: record.asset_name ?? null,
    recordItemCode: record.asset_code ?? null,
  };
};

const resolveMaintenanceRecordInfoByMaintenanceId = async (maintenanceId: number): Promise<ActivityRecordInfo | null> => {
  const record = await userActivityRepository.findMaintenanceRecordInfoByMaintenanceId(maintenanceId);
  if (!record) return null;

  return {
    recordNoId: record.maintenance_code ?? null,
    recordItemName: record.asset_name ?? null,
    recordItemCode: record.asset_code ?? null,
  };
};

const enrichActivityMetadata = async (activity: UserActivity): Promise<UserActivity> => {
  const metadata = activity.metadata ?? null;
  if (!metadata) return activity;

  const explicitCode = getExplicitMetadataCode(metadata) ?? getDescriptionCode(activity.description);
  const explicitItemName = getTextMetadataValue(metadata, [
    'recordItemName',
    'record_item_name',
    'assetName',
    'asset_name',
    'itemName',
    'item_name',
  ]);
  const explicitItemCode = getTextMetadataValue(metadata, [
    'recordItemCode',
    'record_item_code',
    'assetCode',
    'asset_code',
    'itemCode',
    'item_code',
  ]);

  let resolvedInfo: ActivityRecordInfo | null = null;

  if (activity.feature === 'peminjaman_alat' || activity.feature === 'pengembalian_alat') {
    const borrowingId = getNumericMetadataValue(metadata, ['borrowingId', 'borrowing_id', 'transactionId', 'transaction_id']);
    if (borrowingId) {
      resolvedInfo = await resolveBorrowingRecordInfo(borrowingId);
    }
  } else if (activity.feature === 'pemeliharaan') {
    const maintenanceId = getNumericMetadataValue(metadata, ['maintenanceId', 'maintenance_id', 'transactionId', 'transaction_id']);
    if (maintenanceId) {
      resolvedInfo = await resolveMaintenanceRecordInfoByMaintenanceId(maintenanceId);
    }
  } else if (activity.feature === 'jadwal_pemeliharaan') {
    const maintenanceId = getNumericMetadataValue(metadata, ['maintenanceId', 'maintenance_id', 'transactionId', 'transaction_id']);
    if (maintenanceId) {
      resolvedInfo = await resolveMaintenanceRecordInfoByMaintenanceId(maintenanceId);
    }
  }

  const resolvedCode = explicitCode ?? resolvedInfo?.recordNoId ?? null;
  const resolvedItemName = explicitItemName ?? resolvedInfo?.recordItemName ?? null;
  const resolvedItemCode = explicitItemCode ?? resolvedInfo?.recordItemCode ?? null;

  if (!resolvedCode && !resolvedItemName && !resolvedItemCode) return activity;

  const enrichedMetadata: ActivityMetadata = {
    ...metadata,
  };

  if (resolvedCode) {
    enrichedMetadata.recordNoId = resolvedCode;
    enrichedMetadata.record_no_id = resolvedCode;
    enrichedMetadata.transactionCode = resolvedCode;
    enrichedMetadata.transaction_code = resolvedCode;
  }

  if (resolvedItemCode) {
    enrichedMetadata.recordItemCode = resolvedItemCode;
    enrichedMetadata.record_item_code = resolvedItemCode;
  }

  if (resolvedItemName) {
    enrichedMetadata.recordItemName = resolvedItemName;
    enrichedMetadata.record_item_name = resolvedItemName;
  }

  return {
    ...activity,
    metadata: enrichedMetadata,
  };
};

const mapRow = (row: UserActivityRow): UserActivity => ({
  id: Number(row.id),
  userId: Number(row.user_id),
  userName: row.user_name ?? null,
  userNip: row.user_nip ?? null,
  feature: row.feature,
  action: row.action,
  description: row.description,
  metadata: parseMetadata(row.metadata_json),
  createdAt: row.created_at,
});

export class UserActivityService {
  async create(payload: CreateUserActivityDTO): Promise<void> {
    const userId = toNumber(payload.userId);
    if (!userId) return;

    await userActivityRepository.create({
      userId,
      feature: payload.feature,
      action: payload.action,
      description: payload.description,
      metadataJson: payload.metadata ? JSON.stringify(payload.metadata) : null,
    });
  }

  async getByUserId(userIdValue: number | string, limitValue: number = 10): Promise<ApiResponse<UserActivity[]>> {
    const userId = toNumber(userIdValue);
    if (!userId) {
      return { success: false, message: 'User tidak valid', data: [] };
    }

    const limit = Math.max(1, Math.min(Number(limitValue) || 10, 10));

    const rows = await userActivityRepository.findRecentByUserId(userId, limit);

    return {
      success: true,
      message: 'Histori aktivitas berhasil diambil',
      data: await Promise.all(rows.map((row) => enrichActivityMetadata(mapRow(row)))),
    };
  }

  async getActivities(filters: ActivityListFilters): Promise<PaginatedActivityResponse> {
    const actorUserId = toNumber(filters.actorUserId);
    if (!actorUserId) {
      return {
        success: false,
        message: 'User tidak valid',
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      };
    }

    const requestedUserId = toNumber(filters.userId);
    const scopedUserId = canViewOtherUsersActivity(filters.actorRole) ? requestedUserId : actorUserId;
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.max(1, Math.min(Number(filters.limit) || 20, 100));
    const offset = (page - 1) * limit;
    const startDate = normalizeDateFilter(filters.startDate);
    const endDate = normalizeDateFilter(filters.endDate);
    const where = [`NOT (ual.feature = 'pencarian' AND ual.action = 'search')`];
    const params: Array<string | number> = [];

    if (scopedUserId) {
      where.push('ual.user_id = ?');
      params.push(scopedUserId);
    }

    if (startDate) {
      where.push('DATE(ual.created_at) >= ?');
      params.push(startDate);
    }

    if (endDate) {
      where.push('DATE(ual.created_at) <= ?');
      params.push(endDate);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const activityWhere = { clause: whereClause, params };
    const total = await userActivityRepository.countActivities(activityWhere);
    const rows = await userActivityRepository.findActivities(activityWhere, limit, offset);

    return {
      success: true,
      message: 'Arsip riwayat aktivitas berhasil diambil',
      data: await Promise.all(rows.map((row) => enrichActivityMetadata(mapRow(row)))),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

export const userActivityService = new UserActivityService();

export const recordUserActivity = async (payload: CreateUserActivityDTO): Promise<void> => {
  try {
    await userActivityService.create(payload);
  } catch (error) {
    logger.error('Failed to record user activity', { error });
  }
};

export default userActivityService;
