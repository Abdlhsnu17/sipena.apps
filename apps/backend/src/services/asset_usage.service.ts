import { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../config/database';
import {
    ApiResponse,
    AssetType,
    AssetUsageFilters,
    AssetUsageLog,
    CreateAssetUsageLogDTO,
    PaginatedResponse,
    UpdateAssetUsageLogDTO
} from '../models';
import { formatDateTimeForMySQL } from '../utils/helpers';
import { createScopedLogger } from '../utils/logger';
import { canCompleteUsage, canManageOverdueEmergencyUsage } from '../utils/role';
import { AssetService } from './asset.service';

const logger = createScopedLogger('service:asset-usage');

interface AssetUsageRow extends RowDataPacket, AssetUsageLog {
  borrowing_id?: number | null;
  asset_id?: number | null;
  asset_type?: AssetType | null;
  asset_detail_id?: string | null;
  asset_detail_name?: string | null;
  asset_detail_code?: string | null;
  asset_name?: string | null;
  asset_code?: string | null;
  asset_location?: string | null;
  room_name?: string | null;
  operator_user_id?: number | null;
  operator_name?: string | null;
  operator_nip?: string | null;
  operator_role?: string | null;
  usage_context?: AssetUsageLog['usageContext'] | null;
  usage_count?: number | null;
  condition_before?: string | null;
  condition_after?: string | null;
  created_by?: number | null;
  created_by_name?: string | null;
  source_type?: AssetUsageLog['sourceType'] | null;
  deleted_at?: Date | null;
  deleted_by?: number | null;
  delete_reason?: string | null;
}

interface CountRow extends RowDataPacket {
  count: number;
}

interface ActiveBorrowingRow extends RowDataPacket {
  id: number;
  asset_id: number;
  asset_type?: AssetType | null;
  asset_detail_id?: string | null;
  asset_detail_name?: string | null;
  asset_detail_code?: string | null;
  asset_location?: string | null;
  destination_room?: string | null;
  borrower_work_unit?: string | null;
  user_id: number;
  borrow_date: string | Date;
  quantity?: number | null;
  notes?: string | null;
}

interface UsageActorRoomRow extends RowDataPacket {
  sub_work_unit?: string | null;
}

interface OverdueBorrowingRow extends RowDataPacket {
  user_id: number;
  borrower_role: string | null;
}

type UsageSyncOptions = {
  usageId?: number | string | null;
  detailId?: string | null;
  detailName?: string | null;
  detailCode?: string | null;
  conditionAfter?: string | null;
  endedAt?: string | Date | null;
};

type CreateAssetUsageOptions = {
  skipSubRoomValidation?: boolean;
};

type UpdateAssetUsageOptions = {
  allowBorrowingCompletion?: boolean;
};

const toLocalIsoDateTime = (value?: string | Date | null): string => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return '';
  const pad = (num: number) => String(num).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

const generateUsageNumber = (value?: string | Date | null): string => {
  const date = value ? (value instanceof Date ? value : new Date(String(value))) : new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  const rand = Math.floor(Math.random() * 9000) + 1000; // 4 digits
  return `PG-${y}${m}${d}-${hh}${mm}${ss}-${rand}`;
};

const mapUsageRow = (row: AssetUsageRow): AssetUsageLog => {
  const borrowingId = row.borrowing_id ?? row.borrowingId;
  return {
    ...row,
    borrowingId,
    assetId: row.asset_id ?? row.assetId,
    assetType: row.asset_type ?? row.assetType,
    assetDetailId: row.asset_detail_id ?? row.assetDetailId,
    assetDetailName: row.asset_detail_name ?? row.assetDetailName,
    assetDetailCode: row.asset_detail_code ?? row.assetDetailCode,
    assetName: row.asset_name || row.assetName,
    assetCode: row.asset_code || row.assetCode,
    assetLocation: row.asset_location || row.assetLocation,
    roomName: row.room_name ?? row.roomName,
    operatorUserId: row.operator_user_id ?? row.operatorUserId,
    operatorName: row.operator_name || row.operatorName,
    operatorNip: row.operator_nip || row.operatorNip,
    operatorRole: row.operator_role || row.operatorRole,
    usageContext: row.usage_context ?? row.usageContext,
    usageCount: row.usage_count ?? row.usageCount,
    conditionBefore: row.condition_before ?? row.conditionBefore,
    conditionAfter: row.condition_after ?? row.conditionAfter,
    createdBy: row.created_by ?? row.createdBy,
    createdByName: row.created_by_name || row.createdByName,
    sourceType: borrowingId ? 'borrowing_sync' : row.source_type ?? row.sourceType ?? 'manual',
    deletedAt: row.deleted_at ?? row.deletedAt,
    deletedBy: row.deleted_by ?? row.deletedBy,
    deleteReason: row.delete_reason ?? row.deleteReason,
    startedAt: toLocalIsoDateTime(row.startedAt ?? (row as any).started_at) as any,
    endedAt: toLocalIsoDateTime(row.endedAt ?? (row as any).ended_at) as any,
  };
};

export class AssetUsageService {
  private assetService: AssetService;

  constructor() {
    this.assetService = new AssetService();
  }

  private normalizeAssetType(value?: string | null): AssetType {
    return value === 'non_medical' ? 'non_medical' : 'medical';
  }

  private normalizeDetailIdentifier(value?: string | number | null): string {
    if (value === undefined || value === null) return '';
    return String(value).trim();
  }

  private parseAssetSpecifications(raw: unknown): Record<string, any> {
    if (!raw) return {};
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
      } catch {
        return {};
      }
    }
    if (typeof raw === 'object') {
      return raw as Record<string, any>;
    }
    return {};
  }

  private isAssetFallbackDetailId(detailId?: string | null, assetId?: number, assetType?: AssetType): boolean {
    if (!detailId || !assetId) return false;
    const normalizedDetailId = this.normalizeDetailIdentifier(detailId);
    const normalizedAssetType = assetType === 'non_medical' ? 'non_medical' : 'medical';
    return normalizedDetailId === `asset-${assetId}` || normalizedDetailId === `asset-${normalizedAssetType}-${assetId}`;
  }

  private normalizeComparableText(value?: string | number | null): string {
    return this.normalizeDetailIdentifier(value).toLowerCase();
  }

  private normalizeLocationText(value?: string | number | null): string {
    return this.normalizeDetailIdentifier(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private locationIncludes(source: string, target?: string | null): boolean {
    const normalizedTarget = this.normalizeLocationText(target);
    return Boolean(normalizedTarget && source.includes(normalizedTarget));
  }

  private getMeaningfulRoomTokens(value: string): string[] {
    const ignoredWords = new Set(['ruang', 'ruangan', 'ranap', 'rawat', 'inap', 'kamar', 'unit', 'sub', 'instalasi']);
    return this.normalizeLocationText(value)
      .split(' ')
      .filter((token) => token && !ignoredWords.has(token) && (token.length >= 3 || token === 'ok'));
  }

  private roomMatchesSubRoom(assetRoomText: string, subRoom?: string | null): boolean {
    const normalizedAssetRoom = this.normalizeLocationText(assetRoomText);
    const normalizedSubRoom = this.normalizeLocationText(subRoom);
    if (!normalizedAssetRoom || !normalizedSubRoom) return false;
    if (normalizedAssetRoom.includes(normalizedSubRoom)) return true;

    const subRoomSegments = String(subRoom || '')
      .split(/[\/,;]/)
      .map((segment) => segment.trim())
      .filter(Boolean);

    return subRoomSegments.some((segment) => {
      const normalizedSegment = this.normalizeLocationText(segment);
      if (!normalizedSegment) return false;
      if (normalizedAssetRoom.includes(normalizedSegment)) return true;

      const meaningfulTokens = this.getMeaningfulRoomTokens(segment);
      return meaningfulTokens.length > 0 && meaningfulTokens.some((token) => normalizedAssetRoom.includes(token));
    });
  }

  private matchesAssetDetail(
    detail: Record<string, any>,
    detailId?: string | null,
    detailCode?: string | null,
    detailName?: string | null
  ): boolean {
    const normalizedTargetId = this.normalizeDetailIdentifier(detailId);
    const normalizedTargetCode = this.normalizeDetailIdentifier(detailCode);
    const normalizedTargetName = this.normalizeComparableText(detailName);
    const detailCandidates = [
      this.normalizeDetailIdentifier(detail.id),
      this.normalizeDetailIdentifier(detail.detailId),
      this.normalizeDetailIdentifier(detail.assetDetailId),
      this.normalizeDetailIdentifier(detail.assetCode),
      this.normalizeDetailIdentifier(detail.detailCode),
      this.normalizeDetailIdentifier(detail.serialNumber)
    ].filter(Boolean);

    if (normalizedTargetId && detailCandidates.includes(normalizedTargetId)) {
      return true;
    }

    if (normalizedTargetCode && detailCandidates.includes(normalizedTargetCode)) {
      return true;
    }

    if (normalizedTargetName) {
      const nameCandidates = [
        this.normalizeComparableText(detail.inventoryName),
        this.normalizeComparableText(detail.name),
        this.normalizeComparableText(detail.detailName),
        this.normalizeComparableText(detail.assetDetailName),
        this.normalizeComparableText(detail.brandModel),
        [detail.brand, detail.model]
          .map((value) => this.normalizeDetailIdentifier(value))
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
      ].filter(Boolean);

      if (nameCandidates.includes(normalizedTargetName)) {
        return true;
      }
    }

    return false;
  }

  private normalizeUsageConditionLabel(value?: string | null): string | null {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return null;
    if (normalized.includes('rusak') || normalized.includes('damaged') || normalized.includes('broken')) return 'Rusak';
    if (normalized.includes('cukup') || normalized.includes('fair')) return 'Cukup';
    if (normalized.includes('poor') || normalized.includes('buruk') || normalized.includes('kurang')) return 'Cukup';
    return 'Baik';
  }

  private getDetailRoomText(detail?: Record<string, any> | null): string {
    if (!detail) return '';
    return [
      detail.roomName,
      detail.room_name,
      detail.ruangan,
      detail.lokasi,
      detail.location,
      detail.room?.name,
      detail.room?.roomName
    ]
      .map((value) => this.normalizeDetailIdentifier(value))
      .filter((value) => value && !/^\d+$/.test(value))
      .join(' ');
  }

  private async validateUsageSubRoomAccess(data: CreateAssetUsageLogDTO): Promise<ApiResponse<AssetUsageLog> | null> {
    const actorId = Number(data.createdBy);
    if (!Number.isFinite(actorId) || actorId <= 0) {
      return null;
    }

    const [userRows] = await pool.query<UsageActorRoomRow[]>(
      'SELECT sub_work_unit FROM users WHERE id = ? LIMIT 1',
      [actorId]
    );
    const actorSubRoom = this.normalizeDetailIdentifier(userRows[0]?.sub_work_unit);
    if (!actorSubRoom) {
      return {
        success: false,
        message: 'Sub ruangan akun belum diisi, sehingga alat penggunaan tidak dapat dipilih.'
      };
    }

    const assetType = this.normalizeAssetType(data.assetType);
    const assetResponse = await this.assetService.getById(String(data.assetId), assetType);
    if (!assetResponse.success || !assetResponse.data) {
      return { success: false, message: 'Data alat tidak ditemukan' };
    }

    const specifications = this.parseAssetSpecifications(assetResponse.data.specifications);
    const details = Array.isArray(specifications.details) ? specifications.details : [];
    const normalizedDetailId = this.normalizeDetailIdentifier(data.assetDetailId);
    const isFallbackDetail = this.isAssetFallbackDetailId(normalizedDetailId, data.assetId, assetType);
    const selectedDetail =
      normalizedDetailId && !isFallbackDetail
        ? details.find((detail) => this.matchesAssetDetail(detail, data.assetDetailId, data.assetDetailCode, data.assetDetailName))
        : null;
    const assetRoomText = this.normalizeLocationText(
      [
        this.getDetailRoomText(selectedDetail),
        (assetResponse.data as any).roomName,
        assetResponse.data.location
      ]
        .filter(Boolean)
        .join(' ')
    );

    if (!this.roomMatchesSubRoom(assetRoomText, actorSubRoom)) {
      return {
        success: false,
        message: 'Alat hanya dapat digunakan oleh akun pada sub ruangan yang sama.'
      };
    }

    return null;
  }

  private async validateOperatorExists(operatorUserId?: number | null): Promise<ApiResponse<AssetUsageLog> | null> {
    if (!operatorUserId) return null;

    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1',
      [operatorUserId]
    );

    if (rows.length === 0) {
      return { success: false, message: 'Operator yang dipilih tidak ditemukan atau sudah tidak aktif.' };
    }

    return null;
  }

  private async validateOverdueEmergencyAccess(data: CreateAssetUsageLogDTO): Promise<ApiResponse<AssetUsageLog> | null> {
    if (data.usageContext !== 'emergency') return null;

    const assetType = this.normalizeAssetType(data.assetType);
    const [rows] = await pool.query<OverdueBorrowingRow[]>(
      `SELECT br.user_id, u.role as borrower_role
       FROM borrowing_records br
       JOIN users u ON br.user_id = u.id
       WHERE br.asset_id = ?
         AND COALESCE(br.asset_type, 'medical') = ?
         AND br.status = 'overdue'
       ORDER BY br.created_at DESC
       LIMIT 1`,
      [data.assetId, assetType]
    );

    if (rows.length === 0) return null;

    const borrowerRole = rows[0].borrower_role;
    if (!canManageOverdueEmergencyUsage(data.actorRole, borrowerRole)) {
      return {
        success: false,
        message: `Penggunaan darurat pada alat yang melewati batas waktu peminjaman hanya dapat dilakukan oleh admin, leader, atau pengguna dengan role yang sama dengan peminjam asal (${borrowerRole || '-'}).`
      };
    }

    return null;
  }

  private async validateAssetNotLocked(data: CreateAssetUsageLogDTO): Promise<ApiResponse<AssetUsageLog> | null> {
    if (data.borrowingId) return null;

    const assetType = this.normalizeAssetType(data.assetType);
    const normalizedDetailId = this.normalizeDetailIdentifier(data.assetDetailId);
    const isFallbackDetail = this.isAssetFallbackDetailId(normalizedDetailId, data.assetId, assetType);
    const hasSpecificDetail = Boolean(normalizedDetailId) && !isFallbackDetail;
    const fallbackIds = [`asset-${data.assetId}`, `asset-${assetType}-${data.assetId}`];
    const detailClause = hasSpecificDetail
      ? 'AND (asset_detail_id = ? OR asset_detail_id IS NULL OR asset_detail_id IN (?, ?))'
      : '';
    const detailParams = hasSpecificDetail ? [normalizedDetailId, fallbackIds[0], fallbackIds[1]] : [];

    const blockingBorrowingStatuses = data.usageContext === 'emergency'
      ? ['pending', 'approved', 'borrowed']
      : ['pending', 'approved', 'borrowed', 'overdue'];
    const borrowingStatusPlaceholders = blockingBorrowingStatuses.map(() => '?').join(', ');
    const [borrowingRows] = await pool.query<RowDataPacket[]>(
      `SELECT id FROM borrowing_records
       WHERE asset_id = ?
         AND COALESCE(asset_type, 'medical') = ?
         AND status IN (${borrowingStatusPlaceholders})
         AND deleted_at IS NULL
         ${detailClause}
       LIMIT 1`,
      [data.assetId, assetType, ...blockingBorrowingStatuses, ...detailParams]
    );
    if (borrowingRows.length > 0) {
      return {
        success: false,
        message: 'Alat sedang dalam proses peminjaman sehingga tidak dapat dicatat penggunaannya secara manual.'
      };
    }

    const [maintenanceRows] = await pool.query<RowDataPacket[]>(
      `SELECT id FROM maintenance_records
       WHERE asset_id = ?
         AND COALESCE(asset_type, 'medical') = ?
         AND status IN ('requested', 'scheduled', 'in_progress', 'completed')
         AND deleted_at IS NULL
         ${detailClause}
       LIMIT 1`,
      [data.assetId, assetType, ...detailParams]
    );
    if (maintenanceRows.length > 0) {
      return {
        success: false,
        message: 'Alat sedang dalam proses pemeliharaan sehingga tidak dapat dicatat penggunaannya.'
      };
    }

    if (await this.hasActiveUsageForAssetDetail(data.assetId, assetType, normalizedDetailId || null)) {
      return {
        success: false,
        message: 'Alat masih memiliki penggunaan aktif dan belum dapat digunakan kembali.'
      };
    }

    return null;
  }

  private normalizeAssetCondition(value?: string | null): 'good' | 'fair' | 'poor' | 'damaged' | null {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return null;
    if (normalized.includes('rusak') || normalized.includes('damaged') || normalized.includes('broken')) return 'damaged';
    if (normalized.includes('cukup') || normalized.includes('fair')) return 'fair';
    if (normalized.includes('poor') || normalized.includes('buruk') || normalized.includes('kurang')) return 'poor';
    return 'good';
  }

  private isDamagedUsageCondition(value?: string | null): boolean {
    const normalized = String(value || '').trim().toLowerCase();
    return normalized.includes('rusak') || normalized.includes('damaged') || normalized.includes('broken');
  }

  private async hasActiveUsageForAssetDetail(
    assetId: number,
    assetType: AssetType,
    detailId?: string | null,
    usageIdToIgnore?: number | string | null
  ): Promise<boolean> {
    const normalizedAssetType = this.normalizeAssetType(assetType);
    const normalizedDetailId = this.normalizeDetailIdentifier(detailId);
    const isFallbackDetail = this.isAssetFallbackDetailId(normalizedDetailId, assetId, normalizedAssetType);
    const ignoreId = Number(usageIdToIgnore);
    const ignoreClause = Number.isFinite(ignoreId) && ignoreId > 0 ? 'AND id <> ?' : '';
    const ignoreParams = Number.isFinite(ignoreId) && ignoreId > 0 ? [ignoreId] : [];

    if (!normalizedDetailId || isFallbackDetail) {
      const [rows] = await pool.query<CountRow[]>(
        `SELECT COUNT(*) as count
         FROM asset_usage_logs
         WHERE asset_id = ?
           AND COALESCE(asset_type, 'medical') = ?
           AND ended_at IS NULL
           AND deleted_at IS NULL
           ${ignoreClause}`,
        [assetId, normalizedAssetType, ...ignoreParams]
      );
      return (rows[0]?.count || 0) > 0;
    }

    const fallbackIds = [`asset-${assetId}`, `asset-${normalizedAssetType}-${assetId}`];
    const [rows] = await pool.query<CountRow[]>(
      `SELECT COUNT(*) as count
       FROM asset_usage_logs
       WHERE asset_id = ?
         AND COALESCE(asset_type, 'medical') = ?
         AND ended_at IS NULL
         AND deleted_at IS NULL
         AND (asset_detail_id = ? OR asset_detail_id IS NULL OR asset_detail_id IN (?, ?))
         ${ignoreClause}`,
      [assetId, normalizedAssetType, normalizedDetailId, fallbackIds[0], fallbackIds[1], ...ignoreParams]
    );
    return (rows[0]?.count || 0) > 0;
  }

  private async hasUnvalidatedReturnedBorrowing(
    assetId: number,
    assetType: AssetType,
    detailId?: string | null
  ): Promise<boolean> {
    const normalizedAssetType = this.normalizeAssetType(assetType);
    const normalizedDetailId = this.normalizeDetailIdentifier(detailId);
    const isFallbackDetail = this.isAssetFallbackDetailId(normalizedDetailId, assetId, normalizedAssetType);

    if (!normalizedDetailId || isFallbackDetail) {
      const [rows] = await pool.query<CountRow[]>(
        `SELECT COUNT(*) as count
         FROM borrowing_records
         WHERE asset_id = ?
           AND COALESCE(asset_type, 'medical') = ?
           AND status = 'returned'
           AND return_validated_at IS NULL
           AND deleted_at IS NULL`,
        [assetId, normalizedAssetType]
      );
      return (rows[0]?.count || 0) > 0;
    }

    const fallbackIds = [`asset-${assetId}`, `asset-${normalizedAssetType}-${assetId}`];
    const [rows] = await pool.query<CountRow[]>(
      `SELECT COUNT(*) as count
       FROM borrowing_records
       WHERE asset_id = ?
         AND COALESCE(asset_type, 'medical') = ?
         AND status = 'returned'
         AND return_validated_at IS NULL
         AND deleted_at IS NULL
         AND (
           asset_detail_id = ?
           OR asset_detail_id IS NULL
           OR asset_detail_id IN (?, ?)
         )`,
      [assetId, normalizedAssetType, normalizedDetailId, fallbackIds[0], fallbackIds[1]]
    );
    return (rows[0]?.count || 0) > 0;
  }

  private async hasUsageForBorrowingId(borrowingId?: number | null): Promise<boolean> {
    if (!borrowingId) return false;

    const [rows] = await pool.query<CountRow[]>(
      `SELECT COUNT(*) as count
       FROM asset_usage_logs
       WHERE borrowing_id = ?
         AND deleted_at IS NULL`,
      [borrowingId]
    );

    return (rows[0]?.count || 0) > 0;
  }

  private async getInventoryConditionForUsage(assetId: number, assetType: AssetType, detailId?: string | null, detailCode?: string | null): Promise<string | null> {
    const normalizedAssetType = this.normalizeAssetType(assetType);
    const assetResponse = await this.assetService.getById(String(assetId), normalizedAssetType);
    if (!assetResponse.success || !assetResponse.data) return null;

    const specifications = this.parseAssetSpecifications(assetResponse.data.specifications);
    const details = Array.isArray(specifications.details) ? specifications.details : [];
    const normalizedDetailId = this.normalizeDetailIdentifier(detailId);
    const normalizedDetailCode = this.normalizeDetailIdentifier(detailCode);
    const isFallbackDetail = this.isAssetFallbackDetailId(normalizedDetailId, assetId, normalizedAssetType);

    if ((normalizedDetailId && !isFallbackDetail) || normalizedDetailCode) {
      const selectedDetail = details.find((detail) => this.matchesAssetDetail(detail, normalizedDetailId, normalizedDetailCode));
      const detailCondition = this.normalizeUsageConditionLabel(selectedDetail?.condition);
      if (detailCondition) return detailCondition;
    }

    return this.normalizeUsageConditionLabel((assetResponse.data as any).condition);
  }

  private async syncActiveBorrowingUsageLogs(): Promise<void> {
    const [rows] = await pool.query<ActiveBorrowingRow[]>(
      `SELECT b.id,
              b.asset_id,
              COALESCE(b.asset_type, 'medical') as asset_type,
              b.asset_detail_id,
              b.asset_detail_name,
              b.asset_detail_code,
              COALESCE(ma.location, na.location) as asset_location,
              b.destination_room,
              b.borrower_work_unit,
              b.user_id,
              b.borrow_date,
              b.quantity,
              b.notes
       FROM borrowing_records b
       LEFT JOIN medical_assets ma ON b.asset_id = ma.id AND COALESCE(b.asset_type, 'medical') = 'medical'
       LEFT JOIN non_medical_assets na ON b.asset_id = na.id AND b.asset_type = 'non_medical'
       WHERE b.status IN ('approved', 'borrowed', 'overdue')
       ORDER BY b.created_at DESC
       LIMIT 500`
    );

    for (const row of rows) {
      const assetId = Number(row.asset_id);
      const assetType = this.normalizeAssetType(row.asset_type);
      const detailId = this.normalizeDetailIdentifier(row.asset_detail_id);

      if (await this.hasUsageForBorrowingId(row.id)) {
        continue;
      }

      const conditionBefore = await this.getInventoryConditionForUsage(
        assetId,
        assetType,
        detailId || null,
        row.asset_detail_code || null
      );

      await this.create(
        {
          borrowingId: row.id,
          assetId,
          assetType,
          assetDetailId: detailId || undefined,
          assetDetailName: row.asset_detail_name || undefined,
          assetDetailCode: row.asset_detail_code || undefined,
          assetLocation: row.asset_location || undefined,
          roomName:
            [row.borrower_work_unit, row.destination_room || row.asset_location]
              .filter(Boolean)
              .join(' - ') || '-',
          operatorUserId: row.user_id,
          usageContext: 'other',
          startedAt: row.borrow_date,
          usageCount: row.quantity && row.quantity > 0 ? row.quantity : 1,
          conditionBefore: conditionBefore || undefined,
          notes: row.notes || undefined,
          sourceType: 'borrowing_sync',
          createdBy: row.user_id
        },
        { skipSubRoomValidation: true }
      );
    }
  }

  private async syncAssetStateAfterUsage(assetId: number, assetType: AssetType, options?: UsageSyncOptions): Promise<void> {
    const endedAt = formatDateTimeForMySQL(options?.endedAt);
    if (!endedAt) return;

    const normalizedAssetType = this.normalizeAssetType(assetType);
    const detailId = this.normalizeDetailIdentifier(options?.detailId);
    if (await this.hasActiveUsageForAssetDetail(assetId, normalizedAssetType, detailId || null, options?.usageId)) {
      return;
    }

    const hasUnvalidatedReturn = await this.hasUnvalidatedReturnedBorrowing(assetId, normalizedAssetType, detailId || null);
    if (hasUnvalidatedReturn) {
      return;
    }

    const assetResponse = await this.assetService.getById(String(assetId), normalizedAssetType);
    if (!assetResponse.success || !assetResponse.data) return;

    const specifications = this.parseAssetSpecifications(assetResponse.data.specifications);
    const details = Array.isArray(specifications.details) ? specifications.details : [];
    const detailName = this.normalizeDetailIdentifier(options?.detailName);
    const detailCode = this.normalizeDetailIdentifier(options?.detailCode);
    const isFallbackDetail = this.isAssetFallbackDetailId(detailId, assetId, normalizedAssetType);
    const shouldMatchSpecificDetail = Boolean((detailId && !isFallbackDetail) || detailCode);

    const normalizedDetailCondition = this.normalizeUsageConditionLabel(options?.conditionAfter);
    const normalizedAssetCondition = this.normalizeAssetCondition(options?.conditionAfter);
    const damagedUsage = this.isDamagedUsageCondition(options?.conditionAfter);

    if (details.length > 0) {
      let hasChanges = false;
      let matchedDetail = false;
      const updatedDetails = details.map((rawDetail: any) => {
        const detail = rawDetail && typeof rawDetail === 'object' ? { ...rawDetail } : rawDetail;
        if (!detail || typeof detail !== 'object') return rawDetail;

        const isTarget = shouldMatchSpecificDetail
          ? this.matchesAssetDetail(detail, detailId, detailCode, detailName)
          : true;

        if (!isTarget) return rawDetail;
        matchedDetail = true;

        const nextStatus = damagedUsage ? 'Dalam Perbaikan' : 'Tersedia';
        const nextCondition = damagedUsage ? 'Rusak' : (normalizedDetailCondition || detail.condition || 'Baik');

        if (detail.status !== nextStatus) {
          detail.status = nextStatus;
          hasChanges = true;
        }

        if (detail.condition !== nextCondition) {
          detail.condition = nextCondition;
          hasChanges = true;
        }

        return detail;
      });

      if (hasChanges) {
        await this.assetService.update(
          String(assetId),
          { specifications: { ...specifications, details: updatedDetails } },
          normalizedAssetType
        );
      }

      if (shouldMatchSpecificDetail && matchedDetail) {
        return;
      }
    }

    const assetUpdate: Record<string, any> = {
      status: damagedUsage ? 'maintenance' : 'available'
    };

    if (normalizedAssetCondition) {
      assetUpdate.condition = normalizedAssetCondition;
    }

    await this.assetService.update(String(assetId), assetUpdate, normalizedAssetType);
  }

  private async syncBorrowingReturnAfterUsageComplete(log: AssetUsageLog): Promise<void> {
    const endedAt = formatDateTimeForMySQL(log.endedAt);
    if (!endedAt) return;

    const operatorId = log.operatorUserId ? Number(log.operatorUserId) : null;
    const conditionAfter = this.normalizeUsageConditionLabel(log.conditionAfter || log.conditionBefore) || 'Baik';
    const explicitBorrowingId = Number(log.borrowingId || (log as any).borrowing_id || 0);

    if (explicitBorrowingId) {
      await pool.query(
        `UPDATE borrowing_records
         SET status = 'returned',
             return_date = ?,
             return_condition = ?,
             return_notes = ?,
             returned_by = COALESCE(returned_by, ?),
             updated_at = NOW()
         WHERE id = ?
           AND status IN ('approved', 'borrowed', 'overdue')`,
        [
          endedAt,
          conditionAfter,
          log.notes || null,
          operatorId,
          explicitBorrowingId
        ]
      );
      return;
    }

    // A usage log with no borrowing_id was created directly in Pemakaian, not
    // from a Peminjaman/Pengembalian flow. It must never auto-complete or
    // auto-return an unrelated borrowing record just because it happens to
    // match the same asset/detail/operator — that linkage is only valid when
    // the usage log was generated from a borrowing in the first place.
  }

  private async markAssetDetailInUse(assetId: number, assetType: AssetType, options?: UsageSyncOptions): Promise<void> {
    const normalizedAssetType = this.normalizeAssetType(assetType);
    const assetResponse = await this.assetService.getById(String(assetId), normalizedAssetType);
    if (!assetResponse.success || !assetResponse.data) return;

    const specifications = this.parseAssetSpecifications(assetResponse.data.specifications);
    const details = Array.isArray(specifications.details) ? specifications.details : [];
    const detailId = this.normalizeDetailIdentifier(options?.detailId);
    const detailCode = this.normalizeDetailIdentifier(options?.detailCode);
    const isFallbackDetail = this.isAssetFallbackDetailId(detailId, assetId, normalizedAssetType);
    const shouldMatchSpecificDetail = Boolean((detailId && !isFallbackDetail) || detailCode);

    if (details.length > 0) {
      let hasChanges = false;
      const updatedDetails = details.map((rawDetail: any) => {
        const detail = rawDetail && typeof rawDetail === 'object' ? { ...rawDetail } : rawDetail;
        if (!detail || typeof detail !== 'object') return rawDetail;

        const isTarget = shouldMatchSpecificDetail
          ? this.matchesAssetDetail(detail, detailId, detailCode)
          : false;

        if (!isTarget) return rawDetail;

        if (detail.status !== 'Sedang Digunakan' && detail.status !== 'Dalam Penggunaan') {
          // prefer a readable Indonesian label
          detail.status = 'Sedang Digunakan';
          hasChanges = true;
        }

        return detail;
      });

      if (hasChanges) {
        await this.assetService.update(
          String(assetId),
          { specifications: { ...specifications, details: updatedDetails } },
          normalizedAssetType
        );
      }

      if (shouldMatchSpecificDetail) return;
    }

    // If no specific detail matched or no details exist, mark master as borrowed so UI shows it's unavailable
    await this.assetService.updateStatus(String(assetId), 'borrowed', normalizedAssetType);
  }
  async getAll(filters: AssetUsageFilters): Promise<PaginatedResponse<AssetUsageLog>> {
    if (process.env.ASSET_USAGE_SYNC_ON_READ === 'true') {
      await this.syncActiveBorrowingUsageLogs();
    }

    const { page, limit, assetId, assetType, roomName, usageContext, dateFrom, dateTo } = filters;
    const offset = (page - 1) * limit;

    let query = `
      SELECT l.*,
        COALESCE(NULLIF(l.asset_detail_name, ''), ma.name, na.name) as asset_name,
        COALESCE(NULLIF(l.asset_detail_code, ''), ma.asset_code, na.asset_code) as asset_code,
        COALESCE(ma.location, na.location) as asset_location,
        op.name as operator_name,
        op.nip as operator_nip,
        op.role as operator_role,
        creator.name as created_by_name
      FROM asset_usage_logs l
      LEFT JOIN medical_assets ma ON l.asset_type = 'medical' AND l.asset_id = ma.id
      LEFT JOIN non_medical_assets na ON l.asset_type = 'non_medical' AND l.asset_id = na.id
      LEFT JOIN users op ON l.operator_user_id = op.id
      LEFT JOIN users creator ON l.created_by = creator.id
      WHERE l.deleted_at IS NULL
    `;
    let countQuery = 'SELECT COUNT(*) as count FROM asset_usage_logs WHERE deleted_at IS NULL';
    const params: any[] = [];

    if (assetId) {
      query += ' AND l.asset_id = ?';
      countQuery += ' AND asset_id = ?';
      params.push(assetId);
    }

    if (assetType) {
      query += ' AND l.asset_type = ?';
      countQuery += ' AND asset_type = ?';
      params.push(assetType);
    }

    if (roomName) {
      query += ' AND l.room_name LIKE ?';
      countQuery += ' AND room_name LIKE ?';
      params.push(`%${roomName}%`);
    }

    if (usageContext) {
      query += ' AND l.usage_context = ?';
      countQuery += ' AND usage_context = ?';
      params.push(usageContext);
    }

    if (dateFrom) {
      query += ' AND l.started_at >= ?';
      countQuery += ' AND started_at >= ?';
      params.push(formatDateTimeForMySQL(`${dateFrom} 00:00:00`));
    }

    if (dateTo) {
      query += ' AND l.started_at <= ?';
      countQuery += ' AND started_at <= ?';
      params.push(formatDateTimeForMySQL(`${dateTo} 23:59:59`));
    }

    const countParams = [...params];
    query += ' ORDER BY l.started_at DESC, l.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await pool.query<AssetUsageRow[]>(query, params);
    const [countRows] = await pool.query<CountRow[]>(countQuery, countParams);
    const total = countRows[0]?.count || 0;

    return {
      success: true,
      message: 'Asset usage logs retrieved successfully',
      data: rows.map(mapUsageRow),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    };
  }

  async getById(id: string): Promise<ApiResponse<AssetUsageLog>> {
    const [rows] = await pool.query<AssetUsageRow[]>(
      `SELECT l.*,
        COALESCE(NULLIF(l.asset_detail_name, ''), ma.name, na.name) as asset_name,
        COALESCE(NULLIF(l.asset_detail_code, ''), ma.asset_code, na.asset_code) as asset_code,
        COALESCE(ma.location, na.location) as asset_location,
        op.name as operator_name,
        op.nip as operator_nip,
        op.role as operator_role,
        creator.name as created_by_name
       FROM asset_usage_logs l
       LEFT JOIN medical_assets ma ON l.asset_type = 'medical' AND l.asset_id = ma.id
       LEFT JOIN non_medical_assets na ON l.asset_type = 'non_medical' AND l.asset_id = na.id
       LEFT JOIN users op ON l.operator_user_id = op.id
       LEFT JOIN users creator ON l.created_by = creator.id
       WHERE l.id = ?
         AND l.deleted_at IS NULL`,
      [id]
    );

    if (rows.length === 0) {
      return { success: false, message: 'Asset usage log not found' };
    }

    return { success: true, message: 'Asset usage log retrieved successfully', data: mapUsageRow(rows[0]) };
  }

  async create(data: CreateAssetUsageLogDTO, options: CreateAssetUsageOptions = {}): Promise<ApiResponse<AssetUsageLog>> {
    const startedAt = formatDateTimeForMySQL(data.startedAt);
    const endedAt = formatDateTimeForMySQL(data.endedAt);
    if (!startedAt) {
      return { success: false, message: 'Tanggal mulai penggunaan tidak valid' };
    }
    if (endedAt && new Date(endedAt).getTime() < new Date(startedAt).getTime()) {
      return { success: false, message: 'Waktu selesai tidak boleh lebih awal dari waktu mulai' };
    }

    if (data.borrowingId && data.endedAt) {
      return {
        success: false,
        message: 'Asset dari peminjaman tidak dapat langsung diselesaikan saat pembuatan usage log. Harus melalui proses pengembalian peminjaman yang terpisah.'
      };
    }

    const operatorValidation = await this.validateOperatorExists(data.operatorUserId);
    if (operatorValidation) return operatorValidation;

    if (!options.skipSubRoomValidation) {
      const subRoomValidation = await this.validateUsageSubRoomAccess(data);
      if (subRoomValidation) return subRoomValidation;
    }

    const overdueEmergencyValidation = await this.validateOverdueEmergencyAccess(data);
    if (overdueEmergencyValidation) return overdueEmergencyValidation;

    const lockValidation = await this.validateAssetNotLocked(data);
    if (lockValidation) return lockValidation;

    const generatedNo = data.no || generateUsageNumber(data.startedAt);

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO asset_usage_logs (
        no, borrowing_id, asset_id, asset_type, asset_detail_id, asset_detail_name, asset_detail_code,
        asset_location, room_name, operator_user_id, usage_context, started_at,
        ended_at, usage_count, condition_before, condition_after, notes, source_type, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        generatedNo,
        data.borrowingId || null,
        data.assetId,
        data.assetType || 'medical',
        data.assetDetailId || null,
        data.assetDetailName || null,
        data.assetDetailCode || null,
        data.assetLocation || null,
        data.roomName,
        data.operatorUserId || null,
        data.usageContext || 'own_room',
        startedAt,
        endedAt,
        data.usageCount || 1,
        data.conditionBefore || null,
        data.conditionAfter || null,
        data.notes || null,
        data.sourceType || (data.borrowingId ? 'borrowing_sync' : 'manual'),
        data.createdBy
      ]
    );

    if (data.endedAt) {
      await this.syncAssetStateAfterUsage(data.assetId, data.assetType || 'medical', {
        usageId: result.insertId,
        detailId: data.assetDetailId,
        detailName: data.assetDetailName,
        detailCode: data.assetDetailCode,
        conditionAfter: data.conditionAfter,
        endedAt: data.endedAt
      });
    } else if (!data.borrowingId) {
      // mark the detail/master as in-use so UI shows "Sedang Digunakan"
      await this.markAssetDetailInUse(data.assetId, data.assetType || 'medical', {
        detailId: data.assetDetailId,
        detailName: data.assetDetailName,
        detailCode: data.assetDetailCode
      });
    }

    return this.getById(String(result.insertId));
  }

  async update(id: string, data: UpdateAssetUsageLogDTO, options: UpdateAssetUsageOptions = {}): Promise<ApiResponse<AssetUsageLog>> {
    const existingLog = await this.getById(id);
    if (!existingLog.success || !existingLog.data) {
      return existingLog;
    }

    const isCompleting = data.endedAt !== undefined && data.endedAt !== null && !existingLog.data.endedAt;
    const hasActorContext = data.actorId !== undefined || data.actorRole !== undefined;

    if (
      hasActorContext &&
      !canCompleteUsage(data.actorRole, data.actorId, existingLog.data.operatorUserId, existingLog.data.createdBy)
    ) {
      return {
        success: false,
        message: isCompleting
          ? 'Menyelesaikan penggunaan hanya dapat dilakukan oleh admin, leader, atau pengguna pemilik riwayat pemakaian.'
          : 'Mengubah penggunaan hanya dapat dilakukan oleh admin, leader, atau pengguna pemilik riwayat pemakaian.'
      };
    }

    if (isCompleting && existingLog.data.borrowingId && !options.allowBorrowingCompletion) {
      return {
        success: false,
        message: 'Asset dari peminjaman harus diselesaikan melalui proses pengembalian peminjaman (PATCH /api/borrowing/:id/return), bukan melalui selesai penggunaan. Alasan: Pengembalian alat harus divalidasi oleh admin/leader sebelum alat tersedia kembali.'
      };
    }

    const nextStartedAt = formatDateTimeForMySQL(data.startedAt ?? existingLog.data.startedAt);
    const nextEndedAt = data.endedAt === undefined
      ? formatDateTimeForMySQL(existingLog.data.endedAt)
      : formatDateTimeForMySQL(data.endedAt);
    if (!nextStartedAt) {
      return { success: false, message: 'Tanggal mulai penggunaan tidak valid' };
    }
    if (data.endedAt && !nextEndedAt) {
      return { success: false, message: 'Tanggal selesai penggunaan tidak valid' };
    }
    if (nextEndedAt && nextEndedAt < nextStartedAt) {
      return { success: false, message: 'Waktu selesai tidak boleh lebih awal dari waktu mulai' };
    }

    if (
      data.roomName !== undefined &&
      data.roomName !== existingLog.data.roomName &&
      existingLog.data.sourceType !== 'borrowing_sync' &&
      data.actorId
    ) {
      const subRoomValidation = await this.validateUsageSubRoomAccess({
        assetId: existingLog.data.assetId,
        assetType: existingLog.data.assetType,
        assetDetailId: existingLog.data.assetDetailId,
        assetDetailCode: existingLog.data.assetDetailCode,
        assetDetailName: existingLog.data.assetDetailName,
        roomName: data.roomName,
        startedAt: existingLog.data.startedAt,
        createdBy: data.actorId
      });
      if (subRoomValidation) return subRoomValidation;
    }

    if (data.operatorUserId !== undefined && data.operatorUserId !== null) {
      const operatorValidation = await this.validateOperatorExists(data.operatorUserId);
      if (operatorValidation) return operatorValidation;
    }

    const fields: string[] = [];
    const values: any[] = [];

    const add = (field: string, value: any) => {
      fields.push(`${field} = ?`);
      values.push(value);
    };

    if (data.roomName !== undefined) add('room_name', data.roomName);
    if (data.operatorUserId !== undefined) add('operator_user_id', data.operatorUserId);
    if (data.usageContext !== undefined) add('usage_context', data.usageContext);
    if (data.startedAt !== undefined) add('started_at', formatDateTimeForMySQL(data.startedAt));
    if (data.endedAt !== undefined) add('ended_at', data.endedAt ? formatDateTimeForMySQL(data.endedAt) : null);
    if (data.usageCount !== undefined) add('usage_count', data.usageCount);
    if (data.conditionBefore !== undefined) add('condition_before', data.conditionBefore);
    if (data.conditionAfter !== undefined) add('condition_after', data.conditionAfter);
    if (data.notes !== undefined) add('notes', data.notes);

    if (fields.length === 0) {
      return this.getById(id);
    }

    values.push(id);
    await pool.query(`UPDATE asset_usage_logs SET ${fields.join(', ')} WHERE id = ?`, values);

    const updatedLog = await this.getById(id);
    if (updatedLog.success && updatedLog.data?.endedAt) {
      await this.syncAssetStateAfterUsage(updatedLog.data.assetId, updatedLog.data.assetType, {
        usageId: updatedLog.data.id,
        detailId: updatedLog.data.assetDetailId,
        detailName: updatedLog.data.assetDetailName,
        detailCode: updatedLog.data.assetDetailCode,
        conditionAfter: updatedLog.data.conditionAfter,
        endedAt: updatedLog.data.endedAt
      });

      if (!existingLog.data.endedAt && data.endedAt !== undefined) {
        try {
          await this.syncBorrowingReturnAfterUsageComplete(updatedLog.data);
        } catch (error) {
          logger.warn('Failed to sync borrowing return after usage completion', { error });
        }
      }
    }

    return this.getById(id);
  }

  async delete(id: string, deletedBy?: number, deleteReason?: string): Promise<ApiResponse> {
    const existingLog = await this.getById(id);
    if (!existingLog.success || !existingLog.data) {
      return existingLog;
    }
    if (!deleteReason?.trim()) {
      return { success: false, message: 'Alasan pengarsipan wajib diisi' };
    }

    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE asset_usage_logs
       SET deleted_at = NOW(), deleted_by = ?, delete_reason = ?, updated_at = NOW()
       WHERE id = ? AND deleted_at IS NULL`,
      [deletedBy ?? null, deleteReason?.trim() || null, id]
    );
    if (result.affectedRows === 0) {
      return { success: false, message: 'Asset usage log not found' };
    }

    if (!existingLog.data.endedAt && !existingLog.data.borrowingId) {
      await this.syncAssetStateAfterUsage(existingLog.data.assetId, existingLog.data.assetType, {
        usageId: existingLog.data.id,
        detailId: existingLog.data.assetDetailId,
        detailName: existingLog.data.assetDetailName,
        detailCode: existingLog.data.assetDetailCode,
        conditionAfter: existingLog.data.conditionAfter || existingLog.data.conditionBefore,
        endedAt: new Date()
      });
    }
    return { success: true, message: 'Riwayat penggunaan aset diarsipkan' };
  }
}
