import { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../config/database';
import {
  ApiResponse,
  AssetUsageFilters,
  AssetUsageLog,
  CreateAssetUsageLogDTO,
  PaginatedResponse,
  UpdateAssetUsageLogDTO
} from '../models';
import { formatDateTimeForMySQL } from '../utils/helpers';

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

const toLocalIsoDateTime = (value?: string | Date | null): string => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return '';
  const pad = (num: number) => String(num).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
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

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO asset_usage_logs (
        asset_id, asset_type, asset_detail_id, asset_detail_name, asset_detail_code,
        asset_location, room_name, operator_user_id, usage_context, started_at,
        ended_at, usage_count, condition_before, condition_after, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
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

    return this.getById(String(result.insertId));
  }

  async update(id: string, data: UpdateAssetUsageLogDTO): Promise<ApiResponse<AssetUsageLog>> {
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
