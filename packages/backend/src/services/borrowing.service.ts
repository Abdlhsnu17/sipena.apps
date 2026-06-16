import { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../config/database';
import {
    ApiResponse,
    Borrowing,
    BorrowingFilters,
    CreateBorrowingDTO,
    ExtendBorrowingDTO,
    PaginatedResponse,
    ReturnBorrowingDTO,
    UpdateBorrowingDTO
} from '../models';
import {
    buildOverdueSanctionNote,
    formatDateTimeForMySQL,
    generateBorrowingCode,
    getOverdueDays
} from '../utils/helpers';
import { AssetService } from './asset.service';
import { AssetUsageService } from './asset_usage.service';
import { sendBorrowingApprovedEmail, sendBorrowingRejectedEmail } from './email.service';
import { hasAnyRole } from '../utils/role';

/**
 * Parse datetime string as LOCAL time (not UTC)
 * Expects format: "YYYY-MM-DD HH:mm:ss" or "YYYY-MM-DDTHH:mm:ss"
 */
const normalizeDateInput = (value?: string | Date): Date | undefined => {
  if (value === undefined || value === null) return undefined;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }
  
  const raw = String(value).trim();
  if (!raw) return undefined;
  
  // Replace T with space for consistency
  const normalized = raw.replace('T', ' ');
  
  // Match: YYYY-MM-DD HH:mm:ss or YYYY-MM-DD HH:mm
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) {
    // Fallback to native parsing for other formats
    const fallback = new Date(raw);
    return Number.isNaN(fallback.getTime()) ? undefined : fallback;
  }
  
  const [, year, month, day, hour, minute, second = "0"] = match;
  // Create date in LOCAL timezone (not UTC)
  const parsed = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  );
  
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const normalizeOptionalText = (value?: string | null): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const normalizeComparableText = (value?: string | null): string => {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').toLowerCase() : '';
};

const borrowingDateFields = [
  'borrow_date',
  'due_date',
  'return_date',
  'approved_at',
  'rejected_at',
  'sanction_applied_at',
  'created_at',
  'updated_at',
  'return_validated_at'
] as const;

export const normalizeBorrowingDateFields = <T extends Record<string, any>>(row: T): T => {
  const nextRow: Record<string, any> = { ...row };

  for (const field of borrowingDateFields) {
    if (nextRow[field] === undefined) continue;
    nextRow[field] = formatDateTimeForMySQL(nextRow[field]) ?? nextRow[field];
  }

  return nextRow as T;
};

// Interface untuk hasil query gabungan
interface BorrowingRow extends RowDataPacket, Borrowing {
  asset_name: string;
  asset_code: string;
  asset_location: string;
  asset_image?: string; // Opsional jika ada
  returned_by_name?: string;
  returned_by_nip?: string;
}

interface BlockingBorrowingRow extends RowDataPacket {
  id: number;
  borrowing_code?: string | null;
  asset_name?: string | null;
  asset_detail_name?: string | null;
  due_date?: Date | string | null;
  status?: string | null;
  sanction_status?: string | null;
  extension_count?: number | null;
  is_extension_blocked?: boolean | null;
}

interface CountRow extends RowDataPacket {
  count: number;
}

interface ColumnCountRow extends RowDataPacket {
  count: number;
}

interface ActiveUsageRow extends RowDataPacket {
  id: number;
  ended_at?: Date | string | null;
}

export class BorrowingService {
  private assetService: AssetService;
  private readonly activeBorrowingStatuses = ['pending', 'approved', 'borrowed', 'overdue'] as const;
  private readonly activeMaintenanceStatuses = ['requested', 'scheduled', 'in_progress'] as const;
  private sanctionColumnsAvailable: boolean | null = null;

  constructor() {
    this.assetService = new AssetService();
    this.assetUsageService = new AssetUsageService();
  }

  private assetUsageService: AssetUsageService;

  private getBorrowerWorkUnit(borrowing: any): string {
    return (
      borrowing.borrowerWorkUnit
      ?? borrowing.borrower_work_unit
      ?? borrowing.borrowerCurrentWorkUnit
      ?? borrowing.borrower_current_work_unit
      ?? ''
    );
  }

  private validateStaffPjSameInstallation(
    borrowing: any,
    actorRole: string | null | undefined,
    actorWorkUnit: string | null | undefined,
    actionLabel: 'memperpanjang' | 'mengembalikan'
  ): string | null {
    if (!hasAnyRole(actorRole, ['staff_pj', 'staff pj'])) return null;

    const normalizedActorWorkUnit = normalizeComparableText(actorWorkUnit);
    if (!normalizedActorWorkUnit) {
      return `Staff PJ wajib mengisi Unit Kerja / Instalasi di pengaturan akun sebelum ${actionLabel} peminjaman.`;
    }

    const normalizedBorrowerWorkUnit = normalizeComparableText(this.getBorrowerWorkUnit(borrowing));
    if (!normalizedBorrowerWorkUnit) {
      return `Instalasi peminjam belum terisi, sehingga Staff PJ belum dapat ${actionLabel} peminjaman ini.`;
    }

    if (normalizedActorWorkUnit !== normalizedBorrowerWorkUnit) {
      return `Staff PJ hanya dapat ${actionLabel} peminjaman dari instalasi yang sama.`;
    }

    return null;
  }

  private async hasActiveUsage(
    assetId: number,
    assetType: string,
    detailId?: string | null
  ): Promise<boolean> {
    const normalizedDetailId = this.normalizeDetailIdentifier(detailId);
    const isFallback = this.isAssetFallbackDetailId(normalizedDetailId, assetId, assetType);

    if (!normalizedDetailId || isFallback) {
      const [rows] = await pool.query<CountRow[]>(
        `SELECT COUNT(*) as count FROM asset_usage_logs WHERE asset_id = ? AND COALESCE(asset_type,'medical') = ? AND ended_at IS NULL`,
        [assetId, assetType]
      );
      return (rows[0]?.count || 0) > 0;
    }

    const fallbackIds = this.getAssetFallbackDetailIds(assetId, assetType);
    const [rows] = await pool.query<CountRow[]>(
      `SELECT COUNT(*) as count FROM asset_usage_logs WHERE asset_id = ? AND COALESCE(asset_type,'medical') = ? AND ended_at IS NULL AND (
         asset_detail_id = ? OR asset_detail_id IS NULL OR asset_detail_id IN (?, ?)
       )`,
      [assetId, assetType, normalizedDetailId, fallbackIds[0], fallbackIds[1]]
    );
    return (rows[0]?.count || 0) > 0;
  }

  private buildUsageDetailWhere(
    assetId: number,
    assetType: string,
    detailId?: string | null
  ): { clause: string; params: any[] } {
    const normalizedDetailId = this.normalizeDetailIdentifier(detailId);
    const isFallback = this.isAssetFallbackDetailId(normalizedDetailId, assetId, assetType);

    if (!normalizedDetailId || isFallback) {
      return {
        clause: '',
        params: []
      };
    }

    return {
      clause: 'AND asset_detail_id = ?',
      params: [normalizedDetailId]
    };
  }

  private async ensureUsageLogForBorrowing(data: {
    borrowingId?: string | number | null;
    assetId: number;
    assetType: string;
    assetDetailId?: string | null;
    assetDetailName?: string | null;
    assetDetailCode?: string | null;
    assetLocation?: string | null;
    roomName?: string | null;
    operatorUserId?: number | null;
    startedAt?: string | Date | null;
    usageCount?: number | null;
    notes?: string | null;
    createdBy?: number | null;
  }): Promise<void> {
    const assetId = Number(data.assetId);
    const assetType = data.assetType || 'medical';
    const detailId = this.normalizeDetailIdentifier(data.assetDetailId);
    const borrowingId = data.borrowingId ? Number(data.borrowingId) : null;

    if (borrowingId) {
      const [existingUsageRows] = await pool.query<RowDataPacket[]>(
        'SELECT id FROM asset_usage_logs WHERE borrowing_id = ? LIMIT 1',
        [borrowingId]
      );
      if (existingUsageRows.length > 0) return;
    }

    if (await this.hasActiveUsage(assetId, assetType, detailId || null)) {
      return;
    }

    const startedAt = normalizeDateInput(data.startedAt as any) || new Date();
    const roomName = normalizeOptionalText(data.roomName) || normalizeOptionalText(data.assetLocation) || '-';
    const actorId = Number(data.createdBy || data.operatorUserId || 0);
    const conditionBefore = await this.getInventoryConditionForUsage(
      assetId,
      assetType,
      detailId || null,
      data.assetDetailCode || null
    );

    if (!actorId) return;

    const usageResponse = await this.assetUsageService.create(
      {
        borrowingId: borrowingId || undefined,
        assetId,
        assetType: assetType as any,
        assetDetailId: detailId || undefined,
        assetDetailName: data.assetDetailName || undefined,
        assetDetailCode: data.assetDetailCode || undefined,
        assetLocation: data.assetLocation || undefined,
        roomName,
        operatorUserId: data.operatorUserId || undefined,
        usageContext: 'other',
        startedAt,
        usageCount: data.usageCount && data.usageCount > 0 ? data.usageCount : 1,
        conditionBefore: conditionBefore || undefined,
        notes: data.notes || undefined,
        createdBy: actorId
      },
      { skipSubRoomValidation: true }
    );

    if (!usageResponse.success) {
      throw new Error(usageResponse.message || 'Gagal membuat riwayat penggunaan alat');
    }
  }

  private async completeUsageLogForBorrowing(data: {
    borrowingId?: string | number | null;
    assetId: number;
    assetType: string;
    assetDetailId?: string | null;
    operatorUserId?: number | null;
    conditionAfter?: string | null;
    notes?: string | null;
  }): Promise<void> {
    const assetId = Number(data.assetId);
    const assetType = data.assetType || 'medical';
    const detailWhere = this.buildUsageDetailWhere(assetId, assetType, data.assetDetailId);
    const operatorId = data.operatorUserId ? Number(data.operatorUserId) : null;
    const operatorClause = operatorId ? 'AND operator_user_id = ?' : '';
    const borrowingId = data.borrowingId ? Number(data.borrowingId) : null;
    const params = [
      assetId,
      assetType,
      ...detailWhere.params,
      ...(operatorId ? [operatorId] : [])
    ];

    let rows: ActiveUsageRow[] = [];

    if (borrowingId) {
      [rows] = await pool.query<ActiveUsageRow[]>(
        `SELECT id, ended_at
         FROM asset_usage_logs
         WHERE borrowing_id = ?
         ORDER BY COALESCE(ended_at, started_at) DESC, created_at DESC
         LIMIT 1`,
        [borrowingId]
      );
    }

    if (rows.length === 0) {
      [rows] = await pool.query<ActiveUsageRow[]>(
      `SELECT id, ended_at
       FROM asset_usage_logs
       WHERE asset_id = ?
         AND COALESCE(asset_type, 'medical') = ?
         AND ended_at IS NULL
         ${detailWhere.clause}
         ${operatorClause}
       ORDER BY started_at DESC, created_at DESC
       LIMIT 1`,
        params
      );
    }

    if (rows.length === 0) {
      [rows] = await pool.query<ActiveUsageRow[]>(
        `SELECT id, ended_at
         FROM asset_usage_logs
         WHERE asset_id = ?
           AND COALESCE(asset_type, 'medical') = ?
           ${detailWhere.clause}
           ${operatorClause}
         ORDER BY COALESCE(ended_at, started_at) DESC, created_at DESC
         LIMIT 1`,
        params
      );
    }

    const usageLog = rows[0];
    if (!usageLog?.id) return;

    const updateData: any = {
      conditionAfter: data.conditionAfter || 'Baik',
      notes: data.notes || undefined
    };

    if (!usageLog.ended_at) {
      updateData.endedAt = new Date();
    }

    await this.assetUsageService.update(String(usageLog.id), updateData);
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

  private normalizeDetailIdentifier(value?: string | number | null): string {
    if (value === undefined || value === null) return '';
    return String(value).trim();
  }

  private getAssetFallbackDetailIds(assetId: number, assetType: string = 'medical'): string[] {
    const normalizedAssetType = assetType === 'non_medical' ? 'non_medical' : 'medical';
    return [`asset-${assetId}`, `asset-${normalizedAssetType}-${assetId}`];
  }

  private isAssetFallbackDetailId(
    detailId?: string | null,
    assetId?: number,
    assetType?: string
  ): boolean {
    if (!detailId || !assetId) return false;
    return this.getAssetFallbackDetailIds(assetId, assetType).includes(this.normalizeDetailIdentifier(detailId));
  }

  private matchesAssetDetail(
    detail: Record<string, any>,
    detailId?: string | null,
    detailCode?: string | null
  ): boolean {
    const normalizedTargetId = this.normalizeDetailIdentifier(detailId);
    const normalizedTargetCode = this.normalizeDetailIdentifier(detailCode);
    const detailCandidates = [
      this.normalizeDetailIdentifier(detail.id),
      this.normalizeDetailIdentifier(detail.noId),
      this.normalizeDetailIdentifier(detail.noID),
      this.normalizeDetailIdentifier(detail.no_id),
      this.normalizeDetailIdentifier(detail.detailId),
      this.normalizeDetailIdentifier(detail.assetDetailId),
      this.normalizeDetailIdentifier(detail.inventoryCode),
      this.normalizeDetailIdentifier(detail.itemCode),
      this.normalizeDetailIdentifier(detail.code),
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

    return false;
  }

  private isStaleBorrowedDetailStatus(status?: string | null): boolean {
    const normalized = String(status || '').toLowerCase();
    return normalized.includes('dipinjam') || normalized.includes('borrowed');
  }

  private isStaleMaintenanceDetailStatus(status?: string | null): boolean {
    const normalized = String(status || '').toLowerCase();
    return normalized.includes('perbaikan') || normalized.includes('maintenance');
  }

  private isInUseAssetStatus(status?: string | null): boolean {
    const normalized = String(status || '').toLowerCase();
    return [
      'sedang digunakan',
      'dalam penggunaan',
      'in_use',
      'in use'
    ].some((value) => normalized.includes(value));
  }

  private isDamagedReturnCondition(condition?: string | null): boolean {
    const normalized = String(condition || '').toLowerCase();
    return normalized.includes('rusak') || normalized.includes('damaged') || normalized.includes('broken');
  }

  private normalizeInventoryConditionLabel(condition?: string | null): string | null {
    const normalized = String(condition || '').trim().toLowerCase();
    if (!normalized) return null;
    if (normalized.includes('rusak') || normalized.includes('damaged') || normalized.includes('broken')) return 'Rusak';
    if (normalized.includes('cukup') || normalized.includes('fair')) return 'Cukup';
    if (normalized.includes('poor') || normalized.includes('buruk') || normalized.includes('kurang')) return 'Cukup';
    if (normalized.includes('baik') || normalized.includes('good')) return 'Baik';
    return String(condition).trim();
  }

  private async getInventoryConditionForUsage(
    assetId: number,
    assetType: string,
    detailId?: string | null,
    detailCode?: string | null
  ): Promise<string | null> {
    const normalizedAssetType = assetType === 'non_medical' ? 'non_medical' : 'medical';
    const assetResponse = await this.assetService.getById(String(assetId), normalizedAssetType);
    if (!assetResponse.success || !assetResponse.data) return null;

    const normalizedDetailId = this.normalizeDetailIdentifier(detailId);
    const normalizedDetailCode = this.normalizeDetailIdentifier(detailCode);
    const isFallbackDetail = this.isAssetFallbackDetailId(normalizedDetailId, assetId, normalizedAssetType);
    const assetDetails = this.getAssetDetails(assetResponse.data.specifications);

    if ((normalizedDetailId && !isFallbackDetail) || normalizedDetailCode) {
      const selectedDetail = normalizedDetailId && !isFallbackDetail
        ? this.findDetailById(assetDetails, normalizedDetailId)
        : this.findDetailById(assetDetails, normalizedDetailCode);
      const detailCondition = this.normalizeInventoryConditionLabel(selectedDetail?.condition);
      if (detailCondition) return detailCondition;
    }

    return this.normalizeInventoryConditionLabel((assetResponse.data as any).condition);
  }

  private isBorrowingLockStatus(status?: string | null, returnValidatedAt?: string | Date | null): boolean {
    const normalizedStatus = String(status || '').toLowerCase();
    if (this.activeBorrowingStatuses.includes(normalizedStatus as any)) {
      return true;
    }

    return normalizedStatus === 'returned' && !returnValidatedAt;
  }

  private getBorrowingLockWhereClause(statusColumn: string, returnValidatedColumn: string): string {
    return `(${statusColumn} IN ('pending', 'approved', 'borrowed', 'overdue') OR (${statusColumn} = 'returned' AND ${returnValidatedColumn} IS NULL))`;
  }

  private async hasSanctionColumns(): Promise<boolean> {
    if (this.sanctionColumnsAvailable !== null) {
      return this.sanctionColumnsAvailable;
    }

    try {
      const [rows] = await pool.query<ColumnCountRow[]>(
        `SELECT COUNT(*) as count
         FROM information_schema.columns
         WHERE table_schema = DATABASE()
           AND table_name = 'borrowing_records'
           AND column_name IN ('overdue_days', 'sanction_status', 'sanction_notes', 'sanction_applied_at')`
      );

      this.sanctionColumnsAvailable = Number(rows[0]?.count || 0) === 4;
    } catch {
      this.sanctionColumnsAvailable = false;
    }

    return this.sanctionColumnsAvailable;
  }

  private async syncOverdueBorrowings(): Promise<void> {
    const hasSanctionColumns = await this.hasSanctionColumns();

    if (!hasSanctionColumns) {
      await pool.query(
        `UPDATE borrowing_records
         SET status = 'overdue', updated_at = NOW()
         WHERE status IN ('approved', 'borrowed')
           AND deleted_at IS NULL
           AND due_date IS NOT NULL
           AND NOW() > due_date`
      );
      return;
    }

    await pool.query(
      `UPDATE borrowing_records
       SET status = 'overdue',
           overdue_days = CASE
             WHEN due_date IS NULL OR NOW() <= due_date THEN 0
             ELSE CEIL(TIMESTAMPDIFF(SECOND, due_date, NOW()) / 86400)
           END,
           sanction_status = 'active',
           sanction_notes = CASE
             WHEN due_date IS NULL OR NOW() <= due_date THEN sanction_notes
             ELSE CONCAT('Terlambat ', CEIL(TIMESTAMPDIFF(SECOND, due_date, NOW()) / 86400), ' hari')
           END,
           sanction_applied_at = COALESCE(sanction_applied_at, NOW()),
           updated_at = NOW()
       WHERE status IN ('approved', 'borrowed')
         AND deleted_at IS NULL
         AND due_date IS NOT NULL
         AND NOW() > due_date`
    );
  }

  private getOverdueBorrowingInfo(dueDate?: Date | string | null, referenceDate: Date = new Date()): {
    overdueDays: number;
    sanctionStatus: 'none' | 'active' | 'resolved';
    sanctionNotes: string | null;
    sanctionAppliedAt: Date | null;
  } {
    const overdueDays = getOverdueDays(dueDate, referenceDate);
    if (!overdueDays) {
      return {
        overdueDays: 0,
        sanctionStatus: 'none',
        sanctionNotes: null,
        sanctionAppliedAt: null
      };
    }

    return {
      overdueDays,
      sanctionStatus: 'active',
      sanctionNotes: buildOverdueSanctionNote(overdueDays),
      sanctionAppliedAt: referenceDate
    };
  }

  private async getBlockingBorrowing(userId: number): Promise<BlockingBorrowingRow | null> {
    const [rows] = await pool.query<BlockingBorrowingRow[]>(
      `SELECT b.id,
              b.borrowing_code,
              b.asset_detail_name,
              b.due_date,
              b.status,
              b.sanction_status,
              b.extension_count,
              b.is_extension_blocked,
              COALESCE(b.asset_detail_name, ma.name, na.name) as asset_name
       FROM borrowing_records b
       LEFT JOIN medical_assets ma
         ON b.asset_id = ma.id
         AND (b.asset_type = 'medical' OR b.asset_type IS NULL)
       LEFT JOIN non_medical_assets na
         ON b.asset_id = na.id
         AND b.asset_type = 'non_medical'
       WHERE b.user_id = ?
         AND b.deleted_at IS NULL
         AND b.status IN ('approved', 'borrowed', 'overdue')
         AND b.due_date IS NOT NULL
         AND NOW() > b.due_date
       ORDER BY b.due_date ASC, b.created_at ASC
       LIMIT 1`,
      [userId]
    );

    return rows[0] ?? null;
  }

  private buildBorrowingLockMessage(blockingBorrowing: BlockingBorrowingRow): string {
    const borrowingCode = blockingBorrowing.borrowing_code?.trim();
    const assetName =
      blockingBorrowing.asset_detail_name?.trim() ||
      blockingBorrowing.asset_name?.trim() ||
      'alat yang belum dikembalikan';
    const dueDateLabel = formatDateTimeForMySQL(blockingBorrowing.due_date ?? null);
    const reference = borrowingCode ? ` (${borrowingCode})` : '';
    const dueDateSegment = dueDateLabel ? ` sejak ${dueDateLabel}` : '';
    const status = String(blockingBorrowing.status || '').toLowerCase();
    
    const extensionCount = blockingBorrowing.extension_count || 0;
    const isBlocked = blockingBorrowing.is_extension_blocked;
    
    let message = '';
    if (status === 'overdue') {
      if (isBlocked) {
        message = `Peminjaman baru ditolak karena perpanjangan waktu peminjaman Anda telah dikunci oleh sistem. Alat ${assetName}${reference}${dueDateSegment} harus dikembalikan terlebih dahulu.`;
      } else if (extensionCount === 0) {
        message = `Peminjaman baru ditolak karena Anda masih memiliki alat yang melewati batas waktu: ${assetName}${reference}${dueDateSegment}. Silakan perbarui/perpanjang waktu peminjamannya atau kembalikan alat tersebut.`;
      } else {
        message = `Peminjaman baru ditolak karena alat ${assetName}${reference} masih dalam proses pengembalian. Silakan menyelesaikan pengembalian alat tersebut terlebih dahulu.`;
      }
    } else {
      message = `Peminjaman baru ditolak karena Anda masih memiliki alat yang belum dikembalikan: ${assetName}${reference}${dueDateSegment}. Silakan kembalikan alat tersebut terlebih dahulu sebelum meminjam alat lain.`;
    }

    return message;
  }

  private async syncAssetMasterAfterValidatedReturn(
    assetId: number,
    assetType: string = 'medical',
    options?: {
      borrowingId?: string | number;
      assetDetailId?: string | null;
      returnCondition?: string | null;
    }
  ): Promise<void> {
    const normalizedAssetType = assetType === 'non_medical' ? 'non_medical' : 'medical';
    const normalizedDetailId = this.normalizeDetailIdentifier(options?.assetDetailId);
    const isAssetFallbackDetail = this.isAssetFallbackDetailId(
      normalizedDetailId,
      assetId,
      normalizedAssetType
    );

    if (normalizedDetailId && !isAssetFallbackDetail) {
      return;
    }

    const [activeRows] = await pool.query<RowDataPacket[]>(
      `SELECT id FROM borrowing_records
       WHERE asset_id = ?
         AND COALESCE(asset_type, 'medical') = ?
         AND id <> ?
         AND deleted_at IS NULL
         AND ${this.getBorrowingLockWhereClause('status', 'return_validated_at')}
       LIMIT 1`,
      [
        assetId,
        normalizedAssetType,
        options?.borrowingId ?? 0
      ]
    );

    if (activeRows.length > 0) {
      return;
    }

    if (this.isDamagedReturnCondition(options?.returnCondition)) {
      await this.assetService.update(
        String(assetId),
        {
          status: 'disposed',
          condition: 'damaged'
        },
        normalizedAssetType
      );
      return;
    }

    await this.assetService.updateStatus(
      String(assetId),
      'available',
      normalizedAssetType
    );
  }

  private async syncAssetDetailBorrowingState(
    assetId: number,
    assetType: string = 'medical',
    options?: {
      detailId?: string | null;
      detailCode?: string | null;
      returnCondition?: string | null;
    }
  ): Promise<void> {
    const normalizedAssetType = assetType === 'non_medical' ? 'non_medical' : 'medical';
    const normalizedDetailId = this.normalizeDetailIdentifier(options?.detailId);
    const normalizedDetailCode = this.normalizeDetailIdentifier(options?.detailCode);
    const hasReturnCondition = Boolean(this.normalizeDetailIdentifier(options?.returnCondition));
    const isDamagedReturn = this.isDamagedReturnCondition(options?.returnCondition);
    const isAssetFallbackDetail = this.isAssetFallbackDetailId(
      normalizedDetailId,
      assetId,
      normalizedAssetType
    );
    const shouldMatchSpecificDetail = Boolean(
      (normalizedDetailId && !isAssetFallbackDetail) || normalizedDetailCode
    );

    const assetResponse = await this.assetService.getById(String(assetId), normalizedAssetType);
    if (!assetResponse.success || !assetResponse.data) return;

    const specifications = this.parseAssetSpecifications(assetResponse.data.specifications);
    const details = Array.isArray(specifications.details) ? specifications.details : [];
    if (details.length === 0) return;

    const [borrowingRows] = await pool.query<RowDataPacket[]>(
      `SELECT asset_detail_id, asset_detail_code, status, return_validated_at
       FROM borrowing_records
       WHERE asset_id = ?
         AND COALESCE(asset_type, 'medical') = ?
         AND deleted_at IS NULL
         AND ${this.getBorrowingLockWhereClause('status', 'return_validated_at')}`,
      [assetId, normalizedAssetType]
    );

    const [maintenanceRows] = await pool.query<RowDataPacket[]>(
      `SELECT asset_detail_id
       FROM maintenance_records
       WHERE asset_id = ?
         AND COALESCE(asset_type, 'medical') = ?
         AND deleted_at IS NULL
         AND status IN (?, ?, ?)`,
      [assetId, normalizedAssetType, ...this.activeMaintenanceStatuses]
    );

    const activeBorrowingRows = borrowingRows.filter((row) =>
      this.isBorrowingLockStatus(row.status, row.return_validated_at)
    );

    const hasWholeAssetBorrowing = activeBorrowingRows.some((row) =>
      this.isAssetFallbackDetailId(row.asset_detail_id, assetId, normalizedAssetType) ||
      !this.normalizeDetailIdentifier(row.asset_detail_id)
    );
    const hasWholeAssetMaintenance = maintenanceRows.some((row) =>
      this.isAssetFallbackDetailId(row.asset_detail_id, assetId, normalizedAssetType) ||
      !this.normalizeDetailIdentifier(row.asset_detail_id)
    );

    let hasChanges = false;

    const updatedDetails = details.map((rawDetail: any) => {
      const detail = rawDetail && typeof rawDetail === 'object' ? { ...rawDetail } : rawDetail;
      if (!detail || typeof detail !== 'object') return rawDetail;

      const isTarget = shouldMatchSpecificDetail
        ? this.matchesAssetDetail(detail, normalizedDetailId, normalizedDetailCode)
        : true;

      if (!isTarget) {
        return rawDetail;
      }

      const isBorrowed = hasWholeAssetBorrowing || activeBorrowingRows.some((row) =>
        this.matchesAssetDetail(detail, row.asset_detail_id, row.asset_detail_code)
      );
      const isUnderMaintenance = hasWholeAssetMaintenance || maintenanceRows.some((row) =>
        this.matchesAssetDetail(detail, row.asset_detail_id)
      );

      let nextStatus: string | null = null;
      let nextCondition: string | null = null;
      if (isUnderMaintenance) {
        nextStatus = 'Dalam Perbaikan';
      } else if (isBorrowed) {
        nextStatus = 'Dipinjam';
      } else if (isDamagedReturn) {
        nextStatus = 'Non-Aktif';
        nextCondition = 'Rusak';
      } else if (hasReturnCondition) {
        nextStatus = 'Aktif';
      } else if (this.isStaleBorrowedDetailStatus(detail.status) || this.isStaleMaintenanceDetailStatus(detail.status)) {
        nextStatus = 'Aktif';
      }

      const statusChanged = nextStatus && detail.status !== nextStatus;
      const conditionChanged = nextCondition && detail.condition !== nextCondition;

      if (!statusChanged && !conditionChanged) {
        return rawDetail;
      }

      if (statusChanged) {
        detail.status = nextStatus;
      }
      if (conditionChanged) {
        detail.condition = nextCondition;
      }
      hasChanges = true;
      return detail;
    });

    if (!hasChanges) return;

    await this.assetService.update(
      String(assetId),
      {
        specifications: {
          ...specifications,
          details: updatedDetails
        }
      },
      normalizedAssetType
    );
  }

  async getAll(filters: BorrowingFilters): Promise<PaginatedResponse<Borrowing>> {
    await this.syncOverdueBorrowings();

    const { page, limit, status, userId, assetId, assetType } = filters;
    const offset = (page - 1) * limit;

    // Perbaikan QUERY: Menggunakan logika JOIN yang lebih ketat terhadap asset_type
    // dan mengambil data dari tabel yang sesuai (medical vs non-medical)
    let query = `
      SELECT b.*,
        COALESCE(ma.name, na.name) as asset_name,
        COALESCE(ma.asset_code, na.asset_code) as asset_code,
        COALESCE(ma.location, na.location) as asset_location,
        COALESCE(b.asset_type, 'medical') as asset_type, 
        u.name as user_name, u.nip as user_nip, u.email as user_email, u.work_unit as borrower_current_work_unit,
        v.name as return_validator_name, v.nip as return_validator_nip,
        r.name as returned_by_name, r.nip as returned_by_nip
      FROM borrowing_records b
      LEFT JOIN medical_assets ma 
        ON b.asset_id = ma.id 
        AND (b.asset_type = 'medical' OR b.asset_type IS NULL)
      LEFT JOIN non_medical_assets na 
        ON b.asset_id = na.id 
        AND b.asset_type = 'non_medical'
      JOIN users u ON b.user_id = u.id
      LEFT JOIN users v ON b.return_validated_by = v.id
      LEFT JOIN users r ON b.returned_by = r.id
      WHERE b.deleted_at IS NULL
    `;

    let countQuery = 'SELECT COUNT(*) as count FROM borrowing_records WHERE deleted_at IS NULL';
    const params: any[] = [];
    const countParams: any[] = [];

    if (status) {
      query += ' AND b.status = ?';
      countQuery += ' AND status = ?';
      params.push(status);
      countParams.push(status);
    }

    if (userId) {
      query += ' AND b.user_id = ?';
      countQuery += ' AND user_id = ?';
      params.push(userId);
      countParams.push(userId);
    }

    if (assetId) {
      query += ' AND b.asset_id = ?';
      countQuery += ' AND asset_id = ?';
      params.push(assetId);
      countParams.push(assetId);
    }

    // Filter berdasarkan asset_type (medis/non-medis)
    if (assetType) {
      query += " AND COALESCE(b.asset_type, 'medical') = ?";
      countQuery += " AND COALESCE(asset_type, 'medical') = ?";
      params.push(assetType);
      countParams.push(assetType);
    }

    query += ' ORDER BY b.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [dataRows] = await pool.query<BorrowingRow[]>(query, params);
    const [countRows] = await pool.query<CountRow[]>(countQuery, countParams);

    const total = countRows[0].count;

    return {
      success: true,
      message: 'Borrowings retrieved successfully',
      data: dataRows.map((row) => normalizeBorrowingDateFields(row)),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    };
  }

  async getById(id: string): Promise<ApiResponse<Borrowing>> {
    await this.syncOverdueBorrowings();

    // Query getById disamakan logikanya dengan getAll untuk konsistensi
    const [rows] = await pool.query<BorrowingRow[]>(
      `SELECT b.*,
        COALESCE(ma.name, na.name) as asset_name,
        COALESCE(ma.asset_code, na.asset_code) as asset_code,
        COALESCE(ma.location, na.location) as asset_location,
        COALESCE(b.asset_type, 'medical') as asset_type,
        u.name as user_name, u.nip as user_nip, u.email as user_email, u.work_unit as borrower_current_work_unit,
        v.name as return_validator_name, v.nip as return_validator_nip,
        r.name as returned_by_name, r.nip as returned_by_nip
       FROM borrowing_records b
       LEFT JOIN medical_assets ma 
         ON b.asset_id = ma.id 
         AND (b.asset_type = 'medical' OR b.asset_type IS NULL)
       LEFT JOIN non_medical_assets na 
         ON b.asset_id = na.id 
         AND b.asset_type = 'non_medical'
       JOIN users u ON b.user_id = u.id
       LEFT JOIN users v ON b.return_validated_by = v.id
       LEFT JOIN users r ON b.returned_by = r.id
       WHERE b.id = ?
         AND b.deleted_at IS NULL`,
      [id]
    );

    if (rows.length === 0) {
      return { success: false, message: 'Borrowing not found' };
    }

    return {
      success: true,
      message: 'Borrowing retrieved successfully',
      data: normalizeBorrowingDateFields(rows[0])
    };
  }

  async create(data: CreateBorrowingDTO): Promise<ApiResponse<Borrowing>> {
    await this.syncOverdueBorrowings();

    const blockingBorrowing = await this.getBlockingBorrowing(data.userId);
    if (blockingBorrowing) {
      return {
        success: false,
        message: this.buildBorrowingLockMessage(blockingBorrowing)
      };
    }

    const borrowingCode = generateBorrowingCode();
    // Default ke 'medical' jika tidak diset, untuk backward compatibility
    const assetType = data.assetType || 'medical'; 
    // Konversi tanggal ke format yang sesuai MySQL
    const borrowDateParsed = normalizeDateInput(data.borrowDate);
    if (!borrowDateParsed) {
      return { success: false, message: 'Tanggal pinjam tidak valid' };
    }
    
    // Jika dueDate tidak diberikan, set default ke 7 hari dari borrowDate
    let dueDateParsed = normalizeDateInput(data.dueDate);
    if (!dueDateParsed) {
      dueDateParsed = new Date(borrowDateParsed);
      dueDateParsed.setDate(dueDateParsed.getDate() + 7); // Default 7 hari
    }

    // Validasi bahwa dueDate >= borrowDate
    if (dueDateParsed.getTime() < borrowDateParsed.getTime()) {
      return { success: false, message: 'Tanggal kembali harus lebih besar atau sama dengan tanggal pinjam' };
    }

    const borrowDateValue = formatDateTimeForMySQL(borrowDateParsed);
    const dueDateValue = formatDateTimeForMySQL(dueDateParsed);
    const quantity = data.quantity && data.quantity > 0 ? data.quantity : 1;

    // Panggil assetService dengan menyertakan tipe aset
    const asset = await this.assetService.getById(String(data.assetId), assetType);
    if (!asset.success) {
      return { success: false, message: asset.message || 'Asset not found' };
    }

    const assetStatus = (asset.data?.status || '').toLowerCase();
    const detailId = this.normalizeDetailIdentifier(data.assetDetailId);
    const isAssetFallbackDetail = this.isAssetFallbackDetailId(detailId, data.assetId, assetType);

    const hasUsage = await this.hasActiveUsage(Number(data.assetId), assetType, detailId || null);
    if (hasUsage) {
      return {
        success: false,
        message: 'Alat sedang digunakan sehingga belum dapat ditambahkan peminjaman'
      };
    }

    if (this.isInUseAssetStatus(asset.data?.status)) {
      return {
        success: false,
        message: 'Alat sedang digunakan sehingga belum dapat ditambahkan peminjaman'
      };
    }

    const assetDetails = this.getAssetDetails(asset.data?.specifications);
    if (detailId && !isAssetFallbackDetail) {
      const selectedDetail = this.findDetailById(assetDetails, detailId);
      if (this.isInUseAssetStatus(selectedDetail?.status)) {
        return {
          success: false,
          message: 'Alat sedang digunakan sehingga belum dapat ditambahkan peminjaman'
        };
      }
    } else if (assetDetails.some((detail) => this.isInUseAssetStatus(detail?.status))) {
      return {
        success: false,
        message: 'Alat sedang digunakan sehingga belum dapat ditambahkan peminjaman'
      };
    }

    // Hard lock from maintenance workflow: while status is requested/scheduled/in_progress,
    // asset cannot be borrowed until maintenance is completed/cancelled.
    if (detailId && !isAssetFallbackDetail) {
      const [activeMaintenanceRows] = await pool.query<RowDataPacket[]>(
        `SELECT id FROM maintenance_records
         WHERE asset_id = ?
           AND COALESCE(asset_type, 'medical') = ?
           AND status IN ('requested', 'scheduled', 'in_progress')
           AND (asset_detail_id = ? OR asset_detail_id IS NULL)
         LIMIT 1`,
        [data.assetId, assetType, detailId]
      );

      if (activeMaintenanceRows.length > 0) {
        return {
          success: false,
          message: 'Asset sedang dalam pemeliharaan aktif dan belum dapat dipinjam'
        };
      }
    } else {
      const [activeMaintenanceRows] = await pool.query<RowDataPacket[]>(
        `SELECT id FROM maintenance_records
         WHERE asset_id = ?
           AND COALESCE(asset_type, 'medical') = ?
           AND status IN ('requested', 'scheduled', 'in_progress')
         LIMIT 1`,
        [data.assetId, assetType]
      );

      if (activeMaintenanceRows.length > 0) {
        return {
          success: false,
          message: 'Asset sedang dalam pemeliharaan aktif dan belum dapat dipinjam'
        };
      }
    }

    // --- Validasi Ketersediaan Aset (Logic diperbaiki sedikit untuk readability) ---
    
    // Cek 1: Jika meminjam Detail Item spesifik
    if (detailId && !isAssetFallbackDetail) {
      const selectedDetail = this.findDetailById(assetDetails, detailId);
      const detailStatus = String(selectedDetail?.status || '').toLowerCase();
      const detailCondition = String(selectedDetail?.condition || '').toLowerCase();
      const isDetailBlocked = [
        'maintenance',
        'perbaikan',
        'non-aktif',
        'non aktif',
        'disposed'
      ].some((status) => detailStatus.includes(status)) || ['rusak', 'damaged'].some((status) => detailCondition.includes(status));

      if (selectedDetail && isDetailBlocked) {
        return { success: false, message: 'Selected asset item is not available for borrowing' };
      }

      // Cek apakah MASTER aset sedang dipinjam (jika sistem mengunci master saat detail dipinjam)
      const fallbackDetailIds = this.getAssetFallbackDetailIds(data.assetId, assetType);
      const [assetLevelRows] = await pool.query<RowDataPacket[]>(
        `SELECT id FROM borrowing_records
         WHERE asset_id = ? AND COALESCE(asset_type, 'medical') = ?
           AND (asset_detail_id IS NULL OR asset_detail_id IN (?, ?))
           AND deleted_at IS NULL
           AND ${this.getBorrowingLockWhereClause('status', 'return_validated_at')}
         LIMIT 1`,
        [data.assetId, assetType, fallbackDetailIds[0], fallbackDetailIds[1]]
      );

      if (assetLevelRows.length > 0) {
        return { success: false, message: 'Asset is currently locked by another transaction' };
      }

      // Cek apakah DETAIL aset spesifik ini sedang dipinjam
      const [activeRows] = await pool.query<RowDataPacket[]>(
        `SELECT id FROM borrowing_records
         WHERE asset_id = ? AND COALESCE(asset_type, 'medical') = ? AND asset_detail_id = ?
           AND deleted_at IS NULL
           AND ${this.getBorrowingLockWhereClause('status', 'return_validated_at')}
         LIMIT 1`,
        [data.assetId, assetType, detailId]
      );

      if (activeRows.length > 0) {
        return { success: false, message: 'Selected asset item is currently unavailable/borrowed' };
      }
    } 
    // Cek 2: Jika meminjam Aset Master (tanpa detail spesifik)
    else {
      // Cek apakah ada detail item yang sedang dipinjam (jika meminjam master berarti meminjam semua)
      const [detailRows] = await pool.query<RowDataPacket[]>(
        `SELECT id FROM borrowing_records
         WHERE asset_id = ? AND COALESCE(asset_type, 'medical') = ? AND asset_detail_id IS NOT NULL
           AND deleted_at IS NULL
           AND ${this.getBorrowingLockWhereClause('status', 'return_validated_at')}
         LIMIT 1`,
        [data.assetId, assetType]
      );

      if (detailRows.length > 0) {
        return { success: false, message: 'Cannot borrow asset master because some items are currently borrowed' };
      }

      const isAvailable = ['available', 'aktif', 'active'].includes(assetStatus);
      if (!isAvailable) {
        return { success: false, message: 'Asset is not available for borrowing' };
      }
    }

    // Insert Data
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO borrowing_records (
         borrowing_code,
         asset_id,
         asset_type,
         asset_detail_id,
         asset_detail_name,
         asset_detail_code,
         user_id,
         borrower_position,
         borrower_work_unit,
         owner_name,
         owner_position,
         owner_work_unit,
         borrow_date,
         due_date,
         purpose,
         purpose_type,
         destination_room,
         loan_duration_value,
         loan_duration_unit,
         quantity,
         notes,
         status,
         created_at
       )
	      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())`,
      [
        borrowingCode,
        data.assetId,
        assetType, // Pastikan ini tersimpan ('medical' atau 'non_medical')
        detailId || null,
        data.assetDetailName || null,
        data.assetDetailCode || null,
        data.userId,
        normalizeOptionalText(data.borrowerPosition),
        normalizeOptionalText(data.borrowerWorkUnit),
        normalizeOptionalText(data.ownerName),
        normalizeOptionalText(data.ownerPosition),
        normalizeOptionalText(data.ownerWorkUnit),
        borrowDateValue,
        dueDateValue,
        data.purpose,
        data.purposeType || null,
        normalizeOptionalText(data.destinationRoom),
        data.loanDurationValue || null,
        data.loanDurationUnit || null,
        quantity,
        normalizeOptionalText(data.notes)
      ]
    );

	    // Fetch hasil insert untuk dikembalikan (gunakan getById agar join tabel aset berjalan)
	    return await this.getById(String(result.insertId));
	  }

  private getAssetDetails(specifications?: unknown): any[] {
    if (!specifications) return [];
    if (typeof specifications === 'string') {
      try {
        const parsed = JSON.parse(specifications) as { details?: any[] };
        return Array.isArray(parsed?.details) ? parsed.details : [];
      } catch {
        return [];
      }
    }
    if (typeof specifications === 'object') {
      const details = (specifications as { details?: any[] }).details;
      return Array.isArray(details) ? details : [];
    }
    return [];
  }

  private findDetailById(details: any[], detailId: string): any | undefined {
    return details.find((detail) => {
      const candidates = [
        detail?.id,
        detail?.noId,
        detail?.noID,
        detail?.no_id,
        detail?.detailId,
        detail?.assetDetailId,
        detail?.assetCode,
        detail?.detailCode,
        detail?.inventoryCode,
        detail?.itemCode,
        detail?.code,
        detail?.serialNumber,
      ]
        .filter((value) => value !== undefined && value !== null)
        .map((value) => String(value));

      return candidates.includes(detailId);
    });
  }

  async approve(id: string, approvedBy: number): Promise<ApiResponse<Borrowing>> {
    const borrowing = await this.getById(id);
    if (!borrowing.success) return borrowing;

    if (borrowing.data?.status !== 'pending') {
      return { success: false, message: 'Only pending borrowings can be approved' };
    }

    const isAssetFallbackDetail = this.isAssetFallbackDetailId(
      borrowing.data?.assetDetailId,
      borrowing.data?.assetId,
      borrowing.data?.assetType
    );
    
    await pool.query(
      'UPDATE borrowing_records SET status = ?, approved_by = ?, approved_at = NOW(), updated_at = NOW() WHERE id = ?',
      ['approved', approvedBy, id]
    );

    try {
      // Update status aset (pastikan mengirim assetType yang benar ke AssetService)
      if (!borrowing.data?.assetDetailId || isAssetFallbackDetail) {
        await this.assetService.updateStatus(
          String(borrowing.data.assetId),
          'borrowed',
          borrowing.data.assetType || 'medical'
        );
      }

      await this.syncAssetDetailBorrowingState(borrowing.data.assetId, borrowing.data.assetType || 'medical', {
        detailId: borrowing.data.assetDetailId || null,
        detailCode: borrowing.data.assetDetailCode || null
      });
    } catch (syncError) {
      console.error('Approve borrowing asset sync error:', syncError);
    }

    // Create asset usage log on approve if the borrowing should be considered started.
    // Existing active usage is reused to avoid duplicate rows.
    try {
      const assetId = Number(borrowing.data.assetId);
      const assetType = borrowing.data.assetType || 'medical';
      const startedAt = normalizeDateInput(borrowing.data.borrowDate) || new Date();

      await this.ensureUsageLogForBorrowing({
        borrowingId: borrowing.data.id,
        assetId,
        assetType,
        assetDetailId: borrowing.data.assetDetailId || null,
        assetDetailName: borrowing.data.assetDetailName || null,
        assetDetailCode: borrowing.data.assetDetailCode || null,
        assetLocation: borrowing.data.assetLocation || '',
        roomName: borrowing.data.destinationRoom || '',
        operatorUserId: borrowing.data.userId,
        startedAt: startedAt,
        usageCount: borrowing.data.quantity || 1,
        notes: borrowing.data.notes || null,
        createdBy: approvedBy
      });
    } catch {
      // ignore logging errors
    }

    // Send approval email (fire-and-forget)
    try {
      const updated = await this.getById(id);
      const row = updated.data as any;
      const toEmail = row?.user_email ?? row?.userEmail;
      if (toEmail) {
        const fmt = (d?: string | null) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : '-';
        sendBorrowingApprovedEmail(toEmail, {
          userName: row.user_name ?? row.userName ?? 'Pengguna',
          assetName: row.asset_detail_name ?? row.assetDetailName ?? row.asset_name ?? row.assetName ?? String(row.asset_id ?? id),
          borrowDate: fmt(row.borrow_date ?? row.borrowDate),
          dueDate: fmt(row.due_date ?? row.dueDate),
          borrowingCode: row.borrowing_code ?? row.borrowingCode ?? String(id),
        }).catch(() => {});
      }
    } catch {
      // email errors never block the main flow
    }

    return await this.getById(id);
  }

  async validateReturn(id: string, validatorId: number): Promise<ApiResponse<Borrowing>> {
    await this.syncOverdueBorrowings();
    const hasSanctionColumns = await this.hasSanctionColumns();

    const borrowing = await this.getById(id);
    if (!borrowing.success || !borrowing.data) return borrowing;

    const borrowingRow = borrowing.data as any;
    const borrowingStatus = borrowingRow.status;
    const returnValidatedBy = borrowingRow.returnValidatedBy ?? borrowingRow.return_validated_by;
    const assetId = Number(borrowingRow.assetId ?? borrowingRow.asset_id);
    const assetType = borrowingRow.assetType ?? borrowingRow.asset_type ?? 'medical';
    const assetDetailId = borrowingRow.assetDetailId ?? borrowingRow.asset_detail_id ?? null;
    const assetDetailCode = borrowingRow.assetDetailCode ?? borrowingRow.asset_detail_code ?? null;
    const returnCondition = borrowingRow.returnCondition ?? borrowingRow.return_condition ?? null;

    if (borrowingStatus !== 'returned') {
      return { success: false, message: 'Only returned borrowings can be validated' };
    }

    if (returnValidatedBy) {
      return { success: false, message: 'Return already validated' };
    }

    if (hasSanctionColumns) {
      await pool.query(
        `UPDATE borrowing_records
         SET return_validated_by = ?,
             return_validated_at = NOW(),
             sanction_status = CASE WHEN overdue_days > 0 THEN 'resolved' ELSE sanction_status END,
             updated_at = NOW()
         WHERE id = ?`,
        [validatorId, id]
      );
    } else {
      await pool.query(
        `UPDATE borrowing_records
         SET return_validated_by = ?,
             return_validated_at = NOW(),
             updated_at = NOW()
         WHERE id = ?`,
        [validatorId, id]
      );
    }

    await this.syncAssetMasterAfterValidatedReturn(assetId, assetType, {
      borrowingId: id,
      assetDetailId,
      returnCondition
    });

    await this.syncAssetDetailBorrowingState(assetId, assetType, {
      detailId: assetDetailId,
      detailCode: assetDetailCode,
      returnCondition
    });

    return this.getById(id);
  }

  async reject(id: string, rejectedBy: number, reason: string): Promise<ApiResponse<Borrowing>> {
    const borrowing = await this.getById(id);
    if (!borrowing.success) return borrowing;

    if (borrowing.data?.status !== 'pending') {
      return { success: false, message: 'Only pending borrowings can be rejected' };
    }

    await pool.query(
      'UPDATE borrowing_records SET status = ?, rejected_by = ?, rejected_at = NOW(), rejection_reason = ?, updated_at = NOW() WHERE id = ?',
      ['rejected', rejectedBy, reason, id]
    );

    await this.syncAssetDetailBorrowingState(borrowing.data.assetId, borrowing.data.assetType || 'medical', {
      detailId: borrowing.data.assetDetailId || null,
      detailCode: borrowing.data.assetDetailCode || null
    });

    // Send rejection email (fire-and-forget)
    try {
      const row = borrowing.data as any;
      const toEmail = row?.user_email ?? row?.userEmail;
      if (toEmail) {
        sendBorrowingRejectedEmail(toEmail, {
          userName: row.user_name ?? row.userName ?? 'Pengguna',
          assetName: row.asset_detail_name ?? row.assetDetailName ?? row.asset_name ?? row.assetName ?? String(row.asset_id ?? id),
          borrowingCode: row.borrowing_code ?? row.borrowingCode ?? String(id),
          reason,
        }).catch(() => {});
      }
    } catch {
      // email errors never block the main flow
    }

    return await this.getById(id);
  }

  async return(id: string, data: ReturnBorrowingDTO): Promise<ApiResponse<Borrowing>> {
    await this.syncOverdueBorrowings();
    const hasSanctionColumns = await this.hasSanctionColumns();

    const borrowing = await this.getById(id);
    if (!borrowing.success || !borrowing.data) return borrowing;

    const borrowingRow = borrowing.data as any;
    const borrowingStatus = borrowingRow.status;
    const assetId = Number(borrowingRow.assetId ?? borrowingRow.asset_id);
    const assetType = borrowingRow.assetType ?? borrowingRow.asset_type ?? 'medical';
    const assetDetailId = borrowingRow.assetDetailId ?? borrowingRow.asset_detail_id ?? null;
    const assetDetailCode = borrowingRow.assetDetailCode ?? borrowingRow.asset_detail_code ?? null;

    if (borrowingStatus !== 'approved' && borrowingStatus !== 'borrowed' && borrowingStatus !== 'overdue') {
      return { success: false, message: 'Only approved/borrowed/overdue items can be returned' };
    }

    const actorId = Number(data.returnedBy);
    const borrowerId = Number(borrowingRow.userId ?? borrowingRow.user_id);
    const isManager = hasAnyRole(data.actorRole, ['admin', 'leader']);
    const isBorrower = Number.isFinite(actorId)
      && Number.isFinite(borrowerId)
      && actorId > 0
      && actorId === borrowerId;
    const staffPjAccessError = this.validateStaffPjSameInstallation(
      borrowingRow,
      data.actorRole,
      data.actorWorkUnit,
      'mengembalikan'
    );
    if (staffPjAccessError) {
      return { success: false, message: staffPjAccessError };
    }
    const isSameInstallationStaffPj = hasAnyRole(data.actorRole, ['staff_pj', 'staff pj']);

    if (!isManager && !isBorrower && !isSameInstallationStaffPj) {
      return {
        success: false,
        message: 'Pengembalian hanya dapat dilakukan oleh admin, leader, Staff PJ satu instalasi, atau pengguna pemilik peminjaman.'
      };
    }

    const overdueInfo = this.getOverdueBorrowingInfo(borrowingRow.dueDate ?? borrowingRow.due_date, new Date());

    if (hasSanctionColumns) {
      await pool.query(
        `UPDATE borrowing_records
         SET status = ?,
             return_date = NOW(),
             return_condition = ?,
             return_notes = ?,
             returned_by = ?,
             overdue_days = ?,
             sanction_status = ?,
             sanction_notes = ?,
             sanction_applied_at = COALESCE(sanction_applied_at, ?),
             updated_at = NOW()
         WHERE id = ?`,
        [
          'returned',
          data.condition,
          data.notes || null,
          data.returnedBy || null,
          overdueInfo.overdueDays,
          overdueInfo.sanctionStatus,
          overdueInfo.sanctionNotes,
          overdueInfo.sanctionAppliedAt,
          id
        ]
      );
    } else {
      await pool.query(
        `UPDATE borrowing_records
         SET status = ?,
             return_date = NOW(),
             return_condition = ?,
             return_notes = ?,
             returned_by = ?,
             updated_at = NOW()
         WHERE id = ?`,
        [
          'returned',
          data.condition,
          data.notes || null,
          data.returnedBy || null,
          id
        ]
      );
    }

    await this.syncAssetDetailBorrowingState(assetId, assetType, {
      detailId: assetDetailId,
      detailCode: assetDetailCode,
      returnCondition: data.condition || null
    });

    try {
      await this.completeUsageLogForBorrowing({
        borrowingId: id,
        assetId,
        assetType,
        assetDetailId,
        operatorUserId: borrowingRow.userId ?? borrowingRow.user_id ?? null,
        conditionAfter: data.condition || null,
        notes: data.notes || null
      });
    } catch {
      // ignore logging errors to avoid breaking return flow
    }

    return await this.getById(id);
  }

  async update(id: string, data: UpdateBorrowingDTO): Promise<ApiResponse<Borrowing>> {
    await this.syncOverdueBorrowings();

    const borrowing = await this.getById(id);
    if (!borrowing.success || !borrowing.data) {
      return { success: false, message: 'Borrowing not found' };
    }

    const editableStatuses = ['pending', 'approved', 'borrowed', 'overdue'];
    const returnStatus = 'returned';
    const rowsToUpdate: { field: string; value: any }[] = [];

    const hasBorrowFields = [
      data.borrowDate !== undefined,
      data.dueDate !== undefined,
      data.purpose !== undefined,
      data.borrowerPosition !== undefined,
      data.borrowerWorkUnit !== undefined,
      data.ownerName !== undefined,
      data.ownerPosition !== undefined,
      data.ownerWorkUnit !== undefined,
      data.purposeType !== undefined,
      data.destinationRoom !== undefined,
      data.loanDurationValue !== undefined,
      data.loanDurationUnit !== undefined,
      data.quantity !== undefined,
      data.notes !== undefined,
    ].some(Boolean);

    if (hasBorrowFields) {
      if (!editableStatuses.includes(borrowing.data.status)) {
        return { success: false, message: 'Hanya peminjaman aktif yang belum selesai yang bisa diubah' };
      }
      const effectiveBorrowDate = data.borrowDate !== undefined
        ? normalizeDateInput(data.borrowDate)
        : normalizeDateInput(borrowing.data.borrowDate);
      const effectiveDueDate = data.dueDate !== undefined
        ? normalizeDateInput(data.dueDate)
        : normalizeDateInput(borrowing.data.dueDate);

      if (effectiveBorrowDate && effectiveDueDate && effectiveDueDate.getTime() < effectiveBorrowDate.getTime()) {
        return { success: false, message: 'Tanggal kembali harus lebih besar atau sama dengan tanggal pinjam' };
      }

      if (data.borrowDate !== undefined) {
        const borrowDateParsed = normalizeDateInput(data.borrowDate);
        if (borrowDateParsed) {
          rowsToUpdate.push({ field: 'borrow_date', value: formatDateTimeForMySQL(borrowDateParsed) });
        }
      }
      if (data.dueDate !== undefined) {
        const dueDateParsed = normalizeDateInput(data.dueDate);
        if (dueDateParsed) {
          rowsToUpdate.push({ field: 'due_date', value: formatDateTimeForMySQL(dueDateParsed) });
        }
      }
      if (data.purpose !== undefined) {
        rowsToUpdate.push({ field: 'purpose', value: data.purpose });
      }
      if (data.borrowerPosition !== undefined) {
        rowsToUpdate.push({ field: 'borrower_position', value: normalizeOptionalText(data.borrowerPosition) });
      }
      if (data.borrowerWorkUnit !== undefined) {
        rowsToUpdate.push({ field: 'borrower_work_unit', value: normalizeOptionalText(data.borrowerWorkUnit) });
      }
      if (data.ownerName !== undefined) {
        rowsToUpdate.push({ field: 'owner_name', value: normalizeOptionalText(data.ownerName) });
      }
      if (data.ownerPosition !== undefined) {
        rowsToUpdate.push({ field: 'owner_position', value: normalizeOptionalText(data.ownerPosition) });
      }
      if (data.ownerWorkUnit !== undefined) {
        rowsToUpdate.push({ field: 'owner_work_unit', value: normalizeOptionalText(data.ownerWorkUnit) });
      }
      if (data.purposeType !== undefined) {
        rowsToUpdate.push({ field: 'purpose_type', value: data.purposeType || null });
      }
      if (data.destinationRoom !== undefined) {
        rowsToUpdate.push({ field: 'destination_room', value: normalizeOptionalText(data.destinationRoom) });
      }
      if (data.loanDurationValue !== undefined) {
        rowsToUpdate.push({ field: 'loan_duration_value', value: data.loanDurationValue || null });
      }
      if (data.loanDurationUnit !== undefined) {
        rowsToUpdate.push({ field: 'loan_duration_unit', value: data.loanDurationUnit || null });
      }
      if (data.quantity !== undefined) {
        rowsToUpdate.push({ field: 'quantity', value: data.quantity && data.quantity > 0 ? data.quantity : 1 });
      }
      if (data.notes !== undefined) {
        rowsToUpdate.push({ field: 'notes', value: normalizeOptionalText(data.notes) });
      }

      if (data.dueDate !== undefined && effectiveDueDate && ['approved', 'borrowed', 'overdue'].includes(borrowing.data.status)) {
        const hasSanctionColumns = await this.hasSanctionColumns();
        const overdueInfo = this.getOverdueBorrowingInfo(effectiveDueDate, new Date());

        if (overdueInfo.overdueDays > 0) {
          rowsToUpdate.push({ field: 'status', value: 'overdue' });
          if (hasSanctionColumns) {
            rowsToUpdate.push({ field: 'overdue_days', value: overdueInfo.overdueDays });
            rowsToUpdate.push({ field: 'sanction_status', value: overdueInfo.sanctionStatus });
            rowsToUpdate.push({ field: 'sanction_notes', value: overdueInfo.sanctionNotes });
            rowsToUpdate.push({ field: 'sanction_applied_at', value: overdueInfo.sanctionAppliedAt });
          }
        } else if (borrowing.data.status === 'overdue') {
          rowsToUpdate.push({ field: 'status', value: 'borrowed' });
          if (hasSanctionColumns) {
            rowsToUpdate.push({ field: 'overdue_days', value: 0 });
            rowsToUpdate.push({ field: 'sanction_status', value: 'resolved' });
            rowsToUpdate.push({ field: 'sanction_notes', value: 'Batas waktu peminjaman diperpanjang' });
          }
        }
      }
    }

    const hasReturnFields = [
      data.returnCondition !== undefined,
      data.returnNotes !== undefined,
    ].some(Boolean);

    if (hasReturnFields) {
      if (borrowing.data.status !== returnStatus) {
        return { success: false, message: 'Hanya pengembalian bertatus returned yang bisa diubah' };
      }
      if (data.returnCondition !== undefined) {
        rowsToUpdate.push({ field: 'return_condition', value: data.returnCondition });
      }
      if (data.returnNotes !== undefined) {
        rowsToUpdate.push({ field: 'return_notes', value: data.returnNotes });
      }
    }

    if (rowsToUpdate.length === 0) {
      return { success: false, message: 'Tidak ada perubahan yang dikirimkan' };
    }

    const clause = rowsToUpdate.map((row) => `${row.field} = ?`).join(', ');
    const params = rowsToUpdate.map((row) => row.value);
    params.push(id);

    const willSetToBorrowed = rowsToUpdate.some((r) => r.field === 'status' && r.value === 'borrowed');

    await pool.query(
      `UPDATE borrowing_records SET ${clause}, updated_at = NOW() WHERE id = ?`,
      params
    );

    if (willSetToBorrowed) {
      try {
        const borrowingRow = borrowing.data as any;
        const assetId = Number(borrowingRow.assetId ?? borrowingRow.asset_id);
        const assetType = borrowingRow.assetType ?? borrowingRow.asset_type ?? 'medical';
        const startedAt = data.borrowDate !== undefined
          ? normalizeDateInput(data.borrowDate) || new Date()
          : normalizeDateInput(borrowingRow.borrowDate) || new Date();

        await this.ensureUsageLogForBorrowing({
          borrowingId: id,
          assetId,
          assetType,
          assetDetailId: borrowingRow.assetDetailId || borrowingRow.asset_detail_id || null,
          assetDetailName: borrowingRow.assetDetailName || borrowingRow.asset_detail_name || null,
          assetDetailCode: borrowingRow.assetDetailCode || borrowingRow.asset_detail_code || null,
          assetLocation: borrowingRow.assetLocation || '',
          roomName: data.destinationRoom || borrowingRow.destinationRoom || borrowingRow.destination_room || '',
          operatorUserId: borrowingRow.userId ?? borrowingRow.user_id ?? null,
          startedAt: startedAt,
          usageCount: data.quantity !== undefined ? (data.quantity && data.quantity > 0 ? data.quantity : 1) : (borrowingRow.quantity || 1),
          notes: data.notes || borrowingRow.notes || null,
          createdBy: (borrowingRow.userId || borrowingRow.user_id) as number
        });
      } catch {
        // ignore logging errors
      }
    }

    if (hasReturnFields) {
      const borrowingRow = borrowing.data as any;
      const assetId = Number(borrowingRow.assetId ?? borrowingRow.asset_id);
      const assetType = borrowingRow.assetType ?? borrowingRow.asset_type ?? 'medical';
      const assetDetailId = borrowingRow.assetDetailId ?? borrowingRow.asset_detail_id ?? null;
      const assetDetailCode = borrowingRow.assetDetailCode ?? borrowingRow.asset_detail_code ?? null;
      const returnCondition = data.returnCondition
        ?? borrowingRow.returnCondition
        ?? borrowingRow.return_condition
        ?? null;

      await this.syncAssetDetailBorrowingState(
        assetId,
        assetType,
        {
          detailId: assetDetailId,
          detailCode: assetDetailCode,
          returnCondition
        }
      );

      try {
        await this.completeUsageLogForBorrowing({
          borrowingId: id,
          assetId,
          assetType,
          assetDetailId,
          operatorUserId: borrowingRow.userId ?? borrowingRow.user_id ?? null,
          conditionAfter: returnCondition,
          notes: data.returnNotes ?? borrowingRow.returnNotes ?? borrowingRow.return_notes ?? null
        });
      } catch {
        // ignore logging errors to avoid breaking borrowing update flow
      }

      const returnValidatedBy = borrowingRow.returnValidatedBy
        ?? borrowingRow.return_validated_by
        ?? null;
      const returnValidatedAt = borrowingRow.returnValidatedAt
        ?? borrowingRow.return_validated_at
        ?? null;

      if (returnValidatedBy || returnValidatedAt) {
        await this.syncAssetMasterAfterValidatedReturn(assetId, assetType, {
          borrowingId: id,
          assetDetailId,
          returnCondition
        });
      }
    }

    return this.getById(id);
  }

  async delete(id: string, deletedBy?: number, deleteReason?: string): Promise<ApiResponse> {
    await this.syncOverdueBorrowings();

    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id, asset_id, asset_type, asset_detail_id, status FROM borrowing_records WHERE id = ? AND deleted_at IS NULL',
      [id]
    );

    if (rows.length === 0) {
      return { success: false, message: 'Borrowing not found' };
    }

    const borrowing = rows[0] as {
      asset_id: number;
      asset_type?: string | null;
      asset_detail_id?: string | null;
      status: string;
    };

    const assetId = borrowing.asset_id;
    const assetType = borrowing.asset_type || 'medical';
    const assetDetailId = borrowing.asset_detail_id || undefined;
    const isAssetFallbackDetail = this.isAssetFallbackDetailId(assetDetailId, assetId, assetType);

    const shouldReleaseAsset =
      ['approved', 'borrowed', 'overdue'].includes(borrowing.status) &&
      (!assetDetailId || isAssetFallbackDetail);

    if (shouldReleaseAsset) {
      const [activeRows] = await pool.query<RowDataPacket[]>(
        `SELECT id FROM borrowing_records
         WHERE asset_id = ? AND COALESCE(asset_type, 'medical') = ?
           AND id <> ?
           AND deleted_at IS NULL
           AND ${this.getBorrowingLockWhereClause('status', 'return_validated_at')}
         LIMIT 1`,
        [assetId, assetType, id]
      );

      if (activeRows.length === 0) {
        await this.assetService.updateStatus(String(assetId), 'available', assetType);
      }
    }

    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE borrowing_records
       SET deleted_at = NOW(),
           deleted_by = ?,
           delete_reason = ?,
           updated_at = NOW()
       WHERE id = ?
         AND deleted_at IS NULL`,
      [deletedBy ?? null, deleteReason?.trim() || null, id]
    );

    if (result.affectedRows === 0) {
      return { success: false, message: 'Borrowing not found' };
    }

    await this.syncAssetDetailBorrowingState(assetId, assetType, {
      detailId: assetDetailId || null
    });

    return { success: true, message: 'Data peminjaman/pengembalian diarsipkan' };
  }

  /**
   * Check if user has blocking borrowings (overdue + sanction active + not extended)
   * Returns true jika user TIDAK boleh meminjam (ada blocking borrowing)
   */
  async hasBlockingBorrowings(userId: number): Promise<boolean> {
    const query = `
      SELECT COUNT(*) as count FROM borrowing_records
      WHERE user_id = ?
        AND deleted_at IS NULL
        AND status IN ('approved', 'borrowed', 'overdue')
        AND due_date IS NOT NULL
        AND NOW() > due_date
      LIMIT 1
    `;

    const [rows] = await pool.query<RowDataPacket[]>(query, [userId]);

    if (rows.length === 0) return false;
    const countRow = rows[0] as any;
    return countRow.count > 0;
  }

  /**
   * Get all blocking borrowings for a user
   */
  async getBlockingBorrowings(userId: number): Promise<ApiResponse<Borrowing[]>> {
    const query = `
      SELECT * FROM borrowing_records
      WHERE user_id = ?
        AND deleted_at IS NULL
        AND status IN ('approved', 'borrowed', 'overdue')
        AND due_date IS NOT NULL
        AND NOW() > due_date
      ORDER BY due_date ASC
    `;

    const [rows] = await pool.query<RowDataPacket[]>(query, [userId]);

    if (rows.length === 0) {
      return {
        success: true,
        message: 'No blocking borrowings found',
        data: []
      };
    }

    return {
      success: true,
      message: `Found ${rows.length} blocking borrowing(s)`,
      data: rows.map(row => normalizeBorrowingDateFields(row as any))
    };
  }

  /**
   * Extend borrowing due date (perpanjangan peminjaman)
   */
  async extend(id: string, data: ExtendBorrowingDTO, actorUserId: number, actorRole?: string | null): Promise<ApiResponse<Borrowing>> {
    const borrowing = await this.getById(id);

    if (!borrowing.success || !borrowing.data) {
      return { success: false, message: 'Peminjaman tidak ditemukan' };
    }

    const borrowData = borrowing.data as any;
    const borrowerId = Number(borrowData.userId ?? borrowData.user_id);

    if (!Number.isFinite(actorUserId) || actorUserId <= 0) {
      return { success: false, message: 'Authentication required' };
    }

    const isOwnBorrowing = Number.isFinite(borrowerId) && borrowerId === actorUserId;
    const staffPjAccessError = this.validateStaffPjSameInstallation(
      borrowData,
      data.actorRole ?? actorRole,
      data.actorWorkUnit,
      'memperpanjang'
    );
    if (staffPjAccessError) {
      return { success: false, message: staffPjAccessError };
    }

    const isManager = hasAnyRole(actorRole, ['admin', 'leader']);
    const isSameInstallationStaffPj = hasAnyRole(actorRole, ['staff_pj', 'staff pj']);

    if (!isOwnBorrowing && !isManager && !isSameInstallationStaffPj) {
      return {
        success: false,
        message: 'Perpanjangan peminjaman hanya dapat diajukan oleh user peminjam sendiri, Staff PJ satu instalasi, leader, atau admin.'
      };
    }

    // Hanya status overdue yang bisa diperpanjang
    if (borrowData.status !== 'overdue') {
      return {
        success: false,
        message: `Hanya peminjaman yang tertunda (overdue) yang dapat diperpanjang. Status saat ini: ${borrowData.status}`
      };
    }

    const newDueDate = normalizeDateInput(data.newDueDate);
    if (!newDueDate) {
      return { success: false, message: 'Tanggal jatuh tempo baru tidak valid' };
    }

    // Validasi: tanggal baru harus lebih dari sekarang
    if (newDueDate <= new Date()) {
      return {
        success: false,
        message: 'Tanggal jatuh tempo baru harus lebih besar dari tanggal saat ini'
      };
    }

    const extensionNotes = normalizeOptionalText(data.extensionNotes) || 'Perpanjangan waktu peminjaman';
    const maxExtensions = 3; // Maksimal 3 kali perpanjangan
    const currentExtensions = Number(borrowData.extensionCount ?? borrowData.extension_count ?? 0) || 0;
    const isExtensionBlocked = Boolean(borrowData.isExtensionBlocked ?? borrowData.is_extension_blocked);

    if (isExtensionBlocked) {
      return {
        success: false,
        message: 'Perpanjangan telah dikunci. Alat harus segera dikembalikan.'
      };
    }

    if (currentExtensions >= maxExtensions) {
      return {
        success: false,
        message: `Jumlah perpanjangan telah mencapai batas maksimal (${maxExtensions}x). Harap mengembalikan alat terlebih dahulu.`
      };
    }

    const updateFields = [
      { field: 'due_date', value: formatDateTimeForMySQL(newDueDate) },
      { field: 'extension_count', value: currentExtensions + 1 },
      { field: 'last_extended_date', value: formatDateTimeForMySQL(new Date()) },
      { field: 'extension_notes', value: extensionNotes },
      { field: 'status', value: 'borrowed' }, // Ubah status kembali ke borrowed setelah perpanjangan
      { field: 'sanction_status', value: 'resolved' }, // Lepas sanction jika extension diterima
      { field: 'overdue_days', value: 0 }
    ];

    const setClause = updateFields.map(f => `${f.field} = ?`).join(', ');
    const values = updateFields.map(f => f.value);
    values.push(id);

    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE borrowing_records SET ${setClause}, updated_at = NOW() WHERE id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return { success: false, message: 'Gagal memperbarui perpanjangan' };
    }

    return await this.getById(id);
  }
}

export default new BorrowingService();
