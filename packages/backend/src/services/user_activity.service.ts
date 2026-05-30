import { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../config/database';
import { ApiResponse, CreateUserActivityDTO, UserActivity } from '../models';
import { hasAnyRole } from '../utils/role';

interface UserActivityRow extends RowDataPacket {
  id: number;
  user_id: number;
  user_name?: string | null;
  user_nip?: string | null;
  feature: string;
  action: string;
  description: string;
  metadata_json: string | null;
  created_at: Date;
}

interface BorrowingRecordInfoRow extends RowDataPacket {
  borrowing_code: string | null;
  asset_name: string | null;
  asset_code: string | null;
}

interface MaintenanceRecordInfoRow extends RowDataPacket {
  maintenance_code: string | null;
  asset_name: string | null;
  asset_code: string | null;
}

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

const CODE_PATTERN = /\b([A-Z0-9]+(?:-[A-Z0-9]+)+)\b/;

const parseMetadata = (value: string | null): Record<string, any> | null => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : null;
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

const getNumericMetadataValue = (metadata: Record<string, any> | null | undefined, keys: string[]): number | null => {
  if (!metadata) return null;
  for (const key of keys) {
    const numericValue = toNumber(metadata[key]);
    if (numericValue) return numericValue;
  }
  return null;
};

const getExplicitMetadataCode = (metadata: Record<string, any> | null | undefined): string | null => {
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

const getTextMetadataValue = (metadata: Record<string, any> | null | undefined, keys: string[]): string | null => {
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
  const [rows] = await pool.query<BorrowingRecordInfoRow[]>(
    `SELECT
       br.borrowing_code,
       COALESCE(br.asset_detail_name, ma.name, na.name) AS asset_name,
       COALESCE(br.asset_detail_code, ma.asset_code, na.asset_code) AS asset_code
     FROM borrowing_records br
     LEFT JOIN medical_assets ma
       ON (br.asset_type = 'medical' OR br.asset_type IS NULL) AND br.asset_id = ma.id
     LEFT JOIN non_medical_assets na
       ON br.asset_type = 'non_medical' AND br.asset_id = na.id
     WHERE br.id = ?
     LIMIT 1`,
    [borrowingId]
  );

  const record = rows[0];
  if (!record) return null;

  return {
    recordNoId: record.borrowing_code ?? null,
    recordItemName: record.asset_name ?? null,
    recordItemCode: record.asset_code ?? null,
  };
};

const resolveMaintenanceRecordInfoByMaintenanceId = async (maintenanceId: number): Promise<ActivityRecordInfo | null> => {
  const [rows] = await pool.query<MaintenanceRecordInfoRow[]>(
    `SELECT
       mr.maintenance_code,
       COALESCE(mr.asset_detail_name, ma.name, na.name) AS asset_name,
       COALESCE(mr.asset_detail_code, ma.asset_code, na.asset_code) AS asset_code
     FROM maintenance_records mr
     LEFT JOIN medical_assets ma
       ON (mr.asset_type = 'medical' OR mr.asset_type IS NULL) AND mr.asset_id = ma.id
     LEFT JOIN non_medical_assets na
       ON mr.asset_type = 'non_medical' AND mr.asset_id = na.id
     WHERE mr.id = ?
     LIMIT 1`,
    [maintenanceId]
  );

  const record = rows[0];
  if (!record) return null;

  return {
    recordNoId: record.maintenance_code ?? null,
    recordItemName: record.asset_name ?? null,
    recordItemCode: record.asset_code ?? null,
  };
};

const resolveMaintenanceRecordInfoByScheduleId = async (scheduleId: number): Promise<ActivityRecordInfo | null> => {
  const [rows] = await pool.query<MaintenanceRecordInfoRow[]>(
    `SELECT
       mr.maintenance_code,
       COALESCE(mr.asset_detail_name, ma.name, na.name) AS asset_name,
       COALESCE(mr.asset_detail_code, ma.asset_code, na.asset_code) AS asset_code
     FROM maintenance_records mr
     LEFT JOIN medical_assets ma
       ON (mr.asset_type = 'medical' OR mr.asset_type IS NULL) AND mr.asset_id = ma.id
     LEFT JOIN non_medical_assets na
       ON mr.asset_type = 'non_medical' AND mr.asset_id = na.id
     WHERE mr.schedule_id = ?
     ORDER BY mr.id DESC
     LIMIT 1`,
    [scheduleId]
  );

  const record = rows[0];
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
    const maintenanceId = getNumericMetadataValue(metadata, ['maintenanceId', 'maintenance_id']);
    const scheduleId = getNumericMetadataValue(metadata, ['scheduleId', 'schedule_id', 'transactionId', 'transaction_id']);

    if (maintenanceId) {
      resolvedInfo = await resolveMaintenanceRecordInfoByMaintenanceId(maintenanceId);
    }

    if ((!resolvedInfo?.recordNoId || !resolvedInfo.recordItemName || !resolvedInfo.recordItemCode) && scheduleId) {
      resolvedInfo = await resolveMaintenanceRecordInfoByScheduleId(scheduleId);
    }
  }

  const resolvedCode = explicitCode ?? resolvedInfo?.recordNoId ?? null;
  const resolvedItemName = explicitItemName ?? resolvedInfo?.recordItemName ?? null;
  const resolvedItemCode = explicitItemCode ?? resolvedInfo?.recordItemCode ?? null;

  if (!resolvedCode && !resolvedItemName && !resolvedItemCode) return activity;

  const enrichedMetadata: Record<string, any> = {
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

    await pool.query<ResultSetHeader>(
      `INSERT INTO user_activity_logs (user_id, feature, action, description, metadata_json)
       VALUES (?, ?, ?, ?, ?)`,
      [
        userId,
        payload.feature,
        payload.action,
        payload.description,
        payload.metadata ? JSON.stringify(payload.metadata) : null,
      ]
    );
  }

  async getByUserId(userIdValue: number | string, limitValue: number = 10): Promise<ApiResponse<UserActivity[]>> {
    const userId = toNumber(userIdValue);
    if (!userId) {
      return { success: false, message: 'User tidak valid', data: [] };
    }

    const limit = Math.max(1, Math.min(Number(limitValue) || 10, 10));

    const [rows] = await pool.query<UserActivityRow[]>(
      `SELECT ual.id, ual.user_id, u.name AS user_name, u.nip AS user_nip, ual.feature, ual.action, ual.description, ual.metadata_json, ual.created_at
       FROM user_activity_logs ual
       LEFT JOIN users u ON u.id = ual.user_id
       WHERE ual.user_id = ?
         AND NOT (feature = 'pencarian' AND action = 'search')
       ORDER BY ual.created_at DESC
       LIMIT ?`,
      [userId, limit]
    );

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

    const canViewOthers = hasAnyRole(filters.actorRole, ['admin', 'leader']);
    const requestedUserId = toNumber(filters.userId);
    const scopedUserId = canViewOthers ? requestedUserId : actorUserId;
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.max(1, Math.min(Number(filters.limit) || 20, 100));
    const offset = (page - 1) * limit;
    const where = [`NOT (ual.feature = 'pencarian' AND ual.action = 'search')`];
    const params: Array<string | number> = [];

    if (scopedUserId) {
      where.push('ual.user_id = ?');
      params.push(scopedUserId);
    }

    if (filters.startDate) {
      where.push('DATE(ual.created_at) >= ?');
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      where.push('DATE(ual.created_at) <= ?');
      params.push(filters.endDate);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [countRows] = await pool.query<Array<RowDataPacket & { total: number }>>(
      `SELECT COUNT(*) AS total
       FROM user_activity_logs ual
       ${whereClause}`,
      params
    );

    const total = Number(countRows[0]?.total || 0);
    const [rows] = await pool.query<UserActivityRow[]>(
      `SELECT ual.id, ual.user_id, u.name AS user_name, u.nip AS user_nip,
              ual.feature, ual.action, ual.description, ual.metadata_json, ual.created_at
       FROM user_activity_logs ual
       LEFT JOIN users u ON u.id = ual.user_id
       ${whereClause}
       ORDER BY ual.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

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
    console.error('Failed to record user activity:', error);
  }
};

export default userActivityService;
