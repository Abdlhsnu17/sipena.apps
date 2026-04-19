
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../config/database';
import {
    ApiResponse,
    Asset,
    AssetFilters,
    PaginatedResponse
} from '../models';
import { generateAssetCode } from '../utils/helpers';
import { ensureNonMedicalConditionColumn, ensureNonMedicalSpecificationsColumn } from '../utils/schema';

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
export class AssetService {
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
