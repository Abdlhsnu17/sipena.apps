
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../config/database';
import {
    ApiResponse,
    Asset,
    AssetFilters,
    PaginatedResponse,
    ResetInventorySummary
} from '../models';
import { generateAssetCode } from '../utils/helpers';
import { ensureNonMedicalConditionColumn, ensureNonMedicalSpecificationsColumn } from '../utils/schema';
import { withConnection, withTransaction } from '../utils/transaction';

function getAssetTable(type?: string) {
  return type === 'non_medical' ? 'non_medical_assets' : 'medical_assets';
}

function getAssetSelectFields(table: string) {
  return table === 'non_medical_assets' ? "*, 'non_medical' as type" : '*';
}

const nonMedicalColumnMap: Record<string, string> = {
  assetCode: 'asset_code',
  name: 'name',
  category: 'category',
  brand: 'brand',
  model: 'model',
  serialNumber: 'serial_number',
  purchaseDate: 'purchase_date',
  warrantyExpiry: 'warranty_expiry',
  location: 'location',
  status: 'status',
  condition: '`condition`',
  usagePurpose: 'usage_purpose',
  createdBy: 'created_by',
  specifications: 'specifications',
};

function resolveNonMedicalColumn(key: string): string | undefined {
  return nonMedicalColumnMap[key];
}
const statusMapping: Record<string, string> = {
  'Aktif': 'available',
  'available': 'available',
  'Non-Aktif': 'disposed',
  'inactive': 'disposed',
  'disposed': 'disposed',
  'Dalam Perbaikan': 'maintenance',
  'maintenance': 'maintenance',
  'Sedang Digunakan': 'borrowed',
  'Dalam Penggunaan': 'borrowed',
  'in_use': 'borrowed',
  'borrowed': 'borrowed',
};

const conditionMapping: Record<string, string> = {
  'Baik': 'good',
  'good': 'good',
  'Cukup': 'fair',
  'fair': 'fair',
  'Rusak': 'damaged',
  'damaged': 'damaged',
};

function normalizeStatus(status: unknown): string {
  return typeof status === 'string' ? (statusMapping[status] || status) : 'available';
}

function normalizeCondition(condition: unknown): string {
  return typeof condition === 'string' ? (conditionMapping[condition] || condition) : 'good';
}

interface AssetRow extends RowDataPacket, Asset {}
interface CountRow extends RowDataPacket {
  count: number;
}
interface TableExistsRow extends RowDataPacket {
  table_exists: number;
}

const IN_USE_DETAIL_STATUSES = new Set(['Sedang Digunakan', 'Dalam Penggunaan']);

export class AssetService {
  private async tableExists(connection: any, tableName: string): Promise<boolean> {
    const [rows] = (await connection.query(
      `SELECT COUNT(*) AS table_exists
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = ?`,
      [tableName]
    )) as [TableExistsRow[], any];

    return Number(rows[0]?.table_exists || 0) > 0;
  }

  private async deleteTableRows(connection: any, tableName: string): Promise<number> {
    if (!(await this.tableExists(connection, tableName))) {
      return 0;
    }

    const [result] = (await connection.query(`DELETE FROM ${tableName}`)) as [ResultSetHeader, any];
    return result.affectedRows || 0;
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

  private buildDetailCandidates(detail: Record<string, any>): string[] {
    return Array.from(
      new Set(
        [
          detail.id,
          detail.detailId,
          detail.assetDetailId,
          detail.assetCode,
          detail.detailCode,
          detail.serialNumber,
        ]
          .map((value) => this.normalizeDetailIdentifier(value))
          .filter(Boolean)
      )
    );
  }

  private async hasActiveUsageForDetail(assetId: number, assetType: string, detail: Record<string, any>): Promise<boolean> {
    const candidates = this.buildDetailCandidates(detail);
    const normalizedAssetType = assetType === 'non_medical' ? 'non_medical' : 'medical';
    const fallbackIds = [`asset-${assetId}`, `asset-${normalizedAssetType}-${assetId}`];
    const allCandidates = Array.from(new Set([...candidates, ...fallbackIds]));
    const candidatePlaceholders = allCandidates.map(() => '?').join(', ');

    const [rows] = await pool.query<CountRow[]>(
      `SELECT COUNT(*) as count
       FROM asset_usage_logs
       WHERE asset_id = ?
         AND COALESCE(asset_type, 'medical') = ?
         AND ended_at IS NULL
         AND (
           asset_detail_id IS NULL
           ${allCandidates.length > 0 ? `OR asset_detail_id IN (${candidatePlaceholders}) OR asset_detail_code IN (${candidatePlaceholders})` : ''}
         )`,
      [assetId, normalizedAssetType, ...allCandidates, ...allCandidates]
    );

    return (rows[0]?.count || 0) > 0;
  }

  private async reconcileStaleUsageDetailStatuses(rows: AssetRow[], assetType?: string): Promise<void> {
    const normalizedAssetType = assetType === 'non_medical' ? 'non_medical' : 'medical';
    const table = getAssetTable(normalizedAssetType);

    for (const row of rows) {
      const specifications = this.parseAssetSpecifications(row.specifications);
      const details = Array.isArray(specifications.details) ? specifications.details : [];
      if (details.length === 0) continue;

      let hasChanges = false;
      const updatedDetails = [];

      for (const rawDetail of details) {
        const detail = rawDetail && typeof rawDetail === 'object' ? { ...rawDetail } : rawDetail;
        if (!detail || typeof detail !== 'object' || !IN_USE_DETAIL_STATUSES.has(detail.status)) {
          updatedDetails.push(rawDetail);
          continue;
        }

        const hasActiveUsage = await this.hasActiveUsageForDetail(Number(row.id), normalizedAssetType, detail);
        if (hasActiveUsage) {
          updatedDetails.push(rawDetail);
          continue;
        }

        detail.status = detail.condition === 'Rusak' ? 'Dalam Perbaikan' : 'Aktif';
        hasChanges = true;
        updatedDetails.push(detail);
      }

      if (!hasChanges) continue;

      const nextSpecifications = { ...specifications, details: updatedDetails };
      await pool.query(`UPDATE ${table} SET specifications = ?, updated_at = NOW() WHERE id = ?`, [
        JSON.stringify(nextSpecifications),
        row.id,
      ]);
      row.specifications = nextSpecifications;
    }
  }

  async getAll(filters: AssetFilters): Promise<PaginatedResponse<Asset>> {
    const { page, limit, search, category, status, type } = filters;
    const offset = (page - 1) * limit;


    // Tentukan tabel berdasarkan type (default: medical_assets)
    const table = getAssetTable(type);
    const selectFields = getAssetSelectFields(table);
    let query = `SELECT ${selectFields} FROM ${table} WHERE 1=1`;
    let countQuery = `SELECT COUNT(*) as count FROM ${table} WHERE 1=1`;
    const params: any[] = [];

    if (search) {
      const searchParam = `%${search}%`;
      const searchParams: any[] = [];
      
      let searchParts = ['name LIKE ?', 'asset_code LIKE ?'];
      searchParams.push(searchParam, searchParam);
      
      if (table === 'medical_assets') {
        searchParts.push('description LIKE ?');
        searchParams.push(searchParam);
      }
      
      const searchConditions = ` AND (${searchParts.join(' OR ')})`;
      query += searchConditions;
      countQuery += searchConditions;
      params.push(...searchParams);
    }

    if (category) {
      query += ' AND category = ?';
      countQuery += ' AND category = ?';
      params.push(category);
    }

    if (status) {
      query += ' AND status = ?';
      countQuery += ' AND status = ?';
      params.push(status);
    }

    // type hanya untuk filter, bukan penentu tabel (sudah dipakai di atas)

    const countParams = [...params];
    query += ' ORDER BY LOWER(TRIM(name)) ASC, id ASC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [dataRows] = await pool.query<AssetRow[]>(query, params);
    const [countRows] = await pool.query<CountRow[]>(countQuery, countParams);
    await this.reconcileStaleUsageDetailStatuses(dataRows, type);

    const total = countRows[0].count;

    return {
      success: true,
      message: 'Assets retrieved successfully',
      data: dataRows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }


  async getById(id: string, type: string = 'medical'): Promise<ApiResponse<Asset>> {
    const table = getAssetTable(type);
    const selectFields = getAssetSelectFields(table);
    const [rows] = await pool.query<AssetRow[]>(`SELECT ${selectFields} FROM ${table} WHERE id = ?`, [id]);

    if (rows.length === 0) {
      return { success: false, message: 'Asset not found' };
    }

    return {
      success: true,
      message: 'Asset retrieved successfully',
      data: rows[0]
    };
  }


  async create(data: any): Promise<ApiResponse<any>> {
    const assetCode = data.assetCode || generateAssetCode(data.type);
    const table = getAssetTable(data.type);
    let result: ResultSetHeader;
    let newRows: AssetRow[];

    try {
      if (table === 'non_medical_assets') {
        await ensureNonMedicalSpecificationsColumn();
        await ensureNonMedicalConditionColumn();
        const fields: string[] = ['asset_code', 'name', 'category'];
        const values: any[] = [assetCode, data.name, data.category];

        if (data.brand) {
          fields.push('brand');
          values.push(data.brand);
        }
        if (data.model) {
          fields.push('model');
          values.push(data.model);
        }
        if (data.serialNumber) {
          fields.push('serial_number');
          values.push(data.serialNumber);
        }
        if (data.purchaseDate) {
          fields.push('purchase_date');
          values.push(data.purchaseDate);
        }
        if (data.warrantyExpiry) {
          fields.push('warranty_expiry');
          values.push(data.warrantyExpiry);
        }
        if (data.location) {
          fields.push('location');
          values.push(data.location);
        }
        fields.push('status', '`condition`', 'specifications', 'usage_purpose');
        values.push(
          normalizeStatus(data.status || 'available'),
          normalizeCondition(data.condition || 'good'),
          data.specifications ? JSON.stringify(data.specifications) : null,
          data.usagePurpose || 'Operasional Bersama'
        );

        if (data.createdBy) {
          fields.push('created_by');
          values.push(data.createdBy);
        }

        const placeholders = fields.map(() => '?').join(', ');
        [result] = await pool.query<ResultSetHeader>(
          `INSERT INTO non_medical_assets (${fields.join(', ')}) VALUES (${placeholders})`,
          values
        );
        [newRows] = await pool.query<AssetRow[]>(
          `SELECT ${getAssetSelectFields('non_medical_assets')} FROM non_medical_assets WHERE id = ?`,
          [result.insertId]
        );
      } else {
        [result] = await pool.query<ResultSetHeader>(
          `INSERT INTO medical_assets (asset_code, name, description, category, type, status, \`condition\`, location, purchase_date, purchase_price, warranty_expiry, specifications, image_url)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            assetCode,
            data.name,
            data.description || null,
            data.category,
            data.type,
            data.status || 'available',
            data.condition || 'good',
            data.location || null,
            data.purchaseDate || null,
            data.purchasePrice || null,
            data.warrantyExpiry || null,
            data.specifications ? JSON.stringify(data.specifications) : null,
            data.imageUrl || null
          ]
        );
        [newRows] = await pool.query<AssetRow[]>(
          `SELECT ${getAssetSelectFields('medical_assets')} FROM medical_assets WHERE id = ?`,
          [result.insertId]
        );
      }
    } catch (error: any) {
      if (error?.code === 'ER_DUP_ENTRY') {
        return {
          success: false,
          message: 'Kode aset sudah digunakan'
        };
      }
      throw error;
    }

    return {
      success: true,
      message: 'Asset created successfully',
      data: newRows[0]
    };
  }


  async update(id: string, data: any, type?: string): Promise<ApiResponse<any>> {
    const assetType = type || data?.type || 'medical';
    const table = getAssetTable(assetType);
    const [existingRows] = await pool.query<AssetRow[]>(`SELECT id FROM ${table} WHERE id = ?`, [id]);

    if (existingRows.length === 0) {
      return { success: false, message: 'Asset not found' };
    }

    let fields: string[] = [];
    let values: any[] = [];
    const payload = { ...data };
    delete payload.type;

    if (table === 'non_medical_assets') {
      await ensureNonMedicalSpecificationsColumn();
      await ensureNonMedicalConditionColumn();
      Object.entries(payload).forEach(([key, value]) => {
        if (value === undefined) return;
        const column = resolveNonMedicalColumn(key);
        if (!column) return;
        fields.push(`${column} = ?`);
        let finalValue = value;
        if (key === 'specifications') {
          finalValue = JSON.stringify(value);
        } else if (key === 'status') {
          finalValue = normalizeStatus(value);
        } else if (key === 'condition') {
          finalValue = normalizeCondition(value);
        }
        values.push(finalValue);
      });
    } else {
      Object.entries(payload).forEach(([key, value]) => {
        if (value !== undefined) {
          const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
          const columnName = snakeKey === 'condition' ? '`condition`' : snakeKey;
          fields.push(`${columnName} = ?`);
          values.push(key === 'specifications' ? JSON.stringify(value) : value);
        }
      });
    }

    if (fields.length === 0) {
      return { success: false, message: 'No fields to update' };
    }

    fields.push('updated_at = NOW()');
    values.push(id);

    try {
      await pool.query(`UPDATE ${table} SET ${fields.join(', ')} WHERE id = ?`, values);
    } catch (error: any) {
      if (error?.code === 'ER_DUP_ENTRY') {
        return { success: false, message: 'Kode aset sudah digunakan' };
      }
      throw error;
    }

    const selectFields = getAssetSelectFields(table);
    const [updatedRows] = await pool.query<AssetRow[]>(`SELECT ${selectFields} FROM ${table} WHERE id = ?`, [id]);

    return {
      success: true,
      message: 'Asset updated successfully',
      data: updatedRows[0]
    };
  }


  async delete(id: string, type: string = 'medical'): Promise<ApiResponse> {
    const table = getAssetTable(type);
    const [result] = await pool.query<ResultSetHeader>(`DELETE FROM ${table} WHERE id = ?`, [id]);

    if (result.affectedRows === 0) {
      return { success: false, message: 'Asset not found' };
    }

    return { success: true, message: 'Asset deleted successfully' };
  }

  async resetInventory(): Promise<ApiResponse<ResetInventorySummary>> {
    const summary = await withConnection(pool, async (connection) =>
      withTransaction(connection, async (transaction) => {
        const returnRecords = await this.deleteTableRows(transaction, 'return_records');
        const maintenanceHistory = await this.deleteTableRows(transaction, 'maintenance_history');
        const assetUsageLogs = await this.deleteTableRows(transaction, 'asset_usage_logs');
        const maintenanceRecords = await this.deleteTableRows(transaction, 'maintenance_records');
        const maintenanceSchedules = await this.deleteTableRows(transaction, 'jadwal_pemeliharaan');
        const borrowingRecords = await this.deleteTableRows(transaction, 'borrowing_records');
        const medicalAssets = await this.deleteTableRows(transaction, 'medical_assets');
        const nonMedicalAssets = await this.deleteTableRows(transaction, 'non_medical_assets');

        const totalDeleted =
          returnRecords +
          maintenanceHistory +
          assetUsageLogs +
          maintenanceRecords +
          maintenanceSchedules +
          borrowingRecords +
          medicalAssets +
          nonMedicalAssets;

        return {
          returnRecords,
          maintenanceHistory,
          assetUsageLogs,
          maintenanceRecords,
          maintenanceSchedules,
          borrowingRecords,
          medicalAssets,
          nonMedicalAssets,
          totalDeleted,
        };
      })
    );

    return {
      success: true,
      message: 'Data inventaris berhasil dihapus. Data pengguna tetap tersimpan.',
      data: summary,
    };
  }


  async updateStatus(id: string, status: string, type: string = 'medical'): Promise<ApiResponse<Asset>> {
    const table = getAssetTable(type);
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE ${table} SET status = ?, updated_at = NOW() WHERE id = ?`,
      [status, id]
    );

    if (result.affectedRows === 0) {
      return { success: false, message: 'Asset not found' };
    }

    const selectFields = getAssetSelectFields(table);
    const [rows] = await pool.query<AssetRow[]>(`SELECT ${selectFields} FROM ${table} WHERE id = ?`, [id]);

    return {
      success: true,
      message: 'Asset status updated successfully',
      data: rows[0]
    };
  }
}

export default new AssetService();
