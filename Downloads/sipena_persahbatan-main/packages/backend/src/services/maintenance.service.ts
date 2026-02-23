import { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../config/database';
import {
    ApiResponse,
    CompleteMaintenanceDTO,
    CreateMaintenanceDTO,
    Maintenance,
    MaintenanceFilters,
    PaginatedResponse,
    UpdateMaintenanceDTO,
    Asset,
    AssetType
} from '../models';
import { formatCostLabel, generateMaintenanceCode } from '../utils/helpers';
import { AssetService } from './asset.service';
import * as MaintenanceHistoryService from './maintenance_history.service';

interface MaintenanceRow extends RowDataPacket, Maintenance {
  requester_name?: string | null;
  requester_nip?: string | null;
  validator_name?: string | null;
  validator_nip?: string | null;
}
interface CountRow extends RowDataPacket {
  count: number;
}

export class MaintenanceService {
  private assetService: AssetService;

  constructor() {
    this.assetService = new AssetService();
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

    if (statusValue !== 'cancelled' && statusValue !== 'completed') {
      await this.assetService.updateStatus(String(data.assetId), 'maintenance', resolvedType);
    }

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
        data.scheduledDate,
        data.description,
        data.technician || null,
        data.cost || null,
        data.notes || null,
        data.createdBy
      ]
    );

    const [newRows] = await pool.query<MaintenanceRow[]>('SELECT * FROM maintenance_records WHERE id = ?', [result.insertId]);
    const newMaintenance = newRows[0];

    // Create maintenance history entry
    await MaintenanceHistoryService.create({
      maintenanceId: newMaintenance.id,
      assetId: newMaintenance.assetId,
      type: newMaintenance.type,
      status: newMaintenance.status,
      scheduledDate: newMaintenance.scheduled_date || newMaintenance.scheduledDate,
      description: newMaintenance.description,
      technician: newMaintenance.technician,
      cost: newMaintenance.cost,
      notes: newMaintenance.notes,
      createdBy: newMaintenance.created_by || data.createdBy,
    });

    // Tambahkan costLabel pada hasil create
    const dataWithLabel = { ...newMaintenance, costLabel: formatCostLabel(newMaintenance.cost) };
    return { success: true, message: 'Maintenance record created successfully', data: dataWithLabel };
  }

  async update(id: string, data: UpdateMaintenanceDTO): Promise<ApiResponse<Maintenance>> {
    const existing = await this.getById(id);
    if (!existing.success) return existing;

    const fields: string[] = [];
    const values: any[] = [];

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        fields.push(`${snakeKey} = ?`);
        values.push(value);
      }
    });

    if (fields.length === 0) {
      return { success: false, message: 'No fields to update' };
    }

    fields.push('updated_at = NOW()');
    values.push(id);

    await pool.query(`UPDATE maintenance_records SET ${fields.join(', ')} WHERE id = ?`, values);

    const [rows] = await pool.query<MaintenanceRow[]>('SELECT * FROM maintenance_records WHERE id = ?', [id]);

    return { success: true, message: 'Maintenance record updated successfully', data: rows[0] };
  }

  async complete(id: string, data: CompleteMaintenanceDTO): Promise<ApiResponse<Maintenance>> {
    const maintenance = await this.getById(id);
    if (!maintenance.success) return maintenance;

    await this.assetService.updateStatus(
      String(maintenance.data?.assetId),
      'available',
      maintenance.data?.assetType || 'medical'
    );

    await pool.query(
      `UPDATE maintenance_records 
       SET status = 'completed', completed_date = NOW(), notes = COALESCE(?, notes), cost = COALESCE(?, cost), completed_by = ?, updated_at = NOW()
       WHERE id = ?`,
      [data.notes || null, data.cost || null, data.completedBy, id]
    );

    const updated = await this.getById(id);
    if (!updated.success) return updated;
    return {
      ...updated,
      message: 'Maintenance completed successfully'
    };
  }

  async delete(id: string): Promise<ApiResponse> {
    const [result] = await pool.query<ResultSetHeader>('DELETE FROM maintenance_records WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return { success: false, message: 'Maintenance record not found' };
    }

    return { success: true, message: 'Maintenance record deleted successfully' };
  }
}

export default new MaintenanceService();
