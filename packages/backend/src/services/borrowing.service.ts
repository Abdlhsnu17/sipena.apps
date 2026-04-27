import { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../config/database';
import {
    ApiResponse,
    Borrowing,
    BorrowingFilters,
    CreateBorrowingDTO,
    PaginatedResponse,
    ReturnBorrowingDTO,
    UpdateBorrowingDTO
} from '../models';
import { buildOverdueSanctionNote, generateBorrowingCode, getOverdueDays } from '../utils/helpers';
import { AssetService } from './asset.service';

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

const formatDateTimeForMySQL = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

const normalizeOptionalText = (value?: string | null): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
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

interface CountRow extends RowDataPacket {
  count: number;
}

interface ColumnCountRow extends RowDataPacket {
  count: number;
}

export class BorrowingService {
  private assetService: AssetService;
  private readonly activeBorrowingStatuses = ['pending', 'approved', 'borrowed', 'overdue'] as const;
  private readonly activeMaintenanceStatuses = ['requested', 'scheduled', 'in_progress'] as const;
  private sanctionColumnsAvailable: boolean | null = null;

  constructor() {
    this.assetService = new AssetService();
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

  private isDamagedReturnCondition(condition?: string | null): boolean {
    const normalized = String(condition || '').toLowerCase();
    return normalized.includes('rusak') || normalized.includes('damaged') || normalized.includes('broken');
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
         AND ${this.getBorrowingLockWhereClause('status', 'return_validated_at')}`,
      [assetId, normalizedAssetType]
    );

    const [maintenanceRows] = await pool.query<RowDataPacket[]>(
      `SELECT asset_detail_id
       FROM maintenance_records
       WHERE asset_id = ?
         AND COALESCE(asset_type, 'medical') = ?
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
        u.name as user_name, u.nip as user_nip,
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
      WHERE 1=1
    `;

    let countQuery = 'SELECT COUNT(*) as count FROM borrowing_records WHERE 1=1';
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
      data: dataRows,
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
        u.name as user_name, u.nip as user_nip,
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
       WHERE b.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return { success: false, message: 'Borrowing not found' };
    }

    return { success: true, message: 'Borrowing retrieved successfully', data: rows[0] };
  }

  async create(data: CreateBorrowingDTO): Promise<ApiResponse<Borrowing>> {
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
      const details = this.getAssetDetails(asset.data?.specifications);
      const selectedDetail = this.findDetailById(details, detailId);
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
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'borrowed', NOW())`,
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

    if (!detailId || isAssetFallbackDetail) {
      await this.assetService.updateStatus(
        String(data.assetId),
        'borrowed',
        assetType
      );
    }

    // Fetch hasil insert untuk dikembalikan (gunakan getById agar join tabel aset berjalan)
    await this.syncAssetDetailBorrowingState(data.assetId, assetType, {
      detailId: detailId || null,
      detailCode: data.assetDetailCode || null
    });

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
    
    // Update status aset (pastikan mengirim assetType yang benar ke AssetService)
    if (!borrowing.data?.assetDetailId || isAssetFallbackDetail) {
      await this.assetService.updateStatus(
        String(borrowing.data.assetId),
        'borrowed',
        borrowing.data.assetType || 'medical' 
      );
    }

    await pool.query(
      'UPDATE borrowing_records SET status = ?, approved_by = ?, approved_at = NOW(), updated_at = NOW() WHERE id = ?',
      ['approved', approvedBy, id]
    );

    await this.syncAssetDetailBorrowingState(borrowing.data.assetId, borrowing.data.assetType || 'medical', {
      detailId: borrowing.data.assetDetailId || null,
      detailCode: borrowing.data.assetDetailCode || null
    });

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

    return await this.getById(id);
  }

  async update(id: string, data: UpdateBorrowingDTO): Promise<ApiResponse<Borrowing>> {
    await this.syncOverdueBorrowings();

    const borrowing = await this.getById(id);
    if (!borrowing.success || !borrowing.data) {
      return { success: false, message: 'Borrowing not found' };
    }

    const editableStatuses = ['pending', 'approved'];
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
        return { success: false, message: 'Hanya peminjaman dengan status pending/approved yang bisa diubah' };
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

    await pool.query(
      `UPDATE borrowing_records SET ${clause}, updated_at = NOW() WHERE id = ?`,
      params
    );

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

  async delete(id: string): Promise<ApiResponse> {
    await this.syncOverdueBorrowings();

    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id, asset_id, asset_type, asset_detail_id, status FROM borrowing_records WHERE id = ?',
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
           AND ${this.getBorrowingLockWhereClause('status', 'return_validated_at')}
         LIMIT 1`,
        [assetId, assetType, id]
      );

      if (activeRows.length === 0) {
        await this.assetService.updateStatus(String(assetId), 'available', assetType);
      }
    }

    const [result] = await pool.query<ResultSetHeader>('DELETE FROM borrowing_records WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return { success: false, message: 'Borrowing not found' };
    }

    await this.syncAssetDetailBorrowingState(assetId, assetType, {
      detailId: assetDetailId || null
    });

    return { success: true, message: 'Borrowing deleted successfully' };
  }
}

export default new BorrowingService();
