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
import { AssetService } from './asset.service';

interface AssetUsageRow extends RowDataPacket, AssetUsageLog {
  asset_name?: string | null;
  asset_code?: string | null;
  asset_location?: string | null;
  operator_name?: string | null;
  operator_nip?: string | null;
  created_by_name?: string | null;
}

interface CountRow extends RowDataPacket {
  count: number;
}

interface ActiveBorrowingRow extends RowDataPacket {
  id: number;
}

type UsageSyncOptions = {
  detailId?: string | null;
  detailCode?: string | null;
  conditionAfter?: string | null;
  endedAt?: string | Date | null;
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

const mapUsageRow = (row: AssetUsageRow): AssetUsageLog => ({
  ...row,
  assetName: row.asset_name || row.assetName,
  assetCode: row.asset_code || row.assetCode,
  assetLocation: row.asset_location || row.assetLocation,
  operatorName: row.operator_name || row.operatorName,
  operatorNip: row.operator_nip || row.operatorNip,
  createdByName: row.created_by_name || row.createdByName,
  startedAt: toLocalIsoDateTime(row.startedAt ?? (row as any).started_at) as any,
  endedAt: toLocalIsoDateTime(row.endedAt ?? (row as any).ended_at) as any,
});

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

  private matchesAssetDetail(detail: Record<string, any>, detailId?: string | null, detailCode?: string | null): boolean {
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

  private normalizeUsageConditionLabel(value?: string | null): string | null {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return null;
    if (normalized.includes('rusak') || normalized.includes('damaged') || normalized.includes('broken')) return 'Rusak';
    if (normalized.includes('cukup') || normalized.includes('fair')) return 'Cukup';
    if (normalized.includes('poor') || normalized.includes('buruk') || normalized.includes('kurang')) return 'Cukup';
    return 'Baik';
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

  private async syncAssetStateAfterUsage(assetId: number, assetType: AssetType, options?: UsageSyncOptions): Promise<void> {
    const endedAt = formatDateTimeForMySQL(options?.endedAt);
    if (!endedAt) return;

    const normalizedAssetType = this.normalizeAssetType(assetType);
    const assetResponse = await this.assetService.getById(String(assetId), normalizedAssetType);
    if (!assetResponse.success || !assetResponse.data) return;

    const specifications = this.parseAssetSpecifications(assetResponse.data.specifications);
    const details = Array.isArray(specifications.details) ? specifications.details : [];
    const detailId = this.normalizeDetailIdentifier(options?.detailId);
    const detailCode = this.normalizeDetailIdentifier(options?.detailCode);
    const isFallbackDetail = this.isAssetFallbackDetailId(detailId, assetId, normalizedAssetType);
    const shouldMatchSpecificDetail = Boolean((detailId && !isFallbackDetail) || detailCode);

    const normalizedDetailCondition = this.normalizeUsageConditionLabel(options?.conditionAfter);
    const normalizedAssetCondition = this.normalizeAssetCondition(options?.conditionAfter);
    const damagedUsage = this.isDamagedUsageCondition(options?.conditionAfter);

    if (details.length > 0) {
      let hasChanges = false;
      const updatedDetails = details.map((rawDetail: any) => {
        const detail = rawDetail && typeof rawDetail === 'object' ? { ...rawDetail } : rawDetail;
        if (!detail || typeof detail !== 'object') return rawDetail;

        const isTarget = shouldMatchSpecificDetail
          ? this.matchesAssetDetail(detail, detailId, detailCode)
          : true;

        if (!isTarget) return rawDetail;

        const nextStatus = damagedUsage ? 'Dalam Perbaikan' : 'Aktif';
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

      if (shouldMatchSpecificDetail) {
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

  private buildBorrowingDetailWhere(assetId: number, assetType: AssetType, detailId?: string | null): { clause: string; params: any[] } {
    const normalizedDetailId = this.normalizeDetailIdentifier(detailId);
    const isFallbackDetail = this.isAssetFallbackDetailId(normalizedDetailId, assetId, assetType);

    if (!normalizedDetailId || isFallbackDetail) {
      const fallbackIds = [`asset-${assetId}`, `asset-${assetType}-${assetId}`];
      return {
        clause: 'AND (asset_detail_id IS NULL OR asset_detail_id IN (?, ?))',
        params: fallbackIds
      };
    }

    return {
      clause: 'AND asset_detail_id = ?',
      params: [normalizedDetailId]
    };
  }

  private async syncBorrowingReturnAfterUsageComplete(log: AssetUsageLog): Promise<void> {
    const endedAt = formatDateTimeForMySQL(log.endedAt);
    if (!endedAt) return;

    const assetId = Number(log.assetId);
    const assetType = this.normalizeAssetType(log.assetType);
    const detailWhere = this.buildBorrowingDetailWhere(assetId, assetType, log.assetDetailId);
    const operatorId = log.operatorUserId ? Number(log.operatorUserId) : null;
    const operatorClause = operatorId ? 'AND user_id = ?' : '';
    const conditionAfter = this.normalizeUsageConditionLabel(log.conditionAfter || log.conditionBefore) || 'Baik';

    const [rows] = await pool.query<ActiveBorrowingRow[]>(
      `SELECT id
       FROM borrowing_records
       WHERE asset_id = ?
         AND COALESCE(asset_type, 'medical') = ?
         AND status IN ('approved', 'borrowed', 'overdue')
         ${detailWhere.clause}
         ${operatorClause}
       ORDER BY borrow_date DESC, created_at DESC
       LIMIT 1`,
      [
        assetId,
        assetType,
        ...detailWhere.params,
        ...(operatorId ? [operatorId] : [])
      ]
    );

    const borrowingId = rows[0]?.id;
    if (!borrowingId) return;

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
        borrowingId
      ]
    );
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
    const { page, limit, assetId, assetType, roomName, usageContext, dateFrom, dateTo } = filters;
    const offset = (page - 1) * limit;

    let query = `
      SELECT l.*,
        COALESCE(ma.name, na.name) as asset_name,
        COALESCE(ma.asset_code, na.asset_code) as asset_code,
        COALESCE(ma.location, na.location) as asset_location,
        op.name as operator_name,
        op.nip as operator_nip,
        creator.name as created_by_name
      FROM asset_usage_logs l
      LEFT JOIN medical_assets ma ON l.asset_type = 'medical' AND l.asset_id = ma.id
      LEFT JOIN non_medical_assets na ON l.asset_type = 'non_medical' AND l.asset_id = na.id
      LEFT JOIN users op ON l.operator_user_id = op.id
      LEFT JOIN users creator ON l.created_by = creator.id
      WHERE 1=1
    `;
    let countQuery = 'SELECT COUNT(*) as count FROM asset_usage_logs WHERE 1=1';
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
        COALESCE(ma.name, na.name) as asset_name,
        COALESCE(ma.asset_code, na.asset_code) as asset_code,
        COALESCE(ma.location, na.location) as asset_location,
        op.name as operator_name,
        op.nip as operator_nip,
        creator.name as created_by_name
       FROM asset_usage_logs l
       LEFT JOIN medical_assets ma ON l.asset_type = 'medical' AND l.asset_id = ma.id
       LEFT JOIN non_medical_assets na ON l.asset_type = 'non_medical' AND l.asset_id = na.id
       LEFT JOIN users op ON l.operator_user_id = op.id
       LEFT JOIN users creator ON l.created_by = creator.id
       WHERE l.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return { success: false, message: 'Asset usage log not found' };
    }

    return { success: true, message: 'Asset usage log retrieved successfully', data: mapUsageRow(rows[0]) };
  }

  async create(data: CreateAssetUsageLogDTO): Promise<ApiResponse<AssetUsageLog>> {
    const startedAt = formatDateTimeForMySQL(data.startedAt);
    const endedAt = formatDateTimeForMySQL(data.endedAt);
    if (!startedAt) {
      return { success: false, message: 'Tanggal mulai penggunaan tidak valid' };
    }
    if (endedAt && new Date(endedAt).getTime() < new Date(startedAt).getTime()) {
      return { success: false, message: 'Waktu selesai tidak boleh lebih awal dari waktu mulai' };
    }

    const generatedNo = data.no || generateUsageNumber(data.startedAt);

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO asset_usage_logs (
        no, asset_id, asset_type, asset_detail_id, asset_detail_name, asset_detail_code,
        asset_location, room_name, operator_user_id, usage_context, started_at,
        ended_at, usage_count, condition_before, condition_after, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        generatedNo,
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
        data.createdBy
      ]
    );

    if (data.endedAt) {
      await this.syncAssetStateAfterUsage(data.assetId, data.assetType || 'medical', {
        detailId: data.assetDetailId,
        detailCode: data.assetDetailCode,
        conditionAfter: data.conditionAfter,
        endedAt: data.endedAt
      });
    } else {
      // mark the detail/master as in-use so UI shows "Sedang Digunakan"
      await this.markAssetDetailInUse(data.assetId, data.assetType || 'medical', {
        detailId: data.assetDetailId,
        detailCode: data.assetDetailCode
      });
    }

    return this.getById(String(result.insertId));
  }

  async update(id: string, data: UpdateAssetUsageLogDTO): Promise<ApiResponse<AssetUsageLog>> {
    const existingLog = await this.getById(id);
    if (!existingLog.success || !existingLog.data) {
      return existingLog;
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
        detailId: updatedLog.data.assetDetailId,
        detailCode: updatedLog.data.assetDetailCode,
        conditionAfter: updatedLog.data.conditionAfter,
        endedAt: updatedLog.data.endedAt
      });

      if (!existingLog.data.endedAt && data.endedAt !== undefined) {
        await this.syncBorrowingReturnAfterUsageComplete(updatedLog.data);
      }
    }

    return this.getById(id);
  }

  async delete(id: string): Promise<ApiResponse> {
    const [result] = await pool.query<ResultSetHeader>('DELETE FROM asset_usage_logs WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return { success: false, message: 'Asset usage log not found' };
    }
    return { success: true, message: 'Asset usage log deleted successfully' };
  }
}
