import { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../config/database';
import {
    ApiResponse,
    Asset,
    AssetType,
    CompleteMaintenanceDTO,
    CreateMaintenanceDTO,
    Maintenance,
    MaintenanceFilters,
    PaginatedResponse,
    UpdateMaintenanceDTO
} from '../models';
import { formatCostLabel, formatDateTimeForMySQL, generateMaintenanceCode } from '../utils/helpers';
import { AssetService } from './asset.service';
import * as MaintenanceHistoryService from './maintenance_history.service';

interface MaintenanceRow extends RowDataPacket, Maintenance {
  requester_name?: string | null;
  requester_nip?: string | null;
  validator_name?: string | null;
  validator_nip?: string | null;
}

const toLocalIsoDateTime = (value?: string | Date | null): string => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return '';
  const pad = (num: number) => String(num).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};
interface CountRow extends RowDataPacket {
  count: number;
}

export class MaintenanceService {
  private assetService: AssetService;
  private readonly activeStatuses = ['requested', 'scheduled', 'in_progress'];
  private readonly releasableStatuses = ['completed', 'validated', 'cancelled'];
  private readonly activeBorrowingStatuses = ['pending', 'approved', 'borrowed', 'overdue'];
  
  // Maintenance interval configuration (in months)
  private readonly maintenanceIntervals: Record<string, number> = {
    'preventive': 1,     // Rutin (Routine) - every 1 month
    'corrective': 3,     // Perbaikan (Repair) - every 3 months
    'calibration': 6,    // Kalibrasi - every 6 months
    'inspection': 12     // Inspeksi - every 12 months
  };

  constructor() {
    this.assetService = new AssetService();
  }

  private normalizeAssetType(value?: string | null): AssetType {
    return value === 'non_medical' ? 'non_medical' : 'medical';
  }

  private normalizeAssetId(value?: string | number | null): number | null {
    if (value === undefined || value === null) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  private isActiveMaintenanceStatus(status?: string | null): boolean {
    if (!status) return false;
    return this.activeStatuses.includes(status);
  }

  private isReleasableMaintenanceStatus(status?: string | null): boolean {
    if (!status) return false;
    return this.releasableStatuses.includes(status);
  }

  private formatDateOnly(value?: string | Date | null): string | null {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(date.getTime())) return null;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private addMonths(value: Date, months: number): Date {
    const nextDate = new Date(value);
    nextDate.setMonth(nextDate.getMonth() + months);
    return nextDate;
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

  private getAssetFallbackDetailIds(assetId: number, assetType: AssetType): string[] {
    const normalizedAssetType = assetType === 'non_medical' ? 'non_medical' : 'medical';
    return [`asset-${assetId}`, `asset-${normalizedAssetType}-${assetId}`];
  }

  private isAssetFallbackDetailId(
    detailId?: string | null,
    assetId?: number | null,
    assetType?: AssetType
  ): boolean {
    if (!detailId || !assetId || !assetType) return false;
    return this.getAssetFallbackDetailIds(assetId, assetType).includes(
      this.normalizeDetailIdentifier(detailId)
    );
  }

  private getMaintenanceInterval(maintenanceType?: string | null): number {
    if (!maintenanceType) return 1; // Default to 1 month
    return this.maintenanceIntervals[maintenanceType] || 1;
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

    return false;
  }

  private async syncAssetDetailMaintenance(
    assetId: number,
    assetType: AssetType,
    maintenanceStatus?: string | null,
    options?: {
      detailId?: string | null;
      detailCode?: string | null;
      completedAt?: string | Date | null;
      scheduledAt?: string | Date | null;
      maintenanceType?: string | null;
    }
  ): Promise<void> {
    if (!maintenanceStatus) return;

    const detailId = this.normalizeDetailIdentifier(options?.detailId);
    const detailCode = this.normalizeDetailIdentifier(options?.detailCode);
    const shouldMatchSpecificDetail = Boolean(detailId || detailCode);

    const assetResponse = await this.assetService.getById(String(assetId), assetType);
    if (!assetResponse.success || !assetResponse.data) return;

    const specifications = this.parseAssetSpecifications(assetResponse.data.specifications);
    const details = Array.isArray(specifications.details) ? specifications.details : [];
    if (details.length === 0) return;

    let hasChanges = false;
    const completionDateSource = options?.completedAt || options?.scheduledAt || new Date();
    const completedDateOnly = this.formatDateOnly(completionDateSource);
    
    // Calculate next maintenance date based on maintenance type interval
    const maintenanceInterval = this.getMaintenanceInterval(options?.maintenanceType);
    const nextMaintenanceDateOnly = completedDateOnly
      ? this.formatDateOnly(this.addMonths(new Date(completionDateSource), maintenanceInterval))
      : null;

    const updatedDetails = details.map((rawDetail: any) => {
      const detail = rawDetail && typeof rawDetail === 'object' ? { ...rawDetail } : rawDetail;
      if (!detail || typeof detail !== 'object') return rawDetail;

      const isTarget = shouldMatchSpecificDetail
        ? this.matchesAssetDetail(detail, detailId, detailCode)
        : true;

      if (!isTarget) return rawDetail;

      if (this.isActiveMaintenanceStatus(maintenanceStatus)) {
        if (detail.status !== 'Dalam Perbaikan') {
          detail.status = 'Dalam Perbaikan';
          hasChanges = true;
        }
        return detail;
      }

      if (!this.isReleasableMaintenanceStatus(maintenanceStatus)) {
        return rawDetail;
      }

      if (detail.status !== 'Aktif') {
        detail.status = 'Aktif';
        hasChanges = true;
      }

      if (
        (maintenanceStatus === 'completed' || maintenanceStatus === 'validated') &&
        completedDateOnly
      ) {
        if (detail.lastMaintenance !== completedDateOnly) {
          detail.lastMaintenance = completedDateOnly;
          hasChanges = true;
        }
        if (nextMaintenanceDateOnly && detail.nextMaintenance !== nextMaintenanceDateOnly) {
          detail.nextMaintenance = nextMaintenanceDateOnly;
          hasChanges = true;
        }
      }

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
      assetType
    );
  }

  private async hasOtherActiveMaintenance(
    assetId: number,
    assetType: AssetType,
    excludeMaintenanceId?: string | number
  ): Promise<boolean> {
    const params: any[] = [assetId, assetType, ...this.activeStatuses];
    let query = `
      SELECT COUNT(*) as count
      FROM maintenance_records
      WHERE asset_id = ?
        AND COALESCE(asset_type, 'medical') = ?
        AND status IN (?, ?, ?)
    `;

    if (excludeMaintenanceId !== undefined && excludeMaintenanceId !== null) {
      query += ' AND id <> ?';
      params.push(excludeMaintenanceId);
    }

    const [rows] = await pool.query<CountRow[]>(query, params);
    return (rows[0]?.count || 0) > 0;
  }

  private async hasActiveBorrowingForMaintenance(
    assetId: number,
    assetType: AssetType,
    detailId?: string | null
  ): Promise<boolean> {
    const normalizedDetailId = this.normalizeDetailIdentifier(detailId);
    const isAssetFallbackDetail = this.isAssetFallbackDetailId(
      normalizedDetailId,
      assetId,
      assetType
    );

    if (!normalizedDetailId || isAssetFallbackDetail) {
      const [rows] = await pool.query<CountRow[]>(
        `SELECT COUNT(*) as count
         FROM borrowing_records
         WHERE asset_id = ?
           AND COALESCE(asset_type, 'medical') = ?
           AND status IN (?, ?, ?, ?)`,
        [assetId, assetType, ...this.activeBorrowingStatuses]
      );

      return (rows[0]?.count || 0) > 0;
    }

    const fallbackDetailIds = this.getAssetFallbackDetailIds(assetId, assetType);
    const [rows] = await pool.query<CountRow[]>(
      `SELECT COUNT(*) as count
       FROM borrowing_records
       WHERE asset_id = ?
         AND COALESCE(asset_type, 'medical') = ?
         AND status IN (?, ?, ?, ?)
         AND (
           asset_detail_id = ?
           OR asset_detail_id IS NULL
           OR asset_detail_id IN (?, ?)
         )`,
      [
        assetId,
        assetType,
        ...this.activeBorrowingStatuses,
        normalizedDetailId,
        fallbackDetailIds[0],
        fallbackDetailIds[1]
      ]
    );

    return (rows[0]?.count || 0) > 0;
  }

  private async validateBorrowingLockForMaintenance(
    assetId: number,
    assetType: AssetType,
    detailId?: string | null
  ): Promise<ApiResponse | null> {
    const hasActiveBorrowing = await this.hasActiveBorrowingForMaintenance(
      assetId,
      assetType,
      detailId
    );

    if (!hasActiveBorrowing) {
      return null;
    }

    return {
      success: false,
      message: 'Aset masih dalam peminjaman aktif dan baru bisa dipelihara setelah dikembalikan'
    };
  }

  private async syncAssetAvailability(
    assetId: number,
    assetType: AssetType,
    maintenanceStatus?: string | null,
    excludeMaintenanceId?: string | number
  ): Promise<void> {
    if (this.isActiveMaintenanceStatus(maintenanceStatus)) {
      await this.assetService.updateStatus(String(assetId), 'maintenance', assetType);
      return;
    }

    if (!this.isReleasableMaintenanceStatus(maintenanceStatus)) {
      return;
    }

    const stillHasActiveMaintenance = await this.hasOtherActiveMaintenance(
      assetId,
      assetType,
      excludeMaintenanceId
    );

    if (!stillHasActiveMaintenance) {
      await this.assetService.updateStatus(String(assetId), 'available', assetType);
    }
  }

  private async resolveAssetForMaintenance(
    assetId: number,
    preferredType?: AssetType
  ): Promise<{ asset: ApiResponse<Asset>; type: AssetType } | null> {
    const candidates: AssetType[] = preferredType ? [preferredType] : ['medical', 'non_medical'];

    for (const candidate of candidates) {
      const assetResponse = await this.assetService.getById(String(assetId), candidate);
      if (assetResponse.success && assetResponse.data) {
        return { asset: assetResponse, type: candidate };
      }
    }

    return null;
  }

  async getAll(filters: MaintenanceFilters): Promise<PaginatedResponse<Maintenance>> {
    const { page, limit, status, assetId, assetType, type } = filters;
    const offset = (page - 1) * limit;

    let query = `
      SELECT m.*,
        COALESCE(ma.name, na.name) as asset_name,
        COALESCE(ma.asset_code, na.asset_code) as asset_code,
        COALESCE(ma.location, na.location) as asset_location,
        COALESCE(m.asset_type, ma.type, 'medical') as asset_type,
        u.name as requester_name,
        u.nip as requester_nip,
        v.name as validator_name,
        v.nip as validator_nip
      FROM maintenance_records m
      LEFT JOIN medical_assets ma ON (m.asset_type IS NULL OR m.asset_type = 'medical') AND m.asset_id = ma.id
      LEFT JOIN non_medical_assets na ON m.asset_type = 'non_medical' AND m.asset_id = na.id
      LEFT JOIN users u ON m.created_by = u.id
      LEFT JOIN users v ON m.completed_by = v.id
      WHERE 1=1
    `;
    let countQuery = 'SELECT COUNT(*) as count FROM maintenance_records WHERE 1=1';
    const params: any[] = [];

    if (status) {
      query += ' AND m.status = ?';
      countQuery += ' AND status = ?';
      params.push(status);
    }

    if (assetId) {
      query += ' AND m.asset_id = ?';
      countQuery += ' AND asset_id = ?';
      params.push(assetId);
    }

    if (assetType) {
      query += " AND COALESCE(m.asset_type, 'medical') = ?";
      countQuery += " AND COALESCE(asset_type, 'medical') = ?";
      params.push(assetType);
    }

    if (type) {
      query += ' AND m.type = ?';
      countQuery += ' AND type = ?';
      params.push(type);
    }

    const countParams = [...params];
    query += ' ORDER BY m.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [dataRows] = await pool.query<MaintenanceRow[]>(query, params);
    const [countRows] = await pool.query<CountRow[]>(countQuery, countParams);

    const total = countRows[0].count;

    // Tambahkan costLabel pada setiap data
    const dataWithLabel = dataRows.map(row => ({
      ...row,
      scheduledDate: toLocalIsoDateTime(row.scheduledDate ?? row.scheduled_date ?? null),
      costLabel: formatCostLabel(row.cost),
      requesterName: row.requester_name || undefined,
      requesterNip: row.requester_nip || undefined,
      validatorName: row.validator_name || undefined,
      validatorNip: row.validator_nip || undefined
    }));
    return {
      success: true,
      message: 'Maintenance records retrieved successfully',
      data: dataWithLabel,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    };
  }

  async getById(id: string): Promise<ApiResponse<Maintenance>> {
    const [rows] = await pool.query<MaintenanceRow[]>(
      `SELECT m.*,
        COALESCE(ma.name, na.name) as asset_name,
        COALESCE(ma.asset_code, na.asset_code) as asset_code,
        COALESCE(ma.location, na.location) as asset_location,
        COALESCE(m.asset_type, ma.type, 'medical') as asset_type,
        u.name as requester_name,
        u.nip as requester_nip,
        v.name as validator_name,
        v.nip as validator_nip
       FROM maintenance_records m
       LEFT JOIN medical_assets ma ON (m.asset_type IS NULL OR m.asset_type = 'medical') AND m.asset_id = ma.id
       LEFT JOIN non_medical_assets na ON m.asset_type = 'non_medical' AND m.asset_id = na.id
       LEFT JOIN users u ON m.created_by = u.id
       LEFT JOIN users v ON m.completed_by = v.id
      WHERE m.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return { success: false, message: 'Maintenance record not found' };
    }

    // Tambahkan costLabel pada detail
    const dataWithLabel = {
      ...rows[0],
      scheduledDate: toLocalIsoDateTime(rows[0].scheduledDate ?? rows[0].scheduled_date ?? null),
      costLabel: formatCostLabel(rows[0].cost),
      requesterName: rows[0].requester_name || undefined,
      requesterNip: rows[0].requester_nip || undefined,
      validatorName: rows[0].validator_name || undefined,
      validatorNip: rows[0].validator_nip || undefined
    };
    return { success: true, message: 'Maintenance record retrieved successfully', data: dataWithLabel };
  }

  async create(data: CreateMaintenanceDTO): Promise<ApiResponse<Maintenance>> {
    const maintenanceCode = generateMaintenanceCode();

    const statusValue = data.status || 'scheduled';

    const resolvedAsset = await this.resolveAssetForMaintenance(data.assetId, data.assetType);
    if (!resolvedAsset) {
      return { success: false, message: 'Asset not found for maintenance' };
    }
    const { type: resolvedType } = resolvedAsset;

    if (this.isActiveMaintenanceStatus(statusValue)) {
      const borrowingLockError = await this.validateBorrowingLockForMaintenance(
        data.assetId,
        resolvedType,
        data.assetDetailId
      );
      if (borrowingLockError) {
        return borrowingLockError;
      }
    }

    const scheduledDateValue = formatDateTimeForMySQL(data.scheduledDate);
    if (!scheduledDateValue) {
      return { success: false, message: 'Scheduled date is invalid' };
    }

    const descriptionValue = data.description || '';

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO maintenance_records (
         maintenance_code,
         asset_id,
         asset_type,
         asset_detail_id,
         asset_detail_name,
         asset_detail_code,
         schedule_id,
         type,
         status,
         scheduled_date,
         description,
         technician,
         cost,
         notes,
         created_by
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        maintenanceCode,
        data.assetId,
        resolvedType,
        data.assetDetailId || null,
        data.assetDetailName || null,
        data.assetDetailCode || null,
        data.scheduleId || null,
        data.type,
        statusValue,
        scheduledDateValue,
        descriptionValue,
        data.technician || null,
        data.cost || null,
        data.notes || null,
        data.createdBy
      ]
    );

    const [newRows] = await pool.query<MaintenanceRow[]>('SELECT * FROM maintenance_records WHERE id = ?', [result.insertId]);
    const newMaintenance = newRows[0];

    await this.syncAssetAvailability(
      data.assetId,
      resolvedType,
      statusValue,
      newMaintenance.id
    );

    await this.syncAssetDetailMaintenance(data.assetId, resolvedType, statusValue, {
      detailId: data.assetDetailId,
      detailCode: data.assetDetailCode,
      scheduledAt: data.scheduledDate,
      maintenanceType: data.type
    });

    // Create maintenance history entry
    try {
      await MaintenanceHistoryService.create({
        maintenanceId: newMaintenance.id,
        assetId: newMaintenance.asset_id,
        type: newMaintenance.type,
        status: newMaintenance.status,
        scheduledDate: newMaintenance.scheduled_date,
        description: newMaintenance.description || '',
        technician: newMaintenance.technician || undefined,
        cost: newMaintenance.cost || undefined,
        notes: newMaintenance.notes || undefined,
        createdBy: newMaintenance.created_by || data.createdBy,
      });
    } catch (historyError) {
      console.error('Error creating maintenance history:', historyError);
      // Continue even if history fails, as the main record is created
    }

    // Tambahkan costLabel pada hasil create
    const dataWithLabel = {
      ...newMaintenance,
      scheduledDate: toLocalIsoDateTime(newMaintenance.scheduled_date ?? null),
      costLabel: formatCostLabel(newMaintenance.cost),
    };
    return { success: true, message: 'Maintenance record created successfully', data: dataWithLabel };
  }

  async update(id: string, data: UpdateMaintenanceDTO): Promise<ApiResponse<Maintenance>> {
    const existing = await this.getById(id);
    if (!existing.success) return existing;

    const existingMaintenance = existing.data as unknown as Record<string, any>;
    const existingAssetId = this.normalizeAssetId(
      existingMaintenance.assetId ?? existingMaintenance.asset_id
    );
    const existingAssetType = this.normalizeAssetType(
      existingMaintenance.assetType ?? existingMaintenance.asset_type
    );
    const nextAssetId = this.normalizeAssetId(data.assetId) ?? existingAssetId;
    const nextAssetType = this.normalizeAssetType(data.assetType ?? existingAssetType);
    const nextStatus = data.status ?? existingMaintenance.status;
    const existingDetailId = this.normalizeDetailIdentifier(
      existingMaintenance.assetDetailId ?? existingMaintenance.asset_detail_id
    );
    const existingDetailCode = this.normalizeDetailIdentifier(
      existingMaintenance.assetDetailCode ?? existingMaintenance.asset_detail_code
    );
    const nextDetailId = this.normalizeDetailIdentifier(data.assetDetailId) || existingDetailId;
    const nextDetailCode = this.normalizeDetailIdentifier(data.assetDetailCode) || existingDetailCode;
    const nextScheduledDate =
      data.scheduledDate ?? existingMaintenance.scheduledDate ?? existingMaintenance.scheduled_date;
    const nextMaintenanceType = data.type ?? existingMaintenance.type ?? existingMaintenance.maintenance_type;

    if (nextAssetId && this.isActiveMaintenanceStatus(nextStatus)) {
      const borrowingLockError = await this.validateBorrowingLockForMaintenance(
        nextAssetId,
        nextAssetType,
        nextDetailId
      );
      if (borrowingLockError) {
        return borrowingLockError;
      }
    }

    const fields: string[] = [];
    const values: any[] = [];

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        let normalizedValue = value;
        if (key === 'scheduledDate') {
          const formatted = formatDateTimeForMySQL(value);
          if (!formatted) {
            throw new Error('Invalid scheduled date');
          }
          normalizedValue = formatted;
        }
        fields.push(`${snakeKey} = ?`);
        values.push(normalizedValue);
      }
    });

    if (fields.length === 0) {
      return { success: false, message: 'No fields to update' };
    }

    fields.push('updated_at = NOW()');
    values.push(id);

    await pool.query(`UPDATE maintenance_records SET ${fields.join(', ')} WHERE id = ?`, values);

    if (
      existingAssetId &&
      nextAssetId &&
      (existingAssetId !== nextAssetId || existingAssetType !== nextAssetType)
    ) {
      const previousAssetStillActive = await this.hasOtherActiveMaintenance(
        existingAssetId,
        existingAssetType,
        id
      );

      if (!previousAssetStillActive) {
        await this.assetService.updateStatus(String(existingAssetId), 'available', existingAssetType);
      }
    }

    if (nextAssetId) {
      await this.syncAssetAvailability(nextAssetId, nextAssetType, nextStatus, id);
      await this.syncAssetDetailMaintenance(nextAssetId, nextAssetType, nextStatus, {
        detailId: nextDetailId,
        detailCode: nextDetailCode,
        completedAt: existingMaintenance.completedDate ?? existingMaintenance.completed_date,
        scheduledAt: nextScheduledDate,
        maintenanceType: nextMaintenanceType
      });
    }

    if (
      existingAssetId &&
      (existingAssetId !== nextAssetId ||
        existingAssetType !== nextAssetType ||
        existingDetailId !== nextDetailId ||
        existingDetailCode !== nextDetailCode ||
        existingMaintenance.status !== nextStatus)
    ) {
      await this.syncAssetDetailMaintenance(existingAssetId, existingAssetType, 'cancelled', {
        detailId: existingDetailId,
        detailCode: existingDetailCode
      });
    }

    const [rows] = await pool.query<MaintenanceRow[]>('SELECT * FROM maintenance_records WHERE id = ?', [id]);

    return { success: true, message: 'Maintenance record updated successfully', data: rows[0] };
  }

  async complete(id: string, data: CompleteMaintenanceDTO): Promise<ApiResponse<Maintenance>> {
    const maintenance = await this.getById(id);
    if (!maintenance.success) return maintenance;

    const maintenanceData = maintenance.data as unknown as Record<string, any>;
    const assetId = this.normalizeAssetId(
      maintenanceData.assetId ?? maintenanceData.asset_id
    );
    const assetType = this.normalizeAssetType(
      maintenanceData.assetType ?? maintenanceData.asset_type
    );
    const maintenanceType = maintenanceData.type ?? maintenanceData.maintenance_type;

    await pool.query(
      `UPDATE maintenance_records 
       SET status = 'completed', completed_date = NOW(), notes = COALESCE(?, notes), cost = COALESCE(?, cost), completed_by = ?, updated_at = NOW()
       WHERE id = ?`,
      [data.notes || null, data.cost || null, data.completedBy, id]
    );

    if (assetId) {
      await this.syncAssetAvailability(assetId, assetType, 'completed', id);
      await this.syncAssetDetailMaintenance(assetId, assetType, 'completed', {
        detailId: this.normalizeDetailIdentifier(
          maintenanceData.assetDetailId ?? maintenanceData.asset_detail_id
        ),
        detailCode: this.normalizeDetailIdentifier(
          maintenanceData.assetDetailCode ?? maintenanceData.asset_detail_code
        ),
        completedAt: new Date(),
        scheduledAt: maintenanceData.scheduledDate ?? maintenanceData.scheduled_date,
        maintenanceType: maintenanceType
      });
    }

    const updated = await this.getById(id);
    if (!updated.success) return updated;
    return {
      ...updated,
      message: 'Maintenance completed successfully'
    };
  }

  async delete(id: string): Promise<ApiResponse> {
    const existing = await this.getById(id);
    if (!existing.success || !existing.data) {
      return { success: false, message: 'Maintenance record not found' };
    }

    const existingMaintenance = existing.data as unknown as Record<string, any>;
    const existingAssetId = this.normalizeAssetId(
      existingMaintenance.assetId ?? existingMaintenance.asset_id
    );
    const existingAssetType = this.normalizeAssetType(
      existingMaintenance.assetType ?? existingMaintenance.asset_type
    );
    const existingStatus = existingMaintenance.status as string | undefined;
    const existingDetailId = this.normalizeDetailIdentifier(
      existingMaintenance.assetDetailId ?? existingMaintenance.asset_detail_id
    );
    const existingDetailCode = this.normalizeDetailIdentifier(
      existingMaintenance.assetDetailCode ?? existingMaintenance.asset_detail_code
    );

    const [result] = await pool.query<ResultSetHeader>('DELETE FROM maintenance_records WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return { success: false, message: 'Maintenance record not found' };
    }

    if (existingAssetId) {
      await this.syncAssetAvailability(existingAssetId, existingAssetType, 'cancelled', id);

      if (existingStatus) {
        await this.syncAssetDetailMaintenance(existingAssetId, existingAssetType, 'cancelled', {
          detailId: existingDetailId,
          detailCode: existingDetailCode
        });
      }
    }

    return { success: true, message: 'Maintenance record deleted successfully' };
  }
}

export default new MaintenanceService();
